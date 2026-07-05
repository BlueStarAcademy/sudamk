import { describe, expect, it } from 'vitest';
import { createTournament } from '../../tournamentService.js';
import type { PlayerForTournament, TournamentState, User } from '../../../shared/types/entities.js';

const mkPlayer = (id: string, condition = 1000): PlayerForTournament =>
    ({
        id,
        nickname: id,
        avatarId: 'avatar',
        borderId: 'border',
        league: 'Sprout',
        stats: {},
        originalStats: {},
        condition,
        wins: 0,
        losses: 0,
    }) as unknown as PlayerForTournament;

const mkCompletedTournament = (userId: string): TournamentState =>
    ({
        type: 'neighborhood',
        status: 'complete',
        title: 'old',
        players: [mkPlayer(userId, 1000), ...Array.from({ length: 5 }, (_, i) => mkPlayer(`old-bot-${i}`))],
        rounds: [],
        currentSimulatingMatch: null,
        currentMatchCommentary: [],
        lastPlayedDate: Date.now(),
        nextRoundStartTime: null,
        timeElapsed: 0,
        currentStageAttempt: 1,
    }) as TournamentState;

describe('createTournament championship dungeon condition reuse', () => {
    it('does not reuse terminal 1000 condition from a completed same-day run', () => {
        const user = {
            id: 'u1',
            nickname: 'tester',
            lastNeighborhoodPlayedDate: Date.now(),
            lastNeighborhoodTournament: mkCompletedTournament('u1'),
        } as User;

        const players = [mkPlayer('u1'), ...Array.from({ length: 5 }, (_, i) => mkPlayer(`bot-${i}`))];
        const tournament = createTournament('neighborhood', user, players);
        const userPlayer = tournament.players.find((p) => p.id === 'u1');

        expect(userPlayer?.condition).toBeGreaterThanOrEqual(1);
        expect(userPlayer?.condition).toBeLessThanOrEqual(100);
    });

    it('still carries condition from an unfinished same-day run', () => {
        const unfinished = mkCompletedTournament('u1');
        unfinished.status = 'bracket_ready';
        unfinished.players[0]!.condition = 77;
        const user = {
            id: 'u1',
            nickname: 'tester',
            lastNeighborhoodPlayedDate: Date.now(),
            lastNeighborhoodTournament: unfinished,
        } as User;

        const players = [mkPlayer('u1'), ...Array.from({ length: 5 }, (_, i) => mkPlayer(`bot-${i}`))];
        const tournament = createTournament('neighborhood', user, players);
        const userPlayer = tournament.players.find((p) => p.id === 'u1');

        expect(userPlayer?.condition).toBe(77);
    });
});
