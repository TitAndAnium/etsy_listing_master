'use strict';

/**
 * reviewEditV2.js - Review user-edits endpoint voor v2
 * 
 * Logica: Accepteert user-edit van één veld en logt/analyseert de wijziging
 * voor toekomstige model-tuning / analytics.
 * 
 * Status: Placeholder/stub - volledige implementatie vereist:
 * - Firestore logging van edits (user_edits collectie)
 * - Optionele quality-score vergelijking (voor A/B testing)
 * - Geen credits cost (gratis endpoint)
 */

function setCors(res, origin) {
  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
  } else {
    res.set('Access-Control-Allow-Origin', '*');
  }
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Cache-Control', 'no-store');
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') {
    return { error: 'invalid_json_body' };
  }

  const { field, user_edits } = body;

  if (!field || !['title', 'description', 'tags'].includes(field)) {
    return { error: 'invalid_field' };
  }

  if (!user_edits || typeof user_edits !== 'object' || !user_edits.before || !user_edits.after) {
    return { error: 'invalid_user_edits', message: 'user_edits must have before and after' };
  }

  return {
    value: {
      field,
      user_edits,
    }
  };
}

module.exports = async function reviewEditV2(req, res) {
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

  const { field, user_edits } = parsed.value;
  const uid = user.uid;

  try {
    // TODO: Log naar Firestore collectie user_edits/{uid}/{editId}
    // - field, before, after, timestamp, uid
    // - Optioneel: diff analysis, quality score

    console.log(`[reviewEditV2] uid=${uid} field=${field}`, { before: user_edits.before, after: user_edits.after });

    // Placeholder: geen echte Firestore write
    return res.status(200).json({
      success: true,
      message: 'Edit logged (stub implementation)',
    });
  } catch (err) {
    console.error('reviewEditV2 error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
};
