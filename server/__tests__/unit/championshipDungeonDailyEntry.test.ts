import { describe, expect, it } from 'vitest';
import type { TournamentState, User } from '../../../types.js';
import {
    clearStaleChampionshipDungeonDailyEntryRecords,
    consumeChampionshipDungeonEntry,
    getChampionshipDungeonDailyEntryState,
    grantChampionshipDungeonAdBonusEntry,
} from '../../../shared/utils/championshipDungeonDailyEntry.js';
import { getStartOfDayKST } from '../../../shared/utils/timeUtils.js';

const baseUser = (overrides: Partial<User> = {}): User =>
    ({
        id: 'u1',
        nickname: 'tester',
        ...overrides,
    }) as User;

const dungeonRun = (overrides: Partial<TournamentState> = {}): TournamentState =>
    ({
        type: 'neighborhood',
        status: 'round_in_progress',
        currentStageAttempt: 1,
        lastPlayedDate: Date.now(),
        rounds: [],
        players: [],
        ...overrides,
    }) as TournamentState;

describe('championshipDungeonDailyEntry', () => {
    it('starts with one remaining entry for a fresh day', () => {
        const user = baseUser();
        const state = getChampionshipDungeonDailyEntryState(user, 'neighborhood');
        expect(state.remaining).toBe(1);
        expect(state.max).toBe(1);
        expect(state.canWatchAd).toBe(false);
    });

    it('consumes base entry and allows ad bonus', () => {
        const user = baseUser();
        consumeChampionshipDungeonEntry(user, 'neighborhood');
        let state = getChampionshipDungeonDailyEntryState(user, 'neighborhood');
        expect(state.remaining).toBe(0);
        expect(state.canWatchAd).toBe(true);

        const grant = grantChampionshipDungeonAdBonusEntry(user, 'neighborhood');
        expect(grant.ok).toBe(true);
        state = getChampionshipDungeonDailyEntryState(user, 'neighborhood');
        expect(state.remaining).toBe(1);
        expect(state.adBonusGranted).toBe(true);
        expect(state.canWatchAd).toBe(false);
    });

    it('blocks ad bonus until base entry is used', () => {
        const user = baseUser();
        const grant = grantChampionshipDungeonAdBonusEntry(user, 'neighborhood');
        expect(grant.ok).toBe(false);
    });

    it('does not treat last*PlayedDate alone as consumed dungeon entry (midnight auto-session)', () => {
        const user = baseUser({
            lastNeighborhoodPlayedDate: Date.now(),
            lastNeighborhoodTournament: {
                type: 'neighborhood',
                status: 'bracket_ready',
                rounds: [],
                players: [],
            } as TournamentState,
        });
        const state = getChampionshipDungeonDailyEntryState(user, 'neighborhood');
        expect(state.remaining).toBe(1);
        expect(state.canWatchAd).toBe(false);
    });

    it('infers legacy dungeon snapshot today as consumed base entry', () => {
        const today = getStartOfDayKST(Date.now());
        const user = baseUser({
            dungeonConditionSnapshot: {
                neighborhood: { condition: 80, dateStartOfDayKST: today },
            },
        });
        const state = getChampionshipDungeonDailyEntryState(user, 'neighborhood');
        expect(state.remaining).toBe(0);
        expect(state.canWatchAd).toBe(true);
    });

    it('infers legacy in-progress dungeon run today as consumed base entry', () => {
        const today = getStartOfDayKST(Date.now());
        const user = baseUser({
            lastNeighborhoodTournament: dungeonRun({ lastPlayedDate: today }),
        });
        const state = getChampionshipDungeonDailyEntryState(user, 'neighborhood');
        expect(state.remaining).toBe(0);
        expect(state.canWatchAd).toBe(true);
    });

    it('resets on a new KST day', () => {
        const yesterday = getStartOfDayKST(Date.now()) - 24 * 60 * 60 * 1000;
        const user = baseUser({
            championshipDungeonDailyEntry: {
                neighborhood: { dateStartOfDayKST: yesterday, entriesUsed: 2, adBonusGranted: true },
            },
        });
        const state = getChampionshipDungeonDailyEntryState(user, 'neighborhood');
        expect(state.remaining).toBe(1);
        expect(state.canWatchAd).toBe(false);
    });

    it('clearStaleChampionshipDungeonDailyEntryRecords removes yesterday records only', () => {
        const yesterday = getStartOfDayKST(Date.now()) - 24 * 60 * 60 * 1000;
        const today = getStartOfDayKST(Date.now());
        const user = baseUser({
            championshipDungeonDailyEntry: {
                neighborhood: { dateStartOfDayKST: yesterday, entriesUsed: 1, adBonusGranted: false },
                national: { dateStartOfDayKST: today, entriesUsed: 1, adBonusGranted: false },
            },
        });
        expect(clearStaleChampionshipDungeonDailyEntryRecords(user)).toBe(true);
        expect(user.championshipDungeonDailyEntry?.neighborhood).toBeUndefined();
        expect(user.championshipDungeonDailyEntry?.national?.entriesUsed).toBe(1);
    });
});
