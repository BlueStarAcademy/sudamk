import {
    normalizePairPetTrainingSlots,
    PAIR_TRAINING_SLOT_COUNT,
    trainingEndsAt,
} from '../constants/pairTraining.js';
import type { PairPetTrainingSlotState } from '../types/entities.js';

function isClaimReadyTrainingSession(
    session: PairPetTrainingSlotState,
    slotIndex: number,
    now: number,
): boolean {
    return now >= trainingEndsAt(session.startedAt, slotIndex, undefined);
}

/**
 * 수령(CLAIM) 응답이 재수련(START) 직후 늦게 도착할 때 빈 슬롯으로 덮어쓰는 레이스 완화.
 * 또한 슬롯을 연속 수령할 때 이전 CLAIM 응답이 다른 슬롯의 수련완료 세션을 되살리지 않게 한다.
 */
export function mergePairPetTrainingSlotsPreserveRecentRestart(
    baseSlots: PairPetTrainingSlotState[] | null | undefined,
    patchSlots: PairPetTrainingSlotState[] | null | undefined,
    now = Date.now(),
    preserveWindowMs = 15_000,
    clientClaimedSlotIndices?: ReadonlySet<number>,
): PairPetTrainingSlotState[] {
    const base = normalizePairPetTrainingSlots(baseSlots);
    const patch = normalizePairPetTrainingSlots(patchSlots);
    const out = [...patch];
    for (let i = 0; i < PAIR_TRAINING_SLOT_COUNT; i++) {
        const baseSession = base[i];
        const patchSession = patch[i];

        if (patchSession == null && baseSession?.startedAt != null) {
            const startedAt = baseSession.startedAt;
            if (now - startedAt < preserveWindowMs) {
                out[i] = baseSession;
            }
            continue;
        }

        if (baseSession == null && patchSession != null) {
            if (clientClaimedSlotIndices?.has(i)) {
                out[i] = null;
                continue;
            }
            if (isClaimReadyTrainingSession(patchSession, i, now)) {
                out[i] = null;
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
