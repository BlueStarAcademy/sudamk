import type { InventoryItem, ItemOption, ItemOptions } from '../types/entities.js';
import { ItemGrade } from '../types/enums.js';
import { repairEquipmentStatBounds } from './equipmentStatBoundsRepair.js';

const n = (x: unknown): number => {
    if (typeof x === 'number' && Number.isFinite(x)) return x;
    const v = Number(x);
    return Number.isFinite(v) ? v : 0;
};

const nRange = (r: unknown): [number, number] | undefined => {
    if (!Array.isArray(r) || r.length < 2) return undefined;
    const a = n(r[0]);
    const b = n(r[1]);
    return [a, b];
};

function coerceItemOption(opt: ItemOption): ItemOption {
    const value = n(opt.value);
    const baseValue = opt.baseValue !== undefined ? n(opt.baseValue) : undefined;
    const range = nRange(opt.range);
    const enhancements = opt.enhancements !== undefined ? Math.max(0, Math.floor(n(opt.enhancements))) : undefined;
    const tier = opt.tier !== undefined ? Math.floor(n(opt.tier)) : undefined;
    let display = opt.display;
    if (
        typeof display === 'string' &&
        (typeof opt.value === 'string' ||
            (opt.range && (typeof opt.range[0] === 'string' || typeof opt.range[1] === 'string')))
    ) {
        const pct = opt.isPercentage ? '%' : '';
        const rng = range ? ` [${range[0]}~${range[1]}]` : '';
        display = `${opt.type} +${value}${pct}${rng}`;
    }
    return {
        ...opt,
        value,
        ...(baseValue !== undefined ? { baseValue } : {}),
        ...(range ? { range } : {}),
        ...(enhancements !== undefined ? { enhancements } : {}),
        ...(tier !== undefined ? { tier } : {}),
        display,
    };
}

/**
 * DB·JSON 직렬화로 value/range가 문자열이 되면 `+=` 시 "10"+8 → "108" 같은 버그가 난다.
 * 로드 시점에 숫자로 고치고, 문자열이었으면 display도 재구성한다.
 */
export function normalizeEquipmentOptionNumbers(item: InventoryItem): InventoryItem {
    if (!item || item.type !== 'equipment' || !item.options) return item;
    const o = item.options as ItemOptions;
    const main = coerceItemOption(o.main);
    const combatSubs = (o.combatSubs || []).map(coerceItemOption);
    const specialSubs = (o.specialSubs || []).map(coerceItemOption);
    const mythicSubs = (o.mythicSubs || []).map((m) => ({
        ...m,
        value: n(m.value),
        enhancements: m.enhancements !== undefined ? Math.max(0, Math.floor(n(m.enhancements))) : undefined,
    }));
    const stars = n(item.stars);
    return {
        ...item,
        stars: Math.max(0, Math.min(10, Math.floor(stars))),
        options: { main, combatSubs, specialSubs, mythicSubs },
    };
}

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
        grade = ItemGrade.Transcendent;
    }
    const hadDivineField = anyItem.isDivineMythic !== undefined;
    const { isDivineMythic: _strip, ...rest } = anyItem;
    if (name === item.name && grade === item.grade && !hadDivineField) return item;
    return { ...rest, name, grade };
}

export function normalizeInventoryEquipmentItem(item: InventoryItem): InventoryItem {
    const legacy = normalizeLegacyDivineMythicInventoryItem(item);
    const coerced = normalizeEquipmentOptionNumbers(legacy);
    return repairEquipmentStatBounds(coerced);
}

export function mapNormalizeInventoryList(items: InventoryItem[]): InventoryItem[] {
    return items.map(normalizeInventoryEquipmentItem);
}
