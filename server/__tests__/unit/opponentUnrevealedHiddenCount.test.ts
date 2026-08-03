import { describe, expect, it } from 'vitest';
import { Player } from '../../../types/index.js';
import type { LiveGameSession } from '../../../types/index.js';
import {
    countUnrevealedOpponentHiddenStones,
    hasOpponentHiddenScanTargets,
} from '../../../shared/utils/opponentUnrevealedHiddenCount.js';

const emptyBoard = (size: number) =>
    Array.from({ length: size }, () => Array(size).fill(Player.None));

const baseGame = (overrides: Partial<LiveGameSession> = {}): LiveGameSession =>
    ({
        id: 'hidden-count-test',
        boardState: emptyBoard(5),
        moveHistory: [],
        hiddenMoves: {},
        permanentlyRevealedStones: [],
        revealedHiddenMoves: {},
        settings: { boardSize: 5, hiddenStoneCount: 2 },
        ...overrides,
    }) as LiveGameSession;

describe('countUnrevealedOpponentHiddenStones', () => {
    it('counts two unrevealed opponent hiddens still on board', () => {
        const board = emptyBoard(5);
        board[1][1] = Player.White;
        board[2][2] = Player.White;
        const game = baseGame({
            boardState: board,
            moveHistory: [
                { x: 1, y: 1, player: Player.White },
                { x: 2, y: 2, player: Player.White },
            ],
            hiddenMoves: { 0: true, 1: true },
        });
        expect(countUnrevealedOpponentHiddenStones(game, 'viewer-1', Player.White)).toBe(2);
        expect(hasOpponentHiddenScanTargets(game, 'viewer-1', Player.White)).toBe(true);
    });

    it('excludes permanently revealed stones', () => {
        const board = emptyBoard(5);
        board[1][1] = Player.White;
        board[2][2] = Player.White;
        const game = baseGame({
            boardState: board,
            moveHistory: [
                { x: 1, y: 1, player: Player.White },
                { x: 2, y: 2, player: Player.White },
            ],
            hiddenMoves: { 0: true, 1: true },
            permanentlyRevealedStones: [{ x: 1, y: 1 }],
        });
        expect(countUnrevealedOpponentHiddenStones(game, 'viewer-1', Player.White)).toBe(1);
    });

    it('excludes stones the viewer already soft-scanned', () => {
        const board = emptyBoard(5);
        board[1][1] = Player.White;
        const game = baseGame({
            boardState: board,
            moveHistory: [{ x: 1, y: 1, player: Player.White }],
            hiddenMoves: { 0: true },
            revealedHiddenMoves: { 'viewer-1': [0] },
        });
        expect(countUnrevealedOpponentHiddenStones(game, 'viewer-1', Player.White)).toBe(0);
        expect(hasOpponentHiddenScanTargets(game, 'viewer-1', Player.White)).toBe(false);
    });

    it('includes unrevealed aiInitialHiddenStone', () => {
        const board = emptyBoard(5);
        board[3][3] = Player.White;
        const game = baseGame({
            boardState: board,
            aiInitialHiddenStone: { x: 3, y: 3 },
        } as Partial<LiveGameSession>);
        expect(countUnrevealedOpponentHiddenStones(game, 'viewer-1', Player.White)).toBe(1);
    });

    it('skips pre-placed AI initial when excludePrePlacedAiInitialHidden is set', () => {
        const board = emptyBoard(5);
        board[3][3] = Player.White;
        const game = baseGame({
            boardState: board,
            aiInitialHiddenStone: { x: 3, y: 3 },
            aiInitialHiddenStoneIsPrePlaced: true,
        } as Partial<LiveGameSession>);
        expect(
            countUnrevealedOpponentHiddenStones(game, 'viewer-1', Player.White, {
                excludePrePlacedAiInitialHidden: true,
            }),
        ).toBe(0);
    });

    it('allows empty board cells for hidden moves when opted in', () => {
        const board = emptyBoard(5);
        // cell stays None — pair/tower merge timing
        const game = baseGame({
            boardState: board,
            moveHistory: [{ x: 1, y: 1, player: Player.White }],
            hiddenMoves: { 0: true },
        });
        expect(countUnrevealedOpponentHiddenStones(game, 'viewer-1', Player.White)).toBe(0);
        expect(
            countUnrevealedOpponentHiddenStones(game, 'viewer-1', Player.White, {
                allowEmptyBoardCellForHiddenMoves: true,
            }),
        ).toBe(1);
    });
});
