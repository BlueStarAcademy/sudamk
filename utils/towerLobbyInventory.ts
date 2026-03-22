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
        .reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}
