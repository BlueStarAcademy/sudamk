import {
    ADVENTURE_STAGES,
    ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS,
    getAdventureUnderstandingTierFromXp,
    getAdventureUnderstandingTierProgress,
} from '../constants/adventureConstants.js';
import type { AdventureProfile } from '../types/entities.js';
import { formatAdventureUnderstandingTierLabel, normalizeAdventureProfile } from './adventureUnderstanding.js';

export type AdventureStageUnderstandingRow = {
    id: string;
    title: string;
    stageIndex: number;
    xp: number;
    xpGoal: number;
    xpInTier?: number;
    xpNeedInTier?: number;
    tier: number;
    prog: number;
    tierLabel: string;
};

export function buildAdventureStageUnderstandingRows(
    profile: AdventureProfile | null | undefined,
): AdventureStageUnderstandingRow[] {
    const p = normalizeAdventureProfile(profile);
    return ADVENTURE_STAGES.map((s) => {
        const xp = p.understandingXpByStage?.[s.id] ?? 0;
        const tier = getAdventureUnderstandingTierFromXp(xp);
        const nextThreshold =
            tier < ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS.length - 1
                ? ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[tier + 1]
                : null;
        const lastThreshold = ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS.length - 1];
        const xpGoal = nextThreshold ?? lastThreshold;
        const tierProgress = getAdventureUnderstandingTierProgress(xp);
        const prog =
            nextThreshold != null && nextThreshold > ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[tier]
                ? Math.min(
                      100,
                      Math.round(
                          ((xp - ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[tier]) /
                              (nextThreshold - ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[tier])) *
                              100,
                      ),
                  )
                : 100;
        return {
            id: s.id,
            title: s.title,
            stageIndex: s.stageIndex,
            xp,
            xpGoal,
            tier,
            prog,
            tierLabel: formatAdventureUnderstandingTierLabel(tier),
            xpInTier: tierProgress.currentInTier,
            xpNeedInTier: tierProgress.neededInTier,
        };
    });
}
