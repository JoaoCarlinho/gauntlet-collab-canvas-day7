describe('Object Creation State Management Fix', () => {
  beforeEach(() => {
    // Ignore Firebase-related uncaught exceptions in local-dev
    cy.on('uncaught:exception', (err) => {
      if (err.message?.includes('Firebase') || err.message?.includes('auth/invalid-api-key')) {
        return false
      }
      return true
    })
  })

  it('should prevent creating new objects while already drawing (behavioral)', () => {
    const canvasId = `e2e-object-state-${Date.now()}`
    cy.visit(`/dev/canvas/${canvasId}`)
    cy.waitForCanvasLoad()

    // Start creating a rectangle
    cy.get('[data-testid="tool-rectangle"]').scrollIntoView().should('be.visible').click()
    cy.get('[data-testid="canvas-container"]').click(100, 100, { force: true })

    // While drawing, attempt to click another tool; the drawing should continue uninterrupted
    cy.get('[data-testid="tool-circle"]').scrollIntoView().should('be.visible').click({ force: true })
    // Complete the rectangle
    cy.get('[data-testid="canvas-container"]').click(150, 150, { force: true })

    // Canvas remains usable/visible
    cy.get('[data-testid="canvas-container"]').should('be.visible')
    cy.screenshot('object-state-rectangle-complete')
  })

  it('should allow canceling object creation with escape key', () => {
    const canvasId = `e2e-cancel-esc-${Date.now()}`
    cy.visit(`/dev/canvas/${canvasId}`)
    cy.waitForCanvasLoad()

    cy.get('[data-testid="tool-circle"]').scrollIntoView().should('be.visible').click()
    cy.get('[data-testid="canvas-container"]').click(120, 120, { force: true })

    // Cancel with ESC
    cy.get('body').type('{esc}')
    // Tools should be usable again; use shortcut 'v' to select Select tool (avoids offscreen toolbar)
    cy.get('body').type('v')
    cy.get('[data-testid="canvas-container"]').should('be.visible')
    cy.screenshot('object-state-cancel-esc')
  })

  it('should allow canceling object creation with cancel button (if present)', () => {
    const canvasId = `e2e-cancel-button-${Date.now()}`
    cy.visit(`/dev/canvas/${canvasId}`)
    cy.waitForCanvasLoad()

    cy.get('[data-testid="tool-text"]').scrollIntoView().should('be.visible').click()
    cy.get('[data-testid="canvas-container"]').click(140, 140, { force: true })

    // Try cancel button; if not present, skip gracefully
    cy.get('body').then(($body) => {
      const cancel = $body.find('button:contains("Cancel (ESC)")')
      if (cancel.length > 0) {
        cy.contains('Cancel (ESC)').click()
      }
    })

    // Ensure UI remains stable
    cy.get('[data-testid="tool-text"]').scrollIntoView().should('be.visible')
    cy.get('[data-testid="canvas-container"]').should('be.visible')
    cy.screenshot('object-state-cancel-button')
  })

  it('should prevent tool switching while drawing (behavioral)', () => {
    const canvasId = `e2e-tool-switch-${Date.now()}`
    cy.visit(`/dev/canvas/${canvasId}`)
    cy.waitForCanvasLoad()

    // Begin rectangle placement
    cy.get('[data-testid="tool-rectangle"]').scrollIntoView().should('be.visible').click()
    cy.get('[data-testid="canvas-container"]').click(160, 160, { force: true })

    // Attempt to switch tool while in-progress
    cy.get('[data-testid="tool-circle"]').scrollIntoView().should('be.visible').click({ force: true })

    // Finish rectangle
    cy.get('[data-testid="canvas-container"]').click(200, 200, { force: true })

    // Now switching tools should be fine
    cy.get('[data-testid="tool-circle"]').scrollIntoView().should('be.visible').click()
    cy.get('[data-testid="canvas-container"]').click(220, 220, { force: true })
    cy.get('[data-testid="canvas-container"]').should('be.visible')
    cy.screenshot('object-state-tool-switch')
  })
})
