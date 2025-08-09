// functions/aiCallProfiles.js

/**
 * AI-call configuratieprofielen voor elk type prompt.
 * Enkel GPT-4o is toegestaan. Nooit fallback naar andere modellen.
 */

const defaultModel = "gpt-4o";

const aiCallProfiles = {
  classifier: {
    model: defaultModel,
    temperature: 0.3,
    max_tokens: 750,
    presence_penalty: 0,
    frequency_penalty: 0
  },
  title: {
    model: defaultModel,
    temperature: 0.7,
    max_tokens: 150,
    presence_penalty: 0.3,
    frequency_penalty: 0.2
  },
  tags: {
    model: defaultModel,
    temperature: 0.5,
    max_tokens: 100,
    presence_penalty: 0.5,
    frequency_penalty: 0.4
  },
  description: {
    model: defaultModel,
    temperature: 0.85,
    max_tokens: 950,
    presence_penalty: 0.6,
    frequency_penalty: 0.3
  }
};

module.exports = aiCallProfiles;
