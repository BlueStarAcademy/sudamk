import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameMode, Player, type LiveGameSession } from '../../../types/index.js';
import { clearAiSession, finishAiProcessing, startAiProcessing } from '../../aiSessionManager.js';

const broadcastMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../utils/broadcastItemPhaseSnapshot.js', () => ({
    broadcastItemPhaseSnapshot: (...args: unknown[]) => broadcastMock(...args),
}));

import { tickStrategicItemPhaseIfNeeded } from '../../utils/strategicItemPhaseTick.js';
import { schedulePveStrategicAiTurnIfNeeded } from '../../utils/pveStrategicAiTurnSchedule.js';

const enqueueMock = vi.fn();
vi.mock('../../aiProcessingQueue.js', () => ({
    aiProcessingQueue: {
        enqueue: (...args: unknown[]) => enqueueMock(...args),
    },
}));

function makeAdventureAiGame(overrides: Partial<LiveGameSession> = {}): LiveGameSession {
    return {
        id: 'adv-item-test',
        isAiGame: true,
        gameCategory: 'adventure',
        gameStatus: 'playing',
        mode: GameMode.Hidden,
        currentPlayer: Player.Black,
        blackPlayerId: 'user-1',
        whitePlayerId: 'ai-player-01',
        player1: { id: 'user-1', nickname: 'User' } as LiveGameSession['player1'],
        player2: { id: 'ai-player-01', nickname: 'AI' } as LiveGameSession['player2'],
        moveHistory: [],
        boardState: Array.from({ length: 9 }, () => Array(9).fill(0)),
        settings: { boardSize: 9, hiddenStoneCount: 2 },
        hidden_stones_p1: 2,
        ...overrides,
    } as LiveGameSession;
}

describe('tickStrategicItemPhaseIfNeeded', () => {
    beforeEach(() => {
        broadcastMock.mockClear();
    });

    it('finalizes expired hidden_placing for adventure AI game', async () => {
        const game = makeAdventureAiGame({
            gameStatus: 'hidden_placing',
            itemUseDeadline: Date.now() - 1000,
            pausedTurnTimeLeft: 60,
        });
        const changed = await tickStrategicItemPhaseIfNeeded(game, Date.now());
        expect(changed).toBe(true);
        expect(game.gameStatus).toBe('playing');
        expect(game.hidden_stones_p1).toBe(1);
        expect(broadcastMock).toHaveBeenCalled();
    });

    it('no-ops when not in item phase status', async () => {
        const game = makeAdventureAiGame({ gameStatus: 'playing' });
        const changed = await tickStrategicItemPhaseIfNeeded(game, Date.now());
        expect(changed).toBe(false);
        expect(broadcastMock).not.toHaveBeenCalled();
    });

    it('finalizes expired singleplayer missile_animating via SP missile updater', async () => {
        const startTime = Date.now() - 5000;
        const game = makeAdventureAiGame({
            id: 'sp-missile-tick',
            isSinglePlayer: true,
            isAiGame: true,
            gameCategory: 'singleplayer',
            mode: GameMode.Missile,
            gameStatus: 'missile_animating',
            settings: { boardSize: 9, missileCount: 2 },
            missiles_p1: 1,
            missiles_p2: 2,
            animation: {
                type: 'missile',
                from: { x: 1, y: 1 },
                to: { x: 1, y: 3 },
                player: Player.Black,
                startTime,
                duration: 400,
            } as any,
            lastProcessedMissileAnimationTime: undefined,
        } as any);
        const changed = await tickStrategicItemPhaseIfNeeded(game, Date.now());
        expect(changed).toBe(true);
        expect(game.gameStatus).toBe('playing');
        expect(game.animation).toBeNull();
        expect(broadcastMock).toHaveBeenCalled();
    });
});

describe('schedulePveStrategicAiTurnIfNeeded', () => {
    beforeEach(() => {
        enqueueMock.mockClear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('enqueues adventure AI turn after post-human delay', async () => {
        const game = makeAdventureAiGame({
            currentPlayer: Player.White,
            blackPlayerId: 'user-1',
            whitePlayerId: 'ai-player-01',
        });
        const now = Date.now();
        schedulePveStrategicAiTurnIfNeeded(game, now);
        expect(game.aiTurnStartTime).toBe(now + 1200);
        await vi.runAllTimersAsync();
        expect(enqueueMock).toHaveBeenCalledWith('adv-item-test', undefined, { deferIfProcessing: true });
    });
});

import { maybeRecoverStalledPveAiTurn } from '../../utils/pveAiTurnWatchdog.js';

describe('pveAiTurnWatchdog isAiProcessing guard', () => {
    beforeEach(() => {
        enqueueMock.mockClear();
        clearAiSession('adv-watchdog-test');
    });

    it('does not recover when AI is actively processing', () => {
        const game = makeAdventureAiGame({
            id: 'adv-watchdog-test',
            currentPlayer: Player.White,
            moveHistory: [{ x: 1, y: 1, player: Player.Black }],
        }) as LiveGameSession;
        const now = Date.now();
        (game as any)._pveAiWatchMoveCount = 1;
        (game as any)._pveAiWatchSince = now - 10_000;

        expect(startAiProcessing('adv-watchdog-test')).toBe(true);
        expect(maybeRecoverStalledPveAiTurn(game, now)).toBe(false);
        expect(enqueueMock).not.toHaveBeenCalled();
        finishAiProcessing('adv-watchdog-test', 1);
    });
});
