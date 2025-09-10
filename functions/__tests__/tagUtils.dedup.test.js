'use strict';

const { toStemKey, dedupeByStem, _stemWord } = require('../utils/tagUtils');

describe('tag stem dedup v1.0', () => {
  test('word stemming basics', () => {
    expect(_stemWord("dogs")).toBe("dog");
    expect(_stemWord("boxes")).toBe("box");
    expect(_stemWord("puppies")).toBe("puppy");
  });

  test('phrase key normalization', () => {
    expect(toStemKey("Silver Rings")).toBe("silver-ring");
    expect(toStemKey("silver ring")).toBe("silver-ring");
    expect(toStemKey("silver-ring")).toBe("silver-ring");
  });

  test('dedupe preserves first occurrence and drops later variants', () => {
    const tags = ["dog", "dogs", "puppy", "puppies", "silver ring", "silver rings", "cat"];
    const { unique, dropped } = dedupeByStem(tags);
    expect(unique).toEqual(["dog", "puppy", "silver ring", "cat"]);
    expect(dropped).toEqual(["dogs", "puppies", "silver rings"]);
  });

  test('handles non-ascii and punctuation gracefully', () => {
    const tags = ["café ring", "cafe rings"];
    const { unique, dropped } = dedupeByStem(tags);
    expect(unique[0]).toBe("café ring");
    expect(dropped).toEqual(["cafe rings"]);
  });
});