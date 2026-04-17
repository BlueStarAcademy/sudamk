import type { User } from '../types/index.js';
import { CoreStat } from '../types/enums.js';
import type { ArenaEntranceKey } from '../../constants/arenaEntrance.js';

/** 전략바둑 레벨 — 도전의 탑·모험 입장 */
export const TOWER_ADVENTURE_MIN_STRATEGY_LEVEL = 3;
/** 전략·놀이 PVP 대기실: 통합 레벨(전략+놀이 레벨 합) */
export const PVP_LOBBIES_MIN_COMBINED_LEVEL = 3;
/** 챔피언십: 6개 바둑 능력치 합(장비 반영 `calculateTotalStats` 기준) */
export const CHAMPIONSHIP_MIN_BADUK_ABILITY_TOTAL = 700;
/** 퀵 메뉴 퀘스트: 전략 레벨 */
export const QUEST_MIN_STRATEGY_LEVEL = 2;
/** 퀵 메뉴 대장간: 바둑 능력치 합 */
export const BLACKSMITH_MIN_BADUK_ABILITY_TOTAL = 650;

export type BadukAbilitySnapshot = {
    strategyLevel: number;
    playfulLevel: number;
    badukAbilityTotal: number;
};

export function sumCoreStatsTotal(total: Record<CoreStat, number>): number {
    let s = 0;
    for (const k of Object.values(CoreStat)) {
        s += Math.max(0, Number(total[k]) || 0);
    }
    return s;
}

export function getBadukAbilitySnapshotFromStats(user: User, totalStats: Record<CoreStat, number>): BadukAbilitySnapshot {
    return {
        strategyLevel: Math.max(1, Number(user.strategyLevel) || 1),
        playfulLevel: Math.max(1, Number(user.playfulLevel) || 1),
        badukAbilityTotal: sumCoreStatsTotal(totalStats),
    };
}

/** 서버 KV `merge` 결과에 사용자 성장 조건을 AND로 반영 */
export function applyUserProgressionArenaLocks(
    merged: Record<ArenaEntranceKey, boolean>,
    snap: BadukAbilitySnapshot,
): Record<ArenaEntranceKey, boolean> {
    const out: Record<ArenaEntranceKey, boolean> = { ...merged };
    const combined = snap.strategyLevel + snap.playfulLevel;

    if (snap.strategyLevel < TOWER_ADVENTURE_MIN_STRATEGY_LEVEL) {
        out.tower = false;
        out.adventure = false;
    }
    if (combined < PVP_LOBBIES_MIN_COMBINED_LEVEL) {
        out.strategicLobby = false;
        out.playfulLobby = false;
    }
    if (snap.badukAbilityTotal < CHAMPIONSHIP_MIN_BADUK_ABILITY_TOTAL) {
        out.championship = false;
    }
    return out;
}

export function isQuestQuickUnlocked(snap: Pick<BadukAbilitySnapshot, 'strategyLevel'>): boolean {
    return snap.strategyLevel >= QUEST_MIN_STRATEGY_LEVEL;
}

export function isBlacksmithQuickUnlocked(snap: Pick<BadukAbilitySnapshot, 'badukAbilityTotal'>): boolean {
    return snap.badukAbilityTotal >= BLACKSMITH_MIN_BADUK_ABILITY_TOTAL;
}

export const USER_PROGRESSION_ARENA_BLOCK_MESSAGE: Partial<Record<ArenaEntranceKey, string>> = {
    tower: `도전의 탑은 전략 바둑 레벨 ${TOWER_ADVENTURE_MIN_STRATEGY_LEVEL} 이상에서 입장할 수 있습니다.`,
    strategicLobby: `전략 바둑 대기실은 통합 레벨(전략+놀이) ${PVP_LOBBIES_MIN_COMBINED_LEVEL} 이상에서 입장할 수 있습니다.`,
    playfulLobby: `놀이 바둑 대기실은 통합 레벨(전략+놀이) ${PVP_LOBBIES_MIN_COMBINED_LEVEL} 이상에서 입장할 수 있습니다.`,
    championship: `챔피언십은 바둑 능력치 합 ${CHAMPIONSHIP_MIN_BADUK_ABILITY_TOTAL} 이상에서 입장할 수 있습니다.`,
    adventure: `모험은 전략 바둑 레벨 ${TOWER_ADVENTURE_MIN_STRATEGY_LEVEL} 이상에서 입장할 수 있습니다.`,
};

export const USER_PROGRESSION_QUEST_BLOCK_MESSAGE = `퀘스트는 전략 바둑 레벨 ${QUEST_MIN_STRATEGY_LEVEL} 이상에서 이용할 수 있습니다.`;
export const USER_PROGRESSION_BLACKSMITH_BLOCK_MESSAGE = `대장간은 바둑 능력치 합 ${BLACKSMITH_MIN_BADUK_ABILITY_TOTAL} 이상에서 이용할 수 있습니다.`;
