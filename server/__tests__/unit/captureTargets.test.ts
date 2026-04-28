import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../types/index.js';
import { getCaptureTargetWinner } from '../../utils/captureTargets.js';

const baseGame = (overrides: Record<string, unknown> = {}) => ({
    id: 'capture-target-test',
    gameStatus: 'playing',
    gameCategory: GameCategory.Adventure,
    mode: GameMode.Capture,
    settings: { captureTarget: 20 },
    captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
    ...overrides,
}) as any;

describe('capture target winner detection', () => {
    it('detects adventure capture target immediately from effective targets', () => {
        const game = baseGame({
            effectiveCaptureTargets: {
                [Player.None]: 0,
                [Player.Black]: 7,
                [Player.White]: 9,
            },
            captures: {
                [Player.None]: 0,
                [Player.Black]: 7,
                [Player.White]: 0,
            },
        });

        expect(getCaptureTargetWinner(game, Player.White)).toBe(Player.Black);
    });

    it('does not end tower auto-scoring stages by stale capture targets', () => {
        const game = baseGame({
            gameCategory: GameCategory.Tower,
            settings: { autoScoringTurns: 40, captureTarget: 5 },
            captures: {
                [Player.None]: 0,
                [Player.Black]: 10,
                [Player.White]: 0,
            },
        });

        expect(getCaptureTargetWinner(game, Player.Black)).toBeNull();
    });

    it('ends mix speed+capture when speed bonus reaches capture target', () => {
        const game = baseGame({
            gameCategory: GameCategory.Normal,
            mode: GameMode.Mix,
            settings: {
                captureTarget: 20,
                mixedModes: [GameMode.Speed, GameMode.Capture],
                __speedBonusConsumedSec: { black: 200, white: 0 },
            },
            captures: {
                [Player.None]: 0,
                [Player.Black]: 0,
                [Player.White]: 0,
            },
        });

        // 흑이 200초를 사용 -> 백 시간 보너스 +20, 목표 20 도달로 즉시 백 승리
        expect(getCaptureTargetWinner(game, Player.Black)).toBe(Player.White);
    });

    it('ignores AI used time in AI mix speed+capture games', () => {
        const game = baseGame({
            gameCategory: GameCategory.Normal,
            mode: GameMode.Mix,
            isAiGame: true,
            player1: { id: 'human-user' },
            player2: { id: 'ai-bot' },
            blackPlayerId: 'human-user',
            whitePlayerId: 'ai-bot',
            settings: {
                captureTarget: 20,
                mixedModes: [GameMode.Speed, GameMode.Capture],
                __speedBonusConsumedSec: { black: 0, white: 200 },
            },
            captures: {
                [Player.None]: 0,
                [Player.Black]: 0,
                [Player.White]: 0,
            },
        });

        // AI(백)가 200초 사용해도 유저(흑) 보너스는 무시되어 즉시 종료되지 않아야 한다.
        expect(getCaptureTargetWinner(game, Player.White)).toBeNull();
    });
});
