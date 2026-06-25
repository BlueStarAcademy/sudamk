/**
 * E2E: 두 클라이언트 PVP 친선 대국 (API 협상 → UI 진입·계가 확인)
 */
import { test, expect } from '@playwright/test';
import {
    cleanupAllE2eAccountsActiveGamesViaApi,
    startStandardPvpGameViaApi,
    confirmColorStartViaApi,
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

test.describe('PVP two clients match E2E', { tag: '@smoke' }, () => {
    test.setTimeout(240000);

    test.beforeEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test.afterEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test('standard PVP: two clients enter game, mutual pass → scoring', async ({ browser, request }) => {
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        try {
            await loginPage(pageA, E2E_USER_A, E2E_SHARED_PASSWORD);
            await loginPage(pageB, E2E_USER_B, E2E_SHARED_PASSWORD);

            await enterStrategicPvpLobby(pageA);
            await enterStrategicPvpLobby(pageB);

            const { gameId, challengerId, opponentId } = await startStandardPvpGameViaApi(
                request,
                E2E_USER_A,
                E2E_USER_B,
                E2E_SHARED_PASSWORD,
            );
            expect(gameId).toMatch(/^game-/);

            await Promise.all([
                navigateToGameHash(pageA, gameId),
                navigateToGameHash(pageB, gameId),
            ]);

            await confirmColorStartViaApi(request, challengerId, gameId);
            await confirmColorStartViaApi(request, opponentId, gameId);

            await pageA.waitForTimeout(2500);
            await pageB.waitForTimeout(2500);

            for (let round = 0; round < 6; round++) {
                for (const userId of [challengerId, opponentId]) {
                    try {
                        await passTurnViaApi(request, userId, gameId);
                    } catch {
                        // not this player's turn
                    }
                }
                const scoringVisible = await pageA
                    .getByText(/Both sides passed|계가|scoring|Revealing all hidden|Starting scoring/i)
                    .first()
                    .isVisible()
                    .catch(() => false);
                if (scoringVisible) {
                    break;
                }
                await pageA.waitForTimeout(500);
            }

            await expect(pageA.getByText(/Both sides passed|양쪽 모두 패스|계가를 시작/i).first()).toBeVisible({
                timeout: 120000,
            });
            await expect(pageB.getByText(/Both sides passed|양쪽 모두 패스|계가를 시작/i).first()).toBeVisible({
                timeout: 30000,
            });

            await leaveActiveGameQuick(pageA);
            await leaveActiveGameQuick(pageB);
        } finally {
            await contextA.close();
            await contextB.close();
        }
    });
});
