import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { GameMode, Player, GameCategory } from '../../../shared/types/index.js';
import { createDefaultUser } from '../../initialData.js';

vi.mock('../../db.js', () => ({
    getLiveGame: vi.fn().mockResolvedValue(null),
    saveGame: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../gameCache.js', () => ({
    getCachedGame: vi.fn().mockResolvedValue(null),
    getStaleCachedGame: vi.fn().mockReturnValue(null),
    updateGameCache: vi.fn(),
}));

function makeScoringPvpGame(): LiveGameSession {
    const p1 = createDefaultUser('p1', 'p1', 'P1');
    const p2 = createDefaultUser('p2', 'p2', 'P2');
    const board = Array(9)
        .fill(0)
        .map(() => Array(9).fill(Player.None));
    board[3][3] = Player.Black;
    return {
        id: 'game-scoring-resolve-test',
        mode: GameMode.Standard,
        settings: { boardSize: 9, komi: 6.5, timeLimit: 5 },
        player1: p1,
        player2: p2,
        blackPlayerId: p1.id,
        whitePlayerId: p2.id,
        gameStatus: 'scoring',
        currentPlayer: Player.Black,
        boardState: board,
        moveHistory: [{ x: 3, y: 3, player: Player.Black }],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        winner: null,
        winReason: 'score',
        createdAt: Date.now(),
        lastMove: null,
        passCount: 2,
        round: 0,
        turnInRound: 0,
        koInfo: null,
        gameCategory: GameCategory.Normal,
        isAiGame: false,
        isAnalyzing: true,
    } as LiveGameSession;
}

describe('resolveFreshGameForScoringFinalize', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('falls back to in-flight scoring session when cache and DB miss', async () => {
        const game = makeScoringPvpGame();
        (game as any).isScoringProtected = true;
        (game as any).preservedGameState = {
            boardState: game.boardState,
            moveHistory: game.moveHistory,
            captures: game.captures,
            totalTurns: 1,
        };

        const { getCachedGame, getStaleCachedGame, updateGameCache } = await import('../../gameCache.js');
        const db = await import('../../db.js');

        const mod = await import('../../gameModes.js');
        const resolve = (mod as any).resolveFreshGameForScoringFinalize as (
            g: LiveGameSession,
            preserved?: Record<string, unknown>,
        ) => Promise<LiveGameSession | null>;

        expect(resolve).toBeTypeOf('function');

        const fresh = await resolve(game, (game as any).preservedGameState);

        expect(getCachedGame).toHaveBeenCalledWith(game.id);
        expect(db.getLiveGame).toHaveBeenCalledWith(game.id);
        expect(getStaleCachedGame).toHaveBeenCalledWith(game.id);
        expect(updateGameCache).toHaveBeenCalled();
        expect(fresh?.id).toBe(game.id);
        expect(fresh?.gameStatus).toBe('scoring');
        expect(fresh?.boardState?.[3]?.[3]).toBe(Player.Black);
    });
});
