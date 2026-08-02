import type { SinglePlayerMissionInfo, SinglePlayerMissionLevelInfo } from '../types/entities.js';

export type TrainingQuestRewardType = 'gold' | 'diamonds' | 'enhance_stone' | 'equipment_box';

export type FacilityTierId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type FacilityTierParams = {
    id: string;
    name: string;
    description: string;
    unlockUserLevel: number;
    rewardType: TrainingQuestRewardType;
    image: string;
    tier: FacilityTierId;
    /** 강화 골드 비용 계수 */
    tierGoldBase: number;
    baseIntervalMin: number;
    baseAmount: number;
    /** 보관 성장 기준 (Lv1). 골드 시설 오프라인 스택용 */
    baseCap: number;
    /**
     * @deprecated 강화 XP는 `requiredEnhanceXpForLevel`(풀캡 사이클 × L × 10)을 사용.
     * 필드가 남아 있어도 판정에 쓰지 않음.
     */
    enhanceXpBase?: number;
    /** 다이아/아이템: 레벨별 보관 계단 (길이 10) */
    capByLevel?: readonly number[];
    /** 선택: 레벨별 주기 분 오버라이드 (길이 10) */
    intervalByLevel?: readonly number[];
};

export const isItemRewardType = (rewardType: TrainingQuestRewardType): boolean =>
    rewardType === 'enhance_stone' || rewardType === 'equipment_box';

export const isCurrencyRewardType = (rewardType: TrainingQuestRewardType): boolean =>
    rewardType === 'gold' || rewardType === 'diamonds';

/** 주기(분): Lv10에서 약 40% 단축, 매 레벨 단조 감소 */
export function intervalMinutesForLevel(baseIntervalMin: number, level: number, override?: readonly number[]): number {
    if (override && override[level - 1] != null) return override[level - 1]!;
    const t = (level - 1) / 9;
    const raw = baseIntervalMin * (1 - 0.4 * t);
    // 0.5분 단위로 내림하되, 이전 레벨보다 반드시 작거나 같게 — 빌더에서 보정
    return Math.max(0.5, Math.round(raw * 2) / 2);
}

export function amountForLevel(params: FacilityTierParams, level: number): number {
    if (params.rewardType !== 'gold') return 1;
    const t = (level - 1) / 9;
    return Math.max(1, Math.round(params.baseAmount * (1 + 1.2 * t)));
}

export function capacityForLevel(params: FacilityTierParams, level: number): number {
    if (params.capByLevel && params.capByLevel[level - 1] != null) {
        return params.capByLevel[level - 1]!;
    }
    const t = (level - 1) / 9;
    return Math.max(params.baseCap, Math.round(params.baseCap * (1 + 1.5 * t)));
}

/** 매 레벨 최소 1개 스탯이 바뀌도록 주기·수량·보관을 보정하며 10레벨 생성 */
export function buildMissionLevels(params: FacilityTierParams): SinglePlayerMissionLevelInfo[] {
    const levels: SinglePlayerMissionLevelInfo[] = [];
    let prevInterval = Number.POSITIVE_INFINITY;
    let prevAmount = -1;
    let prevCap = -1;

    for (let level = 1; level <= 10; level++) {
        let interval = intervalMinutesForLevel(params.baseIntervalMin, level, params.intervalByLevel);
        let amount = amountForLevel(params, level);
        let cap = capacityForLevel(params, level);

        if (level > 1) {
            const unchanged = interval >= prevInterval && amount === prevAmount && cap === prevCap;
            if (unchanged || interval >= prevInterval) {
                // 주기 최소 0.5분 단축
                interval = Math.max(0.5, Math.round((prevInterval - 0.5) * 2) / 2);
            }
            if (interval === prevInterval && amount === prevAmount && cap === prevCap) {
                cap = prevCap + 1;
            }
        }

        prevInterval = interval;
        prevAmount = amount;
        prevCap = cap;

        levels.push({
            level,
            productionRateMinutes: interval,
            rewardAmount: amount,
            maxCapacity: cap,
        });
    }
    return levels;
}

/**
 * 개선 전 수련과제와 동일한 체감의 강화 XP.
 * 필요 사이클 = floor(maxCapacity / rewardAmount) × 현재레벨 × 10
 * (이전: 누적 수령량 ≥ maxCapacity × L × 10)
 */
export function requiredEnhanceXpForLevel(
    levelInfo: Pick<SinglePlayerMissionLevelInfo, 'maxCapacity' | 'rewardAmount'>,
    currentLevel: number,
): number {
    if (currentLevel <= 0 || currentLevel >= 10) return 0;
    const perCycle = Math.max(1, levelInfo.rewardAmount);
    const cyclesPerFull = Math.max(1, Math.floor(levelInfo.maxCapacity / perCycle));
    return cyclesPerFull * currentLevel * 10;
}

/** @deprecated `requiredEnhanceXpForLevel` 사용 */
export function requiredEnhanceXp(xpBase: number, currentLevel: number): number {
    if (currentLevel <= 0) return 0;
    if (currentLevel >= 10) return 0;
    return Math.max(1, Math.floor(xpBase * (2 + currentLevel)));
}

/**
 * 개선 전 강화 골드 비용.
 * 골드 시설: maxCapacity × 5 / 그 외: maxCapacity × 1000
 */
export function upgradeGoldCostForLevel(
    levelInfo: Pick<SinglePlayerMissionLevelInfo, 'maxCapacity'>,
    rewardType: TrainingQuestRewardType,
): number {
    const cap = Math.max(1, levelInfo.maxCapacity);
    return rewardType === 'gold' ? cap * 5 : cap * 1000;
}

/** @deprecated `upgradeGoldCostForLevel` 사용 */
export function upgradeGoldCost(tierGoldBase: number, currentLevel: number): number {
    const L = Math.max(1, currentLevel);
    return Math.max(1, Math.round(tierGoldBase * Math.pow(L, 1.35) * 10));
}

/** 수령량 → 유효 사이클 수 (XP) */
export function claimedCyclesFromAmount(availableAmount: number, rewardAmountPerCycle: number): number {
    const per = Math.max(1, rewardAmountPerCycle);
    return Math.max(0, Math.floor(availableAmount / per));
}

/** 보관 기준(레거시/표시). XP에는 getMissionEnhanceXpBase 사용 */
export function getMissionBaseCap(mission: Pick<SinglePlayerMissionInfo, 'baseCap' | 'levels'>): number {
    if (typeof mission.baseCap === 'number' && mission.baseCap > 0) return mission.baseCap;
    return mission.levels[0]?.maxCapacity ?? 1;
}

/** 강화 XP 계수 — 골드 대형 baseCap과 분리된 enhanceXpBase 우선 */
export function getMissionEnhanceXpBase(
    mission: Pick<SinglePlayerMissionInfo, 'baseCap' | 'enhanceXpBase' | 'levels'>,
): number {
    if (typeof mission.enhanceXpBase === 'number' && mission.enhanceXpBase > 0) return mission.enhanceXpBase;
    return getMissionBaseCap(mission);
}

export function getMissionTierGoldBase(mission: Pick<SinglePlayerMissionInfo, 'tierGoldBase'>): number {
    return typeof mission.tierGoldBase === 'number' && mission.tierGoldBase > 0 ? mission.tierGoldBase : 8;
}
