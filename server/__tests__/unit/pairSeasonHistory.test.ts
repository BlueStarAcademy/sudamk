import { describe, it, expect } from 'vitest';
import {
    PAIR_SEASON_HISTORY_NOT_PARTICIPATED,
    PAIR_SEASON_RANKING_MIN_GAMES,
    assignPairSeasonHistoryTier,
    buildPairSeasonRankingRows,
    computePairArenaAllTimeBestSeasonRecord,
} from '../../../shared/utils/pairSeasonHistory.js';

describe('pairSeasonHistory', () => {
    it('builds season ranking only for users with ≥5 pair ranked games', () => {
        const rows = buildPairSeasonRankingRows([
            {
                id: 'a',
                stats: {
                    pair: { rankingScore: 1600 },
                    pairRankedMatchRecord: { wins: 3, losses: 1 },
                },
            },
            {
                id: 'b',
                stats: {
                    pair: { rankingScore: 1550 },
                    pairRankedMatchRecord: { wins: 4, losses: 2 },
                },
            },
            {
                id: 'c',
                stats: {
                    pair: { rankingScore: 1800 },
                    pairRankedMatchRecord: { wins: 10, losses: 0 },
                },
                dailyRankings: { pair: { score: 700 } },
            },
        ]);
        expect(rows.every((r) => r.totalGames >= PAIR_SEASON_RANKING_MIN_GAMES)).toBe(true);
        expect(rows.map((r) => r.userId)).toEqual(['c', 'b']);
        expect(rows[0]!.rank).toBe(1);
        expect(rows[0]!.score).toBe(1900);
    });

    it('assigns seasonHistory.pair tier or 미참여 on rollover', () => {
        const rows = buildPairSeasonRankingRows([
            {
                id: 'eligible',
                stats: {
                    pair: { rankingScore: 1600 },
                    pairRankedMatchRecord: { wins: 30, losses: 20 },
                },
            },
            {
                id: 'skip',
                stats: {
                    pair: { rankingScore: 2000 },
                    pairRankedMatchRecord: { wins: 1, losses: 0 },
                },
            },
        ]);
        const byId = new Map(rows.map((r) => [r.userId, r]));

        const eligibleSlice: Record<string, string> = {};
        assignPairSeasonHistoryTier(eligibleSlice, byId.get('eligible'));
        expect(eligibleSlice.pair).toBeTruthy();
        expect(eligibleSlice.pair).not.toBe(PAIR_SEASON_HISTORY_NOT_PARTICIPATED);

        const skipSlice: Record<string, string> = {};
        assignPairSeasonHistoryTier(skipSlice, byId.get('skip'));
        expect(skipSlice.pair).toBe(PAIR_SEASON_HISTORY_NOT_PARTICIPATED);
    });

    it('computes all-time best pair season from seasonHistory.pair', () => {
        const best = computePairArenaAllTimeBestSeasonRecord({
            '2024 봄': { pair: '골드' },
            '2024 여름': { pair: '다이아' },
            '2024 가을': { pair: PAIR_SEASON_HISTORY_NOT_PARTICIPATED },
            '2025 봄': { standard: '마스터' },
        });
        expect(best).toEqual({ tierName: '다이아', seasonName: '2024 여름' });
    });
});
