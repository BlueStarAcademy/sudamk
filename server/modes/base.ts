

import * as types from '../../types/index.js';
import { getGoLogic } from '../goLogic.js';
// FIX: Changed import path to avoid circular dependency
import { transitionToPlaying } from './shared.js';
import { aiUserId } from '../aiPlayer.js';
import { processMove } from '../goLogic.js';

/** 2차 덤 동점 → 무작위 흑백 시 룰렛 연출 후 시작 확인으로 넘기는 시간(ms) */
const BASE_COLOR_ROULETTE_PHASE_MS = 5200;

/** 모험 베이스: 몬스터 대전은 카운트다운·자동 타임아웃 없이 유저 조작만으로 진행 */
const isAdventureBaseGame = (game: types.LiveGameSession) => game.gameCategory === 'adventure';

const enterBaseGameStartConfirmation = (game: types.LiveGameSession, now: number) => {
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    game.gameStatus = 'base_game_start_confirmation';
    game.revealEndTime = isAdventureBaseGame(game) ? undefined : now + 30000;
    game.preGameConfirmations = { [p1Id]: false, [p2Id]: false };
    if (game.isAiGame) {
        const aiId = p1Id === aiUserId ? p1Id : p2Id;
        game.preGameConfirmations[aiId] = true;
    }
    game.preGameKomiSummaryAck = undefined;
    game.turnDeadline = undefined;
    game.turnStartTime = undefined;
    game.pausedTurnTimeLeft = undefined;
};

export const initializeBase = (game: types.LiveGameSession, now: number) => {
    game.gameStatus = 'base_placement';
    game.basePlacementDeadline = isAdventureBaseGame(game) ? undefined : now + 30000;
    game.baseStones_p1 = [];
    game.baseStones_p2 = [];
    game.settings.komi = 0.5; // Base komi for bidding
    // Base 모드의 실제 시계는 시작 확인 이후(playing)부터 흐르게 유지
    game.turnDeadline = undefined;
    game.turnStartTime = undefined;
    game.pausedTurnTimeLeft = undefined;
    game.preGameConfirmations = {};
    game.preGameKomiSummaryAck = undefined;

    // AI 대국: 봇의 베이스돌은 시작 즉시 랜덤으로 모두 배치해 둔다.
    if (game.isAiGame) {
        const aiBaseKey: 'baseStones_p1' | 'baseStones_p2' = game.player1.id === aiUserId ? 'baseStones_p1' : 'baseStones_p2';
        placeRemainingStonesRandomly(game, aiBaseKey);
    }
};

// Helper function to check if a stone placement would result in immediate capture
const wouldBeImmediatelyCaptured = (board: types.BoardState, x: number, y: number, player: types.Player): boolean => {
    // Try placing the stone
    const result = processMove(
        board,
        { x, y, player },
        null, // no ko info for initial placement
        0, // move history length
        { ignoreSuicide: true } // allow suicide for initial check
    );

    if (!result.isValid) {
        return true; // Invalid move, skip this position
    }

    // Check if the placed stone's group has only one liberty
    // If so, check if opponent can capture it by playing at that liberty
    const opponent = player === types.Player.Black ? types.Player.White : types.Player.Black;
    const boardSize = board.length;
    
    // Get neighbors of the placed stone
    const getNeighbors = (px: number, py: number) => {
        const neighbors = [];
        if (px > 0) neighbors.push({ x: px - 1, y: py });
        if (px < boardSize - 1) neighbors.push({ x: px + 1, y: py });
        if (py > 0) neighbors.push({ x: px, y: py - 1 });
        if (py < boardSize - 1) neighbors.push({ x: px, y: py + 1 });
        return neighbors;
    };

    // Find the group containing the placed stone
    const findGroup = (startX: number, startY: number, playerColor: types.Player, currentBoard: types.BoardState) => {
        if (currentBoard[startY]?.[startX] !== playerColor) return null;
        const q: types.Point[] = [{ x: startX, y: startY }];
        const visitedStones = new Set([`${startX},${startY}`]);
        const libertyPoints = new Set<string>();
        const stones: types.Point[] = [{ x: startX, y: startY }];

        while (q.length > 0) {
            const { x: cx, y: cy } = q.shift()!;
            for (const n of getNeighbors(cx, cy)) {
                const key = `${n.x},${n.y}`;
                const neighborContent = currentBoard[n.y][n.x];

                if (neighborContent === types.Player.None) {
                    libertyPoints.add(key);
                } else if (neighborContent === playerColor) {
                    if (!visitedStones.has(key)) {
                        visitedStones.add(key);
                        q.push(n);
                        stones.push(n);
                    }
                }
            }
        }
        return { stones, liberties: Array.from(libertyPoints).map(k => {
            const [nx, ny] = k.split(',').map(Number);
            return { x: nx, y: ny };
        }) };
    };

    const myGroup = findGroup(x, y, player, result.newBoardState);
    if (!myGroup) {
        return true; // Couldn't find group, skip
    }

    // If the group has only one liberty, check if opponent can capture by playing there
    if (myGroup.liberties.length === 1) {
        const liberty = myGroup.liberties[0];
        const opponentResult = processMove(
            result.newBoardState,
            { x: liberty.x, y: liberty.y, player: opponent },
            null,
            1,
            { ignoreSuicide: false }
        );

        // If opponent can capture our stone by playing at the liberty, it's a bad placement
        if (opponentResult.isValid && opponentResult.capturedStones.some(s => s.x === x && s.y === y)) {
            return true;
        }
    }

    return false;
};

const placeRemainingStonesRandomly = (game: types.LiveGameSession, playerKey: 'baseStones_p1' | 'baseStones_p2') => {
    const target = game.settings.baseStones ?? 4;
    
    if (!game[playerKey]) {
        game[playerKey] = [];
    }
    const stonesToPlace = target - game[playerKey]!.length;

    if (stonesToPlace <= 0) {
        return;
    }

    const occupied = new Set<string>();
    (game.baseStones_p1 ?? []).forEach(p => occupied.add(`${p.x},${p.y}`));
    (game.baseStones_p2 ?? []).forEach(p => occupied.add(`${p.x},${p.y}`));
    
    const { boardSize } = game.settings;
    
    // Determine player color based on playerKey
    const playerColor = playerKey === 'baseStones_p1' ? types.Player.Black : types.Player.White;
    const opponentColor = playerColor === types.Player.Black ? types.Player.White : types.Player.Black;
    
    // Create a temporary board state with currently placed stones
    const tempBoard: types.BoardState = Array(boardSize).fill(0).map(() => Array(boardSize).fill(types.Player.None));
    (game.baseStones_p1 ?? []).forEach(p => tempBoard[p.y][p.x] = types.Player.Black);
    (game.baseStones_p2 ?? []).forEach(p => tempBoard[p.y][p.x] = types.Player.White);

    for (let i = 0; i < stonesToPlace; i++) {
        let x: number, y: number, key: string;
        let attempts = 0;
        const maxAttempts = boardSize * boardSize * 10; // Increased attempts to account for capture checks
        
        do {
            x = Math.floor(Math.random() * boardSize);
            y = Math.floor(Math.random() * boardSize);
            key = `${x},${y}`;
            attempts++;
            if (attempts > maxAttempts) {
                console.warn(`[BaseGo] Could not find a valid random spot after ${maxAttempts} attempts. Stopping placement.`);
                return;
            }
        } while (
            occupied.has(key) || 
            // Check if this placement would result in immediate capture
            wouldBeImmediatelyCaptured(tempBoard, x, y, playerColor)
        );
        
        // Place the stone on temp board for next iteration
        tempBoard[y][x] = playerColor;
        game[playerKey]!.push({ x, y });
        occupied.add(key);
    }
};

const resolveBasePlacementAndTransition = (game: types.LiveGameSession, now: number) => {
    const target = game.settings.baseStones ?? 4;

    // Place remaining stones for any player who hasn't finished
    if ((game.baseStones_p1?.length ?? 0) < target) {
        placeRemainingStonesRandomly(game, 'baseStones_p1');
    }
    if ((game.baseStones_p2?.length ?? 0) < target) {
        placeRemainingStonesRandomly(game, 'baseStones_p2');
    }

    const { boardSize } = game.settings;
    const p1Stones = [...(game.baseStones_p1 || [])];
    const p2Stones = [...(game.baseStones_p2 || [])];
    const coordMap = new Map<string, { player: 'p1' | 'p2', point: types.Point }[]>();
    p1Stones.forEach(p => {
        const key = `${p.x},${p.y}`;
        if (!coordMap.has(key)) coordMap.set(key, []);
        coordMap.get(key)!.push({ player: 'p1', point: p });
    });
    p2Stones.forEach(p => {
        const key = `${p.x},${p.y}`;
        if (!coordMap.has(key)) coordMap.set(key, []);
        coordMap.get(key)!.push({ player: 'p2', point: p });
    });
    const overlappingCoords = new Set<string>();
    for (const [key, stones] of coordMap.entries()) {
        if (stones.length > 1) {
            overlappingCoords.add(key);
        }
    }
    let validP1Stones = p1Stones.filter(p => !overlappingCoords.has(`${p.x},${p.y}`));
    let validP2Stones = p2Stones.filter(p => !overlappingCoords.has(`${p.x},${p.y}`));
    if (validP1Stones.length > 0 || validP2Stones.length > 0) {
        const tempBoard: types.BoardState = Array(boardSize).fill(0).map(() => Array(boardSize).fill(types.Player.None));
        validP1Stones.forEach(p => tempBoard[p.y][p.x] = types.Player.Black);
        validP2Stones.forEach(p => tempBoard[p.y][p.x] = types.Player.White);
        const tempGame = { boardState: tempBoard, settings: { boardSize } } as types.LiveGameSession;
        const logic = getGoLogic(tempGame);
        const stonesToRemove = new Set<string>();
        const allStones = [
            ...validP1Stones.map(p => ({ ...p, player: types.Player.Black })),
            ...validP2Stones.map(p => ({ ...p, player: types.Player.White }))
        ];
        for (const stone of allStones) {
            const group = logic.findGroup(stone.x, stone.y, stone.player, tempBoard);
            if (group && group.liberties === 0) {
                group.stones.forEach(s => stonesToRemove.add(`${s.x},${s.y}`));
            }
        }
        if (stonesToRemove.size > 0) {
            validP1Stones = validP1Stones.filter(p => !stonesToRemove.has(`${p.x},${p.y}`));
            validP2Stones = validP2Stones.filter(p => !stonesToRemove.has(`${p.x},${p.y}`));
        }
    }
    
    game.baseStones_p1 = validP1Stones;
    game.baseStones_p2 = validP2Stones;
    game.basePlacementDeadline = undefined;

    game.gameStatus = 'komi_bidding';
    game.komiBiddingDeadline = isAdventureBaseGame(game) ? undefined : now + 30000;
    game.komiBids = { [game.player1.id]: null, [game.player2.id]: null };
    game.komiBiddingRound = 1;
    // 입찰 중에는 시간 비활성 유지
    game.turnDeadline = undefined;
    game.turnStartTime = undefined;
    game.pausedTurnTimeLeft = undefined;
};


export const updateBaseState = (game: types.LiveGameSession, now: number) => {
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    
    switch (game.gameStatus) {
        case 'base_placement': {
            const p1StonesCount = game.baseStones_p1?.length ?? 0;
            const p2StonesCount = game.baseStones_p2?.length ?? 0;
            const target = game.settings.baseStones ?? 4;
            const bothDonePlacing = p1StonesCount >= target && p2StonesCount >= target;
            const deadlinePassed =
                !isAdventureBaseGame(game) && !!game.basePlacementDeadline && now > game.basePlacementDeadline;

            if (bothDonePlacing || deadlinePassed) {
                resolveBasePlacementAndTransition(game, now);
            }
            break;
        }
        case 'komi_bidding': {
            const p1Id = game.player1.id;
            const p2Id = game.player2.id;
            // AI 대국: 유저 입찰이 들어오면 봇 입찰을 자동으로 채워 즉시 공개 단계로 진행
            if (game.isAiGame && game.komiBids) {
                const aiId = game.player1.id === aiUserId ? game.player1.id : game.player2.id;
                const humanId = aiId === p1Id ? p2Id : p1Id;
                if (game.komiBids[humanId] != null && game.komiBids[aiId] == null) {
                    // AI는 유저 반대편 고정이 아닌, 흑/백을 50:50으로 랜덤 선택한다.
                    const randomColor = Math.random() < 0.5 ? types.Player.Black : types.Player.White;
                    // 덤 입찰값도 1~10 집 랜덤으로 선택한다.
                    const randomKomi = Math.floor(Math.random() * 10) + 1;
                    game.komiBids[aiId] = { color: randomColor, komi: randomKomi };
                }
            }
            const bothHaveBid = game.komiBids?.[p1Id] != null && game.komiBids?.[p2Id] != null;
            const deadlinePassed =
                !isAdventureBaseGame(game) && !!game.komiBiddingDeadline && now > game.komiBiddingDeadline;

            if (bothHaveBid || deadlinePassed) {
                if (deadlinePassed) {
                    // A non-competitive bid as a penalty for timeout.
                    // This bid will lose to any player who also wants Black (by bidding a higher komi),
                    // and will give White to any player who wants it. This is a safe "pass".
                    const timeoutBid = { color: types.Player.Black, komi: 0 };
                    if (!game.komiBids![p1Id]) game.komiBids![p1Id] = timeoutBid;
                    if (!game.komiBids![p2Id]) game.komiBids![p2Id] = timeoutBid;
                }
                game.gameStatus = 'komi_bid_reveal';
                // 모험: 결과 연출 대기 없이 다음 틱에서 바로 흑백·판 반영
                game.revealEndTime = isAdventureBaseGame(game) ? now - 1 : now + 4000;
            }
            break;
        }
        case 'komi_bid_reveal':
             if (game.revealEndTime && now > game.revealEndTime && !game.komiBidRevealProcessed) {
                game.komiBidRevealProcessed = true;
                const p1 = game.player1;
                const p2 = game.player2;
                const p1Bid = game.komiBids![p1.id]!;
                const p2Bid = game.komiBids![p2.id]!;
                const baseKomi = game.settings.komi;
                let blackPlayerId: string | undefined, whitePlayerId: string | undefined, finalKomi: number | undefined;
                let useBaseColorRoulettePhase = false;

                if (p1Bid.color !== p2Bid.color) {
                    blackPlayerId = p1Bid.color === types.Player.Black ? p1.id : p2.id;
                    whitePlayerId = blackPlayerId === p1.id ? p2.id : p1.id;
                    finalKomi = baseKomi;
                } else {
                     if (p1Bid.komi !== p2Bid.komi) {
                        const winnerId = p1Bid.komi > p2Bid.komi ? p1.id : p2.id;
                        const loserId = winnerId === p1.id ? p2.id : p1.id;
                        const winningBidKomi = Math.max(p1Bid.komi, p2Bid.komi);

                        if (p1Bid.color === types.Player.Black) {
                            blackPlayerId = winnerId;
                            whitePlayerId = loserId;
                            finalKomi = winningBidKomi + baseKomi;
                        } else {
                            whitePlayerId = winnerId;
                            blackPlayerId = loserId;
                            finalKomi = baseKomi - winningBidKomi;
                        }
                    } else {
                        if ((game.komiBiddingRound || 1) === 1) {
                            game.gameStatus = 'komi_bidding';
                            game.komiBiddingDeadline = isAdventureBaseGame(game) ? undefined : now + 30000;
                            game.komiBids = { [p1.id]: null, [p2.id]: null };
                            game.komiBiddingRound = 2;
                            game.komiBidRevealProcessed = false;
                            game.revealEndTime = undefined;
                            return;
                        } else {
                            const winnerId = Math.random() < 0.5 ? p1.id : p2.id;
                            const loserId = winnerId === p1.id ? p2.id : p1.id;
                            useBaseColorRoulettePhase = true;

                            if (p1Bid.color === types.Player.Black) {
                                blackPlayerId = winnerId;
                                whitePlayerId = loserId;
                                finalKomi = p1Bid.komi + baseKomi;
                            } else {
                                whitePlayerId = winnerId;
                                blackPlayerId = loserId;
                                finalKomi = baseKomi - p1Bid.komi;
                            }
                        }
                    }
                }
                
                if (blackPlayerId && whitePlayerId && typeof finalKomi === 'number') {
                    game.blackPlayerId = blackPlayerId;
                    game.whitePlayerId = whitePlayerId;
                    game.finalKomi = finalKomi;
                    game.baseStones = [];
                    const newBoardState = Array(game.settings.boardSize).fill(0).map(() => Array(game.settings.boardSize).fill(types.Player.None));
                    const p1Color = p1.id === blackPlayerId ? types.Player.Black : types.Player.White;
                    const p2Color = p2.id === whitePlayerId ? types.Player.White : types.Player.Black;
                    // 모험 베이스는 덤 결과로 유저 색이 바뀌어도, 배치한 베이스 돌의 흑/백 표시를 고정한다.
                    // (덤 확정 시 재매핑되며 돌 색이 바뀌는 현상 방지)
                    const p1BaseStoneColor = isAdventureBaseGame(game) ? types.Player.Black : p1Color;
                    const p2BaseStoneColor = isAdventureBaseGame(game) ? types.Player.White : p2Color;
                    (game.baseStones_p1 || []).forEach(p => {
                        newBoardState[p.y][p.x] = p1BaseStoneColor;
                        game.baseStones!.push({ ...p, player: p1BaseStoneColor });
                    });
                    (game.baseStones_p2 || []).forEach(p => {
                        newBoardState[p.y][p.x] = p2BaseStoneColor;
                        game.baseStones!.push({ ...p, player: p2BaseStoneColor });
                    });
                    game.boardState = newBoardState;
                    if (useBaseColorRoulettePhase) {
                        game.gameStatus = 'base_color_roulette';
                        game.revealEndTime = isAdventureBaseGame(game) ? now - 1 : now + BASE_COLOR_ROULETTE_PHASE_MS;
                        game.preGameConfirmations = {};
                    } else {
                        enterBaseGameStartConfirmation(game, now);
                    }
                    // Clean up bidding state
                    game.komiBids = undefined;
                    game.komiBiddingRound = undefined;
                    game.basePlacementDeadline = undefined;
                    game.komiBidRevealProcessed = undefined;
                    // 시작 확인 전까지는 시계 비활성 유지
                    game.turnDeadline = undefined;
                    game.turnStartTime = undefined;
                    game.pausedTurnTimeLeft = undefined;
                }
            }
            break;
        case 'base_color_roulette': {
            if (game.revealEndTime && now > game.revealEndTime) {
                enterBaseGameStartConfirmation(game, now);
            }
            break;
        }
        case 'base_komi_result':
            break;
        case 'base_game_start_confirmation': {
            const bothConfirmed = game.preGameConfirmations?.[p1Id] && game.preGameConfirmations?.[p2Id];
            const deadlinePassed =
                !isAdventureBaseGame(game) && !!game.revealEndTime && now > game.revealEndTime;
            if (bothConfirmed || deadlinePassed) {
                transitionToPlaying(game, now);
            }
            break;
        }
    }
};

export const handleBaseAction = (game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): types.HandleActionResult | null => {
    const { type, payload } = action;
    const now = Date.now();

    switch (type) {
        case 'PLACE_BASE_STONE':
            if (game.gameStatus !== 'base_placement') return { error: "Not in base placement phase." };
            const myStonesKey = user.id === game.player1.id ? 'baseStones_p1' : 'baseStones_p2';
            if (!game[myStonesKey]) game[myStonesKey] = [];
            if ((game[myStonesKey]?.length ?? 0) >= game.settings.baseStones!) return { error: "Already placed all stones." };
            if (game[myStonesKey]!.some(p => p.x === payload.x && p.y === payload.y)) return { error: "Already placed a stone there." };
            game[myStonesKey]!.push({ x: payload.x, y: payload.y });
            return {};
        case 'PLACE_REMAINING_BASE_STONES_RANDOMLY':
            if (game.gameStatus !== 'base_placement') return { error: "Not in base placement phase." };
            const playerStonesKey = user.id === game.player1.id ? 'baseStones_p1' : 'baseStones_p2';
            placeRemainingStonesRandomly(game, playerStonesKey);
            return {};
        case 'RESET_MY_BASE_STONE_PLACEMENTS':
            if (game.gameStatus !== 'base_placement') return { error: "Not in base placement phase." };
            const resetKey = user.id === game.player1.id ? 'baseStones_p1' : 'baseStones_p2';
            game[resetKey] = [];
            return {};
        case 'UNDO_LAST_BASE_STONE_PLACEMENT':
            if (game.gameStatus !== 'base_placement') return { error: "Not in base placement phase." };
            const undoKey = user.id === game.player1.id ? 'baseStones_p1' : 'baseStones_p2';
            const undoArr = game[undoKey];
            if (!undoArr || undoArr.length === 0) return { error: "취소할 배치가 없습니다." };
            undoArr.pop();
            return {};
        case 'UPDATE_KOMI_BID':
            if (game.gameStatus !== 'komi_bidding' || game.komiBids?.[user.id]) return { error: "Cannot bid now." };
            if (!game.komiBids) game.komiBids = {};
            game.komiBids[user.id] = payload.bid;
            return {};
        case 'CONFIRM_BASE_KOMI_SUMMARY': {
            if (game.gameStatus !== 'base_komi_result') return { error: '덤 결과 확인 단계가 아닙니다.' };
            if (!game.preGameKomiSummaryAck) game.preGameKomiSummaryAck = {};
            game.preGameKomiSummaryAck[user.id] = true;
            if (game.isAiGame) {
                const opponentId = game.player1.id === user.id ? game.player2.id : game.player1.id;
                game.preGameKomiSummaryAck[opponentId] = true;
            }
            const p1Ack = game.player1.id;
            const p2Ack = game.player2.id;
            if (game.preGameKomiSummaryAck[p1Ack] && game.preGameKomiSummaryAck[p2Ack]) {
                enterBaseGameStartConfirmation(game, now);
            }
            return {};
        }
        case 'CONFIRM_BASE_REVEAL':
             if (game.gameStatus !== 'base_game_start_confirmation') return { error: "Not in confirmation phase." };
             if (!game.preGameConfirmations) game.preGameConfirmations = {};
             game.preGameConfirmations[user.id] = true;
             // AI 대국 안전장치:
             // 일부 케이스에서 AI 확인 플래그가 참가자 키와 어긋나 "상대방 확인 대기 중"에 머무를 수 있으므로
             // 유저가 확인을 누른 시점에 상대(AI) 확인을 보정하고 즉시 시작 전환한다.
             if (game.isAiGame) {
                const opponentId = game.player1.id === user.id ? game.player2.id : game.player1.id;
                game.preGameConfirmations[opponentId] = true;
                transitionToPlaying(game, now);
             }
             return {};
    }
    return null;
};