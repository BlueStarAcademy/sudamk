import { describe, expect, it } from 'vitest';
import { handleBaseAction, initializeBase, updateBaseState } from '../../modes/base.js';
import { aiUserId } from '../../aiPlayer.js';
import { applyPveItemActionClientSync } from '../../pveItemSync.js';
import { updateGameStateAfterMove } from '../../../hooks/useClientGameState.js';
import { GameCategory, GameMode, GameStatus, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession, User } from '../../../shared/types/index.js';

const makeUser = (id: string): User => ({
    id,
    username: id,
    nickname: id,
} as User);

const makeBaseGame = (overrides: Partial<LiveGameSession> = {}): LiveGameSession => {
    const human = makeUser('human-1');
    const opponent = makeUser(overrides.isAiGame ? aiUserId : 'human-2');
    return {
        id: 'base-flow-test',
        mode: GameMode.Base,
        isSinglePlayer: false,
        isAiGame: false,
        gameCategory: 'normal',
        player1: human,
        player2: opponent,
        blackPlayerId: human.id,
        whitePlayerId: opponent.id,
        gameStatus: 'pending' as GameStatus,
        currentPlayer: Player.Black,
        settings: { boardSize: 9, baseStones: 2, komi: 0.5 },
        boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        ...overrides,
    } as unknown as LiveGameSession;
};

const finishPlacement = (game: LiveGameSession, now = Date.now()) => {
    game.baseStones_p1 = [{ x: 2, y: 2 }, { x: 2, y: 6 }];
    game.baseStones_p2 = [{ x: 6, y: 2 }, { x: 6, y: 6 }];
    game.basePlacementReady = { [game.player1.id]: true, [game.player2.id]: true };
    updateBaseState(game, now);
};

describe('base mode', () => {
    it('does not hide-preplace AI base stones in single-player placement', () => {
        const human = makeUser('human-1');
        const ai = makeUser(aiUserId);
        const game = {
            id: 'sp-base-test',
            mode: GameMode.Base,
            isSinglePlayer: true,
            isAiGame: true,
            gameCategory: 'singleplayer',
            player1: human,
            player2: ai,
            settings: { boardSize: 9, baseStones: 4, komi: 0.5 },
            boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
            gameStatus: 'pending' as GameStatus,
        } as unknown as LiveGameSession;

        initializeBase(game, Date.now());

        expect(game.gameStatus).toBe('base_placement');
        expect(game.baseStones_p1).toEqual([]);
        expect(game.baseStones_p2).toEqual([]);
        expect(game.basePlacementReady?.[aiUserId]).toBe(true);
        expect(game.basePlacementDeadline).toBeUndefined();
    });

    it('uses only color choice, same-color komi, and start confirmation for PvP base flow', () => {
        const game = makeBaseGame();
        initializeBase(game, Date.now());
        const provisionalBlackId = game.blackPlayerId;

        finishPlacement(game);
        expect(game.gameStatus).toBe('base_stone_color_choice');
        expect(game.baseColorChoiceDeadline).toBeTypeOf('number');

        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player1.id, payload: { gameId: game.id, color: Player.Black } } as any, game.player1);
        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player2.id, payload: { gameId: game.id, color: Player.Black } } as any, game.player2);
        updateBaseState(game, Date.now());

        expect(game.gameStatus).toBe('base_same_color_points_bid');
        expect(game.baseSameColorTieColor).toBe(Player.Black);
        expect(game.blackPlayerId).toBe(provisionalBlackId);

        handleBaseAction(game, { type: 'UPDATE_KOMI_BID', userId: game.player1.id, payload: { gameId: game.id, bid: { color: Player.White, komi: 3 } } } as any, game.player1);
        handleBaseAction(game, { type: 'UPDATE_KOMI_BID', userId: game.player2.id, payload: { gameId: game.id, bid: { color: Player.White, komi: 1 } } } as any, game.player2);
        updateBaseState(game, Date.now());

        expect(game.gameStatus).toBe('base_game_start_confirmation');
        expect(game.blackPlayerId).toBe(game.player1.id);
        expect(game.whitePlayerId).toBe(game.player2.id);
        expect(game.finalKomi).toBe(3.5);
        expect(game.baseStones).toHaveLength(4);
        expect(game.baseStones?.find((p) => p.x === 2 && p.y === 2)?.player).toBe(
            provisionalBlackId === game.player1.id ? Player.Black : Player.White
        );
        expect(game.baseStones_p1).toEqual([]);
        expect(game.baseStones_p2).toEqual([]);
    });

    it('starts confirmation immediately with 0.5 komi when preferred colors differ', () => {
        const game = makeBaseGame();
        initializeBase(game, Date.now());
        finishPlacement(game);

        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player1.id, payload: { gameId: game.id, color: Player.Black } } as any, game.player1);
        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player2.id, payload: { gameId: game.id, color: Player.White } } as any, game.player2);
        updateBaseState(game, Date.now());

        expect(game.gameStatus).toBe('base_game_start_confirmation');
        expect(game.blackPlayerId).toBe(game.player1.id);
        expect(game.whitePlayerId).toBe(game.player2.id);
        expect(game.finalKomi).toBe(0.5);
        expect(game.komiBids).toBeUndefined();
        expect(game.baseStones_p1).toEqual([]);
        expect(game.baseStones_p2).toEqual([]);
    });

    it('auto-completes AI setup choices without setup countdowns', () => {
        const game = makeBaseGame({
            id: 'sp-base-flow-test',
            isSinglePlayer: true,
            isAiGame: true,
            gameCategory: GameCategory.SinglePlayer,
            player2: makeUser(aiUserId),
            settings: { boardSize: 9, baseStones: 2, komi: 0.5 } as any,
        });
        initializeBase(game, Date.now());
        game.baseStones_p1 = [{ x: 2, y: 2 }, { x: 2, y: 6 }];

        handleBaseAction(game, { type: 'CONFIRM_BASE_PLACEMENT_COMPLETE', userId: game.player1.id, payload: { gameId: game.id } } as any, game.player1);
        updateBaseState(game, Date.now());
        expect(game.gameStatus).toBe('base_stone_color_choice');
        expect(game.baseColorChoiceDeadline).toBeUndefined();

        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player1.id, payload: { gameId: game.id, color: Player.Black } } as any, game.player1);
        updateBaseState(game, Date.now());

        expect(game.gameStatus).not.toBe('base_stone_color_choice');
        expect(game.gameStatus === 'base_same_color_points_bid' ? game.komiBiddingDeadline : undefined).toBeUndefined();
    });

    it('keeps base markers unless the base stone is actually captured', () => {
        const game = {
            id: 'base-marker-test',
            mode: GameMode.Base,
            gameCategory: 'singleplayer',
            isSinglePlayer: true,
            isAiGame: true,
            player1: makeUser('human-1'),
            player2: makeUser(aiUserId),
            blackPlayerId: 'human-1',
            whitePlayerId: aiUserId,
            gameStatus: 'playing' as GameStatus,
            currentPlayer: Player.Black,
            settings: { boardSize: 5, komi: 0.5 },
            boardState: Array.from({ length: 5 }, () => Array(5).fill(Player.None)),
            moveHistory: [],
            captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
            baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
            hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
            hiddenMoves: {},
            permanentlyRevealedStones: [],
            baseStones: [{ x: 2, y: 2, player: Player.Black }],
        } as unknown as LiveGameSession;
        const newBoardState = Array.from({ length: 5 }, () => Array(5).fill(Player.None));
        newBoardState[2][2] = Player.Black;

        const { updatedGame } = updateGameStateAfterMove(
            game,
            {
                gameId: game.id,
                x: 2,
                y: 2,
                newBoardState,
                capturedStones: [],
                newKoInfo: null,
                movePlayer: Player.Black,
            },
            'singleplayer'
        );

        expect(updatedGame.baseStones).toEqual([{ x: 2, y: 2, player: Player.Black }]);
    });

    it('does not let stale base pre-play client sync rewind the started game', () => {
        const boardState = Array.from({ length: 5 }, () => Array(5).fill(Player.None));
        boardState[1][1] = Player.Black;
        boardState[2][2] = Player.White;
        const game = makeBaseGame({
            id: 'base-stale-sync-test',
            isSinglePlayer: true,
            isAiGame: true,
            gameCategory: GameCategory.SinglePlayer,
            player2: makeUser(aiUserId),
            blackPlayerId: aiUserId,
            whitePlayerId: 'human-1',
            gameStatus: 'playing' as GameStatus,
            currentPlayer: Player.White,
            settings: { boardSize: 5, baseStones: 1, komi: 0.5 } as any,
            boardState,
            moveHistory: [{ x: 1, y: 1, player: Player.Black }],
            totalTurns: 1,
            baseStones: [{ x: 2, y: 2, player: Player.White }],
            baseStones_p1: [],
            baseStones_p2: [],
        });

        applyPveItemActionClientSync(game, {
            clientSync: {
                boardState: Array.from({ length: 5 }, () => Array(5).fill(Player.None)),
                moveHistory: [],
                gameStatus: 'base_placement',
                currentPlayer: Player.Black,
                totalTurns: 0,
            },
        });

        expect(game.gameStatus).toBe('playing');
        expect(game.currentPlayer).toBe(Player.White);
        expect(game.moveHistory).toEqual([{ x: 1, y: 1, player: Player.Black }]);
        expect(game.totalTurns).toBe(1);
        expect(game.baseStones).toEqual([{ x: 2, y: 2, player: Player.White }]);
        expect(game.boardState[2][2]).toBe(Player.White);
    });
});
