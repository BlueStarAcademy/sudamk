import { randomUUID } from 'crypto';
import * as db from './db.js';
// FIX: Import GameMode to resolve TS2304 error.
import { type ServerAction, type User, type VolatileState, InventoryItem, Quest, QuestLog, Negotiation, Player, LeagueTier, TournamentType, GameMode } from '../shared/types/index.js';
import * as types from '../shared/types/index.js';
import { volatileState } from './state.js';
import { isDifferentDayKST, isDifferentWeekKST, isDifferentMonthKST, getStartOfDayKST, isSameDayKST } from '../shared/utils/timeUtils.js';
import * as effectService from './effectService.js';
import { regenerateActionPoints } from './effectService.js';
import { updateGameStates } from './gameModes.js';
import { DAILY_QUESTS, WEEKLY_QUESTS, MONTHLY_QUESTS, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, ACTION_POINT_REGEN_INTERVAL_MS, ITEM_SELL_PRICES, MATERIAL_SELL_PRICES, ACHIEVEMENT_TRACKS } from '../shared/constants';
import { initializeGame } from './gameModes.js';
import { handleStrategicGameAction } from './modes/standard.js';
import {
    towerP1ConsumableAllowance,
    countTowerLobbyInventoryQty,
    consumeOneTowerLobbyInventoryItem,
    TOWER_LOBBY_SCAN_NAMES,
    TOWER_LOBBY_HIDDEN_NAMES,
} from './modes/towerPlayerHidden.js';
import { handlePlayfulGameAction } from './modes/playful.js';
import { createDefaultUser, createDefaultQuests } from './initialData.ts';
import { containsProfanity } from '../profanity.js';
import * as mannerService from './mannerService.js';

// Import new action handlers
import { handleAdminAction } from './actions/adminActions.js';
import { handleInventoryAction } from './actions/inventoryActions.js';
import { handleNegotiationAction } from './actions/negotiationActions.js';
import { handleRewardAction } from './actions/rewardActions.js';
import { handleShopAction } from './actions/shopActions.js';
import { handleSocialAction } from './actions/socialActions.js';
import { handleTournamentAction } from './actions/tournamentActions.js';
import { handleUserAction } from './actions/userActions.js';
import { handleSinglePlayerAction } from './actions/singlePlayerActions.js';
import { handleTowerAction } from './actions/towerActions.js';
import { handleGuildAction } from './actions/guildActions.js';
import { broadcast } from './socket.js';
import { applyPveItemActionClientSync } from './pveItemSync.js';
import { updateQuestProgress } from './questService.js';
import { getCurrentPairTurnSeat, isPairAiSeat, isPairClassicGame } from '../shared/utils/pairGameTurn.js';
import { resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';
import { isAiLobbyManualClockPause } from './modes/shared.js';

export { updateQuestProgress } from './questService.js';

export type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
};

const gameActionQueues = new Map<string, Promise<unknown>>();
const ALKKAGI_AI_FIRST_ATTACK_DELAY_MS = 2000;
const VERBOSE_ACTION_LOGS = process.env.DEBUG_ACTION_LOGS === '1' || process.env.LOG_ACTIONS === '1';

/** 놀이바둑(대기실 AI·PVE): 클라 착수 전용 PVE 게이트에서 삼키면 안 되는 서버 검증 액션 */
export const PLAYFUL_SERVER_ACTION_TYPES = new Set<string>([
    'OMOK_PLACE_STONE',
    'SUBMIT_RPS_CHOICE',
    'DICE_READY_FOR_TURN_ROLL',
    'DICE_CHOOSE_TURN',
    'DICE_CONFIRM_START',
    'DICE_ROLL',
    'DICE_PLACE_STONE',
    'DICE_PLACE_STONES_BATCH',
    'CONFIRM_THIEF_ROLE',
    'THIEF_ROLL_DICE',
    'THIEF_PLACE_STONE',
    'CONFIRM_ALKKAGI_START',
    'ALKKAGI_PLACE_STONE',
    'ALKKAGI_FLICK_STONE',
    'USE_ALKKAGI_ITEM',
    'CONFIRM_CURLING_START',
    'CURLING_FLICK_STONE',
    'USE_CURLING_ITEM',
    'CONFIRM_ROUND_END',
]);

async function runGameActionSerial<T>(gameId: string, task: () => Promise<T>): Promise<T> {
    const previous = gameActionQueues.get(gameId) ?? Promise.resolve();
    const nextTask = previous.catch(() => undefined).then(task);
    const queueTail = nextTask.finally(() => {
        if (gameActionQueues.get(gameId) === queueTail) {
            gameActionQueues.delete(gameId);
        }
    });
    gameActionQueues.set(gameId, queueTail);
    return nextTask;
}

const clonePointListFromPayload = (value: unknown): types.Point[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const out = value
        .map((point) => {
            if (!point || typeof point !== 'object') return null;
            const p = point as Record<string, unknown>;
            const x = Number(p.x);
            const y = Number(p.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            return { x: Math.floor(x), y: Math.floor(y) };
        })
        .filter((point): point is types.Point => point != null);
    return out;
};

const applyPveFinalSnapshotFromPayload = (game: types.LiveGameSession, payload: Record<string, unknown>): void => {
    const boardSize = Number(game.settings?.boardSize ?? game.boardState?.length ?? 0);
    const boardState = payload.boardState;
    if (
        Number.isFinite(boardSize) &&
        boardSize > 0 &&
        Array.isArray(boardState) &&
        boardState.length === boardSize &&
        boardState.every((row) => Array.isArray(row) && row.length === boardSize)
    ) {
        game.boardState = boardState.map((row) =>
            (row as unknown[]).map((cell) =>
                cell === Player.Black || cell === Player.White ? cell : Player.None
            )
        );
    }

    if (Array.isArray(payload.moveHistory)) {
        game.moveHistory = payload.moveHistory
            .map((move) => {
                if (!move || typeof move !== 'object') return null;
                const m = move as Record<string, unknown>;
                const player = m.player === Player.Black || m.player === Player.White ? m.player : null;
                const x = Number(m.x);
                const y = Number(m.y);
                if (!player || !Number.isFinite(x) || !Number.isFinite(y)) return null;
                return { ...m, player, x: Math.floor(x), y: Math.floor(y) } as NonNullable<types.LiveGameSession['moveHistory']>[number];
            })
            .filter((move): move is NonNullable<types.LiveGameSession['moveHistory']>[number] => move != null);
    }

    for (const key of ['captures', 'baseStoneCaptures', 'hiddenStoneCaptures'] as const) {
        const value = payload[key];
        if (!value || typeof value !== 'object') continue;
        const record = value as Record<string, unknown>;
        (game as any)[key] = {
            [Player.None]: Math.max(0, Number(record[Player.None]) || 0),
            [Player.Black]: Math.max(0, Number(record[Player.Black]) || 0),
            [Player.White]: Math.max(0, Number(record[Player.White]) || 0),
        };
    }

    const blackPatternStones = clonePointListFromPayload(payload.blackPatternStones);
    if (blackPatternStones) game.blackPatternStones = blackPatternStones;
    const whitePatternStones = clonePointListFromPayload(payload.whitePatternStones);
    if (whitePatternStones) game.whitePatternStones = whitePatternStones;
    const permanentlyRevealedStones = clonePointListFromPayload(payload.permanentlyRevealedStones);
    if (permanentlyRevealedStones) game.permanentlyRevealedStones = permanentlyRevealedStones;
    const consumedPatternIntersections = clonePointListFromPayload(payload.consumedPatternIntersections);
    if (consumedPatternIntersections) (game as any).consumedPatternIntersections = consumedPatternIntersections;
    if (payload.hiddenMoves && typeof payload.hiddenMoves === 'object' && !Array.isArray(payload.hiddenMoves)) {
        game.hiddenMoves = { ...(payload.hiddenMoves as Record<number, boolean>) };
    }
    if (typeof payload.totalTurns === 'number' && Number.isFinite(payload.totalTurns)) {
        game.totalTurns = Math.max(0, Math.floor(payload.totalTurns));
    }
    if (payload.lastMove && typeof payload.lastMove === 'object') {
        const lastMove = payload.lastMove as Record<string, unknown>;
        const x = Number(lastMove.x);
        const y = Number(lastMove.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
            game.lastMove = { x: Math.floor(x), y: Math.floor(y) };
        }
    }
};

// --- Helper Functions (moved from the old gameActions) ---
const normalizeLegacyQuestTexts = (user: User): boolean => {
    if (!user.quests) return false;

    let changed = false;
    const groups: Array<{ quests: Quest[] | undefined; period: 'daily' | 'weekly' | 'monthly' }> = [
        { quests: user.quests.daily?.quests, period: 'daily' },
        { quests: user.quests.weekly?.quests, period: 'weekly' },
        { quests: user.quests.monthly?.quests, period: 'monthly' },
    ];

    for (const { quests, period } of groups) {
        if (!Array.isArray(quests)) continue;
        for (const quest of quests) {
            if (quest.title === '자동대국 토너먼트 참여하기' || quest.title === '챔피언십 경기 진행하기' || quest.title === '챔피언십 경기 완료하기') {
                quest.title = '챔피언십 경기 완료';
                changed = true;
            }
            if (quest.title === '일일퀘스트 활약도100보상 받기(3/3)') {
                quest.title = period === 'weekly' ? '일일 퀘스트 활약도 100보상 받기 (3회)' : '일일퀘스트 활약도100보상 받기 3회';
                changed = true;
            }
            if (quest.title === '일일퀘스트 활약도100보상 받기 3회' && period === 'weekly') {
                quest.title = '일일 퀘스트 활약도 100보상 받기 (3회)';
                changed = true;
            }
            if (quest.title === '주간퀘스트 활약도100보상 받기(2/2)' && period === 'monthly') {
                quest.title = '주간 퀘스트 활약도 100보상 받기 (2회)';
                changed = true;
            }
            if (quest.title === '전략바둑 경기하기') {
                quest.title = '전략바둑 경기하기(PVP)';
                changed = true;
            }
            if (quest.title === '놀이바둑 경기하기') {
                quest.title = '놀이바둑 경기하기(PVP)';
                changed = true;
            }
            if (quest.title === '재료 합성/분해 시도') {
                quest.title = '재료 합성/분해';
                changed = true;
            }
            if (quest.title === '장비 강화시도') {
                quest.title = '장비 강화';
                changed = true;
            }
            if (quest.title === '장비 합성시도') {
                quest.title = '장비 합성';
                changed = true;
            }
            if (quest.title === '장비 제련시도') {
                quest.title = '장비 제련';
                changed = true;
            }
            if (quest.title === '장비 분해시도') {
                quest.title = '장비 분해';
                changed = true;
            }
        }
    }

    return changed;
};

export const resetAndGenerateQuests = async (user: User): Promise<User> => {
    const now = Date.now();
    const updatedUser = JSON.parse(JSON.stringify(user));
    let modified = false;

    // Ensure the quests object and its properties exist for older users.
    if (!updatedUser.quests || typeof updatedUser.quests.daily === 'undefined' || typeof updatedUser.quests.weekly === 'undefined' || typeof updatedUser.quests.monthly === 'undefined') {
        const existingQuests = updatedUser.quests || {};
        updatedUser.quests = {
            daily: existingQuests.daily || createDefaultQuests().daily,
            weekly: existingQuests.weekly || createDefaultQuests().weekly,
            monthly: existingQuests.monthly || createDefaultQuests().monthly,
        };
        modified = true;
    }
    if (normalizeLegacyQuestTexts(updatedUser)) {
        modified = true;
    }
    if (!updatedUser.quests.achievements) {
        updatedUser.quests.achievements = { tracks: {} };
        modified = true;
    }
    if (!updatedUser.quests.achievements.tracks) {
        updatedUser.quests.achievements.tracks = {};
        modified = true;
    }
    for (const track of ACHIEVEMENT_TRACKS) {
        const trackState = updatedUser.quests.achievements.tracks[track.id];
        if (!trackState) {
            updatedUser.quests.achievements.tracks[track.id] = { currentIndex: 0, claimedIndices: [] };
            modified = true;
            continue;
        }
        if (!Array.isArray(trackState.claimedIndices)) {
            trackState.claimedIndices = [];
            modified = true;
        }
        if (typeof trackState.currentIndex !== 'number' || trackState.currentIndex < 0) {
            trackState.currentIndex = 0;
            modified = true;
        } else {
            const maxIndex = Math.max(0, track.stages.length - 1);
            if (trackState.currentIndex > maxIndex) {
                trackState.currentIndex = maxIndex;
                modified = true;
            }
        }
    }
    // Keep existing quest entries but normalize per-period gold rewards.
    // This applies new balance values immediately without waiting for reset day/week/month.
    const normalizeQuestRewards = (quests: Quest[] | undefined, gold: number): boolean => {
        if (!quests) return false;
        let changed = false;
        for (const quest of quests) {
            if (!quest.reward) {
                quest.reward = { gold };
                changed = true;
                continue;
            }
            if (quest.reward.gold !== gold) {
                quest.reward.gold = gold;
                changed = true;
            }
        }
        return changed;
    };
    if (normalizeQuestRewards(updatedUser.quests.daily?.quests, 100)) modified = true;
    if (normalizeQuestRewards(updatedUser.quests.weekly?.quests, 500)) modified = true;
    if (normalizeQuestRewards(updatedUser.quests.monthly?.quests, 1500)) modified = true;

    // Daily Quests
    if (isDifferentDayKST(updatedUser.quests.daily?.lastReset, now)) {
        updatedUser.quests.daily = {
            quests: [],
            activityProgress: 0,
            claimedMilestones: [false, false, false, false, false],
            lastReset: now,
        };
        const newQuests: Quest[] = DAILY_QUESTS.map((q, i) => ({
            ...q, id: `q-d-${i}-${now}`, progress: 0, isClaimed: false,
        }));
        updatedUser.quests.daily.quests = newQuests;
        // Daily login quest progress
        updateQuestProgress(updatedUser, 'login', undefined, 1);
        
        // Check if user has already completed conditions for other quests
        // 채팅창에 인사하기: volatileState에서 최근 채팅 메시지 확인
        const { volatileState } = await import('./state.js');
        const GREETINGS = ['안녕', '하이', '헬로', 'hi', 'hello', '반가', '잘 부탁', '잘부탁'];
        const todayStartKST = getStartOfDayKST(now);
        
        // 채팅 인사 퀘스트 체크: 오늘 날짜에 인사 메시지가 있는지 확인
        const userLastChatTime = volatileState.userLastChatMessage[user.id] || 0;
        if (userLastChatTime >= todayStartKST) {
            // 오늘 채팅을 보냈으므로, 채팅 내용 확인
            const allChannels = ['global', 'strategic', 'playful'] as const;
            let hasGreetingToday = false;
            for (const channel of allChannels) {
                const chats = volatileState.waitingRoomChats[channel] || [];
                const todayChats = chats.filter((chat: any) => 
                    chat.user?.id === user.id && 
                    chat.timestamp >= todayStartKST &&
                    chat.text &&
                    GREETINGS.some(g => chat.text.toLowerCase().includes(g))
                );
                if (todayChats.length > 0) {
                    hasGreetingToday = true;
                    break;
                }
            }
            if (hasGreetingToday) {
                updateQuestProgress(updatedUser, 'chat_greeting', undefined, 1);
            }
        }
        
        modified = true;
    }

    // Weekly Quests
    if (isDifferentWeekKST(updatedUser.quests.weekly?.lastReset, now)) {
        updatedUser.quests.weekly = {
            quests: [],
            activityProgress: 0,
            claimedMilestones: [false, false, false, false, false],
            lastReset: now,
        };
        const newQuests: Quest[] = WEEKLY_QUESTS.map((q, i) => ({
            ...q, id: `q-w-${i}-${now}`, progress: 0, isClaimed: false,
        }));
        updatedUser.quests.weekly.quests = newQuests;
        modified = true;
    }
    
    // Monthly Quests
    if (isDifferentMonthKST(updatedUser.quests.monthly?.lastReset, now)) {
        updatedUser.quests.monthly = {
            quests: [],
            activityProgress: 0,
            claimedMilestones: [false, false, false, false, false],
            lastReset: now,
        };
         const newQuests: Quest[] = MONTHLY_QUESTS.map((q, i) => ({
            ...q, id: `q-m-${i}-${now}`, progress: 0, isClaimed: false,
        }));
        updatedUser.quests.monthly.quests = newQuests;
        modified = true;
    }

    const tournamentTypes: TournamentType[] = ['neighborhood', 'national', 'world'];
    const typesClearedVolatile = new Set<TournamentType>();
    for (const type of tournamentTypes) {
        const playedDateKey = `last${type.charAt(0).toUpperCase() + type.slice(1)}PlayedDate` as keyof User;
        const rewardClaimedKey = `${type}RewardClaimed` as keyof User;
        const tournamentKey = `last${type.charAt(0).toUpperCase() + type.slice(1)}Tournament` as keyof User;

        const lastPlayedRaw = (user as any)[playedDateKey] as number | undefined | null;
        const lastPlayed = typeof lastPlayedRaw === 'number' && lastPlayedRaw > 0 ? lastPlayedRaw : undefined;
        // playedDate가 없을 때 매 로그인마다 토너먼트를 지우면 진행 중 이어보기가 불가능해짐
        if (lastPlayed && isDifferentDayKST(lastPlayed, now)) {
            (updatedUser as any)[playedDateKey] = undefined;
            (updatedUser as any)[rewardClaimedKey] = undefined;
            (updatedUser as any)[tournamentKey] = null;
            modified = true;
            typesClearedVolatile.add(type);
        }

        // 입장일(컨디션 스냅샷)이 바뀐 날: 일일 입장이 리셋된 것과 동일 → 진행 중 던전 런만 무효
        const snap = updatedUser.dungeonConditionSnapshot?.[type];
        const snapDay = snap?.dateStartOfDayKST;
        if (snapDay && !isSameDayKST(snapDay, now)) {
            const ts = (updatedUser as any)[tournamentKey] as types.TournamentState | null | undefined;
            const rewardClaimed = !!(updatedUser as any)[rewardClaimedKey];
            const midRun =
                ts &&
                ts.currentStageAttempt != null &&
                ts.currentStageAttempt >= 1 &&
                ts.type === type &&
                ts.status !== 'complete' &&
                ts.status !== 'eliminated';
            if (midRun) {
                (updatedUser as any)[tournamentKey] = null;
                modified = true;
                typesClearedVolatile.add(type);
            }
            if (updatedUser.dungeonConditionSnapshot?.[type]) {
                delete updatedUser.dungeonConditionSnapshot[type];
                if (Object.keys(updatedUser.dungeonConditionSnapshot).length === 0) {
                    updatedUser.dungeonConditionSnapshot = undefined;
                }
                modified = true;
            }
        }
    }

    if (volatileState.activeTournaments) {
        const activeT = volatileState.activeTournaments[updatedUser.id];
        if (activeT && typesClearedVolatile.has(activeT.type)) {
            delete volatileState.activeTournaments[updatedUser.id];
        }
    }

    return modified ? updatedUser : user;
};

export const handleAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user?: User): Promise<HandleActionResult> => {
    const { type, payload } = action as any;
    const gameId = payload?.gameId;
    
    // 반복 액션 로그는 필요할 때만 켠다. 예: DEBUG_ACTION_LOGS=1 npm run start-server
    if (VERBOSE_ACTION_LOGS) {
        console.log(`[handleAction] Received action: ${type}, userId: ${action.userId}, gameId: ${gameId || 'none'}`);
    }
    
    // user가 전달되지 않은 경우에만 DB에서 조회 (중복 쿼리 방지)
    let userData = user;
    if (!userData) {
        const fetchedUser = await db.getUser(action.userId);
        if (!fetchedUser) {
            return { error: 'User not found.' };
        }
        userData = fetchedUser;
    }
    

    // 관리자 액션은 먼저 처리 (gameId가 있어도 관리자 액션은 여기서 처리)
    // ADMIN_SET_VIP_TEST_FLAGS·ADMIN_SET_DIAMOND_PACKAGE_TEST는 프로필 테스트용으로 userActions에서만 처리
    if (
        type.startsWith('ADMIN_') &&
        type !== 'ADMIN_SET_VIP_TEST_FLAGS' &&
        type !== 'ADMIN_SET_DIAMOND_PACKAGE_TEST'
    )
        return handleAdminAction(volatileState, action, userData);

    // 타워 게임 관련 액션은 먼저 처리 (gameId가 있어도 타워 액션은 여기서 처리)
    if (type === 'START_TOWER_GAME' || type === 'CONFIRM_TOWER_GAME_START' || type === 'TOWER_REFRESH_PLACEMENT' || type === 'TOWER_ADD_TURNS' || type === 'END_TOWER_GAME') {
        const { handleTowerAction } = await import('./actions/towerActions.js');
        return handleTowerAction(volatileState, action, userData);
    }

    // Guild actions should be handled before game actions (they don't require gameId)
    if (type.startsWith('GUILD_') || 
        type.startsWith('CREATE_GUILD') || 
        type.startsWith('JOIN_GUILD') || 
        type.startsWith('LEAVE_GUILD') || 
        type.startsWith('KICK_GUILD') || 
        type.startsWith('UPDATE_GUILD') || 
        type.startsWith('SEND_GUILD') || 
        type.startsWith('GET_GUILD') || 
        type === 'GET_MY_GUILD_WAR_ATTEMPT_LOG' ||
        type.startsWith('LIST_GUILDS') ||
        type.startsWith('START_GUILD') || 
        type.startsWith('DONATE_TO_GUILD') || 
        type.startsWith('PURCHASE_GUILD') || 
        type.startsWith('END_GUILD')) {
        if (VERBOSE_ACTION_LOGS) {
            console.log(`[handleAction] Routing GUILD action: ${type} to handleGuildAction`);
        }
        const { handleGuildAction } = await import('./actions/guildActions.js');
        const result = await handleGuildAction(volatileState, action, userData);
        if (VERBOSE_ACTION_LOGS && result?.error) {
            console.log(`[handleAction] GUILD action ${type} result: ERROR: ${result.error}`);
        }
        return result;
    }

    // 페어 로비·방·펫 등: payload에 gameId가 끼어 있어도 대국 액션으로 오인하지 않도록 먼저 소셜에서 처리
    // (예: 모바일에서 PAIR_LOBBY_ROOM_GRID_SLICE에 stray gameId → 전략 핸들러 400)
    if (type.startsWith('PAIR_')) {
        return handleSocialAction(volatileState, action, userData);
    }

    // 나가기: 게임이 DB/GC에서 이미 없어도 소셜 핸들러가 상태만 정리해야 함 (모바일 기보 저장 전 이탈 400 방지)
    if (type === 'LEAVE_GAME_ROOM' || type === 'LEAVE_AI_GAME') {
        return handleSocialAction(volatileState, action, userData);
    }

    // Game Actions (require gameId)
    // 도전의 탑은 클라이언트에서만 실행되므로 서버에서 착수 액션을 처리하지 않음
    // BUY_TOWER_ITEM은 payload에 gameId가 있어도 상점(handleShopAction)에서만 처리 (여기서 PVE 분기에 들어가면 빈 {}로 종료되어 구매가 실행되지 않음)
    if (gameId && type !== 'BUY_TOWER_ITEM') {
        // 싱글플레이 시작 확인은 게임 캐시/DB 조회 전 전용 핸들러로 보낸다.
        // 서버 재시작 직후 오래된 클라이언트 확인 요청이 일반 게임 라우팅에서 noisy 400으로 반복되는 것을 막는다.
        if (type === 'CONFIRM_SINGLE_PLAYER_GAME_START') {
            const { handleSinglePlayerAction } = await import('./actions/singlePlayerActions.js');
            return handleSinglePlayerAction(volatileState, action, userData);
        }

        // 싱글플레이·도전의 탑 미사일 액션 처리 (게임이 캐시에 없을 수 있음)
        if (type === 'START_MISSILE_SELECTION' || type === 'LAUNCH_MISSILE' || type === 'CANCEL_MISSILE_SELECTION' || type === 'MISSILE_INVALID_SELECTION' || type === 'MISSILE_ANIMATION_COMPLETE') {
            const { getCachedGame, updateGameCache } = await import('./gameCache.js');
            let preloadedGame = await getCachedGame(gameId);
            if (!preloadedGame) {
                const cache = volatileState.gameCache;
                if (cache) {
                    const cached = cache.get(gameId);
                    if (cached?.game) preloadedGame = cached.game as types.LiveGameSession;
                }
            }
            if (!preloadedGame) preloadedGame = await db.getLiveGame(gameId);
            const preloadedPolicy = preloadedGame ? resolveArenaSessionPolicy(preloadedGame) : null;
            if (preloadedPolicy?.kind === 'singleplayer') {
                const { handleSinglePlayerAction } = await import('./actions/singlePlayerActions.js');
                const result = await handleSinglePlayerAction(volatileState, action, userData);
                if (result && (result as any).error) return result;
                return result || { error: 'Failed to process single player missile action.' };
            }
            if (preloadedPolicy?.kind === 'tower') {
                // 탑: 메모리 캐시에 항목이 있으면 우선 사용 (CONFIRM 직후 DB가 pending일 수 있음)
                let game: types.LiveGameSession | null = null;
                const cache = volatileState.gameCache;
                if (cache) {
                    const cached = cache.get(gameId);
                    if (cached?.game) game = cached.game as types.LiveGameSession;
                }
                if (!game) game = await getCachedGame(gameId);
                if (!game && cache) {
                    const cached = cache.get(gameId);
                    if (cached) game = cached.game;
                }
                if (!game) game = await db.getLiveGame(gameId);
                if (!game) return { error: 'Game not found.' };
                if (resolveArenaSessionPolicy(game).kind !== 'tower') return { error: 'Not a tower game.' };
                // 탑: pending인데 아직 수가 없고 흑 차례면 CONFIRM 직후 상태로 간주 → playing으로 정규화
                if ((game as any).gameStatus === 'pending' && (!game.moveHistory || game.moveHistory.length === 0) && game.currentPlayer === types.Player.Black) {
                    (game as any).gameStatus = 'playing';
                    updateGameCache(game);
                }
                const towerFloor = (game as any).towerFloor ?? 0;
                if (towerFloor < 21) return { error: '1~20층에서는 미사일/히든/스캔 아이템을 사용할 수 없습니다. 21층 이상에서 사용 가능합니다.' };
                // 21층+: DB/캐시에서 불러온 게임에 아이템 수가 없으면 인벤토리 기준으로 복원
                const s = (game.settings || {}) as any;
                if ((game as any).missiles_p1 == null) {
                    (game as any).missiles_p1 = towerP1ConsumableAllowance(
                        countTowerLobbyInventoryQty(userData.inventory, ['미사일', 'missile', 'Missile']),
                        s.missileCount ?? 2
                    );
                }
                if ((game as any).hidden_stones_p1 == null) {
                    (game as any).hidden_stones_p1 = towerP1ConsumableAllowance(
                        countTowerLobbyInventoryQty(userData.inventory, ['히든', 'hidden', 'Hidden']),
                        s.hiddenStoneCount ?? 2
                    );
                }
                if ((game as any).scans_p1 == null) {
                    (game as any).scans_p1 = towerP1ConsumableAllowance(
                        countTowerLobbyInventoryQty(userData.inventory, ['스캔', 'scan', 'Scan', 'SCAN', '스캔권', '스캔 아이템']),
                        s.scanCount ?? 2
                    );
                }
                if (SPECIAL_GAME_MODES.some(m => m.mode === game.mode)) {
                    const { updateTowerPlayerHiddenState, cancelTowerScanningSessionForOtherItemUse } = await import(
                        './modes/towerPlayerHidden.js'
                    );
                    await updateTowerPlayerHiddenState(game, Date.now());
                    // TOWER_CLIENT_MOVE 등으로 클라가 앞서 있을 때 미사일 검증이 막히지 않게 (히든/스캔과 동일)
                    applyPveItemActionClientSync(game, payload);
                    if (type === 'START_MISSILE_SELECTION') {
                        cancelTowerScanningSessionForOtherItemUse(game);
                    }
                    const { handleStrategicGameAction } = await import('./modes/standard.js');
                    const result = await handleStrategicGameAction(volatileState, game, action, userData);
                    if (result && (result as any).error && process.env.NODE_ENV === 'development') {
                        console.log(`[handleAction] Tower missile/item action ${type} failed:`, { gameId, gameStatus: game.gameStatus, error: (result as any).error });
                    }
                    if (result && !(result as any).error) {
                        updateGameCache(game);
                        await db.saveGame(game);
                        const { broadcastToGameParticipants } = await import('./socket.js');
                        broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                    }
                    return result || {};
                }
            }
        }
        
        // 싱글플레이 자동 계가 트리거 (PLACE_STONE with triggerAutoScoring) 처리
        if (type === 'PLACE_STONE' && (payload as any)?.triggerAutoScoring) {
            // 싱글플레이 게임은 메모리 캐시에서 먼저 찾기 (PVE는 종료 전까지 DB에 저장되지 않으므로 캐시/메모리만 사용)
            const { getCachedGame, updateGameCache } = await import('./gameCache.js');
            let game = await getCachedGame(gameId);
            if (!game) {
                // TTL 만료 시에도 캐시에 있으면 사용 (싱글플레이는 DB에 없을 수 있음)
                const cache = volatileState.gameCache;
                if (cache) {
                    const cached = cache.get(gameId);
                    if (cached) {
                        console.log(`[handleAction] Found single player game in cache (expired TTL) for auto-scoring: gameId=${gameId}, gameStatus=${cached.game.gameStatus}`);
                        game = cached.game;
                        updateGameCache(game);
                    }
                }
            }
            if (!game) {
                game = await db.getLiveGame(gameId);
            }
            if (!game) {
                return { error: 'Game not found.' };
            }
            if (resolveArenaSessionPolicy(game).kind !== 'singleplayer') {
                return { error: 'Invalid single player game.' };
            }
            // handleStrategicGameAction을 통해 처리 (싱글플레이 게임도 전략 액션 핸들러 사용)
            const { handleStrategicGameAction } = await import('./modes/standard.js');
            const result = await handleStrategicGameAction(volatileState, game, action, userData);
            return result || {};
        }
        
        // 싱글플레이·도전의 탑 히든/스캔 액션 먼저 처리 (게임을 찾기 전에)
        const actionTypeStr = type as string;
        if (actionTypeStr === 'START_HIDDEN_PLACEMENT' || actionTypeStr === 'START_SCANNING' || actionTypeStr === 'SCAN_BOARD') {
            const { getCachedGame, updateGameCache } = await import('./gameCache.js');
            /** 타워 SCAN_BOARD: 핸들러는 세션을 먼저 깎는데 인벤 소비가 실패하면 sync가 세션을 다시 올려 '스캔이 돌아오는' 현상이 난다 → 소비 실패 시 롤백 */
            let towerScanBoardRevert: {
                scans_p1?: number;
                scans_p2?: number;
                gameStatus: string;
                animation: types.LiveGameSession['animation'];
                currentPlayer: types.Player;
                itemUseDeadline?: number;
                pausedTurnTimeLeft?: number;
                revealedHiddenMoves?: types.LiveGameSession['revealedHiddenMoves'];
                scannedAiInitialHiddenByUser?: Record<string, boolean>;
            } | null = null;
            // 탑: 메모리 캐시에 항목이 있으면 우선 사용 (CONFIRM 직후 DB가 pending일 수 있음)
            let game: types.LiveGameSession | null = null;
            const cacheForTower = volatileState.gameCache;
            if (cacheForTower) {
                const cached = cacheForTower.get(gameId);
                if (cached?.game) game = cached.game as types.LiveGameSession;
            }
            if (!game) game = await getCachedGame(gameId);
            if (!game && cacheForTower) {
                const cached = cacheForTower.get(gameId);
                if (cached) {
                    game = cached.game;
                    updateGameCache(game);
                }
            }
            if (!game) game = await db.getLiveGame(gameId);
            if (!game) {
                console.error(`[handleAction] Game not found: gameId=${gameId}, type=${type}`);
                return { error: 'Game not found.' };
            }
            const preItemPolicy = resolveArenaSessionPolicy(game);
            // 도전의 탑 1~20층: 미사일/히든/스캔 사용 불가
            if (preItemPolicy.kind === 'tower') {
                // 탑: pending인데 아직 수가 없고 흑 차례면 CONFIRM 직후 상태로 간주 → playing으로 정규화
                if ((game as any).gameStatus === 'pending' && (!game.moveHistory || game.moveHistory.length === 0) && game.currentPlayer === types.Player.Black) {
                    (game as any).gameStatus = 'playing';
                    updateGameCache(game);
                }
                const towerFloor = (game as any).towerFloor ?? 0;
                if (towerFloor < 21) return { error: '1~20층에서는 미사일/히든/스캔 아이템을 사용할 수 없습니다. 21층 이상에서 사용 가능합니다.' };
                // 21층+: DB/캐시에서 불러온 게임에 아이템 수가 없으면 인벤토리 기준으로 복원
                const s = (game.settings || {}) as any;
                if ((game as any).hidden_stones_p1 == null) {
                    (game as any).hidden_stones_p1 = towerP1ConsumableAllowance(
                        countTowerLobbyInventoryQty(userData.inventory, ['히든', 'hidden', 'Hidden']),
                        s.hiddenStoneCount ?? 2
                    );
                }
                if ((game as any).scans_p1 == null) {
                    (game as any).scans_p1 = towerP1ConsumableAllowance(
                        countTowerLobbyInventoryQty(userData.inventory, ['스캔', 'scan', 'Scan', 'SCAN', '스캔권', '스캔 아이템']),
                        s.scanCount ?? 2
                    );
                }
                if ((game as any).missiles_p1 == null) {
                    (game as any).missiles_p1 = towerP1ConsumableAllowance(
                        countTowerLobbyInventoryQty(userData.inventory, ['미사일', 'missile', 'Missile']),
                        s.missileCount ?? 2
                    );
                }
            }
            if (
                (actionTypeStr === 'START_SCANNING' ||
                    actionTypeStr === 'START_HIDDEN_PLACEMENT' ||
                    actionTypeStr === 'SCAN_BOARD') &&
                preItemPolicy.matchAxis !== 'pvp'
            ) {
                // HTTP 액션은 타이머 루프 없이 들어올 수 있어 scanning_animating이 남으면 playing이 아니라 400이 난다.
                const nowSync = Date.now();
                if (preItemPolicy.kind === 'tower') {
                    const { updateTowerPlayerHiddenState } = await import('./modes/towerPlayerHidden.js');
                    await updateTowerPlayerHiddenState(game, nowSync);
                } else if (preItemPolicy.kind === 'singleplayer') {
                    const { updateSinglePlayerHiddenState } = await import('./modes/singlePlayerHidden.js');
                    await updateSinglePlayerHiddenState(game, nowSync);
                }
                applyPveItemActionClientSync(game, payload, { preserveServerHiddenPlacementMeta: true });
                if (preItemPolicy.kind === 'tower' && actionTypeStr === 'SCAN_BOARD' && game.gameStatus === 'scanning') {
                    towerScanBoardRevert = {
                        scans_p1: game.scans_p1,
                        scans_p2: game.scans_p2,
                        gameStatus: String(game.gameStatus),
                        animation: game.animation,
                        currentPlayer: game.currentPlayer,
                        itemUseDeadline: game.itemUseDeadline,
                        pausedTurnTimeLeft: game.pausedTurnTimeLeft,
                        revealedHiddenMoves: game.revealedHiddenMoves
                            ? (JSON.parse(JSON.stringify(game.revealedHiddenMoves)) as types.LiveGameSession['revealedHiddenMoves'])
                            : undefined,
                        scannedAiInitialHiddenByUser: (game as { scannedAiInitialHiddenByUser?: Record<string, boolean> })
                            .scannedAiInitialHiddenByUser
                            ? (JSON.parse(
                                  JSON.stringify((game as { scannedAiInitialHiddenByUser?: Record<string, boolean> }).scannedAiInitialHiddenByUser)
                              ) as Record<string, boolean>)
                            : undefined,
                    };
                }
            }
            // 도전의 탑: PVE 히든/스캔은 towerPlayerHidden으로 처리 (싱글플레이와 동일 규칙)
            if (preItemPolicy.kind === 'tower' && SPECIAL_GAME_MODES.some(m => m.mode === game.mode)) {
                const isTowerHiddenAction = actionTypeStr === 'START_HIDDEN_PLACEMENT' || actionTypeStr === 'START_SCANNING' || actionTypeStr === 'SCAN_BOARD';
                if (isTowerHiddenAction) {
                    const { handleTowerPlayerHiddenAction } = await import('./modes/towerPlayerHidden.js');
                    const towerResult = handleTowerPlayerHiddenAction(volatileState, game, action, userData);
                    if (towerResult !== null) {
                        if (!(towerResult as any).error) {
                            const skipTowerScanInv = !!(towerResult as any).skipTowerScanInventoryConsume;
                            if (type === 'SCAN_BOARD' && !skipTowerScanInv) {
                                if (!consumeOneTowerLobbyInventoryItem(userData, TOWER_LOBBY_SCAN_NAMES)) {
                                    if (towerScanBoardRevert) {
                                        (game as any).scans_p1 = towerScanBoardRevert.scans_p1;
                                        (game as any).scans_p2 = towerScanBoardRevert.scans_p2;
                                        game.gameStatus = towerScanBoardRevert.gameStatus as types.LiveGameSession['gameStatus'];
                                        game.animation = towerScanBoardRevert.animation;
                                        game.currentPlayer = towerScanBoardRevert.currentPlayer;
                                        game.itemUseDeadline = towerScanBoardRevert.itemUseDeadline;
                                        game.pausedTurnTimeLeft = towerScanBoardRevert.pausedTurnTimeLeft;
                                        if (towerScanBoardRevert.revealedHiddenMoves !== undefined) {
                                            game.revealedHiddenMoves = towerScanBoardRevert.revealedHiddenMoves;
                                        } else {
                                            delete (game as { revealedHiddenMoves?: unknown }).revealedHiddenMoves;
                                        }
                                        if (towerScanBoardRevert.scannedAiInitialHiddenByUser !== undefined) {
                                            (game as { scannedAiInitialHiddenByUser?: Record<string, boolean> }).scannedAiInitialHiddenByUser =
                                                towerScanBoardRevert.scannedAiInitialHiddenByUser;
                                        } else {
                                            delete (game as { scannedAiInitialHiddenByUser?: unknown }).scannedAiInitialHiddenByUser;
                                        }
                                    }
                                    updateGameCache(game);
                                    await db.saveGame(game);
                                    const { broadcastToGameParticipants } = await import('./socket.js');
                                    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                                    return { error: '스캔 아이템이 없습니다.' };
                                }
                                await db.updateUser(userData).catch((err) =>
                                    console.error('[handleAction] tower SCAN_BOARD inventory save failed:', err)
                                );
                                const { broadcastUserUpdate } = await import('./socket.js');
                                const { updateUserCache } = await import('./gameCache.js');
                                broadcastUserUpdate(userData, ['inventory', 'gold', 'diamonds', 'towerFloor']);
                                updateUserCache(userData);
                            }
                            updateGameCache(game);
                            await db.saveGame(game);
                            const { broadcastToGameParticipants } = await import('./socket.js');
                            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                        }
                        return (towerResult as any).error ? towerResult : { ...towerResult, clientResponse: { gameId: game.id, game } };
                    }
                }
                const { handleStrategicGameAction } = await import('./modes/standard.js');
                const result = await handleStrategicGameAction(volatileState, game, action, userData);
                if (result && (result as any).error && process.env.NODE_ENV === 'development') {
                    console.log(`[handleAction] Tower hidden/scan action ${type} failed:`, { gameId, gameStatus: game.gameStatus, error: (result as any).error });
                }
                if (result && !(result as any).error) {
                    updateGameCache(game);
                    await db.saveGame(game);
                    const { broadcastToGameParticipants } = await import('./socket.js');
                    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                }
                return result || {};
            }
            if (preItemPolicy.kind === 'singleplayer') {
                // PLACE_STONE은 히든 아이템 사용 시 서버에서 처리해야 함
                const actionType = type as string;
                if (actionType === 'PLACE_STONE' && (game.gameStatus === 'hidden_placing' || (payload as any)?.isHidden)) {
                    console.log(`[handleAction] Processing single player PLACE_STONE with hidden item: type=${type}, gameId=${gameId}, gameStatus=${game.gameStatus}, isHidden=${(payload as any)?.isHidden}`);
                    // strategic 모드 핸들러로 라우팅 (히든 아이템 처리 포함)
                    if (SPECIAL_GAME_MODES.some(m => m.mode === game.mode)) {
                        const { handleStrategicGameAction } = await import('./modes/standard.js');
                        const { updateGameCache } = await import('./gameCache.js');
                        const result = await handleStrategicGameAction(volatileState, game, action, userData);
                        if (result && !result.error) {
                            updateGameCache(game);
                            await db.saveGame(game);
                            const { broadcastToGameParticipants } = await import('./socket.js');
                            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                        }
                        return result || {};
                    }
                }
                console.log(`[handleAction] Processing single player action: type=${type}, gameId=${gameId}, gameStatus=${game.gameStatus}`);
                const { handleSinglePlayerAction } = await import('./actions/singlePlayerActions.js');
                const singlePlayerResult = await handleSinglePlayerAction(volatileState, action, userData);
                return singlePlayerResult || {};
            }
        }
        
        // PLACE_STONE (히든 아이템 사용) 도전의 탑 처리
        if (type === 'PLACE_STONE' && (payload as any)?.isHidden) {
            const { getCachedGame, updateGameCache } = await import('./gameCache.js');
            let game = await getCachedGame(gameId);
            if (!game) {
                const cache = volatileState.gameCache;
                if (cache) { const c = cache.get(gameId); if (c) game = c.game; }
            }
            if (!game) game = await db.getLiveGame(gameId);
            if (!game) return { error: 'Game not found.' };
            if (resolveArenaSessionPolicy(game).kind === 'tower' && (game.gameStatus === 'hidden_placing' || (payload as any)?.isHidden)) {
                if (SPECIAL_GAME_MODES.some(m => m.mode === game.mode)) {
                    const { handleStrategicGameAction } = await import('./modes/standard.js');
                    const result = await handleStrategicGameAction(volatileState, game, action, userData);
                    if (result && !(result as any).error) {
                        if ((payload as any)?.isHidden && consumeOneTowerLobbyInventoryItem(userData, TOWER_LOBBY_HIDDEN_NAMES)) {
                            await db.updateUser(userData).catch((err) =>
                                console.error('[handleAction] tower hidden PLACE_STONE inventory save failed:', err)
                            );
                            const { broadcastUserUpdate } = await import('./socket.js');
                            const { updateUserCache } = await import('./gameCache.js');
                            broadcastUserUpdate(userData, ['inventory', 'gold', 'diamonds', 'towerFloor']);
                            updateUserCache(userData);
                        }
                        updateGameCache(game);
                        await db.saveGame(game);
                        const { broadcastToGameParticipants } = await import('./socket.js');
                        broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                    }
                    return result || {};
                }
            }
        }
        
        // 캐시를 사용하여 DB 조회 최소화
        const { getCachedGame, updateGameCache } = await import('./gameCache.js');
        let game = await getCachedGame(gameId);
        if (!game) {
            game = await db.getLiveGame(gameId);
            if (game) updateGameCache(game);
        }
        if (!game) {
            console.error(`[handleAction] Game not found: gameId=${gameId}, type=${type}`);
            return { error: 'Game not found.' };
        }
        
        const initialPolicy = resolveArenaSessionPolicy(game);
        // 도전의 탑 21층+: 세션 필드가 비어 있으면 대기실 인벤 기준으로만 채움 (무료 기본 개수 없음)
        if (initialPolicy.kind === 'tower' && (game as any).towerFloor >= 21 && game.settings) {
            const s = game.settings as any;
            const inv = userData.inventory || [];
            if ((game as any).missiles_p1 == null && s.missileCount != null) {
                (game as any).missiles_p1 = towerP1ConsumableAllowance(
                    countTowerLobbyInventoryQty(inv, ['미사일', 'missile', 'Missile']),
                    s.missileCount ?? 2
                );
            }
            if ((game as any).hidden_stones_p1 == null && s.hiddenStoneCount != null) {
                (game as any).hidden_stones_p1 = towerP1ConsumableAllowance(
                    countTowerLobbyInventoryQty(inv, ['히든', 'hidden', 'Hidden']),
                    s.hiddenStoneCount ?? 2
                );
            }
            if ((game as any).scans_p1 == null && s.scanCount != null) {
                (game as any).scans_p1 = towerP1ConsumableAllowance(
                    countTowerLobbyInventoryQty(inv, ['스캔', 'scan', 'Scan', 'SCAN', '스캔권', '스캔 아이템']),
                    s.scanCount ?? 2
                );
            }
        }
        
        if (process.env.NODE_ENV === 'development') {
            const gcat = resolveArenaSessionPolicy(game).kind;
            const tf = (game as any).towerFloor;
            const tfPart = tf != null && tf !== '' ? `, towerFloor=${tf}` : '';
            console.log(`[handleAction] Game found: gameId=${gameId}, type=${type}, arenaKind=${gcat}, gameStatus=${game.gameStatus}${tfPart}`);
        }

        // 전략바둑 AI 대국: 클라이언트 복구/타임아웃 시 서버에서 makeAiMove(goAiBot → Kata)로 해당 국면 수 계산
        if (type === 'REQUEST_SERVER_AI_MOVE') {
            return runGameActionSerial(game.id, async () => {
            const goModesForServerAi: GameMode[] = [
                GameMode.Standard,
                GameMode.Capture,
                GameMode.Speed,
                GameMode.Base,
                GameMode.Hidden,
                GameMode.Missile,
                GameMode.Mix,
            ];
            if (!goModesForServerAi.includes(game.mode as GameMode)) {
                return { error: 'Server AI move is only available for strategic Go modes.' };
            }
            const pairClassicForServerAi = isPairClassicGame(game.settings, game.mode as GameMode);
            const pairSeatForServerAi = pairClassicForServerAi ? getCurrentPairTurnSeat(game.settings) : null;
            const isPairServerAiSeat = Boolean(pairSeatForServerAi && isPairAiSeat(pairSeatForServerAi));
            const aiMovePolicy = resolveArenaSessionPolicy(game);
            const pveLikeForServerAiGate = aiMovePolicy.matchAxis !== 'pvp';
            if (!aiMovePolicy.isStrategicAiLike && !isPairServerAiSeat && !pveLikeForServerAiGate) {
                return { error: 'Not an AI game.' };
            }
            // 도전의 탑·싱글플레이·모험: 클라 판이 서버보다 앞설 수 있음 → Kata 호출 전 클라 스냅샷으로 맞춤
            if (
                aiMovePolicy.requiresClientSyncBeforeAction &&
                (payload as any)?.clientSync
            ) {
                const cs = (payload as any).clientSync as Record<string, unknown> | undefined;
                applyPveItemActionClientSync(game, { clientSync: cs });
                // CONFIRM/WS 타이밍으로 서버만 pending인데 클라는 이미 본대국인 경우
                if (game.gameStatus === 'pending') {
                    const clientSaysPlaying = String(cs?.gameStatus) === 'playing';
                    const clientMoves = Array.isArray(cs?.moveHistory) ? (cs.moveHistory as { x?: number; y?: number }[]) : [];
                    const hasClientMoves = clientMoves.some(
                        (m) => m && typeof m.x === 'number' && typeof m.y === 'number' && m.x >= 0 && m.y >= 0
                    );
                    const hasMovesAfterSync = (game.moveHistory?.length ?? 0) > 0;
                    if (clientSaysPlaying || hasClientMoves || hasMovesAfterSync) {
                        (game as any).gameStatus = 'playing';
                    }
                }
                // 본대국으로 정규화할 때는 타이머만 정리한다. AI 히든 연출(ai_thinking·aiHiddenItemAnimationEndTime, 길이는 gameSettings의 AI_HIDDEN_ITEM_THINKING_DURATION_MS)은
                // 여기서 지우면 안 된다 — 다음 REQUEST에서 makeGoAiBotMove가 만료 분기로 pendingAiHiddenPlacement를
                // 세팅해야 실제 히든 착수가 이어진다. 무조건 제거 시 연출 없이 즉시 백 차례로 돌아가는 버그가 난다.
                if (String(game.gameStatus) === 'playing') {
                    game.itemUseDeadline = undefined;
                    game.pausedTurnTimeLeft = undefined;
                }
            }
            const uid = userData.id;
            if (game.player1.id !== uid && game.player2.id !== uid) {
                return { error: '해당 경기 참가자가 아닙니다.' };
            }
            const { aiUserId } = await import('./aiPlayer.js');
            const currentActorIdForServerAi =
                pairClassicForServerAi && pairSeatForServerAi
                    ? pairSeatForServerAi.participantId
                    : game.currentPlayer === types.Player.Black
                      ? game.blackPlayerId
                      : game.whitePlayerId;
            const isAiTurn =
                isPairServerAiSeat ||
                (!pairClassicForServerAi &&
                    (currentActorIdForServerAi === aiUserId ||
                        (currentActorIdForServerAi &&
                            String(currentActorIdForServerAi).startsWith('dungeon-bot-'))));
            const isPveLikeAiGame = aiMovePolicy.matchAxis !== 'pvp';
            /** 전략바둑 본대국 전 단계 — Kata 착수 금지(복구 요청은 noop). 수순이 이미 있으면 아래에서 playing으로 정합성 보정 */
            const pveStrategicPrePlayStatuses = new Set([
                'negotiating',
                'nigiri_choosing',
                'nigiri_guessing',
                'nigiri_reveal',
                'pair_order_reveal',
                'base_placement',
                'base_stone_color_choice',
                'base_same_color_points_bid',
                'base_game_start_confirmation',
                'capture_bidding',
                'capture_reveal',
                'capture_tiebreaker',
                'color_start_confirmation',
                'turn_preference_selection',
                'turn_preference_roulette',
            ]);
            const countPvePlayableMoves = (): number =>
                (game.moveHistory || []).filter(
                    (m) =>
                        m &&
                        typeof m.x === 'number' &&
                        typeof m.y === 'number' &&
                        Number.isInteger(m.x) &&
                        Number.isInteger(m.y) &&
                        m.x >= 0 &&
                        m.y >= 0,
                ).length;
            if (isPveLikeAiGame) {
                const st0 = String(game.gameStatus);
                const playable0 = countPvePlayableMoves();
                if (pveStrategicPrePlayStatuses.has(st0) && playable0 > 0) {
                    if (process.env.NODE_ENV === 'development') {
                        console.warn(
                            `[REQUEST_SERVER_AI_MOVE] Coherence: pre-play status=${st0} with ${playable0} moves -> playing game=${game.id}`,
                        );
                    }
                    (game as any).gameStatus = 'playing';
                    game.itemUseDeadline = undefined;
                    game.pausedTurnTimeLeft = undefined;
                }
            }
            const transitionalStatusesForPve = new Set([
                'hidden_reveal_animating',
                'scanning',
                'scanning_animating',
                'missile_selecting',
                'missile_animating',
                'hidden_final_reveal',
                'scoring',
                'ended',
                'no_contest',
                'pending',
                ...pveStrategicPrePlayStatuses,
            ]);
            const pveNonErrorNoop = (): { clientResponse: { serverAiMoveDone: boolean; skippedReason: string; game: types.LiveGameSession } } => ({
                clientResponse: {
                    serverAiMoveDone: false,
                    skippedReason: 'SERVER_AI_WAITING_STATE',
                    game,
                },
            });
            // 도전의 탑/싱글/모험 PVE는 클라 복구 요청이 중복으로 들어와도 절대 400을 내지 않는다.
            if (isPveLikeAiGame && transitionalStatusesForPve.has(String(game.gameStatus))) {
                return pveNonErrorNoop();
            }
            if (!isAiTurn) {
                // 탑/싱글/모험 PVE는 클라이언트가 복구성 요청을 중복 전송할 수 있다.
                // 이미 유저 턴으로 넘어간 상태를 400으로 내리면 클라이언트가 오류로 간주해 재연결 루프가 날 수 있으므로 무해 응답.
                if (isPveLikeAiGame) {
                    return pveNonErrorNoop();
                }
                return { error: 'Not AI turn.' };
            }
            if (game.gameStatus === 'hidden_reveal_animating') {
                // 히든 전체공개 연출 중 요청은 정상적인 과도기 상태다.
                // 에러를 내면 클라이언트 복구 루프가 400을 반복하며 "AI 멈춤"으로 보일 수 있으므로 no-op 처리한다.
                return { success: true, clientResponse: { waitingForHiddenReveal: true } } as any;
            }
            if (game.gameStatus !== 'playing' && game.gameStatus !== 'hidden_placing') {
                // 히든/스캔/미사일 애니 전환 중에는 AI 착수를 바로 처리할 수 없다.
                // PVE에서는 이 상태를 정상 대기 상태로 돌려 400을 피한다.
                if (isPveLikeAiGame && transitionalStatusesForPve.has(String(game.gameStatus))) {
                    return pveNonErrorNoop();
                }
                return { error: 'Game not in playing state.' };
            }
            const { makeAiMove } = await import('./aiPlayer.js');
            const {
                waitUntilAiProcessingReleased,
                syncAiSession,
                cancelAiProcessing,
                isAiProcessing,
            } = await import('./aiSessionManager.js');
            const beforeMoveLen = game.moveHistory?.length ?? 0;
            const beforePlayer = game.currentPlayer;
            const currentSeatNeedsServerAi = (): boolean => {
                if (pairClassicForServerAi) {
                    const s = getCurrentPairTurnSeat(game.settings);
                    return Boolean(s && isPairAiSeat(s));
                }
                const id =
                    game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                return (
                    id === aiUserId || Boolean(id && String(id).startsWith('dungeon-bot-'))
                );
            };
            // 세션/락 꼬임으로 shouldProcessAiTurn이 영구 false가 되는 경우를 복구
            await waitUntilAiProcessingReleased(game.id, 3000);
            if (isAiProcessing(game.id)) {
                // 이미 메인 루프/큐가 같은 턴의 Kata 요청을 처리 중이면 절대 잠금을 강제로 풀지 않는다.
                // 여기서 cancel 후 재호출하면 같은 수순으로 /move가 두 번 나가고, 늦은 GAME_UPDATE가 보드를 되돌릴 수 있다.
                return {
                    clientResponse: {
                        serverAiMoveDone: false,
                        skippedReason: 'AI_MOVE_ALREADY_PROCESSING',
                        game,
                    },
                };
            }
            // AI 차례에서는 allowAdvanceOnAiTurn을 쓰면 lastProcessedMoveCount가 현재 수순으로 고정되어
            // shouldProcessAiTurn이 false가 될 수 있다. 기본 동기화로 "한 수 전" 복구를 허용한다.
            syncAiSession(game, aiUserId);
            cancelAiProcessing(game.id);
            try {
                await makeAiMove(game);
            } catch (e: any) {
                console.error(`[REQUEST_SERVER_AI_MOVE] makeAiMove failed for ${game.id}:`, e?.message ?? e);
                // 즉시 실패하더라도 큐 재시도를 예약해 AI 턴 영구 정지를 방지한다.
                const { aiProcessingQueue } = await import('./aiProcessingQueue.js');
                aiProcessingQueue.enqueue(game.id);
                if (isPveLikeAiGame) {
                    return {
                        clientResponse: {
                            serverAiMoveDone: false,
                            skippedReason: 'AI_MOVE_FAILED_RETRYING',
                            game,
                        },
                    };
                }
                return { error: `AI_MOVE_FAILED_RETRYING: ${e?.message ?? 'unknown_error'}` };
            }
            const afterMoveLen = game.moveHistory?.length ?? 0;
            const aiStillToMove =
                game.currentPlayer === beforePlayer && currentSeatNeedsServerAi();
            if (afterMoveLen <= beforeMoveLen && aiStillToMove) {
                // 1회 더 강제 복구 시도 (락 유실/세션 꼬임 잔존 케이스)
                if (isAiProcessing(game.id)) {
                    return {
                        clientResponse: {
                            serverAiMoveDone: false,
                            skippedReason: 'AI_MOVE_ALREADY_PROCESSING',
                            game,
                        },
                    };
                }
                cancelAiProcessing(game.id);
                syncAiSession(game, aiUserId);
                try {
                    await makeAiMove(game);
                } catch (e: any) {
                    console.error(`[REQUEST_SERVER_AI_MOVE] second makeAiMove failed for ${game.id}:`, e?.message ?? e);
                    const { aiProcessingQueue } = await import('./aiProcessingQueue.js');
                    aiProcessingQueue.enqueue(game.id);
                    if (isPveLikeAiGame) {
                        return {
                            clientResponse: {
                                serverAiMoveDone: false,
                                skippedReason: 'AI_MOVE_FAILED_RETRYING',
                                game,
                            },
                        };
                    }
                    return { error: `AI_MOVE_FAILED_RETRYING: ${e?.message ?? 'unknown_error'}` };
                }
            }
            const finalMoveLen = game.moveHistory?.length ?? 0;
            const stillAiTurnAfterRetries =
                game.currentPlayer !== types.Player.None && currentSeatNeedsServerAi();
            const isPlayingLikeState = game.gameStatus === 'playing' || game.gameStatus === 'hidden_placing';
            if (finalMoveLen <= beforeMoveLen && stillAiTurnAfterRetries && isPlayingLikeState) {
                // makeAiMove 내부 조기 return(히든 연출/동기화 지연 등)로 무진행이면 요청 단위에서 즉시 재큐잉해 교착을 줄인다.
                const { aiProcessingQueue } = await import('./aiProcessingQueue.js');
                aiProcessingQueue.enqueue(game.id);
                if (isPveLikeAiGame) {
                    return {
                        clientResponse: {
                            serverAiMoveDone: false,
                            skippedReason: 'AI_MOVE_STALLED_REQUEUED',
                            game,
                        },
                    };
                }
                return { error: 'AI_MOVE_STALLED_REQUEUED' };
            }
            updateGameCache(game);
            await db.saveGame(game);
            const { broadcastToGameParticipants } = await import('./socket.js');
            const payloadGame = game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0
                ? { ...game, boardState: game.boardState.map((row: number[]) => [...row]) }
                : game;
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: payloadGame } }, game);
            // PVE는 WS만 기다리면 지연·병합으로 AI 착수가 화면에 안 보일 수 있음 → HTTP 응답으로 즉시 동기화
            return { clientResponse: { serverAiMoveDone: true, game: payloadGame } };
            });
        }

        if (type === 'REQUEST_GAME_STATE_SYNC') {
            return runGameActionSerial(game.id, async () => {
            const uid = userData.id;
            if (game.player1.id !== uid && game.player2.id !== uid) {
                return { error: '해당 경기 참가자가 아닙니다.' };
            }
            const goModes: GameMode[] = [
                GameMode.Standard,
                GameMode.Capture,
                GameMode.Speed,
                GameMode.Base,
                GameMode.Hidden,
                GameMode.Missile,
                GameMode.Mix,
            ];
            const requestSyncPolicy = resolveArenaSessionPolicy(game);
            if (!requestSyncPolicy.isStrategicAiLike || !goModes.includes(game.mode)) {
                return { error: '이 경기 유형에서는 동기화를 지원하지 않습니다.' };
            }
            if (requestSyncPolicy.kind === 'tower' || requestSyncPolicy.kind === 'singleplayer') {
                return { error: '이 경기 유형에서는 동기화를 지원하지 않습니다.' };
            }
            const { waitUntilAiProcessingReleased, syncAiSession } = await import('./aiSessionManager.js');
            const { aiUserId, makeAiMove } = await import('./aiPlayer.js');
            await waitUntilAiProcessingReleased(game.id, 10_000);
            const fresh = await db.getLiveGame(gameId);
            if (!fresh) {
                return { error: 'Game not found.' };
            }
            const beforeSyncStatus = game.gameStatus;
            Object.assign(game, JSON.parse(JSON.stringify(fresh)) as types.LiveGameSession);
            // DB가 페어 순서 모달 단계로 남아 있는데 이미 본대국으로 진행된 경우(저장·배치 레이스) 복구
            if (
                isPairClassicGame(game.settings, game.mode as GameMode) &&
                Boolean(game.settings?.pairGame?.turnOrder?.length) &&
                game.gameStatus === 'pair_order_reveal' &&
                beforeSyncStatus === 'playing'
            ) {
                game.gameStatus = 'playing';
            }
            syncAiSession(game, aiUserId);
            try {
                const { updateHiddenState } = await import('./modes/hidden.js');
                await updateHiddenState(game, Date.now());
            } catch (e: any) {
                console.error('[GameActions] REQUEST_GAME_STATE_SYNC updateHiddenState failed:', e?.message);
            }
            const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
            /** 클라이언트 AI(WASM)만 쓰는 판도 동기화 직후 막히면 서버 makeAiMove로 복구 — 히든 초기 배치 단계 포함 */
            const aiRecoverableStatus =
                game.gameStatus === 'playing' ||
                game.gameStatus === 'hidden_placing' ||
                game.gameStatus === 'hidden_reveal_animating' ||
                game.gameStatus === 'scanning_animating';
            const isAiTurnNow =
                aiRecoverableStatus &&
                game.currentPlayer !== types.Player.None &&
                (currentPlayerId === aiUserId ||
                    (currentPlayerId && String(currentPlayerId).startsWith('dungeon-bot-')));
            if (isAiTurnNow) {
                await waitUntilAiProcessingReleased(game.id, 3000);
                try {
                    await makeAiMove(game);
                } catch (e: any) {
                    console.error('[GameActions] REQUEST_GAME_STATE_SYNC makeAiMove failed:', e?.message);
                }
            }
            updateGameCache(game);
            await db.saveGame(game);
            const { broadcastToGameParticipants } = await import('./socket.js');
            const payloadGame =
                game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0
                    ? { ...game, boardState: game.boardState.map((row: number[]) => [...row]) }
                    : game;
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: payloadGame } }, game);
            return { clientResponse: { synced: true } };
            });
        }

        if (game.gameStatus === 'ended' || game.gameStatus === 'no_contest' || game.gameStatus === 'scoring') {
            const blockedAfterEndActions = new Set([
                'PLACE_STONE',
                'PASS_TURN',
                'PLACE_BASE_STONE',
                'PLACE_REMAINING_BASE_STONES_RANDOMLY',
                'RESET_MY_BASE_STONE_PLACEMENTS',
                'UNDO_LAST_BASE_STONE_PLACEMENT',
                'CONFIRM_BASE_PLACEMENT_COMPLETE',
                'START_HIDDEN_PLACEMENT',
                'START_SCANNING',
                'SCAN_BOARD',
                'START_MISSILE_SELECTION',
                'LAUNCH_MISSILE',
                'MISSILE_INVALID_SELECTION',
                'CANCEL_MISSILE_SELECTION',
                'MISSILE_ANIMATION_COMPLETE',
                'REQUEST_SCORING',
                'OMOK_PLACE_STONE',
                'DICE_READY_FOR_TURN_ROLL',
                'DICE_CHOOSE_TURN',
                'DICE_CONFIRM_START',
                'DICE_ROLL',
                'DICE_PLACE_STONE',
                'DICE_PLACE_STONES_BATCH',
                'CONFIRM_THIEF_ROLE',
                'THIEF_ROLL_DICE',
                'THIEF_PLACE_STONE',
                'ALKKAGI_PLACE_STONE',
                'SINGLE_PLAYER_REFRESH_PLACEMENT',
                'TOWER_REFRESH_PLACEMENT',
                'TOWER_ADD_TURNS',
                'REQUEST_SERVER_AI_MOVE',
            ]);
            if (blockedAfterEndActions.has(type)) {
                return { error: '이미 종료된 경기에서는 진행할 수 없습니다.' };
            }
        }

        // 일반 AI 대국의 수동 일시정지 중에는 착수/통과 등 주요 게임 액션을 차단
        const arenaPolicy = resolveArenaSessionPolicy(game);
        const isManuallyPausedAi = isAiLobbyManualClockPause(game);
        if (isManuallyPausedAi) {
            const allowedWhilePaused = new Set([
                'RESUME_AI_GAME',
                'LEAVE_AI_GAME',
                'LEAVE_GAME_ROOM',
                'SEND_CHAT_MESSAGE',
                'LEAVE_SPECTATING',
                'SET_USER_STATUS',
                'REQUEST_GAME_STATE_SYNC',
            ]);
            if (!allowedWhilePaused.has(type)) {
                return { error: '일시 정지 상태에서는 해당 동작을 할 수 없습니다.' };
            }
        }
        
        // AI 게임은 서버에서 진행/검증/AI 수 처리까지 담당해야 하므로 PVE로 분류하지 않음
        // (싱글플레이/도전의 탑만 클라이언트 전용 처리)
        const isPVEGame = arenaPolicy.matchAxis !== 'pvp';

        // AI 게임 시작 확인은 게임 분류와 상관없이 서버에서 처리 (대국실 입장 후 시작 버튼)
        if (type === 'CONFIRM_AI_GAME_START') {
            const { handleAiAction } = await import('./actions/aiActions.js');
            return handleAiAction(volatileState, action, userData);
        }
        if (isPVEGame) {
            // 계가 요청은 서버에서 처리
            if (type === 'REQUEST_SCORING') {
                const payloadBoardState = Array.isArray(payload?.boardState)
                    ? payload.boardState.map((row: unknown) => (Array.isArray(row) ? [...row] : row))
                    : undefined;
                const payloadMoveHistory = Array.isArray(payload?.moveHistory)
                    ? payload.moveHistory.map((move: Record<string, unknown>) => ({ ...move }))
                    : undefined;
                const payloadSettings = payload?.settings && typeof payload.settings === 'object'
                    ? { ...payload.settings }
                    : undefined;
                const boardSize = game.settings?.boardSize ?? 19;
                const isValidBoardState = (board: unknown): board is number[][] =>
                    Array.isArray(board) &&
                    board.length === boardSize &&
                    board.every((row) => Array.isArray(row) && row.length === boardSize);
                const boardState = isValidBoardState(payloadBoardState) ? payloadBoardState : game.boardState;
                const moveHistory = Array.isArray(payloadMoveHistory) ? payloadMoveHistory : game.moveHistory;
                // KataGo는 "바둑 종료 후 계가(스코어링)"에만 사용
                // 클라이언트에서 임의로 분석을 요청하는 것을 방지하기 위해,
                // 마지막 2수 연속 패스(= 종료 조건)일 때만 허용합니다.
                const isPass = (m: any) => m && m.x === -1 && m.y === -1;
                if (!Array.isArray(moveHistory) || moveHistory.length < 2) {
                    return { error: '계가를 요청하려면 수순이 필요합니다.' };
                }
                const lastTwo = moveHistory.slice(-2);
                if (!isPass(lastTwo[0]) || !isPass(lastTwo[1])) {
                    return { error: '계가는 두 번 연속 패스 후에만 가능합니다.' };
                }

                // KataGo를 사용한 계가 분석
                const { analyzeGame, getScoringKataGoLimits } = await import('./kataGoService.js');
                const analysisGame = {
                    ...game,
                    boardState,
                    moveHistory,
                    settings: { ...game.settings, ...payloadSettings },
                };
                const lim = getScoringKataGoLimits();
                const analysis = await analyzeGame(analysisGame, {
                    includePolicy: false,
                    includeOwnership: true,
                    maxVisits: lim.maxVisits,
                    maxTimeSec: lim.maxTimeSec,
                });
                // 싱글플레이어: 계가 완료 시 서버에서 endGame 호출하여 클리어/보상 저장 (다음 스테이지 잠금 해제, 골드/경험치 지급)
                if (arenaPolicy.kind === 'singleplayer' && game.stageId) {
                    const blackTotal = analysis?.scoreDetails?.black?.total ?? 0;
                    const whiteTotal = analysis?.scoreDetails?.white?.total ?? 0;
                    const winner = blackTotal > whiteTotal ? types.Player.Black : types.Player.White; // 인간 = Black
                    const { getCachedGame } = await import('./gameCache.js');
                    let freshGame = await getCachedGame(game.id);
                    if (!freshGame) freshGame = await db.getLiveGame(game.id);
                    if (freshGame && freshGame.gameStatus !== 'ended') {
                        freshGame.finalScores = { black: blackTotal, white: whiteTotal };
                        const { endGame } = await import('./summaryService.js');
                        await endGame(freshGame, winner, 'score');
                    }
                }
                return {
                    clientResponse: {
                        scoringAnalysis: analysis
                    }
                };
            }
            // CONFIRM_SINGLE_PLAYER_GAME_START는 서버에서 처리해야 함 (게임 시작 확인)
            if (type === 'CONFIRM_SINGLE_PLAYER_GAME_START') {
                const { handleSinglePlayerAction } = await import('./actions/singlePlayerActions.js');
                return handleSinglePlayerAction(volatileState, action, userData);
            }
            // 싱글플레이 게임 종료 (클라이언트가 승리 조건 감지 후 전송 - 따내기 바둑 등)
            if (type === 'END_SINGLE_PLAYER_GAME' && arenaPolicy.kind === 'singleplayer' && game.stageId) {
                const { winner, winReason } = payload;
                if (winner !== types.Player.Black && winner !== types.Player.White) {
                    return { error: 'Invalid winner in payload.' };
                }
                if (game.gameStatus === 'ended') {
                    return { clientResponse: { gameId: game.id, game } };
                }
                const { getCachedGame } = await import('./gameCache.js');
                let freshGame = await getCachedGame(game.id);
                if (!freshGame) freshGame = await db.getLiveGame(game.id);
                if (!freshGame) return { error: 'Game not found.' };
                applyPveFinalSnapshotFromPayload(freshGame, payload as Record<string, unknown>);
                const { endGame } = await import('./summaryService.js');
                await endGame(freshGame, winner, winReason || 'capture_limit');
                const savedGame = await db.getLiveGame(game.id);
                const updatedUser = await db.getUser(freshGame.player1.id);
                return { clientResponse: { gameId: game.id, game: savedGame || freshGame, updatedUser: updatedUser ?? undefined } };
            }
            // 미사일 액션은 서버에서 처리해야 함 (게임 상태 변경)
            if (type === 'START_MISSILE_SELECTION' || type === 'LAUNCH_MISSILE' || type === 'CANCEL_MISSILE_SELECTION' || type === 'MISSILE_INVALID_SELECTION' || type === 'MISSILE_ANIMATION_COMPLETE') {
                // 싱글플레이 게임의 경우 싱글플레이 핸들러로 라우팅 (이미 위에서 처리했지만 중복 방지)
                if (arenaPolicy.kind === 'singleplayer') {
                    const { handleSinglePlayerAction } = await import('./actions/singlePlayerActions.js');
                    const result = await handleSinglePlayerAction(volatileState, action, userData);
                    // singlePlayerActions에서 이미 저장 및 브로드캐스트를 처리하므로 여기서는 결과만 반환
                    return result || {};
                }
                // 전략 게임 핸들러를 통해 미사일 액션 처리
                if (SPECIAL_GAME_MODES.some(m => m.mode === game.mode)) {
                    // START_MISSILE_SELECTION 전 상태 저장 (변경 확인용)
                    const statusBefore = game.gameStatus;
                    const result = await handleStrategicGameAction(volatileState, game, action, userData);

                    // MISSILE_ANIMATION_COMPLETE: 착지 따내기 점수가 이번 요청에서 반영된 뒤 즉시 목표 달성 종료(메인 루프 틱을 기다리지 않음)
                    if (type === 'MISSILE_ANIMATION_COMPLETE' && game.gameStatus === 'playing') {
                        const { tryEndGameWhenCaptureTargetReached } = await import('./utils/captureTargets.js');
                        await tryEndGameWhenCaptureTargetReached(game, game.currentPlayer);
                    }

                    // MISSILE_ANIMATION_COMPLETE는 항상 게임 상태가 변경되므로 반드시 브로드캐스트
                    if (type === 'MISSILE_ANIMATION_COMPLETE') {
                        console.log(`[GameActions] MISSILE_ANIMATION_COMPLETE: gameStatus=${game.gameStatus}, always broadcasting update for game ${game.id}`);
                        const { broadcastItemPhaseSnapshot } = await import('./utils/broadcastItemPhaseSnapshot.js');
                        await broadcastItemPhaseSnapshot(game);
                        return result || { clientResponse: { gameUpdated: true } };
                    }
                    
                    // START_MISSILE_SELECTION: 성공 시(최초 전환·멱등 재동기화) 반드시 브로드캐스트
                    if (type === 'START_MISSILE_SELECTION') {
                        const missileStartFailed = !!(result && (result as { error?: string }).error);
                        if (game.gameStatus === 'missile_selecting' && !missileStartFailed) {
                            if (statusBefore !== 'missile_selecting') {
                                console.log(
                                    `[GameActions] START_MISSILE_SELECTION: gameStatus changed from ${statusBefore} to missile_selecting, broadcasting update for game ${game.id}`,
                                );
                            } else {
                                console.log(
                                    `[GameActions] START_MISSILE_SELECTION: resync while already missile_selecting, broadcasting for game ${game.id}`,
                                );
                            }
                            const { broadcastItemPhaseSnapshot } = await import('./utils/broadcastItemPhaseSnapshot.js');
                            await broadcastItemPhaseSnapshot(game);
                            return result || { clientResponse: { gameUpdated: true } };
                        }
                        if (missileStartFailed) {
                            return result;
                        }
                    }
                    
                    // result가 null이나 undefined가 아니거나, 에러가 없는 경우 게임 상태가 변경되었을 수 있으므로 브로드캐스트
                    if (result !== null && result !== undefined) {
                        // 캐시 업데이트
                        updateGameCache(game);
                        // DB 저장은 비동기로 처리하여 응답 지연 최소화
                        db.saveGame(game).catch(err => {
                            console.error(`[GameActions] Failed to save game ${game.id}:`, err);
                        });
                        // 게임 상태 변경 후 실시간 브로드캐스트 (게임 참가자에게만 전송)
                        const { broadcastToGameParticipants } = await import('./socket.js');
                        broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                        return result;
                    }
                }
            }
            // 놀이바둑 AI 게임의 PLACE_STONE은 서버에서 AI 처리
            if (type === 'PLACE_STONE' && arenaPolicy.matchAxis !== 'pvp' && PLAYFUL_GAME_MODES.some(m => m.mode === game.mode)) {
                // AI 차례인지 확인
                const aiPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                const { aiUserId } = await import('./aiPlayer.js');
                if (aiPlayerId === aiUserId) {
                    // 서버에서 AI 처리
                    const { makeAiMove } = await import('./aiPlayer.js');
                    await makeAiMove(game);
                    await db.saveGame(game);
                    const { broadcastToGameParticipants } = await import('./socket.js');
                    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                    return {};
                }
            }
            // 싱글플레이 배치변경/대기 세션 동기화는 singlePlayerActions에서 처리
            if (
                (type === 'SINGLE_PLAYER_REFRESH_PLACEMENT' ||
                    type === 'SINGLE_PLAYER_SYNC_PENDING_STAGE' ||
                    type === 'SINGLE_PLAYER_ADMIN_JUMP_PENDING_STAGE') &&
                arenaPolicy.kind === 'singleplayer'
            ) {
                const { handleSinglePlayerAction } = await import('./actions/singlePlayerActions.js');
                return handleSinglePlayerAction(volatileState, action, userData);
            }
            // PVE 게임 관련 특수 액션만 서버에서 처리 (TOWER_REFRESH_PLACEMENT, TOWER_ADD_TURNS 등은 이미 위에서 처리됨)
            // 착수 액션(PLACE_STONE 등)은 일반적으로 클라이언트에서만 처리하므로 무시
            // 단, 히든바둑 등 전략 모드는 서버에서 착수 검증 및 히든 공개(따냄 관여 시 애니메이션·permanentlyRevealedStones) 처리 필요
            const isStrategicPVE = SPECIAL_GAME_MODES.some(m => m.mode === game.mode);
            const pvePlace = payload as any;
            const towerScoringOrSyncPlaceStone =
                arenaPolicy.kind === 'tower' &&
                type === 'PLACE_STONE' &&
                (pvePlace?.triggerAutoScoring === true || pvePlace?.syncTimeAndStateForScoring === true);
            const shouldHandlePlaceStoneOnServer =
                type === 'PLACE_STONE' && (isStrategicPVE || towerScoringOrSyncPlaceStone);
            // 싱글·모험·길드전·로비 AI 등 PVP가 아닌 전략 세션은 대부분 클라 착수이나,
            // 베이스 전·중반(배치·덤·확인)은 서버 `handleBaseAction`이 처리해야 함.
            // `kind === singleplayer`만 허용하면 모험/길드전 등에서 액션이 `{}`로 삼켜져 배치 확정 후 단계 전환이 영구 정지한다.
            const mixModesForBasePve = ((game.settings as { mixedModes?: GameMode[] } | undefined)?.mixedModes ??
                []) as GameMode[];
            const pveStrategicBaseFlow =
                isStrategicPVE &&
                arenaPolicy.matchAxis !== 'pvp' &&
                (game.mode === GameMode.Base ||
                    (game.mode === GameMode.Mix && mixModesForBasePve.includes(GameMode.Base)));
            const baseFlowServerActionTypes = new Set<string>([
                'PLACE_BASE_STONE',
                'PLACE_REMAINING_BASE_STONES_RANDOMLY',
                'RESET_MY_BASE_STONE_PLACEMENTS',
                'UNDO_LAST_BASE_STONE_PLACEMENT',
                'CONFIRM_BASE_PLACEMENT_COMPLETE',
                'SUBMIT_BASE_STONE_COLOR_CHOICE',
                'UPDATE_KOMI_BID',
                'CONFIRM_BASE_REVEAL',
                'UPDATE_CAPTURE_BID',
                'CONFIRM_CAPTURE_REVEAL',
            ]);
            const shouldHandleBaseFlowOnStrategicPve =
                pveStrategicBaseFlow && baseFlowServerActionTypes.has(type);
            const isPlayfulMode = PLAYFUL_GAME_MODES.some((m) => m.mode === game.mode);
            const shouldHandlePlayfulOnServer =
                isPlayfulMode && PLAYFUL_SERVER_ACTION_TYPES.has(type);
            // 펫 힌트/힌트 보너스는 아래 `handleStrategicGameAction`으로 넘긴다.
            // 페어 AI전·기타 `matchAxis !== 'pvp'`(mixed_pair 등)도 이 블록에 들어오는데,
            // `CONFIRM_COLOR_START`를 여기서 삼키면 페어 순서 확인(pair_order_reveal)·니기리 확인 등이 서버에 영원히 안 붙는다.
            if (
                type !== 'CONFIRM_COLOR_START' &&
                type !== 'RESIGN_GAME' &&
                type !== 'REQUEST_PAIR_TEAM_RESIGN' &&
                type !== 'RESPOND_PAIR_TEAM_RESIGN' &&
                type !== 'REQUEST_STRATEGIC_PET_HINT' &&
                type !== 'CLAIM_STRATEGIC_PET_HINT_BONUS' &&
                !shouldHandlePlaceStoneOnServer &&
                !shouldHandleBaseFlowOnStrategicPve &&
                !shouldHandlePlayfulOnServer
            ) {
                return {};
            }
        }
        
        let result: HandleActionResult | null | undefined = null;
        // AI 주사위 배치 전송 폴백: 배치 액션을 서버 단건 착수로 순차 적용
        // (핸들러 라우팅 누락/버전 불일치 시 Unknown social action으로 빠지는 문제 방지)
        if (type === 'DICE_PLACE_STONES_BATCH') {
            const placements = ((payload as any)?.placements || []) as Array<{ x: number; y: number }>;
            if (!Array.isArray(placements) || placements.length === 0) {
                return { error: '착수 내역이 없습니다.' };
            }
            // 배치 착수는 주사위 바둑 전용
            if (game.mode !== GameMode.Dice) {
                return { error: '배치 착수는 주사위 바둑에서만 사용 가능합니다.' };
            }
            for (const p of placements) {
                const singleAction = {
                    ...action,
                    type: 'DICE_PLACE_STONE',
                    payload: { gameId, x: p.x, y: p.y },
                } as any;
                const step = await handlePlayfulGameAction(volatileState, game, singleAction, userData);
                if (step?.error) return step;
            }
            result = { clientResponse: { game: { ...game, boardState: game.boardState.map((row: number[]) => [...row]) } } };
        }
        
        if (result == null) {
            const placePayload = payload as any;
            const towerPlaceStoneScoringOrSync =
                type === 'PLACE_STONE' &&
                arenaPolicy.kind === 'tower' &&
                (placePayload?.triggerAutoScoring === true || placePayload?.syncTimeAndStateForScoring === true);
            if (SPECIAL_GAME_MODES.some(m => m.mode === game.mode) || towerPlaceStoneScoringOrSync) {
                result = await handleStrategicGameAction(volatileState, game, action, userData);
            } else if (PLAYFUL_GAME_MODES.some(m => m.mode === game.mode)) {
                result = await handlePlayfulGameAction(volatileState, game, action, userData);
            }
        }

        // 도둑과 경찰: 라운드 종료 확인 직후 한 틱 — 저장·브로드캐스트 전에 updateThiefState가 안 돌면
        // thief_round_end에 머물거나 판이 비지 않은 채로 보이는 문제가 난다.
        if (
            result != null &&
            result !== undefined &&
            !(result as any).error &&
            type === 'CONFIRM_ROUND_END' &&
            game.mode === GameMode.Thief
        ) {
            const { updatePlayfulGameState } = await import('./modes/playful.js');
            await updatePlayfulGameState(game, Date.now());
        }

        // 베이스 전·덤 단계: 메인 루프 틱이 밀리면 배치 확정·선호 색·동색 입찰이 한 박자 늦게 반영될 수 있음 → 액션 직후 한 틱 적용.
        // (싱글/탑·모험·길드 AI뿐 아니라 **PVP·페어 mixed_pair 인간 대전**도 동일 — 두 번째 색 선택 직후 즉시 전환)
        const strategicBasePrePlayStatuses = new Set<string>([
            'base_placement',
            'base_stone_color_choice',
            'base_same_color_points_bid',
            'base_game_start_confirmation',
            'capture_bidding',
            'capture_reveal',
            'capture_tiebreaker',
        ]);
        const mixForBaseTick = (((game.settings as { mixedModes?: GameMode[] } | undefined)?.mixedModes ??
            []) as GameMode[]) as GameMode[];
        const isStrategicBaseOrMixWithBase =
            SPECIAL_GAME_MODES.some((m) => m.mode === game.mode) &&
            (game.mode === GameMode.Base || (game.mode === GameMode.Mix && mixForBaseTick.includes(GameMode.Base)));
        /** 베이스 전이 없는 순수 따내기·따내만 믹스는 `isStrategicBaseOrMixWithBase`가 false라 사후 틱이 빠져 `capture_reveal`에서 멈출 수 있음 — 싱글플레이(`sp-game-*`) 포함 */
        const needsStrategicCapturePrePlayTick =
            SPECIAL_GAME_MODES.some((m) => m.mode === game.mode) &&
            strategicBasePrePlayStatuses.has(game.gameStatus) &&
            (game.mode === GameMode.Capture || (game.mode === GameMode.Mix && mixForBaseTick.includes(GameMode.Capture)));
        const needsSinglePlayerBaseStrategicTick =
            arenaPolicy.kind === 'singleplayer' &&
            isStrategicBaseOrMixWithBase &&
            strategicBasePrePlayStatuses.has(game.gameStatus);
        const needsPvpHumanBaseStrategicTick =
            arenaPolicy.kind !== 'singleplayer' &&
            (arenaPolicy.matchAxis === 'pvp' || arenaPolicy.matchAxis === 'mixed_pair') &&
            isStrategicBaseOrMixWithBase &&
            strategicBasePrePlayStatuses.has(game.gameStatus);
        if (
            result != null &&
            result !== undefined &&
            !(result as any).error &&
            SPECIAL_GAME_MODES.some((m) => m.mode === game.mode) &&
            (needsSinglePlayerBaseStrategicTick ||
                needsPvpHumanBaseStrategicTick ||
                needsStrategicCapturePrePlayTick ||
                (arenaPolicy.matchAxis !== 'pvp' &&
                    arenaPolicy.kind !== 'singleplayer' &&
                    (arenaPolicy.kind === 'adventure' || arenaPolicy.kind === 'guildwar')))
        ) {
            const { updateStrategicGameState } = await import('./modes/standard.js');
            try {
                await updateStrategicGameState(game, Date.now());
            } catch (e: any) {
                console.warn(`[handleAction] updateStrategicGameState (pre-play tick) failed game=${game.id}:`, e?.message);
            }
        }

        if (result !== null && result !== undefined) {
            // 알까기 배치: 액션 직후 한 틱 — PVP 등에서 메인 루프의 update가 오기 전에 양쪽 배치가 끝나면 alkkagi_playing으로 바로 전환되지 않던 문제 방지
            if (
                !(result as any).error &&
                type === 'ALKKAGI_PLACE_STONE' &&
                game.mode === GameMode.Alkkagi &&
                (game.gameStatus === 'alkkagi_placement' || game.gameStatus === 'alkkagi_simultaneous_placement')
            ) {
                const { updatePlayfulGameState } = await import('./modes/playful.js');
                try {
                    await updatePlayfulGameState(game, Date.now());
                } catch (e: any) {
                    console.warn(`[handleAction] updatePlayfulGameState (alkkagi placement tick) failed game=${game.id}:`, e?.message);
                }
            }

            // 캐시 업데이트
            updateGameCache(game);
            // PVP 턴 전환: 다음 요청(다른 인스턴스/캐시 미스)이 DB에서 최신 currentPlayer를 읽도록 먼저 저장 후 브로드캐스트
            try {
                await db.saveGame(game);
            } catch (err) {
                console.error(`[GameActions] Failed to save game ${game.id}:`, err);
            }
            // 게임 상태 변경 후 실시간 브로드캐스트 (게임 참가자에게만 전송)
            const { broadcastToGameParticipants } = await import('./socket.js');
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);

            // PVE 전략국 서버 AI: 메인 루프의 setImmediate(makeAiMove)가 startAiProcessing 잠금과 겹치면 봇이 스킵되는 간헐 이슈 방지
            // (모험·길드전 + 싱글/도전의 탑 공통 인라인 fallback)
            const pveServerGoAiCategory = arenaPolicy.matchAxis !== 'pvp';
            if (pveServerGoAiCategory) {
                const isGoMode =
                    game.mode === GameMode.Standard ||
                    game.mode === GameMode.Capture ||
                    game.mode === GameMode.Speed ||
                    game.mode === GameMode.Base ||
                    game.mode === GameMode.Hidden ||
                    game.mode === GameMode.Missile ||
                    game.mode === GameMode.Mix;
                const { aiUserId, makeAiMove } = await import('./aiPlayer.js');
                const pidAfterUser = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                const isAiTurnAfterUser =
                    pidAfterUser === aiUserId || (pidAfterUser && String(pidAfterUser).startsWith('dungeon-bot-'));
                const isPlayableForInlineAi =
                    game.gameStatus === 'playing' ||
                    game.gameStatus === 'hidden_placing';
                /** 따내기 확인 직후 인라인 AI(Kata 등)가 HTTP를 수 초 막으면 모달·버튼이 멈춘 것처럼 보임 → 비동기로 넘김 */
                const deferInlineAiAfterCaptureRevealConfirm =
                    type === 'CONFIRM_CAPTURE_REVEAL' && pveServerGoAiCategory;
                if (
                    isGoMode &&
                    isPlayableForInlineAi &&
                    game.currentPlayer !== types.Player.None &&
                    isAiTurnAfterUser
                ) {
                    const gameIdInlineAi = game.id;
                    const runInlinePveAi = async () => {
                        try {
                            const { waitUntilAiProcessingReleased } = await import('./aiSessionManager.js');
                            const { PVE_STRATEGIC_SERVER_AI_POST_HUMAN_DELAY_MS } = await import(
                                './constants/pveStrategicAiSchedule.js'
                            );
                            const { aiUserId: aiUserIdInline } = await import('./aiPlayer.js');
                            await waitUntilAiProcessingReleased(gameIdInlineAi, 10_000);
                            await new Promise<void>((r) => setTimeout(r, PVE_STRATEGIC_SERVER_AI_POST_HUMAN_DELAY_MS));
                            const { getCachedGame } = await import('./gameCache.js');
                            const freshForInline = await getCachedGame(gameIdInlineAi);
                            if (!freshForInline) return;
                            Object.assign(game, freshForInline);
                            const pidBeforeInline =
                                game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                            const currentAfterRefresh = game.currentPlayer;
                            const aiStillTurn =
                                (currentAfterRefresh === types.Player.Black || currentAfterRefresh === types.Player.White) &&
                                (pidBeforeInline === aiUserIdInline ||
                                    (pidBeforeInline && String(pidBeforeInline).startsWith('dungeon-bot-')));
                            const stillPlayable =
                                game.gameStatus === 'playing' || game.gameStatus === 'hidden_placing';
                            if (aiStillTurn && stillPlayable) {
                                const moveBeforeInline = game.moveHistory?.length ?? 0;
                                await makeAiMove(game);
                                const aiAdvanced = (game.moveHistory?.length ?? 0) > moveBeforeInline;
                                if (aiAdvanced) {
                                    game.aiTurnStartTime = undefined;
                                    if (!game.turnStartTime) game.turnStartTime = Date.now();
                                } else {
                                    game.aiTurnStartTime = Date.now() + 50;
                                }
                                updateGameCache(game);
                                await db.saveGame(game);
                                const payloadAfterAi =
                                    game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0
                                        ? { ...game, boardState: game.boardState.map((row: number[]) => [...row]) }
                                        : game;
                                const { broadcastToGameParticipants } = await import('./socket.js');
                                broadcastToGameParticipants(
                                    gameIdInlineAi,
                                    { type: 'GAME_UPDATE', payload: { [gameIdInlineAi]: payloadAfterAi } },
                                    game
                                );
                            } else {
                                game.aiTurnStartTime = undefined;
                            }
                        } catch (e: any) {
                            console.error('[GameActions] Inline adventure/guildwar AI move failed:', e?.message);
                            game.aiTurnStartTime = Date.now() + 1000;
                        }
                    };
                    if (deferInlineAiAfterCaptureRevealConfirm) {
                        void runInlinePveAi();
                    } else {
                        await runInlinePveAi();
                    }
                }
            }

            // 알까기 턴제 배치: 흑(유저)이 둔 직후 백(AI) 턴이면 메인 루프를 기다리지 않고 즉시 AI 배치 실행 (백이 안 두는 버그 방지)
            const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
            const { aiUserId } = await import('./aiPlayer.js');
            const isAlkkagiPlacementAiTurn =
                game.mode === GameMode.Alkkagi &&
                arenaPolicy.matchAxis !== 'pvp' &&
                game.gameStatus === 'alkkagi_simultaneous_placement' &&
                game.currentPlayer !== types.Player.None &&
                currentPlayerId === aiUserId;
            // setImmediate로 두면 메인 루프의 makeAiMove와 startAiProcessing 잠금이 겹쳐 봇이 스킵되는 경우가 있어, 같은 요청 안에서 즉시 처리
            if (isAlkkagiPlacementAiTurn) {
                const { makeAiMove, aiUserId } = await import('./aiPlayer.js');
                const { updatePlayfulGameState } = await import('./modes/playful.js');
                const gameId = game.id;
                try {
                    await makeAiMove(game);
                    updateGameCache(game);
                    await db.saveGame(game);
                    broadcastToGameParticipants(gameId, { type: 'GAME_UPDATE', payload: { [gameId]: game } }, game);
                    await updatePlayfulGameState(game, Date.now());
                    if (game.gameStatus === 'alkkagi_playing' && game.currentPlayer !== types.Player.None) {
                        const cp = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                        if (cp === aiUserId) {
                            game.aiTurnStartTime = Date.now() + ALKKAGI_AI_FIRST_ATTACK_DELAY_MS;
                            updateGameCache(game);
                            await db.saveGame(game);
                            broadcastToGameParticipants(gameId, { type: 'GAME_UPDATE', payload: { [gameId]: game } }, game);
                        }
                    }
                } catch (e: any) {
                    console.error('[GameActions] Alkkagi AI placement (inline) failed:', e?.message);
                }
            }

            // 알까기 동시 배치: 유저가 돌을 둔 요청에서 AI도 5개까지 채우고, 둘 다 5개면 전환 후 AI 공격 (메인 루프 타임아웃 없이 처리)
            if (type === 'ALKKAGI_PLACE_STONE' && game.mode === GameMode.Alkkagi && arenaPolicy.matchAxis !== 'pvp' && game.gameStatus === 'alkkagi_simultaneous_placement') {
                const { updatePlayfulGameState } = await import('./modes/playful.js');
                const { makeAiMove, aiUserId } = await import('./aiPlayer.js');
                const targetStones = game.settings?.alkkagiStoneCount || 5;
                const aiPlaced = game.alkkagiStonesPlacedThisRound?.[aiUserId] || 0;
                // AI가 5개 미만이면 이 요청 안에서 AI 배치를 채움 (동시 배치 시 메인 루프에만 의존하지 않음)
                for (let i = aiPlaced; i < targetStones; i++) {
                    await makeAiMove(game);
                    if ((game.alkkagiStonesPlacedThisRound?.[aiUserId] || 0) >= targetStones) break;
                }
                const now = Date.now();
                await updatePlayfulGameState(game, now);
                if ((game.gameStatus as string) === 'alkkagi_playing') {
                    updateGameCache(game);
                    await db.saveGame(game);
                    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                    const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
                    if (game.currentPlayer !== types.Player.None && currentPlayerId === aiUserId) {
                        game.aiTurnStartTime = Date.now() + ALKKAGI_AI_FIRST_ATTACK_DELAY_MS;
                        updateGameCache(game);
                        await db.saveGame(game);
                        broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                    }
                }
            }

            // 알까기 공격: 서버 애니 duration(2500ms)과 맞춰 시뮬 완료 후 AI 턴 스케줄
            const ALKKAGI_FLICK_DURATION_MS = 2500;
            const isAlkkagiHumanFlick =
                type === 'ALKKAGI_FLICK_STONE' &&
                game.mode === GameMode.Alkkagi &&
                arenaPolicy.matchAxis !== 'pvp' &&
                game.gameStatus === 'alkkagi_animating' &&
                game.animation?.type === 'alkkagi_flick';
            if (isAlkkagiHumanFlick) {
                const gameId = game.id;
                const { getCachedGame } = await import('./gameCache.js');
                const { updatePlayfulGameState } = await import('./modes/playful.js');
                const { makeAiMove, aiUserId } = await import('./aiPlayer.js');
                setTimeout(async () => {
                    try {
                        const g = await getCachedGame(gameId);
                        if (!g || g.gameStatus !== 'alkkagi_animating' || (g.animation?.type !== 'alkkagi_flick')) return;
                        const now = Date.now();
                        await updatePlayfulGameState(g, now);
                        const { broadcastToGameParticipants } = await import('./socket.js');
                        updateGameCache(g);
                        await db.saveGame(g);
                        broadcastToGameParticipants(gameId, { type: 'GAME_UPDATE', payload: { [gameId]: g } }, g);
                        const currentPlayerId = g.currentPlayer === types.Player.Black ? g.blackPlayerId : g.whitePlayerId;
                        if ((g.gameStatus as string) === 'alkkagi_playing' && currentPlayerId === aiUserId) {
                            await makeAiMove(g);
                            updateGameCache(g);
                            await db.saveGame(g);
                            broadcastToGameParticipants(gameId, { type: 'GAME_UPDATE', payload: { [gameId]: g } }, g);
                        }
                    } catch (e: any) {
                        console.error('[GameActions] Alkkagi post-flick AI move failed:', e?.message);
                    }
                }, ALKKAGI_FLICK_DURATION_MS + 500);
            }

            if (type === 'CONFIRM_CAPTURE_REVEAL' && !(result as any)?.error) {
                const { baseHttpGameSnapshot } = await import('./modes/base.js');
                const httpSnap = baseHttpGameSnapshot(game) as {
                    clientResponse: { gameId: string; game: types.LiveGameSession };
                };
                const baseResult =
                    result && typeof result === 'object' && !Array.isArray(result) ? (result as Record<string, unknown>) : {};
                return {
                    ...baseResult,
                    clientResponse: {
                        ...(typeof (baseResult as any).clientResponse === 'object' ? (baseResult as any).clientResponse : {}),
                        ...httpSnap.clientResponse,
                    },
                };
            }

            if (
                !(result as any)?.error &&
                PLAYFUL_GAME_MODES.some((m) => m.mode === game.mode) &&
                PLAYFUL_SERVER_ACTION_TYPES.has(type)
            ) {
                const baseResult =
                    result && typeof result === 'object' && !Array.isArray(result) ? (result as Record<string, unknown>) : {};
                const boardClone =
                    game.boardState && Array.isArray(game.boardState)
                        ? game.boardState.map((row: number[]) => [...row])
                        : game.boardState;
                return {
                    ...baseResult,
                    clientResponse: {
                        ...(typeof (baseResult as any).clientResponse === 'object' ? (baseResult as any).clientResponse : {}),
                        gameId: game.id,
                        game: { ...game, boardState: boardClone },
                    },
                };
            }

            const itemPhaseHttpActions = new Set([
                'START_HIDDEN_PLACEMENT',
                'START_SCANNING',
                'SCAN_BOARD',
                'START_MISSILE_SELECTION',
            ]);
            if (!(result as any)?.error && itemPhaseHttpActions.has(type)) {
                const baseResult =
                    result && typeof result === 'object' && !Array.isArray(result) ? (result as Record<string, unknown>) : {};
                const boardClone =
                    game.boardState && Array.isArray(game.boardState)
                        ? game.boardState.map((row: number[]) => [...row])
                        : game.boardState;
                const { broadcastItemPhaseSnapshot } = await import('./utils/broadcastItemPhaseSnapshot.js');
                await broadcastItemPhaseSnapshot(game);
                return {
                    ...baseResult,
                    clientResponse: {
                        ...(typeof (baseResult as any).clientResponse === 'object' ? (baseResult as any).clientResponse : {}),
                        gameId: game.id,
                        game: { ...game, boardState: boardClone, animation: game.animation ?? null },
                    },
                };
            }

            if (!(result as any)?.error && type === 'REQUEST_STRATEGIC_PET_HINT') {
                const baseResult =
                    result && typeof result === 'object' && !Array.isArray(result) ? (result as Record<string, unknown>) : {};
                const boardClone =
                    game.boardState && Array.isArray(game.boardState)
                        ? game.boardState.map((row: number[]) => [...row])
                        : game.boardState;
                updateGameCache(game);
                await db.saveGame(game);
                const { broadcastToGameParticipants } = await import('./socket.js');
                broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                return {
                    ...baseResult,
                    clientResponse: {
                        ...(typeof (baseResult as any).clientResponse === 'object' ? (baseResult as any).clientResponse : {}),
                        gameId: game.id,
                        game: { ...game, boardState: boardClone },
                    },
                };
            }

            return result;
        }
    }

    // Non-Game actions
    // ADMIN_ 액션은 위에서 이미 처리됨
    if (type.includes('NEGOTIATION') || type === 'START_AI_GAME' || type === 'REQUEST_REMATCH' || type === 'CHALLENGE_USER' || type === 'SEND_CHALLENGE') return handleNegotiationAction(volatileState, action, userData);
    if (
        type === 'CLAIM_SINGLE_PLAYER_MISSION_REWARD' ||
        type === 'CLAIM_SINGLE_PLAYER_CLASS_BAR_REWARD' ||
        type === 'CLAIM_ALL_TRAINING_QUEST_REWARDS' ||
        type === 'START_SINGLE_PLAYER_MISSION' ||
        type === 'LEVEL_UP_TRAINING_QUEST'
    ) {
        return handleSinglePlayerAction(volatileState, action, userData);
    }
    // 타워 액션은 위에서 이미 처리됨 (중복 제거)
    // 던전 액션은 토너먼트 액션으로 처리해야 하므로 CLAIM_ 체크보다 먼저 확인
    if (type.startsWith('START_DUNGEON') ||
        type.startsWith('COMPLETE_DUNGEON') ||
        type.startsWith('CLAIM_DUNGEON') ||
        type === 'START_DUNGEON_STAGE' ||
        type === 'COMPLETE_DUNGEON_STAGE' ||
        type === 'CLAIM_DUNGEON_REWARD' ||
        type === 'GET_CHAMPIONSHIP_VERSUS_VENUE_STATE' ||
        type === 'REFRESH_CHAMPIONSHIP_VERSUS_OPPONENT_LIST' ||
        type === 'REPORT_CHAMPIONSHIP_VERSUS_DUEL_RESULT' ||
        type === 'START_CHAMPIONSHIP_VERSUS_KATA_DUEL') {
        console.log(`[handleAction] Routing ${type} to handleTournamentAction, payload:`, JSON.stringify(payload));
        try {
            const result = await handleTournamentAction(volatileState, action, userData);
            if (result) {
                console.log(`[handleAction] handleTournamentAction returned result for ${type}:`, result.error ? `ERROR: ${result.error}` : 'SUCCESS');
                return result;
            } else {
                console.error(`[handleAction] handleTournamentAction returned undefined/null for ${type}`);
                return { error: `Failed to process ${type}. Please try again.` };
            }
        } catch (error: any) {
            console.error(`[handleAction] Error in handleTournamentAction for ${type}:`, error?.message || error);
            return { error: `서버 오류가 발생했습니다: ${error?.message || 'Unknown error'}` };
        }
    }
    
    if (['UPDATE_AVATAR', 'UPDATE_BORDER', 'SAVE_EXCHANGE_STATE', 'PURCHASE_EXCHANGE_LISTING', 'CLAIM_EXCHANGE_SETTLEMENT', 'CHANGE_NICKNAME', 'RESET_STAT_POINTS', 'CONFIRM_STAT_ALLOCATION', 'UPDATE_MBTI', 'SAVE_PRESET', 'APPLY_PRESET', 'UPDATE_REJECTION_SETTINGS', 'UPDATE_PAIR_PET_LOBBY_INVENTORY_SORT', 'SET_BLOCK_ARENA_PARTNER_INVITES', 'DISMISS_SCREEN_GUIDE', 'SAVE_GAME_RECORD', 'DELETE_GAME_RECORD', 'RECORD_ADVENTURE_MONSTER_DEFEAT', 'START_ADVENTURE_MONSTER_BATTLE', 'PREPARE_ADVENTURE_MAP_TREASURE_CHEST', 'CONFIRM_ADVENTURE_MAP_TREASURE_CHEST', 'ABANDON_ADVENTURE_MAP_TREASURE_PICK', 'REROLL_ADVENTURE_REGIONAL_BUFF', 'ENHANCE_ADVENTURE_REGIONAL_BUFF', 'ADMIN_SET_VIP_TEST_FLAGS', 'ADMIN_SET_DIAMOND_PACKAGE_TEST', 'RESET_PAIR_ARENA_SINGLE_STAT', 'RESET_PAIR_ARENA_STRATEGIC_ALL'].includes(type)) return handleUserAction(volatileState, action, userData);
    // CLAIM_SHOP_AD_REWARD는 상점 전용 — `CLAIM_` 보상 분기보다 먼저 두면 안 됨(보상 핸들러 default 오류).
    if (
        (type.startsWith('CLAIM_') && type !== 'CLAIM_SHOP_AD_REWARD') ||
        type.startsWith('DELETE_MAIL') ||
        type === 'DELETE_ALL_CLAIMED_MAIL' ||
        type === 'MARK_MAIL_AS_READ'
    ) {
        return handleRewardAction(volatileState, action, userData);
    }
    if (
        type.startsWith('BUY_') ||
        type === 'PURCHASE_ACTION_POINTS' ||
        type === 'EXPAND_INVENTORY' ||
        type === 'BUY_TOWER_ITEM' ||
        type === 'CLAIM_SHOP_AD_REWARD' ||
        type === 'CANCEL_VIP_SHOP_AUTO_RENEW'
    )
        return handleShopAction(volatileState, action, userData);
    if (type.startsWith('TOURNAMENT') || 
        type.startsWith('START_TOURNAMENT') || 
        type.startsWith('SKIP_TOURNAMENT') || 
        type.startsWith('FORFEIT_TOURNAMENT') || 
        type.startsWith('FORFEIT_CURRENT_MATCH') || 
        type.startsWith('SAVE_TOURNAMENT') || 
        type.startsWith('CLEAR_TOURNAMENT') || 
        type.startsWith('ADVANCE_TOURNAMENT') || 
        type === 'USE_CONDITION_POTION' || 
        type === 'BUY_CONDITION_POTION' ||
        type === 'START_TOURNAMENT_MATCH' || 
        type === 'SKIP_CHAMPIONSHIP_MATCH' ||
        type === 'START_TOURNAMENT_ROUND' ||
        type === 'ENTER_TOURNAMENT_VIEW' || 
        type === 'LEAVE_TOURNAMENT_VIEW' ||
        type === 'CLAIM_TOURNAMENT_REWARD' ||
        type === 'COMPLETE_TOURNAMENT_SIMULATION') {
        console.log(`[handleAction] Routing ${type} to handleTournamentAction`);
        return handleTournamentAction(volatileState, action, userData);
    }
    if (['TOGGLE_EQUIP_ITEM', 'UNBIND_EQUIPMENT', 'MARK_ITEM_EXCHANGE_LISTED', 'UNMARK_ITEM_EXCHANGE_LISTED', 'SELL_ITEM', 'ENHANCE_ITEM', 'DISASSEMBLE_ITEM', 'USE_ITEM', 'USE_ALL_ITEMS_OF_TYPE', 'CRAFT_MATERIAL', 'COMBINE_ITEMS', 'REFINE_EQUIPMENT'].includes(type)) return handleInventoryAction(volatileState, action, userData);
    if (type.includes('SINGLE_PLAYER')) return handleSinglePlayerAction(volatileState, action, userData);
    if (type === 'MANNER_ACTION') return mannerService.handleMannerAction(volatileState, action, userData);
    // Guild actions are now handled above (before game actions)
    // Social actions can be game-related (chat in game) or not (logout)
    const socialResult = await handleSocialAction(volatileState, action, userData);
    if (socialResult) return socialResult;

    return { error: `Unhandled action type: ${type}` };
};