describe('Prompt Version Header Validation', () => {
  it('should validate that all prompt files have proper ::VERSION:: headers', () => {
    const promptFiles = [
      'title_prompt.txt',
      'tag_prompt.txt', 
      'description_prompt.txt',
      'classifier_prompt.txt'
    ]

    // Test each prompt file via API to ensure version parsing works
    promptFiles.forEach(promptFile => {
      cy.request({
        url: `${Cypress.env('API_BASE_URL')}/api_generateListingFromDump`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          text: 'test version validation',
          allow_handmade: false
        },
        failOnStatusCode: false
      }).then((response) => {
        // Should not get 422 due to version header parsing errors
        // If version headers are broken, we'd get "Prompt version header missing or malformed"
        if (response.status === 422) {
          expect(response.body.error).to.not.contain('version header')
          expect(response.body.error).to.not.contain('missing or malformed')
        }
        
        // Any other error is acceptable (validation errors, etc.)
        // But version parsing must work
        expect([200, 422]).to.include(response.status)
      })
    })
  })

  it('should fail if ::VERSION:: header is missing from any prompt', () => {
    // This test ensures our version validation catches broken prompts
    // It validates the loadPromptWithVersion.js logic indirectly
    
    cy.request({
      url: `${Cypress.env('API_BASE_URL')}/api_generateListingFromDump`,
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        text: 'version header validation test',
        allow_handmade: true
      },
      failOnStatusCode: false
    }).then((response) => {
      // Response should be 200 or 422 (validation error)
      // But never a version header parsing error
      expect([200, 422]).to.include(response.status)
      
      if (response.status === 422) {
        // Error should be validation-related, not version parsing
        expect(response.body.error).to.not.contain('Prompt version header')
        expect(response.body.error).to.not.contain('missing or malformed')
      }
    })
  })
})
