import type { PairPetMeta, PairPetTrainingSlotState, User } from '../types/entities.js';
import { isFunctionVipActive } from '../utils/rewardVip.js';

/** 페어 경기장 수련 슬롯 수 (일반 5 + 기능 VIP 전용 1) */
export const PAIR_TRAINING_SLOT_COUNT = 6;

/** 기능 VIP 전용 수련 슬롯 인덱스 (0부터, 6번째 칸) */
export const PAIR_TRAINING_VIP_SLOT_INDEX = 5;

/** 슬롯별 페어 승리 누적 필요 (해금). VIP 슬롯(5)은 승리 조건 미사용(0) */
export const PAIR_TRAINING_UNLOCK_WINS = [1, 10, 50, 100, 250, 0] as const;

/** 슬롯별 참여 가능 최소 펫 레벨 (1번·VIP는 사실상 제한 없음) */
export const PAIR_TRAINING_MIN_PET_LEVEL = [1, 5, 10, 15, 20, 1] as const;

/** 수련 슬롯 UI 표시 이름 */
export const PAIR_TRAINING_SLOT_DISPLAY_NAMES = [
    '기술수련',
    '사활수련',
    '수상전수련',
    '정석수련',
    '기보수련',
    '수담수련',
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
    /** 기능 VIP 활성 시에만 해금 (기보수련과 동일 확률보상 구조) */
    requiresFunctionVip?: boolean;
};

export const PAIR_TRAINING_SLOT_DEFS: PairTrainingSlotDef[] = [
    {
        slotIndex: 0,
        durationMs: 30 * 60 * 1000,
        goldMin: 300,
        goldMax: 300,
        xpMin: 60,
        xpMax: 100,
        soulDropChance: 0.2,
        soulTable: [{ materialName: '새싹영혼석', weight: 100, quantity: 1 }],
    },
    {
        slotIndex: 1,
        durationMs: 45 * 60 * 1000,
        goldMin: 500,
        goldMax: 500,
        xpMin: 110,
        xpMax: 160,
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
        xpMin: 170,
        xpMax: 200,
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
        xpMin: 220,
        xpMax: 300,
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
        xpMin: 300,
        xpMax: 400,
        soulDropChance: 0.2,
        soulTable: [
            { materialName: '심연영혼석', weight: 60, quantity: 2 },
            { materialName: '화염영혼석', weight: 30, quantity: 1 },
            { materialName: '천광영혼석', weight: 10, quantity: 1 },
        ],
    },
    {
        slotIndex: 5,
        durationMs: 30 * 60 * 1000,
        goldMin: 1000,
        goldMax: 1000,
        xpMin: 200,
        xpMax: 400,
        soulDropChance: 0.2,
        soulTable: [
            { materialName: '심연영혼석', weight: 60, quantity: 2 },
            { materialName: '화염영혼석', weight: 30, quantity: 1 },
            { materialName: '천광영혼석', weight: 10, quantity: 1 },
        ],
        requiresFunctionVip: true,
    },
];

type StatsLike = {
    stats?: Record<string, { wins?: number } | undefined> | undefined;
    pairArenaStatsByMode?: Record<string, { wins?: number; losses?: number } | undefined> | undefined;
};

/** 페어 훈련 슬롯 언락용: 경기장 모드별 전적 승수 합(친선·AI 포함). 랭킹전 전용 `pairRankedMatchRecord`와 무관 */
export function getPairWins(user: StatsLike): number {
    const byMode = user.pairArenaStatsByMode;
    if (byMode && typeof byMode === 'object') {
        let sum = 0;
        for (const row of Object.values(byMode)) {
            const w = row?.wins;
            if (typeof w === 'number' && Number.isFinite(w)) sum += Math.max(0, Math.floor(w));
        }
        return sum;
    }
    const w = user.stats?.['pair']?.wins;
    return typeof w === 'number' && Number.isFinite(w) ? Math.max(0, Math.floor(w)) : 0;
}

export function isPairTrainingSlotUnlocked(user: User, slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= PAIR_TRAINING_SLOT_COUNT) return false;
    const def = getPairTrainingSlotDef(slotIndex);
    if (def?.requiresFunctionVip) return isFunctionVipActive(user);
    return getPairWins(user) >= PAIR_TRAINING_UNLOCK_WINS[slotIndex]!;
}

export function minPetLevelForTrainingSlot(slotIndex: number): number {
    if (slotIndex < 0 || slotIndex >= PAIR_TRAINING_SLOT_COUNT) return 999;
    return PAIR_TRAINING_MIN_PET_LEVEL[slotIndex]!;
}

function parseTrainingStartedAtMs(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.floor(value);
    }
    if (typeof value === 'bigint') {
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : NaN;
    }
    if (typeof value === 'string' && value.length > 0) {
        const asNum = Number(value);
        if (Number.isFinite(asNum) && asNum > 0) return Math.floor(asNum);
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return NaN;
}

/** DB/JSON 직렬화 등으로 배열이 아닌 `{ "0": {...} }` 형태가 될 수 있음 */
function pairTrainingSlotsAsArray(
    raw: (PairPetTrainingSlotState | null | undefined)[] | Record<string, unknown> | null | undefined
): (PairPetTrainingSlotState | null | undefined)[] {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== 'object') return [];
    const row: (PairPetTrainingSlotState | null | undefined)[] = [];
    for (let i = 0; i < PAIR_TRAINING_SLOT_COUNT; i += 1) {
        const rec = raw as Record<string, unknown>;
        const v = rec[String(i)] ?? (rec as Record<number, unknown>)[i];
        row[i] = (v as PairPetTrainingSlotState | null | undefined) ?? undefined;
    }
    return row;
}

export function normalizePairPetTrainingSlots(
    raw: (PairPetTrainingSlotState | null | undefined)[] | Record<string, unknown> | null | undefined
): (PairPetTrainingSlotState | null)[] {
    const out: (PairPetTrainingSlotState | null)[] = Array(PAIR_TRAINING_SLOT_COUNT).fill(null);
    const cells = pairTrainingSlotsAsArray(raw);
    for (let i = 0; i < PAIR_TRAINING_SLOT_COUNT; i += 1) {
        const cell = cells[i];
        if (!cell || typeof cell !== 'object') continue;
        const declared = Math.floor(Number((cell as PairPetTrainingSlotState).slotIndex));
        const hasDeclaredSlot =
            Number.isFinite(declared) && declared >= 0 && declared < PAIR_TRAINING_SLOT_COUNT;
        /** `slotIndex` 필드 누락·NaN 시 배열 인덱스를 신뢰 (누락 시 세션이 전부 날아가 수령 400 유발) */
        const slotIndex = hasDeclaredSlot ? declared : i;
        if (slotIndex !== i) continue;
        const itemId = String((cell as PairPetTrainingSlotState).itemId ?? '');
        const startedAt = parseTrainingStartedAtMs((cell as PairPetTrainingSlotState).startedAt);
        if (!itemId || !Number.isFinite(startedAt) || startedAt <= 0) continue;
        out[i] = { slotIndex: i, itemId, startedAt };
    }
    return out;
}

export function getPairTrainingSlotDef(slotIndex: number): PairTrainingSlotDef | undefined {
    return PAIR_TRAINING_SLOT_DEFS[slotIndex];
}

/**
 * 특화「수련 시간 -N%」: 기본 소요 시간에 (1 - N/100)을 곱함.
 * N은 0~99로 클램프해 비정상 데이터로 0ms 이하가 되지 않게 함.
 */
export function pairPetTrainingTimeMultiplier(meta: PairPetMeta | null | undefined): number {
    if (!meta?.specialization || meta.specialization.kind !== 'trainingTime') return 1;
    const rawPct = Number(meta.specialization.pct);
    if (!Number.isFinite(rawPct) || rawPct <= 0) return 1;
    const pct = Math.min(99, Math.max(0, rawPct));
    return Math.max(0.01, 1 - pct / 100);
}

/** 슬롯 기본 `durationMs`에 펫 수련 시간 특화를 반영한 실제 수련 길이(ms). */
export function effectivePairTrainingDurationMs(slotIndex: number, meta: PairPetMeta | null | undefined): number {
    const def = getPairTrainingSlotDef(slotIndex);
    if (!def) return 0;
    return Math.max(1, Math.floor(def.durationMs * pairPetTrainingTimeMultiplier(meta)));
}

/**
 * @param meta `undefined`이면 슬롯 기본 시간만 사용(구동기·테스트 호환).
 * `null` 또는 인벤에서 찾은 메타: `trainingTime` 특화 시 단축된 종료 시각.
 */
export function trainingEndsAt(startedAt: number, slotIndex: number, meta?: PairPetMeta | null): number {
    const def = getPairTrainingSlotDef(slotIndex);
    if (!def) return startedAt;
    const durationMs =
        meta === undefined ? def.durationMs : effectivePairTrainingDurationMs(slotIndex, meta);
    return startedAt + durationMs;
}

export function isItemIdInPairTraining(
    slots: (PairPetTrainingSlotState | null)[] | null | undefined,
    itemId: string
): boolean {
    if (!slots?.length) return false;
    return slots.some((s) => s && s.itemId === itemId);
}
