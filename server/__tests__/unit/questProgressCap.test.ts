import { describe, expect, it } from 'vitest';
import {
    DEFAULT_CLAIMED_MILESTONES,
    mergeQuestLogPreservingSessionProgress,
    normalizeClaimedMilestones,
    normalizeQuestLogMetadata,
    normalizeQuestPeriodMetadata,
} from '../../../utils/questProgressCap.js';

describe('normalizeClaimedMilestones', () => {
    it('returns five false flags when value is missing', () => {
        expect(normalizeClaimedMilestones(undefined)).toEqual(DEFAULT_CLAIMED_MILESTONES);
    });

    it('pads and coerces partial legacy arrays', () => {
        expect(normalizeClaimedMilestones([true])).toEqual([true, false, false, false, false]);
    });
});

describe('normalizeQuestPeriodMetadata', () => {
    it('anchors lastReset when progress exists but reset timestamp is zero', () => {
        const now = 1_700_000_000_000;
        const { modified, data } = normalizeQuestPeriodMetadata(
            {
                quests: [{ id: 'q1', title: '출석', description: '', target: 1, progress: 1, isClaimed: false, reward: { gold: 100 }, activityPoints: 10 }],
                activityProgress: 40,
                claimedMilestones: undefined as unknown as boolean[],
                lastReset: 0,
            },
            now,
        );

        expect(modified).toBe(true);
        expect(data?.lastReset).toBe(now);
        expect(data?.claimedMilestones).toEqual(DEFAULT_CLAIMED_MILESTONES);
    });

    it('does not anchor empty fresh period data', () => {
        const now = 1_700_000_000_000;
        const { modified, data } = normalizeQuestPeriodMetadata(
            {
                quests: [],
                activityProgress: 0,
                claimedMilestones: [],
                lastReset: 0,
            },
            now,
        );

        expect(modified).toBe(true);
        expect(data?.lastReset).toBe(0);
        expect(data?.claimedMilestones).toEqual(DEFAULT_CLAIMED_MILESTONES);
    });
});

describe('normalizeQuestLogMetadata', () => {
    it('normalizes all quest periods', () => {
        const now = 1_700_000_000_000;
        const quests = {
            daily: {
                quests: [],
                activityProgress: 20,
                claimedMilestones: undefined as unknown as boolean[],
                lastReset: 0,
            },
            weekly: {
                quests: [],
                activityProgress: 0,
                claimedMilestones: [false, false, false, false, false],
                lastReset: now - 1,
            },
            monthly: {
                quests: [],
                activityProgress: 0,
                claimedMilestones: [false, false, false, false, false],
                lastReset: now - 1,
            },
            achievements: { tracks: {} },
        };

        expect(normalizeQuestLogMetadata(quests, now)).toBe(true);
        expect(quests.daily.claimedMilestones).toEqual(DEFAULT_CLAIMED_MILESTONES);
        expect(quests.daily.lastReset).toBe(now);
    });

    it('anchors lastReset when quest list exists without progress (legacy lastReset=0)', () => {
        const now = 1_700_000_000_000;
        const quests = {
            daily: {
                quests: [{ id: 'q-d-0-1', title: '출석하기', description: '', target: 1, progress: 0, isClaimed: false, reward: { gold: 100 } }],
                activityProgress: 0,
                claimedMilestones: [false, false, false, false, false],
                lastReset: 0,
            },
            weekly: {
                quests: [],
                activityProgress: 0,
                claimedMilestones: [false, false, false, false, false],
                lastReset: now - 1,
            },
            monthly: {
                quests: [],
                activityProgress: 0,
                claimedMilestones: [false, false, false, false, false],
                lastReset: now - 1,
            },
            achievements: { tracks: {} },
        };

        expect(normalizeQuestLogMetadata(quests, now)).toBe(true);
        expect(quests.daily.lastReset).toBe(now);
    });
});

describe('mergeQuestLogPreservingSessionProgress', () => {
    it('keeps higher quest progress from session after DB snapshot overwrite', () => {
        const target = {
            daily: {
                quests: [{ id: 'q-d-0-new', title: '출석하기', description: '', target: 1, progress: 0, isClaimed: false, reward: { gold: 100 } }],
                activityProgress: 0,
                claimedMilestones: [false, false, false, false, false],
                lastReset: 0,
            },
        };
        const session = {
            daily: {
                quests: [{ id: 'q-d-0-old', title: '출석하기', description: '', target: 1, progress: 1, isClaimed: false, reward: { gold: 100 }, activityPoints: 10 }],
                activityProgress: 10,
                claimedMilestones: [false, false, false, false, false],
                lastReset: 1_700_000_000_000,
            },
        };

        expect(mergeQuestLogPreservingSessionProgress(target as any, session as any)).toBe(true);
        expect(target.daily.quests[0]?.progress).toBe(1);
        expect(target.daily.activityProgress).toBe(10);
        expect(target.daily.lastReset).toBe(1_700_000_000_000);
    });
});
