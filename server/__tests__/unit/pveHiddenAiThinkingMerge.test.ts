import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import {
    mergeGameUpdateByArena,
    preservePveAiHiddenPresentationOnMerge,
    shouldAcceptAuthoritativePveAiHistoryAdvance,
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

    it('keeps longer incoming moveHistory when ai_thinking slim packet omits board', () => {
        const endTime = Date.now() + 4000;
        const existing = minimal({
            gameStatus: 'playing',
            currentPlayer: Player.White,
            animation: {
                type: 'ai_thinking',
                startTime: Date.now(),
                duration: 4000,
                playerId: 'ai-player-01',
            } as any,
            aiHiddenItemAnimationEndTime: endTime,
            moveHistory: [{ x: 4, y: 4, player: Player.Black }],
        });
        const incoming = minimal({
            gameStatus: 'playing',
            currentPlayer: Player.Black,
            animation: {
                type: 'ai_thinking',
                startTime: Date.now(),
                duration: 4000,
                playerId: 'ai-player-01',
            } as any,
            aiHiddenItemAnimationEndTime: endTime,
            moveHistory: [
                { x: 4, y: 4, player: Player.Black },
                { x: 3, y: 3, player: Player.White },
            ],
        });
        delete (incoming as any).boardState;

        const merged = preservePveAiHiddenPresentationOnMerge(incoming, existing);
        expect(merged.moveHistory).toHaveLength(2);
        expect(merged.moveHistory?.[1]).toEqual({ x: 3, y: 3, player: Player.White });
        expect(merged.boardState?.[3]?.[3]).toBe(Player.White);
        expect(merged.currentPlayer).toBe(Player.Black);
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

    it('does not keep expired ai_thinking leftover over a placement packet with board', () => {
        const expired = Date.now() - 1000;
        const existing = minimal({
            gameStatus: 'playing',
            currentPlayer: Player.White,
            animation: {
                type: 'ai_thinking',
                startTime: expired - 4000,
                duration: 4000,
                playerId: 'ai-player-01',
            } as any,
            aiHiddenItemAnimationEndTime: expired,
            moveHistory: [{ x: 4, y: 4, player: Player.Black }],
        });
        const board = board9();
        board[3][3] = Player.White;
        const incoming = minimal({
            gameStatus: 'playing',
            currentPlayer: Player.Black,
            animation: null,
            aiHiddenItemAnimationEndTime: undefined,
            boardState: board,
            moveHistory: [
                { x: 4, y: 4, player: Player.Black },
                { x: 3, y: 3, player: Player.White },
            ],
        });

        const merged = preservePveAiHiddenPresentationOnMerge(incoming, existing);
        expect(merged.moveHistory).toHaveLength(2);
        expect(merged.boardState?.[3]?.[3]).toBe(Player.White);
        expect(merged.currentPlayer).toBe(Player.Black);
        expect(merged.animation).toBeNull();
        expect((merged as { aiHiddenItemAnimationEndTime?: number }).aiHiddenItemAnimationEndTime).toBeUndefined();
    });

    it('accepts longer adventure AI history as authoritative', () => {
        const existing = minimal({
            moveHistory: [{ x: 4, y: 4, player: Player.Black }],
        });
        const incoming = minimal({
            currentPlayer: Player.Black,
            moveHistory: [
                { x: 4, y: 4, player: Player.Black },
                { x: 2, y: 2, player: Player.White },
            ],
        });
        expect(shouldAcceptAuthoritativePveAiHistoryAdvance(incoming, existing)).toBe(true);
        expect(
            shouldAcceptAuthoritativePveAiHistoryAdvance(
                minimal({
                    isAiGame: false,
                    gameCategory: undefined,
                    moveHistory: [
                        { x: 4, y: 4, player: Player.Black },
                        { x: 2, y: 2, player: Player.White },
                    ],
                }),
                existing,
            ),
        ).toBe(false);
    });
});
