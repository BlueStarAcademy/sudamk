import { describe, expect, it } from 'vitest';
import {
    isClientAuthPveWatchdogOnlyTick,
    needsPveMainLoopProcessing,
} from '../../utils/serverMainLoopGameTick.js';
import { aiUserId } from '../../aiPlayer.js';

function baseSpGame(overrides: Record<string, unknown> = {}) {
    return {
        id: 'sp-game-test-1',
        mode: '클래식 바둑',
        gameStatus: 'playing',
        isSinglePlayer: true,
        isAiGame: true,
        gameCategory: 'singleplayer',
        currentPlayer: 1,
        blackPlayerId: 'user-1',
        whitePlayerId: aiUserId,
        moveHistory: [],
        boardState: [],
        settings: { boardSize: 19 },
        player1: { id: 'user-1', nickname: 'User' },
        player2: { id: aiUserId, nickname: 'Bot' },
        ...overrides,
    } as any;
}

describe('serverMainLoopGameTick', () => {
    it('excludes singleplayer user-turn classic from main loop processing', () => {
        const game = baseSpGame();
        expect(needsPveMainLoopProcessing(game)).toBe(false);
        expect(isClientAuthPveWatchdogOnlyTick(game)).toBe(false);
    });

    it('includes singleplayer AI-turn classic for watchdog-only tick', () => {
        const game = baseSpGame({ currentPlayer: 2 });
        expect(needsPveMainLoopProcessing(game)).toBe(true);
        expect(isClientAuthPveWatchdogOnlyTick(game)).toBe(true);
    });

    it('detects sp-game id even without isSinglePlayer flag', () => {
        const game = baseSpGame({
            isSinglePlayer: undefined,
            gameCategory: undefined,
            currentPlayer: 1,
        });
        expect(needsPveMainLoopProcessing(game)).toBe(false);
    });
});
