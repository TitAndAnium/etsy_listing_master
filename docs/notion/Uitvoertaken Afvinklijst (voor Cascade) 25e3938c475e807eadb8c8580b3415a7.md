# Uitvoertaken Afvinklijst (voor Cascade)

*Notion friendly. Alles in duidelijke, uitvoerbare stappen met acceptance criteria. Gebruik dit 1-op-1 als werkbriefing voor Cascade.*

---

## context_strategy (JSON, generiek)

```json
{
  "objective": "Production readiness door blokkades weg te nemen en polish te leveren.",
  "scope": [
    "Auth op alle generate endpoints",
    "Persistente per-user daily credits (Firestore transacties)",
    "Server-side prijs-credits validatie en webhook idempotency (Stripe)",
    "Firestore security rules least-privilege en getest",
    "E2E user journey en CI uitbreidingen",
    "Monitoring, TTL, documentatie en frontend polish"
  ],
  "constraints": {
    "no_model_fallback_to_gpt_3_5": true,
    "ascii_only_output": true,
    "title_max_chars": 140,
    "tags_exact_count": 13,
    "tags_max_chars": 20
  },
  "logging_contract": {
    "required": ["prompt_version","token_usage","timestamp","uid","retry_reason?","fallback_model_used?","quality_score?"],
    "notes": "uid altijd uit ID-token. quality_score alleen bij geslaagde veld-logs. retry_reason en fallback_model_used uitsluitend wanneer van toepassing."
  },
  "ci_matrix": ["unit","firestore_rules_emulator","e2e_preview","e2e_full_emulator"],
  "env_vars": [
    "OPENAI_API_KEY","SLACK_WEBHOOK_URL",
    "STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET",
    "DAILY_CREDITS","DAILY_BUDGET_USD","BUDGET_HARD_STOP",
    "BASE_URL","STRIPE_PRICE_IDS"
  ],
  "release": {
    "prompt_version_bump": "v2.3.1",
    "deploy_cmd": "firebase deploy --only functions",
    "hosting_after_frontend": true}
}

```

---

## Globale werkwijze voor Cascade

- [ ]  Maak feature branch: `fix/auth-credits-rules-v2_3_1`
- [ ]  Activeer Backfire Sentry auditlogging op branch runs
- [ ]  Werk iteratief per blok hieronder; voer pas deploy uit als alle blokkerende taken groen zijn
- [ ]  Na elk blok: unit plus emulator tests, daarna e2e preview

---

## Blok A — Blokkerende taken (Hoog)

### A1. Auth verplicht op alle generate endpoints

- [ ]  Implementeer authMiddleware met `verifyIdToken` en injecteer `req.user.uid`
- [ ]  Verwijder client aangeleverde `uid` uit alle generate handlers
- [ ]  Anonieme requests moeten 401 geven
- Acceptance criteria:
    - [ ]  Alle generate endpoints vereisen geldig ID-token, anders 401
    - [ ]  Logs tonen altijd uid uit token, geen `unknown` of body uid
- Owner: Security Engineer
- Inspanning: S
- Dependencies: geen

### A2. Persistente per-user Daily Credits via Firestore transacties

- [ ]  Introduceer collectie `user_credits/{uid}` met velden `creditsUsed`, `lastReset`
- [ ]  Bouw `ensureCredits`, `getBalance`, `consumeCredits` met Firestore transaction en `FieldValue.increment`
- [ ]  Daggrens reset bij startOfToday
- Acceptance criteria:
    - [ ]  Geen in-memory buckets in productiepad
    - [ ]  429 bij overschrijding, ook bij gelijktijdige requests
    - [ ]  Concurrency test laat correcte totalen zien
- Owner: Backend Engineer
- Inspanning: M
- Dependencies: A1

### A3. Server-side prijs-credits validatie en mapping (Stripe)

- [ ]  Verwijder vertrouwen op client `credits` en `amount_cents`
- [ ]  Gebruik server-side mapping met Price IDs of server berekening op basis van `amount_total`
- [ ]  Webhook creditering bepaalt credits uitsluitend server-side
- [ ]  Voeg idempotency tegen dubbele webhook verwerking toe
- Acceptance criteria:
    - [ ]  Client kan credits of bedrag niet manipuleren
    - [ ]  Webhook is idempotent, dubbele events geven geen dubbel saldo
    - [ ]  Mapping gedocumenteerd in README en `.env.example`
- Owner: Payments Specialist
- Inspanning: M
- Dependencies: geen

### A4. Firestore security rules finaliseren en testen

- [ ]  Users: read write alleen door eigenaar `request.auth.uid == userId`
- [ ]  Credits: eigenaar read, writes alleen via Functions
- [ ]  Logs en runs: deny by default, alleen via Admin SDK
- [ ]  Emulator rule tests voor eigen vs andermans data
- Acceptance criteria:
    - [ ]  Alle rule tests groen
    - [ ]  Client kan nooit andermans data lezen of schrijven
- Owner: Data Protection Engineer
- Inspanning: M
- Dependencies: A1, A2

### A5. E2E user journey na fixes

- [ ]  Scenario: login -> koop credits -> generate listing tot daglimiet -> 429
- [ ]  Scenario: ongeauth generate -> 401
- Acceptance criteria:
    - [ ]  Beide scenario’s slagen in e2e preview en full emulator
- Owner: QA Lead
- Inspanning: M
- Dependencies: A1, A2, A3

---

## Blok B — Belangrijke taken (Midden)

### B1. TTL inschakelen voor Firestore logs en retention beleid

- [ ]  Activeer TTL op logcollecties met veld `expires_at`
- [ ]  Stel standaard retentie, bijv. 30 dagen
- Acceptance criteria:
    - [ ]  TTL actief, oude logs worden automatisch verwijderd
    - [ ]  Retentie vastgelegd in README Privacy Addendum
- Owner: Data Protection Engineer
- Inspanning: S
- Dependencies: A4

### B2. Slack alerts voor latency, fails, budget thresholds

- [ ]  Integreer Slack webhook bij uitzonderingen en bij 80 procent budget
- [ ]  Voeg toggle voor dev vs prod alerts
- Acceptance criteria:
    - [ ]  Alert bij uncaught error en budget 80 procent
    - [ ]  Handmatige testbericht zichtbaar in dev kanaal
- Owner: DevOps
- Inspanning: S
- Dependencies: geen

### B3. Logging en uid opschonen

- [ ]  Verwijder restanten `unknown` en `testuser123` uit productiepaden
- [ ]  Zorg dat elk log item een uid bevat waar relevant
- Acceptance criteria:
    - [ ]  Geen hardcoded uids meer in code
    - [ ]  Spotcheck recente logs toont juiste uid
- Owner: Backend Engineer
- Inspanning: S
- Dependencies: A1

### B4. Frontend login en token doorgeven

- [ ]  Voeg login flow toe of maak hem zichtbaar in UI
- [ ]  Voeg Authorization bearer header toe bij generate calls
- Acceptance criteria:
    - [ ]  Generate calls werken alleen met geldige login
    - [ ]  UX toont nette melding bij 401 en 429
- Owner: Frontend Engineer
- Inspanning: M
- Dependencies: A1

### B5. CI uitbreiden met rules tests en deploy-gate

- [ ]  Voeg Firebase rules emulator tests toe aan CI
- [ ]  Voeg manual approval stap toe voor productie deploy
- Acceptance criteria:
    - [ ]  CI faalt bij rule regressie
    - [ ]  Deploy alleen na tests groen en manual approval
- Owner: DevOps
- Inspanning: S
- Dependencies: A4

### B6. Documentatie addendum en changelog v2.3.1

- [ ]  Update README, Masterdocument en Changelog met auth, credits Firestore, Stripe mapping, TTL
- Acceptance criteria:
    - [ ]  Docs in sync met code, versie gemarkeerd v2.3.1
- Owner: Product Lead
- Inspanning: S
- Dependencies: A1, A2, A3, A4

### B7. CORS beperken en App Check overwegen

- [ ]  Beperk CORS origins tot eigen domeinen
- [ ]  Optioneel Firebase App Check inschakelen
- Acceptance criteria:
    - [ ]  Alleen whitelisted origins toegestaan
- Owner: Security Engineer
- Inspanning: S
- Dependencies: A1

### B8. Webhook expired sessions en fouten loggen

- [ ]  Handel `checkout.session.expired` en mislukte events netjes af met logging
- Acceptance criteria:
    - [ ]  Expired sessions gelogd, geen credits mutatie
- Owner: Payments Specialist
- Inspanning: S
- Dependencies: A3

---

## Blok C — Polish en nice-to-have (Laag)

### C1. Per-veld regenerate UI en creditverbruik tonen

- [ ]  Maak per-veld regenerate knoppen actief in UI
- [ ]  Toon creditimpact per actie in Pro-mode
- Acceptance criteria:
    - [ ]  Per-veld regen werkt en laat credit delta zien
- Owner: Frontend Engineer
- Inspanning: M
- Dependencies: A2

### C2. A11y en statuscommunicatie

- [ ]  Voeg aria-labels, role=alert voor fouten, focus states
- [ ]  Controleer contrast en kleur-onafhankelijke statuslabels
- Acceptance criteria:
    - [ ]  Lighthouse of axe basischeck zonder kritieke issues
- Owner: Frontend Engineer
- Inspanning: S
- Dependencies: geen

### C3. Alt-text generatie module

- [ ]  Koppel optionele alt-text output aan image input flow
- Acceptance criteria:
    - [ ]  Bij image input verschijnt alt-text voorstel
- Owner: Backend plus Frontend
- Inspanning: M
- Dependencies: geen

### C4. Admin override logging en debug viewer

- [ ]  Voeg admin-only toggles toe en log overrides met actor en reden
- Acceptance criteria:
    - [ ]  Override acties zichtbaar in admin logviewer
- Owner: Backend plus Frontend
- Inspanning: M
- Dependencies: B6

### C5. Monitoring dashboards

- [ ]  Maak eenvoudig dashboard voor credits verbruik, budget, error rate
- Acceptance criteria:
    - [ ]  Grafieken zichtbaar, dagelijkse trends beschikbaar
- Owner: DevOps
- Inspanning: M
- Dependencies: B2

---

## Instructievertaling per stap (voor Cascade)

Voor elk item uit Blok A en B, hanteer onderstaande micro-sjabloon.

**Strategie:** Waarom doen we dit

**Stap:** 1 concrete actie

**Jip-en-Janneke:** Eenvoudige uitleg

**Validatievraag:** 1 checkvraag aan eind

Voorbeeld A1:

- Strategie: Sluit misbruikgaten en koppel alle acties aan een echte gebruiker
- Stap: Voeg authMiddleware toe en gebruik uid uit ID-token in elke generate handler
- Jip-en-Janneke: Je mag pas genereren als je bent ingelogd, we halen je uid uit je loginbewijs
- Validatievraag: Krijg je 401 zonder token en correcte uid in logs met token

Herhaal dit voor A2, A3, A4, A5 en de B-taken.

---

## CI takenlijst samengevat

- [ ]  Unit tests updaten en uitbreiden (auth, credits, stripe mapping)
- [ ]  Firestore rules emulator tests toevoegen
- [ ]  E2E preview scenario’s bijwerken (401, 429, succesvolle purchase)
- [ ]  Full emulator run aanzetten als optioneel job
- [ ]  Deploy job met manual approval

---

## .env en config updates

- [ ]  `.env.example` bijwerken met `STRIPE_PRICE_IDS` of pakket mapping
- [ ]  `functions:config:set stripe.secret=... stripe.webhook_secret=...`
- [ ]  Verifieer `BASE_URL` voor productie
- [ ]  Documenteer retentie en TTL veld in README

---

## Definition of Done

- [ ]  Alle blokkerende taken A1 t m A5 groen
- [ ]  CI groen inclusief rules tests en e2e
- [ ]  Productiedeploy uitgevoerd
- [ ]  Changelog v2.3.1 en docs geactualiseerd
- [ ]  Slack alerts actief
- [ ]  Retentie en TTL actief