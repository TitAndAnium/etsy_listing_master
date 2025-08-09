// Node.js smoke-test voor state-leakage Etsy AI backend
// Doel: Drie verschillende inputs sturen, responses en INCOMING FIELDS loggen, output wegschrijven naar logs/smoke/
// Cascade 2025-07-20

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const TESTS = [
  { label: 'raincoat', fields: { product_type: 'raincoat', title: 'Ultra Lightweight Raincoat', material: 'nylon', color: 'blue', size: 'L', features: ['waterproof', 'packable'], audience: 'adults', style: 'minimalist', pattern: 'solid', season: 'spring', gender: 'unisex', closure: 'zipper', brand: 'RainGuard', origin: 'EU', extra: '' } },
  { label: 'laptop sleeve', fields: { product_type: 'laptop sleeve', title: 'Felt Laptop Sleeve 13-inch', material: 'felt', color: 'grey', size: '13-inch', features: ['padded', 'eco-friendly'], audience: 'students', style: 'modern', pattern: 'plain', season: 'all', gender: 'unisex', closure: 'velcro', brand: 'SafeSleeve', origin: 'USA', extra: '' } },
  { label: 'wedding ring box', fields: { product_type: 'wedding ring box', title: 'Walnut Wood Wedding Ring Box', material: 'walnut', color: 'brown', size: 'small', features: ['handmade', 'engraved'], audience: 'couples', style: 'rustic', pattern: 'woodgrain', season: 'all', gender: 'unisex', closure: 'magnet', brand: 'WoodLove', origin: 'EU', extra: '' } }
];

const API_URL = 'http://127.0.0.1:5001/etsy-ai-hacker/us-central1/api_generateChainingFromFields';
const LOGDIR = path.join(__dirname, '../logs/smoke');
const TIMESTAMP = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const OUTFILE = path.join(LOGDIR, `${TIMESTAMP}_stateleak.json`);

async function runTest() {
  const results = [];
  for (const test of TESTS) {
    const payload = { fields: test.fields };
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    results.push({
      label: test.label,
      sent_fields: test.fields,
      status: res.status,
      response: data
    });
    console.log(`[${test.label}] status: ${res.status}`);
  }
  // Schrijf naar logfile
  fs.writeFileSync(OUTFILE, JSON.stringify({
    timestamp: new Date().toISOString(),
    tests: results
  }, null, 2));
  console.log(`Smoke-test afgerond, zie ${OUTFILE}`);
}

runTest();
