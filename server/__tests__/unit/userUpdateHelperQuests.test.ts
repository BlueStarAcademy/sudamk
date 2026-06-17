import { describe, expect, it } from 'vitest';
import type { User } from '../../../shared/types/index.js';
import { getSelectiveUserUpdate } from '../../utils/userUpdateHelper.js';
import { updateQuestProgress } from '../../questService.js';

function makeUserWithRefineQuest(): User {
    return {
        id: 'user-1',
        quests: {
            daily: {
                quests: [
                    {
                        id: 'daily-refine',
                        title: '장비 제련',
                        description: '장비 제련 1회',
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
        },
        inventory: [],
        gold: 10_000,
    } as User;
}

describe('getSelectiveUserUpdate quest sync for blacksmith actions', () => {
    it('includes quests in REFINE_EQUIPMENT partial update after progress changes', () => {
        const user = makeUserWithRefineQuest();
        updateQuestProgress(user, 'equipment_refine_attempt');

        const partial = getSelectiveUserUpdate(user, 'REFINE_EQUIPMENT');
        expect(partial.quests?.daily?.quests?.[0]?.progress).toBe(1);
    });

    it('includes quests in ENHANCE_ITEM partial update', () => {
        const user = makeUserWithRefineQuest();
        user.quests!.daily!.quests![0]!.title = '장비 강화';
        updateQuestProgress(user, 'enhancement_attempt');

        const partial = getSelectiveUserUpdate(user, 'ENHANCE_ITEM');
        expect(partial.quests?.daily?.quests?.[0]?.progress).toBe(1);
    });

    it('always includes quests for unmapped action types when user has quests', () => {
        const user = makeUserWithRefineQuest();
        updateQuestProgress(user, 'equipment_refine_attempt');

        const partial = getSelectiveUserUpdate(user, 'UNKNOWN_ACTION');
        expect(partial.quests?.daily?.quests?.[0]?.progress).toBe(1);
    });
});
