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
import { DAILY_QUESTS, WEEKLY_QUESTS, MONTHLY_QUESTS, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, ACTION_POINT_REGEN_INTERVAL_MS, ITEM_SELL_PRICES, MATERIAL_SELL_PRICES } from '../shared/constants';
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

export type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
};

// --- Helper Functions (moved from the old gameActions) ---
const normalizeLegacyQuestTexts = (user: User): boolean => {
    if (!user.quests) return false;

    let changed = false;
    const questGroups = [user.quests.daily?.quests, user.quests.weekly?.quests, user.quests.monthly?.quests];

    for (const quests of questGroups) {
        if (!Array.isArray(quests)) continue;
        for (const quest of quests) {
            if (quest.title === '자동대국 토너먼트 참여하기' || quest.title === '챔피언십 경기 진행하기') {
                quest.title = '챔피언십 경기 완료하기';
                changed = true;
            }
            if (quest.title === '일일퀘스트 활약도100보상 받기(3/3)') {
                quest.title = '일일퀘스트 활약도100보상 받기 3회';
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

export const updateQuestProgress = (user: User, type: 'win' | 'participate' | 'action_button' | 'tournament_participate' | 'enhancement_attempt' | 'craft_attempt' | 'chat_greeting' | 'championship_play' | 'login' | 'claim_daily_milestone_100' | 'claim_weekly_milestone_100', mode?: GameMode, amount: number = 1) => {
    if (!user.quests) return;
    const isStrategic = mode ? SPECIAL_GAME_MODES.some(m => m.mode === mode) : false;
    const isPlayful = mode ? PLAYFUL_GAME_MODES.some(m => m.mode === mode) : false;

    const questsToUpdate: Quest[] = [
        ...(user.quests.daily?.quests || []),
        ...(user.quests.weekly?.quests || []),
        ...(user.quests.monthly?.quests || [])
    ];

    for (const quest of questsToUpdate) {
        if (quest.isClaimed) continue;

        let shouldUpdate = false;
        switch (quest.title) {
            case '출석하기': if (type === 'login') shouldUpdate = true; break;
            case '채팅창에 인사하기': if (type === 'chat_greeting') shouldUpdate = true; break;
            case '전략바둑 플레이하기': if (type === 'participate' && isStrategic) shouldUpdate = true; break;
            case '놀이바둑 플레이하기': if (type === 'participate' && isPlayful) shouldUpdate = true; break;
            case '전략바둑 승리하기': if (type === 'win' && isStrategic) shouldUpdate = true; break;
            case '놀이바둑 승리하기': if (type === 'win' && isPlayful) shouldUpdate = true; break;
            case '액션버튼 사용하기': if (type === 'action_button') shouldUpdate = true; break;
            case '챔피언십 경기 완료하기':
            case '챔피언십 경기 진행하기':
            case '자동대국 토너먼트 참여하기':
                if (type === 'championship_play' || type === 'tournament_participate') shouldUpdate = true;
                break;
            case '장비 강화시도': if (type === 'enhancement_attempt') shouldUpdate = true; break;
            case '재료 합성시도': if (type === 'craft_attempt') shouldUpdate = true; break;
            case '일일퀘스트 활약도100보상 받기 3회':
            case '일일퀘스트 활약도100보상 받기(3/3)':
                if (type === 'claim_daily_milestone_100') shouldUpdate = true;
                break;
            case '일일 퀘스트 활약도100 보상받기 10회': if (type === 'claim_daily_milestone_100') shouldUpdate = true; break;
            case '주간퀘스트 활약도100보상 받기(2/2)': if (type === 'claim_weekly_milestone_100') shouldUpdate = true; break;
        }

        if (shouldUpdate) {
            quest.progress = Math.min(quest.target, quest.progress + amount);
        }
    }
};

export const handleAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user?: User): Promise<HandleActionResult> => {
    const { type, payload } = action;
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
    if (type.startsWith('ADMIN_')) return handleAdminAction(volatileState, action, userData);

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
    if (gameId && type !== 'LEAVE_AI_GAME') {
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
                    const { handleStrategicGameAction } = await import('./modes/strategic.js');
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
            const { handleStrategicGameAction } = await import('./modes/strategic.js');
            const result = await handleStrategicGameAction(volatileState, game, action, userData);
            return result || {};
        }
        
        // 싱글플레이·도전의 탑 히든/스캔 액션 먼저 처리 (게임을 찾기 전에)
        const actionTypeStr = type as string;
        if (actionTypeStr === 'START_HIDDEN_PLACEMENT' || actionTypeStr === 'START_SCANNING' || actionTypeStr === 'SCAN_BOARD') {
            const { getCachedGame, updateGameCache } = await import('./gameCache.js');
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
                applyPveItemActionClientSync(game, payload);
            }
            // 도전의 탑: PVE 히든/스캔은 towerPlayerHidden으로 처리 (싱글플레이와 동일 규칙)
            if (game.gameCategory === 'tower' && SPECIAL_GAME_MODES.some(m => m.mode === game.mode)) {
                const isTowerHiddenAction = actionTypeStr === 'START_HIDDEN_PLACEMENT' || actionTypeStr === 'START_SCANNING' || actionTypeStr === 'SCAN_BOARD';
                if (isTowerHiddenAction) {
                    const { handleTowerPlayerHiddenAction } = await import('./modes/towerPlayerHidden.js');
                    const towerResult = handleTowerPlayerHiddenAction(volatileState, game, action, userData);
                    if (towerResult !== null) {
                        if (!(towerResult as any).error) {
                            if (type === 'SCAN_BOARD' && consumeOneTowerLobbyInventoryItem(userData, TOWER_LOBBY_SCAN_NAMES)) {
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
                const { handleStrategicGameAction } = await import('./modes/strategic.js');
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
                        const { handleStrategicGameAction } = await import('./modes/strategic.js');
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
                    const { handleStrategicGameAction } = await import('./modes/strategic.js');
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
        
        console.log(`[handleAction] Game found: gameId=${gameId}, type=${type}, isSinglePlayer=${game.isSinglePlayer}, gameStatus=${game.gameStatus}`);

        // 클라이언트 측 AI(WASM/Electron) 실패 시 서버 GnuGo로 해당 국면 수 계산 폴백 (예: 패 포함 수순)
        if (type === 'REQUEST_SERVER_AI_MOVE') {
            const useClientSideAi = (game.settings as any)?.useClientSideAi === true;
            if (!useClientSideAi) {
                return { error: 'Game does not use client-side AI.' };
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
            return { clientResponse: { serverAiMoveDone: true } };
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
            const shouldHandlePlaceStoneOnServer = type === 'PLACE_STONE' && isStrategicPVE;
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
        
        if (result == null && SPECIAL_GAME_MODES.some(m => m.mode === game.mode)) {
            result = await handleStrategicGameAction(volatileState, game, action, userData);
        } else if (result == null && PLAYFUL_GAME_MODES.some(m => m.mode === game.mode)) {
            result = await handlePlayfulGameAction(volatileState, game, action, userData);
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
                if (game.gameStatus === 'alkkagi_playing') {
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
                        if (g.gameStatus === 'alkkagi_playing' && g.currentPlayer !== types.Player.None && currentPlayerId === aiUserId) {
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
    if (type.startsWith('BUY_') || type === 'PURCHASE_ACTION_POINTS' || type === 'EXPAND_INVENTORY' || type === 'BUY_TOWER_ITEM') return handleShopAction(volatileState, action, userData);
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
        type === 'START_TOURNAMENT_ROUND' ||
        type === 'ENTER_TOURNAMENT_VIEW' || 
        type === 'LEAVE_TOURNAMENT_VIEW' ||
        type === 'CLAIM_TOURNAMENT_REWARD' ||
        type === 'COMPLETE_TOURNAMENT_SIMULATION') {
        console.log(`[handleAction] Routing ${type} to handleTournamentAction`);
        return handleTournamentAction(volatileState, action, userData);
    }
    if (['TOGGLE_EQUIP_ITEM', 'SELL_ITEM', 'ENHANCE_ITEM', 'DISASSEMBLE_ITEM', 'USE_ITEM', 'USE_ALL_ITEMS_OF_TYPE', 'CRAFT_MATERIAL', 'COMBINE_ITEMS', 'REFINE_EQUIPMENT'].includes(type)) return handleInventoryAction(volatileState, action, userData);
    if (['UPDATE_AVATAR', 'UPDATE_BORDER', 'CHANGE_NICKNAME', 'RESET_STAT_POINTS', 'CONFIRM_STAT_ALLOCATION', 'UPDATE_MBTI', 'SAVE_PRESET', 'APPLY_PRESET', 'UPDATE_REJECTION_SETTINGS', 'SAVE_GAME_RECORD', 'DELETE_GAME_RECORD', 'RECORD_ADVENTURE_MONSTER_DEFEAT', 'START_ADVENTURE_MONSTER_BATTLE'].includes(type)) return handleUserAction(volatileState, action, userData);
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