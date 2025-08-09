# Stap 2B: Functionele Cascade-validatie Testcases

## 🧪 **Testcase 1: Extreme Sparse Input**
**Input:** `"eierdopje"`
**Verwacht gedrag:**
- Classifier: `gift_mode: false`, `audience: []`, `fallback_profile: "kitchen accessory"`
- Title: Korte, generieke titel zonder hallucination
- Tags: Max 13 tags, geen duplicaten, lowercase
- Description: Minimale maar valide beschrijving
- Validator: Soft-fail warnings, geen hard errors
- Logging: `retry_reason: "sparse input detected"`

## 🧪 **Testcase 2: Gift Mode Edge Case**
**Input:** `"birthday present for mom"`
**Verwacht gedrag:**
- Classifier: `gift_mode: true`, `audience: ["mothers"]`, `fallback_profile: ""`
- Title: Bevat geen "gift" of "present" (AI moet dit infereren)
- Tags: Bevat relevante doelgroep tags
- Description: Gift-context zonder expliciete vermelding
- Validator: Alle validaties slagen
- Logging: Geen retry_reason, quality_score > 0

## 🧪 **Testcase 3: Fallback Scenario**
**Input:** `"xyz123 random nonsense !@#$%"`
**Verwacht gedrag:**
- Classifier: `retry_reason: "unrecognizable input"`, fallback_profile gevuld
- Backend: Gebruikt fallback_profile voor AI generation
- Title/Tags/Description: Generieke maar valide output
- Validator: Soft-fail met warnings
- Logging: `fallback_model_used` NIET aanwezig (geen model fallback)

## 🧪 **Testcase 4: Validator Stress Test**
**Input:** `"handmade ceramic mug for coffee lovers and tea enthusiasts"`
**Verwacht gedrag:**
- Classifier: `gift_mode: false`, `audience: ["coffee lovers", "tea enthusiasts"]`
- Title: ASCII-only, geen emojis, max lengte
- Tags: Exact 13 tags, geen duplicaten, lowercase
- Description: Alle verplichte blokken aanwezig
- Validator: Alle checks slagen, quality_score hoog
- Logging: Volledige structuur met prompt_version v2.7

## 🧪 **Testcase 5: Chaining Consistency**
**Input:** `"vintage leather wallet"`
**Verwacht gedrag:**
- Classifier output wordt consistent doorgegeven aan alle prompts
- Title/Tags/Description bevatten coherente informatie
- Geen contradictie tussen velden
- Validator: Cross-field consistency check slaagt
- Logging: Alle 4 velden (classifier + 3 AI outputs) gelogd

---

## 🎯 **Uitvoering Protocol**

1. **Setup**: Firebase emulators starten
2. **Execute**: Elke testcase via `http_generateFromDumpCore.js`
3. **Verify**: 
   - Console output controleren
   - Firestore logs inspecteren (uid: testuser123)
   - Validator warnings/errors documenteren
4. **Document**: Resultaten vs verwachtingen per testcase

## ✅ **Slaagcriteria**

- Alle testcases produceren valide JSON output
- Geen hard errors, alleen soft-fail warnings waar verwacht
- Logging bevat alle verplichte velden
- Validator gedrag consistent met verwachtingen
- Fallback discipline correct (geen onnodige model fallbacks)
