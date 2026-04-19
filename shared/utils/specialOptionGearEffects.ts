import type { User, InventoryItem } from '../types/entities.js';
import { ItemGrade, MythicStat } from '../types/enums.js';

/** 장비 UI·도움말에서 신화 옵션을 부르는 공통 이름 */
export const SPECIAL_OPTION_DISPLAY_CATEGORY = '스페셜 옵션';

export type SpecialOptionGearBonuses = {
    guildBossDamagePercent: number;
    /** 보상 등급 인덱스 +1 (최대 SSS) */
    guildBossRewardTierShift: number;
    /** 초월 「보상추가」: 착용한 초월 장비마다 보상 줄 하나를 한 번 더 (횟수 누적) */
    guildBossDuplicateRewardCount: number;
    /** 1~35층만 AP -1 */
    towerApMinusOneFloors1to35: boolean;
    /** 전 층 AP -1 */
    towerApMinusOneAllFloors: boolean;
    /** 장비로 인한 행동력 회복 간격 추가 감소(초) */
    apRegenExtraReductionSec: number;
    adventureScanExtra: number;
    adventureMissileExtra: number;
    /** 모험 승리 골드에 가산(%) — 도감/이해도와 별도 합산용 */
    adventureGoldBonusPercentFromGear: number;
};

export const DEFAULT_SPECIAL_OPTION_GEAR_BONUSES: SpecialOptionGearBonuses = {
    guildBossDamagePercent: 0,
    guildBossRewardTierShift: 0,
    guildBossDuplicateRewardCount: 0,
    towerApMinusOneFloors1to35: false,
    towerApMinusOneAllFloors: false,
    apRegenExtraReductionSec: 0,
    adventureScanExtra: 0,
    adventureMissileExtra: 0,
    adventureGoldBonusPercentFromGear: 0,
};

const MYTHIC_ONLY: MythicStat[] = [
    MythicStat.GuildBossRewardGradeUp,
    MythicStat.GuildBossExtraDamage5,
    MythicStat.TowerApMinus1Floors1to35,
    MythicStat.ApRegenMinus30s,
    MythicStat.AdventureScanPlus1,
    MythicStat.AdventureMissilePlus1,
    MythicStat.AdventureGoldBonus15,
];

const TRANSCENDENT_ONLY: MythicStat[] = [
    MythicStat.GuildBossExtraRewardDuplicate,
    MythicStat.GuildBossExtraDamage10,
    MythicStat.TowerApMinus1AllFloors,
    MythicStat.ApRegenMinus60s,
    MythicStat.AdventureScanTranscendent,
    MythicStat.AdventureMissilePlus2,
    MythicStat.AdventureGoldBonus20,
];

/** 신화 장비 스페셜 옵션 후보(표시·도감·툴팁용) */
export const MYTHIC_GRADE_SPECIAL_OPTION_STATS: readonly MythicStat[] = MYTHIC_ONLY;
/** 초월 장비 스페셜 옵션 후보 */
export const TRANSCENDENT_GRADE_SPECIAL_OPTION_STATS: readonly MythicStat[] = TRANSCENDENT_ONLY;

const MYTHIC_SPECIAL_TYPE_SET = new Set<string>(MYTHIC_ONLY);
const TRANSCENDENT_SPECIAL_TYPE_SET = new Set<string>(TRANSCENDENT_ONLY);

export function isMythicGradeSpecialOptionType(type: string): boolean {
    return MYTHIC_SPECIAL_TYPE_SET.has(type);
}

export function isTranscendentGradeSpecialOptionType(type: string): boolean {
    return TRANSCENDENT_SPECIAL_TYPE_SET.has(type);
}

export type MythicSubIndexed<T extends { type: string }> = { sub: T; index: number };

/** UI에서 신화/초월 스페셜을 나눠 그릴 때 사용. `index`는 원본 `mythicSubs` 배열 기준(제련 선택 등 유지). */
export function partitionMythicSubsWithIndex<T extends { type: string }>(
    subs: T[] | null | undefined,
): { mythicGradeRows: MythicSubIndexed<T>[]; transcendentGradeRows: MythicSubIndexed<T>[] } {
    const mythicGradeRows: MythicSubIndexed<T>[] = [];
    const transcendentGradeRows: MythicSubIndexed<T>[] = [];
    (subs || []).forEach((sub, index) => {
        const t = sub.type;
        if (TRANSCENDENT_SPECIAL_TYPE_SET.has(t)) transcendentGradeRows.push({ sub, index });
        else if (MYTHIC_SPECIAL_TYPE_SET.has(t)) mythicGradeRows.push({ sub, index });
        else mythicGradeRows.push({ sub, index });
    });
    return { mythicGradeRows, transcendentGradeRows };
}

export function mythicStatPoolForItemGrade(grade: ItemGrade): MythicStat[] {
    if (grade === ItemGrade.Transcendent) return [...TRANSCENDENT_ONLY];
    if (grade === ItemGrade.Mythic) return [...MYTHIC_ONLY];
    return [];
}

function equippedGear(user: User | null | undefined) {
    if (!user?.inventory?.length) return [];
    return user.inventory.filter((i) => i && i.isEquipped && i.type === 'equipment' && i.options);
}

function isTranscendentOnlyStat(t: MythicStat): boolean {
    return (TRANSCENDENT_ONLY as readonly MythicStat[]).includes(t);
}

function isMythicOnlyStat(t: MythicStat): boolean {
    return (MYTHIC_ONLY as readonly MythicStat[]).includes(t);
}

/** 신화 전용 / 초월 전용 스페셜 옵션은 해당 등급 장비에 붙어 있을 때만 적용 */
function mythicSubEligibleOnItem(item: InventoryItem, t: MythicStat): boolean {
    if (!Object.values(MythicStat).includes(t)) return false;
    if (isTranscendentOnlyStat(t)) return item.grade === ItemGrade.Transcendent;
    if (isMythicOnlyStat(t)) return item.grade === ItemGrade.Mythic;
    return false;
}

/**
 * 착용 장비의 스페셜 옵션을 집계합니다.
 * - 신화 전용 줄은 신화 장비에서만, 초월 전용 줄은 초월 장비에서만 적용됩니다.
 * - 신화 스페셜 1~7번과 초월 스페셜 1~7번은 같은 줄 번호끼리 짝을 이룹니다. 1번(신화 「보스 보상등급」·초월 「보스 보상추가」)만
 *   서로 동시에 적용될 수 있고, 2~7번 줄은 신화 쪽과 초월 쪽이 동시에 적용되지 않으며(중복 불가) 강한 쪽만 적용됩니다.
 * - 2~7번에 해당하는 부류(길드 보스 추가 피해%, 탑 AP, 행동력 회복, 모험 스캔·미사일·모험 골드%)는 위 규칙에 따라 한 번만 반영됩니다.
 * - 초월 「길드 보스전 보상추가」(1번)는 여러 초월 장비에 있으면 줄 수만큼 누적됩니다.
 */
export function aggregateSpecialOptionGearFromUser(user: User | null | undefined): SpecialOptionGearBonuses {
    if (!user) return { ...DEFAULT_SPECIAL_OPTION_GEAR_BONUSES };

    const present = new Set<MythicStat>();
    let guildBossDuplicateRewardCount = 0;

    for (const item of equippedGear(user)) {
        for (const sub of item.options!.mythicSubs || []) {
            const t = sub.type as MythicStat;
            if (!mythicSubEligibleOnItem(item, t)) continue;
            present.add(t);
            if (t === MythicStat.GuildBossExtraRewardDuplicate) guildBossDuplicateRewardCount += 1;
        }
    }

    const has = (s: MythicStat) => present.has(s);

    const guildBossDamagePercent = has(MythicStat.GuildBossExtraDamage10)
        ? 10
        : has(MythicStat.GuildBossExtraDamage5)
          ? 5
          : 0;

    const guildBossRewardTierShift = has(MythicStat.GuildBossRewardGradeUp) ? 1 : 0;

    const towerApMinusOneAllFloors = has(MythicStat.TowerApMinus1AllFloors);
    const towerApMinusOneFloors1to35 =
        !towerApMinusOneAllFloors && has(MythicStat.TowerApMinus1Floors1to35);

    const apRegenExtraReductionSec = has(MythicStat.ApRegenMinus60s)
        ? 60
        : has(MythicStat.ApRegenMinus30s)
          ? 30
          : 0;

    const adventureScanExtra = has(MythicStat.AdventureScanTranscendent)
        ? 2
        : has(MythicStat.AdventureScanPlus1)
          ? 1
          : 0;

    const adventureMissileExtra = has(MythicStat.AdventureMissilePlus2)
        ? 2
        : has(MythicStat.AdventureMissilePlus1)
          ? 1
          : 0;

    const adventureGoldBonusPercentFromGear = has(MythicStat.AdventureGoldBonus20)
        ? 20
        : has(MythicStat.AdventureGoldBonus15)
          ? 15
          : 0;

    return {
        guildBossDamagePercent,
        guildBossRewardTierShift,
        guildBossDuplicateRewardCount,
        towerApMinusOneFloors1to35,
        towerApMinusOneAllFloors,
        apRegenExtraReductionSec,
        adventureScanExtra,
        adventureMissileExtra,
        adventureGoldBonusPercentFromGear,
    };
}

/** 도전의 탑 층 번호에 대한 AP 할인(정수, 보통 0 또는 1) */
export function towerApDiscountForFloor(bonuses: SpecialOptionGearBonuses, floor: number): number {
    if (bonuses.towerApMinusOneAllFloors) return 1;
    if (bonuses.towerApMinusOneFloors1to35 && floor >= 1 && floor <= 35) return 1;
    return 0;
}
