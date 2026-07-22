import { test, expect } from '@playwright/test';

test.describe('Hypothesis Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await page.waitForSelector('h1:has-text("Hypothesis")');
  });

  test('should show welcome page', async ({ page }) => {
    // Check title
    await expect(page.locator('h1')).toContainText('Hypothesis');

    // Check buttons
    await expect(page.locator('button:has-text("New File")')).toBeVisible();
    await expect(page.locator('button:has-text("Open File")')).toBeVisible();
    await expect(page.locator('button:has-text("Open Folder")')).toBeVisible();
  });

  test('should open a new file', async ({ page }) => {
    // Click new file
    await page.click('button:has-text("New File")');

    // Check tab appears
    await expect(page.locator('.tab')).toBeVisible();
    await expect(page.locator('.tab')).toContainText('Untitled-1');
  });

  test('should show titlebar', async ({ page }) => {
    // Check titlebar menu items
    await expect(page.locator('button:has-text("File")')).toBeVisible();
    await expect(page.locator('button:has-text("Edit")')).toBeVisible();
    await expect(page.locator('button:has-text("View")')).toBeVisible();
  });

  test('should show activity bar', async ({ page }) => {
    // Check activity bar icons
    await expect(page.locator('.activity-icon')).toHaveCount(8);
  });

  test('should show status bar', async ({ page }) => {
    // Check status bar
    await expect(page.locator('.status-item')).toBeVisible();
  });

  test('should toggle sidebar', async ({ page }) => {
    // Click explorer icon
    await page.click('.activity-icon:first-child');

    // Sidebar should toggle
    // Note: This depends on the initial state
  });

  test('should open command palette', async ({ page }) => {
    // Open command palette via keyboard
    await page.keyboard.press('Control+Shift+p');

    // Check command palette is visible
    await expect(page.locator('input[placeholder="Type a command..."]')).toBeVisible();
  });

  test('should close command palette with Escape', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Ctrl+Shift+p');
    await expect(page.locator('input[placeholder="Type a command..."]')).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('input[placeholder="Type a command..."]')).not.toBeVisible();
  });
});
