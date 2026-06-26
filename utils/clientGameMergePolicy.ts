import type { LiveGameSession } from '../types.js';
import { AlkkagiPlacementType, GameMode, Player } from '../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants.js';
import {
    boardHasStrayLegacyFlankStones,
    hasChessPiecesMovedFromStandardOpening,
    hasLegacyChessFlankPawnLayout,
    isLegacyChessGoLayout,
    isStandardChessGoOpeningLayout,
    normalizeChessGoSession,
    shouldPreserveChessGoMidgameState,
} from '../shared/utils/chessGoRules.js';
import {
    getArenaStateBucket,
    modeIncludesBaseRule,
    resolveArenaSessionPolicy,
    type ArenaStateBucket,
} from '../shared/utils/liveSessionArenaKind.js';
import { getAdventureDesignScoringTurnLimit } from '../shared/utils/adventureBattleBoard.js';
import {
    isItemPhasePresentationStillActive,
    isItemPhaseTransientAnimationType,
    wasItemPhaseAnimatingStatus,
} from '../shared/utils/itemPhaseAnimationTypes.js';
import {
    resolveChessPvePlayingSession,
    resolvePveScoringBoardAndMoveHistory,
    resolveStrategicPlayingBoardAndMoveHistory,
} from './deferredWsBoardSnapshot.js';

/**
 * 베이스 세션 본경기 단계의 좌석 잠금 보호:
 * `playingLockedBlackPlayerId/whitePlayerId`가 있는 본경기·아이템 연출 단계라면
 * `blackPlayerId/whitePlayerId`를 잠금값으로 되돌린다. INITIAL_STATE/HTTP 응답 등
 * 다양한 병합 경로에서 임시 좌석으로 새어들지 않게 하는 마지막 안전장치.
 *
 * 서버는 색이 확정되는 시점(finalize/komi bid 결과)에 좌석 잠금까지 같이 박는다.
 * 그래서 `base_game_start_confirmation`도 보호 대상에 포함해, 시작 확인 모달이 떠 있는 동안
 * 늦은 슬림 패킷이 좌석을 임시값으로 되돌리는 일을 막는다.
 */
const BASE_SEAT_LOCK_PROTECTED_STATUSES = new Set([
    'base_game_start_confirmation',
    'playing',
    'hidden_placing',
    'scanning',
    'scanning_animating',
    'hidden_reveal_animating',
    'hidden_final_reveal',
    'missile_selecting',
    'missile_animating',
    'scoring',
    'ended',
    'no_contest',
]);

function coerceBaseSessionPlayingSeatLock(session: LiveGameSession): LiveGameSession {
    const lb = (session as { playingLockedBlackPlayerId?: unknown }).playingLockedBlackPlayerId;
    const lw = (session as { playingLockedWhitePlayerId?: unknown }).playingLockedWhitePlayerId;
    if (typeof lb !== 'string' || lb.length === 0 || typeof lw !== 'string' || lw.length === 0) return session;
    if (!BASE_SEAT_LOCK_PROTECTED_STATUSES.has(String(session.gameStatus ?? ''))) return session;
    if (session.blackPlayerId === lb && session.whitePlayerId === lw) return session;
    return { ...session, blackPlayerId: lb, whitePlayerId: lw };
}

/**
 * 본대국 좌석 잠금이 있는데 들어온 패킷이 잠금만 비워서 들고 오면(슬림 WS·HTTP 응답 등)
 * 기존 클라 잠금값을 유지한다. 잠금이 사라지면 `coerceBaseSessionPlayingSeatLock`가 좌석을 되돌릴
 * 근거 자체를 잃기 때문이다.
 */
function preserveExistingBaseSeatLockAgainstSlimDrop(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
): LiveGameSession {
    if (!existing) return incoming;
    const elb = (existing as { playingLockedBlackPlayerId?: unknown }).playingLockedBlackPlayerId;
    const elw = (existing as { playingLockedWhitePlayerId?: unknown }).playingLockedWhitePlayerId;
    if (typeof elb !== 'string' || elb.length === 0 || typeof elw !== 'string' || elw.length === 0) return incoming;
    const ilb = (incoming as { playingLockedBlackPlayerId?: unknown }).playingLockedBlackPlayerId;
    const ilw = (incoming as { playingLockedWhitePlayerId?: unknown }).playingLockedWhitePlayerId;
    const incomingHasLock =
        typeof ilb === 'string' && ilb.length > 0 && typeof ilw === 'string' && ilw.length > 0;
    if (incomingHasLock) return incoming;
    return { ...incoming, playingLockedBlackPlayerId: elb, playingLockedWhitePlayerId: elw };
}

export type ClientGameMergeSource = 'initial_state' | 'game_update' | 'http_action';

export type ClientGameMergeContext = {
    source: ClientGameMergeSource;
    actionType?: string;
};

export function getClientArenaStateBucket(session: Partial<LiveGameSession> | null | undefined): ArenaStateBucket {
    return getArenaStateBucket(session as any);
}

export function coerceAdventureLiveGameScoringTurnLimit(session: LiveGameSession): LiveGameSession {
    const policy = resolveArenaSessionPolicy(session as any);
    const captureish =
        session.mode === GameMode.Capture ||
        (session.mode === GameMode.Mix && Boolean((session.settings as any)?.mixedModes?.includes?.(GameMode.Capture)));
    if (!policy.usesAdventureScoringCap || captureish) return session;

    const bsRaw = Number(session.settings?.boardSize ?? (session as any).adventureBoardSize);
    if (!Number.isFinite(bsRaw) || bsRaw <= 0) return session;
    const lim = getAdventureDesignScoringTurnLimit(Math.floor(bsRaw));
    if (lim == null || lim <= 0) return session;
    if ((session.settings as any)?.scoringTurnLimit === lim) return session;
    return {
        ...session,
        settings: { ...(session.settings as any), scoringTurnLimit: lim },
    };
}

/** 정책 기반: 아이템 페이즈 연출 종료 후 playing 패킷에서 animation 잔존 방지 */
export function shouldClearItemPhaseAnimationOnPlayingMerge(
    existing: LiveGameSession | undefined,
    incoming: LiveGameSession,
): boolean {
    if (!existing || incoming.gameStatus !== 'playing') return false;
    const policy = resolveArenaSessionPolicy(incoming as any);
    if (!policy.clearsItemPhaseAnimationOnPlaying) return false;
    const prevWasItemPhaseAnimating =
        wasItemPhaseAnimatingStatus(existing.gameStatus) ||
        isItemPhaseTransientAnimationType(existing.animation as any);
    if (!prevWasItemPhaseAnimating) return false;
    if (isItemPhasePresentationStillActive(existing as LiveGameSession)) return false;
    const incomingAnim = (incoming as { animation?: LiveGameSession['animation'] }).animation;
    return incomingAnim === undefined || incomingAnim === null;
}

/** @deprecated use shouldClearItemPhaseAnimationOnPlayingMerge */
export const shouldClearMissileFlightAnimationOnPlayingMerge = shouldClearItemPhaseAnimationOnPlayingMerge;

function boardGridHasStones(boardState: unknown): boolean {
    if (!boardState || !Array.isArray(boardState) || boardState.length === 0) return false;
    return boardState.some(
        (row: unknown) =>
            Array.isArray(row) && row.some((cell: unknown) => cell !== Player.None && cell != null),
    );
}

function isPveAiHiddenPresentationSession(
    session: Pick<LiveGameSession, 'animation'> & { aiHiddenItemAnimationEndTime?: number },
): boolean {
    const anim = session.animation as { type?: string } | null | undefined;
    return anim?.type === 'ai_thinking' || session.aiHiddenItemAnimationEndTime != null;
}

/**
 * 모험·길드전 등 liveGames: goAiBot AI 히든 연출 패킷이 boardState를 생략할 때
 * 기존 판·수순·연출 종료 시각을 유지한다.
 */
export function preservePveAiHiddenPresentationOnMerge(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
): LiveGameSession {
    if (!existing) return incoming;

    const presentationActive =
        isPveAiHiddenPresentationSession(incoming as LiveGameSession) ||
        isPveAiHiddenPresentationSession(existing as LiveGameSession) ||
        isItemPhasePresentationStillActive(existing as LiveGameSession);

    if (!presentationActive) return incoming;

    let merged = incoming;
    const incomingHasBoard = boardGridHasStones(incoming.boardState);
    const existingHasBoard = boardGridHasStones(existing.boardState);
    if (!incomingHasBoard && existingHasBoard) {
        merged = {
            ...merged,
            boardState: existing.boardState,
            moveHistory:
                Array.isArray(existing.moveHistory) && existing.moveHistory.length > 0
                    ? existing.moveHistory
                    : merged.moveHistory,
        };
    }

    const existingEnd = (existing as { aiHiddenItemAnimationEndTime?: number }).aiHiddenItemAnimationEndTime;
    const incomingEnd = (incoming as { aiHiddenItemAnimationEndTime?: number }).aiHiddenItemAnimationEndTime;
    const preservedEnd =
        typeof existingEnd === 'number' && typeof incomingEnd === 'number'
            ? Math.max(existingEnd, incomingEnd)
            : existingEnd ?? incomingEnd;
    if (typeof preservedEnd === 'number' && preservedEnd !== incomingEnd) {
        merged = { ...merged, aiHiddenItemAnimationEndTime: preservedEnd } as LiveGameSession;
    }

    if (
        isItemPhasePresentationStillActive(existing as LiveGameSession) &&
        (incoming.animation === undefined || incoming.animation === null) &&
        existing.animation
    ) {
        merged = { ...merged, animation: existing.animation };
    }

    return merged;
}

const STRATEGIC_ITEM_INVENTORY_KEYS = [
    'hidden_stones_p1',
    'hidden_stones_p2',
    'scans_p1',
    'scans_p2',
    'missiles_p1',
    'missiles_p2',
] as const;

/** PVP 등: 늦은 WS 패킷이 이미 소모된 아이템 잔여를 설정값으로 되돌리지 않도록 min 병합 */
function mergeStrategicItemInventoryMonotonic(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
): LiveGameSession {
    if (!existing) return incoming;
    const patch: Partial<LiveGameSession> = {};
    let changed = false;
    for (const key of STRATEGIC_ITEM_INVENTORY_KEYS) {
        const inc = (incoming as Record<string, unknown>)[key];
        const ext = (existing as Record<string, unknown>)[key];
        if (typeof inc !== 'number' || typeof ext !== 'number') continue;
        const next = Math.min(inc, ext);
        if (next !== inc) {
            (patch as Record<string, number>)[key] = next;
            changed = true;
        }
    }
    return changed ? ({ ...incoming, ...patch } as LiveGameSession) : incoming;
}

/**
 * human PVP/페어 liveGames: 계가·종료 직후 늦게 도착한 playing/pending 패킷이 로컬 상태를 되돌리면
 * 계가 연출만 끝나고 영토·결과 모달·종료 푸터가 영원히 갱신되지 않는다.
 */
const PVE_BASE_PRE_PLAY_STATUSES = new Set([
    'base_placement',
    'base_stone_color_choice',
    'base_same_color_points_bid',
    'base_game_start_confirmation',
]);

const PVE_CAPTURE_PRE_PLAY_STATUSES = new Set([
    'capture_bidding',
    'capture_reveal',
    'capture_tiebreaker',
]);

/** PVE 경기 시작 확인(시작 모달) 직후·0수인 사전 단계 */
export function isPvePostStartConfirmPrePlayPhase(session: LiveGameSession): boolean {
    if (resolveArenaSessionPolicy(session as any).matchAxis !== 'pve') return false;
    const st = String(session.gameStatus || '');
    const inPhase =
        st === 'playing' ||
        PVE_BASE_PRE_PLAY_STATUSES.has(st) ||
        PVE_CAPTURE_PRE_PLAY_STATUSES.has(st);
    if (!inPhase) return false;
    const moves = session.moveHistory?.filter((m) => m.x !== -1 && m.y !== -1).length ?? 0;
    return moves === 0;
}

const AI_LOBBY_POST_START_CONFIRM_STATUSES = new Set([
    'playing',
    ...PVE_BASE_PRE_PLAY_STATUSES,
    ...PVE_CAPTURE_PRE_PLAY_STATUSES,
    'dice_rolling',
    'dice_start_confirmation',
    'curling_start_confirmation',
    'alkkagi_start_confirmation',
    'alkkagi_simultaneous_placement',
    'thief_rps',
    'thief_rolling',
    'chess_piece_placement',
    'alkkagi_placement',
    'alkkagi_playing',
    'curling_playing',
    'uniform_color_roulette',
    'nigiri_reveal',
]);

/** 로비 AI 대국: CONFIRM 직전 pending에서 human 색 (서버 resolveStrategicAiHumanColor와 동일) */
export function resolveAiLobbyHumanPlayerColor(session: LiveGameSession): Player.Black | Player.White {
    const settings = session.settings;
    if (session.gameCategory === 'adventure') {
        if (session.mode === GameMode.Capture) return Player.Black;
        if (session.mode !== GameMode.Base) {
            return settings?.player1Color ?? Player.Black;
        }
    }
    return settings?.player1Color ?? Player.Black;
}

function assignAiLobbySeatColors(session: LiveGameSession, humanColor: Player.Black | Player.White) {
    const humanId = session.player1?.id;
    const botId = session.player2?.id;
    if (!humanId || !botId) return session;
    const blackPlayerId = humanColor === Player.Black ? humanId : botId;
    const whitePlayerId = humanColor === Player.White ? humanId : botId;
    return { ...session, blackPlayerId, whitePlayerId };
}

/**
 * CONFIRM_AI_GAME_START HTTP 왕복 전 클라이언트가 규칙 모달을 즉시 내리고 인게임 UI를 보여주기 위한 낙관 상태.
 * 서버와 어긋날 수 있는 랜덤 요소(베이스 AI 돌 좌표 등)는 HTTP/WS 병합으로 덮어쓴다.
 */
export function buildOptimisticAiLobbyStartSession(
    session: LiveGameSession,
    now: number = Date.now(),
): LiveGameSession | null {
    if (!session.isAiGame || session.isSinglePlayer || session.gameCategory === 'tower' || session.gameCategory === 'singleplayer') {
        return null;
    }
    if (session.gameStatus !== 'pending') return null;
    if (!session.player1?.id || !session.player2?.id) return null;
    if (session.gameCategory === 'adventure') return null;

    const humanColor = resolveAiLobbyHumanPlayerColor(session);
    let next = assignAiLobbySeatColors(session, humanColor);
    const p1Id = session.player1.id;
    const p2Id = session.player2.id;

    const isStrategic = SPECIAL_GAME_MODES.some((m) => m.mode === session.mode);
    if (isStrategic) {
        if (session.mode === GameMode.Chess) {
            const boardSize = session.settings.boardSize === 9 ? 9 : 13;
            const emptyBoard = Array.from({ length: boardSize }, () =>
                Array.from({ length: boardSize }, () => Player.None),
            );
            return {
                ...next,
                gameStatus: 'chess_piece_placement',
                chessPieceMovedThisTurn: false,
                chessCaptureScore: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
                boardState: emptyBoard,
            };
        }
        if (session.mode === GameMode.Base || modeIncludesBaseRule(session.mode, session.settings)) {
            return {
                ...next,
                gameStatus: 'base_placement',
                baseStones_p1: [],
                baseStones_p2: [],
                basePlacementReady: { [p1Id]: false, [p2Id]: false },
                settings: { ...next.settings, komi: 0.5 },
            };
        }
        if (session.mode === GameMode.Capture && session.gameCategory !== 'adventure') {
            const st = session.settings as {
                captureTarget?: number;
                captureTargetBlack?: number;
                captureTargetWhite?: number;
            };
            const blackTarget = typeof st.captureTargetBlack === 'number' ? st.captureTargetBlack : (st.captureTarget ?? 20);
            const whiteTarget = typeof st.captureTargetWhite === 'number' ? st.captureTargetWhite : (st.captureTarget ?? 20);
            return {
                ...next,
                gameStatus: 'playing',
                currentPlayer: Player.Black,
                gameStartTime: now,
                startTime: now,
                turnStartTime: now,
                effectiveCaptureTargets: {
                    [Player.None]: 0,
                    [Player.Black]: blackTarget,
                    [Player.White]: whiteTarget,
                },
            };
        }
        return {
            ...next,
            gameStatus: 'playing',
            currentPlayer: Player.Black,
            gameStartTime: now,
            startTime: now,
            turnStartTime: now,
        };
    }

    const isPlayful = PLAYFUL_GAME_MODES.some((m) => m.mode === session.mode);
    if (isPlayful) {
        if (session.mode === GameMode.Dice) {
            return {
                ...next,
                gameStatus: 'dice_rolling',
                currentPlayer: Player.Black,
                turnStartTime: now,
            };
        }
        if (session.mode === GameMode.Thief) {
            return {
                ...next,
                gameStatus: 'thief_rolling',
                currentPlayer: Player.Black,
                turnStartTime: now,
            };
        }
        if (session.mode === GameMode.Omok || session.mode === GameMode.Ttamok) {
            return {
                ...next,
                gameStatus: 'playing',
                currentPlayer: Player.Black,
                gameStartTime: now,
                startTime: now,
                turnStartTime: now,
            };
        }
        if (session.mode === GameMode.Alkkagi) {
            const placementType = session.settings.alkkagiPlacementType;
            const turnByTurn = placementType === AlkkagiPlacementType.TurnByTurn;
            return {
                ...next,
                gameStatus: turnByTurn ? 'alkkagi_placement' : 'alkkagi_simultaneous_placement',
                currentPlayer: turnByTurn ? Player.Black : Player.None,
                turnStartTime: now,
            };
        }
        if (session.mode === GameMode.Curling) {
            return {
                ...next,
                gameStatus: 'curling_playing',
                currentPlayer: Player.Black,
                turnStartTime: now,
                curlingRound: 1,
            };
        }
    }

    return {
        ...next,
        gameStatus: 'playing',
        currentPlayer: Player.Black,
        gameStartTime: now,
        startTime: now,
        turnStartTime: now,
    };
}

/** CONFIRM 직후 낙관 playing/사전단계인데 늦은 pending WS/HTTP가 덮는 것 방지 (로비 AI) */
export function shouldIgnoreStalePendingAiLobbyStartRegression(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
): boolean {
    if (!existing || incoming.gameStatus !== 'pending') return false;
    if (existing.gameStatus === 'pending') return false;
    if (!existing.isAiGame || existing.isSinglePlayer || existing.gameCategory === 'tower' || existing.gameCategory === 'singleplayer') {
        return false;
    }

    const existingStarted =
        AI_LOBBY_POST_START_CONFIRM_STATUSES.has(String(existing.gameStatus)) ||
        (existing as { startTime?: number | null }).startTime != null ||
        (existing as { gameStartTime?: number | null }).gameStartTime != null;

    if (!existingStarted) return false;

    const ir = incoming.serverRevision ?? 0;
    const er = existing.serverRevision ?? 0;
    if (ir > 0 && er > 0 && ir > er) return false;

    return true;
}

/** 싱글/타워 시작 모달을 띄워야 하는 pending·0수·시작 시각 없음 상태 */
export function isPveAwaitingStartConfirmModal(session: LiveGameSession): boolean {
    if (resolveArenaSessionPolicy(session as any).matchAxis !== 'pve') return false;
    if (session.gameStatus !== 'pending') return false;
    if ((session as { startTime?: number | null }).startTime != null) return false;
    if ((session as { gameStartTime?: number | null }).gameStartTime != null) return false;
    const moves = session.moveHistory?.filter((m) => m.x !== -1 && m.y !== -1).length ?? 0;
    return moves === 0;
}

/**
 * CONFIRM 직후 로컬은 `playing`(0수)·베이스/덤 사전 단계인데 늦게 도착한 `pending` WS/HTTP가
 * 덮으면 시작 모달이 닫히지 않고「시작하기」가 먹지 않는 것처럼 보인다.
 */
export function shouldIgnoreStalePendingPveStartRegression(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
): boolean {
    if (!existing || incoming.gameStatus !== 'pending') return false;
    if (existing.gameStatus === 'pending') return false;

    const existingStarted =
        existing.gameStatus === 'playing' ||
        PVE_BASE_PRE_PLAY_STATUSES.has(String(existing.gameStatus)) ||
        PVE_CAPTURE_PRE_PLAY_STATUSES.has(String(existing.gameStatus)) ||
        (existing as { startTime?: number | null }).startTime != null ||
        (existing as { gameStartTime?: number | null }).gameStartTime != null;

    if (!existingStarted) return false;

    const ir = incoming.serverRevision ?? 0;
    const er = existing.serverRevision ?? 0;
    if (ir > 0 && er > 0 && ir > er) return false;

    return true;
}

export function shouldIgnoreStaleLiveTerminalGameUpdate(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
): boolean {
    if (!existing) return false;

    // PVE pending → playing/베이스·덤 사전 단계: CONFIRM 직후 forward progress는 ended 등 terminal 보존에 막히면 안 된다.
    if (resolveArenaSessionPolicy(incoming as any).matchAxis === 'pve') {
        const incSt = String(incoming.gameStatus);
        const exSt = String(existing.gameStatus || '');
        const incomingForwardStart =
            incSt === 'playing' ||
            PVE_BASE_PRE_PLAY_STATUSES.has(incSt) ||
            PVE_CAPTURE_PRE_PLAY_STATUSES.has(incSt);
        if (exSt === 'pending' && incomingForwardStart) {
            return false;
        }
    }

    const localAdvanced =
        existing.gameStatus === 'scoring' ||
        existing.gameStatus === 'hidden_final_reveal' ||
        existing.gameStatus === 'ended' ||
        existing.gameStatus === 'no_contest';
    if (!localAdvanced) return false;

    const incomingPostPlayOk =
        incoming.gameStatus === 'ended' ||
        incoming.gameStatus === 'no_contest' ||
        incoming.gameStatus === 'scoring' ||
        incoming.gameStatus === 'hidden_final_reveal';

    if (
        (existing.gameStatus === 'ended' || existing.gameStatus === 'no_contest') &&
        !incomingPostPlayOk
    ) {
        return true;
    }

    if (existing.gameStatus === 'scoring' && incoming.gameStatus === 'pending') {
        return true;
    }

    const incomingMoves = Array.isArray(incoming.moveHistory) ? incoming.moveHistory.length : 0;
    const existingMoves = Array.isArray(existing.moveHistory) ? existing.moveHistory.length : 0;
    if (
        existing.gameStatus === 'scoring' &&
        incoming.gameStatus === 'playing' &&
        incomingMoves <= existingMoves
    ) {
        return true;
    }

    return false;
}

/**
 * ended/no_contest/scoring 등으로 이미 진행된 로컬 상태를 playing/pending 등으로 되돌리지 않는다.
 * WS GAME_UPDATE뿐 아니라 HTTP·아레나 병합 경로에도 동일한 판단을 적용한다.
 */
export function preserveTerminalGameSessionOnMerge(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
): LiveGameSession {
    if (!existing || !shouldIgnoreStaleLiveTerminalGameUpdate(incoming, existing)) {
        return incoming;
    }
    if (
        (incoming.gameStatus === 'ended' || incoming.gameStatus === 'no_contest') &&
        (existing.gameStatus === 'ended' || existing.gameStatus === 'no_contest')
    ) {
        const incomingSummaryKeys =
            incoming.summary && typeof incoming.summary === 'object'
                ? Object.keys(incoming.summary as object)
                : [];
        const existingSummaryKeys =
            existing.summary && typeof existing.summary === 'object'
                ? Object.keys(existing.summary as object)
                : [];
        if (incomingSummaryKeys.length > existingSummaryKeys.length) {
            return { ...existing, ...incoming };
        }
    }
    return existing;
}

function mergeCaptureCountMonotonic(
    existing: LiveGameSession['captures'] | undefined,
    incoming: LiveGameSession['captures'] | undefined,
): LiveGameSession['captures'] | undefined {
    if (!existing || !incoming) return incoming ?? existing;
    const patch: Record<number, number> = { ...(incoming as Record<number, number>) };
    let changed = false;
    for (const key of [0, 1, 2] as const) {
        const ext = (existing as Record<number, number>)[key];
        const inc = (incoming as Record<number, number>)[key];
        if (typeof ext === 'number' && typeof inc === 'number' && ext > inc) {
            patch[key] = ext;
            changed = true;
        }
    }
    return changed ? (patch as LiveGameSession['captures']) : incoming;
}

/** 수순만 진행되고 captures가 그대로면 이전 턴 justCaptured는 재생용 페이로드로 취급하지 않는다. */
function stripStaleJustCapturedOnMerge(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
): LiveGameSession {
    if (!existing?.justCaptured?.length || !incoming.justCaptured?.length) return incoming;
    const incomingMoves = incoming.moveHistory?.length ?? 0;
    const existingMoves = existing.moveHistory?.length ?? 0;
    if (incomingMoves <= existingMoves) return incoming;
    const capturesUnchanged = ([0, 1, 2] as const).every(
        (p) => (incoming.captures?.[p] ?? 0) === (existing.captures?.[p] ?? 0),
    );
    if (!capturesUnchanged) return incoming;
    return { ...incoming, justCaptured: [] };
}

/** 캐슬 바둑: 슬림 패킷이 castleStonePoints·확정 영토를 비우면 기존 값을 유지한다. */
function preserveCastleSessionFieldsOnMerge(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
): LiveGameSession {
    if (!existing) return incoming;
    let merged = incoming;
    if (
        (!incoming.castleStonePoints || incoming.castleStonePoints.length === 0) &&
        existing.castleStonePoints &&
        existing.castleStonePoints.length > 0
    ) {
        merged = { ...merged, castleStonePoints: existing.castleStonePoints };
    }
    const incomingTerritory = incoming.confirmedTerritoryOwnerByPoint;
    const existingTerritory = existing.confirmedTerritoryOwnerByPoint;
    if (!incomingTerritory && existingTerritory) {
        merged = { ...merged, confirmedTerritoryOwnerByPoint: existingTerritory };
    } else if (incomingTerritory && existingTerritory) {
        merged = {
            ...merged,
            confirmedTerritoryOwnerByPoint: { ...existingTerritory, ...incomingTerritory },
        };
    }
    return merged;
}

/** 체스 바둑: 레거시 sessionStorage·슬림 패킷이 측면 폰/잘못된 기물 순서를 남기지 않게 표준 배치로 교정 */
function preserveChessPlayingStateWhenMoveHistoryRegresses(
    merged: LiveGameSession,
    existing: LiveGameSession | undefined,
): LiveGameSession {
    if (merged.gameStatus !== 'playing' || existing?.gameStatus !== 'playing') return merged;
    const exLen = Array.isArray(existing.moveHistory) ? existing.moveHistory.length : 0;
    const inLen = Array.isArray(merged.moveHistory) ? merged.moveHistory.length : 0;
    if (exLen === 0) return merged;

    const lastMovesMatch = (): boolean => {
        if (exLen !== inLen || !existing!.moveHistory || !merged.moveHistory) return true;
        const lastEx = existing!.moveHistory[exLen - 1];
        const lastIn = merged.moveHistory[inLen - 1];
        return !!(
            lastEx &&
            lastIn &&
            lastEx.x === lastIn.x &&
            lastEx.y === lastIn.y &&
            lastEx.player === lastIn.player
        );
    };

    if (exLen > inLen || (exLen === inLen && !lastMovesMatch())) {
        return {
            ...merged,
            moveHistory: existing!.moveHistory,
            boardState: existing!.boardState,
            chessPieces: existing!.chessPieces,
            chessGoRemovedPoints: existing!.chessGoRemovedPoints,
            lastChessMove: existing!.lastChessMove,
            chessPieceMovedThisTurn: existing!.chessPieceMovedThisTurn,
            chessCaptureScore: existing!.chessCaptureScore,
            koInfo: existing!.koInfo,
            lastMove: existing!.lastMove,
            captures: existing!.captures,
        };
    }
    return merged;
}

function incomingUsesChessGo(session: LiveGameSession): boolean {
    return (
        session.mode === GameMode.Chess ||
        (session.mode === GameMode.Mix && Boolean(session.settings?.mixedModes?.includes(GameMode.Chess)))
    );
}

function mergeChessSessionFieldsOnMerge(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
): LiveGameSession {
    if (!incomingUsesChessGo(incoming)) return incoming;
    let merged: LiveGameSession = preserveChessPlayingStateWhenMoveHistoryRegresses(
        { ...incoming },
        existing,
    );
    if (
        merged.gameStatus === 'playing' &&
        existing?.gameStatus === 'chess_piece_placement'
    ) {
        merged = {
            ...merged,
            chessPiecePlacementDraft: undefined,
            chessPiecePlacementReady: undefined,
            chessPiecePlacementDeadline: undefined,
        };
        if (incoming.chessPieces?.length) {
            merged = { ...merged, chessPieces: incoming.chessPieces };
        }
        if (incoming.boardState?.length) {
            merged = { ...merged, boardState: incoming.boardState };
        }
        if (incoming.settings?.chessPieceTotalScore != null) {
            merged = {
                ...merged,
                settings: {
                    ...merged.settings,
                    chessPieceTotalScore: incoming.settings.chessPieceTotalScore,
                },
            };
        }
    }
    if (merged.gameStatus === 'chess_piece_placement') {
        if (existing?.chessPiecePlacementDraft && incoming.chessPiecePlacementDraft) {
            merged = {
                ...merged,
                chessPiecePlacementDraft: {
                    ...existing.chessPiecePlacementDraft,
                    ...incoming.chessPiecePlacementDraft,
                },
                chessPiecePlacementReady: {
                    ...(existing.chessPiecePlacementReady ?? {}),
                    ...(incoming.chessPiecePlacementReady ?? {}),
                },
            };
        } else if (incoming.chessPiecePlacementDraft === undefined && existing?.chessPiecePlacementDraft) {
            merged = { ...merged, chessPiecePlacementDraft: existing.chessPiecePlacementDraft };
        }
        if (incoming.chessPiecePlacementReady === undefined && existing?.chessPiecePlacementReady) {
            merged = { ...merged, chessPiecePlacementReady: existing.chessPiecePlacementReady };
        }
        if (incoming.chessPiecePlacementDeadline === undefined && existing?.chessPiecePlacementDeadline != null) {
            merged = { ...merged, chessPiecePlacementDeadline: existing.chessPiecePlacementDeadline };
        }
    }
    if (
        existing?.boardState?.length &&
        merged.boardState?.length &&
        boardHasStrayLegacyFlankStones(merged) &&
        !boardHasStrayLegacyFlankStones({ ...merged, boardState: existing.boardState })
    ) {
        merged = { ...merged, boardState: existing.boardState };
    }
    if (
        (!incoming.chessPieces || incoming.chessPieces.length === 0) &&
        existing?.chessPieces &&
        existing.chessPieces.length > 0
    ) {
        if (!hasLegacyChessFlankPawnLayout(existing.chessPieces)) {
            merged = { ...merged, chessPieces: existing.chessPieces };
        }
    }
    if (incoming.chessCaptureScore == null && existing?.chessCaptureScore) {
        merged = { ...merged, chessCaptureScore: existing.chessCaptureScore };
    }
    if (incoming.chessPieceMovedThisTurn == null && existing?.chessPieceMovedThisTurn != null) {
        merged = { ...merged, chessPieceMovedThisTurn: existing.chessPieceMovedThisTurn };
    }
    if (incoming.lastChessMove === undefined && existing?.lastChessMove) {
        merged = { ...merged, lastChessMove: existing.lastChessMove };
    }
    {
        const removedKeys = new Set<string>();
        const mergedRemoved: NonNullable<LiveGameSession['chessGoRemovedPoints']> = [];
        for (const p of [...(existing?.chessGoRemovedPoints ?? []), ...(incoming.chessGoRemovedPoints ?? [])]) {
            const key = `${p.x},${p.y}`;
            if (removedKeys.has(key)) continue;
            removedKeys.add(key);
            mergedRemoved.push({ x: p.x, y: p.y });
        }
        if (mergedRemoved.length > 0) {
            merged = { ...merged, chessGoRemovedPoints: mergedRemoved };
        } else if (incoming.chessGoRemovedPoints === undefined && existing?.chessGoRemovedPoints?.length) {
            merged = { ...merged, chessGoRemovedPoints: existing.chessGoRemovedPoints };
        }
    }
    const existingPiecesMoved = hasChessPiecesMovedFromStandardOpening(existing?.chessPieces);
    const incomingPiecesMoved = hasChessPiecesMovedFromStandardOpening(merged.chessPieces);
    const existingPreserveMidgame = existing ? shouldPreserveChessGoMidgameState(existing) : false;
    if (
        (existingPiecesMoved || existingPreserveMidgame) &&
        (!merged.chessPieces?.length || !incomingPiecesMoved)
    ) {
        merged = {
            ...merged,
            chessPieces: existing!.chessPieces,
            chessPieceMovedThisTurn: merged.chessPieceMovedThisTurn ?? existing!.chessPieceMovedThisTurn,
            chessCaptureScore: existing!.chessCaptureScore ?? merged.chessCaptureScore,
        };
    }
    const existingStandard =
        existing?.chessPieces &&
        isStandardChessGoOpeningLayout(existing.chessPieces) &&
        !existingPiecesMoved;
    const incomingLegacy =
        merged.chessPieces && isLegacyChessGoLayout(merged.chessPieces);
    if (existingStandard && incomingLegacy) {
        merged = {
            ...merged,
            chessPieces: existing!.chessPieces,
            chessCaptureScore: existing!.chessCaptureScore ?? merged.chessCaptureScore,
        };
    }
    return normalizeChessGoSession(merged);
}

/** rejoin·계가 폴링·INITIAL_STATE 직후: 슬림 서버 스냅샷이 로컬 판·수순·계가를 덮지 않게 병합한다. */
export function mergeLiveRejoinResponseWithExistingBoard(
    existing: LiveGameSession | undefined,
    incoming: LiveGameSession,
): LiveGameSession {
    if (incoming.mode === GameMode.Chess && incoming.gameStatus === 'playing') {
        const chessResolved = resolveChessPvePlayingSession(incoming, existing ?? incoming);
        let merged: LiveGameSession = chessResolved;
        if (existing) {
            merged = preserveTerminalAnalysisResultOnMerge(merged, existing);
            merged = preserveCastleSessionFieldsOnMerge(merged, existing);
            merged = mergeChessSessionFieldsOnMerge(merged, existing);
            const incomingSummaryKeys =
                merged.summary && typeof merged.summary === 'object' ? Object.keys(merged.summary as object) : [];
            if (
                (merged.gameStatus === 'ended' || merged.gameStatus === 'no_contest') &&
                incomingSummaryKeys.length === 0 &&
                existing.summary &&
                typeof existing.summary === 'object' &&
                Object.keys(existing.summary as object).length > 0
            ) {
                merged = { ...merged, summary: existing.summary };
            }
        }
        return merged;
    }
    if (!existing) {
        if (incoming.gameStatus === 'playing' && (incoming.moveHistory?.length ?? 0) > 0) {
            const resolved = resolveStrategicPlayingBoardAndMoveHistory(incoming, incoming);
            return { ...incoming, boardState: resolved.boardState, moveHistory: resolved.moveHistory };
        }
        return incoming;
    }
    const boardAndHistory =
        incoming.gameStatus === 'playing'
            ? resolveStrategicPlayingBoardAndMoveHistory(incoming, existing)
            : resolvePveScoringBoardAndMoveHistory(incoming, existing);
    const { boardState, moveHistory } = boardAndHistory;
    let merged: LiveGameSession = {
        ...incoming,
        boardState,
        moveHistory,
        captures: mergeCaptureCountMonotonic(existing.captures, incoming.captures) ?? incoming.captures ?? existing.captures,
        baseStoneCaptures:
            mergeCaptureCountMonotonic(
                existing.baseStoneCaptures as LiveGameSession['captures'],
                incoming.baseStoneCaptures as LiveGameSession['captures'],
            ) ?? incoming.baseStoneCaptures ?? existing.baseStoneCaptures,
        hiddenStoneCaptures:
            mergeCaptureCountMonotonic(
                existing.hiddenStoneCaptures as LiveGameSession['captures'],
                incoming.hiddenStoneCaptures as LiveGameSession['captures'],
            ) ?? incoming.hiddenStoneCaptures ?? existing.hiddenStoneCaptures,
    };
    merged = preserveTerminalAnalysisResultOnMerge(merged, existing);
    merged = preserveCastleSessionFieldsOnMerge(merged, existing);
    merged = mergeChessSessionFieldsOnMerge(merged, existing);
    const incomingSummaryKeys =
        merged.summary && typeof merged.summary === 'object' ? Object.keys(merged.summary as object) : [];
    if (
        (merged.gameStatus === 'ended' || merged.gameStatus === 'no_contest') &&
        incomingSummaryKeys.length === 0 &&
        existing.summary &&
        typeof existing.summary === 'object' &&
        Object.keys(existing.summary as object).length > 0
    ) {
        merged = { ...merged, summary: existing.summary };
    }
    return merged;
}

/** ended 슬림 패킷에 analysisResult가 빠지면 계가 영토·결과 모달이 비는 레이스를 막는다. */
export function preserveTerminalAnalysisResultOnMerge(
    merged: LiveGameSession,
    existing: LiveGameSession | undefined,
): LiveGameSession {
    if (
        (merged.gameStatus === 'ended' || merged.gameStatus === 'no_contest') &&
        existing?.analysisResult &&
        (existing.analysisResult as Record<string, unknown>)['system'] &&
        (!(merged as { analysisResult?: Record<string, unknown> }).analysisResult ||
            !(merged as { analysisResult?: Record<string, unknown> }).analysisResult!['system'])
    ) {
        return {
            ...merged,
            analysisResult: {
                ...((merged as { analysisResult?: Record<string, unknown> }).analysisResult || {}),
                system: (existing.analysisResult as Record<string, unknown>)['system'],
            },
        } as LiveGameSession;
    }
    return merged;
}

export function mergeGameUpdateByArena(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
    _context: ClientGameMergeContext,
): LiveGameSession {
    /** 들어온 패킷이 좌석 잠금을 비운 채 오면 기존 잠금을 살려 두어, 좌석 보호 근거를 잃지 않게 한다. */
    const incomingWithLock = preserveExistingBaseSeatLockAgainstSlimDrop(incoming, existing);
    let merged = existing ? ({ ...existing, ...incomingWithLock } as LiveGameSession) : incomingWithLock;
    merged = preservePveAiHiddenPresentationOnMerge(merged, existing);
    if (
        existing &&
        incomingWithLock.gameStatus === 'playing' &&
        isItemPhasePresentationStillActive(existing) &&
        (existing.animation as { type?: string } | null | undefined)?.type === 'hidden_reveal'
    ) {
        merged = {
            ...merged,
            gameStatus: 'hidden_reveal_animating',
            animation: existing.animation ?? merged.animation,
            revealAnimationEndTime: existing.revealAnimationEndTime ?? merged.revealAnimationEndTime,
            pendingCapture: existing.pendingCapture ?? merged.pendingCapture,
        };
    }
    merged = stripStaleJustCapturedOnMerge(merged, existing);
    merged = mergeStrategicItemInventoryMonotonic(merged, existing);
    if (shouldClearItemPhaseAnimationOnPlayingMerge(existing, incoming)) {
        merged = { ...merged, animation: null } as LiveGameSession;
        if (
            wasItemPhaseAnimatingStatus(existing?.gameStatus) &&
            existing?.gameStatus === 'hidden_reveal_animating'
        ) {
            merged = { ...merged, revealAnimationEndTime: undefined } as LiveGameSession;
        }
    }
    /** 본경기·시작 확인 단계로 들어온 패킷이 임시 좌석을 들고 오면 잠금값으로 되돌린다(흑/백 영구 스왑 방지). */
    const seatLocked = coerceBaseSessionPlayingSeatLock(merged);
    const arenaMerged = mergeChessSessionFieldsOnMerge(
        preserveCastleSessionFieldsOnMerge(
            coerceAdventureLiveGameScoringTurnLimit(seatLocked),
            existing,
        ),
        existing,
    );
    const isPveStartConfirm =
        _context.actionType === 'CONFIRM_SINGLE_PLAYER_GAME_START' ||
        _context.actionType === 'CONFIRM_TOWER_GAME_START';
    if (isPveStartConfirm) {
        return arenaMerged;
    }
    return preserveTerminalGameSessionOnMerge(arenaMerged, existing);
}

