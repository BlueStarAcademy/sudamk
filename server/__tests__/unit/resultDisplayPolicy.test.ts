import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../shared/types/enums.js';
import type { GameSettings, LiveGameSession } from '../../../shared/types/index.js';
import {
    isScoringResultContentReady,
    shouldOpenResultModalAfterScoringOverlay,
    shouldOpenResultModalByPolicy,
    shouldWaitForScoreBasedScoringOverlay,
} from '../../../utils/resultDisplayPolicy.js';

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

describe('isScoringResultContentReady', () => {
    const scoreAnalysis = {
        scoreDetails: {
            black: { total: 85.5 },
            white: { total: 78.5 },
        },
    };

    it('is false while still scoring or before analysis', () => {
        expect(
            isScoringResultContentReady({
                gameStatus: 'scoring',
                winReason: 'score',
                analysisResult: scoreAnalysis,
                resultModalWaitSummary: false,
                hasMyGameSummary: false,
            }),
        ).toBe(false);
        expect(
            isScoringResultContentReady({
                gameStatus: 'ended',
                winReason: 'score',
                analysisResult: null,
                resultModalWaitSummary: false,
                hasMyGameSummary: false,
            }),
        ).toBe(false);
    });

    it('is true on ended score win with analysis result', () => {
        expect(
            isScoringResultContentReady({
                gameStatus: 'ended',
                winReason: 'score',
                analysisResult: scoreAnalysis,
                resultModalWaitSummary: false,
                hasMyGameSummary: false,
            }),
        ).toBe(true);
    });

    it('is false on ended score win without analysis', () => {
        expect(
            isScoringResultContentReady({
                gameStatus: 'ended',
                winReason: 'score',
                analysisResult: null,
                resultModalWaitSummary: false,
                hasMyGameSummary: false,
            }),
        ).toBe(false);
    });

    it('waits for summary when PVP participant needs reward row', () => {
        expect(
            isScoringResultContentReady({
                gameStatus: 'ended',
                winReason: 'score',
                analysisResult: scoreAnalysis,
                resultModalWaitSummary: true,
                hasMyGameSummary: false,
            }),
        ).toBe(false);
        expect(
            isScoringResultContentReady({
                gameStatus: 'ended',
                winReason: 'score',
                analysisResult: scoreAnalysis,
                resultModalWaitSummary: true,
                hasMyGameSummary: true,
            }),
        ).toBe(true);
    });
});

describe('shouldOpenResultModalByPolicy', () => {
    it('defers instantEnd score PVP until analysisResult is ready', () => {
        const s = session({ gameStatus: 'ended', winReason: 'score' });
        expect(
            shouldOpenResultModalByPolicy({
                session: s,
                showResultModal: false,
                gameHasJustEnded: true,
                prevGameStatus: 'playing',
                hasAnalysisResult: false,
                resultModalWaitSummary: true,
                hasMyGameSummary: true,
                gameSummaryJustArrived: false,
            }),
        ).toBe(false);
    });

    it('defers instantEnd score PVP until summary row exists', () => {
        const s = session({ gameStatus: 'ended', winReason: 'score' });
        expect(
            shouldOpenResultModalByPolicy({
                session: s,
                showResultModal: false,
                gameHasJustEnded: true,
                prevGameStatus: 'playing',
                hasAnalysisResult: true,
                resultModalWaitSummary: true,
                hasMyGameSummary: false,
                gameSummaryJustArrived: false,
            }),
        ).toBe(false);
    });

    it('opens instantEnd score PVP when ended, analysis, and summary are ready', () => {
        const s = session({ gameStatus: 'ended', winReason: 'score' });
        expect(
            shouldOpenResultModalByPolicy({
                session: s,
                showResultModal: false,
                gameHasJustEnded: true,
                prevGameStatus: 'playing',
                hasAnalysisResult: true,
                resultModalWaitSummary: true,
                hasMyGameSummary: true,
                gameSummaryJustArrived: false,
            }),
        ).toBe(true);
    });

    it('opens instantEnd when analysis arrives with scoring→ended transition and summary ready', () => {
        const s = session({ gameStatus: 'ended' });
        expect(
            shouldOpenResultModalByPolicy({
                session: s,
                showResultModal: false,
                gameHasJustEnded: false,
                prevGameStatus: 'scoring',
                hasAnalysisResult: true,
                resultModalWaitSummary: true,
                hasMyGameSummary: true,
                gameSummaryJustArrived: false,
            }),
        ).toBe(true);
    });

    it('defers instantEnd scoring→ended until summary row exists', () => {
        const s = session({ gameStatus: 'ended' });
        expect(
            shouldOpenResultModalByPolicy({
                session: s,
                showResultModal: false,
                gameHasJustEnded: false,
                prevGameStatus: 'scoring',
                hasAnalysisResult: true,
                resultModalWaitSummary: true,
                hasMyGameSummary: false,
                gameSummaryJustArrived: false,
            }),
        ).toBe(false);
    });

    it('opens instantEnd playful result immediately on end without waiting for summary', () => {
        const s = session({
            gameStatus: 'ended',
            mode: GameMode.Thief,
            winReason: 'total_score',
            isAiGame: true,
            gameCategory: GameCategory.Normal,
        });
        expect(
            shouldOpenResultModalByPolicy({
                session: s,
                showResultModal: false,
                gameHasJustEnded: true,
                prevGameStatus: 'thief_placing',
                hasAnalysisResult: false,
                resultModalWaitSummary: false,
                hasMyGameSummary: false,
                gameSummaryJustArrived: false,
            }),
        ).toBe(true);
    });

    it('opens instantEnd when summary row just arrived', () => {
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
                resultModalWaitSummary: true,
                hasMyGameSummary: true,
                gameSummaryJustArrived: true,
            }),
        ).toBe(true);
    });

    it('waits for score-based overlay during scoring (PVP included)', () => {
        expect(
            shouldWaitForScoreBasedScoringOverlay({
                isScoreBasedPresentation: true,
                scoringOverlayCompleted: false,
                winReason: 'score',
            }),
        ).toBe(true);
    });

    it('does not wait for overlay on immediate resign end', () => {
        expect(
            shouldWaitForScoreBasedScoringOverlay({
                isScoreBasedPresentation: true,
                scoringOverlayCompleted: false,
                winReason: 'resign',
            }),
        ).toBe(false);
    });

    it('does not open result after overlay on ended without analysis', () => {
        expect(
            shouldOpenResultModalAfterScoringOverlay({
                isScoreBasedPresentation: true,
                scoringOverlayCompleted: true,
                gameStatus: 'ended',
                postGameSummaryAcknowledged: false,
            }),
        ).toBe(false);
    });

    it('opens result after overlay completes on ended when analysis and summary are ready', () => {
        expect(
            shouldOpenResultModalAfterScoringOverlay({
                isScoreBasedPresentation: true,
                scoringOverlayCompleted: true,
                gameStatus: 'ended',
                postGameSummaryAcknowledged: false,
                hasAnalysisResult: true,
                resultModalWaitSummary: true,
                hasMyGameSummary: true,
            }),
        ).toBe(true);
    });

    it('does not open result after overlay during scoring even with analysis', () => {
        expect(
            shouldOpenResultModalAfterScoringOverlay({
                isScoreBasedPresentation: true,
                scoringOverlayCompleted: true,
                gameStatus: 'scoring',
                postGameSummaryAcknowledged: false,
                hasAnalysisResult: true,
            }),
        ).toBe(false);
    });

    it('does not open result after overlay when summary is still missing', () => {
        expect(
            shouldOpenResultModalAfterScoringOverlay({
                isScoreBasedPresentation: true,
                scoringOverlayCompleted: true,
                gameStatus: 'ended',
                postGameSummaryAcknowledged: false,
                hasAnalysisResult: true,
                resultModalWaitSummary: true,
                hasMyGameSummary: false,
            }),
        ).toBe(false);
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
                resultModalWaitSummary: false,
                hasMyGameSummary: false,
                gameSummaryJustArrived: false,
            }),
        ).toBe(true);
    });
});
