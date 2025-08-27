import '@testing-library/cypress/add-commands';

Cypress.Commands.add('badge', (field: 'title'|'tags'|'description', status?: 'ok'|'warn'|'error') => {
  if (status) {
    return cy.get(`[data-testid="badge-${field}-${status}"]`);
  }
  return cy.get(`[data-testid^="badge-${field}-"]`);
});

// Preview-flow helpers (no emulator)
Cypress.Commands.add('checkEmulatorStatus', () => {
  // In preview-flow we don't run Firebase emulators; just assert UI is reachable
  return cy.request({ url: '/', failOnStatusCode: false }).its('status').should('be.oneOf', [200, 304])
})

Cypress.Commands.add('ensureUIReady', () => {
  // Ensure root page is served and basic app shell is present
  cy.visit('/');
  cy.contains('Etsy AI-Hacker').should('be.visible');
  return cy; // allow chaining like ensureUIReady().visit('/')
})

Cypress.Commands.add('waitForApiResponse', (selector: string, timeout = 20000) => {
  // For mocked flows, simply wait for target element to appear
  return cy.get(selector, { timeout }).should('exist')
})

declare global {
  namespace Cypress {
    interface Chainable {
      badge(field:'title'|'tags'|'description', status?:'ok'|'warn'|'error'): Chainable<JQuery<HTMLElement>>
      checkEmulatorStatus(): Chainable<any>
      ensureUIReady(): Chainable<any>
      waitForApiResponse(selector: string, timeout?: number): Chainable<JQuery<HTMLElement>>
    }
  }
}
