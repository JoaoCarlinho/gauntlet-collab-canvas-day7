/// <reference types="cypress" />

describe('Debug Authentication Flow', () => {
  const targetUrl = 'https://collab-canvas-frontend.up.railway.app/'

  it('should debug the authentication flow', () => {
    // Visit the main page
    cy.visit(targetUrl)
    cy.wait(5000) // Wait for page to fully load
    
    // Take a screenshot to see what we're looking at
    cy.screenshot('debug-auth-initial-page')
    
    // Check the current URL
    cy.url().then((url) => {
      cy.log(`Current URL: ${url}`)
    })
    
    // Check if we're on a login page or redirected
    cy.get('body').then(($body) => {
      const bodyText = $body.text()
      cy.log(`Page content: ${bodyText.substring(0, 500)}...`)
      
      // Look for any login-related elements
      const hasEmailInput = $body.find('input[type="email"]').length > 0
      const hasPasswordInput = $body.find('input[type="password"]').length > 0
      const hasGoogleButton = $body.find('button:contains("Google"), a:contains("Google")').length > 0
      const hasSignInButton = $body.find('button:contains("Sign In"), button:contains("Login")').length > 0
      
      cy.log(`Has email input: ${hasEmailInput}`)
      cy.log(`Has password input: ${hasPasswordInput}`)
      cy.log(`Has Google button: ${hasGoogleButton}`)
      cy.log(`Has sign in button: ${hasSignInButton}`)
      
      // Check for any error messages
      const hasErrorMessages = $body.find('.error, .alert, [class*="error"]').length > 0
      cy.log(`Has error messages: ${hasErrorMessages}`)
      
      if (hasErrorMessages) {
        $body.find('.error, .alert, [class*="error"]').each((index, element) => {
          cy.log(`Error message ${index}: ${element.textContent}`)
        })
      }
    })
    
    // Check console for any errors
    cy.window().then((win) => {
      // Override console methods to capture messages
      const originalError = win.console.error
      const originalWarn = win.console.warn
      const originalLog = win.console.log
      
      win.console.error = (...args) => {
        cy.log(`CONSOLE ERROR: ${args.join(' ')}`)
        originalError.apply(win.console, args)
      }
      
      win.console.warn = (...args) => {
        cy.log(`CONSOLE WARN: ${args.join(' ')}`)
        originalWarn.apply(win.console, args)
      }
      
      win.console.log = (...args) => {
        cy.log(`CONSOLE LOG: ${args.join(' ')}`)
        originalLog.apply(win.console, args)
      }
    })
    
    // Wait a bit more to see if anything changes
    cy.wait(3000)
    cy.screenshot('debug-auth-after-wait')
  })
})
