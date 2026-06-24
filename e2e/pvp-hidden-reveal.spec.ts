/**
 * E2E: 히든바둑 PVP — 상호 패스 시 hidden_final_reveal UI
 */
import { test, expect } from '@playwright/test';
import {
    cleanupAllE2eAccountsActiveGamesViaApi,
    startHiddenPvpGameViaApi,
    confirmColorStartViaApi,
    placeHiddenStoneForEitherPlayerViaApi,
    passTurnViaApi,
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

test.describe('PVP hidden final reveal E2E', () => {
    test.setTimeout(240000);

    test.beforeEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test.afterEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test('hidden stone on board → mutual pass → reveal overlay text', async ({ browser, request }) => {
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        try {
            await loginPage(pageA, E2E_USER_A, E2E_SHARED_PASSWORD);
            await loginPage(pageB, E2E_USER_B, E2E_SHARED_PASSWORD);
            await enterStrategicPvpLobby(pageA);
            await enterStrategicPvpLobby(pageB);

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
            await pageA.waitForTimeout(2000);

            await placeHiddenStoneForEitherPlayerViaApi(request, [challengerId, opponentId], gameId, 3, 3);

            for (let round = 0; round < 8; round++) {
                for (const userId of [challengerId, opponentId]) {
                    try {
                        await passTurnViaApi(request, userId, gameId);
                    } catch {
                        // not this player's turn
                    }
                }
                const revealVisible = await pageA
                    .getByText(/Revealing all hidden|히든돌을 공개|hidden stones/i)
                    .first()
                    .isVisible()
                    .catch(() => false);
                if (revealVisible) {
                    break;
                }
                await pageA.waitForTimeout(600);
            }

            await expect(
                pageA.getByText(/Revealing all hidden|히든돌을 공개|hidden stones/i).first(),
            ).toBeVisible({ timeout: 90000 });
            await expect(
                pageB.getByText(/Revealing all hidden|히든돌을 공개|hidden stones/i).first(),
            ).toBeVisible({ timeout: 30000 });

            await leaveActiveGameQuick(pageA);
            await leaveActiveGameQuick(pageB);
        } finally {
            await contextA.close();
            await contextB.close();
        }
    });
});
