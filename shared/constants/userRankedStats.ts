/** 전략바둑(1인) 랭킹전 통합 점수·전적 (모드별 rankingScore 없음) */
export const STRATEGIC_RANKED_STAT_KEY = 'strategicRanked';

/** 페어(2인 팀) 랭킹전 — 기존 `stats.pair`와 동일 키 */
export const PAIR_RANKED_STAT_KEY = 'pair';

export type RankedStatBlock = {
    wins: number;
    losses: number;
    rankingScore: number;
};
