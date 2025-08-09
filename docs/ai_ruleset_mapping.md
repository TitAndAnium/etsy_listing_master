# 🧠 AI_RULESET_MAPPING.MD  
**Project:** Etsy AI-Hacker  
**Versie:** 1.1  
**Datum:** 2025-08-06  
**Opsteller:** Backfire Sentry (ChatGPT)  
**Locatie:** `G:\Dev\onebox-hacker\docs\ai_ruleset_mapping.md`  
**Doel:** Mapping van AI-outputvelden naar prompts, validatieregels, retry_triggers en Firestore-logstructuur

---

## 📋 CHANGELOG

### v1.1 (2025-08-06) - Handmade-Flex Version Sync
- **Commit:** F1.3.4 - Version synchronization with prompt files
- **Changes:** Updated all prompt versions from v2.7 to v3.0.2 to match actual prompt files
- **Author:** Cascade (Windsurf)
- **Validation:** All version references now match ::VERSION:: headers in prompt files

### v1.0 (2025-07-16) - Initial Mapping
- **Commit:** Initial ruleset mapping documentation
- **Changes:** Created comprehensive mapping between prompts, rules, and validators
- **Author:** Backfire Sentry (ChatGPT)
- **Validation:** Synchronized with validator functions and rule files

---

## 🧩 STRUCTUUR

Voor elk veldtype (titel, beschrijving, tags) vind je:

- 🎯 Welke prompt het veld genereert  
- 📜 Welk `.txt`-regelbestand er geldt  
- 🧱 Welke backendfunctie de validatie uitvoert  
- 🛑 Welke retry_reason de flow mag triggeren  
- 📂 Welke Firestore-velden er gelogd worden  

---

## 📛 VELD: TITLE

| Component | Waarde |
|----------|--------|
| Prompt | `title_prompt.txt` |
| Versie | `v3.0.2` |
| Regelbestand | `title_rules.txt` |
| Validatiefunctie | `validateTitleTemplate()` (`utils/validators/titleTemplateValidator.js`) |
| Retry_reasons | `title_length_exceeded`, `missing_focus_keyword`, `excessive_caps`, `invalid_character` |
| Firestorevelden | `field: "title"`, `retry_reason`, `warnings[]`, `promptVersion`, `model`, `token_usage` |

---

## 📄 VELD: DESCRIPTION

| Component | Waarde |
|----------|--------|
| Prompt | `description_prompt.txt` |
| Versie | `v3.0.2` |
| Regelbestand | `description_rules.txt` |
| Validatiefunctie | `runAllValidators()` (`utils/validators/validatorCoordinator.js`) |
| Retry_reasons | `missing_description_sections`, `invalid_character`, `non_compliant_tone` |
| Firestorevelden | `field: "description"`, `retry_reason`, `warnings[]`, `promptVersion`, `model`, `token_usage` |

---

## 🏷️ VELD: TAGS

| Component | Waarde |
|----------|--------|
| Prompt | `tag_prompt.txt` |
| Versie | `v3.0.2` |
| Regelbestand | `tag_rules.txt` |
| Validatiefunctie | `runAllValidators()` (`utils/validators/validatorCoordinator.js`) |
| Retry_reasons | `invalid_tagcount`, `tag_length_violation`, `invalid_character`, `redundant_tag_content` |
| Firestorevelden | `field: "tags"`, `retry_reason`, `invalid_tags[]`, `warnings[]`, `promptVersion`, `model`, `token_usage` |

---

## 🧾 GLOBALE ETSY-REGELS (geldt op alle velden)

| Regelbestand | `etsy_rules.txt` |
| Regels | ASCII-only overal, geen emoji, geen prijzen of links, geen hype-stijl |
| Impact | Schendt AI deze regels → backend fallback injectie |
| Firestore veld | `fallback_model_used: null`, `retry_reason` + `field_specific` logs |
| Validatiefunctie | centrale checks binnen `generateFromDumpCore.js` en `asciiValidator.js` |

---

## 🧠 AI_FIELDS GENERATIE (PRE-STEP)

| Prompt | `classifier_prompt.txt` |
| Versie | `v3.3.0` |
| Doel | Interpreteert input → genereert `ai_fields` (zonder tags, title of description) |
//  ⬆︎  velden verwijderd – worden pas gegenereerd in stap 2-C en 2-D
| Retry_reason | `sparse_input` |
| Firestore snapshot | Volledige `ai_fields` + normalisatie_notes[] |
| Aangeroepen door | `generateFromDumpCore.js → buildAiFields()` |
| Opgevangen fallback | via `inputNormalizer.js` (injecteert defaultwaarden) |

---

## 🔒 FRONTEND-IMPACT

| Component | Bestand |
|----------|---------|
| Copy-vergrendeling | `listingState.tsx` |
| UI-checks op retry_reason | ja |
| Invoer van `user_edits` | via `reviewAiFields` endpoint |
| Logging van edits | veld: `user_edits` → Firestore entry |

---

## ✅ STATUS

Deze mapping is inhoudelijk actueel en volledig per 2025-07-16.  
Alle onderdelen zijn getoetst aan de actieve backendcode, prompts en `.txt`-regelbestanden.

---

