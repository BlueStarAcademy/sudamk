import type { InventoryItem } from '../types/entities.js';
import { isConditionPotionConsumable } from '../constants/items.js';

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
