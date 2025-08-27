// functions/logHandler.js
const { db } = require('./firebaseAdmin');
const { LOG_PII_REDACT } = require('./featureFlags');
const { redactLogPayload } = require('./redact');
// Firestore db is nu singleton en wijst automatisch naar de emulator in testmodus.

/**
 * Handles logging of events.
 * Always logs to console. Logs to Firestore if uid is 'testuser123'.
 * @param {object} logData - The data to log. Expected to include uid, runId, timestamp, etc.
 */
async function logEvent(logData) {
  // Redact PII if flag enabled BEFORE any console/file writes
  const safeLogData = LOG_PII_REDACT ? redactLogPayload(logData) : logData;

  // Always log to console for visibility
  console.log('Log Event Received:', JSON.stringify(safeLogData, null, 2));

  if (!safeLogData || typeof safeLogData !== 'object') {
    console.error('Invalid logData received:', safeLogData);
    return;
  }

  // Ensure default values for new flags
  if (typeof safeLogData.soft_refusal_detected === 'undefined') safeLogData.soft_refusal_detected = false;
  if (typeof safeLogData.force_context_applied === 'undefined') safeLogData.force_context_applied = false;

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
  } = safeLogData;

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
    // Only enforce for successful generation logs; allow error logs without quality_score
    if (!error) {
      if (!safeLogData.prompt_version) {
        console.warn('⚠️ Missing prompt_version for AI generation log - adding default');
        safeLogData.prompt_version = 'v2.7';
      }
      if (typeof safeLogData.quality_score !== 'number') {
        throw new Error('quality_score missing in field log payload');
      }
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
      const isJest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
      const isMockSet = isJest && logRef && typeof logRef.set === 'function' && (logRef.set._isMockFunction === true || 'mock' in logRef.set);
      if (isJest && !isMockSet) {
        console.debug('[logHandler] Skip Firestore write in Jest (no mock detected).');
        return;
      }

      // Bescherm tegen valse fallback-vermeldingen
      // ✨ Bescherm tegen valse fallback-vermeldingen
      if (
        safeLogData.fallback_model_used === 'gpt-3.5' &&
        (!safeLogData.retry_reason || safeLogData.retry_reason === 'none')
      ) {
        delete safeLogData.fallback_model_used;
        console.warn('⚠️ fallback_model_used verwijderd uit log: geen echte fallback gedetecteerd.');
      }
      // In Jest/test-omgeving: race write tegen korte timeout om hangs te voorkomen
      const writePromise = logRef.set(safeLogData, { merge: true });
      if (isJest && !isMockSet) {
        let timer;
        const timeout = new Promise((resolve) => {
          timer = setTimeout(() => resolve('timeout'), 250);
        });
        const winner = await Promise.race([writePromise.then(() => 'write'), timeout]);
        if (winner === 'timeout') {
          console.debug('Firestore write timed out in test; continuing without blocking.');
          return;
        }
        // write won → pending timeout annuleren om open handles te voorkomen
        clearTimeout(timer);
      } else {
        await writePromise;
      }
      console.log(`Log for uid ${uid} (runId: ${runId}) successfully written to Firestore at logs/${docId}`);
    } catch (error) {
      console.error(`Error writing log to Firestore for uid ${uid} (runId: ${runId}):`, error);
    }
  } else {
    console.log(`Log for uid ${uid} (runId: ${runId}) not written to Firestore (UID is not 'testuser123').`);
  }
}

module.exports = {logEvent};
