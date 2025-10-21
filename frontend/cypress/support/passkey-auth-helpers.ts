/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      authenticateWithPasskey(email: string): Chainable<void>
      authenticateWithPasskeyInteractive(email: string): Chainable<void>
      waitForPasskeyPrompt(): Chainable<void>
      handlePasskeyAuthentication(): Chainable<void>
      setupPasskeyAuth(): Chainable<void>
    }
  }
}

/**
 * Authenticate with passkey using WebAuthn API
 * This command handles the complete passkey authentication flow
 */
Cypress.Commands.add('authenticateWithPasskey', (email: string) => {
  const apiUrl = Cypress.env('API_URL') || 'https://collab-canvas-frontend.up.railway.app'
  
  cy.log(`🔐 Starting passkey authentication for: ${email}`)
  
  // Step 1: Create authentication challenge
  cy.request({
    method: 'POST',
    url: `${apiUrl}/api/test-execution/passkey/auth/challenge`,
    headers: {
      'Content-Type': 'application/json'
    },
    body: { email },
    failOnStatusCode: false
  }).then((challengeResponse) => {
    if (challengeResponse.status !== 200) {
      cy.log(`⚠️ Challenge creation failed: ${challengeResponse.status}`)
      throw new Error(`Challenge creation failed: ${challengeResponse.body?.error || 'Unknown error'}`)
    }
    
    cy.log('✅ Authentication challenge created')
    const challenge = challengeResponse.body.challenge
    
    // Step 2: Use WebAuthn API to authenticate
    cy.window().then((win) => {
      // Check if WebAuthn is supported
      if (!win.navigator.credentials) {
        cy.log('⚠️ WebAuthn not supported, using interactive authentication')
        cy.authenticateWithPasskeyInteractive(email)
        return
      }
      
      // Convert challenge to proper format for WebAuthn
      const publicKeyCredentialRequestOptions = {
        challenge: new Uint8Array(Object.values(challenge.challenge || challenge)),
        allowCredentials: challenge.allowCredentials || [],
        timeout: challenge.timeout || 60000,
        userVerification: challenge.userVerification || 'preferred'
      }
      
      cy.log('🔑 Requesting passkey authentication...')
      
      return win.navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      })
    }).then((credential) => {
      if (!credential) {
        cy.log('⚠️ Passkey authentication cancelled or failed')
        cy.authenticateWithPasskeyInteractive(email)
        return
      }
      
      cy.log('✅ Passkey credential received')
      
      // Step 3: Verify authentication
      const credentialData = {
        id: credential.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
        response: {
          authenticatorData: btoa(String.fromCharCode(...new Uint8Array((credential.response as AuthenticatorAssertionResponse).authenticatorData))),
          clientDataJSON: btoa(String.fromCharCode(...new Uint8Array((credential.response as AuthenticatorAssertionResponse).clientDataJSON))),
          signature: btoa(String.fromCharCode(...new Uint8Array((credential.response as AuthenticatorAssertionResponse).signature))),
          userHandle: (credential.response as AuthenticatorAssertionResponse).userHandle ? 
            btoa(String.fromCharCode(...new Uint8Array((credential.response as AuthenticatorAssertionResponse).userHandle!))) : null
        }
      }
      
      cy.request({
        method: 'POST',
        url: `${apiUrl}/api/test-execution/passkey/auth/verify`,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          challenge: challenge,
          credential: credentialData
        },
        failOnStatusCode: false
      }).then((verifyResponse) => {
        if (verifyResponse.status !== 200) {
          cy.log(`⚠️ Authentication verification failed: ${verifyResponse.status}`)
          throw new Error(`Authentication verification failed: ${verifyResponse.body?.error || 'Unknown error'}`)
        }
        
        cy.log('✅ Passkey authentication successful')
        const { session_token, user } = verifyResponse.body
        
        // Step 4: Store session token and user data
        cy.window().then((win) => {
          win.localStorage.setItem('test_session_token', session_token)
          win.localStorage.setItem('user', JSON.stringify(user))
          win.localStorage.setItem('isAuthenticated', 'true')
        })
        
        cy.log('🔐 Session token stored successfully')
      })
    })
  })
})

/**
 * Interactive passkey authentication for cases where WebAuthn API is not available
 * This command navigates to the login page and handles manual passkey input
 */
Cypress.Commands.add('authenticateWithPasskeyInteractive', (email: string) => {
  cy.log(`🔐 Starting interactive passkey authentication for: ${email}`)
  
  // Navigate to the application
  cy.visit('/')
  cy.wait(2000)
  
  // Look for login/signin elements
  cy.get('body').then(($body) => {
    const bodyText = $body.text().toLowerCase()
    
    if (bodyText.includes('sign in') || bodyText.includes('login') || $body.find('button:contains("Sign"), button:contains("Login")').length > 0) {
      cy.log('🔍 Found login interface, proceeding with authentication')
      
      // Click login button
      cy.get('button:contains("Sign"), button:contains("Login")').first().click({ force: true })
      cy.wait(2000)
      
      // Look for email input
      cy.get('body').then(($body) => {
        const emailInputs = $body.find('input[type="email"], input[name="identifier"], input[placeholder*="email"], input[placeholder*="Email"]')
        
        if (emailInputs.length > 0) {
          cy.log('📧 Found email input, entering email')
          
          // Enter email
          cy.get('input[type="email"], input[name="identifier"], input[placeholder*="email"], input[placeholder*="Email"]')
            .first()
            .clear()
            .type(email)
          
          // Look for Next/Continue button
          cy.get('body').then(($body) => {
            const nextButtons = $body.find('button:contains("Next"), button:contains("Continue"), button[type="submit"], #identifierNext')
            
            if (nextButtons.length > 0) {
              cy.log('➡️ Found next button, proceeding to passkey prompt')
              cy.get('button:contains("Next"), button:contains("Continue"), button[type="submit"], #identifierNext')
                .first()
                .click({ force: true })
              
              cy.wait(3000)
              
              // Wait for passkey prompt and pause for manual input
              cy.waitForPasskeyPrompt()
            } else {
              // Try pressing Enter
              cy.get('input[type="email"], input[name="identifier"], input[placeholder*="email"], input[placeholder*="Email"]')
                .first()
                .type('{enter}')
              
              cy.wait(3000)
              cy.waitForPasskeyPrompt()
            }
          })
        } else {
          cy.log('⚠️ No email input found, attempting direct authentication')
          cy.handlePasskeyAuthentication()
        }
      })
    } else {
      cy.log('✅ Already authenticated or no authentication required')
    }
  })
})

/**
 * Wait for passkey prompt and handle manual authentication
 */
Cypress.Commands.add('waitForPasskeyPrompt', () => {
  cy.log('🔑 Waiting for passkey prompt...')
  
  // Take screenshot of current state
  cy.screenshot('passkey-prompt-waiting')
  
  // Check if we're on Google OAuth or similar
  cy.url().then((url) => {
    if (url.includes('accounts.google.com') || url.includes('oauth')) {
      cy.log('🔍 Detected OAuth flow, waiting for passkey prompt')
      
      // Wait for passkey prompt to appear
      cy.get('body').should('be.visible')
      cy.wait(2000)
      
      // Take screenshot of passkey prompt
      cy.screenshot('passkey-prompt-detected')
      
      // Pause for manual passkey input
      cy.pause('🔑 Please enter your passkey now. The system is waiting for your authentication. Click "Resume" after entering your passkey.')
      
      // After passkey entry, wait for redirect
      cy.wait(5000)
      cy.screenshot('after-passkey-entry')
      
      // Check if we're back in the app
      cy.url().then((newUrl) => {
        if (!newUrl.includes('accounts.google.com') && !newUrl.includes('oauth')) {
          cy.log('✅ Successfully authenticated and redirected to app')
          cy.screenshot('authenticated-app-state')
        } else {
          cy.log('⚠️ Still in OAuth flow, may need additional steps')
          cy.screenshot('still-in-oauth-flow')
        }
      })
    } else {
      cy.log('✅ Not in OAuth flow, checking for authentication state')
      cy.handlePasskeyAuthentication()
    }
  })
})

/**
 * Handle passkey authentication completion
 */
Cypress.Commands.add('handlePasskeyAuthentication', () => {
  cy.log('🔍 Checking authentication state...')
  
  // Wait for page to stabilize
  cy.wait(3000)
  
  // Check if we have authentication indicators
  cy.get('body').then(($body) => {
    const bodyText = $body.text().toLowerCase()
    const hasCanvas = $body.find('[data-testid*="canvas"], canvas, [class*="canvas"]').length > 0
    const hasUserElements = $body.find('[class*="user"], [class*="profile"], [class*="account"]').length > 0
    
    if (hasCanvas || hasUserElements || !bodyText.includes('sign in')) {
      cy.log('✅ Appears to be authenticated')
      cy.screenshot('authentication-success')
      
      // Store authentication state
      cy.window().then((win) => {
        win.localStorage.setItem('isAuthenticated', 'true')
        win.localStorage.setItem('auth_method', 'passkey')
      })
    } else {
      cy.log('⚠️ Authentication may not be complete')
      cy.screenshot('authentication-incomplete')
    }
  })
})

/**
 * Setup passkey authentication environment
 */
Cypress.Commands.add('setupPasskeyAuth', () => {
  cy.log('🔧 Setting up passkey authentication environment')
  
  // Clear any existing authentication state
  cy.clearLocalStorage()
  cy.clearCookies()
  
  // Set up authentication environment variables
  cy.window().then((win) => {
    win.localStorage.setItem('auth_method', 'passkey')
    win.localStorage.setItem('test_mode', 'true')
  })
  
  cy.log('✅ Passkey authentication environment ready')
})
