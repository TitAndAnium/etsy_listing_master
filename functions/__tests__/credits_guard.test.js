// functions/__tests__/credits_guard.test.js
const admin = require('firebase-admin');
const { tryConsumeCredit, bucketKeyEU } = require('../utils/creditsFirestore');

// Configure Firestore emulator for tests
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8089';
process.env.CREDITS_DAILY_LIMIT = '2';

// Geef Firestore calls wat extra tijd in CI-omgevingen
jest.setTimeout(30000);

describe('credits guard – Firestore', () => {
  const uid = 'jest-user-1';
  beforeAll(() => {
    if (!admin.apps.length) admin.initializeApp();
  });

  afterAll(async () => {
    // Voorkom open handles ReferenceError
    await Promise.all(admin.apps.map((app) => app.delete()));
  });

  test('consumes credits until exhausted', async () => {
    const today = new Date('2025-09-17T10:00:00+02:00');

    const first = await tryConsumeCredit({ uid, now: today });
    expect(first.remaining).toBe(1);
    expect(first.exhausted).toBeUndefined();

    const second = await tryConsumeCredit({ uid, now: today });
    expect(second.remaining).toBe(0);

    const third = await tryConsumeCredit({ uid, now: today });
    expect(third.exhausted).toBe(true);
  });
});
