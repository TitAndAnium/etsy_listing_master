# 🔐 Secrets Setup Guide

## ⚠️ CRITICAL: First-Time Production Setup

**Before deploying to production**, you MUST rotate all secrets that were previously committed to the repository and migrate them to Firebase Secrets.

---

## Step 1: Rotate All Secrets

### A. OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Name it: `etsy-ai-hacker-prod-2024`
4. Copy the key (starts with `sk-proj-...`)
5. **Revoke old key** from repository

### B. Stripe Keys

1. Go to https://dashboard.stripe.com/apikeys
2. **Secret Key**:
   - Click "Create secret key"
   - Name: `Firebase Functions Production`
   - **Restricted**: Enable and restrict to "Charges" and "Checkout Sessions"
3. **Webhook Secret**:
   - Go to https://dashboard.stripe.com/webhooks
   - Click existing webhook or "Add endpoint"
   - URL: `https://us-central1-etsy-ai-hacker.cloudfunctions.net/stripeWebhook`
   - Events: `checkout.session.completed`
   - Copy "Signing secret" (starts with `whsec_...`)

### C. Slack Webhook

1. Go to https://api.slack.com/apps
2. Select your app → "Incoming Webhooks"
3. Click "Add New Webhook to Workspace"
4. Choose channel (e.g., #alerts-prod)
5. Copy webhook URL (starts with `https://hooks.slack.com/services/...`)
6. **Revoke old webhook** if compromised

---

## Step 2: Set Firebase Secrets

**Run these commands** in your terminal (you'll be prompted to paste each secret):

```bash
# Navigate to project root
cd g:\Dev\onebox-hacker

# Set OpenAI key
firebase functions:secrets:set OPENAI_API_KEY
# Paste your NEW OpenAI key when prompted

# Set Stripe secret key
firebase functions:secrets:set STRIPE_SECRET
# Paste your NEW Stripe secret key

# Set Stripe webhook secret
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Paste your NEW Stripe webhook signing secret

# Set Slack webhook URL
firebase functions:secrets:set SLACK_WEBHOOK_URL
# Paste your Slack webhook URL
```

**Verification**:
```bash
# List all secrets (shows names only, not values)
firebase functions:secrets:access --help
```

---

## Step 3: Update Local Development Environment

### For Local Testing (Optional)

If you want to test locally with emulators, create `functions/.env`:

```bash
# Copy example and fill in (use TEST keys, not production!)
cp functions/.env.example functions/.env
```

Edit `functions/.env`:
```bash
# Local development secrets (TEST MODE ONLY)
OPENAI_API_KEY=sk-test-...
STRIPE_SECRET=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/.../test
APP_BASE_URL=http://localhost:5173

# Other config
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DAILY_CREDITS=500
RATE_LIMIT_PER_MIN=12
TEST_ALLOW_CLI_CHECKOUT=1
```

**⚠️ NEVER commit this file!** (Already in `.gitignore`)

---

## Step 4: Deploy Functions with Secrets

```bash
cd functions
npm ci
firebase deploy --only functions
```

**What happens**:
- Firebase loads secrets into `process.env` at runtime
- Functions can access via `process.env.OPENAI_API_KEY`, etc.
- Secrets are encrypted at rest and in transit

---

## Step 5: Verify Secrets Work

### Test OpenAI Integration

```powershell
# Get auth token
firebase auth:export --format JSON users.json
# Extract a test user UID from users.json

# Make authenticated request
$token = "YOUR_TEST_USER_TOKEN"
$body = @{ payload = "handmade wooden box" } | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri "https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" -Body $body
```

**Expected**: Returns generated listing (proves OpenAI key works)

### Test Stripe Webhook

```bash
# Install Stripe CLI if needed
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Test webhook
stripe trigger checkout.session.completed \
  --override checkout_session.customer_email=test@example.com \
  --override checkout_session.client_reference_id=testuser123
```

**Expected**:
- Webhook returns `200 OK`
- Credits added to Firestore `users/testuser123`
- Slack notification received

### Test Slack Notifications

```powershell
# Direct Slack test
$webhookUrl = "YOUR_SLACK_WEBHOOK_URL"
$body = @{ text = "✅ Secrets verification successful!" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri $webhookUrl -ContentType "application/json" -Body $body
```

**Expected**: Message appears in Slack channel

---

## 🗑️ Step 6: Clean Up Old Secrets

### Remove from Repository

```bash
# Remove .runtimeconfig.json if it exists
rm functions/.runtimeconfig.json

# Verify it's in .gitignore
cat functions/.gitignore | grep runtimeconfig
# Should see: .runtimeconfig.json

# Commit changes
git add functions/.gitignore
git commit -m "chore: remove secrets from repo, migrate to Firebase Secrets"
```

### Revoke Old Keys

1. **OpenAI**: Go to API Keys → Delete old key
2. **Stripe**: Dashboard → Developers → Delete old secret key
3. **Slack**: Incoming Webhooks → Revoke old webhook

---

## 📋 Secrets Checklist

Before marking setup complete:

- [ ] All 4 secrets rotated (new values generated)
- [ ] Firebase Secrets set (verified with `firebase functions:secrets:access`)
- [ ] Functions deployed with secrets access
- [ ] OpenAI test successful (API call returns data)
- [ ] Stripe webhook test successful (credits added)
- [ ] Slack notification test successful (message received)
- [ ] Old keys revoked from providers
- [ ] `.runtimeconfig.json` removed and gitignored
- [ ] Local `.env` created for development (optional)
- [ ] Local `.env` confirmed in `.gitignore`

---

## 🔄 Secrets Rotation Schedule

### Immediate (Today)
- All secrets (first-time setup)

### Regular Rotation

**Every 90 Days**:
- OpenAI API Key

**Every 180 Days**:
- Slack Webhook URL

**On Security Incident Only**:
- Stripe Secret Key
- Stripe Webhook Secret

**Rotation Process**:
1. Generate new secret at provider
2. Run `firebase functions:secrets:set <SECRET_NAME>`
3. Deploy functions: `firebase deploy --only functions`
4. Verify functionality
5. Revoke old secret at provider

---

## 🆘 Troubleshooting

### Error: "Secret not found"

**Cause**: Secret not set or functions not deployed after setting

**Fix**:
```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions
```

### Error: "Permission denied"

**Cause**: Firebase CLI not authenticated or wrong project

**Fix**:
```bash
firebase login
firebase use etsy-ai-hacker
firebase functions:secrets:set OPENAI_API_KEY
```

### Error: "Invalid API key"

**Cause**: Secret value incorrect or has extra whitespace

**Fix**:
1. Re-generate key at provider
2. Copy EXACTLY (no extra spaces/newlines)
3. Re-set: `firebase functions:secrets:set OPENAI_API_KEY`
4. Re-deploy: `firebase deploy --only functions`

---

## 📞 Support

If secrets setup fails:
1. Check Firebase Console → Functions → Secrets
2. Check Cloud Function logs: `firebase functions:log`
3. Verify IAM permissions in GCP Console

**Need Help?** Contact: [your-email@domain.com]

---

**Last Updated**: December 2024
**Version**: 1.0.0
