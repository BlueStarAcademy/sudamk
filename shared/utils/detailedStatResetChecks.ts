import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, RANKED_ELO_BASE_SCORE } from '../../constants/index.js';
import {
    STRATEGIC_RANKED_STAT_KEY,
    STRATEGIC_RANKED_MATCH_RECORD_KEY,
    PAIR_RANKED_STAT_KEY,
    PAIR_RANKED_MATCH_RECORD_KEY,
    PAIR_ARENA_AI_MATCH_RECORD_KEY,
} from '../constants/userRankedStats.js';
import type { DetailedStatResetScope } from '../types/detailedStatReset.js';
import { GameMode } from '../../types/enums.js';

export const DETAILED_STAT_NO_RESET_MESSAGE = '초기화 할 전적이 없습니다.';

type ModeStatRow = {
    wins?: number;
    losses?: number;
    aiWins?: number;
    aiLosses?: number;
    rankingScore?: number;
};

export type DetailedStatResetUserSlice = {
    stats?: Record<string, ModeStatRow>;
    dailyRankings?: {
        strategic?: { score?: number };
        pair?: { score?: number };
    };
    pairArenaStatsByMode?: Record<string, { wins?: number; losses?: number }>;
};

export function getModeStatPvpTotal(row?: ModeStatRow | null): number {
    if (!row) return 0;
    return Math.max(0, row.wins ?? 0) + Math.max(0, row.losses ?? 0);
}

export function getModeStatAiTotal(row?: ModeStatRow | null): number {
    if (!row) return 0;
    return Math.max(0, row.aiWins ?? 0) + Math.max(0, row.aiLosses ?? 0);
}

export function getModeStatTotal(row?: ModeStatRow | null): number {
    return getModeStatPvpTotal(row) + getModeStatAiTotal(row);
}

export function hasSingleModeStatsToReset(
    user: DetailedStatResetUserSlice,
    mode: GameMode,
    scope: DetailedStatResetScope,
): boolean {
    const row = user.stats?.[mode] as ModeStatRow | undefined;
    if (scope === 'pvp') return getModeStatPvpTotal(row) > 0;
    if (scope === 'ai') return getModeStatAiTotal(row) > 0;
    return getModeStatTotal(row) > 0;
}

function hasStrategicModePvpToReset(user: DetailedStatResetUserSlice): boolean {
    for (const { mode } of SPECIAL_GAME_MODES) {
        if (getModeStatPvpTotal(user.stats?.[mode] as ModeStatRow | undefined) > 0) return true;
    }
    return false;
}

function hasStrategicModeAiToReset(user: DetailedStatResetUserSlice): boolean {
    for (const { mode } of SPECIAL_GAME_MODES) {
        if (getModeStatAiTotal(user.stats?.[mode] as ModeStatRow | undefined) > 0) return true;
    }
    return false;
}

function hasStrategicSeasonRankingToReset(user: DetailedStatResetUserSlice): boolean {
    const rankedRec = user.stats?.[STRATEGIC_RANKED_MATCH_RECORD_KEY] as ModeStatRow | undefined;
    if (getModeStatPvpTotal(rankedRec) > 0) return true;

    const rankedScore = user.stats?.[STRATEGIC_RANKED_STAT_KEY]?.rankingScore;
    if (typeof rankedScore === 'number' && rankedScore !== RANKED_ELO_BASE_SCORE) return true;

    const seasonDelta = user.dailyRankings?.strategic?.score;
    if (typeof seasonDelta === 'number' && seasonDelta !== 0) return true;

    return false;
}

export function hasStrategicCategoryStatsToReset(
    user: DetailedStatResetUserSlice,
    scope: DetailedStatResetScope,
): boolean {
    if (scope === 'pvp') {
        return hasStrategicModePvpToReset(user) || hasStrategicSeasonRankingToReset(user);
    }
    if (scope === 'ai') {
        return hasStrategicModeAiToReset(user);
    }
    return (
        hasStrategicModePvpToReset(user) ||
        hasStrategicModeAiToReset(user) ||
        hasStrategicSeasonRankingToReset(user)
    );
}

export function hasPlayfulCategoryStatsToReset(
    user: DetailedStatResetUserSlice,
    scope: DetailedStatResetScope,
): boolean {
    for (const { mode } of PLAYFUL_GAME_MODES) {
        const row = user.stats?.[mode] as ModeStatRow | undefined;
        if (scope === 'pvp' && getModeStatPvpTotal(row) > 0) return true;
        if (scope === 'ai' && getModeStatAiTotal(row) > 0) return true;
        if (scope === 'both' && getModeStatTotal(row) > 0) return true;
    }
    return false;
}

export function hasPairArenaSingleStatsToReset(user: DetailedStatResetUserSlice, mode: GameMode): boolean {
    const row = user.pairArenaStatsByMode?.[String(mode)];
    return getModeStatPvpTotal(row) > 0;
}

export function hasPairArenaCategoryStatsToReset(
    user: DetailedStatResetUserSlice,
    scope: DetailedStatResetScope,
): boolean {
    const pairModePvpTotal = Object.values(user.pairArenaStatsByMode ?? {}).reduce(
        (sum, row) => sum + getModeStatPvpTotal(row),
        0,
    );
    const pairRankedRec = user.stats?.[PAIR_RANKED_MATCH_RECORD_KEY] as ModeStatRow | undefined;
    const pairRankedPvpTotal = getModeStatPvpTotal(pairRankedRec);
    const pairAiRec = user.stats?.[PAIR_ARENA_AI_MATCH_RECORD_KEY] as ModeStatRow | undefined;
    const pairAiTotal = getModeStatPvpTotal(pairAiRec);
    const pairSeasonDelta = user.dailyRankings?.pair?.score;
    const hasPairSeasonToReset =
        typeof pairSeasonDelta === 'number' && pairSeasonDelta !== 0
            ? true
            : (user.stats?.[PAIR_RANKED_STAT_KEY]?.rankingScore ?? RANKED_ELO_BASE_SCORE) !== RANKED_ELO_BASE_SCORE;

    if (scope === 'pvp') {
        return pairModePvpTotal > 0 || pairRankedPvpTotal > 0 || hasPairSeasonToReset;
    }
    if (scope === 'ai') {
        return pairAiTotal > 0;
    }
    return pairModePvpTotal > 0 || pairRankedPvpTotal > 0 || pairAiTotal > 0 || hasPairSeasonToReset;
}
