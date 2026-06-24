/**
 * E2E: UI 대국 신청 → 수락 → 게임 진입
 */
import { test, expect } from '@playwright/test';
import { cleanupAllE2eAccountsActiveGamesViaApi } from './e2e-api.helpers.js';
import {
    E2E_USER_A,
    E2E_USER_B,
    E2E_SHARED_PASSWORD,
    loginPage,
    enterStrategicPvpLobby,
    waitForPvpLobbyOpponent,
} from './two-client.helpers.js';
import { dismissGuideModalIfNeeded } from './navigation.helpers.js';
import { leaveActiveGameQuick } from './dismissBlockingGame.js';

test.describe('PVP challenge UI E2E', () => {
    test.setTimeout(240000);

    test.beforeEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test.afterEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test('player list challenge → accept → both enter game', async ({ browser, request }) => {
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        try {
            await loginPage(pageA, E2E_USER_A, E2E_SHARED_PASSWORD, request);
            await loginPage(pageB, E2E_USER_B, E2E_SHARED_PASSWORD, request);

            await enterStrategicPvpLobby(pageA);
            await enterStrategicPvpLobby(pageB);

            await waitForPvpLobbyOpponent(pageA);

            const opponentRow = pageA.locator('li').filter({ hasText: E2E_USER_B });
            await opponentRow.first().getByRole('button', { name: /대국 신청|Challenge/i }).click();

            const modeCard = pageA.getByRole('button', { name: /Classic Go|클래식 바둑/i }).first();
            await expect(modeCard).toBeVisible({ timeout: 10000 });
            await modeCard.click();

            const applyBtn = pageA.getByRole('button', { name: /대국 신청|Request|Apply/i }).first();
            await expect(applyBtn).toBeEnabled({ timeout: 10000 });
            await applyBtn.click();

            await dismissGuideModalIfNeeded(pageB);
            const acceptBtn = pageB.getByRole('button', { name: /Accept|수락/i }).first();
            await expect(acceptBtn).toBeVisible({ timeout: 45000 });
            await expect(acceptBtn).toBeEnabled({ timeout: 15000 });
            await acceptBtn.click();

            await Promise.all([
                pageA.waitForURL(/#\/game\//, { timeout: 45000 }),
                pageB.waitForURL(/#\/game\//, { timeout: 45000 }),
            ]);

            await leaveActiveGameQuick(pageA);
            await leaveActiveGameQuick(pageB);
        } finally {
            await contextA.close();
            await contextB.close();
        }
    });
});
