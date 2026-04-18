/**
 * 전략바둑 PVP 모드 통합 테스트
 * - 버튼 기능: 패스, 기권
 * - 시간 규칙: 메인/초읽기, 타임아웃 패배
 * - 아이템: 히든(착수), 스캔(공개), 미사일(이동)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LiveGameSession, User, VolatileState } from '../../../shared/types/index.js';
import { GameMode, Player } from '../../../shared/types/index.js';
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

function makePvpStrategicGame(overrides: Partial<LiveGameSession> = {}): LiveGameSession {
    const p1 = createDefaultUser('p1-id', 'p1', 'P1');
    const p2 = createDefaultUser('p2-id', 'p2', 'P2');
    const now = Date.now();
    const boardSize = 9;
    const game: LiveGameSession = {
        id: 'game-pvp-strategic-1',
        mode: GameMode.Mix,
        settings: {
            boardSize: 9,
            timeLimit: 1,
            byoyomiCount: 3,
            byoyomiTime: 30,
            mixedModes: [GameMode.Standard, GameMode.Hidden, GameMode.Missile],
            hiddenStoneCount: 2,
            scanCount: 2,
            missileCount: 2,
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
        koInfo: null,
        blackTimeLeft: 60,
        whiteTimeLeft: 60,
        blackByoyomiPeriodsLeft: 3,
        whiteByoyomiPeriodsLeft: 3,
        turnDeadline: now + 60 * 1000,
        turnStartTime: now,
        disconnectionCounts: {},
        currentActionButtons: {},
        gameCategory: 'normal',
        ...overrides,
    };
    return game;
}

describe('PVP Strategic mode', () => {
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
        };
    });

    describe('button actions', () => {
        it('PASS_TURN switches turn and applies time rule', async () => {
            const game = makePvpStrategicGame();
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'PASS_TURN',
                payload: {},
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(game.passCount).toBe(1);
            expect(game.currentPlayer).toBe(Player.White);
            expect(game.lastMove).toEqual({ x: -1, y: -1 });
        });

        it('PASS_TURN rejects when not my turn', async () => {
            const game = makePvpStrategicGame();
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'PASS_TURN',
                payload: {},
                userId: p2.id,
            } as any, p2);
            expect(res?.error).toBeDefined();
            expect(game.passCount).toBe(0);
            expect(game.currentPlayer).toBe(Player.Black);
        });

        it('RESIGN_GAME ends game and sets winner', async () => {
            const game = makePvpStrategicGame();
            const summaryService = await import('../../summaryService.js');
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'RESIGN_GAME',
                payload: {},
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(summaryService.endGame).toHaveBeenCalledWith(game, Player.White, 'resign');
        });
    });

    describe('time rules', () => {
        it('updateStrategicGameState ends game by timeout when turnDeadline passed and no byoyomi', async () => {
            const game = makePvpStrategicGame();
            game.settings.timeLimit = 1;
            game.settings.byoyomiCount = 0;
            game.blackTimeLeft = 0;
            game.whiteTimeLeft = 60;
            game.blackByoyomiPeriodsLeft = 0;
            game.whiteByoyomiPeriodsLeft = 3;
            game.turnDeadline = Date.now() - 1000;
            game.currentPlayer = Player.Black;
            const { updateStrategicGameState } = await import('../../modes/strategic.js');
            const summaryService = await import('../../summaryService.js');
            await updateStrategicGameState(game, Date.now());
            expect(summaryService.endGame).toHaveBeenCalledWith(game, Player.White, 'timeout');
        });
    });

    describe('hidden item', () => {
        it('START_HIDDEN_PLACEMENT enters hidden_placing and sets itemUseDeadline', async () => {
            const game = makePvpStrategicGame();
            game.hidden_stones_p1 = 2;
            game.hidden_stones_p2 = 2;
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'START_HIDDEN_PLACEMENT',
                payload: {},
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(game.gameStatus).toBe('hidden_placing');
            expect(game.itemUseDeadline).toBeDefined();
        });

        it('START_HIDDEN_PLACEMENT rejects when no hidden stones left', async () => {
            const game = makePvpStrategicGame();
            (game as any).hidden_stones_p1 = 0;
            (game as any).hidden_stones_p2 = 2;
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'START_HIDDEN_PLACEMENT',
                payload: {},
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toContain('No hidden stones');
            expect(game.gameStatus).toBe('playing');
        });

        it('PLACE_STONE with isHidden in hidden_placing records hidden move and switches turn', async () => {
            const game = makePvpStrategicGame();
            game.gameStatus = 'hidden_placing';
            game.hidden_stones_p1 = 2;
            game.itemUseDeadline = Date.now() + 30000;
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'PLACE_STONE',
                payload: { x: 3, y: 3, isHidden: true },
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(game.moveHistory.length).toBe(1);
            expect(game.hiddenMoves?.[0]).toBe(true);
            expect(game.currentPlayer).toBe(Player.White);
            expect(game.gameStatus).toBe('playing');
        });
    });

    describe('hidden stone PVP attack', () => {
        it('attacking a hidden stone and successfully capturing awards +5 and turns it into a normal stone', async () => {
            const game = makePvpStrategicGame();
            const x = 4;
            const y = 4;
            const opponent = Player.White;

            // Opponent has a hidden stone at (x,y)
            game.boardState[y][x] = opponent;
            game.moveHistory = [{ player: opponent, x, y }];
            game.hiddenMoves = { 0: true };
            game.permanentlyRevealedStones = [];

            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(
                volatileState,
                game,
                { type: 'PLACE_STONE', payload: { x, y, isHidden: false }, userId: p1.id } as any,
                p1
            );
            expect(res?.error).toBeUndefined();
            expect(game.gameStatus).toBe('hidden_reveal_animating');
            expect(game.pendingCapture).not.toBeNull();

            const { updateHiddenState } = await import('../../modes/hidden.js');
            await updateHiddenState(game, (game.revealAnimationEndTime ?? Date.now()) + 10);

            expect(game.captures[Player.Black]).toBe(5);
            expect(game.hiddenStoneCaptures[Player.Black]).toBe(1);
            // After the reveal+capture resolves, the point becomes the capturer's normal stone.
            expect(game.boardState[y][x]).toBe(Player.Black);
        });

        it('attacking a hidden stone that would be suicide does not award +5 (reveal only)', async () => {
            const game = makePvpStrategicGame();
            const x = 4;
            const y = 4;
            const opponent = Player.White;

            // Hidden stone at (x,y)
            game.boardState[y][x] = opponent;
            game.moveHistory = [{ player: opponent, x, y }];
            game.hiddenMoves = { 0: true };
            game.permanentlyRevealedStones = [];

            // Surround the center so that placing a black stone becomes suicide when the hidden stone is removed.
            game.boardState[y - 1][x] = opponent;
            game.boardState[y + 1][x] = opponent;
            game.boardState[y][x - 1] = opponent;
            game.boardState[y][x + 1] = opponent;

            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(
                volatileState,
                game,
                { type: 'PLACE_STONE', payload: { x, y, isHidden: false }, userId: p1.id } as any,
                p1
            );
            expect(res?.error).toBeUndefined();
            expect(game.gameStatus).toBe('hidden_reveal_animating');
            expect(game.pendingCapture).toBeNull();

            const { updateHiddenState } = await import('../../modes/hidden.js');
            await updateHiddenState(game, (game.revealAnimationEndTime ?? Date.now()) + 10);

            expect(game.captures[Player.Black]).toBe(0);
            expect(game.hiddenStoneCaptures[Player.Black]).toBe(0);
            // Hidden stone remains (only revealed).
            expect(game.boardState[y][x]).toBe(opponent);
        });
    });

    describe('scan item', () => {
        it('START_SCANNING enters scanning when opponent has hidden stones', async () => {
            const game = makePvpStrategicGame();
            game.scans_p1 = 2;
            game.scans_p2 = 2;
            game.moveHistory = [
                { player: Player.White, x: 4, y: 4 },
            ];
            game.hiddenMoves = { 0: true };
            game.boardState[4][4] = Player.White;
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'START_SCANNING',
                payload: {},
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(game.gameStatus).toBe('scanning');
            expect(game.itemUseDeadline).toBeDefined();
        });

        it('SCAN_BOARD consumes scan and sets animation', async () => {
            const game = makePvpStrategicGame();
            game.gameStatus = 'scanning';
            game.scans_p1 = 2;
            game.moveHistory = [{ player: Player.White, x: 4, y: 4 }];
            game.hiddenMoves = { 0: true };
            game.boardState[4][4] = Player.White;
            game.currentPlayer = Player.Black;
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'SCAN_BOARD',
                payload: { x: 4, y: 4 },
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            // 첫 히든 적중은 몰래공개만 — 스캔 소모 없음(스캔 모드 유지)
            expect(game.scans_p1).toBe(2);
            expect(game.animation?.type).toBe('scan');
            expect(game.gameStatus).toBe('scanning_animating');
        });
    });

    describe('missile item', () => {
        it('START_MISSILE_SELECTION enters missile_selecting', async () => {
            const game = makePvpStrategicGame();
            game.missiles_p1 = 2;
            game.missiles_p2 = 2;
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'START_MISSILE_SELECTION',
                payload: {},
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(game.gameStatus).toBe('missile_selecting');
            expect(game.itemUseDeadline).toBeDefined();
        });

        it('START_MISSILE_SELECTION rejects when no missiles left', async () => {
            const game = makePvpStrategicGame();
            game.missiles_p1 = 0;
            game.missiles_p2 = 2;
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'START_MISSILE_SELECTION',
                payload: {},
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toContain('No missiles');
            expect(game.gameStatus).toBe('playing');
        });

        it('LAUNCH_MISSILE sets animation and decreases missile count (stone moves after animation)', async () => {
            const game = makePvpStrategicGame();
            game.moveHistory = [{ player: Player.Black, x: 4, y: 4 }];
            game.boardState[4][4] = Player.Black;
            game.missiles_p1 = 2;
            game.gameStatus = 'missile_selecting';
            game.itemUseDeadline = Date.now() + 30000;
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'LAUNCH_MISSILE',
                payload: { from: { x: 4, y: 4 }, direction: 'up' },
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(game.missiles_p1).toBe(1);
            expect(game.animation?.type).toBe('missile');
            expect(game.gameStatus).toBe('missile_animating');
        });
    });
});
