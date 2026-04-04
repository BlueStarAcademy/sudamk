/** 해당 단계 클리어 여부: 1~3위 달성 시에만 true. stageResults.cleared만 신뢰(순위 무관 보정 제거). */
export function isStageCleared(
    stageResults: Record<number, { cleared?: boolean }> | undefined,
    stage: number,
    _currentStage?: number,
    _maxUnlockedStage?: number
): boolean {
    if (!stageResults) return false;
    const entry = stageResults[stage] ?? (stageResults as Record<string, { cleared?: boolean }>)[String(stage)];
    return !!entry?.cleared;
}

/** API/저장소에서 온 dungeonProgress 정규화. unlockedStages는 서버 값만 사용(1~3위 시에만 다음 단계 추가되므로 보정 없음). */
export function normalizeDungeonProgress(
    raw: { currentStage?: number; unlockedStages?: number[]; stageResults?: Record<number | string, { cleared?: boolean }>; dailyStageAttempts?: Record<number, number> } | null | undefined
): { currentStage: number; unlockedStages: number[]; stageResults: Record<number, { cleared?: boolean }>; dailyStageAttempts: Record<number, number> } {
    const empty = { currentStage: 0, unlockedStages: [1], stageResults: {} as Record<number, { cleared?: boolean }>, dailyStageAttempts: {} as Record<number, number> };
    if (!raw) return empty;
    const currentStageNum = Number(raw.currentStage);
    const fromNumber = !Number.isNaN(currentStageNum) && currentStageNum >= 0 ? currentStageNum : 0;
    let derivedCurrent = fromNumber;
    const sr = raw.stageResults;
    if (sr && typeof sr === 'object') {
        for (let s = 1; s <= 10; s++) {
            const entry = sr[s] ?? (sr as Record<string, { cleared?: boolean }>)[String(s)];
            if (entry?.cleared) derivedCurrent = Math.max(derivedCurrent, s);
        }
    }
    const currentStage = Math.min(10, Math.max(0, derivedCurrent));
    const list = Array.isArray(raw.unlockedStages) ? raw.unlockedStages.map(Number).filter(n => !Number.isNaN(n) && n >= 1 && n <= 10) : [1];
    const unlockedStages = list.length > 0 ? [...new Set(list)].sort((a, b) => a - b) : [1];
    return {
        currentStage,
        unlockedStages,
        stageResults: (raw.stageResults as Record<number, { cleared?: boolean }>) ?? {},
        dailyStageAttempts: (raw.dailyStageAttempts as Record<number, number>) ?? {},
    };
}
