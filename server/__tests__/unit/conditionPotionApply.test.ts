import { describe, expect, it } from 'vitest';
import type { User } from '../../../types.js';
import {
    buildConditionPotionUserPatch,
    buildOptimisticConditionPotionPatch,
    consumeConditionPotionInventory,
    parseConditionPotionUseContext,
} from '../../../shared/conditionPotion/apply.js';
import { rollConditionPotionRecovery } from '../../../shared/constants/conditionPotion.js';

const baseUser = {
    id: 'u1',
    gold: 500,
    inventory: [{ id: 'p1', name: '컨디션 회복제(소)', type: 'consumable', quantity: 2 }],
    dungeonConditionSnapshot: {
        neighborhood: { condition: 40, dateStartOfDayKST: 1 },
    },
    lastNeighborhoodTournament: {
        type: 'neighborhood',
        players: [{ id: 'u1', condition: 40 }],
    },
} as unknown as User;

describe('conditionPotion apply', () => {
    it('parseConditionPotionUseContext accepts dungeon and versus payloads', () => {
        expect(parseConditionPotionUseContext({ potionType: 'small', tournamentType: 'neighborhood' })).toEqual({
            kind: 'dungeon',
            tournamentType: 'neighborhood',
        });
        expect(parseConditionPotionUseContext({ potionType: 'small', versusVenue: 'pvp' })).toEqual({
            kind: 'versus',
            venue: 'pvp',
        });
    });

    it('consumeConditionPotionInventory decrements quantity and removes last unit', () => {
        const stacked = consumeConditionPotionInventory(
            [{ id: 'p1', name: '컨디션 회복제(소)', type: 'consumable', quantity: 3 }],
            'small',
        );
        expect(stacked?.[0]?.quantity).toBe(2);

        const last = consumeConditionPotionInventory(
            [{ id: 'p1', name: '컨디션 회복제(소)', type: 'consumable', quantity: 1 }],
            'small',
        );
        expect(last).toEqual([]);
    });

    it('consumeConditionPotionInventory matches spaced item names', () => {
        const next = consumeConditionPotionInventory(
            [{ id: 'p1', name: '컨디션 회복제(소)', type: 'consumable', quantity: 1 }],
            'small',
        );
        expect(next).toEqual([]);
    });

    it('buildConditionPotionUserPatch updates inventory, gold, snapshot, and player condition', () => {
        const result = buildConditionPotionUserPatch(
            baseUser,
            { kind: 'dungeon', tournamentType: 'neighborhood' },
            'small',
            10,
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.newCondition).toBe(50);
        expect(result.patch.gold).toBe(400);
        expect(result.patch.inventory).toHaveLength(1);
        expect(result.patch.dungeonConditionSnapshot?.neighborhood?.condition).toBe(50);
        expect(
            (result.patch.lastNeighborhoodTournament as { players: { condition: number }[] }).players[0]!.condition,
        ).toBe(50);
    });

    it('buildOptimisticConditionPotionPatch mirrors server apply shape', () => {
        const patch = buildOptimisticConditionPotionPatch(baseUser, {
            potionType: 'small',
            tournamentType: 'neighborhood',
        });
        expect(patch).not.toBeNull();
        expect(patch!.inventory).toHaveLength(1);
        expect(patch!.dungeonConditionSnapshot?.neighborhood?.condition).toBeGreaterThan(40);
    });

    it('rollConditionPotionRecovery stays within catalog bounds', () => {
        for (let i = 0; i < 20; i++) {
            const amount = rollConditionPotionRecovery('medium', () => 0.5);
            expect(amount).toBeGreaterThanOrEqual(15);
            expect(amount).toBeLessThanOrEqual(25);
        }
    });
});
