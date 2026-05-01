import { getPairWins } from './pairTraining.js';
import { PAIR_PET_MAX_LEVEL } from './pairPetGrade.js';
import { isFunctionVipActive } from '../utils/rewardVip.js';
import type { PairPetHatcherySession, User } from '../types/entities.js';

/** 부화 펫 수령·즉시 완료 시 펫 로비 인벤 슬롯 부족 — 서버·클라 동일 문자열 */
export const PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE = '펫 인벤토리 공간이 부족합니다.';

/** 일반 부화 슬롯 수 (1~4번) */
export const PAIR_HATCHERY_REGULAR_SLOT_COUNT = 4;

/** VIP 전용 슬롯 인덱스(0부터, 5번째 칸) */
export const PAIR_HATCHERY_VIP_SLOT_INDEX = 4;

/** 세션 배열 길이: 일반 4 + VIP 1 */
export const PAIR_HATCHERY_SESSION_SLOT_COUNT = 5;

export type PairHatcheryLevelRule =
    | { kind: 'default' }
    | { kind: 'random'; min: number; max: number }
    | { kind: 'fixed'; level: number };

export type PairHatcherySlotDef = {
    slotIndex: number;
    /** UI용 */
    displayNumber: 1 | 2 | 3 | 4 | 'vip';
    durationMs: number;
    /** 일반 2~4번: 페어 승리 누적 필요. 1번·VIP는 0 */
    unlockWinsRequired: number;
    /** 일반 2~4번: 골드 지불로 해금. 1번·VIP는 0 */
    unlockGold: number;
    /** VIP 슬롯만 true — 기능 VIP 활성 시 사용 가능 */
    requiresFunctionVip: boolean;
    levelRule: PairHatcheryLevelRule;
};

export const PAIR_HATCHERY_SLOT_DEFS: PairHatcherySlotDef[] = [
    {
        slotIndex: 0,
        displayNumber: 1,
        durationMs: 60 * 60 * 1000,
        unlockWinsRequired: 0,
        unlockGold: 0,
        requiresFunctionVip: false,
        levelRule: { kind: 'default' },
    },
    {
        slotIndex: 1,
        displayNumber: 2,
        durationMs: 60 * 60 * 1000,
        unlockWinsRequired: 30,
        unlockGold: 10_000,
        requiresFunctionVip: false,
        levelRule: { kind: 'default' },
    },
    {
        slotIndex: 2,
        displayNumber: 3,
        durationMs: 50 * 60 * 1000,
        unlockWinsRequired: 150,
        unlockGold: 25_000,
        requiresFunctionVip: false,
        levelRule: { kind: 'random', min: 1, max: 5 },
    },
    {
        slotIndex: 3,
        displayNumber: 4,
        durationMs: 40 * 60 * 1000,
        unlockWinsRequired: 350,
        unlockGold: 50_000,
        requiresFunctionVip: false,
        levelRule: { kind: 'random', min: 3, max: 8 },
    },
    {
        slotIndex: 4,
        displayNumber: 'vip',
        durationMs: 30 * 60 * 1000,
        unlockWinsRequired: 0,
        unlockGold: 0,
        requiresFunctionVip: true,
        levelRule: { kind: 'fixed', level: 10 },
    },
];

export function getPairHatcherySlotDef(slotIndex: number): PairHatcherySlotDef | undefined {
    return PAIR_HATCHERY_SLOT_DEFS[slotIndex];
}

export function hatcheryEndsAt(startedAt: number, slotIndex: number): number {
    const def = getPairHatcherySlotDef(slotIndex);
    if (!def) return startedAt;
    return startedAt + def.durationMs;
}

/** 일반 슬롯 0~3 해금 여부 (0번은 항상 true) */
export function normalizePairPetHatcherySlotUnlocked(raw: boolean[] | null | undefined): boolean[] {
    const out = [true, false, false, false];
    if (!Array.isArray(raw)) return out;
    for (let i = 0; i < PAIR_HATCHERY_REGULAR_SLOT_COUNT; i += 1) {
        if (i === 0) continue;
        out[i] = Boolean(raw[i]);
    }
    return out;
}

export function normalizePairPetHatcherySessions(
    raw: (PairPetHatcherySession | null | undefined)[] | null | undefined
): (PairPetHatcherySession | null)[] {
    const out: (PairPetHatcherySession | null)[] = Array(PAIR_HATCHERY_SESSION_SLOT_COUNT).fill(null);
    if (!Array.isArray(raw)) return out;
    for (let i = 0; i < PAIR_HATCHERY_SESSION_SLOT_COUNT; i += 1) {
        const cell = raw[i];
        if (!cell || typeof cell !== 'object') continue;
        const slotIndex = Math.floor(Number((cell as PairPetHatcherySession).slotIndex));
        const startedAt = Number((cell as PairPetHatcherySession).startedAt);
        if (slotIndex !== i || !Number.isFinite(startedAt) || startedAt <= 0) continue;
        const eggRaw = (cell as PairPetHatcherySession).eggItemId;
        const eggItemId = typeof eggRaw === 'string' && eggRaw.length > 0 ? eggRaw : undefined;
        out[i] = eggItemId ? { slotIndex: i, startedAt, eggItemId } : { slotIndex: i, startedAt };
    }
    return out;
}

export function rollHatchPetLevelFromRule(rule: PairHatcheryLevelRule): number {
    if (rule.kind === 'default') return 1;
    if (rule.kind === 'fixed')
        return Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(rule.level)));
    const lo = Math.min(rule.min, rule.max);
    const hi = Math.max(rule.min, rule.max);
    const loC = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, lo));
    const hiC = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, hi));
    return loC + Math.floor(Math.random() * (hiC - loC + 1));
}

export function canUsePairHatcherySlot(user: User, slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= PAIR_HATCHERY_SESSION_SLOT_COUNT) return false;
    const def = getPairHatcherySlotDef(slotIndex);
    if (!def) return false;
    if (def.requiresFunctionVip) return isFunctionVipActive(user);
    const unlocked = normalizePairPetHatcherySlotUnlocked(user.pairPetHatcherySlotUnlocked);
    return Boolean(unlocked[slotIndex]);
}

export function canUnlockPairHatcherySlot(user: User, slotIndex: number): { ok: boolean; reason?: string } {
    if (slotIndex <= 0 || slotIndex >= PAIR_HATCHERY_REGULAR_SLOT_COUNT) {
        return { ok: false, reason: '해금할 수 없는 슬롯입니다.' };
    }
    const def = getPairHatcherySlotDef(slotIndex);
    if (!def || def.requiresFunctionVip) return { ok: false, reason: '해금할 수 없는 슬롯입니다.' };
    const unlocked = normalizePairPetHatcherySlotUnlocked(user.pairPetHatcherySlotUnlocked);
    if (unlocked[slotIndex]) return { ok: false, reason: '이미 해금된 슬롯입니다.' };
    const wins = getPairWins(user);
    if (wins < def.unlockWinsRequired) {
        return { ok: false, reason: `페어 승리 ${def.unlockWinsRequired}회가 필요합니다.` };
    }
    if (!user.isAdmin && (user.gold ?? 0) < def.unlockGold) {
        return { ok: false, reason: '골드가 부족합니다.' };
    }
    return { ok: true };
}
