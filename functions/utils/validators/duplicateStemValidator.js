// functions/utils/validators/duplicateStemValidator.js
// Detects tags with similar stems to prevent tag waste

/**
 * Simple stemming function - removes common suffixes
 * @param {string} word - Word to stem
 * @returns {string} - Stemmed word
 */
function simpleStem(word) {
  if (!word || typeof word !== 'string') return '';
  
  const lowered = word.toLowerCase().trim();
  
  // Remove common plural/verb suffixes
  const suffixes = ['ing', 'ed', 'er', 'est', 'ly', 'tion', 'sion', 'ness', 'ment', 'ful', 'less', 'able', 'ible', 's'];
  
  for (const suffix of suffixes) {
    if (lowered.endsWith(suffix) && lowered.length > suffix.length + 2) {
      return lowered.slice(0, -suffix.length);
    }
  }
  
  return lowered;
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(a, b) {
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
  
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Check if two tags are similar (stem-based or fuzzy match)
 * @param {string} tag1 - First tag
 * @param {string} tag2 - Second tag
 * @returns {object} - {isSimilar: boolean, reason: string, similarity: number}
 */
function areTagsSimilar(tag1, tag2) {
  if (!tag1 || !tag2 || tag1 === tag2) {
    return { isSimilar: tag1 === tag2 && tag1 !== '', reason: 'exact_match', similarity: tag1 === tag2 ? 1.0 : 0.0 };
  }
  
  const stem1 = simpleStem(tag1);
  const stem2 = simpleStem(tag2);
  
  // Exact stem match
  if (stem1 === stem2 && stem1.length > 2) {
    return { isSimilar: true, reason: 'stem_match', similarity: 1.0 };
  }
  
  // Fuzzy matching for short tags or similar stems
  const maxLen = Math.max(tag1.length, tag2.length);
  const distance = levenshteinDistance(tag1.toLowerCase(), tag2.toLowerCase());
  const similarity = 1 - (distance / maxLen);
  
  // Consider similar if >80% similarity and at least 4 chars
  if (similarity > 0.8 && maxLen >= 4) {
    return { isSimilar: true, reason: 'fuzzy_match', similarity };
  }
  
  return { isSimilar: false, reason: 'different', similarity };
}

/**
 * Find duplicate or similar tags in a tag array
 * @param {string[]} tags - Array of tags to check
 * @returns {object[]} - Array of warnings for similar tags
 */
function findDuplicateStems(tags) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return [];
  }
  
  const warnings = [];
  const checked = new Set();
  
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      const pairKey = `${Math.min(i, j)}-${Math.max(i, j)}`;
      if (checked.has(pairKey)) continue;
      
      const similarity = areTagsSimilar(tags[i], tags[j]);
      if (similarity.isSimilar) {
        warnings.push({
          type: 'duplicate_stem',
          severity: similarity.reason === 'exact_match' ? 'high' : 'medium',
          message: `Similar tags detected: "${tags[i]}" and "${tags[j]}"`,
          tags: [tags[i], tags[j]],
          reason: similarity.reason,
          similarity: similarity.similarity,
          suggestion: `Consider consolidating to one tag or use more specific variants`
        });
        checked.add(pairKey);
      }
    }
  }
  
  return warnings;
}

module.exports = {
  findDuplicateStems,
  areTagsSimilar,
  simpleStem,
  levenshteinDistance
};
