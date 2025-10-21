// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Import authentication helpers for production testing
import './auth-helpers'

// Import passkey authentication helpers
import './passkey-auth-helpers'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Disable CSS animations/transitions during tests to reduce flakiness
beforeEach(() => {
  const disableAnimationsCss = `
    *, *::before, *::after {
      transition: none !important;
      animation: none !important;
      scroll-behavior: auto !important;
    }
  `
  cy.document().then((doc) => {
    const style = doc.createElement('style')
    style.setAttribute('data-testid', 'cypress-disable-animations')
    style.appendChild(doc.createTextNode(disableAnimationsCss))
    doc.head.appendChild(style)
  })
})
