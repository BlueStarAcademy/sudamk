import { describe, expect, it } from 'vitest';
import { GameMode } from '../../../types/enums.js';
import { RANKED_ELO_BASE_SCORE } from '../../../shared/constants/rules.js';
import {
    STRATEGIC_RANKED_MATCH_RECORD_KEY,
    STRATEGIC_RANKED_STAT_KEY,
} from '../../../shared/constants/userRankedStats.js';
import {
    hasPlayfulCategoryStatsToReset,
    hasSingleModeStatsToReset,
    hasStrategicCategoryStatsToReset,
} from '../../../shared/utils/detailedStatResetChecks.js';
import { resetPlayfulCategoryStats, resetSingleModeStat, resetStrategicCategoryStats } from '../../utils/detailedStatsReset.js';
import type { User } from '../../../types/index.js';

const baseUser = (): User =>
    ({
        id: 'u1',
        stats: {
            [GameMode.Standard]: { wins: 3, losses: 1, aiWins: 2, aiLosses: 0 },
            [GameMode.Dice]: { wins: 1, losses: 4, aiWins: 0, aiLosses: 1 },
            [STRATEGIC_RANKED_STAT_KEY]: { rankingScore: 1310 },
            [STRATEGIC_RANKED_MATCH_RECORD_KEY]: { wins: 5, losses: 2 },
        },
        dailyRankings: { strategic: { rank: 12, score: 110, lastUpdated: 1 } },
        cumulativeRankingScore: { standard: 42 },
        diamonds: 1000,
    }) as User;

describe('detailedStatsReset', () => {
    it('resets only PVP on a single mode', () => {
        const user = baseUser();
        expect(hasSingleModeStatsToReset(user, GameMode.Standard, 'pvp')).toBe(true);
        resetSingleModeStat(user, GameMode.Standard, 'pvp');
        expect(user.stats?.[GameMode.Standard]).toEqual({ wins: 0, losses: 0, aiWins: 2, aiLosses: 0 });
    });

    it('resets only AI on a single mode', () => {
        const user = baseUser();
        resetSingleModeStat(user, GameMode.Standard, 'ai');
        expect(user.stats?.[GameMode.Standard]).toEqual({ wins: 3, losses: 1, aiWins: 0, aiLosses: 0 });
    });

    it('resets strategic category PVP and season ranking', () => {
        const user = baseUser();
        expect(hasStrategicCategoryStatsToReset(user, 'pvp')).toBe(true);
        resetStrategicCategoryStats(user, 99, 'pvp');
        expect(user.stats?.[GameMode.Standard]).toEqual({ wins: 0, losses: 0, aiWins: 2, aiLosses: 0 });
        expect(user.stats?.[STRATEGIC_RANKED_MATCH_RECORD_KEY]).toEqual({ wins: 0, losses: 0 });
        expect(user.stats?.[STRATEGIC_RANKED_STAT_KEY]?.rankingScore).toBe(RANKED_ELO_BASE_SCORE);
        expect(user.dailyRankings?.strategic).toEqual({ rank: 0, score: 0, lastUpdated: 99 });
        expect(user.stats?.[GameMode.Dice]).toEqual({ wins: 1, losses: 4, aiWins: 0, aiLosses: 1 });
    });

    it('resets strategic category AI only', () => {
        const user = baseUser();
        resetStrategicCategoryStats(user, 99, 'ai');
        expect(user.stats?.[GameMode.Standard]).toEqual({ wins: 3, losses: 1, aiWins: 0, aiLosses: 0 });
        expect(user.stats?.[STRATEGIC_RANKED_STAT_KEY]?.rankingScore).toBe(1310);
    });

    it('resets playful category by scope', () => {
        const user = baseUser();
        expect(hasPlayfulCategoryStatsToReset(user, 'ai')).toBe(true);
        resetPlayfulCategoryStats(user, 'ai');
        expect(user.stats?.[GameMode.Dice]).toEqual({ wins: 1, losses: 4, aiWins: 0, aiLosses: 0 });
    });
});
