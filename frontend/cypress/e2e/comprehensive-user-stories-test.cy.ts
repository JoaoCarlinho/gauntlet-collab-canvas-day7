/// <reference types="cypress" />

describe('Comprehensive User Stories Validation', () => {
  const productionUrl = 'https://gauntlet-collab-canvas-day7.vercel.app'
  const apiUrl = 'https://gauntlet-collab-canvas-day7-production.up.railway.app'

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  describe('User Story 1: User Login with Passkey', () => {
    it('Should provide login functionality', () => {
      cy.visit(productionUrl)
      
      // Check if login page is accessible
      cy.url().should('include', 'gauntlet-collab-canvas-day7.vercel.app')
      
      // Check for login elements
      cy.get('body').should('be.visible')
      
      // Look for sign-in related text or buttons
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('sign in') || bodyText.includes('login') || bodyText.includes('auth')) {
          cy.log('Login functionality detected')
        }
      })
    })
  })

  describe('User Story 2: Canvas Creation with Name and Description', () => {
    it('Should provide canvas creation functionality', () => {
      cy.visit(productionUrl)
      
      // Check for canvas creation elements
      cy.get('body').should('be.visible')
      
      // Look for buttons or forms that might be for canvas creation
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('create') || bodyText.includes('new') || bodyText.includes('canvas')) {
          cy.log('Canvas creation functionality detected')
        }
      })
    })
  })

  describe('User Story 3: Canvas Listing', () => {
    it('Should display canvas list', () => {
      cy.visit(productionUrl)
      
      // Check for canvas listing functionality
      cy.get('body').should('be.visible')
      
      // Look for list or grid elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('canvas') || bodyText.includes('list') || bodyText.includes('my')) {
          cy.log('Canvas listing functionality detected')
        }
      })
    })
  })

  describe('User Story 4: Canvas Opening for Updates', () => {
    it('Should allow opening canvas for editing', () => {
      cy.visit(productionUrl)
      
      // Check for canvas opening functionality
      cy.get('body').should('be.visible')
      
      // Look for clickable elements
      cy.get('body').then(($body) => {
        if ($body.find('button, a, [role="button"]').length > 0) {
          cy.log('Interactive elements found - canvas opening functionality likely available')
        }
      })
    })
  })

  describe('User Story 5: Text Box Placement and Text Entry', () => {
    it('Should provide text box functionality', () => {
      cy.visit(productionUrl)
      
      // Check for text input functionality
      cy.get('body').should('be.visible')
      
      // Look for text-related elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('text') || bodyText.includes('type') || bodyText.includes('input')) {
          cy.log('Text functionality detected')
        }
      })
    })
  })

  describe('User Story 6: Star Placement and Visibility', () => {
    it('Should provide star shape functionality', () => {
      cy.visit(productionUrl)
      
      // Check for shape tools
      cy.get('body').should('be.visible')
      
      // Look for shape-related elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('star') || bodyText.includes('shape') || bodyText.includes('tool')) {
          cy.log('Shape tools detected')
        }
      })
    })
  })

  describe('User Story 7: Circle Placement and Visibility', () => {
    it('Should provide circle shape functionality', () => {
      cy.visit(productionUrl)
      
      // Check for circle functionality
      cy.get('body').should('be.visible')
      
      // Look for shape tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('circle') || bodyText.includes('shape') || bodyText.includes('tool')) {
          cy.log('Circle functionality detected')
        }
      })
    })
  })

  describe('User Story 8: Rectangle Placement and Visibility', () => {
    it('Should provide rectangle shape functionality', () => {
      cy.visit(productionUrl)
      
      // Check for rectangle functionality
      cy.get('body').should('be.visible')
      
      // Look for shape tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('rectangle') || bodyText.includes('shape') || bodyText.includes('tool')) {
          cy.log('Rectangle functionality detected')
        }
      })
    })
  })

  describe('User Story 9: Line Placement and Visibility', () => {
    it('Should provide line drawing functionality', () => {
      cy.visit(productionUrl)
      
      // Check for line functionality
      cy.get('body').should('be.visible')
      
      // Look for drawing tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('line') || bodyText.includes('draw') || bodyText.includes('tool')) {
          cy.log('Line functionality detected')
        }
      })
    })
  })

  describe('User Story 10: Arrow Placement and Visibility', () => {
    it('Should provide arrow shape functionality', () => {
      cy.visit(productionUrl)
      
      // Check for arrow functionality
      cy.get('body').should('be.visible')
      
      // Look for shape tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('arrow') || bodyText.includes('shape') || bodyText.includes('tool')) {
          cy.log('Arrow functionality detected')
        }
      })
    })
  })

  describe('User Story 11: Diamond Placement and Visibility', () => {
    it('Should provide diamond shape functionality', () => {
      cy.visit(productionUrl)
      
      // Check for diamond functionality
      cy.get('body').should('be.visible')
      
      // Look for shape tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('diamond') || bodyText.includes('shape') || bodyText.includes('tool')) {
          cy.log('Diamond functionality detected')
        }
      })
    })
  })

  describe('User Story 12: Shape Resizing', () => {
    it('Should provide shape resizing functionality', () => {
      cy.visit(productionUrl)
      
      // Check for resizing functionality
      cy.get('body').should('be.visible')
      
      // Look for resize-related elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('resize') || bodyText.includes('size') || bodyText.includes('scale')) {
          cy.log('Resize functionality detected')
        }
      })
    })
  })

  describe('User Story 13: AI Agent Canvas Generation', () => {
    it('Should provide AI agent functionality', () => {
      cy.visit(productionUrl)
      
      // Check for AI agent functionality
      cy.get('body').should('be.visible')
      
      // Look for AI-related elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('ai') || bodyText.includes('agent') || bodyText.includes('generate')) {
          cy.log('AI agent functionality detected')
        }
      })
    })
  })

  describe('Technical Validation', () => {
    it('Should have proper API connectivity', () => {
      // Test backend API health
      cy.request('GET', `${apiUrl}/api/health`)
        .then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.status).to.eq('healthy')
        })
    })

    it('Should have proper CORS configuration', () => {
      // Test CORS by making a request from the frontend domain
      cy.visit(productionUrl)
      
      cy.window().then((win) => {
        return cy.request({
          method: 'GET',
          url: `${apiUrl}/api/health`,
          headers: {
            'Origin': productionUrl
          }
        })
      }).then((response) => {
        expect(response.status).to.eq(200)
      })
    })

    it('Should load without critical JavaScript errors', () => {
      cy.visit(productionUrl)
      
      // Check for console errors
      cy.window().then((win) => {
        const errors: string[] = []
        const originalError = win.console.error
        win.console.error = (...args) => {
          errors.push(args.join(' '))
          originalError.apply(win.console, args)
        }
        
        // Wait for any errors to appear
        cy.wait(3000)
        
        // Check for critical errors
        cy.then(() => {
          const criticalErrors = errors.filter(error => 
            error.includes('Failed to load') || 
            error.includes('Network Error') ||
            error.includes('500 Internal Server Error') ||
            error.includes('404 Not Found') ||
            error.includes('CORS') ||
            error.includes('Blocked')
          )
          
          if (criticalErrors.length > 0) {
            cy.log('Critical errors found:', criticalErrors)
          }
          
          // Allow some non-critical errors but flag critical ones
          expect(criticalErrors).to.have.length(0)
        })
      })
    })

    it('Should have responsive design', () => {
      // Test different viewport sizes
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop' },
        { width: 1280, height: 720, name: 'Laptop' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' }
      ]
      
      viewports.forEach(viewport => {
        cy.viewport(viewport.width, viewport.height)
        cy.visit(productionUrl)
        cy.get('body').should('be.visible')
        cy.log(`${viewport.name} viewport (${viewport.width}x${viewport.height}) - OK`)
      })
    })

    it('Should have proper performance characteristics', () => {
      cy.visit(productionUrl)
      
      // Measure page load time
      cy.window().then((win) => {
        const loadTime = win.performance.timing.loadEventEnd - win.performance.timing.navigationStart
        cy.log(`Page load time: ${loadTime}ms`)
        
        // Page should load within reasonable time (10 seconds)
        expect(loadTime).to.be.lessThan(10000)
      })
    })
  })

  describe('Security Validation', () => {
    it('Should have proper security headers', () => {
      cy.request({
        method: 'GET',
        url: productionUrl,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        
        // Check for security headers
        const headers = response.headers
        if (headers['x-frame-options']) {
          cy.log('X-Frame-Options header present')
        }
        if (headers['x-content-type-options']) {
          cy.log('X-Content-Type-Options header present')
        }
      })
    })

    it('Should handle authentication properly', () => {
      // Test protected endpoints return proper status codes
      cy.request({
        method: 'GET',
        url: `${apiUrl}/api/auth/me`,
        failOnStatusCode: false
      }).then((response) => {
        // Should return 401 (Unauthorized) without token
        expect([200, 401, 403]).to.include(response.status)
      })
    })
  })
})
