// functions/utils/credits.js
const dayKey = () => new Date().toISOString().slice(0, 10);
const DEFAULT_LIMIT = parseInt(
  process.env.DAILY_CREDITS || process.env.DEFAULT_USER_CREDITS || '500',
  10
);
const IS_TEST = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;

// In-memory map used for Jest/dev; shape: mem[uid][YYYY-MM-DD] = { limit, used }
const mem = {};

function getDoc(uid) {
  const k = dayKey();
  if (!mem[uid]) mem[uid] = {};
  if (!mem[uid][k]) mem[uid][k] = { limit: DEFAULT_LIMIT, used: 0 };
  return mem[uid][k];
}

async function ensureCredits(uid) {
  if (!uid) return { limit: 0, used: 0, remaining: 0 };
  if (IS_TEST) {
    const doc = getDoc(uid);
    return { ...doc, remaining: Math.max(0, doc.limit - doc.used) };
  }
  // TODO: Firestore lookup/initialise
  return { limit: DEFAULT_LIMIT, used: 0, remaining: DEFAULT_LIMIT };
}

async function consumeCredits(uid, amount = 0) {
  if (!uid || amount <= 0) return { ok: true, remaining: DEFAULT_LIMIT };
  if (IS_TEST) {
    const doc = getDoc(uid);
    if (doc.used + amount > doc.limit) {
      return { ok: false, remaining: doc.limit - doc.used };
    }
    doc.used += amount;
    return { ok: true, remaining: doc.limit - doc.used };
  }
  // TODO: Firestore transaction – atomic increment
  return { ok: true, remaining: DEFAULT_LIMIT - amount };
}

async function getBalance(uid) {
  const info = await ensureCredits(uid);
  return { remaining: info.remaining };
}

module.exports = { ensureCredits, consumeCredits, getBalance };
