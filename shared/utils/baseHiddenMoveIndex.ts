import type { LiveGameSession } from '../types/entities.js';
import { Player } from '../types/enums.js';
import { isIntersectionRecordedAsBaseStone } from './removeCapturedBaseStoneMarkers.js';

export type MoveLike = { x: number; y: number; player: Player };

/**
 * 베이스+히든 혼합: `moveHistory`에 없는 개국 베이스돌 교차점은 히든 판별에 수순을 쓰지 않는다.
 * 같은 좌표·돌색에 남은 stale `hiddenMoves` 인덱스로 베이스돌·일반돌이 히든으로 오인되는 것을 막는다.
 * (싱글/탑/전략·페어 AI·미사일·goAiBot·클라 낙관 등 동일 규칙으로 사용)
 */
export type BaseStoneOverlayContext = Pick<LiveGameSession, 'baseStones' | 'baseStones_p1' | 'baseStones_p2' | 'gameStatus'>;

export function findLatestMoveIndexAtExcludingRecordedBaseStones(
    moveHistory: readonly MoveLike[] | undefined,
    x: number,
    y: number,
    player: Player | undefined,
    baseCtx: BaseStoneOverlayContext | null | undefined,
): number {
    if (baseCtx && isIntersectionRecordedAsBaseStone(baseCtx, x, y)) {
        return -1;
    }
    const moves = moveHistory || [];
    for (let i = moves.length - 1; i >= 0; i--) {
        const move = moves[i];
        if (!move || move.x !== x || move.y !== y) continue;
        if (player !== undefined && move.player !== player) continue;
        return i;
    }
    return -1;
}
