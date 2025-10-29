# Production Deployment Guide

Stap-voor-stap deployment naar Firebase productie.

---

## Pre-Deployment Checklist

- [ ] Firebase CLI geïnstalleerd (`firebase --version`)
- [ ] Ingelogd met correcte account (`firebase login`)
- [ ] Project ID correct: `etsy-ai-hacker` (`firebase use etsy-ai-hacker`)
- [ ] Git commit van laatste wijzigingen
- [ ] Backup van huidige production functions (optioneel)

---

## Stap 1: Environment Variables Instellen

### Via Firebase CLI (Aanbevolen voor Productie)

```bash
# OpenAI API Key (productie key, NIET test key)
firebase functions:config:set openai.api_key="sk-proj-xxxxx"

# CORS whitelist (sellsiren.com origins)
firebase functions:config:set cors.allowed_origins="https://sellsiren.com,https://www.sellsiren.com"

# Stripe (productie keys)
firebase functions:config:set stripe.secret="sk_live_xxxxx"
firebase functions:config:set stripe.webhook_secret="whsec_xxxxx"

# App base URL
firebase functions:config:set app.base_url="https://us-central1-etsy-ai-hacker.cloudfunctions.net"

# Verificatie: toon alle config
firebase functions:config:get
```

### Via Google Cloud Console (Alternatief)

1. Ga naar [Google Cloud Console](https://console.cloud.google.com)
2. Selecteer project `etsy-ai-hacker`
3. Cloud Functions → Selecteer functie → Edit
4. Runtime environment variables → Add variable:
   - `OPENAI_API_KEY`: `sk-proj-xxxxx`
   - `ALLOWED_ORIGINS`: `https://sellsiren.com,https://www.sellsiren.com`
   - `STRIPE_SECRET`: `sk_live_xxxxx`
   - `STRIPE_WEBHOOK_SECRET`: `whsec_xxxxx`

---

## Stap 2: Pre-Deploy Verificatie

```bash
cd functions

# 1. Dependencies installeren
npm install

# 2. Tests draaien (MOET GROEN ZIJN)
npm test
# Expected: 38 passed

# 3. Lint check (indien beschikbaar)
npm run lint 2>/dev/null || echo "No lint script"

# 4. Build check (indien TypeScript)
npm run build 2>/dev/null || echo "No build script"
```

**Blocker:** Als tests NIET groen zijn → fix en retest. Deploy NIET met rode tests.

---

## Stap 3: Firebase Functions Deploy

```bash
# Dry-run (optioneel - toont wat gedeployed wordt)
firebase deploy --only functions --dry-run

# Echte deployment (alle functions)
firebase deploy --only functions

# Of specifieke functions (sneller voor updates)
firebase deploy --only functions:api_generateV2,functions:api_regenerateField,functions:api_reviewUserEdit
```

**Monitoring tijdens deploy:**
- Watch terminal output voor errors
- Expected: "✔  functions: Finished running predeploy script."
- Expected: "✔  Deploy complete!"

**Bij failures:**
```bash
# Bekijk deployment logs
firebase functions:log --limit 50

# Rollback naar vorige versie (via Firebase Console)
# Functions → Rollbacks tab → Select previous version
```

---

## Stap 4: Post-Deploy Health Check

```bash
# Test v2 generate endpoint (met test token)
curl -X OPTIONS \
  -H "Origin: https://sellsiren.com" \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2

# Expected: HTTP 204 + CORS headers

curl -X POST \
  -H "Origin: https://sellsiren.com" \
  -H "Authorization: Bearer <VALID_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"dump","payload":"silver ring"}' \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2

# Expected: HTTP 200 + JSON met title/description/tags
```

**Verificatie punten:**
- [ ] `api_generateV2` → 200 (met token) of 401 (zonder token)
- [ ] `api_getUserCredits` → 200 (met token)
- [ ] `api_getWallet` → 200 (met token)
- [ ] `api_regenerateField` → 200 (met token + valid body)
- [ ] `stripeWebhook` → bereikbaar (test via Stripe CLI)

---

## Stap 5: Environment Variables Verificatie

```bash
# Check of env vars correct zijn ingesteld
firebase functions:config:get

# Expected output (schema):
{
  "openai": {
    "api_key": "sk-proj-xxxxx"
  },
  "cors": {
    "allowed_origins": "https://sellsiren.com,https://www.sellsiren.com"
  },
  "stripe": {
    "secret": "sk_live_xxxxx",
    "webhook_secret": "whsec_xxxxx"
  },
  "app": {
    "base_url": "https://us-central1-etsy-ai-hacker.cloudfunctions.net"
  }
}
```

**Fallback check in code:**
De code leest env vars via `process.env.OPENAI_API_KEY` of via `functions.config().openai.api_key`. Zorg dat minimaal één van beide is ingesteld.

---

## Stap 6: CORS Productie Whitelist Verificatie

```bash
# Test toegestane origin (sellsiren.com)
curl -X OPTIONS \
  -H "Origin: https://sellsiren.com" \
  -v https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2 \
  2>&1 | grep "Access-Control-Allow-Origin"

# Expected: Access-Control-Allow-Origin: https://sellsiren.com

# Test geblokkeerde origin (evil.com)
curl -X OPTIONS \
  -H "Origin: https://evil.com" \
  -v https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2 \
  2>&1 | grep "Access-Control-Allow-Origin"

# Expected: Access-Control-Allow-Origin: null (browser zal blokkeren)
```

---

## Troubleshooting

### Error: "Function failed on loading user code"
- Check functions logs: `firebase functions:log --limit 50`
- Vaak: ontbrekende dependency of syntax error
- Fix: deploy opnieuw na correctie

### Error: "Insufficient permissions"
- Check Firebase IAM roles
- Required: Cloud Functions Admin, Service Account User

### Error: "OPENAI_API_KEY not set"
- Verify: `firebase functions:config:get`
- Set: `firebase functions:config:set openai.api_key="sk-proj-xxxxx"`
- Redeploy functions

### CORS errors in browser
- Check `ALLOWED_ORIGINS` env variabele
- Verify frontend origin exact match (https + www/non-www)
- Check functions logs voor CORS-related errors

---

## Rollback Procedure

**Via Firebase Console (UI):**
1. Firebase Console → Functions
2. Klik op functie → Rollbacks tab
3. Select vorige versie → Rollback

**Via CLI (alternatief):**
```bash
# List previous deployments
firebase deploy:list

# Deploy specific version (gebruik deployment ID)
firebase rollback --only functions --version <deployment-id>
```

---

## Monitoring Post-Deployment

**Firebase Console:**
- Functions → Logs (real-time monitoring)
- Performance → Check latency/errors
- Usage → Verify invocations binnen quota

**Alerting (optioneel):**
```bash
# Configureer alerts voor failures
firebase functions:alerts:create --function api_generateV2 --threshold 5 --period 300
```

**First Hour Checklist:**
- [ ] Monitor functions logs (geen crashes)
- [ ] Check Firestore writes (wallet_ledger, users)
- [ ] Stripe webhook events (test transaction)
- [ ] Frontend kan succesvol generate aanroepen
- [ ] Geen CORS errors in browser console

---

## Success Criteria

✅ **Deploy succesvol** als:
1. `firebase deploy --only functions` → geen errors
2. Health check endpoints → 200 responses
3. CORS whitelist → sellsiren.com toegestaan, anderen geblokkeerd
4. Environment variables → correct ingesteld en zichtbaar via `config:get`
5. Functions logs → geen crashes of critical errors
6. Frontend kan live API aanroepen (test vanaf sellsiren.com)
