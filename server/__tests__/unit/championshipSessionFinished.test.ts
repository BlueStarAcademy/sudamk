import { describe, expect, it } from 'vitest';
import type { TournamentState } from '../../../shared/types/entities.js';
import {
    areAllChampionshipMatchesFinished,
    isChampionshipSessionFinished,
} from '../../../shared/utils/championshipSessionFinished.js';

const base = (over: Partial<TournamentState>): TournamentState =>
    ({
        type: 'neighborhood',
        status: 'bracket_ready',
        title: 'test',
        players: [],
        rounds: [],
        currentSimulatingMatch: null,
        currentMatchCommentary: [],
        lastPlayedDate: Date.now(),
        nextRoundStartTime: null,
        timeElapsed: 0,
        currentStageAttempt: 1,
        ...over,
    }) as TournamentState;

describe('championshipSessionFinished', () => {
    it('does not treat empty rounds as finished (vacuous every trap)', () => {
        const empty = base({ status: 'bracket_ready', rounds: [] });
        expect(areAllChampionshipMatchesFinished(empty)).toBe(false);
        expect(isChampionshipSessionFinished(empty)).toBe(false);
    });

    it('keeps bracket_ready / round_complete as not finished even if matches look done', () => {
        const rounds = [
            {
                id: 1,
                name: '1회차',
                matches: [
                    {
                        id: 'm1',
                        players: [null, null],
                        winner: null,
                        isFinished: true,
                        commentary: [],
                        isUserMatch: true,
                        finalScore: null,
                        sgfFileIndex: 1,
                    },
                ],
            },
        ];
        expect(isChampionshipSessionFinished(base({ status: 'bracket_ready', rounds: rounds as any }))).toBe(false);
        expect(isChampionshipSessionFinished(base({ status: 'round_complete', rounds: rounds as any }))).toBe(false);
    });

    it('returns true for complete / eliminated', () => {
        expect(isChampionshipSessionFinished(base({ status: 'complete', rounds: [] }))).toBe(true);
        expect(isChampionshipSessionFinished(base({ status: 'eliminated', rounds: [] }))).toBe(true);
    });

    it('requires non-empty rounds with finished matches for unknown status fallback', () => {
        const unfinished = base({
            status: 'unknown' as TournamentState['status'],
            rounds: [
                {
                    id: 1,
                    name: '1회차',
                    matches: [
                        {
                            id: 'm1',
                            players: [null, null],
                            winner: null,
                            isFinished: false,
                            commentary: [],
                            isUserMatch: true,
                            finalScore: null,
                            sgfFileIndex: 1,
                        },
                    ],
                },
            ],
        } as any);
        expect(isChampionshipSessionFinished(unfinished)).toBe(false);

        const finished = base({
            status: 'unknown' as TournamentState['status'],
            rounds: [
                {
                    id: 1,
                    name: '1회차',
                    matches: [
                        {
                            id: 'm1',
                            players: [null, null],
                            winner: null,
                            isFinished: true,
                            commentary: [],
                            isUserMatch: true,
                            finalScore: null,
                            sgfFileIndex: 1,
                        },
                    ],
                },
            ],
        } as any);
        expect(isChampionshipSessionFinished(finished)).toBe(true);
    });
});
