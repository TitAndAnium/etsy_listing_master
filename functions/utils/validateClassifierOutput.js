// functions/utils/validateClassifierOutput.js
// Validator for classifier prompt v3.3.2 output schema

function validateClassifierOutput(classifier) {
  const requiredFields = [
    "audience", "gift_mode", "fallback_profile", "retry_reason"
  ];

  const notes = [];
  let isValid = true;

  // Required fields check
  for (const field of requiredFields) {
    if (classifier[field] === undefined || classifier[field] === null) {
      notes.push(`Missing required field: ${field}`);
      isValid = false;
    }
  }

  // gift_mode must be boolean
  if (typeof classifier.gift_mode !== 'boolean') {
    notes.push(`gift_mode must be boolean, got: ${typeof classifier.gift_mode}`);
    isValid = false;
  }

  // audience must be array with max 4 elements
  if (!Array.isArray(classifier.audience)) {
    notes.push(`audience must be array, got: ${typeof classifier.audience}`);
    isValid = false;
  } else {
    if (classifier.audience.length > 4) {
      notes.push(`audience array too long: ${classifier.audience.length} (max 4)`);
      isValid = false;
    }
    
    // Each audience token must be lowercase ASCII string
    for (const token of classifier.audience) {
      if (typeof token !== 'string') {
        notes.push(`audience token must be string, got: ${typeof token}`);
        isValid = false;
      } else {
        // Check ASCII only (\x20-\x7E)
        if (!/^[\x20-\x7E]*$/.test(token)) {
          notes.push(`audience token has non-ASCII characters: "${token}"`);
          isValid = false;
        }
        // Check lowercase
        if (token !== token.toLowerCase()) {
          notes.push(`audience token must be lowercase: "${token}"`);
          isValid = false;
        }
      }
    }
  }

  // fallback_profile must be string ≤ 60 chars
  if (typeof classifier.fallback_profile !== 'string') {
    notes.push(`fallback_profile must be string, got: ${typeof classifier.fallback_profile}`);
    isValid = false;
  } else if (classifier.fallback_profile.length > 60) {
    notes.push(`fallback_profile too long: ${classifier.fallback_profile.length} chars (max 60)`);
    isValid = false;
  }

  // retry_reason must be string
  if (typeof classifier.retry_reason !== 'string') {
    notes.push(`retry_reason must be string, got: ${typeof classifier.retry_reason}`);
    isValid = false;
  }

  // Check for forbidden fields (title, tags, description)
  const forbiddenFields = ['title', 'tags', 'description'];
  for (const field of forbiddenFields) {
    if (classifier[field] !== undefined) {
      notes.push(`Forbidden field present: ${field}`);
      isValid = false;
    }
  }

  // Logical validation: audience.length ≥ 1 OR fallback_profile non-empty
  if (Array.isArray(classifier.audience) && 
      classifier.audience.length === 0 && 
      (!classifier.fallback_profile || classifier.fallback_profile.trim() === '')) {
    notes.push('Either audience must have ≥1 element OR fallback_profile must be non-empty');
    isValid = false;
  }

  return { isValid, notes };
}

module.exports = { validateClassifierOutput };
