import { describe, expect, it } from 'vitest';
import { Player } from '../../../../types.js';
import { buildBoardCellStoneLookup } from '../../../../utils/boardCellLookup.js';

describe('boardCellLookup', () => {
    it('marks occupied intersections only', () => {
        const board = [
            [Player.Black, Player.None],
            [Player.None, Player.White],
        ];
        const lookup = buildBoardCellStoneLookup(board, {
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
            myPlayerEnum: Player.Black,
            baseHiddenMoveCtx: null,
        });

        expect(lookup.size).toBe(2);
        expect(lookup.has('0,0')).toBe(true);
        expect(lookup.has('1,1')).toBe(true);
        expect(lookup.has('1,0')).toBe(false);
    });
});
