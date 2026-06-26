import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../types/enums.js';
import type { LiveGameSession } from '../../../types/index.js';
import {
    enumerateLegalChessMoves,
    applyChessPiecesToBoard,
    generateChessGoInitialPieces,
    normalizeChessGoSession,
} from '../../../shared/utils/chessGoRules.js';
import {
    CHESS_AI_MEANINGFUL_MOVE_SCORE,
    pickAiChessMoveIfAny,
    pickBestChessMoveFromCandidates,
    scoreChessMoveCandidate,
    shouldAttemptChessMoveThisTurn,
} from '../../../shared/utils/chessGoAiHeuristic.js';

function createChessSession(): LiveGameSession {
    const pieces = generateChessGoInitialPieces(13);
    const boardState = Array.from({ length: 13 }, () => Array(13).fill(Player.None)) as LiveGameSession['boardState'];
    return {
        id: 'test-chess-ai',
        mode: GameMode.Chess,
        settings: { boardSize: 13, komi: 6.5, scoringTurnLimit: 100 },
        player1: { id: 'p1' } as LiveGameSession['player1'],
        player2: { id: 'p2' } as LiveGameSession['player2'],
        blackPlayerId: 'p1',
        whitePlayerId: 'p2',
        gameStatus: 'playing',
        currentPlayer: Player.Black,
        boardState: applyChessPiecesToBoard(boardState, pieces),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        chessPieces: pieces,
        chessCaptureScore: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        chessPieceMovedThisTurn: false,
        winner: null,
        winReason: null,
        createdAt: Date.now(),
        passCount: 0,
        koInfo: null,
        blackTimeLeft: 300,
        whiteTimeLeft: 300,
        blackByoyomiPeriodsLeft: 3,
        whiteByoyomiPeriodsLeft: 3,
    } as LiveGameSession;
}

describe('chessGoAiHeuristic', () => {
    it('skips move attempt when random is above threshold and no tactical move exists', () => {
        expect(shouldAttemptChessMoveThisTurn(1, 0.99)).toBe(false);
    });

    it('returns null when no legal moves', () => {
        const session = createChessSession();
        for (const p of session.chessPieces ?? []) {
            if (p.owner === Player.Black) p.remainingMoves = 0;
        }
        expect(pickAiChessMoveIfAny(session, Player.Black, 5, 0)).toBeNull();
    });

    it('prefers a capture over a passive move', () => {
        const board = Array.from({ length: 13 }, () => Array(13).fill(Player.None)) as LiveGameSession['boardState'];
        const blackRook = {
            id: 'b-rook',
            type: 'rook' as const,
            owner: Player.Black,
            x: 4,
            y: 6,
            remainingMoves: 10,
        };
        const blackPawn = {
            id: 'b-pawn',
            type: 'pawn' as const,
            owner: Player.Black,
            x: 8,
            y: 10,
            remainingMoves: 2,
        };
        const whitePawn = {
            id: 'w-pawn',
            type: 'pawn' as const,
            owner: Player.White,
            x: 4,
            y: 4,
            remainingMoves: 2,
        };

        board[6][4] = Player.Black;
        board[4][5] = Player.Black;
        board[4][3] = Player.Black;
        board[3][4] = Player.Black;
        board[4][4] = Player.White;
        board[10][8] = Player.Black;

        const session = {
            boardState: board,
            chessPieces: [blackRook, blackPawn, whitePawn],
            chessPieceMovedThisTurn: false,
        } as LiveGameSession;

        const captureMove = {
            pieceId: blackRook.id,
            from: { x: 4, y: 6 },
            to: { x: 4, y: 5 },
        };
        const passiveMove = {
            pieceId: blackPawn.id,
            from: { x: 8, y: 10 },
            to: { x: 8, y: 9 },
        };

        const captureScore = scoreChessMoveCandidate(session, captureMove, Player.Black);
        const passiveScore = scoreChessMoveCandidate(session, passiveMove, Player.Black);

        expect(captureScore).toBeGreaterThan(CHESS_AI_MEANINGFUL_MOVE_SCORE);
        expect(captureScore).toBeGreaterThan(passiveScore);

        const picked = pickBestChessMoveFromCandidates(
            session,
            [passiveMove, captureMove],
            Player.Black,
            3,
        );
        expect(picked?.pieceId).toBe(blackRook.id);
        expect(picked?.to).toEqual({ x: 4, y: 5 });
    });

    it('attempts meaningful capture even when random would skip', () => {
        const board = Array.from({ length: 13 }, () => Array(13).fill(Player.None)) as LiveGameSession['boardState'];
        const blackRook = {
            id: 'b-rook',
            type: 'rook' as const,
            owner: Player.Black,
            x: 4,
            y: 6,
            remainingMoves: 10,
        };
        const whitePawn = {
            id: 'w-pawn',
            type: 'pawn' as const,
            owner: Player.White,
            x: 4,
            y: 4,
            remainingMoves: 2,
        };

        board[6][4] = Player.Black;
        board[4][5] = Player.Black;
        board[4][3] = Player.Black;
        board[3][4] = Player.Black;
        board[4][4] = Player.White;

        const session = {
            boardState: board,
            chessPieces: [blackRook, whitePawn],
            chessPieceMovedThisTurn: false,
        } as LiveGameSession;

        const legal = enumerateLegalChessMoves(session, Player.Black);
        expect(legal.some((m) => m.pieceId === blackRook.id && m.to.x === 4 && m.to.y === 5)).toBe(true);

        const move = pickAiChessMoveIfAny(session, Player.Black, 1, 0.99);
        expect(move).not.toBeNull();
        expect(move?.pieceId).toBe(blackRook.id);
    });

    it('rescuing an atari piece scores higher than random shuffle', () => {
        const session = normalizeChessGoSession(createChessSession());
        const board = session.boardState.map((row) => [...row]) as LiveGameSession['boardState'];
        const pieces = session.chessPieces!.map((p) => ({ ...p }));

        const blackKnight = pieces.find((p) => p.owner === Player.Black && p.type === 'knight')!;
        blackKnight.x = 6;
        blackKnight.y = 6;

        board[6][6] = Player.Black;
        board[6][5] = Player.White;
        board[5][6] = Player.White;
        board[7][6] = Player.White;

        session.boardState = board;
        session.chessPieces = pieces;

        const escapeMove = {
            pieceId: blackKnight.id,
            from: { x: 6, y: 6 },
            to: { x: 5, y: 5 },
        };

        const blackPawn = pieces.find((p) => p.owner === Player.Black && p.type === 'pawn' && p.y === 10)!;
        const shuffleMove = {
            pieceId: blackPawn.id,
            from: { x: blackPawn.x, y: blackPawn.y },
            to: { x: blackPawn.x, y: blackPawn.y - 1 },
        };

        expect(scoreChessMoveCandidate(session, escapeMove, Player.Black)).toBeGreaterThan(
            scoreChessMoveCandidate(session, shuffleMove, Player.Black),
        );
    });
});
