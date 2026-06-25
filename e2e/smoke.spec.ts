import { test, expect } from '@playwright/test';

test.describe('smoke', { tag: '@smoke' }, () => {
  test('app loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/\S/);
  });
});
