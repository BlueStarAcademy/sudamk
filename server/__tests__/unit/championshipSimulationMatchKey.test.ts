import { describe, expect, it } from 'vitest';
import {
    getChampionshipSimulationMatchKey,
    isChampionshipDungeonPve,
    isChampionshipRealGameFirstArrival,
} from '../../../shared/utils/championshipSimulationMatchKey.js';
import type { TournamentState } from '../../../types.js';

function dungeonTournament(overrides: Partial<TournamentState> = {}): TournamentState {
    return {
        type: 'neighborhood',
        status: 'round_in_progress',
        currentStageAttempt: 3,
        currentSimulatingMatch: { roundIndex: 0, matchIndex: 0 },
        rounds: [
            {
                id: 1,
                name: '1회차',
                matches: [
                    {
                        id: 'm-1',
                        players: [{ id: 'u1' }, { id: 'bot-1' }],
                        isUserMatch: true,
                        isFinished: false,
                        commentary: [],
                        finalScore: null,
                        sgfFileIndex: 1,
                    },
                ],
            },
        ],
        players: [],
        ...overrides,
    } as unknown as TournamentState;
}

describe('championshipSimulationMatchKey', () => {
    it('uses stable real: key for dungeon PVE before kata moves arrive', () => {
        const t = dungeonTournament();
        expect(getChampionshipSimulationMatchKey(t)).toBe('real:neighborhood:0:0:m-1');
    });

    it('keeps the same key after kata moves are attached', () => {
        const before = dungeonTournament();
        const after = dungeonTournament({
            rounds: [
                {
                    id: 1,
                    name: '1회차',
                    matches: [
                        {
                            id: 'm-1',
                            players: [{ id: 'u1' }, { id: 'bot-1' }],
                            isUserMatch: true,
                            isFinished: false,
                            commentary: [],
                            finalScore: null,
                            sgfFileIndex: 1,
                            championshipRealGame: {
                                moves: [{ x: 3, y: 3, player: 1 }],
                                currentPly: 0,
                                boardSize: 9,
                                status: 'playing',
                            },
                        },
                    ],
                },
            ],
        } as Partial<TournamentState>);
        expect(getChampionshipSimulationMatchKey(before)).toBe(getChampionshipSimulationMatchKey(after));
    });

    it('detects first real-game arrival for dungeon merge reset', () => {
        const prev = dungeonTournament();
        const resolved = dungeonTournament({
            rounds: [
                {
                    id: 1,
                    name: '1회차',
                    matches: [
                        {
                            id: 'm-1',
                            championshipRealGame: { moves: [{ x: 1, y: 1, player: 1 }], boardSize: 9 },
                        },
                    ],
                },
            ],
        } as Partial<TournamentState>);
        expect(isChampionshipRealGameFirstArrival(prev, resolved)).toBe(true);
        expect(isChampionshipDungeonPve(prev)).toBe(true);
    });
});
