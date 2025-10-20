import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'https://gauntlet-collab-canvas-24hr.vercel.app',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots',
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    // Environment variables for testing
    env: {
      API_URL: 'https://gauntlet-collab-canvas-24hr-production.up.railway.app',
      MOCK_AUTH: false,
      MOCK_WEBSOCKET: false
    },
    setupNodeEvents(on, _config) {
      // Minimal setup to avoid issues
      on('task', {
        log(message) {
          console.log(message)
          return null
        }
      })
    }
  }
})

