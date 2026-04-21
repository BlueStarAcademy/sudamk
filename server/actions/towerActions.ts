import { randomUUID } from 'crypto';
import * as db from '../db.js';
import { type ServerAction, type User, type VolatileState, LiveGameSession, Player, GameMode, Point, BoardState, SinglePlayerStageInfo, UserStatus, GameCategory } from '../../types/index.js';
import { TOWER_AI_BOT_DISPLAY_NAME, TOWER_STAGES } from '../../constants/towerConstants.js';
import { getAiUser } from '../aiPlayer.js';
import { broadcast } from '../socket.js';
import { generateStrategicRandomBoard } from '../strategicInitialBoard.js';
import {
    cloneBoardStateForKataOpeningSnapshot,
    encodeBoardStateAsKataSetupMovesFromEmpty,
} from '../kataCaptureSetupEncoding.js';
import { profileStepFromKataServerLevel } from '../../shared/utils/strategicAiDifficulty.js';
import { getTowerKataServerLevelByFloor } from '../../shared/utils/towerKataServerLevel.js';
import {
    resolveTowerCaptureBlackTarget,
    resolveTowerPlainWhiteCount,
} from '../../shared/utils/towerStageRules.js';
import { isTowerLobbyInventorySource } from '../modes/towerPlayerHidden.js';
import { aggregateSpecialOptionGearFromUser, towerApDiscountForFloor } from '../../shared/utils/specialOptionGearEffects.js';
import { requireArenaEntranceOpen } from '../arenaEntranceService.js';
import { applyPassiveActionPointRegenToUser } from '../effectService.js';
import { updateQuestProgress } from '../questService.js';
import { reconcileStrategicAiBoardSizeWithGroundTruth } from '../utils/effectiveBoardSize.js';

type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
};

/** 대기실·클라이언트 `countTowerLobbyInventoryQty`와 동일 */
const TOWER_TURN_ADD_ITEM_NAMES = ['턴 추가', '턴증가', 'turn_add', 'turn_add_item', 'addturn'] as const;

/** 배치변경: 대기실 `TOWER_ITEM_REFRESH_NAMES`와 동일 */
const TOWER_REFRESH_PLACEMENT_ITEM_NAMES = ['배치 새로고침', '배치변경', 'reflesh', 'refresh'] as const;

/**
 * CONFIRM_TOWER_GAME_START에서 startTime을 넣은 뒤에도 DB/캐시가 pending으로 남으면
 * 턴 추가·배치 새로고침 등이 "게임이 진행 중이 아닙니다"로 거절된다.
 * 시작 전(pending + startTime 없음)과 구분하기 위해 startTime 유무로만 보정한다.
 */
const normalizeTowerPlayingIfStarted = (game: LiveGameSession): void => {
    if (game.gameCategory !== 'tower') return;
    if (game.gameStatus !== 'pending') return;
    if (game.startTime == null) return;
    (game as any).gameStatus = 'playing';
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

/** Kata level이 표에 없을 때 goAiBot·요약용 난이도 단계(1~10) 근사 */
const towerAiDifficultyFallbackFromFloor = (floor: number): number => {
    const f = Math.max(1, Math.min(100, Math.floor(floor)));
    return Math.min(10, Math.max(2, Math.floor((f - 1) / 12) + 2));
};

const generateTowerBoard = (
    stage: SinglePlayerStageInfo,
    floor: number
): { board: BoardState; blackPattern: Point[]; whitePattern: Point[] } => {
    const p = stage.placements ?? { black: 0, white: 0, blackPattern: 0, whitePattern: 0 };
    const blackPlain = p.black ?? 0;
    const blackPattern = p.blackPattern ?? 0;
    const whitePat = p.whitePattern ?? 0;
    const whitePlain = resolveTowerPlainWhiteCount(floor, blackPlain, blackPattern, whitePat, p.white ?? 0);
    return generateStrategicRandomBoard(
        stage.boardSize,
        {
            black: blackPlain,
            white: whitePlain,
            blackPattern,
            whitePattern: whitePat,
        },
        { maxAttempts: 40 }
    );
};

export const handleTowerAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type, payload } = action as any;
    const now = Date.now();

    switch(type) {
        case 'START_TOWER_GAME': {
            const towerGate = await requireArenaEntranceOpen(user.isAdmin, 'tower', user);
            if (!towerGate.ok) return { error: towerGate.error };
            const { floor } = payload;
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
            const towerGear = aggregateSpecialOptionGearFromUser(user);
            const apDiscount = towerApDiscountForFloor(towerGear, floor);
            const effectiveActionPointCost = isCleared ? 0 : Math.max(0, stage.actionPointCost - apDiscount);

            await applyPassiveActionPointRegenToUser(user, now);
            
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

            const kataServerLevel = getTowerKataServerLevelByFloor(floor);
            const kataProfileStep =
                profileStepFromKataServerLevel(kataServerLevel) ?? towerAiDifficultyFallbackFromFloor(floor);
            const botNickname = TOWER_AI_BOT_DISPLAY_NAME;
            const botLevel = kataProfileStep * 10;

            const aiUser = {
                ...getAiUser(gameMode),
                nickname: botNickname,
                strategyLevel: botLevel,
                playfulLevel: botLevel,
            };

            const { board, blackPattern, whitePattern } = generateTowerBoard(stage, floor);

            const towerBlackCaptureTarget = resolveTowerCaptureBlackTarget(floor, stage.targetScore?.black);

            // 시간룰 설정: 스피드바둑은 피셔, 나머지는 1분+초읽기30초 3회
			const enforcedMainTimeMinutes = isSpeedMode ? (stage.timeControl.mainTime ?? 5) : 1;
            const enforcedByoyomiTimeSeconds = isSpeedMode ? (stage.timeControl.byoyomiTime ?? 0) : 30;
            const enforcedByoyomiCount = isSpeedMode ? 0 : 3;
            const enforcedIncrement = isSpeedMode ? (stage.timeControl.increment ?? 0) : 0;

            const gameId = `tower-game-${randomUUID()}`;

            // Mix 모드인 경우 mixedModes 설정
            const mixedModes: GameMode[] = [];
            if (stage.autoScoringTurns && stage.missileCount && stage.hiddenCount) {
                mixedModes.push(GameMode.Missile, GameMode.Hidden);
            }

            const game = {
                id: gameId,
                mode: gameMode,
                isSinglePlayer: false, // 도전의 탑은 별도 카테고리
                gameCategory: 'tower' as GameCategory,
                stageId: stage.id,
                towerFloor: floor,
                towerStartActionPointCost: effectiveActionPointCost,
                isAiGame: true,
                settings: {
                    boardSize: stage.boardSize,
                    komi: 0.5,
                    timeLimit: enforcedMainTimeMinutes,
                    byoyomiTime: enforcedByoyomiTimeSeconds,
                    byoyomiCount: enforcedByoyomiCount,
                    timeIncrement: enforcedIncrement,
                    captureTarget:
                        gameMode === GameMode.Capture ? towerBlackCaptureTarget : stage.targetScore?.black,
                    aiDifficulty: kataProfileStep,
                    kataServerLevel,
                    goAiBotLevel: kataProfileStep,
                    blackTurnLimit: stage.blackTurnLimit,
                    autoScoringTurns: stage.autoScoringTurns,
                    hiddenStoneCount: stage.hiddenCount,
                    scanCount: stage.scanCount ?? (stage.hiddenCount ? 2 : 0),
                    missileCount: stage.missileCount,
                    mixedModes: mixedModes.length > 0 ? mixedModes : undefined,
                    // 탑은 층별 `kataServerLevel`을 서버 Kata에만 사용한다. 클라 로컬 AI(WASM) 경로를 켜면
                    // 서버가 makeAiMove를 건너뛰어 체감 난이도가 설정과 무관해지므로 항상 비활성화.
                    useClientSideAi: false,
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
            } as unknown as LiveGameSession;

            (game as any).kataCaptureSetupMoves = encodeBoardStateAsKataSetupMovesFromEmpty(board);
            (game as any).kataStrategicOpeningBoardState = cloneBoardStateForKataOpeningSnapshot(board);
            // reconcile 등으로 스냅만 지워질 때 Kata 포석 접두 복구용(길드전과 동일한 오프닝 보존 개념)
            (game as any).kataTowerOpeningBoardBackup = cloneBoardStateForKataOpeningSnapshot(board);
            reconcileStrategicAiBoardSizeWithGroundTruth(game);

            // 1~20층: 따내기 목표점수 직접 설정(입찰 생략, 흑은 사용자 고정). 6~10층·11~20층은 서버 규칙으로 목표 덮어씀.
            if (gameMode === GameMode.Capture) {
                const blackTarget = towerBlackCaptureTarget;
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

            updateQuestProgress(user, 'tower_challenge', undefined, 1);
            
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
            const { getCachedGame, updateGameCache, updateUserCache } = await import('../gameCache.js');
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

            normalizeTowerPlayingIfStarted(game);

            // 첫 수를 두기 전에만 배치변경 가능
            if (game.gameStatus !== 'playing' || game.currentPlayer !== Player.Black || (game.moveHistory && game.moveHistory.length > 0)) {
                return { error: '배치는 첫 수 전에만 새로고침할 수 있습니다.' };
            }

            // TOWER_ADD_TURNS와 동일: /api/action이 넘기는 user는 캐시분이라 inventory가 비어 있을 수 있음 → DB에서 인벤 포함 재조회
            const userWithInventory = await db.getUser(user.id, { includeEquipment: true, includeInventory: true });
            if (!userWithInventory) {
                return { error: 'User not found.' };
            }

            const inventory = userWithInventory.inventory || [];
            const itemIndex = inventory.findIndex(
                (item: any) =>
                    TOWER_REFRESH_PLACEMENT_ITEM_NAMES.some((n) => item.name === n || item.id === n) &&
                    isTowerLobbyInventorySource(item) &&
                    (item.quantity ?? 1) > 0
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

            const floorRaw = game.towerFloor;
            const floorNum = floorRaw != null ? Number(floorRaw) : NaN;
            const refreshFloor =
                Number.isFinite(floorNum) && floorNum > 0
                    ? floorNum
                    : parseInt(String(stage.id).replace('tower-', ''), 10) || 1;
            const { board, blackPattern, whitePattern } = generateTowerBoard(stage, refreshFloor);
            game.boardState = board;
            game.blackPatternStones = blackPattern;
            game.whitePatternStones = whitePattern;
            // 스테이지 변경(줄 수 등) 후에도 KataServer boardXSize·GTP 좌표가 실제 판과 일치하도록 settings 동기화
            game.settings = { ...(game.settings as any), boardSize: stage.boardSize } as typeof game.settings;
            (game as any).kataCaptureSetupMoves = encodeBoardStateAsKataSetupMovesFromEmpty(board);
            (game as any).kataStrategicOpeningBoardState = cloneBoardStateForKataOpeningSnapshot(board);
            (game as any).kataTowerOpeningBoardBackup = cloneBoardStateForKataOpeningSnapshot(board);
            reconcileStrategicAiBoardSizeWithGroundTruth(game);

            // 도전의 탑은 시간 제한 미적용이므로 turnDeadline 복구하지 않음
            game.turnDeadline = undefined;
            game.turnStartTime = game.turnStartTime ?? Date.now();
            if (game.totalTurns == null && game.moveHistory?.length === 0) {
                (game as any).totalTurns = 0;
            }

            updateGameCache(game);
            await db.saveGame(game);
            await db.updateUser(userWithInventory).catch((err) => {
                console.error(`[TOWER_REFRESH_PLACEMENT] Failed to save user ${userWithInventory.id}:`, err);
            });
            updateUserCache(userWithInventory);

            const { broadcastToGameParticipants, broadcastUserUpdate } = await import('../socket.js');
            // 배치변경 후 클라이언트가 보드/문양을 확실히 반영하도록 boardState·문양 배열 포함하여 브로드캐스트
            const gameToSend = {
                ...game,
                boardState: game.boardState && Array.isArray(game.boardState) ? game.boardState.map((row: number[]) => [...row]) : game.boardState,
                blackPatternStones: Array.isArray(game.blackPatternStones) ? game.blackPatternStones.map((p: Point) => ({ ...p })) : (game.blackPatternStones ?? []),
                whitePatternStones: Array.isArray(game.whitePatternStones) ? game.whitePatternStones.map((p: Point) => ({ ...p })) : (game.whitePatternStones ?? []),
            };
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToSend } }, game);
            broadcastUserUpdate(userWithInventory, ['inventory', 'gold', 'diamonds', 'towerFloor', 'actionPoints']);
            // HTTP 응답에도 동일하게 포함해 클라이언트가 즉시 반영하도록 함
            return { clientResponse: { updatedUser: userWithInventory, gameId: game.id, game: gameToSend } };
        }
        case 'TOWER_ADD_TURNS': {
            const { gameId } = payload || {};
            if (!gameId || typeof gameId !== 'string') {
                return { error: 'Invalid gameId in payload.' };
            }
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

            normalizeTowerPlayingIfStarted(game);
            
            // 1~20층에서만 사용 가능
            const floorRaw = game.towerFloor;
            const floorNum = floorRaw != null ? Number(floorRaw) : NaN;
            const floor = Number.isFinite(floorNum) && floorNum > 0 ? floorNum : 1;
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
            const itemIndex = inventory.findIndex(
                (item: any) =>
                    TOWER_TURN_ADD_ITEM_NAMES.some((n) => item.name === n || item.id === n) &&
                    isTowerLobbyInventorySource(item) &&
                    (item.quantity ?? 1) > 0
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
            
            // 3턴 추가 (흑의 남은 턴 = stage.blackTurnLimit + bonus − blackMoves). 문자열 등 비정상 값 방지.
            const prevBonus = Number((game as any).blackTurnLimitBonus);
            (game as any).blackTurnLimitBonus = (Number.isFinite(prevBonus) ? prevBonus : 0) + 3;

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
            const updatedUser = await db.getUser(game.player1.id, { includeEquipment: true, includeInventory: true });
            return { clientResponse: { gameId: game.id, game, updatedUser: updatedUser ?? undefined } };
        }
        default:
            return { error: 'Unknown action type.' };
    }
};

