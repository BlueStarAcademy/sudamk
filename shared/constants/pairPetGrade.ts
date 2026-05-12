import { ItemGrade } from '../types/enums.js';
import { PAIR_SOULSTONE_NAMES } from './petLobby.js';

/** 페어 펫 최대 레벨 — Lv.50에서 전설→신화 등급 진화 */
export const PAIR_PET_MAX_LEVEL = 50;

/** 페어 펫 등급 구간 (일반 → … → 신화, 초월 없음) */
export const PAIR_PET_GRADE_ORDER: readonly ItemGrade[] = [
    ItemGrade.Normal,
    ItemGrade.Uncommon,
    ItemGrade.Rare,
    ItemGrade.Epic,
    ItemGrade.Legendary,
    ItemGrade.Mythic,
] as const;

export function pairPetGradeIndex(grade: ItemGrade): number {
    if (grade === ItemGrade.Transcendent) return PAIR_PET_GRADE_ORDER.length - 1;
    const i = PAIR_PET_GRADE_ORDER.indexOf(grade);
    return i >= 0 ? i : 0;
}

export function nextPairPetGrade(grade: ItemGrade): ItemGrade | null {
    const i = pairPetGradeIndex(grade);
    if (i >= PAIR_PET_GRADE_ORDER.length - 1) return null;
    return PAIR_PET_GRADE_ORDER[i + 1]!;
}

/** 다음 등급 강화를 시도할 수 있는 최소 펫 레벨: Lv.10/20/…/50 (신화 진화는 Lv.50·전설+천광 영혼석) */
export function pairPetMinLevelForNextGrade(grade: ItemGrade): number {
    return (pairPetGradeIndex(grade) + 1) * 10;
}

/** 현재 저장 등급에서 다음 등급으로 올릴 때 필요한 영혼석 `templateId` (`pair-soul-1` … `pair-soul-5`) */
export function pairPetGradeUpgradeSoulTemplateId(grade: ItemGrade): string | null {
    const i = pairPetGradeIndex(grade);
    if (i < 0 || i >= PAIR_PET_GRADE_ORDER.length - 1) return null;
    return `pair-soul-${i + 1}`;
}

/** 등급 강화에 필요한 해당 영혼석 개수 (일반 20 … 전설→신화 30) */
export function pairPetGradeUpgradeSoulStoneCount(grade: ItemGrade): number | null {
    const i = pairPetGradeIndex(grade);
    if (i < 0 || i >= PAIR_PET_GRADE_ORDER.length - 1) return null;
    const costs = [20, 20, 25, 25, 30] as const;
    return costs[i]!;
}

/** `MATERIAL_ITEMS` 키·상점 표기와 동일한 영혼석 이름 */
export function pairPetGradeUpgradeSoulStoneMaterialName(grade: ItemGrade): string | null {
    const i = pairPetGradeIndex(grade);
    if (i < 0 || i >= PAIR_PET_GRADE_ORDER.length - 1) return null;
    return PAIR_SOULSTONE_NAMES[i]!;
}

/** 등급별 기본 능력치(50)에 곱해지는 배율 — 등급 상승마다 ×1.1 누적 */
export function pairPetStatMultiplierFromGrade(grade: ItemGrade): number {
    return Math.pow(1.1, pairPetGradeIndex(grade));
}

export function isPairPetUpgradeableGrade(grade: ItemGrade): boolean {
    return nextPairPetGrade(grade) != null;
}

/** 펫이 레벨 1칸 오를 때 6코어에 나눠 넣을 총 포인트 (일반 2 … 전설 6, 신화 7) */
export function pairPetLevelUpStatBudget(grade: ItemGrade): number {
    const i = pairPetGradeIndex(grade);
    return i + 2;
}

/**
 * 다음 등급으로 강화하기 전까지는 `pairPetMinLevelForNextGrade` 레벨에 도달한 뒤
 * 경험치를 더 받지 못함 (예: 일반 등급이면 Lv.10에서 정지 후 등급 강화 필요).
 * 신화 등 더 이상 올릴 등급이 없으면 제한 없음.
 */
export function pairPetXpGainBlockedByGrade(grade: ItemGrade, level: number): boolean {
    const lv = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(level) || 1));
    if (lv >= PAIR_PET_MAX_LEVEL) return true;
    if (nextPairPetGrade(grade) == null) return false;
    const capLevel = pairPetMinLevelForNextGrade(grade);
    return lv >= capLevel;
}

/**
 * 다음 등급 강화가 가능할 때만: 현재 레벨이 그 등급의 XP 상한 구간에 도달해,
 * 등급 강화 전에는 경험치를 더 받을 수 없는 상태인지 (만렙·신화 등한은 false).
 */
export function pairPetRequiresGradeUpgradeForXp(grade: ItemGrade, level: number): boolean {
    if (nextPairPetGrade(grade) == null) return false;
    const lv = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(level) || 1));
    if (lv >= PAIR_PET_MAX_LEVEL) return false;
    return lv >= pairPetMinLevelForNextGrade(grade);
}

/** 경기 결과 모달 등: 이번 판에 펫 XP가 0이고, 등급 강화가 필요한 경우 */
export function pairPetShowsGradeUpgradeNeededInsteadOfXp(opts: {
    grade: ItemGrade | undefined;
    petFinalLevel: number | undefined;
    xpChange: number | null | undefined;
}): boolean {
    const { grade, petFinalLevel, xpChange } = opts;
    if (grade == null || petFinalLevel == null) return false;
    if ((xpChange ?? 0) !== 0) return false;
    return pairPetRequiresGradeUpgradeForXp(grade, petFinalLevel);
}

/** 표시·등급 배율·경험치 구간 — 저장 등급과 동일 (등급 강화 전까지 Lv10에서도 일반 유지) */
export function effectivePairPetGradeFromRow(row: { grade?: ItemGrade }): ItemGrade {
    return row.grade ?? ItemGrade.Normal;
}
