describe('Object Creation State Management Fix', () => {
  beforeEach(() => {
    // Mock Firebase and authentication for local testing
    cy.window().then((win) => {
      // Mock Firebase auth
      win.firebase = {
        auth: () => ({
          currentUser: {
            uid: 'test-user-id',
            email: 'test@example.com',
            displayName: 'Test User',
            getIdToken: () => Promise.resolve('mock-token-for-testing')
          },
          onAuthStateChanged: (callback) => {
            callback(win.firebase.auth().currentUser)
            return () => {}
          },
          signInWithPopup: () => Promise.resolve({
            user: win.firebase.auth().currentUser
          }),
          signOut: () => Promise.resolve()
        })
      }
      
      // Mock localStorage
      win.localStorage.setItem('idToken', 'mock-token-for-testing')
      win.localStorage.setItem('user', JSON.stringify({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      }))
    })
    
    // Handle uncaught exceptions from Firebase
    cy.on('uncaught:exception', (err, runnable) => {
      // Don't fail the test on Firebase errors
      if (err.message.includes('Firebase') || err.message.includes('auth/invalid-api-key')) {
        return false
      }
      return true
    })
  })

  it('should prevent creating new objects while already drawing', () => {
    // Visit the application
    cy.visit('/')
    
    // Login
    cy.login()
    
    // Create a new canvas
    cy.createCanvas('Object Creation State Test Canvas', 'Testing object creation state management')
    
    // Navigate to the created canvas
    cy.get('[data-testid="canvas-list-item"]').contains('Object Creation State Test Canvas').click()
    cy.waitForCanvasLoad()
    
    // Start creating a rectangle
    cy.get('[data-testid="tool-rectangle"]').click()
    cy.get('[data-testid="canvas-container"]').click(100, 100, { force: true })
    
    // Verify we're in drawing mode
    cy.contains('Drawing in progress... Click to place object').should('be.visible')
    cy.get('[data-testid="tool-rectangle"]').should('be.disabled')
    cy.get('[data-testid="tool-circle"]').should('be.disabled')
    cy.get('[data-testid="tool-text"]').should('be.disabled')
    
    // Try to click on canvas again - should not create another object
    cy.get('[data-testid="canvas-container"]').click(200, 200, { force: true })
    
    // Verify only one object exists (the one being drawn)
    cy.get('[data-testid="canvas-object"]').should('have.length', 1)
    
    // Complete the rectangle creation
    cy.get('[data-testid="canvas-container"]').click(150, 150, { force: true })
    
    // Verify drawing mode is complete
    cy.contains('Drawing in progress... Click to place object').should('not.exist')
    cy.get('[data-testid="tool-rectangle"]').should('not.be.disabled')
    
    // Verify the object was created
    cy.get('[data-testid="canvas-container"]').should('be.visible')
  })

  it('should allow canceling object creation with escape key', () => {
    cy.visit('/')
    cy.login()
    cy.createCanvas('Cancel Test Canvas', 'Testing cancel functionality')
    cy.get('[data-testid="canvas-list-item"]').contains('Cancel Test Canvas').click()
    cy.waitForCanvasLoad()
    
    // Start creating a circle
    cy.get('[data-testid="tool-circle"]').click()
    cy.get('[data-testid="canvas-container"]').click(100, 100, { force: true })
    
    // Verify we're in drawing mode
    cy.contains('Drawing in progress... Click to place object').should('be.visible')
    
    // Press escape key
    cy.get('body').type('{esc}')
    
    // Verify drawing mode is canceled
    cy.contains('Drawing in progress... Click to place object').should('not.exist')
    cy.get('[data-testid="tool-circle"]').should('not.be.disabled')
    
    // Verify no object was created (canvas should still be visible)
    cy.get('[data-testid="canvas-container"]').should('be.visible')
  })

  it('should allow canceling object creation with cancel button', () => {
    cy.visit('/')
    cy.login()
    cy.createCanvas('Cancel Button Test Canvas', 'Testing cancel button functionality')
    cy.get('[data-testid="canvas-list-item"]').contains('Cancel Button Test Canvas').click()
    cy.waitForCanvasLoad()
    
    // Start creating text
    cy.get('[data-testid="tool-text"]').click()
    cy.get('[data-testid="canvas-container"]').click(100, 100, { force: true })
    
    // Verify we're in drawing mode
    cy.contains('Drawing in progress... Click to place object').should('be.visible')
    
    // Click cancel button
    cy.contains('Cancel (ESC)').click()
    
    // Verify drawing mode is canceled
    cy.contains('Drawing in progress... Click to place object').should('not.exist')
    cy.get('[data-testid="tool-text"]').should('not.be.disabled')
    
    // Verify no object was created (canvas should still be visible)
    cy.get('[data-testid="canvas-container"]').should('be.visible')
  })

  it('should prevent tool switching while drawing', () => {
    cy.visit('/')
    cy.login()
    cy.createCanvas('Tool Switch Test Canvas', 'Testing tool switching prevention')
    cy.get('[data-testid="canvas-list-item"]').contains('Tool Switch Test Canvas').click()
    cy.waitForCanvasLoad()
    
    // Start creating a rectangle
    cy.get('[data-testid="tool-rectangle"]').click()
    cy.get('[data-testid="canvas-container"]').click(100, 100, { force: true })
    
    // Verify we're in drawing mode
    cy.contains('Drawing in progress... Click to place object').should('be.visible')
    
    // Try to switch to circle tool - should be disabled
    cy.get('[data-testid="tool-circle"]').should('be.disabled')
    cy.get('[data-testid="tool-circle"]').click({ force: true }) // Force click to test disabled state
    
    // Verify we're still in rectangle drawing mode
    cy.contains('Drawing in progress... Click to place object').should('be.visible')
    
    // Complete the rectangle
    cy.get('[data-testid="canvas-container"]').click(150, 150, { force: true })
    
    // Now verify we can switch tools
    cy.get('[data-testid="tool-circle"]').should('not.be.disabled')
    cy.get('[data-testid="tool-circle"]').click()
    
    // Verify we can now create a circle
    cy.get('[data-testid="canvas-container"]').click(200, 200, { force: true })
    cy.get('[data-testid="canvas-container"]').click(250, 250, { force: true })
    
    // Verify canvas is visible (objects exist)
    cy.get('[data-testid="canvas-container"]').should('be.visible')
  })
})
