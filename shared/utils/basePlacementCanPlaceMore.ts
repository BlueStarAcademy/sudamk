import type { LiveGameSession, Point } from '../types/entities.js';
import { Player } from '../types/enums.js';
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

/** 서버 `PLACE_BASE_STONE` 중복·상대석 검사와 동일 */
export function isBasePlacementHoverPositionValid(
    pos: Point,
    baseStonesP1: Point[] | undefined,
    baseStonesP2: Point[] | undefined,
    cellAtPos: Player,
): boolean {
    if (baseStonesP1?.some((st) => st.x === pos.x && st.y === pos.y)) return false;
    if (baseStonesP2?.some((st) => st.x === pos.x && st.y === pos.y)) return false;
    return cellAtPos === Player.None;
}

/** 페어 방장은 p1 N개 → p2 N개 순서. 일반 PVP는 뷰어 임시 좌석 색. */
export function resolveBasePlacementPreviewPlayer(params: {
    isPairBasePlacementHost: boolean;
    baseStonesP1: Point[] | undefined;
    baseStonesP2: Point[] | undefined;
    basePlacementTarget: number;
    baseStonesP1Player: Player;
    baseStonesP2Player: Player;
    viewerStoneColor: Player;
}): Player | null {
    const {
        isPairBasePlacementHost,
        baseStonesP1,
        baseStonesP2,
        basePlacementTarget,
        baseStonesP1Player,
        baseStonesP2Player,
        viewerStoneColor,
    } = params;
    const n1 = baseStonesP1?.length ?? 0;
    const n2 = baseStonesP2?.length ?? 0;
    if (isPairBasePlacementHost) {
        if (n1 < basePlacementTarget) return baseStonesP1Player;
        if (n2 < basePlacementTarget) return baseStonesP2Player;
        return null;
    }
    if (viewerStoneColor === Player.None) return null;
    return viewerStoneColor;
}
