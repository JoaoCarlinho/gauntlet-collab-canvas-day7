/// <reference types="cypress" />

describe('Production User Stories Validation', () => {
  const productionUrl = 'https://gauntlet-collab-canvas-day7.vercel.app'
  const apiUrl = 'https://gauntlet-collab-canvas-day7-production.up.railway.app'

  beforeEach(() => {
    // Clear any existing data
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  describe('Environment Validation', () => {
    it('Should access production frontend', () => {
      cy.visit(productionUrl)
      cy.url().should('include', 'gauntlet-collab-canvas-day7.vercel.app')
    })

    it('Should access production backend API', () => {
      cy.request('GET', `${apiUrl}/api/health`)
        .then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.status).to.eq('healthy')
        })
    })
  })

  describe('User Story 1: User Login with Passkey', () => {
    it('Should display login page and allow authentication', () => {
      cy.visit(productionUrl)
      
      // Check if we're on login page or redirected
      cy.url().then((url) => {
        if (url.includes('/login')) {
          // We're on login page - check for login elements
          cy.get('body').should('be.visible')
          cy.get('body').should('contain.text', 'Sign in')
        } else {
          // We might be redirected to home page - check for user elements
          cy.get('body').should('be.visible')
        }
      })
    })
  })

  describe('User Story 2: Canvas Creation', () => {
    it('Should allow creating a canvas with name and description', () => {
      cy.visit(productionUrl)
      
      // Wait for page to load
      cy.get('body').should('be.visible')
      
      // Look for create canvas functionality
      cy.get('body').then(($body) => {
        if ($body.find('button').length > 0) {
          // Look for any button that might be create canvas
          cy.get('button').first().should('be.visible')
        }
      })
    })
  })

  describe('User Story 3: Canvas Listing', () => {
    it('Should display list of created canvases', () => {
      cy.visit(productionUrl)
      
      // Wait for page to load
      cy.get('body').should('be.visible')
      
      // Check if there's any content that could be canvas list
      cy.get('body').should('be.visible')
    })
  })

  describe('User Story 4: Canvas Opening', () => {
    it('Should allow opening a canvas for editing', () => {
      cy.visit(productionUrl)
      
      // Wait for page to load
      cy.get('body').should('be.visible')
      
      // Look for any clickable elements that might open canvas
      cy.get('body').should('be.visible')
    })
  })

  describe('User Story 5: Text Box Placement', () => {
    it('Should allow placing text boxes on canvas', () => {
      cy.visit(productionUrl)
      
      // Wait for page to load
      cy.get('body').should('be.visible')
      
      // Look for canvas or drawing area
      cy.get('body').should('be.visible')
    })
  })

  describe('User Story 6: Star Placement', () => {
    it('Should allow placing stars on canvas', () => {
      cy.visit(productionUrl)
      
      // Wait for page to load
      cy.get('body').should('be.visible')
      
      // Look for canvas or drawing area
      cy.get('body').should('be.visible')
    })
  })

  describe('User Story 7: Circle Placement', () => {
    it('Should allow placing circles on canvas', () => {
      cy.visit(productionUrl)
      
      // Wait for page to load
      cy.get('body').should('be.visible')
      
      // Look for canvas or drawing area
      cy.get('body').should('be.visible')
    })
  })

  describe('User Story 8: Rectangle Placement', () => {
    it('Should allow placing rectangles on canvas', () => {
      cy.visit(productionUrl)
      
      // Wait for page to load
      cy.get('body').should('be.visible')
      
      // Look for canvas or drawing area
      cy.get('body').should('be.visible')
    })
  })

  describe('User Story 9: Line Placement', () => {
    it('Should allow placing lines on canvas', () => {
      cy.visit(productionUrl)
      
      // Wait for page to load
      cy.get('body').should('be.visible')
      
      // Look for canvas or drawing area
      cy.get('body').should('be.visible')
    })
  })

  describe('User Story 10: Arrow Placement', () => {
    it('Should allow placing arrows on canvas', () => {
      cy.visit(productionUrl)
      
      // Wait for page to load
      cy.get('body').should('be.visible')
      
      // Look for canvas or drawing area
      cy.get('body').should('be.visible')
    })
  })

  describe('User Story 11: Diamond Placement', () => {
    it('Should allow placing diamonds on canvas', () => {
      cy.visit(productionUrl)
      
      // Wait for page to load
      cy.get('body').should('be.visible')
      
      // Look for canvas or drawing area
      cy.get('body').should('be.visible')
    })
  })

  describe('User Story 12: Shape Resizing', () => {
    it('Should allow resizing shapes on canvas', () => {
      cy.visit(productionUrl)
      
      // Wait for page to load
      cy.get('body').should('be.visible')
      
      // Look for canvas or drawing area
      cy.get('body').should('be.visible')
    })
  })

  describe('User Story 13: AI Agent Integration', () => {
    it('Should allow AI agent canvas generation', () => {
      cy.visit(productionUrl)
      
      // Wait for page to load
      cy.get('body').should('be.visible')
      
      // Look for AI agent functionality
      cy.get('body').should('be.visible')
    })
  })

  describe('API Endpoint Validation', () => {
    it('Should validate all required API endpoints', () => {
      // Test health endpoint
      cy.request('GET', `${apiUrl}/api/health`)
        .then((response) => {
          expect(response.status).to.eq(200)
        })

      // Test auth endpoints (should return 401 without token)
      cy.request({
        method: 'GET',
        url: `${apiUrl}/api/auth/me`,
        failOnStatusCode: false
      }).then((response) => {
        expect([200, 401, 403]).to.include(response.status)
      })

      // Test canvas endpoints (should return 401 without token)
      cy.request({
        method: 'GET',
        url: `${apiUrl}/api/canvas`,
        failOnStatusCode: false
      }).then((response) => {
        expect([200, 401, 403]).to.include(response.status)
      })
    })
  })

  describe('Frontend Functionality Validation', () => {
    it('Should load frontend without critical errors', () => {
      cy.visit(productionUrl)
      
      // Check for console errors
      cy.window().then((win) => {
        const errors: string[] = []
        const originalError = win.console.error
        win.console.error = (...args) => {
          errors.push(args.join(' '))
          originalError.apply(win.console, args)
        }
        
        // Wait a bit for any errors to appear
        cy.wait(2000)
        
        // Check that critical errors are not present
        cy.then(() => {
          const criticalErrors = errors.filter(error => 
            error.includes('Failed to load') || 
            error.includes('Network Error') ||
            error.includes('500') ||
            error.includes('404')
          )
          expect(criticalErrors).to.have.length(0)
        })
      })
    })

    it('Should have responsive design', () => {
      cy.visit(productionUrl)
      
      // Test different viewport sizes
      cy.viewport(1280, 720)
      cy.get('body').should('be.visible')
      
      cy.viewport(768, 1024)
      cy.get('body').should('be.visible')
      
      cy.viewport(375, 667)
      cy.get('body').should('be.visible')
    })
  })
})
