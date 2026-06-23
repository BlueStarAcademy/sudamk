import * as summaryService from '../summaryService.js';
import * as types from '../../types/index.js';
import { GameCategory } from '../../types/enums.js';
import * as db from '../db.js';
import { getGoLogic, processMove } from '../goLogic.js';
import { getGameResult, invalidateScoringPrecompute, maybeStartAnticipatedScoringPrecompute } from '../gameModes.js';
import {
    initializeNigiri,
    updateNigiriState,
    handleNigiriAction,
    enterNigiriRevealWithAssignedColors,
} from './nigiri.js';
import { aiUserId } from '../aiPlayer.js';
import { initializeBase, updateBaseState, handleBaseAction } from './base.js';
import { initializeCapture, updateCaptureState, handleCaptureAction } from './capture.js';
import { initializeHidden, updateHiddenState, handleHiddenAction } from './hidden.js';
import { initializeMissile, updateMissileState, handleMissileAction } from './missile.js';
import {
    applyCastleTerritoryAfterMove,
    ensureCastleStonePointsForSession,
    initializeCastleGame,
    tryAutoScoreCastleIfNoMoves,
    tryEndCastleOnCapture,
} from './castle.js';
import {
    applyChessCaptureScoreForRemovedStones,
    CHESS_GO_BOARD_SIZE,
    commitChessGoPlacementCaptures,
    getChessGoStoneCapturePointValue,
    isPlayableChessGoIntersection,
    processChessGoMove,
    sessionUsesChessGo,
} from '../../shared/utils/chessGoRules.js';
import { handleChessMoveAction, handleChessPlacementAction, initializeChessGame, repairChessGoSessionState, tryEndChessOnKingCapture } from './chess.js';
import { enterChessPiecePlacement, updateChessPlacementState } from './chessPlacementFlow.js';
import { processCastleMove } from '../../shared/utils/castleGoRules.js';
import {
    handleSharedAction,
    transitionToPlaying,
    transitionToPlayingOrUniformRoulette,
    hasTimeControl,
    shouldEnforceTimeControl,
    enforceBaseSeatLockIfDriftedDuringPlay,
    freezeMainTurnClock,
} from './shared.js';
import { isFischerStyleTimeControl, getFischerIncrementSeconds, isSpeedPerMoveTimeControl } from '../../shared/utils/gameTimeControl.js';
import {
    applySpeedMoveClockEnd,
    applySpeedNextTurnClockStart,
    shouldTreatTurnDeadlineExpiryAsTimeForfeit,
} from '../../shared/utils/speedTimePressureSessionSync.js';
import {
    advancePairTurn,
    confirmPairOrderReveal,
    getCurrentPairTurnSeat,
    isPairAiSeat,
    isPairClassicGame,
    canPairHumanDeclarePass,
    markPairSeatPassed,
    pairOrderRevealNeedsConfirmation,
    resetPairPasses,
} from '../../shared/utils/pairGameTurn.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';
import { updateStrategicPveItemState } from './strategicItemAdapters.js';
import {
    consumeOpponentPatternStoneIfAny,
    recordPatternStoneConsumed,
    stripPatternStonesAtConsumedIntersections,
    removeHumanHiddenStonePointsForPlayer,
    clearHumanHiddenStonePointsAtIntersection,
} from '../../shared/utils/patternStoneConsume.js';
import {
    isIntersectionRecordedAsBaseStone,
    removeCapturedBaseStoneMarkersFromSession,
} from '../../shared/utils/removeCapturedBaseStoneMarkers.js';
import { bumpGuildWarMaxSingleCapturePointsForPlayer } from '../../shared/utils/guildWarMaxSingleCapturePoints.js';
import { tryEndGameWhenCaptureTargetReached } from '../utils/captureTargets.js';
import { deferGetGameResultForScoringOverlay } from '../utils/deferGetGameResultForScoringOverlay.js';
import { PVE_STRATEGIC_SERVER_AI_POST_HUMAN_DELAY_MS } from '../constants/pveStrategicAiSchedule.js';
import {
    syncSpeedTimePressureCaptures,
    shouldRunGoClockAccountingForSession,
} from '../utils/speedTimePressureLiveCaptures.js';
import { getRegionalCaptureOpponentTargetBonus } from '../../utils/adventureRegionalSpecialtyBuff.js';
import { adventureEncounterCountdownUiActive } from '../../shared/utils/adventureEncounterUi.js';
import {
    useAiInitialHiddenCellTracking,
    useAiInitialHiddenSyntheticCaptureHistory,
} from './hiddenRevealPolicy.js';
import { getPlacementOccupancyBlockReason } from '../../shared/utils/hiddenStonePlacementOccupancy.js';
import { isHiddenMoveIndexSoftRevealedByAnyPlayer } from './hiddenScanShared.js';
import { expandToAllUnrevealedHiddenStonesForPlayers } from '../../shared/utils/expandHiddenRevealStones.js';
import { PVE_AI_HIDDEN_REVEAL_DURATION_MS } from '../../shared/constants/gameSettings.js';
import {
    arenaUsesClientAuthoritativeScoringSnapshot,
    getArenaTurnCount,
    resolveArenaFixedScoringTurnLimit,
    resolveArenaTurnLimitState,
} from '../utils/arenaTurnPolicy.js';
import { modeIncludesBaseRule } from '../../shared/utils/liveSessionArenaKind.js';
import { findLatestMoveIndexAtExcludingRecordedBaseStones } from '../../shared/utils/baseHiddenMoveIndex.js';
import { schedulePairAiTurnIfNeeded as enqueuePairAiTurnIfNeeded } from '../utils/pairAiTurnSchedule.js';
import { schedulePveStrategicAiTurnIfNeeded } from '../utils/pveStrategicAiTurnSchedule.js';
import {
    humanPvpAllowsMoveCountAutoScoring,
    applyHumanPvpStrategicSettingsInvariants,
} from './pvpStrategicPipeline.js';
import {
    isRankedFixedTurnScoringSession,
    shouldTriggerRankedFixedTurnScoring,
} from '../../shared/utils/rankedFixedTurnScoring.js';
import {
    mixGoClearHiddenItemPhaseTimers,
    mixGoHiddenInventoryKeyForPlayer,
    mixGoHiddenUsedKeyForPlayer,
    mixGoPveHiddenPlacementAlreadyCommitted,
} from '../../shared/utils/mixGoRules.js';

function modeIncludesCaptureRule(game: types.LiveGameSession): boolean {
    return game.mode === types.GameMode.Capture ||
        (game.mode === types.GameMode.Mix && Boolean(game.settings?.mixedModes?.includes(types.GameMode.Capture)));
}

const accountMainClockAfterMove = (game: types.LiveGameSession, playerWhoMoved: types.Player, now: number): void => {
    if (isSpeedPerMoveTimeControl(game)) {
        applySpeedMoveClockEnd(game, playerWhoMoved, now, aiUserId);
        const fischerIncrement = getFischerIncrementSeconds(game as any);
        if (fischerIncrement > 0) {
            const timeKey = playerWhoMoved === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
            game[timeKey] = Math.max(0, Number(game[timeKey] ?? 0)) + fischerIncrement;
        }
        return;
    }
    const timeKey = playerWhoMoved === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
    const byoyomiKey = playerWhoMoved === types.Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';
    const fischerIncrement = getFischerIncrementSeconds(game as any);
    const isFischer = isFischerStyleTimeControl(game as any);
    const isInByoyomi =
        game[timeKey] <= 0 && game.settings.byoyomiCount > 0 && game[byoyomiKey] > 0 && !isFischer;
    if (isInByoyomi) {
        game[timeKey] = 0;
        return;
    }
    if (game.turnDeadline) {
        const timeRemaining = Math.max(0, (game.turnDeadline - now) / 1000);
        game[timeKey] = timeRemaining + fischerIncrement;
    } else if (game.pausedTurnTimeLeft) {
        game[timeKey] = game.pausedTurnTimeLeft + fischerIncrement;
    } else {
        game[timeKey] += fischerIncrement;
    }
};

const startNextTurnClock = (game: types.LiveGameSession, now: number): void => {
    if (isSpeedPerMoveTimeControl(game)) {
        applySpeedNextTurnClockStart(game, now);
        return;
    }
    const nextPlayer = game.currentPlayer;
    const nextTimeKey = nextPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
    const nextByoyomiKey = nextPlayer === types.Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';
    const isFischer = isFischerStyleTimeControl(game as any);
    const isNextInByoyomi =
        game[nextTimeKey] <= 0 && game.settings.byoyomiCount > 0 && game[nextByoyomiKey] > 0 && !isFischer;
    game.turnDeadline = isNextInByoyomi
        ? now + game.settings.byoyomiTime * 1000
        : now + game[nextTimeKey] * 1000;
    game.turnStartTime = now;
};

function findLatestMoveIndexAt(
    game: types.LiveGameSession,
    x: number,
    y: number,
    player?: types.Player,
): number {
    return findLatestMoveIndexAtExcludingRecordedBaseStones(game.moveHistory, x, y, player, game);
}

const STRATEGIC_GO_SERVER_AI_MODES: types.GameMode[] = [
    types.GameMode.Standard,
    types.GameMode.Capture,
    types.GameMode.Speed,
    types.GameMode.Base,
    types.GameMode.Hidden,
    types.GameMode.Missile,
    types.GameMode.Uniform,
    types.GameMode.Chess,
    types.GameMode.Mix,
];
const singlePlayerBlackTurnLimitFailTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSinglePlayerBlackTurnLimitFail(gameId: string, delayMs = 1000): void {
    const key = String(gameId || '');
    if (!key) return;
    const prev = singlePlayerBlackTurnLimitFailTimers.get(key);
    if (prev) clearTimeout(prev);
    const tid = setTimeout(async () => {
        singlePlayerBlackTurnLimitFailTimers.delete(key);
        try {
            const { getCachedGame } = await import('../gameCache.js');
            let g: types.LiveGameSession | null = await getCachedGame(key);
            if (!g) g = await db.getLiveGame(key);
            if (!g || !g.isSinglePlayer || (g.gameStatus as string) === 'ended') return;
            if ((g.settings as any)?.isSurvivalMode === true) return;
            const mixedModes = (((g.settings as any)?.mixedModes ?? []) as types.GameMode[]);
            const hasCaptureInMix =
                g.mode === types.GameMode.Mix && Array.isArray(mixedModes) && mixedModes.includes(types.GameMode.Capture);
            if (g.mode !== types.GameMode.Capture && !hasCaptureInMix) return;

            const blackTurnLimit = Number((g.settings as any)?.blackTurnLimit ?? 0);
            if (!(blackTurnLimit > 0)) return;
            const markedRemaining = Number((g as any).blackTurnLimitRemaining);
            const hasMarkedZeroRemaining = Number.isFinite(markedRemaining) && markedRemaining <= 0;
            const blackMoves = (g.moveHistory ?? []).filter(
                (m) => m.player === types.Player.Black && m.x !== -1 && m.y !== -1
            ).length;
            if (!hasMarkedZeroRemaining && blackMoves < blackTurnLimit) return;

            const blackTarget = g.effectiveCaptureTargets?.[types.Player.Black];
            const hasBlackTarget = blackTarget !== undefined && blackTarget !== 999;
            const blackCaptures = g.captures[types.Player.Black] ?? 0;
            if (hasBlackTarget && blackCaptures >= blackTarget) return;

            console.log(
                `[handleStandardAction] Delayed single-player blackTurnLimit fail: blackMoves=${blackMoves}, limit=${blackTurnLimit}, game=${g.id}`
            );
            await summaryService.endGame(g, types.Player.White, 'timeout');
        } catch (e: any) {
            console.error(`[scheduleSinglePlayerBlackTurnLimitFail] game=${key}:`, e?.message ?? e);
        }
    }, Math.max(1, Math.floor(delayMs)));
    singlePlayerBlackTurnLimitFailTimers.set(key, tid);
}

/**
 * 모험/길드전 서버 Kata AI: 유저 착수·패스 직후 메인 루프가 인라인 makeAiMove와 동시에 잠금만 잡고
 * 봇이 스킵되는 레이스를 줄이기 위해 aiTurnStartTime을 약간 미룬다. (gameActions 인라인 대기와 동일 ms)
 */
function nextAiTurnStartTimeAfterHumanStrategicMove(game: types.LiveGameSession, now: number): number {
    const isGo = STRATEGIC_GO_SERVER_AI_MODES.includes(game.mode);
    if (
        game.isAiGame &&
        !game.isSinglePlayer &&
        isGo &&
        (game.gameCategory === GameCategory.Adventure || game.gameCategory === GameCategory.GuildWar)
    ) {
        return now + PVE_STRATEGIC_SERVER_AI_POST_HUMAN_DELAY_MS;
    }
    return now;
}

function schedulePairAiTurnIfNeeded(game: types.LiveGameSession, now: number): void {
    enqueuePairAiTurnIfNeeded(game, now);
}

/** 유저 수·패스 직후 AI 턴 스케줄 — 모험/길드전은 큐 단일 경로, 그 외 AI 대국은 aiTurnStartTime만 설정 */
function scheduleAiTurnAfterHumanMove(game: types.LiveGameSession, now: number): void {
    const pairCurrentSeat = getCurrentPairTurnSeat(game.settings);
    if (pairCurrentSeat) {
        schedulePairAiTurnIfNeeded(game, now);
        return;
    }
    if (!game.isAiGame || (game.currentPlayer !== types.Player.Black && game.currentPlayer !== types.Player.White)) {
        return;
    }
    const currentPlayerId =
        game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
    const policy = resolveArenaSessionPolicy(game);
    if (
        policy.usesServerKataAi &&
        (policy.kind === GameCategory.Adventure || policy.kind === GameCategory.GuildWar)
    ) {
        schedulePveStrategicAiTurnIfNeeded(game, now);
        return;
    }
    if (currentPlayerId === aiUserId) {
        game.aiTurnStartTime = nextAiTurnStartTimeAfterHumanStrategicMove(game, now);
    } else {
        game.aiTurnStartTime = undefined;
    }
}

function advancePairTurnAfterAction(game: types.LiveGameSession, now: number): void {
    if (!isPairClassicGame(game.settings, game.mode)) return;
    if (game.pairTeamResignRequest) delete game.pairTeamResignRequest;
    if (game.pairTeamResignCooldownByTeam) delete game.pairTeamResignCooldownByTeam;
    const nextSeat = advancePairTurn(game.settings);
    if (nextSeat) {
        game.currentPlayer = nextSeat.player;
        schedulePairAiTurnIfNeeded(game, now);
    }
}

/** PVE: 클라가 이미 반영한 히든 착수에 대한 PLACE_STONE 동기화 — processMove 없이 턴·재고·playing만 맞춘다. */
async function finalizePveHiddenPlacementFromAuthoritativeClient(
    game: types.LiveGameSession,
    now: number,
    user: types.User,
    myPlayerEnum: types.Player,
    opponentPlayerEnum: types.Player,
    x: number,
    y: number,
    pairCurrentSeat: ReturnType<typeof getCurrentPairTurnSeat>,
): Promise<types.HandleActionResult> {
    const hiddenKey = mixGoHiddenInventoryKeyForPlayer(myPlayerEnum);
    const currentHidden = game[hiddenKey] ?? game.settings.hiddenStoneCount ?? 0;
    if (currentHidden > 0) {
        game[hiddenKey] = currentHidden - 1;
        const usedKey = mixGoHiddenUsedKeyForPlayer(myPlayerEnum);
        game[usedKey] = (game[usedKey] || 0) + 1;
    }
    if (!game.hiddenMoves) game.hiddenMoves = {};
    const moveIndex = game.moveHistory.length - 1;
    game.hiddenMoves[moveIndex] = true;
    const humanHiddenStonePoints = ((game as any).humanHiddenStonePoints ?? []) as Array<
        types.Point & { player?: types.Player }
    >;
    (game as any).humanHiddenStonePoints = [
        ...humanHiddenStonePoints.filter((point) => !(point.x === x && point.y === y && point.player === myPlayerEnum)),
        { x, y, player: myPlayerEnum },
    ];

    const petHintBonusResult = await (async () => {
        const { handleStrategicPetHintBonusClaim } = await import('../strategicPetHintAction.js');
        return handleStrategicPetHintBonusClaim(game, user, {
            x,
            y,
            expectedMoveHistoryLength: game.moveHistory.length,
        });
    })();

    if (await tryEndGameWhenCaptureTargetReached(game, myPlayerEnum)) {
        return petHintBonusResult ?? {};
    }

    if (pairCurrentSeat) {
        advancePairTurnAfterAction(game, now);
    } else {
        game.currentPlayer = opponentPlayerEnum;
    }
    game.missileUsedThisTurn = false;
    game.gameStatus = 'playing';
    mixGoClearHiddenItemPhaseTimers(game);

    if (shouldRunGoClockAccountingForSession(game)) {
        startNextTurnClock(game, now);
    } else {
        game.turnDeadline = undefined;
        game.turnStartTime = undefined;
    }

    const autoScoringTurns = humanPvpAllowsMoveCountAutoScoring(game)
        ? await resolveArenaFixedScoringTurnLimit(game)
        : undefined;
    if (autoScoringTurns != null && autoScoringTurns > 0) {
        game.totalTurns = getArenaTurnCount(game);
        const rankedTrigger = isRankedFixedTurnScoringSession(game) && shouldTriggerRankedFixedTurnScoring(game);
        const genericTrigger =
            !isRankedFixedTurnScoringSession(game) && game.totalTurns >= autoScoringTurns;
        if (rankedTrigger || genericTrigger) {
            game.gameStatus = 'scoring';
            await db.saveGame(game);
            const { broadcastToGameParticipants } = await import('../socket.js');
            const gameToBroadcast = { ...game };
            if (!game.isSinglePlayer) {
                delete (gameToBroadcast as any).boardState;
            }
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);
            try {
                await getGameResult(game);
            } catch (scoringError: any) {
                console.error(`[finalizePveHiddenPlacementFromAuthoritativeClient] getGameResult failed:`, scoringError?.message);
            }
            return petHintBonusResult ?? {};
        }
        await db.saveGame(game);
    }

    scheduleAiTurnAfterHumanMove(game, now);

    return petHintBonusResult ?? {};
}

function updatePairOrderRevealState(game: types.LiveGameSession, now: number): void {
    if (game.gameStatus !== 'pair_order_reveal' || !isPairClassicGame(game.settings, game.mode)) return;
    if (pairOrderRevealNeedsConfirmation(game.settings)) return;
    if (game.mode === types.GameMode.Chess) {
        enterChessPiecePlacement(game, now);
        return;
    }
    if (game.mode === types.GameMode.Castle) {
        ensureCastleStonePointsForSession(game);
    }
    // `transitionToPlaying`가 sync 후 `getCurrentPairTurnSeat`로 currentPlayer를 맞춘다.
    transitionToPlaying(game, now);
    schedulePairAiTurnIfNeeded(game, now);
}

/** 모험 히든: 유저 히든이 따냄/따임 연출에 포함되면 같은 턴에 유저의 나머지 미공개 히든도 모두 완전 공개 */
function adventureRevealAllHumanHiddensIfInvolved(
    game: types.LiveGameSession,
    uniqueStonesToReveal: { point: types.Point; player: types.Player }[]
) {
    if (game.gameCategory !== types.GameCategory.Adventure || uniqueStonesToReveal.length === 0) return;
    const humanId = game.player1.id === aiUserId ? game.player2.id : game.player1.id;
    const humanEnum = humanId === game.blackPlayerId ? types.Player.Black : types.Player.White;
    if (!uniqueStonesToReveal.some(s => s.player === humanEnum)) return;
    if (!game.moveHistory || !game.hiddenMoves) return;
    if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
    for (let i = 0; i < game.moveHistory.length; i++) {
        if (!game.hiddenMoves[i]) continue;
        const m = game.moveHistory[i];
        if (!m || m.player !== humanEnum || m.x < 0 || m.y < 0) continue;
        if (!game.permanentlyRevealedStones.some(p => p.x === m.x && p.y === m.y)) {
            game.permanentlyRevealedStones.push({ x: m.x, y: m.y });
        }
    }
}

function resolveAiPlayerEnum(game: types.LiveGameSession): types.Player {
    if (game.blackPlayerId === aiUserId) return types.Player.Black;
    if (game.whitePlayerId === aiUserId) return types.Player.White;
    return types.Player.None;
}

function expandHiddenRevealStonesForGame(
    game: types.LiveGameSession,
    seedStones: { point: types.Point; player: types.Player }[]
): { point: types.Point; player: types.Player }[] {
    return expandToAllUnrevealedHiddenStonesForPlayers(game, seedStones, {
        aiPlayerEnum: resolveAiPlayerEnum(game),
        isHiddenMoveIndexSoftRevealed: isHiddenMoveIndexSoftRevealedByAnyPlayer,
    });
}

function resolveHiddenRevealDurationMs(
    game: types.LiveGameSession,
    stones: { point: types.Point; player: types.Player }[]
): number {
    const aiEnum = resolveAiPlayerEnum(game);
    if (aiEnum !== types.Player.None && stones.some((s) => s.player === aiEnum)) {
        return PVE_AI_HIDDEN_REVEAL_DURATION_MS;
    }
    return 1500;
}
const resolveStrategicAiHumanColor = (game: types.LiveGameSession, neg: types.Negotiation): types.Player => {
    const isAdventure = game.gameCategory === types.GameCategory.Adventure;
    if (isAdventure && game.mode === types.GameMode.Capture) {
        return types.Player.Black;
    }
    if (isAdventure && game.mode !== types.GameMode.Base) {
        return Math.random() < 0.5 ? types.Player.Black : types.Player.White;
    }
    return neg.settings.player1Color || types.Player.Black;
};

/** 모험에서 서버가 흑백을 정한 뒤에도 PVP와 같이 룰렛·확인 모달을 보여줌. 베이스는 입찰로 색이 정해져 제외, 따내기는 도전자 고정 흑이라 제외. */
const adventureAiColorRevealModal = (game: types.LiveGameSession) =>
    game.gameCategory === types.GameCategory.Adventure &&
    game.mode !== types.GameMode.Base &&
    game.mode !== types.GameMode.Capture;

const ADVENTURE_ENCOUNTER_FROZEN_MS_KEY = 'adventureEncounterFrozenHumanMsRemaining';

/**
 * 모험 인카운터 제한: 몬스터(AI) 턴에는 남은 시간이 줄지 않도록 마감 시각을 매 틱 `now + frozen`으로 맞춘다.
 * 도전자 턴에는 frozen을 비우고 마감 시각이 그대로 흐른다.
 */
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
            frozen = inferred > 0 ? Math.max(1000, inferred) : 120_000;
            (game as any)[ADVENTURE_ENCOUNTER_FROZEN_MS_KEY] = frozen;
        }
        (game as any).adventureEncounterDeadlineMs = now + frozen;
    } else {
        (game as any)[ADVENTURE_ENCOUNTER_FROZEN_MS_KEY] = undefined;
    }
};

const transitionPlayingOrAdventureNigiriReveal = (game: types.LiveGameSession, now: number) => {
    if (adventureAiColorRevealModal(game)) {
        enterNigiriRevealWithAssignedColors(game, now);
        const conf = game.preGameConfirmations;
        if (conf) {
            if (game.player1.id === aiUserId) conf[game.player1.id] = true;
            if (game.player2.id === aiUserId) conf[game.player2.id] = true;
        }
    } else {
        transitionToPlayingOrUniformRoulette(game, now);
    }
};

export const initializeStrategicGame = (game: types.LiveGameSession, neg: types.Negotiation, now: number) => {
    applyHumanPvpStrategicSettingsInvariants(game);
    const p1 = game.player1;
    const p2 = game.player2;
    const usesServerKataAi = resolveArenaSessionPolicy(game).usesServerKataAi;

    switch (game.mode) {
        case types.GameMode.Standard:
        case types.GameMode.Speed:
        case types.GameMode.Uniform:
        case types.GameMode.Mix:
            // 믹스룰에 히든/미사일이 포함돼도 이전에는 초기화를 건너뛰어 missiles_p1/p2·스캔이 비어 UI에 아이템이 안 보이는 문제가 있었음
            if (game.mode === types.GameMode.Mix) {
                initializeHidden(game);
                initializeMissile(game);
            }
            if (modeIncludesBaseRule(game.mode, game.settings)) {
                initializeBase(game, now);
                break;
            }
            if (usesServerKataAi) {
                const humanPlayerColor = resolveStrategicAiHumanColor(game, neg);
                if (humanPlayerColor === types.Player.Black) {
                    game.blackPlayerId = p1.id;
                    game.whitePlayerId = p2.id;
                } else {
                    game.whitePlayerId = p1.id;
                    game.blackPlayerId = p2.id;
                }
                transitionPlayingOrAdventureNigiriReveal(game, now);
            } else {
                initializeNigiri(game, now);
            }
            break;
        case types.GameMode.Capture:
            if (usesServerKataAi) {
                const humanPlayerColor = resolveStrategicAiHumanColor(game, neg);
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
                let blackT = blackTarget;
                let whiteT = whiteTarget;
                const advStageId = (game as { adventureStageId?: string }).adventureStageId;
                const capBonus =
                    advStageId && neg.challenger?.adventureProfile
                        ? getRegionalCaptureOpponentTargetBonus(neg.challenger.adventureProfile, advStageId)
                        : 0;
                if (capBonus > 0) {
                    if (humanPlayerColor === types.Player.Black) {
                        whiteT += capBonus;
                    } else {
                        blackT += capBonus;
                    }
                }
                game.effectiveCaptureTargets = {
                    [types.Player.None]: 0,
                    [types.Player.Black]: blackT,
                    [types.Player.White]: whiteT,
                };
                transitionPlayingOrAdventureNigiriReveal(game, now);
            } else {
                initializeCapture(game, now);
            }
            break;
        case types.GameMode.Base:
            initializeBase(game, now);
            break;
        case types.GameMode.Hidden:
            initializeHidden(game);
            if (usesServerKataAi) {
                const humanPlayerColor = resolveStrategicAiHumanColor(game, neg);
                if (humanPlayerColor === types.Player.Black) {
                    game.blackPlayerId = p1.id;
                    game.whitePlayerId = p2.id;
                } else {
                    game.whitePlayerId = p1.id;
                    game.blackPlayerId = p2.id;
                }
                transitionPlayingOrAdventureNigiriReveal(game, now);
            } else {
                initializeNigiri(game, now); // Also uses nigiri
            }
            break;
        case types.GameMode.Missile:
            initializeMissile(game);
            if (usesServerKataAi) {
                const humanPlayerColor = resolveStrategicAiHumanColor(game, neg);
                if (humanPlayerColor === types.Player.Black) {
                    game.blackPlayerId = p1.id;
                    game.whitePlayerId = p2.id;
                } else {
                    game.whitePlayerId = p1.id;
                    game.blackPlayerId = p2.id;
                }
                transitionPlayingOrAdventureNigiriReveal(game, now);
            } else {
                initializeNigiri(game, now); // Also uses nigiri
            }
            break;
        case types.GameMode.Castle:
            initializeCastleGame(game, neg, now);
            break;
        case types.GameMode.Chess:
            initializeChessGame(game, neg, now);
            break;
    }
};

export const updateStrategicGameState = async (game: types.LiveGameSession, now: number) => {
    // This is the core update logic for all Go-based games.

    syncAdventureEncounterDeadlineDuringMonsterTurn(game, now);
    updatePairOrderRevealState(game, now);

    if (game.gameStatus === 'playing') {
        syncSpeedTimePressureCaptures(game, now);
    }

    if (await tryEndGameWhenCaptureTargetReached(game, game.currentPlayer)) {
        return;
    }

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

    // 플레이어가 차례를 시작할 때 초읽기 모드인지 확인하고, 초읽기 시간을 30초로 리셋
    // (초읽기 모드에서 수를 두면 다음 턴에서 30초로 꽉 채워짐)
    if (
        game.gameStatus === 'playing' &&
        hasTimeControl(game.settings) &&
        shouldEnforceTimeControl(game) &&
        game.turnStartTime &&
        !isSpeedPerMoveTimeControl(game)
    ) {
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

    if (game.gameStatus === 'playing' && shouldEnforceTimeControl(game) && isSpeedPerMoveTimeControl(game) && game.turnStartTime) {
        const timedOutPlayer = game.currentPlayer;
        const timeKey = timedOutPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        const byoyomiKey = timedOutPlayer === types.Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';
        const mainLeft = Math.max(0, Number(game[timeKey] ?? 0));
        const elapsed = Math.max(0, (now - game.turnStartTime) / 1000);
        if (mainLeft - elapsed <= 0) {
            const isFischer = isFischerStyleTimeControl(game as any);
            if (
                !isFischer &&
                game.settings.byoyomiCount > 0 &&
                (game[byoyomiKey] ?? 0) > 0
            ) {
                game[timeKey] = 0;
                return;
            }
            const winner = timedOutPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
            game.lastTimeoutPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
            game.lastTimeoutPlayerIdClearTime = now + 5000;
            summaryService.endGame(game, winner, 'timeout');
            return;
        }
    }
    
    if (
        game.gameStatus === 'playing' &&
        shouldEnforceTimeControl(game) &&
        game.turnDeadline &&
        now > game.turnDeadline &&
        shouldTreatTurnDeadlineExpiryAsTimeForfeit(game)
    ) {
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
    updateChessPlacementState(game, now);
    if (game.gameStatus === 'uniform_color_roulette' && game.revealEndTime && now > game.revealEndTime) {
        game.revealEndTime = undefined;
        transitionToPlaying(game, now);
    }
    updateCaptureState(game, now);
    updateBaseState(game, now);
    /** 본경기 단계로 진입한 베이스 세션은 어떤 업데이트 단계 이후에도 흑/백 좌석이 잠금에서 벗어나선 안 된다. */
    enforceBaseSeatLockIfDriftedDuringPlay(game);
    
    const sessionPolicy = resolveArenaSessionPolicy(game);
    // PVE 계열(singleplayer/tower) 아이템 상태 갱신은 공통 어댑터를 통해 수행한다.
    if (sessionPolicy.kind === GameCategory.SinglePlayer) {
        await updateStrategicPveItemState(game, now);
        const missileStateChanged = Boolean((game as any)._missileStateChanged);
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
    } else if (sessionPolicy.kind === GameCategory.Tower) {
        await updateStrategicPveItemState(game, now);
        const missileStateChanged = updateMissileState(game, now);
        const itemTimeoutStateChanged = (game as any)._itemTimeoutStateChanged;
        if (missileStateChanged) (game as any)._missileStateChanged = true;
        if (itemTimeoutStateChanged || missileStateChanged) {
            if (itemTimeoutStateChanged) (game as any)._itemTimeoutStateChanged = false;
            const { broadcastItemPhaseSnapshot } = await import('../utils/broadcastItemPhaseSnapshot.js');
            await broadcastItemPhaseSnapshot(game);
        }
    } else {
        const hiddenStateChanged = await updateHiddenState(game, now);
        const missileStateChanged = updateMissileState(game, now);
        const itemTimeoutStateChanged = (game as any)._itemTimeoutStateChanged;
        const itemPhaseStateChanged = (game as any)._itemPhaseStateChanged;
        if (missileStateChanged) {
            (game as any)._missileStateChanged = true;
        }
        if (missileStateChanged || itemTimeoutStateChanged || hiddenStateChanged || itemPhaseStateChanged) {
            if (itemTimeoutStateChanged) {
                (game as any)._itemTimeoutStateChanged = false;
            }
            if (itemPhaseStateChanged) {
                (game as any)._itemPhaseStateChanged = false;
            }
            const { broadcastItemPhaseSnapshot } = await import('../utils/broadcastItemPhaseSnapshot.js');
            await broadcastItemPhaseSnapshot(game);
        }
    }

    // updateMissileState 등으로 같은 틱에 따내기 점수가 반영된 뒤 즉시 종료(앞선 tryEndGame은 미사일 착지 전에 실행됨)
    if (game.gameStatus === 'playing') {
        if (await tryEndGameWhenCaptureTargetReached(game, game.currentPlayer)) {
            return;
        }
    }
};

export const handleStrategicGameAction = async (volatileState: types.VolatileState, game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): Promise<types.HandleActionResult | undefined> => {
    // 페어 착수 순서 확인(pair_order_reveal)만 여기서 처리한다.
    // nigiri_reveal / color_start_confirmation 등은 handleSharedAction으로 넘겨야 한다.
    // (이전에는 pair_order_reveal가 아닐 때 빈 {}로 조기 return 해 니기리·색 확인이 서버에 반영되지 않음)
    if (
        (action as any).type === 'CONFIRM_COLOR_START' &&
        isPairClassicGame(game.settings, game.mode) &&
        game.settings.pairGame?.turnOrder?.length &&
        game.gameStatus === 'pair_order_reveal'
    ) {
        const humanIds = game.settings.pairGame.turnOrder
            .filter((s) => s.kind === 'user')
            .map((s) => s.participantId);
        if (!humanIds.includes(user.id)) {
            return { error: '페어 순서 확인 대상이 아닙니다.' };
        }
        confirmPairOrderReveal(game.settings, user.id);
        game.preGameConfirmations = { ...(game.settings.pairGame?.orderRevealConfirmed ?? {}) };
        updatePairOrderRevealState(game, Date.now());
        return {};
    }

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

    result = await handleMissileAction(game, action, user);
    if (result) return result;
    
    // Fallback to standard actions if no other handler caught it.
    const standardResult = await handleStandardAction(volatileState, game, action, user);
    if(standardResult) return standardResult;
    
    return undefined;
};

const strategicTurnActionQueues = new Map<string, Promise<unknown>>();

async function runStrategicTurnActionSerial<T>(gameId: string, task: () => Promise<T>): Promise<T> {
    const previous = strategicTurnActionQueues.get(gameId) ?? Promise.resolve();
    const nextTask = previous.catch(() => undefined).then(task);
    const queueTail = nextTask.finally(() => {
        if (strategicTurnActionQueues.get(gameId) === queueTail) {
            strategicTurnActionQueues.delete(gameId);
        }
    });
    strategicTurnActionQueues.set(gameId, queueTail);
    return nextTask;
}

const handleStandardAction = async (
    volatileState: types.VolatileState,
    game: types.LiveGameSession,
    action: types.ServerAction,
    user: types.User
): Promise<types.HandleActionResult | null> => {
    const actionType = (action as any)?.type as string | undefined;
    const shouldSerializeTurnAction = actionType === 'PLACE_STONE' || actionType === 'PASS_TURN' || actionType === 'CHESS_MOVE_PIECE';
    if (!shouldSerializeTurnAction) {
        return handleStandardActionCore(volatileState, game, action, user);
    }
    return runStrategicTurnActionSerial(game.id, async () =>
        handleStandardActionCore(volatileState, game, action, user)
    );
};


// Keep the original standard action handler, but rename it to avoid conflicts.
const handleStandardActionCore = async (volatileState: types.VolatileState, game: types.LiveGameSession, action: types.ServerAction, user: types.User): Promise<types.HandleActionResult | null> => {
    const { type, payload } = action as any;
    const now = Date.now();
    /** 베이스 본경기 좌석 잠금이 어긋나 있으면 액션 처리 직전에 잠금값으로 돌려놓는다(흑/백 영구 스왑 방지). */
    enforceBaseSeatLockIfDriftedDuringPlay(game);
    const pairClassicGame = isPairClassicGame(game.settings, game.mode);
    const pairCurrentSeat = pairClassicGame ? getCurrentPairTurnSeat(game.settings) : null;
    const sessionPolicy = resolveArenaSessionPolicy(game);
    const myPlayerEnum = pairCurrentSeat
        ? user.id === pairCurrentSeat.participantId
            ? pairCurrentSeat.player
            : types.Player.None
        : user.id === game.blackPlayerId
          ? types.Player.Black
          : user.id === game.whitePlayerId
            ? types.Player.White
            : types.Player.None;
    const isMyTurn = pairCurrentSeat
        ? user.id === pairCurrentSeat.participantId && pairCurrentSeat.player === game.currentPlayer
        : myPlayerEnum === game.currentPlayer;
    const resolveFixedScoringTurnState = () => resolveArenaTurnLimitState(game);

    if (type === 'REQUEST_STRATEGIC_PET_HINT') {
        const { handleStrategicPetHintRequest } = await import('../strategicPetHintAction.js');
        return handleStrategicPetHintRequest(game, user, {
            pairClassicGame,
            isMyTurn,
            myPlayerEnum,
        });
    }

    if (type === 'CLAIM_STRATEGIC_PET_HINT_BONUS') {
        if (!isMyTurn || myPlayerEnum === types.Player.None) return null;
        const { handleStrategicPetHintBonusClaim } = await import('../strategicPetHintAction.js');
        return handleStrategicPetHintBonusClaim(game, user, {
            x: Number(payload?.x),
            y: Number(payload?.y),
            expectedMoveHistoryLength: Number(payload?.expectedMoveHistoryLength),
            missileLand: payload?.missileLand === true,
        });
    }

    switch (type) {
        case 'PLACE_CHESS_SETUP_PIECE':
        case 'REMOVE_CHESS_SETUP_PIECE':
        case 'RESET_CHESS_SETUP_PLACEMENT':
        case 'FILL_CHESS_SETUP_RANDOMLY':
        case 'CONFIRM_CHESS_SETUP_PLACEMENT': {
            const placementResult = await handleChessPlacementAction(game, user, action, now);
            if (placementResult.error) return { error: placementResult.error };
            return {};
        }
        case 'CHESS_MOVE_PIECE': {
            if (!isMyTurn || myPlayerEnum === types.Player.None) {
                return { error: 'Not your turn.' };
            }
            if (!sessionUsesChessGo(game) || game.gameStatus !== 'playing') {
                return { error: 'Invalid chess move.' };
            }
            const pieceId = String(payload?.pieceId ?? '');
            const toX = Number(payload?.toX);
            const toY = Number(payload?.toY);
            if (!pieceId || !Number.isFinite(toX) || !Number.isFinite(toY)) {
                return { error: 'Invalid chess move payload.' };
            }
            const result = await handleChessMoveAction(game, user, { pieceId, toX, toY });
            if (result.error) return { error: result.error };
            repairChessGoSessionState(game);
            return {};
        }
        case 'PLACE_STONE': {
            // 계가까지 수순이 고정된 모드에서는 제한 수순이 이미 채워졌다면 추가 착수를 차단한다.
            const { fixedScoringTurnLimit, currentTurnCount } = await resolveFixedScoringTurnState();
            if (fixedScoringTurnLimit != null && fixedScoringTurnLimit > 0) {
                if (currentTurnCount >= fixedScoringTurnLimit) {
                    game.totalTurns = currentTurnCount;
                    if ((game.gameStatus as string) !== 'scoring' && (game.gameStatus as string) !== 'ended') {
                        game.gameStatus = 'scoring';
                        await db.saveGame(game);
                        try {
                            if (arenaUsesClientAuthoritativeScoringSnapshot(game)) {
                                deferGetGameResultForScoringOverlay(game.id, 'blockExtraMoveOverTurnLimit');
                            } else {
                                await getGameResult(game);
                            }
                        } catch (e: any) {
                            console.error(`[handleStandardAction] Failed to auto-trigger scoring while blocking extra move, game ${game.id}:`, e?.message);
                        }
                    }
                    return { error: '정해진 수순이 모두 완료되어 더 이상 돌을 놓을 수 없습니다.' };
                }
            }

            // triggerAutoScoring 플래그가 있으면 계가를 트리거
            if (payload.triggerAutoScoring) {
                if (pairClassicGame) {
                    const pairTurnLimit = await resolveArenaFixedScoringTurnLimit(game);
                    const pairTotalTurns = getArenaTurnCount(game);
                    game.totalTurns = pairTotalTurns;
                    if (pairTurnLimit == null || pairTotalTurns < pairTurnLimit) {
                        console.warn(
                            `[handleStandardAction] Ignored triggerAutoScoring for pair game ${game.id}; turn limit not reached (${pairTotalTurns}/${pairTurnLimit ?? 'none'}). Voluntary scoring still requires all 4 seats to pass.`,
                        );
                        return {};
                    }
                }
                // 온라인 전략바둑/PVP/AI 대국에서는 항상 서버의 게임 상태를 기준으로 계가해야 함
                // (클라이언트가 새로고침 후 잘못된 boardState를 보내면 오계가 발생할 수 있음)
                const isClientAuthoritative = arenaUsesClientAuthoritativeScoringSnapshot(game);

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
                
                // 0/N 도달 검증은 경기장 정책의 PASS 포함 여부를 단일 기준으로 사용한다.
                const totalTurns = getArenaTurnCount(game);
                game.totalTurns = totalTurns;
                const autoScoringTurns = await resolveArenaFixedScoringTurnLimit(game);
                const remainingTurns = autoScoringTurns != null ? Math.max(0, autoScoringTurns - totalTurns) : 0;
                if (autoScoringTurns != null && remainingTurns > 0) {
                    console.warn(`[handleStandardAction] triggerAutoScoring ignored: remainingTurns=${remainingTurns} (totalTurns=${totalTurns}, autoScoringTurns=${autoScoringTurns})`);
                    return {};
                }
                
                game.gameStatus = 'scoring';
                await db.saveGame(game);
                console.log(`[handleStandardAction] Game ${game.id} set to scoring state (0/N reached), calling getGameResult...`);
                if (isClientAuthoritative) {
                    deferGetGameResultForScoringOverlay(game.id, 'triggerAutoScoring');
                } else {
                    try {
                        await getGameResult(game);
                        console.log(`[handleStandardAction] getGameResult completed for game ${game.id}`);
                    } catch (error) {
                        console.error(`[handleStandardAction] Error in getGameResult for game ${game.id}:`, error);
                        throw error;
                    }
                }
                return {};
            }

            // 다음 턴이 AI인 경우: 클라이언트가 계가 직전 유저 소요시간·수순만 동기화 → 동기화 후 남은 턴 0이면 즉시 계가(getGameResult가 히든이면 공개 단계로 분기)
            if (payload.syncTimeAndStateForScoring && (game.isSinglePlayer || game.gameCategory === GameCategory.Tower)) {
                if (payload.moveHistory && Array.isArray(payload.moveHistory)) game.moveHistory = payload.moveHistory;
                const isHiddenModeSync =
                    game.mode === types.GameMode.Hidden ||
                    (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Hidden));
                if (!isHiddenModeSync && payload.boardState && Array.isArray(payload.boardState)) game.boardState = payload.boardState;
                if (isHiddenModeSync && payload.permanentlyRevealedStones != null && Array.isArray(payload.permanentlyRevealedStones)) {
                    if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                    for (const p of payload.permanentlyRevealedStones) {
                        if (
                            typeof p.x === 'number' &&
                            typeof p.y === 'number' &&
                            !game.permanentlyRevealedStones.some((q: { x: number; y: number }) => q.x === p.x && q.y === p.y)
                        ) {
                            game.permanentlyRevealedStones.push({ x: p.x, y: p.y });
                        }
                    }
                }
                if (payload.totalTurns !== undefined) game.totalTurns = payload.totalTurns;
                if (payload.blackTimeLeft !== undefined) game.blackTimeLeft = payload.blackTimeLeft;
                if (payload.whiteTimeLeft !== undefined) game.whiteTimeLeft = payload.whiteTimeLeft;
                if (payload.captures && typeof payload.captures === 'object') {
                    game.captures = { ...(game.captures || {}), ...payload.captures };
                }
                if (payload.hiddenMoves != null && typeof payload.hiddenMoves === 'object') {
                    game.hiddenMoves = { ...payload.hiddenMoves };
                }
                const totalTurnsSync = getArenaTurnCount(game);
                game.totalTurns = totalTurnsSync;
                const autoScoringTurnsSync = await resolveArenaFixedScoringTurnLimit(game);
                const remainingTurnsSync = autoScoringTurnsSync != null ? Math.max(0, autoScoringTurnsSync - totalTurnsSync) : 0;
                if (autoScoringTurnsSync != null && remainingTurnsSync <= 0) {
                    if (game.endTime == null) game.endTime = Date.now();
                    try {
                        await getGameResult(game);
                    } catch (error) {
                        console.error(`[handleStandardAction] getGameResult after syncTimeAndStateForScoring failed for game ${game.id}:`, error);
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

            const {
                x,
                y,
                isHidden,
                boardState: clientBoardState,
                moveHistory: clientMoveHistory,
                hiddenMoves: clientHiddenMoves,
                humanHiddenStonePoints: clientHumanHiddenStonePoints,
            } = payload;
            // START_HIDDEN_PLACEMENT으로 들어온 착수는 반드시 히든 1회 소모·히든 수로 기록한다.
            // (아이템 타이머 만료 직후 레이스, 클라 isHidden 불일치 시 재고가 줄지 않고 무한 사용되던 버그 수정)
            const effectiveIsHidden = game.gameStatus === 'hidden_placing';
            
            // 치명적 버그 방지: 패 위치(-1, -1)에 PLACE_STONE을 보내는 것을 차단
            // (클라이언트 AI 패스는 PASS_TURN 액션으로 처리)
            if (x === -1 || y === -1) {
                console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone at pass position (${x}, ${y}), gameId=${game.id}, isSinglePlayer=${game.isSinglePlayer}, gameCategory=${game.gameCategory}`);
                return { error: '패 위치에는 돌을 놓을 수 없습니다. 패를 하려면 PASS_TURN 액션을 사용하세요.' };
            }

            if (sessionUsesChessGo(game)) {
                repairChessGoSessionState(game);
            }
            
            // 치명적 버그 방지: 보드 범위를 벗어나는 위치에 돌을 놓으려는 시도 차단
            const boardSize =
                sessionUsesChessGo(game)
                    ? (game.settings.boardSize ?? CHESS_GO_BOARD_SIZE)
                    : game.settings.boardSize;
            if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) {
                console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone out of bounds (${x}, ${y}), boardSize=${boardSize}, gameId=${game.id}, isSinglePlayer=${game.isSinglePlayer}, gameCategory=${game.gameCategory}`);
                return { error: `보드 범위를 벗어난 위치입니다. (${x}, ${y})는 유효하지 않습니다.` };
            }
            
            const opponentPlayerEnum = myPlayerEnum === types.Player.Black ? types.Player.White : (myPlayerEnum === types.Player.White ? types.Player.Black : types.Player.None);
            
            // 싱글플레이/도전의탑/AI 게임에서는 서버의 실제 boardState를 기준으로 체크 (클라이언트 boardState를 신뢰하지 않음)
            // 전략바둑 AI 대국에서 돌이 사라지는 버그 방지: 서버가 단일 소스로 유지
            let serverBoardState = game.boardState;
            let serverMoveHistory = game.moveHistory;
            
            if (
                (sessionPolicy.kind === GameCategory.Tower || sessionPolicy.kind === GameCategory.SinglePlayer) &&
                Array.isArray(clientBoardState) &&
                clientBoardState.length > 0 &&
                Array.isArray(clientMoveHistory) &&
                (isHidden === true || effectiveIsHidden)
            ) {
                // PVE 히든 착수는 일반 수가 클라이언트에서 먼저 진행된다. 서버는 클릭 당시의
                // 착수 전 스냅샷에서 다시 한 번 같은 수를 처리해, hiddenMoves 인덱스를 방금 둔 수에 붙인다.
                serverBoardState = clientBoardState;
                serverMoveHistory = clientMoveHistory;
                if (clientHiddenMoves && typeof clientHiddenMoves === 'object') {
                    game.hiddenMoves = { ...clientHiddenMoves };
                }
                if (Array.isArray(clientHumanHiddenStonePoints)) {
                    (game as any).humanHiddenStonePoints = clientHumanHiddenStonePoints.map((point: types.Point & { player?: types.Player }) => ({ ...point }));
                }
            } else if (
                game.isSinglePlayer ||
                game.gameCategory === GameCategory.Tower ||
                game.isAiGame ||
                (game as any).gameCategory === 'guildwar'
            ) {
                // 싱글플레이, 도전의 탑, 길드전, 전략바둑 AI 대국에서는 서버의 실제 boardState를 사용
                const { getLiveGame } = await import('../db.js');
                const freshGame = await getLiveGame(game.id);
                if (freshGame) {
                    serverBoardState = freshGame.boardState;
                    serverMoveHistory = freshGame.moveHistory;
                    // board/moveHistory만 DB와 맞추고 hiddenMoves 등은 옛 메모리를 쓰면 상대 히idden 칸이 일반 착수로 처리될 수 있음 (전략 AI 대기실 등)
                    if (freshGame.hiddenMoves != null) {
                        game.hiddenMoves = { ...freshGame.hiddenMoves };
                    }
                    if (Array.isArray(freshGame.permanentlyRevealedStones)) {
                        game.permanentlyRevealedStones = [...freshGame.permanentlyRevealedStones];
                    }
                    if (freshGame.revealedHiddenMoves != null) {
                        game.revealedHiddenMoves = { ...freshGame.revealedHiddenMoves } as any;
                    }
                    const fg = freshGame as any;
                    const gg = game as any;
                    if (fg.aiInitialHiddenStone !== undefined) gg.aiInitialHiddenStone = fg.aiInitialHiddenStone;
                    if (fg.aiInitialHiddenStoneIsPrePlaced !== undefined) gg.aiInitialHiddenStoneIsPrePlaced = fg.aiInitialHiddenStoneIsPrePlaced;
                    if (fg.scannedAiInitialHiddenByUser != null) {
                        gg.scannedAiInitialHiddenByUser = { ...fg.scannedAiInitialHiddenByUser };
                    }
                }
            }

            if (sessionUsesChessGo(game)) {
                serverBoardState = game.boardState;
            }
            
            // 범위 체크 후에만 boardState에 접근
            const stoneAtTarget = serverBoardState[y][x];
            
            // 싱글플레이/도전의 탑/길드전/AI 대국은 서버 boardState를 우선 사용한다.
            const usedPveClientHiddenAuthoritativeSync =
                (sessionPolicy.kind === GameCategory.Tower || sessionPolicy.kind === GameCategory.SinglePlayer) &&
                Array.isArray(clientBoardState) &&
                clientBoardState.length > 0 &&
                Array.isArray(clientMoveHistory) &&
                (isHidden === true || effectiveIsHidden);

            if (
                game.isSinglePlayer ||
                game.gameCategory === GameCategory.Tower ||
                game.isAiGame ||
                (game as any).gameCategory === 'guildwar'
            ) {
                game.boardState = serverBoardState;
                game.moveHistory = serverMoveHistory;
            }

            if (
                usedPveClientHiddenAuthoritativeSync &&
                mixGoPveHiddenPlacementAlreadyCommitted(game, x, y, myPlayerEnum)
            ) {
                return await finalizePveHiddenPlacementFromAuthoritativeClient(
                    game,
                    now,
                    user,
                    myPlayerEnum,
                    opponentPlayerEnum,
                    x,
                    y,
                    pairCurrentSeat,
                );
            }
            // PVP: 클라이언트 boardState를 덮어쓰지 않으므로 game.boardState는 캐시(서버) 상태 유지.
            // 낙관적 업데이트로 이미 둔 수를 보내면 finalStoneCheck에서 거절되어 턴이 안 넘어가는 버그 방지.

            const isChessGoPlacement = sessionUsesChessGo(game);
            if (isChessGoPlacement) {
                if (!isPlayableChessGoIntersection(game, x, y)) {
                    if (process.env.NODE_ENV === 'development') {
                        console.warn(
                            `[handleStandardAction] Chess go: unplayable intersection at (${x}, ${y}), gameId=${game.id}`,
                        );
                    }
                    return { error: '이미 돌이 놓인 자리입니다.' };
                }
            } else {
                const placementBlockReason = getPlacementOccupancyBlockReason(
                    game.boardState,
                    game,
                    x,
                    y,
                    myPlayerEnum,
                );
                if (placementBlockReason === 'opponent') {
                    console.error(
                        `[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone on opponent stone at (${x}, ${y}), gameId=${game.id}, stoneAtTarget=${stoneAtTarget}, opponentPlayerEnum=${opponentPlayerEnum}, isSinglePlayer=${game.isSinglePlayer}, gameCategory=${game.gameCategory}`,
                    );
                    return { error: '상대방이 둔 자리에는 돌을 놓을 수 없습니다.' };
                }
                if (placementBlockReason === 'own' || stoneAtTarget === myPlayerEnum) {
                    console.error(
                        `[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone on own stone at (${x}, ${y}), gameId=${game.id}, stoneAtTarget=${stoneAtTarget}, myPlayerEnum=${myPlayerEnum}`,
                    );
                    return { error: '이미 돌이 놓인 자리입니다.' };
                }
                if (stoneAtTarget !== types.Player.None) {
                    console.error(
                        `[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone on occupied position at (${x}, ${y}), gameId=${game.id}, stoneAtTarget=${stoneAtTarget}`,
                    );
                    return { error: '이미 돌이 놓인 자리입니다.' };
                }
            }

            const move = {
                x,
                y,
                player: myPlayerEnum,
                ...(pairCurrentSeat ? { actorId: pairCurrentSeat.participantId, pairSeatId: pairCurrentSeat.seatId } : {}),
            };
            
            // 치명적 버그 방지: 자신의 돌 위에 착점 시도 차단 (모든 게임 모드)
            const finalStoneCheck = game.boardState[y][x];
            if (finalStoneCheck === myPlayerEnum) {
                console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: Attempted to place stone on own stone at (${x}, ${y}), gameId=${game.id}, finalStoneCheck=${finalStoneCheck}, myPlayerEnum=${myPlayerEnum}`);
                return { error: '이미 자신의 돌이 놓인 자리입니다.' };
            }
            
            // 싱글플레이/도전의 탑/AI 대국에서 상대 돌 위 착점은 숨김돌 공개 케이스 외에는 차단
            if (game.isSinglePlayer || game.gameCategory === GameCategory.Tower || game.isAiGame) {
                if (finalStoneCheck === opponentPlayerEnum) {
                    console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: AI stone detected at (${x}, ${y}) before processMove, gameId=${game.id}, finalStoneCheck=${finalStoneCheck}, opponentPlayerEnum=${opponentPlayerEnum}`);
                    return { error: 'AI가 둔 자리에는 돌을 놓을 수 없습니다.' };
                }
            }
            
            if (effectiveIsHidden) {
                // 히든 아이템 개수 확인 및 감소 (스캔 아이템처럼)
                // p1/p2는 흑/백을 의미한다 — player1 좌석과 무관 (페어바둑 파트너 user.id가 player1.id와 다른 경우 대비)
                const myIsBlack = myPlayerEnum === types.Player.Black;
                const hiddenKey = myIsBlack ? 'hidden_stones_p1' : 'hidden_stones_p2';
                if ((game as any).gameCategory === 'tower' && hiddenKey === 'hidden_stones_p1' && game.player1?.id === user.id) {
                    const { syncTowerP1ConsumableSessionFromInventory } = await import('./towerPlayerHidden.js');
                    syncTowerP1ConsumableSessionFromInventory(game, user, 'hidden');
                }
                const currentHidden = game[hiddenKey] ?? game.settings.hiddenStoneCount ?? 0;
                if (currentHidden <= 0) {
                    return { error: "No hidden stones left." };
                }
                game[hiddenKey] = currentHidden - 1;
                
                // 사용 횟수도 추적 (통계용)
                const usedKey = myIsBlack ? 'hidden_stones_used_p1' : 'hidden_stones_used_p2';
                game[usedKey] = (game[usedKey] || 0) + 1;
            }

            const isCastleGame = game.mode === types.GameMode.Castle;
            const isChessGame = sessionUsesChessGo(game);
            if (isChessGame) {
                repairChessGoSessionState(game);
            }
            const result = isCastleGame
                ? processCastleMove(
                      game,
                      game.boardState,
                      move,
                      game.koInfo,
                      game.moveHistory.length,
                  )
                : isChessGame
                  ? processChessGoMove(game, move, game.koInfo, game.moveHistory.length)
                  : processMove(
                game.boardState, 
                move, 
                game.koInfo, 
                game.moveHistory.length,
                { 
                    ignoreSuicide: false,
                    isSinglePlayer: game.isSinglePlayer || game.gameCategory === GameCategory.Tower || game.isAiGame,
                    opponentPlayer: (game.isSinglePlayer || game.gameCategory === GameCategory.Tower || game.isAiGame) ? opponentPlayerEnum : undefined
                }
            );
            
            // processMove 결과 검증 (싱글플레이/도전의탑/AI 대국)
            if ((game.isSinglePlayer || game.gameCategory === GameCategory.Tower || game.isAiGame) && result.isValid) {
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
                    errorMessage = '패 모양입니다. 바로 다시 따낼 수 없습니다.';
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
            const aiInitialHiddenCellTracking = useAiInitialHiddenCellTracking(game);
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
                    let isHiddenStone = isCurrentMove ? effectiveIsHidden : false;
                    if (!isCurrentMove) {
                        const moveIndex = findLatestMoveIndexAt(game, nx, ny, myPlayerEnum);
                        isHiddenStone = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
                        if (!isHiddenStone && aiInitialHiddenCellTracking && (game as any).aiInitialHiddenStone) {
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
                    const moveIndex = findLatestMoveIndexAt(game, capturedStone.x, capturedStone.y, opponentPlayerEnum);
                    if (moveIndex !== -1 && game.hiddenMoves?.[moveIndex]) {
                        const isPermanentlyRevealed = game.permanentlyRevealedStones?.some(p => p.x === capturedStone.x && p.y === capturedStone.y);
                        if (!isPermanentlyRevealed) {
                            capturedHiddenStones.push({ point: capturedStone, player: opponentPlayerEnum });
                        }
                    }
                }
            }
            
            // AI 초기 히든돌이 따내진 경우 확인
            if (useAiInitialHiddenSyntheticCaptureHistory(game) && (game as any).aiInitialHiddenStone) {
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
            const uniqueStonesToReveal = expandHiddenRevealStonesForGame(
                game,
                Array.from(new Map(allStonesToReveal.map(item => [JSON.stringify(item.point), item])).values())
            );
            
            if (uniqueStonesToReveal.length > 0) {
                adventureRevealAllHumanHiddensIfInvolved(game, uniqueStonesToReveal);
                const captureRevealDurationMs = resolveHiddenRevealDurationMs(game, uniqueStonesToReveal);
                game.gameStatus = 'hidden_reveal_animating';
                game.animation = {
                    type: 'hidden_reveal',
                    stones: uniqueStonesToReveal,
                    startTime: now,
                    duration: captureRevealDurationMs,
                };
                game.revealAnimationEndTime = now + captureRevealDurationMs;
                game.pendingCapture = { stones: result.capturedStones, move, hiddenContributors: contributingHiddenStones.map(c => c.point) };
            
                game.lastMove = { x, y };
                game.lastTurnStones = null;
                game.moveHistory.push(move);
                if (isChessGame) {
                    commitChessGoPlacementCaptures(game, x, y, result.capturedStones);
                }
                if (effectiveIsHidden) {
                    if (!game.hiddenMoves) game.hiddenMoves = {};
                    game.hiddenMoves[game.moveHistory.length - 1] = true;
                    const humanHiddenStonePoints = ((game as any).humanHiddenStonePoints ?? []) as Array<types.Point & { player?: types.Player }>;
                    (game as any).humanHiddenStonePoints = [
                        ...humanHiddenStonePoints.filter((point) => !(point.x === x && point.y === y && point.player === myPlayerEnum)),
                        { x, y, player: myPlayerEnum },
                    ];
                }
                const petHintBonusResult = await (async () => {
                    const { handleStrategicPetHintBonusClaim } = await import('../strategicPetHintAction.js');
                    return handleStrategicPetHintBonusClaim(game, user, {
                        x,
                        y,
                        expectedMoveHistoryLength: game.moveHistory.length,
                    });
                })();
            
                game.boardState = result.newBoardState;
            
                if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                uniqueStonesToReveal.forEach(s => {
                    if (!game.permanentlyRevealedStones!.some(p => p.x === s.point.x && p.y === s.point.y)) {
                        game.permanentlyRevealedStones!.push(s.point);
                    }
                });
            
                if (shouldEnforceTimeControl(game)) {
                    freezeMainTurnClock(game, now);
                }
                return petHintBonusResult ?? {};
            }


            game.boardState = result.newBoardState;
            if (isCastleGame) {
                applyCastleTerritoryAfterMove(game);
            }
            // 히든 착수 시 lastMove를 갱신하지 않음 (새로고침 후 마지막 수 표시가 히든 돌 위치로 겹치는 버그 방지)
            if (!effectiveIsHidden) {
                game.lastMove = { x, y };
            }
            game.lastTurnStones = null;
            game.moveHistory.push(move);
            if (isChessGame) {
                commitChessGoPlacementCaptures(game, x, y, result.capturedStones);
            }
            game.koInfo = result.newKoInfo;
            game.passCount = 0;
            if (pairCurrentSeat) resetPairPasses(game.settings);
            invalidateScoringPrecompute(game.id);
            // 이전 턴 justCaptured가 WS에 남으면 클라이언트가 매 수마다 점수 플로트를 재생한다.
            game.justCaptured = [];

            if (effectiveIsHidden) {
                if (!game.hiddenMoves) game.hiddenMoves = {};
                game.hiddenMoves[game.moveHistory.length - 1] = true;
                const humanHiddenStonePoints = ((game as any).humanHiddenStonePoints ?? []) as Array<types.Point & { player?: types.Player }>;
                (game as any).humanHiddenStonePoints = [
                    ...humanHiddenStonePoints.filter((point) => !(point.x === x && point.y === y && point.player === myPlayerEnum)),
                    { x, y, player: myPlayerEnum },
                ];
            }

            const petHintBonusResult = await (async () => {
                const { handleStrategicPetHintBonusClaim } = await import('../strategicPetHintAction.js');
                return handleStrategicPetHintBonusClaim(game, user, {
                    x,
                    y,
                    expectedMoveHistoryLength: game.moveHistory.length,
                });
            })();

            if (result.capturedStones.length > 0) {
                // 길드전 별 판정(한 번에 따낸 최대 개수) 정확도를 위해 실시간 최대값 저장
                const captureCountThisMove = result.capturedStones.length;
                const maxSingleCaptureByPlayer = ((game as any).maxSingleCaptureByPlayer ??= {});
                const prevMaxForPlayer = Number(maxSingleCaptureByPlayer[myPlayerEnum] ?? 0) || 0;
                if (captureCountThisMove > prevMaxForPlayer) {
                    maxSingleCaptureByPlayer[myPlayerEnum] = captureCountThisMove;
                }
                let guildWarCapturePointsThisMove = 0;

                if (isChessGame) {
                    for (const stone of result.capturedStones) {
                        const points = getChessGoStoneCapturePointValue(game, stone);
                        game.captures[myPlayerEnum] += points;
                        guildWarCapturePointsThisMove += points;
                        game.justCaptured.push({
                            point: stone,
                            player: opponentPlayerEnum,
                            wasHidden: false,
                            capturePoints: points,
                        });
                    }
                    const chessCapture = applyChessCaptureScoreForRemovedStones(
                        game,
                        result.capturedStones,
                        myPlayerEnum,
                    );
                    if (chessCapture.kingCaptured) {
                        if (await tryEndChessOnKingCapture(game, myPlayerEnum)) {
                            return petHintBonusResult ?? {};
                        }
                    }
                } else {
                for (const stone of result.capturedStones) {
                    const capturedPlayerEnum = opponentPlayerEnum;
                    
                    let points = 1;
                    let wasHiddenForJustCaptured = false; // default for justCaptured
                    let isBaseStone = false;

                    if (
                        game.isSinglePlayer ||
                        (game as any).gameCategory === 'guildwar' ||
                        (game as any).gameCategory === 'tower' ||
                        game.gameCategory === GameCategory.Adventure
                    ) {
                        isBaseStone = isIntersectionRecordedAsBaseStone(game, stone.x, stone.y);
                        if (isBaseStone) {
                            game.baseStoneCaptures[myPlayerEnum]++;
                            points = 5;
                            recordPatternStoneConsumed(game, stone);
                        } else if (consumeOpponentPatternStoneIfAny(game, stone, capturedPlayerEnum)) {
                            points = 2;
                        } else {
                            // 동일 좌표 재착수 시 과거(가장 이른) 수순을 보지 않도록,
                            // 실제로 따낸 돌의 "최신 상대 수순" 기준으로 히든 여부를 판정한다.
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
                                !!(game as any).aiInitialHiddenStone &&
                                (game as any).aiInitialHiddenStone.x === stone.x &&
                                (game as any).aiInitialHiddenStone.y === stone.y;
                            const wasRevealedHidden = !!game.permanentlyRevealedStones?.some(
                                (p) => p.x === stone.x && p.y === stone.y
                            );
                            wasHiddenForJustCaptured = wasHidden || wasAiInitialHidden || wasRevealedHidden;
                            if (wasHidden || wasAiInitialHidden || wasRevealedHidden) {
                                if (!game.hiddenStoneCaptures) {
                                    game.hiddenStoneCaptures = {
                                        [types.Player.None]: 0,
                                        [types.Player.Black]: 0,
                                        [types.Player.White]: 0,
                                    };
                                }
                                game.hiddenStoneCaptures[myPlayerEnum]++;
                                points = 5;
                                recordPatternStoneConsumed(game, stone);
                                if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                                if (!game.permanentlyRevealedStones.some((p) => p.x === stone.x && p.y === stone.y)) {
                                    game.permanentlyRevealedStones.push(stone);
                                }
                            }
                        }
                    } else { // PvP logic
                        isBaseStone = isIntersectionRecordedAsBaseStone(game, stone.x, stone.y);
                        let moveIndex = -1;
                        for (let i = (game.moveHistory?.length ?? 0) - 1; i >= 0; i--) {
                            const m = game.moveHistory![i];
                            if (m.x === stone.x && m.y === stone.y && m.player === capturedPlayerEnum) {
                                moveIndex = i;
                                break;
                            }
                        }
                        const wasHidden = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
                        const wasRevealedHidden = !!game.permanentlyRevealedStones?.some(
                            (p) => p.x === stone.x && p.y === stone.y
                        );
                        wasHiddenForJustCaptured = wasHidden || wasRevealedHidden; // pass to justCaptured

                        if (isBaseStone) {
                            game.baseStoneCaptures[myPlayerEnum]++;
                            points = 5;
                            recordPatternStoneConsumed(game, stone);
                        } else if (consumeOpponentPatternStoneIfAny(game, stone, capturedPlayerEnum)) {
                            points = 2;
                        } else if (wasHidden || wasRevealedHidden) {
                            game.hiddenStoneCaptures[myPlayerEnum]++;
                            points = 5;
                            recordPatternStoneConsumed(game, stone);
                            removeHumanHiddenStonePointsForPlayer(game, stone, capturedPlayerEnum);
                            if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                            game.permanentlyRevealedStones.push(stone);
                        }
                    }

                    game.captures[myPlayerEnum] += points;
                    guildWarCapturePointsThisMove += points;
                    game.justCaptured.push({
                        point: stone,
                        player: capturedPlayerEnum,
                        wasHidden: wasHiddenForJustCaptured,
                        capturePoints: points,
                        ...(isBaseStone ? { wasBaseStone: true as const } : {}),
                    });
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
                }
                bumpGuildWarMaxSingleCapturePointsForPlayer(game as any, myPlayerEnum, guildWarCapturePointsThisMove);
                stripPatternStonesAtConsumedIntersections(game);
                removeCapturedBaseStoneMarkersFromSession(game, result.capturedStones);
            }

            // 같은 교차점에 일반 착수 시, 과거 히든 공개 마커가 남아 문양이 꼬이지 않게 한다.
            // 베이스 마커는 실제로 따인 좌표만 위 removeCapturedBaseStoneMarkersFromSession에서 제거한다.
            if (!effectiveIsHidden) {
                if (game.permanentlyRevealedStones?.length) {
                    game.permanentlyRevealedStones = game.permanentlyRevealedStones.filter((p) => !(p.x === x && p.y === y));
                }
                clearHumanHiddenStonePointsAtIntersection(game, { x, y });
            }

            const playerWhoMoved = myPlayerEnum;
            
            if (shouldRunGoClockAccountingForSession(game)) {
                accountMainClockAfterMove(game, playerWhoMoved, now);
            }

            // 따내기 목표 달성 시 턴을 넘기기 전에 종료(상대가 한 수 더 두는 레이스 방지)
            if (await tryEndCastleOnCapture(game, myPlayerEnum, result.capturedStones.length)) {
                return petHintBonusResult ?? {};
            }
            if (await tryEndGameWhenCaptureTargetReached(game, myPlayerEnum)) {
                return petHintBonusResult ?? {};
            }

            if (pairCurrentSeat) {
                advancePairTurnAfterAction(game, now);
            } else {
                game.currentPlayer = opponentPlayerEnum;
            }
            if (isChessGame) {
                game.chessPieceMovedThisTurn = false;
                repairChessGoSessionState(game);
            }
            game.missileUsedThisTurn = false;
            
            game.gameStatus = 'playing';
            mixGoClearHiddenItemPhaseTimers(game);


            if (shouldRunGoClockAccountingForSession(game)) {
                startNextTurnClock(game, now);
            } else {
                 game.turnDeadline = undefined;
                 game.turnStartTime = undefined;
            }

            if (await tryAutoScoreCastleIfNoMoves(game)) {
                return petHintBonusResult ?? {};
            }

            // 싱글플레이/도전의 탑/길드전(히든·미사일) 자동 계가: 사용자가 돌을 놓은 후 totalTurns 업데이트 및 계가 트리거
            const autoScoringTurns = humanPvpAllowsMoveCountAutoScoring(game)
                ? await resolveArenaFixedScoringTurnLimit(game)
                : undefined;
            const isAutoScoringMode = autoScoringTurns != null && autoScoringTurns > 0;
            if (isAutoScoringMode) {
                if (autoScoringTurns !== undefined) {
                    const newTotalTurns = getArenaTurnCount(game);
                    game.totalTurns = newTotalTurns;
                    const rankedTrigger =
                        isRankedFixedTurnScoringSession(game) && shouldTriggerRankedFixedTurnScoring(game);
                    const genericTrigger =
                        !isRankedFixedTurnScoringSession(game) && newTotalTurns >= autoScoringTurns;

                    // totalTurns가 autoScoringTurns 이상이면 계가 트리거 (사용자가 마지막 수를 둔 경우)
                    if (rankedTrigger || genericTrigger) {
                        const gameType = game.gameCategory === GameCategory.Tower
                            ? 'Tower'
                            : (game as any).gameCategory === 'guildwar'
                              ? 'GuildWar'
                              : pairClassicGame
                                ? 'Pair'
                              : 'SinglePlayer';
                        console.log(`[handleStandardAction] Auto-scoring triggered (user placed last stone): totalTurns=${newTotalTurns}, autoScoringTurns=${autoScoringTurns}, ${gameType}`);
                        if (!game.isSinglePlayer) {
                            const { broadcastPlayingSnapshotBeforeScoring } = await import('../utils/broadcastPlayingBeforeScoring.js');
                            await broadcastPlayingSnapshotBeforeScoring(game);
                        }
                        game.gameStatus = 'scoring';
                        await db.saveGame(game);
                        const { broadcastToGameParticipants } = await import('../socket.js');
                        const gameToBroadcast = { ...game };
                        if (!game.isSinglePlayer) {
                            delete (gameToBroadcast as any).boardState;
                        }
                        broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);
                        if (arenaUsesClientAuthoritativeScoringSnapshot(game)) {
                            deferGetGameResultForScoringOverlay(game.id, 'autoScoringAfterUserPlaceStone');
                        } else {
                            try {
                                await getGameResult(game);
                            } catch (scoringError: any) {
                                console.error(`[handleStandardAction] Error during auto-scoring for game ${game.id}:`, scoringError?.message);
                            }
                        }
                        return petHintBonusResult ?? {};
                    }
                    
                    // totalTurns가 autoScoringTurns-1이면 다음 AI 턴이 마지막 턴
                    if (newTotalTurns === autoScoringTurns - 1) {
                        console.log(`[handleStandardAction] Last turn reached: totalTurns=${newTotalTurns}, autoScoringTurns=${autoScoringTurns}, next turn will trigger auto-scoring after AI move`);
                    }
                }
            }
            
            // 싱글플레이 따내기 바둑: 흑(유저) 턴 수 제한(blackTurnLimit) 도달 시,
            // "아직 따낸 돌 미션을 완수하지 못했을 때만" 미션 실패 처리 (살리기에서는 미적용)
            const blackTurnLimit = (game.settings as any)?.blackTurnLimit;
            if (
                game.isSinglePlayer &&
                game.stageId &&
                (game.settings as any)?.isSurvivalMode !== true &&
                blackTurnLimit !== undefined &&
                myPlayerEnum === types.Player.Black &&
                (game.gameStatus as string) !== 'ended'
            ) {
                const blackMoves = game.moveHistory.filter(m => m.player === types.Player.Black && m.x !== -1 && m.y !== -1).length;
                if (blackMoves >= blackTurnLimit) {
                    const blackTarget = game.effectiveCaptureTargets?.[types.Player.Black];
                    const hasBlackTarget = blackTarget !== undefined && blackTarget !== 999;
                    const blackCaptures = game.captures[types.Player.Black] ?? 0;

                    // 흑이 목표 따낸 돌을 이미 달성했다면 턴 제한 패배를 적용하지 않는다.
                    if (!(hasBlackTarget && blackCaptures >= blackTarget)) {
                        console.log(
                            `[handleStandardAction] SinglePlayer blackTurnLimit reached: blackMoves=${blackMoves}, limit=${blackTurnLimit}, delaying fail by 1s`
                        );
                        // UI에서 0/N을 먼저 확인할 수 있도록 1초 지연 후 실패 처리.
                        (game as any).blackTurnLimitRemaining = 0;
                        scheduleSinglePlayerBlackTurnLimitFail(game.id, 1000);
                        game.aiTurnStartTime = undefined;
                        return {};
                    }
                }
            }
            
            // AI 턴 스케줄 (모험/길드전은 큐 단일 경로)
            scheduleAiTurnAfterHumanMove(game, now);
            
            return petHintBonusResult ?? {};
        }
        case 'PASS_TURN': {
            if (!isMyTurn || game.gameStatus !== 'playing') return { error: 'Not your turn to pass.' };
            if (modeIncludesCaptureRule(game)) {
                return { error: '따내기 규칙이 포함된 대국에서는 통과할 수 없습니다.' };
            }
            if (pairClassicGame && pairCurrentSeat && !canPairHumanDeclarePass(game.settings, pairCurrentSeat)) {
                return { error: '페어 대국에서는 통과할 수 없습니다. PVP 4인 대국에서만 유저가 통과할 수 있습니다.' };
            }
            // 수순 고정 모드에서는 제한 수순 종료 후 PASS도 엄격 차단한다.
            {
                const { fixedScoringTurnLimit, currentTurnCount } = await resolveFixedScoringTurnState();
                if (fixedScoringTurnLimit != null && fixedScoringTurnLimit > 0 && currentTurnCount >= fixedScoringTurnLimit) {
                    game.totalTurns = currentTurnCount;
                    if ((game.gameStatus as string) !== 'scoring' && (game.gameStatus as string) !== 'ended') {
                        game.gameStatus = 'scoring';
                        await db.saveGame(game);
                        try {
                            if (arenaUsesClientAuthoritativeScoringSnapshot(game)) {
                                deferGetGameResultForScoringOverlay(game.id, 'blockExtraPassOverTurnLimit');
                            } else {
                                await getGameResult(game);
                            }
                        } catch (e: any) {
                            console.error(`[handleStandardAction] Failed to auto-trigger scoring while blocking extra pass, game ${game.id}:`, e?.message);
                        }
                    }
                    return { error: '정해진 수순이 모두 완료되어 더 이상 진행할 수 없습니다.' };
                }
            }
            {
                const gc = (game as any).gameCategory;
                const isAiLobbyGame =
                    game.isAiGame &&
                    !pairClassicGame &&
                    !game.isSinglePlayer &&
                    gc !== 'tower' &&
                    gc !== 'singleplayer' &&
                    gc !== 'guildwar';
                if (isAiLobbyGame) {
                    return { error: 'AI 대국에서는 통과할 수 없습니다. 정해진 수순이 끝나면 자동으로 계가됩니다.' };
                }
                if (isRankedFixedTurnScoringSession(game)) {
                    return { error: '랭킹전에서는 통과할 수 없습니다. 정해진 수순이 끝나면 자동으로 계가됩니다.' };
                }
            }
            // 통과 시 단순 코(ko) 금지 해제 — 이전 턴 koInfo가 남아 상대 다점 따내기 직후 재따내기가 막히는 버그 방지
            game.koInfo = null;
            game.justCaptured = [];
            game.passCount++;
            maybeStartAnticipatedScoringPrecompute(game);
            game.lastMove = { x: -1, y: -1 };
            game.lastTurnStones = null;
            game.moveHistory.push({
                player: myPlayerEnum,
                x: -1,
                y: -1,
                ...(pairCurrentSeat ? { actorId: pairCurrentSeat.participantId, pairSeatId: pairCurrentSeat.seatId } : {}),
            });
            const pairAllPassed = pairCurrentSeat ? markPairSeatPassed(game.settings, pairCurrentSeat) : false;
            {
                // PASS 포함 카운트 모드(scoringTurnLimit)에서는 PASS 직후에도 즉시 수순 종료 계가를 트리거한다.
                const rankedPassTrigger =
                    isRankedFixedTurnScoringSession(game) && shouldTriggerRankedFixedTurnScoring(game);
                const { fixedScoringTurnLimit, countPassAsTurn, currentTurnCount } = await resolveFixedScoringTurnState();
                const genericPassTrigger =
                    !isRankedFixedTurnScoringSession(game) &&
                    countPassAsTurn &&
                    fixedScoringTurnLimit != null &&
                    fixedScoringTurnLimit > 0 &&
                    currentTurnCount >= fixedScoringTurnLimit;
                if (rankedPassTrigger || genericPassTrigger) {
                    game.totalTurns = currentTurnCount;
                    game.gameStatus = 'scoring';
                    await db.saveGame(game);
                    if (arenaUsesClientAuthoritativeScoringSnapshot(game)) {
                        deferGetGameResultForScoringOverlay(game.id, 'passTurnScoringTurnLimit');
                    } else {
                        try {
                            await getGameResult(game);
                        } catch (e: any) {
                            console.error(`[handleStandardAction] getGameResult failed after PASS_TURN scoringTurnLimit for game ${game.id}:`, e?.message);
                        }
                    }
                    return {};
                }
            }

            if (
                !isRankedFixedTurnScoringSession(game) &&
                (pairAllPassed || (!pairClassicGame && game.passCount >= 2))
            ) {
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
                                        !isPermanentlyRevealed
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
                            duration: 1500
                        };
                        game.revealAnimationEndTime = now + 1500;
                        if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                        game.permanentlyRevealedStones.push(...unrevealedStones.map(s => s.point));
                    } else {
                        try {
                            await getGameResult(game);
                        } catch (e: any) {
                            console.error(
                                `[handleStandardAction] getGameResult failed after mutual PASS_TURN (hidden, no reveal) for game ${game.id}:`,
                                e?.message,
                            );
                        }
                    }
                } else {
                    try {
                        await getGameResult(game);
                    } catch (e: any) {
                        console.error(
                            `[handleStandardAction] getGameResult failed after mutual PASS_TURN for game ${game.id}:`,
                            e?.message,
                        );
                    }
                }
            } else {
                const playerWhoMoved = myPlayerEnum;
                if (shouldRunGoClockAccountingForSession(game)) {
                    accountMainClockAfterMove(game, playerWhoMoved, now);
                }
                if (pairCurrentSeat) {
                    advancePairTurnAfterAction(game, now);
                } else {
                    game.currentPlayer = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
                }
                if (shouldRunGoClockAccountingForSession(game)) {
                    startNextTurnClock(game, now);
                } else {
                    game.turnDeadline = undefined;
                    game.turnStartTime = undefined;
                }
                scheduleAiTurnAfterHumanMove(game, now);
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
