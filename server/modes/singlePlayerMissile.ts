import * as types from '../../types/index.js';

type HandleActionResult = types.HandleActionResult;

export const initializeSinglePlayerMissile = (game: types.LiveGameSession) => {
    const isMissileMode = game.mode === types.GameMode.Missile || (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Missile));
    if (isMissileMode && game.isSinglePlayer) {
        game.missiles_p1 = game.settings.missileCount;
        game.missiles_p2 = game.settings.missileCount;
    }
};

/**
 * 싱글플레이용 미사일 경로 계산: 가장 먼 곳으로 이동
 * - 중간에 바둑돌이 있으면 그 앞에서 멈춤
 * - 상대방의 히든 돌은 통과
 * - 도착지점에 상대방의 히든 돌이 있으면 그 이전 자리로 이동
 */
function calculateSinglePlayerMissilePath(
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
        
        // 빈 칸이면 계속 이동
        if (stoneAtNext === types.Player.None) {
            current = next;
            continue;
        }
        
        // 내 돌이면 멈춤 (현재 위치에서 멈춤, next 위치로 가지 않음)
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
        if (stoneAtNext !== types.Player.None && stoneAtNext !== myPlayerEnum && stoneAtNext !== opponentEnum) {
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

export const updateSinglePlayerMissileState = (game: types.LiveGameSession, now: number): boolean => {
    // 싱글플레이 게임이 아니면 처리하지 않음
    if (!game.isSinglePlayer) {
        return false;
    }

    // 아이템 사용 시간 초과 처리
    if (game.gameStatus === 'missile_selecting' && game.itemUseDeadline && now > game.itemUseDeadline) {
        const timedOutPlayerEnum = game.currentPlayer;
        const timedOutPlayerId = timedOutPlayerEnum === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
        
        console.log(`[SinglePlayer Missile] Item use deadline expired for game ${game.id}, player ${timedOutPlayerId}, restoring game state`);
        
        game.foulInfo = { 
            message: `${game.player1.id === timedOutPlayerId ? game.player1.nickname : game.player2.nickname}님의 아이템 시간 초과!`, 
            expiry: now + 4000 
        };
        game.gameStatus = 'playing';
        
        // 미사일 아이템 소멸
        const missileKey = timedOutPlayerId === game.player1.id ? 'missiles_p1' : 'missiles_p2';
        const currentMissiles = game[missileKey] ?? 0;
        if (currentMissiles > 0) {
            game[missileKey] = currentMissiles - 1;
        }
        
        // 원래 경기 시간 복원 (턴 유지)
        if (game.settings.timeLimit > 0) {
            if (game.pausedTurnTimeLeft !== undefined) {
                const currentPlayerTimeKey = timedOutPlayerEnum === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                game[currentPlayerTimeKey] = game.pausedTurnTimeLeft;
                game.turnDeadline = now + game[currentPlayerTimeKey] * 1000;
                game.turnStartTime = now;
            } else {
                // pausedTurnTimeLeft가 없으면 현재 시간 사용
                const currentPlayerTimeKey = timedOutPlayerEnum === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                const currentTime = game[currentPlayerTimeKey] ?? 0;
                if (currentTime > 0) {
                    game.turnDeadline = now + currentTime * 1000;
                    game.turnStartTime = now;
                } else {
                    game.turnDeadline = undefined;
                    game.turnStartTime = undefined;
                }
            }
        } else {
            game.turnDeadline = undefined;
            game.turnStartTime = undefined;
        }
        
        game.itemUseDeadline = undefined;
        game.pausedTurnTimeLeft = undefined;
        return true; // 게임 상태가 변경되었음을 반환
    }
    
    // 애니메이션 처리
    if (game.gameStatus === 'missile_animating') {
        // animation이 null인데 gameStatus가 여전히 missile_animating인 경우 정리
        if (!game.animation) {
            console.warn(`[SinglePlayer Missile] Game ${game.id} has missile_animating status but no animation, cleaning up...`);
            game.gameStatus = 'playing';
            const playerWhoMoved = game.currentPlayer;
            if (game.pausedTurnTimeLeft !== undefined) {
                if (playerWhoMoved === types.Player.Black) {
                    game.blackTimeLeft = game.pausedTurnTimeLeft;
                } else {
                    game.whiteTimeLeft = game.pausedTurnTimeLeft;
                }
            }
            if (game.settings.timeLimit > 0) {
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
            return true;
        }
        
        // 미사일 애니메이션인 경우에만 처리
        if (game.animation.type === 'missile' || game.animation.type === 'hidden_missile') {
            const elapsed = now - game.animation.startTime;
            const duration = game.animation.duration;
            const animationStartTime = game.animation.startTime;
            
            // 이미 처리된 애니메이션인지 확인 (중복 처리 방지)
            const lastProcessedAnimationTime = (game as any).lastProcessedMissileAnimationTime;
            if (lastProcessedAnimationTime === animationStartTime) {
                // 이미 처리된 애니메이션 - 게임 상태가 여전히 missile_animating이면 정리
                if (game.gameStatus === 'missile_animating') {
                    console.log(`[SinglePlayer Missile] Cleaning up already processed animation, gameId=${game.id}`);
                    game.animation = null;
                    game.gameStatus = 'playing';
                    // 타이머 복원
                    const playerWhoMoved = game.currentPlayer;
                    if (game.pausedTurnTimeLeft !== undefined) {
                        if (playerWhoMoved === types.Player.Black) {
                            game.blackTimeLeft = game.pausedTurnTimeLeft;
                        } else {
                            game.whiteTimeLeft = game.pausedTurnTimeLeft;
                        }
                    }
                    if (game.settings.timeLimit > 0) {
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
                    return true; // 상태 변경이 있었으므로 true 반환
                }
                // 이미 playing 상태면 변경 없음
                return false;
            }
            
            // 애니메이션이 종료되었는지 확인 (정상 종료: elapsed >= duration)
            // 멀티플레이어와 동일하게 서버 루프에서 자동으로 처리
            if (elapsed >= duration) {
                // 이미 처리된 애니메이션인지 확인 (중복 처리 방지)
                const lastProcessedAnimationTime = (game as any).lastProcessedMissileAnimationTime;
                if (lastProcessedAnimationTime === animationStartTime) {
                    // 이미 처리된 애니메이션 - 게임 상태가 여전히 missile_animating이면 정리
                    if (game.gameStatus === 'missile_animating') {
                        console.log(`[SinglePlayer Missile] Cleaning up already processed animation, gameId=${game.id}`);
                        game.animation = null;
                        game.gameStatus = 'playing';
                        // 타이머 복원
                        const playerWhoMoved = game.currentPlayer;
                        if (game.pausedTurnTimeLeft !== undefined) {
                            if (playerWhoMoved === types.Player.Black) {
                                game.blackTimeLeft = game.pausedTurnTimeLeft;
                            } else {
                                game.whiteTimeLeft = game.pausedTurnTimeLeft;
                            }
                        }
                        if (game.settings.timeLimit > 0) {
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
                        return true; // 상태 변경이 있었으므로 true 반환
                    }
                    return false; // 이미 처리되었고 상태도 playing이면 더 이상 변경 없음
                }
                
                // 처리된 애니메이션의 startTime을 먼저 기록 (중복 처리 방지)
                (game as any).lastProcessedMissileAnimationTime = animationStartTime;
                
                // 애니메이션 정보를 먼저 저장 (null 설정 전에)
                const playerWhoMoved = game.currentPlayer;
                const animationFrom = game.animation.from;
                const animationTo = game.animation.to;
                const revealedHiddenStone = (game.animation as any).revealedHiddenStone as types.Point | null | undefined;
                
                // 애니메이션 제거
                game.animation = null;
                
                // 게임 상태를 playing으로 변경
                game.gameStatus = 'playing';
                
                // 히든 돌 공개 처리
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
                
                // 보드 상태는 이미 LAUNCH_MISSILE에서 변경되었으므로 여기서는 확인만
                // (LAUNCH_MISSILE에서 이미 원래 자리의 돌을 제거하고 목적지에 돌을 배치했음)
                if (animationFrom && animationTo) {
                    // 보드 상태 확인 (이미 변경되어 있어야 함)
                    const stoneAtTo = game.boardState[animationTo.y]?.[animationTo.x];
                    const stoneAtFrom = game.boardState[animationFrom.y]?.[animationFrom.x];
                    
                    // 보드 상태가 올바르지 않으면 수정
                    if (stoneAtTo !== playerWhoMoved) {
                        console.warn(`[SinglePlayer Missile] Board state mismatch at destination, fixing... gameId=${game.id}`);
                        game.boardState[animationTo.y][animationTo.x] = playerWhoMoved;
                    }
                    if (stoneAtFrom !== types.Player.None) {
                        console.warn(`[SinglePlayer Missile] Board state mismatch at source, fixing... gameId=${game.id}`);
                        game.boardState[animationFrom.y][animationFrom.x] = types.Player.None;
                    }
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
                if (game.settings.timeLimit > 0) {
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
                
                console.log(`[SinglePlayer Missile] Animation completed, gameStatus changed to playing: gameId=${game.id}, playerWhoMoved=${playerWhoMoved === types.Player.Black ? 'Black' : 'White'}`);
                return true; // 상태 변경이 있었으므로 true 반환하여 브로드캐스트 트리거
            }
        } else {
            // 미사일 애니메이션이 아닌 경우, 상태가 잘못된 것일 수 있음
            console.warn(`[SinglePlayer Missile] Game ${game.id} has missile_animating status but animation type is ${game.animation.type}, cleaning up...`);
            game.animation = null;
            game.gameStatus = 'playing';
            return true;
        }
    }
    
    return false; // 게임 상태가 변경되지 않았음을 반환
};

export const handleSinglePlayerMissileAction = (game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): HandleActionResult | null => {
    // 싱글플레이 게임이 아니면 처리하지 않음
    if (!game.isSinglePlayer) {
        return null;
    }

    const { type, payload } = action;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? types.Player.Black : (user.id === game.whitePlayerId ? types.Player.White : types.Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;

    switch (type) {
        case 'START_MISSILE_SELECTION': {
            if (!isMyTurn || game.gameStatus !== 'playing') {
                console.warn(`[SinglePlayer Missile] START_MISSILE_SELECTION failed: isMyTurn=${isMyTurn}, gameStatus=${game.gameStatus}, gameId=${game.id}`);
                return { error: "Not your turn to use an item." };
            }
            
            // 미사일 아이템 개수 확인
            const missileKey = user.id === game.player1.id ? 'missiles_p1' : 'missiles_p2';
            const myMissilesLeft = game[missileKey] ?? game.settings.missileCount ?? 0;
            if (myMissilesLeft <= 0) {
                console.warn(`[SinglePlayer Missile] START_MISSILE_SELECTION failed: no missiles left, gameId=${game.id}`);
                return { error: "No missiles left." };
            }
            
            // 게임 상태를 missile_selecting으로 변경
            game.gameStatus = 'missile_selecting';
            
            // 원래 경기 시간 일시 정지
            if (game.settings.timeLimit > 0) {
                if (game.turnDeadline) {
                    // turnDeadline이 있으면 남은 시간 계산
                    game.pausedTurnTimeLeft = (game.turnDeadline - now) / 1000;
                } else {
                    // turnDeadline이 없으면 현재 시간 사용
                    const currentPlayerTimeKey = myPlayerEnum === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                    game.pausedTurnTimeLeft = game[currentPlayerTimeKey] ?? 0;
                }
                console.log(`[SinglePlayer Missile] START_MISSILE_SELECTION: Paused time for ${myPlayerEnum === types.Player.Black ? 'Black' : 'White'}, pausedTurnTimeLeft=${game.pausedTurnTimeLeft}`);
            }
            game.turnDeadline = undefined;
            game.turnStartTime = undefined;
            
            // 아이템 사용 시간 30초 부여
            game.itemUseDeadline = now + 30000;
            
            console.log(`[SinglePlayer Missile] START_MISSILE_SELECTION: gameStatus changed to missile_selecting, gameId=${game.id}`);
            return { clientResponse: { gameUpdated: true } };
        }
        
        case 'LAUNCH_MISSILE': {
            if (game.gameStatus !== 'missile_selecting') {
                console.warn(`[SinglePlayer Missile] LAUNCH_MISSILE failed: gameStatus=${game.gameStatus}, expected=missile_selecting, gameId=${game.id}`);
                return { error: "Not in missile selection mode." };
            }
            
            // 아이템 사용 시간 확인
            if (game.itemUseDeadline && now > game.itemUseDeadline) {
                console.warn(`[SinglePlayer Missile] LAUNCH_MISSILE failed: item use time expired, gameId=${game.id}`);
                return { error: "Item use time expired." };
            }
            
            // 이미 애니메이션이 진행 중인 경우 무시 (중복 방지)
            if (game.animation) {
                console.warn(`[SinglePlayer Missile] LAUNCH_MISSILE failed: animation already exists, gameId=${game.id}`);
                return { error: "Animation already in progress." };
            }
            
            const { from, direction } = payload;
            if (!from || !direction) {
                console.warn(`[SinglePlayer Missile] LAUNCH_MISSILE failed: missing from or direction, payload=${JSON.stringify(payload)}, gameId=${game.id}`);
                return { error: "Invalid payload: missing from or direction." };
            }
            
            if (from.x < 0 || from.x >= game.settings.boardSize || from.y < 0 || from.y >= game.settings.boardSize) {
                console.warn(`[SinglePlayer Missile] LAUNCH_MISSILE failed: invalid from coordinates, from=${JSON.stringify(from)}, boardSize=${game.settings.boardSize}, gameId=${game.id}`);
                return { error: "Invalid stone position." };
            }
            
            // 싱글플레이어 게임에서는 boardState, moveHistory, baseStones_p1/baseStones_p2를 모두 확인
            // (클라이언트에서 새로 놓은 돌이 서버의 boardState에 아직 반영되지 않았을 수 있음)
            const stoneAtFrom = game.boardState[from.y]?.[from.x];
            const moveAtFrom = game.moveHistory.find(m => m.x === from.x && m.y === from.y && m.player === myPlayerEnum);
            
            // baseStones_p1, baseStones_p2도 확인 (랜덤 배치된 돌)
            const playerId = myPlayerEnum === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
            const baseStonesKey = playerId === game.player1.id ? 'baseStones_p1' : 'baseStones_p2';
            const baseStonesArray = (game as any)[baseStonesKey] as types.Point[] | undefined;
            const isBaseStone = baseStonesArray?.some(bs => bs.x === from.x && bs.y === from.y) || false;
            
            const isMyStone = stoneAtFrom === myPlayerEnum || !!moveAtFrom || isBaseStone;
            
            if (!isMyStone) {
                console.warn(`[SinglePlayer Missile] LAUNCH_MISSILE failed: not your stone, from=${JSON.stringify(from)}, stoneAtFrom=${stoneAtFrom}, myPlayerEnum=${myPlayerEnum}, hasMoveHistory=${!!moveAtFrom}, isBaseStone=${isBaseStone}, gameId=${game.id}`);
                return { error: "Not your stone." };
            }
            
            // moveHistory나 baseStones에는 있지만 boardState에 반영되지 않은 경우 boardState 업데이트
            if ((moveAtFrom || isBaseStone) && stoneAtFrom !== myPlayerEnum) {
                console.log(`[SinglePlayer Missile] LAUNCH_MISSILE: updating boardState for newly placed stone, from=${JSON.stringify(from)}, gameId=${game.id}`);
                game.boardState[from.y][from.x] = myPlayerEnum;
            }
            
            // 미사일 경로 계산
            const { to, revealedHiddenStone } = calculateSinglePlayerMissilePath(game, from, direction, myPlayerEnum);
            
            if (to.x === from.x && to.y === from.y) {
                console.warn(`[SinglePlayer Missile] LAUNCH_MISSILE failed: cannot move stone, from=${JSON.stringify(from)}, to=${JSON.stringify(to)}, direction=${direction}, gameId=${game.id}`);
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
            
            // 보드 상태 변경: 원래 자리의 돌 제거, 목적지에 돌 배치
            // 원래 자리의 돌 제거
            game.boardState[from.y][from.x] = types.Player.None;
            // 목적지에 돌 배치
            game.boardState[to.y][to.x] = myPlayerEnum;
            
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
            
            // moveHistory 업데이트: 원래 자리의 이동 기록을 목적지로 변경
            const fromMoveIndex = game.moveHistory.findIndex(m => m.x === from.x && m.y === from.y && m.player === myPlayerEnum);
            if (fromMoveIndex !== -1) {
                game.moveHistory[fromMoveIndex].x = to.x;
                game.moveHistory[fromMoveIndex].y = to.y;
            } else {
                // 원래 자리의 이동 기록이 없으면 새로 추가
                game.moveHistory.push({
                    x: to.x,
                    y: to.y,
                    player: myPlayerEnum,
                    timestamp: now
                });
            }
            
            // 아이템 사용 시간 일시 정지 (애니메이션 중)
            game.itemUseDeadline = undefined;
            
            // 애니메이션 설정 (2초)
            // 새로운 애니메이션 시작 시 이전 처리 기록 초기화
            (game as any).lastProcessedMissileAnimationTime = undefined;
            
            const animationData: any = {
                type: revealedHiddenStone ? 'hidden_missile' : 'missile',
                from,
                to,
                player: myPlayerEnum,
                startTime: now,
                duration: 2000
            };
            
            if (revealedHiddenStone) {
                animationData.revealedHiddenStone = revealedHiddenStone;
            }
            
            game.animation = animationData;
            game.gameStatus = 'missile_animating';
            
            // 미사일 아이템 개수 감소
            const missileKey = user.id === game.player1.id ? 'missiles_p1' : 'missiles_p2';
            game[missileKey] = (game[missileKey] ?? 0) - 1;
            
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
        
        case 'MISSILE_ANIMATION_COMPLETE': {
            // 클라이언트가 애니메이션 완료를 알림
            if (game.gameStatus !== 'missile_animating' && game.gameStatus !== 'playing') {
                console.warn(`[SinglePlayer Missile] MISSILE_ANIMATION_COMPLETE failed: gameStatus=${game.gameStatus}, expected=missile_animating or playing, gameId=${game.id}`);
                return { error: "Not in missile animation state." };
            }
            
            // 애니메이션이 이미 완료되었거나 없는 경우, 게임 상태만 확인하고 정리
            if (!game.animation || (game.animation.type !== 'missile' && game.animation.type !== 'hidden_missile')) {
                // 애니메이션이 없는데 게임 상태가 missile_animating인 경우 정리
                if (game.gameStatus === 'missile_animating') {
                    console.log(`[SinglePlayer Missile] MISSILE_ANIMATION_COMPLETE: cleaning up stuck missile_animating state, gameId=${game.id}`);
                    game.gameStatus = 'playing';
                    const playerWhoMoved = game.currentPlayer;
                    if (game.pausedTurnTimeLeft !== undefined) {
                        if (playerWhoMoved === types.Player.Black) {
                            game.blackTimeLeft = game.pausedTurnTimeLeft;
                        } else {
                            game.whiteTimeLeft = game.pausedTurnTimeLeft;
                        }
                    }
                    if (game.settings.timeLimit > 0) {
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
                    console.log(`[SinglePlayer Missile] MISSILE_ANIMATION_COMPLETE: cleaned up stuck state, gameId=${game.id}, gameStatus=${game.gameStatus}`);
                    return { clientResponse: { gameUpdated: true } };
                }
                // 이미 완료된 경우 성공으로 반환
                console.log(`[SinglePlayer Missile] MISSILE_ANIMATION_COMPLETE: animation already completed, gameId=${game.id}`);
                return { clientResponse: { gameUpdated: true } };
            }
            
            // 애니메이션 완료 처리
            const animationStartTime = game.animation.startTime;
            const lastProcessedAnimationTime = (game as any).lastProcessedMissileAnimationTime;
            
            // 이미 처리된 애니메이션인지 확인
            if (lastProcessedAnimationTime === animationStartTime) {
                console.log(`[SinglePlayer Missile] MISSILE_ANIMATION_COMPLETE: animation already processed, gameId=${game.id}`);
                // 이미 처리되었어도 게임 상태가 여전히 missile_animating이면 정리
                if (game.gameStatus === 'missile_animating') {
                    console.log(`[SinglePlayer Missile] MISSILE_ANIMATION_COMPLETE: gameStatus still missile_animating after processing, cleaning up, gameId=${game.id}`);
                    game.gameStatus = 'playing';
                    game.animation = null;
                    return { clientResponse: { gameUpdated: true } };
                }
                return { clientResponse: { gameUpdated: true } };
            }
            
            // 처리된 애니메이션의 startTime을 먼저 기록 (중복 처리 방지)
            (game as any).lastProcessedMissileAnimationTime = animationStartTime;
            
            // 애니메이션 정보를 먼저 저장 (null 설정 전에)
            const playerWhoMoved = game.currentPlayer;
            const animationFrom = game.animation.from;
            const animationTo = game.animation.to;
            const revealedHiddenStone = (game.animation as any).revealedHiddenStone as types.Point | null | undefined;
            
            // 애니메이션 제거
            game.animation = null;
            
            // 게임 상태를 playing으로 변경
            game.gameStatus = 'playing';
            
            // 멀티플레이어 로직과 동일: 애니메이션이 끝나면 원래 자리의 돌만 제거
            // (목적지의 돌은 이미 LAUNCH_MISSILE에서 배치되었으므로 그대로 유지)
            if (animationFrom && animationTo) {
                const stoneAtFrom = game.boardState[animationFrom.y]?.[animationFrom.x];
                // 원래 자리의 돌 제거 (목적지의 돌은 이미 배치되어 있음)
                if (stoneAtFrom === playerWhoMoved) {
                    game.boardState[animationFrom.y][animationFrom.x] = types.Player.None;
                }
                
                // 배치돌 업데이트: 원래 자리의 배치돌 제거 (싱글플레이 특성 고려)
                if (game.baseStones) {
                    const baseStoneIndex = game.baseStones.findIndex(bs => bs.x === animationFrom.x && bs.y === animationFrom.y);
                    if (baseStoneIndex !== -1) {
                        game.baseStones.splice(baseStoneIndex, 1);
                    }
                }
                
                // 싱글플레이에서 baseStones_p1, baseStones_p2도 확인
                const playerId = playerWhoMoved === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
                const baseStonesKey = playerId === game.player1.id ? 'baseStones_p1' : 'baseStones_p2';
                const baseStonesArray = (game as any)[baseStonesKey] as types.Point[] | undefined;
                if (baseStonesArray) {
                    const baseStoneIndex = baseStonesArray.findIndex(bs => bs.x === animationFrom.x && bs.y === animationFrom.y);
                    if (baseStoneIndex !== -1) {
                        baseStonesArray.splice(baseStoneIndex, 1);
                    }
                }
                
                // moveHistory에서 원래 자리의 이동 기록 제거 (목적지의 이동 기록은 이미 추가됨)
                const fromMoveIndex = game.moveHistory.findIndex(m => m.x === animationFrom.x && m.y === animationFrom.y && m.player === playerWhoMoved);
                if (fromMoveIndex !== -1) {
                    // 원래 자리의 이동 기록 제거 (목적지의 이동 기록은 유지)
                    game.moveHistory.splice(fromMoveIndex, 1);
                }
            }
            
            // 히든 돌 공개 처리
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
            
            // 타이머 복원 (아이템 사용 시간이 마감되고 원래 턴 시간으로 복귀)
            if (game.pausedTurnTimeLeft !== undefined) {
                if (playerWhoMoved === types.Player.Black) {
                    game.blackTimeLeft = game.pausedTurnTimeLeft;
                } else {
                    game.whiteTimeLeft = game.pausedTurnTimeLeft;
                }
                console.log(`[SinglePlayer Missile] MISSILE_ANIMATION_COMPLETE: Restored time for ${playerWhoMoved === types.Player.Black ? 'Black' : 'White'}, timeLeft=${game.pausedTurnTimeLeft}`);
            } else {
                // pausedTurnTimeLeft가 없으면 현재 시간에서 계산
                const currentPlayerTimeKey = playerWhoMoved === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                const currentTime = game[currentPlayerTimeKey] ?? 0;
                console.log(`[SinglePlayer Missile] MISSILE_ANIMATION_COMPLETE: No pausedTurnTimeLeft, using current time ${currentTime} for ${playerWhoMoved === types.Player.Black ? 'Black' : 'White'}`);
            }
            
            // 타이머 재개 (턴 유지)
            if (game.settings.timeLimit > 0) {
                const currentPlayerTimeKey = playerWhoMoved === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                const timeLeft = game[currentPlayerTimeKey] ?? 0;
                if (timeLeft > 0) {
                    game.turnDeadline = now + timeLeft * 1000;
                    game.turnStartTime = now;
                    console.log(`[SinglePlayer Missile] MISSILE_ANIMATION_COMPLETE: Resumed timer, turnDeadline=${new Date(game.turnDeadline).toISOString()}, timeLeft=${timeLeft}`);
                } else {
                    game.turnDeadline = undefined;
                    game.turnStartTime = undefined;
                    console.log(`[SinglePlayer Missile] MISSILE_ANIMATION_COMPLETE: No time left, cleared timer`);
                }
            } else {
                game.turnDeadline = undefined;
                game.turnStartTime = undefined;
            }
            
            game.pausedTurnTimeLeft = undefined;
            game.itemUseDeadline = undefined;
            
            console.log(`[SinglePlayer Missile] MISSILE_ANIMATION_COMPLETE: animation completed, gameId=${game.id}, gameStatus=${game.gameStatus}`);
            // 게임 상태가 변경되었으므로 반드시 저장하고 브로드캐스트해야 함을 표시
            return { clientResponse: { gameUpdated: true } };
        }
    }
    
    return null;
};

