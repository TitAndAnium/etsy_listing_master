const functions = require("firebase-functions");
// ---------------------------------------------------------------------------
// OpenAI client with CI-safe mock
// ---------------------------------------------------------------------------
const fs = require("fs");

const IS_CI = process.env.CI === "true" || process.env.MOCK_LLM === "1";
let openaiClient = null;

function getOpenAI() {
  if (IS_CI) return null; // skip in CI
  if (!openaiClient) {
    const { OpenAI } = require("openai");
    const key = process.env.OPENAI_API_KEY || "";
    if (!key) return null; // fallback to mock
    openaiClient = new OpenAI({ apiKey: key });
  }
  return openaiClient;
}

async function callOpenAI(messages) {
  const client = getOpenAI();
  if (!client) {
    // 🔹 CI/mock mode: return deterministic dummy with 13 tags
    const dummy = { tags: Array.from({ length: 13 }, (_, i) => `tag${i + 1}`) };
    return { choices: [{ message: { content: JSON.stringify(dummy) } }] };
  }
  return client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages,
  });
}

const MAX_TRIES = 2;

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).send("POST only");
    const { fields } = req.body;
    if (!fields) return res.status(400).send("fields missing");
    console.log('INCOMING FIELDS', fields);

    let prompt;
    try {
      prompt = fs.readFileSync(__dirname + "/prompts/chaining_prompt_v3.3.3.txt", "utf8");
    } catch {
      // fallback for CI where file lives in archive/
      prompt = fs.readFileSync(__dirname + "/prompts/archive/chaining_prompt_v3.3.3.txt", "utf8");
    }

    const sys = { role: "system", content: prompt };
    const usr = { role: "user", content: JSON.stringify({ fields }) };
    let messages = [sys, usr];

    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      const completion = await callOpenAI(messages);
      const raw = completion.choices[0].message.content.trim();
      let json; try { json = JSON.parse(raw); } catch {}

      if (json && Array.isArray(json.tags) && json.tags.length === 13) {
        return res.status(200).json(json); // ✅ klaar
      }

      if (attempt === 1) {
        messages.push({
          role: "user",
          content: "The tags field was not a valid JSON array of 13 items. Please FIX ONLY the tags and return the full JSON again."
        });
      } else {
        return res.status(422).json({
          retry_reason: "tags_format_error",
          error: "tags_format_error",
          ai_response: raw,
        });
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
