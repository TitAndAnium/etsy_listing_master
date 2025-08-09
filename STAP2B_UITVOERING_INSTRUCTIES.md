# Stap 2B: Functionele Testuitvoering - Concrete Instructies

## 🚀 **SETUP (Eenmalig)**

### 1. Firebase Emulators Starten
```bash
cd g:\Dev\onebox-hacker\functions
firebase emulators:start --only functions
```
**Verwacht:** Emulator draait op `http://localhost:5001`

### 2. Test Endpoint Verificatie
**URL:** `http://localhost:5001/[PROJECT-ID]/us-central1/generateFromDumpCore`
**Method:** POST
**Headers:** `Content-Type: application/json`

---

## 🧪 **TESTCASE UITVOERING**

### **Testcase 1: Extreme Sparse Input**
```json
{
  "rawText": "eierdopje",
  "uid": "testuser123",
  "runId": "test-sparse-001",
  "maxRetries": 1
}
```

**✅ Verwacht Resultaat:**
- Status: 200
- `classifier.gift_mode`: false
- `classifier.fallback_profile`: gevuld (bijv. "kitchen accessory")
- `result.fields.title`: Korte titel zonder hallucination
- Logging: `retry_reason: "sparse input detected"`

---

### **Testcase 2: Gift Mode Edge Case**
```json
{
  "rawText": "birthday present for mom",
  "uid": "testuser123", 
  "runId": "test-gift-002",
  "maxRetries": 1
}
```

**✅ Verwacht Resultaat:**
- `classifier.gift_mode`: true
- `classifier.audience`: ["mothers"]
- Title bevat geen "gift"/"present"
- Logging: Geen retry_reason, quality_score > 0

---

### **Testcase 3: Fallback Scenario**
```json
{
  "rawText": "xyz123 random nonsense !@#$%",
  "uid": "testuser123",
  "runId": "test-fallback-003", 
  "maxRetries": 1
}
```

**✅ Verwacht Resultaat:**
- `classifier.retry_reason`: "unrecognizable input"
- `classifier.fallback_profile`: gevuld
- Logging: `fallback_model_used` NIET aanwezig
- Output: Generiek maar valide

---

### **Testcase 4: Validator Stress Test**
```json
{
  "rawText": "handmade ceramic mug for coffee lovers and tea enthusiasts",
  "uid": "testuser123",
  "runId": "test-validator-004",
  "maxRetries": 1
}
```

**✅ Verwacht Resultaat:**
- Alle validator checks slagen
- Tags: Exact 13, lowercase, geen duplicaten
- Description: Alle verplichte blokken
- Logging: `prompt_version: "v2.7"`, quality_score hoog

---

### **Testcase 5: Chaining Consistency**
```json
{
  "rawText": "vintage leather wallet",
  "uid": "testuser123",
  "runId": "test-chaining-005",
  "maxRetries": 1
}
```

**✅ Verwacht Resultaat:**
- Coherente informatie tussen title/tags/description
- Geen contradictie tussen velden
- Validator: Cross-field consistency OK
- Logging: Alle 4 velden gelogd

---

## 📋 **LOGGING VERIFICATIE**

### Console Output Checken:
```bash
# Kijk naar console voor:
- ⚠️ Warnings (verwacht bij sparse input)
- ✅ Successful Firestore writes
- 🔍 Validator results
- 📊 Token usage logging
```

### Firestore Logs Inspecteren:
```javascript
// In Firebase Console of via admin:
// Collection: runs/[runId]/logs
// Verwachte velden:
{
  "field": "title|tags|description|classifier|validation",
  "tokens_in": number,
  "tokens_out": number, 
  "model": "gpt-4o|validator-v4",
  "prompt_version": "v2.7",
  "quality_score": number,
  "retry_reason": string|"",
  "uid": "testuser123"
}
```

---

## 🎯 **SLAAG/FAAL CRITERIA**

### ✅ **SLAAGT ALS:**
- Alle 5 testcases produceren HTTP 200
- Geen hard errors in console
- Firestore bevat logs voor alle runs
- Validator warnings alleen waar verwacht
- JSON output structureel correct

### ❌ **FAALT ALS:**  
- HTTP 500 errors
- Missing required fields in output
- Firestore write failures
- Hard validator errors bij valide input
- Inconsistent chaining tussen prompts

---

## 🔧 **TROUBLESHOOTING**

### Emulator Issues:
```bash
firebase emulators:kill
firebase emulators:start --only functions --debug
```

### API Key Issues:
- Emulator gebruikt dummy responses (USE_DUMMY_LLM = true)
- Geen echte OpenAI calls nodig voor testing

### Logging Issues:
- Check uid = "testuser123" in requests
- Verify runId is unique per test
