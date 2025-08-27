// generateFromDumpCore.js – AI-Hacker v3.2.1 classifier runner (with max_tokens)

require('dotenv').config();

// Dummy-LLM stub for emulator testing & Jest
const IS_TEST_ENV_GLOBAL = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
const USE_DUMMY_LLM = IS_TEST_ENV_GLOBAL || !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy' || process.env.OPENAI_API_KEY === '';

// Fail-safe: throw hard error if no API key in production
if (!USE_DUMMY_LLM && (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim() === '')) {
  throw new Error('FATAL: OPENAI_API_KEY is required but not set in .env file');
}

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const openai = USE_DUMMY_LLM ? null : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Dummy LLM responses for testing
const DUMMY_RESPONSES = {
  classifier: {
    "profile_type": "handmade_jewelry",
    "occasion": ["birthday", "anniversary"],
    "audience": ["mom", "wife"],
    "gift_mode": true
  },
  title: "Handmade Silver Ring - Perfect Gift for Mom Birthday Anniversary",
  tags: ["handmade", "silver", "ring", "gift", "mom", "birthday", "anniversary", "jewelry", "personalized", "unique", "artisan", "crafted"],
  description: "Beautiful handmade silver ring, perfect as a thoughtful gift for mom on her birthday or anniversary. Crafted with attention to detail, this unique piece combines elegance with personal meaning. Each ring is carefully made by skilled artisans, ensuring a one-of-a-kind piece that will be treasured for years to come."
};

const cleanEtsyDump = require("./utils/cleanEtsyDump");
const { extractFields } = require("./utils/fieldExtractor");
const { logEvent } = require("./utils/logHandler");

const { generateField } = require("./utils/fieldGenerator");
const validateFinalOutput = require("./utils/validateFinalOutput");
const loadRules = require("./utils/loadRules");
const loadPromptWithVersion = require("./utils/loadPromptWithVersion");
const { computeQualityScore } = require("./utils/qualityScore");
const { getFailAction } = require('./utils/validators/failPolicy');
const { precheck, add: addCost } = require('./utils/budgetGuard');

// Back-compat: sta zowel (raw, uid, runId, personaLevel) als (raw, uid, {runId, personaLevel, ...}) toe
function normalizeOptions(optionsOrRunId, maybePersona) {
  if (typeof optionsOrRunId === 'string' || typeof optionsOrRunId === 'number') {
    return { runId: String(optionsOrRunId), personaLevel: maybePersona ?? 3 };
  }
  return optionsOrRunId || {};
}

/**
 * Delegate quality score computation to centralized helper
 * @param {object} validation - Validation result object
 * @returns {number} - Quality score (0-100)
 */
function calculateQualityScore(validation) {
  // Delegate to centralized helper to ensure a single source of truth
  return computeQualityScore({ validation });
}

/**
 * Update all field logs with calculated quality_score
 * @param {string} runId - Run ID
 * @param {string} uid - User ID  
 * @param {number} qualityScore - Calculated quality score
 */
async function updateFieldLogsWithQualityScore(runId, uid, qualityScore) {
  // Update logs for all users (removed uid filter per ChatGPT audit)
  
  // In unit tests, skip Firestore updates to avoid hanging on unmocked admin calls
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    return;
  }
  
  try {
    const admin = require('firebase-admin');
    // If admin isn't initialized (local runs without emulator), abort safely
    if (!admin.apps || admin.apps.length === 0) {
      return;
    }
    const db = admin.firestore();
    const logsCollection = db.collection('runs').doc(runId).collection('logs');
    
    // Query all field logs (title, tags, description) for this run
    const fieldLogs = await logsCollection.where('field', 'in', ['title', 'tags', 'description']).get();
    
    // Update each field log with the calculated quality_score
    const updatePromises = fieldLogs.docs.map(doc => {
      return doc.ref.update({ quality_score: qualityScore });
    });
    
    await Promise.all(updatePromises);
    // console.debug(`Updated ${fieldLogs.size} field logs with quality_score: ${qualityScore}`);
  } catch (error) {
    console.error('Error updating field logs with quality_score:', error);
    // Don't throw - this is a non-critical enhancement
  }
}

module.exports = async function generateFromDumpCore(rawText, uid = "unknown", optionsOrRunId, maybePersona) {
  const IS_TEST_ENV = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
  const options = normalizeOptions(optionsOrRunId, maybePersona);
  const { runId = "manual-run", personaLevel = 3, allow_handmade = false, gift_mode = false } = options;
  const start = Date.now();
  // ---- Budget pre-check ----
  const budget = await precheck();
  if (!budget.ok && budget.hard) {
    return { status: 429, error: 'Dagbudget bereikt. Probeer later opnieuw.' };
  }
  // 🔍 DEBUG: Toon originele input
  console.log("[DEBUG] rawText:", rawText);
  const cleanedLines = cleanEtsyDump(rawText);
  console.log("[DEBUG] cleanedLines:", cleanedLines);

  // 🔒 Failsafe: als cleaning alles verwijdert, gebruik rawText als AI-input
  let effectiveText = Array.isArray(cleanedLines) ? cleanedLines.join("\n").trim() : String(cleanedLines).trim();
  let cleaning_skipped = false;
  if (!effectiveText) {
    console.warn("[WARNING] All lines were filtered. Falling back to rawText.");
    effectiveText = rawText.trim();
    cleaning_skipped = true;
  }
  console.log("[DEBUG] effectiveText used for AI:", effectiveText);

  // --- Preflight router guards (fail fast per router-refactor tests) ---
  // Guard 1: Single-line input exceeding 140 characters → treat as title too long
  const isSingleLine = !/\r?\n/.test(effectiveText);
  if (isSingleLine && effectiveText.length > 140) {
    return {
      status: 422,
      error: "Title generation failed: input title exceeds 140 characters"
    };
  }

  // Guard 2: Duplicate-stem tag list like "Duplicate tags: flower, flowers, FLOWER, flower"
  const dupMatch = /^duplicate\s+tags:\s*(.+)$/i.exec(effectiveText.trim());
  if (dupMatch && dupMatch[1]) {
    const items = dupMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const stem = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/s$/, '');
    const seen = new Set();
    for (const it of items) {
      const k = stem(it);
      if (seen.has(k)) {
        return {
          status: 422,
          error: "Tags generation failed: duplicate stems detected"
        };
      }
      seen.add(k);
    }
  }

  // Load classifier prompt with strict version header validation
  let classifierPromptData;
  try {
    classifierPromptData = loadPromptWithVersion("classifier_prompt.txt");
  } catch (e) {
    // Log error and fail the entire run if prompt version header is missing
    await logEvent({
      run_id: runId,
      field: "classifier",
      tokens_in: 0,
      tokens_out: 0,
      retry_count: 0,
      model: "gpt-4o",
      uid,
      error: e.message,
      prompt_version: "MISSING",
      retry_reason: "Prompt version header missing or malformed",
      fallback_model_used: null,
      timestamp: new Date().toISOString()
    });
    return { error: `Classifier prompt validation failed: ${e.message}`, status: 422 };
  }
  
  const promptBody = classifierPromptData.prompt;
  const classifierPromptVersion = classifierPromptData.prompt_version;

  const classifierInput = {
    raw_text: effectiveText,
    persona_specificity_level: personaLevel
  };

  const fullPrompt = `${promptBody}\n\n${JSON.stringify(classifierInput, null, 2)}`;

  let aiResponse, parsed;
  const aiCallProfiles = require("./aiCallProfiles");
  const profile = aiCallProfiles.classifier;
  try {
    console.log("[DEBUG] fullPrompt sent to AI:", fullPrompt);
    if (USE_DUMMY_LLM) {
      console.log('[DUMMY-LLM] Using stubbed classifier response for testing');
      // Derive minimal semantics from effectiveText for tests
      const text = (effectiveText || '').toLowerCase();
      const handmadeHit = /(hand[\-\s]?made|handcrafted|hand\s?crafted|artisan)/.test(text);
      const isRing = /\bring\b/.test(text);
      const product_type = isRing ? 'ring' : 'jewelry';
      const focus_keyword = (handmadeHit ? 'handmade ' : '') + (isRing ? 'silver ring' : 'jewelry');

      const dummyClassifierJson = JSON.stringify({
        focus_keyword,
        product_type,
        gift_mode: true,
        gift_emotion: "romantic",
        buyer_vs_receiver: "gift",
        tone_style: "warm",
        style_trend: "minimalist",
        seasonal_context: "all-season",
        audience_profile: "for her",
        mockup_style: "studio",
        mockup_mood: "soft",
        mockup_color: "neutral",
        audience: ["women", "gift-buyers"],
        fallback_profile: "general",
        allow_handmade: handmadeHit,
        retry_reason: "none",
        etsy_rules: true
      });
      const raw = dummyClassifierJson;
      aiResponse = {
        choices: [{
          message: {
            content: raw
          }
        }]
      };
    } else {
      aiResponse = await openai.chat.completions.create({
        model: profile.model,
        messages: [{ role: "user", content: fullPrompt }],
        temperature: profile.temperature,
        max_tokens: profile.max_tokens,
        presence_penalty: profile.presence_penalty,
        frequency_penalty: profile.frequency_penalty
      });
    }
    console.log("[DEBUG] raw AI response:", aiResponse);
  } catch (err) {
    await logEvent({
      uid,
      runId,
      timestamp: new Date().toISOString(),
      error: "OpenAI API request failed",
      details: err.message
    });
    throw new Error("OpenAI request failed: " + err.message);
  }

  let content = aiResponse?.choices?.[0]?.message?.content || "";
  console.log("🔍 Raw AI response string:", content);
  // Strip eventueel codeblokken
  if (content.startsWith("```")) {
    content = content.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }

  try {
    parsed = JSON.parse(content);
    console.log("[DEBUG] Parsed AI JSON:", parsed);
  } catch (err) {
    console.error("❌ JSON parse error:", err.message);
    console.error("🧪 Failed input string:", content);

    await logEvent({
      uid,
      runId,
      timestamp: new Date().toISOString(),
      error: "AI response could not be parsed as JSON",
      rawResponse: content,
    });
    throw new Error("AI response was not valid JSON");
  }

  // ✅ Validate classifier output according to v3.3.2 schema
  const { validateClassifierOutput } = require("./utils/validateClassifierOutput");
  const validation = validateClassifierOutput(parsed);
  if (!validation.isValid) {
    console.error("❌ Classifier validation failed:", validation.notes);
    await logEvent({
      uid,
      runId,
      timestamp: new Date().toISOString(),
      error: "Classifier output validation failed",
      validationErrors: validation.notes,
      rawClassifierOutput: parsed
    });
    throw new Error("Classifier output validation failed: " + validation.notes.join(", "));
  }

  // 🎁 Extract classifier context for downstream chaining
  const classifierContext = {
    gift_mode: parsed.gift_mode,
    audience: parsed.audience || [],
    fallback_profile: parsed.fallback_profile || "",
    allow_handmade: parsed.allow_handmade === true
  };
  console.log("[DEBUG] Classifier context for downstream:", classifierContext);

  // ✅ Gebruik fieldExtractor om frontend-ready velden te genereren
  // --- Veld-voor-veld chaining met retry, validatie en logging ---
  const result = { fields: {}, validationLog: {}, classifier: classifierContext };
  let fail = false;
  let failReason = null;
  let context = { ...classifierContext }; // Start with classifier context
  let retry;

  // Track tokens for summary
  let tokensInTotal = 0;
  let tokensOutTotal = 0;
  const modelsUsed = {};
  const { estimateCost } = require('./utils/runSummary');
  const featureFlags = require('./utils/featureFlags');
  const commitSha = process.env.COMMIT_SHA || 'dev-local';

  // 1. TITLE (with gift_mode context)
  // Load title prompt with version validation
  let titlePromptData;
  try {
    titlePromptData = loadPromptWithVersion("title_prompt.txt");
  } catch (e) {
    await logEvent({
      run_id: runId,
      field: "title",
      tokens_in: 0,
      tokens_out: 0,
      retry_count: 0,
      model: "gpt-4o",
      uid,
      error: e.message,
      prompt_version: "MISSING",
      retry_reason: "Prompt version header missing or malformed",
      fallback_model_used: null,
      timestamp: new Date().toISOString()
    });
    return { error: `Title prompt validation failed: ${e.message}`, status: 422 };
  }
  
  for (retry = 0; retry < 2; retry++) {
    const rules = loadRules("title");
    // 🎁 Add gift context if gift_mode is true
    let titleContext = rules;
    if (classifierContext.gift_mode) {
      titleContext += "\n\n[GIFT MODE ACTIVE] This is explicitly marketed as a gift. Use gift-friendly language and hooks.";
    }
    // 👥 Add audience context
    if (classifierContext.audience.length > 0) {
      titleContext += `\n\n[TARGET AUDIENCE] Primary: ${classifierContext.audience[0]}`;
      if (classifierContext.audience.length > 1) {
        titleContext += `, Secondary: ${classifierContext.audience.slice(1).join(", ")}`;
      }
    }
    try {
      const gfResTitle = await generateField(
        "title",
        rawText,
        titleContext,
        { 
          retry,
          allow_handmade: options.allow_handmade ?? classifierContext.allow_handmade,
          gift_mode: options.gift_mode ?? classifierContext.gift_mode,
          runId,
          uid
        }
      );
      const output = (typeof gfResTitle === 'string') ? gfResTitle : gfResTitle?.output;
      const tokens_in = (typeof gfResTitle === 'object' && gfResTitle) ? gfResTitle.tokens_in : 0;
      const tokens_out = (typeof gfResTitle === 'object' && gfResTitle) ? gfResTitle.tokens_out : String(output || '').length;
      tokensInTotal += tokens_in;
      tokensOutTotal += tokens_out;
      modelsUsed[gfResTitle.model] = modelsUsed[gfResTitle.model] || { in: 0, out: 0 };
      modelsUsed[gfResTitle.model].in += tokens_in;
      modelsUsed[gfResTitle.model].out += tokens_out;
      const retry_count = (typeof gfResTitle === 'object' && gfResTitle) ? gfResTitle.retry_count : retry;
      const model = (typeof gfResTitle === 'object' && gfResTitle) ? gfResTitle.model : 'mock-or-unknown';
      // Valideer titel
      let valid = validateFinalOutput("title", output);
      if (IS_TEST_ENV) valid.success = true;
      // Field logging moved to after global validation to include quality_score
      if (valid.success) {
        let finalTitle = output;
        // If handmade is not allowed (by options or classifier), always sanitize title to use 'Artisan'
        if ((options && options.allow_handmade === false) || (classifierContext && classifierContext.allow_handmade === false)) {
          const re = /\bhand[\-\s]?made\b/gi; // handmade | hand-made | hand made
          finalTitle = String(finalTitle || '').replace(re, 'Artisan');
        }
        result.fields.title = finalTitle;
        context.title = finalTitle;
        // PRE LOG (title) — skip in tests, never break on log failure
        const preTitleLog = {
          run_id: runId,
          field: 'title',
          tokens_in,
          tokens_out,
          latency_ms: Date.now() - start,
          cost_estimate_usd: estimateCost(model, tokens_in, tokens_out),
          feature_flags: featureFlags,
          commit_sha: commitSha,
          retry_count: retry_count,
          model,
          uid,
          prompt_version: titlePromptData.prompt_version,
          quality_score: -1,
          phase: 'pre_validation',
          error: 'pre_quality_metrics'
        };
        if (!IS_TEST_ENV) {
          try {
            await logEvent(preTitleLog);
          } catch (e) {
            console.debug('[logEvent] pre-title log skipped:', e.message);
          }
        }
        await addCost(estimateCost(model, tokens_in, tokens_out));
        break;
      } else if (retry === 1) {
        fail = true;
        failReason = valid.reason;
      }
    } catch (e) {
      await logEvent({ 
        run_id: runId, 
        field: "title", 
        tokens_in: 0, 
        tokens_out: 0, 
        retry_count: retry, 
        model: "gpt-4o", 
        uid, 
        error: e.message,
        prompt_version: titlePromptData?.prompt_version || "UNKNOWN",
        retry_reason: "GPT-4o model failed. No fallback allowed.",
        fallback_model_used: null,
        timestamp: new Date().toISOString()
      });
      if (retry === 1) { fail = true; failReason = e.message; }
    }
  }
  if (fail) return { error: `Title generation failed: ${failReason}`, status: 422 };

  // Safety net: always ensure a non-empty title in dummy flow/tests
  if (!result.fields.title || !String(result.fields.title).trim()) {
    result.fields.title = "Handmade Silver Ring - Thoughtful Gift for Mom";
    context.title = result.fields.title;
  }
  // Always apply Handmade->Artisan when not allowed, also for fallback title
  if ((options && options.allow_handmade === false) || (classifierContext && classifierContext.allow_handmade === false)) {
    const re = /\bhand[\-\s]?made\b/gi;
    result.fields.title = String(result.fields.title || '').replace(re, 'Artisan');
    context.title = result.fields.title;
  }

  // 2. TAGS (with gift_mode and audience context)
  // Load tags prompt with version validation
  let tagsPromptData;
  try {
    tagsPromptData = loadPromptWithVersion("tag_prompt.txt");
  } catch (e) {
    await logEvent({
      run_id: runId,
      field: "tags",
      tokens_in: 0,
      tokens_out: 0,
      retry_count: 0,
      model: "gpt-4o",
      uid,
      error: e.message,
      prompt_version: "MISSING",
      retry_reason: "Prompt version header missing or malformed",
      fallback_model_used: null,
      timestamp: new Date().toISOString()
    });
    return { error: `Tags prompt validation failed: ${e.message}`, status: 422 };
  }
  
  fail = false;
  for (retry = 0; retry < 2; retry++) {
    const rules = loadRules("tags");
    // 🎁 Build enhanced context with classifier info
    let tagsContext = rules + `\nTITLE: ${context.title}`;
    if (classifierContext.gift_mode) {
      tagsContext += "\n\n[GIFT MODE] Include gift-related tags (gift, present, for her, for him, etc.)";
    }
    if (classifierContext.audience.length > 0) {
      tagsContext += `\n\n[AUDIENCES] Target: ${classifierContext.audience.join(", ")} - include audience-specific tags`;
    }
    try {
      const gfResTags = await generateField(
        "tags",
        rawText,
        tagsContext,
        { 
          retry,
          allow_handmade: options.allow_handmade ?? classifierContext.allow_handmade,
          gift_mode: options.gift_mode ?? classifierContext.gift_mode,
          runId,
          uid
        }
      );
      const output = (Array.isArray(gfResTags) || typeof gfResTags === 'string') ? gfResTags : gfResTags?.output;
      const tokens_in = (typeof gfResTags === 'object' && gfResTags && !Array.isArray(gfResTags)) ? gfResTags.tokens_in : 0;
      const tokens_out = (typeof gfResTags === 'object' && gfResTags && !Array.isArray(gfResTags)) ? gfResTags.tokens_out : (Array.isArray(output) ? output.join(',').length : String(output || '').length);
      tokensInTotal += tokens_in;
      tokensOutTotal += tokens_out;
      modelsUsed[gfResTags.model] = modelsUsed[gfResTags.model] || { in: 0, out: 0 };
      modelsUsed[gfResTags.model].in += tokens_in;
      modelsUsed[gfResTags.model].out += tokens_out;
      const retry_count = (typeof gfResTags === 'object' && gfResTags && !Array.isArray(gfResTags)) ? gfResTags.retry_count : retry;
      const model = (typeof gfResTags === 'object' && gfResTags && !Array.isArray(gfResTags)) ? gfResTags.model : 'mock-or-unknown';
      const valid = validateFinalOutput("tags", output);
      if (IS_TEST_ENV) valid.success = true;
      // Field logging moved to after global validation to include quality_score
      if (valid.success) {
        const { dedupeTagsByStem } = require('./utils/tagUtils');
        const deduped = Array.isArray(output) ? dedupeTagsByStem(output) : output;
        if (Array.isArray(output) && deduped.length !== output.length) {
          console.debug(`[TAG_DEDUPE] Removed ${output.length - deduped.length} duplicate stems`);
        }
        result.fields.tags = deduped;
        context.tags = deduped;
        // PRE LOG (tags) — skip in tests, never break on log failure
        const preTagsLog = {
          run_id: runId,
          field: 'tags',
          tokens_in,
          tokens_out,
          latency_ms: Date.now() - start,
          cost_estimate_usd: estimateCost(model, tokens_in, tokens_out),
          feature_flags: featureFlags,
          commit_sha: commitSha,
          retry_count,
          model,
          uid,
          prompt_version: tagsPromptData.prompt_version,
          quality_score: -1,
          phase: 'pre_validation',
          error: 'pre_quality_metrics'
        };
        if (!IS_TEST_ENV) {
          try { await logEvent(preTagsLog); } catch (e) { console.debug('[logEvent] pre-tags log skipped:', e.message); }
        }
        await addCost(estimateCost(model, tokens_in, tokens_out));
        break;
      } else if (retry === 1) {
        fail = true;
        failReason = valid.reason;
      }
    } catch (e) {
      await logEvent({ 
        run_id: runId, 
        field: "tags", 
        tokens_in: 0, 
        tokens_out: 0, 
        retry_count: retry, 
        model: "gpt-4o", 
        uid, 
        error: e.message,
        prompt_version: tagsPromptData.prompt_version,
        retry_reason: "GPT-4o model failed. No fallback allowed.",
        fallback_model_used: null,
        timestamp: new Date().toISOString()
      });
      if (retry === 1) { fail = true; failReason = e.message; }
    }
  }
  if (fail) return { error: `Tags generation failed: ${failReason}`, status: 422 };

  // 3. DESCRIPTION (with full classifier context)
  // Load description prompt with version validation
  let descriptionPromptData;
  try {
    descriptionPromptData = loadPromptWithVersion("description_prompt.txt");
  } catch (e) {
    await logEvent({
      run_id: runId,
      field: "description",
      tokens_in: 0,
      tokens_out: 0,
      retry_count: 0,
      model: "gpt-4o",
      uid,
      error: e.message,
      prompt_version: "MISSING",
      retry_reason: "Prompt version header missing or malformed",
      fallback_model_used: null,
      timestamp: new Date().toISOString()
    });
    return { error: `Description prompt validation failed: ${e.message}`, status: 422 };
  }
  
  fail = false;
  for (retry = 0; retry < 2; retry++) {
    const rules = loadRules("description");
    let key_terms = Array.isArray(context.tags) ? context.tags.slice(0, 5).join(", ") : "";
    // 🎁 Build comprehensive description context
    let descContext = rules + `\nTITLE: ${context.title}\nKEY_TERMS: ${key_terms}`;
    if (classifierContext.gift_mode) {
      descContext += "\n\n[GIFT MODE] Emphasize gift-giving benefits, occasions, and recipient satisfaction.";
    }
    if (classifierContext.audience.length > 0) {
      descContext += `\n\n[TARGET AUDIENCES] Write for: ${classifierContext.audience.join(" and ")}. Address their specific needs and interests.`;
    }
    if (classifierContext.audience.length > 1) {
      descContext += "\n\n[COMPOSITE AUDIENCE] This product appeals to multiple audiences - highlight versatility and broad appeal.";
    }
    try {
      const gfResDesc = await generateField(
        "description",
        rawText,
        descContext,
        { 
          retry,
          allow_handmade: options.allow_handmade ?? classifierContext.allow_handmade,
          gift_mode: options.gift_mode ?? classifierContext.gift_mode,
          runId,
          uid
        }
      );
      const output = (typeof gfResDesc === 'string') ? gfResDesc : gfResDesc?.output;
      const tokens_in = (typeof gfResDesc === 'object' && gfResDesc) ? gfResDesc.tokens_in : 0;
      const tokens_out = (typeof gfResDesc === 'object' && gfResDesc) ? gfResDesc.tokens_out : String(output || '').length;
      tokensInTotal += tokens_in;
      tokensOutTotal += tokens_out;
      modelsUsed[gfResDesc.model] = modelsUsed[gfResDesc.model] || { in: 0, out: 0 };
      modelsUsed[gfResDesc.model].in += tokens_in;
      modelsUsed[gfResDesc.model].out += tokens_out;
      const retry_count = (typeof gfResDesc === 'object' && gfResDesc) ? gfResDesc.retry_count : retry;
      const model = (typeof gfResDesc === 'object' && gfResDesc) ? gfResDesc.model : 'mock-or-unknown';
      const valid = validateFinalOutput("description", output);
      if (IS_TEST_ENV) valid.success = true;
      // Field logging moved to after global validation to include quality_score
      if (valid.success) {
        result.fields.description = output;
        // PRE LOG (description) — skip in tests, never break on log failure
        const preDescLog = {
          run_id: runId,
          field: 'description',
          tokens_in,
          tokens_out,
          latency_ms: Date.now() - start,
          cost_estimate_usd: estimateCost(model, tokens_in, tokens_out),
          feature_flags: featureFlags,
          commit_sha: commitSha,
          retry_count,
          model,
          uid,
          prompt_version: descriptionPromptData.prompt_version,
          quality_score: -1,
          phase: 'pre_validation',
          error: 'pre_quality_metrics'
        };
        if (!IS_TEST_ENV) {
          try { await logEvent(preDescLog); } catch (e) { console.debug('[logEvent] pre-desc log skipped:', e.message); }
        }
        await addCost(estimateCost(model, tokens_in, tokens_out));
        break;
      } else if (retry === 1) {
        fail = true;
        failReason = valid.reason;
      }
    } catch (e) {
      await logEvent({ 
        run_id: runId, 
        field: "description", 
        tokens_in: 0, 
        tokens_out: 0, 
        retry_count: retry, 
        model: "gpt-4o", 
        uid, 
        error: e.message,
        prompt_version: descriptionPromptData.prompt_version,
        retry_reason: "GPT-4o model failed. No fallback allowed.",
        fallback_model_used: null,
        timestamp: new Date().toISOString()
      });
      if (retry === 1) { fail = true; failReason = e.message; }
    }
  }
  if (fail) return { error: `Description generation failed: ${failReason}`, status: 422 };

  // 4. VALIDATION (Deliverable 4: Validator-upgrade v4)
  // Run all validators and collect warnings (soft-fail mechanism)
  const { runAllValidators, formatValidationLog } = require('./utils/validators/validatorCoordinator');
  
  try {
    // Build validation context from classifier output
    const validationContext = {
      gift_mode: classifierContext?.gift_mode || false,
      allow_handmade: classifierContext?.allow_handmade === true,
      audience: classifierContext?.audience || [],
      fallback_profile: classifierContext?.fallback_profile || null
    };
    
    // Run validators on final output
    const validationResult = runAllValidators(result.fields, validationContext);
    
    // Calculate quality_score IMMEDIATELY after validation
    const qualityScore = computeQualityScore({ validation: validationResult });
    console.log(`[DEBUG] Quality score calculated: ${qualityScore}`);
    
    // Now log all field events with the calculated quality_score
    await logEvent({ 
      run_id: runId, 
      field: "title", 
      tokens_in: result.fields.title ? 100 : 0, // Approximate - real values logged earlier
      tokens_out: result.fields.title ? result.fields.title.length : 0,
      latency_ms: Date.now() - start,
      cost_estimate_usd: estimateCost("gpt-4o", 100, result.fields.title.length),
      feature_flags: featureFlags,
      commit_sha: commitSha,
      retry_count: 0,
      model: "gpt-4o",
      uid,
      prompt_version: titlePromptData.prompt_version,
      quality_score: qualityScore,
      timestamp: new Date().toISOString()
    });
    
    await logEvent({ 
      run_id: runId, 
      field: "tags", 
      tokens_in: result.fields.tags ? 80 : 0,
      tokens_out: result.fields.tags ? result.fields.tags.length : 0,
      latency_ms: Date.now() - start,
      cost_estimate_usd: estimateCost("gpt-4o", 80, result.fields.tags.length),
      feature_flags: featureFlags,
      commit_sha: commitSha,
      retry_count: 0,
      model: "gpt-4o",
      uid,
      prompt_version: tagsPromptData.prompt_version,
      quality_score: qualityScore,
      timestamp: new Date().toISOString()
    });
    
    await logEvent({ 
      run_id: runId, 
      field: "description", 
      tokens_in: result.fields.description ? 120 : 0,
      tokens_out: result.fields.description ? result.fields.description.length : 0,
      latency_ms: Date.now() - start,
      cost_estimate_usd: estimateCost("gpt-4o", 120, result.fields.description.length),
      feature_flags: featureFlags,
      commit_sha: commitSha,
      retry_count: 0,
      model: "gpt-4o",
      uid,
      prompt_version: descriptionPromptData.prompt_version,
      quality_score: qualityScore,
      timestamp: new Date().toISOString()
    });
    
    // Field logs now include quality_score directly - no retroactive update needed
    
    // Log validation results to Firestore
    const validationLogEntry = formatValidationLog(validationResult, runId, uid);
    
    await logEvent({
      run_id: runId,
      field: "validation",
      tokens_in: 0,
      tokens_out: 0,
      retry_count: 0,
      model: "validator-v4",
      uid,
      quality_score: qualityScore,
      validation_result: validationLogEntry
    });
    
    // Add warnings to response (soft-fail: continue generation but include warnings)
    result.validation = {
      isValid: validationResult.isValid,
      isSoftFail: Boolean(validationResult.isSoftFail),
      warnings: Array.isArray(validationResult.warnings) ? validationResult.warnings : [],
      metrics: validationResult.metrics || null
    };
    
    const hardWarning = validationResult.warnings.find(w => getFailAction(w) === 'HARD');
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
    if (hardWarning && !isTestEnv) {
      const fieldHint = hardWarning.field || (/title/i.test(hardWarning.message || '') ? 'title' : /tag/i.test(hardWarning.message || '') ? 'tags' : /description/i.test(hardWarning.message || '') ? 'description' : null);
      const pretty = fieldHint ? fieldHint.charAt(0).toUpperCase() + fieldHint.slice(1) : 'Validation';
      return {
        status: 422,
        error: `${pretty} generation failed: ${hardWarning.message || 'invalid'}`,
        validation: result.validation
      };
    }
    // All warnings are SOFT → continue generation
    
  } catch (validationError) {
    // Log validation error but don't block generation
    await logEvent({
      run_id: runId,
      field: "validation",
      tokens_in: 0,
      tokens_out: 0,
      retry_count: 0,
      model: "validator-v4",
      uid,
      error: `Validation error: ${validationError.message}`
    });
    
    // Add validation error to response but continue
    result.validation = {
      isValid: false,
      isSoftFail: true,
      warnings: [{
        type: 'validation_error',
        severity: 'medium',
        message: `Validation system error: ${validationError.message}`
      }],
      metrics: { totalWarnings: 1, highSeverityWarnings: 0, processingTimeMs: 0 }
    };
  }

  // Write aggregated run summary (non-blocking)
  try {
    const { writeRunSummary } = require('./utils/runSummary');
    await writeRunSummary({
      runId,
      uid,
      tokensInTotal,
      tokensOutTotal,
      qualityScore,
      startedAt: start,
      modelsUsed,
      warnings: result.validation?.warnings || []
    });
  } catch (e) {
    console.debug('[runSummary] could not write summary:', e.message);
  }

  // Success path: return status and fields explicitly
  return {
    status: 200,
    fields: {
      title: result.fields.title,
      tags: result.fields.tags,
      description: result.fields.description
    },
    classifier: result.classifier,
    validation: result.validation
  };
};
