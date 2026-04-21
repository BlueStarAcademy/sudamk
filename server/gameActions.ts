import { randomUUID } from 'crypto';
import * as db from './db.js';
// FIX: Import GameMode to resolve TS2304 error.
import { type ServerAction, type User, type VolatileState, InventoryItem, Quest, QuestLog, Negotiation, Player, LeagueTier, TournamentType, GameMode } from '../shared/types/index.js';
import * as types from '../shared/types/index.js';
import { volatileState } from './state.js';
import { isDifferentDayKST, isDifferentWeekKST, isDifferentMonthKST, getStartOfDayKST } from '../shared/utils/timeUtils.js';
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

export { updateQuestProgress } from './questService.js';

export type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
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
    for (const type of tournamentTypes) {
        const playedDateKey = `last${type.charAt(0).toUpperCase() + type.slice(1)}PlayedDate` as keyof User;
        const rewardClaimedKey = `${type}RewardClaimed` as keyof User;
        const tournamentKey = `last${type.charAt(0).toUpperCase() + type.slice(1)}Tournament` as keyof User;

        if (isDifferentDayKST((user as any)[playedDateKey], now)) {
            (updatedUser as any)[playedDateKey] = undefined;
            (updatedUser as any)[rewardClaimedKey] = undefined;
            (updatedUser as any)[tournamentKey] = null;
            modified = true;
        }
    }

    return modified ? updatedUser : user;
};

export const handleAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user?: User): Promise<HandleActionResult> => {
    const { type, payload } = action as any;
    const gameId = payload?.gameId;
    
    // 프로덕션에서는 상세 로깅 제거 (성능 향상)
    if (process.env.NODE_ENV === 'development') {
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
    // ADMIN_SET_VIP_TEST_FLAGS는 프로필 VIP 테스트용으로 userActions에서만 처리
    if (type.startsWith('ADMIN_') && type !== 'ADMIN_SET_VIP_TEST_FLAGS') return handleAdminAction(volatileState, action, userData);

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
        if (process.env.NODE_ENV === 'development') {
            console.log(`[handleAction] Routing GUILD action: ${type} to handleGuildAction`);
        }
        const { handleGuildAction } = await import('./actions/guildActions.js');
        const result = await handleGuildAction(volatileState, action, userData);
        if (process.env.NODE_ENV === 'development' && result?.error) {
            console.log(`[handleAction] GUILD action ${type} result: ERROR: ${result.error}`);
        }
        return result;
    }

    // Game Actions (require gameId)
    // 도전의 탑은 클라이언트에서만 실행되므로 서버에서 착수 액션을 처리하지 않음
    // BUY_TOWER_ITEM은 payload에 gameId가 있어도 상점(handleShopAction)에서만 처리 (여기서 PVE 분기에 들어가면 빈 {}로 종료되어 구매가 실행되지 않음)
    if (gameId && type !== 'LEAVE_AI_GAME' && type !== 'BUY_TOWER_ITEM') {
        // 싱글플레이·도전의 탑 미사일 액션 처리 (게임이 캐시에 없을 수 있음)
        if (type === 'START_MISSILE_SELECTION' || type === 'LAUNCH_MISSILE' || type === 'CANCEL_MISSILE_SELECTION' || type === 'MISSILE_INVALID_SELECTION' || type === 'MISSILE_ANIMATION_COMPLETE') {
            if (gameId.startsWith('sp-game-')) {
                const { handleSinglePlayerAction } = await import('./actions/singlePlayerActions.js');
                const result = await handleSinglePlayerAction(volatileState, action, userData);
                if (result && (result as any).error) return result;
                return result || { error: 'Failed to process single player missile action.' };
            }
            if (gameId.startsWith('tower-game-')) {
                const { getCachedGame, updateGameCache } = await import('./gameCache.js');
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
                if (game.gameCategory !== 'tower') return { error: 'Not a tower game.' };
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
        if (type === 'PLACE_STONE' && (payload as any)?.triggerAutoScoring && gameId.startsWith('sp-game-')) {
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
            if (!game || !game.isSinglePlayer) {
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
            if (gameId.startsWith('tower-game-') && cacheForTower) {
                const cached = cacheForTower.get(gameId);
                if (cached?.game) game = cached.game as types.LiveGameSession;
            }
            if (!game) game = await getCachedGame(gameId);
            if (!game && (gameId.startsWith('sp-game-') || gameId.startsWith('tower-game-')) && cacheForTower) {
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
            // 도전의 탑 1~20층: 미사일/히든/스캔 사용 불가
            if (game.gameCategory === 'tower') {
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
                (game.gameCategory === 'tower' || game.isSinglePlayer)
            ) {
                // HTTP 액션은 타이머 루프 없이 들어올 수 있어 scanning_animating이 남으면 playing이 아니라 400이 난다.
                const nowSync = Date.now();
                if (game.gameCategory === 'tower') {
                    const { updateTowerPlayerHiddenState } = await import('./modes/towerPlayerHidden.js');
                    await updateTowerPlayerHiddenState(game, nowSync);
                } else if (game.isSinglePlayer) {
                    const { updateSinglePlayerHiddenState } = await import('./modes/singlePlayerHidden.js');
                    await updateSinglePlayerHiddenState(game, nowSync);
                }
                applyPveItemActionClientSync(game, payload);
                if (game.gameCategory === 'tower' && actionTypeStr === 'SCAN_BOARD' && game.gameStatus === 'scanning') {
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
            if (game.gameCategory === 'tower' && SPECIAL_GAME_MODES.some(m => m.mode === game.mode)) {
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
            if (game.isSinglePlayer) {
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
        if (type === 'PLACE_STONE' && (payload as any)?.isHidden && gameId.startsWith('tower-game-')) {
            const { getCachedGame, updateGameCache } = await import('./gameCache.js');
            let game = await getCachedGame(gameId);
            if (!game) {
                const cache = volatileState.gameCache;
                if (cache) { const c = cache.get(gameId); if (c) game = c.game; }
            }
            if (!game) game = await db.getLiveGame(gameId);
            if (game && game.gameCategory === 'tower' && (game.gameStatus === 'hidden_placing' || (payload as any)?.isHidden)) {
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
        
        // 도전의 탑 21층+: 세션 필드가 비어 있으면 대기실 인벤 기준으로만 채움 (무료 기본 개수 없음)
        if (game.gameCategory === 'tower' && (game as any).towerFloor >= 21 && game.settings) {
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
            const gcat = (game as any).gameCategory ?? 'n/a';
            const tf = (game as any).towerFloor;
            const tfPart = tf != null && tf !== '' ? `, towerFloor=${tf}` : '';
            console.log(`[handleAction] Game found: gameId=${gameId}, type=${type}, gameCategory=${gcat}, isSinglePlayer=${!!game.isSinglePlayer}, gameStatus=${game.gameStatus}${tfPart}`);
        }

        // 전략바둑 AI 대국: 클라이언트 복구/타임아웃 시 서버에서 makeAiMove(goAiBot → Kata)로 해당 국면 수 계산
        if (type === 'REQUEST_SERVER_AI_MOVE') {
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
            if (!game.isAiGame) {
                return { error: 'Not an AI game.' };
            }
            // 도전의 탑·싱글플레이: 착수가 클라 전용이라 서버 판이 뒤처질 수 있음 → Kata 호출 전 클라 스냅샷으로 맞춤
            if ((game.gameCategory === 'tower' || game.isSinglePlayer) && (payload as any)?.clientSync) {
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
                // 본대국으로 정규화할 때는 타이머만 정리한다. AI 히든 6초 연출(ai_thinking·aiHiddenItemAnimationEndTime)은
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
            const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
            const { aiUserId } = await import('./aiPlayer.js');
            const isAiTurn = currentPlayerId === aiUserId || (currentPlayerId && String(currentPlayerId).startsWith('dungeon-bot-'));
            if (!isAiTurn) {
                return { error: 'Not AI turn.' };
            }
            if (game.gameStatus !== 'playing' && game.gameStatus !== 'hidden_placing') {
                return { error: 'Game not in playing state.' };
            }
            const { makeAiMove } = await import('./aiPlayer.js');
            await makeAiMove(game);
            updateGameCache(game);
            await db.saveGame(game);
            const { broadcastToGameParticipants } = await import('./socket.js');
            const payloadGame = game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0
                ? { ...game, boardState: game.boardState.map((row: number[]) => [...row]) }
                : game;
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: payloadGame } }, game);
            // PVE는 WS만 기다리면 지연·병합으로 AI 착수가 화면에 안 보일 수 있음 → HTTP 응답으로 즉시 동기화
            return { clientResponse: { serverAiMoveDone: true, game: payloadGame } };
        }

        if (type === 'REQUEST_GAME_STATE_SYNC') {
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
            if (!game.isAiGame || game.isSinglePlayer || !goModes.includes(game.mode)) {
                return { error: '이 경기 유형에서는 동기화를 지원하지 않습니다.' };
            }
            const gc = (game as any).gameCategory;
            if (gc === 'tower' || gc === 'singleplayer') {
                return { error: '이 경기 유형에서는 동기화를 지원하지 않습니다.' };
            }
            const { waitUntilAiProcessingReleased, syncAiSession } = await import('./aiSessionManager.js');
            const { aiUserId, makeAiMove } = await import('./aiPlayer.js');
            await waitUntilAiProcessingReleased(game.id, 10_000);
            const fresh = await db.getLiveGame(gameId);
            if (!fresh) {
                return { error: 'Game not found.' };
            }
            Object.assign(game, JSON.parse(JSON.stringify(fresh)) as types.LiveGameSession);
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
        }

        // 일반 AI 대국의 수동 일시정지 중에는 착수/통과 등 주요 게임 액션을 차단
        const isManuallyPausedAi = game.isAiGame && !game.isSinglePlayer && game.gameCategory !== 'tower' && game.gameCategory !== 'singleplayer'
            && game.pausedTurnTimeLeft !== undefined && !game.turnDeadline && !game.itemUseDeadline;
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
        const isPVEGame = game.gameCategory === 'tower' || game.gameCategory === 'singleplayer' || game.isSinglePlayer;

        // AI 게임 시작 확인은 게임 분류와 상관없이 서버에서 처리 (대국실 입장 후 시작 버튼)
        if (type === 'CONFIRM_AI_GAME_START') {
            const { handleAiAction } = await import('./actions/aiActions.js');
            return handleAiAction(volatileState, action, userData);
        }
        if (isPVEGame) {
            // 계가 요청은 서버에서 처리
            if (type === 'REQUEST_SCORING') {
                const { boardState, moveHistory, settings } = payload;
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
                    settings: { ...game.settings, ...settings }
                };
                const lim = getScoringKataGoLimits();
                const analysis = await analyzeGame(analysisGame, {
                    includePolicy: false,
                    includeOwnership: true,
                    maxVisits: lim.maxVisits,
                    maxTimeSec: lim.maxTimeSec,
                });
                // 싱글플레이어: 계가 완료 시 서버에서 endGame 호출하여 클리어/보상 저장 (다음 스테이지 잠금 해제, 골드/경험치 지급)
                if (game.isSinglePlayer && game.stageId) {
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
            if (type === 'END_SINGLE_PLAYER_GAME' && game.isSinglePlayer && game.stageId) {
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
                const { endGame } = await import('./summaryService.js');
                await endGame(freshGame, winner, winReason || 'capture_limit');
                const savedGame = await db.getLiveGame(game.id);
                const updatedUser = await db.getUser(freshGame.player1.id);
                return { clientResponse: { gameId: game.id, game: savedGame || freshGame, updatedUser: updatedUser ?? undefined } };
            }
            // 미사일 액션은 서버에서 처리해야 함 (게임 상태 변경)
            if (type === 'START_MISSILE_SELECTION' || type === 'LAUNCH_MISSILE' || type === 'CANCEL_MISSILE_SELECTION' || type === 'MISSILE_INVALID_SELECTION' || type === 'MISSILE_ANIMATION_COMPLETE') {
                // 싱글플레이 게임의 경우 싱글플레이 핸들러로 라우팅 (이미 위에서 처리했지만 중복 방지)
                if (game.isSinglePlayer) {
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
                    
                    // MISSILE_ANIMATION_COMPLETE는 항상 게임 상태가 변경되므로 반드시 브로드캐스트
                    if (type === 'MISSILE_ANIMATION_COMPLETE') {
                        console.log(`[GameActions] MISSILE_ANIMATION_COMPLETE: gameStatus=${game.gameStatus}, always broadcasting update for game ${game.id}`);
                        updateGameCache(game);
                        // 싱글플레이어 게임의 경우 게임 저장을 기다려서 게임을 찾지 못하는 문제 방지
                        if (game.isSinglePlayer) {
                            try {
                                await db.saveGame(game);
                            } catch (err) {
                                console.error(`[GameActions] Failed to save game ${game.id}:`, err);
                            }
                        } else {
                            db.saveGame(game).catch(err => {
                                console.error(`[GameActions] Failed to save game ${game.id}:`, err);
                            });
                        }
                        const { broadcastToGameParticipants } = await import('./socket.js');
                        broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                        return result || { clientResponse: { gameUpdated: true } };
                    }
                    
                    // START_MISSILE_SELECTION의 경우 게임 상태가 변경되므로 반드시 브로드캐스트 필요
                    if (type === 'START_MISSILE_SELECTION') {
                        if (game.gameStatus === 'missile_selecting' && statusBefore !== 'missile_selecting') {
                            console.log(`[GameActions] START_MISSILE_SELECTION: gameStatus changed from ${statusBefore} to missile_selecting, broadcasting update for game ${game.id}`);
                            updateGameCache(game);
                            db.saveGame(game).catch(err => {
                                console.error(`[GameActions] Failed to save game ${game.id}:`, err);
                            });
                            const { broadcastToGameParticipants } = await import('./socket.js');
                            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                            return result || { clientResponse: { gameUpdated: true } };
                        } else {
                            console.warn(`[GameActions] START_MISSILE_SELECTION: gameStatus not changed (before=${statusBefore}, after=${game.gameStatus}), gameId=${game.id}`);
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
            if (type === 'PLACE_STONE' && game.isAiGame && PLAYFUL_GAME_MODES.some(m => m.mode === game.mode)) {
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
            // 싱글플레이 배치변경은 singlePlayerActions에서 처리 (골드 차감·보드 갱신·updatedUser/game 반환)
            if (type === 'SINGLE_PLAYER_REFRESH_PLACEMENT' && game.isSinglePlayer) {
                const { handleSinglePlayerAction } = await import('./actions/singlePlayerActions.js');
                return handleSinglePlayerAction(volatileState, action, userData);
            }
            // PVE 게임 관련 특수 액션만 서버에서 처리 (TOWER_REFRESH_PLACEMENT, TOWER_ADD_TURNS 등은 이미 위에서 처리됨)
            // 착수 액션(PLACE_STONE 등)은 일반적으로 클라이언트에서만 처리하므로 무시
            // 단, 히든바둑 등 전략 모드는 서버에서 착수 검증 및 히든 공개(따냄 관여 시 애니메이션·permanentlyRevealedStones) 처리 필요
            const isStrategicPVE = SPECIAL_GAME_MODES.some(m => m.mode === game.mode);
            const pvePlace = payload as any;
            const towerScoringOrSyncPlaceStone =
                game.gameCategory === 'tower' &&
                type === 'PLACE_STONE' &&
                (pvePlace?.triggerAutoScoring === true || pvePlace?.syncTimeAndStateForScoring === true);
            const shouldHandlePlaceStoneOnServer =
                type === 'PLACE_STONE' && (isStrategicPVE || towerScoringOrSyncPlaceStone);
            if (type !== 'RESIGN_GAME' && !shouldHandlePlaceStoneOnServer) {
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
                game.gameCategory === 'tower' &&
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

        // 모험/길드전 AI 전략국: 메인 루프에서 PVE로 제외되는 동안 processGame이 안 돌면
        // updateBaseState 등이 호출되지 않아 베이스 배치 완료 후 진행이 멈출 수 있음 → 액션 직후 한 틱 적용.
        if (
            result != null &&
            result !== undefined &&
            !(result as any).error &&
            game.isAiGame &&
            !game.isSinglePlayer &&
            ((game as any).gameCategory === 'adventure' || (game as any).gameCategory === 'guildwar') &&
            SPECIAL_GAME_MODES.some((m) => m.mode === game.mode)
        ) {
            const { updateStrategicGameState } = await import('./modes/standard.js');
            try {
                await updateStrategicGameState(game, Date.now());
            } catch (e: any) {
                console.warn(`[handleAction] updateStrategicGameState (adventure/guildwar pre-play tick) failed game=${game.id}:`, e?.message);
            }
        }

        if (result !== null && result !== undefined) {
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

            // 모험·길드전 서버 AI: 메인 루프의 setImmediate(makeAiMove)가 startAiProcessing 잠금과 겹치면 봇이 스킵되는 간헐 이슈 방지 (알까기 인라인과 동일)
            const pveServerGoAiCategory =
                game.isAiGame &&
                !game.isSinglePlayer &&
                ((game as any).gameCategory === 'adventure' || (game as any).gameCategory === 'guildwar');
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
                if (
                    isGoMode &&
                    game.gameStatus === 'playing' &&
                    game.currentPlayer !== types.Player.None &&
                    isAiTurnAfterUser
                ) {
                    const gameIdInlineAi = game.id;
                    try {
                        const { waitUntilAiProcessingReleased } = await import('./aiSessionManager.js');
                        await waitUntilAiProcessingReleased(game.id, 10_000);
                        await new Promise<void>((r) => setTimeout(r, 1000));
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
                        broadcastToGameParticipants(
                            gameIdInlineAi,
                            { type: 'GAME_UPDATE', payload: { [gameIdInlineAi]: payloadAfterAi } },
                            game
                        );
                    } catch (e: any) {
                        console.error('[GameActions] Inline adventure/guildwar AI move failed:', e?.message);
                        game.aiTurnStartTime = Date.now() + 1000;
                    }
                }
            }

            // 알까기 턴제 배치: 흑(유저)이 둔 직후 백(AI) 턴이면 메인 루프를 기다리지 않고 즉시 AI 배치 실행 (백이 안 두는 버그 방지)
            const currentPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
            const { aiUserId } = await import('./aiPlayer.js');
            const isAlkkagiPlacementAiTurn =
                game.mode === GameMode.Alkkagi &&
                game.isAiGame &&
                (game.gameStatus === 'alkkagi_placement' || game.gameStatus === 'alkkagi_simultaneous_placement') &&
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
                            await makeAiMove(game);
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
            if (type === 'ALKKAGI_PLACE_STONE' && game.mode === GameMode.Alkkagi && game.isAiGame && game.gameStatus === 'alkkagi_simultaneous_placement') {
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
                        const gameId = game.id;
                        setImmediate(() => {
                            makeAiMove(game)
                                .then(async () => {
                                    try {
                                        updateGameCache(game);
                                        await db.saveGame(game);
                                        const { broadcastToGameParticipants } = await import('./socket.js');
                                        broadcastToGameParticipants(gameId, { type: 'GAME_UPDATE', payload: { [gameId]: game } }, game);
                                    } catch (e: any) {
                                        console.error('[GameActions] Alkkagi post-placement attack save/broadcast failed:', e?.message);
                                    }
                                })
                                .catch((err: any) => {
                                    console.error('[GameActions] Alkkagi post-placement makeAiMove (attack) failed:', err?.message);
                                });
                        });
                    }
                }
            }

            // 알까기 공격: 서버 애니 duration(2500ms)과 맞춰 시뮬 완료 후 AI 턴 스케줄
            const ALKKAGI_FLICK_DURATION_MS = 2500;
            const isAlkkagiHumanFlick =
                type === 'ALKKAGI_FLICK_STONE' &&
                game.mode === GameMode.Alkkagi &&
                game.isAiGame &&
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

            return result;
        }
    }

    // Non-Game actions
    // ADMIN_ 액션은 위에서 이미 처리됨
    if (type.includes('NEGOTIATION') || type === 'START_AI_GAME' || type === 'REQUEST_REMATCH' || type === 'CHALLENGE_USER' || type === 'SEND_CHALLENGE') return handleNegotiationAction(volatileState, action, userData);
    if (type === 'CLAIM_SINGLE_PLAYER_MISSION_REWARD' || type === 'CLAIM_ALL_TRAINING_QUEST_REWARDS' || type === 'START_SINGLE_PLAYER_MISSION' || type === 'LEVEL_UP_TRAINING_QUEST') {
        return handleSinglePlayerAction(volatileState, action, userData);
    }
    // 타워 액션은 위에서 이미 처리됨 (중복 제거)
    // 던전 액션은 토너먼트 액션으로 처리해야 하므로 CLAIM_ 체크보다 먼저 확인
    if (type.startsWith('START_DUNGEON') ||
        type.startsWith('COMPLETE_DUNGEON') ||
        type.startsWith('CLAIM_DUNGEON') ||
        type === 'START_DUNGEON_STAGE' ||
        type === 'COMPLETE_DUNGEON_STAGE' ||
        type === 'CLAIM_DUNGEON_REWARD') {
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
    
    if (type.startsWith('CLAIM_') || type.startsWith('DELETE_MAIL') || type === 'DELETE_ALL_CLAIMED_MAIL' || type === 'MARK_MAIL_AS_READ') return handleRewardAction(volatileState, action, userData);
    if (type.startsWith('BUY_') || type === 'PURCHASE_ACTION_POINTS' || type === 'EXPAND_INVENTORY' || type === 'BUY_TOWER_ITEM' || type === 'CLAIM_SHOP_AD_REWARD') return handleShopAction(volatileState, action, userData);
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
    if (['TOGGLE_EQUIP_ITEM', 'SELL_ITEM', 'ENHANCE_ITEM', 'DISASSEMBLE_ITEM', 'USE_ITEM', 'USE_ALL_ITEMS_OF_TYPE', 'CRAFT_MATERIAL', 'COMBINE_ITEMS', 'REFINE_EQUIPMENT'].includes(type)) return handleInventoryAction(volatileState, action, userData);
    if (['UPDATE_AVATAR', 'UPDATE_BORDER', 'CHANGE_NICKNAME', 'RESET_STAT_POINTS', 'CONFIRM_STAT_ALLOCATION', 'UPDATE_MBTI', 'SAVE_PRESET', 'APPLY_PRESET', 'UPDATE_REJECTION_SETTINGS', 'SAVE_GAME_RECORD', 'DELETE_GAME_RECORD', 'RECORD_ADVENTURE_MONSTER_DEFEAT', 'START_ADVENTURE_MONSTER_BATTLE', 'PREPARE_ADVENTURE_MAP_TREASURE_CHEST', 'CONFIRM_ADVENTURE_MAP_TREASURE_CHEST', 'ABANDON_ADVENTURE_MAP_TREASURE_PICK', 'REROLL_ADVENTURE_REGIONAL_BUFF', 'ENHANCE_ADVENTURE_REGIONAL_BUFF', 'ADVANCE_ONBOARDING_TUTORIAL', 'BEGIN_ONBOARDING_ON_FIRST_HOME', 'SKIP_ONBOARDING_TUTORIAL', 'FINISH_ONBOARDING_TUTORIAL_WITH_REWARD', 'CLAIM_ONBOARDING_INTRO1_FAN', 'ACK_ONBOARDING_INTRO1_RESULT_ITEM_MODAL', 'CONFIRM_ONBOARDING_INTRO1_RESULT_BUTTONS_READ', 'ADMIN_SET_VIP_TEST_FLAGS'].includes(type)) return handleUserAction(volatileState, action, userData);
    if (type.includes('SINGLE_PLAYER')) return handleSinglePlayerAction(volatileState, action, userData);
    if (type === 'MANNER_ACTION') return mannerService.handleMannerAction(volatileState, action, userData);
    // Guild actions are now handled above (before game actions)
    // LEAVE_AI_GAME은 gameId를 가지지만 소셜 액션으로 처리해야 함
    if (type === 'LEAVE_AI_GAME') return handleSocialAction(volatileState, action, userData);
    
    // Social actions can be game-related (chat in game) or not (logout)
    const socialResult = await handleSocialAction(volatileState, action, userData);
    if (socialResult) return socialResult;

    return { error: `Unhandled action type: ${type}` };
};