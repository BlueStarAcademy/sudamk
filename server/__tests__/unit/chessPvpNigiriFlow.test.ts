import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession, User } from '../../../shared/types/index.js';
import { completeNigiriRevealTransition } from '../../../server/modes/nigiri.js';
import { handleSharedAction } from '../../../server/modes/shared.js';

function makeUser(id: string): User {
    return { id, username: id, nickname: id } as User;
}

function makePvpSession(mode: GameMode, mixedModes?: GameMode[]): LiveGameSession {
    const p1 = makeUser('p1');
    const p2 = makeUser('p2');
    return {
        id: 'game-pvp-chess',
        mode,
        isAiGame: false,
        gameStatus: 'nigiri_reveal',
        player1: p1,
        player2: p2,
        blackPlayerId: p1.id,
        whitePlayerId: p2.id,
        settings: {
            boardSize: 13,
            komi: 6.5,
            chessPieceTotalScore: 15,
            mixedModes,
        },
        boardState: [],
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        currentPlayer: Player.None,
        nigiri: {
            holderId: p1.id,
            guesserId: p2.id,
            stones: null,
            guess: null,
            result: null,
        },
        preGameConfirmations: { [p1.id]: true, [p2.id]: true },
    } as LiveGameSession;
}

describe('completeNigiriRevealTransition', () => {
    it('enters chess_piece_placement for 1v1 Chess PVP', () => {
        const game = makePvpSession(GameMode.Chess);
        completeNigiriRevealTransition(game, Date.now());
        expect(game.gameStatus).toBe('chess_piece_placement');
        expect(game.chessPiecePlacementDraft).toBeDefined();
    });

    it('enters chess_piece_placement for Mix with Chess', () => {
        const game = makePvpSession(GameMode.Mix, [GameMode.Chess, GameMode.Hidden]);
        completeNigiriRevealTransition(game, Date.now());
        expect(game.gameStatus).toBe('chess_piece_placement');
    });

    it('enters playing for Standard PVP', () => {
        const game = makePvpSession(GameMode.Standard);
        completeNigiriRevealTransition(game, Date.now());
        expect(game.gameStatus).toBe('playing');
    });
});

describe('handleSharedAction CONFIRM_COLOR_START', () => {
    it('enters chess_piece_placement when both confirm nigiri for Chess', async () => {
        const game = makePvpSession(GameMode.Chess);
        game.preGameConfirmations = { [game.player1.id]: false, [game.player2.id]: false };

        await handleSharedAction({} as any, game, { type: 'CONFIRM_COLOR_START', userId: game.player1.id } as any, game.player1);
        expect(game.gameStatus).toBe('nigiri_reveal');

        await handleSharedAction({} as any, game, { type: 'CONFIRM_COLOR_START', userId: game.player2.id } as any, game.player2);
        expect(game.gameStatus).toBe('chess_piece_placement');
    });
});
