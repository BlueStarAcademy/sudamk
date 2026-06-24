/**
 * E2E: PVP 경기장 진입 (전략·놀이)
 * - 로그인 후 PVP 대기실 UI 로드 확인
 * - 두 클라이언트 동시 로드 (인증 없이 smoke 수준)
 */
import { test as base, expect } from '@playwright/test';
import { test as authTest, expect as authExpect } from './auth.fixture.js';
import { E2E_TEXT, goToAppHashFromStableProfile } from './navigation.helpers.js';

authTest.describe('PVP lobby E2E', () => {
    authTest.setTimeout(120000);

    authTest('strategic PVP lobby loads', async ({ page, authenticatedPage }) => {
        await goToAppHashFromStableProfile(page, '#/pvp/strategic');
        await page.waitForTimeout(2000);
        await authExpect(page.locator('h1').filter({ hasText: E2E_TEXT.strategicPvpArena })).toBeVisible({
            timeout: 20000,
        });
    });

    authTest('playful PVP lobby loads', async ({ page, authenticatedPage }) => {
        await goToAppHashFromStableProfile(page, '#/pvp/playful');
        await page.waitForTimeout(2000);
        await authExpect(page.locator('h1').filter({ hasText: E2E_TEXT.playfulPvpArena })).toBeVisible({
            timeout: 20000,
        });
    });
});

base.describe('PVP two clients (unauthenticated smoke)', () => {
    base('two contexts load concurrently', async ({ page, browser }) => {
        const context2 = await browser.newContext();
        const page2 = await context2.newPage();
        try {
            await Promise.all([page.goto('/'), page2.goto('/')]);
            await expect(page.locator('body')).toBeVisible();
            await expect(page2.locator('body')).toBeVisible();
        } finally {
            await context2.close();
        }
    });
});
