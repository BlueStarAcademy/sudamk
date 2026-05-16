import { describe, expect, it } from 'vitest';
import { GameMode } from '../../../shared/types/enums.js';
import {
    mixGoIsCombinableSubMode,
    mixGoIsMixWithEverySubMode,
    mixGoOrPureModeIncludes,
    mixGoUniqueCombinableModes,
} from '../../../shared/utils/mixGoRules.js';

describe('mixGoRules', () => {
    it('mixGoOrPureModeIncludes: pure or mix member', () => {
        expect(mixGoOrPureModeIncludes(GameMode.Hidden, [], GameMode.Hidden)).toBe(true);
        expect(mixGoOrPureModeIncludes(GameMode.Mix, [GameMode.Hidden], GameMode.Hidden)).toBe(true);
        expect(mixGoOrPureModeIncludes(GameMode.Mix, [GameMode.Capture], GameMode.Hidden)).toBe(false);
        expect(mixGoOrPureModeIncludes(GameMode.Standard, undefined, GameMode.Capture)).toBe(false);
    });

    it('mixGoIsMixWithEverySubMode', () => {
        expect(
            mixGoIsMixWithEverySubMode(GameMode.Mix, [GameMode.Base, GameMode.Capture], [GameMode.Base, GameMode.Capture]),
        ).toBe(true);
        expect(mixGoIsMixWithEverySubMode(GameMode.Mix, [GameMode.Base], [GameMode.Base, GameMode.Capture])).toBe(false);
        expect(mixGoIsMixWithEverySubMode(GameMode.Base, [GameMode.Base], [GameMode.Base])).toBe(false);
        expect(mixGoIsMixWithEverySubMode(GameMode.Mix, [], [])).toBe(false);
    });

    it('mixGoUniqueCombinableModes filters non-go playful modes', () => {
        expect(
            mixGoUniqueCombinableModes([GameMode.Capture, GameMode.Dice, GameMode.Capture, GameMode.Hidden]),
        ).toEqual([GameMode.Capture, GameMode.Hidden]);
    });

    it('mixGoIsCombinableSubMode', () => {
        expect(mixGoIsCombinableSubMode(GameMode.Missile)).toBe(true);
        expect(mixGoIsCombinableSubMode(GameMode.Dice)).toBe(false);
    });
});
