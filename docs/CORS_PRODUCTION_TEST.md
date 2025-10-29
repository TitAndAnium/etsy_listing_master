# CORS Production Rooktest

Verificatie van CORS whitelist in productie-omgeving.

---

## Test Setup

**Vereisten:**
- Functions deployed met `ALLOWED_ORIGINS` env variabele
- Frontend deployed op sellsiren.com
- Browser met DevTools (Chrome/Firefox/Edge)

---

## Test 1: Toegestane Origin (sellsiren.com)

### Via Browser Console

1. **Open frontend:** https://sellsiren.com
2. **Open DevTools:** F12 → Console tab
3. **Run OPTIONS test:**
   ```javascript
   fetch('https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2', {
     method: 'OPTIONS',
     headers: {
       'Origin': 'https://sellsiren.com',
       'Access-Control-Request-Method': 'POST',
       'Access-Control-Request-Headers': 'Content-Type, Authorization'
     }
   }).then(r => {
     console.log('Status:', r.status);
     console.log('CORS Origin:', r.headers.get('Access-Control-Allow-Origin'));
     console.log('Methods:', r.headers.get('Access-Control-Allow-Methods'));
   });
   ```

   **Expected output:**
   ```
   Status: 204
   CORS Origin: https://sellsiren.com
   Methods: POST, OPTIONS
   ```

4. **Run POST test (met auth token):**
   ```javascript
   // Get token (na login)
   const token = await firebase.auth().currentUser.getIdToken();
   
   fetch('https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2', {
     method: 'POST',
     headers: {
       'Origin': 'https://sellsiren.com',
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       mode: 'dump',
       payload: 'silver ring test'
     })
   }).then(r => r.json()).then(data => {
     console.log('Generate response:', data);
   });
   ```

   **Expected output:**
   ```
   Generate response: {
     title: { value: "...", status: "ok" },
     description: { value: "...", status: "ok" },
     tags: { items: [...], status: "ok" }
   }
   ```

### Via curl (Command Line)

```bash
# OPTIONS request
curl -X OPTIONS \
  -H "Origin: https://sellsiren.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -v https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2 \
  2>&1 | grep -i "access-control"

# Expected:
# < Access-Control-Allow-Origin: https://sellsiren.com
# < Access-Control-Allow-Methods: POST, OPTIONS
# < Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Test 2: Geblokkeerde Origin (Evil.com)

### Via Browser Console

**Open:** https://evil.com (of andere test site)

```javascript
fetch('https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://evil.com'
  }
}).then(r => {
  console.log('Status:', r.status);
  console.log('CORS Origin:', r.headers.get('Access-Control-Allow-Origin'));
}).catch(err => {
  console.error('CORS blocked:', err);
});
```

**Expected:**
- Status: 204 (server stuurt wel response)
- CORS Origin: `null` (browser blokkeert access)
- Console error: `CORS policy: No 'Access-Control-Allow-Origin' header is present`

### Via curl

```bash
curl -X OPTIONS \
  -H "Origin: https://evil.com" \
  -v https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2 \
  2>&1 | grep "Access-Control-Allow-Origin"

# Expected:
# < Access-Control-Allow-Origin: null
```

---

## Test 3: Server-to-Server (Geen Origin Header)

```bash
curl -X POST \
  -H "Authorization: Bearer <VALID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"dump","payload":"silver ring"}' \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2

# Expected: 200 OK (geen CORS check zonder Origin header)
```

---

## Test 4: WWW vs Non-WWW

### Test www.sellsiren.com

```javascript
// Browser console op www.sellsiren.com
fetch('https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2', {
  method: 'OPTIONS'
}).then(r => console.log('CORS:', r.headers.get('Access-Control-Allow-Origin')));

// Expected: Access-Control-Allow-Origin: https://www.sellsiren.com
```

### Test sellsiren.com (non-www)

```javascript
// Browser console op sellsiren.com (zonder www)
fetch('https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2', {
  method: 'OPTIONS'
}).then(r => console.log('CORS:', r.headers.get('Access-Control-Allow-Origin')));

// Expected: Access-Control-Allow-Origin: https://sellsiren.com
```

**Belangrijk:** Beide moeten in `ALLOWED_ORIGINS` staan:
```
ALLOWED_ORIGINS=https://sellsiren.com,https://www.sellsiren.com
```

---

## Test 5: Alle v2 Endpoints

Test CORS voor alle productie endpoints:

```javascript
const endpoints = [
  'api_generateV2',
  'api_regenerateField',
  'api_reviewUserEdit',
  'api_getUserCredits',
  'api_getWallet',
  'api_createCheckoutSession'
];

const baseUrl = 'https://us-central1-etsy-ai-hacker.cloudfunctions.net';

for (const endpoint of endpoints) {
  fetch(`${baseUrl}/${endpoint}`, {
    method: 'OPTIONS',
    headers: { 'Origin': 'https://sellsiren.com' }
  }).then(r => {
    console.log(`${endpoint}:`, r.status, r.headers.get('Access-Control-Allow-Origin'));
  });
}

// Expected: alle 204 met Access-Control-Allow-Origin: https://sellsiren.com
```

---

## Test 6: Legacy Endpoint (HMAC - Geen CORS Restrictie)

```bash
# Legacy endpoint moet ALTIJD toegankelijk zijn (geen strict CORS)
curl -X POST \
  -H "Origin: https://evil.com" \
  -H "Content-Type: application/json" \
  -d '{"uid":"test","payload":"silver ring","signature":"..."}' \
  https://us-central1-etsy-ai-hacker.cloudfunctions.net/httpGenerate

# Expected: 200 OK (legacy heeft geen CORS whitelist restrictie)
```

---

## Troubleshooting

### CORS error: "No 'Access-Control-Allow-Origin' header"

**Check 1: ALLOWED_ORIGINS env variabele**
```bash
firebase functions:config:get cors.allowed_origins

# Expected: https://sellsiren.com,https://www.sellsiren.com
```

**Check 2: Exact origin match**
- Frontend URL: `https://sellsiren.com` (check protocol + www)
- ALLOWED_ORIGINS moet EXACT matchen (geen trailing slash)

**Check 3: Redeploy functions**
```bash
# Env vars worden pas actief na redeploy
firebase deploy --only functions
```

### Preflight (OPTIONS) slaagt, maar POST faalt

**Symptom:** OPTIONS → 204 OK, maar POST → CORS error

**Oorzaak:** Auth middleware kan CORS headers overschrijven

**Verify in code:**
```javascript
// functions/index.js
// CORS MOET vóór auth:
exports.api_generateV2 = functions.https.onRequest(
  withCors(withAuth((req, res) => generateV2Handler(req, res)))
);
// ✅ Correct: withCors wraps withAuth

// ❌ Fout: withAuth wraps withCors
```

### localhost werkt, maar sellsiren.com niet

**Check browser DevTools → Network tab:**
- Request Headers → `Origin:` header waarde
- Response Headers → `Access-Control-Allow-Origin:` waarde
- Moeten EXACT matchen

**Verify ALLOWED_ORIGINS:**
```bash
# Development (lokaal testen):
ALLOWED_ORIGINS=http://localhost:5173,https://sellsiren.com

# Production (alleen live site):
ALLOWED_ORIGINS=https://sellsiren.com,https://www.sellsiren.com
```

---

## Success Criteria

✅ **CORS correct geconfigureerd** als:
1. sellsiren.com → OPTIONS/POST → 204/200 met correct CORS origin
2. www.sellsiren.com → OPTIONS/POST → 204/200 met correct CORS origin
3. evil.com → OPTIONS → 204 maar Access-Control-Allow-Origin: null
4. Alle v2 endpoints → CORS headers aanwezig
5. Browser console → GEEN CORS errors bij normale use
6. Server-to-server (geen Origin) → toegestaan
7. Legacy endpoint → werkt onafhankelijk van CORS whitelist

---

## Monitoring

**Browser DevTools (elke pagina load):**
- Network tab → Check preflight requests (OPTIONS)
- Console → Geen CORS errors

**Functions logs:**
```bash
firebase functions:log --limit 100 | grep "CORS\|Origin"
```

**Automated test (CI/CD):**
```javascript
// tests/cors.test.js
describe('CORS Whitelist', () => {
  it('allows sellsiren.com', async () => {
    const res = await fetch(
      'https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2',
      {
        method: 'OPTIONS',
        headers: { 'Origin': 'https://sellsiren.com' }
      }
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://sellsiren.com');
  });

  it('blocks evil.com', async () => {
    const res = await fetch(
      'https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2',
      {
        method: 'OPTIONS',
        headers: { 'Origin': 'https://evil.com' }
      }
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('null');
  });
});
```

---

## References

- CORS Spec: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- Firebase CORS: https://firebase.google.com/docs/functions/http-events#cors
- Code: `functions/index.js` → `applyCors()` functie
- Deployment plan: `docs/CORS_PRODUCTION_PLAN.md`
