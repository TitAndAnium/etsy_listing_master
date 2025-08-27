// functions/utils/fieldGenerator.js

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

// Dummy-LLM support for emulator testing & Jest
const IS_TEST_ENV_GLOBAL = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
const USE_DUMMY_LLM = IS_TEST_ENV_GLOBAL || !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy' || process.env.OPENAI_API_KEY === '';
const openai = USE_DUMMY_LLM ? null : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const prompts = require("../config/prompts.js");

// Dummy responses for field generation
const DUMMY_FIELD_RESPONSES = {
  title: "Handmade Silver Ring - Perfect Gift for Mom Birthday Anniversary",
  tags: JSON.stringify(["handmade", "silver", "ring", "gift", "mom", "birthday", "anniversary", "jewelry", "personalized", "unique", "artisan", "crafted", "adjustable"]),
  description: `::: Overview :::
Plain ASCII overview of a thoughtful handmade silver ring that makes a meaningful gift.

::: Features :::
- Lightweight and comfortable
- Everyday wear
- Gift-ready packaging

::: Shipping and Processing :::
Orders are prepared quickly and shipped with tracking. Processing times are communicated clearly.

::: Call To Action :::
Add this to your cart today and make your gift special.`
};

/**
 * Genereert AI-output voor een specifiek Etsy-veldtype.
 * @param {("title"|"tags"|"description")} fieldType 
 * @param {string} cleanedInput 
 * @param {string} contextBlock 
 * @returns {Promise<string|string[]>}
 */
async function generateField(fieldType, cleanedInput, contextBlock = "", retryCount = 0) {
  // Map fieldType to prompt file from config
  let promptFile;
  if (fieldType === "title") promptFile = prompts.TITLE_PROMPT;
  else if (fieldType === "tags") promptFile = prompts.TAG_PROMPT;
  else if (fieldType === "description") promptFile = prompts.DESCRIPTION_PROMPT;
  else throw new Error(`Unknown fieldType: ${fieldType}`);

  const promptFilePath = path.join(__dirname, "../prompts/", promptFile);
  if (!fs.existsSync(promptFilePath)) {
    throw new Error(`Prompt for field type \"${fieldType}\" not found at ${promptFilePath}.`);
  }
  const prompt = fs.readFileSync(promptFilePath, "utf-8");
  const fullPrompt = `${contextBlock}\n\n${prompt}\n\nRAW_INPUT:\n${cleanedInput}`;

  // Token counting (approximation: 1 token ≈ 0.75 word)
  const tokensIn = Math.ceil(fullPrompt.split(/\s+/).length / 0.75);

  try {
    let response;
    if (USE_DUMMY_LLM) {
      console.log(`[DUMMY-LLM] Using stubbed ${fieldType} response for testing`);
      response = {
        choices: [{
          message: {
            content: DUMMY_FIELD_RESPONSES[fieldType]
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      };
    } else {
      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: fullPrompt }],
        max_tokens: fieldType === "description" ? 800 : 200,
        temperature: 0.7
      });
    }
    const raw = response.choices[0].message.content;
    // Ensure raw is a string for token counting and downstream handling
    const rawStr = typeof raw === 'string' ? raw : JSON.stringify(raw);
    // Token out (approximation)
    const tokensOut = Math.ceil(rawStr.split(/\s+/).length / 0.75);

    // Debug logging for description output
    if (fieldType === 'description') {
      console.log("[DEBUG] Raw Description Output:\n", rawStr);
    }

    // Handle different output formats per field type
    if (fieldType === "title" || fieldType === "description") {
      // Title and description return ASCII text directly
      return {
        output: rawStr.trim(),
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        retry_count: retryCount,
        model: "gpt-4o"
      };
    } else {
      // Tags and other fields return JSON
      try {
        const parsed = JSON.parse(rawStr);
        return {
          output: parsed,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          retry_count: retryCount,
          model: "gpt-4o"
        };
      } catch (e) {
        console.warn("Failed to parse AI response:", rawStr);
        throw new Error("AI response is not valid JSON.");
      }
    }
  } catch (e) {
    console.warn("Failed to generate field:", e.message);
    throw new Error(`Field generation failed: ${e.message}`);
  }
}

module.exports = { generateField };
