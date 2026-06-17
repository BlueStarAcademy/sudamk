import { describe, expect, it } from 'vitest';
import {
    mergeChampionshipVersusConditionSnapshotRecords,
    mergeDungeonConditionSnapshotRecords,
    resolveChampionshipDisplayCondition,
    shouldShowChampionshipConditionRecoveryButton,
    syncDungeonConditionSnapshotToTournamentPlayers,
} from '../../../shared/utils/championshipConditionDisplay.js';
import type { TournamentState, User } from '../../../types.js';

describe('championshipConditionDisplay', () => {
    it('prefers snapshot over stale player.condition for current user', () => {
        expect(
            resolveChampionshipDisplayCondition({
                playerCondition: 42,
                snapshotCondition: 58,
                isCurrentUser: true,
            }),
        ).toBe(58);
    });

    it('uses player.condition for opponents when valid', () => {
        expect(
            resolveChampionshipDisplayCondition({
                playerCondition: 42,
                snapshotCondition: 58,
                isCurrentUser: false,
            }),
        ).toBe(42);
    });

    it('syncDungeonConditionSnapshotToTournamentPlayers patches user player condition', () => {
        const user = {
            id: 'u1',
            dungeonConditionSnapshot: {
                neighborhood: { condition: 71, dateStartOfDayKST: 1 },
            },
            lastNeighborhoodTournament: {
                type: 'neighborhood',
                players: [{ id: 'u1', condition: 40 }],
            } as unknown as TournamentState,
        } as User;

        syncDungeonConditionSnapshotToTournamentPlayers(user);

        expect(user.lastNeighborhoodTournament?.players?.[0]?.condition).toBe(71);
    });

    it('mergeDungeonConditionSnapshotRecords keeps higher same-day condition (stale WS guard)', () => {
        const base = {
            neighborhood: { condition: 58, dateStartOfDayKST: 100 },
        };
        const patch = {
            neighborhood: { condition: 42, dateStartOfDayKST: 100 },
        };
        expect(mergeDungeonConditionSnapshotRecords(base, patch)?.neighborhood?.condition).toBe(58);
    });

    it('mergeDungeonConditionSnapshotRecords accepts higher patch condition', () => {
        const base = {
            neighborhood: { condition: 42, dateStartOfDayKST: 100 },
        };
        const patch = {
            neighborhood: { condition: 58, dateStartOfDayKST: 100 },
        };
        expect(mergeDungeonConditionSnapshotRecords(base, patch)?.neighborhood?.condition).toBe(58);
    });

    it('mergeChampionshipVersusConditionSnapshotRecords keeps higher same-day condition', () => {
        const base = {
            pvp: { condition: 70, dateStartOfDayKST: 200 },
        };
        const patch = {
            pvp: { condition: 55, dateStartOfDayKST: 200 },
        };
        expect(mergeChampionshipVersusConditionSnapshotRecords(base, patch)?.pvp?.condition).toBe(70);
    });

    it('shouldShowChampionshipConditionRecoveryButton when condition below 100', () => {
        expect(
            shouldShowChampionshipConditionRecoveryButton({ condition: 72, tournamentStatus: 'bracket_ready' }),
        ).toBe(true);
        expect(
            shouldShowChampionshipConditionRecoveryButton({ condition: 100, tournamentStatus: 'bracket_ready' }),
        ).toBe(false);
        expect(
            shouldShowChampionshipConditionRecoveryButton({ condition: 55, tournamentStatus: 'complete' }),
        ).toBe(false);
    });
});
