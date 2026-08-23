import { describe, expect, it } from 'vitest';
import {
    KATA_LOW_WINRATE_BEST_MOVE_THRESHOLD,
    applyKataWinrateBestMovePreference,
    readKataPreferBestMoveLowWinrate,
    resolveKataPreferBestMoveLowWinrate,
} from '../../../shared/utils/kataLowWinrateBestMove.js';

describe('kataLowWinrateBestMove', () => {
    it('enters bestMove mode when winrate drops below threshold', () => {
        expect(resolveKataPreferBestMoveLowWinrate(false, 0.09)).toBe(true);
        expect(resolveKataPreferBestMoveLowWinrate(false, KATA_LOW_WINRATE_BEST_MOVE_THRESHOLD - 0.001)).toBe(true);
    });

    it('exits bestMove mode when winrate recovers to threshold or above', () => {
        expect(resolveKataPreferBestMoveLowWinrate(true, 0.1)).toBe(false);
        expect(resolveKataPreferBestMoveLowWinrate(true, 0.15)).toBe(false);
    });

    it('keeps previous mode when winrate is missing', () => {
        expect(resolveKataPreferBestMoveLowWinrate(true, undefined)).toBe(true);
        expect(resolveKataPreferBestMoveLowWinrate(false, null)).toBe(false);
    });

    it('persists preference on game and returns value for this turn', () => {
        const game = { kataPreferBestMoveLowWinrate: false as boolean | undefined };
        expect(applyKataWinrateBestMovePreference(game, 0.05)).toBe(true);
        expect(readKataPreferBestMoveLowWinrate(game)).toBe(true);

        expect(applyKataWinrateBestMovePreference(game, 0.12)).toBe(false);
        expect(readKataPreferBestMoveLowWinrate(game)).toBe(false);
    });
});
