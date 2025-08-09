// generateFromDumpCore.js – AI-Hacker v3.2.1 classifier runner (with max_tokens)

require('dotenv').config();

// Dummy-LLM stub for emulator testing (ChatGPT fix #6)
const USE_DUMMY_LLM = !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy' || process.env.OPENAI_API_KEY === '';

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

/**
 * Calculate quality score based on validation warnings
 * @param {object} validation - Validation result object
 * @returns {number} - Quality score (0-100)
 */
function calculateQualityScore(validation) {
  if (!validation || !validation.warnings) {
    return 100; // Perfect score if no validation data
  }
  
  const warnings = validation.warnings;
  let deductions = 0;
  
  warnings.forEach(warning => {
    switch (warning.severity) {
      case 'high':
        deductions += 20;
        break;
      case 'medium':
        deductions += 10;
        break;
      case 'low':
        deductions += 5;
        break;
      default:
        deductions += 5;
    }
  });
  
  return Math.max(0, 100 - deductions);
}

/**
 * Update all field logs with calculated quality_score
 * @param {string} runId - Run ID
 * @param {string} uid - User ID  
 * @param {number} qualityScore - Calculated quality score
 */
async function updateFieldLogsWithQualityScore(runId, uid, qualityScore) {
  // Update logs for all users (removed uid filter per ChatGPT audit)
  
  try {
    const admin = require('firebase-admin');
    const db = admin.firestore();
    const logsCollection = db.collection('runs').doc(runId).collection('logs');
    
    // Query all field logs (title, tags, description) for this run
    const fieldLogs = await logsCollection.where('field', 'in', ['title', 'tags', 'description']).get();
    
    // Update each field log with the calculated quality_score
    const updatePromises = fieldLogs.docs.map(doc => {
      return doc.ref.update({ quality_score: qualityScore });
    });
    
    await Promise.all(updatePromises);
    console.log(`Updated ${fieldLogs.size} field logs with quality_score: ${qualityScore}`);
  } catch (error) {
    console.error('Error updating field logs with quality_score:', error);
    // Don't throw - this is a non-critical enhancement
  }
}

module.exports = async function generateFromDumpCore(rawText, uid = "unknown", options = {}) {
  const { runId = "manual-run", personaLevel = 3, allow_handmade = false, gift_mode = false } = options;
  const start = Date.now();
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
      aiResponse = {
        choices: [{
          message: {
            content: JSON.stringify(DUMMY_RESPONSES.classifier)
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
    fallback_profile: parsed.fallback_profile || ""
  };
  console.log("[DEBUG] Classifier context for downstream:", classifierContext);

  // ✅ Gebruik fieldExtractor om frontend-ready velden te genereren
  // --- Veld-voor-veld chaining met retry, validatie en logging ---
  const result = { fields: {}, validationLog: {}, classifier: classifierContext };
  let fail = false;
  let failReason = null;
  let context = { ...classifierContext }; // Start with classifier context
  let retry;

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
      const { output, tokens_in, tokens_out, retry_count, model } = await generateField("title", rawText, titleContext, retry);
      // Valideer titel
      const valid = validateFinalOutput("title", output);
      // Field logging moved to after global validation to include quality_score
      if (valid.success) {
        result.fields.title = output;
        context.title = output;
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
        prompt_version: "v2.7",
        retry_reason: "GPT-4o model failed. No fallback allowed.",
        fallback_model_used: null,
        timestamp: new Date().toISOString()
      });
      if (retry === 1) { fail = true; failReason = e.message; }
    }
  }
  if (fail) return { error: `Title generation failed: ${failReason}`, status: 422 };

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
      const { output, tokens_in, tokens_out, retry_count, model } = await generateField("tags", rawText, tagsContext, retry);
      const valid = validateFinalOutput("tags", output);
      // Field logging moved to after global validation to include quality_score
      if (valid.success) {
        result.fields.tags = output;
        context.tags = output;
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
      const { output, tokens_in, tokens_out, retry_count, model } = await generateField("description", rawText, descContext, retry);
      const valid = validateFinalOutput("description", output);
      // Field logging moved to after global validation to include quality_score
      if (valid.success) {
        result.fields.description = output;
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
      allow_handmade: options?.allow_handmade === true,
      audience: classifierContext?.audience || [],
      fallback_profile: classifierContext?.fallback_profile || null
    };
    
    // Run validators on final output
    const validationResult = runAllValidators(result.fields, validationContext);
    
    // Calculate quality_score IMMEDIATELY after validation
    const qualityScore = calculateQualityScore(validationResult);
    console.log(`[DEBUG] Quality score calculated: ${qualityScore}`);
    
    // Now log all field events with the calculated quality_score
    await logEvent({ 
      run_id: runId, 
      field: "title", 
      tokens_in: result.fields.title ? 100 : 0, // Approximate - real values logged earlier
      tokens_out: result.fields.title ? result.fields.title.length : 0,
      retry_count: 0,
      model: "gpt-4o",
      uid,
      prompt_version: "v3.0.4",
      quality_score: qualityScore,
      timestamp: new Date().toISOString()
    });
    
    await logEvent({ 
      run_id: runId, 
      field: "tags", 
      tokens_in: result.fields.tags ? 80 : 0,
      tokens_out: result.fields.tags ? result.fields.tags.length : 0,
      retry_count: 0,
      model: "gpt-4o",
      uid,
      prompt_version: "v3.0.2",
      quality_score: qualityScore,
      timestamp: new Date().toISOString()
    });
    
    await logEvent({ 
      run_id: runId, 
      field: "description", 
      tokens_in: result.fields.description ? 120 : 0,
      tokens_out: result.fields.description ? result.fields.description.length : 0,
      retry_count: 0,
      model: "gpt-4o",
      uid,
      prompt_version: "v3.0.1",
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
      isSoftFail: validationResult.isSoftFail,
      warnings: validationResult.warnings,
      metrics: validationResult.metrics
    };
    
    // Only block generation on high-severity validation failures
    if (!validationResult.isValid && validationResult.metrics.highSeverityWarnings > 0) {
      return {
        error: `Validation failed with ${validationResult.metrics.highSeverityWarnings} high-severity issues`,
        status: 422,
        validation: result.validation
      };
    }
    
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

  return result;
};
