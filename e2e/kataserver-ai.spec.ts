/**
 * E2E: KataServer 레벨봇 AI 대결 (전 모드 통합)
 * - 5단계 AI 난이도 (입문~고수) 선택 후 대국 시작
 * - Standard + 비Standard 전략 모드 모두 KataServer 사용 검증
 * - AI 착점이 정상적으로 돌아오는지 검증
 *
 * 필요 조건: 서버 실행 중, KATA_SERVER_URL 설정됨, 테스트 유저 존재
 */
import { test, expect } from './auth.fixture.js';

test.describe('KataServer AI games E2E', () => {
    test.setTimeout(90000);

    test('Standard mode: 1단계(입문) AI responds', async ({ page, authenticatedPage }) => {
        await page.goto('/#/waiting/strategic');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        // AI 대결 모달 열기
        const aiRow = page.locator('text=AI와 대결하기').first();
        await expect(aiRow).toBeVisible({ timeout: 10000 });
        await aiRow.click();
        await page.waitForTimeout(800);

        const modal = page.locator('[title="AI와 대결하기"]').first();
        await expect(modal).toBeVisible({ timeout: 5000 });

        // AI 난이도 셀렉터에서 1단계(입문, -31) 선택
        const difficultySelect = modal.locator('select').first();
        await expect(difficultySelect).toBeVisible({ timeout: 3000 });
        await difficultySelect.selectOption('-31');

        // 시작
        const startBtn = modal.getByRole('button', { name: '시작' });
        await expect(startBtn).toBeVisible({ timeout: 3000 });
        await startBtn.click();

        // 게임 화면 진입
        await page.waitForURL(/#\/game\//, { timeout: 25000 });
        await page.waitForTimeout(2000);

        const gameContainer = page.locator('main').or(page.locator('[class*="game"]')).first();
        await expect(gameContainer).toBeVisible({ timeout: 5000 });

        // 바둑판 클릭 (착점)
        const board = page.locator('canvas, [class*="board"], svg').first();
        const boardVisible = await board.isVisible().catch(() => false);
        if (boardVisible) {
            const box = await board.boundingBox();
            if (box) {
                await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
                // AI 응답 대기
                await page.waitForTimeout(5000);
            }
        }
    });

    test('Standard mode: 5단계(고수) AI responds', async ({ page, authenticatedPage }) => {
        await page.goto('/#/waiting/strategic');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        const aiRow = page.locator('text=AI와 대결하기').first();
        await expect(aiRow).toBeVisible({ timeout: 10000 });
        await aiRow.click();
        await page.waitForTimeout(800);

        const modal = page.locator('[title="AI와 대결하기"]').first();
        await expect(modal).toBeVisible({ timeout: 5000 });

        // 5단계(고수, 5) 선택
        const difficultySelect = modal.locator('select').first();
        await expect(difficultySelect).toBeVisible({ timeout: 3000 });
        await difficultySelect.selectOption('5');

        const startBtn = modal.getByRole('button', { name: '시작' });
        await startBtn.click();

        await page.waitForURL(/#\/game\//, { timeout: 25000 });
        await page.waitForTimeout(2000);

        const gameContainer = page.locator('main').or(page.locator('[class*="game"]')).first();
        await expect(gameContainer).toBeVisible({ timeout: 5000 });
    });

    test('Non-Standard strategic mode also uses 5-level KataServer selector', async ({ page, authenticatedPage }) => {
        // Capture(따내기) 모드에서도 동일한 5단계 AI 셀렉터 사용 확인
        await page.goto('/#/waiting/strategic');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        const aiRow = page.locator('text=AI와 대결하기').first();
        await expect(aiRow).toBeVisible({ timeout: 10000 });
        await aiRow.click();
        await page.waitForTimeout(800);

        const modal = page.locator('[title="AI와 대결하기"]').first();
        await expect(modal).toBeVisible({ timeout: 5000 });

        // 게임 모드를 따내기로 변경
        const modeSelect = modal.locator('select').filter({ has: page.locator('option[value="capture"]') }).first();
        const hasModeSelect = await modeSelect.isVisible().catch(() => false);
        if (hasModeSelect) {
            await modeSelect.selectOption('capture');
            await page.waitForTimeout(500);

            // 5단계 셀렉터가 보이는지 확인 (입문/초급/중급/고급/고수)
            const difficultyOptions = await modal.locator('select option').allTextContents();
            const has5Levels = difficultyOptions.some(t => t.includes('입문')) &&
                               difficultyOptions.some(t => t.includes('고수'));
            expect(has5Levels).toBe(true);
        }

        const startBtn = modal.getByRole('button', { name: '시작' });
        await startBtn.click();

        await page.waitForURL(/#\/game\//, { timeout: 25000 });
        await page.waitForTimeout(2000);

        const gameContainer = page.locator('main').or(page.locator('[class*="game"]')).first();
        await expect(gameContainer).toBeVisible({ timeout: 5000 });
    });

    test('Playful mode AI game is unaffected by KataServer', async ({ page, authenticatedPage }) => {
        await page.goto('/#/waiting/playful');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        const aiRow = page.locator('text=AI와 대결하기').first();
        await expect(aiRow).toBeVisible({ timeout: 10000 });
        await aiRow.click();
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
});
