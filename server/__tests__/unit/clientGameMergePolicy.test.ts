import { describe, expect, it } from 'vitest';
import { mergeGameUpdateByArena } from '../../../utils/clientGameMergePolicy.js';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';

const minimalSession = (overrides: Partial<LiveGameSession>): LiveGameSession =>
    ({
        id: 'g1',
        mode: GameMode.Missile,
        isSinglePlayer: false,
        isAiGame: true,
        gameCategory: 'normal',
        player1: { id: 'p1', username: 'p1', nickname: 'p1' } as any,
        player2: { id: 'p2', username: 'p2', nickname: 'p2' } as any,
        blackPlayerId: 'p1',
        whitePlayerId: 'p2',
        currentPlayer: Player.Black,
        settings: { boardSize: 9, komi: 0.5 },
        boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        ...overrides,
    }) as LiveGameSession;

describe('mergeGameUpdateByArena', () => {
    it('clears stale missile flight animation when server sends playing without animation field', () => {
        const existing = minimalSession({
            gameStatus: 'missile_animating',
            animation: {
                type: 'missile',
                from: { x: 1, y: 1 },
                to: { x: 1, y: 3 },
                player: Player.Black,
                startTime: Date.now(),
                duration: 400,
            } as any,
        });
        const incoming = minimalSession({
            gameStatus: 'playing',
            currentPlayer: Player.Black,
        });
        delete (incoming as any).animation;
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.gameStatus).toBe('playing');
        expect(merged.animation).toBeNull();
    });

    it('does not clear missile animation when incoming explicitly includes it', () => {
        const anim = {
            type: 'missile',
            from: { x: 2, y: 2 },
            to: { x: 2, y: 4 },
            player: Player.White,
            startTime: 1,
            duration: 400,
        };
        const existing = minimalSession({
            gameStatus: 'missile_animating',
            animation: anim as any,
        });
        const incoming = minimalSession({
            gameStatus: 'playing',
            animation: anim as any,
        });
        const merged = mergeGameUpdateByArena(incoming, existing, { source: 'game_update' });
        expect(merged.animation).toEqual(anim);
    });
});
