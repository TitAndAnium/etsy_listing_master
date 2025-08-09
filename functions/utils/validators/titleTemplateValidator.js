// functions/utils/validators/titleTemplateValidator.js
// Validates title follows expected pattern (brand/style + gift-hook)

/**
 * Title template patterns for Etsy listings
 * Based on high-converting title structures
 */
const TITLE_PATTERNS = {
  // Standard product title: [Product] [Style/Material] [Occasion/Benefit]
  standard: /^[A-Z][a-zA-Z\s,'-]+\s+(for|gift|present|perfect|handmade|custom|personalized|unique)/i,
  
  // Gift-focused title: [Product] [Gift Hook] [Recipient]
  gift: /^[A-Z][a-zA-Z\s,'-]+\s+(gift|present)\s+(for|to)\s+[a-zA-Z\s]+/i,
  
  // Brand/Style title: [Brand/Style] [Product] [Benefit]
  branded: /^[A-Z][a-zA-Z\s,'-]+\s+[a-zA-Z\s,'-]+\s+(jewelry|ring|necklace|bracelet|earrings)/i,
  
  // Descriptive title: [Adjective] [Product] [Context]
  descriptive: /^(Handmade|Custom|Personalized|Unique|Vintage|Modern|Elegant|Beautiful)\s+[a-zA-Z\s,'-]+/i
};

/**
 * Required elements that should appear in titles
 */
const REQUIRED_ELEMENTS = {
  // Product type indicators
  productType: [
    'ring', 'necklace', 'bracelet', 'earrings', 'pendant', 'charm', 'jewelry', 'jewellery'
  ],
  
  // Gift/benefit hooks
  giftHooks: [
    'gift', 'present', 'perfect', 'for', 'surprise', 'special'
  ],
  
  // Quality/style indicators
  qualityWords: [
    'handmade', 'custom', 'personalized', 'unique', 'artisan', 'crafted', 'designed'
  ],
  
  // Audience indicators
  audienceWords: [
    'mom', 'dad', 'mother', 'father', 'wife', 'husband', 'her', 'him', 'women', 'men'
  ]
};

/**
 * Common title issues to detect
 */
const TITLE_ISSUES = {
  // Too short or too long
  length: {
    min: 15, // Relaxed from 20 to catch shorter valid titles
    max: 160, // Increased from 140 for more flexibility
    optimal: { min: 35, max: 85 } // Adjusted optimal range
  },
  
  // Forbidden patterns (base patterns - handmade handled dynamically)
  forbidden: [
    /\b(cheap|discount|sale|buy now|click here|free shipping)\b/i,
    /[!]{2,}|[?]{2,}|[.]{3,}/,  // Multiple punctuation
    /\b(SEO|keywords|tags|etsy)\b/i,  // Meta words (handmade removed - handled conditionally)
    /^\s*[a-z]/,  // Should start with capital
    /\s{2,}/  // Multiple spaces
  ],
  
  // Missing elements
  required: ['productType']  // At least product type should be present
};

/**
 * Validate title against template patterns and requirements
 * @param {string} title - Title to validate
 * @param {object} context - Additional context (gift_mode, audience, etc.)
 * @returns {object} - Validation result with warnings
 */
function validateTitleTemplate(title, context = {}) {
  if (!title || typeof title !== 'string') {
    return {
      isValid: false,
      warnings: [{
        type: 'title_template',
        severity: 'high',
        message: 'Title is required and must be a string',
        suggestion: 'Provide a valid title string'
      }]
    };
  }
  
  const warnings = [];
  const cleanTitle = title.trim();
  
  // 1. Length validation
  const length = cleanTitle.length;
  if (length < TITLE_ISSUES.length.min) {
    warnings.push({
      type: 'title_template',
      severity: 'high',
      issue: 'too_short',
      message: `Title too short: ${length} characters (minimum ${TITLE_ISSUES.length.min})`,
      actual: length,
      expected: `${TITLE_ISSUES.length.min}-${TITLE_ISSUES.length.max}`,
      suggestion: 'Add more descriptive words or benefits'
    });
  } else if (length > TITLE_ISSUES.length.max) {
    warnings.push({
      type: 'title_template',
      severity: 'medium',
      issue: 'too_long',
      message: `Title too long: ${length} characters (maximum ${TITLE_ISSUES.length.max})`,
      actual: length,
      expected: `${TITLE_ISSUES.length.min}-${TITLE_ISSUES.length.max}`,
      suggestion: 'Shorten title while keeping key benefits'
    });
  } else if (length < TITLE_ISSUES.length.optimal.min || length > TITLE_ISSUES.length.optimal.max) {
    warnings.push({
      type: 'title_template',
      severity: 'low',
      issue: 'suboptimal_length',
      message: `Title length could be optimized: ${length} characters (optimal ${TITLE_ISSUES.length.optimal.min}-${TITLE_ISSUES.length.optimal.max})`,
      actual: length,
      expected: `${TITLE_ISSUES.length.optimal.min}-${TITLE_ISSUES.length.optimal.max}`,
      suggestion: 'Consider adjusting length for better SEO'
    });
  }
  
  // 2. Forbidden patterns
  TITLE_ISSUES.forbidden.forEach((pattern, index) => {
    if (pattern.test(cleanTitle)) {
      warnings.push({
        type: 'title_template',
        severity: 'high',
        issue: 'forbidden_pattern',
        message: `Title contains forbidden pattern: ${pattern.source}`,
        pattern: pattern.source,
        suggestion: 'Remove or rephrase the flagged content'
      });
    }
  });
  
  // 2b. Conditional handmade validation
  const allowHandmade = context.allow_handmade === true;
  if (!allowHandmade && /\bhandmade\b/i.test(cleanTitle)) {
    warnings.push({
      type: 'title_template',
      severity: 'high',
      issue: 'forbidden_handmade',
      message: 'Title contains "handmade" but allow_handmade flag is false',
      suggestion: 'Use alternatives like "artisan", "hand-crafted", "crafted", or enable allow_handmade flag'
    });
  }
  
  // 3. Required elements check
  const missingElements = [];
  TITLE_ISSUES.required.forEach(elementType => {
    const elements = REQUIRED_ELEMENTS[elementType];
    const hasElement = elements.some(element => 
      cleanTitle.toLowerCase().includes(element.toLowerCase())
    );
    
    if (!hasElement) {
      missingElements.push(elementType);
    }
  });
  
  if (missingElements.length > 0) {
    warnings.push({
      type: 'title_template',
      severity: 'medium',
      issue: 'missing_elements',
      message: `Title missing required elements: ${missingElements.join(', ')}`,
      missing: missingElements,
      suggestion: 'Include product type (ring, necklace, etc.) in title'
    });
  }
  
  // 4. Template pattern matching
  const matchesPattern = Object.entries(TITLE_PATTERNS).some(([patternName, pattern]) => {
    return pattern.test(cleanTitle);
  });
  
  if (!matchesPattern) {
    warnings.push({
      type: 'title_template',
      severity: 'medium',
      issue: 'pattern_mismatch',
      message: 'Title does not follow recommended template patterns',
      suggestion: 'Consider using format: [Product] [Style/Material] [Gift Hook/Benefit]'
    });
  }
  
  // 5. Context-specific validation
  if (context.gift_mode === true) {
    const hasGiftHook = REQUIRED_ELEMENTS.giftHooks.some(hook => 
      cleanTitle.toLowerCase().includes(hook.toLowerCase())
    );
    
    if (!hasGiftHook) {
      warnings.push({
        type: 'title_template',
        severity: 'medium',
        issue: 'missing_gift_hook',
        message: 'Gift mode enabled but title lacks gift-focused language',
        suggestion: 'Add words like "gift", "present", "perfect for", etc.'
      });
    }
  }
  
  if (context.audience && Array.isArray(context.audience) && context.audience.length > 0) {
    const hasAudienceReference = context.audience.some(audienceToken => 
      cleanTitle.toLowerCase().includes(audienceToken.toLowerCase())
    ) || REQUIRED_ELEMENTS.audienceWords.some(word => 
      cleanTitle.toLowerCase().includes(word.toLowerCase())
    );
    
    if (!hasAudienceReference) {
      warnings.push({
        type: 'title_template',
        severity: 'low',
        issue: 'missing_audience',
        message: `Title could reference target audience: ${context.audience.join(', ')}`,
        audience: context.audience,
        suggestion: 'Consider adding audience reference for better targeting'
      });
    }
  }
  
  return {
    isValid: warnings.filter(w => w.severity === 'high').length === 0,
    warnings,
    length,
    matchesPattern,
    context
  };
}

/**
 * Get title analysis summary
 * @param {string} title - Title to analyze
 * @param {object} context - Additional context
 * @returns {object} - Analysis summary
 */
function analyzeTitleStructure(title, context = {}) {
  const validation = validateTitleTemplate(title, context);
  
  // Extract elements found in title
  const foundElements = {};
  Object.entries(REQUIRED_ELEMENTS).forEach(([category, elements]) => {
    foundElements[category] = elements.filter(element => 
      title.toLowerCase().includes(element.toLowerCase())
    );
  });
  
  // Determine which pattern matches
  const matchingPatterns = Object.entries(TITLE_PATTERNS)
    .filter(([name, pattern]) => pattern.test(title))
    .map(([name]) => name);
  
  return {
    isValid: validation.isValid,
    length: validation.length,
    foundElements,
    matchingPatterns,
    warningCount: validation.warnings.length,
    highSeverityIssues: validation.warnings.filter(w => w.severity === 'high').length
  };
}

module.exports = {
  validateTitleTemplate,
  analyzeTitleStructure,
  TITLE_PATTERNS,
  REQUIRED_ELEMENTS,
  TITLE_ISSUES
};
