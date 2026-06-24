import type { Page } from '@playwright/test';
import { dismissGuideModalIfNeeded } from './navigation.helpers.js';

const MAX_ROUNDS = 4;

async function goHomeWithoutReload(page: Page): Promise<void> {
    await page.evaluate(() => {
        window.location.hash = '#/home';
    });
    await page.waitForFunction(() => window.location.hash.startsWith('#/home'), undefined, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
}

async function tryLeaveGameScreen(page: Page): Promise<boolean> {
    const confirmResign = page.getByRole('dialog').getByRole('button', { name: /^기권$|^Resign$/i });
    if (await confirmResign.isVisible().catch(() => false)) {
        await confirmResign.click();
        await page.waitForTimeout(1200);
        return true;
    }

    const backToLobby = page.getByRole('button', { name: /Back to lobby|대기실로|returnToLobby|backToLobby/i });
    if (await backToLobby.first().isVisible().catch(() => false)) {
        await backToLobby.first().click({ force: true });
        await page.waitForTimeout(800);
        return true;
    }

    const resignBtn = page
        .getByRole('button', { name: /^기권$|^Resign$/i })
        .or(page.locator('button:has(img[alt="기권"]), button:has(img[alt="Resign"])'))
        .first();

    if (await resignBtn.isVisible().catch(() => false) && (await resignBtn.isEnabled().catch(() => false))) {
        await resignBtn.click({ force: true });
        await page.waitForTimeout(300);
        const dialogConfirm = page.getByRole('dialog').getByRole('button', { name: /^기권$|^Resign$/i });
        if (await dialogConfirm.isVisible().catch(() => false)) {
            await dialogConfirm.click();
            await page.waitForTimeout(1200);
        }
        return true;
    }

    return false;
}

async function clearStoredLiveGameSnapshots(page: Page): Promise<void> {
    await page.evaluate(() => {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const key = sessionStorage.key(i);
            if (key?.startsWith('gameState_')) {
                sessionStorage.removeItem(key);
            }
        }
    });
}

export async function leaveActiveGameQuick(page: Page): Promise<void> {
    if (!page.url().includes('#/game/')) {
        return;
    }
    await tryLeaveGameScreen(page);
    await clearStoredLiveGameSnapshots(page);
    await goHomeWithoutReload(page);
}

/**
 * 서버에 진행 중인 대국이 있으면 useApp이 대기실·싱글·탑 화면을 경기장 URL로 덮어씁니다.
 * page.goto는 로그인 세션(메모리)을 지우므로 hash 이동만 사용합니다.
 */
export async function dismissBlockingLiveGameIfNeeded(page: Page): Promise<void> {
    for (let round = 0; round < MAX_ROUNDS; round++) {
        await clearStoredLiveGameSnapshots(page);
        await goHomeWithoutReload(page);
        await dismissGuideModalIfNeeded(page);

        if (!page.url().includes('#/game/')) {
            return;
        }

        const acted = await tryLeaveGameScreen(page);
        if (!acted) {
            await page.waitForTimeout(600);
        }
    }

    await clearStoredLiveGameSnapshots(page);
    await goHomeWithoutReload(page);
    await dismissGuideModalIfNeeded(page);
}
