import type { InventoryItem, User } from '../../types/index.js';

/** `exchangeState.listings` 중 status=listed 인 장비 id */
export function collectActiveExchangeListedItemIds(user: Pick<User, 'exchangeState'>): Set<string> {
    const listings = user.exchangeState?.listings;
    const ids = new Set<string>();
    if (!Array.isArray(listings)) return ids;
    for (const row of listings) {
        const r = row as { status?: unknown; itemId?: unknown } | null;
        if (r && r.status === 'listed' && typeof r.itemId === 'string') {
            ids.add(r.itemId);
        }
    }
    return ids;
}

/**
 * 거래소 `listed` 목록과 인벤 `isExchangeListed` 동기화.
 * SAVE_EXCHANGE_STATE·합성 직후 등록 레이스로 플래그가 DB/클라에서 빠져도 가방 노출을 막는다.
 */
export function reconcileExchangeListedInventoryFlags(user: User): User {
    const listedIds = collectActiveExchangeListedItemIds(user);
    if (listedIds.size === 0) {
        let cleared = false;
        const inventory = user.inventory.map((it: InventoryItem) => {
            if (!it || it.type !== 'equipment' || !it.isExchangeListed) return it;
            cleared = true;
            const { isExchangeListed: _removed, ...rest } = it;
            return rest as InventoryItem;
        });
        return cleared ? { ...user, inventory } : user;
    }

    let changed = false;
    const inventory = user.inventory.map((it: InventoryItem) => {
        if (!it || it.type !== 'equipment') return it;
        const should = listedIds.has(it.id);
        if (should === Boolean(it.isExchangeListed)) return it;
        changed = true;
        if (should) {
            return { ...it, isExchangeListed: true as const };
        }
        const { isExchangeListed: _removed, ...rest } = it;
        return rest as InventoryItem;
    });
    return changed ? { ...user, inventory } : user;
}

/** 가방 UI: 등록 플래그 또는 거래소 listed 목록에 있으면 숨김 */
export function isEquipmentHiddenFromBag(
    item: InventoryItem,
    listedItemIds: ReadonlySet<string>,
): boolean {
    if (item.type !== 'equipment') return false;
    return Boolean(item.isExchangeListed) || listedItemIds.has(item.id);
}
