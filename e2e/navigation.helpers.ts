import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { leaveActiveGameQuick } from './dismissBlockingGame.js';

/** 로그인·로비 안내 모달이 뜨면 닫습니다. */
export async function dismissGuideModalIfNeeded(page: Page): Promise<void> {
    const guideClose = page
        .getByRole('button', { name: /^확인$|^OK$|^Confirm$/i })
        .or(page.getByRole('button', { name: /다시 보지 않기|Don't show again/i }));
    if (await guideClose.first().isVisible().catch(() => false)) {
        await guideClose.first().click();
        await page.waitForTimeout(400);
    }
}

/** @deprecated use dismissGuideModalIfNeeded */
export async function dismissHomeGuideIfNeeded(page: Page): Promise<void> {
    await dismissGuideModalIfNeeded(page);
}

/** 인증된 홈 화면이 준비됐는지 확인 (언어·i18n 무관) */
export async function waitForAuthenticatedHome(page: Page): Promise<void> {
    await dismissGuideModalIfNeeded(page);
    await expect(page.getByRole('button', { name: /Log out|로그아웃/i }).first()).toBeVisible({ timeout: 30000 });
}

/** 프로필/홈에서 hash만 변경해 라우팅 (WS·INITIAL_STATE 레이스 완화) */
export async function goToAppHashFromStableProfile(page: Page, hash: string): Promise<void> {
    const normalized = hash.startsWith('#') ? hash : `#${hash}`;
    await goHomeWithoutReload(page);
    if (page.url().includes('#/game/')) {
        await leaveActiveGameQuick(page);
    }
    const loginForm = page.locator('#username-login').first();
    if (await loginForm.isVisible().catch(() => false)) {
        throw new Error('E2E: 세션이 없어 로그인 폼이 보입니다. authenticatedPage / 서버·계정을 확인하세요.');
    }
    await waitForAuthenticatedHome(page);
    await page.evaluate((h) => {
        window.location.hash = h;
    }, normalized);
    await page.waitForFunction(
        (h) => window.location.hash === h || window.location.hash.startsWith(h.split('?')[0]),
        normalized,
        { timeout: 10000 },
    ).catch(async () => {
        await page.evaluate((h) => {
            window.location.hash = h;
        }, normalized);
    });
    await page.waitForTimeout(800);
    await dismissGuideModalIfNeeded(page);
}

async function goHomeWithoutReload(page: Page): Promise<void> {
    if (page.url().includes('#/home')) {
        return;
    }
    await page.evaluate(() => {
        window.location.hash = '#/home';
    });
    await page.waitForFunction(() => window.location.hash.startsWith('#/home'), undefined, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
}

export const E2E_TEXT = {
    strategicPvpArena: /전략바둑 PVP 경기장|Strategy Go PVP Arena/i,
    playfulPvpArena: /놀이바둑 PVP 경기장|Casual Go PVP Arena/i,
    strategicAiLobby: /전략바둑 (?:대기실|AI 대전)|Strategy Go (?:Waiting Room|AI Match)/i,
    playfulAiLobby: /놀이바둑 (?:대기실|AI 대전)|Casual Go (?:Waiting Room|AI Match)/i,
    singlePlayer: /싱글플레이|Go School|Single-player/i,
    challengeTower: /도전의 탑|Challenge Tower/i,
    configureAndStart: /설정 및 시작|Configure & start/i,
    startAiMatch: /Start AI match|AI 대결/i,
    aiChallengeModal: /AI와 대결하기|Challenge AI|AI match/i,
    startGame: /^시작$|^Start$/i,
    challenge: /^도전$|^Challenge$/i,
} as const;

export async function waitForAiLobby(page: Page, channel: 'strategic' | 'playful'): Promise<void> {
    const title = channel === 'strategic' ? E2E_TEXT.strategicAiLobby : E2E_TEXT.playfulAiLobby;
    await expect(
        page.locator('h1').filter({ hasText: title }).or(page.getByRole('button', { name: E2E_TEXT.startAiMatch })).first(),
    ).toBeVisible({ timeout: 20000 });
}

export async function startAiGameFromLobby(page: Page): Promise<void> {
    const inlineStart = page.getByRole('button', { name: E2E_TEXT.startAiMatch }).first();
    const configureBtn = page.getByRole('button', { name: E2E_TEXT.configureAndStart }).first();

    if (await inlineStart.isVisible().catch(() => false)) {
        await inlineStart.click();
        return;
    }
    if (await configureBtn.isVisible().catch(() => false)) {
        await configureBtn.click();
        await page.waitForTimeout(800);
        const dialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: E2E_TEXT.startGame }) });
        await expect(dialog.first()).toBeVisible({ timeout: 5000 });
        await dialog.first().getByRole('button', { name: E2E_TEXT.startGame }).click();
        return;
    }
    throw new Error('E2E: AI lobby start button not found');
}

export async function selectAiLobbyOption(page: Page, value: string, selectIndex = 0): Promise<void> {
    const select = page.locator('main select').nth(selectIndex);
    await expect(select).toBeVisible({ timeout: 5000 });
    await select.selectOption(value);
}
