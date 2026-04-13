


// FIX: Import missing types from the centralized types file.
import { User, CoreStat, SpecialStat, MythicStat } from '../types/index.js';
import { ACTION_POINT_REGEN_INTERVAL_MS } from '../constants';
import {
    accumulateAdventureCodexBossPercentBonuses,
    applyAdventureCodexComprehensionToCalculatedEffects,
} from '../utils/adventureCodexComprehension.js';
import {
    getAdventureUnderstandingDropBonusesPercent,
    getAdventureUnderstandingRegionalCoreBuff,
    sumAdventureUnderstandingGoldBonusPercent,
} from '../utils/adventureUnderstanding.js';
import { sumRegionalAdvGoldPercentForProfile } from '../utils/adventureRegionalSpecialtyBuff.js';

export interface MannerEffects {
    maxActionPoints: number;
    actionPointRegenInterval: number;
    goldRewardMultiplier: number;
    winGoldBonusPercent: number;
    dropChanceMultiplier: number;
    winDropBonusPercent: number;
    itemDropRateBonus: number;
    disassemblyJackpotBonusPercent: number;
    allStatsFlatBonus: number;
}

// This function was moved from mannerService to break a circular dependency
export const getMannerEffects = (user: User): MannerEffects => {
    const score = user.mannerScore ?? 200;
    const effects: MannerEffects = {
        maxActionPoints: 30,
        actionPointRegenInterval: ACTION_POINT_REGEN_INTERVAL_MS,
        goldRewardMultiplier: 1,
        winGoldBonusPercent: 0,
        dropChanceMultiplier: 1,
        winDropBonusPercent: 0,
        itemDropRateBonus: 0,
        disassemblyJackpotBonusPercent: 0,
        allStatsFlatBonus: 0,
    };

    // Apply cumulative positive effects
    if (score >= 400) { // 좋음
        effects.maxActionPoints += 10;
    }
    if (score >= 800) { // 매우 좋음
        effects.winGoldBonusPercent += 20;
    }
    if (score >= 1200) { // 품격
        effects.winDropBonusPercent += 20;
    }
    if (score >= 1600) { // 프로
        effects.disassemblyJackpotBonusPercent += 20;
    }
    if (score >= 2000) { // 마스터
        effects.allStatsFlatBonus += 10;
    }

    // Apply cumulative negative effects
    if (score <= 199) { // 주의
        effects.dropChanceMultiplier *= 0.5;
    }
    if (score <= 99) { // 나쁨
        effects.goldRewardMultiplier *= 0.5;
    }
    if (score <= 49) { // 매우 나쁨
        effects.actionPointRegenInterval = Math.max(effects.actionPointRegenInterval, 20 * 60 * 1000); // 20 minutes
    }
    if (score <= 0) { // 최악
        effects.maxActionPoints = Math.max(0, effects.maxActionPoints - 20);
    }
    
    return effects;
};

export interface CalculatedEffects extends MannerEffects {
    coreStatBonuses: Record<CoreStat, { flat: number; percent: number }>;
    specialStatBonuses: Record<SpecialStat, { flat: number; percent: number }>;
    mythicStatBonuses: Record<MythicStat, { flat: number; percent: number }>;
    adventureCodexGoldBonusPercent?: number;
    adventureUnderstandingEquipmentDropBonusPercent?: number;
    adventureUnderstandingHighGradeEquipmentBonusPercent?: number;
    adventureUnderstandingMaterialDropBonusPercent?: number;
    adventureUnderstandingHighGradeMaterialBonusPercent?: number;
}

export const calculateUserEffects = (user: User): CalculatedEffects => {
    // Start with manner effects
    const effects = getMannerEffects(user);

    const calculatedEffects: CalculatedEffects = {
        ...effects,
        coreStatBonuses: {} as Record<CoreStat, { flat: number; percent: number }>,
        specialStatBonuses: {} as Record<SpecialStat, { flat: number; percent: number }>,
        mythicStatBonuses: {} as Record<MythicStat, { flat: number; percent: number }>,
    };

    // Initialize bonus records
    for (const key of Object.values(CoreStat)) {
        calculatedEffects.coreStatBonuses[key] = { flat: 0, percent: 0 };
    }
    for (const key of Object.values(SpecialStat)) {
        calculatedEffects.specialStatBonuses[key] = { flat: 0, percent: 0 };
    }
    for (const key of Object.values(MythicStat)) {
        calculatedEffects.mythicStatBonuses[key] = { flat: 0, percent: 0 };
    }

    const equippedItems = user.inventory.filter(i => i.isEquipped && i.type === 'equipment' && i.options);

    // Add equipment effects
    for (const item of equippedItems) {
        const allOptions = [item.options!.main, ...item.options!.combatSubs, ...item.options!.specialSubs, ...item.options!.mythicSubs];
        for (const opt of allOptions) {
            if (!opt) continue;

            const { type, value, isPercentage } = opt;
            const num = typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
            if (!Number.isFinite(num)) continue;

            if (Object.values(CoreStat).includes(type as CoreStat)) {
                if (isPercentage) {
                    calculatedEffects.coreStatBonuses[type as CoreStat].percent += num;
                } else {
                    calculatedEffects.coreStatBonuses[type as CoreStat].flat += num;
                }
            } else if (Object.values(SpecialStat).includes(type as SpecialStat)) {
                 if (isPercentage) {
                    calculatedEffects.specialStatBonuses[type as SpecialStat].percent += num;
                } else {
                    calculatedEffects.specialStatBonuses[type as SpecialStat].flat += num;
                }
            } else if (Object.values(MythicStat).includes(type as MythicStat)) {
                // Mythic stats are generally flat values (e.g., +1 item)
                calculatedEffects.mythicStatBonuses[type as MythicStat].flat += num;
            }
        }
    }
    
    if (effects.allStatsFlatBonus !== 0) {
        for (const key of Object.values(CoreStat)) {
            calculatedEffects.coreStatBonuses[key].flat += effects.allStatsFlatBonus;
        }
    }

    // Update manner effects based on equipment bonuses
    calculatedEffects.maxActionPoints += calculatedEffects.specialStatBonuses[SpecialStat.ActionPointMax].flat;
    const regenBonusPercent = calculatedEffects.specialStatBonuses[SpecialStat.ActionPointRegen].percent;
    if (regenBonusPercent > 0) {
        calculatedEffects.actionPointRegenInterval = Math.floor(calculatedEffects.actionPointRegenInterval / (1 + regenBonusPercent / 100));
    }

    calculatedEffects.adventureCodexGoldBonusPercent = 0;
    const codexTotals = applyAdventureCodexComprehensionToCalculatedEffects(user, calculatedEffects);

    const codexBossPct = accumulateAdventureCodexBossPercentBonuses(user.adventureProfile);
    for (const key of Object.values(CoreStat)) {
        calculatedEffects.coreStatBonuses[key].percent += codexBossPct.corePercent[key] ?? 0;
    }
    const regionalCore = getAdventureUnderstandingRegionalCoreBuff(user.adventureProfile);
    for (const key of Object.values(CoreStat)) {
        calculatedEffects.coreStatBonuses[key].flat += regionalCore.flatEachStat;
        calculatedEffects.coreStatBonuses[key].percent += regionalCore.percentEachStat;
    }
    calculatedEffects.adventureCodexGoldBonusPercent =
        (calculatedEffects.adventureCodexGoldBonusPercent ?? 0) +
        codexBossPct.adventureGoldPercent +
        sumAdventureUnderstandingGoldBonusPercent(user.adventureProfile) +
        sumRegionalAdvGoldPercentForProfile(user.adventureProfile);

    const advDrop = getAdventureUnderstandingDropBonusesPercent(user.adventureProfile);
    calculatedEffects.adventureUnderstandingEquipmentDropBonusPercent =
        advDrop.equipmentDropPercent + codexBossPct.itemDropPercent + codexTotals.adventureEquipmentDropBonusPercent;
    calculatedEffects.adventureUnderstandingHighGradeEquipmentBonusPercent =
        advDrop.highGradeEquipmentPercent +
        codexBossPct.highGradeEquipmentPercent +
        codexTotals.adventureHighGradeEquipmentBonusPercent;
    calculatedEffects.adventureUnderstandingMaterialDropBonusPercent =
        advDrop.materialDropPercent + codexBossPct.materialDropPercent + codexTotals.adventureMaterialDropBonusPercent;
    calculatedEffects.adventureUnderstandingHighGradeMaterialBonusPercent =
        advDrop.highGradeMaterialPercent +
        codexBossPct.highGradeMaterialPercent +
        codexTotals.adventureHighGradeMaterialBonusPercent;

    return calculatedEffects;
};

/**
 * 서버/목록 스냅샷 시각 이후 자연 회복분을 반영한 현재 행동력(클라이언트 추정).
 * 대기실 유저 목록 등 상대 정보는 주기적으로만 갱신되므로, 신청 모달 등에서 본인과 동일한 기준으로 비교할 때 사용.
 */
export const projectActionPointsCurrent = (user: User | null | undefined, nowMs: number = Date.now()): number => {
    if (!user?.actionPoints) return 0;
    if (user.isAdmin) return Math.max(user.actionPoints.current ?? 0, 1);
    const effects = calculateUserEffects(user);
    const maxAp = effects.maxActionPoints;
    const cur = user.actionPoints.current ?? 0;
    if (cur >= maxAp) return maxAp;
    const lastUpdate = user.lastActionPointUpdate;
    if (lastUpdate === undefined || lastUpdate === null || lastUpdate === 0) {
        return Math.min(cur, maxAp);
    }
    const regenInterval =
        effects.actionPointRegenInterval > 0 ? effects.actionPointRegenInterval : ACTION_POINT_REGEN_INTERVAL_MS;
    const elapsedMs = nowMs - lastUpdate;
    if (elapsedMs <= 0) return Math.min(cur, maxAp);
    const pointsToAdd = Math.floor(elapsedMs / regenInterval);
    if (pointsToAdd <= 0) return Math.min(cur, maxAp);
    return Math.min(maxAp, cur + pointsToAdd);
};