import type { APIRequestContext, Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import {
    E2E_TEST_LOGIN_USERNAME,
    E2E_TEST_LOGIN_USERNAME_2,
    E2E_TEST_DEFAULT_PASSWORD,
    E2E_TEST_ACCOUNTS,
} from '../shared/constants/e2eTestAccount.js';
import { GameMode } from '../shared/types/enums.js';

export function e2eApiBaseUrl(): string {
    return process.env.E2E_API_URL || process.env.VITE_API_TARGET || 'http://localhost:4000';
}

/** Vite·API가 로그인 가능할 때까지 대기 (webServer 기동 직후 레이스 완화) */
export async function waitForE2eBackendReady(
    request: APIRequestContext,
    maxMs = 90000,
): Promise<void> {
    const bases = [
        e2eApiBaseUrl(),
        process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    ];
    const started = Date.now();
    while (Date.now() - started < maxMs) {
        for (const base of bases) {
            try {
                const res = await request.get(`${base.replace(/\/$/, '')}/api/health`, { timeout: 4000 });
                if (!res.ok()) continue;
                const body = (await res.json().catch(() => null)) as { status?: string; ready?: boolean } | null;
                if (body?.status === 'ok' && body.ready !== false) {
                    await probeE2eFeatureRoutes(request);
                    return;
                }
            } catch {
                // retry
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error('E2E: /api/health not ready — npm run start(API 4000) 상태를 확인하세요.');
}

/** reuseExistingServer 시 오래된 API(404) 감지 — ranked E2E 헬퍼와 1:1 매핑 */
async function probeE2eFeatureRoutes(request: APIRequestContext): Promise<void> {
    const api = e2eApiBaseUrl().replace(/\/$/, '');
    try {
        const res = await request.post(`${api}/api/e2e/ranked-proposal-for-user`, {
            data: {},
            timeout: 4000,
        });
        if (res.status() === 404) {
            console.warn(
                '[E2E] /api/e2e/ranked-proposal-for-user → 404. API 서버(4000)를 재시작하세요. ' +
                    'reuseExistingServer=true 이면 npm run start를 다시 실행해야 새 라우트가 반영됩니다.',
            );
        }
    } catch {
        // non-fatal probe
    }
}

export type E2eApiLoginResult = {
    userId: string;
    activeGameId: string | null;
};

export type E2eApiActionResult = Record<string, unknown> & {
    success?: boolean;
    error?: string;
    message?: string;
    gameId?: string;
    negotiationId?: string;
    rankedProposalId?: string | null;
};

export async function loginViaApi(
    request: APIRequestContext,
    username: string,
    password: string = E2E_TEST_DEFAULT_PASSWORD,
): Promise<E2eApiLoginResult> {
    const api = e2eApiBaseUrl();
    const loginRes = await request.post(`${api}/api/auth/login`, {
        data: { username, password },
    });
    if (!loginRes.ok()) {
        throw new Error(`E2E API login failed for ${username} (status ${loginRes.status()})`);
    }
    const body = (await loginRes.json()) as {
        user?: { id?: string };
        activeGame?: { id?: string } | null;
    };
    const userId = body.user?.id;
    if (!userId) {
        throw new Error(`E2E API login missing user id for ${username}`);
    }
    return {
        userId,
        activeGameId: body.activeGame?.id ?? null,
    };
}

export async function postGameAction(
    request: APIRequestContext,
    userId: string,
    type: string,
    payload: Record<string, unknown> = {},
): Promise<E2eApiActionResult> {
    const api = e2eApiBaseUrl();
    const actionRes = await request.post(`${api}/api/action`, {
        data: { userId, type, payload },
    });
    const body = (await actionRes.json().catch(() => ({}))) as E2eApiActionResult;
    if (!actionRes.ok()) {
        const detail = body.message || body.error || actionRes.statusText();
        throw new Error(`E2E API action ${type} failed (${actionRes.status()}): ${detail}`);
    }
    return body;
}

/** 실행 중인 API 서버에서 E2E 유저의 activeGame을 기권/퇴장 처리 */
export async function cleanupE2eUserActiveGamesViaApi(
    request: APIRequestContext,
    username: string = process.env.E2E_USERNAME || E2E_TEST_LOGIN_USERNAME,
    password: string = process.env.E2E_PASSWORD || E2E_TEST_DEFAULT_PASSWORD,
): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt++) {
        let login: E2eApiLoginResult;
        try {
            login = await loginViaApi(request, username, password);
        } catch {
            console.warn(`[E2E] API login failed during cleanup for ${username}`);
            return;
        }

        const { userId, activeGameId: gameId } = login;
        if (!gameId) {
            return;
        }

        try {
            await postGameAction(request, userId, 'RESIGN_GAME', { gameId });
        } catch {
            try {
                await postGameAction(request, userId, 'LEAVE_AI_GAME', { gameId });
            } catch {
                console.warn(`[E2E] Could not cleanup active game ${gameId} for ${username}`);
                return;
            }
        }
    }
}

/** 기본 E2E 계정(푸른별·노란별) activeGame 정리 + AP 보충 */
export async function refillE2eAccountsViaApi(_request: APIRequestContext): Promise<void> {
    const base = e2eApiBaseUrl();
    try {
        const res = await _request.post(`${base.replace(/\/$/, '')}/api/e2e/refill-accounts`, { timeout: 20000 });
        if (res.ok()) {
            return;
        }
    } catch {
        // dev server 재사용 시 신규 라우트가 없을 수 있음 → DB 스크립트 fallback
    }
    try {
        execSync('npx tsx --tsconfig server/tsconfig.json server/scripts/refillE2eAccounts.ts', {
            stdio: 'pipe',
            cwd: process.cwd(),
        });
    } catch (error) {
        console.warn('[E2E] refill accounts fallback failed:', error);
    }
}

/** 기본 E2E 계정(푸른별·노란별) activeGame 정리 */
export async function cleanupAllE2eAccountsActiveGamesViaApi(request: APIRequestContext): Promise<void> {
    await refillE2eAccountsViaApi(request);
    const password = process.env.E2E_PASSWORD || E2E_TEST_DEFAULT_PASSWORD;
    const userIds: string[] = [];
    for (const account of E2E_TEST_ACCOUNTS) {
        const username =
            account.loginUsername === E2E_TEST_LOGIN_USERNAME && process.env.E2E_USERNAME
                ? process.env.E2E_USERNAME
                : account.loginUsername === E2E_TEST_LOGIN_USERNAME_2 && process.env.E2E_USERNAME_2
                  ? process.env.E2E_USERNAME_2
                  : account.loginUsername;
        const login = await loginViaApi(request, username, password).catch(() => null);
        if (login?.userId) {
            userIds.push(login.userId);
        }
        await cleanupE2eUserActiveGamesViaApi(request, username, password);
    }
    await cleanupRankedMatchingForE2eAccountsViaApi(request, userIds);
}

const STANDARD_PVP_SETTINGS = {
    boardSize: 9,
    komi: 6.5,
    timeLimit: 5,
    byoyomiCount: 3,
    byoyomiTime: 30,
};

const HIDDEN_PVP_SETTINGS = {
    boardSize: 9,
    komi: 6.5,
    timeLimit: 5,
    byoyomiCount: 3,
    byoyomiTime: 30,
    hiddenStoneCount: 2,
    scanCount: 2,
};

const OMOK_PVP_SETTINGS = {
    boardSize: 15,
    timeLimit: 5,
    byoyomiCount: 3,
    byoyomiTime: 30,
    has33Forbidden: true,
    hasOverlineForbidden: true,
};

const DICE_PVP_SETTINGS = {
    boardSize: 19,
    timeLimit: 5,
    byoyomiCount: 3,
    byoyomiTime: 30,
};

const MIX_ITEM_PVP_SETTINGS = {
    boardSize: 9,
    komi: 6.5,
    timeLimit: 5,
    byoyomiCount: 3,
    byoyomiTime: 30,
    mixedModes: [GameMode.Standard, GameMode.Hidden, GameMode.Missile],
    hiddenStoneCount: 2,
    scanCount: 2,
    missileCount: 2,
};

export async function startPvpGameViaApi(
    request: APIRequestContext,
    challengerUsername: string,
    opponentUsername: string,
    mode: GameMode,
    settings: Record<string, unknown>,
    waitingMode: 'strategic' | 'playful' = 'strategic',
    password: string = E2E_TEST_DEFAULT_PASSWORD,
): Promise<{ gameId: string; challengerId: string; opponentId: string }> {
    const challenger = await loginViaApi(request, challengerUsername, password);
    const opponent = await loginViaApi(request, opponentUsername, password);

    await postGameAction(request, challenger.userId, 'ENTER_WAITING_ROOM', { mode: waitingMode });
    await postGameAction(request, opponent.userId, 'ENTER_WAITING_ROOM', { mode: waitingMode });

    const challengeRes = await postGameAction(request, challenger.userId, 'CHALLENGE_USER', {
        opponentId: opponent.userId,
        mode,
        settings,
    });
    const negotiationId = challengeRes.negotiationId as string | undefined;
    if (!negotiationId) {
        throw new Error('E2E: CHALLENGE_USER did not return negotiationId');
    }

    await postGameAction(request, challenger.userId, 'SEND_CHALLENGE', {
        negotiationId,
        settings,
    });

    const acceptRes = await postGameAction(request, opponent.userId, 'ACCEPT_NEGOTIATION', {
        negotiationId,
        settings,
    });
    const gameId = acceptRes.gameId as string | undefined;
    if (!gameId) {
        throw new Error('E2E: ACCEPT_NEGOTIATION did not return gameId');
    }

    return {
        gameId,
        challengerId: challenger.userId,
        opponentId: opponent.userId,
    };
}

/** 친선 전략바둑(클래식) PVP 대국을 API로 생성 */
export async function startStandardPvpGameViaApi(
    request: APIRequestContext,
    challengerUsername: string,
    opponentUsername: string,
    password: string = E2E_TEST_DEFAULT_PASSWORD,
): Promise<{ gameId: string; challengerId: string; opponentId: string }> {
    return startPvpGameViaApi(
        request,
        challengerUsername,
        opponentUsername,
        GameMode.Standard,
        STANDARD_PVP_SETTINGS,
        'strategic',
        password,
    );
}

export async function startHiddenPvpGameViaApi(
    request: APIRequestContext,
    challengerUsername: string,
    opponentUsername: string,
    password: string = E2E_TEST_DEFAULT_PASSWORD,
): Promise<{ gameId: string; challengerId: string; opponentId: string }> {
    return startPvpGameViaApi(
        request,
        challengerUsername,
        opponentUsername,
        GameMode.Hidden,
        HIDDEN_PVP_SETTINGS,
        'strategic',
        password,
    );
}

export async function startOmokPvpGameViaApi(
    request: APIRequestContext,
    challengerUsername: string,
    opponentUsername: string,
    password: string = E2E_TEST_DEFAULT_PASSWORD,
): Promise<{ gameId: string; challengerId: string; opponentId: string }> {
    return startPvpGameViaApi(
        request,
        challengerUsername,
        opponentUsername,
        GameMode.Omok,
        OMOK_PVP_SETTINGS,
        'playful',
        password,
    );
}

export async function startDicePvpGameViaApi(
    request: APIRequestContext,
    challengerUsername: string,
    opponentUsername: string,
    password: string = E2E_TEST_DEFAULT_PASSWORD,
): Promise<{ gameId: string; challengerId: string; opponentId: string }> {
    return startPvpGameViaApi(
        request,
        challengerUsername,
        opponentUsername,
        GameMode.Dice,
        DICE_PVP_SETTINGS,
        'playful',
        password,
    );
}

/** 믹스(히든+스캔+미사일) 전략 PVP */
export async function startMixItemPvpGameViaApi(
    request: APIRequestContext,
    challengerUsername: string,
    opponentUsername: string,
    password: string = E2E_TEST_DEFAULT_PASSWORD,
): Promise<{ gameId: string; challengerId: string; opponentId: string }> {
    return startPvpGameViaApi(
        request,
        challengerUsername,
        opponentUsername,
        GameMode.Mix,
        MIX_ITEM_PVP_SETTINGS,
        'strategic',
        password,
    );
}

export async function confirmColorStartViaApi(
    request: APIRequestContext,
    userId: string,
    gameId: string,
): Promise<void> {
    await postGameAction(request, userId, 'CONFIRM_COLOR_START', { gameId });
}

export async function passTurnViaApi(
    request: APIRequestContext,
    userId: string,
    gameId: string,
): Promise<void> {
    await postGameAction(request, userId, 'PASS_TURN', { gameId });
}

export async function startHiddenPlacementViaApi(
    request: APIRequestContext,
    userId: string,
    gameId: string,
): Promise<void> {
    await postGameAction(request, userId, 'START_HIDDEN_PLACEMENT', { gameId });
}

export async function placeStoneViaApi(
    request: APIRequestContext,
    userId: string,
    gameId: string,
    x: number,
    y: number,
    isHidden = false,
): Promise<void> {
    await postGameAction(request, userId, 'PLACE_STONE', { gameId, x, y, isHidden });
}

/** 흑/백 중 현재 차례인 쪽에서 착수 */
export async function placeStoneForEitherPlayerViaApi(
    request: APIRequestContext,
    userIds: string[],
    gameId: string,
    x: number,
    y: number,
): Promise<string> {
    for (const userId of userIds) {
        try {
            await placeStoneViaApi(request, userId, gameId, x, y);
            return userId;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('Not your turn') || message.includes('내 차례가 아닙니다')) {
                continue;
            }
            throw error;
        }
    }
    throw new Error('E2E: neither player could place a stone');
}

export async function placeHiddenStoneForEitherPlayerViaApi(
    request: APIRequestContext,
    userIds: string[],
    gameId: string,
    x: number,
    y: number,
): Promise<string> {
    for (const userId of userIds) {
        try {
            await startHiddenPlacementViaApi(request, userId, gameId);
            await placeStoneViaApi(request, userId, gameId, x, y, true);
            return userId;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('Not your turn')) {
                continue;
            }
            throw error;
        }
    }
    throw new Error('E2E: neither player could place a hidden stone');
}

export async function revealOpponentHiddenViaApi(
    request: APIRequestContext,
    userId: string,
    gameId: string,
    x: number,
    y: number,
): Promise<void> {
    await postGameAction(request, userId, 'REVEAL_OPPONENT_HIDDEN', { gameId, x, y });
}

export async function navigateToGameHash(page: Page, gameId: string): Promise<void> {
    await page.evaluate((id) => {
        window.location.hash = `#/game/${id}`;
    }, gameId);
    await page.waitForFunction((id) => window.location.hash.includes(id), gameId, { timeout: 15000 });
    await page.waitForTimeout(1200);
}

export async function startScanningViaApi(
    request: APIRequestContext,
    userId: string,
    gameId: string,
): Promise<void> {
    await postGameAction(request, userId, 'START_SCANNING', { gameId });
}

export async function scanBoardViaApi(
    request: APIRequestContext,
    userId: string,
    gameId: string,
    x: number,
    y: number,
): Promise<void> {
    await postGameAction(request, userId, 'SCAN_BOARD', { gameId, x, y });
}

export async function startMissileSelectionViaApi(
    request: APIRequestContext,
    userId: string,
    gameId: string,
): Promise<void> {
    await postGameAction(request, userId, 'START_MISSILE_SELECTION', { gameId });
}

export async function launchMissileViaApi(
    request: APIRequestContext,
    userId: string,
    gameId: string,
    fromX: number,
    fromY: number,
    direction: 'up' | 'down' | 'left' | 'right',
): Promise<void> {
    await postGameAction(request, userId, 'LAUNCH_MISSILE', {
        gameId,
        from: { x: fromX, y: fromY },
        direction,
    });
}

export async function missileAnimationCompleteViaApi(
    request: APIRequestContext,
    userId: string,
    gameId: string,
): Promise<void> {
    await postGameAction(request, userId, 'MISSILE_ANIMATION_COMPLETE', { gameId });
}

export async function cancelRankedMatchingViaApi(
    request: APIRequestContext,
    userId: string,
): Promise<void> {
    try {
        await postGameAction(request, userId, 'CANCEL_RANKED_MATCHING', {});
    } catch {
        // not in queue
    }
}

export async function startRankedMatchingViaApi(
    request: APIRequestContext,
    userId: string,
): Promise<E2eApiActionResult> {
    return postGameAction(request, userId, 'START_RANKED_MATCHING', {
        lobbyType: 'strategic',
        selectedModes: [GameMode.Standard],
    });
}

export type E2eRankedProposal = {
    proposalId: string;
    user1Id: string;
    user2Id: string;
};

/** E2E 전용: volatileState에서 유저의 랭킹 매칭 제안 조회 */
export async function fetchRankedProposalForUserViaApi(
    request: APIRequestContext,
    userId: string,
): Promise<E2eRankedProposal | null> {
    const api = e2eApiBaseUrl();
    const res = await request.post(`${api.replace(/\/$/, '')}/api/e2e/ranked-proposal-for-user`, {
        data: { userId },
        timeout: 10000,
    });
    if (res.status() === 404) {
        throw new Error(
            'E2E: /api/e2e/ranked-proposal-for-user not found — API 서버를 재시작하세요.',
        );
    }
    if (!res.ok()) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `ranked-proposal lookup failed (${res.status()})`);
    }
    const body = (await res.json()) as { proposalId?: string | null; user1Id?: string; user2Id?: string };
    if (!body.proposalId) return null;
    return {
        proposalId: body.proposalId,
        user1Id: body.user1Id ?? '',
        user2Id: body.user2Id ?? '',
    };
}

export async function waitForRankedProposalViaApi(
    request: APIRequestContext,
    userId: string,
    maxMs = 30000,
): Promise<E2eRankedProposal> {
    const started = Date.now();
    while (Date.now() - started < maxMs) {
        const proposal = await fetchRankedProposalForUserViaApi(request, userId);
        if (proposal) return proposal;
        await new Promise((resolve) => setTimeout(resolve, 400));
    }
    throw new Error('E2E: ranked match proposal not found');
}

export async function respondRankedMatchViaApi(
    request: APIRequestContext,
    userId: string,
    proposalId: string,
    accept: boolean,
): Promise<E2eApiActionResult> {
    return postGameAction(request, userId, 'RESPOND_RANKED_MATCH', { proposalId, accept });
}

/** 두 E2E 계정 랭킹 큐 정리 */
export async function cleanupRankedMatchingForE2eAccountsViaApi(
    request: APIRequestContext,
    userIds: string[],
): Promise<void> {
    for (const userId of userIds) {
        await cancelRankedMatchingViaApi(request, userId);
    }
}

/**
 * 두 E2E 유저 랭킹 매칭 → 양측 수락 → gameId 반환
 */
export async function startRankedPvpGameViaApi(
    request: APIRequestContext,
    userAId: string,
    userBId: string,
): Promise<{ gameId: string; userAId: string; userBId: string; proposalId: string }> {
    await cleanupRankedMatchingForE2eAccountsViaApi(request, [userAId, userBId]);
    const startA = await startRankedMatchingViaApi(request, userAId);
    if (startA.error) {
        throw new Error(`E2E: START_RANKED_MATCHING (A) failed: ${startA.error}`);
    }
    const startB = await startRankedMatchingViaApi(request, userBId);
    if (startB.error) {
        throw new Error(`E2E: START_RANKED_MATCHING (B) failed: ${startB.error}`);
    }
    const proposalId =
        (startB.rankedProposalId as string | null | undefined) ??
        (startA.rankedProposalId as string | null | undefined) ??
        (await waitForRankedProposalViaApi(request, userAId).catch(() => null))?.proposalId;
    if (!proposalId) {
        throw new Error('E2E: ranked match proposal not found after START_RANKED_MATCHING');
    }
    await respondRankedMatchViaApi(request, userAId, proposalId, true);
    const acceptB = await respondRankedMatchViaApi(request, userBId, proposalId, true);
    const gameId = acceptB.gameId as string | undefined;
    if (!gameId) {
        throw new Error('E2E: RESPOND_RANKED_MATCH did not return gameId');
    }
    return { gameId, userAId, userBId, proposalId };
}

