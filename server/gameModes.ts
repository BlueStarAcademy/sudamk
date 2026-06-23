
import { getGoLogic } from './goLogic.js';
import { NO_CONTEST_MOVE_THRESHOLD, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, STRATEGIC_ACTION_BUTTONS_EARLY, STRATEGIC_ACTION_BUTTONS_MID, STRATEGIC_ACTION_BUTTONS_LATE, PLAYFUL_ACTION_BUTTONS_EARLY, PLAYFUL_ACTION_BUTTONS_MID, PLAYFUL_ACTION_BUTTONS_LATE, RANDOM_DESCRIPTIONS, ALKKAGI_TURN_TIME_LIMIT, ALKKAGI_PLACEMENT_TIME_LIMIT, getScoringTurnLimitOptionsByBoardSize, PLAYFUL_AI_BATCH_STONE_INTERVAL_MS, MANNER_ACTION_BUTTON_CHOICE_COUNT } from '../constants';
import * as types from '../types/index.js';
import { analyzeGame, getScoringKataGoLimits } from './kataGoService.js';
import type { LiveGameSession, AppState, Negotiation, ActionButton, GameMode } from '../types/index.js';
import { GameCategory } from '../types/enums.js';
import { aiUserId, makeAiMove, getAiUser, getAiUserForGuildWar } from './aiPlayer.js';
import { syncAiSession } from './aiSessionManager.js';
// FIX: The imported functions were not found. They are now exported from `standard.ts` with the correct names.
import { initializeStrategicGame, updateStrategicGameState } from './modes/standard.js';
import { applyHumanPvpStrategicSettingsInvariants } from './modes/pvpStrategicPipeline.js';
import { sanitizePvpGameSettings } from '../shared/utils/sanitizePvpGameSettings.js';
import { initializePlayfulGame, updatePlayfulGameState } from './modes/playful.js';
import { randomUUID } from 'crypto';
import * as db from './db.js';
import * as effectService from './effectService.js';
import { endGame } from './summaryService.js';
import { getStoneCapturePointValueForScoring } from '../shared/utils/scoringStonePoints.js';
import {
    applyPreservedChessGoFieldsFromState,
    prepareChessGoSessionForScoring,
    sessionUsesChessGo,
} from '../shared/utils/chessGoRules.js';
import { TOWER_AI_BOT_DISPLAY_NAME } from '../constants/towerConstants.js';
import {
    isAiInitialHiddenSoftFoundByAnyPlayer,
    isHiddenMoveIndexSoftRevealedByAnyPlayer,
} from './modes/hiddenScanShared.js';
import {
    getCurrentPairTurnSeat,
    isPairAiSeat,
    isPairClassicGame,
    isPairCooperativeTwoHumansVsAi,
    PAIR_GO_GAME_MODES,
} from '../shared/utils/pairGameTurn.js';
import { PVP_DISCONNECT_REJOIN_GRACE_MS } from '../shared/utils/pvpDisconnectPolicy.js';
import { aiProcessingQueue } from './aiProcessingQueue.js';
import {
    getSpeedTimeBonusPointsDesired,
    isSessionSpeedTimePressureMode,
    SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT,
} from './utils/speedTimePressureLiveCaptures.js';
import { modeIncludesCaptureRule, resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';
import { isAiLobbyManualClockPause } from './modes/shared.js';
import { maybeRecoverStalledPveAiTurn, needsPveAiWatchdogTick } from './utils/pveAiTurnWatchdog.js';

// 정확한 계가 결과는 1회만 표시한다는 전제 하에,
// KataGo 분석을 `scoring` 브로드캐스트·클라이언트 계가 UI보다 앞서 백그라운드로 시작한다.
// - 히든돌 최종 공개 애니메이션 중 + 일반 계가 직전 `startScoringKataGoPrecomputeIfNeeded`
// - `runAnalysisWithRetries`는 동일 gameId의 프리컴퓨트 Promise를 재사용
// - 클라이언트는 연출(착점·따낸 점수·계가 중 오버레이) 후에 영토/결과를 표시
type ScoringPrecomputeEntry = {
    startedAt: number;
    promise: Promise<types.AnalysisResult>;
    preservedGameState?: Record<string, unknown>;
    preservedTimeInfo?: {
        blackTimeLeft?: number;
        whiteTimeLeft?: number;
        blackInitialTimeLeft?: number;
        whiteInitialTimeLeft?: number;
    };
};

const scoringPrecompute = new Map<string, ScoringPrecomputeEntry>();
const PRECOMPUTE_TTL_MS = 60_000;

function cleanupScoringPrecompute(nowMs: number): void {
    if (scoringPrecompute.size === 0) return;
    for (const [gameId, entry] of scoringPrecompute.entries()) {
        if (!entry || (nowMs - entry.startedAt) > PRECOMPUTE_TTL_MS) {
            scoringPrecompute.delete(gameId);
        }
    }
}

export function invalidateScoringPrecompute(gameId: string): void {
    scoringPrecompute.delete(gameId);
}

function isAnticipatedScoringPrecomputeEligible(game: types.LiveGameSession): boolean {
    if (game.isSinglePlayer || game.gameCategory === 'tower' || game.gameCategory === 'singleplayer') {
        return false;
    }
    if (game.gameStatus !== 'playing') return false;
    const policy = resolveArenaSessionPolicy(game);
    return policy.matchAxis === 'pvp' && game.winReason !== 'resign';
}

/**
 * 상대 패스 대기 중(첫 패스 직후) KataGo를 미리 돌려, 상호 패스 시 계가 결과를 더 빨리 낸다.
 * 착수로 passCount가 리셋되면 `invalidateScoringPrecompute`로 무효화한다.
 */
export function maybeStartAnticipatedScoringPrecompute(game: types.LiveGameSession): void {
    if (!isAnticipatedScoringPrecomputeEligible(game)) return;
    if ((game.passCount ?? 0) < 1) return;
    startScoringKataGoPrecomputeIfNeeded(game, 'anticipated_first_pass');
}

async function broadcastScoringAnalysisWhenReady(
    gameId: string,
    baseAnalysis: types.AnalysisResult,
    entry?: ScoringPrecomputeEntry,
): Promise<void> {
    const { getCachedGame, updateGameCache } = await import('./gameCache.js');
    let freshGame = await getCachedGame(gameId);
    if (!freshGame) {
        freshGame = await db.getLiveGame(gameId);
    }
    if (!freshGame || freshGame.gameStatus !== 'scoring') return;
    if (freshGame.analysisResult?.['system']) return;

    const preservedState =
        (freshGame as { preservedGameState?: Record<string, unknown> }).preservedGameState ||
        entry?.preservedGameState;
    if (preservedState && typeof preservedState === 'object') {
        const ps = preservedState as Record<string, unknown>;
        if (Array.isArray(ps.moveHistory) && ps.moveHistory.length > 0) {
            freshGame.moveHistory = ps.moveHistory as types.LiveGameSession['moveHistory'];
        }
        if (Array.isArray(ps.boardState) && ps.boardState.length > 0) {
            freshGame.boardState = ps.boardState as types.LiveGameSession['boardState'];
        }
        if (ps.captures && typeof ps.captures === 'object') {
            freshGame.captures = ps.captures as types.LiveGameSession['captures'];
        }
        if (ps.totalTurns !== undefined) {
            freshGame.totalTurns = ps.totalTurns as number;
        }
        mergePreservedChessGoFieldsIntoSession(freshGame, ps);
    }

    prepareChessGoSessionForScoring(freshGame);

    const timeInfoToUse =
        entry?.preservedTimeInfo ||
        (freshGame as { preservedTimeInfo?: ScoringPrecomputeEntry['preservedTimeInfo'] }).preservedTimeInfo || {
            blackTimeLeft: freshGame.blackTimeLeft,
            whiteTimeLeft: freshGame.whiteTimeLeft,
            blackInitialTimeLeft: freshGame.blackInitialTimeLeft,
            whiteInitialTimeLeft: freshGame.whiteInitialTimeLeft,
        };
    const finalAnalysis = finalizeAnalysisResult(baseAnalysis, freshGame, timeInfoToUse);
    finalAnalysis.source = 'katago';
    finalAnalysis.isProvisional = false;

    if (!freshGame.analysisResult) freshGame.analysisResult = {};
    freshGame.analysisResult['system'] = finalAnalysis;
    freshGame.finalScores = {
        black: finalAnalysis.scoreDetails.black.total,
        white: finalAnalysis.scoreDetails.white.total,
    };
    freshGame.isAnalyzing = false;

    updateGameCache(freshGame);
    await db.saveGame(freshGame);

    const gameToBroadcast = {
        ...freshGame,
        moveHistory: preservedState?.moveHistory || freshGame.moveHistory,
        totalTurns: (preservedState?.totalTurns as number | undefined) ?? freshGame.totalTurns,
        blackTimeLeft: timeInfoToUse.blackTimeLeft ?? freshGame.blackTimeLeft,
        whiteTimeLeft: timeInfoToUse.whiteTimeLeft ?? freshGame.whiteTimeLeft,
        captures: preservedState?.captures || freshGame.captures,
        baseStoneCaptures: preservedState?.baseStoneCaptures || freshGame.baseStoneCaptures,
        hiddenStoneCaptures: preservedState?.hiddenStoneCaptures || freshGame.hiddenStoneCaptures,
    };
    if (!freshGame.isSinglePlayer) {
        delete (gameToBroadcast as { boardState?: unknown }).boardState;
    }
    const { broadcastToGameParticipants } = await import('./socket.js');
    broadcastToGameParticipants(
        freshGame.id,
        { type: 'GAME_UPDATE', payload: { [freshGame.id]: gameToBroadcast } },
        freshGame,
    );
    console.log(
        `[getGameResult] Early scoring analysis broadcast for game ${freshGame.id} (Black ${finalAnalysis.scoreDetails.black.total}, White ${finalAnalysis.scoreDetails.white.total})`,
    );
}

function startScoringKataGoPrecomputeCore(
    game: types.LiveGameSession,
    logLabel: string,
    meta?: Pick<ScoringPrecomputeEntry, 'preservedGameState' | 'preservedTimeInfo'>,
): void {
    cleanupScoringPrecompute(Date.now());
    const existing = scoringPrecompute.get(game.id);
    const nowMs = Date.now();
    if (existing && nowMs - existing.startedAt <= PRECOMPUTE_TTL_MS) {
        return;
    }
    scoringPrecompute.delete(game.id);
    const snapshot = JSON.parse(
        JSON.stringify({
            ...game,
            boardState: game.boardState,
            moveHistory: game.moveHistory,
        }),
    ) as types.LiveGameSession;
    prepareChessGoSessionForScoring(snapshot);
    finalizeHiddenStonesForScoring(snapshot);
    const scoringLim = getScoringKataGoLimits();
    let entry: ScoringPrecomputeEntry;
    const promise = analyzeGame(snapshot, {
        includePolicy: false,
        includeOwnership: true,
        maxVisits: scoringLim.maxVisits,
        maxTimeSec: scoringLim.maxTimeSec,
    })
        .then(async (baseAnalysis) => {
            await broadcastScoringAnalysisWhenReady(game.id, baseAnalysis, entry);
            return baseAnalysis;
        })
        .catch((e) => {
            throw e;
        });
    entry = {
        startedAt: nowMs,
        promise,
        preservedGameState: meta?.preservedGameState,
        preservedTimeInfo: meta?.preservedTimeInfo,
    };
    scoringPrecompute.set(game.id, entry);
    console.log(`[getGameResult] Started KataGo scoring precompute (${logLabel}) for game ${game.id}`);
}

/**
 * 계가 상태 브로드캐스트·UI 연출 전에 KataGo 분석을 백그라운드로 시작한다.
 * - 히든 최종 공개 애니 중(기존) + 일반 계가 직전(추가) 모두 동일 경로.
 * - 클라이언트에서 착점/따낸 점수/계가 중 오버레이를 보여주는 동안 서버가 결과를 준비한다.
 */
function startScoringKataGoPrecomputeIfNeeded(game: types.LiveGameSession, logLabel: string): void {
    const preservedGameState = (game as { preservedGameState?: Record<string, unknown> }).preservedGameState;
    const preservedTimeInfo = (game as { preservedTimeInfo?: ScoringPrecomputeEntry['preservedTimeInfo'] })
        .preservedTimeInfo;
    startScoringKataGoPrecomputeCore(game, logLabel, { preservedGameState, preservedTimeInfo });
}

function shouldDeferScoringForHiddenRevealAnimation(game: types.LiveGameSession, now: number): boolean {
    if (game.gameStatus !== 'hidden_final_reveal' && game.gameStatus !== 'hidden_reveal_animating') {
        return false;
    }
    if (!game.animation || game.animation.type !== 'hidden_reveal') {
        return false;
    }
    return typeof game.revealAnimationEndTime === 'number' && now < game.revealAnimationEndTime;
}

/**
 * 계가(Kata) 직전: 미공개 히든 착점을 최종 국면에 맞게 보드에 반영하고, 공개 목록·메타를 정리한다.
 * - analyzeGame은 boardState의 실돌만 전달하므로, 히든 플래그만 남고 칸이 비면 영토에서 빠질 수 있음
 * - 유저/상대 구분 없이 hiddenMoves에 남은 좌표를 처리한다
 */
function finalizeHiddenStonesForScoring(game: types.LiveGameSession): void {
    const isHiddenMode =
        game.mode === types.GameMode.Hidden ||
        (game.mode === types.GameMode.Mix && Boolean(game.settings.mixedModes?.includes(types.GameMode.Hidden)));
    if (!isHiddenMode || !game.moveHistory || !game.boardState) return;

    if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];

    if (game.hiddenMoves) {
        const keys = [...Object.keys(game.hiddenMoves)];
        for (const key of keys) {
            const i = parseInt(key, 10);
            if (!Number.isFinite(i) || i < 0 || i >= game.moveHistory.length) continue;
            if (!game.hiddenMoves[i]) continue;
            const m = game.moveHistory[i];
            if (!m || m.x < 0 || m.y < 0) continue;
            const { x, y } = m;
            const row = game.boardState[y];
            if (!row || row[x] === undefined) continue;
            const cell = row[x];
            const opponent = m.player === types.Player.Black ? types.Player.White : types.Player.Black;

            if (cell === m.player) {
                if (!game.permanentlyRevealedStones.some((p) => p.x === x && p.y === y)) {
                    game.permanentlyRevealedStones.push({ x, y });
                }
            } else if (cell === types.Player.None) {
                // 계가 직전에는 boardState를 절대 수정하지 않는다.
                // hiddenMoves 메타만으로 빈 칸을 복원하면, 이미 따낸 히든돌이 부활해
                // KataGo에 실제 최종 국면과 다른 판이 전달될 수 있다.
                delete game.hiddenMoves[i];
            } else if (cell === opponent) {
                delete game.hiddenMoves[i];
            }
        }
    }

    const ai = (game as any).aiInitialHiddenStone as { x: number; y: number } | undefined;
    if (ai && Number.isInteger(ai.x) && Number.isInteger(ai.y)) {
        const c = game.boardState[ai.y]?.[ai.x];
        if (c !== types.Player.None && c != null) {
            if (!game.permanentlyRevealedStones.some((p) => p.x === ai.x && p.y === ai.y)) {
                game.permanentlyRevealedStones.push({ x: ai.x, y: ai.y });
            }
        }
        (game as any).aiInitialHiddenStone = undefined;
        (game as any).aiInitialHiddenStoneIsPrePlaced = false;
    }
}

function mergePreservedChessGoFieldsIntoSession(
    session: types.LiveGameSession,
    preserved?: Record<string, unknown> | null,
): void {
    applyPreservedChessGoFieldsFromState(session, preserved);
}

export const finalizeAnalysisResult = (baseAnalysis: types.AnalysisResult, session: types.LiveGameSession, preservedTimeInfo?: { blackTimeLeft?: number, whiteTimeLeft?: number, blackInitialTimeLeft?: number, whiteInitialTimeLeft?: number }): types.AnalysisResult => {
    const finalAnalysis = JSON.parse(JSON.stringify(baseAnalysis)); // Deep copy
    prepareChessGoSessionForScoring(session);

    // 엔진(Kata/수동)이 넣은 territory는 「빈 교차점」만 센 값.
    // 한국식 집 계가: 상대 사석이 앉은 교차점도 집(영토) 1점으로 세고, 그 돌은 사석(따낸 돌)으로 또 점수에 넣는다
    // → scoreDetails.territory = 빈 집 + 상대 사석 개수(집 칸), deadStones = 가중 사석 점수, total = 영토+따낸+… .
    const emptyBlackT = Math.round(finalAnalysis.scoreDetails.black.territory);
    const emptyWhiteT = Math.round(finalAnalysis.scoreDetails.white.territory);

    let whiteDeadCount = 0;
    let blackDeadCount = 0;
    const boardState = session.boardState;
    if (finalAnalysis.deadStones && Array.isArray(finalAnalysis.deadStones) && boardState && Array.isArray(boardState) && boardState.length > 0) {
        let whiteDeadScore = 0;
        let blackDeadScore = 0;
        for (const p of finalAnalysis.deadStones as { x: number; y: number }[]) {
            const c = boardState[p.y]?.[p.x];
            if (c === types.Player.White) {
                whiteDeadCount += 1;
                whiteDeadScore += getStoneCapturePointValueForScoring(session, p, types.Player.White);
            } else if (c === types.Player.Black) {
                blackDeadCount += 1;
                blackDeadScore += getStoneCapturePointValueForScoring(session, p, types.Player.Black);
            }
        }
        finalAnalysis.scoreDetails.black.deadStones = Math.round(whiteDeadScore);
        finalAnalysis.scoreDetails.white.deadStones = Math.round(blackDeadScore);
    }

    finalAnalysis.scoreDetails.black.territory = emptyBlackT + whiteDeadCount;
    finalAnalysis.scoreDetails.white.territory = emptyWhiteT + blackDeadCount;

    // Base stone bonus
    finalAnalysis.scoreDetails.black.baseStoneBonus = 0;
    finalAnalysis.scoreDetails.white.baseStoneBonus = 0;

    // Hidden stone bonus
    finalAnalysis.scoreDetails.black.hiddenStoneBonus = 0;
    finalAnalysis.scoreDetails.white.hiddenStoneBonus = 0;
    
    // Time bonus (speed unified):
    // - PVP/AI/싱글 공통: 수당 10초 초과마다 해당 수에서 상대 +1점 (수 단위, 대국 전체 누적 아님)
    const isSpeedMode =
        session.mode === types.GameMode.Speed ||
        (session.mode === types.GameMode.Mix && session.settings.mixedModes?.includes(types.GameMode.Speed));
    if (isSpeedMode) {
        const nowMs = Date.now();
        const desired = getSpeedTimeBonusPointsDesired(session, nowMs);
        const penaltyCommitted = ((session.settings as any)?.__speedTurnPenaltyCommitted ?? {}) as { black?: number; white?: number };
        const committedBlackPenalty = Math.max(0, Number(penaltyCommitted.black ?? 0));
        const committedWhitePenalty = Math.max(0, Number(penaltyCommitted.white ?? 0));
        const grant = ((session.settings as any).__speedTimePressureGranted ?? {}) as { black?: number; white?: number };
        const gb = Math.max(0, Number(grant.black ?? 0));
        const gw = Math.max(0, Number(grant.white ?? 0));
        finalAnalysis.scoreDetails.black.timeBonus = Math.max(0, desired.blackBonus - gb);
        finalAnalysis.scoreDetails.white.timeBonus = Math.max(0, desired.whiteBonus - gw);
        console.log(
            `[finalizeAnalysisResult] Speed time bonus (unified): committedBlackPenalty=${committedBlackPenalty}, committedWhitePenalty=${committedWhitePenalty}, desiredBlack=${desired.blackBonus}, desiredWhite=${desired.whiteBonus}, grantedBlack=${gb}, grantedWhite=${gw}, timeBonusBlack=${finalAnalysis.scoreDetails.black.timeBonus}, timeBonusWhite=${finalAnalysis.scoreDetails.white.timeBonus} (secPerPoint=${SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT})`,
        );
    } else {
        finalAnalysis.scoreDetails.black.timeBonus = 0;
        finalAnalysis.scoreDetails.white.timeBonus = 0;
    }
    
    // Item bonus (currently none, placeholder)
    finalAnalysis.scoreDetails.black.itemBonus = 0;
    finalAnalysis.scoreDetails.white.itemBonus = 0;

    let chessBonusBlack = 0;
    let chessBonusWhite = 0;
    const chessCaptureAlreadyInCaptures = sessionUsesChessGo(session);
    if (chessCaptureAlreadyInCaptures) {
        chessBonusBlack = session.chessCaptureScore?.[types.Player.Black] ?? 0;
        chessBonusWhite = session.chessCaptureScore?.[types.Player.White] ?? 0;
        (finalAnalysis.scoreDetails.black as { chessCaptureBonus?: number }).chessCaptureBonus = chessBonusBlack;
        (finalAnalysis.scoreDetails.white as { chessCaptureBonus?: number }).chessCaptureBonus = chessBonusWhite;
    }

    // 모험 지역 이해도 시작 가산점은 `session.captures`에 이미 포함되어 scoreDetails.captures로 들어옴 (이중 가산 방지)

    // Recalculate totals: 집(영토) + 따낸 돌(사석) + … (집 칸과 사석 점수를 각각 가산)
    // 체스바둑: captures에 기물별 가중치가 이미 반영되어 chessCaptureBonus는 표시용만 사용
    const blackTotal =
        finalAnalysis.scoreDetails.black.territory +
        finalAnalysis.scoreDetails.black.captures +
        (finalAnalysis.scoreDetails.black.deadStones ?? 0) +
        finalAnalysis.scoreDetails.black.baseStoneBonus +
        finalAnalysis.scoreDetails.black.hiddenStoneBonus +
        finalAnalysis.scoreDetails.black.timeBonus +
        finalAnalysis.scoreDetails.black.itemBonus +
        (chessCaptureAlreadyInCaptures ? 0 : chessBonusBlack);
    const whiteTotal =
        finalAnalysis.scoreDetails.white.territory +
        finalAnalysis.scoreDetails.white.captures +
        finalAnalysis.scoreDetails.white.komi +
        (finalAnalysis.scoreDetails.white.deadStones ?? 0) +
        finalAnalysis.scoreDetails.white.baseStoneBonus +
        finalAnalysis.scoreDetails.white.hiddenStoneBonus +
        finalAnalysis.scoreDetails.white.timeBonus +
        finalAnalysis.scoreDetails.white.itemBonus +
        (chessCaptureAlreadyInCaptures ? 0 : chessBonusWhite);
    
    finalAnalysis.scoreDetails.black.total = blackTotal;
    finalAnalysis.scoreDetails.white.total = whiteTotal;
    
    finalAnalysis.areaScore.black = blackTotal;
    finalAnalysis.areaScore.white = whiteTotal;
    
    // 디버깅: 점수 계산 상세 로그
    console.log(`[finalizeAnalysisResult] Score calculation for game ${session.id}:`);
    console.log(
        `  Black: emptyTerritory=${emptyBlackT}, territoryDisplay=${finalAnalysis.scoreDetails.black.territory}, captures=${finalAnalysis.scoreDetails.black.captures}, deadStones=${finalAnalysis.scoreDetails.black.deadStones ?? 0}, total=${blackTotal}`
    );
    console.log(
        `  White: emptyTerritory=${emptyWhiteT}, territoryDisplay=${finalAnalysis.scoreDetails.white.territory}, captures=${finalAnalysis.scoreDetails.white.captures}, komi=${finalAnalysis.scoreDetails.white.komi}, deadStones=${finalAnalysis.scoreDetails.white.deadStones ?? 0}, total=${whiteTotal}`
    );
    
    return finalAnalysis;
};

/**
 * KataGo 비동기 계가 완료 후 세션을 다시 조회한다.
 * PVP는 DB 저장 지연·캐시 TTL·Prisma 일시 오류로 miss 될 수 있어, 계가 중 in-flight 세션으로 폴백한다.
 */
export async function resolveFreshGameForScoringFinalize(
    sourceGame: types.LiveGameSession,
    savedPreservedGameState?: Record<string, unknown>,
): Promise<types.LiveGameSession | null> {
    const { getCachedGame, getStaleCachedGame, updateGameCache } = await import('./gameCache.js');

    let freshGame = await getCachedGame(sourceGame.id);
    if (!freshGame) {
        freshGame = await db.getLiveGame(sourceGame.id);
    }
    if (!freshGame) {
        freshGame = getStaleCachedGame(sourceGame.id);
    }
    if (freshGame) return freshGame;

    const inFlightScoring =
        sourceGame.gameStatus === 'scoring' ||
        Boolean((sourceGame as { isScoringProtected?: boolean }).isScoringProtected) ||
        Boolean((sourceGame as { preservedGameState?: unknown }).preservedGameState);
    if (!inFlightScoring) return null;

    console.warn(
        `[getGameResult] Cache/DB miss for ${sourceGame.id}; finalizing from in-flight scoring session`,
    );
    const fallback = JSON.parse(JSON.stringify(sourceGame)) as types.LiveGameSession;
    const preserved =
        (sourceGame as { preservedGameState?: Record<string, unknown> }).preservedGameState ||
        savedPreservedGameState;
    if (preserved && typeof preserved === 'object') {
        const ps = preserved as Record<string, unknown>;
        if (Array.isArray(ps.moveHistory) && ps.moveHistory.length > 0) {
            fallback.moveHistory = ps.moveHistory as types.LiveGameSession['moveHistory'];
        }
        if (Array.isArray(ps.boardState) && ps.boardState.length > 0) {
            fallback.boardState = ps.boardState as types.LiveGameSession['boardState'];
        }
        if (ps.captures && typeof ps.captures === 'object') {
            fallback.captures = ps.captures as types.LiveGameSession['captures'];
        }
        if (ps.totalTurns !== undefined) {
            fallback.totalTurns = ps.totalTurns as number;
        }
        mergePreservedChessGoFieldsIntoSession(fallback, ps);
    }
    prepareChessGoSessionForScoring(fallback);
    fallback.gameStatus = 'scoring';
    (fallback as { isScoringProtected?: boolean }).isScoringProtected = true;
    updateGameCache(fallback);
    return fallback;
}


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
    if (isHiddenMode && shouldDeferScoringForHiddenRevealAnimation(game, Date.now())) {
        console.log(`[getGameResult] Hidden reveal animation still running for game ${game.id}, deferring scoring`);
        return game;
    }

    const p1ScansUsed = (game.settings.scanCount ?? 0) - (game.scans_p1 ?? game.settings.scanCount ?? 0);
    const p2ScansUsed = (game.settings.scanCount ?? 0) - (game.scans_p2 ?? game.settings.scanCount ?? 0);
    const hasUsedScan = isHiddenMode && (p1ScansUsed > 0 || p2ScansUsed > 0);

    // PvE 계열(싱글·타워·모험)은 NO_CONTEST 체크를 건너뜀
    // (자동 계가/AI 진행으로 초반 수순이 짧아도 정상 종료되어야 함)
    const isPveNoContestExempt =
        !!game.isSinglePlayer ||
        game.gameCategory === 'tower' ||
        game.gameCategory === 'singleplayer' ||
        game.gameCategory === 'adventure';

    /** 패(-1,-1)는 제외한 착수 수 — 「10수 미만」 규정과 동일하게 셈 */
    const strategicStoneMoveCount = (game.moveHistory || []).filter(
        (m) => m && m.x !== -1 && m.y !== -1
    ).length;

    if (SPECIAL_GAME_MODES.some(m => m.mode === game.mode) && 
        !isPveNoContestExempt &&
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
            if (!game.isSinglePlayer) {
                delete (gameToBroadcast as any).boardState;
            }
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

    if (game.mode === types.GameMode.Castle) {
        if (game.endTime == null) game.endTime = Date.now();
        game.gameStatus = 'scoring';
        game.winReason = 'score';
        game.animation = null;
        game.isAnalyzing = true;
        await db.saveGame(game);
        const { broadcastToGameParticipants } = await import('./socket.js');
        const gameToBroadcast = { ...game };
        if (!game.isSinglePlayer) {
            delete (gameToBroadcast as any).boardState;
        }
        broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);
        const { finalizeCastleScoring } = await import('./modes/castle.js');
        return finalizeCastleScoring(game);
    }
    
    // 계가 시작 전: 아직 공개되지 않은 히든 돌들을 모두 공개
    if (isHiddenMode && game.hiddenMoves && game.moveHistory) {
        if (!game.permanentlyRevealedStones) {
            game.permanentlyRevealedStones = [];
        }

        // 따내져 보드에 돌이 없는데 남아 있던 히든 메타를 제거한다(계가·최종 공개 연출에서 빈 칸에 히든이 부활하는 버그 방지).
        if (game.permanentlyRevealedStones.length > 0) {
            game.permanentlyRevealedStones = game.permanentlyRevealedStones.filter(
                (p) => game.boardState[p.y]?.[p.x] !== types.Player.None
            );
        }
        if (game.hiddenMoves && game.moveHistory) {
            for (const key of Object.keys(game.hiddenMoves)) {
                const idx = parseInt(key, 10);
                if (!Number.isFinite(idx) || idx < 0 || idx >= game.moveHistory.length) continue;
                const m = game.moveHistory[idx];
                if (!m || m.x < 0 || m.y < 0) continue;
                if (game.boardState[m.y]?.[m.x] === types.Player.None) {
                    delete game.hiddenMoves[idx];
                }
            }
        }
        const aiHiddenPre = (game as any).aiInitialHiddenStone as { x: number; y: number } | undefined;
        if (
            aiHiddenPre &&
            game.boardState[aiHiddenPre.y]?.[aiHiddenPre.x] === types.Player.None
        ) {
            (game as any).aiInitialHiddenStone = undefined;
        }
        
        // 최종 공개 연출 대상: 바둑판에 돌이 남아 있고, 영구 공개·스캔 소프트 공개가 아닌 미공개 히든만(따낸 칸은 board가 비어 루프 전에 hiddenMoves 정리됨)
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
        
        // AI 초기 히든돌도 확인 (싱글플레이·탑·모험)
        if (
            (game.isSinglePlayer || game.gameCategory === 'tower' || game.gameCategory === GameCategory.Adventure) &&
            (game as any).aiInitialHiddenStone
        ) {
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
            const now = Date.now();
            const stonesToRevealWithPlayer = stonesToReveal.map(point => {
                // moveHistory에서 원래 플레이어 확인
                const moveIndex = game.moveHistory.findIndex(m => m.x === point.x && m.y === point.y);
                const isAiInitial =
                    (game.isSinglePlayer || game.gameCategory === 'tower' || game.gameCategory === GameCategory.Adventure) &&
                    (game as any).aiInitialHiddenStone &&
                    (game as any).aiInitialHiddenStone.x === point.x &&
                    (game as any).aiInitialHiddenStone.y === point.y;
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
                duration: 1500
            };
            game.revealAnimationEndTime = now + 1500;
            game.gameStatus = 'hidden_final_reveal';

            // 애니메이션 종료 후 계가 진행하도록 설정
            await db.saveGame(game);
            const { broadcastToGameParticipants } = await import('./socket.js');
            const gameToBroadcast = { ...game };
            if (!game.isSinglePlayer) {
                delete (gameToBroadcast as any).boardState;
            }
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);

            startScoringKataGoPrecomputeIfNeeded(game, 'hidden_final_reveal');

            return game;
        }
    }

    if (isHiddenMode) {
        finalizeHiddenStonesForScoring(game);
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
        chessPieces: game.chessPieces ? JSON.parse(JSON.stringify(game.chessPieces)) : null,
        chessGoRemovedPoints: game.chessGoRemovedPoints
            ? JSON.parse(JSON.stringify(game.chessGoRemovedPoints))
            : null,
        chessCaptureScore: game.chessCaptureScore ? JSON.parse(JSON.stringify(game.chessCaptureScore)) : null,
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
    try {
        const { stashEndedPvpGameRecordSnapshot } = await import('./gameRecordSnapshot.js');
        const { volatileState } = await import('./state.js');
        stashEndedPvpGameRecordSnapshot(volatileState, game);
    } catch (stashErr) {
        console.warn('[getGameResult] stashEndedPvpGameRecordSnapshot failed:', (stashErr as Error)?.message);
    }
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
    // 히든/미사일은 moveHistory 재생성과 실제 최종 보드가 어긋날 수 있어(공개/포획/특수 연출),
    // 계가 직전 보정에서도 반드시 실제 boardState를 우선 사용한다.
    const shouldNotDeriveFromMoves = isMissileMode || isHiddenMode || hasCaptureMode;
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
    } else {
        // 클라이언트 연출(착점·따낸 점수·계가 중 UI)과 병렬로 KataGo 요청을 시작한다. 브로드캐스트는 아래에서 수행.
        startScoringKataGoPrecomputeCore(game, 'before_scoring_broadcast', {
            preservedGameState: preservedGameState as Record<string, unknown>,
            preservedTimeInfo,
        });
    }
    
    await db.saveGame(game);
    const { broadcast } = await import('./socket.js');
    // 브로드캐스트 시 moveHistory, totalTurns, 시간 정보를 명시적으로 포함.
    // 싱글플레이는 hidden_reveal/pendingCapture 경합으로 클라 보드가 1수 뒤처질 수 있으므로 boardState를 포함해 동기화한다.
    const gameToBroadcast = {
        ...game,
        animation: null,
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
    if (!game.isSinglePlayer) {
        delete (gameToBroadcast as any).boardState;
    }
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
    // 계가 전용: HTTP/Kata 한도. 클라이언트는 `BOARD_SETTLE_BEFORE_SCORING_MS` 후 계가 오버레이를 띄우고,
    // 오버레이가 끝난 뒤에야 영토(analysis)를 표시한다.
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
        if (!freshGame.isSinglePlayer) {
            delete (gameToBroadcast as any).boardState;
        }

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
            const freshGame = await resolveFreshGameForScoringFinalize(
                game,
                savedPreservedGameState as Record<string, unknown>,
            );
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
            const freshGame = await resolveFreshGameForScoringFinalize(
                game,
                savedPreservedGameState as Record<string, unknown>,
            );
            if (!freshGame) {
                console.error(`[getGameResult] Game ${game.id} not found in cache or database after analysis`);
                return;
            }
            
            const isOnlinePvpStrategic =
                !game.isSinglePlayer &&
                game.gameCategory !== 'tower' &&
                game.gameCategory !== 'singleplayer';

            // 게임 상태가 playing으로 되돌아갔으면 scoring 복구 (PVE 스테이지 루프·PVP 상호통과 후 레이스)
            const shouldRestoreScoringFromPlaying =
                freshGame.gameStatus === 'playing' &&
                (((freshGame.isSinglePlayer ||
                    freshGame.gameCategory === 'tower' ||
                    freshGame.gameCategory === 'singleplayer') &&
                    freshGame.stageId) ||
                    (isOnlinePvpStrategic &&
                        ((freshGame as any).isScoringProtected ||
                            (freshGame.passCount ?? 0) >= 2 ||
                            Boolean((freshGame as any).preservedGameState))));

            if (shouldRestoreScoringFromPlaying) {
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

        const freshGame = await resolveFreshGameForScoringFinalize(
            game,
            savedPreservedGameState as Record<string, unknown>,
        );

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

    const total = MANNER_ACTION_BUTTON_CHOICE_COUNT;
    const shuffledButtons = [...sourceDeck].sort(() => 0.5 - Math.random());
    const manners = shuffledButtons.filter(b => b.type === 'manner');
    const unmanners = shuffledButtons.filter(b => b.type === 'unmannerly');

    /** 2~3개는 매너, 나머지는 비매너로 구성해 선택지를 풍부하게 유지 */
    const mannerCount = Math.random() > 0.5 ? 2 : 3;
    const selectedManners = manners.slice(0, Math.min(mannerCount, manners.length));

    const neededUnmanners = total - selectedManners.length;
    const selectedUnmanners = unmanners.slice(0, Math.min(neededUnmanners, unmanners.length));

    let result = [...selectedManners, ...selectedUnmanners];

    if (result.length < total) {
        const existingNames = new Set(result.map(b => b.name));
        const filler = shuffledButtons.filter(b => !existingNames.has(b.name));
        result.push(...filler.slice(0, total - result.length));
    }

    return result.slice(0, total).sort(() => 0.5 - Math.random());
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

    // 전략바둑 계열 AI 대국은 서버 Kata(goAiBot)만 사용. 클라이언트 로컬 AI 플래그는 항상 끈다.
    if (isAiGame && SPECIAL_GAME_MODES.some((m) => m.mode === mode)) {
        (settings as any).useClientSideAi = false;
    }

    // 전략바둑 AI 대결에서 "제한없음(0)" 옵션 제거 정책:
    // 서버에서 scoringTurnLimit이 0/음수/없으면 보드 크기에 맞는 기본값으로 강제한다.
    const captureRuleGame = modeIncludesCaptureRule(mode, settings);
    if (isAiGame && SPECIAL_GAME_MODES.some(m => m.mode === mode) && !captureRuleGame) {
        const scoringTurnLimit = (settings as any)?.scoringTurnLimit;
        if (typeof scoringTurnLimit !== 'number' || !Number.isFinite(scoringTurnLimit) || scoringTurnLimit <= 0) {
            const options = getScoringTurnLimitOptionsByBoardSize((settings as any)?.boardSize ?? 19).filter(l => l > 0);
            (settings as any).scoringTurnLimit = options[0] ?? 1;
        }
    }

    // 따내기 바둑: 목표 점수 달성으로만 승패 — 계가까지 턴/자동 계가 수 설정은 무시(이전 모드 설정 잔존 방지)
    if (captureRuleGame) {
        (settings as any).scoringTurnLimit = 0;
        delete (settings as any).autoScoringTurns;
    }

    // human PVP: 수 제한 자동계가 필드 제거 (상호 패스만 계가)
    if (!isAiGame && SPECIAL_GAME_MODES.some((m) => m.mode === mode)) {
        Object.assign(settings, sanitizePvpGameSettings(mode, settings as types.GameSettings, { isAiGame: false }));
    }
    
    const descriptions = RANDOM_DESCRIPTIONS[mode] || [`${mode} 한 판!`];
    const randomDescription = descriptions[Math.floor(Math.random() * descriptions.length)];

    const initialBoardSize =
        mode === types.GameMode.Chess ? 13 : (settings.boardSize as number);

    const game: LiveGameSession = {
        id: gameId,
        mode, settings, description: randomDescription, player1: challenger, player2: opponent, isAiGame,
        gameCategory: GameCategory.Normal,  // 일반 게임은 normal 카테고리
        // 랭킹전은 휴먼 vs 휴만 적용. AI 대국·길드전 등은 협상에 isRanked가 없거나 false.
        isRankedGame: Boolean(neg.isRanked) && !isAiGame,
        boardState: Array(initialBoardSize).fill(0).map(() => Array(initialBoardSize).fill(types.Player.None)),
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

    const pairPetStatUsers = (neg as Negotiation & { pairPetStatUsers?: types.User[] }).pairPetStatUsers;
    if (
        pairPetStatUsers &&
        pairPetStatUsers.length > 0 &&
        (settings as types.GameSettings).pairGame &&
        PAIR_GO_GAME_MODES.includes(mode as types.GameMode)
    ) {
        const { hydratePairGamePetKataAndRpsIfNeeded } = await import('./pairPetKataHydration.js');
        const ownerId = (neg as Negotiation & { pairPetConfigureOwnerId?: string }).pairPetConfigureOwnerId ?? neg.challenger.id;
        const ownerUser = pairPetStatUsers.find((u) => u.id === ownerId) ?? neg.challenger;
        hydratePairGamePetKataAndRpsIfNeeded(game, ownerUser, pairPetStatUsers);
    }

    // AI 게임은 대국실 입장 후 "경기 시작" 확인을 받아야 시작되므로,
    // 생성 시에는 항상 pending 상태로 유지하고, 실제 초기화는 CONFIRM_AI_GAME_START에서 수행합니다.
    if (!isAiGame) {
        if (SPECIAL_GAME_MODES.some(m => m.mode === mode)) {
            await initializeStrategicGame(game, neg, now);
            applyHumanPvpStrategicSettingsInvariants(game);
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

/**
 * 메인 루프가 들고 있는 게임 스냅샷이 `/api/action` 직후의 `gameCache`보다 낡을 수 있다.
 * `updateGameStates` 타임아웃·배치 제한 등으로 조기 반환할 때는 반드시 캐시를 한 번 읽어
 * (예: 베이스 `CONFIRM_BASE_REVEAL` → `playing` 직후) stale 덮어쓰기를 막는다.
 */
function formatUpdateGameStatesTimeoutContext(games: LiveGameSession[]): string {
    const g = games[0];
    if (!g?.id) return `games=${games.length}`;
    return [
        `games=${games.length}`,
        `id=${g.id}`,
        `mode=${g.mode}`,
        `status=${g.gameStatus}`,
        `aiGame=${!!g.isAiGame}`,
        `dispatching=${!!(g as any)._aiMoveDispatching}`,
        `aiQueue=${aiProcessingQueue.isProcessingGame(g.id)}`,
        `scoringFlight=${!!(g as any)._getGameResultInFlight}`,
    ].join(' ');
}

export async function mergeGamesWithLatestCache(
    snapshots: LiveGameSession[],
    lookupMs: number,
): Promise<LiveGameSession[]> {
    const { getCachedGame, pickFresherLiveSessionForPveCache } = await import('./gameCache.js');
    return Promise.all(
        snapshots.map(async (snap) => {
            if (!snap?.id) return snap;
            const cached = await Promise.race([
                getCachedGame(snap.id),
                new Promise<LiveGameSession | null>((r) => setTimeout(() => r(null), lookupMs)),
            ]);
            return pickFresherLiveSessionForPveCache(snap, cached);
        }),
    );
}

export const updateGameStates = async (games: LiveGameSession[], now: number): Promise<LiveGameSession[]> => {
    // 빈 배열이면 즉시 반환
    if (!games || games.length === 0) {
        return [];
    }

    try {
        // PVE 게임은 일반적으로 제외. 단, 다음 경우 서버 루프에서 처리 필요:
        // - hidden_final_reveal / hidden_reveal_animating: 애니메이션 종료 후 scoring 전환
        // - missile_animating / scanning_animating: 애니메이션 종료 후 playing 전환 (도전의 탑 등)
        // - 모험/길드전 AI 대국: PLACE_STONE 직후 aiTurnStartTime만 세팅되고 makeAiMove는 processGame에서만
        //   스케줄됨. 여기서 제외하면 몬스터가 영구적으로 수를 두지 않음 (싱글/탑은 클라·전용 경로가 많음).
        const multiPlayerGames: LiveGameSession[] = [];
        for (const game of games) {
            if (!game || !game.id) continue;
            const isPVEGame =
                game.isSinglePlayer ||
                game.gameCategory === 'tower' ||
                game.gameCategory === 'singleplayer' ||
                game.gameCategory === 'guildwar' ||
                game.gameCategory === 'adventure';
            const needsRevealTransition = isPVEGame && (game.gameStatus === 'hidden_final_reveal' || game.gameStatus === 'hidden_reveal_animating');
            const needsItemModeTransition =
                isPVEGame &&
                (game.gameStatus === 'missile_animating' ||
                    game.gameStatus === 'scanning_animating' ||
                    // 히든/스캔 아이템 선택 중에도 updateHiddenState가 돌아야 30초 타임아웃 복귀가 처리됨
                    game.gameStatus === 'hidden_placing' ||
                    game.gameStatus === 'scanning' ||
                    // 도전의 탑: 미사일 선택 중에도 updateMissileState(아이템 데드라인 등)가 돌아야 함
                    game.gameStatus === 'missile_selecting');
            const arenaPolicy = resolveArenaSessionPolicy(game);
            const needsPveServerGoAiTick =
                arenaPolicy.usesServerKataAi &&
                (arenaPolicy.kind === 'adventure' || arenaPolicy.kind === 'guildwar') &&
                (game.gameStatus === 'playing' ||
                    game.gameStatus === 'hidden_placing' ||
                    game.gameStatus === 'scanning' ||
                    game.gameStatus === 'missile_selecting' ||
                    // 베이스/니기리/따내기 등 사전 단계: 모험·길드전은 isPVEGame 때문에 루프에서 빠지면
                    // updateStrategicGameState가 호출되지 않아 배치 완료 후 다음 단계 진입이 멈춘다.
                    game.gameStatus === 'base_placement' ||
                    game.gameStatus === 'base_stone_color_choice' ||
                    game.gameStatus === 'base_same_color_points_bid' ||
                    game.gameStatus === 'base_game_start_confirmation' ||
                    game.gameStatus === 'nigiri_choosing' ||
                    game.gameStatus === 'nigiri_guessing' ||
                    game.gameStatus === 'nigiri_reveal' ||
                    game.gameStatus === 'uniform_color_roulette' ||
                    game.gameStatus === 'capture_bidding' ||
                    game.gameStatus === 'capture_reveal' ||
                    game.gameStatus === 'capture_tiebreaker');
            /** PVE 베이스(또는 믹스에 베이스): 메인 루프에서 제외되면 사전 단계 전환·AI 입찰이 멈춤 */
            const needsSinglePlayerBasePrePlayTick =
                isPVEGame &&
                (game.mode === types.GameMode.Base ||
                    (game.mode === types.GameMode.Mix &&
                        Boolean((game.settings as { mixedModes?: types.GameMode[] } | undefined)?.mixedModes?.includes(types.GameMode.Base)))) &&
                [
                    'base_placement',
                    'base_stone_color_choice',
                    'base_same_color_points_bid',
                    'base_game_start_confirmation',
                    'capture_bidding',
                    'capture_reveal',
                    'capture_tiebreaker',
                ].includes(game.gameStatus);
            // 싱글 베이스 사전 단계는 `needsSinglePlayerBasePrePlayTick`으로 처리(도전의 탑 등에는 베이스 모드 없음).
            // 싱글/타워 등 PVE는 기본적으로 메인 루프에서 제외되나, 주사위·도둑은 update*State / AI 턴이
            // 여기서 돌지 않으면 새로고침·WS 공백 시 굴림 애니·연속 착수가 영구 정지한다.
            const pveDiceThiefCurrentPid =
                game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
            const pveDiceThiefIsAiTurn =
                pveDiceThiefCurrentPid === aiUserId ||
                (!!pveDiceThiefCurrentPid && String(pveDiceThiefCurrentPid).startsWith('dungeon-bot-'));
            /** 스피드 시간 압박을 `captures`에 실시간 반영하려면 playing 중에도 updateStrategicGameState가 돌아야 함 */
            const needsPveSpeedPlayingTick =
                isPVEGame &&
                game.gameStatus === 'playing' &&
                isSessionSpeedTimePressureMode(game);
            const needsPveDiceThiefPlayfulTick =
                isPVEGame &&
                ((game.mode === types.GameMode.Dice &&
                    (game.gameStatus === 'dice_rolling_animating' ||
                        game.gameStatus === 'dice_turn_rolling_animating' ||
                        game.gameStatus === 'dice_turn_rolling' ||
                        game.gameStatus === 'dice_turn_choice' ||
                        game.gameStatus === 'dice_start_confirmation' ||
                        (pveDiceThiefIsAiTurn &&
                            (game.gameStatus === 'dice_rolling' || game.gameStatus === 'dice_placing')))) ||
                    (game.mode === types.GameMode.Thief &&
                        (game.gameStatus === 'thief_rolling_animating' ||
                            (pveDiceThiefIsAiTurn &&
                                (game.gameStatus === 'thief_rolling' || game.gameStatus === 'thief_placing')))));
            const needsPveAiWatchdogLoopTick = needsPveAiWatchdogTick(game);
            if (
                !isPVEGame ||
                needsRevealTransition ||
                needsItemModeTransition ||
                needsPveServerGoAiTick ||
                needsSinglePlayerBasePrePlayTick ||
                needsPveSpeedPlayingTick ||
                needsPveDiceThiefPlayfulTick ||
                needsPveAiWatchdogLoopTick
            ) {
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
                void (async () => {
                    const shouldLog =
                        !(global as any).lastUpdateGameStatesTimeoutLog ||
                        Date.now() - (global as any).lastUpdateGameStatesTimeoutLog > 30000;
                    if (shouldLog) {
                        console.warn(
                            `[updateGameStates] Outer timeout (${OUTER_DEADLINE_MS}ms) — merging gameCache (${formatUpdateGameStatesTimeoutContext(games)})`,
                        );
                        (global as any).lastUpdateGameStatesTimeoutLog = Date.now();
                    }
                    resolve(await mergeGamesWithLatestCache(games, 1500));
                })();
            }, OUTER_DEADLINE_MS);
        });

        const inner = (async (): Promise<LiveGameSession[]> => {
            const startTime = Date.now();
            // 즉시 yield하여 4초/25초 타임아웃이 스케줄된 뒤 실행되도록 함 (이벤트 루프 블로킹 시에도 타임아웃 동작)
            await new Promise<void>((r) => setImmediate(r));
            
            // 타임아웃 체크: 이미 시간이 초과했으면 즉시 반환
            if (Date.now() - startTime >= OUTER_DEADLINE_MS) {
                return await mergeGamesWithLatestCache(games, 1200);
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
                return await mergeGamesWithLatestCache(games, 1200);
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
                    setTimeout(() => {
                        void (async () => {
                            resolve(await mergeGamesWithLatestCache(batch, 1200));
                        })();
                    }, BATCH_DEADLINE_MS);
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
                        if (timeoutOccurred) {
                            const { getCachedGame } = await import('./gameCache.js');
                            const cached = await Promise.race([
                                getCachedGame(game.id),
                                new Promise<LiveGameSession | null>((r) => setTimeout(() => r(null), 800)),
                            ]);
                            if (cached) return cached;
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
                return (
                    game.isSinglePlayer ||
                    game.gameCategory === 'tower' ||
                    game.gameCategory === 'singleplayer' ||
                    game.gameCategory === 'adventure' ||
                    game.gameCategory === 'guildwar'
                );
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
        return await mergeGamesWithLatestCache(games, 1500); // 치명적 에러 시에도 캐시 우선으로 stale 덮어쓰기 완화
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

        const arenaPolicyEarly = resolveArenaSessionPolicy(game);
        const isClientKickPlaying =
            arenaPolicyEarly.usesServerKataAi &&
            (arenaPolicyEarly.kind === 'singleplayer' || arenaPolicyEarly.kind === 'tower') &&
            (game.gameStatus === 'playing' || game.gameStatus === 'hidden_placing');

        // PLACE_STONE 직후 같은 메인루프 사이클에서 스냅샷(이전 상태)으로 처리되면
        // currentPlayer가 아직 human이라 시간패가 잘못 적용되는 버그 방지: 캐시에서 최신 게임 사용
        const { getCachedGame } = await import('./gameCache.js');
        const GET_CACHED_GAME_DEADLINE_MS = isClientKickPlaying ? 400 : 2500;
        const cached = await Promise.race([
            getCachedGame(game.id),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), GET_CACHED_GAME_DEADLINE_MS)),
        ]);
        if (cached) {
            game = cached;
        }

        // AI 디스패치 중에도 아이템 데드라인/애니 종료는 반드시 진행 (히든·스캔·미사일 타임아웃 고착 방지)
        try {
            const { tickStrategicItemPhaseIfNeeded } = await import('./utils/strategicItemPhaseTick.js');
            const itemTickChanged = await tickStrategicItemPhaseIfNeeded(game, now);
            if (itemTickChanged) {
                const { updateGameCache } = await import('./gameCache.js');
                updateGameCache(game);
                db.saveGame(game).catch((err: unknown) =>
                    console.error(
                        `[processGame] Item phase tick save failed ${game.id}:`,
                        (err as Error)?.message ?? err,
                    ),
                );
            }
        } catch (itemTickErr: unknown) {
            console.error(
                `[processGame] Item phase tick failed ${game.id}:`,
                (itemTickErr as Error)?.message ?? itemTickErr,
            );
        }

        // AI 큐가 Kata/goAiBot 동기 연산 중이면 메인 루프 틱을 즉시 반환 (22~24s 타임아웃 연쇄 방지)
        if (
            aiProcessingQueue.isProcessingGame(game.id) ||
            (game as any)._getGameResultInFlight
        ) {
            return game;
        }

        // 싱글/탑 본대국: 클라이언트 REQUEST_SERVER_AI_MOVE + 큐 워치독만 (전략 상태머신·인라인 AI 스킵)
        if (isClientKickPlaying) {
            if (String(game.gameStatus) === 'hidden_reveal_animating') {
                const { finalizePveHiddenRevealIfExpired } = await import('./utils/pveHiddenRevealTick.js');
                await finalizePveHiddenRevealIfExpired(game, now);
            }
            maybeRecoverStalledPveAiTurn(game, now);
            return game;
        }

        try {
            // PVP 전용: AI/싱글/탑 등에서는 disconnectionState를 쓰지 않으며, 버그·구버전으로 남아 있어도 시간패로 끝내지 않는다.
            const isPvpDisconnectRecovery =
                !game.isSinglePlayer &&
                !game.isAiGame &&
                game.gameCategory !== 'tower' &&
                game.gameCategory !== 'singleplayer' &&
                game.gameCategory !== 'adventure';
            if (
                isPvpDisconnectRecovery &&
                game.disconnectionState &&
                now - game.disconnectionState.timerStartedAt > PVP_DISCONNECT_REJOIN_GRACE_MS
            ) {
                // 90초 내에 재접속하지 못하면 시간패배 처리
                game.winner = game.blackPlayerId === game.disconnectionState.disconnectedPlayerId ? types.Player.White : types.Player.Black;
                game.winReason = 'timeout';
                game.gameStatus = 'ended';
                game.disconnectionState = null;
                // endGame 호출에도 타임아웃 추가 (DB 저장 지연 방지)
                const END_GAME_DEADLINE_MS = 1000;
                const endGameTimeout = new Promise<void>((resolve) => setTimeout(resolve, END_GAME_DEADLINE_MS));
                await Promise.race([
                    endGame(game, game.winner, 'timeout'),
                    endGameTimeout
                ]).catch((error: any) => {
                    console.error(`[processGame] Error ending game ${game.id}:`, error?.message || error);
                });
            } else if (!isPvpDisconnectRecovery && game.disconnectionState) {
                game.disconnectionState = null;
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
            let aiUserResolved =
                guildWarBoardId && String(guildWarBoardId).length > 0
                    ? getAiUserForGuildWar(game.mode, guildWarBoardId)
                    : getAiUser(game.mode);
            if (String((game as any).gameCategory ?? '') === 'tower') {
                aiUserResolved = { ...aiUserResolved, nickname: TOWER_AI_BOT_DISPLAY_NAME };
            }
            // 싱글플레이: 봇 닉네임·레벨은 START/CONFIRM에서 스테이지(반·번호) 기준으로 설정되므로
            // 메인 루프가 모드 기본 닉네임(`히든 바둑봇`/`베이스 바둑봇` 등)으로 되돌리지 않도록 보존한다.
            const isSinglePlayerSession =
                Boolean(game.isSinglePlayer) || String((game as any).gameCategory ?? '') === 'singleplayer';
            if (isSinglePlayerSession && game.player2?.id === aiUserId) {
                const preservedNickname = typeof game.player2.nickname === 'string' && game.player2.nickname.length > 0
                    ? game.player2.nickname
                    : aiUserResolved.nickname;
                const preservedUserLevel = typeof game.player2.userLevel === 'number'
                    ? game.player2.userLevel
                    : aiUserResolved.userLevel;
                aiUserResolved = { ...aiUserResolved, nickname: preservedNickname, userLevel: preservedUserLevel };
            }

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
                'curling_tiebreaker_playing',
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

                if (isPairCooperativeTwoHumansVsAi(game.settings)) {
                    for (const player of players) {
                        game.currentActionButtons[player.id] = [];
                        game.actionButtonUsedThisCycle[player.id] = false;
                    }
                } else {
                    for (const player of players) {
                        const deadline = game.actionButtonCooldownDeadline?.[player.id];
                        if (typeof deadline !== 'number' || now >= deadline) {
                            game.currentActionButtons[player.id] = getNewActionButtons(game);

                            const effects = effectService.calculateUserEffects(player);
                            const cooldown = 5 * 60 * 1000;

                            game.actionButtonCooldownDeadline[player.id] = now + cooldown;
                            game.actionButtonUsedThisCycle[player.id] = false;
                        }
                    }
                }
            }

            // 수동 일시정지: 싱글/탑 제외 온라인 AI 대국 — processGame 루프가 AI 턴을 진행시키지 않도록 막는다.
            // (전략바둑만이 아니라 동일 PAUSE 규칙을 쓰는 모든 AI 로비 대국에 일치)
            const isManuallyPaused = isAiLobbyManualClockPause(game);

            // 게임 상태 업데이트를 먼저 실행하여 애니메이션 완료 후 턴 전환을 처리
            // 중요: 게임 상태 업데이트를 먼저 실행해야 애니메이션 완료 후 턴 전환이 제대로 처리됨
            // AI 큐/makeAiMove가 Kata·goAiBot 동기 연산 중이면 겹치지 않게 스킵 (이벤트 루프 장시간 블로킹 → 22s 타임아웃 방지)
            const skipStateMachineTick =
                !!(game as any)._aiMoveDispatching ||
                !!(game as any)._getGameResultInFlight ||
                aiProcessingQueue.isProcessingGame(game.id);
            if (
                !skipStateMachineTick &&
                game.gameStatus !== 'ended' &&
                game.gameStatus !== 'no_contest' &&
                game.gameStatus !== 'scoring'
            ) {
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
            const pairClassicForAi = isPairClassicGame(game.settings, game.mode);
            const pairSeatForAi = pairClassicForAi ? getCurrentPairTurnSeat(game.settings) : null;
            const isPairAiTurn = Boolean(pairSeatForAi && isPairAiSeat(pairSeatForAi));
            const currentPlayerIdForAi = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
            const isAiPlayerTurn = currentPlayerIdForAi === aiUserId ||
                (currentPlayerIdForAi && String(currentPlayerIdForAi).startsWith('dungeon-bot-'));
            // 페어: 좌석(흑1/백1/흑2/백2) 기준만. blackPlayerId===aiUserId 레거시 판정은 백1(유저) 차례에도 AI 턴으로 오인해 턴이 꼬인다.
            const isAiTurn = !isManuallyPaused && game.currentPlayer !== types.Player.None &&
                (pairClassicForAi
                    ? isPairAiTurn
                    : isPairAiTurn || ((game.isAiGame || isAiPlayerTurn) && isAiPlayerTurn));

            // 알까기: 배치→공격 전환 직후에는 즉시 공격하지 않고 딜레이 예약만 건다.
            const didAlkkagiTriggerAiAttack = (game as any).alkkagiTriggerAiAttack === true &&
                game.mode === types.GameMode.Alkkagi && game.gameStatus === 'alkkagi_playing' && isAiTurn;
            if (didAlkkagiTriggerAiAttack) {
                (game as any).alkkagiTriggerAiAttack = false;
                const delayedStartAt = now + 2000;
                const currentStart = Number(game.aiTurnStartTime ?? 0);
                if (!Number.isFinite(currentStart) || currentStart < delayedStartAt) {
                    game.aiTurnStartTime = delayedStartAt;
                }
            }

            // 멀티플레이 AI 게임의 경우에만 메인 루프에서 AI 수 처리
            // 놀이바둑 모드별로 AI가 행동할 수 있는 gameStatus 모두 허용
            const playfulPlacementStatuses = ['alkkagi_placement', 'alkkagi_simultaneous_placement', 'thief_rolling', 'thief_placing'];
            const playfulPlayingStatuses = ['alkkagi_playing', 'curling_playing', 'curling_tiebreaker_playing', 'dice_rolling', 'dice_placing', 'dice_turn_rolling', 'dice_turn_choice', 'dice_start_confirmation'];
            const animatingStatuses = [
                'missile_animating',
                'hidden_reveal_animating',
                'scanning_animating',
                'alkkagi_animating',
                'curling_animating',
                'thief_rolling_animating',
                'dice_rolling_animating',
                'dice_turn_rolling_animating',
            ];
            const canProcessAiTurn = isAiTurn && game.gameStatus !== 'ended' && 
                !animatingStatuses.includes(game.gameStatus) &&
                (game.gameStatus === 'playing' || playfulPlacementStatuses.includes(game.gameStatus) || playfulPlayingStatuses.includes(game.gameStatus));

            if (canProcessAiTurn && !didAlkkagiTriggerAiAttack) {
                const pveAiPolicyForDispatch = resolveArenaSessionPolicy(game);
                const pveStrategicQueueOnly =
                    pairClassicForAi ||
                    (pveAiPolicyForDispatch.usesServerKataAi &&
                        (pveAiPolicyForDispatch.kind === 'adventure' ||
                            pveAiPolicyForDispatch.kind === 'guildwar' ||
                            pveAiPolicyForDispatch.kind === 'singleplayer' ||
                            pveAiPolicyForDispatch.kind === 'tower'));
                // 페어 4인 수순·모험·길드전: aiProcessingQueue 단일 경로만 사용 (메인루프와 이중 디스패치 방지)
                if (pveStrategicQueueOnly) {
                    if (String(game.gameStatus) === 'hidden_reveal_animating') {
                        const { finalizePveHiddenRevealIfExpired } = await import('./utils/pveHiddenRevealTick.js');
                        await finalizePveHiddenRevealIfExpired(game, now);
                    }
                    maybeRecoverStalledPveAiTurn(game, now);
                    return game;
                }
                const dispatchingAt = Number((game as any)._aiMoveDispatchingAt ?? 0);
                if ((game as any)._aiMoveDispatching && dispatchingAt > 0 && now - dispatchingAt > 8_000) {
                    // 드문 예외 경로에서 finally 미도달 시 디스패치 락이 고착되는 현상 복구
                    (game as any)._aiMoveDispatching = false;
                    (game as any)._aiMoveDispatchingAt = undefined;
                }
                if ((game as any)._aiMoveDispatching) {
                    return game;
                }
                if (!game.aiTurnStartTime || game.aiTurnStartTime === undefined) {
                    game.aiTurnStartTime = now;
                }
                if (now >= game.aiTurnStartTime) {
                    // 근본 원인 수정: makeAiMove 내부의 동기 무거운 연산(goAiBot)이 이벤트 루프를 25초 이상 블로킹하여
                    // 타임아웃이 동작하지 않음. 메인 루프에서는 기다리지 않고 setImmediate로 지연 실행하여
                    // updateGameStates가 즉시 반환되도록 함. 완료 시 캐시/저장/브로드캐스트는 콜백에서 수행.
                    const gameId = game.id;
                    const initialMoveCount = game.moveHistory?.length ?? 0;
                    (game as any)._aiMoveDispatching = true;
                    (game as any)._aiMoveDispatchingAt = Date.now();
                    game.aiTurnStartTime = Date.now() + 500;
                    setImmediate(() => {
                        makeAiMove(game).then(async () => {
                            const moveCountAfter = game.moveHistory?.length ?? 0;
                            const aiActuallyMoved = moveCountAfter > initialMoveCount;
                            if (aiActuallyMoved) {
                                const stillMultiStonePlacing =
                                    (game.gameStatus === 'thief_placing' || game.gameStatus === 'dice_placing') &&
                                    (game.stonesToPlace ?? 0) > 0;
                                if (stillMultiStonePlacing) {
                                    // 연속 착수: 다음 수는 즉시 메인루프에 맡기지 않고 일정 간격 후에만 스케줄 (버스트 방지)
                                    game.aiTurnStartTime = Date.now() + PLAYFUL_AI_BATCH_STONE_INTERVAL_MS;
                                } else {
                                    // makeGoAiBotMove가 이미 다음 AI 턴용으로 aiTurnStartTime을 잡았을 수 있다.
                                    // 여기서 무조건 undefined로 덮으면 페어(4인 수순)·레거시 연속 AI 턴과
                                    // aiProcessingQueue 경로가 경쟁하며 스케줄이 꼬일 수 있다.
                                    const pairClassicPost = isPairClassicGame(game.settings, game.mode);
                                    const nextSeatPost = pairClassicPost ? getCurrentPairTurnSeat(game.settings) : null;
                                    const nextLegacyId =
                                        game.currentPlayer === types.Player.Black
                                            ? game.blackPlayerId
                                            : game.whitePlayerId;
                                    const nextActorId = nextSeatPost?.participantId ?? nextLegacyId;
                                    const nextNeedsServerAi =
                                        Boolean(nextSeatPost && isPairAiSeat(nextSeatPost)) ||
                                        nextActorId === aiUserId ||
                                        Boolean(nextActorId && String(nextActorId).startsWith('dungeon-bot-'));
                                    game.aiTurnStartTime = nextNeedsServerAi ? Date.now() : undefined;
                                    if (!game.turnStartTime) game.turnStartTime = Date.now();
                                }
                            } else {
                                game.aiTurnStartTime = Date.now() + 50;
                                const pveAiPolicy = resolveArenaSessionPolicy(game);
                                if (pveAiPolicy.usesServerKataAi) {
                                    aiProcessingQueue.enqueue(gameId, undefined, { deferIfProcessing: true });
                                }
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
                        }).finally(() => {
                            (game as any)._aiMoveDispatching = false;
                            (game as any)._aiMoveDispatchingAt = undefined;
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

            maybeRecoverStalledPveAiTurn(game, now);

            return game;
        } catch (error) {
            console.error(`[Game Loop] Failed to update game ${game.id}:`, error);
            return game;
        }
};
