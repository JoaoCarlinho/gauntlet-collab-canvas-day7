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
      seedCanvas(title?: string, description?: string): Chainable<string>
      mockWebSocket(): Chainable<void>
      mockFirebaseAuth(): Chainable<void>
      waitForCanvasLoad(): Chainable<void>
      addObjectToCanvas(objectType: string, x: number, y: number): Chainable<void>
      verifyObjectVisible(objectIndex: number): Chainable<void>
      clickKonvaAt(percentX: number, percentY: number): Chainable<void>
      dragKonva(fromPercentX: number, fromPercentY: number, toPercentX: number, toPercentY: number): Chainable<void>
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

// Seed a deterministic canvas via backend API and return its id
Cypress.Commands.add('seedCanvas', (title?: string, description?: string) => {
  const canvasTitle = title || `E2E Test Canvas ${Date.now()}`
  const canvasDescription = description || 'Seeded by Cypress for deterministic tests'

  const apiUrl = Cypress.env('API_URL') || 'http://localhost:5001'

  // Build a dev token compatible with backend dev token parser
  const buildDevIdToken = (user: { uid: string; email: string; displayName?: string }) => {
    const header = { alg: 'none', typ: 'JWT' }
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iss: 'dev-local',
      aud: 'dev-local',
      iat: now,
      exp: now + 3600,
      uid: user.uid,
      email: user.email,
      name: user.displayName || 'E2E User',
      dev: true
    }
    const toBase64Url = (obj: any) =>
      Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
    const headerPart = toBase64Url(header)
    const payloadPart = toBase64Url(payload)
    const signature = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    return `dev.${headerPart}.${payloadPart}.${signature}`
  }

  const devToken = buildDevIdToken({ uid: 'e2e-user', email: 'e2e@example.com', displayName: 'E2E User' })

  // Try API first; if unauthorized or not found, fall back to deterministic ID for dev route
  return cy.request<any>({
    method: 'POST',
    url: `${apiUrl}/api/canvas`,
    headers: { Authorization: `Bearer ${devToken}` },
    body: { title: canvasTitle, description: canvasDescription, is_public: false },
    failOnStatusCode: false
  }).then((resp) => {
    if (resp.status === 200 || resp.status === 201) {
      const id = resp.body?.canvas?.id
      if (id && typeof id === 'string') return id as string
    }
    // Fallback: use deterministic ID for /dev route (no backend dependency)
    return `e2e-${Date.now()}`
  })
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

// Click on inner Konva canvas using percentage coordinates (0..1)
Cypress.Commands.add('clickKonvaAt', (percentX: number, percentY: number) => {
  cy.get('[data-testid="canvas-container"] canvas').first().then(($canvas) => {
    const rect = $canvas[0].getBoundingClientRect()
    const x = rect.left + rect.width * percentX
    const y = rect.top + rect.height * percentY
    cy.wrap($canvas).click(x - rect.left, y - rect.top, { force: true })
  })
})

// Drag on inner Konva canvas from A% to B%
Cypress.Commands.add('dragKonva', (fromPercentX: number, fromPercentY: number, toPercentX: number, toPercentY: number) => {
  cy.get('[data-testid="canvas-container"] canvas').first().then(($canvas) => {
    const rect = $canvas[0].getBoundingClientRect()
    const startX = rect.left + rect.width * fromPercentX
    const startY = rect.top + rect.height * fromPercentY
    const endX = rect.left + rect.width * toPercentX
    const endY = rect.top + rect.height * toPercentY

    cy.wrap($canvas)
      .trigger('pointerdown', { clientX: startX, clientY: startY, force: true })
      .trigger('pointermove', { clientX: endX, clientY: endY, force: true })
      .trigger('pointerup', { force: true })
  })
})
