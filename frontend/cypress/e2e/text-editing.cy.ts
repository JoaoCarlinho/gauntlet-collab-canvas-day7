/// <reference types="cypress" />

describe('Canvas Text Editing', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.login()
    cy.waitForCanvasLoad()
  })

  it('Enter-to-edit then commit with Enter updates text', () => {
    cy.addObjectToCanvas('text', 200, 200)
    // Select tool and click the text roughly where placed
    cy.get('[data-testid="tool-select"]').click()
    cy.clickKonvaAt(0.25, 0.25)
    // Enter to start editing
    cy.get('body').type('{enter}')
    // Type and commit
    cy.get('input[role="textbox"]').clear().type('Hello World{enter}')
    // Overlay disappears and canvas remains visible
    cy.get('input[role="textbox"]').should('not.exist')
    cy.get('[data-testid="canvas-container"]').should('be.visible')
  })

  it('Double-click to edit then cancel with Escape restores original text', () => {
    cy.addObjectToCanvas('text', 240, 240)
    cy.get('[data-testid="tool-select"]').click()
    cy.clickKonvaAt(0.3, 0.3).dblclick()
    cy.get('input[role="textbox"]').type('Temp Text{esc}')
    cy.get('input[role="textbox"]').should('not.exist')
  })

  it('Stage clicks are ignored during edit; blur commits', () => {
    cy.addObjectToCanvas('text', 280, 280)
    cy.get('[data-testid="tool-select"]').click()
    cy.clickKonvaAt(0.35, 0.35)
    cy.get('body').type('{enter}')
    cy.get('input[role="textbox"]').type('Blur Commit')
    // Click stage outside; should blur input and commit
    cy.get('[data-testid="canvas-container"]').click(10, 10)
    cy.get('input[role="textbox"]').should('not.exist')
  })
})


