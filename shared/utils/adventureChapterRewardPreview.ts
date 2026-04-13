import { ItemGrade } from '../types/enums.js';
import {
    EQUIPMENT_GRADE_LABEL_KO,
    MATERIAL_ITEMS,
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
