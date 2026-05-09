import { CoreStat } from '../types/enums.js';

export type ChampionshipKataPhase = 'opening' | 'midgame' | 'endgame';

export type ChampionshipCoreStatsSix = Record<CoreStat, number>;

export type ChampionshipRealMatchRules = {
    boardSize: 19 | 13;
    phasePly: Record<ChampionshipKataPhase, { from: number; to: number }>;
    maxPly: number;
};

export const CHAMPIONSHIP_REAL_MATCH_RULES_19: ChampionshipRealMatchRules = {
    boardSize: 19,
    phasePly: {
        opening: { from: 1, to: 60 },
        midgame: { from: 61, to: 120 },
        endgame: { from: 121, to: 180 },
    },
    maxPly: 180,
};

export const CHAMPIONSHIP_REAL_MATCH_RULES_13: ChampionshipRealMatchRules = {
    boardSize: 13,
    phasePly: {
        opening: { from: 1, to: 30 },
        midgame: { from: 31, to: 60 },
        endgame: { from: 61, to: 90 },
    },
    maxPly: 90,
};

export const DEFAULT_CHAMPIONSHIP_REAL_MATCH_RULES = CHAMPIONSHIP_REAL_MATCH_RULES_19;

export const CHAMPIONSHIP_KATA_PHASE_WEIGHTS: Record<ChampionshipKataPhase, ChampionshipCoreStatsSix> = {
    opening: {
        [CoreStat.Concentration]: 0.2,
        [CoreStat.ThinkingSpeed]: 0.2,
        [CoreStat.Judgment]: 0.2,
        [CoreStat.Calculation]: 0.2,
        [CoreStat.CombatPower]: 0.3,
        [CoreStat.Stability]: 0.3,
    },
    midgame: {
        [CoreStat.Concentration]: 0.4,
        [CoreStat.ThinkingSpeed]: 0.4,
        [CoreStat.Judgment]: 0.5,
        [CoreStat.Calculation]: 0.3,
        [CoreStat.CombatPower]: 0.6,
        [CoreStat.Stability]: 0.3,
    },
    endgame: {
        [CoreStat.Concentration]: 0.4,
        [CoreStat.ThinkingSpeed]: 0.4,
        [CoreStat.Judgment]: 0.3,
        [CoreStat.Calculation]: 0.5,
        [CoreStat.CombatPower]: 0.1,
        [CoreStat.Stability]: 0.4,
    },
};

export type ChampionshipAbilityKataLadderRow = { minAbilityScore: number; kataLevel: number };

/** 능력치 가중 점수가 `minAbilityScore` 이상이면 해당 `kataLevel`을 쓴다. 높은 임계값부터 나열한다. */
export const CHAMPIONSHIP_ABILITY_KATA_LADDER: readonly ChampionshipAbilityKataLadderRow[] = [
    { minAbilityScore: 1600, kataLevel: 9 },
    { minAbilityScore: 1490, kataLevel: 8 },
    { minAbilityScore: 1400, kataLevel: 7 },
    { minAbilityScore: 1320, kataLevel: 6 },
    { minAbilityScore: 1250, kataLevel: 5 },
    { minAbilityScore: 1180, kataLevel: 4 },
    { minAbilityScore: 1120, kataLevel: 3 },
    { minAbilityScore: 1070, kataLevel: 2 },
    { minAbilityScore: 1020, kataLevel: 1 },
    { minAbilityScore: 970, kataLevel: -1 },
    { minAbilityScore: 930, kataLevel: -2 },
    { minAbilityScore: 890, kataLevel: -3 },
    { minAbilityScore: 850, kataLevel: -4 },
    { minAbilityScore: 815, kataLevel: -5 },
    { minAbilityScore: 780, kataLevel: -6 },
    { minAbilityScore: 745, kataLevel: -7 },
    { minAbilityScore: 710, kataLevel: -8 },
    { minAbilityScore: 675, kataLevel: -9 },
    { minAbilityScore: 640, kataLevel: -10 },
    { minAbilityScore: 605, kataLevel: -11 },
    { minAbilityScore: 570, kataLevel: -12 },
    { minAbilityScore: 535, kataLevel: -13 },
    { minAbilityScore: 500, kataLevel: -14 },
    { minAbilityScore: 470, kataLevel: -15 },
    { minAbilityScore: 440, kataLevel: -16 },
    { minAbilityScore: 410, kataLevel: -17 },
    { minAbilityScore: 380, kataLevel: -18 },
    { minAbilityScore: 360, kataLevel: -19 },
    { minAbilityScore: 340, kataLevel: -20 },
    { minAbilityScore: 320, kataLevel: -21 },
    { minAbilityScore: 300, kataLevel: -22 },
    { minAbilityScore: 280, kataLevel: -23 },
    { minAbilityScore: 265, kataLevel: -24 },
    { minAbilityScore: 250, kataLevel: -25 },
    { minAbilityScore: 240, kataLevel: -26 },
    { minAbilityScore: 230, kataLevel: -27 },
    { minAbilityScore: 220, kataLevel: -28 },
    { minAbilityScore: 210, kataLevel: -29 },
    { minAbilityScore: 200, kataLevel: -30 },
] as const;

export function normalizeChampionshipAbilityKataLadder(
    input: readonly { minAbilityScore: unknown; kataLevel: unknown }[],
): ChampionshipAbilityKataLadderRow[] {
    if (!Array.isArray(input) || input.length === 0) {
        throw new Error('사다리 행이 비어 있습니다.');
    }
    const rows: ChampionshipAbilityKataLadderRow[] = [];
    for (const raw of input) {
        const minAbilityScore = Math.round(Number(raw?.minAbilityScore));
        const kataLevel = Math.round(Number(raw?.kataLevel));
        if (!Number.isFinite(minAbilityScore) || !Number.isFinite(kataLevel)) {
            continue;
        }
        rows.push({ minAbilityScore, kataLevel });
    }
    if (rows.length === 0) {
        throw new Error('유효한 사다리 행이 없습니다.');
    }
    rows.sort((a, b) => b.minAbilityScore - a.minAbilityScore);
    for (let i = 1; i < rows.length; i++) {
        if (rows[i]!.minAbilityScore === rows[i - 1]!.minAbilityScore) {
            throw new Error(`중복된 최소 능력치 점수: ${rows[i]!.minAbilityScore}`);
        }
    }
    return rows;
}

export function championshipKataPhaseFromPly(
    totalPly: number,
    rules: ChampionshipRealMatchRules = DEFAULT_CHAMPIONSHIP_REAL_MATCH_RULES,
): ChampionshipKataPhase {
    const n = Math.max(1, Math.floor(totalPly));
    if (n <= rules.phasePly.opening.to) return 'opening';
    if (n <= rules.phasePly.midgame.to) return 'midgame';
    return 'endgame';
}

export function championshipKataAbilityScore(
    phase: ChampionshipKataPhase,
    stats: Partial<Record<CoreStat, number>>,
): number {
    const weights = CHAMPIONSHIP_KATA_PHASE_WEIGHTS[phase];
    const raw =
        (stats[CoreStat.Concentration] || 0) * weights[CoreStat.Concentration] +
        (stats[CoreStat.ThinkingSpeed] || 0) * weights[CoreStat.ThinkingSpeed] +
        (stats[CoreStat.Judgment] || 0) * weights[CoreStat.Judgment] +
        (stats[CoreStat.Calculation] || 0) * weights[CoreStat.Calculation] +
        (stats[CoreStat.CombatPower] || 0) * weights[CoreStat.CombatPower] +
        (stats[CoreStat.Stability] || 0) * weights[CoreStat.Stability];
    return Math.round(raw);
}

export function championshipKataLevelFromAbilityScore(
    score: number,
    ladder: readonly ChampionshipAbilityKataLadderRow[] = CHAMPIONSHIP_ABILITY_KATA_LADDER,
): number {
    const rounded = Math.round(Number(score) || 0);
    for (const row of ladder) {
        if (rounded >= row.minAbilityScore) return row.kataLevel;
    }
    return -30;
}

export function championshipKataLevelForPly(
    totalPly: number,
    stats: Partial<Record<CoreStat, number>>,
    rules: ChampionshipRealMatchRules = DEFAULT_CHAMPIONSHIP_REAL_MATCH_RULES,
    abilityKataLadder: readonly ChampionshipAbilityKataLadderRow[] = CHAMPIONSHIP_ABILITY_KATA_LADDER,
): { phase: ChampionshipKataPhase; abilityScore: number; kataLevel: number } {
    const phase = championshipKataPhaseFromPly(totalPly, rules);
    const abilityScore = championshipKataAbilityScore(phase, stats);
    return {
        phase,
        abilityScore,
        kataLevel: championshipKataLevelFromAbilityScore(abilityScore, abilityKataLadder),
    };
}

export function championshipMistakeChancePercent(stability: number, condition: number): number {
    return clampPercent(30 - (Number(stability) || 0) * 0.01 - (Number(condition) || 0) * 0.1);
}

export function championshipBestMoveChancePercent(phaseAbilityScore: number, condition: number): number {
    return clampPercent(20 + (Number(phaseAbilityScore) || 0) * 0.01 + (Number(condition) || 0) * 0.1);
}

function clampPercent(value: number): number {
    return Math.max(0, Math.min(100, value));
}
