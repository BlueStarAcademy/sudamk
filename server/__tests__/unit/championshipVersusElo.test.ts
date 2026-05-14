import { describe, expect, it } from 'vitest';
import {
    CHAMPIONSHIP_VERSUS_ELO_DEFAULT,
    computeEloPairAfterMatch,
    champCoinsForVersusLoss,
    champCoinsForVersusWin,
} from '../../../shared/utils/championshipVersusElo.js';

describe('championshipVersusElo', () => {
    it('computes symmetric ELO update for equal ratings at 1200 base', () => {
        const { winnerNext, loserNext } = computeEloPairAfterMatch(1200, 1200, 32);
        expect(winnerNext).toBe(1216);
        expect(loserNext).toBe(1184);
    });

    it('awards champ coins from pre-match rating', () => {
        expect(champCoinsForVersusWin(1200)).toBe(90);
        expect(champCoinsForVersusLoss(1200)).toBe(18);
        expect(champCoinsForVersusWin(CHAMPIONSHIP_VERSUS_ELO_DEFAULT)).toBe(90);
    });
});
