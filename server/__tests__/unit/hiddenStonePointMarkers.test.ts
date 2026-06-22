import { describe, expect, it } from 'vitest';
import { Player } from '../../../types/index.js';
import {
    reconcileHiddenMovesFromStonePoints,
    upsertHiddenStonePoint,
} from '../../../shared/utils/hiddenStonePointMarkers.js';

describe('hiddenStonePointMarkers', () => {
    it('reconciles hiddenMoves from aiHiddenStonePoints when index metadata is missing', () => {
        const moveHistory = [
            { x: 0, y: 0, player: Player.Black },
            { x: 3, y: 3, player: Player.White },
        ];
        const aiHiddenStonePoints = [{ x: 3, y: 3, player: Player.White }];
        const reconciled = reconcileHiddenMovesFromStonePoints({}, moveHistory, aiHiddenStonePoints);
        expect(reconciled[1]).toBe(true);
    });

    it('upsertHiddenStonePoint keeps one entry per player and coordinate', () => {
        const first = upsertHiddenStonePoint(undefined, { x: 1, y: 1 }, Player.White);
        const second = upsertHiddenStonePoint(first, { x: 1, y: 1 }, Player.White);
        expect(second).toHaveLength(1);
        expect(second[0]).toEqual({ x: 1, y: 1, player: Player.White });
    });
});
