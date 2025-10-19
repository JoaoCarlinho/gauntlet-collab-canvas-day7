import { test, expect, Page } from '@playwright/test';

/**
 * Canvas Creation Journey Tests
 * Tests the complete canvas creation and management workflow
 */
test.describe('Canvas Creation Journey', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Set up authentication state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('dev-mode', 'true');
      localStorage.setItem('idToken', 'dev-token');
      localStorage.setItem('user', JSON.stringify({
        id: 'test-user-canvas',
        email: 'test@canvas.com',
        name: 'Canvas Test User'
      }));
    });
  });

  test('should create a new canvas successfully', async () => {
    await page.goto('/');
    
    // Navigate to canvas creation
    await page.click('[data-testid="create-canvas-button"]');
    await expect(page.locator('[data-testid="canvas-creation-modal"]')).toBeVisible();
    
    // Fill canvas details
    await page.fill('[data-testid="canvas-name-input"]', 'Test Canvas');
    await page.fill('[data-testid="canvas-description-input"]', 'A test canvas for automated testing');
    
    // Set canvas permissions
    await page.selectOption('[data-testid="canvas-visibility-select"]', 'private');
    
    // Create canvas
    await page.click('[data-testid="create-canvas-submit"]');
    
    // Wait for canvas to be created and redirected
    await page.waitForURL(/\/canvas\/[a-zA-Z0-9-]+/);
    
    // Verify canvas is loaded
    await expect(page.locator('[data-testid="canvas-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="canvas-toolbar"]')).toBeVisible();
    
    // Verify canvas name is displayed
    await expect(page.locator('[data-testid="canvas-title"]')).toContainText('Test Canvas');
  });

  test('should handle canvas creation validation errors', async () => {
    await page.goto('/');
    
    // Navigate to canvas creation
    await page.click('[data-testid="create-canvas-button"]');
    
    // Try to create canvas without name
    await page.click('[data-testid="create-canvas-submit"]');
    
    // Should show validation error
    await expect(page.locator('[data-testid="canvas-name-error"]')).toBeVisible();
    
    // Fill invalid name (too long)
    await page.fill('[data-testid="canvas-name-input"]', 'a'.repeat(101));
    await page.click('[data-testid="create-canvas-submit"]');
    
    // Should show length validation error
    await expect(page.locator('[data-testid="canvas-name-error"]')).toContainText('too long');
  });

  test('should create canvas with different permission levels', async () => {
    await page.goto('/');
    
    // Test public canvas creation
    await page.click('[data-testid="create-canvas-button"]');
    await page.fill('[data-testid="canvas-name-input"]', 'Public Test Canvas');
    await page.selectOption('[data-testid="canvas-visibility-select"]', 'public');
    await page.click('[data-testid="create-canvas-submit"]');
    
    await page.waitForURL(/\/canvas\/[a-zA-Z0-9-]+/);
    
    // Verify public canvas settings
    await expect(page.locator('[data-testid="canvas-visibility-badge"]')).toContainText('Public');
    
    // Go back and create private canvas
    await page.goto('/');
    await page.click('[data-testid="create-canvas-button"]');
    await page.fill('[data-testid="canvas-name-input"]', 'Private Test Canvas');
    await page.selectOption('[data-testid="canvas-visibility-select"]', 'private');
    await page.click('[data-testid="create-canvas-submit"]');
    
    await page.waitForURL(/\/canvas\/[a-zA-Z0-9-]+/);
    
    // Verify private canvas settings
    await expect(page.locator('[data-testid="canvas-visibility-badge"]')).toContainText('Private');
  });

  test('should allow canvas editing and updates', async () => {
    await page.goto('/');
    
    // Create a canvas first
    await page.click('[data-testid="create-canvas-button"]');
    await page.fill('[data-testid="canvas-name-input"]', 'Editable Test Canvas');
    await page.click('[data-testid="create-canvas-submit"]');
    
    await page.waitForURL(/\/canvas\/[a-zA-Z0-9-]+/);
    
    // Open canvas settings
    await page.click('[data-testid="canvas-settings-button"]');
    await expect(page.locator('[data-testid="canvas-settings-modal"]')).toBeVisible();
    
    // Update canvas name
    await page.fill('[data-testid="canvas-name-input"]', 'Updated Canvas Name');
    await page.fill('[data-testid="canvas-description-input"]', 'Updated description');
    
    // Save changes
    await page.click('[data-testid="save-canvas-settings"]');
    
    // Verify changes are saved
    await expect(page.locator('[data-testid="canvas-title"]')).toContainText('Updated Canvas Name');
  });

  test('should handle canvas deletion', async () => {
    await page.goto('/');
    
    // Create a canvas first
    await page.click('[data-testid="create-canvas-button"]');
    await page.fill('[data-testid="canvas-name-input"]', 'Canvas to Delete');
    await page.click('[data-testid="create-canvas-submit"]');
    
    await page.waitForURL(/\/canvas\/[a-zA-Z0-9-]+/);
    
    // Open canvas settings
    await page.click('[data-testid="canvas-settings-button"]');
    
    // Click delete button
    await page.click('[data-testid="delete-canvas-button"]');
    
    // Confirm deletion
    await expect(page.locator('[data-testid="delete-confirmation-modal"]')).toBeVisible();
    await page.click('[data-testid="confirm-delete-button"]');
    
    // Should redirect to dashboard
    await page.waitForURL('/');
    
    // Verify canvas is no longer in the list
    await expect(page.locator('text=Canvas to Delete')).not.toBeVisible();
  });

  test('should support canvas templates', async () => {
    await page.goto('/');
    
    // Navigate to canvas creation
    await page.click('[data-testid="create-canvas-button"]');
    
    // Select a template
    await page.click('[data-testid="template-selector"]');
    await page.click('[data-testid="template-blank"]');
    
    // Fill canvas details
    await page.fill('[data-testid="canvas-name-input"]', 'Template Canvas');
    await page.click('[data-testid="create-canvas-submit"]');
    
    await page.waitForURL(/\/canvas\/[a-zA-Z0-9-]+/);
    
    // Verify canvas is created with template
    await expect(page.locator('[data-testid="canvas-container"]')).toBeVisible();
    
    // Verify template-specific elements are present
    await expect(page.locator('[data-testid="template-indicator"]')).toBeVisible();
  });

  test('should handle canvas creation with AI assistance', async () => {
    await page.goto('/');
    
    // Navigate to canvas creation
    await page.click('[data-testid="create-canvas-button"]');
    
    // Enable AI assistance
    await page.click('[data-testid="ai-assistance-toggle"]');
    
    // Fill basic details
    await page.fill('[data-testid="canvas-name-input"]', 'AI-Assisted Canvas');
    await page.fill('[data-testid="canvas-description-input"]', 'A canvas created with AI assistance');
    
    // Use AI to generate initial content
    await page.click('[data-testid="ai-generate-content"]');
    
    // Wait for AI response
    await page.waitForSelector('[data-testid="ai-content-preview"]', { timeout: 10000 });
    
    // Verify AI content is generated
    await expect(page.locator('[data-testid="ai-content-preview"]')).toBeVisible();
    
    // Create canvas with AI content
    await page.click('[data-testid="create-canvas-submit"]');
    
    await page.waitForURL(/\/canvas\/[a-zA-Z0-9-]+/);
    
    // Verify canvas is created with AI content
    await expect(page.locator('[data-testid="canvas-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="ai-generated-content"]')).toBeVisible();
  });
});
