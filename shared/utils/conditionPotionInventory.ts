import type { InventoryItem } from '../types/entities.js';
import { isConditionPotionConsumable } from '../constants/items.js';

export type ConditionPotionSize = 'small' | 'medium' | 'large';

const POTION_SIZE_TOKEN: Record<ConditionPotionSize, string> = {
    small: '(소)',
    medium: '(중)',
    large: '(대)',
};

/** 가방 행 이름(공백 유무)과 무관하게 회복제 슬롯을 찾는다. */
export function findConditionPotionInInventory(
    inventory: InventoryItem[] | undefined,
    potionType: ConditionPotionSize,
): number {
    if (!Array.isArray(inventory)) return -1;
    const token = POTION_SIZE_TOKEN[potionType];
    return inventory.findIndex((item) => {
        if (item?.type !== 'consumable' || !isConditionPotionConsumable(item.name)) return false;
        return (item.name ?? '').replace(/\s+/g, '').includes(token);
    });
}

/** 가방·컨디션 회복 모달 공통: 보유 컨디션 회복제 총 수 */
export function countConditionPotionsInInventory(inv: InventoryItem[] | undefined): number {
    if (!Array.isArray(inv)) return 0;
    let total = 0;
    for (const row of inv) {
        if (row?.type !== 'consumable' || !isConditionPotionConsumable(row.name)) continue;
        const q = row.quantity;
        total +=
            typeof q === 'number' && Number.isFinite(q) && q > 0 ? Math.floor(q) : 1;
    }
    return total;
}

/** 모달 UI: 타입별 보유 수 */
export function countConditionPotionsByType(
    inv: InventoryItem[] | undefined,
): Record<ConditionPotionSize, number> {
    const counts: Record<ConditionPotionSize, number> = { small: 0, medium: 0, large: 0 };
    if (!Array.isArray(inv)) return counts;
    for (const row of inv) {
        if (row?.type !== 'consumable' || !isConditionPotionConsumable(row.name)) continue;
        const compact = (row.name ?? '').replace(/\s+/g, '');
        const qty = typeof row.quantity === 'number' && row.quantity > 0 ? row.quantity : 1;
        if (compact.includes(POTION_SIZE_TOKEN.small)) counts.small += qty;
        else if (compact.includes(POTION_SIZE_TOKEN.medium)) counts.medium += qty;
        else if (compact.includes(POTION_SIZE_TOKEN.large)) counts.large += qty;
    }
    return counts;
}

/**
 * 지연 WS·역순 HTTP가 구매 전 사용자 스냅샷을 실었을 때 클라 상태가 되돌아가는 것을 막는다.
 * 회복제 수가 줄어들면 인벤뿐 아니라 같은 패치에 실린 골드·일일구매도 함께 버린다.
 * (인벤만 제거하면 낡은 dailyShopPurchases/gold가 merge되어 «구매했는데 한도·수량이 그대로»가 남을 수 있음)
 */
export function stripInventoryIfFewerConditionPotions<
    T extends { inventory?: InventoryItem[]; gold?: number; dailyShopPurchases?: Record<string, { quantity: number; date: number }> },
>(patch: T, prevInventory: InventoryItem[] | undefined): T {
    if (!Array.isArray(patch.inventory)) return patch;
    const prevP = countConditionPotionsInInventory(prevInventory);
    const incomingP = countConditionPotionsInInventory(patch.inventory);
    if (incomingP >= prevP) return patch;
    const { inventory: _staleInv, gold: _staleGold, dailyShopPurchases: _staleDaily, ...rest } = patch;
    return rest as T;
}

/**
 * 회복제 사용 직후 낡은 WS/HTTP가 사용 전 인벤을 실었을 때 보유 수가 되돌아가는 것을 막는다.
 */
export function stripInventoryIfMoreConditionPotions<
    T extends { inventory?: InventoryItem[]; gold?: number; dailyShopPurchases?: Record<string, { quantity: number; date: number }> },
>(patch: T, prevInventory: InventoryItem[] | undefined): T {
    if (!Array.isArray(patch.inventory)) return patch;
    const prevP = countConditionPotionsInInventory(prevInventory);
    const incomingP = countConditionPotionsInInventory(patch.inventory);
    if (incomingP <= prevP) return patch;
    const { inventory: _staleInv, gold: _staleGold, dailyShopPurchases: _staleDaily, ...rest } = patch;
    return rest as T;
}
