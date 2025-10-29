'use strict';

const generateFromDumpCore = require('../generateFromDumpCore');
const { precheck } = require('../utils/budgetGuard');
const { spendCreditsTx } = require('../utils/wallet');
const rateLimit = require('../utils/rateLimit');
const admin = require('firebase-admin');
const db = admin.firestore();

const RATE_LIMIT_PER_MIN = parseInt(process.env.RATE_LIMIT_PER_MIN || '12', 10);

function setCors(res, origin) {
  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
  } else {
    res.set('Access-Control-Allow-Origin', '*');
  }
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Expose-Headers', 'x-credits-remaining');
  res.set('Cache-Control', 'no-store');
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') {
    return { error: 'invalid_json_body' };
  }

  const {
    mode = 'dump',
    payload,
    settings = {},
    previewOnly = false,
    confirmed_by_user = false,
    context_override = null,
    uid: bodyUid,
  } = body;

  if (!payload || typeof payload !== 'string' || !payload.trim()) {
    return { error: 'missing_payload' };
  }

  return {
    value: {
      mode,
      payload,
      settings,
      previewOnly: Boolean(previewOnly),
      confirmedByUser: Boolean(confirmed_by_user),
      contextOverride: context_override,
      bodyUid,
    }
  };
}

function toV2Shape(coreResult) {
  if (!coreResult || !coreResult.fields) {
    return {
      title: { value: '', retry_reason: '', warnings: [] },
      description: { value: '', retry_reason: '', warnings: [] },
      tags: { items: [], retry_reason: '', warnings: [] },
      meta: {
        prompt_version: coreResult?.meta?.prompt_version || 'unknown',
        model: coreResult?.meta?.model || 'unknown',
        token_usage: coreResult?.meta?.token_usage || {},
        context_used: coreResult?.meta?.context_used || {},
      },
      context: {
        ai_fields: coreResult?.fields || {},
        required_fields: [],
        confirmed_by_user: Boolean(coreResult?.confirmed_by_user),
      }
    };
  }

  const warnings = coreResult.validation?.warnings || {};
  const safeWarnings = (field) => warnings[field] || [];
  return {
    title: {
      value: coreResult.fields.title || '',
      retry_reason: coreResult.meta?.retry_reason?.title || '',
      warnings: safeWarnings('title'),
    },
    description: {
      value: coreResult.fields.description || '',
      retry_reason: coreResult.meta?.retry_reason?.description || '',
      warnings: safeWarnings('description'),
    },
    tags: {
      items: Array.isArray(coreResult.fields.tags) ? coreResult.fields.tags : [],
      retry_reason: coreResult.meta?.retry_reason?.tags || '',
      warnings: safeWarnings('tags'),
    },
    meta: {
      prompt_version: coreResult.meta?.prompt_version || 'unknown',
      model: coreResult.meta?.model || 'unknown',
      token_usage: coreResult.meta?.token_usage || {},
      context_used: coreResult.meta?.context_used || {},
    },
    context: {
      ai_fields: coreResult.fields,
      required_fields: coreResult.meta?.required_fields || [],
      confirmed_by_user: Boolean(coreResult.confirmed_by_user),
    },
  };
}

module.exports = async function generateV2(req, res) {
  const origin = req.headers.origin;
  setCors(res, origin);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const user = req.user;
  if (!user || !user.uid) {
    return res.status(401).json({ error: 'auth_required' });
  }

  const parsed = sanitizeBody(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const { payload, settings, previewOnly, confirmedByUser, contextOverride, bodyUid } = parsed.value;

  if (bodyUid && bodyUid !== user.uid) {
    return res.status(409).json({ error: 'uid_mismatch' });
  }

  const uid = user.uid;

  try {
    const rl = await rateLimit.check(uid, RATE_LIMIT_PER_MIN);
    if (!rl.ok) {
      return res.status(rl.status || 429).json({
        error: 'Too many requests',
        retry_after_seconds: rl.retryAfterSec || 60,
        limit_per_min: RATE_LIMIT_PER_MIN,
      });
    }

    const budget = await precheck();
    if (!budget.ok && budget.hard) {
      return res.status(429).json({ error: 'Dagbudget bereikt. Probeer later opnieuw.' });
    }

    // === Atomic credits check & spend (BEFORE generate) ===
    const requestId = `gen_${uid}_${Date.now()}`;
    const COST = 1; // credits per generate request
    
    try {
      await db.runTransaction(async (tx) => {
        await spendCreditsTx(tx, db, {
          uid,
          credits: COST,
          reason: 'api_generateV2',
          requestId,
        });
      });
    } catch (spendErr) {
      if (spendErr.code === 422) {
        // Insufficient credits
        return res.status(429).json({
          error: 'Insufficient credits',
          code: 'CREDITS_EXHAUSTED',
          message: 'You need at least 1 credit to generate. Please add credits to continue.',
        });
      }
      throw spendErr; // unexpected error
    }

    // Check remaining credits for response header
    const userSnap = await db.collection('users').doc(uid).get();
    const remaining = userSnap.exists ? (userSnap.data().credits || 0) : 0;
    res.set('x-credits-remaining', String(remaining));

    // === Generate (credits already spent atomically) ===
    const result = await generateFromDumpCore(payload, uid, {
      ...settings,
      previewOnly,
      confirmed_by_user: confirmedByUser,
      context_override: contextOverride,
    });

    if (result?.error) {
      // Note: credits are NOT refunded on generate failure
      // This prevents abuse of failed requests
      return res.status(result.status || 422).json({ error: result.error, validation: result.validation });
    }

    const responseBody = toV2Shape(result);
    return res.status(200).json(responseBody);
  } catch (err) {
    console.error('generateV2 error', err);
    return res.status(500).json({
      error: 'internal_error',
      message: err.message || 'An unexpected error occurred',
    });
  }
};
