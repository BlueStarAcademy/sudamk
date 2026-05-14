import type { ChampionshipVersusVenueKind, User } from '../types/entities.js';
import { getSeasonalRankingTierName } from '../constants/ranking.js';
import { readStrategicRankedBlock } from './unifiedRankedStatsMigration.js';
import { RANKED_ELO_BASE_SCORE } from '../constants/rules.js';
import { ensureChampionshipVersusRatingEntry, getChampionshipVersusDisplayRating } from './championshipVersusElo.js';
import type { ChampionshipRealMatchRules } from '../constants/championshipRealMatch.js';
import {
    CHAMPIONSHIP_REAL_MATCH_RULES_13,
    CHAMPIONSHIP_REAL_MATCH_RULES_19,
    CHAMPIONSHIP_REAL_MATCH_RULES_9,
} from '../constants/championshipRealMatch.js';

/** 챔피언십 대전장 매칭·보드 구간 (시즌 티어 이름 기준) */
export const CHAMPIONSHIP_VERSUS_TIER_BANDS: readonly (readonly string[])[] = [
    ['새싹', '루키', '브론즈'],
    ['실버', '골드'],
    ['플래티넘', '다이아'],
    ['마스터', '챌린저'],
] as const;

export function championshipVersusTierBandIndexForTierName(tierName: string): number {
    for (let i = 0; i < CHAMPIONSHIP_VERSUS_TIER_BANDS.length; i++) {
        if ((CHAMPIONSHIP_VERSUS_TIER_BANDS[i] as readonly string[]).includes(tierName)) return i;
    }
    return -1;
}

/** 장내 시즌 ELO·시즌 판수로 표시 티어 */
export function championshipVersusVenueTierName(
    user: User,
    venue: ChampionshipVersusVenueKind,
    now: number,
): string {
    ensureChampionshipVersusRatingEntry(user, venue, now);
    const e = user.championshipVersusVenueRatings![venue]!;
    const r = getChampionshipVersusDisplayRating(user, venue, now);
    const games = Math.max(0, (e.seasonWins ?? 0) + (e.seasonLosses ?? 0));
    return getSeasonalRankingTierName(r, 999_999, games);
}

/**
 * 전략바둑 시즌 티어(통합 랭킹 점수)에 따른 실제 대국 룰.
 * 랭킹 API가 없을 때도 `stats` 통합 전략 블록으로 티어를 맞춘다.
 */
export function championshipVersusBoardRulesForActorStrategicTier(user: User): ChampionshipRealMatchRules {
    const blk = readStrategicRankedBlock(user.stats as Record<string, { wins?: number; losses?: number; rankingScore?: number }>);
    const totalGames = blk.wins + blk.losses;
    const score = Number.isFinite(blk.rankingScore) ? blk.rankingScore : RANKED_ELO_BASE_SCORE;
    const tier = getSeasonalRankingTierName(score, 999_999, totalGames);
    if (tier === '새싹' || tier === '루키' || tier === '브론즈') return CHAMPIONSHIP_REAL_MATCH_RULES_9;
    if (tier === '실버' || tier === '골드') return CHAMPIONSHIP_REAL_MATCH_RULES_13;
    return CHAMPIONSHIP_REAL_MATCH_RULES_19;
}
