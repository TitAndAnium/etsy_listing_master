// utils/cleanEtsyDump.js

/**
 * Filtert een ruwe Etsy listing-dump en houdt alleen de betekenisvolle content over.
 * Houdt rekening met de meest voorkomende sectienamen en veldlabels.
 *
 * @param {string} raw - De ruwe dump van Etsy (zoals gekopieerd uit de UI)
 * @return {string} - Een opgeschoonde string met alleen relevante velden
 */
module.exports = function cleanEtsyDump(raw) {
  if (!raw || typeof raw !== 'string') return '';

  const keepSections = [
    'Title',
    'Description',
    'Features',
    'Tags',
    'Materials',
    'Category',
    'Personalization',
    'Price',
    'Quantity',
    'SKU',
    'Variations',
    'Details',
    'Shipping and Processing',
    'Available Sizes',
    'Care Instructions',
  ];

  const lines = raw.split('\n');
  const filteredLines = lines.filter((line) => {
    const lower = line.toLowerCase();
    return (
      keepSections.some((section) => lower.includes(section.toLowerCase())) &&
      !lower.includes('edit') &&
      !lower.includes('upload') &&
      !lower.includes('remove') &&
      !lower.includes('view on etsy') &&
      !lower.includes('opens a new tab') &&
      !lower.includes('change') &&
      !lower.includes('add up to') &&
      !lower.includes('show all attributes') &&
      !lower.includes('type to search') &&
      !lower.includes('feature this listing') &&
      !lower.includes('automatic') &&
      !lower.includes('manual')
    );
  });

  // Debug logging
  try {
    console.debug('[cleanEtsyDump] Regels in raw dump:', lines.length);
    console.debug('[cleanEtsyDump] Regels na filtering:', filteredLines.length);
    console.debug('[cleanEtsyDump] Eerste 3 regels raw:', lines.slice(0, 3));
    console.debug('[cleanEtsyDump] Eerste 3 regels cleaned:', filteredLines.slice(0, 3));
  } catch (e) {
    // fallback als console.debug niet beschikbaar is
    console.log('[cleanEtsyDump] Debugging mislukt:', e.message);
  }

  const cleaned = filteredLines.join('\n').trim();
  if (!cleaned) {
    console.debug('[cleanEtsyDump] Geen secties herkend. Gebruik originele input als fallback.');
    return raw.trim();
  }
  return cleaned;
};
