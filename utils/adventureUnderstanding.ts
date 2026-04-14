import type { AdventureProfile } from '../types/entities.js';
import { CoreStat } from '../types/enums.js';
import {
    accumulateAdventureCodexBossPercentBonuses,
    accumulateAdventureCodexComprehension,
} from './adventureCodexComprehension.js';
import {
    ADVENTURE_STAGES,
    ADVENTURE_UNDERSTANDING_EQUIPMENT_DROP_BONUS_CAP,
    ADVENTURE_UNDERSTANDING_GOLD_BONUS_CAP,
    ADVENTURE_UNDERSTANDING_HIGH_GRADE_EQUIP_CAP,
    ADVENTURE_UNDERSTANDING_HIGH_GRADE_MATERIAL_CAP,
    ADVENTURE_UNDERSTANDING_MATERIAL_DROP_BONUS_CAP,
    ADVENTURE_UNDERSTANDING_STAT_EFFECT_CAP,
    ADVENTURE_UNDERSTANDING_TIER_LABELS,
    getAdventureUnderstandingSharedBonusPercentForStageXp,
    getAdventureUnderstandingTierFromXp,
} from '../constants/adventureConstants.js';

/** 모험 일지 · 지역 이해도 코어 효과 표시 순서 */
export const ADVENTURE_UNDERSTANDING_CORE_STAT_ORDER: readonly CoreStat[] = [
    CoreStat.Concentration,
    CoreStat.ThinkingSpeed,
    CoreStat.Judgment,
    CoreStat.Calculation,
    CoreStat.CombatPower,
    CoreStat.Stability,
];

export type AdventureUnderstandingRegionalCoreBuff = {
    /** 「친숙함」(티어 2) 이상 도달한 지역 수 */
    eligibleRegionCount: number;
    /** 각 코어 스탯에 표시하는 고정 보너스(= eligible 지역 수) */
    flatEachStat: number;
    /** 각 코어 스탯에 표시하는 퍼센트 보너스(지역 수 기준, 상한 별도) */
    percentEachStat: number;
};

export function normalizeAdventureProfile(p: AdventureProfile | null | undefined): AdventureProfile {
    if (!p) {
        return {
            monstersDefeatedByMode: {},
            monstersDefeatedTotal: 0,
            understandingXpByStage: {},
            codexDefeatCounts: {},
            uniqueMonsterIdsCaught: [],
            lastPlayedStageId: null,
            adventureMapSuppressUntilByKey: {},
            regionalSpecialtyBuffsByStageId: {},
            regionalBuffEnhancePointsByStageId: {},
        };
    }
    return {
        monstersDefeatedByMode: { ...(p.monstersDefeatedByMode ?? {}) },
        monstersDefeatedTotal: p.monstersDefeatedTotal ?? 0,
        understandingXpByStage: { ...(p.understandingXpByStage ?? {}) },
        codexDefeatCounts: { ...(p.codexDefeatCounts ?? {}) },
        uniqueMonsterIdsCaught: [...(p.uniqueMonsterIdsCaught ?? [])],
        lastPlayedStageId: p.lastPlayedStageId ?? null,
        adventureMapSuppressUntilByKey: { ...(p.adventureMapSuppressUntilByKey ?? {}) },
        regionalSpecialtyBuffsByStageId: { ...(p.regionalSpecialtyBuffsByStageId ?? {}) },
        regionalBuffEnhancePointsByStageId: { ...(p.regionalBuffEnhancePointsByStageId ?? {}) },
        regionalBuffRerollUtcDate: p.regionalBuffRerollUtcDate,
        regionalBuffRerollCountToday: p.regionalBuffRerollCountToday,
    };
}

/**
 * 지역 이해도(친숙함 이상 지역 수)에 따른 코어 스탯 패시브 — 일지 표시용.
 * 고정값은 달성 지역 수 그대로, 퍼센트는 `ADVENTURE_UNDERSTANDING_STAT_EFFECT_CAP`까지.
 */
export function getAdventureUnderstandingRegionalCoreBuff(
    profile: AdventureProfile | null | undefined,
): AdventureUnderstandingRegionalCoreBuff {
    const p = normalizeAdventureProfile(profile);
    let eligibleRegionCount = 0;
    for (const s of ADVENTURE_STAGES) {
        const xp = p.understandingXpByStage?.[s.id] ?? 0;
        const tier = getAdventureUnderstandingTierFromXp(xp);
        /** 「친숙함」(티어 3) 이상 — 등급 명칭 변경에 맞춤 */
        if (tier >= 3) eligibleRegionCount += 1;
    }
    return {
        eligibleRegionCount,
        flatEachStat: eligibleRegionCount,
        percentEachStat: Math.min(eligibleRegionCount, ADVENTURE_UNDERSTANDING_STAT_EFFECT_CAP),
    };
}

/** 모든 지역 이해도 XP를 합쳐 공통 모험 보상 보너스 풀(%) — 골드·드롭 4종에 동일 값을 각 상한까지 적용 */
function sumSharedAdventureUnderstandingBonusPercent(profile: AdventureProfile | null | undefined): number {
    const p = normalizeAdventureProfile(profile);
    let sum = 0;
    for (const s of ADVENTURE_STAGES) {
        const xp = p.understandingXpByStage?.[s.id] ?? 0;
        sum += getAdventureUnderstandingSharedBonusPercentForStageXp(xp);
    }
    return sum;
}

export type AdventureUnderstandingDropBonusesPercent = {
    equipmentDropPercent: number;
    highGradeEquipmentPercent: number;
    materialDropPercent: number;
    highGradeMaterialPercent: number;
};

/** 지역 이해도 → 모험 보상(장비·재료 드롭·고급 상자 가중) 표시·정산용 % */
export function getAdventureUnderstandingDropBonusesPercent(
    profile: AdventureProfile | null | undefined,
): AdventureUnderstandingDropBonusesPercent {
    const total = sumSharedAdventureUnderstandingBonusPercent(profile);
    return {
        equipmentDropPercent: Math.min(total, ADVENTURE_UNDERSTANDING_EQUIPMENT_DROP_BONUS_CAP),
        highGradeEquipmentPercent: Math.min(total, ADVENTURE_UNDERSTANDING_HIGH_GRADE_EQUIP_CAP),
        materialDropPercent: Math.min(total, ADVENTURE_UNDERSTANDING_MATERIAL_DROP_BONUS_CAP),
        highGradeMaterialPercent: Math.min(total, ADVENTURE_UNDERSTANDING_HIGH_GRADE_MATERIAL_CAP),
    };
}

export function formatAdventureUnderstandingBonusPercent(value: number): string {
    const r = Math.round(value * 10) / 10;
    if (Math.abs(r - Math.round(r)) < 1e-9) return String(Math.round(r));
    return r.toFixed(1);
}

/** 스테이지별 이해도 XP 합산 모험 골드 보너스(%, 상한 적용) — 드롭 보너스와 동일 공통 곡선 */
export function sumAdventureUnderstandingGoldBonusPercent(profile: AdventureProfile | null | undefined): number {
    return Math.min(sumSharedAdventureUnderstandingBonusPercent(profile), ADVENTURE_UNDERSTANDING_GOLD_BONUS_CAP);
}

/**
 * 이해도 2티어(친숙함) 이상인 지역 수 → 코어 능력치 퍼 보너스 표시용(상한 %).
 * 실제 전투 수치 적용은 서버/장비 파이프라인에서 동일 공식을 쓰는 것을 권장.
 */
export function getAdventureUnderstandingStatEffectBonusPercent(profile: AdventureProfile | null | undefined): number {
    return getAdventureUnderstandingRegionalCoreBuff(profile).percentEachStat;
}

/**
 * 모험 일지 「지역 이해도 효과」 표시용: 지역 이해도 + 몬스터 도감(일반·보스)을 합연산한 값.
 * `calculateUserEffects`의 모험 패시브(장비 제외)와 동일한 합산 규칙.
 */
export type CombinedAdventureRegionalBuffTotals = {
    goldBonusPercent: number;
    equipmentDropPercent: number;
    highGradeEquipmentPercent: number;
    materialDropPercent: number;
    highGradeMaterialPercent: number;
    coreByStat: Record<CoreStat, { flat: number; percent: number }>;
};

/** 몬스터 도감 이해도(일반·보스)만 합산 — 모험 일지 「몬스터 이해도 효과」 표시용 */
export function getMonsterCodexComprehensionBuffTotals(
    profile: AdventureProfile | null | undefined,
): CombinedAdventureRegionalBuffTotals {
    const codexTot = accumulateAdventureCodexComprehension(profile);
    const codexBoss = accumulateAdventureCodexBossPercentBonuses(profile);
    const coreByStat = {} as Record<CoreStat, { flat: number; percent: number }>;
    for (const s of Object.values(CoreStat)) {
        coreByStat[s] = {
            flat: Math.floor(codexTot.coreFlat[s] ?? 0),
            percent: codexBoss.corePercent[s] ?? 0,
        };
    }
    return {
        goldBonusPercent: codexTot.adventureGoldBonusPercent + codexBoss.adventureGoldPercent,
        equipmentDropPercent: codexBoss.itemDropPercent + codexTot.adventureEquipmentDropBonusPercent,
        highGradeEquipmentPercent:
            codexBoss.highGradeEquipmentPercent + codexTot.adventureHighGradeEquipmentBonusPercent,
        materialDropPercent: codexBoss.materialDropPercent + codexTot.adventureMaterialDropBonusPercent,
        highGradeMaterialPercent:
            codexBoss.highGradeMaterialPercent + codexTot.adventureHighGradeMaterialBonusPercent,
        coreByStat,
    };
}

export function getCombinedAdventureRegionalBuffTotals(
    profile: AdventureProfile | null | undefined,
): CombinedAdventureRegionalBuffTotals {
    const regional = getAdventureUnderstandingRegionalCoreBuff(profile);
    const advDrop = getAdventureUnderstandingDropBonusesPercent(profile);
    const goldUnderstanding = sumAdventureUnderstandingGoldBonusPercent(profile);
    const codexTot = accumulateAdventureCodexComprehension(profile);
    const codexBoss = accumulateAdventureCodexBossPercentBonuses(profile);

    const coreByStat = {} as Record<CoreStat, { flat: number; percent: number }>;
    for (const s of Object.values(CoreStat)) {
        coreByStat[s] = {
            flat: regional.flatEachStat + Math.floor(codexTot.coreFlat[s] ?? 0),
            percent: regional.percentEachStat + (codexBoss.corePercent[s] ?? 0),
        };
    }

    return {
        goldBonusPercent: goldUnderstanding + codexTot.adventureGoldBonusPercent + codexBoss.adventureGoldPercent,
        equipmentDropPercent:
            advDrop.equipmentDropPercent + codexBoss.itemDropPercent + codexTot.adventureEquipmentDropBonusPercent,
        highGradeEquipmentPercent:
            advDrop.highGradeEquipmentPercent +
            codexBoss.highGradeEquipmentPercent +
            codexTot.adventureHighGradeEquipmentBonusPercent,
        materialDropPercent:
            advDrop.materialDropPercent + codexBoss.materialDropPercent + codexTot.adventureMaterialDropBonusPercent,
        highGradeMaterialPercent:
            advDrop.highGradeMaterialPercent +
            codexBoss.highGradeMaterialPercent +
            codexTot.adventureHighGradeMaterialBonusPercent,
        coreByStat,
    };
}

export function formatAdventureUnderstandingTierLabel(tier: number): string {
    const i = Math.max(0, Math.min(ADVENTURE_UNDERSTANDING_TIER_LABELS.length - 1, Math.floor(tier)));
    return ADVENTURE_UNDERSTANDING_TIER_LABELS[i] ?? ADVENTURE_UNDERSTANDING_TIER_LABELS[0];
}
