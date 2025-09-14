# Afvinklijst – Aandachtspunten, Documentatie & Addendum, .env/.gitignore, Overige taken

*Notion-vriendelijk. Direct inzetbaar voor Cascade. Elke taak bevat context, acceptance criteria, owner, inspanning en dependencies.*

---

## context_strategy (JSON, voor dit pakket)

```json
{
  "objective": "Kwaliteitspolish, documentconsistency en operationele hardening zonder blockers.",
  "scope": [
    "Aandachtspunten (UX/A11y, performance, privacy, config-segmentatie)",
    "Documentatie & addendum (security, privacy, ops, licenties)",
    ".env/.gitignore controles en secret hygiene automations",
    "Overige housekeeping (observability, backups, rate limits, compliance)"
  ],
  "constraints": {
    "ascii_only_output": true,
    "no_personal_data_in_logs": true,
    "no_model_fallback_to_gpt_3_5": true},
  "ci_matrix": ["unit","lint","license_scan","secrets_scan","e2e_preview"],
  "release": {
    "doc_version_tag": "docs-v2.3.1",
    "no_runtime_changes_required": true}
}

```

---

## Sectie A — Aandachtspunten (geen project-stoppers)

### A1. Dependency hygiëne en updates

- [ ]  Voer `npm outdated`/`npm audit` door op root en `functions/`, update minor/patch waar veilig.
- Acceptance criteria:
    - [ ]  Geen high/critical advisories meer in CI.
    - [ ]  Lockfiles up-to-date, app start en tests groen.
- Owner: DevOps / Backend
- Inspanning: S
- Dependencies: geen

### A2. Logging volume & kosten tuning

- [ ]  Herclassificeer logniveaus (info→debug waar gepast), voeg sampling toe voor hoge-frequentie events.
- Acceptance criteria:
    - [ ]  Firestore writes per run <= afgesproken drempel.
    - [ ]  Kostenrapport toont ≥20% reductie log-writes zonder verlies aan noodzakelijke observability.
- Owner: Backend
- Inspanning: S
- Dependencies: geen

### A3. Config-segmentatie & `.firebaserc` sanity

- [ ]  Splits duidelijke `staging` en `prod` projecten in `.firebaserc` en CI env-mapping.
- Acceptance criteria:
    - [ ]  Deploy naar staging/prod gebruikt verschillende project-IDs.
    - [ ]  Readme bevat tabel met env→project mapping.
- Owner: DevOps
- Inspanning: S
- Dependencies: geen

### A4. Privacy & toestemmingscopy in UI

- [ ]  Voeg in UI een compacte privacytekst toe over opslag van input/output en logretentie.
- Acceptance criteria:
    - [ ]  Modale uitleg/footnote aanwezig, linkt naar Privacy Addendum.
    - [ ]  Geen PII wordt gelogd; test met voorbeelddata.
- Owner: Frontend / Product
- Inspanning: S
- Dependencies: Documentatie D2

### A5. Performance & load smoke

- [ ]  Meet end-to-end latency voor 10 gelijktijdige generaties (emulator of throttle test).
- Acceptance criteria:
    - [ ]  Gemiddelde TTR (time-to-result) onder afgesproken drempel (bv. < 5s).
    - [ ]  Cold-start impact gedocumenteerd met mitigerende tips.
- Owner: QA / DevOps
- Inspanning: M
- Dependencies: geen

### A6. Prompt-injection mitigaties light

- [ ]  Sanitize userinput (strip control chars, simple policy filter), voeg preflight waarschuwingslabel toe.
- Acceptance criteria:
    - [ ]  Ongewenste tokens/escape sequences worden genegeerd of gelogd.
    - [ ]  Tests tonen dat outputregels (ASCII, max lengte, 13 tags) gehandhaafd blijven bij “boze” input.
- Owner: Backend
- Inspanning: S
- Dependencies: geen

### A7. CORS whitelisting (verfijning)

- [ ]  Beperk CORS tot bekende origins per omgeving.
- Acceptance criteria:
    - [ ]  Niet-whitelisted origin krijgt 403 preflight.
    - [ ]  Frontend origin(s) blijven functioneren.
- Owner: Security / DevOps
- Inspanning: S
- Dependencies: A3

### A8. Frontend statuscommunicatie zonder kleurafhankelijkheid

- [ ]  Voeg tekstlabels/icoons toe naast kleurbadges (ok/warn/error).
- Acceptance criteria:
    - [ ]  UI toont status ook zonder kleur (WCAG).
    - [ ]  Axe/Lighthouse basischeck zonder critical A11y issues.
- Owner: Frontend
- Inspanning: S
- Dependencies: geen

### A9. Function timeouts & memory tuning

- [ ]  Review Functions config (timeout, memory) per endpoint; verlaag waar mogelijk.
- Acceptance criteria:
    - [ ]  Geen timeouts bij normale load; kosten niet gestegen.
    - [ ]  Config vastgelegd in ops-runbook.
- Owner: DevOps
- Inspanning: S
- Dependencies: A5

---

## Sectie B — Documentatiebeoordeling & Addendum-advies

### D1. Architectuurcorrectie: Next→Vue wijziging expliciet maken

- [ ]  Update alle docs (Master, Overview, Releasechecklist) met huidige Vue-frontend i.p.v. Next/React.
- Acceptance criteria:
    - [ ]  Geen verwijzingen meer naar niet-bestaande React componenten.
    - [ ]  Diagram met actuele lagen en calls aanwezig.
- Owner: Product / Tech Writer
- Inspanning: S
- Dependencies: geen

### D2. Privacy Addendum

- [ ]  Schrijf beknopt addendum: welke data, doel, retentie, rechten gebruiker, contactpunt.
- Acceptance criteria:
    - [ ]  Linkt vanuit UI (A4), retentiebeleid consistent met TTL/ops.
- Owner: DPO / Product
- Inspanning: S
- Dependencies: A4

### D3. Security Addendum + Threat Model short

- [ ]  Leg vast: auth, credits/budget guards, webhook verificatie, rules, CORS, rate-limits.
- Acceptance criteria:
    - [ ]  Beknopte datastromen en belangrijkste dreigingen + mitigaties opgenomen.
- Owner: Security
- Inspanning: S
- Dependencies: A7

### D4. Ops/Deployment runbook

- [ ]  Install, emulators, deploy, rollback, feature flags, incidentprocedure.
- Acceptance criteria:
    - [ ]  Stapsgewijze handleiding + checklists; werkt door dry-run.
- Owner: DevOps
- Inspanning: M
- Dependencies: A3

### D5. Config README (functions.config + .env.example)

- [ ]  Tabel met alle vereiste env/config sleutels, bron en voorbeeld.
- Acceptance criteria:
    - [ ]  Nieuwe dev kan cold-starten zonder vragen.
- Owner: Tech Writer
- Inspanning: S
- Dependencies: Sectie C

### D6. Licentie & 3rd-party notice

- [ ]  Voeg `THIRD_PARTY_LICENSES.md` toe (Stripe SDK/CLI, Firebase, OpenAI, enz.).
- Acceptance criteria:
    - [ ]  Belangrijkste licenties en disclaimers aanwezig.
- Owner: Product / Legal
- Inspanning: S
- Dependencies: geen

### D7. API-referentie (interne endpoints)

- [ ]  Documenteer HTTP endpoints (paths, auth, payloads, responses, fouten).
- Acceptance criteria:
    - [ ]  Postman/Hoppscotch collection meegeleverd.
- Owner: Backend
- Inspanning: S
- Dependencies: D4

---

## Sectie C — .env en .gitignore controles (root + functions/)

### C1. `dotenv-safe` of schema-check in CI

- [ ]  Voeg env-schema toe (bijv. `envalid`/custom) en faal build bij missende keys.
- Acceptance criteria:
    - [ ]  CI faalt als verplichte env ontbreekt of leeg is.
- Owner: DevOps
- Inspanning: S
- Dependencies: D5

### C2. Secret-scan als CI job

- [ ]  Activeer GitHub Advanced Security of `gitleaks` action op PRs.
- Acceptance criteria:
    - [ ]  PR blokkeert bij secret patterns; whitelist voor bekende teststrings.
- Owner: DevOps
- Inspanning: S
- Dependencies: geen

### C3. Pre-commit hook voor `.env` en artefacten

- [ ]  Husky/lint-staged: blok commit van `.env`, `.pem`, `.p12`, dumps, `dist/`.
- Acceptance criteria:
    - [ ]  Lokale commit met verboden bestanden wordt geweigerd.
- Owner: DevOps
- Inspanning: S
- Dependencies: C2

### C4. `.env.example` synchroniseren

- [ ]  Genereer `.env.example` vanuit env-schema of handmatig; verwijder overbodige keys.
- Acceptance criteria:
    - [ ]  `.env.example` matcht feitelijk gebruik in code.
- Owner: Backend
- Inspanning: S
- Dependencies: C1

### C5. Frontend env-exposure audit

- [ ]  Controleer op ongewenste publieksvars (VITE_/NEXT_PUBLIC_*); hernoem naar server-side waar nodig.
- Acceptance criteria:
    - [ ]  Geen gevoelige waarden client-side beschikbaar.
- Owner: Frontend / Security
- Inspanning: S
- Dependencies: C1

### C6. Repo-opruimingen

- [ ]  Verwijder binaire tooling (bijv. `stripe.exe`) uit repo; documenteer install stappen.
- Acceptance criteria:
    - [ ]  Repo bevat geen onnodige binaries; `.gitignore` dekt build/cache volledig.
- Owner: DevOps
- Inspanning: S
- Dependencies: D6

---

## Sectie O — Overige losse taken (housekeeping)

### O1. Observability: correlation IDs

- [ ]  Voeg `x-corr-id` support toe (generate/propagate) in requests en logs.
- Acceptance criteria:
    - [ ]  Elke run/log is traceerbaar end-to-end via ID.
- Owner: Backend
- Inspanning: S
- Dependencies: A2

### O2. Rate limiting aanvullend (edge)

- [ ]  Voeg eenvoudige IP-throttling of App Check handhaving toe.
- Acceptance criteria:
    - [ ]  Excessive calls van 1 bron worden beperkt zonder side-effects.
- Owner: Security / DevOps
- Inspanning: S
- Dependencies: A7

### O3. Backups & export

- [ ]  Plan Firestore back-ups en documenteer data-export/verwijderprocedure (GDPR).
- Acceptance criteria:
    - [ ]  Restore-stap getest; export/verwijderflow gedocumenteerd.
- Owner: DPO / DevOps
- Inspanning: M
- Dependencies: D2, D4

### O4. Refunds/Disputes logging (payments)

- [ ]  Log signalen van refunds/disputes (indien relevant), geen credits auto-afboeken zonder policy.
- Acceptance criteria:
    - [ ]  Event wordt gelogd, handmatige reviewpad beschreven.
- Owner: Payments
- Inspanning: S
- Dependencies: geen

### O5. Fouten-taxonomie en codes

- [ ]  Definieer vaste foutcodes/boodschappen voor UI en API.
- Acceptance criteria:
    - [ ]  Errors eenduidig, vertaalbaar, met mapping in docs.
- Owner: Backend / Product
- Inspanning: S
- Dependencies: D7

### O6. Prijs-/creditsconfig als constants

- [ ]  Centraliseer pakketdefinities (prices↔credits) in één module en documenteer.
- Acceptance criteria:
    - [ ]  Eén bron van waarheid; tests bewaken mapping.
- Owner: Payments / Backend
- Inspanning: S
- Dependencies: D5

### O7. Function cold-start optimalisatie

- [ ]  Warm-up job of bundling optimaliseren; analyseer init-costs.
- Acceptance criteria:
    - [ ]  Cold-start latentie meetbaar omlaag of gedocumenteerd met trade-offs.
- Owner: DevOps
- Inspanning: S
- Dependencies: A5

---

## Micro-sjabloon per taak (voor Cascade)

Gebruik onderstaand micro-sjabloon telkens bij uitvoering:

- **Strategie:** waarom doen we dit
- **Stap:** 1 concrete actie
- **Jip-en-Janneke:** simpele uitleg
- **Validatievraag:** 1 controlevraag aan het eind

Voorbeeld A2:

- Strategie: logkosten omlaag zonder zicht te verliezen
- Stap: verlaag loglevel voor high-frequency events naar debug en activeer 50% sampling
- Jip-en-Janneke: we schrijven minder ruis weg, de kern blijft zichtbaar
- Validatievraag: is het aantal log-writes per run aantoonbaar gedaald en blijven kritieke events zichtbaar?

---

## Definition of Done (voor dit pakket)

- [ ]  Dependencies opgeschoond, geen critical advisories
- [ ]  CORS whitelists ingesteld, extra rate-limits actief waar passend
- [ ]  Privacy- en Security-addendum gepubliceerd en gelinkt vanuit UI
- [ ]  Ops/Deployment runbook actueel, `.env.example` synchroon met code
- [ ]  Secret-scan en env-schema handhaven in CI
- [ ]  Observability met correlation IDs live
- [ ]  Backups/export en fouttaxonomie gedocumenteerd