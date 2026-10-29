import { RANKED_ELO_BASE_SCORE } from '../constants/rules.js';
import {
    PAIR_NORMAL_STAT_KEY,
    type PairNormalStatBlock,
} from '../constants/userRankedStats.js';
import { readPairRankedBlock } from './unifiedRankedStatsMigration.js';
import { applyNormalMatchScoreDelta } from './strategicNormalMmr.js';

type StatsBag =
    | Record<string, { rankingScore?: number; matchScore?: number } | undefined>
    | Record<string, unknown>
    | null
    | undefined;

function readMatchScoreField(stats: StatsBag): number | undefined {
    const block = stats?.[PAIR_NORMAL_STAT_KEY] as { matchScore?: unknown } | undefined;
    const raw = block?.matchScore;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

/** 페어 일반전 매칭용 matchScore. 없으면 페어 랭크 점수(또는 베이스)로 시드. */
export function readPairNormalMatchScore(stats: StatsBag): number {
    const raw = readMatchScoreField(stats);
    if (raw != null) return raw;
    const ranked = readPairRankedBlock(stats as Record<string, { rankingScore?: number }>);
    const seed =
        typeof ranked.rankingScore === 'number' && Number.isFinite(ranked.rankingScore)
            ? ranked.rankingScore
            : RANKED_ELO_BASE_SCORE;
    return seed;
}

/** stats에 matchScore가 없을 때 시드 블록 생성(저장용). */
export function ensurePairNormalStatBlock(stats: StatsBag): PairNormalStatBlock {
    const raw = readMatchScoreField(stats);
    if (raw != null) {
        return { matchScore: raw };
    }
    return { matchScore: readPairNormalMatchScore(stats) };
}

export function writePairNormalMatchScore(stats: Record<string, unknown>, matchScore: number): void {
    const next = Math.round(matchScore);
    stats[PAIR_NORMAL_STAT_KEY] = { matchScore: next };
}

export { applyNormalMatchScoreDelta };
