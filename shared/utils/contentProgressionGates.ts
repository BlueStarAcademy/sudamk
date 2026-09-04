import type { User } from '../types/index.js';
import { CoreStat, GameMode } from '../types/enums.js';
import type { ArenaEntranceKey } from '../../constants/arenaEntrance.js';
import {
    getAdventureUnderstandingTierFromXp,
    type AdventureUnderstandingTierIndex,
} from '../../constants/adventureConstants.js';
import { getEquippedPairPetInventoryRow } from './pairEquippedPet.js';

/** 탐험(어드벤처 맵) 1챕터 stageId — 탑 해금·챕터 진행 기준 */
export const TOWER_ENTRANCE_ADVENTURE_STAGE_ID = 'neighborhood_hill';
/** 도전의 탑: 탐험 1챕터 이해도 티어(편함=1) 이상 */
export const TOWER_ENTRANCE_MIN_UNDERSTANDING_TIER: AdventureUnderstandingTierIndex = 1;

/**
 * @deprecated 탑은 탐험 이해도로 해금. 레거시 스테이지 클리어 참조용 별칭.
 * 신규 코드는 `TOWER_ENTRANCE_ADVENTURE_STAGE_ID` / `isTowerUnlockedByProgression` 사용.
 */
export const TOWER_ENTRANCE_REQUIRED_STAGE_ID = '입문-10';

/** 탐험 입장: 모험 새싹의 숲 5관문 최초 클리어 + 대표펫 장착 */
export const ADVENTURE_ENTRANCE_REQUIRED_STAGE_ID = '입문-5';

/** PVP/AI 경기장: 1레벨부터 이용 가능 */
export const PVP_LOBBIES_MIN_COMBINED_LEVEL = 1;
/** 챔피언십: 6개 바둑 능력치 합(장비 반영 `calculateTotalStats` 기준) */
export const CHAMPIONSHIP_MIN_BADUK_ABILITY_TOTAL = 700;
/** 퀵 메뉴 퀘스트: 유저 레벨 */
export const QUEST_MIN_STRATEGY_LEVEL = 2;
/** 퀵 메뉴 대장간: 바둑 능력치 합 */
export const BLACKSMITH_MIN_BADUK_ABILITY_TOTAL = 650;

export type BadukAbilitySnapshot = {
    /** 통합 유저 레벨 */
    userLevel: number;
    /** @deprecated `userLevel`과 동일(호환용) */
    strategyLevel: number;
    /** @deprecated `userLevel`과 동일(호환용) */
    playfulLevel: number;
    badukAbilityTotal: number;
    clearedSinglePlayerStages: string[];
    /** 대표펫 장착 여부 */
    hasEquippedPairPet: boolean;
    /** 탐험 지역별 이해도 XP */
    adventureUnderstandingXpByStage: Partial<Record<string, number>>;
};

export function sumCoreStatsTotal(total: Record<CoreStat, number>): number {
    let s = 0;
    for (const k of Object.values(CoreStat)) {
        s += Math.max(0, Number(total[k]) || 0);
    }
    return s;
}

export function userHasEquippedPairPet(user: Pick<User, 'inventory' | 'equippedPairPetTemplateId' | 'equippedPairPetInventoryItemId' | 'pairPetTrainingSlots'>): boolean {
    return getEquippedPairPetInventoryRow(user) != null;
}

export function isTowerUnlockedByProgression(
    snap: Pick<BadukAbilitySnapshot, 'adventureUnderstandingXpByStage'>,
): boolean {
    const xp = snap.adventureUnderstandingXpByStage?.[TOWER_ENTRANCE_ADVENTURE_STAGE_ID] ?? 0;
    return getAdventureUnderstandingTierFromXp(xp) >= TOWER_ENTRANCE_MIN_UNDERSTANDING_TIER;
}

export function isAdventureUnlockedByProgression(
    snap: Pick<BadukAbilitySnapshot, 'clearedSinglePlayerStages' | 'hasEquippedPairPet'>,
): boolean {
    const cleared = new Set(snap.clearedSinglePlayerStages);
    return cleared.has(ADVENTURE_ENTRANCE_REQUIRED_STAGE_ID) && snap.hasEquippedPairPet;
}

export function getBadukAbilitySnapshotFromStats(user: User, totalStats: Record<CoreStat, number>): BadukAbilitySnapshot {
    const ul = Math.max(1, Number(user.userLevel) || 1);
    const understanding = user.adventureProfile?.understandingXpByStage ?? {};
    return {
        userLevel: ul,
        strategyLevel: ul,
        playfulLevel: ul,
        badukAbilityTotal: sumCoreStatsTotal(totalStats),
        clearedSinglePlayerStages: Array.isArray(user.clearedSinglePlayerStages) ? user.clearedSinglePlayerStages : [],
        hasEquippedPairPet: userHasEquippedPairPet(user),
        adventureUnderstandingXpByStage: { ...understanding },
    };
}

/** 서버 KV `merge` 결과에 사용자 성장 조건을 AND로 반영 */
export function applyUserProgressionArenaLocks(
    merged: Record<ArenaEntranceKey, boolean>,
    snap: BadukAbilitySnapshot,
): Record<ArenaEntranceKey, boolean> {
    const out: Record<ArenaEntranceKey, boolean> = { ...merged };
    if (!isTowerUnlockedByProgression(snap)) {
        out.tower = false;
    }
    if (!isAdventureUnlockedByProgression(snap)) {
        out.adventure = false;
    }
    if (snap.userLevel < PVP_LOBBIES_MIN_COMBINED_LEVEL) {
        out.strategicLobby = false;
        out.normalLobby = false;
        out.friendlyLobby = false;
        out.playfulLobby = false;
        out.pairLobby = false;
    }
    if (snap.badukAbilityTotal < CHAMPIONSHIP_MIN_BADUK_ABILITY_TOTAL) {
        out.championship = false;
    }
    return out;
}

export function isQuestQuickUnlocked(snap: Pick<BadukAbilitySnapshot, 'userLevel'>): boolean {
    const lv = snap.userLevel;
    return lv >= QUEST_MIN_STRATEGY_LEVEL;
}

export function isBlacksmithQuickUnlocked(snap: Pick<BadukAbilitySnapshot, 'badukAbilityTotal'>): boolean {
    return snap.badukAbilityTotal >= BLACKSMITH_MIN_BADUK_ABILITY_TOTAL;
}

export const USER_PROGRESSION_ARENA_BLOCK_MESSAGE: Partial<Record<ArenaEntranceKey, string>> = {
    tower: `도전의 탑은 탐험 「동네뒷산」 이해도가 편함 이상이 되면 입장할 수 있습니다.`,
    strategicLobby: `랭킹전은 유저 Lv.${PVP_LOBBIES_MIN_COMBINED_LEVEL}부터 입장할 수 있습니다.`,
    normalLobby: `일반전은 유저 Lv.${PVP_LOBBIES_MIN_COMBINED_LEVEL}부터 입장할 수 있습니다.`,
    friendlyLobby: `친선전은 유저 Lv.${PVP_LOBBIES_MIN_COMBINED_LEVEL}부터 입장할 수 있습니다.`,
    playfulLobby: `놀이터는 유저 Lv.${PVP_LOBBIES_MIN_COMBINED_LEVEL}부터 입장할 수 있습니다.`,
    championship: `챔피언십은 바둑 능력치 합 ${CHAMPIONSHIP_MIN_BADUK_ABILITY_TOTAL} 이상에서 입장할 수 있습니다.`,
    adventure: `탐험은 모험 새싹의 숲 5관문을 클리어하고 대표펫을 장착하면 입장할 수 있습니다.`,
};

export const USER_PROGRESSION_QUEST_BLOCK_MESSAGE = `퀘스트는 유저 Lv.${QUEST_MIN_STRATEGY_LEVEL} 이상에서 이용할 수 있습니다.`;
export const USER_PROGRESSION_BLACKSMITH_BLOCK_MESSAGE = `대장간은 바둑 능력치 합 ${BLACKSMITH_MIN_BADUK_ABILITY_TOTAL} 이상에서 이용할 수 있습니다.`;

/** 랭킹전 일색/캐슬/체스: 친선전·훈련 머신(AI대전) 해당 모드 완료 판수 */
export const RANKED_MODE_FRIENDLY_UNLOCK_GAMES = 5;

/** 친선전·훈련 머신 완료 후 랭킹전에서 해금되는 모드 */
export const RANKED_FRIENDLY_UNLOCK_MODES: readonly GameMode[] = [
    GameMode.Uniform,
    GameMode.Castle,
    GameMode.Chess,
];

export function isRankedFriendlyUnlockMode(mode: GameMode | string | null | undefined): boolean {
    return RANKED_FRIENDLY_UNLOCK_MODES.includes(mode as GameMode);
}

/**
 * 랭킹전 모드 해금용 완료 판수.
 * `stats[mode].friendlyCompletions` — 친선전·훈련 머신(AI대전) 완료가 합산됨.
 */
export function getFriendlyModeCompletions(
    user: Pick<User, 'stats' | 'isAdmin'> | null | undefined,
    mode: GameMode | string,
): number {
    if (!user?.stats) return 0;
    const row = user.stats[String(mode)];
    const n = Number(row?.friendlyCompletions ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** @see getFriendlyModeCompletions */
export function getRankedModeUnlockCompletions(
    user: Pick<User, 'stats' | 'isAdmin'> | null | undefined,
    mode: GameMode | string,
): number {
    return getFriendlyModeCompletions(user, mode);
}

/** 관리자는 즉시 해금. 그 외는 친선전·훈련 머신(AI대전) 해당 모드 완료 5판. */
export function isRankedModeUnlockedForUser(
    user: Pick<User, 'stats' | 'isAdmin'> | null | undefined,
    mode: GameMode | string,
): boolean {
    if (!isRankedFriendlyUnlockMode(mode)) return true;
    if (user?.isAdmin) return true;
    return getRankedModeUnlockCompletions(user, mode) >= RANKED_MODE_FRIENDLY_UNLOCK_GAMES;
}
