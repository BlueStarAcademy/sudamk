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

    it('removes base when chess is added', () => {
        expect(
            normalizeMixedModesSelection([GameMode.Hidden, GameMode.Base], GameMode.Chess, true),
        ).toEqual([GameMode.Hidden, GameMode.Chess]);
    });

    it('removes chess when base is added', () => {
        expect(
            normalizeMixedModesSelection([GameMode.Hidden, GameMode.Chess], GameMode.Base, true),
        ).toEqual([GameMode.Hidden, GameMode.Base]);
    });
});

describe('isMixSubModeCheckboxDisabled', () => {
    it('disables capture when castle selected and vice versa', () => {
        expect(isMixSubModeCheckboxDisabled([GameMode.Castle, GameMode.Hidden], GameMode.Capture)).toBe(true);
        expect(isMixSubModeCheckboxDisabled([GameMode.Capture], GameMode.Castle)).toBe(true);
        expect(isMixSubModeCheckboxDisabled([GameMode.Hidden], GameMode.Capture)).toBe(false);
    });

    it('disables chess when base selected and vice versa', () => {
        expect(isMixSubModeCheckboxDisabled([GameMode.Base, GameMode.Hidden], GameMode.Chess)).toBe(true);
        expect(isMixSubModeCheckboxDisabled([GameMode.Chess], GameMode.Base)).toBe(true);
        expect(isMixSubModeCheckboxDisabled([GameMode.Hidden], GameMode.Chess)).toBe(false);
    });
});

describe('applyMixModeSettingsConstraints', () => {
    it('forces valid chess board size when chess is included', () => {
        const out = applyMixModeSettingsConstraints({
            mixedModes: [GameMode.Chess, GameMode.Hidden],
            boardSize: 19,
            komi: 2.5,
        } as any);
        expect(out.boardSize).toBe(9);
        expect(out.komi).toBe(2.5);
    });

    it('strips castle when both capture and castle remain', () => {
        const out = applyMixModeSettingsConstraints({
            mixedModes: [GameMode.Capture, GameMode.Castle],
            boardSize: 13,
        } as any);
        expect(out.mixedModes).toEqual([GameMode.Capture]);
    });

    it('strips base when both chess and base remain', () => {
        const out = applyMixModeSettingsConstraints({
            mixedModes: [GameMode.Chess, GameMode.Base, GameMode.Hidden],
            boardSize: 13,
        } as any);
        expect(out.mixedModes).toEqual([GameMode.Chess, GameMode.Hidden]);
    });
});

describe('getMixBoardSizeOptions', () => {
    it('returns chess board sizes when chess is in mix', () => {
        expect(getMixBoardSizeOptions([GameMode.Chess, GameMode.Missile])).toEqual([9, 13]);
    });

    it('returns special sizes without chess', () => {
        expect(getMixBoardSizeOptions([GameMode.Hidden, GameMode.Speed])).toEqual([9, 11, 13]);
    });
});
