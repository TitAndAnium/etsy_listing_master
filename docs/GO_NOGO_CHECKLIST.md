# Go/No-Go Checklist - Project Afronding

Gebruik deze checklist voor finale verificatie voordat project als "klaar" wordt verklaard.

---

## 🔥 Kritieke Path (Must Have)

### Backend Functions
- [ ] **Tests groen:** `cd functions && npm test` → alle tests passed
- [ ] **Build succesvol:** `npm run build` (indien TypeScript) → geen errors
- [ ] **Emulator start:** `firebase emulators:start` → functions laden zonder crashes
- [ ] **v2 generate:** POST `/api_generateV2` met Bearer token → 200 response met title/description/tags
- [ ] **Regenerate v2:** POST `/api_regenerateField` met field + context → 200 met regenerated payload
- [ ] **CORS preflight:** OPTIONS request → 204 met correct CORS headers
- [ ] **Auth enforced:** Request zonder Bearer token → 401

### Credits & Wallet
- [ ] **Credits ophalen:** GET `/api_getUserCredits` → `{uid, credits}`
- [ ] **Wallet ophalen:** GET `/api_getWallet` → `{uid, credits, ledger[]}`
- [ ] **Debit flow:** Generate → credits -1, ledger bevat `type: debit`
- [ ] **429 bij 0 credits:** Generate zonder credits → 429 "Daily credit limit reached"
- [ ] **Stripe CLI bypass:** `npm run test:e2e` → +1000 credits in wallet
- [ ] **Idempotency:** Duplicate Stripe event → geen dubbele booking

### Frontend
- [ ] **Dev server start:** `cd frontend && npm run dev` → localhost:5173
- [ ] **Login werkt:** Auth emulator login → "Ingelogd als {email}" badge
- [ ] **v2 toggle:** Schakel v2 aan → "Use v2 (auth required)" actief
- [ ] **Generate v2:** Klik Generate → 200, ResultCards tonen title/description/tags
- [ ] **Copy toast:** Klik Copy → "✓ Gekopieerd" toast verschijnt 2s
- [ ] **Context & Targeting:** Vul audience/age/tone/gift → payload bevat `settings` object
- [ ] **Wallet badge:** Credits badge toont correct saldo
- [ ] **Wallet paneel:** "Toon wallet" → laatste 10 ledger items zichtbaar
- [ ] **Legacy mode:** Toggle uit → Generate werkt via HMAC (geen auth)

### CORS & Security
- [ ] **Localhost toegestaan:** Dev frontend → OPTIONS + POST werken
- [ ] **Productie whitelist:** `ALLOWED_ORIGINS` env variabele ingesteld
- [ ] **Unknown origin blocked:** Request van evil.com → `Access-Control-Allow-Origin: null`
- [ ] **Server-to-server:** Request zonder Origin header → toegestaan

---

## 📋 Productie Deployment (Production Ready)

### Firebase Functions
- [ ] **Env variabelen ingesteld:**
  - `OPENAI_API_KEY` (production key)
  - `ALLOWED_ORIGINS=https://sellsiren.com,https://www.sellsiren.com`
  - `STRIPE_SECRET` (production key)
  - `STRIPE_WEBHOOK_SECRET` (production webhook secret)
- [ ] **Deploy succesvol:** `firebase deploy --only functions` → geen errors
- [ ] **Health check:** curl production endpoint → 200 of 401 (niet 500/timeout)

### Frontend Hosting
- [ ] **Build succesvol:** `cd frontend && npm run build` → dist/ aangemaakt
- [ ] **Deploy:** Frontend gehost op sellsiren.com/generator
- [ ] **HTTPS check:** SSL certificaat geldig
- [ ] **CORS test:** Frontend op sellsiren.com → POST naar functions → 200

### Stripe Integration
- [ ] **Webhook URL:** Ingesteld in Stripe Dashboard (`/stripeWebhook`)
- [ ] **Test mode:** Test checkout → credits geboekt
- [ ] **Production keys:** Echte keys ingesteld (niet test keys)
- [ ] **Catalog sync:** `stripeCatalog.json` bevat production price IDs

---

## ✅ Nice-to-Have (Optioneel)

### Documentatie
- [ ] **README-DEV:** Up-to-date met laatste features
- [ ] **CORS_PRODUCTION_PLAN:** ALLOWED_ORIGINS gedocumenteerd
- [ ] **STRIPE_CREDITS_SMOKETEST:** Volledige test flows beschreven
- [ ] **WP_FLATSOME_INTEGRATION:** Iframe shortcode gedocumenteerd

### WordPress Plugin
- [ ] **Plugin geüpload:** v0.3.0 met v2 iframe shortcode
- [ ] **Legacy shortcode:** `[etsy_ai_generator]` werkt (HMAC)
- [ ] **v2 shortcode:** `[etsy_ai_generator_v2]` toont iframe
- [ ] **Flatsome UX:** Beide elements beschikbaar in builder
- [ ] **Staging test:** WP staging toont iframe correct

### Monitoring
- [ ] **Functions logs:** Geen errors in production logs
- [ ] **Firestore usage:** Binnen quota
- [ ] **OpenAI usage:** Binnen budget
- [ ] **Stripe events:** Alle webhooks 200 response

---

## 🚨 Blockers (Project NIET klaar als deze NIET groen zijn)

- [ ] **Geen syntax errors** in functions/index.js
- [ ] **OPENAI_API_KEY** ingesteld (niet dummy)
- [ ] **Firebase admin SDK** geïnitialiseerd
- [ ] **Auth middleware** werkt (401 zonder token)
- [ ] **CORS headers** aanwezig (preflight + main request)
- [ ] **Credits guard** actief (429 bij 0 credits)
- [ ] **Wallet ledger** toont debit/credit correct

---

## 📊 Besluit

**Go:** Alle Kritieke Path items + Productie Deployment items zijn groen  
**No-Go:** Eén of meer Kritieke Path items zijn rood → fix & retest  
**Soft-Launch:** Kritieke Path groen, Nice-to-Have gedeeltelijk → productie met monitoring

---

## ✍️ Sign-Off

**Geteste Door:** _________________  
**Datum:** _________________  
**Status:** [ ] GO  [ ] NO-GO  [ ] SOFT-LAUNCH  
**Opmerkingen:**  
_____________________________________________
_____________________________________________
