import { describe, expect, it } from 'vitest';
import {
    applyShortRankedGameEloModifier,
    countValidStoneMoves,
    isShortRankedGameMoveCount,
} from '../../../shared/utils/shortRankedGamePenalty.js';
import { calculateEloChange } from '../../summaryService.js';

describe('shortRankedGamePenalty', () => {
    it('counts only stone placements (excludes pass)', () => {
        expect(
            countValidStoneMoves([
                { x: 3, y: 3 },
                { x: -1, y: -1 },
                { x: 4, y: 4 },
            ]),
        ).toBe(2);
        expect(isShortRankedGameMoveCount([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(true);
        expect(
            isShortRankedGameMoveCount(
                Array.from({ length: 10 }, (_, i) => ({ x: i % 9, y: Math.floor(i / 9) })),
            ),
        ).toBe(false);
    });

    it('halves win Elo and doubles loss Elo', () => {
        expect(applyShortRankedGameEloModifier(16, 'win')).toBe(8);
        expect(applyShortRankedGameEloModifier(7, 'win')).toBe(3);
        expect(applyShortRankedGameEloModifier(-16, 'loss')).toBe(-32);
        expect(applyShortRankedGameEloModifier(-6, 'loss')).toBe(-12);
        expect(applyShortRankedGameEloModifier(16, 'draw')).toBe(16);
        expect(applyShortRankedGameEloModifier(0, 'win')).toBe(0);
    });

    it('applies half/double on top of standard Elo bounds', () => {
        const win = calculateEloChange(1200, 1200, 'win');
        const loss = calculateEloChange(1200, 1200, 'loss');
        expect(win).toBe(16);
        expect(loss).toBe(-16);
        expect(applyShortRankedGameEloModifier(win, 'win')).toBe(8);
        expect(applyShortRankedGameEloModifier(loss, 'loss')).toBe(-32);
    });
});
