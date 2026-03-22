import { randomUUID } from 'crypto';
import * as db from '../db.js';
import { type ServerAction, type User, type VolatileState, LiveGameSession, Player, GameMode, Point, BoardState, SinglePlayerStageInfo, UserStatus, GameCategory } from '../../types/index.js';
import { TOWER_STAGES } from '../../constants/towerConstants.js';
import { getAiUser } from '../aiPlayer.js';
import { broadcast } from '../socket.js';
import { processMove } from '../goLogic.js';

type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
};

// Helper function to check if a stone placement would result in immediate capture
const wouldBeImmediatelyCaptured = (board: BoardState, x: number, y: number, player: Player): boolean => {
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
    const opponent = player === Player.Black ? Player.White : Player.Black;
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
    const findGroup = (startX: number, startY: number, playerColor: Player, currentBoard: BoardState) => {
        if (currentBoard[startY]?.[startX] !== playerColor) return null;
        const q: Point[] = [{ x: startX, y: startY }];
        const visitedStones = new Set([`${startX},${startY}`]);
        const libertyPoints = new Set<string>();
        const stones: Point[] = [{ x: startX, y: startY }];

        while (q.length > 0) {
            const { x: cx, y: cy } = q.shift()!;
            for (const n of getNeighbors(cx, cy)) {
                const key = `${n.x},${n.y}`;
                const neighborContent = currentBoard[n.y][n.x];

                if (neighborContent === Player.None) {
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

    // 0 liberties = 즉시 따이는 모양 (자살/포석 즉시 잡힘) → 배치 불가
    if (myGroup.liberties.length === 0) {
        return true;
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

// 빈 칸 목록을 랜덤 셔플 (Fisher-Yates)
const shufflePoints = (points: Point[]): Point[] => {
    const out = [...points];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

const getRandomTurnInRange = (minTurn: number, maxTurn: number): number => {
    const start = Math.max(1, Math.floor(minTurn));
    const end = Math.max(start, Math.floor(maxTurn));
    return start + Math.floor(Math.random() * (end - start + 1));
};

const planTowerAiHiddenTurns = (floor: number, hiddenCount: number): number[] => {
    if (floor < 21 || hiddenCount <= 0) return [];

    const plannedTurns: number[] = [getRandomTurnInRange(1, 20)];
    if (floor >= 51 && hiddenCount >= 2) {
        plannedTurns.push(getRandomTurnInRange(21, 35));
    }
    return plannedTurns.sort((a, b) => a - b);
};

// Helper function to place stones randomly without overlap and without immediate capture — 층별 흑/백 개수 정확히 맞춤
const placeStonesOnBoard = (board: BoardState, boardSize: number, count: number, player: Player): Point[] => {
    const empty: Point[] = [];
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (board[y][x] === Player.None) empty.push({ x, y });
        }
    }
    const shuffled = shufflePoints(empty);
    const placedStones: Point[] = [];
    for (const { x, y } of shuffled) {
        if (placedStones.length >= count) break;
        if (board[y][x] !== Player.None) continue;
        if (wouldBeImmediatelyCaptured(board, x, y, player)) continue;
        board[y][x] = player;
        placedStones.push({ x, y });
    }
    return placedStones;
};

// Helper function to place pattern stones randomly without overlap and without capture shape — 층별 문양돌 개수 맞춤, 따내지는 위치 제외
const placePatternStonesOnBoard = (board: BoardState, boardSize: number, count: number, player: Player, _existingStones: Point[]): Point[] => {
    const result: Point[] = [];
    for (let n = 0; n < count; n++) {
        const empty: Point[] = [];
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                if (board[y][x] !== Player.None) continue;
                if (wouldBeImmediatelyCaptured(board, x, y, player)) continue;
                empty.push({ x, y });
            }
        }
        if (empty.length === 0) break;
        const shuffled = shufflePoints(empty);
        const chosen = shuffled[0];
        board[chosen.y][chosen.x] = player;
        result.push(chosen);
    }
    return result;
};

const generateTowerBoard = (stage: SinglePlayerStageInfo): { board: BoardState, blackPattern: Point[], whitePattern: Point[] } => {
    const board = Array(stage.boardSize).fill(null).map(() => Array(stage.boardSize).fill(Player.None));
    const placements = stage.placements ?? { black: 0, white: 0, blackPattern: 0, whitePattern: 0 };
    const blackCount = placements.black ?? 0;
    const whiteCount = placements.white ?? 0;
    const blackPatternCount = placements.blackPattern ?? 0;
    const whitePatternCount = placements.whitePattern ?? 0;

    // 흑돌 배치 (층별 정해진 개수만큼)
    const blackStones = placeStonesOnBoard(board, stage.boardSize, blackCount, Player.Black);

    // 백돌 배치 (층별 정해진 개수만큼)
    const whiteStones = placeStonesOnBoard(board, stage.boardSize, whiteCount, Player.White);

    // 흑 문양돌 배치 (빈 칸에 개수만큼 랜덤 위치, 정확히 blackPatternCount개)
    const blackPattern = placePatternStonesOnBoard(board, stage.boardSize, blackPatternCount, Player.Black, blackStones);
    for (const p of blackPattern) {
        board[p.y][p.x] = Player.Black;
    }

    // 백 문양돌 배치 (빈 칸에 개수만큼 랜덤 위치, 정확히 whitePatternCount개)
    const whitePattern = placePatternStonesOnBoard(board, stage.boardSize, whitePatternCount, Player.White, whiteStones);
    for (const p of whitePattern) {
        board[p.y][p.x] = Player.White;
    }

    return { board, blackPattern, whitePattern };
};

// 1-19층: goAiBot (내장 AI), 20층+: 그누고 사용
const TOWER_GNUGO_LEVEL_RANGES: { floorMin: number; floorMax: number; gnugoLevel: number }[] = [
    { floorMin: 20, floorMax: 29, gnugoLevel: 1 },  // 그누고 1단계
    { floorMin: 30, floorMax: 39, gnugoLevel: 2 },  // 그누고 2단계
    { floorMin: 40, floorMax: 49, gnugoLevel: 3 },  // 그누고 3단계
    { floorMin: 50, floorMax: 59, gnugoLevel: 4 },  // 그누고 4단계
    { floorMin: 60, floorMax: 69, gnugoLevel: 5 },  // 그누고 5단계
    { floorMin: 70, floorMax: 79, gnugoLevel: 6 },  // 그누고 6단계
    { floorMin: 80, floorMax: 84, gnugoLevel: 7 },  // 그누고 7단계
    { floorMin: 85, floorMax: 89, gnugoLevel: 8 },  // 그누고 8단계
    { floorMin: 90, floorMax: 94, gnugoLevel: 9 },  // 그누고 9단계
    { floorMin: 95, floorMax: 100, gnugoLevel: 10 }, // 그누고 10단계
];

/** 1-19층: goAiBot 레벨 반환. 20층+: 그누고 사용 구간이므로 fallback용 goAiBot 레벨 반환 */
const getAiLevelFromFloor = (floor: number): number => {
    if (floor <= 19) {
        // 1-19층: goAiBot만 사용, 층에 따라 난이도 조절 (1~5)
        return Math.min(5, Math.max(1, Math.floor(floor / 4) + 1));
    }
    return 8; // 20층+ fallback용
};

/** 20층 이상에서 사용할 그누고 레벨 (1-10). 1-19층이면 null (그누고 미사용) */
export const getGnuGoLevelFromTowerFloor = (floor: number): number | null => {
    if (floor <= 19) return null;
    const range = TOWER_GNUGO_LEVEL_RANGES.find(r => floor >= r.floorMin && floor <= r.floorMax);
    return range ? range.gnugoLevel : 10; // 기본 최강
};

export const handleTowerAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type, payload } = action;
    const now = Date.now();

    switch(type) {
        case 'START_TOWER_GAME': {
            const { floor, useClientSideAi } = payload;
            const stage = TOWER_STAGES.find(s => {
                const stageFloor = parseInt(s.id.replace('tower-', ''));
                return stageFloor === floor;
            });

            if (!stage) {
                return { error: 'Stage not found.' };
            }
            
            // 관리자 여부 확인
            const isAdmin = user.isAdmin ?? false;
            
            // 잠금 검증: 1층은 항상 열림, 2층 이상은 이전 층이 클리어되어야 함 (관리자는 예외)
            const userTowerFloor = (user as any).towerFloor ?? 0;
            const isLocked = !isAdmin && floor > 1 && floor > userTowerFloor + 1;
            
            if (isLocked) {
                return { error: `아래층을 먼저 클리어해야 합니다. (현재 클리어: ${userTowerFloor}층)` };
            }
            
            // 클리어한 층은 행동력 소모가 0
            const isCleared = floor <= userTowerFloor;
            const effectiveActionPointCost = isCleared ? 0 : stage.actionPointCost;
            
            if (user.actionPoints.current < effectiveActionPointCost) {
                return { error: `액션 포인트가 부족합니다. (필요: ${effectiveActionPointCost})` };
            }

            // 행동력 소모 (클리어한 층은 0)
            if (effectiveActionPointCost > 0) {
                user.actionPoints.current -= effectiveActionPointCost;
                user.lastActionPointUpdate = now;
            }
            
            // 게임 모드 결정
            let gameMode: GameMode;
            const isSpeedMode = stage.timeControl.type === 'fischer';

            if (stage.autoScoringTurns && stage.missileCount && stage.hiddenCount) {
                // 자동계가 + 미사일 + 히든 합쳐진 형태
                gameMode = GameMode.Mix;
            } else if (stage.hiddenCount !== undefined) {
                gameMode = GameMode.Hidden;
            } else if (stage.missileCount !== undefined) {
                gameMode = GameMode.Missile;
            } else if (stage.blackTurnLimit !== undefined || stage.targetScore) {
                // 따내기 바둑: blackTurnLimit이 있거나 targetScore가 있는 경우
                gameMode = GameMode.Capture;
            } else if (isSpeedMode) {
                gameMode = GameMode.Speed;
            } else {
                gameMode = GameMode.Standard;
            }

            // 도전의 탑용 AI 유저 생성
            const aiLevel = getAiLevelFromFloor(floor);
            const botNickname = `탑봇 Lv.${floor}`;
            const botLevel = aiLevel * 10;
            
            const aiUser = {
                ...getAiUser(gameMode),
                nickname: botNickname,
                strategyLevel: botLevel,
                playfulLevel: botLevel,
            };
            
            const { board, blackPattern, whitePattern } = generateTowerBoard(stage);

            // 시간룰 설정: 스피드바둑은 피셔, 나머지는 1분+초읽기30초 3회
			const enforcedMainTimeMinutes = isSpeedMode ? (stage.timeControl.mainTime ?? 5) : 1;
            const enforcedByoyomiTimeSeconds = isSpeedMode ? (stage.timeControl.byoyomiTime ?? 0) : 30;
            const enforcedByoyomiCount = isSpeedMode ? 0 : 3;
            const enforcedIncrement = isSpeedMode ? (stage.timeControl.increment ?? 0) : 0;

            const gameId = `tower-game-${randomUUID()}`;
            const baseCaptureTargetBlack = stage.targetScore?.black && stage.targetScore.black > 0 ? stage.targetScore.black : 999;
            const baseCaptureTargetWhite = stage.targetScore?.white && stage.targetScore.white > 0 ? stage.targetScore.white : 999;

            // Mix 모드인 경우 mixedModes 설정
            const mixedModes: GameMode[] = [];
            if (stage.autoScoringTurns && stage.missileCount && stage.hiddenCount) {
                mixedModes.push(GameMode.Missile, GameMode.Hidden);
            }

            const game: LiveGameSession = {
                id: gameId,
                mode: gameMode,
                isSinglePlayer: false, // 도전의 탑은 별도 카테고리
                gameCategory: 'tower' as GameCategory,
                stageId: stage.id,
                towerFloor: floor,
                isAiGame: true,
                settings: {
                    boardSize: stage.boardSize,
                    komi: 0.5,
                    timeLimit: enforcedMainTimeMinutes,
                    byoyomiTime: enforcedByoyomiTimeSeconds,
                    byoyomiCount: enforcedByoyomiCount,
                    timeIncrement: enforcedIncrement,
                    captureTarget: stage.targetScore?.black,
                    aiDifficulty: aiLevel,
                    blackTurnLimit: stage.blackTurnLimit,
                    autoScoringTurns: stage.autoScoringTurns,
                    hiddenStoneCount: stage.hiddenCount,
                    scanCount: stage.scanCount ?? (stage.hiddenCount ? 2 : 0),
                    missileCount: stage.missileCount,
                    mixedModes: mixedModes.length > 0 ? mixedModes : undefined,
                    useClientSideAi: useClientSideAi === true,
                } as any,
                player1: user,
                player2: aiUser,
                blackPlayerId: user.id,
                whitePlayerId: aiUser.id,
                gameStatus: 'pending',
                currentPlayer: Player.Black,
                boardState: board,
                blackPatternStones: blackPattern,
                whitePatternStones: whitePattern,
                moveHistory: [],
                captures: { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 },
                baseStoneCaptures: { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 },
                hiddenStoneCaptures: { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 },
                koInfo: null,
                lastMove: null,
                createdAt: now,
                startTime: undefined,
                endTime: undefined,
                serverRevision: 0,
                totalTurns: 0,
            };

            // 1~20층: 따내기 목표점수 직접 설정(입찰 생략, 흑은 사용자 고정)
            if (gameMode === GameMode.Capture) {
                const blackTarget = stage.targetScore?.black && stage.targetScore.black > 0 ? stage.targetScore.black : 999;
                const whiteTarget = stage.targetScore?.white && stage.targetScore.white > 0 ? stage.targetScore.white : 999;
                (game as any).effectiveCaptureTargets = {
                    [Player.None]: 0,
                    [Player.Black]: blackTarget,
                    [Player.White]: whiteTarget
                };
                // 캡처 모드의 사전 단계(입찰/공개)를 사용하지 않고 바로 플레이로 전환할 수 있도록 준비
                // 실제 시작은 CONFIRM_TOWER_GAME_START에서 처리
            }

            // 타워 게임은 PVE 게임이므로 pending 상태에서는 일반적으로 DB에 저장하지 않지만,
            // CONFIRM_TOWER_GAME_START에서 찾을 수 있도록 forceSave로 DB에도 저장
            // 게임 캐시에 먼저 저장 (CONFIRM_TOWER_GAME_START에서 빠르게 찾을 수 있도록)
            const { updateGameCache } = await import('../gameCache.js');
            updateGameCache(game);
            
            // forceSave=true로 설정하여 pending 상태의 타워 게임도 DB에 저장
            // 이렇게 하면 CONFIRM_TOWER_GAME_START에서 캐시를 찾지 못해도 DB에서 찾을 수 있음
            await db.saveGame(game, true);
            
            volatileState.userStatuses[game.player1.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id, gameCategory: 'tower' as GameCategory };
            // AI 플레이어는 userStatuses에 포함하지 않음 (실제 유저가 아니므로)
            
            // DB 저장은 비동기로 처리하여 응답 지연 최소화
            db.updateUser(user).catch(err => {
                console.error(`[START_TOWER_GAME] Failed to save user ${user.id}:`, err);
            });
            
            // 게임 생성 후 게임 정보를 먼저 브로드캐스트 (게임 참가자에게만 전송)
            const { broadcastToGameParticipants, broadcastUserUpdate } = await import('../socket.js');
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
            // 그 다음 사용자 상태 브로드캐스트
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            broadcastUserUpdate(user);

            return {
                clientResponse: {
                    gameId: game.id,
                    game: game
                }
            };
        }
        case 'CONFIRM_TOWER_GAME_START': {
            const { gameId } = payload;
            if (!gameId || typeof gameId !== 'string') {
                console.error('[CONFIRM_TOWER_GAME_START] Invalid gameId:', { gameId, payload, userId: user.id });
                return { error: 'Invalid gameId in payload.' };
            }
            
            // 타워 게임은 메모리 캐시에서 먼저 찾기 (DB 조회 최소화로 속도 개선)
            // 타워 게임 pending 상태는 DB에 저장되지 않으므로 캐시에서만 찾을 수 있음
            const { getCachedGame, updateGameCache } = await import('../gameCache.js');
            let game = await getCachedGame(gameId);
            
            // 캐시에서 못 찾으면 DB에서 찾기 (게임이 종료되어 저장된 경우)
            if (!game) {
                game = await db.getLiveGame(gameId);
                // DB에서 찾았으면 캐시에도 저장
                if (game) {
                    updateGameCache(game);
                }
            }
            
            if (!game) {
                console.error('[CONFIRM_TOWER_GAME_START] Game not found:', { gameId, userId: user.id });
                return { error: 'Game not found.' };
            }
            
            if (game.gameCategory !== 'tower') {
                console.error('[CONFIRM_TOWER_GAME_START] Not a tower game:', { gameId, gameCategory: game.gameCategory, userId: user.id });
                return { error: 'Not a tower game.' };
            }
            
            if (game.gameStatus !== 'pending') {
                console.warn('[CONFIRM_TOWER_GAME_START] Game already started:', { gameId, gameStatus: game.gameStatus, userId: user.id });
                return { error: `Game already started. Current status: ${game.gameStatus}` };
            }
            
            console.log('[CONFIRM_TOWER_GAME_START] Starting tower game:', { gameId, floor: game.towerFloor, userId: user.id });
            
            game.gameStatus = 'playing';
            game.startTime = now;
            (game as any).gameStartTime = now; // 경과 시간은 실제 시작 시점부터 (pending 시 0 표시)
            // currentPlayer를 Black으로 설정 (유저가 항상 Black으로 시작)
            game.currentPlayer = Player.Black;
            
            // 21층 이상: 미사일/히든 개수를 로비·가방 인벤토리와 동기화 (스테이지 상한 적용)
            const floor = game.towerFloor ?? 1;
            if (floor >= 21) {
                const { initializeTowerPlayerHidden, towerP1ConsumableAllowance, countTowerLobbyInventoryQty } = await import('../modes/towerPlayerHidden.js');
                const inv = user.inventory || [];
                const missileCap = (game.settings as any).missileCount ?? 2;
                const hiddenCap = (game.settings as any).hiddenStoneCount ?? 2;
                const scanCap = (game.settings as any).scanCount ?? 2;
                const aiHiddenCap = floor >= 51 ? Math.max(2, hiddenCap) : hiddenCap;
                const aiHiddenItemTurns = planTowerAiHiddenTurns(floor, aiHiddenCap);
                (game as any).missiles_p1 = towerP1ConsumableAllowance(countTowerLobbyInventoryQty(inv, ['미사일', 'missile', 'Missile']), missileCap);
                (game as any).hidden_stones_p1 = towerP1ConsumableAllowance(countTowerLobbyInventoryQty(inv, ['히든', 'hidden', 'Hidden']), hiddenCap);
                (game as any).scans_p1 = towerP1ConsumableAllowance(countTowerLobbyInventoryQty(inv, ['스캔', 'scan', 'Scan', 'SCAN', '스캔권', '스캔 아이템']), scanCap);
                (game as any).hidden_stones_p2 = aiHiddenCap;
                (game as any).scans_p2 = (game.settings as any).scanCount ?? 0;
                (game as any).aiHiddenItemTurns = aiHiddenItemTurns;
                (game as any).aiHiddenItemsUsedCount = 0;
                game.aiHiddenItemUsed = false;
                game.aiHiddenItemTurn = aiHiddenItemTurns[0];
                initializeTowerPlayerHidden(game);
            }
            
            // 도전의 탑은 시간 제한 없음 (제한시간/초읽기 미적용)
            game.turnDeadline = undefined;
            game.blackTimeLeft = 0;
            game.whiteTimeLeft = 0;
            game.blackByoyomiPeriodsLeft = 0;
            game.whiteByoyomiPeriodsLeft = 0;
            game.turnStartTime = now;
            
            // 게임 캐시 업데이트 (다음 요청에서 빠른 응답)
            updateGameCache(game);
            
            // DB 저장을 여기서 완료까지 대기 (TOWER_ADD_TURNS 등 직후 요청에서 캐시 만료 시에도 DB에서 'playing' 상태를 읽을 수 있도록)
            await db.saveGame(game).catch(err => {
                console.error(`[CONFIRM_TOWER_GAME_START] Failed to save game ${gameId}:`, err);
            });
            
            // 사용자 상태 업데이트
            volatileState.userStatuses[game.player1.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id, gameCategory: 'tower' as GameCategory };
            
            // 게임 업데이트 먼저 브로드캐스트 (게임 참가자에게만 전송)
            const { broadcastToGameParticipants } = await import('../socket.js');
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
            // 그 다음 사용자 상태 브로드캐스트
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            
            // 게임 객체를 응답에 포함하여 클라이언트가 즉시 업데이트할 수 있도록 함
            return {
                clientResponse: {
                    gameId: game.id,
                    game: game
                }
            };
        }
        case 'TOWER_REFRESH_PLACEMENT': {
            const { gameId } = payload;
            const { getCachedGame, updateGameCache } = await import('../gameCache.js');
            let game = await getCachedGame(gameId);
            if (!game) {
                game = await db.getLiveGame(gameId);
            }
            if (!game) {
                return { error: 'Game not found.' };
            }

            if (game.gameCategory !== 'tower') {
                return { error: 'Not a tower game.' };
            }

            // 첫 수를 두기 전에만 배치변경 가능
            if (game.gameStatus !== 'playing' || game.currentPlayer !== Player.Black || (game.moveHistory && game.moveHistory.length > 0)) {
                return { error: '배치는 첫 수 전에만 새로고침할 수 있습니다.' };
            }

            // 배치변경 아이템 사용 가능 여부 확인 및 소모 (로비·가방과 동일: 이름/id 일치 시 사용, source는 tower 또는 미지정)
            const inventory = user.inventory || [];
            const itemIndex = inventory.findIndex((item: any) =>
                (item.name === '배치 새로고침' || item.name === '배치변경' || item.id === 'reflesh' || item.id === 'refresh') && (item.source === 'tower' || item.source == null)
            );

            if (itemIndex === -1) {
                return { error: '배치 새로고침 아이템이 없습니다.' };
            }

            const item = inventory[itemIndex];
            if ((item.quantity || 1) <= 0) {
                return { error: '배치 새로고침 아이템이 없습니다.' };
            }

            // 아이템 개수 감소
            if ((item.quantity || 1) > 1) {
                item.quantity = (item.quantity || 1) - 1;
            } else {
                inventory.splice(itemIndex, 1);
            }

            // 스테이지 조회: stageId 우선, 없으면 towerFloor로 층 번호 매칭 (DB/캐시 차이 대응)
            let stage = TOWER_STAGES.find(s => s.id === game.stageId);
            if (!stage && game.towerFloor != null) {
                const floor = Number(game.towerFloor);
                if (!Number.isNaN(floor)) {
                    stage = TOWER_STAGES.find(s => parseInt(s.id.replace('tower-', ''), 10) === floor);
                }
            }
            if (!stage) {
                return { error: 'Stage data not found for refresh.' };
            }

            const { board, blackPattern, whitePattern } = generateTowerBoard(stage);
            game.boardState = board;
            game.blackPatternStones = blackPattern;
            game.whitePatternStones = whitePattern;

            // 도전의 탑은 시간 제한 미적용이므로 turnDeadline 복구하지 않음
            game.turnDeadline = undefined;
            game.turnStartTime = game.turnStartTime ?? Date.now();
            if (game.totalTurns == null && game.moveHistory?.length === 0) {
                (game as any).totalTurns = 0;
            }

            updateGameCache(game);
            await db.saveGame(game);
            await db.updateUser(user);

            const { broadcastToGameParticipants, broadcastUserUpdate } = await import('../socket.js');
            // 배치변경 후 클라이언트가 보드/문양을 확실히 반영하도록 boardState·문양 배열 포함하여 브로드캐스트
            const gameToSend = {
                ...game,
                boardState: game.boardState && Array.isArray(game.boardState) ? game.boardState.map((row: number[]) => [...row]) : game.boardState,
                blackPatternStones: Array.isArray(game.blackPatternStones) ? game.blackPatternStones.map((p: Point) => ({ ...p })) : (game.blackPatternStones ?? []),
                whitePatternStones: Array.isArray(game.whitePatternStones) ? game.whitePatternStones.map((p: Point) => ({ ...p })) : (game.whitePatternStones ?? []),
            };
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToSend } }, game);
            broadcastUserUpdate(user, ['actionPoints', 'towerFloor']);
            // HTTP 응답에도 동일하게 포함해 클라이언트가 즉시 반영하도록 함
            return { clientResponse: { updatedUser: user, gameId: game.id, game: gameToSend } };
        }
        case 'TOWER_ADD_TURNS': {
            const { gameId } = payload;
            // 도전의 탑은 CONFIRM 후 gameStatus가 캐시에서만 'playing'으로 바뀌고 DB 저장은 비동기이므로, 캐시 우선 조회 (TOWER_REFRESH_PLACEMENT와 동일)
            const { getCachedGame, updateGameCache, updateUserCache } = await import('../gameCache.js');
            let game = await getCachedGame(gameId);
            if (!game) {
                game = await db.getLiveGame(gameId);
                if (game) updateGameCache(game);
            }
            if (!game) {
                return { error: 'Game not found.' };
            }
            
            if (game.gameCategory !== 'tower') {
                return { error: 'Not a tower game.' };
            }
            
            // 1~20층에서만 사용 가능
            const floor = game.towerFloor ?? 1;
            if (floor > 20) {
                return { error: '턴 추가 아이템은 1~20층에서만 사용 가능합니다.' };
            }
            
            if (game.gameStatus !== 'playing') {
                return { error: '게임이 진행 중이 아닙니다.' };
            }
            
            // API에서 전달된 user는 getCachedUser로 로드되어 inventory가 비어 있을 수 있음 → DB에서 인벤토리 포함해 재조회
            const userWithInventory = await db.getUser(user.id, { includeEquipment: true, includeInventory: true });
            if (!userWithInventory) {
                return { error: 'User not found.' };
            }
            const inventory = userWithInventory.inventory || [];
            const itemIndex = inventory.findIndex((item: any) =>
                (item.name === '턴 추가' || item.name === '턴증가' || item.id === 'turn_add' || item.id === 'turn_add_item' || item.id === 'addturn') && (item.source === 'tower' || item.source == null)
            );
            
            if (itemIndex === -1) {
                return { error: '턴 추가 아이템이 없습니다.' };
            }
            
            const item = inventory[itemIndex];
            if ((item.quantity || 1) <= 0) {
                return { error: '턴 추가 아이템이 없습니다.' };
            }
            
            // 아이템 개수 감소
            if ((item.quantity || 1) > 1) {
                item.quantity = (item.quantity || 1) - 1;
            } else {
                inventory.splice(itemIndex, 1);
            }
            
            // 게임 세션에 blackTurnLimitBonus 추가 (초기화되지 않은 경우)
            if (!(game as any).blackTurnLimitBonus) {
                (game as any).blackTurnLimitBonus = 0;
            }
            
            // 3턴 추가 (흑의 남은 턴 = effectiveBlackTurnLimit - blackMoves 에서 limit이 +3 됨)
            (game as any).blackTurnLimitBonus += 3;

            updateGameCache(game);
            // 새로고침 후에도 턴 추가가 유지되도록 PVE 진행 중에도 DB에 강제 저장
            await db.saveGame(game, true);
            await db.updateUser(userWithInventory).catch(err => {
                console.error(`[TOWER_ADD_TURNS] Failed to save user ${userWithInventory.id}:`, err);
            });
            updateUserCache(userWithInventory);

            const { broadcastToGameParticipants, broadcastUserUpdate } = await import('../socket.js');
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
            broadcastUserUpdate(userWithInventory, ['inventory', 'gold', 'diamonds', 'towerFloor']);
            // HTTP 응답에 game 포함해 클라이언트가 남은 턴 UI 즉시 갱신
            return { clientResponse: { updatedUser: userWithInventory, gameId: game.id, game } };
        }
        case 'END_TOWER_GAME': {
            const { gameId, winner, winReason } = payload;
            if (!gameId || typeof gameId !== 'string') {
                return { error: 'Invalid gameId in payload.' };
            }
            
            const game = await db.getLiveGame(gameId);
            if (!game) {
                return { error: 'Game not found.' };
            }
            
            if (game.gameCategory !== 'tower') {
                return { error: 'Not a tower game.' };
            }
            
            // 게임이 이미 종료되었는지 확인
            if (game.gameStatus === 'ended') {
                console.log('[END_TOWER_GAME] Game already ended, ignoring:', { gameId, currentWinner: game.winner, requestedWinner: winner });
                return { clientResponse: { gameId: game.id, game } };
            }
            
            // 클라이언트에서 전달한 승자 정보를 사용 (클라이언트가 승리 조건을 정확히 체크함)
            // 단, winner가 유효한지 확인
            if (winner !== Player.Black && winner !== Player.White) {
                console.error('[END_TOWER_GAME] Invalid winner:', { gameId, winner, winReason });
                return { error: 'Invalid winner in payload.' };
            }
            
            console.log('[END_TOWER_GAME] Ending tower game:', { gameId, winner: winner === Player.Black ? 'Black' : 'White', winReason, currentCaptures: game.captures });
            
            // 게임 종료 상태 업데이트 (endGame 호출 전에 설정하지 않음 - endGame 내부에서 설정됨)
            game.winner = winner;
            game.winReason = winReason;
            game.endTime = now;
            
            // 서버에서 endGame 호출하여 클리어 정보 저장 및 towerFloor 업데이트
            // endGame 함수가 game.gameStatus를 'ended'로 설정하고 towerFloor를 업데이트함
            const { endGame } = await import('../summaryService.js');
            await endGame(game, winner, winReason);
            
            await db.saveGame(game);
            const { broadcastToGameParticipants } = await import('../socket.js');
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
            
            // 경험치/골드/층수 등이 반영된 최신 유저를 응답에 포함해 클라이언트가 즉시 반영하도록 함
            const updatedUser = await db.getUser(game.player1.id);
            return { clientResponse: { gameId: game.id, game, updatedUser: updatedUser ?? undefined } };
        }
        default:
            return { error: 'Unknown action type.' };
    }
};

