import { randomUUID } from 'crypto';
import { InventoryItem, InventoryItemType } from '../types/index.js';
import { ItemGrade } from '../types/enums.js';
import {
    applyEnhancementStarsToEquipmentItem,
    getMailEquipmentDisplayStars,
    isMailAttachmentEquipment,
} from '../shared/utils/equipmentEnhancementStars.js';
import { normalizeInventoryEquipmentItem } from '../shared/utils/inventoryLegacyNormalize.js';
import { isActionPointConsumable, isRefinementTicketMaterial } from '../constants/items.js';
import { getItemTemplateByName, normalizeBoxItemName } from './itemTemplateLookup.js';

export { getItemTemplateByName, normalizeBoxItemName };

/** 옵션 변경권 3종: 슬롯당 최대 겹침, 초과 시 다음 슬롯 */
export const REFINEMENT_TICKET_MAX_STACK = 100;

export const addItemsToInventory = (currentInventory: InventoryItem[], inventorySlots: { equipment: number; consumable: number; material: number; }, itemsToAdd: InventoryItem[]): { success: boolean, finalItemsToAdd: InventoryItem[], updatedInventory: InventoryItem[] } => {
    const tempInventory = JSON.parse(JSON.stringify(currentInventory));
    const finalItemsToAdd: InventoryItem[] = [];

    const getMaxStackSize = (name: string): number => {
        // 행동력 회복제: 한 묶음 최대 20개
        if (isActionPointConsumable(name)) return 20;
        // 옵션 변경권: 한 슬롯 최대 100개
        if (isRefinementTicketMaterial(name)) return REFINEMENT_TICKET_MAX_STACK;
        // 그 외 소모품/재료: 한 묶음 최대 100개
        return 100;
    };

    const itemsByType = {
        equipment: itemsToAdd.filter(item => item.type === 'equipment'),
        consumable: itemsToAdd.filter(item => item.type === 'consumable'),
        material: itemsToAdd.filter(item => item.type === 'material'),
    };

    // First, check space for non-stackable items (equipment)
    const currentEquipmentCount = tempInventory.filter((item: InventoryItem) => item.type === 'equipment').length;
    if (itemsByType.equipment.length > (inventorySlots.equipment - currentEquipmentCount)) {
        return { success: false, finalItemsToAdd: [], updatedInventory: currentInventory };
    }
    finalItemsToAdd.push(...itemsByType.equipment);

    // Then, check space and process stackable items (consumables and materials)
    // Stack by name+source so tower-purchased items don't merge with general (도전의 탑 전용 분리)
    const getStackKey = (item: InventoryItem) => `${item.name}|${(item as InventoryItem & { source?: string }).source ?? ''}`;
    const parseStackKey = (key: string): { name: string; source?: 'tower' } => {
        const idx = key.indexOf('|');
        if (idx === -1) return { name: key, source: undefined };
        const name = key.slice(0, idx);
        const sourcePart = key.slice(idx + 1);
        return { name, source: sourcePart === 'tower' ? 'tower' : undefined };
    };

    for (const category of ['consumable', 'material'] as const) {
        const items = itemsByType[category];
        if (items.length === 0) continue;

        const currentCategoryItems = tempInventory.filter((item: InventoryItem) => item.type === category);
        let currentCategorySlotsUsed = currentCategoryItems.length;

        const stackableToAdd: Record<string, number> = {};
        for (const item of items) {
            const key = getStackKey(item);
            stackableToAdd[key] = (stackableToAdd[key] || 0) + (item.quantity || 1);
        }

        let neededNewSlots = 0;
        for (const key in stackableToAdd) {
            const { name, source } = parseStackKey(key);
            let quantityToPlace = stackableToAdd[key];
            const existingSource = source ?? (undefined as 'tower' | undefined);
            const maxStackSize = getMaxStackSize(name);

            for (const existingItem of currentCategoryItems) {
                if (quantityToPlace <= 0) break;
                const exSource = (existingItem as InventoryItem & { source?: string }).source;
                if (existingItem.name === name && (exSource ?? '') === (existingSource ?? '') && (existingItem.quantity || 0) < maxStackSize) {
                    const space = maxStackSize - (existingItem.quantity || 0);
                    const toAdd = Math.min(quantityToPlace, space);
                    existingItem.quantity = (existingItem.quantity || 0) + toAdd;
                    quantityToPlace -= toAdd;
                }
            }
            if (quantityToPlace > 0) {
                neededNewSlots += Math.ceil(quantityToPlace / maxStackSize);
            }
        }

        if ((currentCategorySlotsUsed + neededNewSlots) > inventorySlots[category]) {
            return { success: false, finalItemsToAdd: [], updatedInventory: currentInventory };
        }

        for (const key in stackableToAdd) {
            const { name, source } = parseStackKey(key);
            let quantityLeft = stackableToAdd[key];
            const existingSource = source ?? (undefined as 'tower' | undefined);
            const maxStackSize = getMaxStackSize(name);

            for (const existingItem of currentCategoryItems) {
                if (quantityLeft <= 0) break;
                const exSource = (existingItem as InventoryItem & { source?: string }).source;
                if (existingItem.name === name && (exSource ?? '') === (existingSource ?? '')) {
                    const originalQuantity = (currentInventory.find(i => i.id === existingItem.id)?.quantity || 0);
                    const addedQuantity = (existingItem.quantity || 0) - originalQuantity;
                    quantityLeft -= addedQuantity;
                }
            }

            if (quantityLeft > 0) {
                for (const finalItem of finalItemsToAdd) {
                    if (quantityLeft <= 0) break;
                    const fSource = (finalItem as InventoryItem & { source?: string }).source;
                    if (finalItem.name === name && (fSource ?? '') === (existingSource ?? '') && (finalItem.quantity || 0) < maxStackSize) {
                        const space = maxStackSize - (finalItem.quantity || 0);
                        const toAdd = Math.min(quantityLeft, space);
                        finalItem.quantity = (finalItem.quantity || 0) + toAdd;
                        quantityLeft -= toAdd;
                    }
                }

                while (quantityLeft > 0) {
                    const toAdd = Math.min(quantityLeft, maxStackSize);
                    const template = getItemTemplateByName(name);
                    const newItemSource = source === 'tower' ? { source: 'tower' as const } : {};
                    if (template) {
                        finalItemsToAdd.push({ ...template, ...newItemSource, id: `item-${randomUUID()}`, quantity: toAdd, createdAt: Date.now(), isEquipped: false, stars: 0, level: 1 });
                    } else {
                        console.error(`[addItemsToInventory] Unable to find template for stackable item '${name}'.`);
                        finalItemsToAdd.push({
                            name,
                            description: '보상 아이템',
                            type: 'consumable',
                            slot: null,
                            image: '/images/icon/Reward.png',
                            grade: 'normal',
                            id: `item-${randomUUID()}`,
                            quantity: toAdd,
                            createdAt: Date.now(),
                            isEquipped: false,
                            stars: 0,
                            level: 1,
                            ...newItemSource,
                        } as InventoryItem);
                    }
                    quantityLeft -= toAdd;
                }
            }
        }
    }

    // Create updated inventory
    // tempInventory already has stacking applied to existing items (quantities increased)
    // finalItemsToAdd contains only new items that couldn't be stacked
    // So we need to combine tempInventory (with updated quantities) and finalItemsToAdd
    // But we need to be careful: tempInventory contains ALL existing items, and finalItemsToAdd contains only new items
    
    // The updated inventory should be:
    // 1. All items from tempInventory (existing items with updated quantities from stacking)
    // 2. Plus all items from finalItemsToAdd (new items that need new slots)
    const updatedInventory: InventoryItem[] = [];
    
    // Add all items from tempInventory (these include the stacked items with updated quantities)
    updatedInventory.push(...tempInventory);
    
    // Add new items from finalItemsToAdd (these are items that couldn't be stacked and need new slots)
    updatedInventory.push(...finalItemsToAdd);

    return { success: true, finalItemsToAdd, updatedInventory };
};

/**
 * 동일 종류 옵션 변경권을 최대 REFINEMENT_TICKET_MAX_STACK개까지 한 슬롯에 합치고, 초과분은 다음 슬롯으로 분할.
 * 레거시(슬롯당 1개·consumable 저장 등) 정리 및 로드 시 일관된 스택 유지.
 */
export function consolidateRefinementTicketStacks(inventory: InventoryItem[]): InventoryItem[] {
    if (!Array.isArray(inventory) || inventory.length === 0) return inventory;

    const isTicketRow = (it: InventoryItem) =>
        (it.type === 'material' || it.type === 'consumable') && isRefinementTicketMaterial(it.name);

    const sourceKey = (it: InventoryItem & { source?: string }) => (it.source === 'tower' ? 'tower' : '');
    const stackKey = (it: InventoryItem) => `${it.name}|${sourceKey(it as InventoryItem & { source?: string })}`;

    const ticketRows = inventory.filter(isTicketRow);
    if (ticketRows.length === 0) return inventory;

    const keySeen = new Set<string>();
    let needsWork = false;
    for (const r of ticketRows) {
        const q = r.quantity ?? 1;
        if (q > REFINEMENT_TICKET_MAX_STACK || q < 1) {
            needsWork = true;
            break;
        }
        const k = stackKey(r);
        if (keySeen.has(k)) {
            needsWork = true;
            break;
        }
        keySeen.add(k);
        const tmpl = getItemTemplateByName(r.name);
        if (tmpl && r.type !== tmpl.type) {
            needsWork = true;
            break;
        }
    }
    if (!needsWork) return inventory;

    let insertAt = -1;
    const tickets: InventoryItem[] = [];
    const rest: InventoryItem[] = [];

    for (const item of inventory) {
        if (isTicketRow(item)) {
            if (insertAt < 0) insertAt = rest.length;
            tickets.push(item);
        } else {
            rest.push(item);
        }
    }

    if (tickets.length === 0) return inventory;

    const totals = new Map<string, number>();
    for (const t of tickets) {
        const k = stackKey(t);
        totals.set(k, (totals.get(k) ?? 0) + (t.quantity ?? 1));
    }

    const merged: InventoryItem[] = [];
    for (const [key, total] of totals) {
        const pipe = key.indexOf('|');
        const name = pipe >= 0 ? key.slice(0, pipe) : key;
        const src = pipe >= 0 ? key.slice(pipe + 1) : '';
        const sourceObj = src === 'tower' ? { source: 'tower' as const } : {};
        let left = total;
        const template = getItemTemplateByName(name);
        while (left > 0) {
            const chunk = Math.min(left, REFINEMENT_TICKET_MAX_STACK);
            if (template) {
                merged.push({
                    ...template,
                    ...sourceObj,
                    id: `item-${randomUUID()}`,
                    quantity: chunk,
                    createdAt: Date.now(),
                    isEquipped: false,
                    stars: 0,
                    level: 1,
                } as InventoryItem);
            } else {
                const sample = tickets.find((x) => x.name === name);
                merged.push({
                    name,
                    description: sample?.description ?? '보상 아이템',
                    type: 'material',
                    slot: null,
                    image: sample?.image ?? '/images/use/change1.png',
                    grade: sample?.grade ?? ItemGrade.Normal,
                    ...sourceObj,
                    id: `item-${randomUUID()}`,
                    quantity: chunk,
                    createdAt: Date.now(),
                    isEquipped: false,
                    stars: 0,
                    level: 1,
                } as InventoryItem);
            }
            left -= chunk;
        }
    }

    return [...rest.slice(0, insertAt), ...merged, ...rest.slice(insertAt)];
}

export const createItemInstancesFromReward = (itemRefs: (InventoryItem | { itemId: string; quantity: number })[]): InventoryItem[] => {
    const createdItems: InventoryItem[] = [];
    for (const itemRef of itemRefs) {
        if ('id' in itemRef) {
            const inv = itemRef as InventoryItem;
            if (isMailAttachmentEquipment(inv)) {
                const cloned = normalizeInventoryEquipmentItem(
                    JSON.parse(JSON.stringify(inv)) as InventoryItem
                );
                cloned.id = `item-${randomUUID()}`;
                delete cloned.mailPreEnhanced;
                if (!inv.mailPreEnhanced) {
                    const stars = getMailEquipmentDisplayStars(inv);
                    if (stars === 0) {
                        applyEnhancementStarsToEquipmentItem(cloned, 0);
                    }
                }
                if (cloned.type !== 'equipment') {
                    cloned.type = 'equipment';
                }
                createdItems.push(cloned);
            } else {
                createdItems.push(inv);
            }
            continue;
        }

        const { itemId, quantity } = itemRef;
        // 장비/재료 상자 등은 이름 정규화 후 템플릿 조회 (월드챔피언십 보상 등에서 이름 변형 시 이미지·사용 정상화)
        const lookupName = normalizeBoxItemName(itemId);
        const template = getItemTemplateByName(lookupName) || getItemTemplateByName(itemId);

        if (template) {
            const newItem: InventoryItem = {
                ...template,
                id: `item-${randomUUID()}`,
                createdAt: Date.now(),
                quantity: quantity,
                isEquipped: false, 
                level: 1,
                stars: 0,
                options: undefined,
            };
            createdItems.push(newItem);
        } else {
            console.error(`[Reward] Could not find consumable/material item template for: ${itemId}`);
            createdItems.push({
                name: lookupName || itemId,
                description: '보상 아이템',
                type: 'consumable',
                slot: null,
                image: '/images/icon/Reward.png',
                grade: ItemGrade.Normal,
                id: `item-${randomUUID()}`,
                createdAt: Date.now(),
                quantity,
                isEquipped: false,
                stars: 0,
                level: 1,
                options: undefined,
            });
        }
    }
    return createdItems;
};