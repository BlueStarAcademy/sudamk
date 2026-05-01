import type { PairPetTrainingSlotState } from '../types/entities.js';

/** 페어 경기장 수련 슬롯 수 */
export const PAIR_TRAINING_SLOT_COUNT = 5;

/** 슬롯별 페어 승리 누적 필요 (해금) */
export const PAIR_TRAINING_UNLOCK_WINS = [1, 10, 50, 100, 250] as const;

/** 슬롯별 참여 가능 최소 펫 레벨 (1번은 사실상 제한 없음) */
export const PAIR_TRAINING_MIN_PET_LEVEL = [1, 5, 10, 15, 20] as const;

/** 수련 슬롯 UI 표시 이름 (인덱스 0~4 = 수련1~5) */
export const PAIR_TRAINING_SLOT_DISPLAY_NAMES = [
    '기술 훈련',
    '사활 훈련',
    '수상전 훈련',
    '정석 훈련',
    '기보 훈련',
] as const;

export function getPairTrainingSlotDisplayName(slotIndex: number): string {
    if (slotIndex < 0 || slotIndex >= PAIR_TRAINING_SLOT_COUNT) return '';
    return PAIR_TRAINING_SLOT_DISPLAY_NAMES[slotIndex] ?? '';
}

/** 영혼석 20% 분기 안에서의 가중치·지급 개수 (가중치 합 = 100) */
export type PairTrainingSoulRow = { materialName: string; weight: number; quantity: number };

export type PairTrainingSlotDef = {
    slotIndex: number;
    /** 수련 시간 (ms) */
    durationMs: number;
    goldMin: number;
    goldMax: number;
    xpMin: number;
    xpMax: number;
    /** 영혼석 추가 지급 확률 (0~1) */
    soulDropChance: number;
    soulTable: PairTrainingSoulRow[];
};

export const PAIR_TRAINING_SLOT_DEFS: PairTrainingSlotDef[] = [
    {
        slotIndex: 0,
        durationMs: 30 * 60 * 1000,
        goldMin: 300,
        goldMax: 300,
        xpMin: 30,
        xpMax: 50,
        soulDropChance: 0.2,
        soulTable: [{ materialName: '새싹영혼석', weight: 100, quantity: 1 }],
    },
    {
        slotIndex: 1,
        durationMs: 45 * 60 * 1000,
        goldMin: 500,
        goldMax: 500,
        xpMin: 55,
        xpMax: 80,
        soulDropChance: 0.2,
        soulTable: [
            { materialName: '새싹영혼석', weight: 80, quantity: 1 },
            { materialName: '파동영혼석', weight: 20, quantity: 1 },
        ],
    },
    {
        slotIndex: 2,
        durationMs: 60 * 60 * 1000,
        goldMin: 800,
        goldMax: 800,
        xpMin: 85,
        xpMax: 100,
        soulDropChance: 0.2,
        soulTable: [
            { materialName: '새싹영혼석', weight: 70, quantity: 2 },
            { materialName: '파동영혼석', weight: 20, quantity: 1 },
            { materialName: '심연영혼석', weight: 10, quantity: 1 },
        ],
    },
    {
        slotIndex: 3,
        durationMs: 90 * 60 * 1000,
        goldMin: 1200,
        goldMax: 1200,
        xpMin: 110,
        xpMax: 150,
        soulDropChance: 0.2,
        soulTable: [
            { materialName: '파동영혼석', weight: 70, quantity: 2 },
            { materialName: '심연영혼석', weight: 20, quantity: 1 },
            { materialName: '화염영혼석', weight: 10, quantity: 1 },
        ],
    },
    {
        slotIndex: 4,
        durationMs: 120 * 60 * 1000,
        goldMin: 2000,
        goldMax: 2000,
        xpMin: 150,
        xpMax: 200,
        soulDropChance: 0.2,
        soulTable: [
            { materialName: '심연영혼석', weight: 60, quantity: 2 },
            { materialName: '화염영혼석', weight: 30, quantity: 1 },
            { materialName: '천광영혼석', weight: 10, quantity: 1 },
        ],
    },
];

type StatsLike = { stats?: Record<string, { wins?: number } | undefined> | undefined };

export function getPairWins(user: StatsLike): number {
    const w = user.stats?.['pair']?.wins;
    return typeof w === 'number' && Number.isFinite(w) ? Math.max(0, Math.floor(w)) : 0;
}

export function isPairTrainingSlotUnlocked(user: StatsLike, slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= PAIR_TRAINING_SLOT_COUNT) return false;
    return getPairWins(user) >= PAIR_TRAINING_UNLOCK_WINS[slotIndex]!;
}

export function minPetLevelForTrainingSlot(slotIndex: number): number {
    if (slotIndex < 0 || slotIndex >= PAIR_TRAINING_SLOT_COUNT) return 999;
    return PAIR_TRAINING_MIN_PET_LEVEL[slotIndex]!;
}

export function normalizePairPetTrainingSlots(
    raw: (PairPetTrainingSlotState | null | undefined)[] | null | undefined
): (PairPetTrainingSlotState | null)[] {
    const out: (PairPetTrainingSlotState | null)[] = Array(PAIR_TRAINING_SLOT_COUNT).fill(null);
    if (!Array.isArray(raw)) return out;
    for (let i = 0; i < PAIR_TRAINING_SLOT_COUNT; i += 1) {
        const cell = raw[i];
        if (!cell || typeof cell !== 'object') continue;
        const slotIndex = Math.floor(Number((cell as PairPetTrainingSlotState).slotIndex));
        const itemId = String((cell as PairPetTrainingSlotState).itemId ?? '');
        const startedAt = Number((cell as PairPetTrainingSlotState).startedAt);
        if (slotIndex !== i || !itemId || !Number.isFinite(startedAt) || startedAt <= 0) continue;
        out[i] = { slotIndex: i, itemId, startedAt };
    }
    return out;
}

export function getPairTrainingSlotDef(slotIndex: number): PairTrainingSlotDef | undefined {
    return PAIR_TRAINING_SLOT_DEFS[slotIndex];
}

export function trainingEndsAt(startedAt: number, slotIndex: number): number {
    const def = getPairTrainingSlotDef(slotIndex);
    if (!def) return startedAt;
    return startedAt + def.durationMs;
}

export function isItemIdInPairTraining(
    slots: (PairPetTrainingSlotState | null)[] | null | undefined,
    itemId: string
): boolean {
    if (!slots?.length) return false;
    return slots.some((s) => s && s.itemId === itemId);
}
