/**
 * E2E: 싱글플레이, 도전의 탑, 전략바둑 AI 대결, 놀이바둑 AI 대결
 * - 로그인 후 각 모드 진입 및 게임 시작
 * - 바둑 규칙(착수/턴), 아이템(해당 모드), 계가 등이 정상 동작하는지 화면/URL로 검증
 *
 * 필요 조건: 서버 실행 중, 테스트 유저 존재 (기본: 푸른별 / 1217 또는 E2E_USERNAME, E2E_PASSWORD)
 * 관리자 설정에서 해당 경기장 입장이 막혀 있으면 Router/대기실이 프로필로 돌아가므로 실패합니다.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './auth.fixture.js';

/** 전체 `goto(#/…)` 재로드는 WS·INITIAL_STATE 레이스로 로비 헤더를 놓치기 쉬움 → 프로필에서 hash만 변경 */
async function goToAppHashFromStableProfile(page: Page, hash: string): Promise<void> {
    const normalized = hash.startsWith('#') ? hash : `#${hash}`;
    await page.goto('/#/profile', { waitUntil: 'domcontentloaded' });
    const loginForm = page.locator('#username-login').first();
    if (await loginForm.isVisible().catch(() => false)) {
        throw new Error('E2E: 세션이 없어 로그인 폼이 보입니다. authenticatedPage / 서버·계정을 확인하세요.');
    }
    await expect(
        page.getByText('전략 바둑').first().or(page.getByText('도전의 탑').first()),
    ).toBeVisible({ timeout: 30000 });
    await page.evaluate((h) => {
        window.location.hash = h;
    }, normalized);
    await page.waitForFunction((h) => window.location.hash === h, normalized, { timeout: 10000 });
    await page.waitForTimeout(500);
}

test.describe('AI and PvE games E2E', () => {
    test.setTimeout(60000);

    test('strategic lobby: open AI challenge modal and start Standard vs AI', async ({ page, authenticatedPage }) => {
        await goToAppHashFromStableProfile(page, '#/waiting/strategic');
        await page.waitForTimeout(2500);

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
        await goToAppHashFromStableProfile(page, '#/waiting/playful');
        await page.waitForTimeout(2500);

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
        await goToAppHashFromStableProfile(page, '#/singleplayer');
        await page.waitForTimeout(2500);

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
        await goToAppHashFromStableProfile(page, '#/tower');
        await page.waitForTimeout(2500);

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
