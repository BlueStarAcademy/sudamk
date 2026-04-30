import { InventoryItem, ItemGrade } from '../../types.js';
import {
    CONSUMABLE_ITEMS,
    ENHANCEMENT_COSTS,
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
