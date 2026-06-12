import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import {
    enterChessPiecePlacement,
    resolveChessPlacementAndTransition,
} from '../../../server/modes/chessPlacementFlow.js';
import { aiUserId } from '../../../server/aiPlayer.js';

function makeUser(id: string) {
    return { id, username: id, nickname: id } as LiveGameSession['player1'];
}

function makeChessSession(overrides: Partial<LiveGameSession> = {}): LiveGameSession {
    const human = makeUser('human-1');
    const ai = makeUser(aiUserId);
    return {
        id: 'game-1',
        mode: GameMode.Chess,
        isAiGame: true,
        gameStatus: 'chess_piece_placement',
        player1: human,
        player2: ai,
        blackPlayerId: human.id,
        whitePlayerId: ai.id,
        settings: { boardSize: 13, chessPieceTotalScore: 15, komi: 6.5 },
        boardState: [],
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        currentPlayer: Player.None,
        ...overrides,
    } as LiveGameSession;
}

describe('chessPlacementFlow', () => {
    it('PVE: human confirm starts playing immediately', () => {
        const game = makeChessSession();
        const now = Date.now();
        enterChessPiecePlacement(game, now);
        expect(game.gameStatus).toBe('chess_piece_placement');
        expect(game.chessPiecePlacementReady?.[aiUserId]).toBe(true);

        game.chessPiecePlacementReady!['human-1'] = true;
        const started = resolveChessPlacementAndTransition(game, now);
        expect(started).toBe(true);
        expect(game.gameStatus).toBe('playing');
        expect(game.chessPieces?.some((p) => p.type === 'king')).toBe(true);
    });

    it('PVP: both confirm starts before deadline', () => {
        const p1 = makeUser('p1');
        const p2 = makeUser('p2');
        const game = makeChessSession({
            isAiGame: false,
            player1: p1,
            player2: p2,
            blackPlayerId: p1.id,
            whitePlayerId: p2.id,
        });
        const now = Date.now();
        enterChessPiecePlacement(game, now);

        game.chessPiecePlacementReady![p1.id] = true;
        expect(resolveChessPlacementAndTransition(game, now)).toBe(false);

        game.chessPiecePlacementReady![p2.id] = true;
        expect(resolveChessPlacementAndTransition(game, now)).toBe(true);
        expect(game.gameStatus).toBe('playing');
    });

    it('PVP: deadline auto-fills remaining budget for not-ready side', () => {
        const p1 = makeUser('p1');
        const p2 = makeUser('p2');
        const game = makeChessSession({
            isAiGame: false,
            player1: p1,
            player2: p2,
            blackPlayerId: p1.id,
            whitePlayerId: p2.id,
        });
        const now = 1_000_000;
        enterChessPiecePlacement(game, now);
        game.chessPiecePlacementReady![p1.id] = true;
        game.chessPiecePlacementDraft![p1.id] = [{ type: 'pawn', x: 3, y: 2 }];
        game.chessPiecePlacementDeadline = now - 1;

        const started = resolveChessPlacementAndTransition(game, now);
        expect(started).toBe(true);
        expect(game.gameStatus).toBe('playing');
        expect(game.chessPieces?.some((p) => p.owner === Player.White && p.type !== 'king')).toBe(true);
    });
});
