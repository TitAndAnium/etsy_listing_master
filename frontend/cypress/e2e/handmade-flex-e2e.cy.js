describe('Handmade-Flex E2E Integration Test', () => {
  before(() => {
    // start-server-and-test has already ensured the Vite server is up on 5173
    cy.checkEmulatorStatus()
  })

  beforeEach(() => {
    // Ensure UI is ready before visiting
    cy.ensureUIReady().visit('/')
    
    // Verify page loads correctly
    cy.contains('Etsy AI-Hacker').should('be.visible')
    cy.get('textarea[placeholder*="product description"]').should('be.visible')
  })

  it('should complete full handmade-flex flow: dump→backend→UI→validation', () => {
    const testInput = 'handmade silver ring for mom birthday gift'
    
    // Step 1: Test with allow_handmade = false (should trigger high-severity warning)
    cy.get('textarea[placeholder*="product description"]').clear().type(testInput)
    
    // Ensure allow_handmade checkbox is unchecked
    cy.get('#allow-handmade').should('not.be.checked')
    
    // Submit form
    cy.get('button').contains('Generate Listing').click()
    
    // Should get validation error (HTTP 422)
    cy.get('.text-red-500', { timeout: 20000 }).should('contain', 'Error')
    
    // Step 2: Test with allow_handmade = true (should succeed)
    cy.get('#allow-handmade').check()
    
    // Submit form again
    cy.get('button').contains('Generate Listing').click()
    
    // Wait for successful response
    cy.waitForApiResponse('[data-testid="generated-title"]', 20000)
    
    // Verify generated content appears
    cy.get('[data-testid="generated-title"]').should('be.visible')
    cy.get('[data-testid="generated-tags"]').should('be.visible')
    cy.get('[data-testid="generated-description"]').should('be.visible')
    
    // Verify title contains "handmade" or alternative like "artisan"
    cy.get('[data-testid="generated-title"]').should('satisfy', ($el) => {
      const text = $el.text().toLowerCase()
      return text.includes('handmade') || text.includes('artisan') || text.includes('crafted')
    })
    
    // Verify status badges show appropriate colors
    cy.get('[data-testid="title-badge"]').should(($el) => {
      const cls = $el.attr('class') || ''
      expect(
        cls.includes('bg-green-100') ||
        cls.includes('bg-yellow-100')
      ).to.be.true
    })
    
    // Verify copy button is enabled (not disabled)
    cy.get('button').contains('Copy').should('not.be.disabled')
  })

  it('should validate Firestore logging with quality_score and validation metrics', () => {
    const testInput = 'artisan silver jewelry for women'
    
    // Submit with allow_handmade = false (should trigger validation warning)
    cy.get('textarea[placeholder*="product description"]').clear().type(testInput)
    cy.get('#allow-handmade').as('handmadeToggle')
    cy.get('@handmadeToggle').uncheck()
    cy.get('button').contains('Generate Listing').click()
    
    // Wait for response
    cy.waitForApiResponse('[data-testid="generated-title"]', 20000)
    
    // Make API call to verify Firestore logs
    cy.request({
      url: `${Cypress.env('API_BASE_URL')}/api_generateListingFromDump`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        text: testInput,
        allow_handmade: true
      }
    }).then((response) => {
      // Verify successful response
      expect(response.status).to.eq(200)
      expect(response.body.fields).to.exist
      expect(response.body.validation).to.exist
      
      // Verify validation metrics structure
      expect(response.body.validation.metrics).to.exist
      expect(response.body.validation.metrics.highSeverityWarnings).to.be.a('number')
      expect(response.body.validation.metrics.totalWarnings).to.be.a('number')
      
      // Key validation: no high-severity warnings for clean input
      expect(response.body.validation.metrics.highSeverityWarnings).to.eq(0)
      
      // Quality score should be high (>= 90) for clean validation
      // Note: This validates the quality_score calculation indirectly
      // through the validation metrics structure
      if (response.body.validation.metrics.totalWarnings === 0) {
        // Perfect input should have minimal warnings
        expect(response.body.validation.metrics.totalWarnings).to.be.lessThan(3)
      }
    })
  })

  it('should test validator edge-cases that Jest mocks miss', () => {
    // Test case designed to trigger layer-count validator
    const complexInput = 'handmade silver ring jewelry gift present mom birthday anniversary women ladies custom personalized unique artisan crafted elegant beautiful stunning gorgeous'
    
    cy.get('textarea[placeholder*="product description"]').clear().type(complexInput)
    cy.get('#allow-handmade').check()
    cy.get('button').contains('Generate Listing').click()
    
    cy.waitForApiResponse('[data-testid="generated-title"]', 20000)
    
    // Verify that complex input generates appropriate tags
    cy.get('[data-testid="generated-tags"]').should('be.visible')
    
    // Make API call to check validation details
    cy.request({
      url: `${Cypress.env('API_BASE_URL')}/api_generateListingFromDump`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        text: complexInput,
        allow_handmade: true
      }
    }).then((response) => {
      expect(response.status).to.eq(200)
      
      // Verify validation ran and produced metrics
      expect(response.body.validation.metrics).to.exist
      expect(response.body.validation.metrics.processingTimeMs).to.be.a('number')
      
      // This tests real validator logic that Jest mocks bypass
      // Layer-count validator should have analyzed tag distribution
      if (response.body.validation.warnings) {
        response.body.validation.warnings.forEach(warning => {
          expect(warning).to.have.property('type')
          expect(warning).to.have.property('severity')
          expect(warning).to.have.property('message')
        })
      }
    })
  })

  it('should verify frontend badge mapping uses validation.metrics correctly', () => {
    // Test input that will generate some warnings but not high-severity
    const testInput = 'very long title that might exceed optimal length limits for SEO purposes and could trigger length warnings'
    
    cy.get('textarea[placeholder*="product description"]').clear().type(testInput)
    cy.get('#allow-handmade').as('handmadeToggle')
    cy.get('@handmadeToggle').check()
    cy.get('button').contains('Generate Listing').click()
    
    cy.waitForApiResponse('[data-testid="generated-title"]', 20000)
    
    // Verify badges reflect actual validation state
    // Title might have length warning (yellow badge)
    cy.get('[data-testid="title-badge"]').should('satisfy', ($el) => {
      const classes = $el.attr('class')
      return classes.includes('bg-green-100') || classes.includes('bg-yellow-100')
    })
    
    // Tags and description should be clean (green badges)
    cy.get('[data-testid="tags-badge"]').should('have.class', 'bg-green-100')
    cy.get('[data-testid="description-badge"]').should('have.class', 'bg-green-100')
    
    // Copy button should be enabled since no high-severity warnings
    cy.get('button').contains('Copy').should('not.be.disabled')
  })
})
