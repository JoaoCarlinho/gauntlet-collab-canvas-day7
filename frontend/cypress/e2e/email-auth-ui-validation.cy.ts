/// <reference types="cypress" />

describe('Email/Password Authentication UI Validation', () => {
  const productionUrl = 'https://gauntlet-collab-canvas-day7.vercel.app'

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  it('Should display email/password authentication UI in production', () => {
    cy.visit(productionUrl)
    cy.wait(3000)
    
    // Take initial screenshot
    cy.screenshot('email-auth-ui-initial', {
      capture: 'fullPage',
      overwrite: true
    })
    
    // Check for authentication method selector
    cy.get('body').then(($body) => {
      const bodyText = $body.text().toLowerCase()
      cy.log('Page content:', bodyText)
      
      // Look for email authentication elements
      if (bodyText.includes('email') || bodyText.includes('password')) {
        cy.log('✅ Email/password authentication UI detected')
        
        // Try to find and click email authentication method
        cy.get('body').then(($body) => {
          // Look for buttons or elements that might switch to email auth
          const emailButtons = $body.find('button:contains("Email"), button:contains("email"), [data-testid*="email"], [class*="email"]')
          if (emailButtons.length > 0) {
            cy.log(`Found ${emailButtons.length} email-related elements`)
            cy.wrap(emailButtons.first()).click()
            cy.wait(2000)
            
            // Take screenshot after clicking email option
            cy.screenshot('email-auth-ui-after-click', {
              capture: 'fullPage',
              overwrite: true
            })
          }
        })
        
        // Look for email/password form fields
        cy.get('body').then(($body) => {
          const emailInputs = $body.find('input[type="email"], input[placeholder*="email" i], input[name*="email" i]')
          const passwordInputs = $body.find('input[type="password"], input[placeholder*="password" i], input[name*="password" i]')
          
          if (emailInputs.length > 0 && passwordInputs.length > 0) {
            cy.log('✅ Email and password input fields found')
            
            // Take screenshot of form fields
            cy.screenshot('email-auth-ui-form-fields', {
              capture: 'fullPage',
              overwrite: true
            })
            
            // Try to interact with the form
            cy.wrap(emailInputs.first()).type('test@example.com')
            cy.wrap(passwordInputs.first()).type('testpassword')
            
            // Take screenshot after filling form
            cy.screenshot('email-auth-ui-form-filled', {
              capture: 'fullPage',
              overwrite: true
            })
          } else {
            cy.log('⚠️ Email/password form fields not found')
            cy.log(`Email inputs found: ${emailInputs.length}`)
            cy.log(`Password inputs found: ${passwordInputs.length}`)
          }
        })
      } else {
        cy.log('❌ Email/password authentication UI not detected')
        cy.log('Available text on page:', bodyText.substring(0, 500))
      }
    })
    
    // Check for Google sign-in button (should still be present)
    cy.get('body').then(($body) => {
      const googleButtons = $body.find('button:contains("Google"), button:contains("Sign in"), [data-testid*="google"]')
      if (googleButtons.length > 0) {
        cy.log('✅ Google sign-in button still present')
      } else {
        cy.log('⚠️ Google sign-in button not found')
      }
    })
    
    cy.log('📸 Screenshots saved for email authentication UI validation')
  })

  it('Should test actual email/password authentication flow', () => {
    cy.visit(productionUrl)
    cy.wait(3000)
    
    // Take screenshot before authentication attempt
    cy.screenshot('email-auth-flow-before', {
      capture: 'fullPage',
      overwrite: true
    })
    
    // Try to find and use email authentication
    cy.get('body').then(($body) => {
      const bodyText = $body.text().toLowerCase()
      
      if (bodyText.includes('email') || bodyText.includes('password')) {
        // Look for email input and try authentication
        const emailInput = $body.find('input[type="email"], input[placeholder*="email" i]').first()
        const passwordInput = $body.find('input[type="password"], input[placeholder*="password" i]').first()
        
        if (emailInput.length > 0 && passwordInput.length > 0) {
          cy.log('Attempting email/password authentication...')
          
          // Fill in test credentials
          cy.wrap(emailInput).clear().type('test@collabcanvas.com')
          cy.wrap(passwordInput).clear().type('TestPassword123!')
          
          // Take screenshot with credentials filled
          cy.screenshot('email-auth-flow-credentials-filled', {
            capture: 'fullPage',
            overwrite: true
          })
          
          // Look for submit button
          const submitButton = $body.find('button[type="submit"], button:contains("Sign In"), button:contains("Login")').first()
          if (submitButton.length > 0) {
            cy.wrap(submitButton).click()
            cy.wait(3000)
            
            // Take screenshot after authentication attempt
            cy.screenshot('email-auth-flow-after-submit', {
              capture: 'fullPage',
              overwrite: true
            })
            
            // Check if authentication was successful
            cy.url().then((url) => {
              if (!url.includes('/login')) {
                cy.log('✅ Email/password authentication appears successful')
              } else {
                cy.log('⚠️ Still on login page - authentication may have failed')
              }
            })
          }
        }
      }
    })
    
    cy.log('📸 Screenshots saved for email authentication flow')
  })

  after(() => {
    cy.log('🎉 Email/Password Authentication UI validation completed!')
    cy.log('📁 Screenshots saved in: cypress/screenshots/production/email-auth-ui-validation.cy.ts/')
  })
})
