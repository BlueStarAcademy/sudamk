import { describe, expect, it } from 'vitest';
import type { User } from '../../../types.js';
import {
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

    it('infers legacy played-today as consumed base entry', () => {
        const user = baseUser({ lastNeighborhoodPlayedDate: Date.now() });
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
});
