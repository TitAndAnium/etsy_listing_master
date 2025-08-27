/// <reference types="cypress" />

// Precieze, absolute URL voor betrouwbare interceptie
const API_URL = 'http://localhost:5001/etsy-ai-hacker/us-central1/api_generateListingFromDump'

describe('Copy-All gating rooktest', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.get('textarea').type('dummy') // knop activeren
  })

  it('enables Copy All when no errors', () => {
    cy.intercept('POST', API_URL, {
      statusCode: 200,
      body: {
        fields: {
          title: 'ok title',
          tags: Array.from({ length: 13 }, (_, i) => `tag${i}`),
          description: 'ok'
        },
        validation: {
          isValid: true,
          warnings: [],
          metrics: { highSeverityWarnings: 0, totalWarnings: 0 }
        }
      }
    }).as('genOk')

    cy.contains('button', 'Generate Listing').should('not.be.disabled').click()
    cy.wait('@genOk')

    // Wait for the badges to appear after API response processing
    cy.get('[data-testid^="badge-"]').should('have.length', 3)

    cy.badge('title', 'ok').should('exist')
    cy.badge('tags', 'ok').should('exist')
    cy.badge('description', 'ok').should('exist')
    cy.get('[data-testid="btn-copy-all"]').should('not.be.disabled')
  })

  it('disables Copy All on high-severity error', () => {
    cy.intercept('POST', API_URL, {
      statusCode: 422,
      body: {
        fields: { 
          title: 'still ok',
          tags: Array.from({ length: 13 }, (_, i) => `tag${i}`),
          description: 'ascii',
        },
        validation: {
          isValid: false,
          warnings: [
            { field: 'tags', type: 'some_error', severity: 'high', message: 'A high severity error on tags' }
          ],
          metrics: { highSeverityWarnings: 1, totalWarnings: 1 }
        }
      }
    }).as('genError')

    cy.contains('button', 'Generate Listing').should('not.be.disabled').click()
    cy.wait('@genError')

    // Wait for the badges to appear after API response processing
    cy.get('[data-testid^="badge-"]').should('have.length', 3)

    cy.badge('tags', 'error').should('exist')
    cy.badge('title', 'ok').should('exist')
    cy.badge('description', 'ok').should('exist')

    cy.get('[data-testid="btn-copy-all"]').should('be.disabled')
  })
})
