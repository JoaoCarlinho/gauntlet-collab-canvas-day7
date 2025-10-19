import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * Real-time Collaboration Journey Tests
 * Tests multi-user collaboration features including real-time synchronization
 */
test.describe('Real-time Collaboration Journey', () => {
  let user1Context: BrowserContext;
  let user2Context: BrowserContext;
  let user1Page: Page;
  let user2Page: Page;

  test.beforeEach(async ({ browser }) => {
    // Create two separate browser contexts for multi-user testing
    user1Context = await browser.newContext();
    user2Context = await browser.newContext();
    
    user1Page = await user1Context.newPage();
    user2Page = await user2Context.newPage();
    
    // Set up authentication for both users
    await setupUserAuthentication(user1Page, 'user1');
    await setupUserAuthentication(user2Page, 'user2');
  });

  test.afterEach(async () => {
    await user1Context.close();
    await user2Context.close();
  });

  async function setupUserAuthentication(page: Page, userId: string) {
    await page.goto('/');
    await page.evaluate((id) => {
      localStorage.setItem('dev-mode', 'true');
      localStorage.setItem('idToken', `dev-token-${id}`);
      localStorage.setItem('user', JSON.stringify({
        id: `test-${id}`,
        email: `${id}@collab.com`,
        name: `Test User ${id}`
      }));
    }, userId);
  }

  test('should allow multiple users to join the same canvas', async () => {
    // User 1 creates a canvas
    await user1Page.goto('/');
    await user1Page.click('[data-testid="create-canvas-button"]');
    await user1Page.fill('[data-testid="canvas-name-input"]', 'Collaboration Test Canvas');
    await user1Page.selectOption('[data-testid="canvas-visibility-select"]', 'public');
    await user1Page.click('[data-testid="create-canvas-submit"]');
    
    await user1Page.waitForURL(/\/canvas\/[a-zA-Z0-9-]+/);
    const canvasUrl = user1Page.url();
    
    // User 2 joins the canvas
    await user2Page.goto(canvasUrl);
    
    // Verify both users are on the canvas
    await expect(user1Page.locator('[data-testid="canvas-container"]')).toBeVisible();
    await expect(user2Page.locator('[data-testid="canvas-container"]')).toBeVisible();
    
    // Verify user presence indicators
    await expect(user1Page.locator('[data-testid="user-presence-indicator"]')).toBeVisible();
    await expect(user2Page.locator('[data-testid="user-presence-indicator"]')).toBeVisible();
    
    // Verify both users can see each other's cursors
    await expect(user1Page.locator('[data-testid="user-cursor-user2"]')).toBeVisible();
    await expect(user2Page.locator('[data-testid="user-cursor-user1"]')).toBeVisible();
  });

  test('should synchronize object creation across users', async () => {
    // Both users join the same canvas
    await user1Page.goto('/dev/canvas/test-canvas');
    await user2Page.goto('/dev/canvas/test-canvas');
    
    // Wait for both users to be connected
    await user1Page.waitForSelector('[data-testid="canvas-container"]');
    await user2Page.waitForSelector('[data-testid="canvas-container"]');
    
    // User 1 creates a rectangle
    await user1Page.click('[data-testid="tool-rectangle"]');
    await user1Page.click('.konvajs-content', { position: { x: 100, y: 100 } });
    
    // Wait for synchronization
    await user1Page.waitForTimeout(1000);
    
    // Verify User 2 can see the rectangle
    await expect(user2Page.locator('[data-testid="object-rectangle"]')).toBeVisible();
    
    // User 2 creates a circle
    await user2Page.click('[data-testid="tool-circle"]');
    await user2Page.click('.konvajs-content', { position: { x: 200, y: 200 } });
    
    // Wait for synchronization
    await user2Page.waitForTimeout(1000);
    
    // Verify User 1 can see the circle
    await expect(user1Page.locator('[data-testid="object-circle"]')).toBeVisible();
  });

  test('should synchronize object modifications across users', async () => {
    // Both users join the same canvas
    await user1Page.goto('/dev/canvas/test-canvas');
    await user2Page.goto('/dev/canvas/test-canvas');
    
    await user1Page.waitForSelector('[data-testid="canvas-container"]');
    await user2Page.waitForSelector('[data-testid="canvas-container"]');
    
    // User 1 creates a rectangle
    await user1Page.click('[data-testid="tool-rectangle"]');
    await user1Page.click('.konvajs-content', { position: { x: 100, y: 100 } });
    await user1Page.waitForTimeout(1000);
    
    // User 2 selects and modifies the rectangle
    await user2Page.click('[data-testid="object-rectangle"]');
    await user2Page.dragTo('[data-testid="object-rectangle"]', '.konvajs-content', {
      targetPosition: { x: 300, y: 300 }
    });
    
    // Wait for synchronization
    await user2Page.waitForTimeout(1000);
    
    // Verify User 1 sees the rectangle in its new position
    const rectPosition = await user1Page.locator('[data-testid="object-rectangle"]').boundingBox();
    expect(rectPosition?.x).toBeCloseTo(300, 10);
    expect(rectPosition?.y).toBeCloseTo(300, 10);
  });

  test('should handle concurrent object creation without conflicts', async () => {
    // Both users join the same canvas
    await user1Page.goto('/dev/canvas/test-canvas');
    await user2Page.goto('/dev/canvas/test-canvas');
    
    await user1Page.waitForSelector('[data-testid="canvas-container"]');
    await user2Page.waitForSelector('[data-testid="canvas-container"]');
    
    // Both users create objects simultaneously
    await Promise.all([
      // User 1 creates a rectangle
      user1Page.click('[data-testid="tool-rectangle"]').then(() => 
        user1Page.click('.konvajs-content', { position: { x: 100, y: 100 } })
      ),
      // User 2 creates a circle
      user2Page.click('[data-testid="tool-circle"]').then(() => 
        user2Page.click('.konvajs-content', { position: { x: 200, y: 200 } })
      )
    ]);
    
    // Wait for synchronization
    await user1Page.waitForTimeout(2000);
    await user2Page.waitForTimeout(2000);
    
    // Verify both objects exist on both users' screens
    await expect(user1Page.locator('[data-testid="object-rectangle"]')).toBeVisible();
    await expect(user1Page.locator('[data-testid="object-circle"]')).toBeVisible();
    await expect(user2Page.locator('[data-testid="object-rectangle"]')).toBeVisible();
    await expect(user2Page.locator('[data-testid="object-circle"]')).toBeVisible();
  });

  test('should show real-time cursor positions', async () => {
    // Both users join the same canvas
    await user1Page.goto('/dev/canvas/test-canvas');
    await user2Page.goto('/dev/canvas/test-canvas');
    
    await user1Page.waitForSelector('[data-testid="canvas-container"]');
    await user2Page.waitForSelector('[data-testid="canvas-container"]');
    
    // User 1 moves cursor
    await user1Page.hover('.konvajs-content', { position: { x: 150, y: 150 } });
    
    // Verify User 2 sees User 1's cursor
    await expect(user2Page.locator('[data-testid="user-cursor-user1"]')).toBeVisible();
    
    // User 2 moves cursor
    await user2Page.hover('.konvajs-content', { position: { x: 250, y: 250 } });
    
    // Verify User 1 sees User 2's cursor
    await expect(user1Page.locator('[data-testid="user-cursor-user2"]')).toBeVisible();
  });

  test('should handle user disconnection and reconnection', async () => {
    // Both users join the same canvas
    await user1Page.goto('/dev/canvas/test-canvas');
    await user2Page.goto('/dev/canvas/test-canvas');
    
    await user1Page.waitForSelector('[data-testid="canvas-container"]');
    await user2Page.waitForSelector('[data-testid="canvas-container"]');
    
    // User 1 creates an object
    await user1Page.click('[data-testid="tool-rectangle"]');
    await user1Page.click('.konvajs-content', { position: { x: 100, y: 100 } });
    await user1Page.waitForTimeout(1000);
    
    // User 2 disconnects (simulate network issue)
    await user2Context.close();
    
    // User 1 creates another object
    await user1Page.click('[data-testid="tool-circle"]');
    await user1Page.click('.konvajs-content', { position: { x: 200, y: 200 } });
    await user1Page.waitForTimeout(1000);
    
    // User 2 reconnects
    user2Context = await user1Page.context().browser()!.newContext();
    user2Page = await user2Context.newPage();
    await setupUserAuthentication(user2Page, 'user2');
    await user2Page.goto('/dev/canvas/test-canvas');
    
    // Verify User 2 sees both objects after reconnection
    await user2Page.waitForSelector('[data-testid="canvas-container"]');
    await expect(user2Page.locator('[data-testid="object-rectangle"]')).toBeVisible();
    await expect(user2Page.locator('[data-testid="object-circle"]')).toBeVisible();
  });

  test('should handle canvas permissions and access control', async () => {
    // User 1 creates a private canvas
    await user1Page.goto('/');
    await user1Page.click('[data-testid="create-canvas-button"]');
    await user1Page.fill('[data-testid="canvas-name-input"]', 'Private Collaboration Canvas');
    await user1Page.selectOption('[data-testid="canvas-visibility-select"]', 'private');
    await user1Page.click('[data-testid="create-canvas-submit"]');
    
    await user1Page.waitForURL(/\/canvas\/[a-zA-Z0-9-]+/);
    const privateCanvasUrl = user1Page.url();
    
    // User 2 tries to access the private canvas
    await user2Page.goto(privateCanvasUrl);
    
    // Should show access denied or redirect to login
    await expect(user2Page.locator('[data-testid="access-denied"]')).toBeVisible();
    
    // User 1 invites User 2
    await user1Page.click('[data-testid="invite-users-button"]');
    await user1Page.fill('[data-testid="invite-email-input"]', 'user2@collab.com');
    await user1Page.selectOption('[data-testid="invite-permission-select"]', 'edit');
    await user1Page.click('[data-testid="send-invitation-button"]');
    
    // User 2 should now be able to access the canvas
    await user2Page.goto(privateCanvasUrl);
    await expect(user2Page.locator('[data-testid="canvas-container"]')).toBeVisible();
  });
});
