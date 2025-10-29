# 🚨 TODO: Critical Production Tasks

## Immediate Actions Required

These tasks must be completed before the application is production-ready.

---

## ✅ Completed (by AI Assistant)

- [x] **Code migrated to Firebase Secrets** (`defineSecret` in all functions)
- [x] **CORS hardened** (removed wildcard fallback, blocks unknown origins)
- [x] **Credits enforcement** (atomic Firestore transactions in `generateV2` & `regenerateV2`)
- [x] **Cache headers optimized** (`firebase.json` updated with `immutable` for assets)
- [x] **`.gitignore` updated** (secrets files excluded)
- [x] **`.env.example` created** (frontend + functions)
- [x] **Documentation created**:
  - `PRODUCTION_RUNBOOK.md` (deployment, troubleshooting, monitoring)
  - `SECRETS_SETUP.md` (step-by-step secrets migration)

---

## 🔴 Action Required: YOU Must Do These

### 1. Rotate & Set Secrets (30 minutes)

**Follow**: `SECRETS_SETUP.md`

```bash
# 1. Rotate all secrets at providers
#    - OpenAI: https://platform.openai.com/api-keys
#    - Stripe: https://dashboard.stripe.com/apikeys
#    - Slack: https://api.slack.com/apps

# 2. Set Firebase Secrets (paste new values when prompted)
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set STRIPE_SECRET
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:secrets:set SLACK_WEBHOOK_URL

# 3. Deploy functions with secrets access
cd functions
npm ci
firebase deploy --only functions
```

**Verify**:
- [ ] All 4 secrets set in Firebase
- [ ] Functions deployed successfully
- [ ] Old keys revoked at providers

---

### 2. Test Deployment (20 minutes)

**Follow**: `PRODUCTION_RUNBOOK.md` → "Post-Deployment Verification"

```bash
# A. Frontend smoke test
# Open https://etsy-ai-hacker.web.app in Incognito
# Login, generate listing, check credits deducted

# B. Stripe webhook test
stripe trigger checkout.session.completed
# Check Firestore wallet_ledger + Slack notification

# C. Credits exhaustion test
# Set user credits to 0 in Firestore
# Attempt generate → should return 429 Insufficient credits
```

**Verify**:
- [ ] Frontend loads without errors
- [ ] Generate listing works (deducts 1 credit)
- [ ] Stripe webhook adds credits
- [ ] 0-credits scenario blocked correctly
- [ ] Slack notifications received

---

### 3. Configure Monitoring (15 minutes)

**GCP Console** → Monitoring → Alerting

**Create 3 alerts**:

1. **High Error Rate**
   - Condition: `Cloud Function error rate > 5%` over 5 min
   - Notification: Slack webhook + Email

2. **Slow API Response**
   - Condition: `p95 latency > 15s` over 10 min
   - Notification: Slack webhook

3. **Daily Budget Exceeded**
   - Custom log-based alert for budget guard
   - Notification: Slack webhook (Critical)

**Verify**:
- [ ] 3 alerts created in GCP Console
- [ ] Test alert sends to Slack

---

### 4. Update Environment Variables (5 minutes)

**Firebase Console** → Functions → Configuration

Set production environment variables:

```bash
ALLOWED_ORIGINS=https://etsy-ai-hacker.web.app,https://etsy-ai-hacker.firebaseapp.com
DAILY_BUDGET_USD=25
BUDGET_HARD_STOP=1
DAILY_CREDITS=500
RATE_LIMIT_PER_MIN=12
```

**Or via CLI**:
```bash
firebase functions:config:set cors.allowed_origins="https://etsy-ai-hacker.web.app,https://etsy-ai-hacker.firebaseapp.com"
firebase deploy --only functions
```

**Verify**:
- [ ] CORS whitelist exact (no wildcards)
- [ ] Budget limits set correctly

---

### 5. Clean Up Repository (5 minutes)

```bash
# Remove secrets files from git history if needed
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch functions/.env functions/.runtimeconfig.json" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (DANGEROUS - coordinate with team)
git push origin --force --all

# Or safer: just commit .gitignore changes
git add functions/.gitignore frontend/.gitignore
git commit -m "chore: ensure secrets files are gitignored"
git push
```

**Verify**:
- [ ] `.env` and `.runtimeconfig.json` not in git history
- [ ] `.gitignore` updated and committed

---

### 6. Final Deployment (10 minutes)

```bash
# Full production deployment
cd g:\Dev\onebox-hacker

# Deploy functions (with secrets)
cd functions
npm ci
firebase deploy --only functions

# Deploy frontend (with env vars)
cd ../frontend
if (Test-Path dist) { Remove-Item -Recurse -Force dist }
npm ci
npm run build
cd ..
firebase deploy --only hosting

# Deploy Firestore rules
firebase deploy --only firestore:rules,firestore:indexes
```

**Verify**:
- [ ] All components deployed
- [ ] No errors in deployment logs
- [ ] Smoke tests pass (see Step 2)

---

## 🟡 Optional (Recommended but not blocking)

### Phase 1.4: Stripe End-to-End Flow

- [ ] Test full payment flow with real Stripe checkout
- [ ] Verify Slack notifications on success/failure
- [ ] Test subscription vs one-time payment handling

### Phase 1.5: Frontend Polish

- [ ] Remove or hide legacy API toggle (if exists)
- [ ] Fix auth 400 error on login form (if still present)
- [ ] Add credits badge with tooltip and "Add credits" link

### Phase 2.2: Enhanced Observability

- [ ] Set up GCP log-based metrics dashboard
- [ ] Configure Sentry for frontend error tracking
- [ ] Add Firestore backup schedule (weekly)

---

## 📋 Go/No-Go Checklist

Before marking as **PRODUCTION READY**, verify:

### Security ✅
- [ ] All secrets rotated and in Firebase Secrets
- [ ] CORS whitelist hardened (no wildcard)
- [ ] Old secrets revoked at providers
- [ ] `.env` files gitignored and not in history

### Functionality ✅
- [ ] Generate listing works (1 credit cost)
- [ ] Regenerate field works (0.5 credit cost)
- [ ] Credits enforcement (atomic transactions)
- [ ] Stripe webhook adds credits
- [ ] 0-credits scenario blocks correctly

### Monitoring ✅
- [ ] GCP alerts configured (error rate, latency, budget)
- [ ] Slack notifications working
- [ ] Cloud Function logs accessible

### Documentation ✅
- [ ] `PRODUCTION_RUNBOOK.md` reviewed
- [ ] `SECRETS_SETUP.md` completed
- [ ] Team trained on deployment process

---

## 🎯 Success Criteria

**Definition of Done**:
1. User can sign up, get credits, and generate listings
2. Credits are deducted atomically (no race conditions)
3. 0-credits scenario is handled gracefully
4. Stripe payments add credits correctly
5. Monitoring alerts fire on issues
6. No secrets in repository
7. CORS only allows whitelisted origins

**Sign-Off**: _______________________ Date: _________

---

## 📞 Next Steps After Production

1. **Week 1**: Monitor closely, be on-call for issues
2. **Week 2**: Review metrics, optimize costs
3. **Month 1**: First secrets rotation (OpenAI key)
4. **Quarterly**: Full security audit

---

**Priority**: 🔴 HIGH
**Estimated Time**: 1.5 hours total
**Blockers**: None (all code changes complete)
**Owner**: [Your Name]
