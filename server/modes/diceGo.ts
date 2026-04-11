import * as types from '../../types/index.js';
import * as db from '../db.js';
import { getGoLogic, processMove } from '../goLogic.js';
import { handleSharedAction, updateSharedGameState, shouldEnforceTimeControl } from './shared.js';
import { DICE_GO_INITIAL_WHITE_STONES_BY_ROUND, DICE_GO_LAST_CAPTURE_BONUS_BY_TOTAL_ROUNDS, DICE_GO_MAIN_PLACE_TIME, DICE_GO_MAIN_ROLL_TIME, DICE_GO_MIN_WHITE_GROUPS, DICE_GO_TURN_CHOICE_TIME, DICE_GO_TURN_ROLL_TIME, PLAYFUL_MODE_FOUL_LIMIT } from '../../constants';
import * as effectService from '../effectService.js';
import { endGame } from '../summaryService.js';
import { aiUserId } from '../aiPlayer.js';

/** AI 대국: 인간 착수 직후 상대(봇) 주사위 단계로 바로 넘어가면 마지막 돌·따내기 연출이 밀림 → 1초 대기 (도둑과 경찰에서도 동일 상수 사용) */
export const DICE_HUMAN_PLACE_SETTLE_MS = 1000;
const DICE_GO_MAX_WHITE_CLUSTER = 5;

function diceGoBoardNeighbors(x: number, y: number, boardSize: number): types.Point[] {
    const neighbors: types.Point[] = [];
    if (x > 0) neighbors.push({ x: x - 1, y });
    if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
    if (y > 0) neighbors.push({ x, y: y - 1 });
    if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
    return neighbors;
}

function countDiceGoWhiteGroups(board: number[][], boardSize: number): number {
    const visited = new Set<string>();
    let groups = 0;
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (board[y][x] !== types.Player.White) continue;
            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            groups++;
            const q: types.Point[] = [{ x, y }];
            visited.add(key);
            while (q.length > 0) {
                const p = q.shift()!;
                for (const n of diceGoBoardNeighbors(p.x, p.y, boardSize)) {
                    const nk = `${n.x},${n.y}`;
                    if (board[n.y][n.x] === types.Player.White && !visited.has(nk)) {
                        visited.add(nk);
                        q.push(n);
                    }
                }
            }
        }
    }
    return groups;
}

/**
 * 백 `stoneCount`개를 두되, 상하좌우 연결 요(더미)가 최소 `DICE_GO_MIN_WHITE_GROUPS`개(돌 개수가 더 적으면 그만큼)가 되도록 한다.
 */
function placeDiceGoInitialWhiteStones(board: number[][], boardSize: number, stoneCount: number): void {
    const minGroups = Math.min(DICE_GO_MIN_WHITE_GROUPS, stoneCount);

    const clearWhites = () => {
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                if (board[y][x] === types.Player.White) board[y][x] = types.Player.None;
            }
        }
    };

    const findGroupSize = (startX: number, startY: number) => {
        const q: types.Point[] = [{ x: startX, y: startY }];
        const visited = new Set([`${startX},${startY}`]);
        let size = 0;
        while (q.length > 0) {
            const { x, y } = q.shift()!;
            size++;
            for (const n of diceGoBoardNeighbors(x, y, boardSize)) {
                const key = `${n.x},${n.y}`;
                if (board[n.y][n.x] === types.Player.White && !visited.has(key)) {
                    visited.add(key);
                    q.push(n);
                }
            }
        }
        return size;
    };

    const runRandomPlacementPass = () => {
        let stonesPlaced = 0;
        while (stonesPlaced < stoneCount) {
            let placed = false;
            let attempts = 0;
            while (!placed && attempts < 200) {
                attempts++;
                const groupsNow = countDiceGoWhiteGroups(board, boardSize);
                const extendProb = groupsNow < minGroups ? 0.5 : 0.8;
                const shouldExtend = stonesPlaced > 0 && Math.random() < extendProb;

                if (shouldExtend) {
                    const existingStones: types.Point[] = [];
                    for (let y = 0; y < boardSize; y++) {
                        for (let x = 0; x < boardSize; x++) {
                            if (board[y][x] === types.Player.White) existingStones.push({ x, y });
                        }
                    }
                    if (existingStones.length === 0) continue;
                    const randomExistingStone = existingStones[Math.floor(Math.random() * existingStones.length)];
                    const neighbors = diceGoBoardNeighbors(randomExistingStone.x, randomExistingStone.y, boardSize);
                    const shuffledNeighbors = neighbors.sort(() => 0.5 - Math.random());

                    for (const n of shuffledNeighbors) {
                        if (board[n.y][n.x] === types.Player.None) {
                            board[n.y][n.x] = types.Player.White;
                            if (findGroupSize(n.x, n.y) <= DICE_GO_MAX_WHITE_CLUSTER) {
                                stonesPlaced++;
                                placed = true;
                                break;
                            } else {
                                board[n.y][n.x] = types.Player.None;
                            }
                        }
                    }
                } else {
                    const x = Math.floor(Math.random() * boardSize);
                    const y = Math.floor(Math.random() * boardSize);
                    if (board[y][x] === types.Player.None) {
                        board[y][x] = types.Player.White;
                        stonesPlaced++;
                        placed = true;
                    }
                }
            }
            if (attempts >= 200) {
                let x: number, y: number;
                do {
                    x = Math.floor(Math.random() * boardSize);
                    y = Math.floor(Math.random() * boardSize);
                } while (board[y][x] !== types.Player.None);
                board[y][x] = types.Player.White;
                stonesPlaced++;
            }
        }
    };

    for (let trial = 0; trial < 150; trial++) {
        clearWhites();
        runRandomPlacementPass();
        if (countDiceGoWhiteGroups(board, boardSize) >= minGroups) return;
    }

    // 서로 인접하지 않은 시드로 최소 그룹 수를 확보한 뒤, 병합 시 그룹 수가 깨지지 않는 착점만 허용
    for (let fb = 0; fb < 80; fb++) {
        clearWhites();
        let seeds = 0;
        let tries = 0;
        while (seeds < minGroups && tries < 8000) {
            tries++;
            const x = Math.floor(Math.random() * boardSize);
            const y = Math.floor(Math.random() * boardSize);
            if (board[y][x] !== types.Player.None) continue;
            let orthoOk = true;
            for (const n of diceGoBoardNeighbors(x, y, boardSize)) {
                if (board[n.y][n.x] === types.Player.White) {
                    orthoOk = false;
                    break;
                }
            }
            if (!orthoOk) continue;
            board[y][x] = types.Player.White;
            seeds++;
        }
        if (seeds < minGroups) continue;

        let stonesPlaced = seeds;
        let guard = 0;
        while (stonesPlaced < stoneCount && guard < 20000) {
            guard++;
            let extended = false;
            const existingStones: types.Point[] = [];
            for (let y = 0; y < boardSize; y++) {
                for (let x = 0; x < boardSize; x++) {
                    if (board[y][x] === types.Player.White) existingStones.push({ x, y });
                }
            }
            const randomExistingStone = existingStones[Math.floor(Math.random() * existingStones.length)];
            const shuffledNeighbors = diceGoBoardNeighbors(randomExistingStone.x, randomExistingStone.y, boardSize).sort(() => 0.5 - Math.random());
            for (const n of shuffledNeighbors) {
                if (board[n.y][n.x] !== types.Player.None) continue;
                board[n.y][n.x] = types.Player.White;
                if (findGroupSize(n.x, n.y) > DICE_GO_MAX_WHITE_CLUSTER) {
                    board[n.y][n.x] = types.Player.None;
                    continue;
                }
                if (countDiceGoWhiteGroups(board, boardSize) >= minGroups) {
                    stonesPlaced++;
                    extended = true;
                    break;
                }
                board[n.y][n.x] = types.Player.None;
            }
            if (extended) continue;
            for (let a = 0; a < 120; a++) {
                const x = Math.floor(Math.random() * boardSize);
                const y = Math.floor(Math.random() * boardSize);
                if (board[y][x] !== types.Player.None) continue;
                board[y][x] = types.Player.White;
                if (countDiceGoWhiteGroups(board, boardSize) >= minGroups) {
                    stonesPlaced++;
                    extended = true;
                    break;
                }
                board[y][x] = types.Player.None;
            }
            if (!extended) break;
        }
        if (stonesPlaced >= stoneCount && countDiceGoWhiteGroups(board, boardSize) >= minGroups) return;
    }

    for (let last = 0; last < 100; last++) {
        clearWhites();
        runRandomPlacementPass();
        if (countDiceGoWhiteGroups(board, boardSize) >= minGroups) return;
    }
}

function diceGoLastCaptureBonusForSettings(game: types.LiveGameSession): number {
    const totalRounds = game.settings.diceGoRounds ?? 1;
    const idx = Math.max(0, Math.min(totalRounds, DICE_GO_LAST_CAPTURE_BONUS_BY_TOTAL_ROUNDS.length) - 1);
    return DICE_GO_LAST_CAPTURE_BONUS_BY_TOTAL_ROUNDS[idx] ?? 0;
}

/** 구세이브에 low/high 키가 없을 때 설정값으로 보정 */
function patchDiceGoItemUsesRow(game: types.LiveGameSession, userId: string): void {
    if (!game.diceGoItemUses) game.diceGoItemUses = {};
    const u = game.diceGoItemUses[userId];
    if (!u) return;
    const s = game.settings;
    if (typeof u.low !== 'number') u.low = s.lowDiceCount ?? 0;
    if (typeof u.high !== 'number') u.high = s.highDiceCount ?? 0;
}

/** 오버샷 시 전광판 안내용. 착수 단계 진입 시 서버에서 해제한다. */
export function syncDiceGoOvershotTicker(game: types.LiveGameSession, libertiesCount: number, isOvershot: boolean) {
    const whiteLeft = game.boardState.flat().filter(s => s === types.Player.White).length;
    if (isOvershot && whiteLeft > 0) {
        game.diceGoOvershotTicker = {
            maxDice: libertiesCount,
            lastCaptureBonus: diceGoLastCaptureBonusForSettings(game),
        };
    } else {
        game.diceGoOvershotTicker = undefined;
    }
}

function applyDicePlacingTurnPass(game: types.LiveGameSession, now: number) {
    game.currentPlayer = game.currentPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
    game.gameStatus = 'dice_rolling';
    if (shouldEnforceTimeControl(game)) {
        game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
        game.turnStartTime = now;
    }

    if (game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White)) {
        const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
        if (currentPlayerId === aiUserId) {
            game.aiTurnStartTime = now;
            console.log(`[applyDicePlacingTurnPass] AI turn after placement, game ${game.id}, setting aiTurnStartTime to now: ${now}`);
        } else {
            game.aiTurnStartTime = undefined;
            console.log(`[applyDicePlacingTurnPass] User turn after placement, game ${game.id}, clearing aiTurnStartTime`);
        }
    }
    updateLastWhiteGroupInfoAfterTurnTransition(game);
}

/** 턴이 넘어간 뒤 현재 보드 기준으로 백의 유효자리 수를 세고, 6 이하일 때만 lastWhiteGroupInfo 설정 (안내용) */
function updateLastWhiteGroupInfoAfterTurnTransition(game: types.LiveGameSession) {
    const logic = getGoLogic(game);
    const allWhiteLiberties = logic.getAllLibertiesOfPlayer(types.Player.White, game.boardState);
    const whiteStoneCount = game.boardState.flat().filter(s => s === types.Player.White).length;
    if (whiteStoneCount === 0) {
        game.lastWhiteGroupInfo = null;
        return;
    }
    const liberties = allWhiteLiberties.length;
    if (liberties <= 6) {
        game.lastWhiteGroupInfo = { size: whiteStoneCount, liberties };
    } else {
        game.lastWhiteGroupInfo = null;
    }
}

export function finishPlacingTurn(game: types.LiveGameSession, playerId: string) {
    const now = Date.now();
    const humanPlayerId = game.player1.id === aiUserId ? game.player2.id : game.player1.id;
    const aiPlayerId = game.player1.id === aiUserId ? game.player1.id : game.player2.id;

    const totalCapturesThisTurn = game.diceCapturesThisTurn || 0;
    const lastCaptureStones = game.diceLastCaptureStones || [];

    game.scores[playerId] = (game.scores[playerId] || 0) + totalCapturesThisTurn;
    game.stonesToPlace = 0;
    
    const whiteStonesLeft = game.boardState.flat().filter(s => s === types.Player.White).length;

    if (whiteStonesLeft === 0) {
        // 마지막 백돌 제거로 라운드 종료로 진입할 때, 이전 턴의 유효자리 안내가 남지 않도록 즉시 초기화
        game.lastWhiteGroupInfo = null;
        game.diceGoOvershotTicker = undefined;
        if (totalCapturesThisTurn > 0) { // Check if the last action was a capture
            const totalRounds = game.settings.diceGoRounds ?? 1;
            const bonus = DICE_GO_LAST_CAPTURE_BONUS_BY_TOTAL_ROUNDS[totalRounds - 1];
            game.scores[playerId] = (game.scores[playerId] || 0) + bonus;
            if (!game.diceGoBonuses) game.diceGoBonuses = {};
            game.diceGoBonuses[playerId] = (game.diceGoBonuses[playerId] || 0) + bonus;

            game.animation = {
                type: 'bonus_score',
                playerId: playerId,
                bonus: bonus,
                startTime: now,
                duration: 3000
            };

            if (bonus > 0 && lastCaptureStones.length > 0) {
                if (!game.justCaptured) game.justCaptured = [];
                const pt = lastCaptureStones[lastCaptureStones.length - 1];
                game.justCaptured.push({
                    point: pt,
                    player: types.Player.White,
                    wasHidden: false,
                    capturePoints: bonus,
                });
            }
        }

        const totalRounds = game.settings.diceGoRounds ?? 3;
        if (game.round >= totalRounds && !game.isDeathmatch) {
            const p1Score = game.scores[game.player1.id] || 0;
            const p2Score = game.scores[game.player2.id] || 0;
            if (p1Score !== p2Score) {
                const winnerId = p1Score > p2Score ? game.player1.id : game.player2.id;
                const winnerEnum = winnerId === game.blackPlayerId ? types.Player.Black : (winnerId === game.whitePlayerId ? types.Player.White : types.Player.None);
                endGame(game, winnerEnum, 'dice_win');
                return;
            }
        }
        
        const roundSummary: types.DiceRoundSummary = {
            round: game.round,
            scores: { ...game.scores }
        };
        if (game.round === 1 && game.diceRollHistory) {
            roundSummary.diceStats = {};
            const playerIds = game.isAiGame ? [humanPlayerId, aiPlayerId] : [game.player1.id, game.player2.id];
            playerIds.forEach(pid => {
                const rolls = game.diceRollHistory![pid] || [];
                const rollCounts: { [roll: number]: number } = {};
                for (const roll of rolls) {
                    rollCounts[roll] = (rollCounts[roll] || 0) + 1;
                }
                roundSummary.diceStats![pid] = {
                    rolls: rollCounts,
                    totalRolls: rolls.length,
                };
            });
        }
        game.diceRoundSummary = roundSummary;
        game.gameStatus = 'dice_round_end';
        game.revealEndTime = now + 20000;
        if (!game.roundEndConfirmations) game.roundEndConfirmations = {};
        if (game.isAiGame) game.roundEndConfirmations[aiUserId] = now;

    } else {
        game.lastTurnStones = game.stonesPlacedThisTurn;
        game.stonesPlacedThisTurn = [];
        game.lastMove = null;

        // 인간이 돌을 다 놓은 직후 바로 상대(봇) 주사위 단계로 넘어가면 따내기 연출을 보기 어려움 → 1초 대기
        const deferHandoff = playerId !== aiUserId;
        if (deferHandoff) {
            game.dicePlacingSettleUntil = now + DICE_HUMAN_PLACE_SETTLE_MS;
            if (shouldEnforceTimeControl(game)) {
                game.turnDeadline = undefined;
                game.turnStartTime = undefined;
            }
        } else {
            applyDicePlacingTurnPass(game, now);
        }
    }
    
    game.diceCapturesThisTurn = 0;
    game.diceLastCaptureStones = [];
}


const handleTimeoutFoul = (game: types.LiveGameSession, timedOutPlayerId: string, now: number): boolean => {
    if (!game.timeoutFouls) game.timeoutFouls = {};
    game.timeoutFouls[timedOutPlayerId] = (game.timeoutFouls[timedOutPlayerId] || 0) + 1;
    game.foulInfo = { message: '시간 초과 파울!', expiry: now + 4000 };

    if (game.timeoutFouls[timedOutPlayerId] >= PLAYFUL_MODE_FOUL_LIMIT) {
        const winnerId = game.player1.id === timedOutPlayerId ? game.player2.id : game.player1.id;
        const winnerEnum = winnerId === game.blackPlayerId ? types.Player.Black : types.Player.White;
        endGame(game, winnerEnum, 'timeout');
        return true; // Game ended
    }
    return false; // Game continues
};


export const initializeDiceGo = (game: types.LiveGameSession, neg: types.Negotiation, now: number) => {
    const p1 = game.player1;
    const p2 = game.player2;

    game.blackPlayerId = null;
    game.whitePlayerId = null;
    
    const initialStoneCount = DICE_GO_INITIAL_WHITE_STONES_BY_ROUND[0];
    const { boardSize } = game.settings;
    placeDiceGoInitialWhiteStones(game.boardState, boardSize, initialStoneCount);

    const p1Effects = effectService.calculateUserEffects(p1);
    const p2Effects = effectService.calculateUserEffects(p2);
    const p1MythicBonus = p1Effects.mythicStatBonuses[types.MythicStat.DiceGoOddBonus]?.flat || 0;
    const p2MythicBonus = p2Effects.mythicStatBonuses[types.MythicStat.DiceGoOddBonus]?.flat || 0;

    const baseOdd = (game.settings.oddDiceCount || 0) + p1MythicBonus;
    const baseEven = (game.settings.evenDiceCount || 0) + p1MythicBonus;
    const baseLow = (game.settings.lowDiceCount || 0) + p1MythicBonus;
    const baseHigh = (game.settings.highDiceCount || 0) + p1MythicBonus;
    const baseOdd2 = (game.settings.oddDiceCount || 0) + p2MythicBonus;
    const baseEven2 = (game.settings.evenDiceCount || 0) + p2MythicBonus;
    const baseLow2 = (game.settings.lowDiceCount || 0) + p2MythicBonus;
    const baseHigh2 = (game.settings.highDiceCount || 0) + p2MythicBonus;
    game.diceGoItemUses = {
        [p1.id]: { odd: baseOdd, even: baseEven, low: baseLow, high: baseHigh },
        [p2.id]: { odd: baseOdd2, even: baseEven2, low: baseLow2, high: baseHigh2 },
    };
    // AI/PVP 공통으로 주사위 이력 버킷을 미리 보장한다.
    game.diceRollHistory = { [p1.id]: [], [p2.id]: [] };
    
    game.scores = { [p1.id]: 0, [p2.id]: 0 };
    game.round = 1;
    game.moveHistory = [];
    game.koInfo = null;
    game.dicePlacingSettleUntil = undefined;
    game.diceGoOvershotTicker = undefined;
    game.justCaptured = [];

    if (game.isAiGame) {
        const humanPlayerColor = neg.settings.player1Color || types.Player.Black;
        if (humanPlayerColor === types.Player.Black) {
            game.blackPlayerId = game.player1.id;
            game.whitePlayerId = game.player2.id;
        } else {
            game.whitePlayerId = game.player1.id;
            game.blackPlayerId = game.player2.id;
        }
        
        game.currentPlayer = types.Player.Black;
        game.gameStatus = 'dice_rolling';
        if (shouldEnforceTimeControl(game)) {
            game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
            game.turnStartTime = now;
        }
        
        // AI 턴인 경우 즉시 처리할 수 있도록 aiTurnStartTime을 현재 시간으로 설정
        const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
        if (currentPlayerId === aiUserId) {
            game.aiTurnStartTime = now;
            console.log(`[initializeDiceGo] AI turn at game start, game ${game.id}, setting aiTurnStartTime to now: ${now}`);
        } else {
            game.aiTurnStartTime = undefined;
            console.log(`[initializeDiceGo] User turn at game start, game ${game.id}, clearing aiTurnStartTime`);
        }
    } else {
        game.gameStatus = 'dice_turn_rolling';
        game.turnOrderRolls = { [p1.id]: null, [p2.id]: null };
        game.turnOrderRollReady = { [p1.id]: false, [p2.id]: false };
        game.turnOrderRollTies = 0;
        game.turnOrderRollDeadline = now + DICE_GO_TURN_ROLL_TIME * 1000;
    }
};

export const updateDiceGoState = (game: types.LiveGameSession, now: number) => {
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    
    switch (game.gameStatus) {
        case 'dice_turn_rolling':
            if (game.isAiGame) {
                const aiPlayerId = game.player1.id === aiUserId 
                    ? game.player1.id 
                    : (game.player2.id === aiUserId ? game.player2.id : null);
                
                if (aiPlayerId && game.turnOrderRollReady && !game.turnOrderRollReady[aiPlayerId]) {
                    game.turnOrderRollReady[aiPlayerId] = true;
                }
            }

            if (game.turnOrderRollDeadline && now > game.turnOrderRollDeadline) {
                if (!game.turnOrderRollReady?.[p1Id]) game.turnOrderRollReady![p1Id] = true;
                if (!game.turnOrderRollReady?.[p2Id]) game.turnOrderRollReady![p2Id] = true;
            }
            if (game.turnOrderRollReady?.[p1Id] && game.turnOrderRollReady?.[p2Id]) {
                const p1Roll = Math.floor(Math.random() * 6) + 1;
                const p2Roll = Math.floor(Math.random() * 6) + 1;
                game.animation = { type: 'dice_roll_turn', p1Roll, p2Roll, startTime: now, duration: 2000 };
                game.gameStatus = 'dice_turn_rolling_animating';
                game.turnOrderRollDeadline = undefined;
            }
            break;
        case 'dice_turn_rolling_animating':
            if (game.animation && game.animation.type === 'dice_roll_turn' && now > game.animation.startTime + game.animation.duration) {
                const { p1Roll, p2Roll } = game.animation;
                game.turnOrderRolls = { [p1Id]: p1Roll, [p2Id]: p2Roll };
                if (p1Roll === p2Roll) {
                    game.turnOrderRollTies = (game.turnOrderRollTies || 0) + 1;
                    if (game.turnOrderRollTies >= 3) {
                        // Force a winner
                        const winnerId = Math.random() < 0.5 ? p1Id : p2Id;
                        game.turnChooserId = winnerId;
                        game.gameStatus = 'dice_turn_choice';
                        game.turnChoiceDeadline = now + DICE_GO_TURN_CHOICE_TIME * 1000;
                        game.turnOrderRollTies = 0; // Reset for next potential game
                    } else {
                        // Re-roll
                        game.gameStatus = 'dice_turn_rolling';
                        game.turnOrderRollResult = 'tie';
                        game.turnOrderRollReady = { [p1Id]: false, [p2Id]: false };
                        game.turnOrderRollDeadline = now + DICE_GO_TURN_ROLL_TIME * 1000;
                    }
                } else {
                    game.turnChooserId = p1Roll > p2Roll ? p1Id : p2Id;
                    game.gameStatus = 'dice_turn_choice';
                    game.turnChoiceDeadline = now + DICE_GO_TURN_CHOICE_TIME * 1000;
                    game.turnOrderRollTies = 0; // Reset on non-tie
                }
                game.animation = null;
            }
            break;
        case 'dice_turn_choice':
            if (game.turnChoiceDeadline && now > game.turnChoiceDeadline) {
                const choice = Math.random() < 0.5 ? 'first' : 'second';
                let chooserId = game.turnChooserId;
                if (!chooserId) {
                    chooserId = Math.random() < 0.5 ? p1Id : p2Id;
                }
                const otherId = chooserId === p1Id ? p2Id : p1Id;

                if (choice === 'first') {
                    game.blackPlayerId = chooserId;
                    game.whitePlayerId = otherId;
                } else {
                    game.whitePlayerId = chooserId;
                    game.blackPlayerId = otherId;
                }
                
                game.gameStatus = 'dice_start_confirmation';
                game.revealEndTime = now + 10000;
            }
            break;
        case 'dice_start_confirmation':
            if ((game.preGameConfirmations?.[p1Id] && game.preGameConfirmations?.[p2Id]) || (game.revealEndTime && now > game.revealEndTime)) {
                game.gameStatus = 'dice_rolling';
                game.currentPlayer = types.Player.Black;
                if (shouldEnforceTimeControl(game)) {
                    game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                    game.turnStartTime = now;
                }
            }
            break;
        case 'dice_rolling_animating': {
            const rollAnim = game.animation;
            const animDuration =
                rollAnim && rollAnim.type === 'dice_roll_main'
                    ? Math.max(0, Number(rollAnim.duration) || 1500)
                    : 1500;
            const animStart =
                rollAnim && rollAnim.type === 'dice_roll_main'
                    ? Number(rollAnim.startTime) || now
                    : now;
            const rollAnimComplete =
                rollAnim &&
                rollAnim.type === 'dice_roll_main' &&
                now >= animStart + animDuration;
            const rollerIdForDiceRoll =
                game.currentPlayer === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
            const lastDiceFromHist = game.diceRollHistory?.[rollerIdForDiceRoll]?.length
                ? game.diceRollHistory![rollerIdForDiceRoll][game.diceRollHistory![rollerIdForDiceRoll].length - 1]
                : undefined;
            const hasValidHistRoll =
                lastDiceFromHist != null && lastDiceFromHist >= 1 && lastDiceFromHist <= 6;
            // 애니 payload가 유실된 경우(직렬화/캐시/DB 등): 오버샷(-1) 또는 굴림 기록만으로 마무리
            const orphanOvershotNoAnim =
                (!rollAnim || rollAnim.type !== 'dice_roll_main') &&
                (game.stonesToPlace === -1 || Number(game.stonesToPlace) === -1);
            // 애니 객체가 없는데 animating만 남은 경우: 굴림 이력이 있으면 보드+주사위로 착수/오버샷 판정
            const orphanAnimatingByHistory =
                (!rollAnim || rollAnim.type !== 'dice_roll_main') && hasValidHistRoll;

            if (rollAnimComplete || orphanOvershotNoAnim || orphanAnimatingByHistory) {
                if (rollAnimComplete && rollAnim!.type === 'dice_roll_main') {
                    game.dice = rollAnim.dice;
                    game.animation = null;
                } else if (orphanOvershotNoAnim || orphanAnimatingByHistory) {
                    game.animation = null;
                    if (lastDiceFromHist != null && !game.dice) {
                        game.dice = { dice1: lastDiceFromHist, dice2: 0, dice3: 0 };
                    }
                }

                let dice1 = game.dice?.dice1 ?? 0;
                if (
                    (!dice1 || dice1 < 1 || dice1 > 6) &&
                    rollAnimComplete &&
                    rollAnim?.type === 'dice_roll_main' &&
                    rollAnim.dice &&
                    rollAnim.dice.dice1 >= 1 &&
                    rollAnim.dice.dice1 <= 6
                ) {
                    game.dice = {
                        dice1: rollAnim.dice.dice1,
                        dice2: rollAnim.dice.dice2 ?? 0,
                        dice3: rollAnim.dice.dice3 ?? 0,
                    };
                    dice1 = game.dice.dice1;
                }
                if (!dice1 || dice1 < 1 || dice1 > 6) {
                    const rollerId =
                        game.currentPlayer === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
                    const lastFromHist = game.diceRollHistory?.[rollerId]?.length
                        ? game.diceRollHistory![rollerId][game.diceRollHistory![rollerId].length - 1]
                        : undefined;
                    if (lastFromHist != null && lastFromHist >= 1 && lastFromHist <= 6) {
                        game.dice = { dice1: lastFromHist, dice2: 0, dice3: 0 };
                        dice1 = lastFromHist;
                    }
                }
                const logicRoll = getGoLogic(game);
                const libertiesRoll = logicRoll.getAllLibertiesOfPlayer(types.Player.White, game.boardState);
                const diceUnresolved = rollAnimComplete && (!dice1 || dice1 < 1 || dice1 > 6);
                // stonesToPlace=-1은 저장/병합 과정에서 유실될 수 있으므로, 굴림 직후와 동일하게 보드+주사위로 재판정한다.
                const isOvershotRoll =
                    diceUnresolved ||
                    libertiesRoll.length === 0 ||
                    dice1 > libertiesRoll.length ||
                    game.stonesToPlace === -1 ||
                    Number(game.stonesToPlace) === -1;

                if (isOvershotRoll) { // Overshot
                    game.diceGoOvershotTicker = undefined;
                    const overshotPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
                    const overshotPlayer = game.player1.id === overshotPlayerId ? game.player1 : game.player2;
                    game.foulInfo = { message: `${overshotPlayer.nickname}님의 오버샷! 턴이 넘어갑니다.`, expiry: now + 4000 };
                    game.currentPlayer = game.currentPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
                    game.gameStatus = 'dice_rolling';
                    game.stonesToPlace = 0;
                    // 유저 턴으로 넘어갈 때 새 턴 데드라인 설정 (타임파울/주사위 굴리기 불가 방지) — PVP에만
                    if (shouldEnforceTimeControl(game)) {
                        game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                        game.turnStartTime = now;
                    }
                    
                    // AI 턴인 경우 즉시 처리할 수 있도록 aiTurnStartTime을 현재 시간으로 설정
                    if (game.isAiGame && (game.currentPlayer === types.Player.Black || game.currentPlayer === types.Player.White)) {
                        const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                        if (currentPlayerId === aiUserId) {
                            game.aiTurnStartTime = now;
                            console.log(`[updateDiceGoState] AI turn after overshot, game ${game.id}, setting aiTurnStartTime to now: ${now}`);
                        } else {
                            game.aiTurnStartTime = undefined;
                            console.log(`[updateDiceGoState] User turn after overshot, game ${game.id}, clearing aiTurnStartTime`);
                        }
                    }
                    // 턴 넘긴 뒤 현재 보드 기준으로 유효자리 수 계산, 6 이하일 때만 안내용 설정
                    updateLastWhiteGroupInfoAfterTurnTransition(game);
                } else {
                    game.stonesToPlace = dice1;
                    game.diceGoOvershotTicker = undefined;
                    game.gameStatus = 'dice_placing';
                    game.dicePlacingSettleUntil = undefined;
                    if (shouldEnforceTimeControl(game)) {
                        game.turnDeadline = now + DICE_GO_MAIN_PLACE_TIME * 1000;
                        game.turnStartTime = now;
                    }
                    game.diceCapturesThisTurn = 0;
                    game.diceLastCaptureStones = [];
                    game.stonesPlacedThisTurn = [];
                    // 같은 플레이어가 착수하는 단계이므로 유효자리 안내는 턴이 넘어갈 때만 설정 (여기서는 설정하지 않음)
                }
            }
            break;
        }
        case 'dice_rolling': {
            // turnDeadline이 없거나 이미 지났으면 설정 (오버샷 직후 유저 턴·캐시 만료 등으로 꼬인 경우 방지) — PVP에만
            if (shouldEnforceTimeControl(game) && (!game.turnDeadline || now > game.turnDeadline)) {
                if (now > (game.turnDeadline || 0)) {
                    console.log(`[updateDiceGoState] Resetting stale turnDeadline for dice_rolling: gameId=${game.id}, currentPlayer=${game.currentPlayer}`);
                }
                game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                game.turnStartTime = now;
            }
            
            // AI 턴일 때는 타임아웃 체크를 건너뛰기
            const isAiTurn = game.isAiGame && game.currentPlayer !== types.Player.None && 
                            (game.currentPlayer === types.Player.Black ? game.blackPlayerId === aiUserId : game.whitePlayerId === aiUserId);
            
            // 타임아웃 체크 및 자동 주사위 굴리기 (실시간 PVP만). AI 대국(길드전 등 shouldEnforceTimeControl=true)은 파울만 적용하고 자동 굴림 없음.
            if (shouldEnforceTimeControl(game) && game.turnDeadline && now > game.turnDeadline && !isAiTurn) {
                const timedOutPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
                const timeOver = now - game.turnDeadline;
                console.log(`[updateDiceGoState] Timeout detected: gameId=${game.id}, timedOutPlayerId=${timedOutPlayerId}, timeOver=${timeOver}ms`);
                
                const gameEnded = handleTimeoutFoul(game, timedOutPlayerId, now);
                if (gameEnded) {
                    console.log(`[updateDiceGoState] Game ended due to timeout foul limit`);
                    return;
                }

                if (game.isAiGame) {
                    game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                    game.turnStartTime = now;
                    break;
                }

                // PVP: 굴림 단계 타임아웃 시 파울만 적용하고 자동 굴림은 하지 않음 — 플레이어가 직접 주사위/아이템을 선택하도록
                game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                game.turnStartTime = now;
            }
            break;
        }
        case 'dice_placing': {
            if (game.dicePlacingSettleUntil != null && now >= game.dicePlacingSettleUntil) {
                game.dicePlacingSettleUntil = undefined;
                applyDicePlacingTurnPass(game, now);
                break;
            }

            // 유효자리 안내는 턴이 넘어간 뒤(dice_rolling 전환 시)에만 설정하므로 여기서는 갱신하지 않음
            // AI 턴일 때는 타임아웃 체크를 건너뛰기
            const isAiTurnPlacing = game.isAiGame && game.currentPlayer !== types.Player.None && 
                                   (game.currentPlayer === types.Player.Black ? game.blackPlayerId === aiUserId : game.whitePlayerId === aiUserId);
            
            if (shouldEnforceTimeControl(game) && game.turnDeadline && now > game.turnDeadline && !isAiTurnPlacing) {
                const timedOutPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
                const gameEnded = handleTimeoutFoul(game, timedOutPlayerId, now);
                if (gameEnded) return;

                if (game.isAiGame) {
                    game.turnDeadline = now + DICE_GO_MAIN_PLACE_TIME * 1000;
                    game.turnStartTime = now;
                    break;
                }

                let stonesToPlace = game.stonesToPlace || 0;
                let tempBoardState = JSON.parse(JSON.stringify(game.boardState));
                let totalCapturesThisTurn = 0;
                let lastCaptureStones: types.Point[] = [];
        
                while (stonesToPlace > 0) {
                    const logicForLiberty = getGoLogic({ ...game, boardState: tempBoardState });
                    const liberties = logicForLiberty.getAllLibertiesOfPlayer(types.Player.White, tempBoardState);
                    if (liberties.length === 0) break;
                    
                    const move = liberties[Math.floor(Math.random() * liberties.length)];
                    const result = processMove(tempBoardState, { ...move, player: types.Player.Black }, game.koInfo, game.moveHistory.length, { ignoreSuicide: true });
        
                    if (result.isValid) {
                        tempBoardState = result.newBoardState;
                        if (result.capturedStones.length > 0) {
                            totalCapturesThisTurn += result.capturedStones.length;
                            lastCaptureStones = result.capturedStones;
                        }
                    } else {
                        console.error(`Dice Go Timeout random placement failed. Liberty: ${JSON.stringify(move)}, Reason: ${result.reason}`);
                        break;
                    }
                    stonesToPlace--;
                }
                game.boardState = tempBoardState;
                game.diceCapturesThisTurn = totalCapturesThisTurn;
                game.diceLastCaptureStones = lastCaptureStones;
                game.justCaptured = [];
                if (totalCapturesThisTurn > 0 && lastCaptureStones.length > 0) {
                    const pt = lastCaptureStones[lastCaptureStones.length - 1];
                    game.justCaptured.push({
                        point: pt,
                        player: types.Player.White,
                        wasHidden: false,
                        capturePoints: totalCapturesThisTurn,
                    });
                }
                finishPlacingTurn(game, timedOutPlayerId);
            }
            break;
        }
        case 'dice_round_end':
            if (game.isAiGame) {
                if (!game.roundEndConfirmations) game.roundEndConfirmations = {};
                game.roundEndConfirmations[aiUserId] = now;
            }
            const bothConfirmed = game.roundEndConfirmations?.[p1Id] && game.roundEndConfirmations?.[p2Id];
            if ((game.revealEndTime && now > game.revealEndTime) || bothConfirmed) {
                const totalRounds = game.settings.diceGoRounds || 3;
                if (game.round >= totalRounds && !game.isDeathmatch) {
                    const p1Score = game.scores[p1Id] || 0;
                    const p2Score = game.scores[p2Id] || 0;
                    if (p1Score === p2Score) { // Tie, start deathmatch
                        game.round++;
                        game.isDeathmatch = true;
                        game.boardState = Array(game.settings.boardSize).fill(0).map(() => Array(game.settings.boardSize).fill(types.Player.None));
                        const center = Math.floor(game.settings.boardSize / 2);
                        game.boardState[center][center] = types.Player.White;
                        game.gameStatus = 'dice_rolling';
                        game.currentPlayer = types.Player.Black;
                        if (shouldEnforceTimeControl(game)) {
                            game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                            game.turnStartTime = now;
                        }
                        game.diceRoundSummary = undefined;
                        game.roundEndConfirmations = {};
                        game.lastWhiteGroupInfo = null;
                        game.diceGoOvershotTicker = undefined;
                        game.moveHistory = [];
                        game.koInfo = null;
                        game.dicePlacingSettleUntil = undefined;
                        return;
                    } else {
                        const winnerId = p1Score > p2Score ? p1Id : p2Id;
                        const winnerEnum = winnerId === game.blackPlayerId ? types.Player.Black : (winnerId === game.whitePlayerId ? types.Player.White : types.Player.None);
                        endGame(game, winnerEnum, 'dice_win');
                        return;
                    }
                } else {
                    game.round++;
                }

                // Start next round
                game.boardState = Array(game.settings.boardSize).fill(0).map(() => Array(game.settings.boardSize).fill(types.Player.None));
                const initialStoneCount = DICE_GO_INITIAL_WHITE_STONES_BY_ROUND[game.round - 1];
                placeDiceGoInitialWhiteStones(game.boardState, game.settings.boardSize, initialStoneCount);
                game.gameStatus = 'dice_rolling';
                game.currentPlayer = types.Player.Black; // Black (first player) always starts the round
                if (shouldEnforceTimeControl(game)) {
                    game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                    game.turnStartTime = now;
                }
                game.diceRoundSummary = undefined;
                game.roundEndConfirmations = {};
                game.lastWhiteGroupInfo = null; // Clear info for the new round
                game.diceGoOvershotTicker = undefined;
                game.moveHistory = [];
                game.koInfo = null;
                game.dicePlacingSettleUntil = undefined;
            }
            break;
    }
};

export const handleDiceGoAction = async (volatileState: types.VolatileState, game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): Promise<types.HandleActionResult | undefined> => {
    const { type, payload } = action;
    const now = Date.now();
    
    const myPlayerEnum = user.id === game.blackPlayerId ? types.Player.Black : (user.id === game.whitePlayerId ? types.Player.White : types.Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;
    const p1Id = game.player1.id;
    
    // Delegate shared actions first
    const sharedResult = await handleSharedAction(volatileState, game, action, user);
    if (sharedResult) {
        await db.saveGame(game);
        return sharedResult;
    }

    switch(type) {
        case 'DICE_READY_FOR_TURN_ROLL': {
            if (game.gameStatus !== 'dice_turn_rolling') return { error: 'Not in turn rolling phase.' };
            if (!game.turnOrderRollReady) game.turnOrderRollReady = {};
            game.turnOrderRollReady[user.id] = true;
            await db.saveGame(game);
            return {};
        }
        case 'DICE_CHOOSE_TURN': {
            if (game.gameStatus !== 'dice_turn_choice' || user.id !== game.turnChooserId) return { error: 'Not your turn to choose.' };
            const { choice } = payload as { choice: 'first' | 'second' };
            const chooserId = game.turnChooserId;
            if (!chooserId) return { error: 'Chooser not set.' };
            const otherId = chooserId === p1Id ? game.player2.id : p1Id;

            if (choice === 'first') {
                game.blackPlayerId = chooserId;
                game.whitePlayerId = otherId;
            } else {
                game.whitePlayerId = chooserId;
                game.blackPlayerId = otherId;
            }
            game.gameStatus = 'dice_start_confirmation';
            game.revealEndTime = now + 10000;
            return {};
        }
        case 'DICE_CONFIRM_START': {
             if (game.gameStatus !== 'dice_start_confirmation') return { error: "Not in confirmation phase." };
             if (!game.preGameConfirmations) game.preGameConfirmations = {};
             game.preGameConfirmations[user.id] = true;
             await db.saveGame(game);
             return {};
        }
        case 'DICE_ROLL': {
            console.log(`[handleDiceGoAction] DICE_ROLL received: gameStatus=${game.gameStatus}, isMyTurn=${isMyTurn}, currentPlayer=${game.currentPlayer}, myPlayerEnum=${myPlayerEnum}, userId=${user.id}`);
            if (game.gameStatus !== 'dice_rolling') {
                console.error(`[handleDiceGoAction] DICE_ROLL failed: gameStatus is ${game.gameStatus}, expected dice_rolling`);
                return { error: `Not in dice rolling phase. Current status: ${game.gameStatus}` };
            }
            if (!isMyTurn) {
                console.error(`[handleDiceGoAction] DICE_ROLL failed: not my turn. currentPlayer=${game.currentPlayer}, myPlayerEnum=${myPlayerEnum}, userId=${user.id}`);
                return { error: 'Not your turn to roll.' };
            }
            const { itemType } = payload as { itemType?: 'odd' | 'even' | 'low' | 'high' };
            let dice1: number;

            if (itemType) {
                const validItem = itemType === 'odd' || itemType === 'even' || itemType === 'low' || itemType === 'high';
                if (!validItem) {
                    return { error: '알 수 없는 아이템입니다.' };
                }
                patchDiceGoItemUsesRow(game, user.id);
                const uses = game.diceGoItemUses?.[user.id];
                if (!uses || uses[itemType] <= 0) {
                    return { error: '아이템이 없습니다.' };
                }
                uses[itemType]--;
                const pools: Record<'odd' | 'even' | 'low' | 'high', number[]> = {
                    odd: [1, 3, 5],
                    even: [2, 4, 6],
                    low: [1, 2, 3],
                    high: [4, 5, 6],
                };
                const pool = pools[itemType];
                dice1 = pool[Math.floor(Math.random() * pool.length)];
            } else {
                dice1 = Math.floor(Math.random() * 6) + 1;
            }

            const logic = getGoLogic(game);
            const liberties = logic.getAllLibertiesOfPlayer(types.Player.White, game.boardState);
            // 유효 자리 0개(마지막 돌 잡은 직후)이거나, 나온 수가 유효 자리보다 크면 오버샷 → 턴 넘김
            const isOvershot = liberties.length === 0 || dice1 > liberties.length;
            
            game.animation = { type: 'dice_roll_main', dice: { dice1, dice2: 0, dice3: 0 }, startTime: now, duration: 1500 };
            game.gameStatus = 'dice_rolling_animating';
            game.turnDeadline = undefined;
            game.turnStartTime = undefined;
            game.dice = undefined;

            game.stonesToPlace = isOvershot ? -1 : dice1;
            syncDiceGoOvershotTicker(game, liberties.length, isOvershot);
            // 오버샷으로 턴이 넘어가고 다음 턴이 AI인 경우, 애니 종료 직후 AI가 즉시 동작하도록 선제 스케줄링
            if (isOvershot && game.isAiGame) {
                const nextPlayer = game.currentPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
                const nextPlayerId = nextPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                if (nextPlayerId === aiUserId) {
                    game.aiTurnStartTime = now + game.animation.duration + 30;
                } else {
                    game.aiTurnStartTime = undefined;
                }
            }
            if (!game.diceRollHistory) game.diceRollHistory = {};
            if (!game.diceRollHistory[user.id]) game.diceRollHistory[user.id] = [];
            game.diceRollHistory[user.id].push(dice1);
            await db.saveGame(game);
            return { clientResponse: { game: { ...game, boardState: game.boardState.map((row: number[]) => [...row]) } } };
        }
        case 'DICE_PLACE_STONE': {
            if (game.gameStatus !== 'dice_placing' || !isMyTurn) return { error: '상대방의 차례입니다.' };
            if ((game.stonesToPlace ?? 0) <= 0) return { error: 'No stones left to place.' };

            game.justCaptured = [];

            const { x, y } = payload;
            
            // 치명적 버그 방지: 상대방 돌 위에 착점하는 것을 명시적으로 차단
            const stoneAtTarget = game.boardState[y][x];
            const opponentPlayerEnum = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
            
            if (stoneAtTarget === opponentPlayerEnum) {
                console.error(`[handleDiceGoAction] CRITICAL BUG PREVENTION: Attempted to place stone on opponent stone at (${x}, ${y}), gameId=${game.id}, stoneAtTarget=${stoneAtTarget}, opponentPlayerEnum=${opponentPlayerEnum}`);
                return { error: '상대방이 둔 자리에는 돌을 놓을 수 없습니다.' };
            }
            
            if (stoneAtTarget === myPlayerEnum) {
                console.error(`[handleDiceGoAction] CRITICAL BUG PREVENTION: Attempted to place stone on own stone at (${x}, ${y}), gameId=${game.id}, stoneAtTarget=${stoneAtTarget}, myPlayerEnum=${myPlayerEnum}`);
                return { error: '이미 돌이 놓인 자리입니다.' };
            }
            
            const logic = getGoLogic(game);
            const liberties = logic.getAllLibertiesOfPlayer(types.Player.White, game.boardState);
            
            const anyWhiteStones = game.boardState.flat().some(s => s === types.Player.White);

            if (anyWhiteStones && liberties.length > 0 && !liberties.some(p => p.x === x && p.y === y)) {
                return { error: '백돌의 활로에만 착수할 수 있습니다.' };
            }

            const move = { x, y, player: types.Player.Black };
            const result = processMove(game.boardState, move, game.koInfo, game.moveHistory.length, { ignoreSuicide: true });

            if (!result.isValid) {
                console.error(`[handleDiceGoAction] CRITICAL BUG PREVENTION: processMove returned invalid at (${x}, ${y}), gameId=${game.id}, reason=${result.reason}`);
                return { error: `Invalid move: ${result.reason}` };
            }

            if (!game.stonesPlacedThisTurn) {
                game.stonesPlacedThisTurn = [];
            }
            game.stonesPlacedThisTurn.push({ x, y });

            game.diceCapturesThisTurn = (game.diceCapturesThisTurn || 0) + result.capturedStones.length;
            if (result.capturedStones.length > 0) {
                game.diceLastCaptureStones = result.capturedStones;
                const cap = result.capturedStones.length;
                const pt = result.capturedStones[cap - 1];
                game.justCaptured.push({
                    point: pt,
                    player: types.Player.White,
                    wasHidden: false,
                    capturePoints: cap,
                });
            }

            game.boardState = result.newBoardState;
            game.koInfo = result.newKoInfo;
            game.lastMove = { x, y };
            if (!game.moveHistory) game.moveHistory = [];
            game.moveHistory.push({ player: types.Player.Black, x, y });

            game.stonesToPlace = (game.stonesToPlace ?? 1) - 1;
            const whiteStonesLeft = game.boardState.flat().filter(s => s === types.Player.White).length;

            if (game.isDeathmatch && whiteStonesLeft === 0) {
                endGame(game, myPlayerEnum, 'dice_win');
                return {};
            }

            if (whiteStonesLeft === 0 || game.stonesToPlace <= 0) {
                finishPlacingTurn(game, user.id);
            }
            await db.saveGame(game);
            return { clientResponse: { game: { ...game, boardState: game.boardState.map((row: number[]) => [...row]) } } };
        }
        case 'DICE_PLACE_STONES_BATCH': {
            if (!game.isAiGame) return { error: '배치 착수는 AI 대국에서만 지원됩니다.' };
            if (game.gameStatus !== 'dice_placing' || !isMyTurn) return { error: '상대방의 차례입니다.' };
            const { placements } = payload as { placements?: Array<{ x: number; y: number }> };
            if (!Array.isArray(placements) || placements.length === 0) {
                return { error: '착수 내역이 없습니다.' };
            }

            game.justCaptured = [];
            for (const p of placements) {
                if ((game.stonesToPlace ?? 0) <= 0) break;
                const { x, y } = p;
                const stoneAtTarget = game.boardState[y]?.[x];
                if (stoneAtTarget == null) return { error: '보드 범위를 벗어났습니다.' };
                if (stoneAtTarget !== types.Player.None) return { error: '이미 돌이 놓인 자리입니다.' };

                const logic = getGoLogic(game);
                const liberties = logic.getAllLibertiesOfPlayer(types.Player.White, game.boardState);
                const anyWhiteStones = game.boardState.flat().some(s => s === types.Player.White);
                if (anyWhiteStones && liberties.length > 0 && !liberties.some(lp => lp.x === x && lp.y === y)) {
                    return { error: '백돌의 활로에만 착수할 수 있습니다.' };
                }

                const move = { x, y, player: types.Player.Black };
                const result = processMove(game.boardState, move, game.koInfo, game.moveHistory.length, { ignoreSuicide: true });
                if (!result.isValid) return { error: `Invalid move: ${result.reason}` };

                if (!game.stonesPlacedThisTurn) game.stonesPlacedThisTurn = [];
                game.stonesPlacedThisTurn.push({ x, y });
                game.diceCapturesThisTurn = (game.diceCapturesThisTurn || 0) + result.capturedStones.length;
                if (result.capturedStones.length > 0) {
                    game.diceLastCaptureStones = result.capturedStones;
                    const cap = result.capturedStones.length;
                    const pt = result.capturedStones[cap - 1];
                    game.justCaptured.push({
                        point: pt,
                        player: types.Player.White,
                        wasHidden: false,
                        capturePoints: cap,
                    });
                }

                game.boardState = result.newBoardState;
                game.koInfo = result.newKoInfo;
                game.lastMove = { x, y };
                if (!game.moveHistory) game.moveHistory = [];
                game.moveHistory.push({ player: types.Player.Black, x, y });
                game.stonesToPlace = (game.stonesToPlace ?? 1) - 1;

                const whiteStonesLeft = game.boardState.flat().filter(s => s === types.Player.White).length;
                if (game.isDeathmatch && whiteStonesLeft === 0) {
                    endGame(game, myPlayerEnum, 'dice_win');
                    await db.saveGame(game);
                    return { clientResponse: { game: { ...game, boardState: game.boardState.map((row: number[]) => [...row]) } } };
                }
                if (whiteStonesLeft === 0) break;
            }

            const whiteStonesLeft = game.boardState.flat().filter(s => s === types.Player.White).length;
            if (whiteStonesLeft === 0 || (game.stonesToPlace ?? 0) <= 0) {
                finishPlacingTurn(game, user.id);
            }
            await db.saveGame(game);
            return { clientResponse: { game: { ...game, boardState: game.boardState.map((row: number[]) => [...row]) } } };
        }
        case 'CONFIRM_ROUND_END': {
            if (game.gameStatus !== 'dice_round_end') return { error: "Not in round end confirmation phase." };
            if (!game.roundEndConfirmations) game.roundEndConfirmations = {};
            game.roundEndConfirmations[user.id] = now;
            // 양쪽 확인(또는 revealEndTime 경과) 시 즉시 다음 라운드로 전환 — 메인 루프 틱만 기다리면 클라가 오래 멈춘 것처럼 보임
            updateDiceGoState(game, now);
            await db.saveGame(game);
            return { clientResponse: { game: { ...game, boardState: game.boardState.map((row: number[]) => [...row]) } } };
        }
    }
};