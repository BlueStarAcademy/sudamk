import * as types from '../../types/index.js';
import * as db from '../db.js';
import { getGoLogic, processMove } from '../goLogic.js';
import { handleSharedAction, updateSharedGameState, handleTimeoutFoul, shouldEnforceTimeControl } from './shared.js';
import { DICE_GO_MAIN_ROLL_TIME, DICE_GO_MAIN_PLACE_TIME, THIEF_NIGHTS_PER_SEGMENT } from '../../constants/index.js';
import { DICE_HUMAN_PLACE_SETTLE_MS } from './diceGo.js';
import { endGame } from '../summaryService.js';
import { aiUserId, scheduleAiTurnStartForFreshUi } from '../aiPlayer.js';
import { cancelAiProcessing } from '../aiSessionManager.js';

const THIEF_POOL_HIGH36 = [3, 4, 5, 6] as const;
const THIEF_POOL_NO_ONE = [2, 3, 4, 5] as const;

function pickThiefPool(pool: readonly number[]): number {
    return pool[Math.floor(Math.random() * pool.length)];
}

/** PVP 로드 등으로 누락된 경우에만 플레이어별 행 보강 */
export function ensureThiefGoItemUses(game: types.LiveGameSession): void {
    const s = game.settings;
    const h = s.thiefHigh36ItemCount ?? 1;
    const n = s.thiefNoOneItemCount ?? 1;
    if (!game.thiefGoItemUses) game.thiefGoItemUses = {};
    for (const pid of [game.player1.id, game.player2.id]) {
        if (!game.thiefGoItemUses[pid]) game.thiefGoItemUses[pid] = { high36: h, noOne: n };
    }
}

export function rollThiefDiceForRole(
    myRole: 'thief' | 'police',
    itemType?: 'high36' | 'noOne'
): { dice1: number; dice2: number; stonesToPlace: number } {
    let dice1: number;
    let dice2 = 0;
    if (itemType === 'high36') {
        dice1 = pickThiefPool(THIEF_POOL_HIGH36);
        if (myRole === 'police') dice2 = pickThiefPool(THIEF_POOL_HIGH36);
    } else if (itemType === 'noOne') {
        dice1 = pickThiefPool(THIEF_POOL_NO_ONE);
        if (myRole === 'police') dice2 = pickThiefPool(THIEF_POOL_NO_ONE);
    } else {
        dice1 = Math.floor(Math.random() * 6) + 1;
        if (myRole === 'police') dice2 = Math.floor(Math.random() * 6) + 1;
    }
    const stonesToPlace = myRole === 'police' ? dice1 + dice2 : dice1;
    return { dice1, dice2, stonesToPlace };
}

/** 한 세그먼트(역할 고정)당 밤 수. 1밤 = 도둑 1턴 + 경찰 1턴. 세그먼트 종료 시 도둑 점수=살아남은 돌, 경찰 점수=따낸 돌. */
export const THIEF_NIGHTS_PER_ROUND = THIEF_NIGHTS_PER_SEGMENT;
const THIEF_TURNS_PER_ROUND = THIEF_NIGHTS_PER_ROUND * 2;

/** 착수 종료 후 상대 주사위 단계로 (주사위 바둑 applyDicePlacingTurnPass와 대응) */
function applyThiefPlacingHandoff(game: types.LiveGameSession, now: number) {
    game.thiefFreestyleThiefPlacing = undefined;
    game.currentPlayer = game.currentPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
    game.gameStatus = 'thief_rolling';
    if (shouldEnforceTimeControl(game)) {
        game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
        game.turnStartTime = now;
    }

    if (game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White)) {
        const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
        if (currentPlayerId === aiUserId) {
            game.aiTurnStartTime = now;
            console.log(`[applyThiefPlacingHandoff] AI turn after placement, game ${game.id}, setting aiTurnStartTime to now: ${now}`);
        } else {
            game.aiTurnStartTime = undefined;
            console.log(`[applyThiefPlacingHandoff] User turn after placement, game ${game.id}, clearing aiTurnStartTime`);
        }
    }
}

/** 역할 교대 후 새 세그먼트: 빈 판 + 기보·잔여 UI 상태 초기화 */
function resetThiefBoardForNewSegment(game: types.LiveGameSession) {
    const size = game.settings.boardSize;
    game.boardState = Array(size).fill(0).map(() => Array(size).fill(types.Player.None));
    game.moveHistory = [];
    game.koInfo = null;
    game.lastMove = null;
    game.lastTurnStones = undefined;
    game.stonesPlacedThisTurn = [];
    game.justCaptured = [];
    game.winningLine = undefined;
    game.dice = undefined;
    game.stonesToPlace = undefined;
    game.animation = null;
    game.dicePlacingSettleUntil = undefined;
    game.passCount = 0;
    game.captures = { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 };
    game.thiefFreestyleThiefPlacing = undefined;

    // 세그먼트(역할) 전환 직전 setImmediate(makeAiMove) 락·세션 잠금이 남으면 processGame이 조기 return 하거나
    // 다음 턴 makeAiMove가 startAiProcessing에서 막혀 봇이 멈춤 (주사위바둑 라운드 전환과 동일 이슈).
    (game as any)._aiMoveDispatching = false;
    (game as any)._aiMoveDispatchingAt = undefined;
    cancelAiProcessing(game.id);
}

function enterThiefRoundEndModal(game: types.LiveGameSession, now: number) {
    game.gameStatus = 'thief_round_end';
    if (game.isAiGame) {
        game.revealEndTime = undefined;
    } else {
        game.revealEndTime = now + 20000;
    }
    if (game.isAiGame) {
        if (!game.roundEndConfirmations) game.roundEndConfirmations = {};
        game.roundEndConfirmations[aiUserId] = now;
    }
}

export const initializeThief = (game: types.LiveGameSession, neg: types.Negotiation, now: number) => {
    const p1 = game.player1;
    const p2 = game.player2;
    game.blackPlayerId = null;
    game.whitePlayerId = null;

    if (game.isAiGame) {
        // Human (p1) chooses their role via player1Color setting.
        // Thief is Black, Police is White.
        const humanIsThief = neg.settings.player1Color === types.Player.Black;

        if (humanIsThief) {
            game.thiefPlayerId = p1.id;
            game.policePlayerId = p2.id;
        } else { // Human is Police
            game.policePlayerId = p1.id;
            game.thiefPlayerId = p2.id;
        }

        game.blackPlayerId = game.thiefPlayerId;
        game.whitePlayerId = game.policePlayerId;
        
        // Directly start the game
        game.gameStatus = 'thief_rolling';
        game.currentPlayer = types.Player.Black; // Thief always starts
        if (shouldEnforceTimeControl(game)) {
            game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
            game.turnStartTime = now;
        }
        game.round = 1; // Initialize round
        game.scores = { [p1.id]: 0, [p2.id]: 0 }; // Initialize scores
        game.turnInRound = 1; // Initialize turn in round
        ensureThiefGoItemUses(game);
        game.dicePlacingSettleUntil = undefined;
        
        // AI 턴인 경우 즉시 처리할 수 있도록 aiTurnStartTime을 현재 시간으로 설정
        const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
        if (currentPlayerId === aiUserId) {
            scheduleAiTurnStartForFreshUi(game, now);
            console.log(`[initializeThief] AI turn at game start, game ${game.id}, deferred aiTurnStartTime by first-move delay`);
        } else {
            game.aiTurnStartTime = undefined;
            console.log(`[initializeThief] User turn at game start, game ${game.id}, clearing aiTurnStartTime`);
        }
    } else {
        const thiefPlayer = Math.random() < 0.5 ? p1 : p2;
        const policePlayer = thiefPlayer.id === p1.id ? p2 : p1;

        game.thiefPlayerId = thiefPlayer.id;
        game.policePlayerId = policePlayer.id;
        game.blackPlayerId = thiefPlayer.id;
        game.whitePlayerId = policePlayer.id;
        game.gameStatus = 'thief_role_confirmed';
        game.revealEndTime = now + 10000;
        game.preGameConfirmations = { [p1.id]: false, [p2.id]: false };
        game.roleChoices = undefined;
        game.turnChoiceDeadline = undefined;
    }
};

export const updateThiefState = (game: types.LiveGameSession, now: number) => {
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;

    if (
        game.mode === types.GameMode.Thief &&
        ['thief_rolling', 'thief_rolling_animating', 'thief_placing'].includes(game.gameStatus)
    ) {
        ensureThiefGoItemUses(game);
    }

    if (game.gameStatus === 'thief_role_selection') {
        const p1Choice = game.roleChoices?.[p1Id];
        const p2Choice = game.roleChoices?.[p2Id];
        const deadlinePassed = game.turnChoiceDeadline && now > game.turnChoiceDeadline;

        if ((p1Choice && p2Choice) || deadlinePassed) {
            const choices = ['thief', 'police'] as const;
            
            let finalP1Choice = p1Choice;
            let finalP2Choice = p2Choice;

            if (deadlinePassed) {
                if (!game.roleChoices) game.roleChoices = {};
                if (!finalP1Choice) {
                    finalP1Choice = choices[Math.floor(Math.random() * 2)];
                    game.roleChoices[p1Id] = finalP1Choice;
                }
                if (!finalP2Choice) {
                    finalP2Choice = choices[Math.floor(Math.random() * 2)];
                    game.roleChoices[p2Id] = finalP2Choice;
                }
            }

            if (finalP1Choice && finalP2Choice) { // Type guard for safety
                if (finalP1Choice === finalP2Choice) {
                    game.gameStatus = 'thief_rps';
                    game.rpsState = { [p1Id]: null, [p2Id]: null };
                    game.rpsRound = 1;
                    game.turnDeadline = now + 30000;
                } else {
                    if (finalP1Choice === 'thief') {
                        game.thiefPlayerId = p1Id;
                        game.policePlayerId = p2Id;
                    } else { // p1c must be 'police'
                        game.thiefPlayerId = p2Id;
                        game.policePlayerId = p1Id;
                    }
                    game.blackPlayerId = game.thiefPlayerId;
                    game.whitePlayerId = game.policePlayerId;
                    game.gameStatus = 'thief_role_confirmed';
                    game.revealEndTime = now + 10000;
                }
            }
        }
    } else if (game.gameStatus === 'thief_rps_reveal') {
        if (game.revealEndTime && now > game.revealEndTime) {
            const p1Choice = game.rpsState?.[p1Id];
            const p2Choice = game.rpsState?.[p2Id];

            if (p1Choice && p2Choice) {
                 let winnerId: string;
                if (p1Choice === p2Choice) {
                    winnerId = Math.random() < 0.5 ? p1Id : p2Id;
                } else {
                    const p1Wins = (p1Choice === 'rock' && p2Choice === 'scissors') ||
                                   (p1Choice === 'scissors' && p2Choice === 'paper') ||
                                   (p1Choice === 'paper' && p2Choice === 'rock');
                    winnerId = p1Wins ? p1Id : p2Id;
                }
                
                const loserId = winnerId === p1Id ? p2Id : p1Id;
                const winnerChoice = game.roleChoices![winnerId]!;
                
                if(winnerChoice === 'thief') {
                    game.thiefPlayerId = winnerId;
                    game.policePlayerId = loserId;
                } else {
                    game.policePlayerId = winnerId;
                    game.thiefPlayerId = loserId;
                }
                
                game.blackPlayerId = game.thiefPlayerId;
                game.whitePlayerId = game.policePlayerId;
                game.gameStatus = 'thief_role_confirmed';
                game.revealEndTime = now + 10000;
            }
        }
    } else if (game.gameStatus === 'thief_role_confirmed') {
        if (game.isAiGame) {
            if (!game.preGameConfirmations) game.preGameConfirmations = {};
            game.preGameConfirmations[aiUserId] = true;
        }
        const bothConfirmed = game.preGameConfirmations?.[p1Id] && game.preGameConfirmations?.[p2Id];
        const deadlinePassed = game.revealEndTime && now > game.revealEndTime;
        if (bothConfirmed || deadlinePassed) {
            game.gameStatus = 'thief_rolling';
            game.currentPlayer = types.Player.Black; // Thief always starts
            if (shouldEnforceTimeControl(game)) {
                game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                game.turnStartTime = now;
            }
            game.round = 1; // Initialize round
            game.scores = { [p1Id]: 0, [p2Id]: 0 }; // Initialize scores
            game.turnInRound = 1; // Initialize turn in round
            game.thiefCapturesThisRound = 0;
            game.preGameConfirmations = {};
            game.revealEndTime = undefined;
            ensureThiefGoItemUses(game);
            
            // AI 턴인 경우 즉시 처리할 수 있도록 aiTurnStartTime을 현재 시간으로 설정
            if (game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White)) {
                const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                if (currentPlayerId === aiUserId) {
                    scheduleAiTurnStartForFreshUi(game, now);
                    console.log(`[updateThiefState] AI turn at role confirmed, game ${game.id}, deferred aiTurnStartTime by first-move delay`);
                } else {
                    game.aiTurnStartTime = undefined;
                    console.log(`[updateThiefState] User turn at role confirmed, game ${game.id}, clearing aiTurnStartTime`);
                }
            }
        }
    } else if (game.gameStatus === 'thief_rolling') {
        // turnDeadline이 없으면 설정 (게임 로드 시나 상태 불일치 시 대비) — PVP에만
        if (shouldEnforceTimeControl(game) && !game.turnDeadline) {
            console.log(`[updateThiefState] Setting turnDeadline for thief_rolling: gameId=${game.id}, currentPlayer=${game.currentPlayer}`);
            game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
            game.turnStartTime = now;
        }
        
        // AI 턴일 때는 타임아웃 체크를 건너뛰기
        const isAiTurn = game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White) && 
                        (game.currentPlayer === types.Player.Black ? game.blackPlayerId === aiUserId : game.whitePlayerId === aiUserId);
        
        // 타임아웃 체크 및 자동 주사위 굴리기 (실시간 PVP만). AI 대국은 파울만 적용하고 자동 굴림 없음.
        if (shouldEnforceTimeControl(game) && game.turnDeadline && now > game.turnDeadline && !isAiTurn) {
            const timedOutPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
            const timeOver = now - game.turnDeadline;
            console.log(`[updateThiefState] Timeout detected in thief_rolling: gameId=${game.id}, timedOutPlayerId=${timedOutPlayerId}, timeOver=${timeOver}ms`);
            
            const gameEnded = handleTimeoutFoul(game, timedOutPlayerId, now);
            if (gameEnded) {
                console.log(`[updateThiefState] Game ended due to timeout foul limit`);
                return;
            }

            if (game.isAiGame) {
                game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                game.turnStartTime = now;
            } else {
                // PVP: 굴림 타임아웃 시 파울만 적용, 자동 굴림 없음
                game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                game.turnStartTime = now;
            }
        }
    } else if (game.gameStatus === 'thief_rolling_animating') {
        if (game.animation && game.animation.type === 'dice_roll_main' && now > game.animation.startTime + game.animation.duration) {
            game.dice = game.animation.dice;
            game.animation = null;
            game.gameStatus = 'thief_placing';
            game.stonesPlacedThisTurn = []; // Initialize for the new turn
            if (game.currentPlayer === types.Player.Black) {
                game.thiefFreestyleThiefPlacing = !game.boardState.flat().includes(types.Player.Black);
            } else {
                game.thiefFreestyleThiefPlacing = undefined;
            }
            if (shouldEnforceTimeControl(game)) {
                game.turnDeadline = now + DICE_GO_MAIN_PLACE_TIME * 1000;
                game.turnStartTime = now;
            }
        }
    } else if (game.gameStatus === 'thief_placing') {
        if (game.dicePlacingSettleUntil != null && now >= game.dicePlacingSettleUntil) {
            game.dicePlacingSettleUntil = undefined;
            applyThiefPlacingHandoff(game, now);
        } else {
        // turnDeadline이 없으면 설정 (게임 로드 시나 상태 불일치 시 대비) — PVP에만
        if (shouldEnforceTimeControl(game) && !game.turnDeadline) {
            console.log(`[updateThiefState] Setting turnDeadline for thief_placing: gameId=${game.id}, currentPlayer=${game.currentPlayer}`);
            game.turnDeadline = now + DICE_GO_MAIN_PLACE_TIME * 1000;
            game.turnStartTime = now;
        }
        
        // AI 턴일 때는 타임아웃 체크를 건너뛰기
        const isAiTurnPlacing = game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White) && 
                               (game.currentPlayer === types.Player.Black ? game.blackPlayerId === aiUserId : game.whitePlayerId === aiUserId);
        
        // 타임아웃 체크 및 자동 착점 (PVP에만)
        if (shouldEnforceTimeControl(game) && game.turnDeadline && now > game.turnDeadline && !isAiTurnPlacing) {
            const timedOutPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
            const timeOver = now - game.turnDeadline;
            console.log(`[updateThiefState] Timeout detected in thief_placing: gameId=${game.id}, timedOutPlayerId=${timedOutPlayerId}, timeOver=${timeOver}ms`);
            
            const gameEnded = handleTimeoutFoul(game, timedOutPlayerId, now);
            if (gameEnded) {
                console.log(`[updateThiefState] Game ended due to timeout foul limit`);
                return;
            }

            if (game.isAiGame) {
                game.turnDeadline = now + DICE_GO_MAIN_PLACE_TIME * 1000;
                game.turnStartTime = now;
            } else {

            // 타임아웃 시 자동으로 랜덤 착점 (남은 돌 수만큼, PVP)
            let stonesToPlace = game.stonesToPlace || 0;
            const myRole = timedOutPlayerId === game.thiefPlayerId ? 'thief' : 'police';
            let tempBoardState = JSON.parse(JSON.stringify(game.boardState));
            let totalCapturesThisTurn = 0;
            let lastCaptureStones: types.Point[] = [];
    
            while (stonesToPlace > 0) {
                const logicForLiberty = getGoLogic({ ...game, boardState: tempBoardState });
                let move: types.Point | null = null;
                
                if (myRole === 'thief') {
                    // 도둑: 기존 돌의 활로에만 놓을 수 있음
                    const liberties = logicForLiberty.getAllLibertiesOfPlayer(types.Player.Black, tempBoardState);
                    const noBlackStonesOnBoard = !tempBoardState.flat().includes(types.Player.Black);
                    const canPlaceFreely =
                        game.turnInRound === 1 || noBlackStonesOnBoard || !!game.thiefFreestyleThiefPlacing;
                    
                    if (canPlaceFreely) {
                        // 자유롭게 놓을 수 있음
                        const emptySpots: types.Point[] = [];
                        for (let y = 0; y < game.settings.boardSize; y++) {
                            for (let x = 0; x < game.settings.boardSize; x++) {
                                if (tempBoardState[y][x] === types.Player.None) {
                                    emptySpots.push({ x, y });
                                }
                            }
                        }
                        if (emptySpots.length > 0) {
                            move = emptySpots[Math.floor(Math.random() * emptySpots.length)];
                        }
                    } else {
                        // 활로에만 놓을 수 있음
                        const liberties = logicForLiberty.getAllLibertiesOfPlayer(types.Player.Black, tempBoardState);
                        if (liberties.length > 0) {
                            move = liberties[Math.floor(Math.random() * liberties.length)];
                        }
                    }
                } else {
                    // 경찰: 도둑(흑) 돌의 활로에만 놓을 수 있음
                    const liberties = logicForLiberty.getAllLibertiesOfPlayer(types.Player.Black, tempBoardState);
                    if (liberties.length > 0) {
                        move = liberties[Math.floor(Math.random() * liberties.length)];
                    }
                }
                
                if (!move) break;
                
                const placePlayer = myRole === 'thief' ? types.Player.Black : types.Player.White;
                const result = processMove(tempBoardState, { ...move, player: placePlayer }, game.koInfo, game.moveHistory.length, { ignoreSuicide: true });
    
                if (result.isValid) {
                    tempBoardState = result.newBoardState;
                    if (result.capturedStones.length > 0) {
                        totalCapturesThisTurn += result.capturedStones.length;
                        lastCaptureStones = result.capturedStones;
                        if (!game.thiefCapturesThisRound) game.thiefCapturesThisRound = 0;
                        game.thiefCapturesThisRound += result.capturedStones.length;
                    }
                    if (!game.stonesPlacedThisTurn) game.stonesPlacedThisTurn = [];
                    game.stonesPlacedThisTurn.push(move);
                } else {
                    console.error(`[updateThiefState] Timeout random placement failed. Move: ${JSON.stringify(move)}, Reason: ${result.reason}`);
                    break;
                }
                stonesToPlace--;
            }
            
            game.boardState = tempBoardState;
            game.stonesToPlace = stonesToPlace;
            
            // 턴 종료 처리 (THIEF_PLACE_STONE과 동일한 로직)
            if (game.stonesToPlace <= 0) {
                game.lastTurnStones = game.stonesPlacedThisTurn;
                game.stonesPlacedThisTurn = [];
                game.lastMove = null;
                
                game.turnInRound = (game.turnInRound || 0) + 1;
                const fiveNightsComplete = game.turnInRound > THIEF_TURNS_PER_ROUND;
        
                if (fiveNightsComplete) {
                    const finalThiefStonesLeft = game.boardState.flat().filter(s => s === types.Player.Black).length;
                    const capturesThisRound = game.thiefCapturesThisRound || 0;
                    game.scores[game.thiefPlayerId!] = (game.scores[game.thiefPlayerId!] || 0) + finalThiefStonesLeft;
                    game.scores[game.policePlayerId!] = (game.scores[game.policePlayerId!] || 0) + capturesThisRound;
                    
                    const p1IsThief = game.player1.id === game.thiefPlayerId;
                    game.thiefRoundSummary = {
                        round: game.round,
                        isDeathmatch: !!game.isDeathmatch,
                        player1: {
                            id: p1Id,
                            role: p1IsThief ? 'thief' : 'police',
                            roundScore: p1IsThief ? finalThiefStonesLeft : capturesThisRound,
                            cumulativeScore: game.scores[p1Id] ?? 0,
                        },
                        player2: {
                            id: game.player2.id,
                            role: !p1IsThief ? 'thief' : 'police',
                            roundScore: !p1IsThief ? finalThiefStonesLeft : capturesThisRound,
                            cumulativeScore: game.scores[game.player2.id] ?? 0,
                        }
                    };
                    const p1Score = game.scores[p1Id]!;
                    const p2Score = game.scores[game.player2.id]!;
                    
                    if ((game.round === 2 && p1Score !== p2Score) || game.isDeathmatch) {
                        const winnerId = p1Score > p2Score ? p1Id : game.player2.id;
                        const winnerEnum = winnerId === game.blackPlayerId ? types.Player.Black : types.Player.White;
                        endGame(game, winnerEnum, 'total_score');
                    } else {
                        enterThiefRoundEndModal(game, now);
                    }
                } else {
                    applyThiefPlacingHandoff(game, now);
                }
            }
            }
        }
        }
    } else if (game.gameStatus === 'thief_round_end') {
         if (game.isAiGame) {
            if (!game.roundEndConfirmations) game.roundEndConfirmations = {};
            game.roundEndConfirmations[aiUserId] = now;
         }
         const bothConfirmed = game.roundEndConfirmations?.[p1Id] && game.roundEndConfirmations?.[p2Id];
         const deadlinePassed = game.revealEndTime && now > game.revealEndTime;

         if(bothConfirmed || deadlinePassed) {
             const p1Score = game.thiefRoundSummary!.player1.cumulativeScore;
             const p2Score = game.thiefRoundSummary!.player2.cumulativeScore;

             if ((game.round === 2 && p1Score !== p2Score) || game.isDeathmatch) {
                 const winnerId = p1Score > p2Score ? p1Id : p2Id;
                 const winnerEnum = winnerId === game.blackPlayerId ? types.Player.Black : types.Player.White;
                 endGame(game, winnerEnum, 'total_score');
             } else if (game.round === 2 && p1Score === p2Score) { // Tie after 2 rounds, start deathmatch
                game.round++;
                game.isDeathmatch = true;
                resetThiefBoardForNewSegment(game);
                game.turnInRound = 1;
                game.thiefCapturesThisRound = 0;
                game.roundEndConfirmations = {};
                game.revealEndTime = undefined;
                game.thiefRoundSummary = undefined;
                
                game.gameStatus = 'thief_role_selection';
                game.roleChoices = { [p1Id]: null, [p2Id]: null };
                game.turnChoiceDeadline = now + 10000; // 10s
             } else { // round 1 ended, start round 2
                 game.round++;
                 game.isDeathmatch = game.round > 2;
                 const p1PrevRole = game.thiefRoundSummary!.player1.role;
                 resetThiefBoardForNewSegment(game);
                 game.turnInRound = 1;
                 game.thiefCapturesThisRound = 0;
                 game.roundEndConfirmations = {};
                 game.revealEndTime = undefined;
                 game.thiefRoundSummary = undefined;
                 game.thiefPlayerId = p1PrevRole === 'thief' ? p2Id : p1Id;
                 game.policePlayerId = p1PrevRole === 'thief' ? p1Id : p2Id;

                 game.blackPlayerId = game.thiefPlayerId;
                 game.whitePlayerId = game.policePlayerId;
                 game.currentPlayer = types.Player.Black;
                 game.gameStatus = 'thief_rolling';
                 if (shouldEnforceTimeControl(game)) {
                     game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                     game.turnStartTime = now;
                 }
                 
                 // AI 턴인 경우 즉시 처리할 수 있도록 aiTurnStartTime을 현재 시간으로 설정
                 if (game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White)) {
                     const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                     if (currentPlayerId === aiUserId) {
                         scheduleAiTurnStartForFreshUi(game, now);
                         console.log(`[updateThiefState] AI turn at round start, game ${game.id}, deferred aiTurnStartTime by first-move delay`);
                     } else {
                         game.aiTurnStartTime = undefined;
                         console.log(`[updateThiefState] User turn at round start, game ${game.id}, clearing aiTurnStartTime`);
                     }
                 }
             }
         }
    }
};

export const handleThiefAction = async (volatileState: types.VolatileState, game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): Promise<types.HandleActionResult | undefined> => {
    const { type, payload } = action as any;
    const now = Date.now();
    
    const myPlayerEnum = user.id === game.blackPlayerId ? types.Player.Black : (user.id === game.whitePlayerId ? types.Player.White : types.Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;
    const p1Id = game.player1.id;
    
    if (type === 'SUBMIT_RPS_CHOICE') {
        if (!game.rpsState || typeof game.rpsState[user.id] === 'string') {
            return { error: "Cannot make RPS choice now." };
        }
        game.rpsState[user.id] = payload.choice;
        return {};
    }
    
    // Delegate other shared actions
    const sharedResult = await handleSharedAction(volatileState, game, action, user);
    if (sharedResult) return sharedResult;

    switch (type) {
        case 'THIEF_UPDATE_ROLE_CHOICE': {
            if (game.gameStatus !== 'thief_role_selection') return { error: "Not in role selection phase." };
            if (!game.roleChoices) game.roleChoices = {};
            if (game.roleChoices[user.id]) return { error: "You have already chosen a role." };
            
            const { choice } = payload as { choice: 'thief' | 'police' };
            game.roleChoices[user.id] = choice;

            // The state transition logic is now exclusively handled by the updateThiefState function.
            // We just need to signal that the game state has changed.
            return {};
        }
        case 'CONFIRM_THIEF_ROLE': {
            if (game.gameStatus !== 'thief_role_confirmed') {
                return { error: "Not in role confirmation phase." };
            }
            if (!game.preGameConfirmations) game.preGameConfirmations = {};
            game.preGameConfirmations[user.id] = true;
            return {};
        }
        case 'THIEF_ROLL_DICE': {
            if (game.gameStatus !== 'thief_rolling' || !isMyTurn) {
                return { error: 'Not your turn to roll.' };
            }
        
            const myRole = user.id === game.thiefPlayerId ? 'thief' : 'police';
            const { itemType } = payload as { itemType?: 'high36' | 'noOne' };
            ensureThiefGoItemUses(game);

            if (itemType === 'high36' || itemType === 'noOne') {
                const uses = game.thiefGoItemUses?.[user.id];
                if (!uses || uses[itemType] <= 0) {
                    return { error: '아이템이 없습니다.' };
                }
                uses[itemType]--;
            } else if (itemType != null) {
                return { error: '알 수 없는 아이템입니다.' };
            }

            const { dice1, dice2, stonesToPlace } = rollThiefDiceForRole(myRole, itemType);
        
            game.stonesToPlace = stonesToPlace;
            game.dicePlacingSettleUntil = undefined;
            game.animation = { type: 'dice_roll_main', dice: { dice1, dice2, dice3: 0 }, startTime: now, duration: 1500 };
            game.gameStatus = 'thief_rolling_animating';
            game.turnDeadline = undefined;
            game.turnStartTime = undefined;
            game.dice = undefined; 
        
            if (!game.thiefDiceRollHistory) game.thiefDiceRollHistory = { [p1Id]: [], [game.player2.id]: [] };
            game.thiefDiceRollHistory[user.id].push(dice1);
            if (dice2 > 0) game.thiefDiceRollHistory[user.id].push(dice2);
            return {};
        }
        case 'THIEF_PLACE_STONE': {
            if (game.gameStatus !== 'thief_placing' || !isMyTurn) {
                return { error: '상대방의 차례입니다.' };
            }
            if ((game.stonesToPlace ?? 0) <= 0) {
                return { error: 'No stones left to place.' };
            }
        
            const { x, y } = payload;
            const logic = getGoLogic(game);
            const myRole = user.id === game.thiefPlayerId ? 'thief' : 'police';
            
            // 치명적 버그 방지: 상대방 돌 위에 착점하는 것을 명시적으로 차단
            const opponentPlayerEnum = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
            const stoneAtTarget = game.boardState[y][x];
            
            if (stoneAtTarget === opponentPlayerEnum) {
                console.error(`[handleThiefAction] CRITICAL BUG PREVENTION: Attempted to place stone on opponent stone at (${x}, ${y}), gameId=${game.id}, stoneAtTarget=${stoneAtTarget}, opponentPlayerEnum=${opponentPlayerEnum}`);
                return { error: '상대방이 둔 자리에는 돌을 놓을 수 없습니다.' };
            }
            
            if (stoneAtTarget === myPlayerEnum) {
                console.error(`[handleThiefAction] CRITICAL BUG PREVENTION: Attempted to place stone on own stone at (${x}, ${y}), gameId=${game.id}, stoneAtTarget=${stoneAtTarget}, myPlayerEnum=${myPlayerEnum}`);
                return { error: '이미 돌이 놓인 자리입니다.' };
            }
        
            if (myRole === 'thief') {
                const noBlackStonesOnBoard = !game.boardState.flat().includes(types.Player.Black);
                const canPlaceFreely =
                    game.turnInRound === 1 || noBlackStonesOnBoard || !!game.thiefFreestyleThiefPlacing;

                if (!canPlaceFreely) {
                    const liberties = logic.getAllLibertiesOfPlayer(types.Player.Black, game.boardState);
                    if (liberties.length > 0 && !liberties.some(p => p.x === x && p.y === y)) {
                        return { error: '도둑은 기존 돌의 활로에만 놓을 수 있습니다.' };
                    }
                }
            } else { // Police
                const blackStonesOnBoard = game.boardState.flat().includes(types.Player.Black);
                if (blackStonesOnBoard) {
                     const liberties = logic.getAllLibertiesOfPlayer(types.Player.Black, game.boardState);
                     if (liberties.length > 0 && !liberties.some(p => p.x === x && p.y === y)) {
                         return { error: '경찰은 도둑의 활로에만 놓을 수 있습니다.' };
                     }
                }
            }
        
            const move = { x, y, player: myPlayerEnum };
            const result = processMove(game.boardState, move, game.koInfo, game.moveHistory.length, { ignoreSuicide: true });
            if (!result.isValid) {
                console.error(`[handleThiefAction] CRITICAL BUG PREVENTION: processMove returned invalid at (${x}, ${y}), gameId=${game.id}, reason=${result.reason}`);
                return { error: `Invalid move: ${result.reason}` };
            }
            
            if (!game.stonesPlacedThisTurn) game.stonesPlacedThisTurn = [];
            game.stonesPlacedThisTurn.push({x, y});

            game.boardState = result.newBoardState;
            game.lastMove = { x, y };
        
            if (myRole === 'police' && result.capturedStones.length > 0) {
                if (!game.thiefCapturesThisRound) game.thiefCapturesThisRound = 0;
                game.thiefCapturesThisRound += result.capturedStones.length;
            }
        
            game.stonesToPlace = (game.stonesToPlace ?? 1) - 1;
            const blackStonesLeft = game.boardState.flat().filter(s => s === types.Player.Black).length;
            const allThievesCaptured = blackStonesLeft === 0 && myRole === 'police';

            if (allThievesCaptured) {
                // 도둑 돌이 모두 잡히면 해당 밤의 경찰 턴만 조기 종료하지만,
                // 라운드는 5밤(10턴)을 모두 채운 뒤에만 종료한다.
                game.stonesToPlace = 0;
            }

            if (game.stonesToPlace <= 0) {
                game.lastTurnStones = game.stonesPlacedThisTurn;
                game.stonesPlacedThisTurn = [];
                game.lastMove = null;
                
                game.turnInRound = (game.turnInRound || 0) + 1;
                const fiveNightsComplete = game.turnInRound > THIEF_TURNS_PER_ROUND;
        
                if (fiveNightsComplete) {
                    const finalThiefStonesLeft = game.boardState.flat().filter(s => s === types.Player.Black).length;
                    const capturesThisRound = game.thiefCapturesThisRound || 0;
                    game.scores[game.thiefPlayerId!] = (game.scores[game.thiefPlayerId!] || 0) + finalThiefStonesLeft;
                    game.scores[game.policePlayerId!] = (game.scores[game.policePlayerId!] || 0) + capturesThisRound;
                    
                    const p1IsThief = game.player1.id === game.thiefPlayerId;

                    game.thiefRoundSummary = {
                        round: game.round,
                        isDeathmatch: !!game.isDeathmatch,
                        player1: {
                            id: p1Id,
                            role: p1IsThief ? 'thief' : 'police',
                            roundScore: p1IsThief ? finalThiefStonesLeft : capturesThisRound,
                            cumulativeScore: game.scores[p1Id] ?? 0,
                        },
                        player2: {
                            id: game.player2.id,
                            role: !p1IsThief ? 'thief' : 'police',
                            roundScore: !p1IsThief ? finalThiefStonesLeft : capturesThisRound,
                            cumulativeScore: game.scores[game.player2.id] ?? 0,
                        }
                    };

                    const p1Score = game.scores[p1Id]!;
                    const p2Score = game.scores[game.player2.id]!;
                    
                    if ((game.round === 2 && p1Score !== p2Score) || game.isDeathmatch) {
                        const winnerId = p1Score > p2Score ? p1Id : game.player2.id;
                        const winnerEnum = winnerId === game.blackPlayerId ? types.Player.Black : types.Player.White;
                        endGame(game, winnerEnum, 'total_score');
                        return {};
                    }
                    
                    enterThiefRoundEndModal(game, now);
                } else {
                    const deferHandoff = user.id !== aiUserId;
                    if (deferHandoff) {
                        game.dicePlacingSettleUntil = now + DICE_HUMAN_PLACE_SETTLE_MS;
                        if (shouldEnforceTimeControl(game)) {
                            game.turnDeadline = undefined;
                            game.turnStartTime = undefined;
                        }
                    } else {
                        applyThiefPlacingHandoff(game, now);
                    }
                }
            }
            return { clientResponse: { game: { ...game, boardState: game.boardState.map((row: number[]) => [...row]) } } };
        }
        case 'CONFIRM_ROUND_END': {
            if (game.gameStatus !== 'thief_round_end') return { error: "Not in round end confirmation phase." };
            if (!game.roundEndConfirmations) game.roundEndConfirmations = {};
            game.roundEndConfirmations[user.id] = now;
            return {};
        }
    }
    return undefined;
};