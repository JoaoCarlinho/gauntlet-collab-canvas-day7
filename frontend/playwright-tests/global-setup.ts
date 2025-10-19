import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for Playwright tests
 * Handles authentication and environment preparation
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for Playwright tests...');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Set up test environment variables
    process.env.TEST_MODE = 'true';
    process.env.PLAYWRIGHT_TESTING = 'true';
    
    // Check if we're testing against production
    const isProduction = config.projects?.some(project => 
      project.name.includes('production')
    );
    
    if (isProduction) {
      console.log('🔒 Production testing mode detected');
      process.env.PRODUCTION_TESTING = 'true';
      
      // Verify production endpoints are accessible
      const frontendUrl = 'https://gauntlet-collab-canvas-24hr.vercel.app';
      const backendUrl = 'https://gauntlet-collab-canvas-24hr-production.up.railway.app';
      
      try {
        await page.goto(frontendUrl, { timeout: 30000 });
        console.log('✅ Frontend accessible');
        
        const response = await page.request.get(`${backendUrl}/health`);
        if (response.ok()) {
          console.log('✅ Backend health check passed');
        } else {
          throw new Error(`Backend health check failed: ${response.status()}`);
        }
      } catch (error) {
        console.error('❌ Production environment check failed:', error);
        throw error;
      }
    } else {
      console.log('🏠 Local testing mode');
      process.env.LOCAL_TESTING = 'true';
    }
    
    // Set up authentication state if needed
    await setupAuthenticationState(page, isProduction);
    
    console.log('✅ Global setup completed successfully');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Set up authentication state for tests
 */
async function setupAuthenticationState(page: any, isProduction: boolean) {
  if (isProduction) {
    // For production tests, we'll use passkey authentication
    console.log('🔐 Setting up production authentication state...');
    
    // Store authentication state for reuse across tests
    await page.context().storageState({ 
      path: 'playwright-tests/auth-state.json' 
    });
  } else {
    // For local tests, use dev mode authentication
    console.log('🔧 Setting up local dev authentication state...');
    
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
      localStorage.setItem('dev-mode', 'true');
      localStorage.setItem('idToken', 'dev-token');
      localStorage.setItem('user', JSON.stringify({
        id: 'test-user-playwright',
        email: 'test@playwright.com',
        name: 'Playwright Test User'
      }));
    });
    
    await page.context().storageState({ 
      path: 'playwright-tests/auth-state.json' 
    });
  }
}

export default globalSetup;
