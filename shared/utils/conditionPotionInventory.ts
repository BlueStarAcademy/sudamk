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
 * 지연 WS·역순 HTTP가 구매 전 인벤 스냅샷을 실었을 때 전체 인벤 교체를 막는다.
 * 회복제 수가 줄어들면 inventory 필드만 제거하고 나머지 패치(골드·일일구매 등)는 유지한다.
 */
export function stripInventoryIfFewerConditionPotions<T extends { inventory?: InventoryItem[] }>(
    patch: T,
    prevInventory: InventoryItem[] | undefined,
): T {
    if (!Array.isArray(patch.inventory)) return patch;
    const prevP = countConditionPotionsInInventory(prevInventory);
    const incomingP = countConditionPotionsInInventory(patch.inventory);
    if (incomingP >= prevP) return patch;
    const { inventory: _stale, ...rest } = patch;
    return rest as T;
}
