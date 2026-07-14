import { LiveGameSession, Player, SinglePlayerStageInfo } from '../types.js';
import {
    countTowerLobbyInventoryQty,
    TOWER_ITEM_HIDDEN_NAMES,
    TOWER_ITEM_MISSILE_NAMES,
    TOWER_ITEM_SCAN_NAMES,
    TOWER_ITEM_TURN_ADD_NAMES,
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

/** 인게임 도전의 탑 전면 배경 WebP (`public/images/bg/intower*.webp`) */
export function getTowerInGameBackgroundUrl(floor: number): string {
    const f = Math.floor(floor);
    if (!Number.isFinite(f) || f < 1) return '/images/bg/intower1.webp';
    if (f <= 20) return '/images/bg/intower1.webp';
    if (f <= 50) return '/images/bg/intower2.webp';
    if (f <= 80) return '/images/bg/intower3.webp';
    if (f <= 99) return '/images/bg/intower4.webp';
    return '/images/bg/intower5.webp';
}

/** 결과 모달·인게임 종료 푸터 공통: 유저(player1) 진영 승리 여부 (`TowerSummaryModal`·`TowerControls`와 동일). 베이스 등으로 백이 될 수 있음. */
export function isTowerHumanWinnerFromSession(
    session: Pick<
        LiveGameSession,
        'gameStatus' | 'winner' | 'analysisResult' | 'blackPlayerId' | 'whitePlayerId' | 'player1'
    >,
): boolean {
    const isEnded = session.gameStatus === 'ended';
    const isScoring = session.gameStatus === 'scoring';
    const analysisResult = session.analysisResult?.['system'];
    const humanId = session.player1?.id;
    const humanEnum: Player | null =
        humanId && session.blackPlayerId === humanId
            ? Player.Black
            : humanId && session.whitePlayerId === humanId
              ? Player.White
              : null;

    const humanWonByWinner = (): boolean =>
        humanEnum != null ? session.winner === humanEnum : session.winner === Player.Black;

    // 계가 중에도 서버가 먼저 winner를 넣는 경우가 있어 분석 전에 승패 UI가 뒤집히지 않게 한다.
    if (isScoring && session.winner != null) {
        return humanWonByWinner();
    }
    return isEnded && session.winner != null
        ? humanWonByWinner()
        : analysisResult?.scoreDetails
          ? (() => {
                const bt = analysisResult.scoreDetails.black?.total ?? 0;
                const wt = analysisResult.scoreDetails.white?.total ?? 0;
                if (humanEnum === Player.Black) return bt > wt;
                if (humanEnum === Player.White) return wt > bt;
                return (analysisResult.scoreDetails?.black?.total ?? 0) > (analysisResult.scoreDetails?.white?.total ?? 0);
            })()
          : humanWonByWinner();
}

/**
 * 해당 층에서 "이번 달 최초 클리어 보상"이 있는 도전인지.
 * 서버 `processTowerGameSummary`와 동일: `user.monthlyTowerFloor < floor` 일 때만 firstClear 지급.
 */
export function isTowerFirstClearAttemptOnFloor(
    userMonthlyTowerFloor: number | undefined | null,
    sessionFloor: number
): boolean {
    const clearedMax = Number(userMonthlyTowerFloor) || 0;
    return clearedMax < sessionFloor;
}

/** 탑 결과 summary에 실제 지급분(골드·EXP·펫·아이템)이 있는지 */
export function towerSummaryHasGrantedRewards(
    summary:
        | {
              gold?: number | null;
              xp?: { change?: number | null } | null;
              pairPetXp?: { change?: number | null } | null;
              items?: unknown[] | null;
          }
        | null
        | undefined,
): boolean {
    if (!summary) return false;
    return (
        (Number(summary.gold) || 0) > 0 ||
        (Number(summary.xp?.change) || 0) > 0 ||
        (Number(summary.pairPetXp?.change) || 0) > 0 ||
        (Array.isArray(summary.items) && summary.items.length > 0)
    );
}

export type TowerLobbyItemCounts = { missile: number; hidden: number; scan: number; turnAdd: number };

export function countTowerLobbyItems(
    inventory: Array<{ name?: string; id?: string; quantity?: number; source?: string | null }> | undefined
): TowerLobbyItemCounts {
    const inv = inventory || [];
    return {
        missile: countTowerLobbyInventoryQty(inv, TOWER_ITEM_MISSILE_NAMES),
        hidden: countTowerLobbyInventoryQty(inv, TOWER_ITEM_HIDDEN_NAMES),
        scan: countTowerLobbyInventoryQty(inv, TOWER_ITEM_SCAN_NAMES),
        turnAdd: countTowerLobbyInventoryQty(inv, TOWER_ITEM_TURN_ADD_NAMES),
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
        turnAdd: owned.turnAdd,
    };
}
