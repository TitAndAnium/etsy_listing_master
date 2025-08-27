// functions/utils/validators/failPolicy.js
// Central table defining which validator issues are HARD (block), SOFT (warn), or IGNORE.

/**
 * Map warning type and validator to action.
 * key: `${validator}:${issueType}` or `${validator}:*` for all.
 */
const FAIL_ACTIONS = {
  // Title template hard rules
  'titleTemplateValidator:missing_title': 'HARD',
  'titleTemplateValidator:length_over': 'HARD',
  'titleTemplateValidator:pattern_mismatch': 'HARD',
  // Tag duplicate stems is soft (auto-fix soon)
  'duplicateStemValidator:*': 'SOFT',
  // Layer count over/under is SOFT (warn)
  'layerCountValidator:*': 'SOFT',
  // Validation system errors are hard
  'validation_error:*': 'HARD'
};

function getFailAction(warning) {
  const keySpecific = `${warning.validator || warning.type}:${warning.code || warning.issue || warning.reason || '*'}`;
  if (FAIL_ACTIONS[keySpecific]) return FAIL_ACTIONS[keySpecific];
  const keyWildcard = `${warning.validator || warning.type}:*`;
  return FAIL_ACTIONS[keyWildcard] || 'SOFT';
}

module.exports = { getFailAction };
