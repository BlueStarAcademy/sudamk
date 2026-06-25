import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
// FIX: The main types barrel file now exports settings types. Use it for consistency.
import { User, LiveGameSession, UserWithStatus, ServerAction, GameMode, Negotiation, ChatMessage, UserStatus, UserStatusInfo, AdminLog, Announcement, OverrideAnnouncement, InventoryItem, AppState, InventoryItemType, AppRoute, QuestReward, DailyQuestData, WeeklyQuestData, MonthlyQuestData, SoundSettings, FeatureSettings, AppSettings, PanelEdgeStyle, CoreStat, SpecialStat, MythicStat, EquipmentSlot, EquipmentPreset, Player, HomeBoardPost, GameRecord, Guild } from '../types.js';
import type { KataServerRuntimeSnapshot } from '../shared/types/kataServerRuntime.js';
import { mergeKataServerRuntimeSnapshot } from '../shared/utils/kataServerRuntimeMerge.js';
import { mergeChampionshipTournamentPreserveLostRealGame } from '../shared/utils/championshipTournamentPreserve.js';
import {
    mergeChampionshipVersusConditionSnapshotRecords,
    mergeDungeonConditionSnapshotRecords,
    syncDungeonConditionSnapshotToTournamentPlayers,
} from '../shared/utils/championshipConditionDisplay.js';
import { CHAMPIONSHIP_ABILITY_KATA_LADDER, type ChampionshipAbilityKataLadderRow } from '../shared/constants/championshipRealMatch.js';
import { HandleActionResult, type PairRoomChatLine } from '../types/api.js';
import { Point } from '../types/enums.js';
import { audioService } from '../services/audioService.js';
import {
    stableStringify,
    parseHash,
    replaceAppHash,
    navigateFromGameIfApplicable,
    markSkipGameHashLeaveInterceptOnce,
    shouldSuppressChampionshipArenaRedirect,
    APP_HOME_HASH,
    normalizeLegacyAppHash,
} from '../utils/appUtils.js';
import { DEFAULT_CLAIMED_MILESTONES } from '../utils/questProgressCap.js';
import { getApiUrl, getWebSocketUrlFor } from '../utils/apiConfig.js';
import { 
    DAILY_MILESTONE_THRESHOLDS,
    WEEKLY_MILESTONE_THRESHOLDS,
    MONTHLY_MILESTONE_THRESHOLDS,
    SPECIAL_GAME_MODES,
    PLAYFUL_GAME_MODES,
    PAIR_AI_MOVE_REVEAL_DELAY_MS,
    isOpponentInsufficientActionPointsError,
} from '../constants.js';
import { defaultSettings, SETTINGS_STORAGE_KEY } from './useAppSettings.js';
import i18n, { isAppLocale, detectBrowserLocale, applyDocumentLocale } from '../shared/i18n/config.js';
import { DEFAULT_LOCALE } from '../shared/i18n/constants.js';
import type { AppLocale } from '../shared/i18n/languages.js';
import type { QuickUtilityPanelKind } from '../shared/types/quickUtilityPanel.js';
import type { MobileViewportEntry } from '../shared/types/mobileViewportStack.js';
import { getAppRouteNavigationKey } from '../shared/types/navigation.js';
import { getQuickUtilityKindFromStack } from '../shared/utils/mobileViewportStackUtils.js';
import { syncDismissedScreenGuidesFromUser } from '../utils/screenGuideDismiss.js';
import {
    useIsHandheldDevice,
    useViewportHeightBelow,
    VIEWPORT_HEIGHT_LAYOUT_BREAKPOINT,
    useTouchLayoutProfile,
    useIsPortrait,
    useHandheldPortraitLockActive,
} from './useIsMobileLayout.js';
import { syncDocumentViewportHeightVar } from '../utils/layoutViewportCss.js';
import { getPanelEdgeImages } from '../constants/panelEdges.js';
import {
    SINGLE_PLAYER_STAGES,
    getSinglePlayerStages,
    setSinglePlayerStagesFromServer,
    subscribeSinglePlayerStagesListUpdate,
} from '../constants/singlePlayerConstants.js';
import {
    resolveLiveSessionSinglePlayerStageRow,
    resolveSinglePlayerAutoScoringCapForClientSession,
} from '../shared/utils/liveSessionSinglePlayerStage.js';
import { TOWER_STAGES } from '../constants/towerConstants.js';
import { calculateUserEffects } from '../services/effectService.js';
import { coerceSpecialStatType } from '../shared/utils/specialStatMilestones.js';
import { ACTION_POINT_REGEN_INTERVAL_MS } from '../constants/rules.js';
import {
    aiUserId,
    OTHER_DEVICE_LOGIN_ADMIN_FORCE_REASON,
    OTHER_DEVICE_LOGIN_MAINTENANCE_REASON,
    OTHER_DEVICE_LOGIN_SHARED_PC_REASON,
    WEBSOCKET_ADMIN_FORCE_LOGOUT_CLOSE_CODE,
} from '../shared/constants/auth.js';
import {
    mergeArenaEntranceAvailability,
    type ArenaEntranceKey,
} from '../constants/arenaEntrance.js';
import { translateArenaEntranceClosed, tx } from '../shared/i18n/runtimeText.js';
import { shouldSuppressKoPlaceStoneClientError, isGameAlreadyStartedError, isBaseStoneColorChoiceBenignError, isInsufficientActionPointsServerError, isGameNotFoundServerError, isInventoryFullServerError } from '../shared/utils/serverErrorMatch.js';
import { PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE } from '../shared/constants/pairHatchery.js';
import {
    pairArenaLobbyHash,
    readPairArenaRestoreFromGameStateStorage,
    stashPairArenaRoomRestoreForLobbyNavigation,
} from '../shared/utils/pairArenaSessionRestore.js';
import { arenaLobbyHash, arenaLobbyHashFromSession } from '../shared/utils/arenaLobbyDestination.js';
import { isSyntheticOnlineUserId } from '../shared/utils/syntheticOnlineUserIds.js';
import {
    hasPairPetClaimReadyForQuickMenu,
    pairPetQuickMenuNeedsSecondTick,
} from '../shared/utils/pairPetQuickClaimNotification.js';
import { stampObtainedItemsBulk } from '../shared/utils/obtainedItemsBulk.js';
import { advancePairTurn, getCurrentPairTurnSeat, isPairAiSeat, isPairClassicGame, normalizePairTurnIndex, resetPairPasses } from '../shared/utils/pairGameTurn.js';
import { buildBoardFromMoves } from '../utils/sgfBoardLogic.js';
import { mergePairPetTrainingSlotsPreserveRecentRestart } from '../shared/utils/pairPetTrainingSlotsClientMerge.js';
import { pairTrainingClaimCompletedBySlotIndex, PAIR_TRAINING_CLAIM_ALREADY_CLAIMED_ERROR } from '../components/pair/pairTrainingClaimInFlight.js';
import { resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';
import { preservePairTurnIfExistingAhead } from '../utils/preservePairTurnOnMerge.js';
import {
    countConditionPotionsInInventory,
    stripInventoryIfFewerConditionPotions,
} from '../shared/utils/conditionPotionInventory.js';
import { executeUseConditionPotionAction } from './useConditionPotionAction.js';
import {
    isConditionPotionBuySyncWs,
    isConditionPotionInventoryIncreaseWs,
    isConditionPotionUseSyncWs,
    sanitizeConditionPotionUserUpdatePatch,
} from '../shared/conditionPotion/wsMergePolicy.js';

const HOME_BOARD_READ_STORAGE_PREFIX = 'sudamr-home-board-read-posts';

function getSessionArenaKind(g: Partial<LiveGameSession> | undefined): string {
    if (!g) return 'normal';
    return resolveArenaSessionPolicy(g as any).kind;
}

function isSessionSingleOrTower(g: Partial<LiveGameSession> | undefined): boolean {
    const kind = getSessionArenaKind(g);
    return kind === 'singleplayer' || kind === 'tower';
}

function isSessionStrategicAiLike(g: Partial<LiveGameSession> | undefined): boolean {
    if (!g) return false;
    return resolveArenaSessionPolicy(g as any).isStrategicAiLike;
}

function isPairHatcheryPetInventoryFullError(action: ServerAction, errorMessage: string): boolean {
    return (
        (action.type === 'PAIR_PET_HATCHERY_CLAIM' || action.type === 'PAIR_PET_HATCHERY_INSTANT_FINISH') &&
        errorMessage === PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE
    );
}

/** 챔피언십 던전 보상 수령: 가방 부족 시 TournamentBracket 전용 모달로만 안내(토스트 중복 방지) */
function isChampionshipCompleteDungeonInventoryFullError(action: ServerAction, errorMessage: string): boolean {
    return action.type === 'COMPLETE_DUNGEON_STAGE' && isInventoryFullServerError(errorMessage);
}
import {
    applyUserProgressionArenaLocks,
    getBadukAbilitySnapshotFromStats,
    TOWER_ENTRANCE_REQUIRED_STAGE_ID,
    ADVENTURE_ENTRANCE_REQUIRED_STAGE_ID,
} from '../shared/utils/contentProgressionGates.js';
import { calculateTotalStats } from '../services/statService.js';
import { isClientAdmin } from '../utils/clientAdmin.js';
import { processMoveClient } from '../client/goLogicClient.js';
import { applyMissileCaptureProcessResult } from '../shared/utils/missileLandingCapture.js';
import { shouldIgnoreStaleServerHiddenPlacingAfterClientCommit } from '../shared/utils/mixGoRules.js';
import { isItemPhasePresentationStillActive } from '../shared/utils/itemPhaseAnimationTypes.js';
import { isIntersectionRecordedAsBaseStone } from '../shared/utils/removeCapturedBaseStoneMarkers.js';
import { findLatestMoveIndexAtExcludingRecordedBaseStones } from '../shared/utils/baseHiddenMoveIndex.js';
import { buildWeightedJustCapturedForStones } from '../shared/utils/sumWeightedCapturePointsForCapturedStones.js';
import { tryBuildHiddenCaptureRevealState } from './useClientGameState.js';
import { upsertHiddenStonePoint } from '../shared/utils/hiddenStonePointMarkers.js';
import { isDiceGoLibertyPlacement, isThiefGoValidPlacement } from '../client/logic/goLogic.js';
import { applyOptimisticAlkkagiPlaceStone, alkkagiPlacedCountForUser } from '../shared/utils/alkkagiPlacement.js';
import { normalizeInventoryAfterLoad } from '../utils/inventoryUtils.js';
import { reconcileExchangeListedInventoryFlags } from '../shared/utils/exchangeInventorySync.js';
import { stripReappearedRemovedInventoryItems } from '../shared/utils/inventoryStaleGuard.js';
import { mergeAdventureProfileForPersistence } from '../utils/adventureProfileMerge.js';
import { applyChessCaptureScoreForRemovedStones, applyChessMoveToSession, commitChessGoPlacementCaptures, getChessGoStoneCapturePointValue, normalizeChessGoSession, resolveChessCapturesByLiberty, validateChessMove } from '../shared/utils/chessGoRules.js';
import { detectAndConfirmTerritories } from '../shared/utils/castleGoRules.js';
import {
    coerceAdventureLiveGameScoringTurnLimit,
    getClientArenaStateBucket,
    mergeGameUpdateByArena,
    mergeLiveRejoinResponseWithExistingBoard,
    preserveTerminalAnalysisResultOnMerge,
    preserveTerminalGameSessionOnMerge,
    preservePveAiHiddenPresentationOnMerge,
    shouldClearMissileFlightAnimationOnPlayingMerge,
    shouldIgnoreStaleLiveTerminalGameUpdate,
    shouldIgnoreStalePendingPveStartRegression,
    isPvePostStartConfirmPrePlayPhase,
    shouldIgnoreStalePendingAiLobbyStartRegression,
    buildOptimisticAiLobbyStartSession,
} from '../utils/clientGameMergePolicy.js';
import {
    augmentPveFromSessionStorageSnapshot,
    augmentLiveSessionFromSessionStorageSnapshot,
    boardGridHasAnyStones,
    getArenaStoreBucketForSession,
    isSessionPveArena,
    loadRecoverablePveGameFromSessionStorage,
} from '../utils/pveSessionStorageRestore.js';
import { buildPveItemActionClientSync } from '../utils/pveItemClientSync.js';
import {
    loadEndedPvpGameFromSessionStorage,
    persistEndedPvpGameToSessionStorage,
} from '../utils/endedPvpSessionStorage.js';
import { BOARD_SETTLE_BEFORE_SCORING_MS } from '../shared/constants/boardSettleTiming.js';
import { markPveBoardSettledForScoring } from '../shared/utils/pveScoringBoardSettleSignal.js';
import { computeGameSessionFingerprint } from '../utils/gameSessionFingerprint.js';

const pveAutoScoringScheduledStorageKey = (gameId: string) => `pveAutoScoringScheduled:${gameId}`;
import {
    pickRicherWsBoardSnapshot,
    resolveChessPvePlayingSession,
    resolvePveScoringBoardAndMoveHistory,
    resolveStrategicPvePlayingBoardAndMoveHistory,
    resolveStrategicPlayingBoardAndMoveHistory,
    replayStrategicBoardFromMoveHistory,
    shouldResolveStrategicPlayingBoardForMatchAxis,
} from '../utils/deferredWsBoardSnapshot.js';
import { coerceUserLevelXpFromPayload } from '../shared/utils/userLevelMerge.js';
import type { LevelUpCelebrationPayload } from '../types/levelUpModal.js';
import type { MannerGradeChangePayload } from '../types/mannerGradeChangeModal.js';
import { getMannerRank, MANNER_RANKS } from '../services/manner.js';
import {
    markChampionshipVersusKataRewardsPending,
    registerChampionshipVersusDeferredLevelUpFlush,
    shouldDeferLevelUpCelebrationForChampionshipVersusKata,
} from '../utils/championshipVersusLevelUpDeferral.js';
import { buildAdminGameResultModalDemoSession } from '../utils/adminGameResultModalDemo.js';

type ConnectionStatusKind = 'ok' | 'connecting' | 'reconnecting' | 'degraded' | 'requestFailed';
type ConnectionStatusSeverity = 'info' | 'success' | 'warning' | 'error';

type AppConnectionStatus = {
    kind: ConnectionStatusKind;
    message: string | null;
    severity: ConnectionStatusSeverity;
    updatedAt: number;
};

type GameRejoinFailureReason = 'network' | 'notFound';

type GameRejoinFailure = {
    gameId: string;
    reason: GameRejoinFailureReason;
    message: string;
};

type ContentUnlockType = 'tower' | 'adventure';

const CONNECTION_OK_STATUS: AppConnectionStatus = {
    kind: 'ok',
    message: null,
    severity: 'success',
    updatedAt: 0,
};

const isTransientServerStatus = (status: number): boolean =>
    status === 0 || status === 502 || status === 503 || status === 504;

const buildPveEndGameSnapshotPayload = (game: LiveGameSession | null | undefined): Record<string, unknown> => {
    if (!game) return {};
    return {
        boardState: Array.isArray(game.boardState) ? game.boardState.map((row) => [...row]) : undefined,
        moveHistory: Array.isArray(game.moveHistory) ? game.moveHistory.map((move) => ({ ...move })) : undefined,
        captures: game.captures ? { ...game.captures } : undefined,
        baseStoneCaptures: game.baseStoneCaptures ? { ...game.baseStoneCaptures } : undefined,
        hiddenStoneCaptures: game.hiddenStoneCaptures ? { ...game.hiddenStoneCaptures } : undefined,
        permanentlyRevealedStones: Array.isArray(game.permanentlyRevealedStones)
            ? game.permanentlyRevealedStones.map((point) => ({ ...point }))
            : undefined,
        blackPatternStones: Array.isArray(game.blackPatternStones)
            ? game.blackPatternStones.map((point) => ({ ...point }))
            : undefined,
        whitePatternStones: Array.isArray(game.whitePatternStones)
            ? game.whitePatternStones.map((point) => ({ ...point }))
            : undefined,
        consumedPatternIntersections: Array.isArray((game as any).consumedPatternIntersections)
            ? (game as any).consumedPatternIntersections.map((point: Point) => ({ ...point }))
            : undefined,
        hiddenMoves: game.hiddenMoves ? { ...game.hiddenMoves } : undefined,
        totalTurns: game.totalTurns,
        lastMove: game.lastMove ? { ...game.lastMove } : undefined,
    };
};

/** 플레이어별 누적치(따내기 점수 등): 더 큰 값만 유지 — 서버·클라 중 한쪽만 갱신된 경우에도 감소하지 않게 함 */
function mergeMonotonicCountRecord<T extends LiveGameSession['captures'] | LiveGameSession['baseStoneCaptures']>(
    a: T,
    b: T
): T {
    if (!a && !b) return a;
    const keys = new Set<number>();
    for (const src of [a, b]) {
        if (src && typeof src === 'object') {
            for (const k of Object.keys(src as object)) keys.add(Number(k));
        }
    }
    if (keys.size === 0) return (a ?? b) as T;
    const out: Record<number, number> = {};
    for (const k of keys) {
        const av = Number((a as any)?.[k]) || 0;
        const bv = Number((b as any)?.[k]) || 0;
        out[k] = Math.max(av, bv);
    }
    return out as T;
}

function mergeSpeedTimePressureSettingsMonotonic(
    prevSettings: LiveGameSession['settings'] | undefined,
    nextSettings: LiveGameSession['settings']
): LiveGameSession['settings'] {
    if (!prevSettings) return nextSettings;

    const merged: any = { ...prevSettings, ...nextSettings };
    const prevPenalty = (prevSettings as any).__speedTurnPenaltyCommitted as { black?: number; white?: number } | undefined;
    const nextPenalty = (nextSettings as any).__speedTurnPenaltyCommitted as { black?: number; white?: number } | undefined;
    if (prevPenalty || nextPenalty) {
        merged.__speedTurnPenaltyCommitted = {
            black: Math.max(0, Number(prevPenalty?.black ?? 0), Number(nextPenalty?.black ?? 0)),
            white: Math.max(0, Number(prevPenalty?.white ?? 0), Number(nextPenalty?.white ?? 0)),
        };
    }

    const prevGranted = (prevSettings as any).__speedTimePressureGranted as { black?: number; white?: number } | undefined;
    const nextGranted = (nextSettings as any).__speedTimePressureGranted as { black?: number; white?: number } | undefined;
    if (prevGranted || nextGranted) {
        merged.__speedTimePressureGranted = {
            black: Math.max(0, Number(prevGranted?.black ?? 0), Number(nextGranted?.black ?? 0)),
            white: Math.max(0, Number(prevGranted?.white ?? 0), Number(nextGranted?.white ?? 0)),
        };
    }

    return merged;
}

function mergeGameWithMonotonicCounters(
    prev: LiveGameSession | undefined,
    next: LiveGameSession,
    id?: string
): LiveGameSession {
    const merged = { ...(prev || {}), ...next } as LiveGameSession;
    if (id) merged.id = id;
    merged.captures = mergeMonotonicCountRecord(
        prev?.captures as LiveGameSession['captures'],
        merged.captures as LiveGameSession['captures']
    );
    merged.baseStoneCaptures = mergeMonotonicCountRecord(
        prev?.baseStoneCaptures as LiveGameSession['baseStoneCaptures'],
        merged.baseStoneCaptures as LiveGameSession['baseStoneCaptures']
    );
    merged.hiddenStoneCaptures = mergeMonotonicCountRecord(
        prev?.hiddenStoneCaptures as LiveGameSession['hiddenStoneCaptures'],
        merged.hiddenStoneCaptures as LiveGameSession['hiddenStoneCaptures']
    );
    merged.settings = mergeSpeedTimePressureSettingsMonotonic(
        prev?.settings,
        merged.settings as LiveGameSession['settings']
    );
    return merged;
}

/**
 * 도전의 탑: 수순 길이가 같을 때 서버 패킷의 따내기 점수만 늦게 오면 UI가 줄어드는 문제 보정.
 * (동일 수순인데 serverRevision만 큰 GAME_UPDATE가 전체 세션을 덮을 때)
 */
function mergeTowerPveMonotonicCaptureFieldsFromClient(
    mergedGame: LiveGameSession,
    clientSnapshot: LiveGameSession | undefined
): LiveGameSession {
    if (!clientSnapshot) return mergedGame;
    const clientMoves = clientSnapshot.moveHistory?.length ?? 0;
    const mergedMoves = mergedGame.moveHistory?.length ?? 0;
    if (clientMoves !== mergedMoves || clientMoves === 0) return mergedGame;

    const nextCaptures = mergeMonotonicCountRecord(mergedGame.captures, clientSnapshot.captures);
    const nextBsc = mergeMonotonicCountRecord(mergedGame.baseStoneCaptures, clientSnapshot.baseStoneCaptures);
    const nextHsc = mergeMonotonicCountRecord(mergedGame.hiddenStoneCaptures, clientSnapshot.hiddenStoneCaptures);

    const capChanged = stableStringify(mergedGame.captures || {}) !== stableStringify(nextCaptures || {});
    const bscChanged = stableStringify(mergedGame.baseStoneCaptures || {}) !== stableStringify(nextBsc || {});
    const hscChanged = stableStringify(mergedGame.hiddenStoneCaptures || {}) !== stableStringify(nextHsc || {});

    if (!capChanged && !bscChanged && !hscChanged) return mergedGame;
    return {
        ...mergedGame,
        captures: nextCaptures,
        baseStoneCaptures: nextBsc,
        hiddenStoneCaptures: nextHsc,
    };
}

/** 도전의 탑 PVE: 일반 수는 클라이언트만 반영되어 서버 game의 판·수순이 뒤처질 수 있음. 히든/스캔/미사일 선택 진입 시 응답으로 덮어쓰면 판이 초기화되는 버그 방지. */
function mergeTowerServerGameWithClientBoardIfStale(
    serverGame: LiveGameSession,
    clientGame: LiveGameSession | undefined
): LiveGameSession {
    if (!clientGame) return serverGame;
    const clientMoves = clientGame.moveHistory?.length ?? 0;
    const serverMoves = serverGame.moveHistory?.length ?? 0;
    const rowHasStone = (row: unknown) =>
        Array.isArray(row) && row.some((cell: unknown) => cell !== 0 && cell !== null && cell !== undefined);
    const boardHasStones = (board: unknown) =>
        Array.isArray(board) && board.some(rowHasStone);
    const clientBoardHasStones = boardHasStones(clientGame.boardState);
    const serverBoardHasStones = boardHasStones(serverGame.boardState);
    const clientAhead = clientMoves > serverMoves;
    const serverBoardStale = clientMoves > 0 && !serverBoardHasStones;
    const equalMovesButServerEmptyBoard =
        clientMoves === serverMoves && clientMoves > 0 && clientBoardHasStones && !serverBoardHasStones;
    if (!clientAhead && !serverBoardStale && !equalMovesButServerEmptyBoard) return serverGame;
    // 턴 추가 보너스: max(서버,클라)면 낙관적(+3) 직후 서버(+3) 패킷에서 6으로 이중 누적됨 → 서버 필드가 있으면 서버를 신뢰한다.
    const srvBonusRaw = (serverGame as any).blackTurnLimitBonus;
    const serverBonusDefined = srvBonusRaw !== undefined && srvBonusRaw !== null;
    const bonusMerged = serverBonusDefined
        ? Number(srvBonusRaw) || 0
        : Math.max(Number((serverGame as any).blackTurnLimitBonus) || 0, Number((clientGame as any).blackTurnLimitBonus) || 0);
    const preserveClientTurnAfterHiddenCommit = shouldIgnoreStaleServerHiddenPlacingAfterClientCommit(
        clientGame,
        serverGame,
    );
    const preserveClientHiddenRevealPresentation =
        clientGame.gameStatus === 'hidden_reveal_animating' &&
        isItemPhasePresentationStillActive(clientGame);
    return {
        ...serverGame,
        // 서버 페이로드에 settings 키가 덜 실릴 때 클라이언트 값(kataServerLevel 등)을 보존한 뒤 서버가 준 필드로 덮음.
        settings: {
            ...((clientGame as any).settings && typeof (clientGame as any).settings === 'object'
                ? (clientGame as any).settings
                : {}),
            ...((serverGame as any).settings && typeof (serverGame as any).settings === 'object'
                ? (serverGame as any).settings
                : {}),
        },
        boardState: clientGame.boardState,
        moveHistory: clientGame.moveHistory,
        totalTurns: clientGame.totalTurns ?? serverGame.totalTurns,
        captures: mergeMonotonicCountRecord(serverGame.captures, clientGame.captures),
        koInfo: clientGame.koInfo ?? serverGame.koInfo,
        hiddenMoves: clientGame.hiddenMoves ?? serverGame.hiddenMoves,
        humanHiddenStonePoints: (clientGame as any).humanHiddenStonePoints ?? (serverGame as any).humanHiddenStonePoints,
        resultContract: serverGame.resultContract ?? clientGame.resultContract,
        ...(bonusMerged > 0 || serverBonusDefined ? { blackTurnLimitBonus: bonusMerged } : {}),
        ...((clientGame as { aiInitialHiddenStone?: { x: number; y: number } | null }).aiInitialHiddenStone !== undefined
            ? {
                  aiInitialHiddenStone: (clientGame as { aiInitialHiddenStone?: { x: number; y: number } | null })
                      .aiInitialHiddenStone,
              }
            : {}),
        permanentlyRevealedStones: clientGame.permanentlyRevealedStones ?? serverGame.permanentlyRevealedStones,
        blackPatternStones: clientGame.blackPatternStones ?? serverGame.blackPatternStones,
        whitePatternStones: clientGame.whitePatternStones ?? serverGame.whitePatternStones,
        consumedPatternIntersections:
            (clientGame as any).consumedPatternIntersections ?? (serverGame as any).consumedPatternIntersections,
        revealedHiddenMoves: clientGame.revealedHiddenMoves ?? serverGame.revealedHiddenMoves,
        serverRevision: Math.max(clientGame.serverRevision ?? 0, serverGame.serverRevision ?? 0),
        // 경기 중 상점 구매 등: 응답의 세션 잔여(미사일·히든·스캔)는 판·수순 병합 후에도 서버 값을 유지
        missiles_p1: (serverGame as any).missiles_p1 ?? (clientGame as any).missiles_p1,
        missiles_p2: (serverGame as any).missiles_p2 ?? (clientGame as any).missiles_p2,
        hidden_stones_p1: (serverGame as any).hidden_stones_p1 ?? (clientGame as any).hidden_stones_p1,
        hidden_stones_p2: (serverGame as any).hidden_stones_p2 ?? (clientGame as any).hidden_stones_p2,
        scans_p1: (serverGame as any).scans_p1 ?? (clientGame as any).scans_p1,
        scans_p2: (serverGame as any).scans_p2 ?? (clientGame as any).scans_p2,
        baseStoneCaptures: mergeMonotonicCountRecord(serverGame.baseStoneCaptures, clientGame.baseStoneCaptures),
        hiddenStoneCaptures: mergeMonotonicCountRecord(serverGame.hiddenStoneCaptures, clientGame.hiddenStoneCaptures),
        ...(preserveClientTurnAfterHiddenCommit
            ? {
                  gameStatus: clientGame.gameStatus,
                  currentPlayer: clientGame.currentPlayer,
                  itemUseDeadline: clientGame.itemUseDeadline,
                  itemPhaseActingPlayer: (clientGame as any).itemPhaseActingPlayer,
                  pausedTurnTimeLeft: clientGame.pausedTurnTimeLeft,
                  turnDeadline: clientGame.turnDeadline,
                  turnStartTime: clientGame.turnStartTime,
              }
            : {}),
        ...(preserveClientHiddenRevealPresentation
            ? {
                  gameStatus: clientGame.gameStatus,
                  animation: clientGame.animation,
                  revealAnimationEndTime: clientGame.revealAnimationEndTime,
                  pendingCapture: clientGame.pendingCapture,
                  currentPlayer: clientGame.currentPlayer,
                  permanentlyRevealedStones:
                      clientGame.permanentlyRevealedStones ?? serverGame.permanentlyRevealedStones,
              }
            : {}),
    };
}

/** INITIAL_STATE 스냅샷이 pending인데 로컬 세션이 이미 진행 중이면 덮어쓰지 않음 (재연결·서버 목록 시차로 계가 직후 타워 설명 모달이 뜨는 현상 방지) */
function shouldKeepLocalSessionOverIncomingPending(prevG: LiveGameSession, incoming: LiveGameSession): boolean {
    if ((incoming.gameStatus || '') !== 'pending') return false;
    const s = prevG.gameStatus || '';
    return s === 'playing' || s === 'scoring' || s === 'hidden_final_reveal' || s === 'ended' || s === 'no_contest';
}

/**
 * AI 수 지연 연출(1초) 타이머가 늦게 실행되며 더 최신 상태를 되돌리는 레이스를 방지한다.
 * - 최신 서버 리비전/수순이 더 앞서면 지연 스냅샷 적용 금지
 * - 수순 길이가 같아도 마지막 착수 좌표가 다르면(다른 분기 패킷) 적용 금지
 */
function shouldSkipDelayedAiSnapshotApply(
    latestGame: LiveGameSession | undefined,
    delayedSnapshot: LiveGameSession
): boolean {
    if (!latestGame) return false;
    if (isItemPhasePresentationStillActive(latestGame)) return true;
    const latestStatus = String(latestGame.gameStatus || '');
    const delayedStatus = String(delayedSnapshot.gameStatus || '');
    const terminalOrRevealStatuses = new Set([
        'hidden_reveal_animating',
        'hidden_final_reveal',
        'scoring',
        'ended',
        'no_contest',
    ]);
    // 히든 공개/계가/종료로 이미 진행된 최신 상태를 1초 지연 스냅샷(대부분 playing)이 되돌리지 않게 차단.
    if (terminalOrRevealStatuses.has(latestStatus) && !terminalOrRevealStatuses.has(delayedStatus)) {
        return true;
    }
    if (latestStatus === 'hidden_reveal_animating' && delayedStatus !== 'hidden_reveal_animating') {
        return true;
    }
    const latestAnimType = (latestGame.animation as { type?: string } | null | undefined)?.type;
    const delayedAnimType = (delayedSnapshot.animation as { type?: string } | null | undefined)?.type;
    if (latestAnimType === 'hidden_reveal' && delayedAnimType !== 'hidden_reveal') {
        return true;
    }
    const latestRevealEnd = latestGame.revealAnimationEndTime ?? 0;
    const delayedRevealEnd = delayedSnapshot.revealAnimationEndTime ?? 0;
    if (latestRevealEnd > delayedRevealEnd) {
        return true;
    }

    const latestRevision = latestGame.serverRevision ?? 0;
    const delayedRevision = delayedSnapshot.serverRevision ?? 0;
    if (latestRevision > delayedRevision) return true;

    const latestMoves = latestGame.moveHistory?.length ?? 0;
    const delayedMoves = delayedSnapshot.moveHistory?.length ?? 0;
    if (latestMoves > delayedMoves) return true;

    // 수순 길이가 같아도 마지막 착수가 다르면 더 최신 국면(다른 분기)일 수 있으므로
    // 늦게 도착한 지연 스냅샷이 최신 상태를 덮어쓰지 않게 차단한다.
    if (latestMoves > 0 && latestMoves === delayedMoves) {
        const getLastPlacedPoint = (g: LiveGameSession): { x: number; y: number } | null => {
            const history = g.moveHistory;
            if (!Array.isArray(history) || history.length === 0) return null;
            for (let i = history.length - 1; i >= 0; i--) {
                const m = history[i] as { x?: unknown; y?: unknown } | undefined;
                if (!m) continue;
                const x = m.x;
                const y = m.y;
                if (
                    typeof x === 'number' &&
                    typeof y === 'number' &&
                    Number.isFinite(x) &&
                    Number.isFinite(y) &&
                    x >= 0 &&
                    y >= 0
                ) {
                    return { x, y };
                }
            }
            return null;
        };

        const latestLast = getLastPlacedPoint(latestGame);
        const delayedLast = getLastPlacedPoint(delayedSnapshot);
        if (
            latestLast &&
            delayedLast &&
            (latestLast.x !== delayedLast.x || latestLast.y !== delayedLast.y)
        ) {
            return true;
        }
    }

    return false;
}

/** AI 수 지연(1초) 연출을 건너뛰고 즉시 반영해야 하는 PVE 스냅샷 — 히든 전체공개·계가·종료 등 */
function shouldApplyPveAiMoveSnapshotImmediately(game: LiveGameSession | undefined): boolean {
    if (!game) return false;
    const status = String(game.gameStatus || '');
    if (
        status === 'hidden_reveal_animating' ||
        status === 'hidden_final_reveal' ||
        status === 'scoring' ||
        status === 'ended' ||
        status === 'no_contest'
    ) {
        return true;
    }
    const animType = (game.animation as { type?: string } | null | undefined)?.type;
    return animType === 'hidden_reveal';
}

function shiftDelayedAiSnapshotTurnClock(game: LiveGameSession, delayedByMs: number): LiveGameSession {
    if (!Number.isFinite(delayedByMs) || delayedByMs <= 0) return game;
    const status = String(game.gameStatus || '');
    const anim = game.animation as { type?: string; startTime?: number; duration?: number } | null | undefined;
    const isHiddenRevealSnapshot =
        status === 'hidden_reveal_animating' || anim?.type === 'hidden_reveal';
    if (!['playing', 'hidden_placing'].includes(status) && !isHiddenRevealSnapshot) return game;
    const shifted: LiveGameSession = { ...game };
    if (typeof shifted.turnDeadline === 'number' && Number.isFinite(shifted.turnDeadline)) {
        shifted.turnDeadline += delayedByMs;
    }
    if (typeof shifted.turnStartTime === 'number' && Number.isFinite(shifted.turnStartTime)) {
        shifted.turnStartTime += delayedByMs;
    }
    if (isHiddenRevealSnapshot && anim?.type === 'hidden_reveal') {
        const duration = typeof anim.duration === 'number' ? anim.duration : 0;
        const shiftedStart =
            typeof anim.startTime === 'number' && Number.isFinite(anim.startTime)
                ? anim.startTime + delayedByMs
                : Date.now();
        shifted.animation = {
            ...(anim as object),
            type: 'hidden_reveal',
            startTime: shiftedStart,
            duration,
        } as LiveGameSession['animation'];
        shifted.revealAnimationEndTime =
            typeof shifted.revealAnimationEndTime === 'number' && Number.isFinite(shifted.revealAnimationEndTime)
                ? shifted.revealAnimationEndTime + delayedByMs
                : shiftedStart + duration;
    }
    return shifted;
}

type PairAiMoveRevealQueue = {
    snapshots: LiveGameSession[];
    drainTimerId: ReturnType<typeof setTimeout> | null;
};

function clearPairAiMoveRevealQueue(
    gameId: string,
    queuesRef: React.MutableRefObject<Record<string, PairAiMoveRevealQueue>>,
): void {
    const q = queuesRef.current[gameId];
    if (!q) return;
    if (q.drainTimerId != null) clearTimeout(q.drainTimerId);
    delete queuesRef.current[gameId];
}

function drainNextPairAiMoveReveal(
    gameId: string,
    delayMs: number,
    queuesRef: React.MutableRefObject<Record<string, PairAiMoveRevealQueue>>,
    applySnapshot: (gameId: string, snapshot: LiveGameSession) => void,
): void {
    const q = queuesRef.current[gameId];
    if (!q || q.snapshots.length === 0) {
        if (q) q.drainTimerId = null;
        return;
    }
    const snapshot = q.snapshots.shift()!;
    q.drainTimerId = setTimeout(() => {
        applySnapshot(gameId, snapshot);
        drainNextPairAiMoveReveal(gameId, delayMs, queuesRef, applySnapshot);
    }, delayMs);
}

function isPairAiMoveInHistory(
    move: { actorId?: string; pairSeatId?: string; player?: Player } | null | undefined,
    pairTurnOrder: Array<{ participantId?: string; seatId?: string; kind?: string }>,
): boolean {
    if (!move) return false;
    const lastPairSeat = pairTurnOrder.find(
        (seat) =>
            seat &&
            ((move.actorId && seat.participantId === move.actorId) ||
                (move.pairSeatId && seat.seatId === move.pairSeatId)),
    );
    if (lastPairSeat) return isPairAiSeat(lastPairSeat as any);
    const actorId = move.actorId;
    return (
        typeof actorId === 'string' &&
        (actorId.startsWith('pair-') || actorId.startsWith('pet-ai-'))
    );
}

function buildIncrementalPairAiRevealSnapshots(
    target: LiveGameSession,
    fromMoveCount: number,
): LiveGameSession[] {
    const history = target.moveHistory ?? [];
    const end = history.length;
    if (end <= fromMoveCount) return [];

    const order = target.settings?.pairGame?.turnOrder ?? [];
    const len = order.length || 4;
    const boardSize = target.settings?.boardSize ?? target.boardState?.length ?? 19;
    const snapshots: LiveGameSession[] = [];

    for (let i = fromMoveCount + 1; i <= end; i++) {
        const partialHistory = history.slice(0, i);
        const last = partialHistory[i - 1] as { x?: number; y?: number; player?: Player } | undefined;
        const turnIndex = i % len;
        const nextSeat = order[turnIndex];
        const boardState = buildBoardFromMoves(
            boardSize,
            partialHistory as Array<{ player: Player; x: number; y: number }>,
            i,
        ).map((row) => [...row]);

        snapshots.push({
            ...target,
            moveHistory: partialHistory,
            boardState,
            lastMove:
                last && typeof last.x === 'number' && typeof last.y === 'number'
                    ? { x: last.x, y: last.y }
                    : target.lastMove,
            currentPlayer: nextSeat?.player ?? target.currentPlayer,
            settings: {
                ...target.settings,
                pairGame: target.settings?.pairGame
                    ? {
                          ...target.settings.pairGame,
                          currentTurnIndex: turnIndex,
                      }
                    : target.settings?.pairGame,
            },
        });
    }
    return snapshots;
}

function enqueuePairAiMoveReveal(
    gameId: string,
    snapshot: LiveGameSession,
    delayMs: number,
    baselineMoveCount: number,
    queuesRef: React.MutableRefObject<Record<string, PairAiMoveRevealQueue>>,
    applySnapshot: (gameId: string, snapshot: LiveGameSession) => void,
): void {
    const incomingMoves = snapshot.moveHistory?.length ?? 0;
    if (incomingMoves <= baselineMoveCount) return;

    let q = queuesRef.current[gameId];
    if (!q) {
        q = { snapshots: [], drainTimerId: null };
        queuesRef.current[gameId] = q;
    }

    const lastQueuedMoves =
        q.snapshots.length > 0
            ? (q.snapshots[q.snapshots.length - 1]!.moveHistory?.length ?? 0)
            : baselineMoveCount;
    if (incomingMoves <= lastQueuedMoves) return;

    const incrementalSnapshots =
        incomingMoves - lastQueuedMoves > 1
            ? buildIncrementalPairAiRevealSnapshots(snapshot, lastQueuedMoves)
            : [snapshot];
    for (const partial of incrementalSnapshots) {
        q.snapshots.push(partial);
    }
    if (q.drainTimerId == null) {
        drainNextPairAiMoveReveal(gameId, delayMs, queuesRef, applySnapshot);
    }
}

function getLastPlacedPointForStaleCheck(g: LiveGameSession | undefined): { x: number; y: number } | null {
    const history = g?.moveHistory;
    if (!Array.isArray(history) || history.length === 0) return null;
    for (let i = history.length - 1; i >= 0; i--) {
        const m = history[i] as { x?: unknown; y?: unknown } | undefined;
        const x = m?.x;
        const y = m?.y;
        if (
            typeof x === 'number' &&
            typeof y === 'number' &&
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            x >= 0 &&
            y >= 0
        ) {
            return { x, y };
        }
    }
    return null;
}

function liveGamePayloadHasRenderableBoardGrid(game: LiveGameSession | undefined): boolean {
    const b = game?.boardState;
    return !!(
        b &&
        Array.isArray(b) &&
        b.length > 0 &&
        b.some((row: any[]) => row && Array.isArray(row) && row.some((c: any) => c !== 0 && c != null))
    );
}

function getBaseFinalColorAssignment(game: LiveGameSession | undefined): { blackPlayerId: string; whitePlayerId: string } | null {
    const assignment = (game as any)?.baseFinalColorAssignment;
    const blackPlayerId = assignment?.blackPlayerId;
    const whitePlayerId = assignment?.whitePlayerId;
    if (typeof blackPlayerId === 'string' && typeof whitePlayerId === 'string') {
        return { blackPlayerId, whitePlayerId };
    }
    return null;
}

function isBasePrePlayStatus(status: LiveGameSession['gameStatus'] | undefined): boolean {
    return (
        status === 'base_placement' ||
        status === 'base_stone_color_choice' ||
        status === 'base_same_color_points_bid' ||
        status === 'base_game_start_confirmation'
    );
}

/**
 * `playing`(또는 시작 확인) 이후 서버가 고정한 흑/백 좌석을 유지·적용 (베이스 배치 단계 임시 좌석 역주입 방지).
 * 서버는 색이 확정되는 시점(finalize/komi bid 결과)에 좌석 잠금까지 같이 박는다 — `base_game_start_confirmation`에도
 * 잠금이 적용되어 있어야, 시작 확인 모달 단계에서 늦게 도착한 슬림 패킷이 좌석을 임시값으로 되돌리지 못한다.
 */
const SEAT_LOCK_ENFORCE_STATUSES: ReadonlySet<string> = new Set([
    'base_game_start_confirmation',
    'playing',
]);
function reconcilePlayingSeatLock(merged: LiveGameSession, existing?: LiveGameSession): LiveGameSession {
    let next = merged;
    const status = String(next.gameStatus ?? '');
    const exB = existing?.playingLockedBlackPlayerId;
    const exW = existing?.playingLockedWhitePlayerId;
    if (
        SEAT_LOCK_ENFORCE_STATUSES.has(status) &&
        typeof exB === 'string' &&
        exB.length > 0 &&
        typeof exW === 'string' &&
        exW.length > 0 &&
        (!next.playingLockedBlackPlayerId || !next.playingLockedWhitePlayerId)
    ) {
        next = { ...next, playingLockedBlackPlayerId: exB, playingLockedWhitePlayerId: exW };
    }
    const lb = next.playingLockedBlackPlayerId;
    const lw = next.playingLockedWhitePlayerId;
    if (
        SEAT_LOCK_ENFORCE_STATUSES.has(status) &&
        typeof lb === 'string' &&
        lb.length > 0 &&
        typeof lw === 'string' &&
        lw.length > 0
    ) {
        if (next.blackPlayerId !== lb || next.whitePlayerId !== lw) {
            next = { ...next, blackPlayerId: lb, whitePlayerId: lw };
        }
    }
    return next;
}

/**
 * 베이스 본대국: 낙관적 업데이트·지연 WS가 `blackPlayerId`/`whitePlayerId`를 임시 좌석으로 덮어
 * 수순은 같은데 진영만 바뀌는 현상 방지 — 클라에 이미 잠금과 일치한 좌석이 있으면 그것을 우선한다.
 */
function preferClientLockedStrategicSeatsOverIncomingDrift(
    merged: LiveGameSession,
    existing: LiveGameSession | undefined,
): LiveGameSession {
    if (!existing) return merged;
    const includesBase = liveSessionIncludesBaseMode(merged) || liveSessionIncludesBaseMode(existing);
    if (!includesBase) return merged;
    if (merged.gameStatus !== 'playing') return merged;

    const elb = existing.playingLockedBlackPlayerId;
    const elw = existing.playingLockedWhitePlayerId;
    if (typeof elb !== 'string' || elb.length === 0 || typeof elw !== 'string' || elw.length === 0) return merged;
    if (existing.blackPlayerId !== elb || existing.whitePlayerId !== elw) return merged;

    const im = merged.moveHistory?.length ?? 0;
    const ex = existing.moveHistory?.length ?? 0;
    if (im > ex) return merged;

    if (
        merged.blackPlayerId === existing.blackPlayerId &&
        merged.whitePlayerId === existing.whitePlayerId &&
        merged.playingLockedBlackPlayerId === elb &&
        merged.playingLockedWhitePlayerId === elw
    ) {
        return merged;
    }

    const out: LiveGameSession = {
        ...merged,
        blackPlayerId: existing.blackPlayerId,
        whitePlayerId: existing.whitePlayerId,
        playingLockedBlackPlayerId: elb,
        playingLockedWhitePlayerId: elw,
    };
    const bfa = (existing as { baseFinalColorAssignment?: unknown }).baseFinalColorAssignment;
    if (bfa && typeof bfa === 'object') {
        (out as any).baseFinalColorAssignment = bfa;
    }
    return out;
}

/**
 * 베이스(순·믹스) playing: 보드 생략 슬림 WS에서 수순·판은 로컬과 동일한데 currentPlayer만 어긋날 때(차례 역전) 로컬 턴으로 맞춘다.
 */
function alignBaseModeCurrentPlayerWithExistingWhenSlimDrift(
    merged: LiveGameSession,
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
    opts: { playfulTrustEmptyServerBoardSnapshot?: boolean } = {}
): LiveGameSession {
    const finish = (out: LiveGameSession) => reconcilePlayingSeatLock(out, existing);

    if (!existing) return finish(merged);
    const includesBase =
        liveSessionIncludesBaseMode(merged) ||
        liveSessionIncludesBaseMode(incoming) ||
        liveSessionIncludesBaseMode(existing);
    if (!includesBase) return finish(merged);

    const existingFinalAssignment = getBaseFinalColorAssignment(existing);
    const incomingFinalAssignment =
        getBaseFinalColorAssignment(incoming) ?? getBaseFinalColorAssignment(merged);
    if (existingFinalAssignment && !incomingFinalAssignment) {
        if (isBasePrePlayStatus(incoming.gameStatus)) return finish(existing);
        return finish({
            ...merged,
            blackPlayerId: existingFinalAssignment.blackPlayerId,
            whitePlayerId: existingFinalAssignment.whitePlayerId,
        });
    }
    if (incomingFinalAssignment) {
        merged = {
            ...merged,
            blackPlayerId: incomingFinalAssignment.blackPlayerId,
            whitePlayerId: incomingFinalAssignment.whitePlayerId,
        };
    }

    // 흑/백 좌석이 서버에서 바뀐 직후: 판·수순 문자열은 같아 보여도 currentPlayer는 서버(merged)를 신뢰해야 한다.
    if (
        existing.blackPlayerId &&
        existing.whitePlayerId &&
        merged.blackPlayerId &&
        merged.whitePlayerId &&
        (existing.blackPlayerId !== merged.blackPlayerId || existing.whitePlayerId !== merged.whitePlayerId)
    ) {
        // 슬림·낡은 패킷: 수순·판은 동일한데 좌석만 바뀐 경우 — 본대국 중에는 잘못된 덮어쓰기로 간주하고 기존 좌석 유지
        if (
            merged.gameStatus === 'playing' &&
            (existing.moveHistory?.length ?? 0) > 0 &&
            stableStringify(merged.moveHistory) === stableStringify(existing.moveHistory) &&
            stableStringify(merged.boardState) === stableStringify(existing.boardState)
        ) {
            return finish({
                ...merged,
                blackPlayerId: existing.blackPlayerId,
                whitePlayerId: existing.whitePlayerId,
            });
        }
        return finish(merged);
    }
    if (!liveSessionIncludesBaseMode(merged) || merged.gameStatus !== 'playing') return finish(merged);
    if (merged.mode === GameMode.Dice || merged.mode === GameMode.Thief) return finish(merged);
    if (opts.playfulTrustEmptyServerBoardSnapshot) return finish(merged);

    const incomingMoveCount = incoming.moveHistory?.length ?? 0;
    const existingMoveCount = existing.moveHistory?.length ?? 0;
    if (incomingMoveCount > existingMoveCount) return finish(merged);

    if (liveGamePayloadHasRenderableBoardGrid(incoming)) return finish(merged);

    const eb = existing.boardState;
    const existingBoardValid =
        eb && Array.isArray(eb) && eb.length > 0 && eb[0] && Array.isArray(eb[0]) && eb[0].length > 0;
    if (!existingBoardValid) return finish(merged);

    if (
        stableStringify(merged.moveHistory) !== stableStringify(existing.moveHistory) ||
        stableStringify(merged.boardState) !== stableStringify(existing.boardState)
    ) {
        return finish(merged);
    }
    if (merged.currentPlayer === existing.currentPlayer) return finish(merged);

    // 페어 교대석은 수순만으로 다음 착석자를 복원하기 어렵다 — 기존(로컬 우선) 동작 유지
    const pairTurnOrder = (merged.settings as { pairGame?: { turnOrder?: unknown[] } } | undefined)?.pairGame?.turnOrder;
    if (Array.isArray(pairTurnOrder) && pairTurnOrder.length > 0) {
        return finish({ ...merged, currentPlayer: existing.currentPlayer });
    }

    // 본대국 첫 수는 항상 흑. 이후는 수순 꼬리의 `player`로 다음 차례를 복원한다.
    const mh = merged.moveHistory ?? [];
    const expectedNext: Player =
        mh.length === 0
            ? Player.Black
            : inferCurrentPlayerFromLastStoredMove(mh[mh.length - 1] as { player?: number }) ?? Player.Black;

    const mergedMatches = merged.currentPlayer === expectedNext;
    const existingMatches = existing.currentPlayer === expectedNext;
    if (mergedMatches && !existingMatches) {
        return finish(merged);
    }
    if (existingMatches && !mergedMatches) {
        return finish({ ...merged, currentPlayer: existing.currentPlayer });
    }
    // 둘 다 맞거나 둘 다 어긋나면 서버(merged)를 신뢰 — 로컬만 고정하면 백 차례·아이템이 영구 비활성화될 수 있음
    return finish(merged);
}

function liveSessionIncludesBaseMode(g: LiveGameSession | undefined): boolean {
    if (!g) return false;
    if (
        typeof g.playingLockedBlackPlayerId === 'string' &&
        g.playingLockedBlackPlayerId.length > 0 &&
        typeof g.playingLockedWhitePlayerId === 'string' &&
        g.playingLockedWhitePlayerId.length > 0
    ) {
        return true;
    }
    if (getBaseFinalColorAssignment(g)) return true;
    if (g.mode === GameMode.Base) return true;
    if (g.mode === GameMode.Mix) {
        const mm = (g.settings as { mixedModes?: GameMode[] } | undefined)?.mixedModes;
        return Array.isArray(mm) && mm.includes(GameMode.Base);
    }
    if (Array.isArray(g.baseStones) && g.baseStones.length > 0) return true;
    if (typeof g.settings?.baseStones === 'number' && g.settings.baseStones > 0) return true;
    return false;
}

/** `pending`·베이스 사전 단계가 아닌 본대국·아이템·계가·종료 등 — 재접속 후 낡은 WS가 사전 단계로 되돌리는지 판별할 때 사용 */
function isPastBaseClientFlowGameStatus(status: LiveGameSession['gameStatus'] | undefined): boolean {
    if (!status) return false;
    if (status === 'pending') return false;
    if (isBasePrePlayStatus(status)) return false;
    return true;
}

/**
 * 베이스(순·믹스): 재연결 직후 등 늦게 도착한 GAME_UPDATE가 본대국 이후 상태를
 * `base_placement` 등 사전 단계로 덮어 베이스돌 배치 UI가 다시 뜨는 것을 막는다.
 * (같은 라운드에서만; 리비전이 확실히 앞선 패킷은 그대로 신뢰)
 */
function shouldIgnoreBaseModeGameStatusRegression(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
): boolean {
    if (!existing) return false;
    if (!liveSessionIncludesBaseMode(incoming) && !liveSessionIncludesBaseMode(existing)) return false;
    if ((incoming.round ?? 1) !== (existing.round ?? 1)) return false;
    if (!isBasePrePlayStatus(incoming.gameStatus)) return false;
    if (!isPastBaseClientFlowGameStatus(existing.gameStatus)) return false;
    const ir = incoming.serverRevision ?? 0;
    const er = existing.serverRevision ?? 0;
    if (ir > 0 && er > 0 && ir > er) return false;
    return true;
}

/** sessionStorage 수순 끝에서 차례 추론 — `player` 누락 시 Black으로 잘못 고정되면 흑백 차례·좌석 검사가 전부 어긋난다. */
function inferCurrentPlayerFromLastStoredMove(
    last: { player?: number } | null | undefined,
): Player | null {
    if (!last) return null;
    const pl = last.player;
    if (pl !== Player.Black && pl !== Player.White) return null;
    return pl === Player.Black ? Player.White : Player.Black;
}

/**
 * 일반 싱글/타워 PVE(베이스·덤 확정 좌석 제외): 병합/재연결에서 `blackPlayerId`만 AI·`whitePlayerId`만 유저로
 * 뒤집힌 경우를 생성 규칙(player1=유저·흑, player2=AI·백)에 맞게 복구한다.
 */
function coerceClassicPveHumanBlackSeatsIfSwapped(session: LiveGameSession): LiveGameSession {
    if (!session.player1?.id || !session.player2?.id) return session;
    if (session.player2.id !== aiUserId || session.player1.id === aiUserId) return session;
    if (liveSessionIncludesBaseMode(session)) return session;
    const humanId = session.player1.id;
    if (session.blackPlayerId === humanId && session.whitePlayerId === aiUserId) return session;
    if (session.blackPlayerId === aiUserId && session.whitePlayerId === humanId) {
        const next: LiveGameSession = {
            ...session,
            blackPlayerId: humanId,
            whitePlayerId: aiUserId,
        };
        const lb = session.playingLockedBlackPlayerId;
        const lw = session.playingLockedWhitePlayerId;
        if (lb === aiUserId && lw === humanId) {
            next.playingLockedBlackPlayerId = humanId;
            next.playingLockedWhitePlayerId = aiUserId;
        }
        return next;
    }
    return session;
}

/** 솔로 베이스(배치·선호·덤): 수순이 없어도 WS가 빠르게 연속으로 오므로 GAME_UPDATE 쓰로틀에서 제외 */
function isSoloBaseFlowUpdateThrottleBypass(g: LiveGameSession | undefined): boolean {
    if (!g || getSessionArenaKind(g) !== 'singleplayer' || !liveSessionIncludesBaseMode(g)) return false;
    const st = String(g.gameStatus);
    if (st.startsWith('base_')) return true;
    if (st === 'capture_bidding' || st === 'capture_reveal' || st === 'capture_tiebreaker') return true;
    return false;
}

function patchLiveGameInMapById(
    currentGames: Record<string, LiveGameSession>,
    gameId: string,
    mutate: (game: LiveGameSession) => LiveGameSession | null,
): Record<string, LiveGameSession> {
    const g = currentGames[gameId];
    if (!g) return currentGames;
    const next = mutate(g);
    if (!next) return currentGames;
    return { ...currentGames, [gameId]: next };
}

/** 온라인·페어 AI: LAUNCH 직후 서버가 이미 보드를 반영했으므로 연출 필드만 정리한다. */
function mutateLiveMissilePresentationComplete(game: LiveGameSession): LiveGameSession | null {
    const isTerminal =
        game.gameStatus === 'ended' || game.gameStatus === 'no_contest' || game.gameStatus === 'scoring';
    const hasMissileAnim =
        !!game.animation &&
        (game.animation.type === 'missile' || game.animation.type === 'hidden_missile');
    if (!hasMissileAnim && game.gameStatus !== 'missile_animating') {
        return null;
    }

    const animPlayer = (game.animation as { player?: Player } | null | undefined)?.player;
    const playerWhoMoved =
        animPlayer === Player.Black || animPlayer === Player.White ? animPlayer : game.currentPlayer;

    let updatedBlackTime = game.blackTimeLeft;
    let updatedWhiteTime = game.whiteTimeLeft;
    if (game.pausedTurnTimeLeft !== undefined && playerWhoMoved !== Player.None) {
        if (playerWhoMoved === Player.Black) {
            updatedBlackTime = game.pausedTurnTimeLeft;
        } else {
            updatedWhiteTime = game.pausedTurnTimeLeft;
        }
    }

    return {
        ...game,
        animation: null,
        gameStatus: isTerminal ? game.gameStatus : 'playing',
        blackTimeLeft: updatedBlackTime,
        whiteTimeLeft: updatedWhiteTime,
        pausedTurnTimeLeft: undefined,
        itemUseDeadline: undefined,
    };
}

function overlayChessPlayingFieldsFromExisting(
    merged: LiveGameSession,
    existing: LiveGameSession,
): LiveGameSession {
    if (merged.mode !== GameMode.Chess) return merged;
    const mergedHasPieces = (merged.chessPieces?.length ?? 0) > 0;
    return {
        ...merged,
        chessPieces: mergedHasPieces ? merged.chessPieces : existing.chessPieces,
        chessGoRemovedPoints: merged.chessGoRemovedPoints ?? existing.chessGoRemovedPoints,
        lastChessMove: merged.lastChessMove ?? existing.lastChessMove,
        chessPieceMovedThisTurn:
            merged.chessPieceMovedThisTurn ?? existing.chessPieceMovedThisTurn,
        chessCaptureScore: merged.chessCaptureScore ?? existing.chessCaptureScore,
    };
}

/** PVE/PVP playing: 슬림 WS(수순↑·boardState 생략)에서 판·수순을 한 쌍으로 맞춘다. */
function applyStrategicPlayingBoardAndMoveHistoryResolve(
    merged: LiveGameSession,
    clientSnapshot: LiveGameSession | undefined,
): LiveGameSession {
    if (merged.gameStatus !== 'playing') return merged;
    if (merged.mode === GameMode.Chess) {
        const policy = resolveArenaSessionPolicy(merged as any);
        if (policy.matchAxis === 'pve') {
            return resolveChessPvePlayingSession(merged, clientSnapshot);
        }
        return merged;
    }
    if (merged.mode === GameMode.Dice || merged.mode === GameMode.Thief) return merged;
    const policy = resolveArenaSessionPolicy(merged as any);
    if (!shouldResolveStrategicPlayingBoardForMatchAxis(policy.matchAxis)) return merged;
    const playingResolved = resolveStrategicPlayingBoardAndMoveHistory(
        merged,
        clientSnapshot ?? merged,
    );
    return {
        ...merged,
        boardState: playingResolved.boardState,
        moveHistory: playingResolved.moveHistory,
    };
}

function applyPvePlayingBoardAndMoveHistoryResolve(
    merged: LiveGameSession,
    clientSnapshot: LiveGameSession | undefined,
): LiveGameSession {
    return applyStrategicPlayingBoardAndMoveHistoryResolve(merged, clientSnapshot);
}

function mergePveGameUpdateFromWs(
    merged: LiveGameSession,
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
    deferredSnap: LiveGameSession | undefined,
): LiveGameSession {
    const richerExisting = (pickRicherWsBoardSnapshot(existing, deferredSnap) ?? existing) as
        | LiveGameSession
        | undefined;
    let next = merged;
    if (next.gameStatus === 'playing') {
        next = applyPvePlayingBoardAndMoveHistoryResolve(next, richerExisting);
    }
    next = mergeGameUpdateByArena(next, richerExisting, { source: 'game_update' });
    next = preserveLiveStrategicMainClockOnMerge(next, richerExisting, incoming);
    if (
        richerExisting &&
        (next.gameStatus === 'scoring' || next.gameStatus === 'ended' || next.gameStatus === 'no_contest')
    ) {
        const scoringResolved = resolvePveScoringBoardAndMoveHistory(next, richerExisting);
        next = {
            ...next,
            boardState: scoringResolved.boardState,
            moveHistory: scoringResolved.moveHistory,
        };
    }
    return preserveTerminalGameSessionOnMerge(next, existing);
}

function mergePveHttpActionGameResponse(
    merged: LiveGameSession,
    prevG: LiveGameSession | undefined,
    actionType: string,
): LiveGameSession {
    const isPveStartConfirm =
        actionType === 'CONFIRM_SINGLE_PLAYER_GAME_START' || actionType === 'CONFIRM_TOWER_GAME_START';
    if (
        !isPveStartConfirm &&
        prevG &&
        shouldIgnoreStaleLiveTerminalGameUpdate(merged, prevG)
    ) {
        return preserveTerminalGameSessionOnMerge(merged, prevG);
    }
    if (prevG && shouldIgnoreStalePendingPveStartRegression(merged, prevG)) {
        return prevG;
    }
    let next = applyPvePlayingBoardAndMoveHistoryResolve(merged, prevG);
    next = mergeGameUpdateByArena(next, prevG, { source: 'http_action', actionType });
    next = preserveLiveStrategicMainClockOnMerge(next, prevG, merged);
    if (isPveStartConfirm) {
        return next;
    }
    return preserveTerminalGameSessionOnMerge(next, prevG);
}

/** 페어 4인 수순: 낡은 GAME_UPDATE가 currentTurnIndex·currentPlayer를 되돌리면 유저 턴만 반복되는 버그 */
function preserveLiveStrategicMainClockOnMerge(
    merged: LiveGameSession,
    existing: LiveGameSession | undefined,
    incoming: LiveGameSession,
): LiveGameSession {
    if (!existing) return merged;
    const matchAxis = resolveArenaSessionPolicy(merged as any).matchAxis;
    if (matchAxis !== 'pve' && matchAxis !== 'pvp') return merged;

    const pickMainTime = (key: 'blackTimeLeft' | 'whiteTimeLeft'): number | undefined => {
        const inc = incoming[key];
        const ext = existing[key];
        if (typeof inc === 'number' && Number.isFinite(inc) && inc > 0) return inc;
        if (typeof ext === 'number' && Number.isFinite(ext) && ext > 0) return ext;
        const m = merged[key];
        return typeof m === 'number' && Number.isFinite(m) ? m : undefined;
    };

    return {
        ...merged,
        mode: incoming.mode ?? existing.mode ?? merged.mode,
        blackTimeLeft: pickMainTime('blackTimeLeft'),
        whiteTimeLeft: pickMainTime('whiteTimeLeft'),
        turnStartTime:
            typeof incoming.turnStartTime === 'number' && Number.isFinite(incoming.turnStartTime)
                ? incoming.turnStartTime
                : merged.turnStartTime,
        turnDeadline:
            typeof incoming.turnDeadline === 'number' && Number.isFinite(incoming.turnDeadline)
                ? incoming.turnDeadline
                : merged.turnDeadline,
    };
}

function shouldDropStaleStrategicGameUpdate(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined
): boolean {
    if (!existing) return false;
    const isPlayful =
        incoming.mode === GameMode.Dice ||
        incoming.mode === GameMode.Thief ||
        incoming.mode === GameMode.Alkkagi ||
        incoming.mode === GameMode.Curling ||
        incoming.mode === GameMode.Omok ||
        incoming.mode === GameMode.Ttamok;
    const isStrategicAi = (isSessionStrategicAiLike(incoming) || getSessionArenaKind(incoming) === 'guildwar') && !isPlayful;
    if (!isStrategicAi) return false;

    // State transitions must win even if the payload is slim.
    if (
        incoming.gameStatus === 'scoring' ||
        incoming.gameStatus === 'hidden_final_reveal' ||
        incoming.gameStatus === 'ended' ||
        incoming.gameStatus === 'no_contest' ||
        incoming.gameStatus === 'missile_selecting' ||
        incoming.gameStatus === 'missile_animating' ||
        incoming.gameStatus === 'hidden_placing' ||
        incoming.gameStatus === 'scanning' ||
        incoming.gameStatus === 'scanning_animating' ||
        incoming.gameStatus === 'hidden_reveal_animating'
    ) {
        return false;
    }

    const incomingMoves = Array.isArray(incoming.moveHistory) ? incoming.moveHistory.length : 0;
    const existingMoves = Array.isArray(existing.moveHistory) ? existing.moveHistory.length : 0;

    /** WS 페이로드 누락 시에도 sp-game- 등으로 솔로 본경기 전환을 살린다. */
    const singlePlayerLikeSession =
        getSessionArenaKind(incoming) === 'singleplayer' ||
        getSessionArenaKind(existing) === 'singleplayer' ||
        String(incoming.id || '').startsWith('sp-game-') ||
        String(existing.id || '').startsWith('sp-game-') ||
        false;

    const existingIsBaseOrKomiPreplay =
        String(existing.gameStatus).startsWith('base_') ||
        ['capture_bidding', 'capture_reveal', 'capture_tiebreaker'].includes(String(existing.gameStatus));

    // 베이스 대국 준비(및 덤 입찰 등) → playing(수순 0): revision·플래그 누락과 무관하게 절대 버리지 않음
    if (
        singlePlayerLikeSession &&
        incoming.gameStatus === 'playing' &&
        liveSessionIncludesBaseMode(incoming) &&
        liveSessionIncludesBaseMode(existing) &&
        incomingMoves === 0 &&
        existingMoves === 0 &&
        existingIsBaseOrKomiPreplay
    ) {
        return false;
    }

    const incomingRevision = incoming.serverRevision ?? 0;
    const existingRevision = existing.serverRevision ?? 0;
    if (incomingRevision > 0 && existingRevision > 0 && incomingRevision < existingRevision) {
        // 베이스「시작하기」직후: 서버가 본경기(playing)로만 바꾼 패킷의 revision이 클라 pre-play보다
        // 늦게 올라가면(또는 동일·역전) 여기서 전부 버려져 모달이 영원히 남는다.
        const spBaseEnterPlayingNoMoves =
            singlePlayerLikeSession &&
            liveSessionIncludesBaseMode(incoming) &&
            liveSessionIncludesBaseMode(existing) &&
            incomingMoves === 0 &&
            existingMoves === 0 &&
            incoming.gameStatus === 'playing' &&
            existingIsBaseOrKomiPreplay;
        const spBasePreMoveNoMainLine =
            singlePlayerLikeSession &&
            liveSessionIncludesBaseMode(incoming) &&
            liveSessionIncludesBaseMode(existing) &&
            incomingMoves === 0 &&
            existingMoves === 0 &&
            (String(incoming.gameStatus).startsWith('base_') ||
                ['capture_bidding', 'capture_reveal', 'capture_tiebreaker'].includes(String(incoming.gameStatus)) ||
                spBaseEnterPlayingNoMoves);
        if (!spBasePreMoveNoMainLine) {
            return true;
        }
    }

    if (incomingMoves < existingMoves) {
        return true;
    }

    if (incomingMoves > 0 && incomingMoves === existingMoves) {
        const incomingLast = getLastPlacedPointForStaleCheck(incoming);
        const existingLast = getLastPlacedPointForStaleCheck(existing);
        if (
            incomingLast &&
            existingLast &&
            (incomingLast.x !== existingLast.x || incomingLast.y !== existingLast.y) &&
            incomingRevision <= existingRevision
        ) {
            return true;
        }
    }

    return false;
}

function mergeHiddenMovesByStableHistory(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined
): LiveGameSession['hiddenMoves'] {
    const moveKey = (m: { x: number; y: number; player: number }) => `${m.player}:${m.x}:${m.y}`;
    const sanitizeAgainst = (
        source: LiveGameSession['hiddenMoves'] | undefined,
        history: LiveGameSession['moveHistory'] | undefined
    ): LiveGameSession['hiddenMoves'] => {
        if (!source || !history) return source;
        const out: NonNullable<LiveGameSession['hiddenMoves']> = {};
        for (const [key, value] of Object.entries(source)) {
            if (!value) continue;
            const index = Number.parseInt(key, 10);
            const move = Number.isInteger(index) ? history[index] : undefined;
            if (move && move.x >= 0 && move.y >= 0) out[index] = true;
        }
        return Object.keys(out).length > 0 ? out : undefined;
    };

    const incomingSanitized = sanitizeAgainst(incoming.hiddenMoves, incoming.moveHistory);

    const alignedFromExisting = (): LiveGameSession['hiddenMoves'] | undefined => {
        const existingHidden = sanitizeAgainst(existing?.hiddenMoves, existing?.moveHistory);
        if (!existingHidden || !incoming.moveHistory || !existing?.moveHistory) return undefined;
        const out: NonNullable<LiveGameSession['hiddenMoves']> = {};
        const incomingIndexesByKey = new Map<string, number[]>();
        for (let i = 0; i < incoming.moveHistory.length; i++) {
            const m = incoming.moveHistory[i];
            if (!m || m.x < 0 || m.y < 0) continue;
            const key = moveKey(m as { x: number; y: number; player: number });
            const arr = incomingIndexesByKey.get(key);
            if (arr) arr.push(i);
            else incomingIndexesByKey.set(key, [i]);
        }

        const existingOccurrencesByKey = new Map<string, number>();
        for (const [key, value] of Object.entries(existingHidden)) {
            if (!value) continue;
            const index = Number.parseInt(key, 10);
            const existingMove = existing.moveHistory[index];
            if (!existingMove || existingMove.x < 0 || existingMove.y < 0) continue;

            const k = moveKey(existingMove as { x: number; y: number; player: number });
            const rank = (existingOccurrencesByKey.get(k) ?? 0) + 1;
            existingOccurrencesByKey.set(k, rank);
            const incomingIndices = incomingIndexesByKey.get(k);
            if (!incomingIndices || incomingIndices.length < rank) continue;
            const mappedIncomingIndex = incomingIndices[rank - 1]!;
            out[mappedIncomingIndex] = true;
        }
        return Object.keys(out).length > 0 ? out : undefined;
    };

    const stable = alignedFromExisting();
    const incomingRevision = incoming.serverRevision ?? 0;
    const existingRevision = existing?.serverRevision ?? 0;
    const incomingMoves = incoming.moveHistory?.length ?? 0;
    const existingMoves = existing?.moveHistory?.length ?? 0;
    // 더 최신(리비전/수순이 앞선) 패킷에서만 incoming 충돌 값을 우선한다.
    // 동급·역행 패킷은 stable 우선으로 인덱스 뒤틀림(예: 초반 흑돌이 히든으로 바뀜)을 완화한다.
    const preferIncomingOnConflict =
        incomingRevision > existingRevision || incomingMoves > existingMoves;
    const merged: NonNullable<LiveGameSession['hiddenMoves']> = preferIncomingOnConflict
        ? { ...(stable ?? {}), ...(incomingSanitized ?? {}) }
        : { ...(incomingSanitized ?? {}), ...(stable ?? {}) };
    return sanitizeAgainst(merged, incoming.moveHistory);
}

function mergeHumanHiddenStonePointsForSession(
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined,
    moveHistory: LiveGameSession['moveHistory'] | undefined,
    hiddenMoves: LiveGameSession['hiddenMoves'] | undefined
): Array<Point & { player?: Player }> | undefined {
    const dedupe = (points: Array<Point & { player?: Player }> | undefined) => {
        if (!Array.isArray(points) || points.length === 0) return [] as Array<Point & { player?: Player }>;
        const out: Array<Point & { player?: Player }> = [];
        const seen = new Set<string>();
        for (const point of points) {
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
            const key = `${point.player ?? '*'}:${point.x}:${point.y}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(point);
        }
        return out;
    };
    const incomingPoints = dedupe((incoming as any).humanHiddenStonePoints);
    const existingPoints = dedupe((existing as any)?.humanHiddenStonePoints);
    const mergedPoints = dedupe([...incomingPoints, ...existingPoints]);
    if (mergedPoints.length === 0) return undefined;

    if (!Array.isArray(moveHistory) || !hiddenMoves || Object.keys(hiddenMoves).length === 0) {
        return mergedPoints;
    }
    const hiddenByPlayerPoint = new Set<string>();
    const hiddenByPoint = new Set<string>();
    for (const [idxKey, value] of Object.entries(hiddenMoves)) {
        if (!value) continue;
        const idx = Number.parseInt(idxKey, 10);
        const move = Number.isInteger(idx) ? moveHistory[idx] : undefined;
        if (!move || move.x < 0 || move.y < 0) continue;
        hiddenByPlayerPoint.add(`${move.player}:${move.x}:${move.y}`);
        hiddenByPoint.add(`${move.x}:${move.y}`);
    }
    if (hiddenByPlayerPoint.size === 0) return undefined;
    const sanitized = mergedPoints.filter((point) => {
        const consumed =
            (incoming as any).consumedPatternIntersections ??
            (existing as any)?.consumedPatternIntersections;
        if (
            Array.isArray(consumed) &&
            consumed.some((p: Point) => p.x === point.x && p.y === point.y)
        ) {
            return false;
        }
        if (point.player !== undefined) {
            return hiddenByPlayerPoint.has(`${point.player}:${point.x}:${point.y}`);
        }
        return hiddenByPoint.has(`${point.x}:${point.y}`);
    });
    return sanitized.length > 0 ? sanitized : undefined;
}

function syncAiHiddenStonePointsFromSession(
    game: LiveGameSession,
    existing?: LiveGameSession,
): Array<Point & { player?: Player }> | undefined {
    const resolveAiPlayer = (): Player | null => {
        if (game.blackPlayerId === aiUserId || String(game.blackPlayerId || '').startsWith('dungeon-bot-')) {
            return Player.Black;
        }
        if (game.whitePlayerId === aiUserId || String(game.whitePlayerId || '').startsWith('dungeon-bot-')) {
            return Player.White;
        }
        return null;
    };
    const aiPlayer = resolveAiPlayer();
    if (aiPlayer == null) {
        const merged = [
            ...(((existing as any)?.aiHiddenStonePoints as Array<Point & { player?: Player }>) || []),
            ...(((game as any).aiHiddenStonePoints as Array<Point & { player?: Player }>) || []),
        ];
        return merged.length > 0 ? merged : undefined;
    }

    let points: Array<Point & { player?: Player }> = [];
    for (const source of [
        (existing as any)?.aiHiddenStonePoints as Array<Point & { player?: Player }> | undefined,
        (game as any).aiHiddenStonePoints as Array<Point & { player?: Player }> | undefined,
    ]) {
        if (!Array.isArray(source)) continue;
        for (const point of source) {
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
            points = upsertHiddenStonePoint(points, point, point.player ?? aiPlayer);
        }
    }

    const hist = game.moveHistory ?? existing?.moveHistory;
    const hm = game.hiddenMoves ?? existing?.hiddenMoves;
    if (hist && hm) {
        for (const [key, value] of Object.entries(hm)) {
            if (!value) continue;
            const idx = Number(key);
            const move = hist[idx];
            if (move && move.player === aiPlayer && move.x >= 0 && move.y >= 0) {
                points = upsertHiddenStonePoint(points, { x: move.x, y: move.y }, aiPlayer);
            }
        }
    }

    const aiH = ((game as any).aiInitialHiddenStone ?? (existing as any)?.aiInitialHiddenStone) as
        | Point
        | undefined;
    if (aiH && typeof aiH.x === 'number' && typeof aiH.y === 'number') {
        points = upsertHiddenStonePoint(points, aiH, aiPlayer);
    }

    return points.length > 0 ? points : undefined;
}

const OVERLAY_PRESERVE_GAME_STATUSES = new Set([
    'playing',
    'scoring',
    'base_game_start_confirmation',
    'hidden_placing',
    'scanning',
    'missile_selecting',
    'missile_animating',
    'scanning_animating',
    'hidden_reveal_animating',
    'hidden_final_reveal',
]);

function lastMoveHistoryIndexAt(
    hist: NonNullable<LiveGameSession['moveHistory']>,
    x: number,
    y: number
): number {
    for (let i = hist.length - 1; i >= 0; i--) {
        const m = hist[i];
        if (m && m.x === x && m.y === y) return i;
    }
    return -1;
}

/** 슬림 WS 병합 후: 빈 칸·일반 재착수 좌표에 남은 베이스/공개히든 마커 제거 */
function sanitizeSessionBoardOverlayMarkers(merged: LiveGameSession): LiveGameSession {
    const board = merged.boardState;
    let next = merged;

    if (Array.isArray(merged.baseStones) && merged.baseStones.length > 0 && Array.isArray(board) && board.length > 0) {
        const boardHasAnyStone = board.some(
            (row) => Array.isArray(row) && row.some((c) => c === Player.Black || c === Player.White),
        );
        // moveHistory만으로 복원한 슬림 패킷 등: 판이 통째로 비어 있는데 수는 있는 경우 — 마커를 지우면 베이스 링이 전부 사라짐
        if (
            !boardHasAnyStone &&
            (merged.moveHistory?.length ?? 0) > 0 &&
            liveSessionIncludesBaseMode(merged) &&
            merged.gameStatus === 'playing'
        ) {
            return next;
        }
        const keepEmptyBaseIntersections =
            liveSessionIncludesBaseMode(merged) &&
            merged.gameStatus === 'playing' &&
            (merged.moveHistory?.length ?? 0) > 0;
        const filtered = merged.baseStones.filter((p) => {
            const row = board[p.y];
            if (!row || !Array.isArray(row) || p.x < 0 || p.x >= row.length) return true;
            const cell = row[p.x];
            if (cell === Player.None || cell == null) {
                return keepEmptyBaseIntersections;
            }
            if (cell === Player.Black || cell === Player.White) {
                // 베이스돌은 moveHistory에 없으므로, 같은 좌표의 일반 착수가 기록되어 있으면
                // 따낸 뒤 재착수된 일반돌로 보고 마커를 제거한다.
                return !(merged.moveHistory && lastMoveHistoryIndexAt(merged.moveHistory, p.x, p.y) >= 0);
            }
            return false;
        });
        if (filtered.length !== merged.baseStones.length) {
            next = { ...next, baseStones: filtered.length > 0 ? filtered : undefined };
        }
    }

    const hist = merged.moveHistory;
    const hm = merged.hiddenMoves;
    const aiH = (merged as any).aiInitialHiddenStone as { x: number; y: number } | undefined | null;
    if (
        Array.isArray(merged.permanentlyRevealedStones) &&
        merged.permanentlyRevealedStones.length > 0 &&
        Array.isArray(hist) &&
        hist.length > 0 &&
        Array.isArray(board) &&
        board.length > 0
    ) {
        const f = merged.permanentlyRevealedStones.filter((p) => {
            const row = board[p.y];
            const cell = row?.[p.x];
            if (!cell) return false;
            const idx = lastMoveHistoryIndexAt(hist, p.x, p.y);
            if (idx < 0) return false;
            if (hm?.[idx]) return true;
            if (aiH && aiH.x === p.x && aiH.y === p.y) return true;
            return false;
        });
        if (f.length !== merged.permanentlyRevealedStones.length) {
            next = { ...next, permanentlyRevealedStones: f.length > 0 ? f : undefined };
        }
    }

    return next;
}

/**
 * GAME_UPDATE 슬림 패킷에서 히든·베이스·문양 등 오버레이 키가 빠질 때 기존 세션 값을 보존한 뒤,
 * 판/수순과 맞지 않는 마커(따낸 뒤 재착수 등)는 sanitize로 정리한다.
 */
function preserveStrategicSessionOverlaysIfIncomingOmitted(
    merged: LiveGameSession,
    incoming: LiveGameSession,
    existing: LiveGameSession | undefined
): LiveGameSession {
    let next: LiveGameSession = { ...merged };
    const st = next.gameStatus;
    const shouldPreserve = !!st && OVERLAY_PRESERVE_GAME_STATUSES.has(st) && !!existing;

    if (shouldPreserve) {
        if (!Object.prototype.hasOwnProperty.call(incoming, 'baseStones') || incoming.baseStones?.length === 0) {
            const prev = existing!.baseStones;
            if (Array.isArray(prev) && prev.length > 0) {
                const mergedBs = merged.baseStones;
                const board = next.boardState;
                const prevStillOnBoard =
                    Array.isArray(board) &&
                    prev.some((stone) => board[stone.y]?.[stone.x] === stone.player);
                // 병합 단계에서 이미 보정된 baseStones(예: 흑백 좌석 전환 후 플립)을 incoming 생략/빈 값으로 덮어쓰지 않음
                if ((!Array.isArray(mergedBs) || mergedBs.length === 0) && prevStillOnBoard) {
                    next = { ...next, baseStones: prev };
                }
            }
        }
        if (!Object.prototype.hasOwnProperty.call(incoming, 'hiddenMoves')) {
            const mh = mergeHiddenMovesByStableHistory({ ...next, hiddenMoves: existing!.hiddenMoves }, existing);
            if (mh && Object.keys(mh).length > 0) {
                next = { ...next, hiddenMoves: mh };
            }
        }
        if (
            !Object.prototype.hasOwnProperty.call(incoming, 'humanHiddenStonePoints') ||
            !Array.isArray((incoming as any).humanHiddenStonePoints) ||
            (incoming as any).humanHiddenStonePoints.length === 0
        ) {
            const hp = mergeHumanHiddenStonePointsForSession(next, existing, next.moveHistory, next.hiddenMoves);
            if (Array.isArray(hp) && hp.length > 0) {
                (next as any).humanHiddenStonePoints = hp;
            }
        }
        if (
            !Object.prototype.hasOwnProperty.call(incoming, 'aiHiddenStonePoints') ||
            !Array.isArray((incoming as any).aiHiddenStonePoints) ||
            (incoming as any).aiHiddenStonePoints.length === 0
        ) {
            const ap = syncAiHiddenStonePointsFromSession(next, existing);
            if (Array.isArray(ap) && ap.length > 0) {
                (next as any).aiHiddenStonePoints = ap;
            }
        }
        if (!Object.prototype.hasOwnProperty.call(incoming, 'permanentlyRevealedStones')) {
            const pr = existing!.permanentlyRevealedStones;
            if (Array.isArray(pr) && pr.length > 0) {
                next = { ...next, permanentlyRevealedStones: pr };
            }
        }
        if (!Object.prototype.hasOwnProperty.call(incoming, 'revealedHiddenMoves')) {
            const rv = existing!.revealedHiddenMoves;
            if (rv && typeof rv === 'object' && Object.keys(rv as object).length > 0) {
                next = { ...next, revealedHiddenMoves: rv };
            }
        }
        if (!Object.prototype.hasOwnProperty.call(incoming, 'blackPatternStones')) {
            const b = existing!.blackPatternStones;
            if (Array.isArray(b) && b.length > 0) next = { ...next, blackPatternStones: b };
        }
        if (!Object.prototype.hasOwnProperty.call(incoming, 'whitePatternStones')) {
            const w = existing!.whitePatternStones;
            if (Array.isArray(w) && w.length > 0) next = { ...next, whitePatternStones: w };
        }
        if (!Object.prototype.hasOwnProperty.call(incoming, 'consumedPatternIntersections')) {
            const c = (existing as any).consumedPatternIntersections;
            if (Array.isArray(c) && c.length > 0) (next as any).consumedPatternIntersections = c;
        }
        if (!Object.prototype.hasOwnProperty.call(incoming, 'aiInitialHiddenStone') && (existing as any).aiInitialHiddenStone != null) {
            (next as any).aiInitialHiddenStone = (existing as any).aiInitialHiddenStone;
        }
        if (!Object.prototype.hasOwnProperty.call(incoming, 'aiInitialHiddenStoneIsPrePlaced')) {
            const ap = (existing as any).aiInitialHiddenStoneIsPrePlaced;
            if (ap !== undefined) (next as any).aiInitialHiddenStoneIsPrePlaced = ap;
        }
    }

    return sanitizeSessionBoardOverlayMarkers(next);
}

/** WebSocket INITIAL_STATE에서 boardState를 떼어내므로, 격자가 없으면 F5 후에도 /api/game/rejoin으로 전체 판·수순을 받아야 한다. */
function hasHydratedBoardGridForRejoin(game: LiveGameSession | undefined): boolean {
    const b = game?.boardState;
    if (!b || !Array.isArray(b) || b.length === 0) return false;
    const row0 = b[0];
    return Array.isArray(row0) && row0.length > 0;
}

/** 격자 행렬만 있고 돌이 하나도 없는 패킷(종료·슬림 WS)을 "유효한 서버 보드"로 취급하지 않기 위함 */
function boardGridHasAnyStones(board: LiveGameSession['boardState'] | undefined): boolean {
    const b = board;
    if (!b || !Array.isArray(b)) return false;
    return b.some(
        (row) =>
            row &&
            Array.isArray(row) &&
            row.some((c: unknown) => c !== 0 && c != null && c !== undefined),
    );
}

/** `/api/game/rejoin`·계가 폴링 응답이 종료 직후 판 없이 오면 빈 격자·턴 알림으로 덮어쓰는 것을 막는다. */
/** WS가 동일 히든 공개 연출을 짧은 간격에 여러 번내면 startTime/revealEnd가 리셋되어 스파클·공개음이 연속 재생된다. */
function shouldKeepExistingHiddenRevealAnimationClock(
    existing: LiveGameSession | undefined,
    incoming: LiveGameSession,
): boolean {
    if (!existing) return false;
    if (existing.gameStatus !== 'hidden_reveal_animating' || incoming.gameStatus !== 'hidden_reveal_animating') {
        return false;
    }
    const ea = existing.animation as { type?: string; stones?: Array<{ point: Point }> } | null | undefined;
    const ia = incoming.animation as { type?: string; stones?: Array<{ point: Point }> } | null | undefined;
    if (!ea || !ia || ea.type !== 'hidden_reveal' || ia.type !== 'hidden_reveal') return false;
    const sig = (a: typeof ea) =>
        (a.stones || [])
            .map((s) => `${s.point?.x ?? ''},${s.point?.y ?? ''}`)
            .sort()
            .join('|');
    const s1 = sig(ea);
    return Boolean(s1) && s1 === sig(ia);
}

function mergePveRejoinResponseWithExistingBoard(
    existing: LiveGameSession | undefined,
    incoming: LiveGameSession,
): LiveGameSession {
    if (!existing) return incoming;
    const isPve = isSessionPveArena(incoming);
    if (!isPve) return incoming;
    const terminal = incoming.gameStatus === 'ended' || incoming.gameStatus === 'no_contest';
    if (!terminal) return incoming;
    if (!hasHydratedBoardGridForRejoin(existing) || hasHydratedBoardGridForRejoin(incoming)) return incoming;
    const mh = existing.moveHistory?.length ? existing.moveHistory : incoming.moveHistory;
    return {
        ...incoming,
        boardState: existing.boardState,
        moveHistory: mh,
        lastMove: existing.lastMove ?? incoming.lastMove,
        captures: existing.captures ?? incoming.captures,
        baseStoneCaptures: existing.baseStoneCaptures ?? incoming.baseStoneCaptures,
        hiddenStoneCaptures: existing.hiddenStoneCaptures ?? incoming.hiddenStoneCaptures,
        blackTimeLeft: existing.blackTimeLeft ?? incoming.blackTimeLeft,
        whiteTimeLeft: existing.whiteTimeLeft ?? incoming.whiteTimeLeft,
        turnDeadline: existing.turnDeadline ?? incoming.turnDeadline,
        turnStartTime: existing.turnStartTime ?? incoming.turnStartTime,
    };
}

function augmentPveRejoinWithSessionStorage(merged: LiveGameSession): LiveGameSession {
    if (!isSessionPveArena(merged)) return merged;
    try {
        const stored =
            typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`gameState_${merged.id}`) : null;
        if (!stored) return merged;
        const parsed = JSON.parse(stored) as Record<string, unknown>;
        if (parsed.gameId !== merged.id) return merged;
        return augmentPveFromSessionStorageSnapshot(merged, parsed);
    } catch {
        return merged;
    }
}

/** PLACE_STONE 패(코) 불가 — Game 전광판으로 안내하므로 전역 에러 모달은 생략 */
function shouldSuppressModalForKoPlaceStone(action: ServerAction, errorMessage: string): boolean {
    if (action.type !== 'PLACE_STONE') return false;
    return shouldSuppressKoPlaceStoneClientError(errorMessage);
}

/**
 * 주사위/도둑 등 놀이바둑: HTTP·WS 패킷 역전 시 로그 수집용.
 * 켜기: `localStorage.setItem('SUDAMR_DEBUG_PLAYFUL_PACKET_ORDER','1')` 후 새로고침
 * 또는 URL `?sudamrDebugPlayfulPackets=1`
 */
export const SUDAMR_DEBUG_PLAYFUL_PACKET_ORDER_KEY = 'SUDAMR_DEBUG_PLAYFUL_PACKET_ORDER';

function isSudamrPlayfulPacketOrderDebugEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const q = new URLSearchParams(window.location.search).get('sudamrDebugPlayfulPackets');
        if (q === '1' || String(q).toLowerCase() === 'true') return true;
        const v = window.localStorage.getItem(SUDAMR_DEBUG_PLAYFUL_PACKET_ORDER_KEY);
        return v === '1' || String(v).toLowerCase() === 'true';
    } catch {
        return false;
    }
}

function playfulBoardHasStones(board: LiveGameSession['boardState']): boolean {
    return !!(
        board &&
        Array.isArray(board) &&
        board.length > 0 &&
        board.some((row) => Array.isArray(row) && row.some((c) => c !== 0 && c != null))
    );
}

function playfulPacketSnapshot(g: LiveGameSession) {
    return {
        mode: g.mode,
        gameStatus: g.gameStatus,
        round: g.round ?? 1,
        serverRevision: g.serverRevision ?? 0,
        moveHistoryLen: g.moveHistory?.length ?? 0,
        stonesToPlace: g.stonesToPlace ?? 0,
        currentPlayer: g.currentPlayer,
        boardHasStones: playfulBoardHasStones(g.boardState),
    };
}

export type PlayfulPacketStaleReason =
    | 'rev_lt'
    | 'round_lt'
    | 'moves_lt'
    | 'board_regress'
    | 'stones_regress';

export function getPlayfulPacketStaleMeta(
    incoming: LiveGameSession,
    existing: LiveGameSession | null | undefined,
): { ignore: boolean; reason?: PlayfulPacketStaleReason } {
    if (!existing) return { ignore: false };

    const incomingIsPlayful =
        incoming.mode === GameMode.Dice ||
        incoming.mode === GameMode.Thief ||
        existing.mode === GameMode.Dice ||
        existing.mode === GameMode.Thief;
    if (!incomingIsPlayful) return { ignore: false };

    const ir = incoming.serverRevision ?? 0;
    const er = existing.serverRevision ?? 0;
    if (ir < er) return { ignore: true, reason: 'rev_lt' };

    const incomingRound = incoming.round ?? 1;
    const existingRound = existing.round ?? 1;
    if (incomingRound < existingRound) return { ignore: true, reason: 'round_lt' };

    const im = incoming.moveHistory?.length ?? 0;
    const em = existing.moveHistory?.length ?? 0;
    const incomingPlacing =
        incoming.gameStatus === 'dice_placing' || incoming.gameStatus === 'thief_placing';
    const existingPlacing =
        existing.gameStatus === 'dice_placing' || existing.gameStatus === 'thief_placing';

    if (ir === er) {
        // 세그먼트/라운드가 올라가면 서버가 기보를 비우므로 im < em 이 정상인데, 리비전이 한 번만
        // 올라간 레이스에서 오래된 클라이언트가 이 패킷을 버리면 판이 안 비고 AI만 멈춘 것처럼 보인다.
        const roundAdvanced = incomingRound > existingRound;
        if (!roundAdvanced && im < em) {
            // 서버가 세그먼트/라운드 전환으로 기보를 비운 패킷(im=0) — moves_lt로 버리면 2라운드에도 1라운드 판이 남음
            const playfulEmptyHistoryReset =
                im === 0 &&
                !playfulBoardHasStones(incoming.boardState) &&
                ((incoming.mode === GameMode.Thief &&
                    (incoming.gameStatus === 'thief_round_end' ||
                        incoming.gameStatus === 'thief_rolling' ||
                        incoming.gameStatus === 'thief_rolling_animating')) ||
                    (incoming.mode === GameMode.Dice &&
                        (incoming.gameStatus === 'dice_round_end' ||
                            incoming.gameStatus === 'dice_rolling' ||
                            incoming.gameStatus === 'dice_rolling_animating')));
            if (!playfulEmptyHistoryReset) return { ignore: true, reason: 'moves_lt' };
        }
        if (!roundAdvanced && incomingPlacing && existingPlacing && im === em) {
            const incomingHasBoard = playfulBoardHasStones(incoming.boardState);
            const existingHasBoard = playfulBoardHasStones(existing.boardState);
            if (!incomingHasBoard && existingHasBoard) return { ignore: true, reason: 'board_regress' };
            if ((incoming.stonesToPlace ?? 0) > (existing.stonesToPlace ?? 0)) {
                return { ignore: true, reason: 'stones_regress' };
            }
        }
    }
    return { ignore: false };
}

export const useApp = () => {
    // --- State Management ---
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        try {
            const stored = sessionStorage.getItem('currentUser');
            if (stored) {
                const u = JSON.parse(stored) as User;
                if (u?.inventory && Array.isArray(u.inventory)) {
                    u.inventory = normalizeInventoryAfterLoad(u.inventory);
                }
                const lv = coerceUserLevelXpFromPayload(u as unknown as Record<string, unknown>);
                u.userLevel = lv.userLevel;
                u.userXp = lv.userXp;
                return u;
            }
        } catch (e) { console.error('Failed to parse user from sessionStorage', e); }
        return null;
    });

    const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => parseHash(window.location.hash));
    const currentRouteRef = useRef(currentRoute);
    const [error, setError] = useState<string | null>(null);
    const isLoggingOut = useRef(false);
    // 강제 리렌더링을 위한 카운터
    const [updateTrigger, setUpdateTrigger] = useState(0);
    /** 관리자 스테이지 KV 갱신 시 스테이지 그리드·모달 등이 번들 상수가 아닌 최신 목록을 쓰도록 */
    const [singlePlayerStagesListRevision, setSinglePlayerStagesListRevision] = useState(0);
    const currentUserRef = useRef<User | null>(null);
    /** useEffect보다 먼저 도는 자식 effect(GuildWar의 GET_GUILD_WAR_DATA 등)에서도 id를 쓰려면 렌더와 동기화 필요 */
    currentUserRef.current = currentUser;

    useLayoutEffect(() => {
        return subscribeSinglePlayerStagesListUpdate(() => {
            setSinglePlayerStagesListRevision((n) => n + 1);
        });
    }, []);
    const currentUserStatusRef = useRef<UserWithStatus | null>(null);
    // HTTP 응답 후 일정 시간 내 WebSocket 업데이트 무시 (중복 방지)
    const lastHttpUpdateTime = useRef<number>(0);
    const lastHttpActionType = useRef<string | null>(null);
    const lastHttpHadUpdatedUser = useRef<boolean>(false); // HTTP 응답에 updatedUser가 있었는지 추적
    const HTTP_UPDATE_DEBOUNCE_MS = 2000; // HTTP 응답 후 2초 내 WebSocket 업데이트 무시 (더 긴 시간으로 확실하게 보호)
    // AI 게임 경기 시작 후 경기장 입장 시 state 반영 전 리다이렉트 방지 (레이스 컨디션)
    // CONFIRM_AI_GAME_START 응답의 게임을 보관해 'Game not found after max attempts' 시에도 라우팅 가능하게 함
    const pendingAiGameEntryRef = useRef<{ gameId: string; until: number; game?: LiveGameSession } | null>(null);
    // 새로고침(F5) 후 재입장: 재입장 API 실패 시에만 게임 페이지에서 나가기
    const [gameRejoinFailure, setGameRejoinFailure] = useState<GameRejoinFailure | null>(null);
    /** 로비 AI 「경기 시작」 확인 HTTP 왕복 중 규칙 모달 대신 인게임 전환 오버레이 */
    const [aiLobbyStartConfirmGameId, setAiLobbyStartConfirmGameId] = useState<string | null>(null);
    /** 로비 AI CONFIRM 실패 시 pending 복원 */
    const aiLobbyStartRevertRef = useRef<{ gameId: string; snapshot: LiveGameSession } | null>(null);
    const [gameRejoinRetryNonce, setGameRejoinRetryNonce] = useState(0);
    const rejoinRequestedRef = useRef<Set<string>>(new Set());
    /** 합성 등으로 제거된 id — 낡은 WS가 재료/장비를 가방에 되살리는 것 방지 */
    const recentlyRemovedInventoryIdsRef = useRef<Set<string>>(new Set());

    const mergeUserState = useCallback((prev: User | null, updates: Partial<User>) => {
        if (!prev) {
            const first = { ...(updates as User) } as unknown as Record<string, unknown>;
            const lv = coerceUserLevelXpFromPayload(first);
            return { ...(updates as User), userLevel: lv.userLevel, userXp: lv.userXp };
        }
        
        // 깊은 병합을 위해 JSON 직렬화/역직렬화 사용
        const base = JSON.parse(JSON.stringify(prev)) as User;
        const patch = JSON.parse(JSON.stringify(updates)) as Partial<User>;

        if (patch.inventory !== undefined && recentlyRemovedInventoryIdsRef.current.size > 0) {
            const stripped = stripReappearedRemovedInventoryItems(
                base.inventory,
                patch.inventory,
                recentlyRemovedInventoryIdsRef.current,
            );
            if (stripped !== patch.inventory) {
                patch.inventory = stripped;
            }
        }
        
        // inventory는 배열이므로 완전히 교체 (깊은 복사로 새로운 참조 생성)
        const mergedInventoryRaw =
            patch.inventory !== undefined
                ? (JSON.parse(JSON.stringify(patch.inventory)) as InventoryItem[])
                : base.inventory;
        const mergedInventory = Array.isArray(mergedInventoryRaw)
            ? normalizeInventoryAfterLoad(mergedInventoryRaw)
            : mergedInventoryRaw;
        
        // 중첩된 객체들을 깊게 병합
        // ID는 항상 이전 사용자의 ID로 유지 (다른 사용자 정보로 덮어씌워지는 것을 방지)
        const prevId = prev.id;
        const merged: User = {
            ...base,
            ...patch,
            // ID는 항상 이전 사용자의 ID로 강제 유지 (보안: 다른 사용자로 로그인 변경 방지)
            id: prevId,
            // 모험 프로필: 지역 특화 효과는 스테이지 키 단위로만 덮어써서 다른 지역 슬롯이 사라지지 않게 함
            adventureProfile:
                patch.adventureProfile !== undefined
                    ? mergeAdventureProfileForPersistence(patch.adventureProfile, base.adventureProfile)
                    : base.adventureProfile,
            // inventory는 배열이므로 완전히 교체 (새로운 참조로)
            inventory: mergedInventory,
            pairPetTrainingSlots:
                patch.pairPetTrainingSlots !== undefined
                    ? mergePairPetTrainingSlotsPreserveRecentRestart(
                          base.pairPetTrainingSlots,
                          patch.pairPetTrainingSlots,
                          Date.now(),
                          15_000,
                          pairTrainingClaimCompletedBySlotIndex,
                      )
                    : base.pairPetTrainingSlots,
            // equipment는 객체이므로 완전히 교체 (서버에서 보내는 equipment는 항상 전체 상태)
            equipment: patch.equipment !== undefined ? (patch.equipment || {}) : base.equipment,
            // actionPoints는 객체이므로 병합
            actionPoints: patch.actionPoints !== undefined ? { ...base.actionPoints, ...patch.actionPoints } : base.actionPoints,
            // stats 객체들도 병합
            stats: patch.stats !== undefined ? { ...base.stats, ...patch.stats } : base.stats,
            // 기타 중첩 객체들도 병합
            equipmentPresets: patch.equipmentPresets !== undefined ? patch.equipmentPresets : base.equipmentPresets,
            clearedSinglePlayerStages: patch.clearedSinglePlayerStages !== undefined ? patch.clearedSinglePlayerStages : base.clearedSinglePlayerStages,
            singlePlayerClassBarClaims:
                patch.singlePlayerClassBarClaims !== undefined
                    ? { ...(base.singlePlayerClassBarClaims ?? {}), ...patch.singlePlayerClassBarClaims }
                    : base.singlePlayerClassBarClaims,
            // singlePlayerMissions는 객체이므로 병합
            singlePlayerMissions: patch.singlePlayerMissions !== undefined ? { ...base.singlePlayerMissions, ...patch.singlePlayerMissions } : base.singlePlayerMissions,
            // 상점 일일 구매·광고 보상 등: 부분 USER_UPDATE에서 키만 오면 나머지 탭 기록이 사라지지 않게 병합
            dailyShopPurchases:
                patch.dailyShopPurchases !== undefined
                    ? { ...(base.dailyShopPurchases ?? {}), ...patch.dailyShopPurchases }
                    : base.dailyShopPurchases,
            // 챔피언십 결투권(경기장별): 부분 패치 시 다른 경기장 키 유지
            championshipVersusDuelTicketsByVenue:
                patch.championshipVersusDuelTicketsByVenue !== undefined
                    ? { ...(base.championshipVersusDuelTicketsByVenue ?? {}), ...patch.championshipVersusDuelTicketsByVenue }
                    : base.championshipVersusDuelTicketsByVenue,
            championshipVersusDuelTicketNextAtByVenue:
                patch.championshipVersusDuelTicketNextAtByVenue !== undefined
                    ? { ...(base.championshipVersusDuelTicketNextAtByVenue ?? {}), ...patch.championshipVersusDuelTicketNextAtByVenue }
                    : base.championshipVersusDuelTicketNextAtByVenue,
            dungeonConditionSnapshot:
                patch.dungeonConditionSnapshot !== undefined
                    ? mergeDungeonConditionSnapshotRecords(base.dungeonConditionSnapshot, patch.dungeonConditionSnapshot)
                    : base.dungeonConditionSnapshot,
            championshipVersusConditionSnapshot:
                patch.championshipVersusConditionSnapshot !== undefined
                    ? mergeChampionshipVersusConditionSnapshotRecords(
                          base.championshipVersusConditionSnapshot,
                          patch.championshipVersusConditionSnapshot,
                      )
                    : base.championshipVersusConditionSnapshot,
            // 챔피언십: WS/HTTP 패치에 기보가 빠지면 클라 실대국이 50초 시뮬로 추락하므로 동일 슬롯에서는 베이스 기보를 보존
            lastNeighborhoodTournament:
                patch.lastNeighborhoodTournament !== undefined
                    ? mergeChampionshipTournamentPreserveLostRealGame(
                          base.lastNeighborhoodTournament,
                          patch.lastNeighborhoodTournament,
                      ) ?? patch.lastNeighborhoodTournament
                    : base.lastNeighborhoodTournament,
            lastNationalTournament:
                patch.lastNationalTournament !== undefined
                    ? mergeChampionshipTournamentPreserveLostRealGame(
                          base.lastNationalTournament,
                          patch.lastNationalTournament,
                      ) ?? patch.lastNationalTournament
                    : base.lastNationalTournament,
            lastWorldTournament:
                patch.lastWorldTournament !== undefined
                    ? mergeChampionshipTournamentPreserveLostRealGame(base.lastWorldTournament, patch.lastWorldTournament) ??
                      patch.lastWorldTournament
                    : base.lastWorldTournament,
        };

        const coercedLv = coerceUserLevelXpFromPayload(merged as unknown as Record<string, unknown>);
        merged.userLevel = coercedLv.userLevel;
        merged.userXp = coercedLv.userXp;

        syncDungeonConditionSnapshotToTournamentPlayers(merged);

        if (merged.exchangeState?.listings != null || patch.exchangeState?.listings != null) {
            return reconcileExchangeListedInventoryFlags(merged);
        }

        return merged;
    }, []);

    const applyUserUpdate = useCallback((updates: Partial<User>, source: string) => {
        const prevUser = currentUserRef.current;
        
        // 보안: 다른 사용자의 ID가 포함된 업데이트는 무시 (다른 사용자로 로그인 변경 방지)
        if (prevUser && updates.id && updates.id !== prevUser.id) {
            console.warn(`[applyUserUpdate] Rejected update from ${source}: ID mismatch (prev: ${prevUser.id}, update: ${updates.id})`);
            return prevUser;
        }
        
        const mergedUser = mergeUserState(prevUser, updates);
        
        // 추가 보안: 병합 후에도 ID가 변경되지 않았는지 확인
        if (prevUser && mergedUser.id !== prevUser.id) {
            console.error(`[applyUserUpdate] CRITICAL: ID changed after merge! (prev: ${prevUser.id}, merged: ${mergedUser.id}). Restoring previous ID.`);
            mergedUser.id = prevUser.id;
        }
        
        // 실제 변경사항이 있는지 확인 (불필요한 리렌더링 방지)
        // 중요한 필드들을 직접 비교하여 더 정확한 변경 감지
        let hasActualChanges = !prevUser;
        if (prevUser) {
            // inventory 배열 길이와 내용 비교 (더 정확한 변경 감지)
            const isPairPetTrainingUserMerge =
                source.includes('PAIR_PET_CLAIM_TRAINING') ||
                source.includes('PAIR_PET_START_TRAINING');
            const inventoryChanged =
                prevUser.inventory?.length !== mergedUser.inventory?.length ||
                (isPairPetTrainingUserMerge
                    ? prevUser.inventory !== mergedUser.inventory
                    : JSON.stringify(prevUser.inventory) !== JSON.stringify(mergedUser.inventory));

            const pairPetTrainingSlotsChanged =
                JSON.stringify(prevUser.pairPetTrainingSlots) !== JSON.stringify(mergedUser.pairPetTrainingSlots);
            
            // 주요 필드 직접 비교 (챔피언십 던전 입장 시 토너먼트 상태 변경 감지 포함)
            const tournamentStateChanged =
                JSON.stringify(prevUser.lastNeighborhoodTournament) !== JSON.stringify(mergedUser.lastNeighborhoodTournament) ||
                JSON.stringify(prevUser.lastNationalTournament) !== JSON.stringify(mergedUser.lastNationalTournament) ||
                JSON.stringify(prevUser.lastWorldTournament) !== JSON.stringify(mergedUser.lastWorldTournament);
            const keyFieldsChanged = 
                prevUser.gold !== mergedUser.gold ||
                prevUser.diamonds !== mergedUser.diamonds ||
                prevUser.towerFloor !== mergedUser.towerFloor ||
                prevUser.monthlyTowerFloor !== mergedUser.monthlyTowerFloor ||
                prevUser.userXp !== mergedUser.userXp ||
                prevUser.userLevel !== mergedUser.userLevel ||
                prevUser.avatarId !== mergedUser.avatarId ||
                prevUser.borderId !== mergedUser.borderId ||
                prevUser.nickname !== mergedUser.nickname ||
                prevUser.mbti !== mergedUser.mbti ||
                prevUser.isMbtiPublic !== mergedUser.isMbtiPublic ||
                prevUser.mannerScore !== mergedUser.mannerScore ||
                prevUser.mannerMasteryApplied !== mergedUser.mannerMasteryApplied ||
                inventoryChanged ||
                pairPetTrainingSlotsChanged ||
                tournamentStateChanged ||
                JSON.stringify(prevUser.dungeonConditionSnapshot) !== JSON.stringify(mergedUser.dungeonConditionSnapshot) ||
                JSON.stringify(prevUser.championshipVersusConditionSnapshot) !==
                    JSON.stringify(mergedUser.championshipVersusConditionSnapshot) ||
                JSON.stringify(prevUser.dailyShopPurchases) !== JSON.stringify(mergedUser.dailyShopPurchases) ||
                JSON.stringify(prevUser.equipment) !== JSON.stringify(mergedUser.equipment) ||
                JSON.stringify(prevUser.singlePlayerMissions) !== JSON.stringify(mergedUser.singlePlayerMissions) ||
                JSON.stringify(prevUser.actionPoints) !== JSON.stringify(mergedUser.actionPoints);
            
            // stableStringify로 전체 비교 (백업) — 펫 수련은 슬롯·골드 등 키 필드만으로 충분(대형 인벤에서 전체 직렬화 지연 방지)
            const fullComparison =
                !isPairPetTrainingUserMerge && stableStringify(prevUser) !== stableStringify(mergedUser);
            
            hasActualChanges = keyFieldsChanged || fullComparison;
            
            // 보상 수령 관련 액션의 경우 inventory 변경을 강제로 감지
            if (source.includes('CLAIM') || source.includes('REWARD')) {
                if (inventoryChanged) {
                    hasActualChanges = true;
                    console.log(`[applyUserUpdate] Forcing update for ${source} due to inventory change`, {
                        prevLength: prevUser.inventory?.length,
                        newLength: mergedUser.inventory?.length
                    });
                }
            }
            // 챔피언십 던전 입장 시 토너먼트 상태 변경 강제 감지 (경기장 입장 실패 방지)
            if (source.includes('START_DUNGEON_STAGE') && tournamentStateChanged) {
                hasActualChanges = true;
            }
        }
        
        const updateKeys = Object.keys(updates || {}).filter(key => key !== 'id');

        if (!hasActualChanges && prevUser) {
            if (updateKeys.length === 0) {
                console.log(`[applyUserUpdate] No actual changes detected (${source}) and no update keys, skipping update.`);
                return prevUser;
            }

            // INITIAL_STATE의 경우 경고를 로그 레벨로 낮춤 (오류처럼 보이지 않도록)
            if (source === 'INITIAL_STATE') {
                console.log(`[applyUserUpdate] No diff detected for ${source}, but forcing refresh to avoid stale UI.`, { updateKeys });
            } else {
                console.warn(`[applyUserUpdate] No diff detected for ${source}, but forcing refresh to avoid stale UI.`, { updateKeys });
            }
        }
        
        currentUserRef.current = mergedUser;
        flushSync(() => {
            setCurrentUser(mergedUser);
            setUpdateTrigger(prev => prev + 1);
        });

        if (mergedUser.id) {
            syncDismissedScreenGuidesFromUser(mergedUser.id, mergedUser.dismissedScreenGuides);
        }
        
        if (mergedUser.id) {
            setUsersMap(prevMap => ({ ...prevMap, [mergedUser.id]: mergedUser }));
        }
        
        try {
            sessionStorage.setItem('currentUser', JSON.stringify(mergedUser));
        } catch (e) {
            console.error(`[applyUserUpdate] Failed to persist user (${source})`, e);
        }
        
        console.log(`[applyUserUpdate] Applied update from ${source}`, {
            inventoryLength: mergedUser.inventory?.length,
            gold: mergedUser.gold,
            diamonds: mergedUser.diamonds
        });

        if (prevUser && source !== 'INITIAL_STATE') {
            const prevL = prevUser.userLevel ?? 1;
            const nextL = mergedUser.userLevel ?? 1;
            const levelUp = nextL > prevL;
            if (levelUp) {
                const levelPayload: LevelUpCelebrationPayload = {
                    strategy: { from: prevL, to: nextL },
                    playful: undefined,
                };
                const uid = mergedUser.id;
                if (source.includes('START_CHAMPIONSHIP_VERSUS_KATA_DUEL')) {
                    markChampionshipVersusKataRewardsPending();
                }
                const blockCelebration =
                    shouldDeferLevelUpCelebrationForChampionshipVersusKata() ||
                    (!!uid &&
                        Object.values(liveGamesRef.current).some((g) => {
                            if (!g || isSessionSingleOrTower(g)) return false;
                            if (g.gameStatus !== 'ended') return false;
                            if (g.player1?.id !== uid && g.player2?.id !== uid) return false;
                            return true;
                        }));
                queueMicrotask(() => {
                    if (blockCelebration) {
                        deferredLevelUpCelebrationRef.current = levelPayload;
                    } else {
                        deferredLevelUpCelebrationRef.current = null;
                        setLevelUpCelebration(levelPayload);
                    }
                });
            }

            const prevScore = prevUser.mannerScore ?? 200;
            const nextScore = mergedUser.mannerScore ?? 200;
            const prevRankName = getMannerRank(prevScore).rank;
            const nextRankName = getMannerRank(nextScore).rank;
            if (prevRankName !== nextRankName) {
                const prevIdx = MANNER_RANKS.findIndex((r) => r.name === prevRankName);
                const nextIdx = MANNER_RANKS.findIndex((r) => r.name === nextRankName);
                const direction: 'up' | 'down' =
                    prevIdx >= 0 && nextIdx >= 0
                        ? nextIdx > prevIdx
                            ? 'up'
                            : 'down'
                        : nextScore > prevScore
                          ? 'up'
                          : 'down';
                const mannerPayload: MannerGradeChangePayload = {
                    direction,
                    previousRank: prevRankName,
                    newRank: nextRankName,
                    previousScore: prevScore,
                    newScore: nextScore,
                };
                const uid = mergedUser.id;
                const blockManner =
                    !!uid &&
                    Object.values(liveGamesRef.current).some((g) => {
                        if (!g || isSessionSingleOrTower(g)) return false;
                        if (g.gameStatus !== 'ended') return false;
                        if (g.player1?.id !== uid && g.player2?.id !== uid) return false;
                        return true;
                    });
                queueMicrotask(() => {
                    if (blockManner) {
                        deferredMannerGradeChangeRef.current = mannerPayload;
                    } else {
                        deferredMannerGradeChangeRef.current = null;
                        setMannerGradeChange(mannerPayload);
                    }
                });
            }

            const prevCleared = new Set(Array.isArray(prevUser.clearedSinglePlayerStages) ? prevUser.clearedSinglePlayerStages : []);
            const nextCleared = new Set(Array.isArray(mergedUser.clearedSinglePlayerStages) ? mergedUser.clearedSinglePlayerStages : []);
            const unlockedNow: ContentUnlockType[] = [];
            if (!prevCleared.has(TOWER_ENTRANCE_REQUIRED_STAGE_ID) && nextCleared.has(TOWER_ENTRANCE_REQUIRED_STAGE_ID)) {
                unlockedNow.push('tower');
            }
            if (!prevCleared.has(ADVENTURE_ENTRANCE_REQUIRED_STAGE_ID) && nextCleared.has(ADVENTURE_ENTRANCE_REQUIRED_STAGE_ID)) {
                unlockedNow.push('adventure');
            }
            if (unlockedNow.length > 0) {
                queueMicrotask(() => {
                    setContentUnlockNoticeQueue((prev) => {
                        const seen = new Set(prev);
                        const append = unlockedNow.filter((k) => !seen.has(k));
                        return append.length > 0 ? [...prev, ...append] : prev;
                    });
                });
            }
        }
        
        // HTTP 업데이트인 경우 타임스탬프 및 액션 타입 기록
        // (HTTP 응답에 updatedUser가 있었을 때만 타임스탬프 업데이트 - handleAction에서 처리)
        // 여기서는 source만 확인하여 로깅용으로 사용
        
        return mergedUser;
    }, [mergeUserState]);

    /** 서버 END_TOWER_GAME 응답 전에 하단 "다음 단계"가 눌리면 START_TOWER_GAME 잠금 검사가 옛 towerFloor로 실패하는 레이스 방지 */
    const applyOptimisticTowerClearOnBlackWin = useCallback((floor: number | undefined | null, winner: Player) => {
        if (winner !== Player.Black || floor == null || floor < 1) return;
        const prev = currentUserRef.current;
        if (!prev) return;
        const prevTf = prev.towerFloor ?? 0;
        const prevM = prev.monthlyTowerFloor ?? 0;
        const nextTf = Math.max(prevTf, floor);
        const nextM = Math.max(prevM, floor);
        if (nextTf === prevTf && nextM === prevM) return;
        applyUserUpdate({ towerFloor: nextTf, monthlyTowerFloor: nextM }, 'tower-clear-optimistic');
    }, [applyUserUpdate]);
    
    // --- App Settings State ---
    const [settings, setSettings] = useState<AppSettings>(() => {
        try {
            const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (storedSettings) {
                let parsed = JSON.parse(storedSettings);
                // Migration for old settings structure
                if (typeof parsed.theme === 'string') {
                    parsed = {
                        ...defaultSettings,
                        graphics: {
                            theme: parsed.theme,
                            panelColor: undefined,
                            textColor: undefined,
                        },
                        sound: parsed.sound || defaultSettings.sound,
                        features: parsed.features || defaultSettings.features,
                    };
                }
                // Deep merge to ensure new settings from code are not overwritten by old localStorage data
                return {
                    ...defaultSettings,
                    ...parsed,
                    graphics: {
                        ...defaultSettings.graphics,
                        ...(parsed.graphics || {}),
                        theme: 'black',
                        panelEdgeStyle:
                            parsed.graphics?.panelEdgeStyle ?? defaultSettings.graphics.panelEdgeStyle,
                        locale: isAppLocale(parsed.graphics?.locale)
                            ? parsed.graphics.locale
                            : defaultSettings.graphics.locale,
                    },
                    sound: {
                        ...defaultSettings.sound,
                        ...(parsed.sound || {}),
                        categoryMuted: {
                            ...defaultSettings.sound.categoryMuted,
                            ...(parsed.sound?.categoryMuted && typeof parsed.sound.categoryMuted === 'object'
                                ? parsed.sound.categoryMuted
                                : {}),
                        },
                    },
                    features: { ...defaultSettings.features, ...(parsed.features || {}) },
                };
            }
        } catch (error) { console.error('Error reading settings from localStorage', error); }
        return {
            ...defaultSettings,
            graphics: {
                ...defaultSettings.graphics,
                locale: detectBrowserLocale(),
            },
        };
    });

    const isNarrowViewport = useIsHandheldDevice(1025);
    const isShortViewportHeight = useViewportHeightBelow(VIEWPORT_HEIGHT_LAYOUT_BREAKPOINT);
    const { isPhoneHandheldTouch, isLargeTouchTablet } = useTouchLayoutProfile();
    const isPortrait = useIsPortrait();
    const handheldPortraitLockActive = useHandheldPortraitLockActive();

    /**
     * 터치 폰: 항상 세로형 네이티브 셸(pcLike 무시).
     * 8인치+ 터치 태블릿: 가로(landscape)는 PC(16:9), 세로(portrait)는 네이티브 모바일 셸.
     * 그 외(데스크톱 등): 기존처럼 pcLike·뷰포트로 결정.
     */
    const isNativeMobile = useMemo(() => {
        if (isPhoneHandheldTouch) return true;
        if (isLargeTouchTablet) return isPortrait;
        return (
            settings.graphics.pcLikeMobileLayout !== true &&
            (isNarrowViewport || isShortViewportHeight)
        );
    }, [
        isPhoneHandheldTouch,
        isLargeTouchTablet,
        isPortrait,
        isNarrowViewport,
        isShortViewportHeight,
        settings.graphics.pcLikeMobileLayout,
    ]);

    /**
     * 세로형 풀뷰포트 셸(모달 루트가 화면 픽셀 기준, modalLayerUsesDesignPixels=false).
     * 폰 물리 가로+portrait-lock 시 App이 html에 락을 걸면 isNativeMobile과 순간 불일치해도 PC 모달 레이어로 가지 않게 한다.
     */
    const usePortraitFirstShell = useMemo(
        () =>
            isNativeMobile ||
            handheldPortraitLockActive ||
            (!currentUser && isNarrowViewport && !isLargeTouchTablet),
        [isNativeMobile, handheldPortraitLockActive, currentUser, isNarrowViewport, isLargeTouchTablet],
    );

    /** `#sudamr-modal-root`가 1920×1080 설계 좌표계 안에 있을 때 true (변환 scale 적용) */
    const modalLayerUsesDesignPixels = !usePortraitFirstShell;

    /** PC 16:9 캔버스 셸에서 모달·임베드 UI 비율 통일 정책 */
    const pcUniformScalePolicy = useMemo(
        () => ({
            modalLayerUsesDesignPixels,
            preferInCanvasModalPortal: modalLayerUsesDesignPixels,
            disableSmallPcViewportPortal: modalLayerUsesDesignPixels,
        }),
        [modalLayerUsesDesignPixels],
    );

    useLayoutEffect(() => {
        if (typeof document === 'undefined') return;
        if (modalLayerUsesDesignPixels) {
            document.documentElement.setAttribute('data-pc-design-canvas', '1');
        } else {
            document.documentElement.removeAttribute('data-pc-design-canvas');
        }
    }, [modalLayerUsesDesignPixels]);

    const showPcLikeMobileLayoutSetting = !isPhoneHandheldTouch && !isLargeTouchTablet;

    useEffect(() => {
        if (!isPhoneHandheldTouch) return;
        if (settings.graphics.pcLikeMobileLayout !== true) return;
        setSettings((s) => ({ ...s, graphics: { ...s.graphics, pcLikeMobileLayout: false } }));
    }, [isPhoneHandheldTouch, settings.graphics.pcLikeMobileLayout]);

    // --- Server State ---
    const [usersMap, setUsersMap] = useState<Record<string, User>>({});
    const [onlineUsers, setOnlineUsers] = useState<UserWithStatus[]>([]);
    // 온디맨드: 프로필 보기/목록 표시 시에만 로드한 유저 brief 캐시 (nickname, avatarId, borderId)
    const [userBriefCache, setUserBriefCache] = useState<
        Record<
            string,
            {
                nickname: string;
                avatarId?: string | null;
                borderId?: string | null;
                isAdmin?: boolean;
                staffNicknameDisplayEligibility?: boolean;
                blockArenaPartnerInvites?: boolean;
            }
        >
    >({});
    const [liveGames, setLiveGames] = useState<Record<string, LiveGameSession>>({});  // 일반 게임만
    const [singlePlayerGames, setSinglePlayerGames] = useState<Record<string, LiveGameSession>>({});  // 싱글플레이 게임
    const [towerGames, setTowerGames] = useState<Record<string, LiveGameSession>>({});  // 도전의 탑 게임
    const [towerRankingsRefetchTrigger, setTowerRankingsRefetchTrigger] = useState(0);   // 도전의 탑 클리어 시 대기실 랭킹 즉시 갱신용
    const liveGameSignaturesRef = useRef<Record<string, string>>({});
    const singlePlayerGameSignaturesRef = useRef<Record<string, string>>({});
    const towerGameSignaturesRef = useRef<Record<string, string>>({});
    // CONFIRM_AI_GAME_START 직후 checkGame 폴링이 최신 게임 상태를 보도록 ref에 동기화
    const liveGamesRef = useRef<Record<string, LiveGameSession>>({});
    const singlePlayerGamesRef = useRef<Record<string, LiveGameSession>>({});
    const towerGamesRef = useRef<Record<string, LiveGameSession>>({});
    // WebSocket GAME_UPDATE 메시지 쓰로틀링 (같은 게임에 대해 최대 100ms당 1회만 처리)
    const lastGameUpdateTimeRef = useRef<Record<string, number>>({});
    const lastGameUpdateMoveCountRef = useRef<Record<string, number>>({}); // AI 수 등 새 수가 있으면 쓰로틀 무시
    const GAME_UPDATE_THROTTLE_MS = 100; // 100ms 쓰로틀링
    // 도전의 탑·전략바둑 AI: 그누고(AI) 수 수신 시 1초 지연 후 표시 (쾌적한 UX·과도한 연타 오류 방지)
    const towerGnugoDelayTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const towerScoringDelayTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({}); // AI 수 표시 후 계가 전환용
    const liveGameGnugoDelayTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const pairAiMoveRevealQueueRef = useRef<Record<string, PairAiMoveRevealQueue>>({});
    const singlePlayerKataDelayTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const singlePlayerScoringDelayTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({}); // AI 수 표시 후 계가 전환용
    /** AI 수 1초 지연 표시 중 WS가 먼저 계가만 오면 state보다 긴 수순·판면을 보존한다 */
    const pendingDeferredAiBoardSnapshotByGameIdRef = useRef<Record<string, LiveGameSession>>({});
    // 같은 게임의 AI 동기화 요청이 겹치면 턴/보드 병합이 충돌할 수 있어 in-flight 중복을 차단
    const inFlightAiSyncActionRef = useRef<Set<string>>(new Set());
    // 배포 환경 고지연에서 동일 착수 요청이 중복 전송되는 경우(더블탭/재전송) 방지
    const inFlightPlaceStoneActionRef = useRef<Set<string>>(new Set());
    const useConditionPotionInFlightRef = useRef(false);
    /** PVP 주사위 바둑: 연타 시 낙관 착수는 첫 번째 요청만, inFlight는 요청마다 증가 */
    const pvpDicePlaceInFlightRef = useRef<Record<string, number>>({});
    /** 낙관 착수 실패 시 복구용 스냅샷 (해당 gameId당 1개) */
    const pvpDicePlaceRevertRef = useRef<Record<string, LiveGameSession>>({});
    /** PVP 일반 착수(PLACE_STONE) 낙관 반영 실패 시 복구용 스냅샷 */
    const pvpPlaceStoneRevertRef = useRef<Record<string, LiveGameSession>>({});
    /** TOWER_ADD_TURNS: fetch 전 낙관 보너스(+3) 적용분 — 실패 시 롤백 */
    const towerAddTurnOptimisticPendingByGameRef = useRef<Record<string, number>>({});
    /** 싱글/탑 기권: 서버 정산(processSinglePlayerGameSummary 등) 지연 동안 즉시 ended 반영 후 실패 시 롤백 */
    const pveResignOptimisticRevertRef = useRef<{
        gameId: string;
        bucket: 'singleplayer' | 'tower';
        snapshot: LiveGameSession;
    } | null>(null);
    /** AI 주사위 바둑: 턴 내 착수 배치를 모아 마지막에 1회 전송 */
    const aiDicePlaceBatchRef = useRef<Record<string, Array<{ x: number; y: number }>>>({});
    /** 같은 턴에서 stonesToPlace는 착수마다 줄어들므로, 배치 flush 기준은 턴 시작 시점의 남은 돌 수로 고정한다. */
    const aiDiceTurnPlaceQuotaRef = useRef<Record<string, number>>({});
    /** 디버그 플래그 시 동일 키 로그 과다 출력 방지 (ms) */
    const playfulPacketOrderLogThrottleMs = 1500;
    const playfulPacketOrderLogThrottleRef = useRef<Record<string, number>>({});
    const shouldIgnoreOutdatedPlayfulUpdate = useCallback(
        (
            incoming: LiveGameSession,
            existing?: LiveGameSession | null,
            meta?: { source: string },
        ) => {
            const source = meta?.source ?? 'unknown';
            const stale = getPlayfulPacketStaleMeta(incoming, existing);
            if (!stale.ignore) return false;

            if (isSudamrPlayfulPacketOrderDebugEnabled()) {
                const gameId = incoming.id || existing?.id || '?';
                const throttleKey = `${gameId}:${stale.reason}:${source}`;
                const now = Date.now();
                const last = playfulPacketOrderLogThrottleRef.current[throttleKey] ?? 0;
                if (now - last >= playfulPacketOrderLogThrottleMs) {
                    playfulPacketOrderLogThrottleRef.current[throttleKey] = now;
                    console.warn('[SUDAMR][PlayfulPacketOrder] stale packet ignored', {
                        gameId,
                        source,
                        reason: stale.reason,
                        incoming: playfulPacketSnapshot(incoming),
                        existing: existing ? playfulPacketSnapshot(existing) : null,
                    });
                }
            }
            return true;
        },
        [],
    );
    const [negotiations, setNegotiations] = useState<Record<string, Negotiation>>({});
    const [waitingRoomChats, setWaitingRoomChats] = useState<Record<string, ChatMessage[]>>({});
    /** 대기실(전체/전략/놀이) 채팅: 재접속·INITIAL_STATE 수신 시점 이후 메시지만 표시 (서버는 채널 전체 배열을 브로드캐스트함) */
    const waitingRoomChatSessionStartRef = useRef<number>(0);
    const [gameChats, setGameChats] = useState<Record<string, ChatMessage[]>>({});
    const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
    const [gameModeAvailability, setGameModeAvailability] = useState<Partial<Record<GameMode, boolean>>>({});
    const [arenaEntranceAvailability, setArenaEntranceAvailability] = useState<Record<ArenaEntranceKey, boolean>>(() =>
        mergeArenaEntranceAvailability({}),
    );
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [globalOverrideAnnouncement, setGlobalOverrideAnnouncement] = useState<OverrideAnnouncement | null>(null);
    const [announcementInterval, setAnnouncementInterval] = useState(3);
    const [kataServerRuntimeConfig, setKataServerRuntimeConfig] = useState<KataServerRuntimeSnapshot>(() =>
        mergeKataServerRuntimeSnapshot(null),
    );
    const [championshipAbilityKataLadder, setChampionshipAbilityKataLadder] = useState<readonly ChampionshipAbilityKataLadderRow[]>(
        () => CHAMPIONSHIP_ABILITY_KATA_LADDER,
    );
    const [homeBoardPosts, setHomeBoardPosts] = useState<HomeBoardPost[]>([]);
    const [readHomeBoardPostIds, setReadHomeBoardPostIds] = useState<string[]>([]);
    /** 공지 모달 닫기 등에서 최신 목록으로 읽음 처리할 때 클로저 고착을 피함 */
    const homeBoardPostsRef = useRef<HomeBoardPost[]>([]);
    const [guilds, setGuilds] = useState<Record<string, Guild>>({});
    
    // --- UI Modals & Toasts ---
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isPetManagementModalOpen, setIsPetManagementModalOpen] = useState(false);
    const [isAdventureMonsterCodexModalOpen, setIsAdventureMonsterCodexModalOpen] = useState(false);
    const [isTrainingQuestModalOpen, setIsTrainingQuestModalOpen] = useState(false);
    const [detailedStatsType, setDetailedStatsType] = useState<'strategic' | 'playful' | 'both' | null>(null);
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [isMailboxOpen, setIsMailboxOpen] = useState(false);
    const [isQuestsOpen, setIsQuestsOpen] = useState(false);
    const [isShopOpen, setIsShopOpen] = useState(false);
    const [isExchangeOpen, setIsExchangeOpen] = useState(false);
    const [shopInitialTab, setShopInitialTab] = useState<
        'equipment' | 'materials' | 'consumables' | 'misc' | 'diamonds' | 'vip' | undefined
    >(undefined);
    const [lastUsedItemResult, setLastUsedItemResult] = useState<InventoryItem[] | null>(null);
    const [pairPetDetailModal, setPairPetDetailModal] = useState<{ item: InventoryItem; mode: 'obtain' | 'view' } | null>(null);
    const [tournamentScoreChange, setTournamentScoreChange] = useState<{ oldScore: number; newScore: number; scoreReward: number } | null>(null);
    const [disassemblyResult, setDisassemblyResult] = useState<{ gained: { name: string, amount: number }[], jackpot: boolean } | null>(null);
    const [craftResult, setCraftResult] = useState<{ gained: { name: string; amount: number }[]; used: { name: string; amount: number }[]; craftType: 'upgrade' | 'downgrade'; jackpot?: boolean } | null>(null);
    const [rewardSummary, setRewardSummary] = useState<{ reward: QuestReward; items: InventoryItem[]; title: string } | null>(null);
    const [levelUpCelebration, setLevelUpCelebration] = useState<LevelUpCelebrationPayload | null>(null);
    const deferredLevelUpCelebrationRef = useRef<LevelUpCelebrationPayload | null>(null);
    const [mannerGradeChange, setMannerGradeChange] = useState<MannerGradeChangePayload | null>(null);
    const deferredMannerGradeChangeRef = useRef<MannerGradeChangePayload | null>(null);
    const [contentUnlockNoticeQueue, setContentUnlockNoticeQueue] = useState<ContentUnlockType[]>([]);
    const contentUnlockNotice = contentUnlockNoticeQueue[0] ?? null;
    const [isClaimAllSummaryOpen, setIsClaimAllSummaryOpen] = useState(false);
    const [claimAllSummary, setClaimAllSummary] = useState<{ gold: number; diamonds: number; actionPoints: number } | null>(null);
    const [viewingUser, setViewingUser] = useState<UserWithStatus | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [isAnnouncementsModalOpen, setIsAnnouncementsModalOpen] = useState(false);
    const [isRankingQuickModalOpen, setIsRankingQuickModalOpen] = useState(false);
    const [isChatQuickModalOpen, setIsChatQuickModalOpen] = useState(false);
    const [isEncyclopediaOpen, setIsEncyclopediaOpen] = useState(false);
    const [isStatAllocationModalOpen, setIsStatAllocationModalOpen] = useState(false);
    const [enhancementResult, setEnhancementResult] = useState<{ message: string; success: boolean } | null>(null);
    const [enhancementOutcome, setEnhancementOutcome] = useState<{ message: string; success: boolean; itemBefore: InventoryItem; itemAfter: InventoryItem; xpGained?: number; isRolling?: boolean; } | null>(null);
    const [refinementResult, setRefinementResult] = useState<{ message: string; success: boolean; itemBefore: InventoryItem; itemAfter: InventoryItem; } | null>(null);
    const [enhancementAnimationTarget, setEnhancementAnimationTarget] = useState<{ itemId: string; stars: number } | null>(null);
    const [pastRankingsInfo, setPastRankingsInfo] = useState<{
        user: UserWithStatus;
        mode: GameMode | 'strategic' | 'pair' | 'unified';
    } | null>(null);
    const [enhancingItem, setEnhancingItem] = useState<InventoryItem | null>(null);
    const [viewingItem, setViewingItem] = useState<{
        item: InventoryItem;
        isOwnedByCurrentUser: boolean;
        /** 거래소 등록분 등: 강화/제련 비활성, 확인만 */
        hideEnhanceActions?: boolean;
    } | null>(null);
    const [showExitToast, setShowExitToast] = useState(false);
    const exitToastTimer = useRef<number | null>(null);
    /** 서버 재시작·WS 끊김 안내 (전역 토스트) */
    const [serverReconnectNotice, setServerReconnectNotice] = useState<string | null>(null);
    const serverReconnectTimerRef = useRef<number | null>(null);
    const wsReconnectAttemptRef = useRef(0);
    const [connectionStatus, setConnectionStatus] = useState<AppConnectionStatus>(CONNECTION_OK_STATUS);
    const connectionNoticeTimerRef = useRef<number | null>(null);
    const connectionIssueSeenRef = useRef(false);
    const [isProfileEditModalOpen, setIsProfileEditModalOpen] = useState(false);
    const [moderatingUser, setModeratingUser] = useState<UserWithStatus | null>(null);
    const [isMbtiInfoModalOpen, setIsMbtiInfoModalOpen] = useState(false);
    const [mutualDisconnectMessage, setMutualDisconnectMessage] = useState<string | null>(null);
    const [rankedMatchingQueue, setRankedMatchingQueue] = useState<Record<string, Record<string, any>>>({});
    const [rankedMatchProposal, setRankedMatchProposal] = useState<{
        proposalId: string;
        acceptDeadlineAt: number;
        player1: { id: string; nickname: string; rating: number; winChange: number; lossChange: number; accepted: boolean };
        player2: { id: string; nickname: string; rating: number; winChange: number; lossChange: number; accepted: boolean };
    } | null>(null);
    const [rankedMatchFound, setRankedMatchFound] = useState<{ gameId: string; player1: any; player2: any } | null>(null);
    const [pairRooms, setPairRooms] = useState<Record<string, any>>({});
    /** 페어 방 채팅(전체+우리팀 본인 기준 병합본) — PAIR_ROOM_CHAT·PAIR_ROOM_UPDATE·HTTP pairRoomChatHistory로 동기 */
    const [pairRoomChatByRoomId, setPairRoomChatByRoomId] = useState<Record<string, PairRoomChatLine[]>>({});
    const [pairPartnerInvites, setPairPartnerInvites] = useState<Record<string, any>>({});
    const [pairInviteCooldownUntilByInviteeId, setPairInviteCooldownUntilByInviteeId] = useState<Record<string, number>>({});
    /** 로그인 응답에 포함된 진행 중 경기 (다른 PC에서 로그인 후 즉시 이어하기용, INITIAL_STATE 수신 시 해제) */
    const [activeGameFromLogin, setActiveGameFromLogin] = useState<LiveGameSession | null>(null);
    /** 다른 기기에서 로그인되어 자동 로그아웃 안내 모달 표시 여부 */
    const [showOtherDeviceLoginModal, setShowOtherDeviceLoginModal] = useState(false);
    const [isEquipmentEffectsModalOpen, setIsEquipmentEffectsModalOpen] = useState(false);
    const [isBlacksmithModalOpen, setIsBlacksmithModalOpen] = useState(false);
    const [isGameRecordListOpen, setIsGameRecordListOpen] = useState(false);
    const [viewingGameRecord, setViewingGameRecord] = useState<GameRecord | null>(null);
    const [blacksmithSelectedItemForEnhancement, setBlacksmithSelectedItemForEnhancement] = useState<InventoryItem | null>(null);
    const [blacksmithActiveTab, setBlacksmithActiveTab] = useState<'enhance' | 'combine' | 'disassemble' | 'convert' | 'refine'>('enhance');
    const [combinationResult, setCombinationResult] = useState<{ item: InventoryItem; xpGained: number; isGreatSuccess: boolean; } | null>(null);
    const [isBlacksmithEffectsModalOpen, setIsBlacksmithEffectsModalOpen] = useState(false);
    const [isEnhancementResultModalOpen, setIsEnhancementResultModalOpen] = useState(false);
    const [isInsufficientActionPointsModalOpen, setIsInsufficientActionPointsModalOpen] = useState(false);
    const [isOpponentInsufficientActionPointsModalOpen, setIsOpponentInsufficientActionPointsModalOpen] = useState(false);
    const [isActionPointModalOpen, setIsActionPointModalOpen] = useState(false);
    /** PC 로비 중앙 뷰포트 인라인 퀵 유틸 패널 (해시 변경 없음) */
    const [activeQuickUtilityPanel, setActiveQuickUtilityPanel] = useState<QuickUtilityPanelKind | null>(null);
    /** 모바일 portrait 셸: Router 영역 뷰포트 스택 (퀵메뉴·2차 화면·로비 모달) */
    const [mobileViewportStack, setMobileViewportStack] = useState<MobileViewportEntry[]>([]);

    const homeBoardReadStorageKey = useMemo(
        () => `${HOME_BOARD_READ_STORAGE_PREFIX}:${currentUser?.id ?? 'guest'}`,
        [currentUser?.id],
    );

    // useLayoutEffect: 복원을 paint·저장 effect보다 먼저 적용해, 초기 []가 localStorage를 덮어쓰는 레이스를 막음
    useLayoutEffect(() => {
        try {
            const raw = localStorage.getItem(homeBoardReadStorageKey);
            if (!raw) {
                setReadHomeBoardPostIds([]);
                return;
            }
            const parsed = JSON.parse(raw);
            setReadHomeBoardPostIds(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
        } catch {
            setReadHomeBoardPostIds([]);
        }
    }, [homeBoardReadStorageKey]);

    useEffect(() => {
        try {
            localStorage.setItem(homeBoardReadStorageKey, JSON.stringify(readHomeBoardPostIds));
        } catch {
            // ignore storage failure
        }
    }, [homeBoardReadStorageKey, readHomeBoardPostIds]);

    useEffect(() => {
        // 게시글이 아직 로드되지 않은 []에서는 정리하지 않음 — 그렇지 않으면 복원한 읽음 목록이 전부 지워짐
        if (homeBoardPosts.length === 0) return;
        const currentIds = new Set(homeBoardPosts.map((p) => p.id));
        setReadHomeBoardPostIds((prev) => {
            const next = prev.filter((id) => currentIds.has(id));
            return next.length === prev.length ? prev : next;
        });
    }, [homeBoardPosts]);

    const unreadHomeBoardPostIds = useMemo(() => {
        const readSet = new Set(readHomeBoardPostIds);
        return homeBoardPosts.filter((post) => !readSet.has(post.id)).map((post) => post.id);
    }, [homeBoardPosts, readHomeBoardPostIds]);
    const hasUnreadHomeBoardPosts = unreadHomeBoardPostIds.length > 0;

    homeBoardPostsRef.current = homeBoardPosts;

    const markAllHomeBoardPostsReadFromRef = useCallback(() => {
        setReadHomeBoardPostIds((prev) => {
            const posts = homeBoardPostsRef.current;
            if (posts.length === 0) return prev;
            const next = new Set(prev);
            for (const p of posts) {
                if (p?.id) next.add(p.id);
            }
            const arr = Array.from(next);
            if (arr.length === prev.length && prev.every((id) => next.has(id))) return prev;
            return arr;
        });
    }, []);

    const sortedHomeBoardPostIdsKey = useMemo(
        () =>
            homeBoardPosts.length === 0
                ? ''
                : [...homeBoardPosts]
                      .map((p) => p.id)
                      .filter(Boolean)
                      .sort()
                      .join('\u0001'),
        [homeBoardPosts],
    );

    useEffect(() => {
        const announcementsOpen =
            isAnnouncementsModalOpen || activeQuickUtilityPanel === 'announcements';
        if (!announcementsOpen || !sortedHomeBoardPostIdsKey) return;
        markAllHomeBoardPostsReadFromRef();
    }, [isAnnouncementsModalOpen, activeQuickUtilityPanel, sortedHomeBoardPostIdsKey, markAllHomeBoardPostsReadFromRef]);

    const markHomeBoardPostRead = useCallback((postId: string) => {
        if (!postId) return;
        setReadHomeBoardPostIds((prev) => (prev.includes(postId) ? prev : [...prev, postId]));
    }, []);

    const activeQuickUtilityPanelRef = useRef<QuickUtilityPanelKind | null>(null);
    const mobileViewportStackRef = useRef<MobileViewportEntry[]>([]);
    const closingMobileViewportFromUiRef = useRef(false);

    useEffect(() => {
        activeQuickUtilityPanelRef.current = activeQuickUtilityPanel;
    }, [activeQuickUtilityPanel]);

    useEffect(() => {
        mobileViewportStackRef.current = mobileViewportStack;
    }, [mobileViewportStack]);

    const applyQuickUtilitySideEffectsOnClose = useCallback(
        (kind: QuickUtilityPanelKind | null) => {
            if (!kind) return;
            if (kind === 'detailedStats') setDetailedStatsType(null);
            if (kind === 'trainingQuest') setIsTrainingQuestModalOpen(false);
            if (kind === 'monsterCodex') setIsAdventureMonsterCodexModalOpen(false);
            if (kind === 'announcements') markAllHomeBoardPostsReadFromRef();
            if (kind === 'help') setIsInfoModalOpen(false);
        },
        [markAllHomeBoardPostsReadFromRef],
    );

    const syncActiveQuickUtilityFromStack = useCallback((stack: MobileViewportEntry[]) => {
        setActiveQuickUtilityPanel(getQuickUtilityKindFromStack(stack));
    }, []);

    const applyMobileViewportPopSideEffects = useCallback((entry: MobileViewportEntry) => {
        switch (entry.type) {
            case 'itemDetail':
                setViewingItem(null);
                break;
            case 'gameRecordViewer':
                setViewingGameRecord(null);
                break;
            case 'settings':
                setIsSettingsModalOpen(false);
                break;
            case 'mailbox':
                setIsMailboxOpen(false);
                break;
            case 'profileEdit':
                setIsProfileEditModalOpen(false);
                break;
            case 'statAllocation':
                setIsStatAllocationModalOpen(false);
                break;
            case 'userProfile':
                setViewingUser(null);
                break;
            case 'pastRankings':
                setPastRankingsInfo(null);
                break;
            case 'equipmentEffects':
                setIsEquipmentEffectsModalOpen(false);
                break;
            case 'blacksmithEffects':
                setIsBlacksmithEffectsModalOpen(false);
                break;
            case 'chatQuick':
                setIsChatQuickModalOpen(false);
                break;
            case 'actionPoint':
                setIsActionPointModalOpen(false);
                break;
            case 'quickUtility':
                applyQuickUtilitySideEffectsOnClose(entry.kind);
                break;
            default:
                break;
        }
    }, [applyQuickUtilitySideEffectsOnClose]);

    const replaceMobileViewport = useCallback(
        (entry: MobileViewportEntry) => {
            if (!usePortraitFirstShell) return false;
            setMobileViewportStack([entry]);
            syncActiveQuickUtilityFromStack([entry]);
            return true;
        },
        [syncActiveQuickUtilityFromStack, usePortraitFirstShell],
    );

    const pushMobileViewport = useCallback(
        (entry: MobileViewportEntry) => {
            if (!usePortraitFirstShell) return false;
            setMobileViewportStack((prev) => {
                const next = [...prev, entry];
                syncActiveQuickUtilityFromStack(next);
                return next;
            });
            return true;
        },
        [syncActiveQuickUtilityFromStack, usePortraitFirstShell],
    );

    const popMobileViewport = useCallback(
        (opts?: { fromPopState?: boolean }) => {
            if (!usePortraitFirstShell) return;
            setMobileViewportStack((prev) => {
                if (prev.length === 0) return prev;
                const popped = prev[prev.length - 1];
                applyMobileViewportPopSideEffects(popped);
                const next = prev.slice(0, -1);
                syncActiveQuickUtilityFromStack(next);
                return next;
            });
            if (
                !opts?.fromPopState &&
                typeof window !== 'undefined' &&
                (window.history.state as { sudamrMobileViewport?: boolean } | null)?.sudamrMobileViewport
            ) {
                closingMobileViewportFromUiRef.current = true;
                window.history.back();
            }
        },
        [applyMobileViewportPopSideEffects, syncActiveQuickUtilityFromStack, usePortraitFirstShell],
    );

    const clearMobileViewport = useCallback(
        (opts?: { fromPopState?: boolean }) => {
            if (!usePortraitFirstShell) return;
            setMobileViewportStack((prev) => {
                for (let i = prev.length - 1; i >= 0; i -= 1) {
                    applyMobileViewportPopSideEffects(prev[i]);
                }
                syncActiveQuickUtilityFromStack([]);
                return [];
            });
            if (
                !opts?.fromPopState &&
                typeof window !== 'undefined' &&
                (window.history.state as { sudamrMobileViewport?: boolean } | null)?.sudamrMobileViewport
            ) {
                closingMobileViewportFromUiRef.current = true;
                window.history.back();
            }
        },
        [applyMobileViewportPopSideEffects, syncActiveQuickUtilityFromStack, usePortraitFirstShell],
    );

    const openQuickUtilityViewport = useCallback(
        (kind: QuickUtilityPanelKind, opts?: { modal?: boolean }) => {
            if (opts?.modal) return false;
            if (replaceMobileViewport({ type: 'quickUtility', kind })) return true;
            setActiveQuickUtilityPanel(kind);
            return false;
        },
        [replaceMobileViewport],
    );

    /** opts.modal이면 DraggableWindow 모달, 모바일 세로 셸 기본은 quickUtility 뷰포트. */
    const openBlacksmithUi = useCallback(
        (opts?: { modal?: boolean }) => {
            if (opts?.modal) {
                setIsBlacksmithModalOpen(true);
                return;
            }
            if (!openQuickUtilityViewport('blacksmith')) {
                setActiveQuickUtilityPanel('blacksmith');
            }
        },
        [openQuickUtilityViewport],
    );

    const closeQuickUtilityPanel = useCallback(
        (opts?: { fromPopState?: boolean }) => {
            if (usePortraitFirstShell && mobileViewportStackRef.current.length > 0) {
                clearMobileViewport(opts);
                return;
            }
            setActiveQuickUtilityPanel((prev) => {
                if (!prev) return prev;
                applyQuickUtilitySideEffectsOnClose(prev);
                return null;
            });
            if (
                usePortraitFirstShell &&
                !opts?.fromPopState &&
                typeof window !== 'undefined' &&
                (window.history.state as { sudamrMobileViewport?: boolean } | null)?.sudamrMobileViewport
            ) {
                closingMobileViewportFromUiRef.current = true;
                window.history.back();
            }
        },
        [applyQuickUtilitySideEffectsOnClose, clearMobileViewport, usePortraitFirstShell],
    );

    const dismissQuickMenuOnNavigation = useCallback(
        (opts?: { fromPopState?: boolean }) => {
            if (usePortraitFirstShell && mobileViewportStackRef.current.length > 0) {
                clearMobileViewport(opts);
            } else if (activeQuickUtilityPanelRef.current) {
                closeQuickUtilityPanel(opts);
            }

            setIsPetManagementModalOpen(false);
            setIsAdventureMonsterCodexModalOpen(false);
            setIsTrainingQuestModalOpen(false);
            setDetailedStatsType(null);
            setIsInventoryOpen(false);
            setIsQuestsOpen(false);
            setIsShopOpen(false);
            setShopInitialTab(undefined);
            setIsExchangeOpen(false);
            setIsInfoModalOpen(false);
            setIsAnnouncementsModalOpen(false);
            setIsRankingQuickModalOpen(false);
            setIsEncyclopediaOpen(false);
            setIsBlacksmithModalOpen(false);
            setIsGameRecordListOpen(false);
        },
        [clearMobileViewport, closeQuickUtilityPanel, usePortraitFirstShell],
    );

    const routeNavigationKeyRef = useRef<string | null>(null);

    useEffect(() => {
        const key = getAppRouteNavigationKey(currentRoute);
        const prevKey = routeNavigationKeyRef.current;
        routeNavigationKeyRef.current = key;
        if (prevKey === null || prevKey === key) return;
        dismissQuickMenuOnNavigation({ fromPopState: true });
    }, [currentRoute, dismissQuickMenuOnNavigation]);

    useEffect(() => {
        if (!usePortraitFirstShell || mobileViewportStack.length === 0) return;

        const hash = window.location.hash || APP_HOME_HASH;
        window.history.pushState({ sudamrMobileViewport: true }, '', hash);

        const onPopState = () => {
            if (closingMobileViewportFromUiRef.current) {
                closingMobileViewportFromUiRef.current = false;
                return;
            }
            if (mobileViewportStackRef.current.length > 0) {
                if (mobileViewportStackRef.current.length === 1) {
                    clearMobileViewport({ fromPopState: true });
                } else {
                    popMobileViewport({ fromPopState: true });
                }
            }
        };

        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [mobileViewportStack.length, usePortraitFirstShell, clearMobileViewport, popMobileViewport]);

    useEffect(() => {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        } catch (error) { console.error('Error saving settings to localStorage', error); }
        
        const root = document.documentElement;
        if (settings.graphics.panelColor) {
            root.style.setProperty('--custom-panel-bg', settings.graphics.panelColor);
        } else {
            root.style.removeProperty('--custom-panel-bg');
        }
        if (settings.graphics.textColor) {
            root.style.setProperty('--custom-text-color', settings.graphics.textColor);
        } else {
            root.style.removeProperty('--custom-text-color');
        }
        const edgeStyle = settings.graphics.panelEdgeStyle ?? 'default';
        const edgeImages = getPanelEdgeImages(edgeStyle);
        root.style.setProperty('--panel-edge-top-left', edgeImages.topLeft ?? 'none');
        root.style.setProperty('--panel-edge-top-right', edgeImages.topRight ?? 'none');
        root.style.setProperty('--panel-edge-bottom-left', edgeImages.bottomLeft ?? 'none');
        root.style.setProperty('--panel-edge-bottom-right', edgeImages.bottomRight ?? 'none');
        // 엣지 스타일이 'none'이 아닌 경우 data 속성 추가 (CSS에서 금색 테두리 적용용)
        if (edgeStyle !== 'none') {
            root.setAttribute('data-edge-style', edgeStyle);
        } else {
            root.setAttribute('data-edge-style', 'none');
        }

    }, [settings]);



    useEffect(() => {
        document.documentElement.setAttribute('data-theme', settings.graphics.theme);
    }, [settings.graphics.theme]);

    useEffect(() => {
        const locale = settings.graphics.locale ?? DEFAULT_LOCALE;
        if (i18n.language !== locale) {
            void i18n.changeLanguage(locale);
        }
        applyDocumentLocale(locale);
    }, [settings.graphics.locale]);

    useEffect(() => {
        audioService.updateSettings(settings.sound);
    }, [settings.sound]);

    const updatePanelColor = useCallback((color: string) => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, panelColor: color }}));
    }, []);

    const updateTextColor = useCallback((color: string) => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, textColor: color }}));
    }, []);
    
    const updatePanelEdgeStyle = useCallback((edgeStyle: PanelEdgeStyle) => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, panelEdgeStyle: edgeStyle }}));
    }, []);

    const updateLocale = useCallback((locale: AppLocale) => {
        applyDocumentLocale(locale);
        void i18n.changeLanguage(locale);
        setSettings(s => ({ ...s, graphics: { ...s.graphics, locale } }));
    }, []);

    const updatePcLikeMobileLayout = useCallback((value: boolean) => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, pcLikeMobileLayout: value } }));
    }, []);
    
    const resetGraphicsToDefault = useCallback(() => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, panelColor: undefined, textColor: undefined, panelEdgeStyle: 'default' } }));
    }, []);

    const updateSoundSetting = useCallback(<K extends keyof SoundSettings>(key: K, value: SoundSettings[K]) => {
        setSettings(s => ({ ...s, sound: { ...s.sound, [key]: value } }));
    }, []);

    const updateFeatureSetting = useCallback(<K extends keyof FeatureSettings>(key: K, value: FeatureSettings[K]) => {
        setSettings(s => ({ ...s, features: { ...s.features, [key]: value } }));
    }, []);

    // --- Derived State ---
    const allUsers = useMemo(() => {
        if (!usersMap || typeof usersMap !== 'object') return [];
        return Object.values(usersMap);
    }, [usersMap]);

    // 온디맨드: onlineUsers의 id에 대해 brief가 없으면 /api/users/brief 요청
    const userBriefCacheRef = useRef(userBriefCache);
    userBriefCacheRef.current = userBriefCache;
    useEffect(() => {
        const ids = (onlineUsers || []).map(u => u?.id).filter(Boolean) as string[];
        const cache = userBriefCacheRef.current;
        const toFetch = ids.filter(id => !cache[id]);
        if (toFetch.length === 0) return;
        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch(getApiUrl(`/api/users/brief?ids=${encodeURIComponent(toFetch.join(','))}`), { signal: controller.signal });
                if (!res.ok) return;
                const data = await res.json();
                if (Array.isArray(data)) {
                    setUserBriefCache(prev => {
                        const next = { ...prev };
                        data.forEach(
                            (b: {
                                id: string;
                                nickname: string;
                                avatarId?: string | null;
                                borderId?: string | null;
                                isAdmin?: boolean;
                                staffNicknameDisplayEligibility?: boolean;
                                blockArenaPartnerInvites?: boolean;
                            }) => {
                                if (b?.id)
                                    next[b.id] = {
                                        nickname: b.nickname || b.id,
                                        avatarId: b.avatarId,
                                        borderId: b.borderId,
                                        isAdmin: b.isAdmin,
                                        staffNicknameDisplayEligibility: b.staffNicknameDisplayEligibility,
                                        blockArenaPartnerInvites: b.blockArenaPartnerInvites === true,
                                    };
                            },
                        );
                        return next;
                    });
                }
            } catch (e) {
                if ((e as Error)?.name !== 'AbortError') console.warn('[useApp] Fetch users brief failed:', e);
            }
        })();
        return () => controller.abort();
    }, [onlineUsers]); // onlineUsers 변경 시에만 실행

    // 현재 사용자 brief를 캐시에 추가 (목록에서 "나" 표시)
    useEffect(() => {
        if (currentUser?.id && !userBriefCache[currentUser.id]) {
            setUserBriefCache(prev => ({
                ...prev,
                [currentUser.id]: {
                    nickname: currentUser.nickname || currentUser.username || currentUser.id,
                    avatarId: currentUser.avatarId,
                    borderId: currentUser.borderId,
                    isAdmin: currentUser.isAdmin,
                    staffNicknameDisplayEligibility: currentUser.staffNicknameDisplayEligibility,
                    blockArenaPartnerInvites: currentUser.blockArenaPartnerInvites === true,
                },
            }));
        }
    }, [currentUser?.id, currentUser?.nickname, currentUser?.username]);

    // brief 캐시와 병합한 온라인 유저 (목록 표시용)
    const enrichedOnlineUsers = useMemo(() => {
        return (onlineUsers || []).map(u => {
            const brief = u?.id ? userBriefCache[u.id] : null;
            return {
                ...u,
                nickname: brief?.nickname ?? (u as any).nickname ?? '...',
                avatarId: brief?.avatarId ?? (u as any).avatarId,
                borderId: brief?.borderId ?? (u as any).borderId,
                isAdmin: (u as any).isAdmin ?? brief?.isAdmin ?? false,
                staffNicknameDisplayEligibility:
                    (u as any).staffNicknameDisplayEligibility ?? brief?.staffNicknameDisplayEligibility ?? false,
                blockArenaPartnerInvites:
                    typeof (u as any).blockArenaPartnerInvites === 'boolean'
                        ? (u as any).blockArenaPartnerInvites
                        : brief?.blockArenaPartnerInvites === true,
            };
        });
    }, [onlineUsers, userBriefCache]);

    // 행동력 실시간 업데이트를 위한 상태
    const [actionPointUpdateTrigger, setActionPointUpdateTrigger] = useState(0);
    
    // 행동력을 실시간으로 계산하는 useEffect
    useEffect(() => {
        if (!currentUser || !currentUser.actionPoints) return;

        const guildForAp =
            currentUser.guildId != null && currentUser.guildId !== ''
                ? guilds[currentUser.guildId] ?? null
                : null;

        const intervalId = setInterval(() => {
            const liveUser = currentUserRef.current;
            if (!liveUser?.actionPoints || liveUser.lastActionPointUpdate === undefined) return;

            const liveGuildForAp =
                liveUser.guildId != null && liveUser.guildId !== ''
                    ? guilds[liveUser.guildId] ?? null
                    : null;
            const effects = calculateUserEffects(liveUser, liveGuildForAp);
            const now = Date.now();
            const calculatedMaxAP = effects.maxActionPoints;

            // 현재 < 최대인데 last가 0이면(만땅에서 최대만 올라간 직후 등) 회복 타이머를 즉시 시작
            if (liveUser.actionPoints.current < calculatedMaxAP) {
                const lu = liveUser.lastActionPointUpdate;
                if (lu === 0 || lu === undefined || lu === null) {
                    setCurrentUser(prev => {
                        if (!prev?.actionPoints) return prev;
                        const g2 =
                            prev.guildId != null && prev.guildId !== '' ? guilds[prev.guildId] ?? null : null;
                        const e2 = calculateUserEffects(prev, g2);
                        const maxAp = e2.maxActionPoints;
                        if (prev.actionPoints.current >= maxAp) return prev;
                        const pLu = prev.lastActionPointUpdate;
                        if (pLu !== 0 && pLu !== undefined && pLu !== null) return prev;
                        return { ...prev, lastActionPointUpdate: Date.now() };
                    });
                    return;
                }
            }

            // 행동력이 최대치가 아니고, lastActionPointUpdate가 유효한 경우에만 계산
            if (liveUser.actionPoints.current < calculatedMaxAP && liveUser.lastActionPointUpdate !== 0) {
                const lastUpdate = liveUser.lastActionPointUpdate;
                if (typeof lastUpdate === 'number' && !isNaN(lastUpdate)) {
                    const elapsedMs = now - lastUpdate;
                    const regenInterval =
                        effects.actionPointRegenInterval > 0
                            ? effects.actionPointRegenInterval
                            : ACTION_POINT_REGEN_INTERVAL_MS;
                    const pointsToAdd = Math.floor(elapsedMs / regenInterval);

                    if (pointsToAdd > 0) {
                        setCurrentUser(prev => {
                            if (!prev?.actionPoints) return prev;
                            const g2 =
                                prev.guildId != null && prev.guildId !== ''
                                    ? guilds[prev.guildId] ?? null
                                    : null;
                            const e2 = calculateUserEffects(prev, g2);
                            const maxAp = e2.maxActionPoints;
                            const pLast = prev.lastActionPointUpdate;
                            if (typeof pLast !== 'number' || Number.isNaN(pLast) || pLast === 0) return prev;
                            const elapsed = now - pLast;
                            const interval =
                                e2.actionPointRegenInterval > 0
                                    ? e2.actionPointRegenInterval
                                    : ACTION_POINT_REGEN_INTERVAL_MS;
                            const add = Math.floor(elapsed / interval);
                            if (add <= 0) return prev;
                            const newCurrent = Math.min(maxAp, prev.actionPoints.current + add);
                            const newLastUpdate =
                                newCurrent >= maxAp ? 0 : pLast + add * interval;
                            if (
                                newCurrent === prev.actionPoints.current &&
                                newLastUpdate === prev.lastActionPointUpdate &&
                                maxAp === prev.actionPoints.max
                            ) {
                                return prev;
                            }
                            return {
                                ...prev,
                                actionPoints: {
                                    ...prev.actionPoints,
                                    current: newCurrent,
                                    max: maxAp,
                                },
                                lastActionPointUpdate: newLastUpdate,
                            };
                        });
                        setActionPointUpdateTrigger(prev => prev + 1);
                    }
                }
            }
        }, 1000); // 1초마다 체크
        
        return () => clearInterval(intervalId);
    }, [
        currentUser?.actionPoints?.current,
        currentUser?.lastActionPointUpdate,
        currentUser?.id,
        currentUser?.equipment,
        currentUser?.guildId,
        guilds,
    ]);
    
    const currentUserWithStatus: UserWithStatus | null = useMemo(() => {
        // updateTrigger와 actionPointUpdateTrigger를 dependency에 포함시켜 강제 리렌더링 보장
        if (!currentUser) return null;
        const statusInfo = Array.isArray(onlineUsers)
            ? onlineUsers.find(u => u && u.id === currentUser.id) ??
              onlineUsers.find(u => u && String(u.id) === String(currentUser.id))
            : null;
        let statusData: UserStatusInfo = {
            status: statusInfo?.status ?? ('online' as UserStatus),
            mode: statusInfo?.mode,
            gameId: statusInfo?.gameId,
            spectatingGameId: statusInfo?.spectatingGameId,
            waitingLobby: statusInfo?.waitingLobby,
            gameCategory: statusInfo?.gameCategory,
            inPairLobby: statusInfo?.inPairLobby,
        };
        // 로그인 응답으로 받은 진행 중 경기가 있으면 WebSocket INITIAL_STATE 전까지 in-game으로 표시
        if (activeGameFromLogin && (activeGameFromLogin.player1?.id === currentUser.id || activeGameFromLogin.player2?.id === currentUser.id)) {
            statusData = { ...statusData, status: 'in-game' as UserStatus, gameId: activeGameFromLogin.id };
        }
        
        // 행동력 최대치를 실시간으로 계산하여 반영
        const guildForAp =
            currentUser.guildId != null && currentUser.guildId !== ''
                ? guilds[currentUser.guildId] ?? null
                : null;
        const effects = calculateUserEffects(currentUser, guildForAp);
        const calculatedMaxAP = effects.maxActionPoints;
        const updatedActionPoints = currentUser.actionPoints ? {
            ...currentUser.actionPoints,
            max: calculatedMaxAP
        } : currentUser.actionPoints;
        
        return { ...currentUser, actionPoints: updatedActionPoints, ...statusData };
    }, [currentUser, onlineUsers, updateTrigger, actionPointUpdateTrigger, activeGameFromLogin, guilds]);

    const arenaEntranceFromServer = useMemo(
        () => mergeArenaEntranceAvailability(arenaEntranceAvailability),
        [arenaEntranceAvailability],
    );

    const arenaEntranceAvailabilityResolved = useMemo(() => {
        const base = arenaEntranceFromServer;
        const u = currentUserWithStatus;
        if (!u || isClientAdmin(u)) return base;
        const snap = getBadukAbilitySnapshotFromStats(u, calculateTotalStats(u));
        const prog = applyUserProgressionArenaLocks(base, snap);
        return prog;
    }, [
        arenaEntranceFromServer,
        currentUserWithStatus,
        updateTrigger,
    ]);

    useEffect(() => {
        currentUserStatusRef.current = currentUserWithStatus;
    }, [currentUserWithStatus]);

    useEffect(() => {
        liveGamesRef.current = liveGames;
        singlePlayerGamesRef.current = singlePlayerGames;
        towerGamesRef.current = towerGames;
    }, [liveGames, singlePlayerGames, towerGames]);

    /** PvP 대국 결과(종료) 화면 중에는 안내 모달을 늦추고, 퇴장 등으로 liveGames에서 사라진 뒤 표시 */
    useEffect(() => {
        const uid = currentUserRef.current?.id;
        if (!uid) return;
        const block = Object.values(liveGamesRef.current).some((g) => {
            if (!g || isSessionSingleOrTower(g)) return false;
            if (g.gameStatus !== 'ended') return false;
            if (g.player1?.id !== uid && g.player2?.id !== uid) return false;
            return true;
        });
        if (block) return;
        const pendingLevel = deferredLevelUpCelebrationRef.current;
        const pendingManner = deferredMannerGradeChangeRef.current;
        if (pendingLevel) {
            deferredLevelUpCelebrationRef.current = null;
            setLevelUpCelebration(pendingLevel);
        }
        if (pendingManner) {
            deferredMannerGradeChangeRef.current = null;
            setMannerGradeChange(pendingManner);
        }
    }, [liveGames]);

    /** 챔피언십 장내 카타: 대국 결과 모달 시점에 보류 중인 레벨업 축하 모달 표시 */
    useEffect(() => {
        registerChampionshipVersusDeferredLevelUpFlush(() => {
            const pendingLevel = deferredLevelUpCelebrationRef.current;
            if (!pendingLevel) return;
            deferredLevelUpCelebrationRef.current = null;
            setLevelUpCelebration(pendingLevel);
        });
        return () => registerChampionshipVersusDeferredLevelUpFlush(null);
    }, []);

    /** 관리자 홈: 레벨업 축하 모달 미리보기(실제 데이터 반영, 서버/레벨은 변경하지 않음) */
    const previewAdminLevelUpCelebrationModal = useCallback(() => {
        const u = currentUserRef.current;
        if (!u?.isAdmin) return;
        deferredLevelUpCelebrationRef.current = null;
        const s = Math.max(1, u.userLevel ?? 1);
        setLevelUpCelebration({
            strategy: s > 1 ? { from: s - 1, to: s } : { from: 1, to: 2 },
            playful: undefined,
        });
    }, []);

    /** 관리자 홈: 매너 등급 상승 모달 미리보기(직전 구간 → 현재 등급) */
    const previewAdminMannerGradeUpModal = useCallback(() => {
        const u = currentUserRef.current;
        if (!u?.isAdmin) return;
        deferredMannerGradeChangeRef.current = null;
        const score = u.mannerScore ?? 200;
        const currentRankName = getMannerRank(score).rank;
        const idx = MANNER_RANKS.findIndex((r) => r.name === currentRankName);
        if (idx <= 0) {
            setMannerGradeChange({
                direction: 'up',
                previousRank: MANNER_RANKS[0].name,
                newRank: MANNER_RANKS[1].name,
                previousScore: 0,
                newScore: MANNER_RANKS[1].min,
            });
            return;
        }
        const prevTier = MANNER_RANKS[idx - 1];
        const curTier = MANNER_RANKS[idx];
        const prevUpper = prevTier.max === Infinity ? curTier.min - 1 : prevTier.max;
        const previousScore = Math.max(prevTier.min, Math.min(prevUpper, score - 1));
        setMannerGradeChange({
            direction: 'up',
            previousRank: prevTier.name,
            newRank: currentRankName,
            previousScore,
            newScore: score,
        });
    }, []);

    /** 관리자 홈: 콘텐츠 해금 안내 모달 미리보기 */
    const previewAdminContentUnlockNoticeModal = useCallback((type: ContentUnlockType) => {
        const u = currentUserRef.current;
        if (!u?.isAdmin) return;
        setContentUnlockNoticeQueue([type]);
    }, []);

    const [adminGameResultDemoSession, setAdminGameResultDemoSession] = useState<LiveGameSession | null>(null);

    /** 관리자 홈: PVP 경기 결과 모달 데모 */
    const previewAdminGameResultModal = useCallback(() => {
        const u = currentUserRef.current;
        if (!u?.isAdmin) return;
        setAdminGameResultDemoSession(buildAdminGameResultModalDemoSession(u));
    }, []);

    const closeAdminGameResultDemoModal = useCallback(() => {
        setAdminGameResultDemoSession(null);
    }, []);

    const activeGame = useMemo(() => {
        if (!currentUserWithStatus) return null;
        const gameId = currentUserWithStatus.gameId || currentUserWithStatus.spectatingGameId;
        if (gameId) {
            // status가 'in-game'이거나 'spectating'이면 게임으로 라우팅
            // 'negotiating' 상태는 제거 (대국 신청 중에는 게임이 아님)
            // scoring 상태의 게임도 포함 (계가 진행 중)
            if (currentUserWithStatus.status === 'in-game' || currentUserWithStatus.status === 'spectating') {
                // 모든 게임 카테고리에서 찾기
                const game = liveGames[gameId] || singlePlayerGames[gameId] || towerGames[gameId];
                if (game) {
                    return game;
                }
            }
            // scoring 상태의 게임은 사용자 상태와 관계없이 activeGame으로 인식
            // (계가 진행 중에는 사용자 상태가 변경될 수 있음)
            const game = liveGames[gameId] || singlePlayerGames[gameId] || towerGames[gameId];
            if (game && game.gameStatus === 'scoring') {
                return game;
            }
        }
        // 새로고침(F5) 후 재입장: URL이 #/game/:id 이고 해당 게임이 스토어에 있으면(재입장 API로 로드) 참가자일 때 activeGame으로 사용
        const urlGameId = currentRoute?.view === 'game' ? (currentRoute.params?.id ?? '') : '';
        if (urlGameId && currentUser) {
            const gameFromUrl = liveGames[urlGameId] || singlePlayerGames[urlGameId] || towerGames[urlGameId];
            if (gameFromUrl && (gameFromUrl.player1?.id === currentUser.id || gameFromUrl.player2?.id === currentUser.id)) {
                return gameFromUrl;
            }
        }
        return null;
    }, [currentUserWithStatus, liveGames, singlePlayerGames, towerGames, currentUser, currentRoute]);

    const activeNegotiation = useMemo(() => {
        if (!currentUserWithStatus) return null;
        if (!negotiations || typeof negotiations !== 'object' || Array.isArray(negotiations)) {
            return null;
        }
        try {
            const negotiationsArray = Object.values(negotiations);
            // 현재 사용자와 관련된 모든 negotiation 필터링
            const relevantNegotiations = negotiationsArray.filter(neg => 
                neg && neg.challenger && neg.opponent &&
                ((neg.challenger.id === currentUserWithStatus.id && (neg.status === 'pending' || neg.status === 'draft')) ||
                (neg.opponent.id === currentUserWithStatus.id && neg.status === 'pending'))
            );
            
            if (relevantNegotiations.length === 0) return null;
            
            // 가장 먼저 온 신청서 선택 (deadline이 가장 이른 것, 또는 deadline이 같으면 생성 시간 기준)
            // deadline이 없으면 생성 시간(id에 포함된 timestamp 또는 생성 순서) 기준
            const sorted = relevantNegotiations.sort((a, b) => {
                // deadline이 있으면 deadline 기준으로 정렬 (더 이른 deadline이 우선)
                if (a.deadline && b.deadline) {
                    return a.deadline - b.deadline;
                }
                if (a.deadline) return -1; // a에만 deadline이 있으면 a가 우선
                if (b.deadline) return 1; // b에만 deadline이 있으면 b가 우선
                // deadline이 둘 다 없으면 id의 타임스탬프 비교 (나중에 생성된 것이 더 큰 id를 가짐)
                return a.id.localeCompare(b.id);
            });
            
            return sorted[0] || null;
        } catch (error) {
            console.error('[activeNegotiation] Error:', error);
            return null;
        }
    }, [currentUserWithStatus, negotiations]);

    const unreadMailCount = useMemo(() => {
        if (!currentUser || !currentUser.mail || !Array.isArray(currentUser.mail)) {
            return 0;
        }
        return currentUser.mail.filter(m => m && !m.isRead).length;
    }, [currentUser?.mail]);

    const hasClaimableQuest = useMemo(() => {
        if (!currentUser?.quests) return false;
        const { daily, weekly, monthly } = currentUser.quests;
    
        const checkQuestList = (questData?: DailyQuestData | WeeklyQuestData | MonthlyQuestData) => {
            if (!questData) return false;
            return questData.quests.some(q => q.progress >= q.target && !q.isClaimed);
        };
    
        const checkMilestones = (questData?: DailyQuestData | WeeklyQuestData | MonthlyQuestData, thresholds?: number[]) => {
            if (!questData || !thresholds) return false;
            const claimedMilestones =
                Array.isArray(questData.claimedMilestones) && questData.claimedMilestones.length > 0
                    ? questData.claimedMilestones
                    : DEFAULT_CLAIMED_MILESTONES;
            return claimedMilestones.some((claimed, index) => {
                return !claimed && questData.activityProgress >= thresholds[index];
            });
        };
    
        return checkQuestList(daily) ||
               checkQuestList(weekly) ||
               checkQuestList(monthly) ||
               checkMilestones(daily, DAILY_MILESTONE_THRESHOLDS) ||
               checkMilestones(weekly, WEEKLY_MILESTONE_THRESHOLDS) ||
               checkMilestones(monthly, MONTHLY_MILESTONE_THRESHOLDS);
    }, [currentUser?.quests]);

    /** 거래소: 미수령 정산(claimed 아님) 1건 이상 */
    const hasClaimableExchangeSettlement = useMemo(() => {
        const list = currentUser?.exchangeState?.settlements;
        if (!Array.isArray(list)) return false;
        return list.some((entry) => entry && typeof entry === 'object' && (entry as { claimed?: boolean }).claimed !== true);
    }, [currentUser?.exchangeState?.settlements]);

    /** 펫 퀵메뉴: 수련·부화 완료(수령/획득 가능) 시 붉은점 — 진행 타이머가 있을 때만 1초 틱, 완료 후 interval 자동 종료 */
    const [pairPetQuickMenuTick, setPairPetQuickMenuTick] = useState(0);
    useEffect(() => {
        if (!currentUser) return undefined;
        if (!pairPetQuickMenuNeedsSecondTick(currentUser, Date.now())) return undefined;
        const id = window.setInterval(() => {
            const u = currentUserRef.current;
            setPairPetQuickMenuTick((n) => n + 1);
            if (!u || !pairPetQuickMenuNeedsSecondTick(u, Date.now())) {
                window.clearInterval(id);
            }
        }, 1000);
        return () => window.clearInterval(id);
    }, [currentUser]);
    const hasClaimablePairPetTrainingOrHatchery = useMemo(() => {
        if (!currentUser) return false;
        void pairPetQuickMenuTick;
        return hasPairPetClaimReadyForQuickMenu(currentUser, Date.now());
    }, [currentUser, pairPetQuickMenuTick]);
    
    const showError = (message: string) => {
        let displayMessage = message;
        if (message.includes('Invalid move: ko')) {
            displayMessage = tx('game:messages.koShapePlacementHint');
        } else if (message.includes('action point')) {
            displayMessage = tx('game:messages.opponentInsufficientActionPoints');
        }
        setError(displayMessage);
        setTimeout(() => setError(null), 5000);
    };

    const setConnectionNotice = useCallback((next: Omit<AppConnectionStatus, 'updatedAt'>, autoClearMs?: number) => {
        if (connectionNoticeTimerRef.current !== null) {
            window.clearTimeout(connectionNoticeTimerRef.current);
            connectionNoticeTimerRef.current = null;
        }

        if (next.kind !== 'ok') {
            connectionIssueSeenRef.current = true;
        }

        setConnectionStatus({
            ...next,
            updatedAt: Date.now(),
        });

        if (autoClearMs && autoClearMs > 0) {
            connectionNoticeTimerRef.current = window.setTimeout(() => {
                connectionIssueSeenRef.current = false;
                setConnectionStatus({ ...CONNECTION_OK_STATUS, updatedAt: Date.now() });
                connectionNoticeTimerRef.current = null;
            }, autoClearMs);
        }
    }, []);

    const markConnectionRestored = useCallback(() => {
        if (!connectionIssueSeenRef.current) {
            setConnectionStatus(prev => (prev.kind === 'ok' && !prev.message ? prev : { ...CONNECTION_OK_STATUS, updatedAt: Date.now() }));
            return;
        }

        connectionIssueSeenRef.current = false;
        setConnectionNotice(
            {
                kind: 'ok',
                message: tx('common:connection.restored'),
                severity: 'success',
            },
            3000,
        );
    }, [setConnectionNotice]);

    const requestGameRejoinRetry = useCallback((gameId: string) => {
        setGameRejoinFailure(prev => (prev?.gameId === gameId ? null : prev));
        setGameRejoinRetryNonce(n => n + 1);
        setConnectionNotice({
            kind: 'connecting',
            message: tx('common:connection.resyncingGame'),
            severity: 'info',
        });
    }, [setConnectionNotice]);

    const applyRecoveredPveGameToStore = useCallback((game: LiveGameSession) => {
        const bucket = getArenaStoreBucketForSession(game);
        const merge = (prev: Record<string, LiveGameSession>) => {
            const existing = prev[game.id];
            const merged = mergePveRejoinResponseWithExistingBoard(existing, game);
            if (existing === merged) return prev;
            return { ...prev, [game.id]: merged };
        };
        if (bucket === 'singlePlayerGames') {
            setSinglePlayerGames(merge);
        } else if (bucket === 'towerGames') {
            setTowerGames(merge);
        } else {
            setLiveGames(merge);
        }
    }, []);

    const recoverPveGameFromSessionStorage = useCallback(
        (gameId: string): boolean => {
            if (!currentUser?.id || !gameId) return false;
            const shell =
                liveGames[gameId] || singlePlayerGames[gameId] || towerGames[gameId];
            const recovered = loadRecoverablePveGameFromSessionStorage(gameId, {
                shell,
                userId: currentUser.id,
            });
            if (!recovered) return false;
            applyRecoveredPveGameToStore(recovered);
            setGameRejoinFailure((prev) => (prev?.gameId === gameId ? null : prev));
            return true;
        },
        [
            currentUser?.id,
            liveGames,
            singlePlayerGames,
            towerGames,
            applyRecoveredPveGameToStore,
        ],
    );

    useEffect(() => {
        return () => {
            if (connectionNoticeTimerRef.current !== null) {
                window.clearTimeout(connectionNoticeTimerRef.current);
                connectionNoticeTimerRef.current = null;
            }
        };
    }, []);
    
    useEffect(() => {
        if (currentUser) {
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        } else {
            sessionStorage.removeItem('currentUser');
        }
    }, [currentUser]);

    // --- Action Handler ---
    // 액션 디바운싱을 위한 ref
    const actionDebounceRef = useRef<Map<string, number>>(new Map());
    const ACTION_DEBOUNCE_MS = 150;
    
    const shopPurchaseActionTypes = new Set([
        'BUY_SHOP_ITEM',
        'BUY_MATERIAL_BOX',
        'BUY_CONSUMABLE',
        'BUY_TOWER_ITEM',
        'BUY_CASH_PACKAGE',
        'BUY_VIP_PACKAGE',
        'CANCEL_VIP_SHOP_AUTO_RENEW',
        'PURCHASE_ACTION_POINTS',
        'BUY_CHAMPIONSHIP_SHOP_ITEM',
        'BUY_GUILD_SHOP_ITEM',
        'GUILD_BUY_SHOP_ITEM',
        'CLAIM_SHOP_AD_REWARD',
        'PURCHASE_EXCHANGE_LISTING',
    ]);
    
    const handleAction = useCallback(async (action: ServerAction): Promise<{ gameId?: string; claimAllTrainingQuestRewards?: any; clientResponse?: any } | void> => {
        // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
        if (process.env.NODE_ENV === 'development') {
            console.log(`[handleAction] Action received: ${action.type}`, action);
        }
        
        // 디바운싱: 같은 액션이 짧은 시간 내에 여러 번 호출되면 무시
        // - 챔피언싱 시뮬 완료: 5회차 종료 직후 보상 UI·DB 동기화에 필수
        // - GET_GUILD_WAR_DATA / GET_MY_GUILD_WAR_ATTEMPT_LOG: 길드홈과 길드전 화면이 동시에 호출될 수 있음.
        //   디바운스 시 `{ guilds }`만 돌려주면 activeWar 등이 빠져 «전쟁 없음»으로 오인·#/guild 로 튕김 → 디바운스 제외.
        if (
            action.type !== 'COMPLETE_TOURNAMENT_SIMULATION' &&
            action.type !== 'REQUEST_SERVER_AI_MOVE' &&
            action.type !== 'GET_GUILD_WAR_DATA' &&
            action.type !== 'GET_MY_GUILD_WAR_ATTEMPT_LOG' &&
            action.type !== 'GET_CHAMPIONSHIP_VERSUS_VENUE_STATE' &&
            action.type !== 'REFRESH_CHAMPIONSHIP_VERSUS_OPPONENT_LIST' &&
            action.type !== 'REPORT_CHAMPIONSHIP_VERSUS_DUEL_RESULT' &&
            action.type !== 'START_CHAMPIONSHIP_VERSUS_KATA_DUEL' &&
            action.type !== 'COMPLETE_DUNGEON_STAGE' &&
            action.type !== 'CLAIM_TOURNAMENT_REWARD' &&
            action.type !== 'CLAIM_GUILD_WAR_REWARD' &&
            action.type !== 'BUY_CONDITION_POTION' &&
            action.type !== 'USE_CONDITION_POTION' &&
            action.type !== 'PAIR_PET_CLAIM_TRAINING' &&
            action.type !== 'PAIR_PET_START_TRAINING' &&
            action.type !== 'CHESS_MOVE_PIECE' &&
            action.type !== 'START_SINGLE_PLAYER_GAME' &&
            action.type !== 'START_TOWER_GAME' &&
            action.type !== 'CONFIRM_SINGLE_PLAYER_GAME_START' &&
            action.type !== 'CONFIRM_TOWER_GAME_START' &&
            action.type !== 'CONFIRM_AI_GAME_START' &&
            !shopPurchaseActionTypes.has(action.type)
        ) {
            const debouncePayload = 'payload' in action ? (action as { payload?: unknown }).payload : undefined;
            const actionKey = `${action.type}_${JSON.stringify(debouncePayload ?? {})}`;
            const now = Date.now();
            const lastCallTime = actionDebounceRef.current.get(actionKey);
            if (lastCallTime && (now - lastCallTime) < ACTION_DEBOUNCE_MS) {
                if (action.type === 'GET_GUILD_INFO') {
                    const gid = currentUserRef.current?.guildId;
                    if (gid && guilds[gid]) {
                        return { clientResponse: { guild: guilds[gid] } };
                    }
                }
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[handleAction] Action debounced: ${action.type} (${now - lastCallTime}ms since last call)`);
                }
                return;
            }
            actionDebounceRef.current.set(actionKey, now);
        }

        // 베이스 바둑: base_placement에서 PLACE_BASE_STONE은 즉시 화면에 반영되어야 함.
        // 서버 응답/WS 왕복 전까지는 `baseStones_p1/p2`가 갱신되지 않아서 돌이 늦게 보이던 문제가 있음.
        if ((action as any).type === 'CHESS_MOVE_PIECE') {
            const payload = (action as any).payload as {
                gameId?: string;
                pieceId?: string;
                toX?: number;
                toY?: number;
            } | undefined;
            const { gameId, pieceId, toX, toY } = payload || {};
            const uid = currentUserRef.current?.id;
            if (
                gameId &&
                pieceId &&
                uid != null &&
                Number.isFinite(toX) &&
                Number.isFinite(toY)
            ) {
                const chessMoveMutate = (game: LiveGameSession): LiveGameSession | null => {
                    if (game.mode !== GameMode.Chess || game.gameStatus !== 'playing') return null;
                    let myPlayer: Player | null = null;
                    if (isPairClassicGame(game.settings, game.mode)) {
                        const seat = getCurrentPairTurnSeat(game.settings);
                        if (seat?.kind === 'user' && seat.participantId === uid) {
                            myPlayer = seat.player;
                        }
                    } else if (uid === game.blackPlayerId) {
                        myPlayer = Player.Black;
                    } else if (uid === game.whitePlayerId) {
                        myPlayer = Player.White;
                    }
                    if (myPlayer == null || game.currentPlayer !== myPlayer || game.chessPieceMovedThisTurn) {
                        return null;
                    }
                    const copy: LiveGameSession = {
                        ...game,
                        chessPieces: game.chessPieces?.map((p) => ({ ...p })),
                        boardState: game.boardState?.map((row) => [...row]) as LiveGameSession['boardState'],
                    };
                    if (!validateChessMove(copy, pieceId, toX!, toY!, myPlayer).ok) return null;
                    applyChessMoveToSession(copy, pieceId, toX!, toY!, myPlayer);
                    copy.chessPieceMovedThisTurn = true;
                    const captureResult = resolveChessCapturesByLiberty(copy, myPlayer);
                    const normalized = normalizeChessGoSession(copy);
                    if (captureResult.kingCaptured) {
                        return {
                            ...normalized,
                            gameStatus: 'ended' as const,
                            winner: myPlayer,
                            winReason: 'chess_checkmate' as const,
                        };
                    }
                    return normalized;
                };
                setLiveGames((c) => patchLiveGameInMapById(c, gameId, chessMoveMutate));
            }
        }

        if ((action as any).type === 'PLACE_BASE_STONE') {
            const payload = (action as any).payload as { gameId?: string; x?: number; y?: number } | undefined;
            const { gameId, x, y } = payload || {};
            const uid = currentUserRef.current?.id;
            if (gameId && uid != null && typeof x === 'number' && typeof y === 'number') {
                const placeBaseStoneMutate = (game: LiveGameSession): LiveGameSession | null => {
                    if (game.gameStatus !== 'base_placement') return null;

                    const baseStonesTarget = game.settings?.baseStones ?? 4;
                    const pairHostId = (game.settings as { pairGame?: { pairLobbyOwnerId?: string } } | undefined)
                        ?.pairGame?.pairLobbyOwnerId;
                    const n1 = (game as any).baseStones_p1?.length ?? 0;
                    const n2 = (game as any).baseStones_p2?.length ?? 0;
                    const myKey =
                        pairHostId && uid === pairHostId
                            ? n1 < baseStonesTarget
                                ? 'baseStones_p1'
                                : 'baseStones_p2'
                            : uid === game.player1.id
                              ? 'baseStones_p1'
                              : 'baseStones_p2';

                    const myArr = (game as any)[myKey] as Point[] | undefined;
                    const nextArr = Array.isArray(myArr) ? [...myArr] : [];

                    if (nextArr.some((p) => p.x === x && p.y === y)) return null;
                    if (nextArr.length >= baseStonesTarget) return null;
                    const otherKey = myKey === 'baseStones_p1' ? 'baseStones_p2' : 'baseStones_p1';
                    const otherArr = (game as any)[otherKey] as Point[] | undefined;
                    if (Array.isArray(otherArr) && otherArr.some((p) => p.x === x && p.y === y)) return null;

                    nextArr.push({ x, y });
                    const prevReady = ((game as any).basePlacementReady ?? {}) as Record<string, boolean>;
                    const nextReady =
                        pairHostId && uid === pairHostId
                            ? { ...prevReady, [game.player1.id]: false, [game.player2.id]: false }
                            : { ...prevReady, [uid]: false };
                    return {
                        ...game,
                        [myKey]: nextArr,
                        basePlacementReady: nextReady,
                    } as any;
                };
                setLiveGames((c) => patchLiveGameInMapById(c, gameId, placeBaseStoneMutate));
                setSinglePlayerGames((c) => patchLiveGameInMapById(c, gameId, placeBaseStoneMutate));
            }
        }

        if ((action as any).type === 'CONFIRM_BASE_PLACEMENT_COMPLETE') {
            const payload = (action as any).payload as { gameId?: string } | undefined;
            const gameId = payload?.gameId;
            const uid = currentUserRef.current?.id;
            if (gameId && uid != null) {
                const confirmBasePlacementMutate = (game: LiveGameSession): LiveGameSession | null => {
                    if (game.gameStatus !== 'base_placement') return null;
                    const prevReady = ((game as any).basePlacementReady ?? {}) as Record<string, boolean>;
                    const pairHostId = (game.settings as { pairGame?: { pairLobbyOwnerId?: string } } | undefined)
                        ?.pairGame?.pairLobbyOwnerId;
                    const nextReady =
                        pairHostId && uid === pairHostId
                            ? { ...prevReady, [game.player1.id]: true, [game.player2.id]: true }
                            : { ...prevReady, [uid]: true };
                    return { ...game, basePlacementReady: nextReady } as any;
                };
                setLiveGames((c) => patchLiveGameInMapById(c, gameId, confirmBasePlacementMutate));
                setSinglePlayerGames((c) => patchLiveGameInMapById(c, gameId, confirmBasePlacementMutate));
            }
        }

        // PVP·공통: 선호 돌 선택은 WS 왕복 전에 본인 칸만 낙관 반영 (싱글과 동일한 즉시성)
        if ((action as any).type === 'SUBMIT_BASE_STONE_COLOR_CHOICE') {
            const payload = (action as any).payload as { gameId?: string; color?: Player; choiceForUserId?: string } | undefined;
            const gameId = payload?.gameId;
            const color = payload?.color;
            const uid = currentUserRef.current?.id;
            const choiceFor = typeof payload?.choiceForUserId === 'string' ? payload.choiceForUserId : undefined;
            if (gameId && uid != null && (color === Player.Black || color === Player.White)) {
                const submitColorMutate = (game: LiveGameSession): LiveGameSession | null => {
                    if (game.gameStatus !== 'base_stone_color_choice') return null;
                    const pairHostId = (game.settings as { pairGame?: { pairLobbyOwnerId?: string } } | undefined)?.pairGame
                        ?.pairLobbyOwnerId;
                    const subjectId =
                        pairHostId === uid && choiceFor && (choiceFor === game.player1.id || choiceFor === game.player2.id)
                            ? choiceFor
                            : uid;
                    if (pairHostId === uid && choiceFor && choiceFor !== uid && subjectId !== choiceFor) return null;
                    if (!(pairHostId === uid && choiceFor) && choiceFor && choiceFor !== uid) return null;
                    const prev = { ...(game.baseStoneColorChoices ?? {}) } as Record<string, Player | null>;
                    if (prev[subjectId] != null) return null;
                    prev[subjectId] = color;
                    return { ...game, baseStoneColorChoices: prev } as any;
                };
                setLiveGames((c) => patchLiveGameInMapById(c, gameId, submitColorMutate));
                setSinglePlayerGames((c) => patchLiveGameInMapById(c, gameId, submitColorMutate));
            }
        }

        if ((action as any).type === 'UPDATE_KOMI_BID') {
            const payload = (action as any).payload as {
                gameId?: string;
                bid?: { color: Player; komi: number };
                bidForUserId?: string;
            } | undefined;
            const gameId = payload?.gameId;
            const bid = payload?.bid;
            const uid = currentUserRef.current?.id;
            const bidFor = typeof payload?.bidForUserId === 'string' ? payload.bidForUserId : undefined;
            if (gameId && uid != null && bid && (bid.color === Player.Black || bid.color === Player.White)) {
                const updateKomiMutate = (game: LiveGameSession): LiveGameSession | null => {
                    if (game.gameStatus !== 'base_same_color_points_bid') {
                        return null;
                    }
                    const pairHostId = (game.settings as { pairGame?: { pairLobbyOwnerId?: string } } | undefined)?.pairGame
                        ?.pairLobbyOwnerId;
                    const subjectId =
                        pairHostId === uid && bidFor && (bidFor === game.player1.id || bidFor === game.player2.id)
                            ? bidFor
                            : uid;
                    if (pairHostId === uid && bidFor && bidFor !== uid && subjectId !== bidFor) return null;
                    if (!(pairHostId === uid && bidFor) && bidFor && bidFor !== uid) return null;
                    const prevBids = { ...(game.komiBids ?? {}) } as Record<string, { color: Player; komi: number } | null>;
                    if (prevBids[subjectId] != null) return null;
                    const k = Math.floor(Number(bid.komi));
                    const locked = game.baseSameColorTieColor;
                    if (locked !== Player.Black && locked !== Player.White) return null;
                    prevBids[subjectId] = { color: locked, komi: Number.isFinite(k) ? Math.max(0, Math.min(100, k)) : 0 };
                    return { ...game, komiBids: prevBids } as any;
                };
                setLiveGames((c) => patchLiveGameInMapById(c, gameId, updateKomiMutate));
                setSinglePlayerGames((c) => patchLiveGameInMapById(c, gameId, updateKomiMutate));
            }
        }

        if ((action as any).type === 'RESET_MY_BASE_STONE_PLACEMENTS') {
            const payload = (action as any).payload as { gameId?: string } | undefined;
            const gameId = payload?.gameId;
            const uid = currentUserRef.current?.id;
            if (gameId && uid != null) {
                const resetBaseMutate = (game: LiveGameSession): LiveGameSession | null => {
                    if (game.gameStatus !== 'base_placement') return null;
                    const pairHostId = (game.settings as { pairGame?: { pairLobbyOwnerId?: string } } | undefined)
                        ?.pairGame?.pairLobbyOwnerId;
                    const n2 = ((game as any).baseStones_p2 as Point[] | undefined)?.length ?? 0;
                    const myKey =
                        pairHostId && uid === pairHostId
                            ? n2 > 0
                                ? 'baseStones_p2'
                                : 'baseStones_p1'
                            : uid === game.player1.id
                              ? 'baseStones_p1'
                              : 'baseStones_p2';
                    const prevReady = ((game as any).basePlacementReady ?? {}) as Record<string, boolean>;
                    const nextReady =
                        pairHostId && uid === pairHostId
                            ? { ...prevReady, [game.player1.id]: false, [game.player2.id]: false }
                            : { ...prevReady, [uid]: false };
                    return {
                        ...game,
                        [myKey]: [],
                        basePlacementReady: nextReady,
                    } as any;
                };
                setLiveGames((c) => patchLiveGameInMapById(c, gameId, resetBaseMutate));
                setSinglePlayerGames((c) => patchLiveGameInMapById(c, gameId, resetBaseMutate));
            }
        }

        if ((action as any).type === 'UNDO_LAST_BASE_STONE_PLACEMENT') {
            const payload = (action as any).payload as { gameId?: string } | undefined;
            const gameId = payload?.gameId;
            const uid = currentUserRef.current?.id;
            if (gameId && uid != null) {
                const undoBaseMutate = (game: LiveGameSession): LiveGameSession | null => {
                    if (game.gameStatus !== 'base_placement') return null;
                    const pairHostId = (game.settings as { pairGame?: { pairLobbyOwnerId?: string } } | undefined)
                        ?.pairGame?.pairLobbyOwnerId;
                    const n2 = ((game as any).baseStones_p2 as Point[] | undefined)?.length ?? 0;
                    const myKey =
                        pairHostId && uid === pairHostId
                            ? n2 > 0
                                ? 'baseStones_p2'
                                : 'baseStones_p1'
                            : uid === game.player1.id
                              ? 'baseStones_p1'
                              : 'baseStones_p2';
                    const myArr = ((game as any)[myKey] as Point[] | undefined) ?? [];
                    if (myArr.length === 0) return null;
                    const prevReady = ((game as any).basePlacementReady ?? {}) as Record<string, boolean>;
                    const nextReadyUndo =
                        pairHostId && uid === pairHostId
                            ? { ...prevReady, [game.player1.id]: false, [game.player2.id]: false }
                            : { ...prevReady, [uid]: false };
                    return {
                        ...game,
                        [myKey]: myArr.slice(0, -1),
                        basePlacementReady: nextReadyUndo,
                    } as any;
                };
                setLiveGames((c) => patchLiveGameInMapById(c, gameId, undoBaseMutate));
                setSinglePlayerGames((c) => patchLiveGameInMapById(c, gameId, undoBaseMutate));
            }
        }

        if ((action as any).type === 'PLACE_REMAINING_BASE_STONES_RANDOMLY') {
            const payload = (action as any).payload as { gameId?: string } | undefined;
            const gameId = payload?.gameId;
            const uid = currentUserRef.current?.id;
            if (gameId && uid != null) {
                const randomRemainingMutate = (game: LiveGameSession): LiveGameSession | null => {
                    if (game.gameStatus !== 'base_placement') return null;
                    const prevReady = ((game as any).basePlacementReady ?? {}) as Record<string, boolean>;
                    const pairHostId = (game.settings as { pairGame?: { pairLobbyOwnerId?: string } } | undefined)
                        ?.pairGame?.pairLobbyOwnerId;
                    const nextReadyRand =
                        pairHostId && uid === pairHostId
                            ? { ...prevReady, [game.player1.id]: false, [game.player2.id]: false }
                            : { ...prevReady, [uid]: false };
                    return { ...game, basePlacementReady: nextReadyRand } as any;
                };
                setLiveGames((c) => patchLiveGameInMapById(c, gameId, randomRemainingMutate));
                setSinglePlayerGames((c) => patchLiveGameInMapById(c, gameId, randomRemainingMutate));
            }
        }
        
        // 싱글플레이 미사일 애니메이션 완료 클라이언트 처리 (도전의 탑은 towerGames, 그 외 싱글은 singlePlayerGames)
        if ((action as any).type === 'SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE') {
            const payload = (action as any).payload;
            const { gameId } = payload;
            // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
            if (process.env.NODE_ENV === 'development') {
                console.log(`[handleAction] SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE - processing client-side:`, { gameId });
            }
            // NOTE:
            // handleAction의 useCallback 의존성이 최소화되어 있어(singlePlayerGames/towerGames 미포함)
            // 여기서 외부 클로저의 게임 맵을 참조하면 stale 상태로 게임을 못 찾을 수 있다.
            // 각 스토어의 최신 currentGames를 기준으로 직접 갱신하여 멈춤 상태를 방지한다.
            const applyMissileAnimationCompletion = (currentGames: Record<string, LiveGameSession>) => {
                const gameInStore = currentGames[gameId];
                if (!gameInStore) return currentGames;
                const g = gameInStore;
                const isTerminalStatus =
                    g.gameStatus === 'ended' || g.gameStatus === 'no_contest' || g.gameStatus === 'scoring';
                
                // 애니메이션이 없거나 이미 완료된 경우
                if (!g.animation || (g.animation.type !== 'missile' && g.animation.type !== 'hidden_missile')) {
                    // 게임 상태가 여전히 missile_animating이면 정리
                    if (g.gameStatus === 'missile_animating') {
                        // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
                        if (process.env.NODE_ENV === 'development') {
                            console.log(`[handleAction] SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE - Cleaning up stuck missile_animating state:`, gameId);
                        }
                        return {
                            ...currentGames,
                            [gameId]: {
                                ...g,
                                gameStatus: 'playing',
                                animation: null,
                                pausedTurnTimeLeft: undefined,
                                itemUseDeadline: undefined
                            }
                        };
                    }
                    return currentGames;
                }
                
                // 애니메이션 정보 저장
                const animationFrom = g.animation.from;
                const animationTo = g.animation.to;
                const animPlayer = (g.animation as { player?: Player }).player;
                const playerWhoMoved =
                    animPlayer === Player.Black || animPlayer === Player.White ? animPlayer : g.currentPlayer;
                const revealedHiddenStone = (g.animation as any).revealedHiddenStone as Point | null | undefined;
                
                // totalTurns와 captures 보존 (애니메이션 완료 시 초기화 방지)
                const preservedTotalTurns = g.totalTurns;
                const preservedCaptures = { ...g.captures };
                const preservedBaseStoneCaptures = g.baseStoneCaptures ? { ...g.baseStoneCaptures } : undefined;
                const preservedHiddenStoneCaptures = g.hiddenStoneCaptures ? { ...g.hiddenStoneCaptures } : undefined;
                
                // 게임 상태 업데이트
                // 타이머 복원: pausedTurnTimeLeft가 있으면 복원
                let updatedBlackTime = g.blackTimeLeft;
                let updatedWhiteTime = g.whiteTimeLeft;
                
                if (g.pausedTurnTimeLeft !== undefined) {
                    if (playerWhoMoved === Player.Black) {
                        updatedBlackTime = g.pausedTurnTimeLeft;
                    } else {
                        updatedWhiteTime = g.pausedTurnTimeLeft;
                    }
                }
                
                const updatedGame: LiveGameSession = {
                    ...g,
                    animation: null,
                    // 종료 직전 레이스에서도 미사일 보드 정합 처리는 유지하되, 종료 상태는 보존한다.
                    gameStatus: isTerminalStatus ? g.gameStatus : 'playing',
                    blackTimeLeft: updatedBlackTime,
                    whiteTimeLeft: updatedWhiteTime,
                    pausedTurnTimeLeft: undefined,
                    itemUseDeadline: undefined,
                    // 타이머 재개를 위해 turnDeadline과 turnStartTime도 설정 (제한시간 없음+초읽기 모드 포함)
                    turnDeadline: (() => {
                        const hasTC = (g.settings.timeLimit ?? 0) > 0 || ((g.settings.byoyomiCount ?? 0) > 0 && (g.settings.byoyomiTime ?? 0) > 0);
                        return hasTC && (updatedBlackTime > 0 || updatedWhiteTime > 0)
                            ? Date.now() + (playerWhoMoved === Player.Black ? updatedBlackTime : updatedWhiteTime) * 1000
                            : undefined;
                    })(),
                    turnStartTime: (() => {
                        const hasTC = (g.settings.timeLimit ?? 0) > 0 || ((g.settings.byoyomiCount ?? 0) > 0 && (g.settings.byoyomiTime ?? 0) > 0);
                        return hasTC ? Date.now() : undefined;
                    })(),
                    // totalTurns와 captures 보존
                    totalTurns: preservedTotalTurns,
                    captures: preservedCaptures,
                    ...(preservedBaseStoneCaptures ? { baseStoneCaptures: preservedBaseStoneCaptures } : {}),
                    ...(preservedHiddenStoneCaptures ? { hiddenStoneCaptures: preservedHiddenStoneCaptures } : {})
                };
                
                // 히든 돌 공개 처리
                if (revealedHiddenStone) {
                    const moveIndex = g.moveHistory.findIndex(m => m.x === revealedHiddenStone.x && m.y === revealedHiddenStone.y);
                    if (moveIndex !== -1) {
                        if (!updatedGame.permanentlyRevealedStones) updatedGame.permanentlyRevealedStones = [];
                        if (!updatedGame.permanentlyRevealedStones.some(p => p.x === revealedHiddenStone.x && p.y === revealedHiddenStone.y)) {
                            updatedGame.permanentlyRevealedStones.push({ x: revealedHiddenStone.x, y: revealedHiddenStone.y });
                        }
                    }
                }
                
                // 싱글플레이에서는 LAUNCH_MISSILE에서 이미 보드 상태가 업데이트되었으므로
                // 애니메이션 완료 시에는 보드 상태를 변경하지 않고 그대로 유지
                // (서버에서 이미 원래 자리 제거, 목적지 배치가 완료됨)
                // 단, 보드 상태가 제대로 동기화되지 않은 경우를 대비해 확인만 수행
                // 새로고침 직후 등 boardState가 아직 없을 수 있음 → 옵셔널 체이닝 및 배열 검사
                const boardState = g.boardState;
                if (animationFrom && animationTo && Array.isArray(boardState)) {
                    const stoneAtTo = boardState[animationTo.y]?.[animationTo.x];
                    const stoneAtFrom = boardState[animationFrom.y]?.[animationFrom.x];
                    
                    // 목적지에 돌이 없으면 배치 (서버 동기화 문제 대비)
                    if (stoneAtTo !== playerWhoMoved) {
                        console.warn(`[handleAction] SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE - Stone not at destination, fixing:`, {
                            gameId,
                            from: animationFrom,
                            to: animationTo,
                            stoneAtTo,
                            playerWhoMoved
                        });
                        const newBoardState = boardState.map((row, y) => 
                            row.map((cell, x) => {
                                if (x === animationTo.x && y === animationTo.y) {
                                    return playerWhoMoved;
                                }
                                if (x === animationFrom.x && y === animationFrom.y && cell === playerWhoMoved) {
                                    return Player.None;
                                }
                                return cell;
                            })
                        );
                        updatedGame.boardState = newBoardState;
                    } else if (stoneAtFrom === playerWhoMoved) {
                        // 원래 자리에 아직 돌이 있으면 제거 (서버 동기화 문제 대비)
                        console.warn(`[handleAction] SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE - Stone still at origin, removing:`, {
                            gameId,
                            from: animationFrom,
                            to: animationTo
                        });
                        const newBoardState = boardState.map((row, y) => 
                            row.map((cell, x) => 
                                (x === animationFrom.x && y === animationFrom.y && cell === playerWhoMoved) ? Player.None : cell
                            )
                        );
                        updatedGame.boardState = newBoardState;
                    }
                    
                    // 배치돌 업데이트: 원래 자리의 배치돌을 목적지로 이동 (이미 서버에서 처리되었을 수 있음)
                    if (g.baseStones) {
                        const baseStoneIndex = g.baseStones.findIndex(bs => bs.x === animationFrom.x && bs.y === animationFrom.y);
                        if (baseStoneIndex !== -1) {
                            updatedGame.baseStones = [...g.baseStones];
                            const originalBaseStone = g.baseStones[baseStoneIndex];
                            updatedGame.baseStones[baseStoneIndex] = { x: animationTo.x, y: animationTo.y, player: originalBaseStone.player };
                        }
                    }
                    
                    // 싱글플레이에서 baseStones_p1, baseStones_p2도 확인
                    const playerId = playerWhoMoved === Player.Black ? g.blackPlayerId! : g.whitePlayerId!;
                    const baseStonesKey = playerId === g.player1.id ? 'baseStones_p1' : 'baseStones_p2';
                    const baseStonesArray = (g as any)[baseStonesKey] as Point[] | undefined;
                    if (baseStonesArray) {
                        const baseStoneIndex = baseStonesArray.findIndex(bs => bs.x === animationFrom.x && bs.y === animationFrom.y);
                        if (baseStoneIndex !== -1) {
                            (updatedGame as any)[baseStonesKey] = [...baseStonesArray];
                            (updatedGame as any)[baseStonesKey][baseStoneIndex] = { x: animationTo.x, y: animationTo.y };
                        }
                    }
                    
                    // 미사일 이동은 착수가 아니므로 moveHistory를 목적지로 치환하지 않는다.
                    // (서버와 동일하게 실제 클릭 수순을 보존)
                    
                    // 문양 돌 이동: 소모된 교차점(consumedPatternIntersections)에는 문양을 다시 두지 않는다.
                    const consumedPatternIntersections =
                        (updatedGame as any).consumedPatternIntersections ??
                        (g as any).consumedPatternIntersections ??
                        [];
                    const isConsumedPatternIntersection = (pt: Point) =>
                        Array.isArray(consumedPatternIntersections) &&
                        consumedPatternIntersections.some((p: Point) => p.x === pt.x && p.y === pt.y);
                    if (g.blackPatternStones?.some(p => p.x === animationFrom.x && p.y === animationFrom.y)) {
                        updatedGame.blackPatternStones = (updatedGame.blackPatternStones ?? g.blackPatternStones ?? [])
                            .map(p => (p.x === animationFrom.x && p.y === animationFrom.y ? { x: animationTo.x, y: animationTo.y } : p))
                            .filter(p => !isConsumedPatternIntersection(p));
                    }
                    if (g.whitePatternStones?.some(p => p.x === animationFrom.x && p.y === animationFrom.y)) {
                        updatedGame.whitePatternStones = (updatedGame.whitePatternStones ?? g.whitePatternStones ?? [])
                            .map(p => (p.x === animationFrom.x && p.y === animationFrom.y ? { x: animationTo.x, y: animationTo.y } : p))
                            .filter(p => !isConsumedPatternIntersection(p));
                    }
                    // 공개된 히든 돌: 원래 자리가 공개 목록에 있으면 목적지에서도 공개 상태 유지
                    if (g.permanentlyRevealedStones?.some(p => p.x === animationFrom.x && p.y === animationFrom.y)) {
                        updatedGame.permanentlyRevealedStones = (updatedGame.permanentlyRevealedStones ?? g.permanentlyRevealedStones ?? []).map(p =>
                            p.x === animationFrom.x && p.y === animationFrom.y ? { x: animationTo.x, y: animationTo.y } : p
                        );
                    }

                    // 미사일 착지 따내기: LAUNCH에서 이미 반영됐으면 생략(중복 점수 방지)
                    const missileCapturesAlreadyApplied = !!(g.animation as { capturesAppliedAtLaunch?: boolean })
                        ?.capturesAppliedAtLaunch;
                    const workingBoard = updatedGame.boardState ?? boardState;
                    if (!missileCapturesAlreadyApplied && Array.isArray(workingBoard) && workingBoard.length > 0) {
                        const opponentEnum =
                            playerWhoMoved === Player.Black ? Player.White : Player.Black;
                        const boardForCapture = workingBoard.map((row: Player[]) => [...row]);
                        if (boardForCapture[animationTo.y]?.[animationTo.x] === playerWhoMoved) {
                            boardForCapture[animationTo.y][animationTo.x] = Player.None;
                            const moveHistLen = (updatedGame.moveHistory ?? g.moveHistory)?.length ?? 0;
                            const ko = updatedGame.koInfo ?? g.koInfo ?? null;
                            const captureResult = processMoveClient(
                                boardForCapture,
                                { x: animationTo.x, y: animationTo.y, player: playerWhoMoved },
                                ko,
                                moveHistLen,
                                getSessionArenaKind(g) === 'singleplayer'
                                    ? { isSinglePlayer: true, opponentPlayer: opponentEnum }
                                    : { opponentPlayer: opponentEnum }
                            );
                            applyMissileCaptureProcessResult(
                                updatedGame,
                                playerWhoMoved,
                                opponentEnum,
                                captureResult
                            );
                        }
                    }
                }
                
                // sessionStorage에 저장 (restoredBoardState가 최신 상태를 읽을 수 있도록)
                // 새로고침 직후 등 boardState가 없으면 저장하지 않음 — 기존 저장된 보드를 덮어쓰지 않아 흰돌/돌 사라짐 방지
                const boardToSave = updatedGame.boardState ?? g.boardState;
                if (Array.isArray(boardToSave) && boardToSave.length > 0) {
                    try {
                        const GAME_STATE_STORAGE_KEY = `gameState_${gameId}`;
                        const gameStateToSave = {
                            gameId,
                            boardState: boardToSave,
                            moveHistory: updatedGame.moveHistory ?? g.moveHistory ?? [],
                            captures: updatedGame.captures || { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
                            baseStoneCaptures: updatedGame.baseStoneCaptures,
                            hiddenStoneCaptures: updatedGame.hiddenStoneCaptures,
                            permanentlyRevealedStones: updatedGame.permanentlyRevealedStones || [],
                            blackPatternStones: updatedGame.blackPatternStones,
                            whitePatternStones: updatedGame.whitePatternStones,
                            consumedPatternIntersections: (updatedGame as any).consumedPatternIntersections,
                            hiddenMoves: updatedGame.hiddenMoves || {},
                            hidden_stones_p1: (updatedGame as any).hidden_stones_p1,
                            hidden_stones_p2: (updatedGame as any).hidden_stones_p2,
                            totalTurns: updatedGame.totalTurns,
                            timestamp: Date.now()
                        };
                        sessionStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(gameStateToSave));
                        if (process.env.NODE_ENV === 'development') {
                            console.log(`[handleAction] SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE - Saved game state to sessionStorage for game ${gameId}`);
                        }
                    } catch (e) {
                        console.error(`[handleAction] SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE - Failed to save game state to sessionStorage:`, e);
                    }
                }
                
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[handleAction] SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE - Updated game state:`, {
                        gameId,
                        gameStatus: updatedGame.gameStatus,
                        animation: updatedGame.animation,
                        moveHistoryLength: updatedGame.moveHistory?.length,
                        totalTurns: updatedGame.totalTurns,
                        captures: updatedGame.captures
                    });
                }
                
                // 새로고침 직후 등 moveHistory/boardState/턴 정보가 없을 수 있음 — 반환 객체는 기존 game 값 보존
                const safeGame: LiveGameSession = {
                    ...updatedGame,
                    moveHistory: updatedGame.moveHistory ?? g.moveHistory ?? [],
                    boardState: updatedGame.boardState ?? g.boardState,
                    currentPlayer: updatedGame.currentPlayer ?? g.currentPlayer,
                    totalTurns: updatedGame.totalTurns ?? g.totalTurns,
                    captures: updatedGame.captures ?? g.captures,
                    lastMove: updatedGame.lastMove ?? g.lastMove,
                    blackTimeLeft: updatedGame.blackTimeLeft ?? g.blackTimeLeft,
                    whiteTimeLeft: updatedGame.whiteTimeLeft ?? g.whiteTimeLeft,
                    turnDeadline: updatedGame.turnDeadline ?? g.turnDeadline,
                    turnStartTime: updatedGame.turnStartTime ?? g.turnStartTime,
                };
                return {
                    ...currentGames,
                    [gameId]: safeGame
                };
            };
            setSinglePlayerGames(applyMissileAnimationCompletion);
            setTowerGames(applyMissileAnimationCompletion);

            // LAUNCH는 서버 처리, 애니 완료는 클라만 반영되면 서버가 missile_animating에 남아
            // REQUEST_SERVER_AI_MOVE·상태 동기화가 반복된다(탑·바둑학원 공통).
            const isTowerMissileGame = Boolean(towerGamesRef.current[gameId]);
            const isSinglePlayerMissileGame = Boolean(singlePlayerGamesRef.current[gameId]);
            const uid = currentUserRef.current?.id;
            if ((isTowerMissileGame || isSinglePlayerMissileGame) && uid) {
                void (async () => {
                    try {
                        const res = await fetch(getApiUrl('/api/action'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                                type: 'MISSILE_ANIMATION_COMPLETE',
                                payload: { gameId },
                                userId: uid,
                            }),
                        });
                        if (!res.ok) return;
                        const result = await res.json();
                        const serverGame =
                            (result?.game as LiveGameSession | undefined) ??
                            (result?.clientResponse?.game as LiveGameSession | undefined);
                        if (!serverGame?.id) return;
                        const mergeServerMissileComplete = (
                            currentGames: Record<string, LiveGameSession>,
                        ) => {
                            const prev = currentGames[gameId];
                            if (!prev) return currentGames;
                            return {
                                ...currentGames,
                                [gameId]: mergeGameWithMonotonicCounters(prev, serverGame, gameId),
                            };
                        };
                        if (isTowerMissileGame) {
                            setTowerGames(mergeServerMissileComplete);
                        }
                        if (isSinglePlayerMissileGame) {
                            setSinglePlayerGames(mergeServerMissileComplete);
                        }
                    } catch (e) {
                        if (process.env.NODE_ENV === 'development') {
                            console.warn(
                                '[handleAction] MISSILE_ANIMATION_COMPLETE server sync failed:',
                                e,
                            );
                        }
                    }
                })();
            }

            return;
        }
        
        // 전략바둑 AI 게임: 유저 수를 클라이언트에 먼저 표시(낙관적 반영) 후 서버 전송은 아래 PLACE_STONE으로 처리
        if ((action as any).type === 'AI_GAME_CLIENT_MOVE') {
            const payload = (action as any).payload;
            const { gameId, x, y, newBoardState, capturedStones, newKoInfo, movePlayer: payloadMovePlayer } = payload;
            setLiveGames((currentGames) => {
                const game = currentGames[gameId];
                if (!game || game.gameStatus === 'ended' || game.gameStatus === 'no_contest' || game.gameStatus === 'scoring') return currentGames;

                if (!game.isAiGame && !isSessionSingleOrTower(game)) {
                    pvpPlaceStoneRevertRef.current[gameId] = JSON.parse(JSON.stringify(game)) as LiveGameSession;
                } else if (game.mode === GameMode.Chess) {
                    pvpPlaceStoneRevertRef.current[gameId] = JSON.parse(JSON.stringify(game)) as LiveGameSession;
                }

                const movePlayer: Player = (payloadMovePlayer ?? game.currentPlayer) as Player;
                const capturedStones = (payload.capturedStones ?? []) as Array<{ x: number; y: number }>;
                const moveHistory = [...(game.moveHistory || []), { x, y, player: movePlayer }];
                const opponentPlayer =
                    movePlayer === Player.Black ? Player.White : Player.Black;

                if (
                    game.mode !== GameMode.Chess &&
                    game.mode !== GameMode.Castle &&
                    capturedStones.length > 0
                ) {
                    const revealPatch = tryBuildHiddenCaptureRevealState(game, {
                        x,
                        y,
                        movePlayer,
                        newBoardState,
                        capturedStones,
                        moveHistory,
                        hiddenMoves: game.hiddenMoves,
                    });
                    if (revealPatch) {
                        return {
                            ...currentGames,
                            [gameId]: {
                                ...game,
                                ...revealPatch,
                                koInfo: newKoInfo ?? game.koInfo,
                                lastMove: { x, y },
                                moveHistory,
                                hiddenMoves: game.hiddenMoves,
                            },
                        };
                    }
                }

                const weighted =
                    game.mode === GameMode.Chess && capturedStones.length > 0
                        ? (() => {
                              let totalPoints = 0;
                              const entries = capturedStones.map((stone) => {
                                  const capturePoints = getChessGoStoneCapturePointValue(game, stone);
                                  totalPoints += capturePoints;
                                  return {
                                      point: stone,
                                      player: opponentPlayer,
                                      wasHidden: false,
                                      capturePoints,
                                  };
                              });
                              return { totalPoints, entries };
                          })()
                        : buildWeightedJustCapturedForStones(game, capturedStones || [], movePlayer);
                const newCaptures = {
                    ...game.captures,
                    [movePlayer]: (game.captures[movePlayer] || 0) + weighted.totalPoints,
                };

                const updatedGame: LiveGameSession = {
                    ...game,
                    boardState: newBoardState,
                    koInfo: newKoInfo ?? game.koInfo,
                    lastMove: { x, y },
                    moveHistory,
                    captures: newCaptures,
                    justCaptured: weighted.entries,
                    currentPlayer: movePlayer === Player.Black ? Player.White : Player.Black,
                    hiddenMoves: game.hiddenMoves,
                    gameStatus: 'playing',
                    itemUseDeadline: undefined,
                    pausedTurnTimeLeft: undefined,
                };
                if (game.mode === GameMode.Chess) {
                    updatedGame.chessPieceMovedThisTurn = false;
                    commitChessGoPlacementCaptures(updatedGame, x, y, capturedStones);
                    if (capturedStones.length > 0) {
                        const chessCapture = applyChessCaptureScoreForRemovedStones(
                            updatedGame,
                            capturedStones,
                            movePlayer,
                        );
                        if (chessCapture.kingCaptured) {
                            updatedGame.gameStatus = 'ended';
                            updatedGame.winner = movePlayer;
                            updatedGame.winReason = 'chess_checkmate';
                            updatedGame.currentPlayer = Player.None;
                        }
                    }
                    const normalized = normalizeChessGoSession(updatedGame);
                    return { ...currentGames, [gameId]: normalized };
                }
                if (game.mode === GameMode.Castle) {
                    updatedGame.confirmedTerritoryOwnerByPoint = detectAndConfirmTerritories(
                        updatedGame,
                        newBoardState,
                    );
                    if (capturedStones.length > 0) {
                        updatedGame.gameStatus = 'ended';
                        updatedGame.winner = movePlayer;
                        updatedGame.winReason = 'castle_capture';
                        updatedGame.currentPlayer = Player.None;
                    }
                }
                return { ...currentGames, [gameId]: updatedGame };
            });
            return;
        }

        if ((action as any).type === 'PAIR_GAME_CLIENT_MOVE') {
            const payload = (action as any).payload;
            const { gameId, x, y, newBoardState, capturedStones, newKoInfo, movePlayer: payloadMovePlayer } = payload;
            setLiveGames((currentGames) => {
                const game = currentGames[gameId];
                if (!game || game.gameStatus === 'ended' || game.gameStatus === 'no_contest' || game.gameStatus === 'scoring') return currentGames;
                const pg = game.settings?.pairGame;
                if (!pg?.turnOrder?.length) return currentGames;

                pvpPlaceStoneRevertRef.current[gameId] = JSON.parse(JSON.stringify(game)) as LiveGameSession;

                const movePlayer: Player = (payloadMovePlayer ?? game.currentPlayer) as Player;
                const pairSeat = getCurrentPairTurnSeat(game.settings);
                const moveEntry = {
                    x,
                    y,
                    player: movePlayer,
                    ...(pairSeat ? { actorId: pairSeat.participantId, pairSeatId: pairSeat.seatId } : {}),
                };
                const moveHistory = [...(game.moveHistory || []), moveEntry];

                if (
                    game.mode !== GameMode.Chess &&
                    game.mode !== GameMode.Castle &&
                    capturedStones.length > 0
                ) {
                    const revealPatch = tryBuildHiddenCaptureRevealState(game, {
                        x,
                        y,
                        movePlayer,
                        newBoardState,
                        capturedStones,
                        moveHistory,
                        hiddenMoves: game.hiddenMoves,
                    });
                    if (revealPatch) {
                        return {
                            ...currentGames,
                            [gameId]: {
                                ...game,
                                ...revealPatch,
                                koInfo: newKoInfo ?? game.koInfo,
                                lastMove: { x, y },
                                moveHistory,
                                hiddenMoves: game.hiddenMoves,
                            },
                        };
                    }
                }

                const opponentPlayer =
                    movePlayer === Player.Black ? Player.White : Player.Black;
                const weighted =
                    game.mode === GameMode.Chess && capturedStones.length > 0
                        ? (() => {
                              let totalPoints = 0;
                              const entries = capturedStones.map((stone: { x: number; y: number }) => {
                                  const capturePoints = getChessGoStoneCapturePointValue(game, stone);
                                  totalPoints += capturePoints;
                                  return {
                                      point: stone,
                                      player: opponentPlayer,
                                      wasHidden: false,
                                      capturePoints,
                                  };
                              });
                              return { totalPoints, entries };
                          })()
                        : buildWeightedJustCapturedForStones(game, capturedStones || [], movePlayer);
                const newCaptures = {
                    ...game.captures,
                    [movePlayer]: (game.captures[movePlayer] || 0) + weighted.totalPoints,
                };

                const settingsWithPair = {
                    ...game.settings,
                    pairGame: {
                        ...pg,
                        turnOrder: pg.turnOrder.map((s) => ({ ...s })),
                        passSeatIds: [...(pg.passSeatIds ?? [])],
                        orderRevealConfirmed: pg.orderRevealConfirmed ? { ...pg.orderRevealConfirmed } : undefined,
                        currentTurnIndex: pg.currentTurnIndex,
                    },
                };
                resetPairPasses(settingsWithPair);
                advancePairTurn(settingsWithPair);
                const nextSeat = getCurrentPairTurnSeat(settingsWithPair);
                const nextCurrentPlayer =
                    nextSeat?.player ?? (movePlayer === Player.Black ? Player.White : Player.Black);

                const updatedGame: LiveGameSession = {
                    ...game,
                    settings: settingsWithPair,
                    boardState: newBoardState,
                    koInfo: newKoInfo ?? game.koInfo,
                    lastMove: { x, y },
                    moveHistory,
                    captures: newCaptures,
                    justCaptured: weighted.entries,
                    currentPlayer: nextCurrentPlayer,
                    hiddenMoves: game.hiddenMoves,
                    gameStatus: 'playing',
                    itemUseDeadline: undefined,
                    pausedTurnTimeLeft: undefined,
                };
                if (game.mode === GameMode.Chess) {
                    updatedGame.chessPieceMovedThisTurn = false;
                    commitChessGoPlacementCaptures(updatedGame, x, y, capturedStones);
                    if (capturedStones.length > 0) {
                        const chessCapture = applyChessCaptureScoreForRemovedStones(
                            updatedGame,
                            capturedStones,
                            movePlayer,
                        );
                        if (chessCapture.kingCaptured) {
                            updatedGame.gameStatus = 'ended';
                            updatedGame.winner = movePlayer;
                            updatedGame.winReason = 'chess_checkmate';
                            updatedGame.currentPlayer = Player.None;
                        }
                    }
                    const normalized = normalizeChessGoSession(updatedGame);
                    return { ...currentGames, [gameId]: normalized };
                }
                if (game.mode === GameMode.Castle) {
                    updatedGame.confirmedTerritoryOwnerByPoint = detectAndConfirmTerritories(
                        updatedGame,
                        newBoardState,
                    );
                    if (capturedStones.length > 0) {
                        updatedGame.gameStatus = 'ended';
                        updatedGame.winner = movePlayer;
                        updatedGame.winReason = 'castle_capture';
                        updatedGame.currentPlayer = Player.None;
                    }
                }
                return { ...currentGames, [gameId]: updatedGame };
            });
            return;
        }

        if ((action as any).type === 'LOCAL_HIDDEN_REVEAL_TRIGGER') {
            const { gameId, gameType, point, player, keepTurn } = (action as any).payload as {
                gameId: string;
                gameType: 'tower' | 'singleplayer' | 'guildwar';
                point: Point;
                player: Player;
                keepTurn?: boolean;
            };
            const updateGameState =
                gameType === 'guildwar'
                    ? setLiveGames
                    : gameType === 'tower'
                      ? setTowerGames
                      : setSinglePlayerGames;
            const now = Date.now();

            updateGameState(currentGames => {
                const game = currentGames[gameId];
                if (!game || game.gameStatus === 'hidden_reveal_animating') {
                    return currentGames;
                }

                const permanentlyRevealedStones = (game.permanentlyRevealedStones || []).some((p: Point) => p.x === point.x && p.y === point.y)
                    ? [...(game.permanentlyRevealedStones || [])]
                    : [...(game.permanentlyRevealedStones || []), point];

                return {
                    ...currentGames,
                    [gameId]: {
                        ...game,
                        gameStatus: 'hidden_reveal_animating',
                        animation: {
                            type: 'hidden_reveal',
                            stones: [{ point, player }],
                            startTime: now,
                            duration: 2000
                        },
                        revealAnimationEndTime: now + 2000,
                        permanentlyRevealedStones,
                        pendingCapture: null,
                        turnDeadline: undefined,
                        turnStartTime: undefined,
                        pausedTurnTimeLeft: game.turnDeadline ? Math.max(0, (game.turnDeadline - now) / 1000) : game.pausedTurnTimeLeft,
                        itemUseDeadline: undefined,
                        justCaptured: [],
                        newlyRevealed: [],
                        ...(keepTurn ? { isAiTurnCancelledAfterReveal: true } as any : {})
                    } as any
                };
            });
            return;
        }

        if ((action as any).type === 'LOCAL_HIDDEN_FINAL_REVEAL_COMPLETE') {
            const { gameId, gameType } = (action as any).payload as {
                gameId: string;
                gameType: 'tower' | 'singleplayer' | 'guildwar';
            };
            const updateGameState =
                gameType === 'guildwar'
                    ? setLiveGames
                    : gameType === 'tower'
                      ? setTowerGames
                      : setSinglePlayerGames;
            updateGameState(prev => {
                const g = prev[gameId];
                if (!g || g.gameStatus !== 'hidden_final_reveal') return prev;
                return { ...prev, [gameId]: { ...g, gameStatus: 'scoring' as const, animation: null, revealAnimationEndTime: undefined } };
            });
            return;
        }

        /** 스캔 연출 종료 후 본경기(playing) 복귀 — 서버 루프·WS 지연 시 scanning_animating에 고정되는 현상 방지 (PVE + 온라인 히든) */
        if ((action as any).type === 'LOCAL_PVE_SCAN_ANIMATION_COMPLETE') {
            const { gameId, gameType } = (action as any).payload as {
                gameId: string;
                gameType: 'tower' | 'singleplayer' | 'guildwar' | 'normal';
            };
            const updateGameState =
                gameType === 'tower'
                    ? setTowerGames
                    : gameType === 'singleplayer'
                      ? setSinglePlayerGames
                      : setLiveGames;
            const now = Date.now();
            updateGameState(prev => {
                const g = prev[gameId];
                if (!g || g.gameStatus !== 'scanning_animating') return prev;
                const anim = g.animation as { type?: string; playerId?: string; startTime?: number; duration?: number } | null | undefined;
                if (anim?.type === 'scan' && typeof anim.startTime === 'number' && typeof anim.duration === 'number') {
                    if (now < anim.startTime + anim.duration) return prev;
                }
                let currentPlayer = g.currentPlayer;
                if (anim?.type === 'scan' && anim.playerId) {
                    const uid = anim.playerId;
                    if (uid === g.blackPlayerId) currentPlayer = Player.Black;
                    else if (uid === g.whitePlayerId) currentPlayer = Player.White;
                }
                const hasTimeControl =
                    (g.settings?.timeLimit ?? 0) > 0 ||
                    ((g.settings?.byoyomiCount ?? 0) > 0 && (g.settings?.byoyomiTime ?? 0) > 0);
                const buildTurnDeadline = (player: Player) => {
                    if (!hasTimeControl) {
                        return { turnDeadline: undefined as number | undefined, turnStartTime: undefined as number | undefined };
                    }
                    const timeLeft =
                        g.pausedTurnTimeLeft ??
                        (player === Player.Black ? g.blackTimeLeft : g.whiteTimeLeft);
                    const byoyomiLeft =
                        player === Player.Black
                            ? (g.blackByoyomiPeriodsLeft ?? 0)
                            : (g.whiteByoyomiPeriodsLeft ?? 0);
                    const byoyomiTime = g.settings?.byoyomiTime ?? 0;
                    if ((timeLeft ?? 0) <= 0 && byoyomiLeft > 0 && byoyomiTime > 0) {
                        return { turnDeadline: now + byoyomiTime * 1000, turnStartTime: now };
                    }
                    if ((timeLeft ?? 0) > 0) {
                        return { turnDeadline: now + (timeLeft ?? 0) * 1000, turnStartTime: now };
                    }
                    return { turnDeadline: undefined, turnStartTime: hasTimeControl ? now : undefined };
                };
                const deadline = buildTurnDeadline(currentPlayer);
                const timeKey = currentPlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                const restoredTimeLeft =
                    g.pausedTurnTimeLeft ??
                    (currentPlayer === Player.Black ? g.blackTimeLeft : g.whiteTimeLeft);
                return {
                    ...prev,
                    [gameId]: {
                        ...g,
                        gameStatus: 'playing' as const,
                        animation: null,
                        currentPlayer,
                        itemUseDeadline: undefined,
                        pausedTurnTimeLeft: undefined,
                        ...(typeof restoredTimeLeft === 'number' ? { [timeKey]: restoredTimeLeft } : {}),
                        ...deadline,
                    },
                };
            });
            return;
        }

        if ((action as any).type === 'LOCAL_HIDDEN_REVEAL_COMPLETE') {
            const { gameId, gameType } = (action as any).payload as {
                gameId: string;
                gameType: 'tower' | 'singleplayer' | 'guildwar';
            };
            // 길드전은 서버 권위 상태를 그대로 사용한다.
            // 로컬에서 pendingCapture 정산/자동계가를 추가로 수행하면
            // WS 갱신 타이밍과 엇갈려 캡처된 돌이 되살아나는 시각적 역행이 발생할 수 있다.
            if (gameType === 'guildwar') {
                setLiveGames((currentGames) => {
                    const game = currentGames[gameId];
                    if (!game) return currentGames;
                    if (game.gameStatus !== 'hidden_reveal_animating') return currentGames;
                    return {
                        ...currentGames,
                        [gameId]: {
                            ...game,
                            gameStatus: 'playing' as const,
                            animation: null,
                            revealAnimationEndTime: undefined,
                        } as any,
                    };
                });
                window.setTimeout(() => {
                    void (async () => {
                        const games = liveGamesRef.current ?? {};
                        const g = games[gameId];
                        if (!g) return;
                        const aiSeatId =
                            g.currentPlayer === Player.Black ? g.blackPlayerId : g.whitePlayerId;
                        const isAiTurn =
                            aiSeatId === aiUserId ||
                            (g.isAiGame && aiSeatId === 'ai-player-01') ||
                            (!!aiSeatId && String(aiSeatId).startsWith('dungeon-bot-'));
                        if (!isAiTurn) return;
                        const clientSync = buildPveItemActionClientSync(g);
                        await handleAction({
                            type: 'REQUEST_SERVER_AI_MOVE',
                            payload: clientSync
                                ? { gameId, clientSync }
                                : { gameId },
                        } as ServerAction);
                    })();
                }, 120);
                return;
            }
            const updateGameState =
                gameType === 'tower'
                    ? setTowerGames
                    : setSinglePlayerGames;
            const now = Date.now();
            const postRevealAutoScoringRef: {
                current: {
                    boardState: any[][];
                    moveHistory: any[];
                    totalTurns: number;
                    blackTimeLeft: number | undefined;
                    whiteTimeLeft: number | undefined;
                    captures: any;
                    isHiddenMode: boolean;
                } | null;
            } = { current: null };

            const queueAutoScoringAfterReveal = (nextGame: LiveGameSession) => {
                const autoScoringTurns =
                    gameType === 'singleplayer'
                        ? resolveSinglePlayerAutoScoringCapForClientSession(nextGame as any)
                        : (nextGame.settings as any)?.autoScoringTurns;
                if (!autoScoringTurns || nextGame.gameStatus !== 'playing') return;
                const validMoves = (nextGame.moveHistory || []).filter((m: any) => m.x !== -1 && m.y !== -1);
                const totalTurns = nextGame.totalTurns ?? validMoves.length;
                if (totalTurns < autoScoringTurns) return;
                const isHiddenMode = nextGame.mode === GameMode.Hidden ||
                    (nextGame.mode === GameMode.Mix && (nextGame.settings as any)?.mixedModes?.includes?.(GameMode.Hidden)) ||
                    (((nextGame.settings as any)?.hiddenStoneCount ?? 0) > 0);
                postRevealAutoScoringRef.current = {
                    boardState: nextGame.boardState,
                    moveHistory: nextGame.moveHistory || [],
                    totalTurns,
                    blackTimeLeft: nextGame.blackTimeLeft,
                    whiteTimeLeft: nextGame.whiteTimeLeft,
                    captures: nextGame.captures,
                    isHiddenMode
                };
            };

            updateGameState(currentGames => {
                const game = currentGames[gameId];
                if (!game) {
                    return currentGames;
                }

                // 서버/로컬 동기화 타이밍에 gameStatus가 먼저 playing으로 돌아가더라도
                // pendingCapture가 남아 있으면 포획 정산은 반드시 마무리한다.
                if (game.gameStatus !== 'hidden_reveal_animating' && !game.pendingCapture) {
                    return currentGames;
                }

                const pendingCapture = game.pendingCapture;
                const hasTimeControl = (game.settings?.timeLimit ?? 0) > 0 || ((game.settings?.byoyomiCount ?? 0) > 0 && (game.settings?.byoyomiTime ?? 0) > 0);
                const buildTurnDeadline = (player: Player) => {
                    if (!hasTimeControl) {
                        return { turnDeadline: undefined, turnStartTime: undefined };
                    }
                    const timeLeft = player === Player.Black ? game.blackTimeLeft : game.whiteTimeLeft;
                    const byoyomiLeft = player === Player.Black ? (game.blackByoyomiPeriodsLeft ?? 0) : (game.whiteByoyomiPeriodsLeft ?? 0);
                    const byoyomiTime = game.settings?.byoyomiTime ?? 0;
                    if ((timeLeft ?? 0) <= 0 && byoyomiLeft > 0 && byoyomiTime > 0) {
                        return { turnDeadline: now + byoyomiTime * 1000, turnStartTime: now };
                    }
                    if ((timeLeft ?? 0) > 0) {
                        return { turnDeadline: now + (timeLeft ?? 0) * 1000, turnStartTime: now };
                    }
                    return { turnDeadline: undefined, turnStartTime: hasTimeControl ? now : undefined };
                };

                if (!pendingCapture) {
                    const deadline = buildTurnDeadline(game.currentPlayer);
                    const nextGame = {
                        ...game,
                        animation: null,
                        gameStatus: 'playing',
                        revealAnimationEndTime: undefined,
                        pendingCapture: null,
                        pausedTurnTimeLeft: undefined,
                        itemUseDeadline: undefined,
                        justCaptured: [],
                        newlyRevealed: [],
                        ...deadline,
                        ...(game as any).isAiTurnCancelledAfterReveal !== undefined
                            ? ({ isAiTurnCancelledAfterReveal: undefined } as any)
                            : {},
                        ...(game as any).pendingAiMoveAfterUserHiddenFullReveal !== undefined
                            ? ({ pendingAiMoveAfterUserHiddenFullReveal: undefined } as any)
                            : {}
                    } as LiveGameSession;
                    queueAutoScoringAfterReveal(nextGame);
                    return {
                        ...currentGames,
                        [gameId]: nextGame as any
                    };
                }

                const movePlayer = pendingCapture.move.player;
                const opponentPlayer = movePlayer === Player.Black ? Player.White : Player.Black;
                const boardState = (game.boardState || []).map((row: Player[]) => [...row]);
                const captures = { ...(game.captures || {}) };
                const baseStoneCaptures = { ...(game.baseStoneCaptures || {}) };
                const hiddenStoneCaptures = { ...(game.hiddenStoneCaptures || {}) };
                let blackPatternStones = game.blackPatternStones ? [...game.blackPatternStones] : undefined;
                let whitePatternStones = game.whitePatternStones ? [...game.whitePatternStones] : undefined;
                const justCaptured: { point: Point; player: Player; wasHidden: boolean; capturePoints?: number; wasBaseStone?: boolean }[] =
                    [];
                let clearAiInitialHidden = false;
                const aiInitialHiddenStone = (game as any).aiInitialHiddenStone as Point | undefined;

                for (const stone of pendingCapture.stones || []) {
                    if (boardState[stone.y]) {
                        boardState[stone.y][stone.x] = Player.None;
                    }

                    const moveIndex = findLatestMoveIndexAtExcludingRecordedBaseStones(
                        game.moveHistory,
                        stone.x,
                        stone.y,
                        opponentPlayer,
                        game,
                    );
                    const wasHiddenMove = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
                    const wasAiInitialHidden = !!aiInitialHiddenStone && aiInitialHiddenStone.x === stone.x && aiInitialHiddenStone.y === stone.y;
                    const wasRevealedHidden = !!game.permanentlyRevealedStones?.some(
                        (p) => p.x === stone.x && p.y === stone.y
                    );
                    const wasBaseStone = isIntersectionRecordedAsBaseStone(game, stone.x, stone.y);
                    const wasPatternStone = opponentPlayer === Player.Black
                        ? !!blackPatternStones?.some(p => p.x === stone.x && p.y === stone.y)
                        : !!whitePatternStones?.some(p => p.x === stone.x && p.y === stone.y);

                    let points = 1;
                    let wasHidden = false;

                    if (wasBaseStone) {
                        points = 5;
                        baseStoneCaptures[movePlayer] = (baseStoneCaptures[movePlayer] || 0) + 1;
                    } else if (wasHiddenMove || wasAiInitialHidden || wasRevealedHidden) {
                        points = 5;
                        wasHidden = true;
                        hiddenStoneCaptures[movePlayer] = (hiddenStoneCaptures[movePlayer] || 0) + 1;
                        if (wasAiInitialHidden) {
                            clearAiInitialHidden = true;
                        }
                    } else if (wasPatternStone) {
                        points = 2;
                        if (opponentPlayer === Player.Black) {
                            blackPatternStones = blackPatternStones?.filter(p => !(p.x === stone.x && p.y === stone.y));
                        } else {
                            whitePatternStones = whitePatternStones?.filter(p => !(p.x === stone.x && p.y === stone.y));
                        }
                    }

                    captures[movePlayer] = (captures[movePlayer] || 0) + points;
                    justCaptured.push({
                        point: stone,
                        player: opponentPlayer,
                        wasHidden,
                        capturePoints: points,
                        ...(wasBaseStone ? { wasBaseStone: true as const } : {}),
                    });
                }

                // pendingCapture.stones에 “수순 좌표(히든 공개 시도 위치)”가 포함되는 경우,
                // 제거된 좌표에는 반드시 “수순을 둔 쪽의 돌”을 다시 배치한다.
                // (히든돌을 따냈을 때: 공개 연출 중엔 상대 히든이 보이고, 종료 후엔 일반돌로 존재해야 함)
                if (
                    pendingCapture.move &&
                    typeof pendingCapture.move.x === 'number' &&
                    typeof pendingCapture.move.y === 'number'
                ) {
                    boardState[pendingCapture.move.y][pendingCapture.move.x] = movePlayer;
                }

                const nextPlayer = movePlayer === Player.Black ? Player.White : Player.Black;
                const deadline = buildTurnDeadline(nextPlayer);
                const nextGame = {
                    ...game,
                    boardState,
                    captures,
                    baseStoneCaptures,
                    hiddenStoneCaptures,
                    blackPatternStones,
                    whitePatternStones,
                    justCaptured,
                    newlyRevealed: [],
                    currentPlayer: nextPlayer,
                    gameStatus: 'playing',
                    animation: null,
                    revealAnimationEndTime: undefined,
                    pendingCapture: null,
                    pausedTurnTimeLeft: undefined,
                    itemUseDeadline: undefined,
                    ...deadline,
                    ...(clearAiInitialHidden ? ({ aiInitialHiddenStone: undefined, aiInitialHiddenStoneIsPrePlaced: false } as any) : {}),
                    ...(game as any).isAiTurnCancelledAfterReveal !== undefined
                        ? ({ isAiTurnCancelledAfterReveal: undefined } as any)
                        : {}
                } as LiveGameSession;
                queueAutoScoringAfterReveal(nextGame);

                return {
                    ...currentGames,
                    [gameId]: nextGame as any
                };
            });

            if (postRevealAutoScoringRef.current) {
                const st = postRevealAutoScoringRef.current;
                const autoScoringAction = {
                    type: 'PLACE_STONE',
                    payload: {
                        gameId,
                        x: -1,
                        y: -1,
                        totalTurns: st.totalTurns,
                        moveHistory: st.moveHistory,
                        boardState: st.boardState,
                        blackTimeLeft: st.blackTimeLeft,
                        whiteTimeLeft: st.whiteTimeLeft,
                        captures: st.captures,
                        triggerAutoScoring: true
                    }
                } as any;
                const scoringDelayRef = gameType === 'tower' ? towerScoringDelayTimeoutRef : singlePlayerScoringDelayTimeoutRef;
                if (scoringDelayRef.current[gameId] != null) {
                    clearTimeout(scoringDelayRef.current[gameId]);
                }
                try {
                    sessionStorage.setItem(pveAutoScoringScheduledStorageKey(gameId), '1');
                } catch {
                    /* ignore */
                }
                scoringDelayRef.current[gameId] = setTimeout(() => {
                    try {
                        sessionStorage.removeItem(pveAutoScoringScheduledStorageKey(gameId));
                    } catch {
                        /* ignore */
                    }
                    markPveBoardSettledForScoring(gameId);
                    if (!postRevealAutoScoringRef.current?.isHiddenMode) {
                        updateGameState(prev => {
                            const g = prev[gameId];
                            if (!g) return prev;
                            if (g.gameStatus === 'scoring') return prev;
                            return { ...prev, [gameId]: { ...g, gameStatus: 'scoring' as const } };
                        });
                    }
                    handleAction(autoScoringAction).catch(err => {
                        console.error(`[handleAction] Failed to trigger auto-scoring after hidden reveal:`, err);
                    });
                    delete scoringDelayRef.current[gameId];
                }, BOARD_SETTLE_BEFORE_SCORING_MS);
            }
            return;
        }

        // 타워 게임과 싱글플레이 게임의 클라이언트 측 move 처리 (서버로 전송하지 않음)
        // 클라이언트 측 이동 처리 (도전의 탑, 싱글플레이 공통 로직)
        if ((action as any).type === 'TOWER_CLIENT_MOVE' || (action as any).type === 'SINGLE_PLAYER_CLIENT_MOVE') {
            const { updateGameStateAfterMove, checkVictoryCondition } = await import('./useClientGameState.js');
            const isTower = (action as any).type === 'TOWER_CLIENT_MOVE';
            const actionTypeName = isTower ? 'TOWER_CLIENT_MOVE' : 'SINGLE_PLAYER_CLIENT_MOVE';
            const payload = (action as any).payload;
            const { gameId, x, y, newBoardState, capturedStones, newKoInfo } = payload;
            // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
            if (process.env.NODE_ENV === 'development') {
                console.log(`[handleAction] ${actionTypeName} - processing client-side:`, { gameId, x, y });
            }
            
            // 타워 게임과 싱글플레이 게임을 각각의 상태로 관리
            const updateGameState = isTower ? setTowerGames : setSinglePlayerGames;
            const gameType: 'tower' | 'singleplayer' = isTower ? 'tower' : 'singleplayer';
            
            // 게임 상태 업데이트 및 체크 정보 준비
            let victoryCheckResult: { winner: Player; winReason: string } | null = null;
            let shouldEndGameSurvival = false;
            let endGameWinnerSurvival: Player | null = null;
            let shouldEndGameTurnLimit = false;
            let endGameWinnerTurnLimit: Player | null = null;
            let shouldEndGameCaptureTarget = false;
            let endGameWinnerCaptureTarget: Player | null = null;
            let finalUpdatedGame: LiveGameSession | null = null;
            
            updateGameState((currentGames) => {
                const game = currentGames[gameId];
                if (!game) {
                    // 게임이 아직 로드되지 않았을 수 있으므로 조용히 반환 (WebSocket 업데이트를 기다림)
                    console.debug(`[handleAction] ${actionTypeName} - Game not found in state (may be loading):`, gameId);
                    return currentGames;
                }
                
                // 게임이 이미 종료되었는지 확인
                if (game.gameStatus === 'ended' || game.gameStatus === 'no_contest' || game.gameStatus === 'scoring') {
                    console.log(`[handleAction] ${actionTypeName} - Game already ended, ignoring move:`, {
                        gameId,
                        gameStatus: game.gameStatus
                    });
                    return currentGames;
                }

                const { x: px, y: py, isPass: payloadIsPass } = payload as {
                    x?: number;
                    y?: number;
                    isPass?: boolean;
                };
                if (
                    !payloadIsPass &&
                    typeof px === 'number' &&
                    typeof py === 'number' &&
                    px >= 0 &&
                    py >= 0
                ) {
                    const mh = game.moveHistory;
                    const last = mh && mh.length > 0 ? mh[mh.length - 1] : undefined;
                    if (
                        last &&
                        last.x === px &&
                        last.y === py &&
                        last.player === game.currentPlayer
                    ) {
                        if (process.env.NODE_ENV === 'development') {
                            console.warn(`[handleAction] ${actionTypeName} duplicate client move ignored`, {
                                gameId,
                                x: px,
                                y: py,
                            });
                        }
                        return currentGames;
                    }
                }

                // 빠른 연속 클릭 레이스 방지:
                // 수순 제한(autoScoringTurns)에 이미 도달한 상태라면 추가 착수를 로컬에 반영하지 않는다.
                if (
                    !payloadIsPass &&
                    typeof px === 'number' &&
                    typeof py === 'number' &&
                    px >= 0 &&
                    py >= 0
                ) {
                    let moveLimit: number | undefined =
                        gameType === 'singleplayer'
                            ? resolveSinglePlayerAutoScoringCapForClientSession(game as any)
                            : (game.settings as any)?.autoScoringTurns;
                    if (
                        gameType === 'tower' &&
                        (moveLimit === undefined || moveLimit === null) &&
                        (game.stageId || game.towerFloor != null)
                    ) {
                        const stage = game.stageId
                            ? TOWER_STAGES.find((s: any) => s.id === game.stageId)
                            : (game.towerFloor != null && Number(game.towerFloor) >= 1 ? TOWER_STAGES[Number(game.towerFloor) - 1] : undefined);
                        moveLimit = stage?.autoScoringTurns;
                    }

                    if (moveLimit != null && moveLimit > 0) {
                        const currentValidMoves = (game.moveHistory || []).filter((m: any) => m.x !== -1 && m.y !== -1).length;
                        const currentScoringTurns = Math.max(currentValidMoves, game.totalTurns ?? 0);
                        if (currentScoringTurns >= moveLimit) {
                            if (process.env.NODE_ENV === 'development') {
                                console.warn(`[handleAction] ${actionTypeName} blocked move after turn limit reached`, {
                                    gameId,
                                    currentValidMoves: currentScoringTurns,
                                    moveLimit,
                                    gameStatus: game.gameStatus,
                                });
                            }
                            return {
                                ...currentGames,
                                [gameId]: {
                                    ...game,
                                    totalTurns: currentScoringTurns,
                                    gameStatus: 'scoring' as const,
                                }
                            };
                        }
                    }
                }

                // 공통 유틸리티 함수를 사용하여 게임 상태 업데이트
                const updateResult = updateGameStateAfterMove(game, payload, gameType);
                finalUpdatedGame = updateResult.updatedGame;
                
                // 싱글플레이 자동 계가 트리거 체크 (즉시 동기적으로 처리하여 게임 초기화 방지)
                let shouldTriggerAutoScoring = false;
                let autoScoringPreservedState: any = null;
                
                // 싱글플레이 또는 AI봇 대결에서 자동계가 체크
                // hidden_placing, scanning 등 아이템 모드에서는 자동계가 체크를 하지 않음
                const isItemMode = ['hidden_placing', 'scanning', 'missile_selecting', 'missile_animating', 'scanning_animating', 'hidden_reveal_animating'].includes(updateResult.updatedGame.gameStatus);
                
                if (!isItemMode) {
                    const skipLobbyCaptureTurnScoring =
                        updateResult.updatedGame.mode === GameMode.Capture &&
                        !isSessionSingleOrTower(updateResult.updatedGame);
                    let autoScoringTurns: number | undefined =
                        gameType === 'singleplayer'
                            ? resolveSinglePlayerAutoScoringCapForClientSession(updateResult.updatedGame as any)
                            : (updateResult.updatedGame.settings as any)?.autoScoringTurns;
                    if (gameType === 'tower' && (autoScoringTurns === undefined || autoScoringTurns === null) && (game.stageId || game.towerFloor != null)) {
                        const stage = game.stageId
                            ? TOWER_STAGES.find((s: any) => s.id === game.stageId)
                            : (game.towerFloor != null && Number(game.towerFloor) >= 1 ? TOWER_STAGES[Number(game.towerFloor) - 1] : undefined);
                        autoScoringTurns = stage?.autoScoringTurns;
                    }
                    if (!skipLobbyCaptureTurnScoring && (autoScoringTurns !== undefined || (gameType === 'singleplayer' && game.stageId))) {
                    // totalTurns는 항상 유효 수 개수로 확정 (0/N 표시와 트리거 일치).
                    // 서버/스토리지의 totalTurns가 수순보다 앞서면(예: 60/60에서 AI 차례 생략) Math.max로 인해 조기 계가되므로 validMoves만 신뢰한다.
                    const validMoves = (updateResult.updatedGame.moveHistory || []).filter((m: any) => m.x !== -1 && m.y !== -1);
                    const totalTurns = validMoves.length;
                    updateResult.updatedGame.totalTurns = totalTurns;
                    
                        if (totalTurns > 0 && autoScoringTurns != null && autoScoringTurns > 0) {
                            try {
                                const remainingTurns = Math.max(0, autoScoringTurns - totalTurns);
                                // 자동계가: 남은 턴이 0 이하(0/N 도달)이면 반드시 계가 트리거
                                if (remainingTurns <= 0) {
                                    updateResult.updatedGame.totalTurns = totalTurns;
                                    const status = updateResult.updatedGame.gameStatus;
                                    if (status === 'playing' || status === 'hidden_placing') {
                                        // 0/N 도달 시 다음 차례가 AI여도 추가 착수는 없음(백이 마지막 수를 둔 경우 등).
                                        // syncTimeAndStateForScoring으로 즉시 계가하면 서버가 한 수 짧은 판으로 덮어 마지막 돌이 사라질 수 있다.
                                        shouldTriggerAutoScoring = true;
                                        const gameTypeLabel = gameType === 'singleplayer' ? 'SinglePlayer' : 'AiGame';
                                        console.log(
                                            `[handleAction] ${actionTypeName} - Auto-scoring triggered at ${updateResult.updatedGame.totalTurns} turns (${gameTypeLabel}, stageId: ${game.stageId || 'N/A'}) - delaying scoring transition`
                                        );

                                        const preservedBoardState =
                                            updateResult.updatedGame.boardState && updateResult.updatedGame.boardState.length > 0
                                                ? updateResult.updatedGame.boardState
                                                : (game.boardState || updateResult.updatedGame.boardState);
                                        const preservedMoveHistory =
                                            updateResult.updatedGame.moveHistory && updateResult.updatedGame.moveHistory.length > 0
                                                ? updateResult.updatedGame.moveHistory
                                                : (game.moveHistory || updateResult.updatedGame.moveHistory);
                                        const preservedTotalTurns = updateResult.updatedGame.totalTurns ?? game.totalTurns;
                                        const preservedBlackTimeLeft = updateResult.updatedGame.blackTimeLeft ?? game.blackTimeLeft;
                                        const preservedWhiteTimeLeft = updateResult.updatedGame.whiteTimeLeft ?? game.whiteTimeLeft;
                                        const preservedCaptures = updateResult.updatedGame.captures ?? game.captures;
                                        const preservedHiddenMoves = updateResult.updatedGame.hiddenMoves ?? game.hiddenMoves;
                                        const preservedPermanentlyRevealedStones =
                                            updateResult.updatedGame.permanentlyRevealedStones ?? game.permanentlyRevealedStones;

                                        autoScoringPreservedState = {
                                            boardState: preservedBoardState,
                                            moveHistory: preservedMoveHistory,
                                            totalTurns: preservedTotalTurns,
                                            blackTimeLeft: preservedBlackTimeLeft,
                                            whiteTimeLeft: preservedWhiteTimeLeft,
                                            captures: preservedCaptures,
                                            hiddenMoves: preservedHiddenMoves,
                                            permanentlyRevealedStones: preservedPermanentlyRevealedStones,
                                        };

                                        updateResult.updatedGame.boardState = preservedBoardState;
                                        updateResult.updatedGame.moveHistory = preservedMoveHistory;
                                        updateResult.updatedGame.totalTurns = preservedTotalTurns;
                                        updateResult.updatedGame.blackTimeLeft = preservedBlackTimeLeft;
                                        updateResult.updatedGame.whiteTimeLeft = preservedWhiteTimeLeft;
                                        updateResult.updatedGame.captures = preservedCaptures;
                                    }
                                }
                            } catch (err) {
                                console.error(`[handleAction] Failed to check auto-scoring:`, err);
                            }
                        }
                    }
                }
                
                // 자동 계가 트리거가 필요한 경우 서버에 요청 (비동기로 처리)
                if (shouldTriggerAutoScoring && autoScoringPreservedState) {
                    let { totalTurns, moveHistory, boardState, blackTimeLeft, whiteTimeLeft, captures, hiddenMoves, permanentlyRevealedStones } = autoScoringPreservedState;
                    const boardSize = game.settings?.boardSize || 9;
                    // IMPORTANT: 포획이 있는 판에서 moveHistory로 보드를 "단순 복원"하면 잡힌 돌이 다시 살아나는 버그가 발생할 수 있음.
                    // 자동계가에는 항상 현재 보드(boardState)를 우선 전달한다.
                    const boardStateValid =
                        Array.isArray(boardState) &&
                        boardState.length === boardSize &&
                        boardState.every((row: any) => Array.isArray(row) && row.length === boardSize);
                    if (!boardStateValid) {
                        const fallback = game.boardState;
                        const fallbackValid =
                            Array.isArray(fallback) &&
                            fallback.length === boardSize &&
                            fallback.every((row: any) => Array.isArray(row) && row.length === boardSize);
                        if (fallbackValid) {
                            boardState = fallback;
                        }
                    }
                    console.log(`[handleAction] Auto-scoring triggered on client, sending to server: totalTurns=${totalTurns}, moveHistoryLength=${moveHistory.length}, boardStateSize=${boardState.length}, blackTimeLeft=${blackTimeLeft}, whiteTimeLeft=${whiteTimeLeft}, stage=${game.stageId}`);
                    // 미사일/포획 모드 등에서 계가 정확도를 위해 보드·수순을 스냅샷으로 전달 (참조가 나중에 바뀌지 않도록 복사)
                    const snapshotBoardState = Array.isArray(boardState) ? boardState.map((row: any) => [...row]) : boardState;
                    const snapshotMoveHistory = Array.isArray(moveHistory) ? moveHistory.map((m: any) => ({ ...m })) : moveHistory;
                    const autoScoringAction = {
                        type: 'PLACE_STONE',
                        payload: {
                            gameId,
                            x: -1,
                            y: -1,
                            totalTurns: totalTurns,
                            moveHistory: snapshotMoveHistory,
                            boardState: snapshotBoardState,
                            blackTimeLeft: blackTimeLeft,
                            whiteTimeLeft: whiteTimeLeft,
                            captures: captures,
                            hiddenMoves: hiddenMoves ?? undefined,
                            permanentlyRevealedStones: Array.isArray(permanentlyRevealedStones) ? permanentlyRevealedStones : undefined,
                            triggerAutoScoring: true
                        }
                    } as any;
                    
                    // 히든 모드: 서버가 먼저 히든돌 공개 애니메이션(hidden_final_reveal)을 보낸 뒤 계가로 전환하므로,
                    // 클라이언트에서 500ms 후에 gameStatus를 'scoring'으로 바꾸지 않음 (순서 꼬임 방지)
                    const isHiddenMode = game.mode === GameMode.Hidden ||
                        (game.mode === GameMode.Mix && (game.settings as any)?.mixedModes?.includes?.(GameMode.Hidden)) ||
                        ((game.settings as any)?.hiddenStoneCount ?? 0) > 0;
                    const scoringDelayRef = isTower ? towerScoringDelayTimeoutRef : singlePlayerScoringDelayTimeoutRef;
                    if (scoringDelayRef.current[gameId] != null) {
                        clearTimeout(scoringDelayRef.current[gameId]);
                    }
                    try {
                        sessionStorage.setItem(pveAutoScoringScheduledStorageKey(gameId), '1');
                    } catch {
                        /* ignore */
                    }
                    scoringDelayRef.current[gameId] = setTimeout(() => {
                        try {
                            sessionStorage.removeItem(pveAutoScoringScheduledStorageKey(gameId));
                        } catch {
                            /* ignore */
                        }
                        markPveBoardSettledForScoring(gameId);
                        if (!isHiddenMode) {
                            updateGameState(prev => {
                                const g = prev[gameId];
                                if (!g) return prev;
                                if (g.gameStatus === 'scoring') return prev;
                                const scoringEndTime = (g as { endTime?: number }).endTime ?? Date.now();
                                return {
                                    ...prev,
                                    [gameId]: {
                                        ...g,
                                        gameStatus: 'scoring' as const,
                                        endTime: scoringEndTime,
                                    },
                                };
                            });
                        }
                        console.log(`[handleAction] Sending PLACE_STONE action to server for auto-scoring:`, { ...autoScoringAction, payload: { ...autoScoringAction.payload, moveHistory: `[${moveHistory.length} moves]` } });
                        handleAction(autoScoringAction).then(result => {
                            console.log(`[handleAction] Auto-scoring action sent successfully:`, result);
                        }).catch(err => {
                            console.error(`[handleAction] Failed to trigger auto-scoring on server:`, err);
                        });
                        delete scoringDelayRef.current[gameId];
                    }, BOARD_SETTLE_BEFORE_SCORING_MS);
                }
                
                // 히든 공개 연출 중에는 updatedGame.captures가 직전 값으로 유지될 수 있어
                // 종료 판정(목표 달성/턴 제한)에는 checkInfo.newCaptures를 우선 사용한다.
                const prevOutcomeCaptures = (updateResult.updatedGame.captures ||
                    {}) as Partial<Record<Player, number>>;
                const checkInfoOutcomeCaptures = (updateResult.checkInfo?.newCaptures ||
                    {}) as Partial<Record<Player, number>>;
                const capturesForOutcome: LiveGameSession['captures'] = {
                    [Player.None]: Number(
                        checkInfoOutcomeCaptures[Player.None] ?? prevOutcomeCaptures[Player.None] ?? 0,
                    ),
                    [Player.Black]: Number(
                        checkInfoOutcomeCaptures[Player.Black] ?? prevOutcomeCaptures[Player.Black] ?? 0,
                    ),
                    [Player.White]: Number(
                        checkInfoOutcomeCaptures[Player.White] ?? prevOutcomeCaptures[Player.White] ?? 0,
                    ),
                };

                // 살리기 바둑 모드: 백이 수를 둔 경우 목표 돌/남은 턴 체크
                const movePlayer = game.currentPlayer; // 수를 둔 플레이어
                
                if (gameType === 'singleplayer' && movePlayer === Player.White) {
                    // game.settings에서 survivalTurns를 직접 확인 (동기적으로 접근 가능)
                    const survivalTurns = (game.settings as any)?.survivalTurns;
                    if (survivalTurns) {
                        const updatedGame = updateResult.updatedGame as LiveGameSession;
                        // 서버와 동일한 기준: whiteTurnsPlayed 우선, 없으면 백 유효 수 개수로 보정
                        const whiteTurnsPlayedRaw = (updatedGame as any).whiteTurnsPlayed;
                        const whiteTurnsPlayed =
                            typeof whiteTurnsPlayedRaw === 'number'
                                ? Math.max(0, Math.floor(whiteTurnsPlayedRaw))
                                : (updatedGame.moveHistory || []).filter(
                                      (m: { player: Player; x: number; y: number }) =>
                                          m.player === Player.White && m.x !== -1 && m.y !== -1,
                                  ).length;
                        const remainingTurns = survivalTurns - whiteTurnsPlayed;

                        const whiteTargetRaw = Number(updatedGame.effectiveCaptureTargets?.[Player.White]);
                        const hasWhiteTarget =
                            Number.isFinite(whiteTargetRaw) &&
                            whiteTargetRaw > 0 &&
                            whiteTargetRaw !== 999;
                        const whiteCaptures = capturesForOutcome[Player.White] ?? 0;
                        
                        console.log(`[handleAction] ${actionTypeName} - Survival Go check: whiteTurnsPlayed=${whiteTurnsPlayed}, survivalTurns=${survivalTurns}, remaining=${remainingTurns}, whiteCaptures=${whiteCaptures}, whiteTarget=${whiteTargetRaw}`);

                        // 1) 백이 목표 돌을 이미 따낸 경우 → 백 승리(유저 미션 실패)
                        if (hasWhiteTarget && whiteCaptures >= whiteTargetRaw && updatedGame.gameStatus === 'playing') {
                            console.log(`[handleAction] ${actionTypeName} - White reached capture target (${whiteCaptures}/${whiteTargetRaw}), White wins - ENDING GAME`);
                            shouldEndGameSurvival = true;
                            endGameWinnerSurvival = Player.White;
                            const updatedGameWithOutcomeCaptures: LiveGameSession = {
                                ...updatedGame,
                                captures: capturesForOutcome,
                            };
                            finalUpdatedGame = { ...updatedGameWithOutcomeCaptures, gameStatus: 'ended' as const, winner: Player.White, winReason: 'capture_limit' };
                            return {
                                ...currentGames,
                                [gameId]: {
                                    ...updatedGameWithOutcomeCaptures,
                                    gameStatus: 'ended' as const,
                                    winner: Player.White,
                                    winReason: 'capture_limit'
                                }
                            };
                        }

                        // 2) 백이 목표를 못 채운 채로 턴이 모두 소진된 경우 → 흑 승리
                        if (remainingTurns <= 0 && game.gameStatus === 'playing') {
                            // 백이 따낸 돌 미션을 이미 완수한 경우에는
                            // 살리기 턴 제한 패배를 적용하지 않고 위의 capture_limit 결과를 그대로 따른다.
                            if (!(hasWhiteTarget && whiteCaptures >= whiteTargetRaw)) {
                                console.log(`[handleAction] ${actionTypeName} - White ran out of turns (${whiteTurnsPlayed}/${survivalTurns}), Black wins - ENDING GAME`);
                                shouldEndGameSurvival = true;
                                endGameWinnerSurvival = Player.Black;
                                const updatedGameWithOutcomeCaptures: LiveGameSession = {
                                    ...updatedGame,
                                    captures: capturesForOutcome,
                                };
                                finalUpdatedGame = { ...updatedGameWithOutcomeCaptures, gameStatus: 'ended' as const, winner: Player.Black, winReason: 'capture_limit' };
                                // 게임 상태를 즉시 ended로 업데이트
                                return {
                                    ...currentGames,
                                    [gameId]: {
                                        ...updatedGameWithOutcomeCaptures,
                                        gameStatus: 'ended' as const,
                                        winner: Player.Black,
                                        winReason: 'capture_limit'
                                    }
                                };
                            }
                        }
                    }
                }
                
                // 싱글플레이/도전의 탑 따내기 바둑:
                // 흑(유저) 제한 턴이 0이 되더라도, 같은 수에서 따낸 돌 미션을 완수했다면
                // 미션 성공(흑 승리)을 우선 적용하고 턴 제한 패배는 적용하지 않는다.
                if (
                    (gameType === 'singleplayer' || gameType === 'tower') &&
                    game.stageId &&
                    game.gameStatus === 'playing' &&
                    !(gameType === 'singleplayer' && (game.settings as any)?.isSurvivalMode === true)
                ) {
                    const stage =
                        gameType === 'tower'
                            ? TOWER_STAGES.find((s: { id: string }) => s.id === game.stageId)
                            : resolveLiveSessionSinglePlayerStageRow(game as any);
                    const settingsBt = (game.settings as any)?.blackTurnLimit;
                    const blackTurnLimit =
                        gameType === 'singleplayer' &&
                        typeof settingsBt === 'number' &&
                        settingsBt > 0
                            ? settingsBt
                            : (stage as { blackTurnLimit?: number } | undefined)?.blackTurnLimit;
                    if (blackTurnLimit !== undefined) {
                        const updatedGame = updateResult.updatedGame as LiveGameSession;
                        const moveHistory = updatedGame.moveHistory || [];
                        const blackMoves = moveHistory.filter((m: { player: Player; x: number; y: number }) => m.player === Player.Black && m.x !== -1 && m.y !== -1).length;
                        // 도전의 탑: blackTurnLimitBonus 반영 (아이템 등으로 추가된 턴)
                        const bonusRaw =
                            (updateResult.updatedGame as any).blackTurnLimitBonus ??
                            (game as any).blackTurnLimitBonus ??
                            0;
                        const bonus = Number(bonusRaw);
                        const effectiveLimit =
                            gameType === 'tower'
                                ? blackTurnLimit + (Number.isFinite(bonus) ? bonus : 0)
                                : blackTurnLimit;

                        if (blackMoves >= effectiveLimit) {
                            const blackTargetRaw = Number(updatedGame.effectiveCaptureTargets?.[Player.Black]);
                            const hasBlackTarget =
                                Number.isFinite(blackTargetRaw) &&
                                blackTargetRaw > 0 &&
                                blackTargetRaw !== 999;
                            const blackCaptures = capturesForOutcome[Player.Black] ?? 0;

                            // 흑이 목표 따낸 돌을 이미 달성한 경우에는 턴 제한 패배를 적용하지 않고,
                            // 아래의 승리 조건 체크(checkVictoryCondition)를 통해 미션 성공을 처리한다.
                            if (!(hasBlackTarget && blackCaptures >= blackTargetRaw)) {
                                console.log(`[handleAction] ${actionTypeName} - Black turn limit reached (${blackMoves}/${effectiveLimit}), mission fail - ENDING GAME`);
                                shouldEndGameTurnLimit = true;
                                endGameWinnerTurnLimit = Player.White;
                                const updatedGameWithOutcomeCaptures: LiveGameSession = {
                                    ...updatedGame,
                                    captures: capturesForOutcome,
                                };
                                finalUpdatedGame = { ...updatedGameWithOutcomeCaptures, gameStatus: 'ended' as const, winner: Player.White, winReason: 'timeout' };
                                return { ...currentGames, [gameId]: { ...updatedGameWithOutcomeCaptures, gameStatus: 'ended' as const, winner: Player.White, winReason: 'timeout' } };
                            }
                        }
                    }
                }
                
                // 안전장치: checkInfo 비생성/지연 상황에서도 따낸돌 목표 달성 시 즉시 종료를 보장한다.
                // 히든 포획 공개 연출 중에는 pendingCapture 정산 전 종료로 애니메이션이 끊기지 않게 한다.
                if (
                    (gameType === 'singleplayer' || gameType === 'tower') &&
                    game.gameStatus === 'playing' &&
                    updateResult.updatedGame.gameStatus !== 'hidden_reveal_animating'
                ) {
                    const blackTargetRaw = Number(updateResult.updatedGame.effectiveCaptureTargets?.[Player.Black] ?? game.effectiveCaptureTargets?.[Player.Black]);
                    const whiteTargetRaw = Number(updateResult.updatedGame.effectiveCaptureTargets?.[Player.White] ?? game.effectiveCaptureTargets?.[Player.White]);
                    const hasBlackTarget = Number.isFinite(blackTargetRaw) && blackTargetRaw > 0 && blackTargetRaw !== 999;
                    const hasWhiteTarget = Number.isFinite(whiteTargetRaw) && whiteTargetRaw > 0 && whiteTargetRaw !== 999;
                    const blackCaptures = capturesForOutcome[Player.Black] ?? 0;
                    const whiteCaptures = capturesForOutcome[Player.White] ?? 0;

                    if (hasBlackTarget && blackCaptures >= blackTargetRaw) {
                        shouldEndGameSurvival = false;
                        shouldEndGameTurnLimit = false;
                        endGameWinnerSurvival = null;
                        endGameWinnerTurnLimit = null;
                        shouldEndGameCaptureTarget = true;
                        endGameWinnerCaptureTarget = Player.Black;
                        const updatedGameWithOutcomeCaptures: LiveGameSession = {
                            ...(updateResult.updatedGame as LiveGameSession),
                            captures: capturesForOutcome,
                        };
                        finalUpdatedGame = { ...updatedGameWithOutcomeCaptures, gameStatus: 'ended' as const, winner: Player.Black, winReason: 'capture_limit' };
                        return {
                            ...currentGames,
                            [gameId]: {
                                ...updatedGameWithOutcomeCaptures,
                                gameStatus: 'ended' as const,
                                winner: Player.Black,
                                winReason: 'capture_limit'
                            }
                        };
                    }
                    if (hasWhiteTarget && whiteCaptures >= whiteTargetRaw) {
                        shouldEndGameSurvival = false;
                        shouldEndGameTurnLimit = false;
                        endGameWinnerSurvival = null;
                        endGameWinnerTurnLimit = null;
                        shouldEndGameCaptureTarget = true;
                        endGameWinnerCaptureTarget = Player.White;
                        const updatedGameWithOutcomeCaptures: LiveGameSession = {
                            ...(updateResult.updatedGame as LiveGameSession),
                            captures: capturesForOutcome,
                        };
                        finalUpdatedGame = { ...updatedGameWithOutcomeCaptures, gameStatus: 'ended' as const, winner: Player.White, winReason: 'capture_limit' };
                        return {
                            ...currentGames,
                            [gameId]: {
                                ...updatedGameWithOutcomeCaptures,
                                gameStatus: 'ended' as const,
                                winner: Player.White,
                                winReason: 'capture_limit'
                            }
                        };
                    }
                }

                // 승리 조건 체크 (도전의 탑 및 싱글플레이)
                if (updateResult.shouldCheckVictory && updateResult.checkInfo) {
                    const victoryCheckInfo = updateResult.checkInfo;
                    checkVictoryCondition(
                        victoryCheckInfo,
                        gameId,
                        updateResult.updatedGame.effectiveCaptureTargets ?? game.effectiveCaptureTargets
                    ).then(async (result) => {
                        if (result) {
                            victoryCheckResult = result;
                            // 게임 상태를 즉시 ended로 업데이트하고 winner도 설정
                            updateGameState((currentGames) => {
                                const game = currentGames[gameId];
                                if (game && game.gameStatus !== 'ended') {
                                    console.log(`[handleAction] ${actionTypeName} - Setting game status to ended and winner to ${result.winner === Player.Black ? 'Black' : 'White'} immediately:`, gameId);
                                    return { ...currentGames, [gameId]: { ...game, gameStatus: 'ended' as const, winner: result.winner, winReason: result.winReason } };
                                }
                                return currentGames;
                            });
                            const endGameActionType = isTower ? 'END_TOWER_GAME' : 'END_SINGLE_PLAYER_GAME';
                            if (isTower && result.winner === Player.Black) {
                                applyOptimisticTowerClearOnBlackWin(victoryCheckInfo.towerFloor, result.winner);
                            }
                            try {
                                await handleAction({
                                    type: endGameActionType,
                                    payload: {
                                        gameId,
                                        winner: result.winner,
                                        winReason: result.winReason,
                                        ...buildPveEndGameSnapshotPayload(updateResult.updatedGame),
                                    }
                                } as any);
                            } catch (err) {
                                console.error(`[handleAction] Failed to end ${gameType} game:`, err);
                            }
                        }
                    });
                }
                
                return { ...currentGames, [gameId]: updateResult.updatedGame };
            });
            
            // 싱글플레이 게임과 도전의 탑 게임의 경우 sessionStorage에 저장 (restoredBoardState가 최신 상태를 읽을 수 있도록)
            if ((gameType === 'singleplayer' || gameType === 'tower') && finalUpdatedGame) {
                try {
                    const game = finalUpdatedGame as LiveGameSession;
                    const GAME_STATE_STORAGE_KEY = `gameState_${gameId}`;
                    const gameStateToSave = {
                        gameId,
                        round: game.round ?? 1,
                        gameStatus: game.gameStatus,
                        currentPlayer: game.currentPlayer,
                        boardState: game.boardState,
                        moveHistory: game.moveHistory || [],
                        captures: game.captures || { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
                        baseStoneCaptures: game.baseStoneCaptures,
                        hiddenStoneCaptures: game.hiddenStoneCaptures,
                        permanentlyRevealedStones: game.permanentlyRevealedStones || [],
                        blackPatternStones: game.blackPatternStones,
                        whitePatternStones: game.whitePatternStones,
                        hiddenMoves: game.hiddenMoves || {},
                        hidden_stones_p1: (game as any).hidden_stones_p1,
                        hidden_stones_p2: (game as any).hidden_stones_p2,
                        totalTurns: game.totalTurns,
                        ...(gameType === 'tower' && (game as any).blackTurnLimitBonus != null
                            ? { blackTurnLimitBonus: Number((game as any).blackTurnLimitBonus) || 0 }
                            : {}),
                        timestamp: Date.now()
                    };
                    sessionStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(gameStateToSave));
                    console.log(`[handleAction] ${actionTypeName} - Saved game state to sessionStorage for game ${gameId}`);
                } catch (e) {
                    console.error(`[handleAction] ${actionTypeName} - Failed to save game state to sessionStorage:`, e);
                }
            }

            // 살리기 바둑에서 게임 종료가 필요한 경우
            if (shouldEndGameSurvival && endGameWinnerSurvival !== null && finalUpdatedGame) {
                // 게임 종료 액션 호출
                handleAction({
                    type: 'END_SINGLE_PLAYER_GAME',
                    payload: {
                        gameId,
                        winner: endGameWinnerSurvival,
                        winReason: 'capture_limit',
                        ...buildPveEndGameSnapshotPayload(finalUpdatedGame),
                    }
                } as any).catch(err => {
                    console.error(`[handleAction] Failed to end single player game:`, err);
                });
            }
            
            // 싱글플레이/도전의 탑 따내기 바둑 제한 턴 소진 시 미션 실패(서버에 종료 반영)
            if (shouldEndGameTurnLimit && endGameWinnerTurnLimit !== null && finalUpdatedGame) {
                const endGameActionType = gameType === 'tower' ? 'END_TOWER_GAME' : 'END_SINGLE_PLAYER_GAME';
                handleAction({
                    type: endGameActionType,
                    payload: {
                        gameId,
                        winner: endGameWinnerTurnLimit,
                        winReason: 'timeout',
                        ...buildPveEndGameSnapshotPayload(finalUpdatedGame),
                    }
                } as any).catch(err => {
                    console.error(`[handleAction] Failed to end ${gameType} game (turn limit):`, err);
                });
            }

            // 목표 따낸 돌 달성 안전장치 경로도 서버에 종료를 반영해야 새로고침 후 playing으로 되살아나지 않는다.
            if (shouldEndGameCaptureTarget && endGameWinnerCaptureTarget !== null && finalUpdatedGame) {
                const endGameActionType = gameType === 'tower' ? 'END_TOWER_GAME' : 'END_SINGLE_PLAYER_GAME';
                handleAction({
                    type: endGameActionType,
                    payload: {
                        gameId,
                        winner: endGameWinnerCaptureTarget,
                        winReason: 'capture_limit',
                        ...buildPveEndGameSnapshotPayload(finalUpdatedGame),
                    }
                } as any).catch(err => {
                    console.error(`[handleAction] Failed to end ${gameType} game (capture target):`, err);
                });
            }
            
            return { gameId };
        }
        
        if (action.type === 'CLEAR_TOURNAMENT_SESSION' && currentUserRef.current) {
            applyUserUpdate({
                    lastNeighborhoodTournament: null,
                    lastNationalTournament: null,
                    lastWorldTournament: null,
            }, 'CLEAR_TOURNAMENT_SESSION-local');
        }
        // Optimistic update는 제거 - 서버 응답에만 의존
        // TOGGLE_EQUIP_ITEM의 optimistic update는 서버 응답과 충돌할 수 있으므로 제거
        if (action.type === 'SAVE_PRESET') {
            const prevUser = currentUserRef.current;
            if (prevUser) {
                const { preset, index } = action.payload;
                const newPresets = [...(prevUser.equipmentPresets || [])];
                newPresets[index] = preset;
                applyUserUpdate({ equipmentPresets: newPresets }, 'SAVE_PRESET-local');
            }
        }

        // currentUserRef.current?.id가 없으면 액션을 보내지 않음 (401 에러 방지)
        if (!currentUserRef.current?.id) {
            if (import.meta.env.DEV) {
                console.warn(`[handleAction] Cannot send action ${action.type}: user not authenticated`);
            }
            // ENTER_TOURNAMENT_VIEW 같은 경우는 사용자가 아직 로드되지 않았을 수 있으므로
            // 에러를 표시하지 않고 조용히 무시
            if (action.type !== 'ENTER_TOURNAMENT_VIEW' && action.type !== 'LEAVE_TOURNAMENT_VIEW') {
                showError(tx('auth:loginRequired'));
            }
            return;
        }

        // 싱글/탑 기권: 서버가 정산·saveGame 끝낼 때까지 HTTP가 지연되므로, 종료 상태만 먼저 반영해 결과 모달을 즉시 연다.
        if (action.type === 'RESIGN_GAME') {
            const payload = (action as { payload?: { gameId?: string } }).payload;
            const gid = payload?.gameId;
            const uid = currentUserRef.current?.id;
            if (gid && uid) {
                const fromSp = singlePlayerGamesRef.current[gid];
                const fromTower = towerGamesRef.current[gid];
                const g = fromSp || fromTower;
                if (
                    g &&
                    g.gameStatus !== 'ended' &&
                    g.gameStatus !== 'no_contest' &&
                    isSessionSingleOrTower(g)
                ) {
                    const myEnum =
                        g.blackPlayerId === uid
                            ? Player.Black
                            : g.whitePlayerId === uid
                              ? Player.White
                              : Player.None;
                    if (myEnum !== Player.None) {
                        const winner = myEnum === Player.Black ? Player.White : Player.Black;
                        let snapshot: LiveGameSession;
                        try {
                            snapshot = structuredClone(g);
                        } catch {
                            snapshot = { ...g } as LiveGameSession;
                        }
                        const bucket: 'singleplayer' | 'tower' = fromSp ? 'singleplayer' : 'tower';
                        pveResignOptimisticRevertRef.current = { gameId: gid, bucket, snapshot };
                        const patch = (prev: LiveGameSession): LiveGameSession => ({
                            ...prev,
                            gameStatus: 'ended',
                            winner,
                            winReason: 'resign',
                            disconnectionState: null,
                            disconnectionCounts: {},
                            serverRevision: (prev.serverRevision ?? 0) + 1,
                        });
                        if (fromSp) {
                            setSinglePlayerGames((c) => {
                                const cur = c[gid];
                                if (!cur || cur.gameStatus === 'ended' || cur.gameStatus === 'no_contest') return c;
                                return { ...c, [gid]: patch(cur) };
                            });
                        } else if (fromTower) {
                            setTowerGames((c) => {
                                const cur = c[gid];
                                if (!cur || cur.gameStatus === 'ended' || cur.gameStatus === 'no_contest') return c;
                                return { ...c, [gid]: patch(cur) };
                            });
                        }
                    }
                }
            }
        }

        let dicePlaceGameId: string | undefined;
        const rollbackTowerAddTurnOptimistic = () => {
            if (action.type !== 'TOWER_ADD_TURNS') return;
            const gid = (action.payload as { gameId?: string })?.gameId;
            if (!gid) return;
            const pending = towerAddTurnOptimisticPendingByGameRef.current[gid] || 0;
            delete towerAddTurnOptimisticPendingByGameRef.current[gid];
            if (pending <= 0) return;
            flushSync(() => {
                setTowerGames((c) => {
                    const g = c[gid];
                    if (!g) return c;
                    const bonus = Number((g as any).blackTurnLimitBonus) || 0;
                    return { ...c, [gid]: { ...g, blackTurnLimitBonus: Math.max(0, bonus - pending) } };
                });
            });
            try {
                const key = `gameState_${gid}`;
                const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
                if (raw) {
                    const parsed = JSON.parse(raw) as Record<string, unknown>;
                    if (parsed && parsed.gameId === gid) {
                        parsed.blackTurnLimitBonus = Math.max(0, (Number(parsed.blackTurnLimitBonus) || 0) - pending);
                        parsed.timestamp = Date.now();
                        sessionStorage.setItem(key, JSON.stringify(parsed));
                    }
                }
            } catch {
                /* ignore */
            }
        };

        const revertAiLobbyStartOptimistic = () => {
            const entry = aiLobbyStartRevertRef.current;
            if (!entry) return;
            aiLobbyStartRevertRef.current = null;
            setLiveGames((c) => (c[entry.gameId] ? { ...c, [entry.gameId]: entry.snapshot } : c));
        };

        try {
            // 도전의 탑 턴 추가: 서버 응답 전에 클라가 턴 제한 패배를 판정하지 않도록 보너스를 즉시 반영
            if (action.type === 'TOWER_ADD_TURNS') {
                const gid = (action.payload as { gameId?: string })?.gameId;
                if (gid) {
                    const gSnap = towerGamesRef.current[gid];
                    if (gSnap && getSessionArenaKind(gSnap) === 'tower') {
                        towerAddTurnOptimisticPendingByGameRef.current[gid] =
                            (towerAddTurnOptimisticPendingByGameRef.current[gid] || 0) + 3;
                        flushSync(() => {
                            setTowerGames((current) => {
                                const g = current[gid];
                                if (!g || getSessionArenaKind(g) !== 'tower') return current;
                                const prev = Number((g as any).blackTurnLimitBonus) || 0;
                                return { ...current, [gid]: { ...g, blackTurnLimitBonus: prev + 3 } };
                            });
                        });
                        // sessionStorage는 여기서 +3 하지 않음 — Game.tsx 저장분과 max 병합 시 이중 누적·UI+6 버그가 난다.
                        // 성공 응답에서 서버 보너스로 한 번에 맞춘다.
                    }
                }
            }

            audioService.unlockFromUserGesture();
            void audioService.initialize();

            dicePlaceGameId =
                action.type === 'DICE_PLACE_STONE' || action.type === 'THIEF_PLACE_STONE' || action.type === 'ALKKAGI_PLACE_STONE'
                    ? (action.payload as { gameId?: string })?.gameId
                    : undefined;
            if (action.type === 'DICE_ROLL') {
                const gid = (action.payload as { gameId?: string })?.gameId;
                if (gid) {
                    delete aiDicePlaceBatchRef.current[gid];
                    delete aiDiceTurnPlaceQuotaRef.current[gid];
                }
            }

            const revertPvpDicePlaceSnapshot = () => {
                const gid = dicePlaceGameId;
                if (!gid) return;
                const snap = pvpDicePlaceRevertRef.current[gid];
                if (!snap) return;
                setLiveGames((c) => (c[gid] ? { ...c, [gid]: snap } : c));
                delete pvpDicePlaceRevertRef.current[gid];
            };

            const revertPvpPlaceStoneSnapshot = () => {
                const gid =
                    action.type === 'PLACE_STONE'
                        ? (action.payload as { gameId?: string })?.gameId
                        : undefined;
                if (!gid) return;
                const snap = pvpPlaceStoneRevertRef.current[gid];
                if (!snap) return;
                setLiveGames((c) => (c[gid] ? { ...c, [gid]: snap } : c));
                delete pvpPlaceStoneRevertRef.current[gid];
            };

            const revertPveResignOptimistic = () => {
                const entry = pveResignOptimisticRevertRef.current;
                if (!entry) return;
                pveResignOptimisticRevertRef.current = null;
                const { gameId, bucket, snapshot } = entry;
                if (bucket === 'singleplayer') {
                    setSinglePlayerGames((c) => (c[gameId] ? { ...c, [gameId]: snapshot } : c));
                } else {
                    setTowerGames((c) => (c[gameId] ? { ...c, [gameId]: snapshot } : c));
                }
            };

            if (dicePlaceGameId && action.type === 'DICE_PLACE_STONE') {
                const gid = dicePlaceGameId;
                const beforePlaceGame = liveGamesRef.current[gid];
                const isAiDiceBatchMode = !!(
                    beforePlaceGame &&
                    isSessionStrategicAiLike(beforePlaceGame) &&
                    beforePlaceGame.mode === GameMode.Dice &&
                    beforePlaceGame.gameStatus === 'dice_placing' &&
                    !((action as { payload?: { __forceSingle?: boolean } }).payload?.__forceSingle)
                );
                // 같은 턴에 여러 번 착수할 때도 매 클릭마다 낙관적 반영 (이전에는 inFlight>0이면 스킵되어 두 번째 돌부터 화면이 멈춤)
                let optimisticDiceGameAfterPlace: LiveGameSession | null = null;
                flushSync(() => {
                    setLiveGames((currentGames) => {
                        const g = currentGames[gid];
                        if (!g || isSessionSingleOrTower(g) || g.gameStatus !== 'dice_placing') {
                            return currentGames;
                        }
                        if ((g.stonesToPlace ?? 0) <= 0) return currentGames;
                        const { x, y } = (action as { payload: { x: number; y: number } }).payload;
                        if (!isDiceGoLibertyPlacement(g, x, y)) return currentGames;
                        const snap = JSON.parse(JSON.stringify(g)) as LiveGameSession;
                        // 주사위 턴 내 착수는 서버 moveHistory에 수마다 push되지만, 클라 낙관은 moveHistory를 늘리지 않아
                        // ko 판정용 길이는 moveHistory + 이번 턴에 이미 둔 수(stonesPlacedThisTurn)와 맞춰야 한다.
                        const remStones = g.stonesToPlace ?? 0;
                        const prevPlaced = g.stonesPlacedThisTurn || [];
                        const dice1 = g.dice?.dice1;
                        // 이전 턴의 stonesPlacedThisTurn이 GAME_UPDATE 병합 등으로 남으면 두 번째 턴부터 ko 길이가 틀어져
                        // 착수가 전부 무효로 떨어지다가 마지막에만 맞는 것처럼 보일 수 있다. (이미 둔 수 + 남은 수 === 주사위)
                        let basePlaced = prevPlaced;
                        if (typeof dice1 === 'number' && dice1 > 0 && remStones > 0) {
                            if (prevPlaced.length + remStones !== dice1) {
                                basePlaced = [];
                            }
                        }
                        const effectiveMoveLenForKo = (g.moveHistory?.length ?? 0) + basePlaced.length;
                        const pm = processMoveClient(
                            g.boardState,
                            { x, y, player: Player.Black },
                            g.koInfo ?? null,
                            effectiveMoveLenForKo,
                            { ignoreSuicide: true }
                        );
                        if (!pm.isValid) return currentGames;
                        const clearedStalePlaced = basePlaced.length === 0 && prevPlaced.length > 0;
                        const turnCaptureBase = clearedStalePlaced ? 0 : (g.diceCapturesThisTurn || 0);
                        // AI 주사위 바둑은 턴 단위 배치 전송 + 서버 재동기화를 사용하므로
                        // 클릭 즉시성 확보를 위해 비싼 deep clone 스냅샷을 생략한다.
                        if (!isAiDiceBatchMode) {
                            pvpDicePlaceRevertRef.current[gid] = snap;
                        }
                        const newBoard = pm.newBoardState.map((row) => [...row]);
                        const nextStones = (g.stonesToPlace ?? 1) - 1;
                        const placed = [...basePlaced, { x, y }];
                        const isLastPlacementInTurn = nextStones <= 0;
                        const optimisticJustCaptured =
                            isLastPlacementInTurn && pm.capturedStones.length > 0
                                ? [{
                                    point: pm.capturedStones[pm.capturedStones.length - 1],
                                    player: Player.White,
                                    wasHidden: false,
                                    capturePoints: pm.capturedStones.length,
                                }]
                                : [];
                        const nextDiceSession: LiveGameSession = {
                            ...g,
                            boardState: newBoard,
                            koInfo: pm.newKoInfo,
                            lastMove: { x, y },
                            stonesToPlace: nextStones,
                            stonesPlacedThisTurn: placed,
                            diceCapturesThisTurn: turnCaptureBase + pm.capturedStones.length,
                            justCaptured: optimisticJustCaptured,
                        };
                        optimisticDiceGameAfterPlace = nextDiceSession;
                        return {
                            ...currentGames,
                            [gid]: nextDiceSession,
                        };
                    });
                });

                if (isAiDiceBatchMode) {
                    const { x, y } = (action as { payload: { x: number; y: number } }).payload;
                    if (!aiDicePlaceBatchRef.current[gid]) aiDicePlaceBatchRef.current[gid] = [];
                    if (!aiDicePlaceBatchRef.current[gid].length) {
                        aiDiceTurnPlaceQuotaRef.current[gid] = Math.max(1, beforePlaceGame?.stonesToPlace ?? 1);
                    }
                    aiDicePlaceBatchRef.current[gid].push({ x, y });
                    const turnQuota = aiDiceTurnPlaceQuotaRef.current[gid] ?? Math.max(1, beforePlaceGame?.stonesToPlace ?? 1);
                    const shouldFlushNow = aiDicePlaceBatchRef.current[gid].length >= turnQuota;
                    if (shouldFlushNow) {
                        const placements = aiDicePlaceBatchRef.current[gid] || [];
                        delete aiDicePlaceBatchRef.current[gid];
                        delete aiDiceTurnPlaceQuotaRef.current[gid];
                        const batchResult = await handleAction({
                            type: 'DICE_PLACE_STONES_BATCH',
                            payload: { gameId: gid, placements },
                        } as any);
                        // 서버가 배치 액션을 모르는 구버전 경로(400: Unknown social action 등)면 단건으로 자동 폴백
                        if ((batchResult as any)?.error) {
                            for (const p of placements) {
                                await handleAction({
                                    type: 'DICE_PLACE_STONE',
                                    payload: { gameId: gid, x: p.x, y: p.y, __forceSingle: true },
                                } as any);
                            }
                            return {
                                clientResponse: {
                                    game: optimisticDiceGameAfterPlace ?? liveGamesRef.current[gid],
                                },
                            } as HandleActionResult;
                        }
                        return batchResult;
                    }
                    return {
                        clientResponse: {
                            game: optimisticDiceGameAfterPlace ?? liveGamesRef.current[gid],
                        },
                    } as HandleActionResult;
                }
            } else if (dicePlaceGameId && action.type === 'THIEF_PLACE_STONE') {
                const gid = dicePlaceGameId;
                flushSync(() => {
                    setLiveGames((currentGames) => {
                        const g = currentGames[gid];
                        if (!g || isSessionSingleOrTower(g) || g.gameStatus !== 'thief_placing') {
                            return currentGames;
                        }
                        if ((g.stonesToPlace ?? 0) <= 0) return currentGames;
                        const uid = currentUserRef.current?.id;
                        if (!uid) return currentGames;
                        const { x, y } = (action as { payload: { x: number; y: number } }).payload;
                        if (!isThiefGoValidPlacement(g, x, y, uid)) return currentGames;

                        const myPlayerEnum =
                            uid === g.blackPlayerId
                                ? Player.Black
                                : uid === g.whitePlayerId
                                  ? Player.White
                                  : Player.None;
                        if (myPlayerEnum === Player.None || myPlayerEnum !== g.currentPlayer) return currentGames;

                        const snap = JSON.parse(JSON.stringify(g)) as LiveGameSession;
                        pvpDicePlaceRevertRef.current[gid] = snap;

                        const prevPlaced = g.stonesPlacedThisTurn || [];
                        const effectiveMoveLenForKo = (g.moveHistory?.length ?? 0) + prevPlaced.length;
                        const pm = processMoveClient(
                            g.boardState,
                            { x, y, player: myPlayerEnum },
                            g.koInfo ?? null,
                            effectiveMoveLenForKo,
                            { ignoreSuicide: true }
                        );
                        if (!pm.isValid) return currentGames;

                        const nextStones = (g.stonesToPlace ?? 1) - 1;
                        const placed = [...prevPlaced, { x, y }];
                        const isPolice = myPlayerEnum === Player.White;
                        const nextThiefCaptures =
                            isPolice && pm.capturedStones.length > 0
                                ? (g.thiefCapturesThisRound ?? 0) + pm.capturedStones.length
                                : (g.thiefCapturesThisRound ?? 0);

                        const blackLeftAfter = pm.newBoardState.flat().filter((c) => c === Player.Black).length;
                        const allThievesCaptured = blackLeftAfter === 0 && isPolice;
                        const resolvedStonesToPlace = allThievesCaptured ? 0 : nextStones;

                        const nextScores = { ...(g.scores ?? {}) };
                        if (isPolice && pm.capturedStones.length > 0 && g.policePlayerId) {
                            nextScores[g.policePlayerId] = (nextScores[g.policePlayerId] ?? 0) + pm.capturedStones.length;
                        }

                        const nextThiefSession: LiveGameSession = {
                            ...g,
                            boardState: pm.newBoardState.map((row) => [...row]),
                            koInfo: pm.newKoInfo,
                            lastMove: { x, y },
                            stonesToPlace: resolvedStonesToPlace,
                            stonesPlacedThisTurn: placed,
                            thiefCapturesThisRound: nextThiefCaptures,
                            scores: nextScores,
                        };
                        return { ...currentGames, [gid]: nextThiefSession };
                    });
                });
            } else if (action.type === 'ALKKAGI_PLACE_STONE') {
                const gid = (action.payload as { gameId?: string; point?: Point })?.gameId;
                const point = (action.payload as { point?: Point })?.point;
                if (gid && point) {
                    flushSync(() => {
                        setLiveGames((currentGames) => {
                            const g = currentGames[gid];
                            if (!g || isSessionSingleOrTower(g) || g.mode !== GameMode.Alkkagi) return currentGames;
                            const uid = currentUserRef.current?.id;
                            if (!uid) return currentGames;
                            const next = applyOptimisticAlkkagiPlaceStone(g, uid, point);
                            if (!next) return currentGames;
                            pvpDicePlaceRevertRef.current[gid] = JSON.parse(JSON.stringify(g)) as LiveGameSession;
                            return { ...currentGames, [gid]: next };
                        });
                    });
                }
            }

            if (dicePlaceGameId) {
                pvpDicePlaceInFlightRef.current[dicePlaceGameId] =
                    (pvpDicePlaceInFlightRef.current[dicePlaceGameId] || 0) + 1;
            }

            const actionPayload = (action as any).payload as { gameId?: string; x?: number; y?: number } | undefined;
            const actionGameId = actionPayload?.gameId;
            const isAiSyncAction =
                (action.type === 'REQUEST_SERVER_AI_MOVE' || action.type === 'REQUEST_GAME_STATE_SYNC') &&
                typeof actionGameId === 'string' &&
                actionGameId.length > 0;
            const isPlaceStoneAction =
                action.type === 'PLACE_STONE' &&
                typeof actionGameId === 'string' &&
                actionGameId.length > 0 &&
                typeof actionPayload?.x === 'number' &&
                typeof actionPayload?.y === 'number';
            const placeStoneDedupeKey = isPlaceStoneAction
                ? `${actionGameId}:${actionPayload!.x},${actionPayload!.y}`
                : null;
            if (isAiSyncAction) {
                const aiSyncDedupeKey = `${action.type}:${actionGameId}`;
                if (inFlightAiSyncActionRef.current.has(aiSyncDedupeKey)) {
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`[handleAction] Duplicate in-flight AI sync action skipped: ${aiSyncDedupeKey}`);
                    }
                    return;
                }
                inFlightAiSyncActionRef.current.add(aiSyncDedupeKey);
            }
            if (placeStoneDedupeKey) {
                if (inFlightPlaceStoneActionRef.current.has(placeStoneDedupeKey)) {
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`[handleAction] Duplicate in-flight PLACE_STONE skipped: ${placeStoneDedupeKey}`);
                    }
                    return;
                }
                inFlightPlaceStoneActionRef.current.add(placeStoneDedupeKey);
            }

            const confirmAiLobbyGameId =
                action.type === 'CONFIRM_AI_GAME_START'
                    ? ((action.payload as { gameId?: string } | undefined)?.gameId ?? null)
                    : null;
            if (confirmAiLobbyGameId) {
                if (aiLobbyStartConfirmGameId === confirmAiLobbyGameId) {
                    return;
                }
                const existingLobbyGame = liveGamesRef.current[confirmAiLobbyGameId];
                const optimisticLobbyGame =
                    existingLobbyGame && buildOptimisticAiLobbyStartSession(existingLobbyGame);
                if (existingLobbyGame) {
                    aiLobbyStartRevertRef.current = {
                        gameId: confirmAiLobbyGameId,
                        snapshot: JSON.parse(JSON.stringify(existingLobbyGame)) as LiveGameSession,
                    };
                }
                flushSync(() => {
                    setAiLobbyStartConfirmGameId(confirmAiLobbyGameId);
                    if (optimisticLobbyGame) {
                        setLiveGames((current) => ({
                            ...current,
                            [confirmAiLobbyGameId]: optimisticLobbyGame,
                        }));
                    }
                });
            }

            if (action.type === 'USE_CONDITION_POTION') {
                const potionPayload = (action as { payload?: unknown }).payload as
                    | {
                          potionType?: string;
                          tournamentType?: 'neighborhood' | 'national' | 'world';
                          versusVenue?: 'pvp' | 'pet' | 'petpair';
                      }
                    | undefined;
                return (await executeUseConditionPotionAction(
                    {
                        getCurrentUser: () => currentUserRef.current,
                        applyUserUpdate,
                        showError,
                        markConnectionRestored,
                        useInFlightRef: useConditionPotionInFlightRef,
                        lastHttpActionTypeRef: lastHttpActionType,
                        lastHttpUpdateTimeRef: lastHttpUpdateTime,
                        lastHttpHadUpdatedUserRef: lastHttpHadUpdatedUser,
                    },
                    potionPayload ?? {},
                )) as HandleActionResult;
            }

            const res = await fetch(getApiUrl('/api/action'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ ...action, userId: currentUserRef.current.id }),
            });

            if (!res.ok) {
                let errorMessage = 'An unknown error occurred.';
                let baseStoneColorSubmitBenign400 = false;
                let pairTrainingClaimAlreadyClaimedBenign400 = false;
                try {
                    const errorData = await res.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                    baseStoneColorSubmitBenign400 =
                        action.type === 'SUBMIT_BASE_STONE_COLOR_CHOICE' &&
                        res.status === 400 &&
                        typeof errorMessage === 'string' &&
                        isBaseStoneColorChoiceBenignError(errorMessage);
                    pairTrainingClaimAlreadyClaimedBenign400 =
                        action.type === 'PAIR_PET_CLAIM_TRAINING' &&
                        res.status === 400 &&
                        typeof errorMessage === 'string' &&
                        errorMessage === PAIR_TRAINING_CLAIM_ALREADY_CLAIMED_ERROR;
                    if (isTransientServerStatus(res.status)) {
                        setConnectionNotice({
                            kind: 'degraded',
                            message: tx('common:connection.serverDelayed'),
                            severity: 'warning',
                        });
                    }
                    const isStaleGameStateSync =
                        action.type === 'REQUEST_GAME_STATE_SYNC' &&
                        res.status === 400 &&
                        typeof errorMessage === 'string' &&
                        /game not found/i.test(errorMessage);
                    if (isStaleGameStateSync) {
                        if (import.meta.env.DEV) {
                            console.debug(
                                `[handleAction] ${action.type} - server has no game (ended/removed); dropping local copy if any:`,
                                { gameId: actionGameId, errorData }
                            );
                        }
                        if (typeof actionGameId === 'string' && actionGameId.length > 0) {
                            setLiveGames((c) => {
                                if (!c[actionGameId]) return c;
                                const next = { ...c };
                                delete next[actionGameId];
                                return next;
                            });
                        }
                        revertPvpDicePlaceSnapshot();
                        revertPvpPlaceStoneSnapshot();
                        rollbackTowerAddTurnOptimistic();
                        revertPveResignOptimistic();
                        return { error: errorMessage } as HandleActionResult;
                    }
                    // 장시간 유휴 후 주사위/도둑 상태가 어긋난 경우:
                    // 굴림 400을 받으면 서버 상태를 1회 동기화한 뒤 자동 재시도한다.
                    const isDiceRollOutOfSync =
                        (action.type === 'DICE_ROLL' || action.type === 'THIEF_ROLL_DICE') &&
                        res.status === 400 &&
                        typeof errorMessage === 'string' &&
                        (/Not in dice rolling phase/i.test(errorMessage) ||
                            /Not your turn to roll/i.test(errorMessage));
                    const hasRetriedAfterSync = !!(action as { payload?: { __diceRollRetriedAfterSync?: boolean } }).payload
                        ? !!(action as { payload?: { __diceRollRetriedAfterSync?: boolean } }).payload?.__diceRollRetriedAfterSync
                        : false;
                    if (isDiceRollOutOfSync && !hasRetriedAfterSync) {
                        const payloadGameId = (action as { payload?: { gameId?: string } }).payload?.gameId;
                        if (payloadGameId) {
                            const syncResult = await handleAction({
                                type: 'REQUEST_GAME_STATE_SYNC',
                                payload: { gameId: payloadGameId },
                            } as ServerAction);
                            if (!(syncResult as any)?.error) {
                                const synced = liveGamesRef.current[payloadGameId];
                                const rollModeOk =
                                    (action.type === 'DICE_ROLL' && synced?.mode === GameMode.Dice) ||
                                    (action.type === 'THIEF_ROLL_DICE' && synced?.mode === GameMode.Thief);
                                if (rollModeOk && synced) {
                                    const me = currentUserRef.current.id;
                                    const myPlayerEnum =
                                        synced.blackPlayerId === me
                                            ? Player.Black
                                            : synced.whitePlayerId === me
                                              ? Player.White
                                              : Player.None;
                                    const isMyTurnAfterSync = myPlayerEnum !== Player.None && synced.currentPlayer === myPlayerEnum;
                                    const rollingStatusOk =
                                        (action.type === 'DICE_ROLL' && synced.gameStatus === 'dice_rolling') ||
                                        (action.type === 'THIEF_ROLL_DICE' && synced.gameStatus === 'thief_rolling');
                                    if (rollingStatusOk && isMyTurnAfterSync) {
                                        revertPvpDicePlaceSnapshot();
                                        revertPvpPlaceStoneSnapshot();
                                        rollbackTowerAddTurnOptimistic();
                                        revertPveResignOptimistic();
                                        return await handleAction({
                                            ...action,
                                            payload: {
                                                gameId: payloadGameId,
                                                ...((action as { payload?: Record<string, unknown> }).payload ?? {}),
                                                __diceRollRetriedAfterSync: true,
                                            },
                                        } as unknown as ServerAction);
                                    }
                                }
                            }
                        }
                    }
                    if (!baseStoneColorSubmitBenign400 && !pairTrainingClaimAlreadyClaimedBenign400) {
                        console.error(`[handleAction] ${action.type} - HTTP ${res.status} error:`, errorData);
                    }
                } catch (parseError) {
                    console.error(`[handleAction] ${action.type} - Failed to parse error response:`, parseError);
                    errorMessage = tx('common:errors.serverErrorWithStatus', { status: res.status });
                }
                // 베이스 선호: 직후 틱이 단계를 넘기거나 이중 전송 시 400이 나올 수 있음 — 조용히 동기화만
                if (baseStoneColorSubmitBenign400) {
                    const gid = (action as { payload?: { gameId?: string } }).payload?.gameId;
                    if (typeof gid === 'string' && gid.length > 0) {
                        void handleAction({ type: 'REQUEST_GAME_STATE_SYNC', payload: { gameId: gid } } as ServerAction);
                    }
                    if (import.meta.env.DEV) {
                        console.debug(`[handleAction] SUBMIT_BASE_STONE_COLOR_CHOICE benign HTTP 400:`, errorMessage);
                    }
                    revertPvpDicePlaceSnapshot();
                    revertPvpPlaceStoneSnapshot();
                    rollbackTowerAddTurnOptimistic();
                    revertPveResignOptimistic();
                    revertAiLobbyStartOptimistic();
                    return {} as HandleActionResult;
                }
                // 401 에러는 특별 처리 (인증 문제)
                if (res.status === 401) {
                    if (import.meta.env.DEV) {
                        console.warn(`[handleAction] ${action.type} - Authentication failed, user may not be logged in`);
                    }
                    // ENTER_TOURNAMENT_VIEW 같은 경우는 사용자가 아직 로드되지 않았을 수 있으므로
                    // 에러를 표시하지 않고 조용히 무시
                    if (action.type !== 'ENTER_TOURNAMENT_VIEW' && action.type !== 'LEAVE_TOURNAMENT_VIEW') {
                        showError(tx('auth:loginRequired'));
                    }
                    revertPvpDicePlaceSnapshot();
                    revertPvpPlaceStoneSnapshot();
                    rollbackTowerAddTurnOptimistic();
                    revertPveResignOptimistic();
                    revertAiLobbyStartOptimistic();
                    return;
                }
                if (typeof errorMessage === 'string' && isOpponentInsufficientActionPointsError(errorMessage)) {
                    setIsOpponentInsufficientActionPointsModalOpen(true);
                } else if (typeof errorMessage === 'string' && isInsufficientActionPointsServerError(errorMessage)) {
                    setIsInsufficientActionPointsModalOpen(true);
                } else if (
                    typeof errorMessage === 'string' &&
                    isPairHatcheryPetInventoryFullError(action, errorMessage)
                ) {
                    // PairPetLobbyPanel 전용 모달로만 안내
                } else if (
                    typeof errorMessage === 'string' &&
                    isChampionshipCompleteDungeonInventoryFullError(action, errorMessage)
                ) {
                    // TournamentBracket 전용 모달로만 안내
                } else if (action.type === 'PAIR_PET_RESYNC_TRAINING_SLOTS') {
                    console.warn(`[handleAction] PAIR_PET_RESYNC_TRAINING_SLOTS HTTP ${res.status}:`, errorMessage);
                } else if (pairTrainingClaimAlreadyClaimedBenign400) {
                    if (import.meta.env.DEV) {
                        console.debug(`[handleAction] PAIR_PET_CLAIM_TRAINING benign HTTP 400 (already claimed):`, errorMessage);
                    }
                } else if (!shouldSuppressModalForKoPlaceStone(action, typeof errorMessage === 'string' ? errorMessage : '')) {
                    // 길드 정보는 백그라운드 동기화 성격이 강하고, 게이트웨이/DB 지연 시 502·504가 잦음 — 상단 연결 안내만으로 충분
                    const suppressGuildInfoModal =
                        action.type === 'GET_GUILD_INFO' && isTransientServerStatus(res.status);
                    if (!suppressGuildInfoModal) {
                        showError(errorMessage);
                    }
                }
                if (action.type === 'TOGGLE_EQUIP_ITEM' || action.type === 'USE_ITEM') {
                    setUpdateTrigger(prev => prev + 1);
                }
                revertPvpDicePlaceSnapshot();
                revertPvpPlaceStoneSnapshot();
                rollbackTowerAddTurnOptimistic();
                revertPveResignOptimistic();
                revertAiLobbyStartOptimistic();

                if (action.type === 'PLACE_STONE' && res.status === 400) {
                    const syncGameId = (action.payload as { gameId?: string })?.gameId;
                    if (typeof syncGameId === 'string' && syncGameId.length > 0) {
                        const syncSession =
                            towerGamesRef.current[syncGameId] ??
                            singlePlayerGamesRef.current[syncGameId] ??
                            liveGamesRef.current[syncGameId];
                        const syncKind = syncSession
                            ? resolveArenaSessionPolicy(syncSession as any).kind
                            : undefined;
                        if (syncKind !== 'tower' && syncKind !== 'singleplayer') {
                            void handleAction({
                                type: 'REQUEST_GAME_STATE_SYNC',
                                payload: { gameId: syncGameId },
                            } as ServerAction);
                        }
                    }
                }

                const isBenignPostGameLeaveHttp400 =
                    (action.type === 'LEAVE_GAME_ROOM' || action.type === 'LEAVE_AI_GAME') &&
                    res.status === 400 &&
                    typeof errorMessage === 'string' &&
                    isGameNotFoundServerError(errorMessage);

                if (isBenignPostGameLeaveHttp400) {
                    if (import.meta.env.DEV) {
                        console.debug(
                            `[handleAction] ${action.type} benign HTTP 400 (session already cleared on server) — local lobby redirect`,
                            errorMessage,
                        );
                    }
                    const gid = (action.payload as { gameId?: string })?.gameId;
                    if (gid) {
                        try {
                            sessionStorage.removeItem(`gameState_${gid}`);
                        } catch {
                            /* ignore */
                        }
                        flushSync(() => {
                            setTowerGames((current) => {
                                if (!current[gid]) return current;
                                const next = { ...current };
                                delete next[gid];
                                return next;
                            });
                            setSinglePlayerGames((current) => {
                                if (!current[gid]) return current;
                                const next = { ...current };
                                delete next[gid];
                                return next;
                            });
                            setLiveGames((current) => {
                                if (!current[gid]) return current;
                                const next = { ...current };
                                delete next[gid];
                                return next;
                            });
                            const uid = currentUserRef.current?.id;
                            if (uid) {
                                setOnlineUsers((prev) =>
                                    prev.map((u) =>
                                        u.id === uid
                                            ? {
                                                  ...u,
                                                  status: UserStatus.Online,
                                                  gameId: undefined,
                                                  mode: undefined,
                                                  waitingLobby: undefined,
                                              }
                                            : u,
                                    ),
                                );
                            }
                        });
                    }
                    const postRedirect =
                        typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('postGameRedirect') : null;
                    if (postRedirect) {
                        sessionStorage.removeItem('postGameRedirect');
                        replaceAppHash(postRedirect);
                    }
                    return {} as HandleActionResult;
                }

                // Return error object so components can handle it
                return { error: errorMessage } as HandleActionResult;
            } else {
                markConnectionRestored();
                const result = await res.json();
                /** `message`만 있고 `success: true`인 200 응답(일부 관리/안내 API)은 성공으로 처리해야 함. 강화 등은 `enhancementOutcome`가 이 분기에서 잘리면 결과 모달이 뜨지 않음 */
                const isHttpBodyError =
                    Boolean(result.error) ||
                    result.success === false ||
                    (typeof result.message === 'string' &&
                        result.message.length > 0 &&
                        result.success !== true);
                if (isHttpBodyError) {
                    const errorMessage = result.message || result.error || tx('common:errors.serverError');
                    console.error(`[handleAction] ${action.type} - Server returned error:`, errorMessage);
                    // 상대 행동력 부족은 본인 충전 모달과 구분
                    if (typeof errorMessage === 'string' && isOpponentInsufficientActionPointsError(errorMessage)) {
                        setIsOpponentInsufficientActionPointsModalOpen(true);
                    } else if (typeof errorMessage === 'string' && isInsufficientActionPointsServerError(errorMessage)) {
                        setIsInsufficientActionPointsModalOpen(true);
                    } else if (
                        typeof errorMessage === 'string' &&
                        isPairHatcheryPetInventoryFullError(action, errorMessage)
                    ) {
                        // PairPetLobbyPanel 전용 모달로만 안내
                    } else if (
                        typeof errorMessage === 'string' &&
                        isChampionshipCompleteDungeonInventoryFullError(action, errorMessage)
                    ) {
                        // TournamentBracket 전용 모달로만 안내
                    } else if (action.type === 'PAIR_PET_RESYNC_TRAINING_SLOTS') {
                        // 페어 펫 로비 마운트 시 백그라운드 동기화 — 실패해도 전역 오류 모달은 띄우지 않음
                        console.warn('[handleAction] PAIR_PET_RESYNC_TRAINING_SLOTS failed:', errorMessage);
                    } else if (
                        (action.type === 'CONFIRM_SINGLE_PLAYER_GAME_START' ||
                            action.type === 'CONFIRM_TOWER_GAME_START') &&
                        typeof errorMessage === 'string' &&
                        isGameAlreadyStartedError(errorMessage)
                    ) {
                        // 서버는 playing·클라만 pending — Game.tsx에서 모달만 닫고 재동기화
                        console.warn(`[handleAction] ${action.type} - suppressing global error (already started resync):`, errorMessage);
                    } else if (!shouldSuppressModalForKoPlaceStone(action, typeof errorMessage === 'string' ? errorMessage : '')) {
                        showError(errorMessage);
                    }
                    revertPvpDicePlaceSnapshot();
                    revertPvpPlaceStoneSnapshot();
                    rollbackTowerAddTurnOptimistic();
                    revertPveResignOptimistic();
                    revertAiLobbyStartOptimistic();
                    return { error: errorMessage } as HandleActionResult;
                }
                if (action.type === 'EMERGENCY_EXIT') {
                    // Settings 등이 해시를 바꾸기 전에 동기 설정 — Game.tsx hash 인터셉터가 기권 확인을 띄우지 않도록
                    markSkipGameHashLeaveInterceptOnce();
                }
                if (action.type === 'RESIGN_GAME') {
                    pveResignOptimisticRevertRef.current = null;
                }
                if (action.type === 'CONFIRM_AI_GAME_START') {
                    aiLobbyStartRevertRef.current = null;
                }
                if (action.type === 'PLACE_STONE') {
                    const gid = (action.payload as { gameId?: string })?.gameId;
                    if (gid) delete pvpPlaceStoneRevertRef.current[gid];
                }
                if (action.type === 'MISSILE_ANIMATION_COMPLETE' && typeof actionGameId === 'string' && actionGameId.length > 0) {
                    setLiveGames((c) => patchLiveGameInMapById(c, actionGameId, mutateLiveMissilePresentationComplete));
                }
                const currencyCapNotices = (result as { currencyCapNotices?: unknown }).currencyCapNotices;
                if (Array.isArray(currencyCapNotices) && currencyCapNotices.length > 0) {
                    const seen = new Set<string>();
                    for (const msg of currencyCapNotices) {
                        if (typeof msg === 'string' && msg.length > 0 && !seen.has(msg)) {
                            seen.add(msg);
                            window.alert(msg);
                        }
                    }
                }
                if (action.type === 'TOWER_ADD_TURNS') {
                    const gidOk = (action.payload as { gameId?: string })?.gameId;
                    if (gidOk) {
                        const left = (towerAddTurnOptimisticPendingByGameRef.current[gidOk] || 0) - 3;
                        if (left <= 0) delete towerAddTurnOptimisticPendingByGameRef.current[gidOk];
                        else towerAddTurnOptimisticPendingByGameRef.current[gidOk] = left;
                    }
                    const authGame = (result as any)?.clientResponse?.game as { id?: string; blackTurnLimitBonus?: unknown } | undefined;
                    const gidAuth = authGame?.id || (action.payload as { gameId?: string })?.gameId;
                    if (gidAuth && typeof sessionStorage !== 'undefined') {
                        try {
                            const key = `gameState_${gidAuth}`;
                            const raw = sessionStorage.getItem(key);
                            if (raw) {
                                const parsed = JSON.parse(raw) as Record<string, unknown>;
                                if (parsed && parsed.gameId === gidAuth) {
                                    const b =
                                        authGame && authGame.blackTurnLimitBonus !== undefined && authGame.blackTurnLimitBonus !== null
                                            ? Number(authGame.blackTurnLimitBonus) || 0
                                            : undefined;
                                    if (b !== undefined) {
                                        parsed.blackTurnLimitBonus = b;
                                        parsed.timestamp = Date.now();
                                        sessionStorage.setItem(key, JSON.stringify(parsed));
                                    }
                                }
                            }
                        } catch {
                            /* ignore */
                        }
                    }
                }
                // LEAVE_AI_GAME 성공 시 로컬 상태에서 해당 게임 제거 및 사용자 gameId 해제 → 전략/놀이 대기실로 이동
                if (action.type === 'LEAVE_AI_GAME') {
                    const gameId = (action.payload as { gameId?: string })?.gameId;
                    if (gameId) {
                        try {
                            sessionStorage.removeItem(`gameState_${gameId}`);
                        } catch {
                            /* ignore */
                        }
                        // flushSync: replaceAppHash 이전에 activeGame이 null이 되도록 해야 함.
                        // 그렇지 않으면 setTimeout(0) 라우팅 직후 "대국으로 복귀" effect가 종료된 대국으로 다시 끌어당김(postGameRedirect는 이미 삭제됨).
                        flushSync(() => {
                            setTowerGames((current) => {
                                if (!current[gameId]) return current;
                                const next = { ...current };
                                delete next[gameId];
                                return next;
                            });
                            setSinglePlayerGames((current) => {
                                if (!current[gameId]) return current;
                                const next = { ...current };
                                delete next[gameId];
                                return next;
                            });
                            setLiveGames((current) => {
                                if (!current[gameId]) return current;
                                const next = { ...current };
                                delete next[gameId];
                                return next;
                            });
                            const uid = currentUserRef.current?.id;
                            if (uid) {
                                setOnlineUsers((prev) =>
                                    prev.map((u) =>
                                        u.id === uid ? { ...u, status: UserStatus.Online, gameId: undefined, mode: undefined } : u
                                    )
                                );
                            }
                        });
                    }
                    // 나가기 클릭 시 설정된 대기실로 즉시 이동 (전략바둑 → #/waiting/strategic, 놀이바둑 → #/waiting/playful 등)
                    const postRedirect = sessionStorage.getItem('postGameRedirect');
                    if (postRedirect) {
                        sessionStorage.removeItem('postGameRedirect');
                        replaceAppHash(postRedirect);
                    }
                }

                // PVP/일반전략·놀이 모드의 LEAVE_GAME_ROOM 성공 시에도 로컬 게임 상태를 정리해
                // “나가기 버튼” 클릭 후 대기실 라우팅이 정상 동작하도록 한다.
                if (action.type === 'LEAVE_GAME_ROOM') {
                    const gameId = (action.payload as { gameId?: string })?.gameId;
                    if (gameId) {
                        try {
                            sessionStorage.removeItem(`gameState_${gameId}`);
                        } catch {
                            /* ignore */
                        }

                        const g = liveGamesRef.current[gameId];
                        const retainEndedPvpRoom =
                            g &&
                            !isSessionStrategicAiLike(g) &&
                            getSessionArenaKind(g) !== 'singleplayer' &&
                            (g.gameStatus === 'ended' || g.gameStatus === 'no_contest') &&
                            !(g.settings as { pairGame?: unknown } | undefined)?.pairGame;

                        flushSync(() => {
                            const removeFromTowerSp = () => {
                                setTowerGames((current) => {
                                    if (!current[gameId]) return current;
                                    const next = { ...current };
                                    delete next[gameId];
                                    return next;
                                });
                                setSinglePlayerGames((current) => {
                                    if (!current[gameId]) return current;
                                    const next = { ...current };
                                    delete next[gameId];
                                    return next;
                                });
                            };
                            if (!retainEndedPvpRoom) {
                                removeFromTowerSp();
                                setLiveGames((current) => {
                                    if (!current[gameId]) return current;
                                    const next = { ...current };
                                    delete next[gameId];
                                    return next;
                                });
                            } else {
                                removeFromTowerSp();
                            }

                            const uid = currentUserRef.current?.id;
                            if (uid) {
                                if (retainEndedPvpRoom) {
                                    const post = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('postGameRedirect') : null;
                                    const wl: 'strategic' | 'playful' | undefined = post?.includes('/waiting/strategic')
                                        ? 'strategic'
                                        : post?.includes('/waiting/playful')
                                          ? 'playful'
                                          : SPECIAL_GAME_MODES.some((m) => m.mode === g.mode)
                                            ? 'strategic'
                                            : PLAYFUL_GAME_MODES.some((m) => m.mode === g.mode)
                                              ? 'playful'
                                              : undefined;
                                    setOnlineUsers((prev) =>
                                        prev.map((u) =>
                                            u.id === uid
                                                ? wl
                                                    ? {
                                                          ...u,
                                                          status: UserStatus.Waiting,
                                                          waitingLobby: wl,
                                                          gameId,
                                                          mode: g.mode,
                                                      }
                                                    : { ...u, status: UserStatus.Online, gameId: undefined, mode: undefined, waitingLobby: undefined }
                                                : u
                                        )
                                    );
                                } else {
                                    setOnlineUsers((prev) =>
                                        prev.map((u) =>
                                            u.id === uid
                                                ? { ...u, status: UserStatus.Online, gameId: undefined, mode: undefined, waitingLobby: undefined }
                                                : u
                                        )
                                    );
                                }
                            }
                        });
                    }

                    const postRedirect = sessionStorage.getItem('postGameRedirect');
                    if (postRedirect) {
                        sessionStorage.removeItem('postGameRedirect');
                        replaceAppHash(postRedirect);
                    }
                }
                // SPECTATE_GAME 성공 시 서버가 반환한 전체 게임 데이터를 상태에 넣고 게임 페이지로 이동 (중립 관전)
                if (action.type === 'SPECTATE_GAME') {
                    const spectateGame = result.clientResponse?.game || (result as any).game;
                    if (spectateGame?.id) {
                        const category = getSessionArenaKind(spectateGame);
                        if (category === 'tower') {
                            setTowerGames(prev => ({ ...prev, [spectateGame.id]: spectateGame }));
                        } else {
                            setLiveGames(prev => ({ ...prev, [spectateGame.id]: spectateGame }));
                        }
                        const targetHash = `#/game/${spectateGame.id}`;
                        if (window.location.hash !== targetHash) {
                            setTimeout(() => { window.location.hash = targetHash; }, 100);
                        }
                    }
                }
                // COMPLETE_DUNGEON_STAGE: 서버가 { success, ...clientResponse } 형태로 보내므로 clientResponse 없이 flat하게 옴. updatedUser를 먼저 적용해 dungeonProgress(unlockedStages, stageResults 등) 반영 후 반환.
                if (action.type === 'COMPLETE_DUNGEON_STAGE' && result && result.userRank != null) {
                    const updatedUser = result.updatedUser || (result as any).clientResponse?.updatedUser;
                    if (updatedUser) {
                        applyUserUpdate(updatedUser, 'COMPLETE_DUNGEON_STAGE-http');
                    }
                    return result as HandleActionResult;
                }
                // START_GUILD_BOSS_BATTLE: 보상(장비 등)이 인벤토리에 반영된 updatedUser를 즉시 적용해 결과창 확인 후 가방에서 획득 장비가 보이도록 함.
                if (action.type === 'START_GUILD_BOSS_BATTLE' && result && !result.error) {
                    const updatedUser = result.updatedUser || (result as any).clientResponse?.updatedUser;
                    if (updatedUser) {
                        if (updatedUser.inventory && Array.isArray(updatedUser.inventory)) {
                            updatedUser.inventory = JSON.parse(JSON.stringify(updatedUser.inventory));
                        }
                        flushSync(() => {
                            applyUserUpdate(updatedUser, 'START_GUILD_BOSS_BATTLE-http');
                            setUpdateTrigger(prev => prev + 1);
                        });
                    }
                }
                // 계가 요청 응답 처리
                if (action.type === 'REQUEST_SCORING' && result.clientResponse?.scoringAnalysis) {
                    const { scoringAnalysis } = result.clientResponse;
                    const gameId = (action.payload as any).gameId;
                    // AI 게임도 PVE로 처리하므로 singlePlayerGames에 저장
                    // 게임을 찾아서 카테고리를 확인
                    const game = towerGames[gameId] || singlePlayerGames[gameId] || liveGames[gameId];
                    const isTower = getSessionArenaKind(game) === 'tower';
                    const updateGameState = isTower ? setTowerGames : setSinglePlayerGames;
                    
                    // 게임 상태를 scoring으로 변경하고 분석 결과 저장
                    updateGameState((currentGames) => {
                        const game = currentGames[gameId];
                        if (!game) return currentGames;
                        
                        return {
                            ...currentGames,
                            [gameId]: {
                                ...game,
                                gameStatus: 'scoring' as const,
                                analysisResult: {
                                    ...game.analysisResult,
                                    [currentUserRef.current?.id || 'system']: scoringAnalysis
                                }
                            }
                        };
                    });
                    
                    // 계가 결과를 기반으로 게임 종료 처리
                    const blackTotal = scoringAnalysis.scoreDetails?.black?.total || 0;
                    const whiteTotal = scoringAnalysis.scoreDetails?.white?.total || 0;
                    const winner = blackTotal > whiteTotal ? Player.Black : (whiteTotal > blackTotal ? Player.White : Player.None);
                    
                    updateGameState((currentGames) => {
                        const game = currentGames[gameId];
                        if (!game) return currentGames;
                        
                        return {
                            ...currentGames,
                            [gameId]: {
                                ...game,
                                gameStatus: 'ended' as const,
                                winner,
                                winReason: 'score' as const,
                                finalScores: {
                                    black: blackTotal,
                                    white: whiteTotal
                                }
                            }
                        };
                    });
                    
                    const endGameActionType = isTower ? 'END_TOWER_GAME' : 'END_SINGLE_PLAYER_GAME';
                    if (isTower && winner === Player.Black) {
                        applyOptimisticTowerClearOnBlackWin(game.towerFloor, winner);
                    }
                    try {
                        await handleAction({
                            type: endGameActionType,
                            payload: {
                                gameId,
                                winner,
                                winReason: 'score',
                                ...buildPveEndGameSnapshotPayload(game),
                            }
                        } as any);
                    } catch (err) {
                        console.error(`[handleAction] Failed to end ${isTower ? 'tower' : 'single player'} game:`, err);
                    }
                    
                    return;
                }
                
                if (import.meta.env.DEV && action.type !== 'SAVE_TOURNAMENT_PROGRESS') {
                    console.debug('[handleAction] Action response received', {
                        actionType: action.type,
                        hasUpdatedUser: !!result.updatedUser || !!result.clientResponse?.updatedUser,
                        moveHistoryLength: Array.isArray((result as any).game?.moveHistory)
                            ? (result as any).game.moveHistory.length
                            : Array.isArray(result.clientResponse?.game?.moveHistory)
                              ? result.clientResponse.game.moveHistory.length
                              : undefined,
                        raw: result,
                    });
                }

                // /api/action 성공 본문은 `{ success, ...clientResponse }` 평탄화 → `game`은 최상위 `result.game`
                if (action.type === 'REQUEST_SERVER_AI_MOVE') {
                    let g = ((result as any).game || result.clientResponse?.game) as LiveGameSession | undefined;
                    const requestedGameId = (action.payload as { gameId?: string } | undefined)?.gameId;
                    // 근본 보정: AI 응답이 slim payload(성공만 반환)인 경우 즉시 게임 상태를 동기화해
                    // 다음 effect tick의 "재시도" 없이 현재 턴을 바로 반영한다.
                    if (!g && requestedGameId) {
                        try {
                            const syncRes = await fetch(getApiUrl('/api/action'), {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                    type: 'REQUEST_GAME_STATE_SYNC',
                                    payload: { gameId: requestedGameId },
                                    userId: currentUserRef.current.id,
                                }),
                            });
                            if (syncRes.ok) {
                                const syncResult = await syncRes.json();
                                const syncedGame = ((syncResult as any).game || syncResult?.clientResponse?.game) as LiveGameSession | undefined;
                                if (syncedGame?.id) {
                                    g = syncedGame;
                                    (result as any).game = syncedGame;
                                    console.log('[handleAction] REQUEST_SERVER_AI_MOVE - hydrated missing game via REQUEST_GAME_STATE_SYNC:', {
                                        gameId: syncedGame.id,
                                        moveHistoryLength: Array.isArray(syncedGame.moveHistory) ? syncedGame.moveHistory.length : undefined,
                                        currentPlayer: syncedGame.currentPlayer,
                                    });
                                } else {
                                    console.warn('[handleAction] REQUEST_SERVER_AI_MOVE - sync succeeded but game still missing:', {
                                        gameId: requestedGameId,
                                        syncKeys: syncResult && typeof syncResult === 'object' ? Object.keys(syncResult) : [],
                                    });
                                }
                            } else {
                                console.warn('[handleAction] REQUEST_SERVER_AI_MOVE - REQUEST_GAME_STATE_SYNC failed:', {
                                    gameId: requestedGameId,
                                    status: syncRes.status,
                                });
                            }
                        } catch (syncError) {
                            console.warn('[handleAction] REQUEST_SERVER_AI_MOVE - sync hydration error:', {
                                gameId: requestedGameId,
                                error: syncError,
                            });
                        }
                    }
                    const gid = g?.id;
                    if (gid && g) {
                        const prevG =
                            towerGamesRef.current[gid] ??
                            singlePlayerGamesRef.current[gid] ??
                            liveGamesRef.current[gid];
                        const boardClone =
                            g.boardState && Array.isArray(g.boardState)
                                ? (g.boardState as number[][]).map((row) => [...row])
                                : g.boardState;
                        let merged = { ...g, boardState: boardClone } as LiveGameSession;
                        if (
                            (merged.animation as { type?: string } | undefined)?.type === 'ai_thinking' &&
                            prevG &&
                            (!merged.boardState ||
                                !Array.isArray(merged.boardState) ||
                                merged.boardState.length === 0)
                        ) {
                            merged = {
                                ...merged,
                                boardState: prevG.boardState,
                                moveHistory:
                                    Array.isArray(prevG.moveHistory) && prevG.moveHistory.length > 0
                                        ? prevG.moveHistory
                                        : merged.moveHistory,
                            };
                        }
                        const mh = merged.moveHistory;
                        if (Array.isArray(mh) && mh.length > 0) {
                            for (let i = mh.length - 1; i >= 0; i--) {
                                const m = mh[i] as { x?: number; y?: number } | undefined;
                                if (
                                    m &&
                                    typeof m.x === 'number' &&
                                    typeof m.y === 'number' &&
                                    m.x >= 0 &&
                                    m.y >= 0
                                ) {
                                    merged.lastMove = { x: m.x, y: m.y };
                                    break;
                                }
                            }
                        }
                        const cat = String((g as any).gameCategory ?? '');
                        // PVE 유저 수는 클라에서만 serverRevision을 올리고, 서버는 saveGame 1회로 맞춰져
                        // 같은 값이면 Game.tsx 보드 잠금(serverRevision 증가)이 풀리지 않음 → 한 단계 강제 상승
                        const ensureAiHttpRevisionAdvances = (
                            prevSession: LiveGameSession | undefined,
                            session: LiveGameSession,
                        ): LiveGameSession => {
                            if (!prevSession) return session;
                            const prevRev = prevSession.serverRevision ?? 0;
                            const incomingRev = session.serverRevision ?? 0;
                            const maxRev = Math.max(prevRev, incomingRev);
                            const serverRevision = maxRev > prevRev ? maxRev : prevRev + 1;
                            return serverRevision === (session.serverRevision ?? 0)
                                ? session
                                : { ...session, serverRevision };
                        };
                        if (cat === 'tower') {
                            setTowerGames((prev) => {
                                const prevG = prev[gid];
                                let next = ensureAiHttpRevisionAdvances(
                                    prevG,
                                    mergePveHttpActionGameResponse(merged, prevG, action.type),
                                );
                                if (
                                    action.type === 'PLACE_STONE' &&
                                    !!(action.payload as { isHidden?: boolean })?.isHidden &&
                                    prevG
                                ) {
                                    next = mergeTowerServerGameWithClientBoardIfStale(next, prevG);
                                }
                                return { ...prev, [gid]: { ...(prevG || ({} as LiveGameSession)), ...next } };
                            });
                        } else if (cat === 'singleplayer' || getSessionArenaKind(g) === 'singleplayer') {
                            setSinglePlayerGames((prev) => {
                                const prevG = prev[gid];
                                const next = ensureAiHttpRevisionAdvances(
                                    prevG,
                                    mergePveHttpActionGameResponse(merged, prevG, action.type),
                                );
                                return { ...prev, [gid]: { ...(prevG || ({} as LiveGameSession)), ...next } };
                            });
                        } else {
                            setLiveGames((prev) => {
                                const prevG = prev[gid];
                                let liveMerged = mergePveHttpActionGameResponse(merged, prevG, action.type);
                                if (liveMerged.mode === GameMode.Chess) {
                                    liveMerged = normalizeChessGoSession(liveMerged);
                                }
                                return { ...prev, [gid]: { ...(prevG || ({} as LiveGameSession)), ...liveMerged } };
                            });
                        }
                    }
                }

                if (action.type === 'ADMIN_TOGGLE_GAME_MODE' && (result.gameModeAvailability ?? result.clientResponse?.gameModeAvailability)) {
                    setGameModeAvailability(result.gameModeAvailability ?? result.clientResponse.gameModeAvailability);
                }
                if (action.type === 'ADMIN_TOGGLE_ARENA_ENTRANCE' && (result.arenaEntranceAvailability ?? result.clientResponse?.arenaEntranceAvailability)) {
                    setArenaEntranceAvailability(
                        mergeArenaEntranceAvailability(
                            result.arenaEntranceAvailability ?? result.clientResponse.arenaEntranceAvailability,
                        ),
                    );
                }
                if (
                    (action.type === 'ADMIN_PATCH_KATA_SERVER_RUNTIME' || action.type === 'ADMIN_RESET_KATA_SERVER_RUNTIME') &&
                    result.clientResponse?.kataServerRuntimeConfig
                ) {
                    setKataServerRuntimeConfig(result.clientResponse.kataServerRuntimeConfig as KataServerRuntimeSnapshot);
                }
                if (
                    (action.type === 'ADMIN_SET_CHAMPIONSHIP_ABILITY_KATA_LADDER' ||
                        action.type === 'ADMIN_RESET_CHAMPIONSHIP_ABILITY_KATA_LADDER') &&
                    result.clientResponse?.championshipAbilityKataLadder
                ) {
                    setChampionshipAbilityKataLadder(result.clientResponse.championshipAbilityKataLadder);
                }

                // CONFIRM_TOWER_GAME_START 액션에 대한 상세 로깅
                if (action.type === 'CONFIRM_TOWER_GAME_START') {
                    const responseGameId = result.clientResponse?.gameId || (result as any).gameId;
                    const responseGame = result.clientResponse?.game || (result as any).game;
                    console.log(`[handleAction] CONFIRM_TOWER_GAME_START - Full response:`, {
                        result,
                        hasClientResponse: !!result.clientResponse,
                        gameId: responseGameId,
                        hasGame: !!responseGame,
                        game: responseGame,
                        gameStatus: responseGame?.gameStatus,
                        gameCategory: responseGame?.gameCategory,
                    });
                    
                    // gameId가 없으면 경고
                    if (!responseGameId) {
                        console.warn('[handleAction] CONFIRM_TOWER_GAME_START - No gameId in response!', result);
                    }
                    // game 객체가 없으면 경고
                    if (!responseGame) {
                        console.warn('[handleAction] CONFIRM_TOWER_GAME_START - No game object in response!', result);
                    }
                }
                
                const quietActionLogs = new Set([
                    'SAVE_TOURNAMENT_PROGRESS',
                    'ENTER_TOURNAMENT_VIEW',
                    'LEAVE_TOURNAMENT_VIEW',
                ]);
                if (import.meta.env.DEV && !quietActionLogs.has(action.type)) {
                    console.log(`[handleAction] ${action.type} - Response received:`, {
                        hasUpdatedUser: !!result.updatedUser,
                        hasClientResponse: !!result.clientResponse,
                        hasClientResponseUpdatedUser: !!result.clientResponse?.updatedUser,
                        hasRedirectToTournament: !!result.clientResponse?.redirectToTournament,
                        redirectToTournament: result.clientResponse?.redirectToTournament || result.redirectToTournament,
                        hasObtainedItemsBulk: !!result.obtainedItemsBulk,
                        hasClientResponseObtainedItemsBulk: !!result.clientResponse?.obtainedItemsBulk,
                        hasRewardSummary: !!result.rewardSummary,
                        hasDisassemblyResult: !!result.disassemblyResult,
                        hasCombinationResult: !!result.combinationResult,
                        hasEnhancementOutcome: !!result.enhancementOutcome,
                        hasCraftResult: !!result.craftResult,
                        resultKeys: Object.keys(result),
                        clientResponseKeys: result.clientResponse ? Object.keys(result.clientResponse) : [],
                        fullResult: result
                    });
                }
                
                // 서버 응답 구조: { success: true, ...result.clientResponse }
                // 따라서 result.updatedUser 또는 result.clientResponse?.updatedUser 확인
                let updatedUserFromResponse = result.updatedUser || result.clientResponse?.updatedUser;
                const deferUpdatedUserUntilLocalReveal = action.type === 'START_CHAMPIONSHIP_VERSUS_KATA_DUEL';
                if (deferUpdatedUserUntilLocalReveal) {
                    updatedUserFromResponse = undefined;
                }

                if (
                    updatedUserFromResponse &&
                    action.type === 'BUY_CONDITION_POTION' &&
                    Array.isArray(updatedUserFromResponse.inventory)
                ) {
                    updatedUserFromResponse = stripInventoryIfFewerConditionPotions(
                        updatedUserFromResponse,
                        currentUserRef.current?.inventory,
                    );
                }
                
                if (updatedUserFromResponse) {
                    // 인벤토리 변경을 확실히 반영해야 하는 액션들
                    const inventoryCriticalActions = [
                        'CLAIM_MAIL_ATTACHMENTS',
                        'CLAIM_ALL_MAIL_ATTACHMENTS',
                        'CLAIM_QUEST_REWARD',
                        'CLAIM_TOURNAMENT_REWARD',
                        'CLAIM_ACTIVITY_MILESTONE',
                        'CLAIM_SINGLE_PLAYER_MISSION_REWARD',
                        'CLAIM_SINGLE_PLAYER_CLASS_BAR_REWARD',
                        'CLAIM_ALL_TRAINING_QUEST_REWARDS',
                        'SINGLE_PLAYER_REFRESH_PLACEMENT',
                        'TOWER_REFRESH_PLACEMENT',
                        'TOWER_ADD_TURNS',
                        'COMPLETE_DUNGEON_STAGE',
                        'BUY_SHOP_ITEM',
                        'BUY_CHAMPIONSHIP_SHOP_ITEM',
                        'BUY_MATERIAL_BOX',
                        'BUY_CASH_PACKAGE',
                        'BUY_VIP_PACKAGE',
                        'CANCEL_VIP_SHOP_AUTO_RENEW',
                        'ADMIN_SET_DIAMOND_PACKAGE_TEST',
                        'BUY_CONSUMABLE',
                        'BUY_CONDITION_POTION',
                        'USE_CONDITION_POTION',
                        'BUY_BORDER',
                        'BUY_TOWER_ITEM',
                        'CLAIM_SHOP_AD_REWARD',
                        'SAVE_EXCHANGE_STATE',
                        'CLAIM_EXCHANGE_SETTLEMENT',
                        'PURCHASE_EXCHANGE_LISTING',
                        'ENHANCE_ITEM',
                        'DISASSEMBLE_ITEM',
                        'COMBINE_ITEMS',
                        'CRAFT_MATERIAL',
                        'EXPAND_INVENTORY',
                        'TOGGLE_EQUIP_ITEM',
                        'UNBIND_EQUIPMENT',
                        'SELL_ITEM',
                        'MARK_ITEM_EXCHANGE_LISTED',
                        'UNMARK_ITEM_EXCHANGE_LISTED',
                        'MANNER_ACTION',
                        'START_GUILD_BOSS_BATTLE',
                        'END_TOWER_GAME',
                        'PAIR_PET_PURCHASE',
                        'PAIR_PET_HATCH_EGG',
                        'PAIR_PET_CONVERT_PET',
                        'PAIR_PET_SET_EQUIPPED',
                        'PAIR_PET_EXPAND_LOBBY_SLOTS',
                        'PAIR_PET_START_TRAINING',
                        'PAIR_PET_CANCEL_TRAINING',
                        'PAIR_PET_CLAIM_TRAINING',
                        'PAIR_PET_RESYNC_TRAINING_SLOTS',
                        'PAIR_PET_HATCHERY_UNLOCK',
                        'PAIR_PET_HATCHERY_START',
                        'PAIR_PET_HATCHERY_CLAIM',
                        'PAIR_PET_HATCHERY_CANCEL',
                        'PAIR_PET_HATCHERY_INSTANT_FINISH',
                        'PAIR_PET_UPGRADE_GRADE',
                    ];
                    const isInventoryCriticalAction = inventoryCriticalActions.includes(action.type);
                    
                    if (isInventoryCriticalAction && updatedUserFromResponse.inventory) {
                        // 서버 selective update가 이미 deepClone — 펫 수련은 추가 전체 복제 생략
                        if (
                            action.type !== 'PAIR_PET_CLAIM_TRAINING' &&
                            action.type !== 'PAIR_PET_START_TRAINING' &&
                            !shopPurchaseActionTypes.has(action.type)
                        ) {
                            updatedUserFromResponse.inventory = JSON.parse(JSON.stringify(updatedUserFromResponse.inventory));
                        }
                        console.log(`[handleAction] ${action.type} - Forcing inventory update`, {
                            inventoryLength: updatedUserFromResponse.inventory?.length,
                            inventoryItems: updatedUserFromResponse.inventory?.slice(0, 3).map((i: any) => i.name)
                        });
                    }

                    if (
                        isInventoryCriticalAction &&
                        Array.isArray((updatedUserFromResponse as { pairPetTrainingSlots?: unknown }).pairPetTrainingSlots)
                    ) {
                        try {
                            (updatedUserFromResponse as { pairPetTrainingSlots: unknown }).pairPetTrainingSlots = JSON.parse(
                                JSON.stringify((updatedUserFromResponse as { pairPetTrainingSlots: unknown[] }).pairPetTrainingSlots)
                            );
                        } catch (e) {
                            console.warn(`[handleAction] ${action.type} - Failed to deep copy pairPetTrainingSlots`, e);
                        }
                    }

                    if (
                        isInventoryCriticalAction &&
                        Array.isArray((updatedUserFromResponse as { pairPetHatcherySessions?: unknown }).pairPetHatcherySessions)
                    ) {
                        try {
                            (updatedUserFromResponse as { pairPetHatcherySessions: unknown }).pairPetHatcherySessions = JSON.parse(
                                JSON.stringify((updatedUserFromResponse as { pairPetHatcherySessions: unknown[] }).pairPetHatcherySessions)
                            );
                        } catch (e) {
                            console.warn(`[handleAction] ${action.type} - Failed to deep copy pairPetHatcherySessions`, e);
                        }
                    }

                    if (
                        isInventoryCriticalAction &&
                        Array.isArray((updatedUserFromResponse as { pairPetHatcherySlotUnlocked?: unknown }).pairPetHatcherySlotUnlocked)
                    ) {
                        try {
                            (updatedUserFromResponse as { pairPetHatcherySlotUnlocked: unknown }).pairPetHatcherySlotUnlocked = JSON.parse(
                                JSON.stringify((updatedUserFromResponse as { pairPetHatcherySlotUnlocked: unknown[] }).pairPetHatcherySlotUnlocked)
                            );
                        } catch (e) {
                            console.warn(`[handleAction] ${action.type} - Failed to deep copy pairPetHatcherySlotUnlocked`, e);
                        }
                    }

                    if (
                        (action.type === 'CLAIM_SINGLE_PLAYER_MISSION_REWARD' ||
                            action.type === 'CLAIM_ALL_TRAINING_QUEST_REWARDS') &&
                        updatedUserFromResponse.singlePlayerMissions
                    ) {
                        try {
                            updatedUserFromResponse.singlePlayerMissions = JSON.parse(JSON.stringify(updatedUserFromResponse.singlePlayerMissions));
                        } catch (error) {
                            console.warn(`[handleAction] ${action.type} - Failed to deep copy singlePlayerMissions`, error);
                        }
                    }

                    if (action.type === 'CLAIM_SINGLE_PLAYER_CLASS_BAR_REWARD' && updatedUserFromResponse.singlePlayerClassBarClaims) {
                        try {
                            (updatedUserFromResponse as { singlePlayerClassBarClaims: unknown }).singlePlayerClassBarClaims = JSON.parse(
                                JSON.stringify(updatedUserFromResponse.singlePlayerClassBarClaims)
                            );
                        } catch (error) {
                            console.warn(`[handleAction] ${action.type} - Failed to deep copy singlePlayerClassBarClaims`, error);
                        }
                    }
                    
                    // applyUserUpdate는 이미 내부에서 flushSync를 사용하므로 모든 액션에서 즉시 UI 업데이트됨
                    // HTTP 응답의 updatedUser를 우선적으로 적용하고, WebSocket 업데이트는 일정 시간 동안 무시됨
                    if (action.type === 'COMBINE_ITEMS') {
                        const consumedIds =
                            (result as { consumedItemIds?: string[] }).consumedItemIds ??
                            (result.clientResponse as { consumedItemIds?: string[] } | undefined)?.consumedItemIds ??
                            ((action.payload as { itemIds?: string[] } | undefined)?.itemIds ?? []);
                        if (Array.isArray(consumedIds) && consumedIds.length > 0) {
                            const removed = recentlyRemovedInventoryIdsRef.current;
                            consumedIds.forEach((id) => {
                                if (typeof id === 'string' && id.length > 0) removed.add(id);
                            });
                            window.setTimeout(() => {
                                consumedIds.forEach((id) => {
                                    if (typeof id === 'string') removed.delete(id);
                                });
                            }, 8000);
                        }
                    }

                    const mergedUser = applyUserUpdate(updatedUserFromResponse, `${action.type}-http`);
                    // 챔피언십 던전 입장: 경기장에서 컨텍스트 반영 전에도 표시할 수 있도록 dungeonState를 sessionStorage에 보관
                    if (action.type === 'START_DUNGEON_STAGE') {
                        const dungeonState = (result as any).dungeonState || result.clientResponse?.dungeonState;
                        if (dungeonState && dungeonState.type) {
                            try {
                                sessionStorage.setItem(`pendingDungeon_${dungeonState.type}`, JSON.stringify(dungeonState));
                            } catch (e) {
                                console.warn('[handleAction] Failed to store pending dungeon state', e);
                            }
                        }
                    }
                    // HTTP 응답에 updatedUser가 있었음을 기록하고 타임스탬프 업데이트
                    lastHttpUpdateTime.current = Date.now();
                    lastHttpActionType.current = action.type;
                    lastHttpHadUpdatedUser.current = true;
                    console.log(`[handleAction] ${action.type} - applied HTTP updatedUser (WebSocket updates will be ignored for ${HTTP_UPDATE_DEBOUNCE_MS}ms)`, {
                        inventoryLength: mergedUser?.inventory?.length,
                        equipment: mergedUser?.equipment,
                        gold: mergedUser?.gold,
                        diamonds: mergedUser?.diamonds,
                        actionPoints: mergedUser?.actionPoints
                    });

                    // applyUserUpdate가 이미 flushSync로 setCurrentUser·setUpdateTrigger를 수행함 — 여기서 한 번 더 하면 대형 트리(페어대기실 등)에서 메인 스레드만 두 배로 막힘
                    // 도전의 탑 클리어 시 대기실 랭킹 즉시 갱신 (10초 대기 없이)
                    if (action.type === 'END_TOWER_GAME') {
                        setTowerRankingsRefetchTrigger(prev => prev + 1);
                    }
                } else {
                    // HTTP 응답에 updatedUser가 없었음을 기록 (타임스탬프는 업데이트하지 않음)
                    lastHttpActionType.current = action.type;
                    lastHttpHadUpdatedUser.current = false;
                    const actionsThatShouldHaveUpdatedUser = [
                        'TOGGLE_EQUIP_ITEM', 'UNBIND_EQUIPMENT', 'MARK_ITEM_EXCHANGE_LISTED', 'UNMARK_ITEM_EXCHANGE_LISTED', 'USE_ITEM', 'USE_ALL_ITEMS_OF_TYPE', 'ENHANCE_ITEM',
                        'COMBINE_ITEMS', 'DISASSEMBLE_ITEM', 'CRAFT_MATERIAL', 'BUY_SHOP_ITEM',
                        'BUY_CHAMPIONSHIP_SHOP_ITEM',
                        'BUY_CASH_PACKAGE',
                        'BUY_VIP_PACKAGE',
                        'CANCEL_VIP_SHOP_AUTO_RENEW',
                        'ADMIN_SET_DIAMOND_PACKAGE_TEST',
                        'BUY_CONSUMABLE', 'BUY_CONDITION_POTION', 'USE_CONDITION_POTION', 'UPDATE_AVATAR', 
                        'UPDATE_BORDER', 'CHANGE_NICKNAME', 'UPDATE_MBTI', 'ALLOCATE_STAT_POINT',
                        'SELL_ITEM', 'EXPAND_INVENTORY', 'BUY_BORDER', 'APPLY_PRESET', 'SAVE_PRESET',
                        'DELETE_MAIL', 'DELETE_ALL_CLAIMED_MAIL', 'CLAIM_MAIL_ATTACHMENTS', 
                        'CLAIM_ALL_MAIL_ATTACHMENTS', 'MARK_MAIL_AS_READ',
                        'CLAIM_QUEST_REWARD', 'CLAIM_ACTIVITY_MILESTONE',
                        'CLAIM_SINGLE_PLAYER_MISSION_REWARD',
                        'CLAIM_SINGLE_PLAYER_CLASS_BAR_REWARD',
                        'CLAIM_ALL_TRAINING_QUEST_REWARDS',
                        'LEVEL_UP_TRAINING_QUEST',
                        'SINGLE_PLAYER_REFRESH_PLACEMENT', 'TOWER_REFRESH_PLACEMENT',
                        'MANNER_ACTION',
                        'START_GUILD_BOSS_BATTLE',
                        'BUY_TOWER_ITEM',
                        'CLAIM_SHOP_AD_REWARD',
                        'SAVE_EXCHANGE_STATE',
                        'CLAIM_EXCHANGE_SETTLEMENT',
                        'PURCHASE_EXCHANGE_LISTING',
                    ];
                    if (actionsThatShouldHaveUpdatedUser.includes(action.type)) {
                        console.warn(`[handleAction] ${action.type} - No updatedUser in response! Waiting for WebSocket update...`, {
                            hasClientResponse: !!result.clientResponse,
                            clientResponseKeys: result.clientResponse ? Object.keys(result.clientResponse) : [],
                            resultKeys: Object.keys(result)
                        });
                        // updatedUser가 없어도 액션 타입을 기록하여 WebSocket 업데이트를 받을 수 있도록 함
                        // 타임스탬프는 설정하지 않아서 WebSocket 업데이트가 즉시 적용되도록 함
                        lastHttpActionType.current = action.type;
                        // updatedUser가 없으면 WebSocket 업데이트를 기다리되, 타임아웃을 설정하여 일정 시간 후 강제 업데이트
                        // WebSocket USER_UPDATE가 곧 도착할 것이므로 별도 처리 불필요
                        // 하지만 WebSocket 업데이트가 오지 않으면 문제가 될 수 있으므로, 짧은 시간 후 WebSocket 무시 시간을 줄임
                        setTimeout(() => {
                            // WebSocket 업데이트가 오지 않았으면 무시 시간을 줄여서 다음 WebSocket 업데이트를 받을 수 있도록 함
                            const timeSinceLastHttpUpdate = Date.now() - lastHttpUpdateTime.current;
                            if (timeSinceLastHttpUpdate > HTTP_UPDATE_DEBOUNCE_MS || lastHttpUpdateTime.current === 0) {
                                console.warn(`[handleAction] ${action.type} - WebSocket update not received, reducing debounce window`);
                                // 다음 WebSocket 업데이트를 받을 수 있도록 타임스탬프 조정
                                lastHttpUpdateTime.current = Date.now() - HTTP_UPDATE_DEBOUNCE_MS;
                            }
                        }, 500);
                     }
                 }
                 
                 // 변경권 사용 시 대장간 제련 탭으로 이동
                 if (action.type === 'USE_ITEM' && result.clientResponse?.openBlacksmithRefineTab) {
                     setIsInventoryOpen(false);
                     setBlacksmithActiveTab('refine');
                     if (!openQuickUtilityViewport('blacksmith')) {
                         setActiveQuickUtilityPanel('blacksmith');
                     }
                     // 선택된 아이템이 있으면 해당 아이템 선택
                     if (result.clientResponse?.selectedItemId && currentUser) {
                         const selectedItem = currentUser.inventory.find(i => i.id === result.clientResponse.selectedItemId);
                         if (selectedItem && selectedItem.type === 'equipment') {
                             // BlacksmithModal에 전달할 수 있도록 상태 업데이트
                             // 실제로는 BlacksmithModal이 열릴 때 인벤토리에서 선택하도록 함
                         }
                     }
                 }
                 
                 // trainingQuestLevelUp 응답 처리 (강화 완료 피드백용)
                 const trainingQuestLevelUp = result.clientResponse?.trainingQuestLevelUp;
                 if (trainingQuestLevelUp && action.type === 'LEVEL_UP_TRAINING_QUEST') {
                     // TrainingQuestPanel에서 처리할 수 있도록 반환
                     return trainingQuestLevelUp;
                 }
                 
                const obtainedItemsBulkRaw = result.clientResponse?.obtainedItemsBulk || result.obtainedItemsBulk;
                // 도전의 탑 전용 상점 구매: 인벤은 갱신되며 획득 아이템 모달(ItemObtainedModal) 표시
                const skipObtainedModalForOptimisticConvert =
                    action.type === 'PAIR_PET_CONVERT_PET' &&
                    Boolean((action.payload as { __clientSkipObtainedModal?: boolean } | undefined)?.__clientSkipObtainedModal);

                if (obtainedItemsBulkRaw && !skipObtainedModalForOptimisticConvert) {
                    let obtainedItemsBulk: InventoryItem[] = obtainedItemsBulkRaw as InventoryItem[];
                    try {
                        obtainedItemsBulk = JSON.parse(JSON.stringify(obtainedItemsBulkRaw)) as InventoryItem[];
                    } catch {
                        // 폴백: 얕은 복사만 가능한 경우에도 인벤 행과 참조를 끊기 위해 항목 단위 복제
                        obtainedItemsBulk = (obtainedItemsBulkRaw as InventoryItem[]).map((it) => ({ ...it }));
                    }
                    const stampedItems = stampObtainedItemsBulk(obtainedItemsBulk);
                    flushSync(() => {
                        setLastUsedItemResult(stampedItems);
                    });
                    
                    // USE_ITEM의 경우 obtainedItemsBulk가 있으면 result를 반환하여 모달에서 확인할 수 있도록 함
                    if (action.type === 'USE_ITEM') {
                        if (result.clientResponse?.boxRewardSentToMail) {
                            try {
                                window.alert(tx('inventory:boxRewardSentToMail'));
                            } catch {
                                /* ignore */
                            }
                        }
                        return result;
                    }
                }
                 const scoreChange = result.clientResponse?.tournamentScoreChange;
                 if (scoreChange) setTournamentScoreChange(scoreChange);
                
                 // 제련 결과 처리
                 if (action.type === 'REFINE_EQUIPMENT' && result.clientResponse?.refinementResult) {
                     setRefinementResult(result.clientResponse.refinementResult);
                 }
                
                 // 보상 수령 모달 처리 (즉시 표시를 위해 flushSync 사용)
                if (result.rewardSummary) {
                    flushSync(() => {
                        setRewardSummary(result.rewardSummary);
                    });
                } else if (result.clientResponse?.rewardSummary) {
                    flushSync(() => {
                        setRewardSummary(result.clientResponse.rewardSummary);
                    });
                } else if (action.type === 'CLAIM_SINGLE_PLAYER_MISSION_REWARD' && result.clientResponse?.reward) {
                    // 서버에서 rewardSummary가 없을 경우 fallback
                    const reward = result.clientResponse.reward;
                    flushSync(() => {
                        setRewardSummary({
                            reward: reward,
                            items: [],
                            title: tx('quests:trainingMissionRewardTitle')
                        });
                    });
                }
                
                if (result.claimAllSummary) {
                    flushSync(() => {
                        setClaimAllSummary(result.claimAllSummary);
                        setIsClaimAllSummaryOpen(true);
                    });
                }
                
                // 수련 과제 일괄 수령 응답 처리
                const claimAllTrainingQuestRewards = result.clientResponse?.claimAllTrainingQuestRewards 
                    || result.claimAllTrainingQuestRewards;
                if (claimAllTrainingQuestRewards && action.type === 'CLAIM_ALL_TRAINING_QUEST_REWARDS') {
                    // TrainingQuestPanel에서 처리할 수 있도록 반환
                    return {
                        claimAllTrainingQuestRewards: claimAllTrainingQuestRewards
                    };
                }
                const disassemblyResult = result.clientResponse?.disassemblyResult || result.disassemblyResult;
                if (disassemblyResult) { 
                    setDisassemblyResult(disassemblyResult);
                    if (disassemblyResult.jackpot) audioService.disassemblyJackpot();
                }
                const craftResult = result.clientResponse?.craftResult || result.craftResult;
                if (craftResult) {
                    console.log(`[handleAction] ${action.type} - Setting craftResult:`, {
                        craftResult,
                        hasCraftResult: !!craftResult,
                        gained: craftResult.gained,
                        used: craftResult.used,
                        craftType: craftResult.craftType,
                        jackpot: craftResult.jackpot
                    });
                    // 상태 업데이트를 즉시 동기적으로 처리하여 결과 모달이 확실히 표시되도록 함
                    flushSync(() => {
                        setCraftResult(craftResult);
                    });
                    // 대박 발생 시 사운드 재생
                    if (craftResult.jackpot) {
                        audioService.disassemblyJackpot();
                    }
                    // 추가 디버깅: 상태가 설정되었는지 확인
                    console.log(`[handleAction] ${action.type} - craftResult state set, should trigger modal`);
                } else {
                    // craftResult가 없는 것은 정상입니다 (일부 액션만 craftResult를 반환)
                    // 경고는 craftResult를 반환해야 하는 액션에서만 표시
                    const actionsThatShouldHaveCraftResult = ['CRAFT_MATERIAL', 'CONVERT_MATERIAL'];
                    if (actionsThatShouldHaveCraftResult.includes(action.type)) {
                        console.warn(`[handleAction] ${action.type} - No craftResult in response!`, {
                            hasClientResponse: !!result.clientResponse,
                            hasCraftResult: !!result.craftResult,
                            clientResponseKeys: result.clientResponse ? Object.keys(result.clientResponse) : [],
                            resultKeys: Object.keys(result)
                        });
                    }
                }
                const combinationResult = result.clientResponse?.combinationResult || result.combinationResult;
                if (combinationResult) {
                    setCombinationResult(combinationResult);
                    if (combinationResult.isGreatSuccess) {
                        audioService.combinationGreatSuccess(); // Assuming this sound exists
                    } else {
                        audioService.combinationSuccess(); // Assuming this sound exists
                    }
                }
                // 랭킹전 매칭 시작 응답 처리
                if (action.type === 'START_RANKED_MATCHING' && result.clientResponse?.success) {
                    const matchingInfo = result.clientResponse.matchingInfo;
                    if (matchingInfo) {
                        console.log('[handleAction] START_RANKED_MATCHING - Matching started:', matchingInfo);
                        // 매칭 정보를 반환하여 컴포넌트에서 즉시 상태 업데이트 가능하도록 함
                        return { matchingInfo } as HandleActionResult;
                    }
                }
                
                const enhancementOutcome = result.clientResponse?.enhancementOutcome || result.enhancementOutcome;
                if (enhancementOutcome) {
                    const { message, success, itemBefore, itemAfter, xpGained } = enhancementOutcome;
                    const enhancementAnimationTarget =
                        result.clientResponse?.enhancementAnimationTarget || result.enhancementAnimationTarget;
                    flushSync(() => {
                        setEnhancementResult({ message, success });
                        setEnhancementOutcome({ message, success, itemBefore, itemAfter, xpGained, isRolling: false });
                        setIsEnhancementResultModalOpen(true);
                        if (enhancementAnimationTarget) {
                            setEnhancementAnimationTarget(enhancementAnimationTarget);
                        }
                    });
                    if (success) {
                        audioService.enhancementSuccess();
                    } else {
                        audioService.enhancementFail();
                    }
                }
                if (result.enhancementAnimationTarget) setEnhancementAnimationTarget(result.enhancementAnimationTarget);
                const redirectToTournament = result.clientResponse?.redirectToTournament || result.redirectToTournament;
                if (redirectToTournament) {
                    if (action.type !== 'USE_CONDITION_POTION' && action.type !== 'BUY_CONDITION_POTION') {
                        const targetHash = `#/tournament/${redirectToTournament}`;
                        if (window.location.hash !== targetHash) {
                            console.log(`[handleAction] ${action.type} - Redirecting to tournament:`, redirectToTournament);
                            setTimeout(() => {
                                if (shouldSuppressChampionshipArenaRedirect()) {
                                    console.log(
                                        `[handleAction] ${action.type} - Skipping tournament redirect (championship lobby exit)`,
                                    );
                                    return;
                                }
                                if (window.location.hash !== targetHash) {
                                    navigateFromGameIfApplicable(targetHash);
                                }
                            }, 200);
                                } else {
                            console.log(`[handleAction] ${action.type} - Already at ${targetHash}, skipping redirect`);
                        }
                    } else {
                        console.log(`[handleAction] ${action.type} - Skipping redirect (already in tournament)`);
                    }
                }
                
                // 비상탈출 등에서 사용하는 일반 redirectTo 처리
                const redirectTo = result.clientResponse?.redirectTo;
                if (redirectTo) {
                    if (window.location.hash !== redirectTo) {
                        console.log(`[handleAction] ${action.type} - Redirecting to:`, redirectTo);
                        setTimeout(() => {
                            navigateFromGameIfApplicable(redirectTo);
                        }, 200);
                    } else {
                        console.log(`[handleAction] ${action.type} - Already at ${redirectTo}, skipping redirect`);
                    }
                }
                // 거절 메시지 표시
                if (result.declinedMessage) {
                    showError(result.declinedMessage.message);
                }
                
                // ACCEPT_NEGOTIATION, START_AI_GAME, START_SINGLE_PLAYER_GAME, START_TOWER_GAME,
                // CONFIRM_TOWER_GAME_START, CONFIRM_SINGLE_PLAYER_GAME_START, CONFIRM_AI_GAME_START 후 게임이 생성되었거나 업데이트되었을 때 처리
                // 서버 응답 구조: { success: true, ...result.clientResponse }
                // 따라서 result.gameId 또는 result.clientResponse?.gameId 둘 다 확인
                const gameId = (result as any).gameId || result.clientResponse?.gameId;
                const game = (result as any).game || result.clientResponse?.game;
                
                // CONFIRM_TOWER_GAME_START, CONFIRM_AI_GAME_START의 경우 gameId가 없어도 payload에서 가져올 수 있음
                // SINGLE_PLAYER_REFRESH_PLACEMENT는 서버가 gameId를 넣지 않고 game만 반환하므로 payload에서 gameId 사용
                let effectiveGameId = gameId;
                if (!effectiveGameId && (action.type === 'CONFIRM_TOWER_GAME_START' || action.type === 'CONFIRM_SINGLE_PLAYER_GAME_START' || action.type === 'CONFIRM_AI_GAME_START')) {
                    effectiveGameId = (action.payload as any)?.gameId;
                    console.log(`[handleAction] ${action.type} - gameId not in response, using payload gameId:`, effectiveGameId);
                }
                if (!effectiveGameId && action.type === 'CONFIRM_BASE_REVEAL') {
                    effectiveGameId =
                        ('payload' in action ? (action as { payload?: { gameId?: string } }).payload?.gameId : undefined) ||
                        (game as any)?.id;
                }
                if (!effectiveGameId && (action.type === 'SINGLE_PLAYER_REFRESH_PLACEMENT' && game)) {
                    effectiveGameId = (action.payload as any)?.gameId || (game as any)?.id;
                    console.log(`[handleAction] ${action.type} - using payload/game gameId:`, effectiveGameId);
                }
                if (!effectiveGameId && (action.type === 'RESIGN_GAME' && game)) {
                    effectiveGameId = (action.payload as any)?.gameId || (game as any)?.id;
                    console.log(`[handleAction] ${action.type} - using payload/game gameId:`, effectiveGameId);
                }
                if (!effectiveGameId && (action.type === 'TOWER_REFRESH_PLACEMENT' && game)) {
                    effectiveGameId = (action.payload as any)?.gameId || (game as any)?.id;
                    console.log(`[handleAction] ${action.type} - using payload/game gameId:`, effectiveGameId);
                }
                if (!effectiveGameId && action.type === 'TOWER_ADD_TURNS') {
                    effectiveGameId =
                        ('payload' in action ? (action as { payload?: { gameId?: string } }).payload?.gameId : undefined) ||
                        (game as any)?.id;
                }
                if (
                    !effectiveGameId &&
                    (action.type === 'START_SCANNING' ||
                        action.type === 'START_HIDDEN_PLACEMENT' ||
                        action.type === 'SCAN_BOARD' ||
                        action.type === 'START_MISSILE_SELECTION' ||
                        action.type === 'LAUNCH_MISSILE' ||
                        action.type === 'CANCEL_MISSILE_SELECTION' ||
                        action.type === 'MISSILE_INVALID_SELECTION' ||
                        action.type === 'MISSILE_ANIMATION_COMPLETE' ||
                        action.type === 'MISSILE_ITEM_TIMEOUT')
                ) {
                    effectiveGameId =
                        ('payload' in action ? (action as { payload?: { gameId?: string } }).payload?.gameId : undefined) ||
                        (game as any)?.id;
                }
                if (!effectiveGameId && action.type === 'BUY_TOWER_ITEM') {
                    effectiveGameId =
                        ('payload' in action ? (action as { payload?: { gameId?: string } }).payload?.gameId : undefined) ||
                        (game as any)?.id;
                }
                // 응답에 gameId가 없거나 상위 키와 불일치할 때: 세션 객체의 id를 우선 (AI 재대결·WS 선도착 병합 안정화)
                if (!effectiveGameId && game && typeof (game as any).id === 'string' && (game as any).id) {
                    effectiveGameId = (game as any).id;
                }
                
                // END_TOWER_GAME / END_SINGLE_PLAYER_GAME / RESIGN_GAME 액션 처리 (서버 응답 병합 시 클라이언트 바둑판 상태 유지)
                if (action.type === 'END_TOWER_GAME' || (action as ServerAction).type === 'END_SINGLE_PLAYER_GAME' || action.type === 'RESIGN_GAME') {
                    const endGameId =
                        ('payload' in action ? (action as { payload?: { gameId?: string } }).payload?.gameId : undefined) ||
                        gameId ||
                        (game as any)?.id;
                    const endGame = game || (result.clientResponse?.game);
                    
                    if (endGameId && endGame) {
                        console.log(`[handleAction] ${action.type} - Updating game with winner:`, { gameId: endGameId, winner: endGame.winner, gameStatus: endGame.gameStatus });
                        
                        const preserveBoardFromExisting = (existing: typeof endGame, next: typeof endGame) => {
                            const merged = { ...existing, ...next };
                            const hasValidBoard = existing?.boardState && Array.isArray(existing.boardState) && existing.boardState.length > 0;
                            if (hasValidBoard) {
                                merged.boardState = existing.boardState;
                                if (existing.moveHistory?.length) merged.moveHistory = existing.moveHistory;
                                // 종료 응답 병합 시 보드/수순을 기존 것으로 유지하면 lastMove도 함께 고정해야
                                // 마지막 수 마커가 다른 색(예: 백)으로 뒤바뀌는 현상을 막을 수 있다.
                                if (existing.lastMove != null) merged.lastMove = existing.lastMove;
                                if (existing.blackPatternStones?.length) merged.blackPatternStones = existing.blackPatternStones;
                                if (existing.whitePatternStones?.length) merged.whitePatternStones = existing.whitePatternStones;
                            }
                            // 종료 응답에서 `captures`가 0으로 내려오면 결과 모달/계산이 잘못 표시될 수 있어
                            // 서버가 더 큰 값만 주는 단조 증가 기준으로 기존 값을 보존한다.
                            merged.captures = mergeMonotonicCountRecord(
                                existing?.captures as any,
                                next?.captures as any,
                            );
                            merged.baseStoneCaptures = mergeMonotonicCountRecord(
                                existing?.baseStoneCaptures as any,
                                next?.baseStoneCaptures as any,
                            );
                            merged.hiddenStoneCaptures = mergeMonotonicCountRecord(
                                existing?.hiddenStoneCaptures as any,
                                next?.hiddenStoneCaptures as any,
                            );
                            return merged;
                        };

                        if (getSessionArenaKind(endGame) === 'tower') {
                            setTowerGames(currentGames => {
                                const existingGame = currentGames[endGameId];
                                if (endGame.winner !== null && endGame.winner !== undefined) {
                                    return { ...currentGames, [endGameId]: preserveBoardFromExisting(existingGame ?? endGame, endGame) };
                                }
                                return currentGames;
                            });
                        } else if (getSessionArenaKind(endGame) === 'singleplayer') {
                            setSinglePlayerGames(currentGames => {
                                const existingGame = currentGames[endGameId];
                                if (endGame.winner !== null && endGame.winner !== undefined) {
                                    return { ...currentGames, [endGameId]: preserveBoardFromExisting(existingGame ?? endGame, endGame) };
                                }
                                return currentGames;
                            });
                        }
                    }
                }
                
                // 주사위/도둑 착수: 한 개 놓을 때마다 화면에 바로 반영 (HTTP 응답 game으로 liveGames 갱신)
                const placementGameId = (action.type === 'DICE_PLACE_STONE' || action.type === 'THIEF_PLACE_STONE' || action.type === 'ALKKAGI_PLACE_STONE') ? ((action.payload as any)?.gameId || game?.id) : null;
                if (game && placementGameId && (action.type === 'DICE_PLACE_STONE' || action.type === 'THIEF_PLACE_STONE') && !isSessionSingleOrTower(game)) {
                    const cloneBoard = (g: typeof game) =>
                        g.boardState && Array.isArray(g.boardState) ? g.boardState.map((row: number[]) => [...row]) : g.boardState;
                    if (action.type === 'DICE_PLACE_STONE') {
                        let appliedDicePlaceMerge = false;
                        setLiveGames((currentGames) => {
                            const existing = currentGames[placementGameId];
                            if (!game) return currentGames;
                            if (!existing) {
                                appliedDicePlaceMerge = true;
                                return { ...currentGames, [placementGameId]: { ...game, boardState: cloneBoard(game) } };
                            }
                            // 빠른 연속 착수 시 이전 HTTP 응답이 늦게 도착하면 낙관적 수순이 덮여 돌이 사라진 것처럼 보임 → 낡은 응답 무시
                            if (shouldIgnoreOutdatedPlayfulUpdate(game, existing, { source: 'http_dice_place_stone' })) {
                                return currentGames;
                            }
                            appliedDicePlaceMerge = true;
                            return {
                                ...currentGames,
                                [placementGameId]: {
                                    ...existing,
                                    ...game,
                                    boardState: cloneBoard(game),
                                },
                            };
                        });
                        if (appliedDicePlaceMerge) {
                            delete pvpDicePlaceRevertRef.current[placementGameId];
                        }
                    } else {
                        let appliedThiefPlaceMerge = false;
                        setLiveGames((currentGames) => {
                            const existing = currentGames[placementGameId];
                            if (!game) return currentGames;
                            if (!existing) {
                                appliedThiefPlaceMerge = true;
                                return { ...currentGames, [placementGameId]: { ...game, boardState: cloneBoard(game) } };
                            }
                            if (shouldIgnoreOutdatedPlayfulUpdate(game, existing, { source: 'http_thief_place_stone' })) {
                                return currentGames;
                            }
                            appliedThiefPlaceMerge = true;
                            return {
                                ...currentGames,
                                [placementGameId]: {
                                    ...existing,
                                    ...game,
                                    boardState: cloneBoard(game),
                                },
                            };
                        });
                        if (appliedThiefPlaceMerge) {
                            delete pvpDicePlaceRevertRef.current[placementGameId];
                        }
                    }
                }
                if (game && placementGameId && action.type === 'ALKKAGI_PLACE_STONE' && !isSessionSingleOrTower(game)) {
                    let appliedAlkkagiPlaceMerge = false;
                    const uid = currentUserRef.current?.id;
                    setLiveGames((currentGames) => {
                        const existing = currentGames[placementGameId];
                        if (!game) return currentGames;
                        if (!existing) {
                            appliedAlkkagiPlaceMerge = true;
                            return { ...currentGames, [placementGameId]: game };
                        }
                        if (uid && alkkagiPlacedCountForUser(game, uid) < alkkagiPlacedCountForUser(existing, uid)) {
                            return currentGames;
                        }
                        appliedAlkkagiPlaceMerge = true;
                        return {
                            ...currentGames,
                            [placementGameId]: {
                                ...existing,
                                ...game,
                            },
                        };
                    });
                    if (appliedAlkkagiPlaceMerge) {
                        delete pvpDicePlaceRevertRef.current[placementGameId];
                    }
                }
                // 주사위/도둑 굴리기: HTTP 응답에 game 있으면 즉시 반영 (두 번째 턴부터 굴리기 애니가 안 나오는 버그 방지)
                const rollGameId =
                    action.type === 'DICE_ROLL' || action.type === 'THIEF_ROLL_DICE'
                        ? ((action.payload as any)?.gameId || game?.id)
                        : null;
                if (
                    game &&
                    rollGameId &&
                    (action.type === 'DICE_ROLL' || action.type === 'THIEF_ROLL_DICE') &&
                    !isSessionSingleOrTower(game)
                ) {
                    const rollMergeSource =
                        action.type === 'THIEF_ROLL_DICE' ? 'http_thief_roll_dice' : 'http_dice_roll';
                    setLiveGames(currentGames => {
                        const existing = currentGames[rollGameId];
                        if (shouldIgnoreOutdatedPlayfulUpdate(game, existing, { source: rollMergeSource })) {
                            return currentGames;
                        }
                        const next = existing ? { ...existing, ...game, boardState: game.boardState && Array.isArray(game.boardState) ? game.boardState.map((row: number[]) => [...row]) : game.boardState } : game;
                        return { ...currentGames, [rollGameId]: next };
                    });
                }
                if (
                    effectiveGameId &&
                    (action.type === 'ACCEPT_NEGOTIATION' ||
                        action.type === 'START_AI_GAME' ||
                        action.type === 'START_GUILD_WAR_GAME' ||
                        action.type === 'START_ADVENTURE_MONSTER_BATTLE' ||
                        action.type === 'START_SINGLE_PLAYER_GAME' ||
                        action.type === 'START_TOWER_GAME' ||
                        action.type === 'CONFIRM_TOWER_GAME_START' ||
                        action.type === 'CONFIRM_SINGLE_PLAYER_GAME_START' ||
                        action.type === 'CONFIRM_AI_GAME_START' ||
                        /** 베이스 배치 확정: AI·모험 등에서 `baseHttpGameSnapshot`으로 `game`이 오나 WS만 기다리면 단계 전환이 안 보임 */
                        action.type === 'CONFIRM_BASE_PLACEMENT_COMPLETE' ||
                        action.type === 'CONFIRM_BASE_REVEAL' ||
                        action.type === 'CONFIRM_CAPTURE_REVEAL' ||
                        action.type === 'PLACE_CHESS_SETUP_PIECE' ||
                        action.type === 'REMOVE_CHESS_SETUP_PIECE' ||
                        action.type === 'RESET_CHESS_SETUP_PLACEMENT' ||
                        action.type === 'FILL_CHESS_SETUP_RANDOMLY' ||
                        action.type === 'CONFIRM_CHESS_SETUP_PLACEMENT' ||
                        action.type === 'SINGLE_PLAYER_REFRESH_PLACEMENT' ||
                        action.type === 'SINGLE_PLAYER_SYNC_PENDING_STAGE' ||
                        action.type === 'SINGLE_PLAYER_ADMIN_JUMP_PENDING_STAGE' ||
                        action.type === 'TOWER_REFRESH_PLACEMENT' ||
                        action.type === 'TOWER_ADD_TURNS' ||
                        action.type === 'START_SCANNING' ||
                        action.type === 'START_HIDDEN_PLACEMENT' ||
                        action.type === 'SCAN_BOARD' ||
                        action.type === 'START_MISSILE_SELECTION' ||
                        action.type === 'REQUEST_STRATEGIC_PET_HINT' ||
                        (action.type === 'BUY_TOWER_ITEM' && !!game))
                ) {
                    console.log(`[handleAction] ${action.type} - gameId received:`, effectiveGameId, 'hasGame:', !!game, 'result keys:', Object.keys(result), 'clientResponse keys:', result.clientResponse ? Object.keys(result.clientResponse) : []);
                    
                    // 응답에 게임 데이터가 있으면 즉시 상태에 추가 (WebSocket 업데이트를 기다리지 않음)
                    if (game) {
                        const arenaKind = getSessionArenaKind(game);
                        console.log(`[handleAction] ${action.type} - Game object found in response:`, { gameId: game.id, gameStatus: game.gameStatus, arenaKind });
                        const isTowerGame = arenaKind === 'tower';
                        console.log('[handleAction] Adding game to state immediately:', effectiveGameId, 'arenaKind:', arenaKind, 'isTower:', isTowerGame);
                        
                        // 게임 카테고리 확인
                        if (arenaKind === 'singleplayer') {
                            // 배치변경 시 sessionStorage의 이전 보드를 제거해 Game.tsx가 서버의 새 boardState를 사용하도록 함
                            if (
                                action.type === 'SINGLE_PLAYER_REFRESH_PLACEMENT' ||
                                action.type === 'SINGLE_PLAYER_SYNC_PENDING_STAGE' ||
                                action.type === 'SINGLE_PLAYER_ADMIN_JUMP_PENDING_STAGE'
                            ) {
                                try {
                                    sessionStorage.removeItem(`gameState_${effectiveGameId}`);
                                } catch (_) { /* ignore */ }
                            }
                            const spStoreUpdater = (currentGames: Record<string, LiveGameSession>) => {
                                const shouldUpdate =
                                    action.type === 'CONFIRM_SINGLE_PLAYER_GAME_START' ||
                                    action.type === 'CONFIRM_BASE_PLACEMENT_COMPLETE' ||
                                    action.type === 'CONFIRM_BASE_REVEAL' ||
                                    action.type === 'CONFIRM_CAPTURE_REVEAL' ||
                                    action.type === 'SINGLE_PLAYER_REFRESH_PLACEMENT' ||
                                    action.type === 'SINGLE_PLAYER_SYNC_PENDING_STAGE' ||
                                    action.type === 'SINGLE_PLAYER_ADMIN_JUMP_PENDING_STAGE' ||
                                    action.type === 'START_SCANNING' ||
                                    action.type === 'START_HIDDEN_PLACEMENT' ||
                                    action.type === 'SCAN_BOARD' ||
                                    action.type === 'START_MISSILE_SELECTION' ||
                                    action.type === 'LAUNCH_MISSILE' ||
                                    action.type === 'CANCEL_MISSILE_SELECTION' ||
                                    action.type === 'MISSILE_INVALID_SELECTION' ||
                                    action.type === 'MISSILE_ANIMATION_COMPLETE' ||
                                    action.type === 'START_SINGLE_PLAYER_GAME' ||
                                    action.type === 'REQUEST_STRATEGIC_PET_HINT' ||
                                    !currentGames[effectiveGameId];
                                if (shouldUpdate) {
                                    const isRefresh = action.type === 'SINGLE_PLAYER_REFRESH_PLACEMENT';
                                    const rawNextGame = isRefresh && game.boardState
                                        ? { ...game, boardState: (game.boardState as any[][]).map(row => [...row]), blackPatternStones: Array.isArray(game.blackPatternStones) ? [...game.blackPatternStones] : game.blackPatternStones, whitePatternStones: Array.isArray(game.whitePatternStones) ? [...game.whitePatternStones] : game.whitePatternStones }
                                        : game;
                                    const prevSingle = currentGames[effectiveGameId];
                                    const mergedCounters = mergeGameWithMonotonicCounters(
                                        prevSingle,
                                        rawNextGame as LiveGameSession,
                                        effectiveGameId,
                                    );
                                    const nextGame = mergePveHttpActionGameResponse(
                                        mergedCounters,
                                        prevSingle,
                                        action.type,
                                    );
                                    if (action.type === 'START_SINGLE_PLAYER_GAME') {
                                        for (const id of Object.keys(currentGames)) {
                                            if (id !== effectiveGameId) {
                                                try {
                                                    sessionStorage.removeItem(`gameState_${id}`);
                                                } catch {
                                                    /* ignore */
                                                }
                                            }
                                        }
                                        return { [effectiveGameId]: nextGame };
                                    }
                                    return { ...currentGames, [effectiveGameId]: nextGame };
                                }
                                return currentGames;
                            };
                            if (
                                action.type === 'START_SINGLE_PLAYER_GAME' ||
                                action.type === 'CONFIRM_SINGLE_PLAYER_GAME_START'
                            ) {
                                flushSync(() => setSinglePlayerGames(spStoreUpdater));
                            } else {
                                setSinglePlayerGames(spStoreUpdater);
                            }
                        } else if (isTowerGame) {
                            if (action.type === 'TOWER_REFRESH_PLACEMENT') {
                                try {
                                    sessionStorage.removeItem(`gameState_${effectiveGameId}`);
                                } catch (_) {
                                    /* ignore */
                                }
                            }
                            const towerStoreUpdater = (currentGames: Record<string, LiveGameSession>) => {
                                // CONFIRM·배치변경·턴 추가·스캔/히든 아이템 사용 시 게임 상태가 바뀌었으므로 업데이트
                                if (
                                    action.type === 'CONFIRM_TOWER_GAME_START' ||
                                    action.type === 'CONFIRM_BASE_PLACEMENT_COMPLETE' ||
                                    action.type === 'TOWER_REFRESH_PLACEMENT' ||
                                    action.type === 'TOWER_ADD_TURNS' ||
                                    action.type === 'START_SCANNING' ||
                                    action.type === 'START_HIDDEN_PLACEMENT' ||
                                    action.type === 'SCAN_BOARD' ||
                                    action.type === 'START_MISSILE_SELECTION' ||
                                    action.type === 'LAUNCH_MISSILE' ||
                                    action.type === 'CANCEL_MISSILE_SELECTION' ||
                                    action.type === 'MISSILE_INVALID_SELECTION' ||
                                    action.type === 'MISSILE_ANIMATION_COMPLETE' ||
                                    action.type === 'START_TOWER_GAME' ||
                                    action.type === 'BUY_TOWER_ITEM' ||
                                    action.type === 'REQUEST_STRATEGIC_PET_HINT' ||
                                    !currentGames[effectiveGameId]
                                ) {
                                    console.log('[handleAction] Updating tower game:', effectiveGameId, 'gameStatus:', game.gameStatus, 'action type:', action.type, 'existing game status:', currentGames[effectiveGameId]?.gameStatus);
                                    const isRefresh = action.type === 'TOWER_REFRESH_PLACEMENT';
                                    const rawNextGame = isRefresh && game.boardState
                                        ? { ...game, boardState: (game.boardState as any[][]).map(row => [...row]), blackPatternStones: Array.isArray(game.blackPatternStones) ? [...game.blackPatternStones] : game.blackPatternStones, whitePatternStones: Array.isArray(game.whitePatternStones) ? [...game.whitePatternStones] : game.whitePatternStones }
                                        : game;
                                    const existingTower = currentGames[effectiveGameId];
                                    let nextGame = mergeGameWithMonotonicCounters(existingTower, rawNextGame as LiveGameSession, effectiveGameId);
                                    nextGame = mergePveHttpActionGameResponse(nextGame, existingTower, action.type);
                                    if (
                                        existingTower &&
                                        (action.type === 'START_HIDDEN_PLACEMENT' ||
                                            action.type === 'START_SCANNING' ||
                                            action.type === 'SCAN_BOARD' ||
                                            action.type === 'START_MISSILE_SELECTION' ||
                                            action.type === 'LAUNCH_MISSILE' ||
                                            action.type === 'TOWER_ADD_TURNS' ||
                                            action.type === 'BUY_TOWER_ITEM')
                                    ) {
                                        nextGame = mergeTowerServerGameWithClientBoardIfStale(nextGame, existingTower);
                                    }
                                    if (action.type === 'START_TOWER_GAME') {
                                        for (const id of Object.keys(currentGames)) {
                                            if (id !== effectiveGameId) {
                                                try {
                                                    sessionStorage.removeItem(`gameState_${id}`);
                                                } catch {
                                                    /* ignore */
                                                }
                                            }
                                        }
                                        return { [effectiveGameId]: nextGame };
                                    }
                                    return { ...currentGames, [effectiveGameId]: nextGame };
                                }
                                return currentGames;
                            };
                            if (action.type === 'CONFIRM_TOWER_GAME_START') {
                                try {
                                    sessionStorage.removeItem(`gameState_${effectiveGameId}`);
                                    sessionStorage.removeItem(pveAutoScoringScheduledStorageKey(effectiveGameId));
                                } catch {
                                    /* ignore */
                                }
                                flushSync(() => setTowerGames(towerStoreUpdater));
                            } else {
                                setTowerGames(towerStoreUpdater);
                            }
                        } else {
                            const applyLiveGameHttpMerge = (currentGames: Record<string, LiveGameSession>) => {
                                const mergeId =
                                    (typeof (game as any)?.id === 'string' && (game as any).id) ||
                                    effectiveGameId ||
                                    gameId;
                                if (!mergeId || !game) return currentGames;
                                const prev = currentGames[mergeId];
                                // WS가 먼저 슬롯을 채운 경우에도 HTTP 응답으로 병합 (이전: 키 존재 시 무시 → 재대결 등에서 상태 정지)
                                let mergedForSlot = mergeGameWithMonotonicCounters(prev, game as LiveGameSession, mergeId);
                                if (resolveArenaSessionPolicy(mergedForSlot as any).requiresClientSyncBeforeAction) {
                                    mergedForSlot = mergePveHttpActionGameResponse(
                                        mergedForSlot,
                                        prev,
                                        action.type,
                                    );
                                }
                                if (mergedForSlot.mode === GameMode.Chess) {
                                    mergedForSlot = normalizeChessGoSession(mergedForSlot);
                                }
                                return {
                                    ...currentGames,
                                    [mergeId]: coerceAdventureLiveGameScoringTurnLimit(mergedForSlot),
                                };
                            };
                            if (action.type === 'CONFIRM_AI_GAME_START' || action.type === 'START_AI_GAME') {
                                flushSync(() => setLiveGames(applyLiveGameHttpMerge));
                            } else {
                                setLiveGames(applyLiveGameHttpMerge);
                            }
                        }
                        
                        // 사용자 상태도 즉시 업데이트 (gameId와 status를 'in-game'으로 설정)
                        // currentUserWithStatus는 onlineUsers에서 가져오므로, onlineUsers를 업데이트하면 자동으로 반영됨
                        if (currentUser?.id) {
                            setOnlineUsers(prevUsers => {
                                const userIndex = prevUsers.findIndex(u => u.id === currentUser.id);
                                if (userIndex >= 0) {
                                    const updatedUsers = [...prevUsers];
                                    updatedUsers[userIndex] = {
                                        ...updatedUsers[userIndex],
                                        gameId: effectiveGameId,
                                        status: UserStatus.InGame,
                                        mode: game.mode
                                    };
                                    console.log('[handleAction] Updated user status in onlineUsers:', {
                                        userId: currentUser.id,
                                        gameId: effectiveGameId,
                                        status: 'in-game',
                                        mode: game.mode
                                    });
                                    return updatedUsers;
                                } else {
                                    // 사용자가 onlineUsers에 없으면 추가
                                    const newUser: UserWithStatus = {
                                        ...currentUser,
                                        status: UserStatus.InGame,
                                        gameId: effectiveGameId,
                                        mode: game.mode
                                    };
                                    console.log('[handleAction] Added user to onlineUsers:', newUser);
                                    return [...prevUsers, newUser];
                                }
                            });
                        }
                    }
                    
                    // CONFIRM_TOWER_GAME_START의 경우 게임 객체가 없어도 WebSocket GAME_UPDATE를 기다림
                    // 하지만 게임이 이미 towerGames에 있으면 상태를 업데이트해야 함
                    if (!game && effectiveGameId && (action.type === 'CONFIRM_TOWER_GAME_START' || action.type === 'CONFIRM_SINGLE_PLAYER_GAME_START')) {
                        console.log(`[handleAction] ${action.type} - No game in response, checking existing games for gameId:`, effectiveGameId);
                        
                        // 기존 게임 상태 확인
                        const existingTowerGame = towerGames[effectiveGameId];
                        const existingSinglePlayerGame = singlePlayerGames[effectiveGameId];
                        const existingGame = existingTowerGame || existingSinglePlayerGame;
                        
                        if (existingGame) {
                            console.log(`[handleAction] ${action.type} - Found existing game, updating status to playing:`, { gameId: effectiveGameId, currentStatus: existingGame.gameStatus });
                            
                            // 게임 상태를 playing으로 업데이트 (WebSocket 업데이트를 기다리지 않고 즉시)
                            if (existingTowerGame) {
                                setTowerGames(currentGames => {
                                    const updatedGame = { ...currentGames[effectiveGameId], gameStatus: 'playing' as const, startTime: Date.now() };
                                    return { ...currentGames, [effectiveGameId]: updatedGame };
                                });
                            } else if (existingSinglePlayerGame) {
                                setSinglePlayerGames(currentGames => {
                                    const updatedGame = { ...currentGames[effectiveGameId], gameStatus: 'playing' as const, startTime: Date.now() };
                                    return { ...currentGames, [effectiveGameId]: updatedGame };
                                });
                            }
                        } else {
                            console.log(`[handleAction] ${action.type} - Game not found in state, will wait for GAME_UPDATE WebSocket message`);
                        }
                    }
                    
                    // 즉시 라우팅 업데이트 (게임이 생성되었으므로)
                    // 게임 데이터가 있으면 즉시 라우팅, 없어도 gameId가 있으면 즉시 라우팅
                    const targetHash = `#/game/${effectiveGameId}`;
                    if (window.location.hash !== targetHash) {
                        console.log('[handleAction] Setting immediate route to new game:', targetHash, 'hasGame:', !!game);
                        // AI 게임: state 반영 전 리다이렉트 방지를 위해 유예 시간 설정
                        // START_AI_GAME(대기실→규칙설명), CONFIRM_AI_GAME_START(경기시작→경기장) 모두 적용
                        if (
                            action.type === 'START_AI_GAME' ||
                            action.type === 'START_ADVENTURE_MONSTER_BATTLE' ||
                            action.type === 'CONFIRM_AI_GAME_START' ||
                            action.type === 'START_SINGLE_PLAYER_GAME' ||
                            action.type === 'START_TOWER_GAME' ||
                            action.type === 'CONFIRM_SINGLE_PLAYER_GAME_START' ||
                            action.type === 'CONFIRM_TOWER_GAME_START'
                        ) {
                            pendingAiGameEntryRef.current = {
                                gameId: effectiveGameId,
                                until: Date.now() + 3000,
                                ...((action.type === 'CONFIRM_AI_GAME_START' ||
                                    action.type === 'CONFIRM_SINGLE_PLAYER_GAME_START' ||
                                    action.type === 'CONFIRM_TOWER_GAME_START') &&
                                game
                                    ? { game: game as LiveGameSession }
                                    : {}),
                            };
                        }
                        // 즉시 라우팅 (지연 제거)
                        window.location.hash = targetHash;
                    }
                    
                    // 펫 힌트: Game.tsx ingameHandleAction이 strategicPetHint·game을 읽어야 함 (gameId만 반환하면 힌트 UI가 안 뜸)
                    if (action.type === 'REQUEST_STRATEGIC_PET_HINT') {
                        return result;
                    }

                    if (
                        action.type === 'CONFIRM_SINGLE_PLAYER_GAME_START' ||
                        action.type === 'CONFIRM_TOWER_GAME_START' ||
                        action.type === 'START_SINGLE_PLAYER_GAME' ||
                        action.type === 'START_TOWER_GAME'
                    ) {
                        return { ...result, gameId: effectiveGameId };
                    }

                    // gameId를 반환하여 컴포넌트에서 사용할 수 있도록 함
                    return { gameId: effectiveGameId };
                } else if (action.type === 'START_TOWER_GAME') {
                    // START_TOWER_GAME의 경우 gameId를 다시 확인 (다른 경로에서 올 수 있음)
                    const towerGameId = (result as any).gameId || result.clientResponse?.gameId;
                    const towerGame = (result as any).game || result.clientResponse?.game;
                    if (towerGameId) {
                        const targetHash = `#/game/${towerGameId}`;
                        console.log('[handleAction] START_TOWER_GAME - gameId found, routing to:', targetHash, 'hasGame:', !!towerGame);
                        
                        // 게임 객체가 있으면 즉시 상태에 추가
                        if (towerGame) {
                            setTowerGames(currentGames => {
                                for (const id of Object.keys(currentGames)) {
                                    if (id !== towerGameId) {
                                        try {
                                            sessionStorage.removeItem(`gameState_${id}`);
                                        } catch {
                                            /* ignore */
                                        }
                                    }
                                }
                                return { [towerGameId]: towerGame };
                            });
                        }
                        
                        // 즉시 라우팅 (지연 제거)
                        if (window.location.hash !== targetHash) {
                            window.location.hash = targetHash;
                        }
                        return { gameId: towerGameId };
                    } else {
                        console.warn('[handleAction] START_TOWER_GAME - No gameId found in response:', {
                            resultKeys: Object.keys(result),
                            hasClientResponse: !!result.clientResponse,
                            clientResponseKeys: result.clientResponse ? Object.keys(result.clientResponse) : []
                        });
                    }
                }
                
                // Handle guild creation response
                if (action.type === 'CREATE_GUILD') {
                    console.log(`[handleAction] CREATE_GUILD - Processing response:`, {
                        hasResult: !!result,
                        hasSuccess: result?.success,
                        hasGuild: !!result?.guild,
                        hasClientResponse: !!result?.clientResponse,
                        hasClientResponseGuild: !!result?.clientResponse?.guild,
                        resultKeys: result ? Object.keys(result) : [],
                        clientResponseKeys: result?.clientResponse ? Object.keys(result.clientResponse) : []
                    });
                    // Server returns { success: true, ...result.clientResponse }
                    // So result.guild or result.clientResponse?.guild should work
                    const guild = result?.guild || result?.clientResponse?.guild;
                    if (guild) {
                        console.log(`[handleAction] CREATE_GUILD - Guild found:`, guild);
                        setGuilds(prev => ({ ...prev, [guild.id]: guild }));
                        // Return result in the format expected by modal
                        return { clientResponse: { guild, updatedUser: result?.updatedUser || result?.clientResponse?.updatedUser } } as HandleActionResult;
                    }
                }
                
                // Handle guild list response
                if (action.type === 'LIST_GUILDS') {
                    console.log(`[handleAction] LIST_GUILDS - Processing response:`, {
                        hasResult: !!result,
                        hasClientResponse: !!result?.clientResponse,
                        hasGuilds: !!result?.clientResponse?.guilds,
                        hasGuildsDirect: !!result?.guilds,
                        guildsLength: result?.clientResponse?.guilds?.length || result?.guilds?.length,
                        resultKeys: result ? Object.keys(result) : [],
                        clientResponseKeys: result?.clientResponse ? Object.keys(result.clientResponse) : [],
                        fullResult: result
                    });
                    
                    // 서버 응답 구조: { success: true, guilds: [...], total: ... } 또는 { clientResponse: { guilds: [...] } }
                    const guildsList = result?.guilds || result?.clientResponse?.guilds;
                    if (Array.isArray(guildsList)) {
                        console.log(`[handleAction] LIST_GUILDS - Found ${guildsList.length} guild(s) in response`);
                        const guildsMap: Record<string, Guild> = {};
                        guildsList.forEach((g: any) => {
                            if (g && g.id) guildsMap[g.id] = g;
                        });
                        setGuilds(prev => ({ ...prev, ...guildsMap }));
                    }
                    
                    // LIST_GUILDS의 경우 항상 result를 반환 (guilds가 없어도 빈 배열로 반환)
                    // 서버 응답 구조에 맞춰 clientResponse로 래핑하여 반환
                    const responseToReturn = result || { guilds: [] };
                    // clientResponse 구조로 정규화
                    if (!responseToReturn.clientResponse && responseToReturn.guilds) {
                        responseToReturn.clientResponse = { guilds: responseToReturn.guilds };
                    }
                    console.log(`[handleAction] LIST_GUILDS - Returning result to component:`, {
                        hasResult: !!responseToReturn,
                        hasGuilds: !!responseToReturn.clientResponse?.guilds,
                        guildsLength: responseToReturn.clientResponse?.guilds?.length
                    });
                    return responseToReturn;
                }
                
                // Handle JOIN_GUILD response (자유가입 성공 시 즉시 상태 반영 - 모달 닫고 길드 홈 이동 전)
                if (action.type === 'JOIN_GUILD' && result?.clientResponse?.guild) {
                    const guild = result.clientResponse.guild;
                    const updatedUser = result.clientResponse.updatedUser;
                    flushSync(() => {
                        if (guild?.id) {
                            setGuilds(prev => ({ ...prev, [guild.id]: guild }));
                        }
                        if (updatedUser) {
                            applyUserUpdate(updatedUser, 'JOIN_GUILD');
                        }
                    });
                }
                
                // Handle LEAVE_GUILD / GUILD_LEAVE response
                if ((action.type === 'LEAVE_GUILD' || action.type === 'GUILD_LEAVE') && !result?.error) {
                    // 탈퇴 성공 시 길드 정보 제거
                    const guildId = (action.payload as any)?.guildId || currentUser?.guildId;
                    if (guildId) {
                        setGuilds(prev => {
                            const updated = { ...prev };
                            delete updated[guildId];
                            return updated;
                        });
                    }
                    // updatedUser가 있으면 사용자 상태 업데이트 (guildId 제거됨)
                    // flushSync를 사용하여 즉시 상태 업데이트
                    const updatedUser = result?.clientResponse?.updatedUser || result?.updatedUser;
                    if (updatedUser) {
                        flushSync(() => {
                            applyUserUpdate(updatedUser, 'LEAVE_GUILD');
                        });
                    } else {
                        // updatedUser가 없으면 현재 사용자의 guildId를 제거
                        if (currentUser) {
                            flushSync(() => {
                                applyUserUpdate({ ...currentUser, guildId: undefined }, 'LEAVE_GUILD');
                            });
                        }
                    }
                }
                
                // Handle GET_GUILD_INFO response
                if (action.type === 'GET_GUILD_INFO' && result?.clientResponse?.guild) {
                    const guild = result.clientResponse.guild;
                    if (guild && guild.id) {
                        const members = Array.isArray(guild.members) ? guild.members : [];
                        const guildToStore = { ...guild, members };
                        if (process.env.NODE_ENV === 'development' && members.length === 0) {
                            console.warn('[useApp] GET_GUILD_INFO - Guild has no members:', { guildId: guild.id, guildName: guild.name });
                        }
                        setGuilds(prev => ({ ...prev, [guild.id]: guildToStore }));
                    } else {
                        console.warn('[useApp] GET_GUILD_INFO - Guild data invalid:', {
                            hasGuild: !!result?.clientResponse?.guild,
                            guildId: result?.clientResponse?.guild?.id,
                            guildName: result?.clientResponse?.guild?.name
                        });
                    }
                }
                
                // Handle other guild responses that might include guilds
                // GET_GUILD_WAR_DATA도 guilds 병합 (guildWarMatching 등 매칭 상태 동기화 - broadcast 누락 시 대비)
                // API 응답은 { success: true, ...clientResponse } 형태라 result.guilds / result.clientResponse.guilds 둘 다 확인
                const guildsFromResponse = result?.guilds ?? result?.clientResponse?.guilds;
                if (guildsFromResponse && typeof guildsFromResponse === 'object') {
                    if (action.type === 'START_GUILD_BOSS_BATTLE') {
                        // 보스전 직후 길드홈으로 돌아갔을 때 나의 기록이 갱신되도록 동기 반영
                        flushSync(() => {
                            setGuilds(prev => ({ ...prev, ...guildsFromResponse }));
                        });
                    } else {
                        setGuilds(prev => ({ ...prev, ...guildsFromResponse }));
                    }
                }

                // 페어 방: PAIR_ROOM_UPDATE와 동일 소스 — WS보다 HTTP가 먼저/늦게 올 때도 목록이 맞도록 병합
                const pairRoomsFromResponse = (result as any)?.pairRooms ?? result?.clientResponse?.pairRooms;
                if (pairRoomsFromResponse && typeof pairRoomsFromResponse === 'object') {
                    setPairRooms(pairRoomsFromResponse);
                }
                const pairRoomChatHistory = (result as any)?.pairRoomChatHistory ?? result?.clientResponse?.pairRoomChatHistory;
                if (pairRoomChatHistory && typeof pairRoomChatHistory === 'object') {
                    setPairRoomChatByRoomId((prev) => {
                        const next = { ...prev };
                        for (const [rid, msgs] of Object.entries(pairRoomChatHistory)) {
                            if (Array.isArray(msgs)) next[rid] = msgs as PairRoomChatLine[];
                        }
                        return next;
                    });
                }
                const pairInvitesFromResponse =
                    (result as any)?.pairPartnerInvites ?? result?.clientResponse?.pairPartnerInvites;
                if (pairInvitesFromResponse && typeof pairInvitesFromResponse === 'object') {
                    setPairPartnerInvites(pairInvitesFromResponse);
                }
                
                // Return result for actions that need it (preserve original structure)
                // Include donationResult and other specific response fields
                // LIST_GUILDS는 이미 위에서 반환되므로 여기서는 제외
                if ((action as ServerAction).type !== 'LIST_GUILDS' && result && (
                    result.clientResponse || 
                    result.guild || 
                    result.game ||
                    result.gameId ||
                    (result as any).negotiationId ||
                    (result as any).pairRooms ||
                    result.donationResult ||
                    result.clientResponse?.donationResult ||
                    result.guilds ||
                    /** `/api/action` 평탄화: `clientResponse`만 스프레드되어 최상위로만 오는 필드 */
                    (result as any).strategicPetHint ||
                    (result as any).strategicPetHintBonus ||
                    /** `/api/action` 평탄화: `updatedUser`만 최상위에 있는 응답(페어 부화 수령 등)도 호출부에 전달 */
                    !!(result as any).updatedUser ||
                    /** 페어 펫 수련 수령: `pairTrainingClaimSummary`만 추가로 오는 경우에도 호출부(모달)로 전달 */
                    !!(result as any).pairTrainingClaimSummary ||
                    /** `/api/action` 평탄화: `clientResponse` 키 없이 최상위에만 오는 필드 (예: 보물상자 PREPARE/CONFIRM) */
                    (result as any).adventureTreasurePick ||
                    (result as any).grantedTreasureRolls != null ||
                    ((action as ServerAction).type === 'ABANDON_ADVENTURE_MAP_TREASURE_PICK' &&
                        !!(result.updatedUser || (result as any).clientResponse?.updatedUser)) ||
                    /** `/api/action` 성공 응답이 `{ success, ...clientResponse }`로 평탄화되어 `clientResponse` 키가 없는 관리자 액션 */
                    ((action as ServerAction).type.startsWith('ADMIN_') && result.success === true)
                )) {
                    return result;
                }
                
                // LIST_GUILDS가 위에서 반환되지 않은 경우 (예: result가 undefined인 경우)
                if ((action as ServerAction).type === 'LIST_GUILDS') {
                    console.warn(`[handleAction] LIST_GUILDS - result was not returned earlier, returning empty array`);
                    return { clientResponse: { guilds: [] } };
                }
            }
        } catch (err: any) {
            if (action.type === 'DICE_PLACE_STONE' || action.type === 'THIEF_PLACE_STONE' || action.type === 'ALKKAGI_PLACE_STONE') {
                const gid = (action.payload as { gameId?: string })?.gameId;
                if (gid) {
                    const snap = pvpDicePlaceRevertRef.current[gid];
                    if (snap) {
                        setLiveGames((c) => (c[gid] ? { ...c, [gid]: snap } : c));
                        delete pvpDicePlaceRevertRef.current[gid];
                    }
                    delete pvpDicePlaceInFlightRef.current[gid];
                }
            }
            if (action.type === 'PLACE_STONE') {
                const gid = (action.payload as { gameId?: string })?.gameId;
                if (gid) {
                    const snap = pvpPlaceStoneRevertRef.current[gid];
                    if (snap) {
                        setLiveGames((c) => (c[gid] ? { ...c, [gid]: snap } : c));
                        delete pvpPlaceStoneRevertRef.current[gid];
                    }
                }
            }
            if (action.type === 'RESIGN_GAME') {
                const rev = pveResignOptimisticRevertRef.current;
                if (rev) {
                    pveResignOptimisticRevertRef.current = null;
                    if (rev.bucket === 'singleplayer') {
                        setSinglePlayerGames((c) => (c[rev.gameId] ? { ...c, [rev.gameId]: rev.snapshot } : c));
                    } else {
                        setTowerGames((c) => (c[rev.gameId] ? { ...c, [rev.gameId]: rev.snapshot } : c));
                    }
                }
            }
            rollbackTowerAddTurnOptimistic();
            revertAiLobbyStartOptimistic();
            console.error(`[handleAction] ${action.type} - Exception:`, err);
            console.error(`[handleAction] Error stack:`, err.stack);
            setConnectionNotice({
                kind: 'requestFailed',
                message: tx('common:connection.requestFailed'),
                severity: 'error',
            });
            showError(err.message || tx('common:errors.requestProcessingFailed'));
        } finally {
            const finalActionGameId = ((action as any).payload as { gameId?: string } | undefined)?.gameId;
            const finalIsAiSyncAction =
                (action.type === 'REQUEST_SERVER_AI_MOVE' || action.type === 'REQUEST_GAME_STATE_SYNC') &&
                typeof finalActionGameId === 'string' &&
                finalActionGameId.length > 0;
            if (finalIsAiSyncAction) {
                inFlightAiSyncActionRef.current.delete(`${action.type}:${finalActionGameId}`);
            }
            if (
                action.type === 'PLACE_STONE' &&
                typeof finalActionGameId === 'string' &&
                finalActionGameId.length > 0
            ) {
                const finalPayload = (action as any).payload as { x?: number; y?: number } | undefined;
                if (typeof finalPayload?.x === 'number' && typeof finalPayload?.y === 'number') {
                    inFlightPlaceStoneActionRef.current.delete(`${finalActionGameId}:${finalPayload.x},${finalPayload.y}`);
                }
            }
            if (dicePlaceGameId) {
                const gid = dicePlaceGameId;
                const n = (pvpDicePlaceInFlightRef.current[gid] || 1) - 1;
                if (n <= 0) delete pvpDicePlaceInFlightRef.current[gid];
                else pvpDicePlaceInFlightRef.current[gid] = n;
            }
            if (action.type === 'CONFIRM_AI_GAME_START') {
                setAiLobbyStartConfirmGameId(null);
            }
        }
    }, [currentUser?.id, aiLobbyStartConfirmGameId, applyOptimisticTowerClearOnBlackWin, guilds, markConnectionRestored, setConnectionNotice]);

    const handleActionRef = useRef(handleAction);
    handleActionRef.current = handleAction;

    const handleLogout = useCallback(async () => {
        if (!currentUser) return;
        isLoggingOut.current = true;
        
        const userId = currentUser.id; // 현재 사용자 ID 저장
        
        // 로그아웃 액션을 먼저 전송 (비동기 처리)
        try {
            // currentUser가 null이 되기 전에 userId를 직접 사용
            const res = await fetch(getApiUrl('/api/action'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ type: 'LOGOUT', userId }),
            });
            
            if (res.ok) {
                const result = await res.json();
                if (result.error) {
                    console.error('[handleLogout] Server error:', result.error);
                }
            } else {
                console.error('[handleLogout] HTTP error:', res.status);
            }
        } catch (error) {
            console.error('[handleLogout] Error during logout action:', error);
        }
        
        // 상태 초기화 (WebSocket은 useEffect cleanup에서 자동으로 닫힘)
        setCurrentUser(null);
        sessionStorage.removeItem('currentUser');
        
        // 모든 상태 초기화
        setOnlineUsers([]);
        setLiveGames({});
        setSinglePlayerGames({});
        setTowerGames({});
        setNegotiations({});
        setWaitingRoomChats({});
        waitingRoomChatSessionStartRef.current = 0;
        setGameChats({});
        
        // 라우팅 초기화 (로그인 페이지로 이동)
        window.location.hash = '';
    }, [currentUser]);
    


    useEffect(() => {
        if (!currentUser) {
            // Clean up if user logs out
            setUsersMap({});
            setOnlineUsers([]);
            setLiveGames({});
            setNegotiations({});
            deferredLevelUpCelebrationRef.current = null;
            setLevelUpCelebration(null);
            deferredMannerGradeChangeRef.current = null;
            setMannerGradeChange(null);
            setContentUnlockNoticeQueue([]);
            return;
        }

        let ws: WebSocket | null = null;
        let wsPingInterval: NodeJS.Timeout | null = null;
        let reconnectTimeout: NodeJS.Timeout | null = null;
        let isIntentionalClose = false;
        let shouldReconnect = true;
        let isConnecting = false; // 중복 연결 방지 플래그
        let isInitialStateReady = true;
        let pendingMessages: any[] = [];
        let initialStateTimeout: NodeJS.Timeout | null = null;

        const getCloseCodeMeaning = (code: number): string => {
            switch (code) {
                case 1000: return 'Normal Closure';
                case 1001: return 'Going Away';
                case 1002: return 'Protocol Error';
                case 1003: return 'Unsupported Data';
                case 1006: return 'Abnormal Closure (no close frame)';
                case 1007: return 'Invalid Data';
                case 1008: return 'Policy Violation';
                case 1009: return 'Message Too Big';
                case 1010: return 'Missing Extension';
                case 1011: return 'Internal Error';
                case 1012: return 'Service Restart';
                case 1013: return 'Try Again Later';
                case 1014: return 'Bad Gateway';
                case 1015: return 'TLS Handshake';
                default: return `Unknown (${code})`;
            }
        };

        /** CONNECTING 직후 close()는 브라우저가 "closed before established" 경고 — Strict Mode·빠른 unmount 완화 */
        const softCloseWebSocket = (socket: WebSocket) => {
            if (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) return;
            if (socket.readyState === WebSocket.OPEN) {
                try {
                    socket.close();
                } catch {
                    /* ignore */
                }
                return;
            }
            if (socket.readyState === WebSocket.CONNECTING) {
                let done = false;
                const closeOnce = () => {
                    if (done) return;
                    done = true;
                    try {
                        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                            socket.close();
                        }
                    } catch {
                        /* ignore */
                    }
                };
                socket.addEventListener('open', closeOnce, { once: true });
                socket.addEventListener('error', closeOnce, { once: true });
                window.setTimeout(closeOnce, 400);
            }
        };

        // 초기 상태 처리 헬퍼 함수
        const processInitialState = (users: Record<string, any>, otherData: {
            onlineUsers?: any[];
            liveGames?: Record<string, any>;
            singlePlayerGames?: Record<string, any>;
            towerGames?: Record<string, any>;
            negotiations?: Record<string, any>;
            waitingRoomChats?: Record<string, any>;
            gameChats?: Record<string, any>;
            adminLogs?: any[];
            announcements?: any[];
            globalOverrideAnnouncement?: any;
            gameModeAvailability?: Record<string, boolean>;
            arenaEntranceAvailability?: Partial<Record<string, boolean>>;
            announcementInterval?: number;
            homeBoardPosts?: any[];
            guilds?: Record<string, any>;
            singlePlayerStages?: any[];
            kataServerRuntimeConfig?: KataServerRuntimeSnapshot;
            championshipAbilityKataLadder?: readonly ChampionshipAbilityKataLadderRow[];
        }) => {
                // 이 시점을 기준으로 이후에 도착하는 WAITING_ROOM_CHAT_UPDATE만 과거 메시지를 걸러 냄
                waitingRoomChatSessionStartRef.current = Date.now();

                const userEntries = Object.entries(users || {});
                // nickname이 없거나 비어 있는 경우 제외
                const filteredEntries = userEntries.filter(
                    ([, u]) => u && typeof u.nickname === 'string' && u.nickname.trim().length > 0
                );

                // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
                if (process.env.NODE_ENV === 'development') {
                    console.log('[WebSocket] Processing initial state - total users:', userEntries.length, 'filtered:', filteredEntries.length);
                }

                const normalizedFiltered = filteredEntries.map(([id, u]) => {
                    const row = {
                        ...u,
                        mbti: typeof u.mbti === 'string' ? u.mbti : null,
                        inventory: Array.isArray(u.inventory) ? u.inventory : [],
                    } as Record<string, unknown>;
                    const lv = coerceUserLevelXpFromPayload(row);
                    return [id, { ...row, userLevel: lv.userLevel, userXp: lv.userXp }];
                });

            if (users && typeof users === 'object' && !Array.isArray(users)) {
                setUsersMap(Object.fromEntries(normalizedFiltered));
                console.log('[WebSocket] usersMap updated with', normalizedFiltered.length, 'users');
                
                // 현재 사용자의 데이터가 초기 상태에 포함되어 있으면 업데이트
                const currentUserSnapshot = currentUserRef.current;
                if (currentUserSnapshot && users[currentUserSnapshot.id]) {
                    const initialUserData = users[currentUserSnapshot.id];
                    if (initialUserData) {
                        try {
                            const sanitizedUpdate: Partial<User> = {
                                ...initialUserData,
                                inventory: Array.isArray(initialUserData.inventory) ? initialUserData.inventory : (currentUserSnapshot.inventory || []),
                                equipment: initialUserData.equipment ?? currentUserSnapshot.equipment,
                            };
                            // 닉네임 설정 직후 등: 늦게 도착한 INITIAL_STATE가 임시 닉네임(user_*)으로 덮어
                            // 라우터가 다시 set-nickname으로 보내거나 홈 전환이 늦게 느껴지는 레이스 방지
                            const localNick = currentUserSnapshot.nickname;
                            const incomingNick = initialUserData.nickname;
                            if (
                                typeof localNick === 'string' &&
                                localNick.trim().length > 0 &&
                                !localNick.startsWith('user_') &&
                                typeof incomingNick === 'string' &&
                                incomingNick.startsWith('user_')
                            ) {
                                sanitizedUpdate.nickname = localNick;
                            }
                            applyUserUpdate(sanitizedUpdate, 'INITIAL_STATE');
                        } catch (error) {
                            console.error('[WebSocket] Error applying initial state update:', error);
                            // 오류가 발생해도 앱이 계속 실행되도록 함
                        }
                    }
                }
            } else {
                console.warn('[WebSocket] Invalid users data:', users);
                setUsersMap({});
            }
            if (otherData) {
                if (otherData.singlePlayerStages !== undefined) {
                    setSinglePlayerStagesFromServer(otherData.singlePlayerStages as any);
                }
                if (otherData.onlineUsers !== undefined) {
                    setOnlineUsers(
                        (otherData.onlineUsers || []).filter(
                            (u: { id?: string }) => u?.id && !isSyntheticOnlineUserId(u.id),
                        ),
                    );
                }
                // liveGames: 전략/놀이바둑 수순 제한 또는 AI봇 대결 시 totalTurns·moveHistory·currentPlayer를 sessionStorage에서 복원 (싱글/탑과 동일)
                if (otherData.liveGames !== undefined) {
                    const incomingLive = otherData.liveGames || {};
                    setLiveGames(prev => {
                        const next = { ...incomingLive };
                        for (const id of Object.keys(prev)) {
                            if (next[id]) continue;
                            const prevG = prev[id];
                            if (
                                prevG &&
                                ['scoring', 'ended', 'no_contest', 'hidden_final_reveal', 'rematch_pending'].includes(
                                    prevG.gameStatus || '',
                                )
                            ) {
                                next[id] = prevG;
                            }
                        }
                        for (const id of Object.keys(next)) {
                            const g = next[id];
                            if (!g) continue;
                            const prevG = prev[id];
                            if (prevG && shouldIgnoreStaleLiveTerminalGameUpdate(g, prevG)) {
                                next[id] = prevG;
                                continue;
                            }
                            const limit = (g.settings as any)?.scoringTurnLimit ?? (g.settings as any)?.autoScoringTurns;
                            const isTurnLimitGame = (limit != null && limit > 0);
                            const strategicAiLike = isSessionStrategicAiLike(g);
                            const needsRestore = (isTurnLimitGame || strategicAiLike) && (g.totalTurns == null || g.totalTurns === 0);
                            const needsCurrentPlayerRestore = isTurnLimitGame || strategicAiLike;
                            if (needsRestore || needsCurrentPlayerRestore) {
                                try {
                                    const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`gameState_${id}`) : null;
                                    if (stored) {
                                        const parsed = JSON.parse(stored);
                                        if (parsed.gameId === id) {
                                            const storedTotal = needsRestore && typeof parsed.totalTurns === 'number' && parsed.totalTurns > 0 ? parsed.totalTurns : null;
                                            const storedMovesRaw =
                                                Array.isArray(parsed.moveHistory) && parsed.moveHistory.length > 0
                                                    ? parsed.moveHistory
                                                    : null;
                                            const incLen = Array.isArray(g.moveHistory) ? g.moveHistory.length : 0;
                                            const stLen = storedMovesRaw?.length ?? 0;
                                            const useStoredMoves =
                                                storedMovesRaw != null &&
                                                (stLen > incLen || (incLen === 0 && stLen > 0));
                                            const storedMoves = useStoredMoves ? storedMovesRaw : null;
                                            const inferredCurrentPlayer =
                                                needsCurrentPlayerRestore && storedMoves && storedMoves.length > 0
                                                    ? ((last: { player?: number }) =>
                                                          last &&
                                                          (last.player === Player.Black ? Player.White : Player.Black))(
                                                          storedMoves[storedMoves.length - 1]
                                                      )
                                                    : null;
                                            if (storedTotal != null || storedMoves != null || inferredCurrentPlayer != null) {
                                                const storedBoardOk =
                                                    Array.isArray(parsed.boardState) &&
                                                    parsed.boardState.length > 0 &&
                                                    Array.isArray(parsed.boardState[0]) &&
                                                    parsed.boardState[0].length > 0;
                                                const serverBoardOk =
                                                    Array.isArray(g.boardState) &&
                                                    g.boardState.length > 0 &&
                                                    Array.isArray(g.boardState[0]) &&
                                                    g.boardState[0].length > 0;
                                                next[id] = {
                                                    ...g,
                                                    ...(storedTotal != null ? { totalTurns: storedTotal } : {}),
                                                    ...(storedMoves != null ? { moveHistory: storedMoves } : {}),
                                                    ...(inferredCurrentPlayer != null ? { currentPlayer: inferredCurrentPlayer } : {}),
                                                    ...(storedMoves != null &&
                                                    storedBoardOk &&
                                                    (!serverBoardOk || stLen > incLen)
                                                        ? { boardState: parsed.boardState }
                                                        : {}),
                                                };
                                            }
                                        }
                                    }
                                } catch { /* ignore */ }
                            }
                            // 온라인 AI 대국: INITIAL_STATE는 boardState를 보내지 않음. rejoin 전 빈 판·턴 표시를 막기 위해 sessionStorage 판·시간 정보 병합
                            if (strategicAiLike) {
                                const cur = next[id];
                                if (!cur) continue;
                                const b = cur.boardState;
                                const hasBoard =
                                    Array.isArray(b) &&
                                    b.length > 0 &&
                                    Array.isArray(b[0]) &&
                                    b[0].length > 0;
                                if (!hasBoard) {
                                    try {
                                        const stored =
                                            typeof sessionStorage !== 'undefined'
                                                ? sessionStorage.getItem(`gameState_${id}`)
                                                : null;
                                        if (stored) {
                                            const parsed = JSON.parse(stored);
                                            const pb = parsed?.boardState;
                                            const storedBoardOk =
                                                Array.isArray(pb) &&
                                                pb.length > 0 &&
                                                Array.isArray(pb[0]) &&
                                                pb[0].length > 0;
                                            if (parsed?.gameId === id && storedBoardOk) {
                                                const sm = parsed.moveHistory;
                                                const cm = cur.moveHistory;
                                                const useStoredMoves =
                                                    Array.isArray(sm) &&
                                                    sm.length > 0 &&
                                                    (!Array.isArray(cm) || cm.length === 0);
                                                next[id] = {
                                                    ...cur,
                                                    boardState: pb,
                                                    ...(useStoredMoves ? { moveHistory: sm } : {}),
                                                    ...(parsed.currentPlayer != null &&
                                                    (cur.currentPlayer === undefined || cur.currentPlayer === null)
                                                        ? { currentPlayer: parsed.currentPlayer }
                                                        : {}),
                                                    ...(typeof parsed.totalTurns === 'number' &&
                                                    parsed.totalTurns > 0 &&
                                                    (cur.totalTurns == null ||
                                                        cur.totalTurns === 0 ||
                                                        parsed.totalTurns > (cur.totalTurns ?? 0))
                                                        ? { totalTurns: Math.max(cur.totalTurns ?? 0, parsed.totalTurns) }
                                                        : {}),
                                                    ...(parsed.turnDeadline != null
                                                        ? {
                                                              turnDeadline: parsed.turnDeadline,
                                                              turnStartTime: parsed.turnStartTime,
                                                          }
                                                        : {}),
                                                    ...(typeof parsed.gameStartTime === 'number' &&
                                                    parsed.gameStartTime > 0 &&
                                                    (!(cur as any).gameStartTime || (cur as any).gameStartTime <= 0)
                                                        ? { gameStartTime: parsed.gameStartTime }
                                                        : {}),
                                                    ...(parsed.captures && typeof parsed.captures === 'object'
                                                        ? { captures: parsed.captures }
                                                        : {}),
                                                    ...(Array.isArray(parsed.castleStonePoints) &&
                                                    parsed.castleStonePoints.length > 0 &&
                                                    (!cur.castleStonePoints || cur.castleStonePoints.length === 0)
                                                        ? { castleStonePoints: parsed.castleStonePoints }
                                                        : {}),
                                                    ...(parsed.confirmedTerritoryOwnerByPoint &&
                                                    typeof parsed.confirmedTerritoryOwnerByPoint === 'object'
                                                        ? {
                                                              confirmedTerritoryOwnerByPoint: {
                                                                  ...(parsed.confirmedTerritoryOwnerByPoint as Record<
                                                                      string,
                                                                      Player.Black | Player.White
                                                                  >),
                                                                  ...(cur.confirmedTerritoryOwnerByPoint ?? {}),
                                                              },
                                                          }
                                                        : {}),
                                                    ...((() => {
                                                        const pa = (parsed as any).adventureEncounterDeadlineMs;
                                                        const ca = (cur as any).adventureEncounterDeadlineMs;
                                                        if (
                                                            getSessionArenaKind(cur) === 'adventure' &&
                                                            typeof pa === 'number' &&
                                                            pa > Date.now() &&
                                                            (typeof ca !== 'number' || ca < Date.now())
                                                        ) {
                                                            return { adventureEncounterDeadlineMs: pa } as any;
                                                        }
                                                        return {};
                                                    })()),
                                                    ...((() => {
                                                        const pf = (parsed as any).adventureEncounterFrozenHumanMsRemaining;
                                                        const cf = (cur as any).adventureEncounterFrozenHumanMsRemaining;
                                                        if (
                                                            getSessionArenaKind(cur) === 'adventure' &&
                                                            typeof pf === 'number' &&
                                                            pf > 0 &&
                                                            (cf == null || cf <= 0)
                                                        ) {
                                                            return { adventureEncounterFrozenHumanMsRemaining: pf } as any;
                                                        }
                                                        return {};
                                                    })()),
                                                };
                                            }
                                        }
                                    } catch {
                                        /* ignore */
                                    }
                                }
                                const curMerged = next[id];
                                if (curMerged && isSessionStrategicAiLike(curMerged)) {
                                    const lim =
                                        (curMerged.settings as any)?.scoringTurnLimit ??
                                        (curMerged.settings as any)?.autoScoringTurns;
                                    const tl = lim != null && Number(lim) > 0;
                                    if (tl || getSessionArenaKind(curMerged) === 'adventure') {
                                        try {
                                            const st2 =
                                                typeof sessionStorage !== 'undefined'
                                                    ? sessionStorage.getItem(`gameState_${id}`)
                                                    : null;
                                            if (st2) {
                                                const p2 = JSON.parse(st2);
                                                if (p2.gameId === id) {
                                                    let m = next[id]!;
                                                    const stT = typeof p2.totalTurns === 'number' ? p2.totalTurns : 0;
                                                    if (stT > (m.totalTurns ?? 0)) m = { ...m, totalTurns: stT };
                                                    const sm2 = p2.moveHistory;
                                                    const cm2 = m.moveHistory;
                                                    if (
                                                        Array.isArray(sm2) &&
                                                        sm2.length > (Array.isArray(cm2) ? cm2.length : 0)
                                                    ) {
                                                        const pb2 = p2.boardState;
                                                        const storedBoardOk2 =
                                                            Array.isArray(pb2) &&
                                                            pb2.length > 0 &&
                                                            Array.isArray(pb2[0]) &&
                                                            pb2[0].length > 0;
                                                        const serverBoardOk2 =
                                                            Array.isArray(m.boardState) &&
                                                            m.boardState.length > 0 &&
                                                            Array.isArray(m.boardState[0]) &&
                                                            m.boardState[0].length > 0;
                                                        m = {
                                                            ...m,
                                                            moveHistory: sm2,
                                                            ...(storedBoardOk2 && !serverBoardOk2 ? { boardState: pb2 } : {}),
                                                        };
                                                    }
                                                    if (
                                                        typeof p2.gameStartTime === 'number' &&
                                                        p2.gameStartTime > 0 &&
                                                        (!(m as any).gameStartTime || (m as any).gameStartTime <= 0)
                                                    ) {
                                                        m = { ...m, gameStartTime: p2.gameStartTime } as any;
                                                    }
                                                    if (getSessionArenaKind(m) === 'adventure') {
                                                        const pa2 = (p2 as any).adventureEncounterDeadlineMs;
                                                        if (typeof pa2 === 'number' && pa2 > Date.now()) {
                                                            const ca2 = (m as any).adventureEncounterDeadlineMs;
                                                            if (typeof ca2 !== 'number' || ca2 < Date.now()) {
                                                                (m as any).adventureEncounterDeadlineMs = pa2;
                                                            }
                                                        }
                                                        const pf2 = (p2 as any).adventureEncounterFrozenHumanMsRemaining;
                                                        if (
                                                            typeof pf2 === 'number' &&
                                                            pf2 > 0 &&
                                                            ((m as any).adventureEncounterFrozenHumanMsRemaining == null ||
                                                                (m as any).adventureEncounterFrozenHumanMsRemaining <= 0)
                                                        ) {
                                                            (m as any).adventureEncounterFrozenHumanMsRemaining = pf2;
                                                        }
                                                    }
                                                    next[id] = m;
                                                }
                                            }
                                        } catch {
                                            /* ignore */
                                        }
                                    }
                                }
                            }
                            if (next[id]) {
                                let mergedLive = next[id]!;
                                if (prevG) {
                                    mergedLive = mergeLiveRejoinResponseWithExistingBoard(prevG, mergedLive);
                                }
                                try {
                                    const storedLive =
                                        typeof sessionStorage !== 'undefined'
                                            ? sessionStorage.getItem(`gameState_${id}`)
                                            : null;
                                    if (storedLive) {
                                        mergedLive = augmentLiveSessionFromSessionStorageSnapshot(
                                            mergedLive,
                                            JSON.parse(storedLive),
                                        );
                                    }
                                } catch {
                                    /* ignore */
                                }
                                let coerced = coerceAdventureLiveGameScoringTurnLimit(mergedLive);
                                if (coerced.mode === GameMode.Chess) {
                                    coerced = normalizeChessGoSession(coerced);
                                }
                                next[id] = coerced;
                            }
                        }
                        return next;
                    });
                }
                // singlePlayerGames: rejoin으로 이미 받은 보드/수순/턴 정보가 있으면 유지 (INITIAL_STATE가 덮어써 흰돌·돌 사라짐·턴 초기화 방지)
                // 새로고침 직후 prev가 비어 있으므로, totalTurns/moveHistory가 없으면 sessionStorage에서 복원해 state에 넣음 (한 수 둔 뒤 턴이 Max로 리셋되는 버그 방지)
                // moveHistory 기준 currentPlayer 복원으로 AI 차례에 새로고침 시에도 흑 차례로 넘어가지 않도록 함
                if (otherData.singlePlayerGames !== undefined) {
                    const incoming = otherData.singlePlayerGames || {};
                    setSinglePlayerGames(prev => {
                        const next = { ...prev, ...incoming };
                        for (const id of Object.keys(incoming)) {
                            let fromPayload = next[id];
                            if (!fromPayload) continue;
                            if (prev[id] && shouldKeepLocalSessionOverIncomingPending(prev[id], incoming[id])) {
                                next[id] = { ...fromPayload, ...prev[id] };
                                fromPayload = next[id];
                            }
                            const isSpStage =
                                getSessionArenaKind(fromPayload) === 'singleplayer' &&
                                !!(fromPayload.stageId || (fromPayload.settings as any)?.autoScoringTurns);
                            const needsRestore = isSpStage && (fromPayload.totalTurns == null || fromPayload.totalTurns === 0);
                            const needsCurrentPlayerRestore = isSpStage;
                            try {
                                const stored =
                                    typeof sessionStorage !== 'undefined'
                                        ? sessionStorage.getItem(`gameState_${id}`)
                                        : null;
                                if (stored) {
                                    const parsed = JSON.parse(stored) as Record<string, unknown>;
                                    if (parsed.gameId === id) {
                                        let merged: LiveGameSession = next[id] || fromPayload;
                                        if (needsRestore || needsCurrentPlayerRestore) {
                                            const storedTotal =
                                                needsRestore &&
                                                typeof parsed.totalTurns === 'number' &&
                                                parsed.totalTurns > 0
                                                    ? parsed.totalTurns
                                                    : null;
                                            const storedMovesRaw =
                                                Array.isArray(parsed.moveHistory) && parsed.moveHistory.length > 0
                                                    ? (parsed.moveHistory as LiveGameSession['moveHistory'])
                                                    : null;
                                            const incLen = Array.isArray(fromPayload.moveHistory)
                                                ? fromPayload.moveHistory.length
                                                : 0;
                                            const stLen = storedMovesRaw?.length ?? 0;
                                            const useStoredMoves =
                                                storedMovesRaw != null &&
                                                (stLen > incLen || (incLen === 0 && stLen > 0));
                                            const storedMoves = useStoredMoves ? storedMovesRaw : null;
                                            const inferredCurrentPlayer =
                                                needsCurrentPlayerRestore && storedMoves && storedMoves.length > 0
                                                    ? inferCurrentPlayerFromLastStoredMove(
                                                          storedMoves[storedMoves.length - 1] as { player?: number },
                                                      )
                                                    : null;
                                            if (storedTotal != null || storedMoves != null || inferredCurrentPlayer != null) {
                                                merged = {
                                                    ...merged,
                                                    ...(storedTotal != null ? { totalTurns: storedTotal } : {}),
                                                    ...(storedMoves != null ? { moveHistory: storedMoves } : {}),
                                                    ...(inferredCurrentPlayer != null
                                                        ? { currentPlayer: inferredCurrentPlayer }
                                                        : {}),
                                                };
                                            }
                                        }
                                        next[id] = augmentPveFromSessionStorageSnapshot(merged, parsed);
                                    }
                                }
                            } catch {
                                /* ignore */
                            }
                            const existing = prev[id];
                            if (existing?.boardState != null && Array.isArray(existing.boardState) && existing.boardState.length > 0) {
                                const payloadHasBoard = Array.isArray(fromPayload.boardState) && fromPayload.boardState.length > 0;
                                if (!payloadHasBoard) {
                                    next[id] = {
                                        ...(next[id] || fromPayload),
                                        boardState: existing.boardState,
                                        moveHistory: existing.moveHistory ?? (next[id] || fromPayload).moveHistory,
                                        currentPlayer: existing.currentPlayer ?? (next[id] || fromPayload).currentPlayer,
                                        totalTurns: existing.totalTurns ?? (next[id] || fromPayload).totalTurns,
                                        captures: existing.captures ?? (next[id] || fromPayload).captures,
                                        lastMove: existing.lastMove ?? (next[id] || fromPayload).lastMove,
                                        blackTimeLeft: existing.blackTimeLeft ?? (next[id] || fromPayload).blackTimeLeft,
                                        whiteTimeLeft: existing.whiteTimeLeft ?? (next[id] || fromPayload).whiteTimeLeft,
                                        turnDeadline: existing.turnDeadline ?? (next[id] || fromPayload).turnDeadline,
                                        turnStartTime: existing.turnStartTime ?? (next[id] || fromPayload).turnStartTime,
                                    };
                                }
                            }
                            next[id] = reconcilePlayingSeatLock(next[id]!, prev[id]);
                            next[id] = coerceClassicPveHumanBlackSeatsIfSwapped(next[id]!);
                        }
                        return next;
                    });
                }
                // towerGames: rejoin으로 이미 받은 보드/수순/턴 정보가 있으면 유지. 새로고침 직후 totalTurns/moveHistory/currentPlayer를 sessionStorage에서 복원
                if (otherData.towerGames !== undefined) {
                    const incoming = otherData.towerGames || {};
                    setTowerGames(prev => {
                        const next = { ...prev, ...incoming };
                        for (const id of Object.keys(incoming)) {
                            let fromPayload = next[id];
                            if (!fromPayload) continue;
                            if (prev[id] && shouldKeepLocalSessionOverIncomingPending(prev[id], incoming[id])) {
                                next[id] = { ...fromPayload, ...prev[id] };
                                fromPayload = next[id];
                            }
                            const isTowerStage =
                                getSessionArenaKind(fromPayload) === 'tower' &&
                                !!(fromPayload.stageId || (fromPayload.settings as any)?.autoScoringTurns);
                            const needsRestore = isTowerStage && (fromPayload.totalTurns == null || fromPayload.totalTurns === 0);
                            const needsCurrentPlayerRestore = isTowerStage;
                            try {
                                const stored =
                                    typeof sessionStorage !== 'undefined'
                                        ? sessionStorage.getItem(`gameState_${id}`)
                                        : null;
                                if (stored) {
                                    const parsed = JSON.parse(stored) as Record<string, unknown>;
                                    if (parsed.gameId === id) {
                                        let merged: LiveGameSession = next[id] || fromPayload;
                                        if (needsRestore || needsCurrentPlayerRestore) {
                                            const storedTotal =
                                                needsRestore &&
                                                typeof parsed.totalTurns === 'number' &&
                                                parsed.totalTurns > 0
                                                    ? parsed.totalTurns
                                                    : null;
                                            const storedMovesRaw =
                                                Array.isArray(parsed.moveHistory) && parsed.moveHistory.length > 0
                                                    ? (parsed.moveHistory as LiveGameSession['moveHistory'])
                                                    : null;
                                            const incLen = Array.isArray(fromPayload.moveHistory)
                                                ? fromPayload.moveHistory.length
                                                : 0;
                                            const stLen = storedMovesRaw?.length ?? 0;
                                            const useStoredMoves =
                                                storedMovesRaw != null &&
                                                (stLen > incLen || (incLen === 0 && stLen > 0));
                                            const storedMoves = useStoredMoves ? storedMovesRaw : null;
                                            const inferredCurrentPlayer =
                                                needsCurrentPlayerRestore && storedMoves && storedMoves.length > 0
                                                    ? inferCurrentPlayerFromLastStoredMove(
                                                          storedMoves[storedMoves.length - 1] as { player?: number },
                                                      )
                                                    : null;
                                            if (storedTotal != null || storedMoves != null || inferredCurrentPlayer != null) {
                                                merged = {
                                                    ...merged,
                                                    ...(storedTotal != null ? { totalTurns: storedTotal } : {}),
                                                    ...(storedMoves != null ? { moveHistory: storedMoves } : {}),
                                                    ...(inferredCurrentPlayer != null
                                                        ? { currentPlayer: inferredCurrentPlayer }
                                                        : {}),
                                                };
                                            }
                                        }
                                        next[id] = augmentPveFromSessionStorageSnapshot(merged, parsed);
                                    }
                                }
                            } catch {
                                /* ignore */
                            }
                            const existing = prev[id];
                            if (existing?.boardState != null && Array.isArray(existing.boardState) && existing.boardState.length > 0) {
                                const payloadHasBoard = Array.isArray(fromPayload.boardState) && fromPayload.boardState.length > 0;
                                if (!payloadHasBoard) {
                                    next[id] = {
                                        ...(next[id] || fromPayload),
                                        boardState: existing.boardState,
                                        moveHistory: existing.moveHistory ?? (next[id] || fromPayload).moveHistory,
                                        currentPlayer: existing.currentPlayer ?? (next[id] || fromPayload).currentPlayer,
                                        totalTurns: existing.totalTurns ?? (next[id] || fromPayload).totalTurns,
                                        captures: existing.captures ?? (next[id] || fromPayload).captures,
                                        lastMove: existing.lastMove ?? (next[id] || fromPayload).lastMove,
                                        blackTimeLeft: existing.blackTimeLeft ?? (next[id] || fromPayload).blackTimeLeft,
                                        whiteTimeLeft: existing.whiteTimeLeft ?? (next[id] || fromPayload).whiteTimeLeft,
                                        turnDeadline: existing.turnDeadline ?? (next[id] || fromPayload).turnDeadline,
                                        turnStartTime: existing.turnStartTime ?? (next[id] || fromPayload).turnStartTime,
                                    };
                                }
                            }
                            next[id] = reconcilePlayingSeatLock(next[id]!, prev[id]);
                            next[id] = coerceClassicPveHumanBlackSeatsIfSwapped(next[id]!);
                        }
                        return next;
                    });
                }
                if (otherData.negotiations !== undefined) setNegotiations(otherData.negotiations || {});
                if (otherData.waitingRoomChats !== undefined) {
                    const incoming = otherData.waitingRoomChats || {};
                    const cleared: Record<string, ChatMessage[]> = {};
                    for (const key of Object.keys(incoming)) {
                        cleared[key] = [];
                    }
                    for (const key of ['global', 'strategic', 'playful']) {
                        if (!(key in cleared)) cleared[key] = [];
                    }
                    setWaitingRoomChats(cleared);
                } else {
                    setWaitingRoomChats({ global: [], strategic: [], playful: [] });
                }
                if (otherData.gameChats !== undefined) setGameChats(otherData.gameChats || {});
                if (otherData.adminLogs !== undefined) setAdminLogs(otherData.adminLogs || []);
                if (otherData.announcements !== undefined) setAnnouncements(otherData.announcements || []);
                if (otherData.globalOverrideAnnouncement !== undefined) setGlobalOverrideAnnouncement(otherData.globalOverrideAnnouncement || null);
                if (otherData.gameModeAvailability !== undefined) setGameModeAvailability(otherData.gameModeAvailability || {});
                if (otherData.arenaEntranceAvailability !== undefined) {
                    setArenaEntranceAvailability(mergeArenaEntranceAvailability(otherData.arenaEntranceAvailability));
                }
                if (otherData.announcementInterval !== undefined) setAnnouncementInterval(otherData.announcementInterval || 3);
                if (otherData.kataServerRuntimeConfig !== undefined) {
                    setKataServerRuntimeConfig(otherData.kataServerRuntimeConfig as KataServerRuntimeSnapshot);
                }
                if (otherData.championshipAbilityKataLadder !== undefined) {
                    setChampionshipAbilityKataLadder(otherData.championshipAbilityKataLadder);
                }
                if (otherData.homeBoardPosts !== undefined) setHomeBoardPosts(otherData.homeBoardPosts || []);
                // 길드: INITIAL_STATE와 기존 상태 병합 (GET_GUILD_INFO 등으로 이미 가져온 데이터 우선)
                if (otherData.guilds !== undefined) {
                    setGuilds(prev => ({ ...(otherData.guilds || {}), ...prev }));
                }
            }
        };

        const clearWsPingInterval = () => {
            if (wsPingInterval) {
                clearInterval(wsPingInterval);
                wsPingInterval = null;
            }
        };

        const startWsPingInterval = () => {
            clearWsPingInterval();
            wsPingInterval = setInterval(() => {
                if (ws?.readyState === WebSocket.OPEN) {
                    try {
                        ws.send(JSON.stringify({ type: 'PING' }));
                    } catch {
                        // ignore
                    }
                }
            }, 25_000);
        };

        function scheduleReconnect(reason: string) {
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
            if (!shouldReconnect || !currentUser || isIntentionalClose) return;
            const attempt = wsReconnectAttemptRef.current;
            const delay = Math.min(30000, Math.round(1500 * Math.pow(1.55, attempt)));
            wsReconnectAttemptRef.current = attempt + 1;
            setConnectionNotice({
                kind: 'reconnecting',
                message: tx('common:connection.reconnectingWait'),
                severity: 'warning',
            });
            if (process.env.NODE_ENV === 'development') {
                console.log(`[WebSocket] ${reason}, reconnect in ${delay}ms (attempt ${wsReconnectAttemptRef.current})`);
            }
            reconnectTimeout = setTimeout(() => {
                if (shouldReconnect && currentUser && !isConnecting) {
                    isIntentionalClose = false;
                    connectWebSocket();
                }
            }, delay);
        }

        function connectWebSocket() {
            if (!shouldReconnect || !currentUser) return;
            
            // 이미 연결 중이면 중복 연결 방지
            if (isConnecting) {
                console.log('[WebSocket] Connection already in progress, skipping...');
                return;
            }

            if (wsReconnectAttemptRef.current > 0) {
                setConnectionNotice({
                    kind: 'connecting',
                    message: tx('common:connection.verifyingConnection'),
                    severity: 'info',
                });
            }
            
            // 이미 열려있는 연결이 있으면 재연결하지 않음
            if (ws && ws.readyState === WebSocket.OPEN) {
                console.log('[WebSocket] Connection already open, skipping...');
                return;
            }
            
            // 기존 타임아웃 정리
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
            
            isConnecting = true;
            
            try {
                // Close existing connection if any
                if (ws && ws.readyState !== WebSocket.CLOSED) {
                    console.log('[WebSocket] Closing existing connection before reconnecting');
                    isIntentionalClose = true;
                    const oldWs = ws;
                    ws = null;
                    softCloseWebSocket(oldWs);
                }
                
                // WebSocket URL: apiConfig.ts와 동일 (DEV 기본은 같은 탭 origin → Vite `/ws` 프록시)
                const wsUrl = getWebSocketUrlFor('/ws');
                
                console.log('[WebSocket] Connecting to:', wsUrl);
                console.log('[WebSocket] Current location:', {
                    protocol: window.location.protocol,
                    hostname: window.location.hostname,
                    port: window.location.port,
                    href: window.location.href
                });
                
                try {
                    ws = new WebSocket(wsUrl);
                } catch (error) {
                    console.error('[WebSocket] Failed to create WebSocket:', error);
                    isConnecting = false;
                    if (!isIntentionalClose && shouldReconnect && currentUser) {
                        scheduleReconnect('create failed');
                    }
                    return;
                }
                
                // 연결 타임아웃 설정 (30초)
                let connectionTimeout: NodeJS.Timeout | null = setTimeout(() => {
                    if (ws && ws.readyState === WebSocket.CONNECTING) {
                        console.warn('[WebSocket] Connection timeout, closing...');
                        ws.close();
                    }
                    connectionTimeout = null;
                }, 30000);

                ws.onopen = () => {
                    console.log('[WebSocket] Connected successfully');
                    wsReconnectAttemptRef.current = 0;
                    isIntentionalClose = false;
                    isConnecting = false; // 연결 완료
                    markConnectionRestored();
                    startWsPingInterval();
                    if (connectionTimeout) {
                        clearTimeout(connectionTimeout);
                        connectionTimeout = null;
                    }
                    // 서버에 userId 전송 (대역폭 최적화를 위해 게임 참가자에게만 메시지 전송)
                    if (currentUser?.id && ws && ws.readyState === WebSocket.OPEN) {
                        try {
                            ws.send(JSON.stringify({ type: 'AUTH', userId: currentUser.id }));
                        } catch (e) {
                            console.error('[WebSocket] Failed to send AUTH message:', e);
                        }
                    }
                };

                const scheduleInitialStateTimeout = () => {
                    if (initialStateTimeout) {
                        clearTimeout(initialStateTimeout);
                    }
                    initialStateTimeout = setTimeout(() => {
                        if (!isInitialStateReady) {
                            console.warn('[WebSocket] Initial state chunks timeout, forcing completion.');
                            const buffer = (window as any).__chunkedStateBuffer;
                            const users = buffer?.users || {};
                            const otherData = buffer?.otherData || {};
                            (window as any).__chunkedStateBuffer = null;
                            processInitialState(users, otherData);
                            completeInitialState();
                        }
                    }, 10000);
                };

                const completeInitialState = () => {
                    setActiveGameFromLogin(null);
                    if (initialStateTimeout) {
                        clearTimeout(initialStateTimeout);
                        initialStateTimeout = null;
                    }
                    if (!isInitialStateReady) {
                        isInitialStateReady = true;
                        if (pendingMessages.length > 0) {
                            const bufferedMessages = pendingMessages;
                            pendingMessages = [];
                            bufferedMessages.forEach(message => handleMessage(message, true));
                        }
                    }
                };

                function handleMessage(message: any, fromBuffer = false) {
                    const initialStateTypes = ['INITIAL_STATE_START', 'INITIAL_STATE_CHUNK', 'INITIAL_STATE', 'CONNECTION_ESTABLISHED', 'SERVER_RESTARTING'];

                    if (!fromBuffer && !isInitialStateReady && !initialStateTypes.includes(message.type)) {
                        pendingMessages.push(message);
                        return;
                    }

                    switch (message.type) {
                        case 'SERVER_RESTARTING': {
                            const msg =
                                typeof message.payload?.message === 'string'
                                    ? message.payload.message
                                    : tx('common:connection.serverRestarting');
                            const ms =
                                typeof message.payload?.noticeMs === 'number' && message.payload.noticeMs > 0
                                    ? message.payload.noticeMs
                                    : 8000;
                            setServerReconnectNotice(msg);
                            if (serverReconnectTimerRef.current !== null) {
                                window.clearTimeout(serverReconnectTimerRef.current);
                            }
                            serverReconnectTimerRef.current = window.setTimeout(() => {
                                setServerReconnectNotice(null);
                                serverReconnectTimerRef.current = null;
                            }, ms);
                            return;
                        }
                        case 'CONNECTION_ESTABLISHED':
                            console.log('[WebSocket] Connection established, waiting for initial state...');
                            return;
                        case 'SCHEDULER_MIDNIGHT_COMPLETE': {
                            // 0시 스케줄러 동작 완료 시 서버가 전송. 새로고침하여 일일 퀘스트/던전/랭킹 등 반영
                            console.log('[WebSocket] SCHEDULER_MIDNIGHT_COMPLETE received, refreshing page');
                            window.location.reload();
                            return;
                        }
                        case 'INITIAL_STATE_START': {
                            console.log('[WebSocket] Receiving chunked initial state (start):', {
                                chunkIndex: message.payload.chunkIndex,
                                totalChunks: message.payload.totalChunks
                            });
                            isInitialStateReady = false;
                            pendingMessages = [];
                            scheduleInitialStateTimeout();
                            (window as any).__chunkedStateBuffer = {
                                users: {},
                                receivedChunks: 0,
                                totalChunks: message.payload.totalChunks,
                                otherData: null
                            };
                            const startBuffer = (window as any).__chunkedStateBuffer;
                            Object.assign(startBuffer.users, message.payload.users);
                            startBuffer.otherData = {
                                onlineUsers: message.payload.onlineUsers,
                                liveGames: message.payload.liveGames,
                                singlePlayerGames: message.payload.singlePlayerGames,
                                towerGames: message.payload.towerGames,
                                negotiations: message.payload.negotiations,
                                waitingRoomChats: message.payload.waitingRoomChats,
                                gameChats: message.payload.gameChats,
                                adminLogs: message.payload.adminLogs,
                                announcements: message.payload.announcements,
                                globalOverrideAnnouncement: message.payload.globalOverrideAnnouncement,
                                gameModeAvailability: message.payload.gameModeAvailability,
                                arenaEntranceAvailability: message.payload.arenaEntranceAvailability,
                                announcementInterval: message.payload.announcementInterval,
                                homeBoardPosts: message.payload.homeBoardPosts,
                                guilds: message.payload.guilds || {},
                                kataServerRuntimeConfig: message.payload.kataServerRuntimeConfig,
                                championshipAbilityKataLadder: message.payload.championshipAbilityKataLadder,
                            };
                            startBuffer.receivedChunks++;
                            if (message.payload.isLast) {
                                processInitialState(startBuffer.users, startBuffer.otherData);
                                (window as any).__chunkedStateBuffer = null;
                                completeInitialState();
                            }
                            return;
                        }
                        case 'INITIAL_STATE_CHUNK': {
                            if (!(window as any).__chunkedStateBuffer) {
                                console.warn('[WebSocket] Received chunk without INITIAL_STATE_START, initializing buffer...');
                                (window as any).__chunkedStateBuffer = {
                                    users: {},
                                    receivedChunks: 0,
                                    totalChunks: message.payload.totalChunks || 0,
                                    otherData: null
                                };
                            }
                            isInitialStateReady = false;
                            scheduleInitialStateTimeout();
                            const chunkBuffer = (window as any).__chunkedStateBuffer;
                            Object.assign(chunkBuffer.users, message.payload.users);
                            chunkBuffer.receivedChunks++;
                            console.log(`[WebSocket] Received chunk ${chunkBuffer.receivedChunks}/${chunkBuffer.totalChunks || '?'} (index ${message.payload.chunkIndex})`);
                            if (message.payload.isLast) {
                                console.log('[WebSocket] All chunks received, processing...');
                                if (!chunkBuffer.otherData) {
                                chunkBuffer.otherData = {
                                    onlineUsers: message.payload.onlineUsers,
                                    liveGames: message.payload.liveGames,
                                    singlePlayerGames: message.payload.singlePlayerGames,
                                    towerGames: message.payload.towerGames,
                                    negotiations: message.payload.negotiations,
                                    waitingRoomChats: message.payload.waitingRoomChats,
                                    gameChats: message.payload.gameChats,
                                    adminLogs: message.payload.adminLogs,
                                    announcements: message.payload.announcements,
                                    globalOverrideAnnouncement: message.payload.globalOverrideAnnouncement,
                                    gameModeAvailability: message.payload.gameModeAvailability,
                                    arenaEntranceAvailability: message.payload.arenaEntranceAvailability,
                                    announcementInterval: message.payload.announcementInterval,
                                    homeBoardPosts: message.payload.homeBoardPosts,
                                    guilds: message.payload.guilds || chunkBuffer.otherData?.guilds || {},
                                    kataServerRuntimeConfig: message.payload.kataServerRuntimeConfig,
                                    championshipAbilityKataLadder: message.payload.championshipAbilityKataLadder,
                                };
                                }
                                processInitialState(chunkBuffer.users, chunkBuffer.otherData);
                                (window as any).__chunkedStateBuffer = null;
                                completeInitialState();
                                console.log('[WebSocket] Chunked initial state processed successfully');
                            }
                            return;
                        }
                        case 'INITIAL_STATE': {
                            console.log('INITIAL_STATE payload:', message.payload);
                            isInitialStateReady = false;
                            pendingMessages = [];
                            scheduleInitialStateTimeout();
                            const {
                                users,
                                onlineUsers,
                                liveGames,
                                singlePlayerGames,
                                towerGames,
                                negotiations,
                                waitingRoomChats,
                                gameChats,
                                adminLogs,
                                announcements,
                                globalOverrideAnnouncement,
                                gameModeAvailability,
                                arenaEntranceAvailability,
                                announcementInterval,
                                homeBoardPosts,
                                guilds,
                                singlePlayerStages,
                                kataServerRuntimeConfig,
                                championshipAbilityKataLadder,
                            } = message.payload;
                            processInitialState(users, {
                                onlineUsers,
                                liveGames,
                                singlePlayerGames,
                                towerGames,
                                negotiations,
                                waitingRoomChats,
                                gameChats,
                                adminLogs,
                                announcements,
                                globalOverrideAnnouncement,
                                gameModeAvailability,
                                arenaEntranceAvailability,
                                announcementInterval,
                                homeBoardPosts,
                                guilds,
                                singlePlayerStages,
                                kataServerRuntimeConfig,
                                championshipAbilityKataLadder,
                            });
                            completeInitialState();
                            return;
                        }
                        case 'KATA_SERVER_RUNTIME_CONFIG_UPDATE': {
                            const cfg = (message.payload as any)?.kataServerRuntimeConfig;
                            if (cfg != null) setKataServerRuntimeConfig(cfg as KataServerRuntimeSnapshot);
                            return;
                        }
                        case 'CHAMPIONSHIP_ABILITY_KATA_LADDER_UPDATE': {
                            const ladder = (message.payload as any)?.championshipAbilityKataLadder;
                            if (Array.isArray(ladder) && ladder.length > 0) {
                                setChampionshipAbilityKataLadder(ladder);
                            }
                            return;
                        }
                        case 'SINGLE_PLAYER_STAGES_UPDATE': {
                            const stages = (message.payload as any)?.singlePlayerStages;
                            if (stages !== undefined) {
                                setSinglePlayerStagesFromServer(stages);
                            }
                            // pending 싱글 세션에 최신 스테이지 정의 즉시 반영(관리자 편집·순서 저장 후 추가 동기화 단계 제거)
                            queueMicrotask(() => {
                                const uid = currentUserRef.current?.id;
                                if (!uid) return;
                                for (const g of Object.values(singlePlayerGamesRef.current)) {
                                    if (getSessionArenaKind(g) === 'singleplayer' && g.gameStatus === 'pending' && g.blackPlayerId === uid) {
                                        void handleActionRef
                                            .current({
                                                type: 'SINGLE_PLAYER_SYNC_PENDING_STAGE',
                                                payload: { gameId: g.id },
                                            } as ServerAction)
                                            .catch(() => {});
                                        break;
                                    }
                                }
                            });
                            return;
                        }
                        case 'USER_UPDATE': {
                            const payload = message.payload || {};
                            const updatedCurrentUser = currentUser ? payload[currentUser.id] : undefined;

                            setUsersMap((currentUsersMap) => {
                                const updatedUsersMap = { ...currentUsersMap };
                                Object.entries(payload).forEach(([userId, updatedUserData]: [string, any]) => {
                                    const prevRow = currentUsersMap[userId];
                                    const mergedRow = {
                                        ...(prevRow || {}),
                                        ...(updatedUserData || {}),
                                    } as Record<string, unknown>;
                                    const lv = coerceUserLevelXpFromPayload(mergedRow);
                                    updatedUsersMap[userId] = { ...mergedRow, userLevel: lv.userLevel, userXp: lv.userXp } as User;
                                });
                                return updatedUsersMap;
                            });

                            setOnlineUsers((prevOnline) => {
                                if (!Array.isArray(prevOnline) || prevOnline.length === 0) return prevOnline;
                                let changed = false;
                                const next = prevOnline.map((u) => {
                                    const patch = (payload as Record<string, any>)[u.id];
                                    if (!patch || typeof patch !== 'object') return u;
                                    changed = true;
                                    const merged = { ...u } as Record<string, unknown>;
                                    for (const [k, v] of Object.entries(patch)) {
                                        if (v !== undefined) merged[k] = v;
                                    }
                                    return merged as unknown as UserWithStatus;
                                });
                                return changed ? next : prevOnline;
                            });

                            setUserBriefCache((prevBrief) => {
                                let nextBrief: typeof prevBrief | null = null;
                                for (const userId of Object.keys(payload as Record<string, unknown>)) {
                                    const p = (payload as Record<string, any>)[userId];
                                    if (!p || typeof p !== 'object' || !('blockArenaPartnerInvites' in p)) continue;
                                    if (!nextBrief) nextBrief = { ...prevBrief };
                                    const prevEntry = nextBrief[userId];
                                    if (prevEntry) {
                                        nextBrief[userId] = {
                                            ...prevEntry,
                                            blockArenaPartnerInvites: p.blockArenaPartnerInvites === true,
                                        };
                                    }
                                }
                                return nextBrief ?? prevBrief;
                            });

                            if (currentUser && updatedCurrentUser && updatedCurrentUser.id === currentUser.id) {
                                const now = Date.now();
                                const timeSinceLastHttpUpdate = now - lastHttpUpdateTime.current;
                                const hasNicknameUpdate = updatedCurrentUser.nickname !== undefined && updatedCurrentUser.nickname !== currentUser.nickname;
                                const hasAdventureProfileUpdate = updatedCurrentUser.adventureProfile !== undefined;
                                /** 타 유저 구매 등으로 서버가 보낸 거래소 상태 — HTTP 디바운스로 버리면 판매 완료·정산 동기화가 깨짐 */
                                const hasExchangeStatePayload = updatedCurrentUser.exchangeState !== undefined;
                                /** 거래소 구매 직후 서버가 보내는 WS는 인벤·재화 동기화용 — HTTP 디바운스로 버리면 가방에 장비가 늦게/안 보일 수 있음 */
                                const isPostExchangePurchaseInventoryWs =
                                    lastHttpActionType.current === 'PURCHASE_EXCHANGE_LISTING' &&
                                    Array.isArray(updatedCurrentUser.inventory);
                                /** 거래소 등록·목록 저장 직후 WS — 디바운스로 isExchangeListed가 빠지면 가방에 그대로 보임 */
                                const isPostExchangeListingInventoryWs =
                                    (lastHttpActionType.current === 'MARK_ITEM_EXCHANGE_LISTED' ||
                                        lastHttpActionType.current === 'SAVE_EXCHANGE_STATE') &&
                                    Array.isArray(updatedCurrentUser.inventory);
                                const isPostCombineInventoryWs =
                                    lastHttpActionType.current === 'COMBINE_ITEMS' &&
                                    Array.isArray(updatedCurrentUser.inventory);
                                /** 도전의 탑 종료 직후 서버 브로드캐스트 인벤 — HTTP 직후 디바운스에 걸리면 다음 층 가방 수가 안 바뀜 */
                                const isPostTowerGameEndInventoryWs =
                                    lastHttpActionType.current === 'END_TOWER_GAME' &&
                                    Array.isArray(updatedCurrentUser.inventory);
                                const isPostUseConditionPotionSyncWs = isConditionPotionUseSyncWs(
                                    lastHttpActionType.current,
                                    updatedCurrentUser,
                                );
                                const isPostBuyConditionPotionSyncWs = isConditionPotionBuySyncWs(
                                    lastHttpActionType.current,
                                    updatedCurrentUser,
                                );
                                const isPostConditionPotionInventoryIncreaseWs = isConditionPotionInventoryIncreaseWs(
                                    updatedCurrentUser,
                                    currentUserRef.current?.inventory,
                                    {
                                        lastHttpActionType: lastHttpActionType.current,
                                        useInFlight: useConditionPotionInFlightRef.current,
                                    },
                                );

                                const hadHttpUpdate = lastHttpUpdateTime.current > 0;
                                const httpUpdateHadUser = lastHttpHadUpdatedUser.current;

                                if (!hasNicknameUpdate && !hasAdventureProfileUpdate && !hasExchangeStatePayload) {
                                    if (
                                        !isPostExchangePurchaseInventoryWs &&
                                        !isPostExchangeListingInventoryWs &&
                                        !isPostCombineInventoryWs &&
                                        !isPostTowerGameEndInventoryWs &&
                                        !isPostUseConditionPotionSyncWs &&
                                        !isPostBuyConditionPotionSyncWs &&
                                        !isPostConditionPotionInventoryIncreaseWs &&
                                        hadHttpUpdate &&
                                        httpUpdateHadUser &&
                                        timeSinceLastHttpUpdate < HTTP_UPDATE_DEBOUNCE_MS
                                    ) {
                                        console.log(`[WebSocket] USER_UPDATE ignored (${timeSinceLastHttpUpdate}ms since HTTP update with user, debounce: ${HTTP_UPDATE_DEBOUNCE_MS}ms, last action: ${lastHttpActionType.current})`);
                                        return;
                                    }
                                    if (!httpUpdateHadUser && lastHttpActionType.current) {
                                        console.log(`[WebSocket] USER_UPDATE applied immediately (HTTP response had no updatedUser for ${lastHttpActionType.current})`);
                                        lastHttpUpdateTime.current = now;
                                        lastHttpHadUpdatedUser.current = true;
                                    }
                                    if (
                                        !isPostExchangePurchaseInventoryWs &&
                                        !isPostExchangeListingInventoryWs &&
                                        !isPostCombineInventoryWs &&
                                        !isPostTowerGameEndInventoryWs &&
                                        !isPostUseConditionPotionSyncWs &&
                                        !isPostBuyConditionPotionSyncWs &&
                                        !isPostConditionPotionInventoryIncreaseWs &&
                                        hadHttpUpdate &&
                                        httpUpdateHadUser &&
                                        timeSinceLastHttpUpdate < HTTP_UPDATE_DEBOUNCE_MS * 2 &&
                                        lastHttpActionType.current
                                    ) {
                                        console.log(`[WebSocket] USER_UPDATE ignored (possible stale data, ${timeSinceLastHttpUpdate}ms since HTTP update)`);
                                        return;
                                    }
                                }
                                // 닉네임/모험 도감 프로필 변경은 디바운스 없이 항상 즉시 반영

                                let userUpdatePatch: Partial<User> = sanitizeConditionPotionUserUpdatePatch(
                                    updatedCurrentUser,
                                    {
                                        lastHttpActionType: lastHttpActionType.current,
                                        useInFlight: useConditionPotionInFlightRef.current,
                                        prevInventory: currentUserRef.current?.inventory,
                                    },
                                );
                                if (userUpdatePatch !== updatedCurrentUser) {
                                    const refPotionQty = countConditionPotionsInInventory(currentUserRef.current?.inventory);
                                    const incomingPotionQty = countConditionPotionsInInventory(
                                        updatedCurrentUser.inventory as InventoryItem[] | undefined,
                                    );
                                    console.log(
                                        '[WebSocket] Dropped stale inventory from USER_UPDATE (fewer condition potions than client)',
                                        { refPotionQty, incomingPotionQty },
                                    );
                                }

                                const mergedUser = applyUserUpdate(userUpdatePatch, 'USER_UPDATE-websocket');
                                console.log('[WebSocket] Applied USER_UPDATE for currentUser:', {
                                    inventoryLength: mergedUser.inventory?.length,
                                    gold: mergedUser.gold,
                                    diamonds: mergedUser.diamonds,
                                    equipment: mergedUser.equipment,
                                    actionPoints: mergedUser.actionPoints,
                                    clearedSinglePlayerStages: mergedUser.clearedSinglePlayerStages,
                                    singlePlayerProgress: mergedUser.singlePlayerProgress
                                });
                                
                                // currentUser 상태 업데이트 (clearedSinglePlayerStages 반영)
                                setCurrentUser(mergedUser);
                                currentUserRef.current = mergedUser;
                            }
                            return;
                        }
                        case 'RANKED_MATCHING_UPDATE': {
                            const queue = message.payload?.queue;
                            setRankedMatchingQueue(queue && typeof queue === 'object' ? queue : {});
                            return;
                        }
                        case 'RANKED_MATCH_PROPOSAL': {
                            const payload = message.payload;
                            const meId = currentUserRef.current?.id;
                            if (
                                payload?.proposalId &&
                                payload?.player1?.id &&
                                payload?.player2?.id &&
                                meId &&
                                (payload.player1.id === meId || payload.player2.id === meId)
                            ) {
                                setRankedMatchProposal({
                                    proposalId: payload.proposalId,
                                    acceptDeadlineAt: payload.acceptDeadlineAt ?? Date.now() + 30_000,
                                    player1: payload.player1,
                                    player2: payload.player2,
                                });
                            }
                            return;
                        }
                        case 'RANKED_MATCH_PROPOSAL_CANCELLED': {
                            const userIds = message.payload?.userIds as string[] | undefined;
                            const meId = currentUserRef.current?.id;
                            if (meId && Array.isArray(userIds) && userIds.includes(meId)) {
                                setRankedMatchProposal(null);
                            }
                            return;
                        }
                        case 'RANKED_MATCH_FOUND': {
                            if (message.payload?.gameId && message.payload?.player1 && message.payload?.player2) {
                                setRankedMatchProposal(null);
                                setRankedMatchFound({
                                    gameId: message.payload.gameId,
                                    player1: message.payload.player1,
                                    player2: message.payload.player2,
                                });
                            }
                            return;
                        }
                        case 'PAIR_ROOM_UPDATE': {
                            const rooms = message.payload?.rooms;
                            if (rooms && typeof rooms === 'object') {
                                setPairRooms(rooms);
                                setPairRoomChatByRoomId((prev) => {
                                    const next = { ...prev };
                                    const activeIds = new Set(Object.keys(rooms as Record<string, unknown>));
                                    for (const k of Object.keys(next)) {
                                        if (!activeIds.has(k)) delete next[k];
                                    }
                                    for (const [rid, room] of Object.entries(rooms as Record<string, any>)) {
                                        const pub = room?.pairChatMessages as PairRoomChatLine[] | undefined;
                                        if (!pub?.length) continue;
                                        const existing = next[rid] || [];
                                        const byId = new Map<string, PairRoomChatLine>(existing.map((m) => [m.id, m]));
                                        for (const m of pub) {
                                            if (m.scope === 'room') byId.set(m.id, m);
                                        }
                                        next[rid] = [...byId.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-120);
                                    }
                                    return next;
                                });
                            } else {
                                setPairRooms({});
                            }
                            return;
                        }
                        case 'PAIR_ROOM_CHAT': {
                            const roomId = message.payload?.roomId as string | undefined;
                            const chatMsg = message.payload?.message as PairRoomChatLine | undefined;
                            if (!roomId || !chatMsg?.id) return;
                            setPairRoomChatByRoomId((prev) => ({
                                ...prev,
                                [roomId]: [...(prev[roomId] || []), chatMsg].slice(-120),
                            }));
                            return;
                        }
                        case 'PAIR_PARTNER_INVITE_UPDATE': {
                            const invites = message.payload?.invites;
                            setPairPartnerInvites(invites && typeof invites === 'object' ? invites : {});
                            return;
                        }
                        case 'PAIR_PARTNER_INVITE_DECLINED': {
                            const inviterId = message.payload?.inviterId;
                            const inviteeId = message.payload?.inviteeId;
                            const meId = currentUserRef.current?.id;
                            if (meId && inviterId === meId && typeof inviteeId === 'string') {
                                setPairInviteCooldownUntilByInviteeId((prev) => ({
                                    ...prev,
                                    [inviteeId]: Date.now() + 10000,
                                }));
                            }
                            return;
                        }
                        case 'USER_STATUS_UPDATE': {
                            setUsersMap(currentUsersMap => {
                                const updatedUsersMap = { ...currentUsersMap };
                                const rawPayload = message.payload as Record<string, unknown> | undefined;
                                const statusMap: Record<string, unknown> | undefined = (() => {
                                    if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
                                        return rawPayload as Record<string, unknown> | undefined;
                                    }
                                    const nested = (rawPayload as { userStatuses?: unknown }).userStatuses;
                                    if (
                                        nested &&
                                        typeof nested === 'object' &&
                                        !Array.isArray(nested) &&
                                        Object.keys(rawPayload).length === 1 &&
                                        'userStatuses' in rawPayload
                                    ) {
                                        return nested as Record<string, unknown>;
                                    }
                                    return rawPayload as Record<string, unknown>;
                                })();
                                const onlineStatuses = Object.entries(statusMap || {})
                                    .filter(([id]) => !isSyntheticOnlineUserId(id))
                                    .map(([id, statusInfo]: [string, any]) => {
                                    let user: User | undefined = currentUsersMap[id];
                                    if (!user) {
                                        const allUsersArray = Object.values(currentUsersMap);
                                        user = allUsersArray.find((u: any) => u?.id === id) as User | undefined;
                                    }
                                    if (user) {
                                        if (!updatedUsersMap[id]) updatedUsersMap[id] = user;
                                        return { ...user, ...statusInfo };
                                    }
                                    // 새로 접속한 유저(usersMap에 없음): 본인이면 currentUser로 닉네임 즉시 표시, 아니면 최소 정보로 포함 후 /api/users/brief로 로드
                                    const isCurrentUser = currentUser && id === currentUser.id;
                                    const minimalUser = (isCurrentUser ? { ...currentUser, ...statusInfo } : { id, ...statusInfo }) as UserWithStatus;
                                    if (isCurrentUser) updatedUsersMap[id] = minimalUser;
                                    return minimalUser;
                                    })
                                    .filter(Boolean) as UserWithStatus[];
                                setOnlineUsers(onlineStatuses);

                                if (currentUser) {
                                    const currentUserStatus = onlineStatuses.find(u => u.id === currentUser.id);
                                    if (currentUserStatus) {
                                        if (currentUserStatus.gameId && currentUserStatus.status === 'in-game') {
                                            const gameId = currentUserStatus.gameId;
                                            const gameCategory = currentUserStatus.gameCategory;
                                            console.log('[WebSocket] Current user status updated to in-game:', gameId, 'gameCategory:', gameCategory);
                                            
                                            // 모든 게임 카테고리에서 게임 찾기. ref 사용해 최신 state 반영 (CONFIRM_AI_GAME_START HTTP 응답 후 폴링이 게임을 찾도록)
                                            const checkAllGames = () => {
                                                const lg = liveGamesRef.current;
                                                const sg = singlePlayerGamesRef.current;
                                                const tg = towerGamesRef.current;
                                                let game = lg[gameId] || sg[gameId] || tg[gameId];
                                                if (game) {
                                                    console.log('[WebSocket] Game found, routing immediately');
                                                    setTimeout(() => {
                                                        window.location.hash = `#/game/${gameId}`;
                                                    }, 100);
                                                    return true;
                                                }
                                                const pending = pendingAiGameEntryRef.current;
                                                if (pending?.gameId === gameId && pending.game && Date.now() < pending.until) {
                                                    setLiveGames(prev => ({ ...prev, [gameId]: { ...prev[gameId], ...pending.game } }));
                                                    console.log('[WebSocket] Game found from CONFIRM_AI_GAME_START ref, merging and routing');
                                                    setTimeout(() => {
                                                        window.location.hash = `#/game/${gameId}`;
                                                    }, 100);
                                                    return true;
                                                }
                                                return false;
                                            };
                                            
                                            // 즉시 확인
                                            if (!checkAllGames()) {
                                                console.log('[WebSocket] Game not found yet, will wait for GAME_UPDATE');
                                                let attempts = 0;
                                                const maxAttempts = 20;
                                                const checkGame = () => {
                                                    attempts++;
                                                    if (checkAllGames()) {
                                                        return;
                                                    } else if (attempts < maxAttempts) {
                                                        setTimeout(checkGame, 200);
                                                    } else {
                                                        console.warn('[WebSocket] Game not found after max attempts:', gameId);
                                                    }
                                                };
                                                setTimeout(checkGame, 200);
                                            }
                                        } else if ((currentUserStatus.status === 'waiting' || currentUserStatus.status === 'resting') && !currentUserStatus.gameId) {
                                            const currentHash = window.location.hash;
                                            const isGamePage = currentHash.startsWith('#/game/');
                                            if (isGamePage) {
                                                const gameIdFromHash = currentHash.replace('#/game/', '');
                                                const currentGame = liveGames[gameIdFromHash] || singlePlayerGames[gameIdFromHash] || towerGames[gameIdFromHash];

                                                // 계가 중 새로고침: INITIAL_STATE가 아직 안 왔으면 게임이 없을 수 있음 → 리다이렉트하지 않고 대기
                                                if (!currentGame) {
                                                    console.log('[WebSocket] On game page but game not in state yet (e.g. after refresh), keeping user on game page:', gameIdFromHash);
                                                    return updatedUsersMap;
                                                }
                                                // scoring 상태의 게임은 리다이렉트하지 않음 (계가 진행 중)
                                                if (currentGame.gameStatus === 'scoring') {
                                                    console.log('[WebSocket] Game is in scoring state, keeping user on game page:', gameIdFromHash);
                                                    return updatedUsersMap;
                                                }

                                                const postGameRedirect = sessionStorage.getItem('postGameRedirect');
                                                if (postGameRedirect) {
                                                    console.log('[WebSocket] Current user status updated to waiting, routing to postGameRedirect:', postGameRedirect);
                                                    sessionStorage.removeItem('postGameRedirect');
                                                    setTimeout(() => {
                                                        replaceAppHash(postGameRedirect);
                                                    }, 100);
                                                } else {
                                                    const mode = currentUserStatus.mode;
                                                    // mode가 없고 status가 Waiting이면 strategic/playful 대기실로 이동
                                                    // (LEAVE_GAME_ROOM 후 서버에서 strategic/playful로 설정한 경우)
                                                    if (!mode && (currentUserStatus.status === UserStatus.Waiting || currentUserStatus.status === UserStatus.Resting)) {
                                                        console.log('[WebSocket] Current user status updated to waiting without mode, checking previous game mode');
                                                        // 이전 게임의 모드를 확인하여 대기실로 이동
                                                        // 게임 페이지에서 나온 경우, 게임 모드를 확인
                                                        const gameIdFromHash = currentHash.replace('#/game/', '');
                                                        const currentGame = liveGames[gameIdFromHash] || singlePlayerGames[gameIdFromHash] || towerGames[gameIdFromHash];
                                                        if (currentGame && getSessionArenaKind(currentGame) !== 'singleplayer' && currentGame.mode) {
                                                            if ((currentGame.settings as { pairGame?: unknown } | undefined)?.pairGame) {
                                                                console.log('[WebSocket] Pair game session → pair arena');
                                                                setTimeout(() => {
                                                                    replaceAppHash(
                                                                        arenaLobbyHashFromSession(currentGame as any),
                                                                    );
                                                                }, 100);
                                                            } else {
                                                                let waitingRoomMode: 'strategic' | 'playful' | null = null;
                                                                if (SPECIAL_GAME_MODES.some(m => m.mode === currentGame.mode)) {
                                                                    waitingRoomMode = 'strategic';
                                                                } else if (PLAYFUL_GAME_MODES.some(m => m.mode === currentGame.mode)) {
                                                                    waitingRoomMode = 'playful';
                                                                }
                                                                if (waitingRoomMode) {
                                                                    console.log('[WebSocket] Routing to waiting room based on game mode:', waitingRoomMode);
                                                                    setTimeout(() => {
                                                                        replaceAppHash(
                                                                            arenaLobbyHash({
                                                                                intent: currentGame.isAiGame ? 'ai' : 'pvp',
                                                                                channel: waitingRoomMode,
                                                                            }),
                                                                        );
                                                                    }, 100);
                                                                }
                                                            }
                                                        }
                                                    } else if (mode) {
                                                        console.warn('[WebSocket] Individual game mode detected, redirecting to profile:', mode);
                                                        setTimeout(() => {
                                                            replaceAppHash(APP_HOME_HASH);
                                                        }, 100);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                return updatedUsersMap;
                            });
                            return;
                        }
                        case 'WAITING_ROOM_CHAT_UPDATE': {
                            const sessionStart = waitingRoomChatSessionStartRef.current;
                            setWaitingRoomChats(currentChats => {
                                const updatedChats = { ...currentChats };
                                Object.entries(message.payload || {}).forEach(([channel, messages]: [string, any]) => {
                                    const arr = Array.isArray(messages) ? messages : [];
                                    updatedChats[channel] =
                                        sessionStart > 0
                                            ? arr.filter((m: ChatMessage) => (m?.timestamp ?? 0) >= sessionStart)
                                            : arr;
                                });
                                return updatedChats;
                            });
                            return;
                        }
                        case 'GAME_CHAT_UPDATE': {
                            setGameChats(currentChats => {
                                const updatedChats = { ...currentChats };
                                Object.entries(message.payload || {}).forEach(([gameId, messages]: [string, any]) => {
                                    updatedChats[gameId] = messages;
                                });
                                return updatedChats;
                            });
                            return;
                        }
                        case 'GAME_UPDATE': {
                            Object.entries(message.payload || {}).forEach(([gameId, game]: [string, any]) => {
                                // 성능 최적화: GAME_UPDATE 메시지 쓰로틀링 (같은 게임에 대해 최대 100ms당 1회만 처리)
                                const now = Date.now();
                                const lastUpdateTime = lastGameUpdateTimeRef.current[gameId] || 0;
                                const incomingMoveCount = (game.moveHistory && Array.isArray(game.moveHistory)) ? game.moveHistory.length : 0;
                                const lastProcessedMoveCount = lastGameUpdateMoveCountRef.current[gameId] ?? 0;
                                // 새 수(AI 수 등)가 있으면 반드시 처리 - 쓰로틀 무시 (바둑판에 돌이 안 보이는 버그 방지)
                                const hasNewMoves = incomingMoveCount > lastProcessedMoveCount;
                                // 알까기/컬링 등 놀이바둑은 moveHistory를 쓰지 않으므로, 이 경우 항상 업데이트 적용 (AI 배치가 스킵되는 버그 방지)
                                const isPlayfulBoardUpdate = !!(game.alkkagiStones || game.curlingStones || (game.gameStatus && (String(game.gameStatus).startsWith('alkkagi_') || String(game.gameStatus).startsWith('curling_'))));
                                // 주사위/도둑 굴리기 애니메이션: moveHistory가 안 바뀌어도 반영 (두 번째 턴부터 애니 안 나오는 버그 방지)
                                const isDiceRollAnimationUpdate = game.gameStatus === 'dice_rolling_animating' || game.gameStatus === 'thief_rolling_animating' || game.animation?.type === 'dice_roll_main';
                                // 주사위/도둑 착수: moveHistory가 안 늘어나도 보드·stonesToPlace가 매 수 바뀜. 쓰로틀에 걸리면 상대 화면에 돌/남은 수가 빠지는 버그 발생
                                const isDiceThiefPlacingUpdate =
                                    game.gameStatus === 'dice_placing' || game.gameStatus === 'thief_placing';
                                const isScoringOrRevealUpdate = game.gameStatus === 'scoring' || game.gameStatus === 'hidden_final_reveal';
                                // 따내기 바둑 입찰/재입찰 단계 전환은 moveHistory 변화가 없어도 반드시 반영
                                const isCaptureBidPhaseUpdate =
                                    game.gameStatus === 'capture_bidding' ||
                                    game.gameStatus === 'capture_reveal' ||
                                    game.gameStatus === 'capture_tiebreaker';
                                const isTerminalGameUpdate = game.gameStatus === 'ended' || game.gameStatus === 'no_contest';
                                // 싱글/타워: 스캔 애니메이션 종료 후 playing 전환은 수순이 그대로라 쓰로틀에 걸리면 클라이언트가 scanning_animating에 고정되는 버그 방지
                                const existingForThrottle =
                                    singlePlayerGamesRef.current[gameId] ??
                                    towerGamesRef.current[gameId] ??
                                    liveGamesRef.current[gameId];
                                // 스캔 연속 모드(scanning)에서 30초 타임아웃으로 playing 전환 시 moveHistory가 그대로라
                                // 쓰로틀에 걸리면 클라이언트가 scanning·0초에 고착될 수 있음 (scanning_animating과 동일하게 반드시 반영)
                                const isScanAnimExitToPlaying =
                                    (existingForThrottle?.gameStatus === 'scanning_animating' ||
                                        existingForThrottle?.gameStatus === 'scanning') &&
                                    game.gameStatus === 'playing';
                                const isHiddenPlacingExitToPlaying =
                                    existingForThrottle?.gameStatus === 'hidden_placing' &&
                                    game.gameStatus === 'playing';
                                const isHiddenPlacingEntry =
                                    game.gameStatus === 'hidden_placing' &&
                                    existingForThrottle?.gameStatus !== 'hidden_placing' &&
                                    !shouldIgnoreStaleServerHiddenPlacingAfterClientCommit(existingForThrottle, game);
                                const isScanningEntry =
                                    game.gameStatus === 'scanning' &&
                                    existingForThrottle?.gameStatus !== 'scanning';
                                const isScanningAnimEntry =
                                    game.gameStatus === 'scanning_animating' &&
                                    existingForThrottle?.gameStatus !== 'scanning_animating';
                                const incomingHintUsage = (game.settings as { strategicPetHintByUserId?: Record<string, unknown> })
                                    ?.strategicPetHintByUserId;
                                const existingHintUsage = (existingForThrottle?.settings as {
                                    strategicPetHintByUserId?: Record<string, unknown>;
                                })?.strategicPetHintByUserId;
                                const isStrategicPetHintUsageUpdate =
                                    stableStringify(incomingHintUsage ?? null) !==
                                    stableStringify(existingHintUsage ?? null);
                                // 미사일: moveHistory 길이는 그대로라 쓰로틀에 걸리면 LAUNCH_MISSILE 보드 반영 또는 애니 종료(playing) 전환이 누락되어
                                // 애니메이션만 재생되고 돌이 원래 칸에 남아 보이는 현상이 난다.
                                const isMissileSelectEntry =
                                    game.gameStatus === 'missile_selecting' &&
                                    existingForThrottle?.gameStatus !== 'missile_selecting';
                                const isMissileSelectToAnimating =
                                    existingForThrottle?.gameStatus === 'missile_selecting' &&
                                    game.gameStatus === 'missile_animating';
                                // playing 등에서 바로 missile_animating으로 올 때도 moveHistory 길이가 같아
                                // 100ms 쓰로틀에 걸리면 클라가 playing에 고착되어 REQUEST_SERVER_AI_MOVE가 반복된다.
                                const isMissileAnimatingEntry =
                                    game.gameStatus === 'missile_animating' &&
                                    existingForThrottle?.gameStatus !== 'missile_animating';
                                const isMissileAnimExitToPlaying =
                                    existingForThrottle?.gameStatus === 'missile_animating' &&
                                    game.gameStatus === 'playing';
                                const isMissileSelectExitToPlaying =
                                    existingForThrottle?.gameStatus === 'missile_selecting' &&
                                    game.gameStatus === 'playing';
                                // 주사위/도둑 오버샷(또는 굴림 애니 종료) 후 rolling 단계로 복귀할 때
                                // moveHistory 변화가 없어도 currentPlayer가 바뀔 수 있으므로 반드시 반영
                                const isDiceThiefAnimExitToRolling =
                                    !!existingForThrottle?.gameStatus &&
                                    ['dice_rolling_animating', 'thief_rolling_animating'].includes(existingForThrottle.gameStatus) &&
                                    (game.gameStatus === 'dice_rolling' || game.gameStatus === 'thief_rolling');
                                // 주사위/도둑은 오버샷·강제턴넘김에서 moveHistory 변화 없이 currentPlayer만 바뀔 수 있다.
                                // 이 전환이 쓰로틀에 걸리면 클라이언트가 "아직 AI 턴"으로 보이는 고착이 생길 수 있어 반드시 반영한다.
                                const isDiceThiefTurnOwnerChanged =
                                    !!existingForThrottle &&
                                    existingForThrottle.currentPlayer !== game.currentPlayer &&
                                    (
                                        game.mode === GameMode.Dice ||
                                        game.mode === GameMode.Thief ||
                                        existingForThrottle.mode === GameMode.Dice ||
                                        existingForThrottle.mode === GameMode.Thief
                                    );
                                // 2R 등 라운드가 올라간 패킷은 수순·서명이 같아도 반드시 반영 (애니 종료·턴 표시 고착 방지)
                                const isDiceGoRoundProgress =
                                    game.mode === GameMode.Dice &&
                                    !!existingForThrottle &&
                                    (game.round ?? 1) > (existingForThrottle.round ?? 1);
                                // 놀이바둑 PVP: 오목(색 확인)·주사위/도둑 일부 단계 등은 moveHistory가 비거나
                                // 동일 길이로 유지되는 업데이트가 연속으로 오며, 100ms 쓰로틀에 걸리면 턴·종료·대기실 복귀 UI가 고착된다.
                                const playfulGameThrottleBypass =
                                    PLAYFUL_GAME_MODES.some((m) => m.mode === game.mode) ||
                                    (!!existingForThrottle &&
                                        PLAYFUL_GAME_MODES.some((m) => m.mode === existingForThrottle.mode));
                                const singlePlayerBaseFlowThrottleBypass =
                                    getSessionArenaKind(game) === 'singleplayer' &&
                                    (isSoloBaseFlowUpdateThrottleBypass(game) ||
                                        isSoloBaseFlowUpdateThrottleBypass(existingForThrottle));
                                // 흑선 가져오기(capture bidding/reveal/tiebreaker) 종료 후 playing 전환은
                                // 이동 수(moveHistory)가 없더라도 반드시 모달을 닫고 다음 화면으로 넘어가야 함.
                                const isCaptureBidExitToPlaying =
                                    existingForThrottle?.gameStatus &&
                                    ['capture_bidding', 'capture_reveal', 'capture_tiebreaker'].includes(existingForThrottle.gameStatus) &&
                                    game.gameStatus === 'playing';
                                // PVP 접속 끊김: 수순·상태 변화 없이 disconnectionState만 오는 업데이트가 쓰로틀에 걸리면 모달이 안 뜸
                                const disconnectStateChanged =
                                    stableStringify(existingForThrottle?.disconnectionState ?? null) !==
                                    stableStringify(game.disconnectionState ?? null);
                                // 모험/로비 AI 히든: 수순 변화 없이 ai_thinking + 종료 시각만 오는 패킷이 쓰로틀에 걸리면
                                // 바둑판 빛·전광판 연출이 아예 안 뜨는 버그가 난다.
                                const isAiHiddenItemPresentationUpdate =
                                    game.animation?.type === 'ai_thinking' &&
                                    (game as any).aiHiddenItemAnimationEndTime != null;
                                // moveHistory만 먼저 오고 boardState가 늦게 실리는 패킷 순서에서, naive 복원 직후
                                // 동일 수순 길이의 "풀 보드" 정정 패킷이 100ms 쓰로틀에 걸리면 돌이 안 보이고 턴/착수만 바뀌는 현상이 난다.
                                const incomingHasSubstantiveBoard =
                                    game.boardState &&
                                    Array.isArray(game.boardState) &&
                                    game.boardState.length > 0 &&
                                    game.boardState.some(
                                        (row: any[]) =>
                                            row &&
                                            Array.isArray(row) &&
                                            row.some((c: any) => c !== 0 && c != null)
                                    );
                                if (
                                    !playfulGameThrottleBypass &&
                                    !singlePlayerBaseFlowThrottleBypass &&
                                    !hasNewMoves &&
                                    !isPlayfulBoardUpdate &&
                                    !isDiceRollAnimationUpdate &&
                                    !isDiceThiefPlacingUpdate &&
                                    !isScoringOrRevealUpdate &&
                                    !isTerminalGameUpdate &&
                                    !isCaptureBidPhaseUpdate &&
                                    !isCaptureBidExitToPlaying &&
                                    !isDiceThiefAnimExitToRolling &&
                                    !isDiceThiefTurnOwnerChanged &&
                                    !isDiceGoRoundProgress &&
                                    !isScanAnimExitToPlaying &&
                                    !isHiddenPlacingExitToPlaying &&
                                    !isHiddenPlacingEntry &&
                                    !isScanningEntry &&
                                    !isScanningAnimEntry &&
                                    !isStrategicPetHintUsageUpdate &&
                                    !isMissileSelectEntry &&
                                    !isMissileSelectToAnimating &&
                                    !isMissileAnimatingEntry &&
                                    !isMissileAnimExitToPlaying &&
                                    !isMissileSelectExitToPlaying &&
                                    !disconnectStateChanged &&
                                    !isAiHiddenItemPresentationUpdate &&
                                    !incomingHasSubstantiveBoard &&
                                    now - lastUpdateTime < GAME_UPDATE_THROTTLE_MS
                                ) {
                                    return;
                                }
                                lastGameUpdateTimeRef.current[gameId] = now;
                                lastGameUpdateMoveCountRef.current[gameId] = incomingMoveCount;
                                
                                const gameBucket = getClientArenaStateBucket(game as LiveGameSession);
                                const arenaKind =
                                    gameBucket === 'singlePlayerGames'
                                        ? 'singleplayer'
                                        : gameBucket === 'towerGames'
                                          ? 'tower'
                                          : 'normal';
                                
                                // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
                                if (process.env.NODE_ENV === 'development') {
                                    console.log('[WebSocket] GAME_UPDATE received:', { gameId, arenaKind, gameStatus: game.gameStatus, resolvedArenaKind: getSessionArenaKind(game) });
                                }

                                if (arenaKind === 'singleplayer') {
                                    setSinglePlayerGames(currentGames => {
                                        // 성능 최적화: 게임 상태가 변경되지 않았으면 early return
                                        const existingGame = currentGames[gameId];
                                        if (shouldDropStaleStrategicGameUpdate(game, existingGame)) {
                                            return currentGames;
                                        }
                                        if (shouldIgnoreBaseModeGameStatusRegression(game, existingGame)) {
                                            if (process.env.NODE_ENV === 'development') {
                                                console.warn(
                                                    '[WebSocket] SinglePlayer: ignoring stale base pre-play GAME_UPDATE while local already past base flow',
                                                    { gameId, incoming: game.gameStatus, local: existingGame?.gameStatus },
                                                );
                                            }
                                            return currentGames;
                                        }
                                        if (shouldIgnoreStaleServerHiddenPlacingAfterClientCommit(existingGame, game)) {
                                            if (process.env.NODE_ENV === 'development') {
                                                console.warn(
                                                    '[WebSocket] SinglePlayer: ignoring stale hidden_placing GAME_UPDATE after local hidden commit',
                                                    {
                                                        gameId,
                                                        incomingMoves: game.moveHistory?.length ?? 0,
                                                        localMoves: existingGame?.moveHistory?.length ?? 0,
                                                    },
                                                );
                                            }
                                            return currentGames;
                                        }
                                        
                                        // 중요한 필드만 비교하여 빠른 early return (stableStringify 호출 전에)
                                        if (existingGame) {
                                            if (shouldIgnoreStalePendingPveStartRegression(game, existingGame)) {
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.warn(
                                                        '[WebSocket] SinglePlayer: ignoring stale pending GAME_UPDATE after local start confirm',
                                                        { gameId, local: existingGame.gameStatus },
                                                    );
                                                }
                                                return currentGames;
                                            }
                                            const localAdvancedSp =
                                                existingGame.gameStatus === 'scoring' ||
                                                existingGame.gameStatus === 'hidden_final_reveal' ||
                                                existingGame.gameStatus === 'ended' ||
                                                existingGame.gameStatus === 'no_contest';
                                            if (localAdvancedSp && game.gameStatus === 'pending') {
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.warn(
                                                        '[WebSocket] SinglePlayer: ignoring stale pending GAME_UPDATE while local is scoring/terminal',
                                                        { gameId, local: existingGame.gameStatus }
                                                    );
                                                }
                                                return currentGames;
                                            }
                                            if (
                                                localAdvancedSp &&
                                                game.gameStatus === 'base_game_start_confirmation'
                                            ) {
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.warn(
                                                        '[WebSocket] SinglePlayer: ignoring base pre-play GAME_UPDATE while local is scoring/terminal',
                                                        { gameId, incoming: game.gameStatus }
                                                    );
                                                }
                                                return currentGames;
                                            }
                                            if (
                                                existingGame.gameStatus === 'scoring' &&
                                                game.gameStatus === 'playing' &&
                                                (game.moveHistory?.length ?? 0) <= (existingGame.moveHistory?.length ?? 0)
                                            ) {
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.warn(
                                                        '[WebSocket] SinglePlayer: ignoring stale playing GAME_UPDATE during local scoring',
                                                        { gameId }
                                                    );
                                                }
                                                return currentGames;
                                            }
                                            // 기권 낙관(ended) 직후 WS에 아직 playing이 실려 오면 잠깐 스테이지 재시작·사운드가 나는 레이스 방지
                                            const incomingSpPostPlayOk =
                                                game.gameStatus === 'ended' ||
                                                game.gameStatus === 'no_contest' ||
                                                game.gameStatus === 'scoring' ||
                                                game.gameStatus === 'hidden_final_reveal';
                                            if (
                                                (existingGame.gameStatus === 'ended' ||
                                                    existingGame.gameStatus === 'no_contest') &&
                                                !incomingSpPostPlayOk
                                            ) {
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.warn(
                                                        '[WebSocket] SinglePlayer: ignoring non-terminal GAME_UPDATE while local is ended/no_contest',
                                                        { gameId, incoming: game.gameStatus }
                                                    );
                                                }
                                                return currentGames;
                                            }
                                            const keyFieldsChanged = 
                                                existingGame.gameStatus !== game.gameStatus ||
                                                existingGame.currentPlayer !== game.currentPlayer ||
                                                existingGame.serverRevision !== game.serverRevision ||
                                                (game.animation && existingGame.animation?.type !== game.animation?.type);
                                            
                                            // 중요한 필드가 변경되지 않았을 때만 서명 비교 (비용이 큰 작업)
                                            if (!keyFieldsChanged) {
                                                const previousSignature = singlePlayerGameSignaturesRef.current[gameId];
                                                // 서명이 이미 저장되어 있고, 중요한 필드가 변경되지 않았으면 서명 비교 생략 가능
                                                // 하지만 안전을 위해 서명 비교 수행 (중요 필드 외의 변경 감지)
                                                const signature = computeGameSessionFingerprint(game);
                                                if (previousSignature === signature) {
                                                    return currentGames; // 완전히 동일한 상태
                                                }
                                                singlePlayerGameSignaturesRef.current[gameId] = signature;
                                            } else {
                                                singlePlayerGameSignaturesRef.current[gameId] = computeGameSessionFingerprint(game);
                                            }
                                        } else {
                                            singlePlayerGameSignaturesRef.current[gameId] = computeGameSessionFingerprint(game);
                                        }
                                        const updatedGames = { ...currentGames };
                                        
                                        // scoring 상태인 경우 기존 게임의 boardState와 moveHistory 무조건 보존
                                        if (game.gameStatus === 'scoring') {
                                            const deferredSnap = pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId];
                                            const preserveSource =
                                                (pickRicherWsBoardSnapshot(existingGame, deferredSnap) ?? existingGame) as
                                                    | LiveGameSession
                                                    | undefined;
                                            if (preserveSource) {
                                                const { boardState: finalBoardState, moveHistory: finalMoveHistory } =
                                                    resolvePveScoringBoardAndMoveHistory(game, preserveSource);

                                                const finalTotalTurns = (game.totalTurns !== undefined && game.totalTurns !== null) ? game.totalTurns : (preserveSource.totalTurns !== undefined && preserveSource.totalTurns !== null ? preserveSource.totalTurns : game.totalTurns);
                                                const finalCaptures =
                                                    mergeMonotonicCountRecord(
                                                        preserveSource.captures as LiveGameSession['captures'],
                                                        game.captures as LiveGameSession['captures']
                                                    ) ??
                                                    game.captures ??
                                                    preserveSource.captures;

                                                const preservedGame = {
                                                    ...game,
                                                    boardState: finalBoardState,
                                                    moveHistory: finalMoveHistory,
                                                    totalTurns: finalTotalTurns,
                                                    blackTimeLeft: (game.blackTimeLeft !== undefined && game.blackTimeLeft !== null && game.blackTimeLeft > 0) ? game.blackTimeLeft : (preserveSource.blackTimeLeft !== undefined && preserveSource.blackTimeLeft !== null ? preserveSource.blackTimeLeft : game.blackTimeLeft),
                                                    whiteTimeLeft: (game.whiteTimeLeft !== undefined && game.whiteTimeLeft !== null && game.whiteTimeLeft > 0) ? game.whiteTimeLeft : (preserveSource.whiteTimeLeft !== undefined && preserveSource.whiteTimeLeft !== null ? preserveSource.whiteTimeLeft : game.whiteTimeLeft),
                                                    captures: finalCaptures,
                                                };
                                                updatedGames[gameId] = preservedGame;
                                            } else {
                                                updatedGames[gameId] = game;
                                            }
                                            delete pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId];
                                        } else {
                                            // hidden_placing, scanning, hidden_reveal_animating 등에서는 boardState·permanentlyRevealedStones 보존/병합
                                            const incomingItemPhase = [
                                                'hidden_placing',
                                                'scanning',
                                                'missile_selecting',
                                                'missile_animating',
                                                'scanning_animating',
                                                'hidden_reveal_animating',
                                            ].includes(game.gameStatus);
                                            // 서버가 연출 종료 전 `playing`으로 먼저 오면(슬림 WS 등) 기존 공개 타이머가 살아 있는 동안은
                                            // 동일 병합 경로를 타서 애니·pendingCapture·reveal 종료 시각이 중간에 끊기지 않게 한다.
                                            const localRevealClockLive =
                                                existingGame?.gameStatus === 'hidden_reveal_animating' &&
                                                typeof existingGame.revealAnimationEndTime === 'number' &&
                                                existingGame.revealAnimationEndTime > Date.now();
                                            const isItemMode = incomingItemPhase || localRevealClockLive;
                                            // 미사일 애니메이션 중에는 서버가 따낸 돌을 반영한 boardState를 적용해야 함
                                            const isMissileAnimating = game.gameStatus === 'missile_animating';
                                            const hiddenRevealResolved =
                                                existingGame?.gameStatus === 'hidden_reveal_animating' &&
                                                game.gameStatus === 'playing' &&
                                                !game.pendingCapture;
                                            const isHiddenRevealItemPhase =
                                                game.gameStatus === 'hidden_reveal_animating' ||
                                                existingGame?.gameStatus === 'hidden_reveal_animating';
                                            
                                            // 애니메이션 중에는 totalTurns와 captures를 보존해야 함
                                            const isAnimating = game.animation !== null && game.animation !== undefined;
                                            
                                            // totalTurns와 captures 보존 (애니메이션 중 초기화 방지)
                                            const preservedTotalTurns = existingGame?.totalTurns !== undefined && existingGame?.totalTurns !== null
                                                ? existingGame.totalTurns
                                                : (game.totalTurns !== undefined && game.totalTurns !== null ? game.totalTurns : undefined);
                                            /** 서버 GAME_UPDATE가 따내기 점수만 갱신해도 기존 객체가 우선되던 버그 방지 — 타워와 동일하게 플레이어별 max 병합 */
                                            const preservedCaptures =
                                                mergeMonotonicCountRecord(
                                                    existingGame?.captures as LiveGameSession['captures'],
                                                    game.captures as LiveGameSession['captures']
                                                ) ??
                                                existingGame?.captures ??
                                                game.captures ??
                                                { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 };
                                            const preservedBaseStoneCaptures =
                                                mergeMonotonicCountRecord(
                                                    existingGame?.baseStoneCaptures as LiveGameSession['baseStoneCaptures'],
                                                    game.baseStoneCaptures as LiveGameSession['baseStoneCaptures']
                                                ) ??
                                                existingGame?.baseStoneCaptures ??
                                                game.baseStoneCaptures;
                                            const preservedHiddenStoneCaptures =
                                                mergeMonotonicCountRecord(
                                                    existingGame?.hiddenStoneCaptures as LiveGameSession['hiddenStoneCaptures'],
                                                    game.hiddenStoneCaptures as LiveGameSession['hiddenStoneCaptures']
                                                ) ??
                                                existingGame?.hiddenStoneCaptures ??
                                                game.hiddenStoneCaptures;
                                            
                                            if (isItemMode) {
                                                const existingBoardStateValid = existingGame?.boardState && 
                                                    Array.isArray(existingGame.boardState) && 
                                                    existingGame.boardState.length > 0 && 
                                                    existingGame.boardState[0] && 
                                                    Array.isArray(existingGame.boardState[0]) && 
                                                    existingGame.boardState[0].length > 0;
                                                
                                                const serverBoardStateValid = game.boardState && 
                                                    Array.isArray(game.boardState) && 
                                                    game.boardState.length > 0 && 
                                                    game.boardState[0] && 
                                                    Array.isArray(game.boardState[0]) && 
                                                    game.boardState[0].length > 0;
                                                
                                                const existingMoveHistoryValid = existingGame?.moveHistory &&
                                                    Array.isArray(existingGame.moveHistory) &&
                                                    existingGame.moveHistory.length > 0;

                                                const serverMoveHistoryValid = game.moveHistory &&
                                                    Array.isArray(game.moveHistory) &&
                                                    game.moveHistory.length > 0;

                                                const serverMhLen = serverMoveHistoryValid ? game.moveHistory.length : 0;
                                                const existingMhLen = existingMoveHistoryValid ? existingGame.moveHistory.length : 0;
                                                /** 서버가 이미 한 수 이상 앞선 패킷(히든 공개 직후 등)이면 수순·보드를 서버 기준으로 맞춘다. 기존만 고르면 착수가 사라진 것처럼 보인다. */
                                                const serverMoveHistoryAhead = serverMhLen > existingMhLen;
                                                const preferServerBoardForHiddenReveal =
                                                    serverBoardStateValid &&
                                                    isHiddenRevealItemPhase &&
                                                    (serverMoveHistoryAhead ||
                                                        !!game.pendingCapture ||
                                                        hiddenRevealResolved);

                                                // missile_animating / hidden_reveal: 서버 boardState·captures 적용
                                                const finalBoardState =
                                                    (isMissileAnimating || preferServerBoardForHiddenReveal) &&
                                                    serverBoardStateValid
                                                        ? game.boardState
                                                        : serverMoveHistoryAhead && serverBoardStateValid
                                                          ? game.boardState
                                                          : existingBoardStateValid && !isMissileAnimating
                                                            ? existingGame.boardState
                                                            : serverBoardStateValid
                                                              ? game.boardState
                                                              : existingGame?.boardState;
                                                const finalCapturesForItemMode =
                                                    (isMissileAnimating ||
                                                        (hiddenRevealResolved &&
                                                            game.captures &&
                                                            typeof game.captures === 'object' &&
                                                            Object.keys(game.captures).length > 0)) &&
                                                    game.captures &&
                                                    typeof game.captures === 'object' &&
                                                    Object.keys(game.captures).length > 0
                                                        ? game.captures
                                                        : preservedCaptures;

                                                // moveHistory: 미사일은 수순 길이가 같고 중간 좌표만 바뀌므로, 애니 중에는 반드시 서버 수순을 써야 보드·마커·히든 인덱스가 일치함
                                                const finalMoveHistory =
                                                    isMissileAnimating && serverMoveHistoryValid
                                                        ? game.moveHistory
                                                        : serverMoveHistoryAhead && serverMoveHistoryValid
                                                          ? game.moveHistory
                                                          : existingMoveHistoryValid
                                                            ? existingGame.moveHistory
                                                            : serverMoveHistoryValid
                                                              ? game.moveHistory
                                                              : existingGame?.moveHistory;
                                                
                                                // 서버 공개 목록 + 클라이언트 기존 목록 합집합 (서버가 빈 배열/생략이어도 이미 공개된 히든이 사라지지 않게)
                                                const existingRevealedSp = existingGame?.permanentlyRevealedStones ?? [];
                                                const serverRevealedSp = game.permanentlyRevealedStones ?? [];
                                                const mergedRevealed = [...existingRevealedSp];
                                                for (const p of serverRevealedSp) {
                                                    if (!mergedRevealed.some((r: Point) => r.x === p.x && r.y === p.y))
                                                        mergedRevealed.push(p);
                                                }
                                                const mergedPendingCapture = game.pendingCapture ?? existingGame?.pendingCapture ?? null;
                                                let mergedRevealAnimationEndTime =
                                                    game.revealAnimationEndTime ?? existingGame?.revealAnimationEndTime;
                                                let mergedAnimation = game.animation ?? existingGame?.animation ?? null;
                                                if (
                                                    shouldKeepExistingHiddenRevealAnimationClock(
                                                        existingGame,
                                                        game as LiveGameSession,
                                                    )
                                                ) {
                                                    mergedAnimation = existingGame.animation ?? mergedAnimation;
                                                    mergedRevealAnimationEndTime =
                                                        existingGame.revealAnimationEndTime ?? mergedRevealAnimationEndTime;
                                                } else if (
                                                    localRevealClockLive &&
                                                    !incomingItemPhase &&
                                                    existingGame?.gameStatus === 'hidden_reveal_animating'
                                                ) {
                                                    // 서버가 이미 `playing` 등으로 전진했어도 로컬 공개 타이머가 남아 있으면 연출·정산 대기 상태 유지
                                                    mergedAnimation = existingGame.animation ?? mergedAnimation;
                                                    mergedRevealAnimationEndTime =
                                                        existingGame.revealAnimationEndTime ?? mergedRevealAnimationEndTime;
                                                }
                                                const ignoreStaleHiddenPlacingRegression =
                                                    shouldIgnoreStaleServerHiddenPlacingAfterClientCommit(existingGame, game);
                                                const mergedGameStatus =
                                                    localRevealClockLive &&
                                                    !incomingItemPhase &&
                                                    existingGame?.gameStatus === 'hidden_reveal_animating'
                                                        ? ('hidden_reveal_animating' as const)
                                                        : ignoreStaleHiddenPlacingRegression && existingGame
                                                          ? existingGame.gameStatus
                                                          : game.gameStatus;
                                                const mergedHiddenMoves = mergeHiddenMovesByStableHistory(game, existingGame);
                                                const mergedHumanHiddenStonePoints = mergeHumanHiddenStonePointsForSession(
                                                    game,
                                                    existingGame,
                                                    finalMoveHistory,
                                                    mergedHiddenMoves,
                                                );
                                                const mergedAiHiddenStonePoints = syncAiHiddenStonePointsFromSession(
                                                    {
                                                        ...game,
                                                        moveHistory: finalMoveHistory,
                                                        hiddenMoves: mergedHiddenMoves,
                                                    } as LiveGameSession,
                                                    existingGame,
                                                );
                                                const mergedAiInitialHiddenStone =
                                                    (game as any).aiInitialHiddenStone ?? (existingGame as any)?.aiInitialHiddenStone;
                                                const mergedAiInitialHiddenStoneIsPrePlaced =
                                                    (game as any).aiInitialHiddenStoneIsPrePlaced ?? (existingGame as any)?.aiInitialHiddenStoneIsPrePlaced;
                                                updatedGames[gameId] = {
                                                    ...game,
                                                    gameStatus: mergedGameStatus,
                                                    ...(ignoreStaleHiddenPlacingRegression && existingGame
                                                        ? {
                                                              currentPlayer: existingGame.currentPlayer,
                                                              itemUseDeadline: existingGame.itemUseDeadline,
                                                              itemPhaseActingPlayer: (existingGame as any).itemPhaseActingPlayer,
                                                              pausedTurnTimeLeft: existingGame.pausedTurnTimeLeft,
                                                              turnDeadline: existingGame.turnDeadline,
                                                              turnStartTime: existingGame.turnStartTime,
                                                          }
                                                        : {}),
                                                    boardState: finalBoardState,
                                                    moveHistory: finalMoveHistory,
                                                    hiddenMoves: mergedHiddenMoves,
                                                    humanHiddenStonePoints: mergedHumanHiddenStonePoints,
                                                    aiHiddenStonePoints: mergedAiHiddenStonePoints,
                                                    aiInitialHiddenStone: mergedAiInitialHiddenStone,
                                                    aiInitialHiddenStoneIsPrePlaced: mergedAiInitialHiddenStoneIsPrePlaced,
                                                    permanentlyRevealedStones: mergedRevealed,
                                                    pendingCapture: mergedPendingCapture,
                                                    revealAnimationEndTime: mergedRevealAnimationEndTime,
                                                    animation: mergedAnimation,
                                                    // totalTurns와 captures 보존 (미사일 애니메이션 중에는 서버 captures 적용)
                                                    totalTurns: preservedTotalTurns,
                                                    captures: finalCapturesForItemMode,
                                                    baseStoneCaptures: preservedBaseStoneCaptures,
                                                    hiddenStoneCaptures: preservedHiddenStoneCaptures,
                                                    // 시간 정보도 보존
                                                    blackTimeLeft: (game.blackTimeLeft !== undefined && game.blackTimeLeft !== null && game.blackTimeLeft > 0) 
                                                        ? game.blackTimeLeft 
                                                        : (existingGame?.blackTimeLeft !== undefined && existingGame?.blackTimeLeft !== null ? existingGame.blackTimeLeft : game.blackTimeLeft),
                                                    whiteTimeLeft: (game.whiteTimeLeft !== undefined && game.whiteTimeLeft !== null && game.whiteTimeLeft > 0) 
                                                        ? game.whiteTimeLeft 
                                                        : (existingGame?.whiteTimeLeft !== undefined && existingGame?.whiteTimeLeft !== null ? existingGame.whiteTimeLeft : game.whiteTimeLeft),
                                                };
                                            } else if (game.gameStatus === 'hidden_final_reveal' && getSessionArenaKind(game) === 'singleplayer' && existingGame) {
                                                // 싱글플레이: 서버는 boardState를 보내지 않으므로 기존 보드/수순/공개목록 반드시 보존 (투명해짐·색상 뒤바뀜·계가 안 됨 방지)
                                                const deferredSnap = pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId];
                                                const revealPreserveSource =
                                                    (pickRicherWsBoardSnapshot(existingGame, deferredSnap) ?? existingGame) as LiveGameSession;
                                                const serverBoardValid = game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0;
                                                const serverMoveHistoryValid = game.moveHistory && Array.isArray(game.moveHistory) && game.moveHistory.length > 0;
                                                const boardState = serverBoardValid ? game.boardState : (revealPreserveSource.boardState ?? game.boardState);
                                                const moveHistory = serverMoveHistoryValid ? game.moveHistory : (revealPreserveSource.moveHistory ?? game.moveHistory);
                                                // 기존에 공개된 돌(내 히든 등) + 서버가 이번에 공개한 돌 합침 (서버만 쓰면 이전 공개가 사라져 투명해짐)
                                                const existingRevealed = revealPreserveSource.permanentlyRevealedStones ?? [];
                                                const serverRevealed = game.permanentlyRevealedStones ?? [];
                                                const mergedRevealed = [...existingRevealed];
                                                for (const p of serverRevealed) {
                                                    if (!mergedRevealed.some((r: Point) => r.x === p.x && r.y === p.y))
                                                        mergedRevealed.push(p);
                                                }
                                                const hiddenMoves = mergeHiddenMovesByStableHistory(game, revealPreserveSource) ?? {};
                                                updatedGames[gameId] = {
                                                    ...game,
                                                    boardState,
                                                    moveHistory,
                                                    hiddenMoves,
                                                    permanentlyRevealedStones: mergedRevealed,
                                                    animation: game.animation ?? revealPreserveSource.animation,
                                                    revealAnimationEndTime: game.revealAnimationEndTime ?? revealPreserveSource.revealAnimationEndTime,
                                                    totalTurns: preservedTotalTurns !== undefined ? preservedTotalTurns : game.totalTurns,
                                                    captures: preservedCaptures ?? game.captures ?? revealPreserveSource.captures,
                                                    baseStoneCaptures: preservedBaseStoneCaptures,
                                                    hiddenStoneCaptures: preservedHiddenStoneCaptures,
                                                };
                                            } else if (
                                                game.gameStatus === 'playing' &&
                                                !(
                                                    game.mode === GameMode.Capture &&
                                                    !isSessionSingleOrTower(game)
                                                ) &&
                                                (game.stageId || (game.settings as any)?.autoScoringTurns)
                                            ) {
                                                // GAME_UPDATE를 받았을 때 자동계가 체크 (AI 수를 둔 경우 등)
                                                try {
                                                    const autoScoringTurns = getSessionArenaKind(game) === 'singleplayer'
                                                        ? resolveSinglePlayerAutoScoringCapForClientSession(game as any)
                                                        : (game.settings as any)?.autoScoringTurns;
                                                    
                                                    if (autoScoringTurns != null && autoScoringTurns > 0) {
                                                        // totalTurns는 유효 착수 수만 반영 (서버 totalTurns가 앞서 있으면 마지막 AI 수 없이 계가되는 버그 방지)
                                                        const validMoves = (game.moveHistory || []).filter((m: any) => m.x !== -1 && m.y !== -1);
                                                        const totalTurns = validMoves.length;
                                                        game.totalTurns = totalTurns;
                                                        const remainingTurns = Math.max(0, autoScoringTurns - totalTurns);
                                                        // 자동계가: 남은 턴이 0 이하(0/N 도달)이면 반드시 계가 트리거
                                                        if (remainingTurns <= 0 && totalTurns > 0) {
                                                            const serverDeferredScoringKickoff =
                                                                typeof (game as any).pendingAutoScoringKickoffAt === 'number' &&
                                                                Number.isFinite((game as any).pendingAutoScoringKickoffAt);
                                                            if (serverDeferredScoringKickoff) {
                                                                if (process.env.NODE_ENV === 'development') {
                                                                    console.log(
                                                                        `[WebSocket] Auto-scoring: server deferred kickoff (pendingAutoScoringKickoffAt); skip client PLACE_STONE`,
                                                                        { gameId, pendingAt: (game as any).pendingAutoScoringKickoffAt }
                                                                    );
                                                                }
                                                            } else {
                                                            // 마지막 수가 AI 차례라면 AI가 실제로 착수한 뒤 계가를 진행해야 함.
                                                            // (싱글은 `Game.tsx`에서 Kata 수 요청 후 GAME_UPDATE로 반영될 때까지 대기)
                                                            const isAiTurnForSinglePlayer =
                                                                getSessionArenaKind(game) === 'singleplayer' &&
                                                                ((game.currentPlayer === Player.White && game.whitePlayerId === aiUserId) ||
                                                                 (game.currentPlayer === Player.Black && game.blackPlayerId === aiUserId));
                                                            if (isAiTurnForSinglePlayer) {
                                                                if (process.env.NODE_ENV === 'development') {
                                                                    console.log(`[WebSocket][SinglePlayer] Auto-scoring reached but it's AI turn; waiting for AI move before scoring`, {
                                                                        gameId,
                                                                        totalTurns,
                                                                        autoScoringTurns,
                                                                        currentPlayer: game.currentPlayer,
                                                                    });
                                                                }
                                                            } else {
                                                                const preservedBoardState = game.boardState && game.boardState.length > 0
                                                                    ? game.boardState
                                                                    : (existingGame?.boardState || game.boardState);
                                                                const preservedMoveHistory = game.moveHistory && game.moveHistory.length > 0
                                                                    ? game.moveHistory
                                                                    : (existingGame?.moveHistory || game.moveHistory);
                                                                const preservedTotalTurns = totalTurns;
                                                                const preservedBlackTimeLeft = game.blackTimeLeft ?? existingGame?.blackTimeLeft;
                                                                const preservedWhiteTimeLeft = game.whiteTimeLeft ?? existingGame?.whiteTimeLeft;
                                                                const preservedCaptures =
                                                                    mergeMonotonicCountRecord(
                                                                        existingGame?.captures as LiveGameSession['captures'],
                                                                        game.captures as LiveGameSession['captures']
                                                                    ) ??
                                                                    game.captures ??
                                                                    existingGame?.captures;
                                                                const preservedHiddenMovesWs = existingGame?.hiddenMoves ?? game.hiddenMoves;
                                                                const autoScoringAction = {
                                                                    type: 'PLACE_STONE',
                                                                    payload: {
                                                                        gameId,
                                                                        x: -1,
                                                                        y: -1,
                                                                        totalTurns: preservedTotalTurns,
                                                                        moveHistory: preservedMoveHistory,
                                                                        boardState: preservedBoardState,
                                                                        blackTimeLeft: preservedBlackTimeLeft,
                                                                        whiteTimeLeft: preservedWhiteTimeLeft,
                                                                        captures: preservedCaptures,
                                                                        hiddenMoves: preservedHiddenMovesWs ?? undefined,
                                                                        triggerAutoScoring: true
                                                                    }
                                                                } as any;
                                                                // 히든 모드: 서버가 hidden_final_reveal → scoring 순으로 보내므로, 클라이언트에서 scoring으로 덮어쓰지 않음
                                                                const isHiddenModeWs = game.mode === GameMode.Hidden ||
                                                                    (game.mode === GameMode.Mix && (game.settings as any)?.mixedModes?.includes?.(GameMode.Hidden)) ||
                                                                    ((game.settings as any)?.hiddenStoneCount ?? 0) > 0;
                                                                // 마지막 AI 수가 바둑판에 보인 뒤 계가 진행: 먼저 'playing'으로 보드만 표시, 0.5초 후 (비히든만 로컬 scoring 전환 후) 서버 요청
                                                                if (singlePlayerScoringDelayTimeoutRef.current[gameId] != null) {
                                                                    clearTimeout(singlePlayerScoringDelayTimeoutRef.current[gameId]);
                                                                }
                                                                try {
                                                                    sessionStorage.setItem(pveAutoScoringScheduledStorageKey(gameId), '1');
                                                                } catch {
                                                                    /* ignore */
                                                                }
                                                                updatedGames[gameId] = {
                                                                    ...game,
                                                                    gameStatus: 'playing' as const,
                                                                    boardState: preservedBoardState,
                                                                    moveHistory: preservedMoveHistory,
                                                                    totalTurns: preservedTotalTurns,
                                                                    captures: preservedCaptures,
                                                                    baseStoneCaptures: preservedBaseStoneCaptures,
                                                                    hiddenStoneCaptures: preservedHiddenStoneCaptures,
                                                                    blackTimeLeft: preservedBlackTimeLeft,
                                                                    whiteTimeLeft: preservedWhiteTimeLeft,
                                                                };
                                                                singlePlayerScoringDelayTimeoutRef.current[gameId] = setTimeout(() => {
                                                                    try {
                                                                        sessionStorage.removeItem(pveAutoScoringScheduledStorageKey(gameId));
                                                                    } catch {
                                                                        /* ignore */
                                                                    }
                                                                    markPveBoardSettledForScoring(gameId);
                                                                    if (!isHiddenModeWs) {
                                                                        setSinglePlayerGames(prev => {
                                                                            const g = prev[gameId];
                                                                            if (!g) return prev;
                                                                            if (g.gameStatus === 'scoring') return prev;
                                                                            return { ...prev, [gameId]: { ...g, gameStatus: 'scoring' as const } };
                                                                        });
                                                                    }
                                                                    handleAction(autoScoringAction).then((result: any) => {
                                                                        if (process.env.NODE_ENV === 'development') {
                                                                            console.log(`[WebSocket][SinglePlayer] Auto-scoring action sent successfully:`, result);
                                                                        }
                                                                    }).catch((err: any) => {
                                                                        console.error(`[WebSocket][SinglePlayer] Failed to trigger auto-scoring on server:`, err);
                                                                    });
                                                                    delete singlePlayerScoringDelayTimeoutRef.current[gameId];
                                                                }, BOARD_SETTLE_BEFORE_SCORING_MS);
                                                            }
                                                            }
                                                        }
                                                    }
                                                } catch (err) {
                                                    console.error(`[WebSocket][SinglePlayer] Failed to check auto-scoring from GAME_UPDATE:`, err);
                                                }
                                            } else {
                                                // 일반 상태에서는 서버에서 온 게임 상태 사용
                                                let mergedGameForSp: LiveGameSession = game;
                                                const isSinglePlayerAiHiddenPresentation =
                                                    game.animation?.type === 'ai_thinking' ||
                                                    (game as any).aiHiddenItemAnimationEndTime != null;
                                                if (
                                                    isSinglePlayerAiHiddenPresentation &&
                                                    existingGame &&
                                                    (!game.boardState ||
                                                        !Array.isArray(game.boardState) ||
                                                        game.boardState.length === 0)
                                                ) {
                                                    mergedGameForSp = {
                                                        ...mergedGameForSp,
                                                        boardState: existingGame.boardState,
                                                        moveHistory:
                                                            Array.isArray(existingGame.moveHistory) &&
                                                            existingGame.moveHistory.length > 0
                                                                ? existingGame.moveHistory
                                                                : mergedGameForSp.moveHistory,
                                                    };
                                                }
                                                // 스캔 애니메이션 종료(scanning_animating → playing) 시 보드/수순 반드시 보존
                                                const wasScanningAnimating = existingGame?.gameStatus === 'scanning_animating';
                                                const wasMissileAnimatingToPlaying =
                                                    existingGame?.gameStatus === 'missile_animating' && game.gameStatus === 'playing';
                                                const serverBoardStructural =
                                                    !!(
                                                        mergedGameForSp.boardState &&
                                                        Array.isArray(mergedGameForSp.boardState) &&
                                                        mergedGameForSp.boardState.length > 0 &&
                                                        mergedGameForSp.boardState[0] &&
                                                        Array.isArray(mergedGameForSp.boardState[0])
                                                    );
                                                const serverBoardSubstantive =
                                                    serverBoardStructural && boardGridHasAnyStones(mergedGameForSp.boardState);
                                                const serverMoveHistoryValid = mergedGameForSp.moveHistory && Array.isArray(mergedGameForSp.moveHistory) && mergedGameForSp.moveHistory.length > 0;
                                                const existingBoardValid = existingGame?.boardState && Array.isArray(existingGame.boardState) && existingGame.boardState.length > 0;
                                                const existingBoardSubstantive =
                                                    !!existingBoardValid && boardGridHasAnyStones(existingGame?.boardState);
                                                const existingMoveHistoryValid = existingGame?.moveHistory && Array.isArray(existingGame.moveHistory) && existingGame.moveHistory.length > 0;
                                                const preserveBoardFromExisting =
                                                    (wasScanningAnimating || wasMissileAnimatingToPlaying) &&
                                                    (!serverBoardSubstantive && !!existingBoardValid);
                                                const preserveMoveHistoryFromExisting =
                                                    (wasScanningAnimating || wasMissileAnimatingToPlaying) && (!serverMoveHistoryValid && existingMoveHistoryValid);
                                                const finalBoardState = preserveBoardFromExisting
                                                    ? existingGame!.boardState
                                                    : serverBoardSubstantive
                                                      ? mergedGameForSp.boardState
                                                      : existingBoardSubstantive
                                                        ? existingGame!.boardState
                                                        : (existingGame?.boardState ?? mergedGameForSp.boardState);
                                                const finalMoveHistory = preserveMoveHistoryFromExisting ? existingGame.moveHistory : (serverMoveHistoryValid ? mergedGameForSp.moveHistory : (existingGame?.moveHistory ?? mergedGameForSp.moveHistory));
                                                const existingRevealedGen = existingGame?.permanentlyRevealedStones ?? [];
                                                const serverRevealedGen = game.permanentlyRevealedStones ?? [];
                                                const mergedRevealed = [...existingRevealedGen];
                                                for (const p of serverRevealedGen) {
                                                    if (!mergedRevealed.some((r: Point) => r.x === p.x && r.y === p.y))
                                                        mergedRevealed.push(p);
                                                }
                                                const mergedHiddenMovesGeneral = mergeHiddenMovesByStableHistory(mergedGameForSp, existingGame);
                                                const mergedHumanHiddenStonePointsGeneral = mergeHumanHiddenStonePointsForSession(
                                                    mergedGameForSp,
                                                    existingGame,
                                                    finalMoveHistory,
                                                    mergedHiddenMovesGeneral,
                                                );
                                                const mergedAiHiddenStonePointsGeneral = syncAiHiddenStonePointsFromSession(
                                                    {
                                                        ...mergedGameForSp,
                                                        moveHistory: finalMoveHistory,
                                                        hiddenMoves: mergedHiddenMovesGeneral,
                                                    } as LiveGameSession,
                                                    existingGame,
                                                );
                                                const mergedAiInitialHiddenStoneGeneral =
                                                    (mergedGameForSp as any).aiInitialHiddenStone ?? (existingGame as any)?.aiInitialHiddenStone;
                                                const mergedAiInitialHiddenStoneIsPrePlacedGeneral =
                                                    (mergedGameForSp as any).aiInitialHiddenStoneIsPrePlaced ?? (existingGame as any)?.aiInitialHiddenStoneIsPrePlaced;
                                                if (isAnimating || existingGame) {
                                                    // 서버가 슬림 페이로드(boardState 생략)를내도 final*가 기존 판을 유지하므로 항상 반영한다.
                                                    // 그렇지 않으면 클라 board가 비고 buildPveItemActionClientSync → REQUEST_SERVER_AI_MOVE가 영구 스킵된다.
                                                    updatedGames[gameId] = {
                                                        ...mergedGameForSp,
                                                        boardState: finalBoardState,
                                                        moveHistory: finalMoveHistory,
                                                        hiddenMoves: mergedHiddenMovesGeneral,
                                                        humanHiddenStonePoints: mergedHumanHiddenStonePointsGeneral,
                                                        aiHiddenStonePoints: mergedAiHiddenStonePointsGeneral,
                                                        aiInitialHiddenStone: mergedAiInitialHiddenStoneGeneral,
                                                        aiInitialHiddenStoneIsPrePlaced: mergedAiInitialHiddenStoneIsPrePlacedGeneral,
                                                        permanentlyRevealedStones: mergedRevealed,
                                                        totalTurns: preservedTotalTurns !== undefined ? preservedTotalTurns : game.totalTurns,
                                                        captures: preservedCaptures,
                                                        baseStoneCaptures: preservedBaseStoneCaptures,
                                                        hiddenStoneCaptures: preservedHiddenStoneCaptures,
                                                    };
                                                } else {
                                                    updatedGames[gameId] = {
                                                        ...mergedGameForSp,
                                                        hiddenMoves: mergedHiddenMovesGeneral,
                                                        humanHiddenStonePoints: mergedHumanHiddenStonePointsGeneral,
                                                        aiHiddenStonePoints: mergedAiHiddenStonePointsGeneral,
                                                        aiInitialHiddenStone: mergedAiInitialHiddenStoneGeneral,
                                                        aiInitialHiddenStoneIsPrePlaced: mergedAiInitialHiddenStoneIsPrePlacedGeneral,
                                                        permanentlyRevealedStones: mergedRevealed,
                                                    };
                                                }
                                            }
                                        }
                                        if (updatedGames[gameId]) {
                                            updatedGames[gameId] = preserveStrategicSessionOverlaysIfIncomingOmitted(
                                                updatedGames[gameId],
                                                game,
                                                existingGame
                                            );
                                            updatedGames[gameId] = preferClientLockedStrategicSeatsOverIncomingDrift(
                                                updatedGames[gameId],
                                                existingGame,
                                            );
                                            updatedGames[gameId] = alignBaseModeCurrentPlayerWithExistingWhenSlimDrift(
                                                updatedGames[gameId],
                                                game,
                                                existingGame,
                                                {}
                                            );
                                            updatedGames[gameId] = mergePveGameUpdateFromWs(
                                                updatedGames[gameId],
                                                game,
                                                existingGame,
                                                pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId],
                                            );
                                            updatedGames[gameId] = coerceClassicPveHumanBlackSeatsIfSwapped(updatedGames[gameId]);
                                        }
                                        const updatedSinglePlayerGame = updatedGames[gameId];
                                        const lastSinglePlayerMove = Array.isArray(game.moveHistory)
                                            ? (game.moveHistory as any[])[game.moveHistory.length - 1]
                                            : null;
                                        const singleAiPlayerEnum =
                                            updatedSinglePlayerGame?.whitePlayerId === aiUserId
                                                ? Player.White
                                                : Player.Black;
                                        const isNewSinglePlayerAiMove =
                                            !!existingGame &&
                                            !!updatedSinglePlayerGame &&
                                            getSessionArenaKind(game) === 'singleplayer' &&
                                            hasNewMoves &&
                                            game.moveHistory?.length > 0 &&
                                            lastSinglePlayerMove?.player === singleAiPlayerEnum &&
                                            !shouldApplyPveAiMoveSnapshotImmediately(updatedSinglePlayerGame);
                                        if (isNewSinglePlayerAiMove) {
                                            if (singlePlayerKataDelayTimeoutRef.current[gameId] != null) {
                                                clearTimeout(singlePlayerKataDelayTimeoutRef.current[gameId]);
                                            }
                                            const scheduledAt = Date.now();
                                            const gameToApply = JSON.parse(JSON.stringify(updatedSinglePlayerGame)) as LiveGameSession;
                                            const spDeferredSnap = pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId];
                                            updatedGames[gameId] = applyStrategicPlayingBoardAndMoveHistoryResolve(
                                                (pickRicherWsBoardSnapshot(existingGame, spDeferredSnap) ??
                                                    existingGame ??
                                                    updatedSinglePlayerGame) as LiveGameSession,
                                                existingGame,
                                            );
                                            pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId] = gameToApply;
                                            singlePlayerKataDelayTimeoutRef.current[gameId] = setTimeout(() => {
                                                let appliedDelayedSnapshot = false;
                                                const delayedByMs = Math.max(0, Date.now() - scheduledAt);
                                                const shiftedGameToApply = shiftDelayedAiSnapshotTurnClock(gameToApply, delayedByMs);
                                                setSinglePlayerGames(prev => {
                                                    if (shouldSkipDelayedAiSnapshotApply(prev[gameId], shiftedGameToApply)) return prev;
                                                    appliedDelayedSnapshot = true;
                                                    return { ...prev, [gameId]: shiftedGameToApply };
                                                });
                                                if (appliedDelayedSnapshot) {
                                                    lastGameUpdateMoveCountRef.current[gameId] = shiftedGameToApply.moveHistory?.length ?? 0;
                                                    singlePlayerGameSignaturesRef.current[gameId] = computeGameSessionFingerprint(shiftedGameToApply);
                                                }
                                                delete singlePlayerKataDelayTimeoutRef.current[gameId];
                                                delete pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId];
                                            }, 1000);
                                            return updatedGames;
                                        }
                                        const lastMoves = Array.isArray(game.moveHistory)
                                    ? game.moveHistory.slice(Math.max(0, game.moveHistory.length - 4)).map((m: any) => ({
                                        x: m?.x,
                                        y: m?.y,
                                        player: m?.player,
                                    }))
                                    : null;
                                const boardSnapshot = Array.isArray(game.boardState)
                                    ? game.boardState.map((row: any[]) => row?.join?.('') ?? row).slice(0, 3)
                                    : undefined;
                                console.debug('[WebSocket][SinglePlayer] GAME_UPDATE', {
                                    gameId,
                                    stageId: game.stageId,
                                    serverRevision: game.serverRevision,
                                    moveHistoryLength: Array.isArray(game.moveHistory) ? game.moveHistory.length : undefined,
                                    currentPlayer: game.currentPlayer,
                                    gameStatus: game.gameStatus,
                                    lastMove: game.lastMove,
                                    lastMoves,
                                    boardSample: boardSnapshot,
                                });

                                        if (currentUser && game.player1 && game.player2) {
                                            const isPlayer1 = game.player1.id === currentUser.id;
                                            const isPlayer2 = game.player2.id === currentUser.id;
                                            const currentStatus = currentUserStatusRef.current;
                                            const isActiveForGame = !!currentStatus &&
                                                (currentStatus.gameId === gameId || currentStatus.spectatingGameId === gameId) &&
                                                (currentStatus.status === 'in-game' || currentStatus.status === 'spectating');

                                            if ((isPlayer1 || isPlayer2) && isActiveForGame) {
                                                const targetHash = `#/game/${gameId}`;
                                                if (window.location.hash !== targetHash) {
                                                    // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
                                                    if (process.env.NODE_ENV === 'development') {
                                                        console.log('[WebSocket] Routing to single player game:', gameId);
                                                    }
                                                    setTimeout(() => {
                                                        if (window.location.hash !== targetHash) {
                                                            window.location.hash = targetHash;
                                                        }
                                                    }, 100);
                                                }
                                            }
                                        }
                                        return updatedGames;
                                    });
                                } else if (arenaKind === 'tower') {
                                    setTowerGames(currentGames => {
                                        const existingGame = currentGames[gameId];
                                        if (shouldDropStaleStrategicGameUpdate(game, existingGame)) {
                                            return currentGames;
                                        }
                                        if (shouldIgnoreBaseModeGameStatusRegression(game, existingGame)) {
                                            if (process.env.NODE_ENV === 'development') {
                                                console.warn(
                                                    '[WebSocket] Tower: ignoring stale base pre-play GAME_UPDATE while local already past base flow',
                                                    { gameId, incoming: game.gameStatus, local: existingGame?.gameStatus },
                                                );
                                            }
                                            return currentGames;
                                        }
                                        if (shouldIgnoreStaleServerHiddenPlacingAfterClientCommit(existingGame, game)) {
                                            if (process.env.NODE_ENV === 'development') {
                                                console.warn(
                                                    '[WebSocket] Tower: ignoring stale hidden_placing GAME_UPDATE after local hidden commit',
                                                    {
                                                        gameId,
                                                        incomingMoves: game.moveHistory?.length ?? 0,
                                                        localMoves: existingGame?.moveHistory?.length ?? 0,
                                                    },
                                                );
                                            }
                                            return currentGames;
                                        }

                                        // 타워 게임은 클라이언트에서만 실행되므로,
                                        // 클라이언트의 로컬 상태가 더 최신이면 서버 상태를 무시
                                        if (existingGame) {
                                            if (shouldIgnoreStalePendingPveStartRegression(game, existingGame)) {
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.warn(
                                                        '[WebSocket] Tower: ignoring stale pending GAME_UPDATE after local start confirm',
                                                        { gameId, local: existingGame.gameStatus },
                                                    );
                                                }
                                                return currentGames;
                                            }
                                            const localAdvanced =
                                                existingGame.gameStatus === 'scoring' ||
                                                existingGame.gameStatus === 'hidden_final_reveal' ||
                                                existingGame.gameStatus === 'ended' ||
                                                existingGame.gameStatus === 'no_contest';
                                            // 종료 후 같은 gameId로 베이스 사전 단계 패킷이 늦게 오면 결과 모달 대신 시작 확인이 뜨는 레이스 방지
                                            if (
                                                localAdvanced &&
                                                game.gameStatus === 'base_game_start_confirmation'
                                            ) {
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.warn(
                                                        '[WebSocket] Tower: ignoring base pre-play GAME_UPDATE while local is terminal',
                                                        { gameId, incoming: game.gameStatus }
                                                    );
                                                }
                                                return currentGames;
                                            }
                                            if (localAdvanced && game.gameStatus === 'pending') {
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.warn(
                                                        '[WebSocket] Tower: ignoring stale pending GAME_UPDATE while local is scoring/terminal',
                                                        { gameId }
                                                    );
                                                }
                                                return currentGames;
                                            }
                                            if (
                                                existingGame.gameStatus === 'scoring' &&
                                                game.gameStatus === 'playing' &&
                                                (game.moveHistory?.length ?? 0) <= (existingGame.moveHistory?.length ?? 0)
                                            ) {
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.warn(
                                                        '[WebSocket] Tower: ignoring stale playing GAME_UPDATE during local scoring',
                                                        { gameId }
                                                    );
                                                }
                                                return currentGames;
                                            }
                                            const localMoveHistoryLength = existingGame.moveHistory?.length || 0;
                                            const serverMoveHistoryLength = game.moveHistory?.length || 0;
                                            const localServerRevision = existingGame.serverRevision || 0;
                                            const serverRevision = game.serverRevision || 0;
                                            
                                            // 서버가 계가/히든 공개로 전환한 경우는 항상 반영 (공개할 히든 없이 바로 계가 시 멈춤 방지)
                                            const isServerScoringOrReveal =
                                                game.gameStatus === 'scoring' ||
                                                game.gameStatus === 'hidden_final_reveal' ||
                                                game.gameStatus === 'hidden_reveal_animating';
                                            // 종료 패킷은 analysisResult·summary·winner를 실어 오므로 반드시 반영 (무시 시 모달·영토 표시가 비는 버그)
                                            const isServerEndedOrNoContest = game.gameStatus === 'ended' || game.gameStatus === 'no_contest';
                                            // 서버가 아이템 사용 모드로 전환한 경우도 항상 반영 (히든/미사일/스캔 버튼 클릭 후 화면 전환)
                                            const isServerItemMode =
                                                game.gameStatus === 'hidden_placing' ||
                                                game.gameStatus === 'hidden_reveal_animating' ||
                                                game.gameStatus === 'missile_selecting' ||
                                                game.gameStatus === 'scanning';
                                            // 서버가 미사일 애니메이션 중인 상태를 보낸 경우 반영 (LAUNCH_MISSILE 직후 애니메이션 재생·완료 신호 전송을 위해)
                                            const isServerMissileAnimating = game.gameStatus === 'missile_animating';
                                            // 서버가 미사일/스캔 애니메이션 종료 후 playing으로 복귀한 경우 항상 반영 (애니메이션 멈춤·게임 재개)
                                            const isServerExitingAnimation = (existingGame.gameStatus === 'missile_animating' || existingGame.gameStatus === 'scanning' || existingGame.gameStatus === 'scanning_animating') && game.gameStatus === 'playing';
                                            const isServerPveStartConfirmProgress =
                                                existingGame.gameStatus === 'pending' &&
                                                isPvePostStartConfirmPrePlayPhase(game);
                                            // 클라이언트가 더 많은 수를 두었거나, 같은 수를 두었지만 클라이언트의 serverRevision이 더 크면 무시 (단, 계가/공개/종료/아이템모드/애니종료·시작확정 전환은 제외)
                                            if (!isServerScoringOrReveal && !isServerEndedOrNoContest && !isServerItemMode && !isServerMissileAnimating && !isServerExitingAnimation && !isServerPveStartConfirmProgress && (localMoveHistoryLength > serverMoveHistoryLength || 
                                                (localMoveHistoryLength === serverMoveHistoryLength && localServerRevision >= serverRevision))) {
                                                // 턴 추가(TOWER_ADD_TURNS) 등: 서버만 알고 있는 필드는 병합 (전체 패킷 무시 시 보너스·리비전 유실 방지)
                                                const srvRaw = (game as any).blackTurnLimitBonus;
                                                const serverBonusFieldSet = srvRaw !== undefined && srvRaw !== null;
                                                const serverBonus = Number(srvRaw) || 0;
                                                const localBonus = Number((existingGame as any).blackTurnLimitBonus) || 0;
                                                const mergedBonus = serverBonusFieldSet
                                                    ? serverBonus
                                                    : Math.max(serverBonus, localBonus);
                                                const srvRev = game.serverRevision ?? 0;
                                                const patch: Partial<LiveGameSession> & { blackTurnLimitBonus?: number } = {};
                                                if (mergedBonus !== localBonus) patch.blackTurnLimitBonus = mergedBonus;
                                                if (srvRev > localServerRevision) patch.serverRevision = srvRev;
                                                if (Object.keys(patch).length > 0) {
                                                    return {
                                                        ...currentGames,
                                                        [gameId]: { ...existingGame, ...patch } as LiveGameSession,
                                                    };
                                                }
                                                // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.log('[WebSocket] Tower game - Ignoring server update (client state is newer):', {
                                                        gameId,
                                                        localMoveHistoryLength,
                                                        serverMoveHistoryLength,
                                                        localServerRevision,
                                                        serverRevision
                                                    });
                                                }
                                                return currentGames;
                                            }
                                            
                                            // 중요한 필드만 비교하여 빠른 early return (stableStringify 호출 전에)
                                            const keyFieldsChanged = 
                                                existingGame.gameStatus !== game.gameStatus ||
                                                existingGame.currentPlayer !== game.currentPlayer ||
                                                existingGame.serverRevision !== game.serverRevision ||
                                                (game.animation && existingGame.animation?.type !== game.animation?.type);
                                            
                                            // 중요한 필드가 변경되지 않았을 때만 서명 비교
                                            if (!keyFieldsChanged) {
                                                const previousSignature = towerGameSignaturesRef.current[gameId];
                                                if (previousSignature) {
                                                    // 서명 비교는 비용이 큰 작업이므로 필요한 경우에만 수행
                                                    const signature = computeGameSessionFingerprint(game);
                                                    if (previousSignature === signature) {
                                                        return currentGames; // 완전히 동일한 상태
                                                    }
                                                    towerGameSignaturesRef.current[gameId] = signature;
                                                } else {
                                                    towerGameSignaturesRef.current[gameId] = computeGameSessionFingerprint(game);
                                                }
                                            } else {
                                                // 중요한 필드가 변경되었으므로 서명 업데이트
                                                towerGameSignaturesRef.current[gameId] = computeGameSessionFingerprint(game);
                                            }
                                        } else {
                                            // 새 게임이므로 서명 저장
                                            towerGameSignaturesRef.current[gameId] = computeGameSessionFingerprint(game);
                                        }
                                        
                                        const updatedGames = { ...currentGames };
                                        let mergedGame = game;
                                        // goAiBot AI 히든 연출 패킷은 boardState를 생략하는 경우가 있어, 그대로 병합하면
                                        // 클라 판이 비고 턴/연출만 꼬인다. 연출 중에는 기존 보드·수순을 유지한다.
                                        const isTowerAiHiddenPresentation =
                                            game.animation?.type === 'ai_thinking' ||
                                            (game as any).aiHiddenItemAnimationEndTime != null;
                                        if (
                                            isTowerAiHiddenPresentation &&
                                            existingGame &&
                                            (!game.boardState ||
                                                !Array.isArray(game.boardState) ||
                                                game.boardState.length === 0)
                                        ) {
                                            mergedGame = {
                                                ...mergedGame,
                                                boardState: existingGame.boardState,
                                                moveHistory:
                                                    Array.isArray(existingGame.moveHistory) &&
                                                    existingGame.moveHistory.length > 0
                                                        ? existingGame.moveHistory
                                                        : mergedGame.moveHistory,
                                            };
                                        }
                                        // 종료된 게임의 GAME_UPDATE 시 클라이언트 바둑판 유지 (서버는 보드 미저장 가능)
                                        if ((game.gameStatus === 'ended' || game.gameStatus === 'no_contest') && existingGame?.boardState &&
                                            Array.isArray(existingGame.boardState) && existingGame.boardState.length > 0) {
                                            mergedGame = { ...game, boardState: existingGame.boardState };
                                            if (existingGame.moveHistory?.length) mergedGame.moveHistory = existingGame.moveHistory;
                                            if (existingGame.blackPatternStones?.length) mergedGame.blackPatternStones = existingGame.blackPatternStones;
                                            if (existingGame.whitePatternStones?.length) mergedGame.whitePatternStones = existingGame.whitePatternStones;
                                        }
                                        // 종료 패킷에 analysisResult가 빠진 경우(직렬화/재조회 이슈), 직전 scoring 단계에서 받은 system 결과 유지
                                        if (
                                            (mergedGame.gameStatus === 'ended' || mergedGame.gameStatus === 'no_contest') &&
                                            existingGame?.analysisResult &&
                                            (existingGame.analysisResult as any)['system'] &&
                                            (!(mergedGame as any).analysisResult || !(mergedGame as any).analysisResult['system'])
                                        ) {
                                            mergedGame = {
                                                ...mergedGame,
                                                analysisResult: {
                                                    ...((mergedGame as any).analysisResult || {}),
                                                    system: (existingGame.analysisResult as any)['system'],
                                                } as any,
                                            };
                                        }
                                        // 스캔 애니메이션 종료(scanning_animating → playing) 시 보드/수순 보존 (대국 복원)
                                        const wasTowerScanningAnimating = existingGame?.gameStatus === 'scanning_animating' && game.gameStatus === 'playing';
                                        const wasTowerMissileAnimating = existingGame?.gameStatus === 'missile_animating' && game.gameStatus === 'playing';
                                        if ((wasTowerScanningAnimating || wasTowerMissileAnimating) && existingGame) {
                                            const serverBoardValid = game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0 && game.boardState[0] && Array.isArray(game.boardState[0]);
                                            const serverMoveHistoryValid = game.moveHistory && Array.isArray(game.moveHistory) && game.moveHistory.length > 0;
                                            const existingBoardValid = existingGame.boardState && Array.isArray(existingGame.boardState) && existingGame.boardState.length > 0;
                                            const existingMoveHistoryValid = existingGame.moveHistory && Array.isArray(existingGame.moveHistory) && existingGame.moveHistory.length > 0;
                                            const useExistingBoard = !serverBoardValid && existingBoardValid;
                                            const useExistingMoves = !serverMoveHistoryValid && existingMoveHistoryValid;
                                            if (useExistingBoard || useExistingMoves) {
                                                mergedGame = {
                                                    ...mergedGame,
                                                    boardState: useExistingBoard ? existingGame.boardState : mergedGame.boardState,
                                                    moveHistory: useExistingMoves ? existingGame.moveHistory : mergedGame.moveHistory,
                                                };
                                            }
                                        }
                                        if (
                                            existingGame &&
                                            (game.gameStatus === 'hidden_placing' ||
                                                game.gameStatus === 'scanning' ||
                                                game.gameStatus === 'missile_selecting')
                                        ) {
                                            mergedGame = mergeTowerServerGameWithClientBoardIfStale(mergedGame, existingGame);
                                        }
                                        // 21층 이상 자동계가: totalTurns를 moveHistory에서 항상 계산해 남은 턴 표시가 줄어들도록 함
                                        const autoScoringTurns = (mergedGame.settings as any)?.autoScoringTurns;
                                        if (autoScoringTurns && Array.isArray(mergedGame.moveHistory)) {
                                            const validMoves = mergedGame.moveHistory.filter((m: any) => m.x !== -1 && m.y !== -1);
                                            mergedGame = { ...mergedGame, totalTurns: validMoves.length };
                                        }
                                        // 서버 계가/종료 브로드캐스트는 boardState·수순을 생략하는 경우가 많음 → 클라 보드/수순 유지 (analysisResult는 서버 페이로드 유지)
                                        const towerDeferredSnap = pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId];
                                        const towerPreserveExisting =
                                            (pickRicherWsBoardSnapshot(existingGame, towerDeferredSnap) ?? existingGame) as
                                                | typeof existingGame
                                                | undefined;
                                        if (
                                            (mergedGame.gameStatus === 'scoring' ||
                                                mergedGame.gameStatus === 'ended' ||
                                                mergedGame.gameStatus === 'no_contest') &&
                                            towerPreserveExisting
                                        ) {
                                            const towerScoringResolved = resolvePveScoringBoardAndMoveHistory(
                                                mergedGame,
                                                towerPreserveExisting,
                                            );
                                            mergedGame = {
                                                ...mergedGame,
                                                boardState: towerScoringResolved.boardState,
                                                moveHistory: towerScoringResolved.moveHistory,
                                            };
                                        }
                                        if (
                                            mergedGame.gameStatus === 'scoring' ||
                                            mergedGame.gameStatus === 'hidden_final_reveal' ||
                                            mergedGame.gameStatus === 'ended' ||
                                            mergedGame.gameStatus === 'no_contest'
                                        ) {
                                            delete pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId];
                                        }
                                        if (
                                            (mergedGame.gameStatus === 'scoring' ||
                                                mergedGame.gameStatus === 'hidden_final_reveal' ||
                                                mergedGame.gameStatus === 'ended' ||
                                                mergedGame.gameStatus === 'no_contest') &&
                                            towerGnugoDelayTimeoutRef.current[gameId] != null
                                        ) {
                                            clearTimeout(towerGnugoDelayTimeoutRef.current[gameId]!);
                                            delete towerGnugoDelayTimeoutRef.current[gameId];
                                        }
                                        mergedGame = mergeTowerPveMonotonicCaptureFieldsFromClient(
                                            mergedGame,
                                            towerPreserveExisting ?? existingGame,
                                        );
                                        mergedGame = mergePveGameUpdateFromWs(
                                            mergedGame,
                                            game,
                                            existingGame,
                                            towerDeferredSnap,
                                        );
                                        mergedGame = coerceClassicPveHumanBlackSeatsIfSwapped(mergedGame);
                                        updatedGames[gameId] = mergedGame;

                                        // 그누고(AI) 수: 1초 지연 후 표시 (유저 수는 클라이언트에서 즉시 반영됨)
                                        const isNewAiMove =
                                            hasNewMoves &&
                                            Array.isArray(mergedGame.moveHistory) &&
                                            mergedGame.moveHistory.length > 0 &&
                                            mergedGame.whitePlayerId === aiUserId &&
                                            (mergedGame.moveHistory[mergedGame.moveHistory.length - 1] as any)?.player ===
                                                Player.White;
                                        const mergedAdvancesToTerminal =
                                            shouldApplyPveAiMoveSnapshotImmediately(mergedGame);
                                        // 계가·종료 전환은 지연 없이 즉시 반영해야 함. return currentGames만 하면 mergedGame이 버려져
                                        // 계가 연출 중 gameStatus가 pending으로 되돌아가 경기 시작 모달이 다시 뜨는 버그가 난다.
                                        if (isNewAiMove && !mergedAdvancesToTerminal) {
                                            if (towerGnugoDelayTimeoutRef.current[gameId] != null) {
                                                clearTimeout(towerGnugoDelayTimeoutRef.current[gameId]);
                                            }
                                            const gameToApply = JSON.parse(JSON.stringify(mergedGame)) as LiveGameSession;
                                            const towerDeferredSnap = pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId];
                                            updatedGames[gameId] = applyStrategicPlayingBoardAndMoveHistoryResolve(
                                                (pickRicherWsBoardSnapshot(existingGame, towerDeferredSnap) ??
                                                    existingGame ??
                                                    mergedGame) as LiveGameSession,
                                                existingGame,
                                            );
                                            pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId] = gameToApply;
                                            const isScoringInUpdate = gameToApply.gameStatus === 'scoring';
                                            const scheduledAt = Date.now();
                                            towerGnugoDelayTimeoutRef.current[gameId] = setTimeout(() => {
                                                delete towerGnugoDelayTimeoutRef.current[gameId];
                                                let appliedDelayedSnapshot = false;
                                                const delayedByMs = Math.max(0, Date.now() - scheduledAt);
                                                const shiftedGameToApply = shiftDelayedAiSnapshotTurnClock(gameToApply, delayedByMs);
                                                // 서버가 이미 scoring이면 playing→scoring 깜빡임은 ScoringOverlay를 두 번 마운트시킴 → 즉시 scoring 반영
                                                if (isScoringInUpdate) {
                                                    if (towerScoringDelayTimeoutRef.current[gameId] != null) {
                                                        clearTimeout(towerScoringDelayTimeoutRef.current[gameId]);
                                                        delete towerScoringDelayTimeoutRef.current[gameId];
                                                    }
                                                    setTowerGames(prev => {
                                                        if (shouldSkipDelayedAiSnapshotApply(prev[gameId], shiftedGameToApply)) return prev;
                                                        appliedDelayedSnapshot = true;
                                                        return { ...prev, [gameId]: shiftedGameToApply };
                                                    });
                                                } else {
                                                    setTowerGames(prev => {
                                                        if (shouldSkipDelayedAiSnapshotApply(prev[gameId], shiftedGameToApply)) return prev;
                                                        appliedDelayedSnapshot = true;
                                                        return { ...prev, [gameId]: shiftedGameToApply };
                                                    });
                                                }
                                                if (appliedDelayedSnapshot) {
                                                    lastGameUpdateMoveCountRef.current[gameId] = shiftedGameToApply.moveHistory?.length ?? 0;
                                                    towerGameSignaturesRef.current[gameId] = computeGameSessionFingerprint(shiftedGameToApply);
                                                }
                                                delete pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId];
                                            }, 1000);
                                            return updatedGames;
                                        }

                                        if (currentUser && mergedGame.player1 && mergedGame.player2) {
                                            const isPlayer1 = mergedGame.player1.id === currentUser.id;
                                            const isPlayer2 = mergedGame.player2.id === currentUser.id;
                                            const currentStatus = currentUserStatusRef.current;
                                            const isActiveForGame = !!currentStatus &&
                                                (currentStatus.gameId === gameId || currentStatus.spectatingGameId === gameId) &&
                                                (currentStatus.status === 'in-game' || currentStatus.status === 'spectating');

                                            if ((isPlayer1 || isPlayer2) && isActiveForGame) {
                                                const targetHash = `#/game/${gameId}`;
                                                if (window.location.hash !== targetHash) {
                                                    // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
                                                    if (process.env.NODE_ENV === 'development') {
                                                        console.log('[WebSocket] Routing to tower game:', gameId);
                                                    }
                                                    setTimeout(() => {
                                                        if (window.location.hash !== targetHash) {
                                                            window.location.hash = targetHash;
                                                        }
                                                    }, 100);
                                                }
                                            }
                                        }
                                        return updatedGames;
                                    });
                                } else {
                                    setLiveGames(currentGames => {
                                        const existingGame = currentGames[gameId];
                                        if (shouldDropStaleStrategicGameUpdate(game, existingGame)) {
                                            return currentGames;
                                        }
                                        if (shouldIgnoreBaseModeGameStatusRegression(game, existingGame)) {
                                            if (process.env.NODE_ENV === 'development') {
                                                console.warn(
                                                    '[WebSocket] Live: ignoring stale base pre-play GAME_UPDATE while local already past base flow',
                                                    { gameId, incoming: game.gameStatus, local: existingGame?.gameStatus },
                                                );
                                            }
                                            return currentGames;
                                        }
                                        if (shouldIgnoreStalePendingAiLobbyStartRegression(game, existingGame)) {
                                            if (process.env.NODE_ENV === 'development') {
                                                console.warn(
                                                    '[WebSocket] Live: ignoring stale pending GAME_UPDATE after AI lobby start confirm',
                                                    { gameId, local: existingGame?.gameStatus },
                                                );
                                            }
                                            return currentGames;
                                        }
                                        // 주사위/도둑: 소켓 패킷이 HTTP보다 늦거나 순서가 뒤바뀌면 낡은 상태로 덮어쓰지 않음
                                        if (shouldIgnoreOutdatedPlayfulUpdate(game, existingGame, { source: 'ws_game_update' })) {
                                            return currentGames;
                                        }
                                        if (shouldIgnoreStaleLiveTerminalGameUpdate(game, existingGame)) {
                                            if (process.env.NODE_ENV === 'development') {
                                                console.warn(
                                                    '[WebSocket] Live: ignoring stale GAME_UPDATE during local scoring/terminal',
                                                    { gameId, incoming: game.gameStatus, local: existingGame?.gameStatus },
                                                );
                                            }
                                            return currentGames;
                                        }
                                        const incomingMoveCount = (game.moveHistory && Array.isArray(game.moveHistory)) ? game.moveHistory.length : 0;
                                        const existingMoveCount = (existingGame?.moveHistory && Array.isArray(existingGame.moveHistory)) ? existingGame.moveHistory.length : 0;
                                        // 새 수(AI 수 등)가 있으면 반드시 반영 - 서명 일치해도 스킵하지 않음 (AI가 둔 수가 사라지는 버그 방지)
                                        const hasNewMoves = incomingMoveCount > existingMoveCount;
                                        const isScoringTransition =
                                            game.gameStatus === 'scoring' && existingGame?.gameStatus !== 'scoring';
                                        const isPlayfulLiveGameInner =
                                            PLAYFUL_GAME_MODES.some((m) => m.mode === game.mode) ||
                                            (!!existingGame &&
                                                PLAYFUL_GAME_MODES.some((m) => m.mode === existingGame.mode));
                                        const playfulTurnOrPhaseChanged =
                                            isPlayfulLiveGameInner &&
                                            !!existingGame &&
                                            (existingGame.currentPlayer !== game.currentPlayer ||
                                                existingGame.gameStatus !== game.gameStatus ||
                                                (game.serverRevision ?? 0) !== (existingGame.serverRevision ?? 0));
                                        if (!hasNewMoves && !isScoringTransition && !playfulTurnOrPhaseChanged) {
                                            const signature = computeGameSessionFingerprint(game);
                                            const previousSignature = liveGameSignaturesRef.current[gameId];
                                            if (previousSignature === signature) {
                                                return currentGames;
                                            }
                                            liveGameSignaturesRef.current[gameId] = signature;
                                        } else {
                                            liveGameSignaturesRef.current[gameId] = computeGameSessionFingerprint(game);
                                        }
                                        const updatedGames = { ...currentGames };
                                        let mergedGame: typeof game = preservePveAiHiddenPresentationOnMerge(game, existingGame);
                                        const incomingRound = game.round ?? 1;
                                        const existingRound = existingGame?.round ?? 1;
                                        const boardSize = game.settings?.boardSize;
                                        const serverBoardGridOk =
                                            Array.isArray(game.boardState) &&
                                            game.boardState.length > 0 &&
                                            typeof boardSize === 'number' &&
                                            boardSize > 0 &&
                                            game.boardState.length === boardSize &&
                                            Array.isArray(game.boardState[0]) &&
                                            game.boardState[0].length === boardSize;
                                        /** 라운드 종료 모달 직후 → 다음 라운드: 병합이 빈 판을 유지하는 케이스 보정 */
                                        const isDiceGoNewRoundFromRoundEnd =
                                            game.mode === GameMode.Dice &&
                                            !!existingGame &&
                                            existingGame.gameStatus === 'dice_round_end' &&
                                            game.gameStatus === 'dice_rolling' &&
                                            incomingRound > existingRound &&
                                            serverBoardGridOk;
                                        const hasServerBoard = game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0 &&
                                            game.boardState.some((row: any[]) => row && Array.isArray(row) && row.some((c: any) => c !== 0 && c != null));
                                        const isDiceOrThiefMode =
                                            game.mode === GameMode.Dice || game.mode === GameMode.Thief;
                                        const thiefRolesSwappedVsClient =
                                            game.mode === GameMode.Thief &&
                                            !!existingGame &&
                                            (game.thiefPlayerId !== existingGame.thiefPlayerId ||
                                                game.policePlayerId !== existingGame.policePlayerId);
                                        /** 도둑/주사위: 서버가 기보를 비운 리셋 패킷인데, 아래 병합이 `isDiceOrThiefMode` 때문에 빈 판을 항상 예전 판으로 덮어쓰던 버그 방지 */
                                        /** thief_placing → thief_round_end: 서버가 모달 진입 시 판을 비움. 기존 조건은 existing이 이미 round_end일 때만 신뢰해 첫 패킷에서 옛 판으로 덮는 버그가 있었음 */
                                        const thiefRoundEndEmptyBoardHandshake =
                                            game.mode === GameMode.Thief &&
                                            game.gameStatus === 'thief_round_end' &&
                                            !hasServerBoard &&
                                            Array.isArray(game.moveHistory) &&
                                            game.moveHistory.length === 0 &&
                                            existingMoveCount > 0 &&
                                            !!existingGame &&
                                            ['thief_rolling', 'thief_rolling_animating', 'thief_placing'].includes(
                                                existingGame.gameStatus
                                            );
                                        /** 라운드↑ 또는 역할 교대 직후: rolling/placing + 빈 기보 — 같은 라운드 중엔 신뢰하지 않음 */
                                        const thiefNewRoundEmptyBoardHandshake =
                                            game.mode === GameMode.Thief &&
                                            ['thief_rolling', 'thief_rolling_animating', 'thief_placing'].includes(
                                                game.gameStatus
                                            ) &&
                                            !hasServerBoard &&
                                            Array.isArray(game.moveHistory) &&
                                            game.moveHistory.length === 0 &&
                                            existingMoveCount > 0 &&
                                            !!existingGame &&
                                            (incomingRound > existingRound || thiefRolesSwappedVsClient);
                                        const playfulTrustEmptyServerBoardSnapshot =
                                            isDiceOrThiefMode &&
                                            serverBoardGridOk &&
                                            !hasServerBoard &&
                                            Array.isArray(game.moveHistory) &&
                                            game.moveHistory.length === 0 &&
                                            existingMoveCount > 0 &&
                                            (incomingRound > existingRound ||
                                                thiefRolesSwappedVsClient ||
                                                thiefRoundEndEmptyBoardHandshake ||
                                                thiefNewRoundEmptyBoardHandshake ||
                                                (game.mode === GameMode.Thief &&
                                                    existingGame?.gameStatus === 'thief_round_end' &&
                                                    [
                                                        'thief_rolling',
                                                        'thief_rolling_animating',
                                                        'thief_placing',
                                                    ].includes(game.gameStatus)) ||
                                                (game.mode === GameMode.Dice &&
                                                    existingGame?.gameStatus === 'dice_round_end' &&
                                                    [
                                                        'dice_rolling',
                                                        'dice_rolling_animating',
                                                        'dice_placing',
                                                    ].includes(game.gameStatus)));
                                        const moveHistoryToDerive = (game.moveHistory && Array.isArray(game.moveHistory) && game.moveHistory.length > 0)
                                            ? game.moveHistory
                                            : ((game.gameStatus === 'scoring' || game.gameStatus === 'ended') && existingGame?.moveHistory && Array.isArray(existingGame.moveHistory) && existingGame.moveHistory.length > 0 ? existingGame.moveHistory : null);

                                        // 낙관적 업데이트(유저 착수) 후 서버보다 오래된 GAME_UPDATE가 도착하면 보드/수순만 유지하고, 턴은 수순 기준으로 설정 (착수 위치 바뀜/사라짐 + 봇 턴 미인식 → 시간승 버그 방지)
                                        const existingBoardValid = existingGame?.boardState && Array.isArray(existingGame.boardState) && existingGame.boardState.length > 0;
                                        if (
                                            incomingMoveCount < existingMoveCount &&
                                            existingBoardValid &&
                                            existingGame?.moveHistory &&
                                            Array.isArray(existingGame.moveHistory) &&
                                            existingGame.moveHistory.length > 0 &&
                                            !playfulTrustEmptyServerBoardSnapshot
                                        ) {
                                            const lastMove = existingGame.moveHistory[existingGame.moveHistory.length - 1];
                                            const nextPlayer = lastMove && (lastMove as any).player === Player.Black ? Player.White : Player.Black;
                                            mergedGame = overlayChessPlayingFieldsFromExisting(
                                                {
                                                    ...game,
                                                    boardState: existingGame.boardState,
                                                    moveHistory: existingGame.moveHistory,
                                                    currentPlayer: nextPlayer,
                                                    // 수순을 클라이언트 것으로 맞출 때 hiddenMoves도 함께 맞춰야 스캔 버튼·히든 문양 인덱스가 어긋나지 않음
                                                    hiddenMoves: existingGame.hiddenMoves ?? game.hiddenMoves,
                                                },
                                                existingGame,
                                            );
                                            if ((existingGame as any).koInfo !== undefined) mergedGame.koInfo = (existingGame as any).koInfo;
                                            if ((existingGame as any).lastMove !== undefined) mergedGame.lastMove = (existingGame as any).lastMove;
                                        }

                                        // IMPORTANT: 서버가 boardState를 생략한 경우 moveHistory로 "단순 복원"하면 포획이 반영되지 않아 없던 돌이 생길 수 있음.
                                        // 가능한 한 기존 보드(boardState)를 보존하되, 서버 수순이 이미 늘어난 업데이트(AI 착수 등)에서는 기존 짧은 moveHistory로 덮어쓰면 안 됨(돌 사라짐·착수 불가).
                                        if (
                                            !hasServerBoard &&
                                            existingBoardValid &&
                                            !playfulTrustEmptyServerBoardSnapshot &&
                                            (incomingMoveCount <= existingMoveCount || isDiceOrThiefMode)
                                        ) {
                                            mergedGame = { ...game, boardState: existingGame!.boardState, moveHistory: existingGame?.moveHistory && Array.isArray(existingGame.moveHistory) && existingGame.moveHistory.length > 0 ? existingGame.moveHistory : game.moveHistory };
                                        } else if (
                                            !isDiceOrThiefMode &&
                                            game.mode !== GameMode.Chess &&
                                            !hasServerBoard &&
                                            moveHistoryToDerive &&
                                            moveHistoryToDerive.length > 0 &&
                                            game.settings?.boardSize
                                        ) {
                                            const derivedBoard = replayStrategicBoardFromMoveHistory(
                                                {
                                                    ...game,
                                                    moveHistory:
                                                        game.moveHistory &&
                                                        Array.isArray(game.moveHistory) &&
                                                        game.moveHistory.length > 0
                                                            ? game.moveHistory
                                                            : moveHistoryToDerive,
                                                },
                                                existingGame,
                                            );
                                            if (derivedBoard) {
                                                mergedGame = {
                                                    ...game,
                                                    boardState: derivedBoard,
                                                    moveHistory:
                                                        game.moveHistory &&
                                                        Array.isArray(game.moveHistory) &&
                                                        game.moveHistory.length > 0
                                                            ? game.moveHistory
                                                            : moveHistoryToDerive,
                                                };
                                            }
                                        } else if (!isDiceOrThiefMode && incomingMoveCount <= existingMoveCount && existingGame?.boardState && Array.isArray(existingGame.boardState) && existingGame.boardState.length > 0 && !hasServerBoard) {
                                            // 서버가 boardState를 보내지 않았고, 서버 수가 기존보다 많지 않을 때만 기존 보드 유지 (AI 수 업데이트 덮어쓰기 방지)
                                            mergedGame = { ...game, boardState: existingGame.boardState };
                                            if (existingGame.moveHistory && Array.isArray(existingGame.moveHistory) && existingGame.moveHistory.length > 0) {
                                                mergedGame.moveHistory = existingGame.moveHistory;
                                                mergedGame.hiddenMoves = existingGame.hiddenMoves ?? mergedGame.hiddenMoves;
                                            }
                                        }
                                        // 온라인 히든: 스캔 애니 종료(scanning_animating → playing) 시 서버가 보드/수순을 생략하면 클라 유지
                                        const wasLiveScanningAnimating =
                                            existingGame?.gameStatus === 'scanning_animating' && game.gameStatus === 'playing';
                                        const wasLiveMissileAnimating =
                                            existingGame?.gameStatus === 'missile_animating' && game.gameStatus === 'playing';
                                        if ((wasLiveScanningAnimating || wasLiveMissileAnimating) && existingGame) {
                                            const serverBoardValid = game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0 && game.boardState[0] && Array.isArray(game.boardState[0]);
                                            const serverMoveHistoryValid = game.moveHistory && Array.isArray(game.moveHistory) && game.moveHistory.length > 0;
                                            const existingBoardValid = existingGame.boardState && Array.isArray(existingGame.boardState) && existingGame.boardState.length > 0;
                                            const existingMoveHistoryValid = existingGame.moveHistory && Array.isArray(existingGame.moveHistory) && existingGame.moveHistory.length > 0;
                                            if (shouldClearMissileFlightAnimationOnPlayingMerge(existingGame, game)) {
                                                mergedGame = { ...mergedGame, animation: null };
                                            }
                                            if (!serverBoardValid && existingBoardValid) {
                                                mergedGame = { ...mergedGame, boardState: existingGame.boardState };
                                            }
                                            if (!serverMoveHistoryValid && existingMoveHistoryValid) {
                                                mergedGame = { ...mergedGame, moveHistory: existingGame.moveHistory };
                                            }
                                            const clientRevealed = existingGame.revealedHiddenMoves;
                                            const serverRevealed = game.revealedHiddenMoves;
                                            if (
                                                wasLiveScanningAnimating &&
                                                clientRevealed &&
                                                typeof clientRevealed === 'object' &&
                                                (!serverRevealed || Object.keys(serverRevealed).length === 0)
                                            ) {
                                                mergedGame = { ...mergedGame, revealedHiddenMoves: clientRevealed };
                                            }
                                        }
                                        // 주사위 착수: 낙관적은 moveHistory를 늘리지 않아 수순 길이가 같을 때 서버의 낡은 보드가 오면 돌만 사라지고 lastMove만 바뀌는 현상(소리만 남)이 난다.
                                        // NOTE: 도둑과 경찰은 백(경찰) 착수로 백돌 수가 "정상적으로 증가"할 수 있어 이 비교식을 공유하면 최신 패킷을 낡은 보드로 되돌린다.
                                        //       (유저 화면에서는 빈칸인데 서버는 이미 착수됨 → "이미 돌이 놓인 자리입니다.")
                                        if (
                                            game.mode === GameMode.Dice &&
                                            game.gameStatus === 'dice_placing' &&
                                            incomingMoveCount === existingMoveCount &&
                                            existingBoardValid &&
                                            hasServerBoard
                                        ) {
                                            const countBlack = (b: typeof game.boardState) =>
                                                b?.flat().filter((c: number) => c === Player.Black).length ?? 0;
                                            const countWhite = (b: typeof game.boardState) =>
                                                b?.flat().filter((c: number) => c === Player.White).length ?? 0;
                                            const ib = countBlack(game.boardState);
                                            const eb = countBlack(existingGame.boardState);
                                            const iw = countWhite(game.boardState);
                                            const ew = countWhite(existingGame.boardState);
                                            if (eb > ib || ew < iw) {
                                                mergedGame = {
                                                    ...game,
                                                    boardState: existingGame.boardState,
                                                    lastMove: existingGame.lastMove ?? game.lastMove,
                                                    koInfo: existingGame.koInfo ?? game.koInfo,
                                                    stonesToPlace: existingGame.stonesToPlace,
                                                    stonesPlacedThisTurn: existingGame.stonesPlacedThisTurn,
                                                    diceCapturesThisTurn: existingGame.diceCapturesThisTurn,
                                                    diceLastCaptureStones: existingGame.diceLastCaptureStones,
                                                    moveHistory: existingGame.moveHistory ?? game.moveHistory,
                                                };
                                            }
                                        }
                                        // 전략바둑 AI 대국: 같은 수인데 서버가 낡은 GAME_UPDATE인 경우 보드/수순/턴 유지 (돌 위치 바뀜·시간승 버그 방지)
                                        // 주사위/도둑 착수는 위에서 처리 — 여기서 sameLastMove로 서버 보드를 덮어쓰면 안 됨
                                        // 페어 4인 수순은 moveHistory 흑/백 교대만으로 턴을 추론할 수 없고 currentTurnIndex가 권위 → 제외
                                        const playfulPlacingStaleMerge =
                                            (game.mode === GameMode.Dice && game.gameStatus === 'dice_placing') ||
                                            (game.mode === GameMode.Thief && game.gameStatus === 'thief_placing');
                                        // 주사위/도둑: 착수 기록의 player는 항상 흑(따내는 돌)이라 moveHistory만으로 "다음 턴 색"을 추론하면 항상 백이 됨.
                                        // AI가 백일 때 오버샷 후 서버가 currentPlayer를 흑(유저)으로내도 stale로 오판해 AI 턴으로 되돌리는 버그가 난다.
                                        if (
                                            (isSessionStrategicAiLike(game) || getSessionArenaKind(game) === 'guildwar') &&
                                            !isPairClassicGame(game.settings, game.mode) &&
                                            !playfulPlacingStaleMerge &&
                                            game.mode !== GameMode.Dice &&
                                            game.mode !== GameMode.Thief &&
                                            game.gameStatus !== 'missile_animating' &&
                                            game.gameStatus !== 'hidden_reveal_animating' &&
                                            existingGame?.gameStatus !== 'missile_animating' &&
                                            existingGame?.gameStatus !== 'missile_selecting' &&
                                            existingGame?.gameStatus !== 'hidden_reveal_animating' &&
                                            incomingMoveCount === existingMoveCount &&
                                            existingBoardValid &&
                                            existingGame?.moveHistory?.length > 0
                                        ) {
                                            const lastExisting = existingGame.moveHistory[existingGame.moveHistory.length - 1];
                                            const lastIncoming = game.moveHistory?.[game.moveHistory.length - 1];
                                            const sameLastMove = lastExisting && lastIncoming &&
                                                (lastExisting as any).x === (lastIncoming as any).x &&
                                                (lastExisting as any).y === (lastIncoming as any).y &&
                                                (lastExisting as any).player === (lastIncoming as any).player;
                                            const aiPlayerEnum = game.whitePlayerId === aiUserId ? Player.White : Player.Black;
                                            const nextAfterLast = lastExisting && (lastExisting as any).player === Player.Black ? Player.White : Player.Black;
                                            const serverTurnStale = nextAfterLast === aiPlayerEnum && game.currentPlayer !== aiPlayerEnum;
                                            if (sameLastMove && (serverTurnStale || !hasServerBoard)) {
                                                mergedGame = overlayChessPlayingFieldsFromExisting(
                                                    {
                                                        ...game,
                                                        boardState: existingGame.boardState,
                                                        moveHistory: existingGame.moveHistory,
                                                        currentPlayer: serverTurnStale ? existingGame.currentPlayer : game.currentPlayer,
                                                        hiddenMoves: existingGame.hiddenMoves ?? game.hiddenMoves,
                                                    },
                                                    existingGame,
                                                );
                                                if ((existingGame as any).koInfo !== undefined) mergedGame.koInfo = (existingGame as any).koInfo;
                                                if ((existingGame as any).lastMove !== undefined) mergedGame.lastMove = (existingGame as any).lastMove;
                                            } else if (serverTurnStale) {
                                                mergedGame = { ...mergedGame, currentPlayer: existingGame.currentPlayer };
                                            }
                                        }
                                        // 미사일 비행 중 GAME_UPDATE: 앞선 병합이 낡은 보드/수순을 남겨도 서버 최종 상태로 덮어 애니 종료 시점과 보드가 일치하게 함
                                        if (
                                            game.gameStatus === 'missile_animating' &&
                                            hasServerBoard &&
                                            game.moveHistory &&
                                            Array.isArray(game.moveHistory) &&
                                            game.moveHistory.length > 0
                                        ) {
                                            mergedGame = {
                                                ...mergedGame,
                                                boardState: game.boardState,
                                                moveHistory: game.moveHistory,
                                                captures: game.captures ?? mergedGame.captures,
                                                lastMove: game.lastMove ?? mergedGame.lastMove,
                                                koInfo: game.koInfo !== undefined ? game.koInfo : mergedGame.koInfo,
                                                justCaptured: game.justCaptured ?? mergedGame.justCaptured,
                                                animation: game.animation ?? mergedGame.animation,
                                                permanentlyRevealedStones:
                                                    game.permanentlyRevealedStones ?? mergedGame.permanentlyRevealedStones,
                                                baseStones: game.baseStones ?? mergedGame.baseStones,
                                                blackPatternStones: game.blackPatternStones ?? mergedGame.blackPatternStones,
                                                whitePatternStones: game.whitePatternStones ?? mergedGame.whitePatternStones,
                                                hiddenMoves: game.hiddenMoves ?? mergedGame.hiddenMoves,
                                            };
                                        }
                                        const isThiefNewSegmentFromRoundEnd =
                                            game.mode === GameMode.Thief &&
                                            !!existingGame &&
                                            existingGame.gameStatus === 'thief_round_end' &&
                                            ['thief_rolling', 'thief_rolling_animating', 'thief_placing'].includes(
                                                game.gameStatus,
                                            ) &&
                                            (incomingRound > existingRound || thiefRolesSwappedVsClient) &&
                                            serverBoardGridOk;
                                        if (isDiceGoNewRoundFromRoundEnd) {
                                            mergedGame = {
                                                ...mergedGame,
                                                boardState: game.boardState.map((row: number[]) => [...row]),
                                                moveHistory: Array.isArray(game.moveHistory)
                                                    ? game.moveHistory.map((m: any) => ({ ...m }))
                                                    : [],
                                            };
                                        }
                                        if (isThiefNewSegmentFromRoundEnd) {
                                            mergedGame = {
                                                ...mergedGame,
                                                boardState: game.boardState.map((row: number[]) => [...row]),
                                                moveHistory: Array.isArray(game.moveHistory)
                                                    ? game.moveHistory.map((m: any) => ({ ...m }))
                                                    : [],
                                            };
                                        }
                                        // 종료·무효 GAME_UPDATE가 보드만 실어 오고 summary가 빠지면 병합 결과에서 정산(골드·경험치 등)이 사라짐 → 기존 스냅샷 유지
                                        const incomingSummaryKeys =
                                            game.summary && typeof game.summary === 'object'
                                                ? Object.keys(game.summary as object)
                                                : [];
                                        if (
                                            (game.gameStatus === 'ended' || game.gameStatus === 'no_contest') &&
                                            incomingSummaryKeys.length === 0 &&
                                            existingGame?.summary &&
                                            typeof existingGame.summary === 'object' &&
                                            Object.keys(existingGame.summary as object).length > 0
                                        ) {
                                            mergedGame = { ...mergedGame, summary: existingGame.summary };
                                        }
                                        /** 로비 AI 등: 슬림 패킷·낙관적 상태 편차 시 따내기 점수가 클라에서 내려가거나 멈춘 것처럼 보이는 현상 방지 */
                                        mergedGame = {
                                            ...mergedGame,
                                            captures: mergeMonotonicCountRecord(
                                                existingGame?.captures as LiveGameSession['captures'],
                                                mergedGame.captures as LiveGameSession['captures']
                                            ) ?? mergedGame.captures,
                                        };
                                        mergedGame = preferClientLockedStrategicSeatsOverIncomingDrift(mergedGame, existingGame);
                                        mergedGame = alignBaseModeCurrentPlayerWithExistingWhenSlimDrift(
                                            mergedGame,
                                            game,
                                            existingGame,
                                            { playfulTrustEmptyServerBoardSnapshot }
                                        );
                                        mergedGame = preserveStrategicSessionOverlaysIfIncomingOmitted(
                                            mergedGame,
                                            game,
                                            existingGame
                                        );
                                        if (isScoringTransition && liveGameGnugoDelayTimeoutRef.current[gameId] != null) {
                                            clearTimeout(liveGameGnugoDelayTimeoutRef.current[gameId]);
                                            delete liveGameGnugoDelayTimeoutRef.current[gameId];
                                        }
                                        if (isScoringTransition) {
                                            clearPairAiMoveRevealQueue(gameId, pairAiMoveRevealQueueRef);
                                        }
                                        const liveDeferredSnap = pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId];
                                        const liveRicherExisting =
                                            (pickRicherWsBoardSnapshot(existingGame, liveDeferredSnap) ?? existingGame) as
                                                | typeof existingGame
                                                | undefined;
                                        const livePvePolicy = resolveArenaSessionPolicy(mergedGame as any);
                                        let liveMerged =
                                            livePvePolicy.matchAxis === 'pve'
                                                ? mergePveGameUpdateFromWs(
                                                      mergedGame,
                                                      game,
                                                      existingGame,
                                                      liveDeferredSnap,
                                                  )
                                                : (() => {
                                                      let merged = mergeGameUpdateByArena(mergedGame, liveRicherExisting, {
                                                          source: 'game_update',
                                                      });
                                                      if (shouldResolveStrategicPlayingBoardForMatchAxis(livePvePolicy.matchAxis)) {
                                                          merged = applyStrategicPlayingBoardAndMoveHistoryResolve(
                                                              merged,
                                                              liveRicherExisting,
                                                          );
                                                      }
                                                      return merged;
                                                  })();
                                        if (
                                            existingGame?.gameStatus === 'missile_animating' &&
                                            liveMerged.gameStatus === 'playing' &&
                                            liveMerged.animation &&
                                            (liveMerged.animation.type === 'missile' ||
                                                liveMerged.animation.type === 'hidden_missile')
                                        ) {
                                            liveMerged = { ...liveMerged, animation: null };
                                        }
                                        liveMerged = preserveTerminalAnalysisResultOnMerge(
                                            liveMerged,
                                            liveRicherExisting ?? existingGame,
                                        );
                                        liveMerged = preservePairTurnIfExistingAhead(existingGame, liveMerged);
                                        updatedGames[gameId] = liveMerged;
                                        if (
                                            liveMerged.gameStatus === 'scoring' ||
                                            liveMerged.gameStatus === 'ended' ||
                                            liveMerged.gameStatus === 'no_contest' ||
                                            liveMerged.gameStatus === 'rematch_pending'
                                        ) {
                                            persistEndedPvpGameToSessionStorage(liveMerged);
                                        }
                                        if (
                                            game.gameStatus === 'scoring' ||
                                            game.gameStatus === 'hidden_final_reveal' ||
                                            game.gameStatus === 'ended' ||
                                            game.gameStatus === 'no_contest'
                                        ) {
                                            delete pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId];
                                            clearPairAiMoveRevealQueue(gameId, pairAiMoveRevealQueueRef);
                                        }

                                        // 전략바둑 AI(KATA 등) 수: 짧은 지연 후 표시 (바로 두면 연출·턴 표시가 어색함)
                                        // 주사위/도둑 등 놀이바둑은 지연을 쓰지 않음
                                        const STRATEGIC_AI_MOVE_DELAY_MS = 1000;
                                        const isDiceOrThiefPlayful =
                                            game.mode === GameMode.Dice || game.mode === GameMode.Thief;
                                        const isStrategicAiGame =
                                            isSessionStrategicAiLike(game) && game.moveHistory?.length > 0 && !isDiceOrThiefPlayful;
                                        const lastMove = (game.moveHistory as any[])?.[game.moveHistory.length - 1];
                                        const aiPlayerEnum = game.whitePlayerId === aiUserId ? Player.White : Player.Black;
                                        const isNewAiMoveLive = isStrategicAiGame && hasNewMoves && lastMove?.player === aiPlayerEnum;
                                        const pairTurnOrder = Array.isArray(game.settings?.pairGame?.turnOrder)
                                            ? game.settings.pairGame.turnOrder
                                            : [];
                                        const isNewPairAiMoveLive =
                                            hasNewMoves &&
                                            isPairClassicGame(game.settings, game.mode) &&
                                            pairTurnOrder.length > 0 &&
                                            isPairAiMoveInHistory(lastMove, pairTurnOrder);
                                        // 체스 바둑: 서버가 기물 이동 후 2초 뒤 돌을 반영하므로 클라에서 또 미루면 간격이 2배가 된다.
                                        const isChessGoStoneAfterPieceMove =
                                            game.mode === GameMode.Chess &&
                                            hasNewMoves &&
                                            existingGame?.chessPieceMovedThisTurn === true &&
                                            mergedGame.chessPieceMovedThisTurn === false;
                                        // 모험/길드전: 서버가 유저 착수 후 1초 뒤 AI를 반영하므로 클라에서 또 1초 미루면 체감이 2초가 된다.
                                        const deferStrategicAiMoveForEffect =
                                            (isNewAiMoveLive || isNewPairAiMoveLive) &&
                                            !isChessGoStoneAfterPieceMove &&
                                            game.gameCategory !== 'adventure' &&
                                            game.gameCategory !== 'guildwar' &&
                                            !shouldApplyPveAiMoveSnapshotImmediately(mergedGame) &&
                                            !isScoringTransition;
                                        if (deferStrategicAiMoveForEffect) {
                                            // 보드·수순 정합(applyStrategicPlayingBoardAndMoveHistoryResolve) 후 스냅샷을 써야
                                            // 지연 적용·pendingDeferred 병합 시 돌이 사라지거나 AI 착점이 다른 좌표로 보이지 않는다.
                                            const gameToApply = JSON.parse(JSON.stringify(liveMerged)) as LiveGameSession;
                                            if (isNewPairAiMoveLive) {
                                                if (liveGameGnugoDelayTimeoutRef.current[gameId] != null) {
                                                    clearTimeout(liveGameGnugoDelayTimeoutRef.current[gameId]);
                                                    delete liveGameGnugoDelayTimeoutRef.current[gameId];
                                                }
                                                const pairRevealBaseline =
                                                    (pickRicherWsBoardSnapshot(existingGame, liveDeferredSnap) ??
                                                        existingGame ??
                                                        liveMerged) as LiveGameSession;
                                                updatedGames[gameId] =
                                                    applyStrategicPlayingBoardAndMoveHistoryResolve(
                                                        pairRevealBaseline,
                                                        liveRicherExisting,
                                                    );
                                                pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId] = gameToApply;
                                                const displayedMoves = existingGame?.moveHistory?.length ?? 0;
                                                enqueuePairAiMoveReveal(
                                                    gameId,
                                                    gameToApply,
                                                    PAIR_AI_MOVE_REVEAL_DELAY_MS,
                                                    displayedMoves,
                                                    pairAiMoveRevealQueueRef,
                                                    (gId, snapshot) => {
                                                        const shiftedGameToApply = shiftDelayedAiSnapshotTurnClock(
                                                            snapshot,
                                                            PAIR_AI_MOVE_REVEAL_DELAY_MS,
                                                        );
                                                        let appliedDelayedSnapshot = false;
                                                        setLiveGames(prev => {
                                                            if (shouldSkipDelayedAiSnapshotApply(prev[gId], shiftedGameToApply)) {
                                                                return prev;
                                                            }
                                                            appliedDelayedSnapshot = true;
                                                            return { ...prev, [gId]: shiftedGameToApply };
                                                        });
                                                        if (appliedDelayedSnapshot) {
                                                            lastGameUpdateMoveCountRef.current[gId] =
                                                                shiftedGameToApply.moveHistory?.length ?? 0;
                                                            liveGameSignaturesRef.current[gId] =
                                                                computeGameSessionFingerprint(shiftedGameToApply);
                                                            pendingDeferredAiBoardSnapshotByGameIdRef.current[gId] =
                                                                shiftedGameToApply;
                                                        }
                                                    },
                                                );
                                                return updatedGames;
                                            }
                                            if (liveGameGnugoDelayTimeoutRef.current[gameId] != null) {
                                                clearTimeout(liveGameGnugoDelayTimeoutRef.current[gameId]);
                                            }
                                            const aiRevealBaseline = applyStrategicPlayingBoardAndMoveHistoryResolve(
                                                (pickRicherWsBoardSnapshot(existingGame, liveDeferredSnap) ??
                                                    existingGame ??
                                                    liveMerged) as LiveGameSession,
                                                liveRicherExisting,
                                            );
                                            updatedGames[gameId] = aiRevealBaseline;
                                            pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId] = gameToApply;
                                            const scheduledAt = Date.now();
                                            liveGameGnugoDelayTimeoutRef.current[gameId] = setTimeout(() => {
                                                let appliedDelayedSnapshot = false;
                                                const delayedByMs = Math.max(0, Date.now() - scheduledAt);
                                                const shiftedGameToApply = shiftDelayedAiSnapshotTurnClock(gameToApply, delayedByMs);
                                                setLiveGames(prev => {
                                                    if (shouldSkipDelayedAiSnapshotApply(prev[gameId], shiftedGameToApply)) return prev;
                                                    appliedDelayedSnapshot = true;
                                                    return { ...prev, [gameId]: shiftedGameToApply };
                                                });
                                                if (appliedDelayedSnapshot) {
                                                    lastGameUpdateMoveCountRef.current[gameId] = shiftedGameToApply.moveHistory?.length ?? 0;
                                                    liveGameSignaturesRef.current[gameId] = computeGameSessionFingerprint(shiftedGameToApply);
                                                }
                                                delete liveGameGnugoDelayTimeoutRef.current[gameId];
                                                delete pendingDeferredAiBoardSnapshotByGameIdRef.current[gameId];
                                            }, STRATEGIC_AI_MOVE_DELAY_MS);
                                            return updatedGames;
                                        }

                                        if (currentUser && game.player1 && game.player2) {
                                            const isPlayer1 = game.player1.id === currentUser.id;
                                            const isPlayer2 = game.player2.id === currentUser.id;
                                            const currentStatus = currentUserStatusRef.current;
                                            const isActiveForGame = !!currentStatus &&
                                                (currentStatus.gameId === gameId || currentStatus.spectatingGameId === gameId) &&
                                                (currentStatus.status === 'in-game' || currentStatus.status === 'spectating');

                                            if ((isPlayer1 || isPlayer2) && isActiveForGame) {
                                                const targetHash = `#/game/${gameId}`;
                                                if (window.location.hash !== targetHash) {
                                                    // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
                                                    if (process.env.NODE_ENV === 'development') {
                                                        console.log('[WebSocket] Routing to game:', gameId);
                                                    }
                                                    setTimeout(() => {
                                                        if (window.location.hash !== targetHash) {
                                                            window.location.hash = targetHash;
                                                        }
                                                    }, 100);
                                                }
                                            }
                                        }
                                        return updatedGames;
                                    });
                                }
                            });
                            return;
                        }
                        case 'MUTUAL_DISCONNECT_ENDED': {
                            const msg = message.payload?.message ?? tx('game:messages.mutualDisconnectEnded');
                            setMutualDisconnectMessage(msg);
                            return;
                        }
                        case 'OTHER_DEVICE_LOGIN': {
                            // reason 없음: 동일 아이디 다른 세션(로그인 경로) → 모달. shared_pc: ipLoginPolicy 선점. maintenance: 점검 일괄 로그아웃.
                            if (message.payload?.reason === OTHER_DEVICE_LOGIN_SHARED_PC_REASON) {
                                try {
                                    sessionStorage.removeItem('currentUser');
                                } catch {
                                    // ignore
                                }
                                setCurrentUser(null);
                                setShowOtherDeviceLoginModal(false);
                                replaceAppHash('#/login');
                                return;
                            }
                            if (message.payload?.reason === OTHER_DEVICE_LOGIN_MAINTENANCE_REASON) {
                                try {
                                    sessionStorage.removeItem('currentUser');
                                } catch {
                                    // ignore
                                }
                                setCurrentUser(null);
                                setShowOtherDeviceLoginModal(false);
                                const maintenanceMsg =
                                    typeof message.payload?.message === 'string' && message.payload.message.trim()
                                        ? message.payload.message
                                        : tx('common:connection.maintenanceLogout');
                                setServerReconnectNotice(maintenanceMsg);
                                replaceAppHash('#/login');
                                return;
                            }
                            if (message.payload?.reason === OTHER_DEVICE_LOGIN_ADMIN_FORCE_REASON) {
                                try {
                                    sessionStorage.removeItem('currentUser');
                                } catch {
                                    // ignore
                                }
                                setCurrentUser(null);
                                setShowOtherDeviceLoginModal(false);
                                const adminMsg =
                                    typeof message.payload?.message === 'string' && message.payload.message.trim()
                                        ? message.payload.message.trim()
                                        : tx('common:connection.adminDisconnected');
                                setServerReconnectNotice(adminMsg);
                                replaceAppHash('#/login');
                                return;
                            }
                            setShowOtherDeviceLoginModal(true);
                            return;
                        }
                        case 'GAME_DELETED': {
                            const deletedGameId = message.payload?.gameId;
                            const serverGameCategory = message.payload?.gameCategory;
                            if (!deletedGameId) return;

                            try {
                                sessionStorage.removeItem(`gameState_${deletedGameId}`);
                            } catch {
                                // ignore
                            }
                            delete lastGameUpdateTimeRef.current[deletedGameId];
                            delete lastGameUpdateMoveCountRef.current[deletedGameId];
                            if (towerGnugoDelayTimeoutRef.current[deletedGameId] != null) {
                                clearTimeout(towerGnugoDelayTimeoutRef.current[deletedGameId]);
                                delete towerGnugoDelayTimeoutRef.current[deletedGameId];
                            }
                            if (towerScoringDelayTimeoutRef.current[deletedGameId] != null) {
                                clearTimeout(towerScoringDelayTimeoutRef.current[deletedGameId]);
                                delete towerScoringDelayTimeoutRef.current[deletedGameId];
                            }
                            if (liveGameGnugoDelayTimeoutRef.current[deletedGameId] != null) {
                                clearTimeout(liveGameGnugoDelayTimeoutRef.current[deletedGameId]);
                                delete liveGameGnugoDelayTimeoutRef.current[deletedGameId];
                            }
                            if (singlePlayerKataDelayTimeoutRef.current[deletedGameId] != null) {
                                clearTimeout(singlePlayerKataDelayTimeoutRef.current[deletedGameId]);
                                delete singlePlayerKataDelayTimeoutRef.current[deletedGameId];
                            }
                            delete pendingDeferredAiBoardSnapshotByGameIdRef.current[deletedGameId];
                            clearPairAiMoveRevealQueue(deletedGameId, pairAiMoveRevealQueueRef);

                            const removeFromGames = (setter: any, signaturesRef: Record<string, string>) => {
                                setter((currentGames: Record<string, any>) => {
                                    if (!currentGames[deletedGameId]) return currentGames;
                                    const updatedGames = { ...currentGames };
                                    delete updatedGames[deletedGameId];
                                    delete signaturesRef[deletedGameId];
                                    return updatedGames;
                                });
                            };

                            if (singlePlayerScoringDelayTimeoutRef.current[deletedGameId] != null) {
                                clearTimeout(singlePlayerScoringDelayTimeoutRef.current[deletedGameId]);
                                delete singlePlayerScoringDelayTimeoutRef.current[deletedGameId];
                            }
                            if (serverGameCategory === 'singleplayer') {
                                removeFromGames(setSinglePlayerGames, singlePlayerGameSignaturesRef.current);
                            } else if (serverGameCategory === 'tower') {
                                removeFromGames(setTowerGames, towerGameSignaturesRef.current);
                            } else if (serverGameCategory === 'normal') {
                                removeFromGames(setLiveGames, liveGameSignaturesRef.current);
                            } else {
                                removeFromGames(setLiveGames, liveGameSignaturesRef.current);
                                removeFromGames(setSinglePlayerGames, singlePlayerGameSignaturesRef.current);
                                removeFromGames(setTowerGames, towerGameSignaturesRef.current);
                            }

                            // 삭제된 대국실 페이지에 있으면 먼저 재입장 1회 시도 후 실패 시 리다이렉트
                            const currentHash = window.location.hash;
                            const isOnDeletedGamePage = currentHash.startsWith('#/game/') && currentHash.includes(deletedGameId);
                            if (isOnDeletedGamePage) {
                                const tryRejoinAfterDelete = async () => {
                                    try {
                                        if (!currentUser?.id) throw new Error('no_current_user');
                                        const res = await fetch(getApiUrl('/api/game/rejoin'), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ userId: currentUser.id, gameId: deletedGameId }),
                                            credentials: 'omit',
                                        });
                                        const data = await res.json().catch(() => ({}));
                                        if (res.ok && data?.game) {
                                            const g = data.game as LiveGameSession;
                                            const category = getSessionArenaKind(g);
                                            if (category === 'singleplayer') {
                                                setSinglePlayerGames(prev => ({ ...prev, [g.id]: g }));
                                            } else if (category === 'tower') {
                                                setTowerGames(prev => ({ ...prev, [g.id]: g }));
                                            } else {
                                                setLiveGames(prev => ({ ...prev, [g.id]: g }));
                                            }
                                            console.log('[WebSocket] GAME_DELETED received but rejoin succeeded, keeping game page:', deletedGameId);
                                            return;
                                        }
                                    } catch {
                                        // ignore and fallback redirect
                                    }

                                    let redirectHash = '#/';
                                    if (serverGameCategory === 'tower') redirectHash = '#/tower';
                                    else if (serverGameCategory === 'singleplayer') redirectHash = '#/singleplayer';
                                    console.log(`[WebSocket] Game deleted (category: ${serverGameCategory ?? 'unknown'}), rejoin failed, routing to ${redirectHash}`);
                                    setTimeout(() => {
                                        replaceAppHash(redirectHash);
                                    }, 100);
                                };
                                void tryRejoinAfterDelete();
                            }
                            return;
                        }
                        case 'CHALLENGE_DECLINED': {
                            if (message.payload?.challengerId === currentUser?.id && message.payload?.declinedMessage) {
                                showError(message.payload.declinedMessage.message);
                            }
                            return;
                        }
                        case 'NEGOTIATION_UPDATE': {
                            if (message.payload?.negotiations) {
                                const updatedNegotiations = JSON.parse(JSON.stringify(message.payload.negotiations));
                                setNegotiations(updatedNegotiations);
                            }
                            if (message.payload?.userStatuses) {
                                setOnlineUsers(prevOnlineUsers => {
                                    const updatedStatuses = message.payload.userStatuses;
                                    return prevOnlineUsers.map(user => {
                                        const statusInfo = updatedStatuses[user.id];
                                        if (statusInfo) {
                                            return { ...user, ...statusInfo };
                                        }
                                        return user;
                                    });
                                });
                            }
                            return;
                        }
                        case 'ANNOUNCEMENT_UPDATE': {
                            const { announcements: anns, globalOverrideAnnouncement: override, announcementInterval: interval } = message.payload || {};
                            if (Array.isArray(anns)) setAnnouncements(anns);
                            if (override !== undefined) setGlobalOverrideAnnouncement(override);
                            if (typeof interval === 'number') setAnnouncementInterval(interval);
                            return;
                        }
                        case 'GAME_MODE_AVAILABILITY_UPDATE': {
                            const { gameModeAvailability: availability } = message.payload || {};
                            if (availability) setGameModeAvailability(availability);
                            return;
                        }
                        case 'ARENA_ENTRANCE_AVAILABILITY_UPDATE': {
                            const { arenaEntranceAvailability: arenaAvail } = message.payload || {};
                            if (arenaAvail && typeof arenaAvail === 'object') {
                                setArenaEntranceAvailability(mergeArenaEntranceAvailability(arenaAvail));
                            }
                            return;
                        }
                        case 'HOME_BOARD_POSTS_UPDATE': {
                            const { homeBoardPosts: posts } = message.payload || {};
                            if (Array.isArray(posts)) setHomeBoardPosts(posts);
                            return;
                        }
                        case 'TOURNAMENT_STATE_UPDATE': {
                            const { tournamentState, tournamentType } = message.payload || {};
                            if (currentUserRef.current && tournamentState) {
                                setUsersMap(prev => ({
                                    ...prev,
                                    [currentUserRef.current!.id]: {
                                        ...prev[currentUserRef.current!.id],
                                        [`last${tournamentType.charAt(0).toUpperCase() + tournamentType.slice(1)}Tournament`]: tournamentState
                                    }
                                }));
                            }
                            return;
                        }
                        case 'GUILD_UPDATE': {
                            const { guilds: updatedGuilds } = message.payload || {};
                            if (updatedGuilds && typeof updatedGuilds === 'object') {
                                setGuilds(prev => ({ ...prev, ...updatedGuilds }));
                            }
                            return;
                        }
                        case 'GUILD_MESSAGE': {
                            // Guild message is sent to specific users via sendToUser
                            // Components should handle this in their own message handlers
                            return;
                        }
                        case 'GUILD_MISSION_UPDATE': {
                            // Guild mission update is sent to specific users via sendToUser
                            // Components should handle this in their own message handlers
                            return;
                        }
                        case 'GUILD_WAR_UPDATE': {
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('sudamr:guild-war-update'));
                            }
                            return;
                        }
                        case 'ERROR': {
                            console.error('[WebSocket] Error message:', message.payload?.message || 'Unknown error');
                            return;
                        }
                        default: {
                            // broadcast({ guilds }) 형태의 메시지도 처리 (타입이 없는 경우)
                            if ((message as any).guilds && typeof (message as any).guilds === 'object') {
                                setGuilds(prev => ({ ...prev, ...(message as any).guilds }));
                            }
                            // payload.guilds가 있는 경우 처리
                            if (message.payload?.guilds && typeof message.payload.guilds === 'object') {
                                setGuilds(prev => ({ ...prev, ...message.payload.guilds }));
                            }
                            // 기존 default 처리 (이미 다른 case에서 처리되지 않은 경우)
                            if (message.type && !['USER_UPDATE', 'USER_STATUS_UPDATE', 'GAME_UPDATE', 'NEGOTIATION_UPDATE', 'CHAT_MESSAGE', 'WAITING_ROOM_CHAT', 'GAME_CHAT', 'TOURNAMENT_UPDATE', 'RANKED_MATCHING_UPDATE', 'RANKED_MATCH_PROPOSAL', 'RANKED_MATCH_PROPOSAL_CANCELLED', 'RANKED_MATCH_FOUND', 'PAIR_ROOM_UPDATE', 'PAIR_ROOM_CHAT', 'PAIR_PARTNER_INVITE_UPDATE', 'PAIR_PARTNER_INVITE_DECLINED', 'GUILD_UPDATE', 'GUILD_MESSAGE', 'GUILD_MISSION_UPDATE', 'GUILD_WAR_UPDATE', 'ERROR', 'INITIAL_STATE', 'INITIAL_STATE_START', 'INITIAL_STATE_CHUNK', 'CONNECTION_ESTABLISHED', 'MUTUAL_DISCONNECT_ENDED', 'OTHER_DEVICE_LOGIN', 'SCHEDULER_MIDNIGHT_COMPLETE', 'ARENA_ENTRANCE_AVAILABILITY_UPDATE', 'KATA_SERVER_RUNTIME_CONFIG_UPDATE', 'CHAMPIONSHIP_ABILITY_KATA_LADDER_UPDATE'].includes(message.type)) {
                                console.warn('[WebSocket] Unhandled message type:', message.type);
                            }
                            return;
                        }
                    }
                }

                ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        handleMessage(message);
                    } catch (error) {
                        console.error('[WebSocket] Error parsing message:', error);
                    }
                };

                ws.onerror = (error: Event) => {
                    // WebSocket 에러는 일반적으로 연결 문제를 나타내지만,
                    // 자동 재연결 로직이 처리하므로 사용자에게 보여줄 필요는 없음
                    // 개발 환경에서만 디버그 로그 출력
                    const isDevelopment = window.location.hostname === 'localhost' || 
                                         window.location.hostname === '127.0.0.1' ||
                                         window.location.hostname.includes('192.168');
                    
                    // WebSocket 상태 확인
                    const wsState = ws ? ws.readyState : -1;
                    const isConnectingError = wsState === WebSocket.CONNECTING || wsState === WebSocket.CLOSING;
                    
                    // 연결 중이거나 종료 중인 경우의 에러는 정상적인 흐름일 수 있음
                    if (isConnectingError) {
                        // 개발 환경에서만 조용히 로그 (console.debug는 개발자 도구에서 필터링 가능)
                        if (isDevelopment) {
                            console.debug('[WebSocket] Connection error during state transition (will reconnect automatically)');
                        }
                    } else {
                        // 개발 환경에서만 경고 로그
                        if (isDevelopment) {
                            console.debug('[WebSocket] Connection error detected (will attempt to reconnect)');
                        }
                    }
                    
                    // 에러 발생 시 연결 종료 처리
                    isConnecting = false;
                    if (connectionTimeout) {
                        clearTimeout(connectionTimeout);
                        connectionTimeout = null;
                    }
                    
                    // 연결이 CONNECTING 상태에서 실패한 경우
                    if (ws && ws.readyState === WebSocket.CONNECTING) {
                        softCloseWebSocket(ws);
                    }
                    
                    // 에러 발생 시 재연결 시도 (의도적 종료가 아닌 경우)
                    if (!isIntentionalClose && shouldReconnect && currentUser) {
                        scheduleReconnect('error');
                    }
                };

                ws.onclose = (event) => {
                    isConnecting = false; // 연결 종료됨
                    clearWsPingInterval();
                    if (connectionTimeout) {
                        clearTimeout(connectionTimeout);
                        connectionTimeout = null;
                    }
                    if (initialStateTimeout) {
                        clearTimeout(initialStateTimeout);
                        initialStateTimeout = null;
                    }
                    pendingMessages = [];
                    isInitialStateReady = true;
                    console.log('[WebSocket] Disconnected', {
                        code: event.code,
                        reason: event.reason,
                        wasClean: event.wasClean,
                        codeMeaning: getCloseCodeMeaning(event.code),
                        wasIntentional: isIntentionalClose
                    });

                    // 서버 관리자 강제 로그아웃: 메시지가 늦게 오거나 렌더 루프로 처리 못 해도 재연결하지 않음
                    if (event.code === WEBSOCKET_ADMIN_FORCE_LOGOUT_CLOSE_CODE) {
                        shouldReconnect = false;
                        try {
                            sessionStorage.removeItem('currentUser');
                        } catch {
                            // ignore
                        }
                        if (currentUserRef.current) {
                            setCurrentUser(null);
                            setShowOtherDeviceLoginModal(false);
                            setServerReconnectNotice(tx('common:connection.adminDisconnected'));
                            replaceAppHash('#/login');
                        }
                        return;
                    }
                    
                    // 1001 (Going Away)는 브라우저가 페이지를 떠날 때 발생할 수 있으므로
                    // 의도적인 종료가 아닌 경우에만 재연결
                    if (!isIntentionalClose && shouldReconnect && currentUser) {
                        const reason =
                            event.code === 1012 || event.code === 1013
                                ? 'server restart (service unavailable)'
                                : 'disconnected';
                        scheduleReconnect(reason);
                    } else {
                        console.log('[WebSocket] Not reconnecting:', {
                            isIntentionalClose,
                            shouldReconnect,
                            hasCurrentUser: !!currentUser,
                            isConnecting
                        });
                    }
                };
            } catch (error) {
                isConnecting = false; // 연결 실패
                console.error('[WebSocket] Failed to create connection:', error);
                if (shouldReconnect && currentUser) {
                    scheduleReconnect('connection failed');
                }
            }
        }

        connectWebSocket();

        return () => {
            shouldReconnect = false;
            isIntentionalClose = true;
            clearWsPingInterval();
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
            if (initialStateTimeout) {
                clearTimeout(initialStateTimeout);
                initialStateTimeout = null;
            }
            if (serverReconnectTimerRef.current !== null) {
                window.clearTimeout(serverReconnectTimerRef.current);
                serverReconnectTimerRef.current = null;
            }
            setServerReconnectNotice(null);
            pendingMessages = [];
            isInitialStateReady = true;
            if (ws) {
                const s = ws;
                ws = null;
                softCloseWebSocket(s);
            }
        };
    }, [currentUser?.id, markConnectionRestored, setConnectionNotice]); // Only user changes or stable connection helpers reconnect

    // --- Navigation Logic ---
    const initialRedirectHandled = useRef(false);
    useEffect(() => { currentRouteRef.current = currentRoute; }, [currentRoute]);
    
    useEffect(() => {
        const handleHashChange = () => {
            const rawHash = window.location.hash;
            const canonicalHash = normalizeLegacyAppHash(rawHash);
            if (canonicalHash !== rawHash) {
                replaceAppHash(canonicalHash);
                return;
            }
            const prevRoute = currentRouteRef.current;
            const newRoute = parseHash(window.location.hash);
            const isExiting = (prevRoute.view === 'profile' && newRoute.view === 'login' && window.location.hash === '');
            
            if (isExiting && currentUser) {
                if (showExitToast) { handleLogout(); } 
                else {
                    setShowExitToast(true);
                    exitToastTimer.current = window.setTimeout(() => setShowExitToast(false), 2000);
                    window.history.pushState(null, '', APP_HOME_HASH);
                    return;
                }
            } else {
                if (exitToastTimer.current) clearTimeout(exitToastTimer.current);
                if (showExitToast) setShowExitToast(false);
            }
            setCurrentRoute(newRoute);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [currentUser, handleLogout, showExitToast]);

    useEffect(() => {
        if (!currentUser) {
            initialRedirectHandled.current = false;
            if (window.location.hash && window.location.hash !== '#/register') window.location.hash = '';
            return;
        }
        const currentHash = window.location.hash;
        
        if (!initialRedirectHandled.current) {
            initialRedirectHandled.current = true;
    
            if (currentHash === '' || currentHash === '#/') {
                if (activeGame) {
                    window.location.hash = `#/game/${activeGame.id}`;
                    return;
                }
                window.location.hash = APP_HOME_HASH;
                return;
            }
            const canonicalInitialHash = normalizeLegacyAppHash(currentHash);
            if (canonicalInitialHash !== currentHash) {
                replaceAppHash(canonicalInitialHash);
                return;
            }
            // 길드 관련 페이지(#/guild, #/guildboss, #/guildwar)에서는 새로고침 시 해당 화면 유지
            // (리다이렉트하지 않음 - GuildHome/GuildBoss/GuildWar에서 로딩 처리)
        }
        
        const isGamePage = currentHash.startsWith('#/game/');
        const isAdventurePage = currentHash.startsWith('#/adventure');
        const hashNoQuery = currentHash.split('?')[0];
        const isGuildShellPage =
            hashNoQuery === '#/guild' || hashNoQuery === '#/guildboss' || hashNoQuery === '#/guildwar';

        if (activeGame && !isGamePage) {
            // 관리자 모험 테스트: 진행 중 대국이 있어도 #/adventure 유지 (강제 복귀 방지)
            if (isAdventurePage) {
                return;
            }
            // 길드 화면: 길드전 한 판(#/game/...)과 별도 — 대기실·보스·홈은 경기 중에도 유지
            if (isGuildShellPage) {
                return;
            }
            // 종료·무효·재대결 대기 대국은 "대국으로 복귀"시키지 않음(나가기 직후 라우팅 레이스·전면 광고 이후 유령 복귀 방지)
            const gs = activeGame.gameStatus;
            if (gs === 'ended' || gs === 'no_contest' || gs === 'rematch_pending') {
                return;
            }
            // 나가기 클릭 직후: postGameRedirect가 현재 해시와 같으면 경기장으로 다시 보내지 않음 (상태 갱신 전 리다이렉트 방지)
            const postRedirect = sessionStorage.getItem('postGameRedirect');
            if (postRedirect && currentHash === postRedirect) {
                sessionStorage.removeItem('postGameRedirect');
                return;
            }
            console.log('[useApp] Routing to game:', activeGame.id);
            window.location.hash = `#/game/${activeGame.id}`;
        } else if (!activeGame && isGamePage) {
            const urlGameId = currentHash.replace('#/game/', '').split('/')[0];
            const gameInStore = liveGames[urlGameId] || singlePlayerGames[urlGameId] || towerGames[urlGameId];
            // 경기 종료(ended/no_contest/scoring) 후 새로고침 시 경기장 화면 유지: 해당 게임이 스토어에 있으면 리다이렉트하지 않음
            if (gameInStore && ['ended', 'no_contest', 'scoring'].includes(gameInStore.gameStatus || '')) {
                return;
            }
            // 나가기 버튼으로 설정된 대기실/탑/싱글 이동 경로가 있으면 우선 사용 (나가기 클릭 시 대기실로 이동)
            const postRedirect = sessionStorage.getItem('postGameRedirect');
            if (postRedirect) {
                sessionStorage.removeItem('postGameRedirect');
                if (currentHash !== postRedirect) {
                    replaceAppHash(postRedirect);
                }
                return;
            }
            // 새로고침(F5) 후 서버가 게임 없음/권한 없음으로 확정한 경우에만 리다이렉트한다.
            if (gameRejoinFailure?.gameId === urlGameId && gameRejoinFailure.reason === 'notFound') {
                if (recoverPveGameFromSessionStorage(urlGameId)) {
                    return;
                }
                const pairArenaRestore = readPairArenaRestoreFromGameStateStorage(urlGameId);
                if (pairArenaRestore) {
                    stashPairArenaRoomRestoreForLobbyNavigation(
                        pairArenaRestore.roomId,
                        pairArenaRestore.lobbyChannel,
                    );
                    setGameRejoinFailure((prev) => (prev?.gameId === urlGameId ? null : prev));
                    const h = pairArenaLobbyHash(
                        pairArenaRestore.lobbyChannel,
                        pairArenaRestore.lobbyIntent ?? 'pvp',
                    );
                    if (currentHash !== h) replaceAppHash(h);
                    return;
                }
                let targetHash = APP_HOME_HASH;
                if (currentUserWithStatus?.status === 'waiting') {
                    const intent = currentUserWithStatus.lobbyIntent === 'ai' ? 'ai' : 'pvp';
                    if (currentUserWithStatus.arenaChannel === 'pair') {
                        targetHash = arenaLobbyHash({ intent, channel: 'pair' });
                    } else if (
                        currentUserWithStatus.waitingLobby === 'strategic' ||
                        currentUserWithStatus.arenaChannel === 'strategic'
                    ) {
                        targetHash = arenaLobbyHash({ intent, channel: 'strategic' });
                    } else if (
                        currentUserWithStatus.waitingLobby === 'playful' ||
                        currentUserWithStatus.arenaChannel === 'playful'
                    ) {
                        targetHash = arenaLobbyHash({ intent, channel: 'playful' });
                    } else if (currentUserWithStatus.mode) {
                        const waitingRoomMode = SPECIAL_GAME_MODES.some((m) => m.mode === currentUserWithStatus.mode)
                            ? 'strategic'
                            : PLAYFUL_GAME_MODES.some((m) => m.mode === currentUserWithStatus.mode)
                              ? 'playful'
                              : null;
                        if (waitingRoomMode) {
                            targetHash = arenaLobbyHash({ intent, channel: waitingRoomMode });
                        }
                    }
                }
                if (currentHash !== targetHash) {
                    replaceAppHash(targetHash);
                }
                return;
            }
            // AI 게임 진입 직후: state 반영 전 레이스 컨디션으로 리다이렉트하지 않음 (3초 유예)
            const pending = pendingAiGameEntryRef.current;
            const isPendingAiEntry = pending?.gameId === urlGameId && Date.now() < pending.until;
            const strategicAiLike = isSessionStrategicAiLike(liveGames[urlGameId]);
            // gameInStore는 위에서 이미 선언됨
            // 게임이 이미 스토어에 있으면 activeGame 폴백이 처리하므로 리다이렉트 불필요
            // 스토어에 없으면 재입장 effect가 시도할 때까지 리다이렉트하지 않음
            if (!gameInStore && !strategicAiLike && !isPendingAiEntry) {
                // 재입장 대기 중: 리다이렉트하지 않음
                return;
            }
            if (!strategicAiLike && !isPendingAiEntry && gameInStore) {
                // 게임이 스토어에 있으면 URL 기반 activeGame 폴백으로 표시됨
                return;
            }
            // 기존: AI 게임이거나 pending entry면 리다이렉트하지 않음 (게임 페이지 유지)
        }
    }, [currentUser, activeGame, currentUserWithStatus, liveGames, singlePlayerGames, towerGames, gameRejoinFailure, recoverPveGameFromSessionStorage]);

    /** F5 직후 rejoin 전에 sessionStorage로 PVE 판·수순을 스토어에 올려 홈으로 튕기는 것을 방지 */
    useEffect(() => {
        const gameId = currentRoute?.view === 'game' ? (currentRoute.params?.id ?? '') : '';
        if (!currentUser?.id || !gameId) return;
        const shell = liveGames[gameId] || singlePlayerGames[gameId] || towerGames[gameId];
        const chessGoOpeningReady =
            shell?.mode === GameMode.Chess &&
            ((shell.chessPieces?.length ?? 0) > 0 || boardGridHasAnyStones(shell.boardState));
        const needsRecovery =
            !shell ||
            (!boardGridHasAnyStones(shell.boardState) && !chessGoOpeningReady) ||
            (shell.gameStatus === 'pending' &&
                (shell.moveHistory?.length ?? 0) === 0 &&
                shell.mode !== GameMode.Chess);
        if (!needsRecovery) return;
        recoverPveGameFromSessionStorage(gameId);
    }, [
        currentRoute?.view,
        currentRoute?.params?.id,
        currentUser?.id,
        liveGames,
        singlePlayerGames,
        towerGames,
        recoverPveGameFromSessionStorage,
    ]);

    /**
     * 서버 userStatuses는 in-game인데 INITIAL_STATE의 liveGames 등에 해당 방이 없을 때(목록 상한·타이밍 등).
     * 대기실(#/waiting/...)에 머물러 있어도 rejoin으로 스토어를 채우면 activeGame·라우팅 이펙트가 경기장으로 보냄.
     * (관전은 rejoin이 참가자만 허용하므로 제외)
     *
     * 의존성은 userId·gameId만 둠: onlineUsers·타 유저 게임 갱신으로 타이머가 계속 리셋되는 것을 막기 위함.
     * 스토어에 이미 들어왔는지는 타이머 시점에 ref로 확인.
     */
    const inGameRecoveryGameId = useMemo(() => {
        if (!currentUser?.id) return '';
        if (currentUserWithStatus?.status === 'in-game' && currentUserWithStatus.gameId) {
            return currentUserWithStatus.gameId;
        }
        if (currentRoute?.view === 'game') return '';
        const uid = currentUser.id;
        for (const g of Object.values(liveGames)) {
            if (!g || isSessionPveArena(g)) continue;
            const st = g.gameStatus || '';
            if (['ended', 'no_contest', 'scoring', 'rematch_pending'].includes(st)) continue;
            if (g.player1?.id === uid || g.player2?.id === uid) return g.id;
        }
        return '';
    }, [
        currentUser?.id,
        currentUserWithStatus?.status,
        currentUserWithStatus?.gameId,
        currentRoute?.view,
        liveGames,
    ]);

    useEffect(() => {
        if (!inGameRecoveryGameId) return;
        // 인게임 화면에 이미 들어와 진행 중이면 불필요한 rejoin 자동갱신을 막아 경기 집중을 우선한다.
        const routeGameId = currentRoute?.view === 'game' ? (currentRoute.params?.id ?? '') : '';
        const isCurrentlyViewingSameGame = routeGameId === inGameRecoveryGameId;
        const currentGame =
            liveGames[routeGameId] ||
            singlePlayerGames[routeGameId] ||
            towerGames[routeGameId];
        // 싱글/타워 종료 후: recovery rejoin이 캐시·DB의 슬림 스냅샷으로 덮어 «초기화·턴 알림»이 나는 회귀 방지 (F5용 effect와 동일한 취지)
        const isPveEndedNoRecoveryRejoin =
            !!currentGame &&
            isSessionSingleOrTower(currentGame) &&
            (currentGame.gameStatus === 'ended' || currentGame.gameStatus === 'no_contest');
        if (isCurrentlyViewingSameGame && isPveEndedNoRecoveryRejoin) {
            return;
        }
        const isLiveMatchNow =
            !!currentGame &&
            !['ended', 'no_contest', 'scoring', 'hidden_final_reveal', 'rematch_pending'].includes(
                currentGame.gameStatus || '',
            );
        // INITIAL_STATE는 boardState를 보내지 않으므로, 스토어에만 있고 판이 비면 rejoin이 필요하다.
        if (isCurrentlyViewingSameGame && isLiveMatchNow && hasHydratedBoardGridForRejoin(currentGame)) return;

        const gid = inGameRecoveryGameId;
        if (rejoinRequestedRef.current.has(gid)) return;
        rejoinRequestedRef.current.add(gid);

        const t = setTimeout(async () => {
            try {
                const uid = currentUserRef.current?.id;
                if (!uid) return;

                const inStore =
                    liveGamesRef.current[gid] ||
                    singlePlayerGamesRef.current[gid] ||
                    towerGamesRef.current[gid];
                if (inStore && isSessionSingleOrTower(inStore) && (inStore.gameStatus === 'ended' || inStore.gameStatus === 'no_contest')) {
                    return;
                }
                if (inStore && hasHydratedBoardGridForRejoin(inStore)) return;

                const res = await fetch(getApiUrl('/api/game/rejoin'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: uid, gameId: gid }),
                    credentials: 'omit',
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.game) {
                    const g = data.game as LiveGameSession;
                    const category = getSessionArenaKind(g);
                    if (category === 'singleplayer') {
                        setSinglePlayerGames(prev => ({
                            ...prev,
                            [g.id]: mergePveRejoinResponseWithExistingBoard(prev[g.id], g),
                        }));
                    } else if (category === 'tower') {
                        setTowerGames(prev => ({
                            ...prev,
                            [g.id]: mergePveRejoinResponseWithExistingBoard(prev[g.id], g),
                        }));
                    } else {
                        setLiveGames(prev => ({
                            ...prev,
                            [g.id]: mergeLiveRejoinResponseWithExistingBoard(prev[g.id], g),
                        }));
                    }
                    setGameRejoinFailure(prev => (prev?.gameId === gid ? null : prev));
                }
            } catch {
                /* 게임 URL 재입장 effect가 이어서 시도 */
            } finally {
                rejoinRequestedRef.current.delete(gid);
            }
        }, 400);

        return () => {
            clearTimeout(t);
            rejoinRequestedRef.current.delete(gid);
        };
    }, [inGameRecoveryGameId, currentRoute?.view, currentRoute?.params?.id, liveGames, singlePlayerGames, towerGames]);

    // 새로고침(F5) 후 게임 페이지에서 재입장 API 호출 - AI/PVP 공통 (INITIAL_STATE 대기 후)
    useEffect(() => {
        const view = currentRoute?.view;
        const gameId = currentRoute?.view === 'game' ? (currentRoute.params?.id ?? '') : '';
        if (!currentUser || view !== 'game' || !gameId) {
            if (gameId) setGameRejoinFailure(prev => (prev?.gameId === gameId ? null : prev));
            return;
        }
        let gameInStore = liveGames[gameId] || singlePlayerGames[gameId] || towerGames[gameId];
        if (!gameInStore) {
            const storedEndedPvp = loadEndedPvpGameFromSessionStorage(gameId);
            if (storedEndedPvp) {
                setLiveGames((prev) => ({ ...prev, [gameId]: storedEndedPvp }));
                gameInStore = storedEndedPvp;
                setGameRejoinFailure((prev) => (prev?.gameId === gameId ? null : prev));
            }
        }
        const isPveGameInStore = !!gameInStore && isSessionPveArena(gameInStore);
        const gameCategoryInStore =
            gameInStore?.gameCategory ?? (gameInStore?.isSinglePlayer ? 'singleplayer' : 'normal');
        const isEndedPvpInStore =
            !!gameInStore &&
            gameCategoryInStore === 'normal' &&
            !isSessionStrategicAiLike(gameInStore) &&
            ['ended', 'no_contest', 'scoring', 'rematch_pending'].includes(gameInStore.gameStatus || '');
        const isLiveMatchNow =
            !!gameInStore &&
            !['ended', 'no_contest', 'scoring', 'hidden_final_reveal', 'rematch_pending'].includes(
                gameInStore.gameStatus || '',
            );
        // 싱글/타워·종료 PVP: 서버 DB/GC 이후 rejoin이 404면 홈으로 튕기므로 로컬·sessionStorage 유지
        if (
            (isPveGameInStore || isEndedPvpInStore) &&
            !!gameInStore &&
            ['ended', 'no_contest', 'scoring', 'hidden_final_reveal', 'rematch_pending'].includes(
                gameInStore.gameStatus || '',
            )
        ) {
            setGameRejoinFailure(prev => (prev?.gameId === gameId ? null : prev));
            return;
        }
        // 경기 중이어도 INITIAL_STATE는 boardState가 없을 수 있어, 격자가 채워진 뒤에만 rejoin 스킵한다.
        if (isLiveMatchNow && hasHydratedBoardGridForRejoin(gameInStore)) {
            setGameRejoinFailure(prev => (prev?.gameId === gameId ? null : prev));
            return;
        }
        if (gameInStore && hasHydratedBoardGridForRejoin(gameInStore)) {
            setGameRejoinFailure(prev => (prev?.gameId === gameId ? null : prev));
            return;
        }
        if (rejoinRequestedRef.current.has(gameId)) return;
        rejoinRequestedRef.current.add(gameId);
        const rejoinDelayMs =
            gameInStore && resolveArenaSessionPolicy(gameInStore as any).matchAxis === 'pvp' ? 500 : 2500;
        const t = setTimeout(async () => {
            try {
                const res = await fetch(getApiUrl('/api/game/rejoin'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id, gameId }),
                    credentials: 'omit',
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.game) {
                    const g = data.game as LiveGameSession;
                    const category = getSessionArenaKind(g);
                    if (category === 'singleplayer') {
                        setSinglePlayerGames(prev => ({
                            ...prev,
                            [g.id]: augmentPveRejoinWithSessionStorage(
                                mergePveRejoinResponseWithExistingBoard(prev[g.id], g),
                            ),
                        }));
                    } else if (category === 'tower') {
                        setTowerGames(prev => ({
                            ...prev,
                            [g.id]: augmentPveRejoinWithSessionStorage(
                                mergePveRejoinResponseWithExistingBoard(prev[g.id], g),
                            ),
                        }));
                    } else if (isSessionPveArena(g)) {
                        setLiveGames(prev => ({
                            ...prev,
                            [g.id]: augmentPveRejoinWithSessionStorage(
                                mergePveRejoinResponseWithExistingBoard(prev[g.id], g),
                            ),
                        }));
                    } else {
                        setLiveGames(prev => ({
                            ...prev,
                            [g.id]: mergeLiveRejoinResponseWithExistingBoard(prev[g.id], g),
                        }));
                    }
                    setGameRejoinFailure(prev => (prev?.gameId === gameId ? null : prev));
                    markConnectionRestored();
                    return;
                }
                const storedEndedPvp = loadEndedPvpGameFromSessionStorage(gameId);
                if (storedEndedPvp) {
                    setLiveGames((prev) => ({
                        ...prev,
                        [gameId]: mergeLiveRejoinResponseWithExistingBoard(prev[gameId], storedEndedPvp),
                    }));
                    setGameRejoinFailure((prev) => (prev?.gameId === gameId ? null : prev));
                    markConnectionRestored();
                    return;
                }
                if (recoverPveGameFromSessionStorage(gameId)) {
                    markConnectionRestored();
                    return;
                }
                const reason: GameRejoinFailureReason = isTransientServerStatus(res.status) ? 'network' : 'notFound';
                setGameRejoinFailure({
                    gameId,
                    reason,
                    message:
                        reason === 'network'
                            ? tx('common:connection.gameLoadFailed')
                            : tx('nav:router.gameNotFoundRedirect'),
                });
                if (reason === 'network') {
                    setConnectionNotice({
                        kind: 'requestFailed',
                        message: tx('common:connection.gameLoadFailed'),
                        severity: 'error',
                    });
                }
            } catch {
                setGameRejoinFailure({
                    gameId,
                    reason: 'network',
                    message: tx('common:connection.gameLoadFailed'),
                });
                setConnectionNotice({
                    kind: 'requestFailed',
                    message: tx('common:connection.gameLoadFailed'),
                    severity: 'error',
                });
            } finally {
                rejoinRequestedRef.current.delete(gameId);
            }
        }, rejoinDelayMs);
        return () => clearTimeout(t);
    }, [currentUser, currentRoute?.view, currentRoute?.params?.id, liveGames, singlePlayerGames, towerGames, gameRejoinRetryNonce, markConnectionRestored, setConnectionNotice, recoverPveGameFromSessionStorage]);

    // 계가 중(scoring) 새로고침 시 KataGo 결과 수신: scoring 상태인 활성 게임이 있으면 rejoin 폴링하여 결과 반영
    useEffect(() => {
        const gameId = currentRoute?.view === 'game' ? (currentRoute.params?.id ?? '') : '';
        if (!currentUser || !gameId) return;
        const game = liveGames[gameId] || singlePlayerGames[gameId] || towerGames[gameId];
        if (!game || game.gameStatus !== 'scoring') return;

        const SCORING_POLL_MS = 3000;
        const id = setInterval(async () => {
            try {
                const res = await fetch(getApiUrl('/api/game/rejoin'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id, gameId }),
                    credentials: 'omit',
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.game) return;
                const g = data.game as LiveGameSession;
                const category = getSessionArenaKind(g);
                const applyRejoinGame = (
                    setter: React.Dispatch<React.SetStateAction<Record<string, LiveGameSession>>>,
                    merge: (prev: LiveGameSession | undefined, next: LiveGameSession) => LiveGameSession,
                ) => {
                    setter(prev => ({ ...prev, [g.id]: merge(prev[g.id], g) }));
                };
                if (category === 'singleplayer') {
                    applyRejoinGame(setSinglePlayerGames, mergePveRejoinResponseWithExistingBoard);
                } else if (category === 'tower') {
                    applyRejoinGame(setTowerGames, mergePveRejoinResponseWithExistingBoard);
                } else {
                    applyRejoinGame(setLiveGames, mergeLiveRejoinResponseWithExistingBoard);
                }
            } catch {
                // ignore
            }
        }, SCORING_POLL_MS);
        return () => clearInterval(id);
    }, [currentUser, currentRoute?.view, currentRoute?.params?.id, liveGames, singlePlayerGames, towerGames]);

    // --- Misc UseEffects ---
    useEffect(() => {
        const updateViewportVars = () => {
            syncDocumentViewportHeightVar();
        };

        updateViewportVars();
        window.addEventListener('resize', updateViewportVars);
        window.addEventListener('orientationchange', updateViewportVars);
        window.addEventListener('sudamr-portrait-lock-change', updateViewportVars);
        return () => {
            window.removeEventListener('resize', updateViewportVars);
            window.removeEventListener('orientationchange', updateViewportVars);
            window.removeEventListener('sudamr-portrait-lock-change', updateViewportVars);
        };
    }, []);

    useEffect(() => {
        if (enhancementResult) {
            const timer = setTimeout(() => {
                setEnhancementResult(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [enhancementResult]);

    const handleEnterWaitingRoom = (mode: GameMode) => {
        const waitingRoomMode = SPECIAL_GAME_MODES.some((x) => x.mode === mode)
            ? 'strategic'
            : PLAYFUL_GAME_MODES.some((x) => x.mode === mode)
              ? 'playful'
              : null;
        if (!isClientAdmin(currentUser)) {
            const m = arenaEntranceAvailabilityResolved;
            const lobbyKey: ArenaEntranceKey | null = waitingRoomMode === 'strategic'
                ? 'strategicLobby'
                : waitingRoomMode === 'playful'
                  ? 'playfulLobby'
                  : null;
            if (lobbyKey && !m[lobbyKey]) {
                window.alert(translateArenaEntranceClosed(lobbyKey));
                return;
            }
        }
        if (!waitingRoomMode) {
            window.location.hash = APP_HOME_HASH;
            return;
        }
        handleAction({ type: 'ENTER_WAITING_ROOM', payload: { mode: waitingRoomMode, lobbyIntent: 'pvp' } });
        window.location.hash = arenaLobbyHash({ intent: 'pvp', channel: waitingRoomMode });
    };
    
    const handleViewUser = useCallback(async (userId: string) => {
        const statusInfo = Array.isArray(onlineUsers) ? onlineUsers.find((u) => u && u.id === userId) : null;
        const withOnlineStatus = (u: UserWithStatus): UserWithStatus => ({
            ...u,
            ...(statusInfo || { status: UserStatus.Online }),
        });
        const showUserInViewport = (user: UserWithStatus, pushStack = true) => {
            setViewingUser(user);
            if (usePortraitFirstShell && pushStack) {
                const top = mobileViewportStackRef.current[mobileViewportStackRef.current.length - 1];
                if (top?.type === 'userProfile' && top.user.id === user.id) {
                    return;
                }
                pushMobileViewport({ type: 'userProfile', user });
            }
        };

        if (currentUserWithStatus?.id === userId) {
            showUserInViewport(withOnlineStatus(currentUserWithStatus));
            return;
        }

        const cached = usersMap[userId];
        if (cached) {
            showUserInViewport(withOnlineStatus(cached as UserWithStatus));
        }

        try {
            const response = await fetch(getApiUrl(`/api/user/${userId}`));
            if (!response.ok) {
                if (!cached) {
                    console.error(`[handleViewUser] Failed to fetch user ${userId}: ${response.statusText}`);
                }
                return;
            }
            const userData = await response.json();
            const merged = withOnlineStatus({
                ...userData,
                equipment: userData.equipment || {},
                inventory: userData.inventory || [],
            } as UserWithStatus);
            showUserInViewport(merged, !cached);
            setUsersMap((prev) => ({ ...prev, [userId]: userData }));
            setUserBriefCache((prev) => ({
                ...prev,
                [userId]: {
                    nickname: userData.nickname || userData.username || userId,
                    avatarId: userData.avatarId,
                    borderId: userData.borderId,
                },
            }));
        } catch (error) {
            if (!cached) {
                console.error(`[handleViewUser] Error fetching user ${userId}:`, error);
            }
        }
    }, [currentUserWithStatus, onlineUsers, pushMobileViewport, usePortraitFirstShell, usersMap]);

    const openModerationModal = useCallback((userId: string) => {
        if (!Array.isArray(onlineUsers) || !Array.isArray(allUsers)) return;
        const userToView = onlineUsers.find(u => u && u.id === userId) || allUsers.find(u => u && u.id === userId);
        if (userToView) {
            const statusInfo = onlineUsers.find(u => u && u.id === userId);
            setModeratingUser({ ...userToView, ...(statusInfo || { status: UserStatus.Online }) });
        }
    }, [onlineUsers, allUsers]);

    const closeModerationModal = useCallback(() => setModeratingUser(null), []);

    const setCurrentUserAndRoute = useCallback((user: User, options?: { activeGame?: LiveGameSession }) => {
        const mergedUser = applyUserUpdate(user, 'setCurrentUserAndRoute');
        console.log('[setCurrentUserAndRoute] User set:', {
            id: mergedUser.id,
            inventoryLength: mergedUser.inventory?.length,
            equipmentSlots: Object.keys(mergedUser.equipment || {}).length,
            hasInventory: !!mergedUser.inventory,
            hasEquipment: !!mergedUser.equipment
        });
        if (options?.activeGame) {
            const g = options.activeGame;
            setActiveGameFromLogin(g);
            const category = getSessionArenaKind(g);
            if (category === 'singleplayer') {
                setSinglePlayerGames(prev => ({ ...prev, [g.id]: g }));
            } else if (category === 'tower') {
                setTowerGames(prev => ({ ...prev, [g.id]: g }));
            } else {
                setLiveGames(prev => ({ ...prev, [g.id]: g }));
            }
            replaceAppHash(`#/game/${g.id}`);
            flushSync(() => {
                setCurrentRoute(parseHash(window.location.hash));
            });
        } else {
            replaceAppHash(APP_HOME_HASH);
            // hashchange의 setCurrentRoute는 다음 틱에 반영되어, 닉네임 확정 직후에도 잠시 set-nickname 뷰가 남는다
            flushSync(() => {
                setCurrentRoute(parseHash(window.location.hash));
            });
        }
    }, [applyUserUpdate, setActiveGameFromLogin, setCurrentRoute, setLiveGames, setSinglePlayerGames, setTowerGames]);
    
    const openEnhancingItem = useCallback((item: InventoryItem) => {
        setBlacksmithSelectedItemForEnhancement(item);
        setBlacksmithActiveTab('enhance');
        openBlacksmithUi();
    }, [openBlacksmithUi]);

    const openEnhancementFromDetail = useCallback((item: InventoryItem) => {
        setViewingItem(null);
        setBlacksmithSelectedItemForEnhancement(item);
        setBlacksmithActiveTab('enhance');
        openBlacksmithUi();
    }, [openBlacksmithUi]);

    const openRefinementFromDetail = useCallback((item: InventoryItem) => {
        setViewingItem(null);
        setBlacksmithSelectedItemForEnhancement(item);
        setBlacksmithActiveTab('refine');
        openBlacksmithUi();
    }, [openBlacksmithUi]);

    const openBlacksmithTabFromInventory = useCallback(
        (tab: 'convert' | 'refine') => {
            setBlacksmithSelectedItemForEnhancement(null);
            setBlacksmithActiveTab(tab);
            openBlacksmithUi();
        },
        [openBlacksmithUi],
    );

    const openViewingItem = useCallback(
        (item: InventoryItem, isOwnedByCurrentUser: boolean, opts?: { hideEnhanceActions?: boolean }) => {
            setViewingItem({
                item,
                isOwnedByCurrentUser,
                ...(opts?.hideEnhanceActions ? { hideEnhanceActions: true as const } : {}),
            });
        },
        [],
    );

    const closeViewingItem = useCallback(() => {
        setViewingItem(null);
    }, []);

    const openGameRecordViewer = useCallback(
        (record: GameRecord) => {
            setViewingGameRecord(record);
            if (usePortraitFirstShell) {
                pushMobileViewport({ type: 'gameRecordViewer', record });
            }
        },
        [pushMobileViewport, usePortraitFirstShell],
    );

    const closeGameRecordViewer = useCallback(() => {
        setViewingGameRecord(null);
        if (
            usePortraitFirstShell &&
            mobileViewportStackRef.current[mobileViewportStackRef.current.length - 1]?.type === 'gameRecordViewer'
        ) {
            popMobileViewport();
        }
    }, [popMobileViewport, usePortraitFirstShell]);

    const openPairPetDetailModal = useCallback((item: InventoryItem, mode: 'obtain' | 'view') => {
        setPairPetDetailModal({ item: JSON.parse(JSON.stringify(item)) as InventoryItem, mode });
    }, []);

    const closePairPetDetailModal = useCallback(() => {
        setPairPetDetailModal(null);
    }, []);

    const clearRefinementResult = useCallback(() => {
        setRefinementResult(null);
    }, []);

    const clearEnhancementOutcome = useCallback(() => {
        if (enhancementOutcome?.success) {
            const enhancedItem = enhancementOutcome.itemAfter;
            setViewingItem(currentItem => {
                if (currentItem && enhancedItem && currentItem.item.id === enhancedItem.id) {
                    return { ...currentItem, item: enhancedItem };
                }
                return currentItem;
            });
            const snapshot = currentUserRef.current;
            if (snapshot && Array.isArray(snapshot.inventory)) {
                const nextInventory = snapshot.inventory.map(invItem =>
                        invItem.id === enhancedItem.id ? enhancedItem : invItem
                );
                flushSync(() => {
                    applyUserUpdate({ inventory: nextInventory }, 'clearEnhancementOutcome');
                });
            }
        }
        setEnhancementOutcome(null);
    }, [enhancementOutcome, applyUserUpdate]);
    
    const closeEnhancementModal = useCallback(() => {
        setIsEnhancementResultModalOpen(false);
        setEnhancementOutcome(null);
    }, []);

    const startEnhancement = useCallback((_item: InventoryItem) => {
        // 제련 진행 중 모달 제거: 강화 결과(성공/실패) 수신 시에만 모달 표시
    }, []);

        const closeClaimAllSummary = useCallback(() => {
        setIsClaimAllSummaryOpen(false);
        setClaimAllSummary(null);
    }, []);

    const applyPreset = useCallback((preset: EquipmentPreset) => {
        handleAction({ type: 'APPLY_PRESET', payload: { presetName: preset.name, equipment: preset.equipment } });
    }, [handleAction]);

    const presets = useMemo(() => currentUser?.equipmentPresets || [], [currentUser?.equipmentPresets]);
    
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
    const [isGuildShopOpen, setIsGuildShopOpen] = useState(false);

    const {
        mainOptionBonuses,
        combatSubOptionBonuses,
        specialStatBonuses,
        aggregatedMythicStats,
    } = useMemo(() => {
        const initialBonuses = {
            mainOptionBonuses: {} as Record<CoreStat, { flat: number; percent: number }>,
            combatSubOptionBonuses: {} as Record<CoreStat, { flat: number; percent: number }>,
            specialStatBonuses: {} as Record<SpecialStat, { flat: number; percent: number }>,
            aggregatedMythicStats: {} as Record<MythicStat, { count: number, totalValue: number }>,
        };

        if (!currentUserWithStatus || !currentUserWithStatus.equipment || !currentUserWithStatus.inventory || !Array.isArray(currentUserWithStatus.inventory)) {
            return initialBonuses;
        }

        const equippedItems = currentUserWithStatus.inventory.filter(item =>
            item && currentUserWithStatus.equipment && Object.values(currentUserWithStatus.equipment).includes(item.id)
        );

        const bonusNum = (v: unknown): number => {
            const x = Number(v);
            return Number.isFinite(x) ? x : 0;
        };

        const aggregated = equippedItems.reduce((acc, item) => {
            if (!item.options) return acc;

            // Main Option
            if (item.options.main) {
                const type = item.options.main.type as CoreStat;
                if (!acc.mainOptionBonuses[type]) {
                    acc.mainOptionBonuses[type] = { flat: 0, percent: 0 };
                }
                const mv = bonusNum(item.options.main.value);
                if (item.options.main.isPercentage) {
                    acc.mainOptionBonuses[type].percent += mv;
                } else {
                    acc.mainOptionBonuses[type].flat += mv;
                }
            }

            // Combat Sub Options
            item.options.combatSubs?.forEach(sub => {
                const type = sub.type as CoreStat;
                if (!acc.combatSubOptionBonuses[type]) {
                    acc.combatSubOptionBonuses[type] = { flat: 0, percent: 0 };
                }
                const sv = bonusNum(sub.value);
                if (sub.isPercentage) {
                    acc.combatSubOptionBonuses[type].percent += sv;
                } else {
                    acc.combatSubOptionBonuses[type].flat += sv;
                }
            });

            // Special Sub Options
            item.options.specialSubs?.forEach(sub => {
                const type = coerceSpecialStatType(sub.type);
                if (!type) return;
                if (!acc.specialStatBonuses[type]) {
                    acc.specialStatBonuses[type] = { flat: 0, percent: 0 };
                }
                const sv = bonusNum(sub.value);
                if (sub.isPercentage) {
                    acc.specialStatBonuses[type].percent += sv;
                } else {
                    acc.specialStatBonuses[type].flat += sv;
                }
            });

            // Mythic Sub Options
            item.options.mythicSubs?.forEach(sub => {
                const type = sub.type as MythicStat; // Cast to MythicStat
                if (!acc.aggregatedMythicStats[type]) {
                    acc.aggregatedMythicStats[type] = { count: 0, totalValue: 0 };
                }
                acc.aggregatedMythicStats[type].count++;
                acc.aggregatedMythicStats[type].totalValue += bonusNum(sub.value);
            });

            return acc;
        }, initialBonuses);

        return aggregated;
    }, [currentUserWithStatus]);

    const modalsValue = useMemo(
        () => ({
            activeQuickUtilityPanel,
            mobileViewportStack,
            isSettingsModalOpen,
            isPetManagementModalOpen,
            isAdventureMonsterCodexModalOpen,
            isTrainingQuestModalOpen,
            detailedStatsType,
            isInventoryOpen,
            isMailboxOpen,
            isQuestsOpen,
            isShopOpen,
            isExchangeOpen,
            shopInitialTab,
            lastUsedItemResult,
            pairPetDetailModal,
            disassemblyResult,
            craftResult,
            rewardSummary,
            viewingUser,
            isInfoModalOpen,
            isAnnouncementsModalOpen,
            isRankingQuickModalOpen,
            isChatQuickModalOpen,
            isEncyclopediaOpen,
            isStatAllocationModalOpen,
            enhancementAnimationTarget,
            isGameRecordListOpen,
            viewingGameRecord,
            pastRankingsInfo,
            viewingItem,
            isProfileEditModalOpen,
            moderatingUser,
            isClaimAllSummaryOpen,
            claimAllSummary,
            isMbtiInfoModalOpen,
            mutualDisconnectMessage,
            showOtherDeviceLoginModal,
            isEquipmentEffectsModalOpen,
            isBlacksmithModalOpen,
            blacksmithSelectedItemForEnhancement,
            blacksmithActiveTab,
            combinationResult,
            isBlacksmithEffectsModalOpen,
            enhancingItem,
            isEnhancementResultModalOpen,
            tournamentScoreChange,
            refinementResult,
            isInsufficientActionPointsModalOpen,
            isOpponentInsufficientActionPointsModalOpen,
            isActionPointModalOpen,
            levelUpCelebration,
            mannerGradeChange,
            contentUnlockNotice,
            adminGameResultDemoSession,
        }),
        [
            activeQuickUtilityPanel,
            mobileViewportStack,
            isSettingsModalOpen,
            isPetManagementModalOpen,
            isAdventureMonsterCodexModalOpen,
            isTrainingQuestModalOpen,
            detailedStatsType,
            isInventoryOpen,
            isMailboxOpen,
            isQuestsOpen,
            isShopOpen,
            isExchangeOpen,
            shopInitialTab,
            lastUsedItemResult,
            pairPetDetailModal,
            disassemblyResult,
            craftResult,
            rewardSummary,
            viewingUser,
            isInfoModalOpen,
            isAnnouncementsModalOpen,
            isRankingQuickModalOpen,
            isChatQuickModalOpen,
            isEncyclopediaOpen,
            isStatAllocationModalOpen,
            enhancementAnimationTarget,
            isGameRecordListOpen,
            viewingGameRecord,
            pastRankingsInfo,
            viewingItem,
            isProfileEditModalOpen,
            moderatingUser,
            isClaimAllSummaryOpen,
            claimAllSummary,
            isMbtiInfoModalOpen,
            mutualDisconnectMessage,
            showOtherDeviceLoginModal,
            isEquipmentEffectsModalOpen,
            isBlacksmithModalOpen,
            blacksmithSelectedItemForEnhancement,
            blacksmithActiveTab,
            combinationResult,
            isBlacksmithEffectsModalOpen,
            enhancingItem,
            isEnhancementResultModalOpen,
            tournamentScoreChange,
            refinementResult,
            isInsufficientActionPointsModalOpen,
            isOpponentInsufficientActionPointsModalOpen,
            isActionPointModalOpen,
            levelUpCelebration,
            mannerGradeChange,
            contentUnlockNotice,
            adminGameResultDemoSession,
        ],
    );

    return {
        currentUser,
        presets,
        setCurrentUserAndRoute,
        currentUserWithStatus,
        updateTrigger,
        singlePlayerStagesListRevision,
        currentRoute,
        error,
        allUsers,
        onlineUsers: enrichedOnlineUsers,
        liveGames,
        singlePlayerGames,
        towerGames,
        towerRankingsRefetchTrigger,
        negotiations,
        waitingRoomChats,
        gameChats,
        adminLogs,
        gameModeAvailability,
        kataServerRuntimeConfig,
        championshipAbilityKataLadder,
        rankedMatchingQueue,
        rankedMatchProposal,
        rankedMatchFound,
        pairRooms,
        pairRoomChatByRoomId,
        pairPartnerInvites,
        pairInviteCooldownUntilByInviteeId,
        arenaEntranceAvailability: arenaEntranceAvailabilityResolved,
        arenaEntranceFromServer,
        announcements,
        globalOverrideAnnouncement,
        announcementInterval,
        homeBoardPosts,
        unreadHomeBoardPostIds,
        hasUnreadHomeBoardPosts,
        activeGame,
        activeNegotiation,
        showExitToast,
        serverReconnectNotice,
        connectionStatus,
        gameRejoinFailure,
        aiLobbyStartConfirmGameId,
        enhancementResult,
        enhancementOutcome,
        unreadMailCount,
        hasClaimableQuest,
        hasClaimableExchangeSettlement,
        hasClaimablePairPetTrainingOrHatchery,
        settings,
        isNarrowViewport,
        isNativeMobile,
        usePortraitFirstShell,
        modalLayerUsesDesignPixels,
        pcUniformScalePolicy,
        isPhoneHandheldTouch,
        isLargeTouchTablet,
        showPcLikeMobileLayoutSetting,
        updateSoundSetting,
        updateFeatureSetting,
        updatePanelColor,
        updateTextColor,
        updatePanelEdgeStyle,
        updateLocale,
        updatePcLikeMobileLayout,
        resetGraphicsToDefault,
        mainOptionBonuses,
        combatSubOptionBonuses,
        specialStatBonuses,
        aggregatedMythicStats,
        modals: modalsValue,
        handlers: {
            handleAction,
            applyDeferredUserUpdate: (updates: Partial<User>, source = 'deferred-user-update') => applyUserUpdate(updates, source),
            showObtainedItemsBulk: (items: InventoryItem[]) => {
                setLastUsedItemResult(stampObtainedItemsBulk(items));
            },
            handleLogout,
            handleEnterWaitingRoom,
            requestGameRejoinRetry,
            recoverPveGameFromSessionStorage,
            applyPreset,
            openSettingsModal: () => {
                if (!replaceMobileViewport({ type: 'settings' })) {
                    setIsSettingsModalOpen(true);
                }
            },
            closeSettingsModal: () => {
                setIsSettingsModalOpen(false);
                if (usePortraitFirstShell) {
                    setMobileViewportStack((prev) => prev.filter((entry) => entry.type !== 'settings'));
                }
            },
            openPetManagementModal: (opts?: { modal?: boolean }) => {
                if (opts?.modal) {
                    setIsPetManagementModalOpen(true);
                } else if (!openQuickUtilityViewport('pet')) {
                    setActiveQuickUtilityPanel('pet');
                }
            },
            closePetManagementModal: () => {
                setIsPetManagementModalOpen(false);
                setActiveQuickUtilityPanel((prev) => (prev === 'pet' ? null : prev));
            },
            openAdventureMonsterCodexModal: (opts?: { modal?: boolean }) => {
                if (opts?.modal) {
                    setIsAdventureMonsterCodexModalOpen(true);
                } else if (!openQuickUtilityViewport('monsterCodex')) {
                    setActiveQuickUtilityPanel('monsterCodex');
                }
            },
            closeAdventureMonsterCodexModal: () => {
                setIsAdventureMonsterCodexModalOpen(false);
                setActiveQuickUtilityPanel((prev) => (prev === 'monsterCodex' ? null : prev));
            },
            openTrainingQuest: (opts?: { modal?: boolean }) => {
                if (opts?.modal) {
                    setIsTrainingQuestModalOpen(true);
                } else if (!openQuickUtilityViewport('trainingQuest')) {
                    setActiveQuickUtilityPanel('trainingQuest');
                }
            },
            closeTrainingQuest: () => {
                setIsTrainingQuestModalOpen(false);
                setActiveQuickUtilityPanel((prev) => (prev === 'trainingQuest' ? null : prev));
            },
            openDetailedStats: (
                statsType: 'strategic' | 'playful' | 'both',
                opts?: { modal?: boolean },
            ) => {
                setDetailedStatsType(statsType);
                if (!opts?.modal) {
                    if (!openQuickUtilityViewport('detailedStats')) {
                        setActiveQuickUtilityPanel('detailedStats');
                    }
                }
            },
            closeDetailedStats: () => {
                setDetailedStatsType(null);
                setActiveQuickUtilityPanel((prev) => (prev === 'detailedStats' ? null : prev));
            },
            openInventory: (opts?: { modal?: boolean }) => {
                if (opts?.modal) {
                    setIsInventoryOpen(true);
                } else if (!openQuickUtilityViewport('inventory')) {
                    setActiveQuickUtilityPanel('inventory');
                }
            },
            closeInventory: () => {
                setIsInventoryOpen(false);
                setActiveQuickUtilityPanel((prev) => (prev === 'inventory' ? null : prev));
            },
            openMailbox: () => {
                if (!replaceMobileViewport({ type: 'mailbox' })) {
                    setIsMailboxOpen(true);
                }
            },
            closeMailbox: () => {
                setIsMailboxOpen(false);
                if (usePortraitFirstShell) {
                    setMobileViewportStack((prev) => prev.filter((entry) => entry.type !== 'mailbox'));
                }
            },
            openQuests: (opts?: { modal?: boolean }) => {
                if (opts?.modal) {
                    setIsQuestsOpen(true);
                } else if (!openQuickUtilityViewport('quests')) {
                    setActiveQuickUtilityPanel('quests');
                }
            },
            closeQuests: () => {
                setIsQuestsOpen(false);
                setActiveQuickUtilityPanel((prev) => (prev === 'quests' ? null : prev));
            },
            closeQuickUtilityPanel: () => closeQuickUtilityPanel(),
            popMobileViewport: () => popMobileViewport(),
            clearMobileViewport: () => clearMobileViewport(),
            openShop: (
                tab?: 'equipment' | 'materials' | 'consumables' | 'misc' | 'diamonds' | 'vip',
                opts?: { modal?: boolean },
            ) => {
                setShopInitialTab(tab);
                if (opts?.modal) {
                    setIsShopOpen(true);
                } else if (!openQuickUtilityViewport('shop')) {
                    setActiveQuickUtilityPanel('shop');
                }
            },
            closeShop: () => {
                setIsShopOpen(false);
                setShopInitialTab(undefined);
                setActiveQuickUtilityPanel((prev) => (prev === 'shop' ? null : prev));
            },
            openExchange: (opts?: { modal?: boolean }) => {
                void import('../components/ExchangeModal.js').catch(() => {});
                if (opts?.modal) {
                    setIsExchangeOpen(true);
                } else if (!openQuickUtilityViewport('exchange')) {
                    setActiveQuickUtilityPanel('exchange');
                }
            },
            closeExchange: () => {
                setIsExchangeOpen(false);
                setActiveQuickUtilityPanel((prev) => (prev === 'exchange' ? null : prev));
            },
            openActionPointModal: () => {
                if (!replaceMobileViewport({ type: 'actionPoint' })) {
                    setIsActionPointModalOpen(true);
                }
            },
            closeActionPointModal: () => {
                setIsActionPointModalOpen(false);
                if (usePortraitFirstShell) {
                    setMobileViewportStack((prev) => prev.filter((entry) => entry.type !== 'actionPoint'));
                }
            },
            closeInsufficientActionPointsModal: () => setIsInsufficientActionPointsModalOpen(false),
            openOpponentInsufficientActionPointsModal: () => setIsOpponentInsufficientActionPointsModalOpen(true),
            closeOpponentInsufficientActionPointsModal: () => setIsOpponentInsufficientActionPointsModalOpen(false),
            clearRankedMatchFound: () => setRankedMatchFound(null),
            clearRankedMatchProposal: () => setRankedMatchProposal(null),
            closeItemObtained: async () => {
                setLastUsedItemResult(null);
                setTournamentScoreChange(null);
            },
            closeDisassemblyResult: () => setDisassemblyResult(null),
            closeCraftResult: () => setCraftResult(null),
            closeCombinationResult: () => setCombinationResult(null),
            closeRewardSummary: () => setRewardSummary(null),
            closeLevelUpCelebration: () => setLevelUpCelebration(null),
            closeMannerGradeChange: () => setMannerGradeChange(null),
            closeContentUnlockNotice: () => setContentUnlockNoticeQueue((prev) => prev.slice(1)),
            previewAdminLevelUpCelebrationModal,
            previewAdminMannerGradeUpModal,
            previewAdminContentUnlockNoticeModal,
            previewAdminGameResultModal,
            closeAdminGameResultDemoModal,
            closeClaimAllSummary,
            openViewingUser: handleViewUser,
            closeViewingUser: () => {
                setViewingUser(null);
                if (usePortraitFirstShell) {
                    setMobileViewportStack((prev) => prev.filter((entry) => entry.type !== 'userProfile'));
                }
            },
            openInfoModal: (opts?: { modal?: boolean }) => {
                if (opts?.modal) {
                    setIsInfoModalOpen(true);
                } else if (!openQuickUtilityViewport('help')) {
                    setActiveQuickUtilityPanel('help');
                }
            },
            closeInfoModal: () => {
                setIsInfoModalOpen(false);
                setActiveQuickUtilityPanel((prev) => (prev === 'help' ? null : prev));
            },
            openAnnouncementsModal: (opts?: { modal?: boolean }) => {
                if (opts?.modal) {
                    setIsAnnouncementsModalOpen(true);
                } else if (!openQuickUtilityViewport('announcements')) {
                    setActiveQuickUtilityPanel('announcements');
                }
            },
            closeAnnouncementsModal: () => {
                markAllHomeBoardPostsReadFromRef();
                setIsAnnouncementsModalOpen(false);
                setActiveQuickUtilityPanel((prev) => (prev === 'announcements' ? null : prev));
            },
            markHomeBoardPostRead,
            openRankingQuickModal: (opts?: { modal?: boolean }) => {
                if (opts?.modal) {
                    setIsRankingQuickModalOpen(true);
                } else if (!openQuickUtilityViewport('ranking')) {
                    setActiveQuickUtilityPanel('ranking');
                }
            },
            closeRankingQuickModal: () => {
                setIsRankingQuickModalOpen(false);
                setActiveQuickUtilityPanel((prev) => (prev === 'ranking' ? null : prev));
            },
            openChatQuickModal: () => {
                if (!replaceMobileViewport({ type: 'chatQuick' })) {
                    setIsChatQuickModalOpen(true);
                }
            },
            closeChatQuickModal: () => {
                setIsChatQuickModalOpen(false);
                if (usePortraitFirstShell) {
                    setMobileViewportStack((prev) => prev.filter((entry) => entry.type !== 'chatQuick'));
                }
            },
            openEncyclopedia: (opts?: { modal?: boolean }) => {
                if (opts?.modal) {
                    setIsEncyclopediaOpen(true);
                } else if (!openQuickUtilityViewport('encyclopedia')) {
                    setActiveQuickUtilityPanel('encyclopedia');
                }
            },
            closeEncyclopedia: () => {
                setIsEncyclopediaOpen(false);
                setActiveQuickUtilityPanel((prev) => (prev === 'encyclopedia' ? null : prev));
            },
            openStatAllocationModal: () => {
                if (!replaceMobileViewport({ type: 'statAllocation' })) {
                    setIsStatAllocationModalOpen(true);
                }
            },
            closeStatAllocationModal: () => {
                setIsStatAllocationModalOpen(false);
                if (usePortraitFirstShell) {
                    setMobileViewportStack((prev) => prev.filter((entry) => entry.type !== 'statAllocation'));
                }
            },
            openProfileEditModal: () => {
                if (!replaceMobileViewport({ type: 'profileEdit' })) {
                    setIsProfileEditModalOpen(true);
                }
            },
            closeProfileEditModal: () => {
                setIsProfileEditModalOpen(false);
                if (usePortraitFirstShell) {
                    setMobileViewportStack((prev) => prev.filter((entry) => entry.type !== 'profileEdit'));
                }
            },
            openPastRankings: (info: { user: UserWithStatus; mode: GameMode | 'strategic' | 'pair' | 'unified' }) => {
                setPastRankingsInfo(info);
                if (usePortraitFirstShell) {
                    pushMobileViewport({ type: 'pastRankings', info });
                }
            },
            closePastRankings: () => {
                setPastRankingsInfo(null);
                if (
                    usePortraitFirstShell &&
                    mobileViewportStackRef.current[mobileViewportStackRef.current.length - 1]?.type === 'pastRankings'
                ) {
                    popMobileViewport();
                }
            },
            openViewingItem,
            closeViewingItem,
            openPairPetDetailModal,
            closePairPetDetailModal,
            openEnhancingItem,
            startEnhancement,
            openEnhancementFromDetail,
            openRefinementFromDetail,
            openBlacksmithTabFromInventory,
            clearEnhancementOutcome,
            clearRefinementResult,
            clearEnhancementAnimation: () => setEnhancementAnimationTarget(null),
            openModerationModal,
            closeModerationModal,
            openMbtiInfoModal: () => setIsMbtiInfoModalOpen(true),
            closeMbtiInfoModal: () => setIsMbtiInfoModalOpen(false),
            showMutualDisconnectMessage: (msg: string) => setMutualDisconnectMessage(msg),
            closeMutualDisconnectModal: () => setMutualDisconnectMessage(null),
            confirmOtherDeviceLoginAndLogout: () => {
                try {
                    sessionStorage.removeItem('currentUser');
                } catch {
                    // ignore
                }
                setCurrentUser(null);
                setShowOtherDeviceLoginModal(false);
                window.location.hash = '#/login';
            },
            openEquipmentEffectsModal: () => {
                if (!replaceMobileViewport({ type: 'equipmentEffects' })) {
                    setIsEquipmentEffectsModalOpen(true);
                }
            },
            closeEquipmentEffectsModal: () => {
                setIsEquipmentEffectsModalOpen(false);
                if (usePortraitFirstShell) {
                    setMobileViewportStack((prev) => prev.filter((entry) => entry.type !== 'equipmentEffects'));
                }
            },
            openBlacksmithModal: (opts?: { modal?: boolean }) => {
                openBlacksmithUi(opts);
            },
            closeBlacksmithModal: () => {
                setIsBlacksmithModalOpen(false);
                setActiveQuickUtilityPanel((prev) => (prev === 'blacksmith' ? null : prev));
                setBlacksmithSelectedItemForEnhancement(null);
                setBlacksmithActiveTab('enhance'); // Reset to default tab
                setIsBlacksmithEffectsModalOpen(false);
            },
            openBlacksmithEffectsModal: () => {
                setIsBlacksmithEffectsModalOpen(true);
            },
            closeBlacksmithEffectsModal: () => {
                setIsBlacksmithEffectsModalOpen(false);
            },
            openGameRecordList: (opts?: { modal?: boolean }) => {
                if (opts?.modal) {
                    setIsGameRecordListOpen(true);
                } else if (!openQuickUtilityViewport('gameRecords')) {
                    setActiveQuickUtilityPanel('gameRecords');
                }
            },
            closeGameRecordList: () => {
                setIsGameRecordListOpen(false);
                setActiveQuickUtilityPanel((prev) => (prev === 'gameRecords' ? null : prev));
            },
            openGameRecordViewer,
            closeGameRecordViewer,
            setBlacksmithActiveTab,
            closeEnhancementModal,
            openPresetModal: () => setIsPresetModalOpen(true),
            closePresetModal: () => setIsPresetModalOpen(false),
            openGuildShop: () => setIsGuildShopOpen(true),
            closeGuildShop: () => setIsGuildShopOpen(false),
        },
        guilds,
    };
};