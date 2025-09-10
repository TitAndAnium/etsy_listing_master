// functions/utils/tagUtils.js

/**
 * Tag stem dedup v1.0 — lichtgewicht, dependency-free
 * Doel: tags met zelfde betekenis (enkelvoud/meervoud/varianten) tot één reduceren.
 */

'use strict';

function asciiLower(s) {
  if (!s) return '';
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase();
}

// Zeer eenvoudige stemmer (bewust conservatief, fail-safe)
function stemWord(w) {
  let x = w;
  x = x.replace(/^(.+)'s$/, '$1');       // dog's -> dog
  if (x.endsWith('ies') && x.length > 3) x = x.slice(0, -3) + 'y';   // puppies -> puppy
  else if (x.endsWith('sses')) x = x.slice(0, -2);                   // classes -> class
  else if (x.endsWith('es') && x.length > 3) x = x.slice(0, -2);     // boxes -> box
  else if (x.endsWith('s') && x.length > 3) x = x.slice(0, -1);      // rings -> ring
  return x;
}

// Maak een stabiele “stamkey” op frase-niveau (woord-voor-woord)
function toStemKey(tag) {
  const base = asciiLower(tag).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!base) return '';
  const words = base.split(' ').map(stemWord);
  return words.join('-'); // 'silver rings' -> 'silver-ring'
}

// Dedupliceer met behoud van volgorde; retourneer extra context
function dedupeByStem(tags) {
  const seen = new Map();        // stemKey -> index van eerste voorkomens
  const unique = [];
  const dropped = [];
  const duplicatesMap = {};      // stemKey -> [indices gedropt]

  (Array.isArray(tags) ? tags : []).forEach((t, idx) => {
    const key = toStemKey(t);
    if (!key) return;
    if (!seen.has(key)) {
      seen.set(key, idx);
      unique.push(t);
    } else {
      dropped.push(t);
      if (!duplicatesMap[key]) duplicatesMap[key] = [];
      duplicatesMap[key].push(idx);
    }
  });

  return { unique, dropped, duplicatesMap };
}

module.exports = { toStemKey, dedupeByStem, _stemWord: stemWord };