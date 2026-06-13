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

    it('does not restore claim-ready sessions when base slot was already cleared', () => {
        const now = 2_000_000;
        const claimReadySession = { slotIndex: 1, itemId: 'pet-2', startedAt: now - 3_600_000 };
        const base = [null, null, null, null, null, null];
        const patch = [null, claimReadySession, null, null, null, null];
        const merged = mergePairPetTrainingSlotsPreserveRecentRestart(base, patch, now, 15_000);
        expect(merged[1]).toBeNull();
    });

    it('still accepts in-progress sessions when base slot is empty', () => {
        const now = 2_000_000;
        const inProgressSession = { slotIndex: 0, itemId: 'pet-1', startedAt: now - 60_000 };
        const base = [null, null, null, null, null, null];
        const patch = [inProgressSession, null, null, null, null, null];
        const merged = mergePairPetTrainingSlotsPreserveRecentRestart(base, patch, now, 15_000);
        expect(merged[0]).toEqual(inProgressSession);
    });

    it('respects client-claimed slot indices over stale claim-ready sessions', () => {
        const now = 2_000_000;
        const claimReadySession = { slotIndex: 0, itemId: 'pet-1', startedAt: now - 3_600_000 };
        const base = [null, null, null, null, null, null];
        const patch = [claimReadySession, null, null, null, null, null];
        const merged = mergePairPetTrainingSlotsPreserveRecentRestart(base, patch, now, 15_000, new Set([0]));
        expect(merged[0]).toBeNull();
    });

    it('keeps fresh in-progress sessions when client-claimed slot index is still set', () => {
        const now = 2_000_000;
        const inProgressSession = { slotIndex: 0, itemId: 'pet-1', startedAt: now - 5_000 };
        const base = [null, null, null, null, null, null];
        const patch = [inProgressSession, null, null, null, null, null];
        const merged = mergePairPetTrainingSlotsPreserveRecentRestart(base, patch, now, 15_000, new Set([0]));
        expect(merged[0]).toEqual(inProgressSession);
    });
});
