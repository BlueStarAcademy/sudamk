/**
 * E2E: PVP 끊김 → DisconnectionModal → 재접속 후 게임 복귀
 */
import { test, expect } from '@playwright/test';
import {
    cleanupAllE2eAccountsActiveGamesViaApi,
    startStandardPvpGameViaApi,
    navigateToGameHash,
} from './e2e-api.helpers.js';
import {
    E2E_USER_A,
    E2E_USER_B,
    E2E_SHARED_PASSWORD,
    loginPage,
    ensurePvpGamePlaying,
    dismissOtherDeviceLoginIfNeeded,
    expectBoardVisible,
    expectDisconnectionModal,
    expectDisconnectionModalHidden,
} from './two-client.helpers.js';
import { E2E_TEST_NICKNAME_2 } from '../shared/constants/e2eTestAccount.js';
import { leaveActiveGameQuick } from './dismissBlockingGame.js';

test.describe('PVP disconnect rejoin E2E', { tag: '@full' }, () => {
    test.setTimeout(300000);

    test.beforeEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test.afterEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test('one client disconnects → modal on opponent → rejoin restores game', async ({
        browser,
        request,
    }) => {
        const contextA = await browser.newContext();
        let contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        let pageB = await contextB.newPage();

        try {
            const wsWaitA = pageA.waitForEvent('websocket', { timeout: 60000 });
            const wsWaitB = pageB.waitForEvent('websocket', { timeout: 60000 });
            await loginPage(pageA, E2E_USER_A, E2E_SHARED_PASSWORD, request);
            await loginPage(pageB, E2E_USER_B, E2E_SHARED_PASSWORD, request);
            await Promise.all([wsWaitA, wsWaitB]);

            const { gameId, challengerId, opponentId } = await startStandardPvpGameViaApi(
                request,
                E2E_USER_A,
                E2E_USER_B,
                E2E_SHARED_PASSWORD,
            );

            await Promise.all([
                navigateToGameHash(pageA, gameId),
                navigateToGameHash(pageB, gameId),
            ]);

            await ensurePvpGamePlaying(request, [challengerId, opponentId], gameId, [pageA, pageB]);

            await expectBoardVisible(pageA);
            await expectBoardVisible(pageB);
            await pageA.waitForTimeout(5000);

            await pageB.close();
            await contextB.close();
            contextB = undefined as unknown as typeof contextB;

            // PVP_WS_DISCONNECT_GRACE_MS(5s) 이후 disconnectionState·GAME_UPDATE
            await pageA.waitForTimeout(10000);
            await expectDisconnectionModal(pageA, E2E_TEST_NICKNAME_2);

            contextB = await browser.newContext();
            pageB = await contextB.newPage();
            await loginPage(pageB, E2E_USER_B, E2E_SHARED_PASSWORD, request, { preserveActiveGame: true });
            await navigateToGameHash(pageB, gameId);
            await pageB.reload({ waitUntil: 'domcontentloaded' });
            await pageB.waitForTimeout(4000);
            await dismissOtherDeviceLoginIfNeeded(pageA);
            await dismissOtherDeviceLoginIfNeeded(pageB);
            await navigateToGameHash(pageA, gameId);
            await pageA.waitForTimeout(3000);

            await expectDisconnectionModalHidden(pageA);
            await expect(pageA.locator('canvas, [class*="board"], svg').first()).toBeVisible({ timeout: 30000 });
            await expect(pageB.locator('canvas, [class*="board"], svg').first()).toBeVisible({ timeout: 30000 });

            const gameHash = `#/game/${gameId}`;
            await expect(pageA).toHaveURL(new RegExp(gameHash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), {
                timeout: 30000,
            });
            await expect(pageB).toHaveURL(new RegExp(gameHash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), {
                timeout: 30000,
            });

            await leaveActiveGameQuick(pageA);
            await leaveActiveGameQuick(pageB);
        } finally {
            await contextA.close().catch(() => {});
            if (contextB) {
                await contextB.close().catch(() => {});
            }
        }
    });
});
