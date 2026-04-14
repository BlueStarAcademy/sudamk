import * as types from '../../types/index.js';
import * as db from '../db.js';
import { pauseGameTimer, resumeGameTimer } from './shared.js';
import { isFischerStyleTimeControl, getFischerIncrementSeconds } from '../../shared/utils/gameTimeControl.js';
import {
    consumeOpponentPatternStoneIfAny,
    stripPatternStonesAtConsumedIntersections,
} from '../../shared/utils/patternStoneConsume.js';

type HandleActionResult = types.HandleActionResult;

export const initializeSinglePlayerHidden = (game: types.LiveGameSession) => {
    const isHiddenMode = game.mode === types.GameMode.Hidden || (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Hidden));
    if (isHiddenMode && game.isSinglePlayer) {
        game.scans_p1 = (game.settings.scanCount || 0);
        game.scans_p2 = (game.settings.scanCount || 0);
        game.hidden_stones_p1 = (game.settings.hiddenStoneCount || 0);
        game.hidden_stones_p2 = (game.settings.hiddenStoneCount || 0);
        game.hidden_stones_used_p1 = 0;
        game.hidden_stones_used_p2 = 0;
        // AI 턴 1~10 중 하나를 경기 시작 시 랜덤으로 정해 두고, 그 AI 턴에만 히든 연출 (전체 수순이 아니라 '몇 번째 AI 차례'인지)
        if ((game.hidden_stones_p2 ?? 0) > 0 && game.aiHiddenItemTurn === undefined) {
            game.aiHiddenItemTurn = 1 + Math.floor(Math.random() * 10); // 1=1번째 AI턴, 2=2번째 AI턴, ..., 10=10번째 AI턴
        }
    }
};

export const updateSinglePlayerHiddenState = async (game: types.LiveGameSession, now: number) => {
    // 싱글플레이 게임이 아니면 처리하지 않음
    if (!game.isSinglePlayer) {
        return;
    }

    const isItemMode = ['hidden_placing', 'scanning'].includes(game.gameStatus);

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
            const hiddenKey = timedOutPlayerId === game.player1.id ? 'hidden_stones_p1' : 'hidden_stones_p2';
            const currentHidden = game[hiddenKey] ?? 0;
            if (currentHidden > 0) {
                game[hiddenKey] = currentHidden - 1;
                const usedKey = timedOutPlayerId === game.player1.id ? 'hidden_stones_used_p1' : 'hidden_stones_used_p2';
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
        resumeGameTimer(game, now, timedOutPlayerEnum);
        console.log(`[updateSinglePlayerHiddenState] Turn maintained: player=${timedOutPlayerEnum}, gameId=${game.id}`);
        
        // 상태 변경을 표시하여 상위 함수에서 브로드캐스트하도록 함
        (game as any)._itemTimeoutStateChanged = true;
        
        return;
    }

    switch (game.gameStatus) {
        case 'scanning_animating': {
            // PVP(hidden.ts)와 동일: animation이 비정상적으로 사라져도 본경기로 복귀 (무한 scanning_animating 방지)
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
                const cap = game.pendingCapture;
                const isAiTurnCancelled = (game as any).isAiTurnCancelledAfterReveal;
                // 히든 돌만 공개(따냄 없음): AI가 유저 히든 위에 두려 한 경우 — 타이머만 재개, 턴 유지
                if (!cap) {
                    game.animation = null;
                    game.gameStatus = 'playing';
                    game.revealAnimationEndTime = undefined;
                    game.pendingCapture = null;
                    (game as any).isAiTurnCancelledAfterReveal = undefined;
                    const cur = game.currentPlayer;
                    if (game.settings?.timeLimit > 0 && game.pausedTurnTimeLeft !== undefined) {
                        const timeKey = cur === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                        game[timeKey] = game.pausedTurnTimeLeft;
                        const isFischer = isFischerStyleTimeControl(game as any);
                        const byoyomiTime = game.settings.byoyomiTime ?? 0;
                        const isInByoyomi = game[timeKey] <= 0 && game.settings.byoyomiCount > 0 && !isFischer;
                        if (isInByoyomi && byoyomiTime > 0) {
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
                    break;
                }
                // 히든 아이템 사용 후 게임 상태 복원
                game.gameStatus = 'playing';
                const myPlayerEnum = cap.move.player;
                resumeGameTimer(game, now, myPlayerEnum);

                {
                    const opponentPlayerEnum = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;

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
                        const wasAiInitialHidden = (game as any).aiInitialHiddenStone &&
                            (game as any).aiInitialHiddenStone.x === stone.x && (game as any).aiInitialHiddenStone.y === stone.y;
                        if (wasAiInitialHidden) (game as any).aiInitialHiddenStone = undefined;
                        
                        let points = 1;
                        let wasHiddenForEntry = false;
                        if (isBaseStone) {
                            game.baseStoneCaptures[myPlayerEnum]++;
                            points = 5;
                        } else if (consumeOpponentPatternStoneIfAny(game, stone, opponentPlayerEnum)) {
                            points = 2;
                        } else if (wasHidden || wasAiInitialHidden) {
                            game.hiddenStoneCaptures[myPlayerEnum] = (game.hiddenStoneCaptures[myPlayerEnum] || 0) + 1;
                            points = 5;
                            wasHiddenForEntry = true;
                        }
                        game.captures[myPlayerEnum] += points;
            
                        game.justCaptured.push({ point: stone, player: opponentPlayerEnum, wasHidden: wasHiddenForEntry || wasAiInitialHidden, capturePoints: points });
                    }
                    stripPatternStonesAtConsumedIntersections(game);
                    if (cap.move && typeof cap.move.x === 'number' && typeof cap.move.y === 'number') {
                        game.boardState[cap.move.y][cap.move.x] = myPlayerEnum;
                    }

                    if (!game.newlyRevealed) game.newlyRevealed = [];
                    game.newlyRevealed.push(...cap.hiddenContributors.map(p => ({ point: p, player: myPlayerEnum })));
                }

                game.animation = null;
                game.revealAnimationEndTime = undefined;
                game.pendingCapture = null;
                (game as any).isAiTurnCancelledAfterReveal = undefined;
                
                // AI 턴이 취소된 경우 (히든돌 공개만 하고 실제 수는 두지 않음) — 바둑판 갱신 후 AI가 다시 수를 두도록 함
                if (isAiTurnCancelled) {
                    game.gameStatus = 'playing';
                    if (game.settings.timeLimit > 0) {
                        const aiTimeKey = game.currentPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                        if (game.pausedTurnTimeLeft) {
                            game[aiTimeKey] = game.pausedTurnTimeLeft;
                        }
                        const isFischer = isFischerStyleTimeControl(game as any);
                        const isInByoyomi = game[aiTimeKey] <= 0 && game.settings.byoyomiCount > 0 && !isFischer;
                        if (isInByoyomi) {
                            game.turnDeadline = now + game.settings.byoyomiTime * 1000;
                        } else {
                            game.turnDeadline = now + (game[aiTimeKey] ?? 0) * 1000;
                        }
                        game.turnStartTime = now;
                    } else {
                        game.turnDeadline = undefined;
                        game.turnStartTime = undefined;
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
                                console.error(`[updateSinglePlayerHiddenState] AI move after hidden reveal failed for ${game.id}:`, e?.message);
                            }
                        }).catch((err: any) => {
                            console.error(`[updateSinglePlayerHiddenState] makeAiMove after hidden reveal failed for ${game.id}:`, err?.message);
                        });
                    });
                    return;
                }
                
                // 일반적인 경우: 다음 플레이어로 턴 전환
                game.gameStatus = 'playing';
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
                
                if (game.settings.timeLimit > 0) {
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
                
                // 히든 돌 공개 애니메이션 종료 후 자동 계가 체크
                // 단, AI 턴인 경우 AI가 수를 두기 전이므로 체크하지 않음 (AI가 수를 둔 후에 체크됨)
                if (game.isSinglePlayer && game.stageId) {
                    const { SINGLE_PLAYER_STAGES } = await import('../../constants/singlePlayerConstants.js');
                    const stage = SINGLE_PLAYER_STAGES.find(s => s.id === game.stageId);
                    const autoScoringTurns = stage?.autoScoringTurns;
                    
                    if (autoScoringTurns !== undefined) {
                        // AI 턴인지 확인 (AI는 항상 White, 유저는 Black)
                        const isAiTurn = game.currentPlayer === types.Player.White && game.isSinglePlayer;
                        
                        if (!isAiTurn) {
                            // 유저 턴인 경우에만 체크 (AI 턴은 AI가 수를 둔 후에 체크됨)
                            const validMoves = game.moveHistory.filter(m => m.x !== -1 && m.y !== -1);
                            const totalTurns = game.totalTurns ?? validMoves.length;
                            game.totalTurns = totalTurns;
                            
                            if (totalTurns >= autoScoringTurns && game.gameStatus === 'playing') {
                                console.log(`[updateSinglePlayerHiddenState] Auto-scoring triggered after hidden reveal animation: totalTurns=${totalTurns}, autoScoringTurns=${autoScoringTurns}`);
                                // getGameResult가 미공개 히든 돌이 있으면 hidden_final_reveal로 공개 연출 후 계가 진행
                                const { getGameResult } = await import('../gameModes.js');
                                await getGameResult(game);
                                return;
                            }
                        }
                    }
                }
            }
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
    if (!game.isSinglePlayer) {
        return null;
    }

    const { type, payload } = action;
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
            const hiddenKey = user.id === game.player1.id ? 'hidden_stones_p1' : 'hidden_stones_p2';
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
            const hasUnrevealedInMoveHistory = !!(game.hiddenMoves && game.moveHistory && game.moveHistory.some((m: types.Move, idx: number) => {
                if (m.x === -1 || m.y === -1) return false;
                const isOpponent = m.player === opponentPlayerEnum;
                const isHidden = !!game.hiddenMoves?.[idx];
                const isRevealed = game.permanentlyRevealedStones?.some((p: types.Point) => p.x === m.x && p.y === m.y);
                const stillOnBoard = game.boardState?.[m.y]?.[m.x] === opponentPlayerEnum;
                return isOpponent && isHidden && !isRevealed && stillOnBoard;
            }));
            const aiHidden = (game as any).aiInitialHiddenStone as { x: number; y: number } | undefined;
            const hasUnrevealedAiInitial = !!aiHidden &&
                !game.permanentlyRevealedStones?.some((p: types.Point) => p.x === aiHidden.x && p.y === aiHidden.y) &&
                game.boardState?.[aiHidden.y]?.[aiHidden.x] === opponentPlayerEnum;
            const stageAllowsHiddenStones = ((game.settings as any)?.hiddenStoneCount ?? 0) > 0;
            const hasAnyUnrevealedOpponentStone = stageAllowsHiddenStones && !!game.boardState && !!game.moveHistory && game.moveHistory.some((m: types.Move) => {
                if (m.x < 0 || m.y < 0) return false;
                if (m.player !== opponentPlayerEnum) return false;
                const isRevealed = game.permanentlyRevealedStones?.some((p: types.Point) => p.x === m.x && p.y === m.y);
                const stillOnBoard = game.boardState?.[m.y]?.[m.x] === opponentPlayerEnum;
                return !isRevealed && stillOnBoard;
            });
            const opponentHasUnrevealedHidden = hasUnrevealedInMoveHistory || hasUnrevealedAiInitial || hasAnyUnrevealedOpponentStone;
            if (!opponentHasUnrevealedHidden) {
                console.log(`[handleSinglePlayerHiddenAction] START_SCANNING rejected: No unrevealed opponent hidden stones (moveHistory=${!!game.moveHistory?.length}, hiddenMoves=${!!game.hiddenMoves}, aiInitial=${!!aiHidden}, anyOpp=${!!hasAnyUnrevealedOpponentStone})`);
                return { error: "No hidden stones to scan." };
            }
            console.log(`[handleSinglePlayerHiddenAction] START_SCANNING: Changing gameStatus from ${game.gameStatus} to scanning`);
            game.gameStatus = 'scanning';
            pauseGameTimer(game, now, 30000);
            console.log(`[handleSinglePlayerHiddenAction] START_SCANNING: SUCCESS - gameStatus=${game.gameStatus}, itemUseDeadline=${game.itemUseDeadline}`);
            return {};
        }
        case 'SCAN_BOARD':
            if (game.gameStatus !== 'scanning') return { error: "Not in scanning mode." };
            const { x, y } = payload;
            const scanKey = user.id === game.player1.id ? 'scans_p1' : 'scans_p2';
            if ((game[scanKey] ?? 0) <= 0) return { error: "No scans left." };
            game[scanKey] = (game[scanKey] ?? 0) - 1;

            // AI 초기 히든돌 확인
            const isAiInitialHiddenStone = (game as any).aiInitialHiddenStone &&
                (game as any).aiInitialHiddenStone.x === x &&
                (game as any).aiInitialHiddenStone.y === y;
            
            const moveIndex = game.moveHistory.findIndex(m => m.x === x && m.y === y);
            const success = (moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex]) || isAiInitialHiddenStone;

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
            // 스캔 아이템 사용 후 턴이 넘어가지 않도록 현재 플레이어 유지
            game.currentPlayer = myPlayerEnum;

            // After using the item, restore my time, reset timers and KEEP THE TURN
            resumeGameTimer(game, now, myPlayerEnum);

            // The `updateSinglePlayerHiddenState` will transition from 'scanning_animating' to 'playing'
            // after the animation, without switching the turn.
            return {};
    }

    return null;
}

