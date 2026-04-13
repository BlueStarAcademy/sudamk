import {
    ADVENTURE_STAGES,
    ADVENTURE_UNDERSTANDING_TIER_LABELS,
    getAdventureUnderstandingTierFromXp,
    type AdventureStageId,
    type AdventureUnderstandingTierIndex,
} from '../constants/adventureConstants.js';

/**
 * 직전 챕터 지역 이해도 요구: 「레벨 2」= 티어 2단계(익숙함) 이상.
 * (0 낯설음, 1 익숙함, 2 친숙함 …)
 */
export const ADVENTURE_CHAPTER_PRIOR_MIN_TIER_INDEX: AdventureUnderstandingTierIndex = 1;

export type AdventureChapterUnlockContext = {
    strategyLevel: number;
    isAdmin: boolean;
    understandingXpByStage: Partial<Record<string, number>> | undefined;
};

const CHAPTER_RULES: readonly {
    stageIndex: number;
    minStrategyLevel: number;
    prerequisiteStageId: AdventureStageId | null;
}[] = [
    { stageIndex: 1, minStrategyLevel: 2, prerequisiteStageId: null },
    { stageIndex: 2, minStrategyLevel: 10, prerequisiteStageId: 'neighborhood_hill' },
    { stageIndex: 3, minStrategyLevel: 15, prerequisiteStageId: 'lake_park' },
    { stageIndex: 4, minStrategyLevel: 20, prerequisiteStageId: 'aquarium' },
    { stageIndex: 5, minStrategyLevel: 25, prerequisiteStageId: 'zoo' },
];

function ruleForStageIndex(stageIndex: number) {
    return CHAPTER_RULES.find((r) => r.stageIndex === stageIndex);
}

export function isAdventureChapterUnlockedByStageIndex(
    stageIndex: number,
    ctx: AdventureChapterUnlockContext,
): boolean {
    if (ctx.isAdmin) return true;
    const rule = ruleForStageIndex(stageIndex);
    if (!rule) return false;
    const strat = Math.max(0, Math.floor(Number(ctx.strategyLevel) || 0));
    if (strat < rule.minStrategyLevel) return false;
    if (rule.prerequisiteStageId == null) return true;
    const xp = ctx.understandingXpByStage?.[rule.prerequisiteStageId] ?? 0;
    const tier = getAdventureUnderstandingTierFromXp(xp);
    return tier >= ADVENTURE_CHAPTER_PRIOR_MIN_TIER_INDEX;
}

export function isAdventureStageUnlocked(stageId: string, ctx: AdventureChapterUnlockContext): boolean {
    const stage = ADVENTURE_STAGES.find((s) => s.id === stageId);
    if (!stage) return false;
    return isAdventureChapterUnlockedByStageIndex(stage.stageIndex, ctx);
}

/** 잠금 카드 한 줄 요건: 짧은 문구 + 달성 여부(달성 시 초록 표시용) */
export type AdventureChapterUnlockConditionLine = {
    key: string;
    text: string;
    satisfied: boolean;
};

export function getAdventureChapterUnlockConditionLines(
    stageIndex: number,
    ctx: AdventureChapterUnlockContext,
): AdventureChapterUnlockConditionLine[] {
    if (ctx.isAdmin) return [];
    const rule = ruleForStageIndex(stageIndex);
    if (!rule) return [];
    const strat = Math.max(0, Math.floor(Number(ctx.strategyLevel) || 0));
    const lines: AdventureChapterUnlockConditionLine[] = [];

    lines.push({
        key: 'strategy',
        text: `전략바둑 ${rule.minStrategyLevel}레벨`,
        satisfied: strat >= rule.minStrategyLevel,
    });

    if (rule.prerequisiteStageId != null) {
        const prev = ADVENTURE_STAGES.find((s) => s.id === rule.prerequisiteStageId);
        const xp = ctx.understandingXpByStage?.[rule.prerequisiteStageId] ?? 0;
        const tier = getAdventureUnderstandingTierFromXp(xp);
        const needTierIdx = ADVENTURE_CHAPTER_PRIOR_MIN_TIER_INDEX;
        const needLabel = ADVENTURE_UNDERSTANDING_TIER_LABELS[needTierIdx];
        lines.push({
            key: `prior-${rule.prerequisiteStageId}`,
            text: `${prev?.title ?? rule.prerequisiteStageId} [${needLabel}]`,
            satisfied: tier >= needTierIdx,
        });
    }

    return lines;
}

/** 잠금 시 카드·툴팁용 짧은 안내 (관리자면 빈 배열) */
export function getAdventureChapterUnlockBlockers(stageIndex: number, ctx: AdventureChapterUnlockContext): string[] {
    if (ctx.isAdmin) return [];
    const rule = ruleForStageIndex(stageIndex);
    if (!rule) return ['알 수 없는 챕터입니다.'];
    const out: string[] = [];
    const strat = Math.max(0, Math.floor(Number(ctx.strategyLevel) || 0));
    if (strat < rule.minStrategyLevel) {
        out.push(`전략 바둑 레벨 ${rule.minStrategyLevel} 이상 필요 (현재 ${strat})`);
    }
    if (rule.prerequisiteStageId != null) {
        const xp = ctx.understandingXpByStage?.[rule.prerequisiteStageId] ?? 0;
        const tier = getAdventureUnderstandingTierFromXp(xp);
        if (tier < ADVENTURE_CHAPTER_PRIOR_MIN_TIER_INDEX) {
            const prev = ADVENTURE_STAGES.find((s) => s.id === rule.prerequisiteStageId);
            const needLabel = ADVENTURE_UNDERSTANDING_TIER_LABELS[ADVENTURE_CHAPTER_PRIOR_MIN_TIER_INDEX];
            out.push(
                `「${prev?.title ?? rule.prerequisiteStageId}」 지역 이해도 ${needLabel} 이상 필요`,
            );
        }
    }
    return out;
}
