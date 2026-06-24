/**
 * E2E: 싱글플레이, 도전의 탑, 전략바둑 AI 대결, 놀이바둑 AI 대결
 */
import { test, expect } from './auth.fixture.js';
import { E2E_TEXT, goToAppHashFromStableProfile, startAiGameFromLobby, waitForAiLobby } from './navigation.helpers.js';
import { leaveActiveGameQuick } from './dismissBlockingGame.js';

test.describe('AI and PvE games E2E', () => {
    test.setTimeout(120000);

    test('strategic lobby: open AI challenge modal and start Standard vs AI', async ({ page, authenticatedPage }) => {
        await goToAppHashFromStableProfile(page, '#/ai/strategic');
        await page.waitForTimeout(2500);

        await waitForAiLobby(page, 'strategic');
        await startAiGameFromLobby(page);

        await page.waitForURL(/#\/game\//, { timeout: 25000 });
        await page.waitForTimeout(2000);

        const gameContainer = page.locator('main').or(page.locator('[class*="game"]')).first();
        await expect(gameContainer).toBeVisible({ timeout: 5000 });
        await leaveActiveGameQuick(page);
    });

    test('playful lobby: open AI challenge modal and start one playful mode vs AI', async ({ page, authenticatedPage }) => {
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

    test('single player: enter lobby and start first stage', async ({ page, authenticatedPage }) => {
        await goToAppHashFromStableProfile(page, '#/singleplayer');
        await page.waitForTimeout(2500);

        const heading = page.getByRole('heading', { name: E2E_TEXT.singlePlayer });
        await expect(heading).toBeVisible({ timeout: 20000 });

        const stage1 = page.locator('div.text-xl.font-black').filter({ hasText: '1' }).first();
        const visible = await stage1.isVisible().catch(() => false);
        if (visible) {
            await stage1.click();
            await page.waitForTimeout(3000);
        }

        const inGame = await page.waitForURL(/#\/game\//, { timeout: 15000 }).catch(() => null);
        if (inGame) {
            const gameContainer = page.locator('main').or(page.locator('[class*="game"]')).first();
            await expect(gameContainer).toBeVisible({ timeout: 5000 });
            await leaveActiveGameQuick(page);
        } else {
            await expect(page.getByText(E2E_TEXT.singlePlayer).first()).toBeVisible({ timeout: 3000 });
        }
    });

    test('tower: enter lobby and start first floor', async ({ page, authenticatedPage }) => {
        await goToAppHashFromStableProfile(page, '#/tower');
        await page.waitForTimeout(2500);

        const onTower = new URL(page.url()).hash.startsWith('#/tower');
        if (!onTower) {
            await expect(
                page
                    .getByText(/Clear Go School Intro Stage 10|입문반.*10/i)
                    .or(page.getByText(E2E_TEXT.challengeTower))
                    .or(page.getByAltText(E2E_TEXT.challengeTower))
                    .first(),
            ).toBeVisible({ timeout: 5000 });
            return;
        }

        await expect(page.getByRole('heading', { name: E2E_TEXT.challengeTower })).toBeVisible({ timeout: 20000 });

        const challengeBtn = page.getByRole('button', { name: E2E_TEXT.challenge }).first();
        const hasChallenge = await challengeBtn.isVisible().catch(() => false);
        if (hasChallenge) {
            await challengeBtn.click();
            await page.waitForTimeout(3000);
        }

        const inGame = await page.waitForURL(/#\/game\//, { timeout: 15000 }).catch(() => null);
        if (inGame) {
            const gameContainer = page.locator('main').or(page.locator('[class*="game"]')).first();
            await expect(gameContainer).toBeVisible({ timeout: 5000 });
            await leaveActiveGameQuick(page);
        } else {
            await expect(page.getByText(E2E_TEXT.challengeTower).first()).toBeVisible({ timeout: 3000 });
        }
    });
});
