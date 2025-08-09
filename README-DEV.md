# Development Setup Guide

## 🔧 Environment Setup

### Required Files
```bash
# Create .env file in functions directory
echo "OPENAI_API_KEY=your-openai-key-here" > functions/.env
```

### Install Dependencies
```bash
npm install
cd functions && npm ci
```

## 🚀 Firebase Emulators

### Start Emulators
```bash
npm run emulators
# or clean start:
npm run emulators:clean
```

### Emulator Ports
- **Functions**: http://localhost:5001
- **Firestore**: http://localhost:9081  
- **Emulator UI**: http://localhost:4001

## 🧪 Testing

### PowerShell Test (Recommended)
```powershell
$body = @{
  rawText = "handmade wooden ring box"
  uid = "testuser123" 
  runId = "demo"
  maxRetries = 1
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:5001/etsy-ai-hacker/us-central1/generateFromDumpCore" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

### Expected Response
```json
{
  "success": true,
  "fields": {
    "title": "Handmade Wooden Ring Box...",
    "tags": ["ring box", "wooden jewelry", ...],
    "description": "Perfect for storing your precious rings..."
  }
}
```

## 📊 Monitoring & Logs

### Firestore Logs
- **Emulator UI**: http://localhost:4001/firestore
- **Path**: `runs > [runId] > logs`
- **Per-field logs**: tokens_in, tokens_out, retry_count, model

### Debug Output
- Console logs appear in emulator terminal
- Error details in `firebase-debug.log`

## 🔄 Common Commands

```bash
# Clean restart emulators
npm run emulators:clean

# Run tests
npm test

# Check vulnerabilities
npm audit

# Fix vulnerabilities  
npm audit fix
```

## 🐛 Troubleshooting

### Port Conflicts
If emulators fail to start:
```bash
taskkill /f /im node.exe
taskkill /f /im java.exe
```

### Function Not Found
Ensure `generateFromDumpCore` is properly exported in `functions/index.js`

### OpenAI Errors
Verify `OPENAI_API_KEY` is set in `functions/.env`
