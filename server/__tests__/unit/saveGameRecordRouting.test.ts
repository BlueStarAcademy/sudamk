import { describe, expect, it, vi } from 'vitest';
import type { VolatileState } from '../../../types/index.js';
import type { LiveGameSession } from '../../../types/index.js';
import { GameMode, Player } from '../../../types/enums.js';
import { stashEndedPvpGameRecordSnapshot } from '../../gameRecordSnapshot.js';

vi.mock('../../db.js', () => ({
    getUser: vi.fn(async (id: string) => ({
        id,
        nickname: 'tester',
        savedGameRecords: [],
        inventory: [],
    })),
    getLiveGame: vi.fn(async () => null),
    updateUser: vi.fn(async () => undefined),
}));

vi.mock('../../utils/sgfGenerator.js', () => ({
    generateSgfFromGame: vi.fn(() => '(;GM[1])'),
}));

describe('SAVE_GAME_RECORD routing', () => {
    it('resolves ended game from snapshot when DB misses (no Game not found)', async () => {
        const volatileState = { endedPvpGameRecordSnapshots: new Map() } as VolatileState;
        const game = {
            id: 'pvp-save-route-1',
            mode: GameMode.Standard,
            gameStatus: 'ended',
            isSinglePlayer: false,
            isAiGame: false,
            player1: { id: 'u1', nickname: 'A' },
            player2: { id: 'u2', nickname: 'B' },
            blackPlayerId: 'u1',
            whitePlayerId: 'u2',
            winner: Player.Black,
            winReason: 'score',
            settings: { boardSize: 19, komi: 0.5 },
            moveHistory: [{ player: Player.Black, x: 3, y: 3 }],
            boardState: Array.from({ length: 19 }, () => Array(19).fill(Player.None)),
            captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
            finalScores: { black: 10, white: 5 },
            analysisResult: {
                system: {
                    scoreDetails: {
                        black: { total: 10 },
                        white: { total: 5 },
                    },
                },
            },
            createdAt: Date.now(),
        } as LiveGameSession;
        stashEndedPvpGameRecordSnapshot(volatileState, game);

        const { handleAction } = await import('../../gameActions.js');
        const result = await handleAction(volatileState, {
            type: 'SAVE_GAME_RECORD',
            payload: { gameId: game.id },
            userId: 'u1',
        } as any);

        expect(result.error).toBeUndefined();
        expect((result as { clientResponse?: { success?: boolean } }).clientResponse?.success).toBe(true);
    });

    it('resolves ended playful PVP from client snapshot when DB misses', async () => {
        const volatileState = { endedPvpGameRecordSnapshots: new Map() } as VolatileState;
        const game = {
            id: 'pvp-save-route-omok',
            mode: GameMode.Omok,
            gameStatus: 'ended',
            isSinglePlayer: false,
            isAiGame: false,
            player1: { id: 'u1', nickname: 'A' },
            player2: { id: 'u2', nickname: 'B' },
            blackPlayerId: 'u1',
            whitePlayerId: 'u2',
            winner: Player.Black,
            winReason: 'omok_win',
            settings: { boardSize: 15, komi: 0.5 },
            moveHistory: [{ player: Player.Black, x: 7, y: 7 }],
            boardState: Array.from({ length: 15 }, () => Array(15).fill(Player.None)),
            captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
            createdAt: Date.now(),
        } as LiveGameSession;

        const { handleAction } = await import('../../gameActions.js');
        const result = await handleAction(volatileState, {
            type: 'SAVE_GAME_RECORD',
            payload: { gameId: game.id, sessionSnapshot: game },
            userId: 'u1',
        } as any);

        expect(result.error).toBeUndefined();
        expect((result as { clientResponse?: { success?: boolean } }).clientResponse?.success).toBe(true);
    });
});
