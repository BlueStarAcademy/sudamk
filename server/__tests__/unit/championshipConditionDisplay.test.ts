import { describe, expect, it } from 'vitest';
import {
    resolveChampionshipDisplayCondition,
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
});
