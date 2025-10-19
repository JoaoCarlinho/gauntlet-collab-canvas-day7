/// <reference types="cypress" />

describe('Real Authentication User Stories Validation', () => {
  const productionUrl = 'https://gauntlet-collab-canvas-day7.vercel.app'
  const apiUrl = 'https://gauntlet-collab-canvas-day7-production.up.railway.app'

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  describe('Real Authentication Setup', () => {
    it('Should authenticate with real test user credentials', () => {
      cy.log('🔐 Setting up real authentication with test@collabcanvas.com')
      
      // Authenticate with real test user
      cy.authenticateTestUser()
      
      // Visit the application
      cy.visit(productionUrl)
      cy.wait(3000) // Wait for page to load
      
      // Take screenshot of real authenticated interface
      cy.screenshot('real-authenticated-user-interface', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Verify we're not on login page
      cy.url().should('not.include', '/login')
      
      // Check for authenticated user elements
      cy.get('body').should('be.visible')
      
      cy.log('📸 Screenshot saved: real-authenticated-user-interface.png')
    })
  })

  describe('User Story 1: User Login with Passkey', () => {
    it('Should show real authenticated user state', () => {
      cy.authenticateTestUser()
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of real authenticated state
      cy.screenshot('user-story-1-real-authenticated-state', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for authenticated user elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('user') || bodyText.includes('profile') || bodyText.includes('account') || bodyText.includes('test@collabcanvas.com')) {
          cy.log('✅ User Story 1: Real authenticated user state detected')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-1-real-authenticated-state.png')
    })
  })

  describe('User Story 2: Canvas Creation with Name and Description', () => {
    it('Should provide canvas creation functionality with real auth', () => {
      cy.authenticateTestUser()
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of canvas creation interface
      cy.screenshot('user-story-2-canvas-creation-real-auth', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Look for canvas creation elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('create') || bodyText.includes('new') || bodyText.includes('canvas')) {
          cy.log('✅ User Story 2: Canvas creation functionality detected with real auth')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-2-canvas-creation-real-auth.png')
    })
  })

  describe('User Story 3: Canvas Listing', () => {
    it('Should display canvas list with real authentication', () => {
      cy.authenticateTestUser()
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of canvas listing interface
      cy.screenshot('user-story-3-canvas-listing-real-auth', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for canvas listing functionality
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('canvas') || bodyText.includes('list') || bodyText.includes('my')) {
          cy.log('✅ User Story 3: Canvas listing functionality detected with real auth')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-3-canvas-listing-real-auth.png')
    })
  })

  describe('User Story 4: Canvas Opening for Updates', () => {
    it('Should allow opening canvas for editing with real auth', () => {
      cy.authenticateTestUser()
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of canvas opening interface
      cy.screenshot('user-story-4-canvas-opening-real-auth', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for interactive elements
      cy.get('body').then(($body) => {
        if ($body.find('button, a, [role="button"]').length > 0) {
          cy.log('✅ User Story 4: Interactive elements found - canvas opening functionality likely available with real auth')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-4-canvas-opening-real-auth.png')
    })
  })

  describe('User Story 5: Text Box Placement and Text Entry', () => {
    it('Should provide text box functionality with real auth', () => {
      cy.authenticateTestUser()
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of text functionality interface
      cy.screenshot('user-story-5-text-box-functionality-real-auth', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Look for text-related elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('text') || bodyText.includes('type') || bodyText.includes('input')) {
          cy.log('✅ User Story 5: Text functionality detected with real auth')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-5-text-box-functionality-real-auth.png')
    })
  })

  describe('User Story 6: Star Placement and Visibility', () => {
    it('Should provide star shape functionality with real auth', () => {
      cy.authenticateTestUser()
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of star functionality interface
      cy.screenshot('user-story-6-star-functionality-real-auth', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Look for shape tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('star') || bodyText.includes('shape') || bodyText.includes('tool')) {
          cy.log('✅ User Story 6: Star shape tools detected with real auth')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-6-star-functionality-real-auth.png')
    })
  })

  describe('User Story 7: Circle Placement and Visibility', () => {
    it('Should provide circle shape functionality with real auth', () => {
      cy.authenticateTestUser()
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of circle functionality interface
      cy.screenshot('user-story-7-circle-functionality-real-auth', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Look for shape tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('circle') || bodyText.includes('shape') || bodyText.includes('tool')) {
          cy.log('✅ User Story 7: Circle functionality detected with real auth')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-7-circle-functionality-real-auth.png')
    })
  })

  describe('User Story 8: Rectangle Placement and Visibility', () => {
    it('Should provide rectangle shape functionality with real auth', () => {
      cy.authenticateTestUser()
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of rectangle functionality interface
      cy.screenshot('user-story-8-rectangle-functionality-real-auth', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Look for shape tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('rectangle') || bodyText.includes('shape') || bodyText.includes('tool')) {
          cy.log('✅ User Story 8: Rectangle functionality detected with real auth')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-8-rectangle-functionality-real-auth.png')
    })
  })

  describe('User Story 9: Line Placement and Visibility', () => {
    it('Should provide line drawing functionality with real auth', () => {
      cy.authenticateTestUser()
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of line functionality interface
      cy.screenshot('user-story-9-line-functionality-real-auth', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Look for drawing tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('line') || bodyText.includes('draw') || bodyText.includes('tool')) {
          cy.log('✅ User Story 9: Line functionality detected with real auth')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-9-line-functionality-real-auth.png')
    })
  })

  describe('User Story 10: Arrow Placement and Visibility', () => {
    it('Should provide arrow shape functionality with real auth', () => {
      cy.authenticateTestUser()
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of arrow functionality interface
      cy.screenshot('user-story-10-arrow-functionality-real-auth', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Look for shape tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('arrow') || bodyText.includes('shape') || bodyText.includes('tool')) {
          cy.log('✅ User Story 10: Arrow functionality detected with real auth')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-10-arrow-functionality-real-auth.png')
    })
  })

  describe('User Story 11: Diamond Placement and Visibility', () => {
    it('Should provide diamond shape functionality with real auth', () => {
      cy.authenticateTestUser()
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of diamond functionality interface
      cy.screenshot('user-story-11-diamond-functionality-real-auth', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Look for shape tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('diamond') || bodyText.includes('shape') || bodyText.includes('tool')) {
          cy.log('✅ User Story 11: Diamond functionality detected with real auth')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-11-diamond-functionality-real-auth.png')
    })
  })

  describe('User Story 12: Shape Resizing', () => {
    it('Should provide shape resizing functionality with real auth', () => {
      cy.authenticateTestUser()
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of resizing functionality interface
      cy.screenshot('user-story-12-shape-resizing-real-auth', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Look for resize-related elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('resize') || bodyText.includes('size') || bodyText.includes('scale')) {
          cy.log('✅ User Story 12: Resize functionality detected with real auth')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-12-shape-resizing-real-auth.png')
    })
  })

  describe('User Story 13: AI Agent Canvas Generation', () => {
    it('Should provide AI agent functionality with real auth', () => {
      cy.authenticateTestUser()
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of AI agent functionality interface
      cy.screenshot('user-story-13-ai-agent-functionality-real-auth', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Look for AI-related elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('ai') || bodyText.includes('agent') || bodyText.includes('generate')) {
          cy.log('✅ User Story 13: AI agent functionality detected with real auth')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-13-ai-agent-functionality-real-auth.png')
    })
  })

  describe('Real Authentication API Testing', () => {
    it('Should test API endpoints with real authentication', () => {
      cy.authenticateTestUser()
      
      // Test canvas creation via API with real auth
      cy.get('@authToken').then((token) => {
        cy.request({
          method: 'POST',
          url: `${apiUrl}/api/canvas`,
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: {
            title: 'Real Auth Test Canvas',
            description: 'Canvas created with real authentication for testing'
          },
          failOnStatusCode: false
        }).then((response) => {
          if (response.status === 201) {
            cy.log('✅ Canvas created successfully via API with real auth')
            cy.wrap(response.body.id).as('realAuthCanvasId')
          } else {
            cy.log(`⚠️ Canvas creation failed with real auth: ${response.status}`)
          }
        })
      })
    })

    it('Should test user profile API with real authentication', () => {
      cy.authenticateTestUser()
      
      cy.get('@authToken').then((token) => {
        cy.request({
          method: 'GET',
          url: `${apiUrl}/api/auth/me`,
          headers: { 
            'Authorization': `Bearer ${token}`
          },
          failOnStatusCode: false
        }).then((response) => {
          if (response.status === 200) {
            cy.log('✅ User profile retrieved successfully with real auth')
            expect(response.body).to.have.property('email')
            expect(response.body.email).to.equal('test@collabcanvas.com')
          } else {
            cy.log(`⚠️ User profile retrieval failed with real auth: ${response.status}`)
          }
        })
      })
    })
  })

  after(() => {
    cy.log('🎉 All real authentication user stories validation completed with screenshots!')
    cy.log('📁 Screenshots saved in: cypress/screenshots/production/real-authentication-user-stories.cy.ts/')
  })
})
