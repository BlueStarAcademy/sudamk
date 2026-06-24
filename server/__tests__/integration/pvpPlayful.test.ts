/**
 * 놀이바둑 PVP 모드 통합 테스트 (Omok, Dice)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LiveGameSession, User, VolatileState } from '../../../shared/types/index.js';
import { GameMode, Player, GameCategory } from '../../../shared/types/index.js';
import { createDefaultUser } from '../../initialData.js';

vi.mock('../../db.js', () => ({
    saveGame: vi.fn().mockResolvedValue(undefined),
    getLiveGame: vi.fn(),
}));
vi.mock('../../summaryService.js', () => ({
    endGame: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../socket.js', () => ({
    broadcastToGameParticipants: vi.fn(),
}));

function emptyBoard(size: number): number[][] {
    return Array(size).fill(0).map(() => Array(size).fill(Player.None));
}

function makePvpPlayfulGame(mode: GameMode, overrides: Partial<LiveGameSession> = {}): LiveGameSession {
    const p1 = createDefaultUser('p1-id', 'p1', 'P1');
    const p2 = createDefaultUser('p2-id', 'p2', 'P2');
    const now = Date.now();
    const boardSize = mode === GameMode.Omok || mode === GameMode.Ttamok ? 15 : 19;
    const game: LiveGameSession = {
        id: `game-pvp-playful-${mode}`,
        mode,
        settings: {
            boardSize,
            timeLimit: 5,
            byoyomiCount: 3,
            byoyomiTime: 30,
            has33Forbidden: true,
            hasOverlineForbidden: true,
        },
        player1: p1,
        player2: p2,
        blackPlayerId: p1.id,
        whitePlayerId: p2.id,
        gameStatus: 'playing',
        currentPlayer: Player.Black,
        boardState: emptyBoard(boardSize) as LiveGameSession['boardState'],
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        winner: null,
        winReason: null,
        createdAt: now,
        lastMove: null,
        passCount: 0,
        round: 0,
        turnInRound: 0,
        koInfo: null,
        blackTimeLeft: 300,
        whiteTimeLeft: 300,
        blackByoyomiPeriodsLeft: 3,
        whiteByoyomiPeriodsLeft: 3,
        turnDeadline: now + 300 * 1000,
        turnStartTime: now,
        disconnectionCounts: {},
        currentActionButtons: {},
        scores: {},
        gameCategory: GameCategory.Normal,
        isAiGame: false,
        ...overrides,
    };
    return game as LiveGameSession;
}

describe('PVP Playful modes', () => {
    let volatileState: VolatileState;
    let p1: User;
    let p2: User;

    beforeEach(() => {
        vi.clearAllMocks();
        p1 = createDefaultUser('p1-id', 'p1', 'P1');
        p2 = createDefaultUser('p2-id', 'p2', 'P2');
        volatileState = {
            userConnections: {},
            userStatuses: {},
            negotiations: {},
            waitingRoomChats: { global: [], strategic: [], playful: [] },
            gameChats: {},
            userLastChatMessage: {},
            activeTournamentViewers: new Set<string>(),
        };
    });

    describe('Omok', () => {
        it('OMOK_PLACE_STONE on empty board switches turn', async () => {
            const game = makePvpPlayfulGame(GameMode.Omok);
            const { handleOmokAction } = await import('../../modes/omok.js');
            const res = await handleOmokAction(volatileState, game, {
                type: 'OMOK_PLACE_STONE',
                payload: { x: 7, y: 7 },
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(game.boardState[7][7]).toBe(Player.Black);
            expect(game.currentPlayer).toBe(Player.White);
        });

        it('RESIGN_GAME ends Omok PVP with winner', async () => {
            const game = makePvpPlayfulGame(GameMode.Omok);
            const summaryService = await import('../../summaryService.js');
            const { handleOmokAction } = await import('../../modes/omok.js');
            const res = await handleOmokAction(volatileState, game, {
                type: 'RESIGN_GAME',
                payload: {},
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(summaryService.endGame).toHaveBeenCalledWith(game, Player.White, 'resign');
        });
    });

    describe('Dice Go', () => {
        it('DICE_ROLL in dice_rolling switches to dice_rolling_animating', async () => {
            const game = makePvpPlayfulGame(GameMode.Dice, {
                gameStatus: 'dice_rolling',
                settings: { boardSize: 19, timeLimit: 5, byoyomiCount: 3, byoyomiTime: 30 },
            });
            const { handleDiceGoAction } = await import('../../modes/diceGo.js');
            const res = await handleDiceGoAction(volatileState, game, {
                type: 'DICE_ROLL',
                payload: { gameId: game.id },
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(game.gameStatus).toBe('dice_rolling_animating');
            expect(game.animation?.type).toBe('dice_roll_main');
        });

        it('RESIGN_GAME ends Dice PVP with winner', async () => {
            const game = makePvpPlayfulGame(GameMode.Dice, { settings: { boardSize: 19, timeLimit: 5, byoyomiCount: 3, byoyomiTime: 30 } });
            const summaryService = await import('../../summaryService.js');
            const { handleDiceGoAction } = await import('../../modes/diceGo.js');
            const res = await handleDiceGoAction(volatileState, game, {
                type: 'RESIGN_GAME',
                payload: {},
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(summaryService.endGame).toHaveBeenCalledWith(game, Player.White, 'resign');
        });
    });
});
