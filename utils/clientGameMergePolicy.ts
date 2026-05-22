import type { LiveGameSession } from '../types.js';
import { GameMode } from '../types.js';
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
    return coerceAdventureLiveGameScoringTurnLimit(seatLocked);
}

