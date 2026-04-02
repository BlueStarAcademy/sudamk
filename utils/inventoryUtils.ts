import { randomUUID } from 'crypto';
import { InventoryItem, InventoryItemType } from '../types/index.js';
import { ItemGrade } from '../types/enums.js';
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS } from '../constants';
import {
    applyEnhancementStarsToEquipmentItem,
    getMailEquipmentDisplayStars,
    isMailAttachmentEquipment,
} from '../shared/utils/equipmentEnhancementStars.js';
import { isActionPointConsumable } from '../constants/items.js';

const CONSUMABLE_TEMPLATE_MAP: Record<string, Omit<InventoryItem, 'id'|'createdAt'|'isEquipped'|'level'|'stars'|'options'|'enhancementFails'>> = CONSUMABLE_ITEMS.reduce((map, item) => {
    map[item.name] = item;
    return map;
}, {} as Record<string, Omit<InventoryItem, 'id'|'createdAt'|'isEquipped'|'level'|'stars'|'options'|'enhancementFails'>>);

const MATERIAL_TEMPLATE_MAP: Record<string, Omit<InventoryItem, 'id'|'createdAt'|'isEquipped'|'level'|'stars'|'options'|'enhancementFails'>> = { ...MATERIAL_ITEMS };

// 장비/재료 상자 이름을 CONSUMABLE_ITEMS 표준 형식으로 정규화 (공백·숫자/로마자 통일)
export const normalizeBoxItemName = (name: string): string => {
    if (!name || typeof name !== 'string') return name;
    const numToRoman: Record<string, string> = {
        '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI'
    };
    let normalized = name.replace(/\s+/g, ' ').trim(); // 모든 공백을 일반 공백 하나로
    normalized = normalized.replace(/장비상자(\d)/g, (_, num) => `장비 상자 ${numToRoman[num] || num}`);
    normalized = normalized.replace(/재료상자(\d)/g, (_, num) => `재료 상자 ${numToRoman[num] || num}`);
    normalized = normalized.replace(/장비 상자(\d)/g, (_, num) => `장비 상자 ${numToRoman[num] || num}`);
    normalized = normalized.replace(/재료 상자(\d)/g, (_, num) => `재료 상자 ${numToRoman[num] || num}`);
    normalized = normalized.replace(/장비 상자 (\d)/g, (_, num) => `장비 상자 ${numToRoman[num] || num}`);
    normalized = normalized.replace(/재료 상자 (\d)/g, (_, num) => `재료 상자 ${numToRoman[num] || num}`);
    return normalized.trim();
};

export const getItemTemplateByName = (itemName: string) => {
    const trimmedName = itemName?.trim()?.replace(/\s+/g, ' ').trim();
    if (!trimmedName) return null;
    
    // 먼저 정확한 이름으로 찾기
    let template = CONSUMABLE_TEMPLATE_MAP[trimmedName] || MATERIAL_TEMPLATE_MAP[trimmedName];
    if (template) return template;
    // 장비/재료 상자 이름 정규화 후 재시도 (공백·숫자 변형 대응)
    const normalizedForBox = normalizeBoxItemName(trimmedName);
    if (normalizedForBox !== trimmedName) {
        template = CONSUMABLE_TEMPLATE_MAP[normalizedForBox] || MATERIAL_TEMPLATE_MAP[normalizedForBox];
        if (template) return template;
    }
    
    // 숫자를 로마숫자로 변환하는 맵
    const numToRoman: Record<string, string> = {
        '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI'
    };
    
    // 장비상자/재료상자 이름 변환: "장비상자1" -> "장비 상자 I"
    const boxNamePatterns = [
        { pattern: /장비상자(\d)/g, replacement: (num: string) => `장비 상자 ${numToRoman[num] || num}` },
        { pattern: /재료상자(\d)/g, replacement: (num: string) => `재료 상자 ${numToRoman[num] || num}` },
        { pattern: /장비 상자(\d)/g, replacement: (num: string) => `장비 상자 ${numToRoman[num] || num}` },
        { pattern: /재료 상자(\d)/g, replacement: (num: string) => `재료 상자 ${numToRoman[num] || num}` },
        { pattern: /장비 상자 (\d)/g, replacement: (num: string) => `장비 상자 ${numToRoman[num] || num}` },
        { pattern: /재료 상자 (\d)/g, replacement: (num: string) => `재료 상자 ${numToRoman[num] || num}` },
    ];
    
    for (const { pattern, replacement } of boxNamePatterns) {
        const converted = trimmedName.replace(pattern, (match, num) => replacement(num));
        if (converted !== trimmedName) {
            template = CONSUMABLE_TEMPLATE_MAP[converted] || MATERIAL_TEMPLATE_MAP[converted];
            if (template) return template;
        }
    }
    
    // 이름 불일치 처리: '골드꾸러미1' <-> '골드 꾸러미1'
    // '골드꾸러미' -> '골드 꾸러미' 변환
    if (trimmedName.includes('골드꾸러미')) {
        const withSpace = trimmedName.replace('골드꾸러미', '골드 꾸러미');
        template = CONSUMABLE_TEMPLATE_MAP[withSpace] || MATERIAL_TEMPLATE_MAP[withSpace];
        if (template) return template;
    }
    
    // 반대 방향: '골드 꾸러미1' -> '골드꾸러미1'
    if (trimmedName.includes('골드 꾸러미')) {
        const withoutSpace = trimmedName.replace('골드 꾸러미', '골드꾸러미');
        template = CONSUMABLE_TEMPLATE_MAP[withoutSpace] || MATERIAL_TEMPLATE_MAP[withoutSpace];
        if (template) return template;
    }
    
    // 다이아꾸러미 처리
    if (trimmedName.includes('다이아꾸러미')) {
        const withSpace = trimmedName.replace('다이아꾸러미', '다이아 꾸러미');
        template = CONSUMABLE_TEMPLATE_MAP[withSpace] || MATERIAL_TEMPLATE_MAP[withSpace];
        if (template) return template;
    }
    
    if (trimmedName.includes('다이아 꾸러미')) {
        const withoutSpace = trimmedName.replace('다이아 꾸러미', '다이아꾸러미');
        template = CONSUMABLE_TEMPLATE_MAP[withoutSpace] || MATERIAL_TEMPLATE_MAP[withoutSpace];
        if (template) return template;
    }
    
    return null;
};

export const addItemsToInventory = (currentInventory: InventoryItem[], inventorySlots: { equipment: number; consumable: number; material: number; }, itemsToAdd: InventoryItem[]): { success: boolean, finalItemsToAdd: InventoryItem[], updatedInventory: InventoryItem[] } => {
    const tempInventory = JSON.parse(JSON.stringify(currentInventory));
    const finalItemsToAdd: InventoryItem[] = [];

    const getMaxStackSize = (name: string): number => {
        // 행동력 회복제: 한 묶음 최대 20개
        if (isActionPointConsumable(name)) return 20;
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

export const createItemInstancesFromReward = (itemRefs: (InventoryItem | { itemId: string; quantity: number })[]): InventoryItem[] => {
    const createdItems: InventoryItem[] = [];
    for (const itemRef of itemRefs) {
        if ('id' in itemRef) {
            const inv = itemRef as InventoryItem;
            if (isMailAttachmentEquipment(inv)) {
                const cloned = JSON.parse(JSON.stringify(inv)) as InventoryItem;
                cloned.id = `item-${randomUUID()}`;
                delete cloned.mailPreEnhanced;
                if (!inv.mailPreEnhanced) {
                    const stars = getMailEquipmentDisplayStars(inv);
                    applyEnhancementStarsToEquipmentItem(cloned, stars);
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