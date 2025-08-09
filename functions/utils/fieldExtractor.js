// utils/fieldExtractor.js

function toAscii(str) {
  return String(str || "").replace(/[^\x00-\x7F]/g, "");
}

function sanitizeTag(tag, validationLog) {
  let clean = tag;
  if (typeof tag !== 'string') {
    validationLog.tags.push(`invalid type: ${JSON.stringify(tag)}`);
    clean = String(tag || "");
  }
  if (/[^\x00-\x7F]/.test(clean)) {
    validationLog.tags.push(`non-ascii: '${clean}'`);
    clean = toAscii(clean);
  }
  if (clean.length > 20) {
    validationLog.tags.push(`too long: '${clean}'`);
    clean = clean.slice(0, 20);
  }
  if (/[^a-z0-9\- _]/i.test(clean)) {
    validationLog.tags.push(`strange chars: '${clean}'`);
  }
  return clean.toLowerCase().trim();
}

function validateTags(rawTags = [], validationLog) {
  const seen = new Set();
  const tags = [];
  if (!Array.isArray(rawTags)) {
    validationLog.tags.push('tags not an array');
    rawTags = [];
  }
  for (let tag of rawTags) {
    const clean = sanitizeTag(tag, validationLog);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      tags.push(clean);
    }
    if (tags.length >= 13) break;
  }
  while (tags.length < 13) {
    validationLog.tags.push(`fallback tag added: extra-tag-${tags.length + 1}`);
    tags.push(`extra-tag-${tags.length + 1}`);
  }
  return tags;
}

function blockifyDescription(raw = "", validationLog) {
  let text = String(raw || "");
  if (/[^\x00-\x7F]/.test(text)) {
    validationLog.description = validationLog.description || [];
    validationLog.description.push('non-ascii chars removed');
    text = toAscii(text);
  }
  text = text.trim();
  if (!text) {
    validationLog.description = validationLog.description || [];
    validationLog.description.push('empty or missing, fallback used');
    text = 'No description provided.';
  }
  const blocks = text.split(/\.(?!\d)/).map(s => s.trim()).filter(Boolean);
  return blocks.length > 1 ? blocks.map(b => `• ${b}.`).join("\n") : text;
}

function validatePersonalization(p, validationLog) {
  const out = {};
  const fields = ['name', 'date', 'color', 'size'];
  for (let key of fields) {
    if (typeof p[key] === 'boolean') {
      out[key] = p[key];
    } else if (typeof p[key] === 'string') {
      if (p[key].toLowerCase() === 'true' || p[key] === '1') {
        out[key] = true;
        validationLog.personalization = validationLog.personalization || [];
        validationLog.personalization.push(`coerced string to boolean: ${key}`);
      } else if (p[key].toLowerCase() === 'false' || p[key] === '0') {
        out[key] = false;
        validationLog.personalization = validationLog.personalization || [];
        validationLog.personalization.push(`coerced string to boolean: ${key}`);
      } else {
        out[key] = false;
        validationLog.personalization = validationLog.personalization || [];
        validationLog.personalization.push(`invalid type (expected boolean): ${key}`);
      }
    } else if (typeof p[key] === 'undefined') {
      out[key] = false;
      validationLog.personalization = validationLog.personalization || [];
      validationLog.personalization.push(`missing field: ${key}`);
    } else {
      out[key] = false;
      validationLog.personalization = validationLog.personalization || [];
      validationLog.personalization.push(`invalid type (expected boolean): ${key}`);
    }
  }
  return out;
}

function isValidStructure(obj) {
  // Minimal check for required fields
  return obj && typeof obj === 'object' && Array.isArray(obj.tags) && typeof obj.description === 'string';
}

function extractFields(classifierOutput) {
  const validationLog = { tags: [] };
  const {
    focus_keyword = "",
    product_type = "",
    audience = "",
    buyer_vs_receiver = "",
    personalization = {},
    style_trend = "",
    seasonal_context = "",
    tags = [],
    description = "",
    targeting_options = []
  } = classifierOutput || {};

  const fields = {
    focus_keyword: toAscii(focus_keyword),
    product_type: toAscii(product_type),
    audience: toAscii(audience),
    buyer_vs_receiver: toAscii(buyer_vs_receiver),
    personalization: validatePersonalization(personalization, validationLog),
    style_trend: toAscii(style_trend),
    seasonal_context: toAscii(seasonal_context),
    tags: validateTags(tags, validationLog),
    description: blockifyDescription(description, validationLog),
    targeting_options: Array.isArray(targeting_options) ? targeting_options : [],
  };

  return { fields, validationLog };
}

module.exports = { extractFields, isValidStructure };

