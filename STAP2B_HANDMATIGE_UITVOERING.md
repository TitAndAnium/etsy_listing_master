# Stap 2B: Handmatige Testuitvoering

## 🚀 **STAP 1: Emulator Starten (Terminal 1)**

Open een nieuwe PowerShell/CMD terminal en voer uit:
```bash
cd g:\Dev\onebox-hacker\functions
firebase emulators:start --only functions
```

**Wacht tot je ziet:**
```
✔  functions: Emulator started at http://localhost:5001
```

## 🧪 **STAP 2: Tests Uitvoeren (Terminal 2)**

Open een **tweede** PowerShell/CMD terminal en voer de testcases uit:

### **Testcase 1: Sparse Input**
```powershell
curl -X POST "http://localhost:5001/onebox-hacker/us-central1/generateFromDumpCore" -H "Content-Type: application/json" -d '{\"rawText\": \"eierdopje\", \"uid\": \"testuser123\", \"runId\": \"test-sparse-001\", \"maxRetries\": 1}'
```

### **Testcase 2: Gift Mode**
```powershell
curl -X POST "http://localhost:5001/onebox-hacker/us-central1/generateFromDumpCore" -H "Content-Type: application/json" -d '{\"rawText\": \"birthday present for mom\", \"uid\": \"testuser123\", \"runId\": \"test-gift-002\", \"maxRetries\": 1}'
```

### **Testcase 3: Fallback**
```powershell
curl -X POST "http://localhost:5001/onebox-hacker/us-central1/generateFromDumpCore" -H "Content-Type: application/json" -d '{\"rawText\": \"xyz123 random nonsense\", \"uid\": \"testuser123\", \"runId\": \"test-fallback-003\", \"maxRetries\": 1}'
```

### **Testcase 4: Validator Stress**
```powershell
curl -X POST "http://localhost:5001/onebox-hacker/us-central1/generateFromDumpCore" -H "Content-Type: application/json" -d '{\"rawText\": \"handmade ceramic mug for coffee lovers\", \"uid\": \"testuser123\", \"runId\": \"test-validator-004\", \"maxRetries\": 1}'
```

### **Testcase 5: Chaining**
```powershell
curl -X POST "http://localhost:5001/onebox-hacker/us-central1/generateFromDumpCore" -H "Content-Type: application/json" -d '{\"rawText\": \"vintage leather wallet\", \"uid\": \"testuser123\", \"runId\": \"test-chaining-005\", \"maxRetries\": 1}'
```

## 📋 **STAP 3: Resultaten Documenteren**

Voor elke testcase, noteer:
- **HTTP Status Code** (verwacht: 200)
- **JSON Response Structure** 
- **Console Output** in Terminal 1 (emulator logs)
- **Validator Warnings/Errors**

## 🎯 **Alternatief: Postman/Insomnia**

Als curl niet werkt, gebruik Postman:
- **URL:** `http://localhost:5001/onebox-hacker/us-central1/generateFromDumpCore`
- **Method:** POST
- **Headers:** `Content-Type: application/json`
- **Body:** Raw JSON (zie testcases hierboven)

## 🔧 **Troubleshooting**

### Emulator start niet:
```bash
firebase emulators:kill
firebase login
firebase use --add  # selecteer je project
firebase emulators:start --only functions
```

### Curl niet gevonden:
- Installeer Git Bash of gebruik PowerShell Invoke-WebRequest
- Of gebruik Postman/browser developer tools

### Project ID onbekend:
- Check `.firebaserc` voor project ID
- Vervang "onebox-hacker" in URL met jouw project ID
