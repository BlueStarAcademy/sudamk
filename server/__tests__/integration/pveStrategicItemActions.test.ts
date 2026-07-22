/**
 * PVE/mixed_pair 전략 아이템 액션이 handleAction에서 삼켜지지 않는지 검증
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameMode, Player, type LiveGameSession, type User, type VolatileState } from '../../../types/index.js';
import { createDefaultUser } from '../../initialData.js';

const gameCache = new Map<string, LiveGameSession>();

vi.mock('../../db.js', () => ({
    saveGame: vi.fn().mockResolvedValue(undefined),
    getLiveGame: vi.fn(async (id: string) => gameCache.get(id) ?? null),
    updateUser: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../gameCache.js', () => ({
    getCachedGame: vi.fn(async (id: string) => gameCache.get(id) ?? null),
    updateGameCache: vi.fn((game: LiveGameSession) => {
        gameCache.set(game.id, game);
    }),
}));
vi.mock('../../socket.js', () => ({
    broadcastToGameParticipants: vi.fn(),
    broadcastUserUpdate: vi.fn(),
}));
vi.mock('../../utils/broadcastItemPhaseSnapshot.js', () => ({
    broadcastItemPhaseSnapshot: vi.fn().mockResolvedValue(undefined),
}));

function makeAdventureHiddenGame(overrides: Partial<LiveGameSession> = {}): LiveGameSession {
    const user = createDefaultUser('user-1', 'u1', 'User');
    return {
        id: 'adv-hidden-item-1',
        isAiGame: true,
        gameCategory: 'adventure',
        gameStatus: 'playing',
        mode: GameMode.Hidden,
        currentPlayer: Player.Black,
        blackPlayerId: user.id,
        whitePlayerId: 'ai-player-01',
        player1: user,
        player2: { id: 'ai-player-01', nickname: 'AI' } as LiveGameSession['player2'],
        moveHistory: [],
        boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        settings: { boardSize: 9, hiddenStoneCount: 2, scanCount: 2 },
        hidden_stones_p1: 2,
        scans_p1: 2,
        ...overrides,
    } as LiveGameSession;
}

describe('PVE strategic item actions via handleAction', () => {
    let volatileState: VolatileState;
    let user: User;

    beforeEach(() => {
        vi.clearAllMocks();
        gameCache.clear();
        user = createDefaultUser('user-1', 'u1', 'User');
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

    it('START_HIDDEN_PLACEMENT enters hidden_placing for adventure AI game', async () => {
        const game = makeAdventureHiddenGame();
        gameCache.set(game.id, game);
        const { handleAction } = await import('../../gameActions.js');

        const res = await handleAction(
            volatileState,
            {
                type: 'START_HIDDEN_PLACEMENT',
                payload: { gameId: game.id },
                userId: user.id,
            } as any,
            user,
        );

        expect(res?.error).toBeUndefined();
        expect(game.gameStatus).toBe('hidden_placing');
        expect(game.itemUseDeadline).toBeDefined();
        expect((res as any)?.clientResponse?.game?.gameStatus).toBe('hidden_placing');
    });

    it('PLACE_STONE in hidden_placing works for adventure AI game', async () => {
        const game = makeAdventureHiddenGame({
            gameStatus: 'hidden_placing',
            itemUseDeadline: Date.now() + 30_000,
        });
        gameCache.set(game.id, game);
        const { handleAction } = await import('../../gameActions.js');

        const res = await handleAction(
            volatileState,
            {
                type: 'PLACE_STONE',
                payload: { gameId: game.id, x: 3, y: 3, isHidden: true },
                userId: user.id,
            } as any,
            user,
        );

        expect(res?.error).toBeUndefined();
        expect(game.moveHistory.length).toBe(1);
        expect(game.hiddenMoves?.[0]).toBe(true);
        expect(game.hidden_stones_p1).toBe(1);
        expect(game.gameStatus).toBe('playing');
    });

    it('REVEAL_OPPONENT_HIDDEN reveals AI hidden stone for adventure (not swallowed by PVE gate)', async () => {
        const x = 4;
        const y = 4;
        const game = makeAdventureHiddenGame({
            boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
            moveHistory: [{ x, y, player: Player.White }],
            hiddenMoves: { 0: true },
            aiHiddenStonePoints: [{ x, y, player: Player.White }],
            permanentlyRevealedStones: [],
            currentPlayer: Player.Black,
        });
        game.boardState[y][x] = Player.White;
        gameCache.set(game.id, game);
        const { handleAction } = await import('../../gameActions.js');

        const res = await handleAction(
            volatileState,
            {
                type: 'REVEAL_OPPONENT_HIDDEN',
                payload: { gameId: game.id, x, y },
                userId: user.id,
            } as any,
            user,
        );

        expect(res?.error).toBeUndefined();
        // Regression: PVE allowlist used to return {} and leave status as playing
        expect(game.gameStatus).toBe('hidden_reveal_animating');
        expect(game.permanentlyRevealedStones?.some((p) => p.x === x && p.y === y)).toBe(true);
        expect(game.moveHistory.length).toBe(1);
        expect(game.currentPlayer).toBe(Player.Black);
        expect((res as any)?.clientResponse?.game?.gameStatus).toBe('hidden_reveal_animating');
    });
});
