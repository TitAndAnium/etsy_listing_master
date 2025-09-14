'use strict';

// Simple in-memory per-UID per-minute limiter. In tests/local dev geen externe store nodig.
// API: await check(uid, limitPerMinute) -> { ok:true, remaining } | { ok:false, status:429, retryAfterSec }
// Kan later vervangen worden door Redis/Firestore zonder callsites te wijzigen.

const IS_TEST = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;

const mem = Object.create(null); // { uid: { key, count } }

function minuteKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${y}${m}${d}${hh}${mm}`;
}

function secondsUntilNextMinute(date = new Date()) {
  return 60 - date.getUTCSeconds();
}

async function check(uid, limitPerMinute = 12) {
  if (!uid) {
    return { ok: false, status: 401, message: 'unauthorized' };
  }
  const key = minuteKey();
  let bucket = mem[uid];
  if (!bucket || bucket.key !== key) {
    bucket = mem[uid] = { key, count: 0 };
  }
  if (bucket.count >= limitPerMinute) {
    return { ok: false, status: 429, retryAfterSec: secondsUntilNextMinute(), bucketKey: key };
  }
  bucket.count += 1;
  return { ok: true, remaining: limitPerMinute - bucket.count, bucketKey: key };
}

function _resetTestState() {
  if (IS_TEST) {
    for (const k of Object.keys(mem)) delete mem[k];
  }
}
function _getState() { return mem; }

module.exports = { check, _resetTestState, _getState };
