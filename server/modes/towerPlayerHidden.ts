import * as types from '../../types/index.js';
import * as db from '../db.js';
import { pauseGameTimer, resumeGameTimer } from './shared.js';
import { runTowerStyleHiddenRevealAnimatingIfDue } from './towerStyleHiddenRevealAnimating.js';
import {
    buildHiddenScanAnimation,
    evaluateHiddenScanBoard,
    hasOpponentHiddenScanTargets,
    recordSoftHiddenScanDiscovery,
} from './hiddenScanShared.js';

type HandleActionResult = types.HandleActionResult;

/**
 * 탑 PVE: 대기실(타워 전용) 인벤 보유만 사용. min(스테이지 상한, 보유 수), 보유 0이면 0 (무료 기본 지급 없음).
 */
export const towerP1ConsumableAllowance = (inventoryQty: number, stageCap: number): number => {
    if (stageCap <= 0) return 0;
    if (inventoryQty <= 0) return 0;
    return Math.min(stageCap, inventoryQty);
};

/**
 * 도전의 탑 경기 중 상점 구매 시: 인벤은 이미 반영된 뒤 호출한다.
 * 세션 잔여(미사일·히든·스캔)를 스테이지 상한까지 올려 바로 아이템 사용 가능하게 한다.
 */
export function bumpTowerSessionConsumablesAfterShopPurchase(
    game: types.LiveGameSession,
    itemId: string,
    quantity: number
): boolean {
    if (game.gameCategory !== 'tower' || game.gameStatus !== 'playing') return false;
    const floor = (game as any).towerFloor ?? 0;
    if (floor < 21) return false;
    if (!Number.isFinite(quantity) || quantity <= 0) return false;

    const s = (game.settings || {}) as any;
    const bump = (key: 'missiles_p1' | 'hidden_stones_p1' | 'scans_p1', capKey: 'missileCount' | 'hiddenStoneCount' | 'scanCount', defaultCap: number) => {
        const capRaw = s[capKey];
        const cap = typeof capRaw === 'number' && capRaw > 0 ? capRaw : defaultCap;
        const cur = typeof (game as any)[key] === 'number' ? (game as any)[key] : 0;
        const next = Math.min(cap, Math.max(0, cur) + quantity);
        if (next === cur) return false;
        (game as any)[key] = next;
        return true;
    };

    if (itemId === '미사일') return bump('missiles_p1', 'missileCount', 2);
    if (itemId === '히든') return bump('hidden_stones_p1', 'hiddenStoneCount', 2);
    if (itemId === '스캔') return bump('scans_p1', 'scanCount', 2);
    return false;
}

export const TOWER_LOBBY_SCAN_NAMES = ['스캔', 'scan', 'Scan', 'SCAN', '스캔권', '스캔 아이템'] as const;
export const TOWER_LOBBY_HIDDEN_NAMES = ['히든', 'hidden', 'Hidden'] as const;
export const TOWER_LOBBY_MISSILE_NAMES = ['미사일', 'missile', 'Missile'] as const;

/**
 * 로비(인벤) 보유에 맞춰 P1 세션 잔여를 스테이지 상한까지 올린다.
 * 경기 중 구매 직후 세션 필드가 늦게 반영될 때 START_* 가 막히지 않도록 한다.
 */
export function syncTowerP1ConsumableSessionFromInventory(
    game: types.LiveGameSession,
    user: types.User,
    kind: 'missile' | 'hidden' | 'scan'
): boolean {
    if (game.gameCategory !== 'tower' || game.player1?.id !== user.id) return false;
    const floor = (game as any).towerFloor ?? 0;
    if (floor < 21) return false;
    const s = (game.settings || {}) as any;
    let names: string[];
    let key: 'missiles_p1' | 'hidden_stones_p1' | 'scans_p1';
    let cap: number;
    if (kind === 'missile') {
        names = [...TOWER_LOBBY_MISSILE_NAMES];
        key = 'missiles_p1';
        cap = typeof s.missileCount === 'number' && s.missileCount > 0 ? s.missileCount : 2;
    } else if (kind === 'hidden') {
        names = [...TOWER_LOBBY_HIDDEN_NAMES];
        key = 'hidden_stones_p1';
        cap = typeof s.hiddenStoneCount === 'number' && s.hiddenStoneCount > 0 ? s.hiddenStoneCount : 2;
    } else {
        names = [...TOWER_LOBBY_SCAN_NAMES];
        key = 'scans_p1';
        cap = typeof s.scanCount === 'number' && s.scanCount > 0 ? s.scanCount : 2;
    }
    const inv = countTowerLobbyInventoryQty(user.inventory, names);
    const allowance = towerP1ConsumableAllowance(inv, cap);
    const cur = typeof (game as any)[key] === 'number' ? (game as any)[key] : 0;
    // 인벤만 먼저 깎인 경우 등: 세션이 인벤 상한보다 크면 내려 맞춤(스캔이 '다시 생김' 방지)
    if (allowance < cur) {
        (game as any)[key] = allowance;
        return true;
    }
    if (allowance <= cur) return false;
    (game as any)[key] = allowance;
    return true;
}

/** 경기 중 1회 사용에 맞춰 타워 로비 인벤 스택 1 감소 (in-place). 성공 시 true */
export function consumeOneTowerLobbyInventoryItem(user: types.User, namesOrIds: readonly string[]): boolean {
    const inventory = user.inventory || [];
    const itemIndex = inventory.findIndex(
        (item: any) =>
            namesOrIds.some((n) => item.name === n || item.id === n) &&
            isTowerLobbyInventorySource(item) &&
            (item.quantity ?? 1) > 0
    );
    if (itemIndex === -1) return false;
    const item = inventory[itemIndex] as any;
    const q = item.quantity ?? 1;
    if (q > 1) item.quantity = q - 1;
    else inventory.splice(itemIndex, 1);
    return true;
}

/** LAUNCH_MISSILE 등 동기 핸들러에서 DB·브로드캐스트만 비동기로 처리 */
export function scheduleTowerP1InventorySave(user: types.User): void {
    void (async () => {
        try {
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            const { updateUserCache } = await import('../gameCache.js');
            broadcastUserUpdate(user, ['inventory', 'gold', 'diamonds', 'towerFloor']);
            updateUserCache(user);
        } catch (e) {
            console.error('[tower] scheduleTowerP1InventorySave failed:', e);
        }
    })();
}

/** 아이템 시간 초과 등으로 세션만 차감된 뒤 DB 인벤과 맞출 때 */
export async function persistTowerP1ConsumableDecrement(player1Id: string, kind: 'scan' | 'hidden' | 'missile'): Promise<void> {
    try {
        const user = await db.getUser(player1Id, { includeInventory: true });
        if (!user) return;
        const names =
            kind === 'scan' ? TOWER_LOBBY_SCAN_NAMES : kind === 'hidden' ? TOWER_LOBBY_HIDDEN_NAMES : TOWER_LOBBY_MISSILE_NAMES;
        if (!consumeOneTowerLobbyInventoryItem(user, names)) {
            console.warn(`[tower] persistTowerP1ConsumableDecrement: no stack kind=${kind} user=${player1Id}`);
            return;
        }
        await db.updateUser(user);
        const { broadcastUserUpdate } = await import('../socket.js');
        const { updateUserCache } = await import('../gameCache.js');
        broadcastUserUpdate(user, ['inventory', 'gold', 'diamonds', 'towerFloor']);
        updateUserCache(user);
    } catch (e) {
        console.error('[tower] persistTowerP1ConsumableDecrement failed:', e);
    }
}

/** 도전의 탑 대기실/상점 전용 인벤: source === 'tower' 또는 구 데이터(source 없음)만 합산 */
export const isTowerLobbyInventorySource = (item: { source?: string | null }): boolean =>
    item.source === 'tower' || item.source == null || item.source === '';

/** 이름/id가 일치하는 도전의 탑 전용 스택 수 합계 */
export const countTowerLobbyInventoryQty = (
    inventory: readonly { name?: string; id?: string; quantity?: number; source?: string | null }[] | undefined,
    namesOrIds: string[]
): number => {
    const inv = inventory || [];
    return inv
        .filter((item: any) => isTowerLobbyInventorySource(item))
        .filter((item: any) => namesOrIds.some((n) => item.name === n || item.id === n))
        .reduce((sum: number, item: any) => {
            const q = item.quantity;
            return sum + (typeof q === 'number' && Number.isFinite(q) ? Math.max(0, q) : 1);
        }, 0);
};

/**
 * 스캔 연속 모드(`scanning`)·스캔 애니(`scanning_animating`) 중 히든/미사일 등 다른 아이템을 쓰려 할 때
 * 본경기로 되돌려 400(Not playing)을 막는다.
 */
export function cancelTowerScanningSessionForOtherItemUse(game: types.LiveGameSession): void {
    if (game.gameCategory !== 'tower') return;
    if (game.gameStatus === 'scanning' || game.gameStatus === 'scanning_animating') {
        game.gameStatus = 'playing';
        game.animation = null;
        game.itemUseDeadline = undefined;
    }
}

/** 도전의 탑 PVE 히든/스캔 모드 초기화 (21층 이상, 히든 스테이지). 싱글플레이와 동일 규칙. */
export const initializeTowerPlayerHidden = (game: types.LiveGameSession) => {
    if (game.gameCategory !== 'tower') return;
    const floor = (game as any).towerFloor ?? 0;
    if (floor < 21) return;
    const isHiddenMode = game.mode === types.GameMode.Hidden || (game.mode === types.GameMode.Mix && (game.settings as any)?.mixedModes?.includes(types.GameMode.Hidden));
    if (!isHiddenMode) return;
    const s = (game.settings || {}) as any;
    // 유저 쪽은 CONFIRM/게임액션에서 인벤 기준으로 채움. 여기서 설정값으로 덮어 무료 지급하지 않음.
    if ((game as any).scans_p1 == null) game.scans_p1 = 0;
    if ((game as any).scans_p2 == null) (game as any).scans_p2 = s.scanCount ?? 0;
    if ((game as any).hidden_stones_p1 == null) (game as any).hidden_stones_p1 = 0;
    if ((game as any).hidden_stones_p2 == null) (game as any).hidden_stones_p2 = s.hiddenStoneCount ?? 0;
    if ((game as any).hidden_stones_used_p1 == null) (game as any).hidden_stones_used_p1 = 0;
    if ((game as any).hidden_stones_used_p2 == null) (game as any).hidden_stones_used_p2 = 0;
}

/** 도전의 탑 PVE 전용: 히든/스캔 아이템 타임아웃 및 애니메이션 전이. 싱글플레이와 동일 규칙. */
export const updateTowerPlayerHiddenState = async (game: types.LiveGameSession, now: number) => {
    if (game.gameCategory !== 'tower') return;

    const isItemMode = ['hidden_placing', 'scanning'].includes(game.gameStatus);

    if (game.gameStatus === 'scanning_animating' && game.itemUseDeadline && now > game.itemUseDeadline) {
        game.animation = null;
        game.gameStatus = 'playing';
        game.itemUseDeadline = undefined;
        game.pausedTurnTimeLeft = undefined;
        const timerResumed = resumeGameTimer(game, now, game.currentPlayer);
        if (!timerResumed) {
            game.itemUseDeadline = undefined;
            game.pausedTurnTimeLeft = undefined;
        }
        (game as any)._itemTimeoutStateChanged = true;
        return;
    }

    if (isItemMode && game.itemUseDeadline && now > game.itemUseDeadline) {
        const timedOutPlayerEnum = game.currentPlayer;
        const timedOutPlayerId = timedOutPlayerEnum === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
        const currentItemMode = game.gameStatus;

        console.log(`[updateTowerPlayerHiddenState] Item use timeout: mode=${currentItemMode}, player=${timedOutPlayerId}, gameId=${game.id}`);

        game.foulInfo = { message: `${game.player1.id === timedOutPlayerId ? game.player1.nickname : game.player2.nickname}님의 아이템 시간 초과!`, expiry: now + 4000 };
        game.gameStatus = 'playing';
        game.currentPlayer = timedOutPlayerEnum;

        let towerScanTimeoutConsumedSession = false;
        if (currentItemMode === 'hidden_placing') {
            const hiddenKey = timedOutPlayerId === game.player1.id ? 'hidden_stones_p1' : 'hidden_stones_p2';
            const currentHidden = (game as any)[hiddenKey] ?? 0;
            if (currentHidden > 0) {
                (game as any)[hiddenKey] = currentHidden - 1;
                const usedKey = timedOutPlayerId === game.player1.id ? 'hidden_stones_used_p1' : 'hidden_stones_used_p2';
                (game as any)[usedKey] = ((game as any)[usedKey] || 0) + 1;
            }
        } else if (currentItemMode === 'scanning') {
            const scanKey = timedOutPlayerId === game.player1.id ? 'scans_p1' : 'scans_p2';
            const currentScans = (game as any)[scanKey] ?? 0;
            if (currentScans > 0) {
                (game as any)[scanKey] = currentScans - 1;
                towerScanTimeoutConsumedSession = true;
            }
        }

        const timerResumed = resumeGameTimer(game, now, timedOutPlayerEnum);
        if (!timerResumed) {
            game.itemUseDeadline = undefined;
            game.pausedTurnTimeLeft = undefined;
        }
        (game as any)._itemTimeoutStateChanged = true;
        if (timedOutPlayerId === game.player1.id) {
            if (currentItemMode === 'hidden_placing') void persistTowerP1ConsumableDecrement(game.player1.id, 'hidden');
            else if (currentItemMode === 'scanning' && towerScanTimeoutConsumedSession) {
                void persistTowerP1ConsumableDecrement(game.player1.id, 'scan');
            }
        }
        return;
    }

    switch (game.gameStatus) {
        case 'scanning_animating': {
            const anim = game.animation;
            const scanEnded =
                !anim ||
                anim.type !== 'scan' ||
                now >= anim.startTime + anim.duration;
            if (scanEnded) {
                if (anim && anim.type === 'scan') {
                    const scanUserId = (anim as { type: 'scan'; playerId: string }).playerId;
                    const scanPlayerEnum =
                        scanUserId === game.blackPlayerId
                            ? types.Player.Black
                            : scanUserId === game.whitePlayerId
                              ? types.Player.White
                              : game.currentPlayer;
                    game.currentPlayer = scanPlayerEnum;
                }
                game.animation = null;
                game.gameStatus = 'playing';
                game.itemUseDeadline = undefined;
                game.pausedTurnTimeLeft = undefined;
                const cur = game.currentPlayer;
                if (cur !== types.Player.None) {
                    const resumed = resumeGameTimer(game, now, cur);
                    if (!resumed) {
                        game.itemUseDeadline = undefined;
                        game.pausedTurnTimeLeft = undefined;
                    }
                }
                (game as any)._itemTimeoutStateChanged = true;
            }
            break;
        }
        case 'hidden_reveal_animating':
            await runTowerStyleHiddenRevealAnimatingIfDue(game, now, {
                logPrefix: 'updateTowerPlayerHiddenState',
                onPostTurnSwitch: async (g) => {
                    const floor = (g as any).towerFloor ?? 0;
                    const stageId = g.stageId || `tower-${floor}`;
                    const { TOWER_STAGES } = await import('../../constants/towerConstants.js');
                    const stage =
                        TOWER_STAGES.find((s: { id: string }) => s.id === stageId) ||
                        TOWER_STAGES.find((s: { id: string }) => parseInt(s.id.replace('tower-', ''), 10) === floor);
                    const autoScoringTurns = (stage as any)?.autoScoringTurns;
                    if (autoScoringTurns !== undefined) {
                        const isAiTurn = g.currentPlayer === types.Player.White && g.gameCategory === 'tower';
                        if (!isAiTurn) {
                            const validMoves = g.moveHistory.filter(m => m.x !== -1 && m.y !== -1);
                            const totalTurns = g.totalTurns ?? validMoves.length;
                            g.totalTurns = totalTurns;
                            if (totalTurns >= autoScoringTurns && g.gameStatus === 'playing') {
                                const { getGameResult } = await import('../gameModes.js');
                                await getGameResult(g);
                            }
                        }
                    }
                },
            });
            break;
        case 'hidden_final_reveal':
            if (game.revealAnimationEndTime && now >= game.revealAnimationEndTime) {
                game.animation = null;
                game.revealAnimationEndTime = undefined;
                game.gameStatus = 'scoring';
                const { getGameResult } = await import('../gameModes.js');
                await getGameResult(game);
            }
            break;
    }
};

/** 도전의 탑 PVE 전용: START_HIDDEN_PLACEMENT / START_SCANNING / SCAN_BOARD 처리. 싱글플레이와 동일 규칙. */
export const handleTowerPlayerHiddenAction = (volatileState: types.VolatileState, game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): HandleActionResult | null => {
    if (game.gameCategory !== 'tower') return null;

    const { type, payload } = action as any;
    const now = Date.now();
    let myPlayerEnum = user.id === game.blackPlayerId ? types.Player.Black : (user.id === game.whitePlayerId ? types.Player.White : types.Player.None);
    if (myPlayerEnum === types.Player.None && game.player1?.id === user.id) {
        myPlayerEnum = types.Player.Black;
    }
    const isMyTurn = myPlayerEnum === game.currentPlayer;

    if (type === 'START_HIDDEN_PLACEMENT') {
        cancelTowerScanningSessionForOtherItemUse(game);
    }

    switch (type) {
        case 'START_HIDDEN_PLACEMENT':
            if (!isMyTurn) return { error: "Not your turn to use an item." };
            if (game.gameStatus !== 'playing') return { error: "Not your turn to use an item." };
            const hiddenKey = user.id === game.blackPlayerId ? 'hidden_stones_p1' : 'hidden_stones_p2';
            if (hiddenKey === 'hidden_stones_p1' && game.player1?.id === user.id) {
                syncTowerP1ConsumableSessionFromInventory(game, user, 'hidden');
            }
            const currentHidden = (game as any)[hiddenKey] ?? 0;
            if (currentHidden <= 0) return { error: "No hidden stones left." };
            game.gameStatus = 'hidden_placing';
            pauseGameTimer(game, now, 30000);
            return {};
        case 'START_SCANNING': {
            if (!isMyTurn) return { error: "Not your turn to use an item." };
            const scanKeyStart = user.id === game.blackPlayerId ? 'scans_p1' : 'scans_p2';
            if (scanKeyStart === 'scans_p1' && game.player1?.id === user.id) {
                syncTowerP1ConsumableSessionFromInventory(game, user, 'scan');
            }
            if (((game as any)[scanKeyStart] ?? 0) <= 0) return { error: "No scans left." };
            const opponentPlayerEnum = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
            const isMixWithHidden =
                game.mode === types.GameMode.Mix &&
                Array.isArray((game.settings as any)?.mixedModes) &&
                (game.settings as any).mixedModes.includes(types.GameMode.Hidden);
            const stageAllowsHiddenStones = ((game.settings as any)?.hiddenStoneCount ?? 0) > 0 || isMixWithHidden;
            const opponentHasUnrevealedHidden = hasOpponentHiddenScanTargets(game, user.id, opponentPlayerEnum, {
                includeLooseOpponentStones: true,
                hiddenStoneCountOrMix: stageAllowsHiddenStones,
            });
            if (!opponentHasUnrevealedHidden) return { error: "No hidden stones to scan." };
            // 이미 스캔 연속 모드(scanning)면 재진입만(타이머 갱신). playing만 허용하면 연속 스캔 후 400이 난다.
            if (game.gameStatus === 'scanning') {
                pauseGameTimer(game, now, 30000);
                return {};
            }
            if (game.gameStatus !== 'playing') return { error: "Not your turn to use an item." };
            game.gameStatus = 'scanning';
            pauseGameTimer(game, now, 30000);
            return {};
        }
        case 'SCAN_BOARD':
            // 타임아웃 직후·애니 중 중복 요청: 400 대신 무해 처리 (인벤/세션 스캔 이중 차감 방지)
            if (game.gameStatus === 'playing' || game.gameStatus === 'scanning_animating') {
                return { skipTowerScanInventoryConsume: true };
            }
            if (game.gameStatus !== 'scanning') return { error: "Not in scanning mode." };
            const { x, y } = payload;
            const scanKey = user.id === game.blackPlayerId ? 'scans_p1' : 'scans_p2';
            if (scanKey === 'scans_p1' && game.player1?.id === user.id) {
                syncTowerP1ConsumableSessionFromInventory(game, user, 'scan');
            }
            if (((game as any)[scanKey] ?? 0) <= 0) return { error: "No scans left." };

            const evalResult = evaluateHiddenScanBoard(game, user.id, x, y);
            if (evalResult.success) {
                recordSoftHiddenScanDiscovery(game, user.id, evalResult);
            }
            (game as any)[scanKey] = Math.max(0, ((game as any)[scanKey] ?? 0) - 1);
            const success = evalResult.success;
            game.animation = buildHiddenScanAnimation(now, user.id, x, y, success);
            game.gameStatus = 'scanning_animating';
            game.currentPlayer = myPlayerEnum;
            const scanResumeOk = resumeGameTimer(game, now, myPlayerEnum);
            if (!scanResumeOk) {
                game.itemUseDeadline = undefined;
                game.pausedTurnTimeLeft = undefined;
            }
            return {};
    }

    return null;
}
