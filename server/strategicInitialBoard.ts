/**
 * 싱글/도전의 탑/길드전 등 전략 모드 공통: 미리 깔리는 돌은 실제 대국에선 capture 없이 좌표만 찍히므로,
 * processMove 시뮬에서 따내지거나(사석이 보드에 남는 버그), 자살·단호흡 한 수 잡힘 형태는 배치에서 제외한다.
 */
import { Player, Point, BoardState } from '../types/index.js';
import { processMove } from './goLogic.js';

export type StrategicInitialPlacements = {
    black: number;
    white: number;
    blackPattern: number;
    whitePattern: number;
};

const getBoardNeighbors = (boardSize: number, px: number, py: number): Point[] => {
    const neighbors: Point[] = [];
    if (px > 0) neighbors.push({ x: px - 1, y: py });
    if (px < boardSize - 1) neighbors.push({ x: px + 1, y: py });
    if (py > 0) neighbors.push({ x: px, y: py - 1 });
    if (py < boardSize - 1) neighbors.push({ x: px, y: py + 1 });
    return neighbors;
};

const findGroupLibertiesOnBoard = (
    currentBoard: BoardState,
    boardSize: number,
    startX: number,
    startY: number,
    playerColor: Player
): { stones: Point[]; libertyCells: Point[] } | null => {
    if (currentBoard[startY]?.[startX] !== playerColor) return null;
    const q: Point[] = [{ x: startX, y: startY }];
    const visitedStones = new Set([`${startX},${startY}`]);
    const libertyPointKeys = new Set<string>();
    const stones: Point[] = [{ x: startX, y: startY }];

    while (q.length > 0) {
        const { x: cx, y: cy } = q.shift()!;
        for (const n of getBoardNeighbors(boardSize, cx, cy)) {
            const key = `${n.x},${n.y}`;
            const neighborContent = currentBoard[n.y][n.x];

            if (neighborContent === Player.None) {
                libertyPointKeys.add(key);
            } else if (neighborContent === playerColor) {
                if (!visitedStones.has(key)) {
                    visitedStones.add(key);
                    q.push(n);
                    stones.push(n);
                }
            }
        }
    }
    const libertyCells = Array.from(libertyPointKeys).map(k => {
        const [nx, ny] = k.split(',').map(Number);
        return { x: nx, y: ny };
    });
    return { stones, libertyCells };
};

/** @returns true if this empty cell must not receive `player` (따냄/자살/즉시 잡힘 등) */
export const isInvalidStrategicInitialStonePlacement = (board: BoardState, x: number, y: number, player: Player): boolean => {
    const boardSize = board.length;
    if (y < 0 || y >= boardSize || x < 0 || x >= boardSize || board[y][x] !== Player.None) {
        return true;
    }

    const result = processMove(board, { x, y, player }, null, 0, { ignoreSuicide: true });

    if (!result.isValid) return true;

    if (result.capturedStones.length > 0) return true;

    const myGroup = findGroupLibertiesOnBoard(result.newBoardState, boardSize, x, y, player);
    if (!myGroup || myGroup.libertyCells.length === 0) return true;

    const opponent = player === Player.Black ? Player.White : Player.Black;

    if (myGroup.libertyCells.length === 1) {
        const liberty = myGroup.libertyCells[0];
        const opponentResult = processMove(
            result.newBoardState,
            { x: liberty.x, y: liberty.y, player: opponent },
            null,
            1,
            { ignoreSuicide: false }
        );
        if (opponentResult.isValid && opponentResult.capturedStones.some(s => s.x === x && s.y === y)) {
            return true;
        }
    }

    return false;
};

export const strategicBoardHasDeadGroup = (board: BoardState, boardSize: number): boolean => {
    const visited = new Set<string>();
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            const c = board[y][x];
            if (c === Player.None || visited.has(`${x},${y}`)) continue;
            const g = findGroupLibertiesOnBoard(board, boardSize, x, y, c);
            if (!g || g.libertyCells.length === 0) return true;
            g.stones.forEach(s => visited.add(`${s.x},${s.y}`));
        }
    }
    return false;
};

const shufflePoints = (points: Point[]): Point[] => {
    const out = [...points];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

const placePlainStonesOnBoard = (board: BoardState, boardSize: number, count: number, player: Player): Point[] => {
    const empty: Point[] = [];
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (board[y][x] === Player.None) empty.push({ x, y });
        }
    }
    const shuffled = shufflePoints(empty);
    const placedStones: Point[] = [];
    for (const { x, y } of shuffled) {
        if (placedStones.length >= count) break;
        if (board[y][x] !== Player.None) continue;
        if (isInvalidStrategicInitialStonePlacement(board, x, y, player)) continue;
        board[y][x] = player;
        placedStones.push({ x, y });
    }
    return placedStones;
};

const placePatternStonesOnBoard = (board: BoardState, boardSize: number, count: number, player: Player): Point[] => {
    const result: Point[] = [];
    for (let n = 0; n < count; n++) {
        const empty: Point[] = [];
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                if (board[y][x] !== Player.None) continue;
                if (isInvalidStrategicInitialStonePlacement(board, x, y, player)) continue;
                empty.push({ x, y });
            }
        }
        if (empty.length === 0) break;
        const shuffled = shufflePoints(empty);
        const chosen = shuffled[0];
        board[chosen.y][chosen.x] = player;
        result.push(chosen);
    }
    return result;
};

const cloneBoard = (b: BoardState): BoardState => b.map(row => [...row]);

const emptyBoard = (boardSize: number): BoardState =>
    Array(boardSize)
        .fill(null)
        .map(() => Array(boardSize).fill(Player.None));

const tryOneStrategicLayout = (
    boardSize: number,
    placements: StrategicInitialPlacements,
    baseBoard?: BoardState
): { board: BoardState; blackPattern: Point[]; whitePattern: Point[] } | null => {
    const board = baseBoard ? cloneBoard(baseBoard) : emptyBoard(boardSize);
    if (board.length !== boardSize || (board[0] && board[0].length !== boardSize)) {
        return null;
    }

    const blackCount = placements.black ?? 0;
    const whiteCount = placements.white ?? 0;
    const blackPatternCount = placements.blackPattern ?? 0;
    const whitePatternCount = placements.whitePattern ?? 0;

    const blackStones = placePlainStonesOnBoard(board, boardSize, blackCount, Player.Black);
    const whiteStones = placePlainStonesOnBoard(board, boardSize, whiteCount, Player.White);

    const blackPattern = placePatternStonesOnBoard(board, boardSize, blackPatternCount, Player.Black);
    for (const p of blackPattern) {
        board[p.y][p.x] = Player.Black;
    }

    const whitePattern = placePatternStonesOnBoard(board, boardSize, whitePatternCount, Player.White);
    for (const p of whitePattern) {
        board[p.y][p.x] = Player.White;
    }

    const expectedStones = blackCount + whiteCount + blackPatternCount + whitePatternCount;
    const actualStones = board.flat().filter(c => c !== Player.None).length;
    const countsOk =
        blackStones.length === blackCount &&
        whiteStones.length === whiteCount &&
        blackPattern.length === blackPatternCount &&
        whitePattern.length === whitePatternCount &&
        actualStones === expectedStones;

    if (!countsOk || strategicBoardHasDeadGroup(board, boardSize)) return null;
    return { board, blackPattern, whitePattern };
};

export type GenerateStrategicBoardOptions = {
    maxAttempts?: number;
    /** 이미 깔린 돌(예: 싱글 중앙 흑) — 매 시도마다 복제 후 그 위에 나머지 배치 */
    baseBoard?: BoardState;
};

/**
 * 흑 일반 → 백 일반 → 흑 문양 → 백 문양 순으로 채운다 (기존 도전의 탑과 동일).
 */
export function generateStrategicRandomBoard(
    boardSize: number,
    placements: StrategicInitialPlacements,
    options?: GenerateStrategicBoardOptions
): { board: BoardState; blackPattern: Point[]; whitePattern: Point[] } {
    const maxAttempts = options?.maxAttempts ?? 60;
    const baseBoard = options?.baseBoard;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const r = tryOneStrategicLayout(boardSize, placements, baseBoard);
        if (r) return r;
    }

    for (let attempt = 0; attempt < 400; attempt++) {
        const r = tryOneStrategicLayout(boardSize, placements, baseBoard);
        if (r) return r;
    }

    console.warn('[generateStrategicRandomBoard] maxAttempts exhausted; using last shuffle (may be incomplete)', {
        boardSize,
        placements,
    });
    const board = baseBoard ? cloneBoard(baseBoard) : emptyBoard(boardSize);
    const blackCount = placements.black ?? 0;
    const whiteCount = placements.white ?? 0;
    const blackPatternCount = placements.blackPattern ?? 0;
    const whitePatternCount = placements.whitePattern ?? 0;

    const blackStones = placePlainStonesOnBoard(board, boardSize, blackCount, Player.Black);
    const whiteStones = placePlainStonesOnBoard(board, boardSize, whiteCount, Player.White);
    const blackPattern = placePatternStonesOnBoard(board, boardSize, blackPatternCount, Player.Black);
    for (const p of blackPattern) {
        board[p.y][p.x] = Player.Black;
    }
    const whitePattern = placePatternStonesOnBoard(board, boardSize, whitePatternCount, Player.White);
    for (const p of whitePattern) {
        board[p.y][p.x] = Player.White;
    }
    return { board, blackPattern, whitePattern };
}
