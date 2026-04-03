import * as types from '../../types/index.js';
import * as db from '../db.js';
import { pauseGameTimer, resumeGameTimer } from './shared.js';
import {
    consumeOpponentPatternStoneIfAny,
    stripPatternStonesAtConsumedIntersections,
} from '../../shared/utils/patternStoneConsume.js';

type HandleActionResult = types.HandleActionResult;

/**
 * 탑 PVE: 대기실(타워 전용) 인벤 보유만 사용. min(스테이지 상한, 보유 수), 보유 0이면 0 (무료 기본 지급 없음).
 */
export const towerP1ConsumableAllowance = (inventoryQty: number, stageCap: number): number => {
    if (stageCap <= 0) return 0;
    if (inventoryQty <= 0) return 0;
    return Math.min(stageCap, inventoryQty);
};

export const TOWER_LOBBY_SCAN_NAMES = ['스캔', 'scan', 'Scan', 'SCAN', '스캔권', '스캔 아이템'] as const;
export const TOWER_LOBBY_HIDDEN_NAMES = ['히든', 'hidden', 'Hidden'] as const;
export const TOWER_LOBBY_MISSILE_NAMES = ['미사일', 'missile', 'Missile'] as const;

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

    if (isItemMode && game.itemUseDeadline && now > game.itemUseDeadline) {
        const timedOutPlayerEnum = game.currentPlayer;
        const timedOutPlayerId = timedOutPlayerEnum === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
        const currentItemMode = game.gameStatus;

        console.log(`[updateTowerPlayerHiddenState] Item use timeout: mode=${currentItemMode}, player=${timedOutPlayerId}, gameId=${game.id}`);

        game.foulInfo = { message: `${game.player1.id === timedOutPlayerId ? game.player1.nickname : game.player2.nickname}님의 아이템 시간 초과!`, expiry: now + 4000 };
        game.gameStatus = 'playing';
        game.currentPlayer = timedOutPlayerEnum;

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
            if (currentScans > 0) (game as any)[scanKey] = currentScans - 1;
        }

        resumeGameTimer(game, now, timedOutPlayerEnum);
        (game as any)._itemTimeoutStateChanged = true;
        if (timedOutPlayerId === game.player1.id) {
            if (currentItemMode === 'hidden_placing') void persistTowerP1ConsumableDecrement(game.player1.id, 'hidden');
            else if (currentItemMode === 'scanning') void persistTowerP1ConsumableDecrement(game.player1.id, 'scan');
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
                (game as any)._itemTimeoutStateChanged = true;
            }
            break;
        }
        case 'hidden_reveal_animating':
            if (game.revealAnimationEndTime && now >= game.revealAnimationEndTime) {
                const { pendingCapture } = game;
                const isAiTurnCancelled = (game as any).isAiTurnCancelledAfterReveal;
                if (!pendingCapture) {
                    game.animation = null;
                    game.gameStatus = 'playing';
                    game.revealAnimationEndTime = undefined;
                    game.pendingCapture = null;
                    (game as any).isAiTurnCancelledAfterReveal = undefined;
                    const cur = game.currentPlayer;
                    if (game.settings?.timeLimit > 0 && game.pausedTurnTimeLeft !== undefined) {
                        const timeKey = cur === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                        game[timeKey] = game.pausedTurnTimeLeft;
                        game.turnDeadline = now + (game[timeKey] ?? 0) * 1000;
                        game.turnStartTime = now;
                    } else {
                        game.turnDeadline = undefined;
                        game.turnStartTime = undefined;
                    }
                    game.pausedTurnTimeLeft = undefined;
                    break;
                }
                game.gameStatus = 'playing';
                const myPlayerEnum = pendingCapture?.move.player || game.currentPlayer;
                resumeGameTimer(game, now, myPlayerEnum);

                if (pendingCapture) {
                    const myP = pendingCapture.move.player;
                    const opponentP = myP === types.Player.Black ? types.Player.White : types.Player.Black;
                    if (!game.justCaptured) game.justCaptured = [];
                    for (const stone of pendingCapture.stones) {
                        game.boardState[stone.y][stone.x] = types.Player.None;
                        const isBaseStone = game.baseStones?.some(bs => bs.x === stone.x && bs.y === stone.y);
                        const moveIndex = game.moveHistory.findIndex(m => m.x === stone.x && m.y === stone.y);
                        const wasHidden = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
                        const wasAiInitialHidden = (game as any).aiInitialHiddenStone &&
                            (game as any).aiInitialHiddenStone.x === stone.x && (game as any).aiInitialHiddenStone.y === stone.y;
                        if (wasAiInitialHidden) (game as any).aiInitialHiddenStone = undefined;
                        let points = 1;
                        let wasHiddenForEntry = false;
                        if (isBaseStone) {
                            game.baseStoneCaptures[myP]++;
                            points = 5;
                        } else if (consumeOpponentPatternStoneIfAny(game, stone, opponentP)) {
                            points = 2;
                        } else if (wasHidden || wasAiInitialHidden) {
                            game.hiddenStoneCaptures[myP] = (game.hiddenStoneCaptures[myP] || 0) + 1;
                            points = 5;
                            wasHiddenForEntry = true;
                        }
                        game.captures[myP] += points;
                        game.justCaptured.push({ point: stone, player: opponentP, wasHidden: wasHiddenForEntry || wasAiInitialHidden, capturePoints: points });
                    }
                    stripPatternStonesAtConsumedIntersections(game);
                    if (!game.newlyRevealed) game.newlyRevealed = [];
                    game.newlyRevealed.push(...pendingCapture.hiddenContributors.map(p => ({ point: p, player: myP })));
                }

                game.animation = null;
                game.revealAnimationEndTime = undefined;
                game.pendingCapture = null;
                (game as any).isAiTurnCancelledAfterReveal = undefined;

                if (isAiTurnCancelled) {
                    game.gameStatus = 'playing';
                    if (game.settings?.timeLimit > 0 && game.pausedTurnTimeLeft != null) {
                        const aiTimeKey = game.currentPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                        (game as any)[aiTimeKey] = game.pausedTurnTimeLeft;
                    }
                    game.pausedTurnTimeLeft = undefined;
                    await db.saveGame(game);
                    const { broadcastToGameParticipants } = await import('../socket.js');
                    const { updateGameCache } = await import('../gameCache.js');
                    updateGameCache(game);
                    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                    const { makeAiMove } = await import('../aiPlayer.js');
                    setImmediate(() => {
                        makeAiMove(game).then(async () => {
                            try {
                                updateGameCache(game);
                                await db.saveGame(game);
                                broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                            } catch (e: any) {
                                console.error(`[updateTowerPlayerHiddenState] AI move after hidden reveal failed for ${game.id}:`, e?.message);
                            }
                        }).catch((err: any) => {
                            console.error(`[updateTowerPlayerHiddenState] makeAiMove after hidden reveal failed for ${game.id}:`, err?.message);
                        });
                    });
                    return;
                }

                game.gameStatus = 'playing';
                const playerWhoMoved = game.currentPlayer;
                const nextPlayer = playerWhoMoved === types.Player.Black ? types.Player.White : types.Player.Black;
                game.currentPlayer = nextPlayer;
                game.pausedTurnTimeLeft = undefined;

                const floor = (game as any).towerFloor ?? 0;
                const stageId = game.stageId || `tower-${floor}`;
                const { TOWER_STAGES } = await import('../../constants/towerConstants.js');
                const stage = TOWER_STAGES.find((s: { id: string }) => s.id === stageId) || TOWER_STAGES.find((s: { id: string }) => parseInt(s.id.replace('tower-', ''), 10) === floor);
                const autoScoringTurns = (stage as any)?.autoScoringTurns;
                if (autoScoringTurns !== undefined) {
                    const isAiTurn = game.currentPlayer === types.Player.White && game.gameCategory === 'tower';
                    if (!isAiTurn) {
                        const validMoves = game.moveHistory.filter(m => m.x !== -1 && m.y !== -1);
                        const totalTurns = game.totalTurns ?? validMoves.length;
                        game.totalTurns = totalTurns;
                        if (totalTurns >= autoScoringTurns && game.gameStatus === 'playing') {
                            const { getGameResult } = await import('../gameModes.js');
                            await getGameResult(game);
                            return;
                        }
                    }
                }
            }
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

    const { type, payload } = action;
    const now = Date.now();
    let myPlayerEnum = user.id === game.blackPlayerId ? types.Player.Black : (user.id === game.whitePlayerId ? types.Player.White : types.Player.None);
    if (myPlayerEnum === types.Player.None && game.player1?.id === user.id) {
        myPlayerEnum = types.Player.Black;
    }
    const isMyTurn = myPlayerEnum === game.currentPlayer;

    const isHiddenMoveAtIndex = (idx: number): boolean => {
        const hm = game.hiddenMoves as Record<string, boolean> | undefined;
        if (!hm) return false;
        return !!(hm[idx] ?? hm[String(idx)]);
    };

    switch (type) {
        case 'START_HIDDEN_PLACEMENT':
            if (!isMyTurn) return { error: "Not your turn to use an item." };
            if (game.gameStatus !== 'playing') return { error: "Not your turn to use an item." };
            const hiddenKey = user.id === game.blackPlayerId ? 'hidden_stones_p1' : 'hidden_stones_p2';
            const currentHidden = (game as any)[hiddenKey] ?? 0;
            if (currentHidden <= 0) return { error: "No hidden stones left." };
            game.gameStatus = 'hidden_placing';
            pauseGameTimer(game, now, 30000);
            return {};
        case 'START_SCANNING': {
            const lastMove = game.moveHistory?.length ? game.moveHistory[game.moveHistory.length - 1] : null;
            const lastMoveWasMine = lastMove && (lastMove as { player?: number }).player === myPlayerEnum;
            const allowScanAfterMyMove = game.gameCategory === 'tower' && game.gameStatus === 'playing' && lastMoveWasMine && !isMyTurn;
            const canUseScan = isMyTurn || allowScanAfterMyMove;
            if (!canUseScan) return { error: "Not your turn to use an item." };
            if (game.gameStatus !== 'playing') return { error: "Not your turn to use an item." };
            const scanKeyStart = user.id === game.blackPlayerId ? 'scans_p1' : 'scans_p2';
            if (((game as any)[scanKeyStart] ?? 0) <= 0) return { error: "No scans left." };
            const opponentPlayerEnum = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
            const hasUnrevealedInMoveHistory = !!(game.hiddenMoves && game.moveHistory && game.moveHistory.some((m: types.Move, idx: number) => {
                if (m.x === -1 || m.y === -1) return false;
                const isOpponent = m.player === opponentPlayerEnum;
                const isHidden = isHiddenMoveAtIndex(idx);
                const isRevealed = game.permanentlyRevealedStones?.some((p: types.Point) => p.x === m.x && p.y === m.y);
                const stillOnBoard = game.boardState?.[m.y]?.[m.x] === opponentPlayerEnum;
                return isOpponent && isHidden && !isRevealed && stillOnBoard;
            }));
            const aiHidden = (game as any).aiInitialHiddenStone as { x: number; y: number } | undefined;
            const hasUnrevealedAiInitial = !!aiHidden &&
                !game.permanentlyRevealedStones?.some((p: types.Point) => p.x === aiHidden.x && p.y === aiHidden.y) &&
                game.boardState?.[aiHidden.y]?.[aiHidden.x] === opponentPlayerEnum;
            const isMixWithHidden =
                game.mode === types.GameMode.Mix &&
                Array.isArray((game.settings as any)?.mixedModes) &&
                (game.settings as any).mixedModes.includes(types.GameMode.Hidden);
            const stageAllowsHiddenStones = ((game.settings as any)?.hiddenStoneCount ?? 0) > 0 || isMixWithHidden;
            const hasAnyUnrevealedOpponentStone = stageAllowsHiddenStones && !!game.boardState && !!game.moveHistory && game.moveHistory.some((m: types.Move) => {
                if (m.x < 0 || m.y < 0) return false;
                if (m.player !== opponentPlayerEnum) return false;
                const isRevealed = game.permanentlyRevealedStones?.some((p: types.Point) => p.x === m.x && p.y === m.y);
                const stillOnBoard = game.boardState?.[m.y]?.[m.x] === opponentPlayerEnum;
                return !isRevealed && stillOnBoard;
            });
            const opponentHasUnrevealedHidden = hasUnrevealedInMoveHistory || hasUnrevealedAiInitial || hasAnyUnrevealedOpponentStone;
            if (!opponentHasUnrevealedHidden) return { error: "No hidden stones to scan." };
            game.gameStatus = 'scanning';
            pauseGameTimer(game, now, 30000);
            return {};
        }
        case 'SCAN_BOARD':
            if (game.gameStatus !== 'scanning') return { error: "Not in scanning mode." };
            const { x, y } = payload;
            const scanKey = user.id === game.blackPlayerId ? 'scans_p1' : 'scans_p2';
            if (((game as any)[scanKey] ?? 0) <= 0) return { error: "No scans left." };
            (game as any)[scanKey] = ((game as any)[scanKey] ?? 0) - 1;

            const isAiInitialHiddenStone = (game as any).aiInitialHiddenStone &&
                (game as any).aiInitialHiddenStone.x === x &&
                (game as any).aiInitialHiddenStone.y === y;
            const moveIndex = game.moveHistory.findIndex(m => m.x === x && m.y === y);
            const success = (moveIndex !== -1 && isHiddenMoveAtIndex(moveIndex)) || isAiInitialHiddenStone;

            if (success) {
                if (!game.revealedHiddenMoves) game.revealedHiddenMoves = {};
                if (!game.revealedHiddenMoves[user.id]) game.revealedHiddenMoves[user.id] = [];
                if (moveIndex !== -1 && !game.revealedHiddenMoves[user.id].includes(moveIndex)) {
                    game.revealedHiddenMoves[user.id].push(moveIndex);
                }
                if (isAiInitialHiddenStone) {
                    if (!(game as any).scannedAiInitialHiddenByUser) (game as any).scannedAiInitialHiddenByUser = {};
                    (game as any).scannedAiInitialHiddenByUser[user.id] = true;
                }
                if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                if (!game.permanentlyRevealedStones.some(p => p.x === x && p.y === y)) {
                    game.permanentlyRevealedStones.push({ x, y });
                }
            }
            game.animation = { type: 'scan', point: { x, y }, success, startTime: now, duration: 2000, playerId: user.id };
            game.gameStatus = 'scanning_animating';
            game.currentPlayer = myPlayerEnum;
            resumeGameTimer(game, now, myPlayerEnum);
            return {};
    }

    return null;
}
