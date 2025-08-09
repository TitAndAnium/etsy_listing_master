// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Robust wait helper that retries until server is truly reachable
Cypress.Commands.add('waitUntilReachable', (url, retries = 20) => {
  const ping = (attempt = 0) => {
    // For API endpoints, send proper POST request
    const isApiEndpoint = url.includes('api_generateListingFromDump')
    const requestConfig = isApiEndpoint ? {
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { text: 'ping', allow_handmade: false },
      failOnStatusCode: false,
      timeout: 15000
    } : {
      url,
      failOnStatusCode: false,
      timeout: 15000
    }
    
    return cy.request(requestConfig)
      .then(res => {
        // Accept 200 (success), 400 (bad request), 422 (validation error) as "server ready"
        if ([200, 400, 422].includes(res.status)) {
          cy.log(`✅ Server ${url} is ready (status ${res.status}, attempt ${attempt + 1})`)
          return
        }
        if (attempt >= retries) {
          throw new Error(`❌ Server ${url} not ready after ${retries} attempts (last status: ${res.status})`)
        }
        cy.log(`⏳ Server ${url} not ready (status ${res.status}), retrying... (attempt ${attempt + 1})`)
        return cy.wait(1500).then(() => ping(attempt + 1))
      })
  }
  return ping()
})

// Ensure UI is ready before visiting
Cypress.Commands.add('ensureUIReady', () => {
  return cy.request({ 
    url: '/', 
    retryOnStatusCodeFailure: true, 
    timeout: 60000 
  })
})

// Check Firebase emulator API endpoint specifically
Cypress.Commands.add('checkEmulatorStatus', () => {
  return cy.request({
    url: `${Cypress.env('API_BASE_URL')}/api_generateListingFromDump`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: {
      text: 'test connection',
      allow_handmade: false
    },
    timeout: 30000,
    failOnStatusCode: false
  }).then((response) => {
    // Should get either 200 (success) or 422 (validation error)
    // Both indicate emulator is running
    expect([200, 422]).to.include(response.status)
    cy.log(`✅ Emulator API ready with status ${response.status}`)
  })
})

// Custom command to wait for API response
Cypress.Commands.add('waitForApiResponse', (selector, timeout = 15000) => {
  cy.get(selector, { timeout }).should('be.visible')
})
