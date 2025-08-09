// functions/utils/validators/validatorCoordinator.js
// Coordinates all validators and implements soft-fail mechanism

const { findDuplicateStems } = require('./duplicateStemValidator');
const { validateLayerCount } = require('./layerCountValidator');
const { validateTitleTemplate } = require('./titleTemplateValidator');

/**
 * Run all validators on generated output and collect warnings
 * Implements soft-fail mechanism - collect issues but don't block generation
 * @param {object} output - Generated output with title, tags, description, etc.
 * @param {object} context - Additional context (gift_mode, audience, etc.)
 * @returns {object} - Validation result with warnings array
 */
function runAllValidators(output, context = {}) {
  const startTime = process.hrtime.bigint(); // Use high-resolution timer
  const warnings = [];
  const validationResults = {};
  
  try {
    // 1. Validate tags for duplicate stems
    if (output.tags && Array.isArray(output.tags)) {
      const duplicateWarnings = findDuplicateStems(output.tags);
      warnings.push(...duplicateWarnings);
      validationResults.duplicateStems = {
        passed: duplicateWarnings.length === 0,
        warningCount: duplicateWarnings.length,
        issues: duplicateWarnings.map(w => w.reason)
      };
    } else {
      warnings.push({
        type: 'validation_error',
        severity: 'medium',
        message: 'Tags not provided or not in array format',
        validator: 'duplicateStemValidator'
      });
      validationResults.duplicateStems = { passed: false, warningCount: 1, issues: ['missing_tags'] };
    }
    
    // 2. Validate tag layer distribution
    if (output.tags && Array.isArray(output.tags)) {
      const layerValidation = validateLayerCount(output.tags);
      warnings.push(...layerValidation.warnings);
      validationResults.layerCount = {
        passed: layerValidation.isValid,
        warningCount: layerValidation.warnings.length,
        distribution: layerValidation.counts,
        totalTags: layerValidation.totalTags
      };
    } else {
      validationResults.layerCount = { passed: false, warningCount: 1, issues: ['missing_tags'] };
    }
    
    // 3. Validate title template
    if (output.title && typeof output.title === 'string') {
      const titleValidation = validateTitleTemplate(output.title, context);
      warnings.push(...titleValidation.warnings);
      validationResults.titleTemplate = {
        passed: titleValidation.isValid,
        warningCount: titleValidation.warnings.length,
        length: titleValidation.length,
        matchesPattern: titleValidation.matchesPattern
      };
    } else {
      warnings.push({
        type: 'validation_error',
        severity: 'high',
        message: 'Title not provided or not a string',
        validator: 'titleTemplateValidator'
      });
      validationResults.titleTemplate = { passed: false, warningCount: 1, issues: ['missing_title'] };
    }
    
    // 4. Cross-validator consistency checks
    const consistencyWarnings = validateCrossFieldConsistency(output, context);
    warnings.push(...consistencyWarnings);
    validationResults.consistency = {
      passed: consistencyWarnings.length === 0,
      warningCount: consistencyWarnings.length
    };
    
  } catch (error) {
    warnings.push({
      type: 'validation_error',
      severity: 'high',
      message: `Validator error: ${error.message}`,
      error: error.stack,
      validator: 'validatorCoordinator'
    });
  }
  
  const endTime = process.hrtime.bigint();
  const processingTime = Math.max(Number(endTime - startTime) / 1000000, 1); // Convert nanoseconds to milliseconds, min 1ms
  
  // Calculate soft-fail metrics
  const totalWarnings = warnings.length;
  const highSeverityWarnings = warnings.filter(w => w.severity === 'high').length;
  const mediumSeverityWarnings = warnings.filter(w => w.severity === 'medium').length;
  
  // Determine if this counts as a "soft-fail"
  // Soft-fail = has warnings but no high severity (generation continues with warnings)
  const isSoftFail = warnings.length > 0 && !warnings.some(w => w.severity === 'high');
  
  return {
    isValid: highSeverityWarnings === 0, // Only block on high severity
    isSoftFail,
    warnings,
    validationResults,
    metrics: {
      totalWarnings,
      highSeverityWarnings,
      mediumSeverityWarnings,
      lowSeverityWarnings: warnings.filter(w => w.severity === 'low').length,
      processingTimeMs: processingTime
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Validate consistency across different fields
 * @param {object} output - Generated output
 * @param {object} context - Context information
 * @returns {array} - Array of consistency warnings
 */
function validateCrossFieldConsistency(output, context) {
  const warnings = [];
  
  try {
    // Check if title and tags are consistent
    if (output.title && output.tags && Array.isArray(output.tags)) {
      const titleWords = output.title.toLowerCase().split(/\s+/);
      const tagWords = output.tags.map(tag => tag.toLowerCase());
      
      // Check if main product type appears in both title and tags
      const productTypes = ['ring', 'necklace', 'bracelet', 'earrings', 'pendant', 'jewelry'];
      const titleProductType = productTypes.find(type => titleWords.some(word => word.includes(type)));
      const tagProductType = productTypes.find(type => tagWords.some(tag => tag.includes(type)));
      
      if (titleProductType && tagProductType && titleProductType !== tagProductType) {
        warnings.push({
          type: 'consistency',
          severity: 'medium',
          message: `Product type mismatch between title (${titleProductType}) and tags (${tagProductType})`,
          titleType: titleProductType,
          tagType: tagProductType,
          suggestion: 'Ensure title and tags reference the same product type'
        });
      }
    }
    
    // Check gift mode consistency
    if (context.gift_mode === true) {
      const giftWords = ['gift', 'present', 'for'];
      
      // Title should have gift language
      if (output.title) {
        const hasGiftInTitle = giftWords.some(word => 
          output.title.toLowerCase().includes(word)
        );
        
        if (!hasGiftInTitle) {
          warnings.push({
            type: 'consistency',
            severity: 'medium',
            message: 'Gift mode enabled but title lacks gift-focused language',
            suggestion: 'Add gift-related words to title when gift_mode is true'
          });
        }
      }
      
      // Tags should have gift/occasion tags
      if (output.tags && Array.isArray(output.tags)) {
        const hasGiftTags = output.tags.some(tag => 
          giftWords.some(word => tag.toLowerCase().includes(word))
        );
        
        if (!hasGiftTags) {
          warnings.push({
            type: 'consistency',
            severity: 'low',
            message: 'Gift mode enabled but tags lack gift/occasion focus',
            suggestion: 'Include gift or occasion-related tags when gift_mode is true'
          });
        }
      }
    }
    
    // Check audience consistency
    if (context.audience && Array.isArray(context.audience) && context.audience.length > 0) {
      const audienceTokens = context.audience.map(token => token.toLowerCase());
      
      // Check if audience is reflected in title or tags
      const titleHasAudience = output.title && audienceTokens.some(token => 
        output.title.toLowerCase().includes(token)
      );
      
      const tagsHaveAudience = output.tags && Array.isArray(output.tags) && 
        audienceTokens.some(token => 
          output.tags.some(tag => tag.toLowerCase().includes(token))
        );
      
      if (!titleHasAudience && !tagsHaveAudience) {
        warnings.push({
          type: 'consistency',
          severity: 'low',
          message: `Audience context (${context.audience.join(', ')}) not reflected in title or tags`,
          audience: context.audience,
          suggestion: 'Consider incorporating audience references for better targeting'
        });
      }
    }
    
  } catch (error) {
    warnings.push({
      type: 'consistency',
      severity: 'low',
      message: `Consistency check error: ${error.message}`,
      error: error.stack
    });
  }
  
  return warnings;
}

/**
 * Format validation warnings for logging
 * @param {object} validationResult - Result from runAllValidators
 * @returns {object} - Formatted log entry
 */
function formatValidationLog(validationResult, runId, uid) {
  return {
    run_id: runId,
    uid: uid,
    timestamp: validationResult.timestamp,
    validation_status: validationResult.isValid ? 'passed' : 'failed',
    is_soft_fail: validationResult.isSoftFail,
    metrics: validationResult.metrics,
    warning_summary: {
      total: validationResult.metrics.totalWarnings,
      high: validationResult.metrics.highSeverityWarnings,
      medium: validationResult.metrics.mediumSeverityWarnings,
      low: validationResult.metrics.lowSeverityWarnings
    },
    validator_results: validationResult.validationResults,
    warnings: validationResult.warnings.map(warning => ({
      type: warning.type,
      severity: warning.severity,
      message: warning.message,
      validator: warning.validator || 'unknown'
    }))
  };
}

/**
 * Calculate soft-fail rate from validation logs
 * @param {array} validationLogs - Array of validation log entries
 * @returns {object} - Soft-fail rate metrics
 */
function calculateSoftFailRate(validationLogs) {
  if (!Array.isArray(validationLogs) || validationLogs.length === 0) {
    return { rate: 0, total: 0, softFails: 0 };
  }
  
  const softFails = validationLogs.filter(log => log.is_soft_fail).length;
  const total = validationLogs.length;
  const rate = total > 0 ? (softFails / total) * 100 : 0;
  
  return {
    rate: Math.round(rate * 100) / 100, // Round to 2 decimal places
    total,
    softFails,
    hardFails: validationLogs.filter(log => !log.validation_status === 'passed').length,
    passRate: Math.round(((total - softFails) / total) * 10000) / 100
  };
}

module.exports = {
  runAllValidators,
  validateCrossFieldConsistency,
  formatValidationLog,
  calculateSoftFailRate
};
