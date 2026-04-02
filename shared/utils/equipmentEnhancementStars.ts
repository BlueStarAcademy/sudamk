import type { InventoryItem, ItemOption } from '../types/entities.js';
import { ItemGrade, CoreStat } from '../types/enums.js';
import {
    MAIN_ENHANCEMENT_STEP_MULTIPLIER,
    CORE_STATS_DATA,
    GRADE_SUB_OPTION_RULES,
    SUB_OPTION_POOLS,
    resolveCombatSubPoolDefinition,
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

const getRandomInt = (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * ENHANCE_ITEM 성공 시와 동일한 규칙으로 부옵션(전투)만 1회 강화를 시뮬레이션.
 * (인게임 강화는 특수옵션·신화옵션 수치를 올리지 않음 — 생성 시 롤 값 유지)
 */
function simulateOneEnhancementTickForCombatSubs(item: InventoryItem): void {
    const opts = item.options;
    const slot = item.slot;
    if (!opts || !slot) return;

    const main = opts.main;
    const grade = item.grade ?? ItemGrade.Normal;

    if (opts.combatSubs.length < 4) {
        const rules = GRADE_SUB_OPTION_RULES[grade];
        const existingSubTypes = new Set([main.type, ...opts.combatSubs.map((s) => s.type)]);
        const combatTier = rules.combatTier;
        const combatPool = SUB_OPTION_POOLS[slot][combatTier].filter((opt) => !existingSubTypes.has(opt.type));
        if (combatPool.length > 0) {
            const newSubDef = combatPool[Math.floor(Math.random() * combatPool.length)];
            const value = getRandomInt(newSubDef.range[0], newSubDef.range[1]);
            const newSub: ItemOption = {
                type: newSubDef.type,
                value,
                isPercentage: newSubDef.isPercentage,
                display: `${newSubDef.type} +${value}${newSubDef.isPercentage ? '%' : ''} [${newSubDef.range[0]}~${newSubDef.range[1]}]`,
                range: newSubDef.range,
                enhancements: 0,
            };
            opts.combatSubs.push(newSub);
        }
    } else {
        const subToUpgrade = opts.combatSubs[Math.floor(Math.random() * opts.combatSubs.length)];
        subToUpgrade.enhancements = (subToUpgrade.enhancements || 0) + 1;

        const itemTier = GRADE_SUB_OPTION_RULES[grade].combatTier;
        const subOptionPool = SUB_OPTION_POOLS[slot][itemTier];
        const subDef = resolveCombatSubPoolDefinition(
            subOptionPool,
            subToUpgrade.type as CoreStat,
            subToUpgrade.isPercentage
        );

        if (subDef) {
            const increaseAmount = getRandomInt(subDef.range[0], subDef.range[1]);
            subToUpgrade.value += increaseAmount;

            if (!subToUpgrade.range) {
                subToUpgrade.range = [subDef.range[0], subDef.range[1]];
            } else {
                subToUpgrade.range[0] += subDef.range[0];
                subToUpgrade.range[1] += subDef.range[1];
            }

            subToUpgrade.display = `${subToUpgrade.type} +${subToUpgrade.value}${subToUpgrade.isPercentage ? '%' : ''} [${subToUpgrade.range[0]}~${subToUpgrade.range[1]}]`;
        } else {
            subToUpgrade.value = parseFloat((subToUpgrade.value * 1.1).toFixed(2));
            subToUpgrade.display = `${subToUpgrade.type} +${subToUpgrade.value}${subToUpgrade.isPercentage ? '%' : ''}`;
        }
    }
}

/** +0~+10 강화 단계에 맞춰 주옵션·부옵션(전투)을 ENHANCE_ITEM과 동일 규칙으로 반영. 특수/신화는 생성 롤 유지 */
export function applyEnhancementStarsToEquipmentItem(item: InventoryItem, stars: number): void {
    if (!isMailAttachmentEquipment(item) || !item.options?.main?.baseValue) return;
    const clamped = Math.max(0, Math.min(10, Math.floor(Number(stars)) || 0));
    item.stars = clamped;

    for (let t = 0; t < clamped; t++) {
        simulateOneEnhancementTickForCombatSubs(item);
    }

    const main = item.options.main;
    const baseValue = main.baseValue!;
    const multipliers = MAIN_ENHANCEMENT_STEP_MULTIPLIER[item.grade];
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

function computeEnhancedMainValueAtStars(baseValue: number, grade: ItemGrade, stars: number): number {
    const s = Math.max(0, Math.min(10, Math.floor(stars)));
    const multipliers = MAIN_ENHANCEMENT_STEP_MULTIPLIER[grade];
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
    for (let s = 0; s <= 10; s++) {
        const v = computeEnhancedMainValueAtStars(baseValue, grade, s);
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
