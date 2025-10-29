'use strict';

/**
 * fieldRegenerator.js - OpenAI calls voor per-veld regeneratie
 * 
 * Gebruikt bestaande OpenAI instance en prompt-templates voor 
 * field-specifieke regeneratie (title/description/tags).
 */

const OpenAI = require('openai');

const IS_TEST_ENV = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
const USE_DUMMY_LLM = IS_TEST_ENV || !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy' || process.env.OPENAI_API_KEY === '';

const openai = USE_DUMMY_LLM ? null : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Dummy responses voor testing
const DUMMY_PAYLOADS = {
  title: { value: 'Test Regenerated Title - Handmade Silver Ring', retry_reason: '', warnings: [] },
  description: { value: 'Test regenerated description with improved SEO keywords and emotional appeal.', retry_reason: '', warnings: [] },
  tags: { items: ['handmade', 'silver', 'ring', 'gift', 'regenerated'], retry_reason: '', warnings: [] },
};

/**
 * Regenerate één specifiek veld (title/description/tags) met context
 * 
 * @param {string} field - 'title', 'description', of 'tags'
 * @param {object} context - Merged context (ai_fields + user_edits + targeting)
 * @param {string} uid - User ID voor logging
 * @returns {Promise<{payload, tokenUsage}>}
 */
async function regenerateField(field, context, uid) {
  if (USE_DUMMY_LLM) {
    console.log(`[fieldRegenerator] DUMMY MODE - field=${field}`);
    return {
      payload: DUMMY_PAYLOADS[field] || { value: 'dummy', retry_reason: '', warnings: [] },
      tokenUsage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    };
  }

  // Build prompt gebaseerd op veld-type
  const systemPrompt = buildSystemPrompt(field);
  const userPrompt = buildUserPrompt(field, context);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: field === 'description' ? 800 : 200,
    });

    const rawOutput = completion.choices[0]?.message?.content || '';
    const tokenUsage = {
      prompt_tokens: completion.usage?.prompt_tokens || 0,
      completion_tokens: completion.usage?.completion_tokens || 0,
      total_tokens: completion.usage?.total_tokens || 0,
    };

    // Parse output naar payload format
    const payload = parseOutput(field, rawOutput);

    console.log(`[fieldRegenerator] field=${field} tokens=${tokenUsage.total_tokens}`);
    return { payload, tokenUsage };
  } catch (err) {
    console.error('[fieldRegenerator] OpenAI call failed', err);
    throw err;
  }
}

function buildSystemPrompt(field) {
  const prompts = {
    title: `Je bent een expert Etsy SEO specialist. Genereer een optimale Etsy product title.
Regels:
- Max 140 karakters
- Bevat hoofd keywords vooraan
- Vermeldt materiaal, stijl, en gebruik
- Geen hoofdletters spam
- Natuurlijk leesbaar`,
    
    description: `Je bent een expert Etsy copywriter. Schrijf een boeiende product description.
Structuur:
1. Opening hook (emotioneel of probleem-oplossend)
2. Productdetails (materiaal, afmetingen, unieke features)
3. Gebruik/voordelen
4. Call-to-action
Max 1000 karakters, natuurlijke alinea's, geen overmatige emoji's.`,
    
    tags: `Je bent een Etsy SEO expert. Genereer 13 relevante tags.
Regels:
- Stem-deduplicatie (geen "ring" + "rings")
- Mix van breed (handmade) en niche (moonstone ring)
- Inclusief materiaal, stijl, gelegenheid
- Lowercase, max 20 karakters per tag
- Return JSON array: ["tag1", "tag2", ...]`,
  };
  return prompts[field] || 'Generate output for field: ' + field;
}

function buildUserPrompt(field, context) {
  const { title, description, tags, audience, age_bracket, tone_profile, gift_mode } = context;
  
  let prompt = `Regenerate ${field} voor dit Etsy-product:\n\n`;
  
  if (title && field !== 'title') prompt += `Title: ${title}\n`;
  if (description && field !== 'description') prompt += `Description: ${description.substring(0, 300)}...\n`;
  if (tags && field !== 'tags' && Array.isArray(tags)) prompt += `Tags: ${tags.join(', ')}\n`;
  
  prompt += '\nContext:\n';
  if (audience) prompt += `- Doelgroep: ${audience}\n`;
  if (age_bracket) prompt += `- Leeftijd: ${age_bracket}\n`;
  if (tone_profile) prompt += `- Toon: ${tone_profile}\n`;
  if (gift_mode) prompt += `- Gift mode: ja\n`;
  
  prompt += `\nGenereer nu een verbeterde versie van het ${field} veld. Output alleen de ${field}, geen extra tekst.`;
  
  return prompt;
}

function parseOutput(field, rawOutput) {
  if (field === 'tags') {
    // Probeer JSON array te parsen
    try {
      const match = rawOutput.match(/\[.*\]/s);
      if (match) {
        const items = JSON.parse(match[0]);
        return {
          items: Array.isArray(items) ? items.slice(0, 13) : [],
          retry_reason: '',
          warnings: items.length > 13 ? ['truncated_to_13'] : [],
        };
      }
    } catch (e) {
      // Fallback: split op comma's
      const items = rawOutput
        .replace(/[\[\]"']/g, '')
        .split(/[,\n]/)
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0 && t.length <= 20)
        .slice(0, 13);
      return { items, retry_reason: 'parse_fallback', warnings: ['manual_parsing'] };
    }
  }
  
  // Voor title/description: neem eerste line/paragraph
  const cleaned = rawOutput.trim().split('\n')[0] || rawOutput.trim();
  return {
    value: cleaned.substring(0, field === 'title' ? 140 : 1000),
    retry_reason: '',
    warnings: cleaned.length > (field === 'title' ? 140 : 1000) ? ['truncated'] : [],
  };
}

module.exports = { regenerateField };
