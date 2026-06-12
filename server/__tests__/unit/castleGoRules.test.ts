import { describe, expect, it } from 'vitest';
import { Player } from '../../../shared/types/enums.js';
import type { BoardState } from '../../../shared/types/entities.js';
import {
    detectAndConfirmTerritories,
    generateCastleStonePoints,
    hasAnyLegalCastleMove,
    isPlayableCastleIntersection,
    pointKey,
    processCastleMove,
    scoreCastleGame,
} from '../../../shared/utils/castleGoRules.js';

function emptyBoard(size: number): BoardState {
    return Array.from({ length: size }, () => Array(size).fill(Player.None)) as BoardState;
}

function sessionOf(
    board: BoardState,
    extras: {
        castleStonePoints?: { x: number; y: number }[];
        confirmedTerritoryOwnerByPoint?: Record<string, Player.Black | Player.White>;
        komi?: number;
    } = {},
) {
    return {
        boardState: board,
        castleStonePoints: extras.castleStonePoints ?? [],
        confirmedTerritoryOwnerByPoint: extras.confirmedTerritoryOwnerByPoint ?? {},
        settings: { komi: extras.komi ?? 6.5 },
    };
}

describe('generateCastleStonePoints', () => {
    it('places requested count without duplicates', () => {
        const pts = generateCastleStonePoints(9, 3, 'seed-a');
        expect(pts).toHaveLength(3);
        const keys = new Set(pts.map((p) => pointKey(p.x, p.y)));
        expect(keys.size).toBe(3);
        pts.forEach((p) => {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThan(9);
        });
    });

    it('is deterministic for same seed', () => {
        const a = generateCastleStonePoints(13, 2, 'game-123');
        const b = generateCastleStonePoints(13, 2, 'game-123');
        expect(a).toEqual(b);
    });
});

describe('territory confirmation', () => {
    it('confirms interior when surrounded on three edges', () => {
        const board = emptyBoard(5);
        // black top row and left/right columns leaving bottom edge open (3 edges)
        for (let x = 0; x < 5; x++) board[0][x] = Player.Black;
        for (let y = 0; y < 5; y++) {
            board[y][0] = Player.Black;
            board[y][4] = Player.Black;
        }
        const session = sessionOf(board);
        const confirmed = detectAndConfirmTerritories(session, board);
        expect(confirmed[pointKey(2, 2)]).toBe(Player.Black);
    });

    it('does not confirm when all four edges are used', () => {
        const board = emptyBoard(5);
        board[0][0] = Player.Black;
        board[0][4] = Player.Black;
        board[4][0] = Player.Black;
        board[4][4] = Player.Black;
        const session = sessionOf(board);
        const confirmed = detectAndConfirmTerritories(session, board);
        expect(Object.keys(confirmed)).toHaveLength(0);
    });

    it('does not confirm when opponent stone touches region', () => {
        const board = emptyBoard(5);
        for (let x = 0; x < 5; x++) board[0][x] = Player.Black;
        for (let y = 0; y < 5; y++) {
            board[y][0] = Player.Black;
            board[y][4] = Player.Black;
        }
        board[2][2] = Player.White;
        const session = sessionOf(board);
        const confirmed = detectAndConfirmTerritories(session, board);
        expect(Object.keys(confirmed)).toHaveLength(0);
    });

    it('confirms interior when castles block connection to outer empty', () => {
        const board = emptyBoard(5);
        for (let x = 1; x <= 3; x++) {
            board[1][x] = Player.Black;
            board[3][x] = Player.Black;
        }
        board[2][1] = Player.Black;
        board[2][3] = Player.Black;
        const session = sessionOf(board, {
            castleStonePoints: [{ x: 2, y: 3 }],
        });
        const confirmed = detectAndConfirmTerritories(session, board);
        expect(confirmed[pointKey(2, 2)]).toBe(Player.Black);
    });

    it('confirms territory when castles replace stones in enclosure wall', () => {
        const board = emptyBoard(3);
        for (let x = 0; x < 3; x++) {
            board[0][x] = Player.Black;
            board[2][x] = Player.Black;
        }
        board[1][2] = Player.Black;
        const session = sessionOf(board, {
            castleStonePoints: [{ x: 0, y: 1 }],
        });
        const confirmed = detectAndConfirmTerritories(session, board);
        expect(confirmed[pointKey(1, 1)]).toBe(Player.Black);
    });

    it('confirms white territory using castle walls', () => {
        const board = emptyBoard(3);
        for (let y = 0; y < 3; y++) {
            board[y][0] = Player.White;
            board[y][2] = Player.White;
        }
        board[2][1] = Player.White;
        const session = sessionOf(board, {
            castleStonePoints: [{ x: 0, y: 1 }],
        });
        const confirmed = detectAndConfirmTerritories(session, board);
        expect(confirmed[pointKey(1, 1)]).toBe(Player.White);
    });
});

describe('processCastleMove', () => {
    it('blocks placement on castle and confirmed territory', () => {
        const board = emptyBoard(3);
        const session = sessionOf(board, {
            castleStonePoints: [{ x: 1, y: 1 }],
            confirmedTerritoryOwnerByPoint: { [pointKey(0, 0)]: Player.Black },
        });
        expect(isPlayableCastleIntersection(session, 1, 1, Player.Black)).toBe(false);
        expect(isPlayableCastleIntersection(session, 0, 0, Player.Black)).toBe(false);
    });

    it('allows capture outside confirmed territory', () => {
        const board = emptyBoard(3);
        board[1][1] = Player.White;
        board[1][0] = Player.Black;
        board[0][1] = Player.Black;
        board[1][2] = Player.Black;
        const session = sessionOf(board);
        const result = processCastleMove(session, board, { x: 1, y: 2, player: Player.Black }, null, 0);
        expect(result.isValid).toBe(true);
        expect(result.capturedStones).toHaveLength(1);
    });

    it('blocks placement on confirmed territory even when capture is possible', () => {
        const board = emptyBoard(5);
        board[2][2] = Player.White;
        board[2][1] = Player.Black;
        board[1][2] = Player.Black;
        board[3][2] = Player.Black;
        const session = sessionOf(board, {
            confirmedTerritoryOwnerByPoint: { [pointKey(2, 3)]: Player.Black },
        });
        expect(isPlayableCastleIntersection(session, 2, 3, Player.Black)).toBe(false);
        const result = processCastleMove(session, board, { x: 2, y: 3, player: Player.Black }, null, 0);
        expect(result.isValid).toBe(false);
        expect(result.capturedStones).toHaveLength(0);
    });
});

describe('scoreCastleGame', () => {
    it('adds komi to white and picks winner', () => {
        const board = emptyBoard(3);
        board[0][0] = Player.Black;
        board[0][1] = Player.Black;
        const session = sessionOf(board, {
            confirmedTerritoryOwnerByPoint: {
                [pointKey(1, 1)]: Player.Black,
                [pointKey(2, 2)]: Player.Black,
                [pointKey(0, 2)]: Player.Black,
                [pointKey(2, 0)]: Player.Black,
            },
            komi: 0.5,
        });
        const score = scoreCastleGame(session);
        expect(score.black).toBeGreaterThan(score.white);
        expect(score.winner).toBe(Player.Black);
    });
});

describe('hasAnyLegalCastleMove', () => {
    it('returns false on full board', () => {
        const board = emptyBoard(2);
        board[0][0] = Player.Black;
        board[0][1] = Player.White;
        board[1][0] = Player.White;
        board[1][1] = Player.Black;
        const session = sessionOf(board);
        expect(hasAnyLegalCastleMove(session)).toBe(false);
    });
});
