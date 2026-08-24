import { describe, expect, it } from 'vitest';
import type { User } from '../../../shared/types/index.js';
import {
    TRAINING_GROUND_KATA_CLEAR_TRACK_ID,
    TRAINING_GROUND_PET_CLEAR_TRACK_ID,
    ACHIEVEMENT_TRACK_MAP,
} from '../../../shared/constants/achievements.js';
import { getAchievementProgressDisplay, isAchievementRequirementMet } from '../../../shared/utils/achievementProgress.js';

describe('training ground clear achievements', () => {
    const kataTrack = ACHIEVEMENT_TRACK_MAP[TRAINING_GROUND_KATA_CLEAR_TRACK_ID];
    const petTrack = ACHIEVEMENT_TRACK_MAP[TRAINING_GROUND_PET_CLEAR_TRACK_ID];

    it('defines 10 stages with diamond rewards 10..100', () => {
        expect(kataTrack.stages.length).toBe(10);
        expect(petTrack.stages.length).toBe(10);
        expect(kataTrack.stages.map((s) => s.rewardDiamonds)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
        expect(kataTrack.stages.map((s) => s.requirement)).toEqual([
            { type: 'training_ground_stage_clear', track: 'kata', stage: 1 },
            { type: 'training_ground_stage_clear', track: 'kata', stage: 5 },
            { type: 'training_ground_stage_clear', track: 'kata', stage: 10 },
            { type: 'training_ground_stage_clear', track: 'kata', stage: 15 },
            { type: 'training_ground_stage_clear', track: 'kata', stage: 20 },
            { type: 'training_ground_stage_clear', track: 'kata', stage: 24 },
            { type: 'training_ground_stage_clear', track: 'kata', stage: 28 },
            { type: 'training_ground_stage_clear', track: 'kata', stage: 32 },
            { type: 'training_ground_stage_clear', track: 'kata', stage: 36 },
            { type: 'training_ground_stage_clear', track: 'kata', stage: 40 },
        ]);
    });

    it('met when max cleared stage reaches milestone (kata -26 = stage 5)', () => {
        const user = {
            trainingGround: { kataClearedLevels: [-30, -26], petClearedLevels: [] },
        } as User;
        const stage5 = kataTrack.stages[1];
        expect(getAchievementProgressDisplay(stage5, user)).toEqual({ current: 5, target: 5 });
        expect(isAchievementRequirementMet(stage5, user)).toBe(true);
        const stage10 = kataTrack.stages[2];
        expect(isAchievementRequirementMet(stage10, user)).toBe(false);
    });

    it('tracks pet clears separately from kata', () => {
        const user = {
            trainingGround: { kataClearedLevels: [-30], petClearedLevels: [-28] },
        } as User;
        const petStage3 = petTrack.stages[0];
        expect(isAchievementRequirementMet(petStage3, user)).toBe(true);
        expect(isAchievementRequirementMet(kataTrack.stages[1], user)).toBe(false);
    });
});
