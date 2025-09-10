// functions/utils/credits.js
// Wrapper that delegates to in-memory or Firestore store based on env flag

const USE_FS = process.env.USE_FIRESTORE_CREDITS === '1';

const IS_TEST = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
const dayKey = () => new Date().toISOString().slice(0, 10);
const defaultLimit = () =>
  parseInt(process.env.DAILY_CREDITS || process.env.DEFAULT_USER_CREDITS || '500', 10);

let store;
if (USE_FS && !IS_TEST) {
  // Lazy-require to avoid pulling firebase-admin in test runs
  store = require('./creditsStoreFirestore');
  module.exports = {
    ensureCredits: (uid, todayIso = dayKey()) => store.ensureCredits(uid, defaultLimit(), todayIso),
    consumeCredits: (uid, amount, todayIso = dayKey()) =>
      store.consumeCredits(uid, amount, defaultLimit(), todayIso),
    getBalance: (uid, todayIso = dayKey()) => store.getBalance(uid, defaultLimit(), todayIso),
  };
} else {
  // ---- In-memory fallback (tests / local mock) ----

  // internal state (in-memory buckets)
  const mem = {};

  // TEST-ONLY helper to reset all buckets between Jest test cases
  function _resetTestState() {
    if (IS_TEST) {
      for (const uid of Object.keys(mem)) {
        delete mem[uid];
      }
    }
  }

  function getDoc(uid) {
    const k = dayKey();
    if (!mem[uid]) mem[uid] = {};
    if (!mem[uid][k]) mem[uid][k] = { limit: defaultLimit(), used: 0 };
    // In tests: reset bucket when DAILY_CREDITS changes during runtime
    if (IS_TEST && mem[uid][k].limit !== defaultLimit()) {
      mem[uid][k] = { limit: defaultLimit(), used: 0 };
    }
    return mem[uid][k];
  }

  async function ensureCredits(uid) {
    if (!uid) return { limit: 0, used: 0, remaining: 0 };
    const doc = getDoc(uid);
    return { ...doc, remaining: Math.max(0, doc.limit - doc.used) };
  }

  async function consumeCredits(uid, amount = 0) {
    if (!uid || amount <= 0) return { ok: true, remaining: defaultLimit() };
    const doc = getDoc(uid);
    if (doc.used + amount > doc.limit) {
      return { ok: false, remaining: doc.limit - doc.used };
    }
    doc.used += amount;
    return { ok: true, remaining: doc.limit - doc.used };
  }

  async function getBalance(uid) {
    const info = await ensureCredits(uid);
    return { remaining: info.remaining };
  }

  module.exports = { ensureCredits, consumeCredits, getBalance, _resetTestState };
}
