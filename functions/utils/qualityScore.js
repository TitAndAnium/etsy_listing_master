// functions/utils/qualityScore.js

/**
 * Compute a quality score given validation results.
 * Currently mirrors the existing calculation (0-100) used in generateFromDumpCore.js
 * to avoid any behavioral changes during QS-2 refactor.
 *
 * Params shape allows future extension (field/output/ai_fields),
 * but only `validation` is used for now to keep parity.
 *
 * @param {Object} params
 * @param {string} [params.field]
 * @param {*} [params.output]
 * @param {Object} [params.validation]
 * @param {Object} [params.ai_fields]
 * @returns {number} quality_score in range [0, 100]
 */
function computeQualityScore({ field, output, validation, ai_fields } = {}) {
  if (!validation || !Array.isArray(validation.warnings)) {
    return 100; // Perfect score if no validation data
  }

  const warnings = validation.warnings;
  let deductions = 0;

  for (const warning of warnings) {
    switch (warning.severity) {
      case 'high':
        deductions += 20;
        break;
      case 'medium':
        deductions += 10;
        break;
      case 'low':
        deductions += 5;
        break;
      default:
        deductions += 5;
        break;
    }
  }

  return Math.max(0, 100 - deductions);
}

module.exports = { computeQualityScore };
