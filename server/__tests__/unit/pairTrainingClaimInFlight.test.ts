import { describe, expect, it, beforeEach } from 'vitest';
import {
    awaitPairTrainingClaimSettled,
    clearPairTrainingClaimCompleted,
    markPairTrainingClaimCompleted,
    pairTrainingClaimCompletedBySlotIndex,
    pairTrainingClaimInFlightBySlotIndex,
    PAIR_TRAINING_CLAIM_ALREADY_CLAIMED_ERROR,
} from '../../../components/pair/pairTrainingClaimInFlight.js';

describe('awaitPairTrainingClaimSettled', () => {
    beforeEach(() => {
        pairTrainingClaimInFlightBySlotIndex.clear();
        pairTrainingClaimCompletedBySlotIndex.clear();
    });

    it('skips duplicate claim when slot already settled', async () => {
        markPairTrainingClaimCompleted(2);
        let claimCalls = 0;
        const result = await awaitPairTrainingClaimSettled(2, {
            petItemId: 'pet-a',
            commitClaim: async () => {
                claimCalls += 1;
                return {};
            },
            getTrainingSlots: () => [null, null, null, null, null, null],
        });
        expect(claimCalls).toBe(0);
        expect(result.error).toBeUndefined();
    });

    it('treats already-claimed server error as success', async () => {
        clearPairTrainingClaimCompleted(1);
        const result = await awaitPairTrainingClaimSettled(1, {
            petItemId: 'pet-a',
            commitClaim: async () => ({ error: PAIR_TRAINING_CLAIM_ALREADY_CLAIMED_ERROR }),
            getTrainingSlots: () => [
                null,
                { slotIndex: 1, itemId: 'pet-a', startedAt: Date.now() },
                null,
                null,
                null,
                null,
            ],
        });
        expect(result.error).toBeUndefined();
        expect(pairTrainingClaimCompletedBySlotIndex.has(1)).toBe(true);
    });
});
