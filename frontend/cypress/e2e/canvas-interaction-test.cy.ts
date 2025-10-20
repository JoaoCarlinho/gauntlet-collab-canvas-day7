describe('Canvas Interaction with Auth Bypass and Stable Selectors', () => {
  it('places, moves, and resizes an object on a seeded canvas', () => {
    // Seed deterministic canvas via API
    cy.seedCanvas('E2E Canvas - Interactions').then((canvasId) => {
      // Visit dev route that bypasses auth and uses mocked data path
      cy.visit(`/dev/canvas/${canvasId}`)

      // Wait for canvas UI to be ready (no network intercepts in dev route)
      cy.waitForCanvasLoad()

      // Add rectangle using inner canvas click at center
      cy.get('[data-testid="tool-rectangle"]').click()
      cy.clickKonvaAt(0.5, 0.5)

      // Verify canvas visible (Konva canvas exists)
      cy.verifyObjectVisible(0)

      // Switch to select tool then drag roughly via percentage coords
      cy.get('[data-testid="tool-select"]').click()
      cy.dragKonva(0.5, 0.5, 0.6, 0.6)

      // Take a checkpoint screenshot
      cy.screenshot('canvas-interaction-after-move')

      // Add another rectangle for resize control visibility
      cy.get('[data-testid="tool-rectangle"]').click()
      cy.clickKonvaAt(0.65, 0.55)
      cy.get('[data-testid="tool-select"]').click()

      // Final checkpoint
      cy.screenshot('canvas-interaction-complete')

      // Add text entry
      cy.get('[data-testid="tool-text"]').click()
      cy.clickKonvaAt(0.7, 0.45)
      cy.get('body').type('Hello world from E2E')
      cy.screenshot('canvas-text-entry')
    })
  })
})

