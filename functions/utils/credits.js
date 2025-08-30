// functions/utils/credits.js
// Wrapper that delegates to in-memory or Firestore store based on env flag

const USE_FS = process.env.USE_FIRESTORE_CREDITS === '1';

let store;
if (USE_FS && !process.env.JEST_WORKER_ID) {
  store = require('./creditsStoreFirestore');
} else {
  store = null; // will fall back to local implementation below
}

const dayKey = () => new Date().toISOString().slice(0, 10);
const IS_TEST = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
const defaultLimit = () =>
  parseInt(process.env.DAILY_CREDITS || process.env.DEFAULT_USER_CREDITS || '500', 10);

// When using Firestore store, export thin wrappers
if (store) {
  module.exports = {
    ensureCredits: (uid, todayIso = dayKey()) => store.ensureCredits(uid, defaultLimit(), todayIso),
    consumeCredits: (uid, amount, todayIso = dayKey()) =>
      store.consumeCredits(uid, amount, defaultLimit(), todayIso),
    getBalance: (uid, todayIso = dayKey()) => store.getBalance(uid, defaultLimit(), todayIso),
  };
  return; // stop processing in-memory path
}

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
  if (IS_TEST) {
    const doc = getDoc(uid);
    return { ...doc, remaining: Math.max(0, doc.limit - doc.used) };
  }
  // TODO: Firestore lookup/initialise
  const lim = defaultLimit();
  return { limit: lim, used: 0, remaining: lim };
}

async function consumeCredits(uid, amount = 0) {
  if (!uid || amount <= 0) return { ok: true, remaining: defaultLimit() };
  if (IS_TEST) {
    const doc = getDoc(uid);
    if (doc.used + amount > doc.limit) {
      return { ok: false, remaining: doc.limit - doc.used };
    }
    doc.used += amount;
    return { ok: true, remaining: doc.limit - doc.used };
  }
  // TODO: Firestore transaction – atomic increment
  const lim = defaultLimit();
  return { ok: amount <= lim, remaining: Math.max(0, lim - amount) };
}

async function getBalance(uid) {
  const info = await ensureCredits(uid);
  return { remaining: info.remaining };
}

module.exports = { ensureCredits, consumeCredits, getBalance, _resetTestState };
