# Frontend Deployment naar sellsiren.com/generator

Stap-voor-stap deployment van React SPA naar Firebase Hosting.

---

## Pre-Deployment Checklist

- [ ] Firebase Hosting enabled voor project
- [ ] Custom domain `sellsiren.com` gekoppeld (via Firebase Console)
- [ ] SSL certificaat actief (automatisch via Firebase)
- [ ] Git commit van laatste frontend wijzigingen

---

## Stap 1: Build Configuratie Verificatie

```bash
cd frontend

# Check environment configuratie
cat .env.production
```

**Vereiste variabelen in `.env.production`:**
```env
VITE_API_BASE_URL=https://us-central1-etsy-ai-hacker.cloudfunctions.net
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=etsy-ai-hacker.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=etsy-ai-hacker
```

**Als `.env.production` niet bestaat:**
```bash
# Kopieer van .env.development.local en pas aan
cp .env.development.local .env.production

# Edit met productie-waarden
notepad .env.production
```

---

## Stap 2: Production Build

```bash
cd frontend

# Clean previous build
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

# Install dependencies (fresh)
npm ci

# Production build
npm run build

# Expected output:
# ✓ built in XXXXms
# dist/ directory created
```

**Verificatie build:**
```bash
# Check dist/ directory
ls dist

# Expected files:
# - index.html
# - assets/ (JS/CSS bundles)
# - favicon.ico (indien aanwezig)

# Check build size (moet < 5MB zijn)
Get-ChildItem -Recurse dist | Measure-Object -Property Length -Sum
```

---

## Stap 3: Firebase Hosting Configuratie

**Check `firebase.json` (in root):**
```json
{
  "hosting": {
    "public": "frontend/dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      },
      {
        "source": "index.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      }
    ]
  }
}
```

**Als hosting config ontbreekt:**
```bash
# Initialize hosting (vanuit root directory)
firebase init hosting

# Select options:
# - Public directory: frontend/dist
# - Single-page app: Yes
# - Overwrite index.html: No
```

---

## Stap 4: Deploy naar Firebase Hosting

```bash
# Vanuit root directory
cd g:\Dev\onebox-hacker

# Deploy alleen hosting (sneller)
firebase deploy --only hosting

# Of deploy hosting + functions samen
firebase deploy --only hosting,functions
```

**Expected output:**
```
✔  hosting: Site deployed
✔  Deploy complete!

Hosting URL: https://etsy-ai-hacker.web.app
Custom Domain: https://sellsiren.com/generator
```

---

## Stap 5: Custom Domain Verificatie

**Als sellsiren.com nog NIET gekoppeld:**

1. **Firebase Console:**
   - Hosting → Domain → Add custom domain
   - Enter: `sellsiren.com`
   - Follow DNS setup instructions

2. **DNS Records (bij domain provider):**
   ```
   Type: A
   Name: @ (or sellsiren.com)
   Value: <Firebase IP addresses>
   
   Type: A
   Name: www
   Value: <Firebase IP addresses>
   ```

3. **SSL Provisioning:**
   - Automatisch via Firebase (kan 24u duren)
   - Status check: Firebase Console → Hosting → Domain

**Subdirectory setup (`/generator`):**

Firebase Hosting ondersteunt GEEN subdirectories out-of-the-box. Opties:

**Optie A: Dedicated subdomain (aanbevolen)**
```
generator.sellsiren.com → Firebase Hosting
```

**Optie B: Reverse proxy via Cloud Functions**
```javascript
// functions/index.js
const express = require('express');
const app = express();
app.use('/generator', express.static('frontend/dist'));

exports.app = functions.https.onRequest(app);
```

**Optie C: Main domain**
```
sellsiren.com (root) → Firebase Hosting (SPA)
```

---

## Stap 6: Post-Deploy Verificatie

```bash
# Test live site
curl -I https://sellsiren.com

# Expected:
# HTTP/2 200
# content-type: text/html
# cache-control: no-cache (voor index.html)

# Test CORS vanaf live site (via browser console)
# Open: https://sellsiren.com
# Console:
fetch('https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2', {
  method: 'OPTIONS',
  headers: { 'Origin': 'https://sellsiren.com' }
}).then(r => console.log(r.status)); // Expected: 204
```

**Browser Checklist:**
- [ ] SPA laadt zonder errors (check DevTools Console)
- [ ] Login werkt (Firebase Auth)
- [ ] Toggle v2 aan → Generate succesvol
- [ ] Wallet badge toont credits
- [ ] CORS errors? → Check ALLOWED_ORIGINS env variabele
- [ ] Assets laden (CSS/JS via CDN)

---

## Stap 7: Performance & SEO (Optioneel)

**Lighthouse audit:**
```bash
# Install lighthouse CLI
npm install -g lighthouse

# Run audit
lighthouse https://sellsiren.com --view
```

**Target scores:**
- Performance: > 90
- Accessibility: > 90
- Best Practices: > 90
- SEO: > 80

**Optimalisaties (indien scores laag):**
1. **Lazy loading:** Splitsen van code bundles
2. **Image optimization:** WebP + lazy loading
3. **Caching:** Service worker (PWA)
4. **CDN:** Firebase Hosting gebruikt automatisch CDN

---

## Rollback Procedure

```bash
# List previous deployments
firebase hosting:channel:list

# Deploy naar specifieke versie
firebase hosting:clone <PREVIOUS_VERSION> live
```

**Via Firebase Console:**
1. Hosting → Release history
2. Select previous version → Rollback

---

## Monitoring & Analytics

**Firebase Console:**
- Hosting → Usage → Check bandwidth/requests
- Analytics → Track user flows (indien enabled)

**Google Analytics (optioneel):**
```javascript
// frontend/src/main.js
import { analytics } from './firebase/config';
import { logEvent } from 'firebase/analytics';

logEvent(analytics, 'page_view');
```

---

## Troubleshooting

### Error: "Module not found" na deploy
- Check build output: `ls frontend/dist/assets`
- Verify Vite base URL config
- Rebuild: `npm run build`

### 404 op refresh (SPA routing)
- Check firebase.json rewrites: `"destination": "/index.html"`
- Redeploy hosting

### CORS errors
- Verify ALLOWED_ORIGINS includes `https://sellsiren.com`
- Check exact protocol (https) en www/non-www match
- Redeploy functions

### Slow first load
- Enable compression in firebase.json (automatisch actief)
- Code splitting via Vite config
- Lazy load routes

---

## Success Criteria

✅ **Deploy succesvol** als:
1. `firebase deploy --only hosting` → geen errors
2. Live URL bereikbaar: https://sellsiren.com
3. SPA laadt zonder console errors
4. Login/auth werkt
5. Generate v2 succesvol (200 response)
6. Wallet/credits zichtbaar
7. CORS headers correct (sellsiren.com toegestaan)
