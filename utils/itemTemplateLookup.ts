/**
 * 보상·상점 itemId → 템플릿 조회 (클라이언트 번들 안전, crypto 미사용).
 * 서버 `inventoryUtils.createItemInstancesFromReward`와 동일한 이름 정규화·조회.
 */
import { InventoryItem } from '../types/index.js';
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS, EQUIPMENT_POOL } from '../constants';

const CONSUMABLE_TEMPLATE_MAP: Record<string, Omit<InventoryItem, 'id' | 'createdAt' | 'isEquipped' | 'level' | 'stars' | 'options' | 'enhancementFails'>> =
    CONSUMABLE_ITEMS.reduce(
        (map, item) => {
            map[item.name] = item;
            return map;
        },
        {} as Record<string, Omit<InventoryItem, 'id' | 'createdAt' | 'isEquipped' | 'level' | 'stars' | 'options' | 'enhancementFails'>>
    );

const MATERIAL_TEMPLATE_MAP: Record<string, Omit<InventoryItem, 'id' | 'createdAt' | 'isEquipped' | 'level' | 'stars' | 'options' | 'enhancementFails'>> = {
    ...MATERIAL_ITEMS,
};

const SHOP_ITEM_ID_TO_DISPLAY_NAME: Record<string, string> = {
    action_point_10: '행동력 회복제(+10)',
    action_point_20: '행동력 회복제(+20)',
    action_point_30: '행동력 회복제(+30)',
    equipment_box_1: '장비 상자 I',
    equipment_box_2: '장비 상자 II',
    equipment_box_3: '장비 상자 III',
    equipment_box_4: '장비 상자 IV',
    equipment_box_5: '장비 상자 V',
    equipment_box_6: '장비 상자 VI',
    material_box_1: '재료 상자 I',
    material_box_2: '재료 상자 II',
    material_box_3: '재료 상자 III',
    material_box_4: '재료 상자 IV',
    material_box_5: '재료 상자 V',
    material_box_6: '재료 상자 VI',
    resource_box_1: '재료 상자 I',
    resource_box_2: '재료 상자 II',
    resource_box_3: '재료 상자 III',
    resource_box_4: '재료 상자 IV',
    resource_box_5: '재료 상자 V',
    resource_box_6: '재료 상자 VI',
};

export const normalizeBoxItemName = (name: string): string => {
    if (!name || typeof name !== 'string') return name;
    let trimmed = name.replace(/\s+/g, ' ').trim();
    if (typeof trimmed.normalize === 'function') {
        trimmed = trimmed.normalize('NFKC');
    }
    const fromShopId = SHOP_ITEM_ID_TO_DISPLAY_NAME[trimmed];
    if (fromShopId) return fromShopId;
    const numToRoman: Record<string, string> = {
        '1': 'I',
        '2': 'II',
        '3': 'III',
        '4': 'IV',
        '5': 'V',
        '6': 'VI',
    };
    let normalized = trimmed;
    normalized = normalized.replace(/골드꾸러미/g, '골드 꾸러미');
    normalized = normalized.replace(/다이아꾸러미/g, '다이아 꾸러미');
    normalized = normalized.replace(/장비상자(\d)/g, (_, num) => `장비 상자 ${numToRoman[num] || num}`);
    normalized = normalized.replace(/재료상자(\d)/g, (_, num) => `재료 상자 ${numToRoman[num] || num}`);
    normalized = normalized.replace(/장비 상자(\d)/g, (_, num) => `장비 상자 ${numToRoman[num] || num}`);
    normalized = normalized.replace(/재료 상자(\d)/g, (_, num) => `재료 상자 ${numToRoman[num] || num}`);
    normalized = normalized.replace(/장비 상자 (\d)/g, (_, num) => `장비 상자 ${numToRoman[num] || num}`);
    normalized = normalized.replace(/재료 상자 (\d)/g, (_, num) => `재료 상자 ${numToRoman[num] || num}`);
    normalized = normalized.replace(/골드 꾸러미(\d)/g, (_, num) => `골드 꾸러미 ${numToRoman[num] || num}`);
    normalized = normalized.replace(/다이아 꾸러미(\d)/g, (_, num) => `다이아 꾸러미 ${numToRoman[num] || num}`);
    // "장비상자III" / "장비 상자III" 등 — 숫자(3) 치환에 안 걸리는 로마 숫자 붙임 표기
    const roman = 'I|II|III|IV|V|VI';
    normalized = normalized.replace(new RegExp(`^장비\\s*상자\\s*(${roman})$`, 'i'), (_, r: string) => `장비 상자 ${r.toUpperCase()}`);
    normalized = normalized.replace(new RegExp(`^재료\\s*상자\\s*(${roman})$`, 'i'), (_, r: string) => `재료 상자 ${r.toUpperCase()}`);
    return normalized.trim();
};

const numToRomanBoxDigit: Record<string, string> = {
    '1': 'I',
    '2': 'II',
    '3': 'III',
    '4': 'IV',
    '5': 'V',
    '6': 'VI',
};

/** 상점·인벤 표기 차이(장비상자1 ↔ 장비 상자 I)를 한 키로 통일 — USE_ITEM/USE_ALL과 동일 */
export const canonicalShopConsumableBoxKey = (name: string): string => {
    let normalized = (name || '').replace(/\s+/g, ' ').trim();
    normalized = normalizeBoxItemName(normalized);
    normalized = normalized.replace(/장비상자(\d)/g, (_, num: string) => `장비 상자 ${numToRomanBoxDigit[num] || num}`);
    normalized = normalized.replace(/재료상자(\d)/g, (_, num: string) => `재료 상자 ${numToRomanBoxDigit[num] || num}`);
    normalized = normalized.replace(/장비 상자(\d)/g, (_, num: string) => `장비 상자 ${numToRomanBoxDigit[num] || num}`);
    normalized = normalized.replace(/재료 상자(\d)/g, (_, num: string) => `재료 상자 ${numToRomanBoxDigit[num] || num}`);
    normalized = normalized.replace(/장비 상자 (\d)/g, (_, num: string) => `장비 상자 ${numToRomanBoxDigit[num] || num}`);
    normalized = normalized.replace(/재료 상자 (\d)/g, (_, num: string) => `재료 상자 ${numToRomanBoxDigit[num] || num}`);
    return normalized.trim();
};

export const getItemTemplateByName = (itemName: string) => {
    const trimmedName = itemName?.trim()?.replace(/\s+/g, ' ').trim();
    if (!trimmedName) return null;

    const lookupKey =
        trimmedName === '신화 옵션 변경권'
            ? '스페셜 옵션 변경권'
            : (SHOP_ITEM_ID_TO_DISPLAY_NAME[trimmedName] ?? trimmedName);

    let template = CONSUMABLE_TEMPLATE_MAP[lookupKey] || MATERIAL_TEMPLATE_MAP[lookupKey];
    if (template) return template;
    const normalizedForBox = normalizeBoxItemName(lookupKey);
    if (normalizedForBox !== lookupKey) {
        template = CONSUMABLE_TEMPLATE_MAP[normalizedForBox] || MATERIAL_TEMPLATE_MAP[normalizedForBox];
        if (template) return template;
    }

    const numToRoman: Record<string, string> = {
        '1': 'I',
        '2': 'II',
        '3': 'III',
        '4': 'IV',
        '5': 'V',
        '6': 'VI',
    };

    const boxNamePatterns = [
        { pattern: /장비상자(\d)/g, replacement: (num: string) => `장비 상자 ${numToRoman[num] || num}` },
        { pattern: /재료상자(\d)/g, replacement: (num: string) => `재료 상자 ${numToRoman[num] || num}` },
        { pattern: /장비 상자(\d)/g, replacement: (num: string) => `장비 상자 ${numToRoman[num] || num}` },
        { pattern: /재료 상자(\d)/g, replacement: (num: string) => `재료 상자 ${numToRoman[num] || num}` },
        { pattern: /장비 상자 (\d)/g, replacement: (num: string) => `장비 상자 ${numToRoman[num] || num}` },
        { pattern: /재료 상자 (\d)/g, replacement: (num: string) => `재료 상자 ${numToRoman[num] || num}` },
    ];

    for (const { pattern, replacement } of boxNamePatterns) {
        const converted = lookupKey.replace(pattern, (match, num) => replacement(num));
        if (converted !== lookupKey) {
            template = CONSUMABLE_TEMPLATE_MAP[converted] || MATERIAL_TEMPLATE_MAP[converted];
            if (template) return template;
        }
    }

    if (lookupKey.includes('골드꾸러미')) {
        const withSpace = lookupKey.replace('골드꾸러미', '골드 꾸러미');
        template = CONSUMABLE_TEMPLATE_MAP[withSpace] || MATERIAL_TEMPLATE_MAP[withSpace];
        if (template) return template;
    }

    if (lookupKey.includes('골드 꾸러미')) {
        const withoutSpace = lookupKey.replace('골드 꾸러미', '골드꾸러미');
        template = CONSUMABLE_TEMPLATE_MAP[withoutSpace] || MATERIAL_TEMPLATE_MAP[withoutSpace];
        if (template) return template;
    }

    if (lookupKey.includes('다이아꾸러미')) {
        const withSpace = lookupKey.replace('다이아꾸러미', '다이아 꾸러미');
        template = CONSUMABLE_TEMPLATE_MAP[withSpace] || MATERIAL_TEMPLATE_MAP[withSpace];
        if (template) return template;
    }

    if (lookupKey.includes('다이아 꾸러미')) {
        const withoutSpace = lookupKey.replace('다이아 꾸러미', '다이아꾸러미');
        template = CONSUMABLE_TEMPLATE_MAP[withoutSpace] || MATERIAL_TEMPLATE_MAP[withoutSpace];
        if (template) return template;
    }

    const equip = EQUIPMENT_POOL.find((e) => e.name === lookupKey);
    if (equip) {
        return { ...equip } as (typeof CONSUMABLE_TEMPLATE_MAP)[string];
    }

    return null;
};

/** 일괄 사용: 표기 차이·레거시 material 저장 스택을 동일 소모품으로 합산 */
export const inventoryStacksMatchConsumableBulkAnchor = (
    anchorName: string,
    row: Pick<InventoryItem, 'name' | 'type'> | null | undefined,
): boolean => {
    if (!row || (row.type !== 'consumable' && row.type !== 'material')) return false;
    const anchorTpl = getItemTemplateByName(anchorName);
    const rowTpl = getItemTemplateByName(row.name || '');
    if (anchorTpl?.type === 'consumable' && rowTpl && rowTpl.name === anchorTpl.name) {
        return true;
    }
    return row.type === 'consumable' && row.name === anchorName;
};
