// functions/utils/stripeCatalog.js
const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '..', 'config', 'stripeCatalog.json');

let catalog;
function loadCatalog() {
  if (!catalog) {
    catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  }
  return catalog;
}

function getPlanByPriceId(priceId) {
  const cat = loadCatalog();
  return cat[priceId] || null;
}

module.exports = { getPlanByPriceId };
