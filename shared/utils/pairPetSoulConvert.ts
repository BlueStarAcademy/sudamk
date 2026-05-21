import { ItemGrade } from '../types/enums.js';
import type { InventoryItem } from '../types/entities.js';
import { MATERIAL_ITEMS } from '../constants/items.js';
import {
    PAIR_SOULSTONE_NAMES,
    isPairEggItem,
    isPairPetMaterial,
    pairSoulTemplateIdFromTier,
    pairSoulTierFromMaterialName,
} from '../constants/petLobby.js';
import {
    PAIR_PET_MAX_LEVEL,
    effectivePairPetGradeFromRow,
    pairPetGradeIndex,
} from '../constants/pairPetGrade.js';
import { addItemsToInventory } from '../../utils/inventoryUtils.js';
import { resolvePairPetMetaFromInventoryRow } from './pairPetRoll.js';

/** 영혼변환 보상 영혼석 — 펫 저장 등급에 대응하는 티어 (신화·초월도 최상위 천광 티어). */
export function pairPetSoulConvertMaterialNameForGrade(grade: ItemGrade): string {
    const i = pairPetGradeIndex(grade);
    const idx = Math.min(PAIR_SOULSTONE_NAMES.length - 1, Math.max(0, i));
    return PAIR_SOULSTONE_NAMES[idx]!;
}

/**
 * Lv.1~9 일의 자리 기준 구간용 숫자 (10,20,…,50 은 10으로 취급).
 * 1~5 → 저구간(1~3개), 6~10 → 고구간(3~5개).
 */
export function pairPetSoulConvertLevelBracketDigit(level: number): number {
    const lv = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(level) || 1));
    const d = lv % 10;
    return d === 0 ? 10 : d;
}

export function pairPetSoulConvertIsMythicTierGrade(grade: ItemGrade): boolean {
    return grade === ItemGrade.Mythic || grade === ItemGrade.Transcendent;
}

/** 신화·초월: 항상 5개. 그 외: 일의 자리 구간에 따라 1~3 또는 3~5 무작위 */
export function rollPairPetSoulConvertRewardQuantity(
    grade: ItemGrade,
    level: number,
    rng: () => number
): number {
    if (pairPetSoulConvertIsMythicTierGrade(grade)) return 5;
    const digit = pairPetSoulConvertLevelBracketDigit(level);
    const lowBracket = digit <= 5;
    const min = lowBracket ? 1 : 3;
    const max = lowBracket ? 3 : 5;
    return min + Math.floor(rng() * (max - min + 1));
}

export type PairPetSoulConvertPreview = {
    materialName: string;
    mythicTier: boolean;
    fixedQty?: number;
    qtyMin?: number;
    qtyMax?: number;
};

export function buildPairPetSoulConvertRewardStack(row: InventoryItem, quantity: number): InventoryItem {
    const materialName = pairPetSoulConvertMaterialNameForGrade(effectivePairPetGradeFromRow(row));
    const base = MATERIAL_ITEMS[materialName as keyof typeof MATERIAL_ITEMS];
    if (!base) throw new Error(`Unknown soul material: ${materialName}`);
    const templateId = pairSoulTemplateIdFromTier(pairSoulTierFromMaterialName(materialName));
    return {
        id: `item-${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
        name: base.name,
        description: base.description,
        type: 'material',
        slot: null,
        level: 1,
        stars: 0,
        isEquipped: false,
        createdAt: Date.now(),
        image: base.image,
        grade: base.grade,
        quantity,
        templateId,
    };
}

export type OptimisticPairPetSoulConvertResult =
    | { ok: true; nextInventory: InventoryItem[]; soulStack: InventoryItem }
    | { ok: false; error: string };

/** 클라이언트 즉시 반영용 — 서버 `PAIR_PET_CONVERT_PET`와 동일 규칙(수량은 클라 롤, 수령 시 서버 값으로 정정). */
export function computeOptimisticPairPetSoulConvert(
    inventory: InventoryItem[],
    inventorySlots: { equipment: number; consumable: number; material: number },
    itemId: string,
    rng: () => number = Math.random
): OptimisticPairPetSoulConvertResult {
    const rowIdx = inventory.findIndex((it) => it.id === itemId);
    if (rowIdx < 0) return { ok: false, error: '아이템을 찾을 수 없습니다.' };
    const row = inventory[rowIdx]!;
    if (!isPairPetMaterial(row) || isPairEggItem(row) || (row.quantity ?? 1) < 1) {
        return { ok: false, error: '변환할 수 있는 펫이 아닙니다.' };
    }
    const grade = effectivePairPetGradeFromRow(row);
    const meta = resolvePairPetMetaFromInventoryRow(row);
    const level = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(meta.level) || 1));
    const soulQty = rollPairPetSoulConvertRewardQuantity(grade, level, rng);
    const soulStack = buildPairPetSoulConvertRewardStack(row, soulQty);

    const nextQty = (row.quantity ?? 1) - 1;
    const afterPet = [...inventory];
    if (nextQty <= 0) afterPet.splice(rowIdx, 1);
    else afterPet[rowIdx] = { ...row, quantity: nextQty };

    const merged = addItemsToInventory(afterPet, inventorySlots, [soulStack]);
    if (!merged.success || !merged.updatedInventory) {
        return { ok: false, error: '인벤토리 공간이 부족해 변환 보상을 받을 수 없습니다.' };
    }
    return { ok: true, nextInventory: merged.updatedInventory, soulStack };
}

export function getPairPetSoulConvertPreview(row: InventoryItem): PairPetSoulConvertPreview {
    const grade = effectivePairPetGradeFromRow(row);
    const meta = resolvePairPetMetaFromInventoryRow(row);
    const level = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(meta.level) || 1));
    const materialName = pairPetSoulConvertMaterialNameForGrade(grade);
    if (pairPetSoulConvertIsMythicTierGrade(grade)) {
        return { materialName, mythicTier: true, fixedQty: 5 };
    }
    const lowBracket = pairPetSoulConvertLevelBracketDigit(level) <= 5;
    return lowBracket
        ? { materialName, mythicTier: false, qtyMin: 1, qtyMax: 3 }
        : { materialName, mythicTier: false, qtyMin: 3, qtyMax: 5 };
}
