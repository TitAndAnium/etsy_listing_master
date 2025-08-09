// functions/utils/validators/layerCountValidator.js
// Validates tri-layer tag structure: 5 SEO / 4 occasion / 2 audience / 2 attribute

/**
 * Priority audience tags that should be classified as audience first
 * These are high-priority audience terms that might match other patterns
 */
const AUDIENCE_PRIORITY = [
  'women', 'men', 'girls', 'boys', 'kids', 'children', 'teens', 'adults',
  'mom', 'dad', 'mother', 'father', 'sister', 'brother', 'friend', 'couple',
  'wife', 'husband', 'girlfriend', 'boyfriend', 'family', 'parent'
];

/**
 * Tag classification rules based on Etsy SEO strategy
 * These patterns help identify which layer a tag belongs to
 */
const TAG_PATTERNS = {
  // SEO tags - product-focused, searchable terms
  seo: [
    // Jewelry types
    /^(ring|necklace|bracelet|earrings|pendant|charm|jewelry|jewellery)$/i,
    /^(anklet|brooch|cufflinks|tiara|crown|hairpin|clip)$/i,
    
    // Materials & finishes
    /^(silver|gold|bronze|copper|stainless|sterling|plated)$/i,
    /^(rose gold|white gold|gold filled|gold plated|silver plated)$/i,
    /^(titanium|platinum|brass|pewter|alloy|metal)$/i,
    
    // Crafting & quality terms - now with partial matches for compound tags
    /hand(made|crafted)?/i,
    /custom/i,
    /personal(ised|ized)?/i,
    /unique/i,
    /artisan/i,
    /craft/i,
    /bespoke/i,
    /(made to order|one of a kind|exclusive)/i,
    /(quality|premium|luxury|fine|elegant|sophisticated)/i,
    
    // Style descriptors - flexible matching
    /(vintage|antique|retro|classic|modern|contemporary)/i,
    /(bohemian|boho|minimalist|geometric|organic|abstract)/i,
    /(rustic|industrial|art deco|victorian|gothic|celtic)/i,
    /(elegant|sophisticated|stylish|fashionable|chic)/i,
    
    // Size & scale
    /^(small|large|mini|oversized|delicate|bold|statement)$/i,
    /^(tiny|huge|petite|chunky|thick|thin|wide|narrow)$/i,
    
    // Common Etsy search terms
    /^(gift|present|surprise|special|perfect|beautiful)$/i,
    /^(trendy|stylish|fashionable|chic|cute|pretty|gorgeous)$/i,
    /^(affordable|budget|cheap|expensive|luxury|premium)$/i,
    
    // Gemstones & stones
    /^(diamond|ruby|sapphire|emerald|pearl|opal|turquoise)$/i,
    /^(amethyst|garnet|topaz|citrine|peridot|aquamarine)$/i,
    /^(birthstone|crystal|stone|gem|gemstone|precious)$/i,
    
    // Techniques & features
    /^(engraved|stamped|embossed|textured|polished|matte)$/i,
    /^(adjustable|stackable|layered|chain|cord|wire)$/i
  ],
  
  // Occasion tags - when/why to buy
  occasion: [
    /^(birthday|anniversary|wedding|graduation|christmas|valentine)$/i,
    /^(gift|present|surprise|celebration|party|holiday)$/i,
    /^(day|week|season|event|ceremony|festival)$/i,
    /(gift|present)/i, // Catch any compound gift words
    /^(special|perfect|ideal|wonderful|amazing)$/i // Gift descriptors
  ],
  
  // Audience tags - who is this for
  audience: [
    /^(women|men|girls|boys|kids|children|teens|adults)$/i,
    /^(mom|dad|mother|father|sister|brother|friend|couple)$/i,
    /^(her|him|them|unisex|family|parents)$/i,
    /^(professional|student|teacher|nurse|artist|musician)$/i,
    /^(wife|husband|girlfriend|boyfriend|partner)$/i, // Moved from occasion
    /^(baby|infant|toddler|child|teen|adult|senior)$/i, // Age groups
    /^(homeowners|gardeners|plant lovers|office workers|remote employees)$/i // Specific groups
  ],
  
  // Attribute tags - style/material/color descriptors
  attribute: [
    /^(blue|red|green|yellow|black|white|pink|purple|orange)$/i,
    /^(round|square|oval|heart|star|flower|geometric|abstract)$/i,
    /^(matte|shiny|glossy|textured|smooth|rough|polished)$/i,
    /^(casual|formal|elegant|bohemian|minimalist|rustic)$/i
  ]
};

/**
 * Classify a tag into one of the four layers
 * @param {string} tag - Tag to classify
 * @returns {string} - Layer name: 'seo', 'occasion', 'audience', 'attribute', or 'unknown'
 */
function classifyTag(tag) {
  if (!tag || typeof tag !== 'string') return 'unknown';
  
  const cleanTag = tag.toLowerCase().trim();
  
  // Priority check: audience tags first (ChatGPT fix #4)
  if (AUDIENCE_PRIORITY.includes(cleanTag)) {
    return 'audience';
  }
  
  // Check each layer's patterns
  for (const [layer, patterns] of Object.entries(TAG_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(cleanTag)) {
        return layer;
      }
    }
  }
  
  // Fallback classification based on common patterns
  if (cleanTag.includes('gift') || cleanTag.includes('present')) return 'occasion';
  if (cleanTag.includes('for') || cleanTag.includes('her') || cleanTag.includes('him')) return 'audience';
  if (cleanTag.length <= 4 && /^[a-z]+$/.test(cleanTag)) return 'attribute'; // Short descriptive words
  
  return 'unknown';
}

/**
 * Count tags per layer and validate tri-layer distribution
 * Expected: 5 SEO / 4 occasion / 2 audience / 2 attribute (total 13 tags)
 * @param {string[]} tags - Array of tags to validate
 * @returns {object} - Validation result with counts and warnings
 */
function validateLayerCount(tags) {
  if (!Array.isArray(tags)) {
    return {
      isValid: false,
      warnings: [{
        type: 'layer_count',
        severity: 'high',
        message: 'Tags must be provided as an array',
        counts: {},
        expected: { seo: 5, occasion: 4, audience: 2, attribute: 2 }
      }]
    };
  }
  
  // Count tags per layer
  const counts = { seo: 0, occasion: 0, audience: 0, attribute: 0, unknown: 0 };
  const expected = { seo: 5, occasion: 4, audience: 2, attribute: 2 };
  const tagsByLayer = { seo: [], occasion: [], audience: [], attribute: [], unknown: [] };
  
  tags.forEach(tag => {
    const layer = classifyTag(tag);
    counts[layer]++;
    tagsByLayer[layer].push(tag);
  });
  
  // Expected layer distribution (tri-layer structure) - increased to ±3 (ChatGPT fix #2)
  const EXPECTED_COUNTS = {
    seo: { min: 2, max: 8 },      // 5 ± 3
    occasion: { min: 1, max: 7 }, // 4 ± 3  
    audience: { min: 1, max: 5 }, // 2 ± 3 (but min 1)
    attribute: { min: 1, max: 5 } // 2 ± 3 (but min 1)
  };
  
  // Check each layer
  const warnings = [];
  Object.entries(EXPECTED_COUNTS).forEach(([layer, expectedRange]) => {
    const actualCount = counts[layer];
    const expectedAvg = (expectedRange.min + expectedRange.max) / 2;
    const difference = Math.abs(actualCount - expectedAvg);
    
    if (difference > 3) { // Allow 3 tag tolerance (ChatGPT fix #2)
      const severity = difference > 4 ? 'high' : 'medium';
      const direction = actualCount > expectedAvg ? 'too many' : 'too few';
      
      warnings.push({
        type: 'layer_count',
        severity,
        layer,
        message: `${layer.toUpperCase()} layer has ${direction} tags: ${actualCount} (expected ~${Math.round(expectedAvg)})`,
        actual: actualCount,
        expected: Math.round(expectedAvg),
        tags: tagsByLayer[layer],
        suggestion: actualCount > expectedAvg 
          ? `Consider removing ${Math.ceil(actualCount - expectedAvg)} ${layer} tags`
          : `Consider adding ${Math.ceil(expectedAvg - actualCount)} more ${layer} tags`
      });
    }
  });
  
  // Check for too many unknown tags
  if (counts.unknown > 2) {
    warnings.push({
      type: 'layer_count',
      severity: 'medium',
      layer: 'unknown',
      message: `Too many unclassified tags: ${counts.unknown}`,
      actual: counts.unknown,
      expected: 0,
      tags: tagsByLayer.unknown,
      suggestion: 'Review unclassified tags and assign to appropriate layers'
    });
  }
  
  // Check total tag count (ChatGPT fix - remove undefined expected reference)
  const totalTags = tags.length;
  const expectedTotal = 13; // 5 SEO + 4 occasion + 2 audience + 2 attribute
  
  if (Math.abs(totalTags - expectedTotal) > 3) { // Allow 3 tag tolerance
    warnings.push({
      type: 'layer_count',
      severity: totalTags < expectedTotal - 3 ? 'high' : 'medium',
      message: `Total tag count is off: ${totalTags} (expected ~${expectedTotal})`,
      actual: totalTags,
      expected: expectedTotal,
      suggestion: totalTags < expectedTotal 
        ? `Add ${expectedTotal - totalTags} more tags to reach optimal count`
        : `Consider removing ${totalTags - expectedTotal} tags to avoid dilution`
    });
  }
  
  return {
    isValid: warnings.length === 0,
    counts,
    tagsByLayer,
    expected,
    totalTags,
    warnings
  };
}

/**
 * Get layer distribution summary for debugging
 * @param {string[]} tags - Array of tags
 * @returns {object} - Summary with counts and examples
 */
function getLayerSummary(tags) {
  const result = validateLayerCount(tags);
  
  return {
    distribution: result.counts,
    examples: Object.entries(result.tagsByLayer).reduce((acc, [layer, layerTags]) => {
      acc[layer] = layerTags.slice(0, 3); // Show first 3 examples
      return acc;
    }, {}),
    isBalanced: result.isValid,
    totalTags: result.totalTags
  };
}

module.exports = {
  validateLayerCount,
  classifyTag,
  getLayerSummary,
  TAG_PATTERNS
};
