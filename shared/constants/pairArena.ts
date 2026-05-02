/** 페어 경기장 방 제목(표시명) 최대 글자 수 — 한글 기준으로 코드 포인트 단위 */
export const PAIR_ROOM_TITLE_MAX_CHARS = 12;

export function clampPairRoomTitle(raw: string | undefined | null): string {
    const t = String(raw ?? '').trim();
    return [...t].slice(0, PAIR_ROOM_TITLE_MAX_CHARS).join('');
}

/** 흑·백 합산 착수 수 기준 페이즈 (페어 펫 KATA 등) */
export type PairPetKataPhase = 'opening' | 'midgame' | 'endgame';

/** 9줄: 초반 1~15, 중반 16~30, 종반 31~ */
export const PAIR_PET_KATA_PHASE_PLY_9: Record<PairPetKataPhase, { from: number; to: number | null }> = {
    opening: { from: 1, to: 15 },
    midgame: { from: 16, to: 30 },
    endgame: { from: 31, to: null },
};

/** 13줄: 초반 1~25, 중반 26~50, 종반 51~ */
export const PAIR_PET_KATA_PHASE_PLY_13: Record<PairPetKataPhase, { from: number; to: number | null }> = {
    opening: { from: 1, to: 25 },
    midgame: { from: 26, to: 50 },
    endgame: { from: 51, to: null },
};

/** 19줄: 초반 1~60, 중반 61~120, 종반 121~ (종반은 121수부터) */
export const PAIR_PET_KATA_PHASE_PLY_19: Record<PairPetKataPhase, { from: number; to: number | null }> = {
    opening: { from: 1, to: 60 },
    midgame: { from: 61, to: 120 },
    endgame: { from: 121, to: null },
};

/** 펫 6코어(숫자) — 가중 합산용 */
export type PairPetCoreStatsSix = {
    concentration: number;
    thinkingSpeed: number;
    judgment: number;
    calculation: number;
    combatPower: number;
    stability: number;
};

/**
 * 페이즈별 가중치 (집중·사고·판단·계산·전투·안정).
 * 초반: 집20 사고20 판20 계20 전투30 안정30
 * 중반: 집40 사고40 판50 계30 전투60 안정30
 * 종반: 집40 사고40 판30 계50 전투10 안정40
 */
export const PAIR_PET_KATA_PHASE_WEIGHTS: Record<PairPetKataPhase, PairPetCoreStatsSix> = {
    opening: {
        concentration: 0.2,
        thinkingSpeed: 0.2,
        judgment: 0.2,
        calculation: 0.2,
        combatPower: 0.3,
        stability: 0.3,
    },
    midgame: {
        concentration: 0.4,
        thinkingSpeed: 0.4,
        judgment: 0.5,
        calculation: 0.3,
        combatPower: 0.6,
        stability: 0.3,
    },
    endgame: {
        concentration: 0.4,
        thinkingSpeed: 0.4,
        judgment: 0.3,
        calculation: 0.5,
        combatPower: 0.1,
        stability: 0.4,
    },
};

/**
 * 흑·백 합산 착수 수(1부터)로 페이즈 판별.
 * 9·13·19만 정의. 그 외 판 크기는 19줄 규칙을 따름.
 */
export function pairPetKataPhaseFromTotalPly(boardSize: number, totalPly: number): PairPetKataPhase {
    return pairPetKataPhaseFromTotalPlyWithTables(boardSize, totalPly, {
        nine: PAIR_PET_KATA_PHASE_PLY_9,
        thirteen: PAIR_PET_KATA_PHASE_PLY_13,
        nineteen: PAIR_PET_KATA_PHASE_PLY_19,
    });
}

/** 가중 능력치 점수(반올림 정수) */
export function pairPetKataAbilityScore(
    phase: PairPetKataPhase,
    stats: PairPetCoreStatsSix,
    weights: Record<PairPetKataPhase, PairPetCoreStatsSix> = PAIR_PET_KATA_PHASE_WEIGHTS,
): number {
    const w = weights[phase];
    const raw =
        stats.concentration * w.concentration +
        stats.thinkingSpeed * w.thinkingSpeed +
        stats.judgment * w.judgment +
        stats.calculation * w.calculation +
        stats.combatPower * w.combatPower +
        stats.stability * w.stability;
    return Math.round(raw);
}

/** 능력치 점수 → KATA 오프셋 구간표(높은 `minAbilityScore`부터 매칭). */
export type PairPetAbilityKataLadderRow = { minAbilityScore: number; kataLevelOffset: number };

export const DEFAULT_PAIR_PET_ABILITY_KATA_LADDER: readonly PairPetAbilityKataLadderRow[] = [
    { minAbilityScore: 185, kataLevelOffset: 5 },
    { minAbilityScore: 180, kataLevelOffset: 4 },
    { minAbilityScore: 175, kataLevelOffset: 3 },
    { minAbilityScore: 170, kataLevelOffset: 2 },
    { minAbilityScore: 165, kataLevelOffset: 1 },
    { minAbilityScore: 160, kataLevelOffset: -2 },
    { minAbilityScore: 155, kataLevelOffset: -4 },
    { minAbilityScore: 150, kataLevelOffset: -6 },
    { minAbilityScore: 145, kataLevelOffset: -8 },
    { minAbilityScore: 140, kataLevelOffset: -10 },
    { minAbilityScore: 135, kataLevelOffset: -12 },
    { minAbilityScore: 130, kataLevelOffset: -14 },
    { minAbilityScore: 125, kataLevelOffset: -16 },
    { minAbilityScore: 120, kataLevelOffset: -18 },
    { minAbilityScore: 115, kataLevelOffset: -20 },
    { minAbilityScore: 110, kataLevelOffset: -22 },
    { minAbilityScore: 105, kataLevelOffset: -24 },
    { minAbilityScore: 100, kataLevelOffset: -26 },
    { minAbilityScore: 95, kataLevelOffset: -28 },
    { minAbilityScore: 90, kataLevelOffset: -30 },
] as const;

function normalizeAbilityKataLadder(ladder: readonly PairPetAbilityKataLadderRow[]): PairPetAbilityKataLadderRow[] {
    const rows = ladder
        .map((r) => ({
            minAbilityScore: Math.round(Number(r.minAbilityScore)),
            kataLevelOffset: Math.round(Number(r.kataLevelOffset)),
        }))
        .filter((r) => Number.isFinite(r.minAbilityScore) && Number.isFinite(r.kataLevelOffset));
    rows.sort((a, b) => b.minAbilityScore - a.minAbilityScore);
    return rows.length > 0 ? rows : [...DEFAULT_PAIR_PET_ABILITY_KATA_LADDER];
}

/**
 * 능력치 점수 → KATA 레벨 오프셋.
 * `ladder`는 `minAbilityScore` 내림차순이면 그대로 쓰고, 아니면 정렬합니다. 매칭 없으면 마지막 행(가장 약함).
 */
export function pairPetKataLevelFromAbilityScoreWithLadder(score: number, ladder: readonly PairPetAbilityKataLadderRow[]): number {
    const s = Math.round(score);
    const norm = normalizeAbilityKataLadder([...ladder]);
    for (const row of norm) {
        if (s >= row.minAbilityScore) return row.kataLevelOffset;
    }
    return norm[norm.length - 1]!.kataLevelOffset;
}

/**
 * 능력치 점수 → KATA 레벨 오프셋(표준 스펙).
 * 90 미만은 표의 최저 구간(kataLevelOffset -30)과 동일하게 처리(매칭 실패 시 마지막 행).
 */
export function pairPetKataLevelFromAbilityScore(score: number): number {
    return pairPetKataLevelFromAbilityScoreWithLadder(score, DEFAULT_PAIR_PET_ABILITY_KATA_LADDER);
}

function phaseTableFromRuntime(
    boardSize: number,
    tables: {
        nine: Record<PairPetKataPhase, { from: number; to: number | null }>;
        thirteen: Record<PairPetKataPhase, { from: number; to: number | null }>;
        nineteen: Record<PairPetKataPhase, { from: number; to: number | null }>;
    },
): Record<PairPetKataPhase, { from: number; to: number | null }> | null {
    if (boardSize === 9) return tables.nine;
    if (boardSize === 13) return tables.thirteen;
    if (boardSize === 19) return tables.nineteen;
    return null;
}

/** @internal pairPet 런타임 테이블(9·13·19)로 페이즈 판별 */
export function pairPetKataPhaseFromTotalPlyWithTables(
    boardSize: number,
    totalPly: number,
    tables: {
        nine: Record<PairPetKataPhase, { from: number; to: number | null }>;
        thirteen: Record<PairPetKataPhase, { from: number; to: number | null }>;
        nineteen: Record<PairPetKataPhase, { from: number; to: number | null }>;
    },
): PairPetKataPhase {
    const table = phaseTableFromRuntime(boardSize, tables) ?? tables.nineteen;
    const n = Math.max(1, Math.floor(totalPly));
    const order: PairPetKataPhase[] = ['opening', 'midgame', 'endgame'];
    for (const phase of order) {
        const { from, to } = table[phase];
        if (to == null) {
            if (n >= from) return phase;
        } else if (n >= from && n <= to) {
            return phase;
        }
    }
    return 'endgame';
}

/** 한 수순에서 쓸 KATA 레벨(오프셋) — 보드 크기·총 수순·펫 6스탯으로 결정 */
export function pairPetKataLevelForTotalPly(
    boardSize: number,
    totalPly: number,
    stats: PairPetCoreStatsSix,
    pairRuntime?: {
        abilityKataLadder: readonly PairPetAbilityKataLadderRow[];
        phaseWeights: Record<PairPetKataPhase, PairPetCoreStatsSix>;
        phasePly9: Record<PairPetKataPhase, { from: number; to: number | null }>;
        phasePly13: Record<PairPetKataPhase, { from: number; to: number | null }>;
        phasePly19: Record<PairPetKataPhase, { from: number; to: number | null }>;
    },
): number {
    const weights = pairRuntime?.phaseWeights ?? PAIR_PET_KATA_PHASE_WEIGHTS;
    const tables = pairRuntime
        ? { nine: pairRuntime.phasePly9, thirteen: pairRuntime.phasePly13, nineteen: pairRuntime.phasePly19 }
        : {
              nine: PAIR_PET_KATA_PHASE_PLY_9,
              thirteen: PAIR_PET_KATA_PHASE_PLY_13,
              nineteen: PAIR_PET_KATA_PHASE_PLY_19,
          };
    const phase = pairPetKataPhaseFromTotalPlyWithTables(boardSize, totalPly, tables);
    const ability = pairPetKataAbilityScore(phase, stats, weights);
    const ladder = pairRuntime?.abilityKataLadder ?? DEFAULT_PAIR_PET_ABILITY_KATA_LADDER;
    return pairPetKataLevelFromAbilityScoreWithLadder(ability, ladder);
}
