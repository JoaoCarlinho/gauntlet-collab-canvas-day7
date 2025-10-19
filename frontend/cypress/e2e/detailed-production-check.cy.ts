/// <reference types="cypress" />

describe('Detailed Production Check', () => {
  const productionUrl = 'https://gauntlet-collab-canvas-day7.vercel.app'

  it('Should provide detailed analysis of production page content', () => {
    cy.visit(productionUrl)
    cy.wait(5000) // Wait longer for any potential loading
    
    // Get detailed page information
    cy.get('body').then(($body) => {
      const bodyText = $body.text()
      const bodyHTML = $body.html()
      
      // Log detailed information
      cy.log('=== DETAILED PRODUCTION ANALYSIS ===')
      cy.log('Page URL:', cy.url())
      cy.log('Body text length:', bodyText.length)
      cy.log('Body HTML length:', bodyHTML.length)
      
      // Check for specific authentication elements
      const emailInputs = $body.find('input[type="email"]')
      const passwordInputs = $body.find('input[type="password"]')
      const buttons = $body.find('button')
      const forms = $body.find('form')
      
      cy.log('Email inputs found:', emailInputs.length)
      cy.log('Password inputs found:', passwordInputs.length)
      cy.log('Buttons found:', buttons.length)
      cy.log('Forms found:', forms.length)
      
      // Log button text content
      buttons.each((index, button) => {
        cy.log(`Button ${index}: "${button.textContent?.trim()}"`)
      })
      
      // Check for specific text content
      const hasEmail = bodyText.toLowerCase().includes('email')
      const hasPassword = bodyText.toLowerCase().includes('password')
      const hasGoogle = bodyText.toLowerCase().includes('google')
      const hasSignIn = bodyText.toLowerCase().includes('sign in')
      const hasLogin = bodyText.toLowerCase().includes('login')
      
      cy.log('Contains "email":', hasEmail)
      cy.log('Contains "password":', hasPassword)
      cy.log('Contains "google":', hasGoogle)
      cy.log('Contains "sign in":', hasSignIn)
      cy.log('Contains "login":', hasLogin)
      
      // Check for React component patterns
      const reactDivs = $body.find('div[class*="react"], div[data-reactroot]')
      cy.log('React divs found:', reactDivs.length)
      
      // Check for any authentication-related classes
      const authElements = $body.find('[class*="auth"], [class*="login"], [class*="sign"]')
      cy.log('Auth-related elements found:', authElements.length)
      
      // Log first 2000 characters of body text
      cy.log('First 2000 characters of body text:')
      cy.log(bodyText.substring(0, 2000))
      
      // Take screenshot
      cy.screenshot('detailed-production-analysis', {
        capture: 'fullPage',
        overwrite: true
      })
    })
    
    // Check if there are any console errors
    cy.window().then((win) => {
      const consoleErrors = win.console.error
      cy.log('Console errors available:', typeof consoleErrors === 'function')
    })
    
    cy.log('📸 Screenshot saved: detailed-production-analysis.png')
  })

  it('Should check for any loading states or dynamic content', () => {
    cy.visit(productionUrl)
    cy.wait(2000)
    
    // Take initial screenshot
    cy.screenshot('loading-check-initial', {
      capture: 'fullPage',
      overwrite: true
    })
    
    // Wait and check again
    cy.wait(5000)
    cy.screenshot('loading-check-after-wait', {
      capture: 'fullPage',
      overwrite: true
    })
    
    // Check for any loading indicators
    cy.get('body').then(($body) => {
      const loadingElements = $body.find('[class*="loading"], [class*="spinner"], [class*="loader"]')
      cy.log('Loading elements found:', loadingElements.length)
      
      // Check for any hidden elements that might become visible
      const hiddenElements = $body.find('[style*="display: none"], [style*="visibility: hidden"]')
      cy.log('Hidden elements found:', hiddenElements.length)
    })
  })

  after(() => {
    cy.log('🔍 Detailed production analysis completed!')
    cy.log('📁 Screenshots saved in: cypress/screenshots/production/detailed-production-check.cy.ts/')
  })
})
