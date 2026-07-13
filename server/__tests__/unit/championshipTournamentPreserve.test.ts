import { describe, expect, it } from 'vitest';
import { Player } from '../../../shared/types/enums.js';
import type { Match, Round, TournamentState } from '../../../shared/types/entities.js';
import {
    findActiveChampionshipUserMatch,
    isSameActiveSimulatingMatchSlot,
    mergeChampionshipTournamentPreserveLostRealGame,
    mergeResolvedRoundsPreserveChampionshipPlayback,
    mergeTerminalTournamentPreserveFinishedBoard,
    mergeTerminalTournamentPreserveScoringBoard,
    buildEliminationRemainingMatchesHoldState,
    isChampionshipEliminationRemainingMatchesPath,
    repairTournamentSimulatingPointer,
    recoverStuckChampionshipRoundInProgress,
    prepareTournamentStateForMatchStart,
    isDungeonAutoNextResultReviewActive,
} from '../../../shared/utils/championshipTournamentPreserve.js';

const mkMatch = (id: string, extra: Partial<Match> = {}): Match => ({
    id,
    players: [null, null],
    winner: null,
    isFinished: false,
    commentary: [],
    isUserMatch: true,
    finalScore: null,
    ...extra,
});

const mkState = (rounds: Round[], sim: TournamentState['currentSimulatingMatch'], timeElapsed = 0): TournamentState =>
    ({
        type: 'national',
        status: 'round_in_progress',
        title: 't',
        players: [],
        rounds,
        currentSimulatingMatch: sim,
        currentMatchCommentary: [],
        lastPlayedDate: 0,
        nextRoundStartTime: null,
        timeElapsed,
    }) as TournamentState;

describe('championshipTournamentPreserve', () => {
    it('isSameActiveSimulatingMatchSlot is false when match id differs at same indices', () => {
        const rounds: Round[] = [{ id: 1, name: '8강', matches: [mkMatch('m-new'), mkMatch('m2')] }];
        const prev = mkState(rounds, { roundIndex: 0, matchIndex: 0 });
        prev.rounds[0]!.matches[0] = mkMatch('m-old', { isFinished: false });

        const resolved = mkState(
            [{ id: 1, name: '8강', matches: [mkMatch('m-new', { isFinished: false }), mkMatch('m2')] }],
            { roundIndex: 0, matchIndex: 0 },
        );

        expect(isSameActiveSimulatingMatchSlot(prev, resolved)).toBe(false);
    });

    it('mergeResolvedRoundsPreserveChampionshipPlayback does not graft old moves onto a new match id', () => {
        const oldMoves = Array.from({ length: 10 }, (_, i) => ({
            x: i % 9,
            y: Math.floor(i / 9),
            player: 1 as const,
            actorId: 'a',
        }));
        const prevMatch = mkMatch('m-old', {
            championshipRealGame: {
                boardSize: 9,
                maxPly: 50,
                blackPlayerId: 'a',
                whitePlayerId: 'b',
                boardState: [],
                moves: oldMoves as any,
                lastMove: null,
                currentPly: 10,
                status: 'playing',
                finalScore: null,
                winnerId: null,
                events: [],
                phaseStatsByPlayerId: {},
            } as any,
        });
        const prev = mkState([{ id: 1, name: '8강', matches: [prevMatch, mkMatch('x')] }], { roundIndex: 0, matchIndex: 0 }, 10);

        const newMatch = mkMatch('m-new', {
            championshipRealGame: {
                boardSize: 9,
                maxPly: 50,
                blackPlayerId: 'a',
                whitePlayerId: 'b',
                boardState: [],
                moves: [],
                lastMove: null,
                currentPly: 0,
                status: 'ready',
                finalScore: null,
                winnerId: null,
                events: [],
                phaseStatsByPlayerId: {},
            } as any,
        });
        const resolved = mkState(
            [{ id: 1, name: '8강', matches: [newMatch, mkMatch('x')] }],
            { roundIndex: 0, matchIndex: 0 },
            0,
        );

        const merged = mergeResolvedRoundsPreserveChampionshipPlayback(prev, resolved);
        expect(merged[0]!.matches[0]!.id).toBe('m-new');
        expect((merged[0]!.matches[0]!.championshipRealGame?.moves ?? []).length).toBe(0);
    });

    it('mergeResolvedRoundsPreserveChampionshipPlayback prefers server terminal result when match finished', () => {
        const moves = [{ x: 3, y: 3, player: Player.Black, actorId: 'a' }];
        const prevGame = {
            boardSize: 9 as const,
            maxPly: 50,
            blackPlayerId: 'a',
            whitePlayerId: 'b',
            boardState: [],
            moves,
            lastMove: { x: 3, y: 3 },
            currentPly: 1,
            status: 'scoring' as const,
            finalScore: { black: 10, white: 8, scoreLead: 2 },
            winnerId: 'a',
            events: [],
            phaseStatsByPlayerId: {},
        };
        const resolvedGame = {
            ...prevGame,
            status: 'finished' as const,
            winnerId: 'b',
            finalScore: { black: 8, white: 10, scoreLead: -2 },
        };
        const prev = mkState(
            [{ id: 1, name: '8강', matches: [mkMatch('m1', { championshipRealGame: prevGame as any }), mkMatch('x')] }],
            { roundIndex: 0, matchIndex: 0 },
            1,
        );
        const resolved = mkState(
            [
                {
                    id: 1,
                    name: '8강',
                    matches: [mkMatch('m1', { isFinished: true, championshipRealGame: resolvedGame as any }), mkMatch('x')],
                },
            ],
            { roundIndex: 0, matchIndex: 0 },
            1,
        );

        const merged = mergeResolvedRoundsPreserveChampionshipPlayback(prev, resolved);
        expect(merged[0]!.matches[0]!.championshipRealGame?.winnerId).toBe('b');
        expect(merged[0]!.matches[0]!.championshipRealGame?.status).toBe('finished');
    });

    it('mergeChampionshipTournamentPreserveLostRealGame does not restore base game onto different match id', () => {
        const baseGame = {
            boardSize: 9 as const,
            maxPly: 50,
            blackPlayerId: 'a',
            whitePlayerId: 'b',
            boardState: [],
            moves: [{ x: 3, y: 3, player: 1 as const, actorId: 'a' }],
            lastMove: { x: 3, y: 3 },
            currentPly: 1,
            status: 'playing' as const,
            finalScore: null,
            winnerId: null,
            events: [],
            phaseStatsByPlayerId: {},
        };
        const base = mkState(
            [{ id: 1, name: '8강', matches: [mkMatch('m-old', { championshipRealGame: baseGame as any }), mkMatch('x')] }],
            { roundIndex: 0, matchIndex: 0 },
        );

        const patch = mkState(
            [{ id: 1, name: '8강', matches: [mkMatch('m-new', { championshipRealGame: { ...baseGame, moves: [] } as any }), mkMatch('x')] }],
            { roundIndex: 0, matchIndex: 0 },
        );

        const out = mergeChampionshipTournamentPreserveLostRealGame(base, patch);
        expect(out?.rounds[0]?.matches[0]?.id).toBe('m-new');
        expect((out?.rounds[0]?.matches[0]?.championshipRealGame?.moves ?? []).length).toBe(0);
    });

    it('findActiveChampionshipUserMatch returns in-progress real game without sim pointer', () => {
        const userId = 'u1';
        const rounds: Round[] = [
            {
                id: 1,
                name: '8강',
                matches: [
                    mkMatch('m1', {
                        isUserMatch: true,
                        players: [{ id: userId, nickname: 'me' } as any, { id: 'bot', nickname: 'bot' } as any],
                        championshipRealGame: {
                            boardSize: 19,
                            moves: [{ x: 3, y: 3, player: Player.Black, actorId: userId }],
                            currentPly: 0,
                            status: 'playing',
                        } as any,
                    }),
                ],
            },
        ];
        const state = mkState(rounds, null);
        const found = findActiveChampionshipUserMatch(state, userId);
        expect(found?.id).toBe('m1');
    });

    it('repairTournamentSimulatingPointer restores currentSimulatingMatch', () => {
        const userId = 'u1';
        const rounds: Round[] = [
            {
                id: 1,
                name: '8강',
                matches: [
                    mkMatch('m1', {
                        isUserMatch: true,
                        players: [{ id: userId, nickname: 'me' } as any, { id: 'bot', nickname: 'bot' } as any],
                        championshipRealGame: {
                            boardSize: 19,
                            moves: [{ x: 3, y: 3, player: Player.Black, actorId: userId }],
                            currentPly: 0,
                            status: 'playing',
                        } as any,
                    }),
                ],
            },
        ];
        const state = mkState(rounds, null);
        const repaired = repairTournamentSimulatingPointer(state, userId);
        expect(repaired.currentSimulatingMatch).toEqual({ roundIndex: 0, matchIndex: 0 });
    });

    it('recoverStuckChampionshipRoundInProgress moves to bracket_ready when kata never attached', () => {
        const state = mkState(
            [{ id: 1, name: '8강', matches: [mkMatch('m1', { isFinished: false })] }],
            { roundIndex: 0, matchIndex: 0 },
        );
        const { tournament, recovered } = recoverStuckChampionshipRoundInProgress(state, 'u1');
        expect(recovered).toBe(true);
        expect(tournament.status).toBe('bracket_ready');
        expect(tournament.currentSimulatingMatch).toBeNull();
    });

    it('recoverStuckChampionshipRoundInProgress keeps generating match in round_in_progress', () => {
        const state = mkState(
            [{ id: 1, name: '8강', matches: [mkMatch('m1', { isFinished: false })] }],
            { roundIndex: 0, matchIndex: 0 },
        );
        state.championshipMatchGeneratingMatchId = 'm1';
        const { tournament, recovered } = recoverStuckChampionshipRoundInProgress(state, 'u1');
        expect(recovered).toBe(false);
        expect(tournament.status).toBe('round_in_progress');
        expect(tournament.currentSimulatingMatch).toEqual({ roundIndex: 0, matchIndex: 0 });
    });

    it('prepareTournamentStateForMatchStart syncs while kata generation is in flight', () => {
        const state = mkState(
            [{ id: 1, name: '8강', matches: [mkMatch('m2', { isFinished: false })] }],
            { roundIndex: 0, matchIndex: 0 },
        );
        state.status = 'round_in_progress';
        state.championshipMatchGeneratingMatchId = 'm2';
        const { tournament, shouldSyncOnly } = prepareTournamentStateForMatchStart(state, 'u1', 'm2');
        expect(shouldSyncOnly).toBe(true);
        expect(tournament.status).toBe('round_in_progress');
        expect(tournament.championshipMatchGeneratingMatchId).toBe('m2');
    });

    it('recoverStuckChampionshipRoundInProgress clears finished sim pointer to bracket_ready', () => {
        const state = mkState(
            [
                {
                    id: 1,
                    name: '8강',
                    matches: [
                        mkMatch('m1', { isFinished: true, winner: { id: 'u1' } as any }),
                        mkMatch('m2', { isFinished: false }),
                    ],
                },
            ],
            { roundIndex: 0, matchIndex: 0 },
        );
        const { tournament, recovered } = recoverStuckChampionshipRoundInProgress(state, 'u1');
        expect(recovered).toBe(true);
        expect(tournament.status).toBe('bracket_ready');
        expect(tournament.currentSimulatingMatch).toBeNull();
    });

    it('prepareTournamentStateForMatchStart syncs when same match already has kata', () => {
        const state = mkState(
            [
                {
                    id: 1,
                    name: '8강',
                    matches: [
                        mkMatch('m2', {
                            isFinished: false,
                            players: [{ id: 'u1', nickname: 'u1' } as any, { id: 'b1', nickname: 'b1' } as any],
                            championshipRealGame: { moves: [{ x: 0, y: 0, player: 1 }], currentPly: 0 } as any,
                        }),
                    ],
                },
            ],
            { roundIndex: 0, matchIndex: 0 },
        );
        state.status = 'round_in_progress';
        const { tournament, shouldSyncOnly } = prepareTournamentStateForMatchStart(state, 'u1', 'm2');
        expect(shouldSyncOnly).toBe(true);
        expect(tournament.status).toBe('round_in_progress');
    });

    it('prepareTournamentStateForMatchStart unlocks stale round_in_progress for next match', () => {
        const state = mkState(
            [
                {
                    id: 1,
                    name: '8강',
                    matches: [
                        mkMatch('m1', {
                            isFinished: true,
                            winner: { id: 'u1' } as any,
                            championshipRealGame: { moves: [{ x: 0, y: 0, player: 1 }], currentPly: 1 } as any,
                        }),
                        mkMatch('m2', { isFinished: false }),
                    ],
                },
            ],
            { roundIndex: 0, matchIndex: 0 },
        );
        state.status = 'round_in_progress';
        const { tournament, shouldSyncOnly } = prepareTournamentStateForMatchStart(state, 'u1', 'm2');
        expect(shouldSyncOnly).toBe(false);
        expect(tournament.status).toBe('bracket_ready');
        expect(tournament.currentSimulatingMatch).toBeNull();
    });

    it('isDungeonAutoNextResultReviewActive is true during client countdown', () => {
        const now = 1_000_000;
        expect(
            isDungeonAutoNextResultReviewActive({
                finishedUserMatchCount: 1,
                hasLastFinishedUserMatch: true,
                autoNextCountdown: 5,
                nextRoundStartTime: now + 10_000,
                tournamentStatus: 'bracket_ready',
                now,
            }),
        ).toBe(true);
    });

    it('isDungeonAutoNextResultReviewActive is false after server countdown expires', () => {
        const now = 1_000_000;
        expect(
            isDungeonAutoNextResultReviewActive({
                finishedUserMatchCount: 1,
                hasLastFinishedUserMatch: true,
                autoNextCountdown: null,
                nextRoundStartTime: now - 1,
                tournamentStatus: 'round_in_progress',
                now,
            }),
        ).toBe(false);
    });

    it('isDungeonAutoNextResultReviewActive stays true during prefetch while client countdown runs', () => {
        const now = 1_000_000;
        expect(
            isDungeonAutoNextResultReviewActive({
                finishedUserMatchCount: 1,
                hasLastFinishedUserMatch: true,
                autoNextCountdown: 3,
                nextRoundStartTime: now - 1,
                tournamentStatus: 'round_in_progress',
                now,
            }),
        ).toBe(true);
    });

    it('isDungeonAutoNextResultReviewActive is false when eliminated', () => {
        expect(
            isDungeonAutoNextResultReviewActive({
                finishedUserMatchCount: 1,
                hasLastFinishedUserMatch: true,
                autoNextCountdown: 5,
                nextRoundStartTime: Date.now() + 10_000,
                tournamentStatus: 'eliminated',
            }),
        ).toBe(false);
    });

    it('mergeTerminalTournamentPreserveScoringBoard keeps local board during complete', () => {
        const boardState = [
            [Player.Black, Player.None],
            [Player.None, Player.White],
        ];
        const moves = [
            { x: 0, y: 0, player: Player.Black },
            { x: 1, y: 1, player: Player.White },
        ];
        const prev = mkState(
            [
                {
                    id: 1,
                    name: '결승',
                    matches: [
                        mkMatch('final', {
                            championshipRealGame: {
                                moves,
                                boardState,
                                boardSize: 2,
                                currentPly: 2,
                                status: 'scoring',
                                winnerId: 'u1',
                                blackPlayerId: 'u1',
                                whitePlayerId: 'b1',
                                maxPly: 2,
                                timeMetrics: { scoringStartedAt: Date.now() },
                            } as any,
                        }),
                    ],
                },
            ],
            { roundIndex: 0, matchIndex: 0 },
        );
        const terminal = {
            ...prev,
            status: 'complete' as const,
            currentSimulatingMatch: null,
            rounds: [
                {
                    id: 1,
                    name: '결승',
                    matches: [
                        mkMatch('final', {
                            isFinished: true,
                            winner: { id: 'u1' } as any,
                            championshipRealGame: {
                                moves: [],
                                boardSize: 2,
                                currentPly: 0,
                                status: 'finished',
                                winnerId: 'u1',
                            } as any,
                        }),
                    ],
                },
            ],
        };
        const merged = mergeTerminalTournamentPreserveScoringBoard(prev, terminal);
        const game = merged[0]!.matches[0]!.championshipRealGame!;
        expect(game.status).toBe('scoring');
        expect(game.moves).toHaveLength(2);
        expect(game.boardState).toEqual(boardState);
        expect(game.currentPly).toBe(2);
    });

    it('mergeTerminalTournamentPreserveFinishedBoard restores local stones when server board missing', () => {
        const boardState = [
            [Player.Black, Player.None],
            [Player.None, Player.White],
        ];
        const moves = [
            { x: 0, y: 0, player: Player.Black },
            { x: 1, y: 1, player: Player.White },
        ];
        const prev = mkState(
            [
                {
                    id: 1,
                    name: '결승',
                    matches: [
                        mkMatch('final', {
                            isFinished: true,
                            championshipRealGame: {
                                moves,
                                boardState,
                                boardSize: 2,
                                currentPly: 2,
                                status: 'scoring',
                                winnerId: 'u1',
                            } as any,
                        }),
                    ],
                },
            ],
            null,
        );
        const terminal = {
            ...prev,
            status: 'complete' as const,
            rounds: [
                {
                    id: 1,
                    name: '결승',
                    matches: [
                        mkMatch('final', {
                            isFinished: true,
                            championshipRealGame: {
                                moves: [],
                                boardSize: 2,
                                currentPly: 2,
                                status: 'finished',
                                winnerId: 'u1',
                            } as any,
                        }),
                    ],
                },
            ],
        };
        const merged = mergeTerminalTournamentPreserveFinishedBoard(prev, terminal);
        const game = merged[0]!.matches[0]!.championshipRealGame!;
        expect(game.status).toBe('finished');
        expect(game.moves).toHaveLength(2);
        expect(game.boardState).toEqual(boardState);
    });

    it('isChampionshipEliminationRemainingMatchesPath only for national/world eliminated', () => {
        expect(isChampionshipEliminationRemainingMatchesPath({ type: 'national', status: 'eliminated' })).toBe(true);
        expect(isChampionshipEliminationRemainingMatchesPath({ type: 'world', status: 'eliminated' })).toBe(true);
        expect(isChampionshipEliminationRemainingMatchesPath({ type: 'neighborhood', status: 'eliminated' })).toBe(false);
        expect(isChampionshipEliminationRemainingMatchesPath({ type: 'national', status: 'complete' })).toBe(false);
    });

    it('buildEliminationRemainingMatchesHoldState keeps round_in_progress with finished board', () => {
        const moves = [{ x: 0, y: 0, player: Player.Black }];
        const prev = mkState(
            [
                {
                    id: 1,
                    name: '8강',
                    matches: [
                        mkMatch('m1', {
                            championshipRealGame: {
                                moves,
                                boardState: [[Player.Black]],
                                boardSize: 1,
                                currentPly: 1,
                                status: 'scoring',
                                winnerId: 'bot',
                            } as any,
                        }),
                    ],
                },
            ],
            { roundIndex: 0, matchIndex: 0 },
        );
        const terminal = {
            ...prev,
            status: 'eliminated' as const,
            currentSimulatingMatch: null,
            rounds: [
                {
                    id: 1,
                    name: '8강',
                    matches: [
                        mkMatch('m1', {
                            isFinished: true,
                            winner: { id: 'bot' } as any,
                            championshipRealGame: {
                                moves,
                                boardState: [[Player.Black]],
                                boardSize: 1,
                                currentPly: 1,
                                status: 'finished',
                                winnerId: 'bot',
                            } as any,
                        }),
                    ],
                },
            ],
        };
        const held = buildEliminationRemainingMatchesHoldState(prev, terminal);
        expect(held.status).toBe('round_in_progress');
        expect(held.currentSimulatingMatch).toEqual({ roundIndex: 0, matchIndex: 0 });
        expect(held.rounds[0]!.matches[0]!.championshipRealGame?.status).toBe('finished');
    });
});
