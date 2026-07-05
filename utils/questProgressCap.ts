import type { DailyQuestData, MonthlyQuestData, Quest, QuestLog, WeeklyQuestData } from '../types.js';
import {
    DAILY_MILESTONE_THRESHOLDS,
    WEEKLY_MILESTONE_THRESHOLDS,
    MONTHLY_MILESTONE_THRESHOLDS,
} from '../shared/constants/quests.js';

export const DEFAULT_CLAIMED_MILESTONES: boolean[] = [false, false, false, false, false];

export function normalizeClaimedMilestones(value: unknown): boolean[] {
    if (!Array.isArray(value)) {
        return [...DEFAULT_CLAIMED_MILESTONES];
    }
    return DEFAULT_CLAIMED_MILESTONES.map((_, index) => !!value[index]);
}

type QuestPeriodData = DailyQuestData | WeeklyQuestData | MonthlyQuestData;

function questPeriodHasAnchorableProgress(data: QuestPeriodData | undefined): boolean {
    if (!data) return false;
    if ((data.activityProgress ?? 0) > 0) return true;
    if (Array.isArray(data.claimedMilestones) && data.claimedMilestones.some(Boolean)) return true;
    return (data.quests ?? []).some((q) => (q.progress ?? 0) > 0 || q.isClaimed);
}

/**
 * 레거시/부분 저장 데이터에서 활약도 마일스톤·lastReset 누락을 보정한다.
 * lastReset=0인데 진행도가 있으면 당일 리셋으로 오인해 초기화되지 않도록 앵커를 둔다.
 */
export function normalizeQuestPeriodMetadata(
    data: QuestPeriodData | undefined,
    now: number,
): { modified: boolean; data: QuestPeriodData | undefined } {
    if (!data) return { modified: false, data };

    let modified = false;
    const normalizedMilestones = normalizeClaimedMilestones(data.claimedMilestones);
    if (
        !Array.isArray(data.claimedMilestones) ||
        data.claimedMilestones.length !== DEFAULT_CLAIMED_MILESTONES.length ||
        normalizedMilestones.some((claimed, index) => claimed !== !!data.claimedMilestones?.[index])
    ) {
        data.claimedMilestones = normalizedMilestones;
        modified = true;
    }

    if ((!data.lastReset || data.lastReset <= 0) && questPeriodHasAnchorableProgress(data)) {
        data.lastReset = now;
        modified = true;
    } else if (
        (!data.lastReset || data.lastReset <= 0) &&
        Array.isArray(data.quests) &&
        data.quests.length > 0
    ) {
        // lastReset=0 레거시: 진행도 0이어도 기존 퀘스트 목록이 있으면 당일 리셋으로 오인하지 않음
        data.lastReset = now;
        modified = true;
    }

    return { modified, data };
}

function mergeQuestEntryPreservingSessionProgress(primary: Quest, session: Quest | undefined): boolean {
    if (!session) return false;
    let modified = false;
    const mergedProgress = Math.max(primary.progress ?? 0, session.progress ?? 0);
    if (mergedProgress !== (primary.progress ?? 0)) {
        primary.progress = mergedProgress;
        modified = true;
    }
    if (session.isClaimed && !primary.isClaimed) {
        primary.isClaimed = true;
        modified = true;
    }
    return modified;
}

/**
 * 수령 직전 DB 스냅샷으로 user를 덮어쓸 때, 세션(캐시)에만 반영된 퀘스트 진행을 잃지 않도록 병합한다.
 * (비동기 db.updateUser 완료 전 수령, 또는 캐시 TTL 내 최신 진행도 보존)
 */
export function mergeQuestLogPreservingSessionProgress(
    target: QuestLog | undefined,
    session: QuestLog | undefined,
): boolean {
    if (!target || !session) return false;
    let modified = false;
    for (const key of ['daily', 'weekly', 'monthly'] as const) {
        const targetPeriod = target[key];
        const sessionPeriod = session[key];
        if (!targetPeriod || !sessionPeriod) continue;

        const maxActivity = Math.max(targetPeriod.activityProgress ?? 0, sessionPeriod.activityProgress ?? 0);
        if (maxActivity !== (targetPeriod.activityProgress ?? 0)) {
            targetPeriod.activityProgress = maxActivity;
            modified = true;
        }

        const targetMilestones = normalizeClaimedMilestones(targetPeriod.claimedMilestones);
        const sessionMilestones = normalizeClaimedMilestones(sessionPeriod.claimedMilestones);
        const mergedMilestones = targetMilestones.map((claimed, index) => claimed || sessionMilestones[index]!);
        if (mergedMilestones.some((claimed, index) => claimed !== targetMilestones[index])) {
            targetPeriod.claimedMilestones = mergedMilestones;
            modified = true;
        }

        const targetReset = targetPeriod.lastReset ?? 0;
        const sessionReset = sessionPeriod.lastReset ?? 0;
        const mergedReset = Math.max(targetReset, sessionReset);
        if (mergedReset > 0 && mergedReset !== targetReset) {
            targetPeriod.lastReset = mergedReset;
            modified = true;
        }

        const targetQuests = targetPeriod.quests ?? [];
        const sessionQuests = sessionPeriod.quests ?? [];
        if (targetQuests.length === 0 && sessionQuests.length > 0) {
            targetPeriod.quests = sessionQuests.map((quest) => ({ ...quest }));
            modified = true;
            continue;
        }

        for (let index = 0; index < targetQuests.length; index++) {
            if (mergeQuestEntryPreservingSessionProgress(targetQuests[index]!, sessionQuests[index])) {
                modified = true;
            }
        }

        for (let index = targetQuests.length; index < sessionQuests.length; index++) {
            const sessionQuest = sessionQuests[index];
            if (!sessionQuest) continue;
            if ((sessionQuest.progress ?? 0) > 0 || sessionQuest.isClaimed) {
                targetQuests.push({ ...sessionQuest });
                modified = true;
            }
        }
    }
    return modified;
}

export function normalizeQuestLogMetadata(quests: QuestLog | undefined, now: number): boolean {
    if (!quests) return false;
    let modified = false;
    for (const key of ['daily', 'weekly', 'monthly'] as const) {
        const result = normalizeQuestPeriodMetadata(quests[key], now);
        if (result.modified) modified = true;
    }
    return modified;
}

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
    normalizeQuestLogMetadata(quests, Date.now());
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
