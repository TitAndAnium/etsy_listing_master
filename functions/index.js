/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const functions = require("firebase-functions");
const cors = require('cors')({ origin: true });
const api_generateListingFromDump = require("./api_generateListingFromDump");
const api_generateChainingFromFields = require("./api_generateChainingFromFields");
const generateFromDumpCore = require("./generateFromDumpCore");

exports.api_generateListingFromDump = functions.https.onRequest((req, res) => {
  cors(req, res, () => api_generateListingFromDump(req, res));
});

exports.api_generateChainingFromFields = functions.https.onRequest((req, res) => {
  cors(req, res, () => api_generateChainingFromFields(req, res));
});

exports.generateFromDumpCore = require('./http_generateFromDumpCore').generateFromDumpCore;
