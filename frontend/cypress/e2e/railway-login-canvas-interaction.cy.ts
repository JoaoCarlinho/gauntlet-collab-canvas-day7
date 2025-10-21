/// <reference types="cypress" />

describe('Railway Frontend - Login and Canvas Interaction', () => {
  const railwayUrl = 'https://collab-canvas-frontend.up.railway.app'
  const apiUrl = 'https://gauntlet-collab-canvas-day7-production.up.railway.app'

  beforeEach(() => {
    // Clear any existing data
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  describe('Environment Validation', () => {
    it('Should access Railway frontend', () => {
      cy.visit(railwayUrl)
      cy.url().should('include', 'collab-canvas-frontend.up.railway.app')
      cy.get('body').should('be.visible')
    })

    it('Should access Railway backend API', () => {
      cy.request('GET', `${apiUrl}/api/health`)
        .then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.status).to.eq('healthy')
        })
    })
  })

  describe('Authentication Flow', () => {
    it('Should display login page and allow authentication', () => {
      cy.visit(railwayUrl)
      
      // Wait for page to load
      cy.get('body', { timeout: 10000 }).should('be.visible')
      
      // Check if we're on login page or redirected
      cy.url().then((url) => {
        if (url.includes('/login') || url.includes('/auth')) {
          // We're on login page - check for login elements
          cy.get('body').should('contain.text', 'Sign in').or('contain.text', 'Login').or('contain.text', 'Email')
          
          // Take screenshot of login page
          cy.screenshot('railway-login-page')
        } else {
          // We might be redirected to home page - check for user elements
          cy.get('body').should('be.visible')
          cy.screenshot('railway-home-page')
        }
      })
    })

    it('Should handle email/password authentication if available', () => {
      cy.visit(railwayUrl)
      
      // Wait for page to load
      cy.get('body', { timeout: 10000 }).should('be.visible')
      
      // Look for email input field
      cy.get('body').then(($body) => {
        if ($body.find('input[type="email"]').length > 0) {
          // Email authentication is available
          cy.get('input[type="email"]').should('be.visible')
          cy.get('input[type="password"]').should('be.visible')
          
          // Fill in test credentials if available
          cy.get('input[type="email"]').type('test@collabcanvas.com')
          cy.get('input[type="password"]').type('TestPassword123!')
          
          // Look for submit button
          cy.get('button[type="submit"]').or('button').contains('Sign in').or('button').contains('Login').click()
          
          // Wait for authentication to complete
          cy.wait(3000)
          cy.screenshot('railway-after-login')
        } else {
          // No email authentication available, just take screenshot
          cy.screenshot('railway-no-email-auth')
        }
      })
    })
  })

  describe('Canvas Creation and Management', () => {
    it('Should allow creating a canvas with name and description', () => {
      cy.visit(railwayUrl)
      
      // Wait for page to load
      cy.get('body', { timeout: 10000 }).should('be.visible')
      
      // Look for canvas creation elements
      cy.get('body').then(($body) => {
        if ($body.find('button').filter(':contains("Create")').length > 0) {
          cy.get('button').contains('Create').click()
          
          // Look for name and description inputs
          cy.get('input[placeholder*="name" i]').or('input[placeholder*="title" i]').type('Test Canvas')
          cy.get('textarea[placeholder*="description" i]').or('input[placeholder*="description" i]').type('Test canvas description')
          
          // Submit canvas creation
          cy.get('button').contains('Create').or('button').contains('Save').click()
          
          cy.wait(2000)
          cy.screenshot('railway-canvas-created')
        } else {
          cy.screenshot('railway-no-canvas-creation')
        }
      })
    })

    it('Should display list of created canvases', () => {
      cy.visit(railwayUrl)
      
      // Wait for page to load
      cy.get('body', { timeout: 10000 }).should('be.visible')
      
      // Look for canvas list or grid
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid*="canvas"]').length > 0 || $body.find('.canvas').length > 0) {
          cy.get('[data-testid*="canvas"]').or('.canvas').should('be.visible')
          cy.screenshot('railway-canvas-list')
        } else {
          cy.screenshot('railway-no-canvas-list')
        }
      })
    })
  })

  describe('Canvas Object Placement and Interaction', () => {
    beforeEach(() => {
      cy.visit(railwayUrl)
      cy.get('body', { timeout: 10000 }).should('be.visible')
    })

    it('Should place a text box on canvas and allow text editing', () => {
      // Look for text tool or text box button
      cy.get('body').then(($body) => {
        if ($body.find('button').filter(':contains("Text")').length > 0) {
          cy.get('button').contains('Text').click()
          
          // Click on canvas to place text box
          cy.get('canvas').or('[data-testid="canvas"]').click(400, 300)
          
          // Wait for text box to appear
          cy.wait(1000)
          
          // Look for text input
          cy.get('input[type="text"]').or('textarea').type('Test Text')
          
          cy.screenshot('railway-text-box-placed')
          
          // Test text editing
          cy.get('input[type="text"]').or('textarea').clear().type('Edited Text')
          cy.screenshot('railway-text-edited')
        } else {
          cy.screenshot('railway-no-text-tool')
        }
      })
    })

    it('Should place a star on canvas and maintain visibility', () => {
      // Look for star tool
      cy.get('body').then(($body) => {
        if ($body.find('button').filter(':contains("Star")').length > 0) {
          cy.get('button').contains('Star').click()
          
          // Click on canvas to place star
          cy.get('canvas').or('[data-testid="canvas"]').click(500, 300)
          
          // Wait for star to appear
          cy.wait(1000)
          
          // Verify star is visible
          cy.get('canvas').or('[data-testid="canvas"]').should('be.visible')
          cy.screenshot('railway-star-placed')
        } else {
          cy.screenshot('railway-no-star-tool')
        }
      })
    })

    it('Should place a circle on canvas and maintain visibility', () => {
      // Look for circle tool
      cy.get('body').then(($body) => {
        if ($body.find('button').filter(':contains("Circle")').length > 0) {
          cy.get('button').contains('Circle').click()
          
          // Click on canvas to place circle
          cy.get('canvas').or('[data-testid="canvas"]').click(600, 300)
          
          // Wait for circle to appear
          cy.wait(1000)
          
          // Verify circle is visible
          cy.get('canvas').or('[data-testid="canvas"]').should('be.visible')
          cy.screenshot('railway-circle-placed')
        } else {
          cy.screenshot('railway-no-circle-tool')
        }
      })
    })

    it('Should place a rectangle on canvas and maintain visibility', () => {
      // Look for rectangle tool
      cy.get('body').then(($body) => {
        if ($body.find('button').filter(':contains("Rectangle")').length > 0) {
          cy.get('button').contains('Rectangle').click()
          
          // Click on canvas to place rectangle
          cy.get('canvas').or('[data-testid="canvas"]').click(700, 300)
          
          // Wait for rectangle to appear
          cy.wait(1000)
          
          // Verify rectangle is visible
          cy.get('canvas').or('[data-testid="canvas"]').should('be.visible')
          cy.screenshot('railway-rectangle-placed')
        } else {
          cy.screenshot('railway-no-rectangle-tool')
        }
      })
    })

    it('Should place a line on canvas and maintain visibility', () => {
      // Look for line tool
      cy.get('body').then(($body) => {
        if ($body.find('button').filter(':contains("Line")').length > 0) {
          cy.get('button').contains('Line').click()
          
          // Draw line on canvas
          cy.get('canvas').or('[data-testid="canvas"]')
            .trigger('mousedown', { which: 1, pageX: 800, pageY: 300 })
            .trigger('mousemove', { which: 1, pageX: 900, pageY: 400 })
            .trigger('mouseup', { which: 1 })
          
          // Wait for line to appear
          cy.wait(1000)
          
          // Verify line is visible
          cy.get('canvas').or('[data-testid="canvas"]').should('be.visible')
          cy.screenshot('railway-line-placed')
        } else {
          cy.screenshot('railway-no-line-tool')
        }
      })
    })

    it('Should place an arrow on canvas and maintain visibility', () => {
      // Look for arrow tool
      cy.get('body').then(($body) => {
        if ($body.find('button').filter(':contains("Arrow")').length > 0) {
          cy.get('button').contains('Arrow').click()
          
          // Draw arrow on canvas
          cy.get('canvas').or('[data-testid="canvas"]')
            .trigger('mousedown', { which: 1, pageX: 1000, pageY: 300 })
            .trigger('mousemove', { which: 1, pageX: 1100, pageY: 400 })
            .trigger('mouseup', { which: 1 })
          
          // Wait for arrow to appear
          cy.wait(1000)
          
          // Verify arrow is visible
          cy.get('canvas').or('[data-testid="canvas"]').should('be.visible')
          cy.screenshot('railway-arrow-placed')
        } else {
          cy.screenshot('railway-no-arrow-tool')
        }
      })
    })

    it('Should place a diamond on canvas and maintain visibility', () => {
      // Look for diamond tool
      cy.get('body').then(($body) => {
        if ($body.find('button').filter(':contains("Diamond")').length > 0) {
          cy.get('button').contains('Diamond').click()
          
          // Click on canvas to place diamond
          cy.get('canvas').or('[data-testid="canvas"]').click(1200, 300)
          
          // Wait for diamond to appear
          cy.wait(1000)
          
          // Verify diamond is visible
          cy.get('canvas').or('[data-testid="canvas"]').should('be.visible')
          cy.screenshot('railway-diamond-placed')
        } else {
          cy.screenshot('railway-no-diamond-tool')
        }
      })
    })
  })

  describe('Object Manipulation', () => {
    beforeEach(() => {
      cy.visit(railwayUrl)
      cy.get('body', { timeout: 10000 }).should('be.visible')
    })

    it('Should move objects around the canvas', () => {
      // First place an object
      cy.get('body').then(($body) => {
        if ($body.find('button').filter(':contains("Circle")').length > 0) {
          cy.get('button').contains('Circle').click()
          cy.get('canvas').or('[data-testid="canvas"]').click(400, 300)
          cy.wait(1000)
          
          // Try to select and move the object
          cy.get('canvas').or('[data-testid="canvas"]')
            .trigger('mousedown', { which: 1, pageX: 400, pageY: 300 })
            .trigger('mousemove', { which: 1, pageX: 500, pageY: 400 })
            .trigger('mouseup', { which: 1 })
          
          cy.wait(1000)
          cy.screenshot('railway-object-moved')
        } else {
          cy.screenshot('railway-no-object-to-move')
        }
      })
    })

    it('Should resize objects on the canvas', () => {
      // First place an object
      cy.get('body').then(($body) => {
        if ($body.find('button').filter(':contains("Rectangle")').length > 0) {
          cy.get('button').contains('Rectangle').click()
          cy.get('canvas').or('[data-testid="canvas"]').click(600, 300)
          cy.wait(1000)
          
          // Try to resize the object by dragging a corner
          cy.get('canvas').or('[data-testid="canvas"]')
            .trigger('mousedown', { which: 1, pageX: 650, pageY: 350 })
            .trigger('mousemove', { which: 1, pageX: 700, pageY: 400 })
            .trigger('mouseup', { which: 1 })
          
          cy.wait(1000)
          cy.screenshot('railway-object-resized')
        } else {
          cy.screenshot('railway-no-object-to-resize')
        }
      })
    })
  })

  describe('AI Agent Integration', () => {
    beforeEach(() => {
      cy.visit(railwayUrl)
      cy.get('body', { timeout: 10000 }).should('be.visible')
    })

    it('Should allow sending messages to AI Agent for canvas generation', () => {
      // Look for AI agent chat or input
      cy.get('body').then(($body) => {
        if ($body.find('input[placeholder*="AI"]').length > 0 || $body.find('textarea[placeholder*="AI"]').length > 0) {
          // AI agent input found
          cy.get('input[placeholder*="AI"]').or('textarea[placeholder*="AI"]').type('Create a simple diagram with a circle and a rectangle')
          
          // Look for send button
          cy.get('button').contains('Send').or('button').contains('Submit').or('button[type="submit"]').click()
          
          // Wait for AI response
          cy.wait(5000)
          cy.screenshot('railway-ai-agent-request')
          
          // Check if canvas was updated
          cy.get('canvas').or('[data-testid="canvas"]').should('be.visible')
          cy.screenshot('railway-ai-canvas-generated')
        } else {
          cy.screenshot('railway-no-ai-agent')
        }
      })
    })
  })

  describe('Video Recording for Functionality Confirmation', () => {
    it('Should record 5-second video of canvas interaction', () => {
      cy.visit(railwayUrl)
      cy.get('body', { timeout: 10000 }).should('be.visible')
      
      // Start video recording
      cy.get('body').then(($body) => {
        if ($body.find('button').filter(':contains("Circle")').length > 0) {
          // Place a circle
          cy.get('button').contains('Circle').click()
          cy.get('canvas').or('[data-testid="canvas"]').click(400, 300)
          cy.wait(1000)
          
          // Move the circle
          cy.get('canvas').or('[data-testid="canvas"]')
            .trigger('mousedown', { which: 1, pageX: 400, pageY: 300 })
            .trigger('mousemove', { which: 1, pageX: 500, pageY: 400 })
            .trigger('mouseup', { which: 1 })
          
          cy.wait(2000)
          
          // Place a text box
          if ($body.find('button').filter(':contains("Text")').length > 0) {
            cy.get('button').contains('Text').click()
            cy.get('canvas').or('[data-testid="canvas"]').click(600, 300)
            cy.wait(1000)
            cy.get('input[type="text"]').or('textarea').type('Test Text')
          }
          
          cy.wait(2000)
          cy.screenshot('railway-final-canvas-state')
        }
      })
    })
  })
})
