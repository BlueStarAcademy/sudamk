import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameCategory, GameMode, Player, type LiveGameSession } from '../../../types/index.js';
import { createDefaultUser } from '../../initialData.js';
import { volatileState } from '../../state.js';

function makeMove(x: number, y: number, player: Player = Player.Black) {
    return { x, y, player };
}

function makeAdventureSession(overrides: Partial<LiveGameSession> = {}): LiveGameSession {
    const p1 = createDefaultUser('user-1', 'user-1', 'User');
    const p2 = createDefaultUser('ai-player-01', 'ai-player-01', 'AI');
    return {
        id: 'adv-hidden-merge-test',
        mode: GameMode.Hidden,
        settings: { boardSize: 9, komi: 6.5, timeLimit: 5, hiddenStoneCount: 2 },
        player1: p1,
        player2: p2,
        blackPlayerId: p1.id,
        whitePlayerId: p2.id,
        gameStatus: 'scoring',
        currentPlayer: Player.Black,
        boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        moveHistory: [makeMove(3, 3), makeMove(4, 4, Player.White)],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        winner: null,
        winReason: null,
        createdAt: Date.now(),
        lastMove: null,
        passCount: 2,
        round: 0,
        turnInRound: 0,
        koInfo: null,
        gameCategory: GameCategory.Adventure,
        isAiGame: true,
        serverRevision: 10,
        ...overrides,
    } as LiveGameSession;
}

describe('compareLiveSessionProgressForPveMerge prefers settled summary', () => {
    it('prefers same-move-count session that has summary over higher revision without summary', async () => {
        const { compareLiveSessionProgressForPveMerge } = await import('../../gameCache.js');
        const scoringNoSummary = makeAdventureSession({
            gameStatus: 'scoring',
            serverRevision: 50,
            summary: undefined,
            statsUpdated: false,
        });
        const endedWithSummary = makeAdventureSession({
            gameStatus: 'ended',
            serverRevision: 12,
            statsUpdated: true,
            winner: Player.Black,
            winReason: 'score',
            summary: {
                'user-1': {
                    gold: 100,
                    adventureRewardSlots: {
                        gold: { obtained: true, amount: 100 },
                        keyFragment: { obtained: true, amount: 1 },
                        equipment: { obtained: false },
                        material: { obtained: false },
                    },
                } as LiveGameSession['summary'] extends Record<string, infer S> | undefined ? S : never,
            },
        });

        expect(compareLiveSessionProgressForPveMerge(endedWithSummary, scoringNoSummary)).toBeGreaterThan(0);
        expect(compareLiveSessionProgressForPveMerge(scoringNoSummary, endedWithSummary)).toBeLessThan(0);
    });

    it('prefers ended+statsUpdated over same-move-count unfinished session when both lack summary', async () => {
        const { compareLiveSessionProgressForPveMerge } = await import('../../gameCache.js');
        const scoring = makeAdventureSession({
            gameStatus: 'scoring',
            serverRevision: 40,
            statsUpdated: false,
        });
        const ended = makeAdventureSession({
            gameStatus: 'ended',
            serverRevision: 11,
            statsUpdated: true,
            winner: Player.Black,
            winReason: 'score',
        });

        expect(compareLiveSessionProgressForPveMerge(ended, scoring)).toBeGreaterThan(0);
    });
});

describe('updateGameCache accepts settled summary over higher-revision scoring', () => {
    beforeEach(() => {
        volatileState.gameCache = new Map();
    });

    it('keeps ended+summary when a higher-revision scoring snapshot arrives later', async () => {
        const { updateGameCache, getStaleCachedGame } = await import('../../gameCache.js');
        const settled = makeAdventureSession({
            gameStatus: 'ended',
            serverRevision: 12,
            statsUpdated: true,
            winner: Player.Black,
            winReason: 'score',
            summary: {
                'user-1': { gold: 80 } as never,
            },
        });
        const laterScoring = makeAdventureSession({
            gameStatus: 'scoring',
            serverRevision: 99,
            statsUpdated: false,
            summary: undefined,
        });

        updateGameCache(settled);
        updateGameCache(laterScoring);

        const cached = getStaleCachedGame(settled.id);
        expect(cached?.gameStatus).toBe('ended');
        expect(cached?.summary?.['user-1']).toBeTruthy();
        expect(cached?.serverRevision).toBe(12);
    });
});

describe('saveGame adventure stale guard preserves ended summary', () => {
    beforeEach(() => {
        volatileState.gameCache = new Map();
        vi.resetModules();
    });

    it('does not skip ended adventure save when cache holds higher-revision scoring snapshot', async () => {
        const prismaSaveGame = vi.fn().mockResolvedValue(undefined);
        vi.doMock('../../prisma/gameService.ts', () => ({
            saveGame: prismaSaveGame,
            getLiveGame: vi.fn(),
        }));

        const { updateGameCache } = await import('../../gameCache.js');
        const db = await import('../../db.js');

        const scoringCached = makeAdventureSession({
            gameStatus: 'scoring',
            serverRevision: 80,
            summary: undefined,
        });
        updateGameCache(scoringCached);

        const endedWithSummary = makeAdventureSession({
            gameStatus: 'ended',
            serverRevision: 15,
            statsUpdated: true,
            winner: Player.Black,
            winReason: 'score',
            summary: {
                'user-1': { gold: 120 } as never,
            },
        });

        await db.saveGame(endedWithSummary);

        expect(prismaSaveGame).toHaveBeenCalled();
        expect(endedWithSummary.serverRevision).toBe(16);
    });

    it('skips non-terminal adventure save when cache is ahead and neither has summary', async () => {
        const prismaSaveGame = vi.fn().mockResolvedValue(undefined);
        vi.doMock('../../prisma/gameService.ts', () => ({
            saveGame: prismaSaveGame,
            getLiveGame: vi.fn(),
        }));

        const { updateGameCache } = await import('../../gameCache.js');
        const db = await import('../../db.js');

        const cachedAhead = makeAdventureSession({
            gameStatus: 'playing',
            serverRevision: 30,
            moveHistory: [makeMove(3, 3), makeMove(4, 4, Player.White), makeMove(5, 5)],
        });
        updateGameCache(cachedAhead);

        const staleIncoming = makeAdventureSession({
            gameStatus: 'playing',
            serverRevision: 10,
            moveHistory: [makeMove(3, 3), makeMove(4, 4, Player.White)],
        });

        await db.saveGame(staleIncoming);

        expect(prismaSaveGame).not.toHaveBeenCalled();
        expect(staleIncoming.serverRevision).toBe(10);
    });
});
