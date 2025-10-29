# WordPress / Flatsome Integratie Plan

## Status Overzicht

✅ **Legacy HMAC-pad werkend:** WP-plugin `wordpress/etsy-ai-listing/` gebruikt `httpGenerate` endpoint  
⚠️ **V2 met Firebase Auth:** Nog te implementeren voor WP-omgeving

## Scenario 1: Legacy Flow (Huidig)

**Hoe het werkt:**
- WordPress plugin stuurt POST naar `httpGenerate` met HMAC-signature
- Backend valideert HMAC (geen Firebase Auth nodig)
- Shortcode `[etsy_ai_generator]` rendert form + results
- Flatsome UX Builder element beschikbaar

**Beperking:** Geen per-user credits, geen wallet, geen v2-features

## Scenario 2: V2 met Embed/Iframe

### Optie A - Iframe Embed (Snelste)

1. **Deploy SPA naar sellsiren.com/generator**
2. **WordPress shortcode als iframe:**
   ```php
   function etsy_ai_generator_v2_shortcode() {
       return '<iframe 
           src="https://sellsiren.com/generator" 
           width="100%" 
           height="800px" 
           frameborder="0"
           allow="clipboard-write"
       ></iframe>';
   }
   add_shortcode('etsy_ai_generator_v2', 'etsy_ai_generator_v2_shortcode');
   ```

3. **CORS:** Geen cross-origin issue want iframe laadt van eigen domein
4. **Auth:** Firebase Auth draait in iframe, WP hoeft niet te weten van tokens

**Voordelen:**
- Snelle implementatie (1-2 uur)
- Geen WP-backend wijzigingen
- SPA krijgt automatisch alle updates

**Nadelen:**
- Iframe UI kan beperkt zijn qua styling-integratie
- Mobiele UX kan minder smooth zijn

### Optie B - Native WP met Firebase Auth

1. **Firebase Web SDK in WP-plugin laden:**
   ```php
   wp_enqueue_script('firebase-app', 'https://www.gstatic.com/firebasejs/10.x/firebase-app.js');
   wp_enqueue_script('firebase-auth', 'https://www.gstatic.com/firebasejs/10.x/firebase-auth.js');
   ```

2. **JavaScript in WP:**
   - Gebruik zelfde Firebase config als SPA
   - `signInWithEmailAndPassword()` of `signInAnonymously()`
   - Token meesturen naar backend via `fetch()` met `Authorization: Bearer <token>`

3. **CORS whitelist uitbreiden:**
   - Voeg WP-domein toe aan `ALLOWED_ORIGINS` indien anders dan sellsiren.com

**Voordelen:**
- Native WP-styling, geen iframe
- Full control over UX

**Nadelen:**
- Meer development tijd (4-6 uur)
- WP-plugin moet Firebase SDK en auth-flow beheren

## Scenario 3: Hybride (Legacy + V2 toggle)

- WP-site biedt beide opties: legacy (gratis, geen auth) + v2 (paid, met auth)
- Toggle in plugin-settings: `use_v2_api` (default: false)
- Bij v2: user moet eerst inloggen via iframe of native flow

## Aanbeveling

**Korte termijn:** Optie A (iframe embed) voor snelle lancering  
**Lange termijn:** Optie B (native) voor betere UX en branding

## CORS Productie Setup

Zie `docs/CORS_PRODUCTION_PLAN.md` voor:
- Origin whitelist configuratie
- Environment variables
- Deployment checklist

## Eindrooktest Checklist

- [ ] Legacy-pad: WP shortcode `[etsy_ai_generator]` genereert listing via HMAC
- [ ] V2-pad (iframe): Shortcode `[etsy_ai_generator_v2]` laadt SPA, auth werkt, generate succesvol
- [ ] Flatsome UX Builder: drag-and-drop element zichtbaar en functioneel
- [ ] CORS: alleen toegestane origins krijgen response
- [ ] Mobiele test: beide flows werken op mobiel

## Volgende Stappen

1. Deploy SPA naar productie-domein (sellsiren.com/generator)
2. Test iframe-embed in staging WP-omgeving
3. CORS whitelist activeren (zie CORS_PRODUCTION_PLAN.md)
4. Flatsome element updaten met v2-iframe optie
5. Documenteer gebruikersinstructies (login, credits kopen, etc.)
