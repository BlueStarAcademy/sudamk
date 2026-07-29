/**
 * 도전의 탑 베이스: 유저가 백이고 autoScoringTurns가 짝수면 마지막 수가 사람 착수.
 * 클라가 PLACE_STONE+triggerAutoScoring을 보내며, 서버가 타워를 거절하면 계가가 멈춘다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../types/enums.js';
import type { LiveGameSession, User, VolatileState } from '../../../types/index.js';
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

vi.mock('../../gameModes.js', () => ({
    getGameResult: vi.fn(async () => undefined),
    invalidateScoringPrecompute: vi.fn(),
    maybeStartAnticipatedScoringPrecompute: vi.fn(),
}));

vi.mock('../../utils/deferGetGameResultForScoringOverlay.js', () => ({
    deferGetGameResultForScoringOverlay: vi.fn(),
}));

import { deferGetGameResultForScoringOverlay } from '../../utils/deferGetGameResultForScoringOverlay.js';
import * as db from '../../db.js';

function towerBaseGameHumanWhiteAtCap(): LiveGameSession {
    const user = createDefaultUser('user-1', 'u1', 'User');
    const moveHistory = [
        { x: 2, y: 2, player: Player.Black },
        { x: 3, y: 3, player: Player.White },
    ];
    return {
        id: 'tower-game-white-autoscore',
        mode: GameMode.Base,
        isSinglePlayer: false,
        gameCategory: GameCategory.Tower,
        isAiGame: true,
        gameStatus: 'playing',
        currentPlayer: Player.Black,
        settings: { boardSize: 9, autoScoringTurns: 2, baseStones: 4 },
        moveHistory,
        boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        player1: user,
        player2: { id: 'ai-player-01', nickname: 'AI' } as LiveGameSession['player2'],
        blackPlayerId: 'ai-player-01',
        whitePlayerId: user.id,
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        totalTurns: 2,
    } as LiveGameSession;
}

describe('tower PLACE_STONE triggerAutoScoring', () => {
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

    it('accepts tower Base human-White auto-scoring (does not reject as singleplayer-only)', async () => {
        const game = towerBaseGameHumanWhiteAtCap();
        gameCache.set(game.id, game);
        const { handleAction } = await import('../../gameActions.js');

        const res = await handleAction(
            volatileState,
            {
                type: 'PLACE_STONE',
                payload: {
                    gameId: game.id,
                    triggerAutoScoring: true,
                    boardState: game.boardState,
                    moveHistory: game.moveHistory,
                    totalTurns: 2,
                    captures: game.captures,
                },
                userId: user.id,
            } as any,
            user,
        );

        expect(res?.error).toBeUndefined();
        expect(game.gameStatus).toBe('scoring');
        expect(db.saveGame).toHaveBeenCalled();
        expect(deferGetGameResultForScoringOverlay).toHaveBeenCalledWith(game.id, 'triggerAutoScoring');
    });
});
