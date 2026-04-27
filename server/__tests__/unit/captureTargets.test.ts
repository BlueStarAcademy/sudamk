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
});
