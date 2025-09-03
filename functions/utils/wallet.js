// functions/utils/wallet.js
const { FieldValue } = require('firebase-admin/firestore');

/** Genereer stabiele ledger-id op basis van Stripe event-id */
function ledgerDocIdFromStripe(eventId) {
  return `stripe_${eventId}`;
}

/**
 * Boekt credits bij en schrijft ledger-entry. Aanroepen BINNEN Firestore transaction.
 * @param {import('@google-cloud/firestore').Transaction} tx
 * @param {import('@google-cloud/firestore').Firestore} db
 * @param {Object} opts
 */
async function bookStripeCreditTx(tx, db, { uid, eventId, priceId, credits, amount_cents, currency, sessionId }) {
  const userRef   = db.collection('users').doc(uid);
  const ledgerRef = db.collection('wallet_ledger').doc(ledgerDocIdFromStripe(eventId));

  const snap = await tx.get(userRef);
  const current = snap.exists ? (snap.data().credits || 0) : 0;

  tx.set(userRef, { credits: current + Number(credits) }, { merge: true });
  tx.set(ledgerRef, {
    uid,
    type: 'credit',
    source: 'stripe',
    eventId,
    sessionId,
    priceId,
    credits: Number(credits),
    amount_cents: Number(amount_cents),
    currency: String(currency).toLowerCase(),
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Trek credits af en schrijf 'debit' ledger-entry binnen een Firestore transactie.
 * Werpt errors met code 400 (bad request) of 422 (insufficient credits).
 *
 * @param {import('@google-cloud/firestore').Transaction} tx
 * @param {import('@google-cloud/firestore').Firestore} db
 * @param {{ uid:string, credits:number, reason?:string, requestId?:string }} opts
 */
async function spendCreditsTx(tx, db, { uid, credits, reason, requestId }) {
  const amt = Number(credits);
  if (!Number.isFinite(amt) || amt <= 0) {
    const e = new Error('Invalid amount'); e.code = 400; throw e;
  }

  const userRef   = db.collection('users').doc(uid);
  const ledgerRef = requestId
    ? db.collection('wallet_ledger').doc(`spend_${uid}_${requestId}`)
    : db.collection('wallet_ledger').doc(); // auto-id (geen idempotency key)

  const snap   = await tx.get(userRef);
  const before = snap.exists ? (snap.data().credits || 0) : 0;

  if (before < amt) {
    const e = new Error('Insufficient credits'); e.code = 422; throw e;
  }

  tx.set(userRef, { credits: before - amt }, { merge: true });
  tx.set(ledgerRef, {
    uid,
    type: 'debit',
    source: 'api',
    credits: amt,
    reason: reason || null,
    requestId: requestId || null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

module.exports = { bookStripeCreditTx, ledgerDocIdFromStripe, spendCreditsTx };
