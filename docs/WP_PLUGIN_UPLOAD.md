# WordPress Plugin Upload & Deployment

Stap-voor-stap upload van etsy-ai-listing plugin v0.3.0 naar sellsiren.com WordPress.

---

## Pre-Upload Checklist

- [ ] Plugin v0.3.0 klaar in `wordpress/etsy-ai-listing/`
- [ ] Shortcode `[etsy_ai_generator_v2]` getest lokaal
- [ ] Frontend deployed op sellsiren.com/generator (of subdomain)
- [ ] WordPress admin access tot sellsiren.com

---

## Stap 1: Plugin ZIP Maken

```bash
cd wordpress

# Create ZIP (zonder node_modules, .git, etc.)
Compress-Archive -Path etsy-ai-listing/* -DestinationPath etsy-ai-listing-v0.3.0.zip

# Of via 7zip/WinRAR:
# Rechtsklik op etsy-ai-listing folder → Send to → Compressed folder
```

**Verify ZIP inhoud:**
```
etsy-ai-listing-v0.3.0.zip
├── etsy-ai-listing.php (hoofdbestand)
├── includes/
│   └── shortcode-v2-iframe.php
└── README.md (optioneel)
```

---

## Stap 2: Upload naar WordPress

### Via WordPress Admin (UI)

1. **Login:** https://sellsiren.com/wp-admin
2. **Navigeer naar Plugins:**
   - Plugins → Add New → Upload Plugin
3. **Upload ZIP:**
   - Click "Choose File" → Select `etsy-ai-listing-v0.3.0.zip`
   - Click "Install Now"
4. **Activate:**
   - Click "Activate Plugin"

### Via FTP (Alternatief)

```bash
# Connect to sellsiren.com via FTP
# Upload to: /wp-content/plugins/etsy-ai-listing/

# Via FileZilla:
# Host: ftp.sellsiren.com
# User: <wp_ftp_user>
# Password: <wp_ftp_pass>
# Remote path: /public_html/wp-content/plugins/
```

---

## Stap 3: Plugin Settings Configureren

1. **Navigeer naar Settings:**
   - WordPress Admin → Settings → Etsy AI Listing

2. **Configureer API Base URL:**
   ```
   API Base URL: https://us-central1-etsy-ai-hacker.cloudfunctions.net
   HMAC Secret: <your_hmac_secret>
   ```

3. **Save Changes**

---

## Stap 4: Test Legacy Shortcode (Bestaande Functionaliteit)

**Create test page:**
1. Pages → Add New
2. Title: "Test Legacy Generator"
3. Content: `[etsy_ai_generator]`
4. Publish

**Verify:**
- Frontend: https://sellsiren.com/test-legacy-generator
- Expected: Form met textarea + Generate knop
- Test generate: Vul product text in → Click Generate
- Expected: Title/Description/Tags output (via HMAC)

---

## Stap 5: Test v2 Iframe Shortcode (Nieuwe Functionaliteit)

**Create test page:**
1. Pages → Add New
2. Title: "Test v2 Generator"
3. Content:
   ```
   [etsy_ai_generator_v2 url="https://sellsiren.com/generator" height="900"]
   ```
4. Publish

**Verify:**
- Frontend: https://sellsiren.com/test-v2-generator
- Expected: Iframe met SPA geladen
- Test login: Click login in iframe → Firebase Auth werkt
- Test generate: v2 toggle aan → Generate succesvol
- Test wallet: Wallet badge toont credits

---

## Stap 6: Flatsome UX Builder Test (Indien Flatsome Actief)

**Via Flatsome UX Builder:**

1. **Edit page met UX Builder:**
   - Pages → Edit → UX Builder button

2. **Add Legacy Element:**
   - Elements → Content → "Etsy AI Generator (legacy)"
   - Drag to page
   - Configure: placeholder, button text
   - Save & Preview

3. **Add v2 Element:**
   - Elements → Content → "Etsy AI Generator v2 (iframe)"
   - Drag to page
   - Configure: URL, height
   - Save & Preview

**Expected:**
- Beide elements renderen correct
- Legacy: Form met HMAC backend
- v2: Iframe met Firebase Auth + wallet

---

## Stap 7: Production Page Setup

**Recommended structure:**

1. **Main Generator Page:**
   ```
   URL: https://sellsiren.com/generator
   Method: Direct link naar SPA (geen shortcode)
   ```

2. **Legacy Fallback (Embedded):**
   ```
   URL: https://sellsiren.com/tools/listing-generator-legacy
   Shortcode: [etsy_ai_generator]
   ```

3. **v2 Iframe (Optional):**
   ```
   URL: https://sellsiren.com/tools/listing-generator
   Shortcode: [etsy_ai_generator_v2 url="https://sellsiren.com/generator"]
   ```

---

## Stap 8: CORS Verificatie (WP → Functions)

**If iframe on sellsiren.com:**
- CORS whitelist moet `https://sellsiren.com` bevatten
- Iframe origin is ZELFDE als parent page → geen CORS issue

**If iframe on subdomain (generator.sellsiren.com):**
```bash
# Update ALLOWED_ORIGINS
firebase functions:config:set cors.allowed_origins="https://sellsiren.com,https://www.sellsiren.com,https://generator.sellsiren.com"
firebase deploy --only functions
```

---

## Troubleshooting

### Plugin activation error: "Plugin file does not exist"

**Oorzaak:** ZIP structuur incorrect

**Fix:**
- ZIP moet etsy-ai-listing.php in ROOT bevatten
- Niet: `etsy-ai-listing-v0.3.0/etsy-ai-listing/etsy-ai-listing.php`
- Wel: `etsy-ai-listing/etsy-ai-listing.php`

### Shortcode renders als text: `[etsy_ai_generator_v2]`

**Oorzaak:** Plugin niet geactiveerd of PHP error

**Check:**
1. Plugins page → Verify "Etsy AI Listing" is Active
2. WordPress debug mode:
   ```php
   // wp-config.php
   define('WP_DEBUG', true);
   define('WP_DEBUG_LOG', true);
   ```
3. Check logs: `/wp-content/debug.log`

### Iframe not loading (blank or error)

**Check browser console:**
- `X-Frame-Options` header blocking?
- CSP (Content Security Policy) issue?

**Fix (if needed):**
```php
// functions.php (WordPress theme)
add_action('send_headers', function() {
  header('X-Frame-Options: SAMEORIGIN');
  // Of: header('Content-Security-Policy: frame-ancestors \'self\' https://sellsiren.com');
});
```

### Iframe loads but SPA has CORS errors

**Verify:**
1. Iframe `src` URL correct (https://sellsiren.com/generator)
2. SPA deployed en bereikbaar
3. Functions CORS whitelist bevat sellsiren.com
4. Browser DevTools → Network tab → Check CORS headers

---

## Rollback Procedure

**Via WordPress Admin:**
1. Plugins → Etsy AI Listing → Deactivate
2. Delete
3. Upload previous version (v0.2.0)
4. Activate

**Via FTP:**
1. Rename `/wp-content/plugins/etsy-ai-listing/` to `etsy-ai-listing-backup/`
2. Upload old version
3. Activate via WordPress Admin

---

## Success Criteria

✅ **Plugin upload succesvol** als:
1. Plugin zichtbaar in WordPress Admin → Plugins
2. Activation → geen errors
3. Settings page bereikbaar → Etsy AI Listing instellingen
4. Legacy shortcode `[etsy_ai_generator]` → form renders en werkt
5. v2 shortcode `[etsy_ai_generator_v2]` → iframe laadt SPA
6. Flatsome UX Builder → beide elements beschikbaar
7. Frontend → shortcodes renderen zonder errors
8. CORS → SPA in iframe kan API aanroepen

---

## Monitoring (First Week)

- [ ] Test legacy shortcode dagelijks (HMAC blijft werken)
- [ ] Test v2 shortcode dagelijks (iframe + auth)
- [ ] Check WordPress error logs (geen PHP errors)
- [ ] Monitor user feedback (via support tickets)
- [ ] Verify mobile UX (iframe responsive?)

---

## Documentation for End Users

**Add to WordPress Page/Post:**

```markdown
# How to Use the Etsy AI Listing Generator

## Option 1: Legacy Generator (No Login Required)
Use shortcode: [etsy_ai_generator]

Steps:
1. Paste your product description
2. Click "Generate"
3. Copy Title, Description, and Tags to Etsy

## Option 2: v2 Generator (Login Required, Credits System)
Use shortcode: [etsy_ai_generator_v2]

Steps:
1. Login with your account
2. Check your credits balance
3. Use advanced features (Context & Targeting)
4. Generate optimized listings
5. Buy more credits if needed

Note: v2 offers better quality and personalization.
```

---

## References

- Plugin code: `wordpress/etsy-ai-listing/`
- WP Shortcode API: https://developer.wordpress.org/plugins/shortcodes/
- Flatsome UX Builder: https://uxbuilder.io/docs/
- WP Debug: https://wordpress.org/documentation/article/debugging-in-wordpress/
