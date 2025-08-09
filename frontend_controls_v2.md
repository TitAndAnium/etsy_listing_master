# Frontend Controls Mapping – Pre-Run Contextscherm (Stap 1)

**Doel:**
De gebruiker krijgt na de classifier-run een volledig contextprofiel (ai_fields) te zien en kan belangrijke velden bijsturen voordat de listingprompts starten. Deze mapping is leidend voor alle front-end implementaties van deze stap.

| Promptveld                | Bron (AI/Backend)   | Frontend Control Type     | Bewerken? | Tooltip / Validatie / Opmerking                                           |
|--------------------------|---------------------|--------------------------|-----------|--------------------------------------------------------------------------|
| focus_keyword            | classifier         | text                     | ✅        | Verplicht. Eerste 5 woorden van title downstream.                        |
| product_type             | classifier         | dropdown/text            | ✅        | Verplicht. Suggesties tonen (optioneel).                                 |
| audience                 | classifier         | text                     | ✅        | Verplicht. Doelgroep, vrije tekst of suggestie.                          |
| buyer_vs_receiver        | classifier         | dropdown (self/other)    | ✅        | "self" alleen tonen als context klopt.                                   |
| personalization.name     | classifier         | checkbox                 | ✅        | Impliciet afgeleid, uitleg bij hover.                                    |
| personalization.date     | classifier         | checkbox                 | ✅        | Idem.                                                                    |
| personalization.color    | classifier         | checkbox                 | ✅        | Idem.                                                                    |
| personalization.size     | classifier         | checkbox                 | ✅        | Idem.                                                                    |
| style_trend              | classifier         | tag-input/dropdown       | ✅        | Minimaal 1 verplicht. Etsy-trends als suggestie (optioneel).             |
| seasonal_context         | classifier         | dropdown                 | ✅        | Bijv. year-round, wedding season, etc.                                   |
| tone_profile.framing     | classifier         | text (readonly/collaps)  | 🔒        | Toon bij advanced users.                                                 |
| tone_profile.voice       | classifier         | text (readonly/collaps)  | 🔒        | Idem.                                                                    |
| tone_profile.lexicon_style| classifier        | text (readonly/collaps)  | 🔒        | Idem.                                                                    |
| audience_profile.persona_type | classifier    | text (readonly/collaps)  | 🔒        | Idem.                                                                    |
| audience_profile.cultural_context | classifier| text (readonly/collaps)  | 🔒        | Idem.                                                                    |
| audience_profile.style_alignment | classifier | text (readonly/collaps)  | 🔒        | Idem.                                                                    |
| audience_profile.language_register | classifier | text (readonly/collaps) | 🔒        | Idem.                                                                    |
| mockup_style             | classifier         | text (readonly/collaps)  | 🔒        | Idem.                                                                    |
| mockup_mood              | classifier         | text (readonly/collaps)  | 🔒        | Idem.                                                                    |
| mockup_color             | classifier         | text (readonly/collaps)  | 🔒        | Idem.                                                                    |
| fallback_profile         | classifier         | badge/label              | 🔒        | Alleen tonen als aanwezig.                                               |
| retry_reason             | backend/classifier | badge/label              | 🔒        | Alleen tonen als aanwezig.                                               |
| validationLog            | backend            | accordion/warning        | 🔒        | Toon per sectie (tags, description).                                     |
| persona_specificity_level| user/classifier    | dropdown (1–5)           | ✅        | Gebruiker mag niveau wijzigen.                                           |

**Gedrag & Validaties:**
- Bij retry_reason of validationLog: warning badges tonen bij bijbehorende velden.
- Als forbidden fields (tags, description, title) tóch uit classifier komen: waarschuwing tonen.
- Pas na bevestiging door gebruiker → downstream chaining activeren.
- Minimaal 6 velden verplicht ingevuld vóór doorgaan.
- Audittrail: confirmed_by_user: true loggen bij doorgang.
- Toon fallback_profile als aanwezig.
- Optioneel: hover-info over welk promptveld downstream wordt aangestuurd.

**Toekomstige uitbreidingen:**
- Toggle "experimentele framing tonen" voor advanced users.
- Directe visuele mapping van tone_profile/audience_profile.

---
Dit document is leidend voor alle front-end implementaties van de pre-run contextstap. Aanpassingen altijd eerst afstemmen met Cascade/lead developer.
