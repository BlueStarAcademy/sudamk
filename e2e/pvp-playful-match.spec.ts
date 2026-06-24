/**
 * E2E: 놀이바둑(오목) PVP — API 협상 후 양 클라이언트 게임 진입
 */
import { test, expect } from '@playwright/test';
import {
    cleanupAllE2eAccountsActiveGamesViaApi,
    startOmokPvpGameViaApi,
    startDicePvpGameViaApi,
    confirmColorStartViaApi,
    navigateToGameHash,
} from './e2e-api.helpers.js';
import {
    E2E_USER_A,
    E2E_USER_B,
    E2E_SHARED_PASSWORD,
    loginPage,
} from './two-client.helpers.js';
import { goToAppHashFromStableProfile } from './navigation.helpers.js';
import { leaveActiveGameQuick } from './dismissBlockingGame.js';

test.describe('PVP playful E2E', () => {
    test.setTimeout(240000);

    test.beforeEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test.afterEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test('Omok PVP: two clients enter game after negotiation', async ({ browser, request }) => {
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        try {
            await loginPage(pageA, E2E_USER_A, E2E_SHARED_PASSWORD, request);
            await loginPage(pageB, E2E_USER_B, E2E_SHARED_PASSWORD, request);

            await goToAppHashFromStableProfile(pageA, '#/pvp/playful');
            await goToAppHashFromStableProfile(pageB, '#/pvp/playful');

            const { gameId, challengerId, opponentId } = await startOmokPvpGameViaApi(
                request,
                E2E_USER_A,
                E2E_USER_B,
                E2E_SHARED_PASSWORD,
            );

            await Promise.all([
                navigateToGameHash(pageA, gameId),
                navigateToGameHash(pageB, gameId),
            ]);

            await confirmColorStartViaApi(request, challengerId, gameId);
            await confirmColorStartViaApi(request, opponentId, gameId);
            await pageA.waitForTimeout(2000);

            const board = pageA.locator('canvas, [class*="board"], svg').first();
            await expect(board).toBeVisible({ timeout: 20000 });
            await expect(pageB.locator('canvas, [class*="board"], svg').first()).toBeVisible({
                timeout: 20000,
            });

            await leaveActiveGameQuick(pageA);
            await leaveActiveGameQuick(pageB);
        } finally {
            await contextA.close();
            await contextB.close();
        }
    });

    test('Dice PVP: two clients enter game after negotiation', async ({ browser, request }) => {
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        try {
            await loginPage(pageA, E2E_USER_A, E2E_SHARED_PASSWORD, request);
            await loginPage(pageB, E2E_USER_B, E2E_SHARED_PASSWORD, request);

            await goToAppHashFromStableProfile(pageA, '#/pvp/playful');
            await goToAppHashFromStableProfile(pageB, '#/pvp/playful');

            const { gameId } = await startDicePvpGameViaApi(
                request,
                E2E_USER_A,
                E2E_USER_B,
                E2E_SHARED_PASSWORD,
            );

            await navigateToGameHash(pageA, gameId);
            await navigateToGameHash(pageB, gameId);
            await pageA.waitForTimeout(2000);

            await expect(pageA.getByRole('button', { name: /준비|Ready/i }).first()).toBeVisible({
                timeout: 30000,
            });
            await expect(pageB.getByRole('button', { name: /준비|Ready/i }).first()).toBeVisible({
                timeout: 30000,
            });

            const board = pageA.locator('canvas, [class*="board"], svg').first();
            await expect(board).toBeVisible({ timeout: 20000 });

            await leaveActiveGameQuick(pageA);
            await leaveActiveGameQuick(pageB);
        } finally {
            await contextA.close();
            await contextB.close();
        }
    });
});
