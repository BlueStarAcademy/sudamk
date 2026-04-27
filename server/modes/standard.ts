import * as summaryService from '../summaryService.js';
import * as types from '../../types/index.js';
import { GameCategory } from '../../types/enums.js';
import * as db from '../db.js';
import { getGoLogic, processMove } from '../goLogic.js';
import { getGameResult } from '../gameModes.js';
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
import { handleSharedAction, transitionToPlaying, hasTimeControl, shouldEnforceTimeControl } from './shared.js';
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
import { tryEndGameWhenCaptureTargetReached } from '../utils/captureTargets.js';
import { getRegionalCaptureOpponentTargetBonus } from '../../utils/adventureRegionalSpecialtyBuff.js';
import { adventureEncounterCountdownUiActive } from '../../shared/utils/adventureEncounterUi.js';
import {
    skipPendingCaptureForAdventureHiddenReveal,
    shouldPreserveDiscovererTurnAfterOpponentHiddenReveal,
    treatAsPveLikeForHiddenOpponentReveal,
    useAiInitialHiddenCellTracking,
    useAiInitialHiddenSyntheticCaptureHistory,
} from './hiddenRevealPolicy.js';
import { isHiddenMoveIndexSoftRevealedByAnyPlayer } from './hiddenScanShared.js';
import { PVE_STRATEGIC_SERVER_AI_POST_HUMAN_DELAY_MS } from '../constants/pveStrategicAiSchedule.js';
import { getEffectiveSinglePlayerStages } from '../singlePlayerStageConfigService.js';

const STRATEGIC_GO_SERVER_AI_MODES: types.GameMode[] = [
    types.GameMode.Standard,
    types.GameMode.Capture,
    types.GameMode.Speed,
    types.GameMode.Base,
    types.GameMode.Hidden,
    types.GameMode.Missile,
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

/** 모험 맵 AI전: 베이스 제외 랜덤 흑백, 따내기는 도전자(플레이어1) 항상 흑. 그 외는 기존 설정 또는 기본 흑. */
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
        transitionToPlaying(game, now);
    }
};

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
            if (game.isAiGame) {
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
            if (game.isAiGame) {
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
            if (game.isAiGame) {
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
    }
};

export const updateStrategicGameState = async (game: types.LiveGameSession, now: number) => {
    // This is the core update logic for all Go-based games.

    syncAdventureEncounterDeadlineDuringMonsterTurn(game, now);

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
    } else if (game.gameCategory === GameCategory.Tower) {
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
    const shouldSerializeTurnAction = actionType === 'PLACE_STONE' || actionType === 'PASS_TURN';
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
    const myPlayerEnum = user.id === game.blackPlayerId ? types.Player.Black : (user.id === game.whitePlayerId ? types.Player.White : types.Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;
    const resolveFixedScoringTurnState = async () => {
        let fixedScoringTurnLimit: number | undefined;
        let countPassAsTurn = false;
        if ((game as any).gameCategory === 'guildwar') {
            fixedScoringTurnLimit = (game.settings as any)?.autoScoringTurns;
        } else if (game.gameCategory === GameCategory.Tower) {
            fixedScoringTurnLimit = (game.settings as any)?.autoScoringTurns;
        } else if (game.isSinglePlayer && game.stageId) {
            const stage = (await getEffectiveSinglePlayerStages()).find(s => s.id === game.stageId);
            fixedScoringTurnLimit = stage?.autoScoringTurns;
        } else {
            fixedScoringTurnLimit = (game.settings as any)?.autoScoringTurns ?? (game.settings as any)?.scoringTurnLimit;
            // scoringTurnLimit에서 PASS를 턴으로 포함할지 결정.
            // - PvP 전략바둑: PASS 포함(기존 규칙 유지)
            // - 모험/AI/PvE 계열: PASS 제외(실제 착수 수 기준으로 종료)
            countPassAsTurn =
                !game.isSinglePlayer &&
                !game.isAiGame &&
                String(game.gameCategory ?? '') !== String(GameCategory.Tower) &&
                String(game.gameCategory ?? '') !== String(GameCategory.Adventure);
        }
        const currentTurnCount = countPassAsTurn
            ? (game.moveHistory || []).length
            : (game.moveHistory || []).filter(m => m && m.x !== -1 && m.y !== -1).length;
        return { fixedScoringTurnLimit, countPassAsTurn, currentTurnCount };
    };

    switch (type) {
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
                            await getGameResult(game);
                        } catch (e: any) {
                            console.error(`[handleStandardAction] Failed to auto-trigger scoring while blocking extra move, game ${game.id}:`, e?.message);
                        }
                    }
                    return { error: '정해진 수순이 모두 완료되어 더 이상 돌을 놓을 수 없습니다.' };
                }
            }

            // triggerAutoScoring 플래그가 있으면 계가를 트리거
            if (payload.triggerAutoScoring) {
                // 온라인 전략바둑/PVP/AI 대국에서는 항상 서버의 게임 상태를 기준으로 계가해야 함
                // (클라이언트가 새로고침 후 잘못된 boardState를 보내면 오계가 발생할 수 있음)
                const isClientAuthoritative =
                    game.isSinglePlayer || game.gameCategory === GameCategory.Tower || game.gameCategory === 'singleplayer';

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
                    !game.isSinglePlayer &&
                    !game.isAiGame &&
                    game.gameCategory !== 'tower' &&
                    game.gameCategory !== GameCategory.Adventure;
                const totalTurns = useMoveHistoryCountForLimit
                    ? (game.moveHistory || []).length
                    : validMoves.length;
                game.totalTurns = totalTurns;
                let autoScoringTurns: number | undefined;
                if (game.gameCategory === GameCategory.Tower) {
                    autoScoringTurns = (game.settings as any)?.autoScoringTurns;
                    if (autoScoringTurns == null && (game.stageId != null || game.towerFloor != null)) {
                        const { TOWER_STAGES } = await import('../../constants/towerConstants.js');
                        const stage =
                            game.stageId != null
                                ? TOWER_STAGES.find((s: { id: string }) => s.id === game.stageId)
                                : game.towerFloor != null && Number(game.towerFloor) >= 1
                                  ? TOWER_STAGES[Number(game.towerFloor) - 1]
                                  : undefined;
                        autoScoringTurns = stage?.autoScoringTurns;
                    }
                } else if (game.isSinglePlayer && game.stageId) {
                    autoScoringTurns = (await getEffectiveSinglePlayerStages()).find(s => s.id === game.stageId)?.autoScoringTurns;
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
                const validMovesSync = (game.moveHistory || []).filter(
                    (m: { x: number; y: number }) => m && m.x !== -1 && m.y !== -1
                );
                const useMoveHistoryCountForLimitSync =
                    !game.isSinglePlayer &&
                    !game.isAiGame &&
                    game.gameCategory !== 'tower' &&
                    game.gameCategory !== GameCategory.Adventure;
                const totalTurnsSync = useMoveHistoryCountForLimitSync
                    ? (game.moveHistory || []).length
                    : validMovesSync.length;
                game.totalTurns = totalTurnsSync;
                let autoScoringTurnsSync: number | undefined;
                if (game.gameCategory === GameCategory.Tower) {
                    autoScoringTurnsSync = (game.settings as any)?.autoScoringTurns;
                    if (autoScoringTurnsSync == null && (game.stageId != null || game.towerFloor != null)) {
                        const { TOWER_STAGES } = await import('../../constants/towerConstants.js');
                        const stage =
                            game.stageId != null
                                ? TOWER_STAGES.find((s: { id: string }) => s.id === game.stageId)
                                : game.towerFloor != null && Number(game.towerFloor) >= 1
                                  ? TOWER_STAGES[Number(game.towerFloor) - 1]
                                  : undefined;
                        autoScoringTurnsSync = stage?.autoScoringTurns;
                    }
                } else if (game.isSinglePlayer && game.stageId) {
                    autoScoringTurnsSync = (await getEffectiveSinglePlayerStages()).find(s => s.id === game.stageId)?.autoScoringTurns;
                } else {
                    autoScoringTurnsSync =
                        game.mode === types.GameMode.Capture
                            ? undefined
                            : (game.settings as any)?.autoScoringTurns ?? (game.settings as any)?.scoringTurnLimit;
                }
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

            const { x, y, isHidden, boardState: clientBoardState, moveHistory: clientMoveHistory } = payload;
            const isHiddenPlacementActive =
                game.gameStatus === 'hidden_placing' &&
                typeof (game as any).itemUseDeadline === 'number' &&
                (game as any).itemUseDeadline > now;
            const effectiveIsHidden = !!isHidden && isHiddenPlacementActive;
            
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
            
            if (
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
            
            // 범위 체크 후에만 boardState에 접근
            const stoneAtTarget = serverBoardState[y][x];
            
            // 싱글플레이/도전의 탑/길드전/AI 대국은 서버 boardState를 우선 사용한다.
            if (
                game.isSinglePlayer ||
                game.gameCategory === GameCategory.Tower ||
                game.isAiGame ||
                (game as any).gameCategory === 'guildwar'
            ) {
                game.boardState = serverBoardState;
                game.moveHistory = serverMoveHistory;
            }
            // PVP: 클라이언트 boardState를 덮어쓰지 않으므로 game.boardState는 캐시(서버) 상태 유지.
            // 낙관적 업데이트로 이미 둔 수를 보내면 finalStoneCheck에서 거절되어 턴이 안 넘어가는 버그 방지.

            // 전략 AI 대기실 히든: goAiBot이 aiInitialHiddenStone을 두지만, 예전에는 여기서 추적 제외 →
            // 유저가 그 칸을 찍어도 히든 공개 분기로 안 들어가거나 aiInitialHiddenStone이 안 지워져 턴/AI가 꼬일 수 있음.
            const aiInitialHiddenCellTracking = useAiInitialHiddenCellTracking(game);
            const isAiInitialHiddenStone =
                aiInitialHiddenCellTracking &&
                (game as any).aiInitialHiddenStone &&
                (game as any).aiInitialHiddenStone.x === x &&
                (game as any).aiInitialHiddenStone.y === y &&
                !game.permanentlyRevealedStones?.some(p => p.x === x && p.y === y);

            let moveIndexAtTarget = -1;
            const moveHistoryForIndex = game.moveHistory || [];
            for (let i = moveHistoryForIndex.length - 1; i >= 0; i--) {
                const m = moveHistoryForIndex[i];
                if (m.x === x && m.y === y) {
                    moveIndexAtTarget = i;
                    break;
                }
            }
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
                // AI 초기 히든 표시 좌표가 공개되었으면 즉시 추적 상태를 정리한다.
                // (클라에서 잠깐 내 돌에 히든 문양이 붙는 현상 방지)
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
                const simResult = processMove(
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

                // 모험: 상대 히든 위 착수 시도는 전체 공개·문양 유지만 하고 수·턴은 바꾸지 않음(유효 따냄이어도 동일)
                const adventureHiddenRevealOnly = skipPendingCaptureForAdventureHiddenReveal(game);

                // 유효한 포획(히든 1점만 따낸 경우 포함): tempBoard에서 히든 칸을 비운 뒤 processMove라
                // capturedStones가 비어 있어도 착수·보드 반영은 반드시 pendingCapture로 이어져야 한다.
                if (simResult?.isValid && !adventureHiddenRevealOnly) {
                    const extraCaptures = simResult.capturedStones || [];
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

                    game.boardState = simResult.newBoardState;
                    game.boardState[y][x] = opponentPlayerEnum;
                    for (const s of extraCaptures) {
                        game.boardState[s.y][s.x] = opponentPlayerEnum;
                    }

                    game.lastMove = { x, y };
                    game.lastTurnStones = null;
                    game.moveHistory.push(moveAttempt);

                    game.koInfo = simResult.newKoInfo;
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
            
            // 싱글플레이/도전의 탑/AI 대국에서 상대 돌 위 착점은 숨김돌 공개 케이스 외에는 차단
            if (game.isSinglePlayer || game.gameCategory === GameCategory.Tower || game.isAiGame) {
                if (finalStoneCheck === opponentPlayerEnum) {
                    console.error(`[handleStandardAction] CRITICAL BUG PREVENTION: AI stone detected at (${x}, ${y}) before processMove, gameId=${game.id}, finalStoneCheck=${finalStoneCheck}, opponentPlayerEnum=${opponentPlayerEnum}`);
                    return { error: 'AI가 둔 자리에는 돌을 놓을 수 없습니다.' };
                }
            }
            
            if (effectiveIsHidden) {
                // 히든 아이템 개수 확인 및 감소 (스캔 아이템처럼)
                const hiddenKey = user.id === game.player1.id ? 'hidden_stones_p1' : 'hidden_stones_p2';
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
                    let isHiddenStone = isCurrentMove ? effectiveIsHidden : false;
                    if (!isCurrentMove) {
                        const moveIndex = game.moveHistory.findIndex(m => m.x === nx && m.y === ny);
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
            const uniqueStonesToReveal = Array.from(new Map(allStonesToReveal.map(item => [JSON.stringify(item.point), item])).values());
            
            if (uniqueStonesToReveal.length > 0) {
                adventureRevealAllHumanHiddensIfInvolved(game, uniqueStonesToReveal);
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
                if (effectiveIsHidden) {
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
            if (!effectiveIsHidden) {
                game.lastMove = { x, y };
            }
            game.lastTurnStones = null;
            game.moveHistory.push(move);
            game.koInfo = result.newKoInfo;
            game.passCount = 0;

            if (effectiveIsHidden) {
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
                game.justCaptured = [];
                let guildWarCapturePointsThisMove = 0;
                for (const stone of result.capturedStones) {
                    const capturedPlayerEnum = opponentPlayerEnum;
                    
                    let points = 1;
                    let wasHiddenForJustCaptured = false; // default for justCaptured

                    if (
                        game.isSinglePlayer ||
                        (game as any).gameCategory === 'guildwar' ||
                        (game as any).gameCategory === 'tower' ||
                        game.gameCategory === GameCategory.Adventure
                    ) {
                        const isBaseStone = isIntersectionRecordedAsBaseStone(game, stone.x, stone.y);
                        if (isBaseStone) {
                            game.baseStoneCaptures[myPlayerEnum]++;
                            points = 5;
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
                            wasHiddenForJustCaptured = wasHidden;
                            if (wasHidden) {
                                if (!game.hiddenStoneCaptures) {
                                    game.hiddenStoneCaptures = {
                                        [types.Player.None]: 0,
                                        [types.Player.Black]: 0,
                                        [types.Player.White]: 0,
                                    };
                                }
                                game.hiddenStoneCaptures[myPlayerEnum]++;
                                points = 5;
                                if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                                if (!game.permanentlyRevealedStones.some((p) => p.x === stone.x && p.y === stone.y)) {
                                    game.permanentlyRevealedStones.push(stone);
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

            // 같은 교차점에 일반 착수 시, 과거 히든 공개 마커가 남아 문양/히든 표시가 꼬이지 않게 한다.
            if (!effectiveIsHidden && game.permanentlyRevealedStones?.length) {
                game.permanentlyRevealedStones = game.permanentlyRevealedStones.filter((p) => !(p.x === x && p.y === y));
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
                ((game.isSinglePlayer || game.gameCategory === GameCategory.Tower) && game.stageId) || guildWarAutoScoring;
            if (isAutoScoringMode) {
                let autoScoringTurns: number | undefined;
                if (guildWarAutoScoring) {
                    autoScoringTurns = (game.settings as any)?.autoScoringTurns;
                } else if (game.gameCategory === GameCategory.Tower) {
                    autoScoringTurns = (game.settings as any)?.autoScoringTurns;
                } else {
                    const stage = (await getEffectiveSinglePlayerStages()).find(s => s.id === game.stageId);
                    autoScoringTurns = stage?.autoScoringTurns;
                }
                
                if (autoScoringTurns !== undefined) {
                    // 유효한 수만 카운팅 (패스 제외)
                    const validMoves = game.moveHistory.filter(m => m.x !== -1 && m.y !== -1);
                    const newTotalTurns = validMoves.length;
                    game.totalTurns = newTotalTurns;
                    
                    // totalTurns가 autoScoringTurns 이상이면 계가 트리거 (사용자가 마지막 수를 둔 경우)
                    if (newTotalTurns >= autoScoringTurns) {
                        const gameType = game.gameCategory === GameCategory.Tower
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
            
            // After move logic: 따내기 목표 달성(모험·탑·싱글·캡처 모드 공통)
            if (await tryEndGameWhenCaptureTargetReached(game, myPlayerEnum)) {
                return {};
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
            
            // AI 턴인 경우 즉시 처리할 수 있도록 aiTurnStartTime 설정 (모험/길드전은 메인루프·인라인 경쟁 완화를 위해 지연)
            if (game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White)) {
                const { aiUserId } = await import('../aiPlayer.js');
                const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                if (currentPlayerId === aiUserId) {
                    const startAt = nextAiTurnStartTimeAfterHumanStrategicMove(game, now);
                    game.aiTurnStartTime = startAt;
                    console.log(
                        `[handleStandardAction] AI turn after PLACE_STONE, game ${game.id}, setting aiTurnStartTime to ${startAt} (now=${now})`,
                    );
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
            // 수순 고정 모드에서는 제한 수순 종료 후 PASS도 엄격 차단한다.
            {
                const { fixedScoringTurnLimit, currentTurnCount } = await resolveFixedScoringTurnState();
                if (fixedScoringTurnLimit != null && fixedScoringTurnLimit > 0 && currentTurnCount >= fixedScoringTurnLimit) {
                    game.totalTurns = currentTurnCount;
                    if ((game.gameStatus as string) !== 'scoring' && (game.gameStatus as string) !== 'ended') {
                        game.gameStatus = 'scoring';
                        await db.saveGame(game);
                        try {
                            await getGameResult(game);
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
            {
                // PASS 포함 카운트 모드(scoringTurnLimit)에서는 PASS 직후에도 즉시 수순 종료 계가를 트리거한다.
                const { fixedScoringTurnLimit, countPassAsTurn, currentTurnCount } = await resolveFixedScoringTurnState();
                if (
                    countPassAsTurn &&
                    fixedScoringTurnLimit != null &&
                    fixedScoringTurnLimit > 0 &&
                    currentTurnCount >= fixedScoringTurnLimit
                ) {
                    game.totalTurns = currentTurnCount;
                    game.gameStatus = 'scoring';
                    await db.saveGame(game);
                    try {
                        await getGameResult(game);
                    } catch (e: any) {
                        console.error(`[handleStandardAction] getGameResult failed after PASS_TURN scoringTurnLimit for game ${game.id}:`, e?.message);
                    }
                    return {};
                }
            }

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
                // AI 턴인 경우 aiTurnStartTime 설정 (모험/길드전은 메인루프·인라인 경쟁 완화를 위해 지연)
                if (game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White)) {
                    const { aiUserId } = await import('../aiPlayer.js');
                    const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                    if (currentPlayerId === aiUserId) {
                        const startAt = nextAiTurnStartTimeAfterHumanStrategicMove(game, now);
                        game.aiTurnStartTime = startAt;
                        console.log(
                            `[handleStandardAction] AI turn after PASS_TURN, game ${game.id}, setting aiTurnStartTime to ${startAt} (now=${now})`,
                        );
                    } else {
                        // 사용자 턴으로 넘어갔으므로 aiTurnStartTime을 undefined로 설정
                        game.aiTurnStartTime = undefined;
                        console.log(`[handleStandardAction] User turn after PASS_TURN, game ${game.id}, clearing aiTurnStartTime`);
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
