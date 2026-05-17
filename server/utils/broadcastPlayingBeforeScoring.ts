import type { LiveGameSession } from '../../types/index.js';
import * as db from '../db.js';
import { broadcastToGameParticipants } from '../socket.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';

/** 클라이언트가 마지막 착수(특히 AI/몬스터 수)를 한 프레임 그린 뒤 계가 오버레이로 넘어가도록 */
const DEFAULT_PLAYING_STATE_FLUSH_MS = 140;
/** 페어·전략 AI: 클라 `STRATEGIC_AI_MOVE_DELAY_MS`(1000) 연출과 맞춤 */
const STRATEGIC_AI_SCORING_FLUSH_MS = 1100;

/**
 * `gameStatus`가 아직 `playing`/`hidden_placing`일 때만 호출.
 * 저장 후 boardState 포함 GAME_UPDATE를 보내고 짧게 대기한 뒤, 호출부에서 scoring으로 전환하면 된다.
 */
export async function broadcastPlayingSnapshotBeforeScoring(game: LiveGameSession): Promise<void> {
    const st = game.gameStatus;
    if (st !== 'playing' && st !== 'hidden_placing') {
        return;
    }
    await db.saveGame(game);
    const gameToBroadcast = { ...game };
    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);
    const policy = resolveArenaSessionPolicy(game);
    const flushMs =
        policy.isPairGame || policy.isStrategicAiLike
            ? STRATEGIC_AI_SCORING_FLUSH_MS
            : DEFAULT_PLAYING_STATE_FLUSH_MS;
    await new Promise((r) => setTimeout(r, flushMs));
}
