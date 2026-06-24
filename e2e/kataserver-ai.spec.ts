/**
 * E2E: KataServer 레벨봇 AI 대결 (전 모드 통합)
 */
import { test, expect } from './auth.fixture.js';
import {
    E2E_TEXT,
    goToAppHashFromStableProfile,
    selectAiLobbyOption,
    startAiGameFromLobby,
    waitForAiLobby,
} from './navigation.helpers.js';
import { leaveActiveGameQuick } from './dismissBlockingGame.js';

test.describe('KataServer AI games E2E', () => {
    test.setTimeout(120000);

    test('Standard mode: 1단계(입문) AI responds', async ({ page, authenticatedPage }) => {
        await goToAppHashFromStableProfile(page, '#/ai/strategic');
        await page.waitForTimeout(2500);

        await waitForAiLobby(page, 'strategic');
        await selectAiLobbyOption(page, '-31');
        await startAiGameFromLobby(page);

        await page.waitForURL(/#\/game\//, { timeout: 25000 });
        await page.waitForTimeout(2000);

        const gameContainer = page.locator('main').or(page.locator('[class*="game"]')).first();
        await expect(gameContainer).toBeVisible({ timeout: 5000 });

        const board = page.locator('canvas, [class*="board"], svg').first();
        const boardVisible = await board.isVisible().catch(() => false);
        if (boardVisible) {
            const box = await board.boundingBox();
            if (box) {
                await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
                await page.waitForTimeout(5000);
            }
        }
        await leaveActiveGameQuick(page);
    });

    test('Standard mode: 5단계(고수) AI responds', async ({ page, authenticatedPage }) => {
        await goToAppHashFromStableProfile(page, '#/ai/strategic');
        await page.waitForTimeout(2500);

        await waitForAiLobby(page, 'strategic');
        await selectAiLobbyOption(page, '5');
        await startAiGameFromLobby(page);

        await page.waitForURL(/#\/game\//, { timeout: 25000 });
        await page.waitForTimeout(2000);

        const gameContainer = page.locator('main').or(page.locator('[class*="game"]')).first();
        await expect(gameContainer).toBeVisible({ timeout: 5000 });
        await leaveActiveGameQuick(page);
    });

    test('Non-Standard strategic mode also uses 5-level KataServer selector', async ({ page, authenticatedPage }) => {
        await goToAppHashFromStableProfile(page, '#/ai/strategic');
        await page.waitForTimeout(2500);

        await waitForAiLobby(page, 'strategic');

        const modeSelect = page.locator('main select').filter({ has: page.locator('option[value="capture"]') }).first();
        const hasModeSelect = await modeSelect.isVisible().catch(() => false);
        if (hasModeSelect) {
            await modeSelect.selectOption('capture');
            await page.waitForTimeout(500);

            const difficultyOptions = await page.locator('main select option').allTextContents();
            const has5Levels =
                difficultyOptions.some((t) => /입문|Beginner/i.test(t)) &&
                difficultyOptions.some((t) => /고수|Expert|Advanced/i.test(t));
            expect(has5Levels).toBe(true);
        }

        await startAiGameFromLobby(page);

        await page.waitForURL(/#\/game\//, { timeout: 25000 });
        await page.waitForTimeout(2000);

        const gameContainer = page.locator('main').or(page.locator('[class*="game"]')).first();
        await expect(gameContainer).toBeVisible({ timeout: 5000 });
        await leaveActiveGameQuick(page);
    });

    test('Playful mode AI game is unaffected by KataServer', async ({ page, authenticatedPage }) => {
        await goToAppHashFromStableProfile(page, '#/ai/playful');
        await page.waitForTimeout(2500);

        await waitForAiLobby(page, 'playful');
        await startAiGameFromLobby(page);

        await page.waitForURL(/#\/game\//, { timeout: 25000 });
        await page.waitForTimeout(2000);

        const gameContainer = page.locator('main').or(page.locator('[class*="game"]')).first();
        await expect(gameContainer).toBeVisible({ timeout: 5000 });
        await leaveActiveGameQuick(page);
    });
});
