import * as types from '../../types/index.js';
import * as db from '../db.js';
import { getGameResult } from '../gameModes.js';
import { pauseGameTimer, resumeGameTimer, shouldEnforceTimeControl } from './shared.js';
import { isFischerStyleTimeControl, getFischerIncrementSeconds } from '../../shared/utils/gameTimeControl.js';
import {
    consumeOpponentPatternStoneIfAny,
    stripPatternStonesAtConsumedIntersections,
} from '../../shared/utils/patternStoneConsume.js';
import { useAiInitialHiddenCellTracking, useTowerStyleHiddenRevealAnimatingResolution } from './hiddenRevealPolicy.js';
import { applyPreserveDiscovererTurnIfPending } from './hiddenRevealPreserve.js';
import { runTowerStyleHiddenRevealAnimatingIfDue } from './towerStyleHiddenRevealAnimating.js';
import {
    buildHiddenScanAnimation,
    evaluateHiddenScanBoard,
    hasOpponentHiddenScanTargets,
    recordSoftHiddenScanDiscovery,
} from './hiddenScanShared.js';

type HandleActionResult = types.HandleActionResult;

export const initializeHidden = (game: types.LiveGameSession) => {
    const isHiddenMode = game.mode === types.GameMode.Hidden || (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Hidden));
    if (isHiddenMode) {
        game.scans_p1 = (game.settings.scanCount || 0);
        game.scans_p2 = (game.settings.scanCount || 0);
        game.hidden_stones_used_p1 = 0;
        game.hidden_stones_used_p2 = 0;
    }
};

export const updateHiddenState = async (game: types.LiveGameSession, now: number) => {
    const isStrategicAiGame =
        !!game.isAiGame &&
        !game.isSinglePlayer &&
        (game as any).gameCategory !== 'tower' &&
        (game as any).gameCategory !== 'singleplayer' &&
        (game as any).gameCategory !== 'guildwar';
    const isItemMode = ['hidden_placing', 'scanning'].includes(game.gameStatus);

    // 방어 로직: 아이템 모드인데 deadline이 없으면 상태가 영구 고착될 수 있다.
    // (스캔 비활성/일반 착수 히든 오인 등의 연쇄 버그 방지)
    if (isItemMode && !game.itemUseDeadline) {
        game.gameStatus = 'playing';
        game.itemUseDeadline = undefined;
        game.turnDeadline = undefined;
        game.turnStartTime = undefined;
        game.pausedTurnTimeLeft = undefined;
        return;
    }

    if (isItemMode && game.itemUseDeadline && now > game.itemUseDeadline) {
        // Item use timed out. 아이템 소멸하고 턴 유지
        const timedOutPlayerEnum = game.currentPlayer;
        const timedOutPlayerId = timedOutPlayerEnum === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
        const currentItemMode = game.gameStatus; // 현재 아이템 모드 저장 (hidden_placing 또는 scanning)
        
        game.foulInfo = { message: `${game.player1.id === timedOutPlayerId ? game.player1.nickname : game.player2.nickname}님의 아이템 시간 초과!`, expiry: now + 4000 };
        game.gameStatus = 'playing';
        
        // 아이템 소멸 처리
        if (currentItemMode === 'hidden_placing') {
            // 히든 아이템 소멸
            const hiddenKey = timedOutPlayerId === game.player1.id ? 'hidden_stones_used_p1' : 'hidden_stones_used_p2';
            game[hiddenKey] = (game[hiddenKey] || 0) + 1;
        } else if (currentItemMode === 'scanning') {
            // 스캔 아이템 소멸
            const scanKey = timedOutPlayerId === game.player1.id ? 'scans_p1' : 'scans_p2';
            const currentScans = game[scanKey] ?? 0;
            if (currentScans > 0) {
                game[scanKey] = currentScans - 1;
            }
        }
        
        // 원래 경기 시간 복원 (턴 유지)
        resumeGameTimer(game, now, timedOutPlayerEnum);
        
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
                        break;
                    }
                }
                game.animation = null;
                game.gameStatus = 'playing';
            }
            break;
        }
        case 'hidden_reveal_animating':
            if (useTowerStyleHiddenRevealAnimatingResolution(game)) {
                await runTowerStyleHiddenRevealAnimatingIfDue(game, now, {
                    logPrefix: 'updateHiddenState',
                });
                break;
            }
            if (game.revealAnimationEndTime && now >= game.revealAnimationEndTime) {
                const cap = game.pendingCapture;
                // 히든 돌만 공개(따냄 없음): 상대가 내 히든 위에 두려 한 경우 — 타이머만 재개
                if (!cap) {
                    const pendingAiAfterUserHiddenReveal = (game as any).pendingAiMoveAfterUserHiddenFullReveal;
                    (game as any).pendingAiMoveAfterUserHiddenFullReveal = undefined;
                    game.animation = null;
                    game.gameStatus = 'playing';
                    game.revealAnimationEndTime = undefined;
                    game.pendingCapture = null;
                    const cur = game.currentPlayer;
                    if (game.pausedTurnTimeLeft !== undefined) {
                        const timeKey = cur === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                        game[timeKey] = game.pausedTurnTimeLeft;
                    }
                    if (
                        shouldEnforceTimeControl(game) &&
                        game.settings?.timeLimit > 0 &&
                        game.pausedTurnTimeLeft !== undefined
                    ) {
                        const timeKey = cur === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                        const isFischer = isFischerStyleTimeControl(game as any);
                        const byoyomiTime = game.settings.byoyomiTime ?? 0;
                        const isNextInByoyomi = game[timeKey] <= 0 && game.settings.byoyomiCount > 0 && !isFischer;
                        if (isNextInByoyomi && byoyomiTime > 0) {
                            game.turnDeadline = now + byoyomiTime * 1000;
                        } else {
                            game.turnDeadline = now + (game[timeKey] ?? 0) * 1000;
                        }
                        game.turnStartTime = now;
                    } else {
                        game.turnDeadline = undefined;
                        game.turnStartTime = undefined;
                    }
                    game.pausedTurnTimeLeft = undefined;
                    if (pendingAiAfterUserHiddenReveal && game.isAiGame) {
                        // 즉시 makeAiMove를 강제 호출하면 AI 락 경합으로 스킵되는 케이스가 있어
                        // 메인 루프가 안정적으로 처리하도록 AI 턴 시작 시각만 설정한다.
                        game.aiTurnStartTime = now;
                        await db.saveGame(game);
                        const { broadcastToGameParticipants } = await import('../socket.js');
                        const { updateGameCache } = await import('../gameCache.js');
                        updateGameCache(game);
                        broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                        return;
                    }
                    break;
                }
                {
                    const myPlayerEnum = cap.move.player;
                    const opponentPlayerEnum = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;

                    if (await applyPreserveDiscovererTurnIfPending(game, now, cap)) {
                        break;
                    }

                    if (!game.justCaptured) game.justCaptured = [];

                    for (const stone of cap.stones) {
                        game.boardState[stone.y][stone.x] = types.Player.None; // Remove stone from board
        
                        const isBaseStone = game.baseStones?.some(bs => bs.x === stone.x && bs.y === stone.y);
                        let moveIndex = -1;
                        for (let i = (game.moveHistory?.length ?? 0) - 1; i >= 0; i--) {
                            const m = game.moveHistory![i];
                            if (m.x === stone.x && m.y === stone.y) {
                                moveIndex = i;
                                break;
                            }
                        }
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
                            }
                        }
                        game.captures[myPlayerEnum] += points;
        
                        game.justCaptured.push({ point: stone, player: opponentPlayerEnum, wasHidden: wasHiddenForEntry || wasAiInitialHidden, capturePoints: points });
                    }
                    
                    // pendingCapture.stones에 “수순 좌표(히든 공개 시도 위치)”가 포함되는 경우가 있어,
                    // 여기서 제거된 좌표에는 반드시 “수순을 둔 쪽의 돌”을 다시 배치한다.
                    // (히든돌을 따냈을 때: 공개 연출 중엔 상대 히든이 보이고, 종료 후에는 일반돌로 존재해야 함)
                    if (cap.move && typeof cap.move.x === 'number' && typeof cap.move.y === 'number') {
                        game.boardState[cap.move.y][cap.move.x] = myPlayerEnum;
                    }
                    stripPatternStonesAtConsumedIntersections(game);
                    
                    if (!game.newlyRevealed) game.newlyRevealed = [];
                    game.newlyRevealed.push(...cap.hiddenContributors.map(p => ({ point: p, player: myPlayerEnum })));
                }

                game.animation = null;
                game.gameStatus = 'playing';
                game.revealAnimationEndTime = undefined;
                game.pendingCapture = null;
                (game as any).pendingAiMoveAfterUserHiddenFullReveal = undefined;

                // Resume timer for the next player (연출 중 game.currentPlayer가 실제 착수자와 다를 수 있음)
                const playerWhoMoved = cap.move.player;
                const nextPlayer = playerWhoMoved === types.Player.Black ? types.Player.White : types.Player.Black;
                
                if (game.settings.timeLimit > 0) {
                    const timeKey = playerWhoMoved === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                    const fischerIncrement = getFischerIncrementSeconds(game as any);
                    
                    if (game.pausedTurnTimeLeft) {
                        game[timeKey] = game.pausedTurnTimeLeft + fischerIncrement;
                    }
                }
                
                game.currentPlayer = nextPlayer;

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
            }
            break;
        case 'hidden_final_reveal':
            if (game.revealAnimationEndTime && now >= game.revealAnimationEndTime) {
                game.animation = null;
                game.revealAnimationEndTime = undefined;
                await getGameResult(game);
            }
            break;
    }
};

export const handleHiddenAction = (volatileState: types.VolatileState, game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): HandleActionResult | null => {
    const { type, payload } = action;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? types.Player.Black : (user.id === game.whitePlayerId ? types.Player.White : types.Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;
    // 도전의 탑/싱글: 유저가 방금 둔 직후(턴이 AI로 넘어갔지만 AI가 아직 두기 전)에도 히든/스캔 허용 (싱글플레이와 동일)
    const lastMove = game.moveHistory?.length ? game.moveHistory[game.moveHistory.length - 1] : null;
    const lastMoveWasMine = lastMove && (lastMove as { player?: number }).player === myPlayerEnum;
    const isStrategicAiGame =
        !!game.isAiGame &&
        !game.isSinglePlayer &&
        (game as any).gameCategory !== 'tower' &&
        (game as any).gameCategory !== 'singleplayer' &&
        (game as any).gameCategory !== 'guildwar';
    const allowItemAfterMyMove =
        (game.isSinglePlayer ||
            (game as any).gameCategory === 'tower' ||
            (game as any).gameCategory === 'guildwar' ||
            isStrategicAiGame) &&
        game.gameStatus === 'playing' &&
        lastMoveWasMine &&
        !isMyTurn;
    const canUseItem = isMyTurn || allowItemAfterMyMove;

    switch(type) {
        case 'START_HIDDEN_PLACEMENT': {
            if (!canUseItem || game.gameStatus !== 'playing') return { error: "Not your turn to use an item." };
            // Mix/타워: 히든 개수 확인 (없으면 진입 불가)
            const isMixOrHidden = game.mode === types.GameMode.Hidden || (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Hidden));
            if (isMixOrHidden) {
                const hiddenKey = user.id === game.player1.id ? 'hidden_stones_p1' : 'hidden_stones_p2';
                const left = game[hiddenKey] ?? game.settings.hiddenStoneCount ?? 0;
                if (left <= 0) return { error: "No hidden stones left." };
            }
            game.gameStatus = 'hidden_placing';
            pauseGameTimer(game, now, 30000);
            return {};
        }
        case 'START_SCANNING': {
            if (!canUseItem || game.gameStatus !== 'playing') return { error: "Not your turn to use an item." };
            const scanKeyStart = user.id === game.player1.id ? 'scans_p1' : 'scans_p2';
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
            return {};
        }
        case 'SCAN_BOARD':
            if (game.gameStatus !== 'scanning') return { error: "Not in scanning mode." };
            const { x, y } = payload;
            const scanKey = user.id === game.player1.id ? 'scans_p1' : 'scans_p2';
            if ((game[scanKey] ?? 0) <= 0) return { error: "No scans left." };

            const evalResult = evaluateHiddenScanBoard(game, user.id, x, y);
            if (!evalResult.success) {
                game[scanKey] = (game[scanKey] ?? 0) - 1;
            } else {
                recordSoftHiddenScanDiscovery(game, user.id, evalResult);
            }
            game.animation = buildHiddenScanAnimation(now, user.id, x, y, evalResult.success);
            game.gameStatus = 'scanning_animating';
            // 아이템 사용 직후에는 현재 플레이어를 사용한 유저로 고정하여 턴 정지 버그를 방지한다.
            game.currentPlayer = myPlayerEnum;

            // After using the item, restore my time, reset timers and KEEP THE TURN
            resumeGameTimer(game, now, myPlayerEnum);
            
            // The `updateHiddenState` will transition from 'scanning_animating' to 'playing'
            // after the animation, but the timer is already correctly running for the current player.
            return {};
    }

    return null;
}
