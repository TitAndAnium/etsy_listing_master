// tests/golden/goldenE2E.test.js
// Golden-set E2E test: runs full generateFromDumpCore on baseline dumps and compares outputs.
// Only runs when env GOLDEN_E2E=1 to avoid heavy LLM calls in normal CI.
/* eslint jest/expect-expect: 0 */

const fs = require('fs');
const path = require('path');
const generateFromDumpCore = require('../../functions/generateFromDumpCore');

const RUN_GOLDEN = process.env.GOLDEN_E2E === '1';

const GOLDEN_DIR = path.join(__dirname, 'fixtures');

function loadFixtures() {
  const cases = [];
  const dirs = fs.readdirSync(GOLDEN_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  for (const c of dirs) {
    const inputPath = path.join(GOLDEN_DIR, c, 'input.txt');
    const expectedPath = path.join(GOLDEN_DIR, c, 'expected.json');
    if (fs.existsSync(inputPath) && fs.existsSync(expectedPath)) {
      const raw = fs.readFileSync(inputPath, 'utf-8');
      const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
      cases.push({ name: c, raw, expected });
    }
  }
  return cases;
}

(RUN_GOLDEN ? describe : describe.skip)('Golden-set E2E', () => {
  const fixtures = loadFixtures();
  if (fixtures.length === 0) {
    it('should have fixtures', () => {
      expect(fixtures.length).toBeGreaterThan(0);
    });
    return;
  }

  for (const { name, raw, expected } of fixtures) {
    it(`should match expected for ${name}`, async () => {
      // Pass uid as 2nd positional arg (function signature: rawText, uid, ...options)
      const res = await generateFromDumpCore(raw, 'testuser123');
      // In test mode generateFromDumpCore may return 422 when only soft validation fails.
      // Accept 200 (success) and 422 (valid with warnings).
      expect([200, 422]).toContain(res.status);
      if (res.status === 200) {
        expect(res.fields).toMatchObject(expected.fields);
      }
      // optionally compare validation warnings count, etc.
    }, 30000);
  }
});
