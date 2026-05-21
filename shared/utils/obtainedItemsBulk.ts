import type { InventoryItem } from '../types/entities.js';

/** 획득 모달(`lastUsedItemResult`) 표시용 — 행 참조·수량 정규화 */
export function stampObtainedItemsBulk(items: InventoryItem[]): InventoryItem[] {
    return items.map((item) => {
        const qRaw = (item as { quantity?: unknown }).quantity;
        const q =
            typeof qRaw === 'number' && Number.isFinite(qRaw) ? Math.max(0, Math.floor(qRaw)) : 1;
        return {
            ...item,
            id: item.id || `reward-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            quantity: q,
        };
    });
}
