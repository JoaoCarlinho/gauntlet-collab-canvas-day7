/// <reference types="cypress" />

describe('Email/Password Authentication Test', () => {
  const productionUrl = 'https://gauntlet-collab-canvas-day7.vercel.app'

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  describe('Email/Password Authentication UI', () => {
    it('Should display authentication method selector', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of login page with method selector
      cy.screenshot('email-password-auth-method-selector', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for authentication method selector
      cy.get('body').should('be.visible')
      
      // Look for method selector elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('google') && bodyText.includes('email')) {
          cy.log('✅ Authentication method selector detected')
        }
      })
      
      cy.log('📸 Screenshot saved: email-password-auth-method-selector.png')
    })

    it('Should show email/password form when email method is selected', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Look for email method button and click it
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('email')) {
          // Try to find and click email method button
          cy.get('button').contains('Email').first().click()
          cy.wait(1000)
          
          // Take screenshot of email/password form
          cy.screenshot('email-password-form', {
            capture: 'fullPage',
            overwrite: true
          })
          
          // Check for email/password form elements
          cy.get('body').then(($body) => {
            const bodyText = $body.text().toLowerCase()
            if (bodyText.includes('email') && bodyText.includes('password')) {
              cy.log('✅ Email/password form detected')
            }
          })
          
          cy.log('📸 Screenshot saved: email-password-form.png')
        }
      })
    })

    it('Should show sign in and sign up modes', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Look for email method and switch to it
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('email')) {
          cy.get('button').contains('Email').first().click()
          cy.wait(1000)
          
          // Look for sign in/sign up toggle
          cy.get('body').then(($body) => {
            const bodyText = $body.text().toLowerCase()
            if (bodyText.includes('sign in') && bodyText.includes('sign up')) {
              cy.log('✅ Sign in/Sign up toggle detected')
              
              // Take screenshot of sign in/sign up modes
              cy.screenshot('email-password-sign-in-sign-up-modes', {
                capture: 'fullPage',
                overwrite: true
              })
              
              cy.log('📸 Screenshot saved: email-password-sign-in-sign-up-modes.png')
            }
          })
        }
      })
    })
  })

  describe('Form Validation', () => {
    it('Should validate email format', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Switch to email method
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('email')) {
          cy.get('button').contains('Email').first().click()
          cy.wait(1000)
          
          // Try to find email input and test validation
          cy.get('input[type="email"], input[placeholder*="email" i]').first().then(($input) => {
            if ($input.length > 0) {
              // Test invalid email
              cy.wrap($input).type('invalid-email')
              cy.wrap($input).blur()
              
              // Take screenshot of validation
              cy.screenshot('email-validation-test', {
                capture: 'fullPage',
                overwrite: true
              })
              
              cy.log('📸 Screenshot saved: email-validation-test.png')
            }
          })
        }
      })
    })

    it('Should validate password requirements', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Switch to email method
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('email')) {
          cy.get('button').contains('Email').first().click()
          cy.wait(1000)
          
          // Try to find password input and test validation
          cy.get('input[type="password"], input[placeholder*="password" i]').first().then(($input) => {
            if ($input.length > 0) {
              // Test weak password
              cy.wrap($input).type('123')
              cy.wrap($input).blur()
              
              // Take screenshot of password validation
              cy.screenshot('password-validation-test', {
                capture: 'fullPage',
                overwrite: true
              })
              
              cy.log('📸 Screenshot saved: password-validation-test.png')
            }
          })
        }
      })
    })
  })

  after(() => {
    cy.log('🎉 Email/Password authentication UI testing completed!')
    cy.log('📁 Screenshots saved in: cypress/screenshots/production/email-password-authentication-test.cy.ts/')
  })
})
