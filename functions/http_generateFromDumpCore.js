// functions/http_generateFromDumpCore.js
const functions            = require("firebase-functions");
const cors                 = require("cors")({ origin: true });
const generateFromDumpCore = require("./generateFromDumpCore"); // This is correct - it's exported as module.exports

exports.generateFromDumpCore = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { rawText, uid = "testuser123", runId = Date.now().toString(),
              maxRetries = 1 } = req.body || {};
      
      // Warn if non-test UID is used
      if (uid !== 'testuser123') {
        console.warn('⚠️ Non-test UID detected:', uid, '- Firestore logging may be skipped');
      }
      const result = await generateFromDumpCore(rawText, uid, runId, maxRetries);
      res.status(result.status || 200).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });
});
