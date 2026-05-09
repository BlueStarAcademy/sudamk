/** PairWaitingLobby: 모바일에서 N번방 탭으로 포커스(초대 수락·경기 종료 후 복귀 등) */
export const PAIR_LOBBY_FOCUS_ROOM_TAB_SESSION_KEY = 'sudamr_pair_lobby_focus_room_tab';

/** 인게임에서 집계 경기장으로 복귀 시 복원할 페어 방 ID(PairWaitingLobby가 읽고 제거) */
export const POST_GAME_PAIR_ROOM_RESTORE_SESSION_KEY = 'sudamr_post_game_pair_room_id';

/** 페어·전략·놀이 경기장 슬롯 그리드(방 코드 정수 1~N) */
export const PAIR_LOBBY_GRID_SLOT_COUNT = 100;

/** 슬롯 그리드용 — 방 `code`가 순수 정수 문자열이면 슬롯 번호, 아니면 null */
export function pairLobbyGridSlotFromRoomCode(code: string | undefined | null): number | null {
    const s = String(code ?? '').trim();
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 1 || n > PAIR_LOBBY_GRID_SLOT_COUNT || String(n) !== s) return null;
    return n;
}

/** 페어 경기장 방 제목(표시명) 최대 글자 수 — 한글 기준으로 코드 포인트 단위 */
export const PAIR_ROOM_TITLE_MAX_CHARS = 20;

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

/** 11줄: 초반 1~20, 중반 21~40, 종반 41~ */
export const PAIR_PET_KATA_PHASE_PLY_11: Record<PairPetKataPhase, { from: number; to: number | null }> = {
    opening: { from: 1, to: 20 },
    midgame: { from: 21, to: 40 },
    endgame: { from: 41, to: null },
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
 * 페이즈별 가중치 (집중·사고·판단·계산·전투·안정) — 스탯 값에 곱해 가중 합산 후 반올림.
 * 초반: 집30% 사고30% 판40% 계20% 전투30% 안정50%
 * 중반: 집30% 사고30% 판30% 계30% 전투50% 안정30%
 * 종반: 집40% 사고40% 판30% 계50% 전투20% 안정20%
 */
export const PAIR_PET_KATA_PHASE_WEIGHTS: Record<PairPetKataPhase, PairPetCoreStatsSix> = {
    opening: {
        concentration: 0.3,
        thinkingSpeed: 0.3,
        judgment: 0.4,
        calculation: 0.2,
        combatPower: 0.3,
        stability: 0.5,
    },
    midgame: {
        concentration: 0.3,
        thinkingSpeed: 0.3,
        judgment: 0.3,
        calculation: 0.3,
        combatPower: 0.5,
        stability: 0.3,
    },
    endgame: {
        concentration: 0.4,
        thinkingSpeed: 0.4,
        judgment: 0.3,
        calculation: 0.5,
        combatPower: 0.2,
        stability: 0.2,
    },
};

/**
 * 흑·백 합산 착수 수(1부터)로 페이즈 판별.
 * 9·11·13·19만 정의. 그 외 판 크기는 19줄 규칙을 따름.
 */
export function pairPetKataPhaseFromTotalPly(boardSize: number, totalPly: number): PairPetKataPhase {
    return pairPetKataPhaseFromTotalPlyWithTables(boardSize, totalPly, {
        nine: PAIR_PET_KATA_PHASE_PLY_9,
        eleven: PAIR_PET_KATA_PHASE_PLY_11,
        thirteen: PAIR_PET_KATA_PHASE_PLY_13,
        nineteen: PAIR_PET_KATA_PHASE_PLY_19,
    });
}

const PAIR_PET_KATA_PHASE_TABLES_DEFAULT = {
    nine: PAIR_PET_KATA_PHASE_PLY_9,
    eleven: PAIR_PET_KATA_PHASE_PLY_11,
    thirteen: PAIR_PET_KATA_PHASE_PLY_13,
    nineteen: PAIR_PET_KATA_PHASE_PLY_19,
} as const;

/**
 * `pairPetKataPhaseFromTotalPly`와 동일한 합산 수순(1부터) 기준으로, 현재 페이즈 구간이 끝날 때까지 남은 착수 수(카운트다운).
 * 종반(`to === null`)은 `remaining: null`.
 */
export function pairPetKataPliesRemainingInCurrentPhase(
    boardSize: number,
    totalPly: number,
): { phase: PairPetKataPhase; remaining: number | null } {
    const phase = pairPetKataPhaseFromTotalPlyWithTables(boardSize, totalPly, PAIR_PET_KATA_PHASE_TABLES_DEFAULT);
    const table = phaseTableFromRuntime(boardSize, PAIR_PET_KATA_PHASE_TABLES_DEFAULT) ?? PAIR_PET_KATA_PHASE_TABLES_DEFAULT.nineteen;
    const n = Math.max(1, Math.floor(totalPly));
    const { to } = table[phase];
    if (to == null) {
        return { phase, remaining: null };
    }
    return { phase, remaining: Math.max(0, to - n) };
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

/** 능력치 점수 → KATA 오프셋 구간표(`score >= minAbilityScore`이면 해당 오프셋, 높은 min부터 매칭). */
export type PairPetAbilityKataLadderRow = { minAbilityScore: number; kataLevelOffset: number };

export const DEFAULT_PAIR_PET_ABILITY_KATA_LADDER: readonly PairPetAbilityKataLadderRow[] = [
    { minAbilityScore: 194, kataLevelOffset: 9 },
    { minAbilityScore: 191, kataLevelOffset: 8 },
    { minAbilityScore: 188, kataLevelOffset: 7 },
    { minAbilityScore: 185, kataLevelOffset: 6 },
    { minAbilityScore: 182, kataLevelOffset: 5 },
    { minAbilityScore: 179, kataLevelOffset: 4 },
    { minAbilityScore: 176, kataLevelOffset: 3 },
    { minAbilityScore: 173, kataLevelOffset: 2 },
    { minAbilityScore: 170, kataLevelOffset: 1 },
    { minAbilityScore: 167, kataLevelOffset: -1 },
    { minAbilityScore: 164, kataLevelOffset: -2 },
    { minAbilityScore: 161, kataLevelOffset: -3 },
    { minAbilityScore: 158, kataLevelOffset: -4 },
    { minAbilityScore: 155, kataLevelOffset: -5 },
    { minAbilityScore: 152, kataLevelOffset: -6 },
    { minAbilityScore: 149, kataLevelOffset: -7 },
    { minAbilityScore: 146, kataLevelOffset: -8 },
    { minAbilityScore: 143, kataLevelOffset: -9 },
    { minAbilityScore: 140, kataLevelOffset: -10 },
    { minAbilityScore: 137, kataLevelOffset: -11 },
    { minAbilityScore: 134, kataLevelOffset: -12 },
    { minAbilityScore: 131, kataLevelOffset: -13 },
    { minAbilityScore: 128, kataLevelOffset: -14 },
    { minAbilityScore: 125, kataLevelOffset: -15 },
    { minAbilityScore: 122, kataLevelOffset: -16 },
    { minAbilityScore: 119, kataLevelOffset: -17 },
    { minAbilityScore: 116, kataLevelOffset: -18 },
    { minAbilityScore: 113, kataLevelOffset: -19 },
    { minAbilityScore: 110, kataLevelOffset: -20 },
    { minAbilityScore: 108, kataLevelOffset: -21 },
    { minAbilityScore: 106, kataLevelOffset: -22 },
    { minAbilityScore: 104, kataLevelOffset: -23 },
    { minAbilityScore: 102, kataLevelOffset: -24 },
    { minAbilityScore: 100, kataLevelOffset: -25 },
    { minAbilityScore: 98, kataLevelOffset: -26 },
    { minAbilityScore: 96, kataLevelOffset: -27 },
    { minAbilityScore: 94, kataLevelOffset: -28 },
    { minAbilityScore: 92, kataLevelOffset: -29 },
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
        eleven: Record<PairPetKataPhase, { from: number; to: number | null }>;
        thirteen: Record<PairPetKataPhase, { from: number; to: number | null }>;
        nineteen: Record<PairPetKataPhase, { from: number; to: number | null }>;
    },
): Record<PairPetKataPhase, { from: number; to: number | null }> | null {
    if (boardSize === 9) return tables.nine;
    if (boardSize === 11) return tables.eleven;
    if (boardSize === 13) return tables.thirteen;
    if (boardSize === 19) return tables.nineteen;
    return null;
}

/** @internal pairPet 런타임 테이블(9·11·13·19)로 페이즈 판별 */
export function pairPetKataPhaseFromTotalPlyWithTables(
    boardSize: number,
    totalPly: number,
    tables: {
        nine: Record<PairPetKataPhase, { from: number; to: number | null }>;
        eleven: Record<PairPetKataPhase, { from: number; to: number | null }>;
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
        phasePly11: Record<PairPetKataPhase, { from: number; to: number | null }>;
        phasePly13: Record<PairPetKataPhase, { from: number; to: number | null }>;
        phasePly19: Record<PairPetKataPhase, { from: number; to: number | null }>;
    },
): number {
    const weights = pairRuntime?.phaseWeights ?? PAIR_PET_KATA_PHASE_WEIGHTS;
    const tables = pairRuntime
        ? {
              nine: pairRuntime.phasePly9,
              eleven: pairRuntime.phasePly11,
              thirteen: pairRuntime.phasePly13,
              nineteen: pairRuntime.phasePly19,
          }
        : {
              nine: PAIR_PET_KATA_PHASE_PLY_9,
              eleven: PAIR_PET_KATA_PHASE_PLY_11,
              thirteen: PAIR_PET_KATA_PHASE_PLY_13,
              nineteen: PAIR_PET_KATA_PHASE_PLY_19,
          };
    const phase = pairPetKataPhaseFromTotalPlyWithTables(boardSize, totalPly, tables);
    const ability = pairPetKataAbilityScore(phase, stats, weights);
    const ladder = pairRuntime?.abilityKataLadder ?? DEFAULT_PAIR_PET_ABILITY_KATA_LADDER;
    return pairPetKataLevelFromAbilityScoreWithLadder(ability, ladder);
}
