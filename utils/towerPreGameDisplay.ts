import { LiveGameSession, SinglePlayerStageInfo } from '../types.js';
import {
    countTowerLobbyInventoryQty,
    TOWER_ITEM_HIDDEN_NAMES,
    TOWER_ITEM_MISSILE_NAMES,
    TOWER_ITEM_SCAN_NAMES,
} from './towerLobbyInventory.js';

/** 세션에서 도전의 탑 층수 (towerFloor 우선, 없으면 stageId 파싱) */
export function getTowerSessionFloor(session: Pick<LiveGameSession, 'towerFloor' | 'stageId'>): number {
    const tf = session.towerFloor;
    if (typeof tf === 'number' && Number.isFinite(tf) && tf >= 1) return Math.floor(tf);
    const sid = session.stageId;
    if (sid?.startsWith('tower-')) {
        const n = parseInt(sid.replace('tower-', ''), 10);
        if (Number.isFinite(n) && n >= 1) return n;
    }
    return 1;
}

/**
 * 해당 층에서 "최초 클리어 보상"이 있는 도전인지.
 * 서버 `processTowerGameSummary`와 동일: `user.towerFloor < floor` 일 때만 firstClear 지급.
 */
export function isTowerFirstClearAttemptOnFloor(userTowerFloor: number | undefined | null, sessionFloor: number): boolean {
    const clearedMax = userTowerFloor ?? 0;
    return clearedMax < sessionFloor;
}

export type TowerLobbyItemCounts = { missile: number; hidden: number; scan: number };

export function countTowerLobbyItems(
    inventory: Array<{ name?: string; id?: string; quantity?: number; source?: string | null }> | undefined
): TowerLobbyItemCounts {
    const inv = inventory || [];
    return {
        missile: countTowerLobbyInventoryQty(inv, TOWER_ITEM_MISSILE_NAMES),
        hidden: countTowerLobbyInventoryQty(inv, TOWER_ITEM_HIDDEN_NAMES),
        scan: countTowerLobbyInventoryQty(inv, TOWER_ITEM_SCAN_NAMES),
    };
}

/**
 * 경기 시작 전 모달에 표시할 미사일/히든/스캔 개수 (가방 보유와 스테이지 상한 중 작은 값).
 */
export function getTowerItemDisplayCaps(
    stage: SinglePlayerStageInfo | undefined,
    inventory: Array<{ name?: string; id?: string; quantity?: number; source?: string | null }> | undefined
): TowerLobbyItemCounts {
    const owned = countTowerLobbyItems(inventory);
    if (!stage) return owned;
    const capM = stage.missileCount ?? 0;
    const capH = stage.hiddenCount ?? 0;
    const capS = stage.scanCount ?? 0;
    return {
        missile: capM > 0 ? Math.min(capM, owned.missile) : 0,
        hidden: capH > 0 ? Math.min(capH, owned.hidden) : 0,
        scan: capS > 0 ? Math.min(capS, owned.scan) : 0,
    };
}
