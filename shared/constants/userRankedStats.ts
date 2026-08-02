/** 전략바둑(1인) 랭킹전 통합 레이팅 (`rankingScore`만 저장 — 승·패는 `strategicRankedMatchRecord`) */
export const STRATEGIC_RANKED_STAT_KEY = 'strategicRanked';

/**
 * 일반전 매칭 전용 숨은 MMR (`matchScore`).
 * 랭킹점수·티어와 분리 — 일반전 결과로만 갱신, 최초 시드는 rankingScore.
 */
export const STRATEGIC_NORMAL_STAT_KEY = 'strategicNormal';

/** 페어 랭킹 레이팅 (`rankingScore`만 — 승·패는 `pairRankedMatchRecord`) */
export const PAIR_RANKED_STAT_KEY = 'pair';

export type StrategicNormalStatBlock = {
    matchScore: number;
};

/** 전략바둑 랭킹전 전적(PvP 랭크 매치만) */
export const STRATEGIC_RANKED_MATCH_RECORD_KEY = 'strategicRankedMatchRecord';

/** 전략바둑 일반전 전적(일반 매칭 큐 PvP만) */
export const STRATEGIC_NORMAL_MATCH_RECORD_KEY = 'strategicNormalMatchRecord';

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
