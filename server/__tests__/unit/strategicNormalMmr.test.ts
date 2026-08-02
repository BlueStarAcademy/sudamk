import { describe, expect, it } from 'vitest';
import {
    applyNormalMatchScoreDelta,
    ensureStrategicNormalStatBlock,
    readStrategicNormalMatchScore,
    writeStrategicNormalMatchScore,
} from '../../../shared/utils/strategicNormalMmr.js';
import { STRATEGIC_NORMAL_STAT_KEY, STRATEGIC_RANKED_STAT_KEY } from '../../../shared/constants/userRankedStats.js';

describe('strategicNormalMmr', () => {
    it('seeds matchScore from ranked score when missing', () => {
        const stats = {
            [STRATEGIC_RANKED_STAT_KEY]: { rankingScore: 1500 },
        };
        expect(readStrategicNormalMatchScore(stats)).toBe(1500);
        const block = ensureStrategicNormalStatBlock(stats);
        expect(block.matchScore).toBe(1500);
    });

    it('prefers stored matchScore over ranked', () => {
        const stats = {
            [STRATEGIC_RANKED_STAT_KEY]: { rankingScore: 1500 },
            [STRATEGIC_NORMAL_STAT_KEY]: { matchScore: 1320 },
        };
        expect(readStrategicNormalMatchScore(stats)).toBe(1320);
    });

    it('applies elo-like delta without touching ranked score', () => {
        const next = applyNormalMatchScoreDelta(1200, 1200, true);
        expect(next).toBeGreaterThan(1200);
        const stats: Record<string, unknown> = {
            [STRATEGIC_RANKED_STAT_KEY]: { rankingScore: 1800 },
        };
        writeStrategicNormalMatchScore(stats, next);
        expect((stats[STRATEGIC_RANKED_STAT_KEY] as { rankingScore: number }).rankingScore).toBe(1800);
        expect((stats[STRATEGIC_NORMAL_STAT_KEY] as { matchScore: number }).matchScore).toBe(next);
    });
});
