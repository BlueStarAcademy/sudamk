import { describe, expect, it } from 'vitest';
import { Player } from '../../../shared/types/enums.js';
import { collectCapturingHiddenContributors } from '../../../shared/utils/capturingHiddenContributors.js';

const emptyBoard = (size: number) =>
    Array.from({ length: size }, () => Array(size).fill(Player.None));

describe('collectCapturingHiddenContributors', () => {
    it('includes disconnected hidden surrounder adjacent to captured stones', () => {
        // After White captures Black at (1,1) by playing M at (1,2):
        //   . W .
        //   H . W   H = hidden white at (0,1), not connected to M
        //   . M .
        const board = emptyBoard(3);
        board[0][1] = Player.White;
        board[1][0] = Player.White;
        board[1][2] = Player.White;
        board[2][1] = Player.White;

        const hiddenKey = new Set(['0,1']);
        const contributors = collectCapturingHiddenContributors({
            boardAfterMove: board,
            move: { x: 1, y: 2 },
            movePlayer: Player.White,
            capturedStones: [{ x: 1, y: 1 }],
            isUnrevealedHiddenAt: (x, y) => hiddenKey.has(`${x},${y}`),
        });

        expect(contributors.some((c) => c.point.x === 0 && c.point.y === 1)).toBe(true);
    });

    it('still finds hidden stones in the connected capturing group', () => {
        // H-W connected chain including the move
        //   H W
        //   W M   after capture of black elsewhere — group from M includes H
        const board = emptyBoard(3);
        board[0][0] = Player.White;
        board[0][1] = Player.White;
        board[1][0] = Player.White;
        board[1][1] = Player.White;

        const contributors = collectCapturingHiddenContributors({
            boardAfterMove: board,
            move: { x: 1, y: 1 },
            movePlayer: Player.White,
            capturedStones: [{ x: 2, y: 1 }],
            isUnrevealedHiddenAt: (x, y, isCurrent) => !isCurrent && x === 0 && y === 0,
        });

        expect(contributors).toEqual([{ point: { x: 0, y: 0 }, player: Player.White }]);
    });
});
