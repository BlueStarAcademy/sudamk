import {
    normalizePairPetTrainingSlots,
    PAIR_TRAINING_SLOT_COUNT,
} from '../constants/pairTraining.js';
import type { PairPetTrainingSlotState } from '../types/entities.js';

/**
 * 수령(CLAIM) 응답이 재수련(START) 직후 늦게 도착할 때 빈 슬롯으로 덮어쓰는 레이스 완화.
 */
export function mergePairPetTrainingSlotsPreserveRecentRestart(
    baseSlots: PairPetTrainingSlotState[] | null | undefined,
    patchSlots: PairPetTrainingSlotState[] | null | undefined,
    now = Date.now(),
    preserveWindowMs = 15_000,
): PairPetTrainingSlotState[] {
    const base = normalizePairPetTrainingSlots(baseSlots);
    const patch = normalizePairPetTrainingSlots(patchSlots);
    const out = [...patch];
    for (let i = 0; i < PAIR_TRAINING_SLOT_COUNT; i++) {
        if (patch[i] == null && base[i]?.startedAt != null) {
            const startedAt = base[i]!.startedAt;
            if (now - startedAt < preserveWindowMs) {
                out[i] = base[i]!;
            }
        }
    }
    return out;
}

/** 수련 시작·재수련 낙관 UI — 롤백용 스냅샷과 함께 반환 */
export function buildOptimisticPairPetTrainingStartUpdate(
    currentSlots: PairPetTrainingSlotState[] | null | undefined,
    slotIndex: number,
    itemId: string,
    startedAt = Date.now(),
): {
    nextSlots: PairPetTrainingSlotState[];
    prevSlotsSnapshot: PairPetTrainingSlotState[];
} {
    const prevSlots = normalizePairPetTrainingSlots(currentSlots);
    const prevSlotsSnapshot = [...prevSlots] as PairPetTrainingSlotState[];
    const nextSlots = [...prevSlots] as PairPetTrainingSlotState[];
    nextSlots[slotIndex] = { slotIndex, itemId, startedAt };
    return { nextSlots, prevSlotsSnapshot };
}
