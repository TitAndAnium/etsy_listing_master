// Unit tests for Firestore credits store using Jest mocks
const { ensureCredits, consumeCredits } = require('../utils/creditsStoreFirestore');

// Mock firebase-admin firestore
jest.mock('firebase-admin', () => {
  const data = {};
  const fakeDoc = (uid) => ({
    _data: data[uid],
    get: jest.fn().mockResolvedValue({ exists: !!data[uid], data: () => data[uid] }),
    set: jest.fn().mockImplementation((val) => { data[uid] = val; }),
    update: jest.fn().mockImplementation((val) => {
      data[uid] = { ...data[uid], ...val, creditsUsed: (data[uid]?.creditsUsed || 0) + (val.creditsUsed || 0) };
    }),
  });
  const firestore = () => ({
    collection: () => ({ doc: (uid) => fakeDoc(uid) }),
    runTransaction: async (fn) => fn({ get: (doc) => doc.get(), set: (doc, v) => doc.set(v), update: (doc, v) => doc.update(v) }),
  });
  return { firestore, apps: [], initializeApp: jest.fn() };
});

describe('creditsStoreFirestore', () => {
  const uid = 'test-uid';
  const today = '2025-08-30';
  beforeEach(() => jest.resetModules());

  test('starts with full quota', async () => {
    const info = await ensureCredits(uid, 5, today);
    expect(info.remaining).toBe(5);
  });

  test('consumes credits until limit', async () => {
    let res = await consumeCredits(uid, 3, 5, today);
    expect(res.ok).toBe(true);
    expect(res.remaining).toBe(2);

    res = await consumeCredits(uid, 3, 5, today);
    expect(res.ok).toBe(false);
    expect(res.remaining).toBe(2);
  });
});
