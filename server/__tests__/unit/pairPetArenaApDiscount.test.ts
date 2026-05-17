import { describe, expect, it } from 'vitest';
import {
    apCostAfterPairPetArenaDiscount,
    baseAiLobbyActionPointCostForModeAndSettings,
    effectiveStrategicRankedQueueApCostForUser,
    formatActionPointCostWithPetDiscount,
    trainingSoulBonusQuantityFromMeta,
} from '../../../shared/utils/pairPetArenaApDiscount.js';
import { baseAiLobbyActionPointCostForProfileStep } from '../../../shared/utils/strategicAiDifficulty.js';
import { STRATEGIC_ACTION_POINT_COST } from '../../../shared/constants/rules.js';
import { GameMode } from '../../../shared/types/enums.js';
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

    it('formatActionPointCostWithPetDiscount shows (-n) when discounted', () => {
        expect(formatActionPointCostWithPetDiscount(3, 2)).toBe('2 (-1)');
        expect(formatActionPointCostWithPetDiscount(5, 5)).toBe('5');
        expect(formatActionPointCostWithPetDiscount(5, 4)).toBe('4 (-1)');
    });

    it('baseAiLobbyActionPointCostForProfileStep tiers 1-3 / 4-7 / 8-10', () => {
        expect(baseAiLobbyActionPointCostForProfileStep(1)).toBe(3);
        expect(baseAiLobbyActionPointCostForProfileStep(3)).toBe(3);
        expect(baseAiLobbyActionPointCostForProfileStep(4)).toBe(4);
        expect(baseAiLobbyActionPointCostForProfileStep(7)).toBe(4);
        expect(baseAiLobbyActionPointCostForProfileStep(8)).toBe(5);
        expect(baseAiLobbyActionPointCostForProfileStep(10)).toBe(5);
    });

    it('baseAiLobbyActionPointCostForModeAndSettings uses aiDifficulty for strategic modes', () => {
        expect(
            baseAiLobbyActionPointCostForModeAndSettings(GameMode.Standard, { aiDifficulty: 2 }),
        ).toBe(3);
        expect(
            baseAiLobbyActionPointCostForModeAndSettings(GameMode.Standard, { aiDifficulty: 6 }),
        ).toBe(4);
        expect(
            baseAiLobbyActionPointCostForModeAndSettings(GameMode.Standard, { aiDifficulty: 9 }),
        ).toBe(5);
    });
});
