# 🛍️ Etsy AI-Hacker

**Production-Ready AI-Powered Etsy Listing Generator**

A comprehensive full-stack application that transforms raw product descriptions into optimized Etsy listings using advanced AI processing, field-by-field validation, and robust error handling.

[![Tests](https://img.shields.io/badge/tests-38%2F38%20passing-brightgreen)]()
[![E2E Tests](https://img.shields.io/badge/e2e-4%2F4%20passing-brightgreen)]()
[![Firebase](https://img.shields.io/badge/firebase-ready-orange)]()
[![React](https://img.shields.io/badge/react-18-blue)]()

## ✨ Key Features

### 🎯 **AI-Powered Content Generation**
- **Smart Title Generation**: SEO-optimized titles with length validation (35-85 chars)
- **Intelligent Tag Creation**: 5+ SEO tags + 1 audience tag with tri-layer structure
- **Rich Descriptions**: 7-section format with CTA blocks and keyword integration
- **Handmade-Flex Logic**: Toggle between "handmade" and "artisan" terminology

### 🔧 **Production-Grade Architecture**
- **Field-by-Field Processing**: Individual retry logic and validation per field
- **Comprehensive Validation**: 4-layer validation system (input → prompt → output → final)
- **Quality Scoring**: Automated quality assessment with metrics tracking
- **Robust Error Handling**: Graceful fallbacks and detailed error reporting

### 🎨 **Modern Frontend**
- **React 18 SPA**: Modern, responsive user interface
- **Real-time Validation**: Live badge status updates (green/yellow/red)
- **Copy-to-Clipboard**: One-click content copying with validation checks
- **Collapsible Panels**: Organized content display with status indicators

### 📊 **Enterprise Monitoring**
- **Firestore Logging**: Complete audit trail with run IDs and timestamps
- **Performance Metrics**: Token usage, response times, and success rates
- **Validation Tracking**: Detailed warning/error categorization
- **E2E Test Coverage**: Comprehensive Cypress test suite

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+** (LTS recommended)
- **Firebase CLI** (`npm install -g firebase-tools`)
- **OpenAI API Key** (GPT-4 access required)

### Installation
```bash
# Clone repository
git clone https://github.com/yourusername/etsy-ai-hacker.git
cd etsy-ai-hacker

# Install dependencies
npm install
cd functions && npm install
cd ../frontend && npm install
cd ..
```

### Environment Setup
```bash
# Create environment file
echo "OPENAI_API_KEY=your-openai-key-here" > functions/.env

# Configure Firebase project
firebase use --add  # Select your Firebase project
```

### Development Workflow
```bash
# Start all services (Backend + Frontend + Database)
npm run dev:full

# Or start services individually:
npm run emulators        # Firebase Functions + Firestore
cd frontend && npm run dev  # React development server

# Run tests
npm test                 # Jest unit tests (38 tests)
npm run test:e2e         # Cypress E2E tests (4 tests)
```

### API Testing
```bash
# Test the core API endpoint
curl -X POST http://localhost:5001/etsy-ai-hacker/us-central1/api_generateListingFromDump \
  -H "Content-Type: application/json" \
  -d '{"text":"handmade wooden jewelry box with velvet interior"}'
```

## 🧪 Local Testing with Emulators

```powershell
# 1. Start emulators (functions + auth + firestore)
cd functions
npm run emul:func
```
You should see **Auth** on port `9099` and **Functions** on `5001`.

```powershell
# 2. Obtain an ID token from the Auth emulator
$token = $(npm run -s dev:token)  # prints JWT

# 3. Make a request (PowerShell example)
$body = @{ text = "Test dump"; allow_handmade = $false; gift_mode = $false } | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:5001/<project-id>/us-central1/api_generateListingFromDump" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" -Body $body
```

The request should return either `200 OK` (mock path) or a validation error (422) but **never** `401` or CORS issues.

### 💳 Stripe (testmodus) – lokaal
1. Configureer Stripe secrets lokaal (emulators):
   ```json
   {
     "stripe": { "secret": "sk_test_…", "webhook_secret": "whsec_…" },
     "app": { "base_url": "http://localhost:5173" }
   }
   ```
   Plaats dit in `functions/.runtimeconfig.json` of via `firebase functions:config:set`.
2. Start de emulators:
   ```bash
   cd functions
   npm run emul:func
   ```
3. Maak een Checkout-sessie (client stuurt alléén `priceId`):
   ```bash
   curl -X POST http://127.0.0.1:5001/<project-id>/us-central1/api_createCheckoutSession \
     -H "Content-Type: application/json" \
     -d '{"priceId":"price_basic_monthly"}'
   ```
4. Rond de testbetaling af; de webhook crediteert nu `plan.credits` in `users/<uid>`.

### 💳 Credits (Firestore-modus)
1. Zet in `functions/.env`:
   ```bash
   DAILY_CREDITS=500   # of kleiner voor tests
   USE_FIRESTORE_CREDITS=1
   ```
2. Start de emulators:
   ```powershell
   cd functions
   npm run emul:func
   ```
3. Haal een JWT-token op:
   ```powershell
   $token = $(npm run -s dev:token)
   ```
4. Doe een call; het credits-saldo wordt nu **transactioneel** in Firestore beheerd:
   ```powershell
   $body = @{ text = "Houten sieradendoos" } | ConvertTo-Json
   Invoke-RestMethod -Method Post `
     -Uri "http://127.0.0.1:5001/<project-id>/us-central1/api_generateListingFromDump" `
     -Headers @{ Authorization = "Bearer $token" } `
     -ContentType "application/json" -Body $body
   ```
   
🤔 Bij overschrijding van het daglimiet (`DAILY_CREDITS`) retourneert de API `429 Daily credits exhausted`.

## 🏗️ Architecture Overview

### Backend (Firebase Functions)
```
functions/
├── prompts/              # Versioned AI prompts (v3.0.2-v3.0.3)
│   ├── title_prompt.txt
│   ├── tag_prompt.txt
│   └── description_prompt.txt
├── utils/
│   ├── validators/       # 4-layer validation system
│   ├── generators/       # Field-specific AI generation
│   └── logging/          # Firestore integration
└── __tests__/           # 38 Jest unit tests
```

### Frontend (React 18)
```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── StatusBadge.tsx
│   │   └── CollapsiblePanels.tsx
│   └── App.tsx          # Main application logic
├── cypress/             # E2E test suite
└── public/              # Static assets
```

### Database (Firestore)
- **Structured Logging**: Run IDs, timestamps, validation metrics
- **Performance Tracking**: Token usage, response times
- **Error Monitoring**: Detailed failure analysis

## 📈 Performance & Quality

### Test Coverage
- ✅ **38/38 Jest Tests Passing** (100% success rate)
- ✅ **4/4 E2E Tests Passing** (Full user journey validation)
- ✅ **Zero High-Severity Errors** (Production-ready validation)

### Performance Metrics
- **API Response Time**: 9-11 seconds (AI processing)
- **Validation Speed**: <5ms per validator
- **Frontend Load Time**: <2 seconds
- **Test Execution**: <30 seconds (full suite)

### Quality Assurance
- **Prompt Versioning**: Semantic versioning with change tracking
- **Validator v4**: Soft-fail mechanism with detailed reporting
- **Security**: Production-ready Firestore rules
- **Error Handling**: Comprehensive fallback strategies

## 🔧 Configuration

### Environment Variables
```bash
# functions/.env
OPENAI_API_KEY=your-key-here

# Optional: Custom model configuration
OPENAI_MODEL=gpt-4
MAX_TOKENS=2000
```

### Firebase Configuration
```json
{
  "functions": {
    "runtime": "nodejs20",
    "source": "functions"
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "functions": {"port": 5001},
    "firestore": {"port": 9081},
    "ui": {"enabled": true}
  }
}
```

### Credits System
#### Daglimiet (`DAILY_CREDITS`)
- Het daglimiet per gebruiker wordt bepaald door de omgevingsvariabele `DAILY_CREDITS` (fallback `DEFAULT_USER_CREDITS`, standaard 500).
- De limiet wordt **runtime** uit de omgeving gelezen (geen hard-coded constant meer).
- In tests wordt het in-memory creditsgeheugen per test leeggemaakt met `_resetTestState()`.

#### Testhelper
- `_resetTestState()` bevindt zich in `functions/utils/credits.js`.
- Wordt in `functions/__tests__/credits.test.js` aangeroepen in `beforeEach()` zodat elke spec met een schone bucket start.

## 🧪 Testing

### Unit Tests (Jest)
```bash
cd functions
npm test
# Expected: 38 tests passing
```

### E2E Tests (Cypress)
```bash
cd frontend
npm run test:e2e
# Tests: API integration, UI validation, error handling
```

### Manual Testing
1. **Backend API**: Test core generation endpoint
2. **Frontend UI**: Verify badge colors and copy functionality
3. **Database**: Check Firestore logging and metrics
4. **Validation**: Test edge cases and error scenarios

## 📚 Documentation

- **[Development Guide](README-DEV.md)**: Detailed setup and development workflow
- **[Project Decisions Log](project_decisions_and_logs.md)**: Complete audit trail
- **[API Documentation](docs/)**: Endpoint specifications and examples
- **[Prompt Documentation](functions/prompts/)**: AI prompt versions and changes

## 🚀 Deployment

### Staging Deployment
```bash
# Deploy to Firebase staging
firebase deploy --project your-staging-project

# Deploy frontend to Netlify/Vercel
cd frontend && npm run build
```

### Production Deployment
```bash
# Full production deployment
firebase deploy --project your-production-project

# Monitor deployment
firebase functions:log --project your-production-project
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Run tests**: `npm test && npm run test:e2e`
4. **Commit changes**: `git commit -m 'Add amazing feature'`
5. **Push to branch**: `git push origin feature/amazing-feature`
6. **Open Pull Request**

### Development Guidelines
- Follow existing code style and patterns
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI GPT-4**: Core AI processing engine
- **Firebase**: Backend infrastructure and hosting
- **React**: Frontend framework
- **Cypress**: E2E testing framework
- **Tailwind CSS**: UI styling system

---

**Status**: ✅ Production Ready | **Version**: 3.0.4 | **Last Updated**: August 2025

- **Emulator UI**: http://localhost:4001
- **Firestore logs**: Navigate to runs > [runId] > logs
- **Token tracking**: Per-field usage and retry metrics

## 🚀 Production Deploy

```bash
firebase deploy --only functions
firebase deploy --only firestore:indexes
```

## 📖 Development Guide

See [README-DEV.md](README-DEV.md) for detailed development setup, testing procedures, and emulator configuration.

## 📝 Project Status

- ✅ **Deliverable 1**: Router-refactor & Prompt Upgrade (22-07-2025)
- ✅ **Deliverable 2**: Prompt-upgrade v2.7 (23-07-2025) - Emulator validated
- 🔄 **Deliverable 3**: Classifier-patch v3.3 (In Progress)

## 🔧 Tech Stack

- **Runtime**: Node.js 20, Firebase Functions
- **AI**: OpenAI GPT-4o (v5 SDK)
- **Database**: Firestore with compound indexes
- **Testing**: Jest with Firebase emulator integration
- **CI/CD**: GitHub Actions (planned)
