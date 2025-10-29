# Stripe Webhook Setup (Productie)

Complete setup van Stripe webhook endpoint voor credit booking.

---

## Pre-Setup Checklist

- [ ] Stripe account met production access
- [ ] Firebase Functions deployed (`stripeWebhook` endpoint live)
- [ ] `STRIPE_SECRET` en `STRIPE_WEBHOOK_SECRET` env variabelen ingesteld

---

## Stap 1: Webhook Endpoint Toevoegen in Stripe Dashboard

1. **Login bij Stripe Dashboard:**
   - Ga naar https://dashboard.stripe.com
   - Switch naar **Production mode** (toggle rechtsboven)

2. **Navigeer naar Webhooks:**
   - Developers → Webhooks
   - Click "Add endpoint"

3. **Endpoint configuratie:**
   ```
   Endpoint URL: https://us-central1-etsy-ai-hacker.cloudfunctions.net/stripeWebhook
   Description: Firebase Functions - Credit Booking
   Events to send: Select specific events
   ```

4. **Selecteer events:**
   - ✅ `checkout.session.completed`
   - ✅ `checkout.session.async_payment_succeeded` (optioneel, voor async betalingen)
   - ✅ `checkout.session.async_payment_failed` (optioneel, voor logging)

5. **Save endpoint**

6. **Kopieer Webhook Signing Secret:**
   - Format: `whsec_xxxxxxxxxxxxxxxxxxxxxx`
   - **Belangrijk:** Dit is NIET de API key, maar de signing secret

---

## Stap 2: Webhook Secret Instellen in Firebase

```bash
# Set webhook secret via Firebase CLI
firebase functions:config:set stripe.webhook_secret="whsec_xxxxxxxxxxxxxxxxxxxxxx"

# Verify
firebase functions:config:get stripe.webhook_secret

# Redeploy functions (webhook secret wordt pas actief na redeploy)
firebase deploy --only functions:stripeWebhook
```

---

## Stap 3: Test Webhook (Stripe CLI)

**Install Stripe CLI (indien nog niet gedaan):**
```bash
# Windows (Scoop)
scoop install stripe

# Verify
stripe --version
```

**Login:**
```bash
stripe login
```

**Forward events naar local endpoint (voor testing):**
```bash
# Start emulators (in terminal 1)
cd functions
firebase emulators:start

# Forward webhooks (in terminal 2)
stripe listen --forward-to http://127.0.0.1:5001/etsy-ai-hacker/us-central1/stripeWebhook

# Expected output:
# Ready! You are using Stripe API Version [...]
# Webhook signing secret: whsec_... (use this in functions/.env)
```

**Trigger test event:**
```bash
# In terminal 3
stripe trigger checkout.session.completed
```

**Expected logs:**
- Emulator functions log: `🧾 ledger + credited 1000 to <uid>`
- Stripe CLI: `[200] POST /stripeWebhook`

---

## Stap 4: Production Webhook Test

**Via Stripe Dashboard:**

1. **Test transaction:**
   - Gebruik test checkout flow (zie STRIPE_CREDITS_SMOKETEST.md Flow B)
   - Complete payment met test card: `4242 4242 4242 4242`

2. **Verify webhook delivery:**
   - Stripe Dashboard → Developers → Webhooks
   - Click op endpoint → Recent deliveries
   - **Check status:**
     - ✅ Success (200 OK)
     - ❌ Failed (500/400) → check function logs

3. **Check Firebase logs:**
   ```bash
   firebase functions:log --only stripeWebhook --limit 20
   ```
   - Zoek naar: `🧾 ledger + credited ... to <uid>`
   - Check errors: `Webhook handling failed`

4. **Verify Firestore:**
   - `stripe_events/{eventId}` doc bestaat (idempotency guard)
   - `wallet_ledger` bevat nieuwe entry met `type: credit`
   - `users/{uid}` doc heeft verhoogd `credits` veld

---

## Stap 5: Idempotency Verificatie

**Test duplicate events:**

1. **Via Stripe Dashboard:**
   - Developers → Webhooks → Recent deliveries
   - Click op event → Resend event

2. **Expected behavior:**
   - Webhook endpoint → 200 OK
   - Functions log: "(none, skipped)" of "already processed"
   - Firestore: `stripe_events/{eventId}` bestaat al → geen dubbele booking
   - User credits: blijven gelijk (geen +1000 extra)

---

## Stap 6: Monitoring & Alerting

**Stripe Dashboard monitoring:**
- Developers → Webhooks → Endpoint
- Check "Recent deliveries" tab dagelijks (eerste week)
- Failure rate moet < 1% zijn

**Firebase monitoring:**
```bash
# Real-time logs
firebase functions:log --only stripeWebhook --follow

# Error aggregation
firebase functions:log --only stripeWebhook --limit 100 | grep "error"
```

**Slack/Email alerts (optioneel):**
```bash
# Configure alert voor failures
firebase functions:alerts:create \
  --function stripeWebhook \
  --threshold 3 \
  --period 300
```

---

## Troubleshooting

### Webhook geeft 400: "Invalid signature"

**Oorzaak:** Verkeerde `STRIPE_WEBHOOK_SECRET`

**Fix:**
```bash
# Verify secret in Stripe Dashboard (Webhooks → Endpoint → Signing secret)
# Update Firebase config
firebase functions:config:set stripe.webhook_secret="whsec_CORRECTE_SECRET"
firebase deploy --only functions:stripeWebhook
```

### Webhook geeft 500: "Internal error"

**Check functions logs:**
```bash
firebase functions:log --only stripeWebhook --limit 50
```

**Common causes:**
- Firestore permission denied → check rules
- Missing `STRIPE_SECRET` → verify `firebase functions:config:get`
- Invalid price ID in catalog → check `functions/config/stripeCatalog.json`

### Credits niet geboekt

**Verificatie stappen:**
1. Check `stripe_events/{eventId}` exists → idempotency guard
2. Check `session.line_items` bevat valid `priceId`
3. Verify `stripeCatalog.json` bevat deze `priceId`
4. Check `wallet_ledger` collectie voor entry met `eventId`

**Debug:**
```javascript
// Temporary debug logging in functions/index.js handleStripeWebhook
console.log('Session:', JSON.stringify(session, null, 2));
console.log('Line items:', JSON.stringify(lineItems, null, 2));
console.log('Plan:', plan);
```

### Test mode vs Production mode mismatch

**Symptom:** Webhook werkt in test mode maar niet in production

**Fix:**
- Verify Stripe Dashboard is in **Production mode** (toggle rechtsboven)
- Check `STRIPE_SECRET` is production key (`sk_live_...` niet `sk_test_...`)
- Webhook endpoint moet APARTE endpoints hebben voor test/prod

---

## Security Best Practices

1. **Signature verificatie:**
   - Code checkt `stripe.webhooks.constructEvent()` met signing secret
   - NOOIT webhook accepteren zonder signature check

2. **Idempotency:**
   - `stripe_events/{eventId}` guard voorkomt duplicate processing
   - Gebruik Firestore transaction voor atomic checks

3. **HTTPS only:**
   - Webhook endpoint moet HTTPS zijn (Firebase Functions standaard)

4. **Rate limiting:**
   - Stripe retry policy: 3x met exponential backoff
   - Onze code heeft geen expliciete rate limit (webhook is server-to-server)

5. **Logging:**
   - Log alle events (success + failure)
   - NOOIT log volledige card details (PCI compliance)

---

## Success Criteria

✅ **Webhook setup succesvol** als:
1. Endpoint zichtbaar in Stripe Dashboard (Production mode)
2. Test transaction → `checkout.session.completed` event verstuurd
3. Webhook delivery → 200 OK status
4. Functions log → `🧾 ledger + credited ...`
5. Firestore → `wallet_ledger` entry + `stripe_events` guard
6. User credits → verhoogd met correct bedrag
7. Duplicate event → 200 OK maar geen dubbele booking

---

## Monitoring Checklist (First Week)

- [ ] Dag 1: Check alle webhook deliveries (moet 100% success zijn)
- [ ] Dag 2-3: Verify eerste echte transacties correct geboekt
- [ ] Dag 4-7: Monitor failure rate (moet < 1% blijven)
- [ ] Week 2: Setup automated alerts voor failures
- [ ] Maand 1: Review logs voor edge cases

---

## References

- Stripe Webhooks Docs: https://stripe.com/docs/webhooks
- Firebase Functions Logs: https://console.firebase.google.com/project/etsy-ai-hacker/functions/logs
- Codebase: `functions/index.js` → `handleStripeWebhook()`
- Smoketest: `docs/STRIPE_CREDITS_SMOKETEST.md`
