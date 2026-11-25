import { describe, expect, it } from 'vitest';
import {
    getDailyAttendanceProgress,
    grantAttendanceQuestProgressIfNeeded,
    updateQuestProgress,
} from '../../questService.js';
import type { User } from '../../../types/index.js';

function makeUserWithAttendance(opts?: {
    dailyProgress?: number;
    weeklyProgress?: number;
    monthlyProgress?: number;
}): User {
    const dailyProgress = opts?.dailyProgress ?? 0;
    const weeklyProgress = opts?.weeklyProgress ?? 0;
    const monthlyProgress = opts?.monthlyProgress ?? 0;
    return {
        id: 'u1',
        nickname: 'tester',
        quests: {
            daily: {
                quests: [
                    {
                        id: 'q-d-0',
                        title: '출석하기',
                        description: '출석 1회',
                        target: 1,
                        progress: dailyProgress,
                        isClaimed: false,
                        reward: { gold: 100 },
                        activityPoints: 10,
                    },
                ],
                activityProgress: 0,
                claimedMilestones: [false, false, false, false, false],
                lastReset: Date.now(),
            },
            weekly: {
                quests: [
                    {
                        id: 'q-w-0',
                        title: '출석하기',
                        description: '출석 5회',
                        target: 5,
                        progress: weeklyProgress,
                        isClaimed: false,
                        reward: { gold: 500 },
                        activityPoints: 10,
                    },
                ],
                activityProgress: 0,
                claimedMilestones: [false, false, false, false, false],
                lastReset: Date.now(),
            },
            monthly: {
                quests: [
                    {
                        id: 'q-m-0',
                        title: '출석하기',
                        description: '출석 15회',
                        target: 15,
                        progress: monthlyProgress,
                        isClaimed: false,
                        reward: { gold: 1500 },
                        activityPoints: 10,
                    },
                ],
                activityProgress: 0,
                claimedMilestones: [false, false, false, false, false],
                lastReset: Date.now(),
            },
            achievements: { tracks: {} },
        },
    } as User;
}

describe('grantAttendanceQuestProgressIfNeeded', () => {
    it('increments daily/weekly/monthly attendance by 1 once per day', () => {
        const user = makeUserWithAttendance();
        expect(grantAttendanceQuestProgressIfNeeded(user)).toBe(true);
        expect(getDailyAttendanceProgress(user)).toBe(1);
        expect(user.quests!.weekly!.quests![0]!.progress).toBe(1);
        expect(user.quests!.monthly!.quests![0]!.progress).toBe(1);
        expect(grantAttendanceQuestProgressIfNeeded(user)).toBe(false);
        expect(user.quests!.monthly!.quests![0]!.progress).toBe(1);
    });

    it('updateQuestProgress(login) alone still bumps all periods (used by grant helper)', () => {
        const user = makeUserWithAttendance({ monthlyProgress: 14 });
        updateQuestProgress(user, 'login', undefined, 1);
        expect(user.quests!.monthly!.quests![0]!.progress).toBe(15);
        expect(user.quests!.daily!.quests![0]!.progress).toBe(1);
    });
});
