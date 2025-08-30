// functions/utils/creditsStoreFirestore.js
// Persistent daily credits store backed by Firestore transactions
// Collection: user_credits / <uid>
// Fields: creditsUsed (number), lastReset (ISO YYYY-MM-DD)

const admin = require('firebase-admin');

function getDb() {
  if (!admin.apps.length) {
    // Lazy init for emulator/production
    admin.initializeApp();
  }
  return admin.firestore();
}

const dayKey = (iso) => iso || new Date().toISOString().slice(0, 10);
const dailyLimit = () => parseInt(process.env.DAILY_CREDITS || '500', 10);

async function ensureDoc(tx, ref, todayIso) {
  const snap = await tx.get(ref);
  if (!snap.exists) {
    tx.set(ref, { creditsUsed: 0, lastReset: todayIso });
    return { creditsUsed: 0, lastReset: todayIso };
  }
  const data = snap.data();
  if (data.lastReset !== todayIso) {
    tx.update(ref, { creditsUsed: 0, lastReset: todayIso });
    return { creditsUsed: 0, lastReset: todayIso };
  }
  return data;
}

async function consumeCredits(uid, amount = 0, limit = dailyLimit(), todayIso = dayKey()) {
  if (!uid || amount <= 0) return { ok: true, remaining: limit };
  const db = getDb();
  const ref = db.collection('user_credits').doc(uid);

  try {
    const res = await db.runTransaction(async (tx) => {
      const data = await ensureDoc(tx, ref, todayIso);
      const newUsed = data.creditsUsed + amount;
      if (newUsed > limit) {
        return { ok: false, remaining: Math.max(0, limit - data.creditsUsed) };
      }
      tx.update(ref, { creditsUsed: admin.firestore.FieldValue.increment(amount) });
      return { ok: true, remaining: Math.max(0, limit - newUsed) };
    });
    return res;
  } catch (err) {
    console.error('consumeCredits txn failed', err);
    return { ok: false, remaining: 0 };
  }
}

async function ensureCredits(uid, limit = dailyLimit(), todayIso = dayKey()) {
  if (!uid) return { limit, used: 0, remaining: limit };
  const db = getDb();
  const ref = db.collection('user_credits').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ creditsUsed: 0, lastReset: todayIso });
    return { limit, used: 0, remaining: limit };
  }
  const data = snap.data();
  const used = data.lastReset === todayIso ? data.creditsUsed : 0;
  return { limit, used, remaining: Math.max(0, limit - used) };
}

async function getBalance(uid, limit = dailyLimit(), todayIso = dayKey()) {
  const info = await ensureCredits(uid, limit, todayIso);
  return { remaining: info.remaining };
}

module.exports = { ensureCredits, consumeCredits, getBalance };
