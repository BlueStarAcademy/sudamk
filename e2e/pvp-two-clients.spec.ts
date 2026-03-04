import { test, expect } from '@playwright/test';

test.describe('PVP two clients', () => {
  test('two contexts can load the app concurrently', async ({ page, browser }) => {
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    try {
      await Promise.all([
        page.goto('/'),
        page2.goto('/'),
      ]);
      await expect(page).toHaveTitle(/\S/);
      await expect(page2).toHaveTitle(/\S/);
      await expect(page.locator('body')).toBeVisible();
      await expect(page2.locator('body')).toBeVisible();
    } finally {
      await context2.close();
    }
  });

  test('both clients see the same base document', async ({ page, browser }) => {
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    try {
      await page.goto('/');
      await page2.goto('/');
      const title1 = await page.title();
      const title2 = await page2.title();
      expect(title1).toBe(title2);
    } finally {
      await context2.close();
    }
  });
});
