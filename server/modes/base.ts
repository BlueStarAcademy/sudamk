

import * as types from '../../types/index.js';
import { getGoLogic } from '../goLogic.js';
// FIX: Changed import path to avoid circular dependency
import { transitionToPlaying } from './shared.js';
import { aiUserId } from '../aiPlayer.js';
import { processMove } from '../goLogic.js';
import { resolveRuntimeAiBaseKomiBid } from '../../shared/utils/singlePlayerAiBaseKomiBid.js';

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
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    game.basePlacementReady = { [p1Id]: false, [p2Id]: false };
    game.settings.komi = 0.5; // Base komi for bidding
    // Base 모드의 실제 시계는 시작 확인 이후(playing)부터 흐르게 유지
    game.turnDeadline = undefined;
    game.turnStartTime = undefined;
    game.pausedTurnTimeLeft = undefined;
    game.preGameConfirmations = {};
    game.preGameKomiSummaryAck = undefined;
    game.baseKomiBidsSnapshot = undefined;

    // AI 대국: 봇의 베이스돌은 시작 즉시 랜덤으로 모두 배치해 둔다.
    if (game.isAiGame) {
        const aiBaseKey: 'baseStones_p1' | 'baseStones_p2' = game.player1.id === aiUserId ? 'baseStones_p1' : 'baseStones_p2';
        placeRemainingStonesRandomly(game, aiBaseKey);
        const aiId = p1Id === aiUserId ? p1Id : p2Id;
        game.basePlacementReady![aiId] = true;
    }
};

const clearBasePlacementReadyForUser = (game: types.LiveGameSession, userId: string) => {
    if (!game.basePlacementReady) return;
    game.basePlacementReady[userId] = false;
};

const getPairLobbyOwnerId = (game: types.LiveGameSession): string | undefined => {
    const id = (game.settings as types.GameSettings | undefined)?.pairGame?.pairLobbyOwnerId;
    if (typeof id !== 'string' || id.length === 0) return undefined;
    if (id !== game.player1.id && id !== game.player2.id) return undefined;
    return id;
};

const clearBothPlayersBasePlacementReady = (game: types.LiveGameSession) => {
    if (!game.basePlacementReady) {
        game.basePlacementReady = { [game.player1.id]: false, [game.player2.id]: false };
    }
    game.basePlacementReady[game.player1.id] = false;
    game.basePlacementReady[game.player2.id] = false;
};

/** 페어 방장 배치: 먼저 p1석 N개 → 이어서 p2석 N개 */
const resolvePairHostActiveBaseStoneKey = (game: types.LiveGameSession): 'baseStones_p1' | 'baseStones_p2' | null => {
    const target = game.settings.baseStones ?? 4;
    const n1 = game.baseStones_p1?.length ?? 0;
    const n2 = game.baseStones_p2?.length ?? 0;
    if (n1 < target) return 'baseStones_p1';
    if (n2 < target) return 'baseStones_p2';
    return null;
};

/** 재배치·취소: p2에 돌이 있으면 p2부터, 없으면 p1 */
const resolvePairHostResetOrUndoBaseStoneKey = (game: types.LiveGameSession): 'baseStones_p1' | 'baseStones_p2' | null => {
    const n2 = game.baseStones_p2?.length ?? 0;
    if (n2 > 0) return 'baseStones_p2';
    const n1 = game.baseStones_p1?.length ?? 0;
    if (n1 > 0) return 'baseStones_p1';
    return null;
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

/** 판 가장자리(1·N선)에서 떨어진 격자 수 — 클수록 중앙에 가깝다. */
const edgeInset = (x: number, y: number, boardSize: number): number =>
    Math.min(x, y, boardSize - 1 - x, boardSize - 1 - y);

const distSqToBoardCenter = (x: number, y: number, boardSize: number): number => {
    const cx = (boardSize - 1) / 2;
    const cy = (boardSize - 1) / 2;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy;
};

type BaseRandCell = { x: number; y: number; d: number; inset: number };

/** interiorOnly: 1~(N-2) 선 안만(가장자리 1·N선 제외). 보드가 너무 작으면 interior 없음. */
const listBaseRandomCandidates = (
    boardSize: number,
    occupied: Set<string>,
    tempBoard: types.BoardState,
    playerColor: types.Player,
    interiorOnly: boolean,
    requireNonCapture: boolean
): BaseRandCell[] => {
    const lo = interiorOnly && boardSize > 2 ? 1 : 0;
    const hi = interiorOnly && boardSize > 2 ? boardSize - 2 : boardSize - 1;
    const out: BaseRandCell[] = [];
    for (let y = lo; y <= hi; y++) {
        for (let x = lo; x <= hi; x++) {
            const k = `${x},${y}`;
            if (occupied.has(k)) continue;
            if (requireNonCapture && wouldBeImmediatelyCaptured(tempBoard, x, y, playerColor)) continue;
            out.push({
                x,
                y,
                d: distSqToBoardCenter(x, y, boardSize),
                inset: edgeInset(x, y, boardSize),
            });
        }
    }
    return out;
};

/** 보드 중심에 가깝고, 동률이면 가장자리에서 더 안쪽(inset 큼)을 선호한 뒤 무작위 1칸. */
const pickBaseStoneRandomCell = (
    boardSize: number,
    occupied: Set<string>,
    tempBoard: types.BoardState,
    playerColor: types.Player
): { x: number; y: number } | null => {
    const tiers: Array<[boolean, boolean]> = [
        [true, true],
        [true, false],
        [false, true],
        [false, false],
    ];
    for (const [interiorOnly, requireNonCapture] of tiers) {
        const pool = listBaseRandomCandidates(boardSize, occupied, tempBoard, playerColor, interiorOnly, requireNonCapture);
        if (pool.length === 0) continue;
        pool.sort((a, b) => (a.d !== b.d ? a.d - b.d : b.inset - a.inset));
        const bestD = pool[0]!.d;
        const afterD = pool.filter((c) => c.d === bestD);
        const bestInset = afterD[0]!.inset;
        const tier = afterD.filter((c) => c.inset === bestInset);
        const pick = tier[Math.floor(Math.random() * tier.length)]!;
        return { x: pick.x, y: pick.y };
    }
    return null;
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

    // Create a temporary board state with currently placed stones
    const tempBoard: types.BoardState = Array(boardSize).fill(0).map(() => Array(boardSize).fill(types.Player.None));
    (game.baseStones_p1 ?? []).forEach(p => tempBoard[p.y][p.x] = types.Player.Black);
    (game.baseStones_p2 ?? []).forEach(p => tempBoard[p.y][p.x] = types.Player.White);

    for (let i = 0; i < stonesToPlace; i++) {
        const picked = pickBaseStoneRandomCell(boardSize, occupied, tempBoard, playerColor);
        if (!picked) {
            console.warn(`[BaseGo] No empty cells left for base stone placement (playerKey=${playerKey}).`);
            return;
        }
        const { x, y } = picked;
        const key = `${x},${y}`;
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
    game.basePlacementReady = undefined;

    game.gameStatus = 'base_stone_color_choice';
    game.baseStoneColorChoices = { [game.player1.id]: null, [game.player2.id]: null };
    game.baseColorChoiceDeadline = now + 30000;
    game.baseSameColorTieColor = undefined;
    game.komiBids = undefined;
    game.komiBiddingDeadline = undefined;
    game.komiBiddingRound = undefined;
    game.turnDeadline = undefined;
    game.turnStartTime = undefined;
    game.pausedTurnTimeLeft = undefined;
};

const oppositeStoneColor = (c: types.Player): types.Player =>
    c === types.Player.Black ? types.Player.White : types.Player.Black;

/** 선호 색이 다르면 즉시 흑·백·판·덤(백 +0.5) 확정 후 대국 시작 */
const finalizeBaseDifferentStoneColorChoices = (
    game: types.LiveGameSession,
    now: number,
    c1: types.Player,
    c2: types.Player,
) => {
    const p1 = game.player1;
    const p2 = game.player2;
    const blackPlayerId = c1 === types.Player.Black ? p1.id : p2.id;
    const whitePlayerId = c1 === types.Player.White ? p1.id : p2.id;
    const baseKomi = game.settings.komi ?? 0.5;
    const finalKomi = baseKomi + 0.5;

    game.blackPlayerId = blackPlayerId;
    game.whitePlayerId = whitePlayerId;
    game.finalKomi = finalKomi;
    game.baseStones = [];
    const newBoardState = Array(game.settings.boardSize)
        .fill(0)
        .map(() => Array(game.settings.boardSize).fill(types.Player.None));
    const p1Color = p1.id === blackPlayerId ? types.Player.Black : types.Player.White;
    const p2Color = p2.id === whitePlayerId ? types.Player.White : types.Player.Black;
    const p1BaseStoneColor = isAdventureBaseGame(game) ? types.Player.Black : p1Color;
    const p2BaseStoneColor = isAdventureBaseGame(game) ? types.Player.White : p2Color;
    (game.baseStones_p1 || []).forEach((p) => {
        newBoardState[p.y][p.x] = p1BaseStoneColor;
        game.baseStones!.push({ ...p, player: p1BaseStoneColor });
    });
    (game.baseStones_p2 || []).forEach((p) => {
        newBoardState[p.y][p.x] = p2BaseStoneColor;
        game.baseStones!.push({ ...p, player: p2BaseStoneColor });
    });
    game.boardState = newBoardState;
    game.baseKomiBidsSnapshot = {
        [p1.id]: { color: c1, komi: 0 },
        [p2.id]: { color: c2, komi: 0 },
    };
    game.komiBids = undefined;
    game.komiBiddingRound = undefined;
    game.baseStoneColorChoices = undefined;
    game.baseColorChoiceDeadline = undefined;
    game.baseSameColorTieColor = undefined;
    game.komiBiddingDeadline = undefined;
    game.revealEndTime = undefined;
    transitionToPlaying(game, now);
};

const resolveBaseStoneColorChoicePhase = (game: types.LiveGameSession, now: number) => {
    const p1 = game.player1.id;
    const p2 = game.player2.id;
    if (!game.baseStoneColorChoices) {
        game.baseStoneColorChoices = { [p1]: null, [p2]: null };
    }
    const aiId = game.player1.id === aiUserId ? game.player1.id : game.player2.id;
    const humanId = aiId === p1 ? p2 : p1;
    if (game.isAiGame) {
        const humanChoice = game.baseStoneColorChoices[humanId];
        if (humanChoice != null && game.baseStoneColorChoices[aiId] == null) {
            game.baseStoneColorChoices[aiId] = Math.random() < 0.5 ? types.Player.Black : types.Player.White;
        }
    }

    let c1 = game.baseStoneColorChoices[p1] ?? null;
    let c2 = game.baseStoneColorChoices[p2] ?? null;
    const deadlinePassed = !!game.baseColorChoiceDeadline && now > game.baseColorChoiceDeadline;
    const bothChosen = c1 != null && c2 != null;
    if (!bothChosen && !deadlinePassed) return;

    if (deadlinePassed) {
        if (c1 == null && c2 == null) {
            c1 = Math.random() < 0.5 ? types.Player.Black : types.Player.White;
            c2 = Math.random() < 0.5 ? types.Player.Black : types.Player.White;
        } else if (c1 == null) {
            c1 = oppositeStoneColor(c2!);
        } else if (c2 == null) {
            c2 = oppositeStoneColor(c1!);
        }
    }

    game.baseStoneColorChoices![p1] = c1;
    game.baseStoneColorChoices![p2] = c2;
    game.baseColorChoiceDeadline = undefined;

    if (c1 === null || c2 === null) return;

    if (c1 !== c2) {
        finalizeBaseDifferentStoneColorChoices(game, now, c1, c2);
    } else {
        game.baseSameColorTieColor = c1;
        game.gameStatus = 'base_same_color_points_bid';
        game.komiBids = { [p1]: null, [p2]: null };
        game.komiBiddingDeadline = now + 30000;
        game.komiBiddingRound = 1;
        game.turnDeadline = undefined;
        game.turnStartTime = undefined;
        game.pausedTurnTimeLeft = undefined;
    }
};

/** 양측 입찰이 채워진 뒤 흑·백·finalKomi·판 반영. 1차 동률이면 komi_bidding 2차로만 되돌림. (덤 공개 연출 단계 없이 즉시 처리) */
const applyBaseKomiBidResolution = (game: types.LiveGameSession, now: number) => {
    const p1 = game.player1;
    const p2 = game.player2;
    const p1Bid = game.komiBids?.[p1.id];
    const p2Bid = game.komiBids?.[p2.id];
    if (p1Bid == null || p2Bid == null) return;

    game.komiBidRevealProcessed = undefined;
    const baseKomi = game.settings.komi;
    let blackPlayerId: string | undefined, whitePlayerId: string | undefined, finalKomi: number | undefined;
    let useBaseColorRoulettePhase = false;

    if (p1Bid.color !== p2Bid.color) {
        blackPlayerId = p1Bid.color === types.Player.Black ? p1.id : p2.id;
        whitePlayerId = blackPlayerId === p1.id ? p2.id : p1.id;
        finalKomi = baseKomi;
    } else if (p1Bid.komi !== p2Bid.komi) {
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
    } else if ((game.komiBiddingRound || 1) === 1) {
        const sameColorFlow = game.baseSameColorTieColor != null;
        game.gameStatus = sameColorFlow ? 'base_same_color_points_bid' : 'komi_bidding';
        game.komiBiddingDeadline = sameColorFlow || !isAdventureBaseGame(game) ? now + 30000 : undefined;
        game.komiBids = { [p1.id]: null, [p2.id]: null };
        game.komiBiddingRound = 2;
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

    if (blackPlayerId && whitePlayerId && typeof finalKomi === 'number') {
        game.blackPlayerId = blackPlayerId;
        game.whitePlayerId = whitePlayerId;
        game.finalKomi = finalKomi;
        game.baseStones = [];
        const newBoardState = Array(game.settings.boardSize)
            .fill(0)
            .map(() => Array(game.settings.boardSize).fill(types.Player.None));
        const p1Color = p1.id === blackPlayerId ? types.Player.Black : types.Player.White;
        const p2Color = p2.id === whitePlayerId ? types.Player.White : types.Player.Black;
        // 모험 베이스는 덤 결과로 유저 색이 바뀌어도, 배치한 베이스 돌의 흑/백 표시를 고정한다.
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
        game.baseKomiBidsSnapshot = { [p1.id]: p1Bid, [p2.id]: p2Bid };
        game.komiBids = undefined;
        game.komiBiddingRound = undefined;
        game.basePlacementDeadline = undefined;
        game.komiBidRevealProcessed = undefined;
        game.baseStoneColorChoices = undefined;
        game.baseColorChoiceDeadline = undefined;
        game.baseSameColorTieColor = undefined;
        game.turnDeadline = undefined;
        game.turnStartTime = undefined;
        game.pausedTurnTimeLeft = undefined;
    }
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
            const bothReady =
                (game.basePlacementReady?.[p1Id] ?? false) && (game.basePlacementReady?.[p2Id] ?? false);
            const deadlinePassed =
                !isAdventureBaseGame(game) && !!game.basePlacementDeadline && now > game.basePlacementDeadline;
            // AI전: 봇은 시작 시 ready이지만 무작위 배치가 일부만 성공하면 돌 수가 부족할 수 있음.
            // resolveBasePlacementAndTransition이 부족분을 다시 채우므로, ready만 맞으면 전환한다.
            const canResolveBasePlacement =
                deadlinePassed || (bothReady && (bothDonePlacing || game.isAiGame));

            if (canResolveBasePlacement) {
                resolveBasePlacementAndTransition(game, now);
            }
            break;
        }
        case 'base_stone_color_choice': {
            resolveBaseStoneColorChoicePhase(game, now);
            break;
        }
        case 'base_same_color_points_bid':
        case 'komi_bidding': {
            const lockedSame = game.baseSameColorTieColor;
            if (game.isAiGame && game.komiBids) {
                const aiId = game.player1.id === aiUserId ? game.player1.id : game.player2.id;
                const humanId = aiId === p1Id ? p2Id : p1Id;
                if (game.gameStatus === 'base_same_color_points_bid' && lockedSame != null) {
                    if (game.komiBids[humanId] != null && game.komiBids[aiId] == null) {
                        const fromStage = (game.settings as types.GameSettings | undefined)?.singlePlayerAiBaseKomiBid;
                        const aiKomi = resolveRuntimeAiBaseKomiBid(fromStage).komi;
                        game.komiBids[aiId] = { color: lockedSame, komi: Math.min(100, Math.max(0, Math.floor(aiKomi))) };
                    }
                } else if (game.komiBids[humanId] != null && game.komiBids[aiId] == null) {
                    const fromStage = (game.settings as types.GameSettings | undefined)?.singlePlayerAiBaseKomiBid;
                    game.komiBids[aiId] = resolveRuntimeAiBaseKomiBid(fromStage);
                }
            }
            const bothHaveBid = game.komiBids?.[p1Id] != null && game.komiBids?.[p2Id] != null;
            const deadlinePassed = !!game.komiBiddingDeadline && now > game.komiBiddingDeadline;

            if (bothHaveBid || deadlinePassed) {
                if (deadlinePassed) {
                    if (game.gameStatus === 'base_same_color_points_bid' && lockedSame != null) {
                        const fill = { color: lockedSame, komi: 0 };
                        if (!game.komiBids![p1Id]) game.komiBids![p1Id] = fill;
                        if (!game.komiBids![p2Id]) game.komiBids![p2Id] = fill;
                    } else {
                        const timeoutBid = { color: types.Player.Black, komi: 0 };
                        if (!game.komiBids![p1Id]) game.komiBids![p1Id] = timeoutBid;
                        if (!game.komiBids![p2Id]) game.komiBids![p2Id] = timeoutBid;
                    }
                }
                applyBaseKomiBidResolution(game, now);
            }
            break;
        }
        case 'komi_bid_reveal':
            // 구버전·저장 데이터 호환: 공개 연출 없이 즉시 확정
            if (game.komiBids?.[p1Id] != null && game.komiBids?.[p2Id] != null) {
                applyBaseKomiBidResolution(game, now);
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
    const { type, payload } = action as any;
    const now = Date.now();

    switch (type) {
        case 'PLACE_BASE_STONE':
            if (game.gameStatus !== 'base_placement') return { error: "Not in base placement phase." };
            {
                const pairHostId = getPairLobbyOwnerId(game);
                const myStonesKey =
                    pairHostId != null
                        ? (() => {
                              if (user.id !== pairHostId) {
                                  return null as 'baseStones_p1' | 'baseStones_p2' | null;
                              }
                              return resolvePairHostActiveBaseStoneKey(game);
                          })()
                        : user.id === game.player1.id
                          ? ('baseStones_p1' as const)
                          : user.id === game.player2.id
                            ? ('baseStones_p2' as const)
                            : null;
                if (myStonesKey == null) {
                    return {
                        error:
                            pairHostId != null
                                ? '페어 방장만 베이스돌을 놓을 수 있습니다.'
                                : '베이스돌을 놓을 수 없습니다.',
                    };
                }
                if (!game[myStonesKey]) game[myStonesKey] = [];
                if ((game[myStonesKey]?.length ?? 0) >= game.settings.baseStones!) return { error: "Already placed all stones." };
                if (game[myStonesKey]!.some(p => p.x === payload.x && p.y === payload.y)) return { error: "Already placed a stone there." };
                game[myStonesKey]!.push({ x: payload.x, y: payload.y });
                if (pairHostId != null) clearBothPlayersBasePlacementReady(game);
                else clearBasePlacementReadyForUser(game, user.id);
            }
            return {};
        case 'PLACE_REMAINING_BASE_STONES_RANDOMLY':
            if (game.gameStatus !== 'base_placement') return { error: "Not in base placement phase." };
            {
                const pairHostId = getPairLobbyOwnerId(game);
                const playerStonesKey =
                    pairHostId != null
                        ? user.id === pairHostId
                            ? resolvePairHostActiveBaseStoneKey(game)
                            : null
                        : user.id === game.player1.id
                          ? ('baseStones_p1' as const)
                          : ('baseStones_p2' as const);
                if (playerStonesKey == null) {
                    return { error: pairHostId != null ? '페어 방장만 베이스돌을 놓을 수 있습니다.' : 'Not in base placement phase.' };
                }
                placeRemainingStonesRandomly(game, playerStonesKey);
                if (pairHostId != null) clearBothPlayersBasePlacementReady(game);
                else clearBasePlacementReadyForUser(game, user.id);
            }
            return {};
        case 'RESET_MY_BASE_STONE_PLACEMENTS':
            if (game.gameStatus !== 'base_placement') return { error: "Not in base placement phase." };
            {
                const pairHostId = getPairLobbyOwnerId(game);
                const resetKey =
                    pairHostId != null
                        ? user.id === pairHostId
                            ? resolvePairHostResetOrUndoBaseStoneKey(game)
                            : null
                        : user.id === game.player1.id
                          ? ('baseStones_p1' as const)
                          : ('baseStones_p2' as const);
                if (resetKey == null) {
                    return { error: pairHostId != null ? '페어 방장만 재배치할 수 있습니다.' : 'Not in base placement phase.' };
                }
                game[resetKey] = [];
                if (pairHostId != null) clearBothPlayersBasePlacementReady(game);
                else clearBasePlacementReadyForUser(game, user.id);
            }
            return {};
        case 'UNDO_LAST_BASE_STONE_PLACEMENT':
            if (game.gameStatus !== 'base_placement') return { error: "Not in base placement phase." };
            {
                const pairHostId = getPairLobbyOwnerId(game);
                const undoKey =
                    pairHostId != null
                        ? user.id === pairHostId
                            ? resolvePairHostResetOrUndoBaseStoneKey(game)
                            : null
                        : user.id === game.player1.id
                          ? ('baseStones_p1' as const)
                          : ('baseStones_p2' as const);
                if (undoKey == null) {
                    return { error: pairHostId != null ? '페어 방장만 취소할 수 있습니다.' : 'Not in base placement phase.' };
                }
                const undoArr = game[undoKey];
                if (!undoArr || undoArr.length === 0) return { error: "취소할 배치가 없습니다." };
                undoArr.pop();
                if (pairHostId != null) clearBothPlayersBasePlacementReady(game);
                else clearBasePlacementReadyForUser(game, user.id);
            }
            return {};
        case 'CONFIRM_BASE_PLACEMENT_COMPLETE': {
            if (game.gameStatus !== 'base_placement') return { error: '베이스돌 배치 단계가 아닙니다.' };
            const targetStones = game.settings.baseStones ?? 4;
            const pairHostId = getPairLobbyOwnerId(game);
            if (pairHostId != null) {
                if (user.id !== pairHostId) return { error: '페어 방장만 배치 완료를 확정할 수 있습니다.' };
                if ((game.baseStones_p1?.length ?? 0) < targetStones || (game.baseStones_p2?.length ?? 0) < targetStones) {
                    return { error: '양쪽 베이스돌을 모두 놓은 뒤에 배치 완료를 눌러 주세요.' };
                }
                if (!game.basePlacementReady) {
                    game.basePlacementReady = { [game.player1.id]: false, [game.player2.id]: false };
                    if (game.isAiGame) {
                        const aiId = game.player1.id === aiUserId ? game.player1.id : game.player2.id;
                        game.basePlacementReady[aiId] = true;
                    }
                }
                game.basePlacementReady[game.player1.id] = true;
                game.basePlacementReady[game.player2.id] = true;
                return {};
            }
            const confirmKey = user.id === game.player1.id ? 'baseStones_p1' : 'baseStones_p2';
            if ((game[confirmKey]?.length ?? 0) < targetStones) {
                return { error: '베이스돌을 모두 놓은 뒤에 배치 완료를 눌러 주세요.' };
            }
            if (!game.basePlacementReady) {
                game.basePlacementReady = { [game.player1.id]: false, [game.player2.id]: false };
                if (game.isAiGame) {
                    const aiId = game.player1.id === aiUserId ? game.player1.id : game.player2.id;
                    game.basePlacementReady[aiId] = true;
                }
            }
            game.basePlacementReady[user.id] = true;
            return {};
        }
        case 'SUBMIT_BASE_STONE_COLOR_CHOICE': {
            if (game.gameStatus !== 'base_stone_color_choice') return { error: '선호 돌 선택 단계가 아닙니다.' };
            const col = payload.color as types.Player;
            if (col !== types.Player.Black && col !== types.Player.White) {
                return { error: '흑 또는 백만 선택할 수 있습니다.' };
            }
            if (!game.baseStoneColorChoices) {
                game.baseStoneColorChoices = { [game.player1.id]: null, [game.player2.id]: null };
            }
            const pairHostIdChoice = getPairLobbyOwnerId(game);
            const subjectId =
                pairHostIdChoice != null && typeof payload.choiceForUserId === 'string'
                    ? payload.choiceForUserId === game.player2.id
                        ? game.player2.id
                        : game.player1.id
                    : user.id;
            if (pairHostIdChoice != null && user.id !== pairHostIdChoice) {
                return { error: '페어 방장만 돌 색을 선택할 수 있습니다.' };
            }
            if (pairHostIdChoice != null && subjectId !== game.player1.id && subjectId !== game.player2.id) {
                return { error: '선택 대상이 올바르지 않습니다.' };
            }
            if (game.baseStoneColorChoices[subjectId] != null) return { error: '이미 선택했습니다.' };
            game.baseStoneColorChoices[subjectId] = col;
            return {};
        }
        case 'UPDATE_KOMI_BID': {
            const inLegacyKomi = game.gameStatus === 'komi_bidding';
            const inSameColorBid = game.gameStatus === 'base_same_color_points_bid';
            if (!inLegacyKomi && !inSameColorBid) return { error: 'Cannot bid now.' };
            if (!game.komiBids) game.komiBids = {};
            const pairHostIdBid = getPairLobbyOwnerId(game);
            const bidSubjectId =
                pairHostIdBid != null && typeof payload.bidForUserId === 'string'
                    ? payload.bidForUserId === game.player2.id
                        ? game.player2.id
                        : game.player1.id
                    : user.id;
            if (pairHostIdBid != null && user.id !== pairHostIdBid) {
                return { error: '페어 방장만 덤 입찰을 할 수 있습니다.' };
            }
            if (pairHostIdBid != null && bidSubjectId !== game.player1.id && bidSubjectId !== game.player2.id) {
                return { error: '입찰 대상이 올바르지 않습니다.' };
            }
            if (game.komiBids?.[bidSubjectId]) return { error: 'Cannot bid now.' };
            const bid = payload.bid as { color: types.Player; komi: number };
            if (inSameColorBid) {
                const locked = game.baseSameColorTieColor;
                if (locked == null) return { error: '동색 입찰 상태가 아닙니다.' };
                const k = Math.floor(Number(bid?.komi));
                const komi = Number.isFinite(k) ? Math.max(0, Math.min(100, k)) : 0;
                game.komiBids[bidSubjectId] = { color: locked, komi };
            } else {
                game.komiBids[bidSubjectId] = bid;
            }
            return {};
        }
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