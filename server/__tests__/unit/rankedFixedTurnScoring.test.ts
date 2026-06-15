import { describe, it, expect } from 'vitest';
import { GameMode } from '../../../types/index.js';
import { Player } from '../../../shared/types/enums.js';
import {
    getRankedFixedTurnCount,
    hasPlayerStoneGroupInAtari,
    isRankedFixedTurnScoringSession,
    pvpHasFixedScoringTurnLimit,
    shouldTriggerRankedFixedTurnScoring,
} from '../../../shared/utils/rankedFixedTurnScoring.js';

describe('rankedFixedTurnScoring', () => {
    it('pvpHasFixedScoringTurnLimit mirrors arena pass policy', () => {
        expect(
            pvpHasFixedScoringTurnLimit({
                isRankedGame: true,
                isAiGame: false,
                isSinglePlayer: false,
                mode: GameMode.Standard,
                settings: { scoringTurnLimit: 80 },
                gameCategory: 'normal' as any,
            }),
        ).toBe(true);
        expect(
            pvpHasFixedScoringTurnLimit({
                isRankedGame: false,
                isAiGame: false,
                isSinglePlayer: false,
                mode: GameMode.Standard,
                settings: { scoringTurnLimit: 0 },
                gameCategory: 'normal' as any,
            }),
        ).toBe(false);
        expect(
            pvpHasFixedScoringTurnLimit({
                isRankedGame: false,
                isAiGame: false,
                isSinglePlayer: false,
                mode: GameMode.Standard,
                settings: {
                    scoringTurnLimit: 120,
                    pairGame: { pairMode: 'pvp', turnOrder: [] },
                },
                gameCategory: 'normal' as any,
            }),
        ).toBe(true);
        expect(
            pvpHasFixedScoringTurnLimit({
                isRankedGame: false,
                isAiGame: false,
                isSinglePlayer: false,
                mode: GameMode.Standard,
                settings: {
                    scoringTurnLimit: 0,
                    pairGame: { pairMode: 'pvp', turnOrder: [] },
                },
                gameCategory: 'normal' as any,
            }),
        ).toBe(false);
    });

    it('detects ranked fixed-turn sessions excluding capture', () => {
        expect(
            isRankedFixedTurnScoringSession({
                isRankedGame: true,
                isAiGame: false,
                mode: GameMode.Uniform,
                settings: { scoringTurnLimit: 80 },
            }),
        ).toBe(true);
        expect(
            isRankedFixedTurnScoringSession({
                isRankedGame: true,
                isAiGame: false,
                mode: GameMode.Capture,
                settings: { scoringTurnLimit: 80, captureTarget: 20 },
            }),
        ).toBe(false);
    });

    it('triggers when limit reached on black turn without atari', () => {
        const session = {
            isRankedGame: true,
            isAiGame: false,
            mode: GameMode.Standard,
            settings: { scoringTurnLimit: 4, boardSize: 9, pairGame: undefined },
            moveHistory: [
                { player: Player.Black, x: 0, y: 0 },
                { player: Player.White, x: 2, y: 0 },
                { player: Player.Black, x: 0, y: 2 },
                { player: Player.White, x: 2, y: 2 },
            ],
            currentPlayer: Player.Black,
            boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        } as any;
        session.boardState[0][0] = Player.Black;
        session.boardState[0][2] = Player.White;
        session.boardState[2][0] = Player.Black;
        session.boardState[2][2] = Player.White;
        expect(getRankedFixedTurnCount(session)).toBe(4);
        expect(hasPlayerStoneGroupInAtari(session.boardState, Player.Black)).toBe(false);
        expect(shouldTriggerRankedFixedTurnScoring(session)).toBe(true);
    });

    it('detects black stones in atari', () => {
        const board = Array.from({ length: 5 }, () => Array(5).fill(Player.None));
        board[2][2] = Player.Black;
        board[1][2] = Player.White;
        board[2][1] = Player.White;
        board[2][3] = Player.White;
        expect(hasPlayerStoneGroupInAtari(board, Player.Black)).toBe(true);
    });

    it('defers at limit while black is in atari', () => {
        const board = Array.from({ length: 5 }, () => Array(5).fill(Player.None));
        board[2][2] = Player.Black;
        board[1][2] = Player.White;
        board[2][1] = Player.White;
        board[2][3] = Player.White;
        const atLimit = {
            isRankedGame: true,
            isAiGame: false,
            mode: GameMode.Uniform,
            settings: { scoringTurnLimit: 2, boardSize: 5 },
            moveHistory: [
                { player: Player.Black, x: 0, y: 0 },
                { player: Player.White, x: 3, y: 2 },
            ],
            currentPlayer: Player.Black,
            boardState: board,
        } as any;
        expect(shouldTriggerRankedFixedTurnScoring(atLimit)).toBe(false);
    });

    it('triggers once turn count exceeds limit after black response', () => {
        const session = {
            isRankedGame: true,
            isAiGame: false,
            mode: GameMode.Standard,
            settings: { scoringTurnLimit: 4, boardSize: 9 },
            moveHistory: [
                { player: Player.Black, x: 0, y: 0 },
                { player: Player.White, x: 1, y: 0 },
                { player: Player.Black, x: 0, y: 1 },
                { player: Player.White, x: 1, y: 1 },
                { player: Player.Black, x: 2, y: 0 },
            ],
            currentPlayer: Player.White,
            boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        } as any;
        expect(getRankedFixedTurnCount(session)).toBe(5);
        expect(shouldTriggerRankedFixedTurnScoring(session)).toBe(true);
    });
});
