import type { InventoryItem, ItemOption } from '../types/entities.js';
import { CoreStat, SpecialStat } from '../types/enums.js';
import {
    MAIN_ENHANCEMENT_STEP_MULTIPLIER,
    GRADE_SUB_OPTION_RULES,
    SUB_OPTION_POOLS,
    SPECIAL_STATS_DATA,
    resolveCombatSubPoolDefinition,
} from '../constants/index.js';
import { formatSpecialSubItemDisplay, getSpecialStatMilestoneValueDelta } from './specialStatMilestones.js';

export const getEnhancementStepBonusMultiplier = (targetStars: number): number =>
    targetStars === 4 || targetStars === 7 || targetStars === 10 ? 2 : 1;

const randomIntInclusive = (min: number, max: number, rng: () => number): number => {
    const lo = Math.floor(Number(min));
    const hi = Math.floor(Number(max));
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return lo;
    return Math.floor(rng() * (hi - lo + 1)) + lo;
};

/**
 * ENHANCE_ITEM 성공 1회와 동일: stars를 1 올리고 주옵·전투 부옵만 반영 (특수/신화는 변경 없음).
 * 호출 전 stars는 0~9, 호출 후 1~10.
 */
export function applySuccessfulEnhancementTick(item: InventoryItem, rng: () => number = Math.random): void {
    if (!item.options?.main || !item.slot || item.stars >= 10) return;

    item.stars++;

    const milestoneStars = item.stars;
    if (milestoneStars === 4 || milestoneStars === 7 || milestoneStars === 10) {
        for (const sub of item.options.specialSubs ?? []) {
            const st = sub.type as SpecialStat;
            const def = SPECIAL_STATS_DATA[st];
            if (!def) continue;
            const delta = getSpecialStatMilestoneValueDelta(st);
            if (delta <= 0) continue;
            sub.value = parseFloat((Number(sub.value) + delta).toFixed(2));
            sub.enhancements = (sub.enhancements ?? 0) + 1;
            sub.display = formatSpecialSubItemDisplay(sub, def);
        }
    }

    const main = item.options.main;
    if (main.baseValue) {
        const starIndex = Math.max(0, Math.min(9, item.stars - 1));
        const multipliers = MAIN_ENHANCEMENT_STEP_MULTIPLIER[item.grade];
        const increaseMultiplier = multipliers?.[starIndex] ?? 1;
        const stepBonusMultiplier = getEnhancementStepBonusMultiplier(item.stars);
        const increaseAmount = Math.round(main.baseValue * increaseMultiplier) * stepBonusMultiplier;
        main.value = parseFloat((Number(main.value) + increaseAmount).toFixed(2));
        main.display = `${main.type} +${main.value}${main.isPercentage ? '%' : ''}`;
    }

    if (item.options.combatSubs.length < 4) {
        const rules = GRADE_SUB_OPTION_RULES[item.grade];
        const existingSubTypes = new Set([main.type, ...item.options.combatSubs.map((s) => s.type)]);
        const combatTier = rules.combatTier;
        const combatPool = SUB_OPTION_POOLS[item.slot][combatTier].filter((opt) => !existingSubTypes.has(opt.type));
        if (combatPool.length > 0) {
            const newSubDef = combatPool[randomIntInclusive(0, combatPool.length - 1, rng)];
            const stepBonusMultiplier = getEnhancementStepBonusMultiplier(item.stars);
            const value =
                randomIntInclusive(newSubDef.range[0], newSubDef.range[1], rng) * stepBonusMultiplier;
            const newSub: ItemOption = {
                type: newSubDef.type,
                value,
                isPercentage: newSubDef.isPercentage,
                display: `${newSubDef.type} +${value}${newSubDef.isPercentage ? '%' : ''} [${newSubDef.range[0] * stepBonusMultiplier}~${newSubDef.range[1] * stepBonusMultiplier}]`,
                range: [newSubDef.range[0] * stepBonusMultiplier, newSubDef.range[1] * stepBonusMultiplier],
                enhancements: 0,
            };
            item.options.combatSubs.push(newSub);
        }
    } else {
        const subToUpgrade = item.options.combatSubs[randomIntInclusive(0, item.options.combatSubs.length - 1, rng)];
        subToUpgrade.enhancements = (subToUpgrade.enhancements || 0) + 1;

        const itemTier = GRADE_SUB_OPTION_RULES[item.grade].combatTier;
        const subOptionPool = SUB_OPTION_POOLS[item.slot][itemTier];
        const subDef = resolveCombatSubPoolDefinition(
            subOptionPool,
            subToUpgrade.type as CoreStat,
            subToUpgrade.isPercentage
        );

        if (subDef) {
            const stepBonusMultiplier = getEnhancementStepBonusMultiplier(item.stars);
            const increaseAmount = randomIntInclusive(subDef.range[0], subDef.range[1], rng) * stepBonusMultiplier;
            subToUpgrade.value = Number(subToUpgrade.value) + increaseAmount;

            if (!subToUpgrade.range) {
                subToUpgrade.range = [
                    subDef.range[0] * stepBonusMultiplier,
                    subDef.range[1] * stepBonusMultiplier,
                ];
            } else {
                // range가 JSON 등으로 문자열이면 += 가 이어붙기가 되어 제련·표시 범위가 비정상으로 커진다.
                const cur0 = Number(subToUpgrade.range[0]);
                const cur1 = Number(subToUpgrade.range[1]);
                const base0 = Number.isFinite(cur0) ? cur0 : 0;
                const base1 = Number.isFinite(cur1) ? cur1 : 0;
                subToUpgrade.range[0] = base0 + subDef.range[0] * stepBonusMultiplier;
                subToUpgrade.range[1] = base1 + subDef.range[1] * stepBonusMultiplier;
            }

            subToUpgrade.display = `${subToUpgrade.type} +${subToUpgrade.value}${subToUpgrade.isPercentage ? '%' : ''} [${subToUpgrade.range[0]}~${subToUpgrade.range[1]}]`;
        } else {
            subToUpgrade.value = parseFloat((Number(subToUpgrade.value) * 1.1).toFixed(2));
            subToUpgrade.display = `${subToUpgrade.type} +${subToUpgrade.value}${subToUpgrade.isPercentage ? '%' : ''}`;
        }
    }
}
