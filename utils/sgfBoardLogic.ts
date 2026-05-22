import { Player, Point } from '../types/index.js';

export type SgfMoveLike = { player: Player; x: number; y: number; removed?: Point[] };

export const createEmptyBoard = (boardSize: number): Player[][] =>
    Array(boardSize)
        .fill(null)
        .map(() => Array(boardSize).fill(Player.None));

const getNeighbors = (x: number, y: number, boardSize: number): Point[] => {
    const neighbors: Point[] = [];
    if (x > 0) neighbors.push({ x: x - 1, y });
    if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
    if (y > 0) neighbors.push({ x, y: y - 1 });
    if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
    return neighbors;
};

const findGroup = (startX: number, startY: number, playerColor: Player, board: Player[][], boardSize: number) => {
    if (startY < 0 || startY >= boardSize || startX < 0 || startX >= boardSize || board[startY]?.[startX] !== playerColor)
        return null;

    const q: Point[] = [{ x: startX, y: startY }];
    const visitedStones = new Set([`${startX},${startY}`]);
    let liberties = 0;
    const stones: Point[] = [{ x: startX, y: startY }];

    while (q.length > 0) {
        const { x: cx, y: cy } = q.shift()!;
        for (const n of getNeighbors(cx, cy, boardSize)) {
            const key = `${n.x},${n.y}`;
            const neighborContent = board[n.y][n.x];

            if (neighborContent === Player.None) {
                liberties++;
            } else if (neighborContent === playerColor) {
                if (!visitedStones.has(key)) {
                    visitedStones.add(key);
                    q.push(n);
                    stones.push(n);
                }
            }
        }
    }
    return { stones, liberties };
};

/** 표준 바둑 규칙으로 한 수 적용(따내기 포함). */
export const applyMoveToBoard = (board: Player[][], move: SgfMoveLike, boardSize: number): void => {
    const { player, x, y } = move;
    if (board[y]?.[x] === undefined) return;
    board[y][x] = player;

    const opponent = player === Player.Black ? Player.White : Player.Black;
    for (const n of getNeighbors(x, y, boardSize)) {
        if (board[n.y][n.x] === opponent) {
            const group = findGroup(n.x, n.y, opponent, board, boardSize);
            if (group && group.liberties === 0) {
                for (const stone of group.stones) {
                    board[stone.y][stone.x] = Player.None;
                }
            }
        }
    }
};

/** SGF AE(따낸 돌)가 있으면 규칙 시뮬레이션 대신 명시 제거를 적용. */
export const applySgfMoveToBoard = (board: Player[][], move: SgfMoveLike, boardSize: number): void => {
    const { player, x, y, removed } = move;
    if (board[y]?.[x] === undefined) return;

    if (removed && removed.length > 0) {
        board[y][x] = player;
        for (const p of removed) {
            if (board[p.y]?.[p.x] !== undefined) {
                board[p.y][p.x] = Player.None;
            }
        }
        return;
    }

    applyMoveToBoard(board, move, boardSize);
};

export const buildBoardFromMoves = (boardSize: number, moves: SgfMoveLike[], moveCount: number): Player[][] => {
    const b = createEmptyBoard(boardSize);
    const n = Math.max(0, Math.min(moveCount, moves.length));
    for (let i = 0; i < n; i++) {
        applySgfMoveToBoard(b, moves[i], boardSize);
    }
    return b;
};

/** 한 수 적용 전후 비교로 제거된 돌 좌표(따낸 돌)를 반환. */
export const collectCapturedPoints = (
    boardBefore: Player[][],
    boardAfter: Player[][],
    move: SgfMoveLike,
    boardSize: number,
): Point[] => {
    const captured: Point[] = [];
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (x === move.x && y === move.y) continue;
            const before = boardBefore[y]?.[x];
            const after = boardAfter[y]?.[x];
            if (before !== Player.None && before != null && after === Player.None) {
                captured.push({ x, y });
            }
        }
    }
    return captured;
};

export const cloneBoard = (board: Player[][]): Player[][] => board.map((row) => [...row]);
