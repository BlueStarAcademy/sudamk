import { describe, expect, it } from 'vitest';
import {
    bumpAdventureHuntingScoreOnDefeat,
    getAdventureHuntingScore,
    reduceAdventureHuntingScoreOnLoss,
} from '../../../shared/utils/adventureHuntingScore.js';

describe('adventureHuntingScore', () => {
    it('accumulates monster level on defeat', () => {
        let profile = bumpAdventureHuntingScoreOnDefeat({}, 12, 1000);
        profile = bumpAdventureHuntingScoreOnDefeat(profile, 5, 2000);
        expect(getAdventureHuntingScore(profile)).toEqual({ score: 17, reachedAt: 2000 });
    });

    it('deducts monster level on loss without going below zero', () => {
        let profile = bumpAdventureHuntingScoreOnDefeat({}, 20, 1000);
        profile = reduceAdventureHuntingScoreOnLoss(profile, 8);
        expect(getAdventureHuntingScore(profile).score).toBe(12);
        profile = reduceAdventureHuntingScoreOnLoss(profile, 99);
        expect(getAdventureHuntingScore(profile).score).toBe(0);
    });

    it('uses earlier reachedAt for tie-break reads', () => {
        const a = getAdventureHuntingScore({ huntingScoreTotal: 50, huntingScoreReachedAt: 100 });
        const b = getAdventureHuntingScore({ huntingScoreTotal: 50, huntingScoreReachedAt: 200 });
        expect(a.reachedAt).toBeLessThan(b.reachedAt);
    });
});
