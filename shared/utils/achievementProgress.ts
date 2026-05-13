import type { User } from '../types/entities.js';
import type { AchievementStageDefinition } from '../constants/achievements.js';
import { isChampionshipDungeonStageFirstMet } from '../constants/achievements.js';
import { ItemGrade } from '../types/enums.js';
import { getAdventureCodexCompletionBreakdown } from '../../utils/adventureCodexCompletion.js';
import { getAdventureUnderstandingTierFromXp } from '../../constants/adventureConstants.js';
import { getMaxPairPetGradeIndexAcrossInventory, getMaxPairPetLevelAcrossInventory } from './pairPetAchievementMetrics.js';
import { pairPetGradeIndex } from '../constants/pairPetGrade.js';

const ADVENTURE_UNDERSTANDING_TIER_INDEX_BY_LABEL: Record<string, number> = {
    편함: 1,
    익숙함: 2,
    친숙함: 3,
    정복: 4,
};

const GRADE_KEY_TO_ITEM_GRADE: Record<string, ItemGrade> = {
    normal: ItemGrade.Normal,
    uncommon: ItemGrade.Uncommon,
    rare: ItemGrade.Rare,
    epic: ItemGrade.Epic,
    legendary: ItemGrade.Legendary,
    mythic: ItemGrade.Mythic,
    transcendent: ItemGrade.Transcendent,
};

const TIER_SCORE_REQUIREMENTS: Record<string, number> = {
    루키: 1300,
    브론즈: 1400,
    실버: 1500,
    골드: 1700,
    플래티넘: 2000,
    다이아: 2400,
    마스터: 3000,
    챌린저: 3500,
};

const EQUIP_GRADE_ORDER: ItemGrade[] = [
    ItemGrade.Normal,
    ItemGrade.Uncommon,
    ItemGrade.Rare,
    ItemGrade.Epic,
    ItemGrade.Legendary,
    ItemGrade.Mythic,
    ItemGrade.Transcendent,
];

function equippedMinGradeIndex(user: User): number {
    const slots: Array<'fan' | 'board' | 'top' | 'bottom' | 'bowl' | 'stones'> = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];
    let minIdx = Number.MAX_SAFE_INTEGER;
    for (const slot of slots) {
        const equippedId = user.equipment?.[slot];
        if (!equippedId) return -1;
        const item = user.inventory?.find((it) => it.id === equippedId);
        if (!item?.grade) return -1;
        const idx = EQUIP_GRADE_ORDER.indexOf(item.grade);
        if (idx < 0) return -1;
        minIdx = Math.min(minIdx, idx);
    }
    return minIdx === Number.MAX_SAFE_INTEGER ? -1 : minIdx;
}

function strategySeasonScore(user: User): number {
    const diff = user.cumulativeRankingScore?.['standard'] ?? 0;
    return 1200 + diff;
}

/** 업적 단계별 진행 수치 (UI `(현재/목표)`). 던전 1위형은 수치 진행 없음 → null */
export function getAchievementProgressDisplay(
    stage: AchievementStageDefinition,
    user: User,
): { current: number; target: number } | null {
    const r = stage.requirement;
    switch (r.type) {
        case 'singleplayer_stage_clear':
            return (user.clearedSinglePlayerStages ?? []).includes(r.stageId) ? { current: 1, target: 1 } : { current: 0, target: 1 };
        case 'strategy_level':
            return { current: Math.min(r.level, user.userLevel ?? 0), target: r.level };
        case 'all_equipment_min_grade': {
            const reqKey = GRADE_KEY_TO_ITEM_GRADE[r.grade] ?? ItemGrade.Normal;
            const req = EQUIP_GRADE_ORDER.indexOf(reqKey);
            if (req < 0) return null;
            const minEq = equippedMinGradeIndex(user);
            if (minEq < 0) return { current: 0, target: req };
            return { current: Math.min(minEq, req), target: req };
        }
        case 'strategy_tier': {
            const seasonScore = strategySeasonScore(user);
            const need = TIER_SCORE_REQUIREMENTS[r.tier] ?? Number.MAX_SAFE_INTEGER;
            return { current: Math.min(seasonScore, need), target: need };
        }
        case 'adventure_understanding_tier': {
            const xp = Math.max(0, Math.floor(user.adventureProfile?.understandingXpByStage?.[r.stageId] ?? 0));
            const curTier = getAdventureUnderstandingTierFromXp(xp);
            const need = ADVENTURE_UNDERSTANDING_TIER_INDEX_BY_LABEL[r.tier] ?? Number.MAX_SAFE_INTEGER;
            return { current: Math.min(curTier, need), target: need };
        }
        case 'adventure_codex_score': {
            const { totalSum } = getAdventureCodexCompletionBreakdown(user.adventureProfile);
            return { current: Math.min(totalSum, r.score), target: r.score };
        }
        case 'blacksmith_level':
            return { current: Math.min(user.blacksmithLevel ?? 1, r.level), target: r.level };
        case 'equipment_box_opens': {
            const cur = user.quests?.achievements?.totalEquipmentBoxOpens ?? 0;
            return { current: Math.min(cur, r.opens), target: r.opens };
        }
        case 'material_box_opens': {
            const cur = user.quests?.achievements?.totalMaterialBoxOpens ?? 0;
            return { current: Math.min(cur, r.opens), target: r.opens };
        }
        case 'championship_dungeon_stage_first':
            return null;
        case 'pair_pet_max_level': {
            const cur = getMaxPairPetLevelAcrossInventory(user);
            return { current: Math.min(cur, r.level), target: r.level };
        }
        case 'pair_pet_min_grade': {
            const curIdx = getMaxPairPetGradeIndexAcrossInventory(user);
            const needIdx = pairPetGradeIndex(r.grade);
            return { current: Math.min(curIdx, needIdx), target: needIdx };
        }
        case 'pair_pet_training_claims': {
            const cur = user.quests?.achievements?.totalPairPetTrainingClaims ?? 0;
            return { current: Math.min(cur, r.count), target: r.count };
        }
        case 'pair_pet_soul_converts': {
            const cur = user.quests?.achievements?.totalPairPetSoulConverts ?? 0;
            return { current: Math.min(cur, r.count), target: r.count };
        }
        default:
            return null;
    }
}

export function isAchievementRequirementMet(stage: AchievementStageDefinition, user: User): boolean {
    const r = stage.requirement;
    if (r.type === 'championship_dungeon_stage_first') {
        return isChampionshipDungeonStageFirstMet(user, r.tournamentType, r.stage);
    }
    const pr = getAchievementProgressDisplay(stage, user);
    return pr != null && pr.current >= pr.target;
}
