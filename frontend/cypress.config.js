const { defineConfig } = require('cypress')

module.exports = defineConfig({
  // Global timeout settings (moved to root level)
  requestTimeout: 30000,
  responseTimeout: 30000,
  defaultCommandTimeout: 30000,
  
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/commands.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    env: {
      API_BASE_URL: 'http://localhost:5001/etsy-ai-hacker/us-central1'
    }
  }
})
