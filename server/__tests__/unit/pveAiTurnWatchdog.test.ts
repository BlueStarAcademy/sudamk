import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameMode, Player, type LiveGameSession } from '../../../types/index.js';
import { PVE_AI_SERVER_WATCHDOG_MS } from '../../constants/pveStrategicAiSchedule.js';
import { clearAiSession, finishAiProcessing, startAiProcessing } from '../../aiSessionManager.js';

const enqueueMock = vi.fn();

vi.mock('../../aiProcessingQueue.js', () => ({
    aiProcessingQueue: {
        enqueue: (...args: unknown[]) => enqueueMock(...args),
    },
}));

import {
    isPveAiWatchdogGame,
    maybeRecoverStalledPveAiTurn,
    needsPveAiWatchdogTick,
} from '../../utils/pveAiTurnWatchdog.js';

function makeStrategicPveGame(overrides: Partial<LiveGameSession> = {}): LiveGameSession {
    return {
        id: 'pve-watchdog-test',
        isAiGame: true,
        isSinglePlayer: true,
        gameCategory: 'singleplayer',
        gameStatus: 'playing',
        mode: GameMode.Standard,
        currentPlayer: Player.White,
        blackPlayerId: 'user-1',
        whitePlayerId: 'ai-player-01',
        moveHistory: [{ x: 3, y: 3, player: Player.Black }],
        boardState: Array.from({ length: 19 }, () => Array(19).fill(0)),
        settings: { boardSize: 19 },
        ...overrides,
    } as LiveGameSession;
}

describe('pveAiTurnWatchdog', () => {
    beforeEach(() => {
        enqueueMock.mockClear();
        clearAiSession('pve-watchdog-test');
    });

    it('includes PVE AI games in main loop tick', () => {
        expect(needsPveAiWatchdogTick(makeStrategicPveGame())).toBe(true);
        expect(
            needsPveAiWatchdogTick(
                makeStrategicPveGame({
                    currentPlayer: Player.Black,
                    blackPlayerId: 'user-1',
                    whitePlayerId: 'ai-player-01',
                }),
            ),
        ).toBe(false);
        expect(
            needsPveAiWatchdogTick(
                makeStrategicPveGame({
                    isSinglePlayer: false,
                    gameCategory: 'normal',
                    isAiGame: true,
                    mode: GameMode.Dice,
                    gameStatus: 'dice_placing',
                }),
            ),
        ).toBe(true);
        expect(
            needsPveAiWatchdogTick(
                makeStrategicPveGame({
                    isAiGame: false,
                    isSinglePlayer: false,
                    gameCategory: 'guildwar',
                }),
            ),
        ).toBe(true);
        expect(
            needsPveAiWatchdogTick(
                makeStrategicPveGame({ isAiGame: false, settings: { pairGame: { pairMode: 'pvp' } } }),
            ),
        ).toBe(false);
    });

    it('starts watch snapshot on AI turn without recovering immediately', () => {
        const game = makeStrategicPveGame();
        const now = 10_000;
        expect(maybeRecoverStalledPveAiTurn(game, now)).toBe(false);
        expect((game as any)._pveAiWatchSince).toBe(now);
        expect(enqueueMock).not.toHaveBeenCalled();
    });

    it('watches guild war AI turns even if isAiGame metadata is missing', () => {
        const game = makeStrategicPveGame({
            isAiGame: false,
            isSinglePlayer: false,
            gameCategory: 'guildwar',
        });
        const now = 12_000;

        expect(isPveAiWatchdogGame(game)).toBe(true);
        expect(maybeRecoverStalledPveAiTurn(game, now)).toBe(false);
        expect((game as any)._pveAiWatchSince).toBe(now);
    });

    it('does not recover when AI is actively processing (startAiProcessing)', () => {
        const game = makeStrategicPveGame();
        const stalledSince = 1_000;
        const now = stalledSince + PVE_AI_SERVER_WATCHDOG_MS + 100;
        (game as any)._pveAiWatchMoveCount = game.moveHistory?.length ?? 0;
        (game as any)._pveAiWatchPairKey = null;
        (game as any)._pveAiWatchSince = stalledSince;
        finishAiProcessing(game.id, game.moveHistory?.length ?? 0);
        startAiProcessing(game.id);
        (game as any)._aiMoveDispatching = true;

        expect(maybeRecoverStalledPveAiTurn(game, now)).toBe(false);
        expect(enqueueMock).not.toHaveBeenCalled();
        finishAiProcessing(game.id, game.moveHistory?.length ?? 0);
    });

    it('recovers stalled AI turn after watchdog threshold when not processing', () => {
        const game = makeStrategicPveGame();
        const stalledSince = 1_000;
        const now = stalledSince + PVE_AI_SERVER_WATCHDOG_MS + 100;
        (game as any)._pveAiWatchMoveCount = game.moveHistory?.length ?? 0;
        (game as any)._pveAiWatchPairKey = null;
        (game as any)._pveAiWatchSince = stalledSince;
        finishAiProcessing(game.id, game.moveHistory?.length ?? 0);
        (game as any)._aiMoveDispatching = true;

        expect(maybeRecoverStalledPveAiTurn(game, now)).toBe(true);
        expect(enqueueMock).toHaveBeenCalledWith('pve-watchdog-test');
        expect((game as any)._aiMoveDispatching).toBe(false);
        expect(game.aiTurnStartTime).toBe(now);
    });

    it('does not recover when moveHistory advances', () => {
        const game = makeStrategicPveGame({ moveHistory: [] });
        const now = 20_000;
        (game as any)._pveAiWatchMoveCount = 0;
        (game as any)._pveAiWatchSince = now - PVE_AI_SERVER_WATCHDOG_MS - 500;
        game.moveHistory = [{ x: 1, y: 1, player: Player.Black }];

        expect(maybeRecoverStalledPveAiTurn(game, now)).toBe(false);
        expect(enqueueMock).not.toHaveBeenCalled();
        expect((game as any)._pveAiWatchSince).toBe(now);
    });

    it('skips manually paused strategic AI lobby games', () => {
        const game = makeStrategicPveGame({
            isSinglePlayer: false,
            gameCategory: 'normal',
            pausedTurnTimeLeft: 30,
            turnDeadline: undefined,
            itemUseDeadline: undefined,
        });
        const now = 50_000;
        (game as any)._pveAiWatchSince = now - PVE_AI_SERVER_WATCHDOG_MS - 1;

        expect(isPveAiWatchdogGame(game)).toBe(true);
        expect(maybeRecoverStalledPveAiTurn(game, now)).toBe(false);
        expect(enqueueMock).not.toHaveBeenCalled();
    });

    it('skips hidden_reveal_animating on kata-server PVE arenas', () => {
        const game = makeStrategicPveGame({
            isSinglePlayer: false,
            gameCategory: 'adventure',
            gameStatus: 'hidden_reveal_animating',
        });
        const now = 60_000;
        (game as any)._pveAiWatchSince = now - PVE_AI_SERVER_WATCHDOG_MS - 1;

        expect(maybeRecoverStalledPveAiTurn(game, now)).toBe(false);
        expect(enqueueMock).not.toHaveBeenCalled();
    });

    it('recovers playful dice_placing AI turn', () => {
        const game = makeStrategicPveGame({
            isSinglePlayer: false,
            gameCategory: 'normal',
            mode: GameMode.Dice,
            gameStatus: 'dice_placing',
            moveHistory: undefined,
        });
        const now = 70_000;
        (game as any)._pveAiWatchMoveCount = 0;
        (game as any)._pveAiWatchSince = now - PVE_AI_SERVER_WATCHDOG_MS - 1;

        expect(maybeRecoverStalledPveAiTurn(game, now)).toBe(true);
        expect(enqueueMock).toHaveBeenCalledWith('pve-watchdog-test');
    });
});
