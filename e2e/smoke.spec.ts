import { test, expect } from '@playwright/test';

test.describe('smoke', { tag: '@smoke' }, () => {
  test('app loads', async ({ page }) => {
    // Avoid waiting for long-lived WS/networkidle; CI only needs the document.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/\S/);
  });
});
