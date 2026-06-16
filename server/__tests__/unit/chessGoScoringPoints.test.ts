import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/entities.js';
import {
    generateChessGoInitialPieces,
    getChessGoStoneCapturePointValue,
    getChessPieceCaptureValue,
    prepareChessGoSessionForScoring,
} from '../../../shared/utils/chessGoRules.js';
import { getStoneCapturePointValueForScoring } from '../../../shared/utils/scoringStonePoints.js';
import { finalizeAnalysisResult } from '../../gameModes.js';

function makeChessScoringSession(): LiveGameSession {
    const chessPieces = generateChessGoInitialPieces(13);
    return {
        id: 'chess-scoring-1',
        mode: GameMode.Chess,
        gameStatus: 'scoring',
        settings: { boardSize: 13, komi: 6.5 },
        boardState: Array.from({ length: 13 }, () => Array(13).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        chessPieces,
    } as LiveGameSession;
}

describe('chess go scoring dead stone points', () => {
    it('scores dead chess piece stones by piece value at scoring time', () => {
        const session = makeChessScoringSession();
        const whiteQueen = session.chessPieces!.find((p) => p.owner === Player.White && p.type === 'queen')!;
        const whitePawn = session.chessPieces!.find((p) => p.owner === Player.White && p.type === 'pawn')!;
        session.boardState[whiteQueen.y]![whiteQueen.x] = Player.White;
        session.boardState[whitePawn.y]![whitePawn.x] = Player.White;

        expect(getStoneCapturePointValueForScoring(session, whiteQueen, Player.White)).toBe(
            getChessPieceCaptureValue('queen'),
        );
        expect(getStoneCapturePointValueForScoring(session, whitePawn, Player.White)).toBe(
            getChessPieceCaptureValue('pawn'),
        );
        expect(getChessGoStoneCapturePointValue(session, whiteQueen, Player.White)).toBe(9);
        expect(getChessGoStoneCapturePointValue(session, whitePawn, Player.White)).toBe(1);
    });

    it('finalizeAnalysisResult applies weighted dead stone scores for chess piece prisoners', () => {
        const session = makeChessScoringSession();
        const queen = session.chessPieces!.find((p) => p.owner === Player.White && p.type === 'queen')!;
        session.boardState[queen.y]![queen.x] = Player.White;

        const baseAnalysis = {
            winRateBlack: 50,
            winRateChange: 0,
            scoreLead: 0,
            deadStones: [{ x: queen.x, y: queen.y }],
            ownershipMap: null,
            recommendedMoves: [],
            areaScore: { black: 0, white: 0 },
            scoreDetails: {
                black: {
                    territory: 0,
                    captures: 0,
                    liveCaptures: 0,
                    deadStones: 0,
                    baseStoneBonus: 0,
                    hiddenStoneBonus: 0,
                    timeBonus: 0,
                    itemBonus: 0,
                    total: 0,
                },
                white: {
                    territory: 0,
                    captures: 0,
                    liveCaptures: 0,
                    komi: 6.5,
                    deadStones: 0,
                    baseStoneBonus: 0,
                    hiddenStoneBonus: 0,
                    timeBonus: 0,
                    itemBonus: 0,
                    total: 6.5,
                },
            },
            blackConfirmed: [],
            whiteConfirmed: [],
            blackRight: [],
            whiteRight: [],
            blackLikely: [],
            whiteLikely: [],
        };

        const final = finalizeAnalysisResult(baseAnalysis, session);
        expect(final.scoreDetails.black.deadStones).toBe(getChessPieceCaptureValue('queen'));
        expect(final.scoreDetails.black.territory).toBe(1);
        expect(final.scoreDetails.black.total).toBe(getChessPieceCaptureValue('queen') + 1);
    });

    it('prepareChessGoSessionForScoring restores chessPieces from preservedGameState', () => {
        const session = makeChessScoringSession();
        const queen = session.chessPieces!.find((p) => p.owner === Player.White && p.type === 'queen')!;
        session.chessPieces = [];
        (session as { preservedGameState?: Record<string, unknown> }).preservedGameState = {
            chessPieces: [queen],
        };
        session.boardState[queen.y]![queen.x] = Player.White;

        prepareChessGoSessionForScoring(session);
        expect(getStoneCapturePointValueForScoring(session, queen, Player.White)).toBe(9);
    });
});
