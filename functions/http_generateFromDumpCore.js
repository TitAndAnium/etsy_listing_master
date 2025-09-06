// functions/http_generateFromDumpCore.js
const functions            = require("firebase-functions");
const cors                 = require("cors")({ origin: true });
const generateFromDumpCore = require("./generateFromDumpCore"); // This is correct - it's exported as module.exports
const withAuth            = require("./utils/authMiddleware");

exports.generateFromDumpCore = functions.https.onRequest(withAuth(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { rawText, runId = Date.now().toString(), maxRetries = 1 } = req.body || {};

      // uid is now taken strictly from auth middleware for security
      const uid = req.user.uid;

      const result = await generateFromDumpCore(rawText, uid, runId, maxRetries);
      res.status(result.status || 200).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });
}));
