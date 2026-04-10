import type { Page } from '@playwright/test';

const MAX_ROUNDS = 8;

/**
 * 서버에 진행 중인 대국이 있으면 useApp이 대기실·싱글·탑 화면을 경기장 URL로 덮어씁니다.
 * 연속 E2E에서 이전 테스트가 남긴 세션 때문에 로비 텍스트를 찾지 못하는 문제를 막습니다.
 */
export async function dismissBlockingLiveGameIfNeeded(page: Page): Promise<void> {
    for (let round = 0; round < MAX_ROUNDS; round++) {
        await page.waitForTimeout(350);
        const hash = new URL(page.url()).hash;
        if (!hash.startsWith('#/game/')) {
            break;
        }

        const leave = page.getByRole('button', { name: '대기실로' });
        if (await leave.isVisible().catch(() => false)) {
            await leave.click();
            await page.waitForTimeout(1200);
            continue;
        }

        const resignBtn = page
            .getByRole('button', { name: /^기권$/ })
            .or(page.locator('button:has(img[alt="기권"])'))
            .first();

        if (await resignBtn.isVisible().catch(() => false)) {
            const enabled = await resignBtn.isEnabled().catch(() => false);
            if (enabled) {
                await resignBtn.click();
                await page.waitForTimeout(450);
                const dialog = page.getByRole('dialog');
                const confirmResign = dialog.getByRole('button', { name: /^기권$/ });
                const confirmOk = dialog.getByRole('button', { name: /^확인$/ });
                if (await confirmResign.isVisible().catch(() => false)) {
                    await confirmResign.click();
                } else if (await confirmOk.isVisible().catch(() => false)) {
                    await confirmOk.click();
                }
                await page.waitForTimeout(2000);
                continue;
            }
        }

        await page.goto('/#/profile');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(600);
    }

    await page.goto('/#/profile');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
}
