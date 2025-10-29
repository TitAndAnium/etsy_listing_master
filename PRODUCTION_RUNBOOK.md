# Production Runbook - Etsy AI Hacker

## 🚀 Production Deployment Checklist

### Pre-Deployment

- [ ] **Secrets Rotated**: All secrets (OpenAI, Stripe, Slack) rotated and stored in Firebase Secrets
- [ ] **CORS Whitelist**: Verified whitelist contains only production domains
- [ ] **Credits System**: Atomic transactions tested with 0/1/10 credits scenarios
- [ ] **Cache Headers**: `firebase.json` configured with proper cache-control
- [ ] **Build Verification**: Frontend env vars correctly embedded in bundle
- [ ] **Tests Passing**: All Jest and E2E tests green

### Deployment Steps

#### 1. Set Firebase Secrets (First Time Only)

```bash
# Set all production secrets
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set STRIPE_SECRET
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:secrets:set SLACK_WEBHOOK_URL
```

**Important**: After setting secrets, you must deploy functions to access them.

#### 2. Deploy Functions

```bash
cd functions
npm ci
firebase deploy --only functions
```

**Expected Output**:
```
✔ functions: Finished running predeploy script.
i deploying functions
i functions: ensuring required API is enabled...
✔ functions: all necessary APIs are enabled
+ functions[api_generateV2(us-central1)]
+ functions[api_regenerateField(us-central1)]
... (all functions)
✔ Deploy complete!
```

#### 3. Deploy Frontend

```bash
cd frontend

# Clean previous build
if (Test-Path dist) { Remove-Item -Recurse -Force dist }

# Fresh install and build
npm ci
npm run build

# Verify env vars in bundle
Select-String -Path "dist/assets/*.js" -Pattern "us-central1-etsy-ai-hacker"
```

**Expected**: URL found in bundle with correct domain.

```bash
# Deploy to Firebase Hosting
cd ..
firebase deploy --only hosting
```

#### 4. Deploy Firestore Rules & Indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### Post-Deployment Verification

#### A. Smoke Tests

**1. Frontend Loads**
- [ ] Open https://etsy-ai-hacker.web.app in Incognito
- [ ] Clear cache + storage
- [ ] Verify no console errors
- [ ] Check Network tab: no CORS errors

**2. API Health Check**
```powershell
# Test public endpoint (no auth)
Invoke-RestMethod -Uri "https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_getUserCredits" -Method Get
```

**Expected**: `401 Authentication required` (correct behavior)

**3. Authenticated Flow**
- [ ] Login with test account
- [ ] Check credits display
- [ ] Generate listing (1 credit cost)
- [ ] Verify credits deducted
- [ ] Check `wallet_ledger` in Firestore

**4. Credits Exhaustion**
- [ ] Set user credits to 0 in Firestore
- [ ] Attempt generate
- [ ] Expected: `429 Insufficient credits`

**5. Stripe Webhook**
```bash
stripe trigger checkout.session.completed
```
- [ ] Check Firestore `wallet_ledger`
- [ ] Check Slack notification
- [ ] Verify credits added to user

---

## 🔒 Security Checklist

### Secrets Management

**✅ Done**:
- All secrets in Firebase Secrets (not in code)
- `.env` and `.runtimeconfig.json` in `.gitignore`
- `.env.example` files created (no secrets)

**Rotation Schedule**:
- OpenAI API Key: Every 90 days
- Stripe Keys: On security incident only
- Slack Webhook: Every 180 days

### CORS Configuration

**Production Whitelist** (in `functions/.env` or Firebase Config):
```bash
ALLOWED_ORIGINS=https://etsy-ai-hacker.web.app,https://etsy-ai-hacker.firebaseapp.com
```

**Verification**:
```bash
# Should BLOCK unknown origin
curl -X POST https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2 \
  -H "Origin: https://evil.com" \
  -H "Content-Type: application/json" \
  -d '{"payload":"test"}'
```
**Expected**: No `Access-Control-Allow-Origin` header → browser blocks

### Rate Limiting

**Current Settings**:
- `RATE_LIMIT_PER_MIN=12` per user
- Budget guard: `DAILY_BUDGET_USD=25`

**Monitor** via Cloud Logging:
```
[CORS] BLOCKED - Unknown origin: https://...
rate-limit exceeded for uid=...
```

---

## 🐛 Troubleshooting Guide

### Issue: "VITE_API_BASE_URL is not configured"

**Cause**: Frontend code reading env vars at runtime instead of compile-time.

**Fix**:
1. Check `frontend/src/api/env.ts` uses `import.meta.env.VITE_API_BASE_URL` (not in function)
2. Rebuild frontend: `npm run build`
3. Verify in bundle: `Select-String -Path "dist/assets/*.js" -Pattern "cloudfunctions.net"`
4. Redeploy hosting

**Verification**:
```bash
# Should find the URL
grep -r "us-central1-etsy-ai-hacker" frontend/dist/assets/
```

### Issue: CORS Preflight Fails (OPTIONS → 403)

**Symptoms**:
- Browser shows "CORS policy" error
- OPTIONS request fails before POST

**Debug**:
```powershell
# Test preflight directly
Invoke-WebRequest -Method OPTIONS `
  -Uri "https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2" `
  -Headers @{
    "Origin" = "https://etsy-ai-hacker.web.app"
    "Access-Control-Request-Method" = "POST"
    "Access-Control-Request-Headers" = "content-type,authorization"
  }
```

**Expected**: `204 No Content` + CORS headers

**Fix**:
1. Check `getAllowedOrigins()` includes your domain
2. Verify `applyCors()` called BEFORE `withAuth()`
3. Check function logs: `firebase functions:log`

### Issue: Credits Not Deducted

**Symptoms**:
- User can generate infinitely
- `wallet_ledger` empty

**Check**:
```javascript
// In functions/handlers/generateV2.js
// Should call spendCreditsTx() BEFORE generateFromDumpCore()
```

**Debug**:
```bash
# Check Firestore
firebase firestore:get users/<uid>
firebase firestore:get wallet_ledger --limit 5
```

**Fix**: Ensure transaction runs atomically (no try-catch swallowing errors)

### Issue: Stripe Webhook Returns 400

**Symptoms**:
- Stripe dashboard shows webhook failed
- Error: "Webhook signature verification failed"

**Check**:
1. `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
2. Function receives `req.rawBody` (not parsed JSON)
3. Signature header present: `req.headers['stripe-signature']`

**Test Locally**:
```bash
stripe listen --forward-to http://127.0.0.1:5001/etsy-ai-hacker/us-central1/stripeWebhook
stripe trigger checkout.session.completed
```

### Issue: Functions Cold Start Timeout

**Symptoms**:
- First request after idle takes >60s
- Timeout errors in logs

**Solutions**:
1. **Increase timeout**: `functions.runWith({ timeoutSeconds: 120 })`
2. **Reduce bundle size**: Lazy-load heavy dependencies
3. **Keep warm**: Cloud Scheduler ping every 5 minutes

**Quick Fix**:
```javascript
// functions/index.js
exports.api_generateV2 = functions.runWith({
  timeoutSeconds: 120,
  memory: '512MB'
}).https.onRequest(...)
```

### Issue: High OpenAI Costs

**Monitoring**:
```bash
# Check daily spend
firebase functions:log --only api_generateV2 | grep "token_usage"
```

**Budget Guard** (already implemented):
```javascript
// functions/utils/budgetGuard.js
DAILY_BUDGET_USD=25  // Hard stop
BUDGET_HARD_STOP=1   // Enable strict mode
```

**Slack Alerts**: Configured in `SLACK_WEBHOOK_URL` for budget breaches

---

## 📊 Monitoring & Alerts

### Cloud Logging Queries

**1. CORS Violations**
```
resource.type="cloud_function"
textPayload=~"CORS.*BLOCKED"
```

**2. Credits Exhausted**
```
resource.type="cloud_function"
jsonPayload.error="Insufficient credits"
```

**3. Function Errors**
```
resource.type="cloud_function"
severity="ERROR"
```

**4. Slow Responses (>15s)**
```
resource.type="cloud_function"
jsonPayload.duration>15000
```

### GCP Alerts (Recommended Setup)

**1. Error Rate Alert**
```yaml
Display Name: High Error Rate
Condition: Cloud Function error rate > 5% over 5 min
Notification: Slack + Email
```

**2. Latency Alert**
```yaml
Display Name: Slow API Response
Condition: p95 latency > 15s over 10 min
Notification: Slack
```

**3. Budget Alert**
```yaml
Display Name: Daily Budget Exceeded
Condition: OpenAI spend > $25/day
Notification: Slack (Critical)
```

### Slack Notifications

Already integrated via `SLACK_WEBHOOK_URL`:
- Stripe payment success/fail
- Budget warnings
- OpenAI errors

**Test**:
```bash
curl -X POST ${SLACK_WEBHOOK_URL} \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test alert from runbook"}'
```

---

## 🔄 Rollback Procedures

### Emergency Rollback

**Frontend** (immediate):
```bash
# Get previous version from Hosting history
firebase hosting:channel:deploy rollback-$(date +%s)

# Or re-deploy last known good commit
git checkout <good-commit>
cd frontend && npm run build
firebase deploy --only hosting
```

**Functions** (takes ~2 min):
```bash
# Roll back to previous deployment
gcloud functions deploy api_generateV2 \
  --source=<previous-source> \
  --region=us-central1
```

### Graceful Rollback

1. **Test new version** in staging first
2. **Canary deploy**: Route 10% traffic to new version
3. **Monitor metrics** for 30 minutes
4. **Full rollout** if healthy

---

## 📋 Maintenance Tasks

### Weekly

- [ ] Review Cloud Function logs for errors
- [ ] Check Firestore query performance
- [ ] Verify Stripe webhook success rate
- [ ] Monitor OpenAI token usage trends

### Monthly

- [ ] Rotate non-critical secrets
- [ ] Review and optimize Cloud Function costs
- [ ] Update dependencies (security patches)
- [ ] Backup Firestore data

### Quarterly

- [ ] Full security audit
- [ ] Performance optimization review
- [ ] Update documentation
- [ ] Review and update rate limits

---

## 🆘 Emergency Contacts

**On-Call Rotation**: [Add Pagerduty/Slack channel]
**Firebase Console**: https://console.firebase.google.com/project/etsy-ai-hacker
**Stripe Dashboard**: https://dashboard.stripe.com
**OpenAI Usage**: https://platform.openai.com/usage

---

## ✅ Production Readiness Sign-Off

Before marking as "Production Ready", verify:

- [x] All secrets migrated to Firebase Secrets
- [x] CORS whitelist hardened (no wildcard fallback)
- [x] Credits system using atomic Firestore transactions
- [x] Cache headers configured (`immutable` for assets)
- [x] Build process verified (env vars in bundle)
- [x] .gitignore updated (no secrets in repo)
- [x] Frontend .env.example created
- [x] Functions .env.example created
- [x] README updated with deployment steps
- [ ] Stripe webhook tested end-to-end with Slack
- [ ] GCP alerts configured
- [ ] Backup strategy documented
- [ ] Incident response plan created

**Sign-Off**: [Your Name] - [Date]

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Status**: Production Ready (Pending final smoke tests)
