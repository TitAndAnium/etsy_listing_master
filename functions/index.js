/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/https");
 * const {onDocumentWritten} = require("firebase-functions/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require('firebase-functions/params');
const cors = require('cors')({ origin: true });
// Lazy load handlers to speed up deployment analysis
// const api_generateListingFromDump = require("./api_generateListingFromDump");
// const api_generateChainingFromFields = require("./api_generateChainingFromFields");
// const generateV2Handler = require('./handlers/generateV2');
// const regenerateV2Handler = require('./handlers/regenerateV2');
// const reviewEditV2Handler = require('./handlers/reviewEditV2');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const withAuth = require('./utils/authMiddleware');
const { getPlanByPriceId } = require('./utils/stripeCatalog');
// A3-4: wallet util voor ledger-mutaties
const { bookStripeCreditTx, spendCreditsTx } = require('./utils/wallet');

// === Firebase Secrets (production) ===
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const STRIPE_SECRET = defineSecret('STRIPE_SECRET');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const SLACK_WEBHOOK_URL = defineSecret('SLACK_WEBHOOK_URL');

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

// Secrets: production uses Firebase Secrets, local/emulator uses .env or .runtimeconfig.json
const stripeSecret   = process.env.STRIPE_SECRET        || (localConfig.stripe?.secret);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || (localConfig.stripe?.webhook_secret);
const appBaseUrl    = process.env.APP_BASE_URL          || (localConfig.app?.base_url) || 'https://us-central1-etsy-ai-hacker.cloudfunctions.net';
const Stripe = stripeSecret ? require('stripe')(stripeSecret) : null;

// Haal origins op uit env óf functions.config() - met lazy eval voor deployment
let cachedOrigins = null;
function getAllowedOrigins() {
  if (cachedOrigins) return cachedOrigins;
  
  const raw =
    (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.trim()) ||
    (localConfig.cors?.allowed_origins && localConfig.cors.allowed_origins.trim()) ||
    // Veilige defaults voor onze hosting + sellsiren productie
    'https://etsy-ai-hacker.web.app,https://etsy-ai-hacker.firebaseapp.com,https://sellsiren.com,https://www.sellsiren.com';

  cachedOrigins = raw.split(',').map(s => s.trim()).filter(Boolean);
  return cachedOrigins;
}

// Vaste, robuuste CORS laag (gebruikt VOOR withAuth)
function applyCors(req, res) {
  const origin = req.get('Origin');
  const allowed = getAllowedOrigins();

  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (!origin) {
    // Server-to-server (geen origin): allow maar log voor monitoring
    res.set('Access-Control-Allow-Origin', '*');
    console.log('[CORS] Server-to-server request (no Origin header)');
  } else if (allowed.includes(origin)) {
    // Bekende origin → echo exact terug
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
  } else {
    // BLOCKED: onbekende origin
    console.warn('[CORS] BLOCKED - Unknown origin:', origin, 'Allowed:', allowed);
    // Geen Access-Control-Allow-Origin header → browser blokkeert
  }

  if (req.method === 'OPTIONS') {
    // BELANGRIJK: preflight hier direct beëindigen
    return res.status(204).end();
  }
}

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
    const uid = req.user?.uid;
    if (!uid) return sendJson(res, 401, { error: 'Authentication required' });
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

exports.api_generateListingFromDump = onRequest(
  { secrets: [OPENAI_API_KEY, SLACK_WEBHOOK_URL] },
  withAuth((req, res) => {
    const handler = require("./api_generateListingFromDump");
    cors(req, res, () => handler(req, res));
  })
);

exports.api_generateChainingFromFields = onRequest(
  { secrets: [OPENAI_API_KEY, SLACK_WEBHOOK_URL] },
  withAuth((req, res) => {
    const handler = require("./api_generateChainingFromFields");
    cors(req, res, () => handler(req, res));
  })
);

exports.api_generateV2 = onRequest(
  { secrets: [OPENAI_API_KEY, SLACK_WEBHOOK_URL] },
  (req, res) => {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return; // preflight is al afgehandeld
    const handler = require('./handlers/generateV2');
    return withAuth(handler)(req, res);
  }
);

exports.api_regenerateField = onRequest(
  { secrets: [OPENAI_API_KEY, SLACK_WEBHOOK_URL] },
  (req, res) => {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return; // preflight is al afgehandeld
    const handler = require('./handlers/regenerateV2');
    return withAuth(handler)(req, res);
  }
);

exports.api_reviewUserEdit = onRequest(
  { secrets: [OPENAI_API_KEY, SLACK_WEBHOOK_URL] },
  (req, res) => {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return; // preflight is al afgehandeld
    const handler = require('./handlers/reviewEditV2');
    return withAuth(handler)(req, res);
  }
);

exports.generateFromDumpCore = require('./http_generateFromDumpCore').generateFromDumpCore;

// Stripe + Credits endpoints
exports.api_createCheckoutSession = onRequest(
  { secrets: [STRIPE_SECRET] },
  (req, res) => {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return; // preflight is al afgehandeld
    return withAuth(handleCreateCheckoutSession)(req, res);
  }
);

exports.api_getUserCredits = onRequest((req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return; // preflight is al afgehandeld
  return withAuth(handleGetUserCredits)(req, res);
});

// Wallet endpoint
async function handleGetWallet(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const uid = req.user?.uid;
    if (!uid) return sendJson(res, 401, { error: 'Authentication required' });

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

exports.api_getWallet = onRequest((req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return; // preflight is al afgehandeld
  return withAuth(handleGetWallet)(req, res);
});

// Wallet: credits uitgeven
async function handleSpendCredits(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const uid = req.user?.uid;
    if (!uid) return sendJson(res, 401, { error: 'Authentication required' });
    const { amount, reason, requestId } = req.body || {};

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

exports.api_spendCredits = onRequest((req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return; // preflight is al afgehandeld
  return withAuth(handleSpendCredits)(req, res);
});

// Webhook: no CORS, raw body needed
exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET, SLACK_WEBHOOK_URL] },
  (req, res) => {
    return handleStripeWebhook(req, res);
  }
);

// 👉 Lazy require to keep cold-start and deployment analysis fast
exports.httpGenerate = onRequest(
  { secrets: [OPENAI_API_KEY, SLACK_WEBHOOK_URL] },
  (req, res) => {
    const httpGenerate = require('./handlers/httpGenerate');
    return httpGenerate(req, res);
  }
);
