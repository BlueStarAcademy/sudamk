import { describe, expect, it } from 'vitest';
import {
    CHAMPIONSHIP_VERSUS_ELO_DEFAULT,
    applyVersusGoldRewardVenueMultiplier,
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
        expect(champCoinsForVersusWin(1200)).toBe(45);
        expect(champCoinsForVersusLoss(1200)).toBe(9);
        expect(champCoinsForVersusWin(CHAMPIONSHIP_VERSUS_ELO_DEFAULT)).toBe(45);
    });

    it('applies venue-specific gold multipliers', () => {
        expect(applyVersusGoldRewardVenueMultiplier(120, 'pvp')).toBe(1200);
        expect(applyVersusGoldRewardVenueMultiplier(120, 'pet')).toBe(1200);
        expect(applyVersusGoldRewardVenueMultiplier(120, 'petpair')).toBe(1800);
    });
});
