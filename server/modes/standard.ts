import * as summaryService from '../summaryService.js';
import * as types from '../../types/index.js';
import * as db from '../db.js';
import { getGoLogic, processMove } from '../goLogic.js';
import { getGameResult } from '../gameModes.js';
import { initializeNigiri, updateNigiriState, handleNigiriAction } from './nigiri.js';
import { initializeBase, updateBaseState, handleBaseAction } from './base.js';
import { initializeCapture, updateCaptureState, handleCaptureAction } from './capture.js';
import { initializeHidden, updateHiddenState, handleHiddenAction } from './hidden.js';
import { initializeMissile, updateMissileState, handleMissileAction } from './missile.js';
import { handleSharedAction, transitionToPlaying, hasTimeControl, shouldEnforceTimeControl } from './shared.js';
import { isFischerStyleTimeControl, getFischerIncrementSeconds } from '../../shared/utils/gameTimeControl.js';
import {
    consumeOpponentPatternStoneIfAny,
    stripPatternStonesAtConsumedIntersections,
} from '../../shared/utils/patternStoneConsume.js';


export const initializeStrategicGame = (game: types.LiveGameSession, neg: types.Negotiation, now: number) => {
    const p1 = game.player1;
    const p2 = game.player2;

    switch (game.mode) {
        case types.GameMode.Standard:
        case types.GameMode.Speed:
        case types.GameMode.Mix:
            // 믹스룰에 히든/미사일이 포함돼도 이전에는 초기화를 건너뛰어 missiles_p1/p2·스캔이 비어 UI에 아이템이 안 보이는 문제가 있었음
            if (game.mode === types.GameMode.Mix) {
                initializeHidden(game);
                initializeMissile(game);
            }
            if (game.isAiGame) {
                const humanPlayerColor = neg.settings.player1Color || types.Player.Black;
                if (humanPlayerColor === types.Player.Black) {
                    game.blackPlayerId = p1.id;
                    game.whitePlayerId = p2.id;
                } else {
                    game.whitePlayerId = p1.id;
                    game.blackPlayerId = p2.id;
                }
                transitionToPlaying(game, now);
            } else {
                initializeNigiri(game, now);
            }
            break;
        case types.GameMode.Capture:
            if (game.isAiGame) {
                const humanPlayerColor = neg.settings.player1Color || types.Player.Black;
                const p1 = game.player1;
                const p2 = game.player2;
                if (humanPlayerColor === types.Player.Black) {
                    game.blackPlayerId = p1.id;
                    game.whitePlayerId = p2.id;
                } else {
                    game.whitePlayerId = p1.id;
                    game.blackPlayerId = p2.id;
                }
                const st = game.settings as any;
                const blackTarget =
                    typeof st.captureTargetBlack === 'number'
                        ? st.captureTargetBlack
                        : (st.captureTarget ?? 20);
                const whiteTarget =
                    typeof st.captureTargetWhite === 'number'
                        ? st.captureTargetWhite
                        : (st.captureTarget ?? 20);
                game.effectiveCaptureTargets = {
                    [types.Player.None]: 0,
                    [types.Player.Black]: blackTarget,
                    [types.Player.White]: whiteTarget,
                };
                transitionToPlaying(game, now);
            } else {
                initializeCapture(game, now);
            }
            break;
        case types.GameMode.Base:
            initializeBase(game, now);
            break;
        case types.GameMode.Hidden:
            initializeHidden(game);
            if (game.isAiGame) {
                const humanPlayerColor = neg.settings.player1Color || types.Player.Black;
                if (humanPlayerColor === types.Player.Black) {
                    game.blackPlayerId = p1.id;
                    game.whitePlayerId = p2.id;
                } else {
                    game.whitePlayerId = p1.id;
                    game.blackPlayerId = p2.id;
                }
                transitionToPlaying(game, now);
            } else {
                initializeNigiri(game, now); // Also uses nigiri
            }
            break;
        case types.GameMode.Missile:
            initializeMissile(game);
            if (game.isAiGame) {
                const humanPlayerColor = neg.settings.player1Color || types.Player.Black;
                if (humanPlayerColor === types.Player.Black) {
                    game.blackPlayerId = p1.id;
                    game.whitePlayerId = p2.id;
                } else {
                    game.whitePlayerId = p1.id;
                    game.blackPlayerId = p2.id;
                }
                transitionToPlaying(game, now);
            } else {
                initializeNigiri(game, now); // Also uses nigiri
            }
            break;
    }
};

export const updateStrategicGameState = async (game: types.LiveGameSession, now: number) => {
    // This is the core update logic for all Go-based games.
    
    // 플레이어가 차례를 시작할 때 초읽기 모드인지 확인하고, 초읽기 시간을 30초로 리셋
    // (초읽기 모드에서 수를 두면 다음 턴에서 30초로 꽉 채워짐)
    if (game.gameStatus === 'playing' && hasTimeControl(game.settings) && shouldEnforceTimeControl(game) && game.turnStartTime) {
        const timeSinceTurnStart = now - game.turnStartTime;
        // 턴이 시작된 직후 (100ms 이내)에만 체크하여 중복 방지
        if (timeSinceTurnStart >= 0 && timeSinceTurnStart < 100) {
            const currentPlayer = game.currentPlayer;
            const timeKey = currentPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
            const byoyomiKey = currentPlayer === types.Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';
            const isFischer = isFischerStyleTimeControl(game as any);
            
            // 초읽기 모드인지 확인 (메인 시간이 0이고 초읽기 횟수가 남아있는 경우)
            const isInByoyomi = game[timeKey] <= 0 && game.settings.byoyomiCount > 0 && game[byoyomiKey] > 0 && !isFischer;
            
            if (isInByoyomi && game.turnDeadline) {
                // 초읽기 모드에서 수를 두었던 플레이어가 다시 차례가 오면, 초읽기 시간을 30초로 리셋
                game.turnDeadline = now + game.settings.byoyomiTime * 1000;
                game.turnStartTime = now;
                (game as any)._broadcastByoyomiStart = true; // 클라이언트 타이머가 풀 초부터 시작하도록 즉시 브로드캐스트
            }
        }
    }
    
    if (game.gameStatus === 'playing' && shouldEnforceTimeControl(game) && game.turnDeadline && now > game.turnDeadline) {
        const timedOutPlayer = game.currentPlayer;
        const timeKey = timedOutPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        const byoyomiKey = timedOutPlayer === types.Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';
        const isFischer = isFischerStyleTimeControl(game as any);

        if (isFischer) {
            // Fischer timeout is an immediate loss.
        } else if (game[timeKey] > 0) { // Main time expired -> enter byoyomi without consuming a period
            game[timeKey] = 0;
            if (game.settings.byoyomiCount > 0 && game[byoyomiKey] > 0) {
                game.turnDeadline = now + game.settings.byoyomiTime * 1000;
                game.turnStartTime = now;
                (game as any)._broadcastByoyomiStart = true;
                return;
            }
        } else { // Byoyomi expired
            if (game[byoyomiKey] > 1) {
                game[byoyomiKey]--;
                game.turnDeadline = now + game.settings.byoyomiTime * 1000;
                game.turnStartTime = now;
                (game as any)._broadcastByoyomiStart = true;
                return;
            }
            // 초읽기 횟수가 0이 되는 순간(1회 남은 상태에서 시간 만료) 바로 패배 처리
        }
        
        // No time or byoyomi left
        const winner = timedOutPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
        game.lastTimeoutPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
        game.lastTimeoutPlayerIdClearTime = now + 5000;
        
        summaryService.endGame(game, winner, 'timeout');
    }

    // 전략바둑에서 1분 동안 상대방이 아무 행동이 없으면 무효처리 버튼 활성화
    const { SPECIAL_GAME_MODES } = await import('../../constants/index.js');
    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === game.mode);
    if (isStrategic && game.gameStatus === 'playing' && !game.isSinglePlayer && !game.isAiGame) {
        const gameStartTime = game.gameStartTime || game.createdAt || now;
        const gameDuration = now - gameStartTime;
        const ONE_MINUTE_MS = 60 * 1000;
        
        // 게임 시작 후 1분 경과했고, 아무 행동이 없는 경우 (moveHistory가 비어있거나 매우 적은 경우)
        if (gameDuration >= ONE_MINUTE_MS && game.moveHistory.length === 0) {
            // 양쪽 모두 무효처리 요청 가능
            if (!game.canRequestNoContest) game.canRequestNoContest = {};
            game.canRequestNoContest[game.player1.id] = true;
            game.canRequestNoContest[game.player2.id] = true;
        }
    }

    // Delegate to mode-specific update logic
    updateNigiriState(game, now);
    updateCaptureState(game, now);
    updateBaseState(game, now);
    
    // 싱글플레이 게임인 경우 싱글플레이용 업데이트 함수 사용
    if (game.isSinglePlayer) {
        const { updateSinglePlayerHiddenState } = await import('./singlePlayerHidden.js');
        const { updateSinglePlayerMissileState } = await import('./singlePlayerMissile.js');
        await updateSinglePlayerHiddenState(game, now);
        const missileStateChanged = await updateSinglePlayerMissileState(game, now);
        const itemTimeoutStateChanged = (game as any)._itemTimeoutStateChanged;
        if (missileStateChanged || itemTimeoutStateChanged) {
            if (itemTimeoutStateChanged) {
                (game as any)._itemTimeoutStateChanged = false;
            }
            if (missileStateChanged) {
                (game as any)._missileStateChanged = true;
            }
            // 싱글플레이 게임의 경우 서버 루프에서 브로드캐스트하지 않으므로, 여기서 직접 브로드캐스트
            const { broadcastToGameParticipants } = await import('../socket.js');
            const { updateGameCache } = await import('../gameCache.js');
            const db = await import('../db.js');
            // 히든/스캔 타임아웃 후 캐시 갱신 — AI·클라이언트가 본경기(playing) 보드를 제대로 인식하도록
            updateGameCache(game);
            await db.saveGame(game);
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
        }
    } else if (game.gameCategory === 'tower') {
        // 도전의 탑 PVE: 싱글플레이와 동일하게 towerPlayerHidden 전용 업데이트 사용
        const { updateTowerPlayerHiddenState } = await import('./towerPlayerHidden.js');
        await updateTowerPlayerHiddenState(game, now);
        const missileStateChanged = updateMissileState(game, now);
        const itemTimeoutStateChanged = (game as any)._itemTimeoutStateChanged;
        if (missileStateChanged) (game as any)._missileStateChanged = true;
        if (itemTimeoutStateChanged || missileStateChanged) {
            if (itemTimeoutStateChanged) (game as any)._itemTimeoutStateChanged = false;
            const { broadcastToGameParticipants } = await import('../socket.js');
            const { updateGameCache } = await import('../gameCache.js');
            const db = await import('../db.js');
            updateGameCache(game);
            await db.saveGame(game);
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
        }
    } else {
        await updateHiddenState(game, now);
        const missileStateChanged = updateMissileState(game, now);
        if (missileStateChanged) {
            (game as any)._missileStateChanged = true;
        }
    }
};

export const handleStrategicGameAction = async (volatileState: types.VolatileState, game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): Promise<types.HandleActionResult | undefined> => {
    // Try shared actions first
    const sharedResult = await handleSharedAction(volatileState, game, action, user);
    if (sharedResult) return sharedResult;

    // Then try each specific handler.
    let result: types.HandleActionResult | null = null;
    
    result = handleNigiriAction(game, action, user);
    if (result) return result;
    
    result = handleCaptureAction(game, action, user);
    if (result) return result;

    result = handleBaseAction(game, action, user);
    if (result) return result;

    result = handleHiddenAction(volatileState, game, action, user);
    if (result) return result;

    result = handleMissileAction(game, action, user);
    if (result) return result;
    
    // Fallback to standard actions if no other handler caught it.
    const standardResult = await handleStandardAction(volatileState, game, action, user);
    if(standardResult) return standardResult;
    
    return undefined;
};


// Keep the original standard action handler, but rename it to avoid conflicts.
const handleStandardAction = async (volatileState: types.VolatileState, game: types.LiveGameSession, action: types.ServerAction, user: types.User): Promise<types.HandleActionResult | null> => {
    const { type, payload } = action as any;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? types.Player.Black : (user.id === game.whitePlayerId ? types.Player.White : types.Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;

    switch (type) {
        case 'PLACE_STONE': {
            // triggerAutoScoring 플래그가 있으면 계가를 트리거
            if (payload.triggerAutoScoring) {
                // 온라인 전략바둑/PVP/AI 대국에서는 항상 서버의 게임 상태를 기준으로 계가해야 함
                // (클라이언트가 새로고침 후 잘못된 boardState를 보내면 오계가 발생할 수 있음)
                const isClientAuthoritative =
                    game.isSinglePlayer || game.gameCategory === 'tower' || game.gameCategory === 'singleplayer';

                if (isClientAuthoritative) {
                    // 싱글플레이/도전의 탑: 클라이언트가 보낸 최종 보드/수순을 우선 사용
                    const payloadHasBoard =
                        payload.boardState && Array.isArray(payload.boardState) && payload.boardState.length > 0;
                    const payloadHasMoves =
                        payload.moveHistory && Array.isArray(payload.moveHistory) && payload.moveHistory.length > 0;

                    if (payloadHasMoves) {
                        game.moveHistory = payload.moveHistory;
                        if (payload.totalTurns !== undefined) game.totalTurns = payload.totalTurns;
                    }

                    if (payloadHasBoard) {
                        game.boardState = payload.boardState;
                    } else if (game.isSinglePlayer && game.id.startsWith('sp-game-')) {
                        const { getCachedGame } = await import('../gameCache.js');
                        const cachedGame = await getCachedGame(game.id);
                        if (cachedGame?.boardState?.length && cachedGame?.moveHistory?.length) {
                            game.boardState = cachedGame.boardState;
                            if (!payloadHasMoves) game.moveHistory = cachedGame.moveHistory;
                            if (cachedGame.totalTurns != null) game.totalTurns = cachedGame.totalTurns;
                        }
                    }

                    if (payload.blackTimeLeft !== undefined) game.blackTimeLeft = payload.blackTimeLeft;
                    if (payload.whiteTimeLeft !== undefined) game.whiteTimeLeft = payload.whiteTimeLeft;

                    if (payload.captures && typeof payload.captures === 'object') {
                        // 싱글플레이는 클라이언트에서 포획 수를 계산하므로, 자동계가 시점에 동기화가 필요
                        game.captures = { ...(game.captures || {}), ...payload.captures };
                    }
                    if (payload.hiddenMoves != null && typeof payload.hiddenMoves === 'object') {
                        game.hiddenMoves = { ...payload.hiddenMoves };
                    }
                    if (payload.permanentlyRevealedStones != null && Array.isArray(payload.permanentlyRevealedStones)) {
                        game.permanentlyRevealedStones = payload.permanentlyRevealedStones.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
                    }
                } else {
                    // 온라인 대국: 클라이언트가 보낸 보드/수순은 신뢰하지 않고 서버 상태를 유지
                    // 단, 남은 시간 정보는 참고용으로만 업데이트
                    if (payload.blackTimeLeft !== undefined) game.blackTimeLeft = payload.blackTimeLeft;
                    if (payload.whiteTimeLeft !== undefined) game.whiteTimeLeft = payload.whiteTimeLeft;
                }
                
                // 게임 캐시 업데이트 (계가 시작 전에 최신 상태 저장 - 싱글플레이 전용)
                if (game.isSinglePlayer && game.id.startsWith('sp-game-')) {
                    const { updateGameCache } = await import('../gameCache.js');
                    updateGameCache(game);
                }
                
                // 0/N 도달 검증: 싱글/탑은 유효 착수 수, 온라인(PVP 등)은 moveHistory 길이(PASS 포함) — strategic.ts·scoringTurnLimit와 동일
                const validMoves = (game.moveHistory || []).filter((m: { x: number; y: number }) => m && m.x !== -1 && m.y !== -1);
                const useMoveHistoryCountForLimit =
                    !game.isSinglePlayer && game.gameCategory !== 'tower';
                const totalTurns = useMoveHistoryCountForLimit
                    ? (game.moveHistory || []).length
                    : validMoves.length;
                game.totalTurns = totalTurns;
                let autoScoringTurns: number | undefined;
                if (game.gameCategory === 'tower') {
                    autoScoringTurns = (game.settings as any)?.autoScoringTurns;
                } else if (game.isSinglePlayer && game.stageId) {
                    const { SINGLE_PLAYER_STAGES } = await import('../../constants/singlePlayerConstants.js');
                    autoScoringTurns = SINGLE_PLAYER_STAGES.find(s => s.id === game.stageId)?.autoScoringTurns;
                } else {
                    autoScoringTurns = (game.settings as any)?.autoScoringTurns ?? (game.settings as any)?.scoringTurnLimit;
                }
                const remainingTurns = autoScoringTurns != null ? Math.max(0, autoScoringTurns - totalTurns) : 0;
                if (autoScoringTurns != null && remainingTurns > 0) {
                    console.warn(`[handleStandardAction] triggerAutoScoring ignored: remainingTurns=${remainingTurns} (totalTurns=${totalTurns}, autoScoringTurns=${autoScoringTurns})`);
                    return {};
                }
                
                game.gameStatus = 'scoring';
                await db.saveGame(game);
                console.log(`[handleStandardAction] Game ${game.id} set to scoring state (0/N reached), calling getGameResult...`);
                try {
                    await getGameResult(game);
                    console.log(`[handleStandardAction] getGameResult completed for game ${game.id}`);
                } catch (error) {
                    console.error(`[handleStandardAction] Error in getGameResult for game ${game.id}:`, error);
                    throw error;
                }
                return {};
            }

            // 클라이언트 측 AI(Electron 로컬 GnuGo): 클라이언트가 계산한 AI 수를 서버가 검증 후 적용
            const useClientSideAi = (game.settings as any)?.useClientSideAi === true;
            if (payload.clientSideAiMove && useClientSideAi && game.isAiGame) {
                const { aiUserId } = await import('../aiPlayer.js');
                const aiPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                if (aiPlayerId === aiUserId && game.currentPlayer !== types.Player.None && (game.gameStatus === 'playing' || game.gameStatus === 'hidden_placing')) {
                    const { x, y } = payload;
                    const boardSize = game.settings.boardSize;
                    if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || x >= boardSize || y < 0 || y >= boardSize) {
                        return { error: 'Invalid client-side AI move position.' };
                    }
                    const aiPlayerEnum = game.currentPlayer;
                    const humanPlayerEnum = aiPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
                    const move = { x, y, player: aiPlayerEnum };
                    const result = processMove(
                        game.boardState,
                        move,
                        game.koInfo,
                        game.moveHistory.length,
                        { ignoreSuicide: false, isSinglePlayer: true, opponentPlayer: humanPlayerEnum }
                    );
                    if (!result.isValid) {
                        return { error: `Client-side AI move invalid: ${result.reason || 'invalid'}` };
                    }
                    const isHiddenAiMove = !!(payload as any).isHidden;
                    if (isHiddenAiMove) {
                        const aiPlayerIdForHidden =
                            aiPlayerEnum === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                        const hiddenKeyForAi =
                            aiPlayerIdForHidden === game.player1.id ? 'hidden_stones_p1' : 'hidden_stones_p2';
                        const curHiddenForAi =
                            (game as any)[hiddenKeyForAi] ?? game.settings.hiddenStoneCount ?? 0;
                        if (curHiddenForAi <= 0) {
                            return { error: 'AI has no hidden stones remaining.' };
                        }
                    }
                    game.boardState = result.newBoardState;
                    game.moveHistory.push(move);
                    game.koInfo = result.newKoInfo;
                    if (!isHiddenAiMove) {
                        game.lastMove = { x, y };
                    } else {
                        if (!game.hiddenMoves) game.hiddenMoves = {};
                        game.hiddenMoves[game.moveHistory.length - 1] = true;
                        const aiPlayerId =
                            aiPlayerEnum === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                        const hiddenKey =
                            aiPlayerId === game.player1.id ? 'hidden_stones_p1' : 'hidden_stones_p2';
                        const curHidden =
                            (game as any)[hiddenKey] ?? game.settings.hiddenStoneCount ?? 0;
                        (game as any)[hiddenKey] = Math.max(0, curHidden - 1);
                    }
                    game.passCount = 0;
                    if (result.capturedStones.length > 0) {
                        game.captures[aiPlayerEnum] = (game.captures[aiPlayerEnum] ?? 0) + result.capturedStones.length;
                        if (!game.justCaptured) game.justCaptured = [];
                        for (const stone of result.capturedStones) {
                            game.justCaptured.push({ point: stone, player: humanPlayerEnum, wasHidden: false, capturePoints: 1 });
                        }
                    }
                    game.currentPlayer = humanPlayerEnum;
                    game.gameStatus = 'playing';
                    game.aiTurnStartTime = undefined;
                    const { hasTimeControl, shouldEnforceTimeControl } = await import('./shared.js');
                    if (hasTimeControl(game.settings) && shouldEnforceTimeControl(game)) {
                        const nextTimeKey = humanPlayerEnum === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                        const nextByoyomiKey = humanPlayerEnum === types.Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';
                        const isFischer = isFischerStyleTimeControl(game as any);
                        const isNextInByoyomi = (game[nextTimeKey] ?? 0) <= 0 && (game.settings.byoyomiCount ?? 0) > 0 && (game[nextByoyomiKey] ?? 0) > 0 && !isFischer;
                        if (isNextInByoyomi) {
                            game.turnDeadline = now + (game.settings.byoyomiTime ?? 30) * 1000;
                        } else {
                            game.turnDeadline = now + Math.max(0, game[nextTimeKey] ?? 0) * 1000;
                        }
                        game.turnStartTime = now;
                    } else {
                        game.turnDeadline = undefined;
                        game.turnStartTime = undefined;
                    }
                    // 길드전 등: 계가까지 N수 — 클라이언트 AI 수도 totalTurns·자동 계가 반영
                    const autoScoringAfterAi = (game.settings as any)?.autoScoringTurns as number | undefined;
                    if (
                        (game as any).gameCategory === 'guildwar' &&
                        autoScoringAfterAi != null &&
                        autoScoringAfterAi > 0
                    ) {
                        const validAfter = (game.moveHistory || []).filter(m => m.x !== -1 && m.y !== -1);
                        game.totalTurns = validAfter.length;
                        if (validAfter.length >= autoScoringAfterAi) {
                            game.gameStatus = 'scoring';
                            await db.saveGame(game);
                            const { broadcastToGameParticipants } = await import('../socket.js');
                            const gameToBroadcast = { ...game };
                            delete (gameToBroadcast as any).boardState;
                            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);
                            try {
                                await getGameResult(game);
                            } catch (e: any) {
                                console.error(
                                    `[handleStandardAction] getGameResult failed after clientSideAiMove (guildwar autoScoring) for game ${game.id}:`,
                                    e?.message
                                );
                            }
                            return {};
                        }
                    }
                    // 전략바둑: AI 수 적용 후 정해진 수순(scoringTurnLimit) 도달 시 계가 진행
                    const scoringTurnLimitAfterAi = game.settings.scoringTurnLimit;
                    if (scoringTurnLimitAfterAi != null && scoringTurnLimitAfterAi > 0 && !game.isSinglePlayer && game.gameCategory !== 'tower') {
                        // scoringTurnLimit 기준 "턴"은 PASS(-1,-1)도 포함해서 카운트한다.
                        const turnsAfter = (game.moveHistory || []).length;
                        if (turnsAfter >= scoringTurnLimitAfterAi) {
                            console.log(`[handleStandardAction] Scoring turn limit reached after clientSideAiMove: totalTurns=${turnsAfter}, scoringTurnLimit=${scoringTurnLimitAfterAi}, triggering getGameResult`);
                            game.gameStatus = 'scoring';
                            game.totalTurns = turnsAfter;
                            await db.saveGame(game);
                            const { broadcastToGameParticipants } = await import('../socket.js');
                            const gameToBroadcast = { ...game };
                            delete (gameToBroadcast as any).boardState;
                            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);
                            try {
                                await getGameResult(game);
                            } catch (e: any) {
                                console.error(`[handleStandardAction] getGameResult failed after clientSideAiMove for game ${game.id}:`, e?.message);
                            }
                            return {};
                        }
                    }
                    return {};
                }
            }

            if (!isMyTurn || (game.gameStatus !== 'playing' && game.gameStatus !== 'hidden_placing')) {
                return { error: '내 차례가 아닙니다.' };
            }

            const { x, y, isHidden, boardState: clientBoardState, moveHistory: clientMoveHistory } = payload;
            
            // 치명적 버그 방지: 패 위치(-1, -1)에 PLACE_STONE을 보내는 것을 차단
            // (클라이언트 AI 패스는 PASS_TURN 액션으로 처리)
            if (x === -1 || y === -1) {
                console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone at pass position (${x}, ${y}), gameId=${game.id}, isSinglePlayer=${game.isSinglePlayer}, gameCategory=${game.gameCategory}`);
                return { error: '패 위치에는 돌을 놓을 수 없습니다. 패를 하려면 PASS_TURN 액션을 사용하세요.' };
            }
            
            // 치명적 버그 방지: 보드 범위를 벗어나는 위치에 돌을 놓으려는 시도 차단
            const boardSize = game.settings.boardSize;
            if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) {
                console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone out of bounds (${x}, ${y}), boardSize=${boardSize}, gameId=${game.id}, isSinglePlayer=${game.isSinglePlayer}, gameCategory=${game.gameCategory}`);
                return { error: `보드 범위를 벗어난 위치입니다. (${x}, ${y})는 유효하지 않습니다.` };
            }
            
            const opponentPlayerEnum = myPlayerEnum === types.Player.Black ? types.Player.White : (myPlayerEnum === types.Player.White ? types.Player.Black : types.Player.None);
            
            // 싱글플레이/도전의탑/AI 게임에서는 서버의 실제 boardState를 기준으로 체크 (클라이언트 boardState를 신뢰하지 않음)
            // 전략바둑 AI 대국에서 돌이 사라지는 버그 방지: 서버가 단일 소스로 유지
            let serverBoardState = game.boardState;
            let serverMoveHistory = game.moveHistory;
            
            if (game.isSinglePlayer || game.gameCategory === 'tower' || game.isAiGame) {
                // 싱글플레이, 도전의 탑, 전략바둑 AI 대국에서는 서버의 실제 boardState를 사용
                const { getLiveGame } = await import('../db.js');
                const freshGame = await getLiveGame(game.id);
                if (freshGame) {
                    serverBoardState = freshGame.boardState;
                    serverMoveHistory = freshGame.moveHistory;
                }
            }
            
            // 범위 체크 후에만 boardState에 접근
            const stoneAtTarget = serverBoardState[y][x];
            
            // 싱글플레이/도전의 탑/AI 대국은 서버 boardState를 우선 사용한다.
            if (game.isSinglePlayer || game.gameCategory === 'tower' || game.isAiGame) {
                game.boardState = serverBoardState;
                game.moveHistory = serverMoveHistory;
            }
            // PVP: 클라이언트 boardState를 덮어쓰지 않으므로 game.boardState는 캐시(서버) 상태 유지.
            // 낙관적 업데이트로 이미 둔 수를 보내면 finalStoneCheck에서 거절되어 턴이 안 넘어가는 버그 방지.

            // 싱글플레이 모드에서 AI 초기 히든돌 확인
            const isAiInitialHiddenStone = game.isSinglePlayer && 
                (game as any).aiInitialHiddenStone &&
                (game as any).aiInitialHiddenStone.x === x &&
                (game as any).aiInitialHiddenStone.y === y &&
                !game.permanentlyRevealedStones?.some(p => p.x === x && p.y === y);

            const moveIndexAtTarget = game.moveHistory.findIndex(m => m.x === x && m.y === y);
            const isTargetHiddenOpponentStone =
                (stoneAtTarget === opponentPlayerEnum &&
                moveIndexAtTarget !== -1 &&
                game.hiddenMoves?.[moveIndexAtTarget] &&
                !game.permanentlyRevealedStones?.some(p => p.x === x && p.y === y)) ||
                isAiInitialHiddenStone;

            if (stoneAtTarget !== types.Player.None && !isTargetHiddenOpponentStone) {
                if (stoneAtTarget === opponentPlayerEnum) {
                    console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone on opponent stone at (${x}, ${y}), gameId=${game.id}, stoneAtTarget=${stoneAtTarget}, opponentPlayerEnum=${opponentPlayerEnum}, isSinglePlayer=${game.isSinglePlayer}, gameCategory=${game.gameCategory}`);
                    return { error: '상대방이 둔 자리에는 돌을 놓을 수 없습니다.' };
                }
                if (stoneAtTarget === myPlayerEnum) {
                    console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone on own stone at (${x}, ${y}), gameId=${game.id}, stoneAtTarget=${stoneAtTarget}, myPlayerEnum=${myPlayerEnum}`);
                    return { error: '이미 돌이 놓인 자리입니다.' };
                }
                console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone on occupied position at (${x}, ${y}), gameId=${game.id}, stoneAtTarget=${stoneAtTarget}`);
                return { error: '이미 돌이 놓인 자리입니다.' };
            }

            if (isTargetHiddenOpponentStone) {
                // AI 초기 히든돌인 경우 moveHistory에 추가
                if (isAiInitialHiddenStone) {
                    if (!game.hiddenMoves) game.hiddenMoves = {};
                    const hiddenMoveIndex = game.moveHistory.length;
                    game.moveHistory.push({
                        player: opponentPlayerEnum,
                        x: x,
                        y: y
                    });
                    game.hiddenMoves[hiddenMoveIndex] = true;
                }
                
                game.captures[myPlayerEnum] += 5; // Hidden stones are worth 5 points
                game.hiddenStoneCaptures[myPlayerEnum]++;
                
                if (!game.justCaptured) game.justCaptured = [];
                game.justCaptured.push({ point: { x, y }, player: opponentPlayerEnum, wasHidden: true, capturePoints: 5 });
                
                if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                game.permanentlyRevealedStones.push({ x, y });

                game.animation = { 
                    type: 'hidden_reveal', 
                    stones: [{ point: { x, y }, player: opponentPlayerEnum }], 
                    startTime: now, 
                    duration: 2000 
                };
                game.revealAnimationEndTime = now + 2000;
                game.gameStatus = 'hidden_reveal_animating';
                
                // 시간 일시정지
                if (game.turnDeadline) {
                    game.pausedTurnTimeLeft = (game.turnDeadline - now) / 1000;
                    game.turnDeadline = undefined;
                    game.turnStartTime = undefined;
                }
                game.itemUseDeadline = undefined;
                
                return {};
            }

            const move = { x, y, player: myPlayerEnum };
            
            // 치명적 버그 방지: 자신의 돌 위에 착점 시도 차단 (모든 게임 모드)
            const finalStoneCheck = game.boardState[y][x];
            if (finalStoneCheck === myPlayerEnum) {
                console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone on own stone at (${x}, ${y}), gameId=${game.id}, finalStoneCheck=${finalStoneCheck}, myPlayerEnum=${myPlayerEnum}`);
                return { error: '이미 자신의 돌이 놓인 자리입니다.' };
            }
            
            // 싱글플레이/도전의 탑/AI 대국에서 상대 돌 위 착점은 숨김돌 공개 케이스 외에는 차단
            if (game.isSinglePlayer || game.gameCategory === 'tower' || game.isAiGame) {
                if (finalStoneCheck === opponentPlayerEnum) {
                    console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: AI stone detected at (${x}, ${y}) before processMove, gameId=${game.id}, finalStoneCheck=${finalStoneCheck}, opponentPlayerEnum=${opponentPlayerEnum}`);
                    return { error: 'AI가 둔 자리에는 돌을 놓을 수 없습니다.' };
                }
            }
            
            if (isHidden) {
                // 히든 아이템 개수 확인 및 감소 (스캔 아이템처럼)
                const hiddenKey = user.id === game.player1.id ? 'hidden_stones_p1' : 'hidden_stones_p2';
                const currentHidden = game[hiddenKey] ?? game.settings.hiddenStoneCount ?? 0;
                if (currentHidden <= 0) {
                    return { error: "No hidden stones left." };
                }
                game[hiddenKey] = currentHidden - 1;
                
                // 사용 횟수도 추적 (통계용)
                const usedKey = user.id === game.player1.id ? 'hidden_stones_used_p1' : 'hidden_stones_used_p2';
                game[usedKey] = (game[usedKey] || 0) + 1;
            }

            const result = processMove(
                game.boardState, 
                move, 
                game.koInfo, 
                game.moveHistory.length,
                { 
                    ignoreSuicide: false,
                    isSinglePlayer: game.isSinglePlayer || game.gameCategory === 'tower' || game.isAiGame,
                    opponentPlayer: (game.isSinglePlayer || game.gameCategory === 'tower' || game.isAiGame) ? opponentPlayerEnum : undefined
                }
            );
            
            // processMove 결과 검증 (싱글플레이/도전의탑/AI 대국)
            if ((game.isSinglePlayer || game.gameCategory === 'tower' || game.isAiGame) && result.isValid) {
                // processMove 후에도 해당 위치에 상대방 돌이 있는지 확인
                const afterMoveCheck = result.newBoardState[y][x];
                if (afterMoveCheck !== myPlayerEnum) {
                    console.error(`[handleStandardAction] PLACE_STONE CRITICAL: After processMove, stone at (${x}, ${y}) is not player's stone (${afterMoveCheck}), gameId=${game.id}`);
                    return { error: 'AI가 둔 자리에는 돌을 놓을 수 없습니다.' };
                }
            }

            if (!result.isValid) {
                // 착수금지 이유에 따른 명확한 에러 메시지
                let errorMessage = '착수할 수 없는 위치입니다.';
                if (result.reason === 'ko') {
                    errorMessage = '패 모양(단순 코)입니다. 바로 다시 따낼 수 없습니다.';
                } else if (result.reason === 'suicide') {
                    errorMessage = '자충수입니다. 자신의 돌이 죽는 수는 둘 수 없습니다.';
                } else if (result.reason === 'occupied') {
                    errorMessage = '이미 돌이 놓인 자리입니다.';
                }
                if (process.env.NODE_ENV === 'development') {
                    console.warn(`[handleStandardAction] Invalid move at (${x}, ${y}), reason=${result.reason}, gameId=${game.id}`);
                }
                return { error: errorMessage };
            }
            
            // 따낸 돌에 기여한 "우리 돌 전체 연결 그룹"에서 히든 돌 수집 (인접한 돌만이 아니라 연결된 모든 돌 포함)
            const contributingHiddenStones: { point: types.Point, player: types.Player }[] = [];
            if (result.capturedStones.length > 0) {
                const logic = getGoLogic({ ...game, boardState: result.newBoardState });
                const capturingGroupPoints = new Set<string>();
                const queue: { x: number; y: number }[] = [{ x, y }];
                capturingGroupPoints.add(`${x},${y}`);
                while (queue.length > 0) {
                    const cur = queue.shift()!;
                    for (const n of logic.getNeighbors(cur.x, cur.y)) {
                        const key = `${n.x},${n.y}`;
                        if (capturingGroupPoints.has(key)) continue;
                        if (result.newBoardState[n.y][n.x] !== myPlayerEnum) continue;
                        capturingGroupPoints.add(key);
                        queue.push(n);
                    }
                }
                for (const key of capturingGroupPoints) {
                    const [nx, ny] = key.split(',').map(Number);
                    const isCurrentMove = nx === x && ny === y;
                    let isHiddenStone = isCurrentMove ? isHidden : false;
                    if (!isCurrentMove) {
                        const moveIndex = game.moveHistory.findIndex(m => m.x === nx && m.y === ny);
                        isHiddenStone = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
                        if (!isHiddenStone && game.isSinglePlayer && (game as any).aiInitialHiddenStone) {
                            const aiHidden = (game as any).aiInitialHiddenStone;
                            isHiddenStone = nx === aiHidden.x && ny === aiHidden.y &&
                                !game.permanentlyRevealedStones?.some(p => p.x === nx && p.y === ny);
                        }
                    }
                    if (isHiddenStone) {
                        if (!game.permanentlyRevealedStones || !game.permanentlyRevealedStones.some(p => p.x === nx && p.y === ny)) {
                            contributingHiddenStones.push({ point: { x: nx, y: ny }, player: myPlayerEnum });
                        }
                    }
                }
            }

            const capturedHiddenStones: { point: types.Point; player: types.Player }[] = [];
            if (result.capturedStones.length > 0) {
                for (const capturedStone of result.capturedStones) {
                    const moveIndex = game.moveHistory.findIndex(m => m.x === capturedStone.x && m.y === capturedStone.y);
                    if (moveIndex !== -1 && game.hiddenMoves?.[moveIndex]) {
                        const isPermanentlyRevealed = game.permanentlyRevealedStones?.some(p => p.x === capturedStone.x && p.y === capturedStone.y);
                        if (!isPermanentlyRevealed) {
                            capturedHiddenStones.push({ point: capturedStone, player: opponentPlayerEnum });
                        }
                    }
                }
            }
            
            // AI 초기 히든돌이 따내진 경우 확인
            if (game.isSinglePlayer && (game as any).aiInitialHiddenStone) {
                const aiHidden = (game as any).aiInitialHiddenStone;
                const isCaptured = result.capturedStones.some(s => s.x === aiHidden.x && s.y === aiHidden.y);
                if (isCaptured) {
                    const isPermanentlyRevealed = game.permanentlyRevealedStones?.some(p => p.x === aiHidden.x && p.y === aiHidden.y);
                    if (!isPermanentlyRevealed) {
                        // AI 초기 히든돌을 moveHistory에 추가
                        if (!game.hiddenMoves) game.hiddenMoves = {};
                        const hiddenMoveIndex = game.moveHistory.length;
                        game.moveHistory.push({
                            player: opponentPlayerEnum,
                            x: aiHidden.x,
                            y: aiHidden.y
                        });
                        game.hiddenMoves[hiddenMoveIndex] = true;
                        capturedHiddenStones.push({ point: { x: aiHidden.x, y: aiHidden.y }, player: opponentPlayerEnum });
                    }
                }
            }
            
            const allStonesToReveal = [...contributingHiddenStones, ...capturedHiddenStones];
            const uniqueStonesToReveal = Array.from(new Map(allStonesToReveal.map(item => [JSON.stringify(item.point), item])).values());
            
            if (uniqueStonesToReveal.length > 0) {
                game.gameStatus = 'hidden_reveal_animating';
                game.animation = {
                    type: 'hidden_reveal',
                    stones: uniqueStonesToReveal,
                    startTime: now,
                    duration: 2000
                };
                game.revealAnimationEndTime = now + 2000;
                game.pendingCapture = { stones: result.capturedStones, move, hiddenContributors: contributingHiddenStones.map(c => c.point) };
            
                game.lastMove = { x, y };
                game.lastTurnStones = null;
                game.moveHistory.push(move);
                if (isHidden) {
                    if (!game.hiddenMoves) game.hiddenMoves = {};
                    game.hiddenMoves[game.moveHistory.length - 1] = true;
                }
            
                game.boardState = result.newBoardState;
                for (const stone of result.capturedStones) {
                    game.boardState[stone.y][stone.x] = opponentPlayerEnum;
                }
            
                if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                uniqueStonesToReveal.forEach(s => {
                    if (!game.permanentlyRevealedStones!.some(p => p.x === s.point.x && p.y === s.point.y)) {
                        game.permanentlyRevealedStones!.push(s.point);
                    }
                });
            
                if (game.turnDeadline) {
                    game.pausedTurnTimeLeft = (game.turnDeadline - now) / 1000;
                    game.turnDeadline = undefined;
                    game.turnStartTime = undefined;
                }
                game.itemUseDeadline = undefined;
                return {};
            }


            game.boardState = result.newBoardState;
            // 히든 착수 시 lastMove를 갱신하지 않음 (새로고침 후 마지막 수 표시가 히든 돌 위치로 겹치는 버그 방지)
            if (!isHidden) {
                game.lastMove = { x, y };
            }
            game.lastTurnStones = null;
            game.moveHistory.push(move);
            game.koInfo = result.newKoInfo;
            game.passCount = 0;

            if (isHidden) {
                if (!game.hiddenMoves) game.hiddenMoves = {};
                game.hiddenMoves[game.moveHistory.length - 1] = true;
            }

            if (result.capturedStones.length > 0) {
                // 길드전 별 판정(한 번에 따낸 최대 개수) 정확도를 위해 실시간 최대값 저장
                const captureCountThisMove = result.capturedStones.length;
                const maxSingleCaptureByPlayer = ((game as any).maxSingleCaptureByPlayer ??= {});
                const prevMaxForPlayer = Number(maxSingleCaptureByPlayer[myPlayerEnum] ?? 0) || 0;
                if (captureCountThisMove > prevMaxForPlayer) {
                    maxSingleCaptureByPlayer[myPlayerEnum] = captureCountThisMove;
                }
                if (!game.justCaptured) game.justCaptured = [];
                for (const stone of result.capturedStones) {
                    const capturedPlayerEnum = opponentPlayerEnum;
                    
                    let points = 1;
                    let wasHiddenForJustCaptured = false; // default for justCaptured

                    if (game.isSinglePlayer || (game as any).gameCategory === 'guildwar') {
                        if (consumeOpponentPatternStoneIfAny(game, stone, capturedPlayerEnum)) {
                            points = 2;
                        }
                    } else { // PvP logic
                        const isBaseStone = game.baseStones?.some(bs => bs.x === stone.x && bs.y === stone.y);
                        const moveIndex = game.moveHistory.findIndex(m => m.x === stone.x && m.y === stone.y);
                        const wasHidden = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
                        wasHiddenForJustCaptured = wasHidden; // pass to justCaptured
                        
                        if (isBaseStone) {
                            game.baseStoneCaptures[myPlayerEnum]++;
                            points = 5;
                        } else if (wasHidden) {
                             game.hiddenStoneCaptures[myPlayerEnum]++;
                             points = 5;
                             if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                             game.permanentlyRevealedStones.push(stone);
                        }
                    }

                    game.captures[myPlayerEnum] += points;
                    game.justCaptured.push({ point: stone, player: capturedPlayerEnum, wasHidden: wasHiddenForJustCaptured, capturePoints: points });
                }
                stripPatternStonesAtConsumedIntersections(game);
            }

            const playerWhoMoved = myPlayerEnum;
            // 수를 둔 플레이어가 초읽기 모드에서 수를 두었는지 기록 (다음 턴에서 30초로 리셋하기 위해)
            let movedPlayerWasInByoyomi = false;
            
            if (hasTimeControl(game.settings) && shouldEnforceTimeControl(game)) {
                const timeKey = playerWhoMoved === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                const byoyomiKey = playerWhoMoved === types.Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';
                const fischerIncrement = getFischerIncrementSeconds(game as any);
                const isFischer = isFischerStyleTimeControl(game as any);
                
                // 초읽기 모드인지 확인 (메인 시간이 0이고 초읽기 횟수가 남아있는 경우)
                const isInByoyomi = game[timeKey] <= 0 && game.settings.byoyomiCount > 0 && game[byoyomiKey] > 0 && !isFischer;
                movedPlayerWasInByoyomi = isInByoyomi;
                
                if (isInByoyomi) {
                    // 초읽기 모드에서 수를 두면 다음 턴에서 30초로 리셋됨
                    // 현재는 시간을 0으로 유지 (다음 턴에서 30초로 설정됨)
                    game[timeKey] = 0; // 초읽기 모드이므로 메인 시간은 0으로 유지
                } else {
                    // 일반 모드: 남은 시간 저장
                    if (game.turnDeadline) {
                        const timeRemaining = Math.max(0, (game.turnDeadline - now) / 1000);
                        game[timeKey] = timeRemaining + fischerIncrement;
                    } else if(game.pausedTurnTimeLeft) {
                        game[timeKey] = game.pausedTurnTimeLeft + fischerIncrement;
                    } else {
                        game[timeKey] += fischerIncrement;
                    }
                }
            }

            game.currentPlayer = opponentPlayerEnum;
            game.missileUsedThisTurn = false;
            
            game.gameStatus = 'playing';
            game.itemUseDeadline = undefined;
            game.pausedTurnTimeLeft = undefined;


            if (hasTimeControl(game.settings) && shouldEnforceTimeControl(game)) {
                const nextPlayer = game.currentPlayer;
                const nextTimeKey = nextPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                const nextByoyomiKey = nextPlayer === types.Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';
                const isFischer = isFischerStyleTimeControl(game as any);
                const isNextInByoyomi = game[nextTimeKey] <= 0 && game.settings.byoyomiCount > 0 && game[nextByoyomiKey] > 0 && !isFischer;

                if (isNextInByoyomi) {
                    // 다음 플레이어가 초읽기 모드인 경우 초읽기 시간 설정
                    game.turnDeadline = now + game.settings.byoyomiTime * 1000;
                } else {
                    game.turnDeadline = now + game[nextTimeKey] * 1000;
                }
                game.turnStartTime = now;
            } else {
                 game.turnDeadline = undefined;
                 game.turnStartTime = undefined;
            }

            // 싱글플레이/도전의 탑/길드전(히든·미사일) 자동 계가: 사용자가 돌을 놓은 후 totalTurns 업데이트 및 계가 트리거
            const guildWarAutoScoring =
                (game as any).gameCategory === 'guildwar' &&
                (game.settings as any)?.autoScoringTurns != null &&
                (game.settings as any)?.autoScoringTurns > 0;
            const isAutoScoringMode =
                ((game.isSinglePlayer || game.gameCategory === 'tower') && game.stageId) || guildWarAutoScoring;
            if (isAutoScoringMode) {
                let autoScoringTurns: number | undefined;
                if (guildWarAutoScoring) {
                    autoScoringTurns = (game.settings as any)?.autoScoringTurns;
                } else if (game.gameCategory === 'tower') {
                    autoScoringTurns = (game.settings as any)?.autoScoringTurns;
                } else {
                    const { SINGLE_PLAYER_STAGES } = await import('../../constants/singlePlayerConstants.js');
                    const stage = SINGLE_PLAYER_STAGES.find(s => s.id === game.stageId);
                    autoScoringTurns = stage?.autoScoringTurns;
                }
                
                if (autoScoringTurns !== undefined) {
                    // 유효한 수만 카운팅 (패스 제외)
                    const validMoves = game.moveHistory.filter(m => m.x !== -1 && m.y !== -1);
                    const newTotalTurns = validMoves.length;
                    game.totalTurns = newTotalTurns;
                    
                    // totalTurns가 autoScoringTurns 이상이면 계가 트리거 (사용자가 마지막 수를 둔 경우)
                    if (newTotalTurns >= autoScoringTurns) {
                        const gameType = game.gameCategory === 'tower'
                            ? 'Tower'
                            : guildWarAutoScoring
                              ? 'GuildWar'
                              : 'SinglePlayer';
                        console.log(`[handleStandardAction] Auto-scoring triggered (user placed last stone): totalTurns=${newTotalTurns}, autoScoringTurns=${autoScoringTurns}, ${gameType}`);
                        game.gameStatus = 'scoring';
                        await db.saveGame(game);
                        const { broadcastToGameParticipants } = await import('../socket.js');
                        const gameToBroadcast = { ...game };
                        delete (gameToBroadcast as any).boardState;
                        broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);
                        try {
                            await getGameResult(game);
                        } catch (scoringError: any) {
                            console.error(`[handleStandardAction] Error during auto-scoring for game ${game.id}:`, scoringError?.message);
                        }
                        return {};
                    }
                    
                    // totalTurns가 autoScoringTurns-1이면 다음 AI 턴이 마지막 턴
                    if (newTotalTurns === autoScoringTurns - 1) {
                        console.log(`[handleStandardAction] Last turn reached: totalTurns=${newTotalTurns}, autoScoringTurns=${autoScoringTurns}, next turn will trigger auto-scoring after AI move`);
                    }
                }
            }
            
            // After move logic
            if (game.mode === types.GameMode.Capture || game.isSinglePlayer) {
                const target = game.effectiveCaptureTargets?.[myPlayerEnum];
                if (target !== undefined && target !== 999 && game.captures[myPlayerEnum] >= target) {
                    // 따낸 돌 미션을 먼저 적용하여 성공/실패를 확정하고,
                    // 이후 턴 제한(blackTurnLimit 등)은 더 이상 적용하지 않는다.
                    await summaryService.endGame(game, myPlayerEnum, 'capture_limit');
                    return {};
                }
            }
            
            // 싱글플레이 따내기 바둑: 흑(유저) 턴 수 제한(blackTurnLimit) 도달 시,
            // "아직 따낸 돌 미션을 완수하지 못했을 때만" 미션 실패 처리
            const blackTurnLimit = (game.settings as any)?.blackTurnLimit;
            if (game.isSinglePlayer && game.stageId && blackTurnLimit !== undefined && myPlayerEnum === types.Player.Black && game.gameStatus !== 'ended') {
                const blackMoves = game.moveHistory.filter(m => m.player === types.Player.Black && m.x !== -1 && m.y !== -1).length;
                if (blackMoves >= blackTurnLimit) {
                    const blackTarget = game.effectiveCaptureTargets?.[types.Player.Black];
                    const hasBlackTarget = blackTarget !== undefined && blackTarget !== 999;
                    const blackCaptures = game.captures[types.Player.Black] ?? 0;

                    // 흑이 목표 따낸 돌을 이미 달성했다면 턴 제한 패배를 적용하지 않는다.
                    if (!(hasBlackTarget && blackCaptures >= blackTarget)) {
                        console.log(`[handleStandardAction] SinglePlayer blackTurnLimit reached: blackMoves=${blackMoves}, limit=${blackTurnLimit}, mission fail (no scoring)`);
                        await summaryService.endGame(game, types.Player.White, 'timeout');
                        return {};
                    }
                }
            }
            
            // AI 턴인 경우 즉시 처리할 수 있도록 aiTurnStartTime을 현재 시간으로 설정
            if (game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White)) {
                const { aiUserId } = await import('../aiPlayer.js');
                const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                if (currentPlayerId === aiUserId) {
                    game.aiTurnStartTime = now;
                    console.log(`[handleStandardAction] AI turn after PLACE_STONE, game ${game.id}, setting aiTurnStartTime to now: ${now}`);
                } else {
                    // 사용자 턴으로 넘어갔으므로 aiTurnStartTime을 undefined로 설정
                    game.aiTurnStartTime = undefined;
                    console.log(`[handleStandardAction] User turn after PLACE_STONE, game ${game.id}, clearing aiTurnStartTime`);
                }
            }
            
            return {};
        }
        case 'PASS_TURN': {
            if (!isMyTurn || game.gameStatus !== 'playing') return { error: 'Not your turn to pass.' };
            {
                const gc = (game as any).gameCategory;
                const isAiLobbyGame =
                    game.isAiGame &&
                    !game.isSinglePlayer &&
                    gc !== 'tower' &&
                    gc !== 'singleplayer' &&
                    gc !== 'guildwar';
                if (isAiLobbyGame) {
                    return { error: 'AI 대국에서는 통과할 수 없습니다. 정해진 수순이 끝나면 자동으로 계가됩니다.' };
                }
            }
            // 통과 시 단순 코(ko) 금지 해제 — 이전 턴 koInfo가 남아 상대 다점 따내기 직후 재따내기가 막히는 버그 방지
            game.koInfo = null;
            game.passCount++;
            game.lastMove = { x: -1, y: -1 };
            game.lastTurnStones = null;
            game.moveHistory.push({ player: myPlayerEnum, x: -1, y: -1 });

            if (game.passCount >= 2) {
                const isHiddenMode = game.mode === types.GameMode.Hidden || (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Hidden));

                if (isHiddenMode) {
                    const unrevealedStones: { point: types.Point, player: types.Player }[] = [];
                    if (game.hiddenMoves && game.moveHistory) {
                        for (const moveIndexStr in game.hiddenMoves) {
                            const moveIndex = parseInt(moveIndexStr, 10);
                            if (game.hiddenMoves[moveIndex]) {
                                const move = game.moveHistory[moveIndex];
                                if (move && move.x !== -1 && game.boardState[move.y]?.[move.x] === move.player) {
                                    const isPermanentlyRevealed = game.permanentlyRevealedStones?.some(p => p.x === move.x && p.y === move.y);
                                    if (!isPermanentlyRevealed) {
                                        unrevealedStones.push({ point: { x: move.x, y: move.y }, player: move.player });
                                    }
                                }
                            }
                        }
                    }

                    if (unrevealedStones.length > 0) {
                        game.gameStatus = 'hidden_final_reveal';
                        game.animation = {
                            type: 'hidden_reveal',
                            stones: unrevealedStones,
                            startTime: now,
                            duration: 3000
                        };
                        game.revealAnimationEndTime = now + 3000;
                        if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                        game.permanentlyRevealedStones.push(...unrevealedStones.map(s => s.point));
                    } else {
                        getGameResult(game);
                    }
                } else {
                    getGameResult(game);
                }
            } else {
                const playerWhoMoved = myPlayerEnum;
                if (hasTimeControl(game.settings) && shouldEnforceTimeControl(game)) {
                    const timeKey = playerWhoMoved === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                    
                    if (game.turnDeadline) {
                        const timeRemaining = Math.max(0, (game.turnDeadline - now) / 1000);
                        game[timeKey] = timeRemaining;
                    }
                }
                game.currentPlayer = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
                if (hasTimeControl(game.settings) && shouldEnforceTimeControl(game)) {
                    const nextPlayer = game.currentPlayer;
                    const nextTimeKey = nextPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                    const nextByoyomiKey = nextPlayer === types.Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';
                     const isFischer = isFischerStyleTimeControl(game as any);
                    const isNextInByoyomi = game[nextTimeKey] <= 0 && game.settings.byoyomiCount > 0 && game[nextByoyomiKey] > 0 && !isFischer;
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
                // AI 턴인 경우 즉시 처리할 수 있도록 aiTurnStartTime을 현재 시간으로 설정
                if (game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White)) {
                    const { aiUserId } = await import('../aiPlayer.js');
                    const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                    if (currentPlayerId === aiUserId) {
                        game.aiTurnStartTime = now;
                        console.log(`[handleStandardAction] AI turn after PLACE_STONE, game ${game.id}, setting aiTurnStartTime to now: ${now}`);
                    } else {
                        // 사용자 턴으로 넘어갔으므로 aiTurnStartTime을 undefined로 설정
                        game.aiTurnStartTime = undefined;
                        console.log(`[handleStandardAction] User turn after PLACE_STONE, game ${game.id}, clearing aiTurnStartTime`);
                    }
                }
            }
            return {};
        }
        case 'REQUEST_NO_CONTEST_LEAVE': {
            if (!game.canRequestNoContest?.[user.id]) {
                return { error: "무효 처리 요청을 할 수 없습니다." };
            }

            game.gameStatus = 'no_contest';
            game.winReason = 'disconnect';
            if(!game.noContestInitiatorIds) game.noContestInitiatorIds = [];
            game.noContestInitiatorIds.push(user.id);
            
            await summaryService.processGameSummary(game);

            if (volatileState.userStatuses[user.id]) {
                volatileState.userStatuses[user.id] = { status: types.UserStatus.Waiting, mode: game.mode };
            }

            return {};
        }
    }

    return null;
};
