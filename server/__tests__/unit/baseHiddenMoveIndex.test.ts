import { describe, expect, it } from 'vitest';
import { findLatestMoveIndexAtExcludingRecordedBaseStones } from '../../../shared/utils/baseHiddenMoveIndex.js';
import { Player } from '../../../types/enums.js';

describe('findLatestMoveIndexAtExcludingRecordedBaseStones', () => {
    it('returns -1 for a recorded base intersection even if moveHistory has a matching stone entry', () => {
        const moveHistory = [{ x: 2, y: 2, player: Player.Black }];
        const baseCtx = {
            gameStatus: 'playing' as const,
            baseStones: [{ x: 2, y: 2, player: Player.Black }],
            baseStones_p1: [],
            baseStones_p2: [],
        };
        expect(findLatestMoveIndexAtExcludingRecordedBaseStones(moveHistory, 2, 2, Player.Black, baseCtx)).toBe(-1);
    });

    it('still resolves the latest matching move when the intersection is not a recorded base stone', () => {
        const moveHistory = [
            { x: 1, y: 1, player: Player.Black },
            { x: 3, y: 3, player: Player.White },
        ];
        const baseCtx = {
            gameStatus: 'playing' as const,
            baseStones: [{ x: 2, y: 2, player: Player.Black }],
            baseStones_p1: [],
            baseStones_p2: [],
        };
        expect(findLatestMoveIndexAtExcludingRecordedBaseStones(moveHistory, 3, 3, Player.White, baseCtx)).toBe(1);
    });
});
