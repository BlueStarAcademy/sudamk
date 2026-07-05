import { describe, expect, it } from 'vitest';
import {
    CHAMPIONSHIP_VERSUS_ELO_DEFAULT,
    applyVersusGoldRewardVenueMultiplier,
    computeEloPairAfterMatch,
    champCoinsForVersusLoss,
    champCoinsForVersusWin,
    normalizeChampionshipVersusVenueRatingEntryInPlace,
} from '../../../shared/utils/championshipVersusElo.js';
import type { User } from '../../../shared/types/entities.js';
import { getCurrentSeason, getPreviousSeason } from '../../../shared/utils/timeUtils.js';

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

    it('resets carried championship versus rating when the season changes', () => {
        const now = Date.now();
        const user = {
            championshipVersusVenueRatings: {
                pvp: {
                    rating: 1640,
                    ratingSeasonKey: getPreviousSeason(now).name,
                    seasonWins: 12,
                    seasonLosses: 8,
                },
            },
        } as unknown as User;

        const entry = normalizeChampionshipVersusVenueRatingEntryInPlace('pvp', user, now);

        expect(entry).toEqual({
            rating: CHAMPIONSHIP_VERSUS_ELO_DEFAULT,
            ratingSeasonKey: getCurrentSeason(now).name,
            seasonWins: 0,
            seasonLosses: 0,
        });
    });

    it('backfills current-season zero-game ratings to the base score', () => {
        const now = Date.now();
        const user = {
            championshipVersusVenueRatings: {
                pvp: {
                    rating: 1512,
                    ratingSeasonKey: getCurrentSeason(now).name,
                    seasonWins: 0,
                    seasonLosses: 0,
                },
            },
        } as unknown as User;

        const entry = normalizeChampionshipVersusVenueRatingEntryInPlace('pvp', user, now);

        expect(entry.rating).toBe(CHAMPIONSHIP_VERSUS_ELO_DEFAULT);
        expect(entry.seasonWins).toBe(0);
        expect(entry.seasonLosses).toBe(0);
    });

    it('keeps an active current-season rating after games are played', () => {
        const now = Date.now();
        const user = {
            championshipVersusVenueRatings: {
                pvp: {
                    rating: 1512,
                    ratingSeasonKey: getCurrentSeason(now).name,
                    seasonWins: 1,
                    seasonLosses: 0,
                },
            },
        } as unknown as User;

        const entry = normalizeChampionshipVersusVenueRatingEntryInPlace('pvp', user, now);

        expect(entry.rating).toBe(1512);
        expect(entry.seasonWins).toBe(1);
    });
});
