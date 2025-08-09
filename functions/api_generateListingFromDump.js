// api_generateListingFromDump.js
// Entry-point voor OneBox Mode – ontvangt dump, retourneert Etsy listing JSON

const generateFromDumpCore = require("./generateFromDumpCore");

module.exports = async function (req, res) {
  try {
    // Gebruik 'text' als veldnaam, zoals in je Hoppscotch-body
    if (!req.is('application/json')) {
      res.status(400).send({
        error: 'Invalid content type. Expecting application/json.'
      });
      return;
    }

    const { text, allow_handmade, gift_mode } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Invalid or empty input." });
    }

    // Pass additional options to core function
    const options = {
      allow_handmade: allow_handmade || false,
      gift_mode: gift_mode || false
    };

    const result = await generateFromDumpCore(text, "testuser123", options);

    // Handle error responses
    if (result.error) {
      return res.status(result.status || 500).json({ error: result.error, validation: result.validation });
    }

    // Return successful result with fields and validation info
    return res.status(200).json({ 
      fields: result.fields, 
      validation: result.validation 
    });

  } catch (e) {
    return res.status(500).json({
      error: e.message || "Something went wrong",
      ...(e.rawResponse ? { rawResponse: e.rawResponse } : {})
    });
  }
};
