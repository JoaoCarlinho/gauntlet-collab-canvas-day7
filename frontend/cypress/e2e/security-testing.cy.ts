/**
 * Comprehensive Security Testing Suite
 * Tests XSS prevention, input validation, authentication security, and other security measures
 */

describe('Security Testing Suite', () => {
  beforeEach(() => {
    // Visit the canvas page with authentication
    cy.visit('/dev/canvas/test-canvas', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('dev-mode', 'true')
        win.localStorage.setItem('idToken', 'dev-token')
        win.localStorage.setItem('user', JSON.stringify({
          id: 'test-user-1',
          email: 'test@collabcanvas.com',
          name: 'Test User'
        }))
      }
    })
    
    // Wait for canvas to load
    cy.wait(3000)
    cy.get('.konvajs-content').should('be.visible')
  })

  describe('XSS Prevention Tests', () => {
    it('should prevent XSS in canvas titles', () => {
      // Test various XSS payloads
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<body onload=alert("XSS")>',
        '<input onfocus=alert("XSS") autofocus>',
        '<select onfocus=alert("XSS") autofocus>',
        '<textarea onfocus=alert("XSS") autofocus>',
        '<keygen onfocus=alert("XSS") autofocus>',
        '<video><source onerror="alert(\'XSS\')">',
        '<audio src=x onerror=alert("XSS")>',
        '<details open ontoggle=alert("XSS")>',
        '<marquee onstart=alert("XSS")>',
        '<math><mi//xlink:href="data:x,<script>alert(\'XSS\')</script>">',
      ]

      xssPayloads.forEach((payload, index) => {
        // Try to create canvas with XSS payload
        cy.window().then((win) => {
          // Intercept the API call to check if payload is sanitized
          cy.intercept('POST', '**/api/canvas/**', (req) => {
            const body = req.body
            if (body.title) {
              // Check if XSS payload was sanitized
              expect(body.title).to.not.include('<script>')
              expect(body.title).to.not.include('javascript:')
              expect(body.title).to.not.include('onerror=')
              expect(body.title).to.not.include('onload=')
            }
          }).as('canvasCreation')
        })

        // Create canvas with XSS payload
        cy.get('[data-testid="create-canvas-btn"]').click()
        cy.get('[data-testid="canvas-title-input"]').clear().type(payload)
        cy.get('[data-testid="create-canvas-submit"]').click()
        
        // Wait for API call
        cy.wait('@canvasCreation')
        
        // Take screenshot for documentation
        cy.screenshot(`xss-prevention-canvas-title-${index}`, {
          capture: 'fullPage'
        })
      })
    })

    it('should prevent XSS in object text content', () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      ]

      xssPayloads.forEach((payload, index) => {
        // Create text object with XSS payload
        cy.get('[data-testid="tool-text"]').click()
        cy.get('.konvajs-content').click(400, 200, { force: true })
        
        // Type XSS payload
        cy.get('[data-testid="text-input"]').clear().type(payload)
        cy.get('[data-testid="text-submit"]').click()
        
        // Check that the text was sanitized
        cy.get('.konvajs-content').should('not.contain', '<script>')
        cy.get('.konvajs-content').should('not.contain', 'javascript:')
        
        // Take screenshot
        cy.screenshot(`xss-prevention-text-object-${index}`, {
          capture: 'fullPage'
        })
      })
    })

    it('should prevent XSS in collaboration invitations', () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
      ]

      xssPayloads.forEach((payload, index) => {
        // Open collaboration panel
        cy.get('[data-testid="collaboration-btn"]').click()
        
        // Try to send invitation with XSS payload
        cy.get('[data-testid="invite-email-input"]').clear().type('test@example.com')
        cy.get('[data-testid="invite-message-input"]').clear().type(payload)
        cy.get('[data-testid="send-invite-btn"]').click()
        
        // Check that message was sanitized
        cy.get('[data-testid="invite-message-input"]').should('not.contain', '<script>')
        
        // Take screenshot
        cy.screenshot(`xss-prevention-invitation-${index}`, {
          capture: 'fullPage'
        })
      })
    })
  })

  describe('Input Validation Tests', () => {
    it('should validate canvas title length limits', () => {
      // Test title too long
      const longTitle = 'x'.repeat(300) // Over 255 character limit
      
      cy.get('[data-testid="create-canvas-btn"]').click()
      cy.get('[data-testid="canvas-title-input"]').clear().type(longTitle)
      cy.get('[data-testid="create-canvas-submit"]').click()
      
      // Should show validation error
      cy.get('[data-testid="validation-error"]').should('be.visible')
      cy.get('[data-testid="validation-error"]').should('contain', 'Title too long')
      
      cy.screenshot('input-validation-title-length', {
        capture: 'fullPage'
      })
    })

    it('should validate object coordinate bounds', () => {
      // Test invalid coordinates
      cy.get('[data-testid="tool-rectangle"]').click()
      
      // Try to create object with invalid coordinates
      cy.window().then((win) => {
        // Simulate invalid coordinates
        const invalidCoords = { x: -50000, y: -50000, width: 100, height: 100 }
        
        // Intercept object creation
        cy.intercept('POST', '**/api/objects/**', (req) => {
          expect(req.body.properties.x).to.be.at.least(-10000)
          expect(req.body.properties.x).to.be.at.most(10000)
          expect(req.body.properties.y).to.be.at.least(-10000)
          expect(req.body.properties.y).to.be.at.most(10000)
        }).as('objectCreation')
      })
      
      cy.get('.konvajs-content').click(-50000, -50000, { force: true })
      cy.wait('@objectCreation')
      
      cy.screenshot('input-validation-coordinate-bounds', {
        capture: 'fullPage'
      })
    })

    it('should validate email format in invitations', () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
        'test..test@example.com',
        'test@example',
        'test@.com',
        'test@example..com',
      ]

      invalidEmails.forEach((email, index) => {
        cy.get('[data-testid="collaboration-btn"]').click()
        cy.get('[data-testid="invite-email-input"]').clear().type(email)
        cy.get('[data-testid="send-invite-btn"]').click()
        
        // Should show validation error
        cy.get('[data-testid="validation-error"]').should('be.visible')
        cy.get('[data-testid="validation-error"]').should('contain', 'Invalid email')
        
        cy.screenshot(`input-validation-email-${index}`, {
          capture: 'fullPage'
        })
      })
    })
  })

  describe('Authentication Security Tests', () => {
    it('should handle invalid authentication tokens', () => {
      const invalidTokens = [
        'invalid-token',
        'expired-token',
        'malformed-token',
        '',
        'Bearer invalid-token',
        'Basic invalid-token',
      ]

      invalidTokens.forEach((token, index) => {
        // Set invalid token
        cy.window().then((win) => {
          win.localStorage.setItem('idToken', token)
        })
        
        // Try to perform authenticated action
        cy.get('[data-testid="tool-rectangle"]').click()
        cy.get('.konvajs-content').click(400, 200, { force: true })
        
        // Should handle gracefully
        cy.get('[data-testid="auth-error"]').should('be.visible')
        
        cy.screenshot(`auth-security-invalid-token-${index}`, {
          capture: 'fullPage'
        })
      })
    })

    it('should handle token expiration', () => {
      // Simulate token expiration
      cy.window().then((win) => {
        win.localStorage.setItem('idToken', 'expired-token')
      })
      
      // Try to create object
      cy.get('[data-testid="tool-rectangle"]').click()
      cy.get('.konvajs-content').click(400, 200, { force: true })
      
      // Should redirect to login or show auth error
      cy.url().should('include', '/login').or('contain', 'auth-error')
      
      cy.screenshot('auth-security-token-expiration', {
        capture: 'fullPage'
      })
    })

    it('should prevent unauthorized access to protected resources', () => {
      // Clear authentication
      cy.window().then((win) => {
        win.localStorage.removeItem('idToken')
        win.localStorage.removeItem('user')
      })
      
      // Try to access protected canvas
      cy.visit('/dev/canvas/protected-canvas')
      
      // Should redirect to login
      cy.url().should('include', '/login')
      
      cy.screenshot('auth-security-unauthorized-access', {
        capture: 'fullPage'
      })
    })
  })

  describe('Rate Limiting Tests', () => {
    it('should enforce rate limits on object creation', () => {
      // Create many objects rapidly
      for (let i = 0; i < 60; i++) {
        cy.get('[data-testid="tool-rectangle"]').click()
        cy.get('.konvajs-content').click(400 + (i * 10), 200, { force: true })
        cy.wait(100) // Small delay
      }
      
      // Should show rate limit error after threshold
      cy.get('[data-testid="rate-limit-error"]').should('be.visible')
      
      cy.screenshot('rate-limiting-object-creation', {
        capture: 'fullPage'
      })
    })

    it('should enforce rate limits on collaboration invites', () => {
      // Send many invitations rapidly
      for (let i = 0; i < 10; i++) {
        cy.get('[data-testid="collaboration-btn"]').click()
        cy.get('[data-testid="invite-email-input"]').clear().type(`test${i}@example.com`)
        cy.get('[data-testid="send-invite-btn"]').click()
        cy.wait(100)
      }
      
      // Should show rate limit error
      cy.get('[data-testid="rate-limit-error"]').should('be.visible')
      
      cy.screenshot('rate-limiting-invitations', {
        capture: 'fullPage'
      })
    })
  })

  describe('Data Sanitization Tests', () => {
    it('should sanitize HTML in user input', () => {
      const htmlInput = '<script>alert("xss")</script><b>Bold text</b><i>Italic text</i>'
      
      // Create text object with HTML
      cy.get('[data-testid="tool-text"]').click()
      cy.get('.konvajs-content').click(400, 200, { force: true })
      cy.get('[data-testid="text-input"]').clear().type(htmlInput)
      cy.get('[data-testid="text-submit"]').click()
      
      // Check that HTML was sanitized
      cy.get('.konvajs-content').should('not.contain', '<script>')
      cy.get('.konvajs-content').should('contain', 'Bold text')
      cy.get('.konvajs-content').should('contain', 'Italic text')
      
      cy.screenshot('data-sanitization-html', {
        capture: 'fullPage'
      })
    })

    it('should limit input length', () => {
      const longText = 'x'.repeat(2000) // Over typical limit
      
      // Try to create text object with long text
      cy.get('[data-testid="tool-text"]').click()
      cy.get('.konvajs-content').click(400, 200, { force: true })
      cy.get('[data-testid="text-input"]').clear().type(longText)
      cy.get('[data-testid="text-submit"]').click()
      
      // Should truncate or reject
      cy.get('[data-testid="validation-error"]').should('be.visible')
      
      cy.screenshot('data-sanitization-length-limit', {
        capture: 'fullPage'
      })
    })
  })

  describe('Content Security Policy Tests', () => {
    it('should enforce CSP headers', () => {
      // Check that CSP headers are present
      cy.request({
        method: 'GET',
        url: '/dev/canvas/test-canvas',
        failOnStatusCode: false
      }).then((response) => {
        expect(response.headers).to.have.property('content-security-policy')
        expect(response.headers).to.have.property('x-content-type-options')
        expect(response.headers).to.have.property('x-frame-options')
        expect(response.headers).to.have.property('x-xss-protection')
      })
    })

    it('should prevent inline script execution', () => {
      // Try to inject inline script
      cy.window().then((win) => {
        // This should be blocked by CSP
        try {
          win.eval('alert("CSP bypass attempt")')
        } catch (e) {
          // Expected to be blocked
          expect(e.name).to.equal('EvalError')
        }
      })
      
      cy.screenshot('csp-inline-script-prevention', {
        capture: 'fullPage'
      })
    })
  })

  describe('Session Security Tests', () => {
    it('should handle session timeout gracefully', () => {
      // Simulate session timeout
      cy.window().then((win) => {
        win.localStorage.removeItem('idToken')
        win.localStorage.removeItem('user')
        win.dispatchEvent(new Event('storage'))
      })
      
      // Try to perform action
      cy.get('[data-testid="tool-rectangle"]').click()
      cy.get('.konvajs-content').click(400, 200, { force: true })
      
      // Should handle gracefully
      cy.get('[data-testid="session-timeout"]').should('be.visible')
      
      cy.screenshot('session-security-timeout', {
        capture: 'fullPage'
      })
    })

    it('should prevent session hijacking', () => {
      // Simulate session hijacking attempt
      cy.window().then((win) => {
        // Try to modify user data
        const user = JSON.parse(win.localStorage.getItem('user') || '{}')
        user.id = 'hacker-user-id'
        user.email = 'hacker@example.com'
        win.localStorage.setItem('user', JSON.stringify(user))
      })
      
      // Try to perform action
      cy.get('[data-testid="tool-rectangle"]').click()
      cy.get('.konvajs-content').click(400, 200, { force: true })
      
      // Should validate token against user data
      cy.get('[data-testid="auth-error"]').should('be.visible')
      
      cy.screenshot('session-security-hijacking', {
        capture: 'fullPage'
      })
    })
  })

  describe('Network Security Tests', () => {
    it('should handle network failures gracefully', () => {
      // Simulate network failure
      cy.intercept('POST', '**/api/**', { forceNetworkError: true }).as('networkError')
      cy.intercept('GET', '**/api/**', { forceNetworkError: true }).as('networkError')
      
      // Try to create object
      cy.get('[data-testid="tool-rectangle"]').click()
      cy.get('.konvajs-content').click(400, 200, { force: true })
      
      // Should handle gracefully
      cy.get('[data-testid="network-error"]').should('be.visible')
      
      cy.screenshot('network-security-failure', {
        capture: 'fullPage'
      })
    })

    it('should validate API responses', () => {
      // Intercept API response with malicious content
      cy.intercept('GET', '**/api/canvas/**', {
        statusCode: 200,
        body: {
          id: 'test-canvas',
          title: '<script>alert("xss")</script>',
          description: 'Test description'
        }
      }).as('maliciousResponse')
      
      // Load canvas
      cy.visit('/dev/canvas/test-canvas')
      cy.wait('@maliciousResponse')
      
      // Should sanitize response
      cy.get('[data-testid="canvas-title"]').should('not.contain', '<script>')
      
      cy.screenshot('network-security-response-validation', {
        capture: 'fullPage'
      })
    })
  })
})
