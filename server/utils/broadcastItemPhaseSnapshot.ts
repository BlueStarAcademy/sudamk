import type { LiveGameSession } from '../../types/index.js';
import * as db from '../db.js';
import { updateGameCache } from '../gameCache.js';
import { broadcastToGameParticipants } from '../socket.js';

/**
 * 아이템 페이즈 종료 GAME_UPDATE: 슬림 패킷이 `animation` 필드를 생략해도
 * 클라 병합이 연출을 지우도록 `animation: null`을 명시한다.
 */
export function buildItemPhaseGameUpdatePayload(
    game: LiveGameSession,
): Record<string, LiveGameSession> {
    const gameToBroadcast = {
        ...game,
        animation: game.animation ?? null,
    } as LiveGameSession;
    return { [game.id]: gameToBroadcast };
}

export async function broadcastItemPhaseSnapshot(game: LiveGameSession): Promise<void> {
    updateGameCache(game);
    await db.saveGame(game);
    broadcastToGameParticipants(
        game.id,
        { type: 'GAME_UPDATE', payload: buildItemPhaseGameUpdatePayload(game) },
        game,
    );
}
