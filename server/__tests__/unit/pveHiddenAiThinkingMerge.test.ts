import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import {
    mergeGameUpdateByArena,
    preservePveAiHiddenPresentationOnMerge,
} from '../../../utils/clientGameMergePolicy.js';

const board9 = () =>
    Array.from({ length: 9 }, (_, y) =>
        Array.from({ length: 9 }, (_, x) => (x === 4 && y === 4 ? Player.Black : Player.None)),
    );

const minimal = (overrides: Partial<LiveGameSession>): LiveGameSession =>
    ({
        id: 'adv-hidden-1',
        mode: GameMode.Hidden,
        isAiGame: true,
        isSinglePlayer: false,
        gameCategory: 'adventure',
        blackPlayerId: 'user-1',
        whitePlayerId: 'ai-player-01',
        currentPlayer: Player.White,
        settings: { boardSize: 9, hiddenStoneCount: 2 },
        boardState: board9(),
        moveHistory: [{ x: 4, y: 4, player: Player.Black }],
        ...overrides,
    }) as LiveGameSession;

describe('preservePveAiHiddenPresentationOnMerge', () => {
    it('keeps board and moveHistory when adventure ai_thinking packet omits boardState', () => {
        const endTime = Date.now() + 4000;
        const existing = minimal({
            gameStatus: 'playing',
            animation: {
                type: 'ai_thinking',
                startTime: Date.now(),
                duration: 4000,
                playerId: 'ai-player-01',
            } as any,
            aiHiddenItemAnimationEndTime: endTime,
        });
        const incoming = minimal({
            gameStatus: 'playing',
            animation: {
                type: 'ai_thinking',
                startTime: Date.now(),
                duration: 4000,
                playerId: 'ai-player-01',
            } as any,
            aiHiddenItemAnimationEndTime: endTime,
        });
        delete (incoming as any).boardState;
        delete (incoming as any).moveHistory;

        const merged = preservePveAiHiddenPresentationOnMerge(incoming, existing);
        expect(merged.boardState).toEqual(existing.boardState);
        expect(merged.moveHistory).toEqual(existing.moveHistory);
        expect((merged as any).aiHiddenItemAnimationEndTime).toBe(endTime);
    });

    it('guildwar keeps active ai_thinking when slim playing packet omits animation', () => {
        const endTime = Date.now() + 5000;
        const existing = minimal({
            gameCategory: 'guildwar',
            gameStatus: 'playing',
            animation: {
                type: 'ai_thinking',
                startTime: Date.now(),
                duration: 5000,
                playerId: 'ai-player-01',
            } as any,
            aiHiddenItemAnimationEndTime: endTime,
        });
        const incoming = minimal({
            gameCategory: 'guildwar',
            gameStatus: 'playing',
        });
        delete (incoming as any).animation;

        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.animation).toEqual(existing.animation);
        expect((merged as { aiHiddenItemAnimationEndTime?: number }).aiHiddenItemAnimationEndTime).toBe(endTime);
    });
});
