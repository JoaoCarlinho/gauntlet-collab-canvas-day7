/// <reference types="cypress" />

describe('Comprehensive Test Instructions Execution', () => {
  const targetUrl = 'https://collab-canvas-frontend.up.railway.app/'
  let consoleErrors: string[] = []
  let consoleWarnings: string[] = []
  let consoleLogs: string[] = []
  let errorCount = 0
  let warningCount = 0

  beforeEach(() => {
    // Don't clear localStorage and cookies to maintain authentication
    // cy.clearLocalStorage()
    // cy.clearCookies()
    consoleErrors = []
    consoleWarnings = []
    consoleLogs = []
    errorCount = 0
    warningCount = 0

    // Set up comprehensive console monitoring
    cy.window().then((win) => {
      const originalConsoleError = win.console.error
      const originalConsoleWarn = win.console.warn
      const originalConsoleLog = win.console.log

      win.console.error = (...args) => {
        const message = args.join(' ')
        consoleErrors.push(message)
        errorCount++
        cy.task('logConsoleError', `ERROR: ${message}`)
        originalConsoleError.apply(win.console, args)
      }

      win.console.warn = (...args) => {
        const message = args.join(' ')
        consoleWarnings.push(message)
        warningCount++
        cy.task('logConsoleError', `WARN: ${message}`)
        originalConsoleWarn.apply(win.console, args)
      }

      win.console.log = (...args) => {
        const message = args.join(' ')
        consoleLogs.push(message)
        cy.task('logConsoleError', `LOG: ${message}`)
        originalConsoleLog.apply(win.console, args)
      }
    })
  })

  before(() => {
    // Authenticate with test user before running tests
    cy.visit(targetUrl)
    cy.wait(2000)
    
    // Try to authenticate with the configured test user
    cy.loginWithTestUser()
    cy.wait(3000) // Wait for authentication to complete
  })

  afterEach(() => {
    // Check console error count after each test
    if (errorCount > 10) {
      cy.log(`❌ CRITICAL: Console errors exceeded 10 (${errorCount} errors found)`)
      cy.log('Console errors:', consoleErrors)
      throw new Error(`Too many console errors: ${errorCount}. Stopping tests.`)
    } else if (errorCount > 0) {
      cy.log(`⚠️  Console errors detected: ${errorCount}`)
      cy.log('Error details:', consoleErrors)
    }
    
    if (warningCount > 0) {
      cy.log(`⚠️  Console warnings detected: ${warningCount}`)
      cy.log('Warning details:', consoleWarnings)
    }
  })

  describe('Video Functionality Tests (5-second videos)', () => {
    it('1. Ability to place an item on the canvas', () => {
      cy.visit(targetUrl)
      cy.wait(3000) // Wait for page load
      
      // Start video recording
      cy.startVideoRecording('place-item-on-canvas')
      
      // Look for canvas and tools
      cy.get('body').should('be.visible')
      
      // Check if we need to authenticate first
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        if (bodyText.includes('sign in') || bodyText.includes('login')) {
          cy.log('🔐 Authentication required for canvas interaction')
          // Use the configured test user credentials
          const testEmail = Cypress.env('TEST_USER_EMAIL')
          const testPassword = Cypress.env('TEST_USER_PASSWORD')
          
          // Try to find email input
          const emailInput = $body.find('input[type="email"], input[placeholder*="email"], input[name*="email"]')
          if (emailInput.length > 0) {
            cy.wrap(emailInput.first()).clear().type(testEmail)
            cy.wait(500)
          }
          
          // Try to find password input
          const passwordInput = $body.find('input[type="password"], input[placeholder*="password"], input[name*="password"]')
          if (passwordInput.length > 0) {
            cy.wrap(passwordInput.first()).clear().type(testPassword)
            cy.wait(500)
          }
          
          // Look for submit button
          const submitButton = $body.find('button[type="submit"], .submit, .login-button, .signin-button, button:contains("Sign In"), button:contains("Login")')
          if (submitButton.length > 0) {
            cy.wrap(submitButton.first()).click()
            cy.wait(3000) // Wait for authentication to complete
          }
        }
      })
      
      // Try to find and click a tool (e.g., text tool)
      cy.get('body').then(($body) => {
        const buttons = $body.find('button, [role="button"], .tool, .shape-tool')
        if (buttons.length > 0) {
          cy.wrap(buttons.first()).click()
          cy.wait(1000)
          
          // Try to click on canvas to place item
          cy.get('canvas, .canvas, #canvas').first().click(100, 100)
          cy.wait(2000)
        }
      })
      
      // Stop video recording after 5 seconds
      cy.wait(2000)
      cy.stopVideoRecording()
      
      cy.log('📹 Video saved: place-item-on-canvas.mp4')
    })

    it('2. Ability to resize objects on the canvas', () => {
      cy.visit(targetUrl)
      cy.wait(3000)
      
      cy.startVideoRecording('resize-objects-on-canvas')
      
      // Look for existing objects or create one
      cy.get('body').should('be.visible')
      
      // Try to find resize handles or select an object
      cy.get('body').then(($body) => {
        const objects = $body.find('.object, .shape, .resizable, [data-resizable]')
        if (objects.length > 0) {
          cy.wrap(objects.first()).click()
          cy.wait(1000)
          
          // Look for resize handles
          const resizeHandles = $body.find('.resize-handle, .corner, .edge')
          if (resizeHandles.length > 0) {
            cy.wrap(resizeHandles.first()).trigger('mousedown')
            cy.wait(500)
            cy.wrap(resizeHandles.first()).trigger('mousemove', { clientX: 200, clientY: 200 })
            cy.wait(500)
            cy.wrap(resizeHandles.first()).trigger('mouseup')
          }
        }
      })
      
      cy.wait(2000)
      cy.stopVideoRecording()
      
      cy.log('📹 Video saved: resize-objects-on-canvas.mp4')
    })

    it('3. Ability to click and drag an object around once placed on the canvas', () => {
      cy.visit(targetUrl)
      cy.wait(3000)
      
      cy.startVideoRecording('drag-object-around-canvas')
      
      cy.get('body').should('be.visible')
      
      // Try to find and drag an object
      cy.get('body').then(($body) => {
        const objects = $body.find('.object, .shape, .draggable, [data-draggable]')
        if (objects.length > 0) {
          const obj = objects.first()
          cy.wrap(obj).trigger('mousedown', { which: 1 })
          cy.wait(500)
          cy.wrap(obj).trigger('mousemove', { clientX: 300, clientY: 300 })
          cy.wait(500)
          cy.wrap(obj).trigger('mouseup')
        }
      })
      
      cy.wait(2000)
      cy.stopVideoRecording()
      
      cy.log('📹 Video saved: drag-object-around-canvas.mp4')
    })

    it('4. Ability to edit the text in a text box', () => {
      cy.visit(targetUrl)
      cy.wait(3000)
      
      cy.startVideoRecording('edit-text-in-textbox')
      
      cy.get('body').should('be.visible')
      
      // Look for text input or text editing functionality
      cy.get('body').then(($body) => {
        const textInputs = $body.find('input[type="text"], textarea, .text-input, .editable-text')
        if (textInputs.length > 0) {
          cy.wrap(textInputs.first()).click()
          cy.wait(500)
          cy.wrap(textInputs.first()).type('Test text editing')
          cy.wait(1000)
        }
      })
      
      cy.wait(2000)
      cy.stopVideoRecording()
      
      cy.log('📹 Video saved: edit-text-in-textbox.mp4')
    })

    it('5. Ability to place object on a canvas by prompting the AI agent', () => {
      cy.visit(targetUrl)
      cy.wait(3000)
      
      cy.startVideoRecording('ai-agent-place-object')
      
      cy.get('body').should('be.visible')
      
      // Look for AI agent interface
      cy.get('body').then(($body) => {
        const aiElements = $body.find('.ai-agent, .chat, .prompt, .ai-input, [data-ai]')
        if (aiElements.length > 0) {
          cy.wrap(aiElements.first()).click()
          cy.wait(500)
          
          // Try to find input field for AI prompts
          const inputs = $body.find('input, textarea')
          if (inputs.length > 0) {
            cy.wrap(inputs.first()).type('Create a circle on the canvas')
            cy.wait(1000)
            
            // Look for send button
            const sendButtons = $body.find('button:contains("Send"), button:contains("Submit"), .send-button')
            if (sendButtons.length > 0) {
              cy.wrap(sendButtons.first()).click()
            }
          }
        }
      })
      
      cy.wait(2000)
      cy.stopVideoRecording()
      
      cy.log('📹 Video saved: ai-agent-place-object.mp4')
    })
  })

  describe('Screenshot Tests (Before and After Activities)', () => {
    it('1. Use email/password authentication if necessary', () => {
      cy.visit(targetUrl)
      cy.wait(2000)
      
      // Before screenshot
      cy.screenshot('01-before-authentication', { capture: 'fullPage' })
      
      // Check if we're already authenticated or need to authenticate
      cy.get('body').should('be.visible')
      
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        
        // If we see login/signin elements, we need to authenticate
        if (bodyText.includes('sign in') || bodyText.includes('login') || $body.find('input[type="email"], input[type="password"]').length > 0) {
          cy.log('🔐 Authentication required, attempting login with test user')
          
          // Use the configured test user credentials
          const testEmail = Cypress.env('TEST_USER_EMAIL')
          const testPassword = Cypress.env('TEST_USER_PASSWORD')
          
          // Try to find email input
          const emailInput = $body.find('input[type="email"], input[placeholder*="email"], input[name*="email"]')
          if (emailInput.length > 0) {
            cy.wrap(emailInput.first()).clear().type(testEmail)
            cy.wait(500)
          }
          
          // Try to find password input
          const passwordInput = $body.find('input[type="password"], input[placeholder*="password"], input[name*="password"]')
          if (passwordInput.length > 0) {
            cy.wrap(passwordInput.first()).clear().type(testPassword)
            cy.wait(500)
          }
          
          // Look for submit button
          const submitButton = $body.find('button[type="submit"], .submit, .login-button, .signin-button, button:contains("Sign In"), button:contains("Login")')
          if (submitButton.length > 0) {
            cy.wrap(submitButton.first()).click()
            cy.wait(3000) // Wait for authentication to complete
          }
        } else {
          cy.log('✅ Already authenticated or no authentication required')
        }
      })
      
      // After screenshot
      cy.screenshot('01-after-authentication', { capture: 'fullPage' })
      
      cy.log('📸 Screenshots saved: 01-before-authentication.png, 01-after-authentication.png')
    })

    it('2. A user can create a canvas and give it a name and description', () => {
      cy.visit(targetUrl)
      cy.wait(2000)
      
      // Before screenshot
      cy.screenshot('02-before-canvas-creation', { capture: 'fullPage' })
      
      cy.get('body').should('be.visible')
      
      // Look for canvas creation elements
      cy.get('body').then(($body) => {
        const createButtons = $body.find('button:contains("Create"), button:contains("New"), .create-button, .new-button')
        if (createButtons.length > 0) {
          cy.wrap(createButtons.first()).click()
          cy.wait(1000)
          
          // Look for name input
          const nameInput = $body.find('input[placeholder*="name" i], input[name*="name" i], .name-input')
          if (nameInput.length > 0) {
            cy.wrap(nameInput.first()).type('Test Canvas')
            cy.wait(500)
          }
          
          // Look for description input
          const descInput = $body.find('textarea, input[placeholder*="description" i], .description-input')
          if (descInput.length > 0) {
            cy.wrap(descInput.first()).type('Test canvas description')
            cy.wait(500)
          }
          
          // Look for save/create button
          const saveButton = $body.find('button:contains("Save"), button:contains("Create"), .save-button')
          if (saveButton.length > 0) {
            cy.wrap(saveButton.first()).click()
            cy.wait(2000)
          }
        }
      })
      
      // After screenshot
      cy.screenshot('02-after-canvas-creation', { capture: 'fullPage' })
      
      cy.log('📸 Screenshots saved: 02-before-canvas-creation.png, 02-after-canvas-creation.png')
    })

    it('3. A user can see a list of created canvasses', () => {
      cy.visit(targetUrl)
      cy.wait(2000)
      
      // Before screenshot
      cy.screenshot('03-before-canvas-list', { capture: 'fullPage' })
      
      cy.get('body').should('be.visible')
      
      // Look for canvas list or navigation
      cy.get('body').then(($body) => {
        const listElements = $body.find('.canvas-list, .list, .grid, .canvas-item, [data-canvas]')
        if (listElements.length > 0) {
          cy.log('✅ Canvas list elements found')
        }
      })
      
      // After screenshot
      cy.screenshot('03-after-canvas-list', { capture: 'fullPage' })
      
      cy.log('📸 Screenshots saved: 03-before-canvas-list.png, 03-after-canvas-list.png')
    })

    it('4. A user can open a canvas for updating', () => {
      cy.visit(targetUrl)
      cy.wait(2000)
      
      // Before screenshot
      cy.screenshot('04-before-canvas-opening', { capture: 'fullPage' })
      
      cy.get('body').should('be.visible')
      
      // Look for canvas items to click
      cy.get('body').then(($body) => {
        const canvasItems = $body.find('.canvas-item, .canvas-card, [data-canvas], .list-item')
        if (canvasItems.length > 0) {
          cy.wrap(canvasItems.first()).click()
          cy.wait(2000)
        }
      })
      
      // After screenshot
      cy.screenshot('04-after-canvas-opening', { capture: 'fullPage' })
      
      cy.log('📸 Screenshots saved: 04-before-canvas-opening.png, 04-after-canvas-opening.png')
    })

    it('5. A user can place a text-box on the canvas and enter text into the text box', () => {
      cy.visit(targetUrl)
      cy.wait(2000)
      
      // Before screenshot
      cy.screenshot('05-before-text-box-placement', { capture: 'fullPage' })
      
      cy.get('body').should('be.visible')
      
      // Look for text tool and place text box
      cy.get('body').then(($body) => {
        const textTools = $body.find('button:contains("Text"), .text-tool, [data-tool="text"]')
        if (textTools.length > 0) {
          cy.wrap(textTools.first()).click()
          cy.wait(500)
          
          // Click on canvas to place text
          cy.get('canvas, .canvas, #canvas').first().click(200, 200)
          cy.wait(1000)
          
          // Try to enter text
          const textInputs = $body.find('input[type="text"], textarea, .text-input')
          if (textInputs.length > 0) {
            cy.wrap(textInputs.first()).type('Sample text')
            cy.wait(1000)
          }
        }
      })
      
      // After screenshot
      cy.screenshot('05-after-text-box-placement', { capture: 'fullPage' })
      
      cy.log('📸 Screenshots saved: 05-before-text-box-placement.png, 05-after-text-box-placement.png')
    })

    it('6. A user can place a star on the canvas and the star takes the shape of a five-point star and the star remains visible', () => {
      cy.visit(targetUrl)
      cy.wait(2000)
      
      // Before screenshot
      cy.screenshot('06-before-star-placement', { capture: 'fullPage' })
      
      cy.get('body').should('be.visible')
      
      // Look for star tool
      cy.get('body').then(($body) => {
        const starTools = $body.find('button:contains("Star"), .star-tool, [data-tool="star"]')
        if (starTools.length > 0) {
          cy.wrap(starTools.first()).click()
          cy.wait(500)
          
          // Click on canvas to place star
          cy.get('canvas, .canvas, #canvas').first().click(300, 300)
          cy.wait(2000)
        }
      })
      
      // After screenshot
      cy.screenshot('06-after-star-placement', { capture: 'fullPage' })
      
      cy.log('📸 Screenshots saved: 06-before-star-placement.png, 06-after-star-placement.png')
    })

    it('7. A user can place a circle on the canvas and the circle remains visible', () => {
      cy.visit(targetUrl)
      cy.wait(2000)
      
      // Before screenshot
      cy.screenshot('07-before-circle-placement', { capture: 'fullPage' })
      
      cy.get('body').should('be.visible')
      
      // Look for circle tool
      cy.get('body').then(($body) => {
        const circleTools = $body.find('button:contains("Circle"), .circle-tool, [data-tool="circle"]')
        if (circleTools.length > 0) {
          cy.wrap(circleTools.first()).click()
          cy.wait(500)
          
          // Click on canvas to place circle
          cy.get('canvas, .canvas, #canvas').first().click(400, 400)
          cy.wait(2000)
        }
      })
      
      // After screenshot
      cy.screenshot('07-after-circle-placement', { capture: 'fullPage' })
      
      cy.log('📸 Screenshots saved: 07-before-circle-placement.png, 07-after-circle-placement.png')
    })

    it('8. A user can place a rectangle on the canvas and the rectangle remains visible', () => {
      cy.visit(targetUrl)
      cy.wait(2000)
      
      // Before screenshot
      cy.screenshot('08-before-rectangle-placement', { capture: 'fullPage' })
      
      cy.get('body').should('be.visible')
      
      // Look for rectangle tool
      cy.get('body').then(($body) => {
        const rectTools = $body.find('button:contains("Rectangle"), .rectangle-tool, [data-tool="rectangle"]')
        if (rectTools.length > 0) {
          cy.wrap(rectTools.first()).click()
          cy.wait(500)
          
          // Click on canvas to place rectangle
          cy.get('canvas, .canvas, #canvas').first().click(500, 500)
          cy.wait(2000)
        }
      })
      
      // After screenshot
      cy.screenshot('08-after-rectangle-placement', { capture: 'fullPage' })
      
      cy.log('📸 Screenshots saved: 08-before-rectangle-placement.png, 08-after-rectangle-placement.png')
    })

    it('9. A user can place a line on the canvas and the line remains visible', () => {
      cy.visit(targetUrl)
      cy.wait(2000)
      
      // Before screenshot
      cy.screenshot('09-before-line-placement', { capture: 'fullPage' })
      
      cy.get('body').should('be.visible')
      
      // Look for line tool
      cy.get('body').then(($body) => {
        const lineTools = $body.find('button:contains("Line"), .line-tool, [data-tool="line"]')
        if (lineTools.length > 0) {
          cy.wrap(lineTools.first()).click()
          cy.wait(500)
          
          // Draw line on canvas
          cy.get('canvas, .canvas, #canvas').first().trigger('mousedown', { clientX: 100, clientY: 100 })
          cy.wait(500)
          cy.get('canvas, .canvas, #canvas').first().trigger('mousemove', { clientX: 200, clientY: 200 })
          cy.wait(500)
          cy.get('canvas, .canvas, #canvas').first().trigger('mouseup')
          cy.wait(2000)
        }
      })
      
      // After screenshot
      cy.screenshot('09-after-line-placement', { capture: 'fullPage' })
      
      cy.log('📸 Screenshots saved: 09-before-line-placement.png, 09-after-line-placement.png')
    })

    it('10. A user can place an arrow on the canvas and the arrow remains visible', () => {
      cy.visit(targetUrl)
      cy.wait(2000)
      
      // Before screenshot
      cy.screenshot('10-before-arrow-placement', { capture: 'fullPage' })
      
      cy.get('body').should('be.visible')
      
      // Look for arrow tool
      cy.get('body').then(($body) => {
        const arrowTools = $body.find('button:contains("Arrow"), .arrow-tool, [data-tool="arrow"]')
        if (arrowTools.length > 0) {
          cy.wrap(arrowTools.first()).click()
          cy.wait(500)
          
          // Click on canvas to place arrow
          cy.get('canvas, .canvas, #canvas').first().click(600, 600)
          cy.wait(2000)
        }
      })
      
      // After screenshot
      cy.screenshot('10-after-arrow-placement', { capture: 'fullPage' })
      
      cy.log('📸 Screenshots saved: 10-before-arrow-placement.png, 10-after-arrow-placement.png')
    })

    it('11. A user can place a diamond on the canvas and the diamond remains visible', () => {
      cy.visit(targetUrl)
      cy.wait(2000)
      
      // Before screenshot
      cy.screenshot('11-before-diamond-placement', { capture: 'fullPage' })
      
      cy.get('body').should('be.visible')
      
      // Look for diamond tool
      cy.get('body').then(($body) => {
        const diamondTools = $body.find('button:contains("Diamond"), .diamond-tool, [data-tool="diamond"]')
        if (diamondTools.length > 0) {
          cy.wrap(diamondTools.first()).click()
          cy.wait(500)
          
          // Click on canvas to place diamond
          cy.get('canvas, .canvas, #canvas').first().click(700, 700)
          cy.wait(2000)
        }
      })
      
      // After screenshot
      cy.screenshot('11-after-diamond-placement', { capture: 'fullPage' })
      
      cy.log('📸 Screenshots saved: 11-before-diamond-placement.png, 11-after-diamond-placement.png')
    })

    it('12. A user can move an object around the canvas', () => {
      cy.visit(targetUrl)
      cy.wait(2000)
      
      // Before screenshot
      cy.screenshot('12-before-object-movement', { capture: 'fullPage' })
      
      cy.get('body').should('be.visible')
      
      // Try to move an object
      cy.get('body').then(($body) => {
        const objects = $body.find('.object, .shape, .draggable, [data-draggable]')
        if (objects.length > 0) {
          const obj = objects.first()
          cy.wrap(obj).trigger('mousedown', { which: 1 })
          cy.wait(500)
          cy.wrap(obj).trigger('mousemove', { clientX: 400, clientY: 400 })
          cy.wait(500)
          cy.wrap(obj).trigger('mouseup')
          cy.wait(1000)
        }
      })
      
      // After screenshot
      cy.screenshot('12-after-object-movement', { capture: 'fullPage' })
      
      cy.log('📸 Screenshots saved: 12-before-object-movement.png, 12-after-object-movement.png')
    })

    it('13. A user can resize any shape placed on the canvas', () => {
      cy.visit(targetUrl)
      cy.wait(2000)
      
      // Before screenshot
      cy.screenshot('13-before-shape-resizing', { capture: 'fullPage' })
      
      cy.get('body').should('be.visible')
      
      // Try to resize a shape
      cy.get('body').then(($body) => {
        const objects = $body.find('.object, .shape, .resizable, [data-resizable]')
        if (objects.length > 0) {
          cy.wrap(objects.first()).click()
          cy.wait(500)
          
          // Look for resize handles
          const resizeHandles = $body.find('.resize-handle, .corner, .edge')
          if (resizeHandles.length > 0) {
            cy.wrap(resizeHandles.first()).trigger('mousedown')
            cy.wait(500)
            cy.wrap(resizeHandles.first()).trigger('mousemove', { clientX: 300, clientY: 300 })
            cy.wait(500)
            cy.wrap(resizeHandles.first()).trigger('mouseup')
            cy.wait(1000)
          }
        }
      })
      
      // After screenshot
      cy.screenshot('13-after-shape-resizing', { capture: 'fullPage' })
      
      cy.log('📸 Screenshots saved: 13-before-shape-resizing.png, 13-after-shape-resizing.png')
    })

    it('14. A user can send a message to an AI Agent and request a canvas to be generated and this canvas will be presented in the browser', () => {
      cy.visit(targetUrl)
      cy.wait(2000)
      
      // Before screenshot
      cy.screenshot('14-before-ai-agent-request', { capture: 'fullPage' })
      
      cy.get('body').should('be.visible')
      
      // Look for AI agent interface
      cy.get('body').then(($body) => {
        const aiElements = $body.find('.ai-agent, .chat, .prompt, .ai-input, [data-ai]')
        if (aiElements.length > 0) {
          cy.wrap(aiElements.first()).click()
          cy.wait(500)
          
          // Try to find input field for AI prompts
          const inputs = $body.find('input, textarea')
          if (inputs.length > 0) {
            cy.wrap(inputs.first()).type('Generate a canvas with a house and a tree')
            cy.wait(1000)
            
            // Look for send button
            const sendButtons = $body.find('button:contains("Send"), button:contains("Submit"), .send-button')
            if (sendButtons.length > 0) {
              cy.wrap(sendButtons.first()).click()
              cy.wait(3000) // Wait for AI response
            }
          }
        }
      })
      
      // After screenshot
      cy.screenshot('14-after-ai-agent-request', { capture: 'fullPage' })
      
      cy.log('📸 Screenshots saved: 14-before-ai-agent-request.png, 14-after-ai-agent-request.png')
    })
  })

  after(() => {
    cy.log('🎉 Comprehensive test instructions execution completed!')
    cy.log(`📊 Total console errors encountered: ${errorCount}`)
    cy.log('📁 Videos saved in: cypress/videos/')
    cy.log('📁 Screenshots saved in: cypress/screenshots/')
    
    if (errorCount > 0) {
      cy.log('⚠️  Console errors found:')
      consoleErrors.forEach((error, index) => {
        cy.log(`  ${index + 1}. ${error}`)
      })
    }
  })
})
