import type { LiveGameSession } from '../types/entities.js';
import { getEffectivePairLobbyOwnerId } from './effectivePairLobbyOwnerId.js';

/** Game.tsx `PLACE_BASE_STONE` 조건과 동일: 뷰어가 아직 베이스돌을 더 둘 수 있는지 */
export function canViewerPlaceMoreBaseStones(session: LiveGameSession, viewerUserId: string): boolean {
    if (session.gameStatus !== 'base_placement') return false;
    const target = session.settings.baseStones ?? 4;
    const pairHostId = getEffectivePairLobbyOwnerId(session);
    const n1 = session.baseStones_p1?.length ?? 0;
    const n2 = session.baseStones_p2?.length ?? 0;
    if (pairHostId) {
        if (viewerUserId !== pairHostId) return false;
        return n1 < target || n2 < target;
    }
    const myStones = viewerUserId === session.player1.id ? session.baseStones_p1 : session.baseStones_p2;
    return (myStones?.length ?? 0) < target;
}
