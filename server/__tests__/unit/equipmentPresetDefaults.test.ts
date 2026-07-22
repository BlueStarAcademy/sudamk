import { describe, expect, it } from 'vitest';
import {
    createEmptyEquipmentPresets,
    defaultEquipmentPresetName,
    migrateEquipmentPresetDefaultNames,
    migrateLegacyDefaultEquipmentPresetName,
} from '../../../shared/utils/equipmentPresetDefaults.js';

describe('equipmentPresetDefaults', () => {
    it('uses 장비세트 N as default name', () => {
        expect(defaultEquipmentPresetName(1)).toBe('장비세트 1');
        expect(createEmptyEquipmentPresets().map((p) => p.name)).toEqual([
            '장비세트 1',
            '장비세트 2',
            '장비세트 3',
            '장비세트 4',
            '장비세트 5',
        ]);
    });

    it('migrates legacy 프리셋/Preset defaults only', () => {
        expect(migrateLegacyDefaultEquipmentPresetName('프리셋 1')).toBe('장비세트 1');
        expect(migrateLegacyDefaultEquipmentPresetName('프리셋1')).toBe('장비세트 1');
        expect(migrateLegacyDefaultEquipmentPresetName('Preset 3')).toBe('장비세트 3');
        expect(migrateLegacyDefaultEquipmentPresetName('공격 세트')).toBeNull();

        const { presets, changed } = migrateEquipmentPresetDefaultNames([
            { name: '프리셋 1', equipment: { weapon: 'a' } },
            { name: '커스텀', equipment: {} },
        ]);
        expect(changed).toBe(true);
        expect(presets[0].name).toBe('장비세트 1');
        expect(presets[0].equipment).toEqual({ weapon: 'a' });
        expect(presets[1].name).toBe('커스텀');
    });
});
