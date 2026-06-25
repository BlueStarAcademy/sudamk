import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import {
    E2E_TEST_LOGIN_USERNAME,
    E2E_TEST_LOGIN_USERNAME_2,
    E2E_TEST_DEFAULT_PASSWORD,
    E2E_TEST_NICKNAME_2,
} from '../shared/constants/e2eTestAccount.js';
import { waitForE2eBackendReady, confirmColorStartViaApi } from './e2e-api.helpers.js';
import { dismissBlockingLiveGameIfNeeded } from './dismissBlockingGame.js';
import { dismissGuideModalIfNeeded, goToAppHashFromStableProfile } from './navigation.helpers.js';

const POST_LOGIN_URL =
    /\#\/(?:home|profile|set-nickname|game\/|pvp\/|ai\/|singleplayer|tower|guild|tournament|adventure)/;

export const E2E_USER_A =
    process.env.E2E_USERNAME || E2E_TEST_LOGIN_USERNAME;
export const E2E_USER_B =
    process.env.E2E_USERNAME_2 || E2E_TEST_LOGIN_USERNAME_2;
export const E2E_SHARED_PASSWORD =
    process.env.E2E_PASSWORD || E2E_TEST_DEFAULT_PASSWORD;

async function waitForLoginOutcome(page: Page, username: string): Promise<void> {
    const loginError = page.locator('form').filter({ has: page.locator('#username-login') }).locator('p.text-red-200');
    await Promise.race([
        page.waitForURL(POST_LOGIN_URL, { timeout: 45000 }),
        loginError.waitFor({ state: 'visible', timeout: 45000 }).then(async () => {
            const message = (await loginError.textContent())?.trim() || '(no message)';
            throw new Error(`E2E: 로그인 실패 (${username}) — ${message}`);
        }),
    ]);
}

async function waitForLoginPageOrHome(page: Page): Promise<'login' | 'home'> {
    const deadline = Date.now() + 35000;
    while (Date.now() < deadline) {
        if (
            await page
                .getByRole('button', { name: /Log out|로그아웃/i })
                .first()
                .isVisible()
                .catch(() => false)
        ) {
            return 'home';
        }
        if (await page.locator('#username-login').first().isVisible().catch(() => false)) {
            return 'login';
        }
        await page.waitForTimeout(400);
    }
    throw new Error('E2E: 로그인 화면 또는 홈 화면을 확인할 수 없습니다.');
}

/** 단일 페이지 로그인 (세션 유지) */
export async function loginPage(
    page: Page,
    username: string = E2E_USER_A,
    password: string = E2E_SHARED_PASSWORD,
    request?: APIRequestContext,
    options?: { preserveActiveGame?: boolean },
): Promise<void> {
    if (request) {
        await waitForE2eBackendReady(request);
    }
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const authState = await waitForLoginPageOrHome(page);
    if (authState === 'login') {
        await page.locator('#username-login').fill(username);
        await page.locator('#password-login').fill(password);
        await page.locator('form').filter({ has: page.locator('#username-login') }).locator('button[type="submit"]').click();
        await waitForLoginOutcome(page, username);
        await dismissGuideModalIfNeeded(page);
        await page.waitForTimeout(1000);
    }

    const loginStillVisible = await page.locator('#username-login').first().isVisible().catch(() => false);
    if (loginStillVisible) {
        throw new Error(`E2E: 로그인 실패 (${username})`);
    }

    if (!options?.preserveActiveGame) {
        await Promise.race([dismissBlockingLiveGameIfNeeded(page), page.waitForTimeout(8000)]);
    }
}

export async function enterStrategicPvpLobby(page: Page): Promise<void> {
    await goToAppHashFromStableProfile(page, '#/pvp/strategic');
    await page.waitForTimeout(1500);
}

/** PVP 로비 유저 목록에 상대가 나타나고 대국 신청 버튼이 활성화될 때까지 대기 */
export async function waitForPvpLobbyOpponent(
    page: Page,
    opponentNickname: string = E2E_TEST_NICKNAME_2,
    timeoutMs = 45000,
): Promise<void> {
    const row = page.locator('li').filter({ hasText: opponentNickname });
    await expect(row.first()).toBeVisible({ timeout: timeoutMs });
    const challengeBtn = row.first().getByRole('button', { name: /대국 신청|Challenge/i });
    await expect(challengeBtn).toBeVisible({ timeout: 10000 });
    await expect(challengeBtn).toBeEnabled({ timeout: timeoutMs });
}

/** nigiri_reveal이면 API·UI 확인, 이미 playing이면 무시 */
export async function ensurePvpGamePlaying(
    request: APIRequestContext,
    userIds: string[],
    gameId: string,
    pages: Page[] = [],
): Promise<void> {
    for (const userId of userIds) {
        try {
            await confirmColorStartViaApi(request, userId, gameId);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('Not in confirmation phase')) {
                throw error;
            }
        }
    }
    for (const page of pages) {
        await confirmNigiriStart(page);
    }
    if (pages[0]) {
        await pages[0].waitForTimeout(2500);
    } else {
        await new Promise((resolve) => setTimeout(resolve, 2500));
    }
}

/** 흑·백 확인(nigiri_reveal) 후 대국 시작 */
export async function confirmNigiriStart(page: Page): Promise<void> {
    const startBtn = page.getByRole('button', { name: /^Start$|^시작$/i }).first();
    const visible = await startBtn.isVisible().catch(() => false);
    if (!visible) {
        return;
    }
    await page.waitForTimeout(3500);
    await expect(startBtn).toBeEnabled({ timeout: 20000 });
    await startBtn.click();
    await page.waitForTimeout(800);
}

function passButton(page: Page) {
    return page
        .getByRole('button', { name: /^Pass$|^패스$/i })
        .or(page.locator('button:has(img[alt="Pass"]), button:has(img[alt="패스"])'))
        .first();
}

/** 내 차례일 때만 패스 버튼 클릭 */
export async function clickPassIfEnabled(page: Page): Promise<boolean> {
    const passBtn = passButton(page);
    if (!(await passBtn.isVisible().catch(() => false))) {
        return false;
    }
    if (!(await passBtn.isEnabled().catch(() => false))) {
        return false;
    }
    await passBtn.click({ force: true });
    await page.waitForTimeout(600);
    return true;
}

export async function mutualPassUntilScoring(pages: Page[], maxRounds = 8): Promise<void> {
    for (let round = 0; round < maxRounds; round++) {
        for (const page of pages) {
            await clickPassIfEnabled(page);
        }
        await pages[0].waitForTimeout(800);

        const scoringVisible = await Promise.all(
            pages.map((page) =>
                page
                    .getByText(/Both sides passed|계가|scoring|Revealing all hidden|Starting scoring/i)
                    .first()
                    .isVisible()
                    .catch(() => false),
            ),
        );
        if (scoringVisible.some(Boolean)) {
            return;
        }

        const endedVisible = await Promise.all(
            pages.map((page) =>
                page
                    .getByRole('button', { name: /Back to lobby|대기실로/i })
                    .first()
                    .isVisible()
                    .catch(() => false),
            ),
        );
        if (endedVisible.some(Boolean)) {
            return;
        }
    }
}

/** 다른 기기 로그인 알림 모달이 있으면 닫기 */
export async function dismissOtherDeviceLoginIfNeeded(page: Page): Promise<void> {
    const elsewhere = page.getByText(/Signed in elsewhere|다른 기기/i).first();
    if (await elsewhere.isVisible().catch(() => false)) {
        await page.getByRole('button', { name: /^확인$|^OK$|^Confirm$/i }).click();
        await page.waitForTimeout(800);
    }
}

export async function startRankedMatchingFromLobby(page: Page): Promise<void> {
    await dismissOtherDeviceLoginIfNeeded(page);
    await page.getByRole('button', { name: /Start ranked match|랭킹전 시작/i }).first().click();
    await page.getByRole('button', { name: /Join queue|매칭 대기/i }).click();
    await page.waitForTimeout(800);
}

export async function acceptRankedMatchModal(page: Page): Promise<void> {
    await expect(
        page.getByText(/Match found|매칭이 되었습니다|Ranked matchmaking/i).first(),
    ).toBeVisible({ timeout: 120000 });
    await page.getByRole('button', { name: /^Accept$|^수락$/i }).click();
}

/** 게임 화면: 보드(canvas/svg) + 패스 또는 기권(랭킹 턴제는 패스 숨김) */
export async function expectBoardVisible(page: Page): Promise<void> {
    await expect(page.locator('canvas, [class*="board"], svg').first()).toBeVisible({ timeout: 20000 });
    await expect(
        page
            .getByRole('button', { name: /^Pass$|^패스$/i })
            .or(page.locator('button:has(img[alt="Pass"]), button:has(img[alt="패스"])'))
            .or(page.getByRole('button', { name: /Resign|기권/i }))
            .or(page.locator('button:has(img[alt="Resign"]), button:has(img[alt="기권"])'))
            .first(),
    ).toBeVisible({ timeout: 25000 });
}

/** 믹스(히idden+스캔+미사일) 아이템 컨트롤 버튼 표시 */
export async function expectMixItemControlButtons(page: Page): Promise<void> {
    await expect(page.getByRole('button', { name: /Hidden|히든/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /^Scan$|^스캔$/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /^Missile$|^미사일$/i }).first()).toBeVisible({ timeout: 15000 });
}

export async function expectDisconnectionModal(
    page: Page,
    disconnectedNickname: string,
): Promise<void> {
    await expect(page.locator('#disconnection-modal-title')).toBeVisible({ timeout: 45000 });
    await expect(page.getByText(/disconnected|연결이 끊/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(disconnectedNickname).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Waiting for reconnect|재접속을 기다/i).first()).toBeVisible({
        timeout: 5000,
    });
}

export async function expectDisconnectionModalHidden(page: Page): Promise<void> {
    await expect(page.locator('#disconnection-modal-title')).toBeHidden({ timeout: 30000 });
}

