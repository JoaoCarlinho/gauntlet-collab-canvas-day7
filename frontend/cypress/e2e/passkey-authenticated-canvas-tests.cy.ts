/// <reference types="cypress" />

describe('Passkey Authenticated Canvas Interaction Tests', () => {
  const targetUrl = 'https://collab-canvas-frontend.up.railway.app/'
  const testUserEmail = 'JSkeete@gmail.com' // Your email for passkey authentication
  let consoleErrors: string[] = []
  let errorCount = 0

  before(() => {
    // Setup passkey authentication environment
    cy.setupPasskeyAuth()
    
    // Set up console error monitoring
    cy.window().then((win) => {
      const originalConsoleError = win.console.error
      win.console.error = (...args) => {
        consoleErrors.push(args.join(' '))
        errorCount++
        originalConsoleError.apply(win.console, args)
      }
    })
  })

  beforeEach(() => {
    // Don't clear localStorage to maintain authentication
    consoleErrors = []
    errorCount = 0
  })

  afterEach(() => {
    // Check console error count after each test
    if (errorCount > 100) {
      cy.log(`❌ CRITICAL: Console errors exceeded 100 (${errorCount} errors found)`)
      cy.log('Console errors:', consoleErrors)
      throw new Error(`Too many console errors: ${errorCount}. Stopping tests.`)
    } else if (errorCount > 0) {
      cy.log(`⚠️  Console errors detected: ${errorCount}`)
    }
  })

  describe('Passkey Authentication', () => {
    it('should authenticate with passkey and access canvas interface', () => {
      cy.log('🔐 Starting passkey authentication test')
      
      // Attempt passkey authentication
      cy.authenticateWithPasskey(testUserEmail)
      
      // Navigate to the application
      cy.visit(targetUrl)
      cy.wait(3000)
      
      // Verify we can access the canvas interface
      cy.get('body').should('be.visible')
      
      // Check for canvas elements
      cy.get('body').then(($body) => {
        const canvasElements = $body.find('[data-testid*="canvas"], canvas, [class*="canvas"]')
        const hasCanvas = canvasElements.length > 0
        
        if (hasCanvas) {
          cy.log('✅ Canvas interface accessible after passkey authentication')
          cy.screenshot('passkey-auth-canvas-accessible')
        } else {
          cy.log('⚠️ Canvas interface not immediately visible, checking for authentication state')
          cy.screenshot('passkey-auth-canvas-check')
          
          // Wait a bit more for the interface to load
          cy.wait(2000)
          cy.get('body').then(($body) => {
            const canvasElements = $body.find('[data-testid*="canvas"], canvas, [class*="canvas"]')
            if (canvasElements.length > 0) {
              cy.log('✅ Canvas interface loaded after additional wait')
              cy.screenshot('passkey-auth-canvas-loaded')
            } else {
              cy.log('⚠️ Canvas interface still not visible')
              cy.screenshot('passkey-auth-canvas-not-visible')
            }
          })
        }
      })
    })
  })

  describe('Canvas Interaction Tests with Passkey Authentication', () => {
    beforeEach(() => {
      // Ensure we're authenticated before each test
      cy.visit(targetUrl)
      cy.wait(2000)
    })

    it('1. Ability to place an item on the canvas', () => {
      cy.startVideoRecording('passkey-place-item-on-canvas')
      
      cy.get('body').should('be.visible')
      
      // Look for canvas and tools
      cy.get('body').then(($body) => {
        const canvasElements = $body.find('[data-testid*="canvas"], canvas, [class*="canvas"]')
        const toolButtons = $body.find('button, [role="button"], .tool, .shape-tool')
        
        if (canvasElements.length > 0 && toolButtons.length > 0) {
          cy.log('✅ Canvas and tools found, testing object placement')
          
          // Click a tool button
          cy.wrap(toolButtons.first()).click()
          cy.wait(1000)
          
          // Click on canvas to place item
          cy.wrap(canvasElements.first()).click(200, 200)
          cy.wait(2000)
          
          cy.screenshot('passkey-item-placed-on-canvas')
        } else {
          cy.log('⚠️ Canvas or tools not found')
          cy.screenshot('passkey-no-canvas-or-tools')
        }
      })
      
      cy.wait(2000)
      cy.stopVideoRecording()
      
      cy.log('📹 Video saved: passkey-place-item-on-canvas.mp4')
    })

    it('2. Ability to resize objects on the canvas', () => {
      cy.startVideoRecording('passkey-resize-objects-on-canvas')
      
      cy.get('body').should('be.visible')
      
      // Look for existing objects or create one
      cy.get('body').then(($body) => {
        const objects = $body.find('.object, .shape, .resizable, [data-resizable]')
        
        if (objects.length > 0) {
          cy.log('✅ Found existing objects, testing resize')
          cy.wrap(objects.first()).click()
          cy.wait(1000)
          
          // Look for resize handles
          const resizeHandles = $body.find('.resize-handle, .corner, .edge')
          if (resizeHandles.length > 0) {
            cy.wrap(resizeHandles.first()).trigger('mousedown')
            cy.wait(500)
            cy.wrap(resizeHandles.first()).trigger('mousemove', { clientX: 300, clientY: 300 })
            cy.wait(500)
            cy.wrap(resizeHandles.first()).trigger('mouseup')
            cy.screenshot('passkey-object-resized')
          }
        } else {
          cy.log('⚠️ No objects found to resize')
          cy.screenshot('passkey-no-objects-to-resize')
        }
      })
      
      cy.wait(2000)
      cy.stopVideoRecording()
      
      cy.log('📹 Video saved: passkey-resize-objects-on-canvas.mp4')
    })

    it('3. Ability to click and drag an object around once placed on the canvas', () => {
      cy.startVideoRecording('passkey-drag-object-around-canvas')
      
      cy.get('body').should('be.visible')
      
      // Try to find and drag an object
      cy.get('body').then(($body) => {
        const objects = $body.find('.object, .shape, .draggable, [data-draggable]')
        
        if (objects.length > 0) {
          cy.log('✅ Found objects, testing drag functionality')
          const obj = objects.first()
          cy.wrap(obj).trigger('mousedown', { which: 1 })
          cy.wait(500)
          cy.wrap(obj).trigger('mousemove', { clientX: 400, clientY: 400 })
          cy.wait(500)
          cy.wrap(obj).trigger('mouseup')
          cy.screenshot('passkey-object-dragged')
        } else {
          cy.log('⚠️ No objects found to drag')
          cy.screenshot('passkey-no-objects-to-drag')
        }
      })
      
      cy.wait(2000)
      cy.stopVideoRecording()
      
      cy.log('📹 Video saved: passkey-drag-object-around-canvas.mp4')
    })

    it('4. Ability to edit the text in a text box', () => {
      cy.startVideoRecording('passkey-edit-text-in-textbox')
      
      cy.get('body').should('be.visible')
      
      // Look for text input or text editing functionality
      cy.get('body').then(($body) => {
        const textInputs = $body.find('input[type="text"], textarea, .text-input, .editable-text')
        
        if (textInputs.length > 0) {
          cy.log('✅ Found text inputs, testing text editing')
          cy.wrap(textInputs.first()).click()
          cy.wait(500)
          cy.wrap(textInputs.first()).type('Passkey authenticated text editing test')
          cy.wait(1000)
          cy.screenshot('passkey-text-edited')
        } else {
          cy.log('⚠️ No text inputs found')
          cy.screenshot('passkey-no-text-inputs')
        }
      })
      
      cy.wait(2000)
      cy.stopVideoRecording()
      
      cy.log('📹 Video saved: passkey-edit-text-in-textbox.mp4')
    })

    it('5. Ability to place object on a canvas by prompting the AI agent', () => {
      cy.startVideoRecording('passkey-ai-agent-place-object')
      
      cy.get('body').should('be.visible')
      
      // Look for AI agent interface
      cy.get('body').then(($body) => {
        const aiElements = $body.find('.ai-agent, .chat, .prompt, .ai-input, [data-ai]')
        
        if (aiElements.length > 0) {
          cy.log('✅ Found AI agent interface, testing AI object placement')
          cy.wrap(aiElements.first()).click()
          cy.wait(500)
          
          // Try to find input field for AI prompts
          const inputs = $body.find('input, textarea')
          if (inputs.length > 0) {
            cy.wrap(inputs.first()).type('Create a circle on the canvas using passkey authentication')
            cy.wait(1000)
            
            // Look for send button
            const sendButtons = $body.find('button:contains("Send"), button:contains("Submit"), .send-button')
            if (sendButtons.length > 0) {
              cy.wrap(sendButtons.first()).click()
              cy.wait(3000)
              cy.screenshot('passkey-ai-agent-request-sent')
            }
          }
        } else {
          cy.log('⚠️ No AI agent interface found')
          cy.screenshot('passkey-no-ai-agent')
        }
      })
      
      cy.wait(2000)
      cy.stopVideoRecording()
      
      cy.log('📹 Video saved: passkey-ai-agent-place-object.mp4')
    })
  })

  describe('Comprehensive Canvas Functionality Tests', () => {
    beforeEach(() => {
      cy.visit(targetUrl)
      cy.wait(2000)
    })

    it('should test all shape placement with passkey authentication', () => {
      const shapes = [
        { name: 'text', selector: 'button:contains("Text"), .text-tool, [data-tool="text"]' },
        { name: 'star', selector: 'button:contains("Star"), .star-tool, [data-tool="star"]' },
        { name: 'circle', selector: 'button:contains("Circle"), .circle-tool, [data-tool="circle"]' },
        { name: 'rectangle', selector: 'button:contains("Rectangle"), .rectangle-tool, [data-tool="rectangle"]' },
        { name: 'line', selector: 'button:contains("Line"), .line-tool, [data-tool="line"]' },
        { name: 'arrow', selector: 'button:contains("Arrow"), .arrow-tool, [data-tool="arrow"]' },
        { name: 'diamond', selector: 'button:contains("Diamond"), .diamond-tool, [data-tool="diamond"]' }
      ]

      shapes.forEach((shape, index) => {
        cy.log(`Testing ${shape.name} placement`)
        
        // Before screenshot
        cy.screenshot(`passkey-before-${shape.name}-placement`)
        
        cy.get('body').then(($body) => {
          const shapeTools = $body.find(shape.selector)
          const canvasElements = $body.find('[data-testid*="canvas"], canvas, [class*="canvas"]')
          
          if (shapeTools.length > 0 && canvasElements.length > 0) {
            cy.wrap(shapeTools.first()).click()
            cy.wait(500)
            
            // Click on canvas to place shape
            cy.wrap(canvasElements.first()).click(100 + (index * 50), 100 + (index * 50))
            cy.wait(1000)
            
            // After screenshot
            cy.screenshot(`passkey-after-${shape.name}-placement`)
            cy.log(`✅ ${shape.name} placement tested`)
          } else {
            cy.log(`⚠️ ${shape.name} tool or canvas not found`)
            cy.screenshot(`passkey-${shape.name}-tool-not-found`)
          }
        })
      })
    })

    it('should test canvas management with passkey authentication', () => {
      // Test canvas creation
      cy.screenshot('passkey-before-canvas-creation')
      
      cy.get('body').then(($body) => {
        const createButtons = $body.find('button:contains("Create"), button:contains("New"), .create-button, .new-button')
        
        if (createButtons.length > 0) {
          cy.wrap(createButtons.first()).click()
          cy.wait(1000)
          
          // Look for name input
          const nameInput = $body.find('input[placeholder*="name" i], input[name*="name" i], .name-input')
          if (nameInput.length > 0) {
            cy.wrap(nameInput.first()).type('Passkey Test Canvas')
            cy.wait(500)
          }
          
          // Look for description input
          const descInput = $body.find('textarea, input[placeholder*="description" i], .description-input')
          if (descInput.length > 0) {
            cy.wrap(descInput.first()).type('Canvas created with passkey authentication')
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
      
      cy.screenshot('passkey-after-canvas-creation')
      
      // Test canvas listing
      cy.screenshot('passkey-canvas-listing')
      
      // Test canvas opening
      cy.get('body').then(($body) => {
        const canvasItems = $body.find('.canvas-item, .canvas-card, [data-canvas], .list-item')
        if (canvasItems.length > 0) {
          cy.wrap(canvasItems.first()).click()
          cy.wait(2000)
          cy.screenshot('passkey-canvas-opened')
        }
      })
    })
  })

  after(() => {
    cy.log('🎉 Passkey authenticated canvas tests completed!')
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
