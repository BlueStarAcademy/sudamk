import { InventoryItem, ItemGrade } from '../../types.js';
import {
    CONSUMABLE_ITEMS,
    ENHANCEMENT_COSTS,
    EQUIPMENT_POOL,
    MATERIAL_ITEMS,
    gradeStyles,
    isActionPointConsumable,
    isConditionPotionConsumable,
    isRefinementTicketMaterial,
} from '../../constants/items.js';

const gradeOrder: Record<ItemGrade, number> = {
    normal: 0,
    uncommon: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
    mythic: 5,
    transcendent: 6,
};

function mergeConsecutiveStarLevels(levels: number[]): [number, number][] {
    const unique = [...new Set(levels)].sort((a, b) => a - b);
    if (unique.length === 0) return [];
    const ranges: [number, number][] = [];
    let start = unique[0];
    let end = unique[0];
    for (let i = 1; i < unique.length; i++) {
        if (unique[i] === end + 1) {
            end = unique[i];
        } else {
            ranges.push([start, end]);
            start = end = unique[i];
        }
    }
    ranges.push([start, end]);
    return ranges;
}

function formatEnhancementRangeLabel(min: number, max: number): string {
    if (min === max) return `${min}강화`;
    return `${min}~${max}강화`;
}

export function getEnhancementMaterialUsageLinesForBag(materialName: string): string[] {
    const groupedDetails: Record<ItemGrade, number[]> = {
        [ItemGrade.Normal]: [],
        [ItemGrade.Uncommon]: [],
        [ItemGrade.Rare]: [],
        [ItemGrade.Epic]: [],
        [ItemGrade.Legendary]: [],
        [ItemGrade.Mythic]: [],
        [ItemGrade.Transcendent]: [],
    };

    for (const grade in ENHANCEMENT_COSTS) {
        const costsForGrade = ENHANCEMENT_COSTS[grade as ItemGrade];
        costsForGrade.forEach((costArray, starIndex) => {
            costArray.forEach((cost) => {
                if (cost.name === materialName) {
                    groupedDetails[grade as ItemGrade].push(starIndex + 1);
                }
            });
        });
    }

    const gradeKeys = Object.keys(groupedDetails) as ItemGrade[];
    gradeKeys.sort((a, b) => gradeOrder[a] - gradeOrder[b]);

    const details: string[] = [];
    for (const grade of gradeKeys) {
        const starLevels = groupedDetails[grade];
        if (starLevels.length === 0) continue;
        const label = gradeStyles[grade].name;
        for (const [lo, hi] of mergeConsecutiveStarLevels(starLevels)) {
            details.push(`[${label}] 장비 : ${formatEnhancementRangeLabel(lo, hi)}`);
        }
    }
    return details;
}

export function getMaterialBagUsageLines(materialName: string): string[] {
    if (materialName === '귀속 해제권') {
        return ['[가방]-[장비선택]-[귀속해제]'];
    }
    if (materialName === '거래 등록권') {
        return ['거래소 - 판매 등록'];
    }
    if (materialName === '제련의 부적') {
        return ['[대장간]-[장비제련] 제련불가 장비 선택'];
    }
    if (isRefinementTicketMaterial(materialName)) {
        const ticketAction: Record<string, string> = {
            '옵션 종류 변경권': '옵션 종류변경',
            '옵션 수치 변경권': '옵션 수치변경',
            '스페셜 옵션 변경권': '스페셜 옵션변경',
            '신화 옵션 변경권': '신화 옵션변경',
        };
        const action = ticketAction[materialName] ?? '옵션 변경';
        return [`[대장간 - 장비제련] ${action}`];
    }
    return getEnhancementMaterialUsageLinesForBag(materialName);
}

export const normalizeConsumableName = (name: string): string => {
    const numToRoman: Record<string, string> = {
        '1': 'I',
        '2': 'II',
        '3': 'III',
        '4': 'IV',
        '5': 'V',
        '6': 'VI',
    };
    let normalized = (name || '').replace(/\s+/g, ' ').trim();
    normalized = normalized
        .replace(/장비상자/g, '장비 상자')
        .replace(/재료상자/g, '재료 상자')
        .replace(/골드꾸러미/g, '골드 꾸러미')
        .replace(/다이아꾸러미/g, '다이아 꾸러미');

    for (const [num, roman] of Object.entries(numToRoman)) {
        normalized = normalized.replace(new RegExp(`(장비 상자|재료 상자)[\\s]*${num}`, 'g'), `$1 ${roman}`);
    }
    normalized = normalized.replace(/골드 꾸러미(\d)/g, (_, num) => `골드 꾸러미 ${numToRoman[num] || num}`);
    normalized = normalized.replace(/다이아 꾸러미(\d)/g, (_, num) => `다이아 꾸러미 ${numToRoman[num] || num}`);

    return normalized.trim();
};

export function findConsumableItem(itemName: string) {
    if (!itemName) return undefined;

    const normalizedItemName = normalizeConsumableName(itemName);

    const numToRoman: Record<string, string> = {
        '1': 'I',
        '2': 'II',
        '3': 'III',
        '4': 'IV',
        '5': 'V',
        '6': 'VI',
    };

    const variations: string[] = [
        itemName,
        normalizedItemName,
        itemName.replace('꾸러미', ' 꾸러미'),
        itemName.replace(' 꾸러미', '꾸러미'),
        itemName.replace('상자', ' 상자'),
        itemName.replace(' 상자', '상자'),
    ];

    for (const [num, roman] of Object.entries(numToRoman)) {
        variations.push(
            itemName.replace(new RegExp(`장비상자${num}`, 'g'), `장비 상자 ${roman}`),
            itemName.replace(new RegExp(`재료상자${num}`, 'g'), `재료 상자 ${roman}`),
            itemName.replace(new RegExp(`장비 상자${num}`, 'g'), `장비 상자 ${roman}`),
            itemName.replace(new RegExp(`재료 상자${num}`, 'g'), `재료 상자 ${roman}`),
            itemName.replace(new RegExp(`장비 상자 ${num}`, 'g'), `장비 상자 ${roman}`),
            itemName.replace(new RegExp(`재료 상자 ${num}`, 'g'), `재료 상자 ${roman}`)
        );
    }

    const uniqueVariations = Array.from(new Set(variations));

    return CONSUMABLE_ITEMS.find((ci) => uniqueVariations.some((variation) => ci.name === variation));
}

export function resolveBagItemDetailImagePath(item: InventoryItem): string | undefined {
    let imagePath: string | undefined = item.image;

    if (!imagePath && item.type === 'consumable') {
        const consumableItem = findConsumableItem(item.name);
        imagePath = consumableItem?.image;
    }

    if (!imagePath) {
        const numToRoman: Record<string, string> = {
            '1': 'I',
            '2': 'II',
            '3': 'III',
            '4': 'IV',
            '5': 'V',
            '6': 'VI',
        };

        const nameVariations: string[] = [
            item.name,
            item.name.replace('꾸러미', ' 꾸러미'),
            item.name.replace(' 꾸러미', '꾸러미'),
            item.name.replace('상자', ' 상자'),
            item.name.replace(' 상자', '상자'),
        ];

        for (const [num, roman] of Object.entries(numToRoman)) {
            nameVariations.push(
                item.name.replace(new RegExp(`장비상자${num}`, 'g'), `장비 상자 ${roman}`),
                item.name.replace(new RegExp(`재료상자${num}`, 'g'), `재료 상자 ${roman}`),
                item.name.replace(new RegExp(`장비 상자${num}`, 'g'), `장비 상자 ${roman}`),
                item.name.replace(new RegExp(`재료 상자${num}`, 'g'), `재료 상자 ${roman}`),
                item.name.replace(new RegExp(`장비 상자 ${num}`, 'g'), `장비 상자 ${roman}`),
                item.name.replace(new RegExp(`재료 상자 ${num}`, 'g'), `재료 상자 ${roman}`)
            );
        }

        nameVariations.push(normalizeConsumableName(item.name));

        for (const nameVar of nameVariations) {
            if (MATERIAL_ITEMS[nameVar]?.image) {
                imagePath = MATERIAL_ITEMS[nameVar].image;
                break;
            }
        }
    }

    return imagePath;
}

/** 획득 모달 등: 서버 `description`이 비었을 때 템플릿·통화 기본 문구 */
export function resolveItemObtainDescription(item: InventoryItem): string {
    const trimmed = (item.description || '').trim();
    if (trimmed) return trimmed;
    if (item.image === '/images/icon/Gold.webp') {
        return '바둑계 전역에서 사용되는 대표 화폐입니다.';
    }
    if (item.image === '/images/icon/Zem.webp') {
        return '특별한 구매·확장 등에 사용되는 프리미엄 재화입니다.';
    }
    if (item.type === 'consumable') {
        const c = findConsumableItem(item.name);
        if (c?.description) return (c.description || '').trim();
    }
    if (item.type === 'material') {
        const m = MATERIAL_ITEMS[item.name];
        if (m?.description) return (m.description || '').trim();
        const normalized = normalizeConsumableName(item.name);
        const m2 = MATERIAL_ITEMS[normalized];
        if (m2?.description) return (m2.description || '').trim();
    }
    return '';
}

export function resolveItemObtainUsageLines(item: InventoryItem): string[] {
    if (item.image === '/images/icon/Gold.webp') {
        return ['상점, 강화·제작, 입장료 등 골드 소비처에서 사용됩니다.'];
    }
    if (item.image === '/images/icon/Zem.webp') {
        return ['다이아 상점, 가방 슬롯 확장 등에서 사용됩니다.'];
    }
    if (item.type === 'material') {
        return getMaterialBagUsageLines(item.name);
    }
    if (item.type === 'consumable') {
        const hint = getBagConsumableUsageHint(item.name);
        return hint ? [hint] : [];
    }
    return [];
}

/** 상점 수량 모달: 본문 설명(카드에 없는 경우 템플릿 보강) */
export function resolvePurchaseModalDescription(params: { description?: string; name: string; type: InventoryItem['type'] }): string {
    const trimmed = (params.description || '').trim();
    if (trimmed) return trimmed;
    if (params.type === 'consumable') {
        const c = findConsumableItem(params.name);
        if (c?.description) return (c.description || '').trim();
    }
    if (params.type === 'material') {
        const m = MATERIAL_ITEMS[params.name];
        if (m?.description) return (m.description || '').trim();
        const m2 = MATERIAL_ITEMS[normalizeConsumableName(params.name)];
        if (m2?.description) return (m2.description || '').trim();
    }
    return '';
}

export function resolvePurchaseModalUsageLines(params: { name: string; type: InventoryItem['type'] }): string[] {
    if (params.type === 'material') {
        return getMaterialBagUsageLines(params.name);
    }
    const hint = getBagConsumableUsageHint(params.name);
    if (hint) return [hint];
    if (params.type === 'equipment') {
        return ['가방에서 상자를 사용하면 장비를 획득할 수 있습니다.'];
    }
    return [];
}

function normalizeInventoryImagePath(raw: string | undefined): string {
    const t = (raw || '').trim();
    if (!t) return '';
    return t.startsWith('/') ? t : `/${t}`;
}

/**
 * 상점·구매 수량 모달 등: `EquipmentDetailPanel`에 넣을 `InventoryItem` 미리보기(보유 0, 가짜 id).
 */
export function buildInventoryItemPreviewForPurchase(params: {
    itemId: string;
    name: string;
    type: InventoryItem['type'];
    image?: string;
    description?: string;
    /** 템플릿에 없는 상점 전용 이름 등 — 등급 배지용 */
    gradeHint?: ItemGrade;
}): InventoryItem {
    const now = Date.now();
    const desc = resolvePurchaseModalDescription({
        description: params.description,
        name: params.name,
        type: params.type,
    });
    const imgParam = normalizeInventoryImagePath(params.image);

    const consumableTemplate = findConsumableItem(params.name);
    if (consumableTemplate) {
        return {
            id: params.itemId,
            name: consumableTemplate.name,
            description: (desc || (consumableTemplate.description || '').trim()).trim() || '—',
            type: 'consumable',
            slot: null,
            quantity: 0,
            level: 0,
            isEquipped: false,
            createdAt: now,
            image: imgParam || normalizeInventoryImagePath(consumableTemplate.image),
            grade: params.gradeHint !== undefined ? params.gradeHint : consumableTemplate.grade,
            stars: 0,
        };
    }

    const mat = MATERIAL_ITEMS[params.name] || MATERIAL_ITEMS[normalizeConsumableName(params.name)];
    if (mat) {
        const tpl = mat as InventoryItem & { templateId?: string };
        return {
            id: params.itemId,
            name: mat.name,
            description: (desc || (mat.description || '').trim()).trim() || '—',
            type: 'material',
            slot: mat.slot,
            quantity: 0,
            level: 0,
            isEquipped: false,
            createdAt: now,
            image: imgParam || normalizeInventoryImagePath(mat.image),
            grade: params.gradeHint !== undefined ? params.gradeHint : mat.grade,
            stars: 0,
            templateId: tpl.templateId,
        };
    }

    const poolRow = EQUIPMENT_POOL.find((e) => e.name === params.name);
    if (poolRow && params.type === 'equipment') {
        return {
            id: params.itemId,
            name: poolRow.name,
            description: (desc || poolRow.description || '').trim() || '—',
            type: 'equipment',
            slot: poolRow.slot,
            quantity: 0,
            level: 0,
            isEquipped: false,
            createdAt: now,
            image: imgParam || normalizeInventoryImagePath(poolRow.image),
            grade: poolRow.grade,
            stars: poolRow.stars ?? 0,
        };
    }

    return {
        id: params.itemId,
        name: params.name,
        description: desc.trim() || '—',
        type: params.type === 'equipment' ? 'consumable' : params.type,
        slot: null,
        quantity: 0,
        level: 0,
        isEquipped: false,
        createdAt: now,
        image: imgParam || '/images/icon/Gold.webp',
        grade: params.gradeHint !== undefined ? params.gradeHint : ItemGrade.Normal,
        stars: 0,
    };
}

export function getBagConsumableUsageHint(name: string): string | null {
    if (isConditionPotionConsumable(name)) {
        const compact = name.replace(/\s+/g, '');
        let lo = 1;
        let hi = 10;
        if (compact.includes('(중)')) {
            lo = 10;
            hi = 20;
        } else if (compact.includes('(대)')) {
            lo = 20;
            hi = 30;
        }
        return `[챔피언십] 경기시작 전 컨디션 ${lo}~${hi}회복`;
    }
    if (isActionPointConsumable(name)) {
        const m = name.match(/\+(\d+)/);
        const n = m ? m[1] : '';
        return n ? `[즉시사용] 행동력 회복 +${n}` : '[즉시사용] 행동력 회복';
    }
    const compact = name.replace(/\s+/g, '');
    if (compact.includes('꾸러미') || compact.includes('상자')) {
        return '가방에서 사용하면 보상을 획득합니다.';
    }
    return null;
}

/** 행동력 회복제 슬롯 한 변(px) 기준 ⚡ 이모지 크기 */
export function apConsumableLightningEmojiPx(slotSidePx: number): number {
    const s = Math.max(20, Math.min(140, slotSidePx));
    return Math.max(10, Math.min(64, Math.round(s * 0.46)));
}

/** 같은 슬롯 기준 +N 라벨(px) */
export function apConsumableLightningPlusLabelPx(slotSidePx: number): number {
    const s = Math.max(20, Math.min(140, slotSidePx));
    return Math.max(7, Math.min(14, Math.round(s * 0.16)));
}

/**
 * `container-type: size` 정사각형 슬롯 안에서 슬롯이 줄어들면 번개도 줄어듦.
 * (Inventory 그리드 셀 등 px를 알 수 없을 때)
 */
export const AP_CONSUMABLE_LIGHTNING_FONT_SIZE_CQ = 'clamp(10px, 42cqmin, 58px)' as const;
export const AP_CONSUMABLE_PLUS_FONT_SIZE_CQ = 'clamp(7px, 14cqmin, 13px)' as const;
