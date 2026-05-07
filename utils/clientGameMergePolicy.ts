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
 */
const BASE_SEAT_LOCK_PROTECTED_STATUSES = new Set([
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
    const includesBase =
        session.mode === GameMode.Base ||
        (session.mode === GameMode.Mix &&
            Array.isArray((session.settings as any)?.mixedModes) &&
            (session.settings as any).mixedModes.includes(GameMode.Base));
    if (!includesBase) return session;
    const lb = (session as { playingLockedBlackPlayerId?: unknown }).playingLockedBlackPlayerId;
    const lw = (session as { playingLockedWhitePlayerId?: unknown }).playingLockedWhitePlayerId;
    if (typeof lb !== 'string' || lb.length === 0 || typeof lw !== 'string' || lw.length === 0) return session;
    if (!BASE_SEAT_LOCK_PROTECTED_STATUSES.has(String(session.gameStatus ?? ''))) return session;
    if (session.blackPlayerId === lb && session.whitePlayerId === lw) return session;
    return { ...session, blackPlayerId: lb, whitePlayerId: lw };
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

export function mergeGameUpdateByArena(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
    _context: ClientGameMergeContext,
): LiveGameSession {
    const merged = existing ? ({ ...existing, ...incoming } as LiveGameSession) : incoming;
    /** 본경기 진입 후 들어온 패킷이 임시 좌석을 들고 오면 잠금값으로 되돌린다(흑/백 영구 스왑 방지). */
    const seatLocked = coerceBaseSessionPlayingSeatLock(merged);
    return coerceAdventureLiveGameScoringTurnLimit(seatLocked);
}

