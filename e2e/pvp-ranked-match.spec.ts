/**
 * E2E: 랭킹전 PVP — API 매칭(가능 시) 또는 UI 매칭 → 게임 진입
 */
import { test, expect, type Page } from '@playwright/test';
import {
    cleanupAllE2eAccountsActiveGamesViaApi,
    loginViaApi,
    startRankedPvpGameViaApi,
    confirmColorStartViaApi,
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

async function dismissOtherDeviceLoginIfNeeded(page: Page): Promise<void> {
    const elsewhere = page.getByText(/Signed in elsewhere|다른 기기/i).first();
    if (await elsewhere.isVisible().catch(() => false)) {
        await page.getByRole('button', { name: /^확인$|^OK$|^Confirm$/i }).click();
        await page.waitForTimeout(800);
    }
}

async function startRankedMatchingFromLobby(page: Page): Promise<void> {
    await dismissOtherDeviceLoginIfNeeded(page);
    await page.getByRole('button', { name: /Start ranked match|랭킹전 시작/i }).first().click();
    await page.getByRole('button', { name: /Join queue|매칭 대기/i }).click();
    await page.waitForTimeout(800);
}

async function acceptRankedMatchModal(page: Page): Promise<void> {
    await expect(
        page.getByText(/Match found|매칭이 되었습니다|Ranked matchmaking/i).first(),
    ).toBeVisible({ timeout: 120000 });
    await page.getByRole('button', { name: /^Accept$|^수락$/i }).click();
}

async function tryRankedMatchViaUi(
    pageA: Page,
    pageB: Page,
    userAId: string,
    userBId: string,
): Promise<{ gameId: string; userAId: string; userBId: string }> {
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
        throw new Error('E2E: could not parse gameId from ranked match URL');
    }
    return { gameId, userAId, userBId };
}

test.describe('PVP ranked match E2E', () => {
    test.setTimeout(360000);

    test.beforeEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test.afterEach(async ({ request }) => {
        await cleanupAllE2eAccountsActiveGamesViaApi(request);
    });

    test('ranked matching → both accept → enter ranked game', async ({ browser, request }) => {
        const loginA = await loginViaApi(request, E2E_USER_A, E2E_SHARED_PASSWORD);
        const loginB = await loginViaApi(request, E2E_USER_B, E2E_SHARED_PASSWORD);

        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        try {
            await loginPage(pageA, E2E_USER_A, E2E_SHARED_PASSWORD, request);
            await loginPage(pageB, E2E_USER_B, E2E_SHARED_PASSWORD, request);

            let gameId: string;
            let userAId = loginA.userId;
            let userBId = loginB.userId;

            try {
                const ranked = await startRankedPvpGameViaApi(request, loginA.userId, loginB.userId);
                gameId = ranked.gameId;
                userAId = ranked.userAId;
                userBId = ranked.userBId;
                await Promise.all([
                    navigateToGameHash(pageA, gameId),
                    navigateToGameHash(pageB, gameId),
                ]);
            } catch {
                const uiMatch = await tryRankedMatchViaUi(pageA, pageB, loginA.userId, loginB.userId);
                gameId = uiMatch.gameId;
                userAId = uiMatch.userAId;
                userBId = uiMatch.userBId;
            }

            await confirmColorStartViaApi(request, userAId, gameId);
            await confirmColorStartViaApi(request, userBId, gameId);

            await pageA.waitForTimeout(2000);
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
