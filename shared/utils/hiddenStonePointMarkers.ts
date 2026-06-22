import type { Point } from '../types/index.js';
import { Player } from '../types/index.js';

export type HiddenStonePoint = Point & { player?: Player };

export function upsertHiddenStonePoint(
    points: HiddenStonePoint[] | undefined,
    target: Point,
    player: Player,
): HiddenStonePoint[] {
    const next = (points || []).filter(
        (p) => !(p.x === target.x && p.y === target.y && (p.player === undefined || p.player === player)),
    );
    next.push({ x: target.x, y: target.y, player });
    return next;
}

export function removeHiddenStonePointForPlayer(
    points: HiddenStonePoint[] | undefined,
    target: Point,
    player: Player,
): HiddenStonePoint[] | undefined {
    if (!points?.length) return undefined;
    const next = points.filter(
        (p) => !(p.x === target.x && p.y === target.y && (p.player === undefined || p.player === player)),
    );
    return next.length > 0 ? next : undefined;
}

/** hiddenMoves 인덱스가 밀려도 좌표 마커로 AI/유저 히든을 복원한다 */
export function reconcileHiddenMovesFromStonePoints(
    hiddenMoves: { [moveIndex: number]: boolean } | undefined,
    moveHistory: Array<{ x: number; y: number; player: Player }> | undefined,
    points: HiddenStonePoint[] | undefined,
): { [moveIndex: number]: boolean } {
    const next = { ...(hiddenMoves || {}) };
    if (!points?.length || !moveHistory?.length) return next;
    for (const point of points) {
        for (let i = moveHistory.length - 1; i >= 0; i--) {
            const move = moveHistory[i];
            if (!move || move.x < 0 || move.y < 0) continue;
            if (move.x !== point.x || move.y !== point.y) continue;
            if (point.player !== undefined && move.player !== point.player) continue;
            next[i] = true;
            break;
        }
    }
    return next;
}

export function isHiddenStoneAtPoint(
    x: number,
    y: number,
    owner: Player,
    options: {
        hiddenMoves?: { [moveIndex: number]: boolean };
        moveHistory?: Array<{ x: number; y: number; player: Player }>;
        permanentlyRevealedStones?: Point[];
        stonePoints?: HiddenStonePoint[] | null;
        initialHiddenStone?: Point | null;
        findMoveIndex?: (
            history: Array<{ x: number; y: number; player: Player }> | undefined,
            px: number,
            py: number,
            player: Player,
        ) => number;
    },
): boolean {
    if (options.permanentlyRevealedStones?.some((p) => p.x === x && p.y === y)) return false;
    if (
        options.initialHiddenStone &&
        options.initialHiddenStone.x === x &&
        options.initialHiddenStone.y === y
    ) {
        return true;
    }
    if (
        options.stonePoints?.some(
            (p) =>
                p.x === x &&
                p.y === y &&
                (p.player === undefined || p.player === owner),
        )
    ) {
        return true;
    }
    if (options.findMoveIndex && options.hiddenMoves && options.moveHistory) {
        const moveIndex = options.findMoveIndex(options.moveHistory, x, y, owner);
        if (moveIndex !== -1 && options.hiddenMoves[moveIndex]) return true;
    }
    return false;
}
