import type { InventoryItem } from '../types/entities.js';

/**
 * 레거시 더블신화 데이터를 UI·게임 규칙에 맞게 통일:
 * - 이름 접미사 ` (더블신화)` 제거
 * - `isDivineMythic` 플래그 제거
 * - 신화 등급 + 신화 부옵 2줄(또는 구 플래그) → 등급 `transcendent`
 */
export function normalizeLegacyDivineMythicInventoryItem(item: InventoryItem): InventoryItem {
    if (!item || typeof item !== 'object' || item.type !== 'equipment') return item;
    const anyItem = item as InventoryItem & { isDivineMythic?: boolean };
    let name = item.name;
    if (typeof name === 'string' && name.endsWith(' (더블신화)')) {
        name = name.replace(/ \(더블신화\)$/, '');
    }
    const mythicSubs = item.options?.mythicSubs;
    const twoMythicLines = Array.isArray(mythicSubs) && mythicSubs.length >= 2;
    const wasDivineFlag = anyItem.isDivineMythic === true;
    let grade = item.grade;
    if (grade === 'mythic' && (wasDivineFlag || twoMythicLines)) {
        grade = 'transcendent';
    }
    const hadDivineField = anyItem.isDivineMythic !== undefined;
    const { isDivineMythic: _strip, ...rest } = anyItem;
    if (name === item.name && grade === item.grade && !hadDivineField) return item;
    return { ...rest, name, grade };
}

export function mapNormalizeInventoryList(items: InventoryItem[]): InventoryItem[] {
    return items.map(normalizeLegacyDivineMythicInventoryItem);
}
