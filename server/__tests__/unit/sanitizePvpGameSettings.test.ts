import { describe, it, expect } from 'vitest';
import { GameMode, GameSettings } from '../../../types/index.js';
import {
    sanitizePvpGameSettings,
    stripHumanPvpTurnLimitFields,
    modeIncludesCaptureRuleForSettings,
} from '../../../shared/utils/sanitizePvpGameSettings.js';

describe('sanitizePvpGameSettings', () => {
    it('strips scoringTurnLimit for casual human PVP standard without preset limit', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Standard,
            { boardSize: 19, komi: 6.5, timeLimit: 10 },
            { isAiGame: false },
        );
        expect(out.scoringTurnLimit).toBe(0);
        expect((out as { autoScoringTurns?: number }).autoScoringTurns).toBeUndefined();
    });

    it('keeps scoringTurnLimit for human PVP ranked preset', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Standard,
            { boardSize: 19, komi: 6.5, scoringTurnLimit: 200, timeLimit: 5, byoyomiTime: 30, byoyomiCount: 3 },
            { isAiGame: false },
        );
        expect(out.boardSize).toBe(19);
        expect(out.scoringTurnLimit).toBe(200);
        expect((out as { autoScoringTurns?: number }).autoScoringTurns).toBeUndefined();
    });

    it('strips all clock fields for AI games', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Standard,
            { boardSize: 19, komi: 6.5, timeLimit: 10, byoyomiTime: 30, byoyomiCount: 3, timeIncrement: 5 },
            { isAiGame: true },
        );
        expect(out.timeLimit).toBe(0);
        expect(out.byoyomiTime).toBe(0);
        expect(out.byoyomiCount).toBe(0);
        expect(out.timeIncrement).toBe(0);
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

    it('preserves byoyomi main time control for speed human PVP', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Speed,
            { boardSize: 13, komi: 6.5, byoyomiCount: 3, byoyomiTime: 30, timeLimit: 1, timeIncrement: 0 },
            { isAiGame: false },
        );
        expect(out.byoyomiCount).toBe(3);
        expect(out.byoyomiTime).toBe(30);
        expect(out.timeIncrement).toBe(0);
        expect(out.scoringTurnLimit).toBe(0);
    });

    it('preserves fischer main time control for speed', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Speed,
            { boardSize: 13, komi: 6.5, timeLimit: 1, timeIncrement: 15 },
            { isAiGame: false },
        );
        expect(out.timeIncrement).toBe(15);
        expect(out.byoyomiCount).toBe(0);
        expect(out.byoyomiTime).toBe(0);
    });

    it('normalizes fischer for standard human PVP', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Standard,
            { boardSize: 19, komi: 6.5, timeLimit: 10, timeIncrement: 10, byoyomiTime: 30, byoyomiCount: 3 },
            { isAiGame: false },
        );
        expect(out.timeIncrement).toBe(10);
        expect(out.byoyomiCount).toBe(0);
        expect(out.byoyomiTime).toBe(0);
    });

    it('fischer raises timeLimit from 0 to minimum 1 minute', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Standard,
            { boardSize: 19, komi: 6.5, timeLimit: 0, timeIncrement: 5 },
            { isAiGame: false },
        );
        expect(out.timeLimit).toBe(1);
        expect(out.timeIncrement).toBe(5);
    });

    it('fischer speed preserves timeLimit when already >= 1', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Speed,
            { boardSize: 13, komi: 6.5, timeLimit: 3, timeIncrement: 10 },
            { isAiGame: false },
        );
        expect(out.timeLimit).toBe(3);
        expect(out.timeIncrement).toBe(10);
    });
});

describe('stripHumanPvpTurnLimitFields', () => {
    it('zeroes scoringTurnLimit and removes autoScoringTurns', () => {
        const out = stripHumanPvpTurnLimitFields({ scoringTurnLimit: 50, autoScoringTurns: 40 } as any);
        expect(out.scoringTurnLimit).toBe(0);
        expect((out as { autoScoringTurns?: number }).autoScoringTurns).toBeUndefined();
    });

    it('forces ranked castle preset', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Castle,
            { boardSize: 9, komi: 2.5, castleCount: 1, timeLimit: 10 },
            { isRanked: true },
        );
        expect(out.boardSize).toBe(13);
        expect(out.komi).toBe(6.5);
        expect(out.castleCount).toBe(4);
        expect(out.timeLimit).toBe(5);
        expect(out.byoyomiTime).toBe(30);
        expect(out.byoyomiCount).toBe(3);
    });

    it('clamps casual castle board and count', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Castle,
            { boardSize: 19 as GameSettings['boardSize'], castleCount: 5 as unknown as 1, komi: 6.5 },
            { isAiGame: false },
        );
        expect(out.boardSize).toBe(9);
        expect(out.castleCount).toBe(3);
        expect(out.scoringTurnLimit).toBe(0);
    });

    it('clamps 13-line castle count to 3–6', () => {
        const low = sanitizePvpGameSettings(
            GameMode.Castle,
            { boardSize: 13, castleCount: 1 as GameSettings['castleCount'], komi: 6.5 },
            { isAiGame: false },
        );
        expect(low.castleCount).toBe(3);

        const high = sanitizePvpGameSettings(
            GameMode.Castle,
            { boardSize: 13, castleCount: 9 as unknown as GameSettings['castleCount'], komi: 6.5 },
            { isAiGame: false },
        );
        expect(high.castleCount).toBe(6);
    });

    it('strips scoring turn limit for castle AI games', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Castle,
            { boardSize: 13, komi: 6.5, castleCount: 2, scoringTurnLimit: 120 },
            { isAiGame: true },
        );
        expect(out.scoringTurnLimit).toBe(0);
        expect((out as { autoScoringTurns?: number }).autoScoringTurns).toBeUndefined();
    });

    it('mix: excludes castle+capture together and locks 13 board with chess', () => {
        const out = sanitizePvpGameSettings(
            GameMode.Mix,
            {
                mixedModes: [GameMode.Capture, GameMode.Castle, GameMode.Chess],
                boardSize: 9,
                komi: 2.5,
            } as GameSettings,
            { isAiGame: false },
        );
        expect(out.mixedModes).toEqual([GameMode.Capture, GameMode.Chess]);
        expect(out.boardSize).toBe(13);
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
