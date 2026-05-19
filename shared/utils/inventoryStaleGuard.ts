import type { InventoryItem, User } from '../../types/index.js';

/**
 * 합성·판매 등으로 방금 제거된 id가 낡은 WS/HTTP 패치에 다시 실리는 것을 막는다.
 * (prev에 없고 removed 집합에만 있으면 패치 행을 제거)
 */
export function stripReappearedRemovedInventoryItems(
    prevInventory: InventoryItem[] | undefined,
    patchInventory: InventoryItem[] | undefined,
    recentlyRemovedIds: ReadonlySet<string>,
): InventoryItem[] | undefined {
    if (!patchInventory || recentlyRemovedIds.size === 0) return patchInventory;
    const prevIds = new Set((prevInventory ?? []).map((i) => i.id));
    let changed = false;
    const next = patchInventory.filter((item) => {
        if (!item?.id || !recentlyRemovedIds.has(item.id)) return true;
        if (prevIds.has(item.id)) return true;
        changed = true;
        return false;
    });
    return changed ? next : patchInventory;
}

export function applyInventoryPatchWithStaleGuard(
    prevUser: User | null,
    patch: Partial<User>,
    recentlyRemovedIds: ReadonlySet<string>,
): Partial<User> {
    if (!patch.inventory || recentlyRemovedIds.size === 0) return patch;
    const stripped = stripReappearedRemovedInventoryItems(prevUser?.inventory, patch.inventory, recentlyRemovedIds);
    if (stripped === patch.inventory) return patch;
    return { ...patch, inventory: stripped };
}
