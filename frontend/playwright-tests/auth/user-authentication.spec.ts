import { test, expect, Page } from '@playwright/test';

/**
 * User Authentication Journey Tests
 * Tests the complete authentication flow including passkey registration and login
 */
test.describe('User Authentication Journey', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Set up authentication state for local testing
    if (process.env.LOCAL_TESTING) {
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('dev-mode', 'true');
        localStorage.setItem('idToken', 'dev-token');
        localStorage.setItem('user', JSON.stringify({
          id: 'test-user-auth',
          email: 'test@auth.com',
          name: 'Auth Test User'
        }));
      });
    }
  });

  test('should complete user registration flow', async () => {
    await page.goto('/login');
    
    // Check if user is already authenticated
    const isAuthenticated = await page.evaluate(() => {
      return localStorage.getItem('idToken') !== null;
    });
    
    if (!isAuthenticated) {
      // Test registration flow
      await page.click('[data-testid="sign-up-button"]');
      await expect(page.locator('[data-testid="registration-form"]')).toBeVisible();
      
      // Fill registration form
      await page.fill('[data-testid="email-input"]', 'newuser@test.com');
      await page.fill('[data-testid="name-input"]', 'New Test User');
      
      // Test passkey registration
      await page.click('[data-testid="register-passkey-button"]');
      
      // Wait for passkey prompt (in real browser, this would show system dialog)
      await page.waitForTimeout(2000);
      
      // Verify registration success
      await expect(page.locator('[data-testid="registration-success"]')).toBeVisible();
    }
  });

  test('should complete user login flow', async () => {
    await page.goto('/login');
    
    // Test login flow
    await page.click('[data-testid="sign-in-button"]');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    
    // Fill login form
    await page.fill('[data-testid="email-input"]', 'test@auth.com');
    
    // Test passkey login
    await page.click('[data-testid="login-passkey-button"]');
    
    // Wait for passkey prompt
    await page.waitForTimeout(2000);
    
    // Verify login success
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Verify user data is stored
    const userData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('user') || '{}');
    });
    
    expect(userData.email).toBe('test@auth.com');
  });

  test('should handle authentication errors gracefully', async () => {
    await page.goto('/login');
    
    // Test invalid email
    await page.click('[data-testid="sign-in-button"]');
    await page.fill('[data-testid="email-input"]', 'invalid-email');
    await page.click('[data-testid="login-passkey-button"]');
    
    // Should show validation error
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    
    // Test network error simulation
    await page.route('**/auth/**', route => route.abort());
    await page.fill('[data-testid="email-input"]', 'test@auth.com');
    await page.click('[data-testid="login-passkey-button"]');
    
    // Should show network error
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
  });

  test('should maintain authentication state across page reloads', async () => {
    await page.goto('/');
    
    // Verify user is authenticated
    const isAuthenticated = await page.evaluate(() => {
      return localStorage.getItem('idToken') !== null;
    });
    
    expect(isAuthenticated).toBe(true);
    
    // Reload page
    await page.reload();
    
    // Verify authentication state is maintained
    const userData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('user') || '{}');
    });
    
    expect(userData.id).toBeDefined();
    expect(userData.email).toBeDefined();
  });

  test('should handle session expiration', async () => {
    await page.goto('/');
    
    // Simulate expired token
    await page.evaluate(() => {
      localStorage.setItem('idToken', 'expired-token');
      localStorage.setItem('tokenExpiry', (Date.now() - 1000).toString());
    });
    
    // Try to access protected route
    await page.goto('/canvas');
    
    // Should redirect to login
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    
    // Should clear expired tokens
    const token = await page.evaluate(() => {
      return localStorage.getItem('idToken');
    });
    
    expect(token).toBeNull();
  });

  test('should support logout functionality', async () => {
    await page.goto('/');
    
    // Verify user is authenticated
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Click logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // Verify logout success
    await expect(page.locator('[data-testid="sign-in-button"]')).toBeVisible();
    
    // Verify tokens are cleared
    const token = await page.evaluate(() => {
      return localStorage.getItem('idToken');
    });
    
    expect(token).toBeNull();
  });
});
