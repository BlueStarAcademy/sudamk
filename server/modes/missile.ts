
import * as types from '../../types/index.js';
import { MISSILE_FLIGHT_DURATION_MS } from '../../shared/constants/gameSettings.js';
import { processMove } from '../goLogic.js';
import { pauseGameTimer, resumeGameTimer, shouldEnforceTimeControl } from './shared.js';
import {
    consumeOneTowerLobbyInventoryItem,
    TOWER_LOBBY_MISSILE_NAMES,
    scheduleTowerP1InventorySave,
    persistTowerP1ConsumableDecrement,
    syncTowerP1ConsumableSessionFromInventory,
} from './towerPlayerHidden.js';
import { applyMissileCaptureProcessResult } from '../../shared/utils/missileLandingCapture.js';
import { recordPatternStoneConsumed, stripPatternStonesAtConsumedIntersections } from '../../shared/utils/patternStoneConsume.js';

type HandleActionResult = types.HandleActionResult;

/** 미사일 착지 후(이동 연출 종료 시점에 호출) 착점과 동일 규칙으로 따내기·점수 반영 */
function applyMissileLandingCaptures(game: types.LiveGameSession, to: types.Point, myPlayerEnum: types.Player) {
    const opponentEnum = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
    const boardForCapture = game.boardState.map((row) => [...row]);
    if (boardForCapture[to.y]?.[to.x] !== myPlayerEnum) return;
    boardForCapture[to.y][to.x] = types.Player.None;
    const captureResult = processMove(
        boardForCapture,
        { x: to.x, y: to.y, player: myPlayerEnum },
        game.koInfo ?? null,
        game.moveHistory.length,
        { opponentPlayer: opponentEnum }
    );
    applyMissileCaptureProcessResult(game, myPlayerEnum, opponentEnum, captureResult);
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
    const opponentEnum = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
    
    // 방향 벡터 계산
    const dir: types.Point = { x: 0, y: 0 };
    if (direction === 'up') dir.y = -1;
    else if (direction === 'down') dir.y = 1;
    else if (direction === 'left') dir.x = -1;
    else if (direction === 'right') dir.x = 1;
    
    let current = { ...from };
    let revealedHiddenStone: types.Point | null = null;
    
    // 경로를 따라 이동하면서 확인
    while (true) {
        const next = { x: current.x + dir.x, y: current.y + dir.y };
        
        // 보드 범위를 벗어나면 멈춤
        if (next.x < 0 || next.x >= boardSize || next.y < 0 || next.y >= boardSize) {
            break;
        }
        
        const stoneAtNext = game.boardState[next.y]?.[next.x];
        
        // moveHistory도 확인하여 보드 동기화 지연 상태의 돌을 감지
        const moveAtNext = game.moveHistory.find(m => m.x === next.x && m.y === next.y);
        const isOpponentMoveAtNext = moveAtNext && moveAtNext.player === opponentEnum;

        // 빈 칸이면 계속 이동 (단, moveHistory에 상대 돌이 있으면 충돌 처리)
        if (stoneAtNext === types.Player.None) {
            if (isOpponentMoveAtNext) {
                const moveIndex = game.moveHistory.findIndex(m => m.x === next.x && m.y === next.y);
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
            const moveIndex = game.moveHistory.findIndex(m => m.x === next.x && m.y === next.y);
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
    const finalMoveIndex = game.moveHistory.findIndex(m => m.x === current.x && m.y === current.y);
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

function findLatestOwnedMoveIndexAt(
    game: types.LiveGameSession,
    point: types.Point,
    player: types.Player
): number {
    for (let i = game.moveHistory.length - 1; i >= 0; i--) {
        const m = game.moveHistory[i];
        if (m.x === point.x && m.y === point.y && m.player === player) return i;
    }
    return -1;
}

function relocateMissileStoneMetadata(
    game: types.LiveGameSession,
    from: types.Point,
    to: types.Point,
    player: types.Player
) {
    const patternKey = player === types.Player.Black ? 'blackPatternStones' : 'whitePatternStones';
    const patternStones = (game as any)[patternKey] as types.Point[] | undefined;
    if (patternStones?.length) {
        const idx = patternStones.findIndex((p) => p.x === from.x && p.y === from.y);
        if (idx !== -1) {
            // 미사일로 문양돌이 이동하면 기존 좌표는 같은 대국에서 재문양화되지 않도록 소모 처리
            recordPatternStoneConsumed(game as any, from);
            patternStones[idx] = { x: to.x, y: to.y };
        }
    }
    stripPatternStonesAtConsumedIntersections(game as any);

    if (game.permanentlyRevealedStones?.length) {
        const ridx = game.permanentlyRevealedStones.findIndex((p) => p.x === from.x && p.y === from.y);
        if (ridx !== -1) {
            game.permanentlyRevealedStones[ridx] = { x: to.x, y: to.y };
        }
    }
}

export const updateMissileState = (game: types.LiveGameSession, now: number): boolean => {
    // 방어 로직: 미사일 선택 모드인데 deadline이 비어 있으면 상태 고착을 방지하기 위해 즉시 복귀
    if (game.gameStatus === 'missile_selecting' && !game.itemUseDeadline) {
        const timedOutPlayerEnum = game.currentPlayer;
        game.gameStatus = 'playing';
        game.currentPlayer = timedOutPlayerEnum;
        const resumed = resumeGameTimer(game, now, timedOutPlayerEnum);
        if (!resumed) {
            game.itemUseDeadline = undefined;
            game.pausedTurnTimeLeft = undefined;
            game.turnDeadline = undefined;
            game.turnStartTime = undefined;
        }
        return true;
    }

    // 아이템 사용 시간 초과 처리
    if (game.gameStatus === 'missile_selecting' && game.itemUseDeadline && now > game.itemUseDeadline) {
        const timedOutPlayerEnum = game.currentPlayer;
        const timedOutPlayerId = timedOutPlayerEnum === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
        
        console.log(`[Missile Go] Item use deadline expired for game ${game.id}, player ${timedOutPlayerId}, restoring game state`);
        
        game.foulInfo = { 
            message: `${game.player1.id === timedOutPlayerId ? game.player1.nickname : game.player2.nickname}님의 아이템 시간 초과!`, 
            expiry: now + 4000 
        };
        game.gameStatus = 'playing';
        game.currentPlayer = timedOutPlayerEnum;

        // 미사일 아이템 소멸
        const missileKey = timedOutPlayerId === game.player1.id ? 'missiles_p1' : 'missiles_p2';
        const currentMissiles = game[missileKey] ?? game.settings.missileCount ?? 0;
        if (currentMissiles > 0) {
            game[missileKey] = currentMissiles - 1;
        }

        if (game.gameCategory === 'tower' && timedOutPlayerId === game.player1?.id) {
            void persistTowerP1ConsumableDecrement(game.player1.id, 'missile');
        }

        // 원래 경기 시간 복원 (턴 유지)
        const timerResumed = resumeGameTimer(game, now, timedOutPlayerEnum);
        if (!timerResumed) {
            game.itemUseDeadline = undefined;
            game.pausedTurnTimeLeft = undefined;
            game.turnDeadline = undefined;
            game.turnStartTime = undefined;
        }
        return true; // 게임 상태가 변경되었음을 반환
    }
    
    // 애니메이션 처리
    if (game.gameStatus === 'missile_animating') {
            // animation이 null인데 gameStatus가 여전히 missile_animating인 경우 정리
            if (!game.animation) {
                console.warn(`[updateMissileState] Game ${game.id} has missile_animating status but no animation, cleaning up...`);
                game.gameStatus = 'playing';
                const playerWhoMoved = game.currentPlayer;
                resumeGameTimer(game, now, playerWhoMoved);
                return true;
            }
        
        // 미사일 애니메이션인 경우에만 처리
        const anim = game.animation;
        if (anim && (anim!.type === 'missile' || anim!.type === 'hidden_missile')) {
            // TypeScript가 타입 가드를 인식하지 못하므로 명시적으로 타입 단언
            const animNonNull = anim!;
            const elapsed = now - animNonNull.startTime;
            const duration = animNonNull.duration;
            const animationStartTime = animNonNull.startTime;
            
            // 이미 처리된 애니메이션인지 확인 (중복 처리 방지)
            const lastProcessedAnimationTime = (game as any).lastProcessedMissileAnimationTime;
            if (lastProcessedAnimationTime === animationStartTime) {
                // 이미 처리된 애니메이션 - 즉시 정리하고 반환
                game.animation = null;
                game.gameStatus = 'playing';
                return false;
            }
            
            // 애니메이션이 종료되었는지 확인 (정상 종료: elapsed >= duration)
            if (elapsed >= duration) {
                // 처리된 애니메이션의 startTime을 먼저 기록 (중복 처리 방지)
                (game as any).lastProcessedMissileAnimationTime = animationStartTime;
                
                // 애니메이션 정보를 먼저 저장 (null 설정 전에)
                const playerWhoMoved = game.currentPlayer;
                const animationFrom = (game.animation as any).from as types.Point | undefined;
                const animationTo = (game.animation as any).to as types.Point | undefined;
                const revealedHiddenStone = (game.animation as any).revealedHiddenStone as types.Point | null | undefined;
                
                // 애니메이션 제거
                game.animation = null;
                
                // 게임 상태를 playing으로 변경
                game.gameStatus = 'playing';
                
                // 히든 돌 공개 처리
                if (revealedHiddenStone) {
                    const rs = revealedHiddenStone!;
                    const moveIndex = game.moveHistory.findIndex(m => m.x === rs.x && m.y === rs.y);
                    if (moveIndex !== -1) {
                        // permanentlyRevealedStones에 추가
                        if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                        if (!game.permanentlyRevealedStones!.some(p => p.x === rs.x && p.y === rs.y)) {
                            game.permanentlyRevealedStones!.push({ x: rs.x, y: rs.y });
                        }
                    }
                }
                
                // 보드 상태 변경: 기존 자리의 돌 삭제, 이동된 자리에 돌 배치
                if (animationFrom && animationTo) {
                    const af = animationFrom!;
                    const at = animationTo!;
                    const stoneAtFrom = game.boardState[af.y]?.[af.x];
                    if (stoneAtFrom === playerWhoMoved) {
                        game.boardState[af.y][af.x] = types.Player.None;
                    }
                    game.boardState[at.y][at.x] = playerWhoMoved;
                }
                
                // 배치돌 업데이트
                if (game.baseStones && animationFrom && animationTo) {
                    const af = animationFrom!;
                    const at = animationTo!;
                    const baseStoneIndex = game.baseStones!.findIndex(bs => bs.x === af.x && bs.y === af.y);
                    if (baseStoneIndex !== -1) {
                        game.baseStones![baseStoneIndex].x = at.x;
                        game.baseStones![baseStoneIndex].y = at.y;
                    }
                }
                
                // 싱글플레이에서 baseStones_p1, baseStones_p2도 확인
                if (animationFrom && animationTo) {
                    const af = animationFrom!;
                    const at = animationTo!;
                    const playerId = playerWhoMoved === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
                    const baseStonesKey = playerId === game.player1.id ? 'baseStones_p1' : 'baseStones_p2';
                    const baseStonesArray = (game as any)[baseStonesKey] as types.Point[] | undefined;
                    if (baseStonesArray) {
                        const baseStoneIndex = baseStonesArray!.findIndex(bs => bs.x === af.x && bs.y === af.y);
                        if (baseStoneIndex !== -1) {
                            baseStonesArray![baseStoneIndex].x = at.x;
                            baseStonesArray![baseStoneIndex].y = at.y;
                        }
                    }
                }
                
                // moveHistory 업데이트
                if (animationFrom && animationTo) {
                    const af = animationFrom!;
                    const at = animationTo!;
                    let moveIndexToUpdate = -1;
                    for (let i = game.moveHistory.length - 1; i >= 0; i--) {
                        const move = game.moveHistory[i];
                        if (move.x === af.x && move.y === af.y) {
                            if (game.boardState[at.y]?.[at.x] === move.player) {
                                moveIndexToUpdate = i;
                                break;
                            }
                        }
                    }
                    if (moveIndexToUpdate !== -1) {
                        game.moveHistory[moveIndexToUpdate].x = at.x;
                        game.moveHistory[moveIndexToUpdate].y = at.y;
                    }
                }

                if (animationTo) {
                    applyMissileLandingCaptures(game, animationTo, playerWhoMoved);
                }

                // 타이머 복원 및 재개 (턴 유지)
                resumeGameTimer(game, now, playerWhoMoved);
                
                return true;
            }
            
            // 애니메이션이 이미 종료되었어야 하는 경우 즉시 정리 (DB에서 다시 읽혀서 이전 상태로 돌아온 경우 대비)
            if (elapsed > duration + 1000) {
                // 처리된 애니메이션의 startTime을 기록 (중복 처리 방지)
                (game as any).lastProcessedMissileAnimationTime = animationStartTime;
                
                console.warn(`[updateMissileState] Game ${game.id} animation should have ended (elapsed=${elapsed}ms, duration=${duration}ms), forcing cleanup...`);
                const playerWhoMoved = game.currentPlayer;
                const animationFrom = (game.animation as any).from as types.Point | undefined;
                const animationTo = (game.animation as any).to as types.Point | undefined;
                const revealedHiddenStone = (game.animation as any).revealedHiddenStone as types.Point | null | undefined;
                
                // 히든 돌 공개 처리
                if (revealedHiddenStone) {
                    const rs = revealedHiddenStone!;
                    const moveIndex = game.moveHistory.findIndex(m => m.x === rs.x && m.y === rs.y);
                    if (moveIndex !== -1) {
                        if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                        if (!game.permanentlyRevealedStones!.some(p => p.x === rs.x && p.y === rs.y)) {
                            game.permanentlyRevealedStones!.push({ x: rs.x, y: rs.y });
                        }
                    }
                }
                
                // 보드 상태 정리
                if (animationFrom && animationTo) {
                    const af = animationFrom!;
                    const at = animationTo!;
                    const stoneAtFrom = game.boardState[af.y]?.[af.x];
                    if (stoneAtFrom === playerWhoMoved) {
                        game.boardState[af.y][af.x] = types.Player.None;
                    }
                    game.boardState[at.y][at.x] = playerWhoMoved;
                }

                if (animationTo) {
                    applyMissileLandingCaptures(game, animationTo, playerWhoMoved);
                }
                
                game.animation = null;
                game.gameStatus = 'playing';
                
                // 타이머 복원
                if (game.pausedTurnTimeLeft !== undefined) {
                    if (playerWhoMoved === types.Player.Black) {
                        game.blackTimeLeft = game.pausedTurnTimeLeft ?? 0;
                    } else {
                        game.whiteTimeLeft = game.pausedTurnTimeLeft ?? 0;
                    }
                    if (game.settings.timeLimit > 0 && shouldEnforceTimeControl(game)) {
                        const currentPlayerTimeKey = playerWhoMoved === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                        const timeLeft = (game[currentPlayerTimeKey] ?? 0) as number;
                        if (timeLeft > 0) {
                            game.turnDeadline = now + timeLeft * 1000;
                            game.turnStartTime = now;
                        } else {
                            game.turnDeadline = undefined;
                            game.turnStartTime = undefined;
                        }
                    } else {
                        game.turnDeadline = undefined;
                        game.turnStartTime = undefined;
                    }
                    game.pausedTurnTimeLeft = undefined;
                }
                game.itemUseDeadline = undefined;
                return true;
            }
            
            // 애니메이션이 아직 진행 중인 경우 (아무것도 하지 않음)
            // 애니메이션이 너무 오래 지속된 경우 강제로 정리 (서버 재시작 등으로 인한 문제 방지)
            const MAX_ANIMATION_DURATION = 10000; // 10초
            if (elapsed > MAX_ANIMATION_DURATION) {
                // 처리된 애니메이션의 startTime을 먼저 기록 (중복 처리 방지)
                (game as any).lastProcessedMissileAnimationTime = animationStartTime;
                
                console.warn(`[updateMissileState] Game ${game.id} animation exceeded max duration (elapsed=${elapsed}ms), forcing cleanup...`);
                const playerWhoMoved = game.currentPlayer;
                const animationFrom = (game.animation as any).from as types.Point | undefined;
                const animationTo = (game.animation as any).to as types.Point | undefined;
                const revealedHiddenStone = (game.animation as any).revealedHiddenStone as types.Point | null | undefined;
                
                // 히든 돌 공개 처리
                if (revealedHiddenStone) {
                    const rs = revealedHiddenStone!;
                    const moveIndex = game.moveHistory.findIndex(m => m.x === rs.x && m.y === rs.y);
                    if (moveIndex !== -1) {
                        if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                        if (!game.permanentlyRevealedStones!.some(p => p.x === rs.x && p.y === rs.y)) {
                            game.permanentlyRevealedStones!.push({ x: rs.x, y: rs.y });
                        }
                    }
                }
                
                // 보드 상태 정리
                if (animationFrom && animationTo) {
                    const af = animationFrom!;
                    const at = animationTo!;
                    const stoneAtFrom = game.boardState[af.y]?.[af.x];
                    if (stoneAtFrom === playerWhoMoved) {
                        game.boardState[af.y][af.x] = types.Player.None;
                    }
                    game.boardState[at.y][at.x] = playerWhoMoved;
                }

                if (animationTo) {
                    applyMissileLandingCaptures(game, animationTo, playerWhoMoved);
                }
                
                game.animation = null;
                game.gameStatus = 'playing';
                
                // 타이머 복원
                if (game.pausedTurnTimeLeft !== undefined) {
                    if (playerWhoMoved === types.Player.Black) {
                        game.blackTimeLeft = game.pausedTurnTimeLeft ?? 0;
                    } else {
                        game.whiteTimeLeft = game.pausedTurnTimeLeft ?? 0;
                    }
                    if (game.settings.timeLimit > 0 && shouldEnforceTimeControl(game)) {
                        const currentPlayerTimeKey = playerWhoMoved === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                        const timeLeft = (game[currentPlayerTimeKey] ?? 0) as number;
                        if (timeLeft > 0) {
                            game.turnDeadline = now + timeLeft * 1000;
                            game.turnStartTime = now;
                        } else {
                            game.turnDeadline = undefined;
                            game.turnStartTime = undefined;
                        }
                    } else {
                        game.turnDeadline = undefined;
                        game.turnStartTime = undefined;
                    }
                    game.pausedTurnTimeLeft = undefined;
                }
                game.itemUseDeadline = undefined;
                return true;
            }
            
            // 애니메이션이 아직 진행 중인 경우 (elapsed < duration && elapsed <= duration + 1000 && elapsed <= MAX_ANIMATION_DURATION)
            // 아무것도 하지 않고 false 반환 (게임 상태 변경 없음)
            return false;
        } else {
            // 미사일 애니메이션이 아닌 경우, 상태가 잘못된 것일 수 있음
            if (game.animation) {
                console.warn(`[updateMissileState] Game ${game.id} has missile_animating status but animation type is ${game.animation!.type}, cleaning up...`);
            }
            game.animation = null;
            game.gameStatus = 'playing';
            return true;
        }
    }
    
    // 게임 상태가 변경되지 않았음을 반환
    return false;
};

export const handleMissileAction = (game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): HandleActionResult | null => {
    const { type, payload } = action as any;
    const now = Date.now();
    let myPlayerEnum = user.id === game.blackPlayerId ? types.Player.Black : (user.id === game.whitePlayerId ? types.Player.White : types.Player.None);
    // 탑/PVE: 일부 세션에서 player1(인간)과 blackPlayerId 불일치 시 None → LAUNCH가 "Not your stone"으로 400
    if (myPlayerEnum === types.Player.None && game.player1?.id === user.id) {
        myPlayerEnum = types.Player.Black;
    }
    const isMyTurn = myPlayerEnum === game.currentPlayer;
    // 도전의 탑/싱글: 유저가 방금 둔 직후(턴이 AI로 넘어갔지만 AI가 아직 두기 전)에도 미사일 허용 (싱글플레이와 동일)
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
    const canUseMissile = isMyTurn || allowItemAfterMyMove;

    switch (type) {
        case 'START_MISSILE_SELECTION': {
            if (!canUseMissile || game.gameStatus !== 'playing') {
                console.warn(`[Missile Go] START_MISSILE_SELECTION failed: isMyTurn=${isMyTurn}, canUseMissile=${canUseMissile}, gameStatus=${game.gameStatus}, gameId=${game.id}`);
                return { error: "Not your turn to use an item." };
            }
            
            // 미사일 아이템 개수 확인 (게임별 missiles_p1/p2 또는 설정 상한)
            const missileKey = user.id === game.player1.id ? 'missiles_p1' : 'missiles_p2';
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
                console.log(`[Missile Go] LAUNCH_MISSILE: using client moveHistory for validation, gameId=${game.id}`);
                game.moveHistory = clientMoveHistory;
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
            // 따내기는 이동 애니메이션 종료 시점에 적용(updateMissileState / MISSILE_ANIMATION_COMPLETE) — 점수 연출 순서

            // 배치돌 업데이트: 원래 자리의 배치돌을 목적지로 이동
            if (game.baseStones) {
                const baseStoneIndex = game.baseStones.findIndex(bs => bs.x === from.x && bs.y === from.y);
                if (baseStoneIndex !== -1) {
                    game.baseStones[baseStoneIndex].x = to.x;
                    game.baseStones[baseStoneIndex].y = to.y;
                }
            }
            
            // 싱글플레이에서 baseStones_p1, baseStones_p2도 확인
            const playerId = myPlayerEnum === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
            const baseStonesKey = playerId === game.player1.id ? 'baseStones_p1' : 'baseStones_p2';
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
            
            game.animation = animationData;
            game.gameStatus = 'missile_animating';
            
            // 미사일 아이템 개수 감소
            const missileKey = user.id === game.player1.id ? 'missiles_p1' : 'missiles_p2';
            game[missileKey] = (game[missileKey] ?? 0) - 1;

            if (game.gameCategory === 'tower' && user.id === game.player1?.id) {
                if (consumeOneTowerLobbyInventoryItem(user, TOWER_LOBBY_MISSILE_NAMES)) {
                    scheduleTowerP1InventorySave(user);
                }
            }
            
            // 미사일 아이템은 턴을 사용하는 행동이 아니므로 totalTurns를 증가시키지 않음
            
            return {};
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
            if (game.gameStatus !== 'missile_animating' && game.gameStatus !== 'playing') {
                console.warn(`[Missile Go] MISSILE_ANIMATION_COMPLETE failed: gameStatus=${game.gameStatus}, expected=missile_animating or playing, gameId=${game.id}`);
                return { error: "Not in missile animation state." };
            }
            
            // 애니메이션이 이미 완료되었거나 없는 경우, 게임 상태만 확인하고 정리
            if (!game.animation || (game.animation.type !== 'missile' && game.animation.type !== 'hidden_missile')) {
                // 애니메이션이 없는데 게임 상태가 missile_animating인 경우 정리
                if (game.gameStatus === 'missile_animating') {
                    console.log(`[Missile Go] MISSILE_ANIMATION_COMPLETE: cleaning up stuck missile_animating state, gameId=${game.id}`);
                    game.gameStatus = 'playing';
                    const playerWhoMoved = game.currentPlayer;
                    if (game.pausedTurnTimeLeft !== undefined) {
                        if (playerWhoMoved === types.Player.Black) {
                            game.blackTimeLeft = game.pausedTurnTimeLeft;
                        } else {
                            game.whiteTimeLeft = game.pausedTurnTimeLeft;
                        }
                    }
                    if (game.settings.timeLimit > 0 && shouldEnforceTimeControl(game)) {
                        const currentPlayerTimeKey = playerWhoMoved === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                        const timeLeft = game[currentPlayerTimeKey] ?? 0;
                        if (timeLeft > 0) {
                            game.turnDeadline = now + timeLeft * 1000;
                            game.turnStartTime = now;
                        } else {
                            game.turnDeadline = undefined;
                            game.turnStartTime = undefined;
                        }
                    } else {
                        game.turnDeadline = undefined;
                        game.turnStartTime = undefined;
                    }
                    game.pausedTurnTimeLeft = undefined;
                    game.itemUseDeadline = undefined;
                    console.log(`[Missile Go] MISSILE_ANIMATION_COMPLETE: cleaned up stuck state, gameId=${game.id}, gameStatus=${game.gameStatus}`);
                    return { clientResponse: { gameUpdated: true } };
                }
                // 이미 완료된 경우 성공으로 반환
                console.log(`[Missile Go] MISSILE_ANIMATION_COMPLETE: animation already completed, gameId=${game.id}`);
                return { clientResponse: { gameUpdated: true } };
            }
            
            // updateMissileState의 애니메이션 완료 로직을 직접 실행
            const animationStartTime = game.animation.startTime;
            const lastProcessedAnimationTime = (game as any).lastProcessedMissileAnimationTime;
            
            // 이미 처리된 애니메이션인지 확인
            if (lastProcessedAnimationTime === animationStartTime) {
                console.log(`[Missile Go] MISSILE_ANIMATION_COMPLETE: animation already processed, gameId=${game.id}`);
                // 이미 처리되었어도 게임 상태가 여전히 missile_animating이면 정리
                if (game.gameStatus === 'missile_animating') {
                    console.log(`[Missile Go] MISSILE_ANIMATION_COMPLETE: gameStatus still missile_animating after processing, cleaning up, gameId=${game.id}`);
                    game.gameStatus = 'playing';
                    game.animation = null;
                    return { clientResponse: { gameUpdated: true } };
                }
                return { clientResponse: { gameUpdated: true } };
            }
            
            // 처리된 애니메이션의 startTime을 먼저 기록 (중복 처리 방지)
            (game as any).lastProcessedMissileAnimationTime = animationStartTime;
            
            // 애니메이션 정보 저장 (null 설정 전에) — 타이머 복원에 사용
            const playerWhoMoved = game.currentPlayer;
            const missileLandingTo =
                game.animation && (game.animation.type === 'missile' || game.animation.type === 'hidden_missile')
                    ? ((game.animation as any).to as types.Point | undefined)
                    : undefined;

            // 애니메이션 제거
            game.animation = null;
            
            // 게임 상태를 playing으로 변경
            // (보드/배치돌/moveHistory는 이미 LAUNCH_MISSILE에서 이동 처리되었으므로 여기서 변경하지 않음)
            game.gameStatus = 'playing';

            if (missileLandingTo) {
                applyMissileLandingCaptures(game, missileLandingTo, playerWhoMoved);
            }
            
            // 타이머 복원 (아이템 사용 시간이 마감되고 원래 턴 시간으로 복귀)
            if (game.pausedTurnTimeLeft !== undefined) {
                if (playerWhoMoved === types.Player.Black) {
                    game.blackTimeLeft = game.pausedTurnTimeLeft;
                } else {
                    game.whiteTimeLeft = game.pausedTurnTimeLeft;
                }
            }
            
            // 타이머 재개 (턴 유지)
            if (game.settings.timeLimit > 0 && shouldEnforceTimeControl(game)) {
                const currentPlayerTimeKey = playerWhoMoved === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                const timeLeft = game[currentPlayerTimeKey] ?? 0;
                if (timeLeft > 0) {
                    game.turnDeadline = now + timeLeft * 1000;
                    game.turnStartTime = now;
                } else {
                    game.turnDeadline = undefined;
                    game.turnStartTime = undefined;
                }
            } else {
                game.turnDeadline = undefined;
                game.turnStartTime = undefined;
            }
            
            game.pausedTurnTimeLeft = undefined;
            game.itemUseDeadline = undefined;
            
            console.log(`[Missile Go] MISSILE_ANIMATION_COMPLETE: animation completed, gameId=${game.id}, gameStatus=${game.gameStatus}`);
            // 게임 상태가 변경되었으므로 반드시 저장하고 브로드캐스트해야 함을 표시
            return { clientResponse: { gameUpdated: true } };
        }
    }
    
    return null;
};
