// functions/utils/runSummary.js
let admin = null;
try {
  // Optional dependency: in unit tests firebaseAdmin may be absent
  admin = require('../firebaseAdmin');
} catch (e) {
  console.debug('[runSummary] firebaseAdmin not found; Firestore write disabled in this environment');
}

const { logEvent } = require('./logHandler');

// Simple price matrix (USD per 1K tokens)
const PRICE_PER_1K = {
  'gpt-4o': 0.01,
  'validator-v4': 0
};

function estimateCost(model, tokensIn = 0, tokensOut = 0) {
  const price = PRICE_PER_1K[model] || 0;
  return ((tokensIn + tokensOut) / 1000) * price;
}

async function writeRunSummary({
  runId,
  uid,
  tokensInTotal,
  tokensOutTotal,
  qualityScore,
  startedAt,
  modelsUsed,
  warnings
}) {
  const finishedAt = Date.now();
  const latencyMs = finishedAt - startedAt;
  const costUsd = Object.entries(modelsUsed).reduce((sum, [model, t]) => sum + estimateCost(model, t.in, t.out), 0);

  const summary = {
    uid,
    started_at: new Date(startedAt).toISOString(),
    finished_at: new Date(finishedAt).toISOString(),
    latency_ms: latencyMs,
    total_tokens_in: tokensInTotal,
    total_tokens_out: tokensOutTotal,
    quality_score: qualityScore,
    cost_estimate_usd: Number(costUsd.toFixed(4)),
    warnings_total: warnings.length,
    run_id: runId
  };

  // write to Firestore (if uid === testuser123 or in prod)
  try {
    if (!admin) throw new Error('firebaseAdmin unavailable');
    const db = admin.firestore();
    const docRef = db.collection('runs').doc(runId);
    await docRef.set(summary, { merge: true });
  } catch (e) {
    console.debug('[runSummary] Skip Firestore write (likely Jest) –', e.message);
  }

  // Also log via existing logEvent util for consistency
  await logEvent({
    run_id: runId,
    field: 'run_summary',
    uid,
    tokens_in: tokensInTotal,
    tokens_out: tokensOutTotal,
    quality_score: qualityScore,
    latency_ms: latencyMs,
    cost_estimate_usd: summary.cost_estimate_usd
  });

  return summary;
}

module.exports = { writeRunSummary, estimateCost };
