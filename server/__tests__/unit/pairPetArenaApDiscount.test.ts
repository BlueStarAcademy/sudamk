import { describe, expect, it } from 'vitest';
import {
    apCostAfterPairPetArenaDiscount,
    effectiveStrategicRankedQueueApCostForUser,
    trainingSoulBonusQuantityFromMeta,
} from '../../../shared/utils/pairPetArenaApDiscount.js';
import { STRATEGIC_ACTION_POINT_COST } from '../../../shared/constants/rules.js';
import type { User } from '../../../shared/types/entities.js';

describe('pairPetArenaApDiscount', () => {
    it('applies strategic -1 when specialization matches strategic lobby', () => {
        const u = {
            inventory: [],
            equippedPairPetTemplateId: null,
            equippedPairPetInventoryItemId: null,
        } as unknown as User;
        expect(effectiveStrategicRankedQueueApCostForUser(u)).toBe(STRATEGIC_ACTION_POINT_COST);
    });

    it('trainingSoulQuantityPlusOne adds bonus flag', () => {
        expect(
            trainingSoulBonusQuantityFromMeta({ specialization: { kind: 'trainingSoulQuantityPlusOne' } } as any),
        ).toBe(1);
        expect(trainingSoulBonusQuantityFromMeta({ specialization: { kind: 'soulDrop', pct: 10 } } as any)).toBe(0);
    });

    it('clamps ap at zero', () => {
        expect(apCostAfterPairPetArenaDiscount(1, 'strategic', { kind: 'strategicArenaApMinusOne' })).toBe(0);
    });
});
