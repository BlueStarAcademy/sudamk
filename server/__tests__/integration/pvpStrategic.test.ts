/**
 * 전략바둑 PVP 모드 통합 테스트
 * - 버튼 기능: 패스, 기권
 * - 시간 규칙: 메인/초읽기, 타임아웃 패배
 * - 아이템: 히든(착수), 스캔(공개), 미사일(이동)
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
vi.mock('../../kataServerService.js', () => ({
    isKataServerAvailable: vi.fn(() => false),
    generateKataServerMoveCandidateDetails: vi.fn(async () => null),
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
            komi: 0.5,
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
        round: 0,
        turnInRound: 0,
        koInfo: null,
        blackTimeLeft: 60,
        whiteTimeLeft: 60,
        blackByoyomiPeriodsLeft: 3,
        whiteByoyomiPeriodsLeft: 3,
        turnDeadline: now + 60 * 1000,
        turnStartTime: now,
        disconnectionCounts: {},
        currentActionButtons: {},
        scores: {},
        gameCategory: GameCategory.Normal,
        ...overrides,
    };
    return game as LiveGameSession;
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
            activeTournamentViewers: new Set<string>(),
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

        it('START_HIDDEN_PLACEMENT is idempotent when already hidden_placing', async () => {
            const game = makePvpStrategicGame();
            game.hidden_stones_p1 = 2;
            game.gameStatus = 'hidden_placing';
            game.itemUseDeadline = Date.now() + 20000;
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'START_HIDDEN_PLACEMENT',
                payload: {},
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(game.gameStatus).toBe('hidden_placing');
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

        it('hidden_placing item use timeout consumes a hidden stone and keeps the turn', async () => {
            const game = makePvpStrategicGame();
            game.hidden_stones_p1 = 2;
            game.gameStatus = 'hidden_placing';
            game.currentPlayer = Player.Black;
            game.itemUseDeadline = Date.now() - 1000;
            game.pausedTurnTimeLeft = 60;
            game.turnDeadline = undefined;
            game.turnStartTime = undefined;

            const { updateHiddenState } = await import('../../modes/hidden.js');
            await updateHiddenState(game, Date.now());

            expect(game.gameStatus).toBe('playing');
            expect(game.currentPlayer).toBe(Player.Black);
            expect(game.hidden_stones_p1).toBe(1);
            expect((game as any).hidden_stones_used_p1).toBe(1);
            expect(game.itemUseDeadline).toBeUndefined();
            expect(game.turnDeadline).toBeDefined();
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
            expect(game.hidden_stones_p1).toBe(1);
            expect(game.currentPlayer).toBe(Player.White);
            expect(game.gameStatus).toBe('playing');
        });

        it('white player can start second hidden placement after first use', async () => {
            const game = makePvpStrategicGame({
                currentPlayer: Player.White,
                hidden_stones_p1: 2,
                hidden_stones_p2: 2,
            });
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');

            let res = await handleStrategicGameAction(volatileState, game, {
                type: 'START_HIDDEN_PLACEMENT',
                payload: {},
                userId: p2.id,
            } as any, p2);
            expect(res?.error).toBeUndefined();
            expect(game.gameStatus).toBe('hidden_placing');
            expect(game.itemPhaseActingPlayer).toBe(Player.White);

            res = await handleStrategicGameAction(volatileState, game, {
                type: 'PLACE_STONE',
                payload: { x: 2, y: 2, isHidden: true },
                userId: p2.id,
            } as any, p2);
            expect(res?.error).toBeUndefined();
            expect(game.hidden_stones_p2).toBe(1);
            expect(game.gameStatus).toBe('playing');
            expect(game.currentPlayer).toBe(Player.Black);

            game.currentPlayer = Player.White;
            res = await handleStrategicGameAction(volatileState, game, {
                type: 'START_HIDDEN_PLACEMENT',
                payload: {},
                userId: p2.id,
            } as any, p2);
            expect(res?.error).toBeUndefined();
            expect(game.gameStatus).toBe('hidden_placing');
        });

        it('hidden placement does not double-consume when item deadline expired at place time', async () => {
            const game = makePvpStrategicGame({
                currentPlayer: Player.White,
                gameStatus: 'hidden_placing',
                hidden_stones_p2: 2,
                itemUseDeadline: Date.now() - 1000,
                itemPhaseActingPlayer: Player.White,
            });
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const { updateHiddenState } = await import('../../modes/hidden.js');

            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'PLACE_STONE',
                payload: { x: 4, y: 4, isHidden: true },
                userId: p2.id,
            } as any, p2);
            expect(res?.error).toBeUndefined();
            expect(game.hidden_stones_p2).toBe(1);

            await updateHiddenState(game, Date.now());
            expect(game.hidden_stones_p2).toBe(1);
        });
    });

    describe('hidden stone PVP attack', () => {
        it('attacking a hidden stone reveals only — no capture, no own stone, turn preserved', async () => {
            const game = makePvpStrategicGame();
            const x = 4;
            const y = 4;
            const opponent = Player.White;

            game.boardState[y][x] = opponent;
            game.moveHistory = [{ player: opponent, x, y }];
            game.hiddenMoves = { 0: true };
            game.permanentlyRevealedStones = [];
            game.currentPlayer = Player.Black;

            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(
                volatileState,
                game,
                { type: 'PLACE_STONE', payload: { x, y, isHidden: false }, userId: p1.id } as any,
                p1
            );
            expect(res?.error).toBeUndefined();
            expect(game.gameStatus).toBe('hidden_reveal_animating');
            expect((game.pendingCapture as any)?.revealOnlyOpponentHidden).toBe(true);

            const { updateHiddenState } = await import('../../modes/hidden.js');
            await updateHiddenState(game, (game.revealAnimationEndTime ?? Date.now()) + 10);

            expect(game.captures[Player.Black]).toBe(0);
            expect(game.hiddenStoneCaptures[Player.Black]).toBe(0);
            expect(game.boardState[y][x]).toBe(opponent);
            expect(game.currentPlayer).toBe(Player.Black);
            expect(game.moveHistory.length).toBe(1);
        });

        it('during hidden_placing, clicking opponent hidden reveals and returns to hidden_placing with turn kept', async () => {
            const game = makePvpStrategicGame({
                currentPlayer: Player.Black,
                gameStatus: 'hidden_placing',
                hidden_stones_p1: 2,
                itemPhaseActingPlayer: Player.Black,
                itemUseDeadline: Date.now() + 20000,
                pausedTurnTimeLeft: 55,
            });
            const x = 3;
            const y = 3;
            const opponent = Player.White;
            game.boardState[y][x] = opponent;
            game.moveHistory = [{ player: opponent, x, y }];
            game.hiddenMoves = { 0: true };
            game.permanentlyRevealedStones = [];

            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(
                volatileState,
                game,
                { type: 'PLACE_STONE', payload: { x, y, isHidden: true }, userId: p1.id } as any,
                p1
            );
            expect(res?.error).toBeUndefined();
            expect(game.hidden_stones_p1).toBe(2);

            const { updateHiddenState } = await import('../../modes/hidden.js');
            await updateHiddenState(game, (game.revealAnimationEndTime ?? Date.now()) + 10);

            expect(game.gameStatus).toBe('hidden_placing');
            expect(game.currentPlayer).toBe(Player.Black);
            expect(game.boardState[y][x]).toBe(opponent);
            expect(game.hidden_stones_p1).toBe(2);
            expect(game.itemUseDeadline).toBeDefined();
        });

        it('attacking a surrounded hidden stone still reveals only without capture', async () => {
            const game = makePvpStrategicGame();
            const x = 4;
            const y = 4;
            const opponent = Player.White;

            game.boardState[y][x] = opponent;
            game.moveHistory = [{ player: opponent, x, y }];
            game.hiddenMoves = { 0: true };
            game.permanentlyRevealedStones = [];
            game.boardState[y - 1][x] = opponent;
            game.boardState[y + 1][x] = opponent;
            game.boardState[y][x - 1] = opponent;
            game.boardState[y][x + 1] = opponent;
            game.currentPlayer = Player.Black;

            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(
                volatileState,
                game,
                { type: 'PLACE_STONE', payload: { x, y, isHidden: false }, userId: p1.id } as any,
                p1
            );
            expect(res?.error).toBeUndefined();
            expect(game.gameStatus).toBe('hidden_reveal_animating');
            expect((game.pendingCapture as any)?.revealOnlyOpponentHidden).toBe(true);

            const { updateHiddenState } = await import('../../modes/hidden.js');
            await updateHiddenState(game, (game.revealAnimationEndTime ?? Date.now()) + 10);

            expect(game.captures[Player.Black]).toBe(0);
            expect(game.hiddenStoneCaptures[Player.Black]).toBe(0);
            expect(game.boardState[y][x]).toBe(opponent);
            expect(game.currentPlayer).toBe(Player.Black);
        });

    });

    describe('hidden reveal AI resume', () => {
        it('pair AI seat resumes after full hidden reveal animation without pending capture', async () => {
            const game = makePvpStrategicGame({
                isAiGame: false,
                gameStatus: 'hidden_reveal_animating',
                revealAnimationEndTime: Date.now() - 10,
                pendingCapture: null,
                currentPlayer: Player.White,
                pausedTurnTimeLeft: 12,
                turnDeadline: undefined,
                turnStartTime: undefined,
            } as Partial<LiveGameSession>);

            (game as any).pendingAiMoveAfterUserHiddenFullReveal = true;
            (game.settings as any).pairGame = {
                roomId: 'pair-room-1',
                pairMode: 'ai',
                currentTurnIndex: 1,
                teamA: {
                    members: [
                        { id: 'p1-id', name: 'P1', kind: 'user', slot: 'A1' },
                        { id: 'ally-user', name: 'ALLY', kind: 'user', slot: 'A2' },
                    ],
                },
                teamB: {
                    members: [
                        { id: 'pair-opponent-1', name: 'AI-1', kind: 'ai', slot: 'B1' },
                        { id: 'pet-ai-1', name: 'PET-1', kind: 'pet', slot: 'B2' },
                    ],
                },
                turnOrder: [
                    { seatId: 'black1', player: Player.Black, order: 1, participantId: 'p1-id', name: 'P1', kind: 'user', teamId: 'teamA', slot: 'A1' },
                    { seatId: 'white1', player: Player.White, order: 1, participantId: 'pair-opponent-1', name: 'AI-1', kind: 'ai', teamId: 'teamB', slot: 'B1' },
                    { seatId: 'black2', player: Player.Black, order: 2, participantId: 'ally-user', name: 'ALLY', kind: 'user', teamId: 'teamA', slot: 'A2' },
                    { seatId: 'white2', player: Player.White, order: 2, participantId: 'pet-ai-1', name: 'PET-1', kind: 'pet', teamId: 'teamB', slot: 'B2' },
                ],
            };

            const { updateHiddenState } = await import('../../modes/hidden.js');
            await updateHiddenState(game, Date.now());

            expect(game.gameStatus).toBe('playing');
            expect(game.aiTurnStartTime).toBeDefined();
            expect((game as any).pendingAiMoveAfterUserHiddenFullReveal).toBeUndefined();
        });
    });

    describe('pair pet hidden item guard', () => {
        it('does not trigger hidden animation or consume hidden stones on pet turn', async () => {
            const game = makePvpStrategicGame({
                isAiGame: true,
                gameStatus: 'playing',
                currentPlayer: Player.White,
                whitePlayerId: 'pet-ai-1',
            } as Partial<LiveGameSession>);

            (game as any).hidden_stones_p2 = 1;
            (game as any).aiHiddenItemsUsedCount = 0;
            (game as any).aiHiddenItemUsed = false;
            (game as any).aiHiddenItemTurns = [1];
            (game.settings as any).pairGame = {
                roomId: 'pair-room-hidden-guard',
                pairMode: 'ai',
                currentTurnIndex: 1,
                teamA: {
                    members: [
                        { id: 'p1-id', name: 'P1', kind: 'user', slot: 'A1' },
                        { id: 'ally-user', name: 'ALLY', kind: 'user', slot: 'A2' },
                    ],
                },
                teamB: {
                    members: [
                        { id: 'pair-opponent-1', name: 'AI-1', kind: 'ai', slot: 'B1' },
                        { id: 'pet-ai-1', name: 'PET-1', kind: 'pet', slot: 'B2' },
                    ],
                },
                turnOrder: [
                    { seatId: 'black1', player: Player.Black, order: 1, participantId: 'p1-id', name: 'P1', kind: 'user', teamId: 'teamA', slot: 'A1' },
                    { seatId: 'white1', player: Player.White, order: 1, participantId: 'pet-ai-1', name: 'PET-1', kind: 'pet', teamId: 'teamB', slot: 'B2' },
                    { seatId: 'black2', player: Player.Black, order: 2, participantId: 'ally-user', name: 'ALLY', kind: 'user', teamId: 'teamA', slot: 'A2' },
                    { seatId: 'white2', player: Player.White, order: 2, participantId: 'pair-opponent-1', name: 'AI-1', kind: 'ai', teamId: 'teamB', slot: 'B1' },
                ],
            };

            const { makeGoAiBotMove } = await import('../../goAiBot.js');
            await makeGoAiBotMove(game, 5);

            expect(game.aiHiddenItemAnimationEndTime).toBeUndefined();
            expect(game.animation?.type).not.toBe('ai_thinking');
            expect((game as any).hidden_stones_p2).toBe(1);
            expect((game as any).aiHiddenItemsUsedCount).toBe(0);
            expect((game as any).pendingAiHiddenPlacement).not.toBe(true);
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

        it('START_SCANNING is idempotent when already scanning', async () => {
            const game = makePvpStrategicGame();
            game.scans_p1 = 2;
            game.gameStatus = 'scanning';
            game.itemUseDeadline = Date.now() + 20000;
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'START_SCANNING',
                payload: {},
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(game.gameStatus).toBe('scanning');
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
            // 첫 히든 적중: 몰래공개 + 스캔 1회 소모, 연출 후 본경기(playing)로 복귀
            expect(game.scans_p1).toBe(1);
            expect(game.animation?.type).toBe('scan');
            expect(game.gameStatus).toBe('scanning_animating');
            const anim = game.animation as { startTime: number; duration: number };
            const { updateHiddenState } = await import('../../modes/hidden.js');
            await updateHiddenState(game, anim.startTime + anim.duration + 1);
            expect(game.gameStatus).toBe('playing');
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

        it('START_MISSILE_SELECTION is idempotent when already missile_selecting', async () => {
            const game = makePvpStrategicGame();
            game.missiles_p1 = 2;
            game.gameStatus = 'missile_selecting';
            game.itemUseDeadline = Date.now() + 20000;
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'START_MISSILE_SELECTION',
                payload: {},
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(game.gameStatus).toBe('missile_selecting');
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

        it('START_MISSILE_SELECTION recovers stuck missile_animating without animation payload', async () => {
            const game = makePvpStrategicGame();
            game.missiles_p1 = 1;
            game.gameStatus = 'missile_animating';
            game.animation = null as any;
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'START_MISSILE_SELECTION',
                payload: {},
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(game.gameStatus).toBe('missile_selecting');
        });

        it('LAUNCH_MISSILE ignores suspiciously long client moveHistory (prevents scoringTurnLimit corruption)', async () => {
            const game = makePvpStrategicGame();
            game.moveHistory = [{ player: Player.Black, x: 4, y: 4 }];
            game.boardState[4][4] = Player.Black;
            game.totalTurns = 1;
            game.missiles_p1 = 2;
            game.gameStatus = 'missile_selecting';
            game.itemUseDeadline = Date.now() + 30000;
            const bogusHistory = Array.from({ length: 48 }, (_, i) => ({
                player: i % 2 === 0 ? Player.Black : Player.White,
                x: i % 9,
                y: (i + 1) % 9,
            }));
            const { handleStrategicGameAction } = await import('../../modes/strategic.js');
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'LAUNCH_MISSILE',
                payload: {
                    from: { x: 4, y: 4 },
                    direction: 'up',
                    boardState: game.boardState,
                    moveHistory: bogusHistory,
                },
                userId: p1.id,
            } as any, p1);
            expect(res?.error).toBeUndefined();
            expect(game.moveHistory.length).toBe(1);
            expect(game.totalTurns).toBe(1);
        });
    });
});
