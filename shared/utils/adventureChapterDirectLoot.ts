import { ItemGrade } from '../types/enums.js';
import { getAdventureStageById } from '../../constants/adventureConstants.js';

/** 모험 몬스터 승리 시 챕터별 장비 등급·강화석 가중치 (상자 없이 즉시 지급) */
export type AdventureDirectEquipmentGradeRow = { grade: ItemGrade; weight: number };
export type AdventureDirectMaterialRow = { name: string; weight: number };

export type AdventureChapterDirectLootDefinition = {
    equipmentGrades: AdventureDirectEquipmentGradeRow[];
    materials: AdventureDirectMaterialRow[];
};

export function resolveAdventureChapterIndexForLoot(stageId: string | undefined | null): number {
    const stage = getAdventureStageById(stageId ?? '');
    const idx = stage?.stageIndex ?? 1;
    return Math.max(1, Math.min(5, Math.floor(idx)));
}

/**
 * 챕터별 테이블 (기획 문서 그대로).
 * 5챕터 재료는 명시 없음 → 중급~신비 4단(45/44/10/1)으로 정렬.
 */
export function getAdventureChapterDirectLootDefinition(chapterIndex: number): AdventureChapterDirectLootDefinition {
    const ch = Math.max(1, Math.min(5, Math.floor(chapterIndex)));
    switch (ch) {
        case 1:
            return {
                equipmentGrades: [
                    { grade: ItemGrade.Normal, weight: 80 },
                    { grade: ItemGrade.Uncommon, weight: 20 },
                ],
                materials: [
                    { name: '하급 강화석', weight: 80 },
                    { name: '중급 강화석', weight: 20 },
                ],
            };
        case 2:
            return {
                equipmentGrades: [
                    { grade: ItemGrade.Normal, weight: 40 },
                    { grade: ItemGrade.Uncommon, weight: 40 },
                    { grade: ItemGrade.Rare, weight: 20 },
                ],
                materials: [
                    { name: '하급 강화석', weight: 40 },
                    { name: '중급 강화석', weight: 40 },
                    { name: '상급 강화석', weight: 20 },
                ],
            };
        case 3:
            return {
                equipmentGrades: [
                    { grade: ItemGrade.Uncommon, weight: 40 },
                    { grade: ItemGrade.Rare, weight: 50 },
                    { grade: ItemGrade.Epic, weight: 10 },
                ],
                materials: [
                    { name: '중급 강화석', weight: 50 },
                    { name: '상급 강화석', weight: 40 },
                    { name: '최상급 강화석', weight: 10 },
                ],
            };
        case 4:
            return {
                equipmentGrades: [
                    { grade: ItemGrade.Uncommon, weight: 25 },
                    { grade: ItemGrade.Rare, weight: 35 },
                    { grade: ItemGrade.Epic, weight: 30 },
                    { grade: ItemGrade.Legendary, weight: 10 },
                ],
                materials: [
                    { name: '중급 강화석', weight: 33 },
                    { name: '상급 강화석', weight: 34 },
                    { name: '최상급 강화석', weight: 30 },
                    { name: '신비의 강화석', weight: 3 },
                ],
            };
        case 5:
        default:
            return {
                equipmentGrades: [
                    { grade: ItemGrade.Rare, weight: 45 },
                    { grade: ItemGrade.Epic, weight: 44 },
                    { grade: ItemGrade.Legendary, weight: 10 },
                    { grade: ItemGrade.Mythic, weight: 1 },
                ],
                materials: [
                    { name: '중급 강화석', weight: 45 },
                    { name: '상급 강화석', weight: 44 },
                    { name: '최상급 강화석', weight: 10 },
                    { name: '신비의 강화석', weight: 1 },
                ],
            };
    }
}
