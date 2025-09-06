/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const functions = require("firebase-functions");
const cors = require('cors')({ origin: true });
const api_generateListingFromDump = require("./api_generateListingFromDump");
const api_generateChainingFromFields = require("./api_generateChainingFromFields");
const generateFromDumpCore = require("./generateFromDumpCore");
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const withAuth = require('./utils/authMiddleware');
const { getPlanByPriceId } = require('./utils/stripeCatalog');
// A3-4: wallet util voor ledger-mutaties
const { bookStripeCreditTx, spendCreditsTx } = require('./utils/wallet');

// Initialize Firebase Admin SDK (idempotent)
try { admin.app(); } catch (e) { admin.initializeApp(); }
const db = admin.firestore();
// Losse FieldValue import nodig: admin.firestore.FieldValue bestaat niet meer sinds v12
const { FieldValue } = require('firebase-admin/firestore');

// Stripe setup from env config
// Local fallback: read functions/.runtimeconfig.json when emulator doesn't load config
let localConfig = {};
try {
  const cfgPath = path.join(__dirname, '.runtimeconfig.json');
  if (fs.existsSync(cfgPath)) {
    localConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) || {};
  }
} catch (_) { /* noop: fallback best-effort */ }

const stripeSecret = (functions.config().stripe?.secret) || (localConfig.stripe?.secret);
const webhookSecret = (functions.config().stripe?.webhook_secret) || (localConfig.stripe?.webhook_secret);
const appBaseUrl = (functions.config().app?.base_url) || (localConfig.app?.base_url) || 'http://localhost:5173';
const Stripe = stripeSecret ? require('stripe')(stripeSecret) : null;

// Helper: safe JSON response
function sendJson(res, status, body) {
  res.status(status).set('Content-Type', 'application/json').send(JSON.stringify(body));
}

// Create Checkout Session for buying credits
async function handleCreateCheckoutSession(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  if (!Stripe) return sendJson(res, 500, { error: 'Stripe is not configured' });

  try {
    const body = req.body || {};
    const priceId = body.priceId || body.price_id;
    if (!priceId) return sendJson(res, 400, { error: 'priceId ontbreekt' });

    const plan = getPlanByPriceId(priceId);
    if (!plan) return sendJson(res, 400, { error: 'Onbekende prijs (niet in catalog)' });

    // Optionele double-checks als client toch bedrag/valuta meestuurt
    if (body.amount_cents && Number(body.amount_cents) !== Number(plan.amount_cents)) {
      return sendJson(res, 422, { error: 'Bedrag mismatch t.o.v. catalog' });
    }
    if (body.currency && String(body.currency).toLowerCase() !== String(plan.currency).toLowerCase()) {
      return sendJson(res, 422, { error: 'Valuta mismatch t.o.v. catalog' });
    }

    const uid = req.user?.uid || null; // uid strictly from verified ID token
    if (!uid) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }

    // Bepaal sessie-modus (payment vs subscription) obv het type prijs
    const priceObj = await Stripe.prices.retrieve(priceId);
    const sessionMode = priceObj.type === 'recurring' ? 'subscription' : 'payment';

    const session = await Stripe.checkout.sessions.create({
      mode: sessionMode,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: uid || undefined,
      metadata: { uid: uid || '', priceId },
      success_url: `${appBaseUrl}/?checkout=success`,
      cancel_url: `${appBaseUrl}/?checkout=cancel`,
    });

    return sendJson(res, 200, { url: session.url });
  } catch (err) {
    console.error('createCheckoutSession error', err);
    return sendJson(res, 500, { error: 'Internal error' });
  }
}

// Public demo endpoint to get user credits (to be secured later)
async function handleGetUserCredits(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.*)$/i);
    if (!match) return sendJson(res, 401, { error: 'Missing Authorization Bearer token' });

    const idToken = match[1];
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      console.error('verifyIdToken failed', e);
      return sendJson(res, 401, { error: 'Invalid ID token' });
    }

    const uid = decoded.uid;
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    const credits = (snap.exists ? (snap.data().credits || 0) : 0);
    return sendJson(res, 200, { uid, credits });
  } catch (err) {
    console.error('getUserCredits error', err);
    return sendJson(res, 500, { error: 'Internal error' });
  }
}

// Stripe webhook to grant credits after successful payment
async function handleStripeWebhook(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  if (!Stripe || !webhookSecret) return res.status(500).send('Stripe webhook not configured');

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    // req.rawBody is provided by Firebase Functions (do not JSON parse)
    event = Stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      // 1) Sessiedata ophalen of bypassen voor lokale CLI-tests
      const base = event.data.object;

      const isCliTest =
        base?.metadata?.testing === 'cli' &&
        process.env.TEST_ALLOW_CLI_CHECKOUT === '1';

      console.log('🔍 Webhook debug:', {
        eventType: event.type,
        metadata: base?.metadata,
        envFlag: process.env.TEST_ALLOW_CLI_CHECKOUT,
        isCliTest
      });

      let sessionFull = base;

      if (!isCliTest) {
        // Echte sessie ophalen bij Stripe
        sessionFull = await Stripe.checkout.sessions.retrieve(base.id, {
          expand: ['line_items.data.price'],
        });
      } else {
        console.log(' CLI test-bypass actief (TEST_ALLOW_CLI_CHECKOUT=1)');

        const priceIdMeta = base?.metadata?.priceId || null;
        const plan = getPlanByPriceId(priceIdMeta);
        if (!plan) return sendJson(res, 400, { error: 'Price not in catalog (cli)' });

        // 🔧 Belangrijk: ALTÍJD eigen line_items forceren in CLI-bypass (overschrijft eventuele CLI-items)
        sessionFull = {
          ...base,
          line_items: {
            data: [
              {
                price: {
                  id: priceIdMeta,
                  currency: String(plan.currency).toLowerCase(),
                  unit_amount: Number(plan.amount_cents),
                },
              },
            ],
          },
        };
      }

      // Fallback op client_reference_id indien metadata.uid ontbreekt
      const uidMeta = sessionFull?.metadata?.uid || sessionFull?.client_reference_id || null;
      if (!uidMeta) return sendJson(res, 400, { error: 'UID ontbreekt in sessie (metadata.uid/client_reference_id)' });

      const item     = sessionFull?.line_items?.data?.[0] || null;
      const priceObj = item?.price || null;
      const priceId  = priceObj?.id || null;
      const plan     = getPlanByPriceId(priceId);

      // 3) Idempotency guard & credit booking + ledger
      const evtRef  = db.collection('stripe_events').doc(event.id);
      await db.runTransaction(async (tx) => {
        const seen = await tx.get(evtRef);
        if (seen.exists) return; // already processed

        // Ledger + balance update
        await bookStripeCreditTx(tx, db, {
          uid: uidMeta,
          eventId: event.id,
          sessionId: sessionFull.id,
          priceId,
          credits: Number(plan.credits),
          amount_cents: Number(plan.amount_cents),
          currency: String(plan.currency),
        });

        tx.set(evtRef, {
          processedAt: FieldValue.serverTimestamp(),
        });
      });

      console.log(`🧾 ledger + credited ${Number(plan.credits)} to ${uidMeta} (plan=${priceId})`);
    }
    return res.status(200).send('[ok]');
  } catch (err) {
    console.error('Webhook handling failed', err);
    return res.status(500).send('Internal Error');
  }
}

exports.api_generateListingFromDump = functions.https.onRequest(withAuth((req, res) => {
  cors(req, res, () => api_generateListingFromDump(req, res));
}));

exports.api_generateChainingFromFields = functions.https.onRequest(withAuth((req, res) => {
  cors(req, res, () => api_generateChainingFromFields(req, res));
}));

exports.generateFromDumpCore = require('./http_generateFromDumpCore').generateFromDumpCore;

// Stripe + Credits endpoints
exports.api_createCheckoutSession = functions.https.onRequest(withAuth((req, res) => {
  cors(req, res, () => handleCreateCheckoutSession(req, res));
}));

exports.api_getUserCredits = functions.https.onRequest((req, res) => {
  cors(req, res, () => handleGetUserCredits(req, res));
});

// Wallet endpoint
async function handleGetWallet(req, res) {
  try {
    const authHeader = req.headers.authorization || '';
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) return sendJson(res, 401, { error: 'Missing Authorization Bearer token' });

    let decoded;
    try { decoded = await admin.auth().verifyIdToken(m[1]); }
    catch (e) { console.error('verifyIdToken failed', e); return sendJson(res, 401, { error: 'Invalid ID token' }); }

    const uid = decoded.uid;

    const userDoc = await db.collection('users').doc(uid).get();
    const credits = userDoc.exists ? (userDoc.data().credits || 0) : 0;

    const qSnap = await db.collection('wallet_ledger')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const ledger = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    return sendJson(res, 200, { uid, credits, ledger });
  } catch (err) {
    console.error('api_getWallet error', err);
    return sendJson(res, 500, { error: 'Internal error' });
  }
}

exports.api_getWallet = functions.https.onRequest((req, res) => {
  cors(req, res, () => handleGetWallet(req, res));
});

// Wallet: credits uitgeven
async function handleSpendCredits(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const authHeader = req.headers.authorization || '';
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) return sendJson(res, 401, { error: 'Missing Authorization Bearer token' });

    let decoded;
    try { decoded = await admin.auth().verifyIdToken(m[1]); }
    catch { return sendJson(res, 401, { error: 'Invalid ID token' }); }

    const { amount, reason, requestId } = req.body || {};
    const uid = decoded.uid;

    await db.runTransaction(async (tx) => {
      await spendCreditsTx(tx, db, { uid, credits: Number(amount), reason, requestId });
    });

    const after = await db.collection('users').doc(uid).get();
    const credits = after.exists ? (after.data().credits || 0) : 0;
    return sendJson(res, 200, { uid, credits });
  } catch (err) {
    const code = (err && (err.code === 400 || err.code === 422)) ? err.code : 500;
    const msg  = code === 422 ? 'Insufficient credits' : (code === 400 ? 'Bad request' : 'Internal error');
    console.error('api_spendCredits error', err);
    return sendJson(res, code, { error: msg });
  }
}

exports.api_spendCredits = functions.https.onRequest((req, res) => {
  cors(req, res, () => handleSpendCredits(req, res));
});

// Webhook: no CORS, raw body needed
exports.stripeWebhook = functions.https.onRequest((req, res) => {
  return handleStripeWebhook(req, res);
});
