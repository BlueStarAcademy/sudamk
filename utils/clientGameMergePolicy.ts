import type { LiveGameSession } from '../types.js';
import { GameMode } from '../types.js';
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
    resolveArenaSessionPolicy,
    type ArenaStateBucket,
} from '../shared/utils/liveSessionArenaKind.js';
import { getAdventureDesignScoringTurnLimit } from '../shared/utils/adventureBattleBoard.js';

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

import {
    isItemPhaseTransientAnimationType,
    wasItemPhaseAnimatingStatus,
} from '../shared/utils/itemPhaseAnimationTypes.js';
import { resolvePveScoringBoardAndMoveHistory } from './deferredWsBoardSnapshot.js';

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
    const incomingAnim = (incoming as { animation?: LiveGameSession['animation'] }).animation;
    return incomingAnim === undefined || incomingAnim === null;
}

/** @deprecated use shouldClearItemPhaseAnimationOnPlayingMerge */
export const shouldClearMissileFlightAnimationOnPlayingMerge = shouldClearItemPhaseAnimationOnPlayingMerge;

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
export function shouldIgnoreStaleLiveTerminalGameUpdate(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
): boolean {
    if (!existing) return false;

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
function mergeChessSessionFieldsOnMerge(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
): LiveGameSession {
    if (incoming.mode !== GameMode.Chess) return incoming;
    let merged: LiveGameSession = { ...incoming };
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
            chessPieceMovedThisTurn: existing!.chessPieceMovedThisTurn ?? merged.chessPieceMovedThisTurn,
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
    if (!existing) return incoming;
    const { boardState, moveHistory } = resolvePveScoringBoardAndMoveHistory(incoming, existing);
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
    return mergeChessSessionFieldsOnMerge(
        preserveCastleSessionFieldsOnMerge(
            coerceAdventureLiveGameScoringTurnLimit(seatLocked),
            existing,
        ),
        existing,
    );
}

