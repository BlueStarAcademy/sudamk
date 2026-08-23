import { describe, expect, it } from 'vitest';
import { aiUserId } from '../../aiPlayer.js';
import { initializeStrategicGame } from '../../modes/standard.js';
import { sessionUsesCastleGo } from '../../../shared/utils/castleGoRules.js';
import { GameMode, GameStatus, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession, Negotiation, User } from '../../../shared/types/index.js';

const makeUser = (id: string): User =>
    ({
        id,
        username: id,
        nickname: id,
    }) as User;

function makeFriendlyAiMixGame(mixedModes: GameMode[]): LiveGameSession {
    const human = makeUser('human-1');
    const ai = makeUser(aiUserId);
    return {
        id: 'friendly-ai-mix-test',
        mode: GameMode.Mix,
        isAiGame: true,
        player1: human,
        player2: ai,
        blackPlayerId: null,
        whitePlayerId: null,
        gameStatus: 'pending' as GameStatus,
        currentPlayer: Player.None,
        settings: {
            boardSize: 13,
            komi: 6.5,
            mixedModes,
            hiddenStoneCount: 1,
            scanCount: 2,
            chessPieceTotalScore: 15,
            castleCount: 4,
            friendlyLobbyMatch: true,
        } as LiveGameSession['settings'],
        boardState: Array.from({ length: 13 }, () => Array(13).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
    } as unknown as LiveGameSession;
}

const makeNegotiation = (game: LiveGameSession): Negotiation =>
    ({
        id: 'friendly-ai-mix-neg',
        proposerId: game.player1.id,
        challenger: game.player1,
        opponent: game.player2,
        mode: game.mode,
        settings: game.settings,
        status: 'accepted',
        deadline: 0,
    }) as unknown as Negotiation;

describe('friendly AI mix initialization', () => {
    it('starts mix+hidden+speed like a strategic AI game without nigiri', () => {
        const game = makeFriendlyAiMixGame([GameMode.Hidden, GameMode.Speed]);
        initializeStrategicGame(game, makeNegotiation(game), Date.now());
        expect(['nigiri_choosing', 'nigiri_guessing', 'nigiri_reveal', 'pending']).not.toContain(game.gameStatus);
        expect([game.blackPlayerId, game.whitePlayerId]).toContain(aiUserId);
    });

    it('enters chess piece placement for mix+chess AI', () => {
        const game = makeFriendlyAiMixGame([GameMode.Chess, GameMode.Hidden]);
        initializeStrategicGame(game, makeNegotiation(game), Date.now());
        expect(game.gameStatus).toBe('chess_piece_placement');
        expect(game.chessPiecePlacementDraft).toBeDefined();
    });

    it('places castle stones for mix+castle AI', () => {
        const game = makeFriendlyAiMixGame([GameMode.Castle, GameMode.Hidden]);
        initializeStrategicGame(game, makeNegotiation(game), Date.now());
        expect(sessionUsesCastleGo(game)).toBe(true);
        expect(game.castleStonePoints?.length).toBeGreaterThan(0);
        expect(['nigiri_choosing', 'nigiri_guessing', 'nigiri_reveal', 'pending']).not.toContain(game.gameStatus);
    });
});
