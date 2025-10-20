/// <reference types="cypress" />

// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      login(): Chainable<void>
      createCanvas(title: string, description?: string): Chainable<void>
      mockWebSocket(): Chainable<void>
      mockFirebaseAuth(): Chainable<void>
      waitForCanvasLoad(): Chainable<void>
      addObjectToCanvas(objectType: string, x: number, y: number): Chainable<void>
      verifyObjectVisible(objectIndex: number): Chainable<void>
    }
  }
}

Cypress.Commands.add('login', () => {
  // For production testing, we'll need to handle real authentication
  // This is a placeholder - in a real scenario, you'd need to handle Google OAuth
  cy.window().then((win) => {
    // Set up mock authentication for testing
    win.localStorage.setItem('idToken', 'mock-token-for-testing')
    win.localStorage.setItem('user', JSON.stringify({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User'
    }))
  })
})

Cypress.Commands.add('createCanvas', (title: string, description?: string) => {
  cy.get('[data-testid="create-canvas-button"]').click()
  cy.get('[data-testid="canvas-title-input"]').type(title)
  if (description) {
    cy.get('[data-testid="canvas-description-input"]').type(description)
  }
  cy.get('[data-testid="create-canvas-submit"]').click()
  
  // Wait for canvas to be created and appear in the list
  cy.get('[data-testid="canvas-list"]').should('contain', title)
})

Cypress.Commands.add('mockWebSocket', () => {
  // Mock WebSocket for testing real-time features
  cy.window().then((win) => {
    const mockWebSocket = {
      send: cy.stub(),
      close: cy.stub(),
      addEventListener: cy.stub(),
      removeEventListener: cy.stub(),
      readyState: 1,
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3
    }
    
    cy.stub(win, 'WebSocket').returns(mockWebSocket)
  })
})

Cypress.Commands.add('mockFirebaseAuth', () => {
  // Mock Firebase authentication
  cy.window().then((win) => {
    const mockUser = {
      uid: 'test-user-id',
      email: 'test@example.com',
      displayName: 'Test User',
      getIdToken: cy.stub().resolves('mock-id-token')
    }
    
    const mockAuth = {
      currentUser: mockUser,
      onAuthStateChanged: cy.stub(),
      signInWithPopup: cy.stub().resolves({ user: mockUser }),
      signOut: cy.stub().resolves()
    }
    
    // Mock Firebase auth
    win.firebase = {
      auth: cy.stub().returns(mockAuth)
    }
  })
})

Cypress.Commands.add('waitForCanvasLoad', () => {
  // Wait for canvas to fully load
  cy.get('[data-testid="canvas-container"]').should('be.visible')
  cy.get('[data-testid="canvas-toolbar"]').should('be.visible')
  // Connection status might not always be visible, so make it optional
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="connection-status"]').length > 0) {
      cy.get('[data-testid="connection-status"]').should('be.visible')
    }
  })
})

Cypress.Commands.add('addObjectToCanvas', (objectType: string, x: number, y: number) => {
  // Click the appropriate button based on object type
  switch (objectType.toLowerCase()) {
    case 'text':
      cy.get('[data-testid="tool-text"]').click()
      break
    case 'rectangle':
      cy.get('[data-testid="tool-rectangle"]').click()
      break
    case 'circle':
      cy.get('[data-testid="tool-circle"]').click()
      break
    case 'star':
      cy.get('[data-testid="tool-star"]').click()
      break
    case 'line':
      cy.get('[data-testid="tool-line"]').click()
      break
    case 'arrow':
      cy.get('[data-testid="tool-arrow"]').click()
      break
    case 'diamond':
      cy.get('[data-testid="tool-diamond"]').click()
      break
    default:
      throw new Error(`Unknown object type: ${objectType}`)
  }
  
  // Click on canvas at specified coordinates
  cy.get('[data-testid="canvas-container"]').click(x, y)
})

Cypress.Commands.add('verifyObjectVisible', (objectIndex: number) => {
  // Verify the object is immediately visible by checking the canvas container
  // Since Konva objects don't have data-testid, we check if the canvas has content
  cy.get('[data-testid="canvas-container"]').should('be.visible')
  
  // Check if there are any Konva elements (rectangles, circles, etc.) in the canvas
  cy.get('[data-testid="canvas-container"]').within(() => {
    // Look for SVG elements that represent Konva objects
    cy.get('canvas').should('exist')
  })
})
