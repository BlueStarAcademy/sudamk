import { describe, expect, it } from 'vitest';
import {
    buildOptimisticPairPetTrainingStartUpdate,
    mergePairPetTrainingSlotsPreserveRecentRestart,
} from '../../../shared/utils/pairPetTrainingSlotsClientMerge.js';

describe('mergePairPetTrainingSlotsPreserveRecentRestart', () => {
    it('preserves a recently restarted slot when patch clears it', () => {
        const now = 1_000_000;
        const base = [
            null,
            null,
            { slotIndex: 2, itemId: 'pet-1', startedAt: now - 2_000 },
            null,
            null,
            null,
        ];
        const patch = [null, null, null, null, null, null];
        const merged = mergePairPetTrainingSlotsPreserveRecentRestart(base, patch, now, 15_000);
        expect(merged[2]).toEqual(base[2]);
    });

    it('builds optimistic start slots with rollback snapshot', () => {
        const startedAt = 42;
        const { nextSlots, prevSlotsSnapshot } = buildOptimisticPairPetTrainingStartUpdate(
            [null, { slotIndex: 1, itemId: 'old', startedAt: 1 }, null, null, null, null],
            0,
            'pet-new',
            startedAt,
        );
        expect(nextSlots[0]).toEqual({ slotIndex: 0, itemId: 'pet-new', startedAt });
        expect(nextSlots[1]?.itemId).toBe('old');
        expect(prevSlotsSnapshot[0]).toBeNull();
        expect(prevSlotsSnapshot[1]?.itemId).toBe('old');
    });

    it('does not preserve an old cleared slot', () => {
        const now = 1_000_000;
        const base = [
            null,
            null,
            { slotIndex: 2, itemId: 'pet-1', startedAt: now - 60_000 },
            null,
            null,
            null,
        ];
        const patch = [null, null, null, null, null, null];
        const merged = mergePairPetTrainingSlotsPreserveRecentRestart(base, patch, now, 15_000);
        expect(merged[2]).toBeNull();
    });
});
