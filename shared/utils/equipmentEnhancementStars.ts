import type { InventoryItem } from '../types/entities.js';
import { ItemGrade, CoreStat } from '../types/enums.js';
import {
    MAIN_ENHANCEMENT_STEP_MULTIPLIER,
    DIVINE_MYTHIC_ENHANCEMENT_STEP_MULTIPLIER,
    CORE_STATS_DATA,
} from '../constants/index.js';

/** 관리자·API 페이로드 등에서 강화 단계(0~10) 정수로 정규화 (문자열 등 대응) */
export function parseEquipmentStarsFromPayload(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(10, Math.floor(n)));
}

export function isMailAttachmentEquipment(item: InventoryItem): boolean {
    if (item.type === 'equipment') return true;
    if (item.type === 'consumable' || item.type === 'material') return false;
    return item.slot != null;
}

/** +0~+10 강화 단계에 맞춰 주옵션 수치를 실제 강화 로직과 동일하게 재계산 */
export function applyEnhancementStarsToEquipmentItem(item: InventoryItem, stars: number): void {
    if (!isMailAttachmentEquipment(item) || !item.options?.main?.baseValue) return;
    const clamped = Math.max(0, Math.min(10, Math.floor(Number(stars)) || 0));
    item.stars = clamped;
    const main = item.options.main;
    const baseValue = main.baseValue!;
    const isDivineMythic = item.grade === ItemGrade.Mythic && item.isDivineMythic === true;
    const multipliers = isDivineMythic
        ? DIVINE_MYTHIC_ENHANCEMENT_STEP_MULTIPLIER
        : MAIN_ENHANCEMENT_STEP_MULTIPLIER[item.grade];
    let enhancedIncreaseTotal = 0;
    for (let i = 0; i < clamped; i++) {
        const idx = Math.max(0, Math.min(9, i));
        enhancedIncreaseTotal += Math.round(baseValue * (multipliers?.[idx] ?? 1));
    }
    const enhancedValue = parseFloat((baseValue + enhancedIncreaseTotal).toFixed(2));
    const statName = CORE_STATS_DATA[main.type as CoreStat]?.name || main.type;
    main.value = enhancedValue;
    main.display = `${statName} +${enhancedValue}${main.isPercentage ? '%' : ''}`;
}

function computeEnhancedMainValueAtStars(
    baseValue: number,
    grade: ItemGrade,
    isDivineMythic: boolean,
    stars: number
): number {
    const s = Math.max(0, Math.min(10, Math.floor(stars)));
    const multipliers = isDivineMythic
        ? DIVINE_MYTHIC_ENHANCEMENT_STEP_MULTIPLIER
        : MAIN_ENHANCEMENT_STEP_MULTIPLIER[grade];
    let enhancedIncreaseTotal = 0;
    for (let i = 0; i < s; i++) {
        const idx = Math.max(0, Math.min(9, i));
        enhancedIncreaseTotal += Math.round(baseValue * (multipliers?.[idx] ?? 1));
    }
    return parseFloat((baseValue + enhancedIncreaseTotal).toFixed(2));
}

/** 주옵션 수치로부터 강화 단계(0~10) 역추정 (직렬화 등으로 stars 필드가 없을 때) */
export function inferStarsFromEquipmentMain(item: InventoryItem): number | null {
    const main = item.options?.main;
    if (!main?.baseValue || main.value == null || Number.isNaN(Number(main.value))) return null;
    const baseValue = main.baseValue;
    const current = Number(main.value);
    const grade = item.grade ?? ItemGrade.Normal;
    const isDivineMythic = item.grade === ItemGrade.Mythic && item.isDivineMythic === true;
    for (let s = 0; s <= 10; s++) {
        const v = computeEnhancedMainValueAtStars(baseValue, grade, isDivineMythic, s);
        if (Math.abs(v - current) < 0.51) return s;
    }
    return null;
}

/** 우편 첨부 UI용: stars 필드 우선, 없으면 주옵션으로 역추정 */
export function getMailEquipmentDisplayStars(item: InventoryItem): number {
    if (!isMailAttachmentEquipment(item)) return 0;
    const raw = item.stars;
    if (raw != null && Number.isFinite(Number(raw))) {
        return Math.max(0, Math.min(10, Math.floor(Number(raw))));
    }
    return inferStarsFromEquipmentMain(item) ?? 0;
}
