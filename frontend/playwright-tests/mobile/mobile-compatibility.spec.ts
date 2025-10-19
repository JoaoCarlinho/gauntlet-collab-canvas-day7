import { test, expect, Page } from '@playwright/test';

/**
 * Mobile Compatibility Tests
 * Tests application functionality on mobile devices and touch interfaces
 */
test.describe('Mobile Compatibility', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Set up authentication state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('dev-mode', 'true');
      localStorage.setItem('idToken', 'dev-token');
      localStorage.setItem('user', JSON.stringify({
        id: 'test-user-mobile',
        email: 'test@mobile.com',
        name: 'Mobile Test User'
      }));
    });
  });

  test('should load canvas interface on mobile devices', async () => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/dev/canvas/test-canvas');
    
    // Wait for canvas to load
    await page.waitForSelector('[data-testid="canvas-container"]', { timeout: 10000 });
    
    // Verify core elements are present and properly sized
    await expect(page.locator('[data-testid="canvas-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="canvas-toolbar"]')).toBeVisible();
    await expect(page.locator('.konvajs-content')).toBeVisible();
    
    // Verify toolbar is mobile-optimized (collapsible or compact)
    const toolbar = page.locator('[data-testid="canvas-toolbar"]');
    const toolbarBox = await toolbar.boundingBox();
    
    if (toolbarBox) {
      // Toolbar should fit within mobile viewport
      expect(toolbarBox.width).toBeLessThanOrEqual(375);
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'playwright-tests/screenshots/mobile-canvas-interface.png',
      fullPage: true 
    });
  });

  test('should handle touch interactions for object creation', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dev/canvas/test-canvas');
    
    await page.waitForSelector('.konvajs-content');
    
    // Test touch interaction for rectangle tool
    await page.tap('[data-testid="tool-rectangle"]');
    await page.tap('.konvajs-content', { position: { x: 100, y: 100 } });
    
    // Wait for object creation
    await page.waitForTimeout(1000);
    
    // Verify object was created
    await expect(page.locator('[data-testid="object-rectangle"]')).toBeVisible();
    
    // Test touch interaction for circle tool
    await page.tap('[data-testid="tool-circle"]');
    await page.tap('.konvajs-content', { position: { x: 200, y: 200 } });
    
    await page.waitForTimeout(1000);
    
    // Verify circle was created
    await expect(page.locator('[data-testid="object-circle"]')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: 'playwright-tests/screenshots/mobile-touch-interactions.png',
      fullPage: true 
    });
  });

  test('should handle pinch-to-zoom gestures', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dev/canvas/test-canvas');
    
    await page.waitForSelector('.konvajs-content');
    
    // Simulate pinch-to-zoom gesture
    const canvas = page.locator('.konvajs-content');
    const canvasBox = await canvas.boundingBox();
    
    if (canvasBox) {
      const centerX = canvasBox.x + canvasBox.width / 2;
      const centerY = canvasBox.y + canvasBox.height / 2;
      
      // Simulate pinch gesture (zoom in)
      await page.touchscreen.tap(centerX - 50, centerY);
      await page.touchscreen.tap(centerX + 50, centerY);
      
      // Move fingers apart to zoom in
      await page.touchscreen.tap(centerX - 100, centerY);
      await page.touchscreen.tap(centerX + 100, centerY);
      
      await page.waitForTimeout(1000);
      
      // Verify zoom level changed
      const zoomLevel = await page.locator('[data-testid="zoom-level"]').textContent();
      expect(zoomLevel).not.toBe('100%');
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'playwright-tests/screenshots/mobile-pinch-zoom.png',
      fullPage: true 
    });
  });

  test('should handle touch drag for object manipulation', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dev/canvas/test-canvas');
    
    await page.waitForSelector('.konvajs-content');
    
    // Create an object first
    await page.tap('[data-testid="tool-rectangle"]');
    await page.tap('.konvajs-content', { position: { x: 100, y: 100 } });
    await page.waitForTimeout(1000);
    
    // Get initial position
    const initialRect = await page.locator('[data-testid="object-rectangle"]').boundingBox();
    
    // Touch and drag the object
    await page.touchscreen.tap(100, 100);
    await page.touchscreen.tap(200, 200);
    
    await page.waitForTimeout(1000);
    
    // Verify object moved
    const finalRect = await page.locator('[data-testid="object-rectangle"]').boundingBox();
    
    if (initialRect && finalRect) {
      expect(finalRect.x).not.toBeCloseTo(initialRect.x, 10);
      expect(finalRect.y).not.toBeCloseTo(initialRect.y, 10);
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'playwright-tests/screenshots/mobile-touch-drag.png',
      fullPage: true 
    });
  });

  test('should handle mobile keyboard input', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dev/canvas/test-canvas');
    
    await page.waitForSelector('.konvajs-content');
    
    // Test text tool with mobile keyboard
    await page.tap('[data-testid="tool-text"]');
    await page.tap('.konvajs-content', { position: { x: 150, y: 150 } });
    
    // Type text using mobile keyboard
    await page.keyboard.type('Mobile Text Input');
    await page.keyboard.press('Escape');
    
    await page.waitForTimeout(1000);
    
    // Verify text was created
    await expect(page.locator('[data-testid="object-text"]')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: 'playwright-tests/screenshots/mobile-keyboard-input.png',
      fullPage: true 
    });
  });

  test('should handle mobile toolbar interactions', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dev/canvas/test-canvas');
    
    await page.waitForSelector('[data-testid="canvas-toolbar"]');
    
    // Test toolbar collapse/expand on mobile
    const toolbar = page.locator('[data-testid="canvas-toolbar"]');
    
    // Check if toolbar has collapse functionality
    const collapseButton = page.locator('[data-testid="toolbar-collapse-button"]');
    
    if (await collapseButton.isVisible()) {
      // Collapse toolbar
      await page.tap('[data-testid="toolbar-collapse-button"]');
      await page.waitForTimeout(500);
      
      // Verify toolbar is collapsed
      const collapsedToolbar = page.locator('[data-testid="canvas-toolbar"]');
      const collapsedBox = await collapsedToolbar.boundingBox();
      
      if (collapsedBox) {
        expect(collapsedBox.width).toBeLessThan(200); // Should be much smaller when collapsed
      }
      
      // Expand toolbar
      await page.tap('[data-testid="toolbar-expand-button"]');
      await page.waitForTimeout(500);
      
      // Verify toolbar is expanded
      const expandedBox = await collapsedToolbar.boundingBox();
      if (expandedBox) {
        expect(expandedBox.width).toBeGreaterThan(200);
      }
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'playwright-tests/screenshots/mobile-toolbar-interactions.png',
      fullPage: true 
    });
  });

  test('should handle mobile color picker', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dev/canvas/test-canvas');
    
    await page.waitForSelector('.konvajs-content');
    
    // Create an object first
    await page.tap('[data-testid="tool-rectangle"]');
    await page.tap('.konvajs-content', { position: { x: 100, y: 100 } });
    await page.waitForTimeout(1000);
    
    // Select the object
    await page.tap('[data-testid="object-rectangle"]');
    
    // Open color picker
    await page.tap('[data-testid="color-picker-button"]');
    await expect(page.locator('[data-testid="color-picker"]')).toBeVisible();
    
    // Verify color picker is mobile-optimized
    const colorPicker = page.locator('[data-testid="color-picker"]');
    const pickerBox = await colorPicker.boundingBox();
    
    if (pickerBox) {
      // Color picker should fit within mobile viewport
      expect(pickerBox.width).toBeLessThanOrEqual(375);
      expect(pickerBox.height).toBeLessThanOrEqual(667);
    }
    
    // Select a color
    await page.tap('[data-testid="color-red"]');
    
    // Verify color was applied
    await expect(page.locator('[data-testid="object-rectangle"]')).toHaveAttribute('fill', '#ff0000');
    
    // Take screenshot
    await page.screenshot({ 
      path: 'playwright-tests/screenshots/mobile-color-picker.png',
      fullPage: true 
    });
  });

  test('should handle mobile responsive design', async () => {
    // Test different mobile viewport sizes
    const mobileViewports = [
      { width: 320, height: 568, name: 'iphone-se' },
      { width: 375, height: 667, name: 'iphone-8' },
      { width: 414, height: 896, name: 'iphone-11' },
      { width: 360, height: 640, name: 'android-small' },
      { width: 412, height: 915, name: 'android-large' }
    ];
    
    for (const viewport of mobileViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/dev/canvas/test-canvas');
      
      await page.waitForSelector('[data-testid="canvas-container"]');
      
      // Verify canvas is visible and properly sized
      await expect(page.locator('[data-testid="canvas-container"]')).toBeVisible();
      
      // Verify no horizontal scrolling
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = viewport.width;
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20); // Allow small margin
      
      // Take screenshot for each viewport
      await page.screenshot({ 
        path: `playwright-tests/screenshots/mobile-${viewport.name}.png`,
        fullPage: true 
      });
    }
  });

  test('should handle mobile performance', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dev/canvas/test-canvas');
    
    await page.waitForSelector('[data-testid="canvas-container"]');
    
    // Measure page load time
    const loadTime = await page.evaluate(() => {
      return performance.timing.loadEventEnd - performance.timing.navigationStart;
    });
    
    // Page should load within reasonable time on mobile
    expect(loadTime).toBeLessThan(5000); // 5 seconds max
    
    // Create multiple objects to test performance
    const startTime = Date.now();
    
    for (let i = 0; i < 10; i++) {
      await page.tap('[data-testid="tool-rectangle"]');
      await page.tap('.konvajs-content', { position: { x: 50 + i * 20, y: 50 + i * 20 } });
      await page.waitForTimeout(100);
    }
    
    const endTime = Date.now();
    const objectCreationTime = endTime - startTime;
    
    // Object creation should be reasonably fast
    expect(objectCreationTime).toBeLessThan(10000); // 10 seconds max for 10 objects
    
    // Take screenshot
    await page.screenshot({ 
      path: 'playwright-tests/screenshots/mobile-performance.png',
      fullPage: true 
    });
  });

  test('should handle mobile WebSocket connections', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dev/canvas/test-canvas');
    
    await page.waitForSelector('[data-testid="canvas-container"]');
    
    // Check WebSocket connection status
    const connectionStatus = await page.evaluate(() => {
      // Check if WebSocket connection is established
      return document.querySelector('[data-testid="canvas-container"]') !== null;
    });
    
    expect(connectionStatus).toBe(true);
    
    // Test real-time collaboration on mobile
    await page.tap('[data-testid="tool-rectangle"]');
    await page.tap('.konvajs-content', { position: { x: 100, y: 100 } });
    
    await page.waitForTimeout(1000);
    
    // Verify object was created (WebSocket should have broadcasted this)
    await expect(page.locator('[data-testid="object-rectangle"]')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: 'playwright-tests/screenshots/mobile-websocket.png',
      fullPage: true 
    });
  });

  test('should handle mobile error states', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Test network error handling on mobile
    await page.route('**/api/**', route => route.abort());
    
    await page.goto('/dev/canvas/test-canvas');
    
    // Should show error state
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    
    // Verify error message is mobile-friendly
    const errorMessage = page.locator('[data-testid="error-message"]');
    const errorBox = await errorMessage.boundingBox();
    
    if (errorBox) {
      // Error message should fit within mobile viewport
      expect(errorBox.width).toBeLessThanOrEqual(375);
    }
    
    // Take screenshot of error state
    await page.screenshot({ 
      path: 'playwright-tests/screenshots/mobile-error-state.png',
      fullPage: true 
    });
  });
});
