/**
 * E2E: 랭킹전 UI-only — Join queue → Match found → Accept → 자동 게임 진입
 */
import { test, expect } from '@playwright/test';
import {
    cleanupAllE2eAccountsActiveGamesViaApi,
    loginViaApi,
} from './e2e-api.helpers.js';
import {
    E2E_USER_A,
    E2E_USER_B,
    E2E_SHARED_PASSWORD,
    loginPage,
    enterStrategicPvpLobby,
    startRankedMatchingFromLobby,
    acceptRankedMatchModal,
    ensurePvpGamePlaying,
    expectBoardVisible,
} from './two-client.helpers.js';
import { leaveActiveGameQuick } from './dismissBlockingGame.js';

test.describe('PVP ranked UI-only E2E', { tag: ['@full', '@ranked-ui'] }, () => {
    test.setTimeout(360000);

    test.beforeEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test.afterEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test('UI ranked queue → both accept → enter game', async ({ browser, request }) => {
        const loginA = await loginViaApi(request, E2E_USER_A, E2E_SHARED_PASSWORD);
        const loginB = await loginViaApi(request, E2E_USER_B, E2E_SHARED_PASSWORD);

        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        try {
            await loginPage(pageA, E2E_USER_A, E2E_SHARED_PASSWORD, request);
            await loginPage(pageB, E2E_USER_B, E2E_SHARED_PASSWORD, request);

            await enterStrategicPvpLobby(pageA);
            await enterStrategicPvpLobby(pageB);

            await startRankedMatchingFromLobby(pageA);
            await startRankedMatchingFromLobby(pageB);

            await Promise.all([acceptRankedMatchModal(pageA), acceptRankedMatchModal(pageB)]);

            await expect(pageA).toHaveURL(/#\/game\/(game-)/, { timeout: 120000 });
            await expect(pageB).toHaveURL(/#\/game\/(game-)/, { timeout: 120000 });
            expect(pageA.url()).toBe(pageB.url());

            const gameId = pageA.url().match(/#\/game\/(game-[^/?#]+)/)?.[1];
            if (!gameId) {
                throw new Error('E2E: could not parse gameId from ranked UI match URL');
            }

            await ensurePvpGamePlaying(request, [loginA.userId, loginB.userId], gameId, [pageA, pageB]);

            await expectBoardVisible(pageA);
            await expectBoardVisible(pageB);

            await leaveActiveGameQuick(pageA);
            await leaveActiveGameQuick(pageB);
        } finally {
            await contextA.close();
            await contextB.close();
        }
    });
});
