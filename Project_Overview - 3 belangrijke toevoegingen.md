# ✅ Project_Overview – 3 belangrijke toevoegingen  
**Documentstatus:** Actief  
**Laatste update:** 2025-07-16  
**Opsteller:** Backfire Sentry  
**Bestandspad:** `project/docs/Project_Overview - 3 belangrijke toevoegingen.md`

---

## 🧠 Wat is uitstekend aan dit instructiedocument?

### ✅ Doel en kernstructuur zijn kraakhelder:
- Het legt perfect uit wat het AI-systeem moet doen.
- De workflow is consistent met het eerder vastgestelde cascade-regime en validatielogica.

### ✅ Multidomein-context is aanwezig:
- De AI wordt niet alleen als tekstgenerator, maar ook als dev-partner gedefinieerd.
- Verwijzingen naar fallback, tagging, ASCII, Firestore logging en validatielagen zijn aanwezig.

### ✅ Dubbele logginginstructie is goed ingebouwd:
- Log technische beslissingen in `project_decisions_and_logs.md`
- Log functionele aansturing onderaan in `Project_Overview.md`

---

## ⚠️ Wat moet je absoluut nog fixen vóór activatie?

### 1. ✅ Logging-instructie (2025-07-15)
AI moet bij elke aanpassing in code of testflow direct een nieuwe sectie toevoegen aan `project_decisions_and_logs.md`, volgens het vaste blokformaat:

- ✅ Titel (bv. Validatiefilter op tags)  
- 📅 Datum en tijdstip  
- 🧠 Motief (waarom)  
- 💻 Implementatie (welk bestand, welke regel)  
- 🧪 Resultaat (output, test)  
- 👤 Actiehouder (AI of gebruiker)

---

### 2. ✅ Slimme testcase-herhaling (2025-07-15)
AI mag geen oude testcases opnieuw valideren, tenzij:
- De code inhoudelijk is gewijzigd  
- Een regressietest vereist is  
- De gebruiker dit expliciet vraagt

---

### 3. ✅ Fallback bij hallucinatie/irrelevantie (2025-07-15)
Bij output zonder Etsy-relevantie of met hallucinaties geldt:

1. Controleer of AI-output aan alle validatieregels voldoet  
2. Indien twijfelachtig: hergenereer met debug-info actief  
3. Meld afwijking in `validationLog` en koppel terug naar gebruiker

---

### 4. ✅ retry_reason-logica mag nooit onterecht injecteren (2025-07-16)
Nieuwe logica in `generateFromDumpCore.js` voorkomt fallbackmeldingen wanneer:

- De AI geldige output genereert  
- Zelf een retry_reason teruggeeft  
- Alle verplichte velden (tags, description) aanwezig zijn

📎 Volledige changelog in: `project_decisions_and_logs.md`  
📌 Bevestigd via testcases TC-1 t/m TC-4 met uid `testuser123`

---

## ✍️ Samenvattend oordeel

| Veld               | Status     |
|--------------------|------------|
| Structuur          | ✅ Perfect |
| Doelgerichtheid    | ✅ Helder  |
| AI-instructie      | ✅ Volledig op gedrag/logging |
| Kritische situaties| ✅ Fallbackprocedure vastgelegd |
| Direct inzetbaar   | ✅ Alle 4 toevoegingen verwerkt |

