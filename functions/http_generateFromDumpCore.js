// functions/http_generateFromDumpCore.js
const { onRequest }        = require("firebase-functions/v2/https");
const { defineSecret }     = require('firebase-functions/params');
const generateFromDumpCore = require("./generateFromDumpCore");
const withAuth            = require("./utils/authMiddleware");

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const SLACK_WEBHOOK_URL = defineSecret('SLACK_WEBHOOK_URL');

// Consistent CORS implementation (matches index.js applyCors)
function applyCors(req, res) {
  const origin = req.get('Origin');
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  
  if (!allowed.length) {
    // Fallback to safe defaults if not configured
    allowed.push('https://etsy-ai-hacker.web.app', 'https://etsy-ai-hacker.firebaseapp.com');
  }

  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (!origin) {
    res.set('Access-Control-Allow-Origin', '*');
    console.log('[CORS] Server-to-server request (no Origin header)');
  } else if (allowed.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
  } else {
    console.warn('[CORS] BLOCKED - Unknown origin:', origin, 'Allowed:', allowed);
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
}

exports.generateFromDumpCore = onRequest(
  { secrets: [OPENAI_API_KEY, SLACK_WEBHOOK_URL] },
  (req, res) => {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return; // preflight already handled
    
    return withAuth(async (req, res) => {
      try {
        const { rawText, runId = Date.now().toString(), maxRetries = 1 } = req.body || {};
        const uid = req.user.uid;

        const result = await generateFromDumpCore(rawText, uid, runId, maxRetries);
        res.status(result.status || 200).json(result);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
      }
    })(req, res);
  }
);
