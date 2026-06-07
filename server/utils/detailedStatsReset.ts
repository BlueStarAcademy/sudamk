import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, RANKED_ELO_BASE_SCORE } from '../../constants/index.js';
import {
    STRATEGIC_RANKED_STAT_KEY,
    STRATEGIC_RANKED_MATCH_RECORD_KEY,
} from '../../shared/constants/userRankedStats.js';
import type { DetailedStatResetScope } from '../../shared/types/detailedStatReset.js';
import {
    getModeStatAiTotal,
    getModeStatPvpTotal,
    hasPlayfulCategoryStatsToReset,
    hasSingleModeStatsToReset,
    hasStrategicCategoryStatsToReset,
} from '../../shared/utils/detailedStatResetChecks.js';
import type { User } from '../../types/index.js';
import { GameMode } from '../../types/enums.js';

type ModeStatRow = {
    wins?: number;
    losses?: number;
    aiWins?: number;
    aiLosses?: number;
    rankingScore?: number;
};

export const DETAILED_STAT_SINGLE_RESET_COST = 300;
export const DETAILED_STAT_CATEGORY_RESET_COST = 500;

export {
    hasPlayfulCategoryStatsToReset,
    hasSingleModeStatsToReset,
    hasStrategicCategoryStatsToReset,
    getModeStatPvpTotal,
    getModeStatAiTotal,
} from '../../shared/utils/detailedStatResetChecks.js';

export function isDetailedStatsResetMode(mode: GameMode): boolean {
    return (
        SPECIAL_GAME_MODES.some((entry) => entry.mode === mode) ||
        PLAYFUL_GAME_MODES.some((entry) => entry.mode === mode)
    );
}

function applyModeStatScopeReset(stats: Record<string, ModeStatRow>, mode: string, scope: DetailedStatResetScope): void {
    const prev = stats[mode] ?? {};
    const next: ModeStatRow = { ...prev };
    if (scope === 'pvp' || scope === 'both') {
        next.wins = 0;
        next.losses = 0;
    }
    if (scope === 'ai' || scope === 'both') {
        next.aiWins = 0;
        next.aiLosses = 0;
    }
    stats[mode] = next;
}

function resetStrategicSeasonRanking(user: User, now: number): void {
    const stats = user.stats as Record<string, ModeStatRow>;
    stats[STRATEGIC_RANKED_MATCH_RECORD_KEY] = { wins: 0, losses: 0 };
    stats[STRATEGIC_RANKED_STAT_KEY] = { rankingScore: RANKED_ELO_BASE_SCORE };

    if (!user.cumulativeRankingScore) user.cumulativeRankingScore = {};
    user.cumulativeRankingScore.standard = 0;

    if (!user.dailyRankings) user.dailyRankings = {};
    user.dailyRankings.strategic = { rank: 0, score: 0, lastUpdated: now };
}

export function resetSingleModeStat(user: User, mode: GameMode, scope: DetailedStatResetScope): void {
    if (!user.stats) user.stats = {};
    applyModeStatScopeReset(user.stats as Record<string, ModeStatRow>, String(mode), scope);
}

export function resetStrategicCategoryStats(user: User, now: number, scope: DetailedStatResetScope): void {
    if (!user.stats) user.stats = {};
    const stats = user.stats as Record<string, ModeStatRow>;

    for (const { mode } of SPECIAL_GAME_MODES) {
        applyModeStatScopeReset(stats, String(mode), scope);
    }

    if (scope === 'pvp' || scope === 'both') {
        resetStrategicSeasonRanking(user, now);
    }
}

export function resetPlayfulCategoryStats(user: User, scope: DetailedStatResetScope): void {
    if (!user.stats) user.stats = {};
    const stats = user.stats as Record<string, ModeStatRow>;

    for (const { mode } of PLAYFUL_GAME_MODES) {
        applyModeStatScopeReset(stats, String(mode), scope);
    }
}
