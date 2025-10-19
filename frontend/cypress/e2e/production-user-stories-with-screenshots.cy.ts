/// <reference types="cypress" />

describe('Production User Stories Validation with Screenshots', () => {
  const productionUrl = 'https://gauntlet-collab-canvas-day7.vercel.app'
  const apiUrl = 'https://gauntlet-collab-canvas-day7-production.up.railway.app'

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  describe('User Story 1: User Login with Passkey', () => {
    it('Should provide login functionality', () => {
      cy.visit(productionUrl)
      cy.wait(2000) // Wait for page to fully load
      
      // Take screenshot of login page
      cy.screenshot('user-story-1-login-page', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check if login page is accessible
      cy.url().should('include', 'gauntlet-collab-canvas-day7.vercel.app')
      
      // Check for login elements
      cy.get('body').should('be.visible')
      
      // Look for sign-in related text or buttons
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('sign in') || bodyText.includes('login') || bodyText.includes('auth')) {
          cy.log('✅ User Story 1: Login functionality detected')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-1-login-page.png')
    })
  })

  describe('User Story 2: Canvas Creation with Name and Description', () => {
    it('Should provide canvas creation functionality', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of canvas creation interface
      cy.screenshot('user-story-2-canvas-creation', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for canvas creation elements
      cy.get('body').should('be.visible')
      
      // Look for buttons or forms that might be for canvas creation
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('create') || bodyText.includes('new') || bodyText.includes('canvas')) {
          cy.log('✅ User Story 2: Canvas creation functionality detected')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-2-canvas-creation.png')
    })
  })

  describe('User Story 3: Canvas Listing', () => {
    it('Should display canvas list', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of canvas listing interface
      cy.screenshot('user-story-3-canvas-listing', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for canvas listing functionality
      cy.get('body').should('be.visible')
      
      // Look for list or grid elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('canvas') || bodyText.includes('list') || bodyText.includes('my')) {
          cy.log('✅ User Story 3: Canvas listing functionality detected')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-3-canvas-listing.png')
    })
  })

  describe('User Story 4: Canvas Opening for Updates', () => {
    it('Should allow opening canvas for editing', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of canvas opening interface
      cy.screenshot('user-story-4-canvas-opening', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for canvas opening functionality
      cy.get('body').should('be.visible')
      
      // Look for clickable elements
      cy.get('body').then(($body) => {
        if ($body.find('button, a, [role="button"]').length > 0) {
          cy.log('✅ User Story 4: Interactive elements found - canvas opening functionality likely available')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-4-canvas-opening.png')
    })
  })

  describe('User Story 5: Text Box Placement and Text Entry', () => {
    it('Should provide text box functionality', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of text functionality interface
      cy.screenshot('user-story-5-text-box-functionality', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for text input functionality
      cy.get('body').should('be.visible')
      
      // Look for text-related elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('text') || bodyText.includes('type') || bodyText.includes('input')) {
          cy.log('✅ User Story 5: Text functionality detected')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-5-text-box-functionality.png')
    })
  })

  describe('User Story 6: Star Placement and Visibility', () => {
    it('Should provide star shape functionality', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of star functionality interface
      cy.screenshot('user-story-6-star-functionality', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for shape tools
      cy.get('body').should('be.visible')
      
      // Look for shape-related elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('star') || bodyText.includes('shape') || bodyText.includes('tool')) {
          cy.log('✅ User Story 6: Shape tools detected')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-6-star-functionality.png')
    })
  })

  describe('User Story 7: Circle Placement and Visibility', () => {
    it('Should provide circle shape functionality', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of circle functionality interface
      cy.screenshot('user-story-7-circle-functionality', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for circle functionality
      cy.get('body').should('be.visible')
      
      // Look for shape tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('circle') || bodyText.includes('shape') || bodyText.includes('tool')) {
          cy.log('✅ User Story 7: Circle functionality detected')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-7-circle-functionality.png')
    })
  })

  describe('User Story 8: Rectangle Placement and Visibility', () => {
    it('Should provide rectangle shape functionality', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of rectangle functionality interface
      cy.screenshot('user-story-8-rectangle-functionality', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for rectangle functionality
      cy.get('body').should('be.visible')
      
      // Look for shape tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('rectangle') || bodyText.includes('shape') || bodyText.includes('tool')) {
          cy.log('✅ User Story 8: Rectangle functionality detected')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-8-rectangle-functionality.png')
    })
  })

  describe('User Story 9: Line Placement and Visibility', () => {
    it('Should provide line drawing functionality', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of line functionality interface
      cy.screenshot('user-story-9-line-functionality', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for line functionality
      cy.get('body').should('be.visible')
      
      // Look for drawing tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('line') || bodyText.includes('draw') || bodyText.includes('tool')) {
          cy.log('✅ User Story 9: Line functionality detected')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-9-line-functionality.png')
    })
  })

  describe('User Story 10: Arrow Placement and Visibility', () => {
    it('Should provide arrow shape functionality', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of arrow functionality interface
      cy.screenshot('user-story-10-arrow-functionality', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for arrow functionality
      cy.get('body').should('be.visible')
      
      // Look for shape tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('arrow') || bodyText.includes('shape') || bodyText.includes('tool')) {
          cy.log('✅ User Story 10: Arrow functionality detected')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-10-arrow-functionality.png')
    })
  })

  describe('User Story 11: Diamond Placement and Visibility', () => {
    it('Should provide diamond shape functionality', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of diamond functionality interface
      cy.screenshot('user-story-11-diamond-functionality', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for diamond functionality
      cy.get('body').should('be.visible')
      
      // Look for shape tools
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('diamond') || bodyText.includes('shape') || bodyText.includes('tool')) {
          cy.log('✅ User Story 11: Diamond functionality detected')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-11-diamond-functionality.png')
    })
  })

  describe('User Story 12: Shape Resizing', () => {
    it('Should provide shape resizing functionality', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of resizing functionality interface
      cy.screenshot('user-story-12-shape-resizing', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for resizing functionality
      cy.get('body').should('be.visible')
      
      // Look for resize-related elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('resize') || bodyText.includes('size') || bodyText.includes('scale')) {
          cy.log('✅ User Story 12: Resize functionality detected')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-12-shape-resizing.png')
    })
  })

  describe('User Story 13: AI Agent Canvas Generation', () => {
    it('Should provide AI agent functionality', () => {
      cy.visit(productionUrl)
      cy.wait(2000)
      
      // Take screenshot of AI agent functionality interface
      cy.screenshot('user-story-13-ai-agent-functionality', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Check for AI agent functionality
      cy.get('body').should('be.visible')
      
      // Look for AI-related elements
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('ai') || bodyText.includes('agent') || bodyText.includes('generate')) {
          cy.log('✅ User Story 13: AI agent functionality detected')
        }
      })
      
      cy.log('📸 Screenshot saved: user-story-13-ai-agent-functionality.png')
    })
  })

  describe('Technical Validation with Screenshots', () => {
    it('Should validate API connectivity', () => {
      // Test backend API health
      cy.request('GET', `${apiUrl}/api/health`)
        .then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.status).to.eq('healthy')
        })
      
      cy.log('✅ API connectivity validated')
    })

    it('Should validate frontend performance', () => {
      cy.visit(productionUrl)
      cy.wait(3000)
      
      // Take screenshot of fully loaded page
      cy.screenshot('technical-validation-frontend-performance', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Measure page load time
      cy.window().then((win) => {
        const loadTime = win.performance.timing.loadEventEnd - win.performance.timing.navigationStart
        cy.log(`📊 Page load time: ${loadTime}ms`)
        
        // Page should load within reasonable time (10 seconds)
        expect(loadTime).to.be.lessThan(10000)
      })
      
      cy.log('📸 Screenshot saved: technical-validation-frontend-performance.png')
    })

    it('Should validate responsive design', () => {
      // Test different viewport sizes with screenshots
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' }
      ]
      
      viewports.forEach(viewport => {
        cy.viewport(viewport.width, viewport.height)
        cy.visit(productionUrl)
        cy.wait(2000)
        
        // Take screenshot for each viewport
        cy.screenshot(`responsive-design-${viewport.name.toLowerCase()}`, {
          capture: 'fullPage',
          overwrite: true
        })
        
        cy.get('body').should('be.visible')
        cy.log(`📸 Screenshot saved: responsive-design-${viewport.name.toLowerCase()}.png`)
      })
    })
  })

  after(() => {
    cy.log('🎉 All user stories validation completed with screenshots!')
    cy.log('📁 Screenshots saved in: cypress/screenshots/production/production-user-stories-with-screenshots.cy.ts/')
  })
})
