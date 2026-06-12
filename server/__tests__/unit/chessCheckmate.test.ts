import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { buildFixedKingPiece, draftToChessPieceStates } from '../../../shared/utils/chessGoPlacement.js';
import { applyChessCaptureScoreForRemovedStones } from '../../../shared/utils/chessGoRules.js';

vi.mock('../../summaryService.js', () => ({
    endGame: vi.fn().mockResolvedValue(undefined),
}));

import { tryEndChessOnKingCapture } from '../../modes/chess.js';
import * as summaryService from '../../summaryService.js';

function makeChessGame(): LiveGameSession {
    const blackKing = buildFixedKingPiece(Player.Black, 13);
    const whiteKing = buildFixedKingPiece(Player.White, 13);
    const blackDraft = [{ type: 'pawn' as const, x: 3, y: 10 }];
    const whiteDraft = [{ type: 'pawn' as const, x: 3, y: 2 }];
    return {
        id: 'chess-1',
        mode: GameMode.Chess,
        gameStatus: 'playing',
        player1: { id: 'p1', username: 'p1', nickname: 'p1' } as LiveGameSession['player1'],
        player2: { id: 'p2', username: 'p2', nickname: 'p2' } as LiveGameSession['player2'],
        blackPlayerId: 'p1',
        whitePlayerId: 'p2',
        settings: { boardSize: 13, komi: 6.5 },
        boardState: Array.from({ length: 13 }, () => Array(13).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        chessPieces: [
            blackKing,
            whiteKing,
            ...draftToChessPieceStates(blackDraft, Player.Black, 13),
            ...draftToChessPieceStates(whiteDraft, Player.White, 13),
        ],
    } as LiveGameSession;
}

describe('tryEndChessOnKingCapture', () => {
    beforeEach(() => {
        vi.mocked(summaryService.endGame).mockClear();
    });

    it('does not end while opponent king remains on the board', async () => {
        const game = makeChessGame();
        const ended = await tryEndChessOnKingCapture(game, Player.Black);
        expect(ended).toBe(false);
        expect(summaryService.endGame).not.toHaveBeenCalled();
    });

    it('ends with chess_checkmate when opponent king was captured', async () => {
        const game = makeChessGame();
        const whiteKing = game.chessPieces!.find((p) => p.owner === Player.White && p.type === 'king')!;
        applyChessCaptureScoreForRemovedStones(
            game,
            [{ x: whiteKing.x, y: whiteKing.y }],
            Player.Black,
        );

        const ended = await tryEndChessOnKingCapture(game, Player.Black);
        expect(ended).toBe(true);
        expect(summaryService.endGame).toHaveBeenCalledWith(game, Player.Black, 'chess_checkmate');
        expect(game.chessPieces?.some((p) => p.type === 'king' && p.owner === Player.Black)).toBe(true);
        expect(game.chessPieces?.some((p) => p.type === 'king' && p.owner === Player.White)).toBe(false);
    });
});
