import { describe, expect, it } from 'vitest';
import { ItemGrade, type InventoryItem } from '../../../types/index.js';
import {
    countConditionPotionsInInventory,
    stripInventoryIfFewerConditionPotions,
} from '../../../shared/utils/conditionPotionInventory.js';

const potion = (name: string, quantity: number): InventoryItem =>
    ({
        id: `item-${name}`,
        name,
        description: '',
        type: 'consumable',
        quantity,
        slot: null,
        image: '',
        grade: ItemGrade.Normal,
        createdAt: 0,
        isEquipped: false,
        level: 1,
        stars: 0,
    }) as InventoryItem;

describe('conditionPotionInventory', () => {
    it('counts stacked condition potions', () => {
        const inv = [potion('컨디션회복제(소)', 2), potion('컨디션회복제(대)', 1)];
        expect(countConditionPotionsInInventory(inv)).toBe(3);
    });

    it('strips inventory patch when fewer potions than client state', () => {
        const prev = [potion('컨디션회복제(소)', 3)];
        const patch = {
            inventory: [potion('컨디션회복제(소)', 0)],
            gold: 500,
        };
        const stripped = stripInventoryIfFewerConditionPotions(patch, prev);
        expect(stripped.inventory).toBeUndefined();
        expect(stripped.gold).toBe(500);
    });

    it('keeps inventory patch when potion count increases', () => {
        const prev: InventoryItem[] = [];
        const patch = { inventory: [potion('컨디션회복제(중)', 3)], gold: 100 };
        const kept = stripInventoryIfFewerConditionPotions(patch, prev);
        expect(kept.inventory).toHaveLength(1);
        expect(countConditionPotionsInInventory(kept.inventory)).toBe(3);
    });
});
