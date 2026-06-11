import { describe, expect, it } from 'vitest';
import { GameMode } from '../../../shared/types/enums.js';
import {
    applyMixModeSettingsConstraints,
    getMixBoardSizeOptions,
    isMixSubModeCheckboxDisabled,
    normalizeMixedModesSelection,
} from '../../../shared/utils/mixModeSettings.js';

describe('normalizeMixedModesSelection', () => {
    it('removes castle when capture is added', () => {
        expect(
            normalizeMixedModesSelection([GameMode.Hidden, GameMode.Castle], GameMode.Capture, true),
        ).toEqual([GameMode.Hidden, GameMode.Capture]);
    });

    it('removes capture when castle is added', () => {
        expect(
            normalizeMixedModesSelection([GameMode.Speed, GameMode.Capture], GameMode.Castle, true),
        ).toEqual([GameMode.Speed, GameMode.Castle]);
    });
});

describe('isMixSubModeCheckboxDisabled', () => {
    it('disables capture when castle selected and vice versa', () => {
        expect(isMixSubModeCheckboxDisabled([GameMode.Castle, GameMode.Hidden], GameMode.Capture)).toBe(true);
        expect(isMixSubModeCheckboxDisabled([GameMode.Capture], GameMode.Castle)).toBe(true);
        expect(isMixSubModeCheckboxDisabled([GameMode.Hidden], GameMode.Capture)).toBe(false);
    });
});

describe('applyMixModeSettingsConstraints', () => {
    it('forces 13-line board when chess is included', () => {
        const out = applyMixModeSettingsConstraints({
            mixedModes: [GameMode.Chess, GameMode.Hidden],
            boardSize: 9,
            komi: 2.5,
        } as any);
        expect(out.boardSize).toBe(13);
        expect(out.komi).toBe(6.5);
    });

    it('strips castle when both capture and castle remain', () => {
        const out = applyMixModeSettingsConstraints({
            mixedModes: [GameMode.Capture, GameMode.Castle],
            boardSize: 13,
        } as any);
        expect(out.mixedModes).toEqual([GameMode.Capture]);
    });
});

describe('getMixBoardSizeOptions', () => {
    it('returns only 13 when chess is in mix', () => {
        expect(getMixBoardSizeOptions([GameMode.Chess, GameMode.Missile])).toEqual([13]);
    });

    it('returns special sizes without chess', () => {
        expect(getMixBoardSizeOptions([GameMode.Hidden, GameMode.Speed])).toEqual([9, 11, 13]);
    });
});
