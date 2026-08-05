/**
 * 소프트화폐(골드/다이아) 상점 표시가·차감가 단일 소스.
 * ShopModal UI · server/shop.ts SHOP_ITEMS · BUY_CONSUMABLE 가 동일 값을 쓴다.
 */
export type SoftShopCurrencyPrice = { gold?: number; diamonds?: number };

/** 장비/재료 상자·티켓 등 `itemId` → 단가 */
export const SOFT_SHOP_ITEM_PRICES: Record<string, SoftShopCurrencyPrice> = {
    equipment_box_1: { gold: 2000 },
    equipment_box_2: { gold: 5000 },
    equipment_box_3: { gold: 10000 },
    equipment_box_4: { gold: 20000 },
    equipment_box_5: { diamonds: 150 },
    equipment_box_6: { diamonds: 500 },
    material_box_1: { gold: 500 },
    material_box_2: { gold: 1000 },
    material_box_3: { gold: 3000 },
    material_box_4: { gold: 5000 },
    material_box_5: { gold: 10000 },
    material_box_6: { diamonds: 100 },
    equipment_unbind_ticket: { diamonds: 50 },
    refinement_charm: { diamonds: 100 },
    option_type_change_ticket: { gold: 2000 },
    option_value_change_ticket: { gold: 500 },
    mythic_option_change_ticket: { gold: 500 },
};

/** 행동력 회복제 — 당일 n번째 구매 단가(골드) 배열 */
export const SOFT_SHOP_ACTION_POINT_POTION_GOLD_PRICES: Record<
    'action_point_10' | 'action_point_20' | 'action_point_30',
    number[]
> = {
    action_point_10: [2000],
    action_point_20: [3000],
    action_point_30: [4000],
};

export function softShopItemPrice(itemId: string): SoftShopCurrencyPrice | undefined {
    return SOFT_SHOP_ITEM_PRICES[itemId];
}
