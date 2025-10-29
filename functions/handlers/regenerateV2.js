'use strict';

/**
 * regenerateV2.js - Per-veld regeneratie endpoint voor v2
 * 
 * Logica: Hergenereert één specifiek veld (title/description/tags) 
 * op basis van de context (bestaande AI-velden + user-edits + targeting).
 */

const rateLimit = require('../utils/rateLimit');
const { spendCreditsTx } = require('../utils/wallet');
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

  const { field, context } = body;

  if (!field || !['title', 'description', 'tags'].includes(field)) {
    return { error: 'invalid_field', message: 'field must be title, description, or tags' };
  }

  if (!context || typeof context !== 'object' || !context.ai_fields) {
    return { error: 'missing_context', message: 'context.ai_fields required' };
  }

  return {
    value: {
      field,
      context,
    }
  };
}

module.exports = async function regenerateV2(req, res) {
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
    return res.status(400).json({ error: parsed.error, message: parsed.message });
  }

  const { field, context } = parsed.value;
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

    // === Atomic credits check & spend (BEFORE regenerate) ===
    const COST = 0.5; // credits per regenerate request
    const requestId = `regen_${field}_${uid}_${Date.now()}`;
    
    try {
      await db.runTransaction(async (tx) => {
        await spendCreditsTx(tx, db, {
          uid,
          credits: COST,
          reason: `api_regenerateField_${field}`,
          requestId,
        });
      });
    } catch (spendErr) {
      if (spendErr.code === 422) {
        return res.status(429).json({
          error: 'Insufficient credits',
          code: 'CREDITS_EXHAUSTED',
          credits_required: COST,
        });
      }
      throw spendErr;
    }

    // Check remaining credits for response header
    const userSnap = await db.collection('users').doc(uid).get();
    const remaining = userSnap.exists ? (userSnap.data().credits || 0) : 0;
    res.set('x-credits-remaining', String(remaining));

    // Implementeer regeneratie logica
    const mergedContext = {
      ...context.ai_fields,
      ...(context.user_edits || {}),
      audience: context.audience,
      age_bracket: context.age_bracket,
      tone_profile: context.tone_profile,
      gift_mode: context.gift_mode,
    };

    let payload;
    let tokenUsage = {};

    try {
      // Use OpenAI voor field regeneration
      const { regenerateField } = require('../utils/fieldRegenerator');
      const result = await regenerateField(field, mergedContext, uid);
      
      payload = result.payload;
      tokenUsage = result.tokenUsage || {};
    } catch (genErr) {
      console.error(`regenerateV2 field generation error for ${field}`, genErr);
      // Fallback naar basis-response bij OpenAI failure
      payload = field === 'tags'
        ? { items: ['fallback', 'tag'], retry_reason: 'generation_error', warnings: ['OpenAI call failed'] }
        : { value: `Regenerated ${field} (fallback)`, retry_reason: 'generation_error', warnings: ['OpenAI call failed'] };
    }

    // Credits already spent atomically above

    return res.status(200).json({
      field,
      payload,
      meta: {
        prompt_version: 'regenerate_v1',
        model: 'gpt-4',
        token_usage: tokenUsage,
        context_used: mergedContext,
      },
    });
  } catch (err) {
    console.error('regenerateV2 error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
};
