// functions/utils/featureFlags.js
module.exports = {
  STUB_LLM: process.env.STUB_LLM === '1',
  VALIDATOR_STRICT: process.env.VALIDATOR_STRICT === '1',
  LOG_PII_REDACT: process.env.LOG_PII_REDACT !== '0', // default ON
  RUN_SUMMARY_ENABLE: process.env.RUN_SUMMARY_ENABLE !== '0'
};
