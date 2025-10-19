/// <reference types="cypress" />

describe('Production Page Source Check', () => {
  const productionUrl = 'https://gauntlet-collab-canvas-day7.vercel.app'

  it('Should check if email/password components are in the production build', () => {
    cy.visit(productionUrl)
    cy.wait(3000)
    
    // Get the page source and check for email/password related content
    cy.get('body').then(($body) => {
      const bodyText = $body.text().toLowerCase()
      const bodyHTML = $body.html()
      
      cy.log('=== PAGE CONTENT ANALYSIS ===')
      cy.log('Body text length:', bodyText.length)
      cy.log('Body HTML length:', bodyHTML.length)
      
      // Check for specific text content
      const hasEmail = bodyText.includes('email')
      const hasPassword = bodyText.includes('password')
      const hasGoogle = bodyText.includes('google')
      const hasSignIn = bodyText.includes('sign in')
      
      cy.log('Contains "email":', hasEmail)
      cy.log('Contains "password":', hasPassword)
      cy.log('Contains "google":', hasGoogle)
      cy.log('Contains "sign in":', hasSignIn)
      
      // Check for specific HTML elements
      const emailInputs = $body.find('input[type="email"]').length
      const passwordInputs = $body.find('input[type="password"]').length
      const buttons = $body.find('button').length
      
      cy.log('Email input fields found:', emailInputs)
      cy.log('Password input fields found:', passwordInputs)
      cy.log('Total buttons found:', buttons)
      
      // Check for specific class names or data attributes
      const emailClasses = bodyHTML.includes('email') || bodyHTML.includes('Email')
      const passwordClasses = bodyHTML.includes('password') || bodyHTML.includes('Password')
      
      cy.log('HTML contains email-related classes:', emailClasses)
      cy.log('HTML contains password-related classes:', passwordClasses)
      
      // Take screenshot for visual verification
      cy.screenshot('production-page-source-check', {
        capture: 'fullPage',
        overwrite: true
      })
      
      // Log first 1000 characters of body text for debugging
      cy.log('First 1000 characters of body text:', bodyText.substring(0, 1000))
      
      // Check if we can find any authentication method selector
      const authMethodElements = $body.find('[class*="auth"], [class*="method"], [class*="selector"]')
      cy.log('Authentication method elements found:', authMethodElements.length)
      
      if (authMethodElements.length > 0) {
        authMethodElements.each((index, element) => {
          cy.log(`Auth element ${index}:`, element.className, element.textContent?.substring(0, 100))
        })
      }
    })
    
    cy.log('📸 Screenshot saved: production-page-source-check.png')
  })

  it('Should check the actual DOM structure for email/password elements', () => {
    cy.visit(productionUrl)
    cy.wait(3000)
    
    // Check for specific React component patterns
    cy.get('body').then(($body) => {
      // Look for any divs that might contain authentication forms
      const authDivs = $body.find('div').filter((index, div) => {
        const text = div.textContent?.toLowerCase() || ''
        return text.includes('sign') || text.includes('login') || text.includes('auth')
      })
      
      cy.log('Authentication-related divs found:', authDivs.length)
      
      authDivs.each((index, div) => {
        cy.log(`Auth div ${index}:`, div.textContent?.substring(0, 200))
      })
      
      // Check for any forms
      const forms = $body.find('form')
      cy.log('Forms found:', forms.length)
      
      forms.each((index, form) => {
        cy.log(`Form ${index}:`, form.innerHTML.substring(0, 500))
      })
      
      // Check for any input elements
      const inputs = $body.find('input')
      cy.log('Input elements found:', inputs.length)
      
      inputs.each((index, input) => {
        cy.log(`Input ${index}:`, {
          type: input.type,
          placeholder: input.placeholder,
          name: input.name,
          className: input.className
        })
      })
    })
    
    cy.screenshot('production-dom-structure-check', {
      capture: 'fullPage',
      overwrite: true
    })
  })

  after(() => {
    cy.log('🔍 Production page source analysis completed!')
    cy.log('📁 Screenshots saved in: cypress/screenshots/production/production-page-source-check.cy.ts/')
  })
})
