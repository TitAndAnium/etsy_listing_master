// functions/utils/creditsFirestore.js
// Firestore-gebaseerde dagelijkse credits-guard (Europe/Amsterdam kalenderdag)

const admin = require('firebase-admin');
const { Timestamp, FieldValue } = admin.firestore;

function getDb() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return admin.firestore();
}

function bucketKeyEU(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [y, m, d] = fmt.format(date).split('-'); // YYYY-MM-DD
  return `daily_${y}${m}${d}`;
}

/**
 * Consume precies 1 credit voor uid. Transactioneel.
 * @param {object} opts { uid, now?, limitEnv? }
 * @returns {Promise<{bucket_key:string, remaining:number, limit:number, exhausted?:boolean}>}
 */
async function tryConsumeCredit({ uid, now = new Date(), limitEnv = process.env.CREDITS_DAILY_LIMIT || '20' }) {
  if (!uid) throw new Error('uid is required');
  const limit = Math.max(1, parseInt(limitEnv, 10));
  const key = bucketKeyEU(now);
  const db = getDb();
  const ref = db.doc(`users/${uid}/credits/${key}`);

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        bucket_key: key,
        limit,
        remaining: limit - 1,
        consumed: 1,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
      return { bucket_key: key, remaining: limit - 1, limit };
    }
    const data = snap.data();
    if ((data.remaining || 0) <= 0) {
      return { bucket_key: key, remaining: 0, limit, exhausted: true };
    }
    tx.update(ref, {
      remaining: FieldValue.increment(-1),
      consumed: FieldValue.increment(1),
      updated_at: Timestamp.now(),
    });
    return { bucket_key: key, remaining: data.remaining - 1, limit };
  });
}

module.exports = { tryConsumeCredit, bucketKeyEU };
