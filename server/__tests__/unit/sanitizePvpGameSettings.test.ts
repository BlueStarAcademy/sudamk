import { describe, it, expect } from 'vitest';
import { GameMode } from '../../../types/index.js';
import {
    sanitizePvpGameSettings,
    stripHumanPvpTurnLimitFields,
    modeIncludesCaptureRuleForSettings,
} from '../../../shared/utils/sanitizePvpGameSettings.js';

describe('sanitizePvpGameSettings', () => {
    it('strips scoringTurnLimit for human PVP standard', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Standard,
            { boardSize: 19, komi: 6.5, scoringTurnLimit: 120, timeLimit: 10 },
            { isAiGame: false },
        );
        expect(out.scoringTurnLimit).toBe(0);
        expect((out as { autoScoringTurns?: number }).autoScoringTurns).toBeUndefined();
    });

    it('keeps AI scoringTurnLimit when missing', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Standard,
            { boardSize: 9, komi: 6.5, timeLimit: 10 },
            { isAiGame: true },
        );
        expect(out.scoringTurnLimit).toBeGreaterThan(0);
    });

    it('forces capture settings and no turn limit for human capture', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Capture,
            { boardSize: 13, captureTarget: 20, scoringTurnLimit: 80 },
            { isAiGame: false },
        );
        expect(out.scoringTurnLimit).toBe(0);
        expect(out.captureTarget).toBe(20);
    });

    it('sets base komi and baseStones for base mode', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Base,
            { boardSize: 13, komi: 6.5, baseStones: 4 },
            { isAiGame: false },
        );
        expect(out.komi).toBe(0.5);
        expect(out.baseStones).toBe(4);
    });

    it('clears byoyomi for speed human PVP', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Speed,
            { boardSize: 13, komi: 6.5, byoyomiCount: 3, byoyomiTime: 30, timeLimit: 1, timeIncrement: 5 },
            { isAiGame: false },
        );
        expect(out.byoyomiCount).toBe(0);
        expect(out.byoyomiTime).toBe(10);
        expect(out.timeIncrement).toBe(0);
        expect(out.scoringTurnLimit).toBe(0);
    });

    it('clears fischer increment for speed', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Speed,
            { boardSize: 13, komi: 6.5, timeLimit: 1, timeIncrement: 99 },
            { isAiGame: false },
        );
        expect(out.timeIncrement).toBe(0);
    });
});

describe('stripHumanPvpTurnLimitFields', () => {
    it('zeroes scoringTurnLimit and removes autoScoringTurns', () => {
        const out = stripHumanPvpTurnLimitFields({ scoringTurnLimit: 50, autoScoringTurns: 40 } as any);
        expect(out.scoringTurnLimit).toBe(0);
        expect((out as { autoScoringTurns?: number }).autoScoringTurns).toBeUndefined();
    });
});

describe('modeIncludesCaptureRuleForSettings', () => {
    it('detects mix with capture', () => {
        expect(
            modeIncludesCaptureRuleForSettings(GameMode.Mix, {
                mixedModes: [GameMode.Capture, GameMode.Speed],
            }),
        ).toBe(true);
    });
});
