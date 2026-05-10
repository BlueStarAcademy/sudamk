import type { LiveGameSession } from '../types/entities.js';
import { Player } from '../types/enums.js';

/**
 * `baseStones_p1` / `baseStones_p2` 오버레이에 쓸 흑·백 색을 결정한다.
 *
 * 우선순위:
 * 1. 본대국 흑 좌석(`blackPlayerId`)이 이미 있으면 그 기준(색 확정 후·임시 좌석은 서버에서 비움).
 * 2. 아니면 베이스 배치용 임시 흑 좌석(`basePlacementBlackPlayerId`) — `capture_bidding`처럼 본대국 좌석이
 *    아직 비어 있어도 임시 좌석이 남아 있는 구간에서 반드시 이 경로를 탄다.
 * 3. 둘 다 없으면 p1=Black, p2=White 폴백.
 */
export function resolveBasePlacementSeatColors(
    session: LiveGameSession,
): { baseStonesP1Player: Player; baseStonesP2Player: Player } {
    const committedBlack =
        typeof session.blackPlayerId === 'string' && session.blackPlayerId.length > 0 ? session.blackPlayerId : null;
    const provisionalBlack =
        typeof session.basePlacementBlackPlayerId === 'string' && session.basePlacementBlackPlayerId.length > 0
            ? session.basePlacementBlackPlayerId
            : null;
    const blackPlayerId = committedBlack ?? provisionalBlack;

    if (typeof blackPlayerId === 'string' && blackPlayerId.length > 0) {
        const p1IsBlack = blackPlayerId === session.player1.id;
        return {
            baseStonesP1Player: p1IsBlack ? Player.Black : Player.White,
            baseStonesP2Player: p1IsBlack ? Player.White : Player.Black,
        };
    }

    return { baseStonesP1Player: Player.Black, baseStonesP2Player: Player.White };
}
