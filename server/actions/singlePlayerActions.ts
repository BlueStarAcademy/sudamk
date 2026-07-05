import { randomUUID } from 'crypto';
import * as db from '../db.js';
import { type ServerAction, type User, type VolatileState, LiveGameSession, Player, GameMode, Point, BoardState, SinglePlayerStageInfo, SinglePlayerMissionState, UserStatus, SinglePlayerLevel } from '../../types/index.js';
import { SINGLE_PLAYER_MISSIONS, SINGLE_PLAYER_CLASS_BAR_REWARDS } from '../../shared/constants/singlePlayerConstants.js';
import { addItemsToInventory, createItemInstancesFromReward } from '../../utils/inventoryUtils.js';
import { aiUserId, getAiUser } from '../aiPlayer.js';
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
import { DEFAULT_REWARD_CONFIG, normalizeRewardConfig } from '../../shared/constants/rewardConfig.js';
import { updateQuestProgress } from '../questService.js';
import {
    getEffectiveSinglePlayerStages,
    resolveSinglePlayerStageKataServerLevel,
} from '../singlePlayerStageConfigService.js';
import {
    resolveSinglePlayerHasAutoScoringTurns,
    resolveSinglePlayerMixedModes,
    resolveSinglePlayerSpeedTimeMode,
    resolveSinglePlayerStrategicGameMode,
    resolveSinglePlayerSurvivalMode,
    resolveSinglePlayerSurvivalTurnCount,
} from '../../shared/utils/singlePlayerStrategicRulePreset.js';
import {
    isSinglePlayerStageCleared,
    isSinglePlayerStageUnlocked,
    reconcileSinglePlayerProgress,
} from '../../shared/utils/singlePlayerProgress.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';

type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
};

const isSinglePlayerSession = (game: LiveGameSession | null | undefined): game is LiveGameSession =>
    Boolean(game && resolveArenaSessionPolicy(game).kind === 'singleplayer');

const getRewardConfig = async () => {
    const stored = await db.getKV<unknown>('rewardConfig');
    return normalizeRewardConfig(stored ?? DEFAULT_REWARD_CONFIG);
};

const addRewardBonus = (value: number | undefined, bonus: number): number => {
    const base = Number(value) || 0;
    const add = Number(bonus) || 0;
    return Math.max(0, Math.floor(base + add));
};

type TrainingQuestBulkRewardRow = {
    missionId: string;
    missionName: string;
    missionLevel: number;
    rewardType: 'gold' | 'diamonds';
    rewardAmount: number;
    rawAvailableAmount: number;
    remainderMs: number;
    productionIntervalMs: number;
    maxCapacity: number;
};

async function buildTrainingQuestBulkRewardPreview(
    user: User,
    now: number,
): Promise<{
    rewards: TrainingQuestBulkRewardRow[];
    totalGold: number;
    totalDiamonds: number;
}> {
    if (!user.singlePlayerMissions) user.singlePlayerMissions = {};
    const rewards: TrainingQuestBulkRewardRow[] = [];
    let totalGold = 0;
    let totalDiamonds = 0;
    const rewardConfig = await getRewardConfig();

    for (const missionInfo of SINGLE_PLAYER_MISSIONS) {
        const missionState = user.singlePlayerMissions[missionInfo.id];
        if (!missionState || !missionState.isStarted) continue;

        const currentLevel = missionState.level || 1;
        if (!missionInfo.levels || !Array.isArray(missionInfo.levels) || missionInfo.levels.length < currentLevel) continue;

        const levelInfo = missionInfo.levels[currentLevel - 1];
        if (!levelInfo) continue;

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

        const rewardType = missionInfo.rewardType;
        const adjustedAmount =
            rewardType === 'gold'
                ? addRewardBonus(availableAmount, rewardConfig.singleMissionGoldBonus)
                : addRewardBonus(availableAmount, rewardConfig.singleMissionDiamondBonus);
        if (rewardType === 'gold') totalGold += adjustedAmount;
        else totalDiamonds += adjustedAmount;

        rewards.push({
            missionId: missionInfo.id,
            missionName: missionInfo.name,
            missionLevel: currentLevel,
            rewardType,
            rewardAmount: adjustedAmount,
            rawAvailableAmount: availableAmount,
            remainderMs,
            productionIntervalMs,
            maxCapacity: levelInfo.maxCapacity,
        });
    }

    return { rewards, totalGold, totalDiamonds };
}

const getSinglePlayerRuleFlags = (gameMode: GameMode, mixModes: GameMode[]) => ({
    hasHidden: gameMode === GameMode.Hidden || (gameMode === GameMode.Mix && mixModes.includes(GameMode.Hidden)),
    hasMissile: gameMode === GameMode.Missile || (gameMode === GameMode.Mix && mixModes.includes(GameMode.Missile)),
    hasBase: gameMode === GameMode.Base || (gameMode === GameMode.Mix && mixModes.includes(GameMode.Base)),
});

/**
 * 반(난이도 구간)별 프로필 단계 1~5 (봇 표시 레벨·aiDifficulty 등, 스테이지 구간 내 동일).
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

/** 싱글플레이 AI 봇 표시 레벨: 스테이지 번호(1~20)에 맞춰 변동 */
const getSinglePlayerBotDisplayLevelFromStage = (stage: SinglePlayerStageInfo): number => {
    const trailing = String(stage.id).split('-').pop();
    const parsed = trailing ? parseInt(trailing, 10) : NaN;
    if (Number.isFinite(parsed) && parsed >= 1) {
        return Math.max(1, Math.min(20, parsed));
    }
    return 1;
};

/** 싱글플레이 AI 봇 표시 닉네임: 입문봇 / 초급봇 / 중급봇 / 고급봇 / 유단자봇 */
const getSinglePlayerBotNicknameFromStage = (stage: SinglePlayerStageInfo): string => {
    const levelName = stage.level === SinglePlayerLevel.입문 ? '입문' :
                      stage.level === SinglePlayerLevel.초급 ? '초급' :
                      stage.level === SinglePlayerLevel.중급 ? '중급' :
                      stage.level === SinglePlayerLevel.고급 ? '고급' : '유단자';
    return `${levelName}봇`;
};

const generateSinglePlayerBoard = (stage: SinglePlayerStageInfo): { board: BoardState, blackPattern: Point[], whitePattern: Point[] } => {
    if (stage.fixedOpening?.length) {
        const bs = stage.boardSize;
        const board: BoardState = Array(bs)
            .fill(null)
            .map(() => Array(bs).fill(Player.None));
        const fixedBlackPattern: Point[] = [];
        const fixedWhitePattern: Point[] = [];
        for (const s of stage.fixedOpening) {
            if (s.x >= 0 && s.x < bs && s.y >= 0 && s.y < bs) {
                board[s.y][s.x] = s.color === 'black' ? Player.Black : Player.White;
                if (s.kind === 'pattern') {
                    if (s.color === 'black') fixedBlackPattern.push({ x: s.x, y: s.y });
                    else fixedWhitePattern.push({ x: s.x, y: s.y });
                }
            }
        }
        if (!stage.mergeRandomPlacementsWithFixed) {
            return { board, blackPattern: fixedBlackPattern, whitePattern: fixedWhitePattern };
        }

        const center = Math.floor(stage.boardSize / 2);
        const whitePlain = Math.max(0, stage.placements.white);
        let baseBoard: BoardState | undefined = board;

        if (
            stage.placements.centerBlackStoneChance !== undefined &&
            stage.placements.centerBlackStoneChance > 0 &&
            board[center]?.[center] === Player.None &&
            Math.random() * 100 < stage.placements.centerBlackStoneChance
        ) {
            const template = Array(stage.boardSize).fill(null).map(() => Array(stage.boardSize).fill(Player.None));
            for (let y = 0; y < stage.boardSize; y++) {
                for (let x = 0; x < stage.boardSize; x++) {
                    template[y][x] = board[y][x];
                }
            }
            if (!isInvalidStrategicInitialStonePlacement(template, center, center, Player.Black)) {
                template[center][center] = Player.Black;
                baseBoard = template;
            }
        }

        const generated = generateStrategicRandomBoard(
            stage.boardSize,
            {
                black: stage.placements.black,
                white: whitePlain,
                blackPattern: stage.placements.blackPattern,
                whitePattern: stage.placements.whitePattern,
            },
            { baseBoard, maxAttempts: 40 }
        );

        return {
            board: generated.board,
            blackPattern: [...fixedBlackPattern, ...generated.blackPattern],
            whitePattern: [...fixedWhitePattern, ...generated.whitePattern],
        };
    }

    const center = Math.floor(stage.boardSize / 2);
    const whitePlain = Math.max(0, stage.placements.white);
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
        }
    }

    return generateStrategicRandomBoard(
        stage.boardSize,
        {
            black: stage.placements.black,
            white: whitePlain,
            blackPattern: stage.placements.blackPattern,
            whitePattern: stage.placements.whitePattern,
        },
        { baseBoard, maxAttempts: 40 }
    );
};

const applyLatestPendingSinglePlayerStage = async (
    game: LiveGameSession,
    stage: SinglePlayerStageInfo,
    options?: { preserveExistingPlacement?: boolean }
): Promise<void> => {
    const gameMode: GameMode = resolveSinglePlayerStrategicGameMode(stage);
    const mixModes = gameMode === GameMode.Mix ? resolveSinglePlayerMixedModes(stage) : [];
    const ruleFlags = getSinglePlayerRuleFlags(gameMode, mixModes);
    const isCaptureGoalMode = gameMode === GameMode.Capture || (gameMode === GameMode.Mix && mixModes.includes(GameMode.Capture));
    const isSpeedMode = resolveSinglePlayerSpeedTimeMode(stage);
    const isSurvivalMode = resolveSinglePlayerSurvivalMode(stage);
    const survivalTurnsResolved = isSurvivalMode ? resolveSinglePlayerSurvivalTurnCount(stage) : undefined;
    const hasAutoScoring = resolveSinglePlayerHasAutoScoringTurns(stage);
    const kataProfileStep = getSinglePlayerKataProfileStep(stage.level);
    const kataServerLevel = resolveSinglePlayerStageKataServerLevel(stage);
    const preserveExistingPlacement =
        options?.preserveExistingPlacement === true &&
        Array.isArray(game.boardState) &&
        game.boardState.length === stage.boardSize &&
        (game.moveHistory?.length ?? 0) === 0;
    const emptyBaseBoard = (): { board: BoardState; blackPattern: Point[]; whitePattern: Point[] } => ({
        board: Array(stage.boardSize)
            .fill(null)
            .map(() => Array(stage.boardSize).fill(Player.None)),
        blackPattern: [],
        whitePattern: [],
    });
    const generated = ruleFlags.hasBase ? emptyBaseBoard() : generateSinglePlayerBoard(stage);
    const board = preserveExistingPlacement ? game.boardState : generated.board;
    const blackPattern = preserveExistingPlacement
        ? (Array.isArray(game.blackPatternStones) ? game.blackPatternStones : [])
        : generated.blackPattern;
    const whitePattern = preserveExistingPlacement
        ? (Array.isArray(game.whitePatternStones) ? game.whitePatternStones : [])
        : generated.whitePattern;

    const baseCaptureTargetBlack =
        !isCaptureGoalMode || hasAutoScoring ? 999 : (stage.targetScore.black > 0 ? stage.targetScore.black : 999);
    const baseCaptureTargetWhite =
        !isCaptureGoalMode || hasAutoScoring ? 999 : (stage.targetScore.white > 0 ? stage.targetScore.white : 999);
    const enforcedMainTimeMinutes = isSpeedMode ? (stage.timeControl?.mainTime ?? 5) : 0;
    const enforcedByoyomiTimeSeconds = isSpeedMode ? 10 : 0;
    const enforcedIncrement = 0;

    game.mode = gameMode;
    game.currentPlayer = Player.Black;
    game.boardState = board;
    game.blackPatternStones = blackPattern;
    game.whitePatternStones = whitePattern;
    game.moveHistory = [];
    game.captures = { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 };
    game.baseStoneCaptures = { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 };
    game.hiddenStoneCaptures = { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 };
    game.lastMove = null;
    game.passCount = 0;
    game.koInfo = null;
    game.totalTurns = 0;
    game.blackTimeLeft = enforcedMainTimeMinutes * 60;
    game.whiteTimeLeft = enforcedMainTimeMinutes * 60;
    game.blackByoyomiPeriodsLeft = 0;
    game.whiteByoyomiPeriodsLeft = 0;
    game.turnStartTime = undefined;
    game.turnDeadline = undefined;
    game.pendingCapture = null;
    game.newlyRevealed = [];
    game.revealedHiddenMoves = {};
    game.permanentlyRevealedStones = [];
    game.justCaptured = [];
    (game as any).consumedPatternIntersections = [];
    game.effectiveCaptureTargets = {
        [Player.None]: 0,
        [Player.Black]: !isCaptureGoalMode || hasAutoScoring ? 999 : (isSurvivalMode ? 999 : baseCaptureTargetBlack),
        [Player.White]:
            !isCaptureGoalMode || hasAutoScoring ? 999 : (isSurvivalMode ? stage.targetScore.black : baseCaptureTargetWhite),
    };
    game.whiteTurnsPlayed = isSurvivalMode ? 0 : undefined;
    game.singlePlayerPlacementRefreshesUsed = 0;
    if (ruleFlags.hasBase) {
        game.baseStones_p1 = [];
        game.baseStones_p2 = [];
        game.baseStones = [];
        game.basePlacementReady = undefined;
        game.baseKomiBidsSnapshot = undefined;
    }
    (game as any).kataCaptureSetupMoves = encodeBoardStateAsKataSetupMovesFromEmpty(board);
    (game as any).kataStrategicOpeningBoardState = cloneBoardStateForKataOpeningSnapshot(board);

    game.settings = {
        ...game.settings,
        boardSize: stage.boardSize,
        timeLimit: enforcedMainTimeMinutes,
        byoyomiTime: enforcedByoyomiTimeSeconds,
        byoyomiCount: 0,
        timeIncrement: enforcedIncrement,
        captureTarget: isCaptureGoalMode && !hasAutoScoring ? stage.targetScore.black : undefined,
        aiDifficulty: kataProfileStep,
        kataServerLevel,
        goAiBotLevel: kataProfileStep,
        survivalTurns: survivalTurnsResolved,
        isSurvivalMode: isSurvivalMode,
        hiddenStoneCount: ruleFlags.hasHidden ? stage.hiddenCount : undefined,
        scanCount: ruleFlags.hasHidden ? stage.scanCount : undefined,
        missileCount: ruleFlags.hasMissile ? stage.missileCount : undefined,
        singlePlayerPlacementRefreshAllowed: stage.allowPlacementRefresh !== false,
        autoScoringTurns: hasAutoScoring ? stage.autoScoringTurns : undefined,
        // 따내기/살리기에서만 턴 제한을 사용한다.
        blackTurnLimit: isCaptureGoalMode && !isSurvivalMode ? stage.blackTurnLimit : undefined,
        baseStones: ruleFlags.hasBase ? stage.baseStones : undefined,
        singlePlayerAiBaseKomiBid: ruleFlags.hasBase ? stage.singlePlayerAiBaseKomiBid : undefined,
        singlePlayerForcedAiResponses: stage.forcedAiResponses,
        singlePlayerStrictForcedAiResponses: stage.strictForcedAiResponses === true,
        singlePlayerAiHiddenItemTurns: ruleFlags.hasHidden ? stage.aiHiddenItemTurns : undefined,
        singlePlayerAiHiddenItemUseWithinTurn: ruleFlags.hasHidden ? stage.aiHiddenItemUseWithinTurn : undefined,
        singlePlayerAiHiddenItemUseCount: ruleFlags.hasHidden ? stage.aiHiddenItemUseCount : undefined,
        singlePlayerAiHiddenItemPlacements: ruleFlags.hasHidden ? stage.aiHiddenItemPlacements : undefined,
        singlePlayerDisableAiHiddenItemUsage: ruleFlags.hasHidden ? stage.disableAiHiddenItemUsage === true : undefined,
        singlePlayerForceAiResponsesOnHiddenTurnsOnly: ruleFlags.hasHidden ? stage.forceAiResponsesOnHiddenTurnsOnly === true : undefined,
        ...(gameMode === GameMode.Mix ? { mixedModes: mixModes } : {}),
    } as any;

    if (gameMode !== GameMode.Hidden && gameMode !== GameMode.Mix) {
        game.hiddenMoves = {};
        (game as any).scans_p1 = 0;
        (game as any).scans_p2 = 0;
    }
    if (gameMode !== GameMode.Missile && gameMode !== GameMode.Mix) {
        (game as any).missiles_p1 = 0;
        (game as any).missiles_p2 = 0;
        (game as any).missileUsedThisTurn = false;
    }
    if (gameMode === GameMode.Hidden) {
        const { initializeSinglePlayerHidden } = await import('../modes/singlePlayerHidden.js');
        initializeSinglePlayerHidden(game);
    }
    if (gameMode === GameMode.Missile) {
        const { initializeSinglePlayerMissile } = await import('../modes/singlePlayerMissile.js');
        initializeSinglePlayerMissile(game);
    }
    if (gameMode === GameMode.Mix) {
        const mix = mixModes;
        if (mix.includes(GameMode.Hidden)) {
            const { initializeSinglePlayerHidden } = await import('../modes/singlePlayerHidden.js');
            initializeSinglePlayerHidden(game);
        }
        if (mix.includes(GameMode.Missile)) {
            const { initializeSinglePlayerMissile } = await import('../modes/singlePlayerMissile.js');
            initializeSinglePlayerMissile(game);
        }
    }

    (game as any).singlePlayerStageDisplay = JSON.parse(JSON.stringify(stage)) as SinglePlayerStageInfo;

    // pending 동안 스테이지가 바뀌어도 AI 봇 표시(닉네임·레벨)가 새 스테이지를 따라가도록 동기화
    const aiSeatUser = game.whitePlayerId === aiUserId
        ? game.player2 ?? null
        : game.blackPlayerId === aiUserId
          ? game.player1 ?? null
          : null;
    if (aiSeatUser) {
        aiSeatUser.nickname = getSinglePlayerBotNicknameFromStage(stage);
        aiSeatUser.userLevel = getSinglePlayerBotDisplayLevelFromStage(stage);
    }
};


export const handleSinglePlayerAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type, payload } = action as any;
    const now = Date.now();

    switch(type) {
        case 'START_SINGLE_PLAYER_GAME': {
            const spGate = await requireArenaEntranceOpen(user.isAdmin, 'singleplayer', user);
            if (!spGate.ok) return { error: spGate.error };
            const { stageId } = payload;
            const stages = await getEffectiveSinglePlayerStages();
            const stage = stages.find(s => s.id === stageId);

            if (!stage) {
                return { error: 'Stage not found.' };
            }

            const currentStageIndex = stages.findIndex(s => s.id === stageId);
            if (currentStageIndex < 0) {
                return { error: '스테이지를 찾을 수 없습니다.' };
            }

            const progress = reconcileSinglePlayerProgress(
                stages,
                user.clearedSinglePlayerStages,
                user.singlePlayerProgress
            );
            const isCleared = isSinglePlayerStageCleared(stages, progress, stageId);
            const effectiveActionPointCost = isCleared ? 0 : stage.actionPointCost;
            
            // 관리자가 아닌 경우 스테이지 잠금 확인
            if (!user.isAdmin) {
                // 첫 번째 스테이지가 아니면 이전 스테이지 클리어 여부 확인
                if (currentStageIndex > 0) {
                    const previousStage = stages[currentStageIndex - 1];

                    if (!isSinglePlayerStageUnlocked(stages, progress, stageId)) {
                        console.log(`[START_SINGLE_PLAYER_GAME] Stage ${stageId} locked - previous stage ${previousStage.id} not cleared. Effective cleared stages: ${JSON.stringify(progress.effectiveClearedStageIds)}`);
                        return { error: '이전 스테이지를 먼저 클리어해야 합니다.' };
                    }
                }
            }

            await applyPassiveActionPointRegenToUser(user, now);
            
            if (user.actionPoints.current < effectiveActionPointCost) {
                return { error: `액션 포인트가 부족합니다. (필요: ${effectiveActionPointCost})` };
            }

            // 행동력은 승리 정산 시 차감 (실패·이탈 시 미차감)
            // 게임 모드: strategicRulePreset이 있으면 우선, 없으면 기존 필드 조합 추론
            const gameMode: GameMode = resolveSinglePlayerStrategicGameMode(stage);
            const mixModes = gameMode === GameMode.Mix ? resolveSinglePlayerMixedModes(stage) : [];
            const ruleFlags = getSinglePlayerRuleFlags(gameMode, mixModes);
            const isCaptureGoalMode = gameMode === GameMode.Capture || (gameMode === GameMode.Mix && mixModes.includes(GameMode.Capture));
            const isSpeedMode = resolveSinglePlayerSpeedTimeMode(stage);

            // 싱글플레이용 AI: 표시 프로필은 반별 1~5, 실제 Kata는 관리자 스테이지 값(`kataServerLevel`) 우선
            const kataProfileStep = getSinglePlayerKataProfileStep(stage.level);
            const kataServerLevel = resolveSinglePlayerStageKataServerLevel(stage);
            const botNickname = getSinglePlayerBotNicknameFromStage(stage);
            // 표시 레벨은 스테이지 번호(1~20)에 맞춰 변동. (반별 1~5 단계는 `aiDifficulty`/`goAiBotLevel`로 사용)
            const botLevel = getSinglePlayerBotDisplayLevelFromStage(stage);
            
            const aiUser = {
                ...getAiUser(gameMode),
                nickname: botNickname,
                userLevel: botLevel,
                userXp: 0,
            };
            
            let board: BoardState;
            let blackPattern: Point[];
            let whitePattern: Point[];
            try {
                if (ruleFlags.hasBase) {
                    board = Array(stage.boardSize)
                        .fill(null)
                        .map(() => Array(stage.boardSize).fill(Player.None));
                    blackPattern = [];
                    whitePattern = [];
                } else {
                    const generatedBoard = generateSinglePlayerBoard(stage);
                    board = generatedBoard.board;
                    blackPattern = generatedBoard.blackPattern;
                    whitePattern = generatedBoard.whitePattern;
                }
            } catch (error) {
                console.error(`[START_SINGLE_PLAYER_GAME] Failed to generate board for stage ${stageId}`, error);
                return { error: '스테이지 맵 설정이 올바르지 않아 게임을 시작할 수 없습니다. 관리자에게 문의해주세요.' };
            }

            const isSurvivalMode = resolveSinglePlayerSurvivalMode(stage);
            const survivalTurnsResolved = isSurvivalMode ? resolveSinglePlayerSurvivalTurnCount(stage) : undefined;

            // 시간룰 설정: 스피드바둑은 메인+수당 10초, 비스피드 싱글플레이는 무제한
            const enforcedMainTimeMinutes = isSpeedMode ? (stage.timeControl?.mainTime ?? 5) : 0;
            const enforcedByoyomiTimeSeconds = isSpeedMode ? 10 : 0;
            const enforcedByoyomiCount = 0;
            const enforcedIncrement = 0;


            const gameId = `sp-game-${randomUUID()}`;
            // 따내기 계열(따내기/살리기/믹스-따내기 포함)에서만 목표점수를 적용한다.
            const hasAutoScoring = resolveSinglePlayerHasAutoScoringTurns(stage);
            const baseCaptureTargetBlack =
                !isCaptureGoalMode || hasAutoScoring ? 999 : (stage.targetScore.black > 0 ? stage.targetScore.black : 999);
            const baseCaptureTargetWhite =
                !isCaptureGoalMode || hasAutoScoring ? 999 : (stage.targetScore.white > 0 ? stage.targetScore.white : 999);

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
                    captureTarget: isCaptureGoalMode && !hasAutoScoring ? stage.targetScore.black : undefined,
                    aiDifficulty: kataProfileStep, // makeGoAiBotMove 프로필 단계(1~5) → Kata 레벨봇 매핑
                    kataServerLevel,
                    goAiBotLevel: kataProfileStep,
                    survivalTurns: survivalTurnsResolved, // 살리기 바둑 모드: AI가 살아남아야 하는 턴 수
                    isSurvivalMode: isSurvivalMode, // 살리기 바둑 모드 플래그
                    hiddenStoneCount: ruleFlags.hasHidden ? stage.hiddenCount : undefined, // 히든바둑: 히든 아이템 개수
                    scanCount: ruleFlags.hasHidden ? stage.scanCount : undefined, // 히든바둑: 스캔 아이템 개수
                    missileCount: ruleFlags.hasMissile ? stage.missileCount : undefined, // 미사일바둑: 미사일 아이템 개수
                    singlePlayerPlacementRefreshAllowed: stage.allowPlacementRefresh !== false,
                    autoScoringTurns: hasAutoScoring ? stage.autoScoringTurns : undefined, // 자동 계가 턴 수
                    blackTurnLimit: isCaptureGoalMode && !isSurvivalMode ? stage.blackTurnLimit : undefined,
                    baseStones: ruleFlags.hasBase ? stage.baseStones : undefined, // 베이스바둑: 베이스 돌 개수
                    singlePlayerAiBaseKomiBid: ruleFlags.hasBase ? stage.singlePlayerAiBaseKomiBid : undefined,
                    singlePlayerForcedAiResponses: stage.forcedAiResponses,
                    singlePlayerStrictForcedAiResponses: stage.strictForcedAiResponses === true,
                    singlePlayerAiHiddenItemTurns: ruleFlags.hasHidden ? stage.aiHiddenItemTurns : undefined,
                    singlePlayerAiHiddenItemUseWithinTurn: ruleFlags.hasHidden ? stage.aiHiddenItemUseWithinTurn : undefined,
                    singlePlayerAiHiddenItemUseCount: ruleFlags.hasHidden ? stage.aiHiddenItemUseCount : undefined,
                    singlePlayerAiHiddenItemPlacements: ruleFlags.hasHidden ? stage.aiHiddenItemPlacements : undefined,
                    singlePlayerDisableAiHiddenItemUsage: ruleFlags.hasHidden ? stage.disableAiHiddenItemUsage === true : undefined,
                    singlePlayerForceAiResponsesOnHiddenTurnsOnly: ruleFlags.hasHidden ? stage.forceAiResponsesOnHiddenTurnsOnly === true : undefined,
                    ...(gameMode === GameMode.Mix ? { mixedModes: mixModes } : {}),
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
                    // 따내기 계열이 아니면 목표점수 비활성화
                    [Player.Black]: !isCaptureGoalMode || hasAutoScoring ? 999 : (isSurvivalMode ? 999 : baseCaptureTargetBlack),
                    // 살리기 바둑: 백(봇)이 목표점수를 달성해야 함 (백의 목표점수는 black 값 사용)
                    [Player.White]:
                        !isCaptureGoalMode || hasAutoScoring ? 999 : (isSurvivalMode ? stage.targetScore.black : baseCaptureTargetWhite),
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

            if (gameMode === GameMode.Mix) {
                const mix = mixModes;
                if (mix.includes(GameMode.Hidden)) {
                    const { initializeSinglePlayerHidden } = await import('../modes/singlePlayerHidden.js');
                    initializeSinglePlayerHidden(game);
                }
                if (mix.includes(GameMode.Missile)) {
                    const { initializeSinglePlayerMissile } = await import('../modes/singlePlayerMissile.js');
                    initializeSinglePlayerMissile(game);
                }
            }

            (game as any).singlePlayerStageDisplay = JSON.parse(JSON.stringify(stage)) as SinglePlayerStageInfo;

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
            
            if (!game) {
                console.warn(`[handleSinglePlayerAction] CONFIRM_SINGLE_PLAYER_GAME_START - Stale game confirmation ignored:`, { gameId, userId: user.id });
                return {
                    clientResponse: {
                        success: false,
                        gameId,
                        staleGame: true,
                    },
                };
            }
            if (!isSinglePlayerSession(game) || !game.stageId) {
                console.error(`[handleSinglePlayerAction] CONFIRM_SINGLE_PLAYER_GAME_START - Invalid game:`, { gameId, hasGame: !!game, isSinglePlayer: game?.isSinglePlayer, stageId: game?.stageId });
                return { error: 'Invalid single player game.' };
            }
            if (game.gameStatus !== 'pending') {
                const moveCount = (game.moveHistory ?? []).filter(
                    (m) => m.x !== -1 && m.y !== -1,
                ).length;
                const postConfirmPrePlay =
                    moveCount === 0 &&
                    (game.gameStatus === 'playing' ||
                        game.gameStatus === 'base_placement' ||
                        game.gameStatus === 'base_stone_color_choice' ||
                        game.gameStatus === 'base_same_color_points_bid' ||
                        game.gameStatus === 'base_game_start_confirmation' ||
                        game.gameStatus === 'capture_bidding' ||
                        game.gameStatus === 'capture_reveal' ||
                        game.gameStatus === 'capture_tiebreaker');
                if (postConfirmPrePlay) {
                    console.warn(
                        `[handleSinglePlayerAction] CONFIRM_SINGLE_PLAYER_GAME_START - Idempotent confirm (client modal resync):`,
                        { gameId, gameStatus: game.gameStatus },
                    );
                    const gameCopy = JSON.parse(JSON.stringify(game));
                    return {
                        clientResponse: {
                            success: true,
                            gameId: game.id,
                            game: gameCopy,
                            alreadyStarted: true,
                        },
                    };
                }
                console.error(`[handleSinglePlayerAction] CONFIRM_SINGLE_PLAYER_GAME_START - Game not pending:`, { gameId, gameStatus: game.gameStatus });
                return { error: '게임이 이미 시작되었거나 시작할 수 없는 상태입니다.' };
            }
            const stages = await getEffectiveSinglePlayerStages();
            const latestStage = stages.find(s => s.id === game.stageId);
            if (!latestStage) {
                return { error: 'Stage data not found.' };
            }
            await applyLatestPendingSinglePlayerStage(game, latestStage, { preserveExistingPlacement: true });
            console.log(`[handleSinglePlayerAction] CONFIRM_SINGLE_PLAYER_GAME_START - Starting game:`, { gameId, currentStatus: game.gameStatus });

            const now = Date.now();
            const mixModes = ((game.settings as any)?.mixedModes ?? []) as GameMode[];
            const confirmRuleFlags = getSinglePlayerRuleFlags(game.mode, mixModes);
            const isSpeedMode =
                resolveSinglePlayerSpeedTimeMode(latestStage) ||
                game.mode === GameMode.Speed ||
                (game.mode === GameMode.Mix && Array.isArray(mixModes) && mixModes.includes(GameMode.Speed));

            if (confirmRuleFlags.hasBase) {
                const { initializeBase } = await import('../modes/base.js');
                initializeBase(game, now);
                await db.saveGame(game, true);
                updateGameCache(game);
                const { broadcastToGameParticipants } = await import('../socket.js');
                broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);

                const gameCopy = JSON.parse(JSON.stringify(game));
                return {
                    clientResponse: {
                        success: true,
                        gameId: game.id,
                        game: gameCopy,
                    },
                };
            }

            game.gameStatus = 'playing';
            game.turnStartTime = now;
            (game as any).startTime = now;
            (game as any).gameStartTime = now; // 경과 시간은 실제 시작 시점부터 (pending 시 0 표시)

            // 싱글플레이 시간 설정: 비스피드 모드는 무제한(제한시간/초읽기 0, 초읽기 소리 없음)
            const enforcedMainTimeMinutes = isSpeedMode ? (game.settings.timeLimit || 5) : 0;

            // 비스피드 모드는 무제한(시간/초읽기 소리 없음)
            if (!isSpeedMode) {
                game.settings.timeLimit = 0;
                game.settings.byoyomiCount = 0;
                game.settings.byoyomiTime = 0;
                game.settings.timeIncrement = 0;
            } else {
                game.settings.timeIncrement = 0;
                game.settings.timeLimit = enforcedMainTimeMinutes;
                game.settings.byoyomiTime = 10;
                game.settings.byoyomiCount = 0;
            }

            // 싱글플레이 스피드: 메인 시계 + 수당 10초 이중 시계
            if (isSpeedMode) {
                const initialSec = enforcedMainTimeMinutes * 60;
                game.blackTimeLeft = initialSec;
                game.whiteTimeLeft = initialSec;
                game.blackInitialTimeLeft = initialSec;
                game.whiteInitialTimeLeft = initialSec;
                const { applySpeedNextTurnClockStart } = await import('../../shared/utils/speedTimePressureSessionSync.js');
                applySpeedNextTurnClockStart(game, now);
            } else {
                game.turnDeadline = undefined;
                game.blackTimeLeft = 0;
                game.whiteTimeLeft = 0;
            }
            game.blackByoyomiPeriodsLeft = 0;
            game.whiteByoyomiPeriodsLeft = 0;

            // playing 진입 시 펫 힌트 보너스 3페이즈 프리롤(저장 전에 반영)
            const { seedStrategicPetHintBonusPresetsForGame } = await import('../strategicPetHintAction.js');
            await seedStrategicPetHintBonusPresetsForGame(game);

            // playing 전환 직후 한 번 강제 저장 — 이후 수순은 기존처럼 메모리 위주
            await db.saveGame(game, true);
            updateGameCache(game);
            const { broadcastToGameParticipants } = await import('../socket.js');
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);

            console.log(`[handleSinglePlayerAction] CONFIRM_SINGLE_PLAYER_GAME_START - Game started successfully:`, { gameId: game.id, gameStatus: game.gameStatus });
            const gameCopy = JSON.parse(JSON.stringify(game));
            return {
                clientResponse: {
                    success: true,
                    gameId: game.id,
                    game: gameCopy,
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
            if (!isSinglePlayerSession(game) || !game.stageId) {
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
            // 베이스 싱글플레이에서 유저가 백이 되면 첫 수는 흑(AI)이 둔다 — `currentPlayer === Player.Black` 가정은
            // 더이상 통하지 않는다. moveHistory가 비어 있고 게임이 playing 상태이면 색과 무관하게 재배치를 허용한다.
            if (game.gameStatus !== 'playing' || (game.moveHistory && game.moveHistory.length > 0)) {
                console.log(`[handleSinglePlayerAction] SINGLE_PLAYER_REFRESH_PLACEMENT: Invalid state - gameStatus=${game.gameStatus}, currentPlayer=${game.currentPlayer}, moveHistory.length=${game.moveHistory?.length || 0}`);
                return { error: '배치는 첫 수 전에만 새로고침할 수 있습니다.' };
            }

            const stages = await getEffectiveSinglePlayerStages();
            const stage = stages.find(s => s.id === game.stageId);
            if (!stage) {
                return { error: 'Stage data not found for refresh.' };
            }
            if (stage.allowPlacementRefresh === false || game.settings.singlePlayerPlacementRefreshAllowed === false) {
                return { error: '이 스테이지에서는 배치변경을 사용할 수 없습니다.' };
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
        case 'SINGLE_PLAYER_SYNC_PENDING_STAGE': {
            const { gameId } = payload;
            const { getCachedGame, updateGameCache } = await import('../gameCache.js');
            let game = await getCachedGame(gameId);
            if (!game) game = await db.getLiveGame(gameId);
            if (!isSinglePlayerSession(game) || !game.stageId) {
                return { error: 'Invalid single player game.' };
            }
            if (game.blackPlayerId !== user.id) {
                return { error: '게임 소유자가 아닙니다.' };
            }
            if (game.gameStatus !== 'pending') {
                return { error: '게임 시작 전(pending) 상태에서만 동기화할 수 있습니다.' };
            }

            const stages = await getEffectiveSinglePlayerStages();
            const stage = stages.find((s) => s.id === game.stageId);
            if (!stage) {
                return { error: 'Stage data not found.' };
            }

            await applyLatestPendingSinglePlayerStage(game, stage, { preserveExistingPlacement: true });

            await db.saveGame(game, true);
            updateGameCache(game);
            const { broadcastToGameParticipants } = await import('../socket.js');
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
            return { clientResponse: { gameId: game.id, game } };
        }
        case 'SINGLE_PLAYER_ADMIN_JUMP_PENDING_STAGE': {
            if (!user.isAdmin) {
                return { error: 'Permission denied.' };
            }
            const { gameId, direction } = payload as { gameId?: string; direction?: 'prev' | 'next' };
            if (!gameId || (direction !== 'prev' && direction !== 'next')) {
                return { error: 'Invalid payload.' };
            }
            const { getCachedGame, updateGameCache } = await import('../gameCache.js');
            let game = await getCachedGame(gameId);
            if (!game) game = await db.getLiveGame(gameId);
            if (!isSinglePlayerSession(game) || !game.stageId) {
                return { error: 'Invalid single player game.' };
            }
            if (game.blackPlayerId !== user.id) {
                return { error: '게임 소유자가 아닙니다.' };
            }
            if (game.gameStatus !== 'pending') {
                return { error: '게임 시작 전(pending) 상태에서만 바꿀 수 있습니다.' };
            }
            const stages = await getEffectiveSinglePlayerStages();
            const idx = stages.findIndex((s) => s.id === game.stageId);
            if (idx < 0) {
                return { error: 'Stage data not found.' };
            }
            const nextIdx = direction === 'prev' ? Math.max(0, idx - 1) : Math.min(stages.length - 1, idx + 1);
            const nextStage = stages[nextIdx];
            if (!nextStage) {
                return { error: 'Stage data not found.' };
            }
            if (nextIdx !== idx) {
                game.stageId = nextStage.id;
                await applyLatestPendingSinglePlayerStage(game, nextStage, { preserveExistingPlacement: false });
                await db.saveGame(game, true);
                updateGameCache(game);
                const { broadcastToGameParticipants } = await import('../socket.js');
                broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
            }
            const gameCopy = JSON.parse(JSON.stringify(game)) as LiveGameSession;
            return { clientResponse: { gameId: game.id, game: gameCopy } };
        }
        case 'START_SINGLE_PLAYER_MISSION': {
            const spMissionGate = await requireArenaEntranceOpen(user.isAdmin, 'singleplayer', user);
            if (!spMissionGate.ok) return { error: spMissionGate.error };
            const { missionId } = payload;
            const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);
            if (!missionInfo) return { error: '미션을 찾을 수 없습니다.' };

            if (!user.singlePlayerMissions) user.singlePlayerMissions = {};
            if (user.singlePlayerMissions[missionId]?.isStarted) return { error: '이미 시작된 미션입니다.' };

            const stages = await getEffectiveSinglePlayerStages();
            const unlockStageIndex = stages.findIndex(s => s.id === missionInfo.unlockStageId);
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
            broadcastUserUpdate(user, ['singlePlayerMissions', 'quests']);
            
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
        case 'CLAIM_SINGLE_PLAYER_CLASS_BAR_REWARD': {
            const spBarGate = await requireArenaEntranceOpen(user.isAdmin, 'singleplayer', user);
            if (!spBarGate.ok) return { error: spBarGate.error };
            const raw = payload as { level?: SinglePlayerLevel; milestone?: number };
            const level = raw.level;
            const milestone = raw.milestone;
            if (!level || !Object.values(SinglePlayerLevel).includes(level)) {
                return { error: '잘못된 반입니다.' };
            }
            if (milestone !== 10 && milestone !== 20) {
                return { error: '잘못된 목표 점수입니다.' };
            }
            const stages = await getEffectiveSinglePlayerStages();
            const progress = reconcileSinglePlayerProgress(stages, user.clearedSinglePlayerStages, user.singlePlayerProgress);
            const classStages = stages
                .filter((s) => s.level === level)
                .sort((a, b) => parseInt(a.id.split('-')[1]!, 10) - parseInt(b.id.split('-')[1]!, 10));
            let clearedInClass = 0;
            for (const s of classStages) {
                if (isSinglePlayerStageCleared(stages, progress, s.id)) clearedInClass += 1;
            }
            if (clearedInClass < milestone) {
                return { error: '해당 점수만큼 스테이지를 클리어해야 합니다.' };
            }
            if (!user.singlePlayerClassBarClaims) {
                user.singlePlayerClassBarClaims = {};
            }
            const prevClaims = user.singlePlayerClassBarClaims[level] ?? {};
            const claimKey = milestone === 10 ? 'm10' : 'm20';
            if (prevClaims[claimKey]) {
                return { error: '이미 수령한 보상입니다.' };
            }
            const rewardRow = SINGLE_PLAYER_CLASS_BAR_REWARDS[level];
            if (!rewardRow) {
                return { error: '보상 설정을 찾을 수 없습니다.' };
            }
            const itemDef = milestone === 10 ? rewardRow.milestone10 : rewardRow.milestone20;
            const itemsToCreate = createItemInstancesFromReward([itemDef]);
            const { success, finalItemsToAdd, updatedInventory } = addItemsToInventory(
                [...user.inventory],
                user.inventorySlots,
                itemsToCreate
            );
            if (!success) {
                return { error: '보상을 받기에 인벤토리 공간이 부족합니다.' };
            }
            user.inventory = updatedInventory;
            user.singlePlayerClassBarClaims = {
                ...user.singlePlayerClassBarClaims,
                [level]: { ...prevClaims, [claimKey]: true },
            };

            db.updateUser(user).catch((err) => {
                console.error(`[CLAIM_SINGLE_PLAYER_CLASS_BAR_REWARD] Failed to save user ${user.id}:`, err);
            });
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'singlePlayerClassBarClaims']);

            const { getSelectiveUserUpdate } = await import('../utils/userUpdateHelper.js');
            const updatedUser = getSelectiveUserUpdate(user, 'CLAIM_SINGLE_PLAYER_CLASS_BAR_REWARD');
            const levelTitle = level === SinglePlayerLevel.유단자 ? '유단자' : `${level}반`;
            return {
                clientResponse: {
                    updatedUser,
                    rewardSummary: {
                        reward: {},
                        items: finalItemsToAdd ?? itemsToCreate,
                        title: `${levelTitle} 스테이지 ${milestone}점 보상`,
                    },
                },
            };
        }
        case 'CLAIM_ALL_TRAINING_QUEST_REWARDS': {
            const opts = (payload && typeof payload === 'object' ? payload : {}) as { previewOnly?: boolean; adDouble?: boolean };
            const preview = await buildTrainingQuestBulkRewardPreview(user, now);
            const multiplier = opts.adDouble === true ? 2 : 1;
            const rewards = preview.rewards.map(({ rawAvailableAmount: _rawAvailableAmount, remainderMs: _remainderMs, productionIntervalMs: _productionIntervalMs, maxCapacity: _maxCapacity, ...row }) => ({
                ...row,
                rewardAmount: row.rewardAmount * multiplier,
            }));
            const totalGold = preview.totalGold * multiplier;
            const totalDiamonds = preview.totalDiamonds * multiplier;

            if (preview.rewards.length < 1) {
                return { error: '수령할 보상이 없습니다.' };
            }

            if (opts.previewOnly) {
                return {
                    clientResponse: {
                        claimAllTrainingQuestRewards: {
                            rewards,
                            totalGold,
                            totalDiamonds,
                            previewOnly: true,
                            adDouble: opts.adDouble === true,
                        },
                    },
                };
            }

            if (!user.singlePlayerMissions) user.singlePlayerMissions = {};
            for (const reward of preview.rewards) {
                const missionState = user.singlePlayerMissions[reward.missionId];
                if (!missionState) continue;
                if (reward.rewardType === 'gold') {
                    user.gold += reward.rewardAmount * multiplier;
                } else {
                    user.diamonds += reward.rewardAmount * multiplier;
                }
                const currentAccumulatedCollection = typeof missionState.accumulatedCollection === 'number'
                    ? missionState.accumulatedCollection
                    : Number(missionState.accumulatedCollection) || 0;
                missionState.accumulatedCollection = currentAccumulatedCollection + reward.rewardAmount * multiplier;
                missionState.accumulatedAmount = 0;
                missionState.lastCollectionTime = reward.productionIntervalMs > 0 ? now - reward.remainderMs : now;
                if (reward.productionIntervalMs > 0 && reward.rawAvailableAmount >= reward.maxCapacity) {
                    missionState.lastCollectionTime = now;
                }
            }

            updateQuestProgress(user, 'training_quest_claim', undefined, preview.rewards.length);
            db.updateUser(user).catch(err => {
                console.error(`[CLAIM_ALL_TRAINING_QUEST_REWARDS] Failed to save user ${user.id}:`, err);
            });
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['gold', 'diamonds', 'singlePlayerMissions', 'quests']);

            const { getSelectiveUserUpdate } = await import('../utils/userUpdateHelper.js');
            const updatedUser = getSelectiveUserUpdate(user, 'CLAIM_ALL_TRAINING_QUEST_REWARDS');

            return {
                clientResponse: {
                    updatedUser,
                    claimAllTrainingQuestRewards: {
                        rewards,
                        totalGold,
                        totalDiamonds,
                        previewOnly: false,
                        adDouble: opts.adDouble === true,
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
        case 'MISSILE_ITEM_TIMEOUT':
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
            if (!isSinglePlayerSession(game)) {
                return { error: 'Invalid single player game.' };
            }
            const { applyPveItemActionClientSync } = await import('../pveItemSync.js');
            applyPveItemActionClientSync(game, payload);
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
            if (!isSinglePlayerSession(game)) {
                console.error(`[handleSinglePlayerAction] ${type}: Game is not single player, gameId=${gameId}`);
                return { error: 'Invalid single player game.' };
            }
            console.log(`[handleSinglePlayerAction] ${type}: Game found, gameStatus=${game.gameStatus}, currentPlayer=${game.currentPlayer}`);
            const { applyPveItemActionClientSync } = await import('../pveItemSync.js');
            applyPveItemActionClientSync(game, payload, { preserveServerHiddenPlacementMeta: true });
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