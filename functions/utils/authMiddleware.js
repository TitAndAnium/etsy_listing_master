// NEW FILE: functions/utils/authMiddleware.js
const admin = require('firebase-admin');

// Ensure Admin SDK is initialized exactly once
try { admin.app(); } catch (_) { admin.initializeApp(); }

/**
 * Higher-order function that enforces Firebase ID-token auth on HTTPS functions.
 * Usage: exports.myFn = functions.https.onRequest(withAuth(handler))
 */
module.exports = function withAuth(handler) {
  return async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        return handler(req, res);
      }
      const authHeader = req.headers.authorization || '';
      const match = authHeader.match(/^Bearer\s+(.*)$/i);
      if (!match) return res.status(401).json({ error: 'Missing Authorization Bearer token' });

      const idToken = match[1];
      const decoded = await admin.auth().verifyIdToken(idToken);
      req.user = { uid: decoded.uid };

      return handler(req, res);
    } catch (err) {
      console.error('[withAuth] verifyIdToken failed', err);
      return res.status(401).json({ error: 'Invalid ID token' });
    }
  };
};
