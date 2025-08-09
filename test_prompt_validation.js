// test_prompt_validation.js - Validatie voor Deliverable 2: Prompt-upgrade v2.7
// Test of de v2.7 prompts daadwerkelijk de KPI's halen:
// - Beschrijving: ≥ 90 woorden, 7 secties in ≥ 80% testcases
// - Tags: Tri-layer (5 SEO / 4 occasion / 2 audience / 2 attribute)

const testCases = [
  {
    id: "test1_simple",
    input: "handmade wooden jewelry box for women",
    expected: {
      description_min_words: 90,
      description_sections: ["Highlights", "Why You'll Love It", "About This", "Sizing Guide", "Care Instructions", "Production & Shipping", "Call to Action"],
      tags_count: 13,
      tags_tri_layer: {
        seo_tags: 5,        // long-tail SEO (≥2 words via hyphen)
        occasion_tags: 4,   // gift/occasion (incl. "gift", "present")
        audience_tags: 2,   // audience/lifestyle
        attribute_tags: 2   // product attribute
      }
    }
  },
  {
    id: "test2_gift_mode",
    input: "personalized coffee mug for dad birthday gift",
    expected: {
      description_min_words: 90,
      description_sections: ["Highlights", "Why You'll Love It", "About This", "Sizing Guide", "Care Instructions", "Production & Shipping", "Call to Action"],
      tags_count: 13,
      tags_tri_layer: {
        seo_tags: 5,
        occasion_tags: 4,
        audience_tags: 2,
        attribute_tags: 2
      },
      gift_mode_requirements: {
        at_least_one_gift_tag: true,
        at_least_one_personalized_tag: true
      }
    }
  },
  {
    id: "test3_minimal_input",
    input: "scarf",
    expected: {
      description_min_words: 90,
      description_sections: ["Highlights", "Why You'll Love It", "About This", "Sizing Guide", "Care Instructions", "Production & Shipping", "Call to Action"],
      tags_count: 13,
      tags_tri_layer: {
        seo_tags: 5,
        occasion_tags: 4,
        audience_tags: 2,
        attribute_tags: 2
      }
    }
  }
];

// Validatie functies
function validateDescription(description) {
  const words = description.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  
  // Check 7 secties
  const requiredSections = [
    "Highlights", "Why You'll Love It", "About This", 
    "Sizing Guide", "Care Instructions", "Production & Shipping", "Call to Action"
  ];
  
  const foundSections = requiredSections.filter(section => 
    description.includes(section) || description.toLowerCase().includes(section.toLowerCase())
  );
  
  return {
    word_count: wordCount,
    meets_90_words: wordCount >= 90,
    sections_found: foundSections.length,
    meets_7_sections: foundSections.length >= 7,
    found_section_names: foundSections
  };
}

function validateTags(tags) {
  if (!Array.isArray(tags) || tags.length !== 13) {
    return { valid: false, error: "Tags must be array of exactly 13 elements" };
  }
  
  // Categorize tags based on tri-layer rules
  const seoTags = tags.filter(tag => tag.includes('-') && tag.split('-').length >= 2);
  const giftTags = tags.filter(tag => 
    tag.includes('gift') || tag.includes('present') || tag.includes('birthday') || 
    tag.includes('anniversary') || tag.includes('wedding')
  );
  
  // Simple heuristics for audience/attribute (would need more sophisticated logic in real implementation)
  const audienceTags = tags.filter(tag => 
    tag.includes('women') || tag.includes('men') || tag.includes('kids') || 
    tag.includes('teen') || tag.includes('adult') || tag.includes('mom') || tag.includes('dad')
  );
  
  const attributeTags = tags.filter(tag => 
    tag.includes('soft') || tag.includes('wooden') || tag.includes('metal') || 
    tag.includes('cotton') || tag.includes('leather') || tag.includes('ceramic')
  );
  
  return {
    valid: true,
    total_count: tags.length,
    seo_tags: seoTags.length,
    gift_tags: giftTags.length,
    audience_tags: audienceTags.length,
    attribute_tags: attributeTags.length,
    meets_tri_layer: seoTags.length >= 5 && giftTags.length >= 4 && 
                     audienceTags.length >= 2 && attributeTags.length >= 2,
    tag_breakdown: {
      seo: seoTags,
      gift: giftTags,
      audience: audienceTags,
      attribute: attributeTags
    }
  };
}

// Export voor gebruik in tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testCases,
    validateDescription,
    validateTags
  };
}

console.log("Prompt v2.7 Validation Script Ready");
console.log("Test cases:", testCases.length);
console.log("Run with: node test_prompt_validation.js");
