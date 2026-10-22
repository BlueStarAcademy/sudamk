/**
 * 사람 vs 사람(PvP) 히든바둑: 히든돌 따냄 후 돌 가시성 회귀 테스트
 * - 히든돌로 따냈을 때 공격 돌이 보드에 남고, 따낸 돌이 사라지는지
 * - 히든돌이 따였을 때 그 돌이 보드에서 사라지고 공격 돌이 남는지
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

function makeHiddenPvpGame(): LiveGameSession {
    const p1 = createDefaultUser('hp-b', 'hpB', 'hpB');
    const p2 = createDefaultUser('hp-w', 'hpW', 'hpW');
    const now = Date.now();
    return {
        id: 'game-hidden-pvp-capture',
        mode: GameMode.Hidden,
        settings: {
            boardSize: 9,
            komi: 6.5,
            timeLimit: 60,
            byoyomiCount: 3,
            byoyomiTime: 30,
            hiddenStoneCount: 2,
        },
        player1: p1,
        player2: p2,
        blackPlayerId: p1.id,
        whitePlayerId: p2.id,
        gameStatus: 'playing',
        currentPlayer: Player.Black,
        boardState: emptyBoard(9) as LiveGameSession['boardState'],
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
        blackTimeLeft: 3600,
        whiteTimeLeft: 3600,
        blackByoyomiPeriodsLeft: 3,
        whiteByoyomiPeriodsLeft: 3,
        turnDeadline: now + 60 * 1000,
        turnStartTime: now,
        disconnectionCounts: {},
        currentActionButtons: {},
        scores: {},
        gameCategory: GameCategory.Normal,
        hidden_stones_p1: 2,
        hidden_stones_p2: 2,
    } as LiveGameSession;
}

describe('PvP hidden capture visibility (server authority)', () => {
    let volatileState: VolatileState;
    let p1: User;
    let p2: User;

    beforeEach(() => {
        vi.clearAllMocks();
        p1 = createDefaultUser('hp-b', 'hpB', 'hpB');
        p2 = createDefaultUser('hp-w', 'hpW', 'hpW');
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

    async function act(
        game: LiveGameSession,
        user: User,
        type: string,
        payload: Record<string, unknown> = {},
    ) {
        const { handleStrategicGameAction } = await import('../../modes/standard.js');
        return handleStrategicGameAction(
            volatileState,
            game,
            { type, payload, userId: user.id } as never,
            user,
        );
    }

    async function finalizeReveal(game: LiveGameSession) {
        if (game.gameStatus === 'hidden_reveal_animating') {
            const { updateHiddenState } = await import('../../modes/hidden.js');
            await updateHiddenState(game, (game.revealAnimationEndTime ?? Date.now()) + 1);
        }
    }

    it('black hidden stone captures white: capturing stone stays, captured stone removed', async () => {
        const game = makeHiddenPvpGame();

        await act(game, p1, 'START_HIDDEN_PLACEMENT');
        await act(game, p1, 'PLACE_STONE', { x: 1, y: 1, isHidden: true });
        await act(game, p2, 'PLACE_STONE', { x: 2, y: 1 });
        await act(game, p1, 'PLACE_STONE', { x: 2, y: 0 });
        await act(game, p2, 'PLACE_STONE', { x: 8, y: 8 });
        await act(game, p1, 'PLACE_STONE', { x: 2, y: 2 });
        await act(game, p2, 'PLACE_STONE', { x: 7, y: 8 });
        const trig = await act(game, p1, 'PLACE_STONE', { x: 3, y: 1 });
        expect(trig?.error).toBeUndefined();

        expect(game.gameStatus).toBe('hidden_reveal_animating');
        expect(game.permanentlyRevealedStones).toContainEqual({ x: 1, y: 1 });

        await finalizeReveal(game);
        expect(game.gameStatus).toBe('playing');
        expect(game.boardState?.[1]?.[1]).toBe(Player.Black);
        expect(game.boardState?.[1]?.[2]).toBe(Player.None);
        expect(game.captures[Player.Black]).toBeGreaterThan(0);
        expect(game.currentPlayer).toBe(Player.White);
    });

    it('white captures black hidden stone: hidden stone removed, white stone stays', async () => {
        const game = makeHiddenPvpGame();

        await act(game, p1, 'START_HIDDEN_PLACEMENT');
        await act(game, p1, 'PLACE_STONE', { x: 1, y: 1, isHidden: true });
        await act(game, p2, 'PLACE_STONE', { x: 2, y: 1 });
        await act(game, p1, 'PLACE_STONE', { x: 8, y: 8 });
        await act(game, p2, 'PLACE_STONE', { x: 0, y: 1 });
        await act(game, p1, 'PLACE_STONE', { x: 8, y: 7 });
        await act(game, p2, 'PLACE_STONE', { x: 1, y: 0 });
        await act(game, p1, 'PLACE_STONE', { x: 8, y: 6 });
        const trig = await act(game, p2, 'PLACE_STONE', { x: 1, y: 2 });
        expect(trig?.error).toBeUndefined();

        expect(game.gameStatus).toBe('hidden_reveal_animating');
        expect(game.permanentlyRevealedStones).toContainEqual({ x: 1, y: 1 });

        await finalizeReveal(game);
        expect(game.gameStatus).toBe('playing');
        expect(game.boardState?.[1]?.[1]).toBe(Player.None);
        expect(game.boardState?.[2]?.[1]).toBe(Player.White);
        expect(game.justCaptured?.some((jc) => jc.wasHidden && jc.player === Player.Black)).toBe(true);
    });

    it('hidden placement alone records the move as hidden for its owner', async () => {
        const game = makeHiddenPvpGame();

        await act(game, p1, 'START_HIDDEN_PLACEMENT');
        const placed = await act(game, p1, 'PLACE_STONE', { x: 4, y: 4, isHidden: true });
        expect(placed?.error).toBeUndefined();
        expect(game.hiddenMoves?.[0]).toBe(true);
        expect(game.humanHiddenStonePoints).toContainEqual({ x: 4, y: 4, player: Player.Black });
    });
});
