import { RANKED_ELO_BASE_SCORE } from '../constants/rules.js';
import {
    STRATEGIC_NORMAL_STAT_KEY,
    type StrategicNormalStatBlock,
} from '../constants/userRankedStats.js';
import { readStrategicRankedBlock } from './unifiedRankedStatsMigration.js';

type StatsBag = Record<string, { rankingScore?: number; matchScore?: number } | undefined> | null | undefined;

/** 일반전 매칭용 matchScore. 없으면 랭크 점수(또는 베이스)로 시드. */
export function readStrategicNormalMatchScore(stats: StatsBag): number {
    const raw = stats?.[STRATEGIC_NORMAL_STAT_KEY]?.matchScore;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    const ranked = readStrategicRankedBlock(stats as Record<string, { rankingScore?: number }>);
    const seed =
        typeof ranked.rankingScore === 'number' && Number.isFinite(ranked.rankingScore)
            ? ranked.rankingScore
            : RANKED_ELO_BASE_SCORE;
    return seed;
}

/** stats에 matchScore가 없을 때 시드 블록 생성(저장용). */
export function ensureStrategicNormalStatBlock(stats: StatsBag): StrategicNormalStatBlock {
    const raw = stats?.[STRATEGIC_NORMAL_STAT_KEY]?.matchScore;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return { matchScore: raw };
    }
    return { matchScore: readStrategicNormalMatchScore(stats) };
}

export function writeStrategicNormalMatchScore(
    stats: Record<string, unknown>,
    matchScore: number,
): void {
    const next = Math.round(matchScore);
    stats[STRATEGIC_NORMAL_STAT_KEY] = { matchScore: next };
}

/** Elo 기대승률 기반 가감 (K=32, 랭크와 동일 계열). */
export function applyNormalMatchScoreDelta(
    myScore: number,
    opponentScore: number,
    won: boolean,
    k = 32,
): number {
    const expected = 1 / (1 + Math.pow(10, (opponentScore - myScore) / 400));
    const actual = won ? 1 : 0;
    return Math.round(myScore + k * (actual - expected));
}

export function getStrategicRankedScoreForSeed(stats: StatsBag): number {
    const ranked = readStrategicRankedBlock(stats as Record<string, { rankingScore?: number }>);
    if (typeof ranked.rankingScore === 'number' && Number.isFinite(ranked.rankingScore)) {
        return ranked.rankingScore;
    }
    return RANKED_ELO_BASE_SCORE;
}