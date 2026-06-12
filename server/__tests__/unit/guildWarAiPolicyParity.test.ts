import { describe, expect, it } from 'vitest';
import { aiUserId } from '../../aiPlayer.js';
import { initializeStrategicGame } from '../../modes/standard.js';
import { GameCategory, GameMode, GameStatus, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession, Negotiation, User } from '../../../shared/types/index.js';

const makeUser = (id: string): User => ({
    id,
    username: id,
    nickname: id,
} as User);

const makeGuildWarGame = (mode: GameMode): LiveGameSession => {
    const human = makeUser('human-1');
    const ai = makeUser(aiUserId);
    return {
        id: `guild-war-${mode}-ai-policy-test`,
        mode,
        isSinglePlayer: false,
        isAiGame: false,
        gameCategory: GameCategory.GuildWar,
        guildWarId: 'guild-war-1',
        guildWarBoardId: 'center',
        player1: human,
        player2: ai,
        blackPlayerId: human.id,
        whitePlayerId: ai.id,
        gameStatus: 'pending' as GameStatus,
        currentPlayer: Player.None,
        settings: {
            boardSize: 9,
            komi: 0.5,
            captureTarget: 20,
            autoScoringTurns: 20,
            scoringTurnLimit: 20,
            hiddenStoneCount: 2,
            missileCount: 2,
            scanCount: 2,
        } as any,
        boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
    } as unknown as LiveGameSession;
};

const makeNegotiation = (game: LiveGameSession): Negotiation => ({
    id: 'guild-war-ai-policy-negotiation',
    proposerId: game.player1.id,
    challenger: game.player1,
    opponent: game.player2,
    mode: game.mode,
    settings: game.settings,
    status: 'accepted',
    deadline: 0,
} as unknown as Negotiation);

describe('guild war AI policy parity', () => {
    it.each([GameMode.Standard, GameMode.Speed, GameMode.Hidden, GameMode.Missile])(
        'starts %s as a PVE AI game without PvP nigiri even if isAiGame is missing',
        (mode) => {
            const game = makeGuildWarGame(mode);

            initializeStrategicGame(game, makeNegotiation(game), Date.now());

            expect(['nigiri_choosing', 'nigiri_guessing', 'nigiri_reveal', 'pending']).not.toContain(game.gameStatus);
            expect([game.blackPlayerId, game.whitePlayerId]).toContain(aiUserId);
            expect(game.currentPlayer).not.toBe(Player.None);
        },
    );

    it('starts capture guild war with AI capture targets instead of PvP capture bidding when isAiGame is missing', () => {
        const game = makeGuildWarGame(GameMode.Capture);

        initializeStrategicGame(game, makeNegotiation(game), Date.now());

        expect(game.gameStatus).toBe('playing');
        expect(game.effectiveCaptureTargets?.[Player.Black]).toBeGreaterThan(0);
        expect(game.effectiveCaptureTargets?.[Player.White]).toBeGreaterThan(0);
        expect([game.blackPlayerId, game.whitePlayerId]).toContain(aiUserId);
    });
});
