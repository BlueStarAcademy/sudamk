import { Player, type LiveGameSession } from '../../types/index.js';
import { cancelAiProcessing, syncAiSession } from '../aiSessionManager.js';

const AI_USER_ID = 'ai-player-01';
import { aiProcessingQueue } from '../aiProcessingQueue.js';
import { PVE_AI_SERVER_WATCHDOG_MS } from '../constants/pveStrategicAiSchedule.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';
import {
    buildPairAiSchedulingKey,
    getCurrentPairTurnSeat,
    isPairAiSeat,
    isPairClassicGame,
} from '../../shared/utils/pairGameTurn.js';
import { isManuallyPausedAiGame } from '../../utils/pveAiTurnRecoveryPolicy.js';

const KATA_SERVER_AI_ARENA_KINDS = new Set(['singleplayer', 'tower', 'guildwar', 'adventure']);

/** processGame AI dispatch와 동일 — 워치독은 이 상태에서만 stall 감시 */
export const PVE_AI_WATCHDOG_ELIGIBLE_STATUSES = new Set([
    'playing',
    'hidden_placing',
    'alkkagi_placement',
    'alkkagi_simultaneous_placement',
    'thief_rolling',
    'thief_placing',
    'alkkagi_playing',
    'curling_playing',
    'curling_tiebreaker_playing',
    'dice_rolling',
    'dice_placing',
    'dice_turn_rolling',
    'dice_turn_choice',
    'dice_start_confirmation',
]);

/** 정상 연출 중 — 워치독 skip (연출 종료 후 processGame/queue가 AI 재개) */
const PVE_AI_WATCHDOG_ANIMATING_STATUSES = new Set([
    'missile_animating',
    'hidden_reveal_animating',
    'scanning_animating',
    'alkkagi_animating',
    'curling_animating',
    'thief_rolling_animating',
    'dice_rolling_animating',
    'dice_turn_rolling_animating',
]);

const TERMINAL_STATUSES = new Set(['ended', 'scoring', 'no_contest']);

function getCurrentPlayerId(game: LiveGameSession): string | undefined {
    const pairSeat = isPairClassicGame(game.settings, game.mode) ? getCurrentPairTurnSeat(game.settings) : null;
    return (
        pairSeat?.participantId ??
        (game.currentPlayer === Player.Black ? game.blackPlayerId : game.whitePlayerId) ??
        undefined
    );
}

export function isAiControlledTurnForWatchdog(game: LiveGameSession): boolean {
    const pairSeat = isPairClassicGame(game.settings, game.mode) ? getCurrentPairTurnSeat(game.settings) : null;
    if (pairSeat && isPairAiSeat(pairSeat)) return true;
    const playerId = getCurrentPlayerId(game);
    return playerId === AI_USER_ID || (playerId != null && String(playerId).startsWith('dungeon-bot-'));
}

function getWatchPairKey(game: LiveGameSession): string | null {
    if (!isPairClassicGame(game.settings, game.mode)) return null;
    return buildPairAiSchedulingKey(game.settings, game.moveHistory?.length ?? 0);
}

function clearPveAiWatchSnapshot(game: LiveGameSession): void {
    delete (game as any)._pveAiWatchMoveCount;
    delete (game as any)._pveAiWatchPairKey;
    delete (game as any)._pveAiWatchSince;
}

function shouldSkipWatchdogForAnimation(game: LiveGameSession): boolean {
    const status = String(game.gameStatus ?? '');
    if (!PVE_AI_WATCHDOG_ANIMATING_STATUSES.has(status)) return false;
    const policy = resolveArenaSessionPolicy(game);
    if (status === 'hidden_reveal_animating' && KATA_SERVER_AI_ARENA_KINDS.has(policy.kind)) {
        return true;
    }
    return true;
}

export function isPveAiWatchdogGame(game: LiveGameSession): boolean {
    if (!game.isAiGame) return false;
    const policy = resolveArenaSessionPolicy(game);
    return policy.matchAxis !== 'pvp';
}

/** updateGameStates 메인 루프에 PVE AI 게임을 포함할지 */
export function needsPveAiWatchdogTick(game: LiveGameSession): boolean {
    if (!isPveAiWatchdogGame(game)) return false;
    if (TERMINAL_STATUSES.has(String(game.gameStatus ?? ''))) return false;
    return true;
}

/**
 * AI 차례 stall 감시·복구. 복구 수행 시 true.
 */
export function maybeRecoverStalledPveAiTurn(game: LiveGameSession, now: number): boolean {
    if (!isPveAiWatchdogGame(game)) {
        clearPveAiWatchSnapshot(game);
        return false;
    }
    if (TERMINAL_STATUSES.has(String(game.gameStatus ?? ''))) {
        clearPveAiWatchSnapshot(game);
        return false;
    }
    if (isManuallyPausedAiGame(game)) {
        return false;
    }
    if (shouldSkipWatchdogForAnimation(game)) {
        return false;
    }
    if (game.currentPlayer === Player.None || !isAiControlledTurnForWatchdog(game)) {
        clearPveAiWatchSnapshot(game);
        return false;
    }
    if (!PVE_AI_WATCHDOG_ELIGIBLE_STATUSES.has(String(game.gameStatus ?? ''))) {
        clearPveAiWatchSnapshot(game);
        return false;
    }

    const moveCount = game.moveHistory?.length ?? 0;
    const pairKey = getWatchPairKey(game);
    const watchMoveCount = (game as any)._pveAiWatchMoveCount as number | undefined;
    const watchPairKey = ((game as any)._pveAiWatchPairKey as string | null | undefined) ?? null;
    const watchSince = (game as any)._pveAiWatchSince as number | undefined;

    const progressMade =
        watchSince != null &&
        (watchMoveCount !== moveCount || watchPairKey !== pairKey);

    if (watchSince == null || progressMade) {
        (game as any)._pveAiWatchMoveCount = moveCount;
        (game as any)._pveAiWatchPairKey = pairKey;
        (game as any)._pveAiWatchSince = now;
        return false;
    }

    if (now - watchSince < PVE_AI_SERVER_WATCHDOG_MS) {
        return false;
    }

    cancelAiProcessing(game.id);
    if ((game as any)._aiMoveDispatching) {
        (game as any)._aiMoveDispatching = false;
        (game as any)._aiMoveDispatchingAt = undefined;
    }
    syncAiSession(game, AI_USER_ID, { allowAdvanceOnAiTurn: false });
    aiProcessingQueue.enqueue(game.id);
    game.aiTurnStartTime = now;
    (game as any)._pveAiWatchSince = now;

    console.warn(
        `[PVE AI Watchdog] recovered stalled turn game=${game.id} status=${game.gameStatus} moves=${moveCount} stalledMs=${now - watchSince}`,
    );
    return true;
}
