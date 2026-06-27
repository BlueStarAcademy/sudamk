import { CoreStat } from '../types/enums.js';

export type ChampionshipKataPhase = 'opening' | 'midgame' | 'endgame';

export type ChampionshipCoreStatsSix = Record<CoreStat, number>;

export type ChampionshipRealMatchRules = {
    boardSize: 9 | 13 | 19;
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

/** 챔피언십 던전 1~3단계: 9줄, 초·중·종 각 14수(총 42수, 흑·백 동수) */
export const CHAMPIONSHIP_REAL_MATCH_RULES_9: ChampionshipRealMatchRules = {
    boardSize: 9,
    phasePly: {
        opening: { from: 1, to: 14 },
        midgame: { from: 15, to: 28 },
        endgame: { from: 29, to: 42 },
    },
    maxPly: 42,
};

export const DEFAULT_CHAMPIONSHIP_REAL_MATCH_RULES = CHAMPIONSHIP_REAL_MATCH_RULES_19;

/**
 * 인게임 챔피언십 던전 단계별 판 크기·수 구간.
 * 1~3단계: 9줄(14+14+14수), 4~5단계: 13줄(30+30+30), 6단계 이상: 19줄(기존 60+60+60).
 */
export function resolveChampionshipDungeonRulesFromStage(stage: number): ChampionshipRealMatchRules {
    const s = Math.floor(Number(stage));
    if (!Number.isFinite(s) || s < 1) return DEFAULT_CHAMPIONSHIP_REAL_MATCH_RULES;
    if (s <= 3) return CHAMPIONSHIP_REAL_MATCH_RULES_9;
    if (s <= 5) return CHAMPIONSHIP_REAL_MATCH_RULES_13;
    return CHAMPIONSHIP_REAL_MATCH_RULES_19;
}

/** 챔피언십 실대국 중계 UI 배속 — 던전 단계별로 허용 버튼만 노출 */
export type ChampionshipPlaybackSpeedChoice = 0.5 | 1 | 2 | 3;

/** 1~5단계: x0.5·x1·x2, 6단계 이상·비던전: x3까지 */
export function resolveChampionshipDungeonPlaybackSpeedChoices(
    stage: number,
): readonly ChampionshipPlaybackSpeedChoice[] {
    const s = Math.floor(Number(stage));
    if (!Number.isFinite(s) || s < 1) return [0.5, 1, 2, 3];
    if (s <= 5) return [0.5, 1, 2];
    return [0.5, 1, 2, 3];
}

/** 장내 챔피언십(대국) 배속 — 9줄: x0.5·x1·x2, 13줄: x3 제외, 19줄: x3 추가 */
export function resolveChampionshipVersusPlaybackSpeedChoices(
    boardSize: number,
): readonly ChampionshipPlaybackSpeedChoice[] {
    const b = Math.floor(Number(boardSize));
    if (b === 9) return [0.5, 1, 2];
    if (b === 13) return [0.5, 1, 2];
    if (b === 19) return [0.5, 1, 2, 3];
    if (b > 0 && b < 9) return [0.5, 1, 2];
    if (b > 9 && b < 13) return [0.5, 1, 2];
    if (b > 13 && b < 19) return [0.5, 1, 2];
    return [0.5, 1, 2, 3];
}

/** 포석·중원·끝내기 구간별 능력치 가중합 (집중력·사고속도·판단력·계산력·전투력·안정감) */
export const CHAMPIONSHIP_KATA_PHASE_WEIGHTS: Record<ChampionshipKataPhase, ChampionshipCoreStatsSix> = {
    opening: {
        [CoreStat.Concentration]: 0.4,
        [CoreStat.ThinkingSpeed]: 0.3,
        [CoreStat.Judgment]: 0.4,
        [CoreStat.Calculation]: 0.3,
        [CoreStat.CombatPower]: 0.1,
        [CoreStat.Stability]: 0.5,
    },
    midgame: {
        [CoreStat.Concentration]: 0.3,
        [CoreStat.ThinkingSpeed]: 0.3,
        [CoreStat.Judgment]: 0.4,
        [CoreStat.Calculation]: 0.1,
        [CoreStat.CombatPower]: 0.8,
        [CoreStat.Stability]: 0.1,
    },
    endgame: {
        [CoreStat.Concentration]: 0.3,
        [CoreStat.ThinkingSpeed]: 0.4,
        [CoreStat.Judgment]: 0.1,
        [CoreStat.Calculation]: 0.6,
        [CoreStat.CombatPower]: 0.1,
        [CoreStat.Stability]: 0.5,
    },
};

/**
 * 시간 기반 시뮬레이션(초반 1–15초 / 중반 16–35초 / 종반 36–50초)의 페이즈 능력치 — 위 카타 opening/midgame/endgame과 동일 계수.
 */
export const CHAMPIONSHIP_SIMULATION_PHASE_STAT_WEIGHTS: Record<'early' | 'mid' | 'end', ChampionshipCoreStatsSix> = {
    early: CHAMPIONSHIP_KATA_PHASE_WEIGHTS.opening,
    mid: CHAMPIONSHIP_KATA_PHASE_WEIGHTS.midgame,
    end: CHAMPIONSHIP_KATA_PHASE_WEIGHTS.endgame,
};

export type ChampionshipAbilityKataLadderRow = { minAbilityScore: number; kataLevel: number };

/** 능력치 가중 점수가 `minAbilityScore` 이상이면 해당 `kataLevel`을 쓴다. 높은 임계값부터 나열한다. */
export const CHAMPIONSHIP_ABILITY_KATA_LADDER: readonly ChampionshipAbilityKataLadderRow[] = [
    { minAbilityScore: 1350, kataLevel: 9 },
    { minAbilityScore: 1300, kataLevel: 8 },
    { minAbilityScore: 1250, kataLevel: 7 },
    { minAbilityScore: 1200, kataLevel: 6 },
    { minAbilityScore: 1150, kataLevel: 5 },
    { minAbilityScore: 1100, kataLevel: 4 },
    { minAbilityScore: 1060, kataLevel: 3 },
    { minAbilityScore: 1020, kataLevel: 2 },
    { minAbilityScore: 980, kataLevel: 1 },
    { minAbilityScore: 940, kataLevel: -1 },
    { minAbilityScore: 900, kataLevel: -2 },
    { minAbilityScore: 860, kataLevel: -3 },
    { minAbilityScore: 820, kataLevel: -4 },
    { minAbilityScore: 780, kataLevel: -5 },
    { minAbilityScore: 740, kataLevel: -6 },
    { minAbilityScore: 710, kataLevel: -7 },
    { minAbilityScore: 680, kataLevel: -8 },
    { minAbilityScore: 650, kataLevel: -9 },
    { minAbilityScore: 620, kataLevel: -10 },
    { minAbilityScore: 590, kataLevel: -11 },
    { minAbilityScore: 560, kataLevel: -12 },
    { minAbilityScore: 530, kataLevel: -13 },
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

/** `totalPly`로 정한 페이즈의 가중 능력치 점수를 `abilityKataLadder`에 매핑해 KATA 레벨을 구합니다(페이즈마다 점수 분포가 달라짐). */
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

/**
 * 예정 이벤트 수(실수 vs 신의 한수)에서 **신의 한수 분기**를 고를 확률(0~100, 퍼센트 포인트).
 * 기본 50%에 해당 구간(초·중·종) 능력 점수의 2%p를 가산한다. 예: 구간 능력 1000 → 70%.
 */
export function championshipEventBranchBestMovePercent(phaseAbilityScore: number): number {
    return clampPercent(50 + (Number(phaseAbilityScore) || 0) * 0.02);
}

function clampPercent(value: number): number {
    return Math.max(0, Math.min(100, value));
}
