import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { GameCategory, GameMode, Player } from '../../../shared/types/index.js';
import { createDefaultUser } from '../../initialData.js';
import { SPEED_PER_MOVE_SECONDS } from '../../../shared/constants/speedTimePressure.js';
import {
    shouldTreatTurnDeadlineExpiryAsTimeForfeit,
    isSpeedPerMoveAllowanceDeadline,
} from '../../../shared/utils/speedTimePressureSessionSync.js';

vi.mock('../../summaryService.js', () => ({
    endGame: vi.fn().mockResolvedValue(undefined),
}));

function makeSpeedPvpGame(overrides: Partial<LiveGameSession> = {}): LiveGameSession {
    const p1 = createDefaultUser('p1-id', 'p1', 'P1');
    const p2 = createDefaultUser('p2-id', 'p2', 'P2');
    const now = Date.now();
    const perMoveMs = SPEED_PER_MOVE_SECONDS * 1000;
    return {
        id: 'speed-pvp-1',
        mode: GameMode.Speed,
        settings: {
            boardSize: 9,
            komi: 0.5,
            timeLimit: 10,
            byoyomiCount: 3,
            byoyomiTime: 30,
            timeIncrement: 5,
        },
        player1: p1,
        player2: p2,
        blackPlayerId: p1.id,
        whitePlayerId: p2.id,
        gameStatus: 'playing',
        currentPlayer: Player.Black,
        boardState: Array(9)
            .fill(0)
            .map(() => Array(9).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        winner: null,
        winReason: null,
        createdAt: now,
        lastMove: null,
        passCount: 0,
        round: 0,
        turnInRound: 0,
        koInfo: null,
        blackTimeLeft: 600,
        whiteTimeLeft: 600,
        blackByoyomiPeriodsLeft: 3,
        whiteByoyomiPeriodsLeft: 3,
        turnStartTime: now - perMoveMs - 500,
        turnDeadline: now - 500,
        disconnectionCounts: {},
        currentActionButtons: {},
        scores: {},
        gameCategory: GameCategory.Normal,
        ...overrides,
    } as LiveGameSession;
}

describe('speed PVP turnDeadline timeout guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('detects speed per-move allowance deadline window', () => {
        const now = Date.now();
        const game = makeSpeedPvpGame({
            turnStartTime: now - 11_000,
            turnDeadline: now - 1_000,
        });
        expect(isSpeedPerMoveAllowanceDeadline(game)).toBe(true);
        expect(shouldTreatTurnDeadlineExpiryAsTimeForfeit(game)).toBe(false);
    });

    it('does not treat speed turnDeadline expiry as time forfeit in updateStrategicGameState', async () => {
        const game = makeSpeedPvpGame();
        const { updateStrategicGameState } = await import('../../modes/standard.js');
        const summaryService = await import('../../summaryService.js');

        await updateStrategicGameState(game, Date.now());

        expect(summaryService.endGame).not.toHaveBeenCalled();
        expect(game.gameStatus).toBe('playing');
    });

    it('does not treat speed turnDeadline expiry as time forfeit in updateCaptureState', async () => {
        const game = makeSpeedPvpGame({ mode: GameMode.Capture });
        const { updateCaptureState } = await import('../../modes/capture.js');
        const summaryService = await import('../../summaryService.js');

        updateCaptureState(game, Date.now());

        expect(summaryService.endGame).not.toHaveBeenCalled();
        expect(game.gameStatus).toBe('playing');
    });

    it('does not treat mix+speed turnDeadline expiry as time forfeit', async () => {
        const game = makeSpeedPvpGame({
            mode: GameMode.Mix,
            settings: {
                boardSize: 9,
                komi: 0.5,
                timeLimit: 10,
                byoyomiCount: 3,
                byoyomiTime: 30,
                timeIncrement: 5,
                mixedModes: [GameMode.Speed, GameMode.Capture],
                captureTarget: 20,
            },
        });
        const { updateStrategicGameState } = await import('../../modes/standard.js');
        const summaryService = await import('../../summaryService.js');

        await updateStrategicGameState(game, Date.now());

        expect(summaryService.endGame).not.toHaveBeenCalled();
        expect(game.gameStatus).toBe('playing');
    });

    it('still ends non-speed PVP when turnDeadline passed and no byoyomi', async () => {
        const now = Date.now();
        const game = makeSpeedPvpGame({
            mode: GameMode.Standard,
            settings: {
                boardSize: 9,
                komi: 6.5,
                timeLimit: 1,
                byoyomiCount: 0,
                byoyomiTime: 30,
            },
            turnStartTime: now - 5_000,
            turnDeadline: now - 1_000,
            blackTimeLeft: 0,
            whiteTimeLeft: 60,
            blackByoyomiPeriodsLeft: 0,
            whiteByoyomiPeriodsLeft: 0,
        });
        const { updateStrategicGameState } = await import('../../modes/standard.js');
        const summaryService = await import('../../summaryService.js');

        await updateStrategicGameState(game, Date.now());

        expect(summaryService.endGame).toHaveBeenCalledWith(game, Player.White, 'timeout');
    });

    it('ends speed PVP only when main clock is exhausted', async () => {
        const now = Date.now();
        const game = makeSpeedPvpGame({
            blackTimeLeft: 5,
            turnStartTime: now - 6_000,
            turnDeadline: now - 1_000,
        });
        const { updateStrategicGameState } = await import('../../modes/standard.js');
        const summaryService = await import('../../summaryService.js');

        await updateStrategicGameState(game, Date.now());

        expect(summaryService.endGame).toHaveBeenCalledWith(game, Player.White, 'timeout');
    });
});
