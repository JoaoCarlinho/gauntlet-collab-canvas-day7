import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'https://collab-canvas-frontend.up.railway.app',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots/railway',
    videosFolder: 'cypress/videos/railway',
    defaultScreenshotOptions: {
      capture: 'fullPage',
      clip: null,
      disableTimersAndAnimations: false
    },
    defaultCommandTimeout: 20000,
    requestTimeout: 20000,
    responseTimeout: 20000,
    pageLoadTimeout: 30000,
    // Environment variables for Railway testing
    env: {
      API_URL: 'https://gauntlet-collab-canvas-day7-production.up.railway.app',
      MOCK_AUTH: false,
      MOCK_WEBSOCKET: false,
      RAILWAY_TESTING: true,
      // Test user credentials for Railway testing
      TEST_USER_EMAIL: 'test@collabcanvas.com',
      TEST_USER_PASSWORD: 'TestPassword123!',
      TEST_USER_DISPLAY_NAME: 'Test User',
      ENABLE_TEST_AUTH: true
    },
    setupNodeEvents(on, _config) {
      // Add custom tasks for Railway testing
      on('task', {
        log(message) {
          console.log(`[Railway Test] ${message}`)
          return null
        },
        // Task to handle Railway-specific operations
        railwayAuth() {
          console.log('Railway authentication required')
          return null
        }
      })
    }
  }
})
