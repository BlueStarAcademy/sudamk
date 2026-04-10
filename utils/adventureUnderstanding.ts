import type { AdventureProfile } from '../types/entities.js';
import {
    ADVENTURE_STAGES,
    ADVENTURE_UNDERSTANDING_GOLD_BONUS_BY_TIER,
    ADVENTURE_UNDERSTANDING_GOLD_BONUS_CAP,
    ADVENTURE_UNDERSTANDING_STAT_EFFECT_CAP,
    ADVENTURE_UNDERSTANDING_TIER_LABELS,
    getAdventureUnderstandingTierFromXp,
} from '../constants/adventureConstants.js';

export function normalizeAdventureProfile(p: AdventureProfile | null | undefined): AdventureProfile {
    if (!p) {
        return {
            monstersDefeatedByMode: {},
            monstersDefeatedTotal: 0,
            understandingXpByStage: {},
            uniqueMonsterIdsCaught: [],
            lastPlayedStageId: null,
        };
    }
    return {
        monstersDefeatedByMode: { ...(p.monstersDefeatedByMode ?? {}) },
        monstersDefeatedTotal: p.monstersDefeatedTotal ?? 0,
        understandingXpByStage: { ...(p.understandingXpByStage ?? {}) },
        uniqueMonsterIdsCaught: [...(p.uniqueMonsterIdsCaught ?? [])],
        lastPlayedStageId: p.lastPlayedStageId ?? null,
    };
}

/** 스테이지별 이해도 티어 합산 모험 골드 보너스(%, 상한 적용) */
export function sumAdventureUnderstandingGoldBonusPercent(profile: AdventureProfile | null | undefined): number {
    const p = normalizeAdventureProfile(profile);
    let sum = 0;
    for (const s of ADVENTURE_STAGES) {
        const xp = p.understandingXpByStage?.[s.id] ?? 0;
        const tier = getAdventureUnderstandingTierFromXp(xp);
        sum += ADVENTURE_UNDERSTANDING_GOLD_BONUS_BY_TIER[tier];
    }
    return Math.min(sum, ADVENTURE_UNDERSTANDING_GOLD_BONUS_CAP);
}

/**
 * 이해도 2티어(친숙함) 이상인 지역 수 → 코어 능력치 “유효 스탯” 보너스 표시용 (%).
 * 실제 전투 수치 적용은 서버/장비 파이프라인에서 동일 공식을 쓰는 것을 권장.
 */
export function getAdventureUnderstandingStatEffectBonusPercent(profile: AdventureProfile | null | undefined): number {
    const p = normalizeAdventureProfile(profile);
    let count = 0;
    for (const s of ADVENTURE_STAGES) {
        const xp = p.understandingXpByStage?.[s.id] ?? 0;
        const tier = getAdventureUnderstandingTierFromXp(xp);
        if (tier >= 2) count += 1;
    }
    return Math.min(count, ADVENTURE_UNDERSTANDING_STAT_EFFECT_CAP);
}

export function formatAdventureUnderstandingTierLabel(tier: number): string {
    const i = Math.max(0, Math.min(ADVENTURE_UNDERSTANDING_TIER_LABELS.length - 1, Math.floor(tier)));
    return ADVENTURE_UNDERSTANDING_TIER_LABELS[i] ?? ADVENTURE_UNDERSTANDING_TIER_LABELS[0];
}
