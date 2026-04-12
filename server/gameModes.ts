
import { getGoLogic } from './goLogic.js';
import { NO_CONTEST_MOVE_THRESHOLD, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, STRATEGIC_ACTION_BUTTONS_EARLY, STRATEGIC_ACTION_BUTTONS_MID, STRATEGIC_ACTION_BUTTONS_LATE, PLAYFUL_ACTION_BUTTONS_EARLY, PLAYFUL_ACTION_BUTTONS_MID, PLAYFUL_ACTION_BUTTONS_LATE, RANDOM_DESCRIPTIONS, ALKKAGI_TURN_TIME_LIMIT, ALKKAGI_PLACEMENT_TIME_LIMIT, TIME_BONUS_SECONDS_PER_POINT, getScoringTurnLimitOptionsByBoardSize } from '../constants';
import * as types from '../types/index.js';
import { analyzeGame, getScoringKataGoLimits } from './kataGoService.js';
import type { LiveGameSession, AppState, Negotiation, ActionButton, GameMode } from '../types/index.js';
import { GameCategory } from '../types/enums.js';
import { aiUserId, makeAiMove, getAiUser, getAiUserForGuildWar } from './aiPlayer.js';
import { syncAiSession } from './aiSessionManager.js';
// FIX: The imported functions were not found. They are now exported from `standard.ts` with the correct names.
import { initializeStrategicGame, updateStrategicGameState } from './modes/standard.js';
import { initializePlayfulGame, updatePlayfulGameState } from './modes/playful.js';
import { randomUUID } from 'crypto';
import * as db from './db.js';
import * as effectService from './effectService.js';
import { endGame } from './summaryService.js';
import { getStoneCapturePointValueForScoring } from '../shared/utils/scoringStonePoints.js';

// 정확한 계가 결과는 1회만 표시한다는 전제 하에,
// (특히 히든돌 최종 공개 애니메이션 동안) KataGo 분석을 백그라운드로 미리 시작해
// scoring 상태에서의 대기 시간을 줄이기 위한 프리컴퓨트 캐시.
// - UI에는 결과를 미리 보여주지 않음 (ended 전까지 분석 결과 미노출)
// - 애니메이션 종료 후 getGameResult가 다시 호출될 때 결과를 재사용
const scoringPrecompute = new Map<string, { startedAt: number; promise: Promise<types.AnalysisResult> }>();
const PRECOMPUTE_TTL_MS = 60_000;

function cleanupScoringPrecompute(nowMs: number): void {
    if (scoringPrecompute.size === 0) return;
    for (const [gameId, entry] of scoringPrecompute.entries()) {
        if (!entry || (nowMs - entry.startedAt) > PRECOMPUTE_TTL_MS) {
            scoringPrecompute.delete(gameId);
        }
    }
}

export const finalizeAnalysisResult = (baseAnalysis: types.AnalysisResult, session: types.LiveGameSession, preservedTimeInfo?: { blackTimeLeft?: number, whiteTimeLeft?: number, blackInitialTimeLeft?: number, whiteInitialTimeLeft?: number }): types.AnalysisResult => {
    const finalAnalysis = JSON.parse(JSON.stringify(baseAnalysis)); // Deep copy

    // 사석 점수 동기화: deadStones 배열과 scoreDetails가 항상 일치하도록 (보드 마커와 모달 점수 불일치 방지)
    const boardState = session.boardState;
    if (finalAnalysis.deadStones && Array.isArray(finalAnalysis.deadStones) && boardState && Array.isArray(boardState) && boardState.length > 0) {
        let whiteDeadScore = 0;
        let blackDeadScore = 0;
        for (const p of finalAnalysis.deadStones as { x: number; y: number }[]) {
            const c = boardState[p.y]?.[p.x];
            if (c === types.Player.White) {
                whiteDeadScore += getStoneCapturePointValueForScoring(session, p, types.Player.White);
            } else if (c === types.Player.Black) {
                blackDeadScore += getStoneCapturePointValueForScoring(session, p, types.Player.Black);
            }
        }
        finalAnalysis.scoreDetails.black.deadStones = Math.round(whiteDeadScore);
        finalAnalysis.scoreDetails.white.deadStones = Math.round(blackDeadScore);
    }

    // Base stone bonus
    finalAnalysis.scoreDetails.black.baseStoneBonus = 0;
    finalAnalysis.scoreDetails.white.baseStoneBonus = 0;

    // Hidden stone bonus
    finalAnalysis.scoreDetails.black.hiddenStoneBonus = 0;
    finalAnalysis.scoreDetails.white.hiddenStoneBonus = 0;
    
    // Time bonus: 스피드바둑 PVP는 기본시간 대비 ± 5초당 1점. AI 대결은 기본 20점 - (누적시간 5초당 1점 차감).
    const SPEED_AI_BASE_TIME_BONUS = 20;
    const isSpeedMode = session.mode === types.GameMode.Speed || (session.mode === types.GameMode.Mix && session.settings.mixedModes?.includes(types.GameMode.Speed));
    if (isSpeedMode) {
        const blackInitial = preservedTimeInfo?.blackInitialTimeLeft ?? session.blackInitialTimeLeft;
        const whiteInitial = preservedTimeInfo?.whiteInitialTimeLeft ?? session.whiteInitialTimeLeft;
        const blackTime = preservedTimeInfo?.blackTimeLeft ?? session.blackTimeLeft ?? 0;
        const whiteTime = preservedTimeInfo?.whiteTimeLeft ?? session.whiteTimeLeft ?? 0;
        if (blackInitial != null && whiteInitial != null) {
            const isAiOrSinglePlayer = !!session.isAiGame || !!session.isSinglePlayer;
            if (isAiOrSinglePlayer) {
                // 스피드 바둑 AI/싱글플레이: 기본 20점, 총 누적 사용시간 5초당 1점 차감 (인간 측만 적용, AI는 0)
                const blackUsedSec = Math.max(0, blackInitial - blackTime);
                const whiteUsedSec = Math.max(0, whiteInitial - whiteTime);
                const blackIsHuman = session.blackPlayerId !== aiUserId;
                const whiteIsHuman = session.whitePlayerId !== aiUserId;
                finalAnalysis.scoreDetails.black.timeBonus = blackIsHuman
                    ? Math.max(0, SPEED_AI_BASE_TIME_BONUS - Math.floor(blackUsedSec / TIME_BONUS_SECONDS_PER_POINT))
                    : 0;
                finalAnalysis.scoreDetails.white.timeBonus = whiteIsHuman
                    ? Math.max(0, SPEED_AI_BASE_TIME_BONUS - Math.floor(whiteUsedSec / TIME_BONUS_SECONDS_PER_POINT))
                    : 0;
            } else {
                // PVP 스피드: 기본시간 대비 ± 초를 5초당 1점으로
                finalAnalysis.scoreDetails.black.timeBonus = Math.floor((blackTime - blackInitial) / TIME_BONUS_SECONDS_PER_POINT);
                finalAnalysis.scoreDetails.white.timeBonus = Math.floor((whiteTime - whiteInitial) / TIME_BONUS_SECONDS_PER_POINT);
            }
        } else {
            finalAnalysis.scoreDetails.black.timeBonus = 0;
            finalAnalysis.scoreDetails.white.timeBonus = 0;
        }
        console.log(`[finalizeAnalysisResult] Speed time bonus: blackTime=${blackTime}, whiteTime=${whiteTime}, blackInitial=${blackInitial}, whiteInitial=${whiteInitial}, blackBonus=${finalAnalysis.scoreDetails.black.timeBonus}, whiteBonus=${finalAnalysis.scoreDetails.white.timeBonus}`);
    } else {
        finalAnalysis.scoreDetails.black.timeBonus = 0;
        finalAnalysis.scoreDetails.white.timeBonus = 0;
    }
    
    // Item bonus (currently none, placeholder)
    finalAnalysis.scoreDetails.black.itemBonus = 0;
    finalAnalysis.scoreDetails.white.itemBonus = 0;

    // Recalculate totals
    const blackTotal = finalAnalysis.scoreDetails.black.territory + finalAnalysis.scoreDetails.black.captures + (finalAnalysis.scoreDetails.black.deadStones ?? 0) + finalAnalysis.scoreDetails.black.baseStoneBonus + finalAnalysis.scoreDetails.black.hiddenStoneBonus + finalAnalysis.scoreDetails.black.timeBonus + finalAnalysis.scoreDetails.black.itemBonus;
    const whiteTotal = finalAnalysis.scoreDetails.white.territory + finalAnalysis.scoreDetails.white.captures + finalAnalysis.scoreDetails.white.komi + (finalAnalysis.scoreDetails.white.deadStones ?? 0) + finalAnalysis.scoreDetails.white.baseStoneBonus + finalAnalysis.scoreDetails.white.hiddenStoneBonus + finalAnalysis.scoreDetails.white.timeBonus + finalAnalysis.scoreDetails.white.itemBonus;
    
    finalAnalysis.scoreDetails.black.total = blackTotal;
    finalAnalysis.scoreDetails.white.total = whiteTotal;
    
    finalAnalysis.areaScore.black = blackTotal;
    finalAnalysis.areaScore.white = whiteTotal;
    
    // 디버깅: 점수 계산 상세 로그
    console.log(`[finalizeAnalysisResult] Score calculation for game ${session.id}:`);
    console.log(`  Black: territory=${finalAnalysis.scoreDetails.black.territory}, captures=${finalAnalysis.scoreDetails.black.captures}, deadStones=${finalAnalysis.scoreDetails.black.deadStones ?? 0}, total=${blackTotal}`);
    console.log(`  White: territory=${finalAnalysis.scoreDetails.white.territory}, captures=${finalAnalysis.scoreDetails.white.captures}, komi=${finalAnalysis.scoreDetails.white.komi}, deadStones=${finalAnalysis.scoreDetails.white.deadStones ?? 0}, total=${whiteTotal}`);
    
    return finalAnalysis;
};


export const getGameResult = async (game: LiveGameSession): Promise<LiveGameSession> => {
    cleanupScoringPrecompute(Date.now());
    console.log(`[getGameResult] Called for game ${game.id}, gameStatus=${game.gameStatus}, isSinglePlayer=${game.isSinglePlayer}, stageId=${game.stageId}`);
    
    // 이미 계가가 진행 중이거나 완료된 경우 중복 호출 방지
    if (game.gameStatus === 'ended' || (game.gameStatus === 'scoring' && (game as any).isScoringProtected)) {
        console.log(`[getGameResult] Game ${game.id} already in scoring/ended state, skipping`);
        return game;
    }
    const isMissileMode = game.mode === types.GameMode.Missile || (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Missile));
    const p1MissilesUsed = (game.settings.missileCount ?? 0) - (game.missiles_p1 ?? game.settings.missileCount ?? 0);
    const p2MissilesUsed = (game.settings.missileCount ?? 0) - (game.missiles_p2 ?? game.settings.missileCount ?? 0);
    const hasUsedMissile = isMissileMode && (p1MissilesUsed > 0 || p2MissilesUsed > 0);

    const isHiddenMode = game.mode === types.GameMode.Hidden || (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Hidden));
    const p1ScansUsed = (game.settings.scanCount ?? 0) - (game.scans_p1 ?? game.settings.scanCount ?? 0);
    const p2ScansUsed = (game.settings.scanCount ?? 0) - (game.scans_p2 ?? game.settings.scanCount ?? 0);
    const hasUsedScan = isHiddenMode && (p1ScansUsed > 0 || p2ScansUsed > 0);

    // 싱글플레이어 게임에서는 NO_CONTEST 체크를 건너뜀 (자동 계가 등으로 인해 moveHistory가 초기화될 수 있음)
    const isSinglePlayer = game.isSinglePlayer && !game.gameCategory; // 도전의 탑은 제외

    /** 패(-1,-1)는 제외한 착수 수 — 「10수 미만」 규정과 동일하게 셈 */
    const strategicStoneMoveCount = (game.moveHistory || []).filter(
        (m) => m && m.x !== -1 && m.y !== -1
    ).length;

    if (SPECIAL_GAME_MODES.some(m => m.mode === game.mode) && 
        !isSinglePlayer && // 싱글플레이어 게임 제외
        strategicStoneMoveCount < NO_CONTEST_MOVE_THRESHOLD && 
        !hasUsedMissile && 
        !hasUsedScan) {
        game.gameStatus = 'no_contest';
        game.shortGameNoContest = true;
        if (!game.noContestInitiatorIds) game.noContestInitiatorIds = [];
        if (!game.noContestInitiatorIds.includes(game.player1.id)) game.noContestInitiatorIds.push(game.player1.id);
        if (!game.noContestInitiatorIds.includes(game.player2.id)) game.noContestInitiatorIds.push(game.player2.id);
        try {
            await db.saveGame(game);
            const { broadcastToGameParticipants } = await import('./socket.js');
            const gameToBroadcast = { ...game };
            delete (gameToBroadcast as any).boardState;
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);
        } catch (e: any) {
            console.error(`[getGameResult] Failed to persist/broadcast short-game no_contest for ${game.id}:`, e?.message || e);
        }
        return game;
    }
    
    const isGoBased = SPECIAL_GAME_MODES.some(m => m.mode === game.mode);
    if (!isGoBased) {
        game.gameStatus = 'ended';
        return game;
    }
    
    // 계가 시작 전: 아직 공개되지 않은 히든 돌들을 모두 공개
    if (isHiddenMode && game.hiddenMoves && game.moveHistory) {
        if (!game.permanentlyRevealedStones) {
            game.permanentlyRevealedStones = [];
        }
        
        // 실제 비공개 상태였던 히든 돌만 공개 대상: hiddenMoves에 true로 등록되고, 아직 permanentlyRevealed에 없는 수만
        const stonesToReveal: types.Point[] = [];
        const moveHistoryLen = game.moveHistory.length;
        
        for (const [moveIndexStr, isHidden] of Object.entries(game.hiddenMoves)) {
            if (!isHidden) continue;
            
            const moveIndex = parseInt(moveIndexStr, 10);
            if (moveIndex < 0 || moveIndex >= moveHistoryLen) continue;
            
            const move = game.moveHistory[moveIndex];
            if (!move || move.x === -1 || move.y === -1) continue;
            
            const { x, y } = move;
            
            const isAlreadyRevealed = game.permanentlyRevealedStones.some(
                p => p.x === x && p.y === y
            );
            if (isAlreadyRevealed) continue;
            
            if (game.boardState[y]?.[x] !== types.Player.None) {
                stonesToReveal.push({ x, y });
            }
        }
        
        // AI 초기 히든돌도 확인 (싱글플레이·탑)
        if ((game.isSinglePlayer || game.gameCategory === 'tower') && (game as any).aiInitialHiddenStone) {
            const aiHidden = (game as any).aiInitialHiddenStone;
            const isAlreadyRevealed = game.permanentlyRevealedStones.some(
                p => p.x === aiHidden.x && p.y === aiHidden.y
            );
            
            if (!isAlreadyRevealed) {
                // AI 초기 히든돌이 보드에 남아있는지 확인
                if (game.boardState[aiHidden.y]?.[aiHidden.x] !== types.Player.None) {
                    stonesToReveal.push({ x: aiHidden.x, y: aiHidden.y });
                    // AI 초기 히든돌을 moveHistory에 추가 (아직 추가되지 않은 경우)
                    const moveIndex = game.moveHistory.findIndex(m => m.x === aiHidden.x && m.y === aiHidden.y);
                    if (moveIndex === -1) {
                        if (!game.hiddenMoves) game.hiddenMoves = {};
                        const hiddenMoveIndex = game.moveHistory.length;
                        game.moveHistory.push({
                            player: types.Player.White,
                            x: aiHidden.x,
                            y: aiHidden.y
                        });
                        game.hiddenMoves[hiddenMoveIndex] = true;
                    }
                }
            }
        }
        
        // 공개할 히든 돌이 없으면 애니메이션 없이 바로 계가 진행
        if (stonesToReveal.length === 0) {
            console.log(`[getGameResult] No hidden stones to reveal for game ${game.id}, proceeding to scoring`);
        }
        // 발견되지 않은 히든 돌들이 있으면 공개 애니메이션 후 계가
        if (stonesToReveal.length > 0) {
            // 히든돌 공개 애니메이션 추가
            const now = Date.now();
            const stonesToRevealWithPlayer = stonesToReveal.map(point => {
                // moveHistory에서 원래 플레이어 확인
                const moveIndex = game.moveHistory.findIndex(m => m.x === point.x && m.y === point.y);
                const isAiInitial = (game.isSinglePlayer || game.gameCategory === 'tower') && (game as any).aiInitialHiddenStone &&
                    (game as any).aiInitialHiddenStone.x === point.x && (game as any).aiInitialHiddenStone.y === point.y;
                const player = moveIndex !== -1 ? game.moveHistory[moveIndex].player : (isAiInitial ? types.Player.White : types.Player.Black);
                return { point, player };
            });
            
            game.permanentlyRevealedStones.push(...stonesToReveal);
            console.log(`[getGameResult] Revealed ${stonesToReveal.length} hidden stones before scoring for game ${game.id}`);
            
            // 히든돌 공개 애니메이션 설정
            game.animation = {
                type: 'hidden_reveal',
                stones: stonesToRevealWithPlayer,
                startTime: now,
                duration: 2000
            };
            game.revealAnimationEndTime = now + 2000;
            game.gameStatus = 'hidden_final_reveal';
            
            // 애니메이션 종료 후 계가 진행하도록 설정
            await db.saveGame(game);
            const { broadcastToGameParticipants } = await import('./socket.js');
            const gameToBroadcast = { ...game };
            delete (gameToBroadcast as any).boardState;
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);

            // 정공법: "결과를 바꾸지 않되 더 빨리"를 위해 애니메이션 동안 KataGo 계가 분석을 미리 시작한다.
            // - 아직 scoring 상태로 바꾸지 않음 (UI/상태 전환은 기존 로직 유지)
            // - 분석 결과는 저장/브로드캐스트하지 않고, 다음 getGameResult 호출 시 재사용만 한다.
            const existing = scoringPrecompute.get(game.id);
            const nowMs = Date.now();
            if (!existing || (nowMs - existing.startedAt) > PRECOMPUTE_TTL_MS) {
                scoringPrecompute.delete(game.id);
                const snapshot = JSON.parse(JSON.stringify({
                    ...game,
                    // boardState/moveHistory는 분석 정확도에 중요하므로 스냅샷 고정
                    boardState: game.boardState,
                    moveHistory: game.moveHistory,
                }));
                const scoringLim = getScoringKataGoLimits();
                const p = analyzeGame(snapshot as types.LiveGameSession, {
                    includePolicy: false,
                    includeOwnership: true,
                    maxVisits: scoringLim.maxVisits,
                    maxTimeSec: scoringLim.maxTimeSec,
                }).catch((e) => {
                    // 프리컴퓨트 실패는 치명적이지 않음. 본 분석 단계에서 정상 재시도됨.
                    throw e;
                });
                scoringPrecompute.set(game.id, { startedAt: nowMs, promise: p });
                console.log(`[getGameResult] Started KataGo precompute during hidden_final_reveal for game ${game.id}`);
            }
            
            // 애니메이션이 끝날 때까지 대기하지 않고 즉시 반환 (updateHiddenState에서 처리)
            return game;
        }
    }
    
    // 게임 상태 보존 (계가 전에 게임이 초기화되는 것을 방지)
    // 먼저 보호 플래그를 설정하여 다른 로직이 게임을 초기화하지 않도록 함
    (game as any).isScoringProtected = true;
    
    const preservedGameState = {
        boardState: game.boardState ? JSON.parse(JSON.stringify(game.boardState)) : null,
        moveHistory: game.moveHistory ? JSON.parse(JSON.stringify(game.moveHistory)) : null,
        blackTimeLeft: game.blackTimeLeft,
        whiteTimeLeft: game.whiteTimeLeft,
        blackPatternStones: game.blackPatternStones ? JSON.parse(JSON.stringify(game.blackPatternStones)) : null,
        whitePatternStones: game.whitePatternStones ? JSON.parse(JSON.stringify(game.whitePatternStones)) : null,
        consumedPatternIntersections: (game as any).consumedPatternIntersections
            ? JSON.parse(JSON.stringify((game as any).consumedPatternIntersections))
            : null,
        captures: game.captures ? JSON.parse(JSON.stringify(game.captures)) : null,
        baseStoneCaptures: game.baseStoneCaptures ? JSON.parse(JSON.stringify(game.baseStoneCaptures)) : null,
        hiddenStoneCaptures: game.hiddenStoneCaptures ? JSON.parse(JSON.stringify(game.hiddenStoneCaptures)) : null,
        totalTurns: game.totalTurns,
    };
    (game as any).preservedGameState = preservedGameState;
    
    // 시간 정보 보존 (게임이 재시작되어 시간이 초기화되는 것을 방지)
    const preservedTimeInfo = {
        blackTimeLeft: game.blackTimeLeft,
        whiteTimeLeft: game.whiteTimeLeft,
        blackInitialTimeLeft: game.blackInitialTimeLeft,
        whiteInitialTimeLeft: game.whiteInitialTimeLeft
    };
    (game as any).preservedTimeInfo = preservedTimeInfo;
    
    // 게임 상태를 scoring으로 변경 (계가 연출 중 미사일 애니메이션 재생 방지를 위해 animation 제거)
    // 계가 진입 시점에 종료 시각 고정 → 총 걸린 시간에 계가 연출 구간 포함되지 않도록
    if (game.endTime == null) game.endTime = Date.now();
    game.gameStatus = 'scoring';
    game.winReason = 'score';
    game.isAnalyzing = true;
    game.animation = null;
    const scoringTotalStart = Date.now(); // 계가 총 소요 시간 측정 (연출/로깅용)

    if (preservedGameState.boardState && Array.isArray(preservedGameState.boardState) && preservedGameState.boardState.length > 0) {
        game.boardState = preservedGameState.boardState;
    }
    if (preservedGameState.moveHistory && Array.isArray(preservedGameState.moveHistory) && preservedGameState.moveHistory.length > 0) {
        game.moveHistory = preservedGameState.moveHistory;
    }
    if (preservedGameState.blackTimeLeft !== undefined) game.blackTimeLeft = preservedGameState.blackTimeLeft;
    if (preservedGameState.whiteTimeLeft !== undefined) game.whiteTimeLeft = preservedGameState.whiteTimeLeft;

    // 보드가 수순보다 돌 수가 적으면 moveHistory로 보드 복원 (불완전한 보드로 계가되는 버그 방지)
    // 단, 미사일/따내기 등 포획이 있는 모드에서는 돌 수가 수순보다 적은 것이 정상이므로 복원하지 않음 (최종 boardState로 계가)
    const boardSize = game.settings?.boardSize ?? 19;
    const validMoves = (game.moveHistory || []).filter((m: { x: number; y: number }) => m && m.x >= 0 && m.y >= 0 && m.x < boardSize && m.y < boardSize);
    const stoneCount = game.boardState && Array.isArray(game.boardState) ? game.boardState.flat().filter((c: number) => c !== types.Player.None && c != null).length : 0;
    const hasCaptureMode = (game.captures && (game.captures[types.Player.Black] > 0 || game.captures[types.Player.White] > 0));
    const shouldNotDeriveFromMoves = isMissileMode || hasCaptureMode;
    if (!shouldNotDeriveFromMoves && validMoves.length > stoneCount && validMoves.length > 0) {
        const derived: number[][] = Array(boardSize).fill(null).map(() => Array(boardSize).fill(types.Player.None));
        for (const move of validMoves) {
            derived[move.y][move.x] = move.player;
        }
        game.boardState = derived;
    }

    const boardStateValid = game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0 && game.boardState[0] && Array.isArray(game.boardState[0]) && game.boardState[0].length > 0;
    if (!boardStateValid) {
        console.error(`[getGameResult] ERROR: boardState invalid for game ${game.id}, cannot start analysis`);
    }
    
    await db.saveGame(game);
    const { broadcast } = await import('./socket.js');
    // 브로드캐스트 시 moveHistory, totalTurns, 시간 정보를 명시적으로 포함하되, boardState는 제외하여 대역폭 절약
    // scoring 상태로 변경될 때는 클라이언트에서 이미 boardState를 보존하고 있으므로 전송 불필요
    const gameToBroadcast = {
        ...game,
        animation: null,
        // boardState는 제외 (클라이언트에서 보존)
        moveHistory: preservedGameState.moveHistory || game.moveHistory,
        totalTurns: preservedGameState.totalTurns ?? game.totalTurns,
        blackTimeLeft: preservedTimeInfo.blackTimeLeft ?? game.blackTimeLeft,
        whiteTimeLeft: preservedTimeInfo.whiteTimeLeft ?? game.whiteTimeLeft,
        blackPatternStones: preservedGameState.blackPatternStones || game.blackPatternStones,
        whitePatternStones: preservedGameState.whitePatternStones || game.whitePatternStones,
        consumedPatternIntersections:
            preservedGameState.consumedPatternIntersections || (game as any).consumedPatternIntersections,
        captures: preservedGameState.captures || game.captures,
        baseStoneCaptures: preservedGameState.baseStoneCaptures || game.baseStoneCaptures,
        hiddenStoneCaptures: preservedGameState.hiddenStoneCaptures || game.hiddenStoneCaptures,
    };
    // boardState 제거하여 대역폭 절약
    delete (gameToBroadcast as any).boardState;
    const { broadcastToGameParticipants } = await import('./socket.js');
    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);
    console.log(`[getGameResult] Scoring started for ${game.id}: moves=${game.moveHistory?.length ?? 0}, board=${game.boardState?.length ?? 0}x${game.boardState?.[0]?.length ?? 0}`);

    // 게임 상태 검증 (KataGo 분석 전)
    if (!game.boardState || !Array.isArray(game.boardState) || game.boardState.length === 0) {
        console.error(`[getGameResult] ERROR: Invalid boardState for game ${game.id}, cannot start KataGo analysis`);
        game.gameStatus = 'ended';
        game.isAnalyzing = false;
        await db.saveGame(game);
        return game;
    }
    
    // 보존된 게임 상태를 클로저에 저장하여 분석 완료 후에도 사용 가능하도록 함
    const savedPreservedGameState = preservedGameState;
    const savedPreservedTimeInfo = preservedTimeInfo;
    
    // 기본 정책: 정확성이 최우선이므로, 수동 계가 폴백은 기본적으로 비활성화합니다.
    // (필요한 경우에만 ENABLE_MANUAL_SCORING_FALLBACK=true 로 명시적으로 켤 수 있음)
    const ENABLE_MANUAL_SCORING_FALLBACK = String(process.env.ENABLE_MANUAL_SCORING_FALLBACK || '').toLowerCase() === 'true';
    const SCORING_FALLBACK_AFTER_MS = parseInt(process.env.KATAGO_SCORING_FALLBACK_AFTER_MS || '0', 10);
    // 계가 전용: 약 3초 안에 끝나도록 제한 (연출은 클라이언트 5초 유지). env로 오버라이드 가능.
    const scoringLimits = getScoringKataGoLimits();
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const finalizeAndEndGame = async (freshGame: types.LiveGameSession, baseAnalysis: types.AnalysisResult, source: 'katago' | 'manual') => {
        console.log(`[getGameResult] Finalizing ${source} analysis result for game ${freshGame.id}...`);
        const timeInfoToUse = (freshGame as any).preservedTimeInfo || savedPreservedTimeInfo || preservedTimeInfo;
        console.log(`[getGameResult] Using time info for bonus: blackTimeLeft=${timeInfoToUse.blackTimeLeft}, whiteTimeLeft=${timeInfoToUse.whiteTimeLeft}`);
        const finalAnalysis = finalizeAnalysisResult(baseAnalysis, freshGame, timeInfoToUse);
        finalAnalysis.source = source;
        finalAnalysis.isProvisional = source !== 'katago';

        if (!freshGame.analysisResult) freshGame.analysisResult = {};
        freshGame.analysisResult['system'] = finalAnalysis;
        freshGame.finalScores = {
            black: finalAnalysis.scoreDetails.black.total,
            white: finalAnalysis.scoreDetails.white.total
        };
        freshGame.isAnalyzing = false;

        const preservedStateForBroadcast = (freshGame as any).preservedGameState || savedPreservedGameState;
        const timeInfoForBroadcast = (freshGame as any).preservedTimeInfo || savedPreservedTimeInfo || preservedTimeInfo;
        const gameToBroadcast = {
            ...freshGame,
            // boardState는 제외 (클라이언트에서 보존)
            moveHistory: preservedStateForBroadcast?.moveHistory || freshGame.moveHistory,
            totalTurns: preservedStateForBroadcast?.totalTurns ?? freshGame.totalTurns,
            blackTimeLeft: timeInfoForBroadcast?.blackTimeLeft ?? freshGame.blackTimeLeft,
            whiteTimeLeft: timeInfoForBroadcast?.whiteTimeLeft ?? freshGame.whiteTimeLeft,
            blackPatternStones: preservedStateForBroadcast?.blackPatternStones || freshGame.blackPatternStones,
            whitePatternStones: preservedStateForBroadcast?.whitePatternStones || freshGame.whitePatternStones,
            consumedPatternIntersections:
                preservedStateForBroadcast?.consumedPatternIntersections ||
                (freshGame as any).consumedPatternIntersections,
            captures: preservedStateForBroadcast?.captures || freshGame.captures,
            baseStoneCaptures: preservedStateForBroadcast?.baseStoneCaptures || freshGame.baseStoneCaptures,
            hiddenStoneCaptures: preservedStateForBroadcast?.hiddenStoneCaptures || freshGame.hiddenStoneCaptures,
        };
        delete (gameToBroadcast as any).boardState;

        await db.saveGame(freshGame);
        const { broadcastToGameParticipants } = await import('./socket.js');
        broadcastToGameParticipants(freshGame.id, { type: 'GAME_UPDATE', payload: { [freshGame.id]: gameToBroadcast } }, freshGame);
        const totalScoringMs = Date.now() - scoringTotalStart;
        console.log(`[getGameResult] KataGo 계가 총 소요: ${(totalScoringMs / 1000).toFixed(2)}초 (${totalScoringMs}ms) — 게임 ${freshGame.id} 결과 브로드캐스트 완료 (Black ${finalAnalysis.scoreDetails.black.total}, White ${finalAnalysis.scoreDetails.white.total})`);

        // 승자 판정: 흑의 점수가 백의 점수보다 크면 흑 승리, 같거나 작으면 백 승리 (덤 때문에)
        const blackTotal = finalAnalysis.scoreDetails.black.total;
        const whiteTotal = finalAnalysis.scoreDetails.white.total;
        const winner = blackTotal > whiteTotal ? types.Player.Black : types.Player.White;
        await endGame(freshGame, winner, 'score');
    };

    const runManualFallbackIfStillScoring = async () => {
        if (!ENABLE_MANUAL_SCORING_FALLBACK || !(SCORING_FALLBACK_AFTER_MS > 0)) return;
        try {
            let freshGame: types.LiveGameSession | null = null;
            if (game.isSinglePlayer || game.gameCategory === 'tower' || game.gameCategory === 'singleplayer') {
                const { getCachedGame } = await import('./gameCache.js');
                freshGame = await getCachedGame(game.id);
            }
            if (!freshGame) freshGame = await db.getLiveGame(game.id);
            if (!freshGame) return;
            if (freshGame.gameStatus !== 'scoring') return;
            if (freshGame.analysisResult?.['system']) return;

            console.warn(`[getGameResult] KataGo scoring taking too long (${SCORING_FALLBACK_AFTER_MS}ms). Falling back to manual scoring for game ${freshGame.id}.`);
            const { calculateScoreManually } = await import('./scoringService.js');
            const manualBase = calculateScoreManually(freshGame);
            await finalizeAndEndGame(freshGame, manualBase, 'manual');
        } catch (e: any) {
            console.error(`[getGameResult] Manual scoring fallback failed for game ${game.id}:`, e?.message || e);
        }
    };

    if (ENABLE_MANUAL_SCORING_FALLBACK && (SCORING_FALLBACK_AFTER_MS > 0)) {
        fallbackTimer = setTimeout(() => { void runManualFallbackIfStillScoring(); }, SCORING_FALLBACK_AFTER_MS);
    }

    // KataGo 기반 계가:
    // - scoring 전용 빠른 옵션(maxTime/maxVisits) + HTTP 레벨에서 짧은 타임아웃(kataGoService)
    // - 일시 오류 시 재시도: 기본 2회·350ms (4회×1초면 체감만 길어짐). env로 조정 가능.
    const KATAGO_MAX_ATTEMPTS = Math.max(1, Math.min(6, parseInt(process.env.KATAGO_SCORING_MAX_ATTEMPTS || '2', 10)));
    const KATAGO_SCORING_RETRY_DELAY_MS = Math.max(0, parseInt(process.env.KATAGO_SCORING_RETRY_DELAY_MS || '350', 10));
    const runAnalysisWithRetries = async (attempt = 1): Promise<types.AnalysisResult> => {
        try {
            // 히든돌 최종 공개 애니메이션 중 미리 시작한 분석이 있으면 재사용
            const pre = scoringPrecompute.get(game.id);
            if (pre) {
                scoringPrecompute.delete(game.id);
                console.log(`[getGameResult] Using precomputed KataGo analysis for game ${game.id} (startedAt=${pre.startedAt})`);
                return await pre.promise;
            }

            const opts: any = {
                includePolicy: false,
                includeOwnership: true,
                maxVisits: scoringLimits.maxVisits,
                maxTimeSec: scoringLimits.maxTimeSec,
            };
            return await analyzeGame(game, opts);
        } catch (err: any) {
            if (attempt < KATAGO_MAX_ATTEMPTS) {
                console.warn(
                    `[getGameResult] KataGo attempt ${attempt}/${KATAGO_MAX_ATTEMPTS} failed for game ${game.id}, retrying in ${KATAGO_SCORING_RETRY_DELAY_MS}ms:`,
                    err?.message
                );
                await new Promise(r => setTimeout(r, KATAGO_SCORING_RETRY_DELAY_MS));
                return runAnalysisWithRetries(attempt + 1);
            }
            throw err;
        }
    };
    
    const analysisStartTime = Date.now();
    runAnalysisWithRetries()
        .then(async (baseAnalysis) => {
            if (fallbackTimer) {
                clearTimeout(fallbackTimer);
                fallbackTimer = null;
            }
            const analysisDuration = Date.now() - analysisStartTime;
            console.log(`[getGameResult] KataGo 분석(API) 소요: ${(analysisDuration / 1000).toFixed(2)}초 (${analysisDuration}ms), game ${game.id} — fresh game state 조회 중...`);
            // 싱글/타워/singleplayer 카테고리는 메모리 캐시 우선 (DB에 없을 수 있음 — 탑은 isSinglePlayer=false)
            let freshGame = null;
            if (game.isSinglePlayer || game.gameCategory === 'tower' || game.gameCategory === 'singleplayer') {
                const { getCachedGame } = await import('./gameCache.js');
                freshGame = await getCachedGame(game.id);
            }
            if (!freshGame) {
                freshGame = await db.getLiveGame(game.id);
            }
            if (!freshGame) {
                console.error(`[getGameResult] Game ${game.id} not found in cache or database after analysis`);
                return;
            }
            
            // 게임 상태가 playing으로 변경되었으면 다시 scoring으로 변경 (게임 루프가 재시작한 경우)
            if (
                freshGame.gameStatus === 'playing' &&
                (freshGame.isSinglePlayer || freshGame.gameCategory === 'tower' || freshGame.gameCategory === 'singleplayer') &&
                freshGame.stageId
            ) {
                console.log(`[getGameResult] Game ${game.id} was reset to playing during analysis, restoring scoring state`);
                
                // 보존된 게임 상태 복원
                const preservedState = (freshGame as any).preservedGameState || (game as any).preservedGameState || savedPreservedGameState;
                if (preservedState) {
                    if (preservedState.moveHistory && preservedState.moveHistory.length > 0) {
                        freshGame.moveHistory = preservedState.moveHistory;
                        console.log(`[getGameResult] Restored moveHistory (length: ${freshGame.moveHistory.length})`);
                    }
                    if (preservedState.boardState && preservedState.boardState.length > 0) {
                        freshGame.boardState = preservedState.boardState;
                        console.log(`[getGameResult] Restored boardState (size: ${freshGame.boardState.length}x${freshGame.boardState[0]?.length || 0})`);
                    }
                    if (preservedState.blackPatternStones) {
                        freshGame.blackPatternStones = preservedState.blackPatternStones;
                    }
                    if (preservedState.whitePatternStones) {
                        freshGame.whitePatternStones = preservedState.whitePatternStones;
                    }
                    if (preservedState.consumedPatternIntersections) {
                        (freshGame as any).consumedPatternIntersections = preservedState.consumedPatternIntersections;
                    }
                    if (preservedState.captures) {
                        freshGame.captures = preservedState.captures;
                    }
                    if (preservedState.baseStoneCaptures) {
                        freshGame.baseStoneCaptures = preservedState.baseStoneCaptures;
                    }
                    if (preservedState.hiddenStoneCaptures) {
                        freshGame.hiddenStoneCaptures = preservedState.hiddenStoneCaptures;
                    }
                    // 시간 정보도 복원
                    if (preservedState.blackTimeLeft !== undefined) {
                        freshGame.blackTimeLeft = preservedState.blackTimeLeft;
                    }
                    if (preservedState.whiteTimeLeft !== undefined) {
                        freshGame.whiteTimeLeft = preservedState.whiteTimeLeft;
                    }
                    // totalTurns도 복원
                    if (preservedState.totalTurns !== undefined) {
                        freshGame.totalTurns = preservedState.totalTurns;
                    }
                    console.log(`[getGameResult] Restored time info: blackTimeLeft=${freshGame.blackTimeLeft}, whiteTimeLeft=${freshGame.whiteTimeLeft}, totalTurns=${freshGame.totalTurns}`);
                } else {
                    // 보존된 상태가 없으면 원본 게임 상태 사용
                    if (game.moveHistory && game.moveHistory.length > 0) {
                        freshGame.moveHistory = game.moveHistory;
                        console.log(`[getGameResult] Restored moveHistory from game (length: ${freshGame.moveHistory.length})`);
                    }
                    if (game.boardState && game.boardState.length > 0) {
                        freshGame.boardState = game.boardState;
                        console.log(`[getGameResult] Restored boardState from game (size: ${freshGame.boardState.length}x${freshGame.boardState[0]?.length || 0})`);
                    }
                }
                
                freshGame.gameStatus = 'scoring';
                freshGame.isAnalyzing = true;
                (freshGame as any).isScoringProtected = true;
                (freshGame as any).preservedGameState = preservedState || (game as any).preservedGameState;
                (freshGame as any).preservedTimeInfo = (game as any).preservedTimeInfo || savedPreservedTimeInfo || preservedTimeInfo;
                await db.saveGame(freshGame);
                const { broadcast } = await import('./socket.js');
                // 브로드캐스트 시 preservedGameState를 명시적으로 포함하되, boardState는 제외하여 대역폭 절약
                // 클라이언트에서 이미 boardState를 보존하고 있으므로 전송 불필요
                const gameToBroadcast = {
                    ...freshGame,
                    // boardState는 제외 (클라이언트에서 보존)
                    moveHistory: preservedState?.moveHistory || freshGame.moveHistory,
                    totalTurns: preservedState?.totalTurns ?? freshGame.totalTurns,
                    blackTimeLeft: (freshGame as any).preservedTimeInfo?.blackTimeLeft ?? freshGame.blackTimeLeft,
                    whiteTimeLeft: (freshGame as any).preservedTimeInfo?.whiteTimeLeft ?? freshGame.whiteTimeLeft,
                    blackPatternStones: preservedState?.blackPatternStones || freshGame.blackPatternStones,
                    whitePatternStones: preservedState?.whitePatternStones || freshGame.whitePatternStones,
                    consumedPatternIntersections:
                        preservedState?.consumedPatternIntersections || (freshGame as any).consumedPatternIntersections,
                    captures: preservedState?.captures || freshGame.captures,
                    baseStoneCaptures: preservedState?.baseStoneCaptures || freshGame.baseStoneCaptures,
                    hiddenStoneCaptures: preservedState?.hiddenStoneCaptures || freshGame.hiddenStoneCaptures,
                };
                // boardState 제거하여 대역폭 절약
                delete (gameToBroadcast as any).boardState;
                const { broadcastToGameParticipants } = await import('./socket.js');
                broadcastToGameParticipants(freshGame.id, { type: 'GAME_UPDATE', payload: { [freshGame.id]: gameToBroadcast } }, freshGame);
            }
            
            if (freshGame.gameStatus !== 'scoring') {
                console.log(`[getGameResult] Game ${game.id} no longer in scoring state (status: ${freshGame.gameStatus}), skipping analysis result`);
                return;
            }
            await finalizeAndEndGame(freshGame, baseAnalysis, 'katago');
        })
        .catch(async (error) => {
        if (fallbackTimer) {
            clearTimeout(fallbackTimer);
            fallbackTimer = null;
        }
        const analysisDuration = Date.now() - analysisStartTime;
        console.error(`[getGameResult] ========================================`);
        console.error(`[getGameResult] KataGo analysis FAILED for game ${game.id} after ${analysisDuration}ms`);
        console.error(`[getGameResult] Error message:`, error instanceof Error ? error.message : String(error));
        console.error(`[getGameResult] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        console.error(`[getGameResult] Game details: isSinglePlayer=${game.isSinglePlayer}, stageId=${game.stageId}, mode=${game.mode}, boardSize=${game.settings.boardSize}`);
        console.error(`[getGameResult] KataGo config: USE_HTTP_API=${process.env.KATAGO_API_URL ? 'true' : 'false'}, KATAGO_API_URL=${process.env.KATAGO_API_URL || 'not set'}`);
        console.error(`[getGameResult] ========================================`);
        // 정확성 우선: 기본적으로는 게임을 ended 처리하지 않고 scoring 상태를 유지하되,
        // isAnalyzing=false 로 브로드캐스트하여 클라이언트가 재시도 가능하게 함.
        if (ENABLE_MANUAL_SCORING_FALLBACK && (SCORING_FALLBACK_AFTER_MS > 0)) {
            await runManualFallbackIfStillScoring();
            return;
        }

        let freshGame: types.LiveGameSession | null = null;
        if (game.isSinglePlayer || game.gameCategory === 'tower' || game.gameCategory === 'singleplayer') {
            const { getCachedGame } = await import('./gameCache.js');
            freshGame = await getCachedGame(game.id);
        }
        if (!freshGame) freshGame = await db.getLiveGame(game.id);

        const isOnlinePvpStrategic =
            !game.isSinglePlayer &&
            game.gameCategory !== 'tower' &&
            game.gameCategory !== 'singleplayer';

        if (
            freshGame &&
            freshGame.gameStatus === 'scoring' &&
            isOnlinePvpStrategic &&
            !freshGame.analysisResult?.['system']
        ) {
            try {
                const { calculateScoreManually } = await import('./scoringService.js');
                const preservedState = (freshGame as any).preservedGameState || (game as any).preservedGameState || savedPreservedGameState;
                if (preservedState) {
                    if (preservedState.moveHistory && preservedState.moveHistory.length > 0) freshGame.moveHistory = preservedState.moveHistory;
                    if (preservedState.boardState && preservedState.boardState.length > 0) freshGame.boardState = preservedState.boardState;
                    if (preservedState.captures) freshGame.captures = preservedState.captures;
                    if (preservedState.totalTurns !== undefined) freshGame.totalTurns = preservedState.totalTurns;
                }
                const manualBase = calculateScoreManually(freshGame);
                await finalizeAndEndGame(freshGame, manualBase, 'manual');
                return;
            } catch (fallbackErr: any) {
                console.error(`[getGameResult] Online PVP manual scoring after Kata failure failed:`, fallbackErr?.message || fallbackErr);
            }
        }

        if (freshGame && freshGame.gameStatus === 'scoring') {
            freshGame.isAnalyzing = false;
            const preservedState = (freshGame as any).preservedGameState || (game as any).preservedGameState || savedPreservedGameState;
            if (preservedState) {
                if (preservedState.moveHistory && preservedState.moveHistory.length > 0) freshGame.moveHistory = preservedState.moveHistory;
                if (preservedState.boardState && preservedState.boardState.length > 0) freshGame.boardState = preservedState.boardState;
                if (preservedState.captures) freshGame.captures = preservedState.captures;
                if (preservedState.totalTurns !== undefined) freshGame.totalTurns = preservedState.totalTurns;
            }
            await db.saveGame(freshGame);
            const { broadcastToGameParticipants } = await import('./socket.js');
            const gameToBroadcast = {
                ...freshGame,
                moveHistory: preservedState?.moveHistory || freshGame.moveHistory,
                totalTurns: preservedState?.totalTurns ?? freshGame.totalTurns,
                captures: preservedState?.captures || freshGame.captures,
            };
            broadcastToGameParticipants(freshGame.id, { type: 'GAME_UPDATE', payload: { [freshGame.id]: gameToBroadcast } }, freshGame);
            console.log(`[getGameResult] KataGo failed for game ${freshGame.id}. Game left in scoring state; client can retry.`);
        }
        });
    return game;
};

export const getNewActionButtons = (game: types.LiveGameSession): ActionButton[] => {
    const { mode, moveHistory } = game;
    
    let phase: 'early' | 'mid' | 'late';
    const isPlayful = PLAYFUL_GAME_MODES.some((m: { mode: GameMode }) => m.mode === mode);

    if (isPlayful) {
        // Use round-based phase for most playful games
        const currentRound = game.alkkagiRound || game.curlingRound || game.round || 1;
        const totalRounds = game.settings.alkkagiRounds || game.settings.curlingRounds || game.settings.diceGoRounds || 2;

        if (currentRound === 1) {
            phase = 'early';
        } else if (currentRound === totalRounds) {
            phase = 'late';
        } else {
            phase = 'mid';
        }
    } else { // Strategic
        const moveCount = moveHistory.length;
        if (moveCount <= 30) {
            phase = 'early';
        } else if (moveCount >= 31 && moveCount <= 150) {
            phase = 'mid';
        } else { // moveCount >= 151
            phase = 'late';
        }
    }

    let sourceDeck: ActionButton[];

    if (isPlayful) {
        switch (phase) {
            case 'early': sourceDeck = PLAYFUL_ACTION_BUTTONS_EARLY; break;
            case 'mid':   sourceDeck = PLAYFUL_ACTION_BUTTONS_MID; break;
            case 'late':  sourceDeck = PLAYFUL_ACTION_BUTTONS_LATE; break;
        }
    } else { // Strategic
        switch (phase) {
            case 'early': sourceDeck = STRATEGIC_ACTION_BUTTONS_EARLY; break;
            case 'mid':   sourceDeck = STRATEGIC_ACTION_BUTTONS_MID; break;
            case 'late':  sourceDeck = STRATEGIC_ACTION_BUTTONS_LATE; break;
        }
    }

    const shuffledButtons = [...sourceDeck].sort(() => 0.5 - Math.random());
    const manners = shuffledButtons.filter(b => b.type === 'manner');
    const unmanners = shuffledButtons.filter(b => b.type === 'unmannerly');

    const mannerCount = Math.random() > 0.5 ? 1 : 2;
    const selectedManners = manners.slice(0, mannerCount);
    
    const neededUnmanners = 3 - selectedManners.length;
    const selectedUnmanners = unmanners.slice(0, neededUnmanners);

    let result = [...selectedManners, ...selectedUnmanners];
    
    if (result.length < 3) {
        const existingNames = new Set(result.map(b => b.name));
        const filler = shuffledButtons.filter(b => !existingNames.has(b.name));
        result.push(...filler.slice(0, 3 - result.length));
    }
    
    return result.slice(0, 3).sort(() => 0.5 - Math.random());
};

export const initializeGame = async (neg: Negotiation): Promise<LiveGameSession> => {
    const gameId = `game-${randomUUID()}`;
    const { settings, mode } = neg;
    const now = Date.now();
    
    const challenger = await db.getUser(neg.challenger.id);
    const opponent = neg.opponent.id === aiUserId ? getAiUser(neg.mode) : await db.getUser(neg.opponent.id);

    if (!challenger || !opponent) {
        throw new Error(`Could not find one or more players to start the game: ${neg.challenger.id}, ${neg.opponent.id}`);
    }
    
    const isAiGame = opponent.id === aiUserId;

    // 전략바둑 AI 대결에서 "제한없음(0)" 옵션 제거 정책:
    // 서버에서 scoringTurnLimit이 0/음수/없으면 보드 크기에 맞는 기본값으로 강제한다.
    if (isAiGame && SPECIAL_GAME_MODES.some(m => m.mode === mode) && mode !== types.GameMode.Capture) {
        const scoringTurnLimit = (settings as any)?.scoringTurnLimit;
        if (typeof scoringTurnLimit !== 'number' || !Number.isFinite(scoringTurnLimit) || scoringTurnLimit <= 0) {
            const options = getScoringTurnLimitOptionsByBoardSize((settings as any)?.boardSize ?? 19).filter(l => l > 0);
            (settings as any).scoringTurnLimit = options[0] ?? 1;
        }
    }

    // 따내기 바둑: 목표 점수 달성으로만 승패 — 계가까지 턴/자동 계가 수 설정은 무시(이전 모드 설정 잔존 방지)
    if (mode === types.GameMode.Capture) {
        (settings as any).scoringTurnLimit = 0;
        delete (settings as any).autoScoringTurns;
    }
    
    const descriptions = RANDOM_DESCRIPTIONS[mode] || [`${mode} 한 판!`];
    const randomDescription = descriptions[Math.floor(Math.random() * descriptions.length)];

    const game: LiveGameSession = {
        id: gameId,
        mode, settings, description: randomDescription, player1: challenger, player2: opponent, isAiGame,
        gameCategory: GameCategory.Normal,  // 일반 게임은 normal 카테고리
        // 랭킹전은 휴먼 vs 휴만 적용. AI 대국·길드전 등은 협상에 isRanked가 없거나 false.
        isRankedGame: Boolean(neg.isRanked) && !isAiGame,
        boardState: Array(settings.boardSize).fill(0).map(() => Array(settings.boardSize).fill(types.Player.None)),
        moveHistory: [], captures: { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 },
        baseStoneCaptures: { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 }, 
        hiddenStoneCaptures: { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 },
        winner: null, winReason: null, createdAt: now, lastMove: null, passCount: 0, koInfo: null,
        winningLine: null, statsUpdated: false,
        blackTimeLeft: (settings.timeLimit ?? 0) * 60,
        whiteTimeLeft: (settings.timeLimit ?? 0) * 60,
        blackByoyomiPeriodsLeft: Math.max(1, settings.byoyomiCount ?? 1),
        whiteByoyomiPeriodsLeft: Math.max(1, settings.byoyomiCount ?? 1),
        disconnectionState: null, disconnectionCounts: { [challenger.id]: 0, [opponent.id]: 0 },
        currentActionButtons: { [challenger.id]: [], [opponent.id]: [] },
        actionButtonCooldownDeadline: {},
        actionButtonUsedThisCycle: { [challenger.id]: false, [opponent.id]: false },
        missileUsedThisTurn: false,
        maxActionButtonUses: 5, actionButtonUses: { [challenger.id]: 0, [opponent.id]: 0 },
        round: 1, turnInRound: 1, newlyRevealed: [], scores: { [challenger.id]: 0, [opponent.id]: 0 },
        analysisResult: null, isAnalyzing: false,
        gameStatus: 'pending', blackPlayerId: null, whitePlayerId: null, currentPlayer: types.Player.None,
        gameStartTime: undefined, // 게임이 실제로 시작될 때 설정됨
    };

    if (neg.adventureBattle) {
        game.gameCategory = GameCategory.Adventure;
        game.adventureStageId = neg.adventureBattle.stageId;
        game.adventureMonsterCodexId = neg.adventureBattle.codexId;
        game.adventureMonsterLevel = neg.adventureBattle.level;
        game.adventureMonsterBattleMode = neg.adventureBattle.battleMode;
        if (typeof neg.adventureBattle.boardSize === 'number') {
            game.adventureBoardSize = neg.adventureBattle.boardSize;
        }
    }

    // AI 게임은 대국실 입장 후 "경기 시작" 확인을 받아야 시작되므로,
    // 생성 시에는 항상 pending 상태로 유지하고, 실제 초기화는 CONFIRM_AI_GAME_START에서 수행합니다.
    if (!isAiGame) {
        if (SPECIAL_GAME_MODES.some(m => m.mode === mode)) {
            await initializeStrategicGame(game, neg, now);
        } else if (PLAYFUL_GAME_MODES.some((m: { mode: GameMode; }) => m.mode === mode)) {
            await initializePlayfulGame(game, neg, now);
        }
    }
    
    if (game.gameStatus === 'playing' && game.currentPlayer === types.Player.None) {
        game.currentPlayer = types.Player.Black;
        if (settings.timeLimit > 0) game.turnDeadline = now + game.blackTimeLeft * 1000;
        game.turnStartTime = now;
    }
    
    return game;
};

export const resetGameForRematch = (game: LiveGameSession, negotiation: types.Negotiation): LiveGameSession => {
    const newGame = { ...game, id: `game-${randomUUID()}` };

    newGame.mode = negotiation.mode;
    newGame.settings = negotiation.settings;
    // 게임 카테고리는 원래 게임의 카테고리 유지 (일반 게임의 리매치는 일반 게임)
    newGame.gameCategory = game.gameCategory ?? GameCategory.Normal;
    
    const now = Date.now();
    const baseFields = {
        winner: null, winReason: null, statsUpdated: false, summary: undefined, finalScores: undefined,
        winningLine: null,
        boardState: Array(newGame.settings.boardSize).fill(0).map(() => Array(newGame.settings.boardSize).fill(types.Player.None)),
        moveHistory: [], captures: { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 }, 
        baseStoneCaptures: { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 }, 
        hiddenStoneCaptures: { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 }, 
        lastMove: null, passCount: 0, koInfo: null,
        blackTimeLeft: (newGame.settings.timeLimit ?? 0) * 60,
        whiteTimeLeft: (newGame.settings.timeLimit ?? 0) * 60,
        blackByoyomiPeriodsLeft: Math.max(1, newGame.settings.byoyomiCount ?? 1),
        whiteByoyomiPeriodsLeft: Math.max(1, newGame.settings.byoyomiCount ?? 1),
        currentActionButtons: { [game.player1.id]: [], [game.player2.id]: [] },
        actionButtonCooldownDeadline: {},
        actionButtonUsedThisCycle: { [game.player1.id]: false, [game.player2.id]: false },
        missileUsedThisTurn: false,
        actionButtonUses: { [game.player1.id]: 0, [game.player2.id]: 0 },
        isAnalyzing: false, analysisResult: null, round: 1, turnInRound: 1,
        scores: { [game.player1.id]: 0, [game.player2.id]: 0 },
        rematchRejectionCount: undefined,
        disconnectionState: null,
        disconnectionCounts: { [game.player1.id]: 0, [game.player2.id]: 0 },
    };

    Object.assign(newGame, baseFields);

    if (SPECIAL_GAME_MODES.some(m => m.mode === newGame.mode)) {
        initializeStrategicGame(newGame, negotiation, now);
    } else if (PLAYFUL_GAME_MODES.some((m: { mode: GameMode }) => m.mode === newGame.mode)) {
        initializePlayfulGame(newGame, negotiation, now);
    }
    
    return newGame;
};

export const updateGameStates = async (games: LiveGameSession[], now: number): Promise<LiveGameSession[]> => {
    // 빈 배열이면 즉시 반환
    if (!games || games.length === 0) {
        return [];
    }

    try {
        // PVE 게임은 일반적으로 제외. 단, 다음 경우 서버 루프에서 처리 필요:
        // - hidden_final_reveal / hidden_reveal_animating: 애니메이션 종료 후 scoring 전환
        // - missile_animating / scanning_animating: 애니메이션 종료 후 playing 전환 (도전의 탑 등)
        const multiPlayerGames: LiveGameSession[] = [];
        for (const game of games) {
            if (!game || !game.id) continue;
            const isPVEGame = game.isSinglePlayer || game.gameCategory === 'tower' || game.gameCategory === 'singleplayer';
            const needsRevealTransition = isPVEGame && (game.gameStatus === 'hidden_final_reveal' || game.gameStatus === 'hidden_reveal_animating');
            const needsMissileOrScanTransition = isPVEGame && (game.gameStatus === 'missile_animating' || game.gameStatus === 'scanning_animating');
            if (!isPVEGame || needsRevealTransition || needsMissileOrScanTransition) {
                multiPlayerGames.push(game);
            }
        }

        if (multiPlayerGames.length === 0) {
            return games;
        }

        // 주기당 1게임만 처리 → 사이클당 ~4초 이내 완료, 25초 타임아웃 방지
        const MAX_GAMES_PER_CYCLE = 1;
        let roundRobinOffset = (global as any).__updateGameStatesRoundRobin ?? 0;
        const toProcess: LiveGameSession[] = multiPlayerGames.length <= MAX_GAMES_PER_CYCLE
            ? multiPlayerGames
            : (() => {
                const start = roundRobinOffset % multiPlayerGames.length;
                const a = multiPlayerGames.slice(start, start + MAX_GAMES_PER_CYCLE);
                const b = multiPlayerGames.slice(0, Math.max(0, MAX_GAMES_PER_CYCLE - a.length));
                (global as any).__updateGameStatesRoundRobin = (roundRobinOffset + a.length + b.length) % multiPlayerGames.length;
                return [...a, ...b];
            })();

        // 게임 수가 적을 때는 바둑 AI 등 느린 처리 완료 허용 (MainLoop 타임아웃과 조화)
        // 단일 게임: getCachedGame/DB 지연 + 지연된 setImmediate(makeAiMove)까지 고려해 여유 확보 (이전 12s는 Kata·DB 복합 시 outer가 먼저 승리하는 경우가 있었음)
        const OUTER_DEADLINE_MS = toProcess.length === 1 ? 22000 : toProcess.length <= 2 ? 9000 : toProcess.length <= 3 ? 6000 : 2500;
        const outerTimeout = new Promise<LiveGameSession[]>((resolve) => {
            setTimeout(() => {
                // 로그를 덜 자주 출력 (30초마다 한 번만)
                const shouldLog = !(global as any).lastUpdateGameStatesTimeoutLog || (Date.now() - (global as any).lastUpdateGameStatesTimeoutLog > 30000);
                if (shouldLog) {
                    console.warn(`[updateGameStates] Outer timeout (${OUTER_DEADLINE_MS}ms) reached, returning original games`);
                    (global as any).lastUpdateGameStatesTimeoutLog = Date.now();
                }
                resolve(games);
            }, OUTER_DEADLINE_MS);
        });

        const inner = (async (): Promise<LiveGameSession[]> => {
            const startTime = Date.now();
            // 즉시 yield하여 4초/25초 타임아웃이 스케줄된 뒤 실행되도록 함 (이벤트 루프 블로킹 시에도 타임아웃 동작)
            await new Promise<void>((r) => setImmediate(r));
            
            // 타임아웃 체크: 이미 시간이 초과했으면 즉시 반환
            if (Date.now() - startTime >= OUTER_DEADLINE_MS) {
                return games;
            }
            
            // 플레이어 캐시 프리웜 (1초 내 완료, 더 엄격하게)
            const { getCachedUser } = await import('./gameCache.js');
            const playerIds = new Set<string>();
            for (const g of toProcess) {
                if (g?.player1?.id && g.player1.id !== aiUserId) playerIds.add(g.player1.id);
                if (g?.player2?.id && g.player2.id !== aiUserId) playerIds.add(g.player2.id);
            }
            const PREWARM_DEADLINE_MS = 600; // 플레이어 캐시 프리웜 상한 (타임아웃 방지)
            const prewarmTimeout = new Promise<void>((resolve) => setTimeout(resolve, PREWARM_DEADLINE_MS));
            await Promise.race([
                Promise.allSettled(Array.from(playerIds).map((id) => getCachedUser(id))),
                prewarmTimeout
            ]);

            // 타임아웃 체크: 프리웜 후 시간 확인
            if (Date.now() - startTime >= OUTER_DEADLINE_MS) {
                return games;
            }

            const BATCH_SIZE = 1;
            const results: LiveGameSession[] = [];
            // 단일 게임 시 processGame이 getCachedGame 등으로 길어져도 배치 레이스가 먼저 끊지 않도록 outer에 맞춤 (5s 고정은 DB 지연 시 불필요한 조기 반환 유발)
            const BATCH_DEADLINE_MS =
                toProcess.length === 1
                    ? Math.min(OUTER_DEADLINE_MS - 500, 20000)
                    : Math.min(OUTER_DEADLINE_MS - 500, 5000);
            // 게임 수가 적을 때는 AI(바둑 등) 한 수에 시간 허용; 많을 때만 짧게
            const GAME_DEADLINE_MS = toProcess.length <= 2 ? 10000 : toProcess.length <= 3 ? 4000 : 800;

            for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
                // 타임아웃 체크: 각 배치 전 시간 확인
                if (Date.now() - startTime >= OUTER_DEADLINE_MS) {
                    break;
                }
                
                const batch = toProcess.slice(i, i + BATCH_SIZE);
                const batchTimeout = new Promise<LiveGameSession[]>((resolve) => {
                    setTimeout(() => resolve(batch), BATCH_DEADLINE_MS);
                });

                const processGameWithTimeout = async (game: LiveGameSession): Promise<LiveGameSession> => {
                    const gameStartTime = Date.now();
                    let timeoutOccurred = false;
                    const gameTimeout = new Promise<LiveGameSession>((resolve) => {
                        setTimeout(() => {
                            timeoutOccurred = true;
                            resolve(game);
                        }, GAME_DEADLINE_MS);
                    });
                    try {
                        const result = await Promise.race([
                            processGame(game, now),
                            gameTimeout
                        ]);
                        const duration = Date.now() - gameStartTime;
                        if (timeoutOccurred && duration >= GAME_DEADLINE_MS * 0.9) {
                            console.warn(`[updateGameStates] Game ${game.id} processing timeout after ${duration}ms (limit: ${GAME_DEADLINE_MS}ms)`);
                        }
                        return result;
                    } catch (error: any) {
                        console.error(`[updateGameStates] Error processing game ${game.id}:`, {
                            message: error?.message || String(error),
                            stack: error?.stack,
                            gameStatus: game.gameStatus,
                            mode: game.mode
                        });
                        return game;
                    }
                };

                const batchResults = await Promise.race([
                    Promise.all(batch.map(processGameWithTimeout)),
                    batchTimeout
                ]);
                results.push(...batchResults);
                
                // 타임아웃 체크: 배치 처리 후 시간 확인
                if (Date.now() - startTime >= OUTER_DEADLINE_MS) {
                    break;
                }
            }

            const processedMap = new Map<string, LiveGameSession>();
            for (const g of results) processedMap.set(g.id, g);
            const mergedMultiPlayer = multiPlayerGames.map(g => processedMap.get(g.id) ?? g);
            const mergedIds = new Set(mergedMultiPlayer.map(g => g.id));
            // 동일 PVE 게임을 merged 뒤에 다시 넣으면 Map 병합 시 스냅샷이 덮어써져 hidden_final_reveal→scoring 등이 되돌아가는 버그가 난다.
            const pveGames = games.filter(game => {
                if (!game || !game.id) return false;
                if (mergedIds.has(game.id)) return false;
                return game.isSinglePlayer || game.gameCategory === 'tower' || game.gameCategory === 'singleplayer';
            });
            return [...mergedMultiPlayer, ...pveGames];
        })();

        return await Promise.race([inner, outerTimeout]);
    } catch (error: any) {
        // 더 자세한 에러 정보 출력
        console.error('[updateGameStates] Fatal error:', {
            message: error?.message || String(error),
            stack: error?.stack,
            name: error?.name,
            gamesCount: games?.length || 0
        });
        return games; // 치명적 에러 발생 시 원본 게임들 반환
    }
};

const processGame = async (game: LiveGameSession, now: number): Promise<LiveGameSession> => {
        // pending 상태의 게임은 아직 시작되지 않았으므로 게임 루프에서 처리하지 않음
        if (game.gameStatus === 'pending') {
            return game;
        }

        // scoring 상태인 게임은 업데이트하지 않음 (계가 진행 중) - 가장 먼저 체크
        if (game.gameStatus === 'scoring' || (game as any).isScoringProtected) {
            return game;
        }

        // PLACE_STONE 직후 같은 메인루프 사이클에서 스냅샷(이전 상태)으로 처리되면
        // currentPlayer가 아직 human이라 시간패가 잘못 적용되는 버그 방지: 캐시에서 최신 게임 사용
        const { getCachedGame } = await import('./gameCache.js');
        const GET_CACHED_GAME_DEADLINE_MS = 2500;
        const cached = await Promise.race([
            getCachedGame(game.id),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), GET_CACHED_GAME_DEADLINE_MS)),
        ]);
        if (cached) {
            game = cached;
        }

        try {
            if (game.disconnectionState && (now - game.disconnectionState.timerStartedAt > 90000)) {
                // 90초 내에 재접속하지 못하면 시간패배 처리
                game.winner = game.blackPlayerId === game.disconnectionState.disconnectedPlayerId ? types.Player.White : types.Player.Black;
                game.winReason = 'timeout';
                game.gameStatus = 'ended';
                game.disconnectionState = null;
                // endGame 호출에도 타임아웃 추가 (DB 저장 지연 방지)
                const END_GAME_DEADLINE_MS = 1000;
                const endGameTimeout = new Promise<void>((resolve) => setTimeout(resolve, END_GAME_DEADLINE_MS));
                await Promise.race([
                    summaryService.endGame(game, game.winner, 'timeout'),
                    endGameTimeout
                ]).catch((error: any) => {
                    console.error(`[processGame] Error ending game ${game.id}:`, error?.message || error);
                });
            }

            if (game.lastTimeoutPlayerIdClearTime && now >= game.lastTimeoutPlayerIdClearTime) {
                game.lastTimeoutPlayerId = null;
                game.lastTimeoutPlayerIdClearTime = undefined;
            }

            // Add null checks for players to prevent crashes on corrupted game data.
            if (!game.player1 || !game.player2) {
                console.warn(`[Game Loop] Skipping corrupted game ${game.id} with missing player data.`);
                return game;
            }

            // PVE 게임은 이미 updateGameStates에서 필터링되었으므로 여기서는 처리하지 않음
            // 이 함수는 멀티플레이어 게임만 처리함

            // 멀티플레이 게임 처리: 유저 로드는 짧은 타임아웃으로 DB 지연 시 블로킹 방지 (MainLoop 경량화)
            // 캐시된 유저가 이미 있으면 로드 스킵하여 속도 향상
            const { getCachedUser } = await import('./gameCache.js');
            const USER_LOAD_DEADLINE_MS = 500; // 600ms -> 500ms로 단축하여 더 빠르게 타임아웃
            const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
                Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
            
            // 유저 데이터가 이미 있으면 로드 스킵 (성능 최적화)
            const needsP1Load = !game.player1 || !game.player1.nickname;
            const needsP2Load = game.player2.id !== aiUserId && (!game.player2 || !game.player2.nickname);
            
            const guildWarBoardId = (game as any).gameCategory === 'guildwar' ? ((game as any).guildWarBoardId as string | undefined) : undefined;
            const aiUserResolved =
                guildWarBoardId && String(guildWarBoardId).length > 0
                    ? getAiUserForGuildWar(game.mode, guildWarBoardId)
                    : getAiUser(game.mode);

            if (needsP1Load || needsP2Load) {
                const [p1, p2] = await Promise.all([
                    needsP1Load ? withTimeout(getCachedUser(game.player1.id), USER_LOAD_DEADLINE_MS, null) : Promise.resolve(null),
                    game.player2.id === aiUserId ? Promise.resolve(aiUserResolved) : (needsP2Load ? withTimeout(getCachedUser(game.player2.id), USER_LOAD_DEADLINE_MS, null) : Promise.resolve(null))
                ]);
                if (p1) game.player1 = p1;
                if (p2) game.player2 = p2;
            } else if (game.player2.id === aiUserId) {
                // AI 유저는 항상 최신 상태로 유지
                game.player2 = aiUserResolved;
            }

            const players = [game.player1, game.player2].filter(p => p.id !== aiUserId);

            // AI 세션을 현재 게임 상태와 동기화 (재시작/재연결 시 안전 장치)
            syncAiSession(game, aiUserId);

            const playableStatuses: types.GameStatus[] = [
                'playing', 'hidden_placing', 'scanning', 'missile_selecting',
                'alkkagi_playing',
                'curling_playing',
                'dice_rolling',
                'dice_placing',
                'thief_rolling',
                'thief_placing',
            ];

            if (playableStatuses.includes(game.gameStatus)) {
                // Ensure maps are initialized before per-player writes
                if (!game.currentActionButtons) game.currentActionButtons = {};
                if (!game.actionButtonCooldownDeadline) game.actionButtonCooldownDeadline = {};
                if (!game.actionButtonUsedThisCycle) game.actionButtonUsedThisCycle = {};

                for (const player of players) {
                    const deadline = game.actionButtonCooldownDeadline?.[player.id];
                    if (typeof deadline !== 'number' || now >= deadline) {
                        game.currentActionButtons[player.id] = getNewActionButtons(game);

                        const effects = effectService.calculateUserEffects(player);
                        const cooldown = (5 * 60 - (effects.mythicStatBonuses[types.MythicStat.MannerActionCooldown]?.flat || 0)) * 1000;

                        game.actionButtonCooldownDeadline[player.id] = now + cooldown;
                        game.actionButtonUsedThisCycle[player.id] = false;
                    }
                }
            }

            const isManuallyPaused = game.isAiGame && game.pausedTurnTimeLeft !== undefined && !game.turnDeadline && !game.itemUseDeadline;

            // 게임 상태 업데이트를 먼저 실행하여 애니메이션 완료 후 턴 전환을 처리
            // 중요: 게임 상태 업데이트를 먼저 실행해야 애니메이션 완료 후 턴 전환이 제대로 처리됨
            // 타임아웃 추가: 게임 상태 업데이트가 너무 오래 걸리면 스킵
            if (game.gameStatus !== 'ended' && game.gameStatus !== 'no_contest' && game.gameStatus !== 'scoring') {
                const STATE_UPDATE_DEADLINE_MS = 600; // 게임 상태 업데이트 600ms 타임아웃 (800ms -> 600ms로 단축)
                const stateUpdateTimeout = new Promise<void>((resolve) => setTimeout(resolve, STATE_UPDATE_DEADLINE_MS));
                try {
                    if (SPECIAL_GAME_MODES.some(m => m.mode === game.mode)) {
                        await Promise.race([
                            updateStrategicGameState(game, now),
                            stateUpdateTimeout
                        ]);
                    } else if (PLAYFUL_GAME_MODES.some((m: { mode: GameMode }) => m.mode === game.mode)) {
                        await Promise.race([
                            updatePlayfulGameState(game, now),
                            stateUpdateTimeout
                        ]);
                    }
                } catch (error: any) {
                    // 에러 로그를 덜 자주 출력 (30초마다 한 번만)
                    const shouldLog = !(global as any).lastProcessGameErrorLog || (Date.now() - (global as any).lastProcessGameErrorLog > 30000);
                    if (shouldLog) {
                        console.error(`[processGame] Error updating game state for ${game.id}:`, error?.message || error);
                        (global as any).lastProcessGameErrorLog = Date.now();
                    }
                    // 에러 발생 시 게임 상태 업데이트 스킵하고 계속 진행
                }
                // 초읽기 진입/리셋 시 클라이언트가 풀 초부터 표시하도록 즉시 브로드캐스트
                if ((game as any)._broadcastByoyomiStart) {
                    delete (game as any)._broadcastByoyomiStart;
                    try {
                        const { broadcastToGameParticipants } = await import('./socket.js');
                        const payload = { ...game };
                        delete (payload as any).boardState;
                        broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: payload } }, game);
                    } catch (e: any) {
                        console.warn(`[processGame] Byoyomi start broadcast failed for ${game.id}:`, e?.message);
                    }
                }
            }

            // 게임 상태 업데이트 후 AI 턴 처리 (애니메이션 완료로 턴이 전환되었을 수 있음)
            const currentPlayerIdForAi = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
            const isAiPlayerTurn = currentPlayerIdForAi === aiUserId ||
                (currentPlayerIdForAi && String(currentPlayerIdForAi).startsWith('dungeon-bot-'));
            const useClientSideAi = (game.settings as any)?.useClientSideAi === true;
            const isGoMode =
                game.mode === types.GameMode.Standard ||
                game.mode === types.GameMode.Capture ||
                game.mode === types.GameMode.Speed ||
                game.mode === types.GameMode.Base ||
                game.mode === types.GameMode.Hidden ||
                game.mode === types.GameMode.Missile ||
                game.mode === types.GameMode.Mix;
            // 놀이바둑은 서버가 애니메이션/물리/랜덤 등을 처리해야 하므로 client-side AI를 사용하지 않음 (설정이 실수로 켜져도 무시)
            const effectiveUseClientSideAi = useClientSideAi && isGoMode;
            const isAiTurn = (game.isAiGame || isAiPlayerTurn) && !isManuallyPaused && game.currentPlayer !== types.Player.None &&
                isAiPlayerTurn &&
                // 클라이언트 측 AI(Electron 로컬 GnuGo) 사용 시에만 서버에서 makeAiMove 호출하지 않음. useClientSideAi가 false면 탑/전략바둑 모두 서버 AI 사용.
                !effectiveUseClientSideAi;

            // 알까기: 배치→공격 전환 직후 AI 공격 1회 확실히 스케줄 (round-robin 등으로 놓치는 것 방지)
            const didAlkkagiTriggerAiAttack = (game as any).alkkagiTriggerAiAttack === true &&
                game.mode === types.GameMode.Alkkagi && game.gameStatus === 'alkkagi_playing' && isAiTurn;
            if (didAlkkagiTriggerAiAttack) {
                (game as any).alkkagiTriggerAiAttack = false;
                const gameId = game.id;
                setImmediate(() => {
                    makeAiMove(game).then(async () => {
                        try {
                            const { updateGameCache } = await import('./gameCache.js');
                            updateGameCache(game);
                            db.saveGame(game).catch((err: any) => console.error(`[processGame] Alkkagi post-placement AI save failed ${gameId}:`, err?.message));
                            const { broadcastToGameParticipants } = await import('./socket.js');
                            broadcastToGameParticipants(gameId, { type: 'GAME_UPDATE', payload: { [gameId]: game } }, game);
                        } catch (e: any) {
                            console.error(`[processGame] Alkkagi post-placement AI broadcast failed ${gameId}:`, e?.message);
                        }
                    }).catch((err: any) => {
                        console.error(`[processGame] Alkkagi post-placement makeAiMove failed ${gameId}:`, err?.message);
                    });
                });
            }

            // 멀티플레이 AI 게임의 경우에만 메인 루프에서 AI 수 처리
            // 놀이바둑 모드별로 AI가 행동할 수 있는 gameStatus 모두 허용
            const playfulPlacementStatuses = ['alkkagi_placement', 'alkkagi_simultaneous_placement', 'thief_rolling', 'thief_placing'];
            const playfulPlayingStatuses = ['alkkagi_playing', 'curling_playing', 'dice_rolling', 'dice_placing', 'dice_turn_rolling', 'dice_turn_choice', 'dice_start_confirmation'];
            const animatingStatuses = ['missile_animating', 'hidden_reveal_animating', 'alkkagi_animating', 'curling_animating', 'thief_rolling_animating', 'dice_rolling_animating', 'dice_turn_rolling_animating'];
            const canProcessAiTurn = isAiTurn && game.gameStatus !== 'ended' && 
                !animatingStatuses.includes(game.gameStatus) &&
                (game.gameStatus === 'playing' || playfulPlacementStatuses.includes(game.gameStatus) || playfulPlayingStatuses.includes(game.gameStatus));
            
            if (canProcessAiTurn && !didAlkkagiTriggerAiAttack) {
                if (!game.aiTurnStartTime || game.aiTurnStartTime === undefined) {
                    game.aiTurnStartTime = now;
                }
                if (now >= game.aiTurnStartTime) {
                    // 근본 원인 수정: makeAiMove 내부의 동기 무거운 연산(goAiBot)이 이벤트 루프를 25초 이상 블로킹하여
                    // 타임아웃이 동작하지 않음. 메인 루프에서는 기다리지 않고 setImmediate로 지연 실행하여
                    // updateGameStates가 즉시 반환되도록 함. 완료 시 캐시/저장/브로드캐스트는 콜백에서 수행.
                    const gameId = game.id;
                    const initialMoveCount = game.moveHistory?.length ?? 0;
                    setImmediate(() => {
                        makeAiMove(game).then(async () => {
                            const moveCountAfter = game.moveHistory?.length ?? 0;
                            const aiActuallyMoved = moveCountAfter > initialMoveCount;
                            if (aiActuallyMoved) {
                                game.aiTurnStartTime = undefined;
                                if (!game.turnStartTime) game.turnStartTime = Date.now();
                            } else {
                                game.aiTurnStartTime = Date.now() + 50;
                            }
                            try {
                                const { updateGameCache } = await import('./gameCache.js');
                                updateGameCache(game);
                                db.saveGame(game).catch((err: any) => console.error(`[processGame] Deferred save failed ${gameId}:`, err?.message));
                                const { broadcastToGameParticipants } = await import('./socket.js');
                                // AI 수 반영 직후 브로드캐스트 시 boardState 포함하여 전송 (클라이언트에서 AI가 둔 수가 사라지는 버그 방지)
                                const payloadGame = game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0
                                    ? { ...game, boardState: game.boardState.map((row: number[]) => [...row]) }
                                    : game;
                                broadcastToGameParticipants(gameId, { type: 'GAME_UPDATE', payload: { [gameId]: payloadGame } }, game);
                            } catch (e: any) {
                                console.error(`[processGame] Deferred AI broadcast failed ${gameId}:`, e?.message);
                            }
                        }).catch((error) => {
                            console.error(`[processGame] Deferred makeAiMove failed for game ${gameId}:`, error);
                            game.aiTurnStartTime = Date.now() + 1000;
                        });
                    });
                    // 이번 사이클에서는 AI 수를 기다리지 않고 즉시 반환 → 타임아웃 방지
                }
            } else if (isAiTurn && animatingStatuses.includes(game.gameStatus)) {
                // 애니메이션 중인 경우에도 aiTurnStartTime을 유지하거나 설정
                // (애니메이션이 끝나면 canProcessAiTurn이 true가 되어 AI 수가 실행됨)
                if (!game.aiTurnStartTime) {
                    game.aiTurnStartTime = now;
                }
            }

            return game;
        } catch (error) {
            console.error(`[Game Loop] Failed to update game ${game.id}:`, error);
            return game;
        }
};
