import type { User } from '../types/index.js';
import { CoreStat } from '../types/enums.js';
import type { ArenaEntranceKey } from '../../constants/arenaEntrance.js';

/** 도전의 탑 입장: 바둑학원 입문반 10 스테이지 최초 클리어 필요 */
export const TOWER_ENTRANCE_REQUIRED_STAGE_ID = '입문-10';
/** 모험 입장: 바둑학원 입문반 20 스테이지 최초 클리어 필요 */
export const ADVENTURE_ENTRANCE_REQUIRED_STAGE_ID = '입문-20';
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
};

export function sumCoreStatsTotal(total: Record<CoreStat, number>): number {
    let s = 0;
    for (const k of Object.values(CoreStat)) {
        s += Math.max(0, Number(total[k]) || 0);
    }
    return s;
}

export function getBadukAbilitySnapshotFromStats(user: User, totalStats: Record<CoreStat, number>): BadukAbilitySnapshot {
    const ul = Math.max(1, Number(user.userLevel) || 1);
    return {
        userLevel: ul,
        strategyLevel: ul,
        playfulLevel: ul,
        badukAbilityTotal: sumCoreStatsTotal(totalStats),
        clearedSinglePlayerStages: Array.isArray(user.clearedSinglePlayerStages) ? user.clearedSinglePlayerStages : [],
    };
}

/** 서버 KV `merge` 결과에 사용자 성장 조건을 AND로 반영 */
export function applyUserProgressionArenaLocks(
    merged: Record<ArenaEntranceKey, boolean>,
    snap: BadukAbilitySnapshot,
): Record<ArenaEntranceKey, boolean> {
    const out: Record<ArenaEntranceKey, boolean> = { ...merged };
    const clearedStageSet = new Set(snap.clearedSinglePlayerStages);
    if (!clearedStageSet.has(TOWER_ENTRANCE_REQUIRED_STAGE_ID)) {
        out.tower = false;
    }
    if (!clearedStageSet.has(ADVENTURE_ENTRANCE_REQUIRED_STAGE_ID)) {
        out.adventure = false;
    }
    if (snap.userLevel < PVP_LOBBIES_MIN_COMBINED_LEVEL) {
        out.strategicLobby = false;
        out.playfulLobby = false;
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
    tower: `도전의 탑은 바둑학원 입문반 10스테이지를 클리어하면 입장할 수 있습니다.`,
    strategicLobby: `전략 바둑 대기실은 유저 Lv.${PVP_LOBBIES_MIN_COMBINED_LEVEL}부터 입장할 수 있습니다.`,
    playfulLobby: `놀이 바둑 대기실은 유저 Lv.${PVP_LOBBIES_MIN_COMBINED_LEVEL}부터 입장할 수 있습니다.`,
    championship: `챔피언십은 바둑 능력치 합 ${CHAMPIONSHIP_MIN_BADUK_ABILITY_TOTAL} 이상에서 입장할 수 있습니다.`,
    adventure: `모험은 바둑학원 입문반 20스테이지를 클리어하면 입장할 수 있습니다.`,
};

export const USER_PROGRESSION_QUEST_BLOCK_MESSAGE = `퀘스트는 유저 Lv.${QUEST_MIN_STRATEGY_LEVEL} 이상에서 이용할 수 있습니다.`;
export const USER_PROGRESSION_BLACKSMITH_BLOCK_MESSAGE = `대장간은 바둑 능력치 합 ${BLACKSMITH_MIN_BADUK_ABILITY_TOTAL} 이상에서 이용할 수 있습니다.`;
