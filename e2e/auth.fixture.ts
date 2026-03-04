import { test as base } from '@playwright/test';

const E2E_USERNAME = process.env.E2E_USERNAME || '푸른별';
const E2E_PASSWORD = process.env.E2E_PASSWORD || '1217';

export const test = base.extend<{ authenticatedPage: void }>({
    authenticatedPage: async ({ page }, use) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        const loginForm = page.locator('#username-login').first();
        const isLoginPage = await loginForm.isVisible().catch(() => false);
        if (isLoginPage) {
            await page.locator('#username-login').fill(E2E_USERNAME);
            await page.locator('#password-login').fill(E2E_PASSWORD);
            await page.locator('form').filter({ has: page.locator('#username-login') }).locator('button[type="submit"]').click();
            await page.waitForURL(/\#\/profile|\#\/set-nickname/, { timeout: 20000 }).catch(() => {});
            await page.waitForTimeout(1500);
            if (page.url().includes('set-nickname')) {
                const nickInput = page.locator('input[type="text"]').first();
                if (await nickInput.isVisible().catch(() => false)) {
                    await nickInput.fill('테스트유저');
                    await page.getByRole('button', { name: /확인|저장|다음/i }).first().click().catch(() => {});
                }
                await page.waitForTimeout(2000);
            }
        }
        await use();
    },
});

export { expect } from '@playwright/test';
