
import * as types from '../../types/index.js';
import { MISSILE_FLIGHT_DURATION_MS } from '../../shared/constants/gameSettings.js';
import { pauseGameTimer, resumeGameTimer, shouldEnforceTimeControl } from './shared.js';
import {
    consumeOneTowerLobbyInventoryItem,
    TOWER_LOBBY_MISSILE_NAMES,
    scheduleTowerP1InventorySave,
    persistTowerP1ConsumableDecrement,
    syncTowerP1ConsumableSessionFromInventory,
} from './towerPlayerHidden.js';
import {
    getCurrentPairTurnSeat,
    isPairAiSeat,
    isPairClassicGame,
    pairSeatMatchesViewerUser,
} from '../../shared/utils/pairGameTurn.js';
import { schedulePairAiTurnIfNeeded } from '../utils/pairAiTurnSchedule.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';
import { findLatestMoveIndexAtExcludingRecordedBaseStones } from '../../shared/utils/baseHiddenMoveIndex.js';
import {
    finalizeItemPhase,
    markItemPhaseStateChanged,
    tryFinalizeMissileFlightFromAnimationState,
    type FinalizeItemPhaseOptions,
} from './finalizeItemPhase.js';
import { applyMissileLandingCaptures, relocateMissileStoneMetadata } from './missileBoardUtils.js';
import { isMissileFlightAnimationType } from '../../shared/utils/itemPhaseAnimationTypes.js';

type HandleActionResult = types.HandleActionResult;

function findLatestOwnedMoveIndexAt(
    game: types.LiveGameSession,
    point: types.Point,
    player: types.Player,
): number {
    return findLatestMoveIndexAtExcludingRecordedBaseStones(game.moveHistory, point.x, point.y, player, game);
}

export const initializeMissile = (game: types.LiveGameSession) => {
    const isMissileMode = game.mode === types.GameMode.Missile || (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Missile));
    if (isMissileMode) {
        const cap = game.settings.missileCount ?? 3;
        game.missiles_p1 = cap;
        game.missiles_p2 = cap;
    }
};

/**
 * 미사일 경로 계산: 가장 먼 곳으로 이동
 * - 중간에 바둑돌이 있으면 그 앞에서 멈춤
 * - 상대방의 히든 돌은 통과
 * - 도착지점에 상대방의 히든 돌이 있으면 그 이전 자리로 이동
 */
function calculateMissilePath(
    game: types.LiveGameSession,
    from: types.Point,
    direction: 'up' | 'down' | 'left' | 'right',
    myPlayerEnum: types.Player
): { to: types.Point; revealedHiddenStone: types.Point | null } {
    const boardSize = game.settings.boardSize;
    if (!Number.isFinite(boardSize) || boardSize <= 0) {
        return { to: { ...from }, revealedHiddenStone: null };
    }
    const opponentEnum = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
    
    // 방향 벡터 계산
    const dir: types.Point = { x: 0, y: 0 };
    if (direction === 'up') dir.y = -1;
    else if (direction === 'down') dir.y = 1;
    else if (direction === 'left') dir.x = -1;
    else if (direction === 'right') dir.x = 1;
    
    let current = { ...from };
    let revealedHiddenStone: types.Point | null = null;
    const maxSteps = boardSize * boardSize + 8;
    let stepGuard = 0;

    // 경로를 따라 이동하면서 확인
    while (true) {
        if (++stepGuard > maxSteps) {
            console.warn(
                `[Missile Go] calculateMissilePath: step guard exceeded, aborting path from (${from.x},${from.y}), gameId=${game.id}`,
            );
            break;
        }
        const next = { x: current.x + dir.x, y: current.y + dir.y };
        
        // 보드 범위를 벗어나면 멈춤
        if (next.x < 0 || next.x >= boardSize || next.y < 0 || next.y >= boardSize) {
            break;
        }
        
        const rawAtNext = game.boardState[next.y]?.[next.x];
        const stoneAtNext = rawAtNext == null ? types.Player.None : rawAtNext;
        
        // moveHistory도 확인하여 보드 동기화 지연 상태의 돌을 감지
        const moveAtNext = game.moveHistory.find(m => m.x === next.x && m.y === next.y);
        const isOpponentMoveAtNext = moveAtNext && moveAtNext.player === opponentEnum;

        // 빈 칸이면 계속 이동 (단, moveHistory에 상대 돌이 있으면 충돌 처리)
        if (stoneAtNext === types.Player.None) {
            if (isOpponentMoveAtNext) {
                const moveIndex = findLatestMoveIndexAtExcludingRecordedBaseStones(
                    game.moveHistory,
                    next.x,
                    next.y,
                    opponentEnum,
                    game,
                );
                const isHiddenStone = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
                const isPermanentlyRevealed = game.permanentlyRevealedStones?.some(p => p.x === next.x && p.y === next.y);
                // 미공개 히든은 통과
                if (isHiddenStone && !isPermanentlyRevealed) {
                    current = next;
                    continue;
                }
                break;
            }
            current = next;
            continue;
        }
        
        // 내 돌이면 멈춤
        if (stoneAtNext === myPlayerEnum) {
            break;
        }
        
        // 상대방 돌인 경우
        if (stoneAtNext === opponentEnum) {
            // 히든 돌인지 확인
            const moveIndex = findLatestMoveIndexAtExcludingRecordedBaseStones(
                game.moveHistory,
                next.x,
                next.y,
                opponentEnum,
                game,
            );
            const isHiddenStone = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
            const isPermanentlyRevealed = game.permanentlyRevealedStones?.some(p => p.x === next.x && p.y === next.y);
            
            // 히든 돌이고 아직 공개되지 않았으면 통과
            if (isHiddenStone && !isPermanentlyRevealed) {
                current = next;
                continue;
            }
            
            // 공개된 돌이면 멈춤 (현재 위치에서 멈춤, next 위치로 가지 않음)
            break;
        }
        
        // 알 수 없는 플레이어 값이 있으면 멈춤 (안전장치)
        // 타입 단언을 사용하여 TypeScript 경고를 무시 (실제로는 런타임에 예상치 못한 값이 올 수 있음)
        const stoneValue = stoneAtNext as types.Player | undefined;
        if (stoneValue !== undefined && stoneValue !== types.Player.None && stoneValue !== myPlayerEnum && stoneValue !== opponentEnum) {
            break;
        }
    }
    
    // 도착지점에 상대방의 히든 돌이 있는지 확인
    const finalMoveIndex = findLatestMoveIndexAtExcludingRecordedBaseStones(
        game.moveHistory,
        current.x,
        current.y,
        opponentEnum,
        game,
    );
    const finalStone = game.boardState[current.y]?.[current.x];
    const isFinalHiddenStone = 
        finalStone === opponentEnum &&
        finalMoveIndex !== -1 &&
        !!game.hiddenMoves?.[finalMoveIndex] &&
        !game.permanentlyRevealedStones?.some(p => p.x === current.x && p.y === current.y);
    
    if (isFinalHiddenStone) {
        // 히든 돌을 공개하고, 그 이전 자리로 이동
        revealedHiddenStone = { ...current };
        
        // 이전 자리로 이동 (방향 반대)
        const prev = { x: current.x - dir.x, y: current.y - dir.y };
        if (prev.x >= 0 && prev.x < boardSize && prev.y >= 0 && prev.y < boardSize) {
            current = prev;
        } else {
            // 이전 자리가 보드 밖이면 현재 자리에서 멈춤 (히든 돌은 공개됨)
            current = { ...from }; // 원래 자리로 돌아감
        }
    }
    
    return { to: current, revealedHiddenStone };
}

function resolveMissileTimeoutDisplayName(
    game: types.LiveGameSession,
    timedOutPlayerId: string,
): string {
    const pairSeat = isPairClassicGame(game.settings, game.mode)
        ? getCurrentPairTurnSeat(game.settings)
        : null;
    if (pairSeat?.name) return pairSeat.name;
    return game.player1.id === timedOutPlayerId ? game.player1.nickname : game.player2.nickname;
}

/** missile_selecting 고착/타임아웃 → playing 복귀 (페어 AI는 큐 재스케줄 포함) */
function recoverFromMissileSelectionTimeout(game: types.LiveGameSession, now: number, reason: 'deadline' | 'stuck'): boolean {
    if (game.gameStatus !== 'missile_selecting') return false;

    const timedOutPlayerEnum = game.currentPlayer;
    const pairSeat = isPairClassicGame(game.settings, game.mode) ? getCurrentPairTurnSeat(game.settings) : null;
    const timedOutPlayerId =
        pairSeat?.participantId ??
        (timedOutPlayerEnum === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!);

    console.log(
        `[Missile Go] Item selection recovered (${reason}) for game ${game.id}, participant ${timedOutPlayerId}, restoring game state`,
    );

    game.foulInfo = {
        message: `${resolveMissileTimeoutDisplayName(game, timedOutPlayerId)}님의 아이템 시간 초과!`,
        expiry: now + 4000,
    };
    game.gameStatus = 'playing';
    game.animation = null;
    game.currentPlayer = pairSeat?.player ?? timedOutPlayerEnum;
    game.missileUsedThisTurn = false;

    const missileKey = game.currentPlayer === types.Player.Black ? 'missiles_p1' : 'missiles_p2';
    const currentMissiles = game[missileKey] ?? game.settings.missileCount ?? 0;
    if (currentMissiles > 0) {
        game[missileKey] = currentMissiles - 1;
    }

    if (game.gameCategory === 'tower' && timedOutPlayerId === game.player1?.id) {
        void persistTowerP1ConsumableDecrement(game.player1.id, 'missile');
    }

    const timerResumed = resumeGameTimer(game, now, game.currentPlayer);
    if (!timerResumed) {
        game.itemUseDeadline = undefined;
        game.pausedTurnTimeLeft = undefined;
        game.turnDeadline = undefined;
        game.turnStartTime = undefined;
    }

    if (pairSeat) {
        if (isPairAiSeat(pairSeat)) {
            schedulePairAiTurnIfNeeded(game, now);
        } else {
            game.aiTurnStartTime = undefined;
        }
    }

    markItemPhaseStateChanged(game);
    return true;
}

function finalizeMissileFlightInUpdateLoop(
    game: types.LiveGameSession,
    now: number,
    options: Parameters<typeof tryFinalizeMissileFlightFromAnimationState>[2],
): boolean {
    const resolved = tryFinalizeMissileFlightFromAnimationState(game, now, options);
    if (!resolved) return false;
    const pairSeat = isPairClassicGame(game.settings, game.mode) ? getCurrentPairTurnSeat(game.settings) : null;
    if (pairSeat && isPairAiSeat(pairSeat) && game.gameStatus === 'playing') {
        schedulePairAiTurnIfNeeded(game, now);
    }
    return true;
}

function finalizeMissileCleanupInUpdateLoop(
    game: types.LiveGameSession,
    now: number,
    options: FinalizeItemPhaseOptions,
): boolean {
    const resolved = finalizeItemPhase(game, 'missile', now, options) as boolean;
    if (!resolved) return false;
    const pairSeat = isPairClassicGame(game.settings, game.mode) ? getCurrentPairTurnSeat(game.settings) : null;
    if (pairSeat && isPairAiSeat(pairSeat) && game.gameStatus === 'playing') {
        schedulePairAiTurnIfNeeded(game, now);
    }
    return true;
}

export const updateMissileState = (game: types.LiveGameSession, now: number): boolean => {
    // 방어 로직: 미사일 선택 모드인데 deadline이 비어 있으면 상태 고착을 방지하기 위해 즉시 복귀
    if (game.gameStatus === 'missile_selecting' && !game.itemUseDeadline) {
        return recoverFromMissileSelectionTimeout(game, now, 'stuck');
    }

    // 아이템 사용 시간 초과 처리
    if (game.gameStatus === 'missile_selecting' && game.itemUseDeadline && now > game.itemUseDeadline) {
        return recoverFromMissileSelectionTimeout(game, now, 'deadline');
    }
    
    // 애니메이션 처리
    if (game.gameStatus === 'missile_animating') {
        if (!game.animation) {
            console.warn(`[updateMissileState] Game ${game.id} has missile_animating status but no animation, cleaning up...`);
            return finalizeMissileCleanupInUpdateLoop(game, now, { cleanupOnly: true, reason: 'no-animation' });
        }

        const anim = game.animation;
        if (!isMissileFlightAnimationType(anim)) {
            if (game.animation) {
                console.warn(
                    `[updateMissileState] Game ${game.id} has missile_animating status but animation type is ${game.animation.type}, cleaning up...`,
                );
            }
            return finalizeMissileCleanupInUpdateLoop(game, now, { cleanupOnly: true, reason: 'wrong-animation-type' });
        }

        const elapsed = now - anim.startTime;
        const duration = anim.duration;
        const animationStartTime = anim.startTime;
        const lastProcessedAnimationTime = (game as any).lastProcessedMissileAnimationTime;

        if (lastProcessedAnimationTime === animationStartTime) {
            return finalizeMissileCleanupInUpdateLoop(game, now, {
                cleanupOnly: true,
                animationStartTime,
                reason: 'duplicate-processed',
            });
        }

        if (elapsed >= duration) {
            return finalizeMissileFlightInUpdateLoop(game, now, {
                animationStartTime,
                reason: 'elapsed-complete',
            });
        }

        if (elapsed > duration + 1000) {
            console.warn(
                `[updateMissileState] Game ${game.id} animation should have ended (elapsed=${elapsed}ms, duration=${duration}ms), forcing cleanup...`,
            );
            return finalizeMissileFlightInUpdateLoop(game, now, {
                animationStartTime,
                reason: 'over-duration-grace',
            });
        }

        const MAX_ANIMATION_DURATION = 10000;
        if (elapsed > MAX_ANIMATION_DURATION) {
            console.warn(
                `[updateMissileState] Game ${game.id} animation exceeded max duration (elapsed=${elapsed}ms), forcing cleanup...`,
            );
            return finalizeMissileFlightInUpdateLoop(game, now, {
                animationStartTime,
                reason: 'max-duration',
            });
        }

        return false;
    }
    
    // 게임 상태가 변경되지 않았음을 반환
    return false;
};

const MISSILE_ANIMATION_STUCK_TIMEOUT_MS = 5000;

/** START_MISSILE_SELECTION 직전: 클라만 playing으로 넘긴 뒤 서버가 missile_animating에 남은 경우 복구 */
function tryRecoverStuckMissileAnimatingBeforeSelection(
    game: types.LiveGameSession,
    now: number,
): { blocked: boolean; error?: string } {
    if (game.gameStatus !== 'missile_animating') {
        return { blocked: false };
    }
    if (!game.animation || !isMissileFlightAnimationType(game.animation)) {
        finalizeItemPhase(game, 'missile', now, { cleanupOnly: true, reason: 'start-selection-no-animation' });
        return { blocked: false };
    }
    const animDuration = now - game.animation.startTime;
    if (animDuration > MISSILE_ANIMATION_STUCK_TIMEOUT_MS) {
        finalizeItemPhase(game, 'missile', now, {
            animationStartTime: game.animation.startTime,
            skipBoardRelocation: true,
            reason: 'start-selection-animation-timeout',
        });
        return { blocked: false };
    }
    return { blocked: true, error: '미사일 애니메이션이 진행 중입니다. 잠시 후 다시 시도해주세요.' };
}

export const handleMissileAction = async (game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): Promise<HandleActionResult | null> => {
    const { type, payload } = action as any;
    const now = Date.now();
    const pairClassicGame = isPairClassicGame(game.settings, game.mode);
    const pairCurrentSeat = pairClassicGame ? getCurrentPairTurnSeat(game.settings) : null;
    let myPlayerEnum = pairCurrentSeat
        ? pairSeatMatchesViewerUser(pairCurrentSeat, user.id)
            ? pairCurrentSeat.player
            : types.Player.None
        : user.id === game.blackPlayerId
          ? types.Player.Black
          : user.id === game.whitePlayerId
            ? types.Player.White
            : types.Player.None;
    // 탑/PVE: 일부 세션에서 player1(인간)과 blackPlayerId 불일치 시 None → LAUNCH가 "Not your stone"으로 400
    if (myPlayerEnum === types.Player.None && game.player1?.id === user.id) {
        myPlayerEnum = types.Player.Black;
    }
    const isMyTurn = pairCurrentSeat
        ? pairSeatMatchesViewerUser(pairCurrentSeat, user.id) && pairCurrentSeat.player === game.currentPlayer
        : myPlayerEnum === game.currentPlayer;
    // 미사일은 본인 차례에만 사용 (히든/스캔과 달리 상대 응답 전 창은 허용하지 않음)
    const canUseMissile = isMyTurn;

    switch (type) {
        case 'START_MISSILE_SELECTION': {
            if (!canUseMissile) {
                console.warn(`[Missile Go] START_MISSILE_SELECTION failed: isMyTurn=${isMyTurn}, gameStatus=${game.gameStatus}, gameId=${game.id}`);
                return { error: "Not your turn to use an item." };
            }
            const animRecovery = tryRecoverStuckMissileAnimatingBeforeSelection(game, now);
            if (animRecovery.blocked) {
                console.warn(
                    `[Missile Go] START_MISSILE_SELECTION failed: animation in progress, gameStatus=${game.gameStatus}, gameId=${game.id}`,
                );
                return { error: animRecovery.error ?? '미사일 애니메이션이 진행 중입니다. 잠시 후 다시 시도해주세요.' };
            }
            // 클라이언트가 첫 전환 GAME_UPDATE를 쓰로틀로 놓친 경우 재동기화(멱등)
            if (game.gameStatus === 'missile_selecting') {
                if (!game.itemUseDeadline) {
                    pauseGameTimer(game, now, 30000);
                }
                markItemPhaseStateChanged(game);
                return { clientResponse: { gameUpdated: true } };
            }
            if (game.gameStatus !== 'playing') {
                console.warn(`[Missile Go] START_MISSILE_SELECTION failed: isMyTurn=${isMyTurn}, gameStatus=${game.gameStatus}, gameId=${game.id}`);
                return { error: "Not your turn to use an item." };
            }
            
            // 미사일 아이템 개수 확인 (게임별 missiles_p1/p2 또는 설정 상한)
            const missileKey = myPlayerEnum === types.Player.Black ? 'missiles_p1' : 'missiles_p2';
            let myMissilesLeft = game[missileKey];
            if (game.gameCategory === 'tower' && user.id === game.player1?.id) {
                if (myMissilesLeft == null || myMissilesLeft <= 0) {
                    syncTowerP1ConsumableSessionFromInventory(game, user, 'missile');
                    myMissilesLeft = (game as any)[missileKey] ?? 0;
                }
            } else if (myMissilesLeft == null) {
                myMissilesLeft = game.settings.missileCount ?? 0;
                (game as any)[missileKey] = myMissilesLeft;
            }
            if ((myMissilesLeft ?? 0) <= 0) {
                console.warn(`[Missile Go] START_MISSILE_SELECTION failed: no missiles left, gameId=${game.id}`);
                return { error: "No missiles left." };
            }
            
            // 게임 상태를 missile_selecting으로 변경
            game.gameStatus = 'missile_selecting';
            
            // 원래 경기 시간 일시 정지 및 아이템 사용 시간 부여
            pauseGameTimer(game, now, 30000);
            markItemPhaseStateChanged(game);

            console.log(`[Missile Go] START_MISSILE_SELECTION: gameStatus changed to missile_selecting, gameId=${game.id}`);
            return { clientResponse: { gameUpdated: true } };
        }
        
        case 'LAUNCH_MISSILE': {
            if (game.gameStatus !== 'missile_selecting') {
                console.warn(`[Missile Go] LAUNCH_MISSILE failed: gameStatus=${game.gameStatus}, expected=missile_selecting, gameId=${game.id}`);
                return { error: "Not in missile selection mode." };
            }
            
            // 아이템 사용 시간 확인
            if (game.itemUseDeadline && now > game.itemUseDeadline) {
                console.warn(`[Missile Go] LAUNCH_MISSILE failed: item use time expired, gameId=${game.id}`);
                return { error: "Item use time expired." };
            }
            
            // 이미 애니메이션이 진행 중인 경우 무시 (중복 방지)
            if (game.animation) {
                console.warn(`[Missile Go] LAUNCH_MISSILE failed: animation already exists, gameId=${game.id}`);
                return { error: "Animation already in progress." };
            }
            
            const { from, direction } = payload;
            const clientBoardState = (payload as any).boardState;
            const clientMoveHistory = (payload as any).moveHistory;
            if (!from || !direction) {
                console.warn(`[Missile Go] LAUNCH_MISSILE failed: missing from or direction, payload=${JSON.stringify(payload)}, gameId=${game.id}`);
                return { error: "Invalid payload: missing from or direction." };
            }
            
            if (from.x < 0 || from.x >= game.settings.boardSize || from.y < 0 || from.y >= game.settings.boardSize) {
                console.warn(`[Missile Go] LAUNCH_MISSILE failed: invalid from coordinates, from=${JSON.stringify(from)}, boardSize=${game.settings.boardSize}, gameId=${game.id}`);
                return { error: "Invalid stone position." };
            }
            
            // 클라이언트에서 보낸 boardState를 우선적으로 사용 (더 최신 상태일 수 있음)
            const boardStateToUse = (clientBoardState && Array.isArray(clientBoardState) && clientBoardState.length > 0) 
                ? clientBoardState 
                : game.boardState;
            const moveHistoryToUse = (clientMoveHistory && Array.isArray(clientMoveHistory) && clientMoveHistory.length > 0)
                ? clientMoveHistory
                : game.moveHistory;
            
            // 클라이언트의 boardState를 서버의 boardState에 반영 (동기화)
            if (clientBoardState && Array.isArray(clientBoardState) && clientBoardState.length > 0) {
                console.log(`[Missile Go] LAUNCH_MISSILE: using client boardState for validation, gameId=${game.id}`);
                game.boardState = clientBoardState;
            }
            if (clientMoveHistory && Array.isArray(clientMoveHistory) && clientMoveHistory.length > 0) {
                const serverLen = (game.moveHistory || []).length;
                const clientLen = clientMoveHistory.length;
                // 클라 수순이 서버보다 비정상적으로 길면(낙관적 UI·동기화 꼬임) 그대로 덮어
                // `scoringTurnLimit`이 moveHistory 길이 기준인 전략/페어에서 조기 계가·AI 정지로 이어질 수 있음
                if (clientLen > serverLen + 1) {
                    console.warn(
                        `[Missile Go] LAUNCH_MISSILE: ignoring client moveHistory longer than server (${clientLen} > ${serverLen} + 1), gameId=${game.id}`,
                    );
                } else {
                    console.log(`[Missile Go] LAUNCH_MISSILE: using client moveHistory for validation, gameId=${game.id}`);
                    game.moveHistory = clientMoveHistory;
                }
            }
            
            // 미사일 바둑에서는 boardState와 moveHistory를 모두 확인
            // (새로 놓은 돌이 boardState에 아직 반영되지 않았을 수 있음)
            const stoneAtFrom = boardStateToUse[from.y]?.[from.x];
            const moveAtFrom = moveHistoryToUse.find(m => m.x === from.x && m.y === from.y && m.player === myPlayerEnum);
            const isMyStone = stoneAtFrom === myPlayerEnum || !!moveAtFrom;
            
            if (!isMyStone) {
                console.warn(`[Missile Go] LAUNCH_MISSILE failed: not your stone, from=${JSON.stringify(from)}, stoneAtFrom=${stoneAtFrom}, myPlayerEnum=${myPlayerEnum}, hasMoveHistory=${!!moveAtFrom}, gameId=${game.id}`);
                return { error: "Not your stone." };
            }
            
            // moveHistory에는 있지만 boardState에 반영되지 않은 경우 boardState 업데이트
            if (moveAtFrom && stoneAtFrom !== myPlayerEnum) {
                console.log(`[Missile Go] LAUNCH_MISSILE: updating boardState for newly placed stone, from=${JSON.stringify(from)}, gameId=${game.id}`);
                game.boardState[from.y][from.x] = myPlayerEnum;
            }
            
            // 미사일 경로 계산 (클라이언트의 boardState와 moveHistory를 사용)
            // 클라이언트의 boardState를 서버에 반영한 상태로 경로 계산
            const { to, revealedHiddenStone } = calculateMissilePath(game, from, direction, myPlayerEnum);
            
            if (to.x === from.x && to.y === from.y) {
                console.warn(`[Missile Go] LAUNCH_MISSILE failed: cannot move stone, from=${JSON.stringify(from)}, to=${JSON.stringify(to)}, direction=${direction}, gameId=${game.id}`);
                return { error: "Cannot move stone." };
            }
            
            // 히든 돌 공개 처리 (목적지에 히든 돌이 있는 경우)
            if (revealedHiddenStone) {
                const moveIndex = game.moveHistory.findIndex(m => m.x === revealedHiddenStone.x && m.y === revealedHiddenStone.y);
                if (moveIndex !== -1) {
                    // permanentlyRevealedStones에 추가
                    if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                    if (!game.permanentlyRevealedStones.some(p => p.x === revealedHiddenStone.x && p.y === revealedHiddenStone.y)) {
                        game.permanentlyRevealedStones.push({ x: revealedHiddenStone.x, y: revealedHiddenStone.y });
                    }
                }
            }
            
            // 목적지에 이미 상대방 돌이 있는지 확인 (덮어씌우기 방지)
            const stoneAtTo = game.boardState[to.y]?.[to.x];
            const opponentEnum = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
            const moveAtTo = game.moveHistory.find(m => m.x === to.x && m.y === to.y);
            const isOpponentMoveAtTo = moveAtTo && moveAtTo.player === opponentEnum;
            
            if (stoneAtTo === opponentEnum || isOpponentMoveAtTo) {
                const moveIndexAtTo = game.moveHistory.findIndex(m => m.x === to.x && m.y === to.y);
                const isHiddenStoneAtTo = moveIndexAtTo !== -1 && !!game.hiddenMoves?.[moveIndexAtTo];
                const isPermanentlyRevealedAtTo = game.permanentlyRevealedStones?.some(p => p.x === to.x && p.y === to.y);
                if (!isHiddenStoneAtTo || isPermanentlyRevealedAtTo) {
                    console.warn(`[Missile Go] LAUNCH_MISSILE failed: destination has opponent stone, to=${JSON.stringify(to)}, gameId=${game.id}`);
                    return { error: "Cannot move to a position occupied by opponent stone." };
                }
            }
            
            // 보드 상태 변경: 미사일은 돌을 "이동"시킴 (복사 아님) — 원래 자리 제거, 목적지에 배치
            game.boardState[from.y][from.x] = types.Player.None;
            game.boardState[to.y][to.x] = myPlayerEnum;

            // 배치돌 업데이트: 원래 자리의 배치돌을 목적지로 이동
            if (game.baseStones) {
                const baseStoneIndex = game.baseStones.findIndex(bs => bs.x === from.x && bs.y === from.y);
                if (baseStoneIndex !== -1) {
                    game.baseStones[baseStoneIndex].x = to.x;
                    game.baseStones[baseStoneIndex].y = to.y;
                }
            }
            
            // 싱글플레이에서 baseStones_p1, baseStones_p2도 확인 (페어는 blackPlayerId가 participantId라 p1 비교가 깨질 수 있음 → 색 기준)
            const baseStonesKey = myPlayerEnum === types.Player.Black ? 'baseStones_p1' : 'baseStones_p2';
            const baseStonesArray = (game as any)[baseStonesKey] as types.Point[] | undefined;
            if (baseStonesArray) {
                const baseStoneIndex = baseStonesArray.findIndex(bs => bs.x === from.x && bs.y === from.y);
                if (baseStoneIndex !== -1) {
                    baseStonesArray[baseStoneIndex].x = to.x;
                    baseStonesArray[baseStoneIndex].y = to.y;
                }
            }
            
            // moveHistory: 원래 자리의 이동 기록이 있으면 목적지로 변경, 없으면(배치돌) 새로 추가하지 않음
            const fromMoveIndex = findLatestOwnedMoveIndexAt(game, from, myPlayerEnum);
            if (fromMoveIndex !== -1) {
                game.moveHistory[fromMoveIndex].x = to.x;
                game.moveHistory[fromMoveIndex].y = to.y;
            }

            // 문양/공개 히든 좌표 메타를 함께 이동시켜 원래 위치에 잔상이 남지 않게 한다.
            relocateMissileStoneMetadata(game, from, to, myPlayerEnum);

            // 따내기는 발사 직후 보드에서 제거(비행 연출 중에도 따낸 돌이 사라지도록)
            applyMissileLandingCaptures(game, to, myPlayerEnum);
            
            // 아이템 사용 시간 일시 정지 (애니메이션 중)
            game.itemUseDeadline = undefined;
            
            // 턴 시간 복원 (애니메이션 중에도 턴이 유지되도록)
            if (game.pausedTurnTimeLeft !== undefined) {
                const currentPlayerTimeKey = myPlayerEnum === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                game[currentPlayerTimeKey] = game.pausedTurnTimeLeft;
                if (shouldEnforceTimeControl(game) && game.settings.timeLimit > 0) {
                    game.turnDeadline = now + game.pausedTurnTimeLeft * 1000;
                    game.turnStartTime = now;
                } else {
                    game.turnDeadline = undefined;
                    game.turnStartTime = undefined;
                }
            }
            
            // 애니메이션 설정 (MISSILE_FLIGHT_DURATION_MS와 동기)
            // 새로운 애니메이션 시작 시 이전 처리 기록 초기화
            (game as any).lastProcessedMissileAnimationTime = undefined;
            
            const animationData: any = {
                type: revealedHiddenStone ? 'hidden_missile' : 'missile',
                from,
                to,
                player: myPlayerEnum,
                startTime: now,
                duration: MISSILE_FLIGHT_DURATION_MS
            };
            
            if (revealedHiddenStone) {
                animationData.revealedHiddenStone = revealedHiddenStone;
            }
            animationData.capturesAppliedAtLaunch = true;
            
            game.animation = animationData;
            game.gameStatus = 'missile_animating';
            
            // 미사일 아이템 개수 감소
            const launchMissileKey = myPlayerEnum === types.Player.Black ? 'missiles_p1' : 'missiles_p2';
            game[launchMissileKey] = (game[launchMissileKey] ?? 0) - 1;

            if (game.gameCategory === 'tower' && user.id === game.player1?.id) {
                if (consumeOneTowerLobbyInventoryItem(user, TOWER_LOBBY_MISSILE_NAMES)) {
                    scheduleTowerP1InventorySave(user);
                }
            }

            // 전략 로비·페어 등은 계가까지 턴이 moveHistory 길이(PASS 포함)와 맞춰야 함 — 클라 동기화 후에도 서버 필드 정합
            game.totalTurns = (game.moveHistory || []).length;
            
            // 미사일 아이템은 턴을 사용하는 행동이 아니므로 totalTurns를 증가시키지 않음

            const petHintBonusResult = await (async () => {
                const { handleStrategicPetHintBonusClaim } = await import('../strategicPetHintAction.js');
                return handleStrategicPetHintBonusClaim(game, user, {
                    x: to.x,
                    y: to.y,
                    missileLand: true,
                });
            })();
            
            return petHintBonusResult ?? {};
        }
        
        case 'MISSILE_INVALID_SELECTION': {
            if (game.gameStatus !== 'missile_selecting') {
                return { error: "Not in missile selection mode." };
            }
            game.foulInfo = { message: '움직일 수 없는 돌입니다.', expiry: now + 4000 };
            return {};
        }
        
        case 'CANCEL_MISSILE_SELECTION': {
            // 아이템 사용은 취소할 수 없음
            return { error: "아이템 사용은 취소할 수 없습니다." };
        }
        
        case 'MISSILE_ANIMATION_COMPLETE' as any: {
            // 클라이언트가 애니메이션 완료를 알림 (모든 게임 모드에서 사용)
            // 게임 상태가 이미 playing으로 변경되었거나 애니메이션이 없는 경우에도 처리 (이미 완료된 경우 대비)
            // 종료·무효: 서버는 이미 넘어갔는데 클라만 missile_animating 잔존 → 400이면 연출이 영원히 안 끝남
            if (game.gameStatus === 'ended' || game.gameStatus === 'no_contest' || game.gameStatus === 'scoring') {
                return { clientResponse: { gameUpdated: true } };
            }
            if (game.gameStatus !== 'missile_animating' && game.gameStatus !== 'playing') {
                const missileAnimDupOkStatuses = new Set([
                    'hidden_placing',
                    'hidden_reveal_animating',
                    'scanning',
                    'scanning_animating',
                    'hidden_final_reveal',
                    'scoring',
                    // 레이스: 완료 신호가 늦게 오거나 서버가 먼저 선택 페이즈로 복귀한 경우
                    'missile_selecting',
                ]);
                const gc = (game as any).gameCategory;
                const policy = resolveArenaSessionPolicy(game);
                const pveLike =
                    gc === 'adventure' ||
                    gc === 'tower' ||
                    gc === 'guildwar' ||
                    gc === 'singleplayer' ||
                    game.isSinglePlayer === true;
                if (
                    (pveLike || policy.isPairGame || policy.matchAxis === 'pvp') &&
                    missileAnimDupOkStatuses.has(String(game.gameStatus))
                ) {
                    return { clientResponse: { gameUpdated: true } };
                }
                console.warn(`[Missile Go] MISSILE_ANIMATION_COMPLETE failed: gameStatus=${game.gameStatus}, expected=missile_animating or playing, gameId=${game.id}`);
                return { error: "Not in missile animation state." };
            }
            
            if (!game.animation || !isMissileFlightAnimationType(game.animation)) {
                if (game.gameStatus === 'missile_animating') {
                    console.log(`[Missile Go] MISSILE_ANIMATION_COMPLETE: cleaning up stuck missile_animating state, gameId=${game.id}`);
                    finalizeItemPhase(game, 'missile', now, {
                        cleanupOnly: true,
                        reason: 'complete-no-animation',
                    });
                    return { clientResponse: { gameUpdated: true } };
                }
                console.log(`[Missile Go] MISSILE_ANIMATION_COMPLETE: animation already completed, gameId=${game.id}`);
                return { clientResponse: { gameUpdated: true } };
            }

            const animationStartTime = game.animation.startTime;
            const lastProcessedAnimationTime = (game as any).lastProcessedMissileAnimationTime;
            if (lastProcessedAnimationTime === animationStartTime) {
                console.log(`[Missile Go] MISSILE_ANIMATION_COMPLETE: animation already processed, gameId=${game.id}`);
                if (game.gameStatus === 'missile_animating') {
                    finalizeItemPhase(game, 'missile', now, {
                        cleanupOnly: true,
                        animationStartTime,
                        reason: 'complete-already-processed',
                    });
                }
                return { clientResponse: { gameUpdated: true } };
            }

            finalizeItemPhase(game, 'missile', now, {
                animationStartTime,
                skipBoardRelocation: true,
                reason: 'client-complete',
            });
            const pairSeatAfterComplete = isPairClassicGame(game.settings, game.mode)
                ? getCurrentPairTurnSeat(game.settings)
                : null;
            if (pairSeatAfterComplete && isPairAiSeat(pairSeatAfterComplete) && game.gameStatus === 'playing') {
                schedulePairAiTurnIfNeeded(game, now);
            }
            console.log(`[Missile Go] MISSILE_ANIMATION_COMPLETE: animation completed, gameId=${game.id}, gameStatus=${game.gameStatus}`);
            return { clientResponse: { gameUpdated: true } };
        }
    }
    
    return null;
};
