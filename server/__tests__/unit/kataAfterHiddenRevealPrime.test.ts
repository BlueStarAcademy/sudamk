import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameCategory, GameMode, Player, type LiveGameSession } from '../../../types/index.js';

vi.mock('../../kataServerService.js', () => ({
    isKataServerAvailable: () => true,
    generateKataServerMoveCandidateDetails: vi.fn(async () => ({
        candidates: [
            { x: 4, y: 4 },
            { x: 2, y: 3 },
        ],
        reportedMove: { x: 4, y: 4 },
        bestMove: { x: 4, y: 4 },
    })),
}));

vi.mock('../../kataServerRuntimeStore.js', () => ({
    getKataServerRuntimeSnapshot: () => ({
        adventure: { byMonsterLevel: {} },
        tower: { byFloor: {} },
        singleplayer: { byStageLevel: {} },
        guildwar: { byBoardId: {} },
        strategic: { byProfileLevel: {} },
    }),
}));

describe('primeKataServerBoardAfterHiddenReveal', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('stores Kata candidates and hard-resync flag for the next AI turn', async () => {
        const { primeKataServerBoardAfterHiddenReveal } = await import('../../goAiBot.js');

        const boardState = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => Player.None));
        boardState[2][2] = Player.Black;

        const game = {
            id: 'adv-hidden-reveal-1',
            mode: GameMode.Hidden,
            gameCategory: GameCategory.Adventure,
            gameStatus: 'playing',
            currentPlayer: Player.White,
            blackPlayerId: 'user-1',
            whitePlayerId: 'ai-player-01',
            isAiGame: true,
            settings: { boardSize: 9, komi: 6.5, timeLimit: 0, mixedModes: [], kataServerLevel: -5 },
            boardState,
            moveHistory: [{ x: 2, y: 2, player: Player.Black }],
            hiddenMoves: {},
            permanentlyRevealedStones: [{ x: 2, y: 2 }],
            finalKomi: 6.5,
        } as unknown as LiveGameSession;

        await primeKataServerBoardAfterHiddenReveal(game);

        expect((game as any).kataHardResyncAfterHiddenReveal).toBe(true);
        expect((game as any).pendingKataCandidatesAfterHiddenReveal).toEqual([
            { x: 4, y: 4 },
            { x: 2, y: 3 },
        ]);
    });
});
