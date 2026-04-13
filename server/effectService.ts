

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

    // Apply cumulative positive effects (higher ranks include lower bonuses)
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

    // Apply cumulative negative effects (lower ranks include higher penalties)
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
    /** 모험 카테고리 승리 골드에만 가산(%) — 장비 매너 `winGoldBonusPercent`와 별도 */
    adventureCodexGoldBonusPercent?: number;
    /** 지역 이해도 — 모험 승리 보상 장비 상자 드롭 +% */
    adventureUnderstandingEquipmentDropBonusPercent?: number;
    /** 지역 이해도 — II·III·IV 장비 상자 가중 +% */
    adventureUnderstandingHighGradeEquipmentBonusPercent?: number;
    /** 지역 이해도 — 재료 상자 드롭 +% */
    adventureUnderstandingMaterialDropBonusPercent?: number;
    /** 지역 이해도 — II·III·IV 재료 상자 가중 +% */
    adventureUnderstandingHighGradeMaterialBonusPercent?: number;
}

export const calculateUserEffects = (user: User | null | undefined): CalculatedEffects => {
    // Start with manner effects
    if (!user) {
        // Return default effects if user is null/undefined
        const defaultEffects: CalculatedEffects = {
            maxActionPoints: 30,
            actionPointRegenInterval: ACTION_POINT_REGEN_INTERVAL_MS,
            goldRewardMultiplier: 1,
            winGoldBonusPercent: 0,
            dropChanceMultiplier: 1,
            winDropBonusPercent: 0,
            itemDropRateBonus: 0,
            disassemblyJackpotBonusPercent: 0,
            allStatsFlatBonus: 0,
            adventureCodexGoldBonusPercent: 0,
            adventureUnderstandingEquipmentDropBonusPercent: 0,
            adventureUnderstandingHighGradeEquipmentBonusPercent: 0,
            adventureUnderstandingMaterialDropBonusPercent: 0,
            adventureUnderstandingHighGradeMaterialBonusPercent: 0,
            coreStatBonuses: {} as Record<CoreStat, { flat: number; percent: number }>,
            specialStatBonuses: {} as Record<SpecialStat, { flat: number; percent: number }>,
            mythicStatBonuses: {} as Record<MythicStat, { flat: number; percent: number }>,
        };
        for (const key of Object.values(CoreStat)) {
            defaultEffects.coreStatBonuses[key] = { flat: 0, percent: 0 };
        }
        for (const key of Object.values(SpecialStat)) {
            defaultEffects.specialStatBonuses[key] = { flat: 0, percent: 0 };
        }
        for (const key of Object.values(MythicStat)) {
            defaultEffects.mythicStatBonuses[key] = { flat: 0, percent: 0 };
        }
        return defaultEffects;
    }

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

    const equippedItems = (user.inventory && Array.isArray(user.inventory))
        ? user.inventory.filter(i => i && i.isEquipped && i.type === 'equipment' && i.options)
        : [];

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
 * 장비 변경 후 행동력 max/current와 회복 타이머(lastActionPointUpdate)를 일치시킨다.
 * 만땅( current >= max )이면 lastActionPointUpdate = 0,
 * 그렇지 않고 last가 0이면(이전에 만땅이었음) 지금부터 회복이 돌도록 now로 설정.
 */
/**
 * volatile 유저 객체에 대해 lastActionPointUpdate 경과분만큼 행동력 자연 회복을 반영한다.
 * 클라이언트 useApp의 1초 interval과 동일한 규칙. 행동력 차감·부족 검사 직전에 호출한다.
 */
export function applyPassiveActionPointRegenToUser(user: User, nowMs: number = Date.now()): void {
    if (!user?.actionPoints || user.isAdmin) return;

    const effects = calculateUserEffects(user);
    const calculatedMaxAP = effects.maxActionPoints;
    const regenInterval =
        effects.actionPointRegenInterval > 0 ? effects.actionPointRegenInterval : ACTION_POINT_REGEN_INTERVAL_MS;

    user.actionPoints.max = calculatedMaxAP;

    if (user.actionPoints.current >= calculatedMaxAP) {
        user.actionPoints.current = calculatedMaxAP;
        if (user.lastActionPointUpdate !== 0) user.lastActionPointUpdate = 0;
        return;
    }

    if (user.lastActionPointUpdate === 0) {
        user.lastActionPointUpdate = nowMs;
        return;
    }

    const lastUpdate = user.lastActionPointUpdate;
    if (typeof lastUpdate !== 'number' || isNaN(lastUpdate)) {
        user.lastActionPointUpdate = nowMs;
        return;
    }

    const elapsedMs = nowMs - lastUpdate;
    if (elapsedMs <= 0) return;

    const pointsToAdd = Math.floor(elapsedMs / regenInterval);
    if (pointsToAdd <= 0) return;

    user.actionPoints.current = Math.min(calculatedMaxAP, user.actionPoints.current + pointsToAdd);
    user.lastActionPointUpdate =
        user.actionPoints.current >= calculatedMaxAP ? 0 : lastUpdate + pointsToAdd * regenInterval;
}

export function syncActionPointsStateAfterEquipmentChange(user: User): void {
    if (!user.actionPoints) return;
    const effects = calculateUserEffects(user);
    const maxAp = effects.maxActionPoints;
    user.actionPoints.max = maxAp;
    user.actionPoints.current = Math.min(user.actionPoints.current, maxAp);

    if (user.actionPoints.current >= maxAp) {
        user.lastActionPointUpdate = 0;
        return;
    }
    const lu = user.lastActionPointUpdate;
    if (lu === 0 || lu === undefined || lu === null || (typeof lu === 'number' && Number.isNaN(lu))) {
        user.lastActionPointUpdate = Date.now();
    }
}

export const regenerateActionPoints = async (user: User): Promise<User> => {
    const effects = calculateUserEffects(user);
    const now = Date.now();
    
    const calculatedMaxAP = effects.maxActionPoints;
    let userModified = false;
    const updatedUser = JSON.parse(JSON.stringify(user));

    if (updatedUser.actionPoints.max !== calculatedMaxAP) {
        updatedUser.actionPoints.max = calculatedMaxAP;
        userModified = true;
    }
    
    if (updatedUser.actionPoints.current >= calculatedMaxAP) {
        if (updatedUser.lastActionPointUpdate !== 0) {
             updatedUser.lastActionPointUpdate = 0;
             userModified = true;
        }
        return userModified ? updatedUser : user;
    }

    if (updatedUser.lastActionPointUpdate === 0) {
        updatedUser.lastActionPointUpdate = now;
        userModified = true;
    }

    const lastUpdate = updatedUser.lastActionPointUpdate;
    if (typeof lastUpdate !== 'number' || isNaN(lastUpdate)) {
        updatedUser.lastActionPointUpdate = now;
        return updatedUser;
    }

    const elapsedMs = now - lastUpdate;
    const regenInterval = effects.actionPointRegenInterval > 0 ? effects.actionPointRegenInterval : ACTION_POINT_REGEN_INTERVAL_MS;
    const pointsToAdd = Math.floor(elapsedMs / regenInterval);

    if (pointsToAdd > 0) {
        userModified = true;
        updatedUser.actionPoints.current = Math.min(calculatedMaxAP, updatedUser.actionPoints.current + pointsToAdd);
        updatedUser.lastActionPointUpdate = lastUpdate + pointsToAdd * regenInterval;

        if (updatedUser.actionPoints.current >= calculatedMaxAP) {
            updatedUser.lastActionPointUpdate = 0;
        }
    }
    return userModified ? updatedUser : user;
};