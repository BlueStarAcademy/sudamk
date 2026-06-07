import { test, expect } from '@playwright/test';
import { PC_UI_SCALE_QA_VIEWPORTS } from '../shared/constants/pcUiScaleAudit.js';

test.describe('PC UI scale shell', () => {
    for (const vp of PC_UI_SCALE_QA_VIEWPORTS) {
        test(`design canvas attribute at ${vp.label} (${vp.width}x${vp.height})`, async ({ page }) => {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.goto('/');
            await expect(page).toHaveTitle(/\S/);

            const canvasRoot = page.locator('.sudamr-pc-scaled-canvas-root');
            const portraitShell = page.locator('[data-portrait-first-shell]');

            if (await portraitShell.count()) {
                await expect(canvasRoot).toHaveCount(0);
            } else if (await canvasRoot.count()) {
                await expect(canvasRoot).toBeVisible();
                const designCanvas = await page.evaluate(() =>
                    document.documentElement.getAttribute('data-pc-design-canvas'),
                );
                expect(designCanvas).toBe('1');
            }
        });
    }

    test('modal root lives inside scaled canvas on PC viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1366, height: 768 });
        await page.goto('/');

        const canvasRoot = page.locator('.sudamr-pc-scaled-canvas-root');
        if ((await canvasRoot.count()) === 0) {
            test.skip();
            return;
        }

        const modalRootInCanvas = await page.evaluate(() => {
            const canvas = document.querySelector('.sudamr-pc-scaled-canvas-root');
            const modalRoot = document.getElementById('sudamr-modal-root');
            return Boolean(canvas && modalRoot && canvas.contains(modalRoot));
        });
        expect(modalRootInCanvas).toBe(true);
    });
});
