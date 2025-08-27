// QS-6 Integration-stub: verify per-field logging carries quality_score:number and prompt_version

// Mock Firestore admin to avoid real emulator usage
jest.mock('../utils/firebaseAdmin', () => {
  const set = jest.fn().mockResolvedValue(undefined);
  const doc = jest.fn(() => ({ set }));
  const logsCollection = jest.fn(() => ({ doc }));
  const runDoc = jest.fn(() => ({ collection: logsCollection }));
  const runsCollection = jest.fn(() => ({ doc: runDoc }));
  const db = { collection: runsCollection };
  return { admin: {}, db, __mocks: { set, doc, logsCollection, runDoc, runsCollection } };
});

const { logEvent } = require('../utils/logHandler');
const { __mocks } = jest.requireMock('../utils/firebaseAdmin');

function payloadWithScore(score) {
  return {
    uid: 'testuser123', // ensure Firestore write branch is taken
    runId: 'int-run-1',
    run_id: 'int-run-1',
    field: 'description',
    timestamp: new Date().toISOString(),
    prompt_version: 'v2.7',
    tokens_in: 12,
    tokens_out: 50,
    quality_score: score,
  };
}

describe('per-field logging includes quality_score and prompt_version', () => {
  beforeEach(() => {
    Object.values(__mocks).forEach(fn => typeof fn.mockClear === 'function' && fn.mockClear());
  });

  test('writes with numeric quality_score and prompt_version', async () => {
    const payload = payloadWithScore(88);
    await logEvent(payload);

    expect(__mocks.set).toHaveBeenCalledTimes(1);
    const [writtenData] = __mocks.set.mock.calls[0];
    expect(typeof writtenData.quality_score).toBe('number');
    expect(writtenData.quality_score).toBe(88);
    expect(typeof writtenData.prompt_version).toBe('string');
  });
});
