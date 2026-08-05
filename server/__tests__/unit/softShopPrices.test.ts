import { describe, expect, it } from 'vitest';
import { SHOP_ITEMS } from '../../shop.js';
import {
    SOFT_SHOP_ACTION_POINT_POTION_GOLD_PRICES,
    SOFT_SHOP_ITEM_PRICES,
} from '../../../shared/constants/softShopPrices.js';
import { CONDITION_POTION_SHOP_GOLD_BY_TYPE } from '../../../shared/constants/conditionPotion.js';
import { TOWER_SHOP_ITEMS } from '../../../shared/constants/towerShopItems.js';

describe('soft shop price catalog', () => {
    it('SHOP_ITEMS cost matches SOFT_SHOP_ITEM_PRICES for every shared id', () => {
        for (const [itemId, price] of Object.entries(SOFT_SHOP_ITEM_PRICES)) {
            const shopItem = SHOP_ITEMS[itemId];
            if (!shopItem) continue; // tickets may only be in BUY_CONSUMABLE
            expect(shopItem.cost, itemId).toEqual(price);
        }
    });

    it('material boxes III–V deduct gold matching shop display (3000/5000/10000)', () => {
        expect(SOFT_SHOP_ITEM_PRICES.material_box_3).toEqual({ gold: 3000 });
        expect(SOFT_SHOP_ITEM_PRICES.material_box_4).toEqual({ gold: 5000 });
        expect(SOFT_SHOP_ITEM_PRICES.material_box_5).toEqual({ gold: 10000 });
        expect(SHOP_ITEMS.material_box_3.cost).toEqual({ gold: 3000 });
        expect(SHOP_ITEMS.material_box_4.cost).toEqual({ gold: 5000 });
        expect(SHOP_ITEMS.material_box_5.cost).toEqual({ gold: 10000 });
    });

    it('action point potion gold ladders are defined', () => {
        expect(SOFT_SHOP_ACTION_POINT_POTION_GOLD_PRICES.action_point_10).toEqual([2000]);
        expect(SOFT_SHOP_ACTION_POINT_POTION_GOLD_PRICES.action_point_20).toEqual([3000]);
        expect(SOFT_SHOP_ACTION_POINT_POTION_GOLD_PRICES.action_point_30).toEqual([4000]);
    });

    it('condition potion shop gold stays on shared constants', () => {
        expect(CONDITION_POTION_SHOP_GOLD_BY_TYPE).toEqual({
            small: 750,
            medium: 1000,
            large: 1500,
        });
    });

    it('tower shop items expose positive gold prices', () => {
        for (const item of TOWER_SHOP_ITEMS) {
            expect(item.price.gold, item.itemId).toBeGreaterThan(0);
        }
    });
});
