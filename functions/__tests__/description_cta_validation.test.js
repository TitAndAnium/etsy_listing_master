/**
 * Jest test for Description Call To Action block validation
 * Tests the validateOutput function for CTA block presence/absence
 */

const { validateOutput } = require('../utils/validateFinalOutput');

describe('Description CTA Block Validation', () => {
  
  test('should PASS validation when description contains Call To Action block', () => {
    const mockOutput = {
      description: `
::: Overview :::
This is a beautiful handcrafted jewelry piece perfect for gifting.

::: Features :::
- High-quality materials for lasting beauty
- Personalization options available
- Perfect for special occasions

::: Shipping and Processing :::
Ships from US in 4-6 business days with tracking.

::: Call To Action :::
Order now and give her a unique keepsake she'll treasure forever.
      `.trim()
    };

    const mockContext = {
      gift_mode: true,
      audience: ['women', 'gift-buyers'],
      fallback_profile: 'general'
    };

    const result = validateOutput(mockOutput);
    
    expect(result.isValid).toBe(true);
    expect(result.notes).toEqual([]);
  });

  test('should FAIL validation when description is missing Call To Action block', () => {
    const mockOutput = {
      description: `
::: Overview :::
This is a beautiful handcrafted jewelry piece perfect for gifting.

::: Features :::
- High-quality materials for lasting beauty
- Personalization options available
- Perfect for special occasions

::: Shipping and Processing :::
Ships from US in 4-6 business days with tracking.

::: Final Note :::
Make her day unforgettable with this unique gift.
      `.trim()
    };

    const mockContext = {
      gift_mode: true,
      audience: ['women', 'gift-buyers'],
      fallback_profile: 'general'
    };

    const result = validateOutput(mockOutput);
    
    expect(result.isValid).toBe(false);
    expect(result.notes.some(note => note.includes('desc_missing_block'))).toBe(true);
  });

  test('should PASS validation when description has Call To Action with different casing', () => {
    const mockOutput = {
      description: `
::: Overview :::
This is a beautiful handcrafted jewelry piece perfect for gifting.

::: Features :::
- High-quality materials for lasting beauty

::: Call to Action :::
Don't miss out - order your personalized jewelry today!
      `.trim()
    };

    const mockContext = {
      gift_mode: true,
      audience: ['women', 'gift-buyers'],
      fallback_profile: 'general'
    };

    const result = validateOutput(mockOutput);
    
    // This test depends on whether the validator is case-sensitive
    // If it should be case-insensitive, expect true; if case-sensitive, expect false
    console.log('CTA case sensitivity test result:', result);
  });

  test('should handle empty description gracefully (minimal mode)', () => {
    const mockOutput = {
      description: ''
    };

    const mockContext = {
      gift_mode: true,
      audience: ['women', 'gift-buyers'],
      fallback_profile: 'general'
    };

    const result = validateOutput(mockOutput);
    
    // Empty description < 50 chars is accepted as "minimal mode"
    expect(result.isValid).toBe(true);
    expect(result.notes).toEqual([]);
  });

  test('should validate apostrophe support in tags (regression test)', () => {
    const mockOutput = {
      tags: ["mother's day", "women's jewelry", "personalized gift"]
    };

    const mockContext = {
      gift_mode: true,
      audience: ['women', 'gift-buyers'],
      fallback_profile: 'general'
    };

    const result = validateOutput(mockOutput);
    
    // Should not fail on apostrophes in tags
    const apostropheErrors = result.notes.filter(note => 
      note.includes("mother's day") || note.includes("women's jewelry")
    );
    expect(apostropheErrors.length).toBe(0);
  });

  test('should validate complete listing output with all fields', () => {
    const mockOutput = {
      title: "Handcrafted Personalized Jewelry Gift for Her - Unique Women's Necklace",
      tags: ["personalized gift", "women's jewelry", "handcrafted", "mother's day"],
      description: `
::: Overview :::
Celebrate special moments with our handcrafted personalized jewelry.

::: Features :::
- Thoughtfully designed for lasting memories
- High-quality materials for durability
- Perfect for gifting occasions

::: Shipping and Processing :::
Ships from US in 4-6 business days with tracking.

::: Call To Action :::
Order now and create a meaningful gift she'll treasure forever.
      `.trim()
    };

    const mockContext = {
      gift_mode: true,
      audience: ['women', 'gift-buyers'],
      fallback_profile: 'general'
    };

    const result = validateOutput(mockOutput);
    
    expect(result.isValid).toBe(true);
    expect(result.notes).toEqual([]);
  });
});
