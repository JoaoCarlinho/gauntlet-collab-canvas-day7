import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'https://collab-canvas-frontend.up.railway.app',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/comprehensive-test-instructions-execution.cy.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true, // Enable video recording
    videoCompression: 32,
    videosFolder: 'cypress/videos/test-instructions',
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots/test-instructions',
    defaultScreenshotOptions: {
      capture: 'fullPage',
      clip: null,
      disableTimersAndAnimations: false
    },
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    pageLoadTimeout: 30000,
    // Environment variables for testing
    env: {
      API_URL: 'https://collab-canvas-frontend.up.railway.app',
      MOCK_AUTH: false,
      MOCK_WEBSOCKET: false,
      PRODUCTION_TESTING: true,
      // Test user credentials for production testing
      TEST_USER_EMAIL: 'test@collabcanvas.com',
      TEST_USER_PASSWORD: 'TestPassword123!',
      TEST_USER_DISPLAY_NAME: 'Test User',
      ENABLE_TEST_AUTH: true
    },
    setupNodeEvents(on, _config) {
      // Add custom tasks for test instructions execution
      on('task', {
        log(message) {
          console.log(`[Test Instructions] ${message}`)
          return null
        },
        // Task to handle console error monitoring
        logConsoleError(error) {
          console.log(`[Console Error] ${error}`)
          return null
        },
        // Task to handle video recording
        startVideoRecording(name) {
          console.log(`[Video] Starting recording: ${name}`)
          return null
        },
        stopVideoRecording() {
          console.log('[Video] Stopping recording')
          return null
        }
      })
    }
  }
})
