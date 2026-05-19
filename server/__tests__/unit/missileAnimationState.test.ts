import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { updateMissileState } from '../../modes/missile.js';
import { updateSinglePlayerMissileState } from '../../modes/singlePlayerMissile.js';

const minimalMissileAnimatingGame = (overrides: Partial<LiveGameSession> = {}): LiveGameSession => {
    const startTime = 1000;
    return {
        id: 'missile-test',
        mode: GameMode.Missile,
        gameCategory: 'normal',
        isSinglePlayer: false,
        isAiGame: false,
        gameStatus: 'missile_animating',
        currentPlayer: Player.Black,
        player1: { id: 'p1', username: 'p1', nickname: 'p1' } as any,
        player2: { id: 'p2', username: 'p2', nickname: 'p2' } as any,
        blackPlayerId: 'p1',
        whitePlayerId: 'p2',
        settings: { boardSize: 9, komi: 0.5, missileCount: 3 },
        boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        animation: {
            type: 'missile',
            from: { x: 1, y: 1 },
            to: { x: 1, y: 3 },
            player: Player.Black,
            startTime,
            duration: 400,
        } as any,
        lastProcessedMissileAnimationTime: startTime,
        ...overrides,
    } as LiveGameSession;
};

describe('updateMissileState', () => {
    it('returns true when cleaning duplicate-processed missile animation so main loop broadcasts', () => {
        const game = minimalMissileAnimatingGame();
        const changed = updateMissileState(game, 5000);
        expect(changed).toBe(true);
        expect(game.gameStatus).toBe('playing');
        expect(game.animation).toBeNull();
    });

    it('returns true when missile_animating has no animation payload', () => {
        const game = minimalMissileAnimatingGame({ animation: null as any });
        const changed = updateMissileState(game, 5000);
        expect(changed).toBe(true);
        expect(game.gameStatus).toBe('playing');
    });
});

describe('updateSinglePlayerMissileState', () => {
    it('restores playing state and consumes one missile when selection times out', async () => {
        const game = minimalMissileAnimatingGame({
            id: 'sp-missile-timeout',
            isSinglePlayer: true,
            gameCategory: GameCategory.SinglePlayer,
            gameStatus: 'missile_selecting',
            animation: null as any,
            itemUseDeadline: 2000,
            pausedTurnTimeLeft: 12,
            turnDeadline: undefined,
            turnStartTime: undefined,
            missiles_p1: 2,
            missiles_p2: 3,
        });

        const changed = await updateSinglePlayerMissileState(game, 2500);

        expect(changed).toBe(true);
        expect(game.gameStatus).toBe('playing');
        expect(game.itemUseDeadline).toBeUndefined();
        expect(game.pausedTurnTimeLeft).toBeUndefined();
        expect(game.missiles_p1).toBe(1);
        expect(game.missiles_p2).toBe(3);
        expect(game.blackTimeLeft).toBe(12);
    });
});
