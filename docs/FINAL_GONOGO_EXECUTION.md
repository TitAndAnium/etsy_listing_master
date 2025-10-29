# Finale Go/No-Go Execution - Pre-Launch Verificatie

Complete doorloop van alle kritieke systemen voordat project live gaat.

---

## Executive Summary

**Doel:** Verificeer dat alle kernfunctionaliteit werkt in productie-omgeving  
**Focus items:** Regenerate v2, Debit/429, Idempotency, Wallet-ledger  
**Tijdsduur:** ~2-3 uur (inclusief wachttijden voor async processen)  
**Sign-off required:** Ja (zie template onderaan)

---

## KRITIEK: Regenerate v2 Verificatie

### Test 1: Regenerate Title

```bash
# Via curl (met valid ID token)
curl -X POST \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "field": "title",
    "context": {
      "ai_fields": {
        "title": "Silver Ring Handmade",
        "description": "Beautiful handmade silver ring",
        "tags": ["silver", "ring", "handmade"]
      },
      "audience": "yoga enthusiasts",
      "age_bracket": "25-34",
      "tone_profile": "casual",
      "gift_mode": true
    }
  }' \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_regenerateField
```

**Expected response:**
```json
{
  "field": "title",
  "payload": {
    "value": "Handmade Silver Ring - Perfect Yoga Gift for Women 25-34",
    "retry_reason": "",
    "warnings": []
  },
  "meta": {
    "prompt_version": "regenerate_v1",
    "model": "gpt-4",
    "token_usage": {
      "prompt_tokens": 150,
      "completion_tokens": 25,
      "total_tokens": 175
    },
    "context_used": { ... }
  }
}
```

**Verification checklist:**
- [ ] Status: 200 OK
- [ ] `payload.value` bevat nieuwe title (niet identiek aan input)
- [ ] `meta.token_usage` toont OpenAI call (niet dummy)
- [ ] `x-credits-remaining` header aanwezig
- [ ] Response time < 10 seconden

### Test 2: Regenerate Description

```bash
curl -X POST \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "field": "description",
    "context": {
      "ai_fields": {
        "title": "Handmade Silver Ring",
        "description": "Basic description here",
        "tags": ["silver", "ring"]
      },
      "audience": "minimalist jewelry lovers"
    }
  }' \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_regenerateField
```

**Expected:**
- Status: 200
- `payload.value` bevat nieuwe description (> 100 characters)
- Context merge zichtbaar in output (minimalist theme)

### Test 3: Regenerate Tags

```bash
curl -X POST \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "field": "tags",
    "context": {
      "ai_fields": {
        "title": "Silver Ring",
        "description": "Handmade silver ring",
        "tags": ["silver", "ring"]
      }
    }
  }' \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_regenerateField
```

**Expected:**
- Status: 200
- `payload.items` array met 13 tags
- Tags relevant voor "silver ring"
- Stem deduplicatie (geen "ring" + "rings")

### Test 4: Regenerate Credits Cost

**Scenario:** Verify 0.5 credits consumption per regenerate

```bash
# 1. Check starting credits
curl -X GET \
  -H "Authorization: Bearer <ID_TOKEN>" \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_getUserCredits

# Note credits (e.g., 1000)

# 2. Regenerate title
curl -X POST \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"field":"title","context":{"ai_fields":{"title":"Test"}}}' \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_regenerateField

# 3. Check credits again
curl -X GET \
  -H "Authorization: Bearer <ID_TOKEN>" \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_getUserCredits

# Expected: credits reduced by 0.5 (now 999.5)
```

**Verification:**
- [ ] Credits daalde met 0.5
- [ ] `wallet_ledger` bevat entry: `type: debit`, `credits: -0.5`, `source: regenerate`

---

## KRITIEK: Debit/429 Flow Verificatie

### Test 5: Normal Debit (Generate with Credits)

```bash
# 1. Ensure user has ≥1 credit
curl -X GET \
  -H "Authorization: Bearer <ID_TOKEN>" \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_getUserCredits

# Expected: {"uid": "...", "credits": X} where X >= 1

# 2. Generate request
curl -X POST \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"dump","payload":"silver ring test"}' \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2

# 3. Verify debit in wallet
curl -X GET \
  -H "Authorization: Bearer <ID_TOKEN>" \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_getWallet
```

**Verification checklist:**
- [ ] Generate response: 200 OK met title/description/tags
- [ ] Header: `x-credits-remaining: X-1`
- [ ] Wallet ledger entry:
  ```json
  {
    "type": "debit",
    "credits": -1,
    "source": "generate",
    "requestId": "...",
    "createdAt": "..."
  }
  ```
- [ ] User `credits` field gedaald met 1

### Test 6: 429 Error (Insufficient Credits)

**Setup:** Reduce user credits to 0

```bash
# Spend all credits (repeat generate until 0)
# Or manually set in Firestore: users/{uid}/credits = 0

# Attempt generate with 0 credits
curl -X POST \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"dump","payload":"test"}' \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2
```

**Expected response:**
```json
{
  "error": "Daily credit limit reached",
  "code": "CREDITS_EXHAUSTED",
  "bucket_key": "daily:2025-10-22:<uid>",
  "credits_remaining": 0,
  "credits_required": 1
}
```

**Verification:**
- [ ] Status: 429 Too Many Requests
- [ ] Error code: `CREDITS_EXHAUSTED`
- [ ] Header: `x-credits-remaining: 0`
- [ ] No debit in wallet_ledger (geen nieuwe entry)

### Test 7: Frontend 429 Handling

**Browser test:**
1. Open frontend: https://sellsiren.com
2. Login met user die 0 credits heeft
3. Toggle v2 aan
4. Click "Generate"

**Expected behavior:**
- Error message: "Onvoldoende credits. Koop credits om verder te gaan."
- "+ Add credits" link verschijnt
- Wallet badge toont 0 (rood/warn status)

---

## KRITIEK: Idempotency Verificatie

### Test 8: Stripe Event Idempotency

**Setup:** Complete een Stripe checkout (zie STRIPE_CREDITS_SMOKETEST.md)

```bash
# 1. Trigger checkout via Stripe CLI (test mode)
stripe trigger checkout.session.completed \
  --add checkout_session:metadata.uid=testuser123 \
  --add checkout_session:metadata.testing=cli

# 2. Check webhook delivery in Stripe Dashboard
# Expected: 200 OK

# 3. Verify credits booked
# Firestore: wallet_ledger → new entry with type: credit

# 4. RESEND same event (idempotency test)
# Stripe Dashboard → Webhooks → Recent deliveries → Select event → Resend

# 5. Check function logs
firebase functions:log --only stripeWebhook --limit 10
```

**Expected behavior:**
- First event: `🧾 ledger + credited 1000 to testuser123`
- Resend event: "(skipped, already processed)" or silent 200
- Firestore: `stripe_events/{eventId}` doc exists (guard)
- User credits: NO additional +1000 (blijft gelijk)

**Verification:**
- [ ] First webhook: 200 OK + credit booking
- [ ] Duplicate webhook: 200 OK maar GEEN dubbele booking
- [ ] `stripe_events` collection bevat event ID
- [ ] User credits correct (single booking)

### Test 9: Generate Request Idempotency (Bonus)

**Note:** Generate requests zijn NIET idempotent (elke call verbruikt credits)

```bash
# Same payload, multiple times
for i in {1..3}; do
  curl -X POST \
    -H "Authorization: Bearer <ID_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"mode":"dump","payload":"identical test"}' \
    https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2
done

# Expected: 3 separate debit entries in wallet_ledger
# Credits reduced by 3
```

**This is CORRECT behavior** - geen idempotency voor generate (user intent is meerdere generaties)

---

## KRITIEK: Wallet-Ledger Verificatie

### Test 10: Ledger Query Performance

```bash
# Get wallet with 10 ledger entries
curl -X GET \
  -H "Authorization: Bearer <ID_TOKEN>" \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_getWallet
```

**Expected response:**
```json
{
  "uid": "testuser123",
  "credits": 999,
  "ledger": [
    {
      "id": "stripe_evt_...",
      "type": "credit",
      "credits": 1000,
      "source": "stripe",
      "eventId": "evt_...",
      "sessionId": "cs_...",
      "createdAt": "..."
    },
    {
      "id": "gen_...",
      "type": "debit",
      "credits": -1,
      "source": "generate",
      "requestId": "...",
      "createdAt": "..."
    }
    // ... up to 10 entries
  ]
}
```

**Verification:**
- [ ] Status: 200 OK
- [ ] `ledger` array bevat max 10 items (orderBy createdAt desc)
- [ ] Response time < 2 seconden
- [ ] Each entry heeft: id, type, credits, source, createdAt
- [ ] No duplicate IDs (unique constraint)

### Test 11: Ledger Firestore Index

**Verify composite index exists:**

```bash
# Check firestore.indexes.json
cat firestore.indexes.json | grep -A 5 wallet_ledger
```

**Expected:**
```json
{
  "collectionGroup": "wallet_ledger",
  "queryScope": "COLLECTION",
  "fields": [
    {"fieldPath": "uid", "order": "ASCENDING"},
    {"fieldPath": "createdAt", "order": "DESCENDING"}
  ]
}
```

**Deploy index (if not deployed):**
```bash
firebase deploy --only firestore:indexes
```

### Test 12: Ledger Data Integrity

**Manual Firestore check:**
1. Firebase Console → Firestore → `wallet_ledger` collection
2. Filter: `uid == testuser123`
3. Order: `createdAt desc`

**Verification:**
- [ ] All entries have `uid`, `type`, `credits`, `source`, `createdAt`
- [ ] `type` is either `credit` or `debit`
- [ ] `credits` value matches type (credit > 0, debit < 0)
- [ ] Timestamps chronological (newest first)
- [ ] No orphaned entries (uid exists in users collection)

---

## Additional Critical Tests

### Test 13: Rate Limiting

```bash
# Spam requests (12+ per minute)
for i in {1..15}; do
  curl -X POST \
    -H "Authorization: Bearer <ID_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"mode":"dump","payload":"spam test '$i'"}' \
    https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2 &
done
wait

# Expected: First 12 succeed, rest get 429
```

### Test 14: Auth Enforcement

```bash
# Request without token
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"mode":"dump","payload":"test"}' \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2

# Expected: 401 Unauthorized
```

### Test 15: CORS Strict Whitelist

```bash
# Request from unknown origin
curl -X OPTIONS \
  -H "Origin: https://malicious-site.com" \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2

# Expected: Access-Control-Allow-Origin: null
```

---

## Go/No-Go Decision Matrix

### GO Criteria (ALL must be TRUE)

- [ ] **Regenerate v2:** Title/Description/Tags regeneratie werkt, OpenAI calls succesvol
- [ ] **Credits cost:** Regenerate verbruikt 0.5 credits correct
- [ ] **Debit flow:** Generate verbruikt 1 credit, wallet_ledger updated
- [ ] **429 Error:** Bij 0 credits correct error response (CREDITS_EXHAUSTED)
- [ ] **Frontend 429:** Error message + Add credits link zichtbaar
- [ ] **Stripe idempotency:** Duplicate events niet dubbel geboekt
- [ ] **Wallet ledger:** Query snel (< 2s), max 10 items, data correct
- [ ] **Firestore index:** Composite index deployed en actief
- [ ] **Rate limiting:** 12+ requests/min geblokkeerd
- [ ] **Auth enforcement:** Requests zonder token → 401
- [ ] **CORS whitelist:** Alleen sellsiren.com toegestaan

### NO-GO Criteria (ANY = BLOCK LAUNCH)

- [ ] Regenerate v2 geeft 500 errors of dummy responses
- [ ] Credits niet correct berekend (debit ≠ 1.0 of regenerate ≠ 0.5)
- [ ] 429 error ontbreekt (geen guard bij 0 credits)
- [ ] Stripe duplicate events dubbel geboekt
- [ ] Wallet ledger query > 5 seconden of incomplete data
- [ ] Functions crashes (500 errors op > 5% requests)
- [ ] CORS laat alle origins toe (security risk)

---

## Sign-Off Template

```
PROJECT: Etsy AI Listing Generator  
DEPLOYMENT: Production Launch  
DATE: _______________

VERIFICATION RESULTS:

☐ Regenerate v2: PASS / FAIL  
   Notes: _______________________________________

☐ Debit/429 Flow: PASS / FAIL  
   Notes: _______________________________________

☐ Idempotency: PASS / FAIL  
   Notes: _______________________________________

☐ Wallet-Ledger: PASS / FAIL  
   Notes: _______________________________________

☐ CORS/Security: PASS / FAIL  
   Notes: _______________________________________

DECISION: ☐ GO  ☐ NO-GO  ☐ GO WITH MONITORING

IF NO-GO, BLOCKERS:
1. _______________________________________
2. _______________________________________

SIGNED:
Developer: ________________  Date: ________
QA Lead:   ________________  Date: ________
Product:   ________________  Date: ________
```

---

## Post-Launch Monitoring (First 48 Hours)

**Hour 1:**
- [ ] Monitor functions logs (real-time)
- [ ] Check first 10 generate requests succeed
- [ ] Verify first Stripe transaction (if any)

**Hour 6:**
- [ ] Review error rate (must be < 1%)
- [ ] Check credits consumption patterns
- [ ] Verify wallet ledger growth

**Day 1:**
- [ ] Aggregate metrics: requests, errors, latency
- [ ] User feedback review
- [ ] CORS errors in browser logs?

**Day 2:**
- [ ] Stripe webhook delivery rate (100%?)
- [ ] Regenerate v2 usage statistics
- [ ] Idempotency incidents (should be 0)

---

## Emergency Rollback Triggers

**Immediate rollback if:**
- Functions error rate > 10%
- Stripe duplicate bookings detected
- CORS allowing all origins
- Credits calculation wrong (mass complaint)
- Auth bypass discovered

**Rollback procedure:** See `docs/DEPLOYMENT_GUIDE.md` → Rollback section

---

## Success Declaration

✅ **Project LIVE** when:
1. All GO criteria met
2. Sign-off completed
3. 48-hour monitoring clean
4. Zero critical bugs
5. User feedback positive

**🎉 CONGRATULATIONS - PROJECT COMPLETED! 🎉**
