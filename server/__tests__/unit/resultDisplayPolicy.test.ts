import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../shared/types/enums.js';
import type { GameSettings, LiveGameSession } from '../../../shared/types/index.js';
import { shouldOpenResultModalByPolicy } from '../../../utils/resultDisplayPolicy.js';

const settings = (patch: Partial<GameSettings> = {}): GameSettings =>
    ({
        boardSize: 19,
        komi: 6.5,
        timeLimit: 10,
        byoyomiTime: 0,
        byoyomiCount: 0,
        ...patch,
    }) as GameSettings;

const session = (patch: Partial<LiveGameSession> = {}): LiveGameSession =>
    ({
        id: 'result-display-test',
        mode: GameMode.Standard,
        gameCategory: GameCategory.Normal,
        isSinglePlayer: false,
        isAiGame: false,
        settings: settings(),
        moveHistory: [],
        currentPlayer: Player.Black,
        ...patch,
    }) as LiveGameSession;

describe('shouldOpenResultModalByPolicy', () => {
    it('opens instantEnd (normal PVP) on transition to ended even when showResultModal is false', () => {
        const s = session({ gameStatus: 'ended', winReason: 'score' });
        expect(
            shouldOpenResultModalByPolicy({
                session: s,
                showResultModal: false,
                gameHasJustEnded: true,
                prevGameStatus: 'playing',
                hasAnalysisResult: false,
                playfulResultModalWaitSummary: false,
                hasMyGameSummary: false,
                playfulGameSummaryJustArrived: false,
            }),
        ).toBe(true);
    });

    it('opens instantEnd when analysis arrives with scoring→ended transition', () => {
        const s = session({ gameStatus: 'ended' });
        expect(
            shouldOpenResultModalByPolicy({
                session: s,
                showResultModal: false,
                gameHasJustEnded: false,
                prevGameStatus: 'scoring',
                hasAnalysisResult: true,
                playfulResultModalWaitSummary: false,
                hasMyGameSummary: false,
                playfulGameSummaryJustArrived: false,
            }),
        ).toBe(true);
    });

    it('defers instantEnd playful result until my summary row exists', () => {
        const s = session({
            gameStatus: 'ended',
            mode: GameMode.Dice,
            isAiGame: true,
            gameCategory: GameCategory.Normal,
        });
        expect(
            shouldOpenResultModalByPolicy({
                session: s,
                showResultModal: false,
                gameHasJustEnded: true,
                prevGameStatus: 'playing',
                hasAnalysisResult: false,
                playfulResultModalWaitSummary: true,
                hasMyGameSummary: false,
                playfulGameSummaryJustArrived: false,
            }),
        ).toBe(false);
    });

    it('opens instantEnd playful when summary row just arrived', () => {
        const s = session({
            gameStatus: 'ended',
            mode: GameMode.Dice,
            isAiGame: true,
            gameCategory: GameCategory.Normal,
        });
        expect(
            shouldOpenResultModalByPolicy({
                session: s,
                showResultModal: false,
                gameHasJustEnded: false,
                prevGameStatus: 'ended',
                hasAnalysisResult: false,
                playfulResultModalWaitSummary: true,
                hasMyGameSummary: true,
                playfulGameSummaryJustArrived: true,
            }),
        ).toBe(true);
    });

    it('opens singleplayer (waitScoringOverlay) on gameHasJustEnded', () => {
        const s = session({
            gameCategory: GameCategory.SinglePlayer,
            isSinglePlayer: true,
            gameStatus: 'ended',
        });
        expect(
            shouldOpenResultModalByPolicy({
                session: s,
                showResultModal: false,
                gameHasJustEnded: true,
                prevGameStatus: 'scoring',
                hasAnalysisResult: false,
                playfulResultModalWaitSummary: false,
                hasMyGameSummary: false,
                playfulGameSummaryJustArrived: false,
            }),
        ).toBe(true);
    });
});
