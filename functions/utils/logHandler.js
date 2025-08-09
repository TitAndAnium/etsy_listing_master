// functions/logHandler.js
const { db } = require('./firebaseAdmin');
// Firestore db is nu singleton en wijst automatisch naar de emulator in testmodus.

/**
 * Handles logging of events.
 * Always logs to console. Logs to Firestore if uid is 'testuser123'.
 * @param {object} logData - The data to log. Expected to include uid, runId, timestamp, etc.
 */
async function logEvent(logData) {

  // Always log to console for visibility
  console.log('Log Event Received:', JSON.stringify(logData, null, 2));

  if (!logData || typeof logData !== 'object') {
    console.error('Invalid logData received:', logData);
    return;
  }

  // Ensure default values for new flags
  if (typeof logData.soft_refusal_detected === 'undefined') logData.soft_refusal_detected = false;
  if (typeof logData.force_context_applied === 'undefined') logData.force_context_applied = false;

  // Destructure with defaults to prevent ReferenceError
  const {
    uid        = 'unknown',
    runId      = 'manual-run',
    run_id     = '',
    field      = '',
    tokens_in  = 0,
    tokens_out = 0,
    retry_count= 0,
    model      = 'gpt-4o',
    error      = undefined,
    timestamp  = new Date().toISOString(),
    ...rest
  } = logData;

  let logMsg = `[LOG] run_id=${run_id || runId} field=${field}`;
  if (tokens_in) logMsg += ` tokens_in=${tokens_in}`;
  if (tokens_out) logMsg += ` tokens_out=${tokens_out}`;
  if (retry_count) logMsg += ` retry_count=${retry_count}`;
  if (model) logMsg += ` model=${model}`;
  if (uid) logMsg += ` uid=${uid}`;
  if (error) logMsg += ` error=${error}`;
  console.log(logMsg);

  if (!runId) {
    console.error('Missing runId in logData. Cannot log to Firestore without runId.');
    // Optionally, still log to a default/error path in Firestore or just console
    return;
  }

  // Enforce required fields for AI generation logs
  if (field && ['title', 'tags', 'description'].includes(field)) {
    if (!logData.prompt_version) {
      console.warn('⚠️ Missing prompt_version for AI generation log - adding default');
      logData.prompt_version = 'v2.7';
    }
    if (logData.quality_score === undefined || logData.quality_score === null) {
      console.warn('⚠️ Missing quality_score for AI generation log - adding default');
      logData.quality_score = 0;
    }
  }

  // Use the provided timestamp as the document ID, or generate one if missing.
  // Firestore best practices often suggest using auto-generated IDs for new documents
  // to avoid hotspots, but we'll follow the user's specified path structure.
  const docId = timestamp;

  // Log to Firestore only for 'testuser123'
  if (uid === 'testuser123') {
    try {
      const logRef = db.collection('runs').doc(runId).collection('logs').doc(docId);
      // Bescherm tegen valse fallback-vermeldingen
      // ✨ Bescherm tegen valse fallback-vermeldingen
      if (
        logData.fallback_model_used === 'gpt-3.5' &&
        (!logData.retry_reason || logData.retry_reason === 'none')
      ) {
        delete logData.fallback_model_used;
        console.warn('⚠️ fallback_model_used verwijderd uit log: geen echte fallback gedetecteerd.');
      }
      await logRef.set(logData, {merge: true}); // Use merge:true if you might update parts of a log later
      console.log(`Log for uid ${uid} (runId: ${runId}) successfully written to Firestore at logs/${docId}`);
    } catch (error) {
      console.error(`Error writing log to Firestore for uid ${uid} (runId: ${runId}):`, error);
    }
  } else {
    console.log(`Log for uid ${uid} (runId: ${runId}) not written to Firestore (UID is not 'testuser123').`);
  }
}

module.exports = {logEvent};
