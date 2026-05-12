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
import { getEffectiveSinglePlayerStages } from '../singlePlayerStageConfigService.js';
import { resolveSinglePlayerAutoScoringTurnCap } from '../../shared/utils/singlePlayerStrategicRulePreset.js';
import { aiUserId } from '../aiPlayer.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';

type HandleActionResult = types.HandleActionResult;

/**
 * 베이스·덤 입찰 이후 유저가 백이 될 수 있어 `currentPlayer === Player.White` 가정은 더이상 통하지 않는다.
 * 좌석 ID 기반으로 현재 차례가 AI(또는 봇)인지 판단한다.
 */
const isAiSeatTurn = (game: types.LiveGameSession): boolean => {
    const id = game.currentPlayer === types.Player.Black
        ? game.blackPlayerId
        : game.currentPlayer === types.Player.White
          ? game.whitePlayerId
          : null;
    if (!id) return false;
    return id === aiUserId || String(id).startsWith('dungeon-bot-');
};

const hiddenInventoryKeyForPlayer = (player: types.Player): 'hidden_stones_p1' | 'hidden_stones_p2' =>
    player === types.Player.White ? 'hidden_stones_p2' : 'hidden_stones_p1';

const hiddenUsedKeyForPlayer = (player: types.Player): 'hidden_stones_used_p1' | 'hidden_stones_used_p2' =>
    player === types.Player.White ? 'hidden_stones_used_p2' : 'hidden_stones_used_p1';

export const initializeSinglePlayerHidden = (game: types.LiveGameSession) => {
    const isHiddenMode = game.mode === types.GameMode.Hidden || (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Hidden));
    const disableAiHiddenItemsByStageSetting =
        game.isSinglePlayer &&
        isHiddenMode &&
        (game.settings as any)?.singlePlayerDisableAiHiddenItemUsage === true;
    if (isHiddenMode && game.isSinglePlayer) {
        game.scans_p1 = (game.settings.scanCount || 0);
        game.scans_p2 = (game.settings.scanCount || 0);
        game.hidden_stones_p1 = (game.settings.hiddenStoneCount || 0);
        game.hidden_stones_p2 = (game.settings.hiddenStoneCount || 0);
        game.hidden_stones_used_p1 = 0;
        game.hidden_stones_used_p2 = 0;
        // 스테이지 설정 우선순위:
        // 1) 명시 턴 목록(singlePlayerAiHiddenItemTurns)
        // 2) N턴 이내 랜덤 N회(singlePlayerAiHiddenItemUseWithinTurn + singlePlayerAiHiddenItemUseCount)
        // 3) 기본: AI 첫 20턴 이내·첫 턴 제외(중급-7은 스테이지에서 1턴·좌표 명시)
        if (!disableAiHiddenItemsByStageSetting) {
            const configuredTurnsRaw = (game.settings as any)?.singlePlayerAiHiddenItemTurns;
            const configuredTurns = Array.isArray(configuredTurnsRaw)
                ? Array.from(
                      new Set(
                          configuredTurnsRaw
                              .map((turn: unknown) => Number(turn))
                              .filter((turn: number) => Number.isInteger(turn) && turn > 0)
                              .slice(0, 12),
                      ),
                  ).sort((a: number, b: number) => a - b)
                : [];
            const configuredWithinRaw = (game.settings as any)?.singlePlayerAiHiddenItemUseWithinTurn;
            const hasConfiguredWithin =
                configuredWithinRaw != null &&
                Number.isFinite(Number(configuredWithinRaw)) &&
                Number(configuredWithinRaw) > 0;
            /** 미지정 시 20. (예전: 0 → withinTurn=1 이 되어 AI 첫 턴마다 히든이 발동하는 버그) */
            const withinTurn = hasConfiguredWithin
                ? Math.max(1, Math.min(99, Math.floor(Number(configuredWithinRaw))))
                : 20;
            const configuredUseCountRaw = Number((game.settings as any)?.singlePlayerAiHiddenItemUseCount ?? 0);
            const hasConfiguredUseCount =
                (game.settings as any)?.singlePlayerAiHiddenItemUseCount != null &&
                Number.isFinite(configuredUseCountRaw) &&
                configuredUseCountRaw > 0;
            const configuredUseCount = hasConfiguredUseCount
                ? Math.max(1, Math.min(12, Math.floor(configuredUseCountRaw)))
                : 1;
            const hiddenStoneCount = Math.max(0, Number((game.settings as any)?.hiddenStoneCount ?? 0));
            const plannedRandomUseCount = hiddenStoneCount > 0 ? configuredUseCount : 0;
            const minAiHiddenByConfig =
                configuredTurns.length > 0
                    ? configuredTurns.length
                    : plannedRandomUseCount;
            const currentAiHidden = Math.max(0, Number(game.hidden_stones_p2 ?? 0));
            if (currentAiHidden < minAiHiddenByConfig) {
                game.hidden_stones_p2 = minAiHiddenByConfig;
            }
            // AI 히든 사용 횟수·재고는 스테이지 hiddenStoneCount(유저와 동일 상한)를 넘지 않게 맞춘다.
            // (명시 턴이 3개여도 재고 2면 실제로는 2회만 가능해야 함 — 초과 시 3번째 연출·오표기 버그 방지)
            if (hiddenStoneCount > 0 && (game.hidden_stones_p2 ?? 0) > hiddenStoneCount) {
                game.hidden_stones_p2 = hiddenStoneCount;
            }
            if ((game.hidden_stones_p2 ?? 0) <= 0) {
                return;
            }
            // 새 스테이지 적용/재시작 시 이전 게임 잔여값이 남지 않도록 항상 초기화
            game.aiHiddenItemsUsedCount = 0;
            game.aiHiddenItemUsed = false;
            if (configuredTurns.length > 0) {
                const cappedTurns =
                    hiddenStoneCount > 0
                        ? configuredTurns.slice(0, hiddenStoneCount)
                        : configuredTurns;
                game.aiHiddenItemTurns = cappedTurns;
                game.aiHiddenItemTurn = cappedTurns[0];
            } else {
                const stageId = String((game as any).stageId ?? '');
                const allowAiFirstTurnHidden = stageId === '중급-7';
                const low = allowAiFirstTurnHidden ? 1 : 2;
                const high = Math.min(20, Math.max(low, withinTurn));
                const candidatePool: number[] = [];
                for (let t = low; t <= high; t++) candidatePool.push(t);
                for (let i = candidatePool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [candidatePool[i], candidatePool[j]] = [candidatePool[j], candidatePool[i]];
                }
                const sliceCap =
                    hiddenStoneCount > 0
                        ? Math.min(plannedRandomUseCount, candidatePool.length, hiddenStoneCount)
                        : Math.min(plannedRandomUseCount, candidatePool.length);
                const randomTurns = candidatePool.slice(0, sliceCap).sort((a, b) => a - b);
                if (randomTurns.length === 0) {
                    return;
                }
                game.aiHiddenItemTurn = randomTurns[0]!;
                game.aiHiddenItemTurns = randomTurns;
            }
        }
    }
};

export const updateSinglePlayerHiddenState = async (game: types.LiveGameSession, now: number) => {
    // 싱글플레이 게임이 아니면 처리하지 않음
    if (resolveArenaSessionPolicy(game as any).kind !== 'singleplayer') {
        return;
    }

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
        // Item use timed out. 아이템만 1개 소모하고 턴 유지한 채 본경기(playing)로 복귀
        const timedOutPlayerEnum = game.currentPlayer;
        const timedOutPlayerId = timedOutPlayerEnum === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
        const currentItemMode = game.gameStatus; // hidden_placing 또는 scanning
        
        console.log(`[updateSinglePlayerHiddenState] Item use timeout: mode=${currentItemMode}, player=${timedOutPlayerId}, gameId=${game.id}`);
        
        game.foulInfo = { message: `${game.player1.id === timedOutPlayerId ? game.player1.nickname : game.player2.nickname}님의 아이템 시간 초과!`, expiry: now + 4000 };
        game.gameStatus = 'playing';
        game.currentPlayer = timedOutPlayerEnum; // 턴 그대로 유지
        
        // 아이템 소멸 처리
        if (currentItemMode === 'hidden_placing') {
            // 히든 아이템 소멸 (스캔 아이템처럼 개수 감소)
            const hiddenKey = hiddenInventoryKeyForPlayer(timedOutPlayerEnum);
            const currentHidden = game[hiddenKey] ?? 0;
            if (currentHidden > 0) {
                game[hiddenKey] = currentHidden - 1;
                const usedKey = hiddenUsedKeyForPlayer(timedOutPlayerEnum);
                game[usedKey] = (game[usedKey] || 0) + 1;
                console.log(`[updateSinglePlayerHiddenState] Hidden item consumed: ${hiddenKey} ${currentHidden} -> ${game[hiddenKey]}, gameId=${game.id}`);
            }
        } else if (currentItemMode === 'scanning') {
            // 스캔 아이템 소멸
            const scanKey = timedOutPlayerId === game.player1.id ? 'scans_p1' : 'scans_p2';
            const currentScans = game[scanKey] ?? 0;
            if (currentScans > 0) {
                game[scanKey] = currentScans - 1;
                console.log(`[updateSinglePlayerHiddenState] Scan item consumed: ${scanKey} ${currentScans} -> ${game[scanKey]}, gameId=${game.id}`);
            }
        }
        
        // 원래 경기 시간 복원 (턴 유지)
        const timerResumed = resumeGameTimer(game, now, timedOutPlayerEnum);
        if (!timerResumed) {
            game.itemUseDeadline = undefined;
            game.pausedTurnTimeLeft = undefined;
        }
        console.log(`[updateSinglePlayerHiddenState] Turn maintained: player=${timedOutPlayerEnum}, gameId=${game.id}`);
        
        // 상태 변경을 표시하여 상위 함수에서 브로드캐스트하도록 함
        (game as any)._itemTimeoutStateChanged = true;
        
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
                    const scanAnim = anim as { type: 'scan'; success?: boolean; towerResumeScanning?: boolean };
                    if (scanAnim.success && scanAnim.towerResumeScanning) {
                        game.animation = null;
                        game.gameStatus = 'scanning';
                        pauseGameTimer(game, now, 30000);
                        (game as any)._itemTimeoutStateChanged = true;
                        break;
                    }
                }
                game.animation = null;
                game.gameStatus = 'playing';
                game.itemUseDeadline = undefined;
                game.pausedTurnTimeLeft = undefined;
                (game as any)._itemTimeoutStateChanged = true;
            }
            break;
        }
        case 'hidden_reveal_animating':
            await runTowerStyleHiddenRevealAnimatingIfDue(game, now, {
                logPrefix: 'updateSinglePlayerHiddenState',
                onPostTurnSwitch: async (g) => {
                    if (!g.isSinglePlayer || !g.stageId) return;
                    const stage = (await getEffectiveSinglePlayerStages()).find(s => s.id === g.stageId);
                    const autoScoringTurns = resolveSinglePlayerAutoScoringTurnCap(g.settings as any, stage);
                    if (autoScoringTurns === undefined) return;
                    /** 베이스·덤 후 유저가 백/AI가 흑이 되는 케이스에서도 AI 차례에 자동계가가 트리거되지 않게 좌석 기반으로 판단한다. */
                    if (g.isSinglePlayer && isAiSeatTurn(g)) return;
                    const validMoves = g.moveHistory.filter(m => m.x !== -1 && m.y !== -1);
                    const totalTurns = g.totalTurns ?? validMoves.length;
                    g.totalTurns = totalTurns;
                    if (totalTurns >= autoScoringTurns && g.gameStatus === 'playing') {
                        console.log(
                            `[updateSinglePlayerHiddenState] Auto-scoring triggered after hidden reveal animation: totalTurns=${totalTurns}, autoScoringTurns=${autoScoringTurns}`
                        );
                        const { getGameResult } = await import('../gameModes.js');
                        await getGameResult(g);
                    }
                },
            });
            break;
        case 'hidden_final_reveal':
            if (game.revealAnimationEndTime && now >= game.revealAnimationEndTime) {
                game.animation = null;
                game.revealAnimationEndTime = undefined;
                game.gameStatus = 'scoring'; // 계가 상태로 변경
                // 계가 진행 (중복 호출 방지를 위해 상태 변경 후 호출)
                const { getGameResult } = await import('../gameModes.js');
                await getGameResult(game);
            }
            break;
    }
};

export const handleSinglePlayerHiddenAction = (volatileState: types.VolatileState, game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): HandleActionResult | null => {
    // 싱글플레이 게임이 아니면 처리하지 않음
    if (resolveArenaSessionPolicy(game as any).kind !== 'singleplayer') {
        return null;
    }

    const { type, payload } = action as any;
    const now = Date.now();
    let myPlayerEnum = user.id === game.blackPlayerId ? types.Player.Black : (user.id === game.whitePlayerId ? types.Player.White : types.Player.None);
    if (myPlayerEnum === types.Player.None && game.player1?.id === user.id) {
        myPlayerEnum = types.Player.Black;
    }
    const isMyTurn = myPlayerEnum === game.currentPlayer;

    switch(type) {
        case 'START_HIDDEN_PLACEMENT':
            console.log(`[handleSinglePlayerHiddenAction] START_HIDDEN_PLACEMENT: isMyTurn=${isMyTurn}, gameStatus=${game.gameStatus}, userId=${user.id}, currentPlayer=${game.currentPlayer}, blackPlayerId=${game.blackPlayerId}, whitePlayerId=${game.whitePlayerId}`);
            if (!isMyTurn) {
                console.log(`[handleSinglePlayerHiddenAction] START_HIDDEN_PLACEMENT rejected: Not my turn - isMyTurn=${isMyTurn}, myPlayerEnum=${myPlayerEnum}, currentPlayer=${game.currentPlayer}`);
                return { error: "Not your turn to use an item." };
            }
            if (game.gameStatus !== 'playing') {
                console.log(`[handleSinglePlayerHiddenAction] START_HIDDEN_PLACEMENT rejected: Wrong game status - gameStatus=${game.gameStatus}`);
                return { error: "Not your turn to use an item." };
            }
            
            // 히든 아이템 개수 확인
            const hiddenKey = hiddenInventoryKeyForPlayer(myPlayerEnum);
            const currentHidden = game[hiddenKey] ?? 0;
            if (currentHidden <= 0) {
                console.log(`[handleSinglePlayerHiddenAction] START_HIDDEN_PLACEMENT rejected: No hidden stones left - ${hiddenKey}=${currentHidden}`);
                return { error: "No hidden stones left." };
            }
            
            console.log(`[handleSinglePlayerHiddenAction] START_HIDDEN_PLACEMENT: Changing gameStatus from ${game.gameStatus} to hidden_placing`);
            game.gameStatus = 'hidden_placing';
            pauseGameTimer(game, now, 30000);
            console.log(`[handleSinglePlayerHiddenAction] START_HIDDEN_PLACEMENT: SUCCESS - gameStatus=${game.gameStatus}, itemUseDeadline=${game.itemUseDeadline}, ${hiddenKey}=${currentHidden}`);
            return {};
        case 'START_SCANNING': {
            // 싱글플레이: 유저가 방금 둔 직후(턴이 AI로 넘어갔지만 AI가 아직 두기 전)에도 스캔 허용
            const lastMove = game.moveHistory?.length ? game.moveHistory[game.moveHistory.length - 1] : null;
            const lastMoveWasMine = lastMove && (lastMove as { player?: number }).player === myPlayerEnum;
            const allowScanAfterMyMove = game.isSinglePlayer && game.gameStatus === 'playing' && lastMoveWasMine && !isMyTurn;
            const canUseScan = isMyTurn || allowScanAfterMyMove;
            console.log(`[handleSinglePlayerHiddenAction] START_SCANNING: isMyTurn=${isMyTurn}, gameStatus=${game.gameStatus}, userId=${user.id}, currentPlayer=${game.currentPlayer}, lastMoveWasMine=${lastMoveWasMine}, canUseScan=${canUseScan}`);
            if (!canUseScan) {
                console.log(`[handleSinglePlayerHiddenAction] START_SCANNING rejected: Not my turn - isMyTurn=${isMyTurn}, myPlayerEnum=${myPlayerEnum}, currentPlayer=${game.currentPlayer}`);
                return { error: "Not your turn to use an item." };
            }
            if (game.gameStatus !== 'playing') {
                console.log(`[handleSinglePlayerHiddenAction] START_SCANNING rejected: Wrong game status - gameStatus=${game.gameStatus}`);
                return { error: "Not your turn to use an item." };
            }
            const scanKeyStart = user.id === game.player1.id ? 'scans_p1' : 'scans_p2';
            if ((game[scanKeyStart] ?? 0) <= 0) {
                console.log(`[handleSinglePlayerHiddenAction] START_SCANNING rejected: No scans left - ${scanKeyStart}=${game[scanKeyStart]}`);
                return { error: "No scans left." };
            }
            // 싱글플레이 전용: 상대(AI) 미공개 히든이 있으면 스캔 모드 진입. 없으면 거절.
            // (PVP는 server/modes/hidden.ts에서 동일 검사 적용)
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
            if (!opponentHasUnrevealedHidden) {
                console.log(
                    `[handleSinglePlayerHiddenAction] START_SCANNING rejected: No unrevealed opponent hidden stones (moveHistory=${!!game.moveHistory?.length}, hiddenMoves=${!!game.hiddenMoves})`,
                );
                return { error: "No hidden stones to scan." };
            }
            console.log(`[handleSinglePlayerHiddenAction] START_SCANNING: Changing gameStatus from ${game.gameStatus} to scanning`);
            game.gameStatus = 'scanning';
            pauseGameTimer(game, now, 30000);
            console.log(`[handleSinglePlayerHiddenAction] START_SCANNING: SUCCESS - gameStatus=${game.gameStatus}, itemUseDeadline=${game.itemUseDeadline}`);
            return {};
        }
        case 'SCAN_BOARD':
            if (game.gameStatus === 'playing' || game.gameStatus === 'scanning_animating') {
                return {};
            }
            if (game.gameStatus !== 'scanning') return { error: "Not in scanning mode." };
            const { x, y } = payload;
            const scanKey = user.id === game.player1.id ? 'scans_p1' : 'scans_p2';
            if ((game[scanKey] ?? 0) <= 0) return { error: "No scans left." };

            const evalResult = evaluateHiddenScanBoard(game, user.id, x, y);
            if (evalResult.success) {
                recordSoftHiddenScanDiscovery(game, user.id, evalResult);
            }
            game[scanKey] = Math.max(0, (game[scanKey] ?? 0) - 1);
            game.animation = buildHiddenScanAnimation(now, user.id, x, y, evalResult.success);
            game.gameStatus = 'scanning_animating';
            // 스캔 아이템 사용 후 턴이 넘어가지 않도록 현재 플레이어 유지
            game.currentPlayer = myPlayerEnum;

            // After using the item, restore my time, reset timers and KEEP THE TURN
            const scanResumeOk = resumeGameTimer(game, now, myPlayerEnum);
            if (!scanResumeOk) {
                game.itemUseDeadline = undefined;
                game.pausedTurnTimeLeft = undefined;
            }

            // The `updateSinglePlayerHiddenState` will transition from 'scanning_animating' to 'playing'
            // after the animation, without switching the turn.
            return {};
    }

    return null;
}

