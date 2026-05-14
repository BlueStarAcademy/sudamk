import { ItemGrade } from '../types/enums.js';
import { EQUIPMENT_GRADE_LABEL_KO } from './items.js';

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

/** `server/shop.ts` 챔피언십 장비 상자와 동일 매핑(상자 I~VI ↔ equipment_box_1~6) */
const CHAMPIONSHIP_EQUIPMENT_BOX_KEYS = [
    'equipment_box_1',
    'equipment_box_2',
    'equipment_box_3',
    'equipment_box_4',
    'equipment_box_5',
    'equipment_box_6',
] as const satisfies readonly (keyof typeof EQUIPMENT_BOX_LOOT_TABLES)[];

const LOOT_GRADE_DISPLAY_ORDER: ItemGrade[] = [
    ItemGrade.Normal,
    ItemGrade.Uncommon,
    ItemGrade.Rare,
    ItemGrade.Epic,
    ItemGrade.Legendary,
    ItemGrade.Mythic,
    ItemGrade.Transcendent,
];

/**
 * 챔피언십 상점 장비 상자: 기존 장비상자와 동일 가중치 테이블에서 일반 등급만 제외(일반만 있을 때는 유지).
 * `openChampionshipEquipmentBox`와 동일 소스.
 */
export function getChampionshipEquipmentBoxGradeWeights(boxLevel: 1 | 2 | 3 | 4 | 5 | 6): GradeWeight[] {
    const key = CHAMPIONSHIP_EQUIPMENT_BOX_KEYS[boxLevel - 1];
    const base = EQUIPMENT_BOX_LOOT_TABLES[key];
    const filtered = base.filter((e) => e.grade !== ItemGrade.Normal);
    return filtered.length > 0 ? filtered : base;
}

/** 상점·툴팁 등 UI용: 테이블에 포함된 등급만 낮은 순으로 */
export function getChampionshipEquipmentBoxDisplayGrades(boxLevel: 1 | 2 | 3 | 4 | 5 | 6): ItemGrade[] {
    const weights = getChampionshipEquipmentBoxGradeWeights(boxLevel);
    const present = new Set(weights.map((w) => w.grade));
    return LOOT_GRADE_DISPLAY_ORDER.filter((g) => present.has(g));
}

/** 일반 상점 등: `equipment_box_1` … `equipment_box_6` */
export function parseStandardEquipmentBoxLevel(itemId: string): 1 | 2 | 3 | 4 | 5 | 6 | null {
    const m = /^equipment_box_([1-6])$/.exec(itemId);
    if (!m) return null;
    return Number(m[1]) as 1 | 2 | 3 | 4 | 5 | 6;
}

/** 골드/다이아 상점 장비 상자: 루트 테이블 그대로(일반 포함) 등급 범위 */
export function getStandardEquipmentBoxDisplayGrades(boxLevel: 1 | 2 | 3 | 4 | 5 | 6): ItemGrade[] {
    const key = CHAMPIONSHIP_EQUIPMENT_BOX_KEYS[boxLevel - 1];
    const base = EQUIPMENT_BOX_LOOT_TABLES[key];
    const present = new Set(base.map((w) => w.grade));
    return LOOT_GRADE_DISPLAY_ORDER.filter((g) => present.has(g));
}

const CHAMPIONSHIP_EQUIP_BOX_INFO_SUFFIX = ' 장비 획득. 챔피언십 능력치 상승 특수옵션 반드시 포함';

/** 챔피언십 상점 장비 상자 설명 한 줄(등급 범위 + 고정 문구). 상점 상수·툴팁 `title` 등과 동기화 */
export function getChampionshipEquipmentBoxShopInfoLineKo(boxLevel: 1 | 2 | 3 | 4 | 5 | 6): string {
    const grades = getChampionshipEquipmentBoxDisplayGrades(boxLevel);
    if (grades.length === 0) return CHAMPIONSHIP_EQUIP_BOX_INFO_SUFFIX.trimStart();
    const loKey = grades[0]!;
    const hiKey = grades[grades.length - 1]!;
    const lo = EQUIPMENT_GRADE_LABEL_KO[loKey] ?? loKey;
    const hi = EQUIPMENT_GRADE_LABEL_KO[hiKey] ?? hiKey;
    if (lo === hi) return `${lo}${CHAMPIONSHIP_EQUIP_BOX_INFO_SUFFIX}`;
    return `${lo}~${hi}${CHAMPIONSHIP_EQUIP_BOX_INFO_SUFFIX}`;
}

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
