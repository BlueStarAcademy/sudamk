// FIX: Correctly import summaryService to resolve module not found error.
import * as summaryService from '../summaryService.js';
import * as types from '../../types/index.js';
import { UserStatus } from '../../types/enums.js';
import * as db from '../db.js';
import { getGoLogic, processMove } from '../goLogic.js';
import { getGameResult } from '../gameModes.js';
import { initializeNigiri, updateNigiriState, handleNigiriAction } from './nigiri.js';
import { initializeBase, updateBaseState, handleBaseAction } from './base.js';
import { initializeCapture, updateCaptureState, handleCaptureAction } from './capture.js';
import { initializeHidden, updateHiddenState, handleHiddenAction } from './hidden.js';
import { initializeMissile, updateMissileState, handleMissileAction } from './missile.js';
import { handleSharedAction, transitionToPlaying, hasTimeControl, shouldEnforceTimeControl } from './shared.js';
import { adventureEncounterCountdownUiActive } from '../../shared/utils/adventureEncounterUi.js';
import { isFischerStyleTimeControl, getFischerIncrementSeconds } from '../../shared/utils/gameTimeControl.js';
import {
    consumeOpponentPatternStoneIfAny,
    stripPatternStonesAtConsumedIntersections,
} from '../../shared/utils/patternStoneConsume.js';
import {
    isIntersectionRecordedAsBaseStone,
    removeCapturedBaseStoneMarkersFromSession,
} from '../../shared/utils/removeCapturedBaseStoneMarkers.js';
import { bumpGuildWarMaxSingleCapturePointsForPlayer } from '../../shared/utils/guildWarMaxSingleCapturePoints.js';
import { broadcastPlayingSnapshotBeforeScoring } from '../utils/broadcastPlayingBeforeScoring.js';
import { aiUserId } from '../aiPlayer.js';
import {
    skipPendingCaptureForAdventureHiddenReveal,
    shouldPreserveDiscovererTurnAfterOpponentHiddenReveal,
    treatAsPveLikeForHiddenOpponentReveal,
    useAiInitialHiddenCellTracking,
} from './hiddenRevealPolicy.js';
import { isHiddenMoveIndexSoftRevealedByAnyPlayer } from './hiddenScanShared.js';
import { PVE_STRATEGIC_SERVER_AI_POST_HUMAN_DELAY_MS } from '../constants/pveStrategicAiSchedule.js';
import { getEffectiveSinglePlayerStages } from '../singlePlayerStageConfigService.js';
import { tryEndGameWhenCaptureTargetReached } from '../utils/captureTargets.js';

const ADVENTURE_ENCOUNTER_FROZEN_MS_KEY = 'adventureEncounterFrozenHumanMsRemaining';

const STRATEGIC_GO_SERVER_AI_MODES: types.GameMode[] = [
    types.GameMode.Standard,
    types.GameMode.Capture,
    types.GameMode.Speed,
    types.GameMode.Base,
    types.GameMode.Hidden,
    types.GameMode.Missile,
    types.GameMode.Mix,
];

/**
 * 모험/길드전 서버 Kata AI: 유저 착수 직후 메인 루프가 같은 틱에 makeAiMove를 잡아
 * startAiProcessing과 경쟁하는 것을 줄이기 위해 aiTurnStartTime을 약간 미룬다.
 * (`PVE_STRATEGIC_SERVER_AI_POST_HUMAN_DELAY_MS`와 동일 — standard.ts·gameActions 인라인과 공유)
 */
function nextAiTurnStartTimeAfterHumanStrategicMove(game: types.LiveGameSession, now: number): number {
    const isGo = STRATEGIC_GO_SERVER_AI_MODES.includes(game.mode);
    if (
        game.isAiGame &&
        !game.isSinglePlayer &&
        isGo &&
        (game.gameCategory === types.GameCategory.Adventure || game.gameCategory === types.GameCategory.GuildWar)
    ) {
        return now + PVE_STRATEGIC_SERVER_AI_POST_HUMAN_DELAY_MS;
    }
    return now;
}

const syncAdventureEncounterDeadlineDuringMonsterTurn = (game: types.LiveGameSession, now: number) => {
    if (game.gameCategory !== types.GameCategory.Adventure) return;
    const deadline = (game as any).adventureEncounterDeadlineMs;
    if (typeof deadline !== 'number') return;
    if (!adventureEncounterCountdownUiActive(game.gameCategory, game.gameStatus)) return;

    let monsterEnum: types.Player | null = null;
    if (game.blackPlayerId === aiUserId) monsterEnum = types.Player.Black;
    else if (game.whitePlayerId === aiUserId) monsterEnum = types.Player.White;
    if (monsterEnum == null || game.currentPlayer === types.Player.None) return;

    const isMonsterTurn = game.currentPlayer === monsterEnum;

    if (isMonsterTurn) {
        let frozen = (game as any)[ADVENTURE_ENCOUNTER_FROZEN_MS_KEY];
        if (typeof frozen !== 'number' || !Number.isFinite(frozen) || frozen <= 0) {
            const inferred = deadline - now;
            // inferred<=0 이후에도 매 틱 now+frozen 이므로 너무 작으면 UI가 1초에 고정됨 → 복구 시에는 충분한 최소치
            frozen = inferred > 0 ? Math.max(1000, inferred) : 120_000;
            (game as any)[ADVENTURE_ENCOUNTER_FROZEN_MS_KEY] = frozen;
        }
        (game as any).adventureEncounterDeadlineMs = now + frozen;
    } else {
        (game as any)[ADVENTURE_ENCOUNTER_FROZEN_MS_KEY] = undefined;
    }
};

/** 로비 AI 대국(모험·봇 대전): 계가 직전에 마지막 판면이 한 번 보이도록 */
const isLobbyAiStrategicGame = (game: types.LiveGameSession) =>
    !!game.isAiGame &&
    !game.isSinglePlayer &&
    game.gameCategory !== 'tower' &&
    game.gameCategory !== 'singleplayer' &&
    game.gameCategory !== 'guildwar';

export const initializeStrategicGame = (game: types.LiveGameSession, neg: types.Negotiation, now: number) => {
    const p1 = game.player1;
    const p2 = game.player2;

    switch (game.mode) {
        case types.GameMode.Standard:
        case types.GameMode.Speed:
        case types.GameMode.Mix:
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
                const baseTarget = game.settings.captureTarget || 20;
                game.effectiveCaptureTargets = {
                    [types.Player.None]: 0,
                    [types.Player.Black]: baseTarget,
                    [types.Player.White]: baseTarget,
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
            initializeNigiri(game, now); // Also uses nigiri
            break;
        case types.GameMode.Missile:
            initializeMissile(game);
            initializeNigiri(game, now); // Also uses nigiri
            break;
    }
};

export const updateStrategicGameState = async (game: types.LiveGameSession, now: number) => {
    syncAdventureEncounterDeadlineDuringMonsterTurn(game, now);

    const advDeadline = (game as any).adventureEncounterDeadlineMs as number | undefined;
    const adventureEncounterBlocked =
        game.gameStatus === 'hidden_reveal_animating' ||
        game.gameStatus === 'scanning_animating' ||
        game.gameStatus === 'missile_animating' ||
        (typeof (game as any).aiHiddenItemAnimationEndTime === 'number' && now < (game as any).aiHiddenItemAnimationEndTime);

    let adventureEncounterTimeUp = false;
    if (game.gameCategory === types.GameCategory.Adventure && typeof advDeadline === 'number') {
        let monsterEnum: types.Player | null = null;
        if (game.blackPlayerId === aiUserId) monsterEnum = types.Player.Black;
        else if (game.whitePlayerId === aiUserId) monsterEnum = types.Player.White;
        const isMonsterTurn =
            monsterEnum != null &&
            game.currentPlayer !== types.Player.None &&
            game.currentPlayer === monsterEnum;
        const frozenRem = (game as any)[ADVENTURE_ENCOUNTER_FROZEN_MS_KEY];
        adventureEncounterTimeUp = !isMonsterTurn
            ? now >= advDeadline
            : typeof frozenRem === 'number' && frozenRem <= 0;
    }

    if (
        game.gameCategory === types.GameCategory.Adventure &&
        game.gameStatus !== 'ended' &&
        game.gameStatus !== 'no_contest' &&
        game.winner == null &&
        typeof advDeadline === 'number' &&
        adventureEncounterTimeUp &&
        adventureEncounterCountdownUiActive(game.gameCategory, game.gameStatus) &&
        !adventureEncounterBlocked
    ) {
        const aiWinner =
            game.blackPlayerId === aiUserId
                ? types.Player.Black
                : game.whitePlayerId === aiUserId
                  ? types.Player.White
                  : types.Player.White;
        await summaryService.endGame(game, aiWinner, 'adventure_monster_fled');
        return;
    }

    // This is the core update logic for all Go-based games.
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
                // 초읽기 모드로 진입하되 횟수를 차감하지 않음 (그래프가 다시 회복되면서 초읽기 모드 시작)
                game.turnDeadline = now + game.settings.byoyomiTime * 1000;
                game.turnStartTime = now;
                return;
            }
        } else { // Byoyomi expired
            if (game[byoyomiKey] > 1) {
                // 2회 이상 남았을 때만 차감 후 추가 시간 부여; 1회 남은 상태에서 만료되면 즉시 패배
                game[byoyomiKey]--;
                game.turnDeadline = now + game.settings.byoyomiTime * 1000;
                game.turnStartTime = now;
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

    // Delegate to mode-specific update logic
    updateNigiriState(game, now);
    updateCaptureState(game, now);
    updateBaseState(game, now);
    await updateHiddenState(game, now);
    updateMissileState(game, now);
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
                console.log(`[handleStrategicGameAction] triggerAutoScoring received for game ${game.id}, updating game state...`);
                
                const boardSize = game.settings?.boardSize ?? 19;
                const isValidBoardState = (board: any) =>
                    Array.isArray(board) && board.length === boardSize &&
                    board.every((row: any) => Array.isArray(row) && row.length === boardSize);
                const hasValidBoard = payload.boardState && isValidBoardState(payload.boardState);
                const hasValidMoves = payload.moveHistory && Array.isArray(payload.moveHistory) && payload.moveHistory.length > 0;

                // 싱글플레이/탑: 보드·수순이 없거나 잘못되면 캐시에서 복원 (미사일 모드 등에서 클라이언트 전달 누락 시 사석 오계가 방지)
                if ((game.isSinglePlayer || game.gameCategory === 'tower') && (!hasValidBoard || !hasValidMoves)) {
                    const { getCachedGame } = await import('../gameCache.js');
                    const cached = game.id.startsWith('sp-game-') || game.id.startsWith('tower-game-') ? await getCachedGame(game.id) : null;
                    if (cached) {
                        if (!hasValidBoard && cached.boardState && isValidBoardState(cached.boardState)) {
                            game.boardState = cached.boardState;
                            console.log(`[handleStrategicGameAction] Restored boardState from cache for game ${game.id} (boardSize=${boardSize})`);
                        }
                        if (!hasValidMoves && cached.moveHistory?.length) {
                            game.moveHistory = cached.moveHistory;
                            console.log(`[handleStrategicGameAction] Restored moveHistory from cache for game ${game.id} (length=${cached.moveHistory.length})`);
                        }
                        if (cached.totalTurns != null) game.totalTurns = cached.totalTurns;
                        if (cached.captures) game.captures = { ...(game.captures || {}), ...cached.captures };
                    } else if (!hasValidBoard || !hasValidMoves) {
                        console.warn(`[handleStrategicGameAction] triggerAutoScoring: missing or invalid boardState/moveHistory for game ${game.id}, hasValidBoard=${!!hasValidBoard}, hasValidMoves=${!!hasValidMoves}`);
                    }
                }

                // 클라이언트에서 전송한 게임 상태를 반영 (유효할 때만 덮어씀)
                if (payload.totalTurns !== undefined) {
                    game.totalTurns = payload.totalTurns;
                }
                if (hasValidMoves) {
                    game.moveHistory = payload.moveHistory;
                }
                if (hasValidBoard) {
                    game.boardState = payload.boardState;
                }
                if (payload.captures && typeof payload.captures === 'object') {
                    game.captures = { ...(game.captures || {}), ...payload.captures };
                }
                if (payload.blackTimeLeft !== undefined) {
                    game.blackTimeLeft = payload.blackTimeLeft;
                }
                if (payload.whiteTimeLeft !== undefined) {
                    game.whiteTimeLeft = payload.whiteTimeLeft;
                }
                if (payload.hiddenMoves != null && typeof payload.hiddenMoves === 'object') {
                    game.hiddenMoves = { ...payload.hiddenMoves };
                }
                if (payload.permanentlyRevealedStones != null && Array.isArray(payload.permanentlyRevealedStones)) {
                    game.permanentlyRevealedStones = payload.permanentlyRevealedStones.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
                }
                
                // 0/N 도달 검증: 싱글/탑은 유효 착수 수, 온라인(PVP 등)은 moveHistory 길이(PASS 포함) — PLACE_STONE 직후 scoringTurnLimit 처리와 동일해야 함
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
                    autoScoringTurns = (await getEffectiveSinglePlayerStages()).find(s => s.id === game.stageId)?.autoScoringTurns;
                } else {
                    autoScoringTurns =
                        game.mode === types.GameMode.Capture
                            ? undefined
                            : (game.settings as any)?.autoScoringTurns ?? (game.settings as any)?.scoringTurnLimit;
                }
                const remainingTurns = autoScoringTurns != null ? Math.max(0, autoScoringTurns - totalTurns) : 0;
                
                console.log(`[handleStrategicGameAction] Game state updated: totalTurns=${totalTurns}, autoScoringTurns=${autoScoringTurns}, remainingTurns=${remainingTurns}, moveHistoryLength=${game.moveHistory?.length || 0}`);
                
                if (autoScoringTurns != null && remainingTurns <= 0) {
                    if (game.endTime == null) game.endTime = Date.now();
                    game.gameStatus = 'scoring';
                    await db.saveGame(game);
                    // 싱글플레이/탑: 계가 직전 캐시 갱신하여 getGameResult/재시도 시 최신 보드·수순 사용
                    if ((game.isSinglePlayer || game.gameCategory === 'tower') && (game.id.startsWith('sp-game-') || game.id.startsWith('tower-game-'))) {
                        const { updateGameCache } = await import('../gameCache.js');
                        updateGameCache(game);
                    }
                    console.log(`[handleStrategicGameAction] Game ${game.id} set to scoring state (0/N reached), calling getGameResult...`);
                    try {
                        await getGameResult(game);
                        console.log(`[handleStrategicGameAction] getGameResult completed for game ${game.id}`);
                    } catch (error) {
                        console.error(`[handleStrategicGameAction] Error in getGameResult for game ${game.id}:`, error);
                        throw error;
                    }
                } else if (autoScoringTurns != null) {
                    console.warn(`[handleStrategicGameAction] triggerAutoScoring ignored: remainingTurns=${remainingTurns} > 0 (totalTurns=${totalTurns}, autoScoringTurns=${autoScoringTurns})`);
                }
                return {};
            }

            // 다음 턴이 AI인 경우: 클라이언트가 계가 직전 유저 소요시간만 동기화 → 동기화 후 남은 턴 0이면 즉시 계가
            if (payload.syncTimeAndStateForScoring && (game.isSinglePlayer || game.gameCategory === 'tower')) {
                if (payload.moveHistory && Array.isArray(payload.moveHistory)) game.moveHistory = payload.moveHistory;
                // 히든 모드: 클라이언트 보드는 AI의 미공개 히든 돌이 없으므로 서버 boardState 유지 (계가 시 백 돌 포함)
                const isHiddenModeSync = game.mode === types.GameMode.Hidden || (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Hidden));
                if (!isHiddenModeSync && payload.boardState && Array.isArray(payload.boardState)) game.boardState = payload.boardState;
                // 히든 모드: 이미 공개된 돌은 클라이언트 기준으로 서버에 반영 → getGameResult에서 미공개만 애니메이션
                if (isHiddenModeSync && payload.permanentlyRevealedStones != null && Array.isArray(payload.permanentlyRevealedStones)) {
                    if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                    for (const p of payload.permanentlyRevealedStones) {
                        if (typeof p.x === 'number' && typeof p.y === 'number' && !game.permanentlyRevealedStones.some((q: { x: number; y: number }) => q.x === p.x && q.y === p.y)) {
                            game.permanentlyRevealedStones.push({ x: p.x, y: p.y });
                        }
                    }
                }
                if (payload.totalTurns !== undefined) game.totalTurns = payload.totalTurns;
                if (payload.blackTimeLeft !== undefined) game.blackTimeLeft = payload.blackTimeLeft;
                if (payload.whiteTimeLeft !== undefined) game.whiteTimeLeft = payload.whiteTimeLeft;
                if (payload.captures && typeof payload.captures === 'object') game.captures = { ...(game.captures || {}), ...payload.captures };
                if (payload.hiddenMoves != null && typeof payload.hiddenMoves === 'object') game.hiddenMoves = { ...payload.hiddenMoves };
                const validMoves = (game.moveHistory || []).filter((m: { x: number; y: number }) => m && m.x !== -1 && m.y !== -1);
                const useMoveHistoryCountForLimitSync =
                    !game.isSinglePlayer && game.gameCategory !== 'tower';
                const totalTurns = useMoveHistoryCountForLimitSync
                    ? (game.moveHistory || []).length
                    : validMoves.length;
                game.totalTurns = totalTurns;
                let autoScoringTurnsSync: number | undefined;
                if (game.gameCategory === 'tower') {
                    autoScoringTurnsSync = (game.settings as any)?.autoScoringTurns;
                } else if (game.isSinglePlayer && game.stageId) {
                    autoScoringTurnsSync = (await getEffectiveSinglePlayerStages()).find(s => s.id === game.stageId)?.autoScoringTurns;
                } else {
                    autoScoringTurnsSync =
                        game.mode === types.GameMode.Capture
                            ? undefined
                            : (game.settings as any)?.autoScoringTurns ?? (game.settings as any)?.scoringTurnLimit;
                }
                const remainingTurnsSync = autoScoringTurnsSync != null ? Math.max(0, autoScoringTurnsSync - totalTurns) : 0;
                if (autoScoringTurnsSync != null && remainingTurnsSync <= 0) {
                    if (game.endTime == null) game.endTime = Date.now();
                    // getGameResult가 히든 미공개 돌이 있으면 hidden_final_reveal로 보내고, 없으면 scoring 진행. 먼저 scoring으로 덮어쓰지 않음.
                    try {
                        await getGameResult(game);
                    } catch (error) {
                        console.error(`[handleStrategicGameAction] getGameResult after syncTimeAndStateForScoring failed for game ${game.id}:`, error);
                        throw error;
                    }
                    return {};
                }
                await db.saveGame(game);
                return {};
            }

            if (payload.clientSideAiMove) {
                return { error: '클라이언트 측 AI 수는 지원되지 않습니다. 서버 AI(Kata)만 사용됩니다.' };
            }

            if (!isMyTurn || (game.gameStatus !== 'playing' && game.gameStatus !== 'hidden_placing')) {
                return { error: '내 차례가 아닙니다.' };
            }

            // 싱글플레이/도전의 탑 스피드: 서버는 시간을 강제하지 않으므로, 매 착수 시 클라이언트가 보낸 남은 시간으로 동기화 (시간 보너스 계산용)
            if ((game.isSinglePlayer || game.gameCategory === 'tower') && (payload as any).blackTimeLeft !== undefined) {
                game.blackTimeLeft = (payload as any).blackTimeLeft;
            }
            if ((game.isSinglePlayer || game.gameCategory === 'tower') && (payload as any).whiteTimeLeft !== undefined) {
                game.whiteTimeLeft = (payload as any).whiteTimeLeft;
            }

            // 전략바둑 로비 턴 제한: 이미 제한 수순에 도달했으면 착수 거부 후 계가 진행 (수순 초과 방지)
            const scoringTurnLimit = game.settings.scoringTurnLimit;
            if (
                scoringTurnLimit != null &&
                scoringTurnLimit > 0 &&
                game.mode !== types.GameMode.Capture &&
                !game.isSinglePlayer &&
                game.gameCategory !== 'tower'
            ) {
                // scoringTurnLimit 기준 "턴"은 PASS(-1,-1)도 포함해서 카운트한다.
                const totalTurnsSoFar = (game.moveHistory || []).length;
                if (totalTurnsSoFar >= scoringTurnLimit) {
                    console.log(`[handleStrategicAction] Game ${game.id} at/over scoringTurnLimit (${totalTurnsSoFar} >= ${scoringTurnLimit}), triggering getGameResult without applying move`);
                    if (isLobbyAiStrategicGame(game)) {
                        await broadcastPlayingSnapshotBeforeScoring(game);
                    }
                    game.gameStatus = 'scoring';
                    game.totalTurns = totalTurnsSoFar;
                    await db.saveGame(game);
                    const { broadcastToGameParticipants } = await import('../socket.js');
                    const gameToBroadcast = { ...game };
                    delete (gameToBroadcast as any).boardState;
                    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);
                    try {
                        await getGameResult(game);
                    } catch (e: any) {
                        console.error(`[handleStrategicAction] getGameResult failed for game ${game.id}:`, e?.message);
                    }
                    return { error: '정해진 수순에 도달했습니다. 계가를 진행합니다.' };
                }
            }

            const { x, y, isHidden: isHiddenRequested } = payload;
            
            // 치명적 버그 방지: 패 위치(-1, -1)에 돌을 놓으려는 시도 차단
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
            
            const isTargetPermanentlyRevealed = !!game.permanentlyRevealedStones?.some(p => p.x === x && p.y === y);
            // 히든 아이템을 눌렀더라도, 이미 영구 공개된 자리는 일반돌로 취급(히든 재생성 방지)
            const isHidden = !!isHiddenRequested && !isTargetPermanentlyRevealed;
            const opponentPlayerEnum = myPlayerEnum === types.Player.Black ? types.Player.White : (myPlayerEnum === types.Player.White ? types.Player.Black : types.Player.None);
            const isStrategicAiGame =
                !!game.isAiGame &&
                !game.isSinglePlayer &&
                game.gameCategory !== 'tower' &&
                game.gameCategory !== 'singleplayer' &&
                game.gameCategory !== 'guildwar';
            
            // 싱글플레이/도전의탑/AI 게임에서는 서버의 실제 boardState를 기준으로 체크 (돌 사라짐 버그 방지)
            let serverBoardState = game.boardState;
            let serverMoveHistory = game.moveHistory;
            
            // 도전의 탑 21층+ 히든 착수: 클라이언트가 보낸 boardState/moveHistory 사용 (일반 착수는 클라이언트만 반영하므로 서버와 동기화)
            const payloadBoardState = (payload as any).boardState;
            const payloadMoveHistory = (payload as any).moveHistory;
            if (game.gameCategory === 'tower' && Array.isArray(payloadBoardState) && payloadBoardState.length > 0 && Array.isArray(payloadMoveHistory)) {
                serverBoardState = payloadBoardState;
                serverMoveHistory = payloadMoveHistory;
            } else if (
                game.isSinglePlayer ||
                game.gameCategory === 'tower' ||
                game.isAiGame ||
                (game as any).gameCategory === 'guildwar'
            ) {
                // 싱글플레이, 도전의 탑, 길드전, 전략바둑 AI 대국에서는 서버의 실제 boardState를 사용
                const { getLiveGame } = await import('../db.js');
                const freshGame = await getLiveGame(game.id);
                if (freshGame) {
                    serverBoardState = freshGame.boardState;
                    serverMoveHistory = freshGame.moveHistory;
                }
            }
            
            // 범위 체크 후에만 boardState에 접근
            const stoneAtTarget = serverBoardState[y][x];

            // 싱글플레이/AI 게임에서 AI가 둔 자리 체크 (서버 boardState 기준만 사용)
            // boardState가 빈 칸이면 moveHistory와 불일치해도 착수 허용 (빈 공간에 돌이 안 놓이는 현상 방지)
            if (
                game.isSinglePlayer ||
                game.gameCategory === 'tower' ||
                game.isAiGame ||
                (game as any).gameCategory === 'guildwar'
            ) {
                if (stoneAtTarget === opponentPlayerEnum) {
                    console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: AI stone at (${x}, ${y}), gameId=${game.id}, stoneAtTarget=${stoneAtTarget}, opponentPlayerEnum=${opponentPlayerEnum}, isSinglePlayer=${game.isSinglePlayer}, gameCategory=${game.gameCategory}`);
                    return { error: 'AI가 둔 자리에는 돌을 놓을 수 없습니다.' };
                }
                
                // 서버 boardState를 게임 객체에 반영 (클라이언트 무시, 돌 사라짐 방지)
                game.boardState = serverBoardState;
                game.moveHistory = serverMoveHistory;
            }

            let moveIndexAtTarget = -1;
            const moveHistoryForIndex = game.moveHistory || [];
            for (let i = moveHistoryForIndex.length - 1; i >= 0; i--) {
                const m = moveHistoryForIndex[i];
                if (m.x === x && m.y === y) {
                    moveIndexAtTarget = i;
                    break;
                }
            }
            const aiInitialHiddenCellTracking = useAiInitialHiddenCellTracking(game);
            const isAiInitialHiddenStone =
                aiInitialHiddenCellTracking &&
                (game as any).aiInitialHiddenStone &&
                (game as any).aiInitialHiddenStone.x === x &&
                (game as any).aiInitialHiddenStone.y === y &&
                !game.permanentlyRevealedStones?.some(p => p.x === x && p.y === y);
            const isTargetHiddenOpponentStone =
                (stoneAtTarget === opponentPlayerEnum &&
                    moveIndexAtTarget !== -1 &&
                    game.hiddenMoves?.[moveIndexAtTarget] &&
                    !game.permanentlyRevealedStones?.some(p => p.x === x && p.y === y)) ||
                isAiInitialHiddenStone;

            // 치명적 버그 방지: 상대방 돌 위에 착점하는 것을 명시적으로 차단 (PVP 포함)
            if (stoneAtTarget !== types.Player.None && !isTargetHiddenOpponentStone) {
                // PVP에서도 상대방 돌 위에 착점 시도 시 명시적 에러 반환
                if (stoneAtTarget === opponentPlayerEnum) {
                    console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone on opponent stone in PVP at (${x}, ${y}), gameId=${game.id}, stoneAtTarget=${stoneAtTarget}, opponentPlayerEnum=${opponentPlayerEnum}, isSinglePlayer=${game.isSinglePlayer}, gameCategory=${game.gameCategory}`);
                    return { error: '상대방이 둔 자리에는 돌을 놓을 수 없습니다.' };
                }
                // 자신의 돌 위에 착점 시도 시에도 명시적 에러 반환
                if (stoneAtTarget === myPlayerEnum) {
                    console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone on own stone at (${x}, ${y}), gameId=${game.id}, stoneAtTarget=${stoneAtTarget}, myPlayerEnum=${myPlayerEnum}`);
                    return { error: '이미 돌이 놓인 자리입니다.' };
                }
                // 기타 경우 (예: 잘못된 상태)
                console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone on occupied position at (${x}, ${y}), gameId=${game.id}, stoneAtTarget=${stoneAtTarget}`);
                return { error: '이미 돌이 놓인 자리입니다.' };
            }

            if (isTargetHiddenOpponentStone) {
                if (isAiInitialHiddenStone) {
                    if (!game.hiddenMoves) game.hiddenMoves = {};
                    if (moveIndexAtTarget === -1) {
                        const hiddenMoveIndex = game.moveHistory.length;
                        game.moveHistory.push({
                            player: opponentPlayerEnum,
                            x: x,
                            y: y,
                        });
                        game.hiddenMoves[hiddenMoveIndex] = true;
                    } else if (!game.hiddenMoves[moveIndexAtTarget]) {
                        game.hiddenMoves[moveIndexAtTarget] = true;
                    }
                }

                if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                if (!game.permanentlyRevealedStones.some(p => p.x === x && p.y === y)) {
                    game.permanentlyRevealedStones.push({ x, y });
                }
                if (isAiInitialHiddenStone) {
                    (game as any).aiInitialHiddenStone = undefined;
                    (game as any).aiInitialHiddenStoneIsPrePlaced = false;
                }

                const tempBoardState = (game.boardState || []).map((row: types.Player[]) => [...row]);
                if (tempBoardState[y] && tempBoardState[y][x] !== undefined) {
                    tempBoardState[y][x] = types.Player.None;
                }

                const moveAttempt = { x, y, player: myPlayerEnum };
                const treatAsPveLike = treatAsPveLikeForHiddenOpponentReveal(game);
                const result = processMove(
                    tempBoardState,
                    moveAttempt,
                    game.koInfo,
                    game.moveHistory.length,
                    {
                        ignoreSuicide: false,
                        isSinglePlayer: treatAsPveLike,
                        opponentPlayer: treatAsPveLike ? opponentPlayerEnum : undefined,
                    }
                );

                game.animation = {
                    type: 'hidden_reveal',
                    stones: [{ point: { x, y }, player: opponentPlayerEnum }],
                    startTime: now,
                    duration: 2000,
                };
                game.revealAnimationEndTime = now + 2000;
                game.gameStatus = 'hidden_reveal_animating';
                game.itemUseDeadline = undefined;

                const adventureHiddenRevealOnly = skipPendingCaptureForAdventureHiddenReveal(game);

                if (result?.isValid && !adventureHiddenRevealOnly) {
                    const extraCaptures = result.capturedStones || [];
                    const preserveDiscovererTurnPve = shouldPreserveDiscovererTurnAfterOpponentHiddenReveal(game);
                    const boardStateBeforeReveal = preserveDiscovererTurnPve
                        ? (game.boardState || []).map((row: types.Player[]) => [...row])
                        : undefined;
                    const koInfoBeforeReveal = preserveDiscovererTurnPve
                        ? JSON.parse(JSON.stringify(game.koInfo ?? null))
                        : undefined;
                    const passCountBeforeReveal = preserveDiscovererTurnPve ? (game.passCount ?? 0) : undefined;

                    game.pendingCapture = {
                        stones: [{ x, y }, ...extraCaptures],
                        move: moveAttempt,
                        hiddenContributors: [{ x, y }],
                        ...(preserveDiscovererTurnPve
                            ? {
                                  preserveDiscovererTurn: true,
                                  boardStateBeforeReveal,
                                  koInfoBeforeReveal,
                                  passCountBeforeReveal,
                              }
                            : {}),
                    } as any;

                    game.boardState = result.newBoardState;
                    game.boardState[y][x] = opponentPlayerEnum;
                    for (const s of extraCaptures) {
                        game.boardState[s.y][s.x] = opponentPlayerEnum;
                    }

                    game.lastMove = { x, y };
                    game.lastTurnStones = null;
                    game.moveHistory.push(moveAttempt);

                    game.koInfo = result.newKoInfo;
                    game.passCount = 0;
                    game.justCaptured = [];
                } else {
                    game.pendingCapture = null;
                    game.justCaptured = [];
                }

                if (adventureHiddenRevealOnly && isAiInitialHiddenStone) {
                    (game as any).aiInitialHiddenStone = undefined;
                    (game as any).aiInitialHiddenStoneIsPrePlaced = false;
                }

                if (game.turnDeadline) {
                    game.pausedTurnTimeLeft = (game.turnDeadline - now) / 1000;
                    game.turnDeadline = undefined;
                    game.turnStartTime = undefined;
                }

                return {};
            }

            const move = { x, y, player: myPlayerEnum };
            
            // 치명적 버그 방지: 자신의 돌 위에 착점 시도 차단 (모든 게임 모드)
            const finalStoneCheck = game.boardState[y][x];
            if (finalStoneCheck === myPlayerEnum) {
                console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone on own stone at (${x}, ${y}), gameId=${game.id}, finalStoneCheck=${finalStoneCheck}, myPlayerEnum=${myPlayerEnum}`);
                return { error: '이미 자신의 돌이 놓인 자리입니다.' };
            }
            
            // 싱글플레이/도전의 탑/AI 대국에서 AI 돌 위에 착점 시도 차단
            if (game.isSinglePlayer || game.gameCategory === 'tower' || game.isAiGame) {
                if (finalStoneCheck === opponentPlayerEnum) {
                    console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: AI stone detected at (${x}, ${y}) before processMove, gameId=${game.id}, finalStoneCheck=${finalStoneCheck}, opponentPlayerEnum=${opponentPlayerEnum}`);
                    return { error: 'AI가 둔 자리에는 돌을 놓을 수 없습니다.' };
                }
            }
            
            if (isHiddenRequested) {
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
            
            // processMove 결과 검증 (싱글플레이/도전의 탑/AI 대국) - 치명적 버그 방지
            if ((game.isSinglePlayer || game.gameCategory === 'tower' || game.isAiGame) && result.isValid) {
                // processMove 후에도 해당 위치에 플레이어 돌이 있는지 확인
                const afterMoveCheck = result.newBoardState[y][x];
                if (afterMoveCheck !== myPlayerEnum) {
                    console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: After processMove, stone at (${x}, ${y}) is not player's stone (${afterMoveCheck}), expected=${myPlayerEnum}, gameId=${game.id}`);
                    return { error: 'AI가 둔 자리에는 돌을 놓을 수 없습니다.' };
                }
                
                // 추가 안전 체크: processMove 후에도 AI 돌이 있는지 확인
                if (afterMoveCheck === opponentPlayerEnum) {
                    console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: After processMove, AI stone still exists at (${x}, ${y}), gameId=${game.id}`);
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
                console.error(`[handleStandardAction] Invalid move at (${x}, ${y}), reason=${result.reason}, gameId=${game.id}, isSinglePlayer=${game.isSinglePlayer}, gameCategory=${game.gameCategory}`);
                return { error: errorMessage };
            }
            
            // 따낸 돌에 직접 인접한 히든 돌만 공개 대상으로 수집
            const contributingHiddenStones: { point: types.Point, player: types.Player }[] = [];
            if (result.capturedStones.length > 0) {
                const logic = getGoLogic({ ...game, boardState: result.newBoardState });
                const seen = new Set<string>();
                for (const capturedStone of result.capturedStones) {
                    for (const neighbor of logic.getNeighbors(capturedStone.x, capturedStone.y)) {
                        if (result.newBoardState[neighbor.y][neighbor.x] !== myPlayerEnum) continue;
                        const isCurrentMove = neighbor.x === x && neighbor.y === y;
                        let isHiddenStone = isCurrentMove ? isHidden : false;
                        if (!isCurrentMove) {
                            for (let i = game.moveHistory.length - 1; i >= 0; i--) {
                                const moveAtIndex = game.moveHistory[i];
                                if (moveAtIndex.x === neighbor.x && moveAtIndex.y === neighbor.y) {
                                    isHiddenStone = !!game.hiddenMoves?.[i];
                                    break;
                                }
                            }
                        }
                        const key = `${neighbor.x},${neighbor.y}`;
                        if (isHiddenStone && !seen.has(key) && (!game.permanentlyRevealedStones || !game.permanentlyRevealedStones.some(p => p.x === neighbor.x && p.y === neighbor.y))) {
                            seen.add(key);
                            contributingHiddenStones.push({ point: { x: neighbor.x, y: neighbor.y }, player: myPlayerEnum });
                        }
                    }
                }
            }

            const capturedHiddenStones: { point: types.Point; player: types.Player }[] = [];
            if (result.capturedStones.length > 0) {
                for (const capturedStone of result.capturedStones) {
                    let moveIndex = -1;
                    for (let i = game.moveHistory.length - 1; i >= 0; i--) {
                        const moveAtIndex = game.moveHistory[i];
                        if (moveAtIndex.x === capturedStone.x && moveAtIndex.y === capturedStone.y) {
                            moveIndex = i;
                            break;
                        }
                    }
                    if (moveIndex !== -1 && game.hiddenMoves?.[moveIndex]) {
                        const isPermanentlyRevealed = game.permanentlyRevealedStones?.some(p => p.x === capturedStone.x && p.y === capturedStone.y);
                        if (!isPermanentlyRevealed) {
                            capturedHiddenStones.push({ point: capturedStone, player: opponentPlayerEnum });
                        }
                    }
                }
                // 싱글/전략 AI 대국: AI 초기 히든돌이 따낸 경우 공개 애니메이션 대상에 포함
                if ((game.isSinglePlayer || isStrategicAiGame) && (game as any).aiInitialHiddenStone) {
                    const aiHidden = (game as any).aiInitialHiddenStone;
                    const isCaptured = result.capturedStones.some(s => s.x === aiHidden.x && s.y === aiHidden.y);
                    if (isCaptured) {
                        const isPermanentlyRevealed = game.permanentlyRevealedStones?.some(p => p.x === aiHidden.x && p.y === aiHidden.y);
                        if (!isPermanentlyRevealed) {
                            capturedHiddenStones.push({ point: { x: aiHidden.x, y: aiHidden.y }, player: opponentPlayerEnum });
                        }
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
            if (!isHidden) game.lastMove = { x, y };
            game.lastTurnStones = null;
            game.moveHistory.push(move);
            game.koInfo = result.newKoInfo;
            game.passCount = 0;

            if (isHidden) {
                if (!game.hiddenMoves) game.hiddenMoves = {};
                game.hiddenMoves[game.moveHistory.length - 1] = true;
                console.log(`[handleStrategicAction] Hidden stone placed at (${x}, ${y}), moveIndex=${game.moveHistory.length - 1}, gameId=${game.id}`);
            }

            if (result.capturedStones.length > 0) {
                // 길드전 별 판정(한 번에 따낸 최대 개수) 정확도를 위해 실시간 최대값 저장
                const captureCountThisMove = result.capturedStones.length;
                const maxSingleCaptureByPlayer = ((game as any).maxSingleCaptureByPlayer ??= {});
                const prevMaxForPlayer = Number(maxSingleCaptureByPlayer[myPlayerEnum] ?? 0) || 0;
                if (captureCountThisMove > prevMaxForPlayer) {
                    maxSingleCaptureByPlayer[myPlayerEnum] = captureCountThisMove;
                }
                game.justCaptured = [];
                let guildWarCapturePointsThisMove = 0;
                for (const stone of result.capturedStones) {
                    const capturedPlayerEnum = opponentPlayerEnum;
                    
                    let points = 1;
                    let wasHiddenForJustCaptured = false; // default for justCaptured

                    if (
                        game.isSinglePlayer ||
                        isStrategicAiGame ||
                        (game as any).gameCategory === 'guildwar' ||
                        (game as any).gameCategory === 'tower'
                    ) {
                        const isBaseStone = isIntersectionRecordedAsBaseStone(game, stone.x, stone.y);
                        if (isBaseStone) {
                            game.baseStoneCaptures[myPlayerEnum]++;
                            points = 5;
                        } else {
                            const wasPatternStone = consumeOpponentPatternStoneIfAny(game, stone, capturedPlayerEnum);
                            if (wasPatternStone) {
                                points = 2;
                            } else {
                                // 싱글/탑/길드전: 히든·AI초기히든은 5점 (문양돌과 겹치면 문양 점수 우선 — 위에서 처리됨)
                                // 동일 좌표 재착수 시 과거(가장 이른) 수순 오인 방지를 위해 최신 상대 수순을 찾는다.
                                let moveIndex = -1;
                                for (let i = (game.moveHistory?.length ?? 0) - 1; i >= 0; i--) {
                                    const m = game.moveHistory![i];
                                    if (m.x === stone.x && m.y === stone.y && m.player === capturedPlayerEnum) {
                                        moveIndex = i;
                                        break;
                                    }
                                }
                                const wasHidden = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
                                const wasAiInitialHidden =
                                    (game as any).aiInitialHiddenStone &&
                                    (game as any).aiInitialHiddenStone.x === stone.x &&
                                    (game as any).aiInitialHiddenStone.y === stone.y;
                                if (wasHidden || wasAiInitialHidden) {
                                    game.hiddenStoneCaptures[myPlayerEnum] = (game.hiddenStoneCaptures[myPlayerEnum] || 0) + 1;
                                    points = 5;
                                    wasHiddenForJustCaptured = true;
                                    if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                                    if (!game.permanentlyRevealedStones.some(p => p.x === stone.x && p.y === stone.y)) {
                                        game.permanentlyRevealedStones.push(stone);
                                    }
                                }
                            }
                        }
                    } else { // PvP logic
                        const isBaseStone = isIntersectionRecordedAsBaseStone(game, stone.x, stone.y);
                        let moveIndex = -1;
                        for (let i = (game.moveHistory?.length ?? 0) - 1; i >= 0; i--) {
                            const m = game.moveHistory![i];
                            if (m.x === stone.x && m.y === stone.y && m.player === capturedPlayerEnum) {
                                moveIndex = i;
                                break;
                            }
                        }
                        const wasHidden = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
                        wasHiddenForJustCaptured = wasHidden; // pass to justCaptured

                        if (isBaseStone) {
                            game.baseStoneCaptures[myPlayerEnum]++;
                            points = 5;
                        } else if (consumeOpponentPatternStoneIfAny(game, stone, capturedPlayerEnum)) {
                            points = 2;
                        } else if (wasHidden) {
                            game.hiddenStoneCaptures[myPlayerEnum]++;
                            points = 5;
                            if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                            game.permanentlyRevealedStones.push(stone);
                        }
                    }

                    game.captures[myPlayerEnum] += points;
                    guildWarCapturePointsThisMove += points;
                    game.justCaptured.push({ point: stone, player: capturedPlayerEnum, wasHidden: wasHiddenForJustCaptured, capturePoints: points });
                    for (let i = (game.moveHistory?.length ?? 0) - 1; i >= 0; i--) {
                        const m = game.moveHistory![i];
                        if (m.x === stone.x && m.y === stone.y && m.player === capturedPlayerEnum) {
                            if (game.hiddenMoves?.[i]) delete game.hiddenMoves[i];
                            break;
                        }
                    }
                    if (
                        (game as any).aiInitialHiddenStone &&
                        (game as any).aiInitialHiddenStone.x === stone.x &&
                        (game as any).aiInitialHiddenStone.y === stone.y
                    ) {
                        (game as any).aiInitialHiddenStone = undefined;
                    }
                }
                bumpGuildWarMaxSingleCapturePointsForPlayer(game as any, myPlayerEnum, guildWarCapturePointsThisMove);
                stripPatternStonesAtConsumedIntersections(game);
                removeCapturedBaseStoneMarkersFromSession(game, result.capturedStones);
            }

            if (!isHidden && game.permanentlyRevealedStones?.length) {
                game.permanentlyRevealedStones = game.permanentlyRevealedStones.filter((p) => !(p.x === x && p.y === y));
            }

            const playerWhoMoved = myPlayerEnum;
            if (hasTimeControl(game.settings) && shouldEnforceTimeControl(game)) {
                const timeKey = playerWhoMoved === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                const byoyomiKey = playerWhoMoved === types.Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';
                const fischerIncrement = getFischerIncrementSeconds(game as any);
                const isFischer = isFischerStyleTimeControl(game as any);
                const isInByoyomi = game[timeKey] <= 0 && game.settings.byoyomiCount > 0 && game[byoyomiKey] > 0 && !isFischer;
                if (isInByoyomi) {
                    game[timeKey] = 0;
                } else if (game.turnDeadline) {
                    const timeRemaining = Math.max(0, (game.turnDeadline - now) / 1000);
                    game[timeKey] = timeRemaining + fischerIncrement;
                } else if(game.pausedTurnTimeLeft) {
                    game[timeKey] = game.pausedTurnTimeLeft + fischerIncrement;
                } else {
                    game[timeKey] += fischerIncrement;
                }
            }

            game.currentPlayer = opponentPlayerEnum;
            game.missileUsedThisTurn = false;
            
            // 히든 아이템 사용 후 게임 상태 복원 (싱글플레이어)
            // 턴 전환 후에 상태 복원 (currentPlayer 변경 후)
            const wasHiddenPlacing = game.gameStatus === 'hidden_placing';
            if (game.isSinglePlayer && wasHiddenPlacing && isHidden) {
                // 싱글플레이에서 히든 착점 시: 아이템 사용 시간 정리하고 바로 턴 전환
                console.log(`[handleStandardAction] Single player hidden placement: restoring state and transitioning turn immediately, gameId=${game.id}`);
                game.gameStatus = 'playing';
                game.itemUseDeadline = undefined;
                game.pausedTurnTimeLeft = undefined;
            } else if (wasHiddenPlacing) {
                game.gameStatus = 'playing';
                game.itemUseDeadline = undefined;
                game.pausedTurnTimeLeft = undefined;
            } else {
                game.gameStatus = 'playing';
                game.itemUseDeadline = undefined;
                game.pausedTurnTimeLeft = undefined;
            }


            if (hasTimeControl(game.settings) && shouldEnforceTimeControl(game)) {
                const nextPlayer = game.currentPlayer;
                const nextTimeKey = nextPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                const nextByoyomiKey = nextPlayer === types.Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';
                 const isFischerNext = isFischerStyleTimeControl(game as any);
                const isNextInByoyomi = game[nextTimeKey] <= 0 && game.settings.byoyomiCount > 0 && game[nextByoyomiKey] > 0 && !isFischerNext;

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

            // 싱글플레이/도전의 탑 자동 계가: 사용자가 돌을 놓은 후 totalTurns 업데이트 및 계가 트리거
            const isAutoScoringMode = (game.isSinglePlayer || game.gameCategory === 'tower') && game.stageId;
            if (isAutoScoringMode) {
                let autoScoringTurns: number | undefined;
                if (game.gameCategory === 'tower') {
                    autoScoringTurns = (game.settings as any)?.autoScoringTurns;
                } else {
                    const stage = (await getEffectiveSinglePlayerStages()).find(s => s.id === game.stageId);
                    autoScoringTurns = stage?.autoScoringTurns;
                }
                
                if (autoScoringTurns !== undefined) {
                    const validMoves = game.moveHistory.filter(m => m.x !== -1 && m.y !== -1);
                    const newTotalTurns = validMoves.length;
                    game.totalTurns = newTotalTurns;
                    
                    if (newTotalTurns >= autoScoringTurns) {
                        const gameType = game.gameCategory === 'tower' ? 'Tower' : 'SinglePlayer';
                        console.log(`[handleStrategicAction] Auto-scoring triggered (user placed last stone): totalTurns=${newTotalTurns}, autoScoringTurns=${autoScoringTurns}, ${gameType}`);
                        // 히든 모드: getGameResult가 미공개 히든 돌이 있으면 hidden_final_reveal → 공개 연출 후 계가. 먼저 scoring으로 덮어쓰지 않음.
                        try {
                            await getGameResult(game);
                        } catch (scoringError: any) {
                            console.error(`[handleStrategicAction] Error during auto-scoring for game ${game.id}:`, scoringError?.message);
                        }
                        return {};
                    }
                    // totalTurns만 갱신된 경우에도 DB 저장 (F5 새로고침 후 재입장 시 자동계가까지 남은 턴이 Max로 초기화되는 버그 방지)
                    await db.saveGame(game);
                    if (newTotalTurns === autoScoringTurns - 1) {
                        console.log(`[handleStrategicAction] Last turn reached: totalTurns=${newTotalTurns}, autoScoringTurns=${autoScoringTurns}, next turn will trigger auto-scoring after AI move`);
                    }
                }
            }

            // 전략바둑 로비/AI 대국: 계가까지 턴 제한(scoringTurnLimit)이 있으면 해당 턴 수 도달 시 자동 계가
            // (이미 위에서 scoringTurnLimit을 읽었으므로 여기서는 재선언하지 않음)
            const scoringTurnLimitAfterMove = scoringTurnLimit;
            if (
                scoringTurnLimitAfterMove != null &&
                scoringTurnLimitAfterMove > 0 &&
                game.mode !== types.GameMode.Capture &&
                !game.isSinglePlayer &&
                game.gameCategory !== 'tower'
            ) {
                // scoringTurnLimit 기준 "턴"은 PASS(-1,-1)도 포함해서 카운트한다.
                const newTotalTurns = (game.moveHistory || []).length;
                game.totalTurns = newTotalTurns;
                if (newTotalTurns >= scoringTurnLimitAfterMove) {
                    // N수 계가: 제한 도달 직후(정확히 N수가 쌓인 판)에서 계가 — 다음 차례가 AI여도 한 수 더 두지 않음(81수째 계가 방지)
                    console.log(
                        `[handleStrategicAction] Scoring turn limit reached: totalTurns=${newTotalTurns}, scoringTurnLimit=${scoringTurnLimitAfterMove}, triggering getGameResult`,
                    );
                    if (isLobbyAiStrategicGame(game)) {
                        await broadcastPlayingSnapshotBeforeScoring(game);
                    }
                    game.gameStatus = 'scoring';
                    await db.saveGame(game);
                    const { broadcastToGameParticipants } = await import('../socket.js');
                    const gameToBroadcast = { ...game };
                    delete (gameToBroadcast as any).boardState;
                    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);
                    try {
                        await getGameResult(game);
                    } catch (scoringError: any) {
                        console.error(`[handleStrategicAction] Error during scoring (turn limit) for game ${game.id}:`, scoringError?.message);
                    }
                    return {};
                }
            }

            // AI 턴인 경우 즉시 처리할 수 있도록 aiTurnStartTime을 현재 시간으로 설정
            if (game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White)) {
                const { aiUserId } = await import('../aiPlayer.js');
                const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                if (currentPlayerId === aiUserId) {
                    const startAt = nextAiTurnStartTimeAfterHumanStrategicMove(game, now);
                    game.aiTurnStartTime = startAt;
                    console.log(
                        `[handleStrategicAction] AI turn after PLACE_STONE, game ${game.id}, setting aiTurnStartTime to ${startAt} (now=${now})`,
                    );
                } else {
                    // 사용자 턴으로 넘어갔으므로 aiTurnStartTime을 undefined로 설정
                    game.aiTurnStartTime = undefined;
                    console.log(`[handleStrategicAction] User turn after PLACE_STONE, game ${game.id}, clearing aiTurnStartTime`);
                }
            }

            if (await tryEndGameWhenCaptureTargetReached(game, myPlayerEnum)) {
                return {};
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
            // 통과 시 단순 코(ko) 금지 해제 — 이전 턴 koInfo가 남아 재따내기가 막히는 버그 방지
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
                                    if (
                                        !isPermanentlyRevealed &&
                                        !isHiddenMoveIndexSoftRevealedByAnyPlayer(game, moveIndex)
                                    ) {
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
                     const isFischerPass = isFischerStyleTimeControl(game as any);
                    const isNextInByoyomi = game[nextTimeKey] <= 0 && game.settings.byoyomiCount > 0 && game[nextByoyomiKey] > 0 && !isFischerPass;
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
                        const startAt = nextAiTurnStartTimeAfterHumanStrategicMove(game, now);
                        game.aiTurnStartTime = startAt;
                        console.log(
                            `[handleStrategicAction] AI turn after PASS_TURN, game ${game.id}, setting aiTurnStartTime to ${startAt} (now=${now})`,
                        );
                    } else {
                        // 사용자 턴으로 넘어갔으므로 aiTurnStartTime을 undefined로 설정
                        game.aiTurnStartTime = undefined;
                        console.log(`[handleStrategicAction] User turn after PASS_TURN, game ${game.id}, clearing aiTurnStartTime`);
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
                volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, mode: game.mode };
            }

            return {};
        }
    }

    return null;
};
