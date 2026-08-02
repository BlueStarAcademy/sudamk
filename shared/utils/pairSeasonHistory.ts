import { RANKING_TIERS, getSeasonalRankingTierName } from '../constants/ranking.js';
import { RANKED_ELO_BASE_SCORE } from '../constants/rules.js';
import { readPairRankedBlock } from './unifiedRankedStatsMigration.js';

/** 페어 시즌 랭킹 보드 자격 — `rankingCache.calculatePairSeasonRanking` 과 동일 */
export const PAIR_SEASON_RANKING_MIN_GAMES = 5;

/** `seasonHistory[*].pair`에 쓰는 미참여 표기(서버 저장값) */
export const PAIR_SEASON_HISTORY_NOT_PARTICIPATED = '미참여';

export type PairSeasonHistorySlice = Partial<Record<string, string>> | null | undefined;

export type PairSeasonRankRow = {
    userId: string;
    score: number;
    rank: number;
    wins: number;
    losses: number;
    totalGames: number;
};

type PairSeasonUserLike = {
    id?: string | null;
    stats?: Parameters<typeof readPairRankedBlock>[0];
    dailyRankings?: { pair?: { score?: number } | null } | null;
};

/** `seasonHistory[시즌].pair` 문자열 기준 역대 최고 티어 + 시즌명 */
export function computePairArenaAllTimeBestSeasonRecord(
    seasonHistory: Record<string, PairSeasonHistorySlice> | null | undefined,
): { tierName: string; seasonName: string } | null {
    if (!seasonHistory || typeof seasonHistory !== 'object') return null;
    const tierOrder = RANKING_TIERS.map((t) => t.name);
    let best: { tierName: string; seasonName: string; idx: number } | null = null;
    for (const seasonName of Object.keys(seasonHistory)) {
        const hist = seasonHistory[seasonName];
        const stored =
            hist && typeof hist === 'object' && typeof (hist as Record<string, unknown>).pair === 'string'
                ? ((hist as Record<string, unknown>).pair as string)
                : undefined;
        if (!stored || stored === PAIR_SEASON_HISTORY_NOT_PARTICIPATED || !tierOrder.includes(stored)) {
            continue;
        }
        const idx = tierOrder.indexOf(stored);
        const next = { tierName: stored, seasonName, idx };
        if (!best || idx < best.idx || (idx === best.idx && seasonName > best.seasonName)) {
            best = next;
        }
    }
    return best ? { tierName: best.tierName, seasonName: best.seasonName } : null;
}

/**
 * 페어 시즌 랭킹 행(≥5판) — `rankingCache.calculatePairSeasonRanking` 과 동일 점수·자격.
 */
export function buildPairSeasonRankingRows(users: PairSeasonUserLike[]): PairSeasonRankRow[] {
    const rankings: Omit<PairSeasonRankRow, 'rank'>[] = [];
    for (const user of users) {
        if (!user?.id) continue;
        const blk = readPairRankedBlock(user.stats);
        const wins = blk.wins;
        const losses = blk.losses;
        const totalGames = wins + losses;
        if (totalGames < PAIR_SEASON_RANKING_MIN_GAMES) continue;
        const dr = user.dailyRankings?.pair;
        const score =
            dr && typeof dr.score === 'number' && Number.isFinite(dr.score)
                ? RANKED_ELO_BASE_SCORE + dr.score
                : blk.rankingScore;
        rankings.push({ userId: user.id, score, wins, losses, totalGames });
    }
    rankings.sort((a, b) => b.score - a.score);
    return rankings.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/** 시즌 롤오버용 — `seasonHistory[season].pair`에 티어명 또는 미참여 기록 */
export function assignPairSeasonHistoryTier(
    seasonSlice: Record<string, string>,
    row: PairSeasonRankRow | undefined,
): void {
    if (!row) {
        seasonSlice.pair = PAIR_SEASON_HISTORY_NOT_PARTICIPATED;
        return;
    }
    seasonSlice.pair = getSeasonalRankingTierName(row.score, row.rank, row.totalGames);
}
