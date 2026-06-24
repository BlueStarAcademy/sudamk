import { test as base } from '@playwright/test';
import { cleanupAllE2eAccountsActiveGamesViaApi, waitForE2eBackendReady } from './e2e-api.helpers.js';
import { dismissBlockingLiveGameIfNeeded } from './dismissBlockingGame.js';
import { dismissGuideModalIfNeeded } from './navigation.helpers.js';
import {
    E2E_TEST_LOGIN_USERNAME,
    E2E_TEST_DEFAULT_PASSWORD,
} from '../shared/constants/e2eTestAccount.js';

const E2E_USERNAME = process.env.E2E_USERNAME || E2E_TEST_LOGIN_USERNAME;
const E2E_PASSWORD = process.env.E2E_PASSWORD || E2E_TEST_DEFAULT_PASSWORD;

/** 로그인 성공 후 진입 가능한 해시 (APP_HOME_HASH=#/home 포함) */
const POST_LOGIN_URL =
    /\#\/(?:home|profile|set-nickname|game\/|pvp\/|ai\/|singleplayer|tower|guild|tournament|adventure)/;

async function waitForLoginPageOrHome(page: import('@playwright/test').Page): Promise<'login' | 'home'> {
    const deadline = Date.now() + 35000;
    while (Date.now() < deadline) {
        const logoutVisible = await page
            .getByRole('button', { name: /Log out|로그아웃/i })
            .first()
            .isVisible()
            .catch(() => false);
        if (logoutVisible) {
            return 'home';
        }
        const loginVisible = await page.locator('#username-login').first().isVisible().catch(() => false);
        if (loginVisible) {
            return 'login';
        }
        await page.waitForTimeout(400);
    }
    throw new Error('E2E: 로그인 화면 또는 홈 화면을 확인할 수 없습니다.');
}

async function waitForLoginOutcome(page: import('@playwright/test').Page): Promise<void> {
    const loginError = page.locator('form').filter({ has: page.locator('#username-login') }).locator('p.text-red-200');
    await Promise.race([
        page.waitForURL(POST_LOGIN_URL, { timeout: 25000 }),
        loginError.waitFor({ state: 'visible', timeout: 25000 }).then(async () => {
            const message = (await loginError.textContent())?.trim() || '(no message)';
            throw new Error(
                `E2E: 로그인 실패 — ${message}. API/DB가 떠 있는지, E2E_USERNAME/E2E_PASSWORD(${E2E_USERNAME})를 확인하세요.`,
            );
        }),
    ]);
}

export const test = base.extend<{ authenticatedPage: void }>({
    authenticatedPage: async ({ page, request }, use) => {
        await waitForE2eBackendReady(request);
        await cleanupAllE2eAccountsActiveGamesViaApi(request);

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const authState = await waitForLoginPageOrHome(page);
        if (authState === 'login') {
            await page.locator('#username-login').fill(E2E_USERNAME);
            await page.locator('#password-login').fill(E2E_PASSWORD);
            await page.locator('form').filter({ has: page.locator('#username-login') }).locator('button[type="submit"]').click();
            await waitForLoginOutcome(page);
            await dismissGuideModalIfNeeded(page);
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
        const loginStillVisible = await page.locator('#username-login').first().isVisible().catch(() => false);
        if (loginStillVisible) {
            throw new Error(
                'E2E: 로그인에 실패했거나 세션이 없습니다. API/DB가 떠 있는지(Vite 프록시·DATABASE_URL), E2E_USERNAME/E2E_PASSWORD를 확인하세요.',
            );
        }
        await Promise.race([
            dismissBlockingLiveGameIfNeeded(page),
            page.waitForTimeout(8000),
        ]);
        await use();
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    },
});

export { expect } from '@playwright/test';
