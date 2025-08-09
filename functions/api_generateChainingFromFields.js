const functions = require("firebase-functions");
const { OpenAI } = require("openai");
const openai = new OpenAI();
const fs = require("fs");

const MAX_TRIES = 2;

async function callOpenAI(messages) {
  return openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages,
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).send("POST only");
    const { fields } = req.body;
    if (!fields) return res.status(400).send("fields missing");
    console.log('INCOMING FIELDS', fields);

    const prompt = fs.readFileSync(__dirname + "/prompts/chaining_prompt_v3.3.3.txt", "utf8");

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
