import * as types from '../../types/index.js';
import * as db from '../db.js';
import {
    arenaUsesClientAuthoritativeScoringSnapshot,
    getArenaTurnCount,
    resolveArenaFixedScoringTurnLimit,
} from './arenaTurnPolicy.js';
import { deferGetGameResultForScoringOverlay } from './deferGetGameResultForScoringOverlay.js';
import { humanPvpAllowsMoveCountAutoScoring } from '../modes/pvpStrategicPipeline.js';

const AUTO_SCORING_ITEM_PHASE_STATUSES = new Set([
    'hidden_placing',
    'scanning',
    'missile_selecting',
    'missile_animating',
    'scanning_animating',
]);

/**
 * PVE 자동계가: 유효 착수 수가 cap에 도달했으면 AI 추가 착수 없이 scoring으로 전환한다.
 * @returns true if scoring was entered or game was already terminal/scoring
 */
export async function maybeEnterPveAutoScoringAtTurnCap(
    game: types.LiveGameSession,
    reason: string,
): Promise<boolean> {
    if (!humanPvpAllowsMoveCountAutoScoring(game)) return false;

    const autoScoringTurns = await resolveArenaFixedScoringTurnLimit(game);
    if (autoScoringTurns == null || autoScoringTurns <= 0) return false;

    const status = String(game.gameStatus);
    if (status === 'scoring' || status === 'ended' || status === 'no_contest') {
        return true;
    }
    if (AUTO_SCORING_ITEM_PHASE_STATUSES.has(status)) {
        return false;
    }

    const totalTurns = getArenaTurnCount(game);
    game.totalTurns = totalTurns;
    if (totalTurns < autoScoringTurns) return false;

    console.log(
        `[maybeEnterPveAutoScoringAtTurnCap] ${reason}: totalTurns=${totalTurns}, cap=${autoScoringTurns}, game=${game.id}`,
    );

    if (!game.isSinglePlayer) {
        const { broadcastPlayingSnapshotBeforeScoring } = await import('./broadcastPlayingBeforeScoring.js');
        await broadcastPlayingSnapshotBeforeScoring(game);
    }
    if (game.endTime == null) game.endTime = Date.now();
    game.gameStatus = 'scoring';
    await db.saveGame(game);

    const { broadcastToGameParticipants } = await import('../socket.js');
    const gameToBroadcast = { ...game };
    if (!game.isSinglePlayer) {
        delete (gameToBroadcast as any).boardState;
    }
    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);

    if (arenaUsesClientAuthoritativeScoringSnapshot(game)) {
        deferGetGameResultForScoringOverlay(game.id, reason);
    } else {
        const { getGameResult } = await import('../gameModes.js');
        try {
            await getGameResult(game);
        } catch (e: any) {
            console.error(`[maybeEnterPveAutoScoringAtTurnCap] getGameResult failed game=${game.id}:`, e?.message);
        }
    }
    return true;
}
