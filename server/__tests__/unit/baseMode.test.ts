import { describe, expect, it } from 'vitest';
import { handleBaseAction, initializeBase, updateBaseState } from '../../modes/base.js';
import { updateCaptureState } from '../../modes/capture.js';
import { aiUserId } from '../../aiPlayer.js';
import { applyPveItemActionClientSync } from '../../pveItemSync.js';
import { enforceBaseSeatLockIfDriftedDuringPlay } from '../../modes/shared.js';
import { updateGameStateAfterMove } from '../../../hooks/useClientGameState.js';
import { isIntersectionRecordedAsBaseStone } from '../../../shared/utils/removeCapturedBaseStoneMarkers.js';
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
        // 임시 좌석은 배치 단계 동안만 의미가 있고, 본대국 좌석은 색이 확정될 때까지 비어 있어야 한다.
        expect(game.blackPlayerId).toBeNull();
        expect(game.whitePlayerId).toBeNull();
        const provisionalBlackId = game.basePlacementBlackPlayerId;
        expect(provisionalBlackId).toBeTypeOf('string');
        expect(game.basePlacementWhitePlayerId).toBeTypeOf('string');

        finishPlacement(game);
        expect(game.gameStatus).toBe('base_stone_color_choice');
        expect(game.baseColorChoiceDeadline).toBeTypeOf('number');

        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player1.id, payload: { gameId: game.id, color: Player.Black } } as any, game.player1);
        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player2.id, payload: { gameId: game.id, color: Player.Black } } as any, game.player2);
        updateBaseState(game, Date.now());

        expect(game.gameStatus).toBe('base_same_color_points_bid');
        expect(game.baseSameColorTieColor).toBe(Player.Black);
        // 색 확정 전(같은 색 입찰 단계)에는 본대국 좌석이 여전히 비어 있어야 한다 — 임시 좌석만 살아 있다.
        expect(game.blackPlayerId).toBeNull();
        expect(game.whitePlayerId).toBeNull();
        expect(game.basePlacementBlackPlayerId).toBe(provisionalBlackId);

        handleBaseAction(game, { type: 'UPDATE_KOMI_BID', userId: game.player1.id, payload: { gameId: game.id, bid: { color: Player.White, komi: 3 } } } as any, game.player1);
        handleBaseAction(game, { type: 'UPDATE_KOMI_BID', userId: game.player2.id, payload: { gameId: game.id, bid: { color: Player.White, komi: 1 } } } as any, game.player2);
        updateBaseState(game, Date.now());

        expect(game.gameStatus).toBe('base_game_start_confirmation');
        // 색이 확정되는 순간 본대국 좌석이 단 한 번 박히고, 좌석 잠금까지 같이 걸리며, 임시 좌석은 즉시 사라진다.
        expect(game.blackPlayerId).toBe(game.player1.id);
        expect(game.whitePlayerId).toBe(game.player2.id);
        expect(game.playingLockedBlackPlayerId).toBe(game.player1.id);
        expect(game.playingLockedWhitePlayerId).toBe(game.player2.id);
        expect(game.basePlacementBlackPlayerId).toBeUndefined();
        expect(game.basePlacementWhitePlayerId).toBeUndefined();
        expect((game as any).baseFinalColorAssignment).toMatchObject({
            blackPlayerId: game.player1.id,
            whitePlayerId: game.player2.id,
        });
        expect(game.finalKomi).toBe(3.5);
        expect(game.baseStones).toHaveLength(4);
        const expectedP1PlacementColor = provisionalBlackId === game.player1.id ? Player.Black : Player.White;
        expect(game.baseStones?.find((p) => p.x === 2 && p.y === 2)?.player).toBe(expectedP1PlacementColor);
        expect(game.boardState[2][2]).toBe(expectedP1PlacementColor);
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
        // 색 확정과 동시에 좌석 잠금이 박히고 임시 좌석은 즉시 비어 있다 — 어떤 패킷도 좌석을 임시값으로 되돌릴 수 없다.
        expect(game.playingLockedBlackPlayerId).toBe(game.player1.id);
        expect(game.playingLockedWhitePlayerId).toBe(game.player2.id);
        expect(game.basePlacementBlackPlayerId).toBeUndefined();
        expect(game.basePlacementWhitePlayerId).toBeUndefined();
        expect((game as any).baseFinalColorAssignment).toMatchObject({
            blackPlayerId: game.player1.id,
            whitePlayerId: game.player2.id,
        });
        expect(game.finalKomi).toBe(0.5);
        expect(game.komiBids).toBeUndefined();
        expect(game.baseStones_p1).toEqual([]);
        expect(game.baseStones_p2).toEqual([]);
    });

    it('keeps placed base stone colors after final player colors are chosen', () => {
        const game = makeBaseGame();
        initializeBase(game, Date.now());
        // 베이스돌 색은 임시 좌석으로 결정된다 — 본대국 좌석은 색 확정 시점까지 비어 있다.
        const provisionalP1Color = game.basePlacementBlackPlayerId === game.player1.id ? Player.Black : Player.White;
        const provisionalP2Color = game.basePlacementBlackPlayerId === game.player2.id ? Player.Black : Player.White;
        finishPlacement(game);

        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player1.id, payload: { gameId: game.id, color: Player.White } } as any, game.player1);
        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player2.id, payload: { gameId: game.id, color: Player.Black } } as any, game.player2);
        updateBaseState(game, Date.now());

        expect(game.gameStatus).toBe('base_game_start_confirmation');
        expect(game.whitePlayerId).toBe(game.player1.id);
        expect(game.blackPlayerId).toBe(game.player2.id);
        expect((game as any).baseFinalColorAssignment).toMatchObject({
            blackPlayerId: game.player2.id,
            whitePlayerId: game.player1.id,
        });
        expect(game.baseStones?.find((p) => p.x === 2 && p.y === 2)?.player).toBe(provisionalP1Color);
        expect(game.boardState[2][2]).toBe(provisionalP1Color);
        expect(game.baseStones?.find((p) => p.x === 6 && p.y === 2)?.player).toBe(provisionalP2Color);
        expect(game.boardState[2][6]).toBe(provisionalP2Color);
        expect(isIntersectionRecordedAsBaseStone(game, 2, 2)).toBe(true);
        expect(isIntersectionRecordedAsBaseStone(game, 6, 2)).toBe(true);
    });

    it('locks black/white seat ids when entering playing from base confirmation', () => {
        const game = makeBaseGame();
        initializeBase(game, Date.now());
        finishPlacement(game);
        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player1.id, payload: { gameId: game.id, color: Player.Black } } as any, game.player1);
        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player2.id, payload: { gameId: game.id, color: Player.White } } as any, game.player2);
        updateBaseState(game, Date.now());
        expect(game.gameStatus).toBe('base_game_start_confirmation');
        game.preGameConfirmations = { [game.player1.id]: true, [game.player2.id]: true };
        updateBaseState(game, Date.now());
        expect(game.gameStatus).toBe('playing');
        expect(game.playingLockedBlackPlayerId).toBe(game.blackPlayerId);
        expect(game.playingLockedWhitePlayerId).toBe(game.whitePlayerId);
        expect(game.playingLockedBlackPlayerId).toBe(game.player1.id);
        expect(game.playingLockedWhitePlayerId).toBe(game.player2.id);
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
        expect(game.gameStatus).toBe('base_stone_color_choice');
        updateBaseState(game, Date.now());
        expect(game.gameStatus).toBe('base_stone_color_choice');
        expect(game.baseColorChoiceDeadline).toBeUndefined();

        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player1.id, payload: { gameId: game.id, color: Player.Black } } as any, game.player1);
        updateBaseState(game, Date.now());

        expect(game.gameStatus).not.toBe('base_stone_color_choice');
        expect(game.gameStatus === 'base_same_color_points_bid' ? game.komiBiddingDeadline : undefined).toBeUndefined();
    });

    it('marks dungeon-bot AI ready in adventure base placement', () => {
        const adventureBotId = 'dungeon-bot-adventure-1';
        const game = makeBaseGame({
            id: 'adventure-base-flow-test',
            isSinglePlayer: true,
            isAiGame: true,
            gameCategory: GameCategory.Adventure,
            player2: makeUser(adventureBotId),
            settings: { boardSize: 9, baseStones: 2, komi: 0.5 } as any,
        });

        initializeBase(game, Date.now());
        expect(game.basePlacementReady?.[adventureBotId]).toBe(true);

        game.baseStones_p1 = [{ x: 2, y: 2 }, { x: 2, y: 6 }];
        handleBaseAction(
            game,
            { type: 'CONFIRM_BASE_PLACEMENT_COMPLETE', userId: game.player1.id, payload: { gameId: game.id } } as any,
            game.player1
        );
        updateBaseState(game, Date.now());

        expect(game.gameStatus).toBe('base_stone_color_choice');
        expect(game.baseStones_p1?.length ?? 0).toBe(2);
        expect(game.baseStones_p2?.length ?? 0).toBe(2);
    });

    it('lets AI prefer the same color as its placed base stones', () => {
        const game = makeBaseGame({
            id: 'sp-base-ai-color-from-placement',
            isSinglePlayer: true,
            isAiGame: true,
            gameCategory: GameCategory.SinglePlayer,
            player2: makeUser(aiUserId),
            settings: { boardSize: 9, baseStones: 2, komi: 0.5 } as any,
        });
        initializeBase(game, Date.now());
        game.basePlacementBlackPlayerId = aiUserId;
        game.basePlacementWhitePlayerId = game.player1.id;
        game.baseStones_p1 = [{ x: 2, y: 2 }, { x: 2, y: 6 }];

        handleBaseAction(
            game,
            { type: 'CONFIRM_BASE_PLACEMENT_COMPLETE', userId: game.player1.id, payload: { gameId: game.id } } as any,
            game.player1
        );
        handleBaseAction(
            game,
            { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player1.id, payload: { gameId: game.id, color: Player.White } } as any,
            game.player1
        );
        updateBaseState(game, Date.now());

        expect(game.gameStatus).toBe('base_game_start_confirmation');
        expect(game.blackPlayerId).toBe(aiUserId);
        expect(game.whitePlayerId).toBe(game.player1.id);
        expect(game.baseKomiBidsSnapshot?.[aiUserId]?.color).toBe(Player.Black);
    });

    it('uses 5~20 default AI komi bids in same-color base bidding', () => {
        const game = makeBaseGame({
            id: 'sp-base-ai-default-komi-range',
            isSinglePlayer: true,
            isAiGame: true,
            gameCategory: GameCategory.SinglePlayer,
            player2: makeUser(aiUserId),
            settings: { boardSize: 9, baseStones: 2, komi: 0.5 } as any,
        });
        initializeBase(game, Date.now());
        game.basePlacementBlackPlayerId = aiUserId;
        game.basePlacementWhitePlayerId = game.player1.id;
        game.baseStones_p1 = [{ x: 2, y: 2 }, { x: 2, y: 6 }];

        handleBaseAction(
            game,
            { type: 'CONFIRM_BASE_PLACEMENT_COMPLETE', userId: game.player1.id, payload: { gameId: game.id } } as any,
            game.player1
        );
        handleBaseAction(
            game,
            { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player1.id, payload: { gameId: game.id, color: Player.Black } } as any,
            game.player1
        );
        updateBaseState(game, Date.now());
        expect(game.gameStatus).toBe('base_same_color_points_bid');

        handleBaseAction(
            game,
            { type: 'UPDATE_KOMI_BID', userId: game.player1.id, payload: { gameId: game.id, bid: { color: Player.Black, komi: 9 } } } as any,
            game.player1
        );
        updateBaseState(game, Date.now());

        const aiBid = game.baseKomiBidsSnapshot?.[aiUserId]?.komi;
        expect(game.gameStatus).toBe('base_game_start_confirmation');
        expect(typeof aiBid).toBe('number');
        expect(aiBid).toBeGreaterThanOrEqual(5);
        expect(aiBid).toBeLessThanOrEqual(20);
        expect(aiBid).not.toBe(9);
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

    it('treats a white human hidden placement as user inventory, not AI hidden metadata', () => {
        const game = {
            id: 'sp-base-hidden-white-human',
            mode: GameMode.Mix,
            gameCategory: GameCategory.SinglePlayer,
            isSinglePlayer: true,
            isAiGame: true,
            player1: makeUser('human-1'),
            player2: makeUser(aiUserId),
            blackPlayerId: aiUserId,
            whitePlayerId: 'human-1',
            gameStatus: 'hidden_placing' as GameStatus,
            currentPlayer: Player.White,
            settings: { boardSize: 5, mixedModes: [GameMode.Base, GameMode.Hidden], hiddenStoneCount: 2 } as any,
            boardState: Array.from({ length: 5 }, () => Array(5).fill(Player.None)),
            moveHistory: [],
            captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
            baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
            hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
            hiddenMoves: {},
            permanentlyRevealedStones: [],
            hidden_stones_p1: 2,
            hidden_stones_p2: 2,
        } as unknown as LiveGameSession;
        const newBoardState = Array.from({ length: 5 }, () => Array(5).fill(Player.None));
        newBoardState[3][3] = Player.White;

        const { updatedGame } = updateGameStateAfterMove(
            game,
            {
                gameId: game.id,
                x: 3,
                y: 3,
                newBoardState,
                capturedStones: [],
                newKoInfo: null,
                movePlayer: Player.White,
                isHidden: true,
            },
            'singleplayer'
        );

        expect(updatedGame.hiddenMoves?.[0]).toBe(true);
        expect((updatedGame as any).hidden_stones_p1).toBe(2);
        expect((updatedGame as any).hidden_stones_p2).toBe(1);
        expect((updatedGame as any).aiInitialHiddenStone).toBeUndefined();
    });

    it('uses black inventory when the single-player AI is black and places a hidden stone', () => {
        const game = {
            id: 'sp-base-hidden-black-ai',
            mode: GameMode.Mix,
            gameCategory: GameCategory.SinglePlayer,
            isSinglePlayer: true,
            isAiGame: true,
            player1: makeUser('human-1'),
            player2: makeUser(aiUserId),
            blackPlayerId: aiUserId,
            whitePlayerId: 'human-1',
            gameStatus: 'playing' as GameStatus,
            currentPlayer: Player.Black,
            settings: { boardSize: 5, mixedModes: [GameMode.Base, GameMode.Hidden], hiddenStoneCount: 2 } as any,
            boardState: Array.from({ length: 5 }, () => Array(5).fill(Player.None)),
            moveHistory: [],
            captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
            baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
            hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
            hiddenMoves: {},
            permanentlyRevealedStones: [],
            hidden_stones_p1: 2,
            hidden_stones_p2: 2,
        } as unknown as LiveGameSession;
        const newBoardState = Array.from({ length: 5 }, () => Array(5).fill(Player.None));
        newBoardState[1][1] = Player.Black;

        const { updatedGame } = updateGameStateAfterMove(
            game,
            {
                gameId: game.id,
                x: 1,
                y: 1,
                newBoardState,
                capturedStones: [],
                newKoInfo: null,
                movePlayer: Player.Black,
                isHidden: true,
            },
            'singleplayer'
        );

        expect(updatedGame.hiddenMoves?.[0]).toBe(true);
        expect((updatedGame as any).hidden_stones_p1).toBe(1);
        expect((updatedGame as any).hidden_stones_p2).toBe(2);
        expect((updatedGame as any).aiInitialHiddenStone).toEqual({ x: 1, y: 1 });
    });

    it('reverts drifted black/white ids to playing-locked seat ids during play', () => {
        const game = makeBaseGame({
            id: 'base-seat-lock-drift-test',
            isSinglePlayer: true,
            isAiGame: true,
            gameCategory: GameCategory.SinglePlayer,
            player2: makeUser(aiUserId),
            blackPlayerId: 'human-1',
            whitePlayerId: aiUserId,
            gameStatus: 'playing' as GameStatus,
            currentPlayer: Player.Black,
            settings: { boardSize: 5, baseStones: 1, komi: 0.5 } as any,
        });
        (game as any).playingLockedBlackPlayerId = 'human-1';
        (game as any).playingLockedWhitePlayerId = aiUserId;

        game.blackPlayerId = aiUserId;
        game.whitePlayerId = 'human-1';

        const reverted = enforceBaseSeatLockIfDriftedDuringPlay(game);

        expect(reverted).toBe(true);
        expect(game.blackPlayerId).toBe('human-1');
        expect(game.whitePlayerId).toBe(aiUserId);
    });

    it('trusts playing-locked seats even if mode metadata is stale', () => {
        const game = makeBaseGame({
            id: 'base-seat-lock-stale-mode-test',
            mode: GameMode.Hidden,
            isSinglePlayer: true,
            isAiGame: true,
            gameCategory: GameCategory.SinglePlayer,
            player2: makeUser(aiUserId),
            blackPlayerId: aiUserId,
            whitePlayerId: 'human-1',
            gameStatus: 'playing' as GameStatus,
            currentPlayer: Player.Black,
            settings: { boardSize: 5, baseStones: 1, komi: 0.5 } as any,
        });
        (game as any).playingLockedBlackPlayerId = 'human-1';
        (game as any).playingLockedWhitePlayerId = aiUserId;

        const reverted = enforceBaseSeatLockIfDriftedDuringPlay(game);

        expect(reverted).toBe(true);
        expect(game.blackPlayerId).toBe('human-1');
        expect(game.whitePlayerId).toBe(aiUserId);
    });

    it('does not touch black/white ids during pre-play base statuses', () => {
        const game = makeBaseGame({
            id: 'base-seat-lock-pre-play-test',
            isSinglePlayer: true,
            isAiGame: true,
            gameCategory: GameCategory.SinglePlayer,
            player2: makeUser(aiUserId),
            blackPlayerId: 'human-1',
            whitePlayerId: aiUserId,
            gameStatus: 'base_placement' as GameStatus,
            currentPlayer: Player.Black,
            settings: { boardSize: 5, baseStones: 1, komi: 0.5 } as any,
        });
        (game as any).playingLockedBlackPlayerId = 'human-1';
        (game as any).playingLockedWhitePlayerId = aiUserId;

        game.blackPlayerId = aiUserId;
        game.whitePlayerId = 'human-1';

        const reverted = enforceBaseSeatLockIfDriftedDuringPlay(game);

        expect(reverted).toBe(false);
        expect(game.blackPlayerId).toBe(aiUserId);
        expect(game.whitePlayerId).toBe('human-1');
    });

    it('keeps locked seats stable after a client pve item sync during play', () => {
        const boardState = Array.from({ length: 5 }, () => Array(5).fill(Player.None));
        boardState[1][1] = Player.Black;
        const game = makeBaseGame({
            id: 'base-seat-lock-sync-test',
            isSinglePlayer: true,
            isAiGame: true,
            gameCategory: GameCategory.SinglePlayer,
            player2: makeUser(aiUserId),
            blackPlayerId: 'human-1',
            whitePlayerId: aiUserId,
            gameStatus: 'playing' as GameStatus,
            currentPlayer: Player.White,
            settings: { boardSize: 5, baseStones: 1, komi: 0.5 } as any,
            boardState,
            moveHistory: [{ x: 1, y: 1, player: Player.Black }],
            totalTurns: 1,
        });
        (game as any).playingLockedBlackPlayerId = 'human-1';
        (game as any).playingLockedWhitePlayerId = aiUserId;

        game.blackPlayerId = aiUserId;
        game.whitePlayerId = 'human-1';

        applyPveItemActionClientSync(game, {
            clientSync: {
                boardState,
                moveHistory: [{ x: 1, y: 1, player: Player.Black }],
                gameStatus: 'playing',
                currentPlayer: Player.White,
                totalTurns: 1,
            },
        });

        expect(game.blackPlayerId).toBe('human-1');
        expect(game.whitePlayerId).toBe(aiUserId);
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

    it('keeps blackPlayerId/whitePlayerId empty during base placement and only writes them at color finalization', () => {
        const game = makeBaseGame();
        initializeBase(game, Date.now());
        // 사전 조건: 임시 좌석에만 적혀 있고, 본대국 좌석은 색이 확정될 때까지 비어 있다.
        expect(game.gameStatus).toBe('base_placement');
        expect(game.blackPlayerId).toBeNull();
        expect(game.whitePlayerId).toBeNull();
        expect(game.basePlacementBlackPlayerId).toBeTypeOf('string');
        expect(game.basePlacementWhitePlayerId).toBeTypeOf('string');

        // 배치·선호 단계까지는 본대국 좌석이 계속 비어 있어야 한다.
        finishPlacement(game);
        expect(game.gameStatus).toBe('base_stone_color_choice');
        expect(game.blackPlayerId).toBeNull();
        expect(game.whitePlayerId).toBeNull();

        // 색이 확정되는 순간 본대국 좌석·좌석 잠금이 동시에 박히고 임시 좌석은 즉시 사라진다.
        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player1.id, payload: { gameId: game.id, color: Player.Black } } as any, game.player1);
        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player2.id, payload: { gameId: game.id, color: Player.White } } as any, game.player2);
        updateBaseState(game, Date.now());
        expect(game.gameStatus).toBe('base_game_start_confirmation');
        expect(game.blackPlayerId).toBe(game.player1.id);
        expect(game.whitePlayerId).toBe(game.player2.id);
        expect(game.playingLockedBlackPlayerId).toBe(game.blackPlayerId);
        expect(game.playingLockedWhitePlayerId).toBe(game.whitePlayerId);
        expect(game.basePlacementBlackPlayerId).toBeUndefined();
        expect(game.basePlacementWhitePlayerId).toBeUndefined();
    });

    it('applies capture bid points after Base+Capture placement while preserving base stone colors', () => {
        const game = makeBaseGame({
            mode: GameMode.Mix,
            settings: {
                boardSize: 9,
                baseStones: 2,
                komi: 0.5,
                captureTarget: 20,
                mixedModes: [GameMode.Base, GameMode.Capture],
            } as any,
        });
        initializeBase(game, Date.now());
        const provisionalP1Color = game.basePlacementBlackPlayerId === game.player1.id ? Player.Black : Player.White;

        finishPlacement(game);
        expect(game.gameStatus).toBe('capture_bidding');

        game.bids = { [game.player1.id]: 6, [game.player2.id]: 2 };
        updateCaptureState(game, Date.now());

        expect(game.blackPlayerId).toBe(game.player1.id);
        expect(game.whitePlayerId).toBe(game.player2.id);
        expect(game.effectiveCaptureTargets).toMatchObject({
            [Player.Black]: 20,
            [Player.White]: 14,
        });
        expect(game.baseStones?.find((p) => p.x === 2 && p.y === 2)?.player).toBe(provisionalP1Color);
        expect(game.boardState[2][2]).toBe(provisionalP1Color);
    });

    it('rejects drift back to provisional seats once colors are committed (regression: white reverts mid-game)', () => {
        const game = makeBaseGame();
        initializeBase(game, Date.now());
        const provisionalBlackId = game.basePlacementBlackPlayerId!;
        const provisionalWhiteId = game.basePlacementWhitePlayerId!;
        finishPlacement(game);

        // 양쪽이 같은 색을 선호 → 동색 입찰 → p1이 더 큰 입찰로 흑 선점, 임시 색이 결과적으로 뒤집힌다고 가정
        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player1.id, payload: { gameId: game.id, color: Player.Black } } as any, game.player1);
        handleBaseAction(game, { type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', userId: game.player2.id, payload: { gameId: game.id, color: Player.Black } } as any, game.player2);
        updateBaseState(game, Date.now());

        const winnerId = provisionalBlackId === game.player1.id ? game.player2.id : game.player1.id;
        const loserId = winnerId === game.player1.id ? game.player2.id : game.player1.id;
        handleBaseAction(game, { type: 'UPDATE_KOMI_BID', userId: winnerId, payload: { gameId: game.id, bid: { color: Player.Black, komi: 5 } } } as any, { id: winnerId } as any);
        handleBaseAction(game, { type: 'UPDATE_KOMI_BID', userId: loserId, payload: { gameId: game.id, bid: { color: Player.Black, komi: 1 } } } as any, { id: loserId } as any);
        updateBaseState(game, Date.now());

        expect(game.gameStatus).toBe('base_game_start_confirmation');
        const finalBlackId = game.blackPlayerId!;
        const finalWhiteId = game.whitePlayerId!;
        expect(typeof finalBlackId).toBe('string');
        expect(typeof finalWhiteId).toBe('string');
        // 좌석 잠금이 색 확정과 동시에 박혀 있어, 늦게 도착한 임시 좌석 패킷은 무시되어야 한다.
        expect(game.playingLockedBlackPlayerId).toBe(finalBlackId);
        expect(game.playingLockedWhitePlayerId).toBe(finalWhiteId);

        // playing으로 진입 후, 어떤 경로로 임시 좌석이 다시 들어와도(예: 슬림 패킷 역주입) 잠금이 좌석을 되돌린다.
        game.preGameConfirmations = { [game.player1.id]: true, [game.player2.id]: true };
        updateBaseState(game, Date.now());
        expect(game.gameStatus).toBe('playing');

        // 시뮬레이션: 늦은 패킷이 좌석을 임시값으로 되돌리려 시도
        game.blackPlayerId = provisionalBlackId;
        game.whitePlayerId = provisionalWhiteId;
        const reverted = enforceBaseSeatLockIfDriftedDuringPlay(game);

        expect(reverted).toBe(true);
        expect(game.blackPlayerId).toBe(finalBlackId);
        expect(game.whitePlayerId).toBe(finalWhiteId);
    });
});
