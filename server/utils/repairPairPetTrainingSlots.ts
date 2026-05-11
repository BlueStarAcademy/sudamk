import type { User } from '../../types/index.js';
import {
    PAIR_TRAINING_SLOT_COUNT,
    normalizePairPetTrainingSlots,
    trainingEndsAt,
} from '../../shared/constants/pairTraining.js';

/**
 * 인벤에 없는 펫을 가리키는 **진행 중** 수련 세션만 제거한다.
 * (펫 변환·삭제 등으로 itemId가 사라졌는데 슬롯만 남은 경우)
 *
 * 종료 시각이 지난 완료 대기 세션은 유지한다 — `PAIR_PET_CLAIM_TRAINING`이
 * 펫 없이도 골드 등 보상을 지급할 수 있다.
 */
export function repairInProgressGhostPairPetTrainingSessions(user: User): boolean {
    user.pairPetTrainingSlots = normalizePairPetTrainingSlots(user.pairPetTrainingSlots);
    const inv = user.inventory ?? [];
    let changed = false;
    for (let i = 0; i < PAIR_TRAINING_SLOT_COUNT; i += 1) {
        const session = user.pairPetTrainingSlots[i];
        if (!session) continue;
        if (inv.some((it) => it.id === session.itemId)) continue;
        const endAt = trainingEndsAt(session.startedAt, i, undefined);
        if (Date.now() < endAt) {
            user.pairPetTrainingSlots[i] = null;
            changed = true;
        }
    }
    return changed;
}
