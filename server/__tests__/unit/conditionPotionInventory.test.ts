import { describe, expect, it } from 'vitest';
import { ItemGrade, type InventoryItem } from '../../../types/index.js';
import {
    countConditionPotionsInInventory,
    findConditionPotionInInventory,
    stripInventoryIfFewerConditionPotions,
    stripInventoryIfMoreConditionPotions,
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

    it('strips inventory and shop economy fields when fewer potions than client state', () => {
        const prev = [potion('컨디션회복제(소)', 3)];
        const patch = {
            inventory: [potion('컨디션회복제(소)', 0)],
            gold: 500,
            dailyShopPurchases: { condition_potion_small: { quantity: 0, date: Date.now() } },
        };
        const stripped = stripInventoryIfFewerConditionPotions(patch, prev);
        expect(stripped.inventory).toBeUndefined();
        expect(stripped.gold).toBeUndefined();
        expect(stripped.dailyShopPurchases).toBeUndefined();
    });

    it('keeps inventory patch when potion count increases', () => {
        const prev: InventoryItem[] = [];
        const patch = { inventory: [potion('컨디션회복제(중)', 3)], gold: 100 };
        const kept = stripInventoryIfFewerConditionPotions(patch, prev);
        expect(kept.inventory).toHaveLength(1);
        expect(countConditionPotionsInInventory(kept.inventory)).toBe(3);
    });

    it('strips inventory when stale patch has more potions than client after use', () => {
        const prev = [potion('컨디션회복제(소)', 1)];
        const patch = {
            inventory: [potion('컨디션회복제(소)', 2)],
            gold: 900,
        };
        const stripped = stripInventoryIfMoreConditionPotions(patch, prev);
        expect(stripped.inventory).toBeUndefined();
        expect(stripped.gold).toBeUndefined();
    });

    it('findConditionPotionInInventory matches names with spaces', () => {
        const inv = [potion('컨디션 회복제(소)', 1)];
        expect(findConditionPotionInInventory(inv, 'small')).toBe(0);
    });
});
