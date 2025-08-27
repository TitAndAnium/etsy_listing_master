// functions/utils/validateFinalOutput.js

const asciiRegex = /^[\x00-\x7F]+$/;
const tagRegex = /^[a-z0-9\- ']{1,20}$/;

// Helper: match '::: Label :::' lines case-insensitief en tolerant voor extra spaties
function hasSection(desc, label) {
  const name = String(label || '').replace(/\s+/g, "\\s+");
  // Tolerant voor CRLF/nieuweregelvarianten en geen strikte lijn-ankers nodig
  const rx = new RegExp(`(^|\\r?\\n)\\s*:::\\s*${name}\\s*:::\\s*(\\r?\\n|$)`, 'i');
  return rx.test(String(desc || ''));
}

function validateOutput({ title = "", tags = [], description = "" }) {
  const notes = [];
  let isValid = true;

  // Type safety: ensure title is a string
  if (typeof title !== 'string') {
    console.warn(`[VALIDATOR] Title is not a string, got:`, typeof title, title);
    title = String(title || ''); // Convert to string or empty string
  }

  // Titelcheck
  if (title.length > 140) {
    notes.push("Title exceeds 140 characters. retry_reason:title_too_long");
    isValid = false;
  }

  if (!/^[\x00-\x7F]*$/.test(title)) {
    notes.push("Title contains non-ASCII characters. retry_reason:title_non_ascii");
    isValid = false;
  }

  // Forbidden words in title
  const forbiddenWords = ["best ever", "cheap", "free", "guaranteed"];
  forbiddenWords.forEach(word => {
    if (title.toLowerCase().includes(word)) {
      notes.push(`Title contains forbidden word: '${word}'. retry_reason:title_forbidden_word`);
      isValid = false;
    }
  });

  // Excessive caps in title
  if ((title.match(/[A-Z]{2,}/g) || []).length > 1) {
    notes.push("Title contains excessive ALL CAPS. retry_reason:title_excessive_caps");
    isValid = false;
  }

  // Tags check - alleen als tags array bestaat en niet leeg is
  if (Array.isArray(tags) && tags.length === 13) {
    const seen = new Set();
    tags.forEach(t => {
      if (!/^[a-z0-9\- ']{1,20}$/.test(t)) notes.push("tag_invalid_chars_or_len");
      if (seen.has(t)) notes.push("tag_duplicate");
      seen.add(t);
      if (/[A-Z]/.test(t)) notes.push("tag_not_lowercase");
    });
  }

  // Type safety: ensure description is a string
  if (typeof description !== 'string') {
    console.warn(`[VALIDATOR] Description is not a string, got:`, typeof description, description);
    description = String(description || ''); // Convert to string or empty string
  }

  // Beschrijving check - block emojis and problematic symbols, allow normal Unicode punctuation
  const emojiAndSymbolRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{200D}\u{23CF}\u{23E9}-\u{23F3}\u{25FD}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26FA}\u{26FD}\u{2702}-\u{27B0}\u{27BF}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B06}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B05}-\u{2B07}\u{3030}\u{303D}\u{3297}\u{3299}]/gu;
  if (emojiAndSymbolRegex.test(description)) {
    notes.push("Description contains emojis or problematic symbols. retry_reason:desc_emoji_symbols");
    isValid = false;
  }

  // V3.0.1 Blokvalidatie - alleen als description bestaat en niet leeg is
  if (description && description.trim().length > 0) {
    const requiredLabels = [
      "Overview",
      "Features",
      "Shipping and Processing",
      "Call To Action"
    ];
    
    // Optionele blokken (alleen controleren als relevant)
    const optionalLabels = [
      "Personalization Guide",
      "Care Instructions",
      "Available Sizes"
    ];
    
    // Controleer alleen verplichte blokken als description bestaat
    requiredLabels.forEach(label => {
      if (!hasSection(description, label)) {
        notes.push(`Description missing required block: ::: ${label} ::: retry_reason:desc_missing_block`);
        isValid = false;
      }
    });
  }
  
  // Als description minder dan 50 karakters heeft, accepteer het als minimal mode
  if (description.length < 50) {
    // Minimal mode: alleen Overview en Call To Action vereist
    const minimalRequired = ["Overview", "Call To Action"];
    const missingMinimal = minimalRequired.filter(label => !hasSection(description, label));
    if (missingMinimal.length === 0) {
      // Clear alle block-gerelateerde errors voor minimal mode
      const blockErrors = notes.filter(note => note.includes('desc_missing_block'));
      blockErrors.forEach(error => {
        const index = notes.indexOf(error);
        if (index > -1) notes.splice(index, 1);
      });
      isValid = true; // Override voor minimal mode
    }
  }

  // Stricte ASCII/no-emoji check op titel & description
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{200D}\u{23CF}\u{23E9}-\u{23F3}\u{25FD}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26FA}\u{26FD}\u{2702}-\u{27B0}\u{27BF}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B06}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B05}-\u{2B07}\u{3030}\u{303D}\u{3297}\u{3299}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F1E6}-\u{1F1FF}\u{1F201}-\u{1F202}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F23A}\u{1F250}-\u{1F251}\u{1F300}-\u{1F320}\u{1F32D}-\u{1F335}\u{1F337}-\u{1F37C}\u{1F37E}-\u{1F393}\u{1F3A0}-\u{1F3CA}\u{1F3CF}-\u{1F3D3}\u{1F3E0}-\u{1F3F0}\u{1F3F4}\u{1F3F8}-\u{1F43E}\u{1F440}\u{1F442}-\u{1F4FC}\u{1F4FF}-\u{1F53D}\u{1F54B}-\u{1F54E}\u{1F550}-\u{1F567}\u{1F56F}-\u{1F570}\u{1F573}-\u{1F579}\u{1F587}\u{1F58A}-\u{1F58D}\u{1F590}\u{1F595}-\u{1F596}\u{1F5A4}\u{1F5FB}-\u{1F64F}\u{1F680}-\u{1F6C5}\u{1F6CB}-\u{1F6D2}\u{1F6E0}-\u{1F6EC}\u{1F6F0}-\u{1F6F3}\u{1F7E0}-\u{1F7EB}\u{1F90D}-\u{1F93A}\u{1F93C}-\u{1F945}\u{1F947}-\u{1F9FF}\u{1FA70}-\u{1FA73}\u{1FA78}-\u{1FA7A}\u{1FA80}-\u{1FA82}\u{1FA90}-\u{1FA95}]/gu;
  if (emojiRegex.test(title)) {
    notes.push("Title contains emoji or forbidden symbol. retry_reason:title_emoji");
    isValid = false;
  }
  if (emojiRegex.test(description)) {
    notes.push("Description contains emoji or forbidden symbol. retry_reason:desc_emoji");
    isValid = false;
  }

  return { isValid, notes };
}

// Wrapper functie die de interface biedt die generateFromDumpCore.js verwacht
function validateFinalOutput(fieldType, output) {
  let validationInput = {};
  
  // Extract field value from AI object structure if needed
  let fieldValue = output;
  if (typeof output === 'object' && output !== null && output[fieldType]) {
    fieldValue = output[fieldType];

  }
  
  if (fieldType === 'title') {
    validationInput = { title: fieldValue, tags: [], description: '' };
  } else if (fieldType === 'tags') {
    validationInput = { title: '', tags: fieldValue, description: '' };
  } else if (fieldType === 'description') {
    validationInput = { title: '', tags: [], description: fieldValue };
  }
  
  const result = validateOutput(validationInput);
  

  
  return {
    success: result.isValid,
    notes: result.notes,
    reason: result.isValid ? '' : (result.notes[0] || 'Unknown validation error')
  };
}

// Export beide functies
module.exports = validateFinalOutput;
module.exports.validateOutput = validateOutput;
module.exports.validateFinalOutput = validateFinalOutput;
