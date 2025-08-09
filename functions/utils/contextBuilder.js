// functions/utils/contextBuilder.js

const fs = require("fs");
const path = require("path");

/**
 * Bouwt contextstrings voor prompts op basis van classifier-output
 * @param {Object} classifierOutput
 * @returns {Object} - contextBlocks per veldtype
 */
function buildPromptContexts(classifierOutput = {}) {
  const {
    focus_keyword = "",
    audience = "",
    tone_style = "",
    seasonal_context = "",
    gift_emotion = "",
    buyer_vs_receiver = "",
    product_type = "",
    personalization = false,
  } = classifierOutput;

  // Haal regels binnen
  const giftRules = fs.readFileSync(path.join(__dirname, "../prompts/gift_rules_v2.txt"), "utf-8");
  const toneRules = fs.readFileSync(path.join(__dirname, "../prompts/tone_style_v2.5.txt"), "utf-8");
  const titleRules = fs.readFileSync(path.join(__dirname, "../prompts/title_rules.txt"), "utf-8");
  const tagRules = fs.readFileSync(path.join(__dirname, "../prompts/tag_rules.txt"), "utf-8");
  const descRules = fs.readFileSync(path.join(__dirname, "../prompts/description_rules.txt"), "utf-8");
  const audRules = fs.readFileSync(path.join(__dirname, "../prompts/audience_profile_rules.txt"), "utf-8");
  const etsyRules = fs.readFileSync(path.join(__dirname, "../prompts/etsy_rules.txt"), "utf-8");

  const shared = `${etsyRules}\n\n${giftRules}\n\n${toneRules}\n\n${audRules}`;

  return {
    title: `${shared}\n\n${titleRules}\n\nFOCUS_KEYWORD: ${focus_keyword}\nAUDIENCE: ${audience}\nTONE: ${tone_style}`,
    tags: `${shared}\n\n${tagRules}\n\nPRODUCT_TYPE: ${product_type}`,
    description: `${shared}\n\n${descRules}\n\nTONE: ${tone_style}\nGIFT_EMOTION: ${gift_emotion}\nSEASONALITY: ${seasonal_context}`,
  };
}

module.exports = { buildPromptContexts };
