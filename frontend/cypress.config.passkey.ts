import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'https://collab-canvas-frontend.up.railway.app',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/passkey-authenticated-canvas-tests.cy.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true, // Enable video recording
    videoCompression: 32,
    videosFolder: 'cypress/videos/passkey-tests',
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots/passkey-tests',
    defaultScreenshotOptions: {
      capture: 'fullPage',
      clip: null,
      disableTimersAndAnimations: false
    },
    defaultCommandTimeout: 30000, // Increased for passkey authentication
    requestTimeout: 30000,
    responseTimeout: 30000,
    pageLoadTimeout: 60000, // Increased for OAuth flows
    // Environment variables for passkey testing
    env: {
      API_URL: 'https://collab-canvas-frontend.up.railway.app',
      TEST_USER_EMAIL: 'JSkeete@gmail.com', // Your email for passkey authentication
      ENABLE_PASSKEY_AUTH: true,
      PRODUCTION_TESTING: true,
      // WebAuthn configuration
      WEBAUTHN_TIMEOUT: 60000,
      WEBAUTHN_USER_VERIFICATION: 'preferred'
    },
    setupNodeEvents(on, _config) {
      // Add custom tasks for passkey testing
      on('task', {
        log(message) {
          console.log(`[Passkey Test] ${message}`)
          return null
        },
        // Task to handle passkey authentication
        authenticatePasskey(email) {
          console.log(`[Passkey Auth] Authenticating with email: ${email}`)
          return null
        },
        // Task to handle WebAuthn operations
        handleWebAuthn(operation) {
          console.log(`[WebAuthn] ${operation}`)
          return null
        },
        // Task to monitor console errors
        logConsoleError(error) {
          console.log(`[Console Error] ${error}`)
          return null
        }
      })
    }
  }
})
