import { describe, expect, it } from 'vitest';
import { Player } from '../../../types/index.js';
import {
    getPlacementOccupancyBlockReason,
    getPlacementOccupant,
    isUnrevealedOpponentHiddenStoneAt,
} from '../../../shared/utils/hiddenStonePlacementOccupancy.js';

describe('hiddenStonePlacementOccupancy', () => {
    const emptyBoard = Array.from({ length: 9 }, () => Array(9).fill(Player.None));

    it('treats opponent stone on board as occupied', () => {
        const board = emptyBoard.map((row) => [...row]);
        board[3][3] = Player.White;
        const reason = getPlacementOccupancyBlockReason(board, {}, 3, 3, Player.Black);
        expect(reason).toBe('opponent');
    });

    it('treats unrevealed aiInitialHiddenStone as opponent occupied when board cell is empty', () => {
        const reason = getPlacementOccupancyBlockReason(
            emptyBoard.map((row) => [...row]),
            { aiInitialHiddenStone: { x: 2, y: 2 } },
            2,
            2,
            Player.Black,
        );
        expect(reason).toBe('opponent');
        expect(getPlacementOccupant(emptyBoard, { aiInitialHiddenStone: { x: 2, y: 2 } }, 2, 2, Player.White)).toBe(
            Player.White,
        );
    });

    it('allows placement on empty intersection', () => {
        const reason = getPlacementOccupancyBlockReason(emptyBoard, {}, 4, 4, Player.Black);
        expect(reason).toBeNull();
    });

    it('detects unrevealed opponent hidden via aiInitialHiddenStone', () => {
        const board = emptyBoard.map((row) => [...row]);
        expect(
            isUnrevealedOpponentHiddenStoneAt(
                board,
                { aiInitialHiddenStone: { x: 1, y: 1 } },
                1,
                1,
                Player.Black,
            ),
        ).toBe(true);
    });

    it('detects unrevealed opponent hidden via hiddenMoves', () => {
        const board = emptyBoard.map((row) => [...row]);
        board[4][4] = Player.White;
        expect(
            isUnrevealedOpponentHiddenStoneAt(
                board,
                {
                    moveHistory: [{ x: 4, y: 4, player: Player.White }],
                    hiddenMoves: { 0: true },
                },
                4,
                4,
                Player.Black,
            ),
        ).toBe(true);
    });

    it('detects unrevealed opponent hidden via aiHiddenStonePoints without hiddenMoves', () => {
        const board = emptyBoard.map((row) => [...row]);
        board[2][5] = Player.White;
        expect(
            isUnrevealedOpponentHiddenStoneAt(
                board,
                {
                    aiHiddenStonePoints: [{ x: 5, y: 2, player: Player.White }],
                },
                5,
                2,
                Player.Black,
            ),
        ).toBe(true);
    });
});
