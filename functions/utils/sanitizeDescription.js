// functions/utils/sanitizeDescription.js
/**
 * Sanitize raw description for buyer-view.
 *  – Verberg labels ::: Overview ::: en ::: Call To Action ::: maar laat inhoud staan.
 *  – Verwijder labelkoppen (:::) voor Features en Shipping blocks maar behoud inhoud.
 *  – Zorg dat CTA-zin (laatste niet-lege regel) behouden blijft.
 * @param {string} desc
 * @returns {string}
 */
function sanitizeForBuyerView(desc = '') {
  if (!desc) return '';
  const lines = desc.split(/\r?\n/);
  const out = [];
  let skipLabel = false;
  let currentLabel = '';
  for (let line of lines) {
    const m = line.match(/^\s*:::\s*(.*?)\s*:::\s*$/i);
    if (m) {
      currentLabel = m[1].toLowerCase();
      if (['overview', 'call to action'].includes(currentLabel)) {
        skipLabel = true; // verberg labelregel zelf
        continue; // sla label over
      }
      if (['features', 'shipping and processing'].includes(currentLabel)) {
        skipLabel = true;
        continue; // label weg, inhoud volgt nog
      }
    }
    if (skipLabel && line.trim() === '') continue; // negeer lege regel direct na label
    out.push(line);
  }
  // Trim lege regels aan begin/eind en dubbele witregels
  const cleaned = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

module.exports = { sanitizeForBuyerView };
