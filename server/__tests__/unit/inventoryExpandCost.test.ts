import { describe, expect, it } from 'vitest';
import {
    BASE_SLOTS_PER_CATEGORY,
    EXPANSION_AMOUNT,
    inventoryCategoryExpandDiamondCost,
    inventoryCategoryExpansionCount,
} from '../../../shared/constants/items.js';

describe('inventoryCategoryExpandDiamondCost', () => {
    it('matches UI ladder 100 + n*20', () => {
        expect(inventoryCategoryExpandDiamondCost(BASE_SLOTS_PER_CATEGORY)).toBe(100);
        expect(inventoryCategoryExpandDiamondCost(BASE_SLOTS_PER_CATEGORY + EXPANSION_AMOUNT)).toBe(120);
        expect(inventoryCategoryExpandDiamondCost(BASE_SLOTS_PER_CATEGORY + EXPANSION_AMOUNT * 2)).toBe(140);
        expect(inventoryCategoryExpandDiamondCost(BASE_SLOTS_PER_CATEGORY + EXPANSION_AMOUNT * 3)).toBe(160);
    });

    it('counts completed expansions from base slots', () => {
        expect(inventoryCategoryExpansionCount(30)).toBe(0);
        expect(inventoryCategoryExpansionCount(40)).toBe(1);
        expect(inventoryCategoryExpansionCount(50)).toBe(2);
    });
});
