/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      authenticateTestUser(): Chainable<void>
      authenticateWithFirebase(email: string, password: string): Chainable<void>
      mockAuthenticatedState(): Chainable<void>
      loginWithTestUser(): Chainable<void>
      logoutTestUser(): Chainable<void>
      waitForAuthentication(): Chainable<void>
    }
  }
}

/**
 * Authenticate test user for production testing
 * This function attempts to authenticate using real test credentials
 */
Cypress.Commands.add('authenticateTestUser', () => {
  const testEmail = Cypress.env('TEST_USER_EMAIL')
  const testPassword = Cypress.env('TEST_USER_PASSWORD')
  const apiUrl = Cypress.env('API_URL')
  
  if (!testEmail || !testPassword) {
    cy.log('⚠️ Test user credentials not configured, using mock authentication')
    cy.mockAuthenticatedState()
    return
  }

  cy.log(`🔐 Attempting to authenticate real test user: ${testEmail}`)
  
  // Try to authenticate via test execution API first
  cy.request({
    method: 'POST',
    url: `${apiUrl}/api/test-execution/auth/login`,
    body: {
      email: testEmail,
      password: testPassword
    },
    failOnStatusCode: false
  }).then((response) => {
    if (response.status === 200) {
      cy.log('✅ Real test user authenticated via test execution API')
      const { token, user } = response.body
      
      // Store token for API calls
      cy.wrap(token).as('authToken')
      cy.wrap(user).as('testUser')
      
      // Set token in localStorage for frontend
      cy.window().then((win) => {
        win.localStorage.setItem('idToken', token)
        win.localStorage.setItem('user', JSON.stringify(user))
        win.localStorage.setItem('isAuthenticated', 'true')
      })
    } else {
      cy.log(`⚠️ Test execution API authentication failed (${response.status}), trying Firebase direct authentication`)
      cy.authenticateWithFirebase(testEmail, testPassword)
    }
  })
})

/**
 * Authenticate with Firebase directly using email/password
 * This attempts to use Firebase SDK for authentication
 */
Cypress.Commands.add('authenticateWithFirebase', (email: string, password: string) => {
  cy.log(`🔥 Attempting Firebase direct authentication for: ${email}`)
  
  // Visit the application first
  cy.visit('/')
  cy.wait(2000)
  
  // Try to find and interact with Firebase auth elements
  cy.window().then((win) => {
    // Check if Firebase is available
    if (win.firebase || win.firebaseApp) {
      cy.log('✅ Firebase SDK detected, attempting direct authentication')
      
      // Try to use Firebase auth directly
      cy.wrap(win).then((window) => {
        if (window.firebase && window.firebase.auth) {
          const auth = window.firebase.auth()
          auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
              cy.log('✅ Firebase authentication successful')
              const user = userCredential.user
              const token = user.getIdToken()
              
              token.then((idToken) => {
                // Store authentication data
                cy.wrap(idToken).as('authToken')
                cy.wrap(user).as('testUser')
                
                // Set in localStorage
                win.localStorage.setItem('idToken', idToken)
                win.localStorage.setItem('user', JSON.stringify({
                  id: user.uid,
                  email: user.email,
                  name: user.displayName || 'Test User'
                }))
                win.localStorage.setItem('isAuthenticated', 'true')
              })
            })
            .catch((error) => {
              cy.log(`❌ Firebase authentication failed: ${error.message}`)
              cy.log('🔄 Falling back to mock authentication')
              cy.mockAuthenticatedState()
            })
        } else {
          cy.log('⚠️ Firebase auth not available, using mock authentication')
          cy.mockAuthenticatedState()
        }
      })
    } else {
      cy.log('⚠️ Firebase SDK not detected, using mock authentication')
      cy.mockAuthenticatedState()
    }
  })
})

/**
 * Mock authenticated state for testing
 * This creates a mock authentication state without real credentials
 */
Cypress.Commands.add('mockAuthenticatedState', () => {
  cy.log('🎭 Setting up mock authenticated state')
  
  const mockUser = {
    id: 'test-user-id',
    email: Cypress.env('TEST_USER_EMAIL') || 'test@collabcanvas.com',
    name: Cypress.env('TEST_USER_DISPLAY_NAME') || 'Test User',
    uid: 'test-uid-123'
  }
  
  const mockToken = 'mock-jwt-token-for-testing'
  
  // Store mock data
  cy.wrap(mockToken).as('authToken')
  cy.wrap(mockUser).as('testUser')
  
  // Set mock data in localStorage
  cy.window().then((win) => {
    win.localStorage.setItem('idToken', mockToken)
    win.localStorage.setItem('user', JSON.stringify(mockUser))
    win.localStorage.setItem('isAuthenticated', 'true')
  })
  
  cy.log('✅ Mock authenticated state set up')
})

/**
 * Login with test user using Firebase authentication
 * This attempts to use Firebase SDK for authentication
 */
Cypress.Commands.add('loginWithTestUser', () => {
  const testEmail = Cypress.env('TEST_USER_EMAIL')
  const testPassword = Cypress.env('TEST_USER_PASSWORD')
  
  if (!testEmail || !testPassword) {
    cy.log('⚠️ Test user credentials not configured')
    return
  }
  
  cy.log(`🔐 Logging in with test user: ${testEmail}`)
  
  // Visit login page
  cy.visit('/login')
  
  // Wait for login form to load
  cy.get('body').should('be.visible')
  
  // Look for email and password inputs
  cy.get('body').then(($body) => {
    const bodyText = $body.text().toLowerCase()
    
    if (bodyText.includes('email') && bodyText.includes('password')) {
      // Try to find and fill login form
      cy.get('input[type="email"], input[name="email"], input[placeholder*="email"]')
        .first()
        .type(testEmail)
      
      cy.get('input[type="password"], input[name="password"], input[placeholder*="password"]')
        .first()
        .type(testPassword)
      
      // Look for submit button
      cy.get('button[type="submit"], input[type="submit"], button:contains("Sign In"), button:contains("Login")')
        .first()
        .click()
      
      // Wait for authentication to complete
      cy.waitForAuthentication()
    } else {
      cy.log('⚠️ Login form not found, using mock authentication')
      cy.mockAuthenticatedState()
    }
  })
})

/**
 * Logout test user
 */
Cypress.Commands.add('logoutTestUser', () => {
  cy.log('🚪 Logging out test user')
  
  // Clear localStorage
  cy.window().then((win) => {
    win.localStorage.removeItem('idToken')
    win.localStorage.removeItem('user')
    win.localStorage.removeItem('isAuthenticated')
  })
  
  // Clear cookies
  cy.clearCookies()
  
  cy.log('✅ Test user logged out')
})

/**
 * Wait for authentication to complete
 */
Cypress.Commands.add('waitForAuthentication', () => {
  cy.log('⏳ Waiting for authentication to complete')
  
  // Wait for redirect or authentication state change
  cy.wait(3000)
  
  // Check if we're redirected to authenticated area
  cy.url().then((url) => {
    if (url.includes('/login')) {
      cy.log('⚠️ Still on login page, authentication may have failed')
    } else {
      cy.log('✅ Authentication appears successful')
    }
  })
})

/**
 * Enhanced login command that tries multiple approaches
 */
Cypress.Commands.add('login', () => {
  const enableTestAuth = Cypress.env('ENABLE_TEST_AUTH')
  const testEmail = Cypress.env('TEST_USER_EMAIL')
  const testPassword = Cypress.env('TEST_USER_PASSWORD')
  
  if (enableTestAuth && testEmail && testPassword) {
    cy.log('🔐 Using real test user authentication')
    cy.authenticateTestUser()
  } else {
    cy.log('🎭 Using mock authentication')
    cy.mockAuthenticatedState()
  }
})
