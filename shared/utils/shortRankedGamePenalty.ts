import { NO_CONTEST_MOVE_THRESHOLD } from '../constants/rules.js';

/** 패(-1,-1)를 제외한 유효 착수 수 — 「10수 미만」 규정과 동일 */
export function countValidStoneMoves(
    moveHistory: ReadonlyArray<{ x: number; y: number }> | null | undefined,
): number {
    if (!moveHistory?.length) return 0;
    return moveHistory.filter((m) => m && m.x !== -1 && m.y !== -1).length;
}

/** 랭킹전 유효 착수 10수 미만 종료 여부 */
export function isShortRankedGameMoveCount(
    moveHistory: ReadonlyArray<{ x: number; y: number }> | null | undefined,
): boolean {
    return countValidStoneMoves(moveHistory) < NO_CONTEST_MOVE_THRESHOLD;
}

/**
 * 랭킹전 10수 미만 종료 시 Elo 보정:
 * - 승자: 정상 상승분의 절반(버림)
 * - 패자: 정상 감점의 2배
 */
export function applyShortRankedGameEloModifier(
    ratingChange: number,
    result: 'win' | 'loss' | 'draw',
): number {
    if (result === 'draw' || ratingChange === 0) return ratingChange;
    if (result === 'win') {
        return ratingChange > 0 ? Math.floor(ratingChange / 2) : ratingChange;
    }
    return ratingChange < 0 ? ratingChange * 2 : ratingChange;
}
