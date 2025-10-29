'use strict';
const crypto = require('crypto');
const generateFromDumpCore = require('../generateFromDumpCore');

const HMAC_SECRET = process.env.API_HMAC_SECRET || 'dev-secret';
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function okOrigin(origin) {
  // Allow server-to-server calls without Origin header
  if (!origin) return true;
  if (!ALLOWED_ORIGINS.length) return true; // dev mode: allow all
  return ALLOWED_ORIGINS.includes(origin);
}

function verify(req, rawString) {
  const sig = (req.header('x-signature') || '').toLowerCase();
  const ts  = parseInt(req.header('x-ts') || '0', 10);
  if (!sig || !ts) return { ok: false, status: 401, error: 'missing_sig' };
  const ageSec = Math.floor(Date.now() / 1000) - ts;
  if (ageSec > 300) return { ok: false, status: 401, error: 'stale' }; // >5 min

  const secretHex = process.env.API_HMAC_SECRET || '';
  if (!secretHex) return { ok: false, status: 500, error: 'hmac_secret_missing' };

  const expected = crypto
    .createHmac('sha256', Buffer.from(secretHex, 'hex'))
    .update(rawString)
    .digest('hex');

  try {
    if (crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
      return { ok: true };
    }
  } catch (_) { /* length mismatch */ }
  return { ok: false, status: 401, error: 'bad_sig' };
}

// Express-style Cloud Function handler
module.exports = async function httpGenerate(req, res) {
  const t0 = Date.now();

  // ── Debug hooks (enabled only if DEBUG_TOOLS=1) ──
  const DEBUG_TOOLS = process.env.DEBUG_TOOLS === '1';
  const dbgSleep = DEBUG_TOOLS ? parseInt(req.query.debug_sleep || '0', 10) : 0;
  if (dbgSleep > 0) await new Promise((r) => setTimeout(r, dbgSleep));

  const origin = req.headers.origin;
  const hasStrictOrigin = !!origin && origin !== 'null';
  const debugAllowOrigin = DEBUG_TOOLS && req.query.debug_allow_origin === '1';
  const debugForceError = DEBUG_TOOLS && req.query.debug_force_error === '1';

  // 1) Method gate – only POST or OPTIONS allowed
  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // 2) CORS check: block only when a strict Origin is provided and not allowed
  const corsOk = !hasStrictOrigin || okOrigin(origin);
  if (hasStrictOrigin && !corsOk) {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }

  // 3) Set CORS headers when valid Origin provided, or allow-all in debug
  if (hasStrictOrigin) {
    res.set('Access-Control-Allow-Origin', origin);
  } else if (debugAllowOrigin) {
    res.set('Access-Control-Allow-Origin', '*');
  }

  res.set('Vary', 'Origin');
  res.set('Access-Control-Expose-Headers', 'x-credits-remaining');
  res.set('Cache-Control', 'no-store');

  // Optionele debug-header om CORS-evaluatie zichtbaar te maken
  if (DEBUG_TOOLS) {
    res.set('x-debug-cors', JSON.stringify({
      origin: origin || '',
      hasStrictOrigin,
      corsOk
    }));
  }

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Headers', 'content-type,authorization,x-signature,x-ts');
    res.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
    if (!hasStrictOrigin) res.set('Access-Control-Allow-Origin', '*');
    return res.status(204).end();
  }

  const bodyStr = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
  const v = verify(req, bodyStr);
  const allowSkip = process.env.ALLOW_HMAC_SKIP === '1';
  const sig = String(req.header('x-signature') || '');
  if (!(allowSkip && sig === 'skip') && !v.ok) {
    console.warn('HMAC verification failed');
    return res.status(v.status).json({ error: v.error });
  }

  const { text, uid } = req.body || {};
  if (!text || !uid) {
    return res.status(400).json({ error: 'missing_text_or_uid' });
  }

  try {
    if (debugForceError) throw new Error('debug_forced_error');

    // ── Credits-guard: dagelijks quota per gebruiker ─────────────────────
    try {
      const { tryConsumeCredit } = require('../utils/creditsStoreFirestore');
      const credit = await tryConsumeCredit({ uid });
      if (credit.exhausted) {
        res.set('x-credits-remaining', '0');
        return res.status(429).json({
          error: 'Daily credit limit reached',
          code: 'CREDITS_EXHAUSTED',
          bucket_key: credit.bucket_key,
          credits_remaining: 0,
        });
      }
      // Propagate remaining credits via header zodat WP/FE het kan tonen
      res.set('x-credits-remaining', String(credit.remaining));
    } catch (cgErr) {
      console.error('creditsGuard failure', cgErr);
      // Fail-open om geen onnodige 5xx te veroorzaken, maar wel loggen
    }

    try {
      const result = await generateFromDumpCore(text, uid);

      // Buyer-view sanitize: verberg interne labels maar behoud inhoud
      try {
        const { sanitizeForBuyerView } = require('../utils/sanitizeDescription');
        if (result && result.fields && result.fields.description) {
          result.fields.description = sanitizeForBuyerView(result.fields.description);
        }
      } catch (_) { /* fallback: laat ongewijzigd */ }

      return res.status(200).json({ ok: true, result });
    } catch (e) {
      console.error('httpGenerate error', e);

      // 🔔 Slack 5xx alert
      try {
        const { post } = require('../utils/slack');
        await post({ text: `🛑 5xx in httpGenerate: ${e.message || e}` });
        console.log('Slack 5xx alert posted');
      } catch (slackErr) {
        console.error('Slack util error', slackErr);
      }

      return res.status(500).json({ error: 'internal' });
    } finally {
      // 🔔 Slack latency alert
      const dur = Date.now() - t0;
      const thresh = parseInt(process.env.ALERT_LATENCY_MS || '8000', 10);
      if (dur > thresh) {
        try {
          const { post } = require('../utils/slack');
          const uid = (req.body && req.body.uid) || 'n/a';
          await post({ text: `⚠️ High latency ${dur}ms on httpGenerate (uid:${uid})` });
          console.log('Slack latency alert posted');
        } catch (slackErr) {
          console.error('Slack util error', slackErr);
        }
      }
    }
  } catch (e) {
    console.error('httpGenerate error', e);

    // 🔔 Slack 5xx alert
    try {
      const { post } = require('../utils/slack');
      await post({ text: `🛑 5xx in httpGenerate: ${e.message || e}` });
      console.log('Slack 5xx alert posted');
    } catch (slackErr) {
      console.error('Slack util error', slackErr);
    }

    return res.status(500).json({ error: 'internal' });
  }
};
