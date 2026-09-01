export type TrainingGroundTrack = 'kata' | 'pet';

export type TrainingGroundBoardSize = 9 | 13 | 19;

export type TrainingGroundDailyTrackRecord = {
    dayKST: string;
    rewardsClaimed: 0 | 1 | 2;
    adRestored: boolean;
};

export type TrainingGroundUserState = {
    kata: TrainingGroundDailyTrackRecord;
    pet: TrainingGroundDailyTrackRecord;
    kataClearedLevels?: number[];
    petClearedLevels?: number[];
};

import type { GameMode } from '../types/enums.js';

export type TrainingGroundGameMeta = {
    track: TrainingGroundTrack;
    kataLevel: number;
    boardSize: TrainingGroundBoardSize;
    gameMode?: GameMode;
};

export const TRAINING_GROUND_BOARD_SIZES: readonly TrainingGroundBoardSize[] = [9, 13, 19];

export const TRAINING_GROUND_KATA_LEVELS: readonly number[] = [
    ...Array.from({ length: 30 }, (_, i) => -30 + i),
    ...Array.from({ length: 10 }, (_, i) => 1 + i),
];

export const TRAINING_GROUND_LOBBY_IMG = '/images/bg/trainingground.webp';

export const TRAINING_GROUND_TAB_STORAGE_KEY = 'sudam.trainingGroundTab';

export const TRAINING_GROUND_BAND_IMAGES = {
    '30-21': '/images/training-ground/band-30-21.webp',
    '20-11': '/images/training-ground/band-20-11.webp',
    '10-1': '/images/training-ground/band-10-1.webp',
    '1-6': '/images/training-ground/band-1-6.webp',
    '7-9': '/images/training-ground/band-7-9.webp',
} as const;

export const TRAINING_GROUND_BOARD_IMAGES: Record<TrainingGroundBoardSize, string> = {
    9: '/images/training-ground/board-9.webp',
    13: '/images/training-ground/board-13.webp',
    19: '/images/training-ground/board-19.webp',
};

export const TRAINING_GROUND_LOCK_IMG = '/images/training-ground/lock.webp';

export function trainingGroundBandImageForKata(kataLevel: number): string {
    if (kataLevel <= -21) return TRAINING_GROUND_BAND_IMAGES['30-21'];
    if (kataLevel <= -11) return TRAINING_GROUND_BAND_IMAGES['20-11'];
    if (kataLevel < 0) return TRAINING_GROUND_BAND_IMAGES['10-1'];
    if (kataLevel <= 6) return TRAINING_GROUND_BAND_IMAGES['1-6'];
    return TRAINING_GROUND_BAND_IMAGES['7-9'];
}

export function normalizeTrainingGroundKataLevel(kataLevel: number): number {
    const n = Math.round(Number(kataLevel));
    if (!Number.isFinite(n) || n === 0) return -1;
    return n;
}

export function trainingGroundStageIndex(kataLevel: number): number {
    const kata = normalizeTrainingGroundKataLevel(kataLevel);
    const idx = TRAINING_GROUND_KATA_LEVELS.indexOf(kata);
    return idx >= 0 ? idx : 0;
}

export function trainingGroundStageNumber(kataLevel: number): number {
    return trainingGroundStageIndex(kataLevel) + 1;
}

/** 단계 번호(1~40) → 고정 Kata levelbot 값 */
export function trainingGroundFixedKataLevelForStageNumber(stageNumber: number): number {
    const idx = Math.max(0, Math.min(TRAINING_GROUND_KATA_LEVELS.length - 1, Math.floor(stageNumber) - 1));
    return TRAINING_GROUND_KATA_LEVELS[idx]!;
}

/** 훈련장 40단계 ladder에 맞는 고정 Kata levelbot 값 (바둑학원·로비 매핑과 무관) */
export function trainingGroundFixedKataLevel(kataLevel: number): number {
    const kata = normalizeTrainingGroundKataLevel(kataLevel);
    if (TRAINING_GROUND_KATA_LEVELS.includes(kata)) return kata;
    return TRAINING_GROUND_KATA_LEVELS[0]!;
}

/** 이 카타부터 보상 밴드가 한 단계 올라간다(큰 폭 상승 구간). 단계별 소폭 증가는 {@link TRAINING_GROUND_GOLD_BY_STAGE} 참고. */
export const TRAINING_GROUND_REWARD_BAND_MIN_KATA = [-25, -18, -10, -5, -1, 1, 3, 5, 7, 9] as const;

/** 40단계(19× 보드) 기준 골드 — 1단계 1,000 → 40단계 100,000 */
const TRAINING_GROUND_GOLD_BY_STAGE = [
    1_000, 1_400, 2_600, 3_800, 4_200,
    4_800, 4_850, 5_850, 7_500, 9_150, 10_150, 10_500,
    11_100, 11_500, 12_950, 15_400, 18_550, 21_000, 22_450, 22_950,
    24_000, 25_850, 31_350, 36_900, 38_700, 40_000,
    42_450, 48_600, 51_050, 53_550, 58_000,
    65_350, 67_850, 75_200, 77_700, 87_050,
    89_550, 95_350, 97_850, 100_000,
] as const;

/** 40단계(19× 보드) 기준 다이아 — 1단계 5 → 40단계 80 */
const TRAINING_GROUND_DIAMONDS_BY_STAGE = [
    5, 6, 8, 10, 11,
    12, 13, 14, 15, 17, 19, 20,
    21, 22, 23, 24, 27, 29, 31, 32,
    33, 34, 37, 42, 43, 44,
    45, 49, 51, 53, 55,
    61, 63, 67, 69, 73,
    75, 77, 79, 80,
] as const;

/** 심법 수련 전용 유저 경험치 — 1단계 100 → 40단계 5,000 (밴드 경계에서 큰 폭 상승) */
const TRAINING_GROUND_KATA_USER_XP_BY_STAGE = [
    100, 115, 130, 145, 160,
    205, 225, 250, 275, 305, 335, 365,
    420, 460, 505, 555, 610, 670, 735, 805,
    920, 990, 1_060, 1_120, 1_180,
    1_280, 1_380, 1_480, 1_580,
    1_800,
    2_150,
    2_500, 2_750,
    3_100, 3_450,
    3_850, 4_250,
    4_550, 4_850,
    5_000,
] as const;

/** 단짝 수련 전용 펫 경험치 — 1단계 80 → 40단계 4,000 (심법 수련 XP 곡선 × 0.8) */
const TRAINING_GROUND_PET_XP_BY_STAGE = [
    80, 92, 104, 116, 128,
    164, 180, 200, 220, 244, 268, 292,
    336, 368, 404, 444, 488, 536, 588, 644,
    736, 792, 848, 896, 944,
    1_024, 1_104, 1_184, 1_264,
    1_440,
    1_720,
    2_000, 2_200,
    2_480, 2_760,
    3_080, 3_400,
    3_640, 3_880,
    4_000,
] as const;

export function trainingGroundRewardBandIndex(kataLevel: number): number {
    const kata = normalizeTrainingGroundKataLevel(kataLevel);
    let band = 0;
    for (const minKata of TRAINING_GROUND_REWARD_BAND_MIN_KATA) {
        if (kata >= minKata) band += 1;
        else break;
    }
    return band;
}

export function isTrainingGroundKataLevel(kataLevel: number): boolean {
    return TRAINING_GROUND_KATA_LEVELS.includes(normalizeTrainingGroundKataLevel(kataLevel));
}

export function clampTrainingGroundBoardSize(raw: unknown): TrainingGroundBoardSize {
    const n = Math.round(Number(raw));
    if (n === 9 || n === 13 || n === 19) return n;
    return 19;
}

export function trainingGroundBoardMultiplier(boardSize: TrainingGroundBoardSize): number {
    if (boardSize === 9) return 0.25;
    if (boardSize === 13) return 0.5;
    return 1;
}

/** 심법 수련 40단계 해금 바둑능력(초·중·종 합) — 1단계 600 → 40단계 4,200 */
export const TRAINING_GROUND_KATA_UNLOCK_TOTAL_ABILITY_BY_STAGE = [
    600, 630, 660, 690, 720,
    750, 795, 840, 900, 960, 1_020, 1_080,
    1_140, 1_230, 1_320, 1_410, 1_500, 1_590, 1_680, 1_770,
    1_860, 1_950, 2_040, 2_130, 2_220,
    2_340, 2_460, 2_580, 2_700, 2_820,
    2_940, 3_060, 3_180, 3_300, 3_450,
    3_600, 3_750, 3_900, 4_050, 4_200,
] as const;

/**
 * 단짝 수련 40단계 해금 바둑능력(초·중·종 합).
 * `DEFAULT_PAIR_PET_ABILITY_KATA_LADDER` 단계별 minAbilityScore × 3 — 1단계 270 → 40단계 630.
 */
export const TRAINING_GROUND_PET_UNLOCK_TOTAL_ABILITY_BY_STAGE = [
    270, 276, 282, 288, 294,
    300, 306, 312, 318, 324, 330, 339,
    348, 357, 366, 375, 384, 393, 402, 411,
    420, 429, 438, 447, 456,
    465, 474, 483, 492, 501,
    510, 519, 528, 537, 546,
    570, 585, 600, 615, 630,
] as const;

export type TrainingGroundAbilityLadderRow = {
    minAbilityScore: number;
    kataLevel?: number;
    kataLevelOffset?: number;
};

export function trainingGroundBaseGoldForKata(kataLevel: number): number {
    const idx = trainingGroundStageIndex(kataLevel);
    return TRAINING_GROUND_GOLD_BY_STAGE[idx] ?? TRAINING_GROUND_GOLD_BY_STAGE[0];
}

export function trainingGroundBaseDiamondsForKata(kataLevel: number): number {
    const idx = trainingGroundStageIndex(kataLevel);
    return TRAINING_GROUND_DIAMONDS_BY_STAGE[idx] ?? TRAINING_GROUND_DIAMONDS_BY_STAGE[0];
}

/** 심법 수련(19× 보드) 기준 유저 경험치 — 단짝 수련에는 미적용 */
export function trainingGroundBaseKataUserXpForKata(kataLevel: number): number {
    const idx = trainingGroundStageIndex(kataLevel);
    return TRAINING_GROUND_KATA_USER_XP_BY_STAGE[idx] ?? TRAINING_GROUND_KATA_USER_XP_BY_STAGE[0];
}

/** 단짝 수련(19× 보드) 기준 펫 경험치 — 심법 수련에는 미적용 */
export function trainingGroundBasePetXpForKata(kataLevel: number): number {
    const idx = trainingGroundStageIndex(kataLevel);
    return TRAINING_GROUND_PET_XP_BY_STAGE[idx] ?? TRAINING_GROUND_PET_XP_BY_STAGE[0];
}

export function rewardForKataLevel(
    kataLevel: number,
    boardSize: TrainingGroundBoardSize,
): { gold: number; diamonds: number; kataUserXp: number; petXp: number } {
    const mul = trainingGroundBoardMultiplier(clampTrainingGroundBoardSize(boardSize));
    return {
        gold: Math.round(trainingGroundBaseGoldForKata(kataLevel) * mul),
        diamonds: Math.round(trainingGroundBaseDiamondsForKata(kataLevel) * mul),
        kataUserXp: Math.round(trainingGroundBaseKataUserXpForKata(kataLevel) * mul),
        petXp: Math.round(trainingGroundBasePetXpForKata(kataLevel) * mul),
    };
}

export function minAbilityScoreForKataLevel(
    kataLevel: number,
    ladder: readonly TrainingGroundAbilityLadderRow[],
): number {
    const target = normalizeTrainingGroundKataLevel(kataLevel);
    const row = ladder.find((r) => (r.kataLevel ?? r.kataLevelOffset) === target);
    return Math.max(0, Math.round(Number(row?.minAbilityScore) || 0));
}

export function trainingGroundKataUnlockTotalAbility(kataLevel: number): number {
    const idx = trainingGroundStageIndex(kataLevel);
    return (
        TRAINING_GROUND_KATA_UNLOCK_TOTAL_ABILITY_BY_STAGE[idx] ??
        TRAINING_GROUND_KATA_UNLOCK_TOTAL_ABILITY_BY_STAGE[0]
    );
}

/** 단짝 수련 해금 — 40단계 고정 테이블(초·중·종 합). */
export function trainingGroundPetUnlockTotalAbility(kataLevel: number): number {
    const idx = trainingGroundStageIndex(kataLevel);
    return (
        TRAINING_GROUND_PET_UNLOCK_TOTAL_ABILITY_BY_STAGE[idx] ??
        TRAINING_GROUND_PET_UNLOCK_TOTAL_ABILITY_BY_STAGE[0]
    );
}

/** 단계 해금 UI·판정용 — 초·중·종반 가중 능력치 합(런타임 사다리와 무관). */
export function trainingGroundUnlockTotalAbility(
    kataLevel: number,
    track: TrainingGroundTrack = 'kata',
): number {
    if (track === 'pet') {
        return trainingGroundPetUnlockTotalAbility(kataLevel);
    }
    return trainingGroundKataUnlockTotalAbility(kataLevel);
}

export function isTrainingGroundSession(game: {
    settings?: { trainingGround?: unknown; friendlyLobbyMatch?: boolean } | null;
} | null | undefined): boolean {
    // 훈련 머신(대기실 AI)은 friendlyLobbyMatch 로 심법/단짝 수련 메타와 구분
    if (game?.settings?.friendlyLobbyMatch) return false;
    return Boolean(game?.settings?.trainingGround);
}

/** 심법 수련 AI — 유저 로그인 아이디를 거울처럼 표시 */
export function trainingGroundKataMirrorBotNickname(username: string): string {
    const id = String(username ?? '').trim();
    return id ? `${id}(봇)` : '(봇)';
}
