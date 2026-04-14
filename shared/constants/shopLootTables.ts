import { ItemGrade } from '../types/enums.js';

export type GradeWeight = { grade: ItemGrade; weight: number };

export const EQUIPMENT_BOX_LOOT_TABLES: Record<
    'equipment_box_1' | 'equipment_box_2' | 'equipment_box_3' | 'equipment_box_4' | 'equipment_box_5' | 'equipment_box_6',
    GradeWeight[]
> = {
    equipment_box_1: [
        { grade: ItemGrade.Normal, weight: 70 },
        { grade: ItemGrade.Uncommon, weight: 20 },
        { grade: ItemGrade.Rare, weight: 10 },
    ],
    equipment_box_2: [
        { grade: ItemGrade.Normal, weight: 55 },
        { grade: ItemGrade.Uncommon, weight: 25 },
        { grade: ItemGrade.Rare, weight: 18 },
        { grade: ItemGrade.Epic, weight: 2 },
    ],
    equipment_box_3: [
        { grade: ItemGrade.Uncommon, weight: 45 },
        { grade: ItemGrade.Rare, weight: 32 },
        { grade: ItemGrade.Epic, weight: 21 },
        { grade: ItemGrade.Legendary, weight: 2 },
    ],
    equipment_box_4: [
        { grade: ItemGrade.Rare, weight: 58 },
        { grade: ItemGrade.Epic, weight: 36 },
        { grade: ItemGrade.Legendary, weight: 5 },
        { grade: ItemGrade.Mythic, weight: 1 },
    ],
    equipment_box_5: [
        { grade: ItemGrade.Epic, weight: 83 },
        { grade: ItemGrade.Legendary, weight: 15 },
        { grade: ItemGrade.Mythic, weight: 2 },
    ],
    equipment_box_6: [
        { grade: ItemGrade.Legendary, weight: 95 },
        { grade: ItemGrade.Mythic, weight: 5 },
    ],
};

export const MATERIAL_BOX_PROBABILITIES: Record<
    'material_box_1' | 'material_box_2' | 'material_box_3' | 'material_box_4' | 'material_box_5' | 'material_box_6',
    Record<string, number>
> = {
    material_box_1: { '하급 강화석': 0.8, '중급 강화석': 0.15, '상급 강화석': 0.05 },
    material_box_2: { '하급 강화석': 0.35, '중급 강화석': 0.55, '상급 강화석': 0.1 },
    material_box_3: { '하급 강화석': 0.1, '중급 강화석': 0.45, '상급 강화석': 0.45 },
    material_box_4: { '중급 강화석': 0.35, '상급 강화석': 0.45, '최상급 강화석': 0.2 },
    material_box_5: { '상급 강화석': 0.5, '최상급 강화석': 0.4, '신비의 강화석': 0.1 },
    material_box_6: { '상급 강화석': 0.25, '최상급 강화석': 0.25, '신비의 강화석': 0.5 },
};
