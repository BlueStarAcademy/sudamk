import { ItemGrade } from '../types/enums.js';
import {
    EQUIPMENT_GRADE_LABEL_KO,
    MATERIAL_ITEMS,
    gradeBackgrounds,
} from '../constants/items.js';
import {
    adventureMonsterGoldLevelMultiplier,
    getAdventureStageLevelRange,
    type AdventureStageId,
} from '../../constants/adventureConstants.js';
import { ADVENTURE_STRATEGIC_WIN_BASE_GOLD_BY_BOARD_SIZE } from '../constants/adventureStrategicGold.js';
import { getAdventureChapterDirectLootDefinition, resolveAdventureChapterIndexForLoot } from './adventureChapterDirectLoot.js';
import { ADVENTURE_ENHANCEMENT_STONE_QTY_NORMAL } from './adventureEnhancementStoneQty.js';

const GRADE_ORDER: ItemGrade[] = [
    ItemGrade.Normal,
    ItemGrade.Uncommon,
    ItemGrade.Rare,
    ItemGrade.Epic,
    ItemGrade.Legendary,
    ItemGrade.Mythic,
    ItemGrade.Transcendent,
];

function gradeRank(g: ItemGrade): number {
    const i = GRADE_ORDER.indexOf(g);
    return i < 0 ? 0 : i;
}

/** 모험 즉시 지급 장비 등급 → 장비 상자 아이콘(루트 표시용) */
export function adventureEquipmentBoxImageForGrade(grade: ItemGrade): string {
    switch (grade) {
        case ItemGrade.Normal:
            return '/images/Box/EquipmentBox1.png';
        case ItemGrade.Uncommon:
            return '/images/Box/EquipmentBox2.png';
        case ItemGrade.Rare:
            return '/images/Box/EquipmentBox3.png';
        case ItemGrade.Epic:
            return '/images/Box/EquipmentBox4.png';
        case ItemGrade.Legendary:
            return '/images/Box/EquipmentBox5.png';
        case ItemGrade.Mythic:
        case ItemGrade.Transcendent:
            return '/images/Box/EquipmentBox6.png';
        default:
            return '/images/Box/EquipmentBox1.png';
    }
}

function equipmentGradeRangeLabel(def: ReturnType<typeof getAdventureChapterDirectLootDefinition>): string {
    const grades = def.equipmentGrades.map((r) => r.grade);
    if (grades.length === 0) return '—';
    let minG = grades[0]!;
    let maxG = grades[0]!;
    for (const g of grades) {
        if (gradeRank(g) < gradeRank(minG)) minG = g;
        if (gradeRank(g) > gradeRank(maxG)) maxG = g;
    }
    const a = EQUIPMENT_GRADE_LABEL_KO[minG] ?? minG;
    const b = EQUIPMENT_GRADE_LABEL_KO[maxG] ?? maxG;
    return a === b ? a : `${a}~${b}`;
}

function materialGradeRangeLabel(def: ReturnType<typeof getAdventureChapterDirectLootDefinition>): string {
    const grades = def.materials
        .map((m) => MATERIAL_ITEMS[m.name]?.grade)
        .filter((g): g is ItemGrade => g != null);
    if (grades.length === 0) return '—';
    let minG = grades[0]!;
    let maxG = grades[0]!;
    for (const g of grades) {
        if (gradeRank(g) < gradeRank(minG)) minG = g;
        if (gradeRank(g) > gradeRank(maxG)) maxG = g;
    }
    const a = EQUIPMENT_GRADE_LABEL_KO[minG] ?? minG;
    const b = EQUIPMENT_GRADE_LABEL_KO[maxG] ?? maxG;
    return a === b ? a : `${a}~${b}`;
}

/** 챕터에서 등장하는 일반 몬스터 판 크기(보스 19줄 제외) */
export function getAdventureChapterNormalBoardSizeRange(stageId: AdventureStageId): { min: number; max: number } {
    switch (stageId) {
        case 'neighborhood_hill':
            return { min: 7, max: 7 };
        case 'lake_park':
            return { min: 9, max: 9 };
        case 'aquarium':
            return { min: 9, max: 11 };
        case 'zoo':
            return { min: 11, max: 13 };
        case 'amusement_park':
            return { min: 13, max: 13 };
        default:
            return { min: 9, max: 9 };
    }
}

function previewGoldAt(boardSize: number, monsterLevel: number): number {
    const base = ADVENTURE_STRATEGIC_WIN_BASE_GOLD_BY_BOARD_SIZE[boardSize] ?? 1500;
    return Math.round(base * adventureMonsterGoldLevelMultiplier(monsterLevel));
}

export type AdventureChapterRewardPreview = {
    goldNormalRange: { min: number; max: number };
    /** 놀이동산 등 19줄 보스 승리 시(기본 골드만 ×1.68, 이해도 전) */
    goldBoss19Range: { min: number; max: number } | null;
    equipmentGradeRange: string;
    materialGradeRange: string;
    /** 이 챕터 재료 풀에 나오는 강화석 + 일반 몬스터 1회 지급 개수 문구 */
    materialQtyLines: string[];
};

export type AdventureChapterRewardVisualEquipment = { grade: ItemGrade; image: string; gradeBg: string };
export type AdventureChapterRewardVisualMaterial = {
    image: string;
    gradeBg: string;
    qtyMin: number;
    qtyMax: number;
};

export type AdventureChapterRewardVisual = {
    goldNormalRange: { min: number; max: number };
    goldBoss19Range: { min: number; max: number } | null;
    equipment: AdventureChapterRewardVisualEquipment[];
    /** 획득 가능 최고 등급 → 해당 장비 상자 이미지(미스터리 슬롯용) */
    equipmentMaxTier: { grade: ItemGrade; image: string; gradeBg: string };
    materials: AdventureChapterRewardVisualMaterial[];
};

/** 맵 UI용 — 아이콘·배지에 쓰는 보상 시각 데이터 */
export function getAdventureChapterRewardVisual(stageId: AdventureStageId): AdventureChapterRewardVisual {
    const preview = getAdventureChapterRewardPreview(stageId);
    const chapterIndex = resolveAdventureChapterIndexForLoot(stageId);
    const def = getAdventureChapterDirectLootDefinition(chapterIndex);

    const gradeSet = new Set(def.equipmentGrades.map((r) => r.grade));
    const equipment: AdventureChapterRewardVisualEquipment[] = GRADE_ORDER.filter((g) => gradeSet.has(g)).map((grade) => ({
        grade,
        image: adventureEquipmentBoxImageForGrade(grade),
        gradeBg: gradeBackgrounds[grade] ?? gradeBackgrounds[ItemGrade.Normal],
    }));
    const maxGrade = equipment.length > 0 ? equipment[equipment.length - 1]!.grade : ItemGrade.Normal;
    const equipmentMaxTier = {
        grade: maxGrade,
        image: adventureEquipmentBoxImageForGrade(maxGrade),
        gradeBg: gradeBackgrounds[maxGrade] ?? gradeBackgrounds[ItemGrade.Normal],
    };

    const materials: AdventureChapterRewardVisualMaterial[] = def.materials.map((m) => {
        const meta = MATERIAL_ITEMS[m.name];
        const q = ADVENTURE_ENHANCEMENT_STONE_QTY_NORMAL[m.name];
        const g = meta?.grade ?? ItemGrade.Normal;
        return {
            image: meta?.image ?? '/images/materials/materials1.png',
            gradeBg: gradeBackgrounds[g] ?? gradeBackgrounds[ItemGrade.Normal],
            qtyMin: q?.min ?? 1,
            qtyMax: q?.max ?? 1,
        };
    });

    return {
        goldNormalRange: preview.goldNormalRange,
        goldBoss19Range: preview.goldBoss19Range,
        equipment,
        equipmentMaxTier,
        materials,
    };
}

export function getAdventureChapterRewardPreview(stageId: AdventureStageId): AdventureChapterRewardPreview {
    const chapterIndex = resolveAdventureChapterIndexForLoot(stageId);
    const def = getAdventureChapterDirectLootDefinition(chapterIndex);
    const { min: lvMin, max: lvMax } = getAdventureStageLevelRange(chapterIndex);
    const { min: bsMin, max: bsMax } = getAdventureChapterNormalBoardSizeRange(stageId);

    const g1 = previewGoldAt(bsMin, lvMin);
    const g2 = previewGoldAt(bsMin, lvMax);
    const g3 = previewGoldAt(bsMax, lvMin);
    const g4 = previewGoldAt(bsMax, lvMax);
    const goldNormalMin = Math.min(g1, g2, g3, g4);
    const goldNormalMax = Math.max(g1, g2, g3, g4);

    let goldBoss19Range: { min: number; max: number } | null = null;
    if (stageId === 'amusement_park') {
        const b1 = Math.round(previewGoldAt(19, lvMin) * 1.68);
        const b2 = Math.round(previewGoldAt(19, lvMax) * 1.68);
        goldBoss19Range = { min: Math.min(b1, b2), max: Math.max(b1, b2) };
    }

    const materialQtyLines = def.materials.map((m) => {
        const q = ADVENTURE_ENHANCEMENT_STONE_QTY_NORMAL[m.name];
        if (!q) return `${m.name}`;
        if (q.min === q.max) return `${m.name} ${q.min}개`;
        return `${m.name} ${q.min}~${q.max}개`;
    });

    return {
        goldNormalRange: { min: goldNormalMin, max: goldNormalMax },
        goldBoss19Range,
        equipmentGradeRange: equipmentGradeRangeLabel(def),
        materialGradeRange: materialGradeRangeLabel(def),
        materialQtyLines,
    };
}
