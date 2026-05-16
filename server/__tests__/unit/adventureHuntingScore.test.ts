import { describe, expect, it } from 'vitest';
import {
    bumpAdventureHuntingScoreOnDefeat,
    getAdventureHuntingScore,
} from '../../../shared/utils/adventureHuntingScore.js';

describe('adventureHuntingScore', () => {
    it('accumulates monster level on defeat', () => {
        let profile = bumpAdventureHuntingScoreOnDefeat({}, 12, 1000);
        profile = bumpAdventureHuntingScoreOnDefeat(profile, 5, 2000);
        expect(getAdventureHuntingScore(profile)).toEqual({ score: 17, reachedAt: 2000 });
    });

    it('uses earlier reachedAt for tie-break reads', () => {
        const a = getAdventureHuntingScore({ huntingScoreTotal: 50, huntingScoreReachedAt: 100 });
        const b = getAdventureHuntingScore({ huntingScoreTotal: 50, huntingScoreReachedAt: 200 });
        expect(a.reachedAt).toBeLessThan(b.reachedAt);
    });
});
