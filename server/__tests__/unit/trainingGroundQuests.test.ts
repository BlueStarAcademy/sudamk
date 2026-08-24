import { describe, expect, it } from 'vitest';
import type { User } from '../../../shared/types/index.js';
import { updateQuestProgress } from '../../questService.js';

function makeUserWithTrainingGroundQuests(): User {
    return {
        id: 'user-1',
        quests: {
            daily: {
                quests: [
                    {
                        id: 'daily-kata',
                        title: '심법 수련 승리하기',
                        description: '심법 수련 1회 승리',
                        target: 1,
                        progress: 0,
                        isClaimed: false,
                        reward: { gold: 100 },
                        activityPoints: 10,
                    },
                    {
                        id: 'daily-pet',
                        title: '단짝 수련 승리하기',
                        description: '단짝 수련 1회 승리',
                        target: 1,
                        progress: 0,
                        isClaimed: false,
                        reward: { gold: 100 },
                        activityPoints: 10,
                    },
                ],
                activityProgress: 0,
                claimedMilestones: [],
            },
            weekly: {
                quests: [
                    {
                        id: 'weekly-kata',
                        title: '심법 수련 승리하기',
                        description: '심법 수련 5회 승리',
                        target: 5,
                        progress: 0,
                        isClaimed: false,
                        reward: { gold: 500 },
                        activityPoints: 10,
                    },
                ],
                activityProgress: 0,
                claimedMilestones: [],
            },
        },
        inventory: [],
        gold: 10_000,
    } as User;
}

describe('training ground win quests', () => {
    it('increments kata win quest only for kata track', () => {
        const user = makeUserWithTrainingGroundQuests();
        updateQuestProgress(user, 'training_ground_win', undefined, 1, { trainingGroundTrack: 'kata' });

        expect(user.quests?.daily?.quests?.[0]?.progress).toBe(1);
        expect(user.quests?.daily?.quests?.[1]?.progress).toBe(0);
        expect(user.quests?.weekly?.quests?.[0]?.progress).toBe(1);
    });

    it('increments pet win quest only for pet track', () => {
        const user = makeUserWithTrainingGroundQuests();
        updateQuestProgress(user, 'training_ground_win', undefined, 1, { trainingGroundTrack: 'pet' });

        expect(user.quests?.daily?.quests?.[0]?.progress).toBe(0);
        expect(user.quests?.daily?.quests?.[1]?.progress).toBe(1);
        expect(user.quests?.weekly?.quests?.[0]?.progress).toBe(0);
    });
});
