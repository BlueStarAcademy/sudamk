import { describe, expect, it } from 'vitest';
import { CoreStat, LeagueTier } from '../../../shared/types/enums.js';
import type { Match, PlayerForTournament, Round, TournamentState, User } from '../../../shared/types/entities.js';
import {
    forfeitRemainingNeighborhoodLeagueMatches,
    forfeitTournament,
} from '../../tournamentService.js';

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

const mkUserMatch = (id: string, user: PlayerForTournament, bot: PlayerForTournament): Match => ({
    id,
    players: [user, bot],
    winner: null,
    isFinished: false,
    commentary: [],
    isUserMatch: true,
    finalScore: null,
    sgfFileIndex: 1,
});

const mkNeighborhoodDungeonState = (completedWinsBeforeCurrent: number): TournamentState => {
    const user = mkPlayer('user', '유저');
    const bots = Array.from({ length: 5 }, (_, i) => mkPlayer(`bot-${i}`, `봇${i}`));
    const currentRound = completedWinsBeforeCurrent + 1;
    const rounds: Round[] = Array.from({ length: 5 }, (_, i) => {
        const roundNum = i + 1;
        const match = mkUserMatch(`m-${roundNum}`, user, bots[i]!);
        if (roundNum < currentRound) {
            match.isFinished = true;
            match.winner = user;
        }
        return { id: roundNum, name: `${roundNum}회차`, matches: [match] };
    });

    return {
        type: 'neighborhood',
        status: 'round_in_progress',
        title: 'test',
        players: [user, ...bots],
        rounds,
        currentSimulatingMatch: { roundIndex: currentRound - 1, matchIndex: 0 },
        currentRoundRobinRound: currentRound,
        currentMatchCommentary: [],
        lastPlayedDate: Date.now(),
        nextRoundStartTime: Date.now() + 5000,
        currentStageAttempt: 2,
    } as TournamentState;
};

const mkUser = (): User =>
    ({
        id: 'user',
        nickname: '유저',
    }) as User;

describe('neighborhood league mid-exit forfeit', () => {
    it('2회차 도중 포기 시 남은 3~5회차를 패배 처리하고 complete·보상을 누적한다', async () => {
        const state = mkNeighborhoodDungeonState(1);
        const user = mkUser();

        await forfeitRemainingNeighborhoodLeagueMatches(state, user);

        expect(state.status).toBe('complete');
        expect(state.nextRoundStartTime).toBeNull();
        expect(state.currentSimulatingMatch).toBeNull();

        const userMatches = state.rounds.flatMap((r) => r.matches.filter((m) => m.isUserMatch));
        expect(userMatches.every((m) => m.isFinished)).toBe(true);
        expect(userMatches.filter((m) => m.winner?.id === 'user')).toHaveLength(1);
        expect(userMatches.filter((m) => m.winner?.id !== 'user')).toHaveLength(4);

        expect(state.matchGoldRewards?.length).toBe(4);
        expect((state.accumulatedGold ?? 0) > 0).toBe(true);
    });

    it('전국/월드 포기는 기존처럼 eliminated이며 보상을 누적하지 않는다', () => {
        const user = mkPlayer('user', '유저');
        const bot = mkPlayer('bot-1', '봇');
        const state = {
            type: 'national',
            status: 'round_in_progress',
            currentStageAttempt: 1,
            rounds: [
                {
                    id: 1,
                    name: '8강',
                    matches: [mkUserMatch('m-1', user, bot)],
                },
            ],
            players: [user, bot],
        } as TournamentState;

        forfeitTournament(state, 'user');

        expect(state.status).toBe('eliminated');
        expect(state.accumulatedMaterials).toBeUndefined();
    });
});
