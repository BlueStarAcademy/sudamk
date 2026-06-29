import { describe, expect, it } from 'vitest';
import type { TournamentState, User } from '../../../types.js';
import {
    invalidateStaleChampionshipDungeonRunsForUser,
    isChampionshipDungeonRunStale,
    isChampionshipDungeonTournamentFromToday,
} from '../../../shared/utils/championshipDungeonDailyReset.js';
import { getStartOfDayKST } from '../../../shared/utils/timeUtils.js';

const baseUser = (overrides: Partial<User> = {}): User =>
    ({
        id: 'u1',
        nickname: 'tester',
        dungeonProgress: {
            neighborhood: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
            national: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
            world: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
        },
        ...overrides,
    }) as User;

const dungeonRun = (overrides: Partial<TournamentState> = {}): TournamentState =>
    ({
        type: 'neighborhood',
        status: 'round_in_progress',
        currentStageAttempt: 3,
        lastPlayedDate: Date.now(),
        rounds: [],
        players: [],
        ...overrides,
    }) as TournamentState;

describe('championshipDungeonDailyReset', () => {
    it('marks yesterday dungeon run as stale via condition snapshot day', () => {
        const yesterday = getStartOfDayKST(Date.now()) - 24 * 60 * 60 * 1000;
        const user = baseUser({
            dungeonConditionSnapshot: {
                neighborhood: { condition: 80, dateStartOfDayKST: yesterday },
            },
            lastNeighborhoodTournament: dungeonRun(),
        });

        expect(isChampionshipDungeonRunStale(user, 'neighborhood', user.lastNeighborhoodTournament)).toBe(true);
    });

    it('invalidates stale in-progress dungeon tournament on user', () => {
        const yesterday = getStartOfDayKST(Date.now()) - 24 * 60 * 60 * 1000;
        const user = baseUser({
            dungeonConditionSnapshot: {
                neighborhood: { condition: 80, dateStartOfDayKST: yesterday },
            },
            lastNeighborhoodTournament: dungeonRun(),
            lastNeighborhoodPlayedDate: yesterday,
            neighborhoodRewardClaimed: false,
        });

        const result = invalidateStaleChampionshipDungeonRunsForUser(user);
        expect(result.modified).toBe(true);
        expect(result.clearedTypes).toEqual(['neighborhood']);
        expect(user.lastNeighborhoodTournament).toBeNull();
        expect(user.dungeonConditionSnapshot?.neighborhood).toBeUndefined();
    });

    it('keeps today dungeon run', () => {
        const today = getStartOfDayKST(Date.now());
        const run = dungeonRun({ lastPlayedDate: today });
        const user = baseUser({
            dungeonConditionSnapshot: {
                neighborhood: { condition: 80, dateStartOfDayKST: today },
            },
            lastNeighborhoodTournament: run,
        });

        expect(isChampionshipDungeonRunStale(user, 'neighborhood', run)).toBe(false);
        expect(isChampionshipDungeonTournamentFromToday(run, today)).toBe(true);
        expect(invalidateStaleChampionshipDungeonRunsForUser(user).modified).toBe(false);
    });
});
