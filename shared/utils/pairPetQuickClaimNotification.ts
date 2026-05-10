import type { User } from '../types/entities.js';
import {
    PAIR_TRAINING_SLOT_DEFS,
    isPairTrainingSlotUnlocked,
    normalizePairPetTrainingSlots,
    trainingEndsAt,
} from '../constants/pairTraining.js';
import {
    PAIR_HATCHERY_SLOT_DEFS,
    canUsePairHatcherySlot,
    hatcheryEndsAt,
    normalizePairPetHatcherySessions,
} from '../constants/pairHatchery.js';
import { resolvePairPetMetaFromInventoryRow } from './pairPetRoll.js';

/** 페어 펫 수련: 타이머 종료 후 보상 수령 가능(로비·퀵메뉴 알림 공통) */
export function hasPairPetTrainingClaimReadyForQuickMenu(user: User, now: number): boolean {
    const inventory = user.inventory || [];
    const slots = normalizePairPetTrainingSlots(user.pairPetTrainingSlots);
    for (const def of PAIR_TRAINING_SLOT_DEFS) {
        const i = def.slotIndex;
        if (!isPairTrainingSlotUnlocked(user, i)) continue;
        const session = slots[i];
        if (!session) continue;
        const petRowSess = inventory.find((x) => x.id === session.itemId);
        const sessMeta = petRowSess ? resolvePairPetMetaFromInventoryRow(petRowSess) : null;
        if (now < trainingEndsAt(session.startedAt, i, sessMeta)) continue;
        if (inventory.some((x) => x.id === session.itemId)) return true;
    }
    return false;
}

/** 부화장: 부화 시간 경과 후 펫 획득 가능(로비·퀵메뉴 알림 공통) */
export function hasPairPetHatcheryClaimReadyForQuickMenu(user: User, now: number): boolean {
    const sessions = normalizePairPetHatcherySessions(user.pairPetHatcherySessions);
    for (const def of PAIR_HATCHERY_SLOT_DEFS) {
        const idx = def.slotIndex;
        if (!canUsePairHatcherySlot(user, idx)) continue;
        const session = sessions[idx];
        if (!session) continue;
        if (now >= hatcheryEndsAt(session.startedAt, idx, session)) return true;
    }
    return false;
}

export function hasPairPetClaimReadyForQuickMenu(user: User, now: number): boolean {
    return hasPairPetTrainingClaimReadyForQuickMenu(user, now) || hasPairPetHatcheryClaimReadyForQuickMenu(user, now);
}

/**
 * 완료 대기 전 타이머가 도는 슬롯이 있으면 true.
 * 퀵메뉴 등에서 완료 시각 직후 붉은점이 뜨도록 1초 틱을 켤 때 사용.
 */
export function pairPetQuickMenuNeedsSecondTick(user: User, now: number): boolean {
    const inventory = user.inventory || [];
    const sessions = normalizePairPetHatcherySessions(user.pairPetHatcherySessions);
    for (const def of PAIR_HATCHERY_SLOT_DEFS) {
        const idx = def.slotIndex;
        if (!canUsePairHatcherySlot(user, idx)) continue;
        const session = sessions[idx];
        if (!session) continue;
        const end = hatcheryEndsAt(session.startedAt, idx, session);
        if (now < end) return true;
    }
    const slots = normalizePairPetTrainingSlots(user.pairPetTrainingSlots);
    for (const def of PAIR_TRAINING_SLOT_DEFS) {
        const i = def.slotIndex;
        if (!isPairTrainingSlotUnlocked(user, i)) continue;
        const session = slots[i];
        if (!session) continue;
        if (!inventory.some((x) => x.id === session.itemId)) continue;
        const petRowSess = inventory.find((x) => x.id === session.itemId);
        const sessMeta = petRowSess ? resolvePairPetMetaFromInventoryRow(petRowSess) : null;
        const end = trainingEndsAt(session.startedAt, i, sessMeta);
        if (now < end) return true;
    }
    return false;
}
