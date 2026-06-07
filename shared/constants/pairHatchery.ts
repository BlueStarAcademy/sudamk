import { getPairWins } from './pairTraining.js';
import { PAIR_PET_MAX_LEVEL } from './pairPetGrade.js';
import { isFunctionVipActive } from '../utils/rewardVip.js';
import type { PairPetHatcherySession, User } from '../types/entities.js';
import { PAIR_WELCOME_EGG_TEMPLATE_ID } from './petLobby.js';

/** 부화 펫 수령·즉시 완료 시 펫 로비 인벤 슬롯 부족 — 서버·클라 동일 문자열 */
export const PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE = '펫 인벤토리 공간이 부족합니다.';

/** 기본 부화 슬롯(1번) */
export const PAIR_HATCHERY_MAIN_SLOT_INDEX = 0;

/** VIP 전용 부화 슬롯 인덱스 */
export const PAIR_HATCHERY_VIP_SLOT_INDEX = 1;

/** 세션 배열 길이: 기본 1 + VIP 1 */
export const PAIR_HATCHERY_SESSION_SLOT_COUNT = 2;

/** 1번 슬롯 강화 단계 수 (구 2~4번 슬롯 혜택) */
export const PAIR_HATCHERY_UPGRADE_TIER_COUNT = 3;

/** @deprecated 슬롯 수가 아닌 강화 단계 수 — 호환용 */
export const PAIR_HATCHERY_REGULAR_SLOT_COUNT = PAIR_HATCHERY_UPGRADE_TIER_COUNT;

export type PairHatcheryLevelRule =
    | { kind: 'default' }
    | { kind: 'random'; min: number; max: number }
    | { kind: 'fixed'; level: number };

export type PairHatcheryUpgradeTierDef = {
    /** 1~3 (구 부화장 2~4번에 대응) */
    tierIndex: 1 | 2 | 3;
    displayLabel: string;
    durationMs: number;
    unlockWinsRequired: number;
    unlockGold: number;
    levelRule: PairHatcheryLevelRule;
};

/** 1번 슬롯 기본(강화 없음) */
export const PAIR_HATCHERY_BASE_MAIN = {
    durationMs: 60 * 60 * 1000,
    levelRule: { kind: 'default' as const },
};

export const PAIR_HATCHERY_UPGRADE_TIER_DEFS: PairHatcheryUpgradeTierDef[] = [
    {
        tierIndex: 1,
        displayLabel: '강화 I',
        durationMs: 60 * 60 * 1000,
        unlockWinsRequired: 30,
        unlockGold: 10_000,
        levelRule: { kind: 'random', min: 1, max: 3 },
    },
    {
        tierIndex: 2,
        displayLabel: '강화 II',
        durationMs: 50 * 60 * 1000,
        unlockWinsRequired: 150,
        unlockGold: 25_000,
        levelRule: { kind: 'random', min: 2, max: 5 },
    },
    {
        tierIndex: 3,
        displayLabel: '강화 III',
        durationMs: 40 * 60 * 1000,
        unlockWinsRequired: 350,
        unlockGold: 50_000,
        levelRule: { kind: 'random', min: 3, max: 8 },
    },
];

export const PAIR_HATCHERY_VIP_SLOT_DEF = {
    durationMs: 30 * 60 * 1000,
    requiresFunctionVip: true,
    levelRule: { kind: 'fixed', level: 10 } as PairHatcheryLevelRule,
};

/** UI·레거시 호환 — 세션 슬롯 정의(기본·VIP만) */
export type PairHatcherySlotDef = {
    slotIndex: number;
    displayNumber: 1 | 'vip';
    durationMs: number;
    unlockWinsRequired: number;
    unlockGold: number;
    requiresFunctionVip: boolean;
    levelRule: PairHatcheryLevelRule;
};

export const PAIR_HATCHERY_SESSION_SLOT_DEFS: PairHatcherySlotDef[] = [
    {
        slotIndex: PAIR_HATCHERY_MAIN_SLOT_INDEX,
        displayNumber: 1,
        durationMs: PAIR_HATCHERY_BASE_MAIN.durationMs,
        unlockWinsRequired: 0,
        unlockGold: 0,
        requiresFunctionVip: false,
        levelRule: PAIR_HATCHERY_BASE_MAIN.levelRule,
    },
    {
        slotIndex: PAIR_HATCHERY_VIP_SLOT_INDEX,
        displayNumber: 'vip',
        durationMs: PAIR_HATCHERY_VIP_SLOT_DEF.durationMs,
        unlockWinsRequired: 0,
        unlockGold: 0,
        requiresFunctionVip: true,
        levelRule: PAIR_HATCHERY_VIP_SLOT_DEF.levelRule,
    },
];

/** @deprecated `PAIR_HATCHERY_SESSION_SLOT_DEFS` 사용 */
export const PAIR_HATCHERY_SLOT_DEFS = PAIR_HATCHERY_SESSION_SLOT_DEFS;

export function getPairHatcheryUpgradeTierDef(tierIndex: number): PairHatcheryUpgradeTierDef | undefined {
    return PAIR_HATCHERY_UPGRADE_TIER_DEFS.find((d) => d.tierIndex === tierIndex);
}

/** `pairPetHatcherySlotUnlocked` — 강화 I~III 해금 여부 `[tier1, tier2, tier3]` */
export function normalizePairPetHatcheryUpgradeTiers(raw: boolean[] | null | undefined): boolean[] {
    const out = [false, false, false];
    if (!Array.isArray(raw)) return out;
    if (raw.length === PAIR_HATCHERY_UPGRADE_TIER_COUNT) {
        for (let i = 0; i < PAIR_HATCHERY_UPGRADE_TIER_COUNT; i += 1) out[i] = Boolean(raw[i]);
        return out;
    }
    /** 레거시: `[true, slot2, slot3, slot4]` 또는 `[true, …]` 4칸 슬롯 해금 */
    if (raw.length >= 4) {
        out[0] = Boolean(raw[1]);
        out[1] = Boolean(raw[2]);
        out[2] = Boolean(raw[3]);
        return out;
    }
    for (let i = 0; i < Math.min(PAIR_HATCHERY_UPGRADE_TIER_COUNT, raw.length); i += 1) {
        out[i] = Boolean(raw[i]);
    }
    return out;
}

/** DB 필드명 호환 */
export const normalizePairPetHatcherySlotUnlocked = normalizePairPetHatcheryUpgradeTiers;

export function getPairHatcheryHighestUpgradeTier(user: User): number {
    const tiers = normalizePairPetHatcheryUpgradeTiers(user.pairPetHatcherySlotUnlocked);
    let highest = 0;
    for (let i = 0; i < PAIR_HATCHERY_UPGRADE_TIER_COUNT; i += 1) {
        if (tiers[i]) highest = i + 1;
    }
    return highest;
}

export function getPairHatcheryMainSlotEffectiveDef(user: User): {
    durationMs: number;
    levelRule: PairHatcheryLevelRule;
    upgradeTier: number;
    upgradeLabel: string | null;
} {
    const highest = getPairHatcheryHighestUpgradeTier(user);
    if (highest <= 0) {
        return {
            durationMs: PAIR_HATCHERY_BASE_MAIN.durationMs,
            levelRule: PAIR_HATCHERY_BASE_MAIN.levelRule,
            upgradeTier: 0,
            upgradeLabel: null,
        };
    }
    const tierDef = getPairHatcheryUpgradeTierDef(highest)!;
    return {
        durationMs: tierDef.durationMs,
        levelRule: tierDef.levelRule,
        upgradeTier: highest,
        upgradeLabel: tierDef.displayLabel,
    };
}

export function getPairHatcherySlotDef(slotIndex: number, user?: User | null): PairHatcherySlotDef | undefined {
    if (slotIndex === PAIR_HATCHERY_MAIN_SLOT_INDEX) {
        const eff = user ? getPairHatcheryMainSlotEffectiveDef(user) : null;
        return {
            slotIndex: PAIR_HATCHERY_MAIN_SLOT_INDEX,
            displayNumber: 1,
            durationMs: eff?.durationMs ?? PAIR_HATCHERY_BASE_MAIN.durationMs,
            unlockWinsRequired: 0,
            unlockGold: 0,
            requiresFunctionVip: false,
            levelRule: eff?.levelRule ?? PAIR_HATCHERY_BASE_MAIN.levelRule,
        };
    }
    if (slotIndex === PAIR_HATCHERY_VIP_SLOT_INDEX) {
        return PAIR_HATCHERY_SESSION_SLOT_DEFS[1];
    }
    return undefined;
}

export function getPairHatcheryDurationMs(
    slotIndex: number,
    session?: Pick<PairPetHatcherySession, 'eggTemplateId'> | null,
    user?: User | null,
): number {
    if (session?.eggTemplateId === PAIR_WELCOME_EGG_TEMPLATE_ID) {
        return 60 * 1000;
    }
    if (slotIndex === PAIR_HATCHERY_MAIN_SLOT_INDEX) {
        return user
            ? getPairHatcheryMainSlotEffectiveDef(user).durationMs
            : PAIR_HATCHERY_BASE_MAIN.durationMs;
    }
    if (slotIndex === PAIR_HATCHERY_VIP_SLOT_INDEX) {
        return PAIR_HATCHERY_VIP_SLOT_DEF.durationMs;
    }
    return 0;
}

export function hatcheryEndsAt(
    startedAt: number,
    slotIndex: number,
    session?: Pick<PairPetHatcherySession, 'eggTemplateId'> | null,
    user?: User | null,
): number {
    return startedAt + getPairHatcheryDurationMs(slotIndex, session, user);
}

function normalizeHatcherySessionCell(
    cell: PairPetHatcherySession | null | undefined,
    outputSlotIndex: number,
    sourceArrayIndex?: number,
): PairPetHatcherySession | null {
    if (!cell || typeof cell !== 'object') return null;
    const startedAt = Number(cell.startedAt);
    if (!Number.isFinite(startedAt) || startedAt <= 0) return null;
    const eggRaw = cell.eggItemId;
    const eggItemId = typeof eggRaw === 'string' && eggRaw.length > 0 ? eggRaw : undefined;
    const tidRaw = cell.eggTemplateId;
    const eggTemplateId = typeof tidRaw === 'string' && tidRaw.length > 0 ? tidRaw : undefined;
    const rawSlot = cell.slotIndex;
    const hasExplicitSlot = typeof rawSlot === 'number' && Number.isFinite(Number(rawSlot));
    /** `slotIndex` 누락 시 배열 위치(0·1)를 신뢰 — VIP 행이 1번 슬롯으로 밀리는 현상 방지 */
    const fromCell = hasExplicitSlot
        ? normalizePairHatcherySessionSlotIndex(Number(rawSlot))
        : sourceArrayIndex != null && isPairHatcherySessionSlotIndex(sourceArrayIndex)
          ? sourceArrayIndex
          : PAIR_HATCHERY_MAIN_SLOT_INDEX;
    const isLegacyMainCoalesce =
        outputSlotIndex === PAIR_HATCHERY_MAIN_SLOT_INDEX &&
        sourceArrayIndex != null &&
        sourceArrayIndex >= 1 &&
        sourceArrayIndex <= 3;
    const resolvedSlotIndex = isLegacyMainCoalesce
        ? PAIR_HATCHERY_MAIN_SLOT_INDEX
        : fromCell === PAIR_HATCHERY_MAIN_SLOT_INDEX || fromCell === PAIR_HATCHERY_VIP_SLOT_INDEX
          ? fromCell
          : outputSlotIndex;
    const base: PairPetHatcherySession = eggItemId
        ? { slotIndex: resolvedSlotIndex, startedAt, eggItemId }
        : { slotIndex: resolvedSlotIndex, startedAt };
    if (eggTemplateId) base.eggTemplateId = eggTemplateId;
    return base;
}

function readHatcherySessionCell(
    raw: (PairPetHatcherySession | null | undefined)[],
    index: number,
): PairPetHatcherySession | null | undefined {
    return index >= 0 && index < raw.length ? raw[index] : undefined;
}

export function normalizePairPetHatcherySessions(
    raw: (PairPetHatcherySession | null | undefined)[] | null | undefined,
): (PairPetHatcherySession | null)[] {
    const out: (PairPetHatcherySession | null)[] = Array(PAIR_HATCHERY_SESSION_SLOT_COUNT).fill(null);
    if (!Array.isArray(raw)) return out;

    const legacyVip =
        raw.length >= 5
            ? normalizeHatcherySessionCell(
                  readHatcherySessionCell(raw, 4),
                  PAIR_HATCHERY_VIP_SLOT_INDEX,
                  4,
              )
            : null;
    const newLayoutVip = normalizeHatcherySessionCell(
        readHatcherySessionCell(raw, PAIR_HATCHERY_VIP_SLOT_INDEX),
        PAIR_HATCHERY_VIP_SLOT_INDEX,
        PAIR_HATCHERY_VIP_SLOT_INDEX,
    );

    /** 신규 2칸 배열·VIP가 1번 인덱스에만 있는 경우(레거시 5칸의 4번과 중복 없음).
     *  인덱스 4에 남은 레거시 VIP와 공존할 때는 더 최신 세션(보통 신규 VIP)을 우선한다. */
    const useNewTwoSlotLayout =
        raw.length <= PAIR_HATCHERY_SESSION_SLOT_COUNT ||
        (newLayoutVip != null &&
            (legacyVip == null || (newLayoutVip.startedAt ?? 0) >= (legacyVip.startedAt ?? 0)));

    if (useNewTwoSlotLayout) {
        for (let i = 0; i < raw.length; i += 1) {
            const cell = normalizeHatcherySessionCell(readHatcherySessionCell(raw, i), i, i);
            if (!cell) continue;
            const placeAt = cell.slotIndex;
            if (
                placeAt >= 0 &&
                placeAt < PAIR_HATCHERY_SESSION_SLOT_COUNT &&
                out[placeAt] == null
            ) {
                out[placeAt] = cell;
            }
        }
        return out;
    }

    /** 레거시 5칸 → 기본 슬롯 + VIP */
    const legacyMain =
        normalizeHatcherySessionCell(
            readHatcherySessionCell(raw, PAIR_HATCHERY_MAIN_SLOT_INDEX),
            PAIR_HATCHERY_MAIN_SLOT_INDEX,
            PAIR_HATCHERY_MAIN_SLOT_INDEX,
        ) ??
        normalizeHatcherySessionCell(readHatcherySessionCell(raw, 1), PAIR_HATCHERY_MAIN_SLOT_INDEX, 1) ??
        normalizeHatcherySessionCell(readHatcherySessionCell(raw, 2), PAIR_HATCHERY_MAIN_SLOT_INDEX, 2) ??
        normalizeHatcherySessionCell(readHatcherySessionCell(raw, 3), PAIR_HATCHERY_MAIN_SLOT_INDEX, 3);
    out[PAIR_HATCHERY_MAIN_SLOT_INDEX] = legacyMain;
    out[PAIR_HATCHERY_VIP_SLOT_INDEX] = legacyVip;

    return out;
}

/** 부화 보상·타이머에 쓸 슬롯 — 세션에 기록된 slotIndex를 우선(배열 위치와 어긋난 레거시 보정) */
export function resolvePairHatcheryRewardSlotIndex(
    session: PairPetHatcherySession,
    arrayIndex: number,
): number {
    const fromSession = normalizePairHatcherySessionSlotIndex(session.slotIndex);
    if (isPairHatcherySessionSlotIndex(fromSession)) return fromSession;
    const fromArray = normalizePairHatcherySessionSlotIndex(arrayIndex);
    return isPairHatcherySessionSlotIndex(fromArray) ? fromArray : PAIR_HATCHERY_MAIN_SLOT_INDEX;
}

export function findPairHatcherySessionAtSlot(
    sessions: (PairPetHatcherySession | null)[],
    requestedSlotIndex: number,
): { arrayIndex: number; session: PairPetHatcherySession; rewardSlotIndex: number } | null {
    const requested = normalizePairHatcherySessionSlotIndex(requestedSlotIndex);
    if (!isPairHatcherySessionSlotIndex(requested)) return null;

    const direct = sessions[requested];
    if (direct) {
        return {
            arrayIndex: requested,
            session: direct,
            rewardSlotIndex: resolvePairHatcheryRewardSlotIndex(direct, requested),
        };
    }

    for (let i = 0; i < sessions.length; i += 1) {
        const cell = sessions[i];
        if (!cell) continue;
        const rewardSlotIndex = resolvePairHatcheryRewardSlotIndex(cell, i);
        if (rewardSlotIndex === requested) {
            return { arrayIndex: i, session: cell, rewardSlotIndex };
        }
    }
    return null;
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
    if (slotIndex === PAIR_HATCHERY_MAIN_SLOT_INDEX) return true;
    if (slotIndex === PAIR_HATCHERY_VIP_SLOT_INDEX) return isFunctionVipActive(user);
    return false;
}

/** `tierIndex` 1~3 — 구 API `slotIndex` 1~3(2~4번 슬롯)과 동일 */
export function canUnlockPairHatcheryUpgrade(
    user: User,
    tierIndex: number,
): { ok: boolean; reason?: string } {
    if (tierIndex < 1 || tierIndex > PAIR_HATCHERY_UPGRADE_TIER_COUNT) {
        return { ok: false, reason: '강화할 수 없는 단계입니다.' };
    }
    const def = getPairHatcheryUpgradeTierDef(tierIndex);
    if (!def) return { ok: false, reason: '강화할 수 없는 단계입니다.' };
    const tiers = normalizePairPetHatcheryUpgradeTiers(user.pairPetHatcherySlotUnlocked);
    if (tiers[tierIndex - 1]) return { ok: false, reason: '이미 적용된 강화입니다.' };
    const wins = getPairWins(user);
    if (wins < def.unlockWinsRequired) {
        return { ok: false, reason: `페어 승리 ${def.unlockWinsRequired}회가 필요합니다.` };
    }
    if (!user.isAdmin && (user.gold ?? 0) < def.unlockGold) {
        return { ok: false, reason: '골드가 부족합니다.' };
    }
    return { ok: true };
}

/** @deprecated `canUnlockPairHatcheryUpgrade` — payload `slotIndex` 1~3 */
export function canUnlockPairHatcherySlot(user: User, slotIndex: number): { ok: boolean; reason?: string } {
    return canUnlockPairHatcheryUpgrade(user, slotIndex);
}

export function isPairHatcherySessionSlotIndex(slotIndex: number): boolean {
    return slotIndex === PAIR_HATCHERY_MAIN_SLOT_INDEX || slotIndex === PAIR_HATCHERY_VIP_SLOT_INDEX;
}

/** 레거시 VIP 슬롯 인덱스(4) → 현재 VIP 인덱스(1) */
export function normalizePairHatcherySessionSlotIndex(raw: number): number {
    const si = Math.floor(Number(raw));
    if (!Number.isFinite(si)) return PAIR_HATCHERY_MAIN_SLOT_INDEX;
    if (si === 4) return PAIR_HATCHERY_VIP_SLOT_INDEX;
    return si;
}
