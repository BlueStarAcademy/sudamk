import { ItemGrade } from '../types/enums.js';

/**
 * 등급 확정 장비 상자 — 해당 등급 장비 1개 확정(부위·옵션 랜덤).
 * 운영자 우편 첨부·가방 사용용. 길드 장비 상자와 달리 길드 특수옵션 보장 없음.
 */
export type GradeGuaranteedEquipmentBoxDef = {
    name: string;
    grade: ItemGrade;
    image: string;
    description: string;
};

const GRADE_BOX_IMAGE_BY_GRADE: Record<ItemGrade, string> = {
    [ItemGrade.Normal]: '/images/Box/EquipmentBox1.webp',
    [ItemGrade.Uncommon]: '/images/Box/EquipmentBox2.webp',
    [ItemGrade.Rare]: '/images/Box/EquipmentBox3.webp',
    [ItemGrade.Epic]: '/images/Box/EquipmentBox4.webp',
    [ItemGrade.Legendary]: '/images/Box/EquipmentBox5.webp',
    [ItemGrade.Mythic]: '/images/Box/EquipmentBox6.webp',
    [ItemGrade.Transcendent]: '/images/Box/EquipmentBox6.webp',
};

const GRADE_BOX_LABEL_KO: Record<ItemGrade, string> = {
    [ItemGrade.Normal]: '일반',
    [ItemGrade.Uncommon]: '고급',
    [ItemGrade.Rare]: '희귀',
    [ItemGrade.Epic]: '에픽',
    [ItemGrade.Legendary]: '전설',
    [ItemGrade.Mythic]: '신화',
    [ItemGrade.Transcendent]: '초월',
};

/** 일반 → 초월 순 */
export const GRADE_GUARANTEED_EQUIPMENT_BOX_GRADES: readonly ItemGrade[] = [
    ItemGrade.Normal,
    ItemGrade.Uncommon,
    ItemGrade.Rare,
    ItemGrade.Epic,
    ItemGrade.Legendary,
    ItemGrade.Mythic,
    ItemGrade.Transcendent,
] as const;

export function gradeGuaranteedEquipmentBoxName(grade: ItemGrade): string {
    return `장비 상자(${GRADE_BOX_LABEL_KO[grade]})`;
}

export const GRADE_GUARANTEED_EQUIPMENT_BOXES: readonly GradeGuaranteedEquipmentBoxDef[] =
    GRADE_GUARANTEED_EQUIPMENT_BOX_GRADES.map((grade) => {
        const label = GRADE_BOX_LABEL_KO[grade];
        return {
            name: gradeGuaranteedEquipmentBoxName(grade),
            grade,
            image: GRADE_BOX_IMAGE_BY_GRADE[grade],
            description: `${label} 등급 장비 1개 확정 획득. 부위와 옵션은 랜덤입니다.`,
        };
    });

export function findGradeGuaranteedEquipmentBoxByName(
    name: string | undefined | null,
): GradeGuaranteedEquipmentBoxDef | undefined {
    if (!name) return undefined;
    const trimmed = name.replace(/\s+/g, ' ').trim();
    return GRADE_GUARANTEED_EQUIPMENT_BOXES.find((b) => b.name === trimmed);
}
