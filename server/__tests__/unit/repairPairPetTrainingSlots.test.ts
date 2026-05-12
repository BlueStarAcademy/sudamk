import { describe, expect, it } from 'vitest';
import type { User } from '../../../types/index.js';
import { PAIR_TRAINING_SLOT_COUNT, normalizePairPetTrainingSlots } from '../../../shared/constants/pairTraining.js';
import { repairInProgressGhostPairPetTrainingSessions } from '../../utils/repairPairPetTrainingSlots.js';

function baseUser(overrides: Partial<User> = {}): User {
    return {
        id: 'u1',
        inventory: [],
        pairPetTrainingSlots: Array(PAIR_TRAINING_SLOT_COUNT).fill(null),
        ...overrides,
    } as User;
}

describe('repairInProgressGhostPairPetTrainingSessions', () => {
    it('clears in-progress session when pet is missing from inventory', () => {
        const now = Date.now();
        const user = baseUser({
            inventory: [],
            pairPetTrainingSlots: normalizePairPetTrainingSlots([
                { slotIndex: 0, itemId: 'gone-pet', startedAt: now },
                ...Array(PAIR_TRAINING_SLOT_COUNT - 1).fill(null),
            ]),
        });
        expect(repairInProgressGhostPairPetTrainingSessions(user)).toBe(true);
        expect(user.pairPetTrainingSlots![0]).toBeNull();
    });

    it('keeps completed session when pet is missing (claim path)', () => {
        const startedAt = Date.now() - 86400_000 * 30;
        const user = baseUser({
            inventory: [],
            pairPetTrainingSlots: normalizePairPetTrainingSlots([
                { slotIndex: 0, itemId: 'gone-pet', startedAt },
                ...Array(PAIR_TRAINING_SLOT_COUNT - 1).fill(null),
            ]),
        });
        expect(repairInProgressGhostPairPetTrainingSessions(user)).toBe(false);
        expect(user.pairPetTrainingSlots![0]?.itemId).toBe('gone-pet');
    });
});
