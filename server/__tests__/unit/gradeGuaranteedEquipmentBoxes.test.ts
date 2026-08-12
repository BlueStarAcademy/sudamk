import { describe, expect, it } from 'vitest';
import { ItemGrade } from '../../../types/enums.js';
import {
    GRADE_GUARANTEED_EQUIPMENT_BOXES,
    gradeGuaranteedEquipmentBoxName,
} from '../../../shared/constants/gradeGuaranteedEquipmentBoxes.js';
import { openGuildGradeBox, resolveOpenableConsumableBox } from '../../shop.js';

describe('grade guaranteed equipment boxes', () => {
    it('defines one box per equipment grade including mythic and transcendent', () => {
        expect(GRADE_GUARANTEED_EQUIPMENT_BOXES.map((b) => b.grade)).toEqual([
            ItemGrade.Normal,
            ItemGrade.Uncommon,
            ItemGrade.Rare,
            ItemGrade.Epic,
            ItemGrade.Legendary,
            ItemGrade.Mythic,
            ItemGrade.Transcendent,
        ]);
        expect(gradeGuaranteedEquipmentBoxName(ItemGrade.Mythic)).toBe('장비 상자(신화)');
    });

    it('opens mythic box to mythic equipment with random options (no guild guarantee required)', () => {
        const handler = resolveOpenableConsumableBox('장비 상자(신화)');
        expect(handler?.type).toBe('equipment');
        const item = handler!.onPurchase();
        expect(Array.isArray(item) ? item[0]!.grade : item.grade).toBe(ItemGrade.Mythic);
    });

    it('openGuildGradeBox without guild shop opts still rolls the requested grade', () => {
        for (let i = 0; i < 8; i++) {
            const item = openGuildGradeBox(ItemGrade.Legendary);
            expect(item.grade).toBe(ItemGrade.Legendary);
            expect(item.type).toBe('equipment');
        }
    });
});
