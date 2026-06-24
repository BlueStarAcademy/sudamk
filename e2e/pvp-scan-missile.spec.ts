/**
 * E2E: 믹스 PVP — 스캔 miss / 미사일 발사 UI
 */
import { test, expect } from '@playwright/test';
import {
    cleanupAllE2eAccountsActiveGamesViaApi,
    startMixItemPvpGameViaApi,
    confirmColorStartViaApi,
    placeStoneForEitherPlayerViaApi,
    placeHiddenStoneForEitherPlayerViaApi,
    startScanningViaApi,
    scanBoardViaApi,
    startMissileSelectionViaApi,
    launchMissileViaApi,
    missileAnimationCompleteViaApi,
    navigateToGameHash,
} from './e2e-api.helpers.js';
import {
    E2E_USER_A,
    E2E_USER_B,
    E2E_SHARED_PASSWORD,
    loginPage,
    enterStrategicPvpLobby,
} from './two-client.helpers.js';
import { leaveActiveGameQuick } from './dismissBlockingGame.js';

test.describe('PVP scan miss & missile E2E', () => {
    test.setTimeout(240000);

    test.beforeEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test.afterEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test('scan miss: opponent hidden stone → scan empty cell → game resumes', async ({
        browser,
        request,
    }) => {
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        try {
            await loginPage(pageA, E2E_USER_A, E2E_SHARED_PASSWORD);
            await loginPage(pageB, E2E_USER_B, E2E_SHARED_PASSWORD);
            await enterStrategicPvpLobby(pageA);
            await enterStrategicPvpLobby(pageB);

            const { gameId, challengerId, opponentId } = await startMixItemPvpGameViaApi(
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

            await placeStoneForEitherPlayerViaApi(request, [challengerId, opponentId], gameId, 2, 2);
            await placeHiddenStoneForEitherPlayerViaApi(request, [opponentId, challengerId], gameId, 4, 4);

            const scannerId = await (async () => {
                for (const userId of [challengerId, opponentId]) {
                    try {
                        await startScanningViaApi(request, userId, gameId);
                        return userId;
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        if (message.includes('Not your turn') || message.includes('내 차례')) continue;
                        throw error;
                    }
                }
                throw new Error('E2E: neither player could start scanning');
            })();
            await scanBoardViaApi(request, scannerId, gameId, 0, 0);

            await pageA.waitForTimeout(6000);
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

    test('missile: launch own stone → animation complete → game continues', async ({
        browser,
        request,
    }) => {
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        try {
            await loginPage(pageA, E2E_USER_A, E2E_SHARED_PASSWORD);
            await loginPage(pageB, E2E_USER_B, E2E_SHARED_PASSWORD);

            const { gameId, challengerId, opponentId } = await startMixItemPvpGameViaApi(
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

            const stoneOwnerId = await placeStoneForEitherPlayerViaApi(
                request,
                [challengerId, opponentId],
                gameId,
                4,
                4,
            );
            await placeStoneForEitherPlayerViaApi(
                request,
                [challengerId, opponentId].filter((id) => id !== stoneOwnerId).concat([stoneOwnerId]),
                gameId,
                1,
                1,
            );

            await startMissileSelectionViaApi(request, stoneOwnerId, gameId);
            await launchMissileViaApi(request, stoneOwnerId, gameId, 4, 4, 'up');
            await missileAnimationCompleteViaApi(request, stoneOwnerId, gameId);

            await pageA.waitForTimeout(3000);
            await pageB.waitForTimeout(2000);

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
