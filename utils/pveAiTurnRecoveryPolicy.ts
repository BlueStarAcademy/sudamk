import type { LiveGameSession } from '../types/index.js';
import { resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';
import { isPairArenaAiMatchSession } from '../shared/utils/pairArenaAiMatchSettings.js';

/** AI 턴이 이 시간 이상 지속되면 서버 재요청 복구를 시도한다. */
export const PVE_AI_TURN_STUCK_NO_MOVE_MS = 10_000;
/** 1차 복구 후에도 진행이 없으면 2차 재요청까지의 대기 시간. */
export const PVE_AI_TURN_STUCK_POST_SYNC_FALLBACK_MS = 5_000;
/** 연속 복구 요청 스팸 방지 쿨다운. */
export const PVE_AI_TURN_STUCK_SYNC_COOLDOWN_MS = 6_000;

const KATA_SERVER_AI_ARENA_KINDS = new Set(['singleplayer', 'tower', 'guildwar', 'adventure']);

export function isEligibleForPveAiTurnStuckRecovery(session: LiveGameSession): boolean {
    if (!session.isAiGame) return false;
    const policy = resolveArenaSessionPolicy(session);
    return policy.matchAxis !== 'pvp';
}

export function shouldDeferStuckRecoveryDuringHiddenReveal(session: LiveGameSession): boolean {
    const policy = resolveArenaSessionPolicy(session);
    return KATA_SERVER_AI_ARENA_KINDS.has(policy.kind);
}

export function isManuallyPausedAiGame(session: LiveGameSession): boolean {
    if (!session.isAiGame) return false;
    const policy = resolveArenaSessionPolicy(session);
    if (policy.kind === 'singleplayer' || policy.kind === 'tower') return false;
    return (
        session.pausedTurnTimeLeft !== undefined &&
        !session.turnDeadline &&
        !session.itemUseDeadline
    );
}

export function shouldUseServerAiKickForStuckRecovery(
    session: LiveGameSession,
    opts: { isPairAiTurn: boolean },
): boolean {
    const policy = resolveArenaSessionPolicy(session);
    return (
        policy.kind === 'singleplayer' ||
        policy.kind === 'tower' ||
        policy.kind === 'adventure' ||
        policy.kind === 'guildwar' ||
        policy.isStrategicAiLike ||
        opts.isPairAiTurn ||
        isPairArenaAiMatchSession(session)
    );
}
