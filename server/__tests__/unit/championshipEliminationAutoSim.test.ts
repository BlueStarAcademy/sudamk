import { describe, expect, it } from 'vitest';
import { CoreStat, LeagueTier } from '../../../shared/types/enums.js';
import type { Match, PlayerForTournament, Round, TournamentState, User } from '../../../shared/types/entities.js';
import { processMatchCompletion } from '../../tournamentService.js';

const defaultStats = (): Record<CoreStat, number> => ({
    [CoreStat.Concentration]: 50,
    [CoreStat.ThinkingSpeed]: 50,
    [CoreStat.Judgment]: 50,
    [CoreStat.Calculation]: 50,
    [CoreStat.CombatPower]: 50,
    [CoreStat.Stability]: 50,
});

const mkPlayer = (id: string, nickname: string): PlayerForTournament => {
    const stats = defaultStats();
    return {
        id,
        nickname,
        avatarId: 'default',
        borderId: 'default',
        league: LeagueTier.Bronze,
        stats,
        originalStats: { ...stats },
        wins: 0,
        losses: 0,
        condition: 80,
    };
};

const mkMatch = (
    id: string,
    p1: PlayerForTournament,
    p2: PlayerForTournament,
    extra: Partial<Match> = {},
): Match => ({
    id,
    players: [p1, p2],
    winner: null,
    isFinished: false,
    commentary: [],
    isUserMatch: p1.id === 'user' || p2.id === 'user',
    finalScore: null,
    sgfFileIndex: 1,
    ...extra,
});

const mkUser = (): User =>
    ({
        id: 'user',
        nickname: '유저',
    }) as User;

const allMatchesFinished = (state: TournamentState) =>
    state.rounds.every((r) => r.matches.every((m) => m.isFinished));

describe('championship elimination auto-simulation', () => {
    it('8강 탈락 시 결승·3/4위전까지 자동 완료하고 eliminated 상태를 유지한다', async () => {
        const players = Array.from({ length: 8 }, (_, i) =>
            mkPlayer(i === 0 ? 'user' : `bot-${i}`, i === 0 ? '유저' : `봇${i}`),
        );
        const rounds: Round[] = [
            {
                id: 1,
                name: '8강',
                matches: [
                    mkMatch('m-8-0', players[0], players[1]),
                    mkMatch('m-8-1', players[2], players[3]),
                    mkMatch('m-8-2', players[4], players[5]),
                    mkMatch('m-8-3', players[6], players[7]),
                ],
            },
        ];
        const state: TournamentState = {
            type: 'national',
            status: 'round_in_progress',
            title: 'test',
            players,
            rounds,
            currentSimulatingMatch: { roundIndex: 0, matchIndex: 0 },
            currentMatchCommentary: [],
            lastPlayedDate: Date.now(),
            nextRoundStartTime: null,
            currentStageAttempt: 1,
        } as TournamentState;

        const userMatch = rounds[0]!.matches[0]!;
        userMatch.isFinished = true;
        userMatch.winner = players[1]!;
        userMatch.finalScore = { player1: 45, player2: 55 };

        await processMatchCompletion(state, mkUser(), userMatch, 0);

        expect(state.status).toBe('eliminated');
        expect(allMatchesFinished(state)).toBe(true);
        expect(state.rounds.some((r) => r.name === '3,4위전')).toBe(true);
        expect(state.rounds.some((r) => r.name === '결승')).toBe(true);
    });

    it('4강 탈락 시 3/4위전·결승을 자동 완료한다', async () => {
        const players = Array.from({ length: 4 }, (_, i) =>
            mkPlayer(i === 0 ? 'user' : `bot-${i}`, i === 0 ? '유저' : `봇${i}`),
        );
        const rounds: Round[] = [
            {
                id: 1,
                name: '4강',
                matches: [
                    mkMatch('m-4-0', players[0], players[1]),
                    mkMatch('m-4-1', players[2], players[3], { isUserMatch: false }),
                ],
            },
        ];
        const state: TournamentState = {
            type: 'world',
            status: 'round_in_progress',
            title: 'test',
            players,
            rounds,
            currentSimulatingMatch: { roundIndex: 0, matchIndex: 0 },
            currentMatchCommentary: [],
            lastPlayedDate: Date.now(),
            nextRoundStartTime: null,
            currentStageAttempt: 1,
        } as TournamentState;

        const userMatch = rounds[0]!.matches[0]!;
        userMatch.isFinished = true;
        userMatch.winner = players[1]!;
        userMatch.finalScore = { player1: 45, player2: 55 };

        await processMatchCompletion(state, mkUser(), userMatch, 0);

        expect(state.status).toBe('eliminated');
        expect(allMatchesFinished(state)).toBe(true);
        expect(state.rounds.some((r) => r.name === '3,4위전')).toBe(true);
        expect(state.rounds.some((r) => r.name === '결승')).toBe(true);
    });
});
