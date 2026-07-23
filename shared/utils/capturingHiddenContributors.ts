import { Player, type BoardState, type Point } from '../types/index.js';

export type CapturingHiddenContributor = { point: Point; player: Player };

const orthogonalNeighbors = (x: number, y: number, boardSize: number): Point[] => {
    const out: Point[] = [];
    if (x > 0) out.push({ x: x - 1, y });
    if (x < boardSize - 1) out.push({ x: x + 1, y });
    if (y > 0) out.push({ x, y: y - 1 });
    if (y < boardSize - 1) out.push({ x, y: y + 1 });
    return out;
};

/** 착수 돌에서 같은 색으로 연결된 전체 그룹(따내기 연출용). */
export function collectCapturingConnectedGroupPoints(
    boardAfterMove: BoardState,
    move: Point,
    movePlayer: Player,
): Set<string> {
    const boardSize = boardAfterMove.length;
    const capturingGroupPoints = new Set<string>();
    const queue: Point[] = [{ x: move.x, y: move.y }];
    capturingGroupPoints.add(`${move.x},${move.y}`);

    while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const neighbor of orthogonalNeighbors(cur.x, cur.y, boardSize)) {
            const key = `${neighbor.x},${neighbor.y}`;
            if (capturingGroupPoints.has(key)) continue;
            if (boardAfterMove[neighbor.y]?.[neighbor.x] !== movePlayer) continue;
            capturingGroupPoints.add(key);
            queue.push(neighbor);
        }
    }
    return capturingGroupPoints;
}

/**
 * 따내기에 기여한 미공개 히든 돌.
 * - 착수 돌과 같은 색으로 연결된 그룹 안의 히든
 * - 따낸 돌에만 인접하고 연결 그룹 밖인 히든(분리 포위)도 포함
 */
export function collectCapturingHiddenContributors(params: {
    boardAfterMove: BoardState;
    move: Point;
    movePlayer: Player;
    capturedStones: Point[];
    isUnrevealedHiddenAt: (x: number, y: number, isCurrentMove: boolean) => boolean;
}): CapturingHiddenContributor[] {
    const { boardAfterMove, move, movePlayer, capturedStones, isUnrevealedHiddenAt } = params;
    if (capturedStones.length === 0) return [];

    const boardSize = boardAfterMove.length;
    const contributors: CapturingHiddenContributor[] = [];
    const seen = new Set<string>();

    const tryAdd = (x: number, y: number, isCurrentMove: boolean) => {
        const key = `${x},${y}`;
        if (seen.has(key)) return;
        if (boardAfterMove[y]?.[x] !== movePlayer) return;
        if (!isUnrevealedHiddenAt(x, y, isCurrentMove)) return;
        seen.add(key);
        contributors.push({ point: { x, y }, player: movePlayer });
    };

    for (const key of collectCapturingConnectedGroupPoints(boardAfterMove, move, movePlayer)) {
        const [nx, ny] = key.split(',').map(Number);
        tryAdd(nx, ny, nx === move.x && ny === move.y);
    }

    for (const captured of capturedStones) {
        for (const neighbor of orthogonalNeighbors(captured.x, captured.y, boardSize)) {
            tryAdd(neighbor.x, neighbor.y, neighbor.x === move.x && neighbor.y === move.y);
        }
    }

    return contributors;
}
