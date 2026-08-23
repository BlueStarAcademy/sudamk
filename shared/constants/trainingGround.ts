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

export type TrainingGroundGameMeta = {
    track: TrainingGroundTrack;
    kataLevel: number;
    boardSize: TrainingGroundBoardSize;
};

export const TRAINING_GROUND_BOARD_SIZES: readonly TrainingGroundBoardSize[] = [9, 13, 19];

export const TRAINING_GROUND_KATA_LEVELS: readonly number[] = [
    ...Array.from({ length: 30 }, (_, i) => -30 + i),
    ...Array.from({ length: 9 }, (_, i) => 1 + i),
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

export function trainingGroundBaseGoldForKata(kataLevel: number): number {
    return 8000 + trainingGroundStageIndex(kataLevel) * 2000;
}

export function trainingGroundBaseDiamondsForKata(kataLevel: number): number {
    const kata = normalizeTrainingGroundKataLevel(kataLevel);
    if (kata <= -21) return 8;
    if (kata <= -11) return 20;
    if (kata <= -4) return 32;
    if (kata <= -1) return 44;
    if (kata <= 3) return 56;
    if (kata <= 6) return 68;
    return 80;
}

export function rewardForKataLevel(
    kataLevel: number,
    boardSize: TrainingGroundBoardSize,
): { gold: number; diamonds: number } {
    const mul = trainingGroundBoardMultiplier(clampTrainingGroundBoardSize(boardSize));
    return {
        gold: Math.round(trainingGroundBaseGoldForKata(kataLevel) * mul),
        diamonds: Math.round(trainingGroundBaseDiamondsForKata(kataLevel) * mul),
    };
}

export function minAbilityScoreForKataLevel(
    kataLevel: number,
    ladder: readonly { minAbilityScore: number; kataLevel?: number; kataLevelOffset?: number }[],
): number {
    const target = normalizeTrainingGroundKataLevel(kataLevel);
    const row = ladder.find((r) => (r.kataLevel ?? r.kataLevelOffset) === target);
    return Math.max(0, Math.round(Number(row?.minAbilityScore) || 0));
}

export function isTrainingGroundSession(game: {
    settings?: { trainingGround?: unknown } | null;
} | null | undefined): boolean {
    return Boolean(game?.settings?.trainingGround);
}
