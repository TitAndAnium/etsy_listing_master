// functions/utils/redact.js
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)*\d{3}[-.\s]?\d{3,4}\b/g;
const ADDRESS = /\b\d{1,5}\s+[A-Za-z0-9.\- ]{3,}\b/g; // simple heuristic

function redactValue(v) {
  return typeof v === 'string'
    ? v.replace(EMAIL, '[redacted_email]')
        .replace(PHONE, '[redacted_phone]')
        .replace(ADDRESS, '[redacted_addr]')
    : v;
}

function redactLogPayload(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactLogPayload);
  const out = {};
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    out[k] = (val && typeof val === 'object') ? redactLogPayload(val) : redactValue(val);
  }
  return out;
}

module.exports = { redactLogPayload };
