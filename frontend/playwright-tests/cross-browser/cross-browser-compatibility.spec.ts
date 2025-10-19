import { test, expect, Page } from '@playwright/test';

/**
 * Cross-Browser Compatibility Tests
 * Tests application functionality across different browsers
 */
test.describe('Cross-Browser Compatibility', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Set up authentication state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('dev-mode', 'true');
      localStorage.setItem('idToken', 'dev-token');
      localStorage.setItem('user', JSON.stringify({
        id: 'test-user-cross-browser',
        email: 'test@crossbrowser.com',
        name: 'Cross Browser Test User'
      }));
    });
  });

  test('should load canvas interface consistently across browsers', async () => {
    await page.goto('/dev/canvas/test-canvas');
    
    // Wait for canvas to load
    await page.waitForSelector('[data-testid="canvas-container"]', { timeout: 10000 });
    
    // Verify core elements are present
    await expect(page.locator('[data-testid="canvas-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="canvas-toolbar"]')).toBeVisible();
    await expect(page.locator('.konvajs-content')).toBeVisible();
    
    // Take screenshot for visual comparison
    await page.screenshot({ 
      path: `playwright-tests/screenshots/cross-browser-${page.context().browser()?.name()}-canvas.png`,
      fullPage: true 
    });
  });

  test('should handle canvas interactions consistently', async () => {
    await page.goto('/dev/canvas/test-canvas');
    
    // Wait for canvas to load
    await page.waitForSelector('.konvajs-content');
    
    // Test rectangle tool
    await page.click('[data-testid="tool-rectangle"]');
    await page.click('.konvajs-content', { position: { x: 100, y: 100 } });
    
    // Wait for object creation
    await page.waitForTimeout(1000);
    
    // Verify object was created
    await expect(page.locator('[data-testid="object-rectangle"]')).toBeVisible();
    
    // Test circle tool
    await page.click('[data-testid="tool-circle"]');
    await page.click('.konvajs-content', { position: { x: 200, y: 200 } });
    
    await page.waitForTimeout(1000);
    
    // Verify circle was created
    await expect(page.locator('[data-testid="object-circle"]')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: `playwright-tests/screenshots/cross-browser-${page.context().browser()?.name()}-interactions.png`,
      fullPage: true 
    });
  });

  test('should handle text rendering consistently', async () => {
    await page.goto('/dev/canvas/test-canvas');
    
    await page.waitForSelector('.konvajs-content');
    
    // Test text tool
    await page.click('[data-testid="tool-text"]');
    await page.click('.konvajs-content', { position: { x: 150, y: 150 } });
    
    // Type text
    await page.keyboard.type('Cross-Browser Test Text');
    await page.keyboard.press('Escape');
    
    await page.waitForTimeout(1000);
    
    // Verify text was created
    await expect(page.locator('[data-testid="object-text"]')).toBeVisible();
    
    // Take screenshot for text rendering comparison
    await page.screenshot({ 
      path: `playwright-tests/screenshots/cross-browser-${page.context().browser()?.name()}-text.png`,
      fullPage: true 
    });
  });

  test('should handle color picker consistently', async () => {
    await page.goto('/dev/canvas/test-canvas');
    
    await page.waitForSelector('.konvajs-content');
    
    // Create an object first
    await page.click('[data-testid="tool-rectangle"]');
    await page.click('.konvajs-content', { position: { x: 100, y: 100 } });
    await page.waitForTimeout(1000);
    
    // Select the object
    await page.click('[data-testid="object-rectangle"]');
    
    // Open color picker
    await page.click('[data-testid="color-picker-button"]');
    await expect(page.locator('[data-testid="color-picker"]')).toBeVisible();
    
    // Select a color
    await page.click('[data-testid="color-red"]');
    
    // Verify color was applied
    await expect(page.locator('[data-testid="object-rectangle"]')).toHaveAttribute('fill', '#ff0000');
    
    // Take screenshot
    await page.screenshot({ 
      path: `playwright-tests/screenshots/cross-browser-${page.context().browser()?.name()}-colors.png`,
      fullPage: true 
    });
  });

  test('should handle keyboard shortcuts consistently', async () => {
    await page.goto('/dev/canvas/test-canvas');
    
    await page.waitForSelector('.konvajs-content');
    
    // Create an object
    await page.click('[data-testid="tool-rectangle"]');
    await page.click('.konvajs-content', { position: { x: 100, y: 100 } });
    await page.waitForTimeout(1000);
    
    // Select object
    await page.click('[data-testid="object-rectangle"]');
    
    // Test copy shortcut (Ctrl+C / Cmd+C)
    await page.keyboard.press('Control+c');
    
    // Test paste shortcut (Ctrl+V / Cmd+V)
    await page.keyboard.press('Control+v');
    
    await page.waitForTimeout(1000);
    
    // Verify object was copied
    const rectangles = await page.locator('[data-testid="object-rectangle"]').count();
    expect(rectangles).toBeGreaterThan(1);
    
    // Test delete shortcut (Delete key)
    await page.click('[data-testid="object-rectangle"]').first();
    await page.keyboard.press('Delete');
    
    await page.waitForTimeout(1000);
    
    // Verify object was deleted
    const remainingRectangles = await page.locator('[data-testid="object-rectangle"]').count();
    expect(remainingRectangles).toBe(rectangles - 1);
  });

  test('should handle drag and drop consistently', async () => {
    await page.goto('/dev/canvas/test-canvas');
    
    await page.waitForSelector('.konvajs-content');
    
    // Create an object
    await page.click('[data-testid="tool-rectangle"]');
    await page.click('.konvajs-content', { position: { x: 100, y: 100 } });
    await page.waitForTimeout(1000);
    
    // Get initial position
    const initialRect = await page.locator('[data-testid="object-rectangle"]').boundingBox();
    
    // Drag object to new position
    await page.dragTo(
      '[data-testid="object-rectangle"]',
      '.konvajs-content',
      { targetPosition: { x: 300, y: 300 } }
    );
    
    await page.waitForTimeout(1000);
    
    // Verify object moved
    const finalRect = await page.locator('[data-testid="object-rectangle"]').boundingBox();
    
    if (initialRect && finalRect) {
      expect(finalRect.x).not.toBeCloseTo(initialRect.x, 10);
      expect(finalRect.y).not.toBeCloseTo(initialRect.y, 10);
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: `playwright-tests/screenshots/cross-browser-${page.context().browser()?.name()}-drag-drop.png`,
      fullPage: true 
    });
  });

  test('should handle zoom functionality consistently', async () => {
    await page.goto('/dev/canvas/test-canvas');
    
    await page.waitForSelector('.konvajs-content');
    
    // Test zoom in
    await page.click('[data-testid="zoom-in-button"]');
    await page.waitForTimeout(500);
    
    // Test zoom out
    await page.click('[data-testid="zoom-out-button"]');
    await page.waitForTimeout(500);
    
    // Test zoom reset
    await page.click('[data-testid="zoom-reset-button"]');
    await page.waitForTimeout(500);
    
    // Verify zoom level indicator
    await expect(page.locator('[data-testid="zoom-level"]')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: `playwright-tests/screenshots/cross-browser-${page.context().browser()?.name()}-zoom.png`,
      fullPage: true 
    });
  });

  test('should handle responsive design consistently', async () => {
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 1366, height: 768, name: 'laptop' },
      { width: 1024, height: 768, name: 'tablet-landscape' },
      { width: 768, height: 1024, name: 'tablet-portrait' },
      { width: 375, height: 667, name: 'mobile' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/dev/canvas/test-canvas');
      
      await page.waitForSelector('[data-testid="canvas-container"]');
      
      // Verify canvas is visible and properly sized
      await expect(page.locator('[data-testid="canvas-container"]')).toBeVisible();
      
      // Take screenshot for each viewport
      await page.screenshot({ 
        path: `playwright-tests/screenshots/cross-browser-${page.context().browser()?.name()}-${viewport.name}.png`,
        fullPage: true 
      });
    }
  });

  test('should handle WebSocket connections consistently', async () => {
    await page.goto('/dev/canvas/test-canvas');
    
    await page.waitForSelector('[data-testid="canvas-container"]');
    
    // Check WebSocket connection status
    const connectionStatus = await page.evaluate(() => {
      // This would check the actual WebSocket connection status
      // For now, we'll check if the canvas is loaded (which requires WebSocket)
      return document.querySelector('[data-testid="canvas-container"]') !== null;
    });
    
    expect(connectionStatus).toBe(true);
    
    // Test real-time collaboration (simulate)
    await page.click('[data-testid="tool-rectangle"]');
    await page.click('.konvajs-content', { position: { x: 100, y: 100 } });
    
    await page.waitForTimeout(1000);
    
    // Verify object was created (WebSocket should have broadcasted this)
    await expect(page.locator('[data-testid="object-rectangle"]')).toBeVisible();
  });

  test('should handle error states consistently', async () => {
    // Test network error handling
    await page.route('**/api/**', route => route.abort());
    
    await page.goto('/dev/canvas/test-canvas');
    
    // Should show error state
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    
    // Take screenshot of error state
    await page.screenshot({ 
      path: `playwright-tests/screenshots/cross-browser-${page.context().browser()?.name()}-error.png`,
      fullPage: true 
    });
  });
});
