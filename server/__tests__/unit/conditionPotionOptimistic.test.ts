import { describe, expect, it } from 'vitest';
import { getConditionPotionDefinition } from '../../../shared/constants/conditionPotion.js';
import { buildOptimisticUseConditionPotionUserPatch } from '../../../shared/utils/conditionPotionOptimistic.js';
import type { User } from '../../../types.js';

describe('conditionPotionOptimistic', () => {
    it('builds dungeon patch with inventory, gold, snapshot, and player condition', () => {
        const smallPotionGold = getConditionPotionDefinition('small').shopGold;
        const user = {
            id: 'u1',
            gold: smallPotionGold + 250,
            inventory: [{ id: 'p1', name: '컨디션회복제(소)', type: 'consumable', quantity: 2 }],
            dungeonConditionSnapshot: {
                neighborhood: { condition: 40, dateStartOfDayKST: 1 },
            },
            lastNeighborhoodTournament: {
                players: [{ id: 'u1', condition: 40 }],
            },
        } as unknown as User;

        const patch = buildOptimisticUseConditionPotionUserPatch(user, {
            potionType: 'small',
            tournamentType: 'neighborhood',
        });

        expect(patch).not.toBeNull();
        expect(patch!.gold).toBe(250);
        expect(patch!.inventory).toHaveLength(1);
        expect((patch!.inventory![0] as { quantity?: number }).quantity).toBe(1);
        expect(patch!.dungeonConditionSnapshot?.neighborhood?.condition).toBeGreaterThan(40);
        expect(
            (patch!.lastNeighborhoodTournament as { players: { condition: number }[] }).players[0]!.condition,
        ).toBe(patch!.dungeonConditionSnapshot?.neighborhood?.condition);
    });
});
