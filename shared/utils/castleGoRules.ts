import { GameMode, Player } from '../types/enums.js';
import type { BoardState, LiveGameSession, Point } from '../types/entities.js';
import { clampCastleCount, getDefaultCastleCountByBoardSize, type CastleCount } from '../constants/gameSettings.js';

export type CastleTerritoryOwner = Player.Black | Player.White;

export type CastleGoSessionSlice = Pick<
    LiveGameSession,
    'castleStonePoints' | 'confirmedTerritoryOwnerByPoint' | 'settings' | 'boardState'
>;

export function pointKey(x: number, y: number): string {
    return `${x},${y}`;
}

export function parsePointKey(key: string): Point {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
}

export function isCastleMode(mode: unknown): boolean {
    return mode === GameMode.Castle;
}

export function getCastleStoneSet(session: CastleGoSessionSlice): Set<string> {
    const set = new Set<string>();
    for (const p of session.castleStonePoints ?? []) {
        set.add(pointKey(p.x, p.y));
    }
    return set;
}

export function isCastleIntersection(session: CastleGoSessionSlice, x: number, y: number): boolean {
    return getCastleStoneSet(session).has(pointKey(x, y));
}

export function getConfirmedTerritoryOwner(
    session: CastleGoSessionSlice,
    x: number,
    y: number,
): CastleTerritoryOwner | null {
    const owner = session.confirmedTerritoryOwnerByPoint?.[pointKey(x, y)];
    return owner === Player.Black || owner === Player.White ? owner : null;
}

export function isConfirmedTerritoryCell(session: CastleGoSessionSlice, x: number, y: number): boolean {
    return getConfirmedTerritoryOwner(session, x, y) != null;
}

export function isPlayableCastleIntersection(
    session: CastleGoSessionSlice,
    x: number,
    y: number,
    _player?: Player,
): boolean {
    const board = session.boardState;
    if (!board?.[y] || board[y][x] !== Player.None) return false;
    if (isCastleIntersection(session, x, y)) return false;
    if (isConfirmedTerritoryCell(session, x, y)) return false;
    return true;
}

function getNeighbors(x: number, y: number, boardSize: number): Point[] {
    const neighbors: Point[] = [];
    if (x > 0) neighbors.push({ x: x - 1, y });
    if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
    if (y > 0) neighbors.push({ x, y: y - 1 });
    if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
    return neighbors;
}

/** 영토 스캔에서 traversable한 빈 교차점만 (캐슬·돌은 막힌 칸). */
function isRegionCell(session: CastleGoSessionSlice, x: number, y: number, board: BoardState): boolean {
    if (isConfirmedTerritoryCell(session, x, y)) return false;
    if (isCastleIntersection(session, x, y)) return false;
    return board[y]?.[x] === Player.None;
}

export function isStoneImmuneInCastleTerritory(
    session: CastleGoSessionSlice,
    board: BoardState,
    x: number,
    y: number,
): boolean {
    const color = board[y]?.[x];
    if (color !== Player.Black && color !== Player.White) return false;

    const boardSize = board.length;
    const visited = new Set<string>();
    const q: Point[] = [{ x, y }];

    while (q.length > 0) {
        const cur = q.shift()!;
        const key = pointKey(cur.x, cur.y);
        if (visited.has(key)) continue;
        visited.add(key);

        const cellColor = board[cur.y]?.[cur.x];
        if (cellColor === color) {
            for (const n of getNeighbors(cur.x, cur.y, boardSize)) {
                if (getConfirmedTerritoryOwner(session, n.x, n.y) === color) {
                    return true;
                }
                const nk = pointKey(n.x, n.y);
                if (!visited.has(nk) && board[n.y]?.[n.x] === color) {
                    q.push(n);
                }
            }
        }
    }
    return false;
}

type RegionScanResult = {
    region: Point[];
    borderColors: Set<Player.Black | Player.White>;
    touchesTop: boolean;
    touchesBottom: boolean;
    touchesLeft: boolean;
    touchesRight: boolean;
};

function scanEmptyRegion(
    session: CastleGoSessionSlice,
    board: BoardState,
    startX: number,
    startY: number,
    visited: boolean[][],
): RegionScanResult | null {
    const boardSize = board.length;
    if (!isRegionCell(session, startX, startY, board)) return null;
    if (visited[startY][startX]) return null;

    const region: Point[] = [];
    const borderColors = new Set<Player.Black | Player.White>();
    let touchesTop = false;
    let touchesBottom = false;
    let touchesLeft = false;
    let touchesRight = false;

    const q: Point[] = [{ x: startX, y: startY }];
    visited[startY][startX] = true;

    while (q.length > 0) {
        const { x, y } = q.shift()!;
        region.push({ x, y });

        if (y === 0) touchesTop = true;
        if (y === boardSize - 1) touchesBottom = true;
        if (x === 0) touchesLeft = true;
        if (x === boardSize - 1) touchesRight = true;

        for (const n of getNeighbors(x, y, boardSize)) {
            const cell = board[n.y][n.x];
            if (isRegionCell(session, n.x, n.y, board)) {
                if (!visited[n.y][n.x]) {
                    visited[n.y][n.x] = true;
                    q.push(n);
                }
            } else if (isCastleIntersection(session, n.x, n.y)) {
                // 중립 캐슬: 돌처럼 확장을 막지만 색을 강요하지 않는다.
            } else if (cell === Player.Black || cell === Player.White) {
                borderColors.add(cell);
            }
        }
    }

    return {
        region,
        borderColors,
        touchesTop,
        touchesBottom,
        touchesLeft,
        touchesRight,
    };
}

export function isValidCastleTerritoryRegion(
    result: RegionScanResult,
    owner: CastleTerritoryOwner,
): boolean {
    if (result.borderColors.size !== 1 || !result.borderColors.has(owner)) return false;

    const edgeCount =
        (result.touchesTop ? 1 : 0) +
        (result.touchesBottom ? 1 : 0) +
        (result.touchesLeft ? 1 : 0) +
        (result.touchesRight ? 1 : 0);
    if (edgeCount >= 4) return false;

    return true;
}

export function detectAndConfirmTerritories(
    session: CastleGoSessionSlice,
    board: BoardState,
): Record<string, CastleTerritoryOwner> {
    const boardSize = board.length;
    const visited = Array.from({ length: boardSize }, () => Array(boardSize).fill(false));
    const next = { ...(session.confirmedTerritoryOwnerByPoint ?? {}) };

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (visited[y][x]) continue;
            if (!isRegionCell(session, x, y, board)) continue;
            if (next[pointKey(x, y)]) {
                visited[y][x] = true;
                continue;
            }

            const result = scanEmptyRegion(session, board, x, y, visited);
            if (!result || result.region.length === 0) continue;

            if (result.borderColors.size !== 1) continue;
            const owner = [...result.borderColors][0]!;

            if (!isValidCastleTerritoryRegion(result, owner)) continue;

            for (const p of result.region) {
                next[pointKey(p.x, p.y)] = owner;
            }
        }
    }

    return next;
}

function isLibertyCell(
    session: CastleGoSessionSlice,
    board: BoardState,
    x: number,
    y: number,
): boolean {
    if (board[y]?.[x] !== Player.None) return false;
    if (isCastleIntersection(session, x, y)) return false;
    if (isConfirmedTerritoryCell(session, x, y)) return false;
    return true;
}

function findGroupWithCastleRules(
    session: CastleGoSessionSlice,
    board: BoardState,
    startX: number,
    startY: number,
    playerColor: Player.Black | Player.White,
): { stones: Point[]; liberties: number } | null {
    if (board[startY]?.[startX] !== playerColor) return null;

    const boardSize = board.length;
    const q: Point[] = [{ x: startX, y: startY }];
    const visitedStones = new Set<string>([pointKey(startX, startY)]);
    const libertyPoints = new Set<string>();
    const stones: Point[] = [{ x: startX, y: startY }];

    while (q.length > 0) {
        const { x: cx, y: cy } = q.shift()!;
        for (const n of getNeighbors(cx, cy, boardSize)) {
            const key = pointKey(n.x, n.y);
            const neighborContent = board[n.y][n.x];

            if (isLibertyCell(session, board, n.x, n.y)) {
                libertyPoints.add(key);
            } else if (neighborContent === playerColor) {
                if (!visitedStones.has(key)) {
                    visitedStones.add(key);
                    q.push(n);
                    stones.push(n);
                }
            }
        }
    }

    return { stones, liberties: libertyPoints.size };
}

export type CastleMoveResult = {
    isValid: boolean;
    newBoardState: BoardState;
    capturedStones: Point[];
    newKoInfo: LiveGameSession['koInfo'];
    reason?: 'ko' | 'suicide' | 'occupied';
};

export function processCastleMove(
    session: CastleGoSessionSlice,
    boardState: BoardState,
    move: { x: number; y: number; player: Player },
    koInfo: LiveGameSession['koInfo'],
    moveHistoryLength: number,
): CastleMoveResult {
    const { x, y, player } = move;
    const boardSize = boardState.length;
    const opponent = player === Player.Black ? Player.White : Player.Black;

    if (y < 0 || y >= boardSize || x < 0 || x >= boardSize) {
        return { isValid: false, reason: 'occupied', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
    }

    if (!isPlayableCastleIntersection(session, x, y, player)) {
        return { isValid: false, reason: 'occupied', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
    }

    if (koInfo && koInfo.point.x === x && koInfo.point.y === y && koInfo.turn === moveHistoryLength) {
        return { isValid: false, reason: 'ko', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
    }

    const tempBoard = boardState.map((row) => [...row]) as BoardState;
    tempBoard[y][x] = player;

    let capturedStones: Point[] = [];
    let singleCapturePoint: Point | null = null;
    const checkedOpponentNeighbors = new Set<string>();

    for (const n of getNeighbors(x, y, boardSize)) {
        const key = pointKey(n.x, n.y);
        if (tempBoard[n.y][n.x] === opponent && !checkedOpponentNeighbors.has(key)) {
            const group = findGroupWithCastleRules(session, tempBoard, n.x, n.y, opponent);
            if (group && group.liberties === 0) {
                const capturable = group.stones.filter(
                    (s) => !isStoneImmuneInCastleTerritory(session, tempBoard, s.x, s.y),
                );
                if (capturable.length > 0) {
                    capturedStones.push(...capturable);
                    if (capturable.length === 1) {
                        singleCapturePoint = capturable[0];
                    }
                }
                group.stones.forEach((s) => checkedOpponentNeighbors.add(pointKey(s.x, s.y)));
            }
        }
    }

    if (capturedStones.length > 0) {
        for (const stone of capturedStones) {
            tempBoard[stone.y][stone.x] = Player.None;
        }
    }

    const myGroup = findGroupWithCastleRules(session, tempBoard, x, y, player);
    if (myGroup && myGroup.liberties === 0) {
        return { isValid: false, reason: 'suicide', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
    }

    let newKoInfo: LiveGameSession['koInfo'] = null;
    if (
        myGroup &&
        capturedStones.length === 1 &&
        myGroup.stones.length === 1 &&
        myGroup.liberties === 1 &&
        singleCapturePoint != null
    ) {
        newKoInfo = { point: singleCapturePoint, turn: moveHistoryLength + 1 };
    }
    if (capturedStones.length !== 1) {
        newKoInfo = null;
    }

    return { isValid: true, newBoardState: tempBoard, capturedStones, newKoInfo };
}

export function enumerateLegalCastleMoves(session: CastleGoSessionSlice, player: Player): Point[] {
    const board = session.boardState;
    if (!board?.length) return [];
    const boardSize = board.length;
    const moves: Point[] = [];

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (!isPlayableCastleIntersection(session, x, y, player)) continue;
            const result = processCastleMove(session, board, { x, y, player }, null, 0);
            if (result.isValid) moves.push({ x, y });
        }
    }
    return moves;
}

export function hasAnyLegalCastleMove(session: CastleGoSessionSlice): boolean {
    return (
        enumerateLegalCastleMoves(session, Player.Black).length > 0 ||
        enumerateLegalCastleMoves(session, Player.White).length > 0
    );
}

export function scoreCastleGame(session: CastleGoSessionSlice & { settings: { komi: number } }): {
    black: number;
    white: number;
    winner: Player.Black | Player.White | null;
} {
    const board = session.boardState;
    const boardSize = board.length;
    let black = 0;
    let white = 0;

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            const cell = board[y][x];
            if (cell === Player.Black) {
                black += 1;
            } else if (cell === Player.White) {
                white += 1;
            } else {
                const owner = getConfirmedTerritoryOwner(session, x, y);
                if (owner === Player.Black) black += 1;
                else if (owner === Player.White) white += 1;
            }
        }
    }

    white += session.settings.komi;

    let winner: Player.Black | Player.White | null = null;
    if (black > white) winner = Player.Black;
    else if (white > black) winner = Player.White;

    return { black, white, winner };
}

/** Deterministic PRNG from string seed */
function hashSeed(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(a: number): () => number {
    return () => {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function generateCastleStonePoints(
    boardSize: number,
    count: number,
    seed: string,
): Point[] {
    const n = clampCastleCount(count, boardSize);
    const rng = mulberry32(hashSeed(seed));
    const candidates: Point[] = [];
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            candidates.push({ x, y });
        }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
    }
    return candidates.slice(0, n);
}

export function getCasualCastleDefaultSettings(boardSize: 9 | 13): {
    boardSize: 9 | 13;
    castleCount: CastleCount;
    komi: number;
} {
    return {
        boardSize,
        castleCount: getDefaultCastleCountByBoardSize(boardSize),
        komi: boardSize === 9 ? 2.5 : 6.5,
    };
}
