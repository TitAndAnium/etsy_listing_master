# Deliverable 4: Validator-upgrade v4 Specification

## Overview
Upgrade validation logic to catch common Etsy listing issues and implement soft-fail mechanisms with comprehensive logging.

## Requirements

### 1. Duplicate-stem Tag Check
- **Purpose**: Detect tags with similar stems (e.g. "ring", "rings", "jewelry ring")
- **Implementation**: Stemming algorithm or fuzzy matching
- **Action**: Flag duplicates, suggest consolidation
- **Priority**: High - reduces tag waste

### 2. Layer-count Check
- **Purpose**: Validate tri-layer tag structure (5 SEO / 4 occasion / 2 audience / 2 attribute)
- **Implementation**: Count tags per category based on classification rules
- **Action**: Warn if layer distribution is off-balance
- **Priority**: Medium - ensures tag strategy consistency

### 3. Title-template RegExp Check
- **Purpose**: Validate title follows expected pattern (merk/stijl + gift-hook)
- **Implementation**: Regular expression matching against template patterns
- **Action**: Flag titles that don't match expected structure
- **Priority**: Medium - ensures title consistency

### 4. Soft-fail Mechanism
- **Purpose**: Log validation issues without blocking generation
- **Implementation**: Collect validation warnings, continue processing
- **Action**: Return warnings in response, log to Firestore
- **Priority**: High - maintains user experience while improving quality

## KPI Target
- **Soft-fail-rate ≤ 20%**: Maximum 20% of listings should trigger validation warnings
- **Latency impact**: Validation should add ≤ 50ms to total processing time
- **Coverage**: All three validation types should be tested and logged

## Implementation Plan
1. Create validation utilities in `functions/utils/validators/`
2. Integrate validators into `generateFromDumpCore.js` pipeline
3. Add validation logging to Firestore with compound indexes
4. Create comprehensive Jest test suite (30+ test cases)
5. Update documentation and audit logs

## Test Cases Required
- Duplicate tag scenarios (exact, stem-based, fuzzy matches)
- Layer imbalance scenarios (too many SEO, missing audience tags)
- Title pattern violations (missing gift-hook, wrong structure)
- Edge cases (empty inputs, malformed data)
- Performance benchmarks (latency measurements)

## Success Criteria
- [ ] All validators implemented and tested
- [ ] Soft-fail rate measured and ≤ 20% on test dataset
- [ ] Jest test suite with ≥ 90% coverage
- [ ] Firestore logging integrated with proper indexes
- [ ] Documentation updated with validation rules and examples

---

**Status**: Draft - awaiting implementation
**Created**: 2025-07-23
**Next**: Implement validator utilities and test framework
