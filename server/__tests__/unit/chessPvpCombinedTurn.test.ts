import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession, User } from '../../../shared/types/index.js';
import {
    applyChessMoveInternal,
} from '../../../server/modes/chess.js';
import {
    generateChessGoInitialPieces,
    normalizeChessGoSession,
    processChessGoMove,
} from '../../../shared/utils/chessGoRules.js';

function makeUser(id: string): User {
    return { id, username: id, nickname: id } as User;
}

function makePvpPlayingChessSession(): LiveGameSession {
    const p1 = makeUser('p1');
    const p2 = makeUser('p2');
    const pieces = generateChessGoInitialPieces(13);
    const session = {
        id: 'game-pvp-chess-turn',
        mode: GameMode.Chess,
        isAiGame: false,
        gameStatus: 'playing',
        player1: p1,
        player2: p2,
        blackPlayerId: p1.id,
        whitePlayerId: p2.id,
        settings: { boardSize: 13, chessPieceTotalScore: 15, komi: 6.5 },
        boardState: [],
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        currentPlayer: Player.Black,
        chessPieces: pieces,
        chessPieceMovedThisTurn: false,
    } as LiveGameSession;
    return normalizeChessGoSession(session);
}

describe('PVP chess go combined turn (piece move + stone)', () => {
    it('CHESS_MOVE keeps currentPlayer and sets chessPieceMovedThisTurn', () => {
        const game = makePvpPlayingChessSession();
        const pawn = game.chessPieces!.find(
            (p) => p.owner === Player.Black && p.type === 'pawn' && p.x === 5,
        )!;
        const beforePlayer = game.currentPlayer;

        const result = applyChessMoveInternal(game, Player.Black, {
            pieceId: pawn.id,
            toX: 5,
            toY: 9,
        });

        expect(result.error).toBeUndefined();
        expect(game.chessPieceMovedThisTurn).toBe(true);
        expect(game.currentPlayer).toBe(beforePlayer);
        expect(game.chessPieces!.find((p) => p.id === pawn.id)!.y).toBe(9);
    });

    it('second piece move in same turn is rejected', () => {
        const game = makePvpPlayingChessSession();
        const pawn = game.chessPieces!.find(
            (p) => p.owner === Player.Black && p.type === 'pawn' && p.x === 5,
        )!;
        applyChessMoveInternal(game, Player.Black, {
            pieceId: pawn.id,
            toX: 5,
            toY: 9,
        });
        const other = game.chessPieces!.find(
            (p) => p.owner === Player.Black && p.type === 'pawn' && p.x === 6,
        )!;
        const second = applyChessMoveInternal(game, Player.Black, {
            pieceId: other.id,
            toX: 6,
            toY: 9,
        });
        expect(second.error).toBeDefined();
        expect(game.currentPlayer).toBe(Player.Black);
    });

    it('stone placement after piece move advances turn and clears moved flag', () => {
        const game = makePvpPlayingChessSession();
        const pawn = game.chessPieces!.find(
            (p) => p.owner === Player.Black && p.type === 'pawn' && p.x === 5,
        )!;
        applyChessMoveInternal(game, Player.Black, {
            pieceId: pawn.id,
            toX: 5,
            toY: 9,
        });
        expect(game.chessPieceMovedThisTurn).toBe(true);

        // Find empty intersection for go stone
        let placeX = 0;
        let placeY = 0;
        outer: for (let y = 0; y < 13; y++) {
            for (let x = 0; x < 13; x++) {
                if (game.boardState[y]![x] === Player.None) {
                    placeX = x;
                    placeY = y;
                    break outer;
                }
            }
        }

        const moveResult = processChessGoMove(
            game,
            { x: placeX, y: placeY, player: Player.Black },
            game.koInfo,
            game.moveHistory.length,
        );
        expect(moveResult.isValid).toBe(true);
        game.boardState = moveResult.newBoardState;
        game.moveHistory = [...(game.moveHistory ?? []), { x: placeX, y: placeY, player: Player.Black }];
        // Mirror standard.ts PLACE_STONE turn advance for chess
        game.currentPlayer = Player.White;
        game.chessPieceMovedThisTurn = false;

        expect(game.currentPlayer).toBe(Player.White);
        expect(game.chessPieceMovedThisTurn).toBe(false);
        expect(game.chessPieces!.find((p) => p.id === pawn.id)!.y).toBe(9);
    });

    it('Mix with Chess uses same piece-move turn rules', () => {
        const game = makePvpPlayingChessSession();
        game.mode = GameMode.Mix;
        game.settings = {
            ...game.settings,
            mixedModes: [GameMode.Chess, GameMode.Hidden],
        };
        const normalized = normalizeChessGoSession(game);
        Object.assign(game, normalized);

        const pawn = game.chessPieces!.find(
            (p) => p.owner === Player.Black && p.type === 'pawn' && p.x === 5,
        )!;
        const result = applyChessMoveInternal(game, Player.Black, {
            pieceId: pawn.id,
            toX: 5,
            toY: 9,
        });
        expect(result.error).toBeUndefined();
        expect(game.chessPieceMovedThisTurn).toBe(true);
        expect(game.currentPlayer).toBe(Player.Black);
    });
});
