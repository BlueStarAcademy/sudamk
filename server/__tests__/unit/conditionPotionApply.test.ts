import { describe, expect, it } from 'vitest';
import type { User } from '../../../types.js';
import {
    buildConditionPotionUserPatch,
    buildOptimisticConditionPotionPatch,
    consumeConditionPotionInventory,
    parseConditionPotionUseContext,
} from '../../../shared/conditionPotion/apply.js';
import { getConditionPotionDefinition, rollConditionPotionRecovery } from '../../../shared/constants/conditionPotion.js';

const smallPotionUseGold = getConditionPotionDefinition('small').useGold;

const baseUser = {
    id: 'u1',
    gold: smallPotionUseGold + 250,
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
        expect(result.patch.gold).toBe(250);
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

    it('buildConditionPotionUserPatch updates versus venue snapshot', () => {
        const versusUser = {
            id: 'u1',
            gold: smallPotionUseGold + 250,
            inventory: [{ id: 'p1', name: '컨디션 회복제(소)', type: 'consumable', quantity: 2 }],
            championshipVersusConditionSnapshot: {
                pvp: { condition: 35, dateStartOfDayKST: 1 },
            },
        } as unknown as User;

        const result = buildConditionPotionUserPatch(
            versusUser,
            { kind: 'versus', venue: 'pvp' },
            'small',
            12,
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.newCondition).toBe(47);
        expect(result.patch.championshipVersusConditionSnapshot?.pvp?.condition).toBe(47);
        expect(result.patch.inventory).toHaveLength(1);
        expect(result.patch.gold).toBe(250);
    });

    it('buildOptimisticConditionPotionPatch accepts versusVenue payload', () => {
        const mediumUseGold = getConditionPotionDefinition('medium').useGold;
        const versusUser = {
            id: 'u1',
            gold: mediumUseGold + 100,
            inventory: [{ id: 'p1', name: '컨디션회복제(중)', type: 'consumable', quantity: 1 }],
            championshipVersusConditionSnapshot: {
                pvp: { condition: 50, dateStartOfDayKST: 1 },
            },
        } as unknown as User;

        const patch = buildOptimisticConditionPotionPatch(versusUser, {
            potionType: 'medium',
            versusVenue: 'pvp',
        });
        expect(patch).not.toBeNull();
        expect(patch!.championshipVersusConditionSnapshot?.pvp?.condition).toBeGreaterThan(50);
        expect(patch!.inventory).toEqual([]);
    });

    it('allows use when gold is above useGold but below shopGold', () => {
        const small = getConditionPotionDefinition('small');
        expect(small.useGold).toBeLessThan(small.shopGold);
        const user = {
            id: 'u1',
            gold: small.useGold,
            inventory: [{ id: 'p1', name: '컨디션회복제(소)', type: 'consumable', quantity: 1 }],
            championshipVersusConditionSnapshot: {
                pvp: { condition: 40, dateStartOfDayKST: 1 },
            },
        } as unknown as User;

        const result = buildConditionPotionUserPatch(user, { kind: 'versus', venue: 'pvp' }, 'small', 10);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.patch.gold).toBe(0);
        expect(result.newCondition).toBe(50);
    });

    it('rejects use when gold is below useGold even if inventory has potion', () => {
        const small = getConditionPotionDefinition('small');
        const user = {
            id: 'u1',
            gold: small.useGold - 1,
            inventory: [{ id: 'p1', name: '컨디션회복제(소)', type: 'consumable', quantity: 1 }],
            championshipVersusConditionSnapshot: {
                pvp: { condition: 40, dateStartOfDayKST: 1 },
            },
        } as unknown as User;

        const result = buildConditionPotionUserPatch(user, { kind: 'versus', venue: 'pvp' }, 'small', 10);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toContain(String(small.useGold));
    });

    it('rollConditionPotionRecovery stays within catalog bounds', () => {
        for (let i = 0; i < 20; i++) {
            const amount = rollConditionPotionRecovery('medium', () => 0.5);
            expect(amount).toBeGreaterThanOrEqual(15);
            expect(amount).toBeLessThanOrEqual(25);
        }
    });
});
