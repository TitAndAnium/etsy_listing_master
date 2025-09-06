// functions/api_generateListingFromDump.js – single, mock-friendly handler
const generateFromDumpCore = require("./generateFromDumpCore");

/**
 * Converts an Etsy dump to a structured listing.
 * In CI/mock mode we return a deterministic payload.
 */
module.exports = async function api_generateListingFromDump(req, res) {
  try {
    // CORS & method guard
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    // Ensure JSON body
    const body = req.body && typeof req.body === "object" ? req.body : null;
    if (!body) return res.status(400).json({ error: "Invalid JSON body" });

    const IS_MOCK =
      process.env.CI === "true" ||
      process.env.MOCK_LLM === "1" ||
      (process.env.OPENAI_API_KEY || "").toLowerCase() === "dummy";

    /* ---------- MOCK ---------- */
    if (IS_MOCK) {
      return res.status(200).json({
        fields: {
          title: "Handmade Silver Ring - Perfect Gift for Mom",
          tags: [
            "handmade","silver","ring","gift","mom","birthday","anniversary",
            "jewelry","personalized","unique","artisan","crafted","timeless"
          ],
          description:
            "Beautiful handmade silver ring, perfect as a thoughtful gift for mom...",
          allow_handmade: true
        },
        validation: {
          validation_status: "passed",
          is_soft_fail: true,
          metrics: {
            totalWarnings: 2,
            highSeverityWarnings: 0,
            mediumSeverityWarnings: 1,
            lowSeverityWarnings: 1,
            processingTimeMs: 1
          },
          warning_summary: { total: 2, high: 0, medium: 1, low: 1 },
          validator_results: {
            duplicateStems: { passed: true, warningCount: 0, issues: [] },
            layerCount:     { passed: true, warningCount: 0 },
            titleTemplate:  { passed: true, warningCount: 0 },
            consistency:    { passed: true, warningCount: 0 }
          }
        }
      });
    }
    /* ---------- REAL ---------- */

    const { text = "", allow_handmade = false, gift_mode = false } = body;
    if (!text.trim()) return res.status(400).json({ error: "Invalid or empty input." });

    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    const result = await generateFromDumpCore(text, uid, { allow_handmade, gift_mode });

    if (result?.error) {
      return res
        .status(result.status || 422)
        .json({ error: result.error, validation: result.validation });
    }

    return res.status(200).json({ fields: result.fields, validation: result.validation });
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.toLowerCase().includes("validation")) return res.status(422).json({ error: msg });
    console.error("api_generateListingFromDump error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
};
