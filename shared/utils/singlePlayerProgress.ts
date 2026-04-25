import { SinglePlayerStageInfo } from '../types/index.js';

export interface ReconciledSinglePlayerProgress {
    clearedStageIds: string[];
    effectiveClearedStageIds: string[];
    progress: number;
}

const toSafeProgress = (value: unknown, max: number): number => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(max, Math.floor(n)));
};

export const reconcileSinglePlayerProgress = (
    stages: Pick<SinglePlayerStageInfo, 'id'>[],
    clearedStageIds: unknown,
    singlePlayerProgress: unknown
): ReconciledSinglePlayerProgress => {
    const stageIds = stages.map((stage) => stage.id);
    const knownStageIds = new Set(stageIds);
    const progress = toSafeProgress(singlePlayerProgress, stageIds.length);
    const cleared = Array.isArray(clearedStageIds)
        ? clearedStageIds.filter((id): id is string => typeof id === 'string' && knownStageIds.has(id))
        : [];

    const effective = new Set<string>();
    for (const id of cleared) {
        effective.add(id);
    }
    for (let i = 0; i < progress; i++) {
        const id = stageIds[i];
        if (id) effective.add(id);
    }

    return {
        clearedStageIds: Array.from(new Set(cleared)),
        effectiveClearedStageIds: stageIds.filter((id) => effective.has(id)),
        progress,
    };
};

export const getSinglePlayerStageIndex = (
    stages: Pick<SinglePlayerStageInfo, 'id'>[],
    stageId: string
): number => stages.findIndex((stage) => stage.id === stageId);

export const isSinglePlayerStageCleared = (
    stages: Pick<SinglePlayerStageInfo, 'id'>[],
    progress: ReconciledSinglePlayerProgress,
    stageId: string
): boolean => {
    const stageIndex = getSinglePlayerStageIndex(stages, stageId);
    return stageIndex >= 0 && progress.effectiveClearedStageIds.includes(stageId);
};

export const isSinglePlayerStageUnlocked = (
    stages: Pick<SinglePlayerStageInfo, 'id'>[],
    progress: ReconciledSinglePlayerProgress,
    stageId: string
): boolean => {
    const stageIndex = getSinglePlayerStageIndex(stages, stageId);
    if (stageIndex <= 0) return stageIndex === 0;
    const previousStage = stages[stageIndex - 1];
    return !!previousStage && isSinglePlayerStageCleared(stages, progress, previousStage.id);
};
