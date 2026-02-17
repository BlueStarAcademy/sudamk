import * as types from '../../types/index.js';
import * as db from '../db.js';
import { handleSharedAction, updateSharedGameState, handleTimeoutFoul } from './shared.js';
import { aiUserId } from '../aiPlayer.js';
import { CURLING_TURN_TIME_LIMIT, PLAYFUL_MODE_FOUL_LIMIT } from '../../constants';
import { endGame } from '../summaryService.js';
import * as effectService from '../effectService.js';

// --- Simulation & Scoring Logic ---
const runServerSimulation = (initialStones: types.AlkkagiStone[], flickedStone: types.AlkkagiStone, velocity: types.Point): { finalStones: types.AlkkagiStone[], stonesFallen: types.AlkkagiStone[] } => {
    let simStones: types.AlkkagiStone[] = JSON.parse(JSON.stringify(initialStones || []));
    let stoneToAnimate = { ...flickedStone, vx: velocity.x, vy: velocity.y, onBoard: true };
    simStones.push(stoneToAnimate);

    const boardSizePx = 840;
    const friction = 0.98;
    const maxIterations = 1000;
    let iterations = 0;
    const stonesFallen: types.AlkkagiStone[] = [];

    while (iterations < maxIterations) {
        let stonesAreMoving = false;
        
        for (const stone of simStones) {
            if (!stone.onBoard) continue;
            
            // Use fixed time step logic to match server simulation
            stone.x += stone.vx;
            stone.y += stone.vy;
            stone.vx *= friction;
            stone.vy *= friction;

            if (Math.abs(stone.vx) < 0.01) stone.vx = 0;
            if (Math.abs(stone.vy) < 0.01) stone.vy = 0;
            if (stone.vx !== 0 || stone.vy !== 0) {
                stonesAreMoving = true;
            }

            if (stone.x < 0 || stone.x > boardSizePx || stone.y < 0 || stone.y > boardSizePx) {
                if (stone.onBoard) {
                    stone.onBoard = false;
                    stonesFallen.push(stone);
                }
            }
        }
        for (let i = 0; i < simStones.length; i++) {
            for (let j = i + 1; j < simStones.length; j++) {
                const s1 = simStones[i];
                const s2 = simStones[j];
                if (!s1.onBoard || !s2.onBoard) continue;
                const dx = s2.x - s1.x;
                const dy = s2.y - s1.y;
                const distance = Math.hypot(dx,dy);
                const radiiSum = s1.radius + s2.radius;
                if (distance < radiiSum) {
                    const nx = dx / distance;
                    const ny = dy / distance;
                    const dvx = s2.vx - s1.vx;
                    const dvy = s2.vy - s1.vy;
                    const dot = dvx * nx + dvy * ny;
                    if (dot < 0) {
                        const impulse = dot;
                        s1.vx += impulse * nx;
                        s1.vy += impulse * ny;
                        s2.vx -= impulse * nx;
                        s2.vy -= impulse * ny;
                    }
                    const overlap = (radiiSum - distance) / 2;
                    s1.x -= overlap * nx;
                    s1.y -= overlap * ny;
                    s2.x += overlap * nx;
                    s2.y += overlap * ny;
                }
            }
        }
        
        if (!stonesAreMoving) break;
        iterations++;
    }

    return { finalStones: simStones, stonesFallen };
};


const endCurlingRound = (game: types.LiveGameSession, now: number) => {
    const boardSizePx = 840;
    const center = { x: boardSizePx / 2, y: boardSizePx / 2 };
    const cellSize = boardSizePx / 19;
    
    let houseScoreBlack = 0;
    let houseScoreWhite = 0;
    const scoredStones: { [stoneId: number]: number } = {};

    const onBoardStones = (game.curlingStones || []).filter(s => s.onBoard);
    
    // Score all stones in the house for both players
    // 돌의 가장 안쪽 가장자리가 높은 점수 영역 안에 있으면 높은 점수 인정 (아주 약간이라도 걸쳐있으면 높은 점수)
    for (const stone of onBoardStones) {
        const dist = Math.hypot(stone.x - center.x, stone.y - center.y);
        const stoneRadius = stone.radius;
        // 돌의 가장 안쪽 가장자리와 가장 바깥쪽 가장자리까지의 거리를 고려
        const innerEdgeDist = Math.max(0, dist - stoneRadius);
        const outerEdgeDist = dist + stoneRadius;
        let score = 0;
        
        // 각 점수 영역의 경계값
        const score5Boundary = cellSize * 0.5;  // 5점 영역
        const score3Boundary = cellSize * 2;    // 3점 영역
        const score2Boundary = cellSize * 4;     // 2점 영역
        const score1Boundary = cellSize * 6;     // 1점 영역
        
        // 가장 높은 점수부터 확인: 돌의 가장 안쪽 가장자리가 높은 점수 영역 안에 있으면 높은 점수 인정
        // 아주 약간이라도 높은 점수 영역에 걸쳐있으면 높은 점수로 인정
        // 돌이 하우스 안에 있는지 확인: 돌의 가장 안쪽 가장자리가 하우스 안에 있으면 점수 인정
        if (innerEdgeDist <= score1Boundary) {
            // 돌이 하우스 안에 있음 (돌의 일부가 하우스 안에 있으면 점수 인정)
            if (innerEdgeDist <= score5Boundary) {
                score = 5; // 돌의 가장 안쪽 가장자리가 5점 영역 안에 있음
            } else if (innerEdgeDist <= score3Boundary) {
                // 돌의 가장 안쪽 가장자리가 3점 영역 안에 있음 (5점 영역에는 없음)
                score = 3;
            } else if (innerEdgeDist <= score2Boundary) {
                // 돌의 가장 안쪽 가장자리가 2점 영역 안에 있음 (3점 영역에는 없음)
                score = 2;
            } else {
                // 돌의 가장 안쪽 가장자리가 1점 영역 안에 있음 (2점 영역에는 없음)
                score = 1;
            }
        }
        // innerEdgeDist가 score1Boundary보다 크면 점수 없음 (하우스 밖)
        
        if (score > 0) {
            scoredStones[stone.id] = score;
            if (stone.player === types.Player.Black) houseScoreBlack += score;
            else houseScoreWhite += score;
        }
    }

    // 이번 라운드의 넉아웃 점수 계산 (이전 라운드의 넉아웃 점수 제외)
    const curlingRoundHistory = (game as any).curlingRoundHistory || [];
    const previousRoundData = curlingRoundHistory.length > 0 
        ? curlingRoundHistory[curlingRoundHistory.length - 1] 
        : null;
    
    // 넉아웃 점수를 별도로 추적 (curlingKnockoutScores가 없으면 초기화)
    if (!(game as any).curlingKnockoutScores) {
        (game as any).curlingKnockoutScores = { [types.Player.Black]: 0, [types.Player.White]: 0 };
    }
    
    // 이전 라운드까지의 누적 넉아웃 점수 계산 (히스토리에서 합산)
    let previousBlackKnockoutTotal = 0;
    let previousWhiteKnockoutTotal = 0;
    for (const roundData of curlingRoundHistory) {
        previousBlackKnockoutTotal += roundData.black?.knockoutScore || 0;
        previousWhiteKnockoutTotal += roundData.white?.knockoutScore || 0;
    }
    
    // 현재까지의 누적 넉아웃 점수에서 이전 라운드까지의 누적 넉아웃 점수를 빼서 이번 라운드의 넉아웃 점수 계산
    const currentBlackKnockoutTotal = (game as any).curlingKnockoutScores[types.Player.Black] || 0;
    const currentWhiteKnockoutTotal = (game as any).curlingKnockoutScores[types.Player.White] || 0;
    const blackKnockoutsThisRound = currentBlackKnockoutTotal - previousBlackKnockoutTotal;
    const whiteKnockoutsThisRound = currentWhiteKnockoutTotal - previousWhiteKnockoutTotal;
    
    // 이전 라운드까지의 누적 총점 (모든 이전 라운드의 하우스 점수 + 넉아웃 점수 합계) 계산
    let previousBlackTotal = 0;
    let previousWhiteTotal = 0;
    for (const roundData of curlingRoundHistory) {
        previousBlackTotal += roundData.black?.total || 0;
        previousWhiteTotal += roundData.white?.total || 0;
    }

    game.curlingScores![types.Player.Black] += houseScoreBlack;
    game.curlingScores![types.Player.White] += houseScoreWhite;
    
    const blackTotal = houseScoreBlack + blackKnockoutsThisRound;
    const whiteTotal = houseScoreWhite + whiteKnockoutsThisRound;

    game.curlingRoundSummary = {
        round: game.curlingRound!,
        roundWinner: blackTotal > whiteTotal ? types.Player.Black : (whiteTotal > blackTotal ? types.Player.White : null),
        black: { 
            houseScore: houseScoreBlack, 
            knockoutScore: blackKnockoutsThisRound, 
            previousKnockoutScore: previousBlackTotal, // 이전 라운드의 총점 (하우스 + 넉아웃) 추가
            total: blackTotal 
        },
        white: { 
            houseScore: houseScoreWhite, 
            knockoutScore: whiteKnockoutsThisRound, 
            previousKnockoutScore: previousWhiteTotal, // 이전 라운드의 총점 (하우스 + 넉아웃) 추가
            total: whiteTotal 
        },
        cumulativeScores: { ...game.curlingScores! },
        stonesState: game.curlingStones!,
        scoredStones: scoredStones
    };
    
    // 라운드별 점수 히스토리 저장
    if (!(game as any).curlingRoundHistory) {
        (game as any).curlingRoundHistory = [];
    }
    (game as any).curlingRoundHistory.push({
        round: game.curlingRound!,
        black: { houseScore: houseScoreBlack, knockoutScore: blackKnockoutsThisRound, total: blackTotal },
        white: { houseScore: houseScoreWhite, knockoutScore: whiteKnockoutsThisRound, total: whiteTotal },
        cumulativeScores: { ...game.curlingScores! }
    });
    
    game.gameStatus = 'curling_round_end';
    // 라운드 종료 확인 상태 초기화
    game.roundEndConfirmations = { [game.player1.id]: 0, [game.player2.id]: 0 };
    
    // PVP 경기에서만 10초 카운트다운 설정 (AI 게임에서는 설정하지 않음)
    if (!game.isAiGame) {
        game.revealEndTime = now + 10000; // 10초 카운트다운
    } else {
        // AI 게임에서는 revealEndTime을 설정하지 않아서 자동으로 넘어가지 않도록 함
        game.revealEndTime = undefined;
        // AI는 1초 후에 자동으로 확인 버튼을 누른 것으로 설정
        game.roundEndConfirmations[aiUserId] = now + 1000;
    }
    
    // 라운드 종료 시점 기록 (모달 최소 표시 시간 체크용)
    (game as any).curlingRoundEndEnteredAt = now;
};


// --- Game State Management ---

export const initializeCurling = (game: types.LiveGameSession, neg: types.Negotiation, now: number) => {
    const p1 = game.player1;
    const p2 = game.player2;
    
    game.curlingStones = [];
    game.activeCurlingItems = {};

    const p1Effects = effectService.calculateUserEffects(p1);
    const p2Effects = effectService.calculateUserEffects(p2);
    const p1SlowBonus = p1Effects.mythicStatBonuses[types.MythicStat.AlkkagiSlowBonus]?.flat || 0;
    const p1AimBonus = p1Effects.mythicStatBonuses[types.MythicStat.AlkkagiAimingBonus]?.flat || 0;
    const p2SlowBonus = p2Effects.mythicStatBonuses[types.MythicStat.AlkkagiSlowBonus]?.flat || 0;
    const p2AimBonus = p2Effects.mythicStatBonuses[types.MythicStat.AlkkagiAimingBonus]?.flat || 0;

    game.curlingItemUses = {
        [p1.id]: { slow: (neg.settings.curlingSlowItemCount || 0) + p1SlowBonus, aimingLine: (neg.settings.curlingAimingLineItemCount || 0) + p1AimBonus },
        [p2.id]: { slow: (neg.settings.curlingSlowItemCount || 0) + p2SlowBonus, aimingLine: (neg.settings.curlingAimingLineItemCount || 0) + p2AimBonus }
    };

    if (game.isAiGame) {
        const humanPlayerColor = neg.settings.player1Color || types.Player.Black;
        if (humanPlayerColor === types.Player.Black) {
            game.blackPlayerId = p1.id;
            game.whitePlayerId = p2.id;
        } else {
            game.whitePlayerId = p1.id;
            game.blackPlayerId = p2.id;
        }
        
        // Default: 백(후공) gets the hammer (last stone advantage)
        game.hammerPlayerId = game.whitePlayerId ?? undefined; 
        game.currentPlayer = types.Player.Black; // 선공 starts
        game.gameStatus = 'curling_playing';
        game.curlingRound = 1;
        game.curlingScores = { [types.Player.Black]: 0, [types.Player.White]: 0, [types.Player.None]: 0 };
        (game as any).curlingKnockoutScores = { [types.Player.Black]: 0, [types.Player.White]: 0 };
        game.stonesThrownThisRound = { [game.player1.id]: 0, [game.player2.id]: 0 };
        game.curlingTurnDeadline = now + CURLING_TURN_TIME_LIMIT * 1000;
        game.turnStartTime = now;
        
        // AI 턴인 경우 즉시 처리할 수 있도록 aiTurnStartTime을 현재 시간으로 설정
        const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
        if (currentPlayerId === aiUserId) {
            game.aiTurnStartTime = now;
            console.log(`[initializeCurling] AI turn at game start, game ${game.id}, setting aiTurnStartTime to now: ${now}`);
        } else {
            game.aiTurnStartTime = undefined;
            console.log(`[initializeCurling] User turn at game start, game ${game.id}, clearing aiTurnStartTime`);
        }

    } else {
        game.gameStatus = 'turn_preference_selection';
        game.turnChoices = { [p1.id]: null, [p2.id]: null };
        game.turnChoiceDeadline = now + 30000;
        game.turnSelectionTiebreaker = 'rps';
    }
};

export const updateCurlingState = (game: types.LiveGameSession, now: number) => {
    if (updateSharedGameState(game, now)) return;

    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    
    switch (game.gameStatus) {
        case 'curling_start_confirmation': {
            const bothConfirmed = game.preGameConfirmations?.[p1Id] && game.preGameConfirmations?.[p2Id];
            const deadlinePassed = game.revealEndTime && now > game.revealEndTime;
            if (bothConfirmed || deadlinePassed) {
                game.hammerPlayerId = game.whitePlayerId ?? undefined; // White gets hammer
                game.currentPlayer = types.Player.Black;
                game.gameStatus = 'curling_playing';
                game.curlingRound = 1;
                game.curlingScores = { [types.Player.Black]: 0, [types.Player.White]: 0, [types.Player.None]: 0 };
                (game as any).curlingKnockoutScores = { [types.Player.Black]: 0, [types.Player.White]: 0 };
                game.stonesThrownThisRound = { [p1Id]: 0, [p2Id]: 0 };
                game.curlingTurnDeadline = now + CURLING_TURN_TIME_LIMIT * 1000;
                game.turnStartTime = now;
                
                game.preGameConfirmations = {};
                game.revealEndTime = undefined;
                game.turnChoices = undefined;
                game.rpsState = undefined;
                game.rpsRound = undefined;
                
                // AI 턴인 경우 즉시 처리할 수 있도록 aiTurnStartTime을 현재 시간으로 설정
                if (game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White) &&
                    (game.currentPlayer === types.Player.Black ? game.blackPlayerId === aiUserId : game.whitePlayerId === aiUserId)) {
                    game.aiTurnStartTime = now;
                    console.log(`[updateCurlingState] AI turn at game start, game ${game.id}, setting aiTurnStartTime to now: ${now}`);
                }
            }
            break;
        }
        case 'curling_playing': {
            // AI 게임에서는 타임아웃 체크를 하지 않음 (유저가 버튼을 누를 때까지 무제한 대기)
            if (game.isAiGame) {
                // AI 게임에서는 타임아웃이 발생하지 않도록 함
                break;
            }
            
            // 일반 게임에서만 타임아웃 체크
            if (game.curlingTurnDeadline && now > game.curlingTurnDeadline) {
                const timedOutPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
                const gameEnded = handleTimeoutFoul(game, timedOutPlayerId, now);
                if (gameEnded) return;

                if (!game.curlingStonesLostToFoul) game.curlingStonesLostToFoul = {};
                game.curlingStonesLostToFoul[timedOutPlayerId] = (game.curlingStonesLostToFoul[timedOutPlayerId] || 0) + 1;

                game.stonesThrownThisRound![timedOutPlayerId]++;
                
                const bothPlayersHaveThrownAllStones = 
                    game.stonesThrownThisRound![p1Id] >= game.settings.curlingStoneCount! &&
                    game.stonesThrownThisRound![p2Id] >= game.settings.curlingStoneCount!;

                if (bothPlayersHaveThrownAllStones) {
                    endCurlingRound(game, now);
                } else {
                    game.currentPlayer = game.currentPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
                    game.curlingTurnDeadline = now + CURLING_TURN_TIME_LIMIT * 1000;
                    game.turnStartTime = now;
                }
            }
            break;
        }
        case 'curling_animating': {
            // 애니메이션이 없거나 duration이 끝났을 때 시뮬레이션 실행 및 즉시 턴 전환
            if (!game.animation) {
                // 애니메이션이 없으면 바로 턴 전환
                const bothPlayersHaveThrownAllStones = 
                    game.stonesThrownThisRound![p1Id] >= game.settings.curlingStoneCount! &&
                    game.stonesThrownThisRound![p2Id] >= game.settings.curlingStoneCount!;
                
                if (bothPlayersHaveThrownAllStones) {
                    endCurlingRound(game, now);
                } else {
                    game.gameStatus = 'curling_playing';
                    const previousPlayer = game.currentPlayer;
                    game.currentPlayer = game.currentPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
                    game.curlingTurnDeadline = now + CURLING_TURN_TIME_LIMIT * 1000;
                    game.turnStartTime = now;
                    console.log(`[updateCurlingState] Turn switched from ${previousPlayer} to ${game.currentPlayer} (no animation), game ${game.id}`);
                    // AI 턴인 경우 즉시 처리할 수 있도록 aiTurnStartTime을 현재 시간으로 설정
                    if (game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White)) {
                        const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                        if (currentPlayerId === aiUserId) {
                            game.aiTurnStartTime = now;
                            console.log(`[updateCurlingState] AI turn after animation, game ${game.id}, setting aiTurnStartTime to now: ${now}`);
                        } else {
                            game.aiTurnStartTime = undefined;
                            console.log(`[updateCurlingState] User turn after animation, game ${game.id}, clearing aiTurnStartTime`);
                        }
                    }
                }
            } else if (game.animation && now >= game.animation.startTime + game.animation.duration) {
                // 애니메이션 duration이 정확히 끝났을 때 즉시 처리
                const animation = game.animation as types.AnimationData & { type: 'curling_flick' };
                const { stone, velocity } = animation;
                const { finalStones, stonesFallen } = runServerSimulation(game.curlingStones!, stone, velocity);
                game.curlingStones = finalStones;
                
                const knockoutPlayerId = stone.player === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
                const knockoutPlayerEnum = stone.player;
                const opponentEnum = knockoutPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
                const knockoutScore = stonesFallen.filter(s => s.player === opponentEnum).length;
                if (knockoutScore > 0) {
                    game.curlingScores![knockoutPlayerEnum] += knockoutScore;
                    // 넉아웃 점수를 별도로 추적
                    if (!(game as any).curlingKnockoutScores) {
                        (game as any).curlingKnockoutScores = { [types.Player.Black]: 0, [types.Player.White]: 0 };
                    }
                    (game as any).curlingKnockoutScores[knockoutPlayerEnum] += knockoutScore;
                }
                
                const animationDuration = now - animation.startTime;
                game.animation = null; // 애니메이션 제거
                
                const bothPlayersHaveThrownAllStones = 
                    game.stonesThrownThisRound![p1Id] >= game.settings.curlingStoneCount! &&
                    game.stonesThrownThisRound![p2Id] >= game.settings.curlingStoneCount!;
                
                if (bothPlayersHaveThrownAllStones) {
                    endCurlingRound(game, now);
                } else {
                    game.gameStatus = 'curling_playing';
                    const previousPlayer = game.currentPlayer;
                    game.currentPlayer = game.currentPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
                    game.curlingTurnDeadline = now + CURLING_TURN_TIME_LIMIT * 1000;
                    game.turnStartTime = now;
                    console.log(`[updateCurlingState] Turn switched from ${previousPlayer} to ${game.currentPlayer} immediately after animation (${animationDuration}ms elapsed), game ${game.id}`);
                    // AI 턴인 경우 즉시 처리할 수 있도록 aiTurnStartTime을 현재 시간으로 설정
                    if (game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White)) {
                        const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                        if (currentPlayerId === aiUserId) {
                            game.aiTurnStartTime = now;
                            console.log(`[updateCurlingState] AI turn after animation, game ${game.id}, setting aiTurnStartTime to now: ${now}`);
                        } else {
                            // 사용자 턴으로 넘어갔으므로 aiTurnStartTime을 undefined로 설정
                            game.aiTurnStartTime = undefined;
                            console.log(`[updateCurlingState] User turn after animation, game ${game.id}, clearing aiTurnStartTime`);
                        }
                    }
                }
            }
            break;
        }
        case 'curling_round_end': {
            // AI 게임일 때 AI가 1초 후에 자동으로 확인하도록 처리
            if (game.isAiGame && game.roundEndConfirmations?.[aiUserId]) {
                const aiConfirmationTime = game.roundEndConfirmations[aiUserId];
                // AI 확인 시간이 미래 시간으로 설정되어 있고, 현재 시간이 지났으면 확인 처리
                if (aiConfirmationTime > 1000 && aiConfirmationTime <= now) {
                    game.roundEndConfirmations[aiUserId] = now;
                }
            }
            
            const totalRounds = game.settings.curlingRounds || 3;
            const isFinalRound = game.curlingRound! >= totalRounds;
            
            // AI 게임과 일반 게임의 확인 로직 분리
            let bothConfirmed = false;
            if (game.isAiGame) {
                // AI 게임: 유저와 AI가 모두 확인했는지 체크
                const humanPlayerId = p1Id === aiUserId ? p2Id : (p2Id === aiUserId ? p1Id : null);
                const aiConfirmed = !!(game.roundEndConfirmations?.[aiUserId] && game.roundEndConfirmations[aiUserId] > 0);
                const humanConfirmed = humanPlayerId ? !!(game.roundEndConfirmations?.[humanPlayerId] && game.roundEndConfirmations[humanPlayerId] > 0) : false;
                bothConfirmed = aiConfirmed && humanConfirmed;
            } else {
                // 일반 게임: 양쪽 플레이어가 모두 확인했는지 체크
                bothConfirmed = !!(game.roundEndConfirmations?.[p1Id] && game.roundEndConfirmations?.[p2Id]);
            }
            
            // 마지막 라운드가 아닐 때만 자동 진행 처리
            if (!isFinalRound) {
                // AI 게임이 아닐 때: 양쪽이 모두 확인했거나 시간이 지났을 때 진행
                // AI 게임일 때: 유저와 AI가 모두 확인했을 때만 진행 (무제한 대기)
                const shouldProceed = game.isAiGame 
                    ? bothConfirmed 
                    : ((game.revealEndTime && now > game.revealEndTime) || bothConfirmed);
                
                if (shouldProceed) {
                    // roundWinner를 먼저 확인 (curlingRoundSummary 초기화 전)
                    const roundWinner = game.curlingRoundSummary?.roundWinner;
                    
                    game.curlingRound!++;
                    game.curlingStones = [];
                    game.stonesThrownThisRound = { [p1Id]: 0, [p2Id]: 0 };
                    
                    // 다음 라운드를 위한 상태 초기화
                    game.curlingRoundSummary = undefined;
                    game.roundEndConfirmations = undefined;
                    game.revealEndTime = undefined;
                    (game as any).curlingRoundEndEnteredAt = undefined;
                    
                    if (roundWinner === types.Player.Black) {
                        game.hammerPlayerId = game.whitePlayerId ?? undefined;
                    } else {
                        game.hammerPlayerId = game.blackPlayerId ?? undefined;
                    }
                    
                    game.currentPlayer = game.hammerPlayerId === game.blackPlayerId ? types.Player.White : types.Player.Black;
                    
                    game.gameStatus = 'curling_playing';
                    game.curlingTurnDeadline = now + CURLING_TURN_TIME_LIMIT * 1000;
                    game.turnStartTime = now;
                    
                    // AI 턴인 경우 즉시 처리할 수 있도록 aiTurnStartTime을 현재 시간으로 설정
                    if (game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White) &&
                        (game.currentPlayer === types.Player.Black ? game.blackPlayerId === aiUserId : game.whitePlayerId === aiUserId)) {
                        game.aiTurnStartTime = now;
                        console.log(`[updateCurlingState] AI turn after round start, game ${game.id}, setting aiTurnStartTime to now: ${now}`);
                    }
                }
            } else {
                // 마지막 라운드: 양쪽이 모두 확인 버튼을 눌렀을 때만 엔드게임 처리
                // AI 게임이 아닐 때는 revealEndTime이 지나도 자동으로 넘어가지 않음 (버튼을 눌러야 함)
                if (bothConfirmed) {
                    // Check for a tie after the final round
                    const blackFinalScore = game.curlingScores![types.Player.Black];
                    const whiteFinalScore = game.curlingScores![types.Player.White];
                    
                    if (blackFinalScore === whiteFinalScore) {
                        // Tiebreaker logic here if needed, for now just end it
                        const finalWinner = Math.random() < 0.5 ? types.Player.Black : types.Player.White;
                        endGame(game, finalWinner, 'total_score');

                    } else {
                        const winner = blackFinalScore > whiteFinalScore ? types.Player.Black : types.Player.White;
                        endGame(game, winner, 'total_score');
                    }
                }
            }
            break;
        }
    }
};

export const handleCurlingAction = async (volatileState: types.VolatileState, game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): Promise<types.HandleActionResult | undefined> => {
    const { type, payload } = action;
    const now = Date.now();
    
    const myPlayerEnum = user.id === game.blackPlayerId ? types.Player.Black : (user.id === game.whitePlayerId ? types.Player.White : types.Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;

    const sharedResult = await handleSharedAction(volatileState, game, action, user);
    if (sharedResult) return sharedResult;
    
    switch(type) {
        case 'CONFIRM_CURLING_START': {
            if (game.mode !== types.GameMode.Curling) return undefined;
            if (game.gameStatus !== 'curling_start_confirmation') return { error: "Not in confirmation phase." };
            if (!game.preGameConfirmations) game.preGameConfirmations = {};
            if (game.isAiGame) game.preGameConfirmations[aiUserId] = true;
            
            game.preGameConfirmations[user.id] = true;
            return {};
        }
        case 'CURLING_FLICK_STONE': {
            if (game.gameStatus !== 'curling_playing' || !isMyTurn) return { error: "지금은 공격할 수 없습니다."};
            
            if (game.stonesThrownThisRound![user.id] >= game.settings.curlingStoneCount!) {
                return { error: "모든 돌을 사용했습니다." };
            }

            const { launchPosition, velocity } = payload;
            
            const newStone: types.AlkkagiStone = {
                id: Date.now(),
                player: myPlayerEnum,
                x: launchPosition.x, y: launchPosition.y,
                vx: 0, vy: 0,
                radius: (840 / 19) * 0.47,
                onBoard: false,
            };
            
            game.animation = { type: 'curling_flick', stone: newStone, velocity, startTime: now, duration: 3000 };
            game.gameStatus = 'curling_animating';
            if (game.activeCurlingItems) {
                delete game.activeCurlingItems[user.id];
            }
            game.stonesThrownThisRound![user.id]++;
            game.curlingTurnDeadline = undefined;
            game.turnStartTime = undefined;
            return {};
        }
        case 'USE_CURLING_ITEM': {
            if (game.gameStatus !== 'curling_playing' || !isMyTurn) return { error: "Not your turn to use an item." };
            const { itemType } = payload as { itemType: 'slow' | 'aimingLine' };

            if (game.activeCurlingItems?.[user.id]?.includes(itemType)) return { error: '아이템이 이미 활성화되어 있습니다.' };

            if (!game.curlingItemUses || !game.curlingItemUses[user.id] || game.curlingItemUses[user.id][itemType] <= 0) {
                return { error: '해당 아이템이 없습니다.' };
            }
            game.curlingItemUses[user.id][itemType]--;
            if (!game.activeCurlingItems) game.activeCurlingItems = {};
            if (!Array.isArray(game.activeCurlingItems[user.id])) {
                game.activeCurlingItems[user.id] = [];
            }
            game.activeCurlingItems[user.id].push(itemType);
            return {};
        }
        case 'CONFIRM_ROUND_END': {
            if (game.gameStatus !== 'curling_round_end') return { error: "라운드 종료 확인 단계가 아닙니다." };
            if (!game.roundEndConfirmations) game.roundEndConfirmations = {};
            game.roundEndConfirmations[user.id] = now;
            
            // 양쪽 플레이어가 모두 확인했으면 즉시 진행 (마지막 라운드가 아닐 때만)
            // 마지막 라운드는 updateCurlingState에서 처리
            const p1Id = game.player1.id;
            const p2Id = game.player2.id;
            const bothConfirmed = game.roundEndConfirmations[p1Id] && game.roundEndConfirmations[p2Id];
            const totalRounds = game.settings.curlingRounds || 3;
            const isFinalRound = game.curlingRound! >= totalRounds;
            
            // 마지막 라운드가 아니고, AI 게임이 아닐 때만 revealEndTime을 현재 시간으로 설정
            if (bothConfirmed && !game.isAiGame && !isFinalRound) {
                // 다음 상태 업데이트에서 즉시 처리되도록 revealEndTime을 현재 시간으로 설정
                game.revealEndTime = now;
            }
            
            return {};
        }
    }
    
    return undefined;
};