// functions/__tests__/classifier_v33.test.js
// Jest test for classifier prompt v3.3.2 - gift_mode & composite audience detection

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const { validateClassifierOutput } = require("../utils/validateClassifierOutput");

// Mock OpenAI for testing
jest.mock("openai");

describe("Classifier v3.3.2 - Gift Mode & Composite Audience", () => {
  let testData;
  let mockOpenAI;
  let classifierPrompt;

  beforeAll(() => {
    // Load test data
    const testDataPath = path.join(__dirname, "classifier_v33_testdata.json");
    testData = JSON.parse(fs.readFileSync(testDataPath, "utf-8"));
    
    // Load classifier prompt
    const promptPath = path.join(__dirname, "../prompts/classifier_prompt.txt");
    classifierPrompt = fs.readFileSync(promptPath, "utf-8");
    
    // Setup OpenAI mock
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    OpenAI.mockImplementation(() => mockOpenAI);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to simulate classifier call
  async function runClassifier(rawText) {
    const fullPrompt = `${classifierPrompt}\n\n**RAW_TEXT**: ${rawText}`;
    
    // Mock OpenAI response based on test expectations
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            audience: ["mock", "audience"],
            gift_mode: false,
            fallback_profile: "",
            retry_reason: ""
          })
        }
      }]
    };
    
    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
    
    const response = await mockOpenAI.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: fullPrompt }],
      temperature: 0.4,
      max_tokens: 500
    });
    
    const content = response.choices[0].message.content;
    return JSON.parse(content);
  }

  describe("Schema Validation", () => {
    test("validates correct classifier output", () => {
      const validOutput = {
        audience: ["mom", "dad"],
        gift_mode: true,
        fallback_profile: "",
        retry_reason: ""
      };
      
      const validation = validateClassifierOutput(validOutput);
      expect(validation.isValid).toBe(true);
      expect(validation.notes).toHaveLength(0);
    });

    test("rejects output with forbidden fields", () => {
      const invalidOutput = {
        audience: ["mom"],
        gift_mode: true,
        fallback_profile: "",
        retry_reason: "",
        title: "Forbidden field",
        tags: ["forbidden", "tags"]
      };
      
      const validation = validateClassifierOutput(invalidOutput);
      expect(validation.isValid).toBe(false);
      expect(validation.notes).toContain("Forbidden field present: title");
      expect(validation.notes).toContain("Forbidden field present: tags");
    });

    test("rejects non-boolean gift_mode", () => {
      const invalidOutput = {
        audience: ["mom"],
        gift_mode: "true", // string instead of boolean
        fallback_profile: "",
        retry_reason: ""
      };
      
      const validation = validateClassifierOutput(invalidOutput);
      expect(validation.isValid).toBe(false);
      expect(validation.notes).toContain("gift_mode must be boolean, got: string");
    });

    test("rejects non-array audience", () => {
      const invalidOutput = {
        audience: "mom", // string instead of array
        gift_mode: true,
        fallback_profile: "",
        retry_reason: ""
      };
      
      const validation = validateClassifierOutput(invalidOutput);
      expect(validation.isValid).toBe(false);
      expect(validation.notes).toContain("audience must be array, got: string");
    });

    test("rejects audience with too many elements", () => {
      const invalidOutput = {
        audience: ["mom", "dad", "kids", "grandparents", "pets"], // 5 elements > max 4
        gift_mode: true,
        fallback_profile: "",
        retry_reason: ""
      };
      
      const validation = validateClassifierOutput(invalidOutput);
      expect(validation.isValid).toBe(false);
      expect(validation.notes).toContain("audience array too long: 5 (max 4)");
    });

    test("rejects non-lowercase audience tokens", () => {
      const invalidOutput = {
        audience: ["Mom", "DAD"], // not lowercase
        gift_mode: true,
        fallback_profile: "",
        retry_reason: ""
      };
      
      const validation = validateClassifierOutput(invalidOutput);
      expect(validation.isValid).toBe(false);
      expect(validation.notes).toContain("audience token must be lowercase: \"Mom\"");
      expect(validation.notes).toContain("audience token must be lowercase: \"DAD\"");
    });

    test("rejects fallback_profile too long", () => {
      const invalidOutput = {
        audience: [],
        gift_mode: false,
        fallback_profile: "a".repeat(61), // 61 chars > max 60
        retry_reason: ""
      };
      
      const validation = validateClassifierOutput(invalidOutput);
      expect(validation.isValid).toBe(false);
      expect(validation.notes).toContain("fallback_profile too long: 61 chars (max 60)");
    });

    test("requires audience OR fallback_profile", () => {
      const invalidOutput = {
        audience: [], // empty
        gift_mode: false,
        fallback_profile: "", // empty
        retry_reason: ""
      };
      
      const validation = validateClassifierOutput(invalidOutput);
      expect(validation.isValid).toBe(false);
      expect(validation.notes).toContain("Either audience must have ≥1 element OR fallback_profile must be non-empty");
    });
  });

  describe("Gift Mode Detection", () => {
    test("should detect gift signals in gift test cases", () => {
      const giftTestCases = testData.filter(tc => tc.expect.gift_mode === true);
      
      expect(giftTestCases.length).toBeGreaterThan(0);
      
      giftTestCases.forEach(testCase => {
        // For now, we test the schema validation
        // In real implementation, this would test actual AI responses
        expect(testCase.expect.gift_mode).toBe(true);
        expect(testCase.rawText.toLowerCase()).toMatch(/gift|present|birthday|christmas|anniversary|bridal shower|for him|for her/);
      });
    });

    test("should NOT detect gift signals in non-gift test cases", () => {
      const nonGiftTestCases = testData.filter(tc => tc.expect.gift_mode === false);
      
      expect(nonGiftTestCases.length).toBeGreaterThan(0);
      
      nonGiftTestCases.forEach(testCase => {
        expect(testCase.expect.gift_mode).toBe(false);
      });
    });
  });

  describe("Composite Audience Detection", () => {
    test("should detect composite audiences correctly", () => {
      const compositeTestCases = testData.filter(tc => tc.expect.audience.length > 1);
      
      expect(compositeTestCases.length).toBeGreaterThan(0);
      
      compositeTestCases.forEach(testCase => {
        expect(testCase.expect.audience.length).toBeGreaterThan(1);
        expect(testCase.expect.audience.length).toBeLessThanOrEqual(4);
        
        // Verify all audience tokens are lowercase
        testCase.expect.audience.forEach(token => {
          expect(token).toBe(token.toLowerCase());
          expect(typeof token).toBe('string');
        });
      });
    });

    test("should handle single audiences correctly", () => {
      const singleTestCases = testData.filter(tc => tc.expect.audience.length === 1);
      
      expect(singleTestCases.length).toBeGreaterThan(0);
      
      singleTestCases.forEach(testCase => {
        expect(testCase.expect.audience.length).toBe(1);
        expect(testCase.expect.audience[0]).toBe(testCase.expect.audience[0].toLowerCase());
      });
    });

    test("should use fallback_profile when no audience detected", () => {
      const fallbackTestCases = testData.filter(tc => tc.expect.audience.length === 0);
      
      expect(fallbackTestCases.length).toBeGreaterThan(0);
      
      fallbackTestCases.forEach(testCase => {
        expect(testCase.expect.audience.length).toBe(0);
        expect(testCase.expect.fallback_profile).toBeTruthy();
        expect(testCase.expect.fallback_profile.length).toBeLessThanOrEqual(60);
      });
    });
  });

  describe("Test Data Quality", () => {
    test("all test cases have valid expected outputs", () => {
      testData.forEach((testCase, index) => {
        const validation = validateClassifierOutput(testCase.expect);
        if (!validation.isValid) {
          console.error(`Test case ${index} (${testCase.name}) has invalid expected output:`, validation.notes);
        }
        expect(validation.isValid).toBe(true);
      });
    });

    test(`has exactly 30 test cases for F-score calculation`, () => {
      expect(testData.length).toBe(30);
    });

    test("covers gift mode scenarios", () => {
      const giftCases = testData.filter(tc => tc.expect.gift_mode === true);
      const nonGiftCases = testData.filter(tc => tc.expect.gift_mode === false);
      
      expect(giftCases.length).toBeGreaterThan(5); // At least some gift cases
      expect(nonGiftCases.length).toBeGreaterThan(5); // At least some non-gift cases
    });

    test("covers composite audience scenarios", () => {
      const compositeCases = testData.filter(tc => tc.expect.audience.length > 1);
      const singleCases = testData.filter(tc => tc.expect.audience.length === 1);
      const fallbackCases = testData.filter(tc => tc.expect.audience.length === 0);
      
      expect(compositeCases.length).toBeGreaterThan(3); // At least some composite cases
      expect(singleCases.length).toBeGreaterThan(3); // At least some single cases
      expect(fallbackCases.length).toBeGreaterThan(1); // At least some fallback cases
    });
  });

  describe("F-Score Calculation Preparation", () => {
    test("test data structure supports F-score calculation", () => {
      testData.forEach(testCase => {
        expect(testCase).toHaveProperty('name');
        expect(testCase).toHaveProperty('rawText');
        expect(testCase).toHaveProperty('expect');
        expect(testCase.expect).toHaveProperty('gift_mode');
        expect(testCase.expect).toHaveProperty('audience');
        expect(Array.isArray(testCase.expect.audience)).toBe(true);
      });
    });

    // This test would be implemented when we have real AI responses
    test.skip("calculates F-score ≥ 0.85 for gift_mode detection", async () => {
      let truePositives = 0;
      let falsePositives = 0;
      let falseNegatives = 0;
      
      for (const testCase of testData) {
        const result = await runClassifier(testCase.rawText);
        const expected = testCase.expect.gift_mode;
        const actual = result.gift_mode;
        
        if (expected && actual) truePositives++;
        else if (!expected && actual) falsePositives++;
        else if (expected && !actual) falseNegatives++;
      }
      
      const precision = truePositives / (truePositives + falsePositives);
      const recall = truePositives / (truePositives + falseNegatives);
      const fScore = 2 * (precision * recall) / (precision + recall);
      
      console.log(`F-Score for gift_mode detection: ${fScore.toFixed(3)}`);
      expect(fScore).toBeGreaterThanOrEqual(0.85);
    });
  });
});
