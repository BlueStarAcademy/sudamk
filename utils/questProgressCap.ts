import type { QuestLog } from '../types.js';
import {
    DAILY_MILESTONE_THRESHOLDS,
    WEEKLY_MILESTONE_THRESHOLDS,
    MONTHLY_MILESTONE_THRESHOLDS,
} from '../shared/constants/quests.js';

/** 퀘스트 주기 초기화 전까지 진행 수치가 목표를 넘지 않도록 표시·정규화에 사용 */
export function clampQuestProgressToTarget(progress: number, target: number): number {
    const p = Number.isFinite(progress) ? progress : 0;
    const t = Number.isFinite(target) ? target : 0;
    if (t <= 0) return Math.max(0, p);
    return Math.min(Math.max(0, p), t);
}

function clampQuestListInPlace(quests: { progress: number; target: number }[] | undefined): void {
    if (!quests) return;
    for (const q of quests) {
        q.progress = clampQuestProgressToTarget(q.progress, q.target);
    }
}

function clampActivityProgress(activity: number | undefined, maxVal: number): number {
    const a = Number.isFinite(activity ?? 0) ? (activity as number) : 0;
    if (maxVal <= 0) return Math.max(0, a);
    return Math.min(Math.max(0, a), maxVal);
}

/**
 * DB·이전 데이터로 progress / 활약도가 상한을 넘은 경우 인메모리에서 목표에 맞춤.
 * (주기 리셋 전까지 51/50 형태가 나오지 않도록)
 */
export function normalizeQuestLogProgressCaps(quests: QuestLog | undefined): void {
    if (!quests) return;
    const dailyMax = DAILY_MILESTONE_THRESHOLDS[DAILY_MILESTONE_THRESHOLDS.length - 1] ?? 100;
    const weeklyMax = WEEKLY_MILESTONE_THRESHOLDS[WEEKLY_MILESTONE_THRESHOLDS.length - 1] ?? 100;
    const monthlyMax = MONTHLY_MILESTONE_THRESHOLDS[MONTHLY_MILESTONE_THRESHOLDS.length - 1] ?? 100;

    if (quests.daily) {
        clampQuestListInPlace(quests.daily.quests);
        quests.daily.activityProgress = clampActivityProgress(quests.daily.activityProgress, dailyMax);
    }
    if (quests.weekly) {
        clampQuestListInPlace(quests.weekly.quests);
        quests.weekly.activityProgress = clampActivityProgress(quests.weekly.activityProgress, weeklyMax);
    }
    if (quests.monthly) {
        clampQuestListInPlace(quests.monthly.quests);
        quests.monthly.activityProgress = clampActivityProgress(quests.monthly.activityProgress, monthlyMax);
    }
}
