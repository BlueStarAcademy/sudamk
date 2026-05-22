import * as types from '../../types/index.js';
import * as db from '../db.js';
import { getGameResult } from '../gameModes.js';
import { pauseGameTimer, resumeGameTimer, shouldEnforceTimeControl } from './shared.js';
import { isFischerStyleTimeControl, getFischerIncrementSeconds } from '../../shared/utils/gameTimeControl.js';
import {
    consumeOpponentPatternStoneIfAny,
    recordPatternStoneConsumed,
    stripPatternStonesAtConsumedIntersections,
} from '../../shared/utils/patternStoneConsume.js';
import {
    isIntersectionRecordedAsBaseStone,
    removeCapturedBaseStoneMarkersFromSession,
} from '../../shared/utils/removeCapturedBaseStoneMarkers.js';
import { findLatestMoveIndexAtExcludingRecordedBaseStones } from '../../shared/utils/baseHiddenMoveIndex.js';
import { useAiInitialHiddenCellTracking, useTowerStyleHiddenRevealAnimatingResolution } from './hiddenRevealPolicy.js';
import { applyPreserveDiscovererTurnIfPending } from './hiddenRevealPreserve.js';
import { runTowerStyleHiddenRevealAnimatingIfDue } from './towerStyleHiddenRevealAnimating.js';
import { tryEndGameWhenCaptureTargetReached } from '../utils/captureTargets.js';
import {
    buildHiddenScanAnimation,
    evaluateHiddenScanBoard,
    hasOpponentHiddenScanTargets,
    recordSoftHiddenScanDiscovery,
} from './hiddenScanShared.js';
import { isStrategicAiGoSession } from '../../shared/utils/strategicBoardItemTurn.js';
import {
    mixGoClearHiddenItemPhaseTimers,
    mixGoOrPureModeIncludes,
    mixGoShouldUnstickHiddenItemSelectionPhase,
} from '../../shared/utils/mixGoRules.js';
import { getCurrentPairTurnSeat, isPairAiSeat, isPairClassicGame } from '../../shared/utils/pairGameTurn.js';
import { applyPairTurnAfterHiddenRevealCaptureResolved } from '../utils/pairTurnAfterHiddenRevealAnim.js';
import {
    clearItemPhasePresentationFields,
    finalizeHiddenRevealPresentationCleanup,
    finalizeHiddenSelectingUnstick,
    finalizeItemPhase,
    markItemPhaseStateChanged,
    tryFinalizeHiddenRevealItemPhase,
} from './finalizeItemPhase.js';

type HandleActionResult = types.HandleActionResult;

const resolveEffectiveFischerIncrement = (game: types.LiveGameSession): number => {
    const isSpeedMode =
        game.mode === types.GameMode.Speed ||
        (game.mode === types.GameMode.Mix && !!game.settings?.mixedModes?.includes(types.GameMode.Speed));
    // AI 대국 스피드는 피셔 증분을 비활성화한다.
    if (game.isAiGame && isSpeedMode) return 0;
    return getFischerIncrementSeconds(game as any);
};

export const initializeHidden = (game: types.LiveGameSession) => {
    const isHiddenMode = mixGoOrPureModeIncludes(game.mode, game.settings?.mixedModes, types.GameMode.Hidden);
    if (isHiddenMode) {
        const hiddenCap = game.settings.hiddenStoneCount || 0;
        game.scans_p1 = (game.settings.scanCount || 0);
        game.scans_p2 = (game.settings.scanCount || 0);
        game.hidden_stones_p1 = hiddenCap;
        game.hidden_stones_p2 = hiddenCap;
        game.hidden_stones_used_p1 = 0;
        game.hidden_stones_used_p2 = 0;
    }
};

/** DB/캐시에 잔여 히든 수가 없을 때 설정·사용 횟수로 복원 (p1/p2=흑/백) */
export function ensureStrategicHiddenInventory(game: types.LiveGameSession): void {
    const cap = game.settings.hiddenStoneCount ?? 0;
    if (cap <= 0) return;
    if (game.hidden_stones_p1 == null) {
        game.hidden_stones_p1 = Math.max(0, cap - (game.hidden_stones_used_p1 ?? 0));
    }
    if (game.hidden_stones_p2 == null) {
        game.hidden_stones_p2 = Math.max(0, cap - (game.hidden_stones_used_p2 ?? 0));
    }
}

export const updateHiddenState = async (game: types.LiveGameSession, now: number): Promise<boolean> => {
    const isStrategicAiGame = isStrategicAiGoSession(game);
    const isItemMode = ['hidden_placing', 'scanning'].includes(game.gameStatus);
    let changed = false;

    if (mixGoShouldUnstickHiddenItemSelectionPhase(game)) {
        if (finalizeHiddenSelectingUnstick(game, now)) changed = true;
        return changed;
    }

    if (game.gameStatus === 'scanning_animating' && game.itemUseDeadline && now > game.itemUseDeadline) {
        if (finalizeItemPhase(game, 'scan', now, { scanDeadlineCleanup: true })) changed = true;
        return changed;
    }

    if (isItemMode && game.itemUseDeadline && now > game.itemUseDeadline) {
        const currentItemMode = game.gameStatus as 'hidden_placing' | 'scanning';
        if (
            finalizeItemPhase(game, 'hidden_selecting', now, {
                selectingStatus: currentItemMode,
            })
        ) {
            changed = true;
        }
        return changed;
    }

    switch (game.gameStatus) {
        case 'scanning_animating': {
            const anim = game.animation;
            const scanAnim = anim && anim.type === 'scan' ? (anim as { success?: boolean; towerResumeScanning?: boolean }) : null;
            if (
                finalizeItemPhase(game, 'scan', now, {
                    resumeScanningSelection: !!(scanAnim?.success && scanAnim?.towerResumeScanning),
                })
            ) {
                changed = true;
            }
            break;
        }
        case 'hidden_reveal_animating': {
            if (!game.revealAnimationEndTime) {
                game.revealAnimationEndTime = now;
            }
            if (await tryFinalizeHiddenRevealItemPhase(game, now)) {
                changed = true;
                break;
            }
            if (game.revealAnimationEndTime && now >= game.revealAnimationEndTime) {
                const cap = game.pendingCapture;
                if (!cap) {
                    const pendingAiAfterUserHiddenReveal = (game as any).pendingAiMoveAfterUserHiddenFullReveal;
                    (game as any).pendingAiMoveAfterUserHiddenFullReveal = undefined;
                    finalizeHiddenRevealPresentationCleanup(game, now, game.currentPlayer);
                    changed = true;
                    const pairSeatAfterReveal = isPairClassicGame(game.settings, game.mode)
                        ? getCurrentPairTurnSeat(game.settings)
                        : null;
                    const isPairAiTurnAfterReveal = !!(pairSeatAfterReveal && isPairAiSeat(pairSeatAfterReveal));
                    if (pendingAiAfterUserHiddenReveal && (game.isAiGame || isPairAiTurnAfterReveal)) {
                        game.aiTurnStartTime = now;
                        const { primeKataServerBoardAfterHiddenReveal } = await import('../goAiBot.js');
                        await primeKataServerBoardAfterHiddenReveal(game);
                        const { broadcastItemPhaseSnapshot } = await import('../utils/broadcastItemPhaseSnapshot.js');
                        await broadcastItemPhaseSnapshot(game);
                        const { aiUserId } = await import('../aiPlayer.js');
                        const { syncAiSession } = await import('../aiSessionManager.js');
                        syncAiSession(game, aiUserId);
                        const { aiProcessingQueue } = await import('../aiProcessingQueue.js');
                        aiProcessingQueue.enqueue(game.id);
                        return true;
                    }
                    break;
                }
                {
                    const myPlayerEnum = cap.move.player;
                    const opponentPlayerEnum = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;

                    if (await applyPreserveDiscovererTurnIfPending(game, now, cap)) {
                        changed = true;
                        break;
                    }

                    game.justCaptured = [];

                    for (const stone of cap.stones) {
                        game.boardState[stone.y][stone.x] = types.Player.None; // Remove stone from board
        
                        const isBaseStone = isIntersectionRecordedAsBaseStone(game, stone.x, stone.y);
                        // 같은 좌표에 공격자 착수가 이어지면(히든 따내기) 마지막 수만 보면 hiddenMoves가 없다.
                        // 제거되는 돌의 주인(상대)이 둔 수순을 찾아야 히든 여부를 맞출 수 있다.
                        const moveIndex = findLatestMoveIndexAtExcludingRecordedBaseStones(
                            game.moveHistory,
                            stone.x,
                            stone.y,
                            opponentPlayerEnum,
                            game,
                        );
                        const wasHidden = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
                        const wasAiInitialHidden =
                            useAiInitialHiddenCellTracking(game) &&
                            (game as any).aiInitialHiddenStone &&
                            (game as any).aiInitialHiddenStone.x === stone.x &&
                            (game as any).aiInitialHiddenStone.y === stone.y;
                        let points = 1;
                        let wasHiddenForEntry = false;
                        if (isBaseStone) {
                            game.baseStoneCaptures[myPlayerEnum]++;
                            points = 5;
                            recordPatternStoneConsumed(game, stone);
                        } else {
                            const pveLike =
                                game.isSinglePlayer ||
                                isStrategicAiGame ||
                                (game as any).gameCategory === 'guildwar';
                            const wasPattern = pveLike && consumeOpponentPatternStoneIfAny(game, stone, opponentPlayerEnum);
                            if (wasPattern) {
                                points = 2;
                            } else if (wasHidden || wasAiInitialHidden) {
                                game.hiddenStoneCaptures[myPlayerEnum] = (game.hiddenStoneCaptures[myPlayerEnum] || 0) + 1;
                                points = 5;
                                wasHiddenForEntry = true;
                                recordPatternStoneConsumed(game, stone);
                            }
                        }
                        game.captures[myPlayerEnum] += points;
        
                        game.justCaptured.push({
                            point: stone,
                            player: opponentPlayerEnum,
                            wasHidden: wasHiddenForEntry || wasAiInitialHidden,
                            capturePoints: points,
                            ...(isBaseStone ? { wasBaseStone: true as const } : {}),
                        });
                        if (moveIndex !== -1 && game.hiddenMoves?.[moveIndex]) {
                            delete game.hiddenMoves[moveIndex];
                        }
                        if (wasAiInitialHidden) {
                            (game as any).aiInitialHiddenStone = undefined;
                        }
                    }
                    
                    // pendingCapture.stones에 “수순 좌표(히든 공개 시도 위치)”가 포함되는 경우가 있어,
                    // 여기서 제거된 좌표에는 반드시 “수순을 둔 쪽의 돌”을 다시 배치한다.
                    // (히든돌을 따냈을 때: 공개 연출 중엔 상대 히든이 보이고, 종료 후에는 일반돌로 존재해야 함)
                    if (cap.move && typeof cap.move.x === 'number' && typeof cap.move.y === 'number') {
                        game.boardState[cap.move.y][cap.move.x] = myPlayerEnum;
                    }
                    stripPatternStonesAtConsumedIntersections(game);
                    removeCapturedBaseStoneMarkersFromSession(game, cap.stones);

                    // hidden_reveal 오버레이에서 이미 스파클 연출을 했고, permanentlyRevealed로 표시가 유지되므로
                    // newlyRevealed로 본판에 같은 애니를 한 번 더 붙이지 않는다.
                    game.newlyRevealed = [];
                    if (await tryEndGameWhenCaptureTargetReached(game, myPlayerEnum)) {
                        clearItemPhasePresentationFields(game, { clearRevealClock: true });
                        game.pendingCapture = null;
                        (game as any).pendingAiMoveAfterUserHiddenFullReveal = undefined;
                        game.pausedTurnTimeLeft = undefined;
                        markItemPhaseStateChanged(game);
                        return true;
                    }
                }

                clearItemPhasePresentationFields(game, { clearRevealClock: true });
                game.gameStatus = 'playing';
                game.pendingCapture = null;
                (game as any).pendingAiMoveAfterUserHiddenFullReveal = undefined;

                // Resume timer for the next player (연출 중 game.currentPlayer가 실제 착수자와 다를 수 있음)
                const playerWhoMoved = cap.move.player;
                const nextPlayer = playerWhoMoved === types.Player.Black ? types.Player.White : types.Player.Black;
                
                if (game.settings.timeLimit > 0) {
                    const timeKey = playerWhoMoved === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                    const fischerIncrement = resolveEffectiveFischerIncrement(game);
                    
                    if (game.pausedTurnTimeLeft) {
                        game[timeKey] = game.pausedTurnTimeLeft + fischerIncrement;
                    }
                }
                
                const preserveTurnAfterOpponentHiddenReveal = !!(cap as any).preserveTurnAfterOpponentHiddenReveal;
                if (isPairClassicGame(game.settings, game.mode)) {
                    applyPairTurnAfterHiddenRevealCaptureResolved(
                        game,
                        now,
                        preserveTurnAfterOpponentHiddenReveal,
                        playerWhoMoved
                    );
                } else {
                    game.currentPlayer = preserveTurnAfterOpponentHiddenReveal ? playerWhoMoved : nextPlayer;
                }

                if (shouldEnforceTimeControl(game) && game.settings.timeLimit > 0) {
                    const nextTimeKey = game.currentPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                    const isFischer = isFischerStyleTimeControl(game as any);
                    const isNextInByoyomi = game[nextTimeKey] <= 0 && game.settings.byoyomiCount > 0 && !isFischer;
                    if (isNextInByoyomi) {
                        game.turnDeadline = now + game.settings.byoyomiTime * 1000;
                    } else {
                        game.turnDeadline = now + game[nextTimeKey] * 1000;
                    }
                    game.turnStartTime = now;
                } else {
                    game.turnDeadline = undefined;
                    game.turnStartTime = undefined;
                }

                 game.pausedTurnTimeLeft = undefined;
                markItemPhaseStateChanged(game);
                changed = true;
            }
            break;
        }
        case 'hidden_final_reveal':
            if (game.revealAnimationEndTime && now >= game.revealAnimationEndTime) {
                clearItemPhasePresentationFields(game, { clearRevealClock: true });
                if (!(game as any)._getGameResultInFlight) {
                    (game as any)._getGameResultInFlight = true;
                    void getGameResult(game)
                        .catch((err: any) => {
                            console.error(
                                `[updateHiddenState] getGameResult failed for game ${game.id}:`,
                                err?.message ?? err,
                            );
                        })
                        .finally(() => {
                            (game as any)._getGameResultInFlight = false;
                        });
                }
                changed = true;
            }
            break;
    }
    return changed;
};

export const handleHiddenAction = (volatileState: types.VolatileState, game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): HandleActionResult | null => {
    const { type, payload } = action as any;
    const now = Date.now();
    const pairClassicGame = isPairClassicGame(game.settings, game.mode);
    const pairCurrentSeat = pairClassicGame ? getCurrentPairTurnSeat(game.settings) : null;
    const myPlayerEnum = pairCurrentSeat
        ? user.id === pairCurrentSeat.participantId
            ? pairCurrentSeat.player
            : user.id === game.blackPlayerId
              ? types.Player.Black
              : user.id === game.whitePlayerId
                ? types.Player.White
                : types.Player.None
        : user.id === game.blackPlayerId
          ? types.Player.Black
          : user.id === game.whitePlayerId
            ? types.Player.White
            : types.Player.None;
    const isMyTurn = pairCurrentSeat
        ? user.id === pairCurrentSeat.participantId && pairCurrentSeat.player === game.currentPlayer
        : myPlayerEnum === game.currentPlayer;
    // 히든·스캔 시작은 본인 차례에만 (미사일·펫 힌트와 동일). 페어는 좌석 participantId·색이 일치할 때만(흑1/흑2 교대).
    const canUseItem = isMyTurn;

    // p1/p2는 흑/백을 의미한다 — player1 좌석과 무관 (페어바둑 파트너 user.id가 player1.id와 다른 경우 대비)
    const myIsBlack = myPlayerEnum === types.Player.Black;

    switch(type) {
        case 'START_HIDDEN_PLACEMENT': {
            if (!canUseItem) return { error: "Not your turn to use an item." };
            ensureStrategicHiddenInventory(game);
            if (game.gameStatus === 'hidden_placing') {
                if (!game.itemUseDeadline) {
                    pauseGameTimer(game, now, 30000);
                }
                return { clientResponse: { gameUpdated: true } };
            }
            if (game.gameStatus !== 'playing') return { error: "Not your turn to use an item." };
            // Mix/타워: 히든 개수 확인 (없으면 진입 불가)
            const isMixOrHidden = game.mode === types.GameMode.Hidden || (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Hidden));
            if (isMixOrHidden) {
                const hiddenKey = myIsBlack ? 'hidden_stones_p1' : 'hidden_stones_p2';
                const left = game[hiddenKey] ?? game.settings.hiddenStoneCount ?? 0;
                if (left <= 0) return { error: "No hidden stones left." };
            }
            game.gameStatus = 'hidden_placing';
            pauseGameTimer(game, now, 30000);
            markItemPhaseStateChanged(game);
            return { clientResponse: { gameUpdated: true } };
        }
        case 'START_SCANNING': {
            if (!canUseItem) return { error: "Not your turn to use an item." };
            ensureStrategicHiddenInventory(game);
            if (game.gameStatus === 'scanning') {
                if (!game.itemUseDeadline) {
                    pauseGameTimer(game, now, 30000);
                }
                return { clientResponse: { gameUpdated: true } };
            }
            if (game.gameStatus !== 'playing') return { error: "Not your turn to use an item." };
            const scanKeyStart = myIsBlack ? 'scans_p1' : 'scans_p2';
            if ((game[scanKeyStart] ?? 0) <= 0) return { error: "No scans left." };
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
            game.gameStatus = 'scanning';
            pauseGameTimer(game, now, 30000);
            markItemPhaseStateChanged(game);
            return { clientResponse: { gameUpdated: true } };
        }
        case 'SCAN_BOARD':
            if (game.gameStatus !== 'scanning') return { error: "Not in scanning mode." };
            const { x, y } = payload;
            const scanKey = myIsBlack ? 'scans_p1' : 'scans_p2';
            if ((game[scanKey] ?? 0) <= 0) return { error: "No scans left." };

            const evalResult = evaluateHiddenScanBoard(game, user.id, x, y);
            if (evalResult.success) {
                recordSoftHiddenScanDiscovery(game, user.id, evalResult);
            }
            game[scanKey] = Math.max(0, (game[scanKey] ?? 0) - 1);
            game.animation = buildHiddenScanAnimation(now, user.id, x, y, evalResult.success);
            game.gameStatus = 'scanning_animating';
            // 아이템 사용 직후에는 현재 플레이어를 사용한 유저로 고정하여 턴 정지 버그를 방지한다.
            game.currentPlayer = myPlayerEnum;

            // After using the item, restore my time, reset timers and KEEP THE TURN
            const scanResumeOk = resumeGameTimer(game, now, myPlayerEnum);
            if (!scanResumeOk) {
                game.itemUseDeadline = undefined;
                game.pausedTurnTimeLeft = undefined;
            }

            markItemPhaseStateChanged(game);
            // The `updateHiddenState` will transition from 'scanning_animating' to 'playing'
            // after the animation, but the timer is already correctly running for the current player.
            return { clientResponse: { gameUpdated: true } };
    }

    return null;
}
