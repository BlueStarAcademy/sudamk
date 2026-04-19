import { randomUUID } from 'crypto';
import * as db from '../db.js';
import { type ServerAction, type User, type VolatileState, LiveGameSession, Player, GameMode, Point, BoardState, SinglePlayerStageInfo, SinglePlayerMissionState, UserStatus, SinglePlayerLevel } from '../../types/index.js';
import { SINGLE_PLAYER_STAGES, SINGLE_PLAYER_MISSIONS } from '../../shared/constants/singlePlayerConstants';
import { getAiUser } from '../aiPlayer.js';
import { broadcast } from '../socket.js';
import {
    cloneBoardStateForKataOpeningSnapshot,
    encodeBoardStateAsKataSetupMovesFromEmpty,
} from '../kataCaptureSetupEncoding.js';
import {
    generateStrategicRandomBoard,
    isInvalidStrategicInitialStonePlacement,
} from '../strategicInitialBoard.js';
import { requireArenaEntranceOpen } from '../arenaEntranceService.js';
import { applyPassiveActionPointRegenToUser } from '../effectService.js';
import { KATA_SERVER_LEVEL_BY_PROFILE_STEP } from '../../shared/utils/strategicAiDifficulty.js';
import { DEFAULT_REWARD_CONFIG, normalizeRewardConfig } from '../../shared/constants/rewardConfig.js';
import { ONBOARDING_PHASE_COMPLETE } from '../../shared/constants/onboardingTutorial.js';
import { updateQuestProgress } from '../questService.js';

type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
};

const getRewardConfig = async () => {
    const stored = await db.getKV<unknown>('rewardConfig');
    return normalizeRewardConfig(stored ?? DEFAULT_REWARD_CONFIG);
};

const addRewardBonus = (value: number | undefined, bonus: number): number => {
    const base = Number(value) || 0;
    const add = Number(bonus) || 0;
    return Math.max(0, Math.floor(base + add));
};

/**
 * 반(난이도 구간)별 KataServer 프로필 단계 (1~5) → `KATA_SERVER_LEVEL_BY_PROFILE_STEP`과 대응.
 * 입문~유단자 각 스테이지 1~20 전부 동일 단계.
 */
const getSinglePlayerKataProfileStep = (level: SinglePlayerLevel): number => {
    switch (level) {
        case SinglePlayerLevel.입문:
            return 1;
        case SinglePlayerLevel.초급:
            return 2;
        case SinglePlayerLevel.중급:
            return 3;
        case SinglePlayerLevel.고급:
            return 4;
        case SinglePlayerLevel.유단자:
            return 5;
        default:
            return 1;
    }
};

/** 미리 깔리는 일반 백돌(placements.white)만 구간별로 줄여 난이도 조절 (문양 백돌은 그대로). */
const singlePlayerPlainWhiteReduction = (level: SinglePlayerLevel): number => {
    switch (level) {
        case SinglePlayerLevel.입문:
            return 0;
        case SinglePlayerLevel.초급:
            return 2;
        case SinglePlayerLevel.중급:
            return 3;
        case SinglePlayerLevel.고급:
            return 4;
        case SinglePlayerLevel.유단자:
            return 5;
        default:
            return 0;
    }
};

const generateSinglePlayerBoard = (stage: SinglePlayerStageInfo): { board: BoardState, blackPattern: Point[], whitePattern: Point[] } => {
    if (stage.fixedOpening?.length) {
        const bs = stage.boardSize;
        const board: BoardState = Array(bs)
            .fill(null)
            .map(() => Array(bs).fill(Player.None));
        for (const s of stage.fixedOpening) {
            if (s.x >= 0 && s.x < bs && s.y >= 0 && s.y < bs) {
                board[s.y][s.x] = s.color === 'black' ? Player.Black : Player.White;
            }
        }
        return { board, blackPattern: [], whitePattern: [] };
    }

    const center = Math.floor(stage.boardSize / 2);
    let blackToPlace = stage.placements.black;
    const whitePlain = Math.max(
        0,
        stage.placements.white - singlePlayerPlainWhiteReduction(stage.level)
    );
    let baseBoard: BoardState | undefined;

    if (
        stage.placements.centerBlackStoneChance !== undefined &&
        stage.placements.centerBlackStoneChance > 0 &&
        Math.random() * 100 < stage.placements.centerBlackStoneChance
    ) {
        const template = Array(stage.boardSize).fill(null).map(() => Array(stage.boardSize).fill(Player.None));
        if (!isInvalidStrategicInitialStonePlacement(template, center, center, Player.Black)) {
            template[center][center] = Player.Black;
            baseBoard = template;
            blackToPlace--;
        }
    }

    return generateStrategicRandomBoard(
        stage.boardSize,
        {
            black: blackToPlace,
            white: whitePlain,
            blackPattern: stage.placements.blackPattern,
            whitePattern: stage.placements.whitePattern,
        },
        { baseBoard, maxAttempts: 40 }
    );
};


export const handleSinglePlayerAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type, payload } = action as any;
    const now = Date.now();

    switch(type) {
        case 'START_SINGLE_PLAYER_GAME': {
            const spGate = await requireArenaEntranceOpen(user.isAdmin, 'singleplayer', user);
            if (!spGate.ok) return { error: spGate.error };
            const { stageId } = payload;
            const stage = SINGLE_PLAYER_STAGES.find(s => s.id === stageId);

            if (!stage) {
                return { error: 'Stage not found.' };
            }

            const currentStageIndex = SINGLE_PLAYER_STAGES.findIndex(s => s.id === stageId);
            if (currentStageIndex < 0) {
                return { error: '스테이지를 찾을 수 없습니다.' };
            }

            const clearedStages = user.clearedSinglePlayerStages || [];
            const singlePlayerProgress = user.singlePlayerProgress ?? 0;
            const isCleared = clearedStages.includes(stageId) || singlePlayerProgress > currentStageIndex;
            const effectiveActionPointCost = isCleared ? 0 : stage.actionPointCost;
            
            // 관리자가 아닌 경우 스테이지 잠금 확인
            if (!user.isAdmin) {
                // 첫 번째 스테이지가 아니면 이전 스테이지 클리어 여부 확인
                if (currentStageIndex > 0) {
                    const previousStage = SINGLE_PLAYER_STAGES[currentStageIndex - 1];
                    
                    if (!clearedStages.includes(previousStage.id)) {
                        console.log(`[START_SINGLE_PLAYER_GAME] Stage ${stageId} locked - previous stage ${previousStage.id} not cleared. Cleared stages: ${JSON.stringify(clearedStages)}`);
                        return { error: '이전 스테이지를 먼저 클리어해야 합니다.' };
                    }
                }
            }

            await applyPassiveActionPointRegenToUser(user, now);
            
            if (user.actionPoints.current < effectiveActionPointCost) {
                return { error: `액션 포인트가 부족합니다. (필요: ${effectiveActionPointCost})` };
            }

            if (effectiveActionPointCost > 0) {
                user.actionPoints.current -= effectiveActionPointCost;
                user.lastActionPointUpdate = now;
            }
            
            // 게임 모드 결정
            // 우선순위: Hidden > Missile > Speed (autoScoringTurns) > Capture > Speed (fischer) > Standard
            let gameMode: GameMode;
            const isSpeedMode = stage.timeControl.type === 'fischer';

            if (stage.hiddenCount !== undefined) {
                // 히든바둑 모드 (최우선)
                gameMode = GameMode.Hidden;
            } else if (stage.missileCount !== undefined) {
                // 미사일바둑 모드 (중급 1~20 스테이지)
                gameMode = GameMode.Missile;
            } else if (stage.autoScoringTurns !== undefined) {
                // 자동 계가 턴 수가 있으면 스피드 바둑 (초급반 등)
                gameMode = GameMode.Speed;
            } else if (stage.blackTurnLimit !== undefined || stage.targetScore) {
                // 따내기 바둑: blackTurnLimit이 있거나 targetScore가 있는 경우
                gameMode = GameMode.Capture;
            } else if (isSpeedMode) {
                gameMode = GameMode.Speed;
            } else {
                gameMode = GameMode.Standard;
            }

            // 싱글플레이용 AI: 반별 Kata 프로필 1~5단계 (KataServer 레벨봇 API 값은 kataServerLevel)
            const kataProfileStep = getSinglePlayerKataProfileStep(stage.level);
            const kataServerLevel =
                KATA_SERVER_LEVEL_BY_PROFILE_STEP[kataProfileStep] ?? KATA_SERVER_LEVEL_BY_PROFILE_STEP[1];
            const levelName = stage.level === SinglePlayerLevel.입문 ? '입문' :
                             stage.level === SinglePlayerLevel.초급 ? '초급' :
                             stage.level === SinglePlayerLevel.중급 ? '중급' :
                             stage.level === SinglePlayerLevel.고급 ? '고급' : '유단자';
            const botNickname = `${levelName}봇`;
            const botLevel = kataProfileStep * 10;
            
            const aiUser = {
                ...getAiUser(gameMode),
                nickname: botNickname,
                strategyLevel: botLevel,
                playfulLevel: botLevel,
            };
            
            const { board, blackPattern, whitePattern } = generateSinglePlayerBoard(stage);

            // 살리기 바둑 모드 확인 (survivalTurns > 0일 때만 살리기 바둑 모드)
            const isSurvivalMode = stage.survivalTurns !== undefined && stage.survivalTurns > 0;

            // 시간룰 설정: 스피드바둑은 피셔, 비스피드 싱글플레이는 무제한(제한시간/초읽기 없음, 소리 없음)
            const enforcedMainTimeMinutes = isSpeedMode ? (stage.timeControl?.mainTime ?? 5) : 0;
            const enforcedByoyomiTimeSeconds = isSpeedMode ? (stage.timeControl?.byoyomiTime ?? 0) : 0;
            const enforcedByoyomiCount = isSpeedMode ? 0 : 0;
            const enforcedIncrement = isSpeedMode ? (stage.timeControl?.increment ?? 0) : 0;


            const gameId = `sp-game-${randomUUID()}`;
            // autoScoringTurns가 있으면 따내기 바둑이 아니므로 captureTarget 설정하지 않음
            const hasAutoScoring = stage.autoScoringTurns !== undefined;
            const baseCaptureTargetBlack = hasAutoScoring ? 999 : (stage.targetScore.black > 0 ? stage.targetScore.black : 999);
            const baseCaptureTargetWhite = hasAutoScoring ? 999 : (stage.targetScore.white > 0 ? stage.targetScore.white : 999);

            const game: LiveGameSession = {
                id: gameId,
                mode: gameMode,
                isSinglePlayer: true,
                gameCategory: 'singleplayer',
                stageId: stage.id,
                isAiGame: true,
                settings: {
                    boardSize: stage.boardSize,
                    komi: 0.5,
                    timeLimit: enforcedMainTimeMinutes,
                    byoyomiTime: enforcedByoyomiTimeSeconds,
                    byoyomiCount: enforcedByoyomiCount,
                    timeIncrement: enforcedIncrement,
                    captureTarget: hasAutoScoring ? undefined : stage.targetScore.black, // autoScoringTurns가 있으면 captureTarget 설정하지 않음
                    aiDifficulty: kataProfileStep, // makeGoAiBotMove 프로필 단계(1~5) → Kata 레벨봇 매핑
                    kataServerLevel,
                    goAiBotLevel: kataProfileStep,
                    survivalTurns: stage.survivalTurns, // 살리기 바둑 모드: AI가 살아남아야 하는 턴 수
                    isSurvivalMode: isSurvivalMode, // 살리기 바둑 모드 플래그
                    hiddenStoneCount: stage.hiddenCount, // 히든바둑: 히든 아이템 개수
                    scanCount: stage.scanCount, // 히든바둑: 스캔 아이템 개수
                    missileCount: stage.missileCount, // 미사일바둑: 미사일 아이템 개수
                    autoScoringTurns: stage.autoScoringTurns, // 자동 계가 턴 수
                    blackTurnLimit: stage.blackTurnLimit, // 따내기 바둑: 흑(유저) 턴 수 제한
                } as any,
                player1: user,
                player2: aiUser,
                blackPlayerId: user.id,
                whitePlayerId: aiUser.id,
                gameStatus: 'pending', // 게임 설명창 표시 후 사용자가 시작하기 버튼을 눌러야 게임 시작
                currentPlayer: Player.Black,
                boardState: board,
                blackPatternStones: blackPattern,
                whitePatternStones: whitePattern,
                moveHistory: [],
                captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
                baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
                hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
                winner: null,
                winReason: null,
                createdAt: now,
                lastMove: null,
                passCount: 0,
                koInfo: null,
                disconnectionCounts: {},
                currentActionButtons: {},
                scores: { [user.id]: 0, [aiUser.id]: 0 },
                round: 1,
                turnInRound: 1,
                blackTimeLeft: enforcedMainTimeMinutes * 60,
                whiteTimeLeft: enforcedMainTimeMinutes * 60,
                blackByoyomiPeriodsLeft: enforcedByoyomiCount,
                whiteByoyomiPeriodsLeft: enforcedByoyomiCount,
                // pending 상태에서는 시간이 흐르지 않음 (게임 시작 시 설정)
                turnStartTime: undefined,
                turnDeadline: undefined,
                effectiveCaptureTargets: {
                    [Player.None]: 0,
                    // autoScoringTurns가 있으면 따내기 바둑이 아니므로 목표점수 없음
                    // 살리기 바둑: 백(봇)이 목표점수를 달성해야 함, 흑(유저)은 목표점수 없음
                    [Player.Black]: hasAutoScoring ? 999 : (isSurvivalMode ? 999 : baseCaptureTargetBlack),
                    // autoScoringTurns가 있으면 따내기 바둑이 아니므로 목표점수 없음
                    // 살리기 바둑: 백(봇)이 목표점수를 달성해야 함 (백의 목표점수는 black 값 사용)
                    [Player.White]: hasAutoScoring ? 999 : (isSurvivalMode ? stage.targetScore.black : baseCaptureTargetWhite),
                },
                // 살리기 바둑: 백의 턴 수 추적
                whiteTurnsPlayed: isSurvivalMode ? 0 : undefined,
                singlePlayerPlacementRefreshesUsed: 0,
                singlePlayerStartActionPointCost: effectiveActionPointCost,
                totalTurns: 0, // 턴 카운팅 초기화
            } as LiveGameSession;

            (game as any).kataCaptureSetupMoves = encodeBoardStateAsKataSetupMovesFromEmpty(board);
            (game as any).kataStrategicOpeningBoardState = cloneBoardStateForKataOpeningSnapshot(board);

            // 히든바둑 초기화 (싱글플레이용). AI 히든돌은 미리 배치하지 않음 — 봇이 턴에 히든 아이템 연출 후 실제로 둠.
            if (gameMode === GameMode.Hidden) {
                const { initializeSinglePlayerHidden } = await import('../modes/singlePlayerHidden.js');
                initializeSinglePlayerHidden(game);
            }
            
            // 미사일바둑 초기화 (싱글플레이용)
            if (gameMode === GameMode.Missile) {
                const { initializeSinglePlayerMissile } = await import('../modes/singlePlayerMissile.js');
                initializeSinglePlayerMissile(game);
            }

            // pending은 기본 save가 스킵되므로 force — 모달 장시간·캐시 정리 후에도 DB에서 복구
            await db.saveGame(game, true);
            const { updateGameCache } = await import('../gameCache.js');
            updateGameCache(game);

            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[START_SINGLE_PLAYER_GAME] Failed to save user ${user.id}:`, err);
            });

            volatileState.userStatuses[user.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id };

            // 게임 생성 후 게임 정보를 먼저 브로드캐스트 (게임 참가자에게만 전송)
            const { broadcastToGameParticipants } = await import('../socket.js');
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
            // 그 다음 사용자 상태 브로드캐스트
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['actionPoints', 'singlePlayerProgress']);

            // 클라이언트가 즉시 게임을 로드할 수 있도록 게임 데이터를 응답에 포함
            const gameCopy = JSON.parse(JSON.stringify(game));
            return { clientResponse: { gameId: game.id, game: gameCopy, updatedUser: user } };
        }
        case 'CONFIRM_SINGLE_PLAYER_GAME_START': {
            const { gameId } = payload;
            console.log(`[handleSinglePlayerAction] CONFIRM_SINGLE_PLAYER_GAME_START received:`, { gameId, userId: user.id });
            
            // 싱글플레이 게임은 메모리 캐시에서 먼저 찾기 (DB에 저장되지 않음)
            const { getCachedGame, updateGameCache } = await import('../gameCache.js');
            let game = await getCachedGame(gameId);
            
            // 캐시에서 못 찾으면 DB에서 찾기 (게임 종료 후 저장된 경우)
            if (!game) {
                game = await db.getLiveGame(gameId);
            }
            
            if (!game || !game.isSinglePlayer || !game.stageId) {
                console.error(`[handleSinglePlayerAction] CONFIRM_SINGLE_PLAYER_GAME_START - Invalid game:`, { gameId, hasGame: !!game, isSinglePlayer: game?.isSinglePlayer, stageId: game?.stageId });
                return { error: 'Invalid single player game.' };
            }
            if (game.gameStatus !== 'pending') {
                console.error(`[handleSinglePlayerAction] CONFIRM_SINGLE_PLAYER_GAME_START - Game not pending:`, { gameId, gameStatus: game.gameStatus });
                return { error: '게임이 이미 시작되었거나 시작할 수 없는 상태입니다.' };
            }
            console.log(`[handleSinglePlayerAction] CONFIRM_SINGLE_PLAYER_GAME_START - Starting game:`, { gameId, currentStatus: game.gameStatus });

            // 게임 상태를 playing으로 변경하고 시간 시작
            const now = Date.now();
            game.gameStatus = 'playing';
            game.turnStartTime = now;
            (game as any).startTime = now;
            (game as any).gameStartTime = now; // 경과 시간은 실제 시작 시점부터 (pending 시 0 표시)
            const isSpeedMode = game.mode === GameMode.Speed;
            
            // 싱글플레이 시간 설정: 비스피드 모드는 무제한(제한시간/초읽기 0, 초읽기 소리 없음)
            const enforcedMainTimeMinutes = isSpeedMode ? (game.settings.timeLimit || 5) : 0;
            const enforcedByoyomiCount = isSpeedMode ? 0 : 0;
            const enforcedByoyomiTimeSeconds = isSpeedMode ? (game.settings.byoyomiTime ?? 0) : 0;
            
            // 스테이지 정보 가져오기 (timeIncrement 설정용)
            const { SINGLE_PLAYER_STAGES } = await import('../../constants/singlePlayerConstants.js');
            const stage = SINGLE_PLAYER_STAGES.find(s => s.id === game.stageId);
            const enforcedIncrement = isSpeedMode && stage ? (stage.timeControl?.increment ?? game.settings.timeIncrement ?? 0) : 0;

            // 비스피드 모드는 무제한(시간/초읽기 소리 없음)
            if (!isSpeedMode) {
                game.settings.timeLimit = 0;
                game.settings.byoyomiCount = 0;
                game.settings.byoyomiTime = 0;
                game.settings.timeIncrement = 0;
            } else {
                game.settings.timeIncrement = enforcedIncrement;
            }

            // 싱글플레이 스피드: 초기 시간 설정 (시간 보너스 floor((180-사용초)/10) 계산을 위해 blackInitialTimeLeft 등 설정)
            // 비스피드: 시간 제한 없음 (제한시간/초읽기 미적용, 결과까지 소요 시간만 표시)
            if (isSpeedMode) {
                const initialSec = enforcedMainTimeMinutes * 60;
                game.blackTimeLeft = initialSec;
                game.whiteTimeLeft = initialSec;
                game.blackInitialTimeLeft = initialSec;
                game.whiteInitialTimeLeft = initialSec;
                game.turnDeadline = now + initialSec * 1000;
            } else {
                game.turnDeadline = undefined;
                game.blackTimeLeft = 0;
                game.whiteTimeLeft = 0;
            }
            game.blackByoyomiPeriodsLeft = 0;
            game.whiteByoyomiPeriodsLeft = 0;

            // playing 전환 직후 한 번 강제 저장 — 이후 수순은 기존처럼 메모리 위주
            await db.saveGame(game, true);
            updateGameCache(game);
            const { broadcastToGameParticipants } = await import('../socket.js');
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);

            // `user`는 /api/action의 getCachedUser 사본 — ADVANCE_ONBOARDING 직후 비동기 저장 타이밍 등으로 phase가 낡을 수 있음
            const persistedForOnboarding = await db.getUser(user.id);
            const ob = persistedForOnboarding?.onboardingTutorialPhase ?? user.onboardingTutorialPhase;
            let updatedUserForClient: typeof user | undefined;
            if (typeof ob === 'number' && ob === 5 && ob < ONBOARDING_PHASE_COMPLETE) {
                user.onboardingTutorialPhase = 6;
                await db.updateUser(user);
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['onboardingTutorialPhase']);
                // HTTP 응답에 반영 — 클라이언트가 USER_UPDATE 디바운스로 페이즈 6을 놓치는 경우 인게임 튜토리얼이 뜨지 않음
                updatedUserForClient = user;
            }

            console.log(`[handleSinglePlayerAction] CONFIRM_SINGLE_PLAYER_GAME_START - Game started successfully:`, { gameId: game.id, gameStatus: game.gameStatus });
            const gameCopy = JSON.parse(JSON.stringify(game));
            return {
                clientResponse: {
                    success: true,
                    gameId: game.id,
                    game: gameCopy,
                    ...(updatedUserForClient ? { updatedUser: updatedUserForClient } : {}),
                },
            };
        }
        case 'SINGLE_PLAYER_REFRESH_PLACEMENT': {
            console.log(`[handleSinglePlayerAction] SINGLE_PLAYER_REFRESH_PLACEMENT: gameId=${payload.gameId}`);
            const { gameId } = payload;
            // 싱글플레이 게임은 메모리 캐시에서 먼저 찾기
            const { getCachedGame, updateGameCache } = await import('../gameCache.js');
            let game = await getCachedGame(gameId);
            if (!game) {
                game = await db.getLiveGame(gameId);
            }
            if (!game || !game.isSinglePlayer || !game.stageId) {
                console.log(`[handleSinglePlayerAction] SINGLE_PLAYER_REFRESH_PLACEMENT: Invalid game`);
                return { error: 'Invalid single player game.' };
            }
            // 계가 중일 때는 게임 상태를 초기화하지 않음
            if (game.gameStatus === 'scoring' || (game as any).isScoringProtected) {
                return { error: '계가 진행 중입니다. 게임 상태를 변경할 수 없습니다.' };
            }
            // pending 상태에서는 배치 새로고침 불가 (게임이 시작되지 않음)
            if (game.gameStatus === 'pending') {
                return { error: '게임이 시작되지 않았습니다.' };
            }
            if (game.gameStatus !== 'playing' || game.currentPlayer !== Player.Black || (game.moveHistory && game.moveHistory.length > 0)) {
                console.log(`[handleSinglePlayerAction] SINGLE_PLAYER_REFRESH_PLACEMENT: Invalid state - gameStatus=${game.gameStatus}, currentPlayer=${game.currentPlayer}, moveHistory.length=${game.moveHistory?.length || 0}`);
                return { error: '배치는 첫 수 전에만 새로고침할 수 있습니다.' };
            }

            const refreshesUsed = game.singlePlayerPlacementRefreshesUsed || 0;
            if (refreshesUsed >= 5) {
                return { error: '새로고침 횟수를 모두 사용했습니다.' };
            }

            const costs = [0, 50, 75, 100, 200];
            const cost = costs[refreshesUsed];

            if (user.gold < cost && !user.isAdmin) {
                return { error: `골드가 부족합니다. (필요: ${cost})` };
            }
            
            if (!user.isAdmin) {
                user.gold -= cost;
            }
            game.singlePlayerPlacementRefreshesUsed = refreshesUsed + 1;

            const stage = SINGLE_PLAYER_STAGES.find(s => s.id === game.stageId);
            if (!stage) {
                return { error: 'Stage data not found for refresh.' };
            }

            const { board, blackPattern, whitePattern } = generateSinglePlayerBoard(stage);
            game.boardState = board;
            game.blackPatternStones = blackPattern;
            game.whitePatternStones = whitePattern;
            (game as any).kataCaptureSetupMoves = encodeBoardStateAsKataSetupMovesFromEmpty(board);
            (game as any).kataStrategicOpeningBoardState = cloneBoardStateForKataOpeningSnapshot(board);

            // 캐시 업데이트
            updateGameCache(game);
            
            // 재화 차감 반영을 위해 사용자 저장 후 게임 저장
            await db.updateUser(user);
            await db.saveGame(game);

            const { broadcastToGameParticipants } = await import('../socket.js');
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);

            console.log(`[handleSinglePlayerAction] SINGLE_PLAYER_REFRESH_PLACEMENT: Success - refreshesUsed=${game.singlePlayerPlacementRefreshesUsed}`);
            return { clientResponse: { updatedUser: user, game } };
        }
        case 'START_SINGLE_PLAYER_MISSION': {
            const spMissionGate = await requireArenaEntranceOpen(user.isAdmin, 'singleplayer', user);
            if (!spMissionGate.ok) return { error: spMissionGate.error };
            const { missionId } = payload;
            const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);
            if (!missionInfo) return { error: '미션을 찾을 수 없습니다.' };

            if (!user.singlePlayerMissions) user.singlePlayerMissions = {};
            if (user.singlePlayerMissions[missionId]?.isStarted) return { error: '이미 시작된 미션입니다.' };

            const unlockStageIndex = SINGLE_PLAYER_STAGES.findIndex(s => s.id === missionInfo.unlockStageId);
            // unlockStageIndex is 0-based; user.singlePlayerProgress tracks highest cleared index (0-based).
            if ((user.singlePlayerProgress ?? -1) < unlockStageIndex) return { error: '미션이 아직 잠겨있습니다.' };

            // 레벨 1로 시작
            const level1Info = missionInfo.levels[0];
            const initialAmount = 0;

            user.singlePlayerMissions[missionId] = {
                id: missionId,
                isStarted: true,
                level: 1,
                lastCollectionTime: now,
                accumulatedAmount: initialAmount,
                accumulatedCollection: 0,
            };
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[START_SINGLE_PLAYER_MISSION] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['singlePlayerMissions']);
            
            return { clientResponse: { updatedUser: user } };
        }
        case 'CLAIM_SINGLE_PLAYER_MISSION_REWARD': {
            if (!payload || typeof payload !== 'object') {
                return { error: 'Invalid payload.' };
            }
            
            const { missionId } = payload;
            if (!missionId || typeof missionId !== 'string') {
                return { error: '미션 ID가 필요합니다.' };
            }
            
            const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);
            if (!missionInfo) {
                return { error: `미션을 찾을 수 없습니다. (ID: ${missionId})` };
            }
        
            if (!user.singlePlayerMissions) {
                user.singlePlayerMissions = {};
            }
            
            const missionState = user.singlePlayerMissions[missionId];
            if (!missionState) {
                return { error: '미션이 시작되지 않았습니다.' };
            }
            
            if (!missionState.isStarted) {
                return { error: '미션이 시작되지 않았습니다.' };
            }
            
            const currentLevel = missionState.level || 1;
            if (!missionInfo.levels || !Array.isArray(missionInfo.levels) || missionInfo.levels.length < currentLevel) {
                return { error: '레벨 정보를 찾을 수 없습니다.' };
            }
            
            const levelInfo = missionInfo.levels[currentLevel - 1];
            if (!levelInfo) {
                return { error: `레벨 정보를 찾을 수 없습니다. (레벨: ${currentLevel})` };
            }
        
            // 미션 상태 초기화 (없는 필드 보완)
            let missionAccumulated = missionState.accumulatedAmount;
            if (typeof missionAccumulated !== 'number') {
                const parsed = Number(missionAccumulated);
                missionAccumulated = Number.isFinite(parsed) ? parsed : 0;
            }
            let lastCollectionTime = missionState.lastCollectionTime;
            if (!lastCollectionTime || typeof lastCollectionTime !== 'number') {
                const parsed = Number(lastCollectionTime);
                lastCollectionTime = Number.isFinite(parsed) ? parsed : now;
            }

            const productionIntervalMs = levelInfo.productionRateMinutes * 60 * 1000;
            const baseAccumulated = missionAccumulated || 0;
            let generatedAmount = 0;
            let remainderMs = 0;

            if (productionIntervalMs > 0) {
                const elapsedMs = Math.max(0, now - lastCollectionTime);
                const cycles = Math.floor(elapsedMs / productionIntervalMs);
                generatedAmount = cycles * levelInfo.rewardAmount;
                remainderMs = elapsedMs % productionIntervalMs;
            }

            const availableAmount = Math.min(levelInfo.maxCapacity, baseAccumulated + generatedAmount);
        
            if (availableAmount < 1) {
                return { error: '수령할 보상이 없습니다.' };
            }
        
            // 보상 지급 전 값 저장 (모달 표시용)
            const rewardAmount = availableAmount;
            const rewardType = missionInfo.rewardType;
            const rewardConfig = await getRewardConfig();
            const adjustedRewardAmount =
                rewardType === 'gold'
                    ? addRewardBonus(rewardAmount, rewardConfig.singleMissionGoldBonus)
                    : addRewardBonus(rewardAmount, rewardConfig.singleMissionDiamondBonus);
        
            if (rewardType === 'gold') {
                user.gold += adjustedRewardAmount;
            } else {
                user.diamonds += adjustedRewardAmount;
            }
        
            // 누적 수령액 증가 (레벨업용)
            const currentAccumulatedCollection = typeof missionState.accumulatedCollection === 'number'
                ? missionState.accumulatedCollection
                : Number(missionState.accumulatedCollection) || 0;
            missionState.accumulatedCollection = currentAccumulatedCollection + adjustedRewardAmount;
            missionState.accumulatedAmount = 0;
            missionState.lastCollectionTime = productionIntervalMs > 0 ? now - remainderMs : now;
            if (productionIntervalMs > 0 && availableAmount >= levelInfo.maxCapacity) {
                missionState.lastCollectionTime = now;
            }

            updateQuestProgress(user, 'training_quest_claim', undefined, 1);
        
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[COLLECT_SINGLE_PLAYER_MISSION] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['singlePlayerMissions']);
            
            // 깊은 복사로 updatedUser 생성하여 React가 변경을 확실히 감지하도록 함
            const updatedUser = JSON.parse(JSON.stringify(user));
            
            // 보상 정보를 클라이언트에 반환 (RewardSummaryModal 형식)
            const rewardSummary = {
                reward: {
                        [rewardType]: adjustedRewardAmount
                } as { gold?: number; diamonds?: number; actionPoints?: number },
                items: [],
                title: `${missionInfo.name} 보상 수령`
            };
            
            return { 
                clientResponse: { 
                    updatedUser,
                    reward: {
                        [rewardType]: adjustedRewardAmount
                    },
                    rewardSummary
                } 
            };
        }
        case 'CLAIM_ALL_TRAINING_QUEST_REWARDS': {
            if (!user.singlePlayerMissions) {
                user.singlePlayerMissions = {};
            }
            
            const rewards: Array<{
                missionId: string;
                missionName: string;
                missionLevel: number;
                rewardType: 'gold' | 'diamonds';
                rewardAmount: number;
            }> = [];
            let totalGold = 0;
            let totalDiamonds = 0;
            const rewardConfig = await getRewardConfig();
            
            // 이미 시작된 미션만 처리 (시작 시점에 이미 언락 검사 통과했으므로 clearedStages 재검사 생략)
            for (const missionInfo of SINGLE_PLAYER_MISSIONS) {
                const missionState = user.singlePlayerMissions[missionInfo.id];
                if (!missionState || !missionState.isStarted) continue;
                
                const currentLevel = missionState.level || 1;
                if (!missionInfo.levels || !Array.isArray(missionInfo.levels) || missionInfo.levels.length < currentLevel) continue;
                
                const levelInfo = missionInfo.levels[currentLevel - 1];
                if (!levelInfo) continue;
                
                // 미션 상태 초기화
                let missionAccumulated = missionState.accumulatedAmount;
                if (typeof missionAccumulated !== 'number') {
                    const parsed = Number(missionAccumulated);
                    missionAccumulated = Number.isFinite(parsed) ? parsed : 0;
                }
                let lastCollectionTime = missionState.lastCollectionTime;
                if (!lastCollectionTime || typeof lastCollectionTime !== 'number') {
                    const parsed = Number(lastCollectionTime);
                    lastCollectionTime = Number.isFinite(parsed) ? parsed : now;
                }
                
                const productionIntervalMs = levelInfo.productionRateMinutes * 60 * 1000;
                const baseAccumulated = missionAccumulated || 0;
                let generatedAmount = 0;
                let remainderMs = 0;
                
                if (productionIntervalMs > 0) {
                    const elapsedMs = Math.max(0, now - lastCollectionTime);
                    const cycles = Math.floor(elapsedMs / productionIntervalMs);
                    generatedAmount = cycles * levelInfo.rewardAmount;
                    remainderMs = elapsedMs % productionIntervalMs;
                }
                
                const availableAmount = Math.min(levelInfo.maxCapacity, baseAccumulated + generatedAmount);
                
                if (availableAmount < 1) continue;
                
                // 보상 추가
                const rewardType = missionInfo.rewardType;
                const adjustedAmount =
                    rewardType === 'gold'
                        ? addRewardBonus(availableAmount, rewardConfig.singleMissionGoldBonus)
                        : addRewardBonus(availableAmount, rewardConfig.singleMissionDiamondBonus);
                if (rewardType === 'gold') {
                    user.gold += adjustedAmount;
                    totalGold += adjustedAmount;
                } else {
                    user.diamonds += adjustedAmount;
                    totalDiamonds += adjustedAmount;
                }
                
                rewards.push({
                    missionId: missionInfo.id,
                    missionName: missionInfo.name,
                    missionLevel: currentLevel,
                    rewardType,
                    rewardAmount: adjustedAmount
                });
                
                // 누적 수령액 증가 (레벨업용)
                const currentAccumulatedCollection = typeof missionState.accumulatedCollection === 'number'
                    ? missionState.accumulatedCollection
                    : Number(missionState.accumulatedCollection) || 0;
                missionState.accumulatedCollection = currentAccumulatedCollection + adjustedAmount;
                missionState.accumulatedAmount = 0;
                missionState.lastCollectionTime = productionIntervalMs > 0 ? now - remainderMs : now;
                if (productionIntervalMs > 0 && availableAmount >= levelInfo.maxCapacity) {
                    missionState.lastCollectionTime = now;
                }
            }
            
            // 수령할 보상이 없어도 200 + 빈 보상으로 응답 (클라이언트 오류 방지)
            const { getSelectiveUserUpdate } = await import('../utils/userUpdateHelper.js');
            const updatedUser = getSelectiveUserUpdate(user, 'CLAIM_SINGLE_PLAYER_MISSION_REWARD');
            
            if (rewards.length > 0) {
                updateQuestProgress(user, 'training_quest_claim', undefined, rewards.length);
                db.updateUser(user).catch(err => {
                    console.error(`[CLAIM_ALL_TRAINING_QUEST_REWARDS] Failed to save user ${user.id}:`, err);
                });
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['gold', 'diamonds', 'singlePlayerMissions']);
            }
            
            return {
                clientResponse: {
                    updatedUser,
                    claimAllTrainingQuestRewards: {
                        rewards,
                        totalGold,
                        totalDiamonds
                    }
                }
            };
        }
        case 'LEVEL_UP_TRAINING_QUEST': {
            if (!payload || typeof payload !== 'object') {
                console.error('[LEVEL_UP_TRAINING_QUEST] Invalid payload:', payload);
                return { error: 'Invalid payload.' };
            }
            
            const { missionId } = payload;
            if (!missionId || typeof missionId !== 'string') {
                console.error('[LEVEL_UP_TRAINING_QUEST] Missing missionId:', { payload, missionId });
                return { error: '미션 ID가 필요합니다.' };
            }
            
            const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);
            if (!missionInfo) {
                console.error('[LEVEL_UP_TRAINING_QUEST] Mission not found:', missionId);
                return { error: '미션을 찾을 수 없습니다.' };
            }
        
            // singlePlayerMissions 초기화 확인
            if (!user.singlePlayerMissions) {
                user.singlePlayerMissions = {};
            }
            
            const missionState = user.singlePlayerMissions[missionId];
            if (!missionState || !missionState.isStarted) {
                console.error('[LEVEL_UP_TRAINING_QUEST] Mission not started:', { 
                    missionId, 
                    hasMissionState: !!missionState,
                    isStarted: missionState?.isStarted 
                });
                return { error: '미션이 시작되지 않았습니다.' };
            }
            
            const currentLevel = missionState.level ?? 0;
            if (currentLevel >= 10) return { error: '이미 최대 레벨입니다.' };
            
            // levels 배열 확인
            if (!missionInfo.levels || !Array.isArray(missionInfo.levels) || missionInfo.levels.length === 0) {
                console.error('[LEVEL_UP_TRAINING_QUEST] Invalid levels array:', missionInfo.levels);
                return { error: '레벨 정보가 올바르지 않습니다.' };
            }
            
            // 다음 레벨 정보 가져오기
            if (currentLevel >= missionInfo.levels.length) {
                console.error('[LEVEL_UP_TRAINING_QUEST] Current level exceeds available levels:', { 
                    currentLevel, 
                    availableLevels: missionInfo.levels.length 
                });
                return { error: '최대 레벨에 도달했습니다.' };
            }
            
            const nextLevelInfo = missionInfo.levels[currentLevel];
            if (!nextLevelInfo) {
                console.error('[LEVEL_UP_TRAINING_QUEST] Next level info not found:', { currentLevel, levelsLength: missionInfo.levels.length });
                return { error: '다음 레벨 정보를 찾을 수 없습니다.' };
            }
            
            // 레벨 0일 때는 현재 레벨 정보가 없으므로 다음 레벨 정보를 사용
            const currentLevelInfo = currentLevel > 0 ? missionInfo.levels[currentLevel - 1] : null;
            
            // 다음 레벨 오픈조건 확인
            if (nextLevelInfo.unlockStageId) {
                // clearedSinglePlayerStages가 배열인지 확인
                let clearedStages: string[] = [];
                if (Array.isArray(user.clearedSinglePlayerStages)) {
                    clearedStages = user.clearedSinglePlayerStages;
                } else if (user.clearedSinglePlayerStages) {
                    // 배열이 아니면 빈 배열로 초기화
                    clearedStages = [];
                }
                
                if (!clearedStages.includes(nextLevelInfo.unlockStageId)) {
                    return { error: `${nextLevelInfo.unlockStageId} 스테이지를 클리어해야 합니다.` };
                }
            }
            
            // 누적 수령액 확인 (레벨 0에서 레벨 1로 올릴 때는 수집 요구사항 없음)
            const requiredCollection = currentLevel === 0 ? 0 : (currentLevelInfo ? currentLevelInfo.maxCapacity * currentLevel * 10 : 0);
            const accumulatedCollection = missionState.accumulatedCollection || 0;
            
            if (accumulatedCollection < requiredCollection) {
                return { error: `누적 수령액이 부족합니다. (필요: ${requiredCollection}, 현재: ${accumulatedCollection})` };
            }
            
            // 레벨업 비용 계산 및 차감 (레벨 0일 때는 다음 레벨의 maxCapacity 사용)
            const costBaseCapacity = currentLevelInfo ? currentLevelInfo.maxCapacity : nextLevelInfo.maxCapacity;
            let upgradeCost: number;
            if (missionInfo.rewardType === 'gold') {
                upgradeCost = costBaseCapacity * 5;
            } else {
                upgradeCost = costBaseCapacity * 1000;
            }
            
            if (missionInfo.rewardType === 'gold') {
                if (user.gold < upgradeCost && !user.isAdmin) {
                    return { error: `골드가 부족합니다. (필요: ${upgradeCost})` };
                }
                if (!user.isAdmin) {
                    user.gold -= upgradeCost;
                }
            } else {
                // 다이아는 골드로 결제
                if (user.gold < upgradeCost && !user.isAdmin) {
                    return { error: `골드가 부족합니다. (필요: ${upgradeCost})` };
                }
                if (!user.isAdmin) {
                    user.gold -= upgradeCost;
                }
            }
            
            // 레벨업 전 상태 저장 (피드백용)
            const previousLevel = currentLevel;
            const previousAccumulatedAmount = missionState.accumulatedAmount || 0;
            
            // 레벨업
            missionState.level = currentLevel + 1;
            missionState.accumulatedCollection = 0; // 누적 수령액 초기화 (경험치용)
            
            // 새 레벨 정보 가져오기
            const newLevelInfo = missionInfo.levels[missionState.level - 1];
            if (newLevelInfo) {
                // 수령하지 않은 재화는 유지 (새 레벨의 최대 생산량을 초과하지 않도록 제한)
                // 강화 시에는 기존 재화만 유지하고, 새로운 초기 생산량은 추가하지 않음
                const preservedAmount = Math.min(previousAccumulatedAmount, newLevelInfo.maxCapacity);
                missionState.accumulatedAmount = preservedAmount;
                
                // 재화가 유지된 경우 lastCollectionTime도 유지, 새로 시작하는 경우만 업데이트
                if (preservedAmount === 0) {
                    missionState.lastCollectionTime = now;
                }
            }
        
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[UPGRADE_SINGLE_PLAYER_MISSION] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['singlePlayerMissions', 'gold', 'diamonds']);
            
            // 강화 완료 정보 반환
            return { 
                clientResponse: { 
                    updatedUser: user,
                    trainingQuestLevelUp: {
                        missionId,
                        previousLevel,
                        newLevel: missionState.level,
                        missionName: missionInfo.name,
                        preservedAmount: missionState.accumulatedAmount
                    }
                } 
            };
        }
        // 싱글플레이 미사일 액션 처리
        case 'START_MISSILE_SELECTION':
        case 'LAUNCH_MISSILE':
        case 'CANCEL_MISSILE_SELECTION':
        case 'MISSILE_INVALID_SELECTION':
        case 'MISSILE_ANIMATION_COMPLETE': {
            const { gameId } = payload;
            if (!gameId) {
                return { error: 'Game ID is required.' };
            }
            // 싱글플레이 게임은 메모리 캐시에서 먼저 찾기
            const { getCachedGame } = await import('../gameCache.js');
            let game = await getCachedGame(gameId);
            if (!game) {
                game = await db.getLiveGame(gameId);
            }
            if (!game || !game.isSinglePlayer) {
                return { error: 'Invalid single player game.' };
            }
            const { handleSinglePlayerMissileAction } = await import('../modes/singlePlayerMissile.js');
            const result = await handleSinglePlayerMissileAction(game, action, user);
            
            // handleSinglePlayerMissileAction이 null을 반환하는 경우
            if (result === null) {
                return { error: 'Invalid single player game.' };
            }
            
            // result가 undefined인 경우 빈 객체 반환
            if (result === undefined) {
                return {};
            }
            
            // 게임 상태가 변경되었을 수 있으므로 저장 및 브로드캐스트
            if (!result.error) {
                // 게임 캐시 업데이트 (다음 미사일 아이템 사용 시 게임을 찾을 수 있도록)
                const { updateGameCache } = await import('../gameCache.js');
                updateGameCache(game);
                await db.saveGame(game);
                const { broadcastToGameParticipants } = await import('../socket.js');
                broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
            }
            
            return result;
        }
        // 싱글플레이 히든바둑 액션 처리
        case 'START_HIDDEN_PLACEMENT':
        case 'START_SCANNING':
        case 'SCAN_BOARD': {
            console.log(`[handleSinglePlayerAction] ${type} action received, payload:`, payload);
            const { gameId } = payload;
            if (!gameId) {
                console.error(`[handleSinglePlayerAction] ${type}: Game ID is required`);
                return { error: 'Game ID is required.' };
            }
            // 싱글플레이 게임은 메모리 캐시에서 먼저 찾기
            const { getCachedGame } = await import('../gameCache.js');
            let game = await getCachedGame(gameId);
            if (!game) {
                console.log(`[handleSinglePlayerAction] ${type}: Game not in cache, fetching from DB`);
                game = await db.getLiveGame(gameId);
            }
            if (!game) {
                console.error(`[handleSinglePlayerAction] ${type}: Game not found in cache or DB, gameId=${gameId}`);
                return { error: 'Game not found.' };
            }
            if (!game.isSinglePlayer) {
                console.error(`[handleSinglePlayerAction] ${type}: Game is not single player, gameId=${gameId}, isSinglePlayer=${game.isSinglePlayer}`);
                return { error: 'Invalid single player game.' };
            }
            console.log(`[handleSinglePlayerAction] ${type}: Game found, gameStatus=${game.gameStatus}, currentPlayer=${game.currentPlayer}`);
            const { applyPveItemActionClientSync } = await import('../pveItemSync.js');
            applyPveItemActionClientSync(game, payload);
            const { handleSinglePlayerHiddenAction } = await import('../modes/singlePlayerHidden.js');
            console.log(`[handleSinglePlayerAction] Before handleSinglePlayerHiddenAction: gameStatus=${game.gameStatus}, type=${type}`);
            const result = handleSinglePlayerHiddenAction(volatileState, game, action, user);
            console.log(`[handleSinglePlayerAction] After handleSinglePlayerHiddenAction: result=`, result, `gameStatus=${game.gameStatus}`);
            
            // handleSinglePlayerHiddenAction이 null을 반환하는 경우 (게임이 싱글플레이가 아닌 경우)
            if (result === null) {
                console.log(`[handleSinglePlayerAction] handleSinglePlayerHiddenAction returned null, returning error`);
                return { error: 'Invalid single player game.' };
            }
            
            // 게임 상태가 변경되었을 수 있으므로 저장 및 브로드캐스트
            if (result !== undefined && !result.error) {
                console.log(`[handleSinglePlayerAction] Saving and broadcasting game update: gameStatus=${game.gameStatus}`);
                const { updateGameCache } = await import('../gameCache.js');
                updateGameCache(game);
                await db.saveGame(game);
                const { broadcastToGameParticipants } = await import('../socket.js');
                broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                console.log(`[handleSinglePlayerAction] Game saved and broadcasted: gameStatus=${game.gameStatus}`);
                // 스캔/히든 배치 모드 전환 또는 스캔 보드 클릭 시 클라이언트가 HTTP 응답으로 즉시 반영할 수 있도록 game 반환
                if (type === 'START_SCANNING' || type === 'START_HIDDEN_PLACEMENT' || type === 'SCAN_BOARD') {
                    return { clientResponse: { gameId: game.id, game } };
                }
            } else {
                console.log(`[handleSinglePlayerAction] Not saving/broadcasting: result=`, result);
            }
            
            // result가 undefined인 경우 빈 객체 반환 (타입 안전성 보장)
            if (result === undefined) {
                return {};
            }
            return result;
        }
        default:
            return { error: 'Unknown single player action' };
    }
};