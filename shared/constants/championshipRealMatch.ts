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
        opening: { from: 1, to: 50 },
        midgame: { from: 51, to: 100 },
        endgame: { from: 101, to: 150 },
    },
    maxPly: 150,
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

export const CHAMPIONSHIP_ABILITY_KATA_LADDER: readonly ChampionshipAbilityKataLadderRow[] = [
    { minAbilityScore: 1300, kataLevel: 7 },
    { minAbilityScore: 1270, kataLevel: 6 },
    { minAbilityScore: 1240, kataLevel: 5 },
    { minAbilityScore: 1210, kataLevel: 4 },
    { minAbilityScore: 1180, kataLevel: 3 },
    { minAbilityScore: 1150, kataLevel: 2 },
    { minAbilityScore: 1120, kataLevel: 1 },
    { minAbilityScore: 1090, kataLevel: -1 },
    { minAbilityScore: 1060, kataLevel: -2 },
    { minAbilityScore: 1030, kataLevel: -3 },
    { minAbilityScore: 1000, kataLevel: -4 },
    { minAbilityScore: 970, kataLevel: -5 },
    { minAbilityScore: 940, kataLevel: -6 },
    { minAbilityScore: 910, kataLevel: -7 },
    { minAbilityScore: 880, kataLevel: -8 },
    { minAbilityScore: 850, kataLevel: -9 },
    { minAbilityScore: 820, kataLevel: -10 },
    { minAbilityScore: 790, kataLevel: -11 },
    { minAbilityScore: 760, kataLevel: -12 },
    { minAbilityScore: 730, kataLevel: -13 },
    { minAbilityScore: 700, kataLevel: -14 },
    { minAbilityScore: 670, kataLevel: -15 },
    { minAbilityScore: 640, kataLevel: -16 },
    { minAbilityScore: 610, kataLevel: -17 },
    { minAbilityScore: 580, kataLevel: -18 },
    { minAbilityScore: 550, kataLevel: -19 },
    { minAbilityScore: 520, kataLevel: -20 },
    { minAbilityScore: 490, kataLevel: -21 },
    { minAbilityScore: 460, kataLevel: -22 },
    { minAbilityScore: 430, kataLevel: -23 },
    { minAbilityScore: 400, kataLevel: -24 },
    { minAbilityScore: 370, kataLevel: -25 },
    { minAbilityScore: 340, kataLevel: -26 },
    { minAbilityScore: 310, kataLevel: -27 },
    { minAbilityScore: 280, kataLevel: -28 },
    { minAbilityScore: 250, kataLevel: -29 },
    { minAbilityScore: 220, kataLevel: -30 },
] as const;

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

export function championshipKataLevelFromAbilityScore(score: number): number {
    const rounded = Math.round(Number(score) || 0);
    for (const row of CHAMPIONSHIP_ABILITY_KATA_LADDER) {
        if (rounded >= row.minAbilityScore) return row.kataLevel;
    }
    return -30;
}

export function championshipKataLevelForPly(
    totalPly: number,
    stats: Partial<Record<CoreStat, number>>,
    rules: ChampionshipRealMatchRules = DEFAULT_CHAMPIONSHIP_REAL_MATCH_RULES,
): { phase: ChampionshipKataPhase; abilityScore: number; kataLevel: number } {
    const phase = championshipKataPhaseFromPly(totalPly, rules);
    const abilityScore = championshipKataAbilityScore(phase, stats);
    return {
        phase,
        abilityScore,
        kataLevel: championshipKataLevelFromAbilityScore(abilityScore),
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
