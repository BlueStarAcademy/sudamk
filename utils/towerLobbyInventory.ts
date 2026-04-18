/** 도전의 탑 대기실·경기장·서버 소모 처리와 동일한 이름/id 목록 */

export const TOWER_ITEM_TURN_ADD_NAMES = ['턴 추가', '턴증가', 'turn_add', 'turn_add_item', 'addturn'] as const;
export const TOWER_ITEM_MISSILE_NAMES = ['미사일', 'missile', 'Missile'] as const;
export const TOWER_ITEM_HIDDEN_NAMES = ['히든', 'hidden', 'Hidden'] as const;
export const TOWER_ITEM_SCAN_NAMES = ['스캔', 'scan', 'Scan', 'SCAN', '스캔권', '스캔 아이템'] as const;
export const TOWER_ITEM_REFRESH_NAMES = ['배치 새로고침', '배치변경', 'reflesh', 'refresh'] as const;

/** 도전의 탑 대기실·상점과 동일: source === 'tower' 또는 구 데이터(source 없음)만 합산 */

export const isTowerLobbyInventorySource = (item: { source?: string | null }): boolean =>
    item.source === 'tower' || item.source == null || item.source === '';

export function countTowerLobbyInventoryQty(
    inventory: Array<{ name?: string; id?: string; quantity?: number; source?: string | null }> | undefined,
    namesOrIds: readonly string[]
): number {
    const inv = inventory || [];
    return inv
        .filter((item) => isTowerLobbyInventorySource(item))
        .filter((item) => namesOrIds.some((n) => item.name === n || item.id === n))
        .reduce((sum, item) => {
            const q = item.quantity;
            return sum + (typeof q === 'number' && Number.isFinite(q) ? Math.max(0, q) : 1);
        }, 0);
}

/** 상점 `itemId`(턴 추가·미사일·…)와 동일하게 대기실·하단 버튼에서 쓰는 이름/id 목록 — 보유 수 집계 시 별칭 누락 방지 */
export function towerShopInventoryNameOrIdsForItem(itemId: string): readonly string[] {
    switch (itemId) {
        case '턴 추가':
            return TOWER_ITEM_TURN_ADD_NAMES;
        case '미사일':
            return TOWER_ITEM_MISSILE_NAMES;
        case '히든':
            return TOWER_ITEM_HIDDEN_NAMES;
        case '스캔':
            return TOWER_ITEM_SCAN_NAMES;
        case '배치변경':
            return TOWER_ITEM_REFRESH_NAMES;
        default:
            return [itemId];
    }
}
