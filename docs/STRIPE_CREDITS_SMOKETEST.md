# Stripe Credits Smoketest (Staging & Production)

## Doel
End-to-end verificatie van de volledige credits flow: checkout session → betaling → webhook → credit booking → wallet update.

---

## Vereisten

### Development/Staging
- ✅ Firebase Emulators draaien (auth, functions, firestore)
- ✅ Stripe CLI geïnstalleerd en ingelogd (`stripe login`)
- ✅ `TEST_ALLOW_CLI_CHECKOUT=1` in `functions/.env`
- ✅ Frontend draait op localhost:5173

### Production
- ✅ Firebase Functions deployed
- ✅ Stripe webhook endpoint geconfigureerd in Stripe Dashboard
- ✅ CORS whitelist actief (sellsiren.com)
- ✅ Frontend deployed op sellsiren.com

---

## Test Flow A: Development (Stripe CLI Bypass)

### Stap 1: Emulators Starten
```bash
cd functions
firebase emulators:start
```
Wacht tot Functions emulator op http://127.0.0.1:5001 draait.

### Stap 2: Stripe CLI Webhook Listener
```bash
stripe listen --forward-to http://127.0.0.1:5001/etsy-ai-hacker/us-central1/stripeWebhook
```
Noteer de webhook signing secret (ws_test_...) en zet in `functions/.env`:
```
STRIPE_WEBHOOK_SECRET=ws_test_...
```

### Stap 3: Trigger Test Event
```bash
cd functions
npm run test:e2e
```
Dit script triggert `checkout.session.completed` met `metadata.testing=cli`.

### Stap 4: Verificatie
**Expected Output:**
- Stripe listener toont: `[200] POST /stripeWebhook`
- Functions log: `🧾 ledger + credited 1000 to <uid> (plan=price_...)`

**Frontend Check:**
1. Open http://localhost:5173
2. Log in met test user
3. Klik "Toon wallet" → Verwacht: saldo +1000
4. Ledger toont: `type: credit`, `source: stripe`, `credits: 1000`

**Firestore Check (Emulator UI):**
- `wallet_ledger/{stripe_evt_...}` doc bestaat
- `users/{uid}` doc heeft `credits: 1000`

---

## Test Flow B: Staging/Production (Echte Checkout)

### Stap 1: Checkout Session Aanmaken
```bash
# Via curl of frontend
curl -X POST \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"priceId":"price_1234AbcDEF"}' \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_createCheckoutSession
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

### Stap 2: Checkout Voltooien
- Open de checkout URL in browser
- Gebruik Stripe test card: `4242 4242 4242 4242`, exp: 12/34, CVC: 123
- Klik "Pay"

### Stap 3: Webhook Verificatie
**Stripe Dashboard:**
- Events → zoek `checkout.session.completed`
- Status moet `succeeded` zijn
- Webhook delivery moet 200 response tonen

**Functions Logs:**
```bash
firebase functions:log --only stripeWebhook --limit 10
```
Zoek naar: `🧾 ledger + credited ... to <uid>`

### Stap 4: Frontend/Firestore Check
- Refresh wallet in frontend → saldo verhoogd
- Firestore `wallet_ledger` bevat nieuwe entry met `eventId`

---

## Test Flow C: Idempotency Check

### Doel
Verifieer dat duplicate events NIET dubbel geboekt worden.

### Stappen
1. Voltooi Flow A of B
2. Trigger hetzelfde event nogmaals:
   ```bash
   stripe trigger checkout.session.completed --override metadata.testing=cli
   ```
3. Check Functions log: moet `already processed` loggen (geen dubbele credit)
4. Firestore: `stripe_events/{eventId}` doc bestaat al → transactie skip

**Expected:**
- Webhook returnt 200
- Geen nieuwe ledger entry
- Credits blijven gelijk

---

## Test Flow D: Debit (Credits Verbruiken)

### Stap 1: Zorg voor ≥1 Credit
Via Flow A of B.

### Stap 2: Generate Request
```bash
curl -X POST \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"dump","payload":"silver ring"}' \
  http://127.0.0.1:5001/etsy-ai-hacker/us-central1/api_generateV2
```

### Stap 3: Verificatie
- Response header: `x-credits-remaining: 999` (of lager)
- Ledger entry: `type: debit`, `source: generate`, `credits: -1`
- User doc: `credits` gedaald met 1

### Stap 4: Credits Exhausted (429)
Herhaal generate tot credits = 0, dan:
```bash
# Volgende request geeft:
HTTP 429
{
  "error": "Daily credit limit reached",
  "code": "CREDITS_EXHAUSTED",
  "credits_remaining": 0
}
```

---

## Go/No-Go Checklist

- [ ] **CLI Bypass:** `npm run test:e2e` boekt 1000 credits
- [ ] **Echte Checkout:** Stripe test card → credits geboekt
- [ ] **Idempotency:** Duplicate event → geen dubbele booking
- [ ] **Debit:** Generate → credits dalen, ledger correct
- [ ] **429 Error:** Bij 0 credits → "Daily credit limit reached"
- [ ] **Webhook Logs:** Alle events tonen 200 response
- [ ] **Firestore:** `wallet_ledger` en `stripe_events` correct

---

## Troubleshooting

### Webhook geeft 400/500
- Check `STRIPE_WEBHOOK_SECRET` in env
- Verify signature in Stripe Dashboard → Events → Webhook attempts
- Functions log: zoek naar `Webhook handling failed`

### Credits niet geboekt
- Check `stripe_events/{eventId}` bestaat (idempotency guard)
- Verify `line_items` bevat valid `priceId`
- Check catalogus in `functions/config/stripeCatalog.json`

### CLI Bypass werkt niet
- `TEST_ALLOW_CLI_CHECKOUT=1` in `functions/.env`?
- Metadata bevat `testing: 'cli'`?
- Emulator herstart na env-wijziging?

---

## Production Deployment Checklist

Voordat je live gaat:

- [ ] Stripe webhook URL instellen: `https://us-central1-etsy-ai-hacker.cloudfunctions.net/stripeWebhook`
- [ ] Webhook secret opslaan als Firebase env: `firebase functions:config:set stripe.webhook_secret=whsec_...`
- [ ] Test met Stripe test mode (price_test_...)
- [ ] Ga live: switch naar production keys + price IDs
- [ ] Monitor eerste 10 transacties in Stripe Dashboard + Functions logs
