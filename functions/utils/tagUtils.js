// functions/utils/tagUtils.js

/**
 * Deduplicate tags based on a simple stem (lowercase, non-alphanumeric removed, optional trailing "s" stripped).
 * @param {string[]} tags - original tags array
 * @returns {string[]} deduplicated tags (order preserved, first occurrence kept)
 */
function dedupeTagsByStem(tags = []) {
  const seen = new Set();
  const out = [];
  const stem = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/s$/, '');
  for (const tag of tags) {
    const key = stem(tag);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(tag);
    }
  }
  return out;
}

module.exports = { dedupeTagsByStem };
