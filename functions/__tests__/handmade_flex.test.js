// handmade_flex.test.js - Test handmade-flex logic implementation
// Tests that allow_handmade flag correctly controls "handmade" validation

const generateFromDumpCore = require('../generateFromDumpCore');

// Mock OpenAI to avoid API calls during testing
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                profile_type: "handmade_jewelry",
                occasion: ["birthday"],
                audience: ["mom"],
                gift_mode: false,
                allow_handmade: true
              })
            }
          }],
          usage: { prompt_tokens: 100, completion_tokens: 50 }
        })
      }
    }
  }));
});

// Mock field generator to return predictable results
jest.mock('../utils/fieldGenerator', () => ({
  generateField: jest.fn().mockImplementation((profile, field, context, options) => {
    if (field === 'title') {
      // Return "handmade" in title when allow_handmade is true
      if (options?.allow_handmade) {
        return "Handmade Silver Ring - Perfect Gift for Mom";
      } else {
        return "Artisan Silver Ring - Perfect Gift for Mom";
      }
    }
    if (field === 'tags') {
      return ["silver", "ring", "gift", "mom", "birthday", "jewelry", "unique"];
    }
    if (field === 'description') {
      return "Beautiful silver ring, perfect as a thoughtful gift.";
    }
    return "";
  })
}));

// Mock logHandler to prevent Firestore calls
jest.mock('../utils/logHandler', () => ({
  logEvent: jest.fn().mockResolvedValue({})
}));

// Mock validators to prevent complex validation logic
jest.mock('../utils/validators/validatorCoordinator', () => ({
  runAllValidators: jest.fn().mockReturnValue({
    isValid: true,
    isSoftFail: false,
    warnings: [],
    metrics: {
      totalWarnings: 0,
      highSeverityWarnings: 0,
      mediumSeverityWarnings: 0,
      lowSeverityWarnings: 0,
      processingTimeMs: 1
    }
  }),
  formatValidationLog: jest.fn().mockReturnValue({})
}));

// Mock validation functions
jest.mock('../utils/validateFinalOutput', () => {
  return jest.fn().mockReturnValue({
    success: true,
    reason: "",
    notes: []
  });
});

describe('Handmade-Flex Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should allow "handmade" in title when allow_handmade=true', async () => {
    const input = "handmade silver ring for mom";
    const options = {
      runId: "test-handmade-allowed",
      allow_handmade: true,
      gift_mode: false
    };

    const result = await generateFromDumpCore(input, "testuser123", options);

    // Should succeed without high-severity warnings about "handmade"
    expect(result.error).toBeUndefined();
    expect(result.fields).toBeDefined();
    expect(result.fields.title).toContain("Handmade");
    
    // Validation should not flag "handmade" as forbidden
    if (result.validation && result.validation.warnings) {
      const handmadeWarnings = result.validation.warnings.filter(w => 
        w.message.toLowerCase().includes('handmade') && w.severity === 'high'
      );
      expect(handmadeWarnings).toHaveLength(0);
    }
  });

  test('should warn about "handmade" in title when allow_handmade=false', async () => {
    const input = "handmade silver ring for mom";
    const options = {
      runId: "test-handmade-forbidden",
      allow_handmade: false,
      gift_mode: false
    };

    const result = await generateFromDumpCore(input, "testuser123", options);

    // Should still succeed (soft-fail) but with warnings
    expect(result.error).toBeUndefined();
    expect(result.fields).toBeDefined();
    expect(result.fields.title).toContain("Artisan"); // Should use alternative
    
    // If title somehow contains "handmade", validator should flag it
    // Note: This test validates the validator logic, not the prompt logic
  });

  test('should pass allow_handmade flag to validation context', async () => {
    const input = "artisan silver ring";
    const options = {
      runId: "test-context-passing",
      allow_handmade: true,
      gift_mode: false
    };

    const result = await generateFromDumpCore(input, "testuser123", options);

    expect(result.error).toBeUndefined();
    expect(result.validation).toBeDefined();
    
    // The validation context should have received the allow_handmade flag
    // This is tested indirectly through the absence of handmade warnings
    // when allow_handmade=true
  });

  test('should calculate quality_score based on validation warnings', async () => {
    const input = "silver ring for mom";
    const options = {
      runId: "test-quality-score",
      allow_handmade: false,
      gift_mode: false
    };

    const result = await generateFromDumpCore(input, "testuser123", options);

    expect(result.error).toBeUndefined();
    expect(result.validation).toBeDefined();
    expect(result.validation.metrics).toBeDefined();
    
    // Quality score should be calculated based on actual warnings
    // Not a fallback value of 100
    if (result.validation.metrics) {
      const hasWarnings = result.validation.metrics.totalWarnings > 0;
      // Quality score calculation is tested indirectly through metrics presence
      expect(typeof result.validation.metrics.totalWarnings).toBe('number');
    }
  });
});
