# ✅ FLOW_OVERVIEW_V1.MD  
**Project:** Etsy AI-Hacker  
**Versie:** 1.2  
**Datum:** 2025-08-06  
**Opsteller:** Backfire Sentry (ChatGPT)  
**Bevestigd door:** Visionair (gebruiker)  
**Locatie:** `g:/dev/onebox-hacker/docs/flow_overview_v1.md`  
**Laatste synchronisatie met regels:** ✔️ Ja (inclusief `title_rules.txt`, `tag_rules.txt`, `description_rules.txt`, `etsy_rules.txt`)

## 📋 CHANGELOG

### v1.2 (2025-08-06) - Handmade-Flex Feature Integration
- **Commit:** F1.3.4 - Handmade-flex implementation
- **Changes:** Updated all prompt versions to v3.0.2/v3.0.4 for handmade-flex logic
- **Author:** Cascade (Windsurf)
- **Validation:** All version references synchronized with actual prompt files

### v1.1 (2025-07-16) - Initial Documentation
- **Commit:** Initial flow documentation
- **Changes:** Created comprehensive flow overview with validator integration
- **Author:** Backfire Sentry (ChatGPT)
- **Validation:** Synchronized with title_rules.txt, tag_rules.txt, description_rules.txt, etsy_rules.txt

---

## 🧭 DOEL VAN HET SYSTEEM

Elke vorm van input — kort of volledig — wordt vertaald naar een **volledige, Etsy-conforme listingoutput**, bestaande uit:

- 🎯 SEO-geoptimaliseerde titel
- 📄 ASCII-proof beschrijving met blokstructuur
- 🏷️ Exact 13 tags (≤20 tekens, uniek, ASCII, lowercase)
- 🔒 Volledige logging per veld en promptstap
- 🛑 Geen fallback zonder semantische reden

Deze output wordt gegenereerd via een gelaagde AI-keten en gevalideerd op prompt- én backendniveau.

---

## 🔁 FUNCTIONELE FLOW (5 STAPPEN)

---

### 🔹 STAP 0 – GEBRUIKERSINPUT

**Varianten:**
- ✏️ Korte handmatige input  
- 🧾 Etsy-dump (JSON, via inputveld of upload)

📂 Verwerkt via:
- `inputHandler.js`
- `generateFromDumpCore.js`

**Rulelink:**  
N.v.t. — hier start interpretatie

---

### 🔹 STAP 1 – CLASSIFIER & AI_FIELDS

**Prompt:** `classifier_prompt.txt`  
**Versie:** `v3.3.1`  
**Temperatuur:** `1.2`  
**Doel:** Interpretatie van de input → `ai_fields` object

**Belangrijkste velden in `ai_fields`:**
- `focus_keyword`
- `gift_emotion`
- `buyer ≠ receiver`
- `audience_profile`
- `product_type`
- `style_trend`
- `tone_preference`

**Fallback trigger:**
- Input < 3 woorden  
- Incompleet of onsamenhangend  
→ Log `retry_reason = sparse_input`

📂 Code: `inputNormalizer.js`  
📄 Logging: `validationLog.retry_reason`, `normalized_fields[]`  
📦 Firestore: `ai_fields` snapshot

---

### 🔹 STAP 2 – AI-PROMPTCHAINING PER VELD

Elk veld wordt gegenereerd op basis van `ai_fields`, met chaining.

---

#### 2A. 📛 TITLE

**Prompt:** `title_prompt.txt`  
**Versie:** `v3.0.4`  
**Inputs:** `ai_fields + allow_handmade`  
**Output:** `title_output`

**Validatie-eisen:**  
📄 Zie: `title_rules.txt`

| Regel | Fallback-trigger |
|-------|------------------|
| ≤ 140 tekens | `title_length_exceeded` |
| Focus keyword in eerste 5 woorden | `missing_focus_keyword` |
| ASCII-only | `invalid_character` |
| Max 1x ALL CAPS woord | `excessive_caps` |

📂 Validatie in: `generateFromDumpCore.js → validateTitle()`  
📦 Logging: `retry_reason`, `warnings[]`  

**Rulelink:** `title_rules.txt`

---

#### 2B. 📖 DESCRIPTION

**Prompt:** `description_prompt.txt`  
**Versie:** `v3.0.2`  
**Inputs:** `ai_fields + title_output`  
**Output:** `description_output`

**Validatie-eisen:**  
📄 Zie: `description_rules.txt`

| Regel | Fallback-trigger |
|-------|------------------|
| ASCII-only | `invalid_character` |
| Verplichte blokken: Overview + Features | `missing_description_sections` |
| Verboden: emoji, fancy tekens, salescopy | `non_compliant_tone` |

📂 Validatie in: `generateFromDumpCore.js → validateDescription()`  
📦 Logging: `retry_reason`, `warnings[]`

**Rulelink:** `description_rules.txt`

---

#### 2C. 🏷️ TAGS

**Prompt:** `tag_prompt.txt`  
**Versie:** `v3.0.2`  
**Inputs:** `ai_fields + title_output + description_output`  
**Output:** `final_tags` (array)

**Validatie-eisen:**  
📄 Zie: `tag_rules.txt`

| Regel | Fallback-trigger |
|-------|------------------|
| Exact 13 tags | `invalid_tagcount` |
| Max 20 tekens per tag | `tag_length_violation` |
| ASCII, lowercase | `invalid_character` |
| Geen duplicaten of overlap met title | `redundant_tag_content` |

📂 Validatie in: `generateFromDumpCore.js → validateTagSet()`  
📦 Logging: `retry_reason`, `invalid_tags[]`, `warnings[]`

**Rulelink:** `tag_rules.txt`

---

### 🔹 STAP 3 – BACKENDVALIDATIE & FALLBACKINJECTIE

📂 Bestand: `generateFromDumpCore.js`  

| Situatie | Backendactie |
|----------|--------------|
| AI geeft geen retry_reason én velden zijn incompleet | Injecteer `backend fallback: added retry_reason` |
| AI-output valide | Geen injectie, log blijft leeg of transparant |
| Tags of description ongeldig | Trigger retry_reason volgens veldtype |

📦 Firestorevelden:  
- `validationLog.retry_reason`  
- `fallback_model_used` (altijd `null`)  
- `ai_profile_used`, `prompt_version`, `token_usage`

**Rulelink:** `etsy_rules.txt`

---

### 🔹 STAP 4 – LOGGINGSTRUCTUUR FIRESTORE

Per veld wordt gelogd:
```json
{
  "uid": "testuser123",
  "field": "description",
  "success": true,
  "fallbackUsed": false,
  "retry_reason": "",
  "warnings": [],
  "model": "gpt-4o",
  "promptVersion": "v3.0.2",
  "timestamp": "2025-07-16T14:10:00Z"
}
📂 Bestand: firestore_logging.js
📄 Loggingregels gespecificeerd in:

project_decisions_and_logs.md

prompt_versions_and_behavior.md

🔹 STAP 5 – FRONTENDVERGRENDELING (copy/publish)
📂 Bestand: listingState.tsx
📄 UX-logica in: frontend_controls_v2.md

Situatie	UI-actie
Tags onvolledig of fout	Copy-knop disabled
retry_reason ≠ ""	Copy disabled (tenzij handmatige override)
Fout in beschrijving	Waarschuwingsbanner
user_edits ≠ null	Edit-icon actief, log aanpasbaar

🧪 TESTCASES PER STAP (voor debug of releasecheck)
Test	Verwachte uitkomst
input = “eierdopje”	retry_reason = sparse_input
input = met emoji in tag	retry_reason = invalid_character
description mist “Overview”	retry_reason = missing_description_sections
tag = “bride2024💍”	retry_reason = invalid_character

📂 RELATIEVE BESTANDSKOPPELING
Stap	Regelbestand
Title	title_rules.txt
Description	description_rules.txt
Tags	tag_rules.txt
Globaal/Etsy	etsy_rules.txt

✅ STATUS
Deze flowversie is inhoudelijk volledig, versiegesynchroniseerd en afgedwongen binnen de projectstructuur van 2025-07-16.

Alle fallbackcriteria, logvelden, chaininglogica en promptversies zijn gekoppeld aan hun respectievelijke bestanden.

yaml
Kopiëren
Bewerken

---
