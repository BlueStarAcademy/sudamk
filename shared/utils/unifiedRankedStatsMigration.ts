import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants/gameModes.js';
import { RANKED_ELO_BASE_SCORE } from '../constants/rules.js';
import { STRATEGIC_RANKED_STAT_KEY, PAIR_RANKED_STAT_KEY, type RankedStatBlock } from '../constants/userRankedStats.js';

type StatsMap = Record<string, { wins?: number; losses?: number; rankingScore?: number; aiWins?: number; aiLosses?: number }>;

function avg(nums: number[]): number {
    if (nums.length === 0) return RANKED_ELO_BASE_SCORE;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/**
 * 기존 stats(모드별 rankingScore) → 통합 strategicRanked + pair 유지.
 * 모드 행에서는 rankingScore 제거(또는 undefined).
 * idempotent-ish: 이미 strategicRanked가 있으면 모드별 점수만 정리.
 */
export function migrateUserStatsToUnifiedRanked(stats: StatsMap | undefined): StatsMap {
    if (!stats || typeof stats !== 'object') return {};
    const next: StatsMap = { ...stats };

    const strategicScores: number[] = [];
    for (const m of SPECIAL_GAME_MODES) {
        const row = next[m.mode];
        if (row && typeof row.rankingScore === 'number' && Number.isFinite(row.rankingScore)) {
            strategicScores.push(row.rankingScore);
        }
    }
    const mergedStrategicScore =
        typeof next[STRATEGIC_RANKED_STAT_KEY]?.rankingScore === 'number' && Number.isFinite(next[STRATEGIC_RANKED_STAT_KEY]!.rankingScore)
            ? next[STRATEGIC_RANKED_STAT_KEY]!.rankingScore
            : avg(strategicScores.length ? strategicScores : [RANKED_ELO_BASE_SCORE]);

    let sW = 0;
    let sL = 0;
    for (const m of SPECIAL_GAME_MODES) {
        const row = next[m.mode];
        if (row) {
            sW += row.wins ?? 0;
            sL += row.losses ?? 0;
        }
    }
    const existingS = next[STRATEGIC_RANKED_STAT_KEY];
    const strategicBlock: RankedStatBlock = {
        wins: existingS?.wins ?? sW,
        losses: existingS?.losses ?? sL,
        rankingScore: mergedStrategicScore,
    };
    next[STRATEGIC_RANKED_STAT_KEY] = strategicBlock;

    for (const m of SPECIAL_GAME_MODES) {
        const row = next[m.mode];
        if (!row) continue;
        const { rankingScore: _rs, ...rest } = row;
        next[m.mode] = { ...rest, wins: row.wins ?? 0, losses: row.losses ?? 0 };
    }

    for (const m of PLAYFUL_GAME_MODES) {
        const row = next[m.mode];
        if (!row) continue;
        const { rankingScore: _rs, ...rest } = row;
        next[m.mode] = { ...rest, wins: row.wins ?? 0, losses: row.losses ?? 0 };
    }

    const pairRow = next[PAIR_RANKED_STAT_KEY];
    if (pairRow) {
        next[PAIR_RANKED_STAT_KEY] = {
            wins: pairRow.wins ?? 0,
            losses: pairRow.losses ?? 0,
            rankingScore:
                typeof pairRow.rankingScore === 'number' && Number.isFinite(pairRow.rankingScore)
                    ? pairRow.rankingScore
                    : RANKED_ELO_BASE_SCORE,
        };
    } else {
        next[PAIR_RANKED_STAT_KEY] = { wins: 0, losses: 0, rankingScore: RANKED_ELO_BASE_SCORE };
    }

    return next;
}

export function readStrategicRankedBlock(stats: StatsMap | undefined): RankedStatBlock {
    const row = stats?.[STRATEGIC_RANKED_STAT_KEY];
    return {
        wins: row?.wins ?? 0,
        losses: row?.losses ?? 0,
        rankingScore:
            typeof row?.rankingScore === 'number' && Number.isFinite(row.rankingScore)
                ? row.rankingScore
                : RANKED_ELO_BASE_SCORE,
    };
}

export function readPairRankedBlock(stats: StatsMap | undefined): RankedStatBlock {
    const row = stats?.[PAIR_RANKED_STAT_KEY];
    return {
        wins: row?.wins ?? 0,
        losses: row?.losses ?? 0,
        rankingScore:
            typeof row?.rankingScore === 'number' && Number.isFinite(row.rankingScore)
                ? row.rankingScore
                : RANKED_ELO_BASE_SCORE,
    };
}
