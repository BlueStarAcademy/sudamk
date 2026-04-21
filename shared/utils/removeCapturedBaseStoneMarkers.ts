import type { Point } from '../types/index.js';

/**
 * 따낸 좌표를 베이스 배치 목록에서 모두 제거한다.
 * `game.baseStones`만 갱신하고 `baseStones_p1`/`p2`는 두면 같은 자리에 둔 일반돌이 베이스로 오인된다.
 */
export function removeCapturedBaseStoneMarkersFromSession(
    game: { baseStones?: Point[] | null; baseStones_p1?: Point[]; baseStones_p2?: Point[]; [key: string]: unknown },
    capturedStones: Point[]
): void {
    if (!Array.isArray(capturedStones) || capturedStones.length === 0) return;
    const keys = new Set(capturedStones.map((s) => `${s.x},${s.y}`));
    const keep = (p: Point) => !keys.has(`${p.x},${p.y}`);

    if (Array.isArray(game.baseStones) && game.baseStones.length > 0) {
        game.baseStones = game.baseStones.filter(keep);
    }
    for (const key of ['baseStones_p1', 'baseStones_p2'] as const) {
        const arr = game[key];
        if (Array.isArray(arr) && arr.length > 0) {
            (game as Record<string, unknown>)[key] = arr.filter(keep);
        }
    }
}

/** 따내기 점수·표시용: 해당 교차점이 베이스 배치 목록에 남아 있는지 */
export function isIntersectionRecordedAsBaseStone(
    game: { baseStones?: Point[] | null; baseStones_p1?: Point[]; baseStones_p2?: Point[] },
    x: number,
    y: number
): boolean {
    const hit = (arr?: Point[] | null) => !!arr?.some((p) => p.x === x && p.y === y);
    return hit(game.baseStones) || hit(game.baseStones_p1) || hit(game.baseStones_p2);
}
