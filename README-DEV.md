# Development Setup Guide

Deze gids dekt zowel backend (Firebase Functions) als de nieuwe frontend-auth/v2-flow.

## 🔧 Environment Setup

- **Root**
  ```bash
  npm install
  ```
- **Functions**
  ```bash
  cd functions
  npm ci
  echo "OPENAI_API_KEY=your-openai-key-here" > .env   # alleen nodig voor legacy/httpGenerate
  ```
- **Frontend**
  Maak `frontend/.env.development.local` met (waarden voor emulator):
  ```env
  VITE_API_MODE=legacy
  VITE_API_BASE_URL=http://127.0.0.1:5001/etsy-ai-hacker/us-central1

  VITE_FIREBASE_API_KEY=fake
  VITE_FIREBASE_AUTH_DOMAIN=localhost
  VITE_FIREBASE_PROJECT_ID=etsy-ai-hacker
  VITE_FIREBASE_APP_ID=fake-app-id
  ```

## 🚀 Lokale emulators & devserver

- **Start emulators (auth + functions + firestore)**
  ```bash
  cd functions
  firebase emulators:start
  ```
- **Start frontend (in tweede terminal)**
  ```bash
  cd frontend
  npm run dev
  ```

De Emulator UI draait op `http://127.0.0.1:4001/`. Auth-emulator: `http://127.0.0.1:9099`. Functions-endpoint: `http://127.0.0.1:5001/etsy-ai-hacker/us-central1`.

## 🧪 Smoketests

- **Aanmelden in Auth-emulator** (PowerShell voorbeeld)
  ```powershell
  $signup = @{
    email = "tester@example.com"
    password = "Geheim123!"
    returnSecureToken = $true

  Invoke-RestMethod -Uri "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake" -Method Post -ContentType "application/json" -Body $signup
  ```
  Hergebruik dezelfde gegevens voor `signInWithPassword` om een ID-token te krijgen als je via scripts wilt testen.

- **Frontend rooktest**
  1. Open `http://localhost:5173/` en log in via de rechterkolom (Auth-panel). Rechtsboven moet "Ingelogd als …" verschijnen.
  2. Zet "Use v2 (auth required)" **aan**. Klik *Generate (v2)* → verwacht: HTTP 200, drie panelen (Title/Description/Tags), logregel "HTTP 200 • generated".
  3. **Context & Targeting (v2 optioneel):** Open de "Context & Targeting" sectie en vul velden in:
     - Audience: `yoga enthusiasts`
     - Age Bracket: `25-34`
     - Tone Profile: `casual, friendly`
     - Gift Mode: Aanvinken
     
     Klik *Generate (v2)* → Network-tab toont `settings` object in POST body met deze waarden.
  4. Zet toggle **uit** (legacy). Klik *Generate* → verwacht: zelfde output via HMAC (geen auth vereist).
  5. DevTools → Network confirm: `OPTIONS …/api_generateV2` → 204 en `POST …/api_generateV2` → 200.
  6. Zet de wallet-badge aan (*Toon wallet*) → saldo verschijnt + laatste transacties. Klik *Generate (v2)* opnieuw: saldo daalt en ledger krijgt een `type: debit` entry.

- **Wallet & credits rooktest**
  1. Activeer "Toon wallet". Noteer huidig saldo.
  2. (Optioneel) Gebruik de Stripe CLI shortcut / webhook-bypass zodat `bookStripeCreditTx` wordt getriggerd. Verwacht: nieuwe `type: credit` entry en saldo stijgt.
  3. Klik *Ververs* om `api_getWallet` opnieuw uit te lezen. Badge en tabel moeten het nieuwe saldo tonen.

## 💳 Stripe CLI Bypass (Development Credits)

Voor lokale ontwikkeling kun je credits toevoegen zonder echte betaling via de Stripe CLI test-bypass:

1. **Installeer Stripe CLI** (als nog niet gedaan):
   ```powershell
   scoop install stripe
   # Of: https://stripe.com/docs/stripe-cli
   ```

2. **Login bij Stripe CLI**:
   ```bash
   stripe login
   ```

3. **Zorg dat emulators draaien** (auth + functions + firestore):
   ```bash
   cd functions
   firebase emulators:start
   ```

4. **Trigger webhook-bypass**:
   ```bash
   cd functions
   npm run test:e2e
   ```
   
   Dit script:
   - Zet `TEST_ALLOW_CLI_CHECKOUT=1` in `functions/.env`
   - Triggert `stripe trigger checkout.session.completed` met `metadata.testing=cli`
   - Webhook detecteert CLI-bypass en boekt 1000 credits (standaard dev-plan)

5. **Verificatie**:
   - Frontend: refresh wallet → saldo +1000
   - Ledger: nieuwe `type: credit` entry met `source: stripe` en `eventId`
   - Firestore: check `wallet_ledger/{stripe_evt_...}` doc

### Debit Test (Credits Verbruiken)

1. Zorg dat je ≥1 credit hebt (zie hierboven)
2. Klik *Generate (v2)* in frontend
3. Verwacht: 
   - Saldo daalt met 1
   - Ledger krijgt `type: debit` entry met `source: generate` en `requestId`
   - Bij 0 credits: volgende generate geeft 429 + error "Daily credit limit reached"

- **API rooktest via curl (optioneel)**
  ```bash
  curl -X POST \
    -H "Authorization: Bearer <ID_TOKEN>" \
    -d '{"mode":"dump","payload":"Handmade silver ring"}' \
    http://127.0.0.1:5001/etsy-ai-hacker/us-central1/api_generateV2
  ```

## 📊 Monitoring & Logs

- **Emulator UI**: `http://127.0.0.1:4001/` → bekijk Functions/Firestore logs.
- **Functions console** toont CORS-preflight en auth meldingen.
- Firestore emulator log (`functions/firestore-debug.log`) bevat run-entries.

## 🔄 Handige scripts

```bash
# Root
npm run lint           # indien geconfigureerd
npm test               # unit/Jest

# Functions
npm run emulators:clean

# Frontend
npm run typecheck      # tsc --noEmit
```

## 🐛 Troubleshooting

- **Port conflicts***
  ```bash
  taskkill /f /im node.exe
  taskkill /f /im java.exe
  ```
- **CORS 401 op v2**: check dat `VITE_API_BASE_URL` op `http://127.0.0.1:5001/...` staat en Vite opnieuw is gestart.
- **"api-key-not-valid"**: frontend gebruikt nog niet de Auth-emulator → herstart Vite zodat `connectAuthEmulator` actief wordt.
- **Legacy fallback**: bij issues met Firebase kun je altijd tijdelijk terug naar legacy door toggle uit te zetten (HMAC-route blijft actief).
