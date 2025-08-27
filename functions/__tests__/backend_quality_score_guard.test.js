// QS-6 Unit tests: Guard on quality_score in logHandler

// Ensure test env
process.env.NODE_ENV = 'test';

// Mock firebase-admin so utils/firebaseAdmin.js never initializes real Admin SDK
jest.mock('firebase-admin', () => {
  const set = jest.fn().mockResolvedValue(undefined);
  const doc = jest.fn(() => ({ set }));
  const collection = jest.fn(() => ({ doc }));
  const firestore = () => ({ settings: jest.fn(), collection });
  return { apps: [], initializeApp: jest.fn(), firestore };
});

const { logEvent } = require('../utils/logHandler');

function basePayload(overrides = {}) {
  return {
    uid: 'someoneelse', // ensure we don't hit Firestore write branch (only testuser123 writes)
    runId: 'unit-run-1',
    run_id: 'unit-run-1',
    field: 'title',
    timestamp: new Date().toISOString(),
    prompt_version: 'v2.7',
    tokens_in: 10,
    tokens_out: 42,
    ...overrides,
  };
}

describe('logHandler quality_score guard', () => {
  test('throws when quality_score is missing', async () => {
    await expect(logEvent(basePayload({ quality_score: undefined })))
      .rejects.toThrow('quality_score missing in field log payload');
  });

  test('throws when quality_score is null', async () => {
    await expect(logEvent(basePayload({ quality_score: null })))
      .rejects.toThrow('quality_score missing in field log payload');
  });

  test('passes when quality_score is 0', async () => {
    await expect(logEvent(basePayload({ quality_score: 0 }))).resolves.toBeUndefined();
  });

  test('passes when quality_score is a positive number', async () => {
    await expect(logEvent(basePayload({ quality_score: 87 }))).resolves.toBeUndefined();
  });
});
