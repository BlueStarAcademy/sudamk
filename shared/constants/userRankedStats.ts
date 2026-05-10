/** 전략바둑(1인) 랭킹전 통합 레이팅 (`rankingScore`만 저장 — 승·패는 `strategicRankedMatchRecord`) */
export const STRATEGIC_RANKED_STAT_KEY = 'strategicRanked';

/** 페어 랭킹 레이팅 (`rankingScore`만 — 승·패는 `pairRankedMatchRecord`) */
export const PAIR_RANKED_STAT_KEY = 'pair';

/** 전략바둑 랭킹전 전적(PvP 랭크 매치만) */
export const STRATEGIC_RANKED_MATCH_RECORD_KEY = 'strategicRankedMatchRecord';

/** 페어 랭킹전 전적(PvP 랭크 매치만) */
export const PAIR_RANKED_MATCH_RECORD_KEY = 'pairRankedMatchRecord';

/** 페어 경기장 펫 AI 대전 전적(pairMode === 'ai' 종료만) */
export const PAIR_ARENA_AI_MATCH_RECORD_KEY = 'pairArenaAiMatchRecord';

export type RankedPvpMatchRecord = {
    wins: number;
    losses: number;
};

/** UI·랭킹 캐시용: 레이팅 + 랭킹전 전적 */
export type RankedStatBlock = {
    wins: number;
    losses: number;
    rankingScore: number;
};
