import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for CollabCanvas E2E testing
 * Supports cross-browser testing and production environment testing
 */
export default defineConfig({
  testDir: './playwright-tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'playwright-results.json' }],
    ['junit', { outputFile: 'playwright-results.xml' }]
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'edge',
      use: { ...devices['Desktop Edge'] },
    },

    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet browsers
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
    },

    // Production environment testing
    {
      name: 'production-chromium',
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: 'https://gauntlet-collab-canvas-24hr.vercel.app',
      },
    },
    {
      name: 'production-mobile',
      use: { 
        ...devices['Pixel 5'],
        baseURL: 'https://gauntlet-collab-canvas-24hr.vercel.app',
      },
    },
  ],

  // Global setup and teardown
  globalSetup: './playwright-tests/global-setup.ts',
  globalTeardown: './playwright-tests/global-teardown.ts',

  // Web server configuration for local testing
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
