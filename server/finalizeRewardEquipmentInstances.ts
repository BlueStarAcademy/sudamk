import type { InventoryItem } from '../types/index.js';
import { EQUIPMENT_POOL, resolveEquipmentTemplateLookupName } from '../shared/constants/index.js';
import { ItemGrade } from '../shared/types/enums.js';
import { createItemFromTemplate } from './shop.js';

/** `createItemInstancesFromReward`로 만든 장비는 options가 비어 있을 수 있음 → 상자·상점과 동일하게 옵션 롤 */
function needsRolledEquipmentOptions(item: InventoryItem): boolean {
    if (item.type !== 'equipment') return false;
    return !item.options?.main;
}

export function finalizeRewardEquipmentInstances(items: InventoryItem[]): InventoryItem[] {
    return items.map((item) => {
        if (!needsRolledEquipmentOptions(item)) return item;
        const lookupName = resolveEquipmentTemplateLookupName(item.name, item.grade as ItemGrade | undefined) ?? item.name;
        const template =
            EQUIPMENT_POOL.find((t) => t.name === lookupName && t.grade === item.grade) ??
            EQUIPMENT_POOL.find((t) => t.name === lookupName);
        if (!template?.slot) return item;
        const rolled = createItemFromTemplate(template);
        const qty = Math.max(1, Math.floor(Number(item.quantity)) || 1);
        return qty > 1 ? { ...rolled, quantity: qty } : rolled;
    });
}
