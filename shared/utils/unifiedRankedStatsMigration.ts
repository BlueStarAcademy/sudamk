import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants/gameModes.js';
import { RANKED_ELO_BASE_SCORE } from '../constants/rules.js';
import {
    STRATEGIC_RANKED_STAT_KEY,
    PAIR_RANKED_STAT_KEY,
    STRATEGIC_RANKED_MATCH_RECORD_KEY,
    PAIR_RANKED_MATCH_RECORD_KEY,
    PAIR_ARENA_AI_MATCH_RECORD_KEY,
    type RankedStatBlock,
    type RankedPvpMatchRecord,
} from '../constants/userRankedStats.js';

export type StatsMap = Record<
    string,
    { wins?: number; losses?: number; rankingScore?: number; aiWins?: number; aiLosses?: number }
>;

/** DB/클라이언트 `user.stats`는 느슨한 JSON — `Record<string, unknown>` 호출부와 호환 */
export type StatsMapInput = StatsMap | Record<string, unknown> | undefined | null;

function toStatsMap(stats: StatsMapInput): StatsMap | undefined {
    if (stats == null || typeof stats !== 'object' || Array.isArray(stats)) return undefined;
    return stats as StatsMap;
}

function statsObjectHasOwnKey(stats: StatsMap | undefined, key: string): boolean {
    return Boolean(stats && Object.prototype.hasOwnProperty.call(stats, key));
}

function avg(nums: number[]): number {
    if (nums.length === 0) return RANKED_ELO_BASE_SCORE;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/**
 * 랭킹전 전적만.
 * `strategicRankedMatchRecord` 키가 있으면 그 행만 사용(초기화·신규 스키마) — `strategicRanked`에 남은 레거시 wins는 무시.
 */
export function readStrategicRankedMatchRecord(stats: StatsMapInput): RankedPvpMatchRecord {
    const sm = toStatsMap(stats);
    if (statsObjectHasOwnKey(sm, STRATEGIC_RANKED_MATCH_RECORD_KEY)) {
        const rec = sm![STRATEGIC_RANKED_MATCH_RECORD_KEY]!;
        return {
            wins: typeof rec.wins === 'number' && Number.isFinite(rec.wins) ? Math.max(0, rec.wins) : 0,
            losses: typeof rec.losses === 'number' && Number.isFinite(rec.losses) ? Math.max(0, rec.losses) : 0,
        };
    }
    const legacy = sm?.[STRATEGIC_RANKED_STAT_KEY];
    const wins = typeof legacy?.wins === 'number' && Number.isFinite(legacy.wins) ? legacy.wins : 0;
    const losses = typeof legacy?.losses === 'number' && Number.isFinite(legacy.losses) ? legacy.losses : 0;
    return { wins: Math.max(0, wins), losses: Math.max(0, losses) };
}

/** `pairRankedMatchRecord`가 있으면 그 행만 사용 — `pair`에 남은 레거시 wins는 무시 */
export function readPairRankedMatchRecord(stats: StatsMapInput): RankedPvpMatchRecord {
    const sm = toStatsMap(stats);
    if (statsObjectHasOwnKey(sm, PAIR_RANKED_MATCH_RECORD_KEY)) {
        const rec = sm![PAIR_RANKED_MATCH_RECORD_KEY]!;
        return {
            wins: typeof rec.wins === 'number' && Number.isFinite(rec.wins) ? Math.max(0, rec.wins) : 0,
            losses: typeof rec.losses === 'number' && Number.isFinite(rec.losses) ? Math.max(0, rec.losses) : 0,
        };
    }
    const legacy = sm?.[PAIR_RANKED_STAT_KEY];
    const wins = typeof legacy?.wins === 'number' && Number.isFinite(legacy.wins) ? legacy.wins : 0;
    const losses = typeof legacy?.losses === 'number' && Number.isFinite(legacy.losses) ? legacy.losses : 0;
    return { wins: Math.max(0, wins), losses: Math.max(0, losses) };
}

/** 페어 경기장 펫 AI 대전 전적 — `pairArenaAiMatchRecord`만 사용 */
export function readPairArenaAiMatchRecord(stats: StatsMapInput): RankedPvpMatchRecord {
    const sm = toStatsMap(stats);
    if (statsObjectHasOwnKey(sm, PAIR_ARENA_AI_MATCH_RECORD_KEY)) {
        const rec = sm![PAIR_ARENA_AI_MATCH_RECORD_KEY]!;
        return {
            wins: typeof rec.wins === 'number' && Number.isFinite(rec.wins) ? Math.max(0, rec.wins) : 0,
            losses: typeof rec.losses === 'number' && Number.isFinite(rec.losses) ? Math.max(0, rec.losses) : 0,
        };
    }
    return { wins: 0, losses: 0 };
}

/**
 * 기존 stats(모드별 rankingScore) → 통합 strategicRanked + pair 유지.
 * 모드 행에서는 rankingScore 제거(또는 undefined).
 * idempotent-ish: 이미 strategicRanked가 있으면 모드별 점수만 정리.
 */
export function migrateUserStatsToUnifiedRanked(stats: StatsMapInput): StatsMap {
    const sm = toStatsMap(stats);
    if (!sm) return {};
    const next: StatsMap = { ...sm };

    const strategicScores: number[] = [];
    for (const m of SPECIAL_GAME_MODES) {
        const row = next[m.mode];
        if (row && typeof row.rankingScore === 'number' && Number.isFinite(row.rankingScore)) {
            strategicScores.push(row.rankingScore);
        }
    }
    const mergedStrategicScore =
        typeof next[STRATEGIC_RANKED_STAT_KEY]?.rankingScore === 'number' &&
        Number.isFinite(next[STRATEGIC_RANKED_STAT_KEY]!.rankingScore)
            ? next[STRATEGIC_RANKED_STAT_KEY]!.rankingScore
            : avg(strategicScores.length ? strategicScores : [RANKED_ELO_BASE_SCORE]);

    const existingS = next[STRATEGIC_RANKED_STAT_KEY];
    const existingMr = next[STRATEGIC_RANKED_MATCH_RECORD_KEY];
    next[STRATEGIC_RANKED_MATCH_RECORD_KEY] = {
        wins: existingMr?.wins ?? existingS?.wins ?? 0,
        losses: existingMr?.losses ?? existingS?.losses ?? 0,
    };
    next[STRATEGIC_RANKED_STAT_KEY] = {
        rankingScore: mergedStrategicScore,
    };

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
    const pairMr = next[PAIR_RANKED_MATCH_RECORD_KEY];
    next[PAIR_RANKED_MATCH_RECORD_KEY] = {
        wins: pairMr?.wins ?? pairRow?.wins ?? 0,
        losses: pairMr?.losses ?? pairRow?.losses ?? 0,
    };
    next[PAIR_RANKED_STAT_KEY] = {
        rankingScore:
            typeof pairRow?.rankingScore === 'number' && Number.isFinite(pairRow.rankingScore)
                ? pairRow.rankingScore
                : RANKED_ELO_BASE_SCORE,
    };

    return next;
}

export function readStrategicRankedBlock(stats: StatsMapInput): RankedStatBlock {
    const sm = toStatsMap(stats);
    const row = sm?.[STRATEGIC_RANKED_STAT_KEY];
    const rec = readStrategicRankedMatchRecord(sm);
    return {
        wins: rec.wins,
        losses: rec.losses,
        rankingScore:
            typeof row?.rankingScore === 'number' && Number.isFinite(row.rankingScore)
                ? row.rankingScore
                : RANKED_ELO_BASE_SCORE,
    };
}

export function readPairRankedBlock(stats: StatsMapInput): RankedStatBlock {
    const sm = toStatsMap(stats);
    const row = sm?.[PAIR_RANKED_STAT_KEY];
    const rec = readPairRankedMatchRecord(sm);
    return {
        wins: rec.wins,
        losses: rec.losses,
        rankingScore:
            typeof row?.rankingScore === 'number' && Number.isFinite(row.rankingScore)
                ? row.rankingScore
                : RANKED_ELO_BASE_SCORE,
    };
}
