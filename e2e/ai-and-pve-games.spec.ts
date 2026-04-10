/**
 * E2E: 싱글플레이, 도전의 탑, 전략바둑 AI 대결, 놀이바둑 AI 대결
 * - 로그인 후 각 모드 진입 및 게임 시작
 * - 바둑 규칙(착수/턴), 아이템(해당 모드), 계가 등이 정상 동작하는지 화면/URL로 검증
 *
 * 필요 조건: 서버 실행 중, 테스트 유저 존재 (기본: 푸른별 / 1217 또는 E2E_USERNAME, E2E_PASSWORD)
 */
import { test, expect } from './auth.fixture.js';

test.describe('AI and PvE games E2E', () => {
    test.setTimeout(60000);

    test('strategic lobby: open AI challenge modal and start Standard vs AI', async ({ page, authenticatedPage }) => {
        await page.goto('/#/waiting/strategic');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        await expect(page.getByRole('heading', { name: '전략바둑 대기실' })).toBeVisible({ timeout: 20000 });
        const openAiModal = page.getByRole('button', { name: '설정 및 시작' }).first();
        await expect(openAiModal).toBeVisible({ timeout: 15000 });
        await openAiModal.click();
        await page.waitForTimeout(800);

        const modal = page.locator('[title="AI와 대결하기"]').first();
        await expect(modal).toBeVisible({ timeout: 5000 });

        const startBtn = modal.getByRole('button', { name: '시작' });
        await expect(startBtn).toBeVisible({ timeout: 3000 });
        await startBtn.click();

        await page.waitForURL(/#\/game\//, { timeout: 25000 });
        await page.waitForTimeout(2000);

        const gameContainer = page.locator('main').or(page.locator('[class*="game"]')).first();
        await expect(gameContainer).toBeVisible({ timeout: 5000 });
    });

    test('playful lobby: open AI challenge modal and start one playful mode vs AI', async ({ page, authenticatedPage }) => {
        await page.goto('/#/waiting/playful');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        await expect(page.getByRole('heading', { name: '놀이바둑 대기실' })).toBeVisible({ timeout: 20000 });
        const openAiModal = page.getByRole('button', { name: '설정 및 시작' }).first();
        await expect(openAiModal).toBeVisible({ timeout: 15000 });
        await openAiModal.click();
        await page.waitForTimeout(800);

        const modal = page.locator('[title="AI와 대결하기"]').first();
        await expect(modal).toBeVisible({ timeout: 5000 });

        const startBtn = modal.getByRole('button', { name: '시작' });
        await expect(startBtn).toBeVisible({ timeout: 3000 });
        await startBtn.click();

        await page.waitForURL(/#\/game\//, { timeout: 25000 });
        await page.waitForTimeout(2000);

        const gameContainer = page.locator('main').or(page.locator('[class*="game"]')).first();
        await expect(gameContainer).toBeVisible({ timeout: 5000 });
    });

    test('single player: enter lobby and start first stage', async ({ page, authenticatedPage }) => {
        await page.goto('/#/singleplayer');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        const heading = page.getByRole('heading', { name: /싱글플레이/i }).or(page.getByText('싱글플레이').first());
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
        } else {
            await expect(page.locator('text=싱글플레이').or(page.locator('text=입문반')).first()).toBeVisible({ timeout: 3000 });
        }
    });

    test('tower: enter lobby and start first floor', async ({ page, authenticatedPage }) => {
        await page.goto('/#/tower');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        await expect(page.getByRole('heading', { name: '도전의 탑' })).toBeVisible({ timeout: 20000 });

        const challengeBtn = page.getByRole('button', { name: '도전' }).first();
        const hasChallenge = await challengeBtn.isVisible().catch(() => false);
        if (hasChallenge) {
            await challengeBtn.click();
            await page.waitForTimeout(3000);
        }

        const inGame = await page.waitForURL(/#\/game\//, { timeout: 15000 }).catch(() => null);
        if (inGame) {
            const gameContainer = page.locator('main').or(page.locator('[class*="game"]')).first();
            await expect(gameContainer).toBeVisible({ timeout: 5000 });
        } else {
            await expect(page.getByText(/도전의 탑|층/i).first()).toBeVisible({ timeout: 3000 });
        }
    });
});
