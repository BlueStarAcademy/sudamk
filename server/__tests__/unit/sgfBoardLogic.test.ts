import { describe, expect, it } from 'vitest';
import { Player } from '../../../types/index.js';
import {
    applyMoveToBoard,
    applySgfMoveToBoard,
    cloneBoard,
    collectCapturedPoints,
    createEmptyBoard,
} from '../../../utils/sgfBoardLogic.js';

describe('sgfBoardLogic', () => {
    it('applySgfMoveToBoard uses AE removed stones instead of rule simulation', () => {
        const board = createEmptyBoard(9);
        board[0][0] = Player.White;
        board[0][1] = Player.Black;

        applySgfMoveToBoard(
            board,
            { player: Player.White, x: 1, y: 0, removed: [{ x: 0, y: 0 }] },
            9,
        );

        expect(board[0][0]).toBe(Player.None);
        expect(board[0][1]).toBe(Player.White);
    });

    it('collectCapturedPoints detects removed opponent stones', () => {
        const board = createEmptyBoard(9);
        board[0][0] = Player.White;
        board[0][1] = Player.Black;
        const before = cloneBoard(board);
        const after = cloneBoard(board);
        const move = { player: Player.Black, x: 0, y: 1 };
        applyMoveToBoard(after, move, 9);
        const captured = collectCapturedPoints(before, after, move, 9);
        expect(captured).toEqual([{ x: 0, y: 0 }]);
    });
});
