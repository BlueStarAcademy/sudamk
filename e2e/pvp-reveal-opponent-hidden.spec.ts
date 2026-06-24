/**
 * E2E: PVP 상대 히든돌 클릭(REVEAL_OPPONENT_HIDDEN) — 공개 연출 후 턴 유지
 */
import { test, expect } from '@playwright/test';
import {
    cleanupAllE2eAccountsActiveGamesViaApi,
    startHiddenPvpGameViaApi,
    confirmColorStartViaApi,
    placeStoneForEitherPlayerViaApi,
    placeHiddenStoneForEitherPlayerViaApi,
    revealOpponentHiddenViaApi,
    navigateToGameHash,
} from './e2e-api.helpers.js';
import {
    E2E_USER_A,
    E2E_USER_B,
    E2E_SHARED_PASSWORD,
    loginPage,
} from './two-client.helpers.js';
import { leaveActiveGameQuick } from './dismissBlockingGame.js';

test.describe('PVP reveal opponent hidden E2E', () => {
    test.setTimeout(240000);

    test.beforeEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test.afterEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test('opponent hidden stone → reveal action → game continues on same hash', async ({
        browser,
        request,
    }) => {
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        try {
            await loginPage(pageA, E2E_USER_A, E2E_SHARED_PASSWORD, request);
            await loginPage(pageB, E2E_USER_B, E2E_SHARED_PASSWORD, request);

            const { gameId, challengerId, opponentId } = await startHiddenPvpGameViaApi(
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
            await pageA.waitForTimeout(2500);

            await placeStoneForEitherPlayerViaApi(request, [challengerId, opponentId], gameId, 2, 2);
            await placeHiddenStoneForEitherPlayerViaApi(request, [opponentId, challengerId], gameId, 4, 4);

            for (const userId of [challengerId, opponentId]) {
                try {
                    await revealOpponentHiddenViaApi(request, userId, gameId, 4, 4);
                    break;
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    if (message.includes('Not your turn') || message.includes('내 차례')) continue;
                    throw error;
                }
            }

            await pageA.waitForTimeout(5000);
            await pageB.waitForTimeout(3000);

            await expect(pageA).toHaveURL(new RegExp(`#/game/${gameId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
            await expect(pageB).toHaveURL(new RegExp(`#/game/${gameId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

            await leaveActiveGameQuick(pageA);
            await leaveActiveGameQuick(pageB);
        } finally {
            await contextA.close();
            await contextB.close();
        }
    });
});
