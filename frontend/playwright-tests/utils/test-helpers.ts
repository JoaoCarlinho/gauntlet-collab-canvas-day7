/**
 * Test Helper Utilities
 * Common utilities and helper functions for Playwright tests
 */

import { Page, expect } from '@playwright/test';

export class TestHelpers {
  /**
   * Set up authentication state for tests
   */
  static async setupAuthentication(page: Page, userId: string = 'test-user') {
    await page.goto('/');
    await page.evaluate((id) => {
      localStorage.setItem('dev-mode', 'true');
      localStorage.setItem('idToken', `dev-token-${id}`);
      localStorage.setItem('user', JSON.stringify({
        id: `test-${id}`,
        email: `${id}@test.com`,
        name: `Test User ${id}`
      }));
    }, userId);
  }

  /**
   * Wait for canvas to be fully loaded
   */
  static async waitForCanvasLoad(page: Page, timeout: number = 10000) {
    await page.waitForSelector('[data-testid="canvas-container"]', { timeout });
    await page.waitForSelector('.konvajs-content', { timeout });
    
    // Wait for WebSocket connection
    await page.waitForTimeout(1000);
  }

  /**
   * Create a test object on the canvas
   */
  static async createTestObject(page: Page, objectType: string, x: number = 100, y: number = 100) {
    await page.click(`[data-testid="tool-${objectType}"]`);
    await page.click('.konvajs-content', { position: { x, y } });
    await page.waitForTimeout(1000);
    
    // Verify object was created
    await expect(page.locator(`[data-testid="object-${objectType}"]`)).toBeVisible();
  }

  /**
   * Take a screenshot with consistent naming
   */
  static async takeScreenshot(page: Page, name: string, fullPage: boolean = true) {
    const browserName = page.context().browser()?.name() || 'unknown';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `playwright-tests/screenshots/${browserName}-${name}-${timestamp}.png`;
    
    await page.screenshot({ path: filename, fullPage });
    return filename;
  }

  /**
   * Simulate network conditions
   */
  static async simulateNetworkConditions(page: Page, condition: 'slow' | 'offline' | 'fast') {
    switch (condition) {
      case 'slow':
        await page.route('**/*', route => {
          setTimeout(() => route.continue(), 1000);
        });
        break;
      case 'offline':
        await page.route('**/*', route => route.abort());
        break;
      case 'fast':
        // No additional delay
        break;
    }
  }

  /**
   * Measure performance metrics
   */
  static async measurePerformance(page: Page) {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      return {
        loadTime: navigation.loadEventEnd - navigation.navigationStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
      };
    });
    
    return metrics;
  }

  /**
   * Wait for WebSocket connection
   */
  static async waitForWebSocketConnection(page: Page, timeout: number = 5000) {
    await page.waitForFunction(() => {
      // Check if WebSocket connection is established
      return window.socket && window.socket.connected;
    }, { timeout });
  }

  /**
   * Generate test data
   */
  static generateTestData(type: 'canvas' | 'user' | 'object') {
    const timestamp = Date.now();
    
    switch (type) {
      case 'canvas':
        return {
          name: `Test Canvas ${timestamp}`,
          description: `A test canvas created at ${new Date().toISOString()}`,
          visibility: 'private'
        };
      case 'user':
        return {
          email: `test-${timestamp}@example.com`,
          name: `Test User ${timestamp}`,
          firebase_uid: `firebase-uid-${timestamp}`
        };
      case 'object':
        return {
          object_type: 'rectangle',
          properties: {
            x: Math.floor(Math.random() * 400) + 50,
            y: Math.floor(Math.random() * 300) + 50,
            width: 100,
            height: 80,
            fill: `#${Math.floor(Math.random() * 16777215).toString(16)}`
          }
        };
      default:
        return {};
    }
  }

  /**
   * Clean up test data
   */
  static async cleanupTestData(page: Page) {
    // Clear localStorage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Clear any test artifacts
    await page.evaluate(() => {
      // Remove any test elements from DOM
      const testElements = document.querySelectorAll('[data-testid*="test-"]');
      testElements.forEach(el => el.remove());
    });
  }

  /**
   * Assert performance thresholds
   */
  static assertPerformanceThresholds(metrics: any) {
    expect(metrics.loadTime).toBeLessThan(3000); // 3 seconds
    expect(metrics.domContentLoaded).toBeLessThan(2000); // 2 seconds
    expect(metrics.firstPaint).toBeLessThan(1500); // 1.5 seconds
    expect(metrics.firstContentfulPaint).toBeLessThan(2000); // 2 seconds
  }

  /**
   * Wait for element to be stable (no animations)
   */
  static async waitForStableElement(page: Page, selector: string, timeout: number = 5000) {
    await page.waitForSelector(selector, { timeout });
    
    // Wait for any animations to complete
    await page.waitForFunction(
      (sel) => {
        const element = document.querySelector(sel);
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        return style.animationPlayState === 'paused' || 
               style.animationDuration === '0s' ||
               style.transitionDuration === '0s';
      },
      selector,
      { timeout }
    );
  }

  /**
   * Simulate user interaction delay
   */
  static async simulateUserDelay(page: Page, min: number = 100, max: number = 500) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await page.waitForTimeout(delay);
  }

  /**
   * Check accessibility compliance
   */
  static async checkAccessibility(page: Page) {
    // Check for basic accessibility features
    const accessibilityChecks = await page.evaluate(() => {
      const results = {
        hasAltText: 0,
        hasLabels: 0,
        hasHeadings: 0,
        hasFocusableElements: 0,
        totalImages: 0,
        totalInputs: 0,
        totalHeadings: 0,
        totalButtons: 0
      };
      
      // Check images for alt text
      const images = document.querySelectorAll('img');
      results.totalImages = images.length;
      images.forEach(img => {
        if (img.alt && img.alt.trim() !== '') {
          results.hasAltText++;
        }
      });
      
      // Check inputs for labels
      const inputs = document.querySelectorAll('input, textarea, select');
      results.totalInputs = inputs.length;
      inputs.forEach(input => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label || input.getAttribute('aria-label')) {
          results.hasLabels++;
        }
      });
      
      // Check for headings
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      results.totalHeadings = headings.length;
      results.hasHeadings = headings.length;
      
      // Check for focusable elements
      const buttons = document.querySelectorAll('button, [role="button"]');
      results.totalButtons = buttons.length;
      results.hasFocusableElements = buttons.length;
      
      return results;
    });
    
    return accessibilityChecks;
  }

  /**
   * Assert accessibility compliance
   */
  static assertAccessibilityCompliance(checks: any) {
    if (checks.totalImages > 0) {
      expect(checks.hasAltText / checks.totalImages).toBeGreaterThan(0.8); // 80% of images should have alt text
    }
    
    if (checks.totalInputs > 0) {
      expect(checks.hasLabels / checks.totalInputs).toBeGreaterThan(0.9); // 90% of inputs should have labels
    }
    
    expect(checks.hasHeadings).toBeGreaterThan(0); // Should have at least one heading
    expect(checks.hasFocusableElements).toBeGreaterThan(0); // Should have focusable elements
  }
}
