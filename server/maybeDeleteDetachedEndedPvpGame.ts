import * as db from './db.js';
import { clearAiSession } from './aiSessionManager.js';
import { broadcast } from './socket.js';
import { stashEndedPvpGameRecordSnapshot } from './gameRecordSnapshot.js';
import type { LiveGameSession, VolatileState } from '../types/index.js';

function isLingerEndedPvpRoomCandidate(game: LiveGameSession): boolean {
    return (
        (game.gameStatus === 'ended' || game.gameStatus === 'no_contest') &&
        !game.isSinglePlayer &&
        !game.isAiGame &&
        !Boolean((game.settings as { pairGame?: unknown } | undefined)?.pairGame)
    );
}

/** 종료 PVP 대국실에 플레이어/관전자/리매치 협상이 더 없을 때만 DB에서 제거 */
export async function maybeDeleteDetachedEndedPvpGame(volatileState: VolatileState, gameId: string | undefined): Promise<void> {
    if (!gameId) return;
    const game = await db.getLiveGame(gameId);
    if (!game || !isLingerEndedPvpRoomCandidate(game)) return;

    const p1Status = volatileState.userStatuses[game.player1.id];
    const p2Status = volatileState.userStatuses[game.player2.id];
    const p1Left = !p1Status || p1Status.gameId !== gameId;
    const p2Left = !p2Status || p2Status.gameId !== gameId;
    const hasSpectators = Object.values(volatileState.userStatuses).some((s) => s.spectatingGameId === gameId);
    const isRematchBeingNegotiated = Object.values(volatileState.negotiations).some((neg) => neg.rematchOfGameId === gameId);

    if (p1Left && p2Left && !hasSpectators && !isRematchBeingNegotiated) {
        console.log(`[GC] Deleting ended PVP room ${gameId} — no players attached`);
        stashEndedPvpGameRecordSnapshot(volatileState, game);
        clearAiSession(gameId);
        await db.deleteGame(gameId);
        if (volatileState.gameChats) delete volatileState.gameChats[gameId];
        broadcast({ type: 'GAME_DELETED', payload: { gameId } });
    }
}

export { isLingerEndedPvpRoomCandidate };
