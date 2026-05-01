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

function phaseTableForBoard(boardSize: number): Record<PairPetKataPhase, { from: number; to: number | null }> | null {
    if (boardSize === 9) return PAIR_PET_KATA_PHASE_PLY_9;
    if (boardSize === 13) return PAIR_PET_KATA_PHASE_PLY_13;
    if (boardSize === 19) return PAIR_PET_KATA_PHASE_PLY_19;
    return null;
}

/**
 * 흑·백 합산 착수 수(1부터)로 페이즈 판별.
 * 9·13·19만 정의. 그 외 판 크기는 19줄 규칙을 따름.
 */
export function pairPetKataPhaseFromTotalPly(boardSize: number, totalPly: number): PairPetKataPhase {
    const table = phaseTableForBoard(boardSize) ?? PAIR_PET_KATA_PHASE_PLY_19;
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

/** 가중 능력치 점수(반올림 정수) */
export function pairPetKataAbilityScore(phase: PairPetKataPhase, stats: PairPetCoreStatsSix): number {
    const w = PAIR_PET_KATA_PHASE_WEIGHTS[phase];
    const raw =
        stats.concentration * w.concentration +
        stats.thinkingSpeed * w.thinkingSpeed +
        stats.judgment * w.judgment +
        stats.calculation * w.calculation +
        stats.combatPower * w.combatPower +
        stats.stability * w.stability;
    return Math.round(raw);
}

/**
 * 능력치 점수 → KATA 레벨 오프셋(표준 스펙).
 * 70 미만은 70~74구간과 동일(-30)으로 처리.
 */
export function pairPetKataLevelFromAbilityScore(score: number): number {
    const s = Math.round(score);
    if (s >= 165) return 5;
    if (s >= 160) return 4;
    if (s >= 155) return 3;
    if (s >= 150) return 2;
    if (s >= 145) return 1;
    if (s >= 140) return -2;
    if (s >= 135) return -4;
    if (s >= 130) return -6;
    if (s >= 125) return -8;
    if (s >= 120) return -10;
    if (s >= 115) return -12;
    if (s >= 110) return -14;
    if (s >= 105) return -16;
    if (s >= 100) return -18;
    if (s >= 95) return -20;
    if (s >= 90) return -22;
    if (s >= 85) return -24;
    if (s >= 80) return -26;
    if (s >= 75) return -28;
    if (s >= 70) return -30;
    return -30;
}

/** 한 수순에서 쓸 KATA 레벨(오프셋) — 보드 크기·총 수순·펫 6스탯으로 결정 */
export function pairPetKataLevelForTotalPly(
    boardSize: number,
    totalPly: number,
    stats: PairPetCoreStatsSix
): number {
    const phase = pairPetKataPhaseFromTotalPly(boardSize, totalPly);
    const ability = pairPetKataAbilityScore(phase, stats);
    return pairPetKataLevelFromAbilityScore(ability);
}
