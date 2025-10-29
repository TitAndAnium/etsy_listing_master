# CORS Production Plan

## Huidige Situatie (Development)
- **Backend:** `applyCors()` in `functions/index.js` accepteert alle origins (`*`)
- **Frontend:** Draait op `localhost:5173` tijdens development
- **Status:** Werkt correct voor lokale ontwikkeling

## Productie Whitelist

### Toegestane Origins
```
https://sellsiren.com
https://www.sellsiren.com
```

### WordPress Integratie (toekomstig)
Als WordPress-plugin met iframe/shortcode wordt gebruikt:
- Zelfde domein als SPA (sellsiren.com) → geen extra CORS origin nodig
- Alternatief WP-domein → toevoegen aan whitelist

## Implementatie

### Backend (functions/index.js)
```javascript
// Production CORS whitelist
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://sellsiren.com', 'https://www.sellsiren.com'];

function applyCors(res, origin, methods = 'POST, OPTIONS') {
  // Strict origin check in production
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Server-to-server (no Origin header) blijft toegestaan
    res.set('Access-Control-Allow-Origin', '*');
  } else {
    // Unknown origin → block
    res.set('Access-Control-Allow-Origin', 'null');
  }
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', methods);
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
```

### Environment Variables
**Firebase Functions config:**
```bash
firebase functions:config:set cors.allowed_origins="https://sellsiren.com,https://www.sellsiren.com"
```

**Of via Cloud Functions UI:**
- Variabele: `ALLOWED_ORIGINS`
- Waarde: `https://sellsiren.com,https://www.sellsiren.com`

## Deployment Checklist

- [ ] Backup huidige functions (firebase functions:config:get > backup.json)
- [ ] Environment variable `ALLOWED_ORIGINS` instellen
- [ ] Deploy functions met nieuwe CORS-logica
- [ ] Rooktest vanaf sellsiren.com (OPTIONS + POST)
- [ ] Verificatie: onbekende origins krijgen CORS error
- [ ] Rollback-plan gereed (previous deployment via Firebase console)

## Verificatie Commands

**Test toegestane origin:**
```powershell
$headers = @{
  "Origin" = "https://sellsiren.com"
  "Authorization" = "Bearer <ID_TOKEN>"
}
Invoke-RestMethod -Uri "https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2" `
  -Method Options -Headers $headers
# Verwacht: 204 + Access-Control-Allow-Origin: https://sellsiren.com
```

**Test geblokkeerde origin:**
```powershell
$headers = @{ "Origin" = "https://evil.com" }
Invoke-RestMethod -Uri "https://us-central1-etsy-ai-hacker.cloudfunctions.net/api_generateV2" `
  -Method Options -Headers $headers
# Verwacht: 204 + Access-Control-Allow-Origin: null (browser blokkeert)
```

## Timing
Deploy CORS whitelist **voor** productie-lancering van SPA op sellsiren.com.
