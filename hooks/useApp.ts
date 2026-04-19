import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
// FIX: The main types barrel file now exports settings types. Use it for consistency.
import { User, LiveGameSession, UserWithStatus, ServerAction, GameMode, Negotiation, ChatMessage, UserStatus, UserStatusInfo, AdminLog, Announcement, OverrideAnnouncement, InventoryItem, AppState, InventoryItemType, AppRoute, QuestReward, DailyQuestData, WeeklyQuestData, MonthlyQuestData, SoundSettings, FeatureSettings, AppSettings, PanelEdgeStyle, CoreStat, SpecialStat, MythicStat, EquipmentSlot, EquipmentPreset, Player, HomeBoardPost, GameRecord, Guild } from '../types.js';
import { HandleActionResult } from '../types/api.js';
import { Point } from '../types/enums.js';
import { audioService } from '../services/audioService.js';
import { stableStringify, parseHash, replaceAppHash, navigateFromGameIfApplicable } from '../utils/appUtils.js';
import { getApiUrl, getWebSocketUrlFor } from '../utils/apiConfig.js';
import { 
    DAILY_MILESTONE_THRESHOLDS,
    WEEKLY_MILESTONE_THRESHOLDS,
    MONTHLY_MILESTONE_THRESHOLDS,
    SPECIAL_GAME_MODES,
    PLAYFUL_GAME_MODES,
    isOpponentInsufficientActionPointsError,
} from '../constants.js';
import { defaultSettings, SETTINGS_STORAGE_KEY } from './useAppSettings.js';
import {
    useIsHandheldDevice,
    useViewportHeightBelow,
    VIEWPORT_HEIGHT_LAYOUT_BREAKPOINT,
    useTouchLayoutProfile,
    useIsPortrait,
    useHandheldPortraitLockActive,
} from './useIsMobileLayout.js';
import { syncDocumentViewportHeightVar } from '../utils/layoutViewportCss.js';
import { getPanelEdgeImages } from '../constants/panelEdges.js';
import { SINGLE_PLAYER_STAGES } from '../constants/singlePlayerConstants.js';
import { TOWER_STAGES } from '../constants/towerConstants.js';
import { calculateUserEffects } from '../services/effectService.js';
import { coerceSpecialStatType } from '../shared/utils/specialStatMilestones.js';
import { ACTION_POINT_REGEN_INTERVAL_MS } from '../constants/rules.js';
import { aiUserId, OTHER_DEVICE_LOGIN_SHARED_PC_REASON } from '../constants/auth.js';
import {
    mergeArenaEntranceAvailability,
    ARENA_ENTRANCE_CLOSED_MESSAGE,
    type ArenaEntranceKey,
} from '../constants/arenaEntrance.js';
import { applyOnboardingArenaEntranceTutorialLocks } from '../shared/constants/onboardingTutorial.js';
import { applyUserProgressionArenaLocks, getBadukAbilitySnapshotFromStats } from '../shared/utils/contentProgressionGates.js';
import { calculateTotalStats } from '../services/statService.js';
import { isClientAdmin } from '../utils/clientAdmin.js';
import { getLightGoAiMove } from '../client/logic/lightGoAi.js';
import { processMoveClient } from '../client/goLogicClient.js';
import { applyMissileCaptureProcessResult } from '../shared/utils/missileLandingCapture.js';
import { isDiceGoLibertyPlacement } from '../client/logic/goLogic.js';
import { mapNormalizeInventoryList } from '../shared/utils/inventoryLegacyNormalize.js';
import { mergeAdventureProfileForPersistence } from '../utils/adventureProfileMerge.js';
import type { LevelUpCelebrationPayload } from '../types/levelUpModal.js';
import type { MannerGradeChangePayload } from '../types/mannerGradeChangeModal.js';
import { getMannerRank, MANNER_RANKS } from '../services/manner.js';

/** 도전의 탑 PVE: 일반 수는 클라이언트만 반영되어 서버 game의 판·수순이 뒤처질 수 있음. 히든/스캔/미사일 선택 진입 시 응답으로 덮어쓰면 판이 초기화되는 버그 방지. */
function mergeTowerServerGameWithClientBoardIfStale(
    serverGame: LiveGameSession,
    clientGame: LiveGameSession | undefined
): LiveGameSession {
    if (!clientGame) return serverGame;
    const clientMoves = clientGame.moveHistory?.length ?? 0;
    const serverMoves = serverGame.moveHistory?.length ?? 0;
    const rowHasStone = (row: unknown) =>
        Array.isArray(row) && row.some((cell: unknown) => cell !== 0 && cell !== null && cell !== undefined);
    const boardHasStones = (board: unknown) =>
        Array.isArray(board) && board.some(rowHasStone);
    const clientBoardHasStones = boardHasStones(clientGame.boardState);
    const serverBoardHasStones = boardHasStones(serverGame.boardState);
    const clientAhead = clientMoves > serverMoves;
    const serverBoardStale = clientMoves > 0 && !serverBoardHasStones;
    const equalMovesButServerEmptyBoard =
        clientMoves === serverMoves && clientMoves > 0 && clientBoardHasStones && !serverBoardHasStones;
    if (!clientAhead && !serverBoardStale && !equalMovesButServerEmptyBoard) return serverGame;
    const bonusMerged = Math.max(
        Number((serverGame as any).blackTurnLimitBonus) || 0,
        Number((clientGame as any).blackTurnLimitBonus) || 0
    );
    return {
        ...serverGame,
        boardState: clientGame.boardState,
        moveHistory: clientGame.moveHistory,
        totalTurns: clientGame.totalTurns ?? serverGame.totalTurns,
        captures: clientGame.captures ?? serverGame.captures,
        koInfo: clientGame.koInfo ?? serverGame.koInfo,
        hiddenMoves: clientGame.hiddenMoves ?? serverGame.hiddenMoves,
        ...(bonusMerged > 0 ? { blackTurnLimitBonus: bonusMerged } : {}),
        ...((clientGame as { aiInitialHiddenStone?: { x: number; y: number } | null }).aiInitialHiddenStone !== undefined
            ? {
                  aiInitialHiddenStone: (clientGame as { aiInitialHiddenStone?: { x: number; y: number } | null })
                      .aiInitialHiddenStone,
              }
            : {}),
        permanentlyRevealedStones: clientGame.permanentlyRevealedStones ?? serverGame.permanentlyRevealedStones,
        blackPatternStones: clientGame.blackPatternStones ?? serverGame.blackPatternStones,
        whitePatternStones: clientGame.whitePatternStones ?? serverGame.whitePatternStones,
        consumedPatternIntersections:
            (clientGame as any).consumedPatternIntersections ?? (serverGame as any).consumedPatternIntersections,
        revealedHiddenMoves: clientGame.revealedHiddenMoves ?? serverGame.revealedHiddenMoves,
        serverRevision: Math.max(clientGame.serverRevision ?? 0, serverGame.serverRevision ?? 0),
        // 경기 중 상점 구매 등: 응답의 세션 잔여(미사일·히든·스캔)는 판·수순 병합 후에도 서버 값을 유지
        missiles_p1: (serverGame as any).missiles_p1 ?? (clientGame as any).missiles_p1,
        hidden_stones_p1: (serverGame as any).hidden_stones_p1 ?? (clientGame as any).hidden_stones_p1,
        scans_p1: (serverGame as any).scans_p1 ?? (clientGame as any).scans_p1,
    };
}

/** INITIAL_STATE 스냅샷이 pending인데 로컬 세션이 이미 진행 중이면 덮어쓰지 않음 (재연결·서버 목록 시차로 계가 직후 타워 설명 모달이 뜨는 현상 방지) */
function shouldKeepLocalSessionOverIncomingPending(prevG: LiveGameSession, incoming: LiveGameSession): boolean {
    if ((incoming.gameStatus || '') !== 'pending') return false;
    const s = prevG.gameStatus || '';
    return s === 'playing' || s === 'scoring' || s === 'hidden_final_reveal' || s === 'ended' || s === 'no_contest';
}

/** WebSocket INITIAL_STATE에서 boardState를 떼어내므로, 격자가 없으면 F5 후에도 /api/game/rejoin으로 전체 판·수순을 받아야 한다. */
function hasHydratedBoardGridForRejoin(game: LiveGameSession | undefined): boolean {
    const b = game?.boardState;
    if (!b || !Array.isArray(b) || b.length === 0) return false;
    const row0 = b[0];
    return Array.isArray(row0) && row0.length > 0;
}

/**
 * INITIAL_STATE가 pending·무수순으로 올 때 sessionStorage에 진행 중 대국이 있으면(새로고침)
 * 경기 시작 모달·따낸 돌·시간·턴이 초기화되는 것을 막는다.
 */
function augmentPveFromSessionStorageSnapshot(
    incoming: LiveGameSession,
    parsed: Record<string, unknown> | null | undefined
): LiveGameSession {
    if (!parsed || (parsed as { gameId?: string }).gameId !== incoming.id) return incoming;

    const stMoves = Array.isArray((parsed as { moveHistory?: unknown }).moveHistory)
        ? ((parsed as { moveHistory: unknown[] }).moveHistory?.length ?? 0)
        : 0;
    const incMoves = Array.isArray(incoming.moveHistory) ? incoming.moveHistory.length : 0;
    const stTotalRaw = (parsed as { totalTurns?: unknown }).totalTurns;
    const stTotal = typeof stTotalRaw === 'number' && Number.isFinite(stTotalRaw) ? stTotalRaw : 0;
    const incTotal = incoming.totalTurns ?? 0;
    const cap = (parsed as { captures?: Record<number, number> }).captures;
    const hasStoredCaptures =
        cap &&
        typeof cap === 'object' &&
        ((cap[Player.Black] ?? 0) > 0 || (cap[Player.White] ?? 0) > 0);

    const midGame =
        stMoves > 0 ||
        stTotal > incTotal ||
        (stTotal > 0 && incMoves === 0) ||
        !!hasStoredCaptures;

    if (!midGame) return incoming;

    const incPending = (incoming.gameStatus || '') === 'pending';
    const storedStatus = String((parsed as { gameStatus?: string }).gameStatus || '');
    const playingish = [
        'playing',
        'hidden_placing',
        'scanning',
        'missile_selecting',
        'missile_animating',
        'scanning_animating',
        'hidden_reveal_animating',
        'scoring',
        'hidden_final_reveal',
    ].includes(storedStatus);

    const out: LiveGameSession = { ...incoming };
    const pm = (parsed as { moveHistory?: LiveGameSession['moveHistory'] }).moveHistory;
    if (stMoves > incMoves && Array.isArray(pm)) {
        out.moveHistory = pm;
    }
    const pb = (parsed as { boardState?: LiveGameSession['boardState'] }).boardState;
    if (Array.isArray(pb) && pb.length > 0 && Array.isArray(pb[0]) && (pb[0] as unknown[]).length > 0) {
        const pbOk = pb.some(
            (row: unknown) =>
                Array.isArray(row) && row.some((c: unknown) => c !== 0 && c !== null && c !== undefined)
        );
        if (pbOk) out.boardState = pb;
    }
    if (typeof stTotalRaw === 'number' && Number.isFinite(stTotalRaw) && stTotalRaw > (out.totalTurns ?? 0)) {
        (out as { totalTurns?: number }).totalTurns = stTotalRaw;
    }
    if (cap && typeof cap === 'object') out.captures = cap as LiveGameSession['captures'];
    const bsc = (parsed as { baseStoneCaptures?: unknown }).baseStoneCaptures;
    if (bsc && typeof bsc === 'object') (out as { baseStoneCaptures?: unknown }).baseStoneCaptures = bsc;
    const hsc = (parsed as { hiddenStoneCaptures?: unknown }).hiddenStoneCaptures;
    if (hsc && typeof hsc === 'object') (out as { hiddenStoneCaptures?: unknown }).hiddenStoneCaptures = hsc;

    if (incPending && (playingish || stMoves > 0)) {
        if (playingish && storedStatus) (out as { gameStatus?: string }).gameStatus = storedStatus as LiveGameSession['gameStatus'];
        else out.gameStatus = 'playing';
        const st = (parsed as { startTime?: unknown }).startTime;
        if (typeof st === 'number') (out as { startTime?: number }).startTime = st;
        const cp = (parsed as { currentPlayer?: unknown }).currentPlayer;
        if (typeof cp === 'number') out.currentPlayer = cp as Player;
    }

    const btl = (parsed as { blackTimeLeft?: unknown }).blackTimeLeft;
    if (typeof btl === 'number') out.blackTimeLeft = btl;
    const wtl = (parsed as { whiteTimeLeft?: unknown }).whiteTimeLeft;
    if (typeof wtl === 'number') out.whiteTimeLeft = wtl;
    if ((parsed as { turnDeadline?: unknown }).turnDeadline != null)
        out.turnDeadline = (parsed as { turnDeadline: number | undefined }).turnDeadline;
    if ((parsed as { turnStartTime?: unknown }).turnStartTime != null)
        out.turnStartTime = (parsed as { turnStartTime: number | undefined }).turnStartTime;
    const gst = (parsed as { gameStartTime?: unknown }).gameStartTime;
    if (typeof gst === 'number') (out as { gameStartTime?: number }).gameStartTime = gst;
    const btb = (parsed as { blackTurnLimitBonus?: unknown }).blackTurnLimitBonus;
    if (btb != null) (out as { blackTurnLimitBonus?: number }).blackTurnLimitBonus = Number(btb) || 0;

    const sbp = (parsed as { blackPatternStones?: unknown }).blackPatternStones;
    if (Array.isArray(sbp)) out.blackPatternStones = sbp as LiveGameSession['blackPatternStones'];
    const swp = (parsed as { whitePatternStones?: unknown }).whitePatternStones;
    if (Array.isArray(swp)) out.whitePatternStones = swp as LiveGameSession['whitePatternStones'];
    if ((parsed as { lastMove?: unknown }).lastMove != null)
        out.lastMove = (parsed as { lastMove: LiveGameSession['lastMove'] }).lastMove;
    if ((parsed as { koInfo?: unknown }).koInfo !== undefined)
        out.koInfo = (parsed as { koInfo: LiveGameSession['koInfo'] }).koInfo;
    const hm = (parsed as { hiddenMoves?: unknown }).hiddenMoves;
    if (hm && typeof hm === 'object') out.hiddenMoves = hm as LiveGameSession['hiddenMoves'];
    const pr = (parsed as { permanentlyRevealedStones?: unknown }).permanentlyRevealedStones;
    if (Array.isArray(pr)) out.permanentlyRevealedStones = pr as LiveGameSession['permanentlyRevealedStones'];
    const h1 = (parsed as { hidden_stones_p1?: unknown }).hidden_stones_p1;
    if (typeof h1 === 'number') (out as { hidden_stones_p1?: number }).hidden_stones_p1 = h1;
    const h2 = (parsed as { hidden_stones_p2?: unknown }).hidden_stones_p2;
    if (typeof h2 === 'number') (out as { hidden_stones_p2?: number }).hidden_stones_p2 = h2;

    return out;
}

/** PLACE_STONE 패(코) 불가 — Game 전광판으로 안내하므로 전역 에러 모달은 생략 */
function shouldSuppressModalForKoPlaceStone(action: ServerAction, errorMessage: string): boolean {
    if (action.type !== 'PLACE_STONE') return false;
    return (
        errorMessage.includes('패 모양') ||
        errorMessage.includes('코 금지') ||
        (errorMessage.includes('바로') && errorMessage.includes('따낼')) ||
        (errorMessage.includes('같은 위치') && errorMessage.includes('다시'))
    );
}

export const useApp = () => {
    // --- State Management ---
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        try {
            const stored = sessionStorage.getItem('currentUser');
            if (stored) {
                const u = JSON.parse(stored) as User;
                if (u?.inventory && Array.isArray(u.inventory)) {
                    u.inventory = mapNormalizeInventoryList(u.inventory);
                }
                return u;
            }
        } catch (e) { console.error('Failed to parse user from sessionStorage', e); }
        return null;
    });

    const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => parseHash(window.location.hash));
    const currentRouteRef = useRef(currentRoute);
    const [error, setError] = useState<string | null>(null);
    const isLoggingOut = useRef(false);
    // 강제 리렌더링을 위한 카운터
    const [updateTrigger, setUpdateTrigger] = useState(0);
    const currentUserRef = useRef<User | null>(null);
    /** useEffect보다 먼저 도는 자식 effect(GuildWar의 GET_GUILD_WAR_DATA 등)에서도 id를 쓰려면 렌더와 동기화 필요 */
    currentUserRef.current = currentUser;
    const currentUserStatusRef = useRef<UserWithStatus | null>(null);
    // HTTP 응답 후 일정 시간 내 WebSocket 업데이트 무시 (중복 방지)
    const lastHttpUpdateTime = useRef<number>(0);
    const lastHttpActionType = useRef<string | null>(null);
    const lastHttpHadUpdatedUser = useRef<boolean>(false); // HTTP 응답에 updatedUser가 있었는지 추적
    const HTTP_UPDATE_DEBOUNCE_MS = 2000; // HTTP 응답 후 2초 내 WebSocket 업데이트 무시 (더 긴 시간으로 확실하게 보호)
    // AI 게임 경기 시작 후 경기장 입장 시 state 반영 전 리다이렉트 방지 (레이스 컨디션)
    // CONFIRM_AI_GAME_START 응답의 게임을 보관해 'Game not found after max attempts' 시에도 라우팅 가능하게 함
    const pendingAiGameEntryRef = useRef<{ gameId: string; until: number; game?: LiveGameSession } | null>(null);
    // 클라이언트 측 AI(Electron): 같은 턴에 중복 전송 방지
    const lastClientSideAiSentRef = useRef<Record<string, number>>({});
    // 새로고침(F5) 후 재입장: 재입장 API 실패 시에만 게임 페이지에서 나가기
    const [rejoinFailedForGameId, setRejoinFailedForGameId] = useState<string | null>(null);
    const rejoinRequestedRef = useRef<Set<string>>(new Set());

    const mergeUserState = useCallback((prev: User | null, updates: Partial<User>) => {
        if (!prev) {
            return updates as User;
        }
        
        // 깊은 병합을 위해 JSON 직렬화/역직렬화 사용
        const base = JSON.parse(JSON.stringify(prev)) as User;
        const patch = JSON.parse(JSON.stringify(updates)) as Partial<User>;
        
        // inventory는 배열이므로 완전히 교체 (깊은 복사로 새로운 참조 생성)
        const mergedInventoryRaw =
            patch.inventory !== undefined
                ? (JSON.parse(JSON.stringify(patch.inventory)) as InventoryItem[])
                : base.inventory;
        const mergedInventory = Array.isArray(mergedInventoryRaw)
            ? mapNormalizeInventoryList(mergedInventoryRaw)
            : mergedInventoryRaw;
        
        // 중첩된 객체들을 깊게 병합
        // ID는 항상 이전 사용자의 ID로 유지 (다른 사용자 정보로 덮어씌워지는 것을 방지)
        const prevId = prev.id;
        const merged: User = {
            ...base,
            ...patch,
            // ID는 항상 이전 사용자의 ID로 강제 유지 (보안: 다른 사용자로 로그인 변경 방지)
            id: prevId,
            // 모험 프로필: 지역 특화 효과는 스테이지 키 단위로만 덮어써서 다른 지역 슬롯이 사라지지 않게 함
            adventureProfile:
                patch.adventureProfile !== undefined
                    ? mergeAdventureProfileForPersistence(patch.adventureProfile, base.adventureProfile)
                    : base.adventureProfile,
            // inventory는 배열이므로 완전히 교체 (새로운 참조로)
            inventory: mergedInventory,
            // equipment는 객체이므로 완전히 교체 (서버에서 보내는 equipment는 항상 전체 상태)
            equipment: patch.equipment !== undefined ? (patch.equipment || {}) : base.equipment,
            // actionPoints는 객체이므로 병합
            actionPoints: patch.actionPoints !== undefined ? { ...base.actionPoints, ...patch.actionPoints } : base.actionPoints,
            // stats 객체들도 병합
            stats: patch.stats !== undefined ? { ...base.stats, ...patch.stats } : base.stats,
            // 기타 중첩 객체들도 병합
            equipmentPresets: patch.equipmentPresets !== undefined ? patch.equipmentPresets : base.equipmentPresets,
            clearedSinglePlayerStages: patch.clearedSinglePlayerStages !== undefined ? patch.clearedSinglePlayerStages : base.clearedSinglePlayerStages,
            // singlePlayerMissions는 객체이므로 병합
            singlePlayerMissions: patch.singlePlayerMissions !== undefined ? { ...base.singlePlayerMissions, ...patch.singlePlayerMissions } : base.singlePlayerMissions,
            // 챔피언십 토너먼트 상태(누적 보상 등)는 서버 응답으로 완전히 교체
            lastNeighborhoodTournament: patch.lastNeighborhoodTournament !== undefined ? patch.lastNeighborhoodTournament : base.lastNeighborhoodTournament,
            lastNationalTournament: patch.lastNationalTournament !== undefined ? patch.lastNationalTournament : base.lastNationalTournament,
            lastWorldTournament: patch.lastWorldTournament !== undefined ? patch.lastWorldTournament : base.lastWorldTournament,
        };
        
        return merged;
    }, []);

    const applyUserUpdate = useCallback((updates: Partial<User>, source: string) => {
        const prevUser = currentUserRef.current;
        
        // 보안: 다른 사용자의 ID가 포함된 업데이트는 무시 (다른 사용자로 로그인 변경 방지)
        if (prevUser && updates.id && updates.id !== prevUser.id) {
            console.warn(`[applyUserUpdate] Rejected update from ${source}: ID mismatch (prev: ${prevUser.id}, update: ${updates.id})`);
            return prevUser;
        }
        
        const mergedUser = mergeUserState(prevUser, updates);
        
        // 추가 보안: 병합 후에도 ID가 변경되지 않았는지 확인
        if (prevUser && mergedUser.id !== prevUser.id) {
            console.error(`[applyUserUpdate] CRITICAL: ID changed after merge! (prev: ${prevUser.id}, merged: ${mergedUser.id}). Restoring previous ID.`);
            mergedUser.id = prevUser.id;
        }
        
        // 실제 변경사항이 있는지 확인 (불필요한 리렌더링 방지)
        // 중요한 필드들을 직접 비교하여 더 정확한 변경 감지
        let hasActualChanges = !prevUser;
        if (prevUser) {
            // inventory 배열 길이와 내용 비교 (더 정확한 변경 감지)
            const inventoryChanged = 
                prevUser.inventory?.length !== mergedUser.inventory?.length ||
                JSON.stringify(prevUser.inventory) !== JSON.stringify(mergedUser.inventory);
            
            // 주요 필드 직접 비교 (챔피언십 던전 입장 시 토너먼트 상태 변경 감지 포함)
            const tournamentStateChanged =
                JSON.stringify(prevUser.lastNeighborhoodTournament) !== JSON.stringify(mergedUser.lastNeighborhoodTournament) ||
                JSON.stringify(prevUser.lastNationalTournament) !== JSON.stringify(mergedUser.lastNationalTournament) ||
                JSON.stringify(prevUser.lastWorldTournament) !== JSON.stringify(mergedUser.lastWorldTournament);
            const keyFieldsChanged = 
                prevUser.gold !== mergedUser.gold ||
                prevUser.diamonds !== mergedUser.diamonds ||
                prevUser.towerFloor !== mergedUser.towerFloor ||
                prevUser.monthlyTowerFloor !== mergedUser.monthlyTowerFloor ||
                prevUser.strategyXp !== mergedUser.strategyXp ||
                prevUser.playfulXp !== mergedUser.playfulXp ||
                prevUser.strategyLevel !== mergedUser.strategyLevel ||
                prevUser.playfulLevel !== mergedUser.playfulLevel ||
                prevUser.avatarId !== mergedUser.avatarId ||
                prevUser.borderId !== mergedUser.borderId ||
                prevUser.nickname !== mergedUser.nickname ||
                prevUser.mbti !== mergedUser.mbti ||
                prevUser.isMbtiPublic !== mergedUser.isMbtiPublic ||
                prevUser.mannerScore !== mergedUser.mannerScore ||
                prevUser.mannerMasteryApplied !== mergedUser.mannerMasteryApplied ||
                inventoryChanged ||
                tournamentStateChanged ||
                JSON.stringify(prevUser.equipment) !== JSON.stringify(mergedUser.equipment) ||
                JSON.stringify(prevUser.singlePlayerMissions) !== JSON.stringify(mergedUser.singlePlayerMissions) ||
                JSON.stringify(prevUser.actionPoints) !== JSON.stringify(mergedUser.actionPoints);
            
            // stableStringify로 전체 비교 (백업)
            const fullComparison = stableStringify(prevUser) !== stableStringify(mergedUser);
            
            hasActualChanges = keyFieldsChanged || fullComparison;
            
            // 보상 수령 관련 액션의 경우 inventory 변경을 강제로 감지
            if (source.includes('CLAIM') || source.includes('REWARD')) {
                if (inventoryChanged) {
                    hasActualChanges = true;
                    console.log(`[applyUserUpdate] Forcing update for ${source} due to inventory change`, {
                        prevLength: prevUser.inventory?.length,
                        newLength: mergedUser.inventory?.length
                    });
                }
            }
            // 챔피언십 던전 입장 시 토너먼트 상태 변경 강제 감지 (경기장 입장 실패 방지)
            if (source.includes('START_DUNGEON_STAGE') && tournamentStateChanged) {
                hasActualChanges = true;
            }
        }
        
        const updateKeys = Object.keys(updates || {}).filter(key => key !== 'id');

        if (!hasActualChanges && prevUser) {
            if (updateKeys.length === 0) {
                console.log(`[applyUserUpdate] No actual changes detected (${source}) and no update keys, skipping update.`);
                return prevUser;
            }

            // INITIAL_STATE의 경우 경고를 로그 레벨로 낮춤 (오류처럼 보이지 않도록)
            if (source === 'INITIAL_STATE') {
                console.log(`[applyUserUpdate] No diff detected for ${source}, but forcing refresh to avoid stale UI.`, { updateKeys });
            } else {
                console.warn(`[applyUserUpdate] No diff detected for ${source}, but forcing refresh to avoid stale UI.`, { updateKeys });
            }
        }
        
        currentUserRef.current = mergedUser;
        flushSync(() => {
            setCurrentUser(mergedUser);
            setUpdateTrigger(prev => prev + 1);
        });
        
        if (mergedUser.id) {
            setUsersMap(prevMap => ({ ...prevMap, [mergedUser.id]: mergedUser }));
        }
        
        try {
            sessionStorage.setItem('currentUser', JSON.stringify(mergedUser));
        } catch (e) {
            console.error(`[applyUserUpdate] Failed to persist user (${source})`, e);
        }
        
        console.log(`[applyUserUpdate] Applied update from ${source}`, {
            inventoryLength: mergedUser.inventory?.length,
            gold: mergedUser.gold,
            diamonds: mergedUser.diamonds
        });

        if (prevUser && source !== 'INITIAL_STATE') {
            const prevS = prevUser.strategyLevel ?? 1;
            const nextS = mergedUser.strategyLevel ?? 1;
            const prevP = prevUser.playfulLevel ?? 1;
            const nextP = mergedUser.playfulLevel ?? 1;
            const stratUp = nextS > prevS;
            const playUp = nextP > prevP;
            if (stratUp || playUp) {
                const levelPayload: LevelUpCelebrationPayload = {
                    strategy: stratUp ? { from: prevS, to: nextS } : undefined,
                    playful: playUp ? { from: prevP, to: nextP } : undefined,
                };
                const uid = mergedUser.id;
                const blockCelebration =
                    !!uid &&
                    Object.values(liveGamesRef.current).some((g) => {
                        if (!g || g.isSinglePlayer || g.gameCategory === 'tower') return false;
                        if (g.gameStatus !== 'ended') return false;
                        if (g.player1?.id !== uid && g.player2?.id !== uid) return false;
                        return true;
                    });
                queueMicrotask(() => {
                    if (blockCelebration) {
                        deferredLevelUpCelebrationRef.current = levelPayload;
                    } else {
                        deferredLevelUpCelebrationRef.current = null;
                        setLevelUpCelebration(levelPayload);
                    }
                });
            }

            const prevScore = prevUser.mannerScore ?? 200;
            const nextScore = mergedUser.mannerScore ?? 200;
            const prevRankName = getMannerRank(prevScore).rank;
            const nextRankName = getMannerRank(nextScore).rank;
            if (prevRankName !== nextRankName) {
                const prevIdx = MANNER_RANKS.findIndex((r) => r.name === prevRankName);
                const nextIdx = MANNER_RANKS.findIndex((r) => r.name === nextRankName);
                const direction: 'up' | 'down' =
                    prevIdx >= 0 && nextIdx >= 0
                        ? nextIdx > prevIdx
                            ? 'up'
                            : 'down'
                        : nextScore > prevScore
                          ? 'up'
                          : 'down';
                const mannerPayload: MannerGradeChangePayload = {
                    direction,
                    previousRank: prevRankName,
                    newRank: nextRankName,
                    previousScore: prevScore,
                    newScore: nextScore,
                };
                const uid = mergedUser.id;
                const blockManner =
                    !!uid &&
                    Object.values(liveGamesRef.current).some((g) => {
                        if (!g || g.isSinglePlayer || g.gameCategory === 'tower') return false;
                        if (g.gameStatus !== 'ended') return false;
                        if (g.player1?.id !== uid && g.player2?.id !== uid) return false;
                        return true;
                    });
                queueMicrotask(() => {
                    if (blockManner) {
                        deferredMannerGradeChangeRef.current = mannerPayload;
                    } else {
                        deferredMannerGradeChangeRef.current = null;
                        setMannerGradeChange(mannerPayload);
                    }
                });
            }
        }
        
        // HTTP 업데이트인 경우 타임스탬프 및 액션 타입 기록
        // (HTTP 응답에 updatedUser가 있었을 때만 타임스탬프 업데이트 - handleAction에서 처리)
        // 여기서는 source만 확인하여 로깅용으로 사용
        
        return mergedUser;
    }, [mergeUserState]);

    /** 서버 END_TOWER_GAME 응답 전에 하단 "다음 단계"가 눌리면 START_TOWER_GAME 잠금 검사가 옛 towerFloor로 실패하는 레이스 방지 */
    const applyOptimisticTowerClearOnBlackWin = useCallback((floor: number | undefined | null, winner: Player) => {
        if (winner !== Player.Black || floor == null || floor < 1) return;
        const prev = currentUserRef.current;
        if (!prev) return;
        const prevTf = prev.towerFloor ?? 0;
        const prevM = prev.monthlyTowerFloor ?? 0;
        const nextTf = Math.max(prevTf, floor);
        const nextM = Math.max(prevM, floor);
        if (nextTf === prevTf && nextM === prevM) return;
        applyUserUpdate({ towerFloor: nextTf, monthlyTowerFloor: nextM }, 'tower-clear-optimistic');
    }, [applyUserUpdate]);
    
    // --- App Settings State ---
    const [settings, setSettings] = useState<AppSettings>(() => {
        try {
            const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (storedSettings) {
                let parsed = JSON.parse(storedSettings);
                // Migration for old settings structure
                if (typeof parsed.theme === 'string') {
                    parsed = {
                        ...defaultSettings,
                        graphics: {
                            theme: parsed.theme,
                            panelColor: undefined,
                            textColor: undefined,
                        },
                        sound: parsed.sound || defaultSettings.sound,
                        features: parsed.features || defaultSettings.features,
                    };
                }
                // Deep merge to ensure new settings from code are not overwritten by old localStorage data
                return {
                    ...defaultSettings,
                    ...parsed,
                    graphics: {
                        ...defaultSettings.graphics,
                        ...(parsed.graphics || {}),
                        theme: 'black',
                        panelEdgeStyle:
                            parsed.graphics?.panelEdgeStyle ?? defaultSettings.graphics.panelEdgeStyle,
                    },
                    sound: {
                        ...defaultSettings.sound,
                        ...(parsed.sound || {}),
                        categoryMuted: {
                            ...defaultSettings.sound.categoryMuted,
                            ...(parsed.sound?.categoryMuted && typeof parsed.sound.categoryMuted === 'object'
                                ? parsed.sound.categoryMuted
                                : {}),
                        },
                    },
                    features: { ...defaultSettings.features, ...(parsed.features || {}) },
                };
            }
        } catch (error) { console.error('Error reading settings from localStorage', error); }
        return defaultSettings;
    });

    const isNarrowViewport = useIsHandheldDevice(1025);
    const isShortViewportHeight = useViewportHeightBelow(VIEWPORT_HEIGHT_LAYOUT_BREAKPOINT);
    const { isPhoneHandheldTouch, isLargeTouchTablet } = useTouchLayoutProfile();
    const isPortrait = useIsPortrait();
    const handheldPortraitLockActive = useHandheldPortraitLockActive();

    /**
     * 터치 폰: 항상 세로형 네이티브 셸(pcLike 무시).
     * 8인치+ 터치 태블릿: 가로(landscape)는 PC(16:9), 세로(portrait)는 네이티브 모바일 셸.
     * 그 외(데스크톱 등): 기존처럼 pcLike·뷰포트로 결정.
     */
    const isNativeMobile = useMemo(() => {
        if (isPhoneHandheldTouch) return true;
        if (isLargeTouchTablet) return isPortrait;
        return (
            settings.graphics.pcLikeMobileLayout !== true &&
            (isNarrowViewport || isShortViewportHeight)
        );
    }, [
        isPhoneHandheldTouch,
        isLargeTouchTablet,
        isPortrait,
        isNarrowViewport,
        isShortViewportHeight,
        settings.graphics.pcLikeMobileLayout,
    ]);

    /**
     * 세로형 풀뷰포트 셸(모달 루트가 화면 픽셀 기준, modalLayerUsesDesignPixels=false).
     * 폰 물리 가로+portrait-lock 시 App이 html에 락을 걸면 isNativeMobile과 순간 불일치해도 PC 모달 레이어로 가지 않게 한다.
     */
    const usePortraitFirstShell = useMemo(
        () =>
            isNativeMobile ||
            handheldPortraitLockActive ||
            (!currentUser && isNarrowViewport && !isLargeTouchTablet),
        [isNativeMobile, handheldPortraitLockActive, currentUser, isNarrowViewport, isLargeTouchTablet],
    );

    /** `#sudamr-modal-root`가 1920×1080 설계 좌표계 안에 있을 때 true (변환 scale 적용) */
    const modalLayerUsesDesignPixels = !usePortraitFirstShell;

    const showPcLikeMobileLayoutSetting = !isPhoneHandheldTouch && !isLargeTouchTablet;

    useEffect(() => {
        if (!isPhoneHandheldTouch) return;
        if (settings.graphics.pcLikeMobileLayout !== true) return;
        setSettings((s) => ({ ...s, graphics: { ...s.graphics, pcLikeMobileLayout: false } }));
    }, [isPhoneHandheldTouch, settings.graphics.pcLikeMobileLayout]);

    // --- Server State ---
    const [usersMap, setUsersMap] = useState<Record<string, User>>({});
    const [onlineUsers, setOnlineUsers] = useState<UserWithStatus[]>([]);
    // 온디맨드: 프로필 보기/목록 표시 시에만 로드한 유저 brief 캐시 (nickname, avatarId, borderId)
    const [userBriefCache, setUserBriefCache] = useState<
        Record<
            string,
            {
                nickname: string;
                avatarId?: string | null;
                borderId?: string | null;
                isAdmin?: boolean;
                staffNicknameDisplayEligibility?: boolean;
            }
        >
    >({});
    const [liveGames, setLiveGames] = useState<Record<string, LiveGameSession>>({});  // 일반 게임만
    const [singlePlayerGames, setSinglePlayerGames] = useState<Record<string, LiveGameSession>>({});  // 싱글플레이 게임
    const [towerGames, setTowerGames] = useState<Record<string, LiveGameSession>>({});  // 도전의 탑 게임
    const [towerRankingsRefetchTrigger, setTowerRankingsRefetchTrigger] = useState(0);   // 도전의 탑 클리어 시 대기실 랭킹 즉시 갱신용
    const liveGameSignaturesRef = useRef<Record<string, string>>({});
    const singlePlayerGameSignaturesRef = useRef<Record<string, string>>({});
    const towerGameSignaturesRef = useRef<Record<string, string>>({});
    // CONFIRM_AI_GAME_START 직후 checkGame 폴링이 최신 게임 상태를 보도록 ref에 동기화
    const liveGamesRef = useRef<Record<string, LiveGameSession>>({});
    const singlePlayerGamesRef = useRef<Record<string, LiveGameSession>>({});
    const towerGamesRef = useRef<Record<string, LiveGameSession>>({});
    // WebSocket GAME_UPDATE 메시지 쓰로틀링 (같은 게임에 대해 최대 100ms당 1회만 처리)
    const lastGameUpdateTimeRef = useRef<Record<string, number>>({});
    const lastGameUpdateMoveCountRef = useRef<Record<string, number>>({}); // AI 수 등 새 수가 있으면 쓰로틀 무시
    const GAME_UPDATE_THROTTLE_MS = 100; // 100ms 쓰로틀링
    // 도전의 탑·전략바둑 AI: 그누고(AI) 수 수신 시 1초 지연 후 표시 (쾌적한 UX·과도한 연타 오류 방지)
    const towerGnugoDelayTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const towerScoringDelayTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({}); // AI 수 표시 후 계가 전환용
    const liveGameGnugoDelayTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const singlePlayerScoringDelayTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({}); // AI 수 표시 후 계가 전환용
    /** PVP 주사위 바둑: 연타 시 낙관 착수는 첫 번째 요청만, inFlight는 요청마다 증가 */
    const pvpDicePlaceInFlightRef = useRef<Record<string, number>>({});
    /** 낙관 착수 실패 시 복구용 스냅샷 (해당 gameId당 1개) */
    const pvpDicePlaceRevertRef = useRef<Record<string, LiveGameSession>>({});
    /** TOWER_ADD_TURNS: fetch 전 낙관 보너스(+3) 적용분 — 실패 시 롤백 */
    const towerAddTurnOptimisticPendingByGameRef = useRef<Record<string, number>>({});
    /** AI 주사위 바둑: 턴 내 착수 배치를 모아 마지막에 1회 전송 */
    const aiDicePlaceBatchRef = useRef<Record<string, Array<{ x: number; y: number }>>>({});
    /** 같은 턴에서 stonesToPlace는 착수마다 줄어들므로, 배치 flush 기준은 턴 시작 시점의 남은 돌 수로 고정한다. */
    const aiDiceTurnPlaceQuotaRef = useRef<Record<string, number>>({});
    const [negotiations, setNegotiations] = useState<Record<string, Negotiation>>({});
    const [waitingRoomChats, setWaitingRoomChats] = useState<Record<string, ChatMessage[]>>({});
    /** 대기실(전체/전략/놀이) 채팅: 재접속·INITIAL_STATE 수신 시점 이후 메시지만 표시 (서버는 채널 전체 배열을 브로드캐스트함) */
    const waitingRoomChatSessionStartRef = useRef<number>(0);
    const [gameChats, setGameChats] = useState<Record<string, ChatMessage[]>>({});
    const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
    const [gameModeAvailability, setGameModeAvailability] = useState<Partial<Record<GameMode, boolean>>>({});
    const [arenaEntranceAvailability, setArenaEntranceAvailability] = useState<Record<ArenaEntranceKey, boolean>>(() =>
        mergeArenaEntranceAvailability({}),
    );
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [globalOverrideAnnouncement, setGlobalOverrideAnnouncement] = useState<OverrideAnnouncement | null>(null);
    const [announcementInterval, setAnnouncementInterval] = useState(3);
    const [homeBoardPosts, setHomeBoardPosts] = useState<HomeBoardPost[]>([]);
    const [guilds, setGuilds] = useState<Record<string, Guild>>({});
    
    // --- UI Modals & Toasts ---
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [isMailboxOpen, setIsMailboxOpen] = useState(false);
    const [isQuestsOpen, setIsQuestsOpen] = useState(false);
    const [isShopOpen, setIsShopOpen] = useState(false);
    const [shopInitialTab, setShopInitialTab] = useState<
        'equipment' | 'materials' | 'consumables' | 'misc' | 'diamonds' | 'vip' | undefined
    >(undefined);
    const [lastUsedItemResult, setLastUsedItemResult] = useState<InventoryItem[] | null>(null);
    const [tournamentScoreChange, setTournamentScoreChange] = useState<{ oldScore: number; newScore: number; scoreReward: number } | null>(null);
    const [disassemblyResult, setDisassemblyResult] = useState<{ gained: { name: string, amount: number }[], jackpot: boolean } | null>(null);
    const [craftResult, setCraftResult] = useState<{ gained: { name: string; amount: number }[]; used: { name: string; amount: number }[]; craftType: 'upgrade' | 'downgrade'; jackpot?: boolean } | null>(null);
    const [rewardSummary, setRewardSummary] = useState<{ reward: QuestReward; items: InventoryItem[]; title: string } | null>(null);
    const [levelUpCelebration, setLevelUpCelebration] = useState<LevelUpCelebrationPayload | null>(null);
    const deferredLevelUpCelebrationRef = useRef<LevelUpCelebrationPayload | null>(null);
    const [mannerGradeChange, setMannerGradeChange] = useState<MannerGradeChangePayload | null>(null);
    const deferredMannerGradeChangeRef = useRef<MannerGradeChangePayload | null>(null);
    const [isClaimAllSummaryOpen, setIsClaimAllSummaryOpen] = useState(false);
    const [claimAllSummary, setClaimAllSummary] = useState<{ gold: number; diamonds: number; actionPoints: number } | null>(null);
    const [viewingUser, setViewingUser] = useState<UserWithStatus | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [isAnnouncementsModalOpen, setIsAnnouncementsModalOpen] = useState(false);
    const [isRankingQuickModalOpen, setIsRankingQuickModalOpen] = useState(false);
    const [isChatQuickModalOpen, setIsChatQuickModalOpen] = useState(false);
    const [isEncyclopediaOpen, setIsEncyclopediaOpen] = useState(false);
    const [isStatAllocationModalOpen, setIsStatAllocationModalOpen] = useState(false);
    const [enhancementResult, setEnhancementResult] = useState<{ message: string; success: boolean } | null>(null);
    const [enhancementOutcome, setEnhancementOutcome] = useState<{ message: string; success: boolean; itemBefore: InventoryItem; itemAfter: InventoryItem; xpGained?: number; isRolling?: boolean; } | null>(null);
    const [refinementResult, setRefinementResult] = useState<{ message: string; success: boolean; itemBefore: InventoryItem; itemAfter: InventoryItem; } | null>(null);
    const [enhancementAnimationTarget, setEnhancementAnimationTarget] = useState<{ itemId: string; stars: number } | null>(null);
    const [pastRankingsInfo, setPastRankingsInfo] = useState<{ user: UserWithStatus; mode: GameMode | 'strategic' | 'playful'; } | null>(null);
    const [enhancingItem, setEnhancingItem] = useState<InventoryItem | null>(null);
    const [viewingItem, setViewingItem] = useState<{ item: InventoryItem; isOwnedByCurrentUser: boolean; } | null>(null);
    const [showExitToast, setShowExitToast] = useState(false);
    const exitToastTimer = useRef<number | null>(null);
    /** 서버 재시작·WS 끊김 안내 (전역 토스트) */
    const [serverReconnectNotice, setServerReconnectNotice] = useState<string | null>(null);
    const serverReconnectTimerRef = useRef<number | null>(null);
    const wsReconnectAttemptRef = useRef(0);
    const [isProfileEditModalOpen, setIsProfileEditModalOpen] = useState(false);
    const [moderatingUser, setModeratingUser] = useState<UserWithStatus | null>(null);
    const [isMbtiInfoModalOpen, setIsMbtiInfoModalOpen] = useState(false);
    const [mutualDisconnectMessage, setMutualDisconnectMessage] = useState<string | null>(null);
    /** 로그인 응답에 포함된 진행 중 경기 (다른 PC에서 로그인 후 즉시 이어하기용, INITIAL_STATE 수신 시 해제) */
    const [activeGameFromLogin, setActiveGameFromLogin] = useState<LiveGameSession | null>(null);
    /** 다른 기기에서 로그인되어 자동 로그아웃 안내 모달 표시 여부 */
    const [showOtherDeviceLoginModal, setShowOtherDeviceLoginModal] = useState(false);
    const [isEquipmentEffectsModalOpen, setIsEquipmentEffectsModalOpen] = useState(false);
    const [isBlacksmithModalOpen, setIsBlacksmithModalOpen] = useState(false);
    const [isGameRecordListOpen, setIsGameRecordListOpen] = useState(false);
    const [viewingGameRecord, setViewingGameRecord] = useState<GameRecord | null>(null);
    const [blacksmithSelectedItemForEnhancement, setBlacksmithSelectedItemForEnhancement] = useState<InventoryItem | null>(null);
    const [blacksmithActiveTab, setBlacksmithActiveTab] = useState<'enhance' | 'combine' | 'disassemble' | 'convert' | 'refine'>('enhance');
    const [combinationResult, setCombinationResult] = useState<{ item: InventoryItem; xpGained: number; isGreatSuccess: boolean; } | null>(null);
    const [isBlacksmithHelpOpen, setIsBlacksmithHelpOpen] = useState(false);
    const [isBlacksmithEffectsModalOpen, setIsBlacksmithEffectsModalOpen] = useState(false);
    const [isEnhancementResultModalOpen, setIsEnhancementResultModalOpen] = useState(false);
    const [isInsufficientActionPointsModalOpen, setIsInsufficientActionPointsModalOpen] = useState(false);
    const [isOpponentInsufficientActionPointsModalOpen, setIsOpponentInsufficientActionPointsModalOpen] = useState(false);
    const [isActionPointModalOpen, setIsActionPointModalOpen] = useState(false);

    useEffect(() => {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        } catch (error) { console.error('Error saving settings to localStorage', error); }
        
        const root = document.documentElement;
        if (settings.graphics.panelColor) {
            root.style.setProperty('--custom-panel-bg', settings.graphics.panelColor);
        } else {
            root.style.removeProperty('--custom-panel-bg');
        }
        if (settings.graphics.textColor) {
            root.style.setProperty('--custom-text-color', settings.graphics.textColor);
        } else {
            root.style.removeProperty('--custom-text-color');
        }
        const edgeStyle = settings.graphics.panelEdgeStyle ?? 'default';
        const edgeImages = getPanelEdgeImages(edgeStyle);
        root.style.setProperty('--panel-edge-top-left', edgeImages.topLeft ?? 'none');
        root.style.setProperty('--panel-edge-top-right', edgeImages.topRight ?? 'none');
        root.style.setProperty('--panel-edge-bottom-left', edgeImages.bottomLeft ?? 'none');
        root.style.setProperty('--panel-edge-bottom-right', edgeImages.bottomRight ?? 'none');
        // 엣지 스타일이 'none'이 아닌 경우 data 속성 추가 (CSS에서 금색 테두리 적용용)
        if (edgeStyle !== 'none') {
            root.setAttribute('data-edge-style', edgeStyle);
        } else {
            root.setAttribute('data-edge-style', 'none');
        }

    }, [settings]);



    useEffect(() => {
        document.documentElement.setAttribute('data-theme', settings.graphics.theme);
    }, [settings.graphics.theme]);

    useEffect(() => {
        audioService.updateSettings(settings.sound);
    }, [settings.sound]);

    const updatePanelColor = useCallback((color: string) => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, panelColor: color }}));
    }, []);

    const updateTextColor = useCallback((color: string) => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, textColor: color }}));
    }, []);
    
    const updatePanelEdgeStyle = useCallback((edgeStyle: PanelEdgeStyle) => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, panelEdgeStyle: edgeStyle }}));
    }, []);

    const updatePcLikeMobileLayout = useCallback((value: boolean) => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, pcLikeMobileLayout: value } }));
    }, []);
    
    const resetGraphicsToDefault = useCallback(() => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, panelColor: undefined, textColor: undefined, panelEdgeStyle: 'default' } }));
    }, []);

    const updateSoundSetting = useCallback(<K extends keyof SoundSettings>(key: K, value: SoundSettings[K]) => {
        setSettings(s => ({ ...s, sound: { ...s.sound, [key]: value } }));
    }, []);

    const updateFeatureSetting = useCallback(<K extends keyof FeatureSettings>(key: K, value: FeatureSettings[K]) => {
        setSettings(s => ({ ...s, features: { ...s.features, [key]: value } }));
    }, []);

    // --- Derived State ---
    const allUsers = useMemo(() => {
        if (!usersMap || typeof usersMap !== 'object') return [];
        return Object.values(usersMap);
    }, [usersMap]);

    // 온디맨드: onlineUsers의 id에 대해 brief가 없으면 /api/users/brief 요청
    const userBriefCacheRef = useRef(userBriefCache);
    userBriefCacheRef.current = userBriefCache;
    useEffect(() => {
        const ids = (onlineUsers || []).map(u => u?.id).filter(Boolean) as string[];
        const cache = userBriefCacheRef.current;
        const toFetch = ids.filter(id => !cache[id]);
        if (toFetch.length === 0) return;
        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch(getApiUrl(`/api/users/brief?ids=${encodeURIComponent(toFetch.join(','))}`), { signal: controller.signal });
                if (!res.ok) return;
                const data = await res.json();
                if (Array.isArray(data)) {
                    setUserBriefCache(prev => {
                        const next = { ...prev };
                        data.forEach(
                            (b: {
                                id: string;
                                nickname: string;
                                avatarId?: string | null;
                                borderId?: string | null;
                                isAdmin?: boolean;
                                staffNicknameDisplayEligibility?: boolean;
                            }) => {
                                if (b?.id)
                                    next[b.id] = {
                                        nickname: b.nickname || b.id,
                                        avatarId: b.avatarId,
                                        borderId: b.borderId,
                                        isAdmin: b.isAdmin,
                                        staffNicknameDisplayEligibility: b.staffNicknameDisplayEligibility,
                                    };
                            },
                        );
                        return next;
                    });
                }
            } catch (e) {
                if ((e as Error)?.name !== 'AbortError') console.warn('[useApp] Fetch users brief failed:', e);
            }
        })();
        return () => controller.abort();
    }, [onlineUsers]); // onlineUsers 변경 시에만 실행

    // 현재 사용자 brief를 캐시에 추가 (목록에서 "나" 표시)
    useEffect(() => {
        if (currentUser?.id && !userBriefCache[currentUser.id]) {
            setUserBriefCache(prev => ({
                ...prev,
                [currentUser.id]: {
                    nickname: currentUser.nickname || currentUser.username || currentUser.id,
                    avatarId: currentUser.avatarId,
                    borderId: currentUser.borderId,
                    isAdmin: currentUser.isAdmin,
                    staffNicknameDisplayEligibility: currentUser.staffNicknameDisplayEligibility,
                },
            }));
        }
    }, [currentUser?.id, currentUser?.nickname, currentUser?.username]);

    // brief 캐시와 병합한 온라인 유저 (목록 표시용)
    const enrichedOnlineUsers = useMemo(() => {
        return (onlineUsers || []).map(u => {
            const brief = u?.id ? userBriefCache[u.id] : null;
            return {
                ...u,
                nickname: brief?.nickname ?? (u as any).nickname ?? '...',
                avatarId: brief?.avatarId ?? (u as any).avatarId,
                borderId: brief?.borderId ?? (u as any).borderId,
                isAdmin: (u as any).isAdmin ?? brief?.isAdmin ?? false,
                staffNicknameDisplayEligibility:
                    (u as any).staffNicknameDisplayEligibility ?? brief?.staffNicknameDisplayEligibility ?? false,
            };
        });
    }, [onlineUsers, userBriefCache]);

    // 행동력 실시간 업데이트를 위한 상태
    const [actionPointUpdateTrigger, setActionPointUpdateTrigger] = useState(0);
    
    // 행동력을 실시간으로 계산하는 useEffect
    useEffect(() => {
        if (!currentUser || !currentUser.actionPoints) return;

        const guildForAp =
            currentUser.guildId != null && currentUser.guildId !== ''
                ? guilds[currentUser.guildId] ?? null
                : null;

        const intervalId = setInterval(() => {
            if (!currentUser.actionPoints || currentUser.lastActionPointUpdate === undefined) return;
            
            const effects = calculateUserEffects(currentUser, guildForAp);
            const now = Date.now();
            const calculatedMaxAP = effects.maxActionPoints;

            // 현재 < 최대인데 last가 0이면(만땅에서 최대만 올라간 직후 등) 회복 타이머를 즉시 시작
            if (currentUser.actionPoints.current < calculatedMaxAP) {
                const lu = currentUser.lastActionPointUpdate;
                if (lu === 0 || lu === undefined || lu === null) {
                    setCurrentUser(prev => {
                        if (!prev?.actionPoints) return prev;
                        const g2 =
                            prev.guildId != null && prev.guildId !== '' ? guilds[prev.guildId] ?? null : null;
                        const e2 = calculateUserEffects(prev, g2);
                        const maxAp = e2.maxActionPoints;
                        if (prev.actionPoints.current >= maxAp) return prev;
                        const pLu = prev.lastActionPointUpdate;
                        if (pLu !== 0 && pLu !== undefined && pLu !== null) return prev;
                        return { ...prev, lastActionPointUpdate: Date.now() };
                    });
                    return;
                }
            }
            
            // 행동력이 최대치가 아니고, lastActionPointUpdate가 유효한 경우에만 계산
            if (currentUser.actionPoints.current < calculatedMaxAP && currentUser.lastActionPointUpdate !== 0) {
                const lastUpdate = currentUser.lastActionPointUpdate;
                if (typeof lastUpdate === 'number' && !isNaN(lastUpdate)) {
                    const elapsedMs = now - lastUpdate;
                    const regenInterval = effects.actionPointRegenInterval > 0 ? effects.actionPointRegenInterval : ACTION_POINT_REGEN_INTERVAL_MS;
                    const pointsToAdd = Math.floor(elapsedMs / regenInterval);
                    
                    if (pointsToAdd > 0) {
                        const newCurrent = Math.min(calculatedMaxAP, currentUser.actionPoints.current + pointsToAdd);
                        // 다음 회복 시점을 반영: lastActionPointUpdate를 회복한 구간만큼 진행 (무한 1씩 회복 방지)
                        const newLastUpdate = newCurrent >= calculatedMaxAP
                            ? 0
                            : lastUpdate + pointsToAdd * regenInterval;
                        setCurrentUser(prev => {
                            if (!prev || !prev.actionPoints) return prev;
                            return {
                                ...prev,
                                actionPoints: {
                                    ...prev.actionPoints,
                                    current: newCurrent,
                                    max: calculatedMaxAP
                                },
                                lastActionPointUpdate: newLastUpdate
                            };
                        });
                        setActionPointUpdateTrigger(prev => prev + 1);
                    }
                }
            }
        }, 1000); // 1초마다 체크
        
        return () => clearInterval(intervalId);
    }, [
        currentUser?.actionPoints?.current,
        currentUser?.lastActionPointUpdate,
        currentUser?.id,
        currentUser?.equipment,
        currentUser?.guildId,
        guilds,
    ]);
    
    const currentUserWithStatus: UserWithStatus | null = useMemo(() => {
        // updateTrigger와 actionPointUpdateTrigger를 dependency에 포함시켜 강제 리렌더링 보장
        if (!currentUser) return null;
        const statusInfo = Array.isArray(onlineUsers)
            ? onlineUsers.find(u => u && u.id === currentUser.id)
            : null;
        let statusData: UserStatusInfo = {
            status: statusInfo?.status ?? ('online' as UserStatus),
            mode: statusInfo?.mode,
            gameId: statusInfo?.gameId,
            spectatingGameId: statusInfo?.spectatingGameId,
        };
        // 로그인 응답으로 받은 진행 중 경기가 있으면 WebSocket INITIAL_STATE 전까지 in-game으로 표시
        if (activeGameFromLogin && (activeGameFromLogin.player1?.id === currentUser.id || activeGameFromLogin.player2?.id === currentUser.id)) {
            statusData = { ...statusData, status: 'in-game' as UserStatus, gameId: activeGameFromLogin.id };
        }
        
        // 행동력 최대치를 실시간으로 계산하여 반영
        const guildForAp =
            currentUser.guildId != null && currentUser.guildId !== ''
                ? guilds[currentUser.guildId] ?? null
                : null;
        const effects = calculateUserEffects(currentUser, guildForAp);
        const calculatedMaxAP = effects.maxActionPoints;
        const updatedActionPoints = currentUser.actionPoints ? {
            ...currentUser.actionPoints,
            max: calculatedMaxAP
        } : currentUser.actionPoints;
        
        return { ...currentUser, actionPoints: updatedActionPoints, ...statusData };
    }, [currentUser, onlineUsers, updateTrigger, actionPointUpdateTrigger, activeGameFromLogin, guilds]);

    const arenaEntranceFromServer = useMemo(
        () => mergeArenaEntranceAvailability(arenaEntranceAvailability),
        [arenaEntranceAvailability],
    );

    const arenaEntranceAvailabilityResolved = useMemo(() => {
        const base = arenaEntranceFromServer;
        const u = currentUserWithStatus;
        if (!u || isClientAdmin(u)) return base;
        const snap = getBadukAbilitySnapshotFromStats(u, calculateTotalStats(u));
        const prog = applyUserProgressionArenaLocks(base, snap);
        return applyOnboardingArenaEntranceTutorialLocks(prog, u);
    }, [
        arenaEntranceFromServer,
        currentUserWithStatus,
        updateTrigger,
    ]);

    useEffect(() => {
        currentUserStatusRef.current = currentUserWithStatus;
    }, [currentUserWithStatus]);

    useEffect(() => {
        liveGamesRef.current = liveGames;
        singlePlayerGamesRef.current = singlePlayerGames;
        towerGamesRef.current = towerGames;
    }, [liveGames, singlePlayerGames, towerGames]);

    /** PvP 대국 결과(종료) 화면 중에는 안내 모달을 늦추고, 퇴장 등으로 liveGames에서 사라진 뒤 표시 */
    useEffect(() => {
        const uid = currentUserRef.current?.id;
        if (!uid) return;
        const block = Object.values(liveGamesRef.current).some((g) => {
            if (!g || g.isSinglePlayer || g.gameCategory === 'tower') return false;
            if (g.gameStatus !== 'ended') return false;
            if (g.player1?.id !== uid && g.player2?.id !== uid) return false;
            return true;
        });
        if (block) return;
        const pendingLevel = deferredLevelUpCelebrationRef.current;
        const pendingManner = deferredMannerGradeChangeRef.current;
        if (pendingLevel) {
            deferredLevelUpCelebrationRef.current = null;
            setLevelUpCelebration(pendingLevel);
        }
        if (pendingManner) {
            deferredMannerGradeChangeRef.current = null;
            setMannerGradeChange(pendingManner);
        }
    }, [liveGames]);

    /** 관리자 홈: 레벨업 축하 모달 미리보기(실제 데이터 반영, 서버/레벨은 변경하지 않음) */
    const previewAdminLevelUpCelebrationModal = useCallback(() => {
        const u = currentUserRef.current;
        if (!u?.isAdmin) return;
        deferredLevelUpCelebrationRef.current = null;
        const s = Math.max(1, u.strategyLevel ?? 1);
        const p = Math.max(1, u.playfulLevel ?? 1);
        setLevelUpCelebration({
            strategy: s > 1 ? { from: s - 1, to: s } : { from: 1, to: 2 },
            playful: p > 1 ? { from: p - 1, to: p } : { from: 1, to: 2 },
        });
    }, []);

    /** 관리자 홈: 매너 등급 상승 모달 미리보기(직전 구간 → 현재 등급) */
    const previewAdminMannerGradeUpModal = useCallback(() => {
        const u = currentUserRef.current;
        if (!u?.isAdmin) return;
        deferredMannerGradeChangeRef.current = null;
        const score = u.mannerScore ?? 200;
        const currentRankName = getMannerRank(score).rank;
        const idx = MANNER_RANKS.findIndex((r) => r.name === currentRankName);
        if (idx <= 0) {
            setMannerGradeChange({
                direction: 'up',
                previousRank: MANNER_RANKS[0].name,
                newRank: MANNER_RANKS[1].name,
                previousScore: 0,
                newScore: MANNER_RANKS[1].min,
            });
            return;
        }
        const prevTier = MANNER_RANKS[idx - 1];
        const curTier = MANNER_RANKS[idx];
        const prevUpper = prevTier.max === Infinity ? curTier.min - 1 : prevTier.max;
        const previousScore = Math.max(prevTier.min, Math.min(prevUpper, score - 1));
        setMannerGradeChange({
            direction: 'up',
            previousRank: prevTier.name,
            newRank: currentRankName,
            previousScore,
            newScore: score,
        });
    }, []);

    const activeGame = useMemo(() => {
        if (!currentUserWithStatus) return null;
        const gameId = currentUserWithStatus.gameId || currentUserWithStatus.spectatingGameId;
        if (gameId) {
            // status가 'in-game'이거나 'spectating'이면 게임으로 라우팅
            // 'negotiating' 상태는 제거 (대국 신청 중에는 게임이 아님)
            // scoring 상태의 게임도 포함 (계가 진행 중)
            if (currentUserWithStatus.status === 'in-game' || currentUserWithStatus.status === 'spectating') {
                // 모든 게임 카테고리에서 찾기
                const game = liveGames[gameId] || singlePlayerGames[gameId] || towerGames[gameId];
                if (game) {
                    return game;
                }
            }
            // scoring 상태의 게임은 사용자 상태와 관계없이 activeGame으로 인식
            // (계가 진행 중에는 사용자 상태가 변경될 수 있음)
            const game = liveGames[gameId] || singlePlayerGames[gameId] || towerGames[gameId];
            if (game && game.gameStatus === 'scoring') {
                return game;
            }
        }
        // 새로고침(F5) 후 재입장: URL이 #/game/:id 이고 해당 게임이 스토어에 있으면(재입장 API로 로드) 참가자일 때 activeGame으로 사용
        const urlGameId = currentRoute?.view === 'game' ? (currentRoute.params?.id ?? '') : '';
        if (urlGameId && currentUser) {
            const gameFromUrl = liveGames[urlGameId] || singlePlayerGames[urlGameId] || towerGames[urlGameId];
            if (gameFromUrl && (gameFromUrl.player1?.id === currentUser.id || gameFromUrl.player2?.id === currentUser.id)) {
                return gameFromUrl;
            }
        }
        return null;
    }, [currentUserWithStatus, liveGames, singlePlayerGames, towerGames, currentUser, currentRoute]);

    const activeNegotiation = useMemo(() => {
        if (!currentUserWithStatus) return null;
        if (!negotiations || typeof negotiations !== 'object' || Array.isArray(negotiations)) {
            return null;
        }
        try {
            const negotiationsArray = Object.values(negotiations);
            // 현재 사용자와 관련된 모든 negotiation 필터링
            const relevantNegotiations = negotiationsArray.filter(neg => 
                neg && neg.challenger && neg.opponent &&
                ((neg.challenger.id === currentUserWithStatus.id && (neg.status === 'pending' || neg.status === 'draft')) ||
                (neg.opponent.id === currentUserWithStatus.id && neg.status === 'pending'))
            );
            
            if (relevantNegotiations.length === 0) return null;
            
            // 가장 먼저 온 신청서 선택 (deadline이 가장 이른 것, 또는 deadline이 같으면 생성 시간 기준)
            // deadline이 없으면 생성 시간(id에 포함된 timestamp 또는 생성 순서) 기준
            const sorted = relevantNegotiations.sort((a, b) => {
                // deadline이 있으면 deadline 기준으로 정렬 (더 이른 deadline이 우선)
                if (a.deadline && b.deadline) {
                    return a.deadline - b.deadline;
                }
                if (a.deadline) return -1; // a에만 deadline이 있으면 a가 우선
                if (b.deadline) return 1; // b에만 deadline이 있으면 b가 우선
                // deadline이 둘 다 없으면 id의 타임스탬프 비교 (나중에 생성된 것이 더 큰 id를 가짐)
                return a.id.localeCompare(b.id);
            });
            
            return sorted[0] || null;
        } catch (error) {
            console.error('[activeNegotiation] Error:', error);
            return null;
        }
    }, [currentUserWithStatus, negotiations]);

    const unreadMailCount = useMemo(() => {
        if (!currentUser || !currentUser.mail || !Array.isArray(currentUser.mail)) {
            return 0;
        }
        return currentUser.mail.filter(m => m && !m.isRead).length;
    }, [currentUser?.mail]);

    const hasClaimableQuest = useMemo(() => {
        if (!currentUser?.quests) return false;
        const { daily, weekly, monthly } = currentUser.quests;
    
        const checkQuestList = (questData?: DailyQuestData | WeeklyQuestData | MonthlyQuestData) => {
            if (!questData) return false;
            return questData.quests.some(q => q.progress >= q.target && !q.isClaimed);
        };
    
        const checkMilestones = (questData?: DailyQuestData | WeeklyQuestData | MonthlyQuestData, thresholds?: number[]) => {
            if (!questData || !thresholds) return false;
            return questData.claimedMilestones.some((claimed, index) => {
                return !claimed && questData.activityProgress >= thresholds[index];
            });
        };
    
        return checkQuestList(daily) ||
               checkQuestList(weekly) ||
               checkQuestList(monthly) ||
               checkMilestones(daily, DAILY_MILESTONE_THRESHOLDS) ||
               checkMilestones(weekly, WEEKLY_MILESTONE_THRESHOLDS) ||
               checkMilestones(monthly, MONTHLY_MILESTONE_THRESHOLDS);
    }, [currentUser?.quests]);
    
    const showError = (message: string) => {
        let displayMessage = message;
        if (message.includes('Invalid move: ko')) {
            displayMessage = "패 모양(단순 코)입니다. 다른 곳에 착수 후 다시 둘 수 있는 자리입니다.";
        } else if (message.includes('action point')) {
            displayMessage = "상대방의 행동력이 충분하지 않습니다.";
        }
        setError(displayMessage);
        setTimeout(() => setError(null), 5000);
    };
    
    useEffect(() => {
        if (currentUser) {
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        } else {
            sessionStorage.removeItem('currentUser');
        }
    }, [currentUser]);

    // --- Action Handler ---
    // 액션 디바운싱을 위한 ref
    const actionDebounceRef = useRef<Map<string, number>>(new Map());
    const ACTION_DEBOUNCE_MS = 300; // 300ms 디바운스
    
    const handleAction = useCallback(async (action: ServerAction): Promise<{ gameId?: string; claimAllTrainingQuestRewards?: any; clientResponse?: any } | void> => {
        // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
        if (process.env.NODE_ENV === 'development') {
            console.log(`[handleAction] Action received: ${action.type}`, action);
        }
        
        // 디바운싱: 같은 액션이 짧은 시간 내에 여러 번 호출되면 무시
        // - 챔피언싱 시뮬 완료: 5회차 종료 직후 보상 UI·DB 동기화에 필수
        // - GET_GUILD_WAR_DATA / GET_GUILD_INFO: 길드홈 WarPanel + 길드전 화면이 동시에 부르면 둘째가 `undefined`만 반환되어
        //   클라가 «전쟁 없음»으로 오인·#/guild 로 튕기는 버그가 남 (서버는 실제로는 정상 응답)
        if (
            action.type !== 'COMPLETE_TOURNAMENT_SIMULATION' &&
            action.type !== 'GET_GUILD_WAR_DATA' &&
            action.type !== 'GET_MY_GUILD_WAR_ATTEMPT_LOG' &&
            action.type !== 'GET_GUILD_INFO'
        ) {
            const debouncePayload = 'payload' in action ? (action as { payload?: unknown }).payload : undefined;
            const actionKey = `${action.type}_${JSON.stringify(debouncePayload ?? {})}`;
            const now = Date.now();
            const lastCallTime = actionDebounceRef.current.get(actionKey);
            if (lastCallTime && (now - lastCallTime) < ACTION_DEBOUNCE_MS) {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[handleAction] Action debounced: ${action.type} (${now - lastCallTime}ms since last call)`);
                }
                return;
            }
            actionDebounceRef.current.set(actionKey, now);
        }

        // 베이스 바둑: base_placement에서 PLACE_BASE_STONE은 즉시 화면에 반영되어야 함.
        // 서버 응답/WS 왕복 전까지는 `baseStones_p1/p2`가 갱신되지 않아서 돌이 늦게 보이던 문제가 있음.
        if ((action as any).type === 'PLACE_BASE_STONE') {
            const payload = (action as any).payload as { gameId?: string; x?: number; y?: number } | undefined;
            const { gameId, x, y } = payload || {};
            const uid = currentUserRef.current?.id;
            if (gameId && uid != null && typeof x === 'number' && typeof y === 'number') {
                setLiveGames((currentGames) => {
                    const game = currentGames[gameId];
                    if (!game || game.gameStatus !== 'base_placement') return currentGames;

                    const baseStonesTarget = game.settings?.baseStones ?? 4;
                    const myKey = uid === game.player1.id ? 'baseStones_p1' : 'baseStones_p2';

                    const myArr = (game as any)[myKey] as Point[] | undefined;
                    const nextArr = Array.isArray(myArr) ? [...myArr] : [];

                    // 서버 검증과 동일하게 중복/초과는 즉시 반영하지 않음
                    if (nextArr.some((p) => p.x === x && p.y === y)) return currentGames;
                    if (nextArr.length >= baseStonesTarget) return currentGames;

                    nextArr.push({ x, y });
                    const prevReady = ((game as any).basePlacementReady ?? {}) as Record<string, boolean>;
                    return {
                        ...currentGames,
                        [gameId]: {
                            ...game,
                            [myKey]: nextArr,
                            basePlacementReady: { ...prevReady, [uid]: false },
                        } as any
                    };
                });
            }
        }

        if ((action as any).type === 'CONFIRM_BASE_PLACEMENT_COMPLETE') {
            const payload = (action as any).payload as { gameId?: string } | undefined;
            const gameId = payload?.gameId;
            const uid = currentUserRef.current?.id;
            if (gameId && uid != null) {
                setLiveGames((currentGames) => {
                    const game = currentGames[gameId];
                    if (!game || game.gameStatus !== 'base_placement') return currentGames;
                    const prevReady = ((game as any).basePlacementReady ?? {}) as Record<string, boolean>;
                    return {
                        ...currentGames,
                        [gameId]: { ...game, basePlacementReady: { ...prevReady, [uid]: true } } as any,
                    };
                });
            }
        }

        if ((action as any).type === 'RESET_MY_BASE_STONE_PLACEMENTS') {
            const payload = (action as any).payload as { gameId?: string } | undefined;
            const gameId = payload?.gameId;
            const uid = currentUserRef.current?.id;
            if (gameId && uid != null) {
                setLiveGames((currentGames) => {
                    const game = currentGames[gameId];
                    if (!game || game.gameStatus !== 'base_placement') return currentGames;
                    const myKey = uid === game.player1.id ? 'baseStones_p1' : 'baseStones_p2';
                    const prevReady = ((game as any).basePlacementReady ?? {}) as Record<string, boolean>;
                    return {
                        ...currentGames,
                        [gameId]: {
                            ...game,
                            [myKey]: [],
                            basePlacementReady: { ...prevReady, [uid]: false },
                        } as any,
                    };
                });
            }
        }

        if ((action as any).type === 'UNDO_LAST_BASE_STONE_PLACEMENT') {
            const payload = (action as any).payload as { gameId?: string } | undefined;
            const gameId = payload?.gameId;
            const uid = currentUserRef.current?.id;
            if (gameId && uid != null) {
                setLiveGames((currentGames) => {
                    const game = currentGames[gameId];
                    if (!game || game.gameStatus !== 'base_placement') return currentGames;
                    const myKey = uid === game.player1.id ? 'baseStones_p1' : 'baseStones_p2';
                    const myArr = ((game as any)[myKey] as Point[] | undefined) ?? [];
                    if (myArr.length === 0) return currentGames;
                    const prevReady = ((game as any).basePlacementReady ?? {}) as Record<string, boolean>;
                    return {
                        ...currentGames,
                        [gameId]: {
                            ...game,
                            [myKey]: myArr.slice(0, -1),
                            basePlacementReady: { ...prevReady, [uid]: false },
                        } as any,
                    };
                });
            }
        }

        if ((action as any).type === 'PLACE_REMAINING_BASE_STONES_RANDOMLY') {
            const payload = (action as any).payload as { gameId?: string } | undefined;
            const gameId = payload?.gameId;
            const uid = currentUserRef.current?.id;
            if (gameId && uid != null) {
                setLiveGames((currentGames) => {
                    const game = currentGames[gameId];
                    if (!game || game.gameStatus !== 'base_placement') return currentGames;
                    const prevReady = ((game as any).basePlacementReady ?? {}) as Record<string, boolean>;
                    return {
                        ...currentGames,
                        [gameId]: { ...game, basePlacementReady: { ...prevReady, [uid]: false } } as any,
                    };
                });
            }
        }
        
        // 싱글플레이 미사일 애니메이션 완료 클라이언트 처리 (도전의 탑은 towerGames, 그 외 싱글은 singlePlayerGames)
        if ((action as any).type === 'SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE') {
            const payload = (action as any).payload;
            const { gameId } = payload;
            // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
            if (process.env.NODE_ENV === 'development') {
                console.log(`[handleAction] SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE - processing client-side:`, { gameId });
            }
            // NOTE:
            // handleAction의 useCallback 의존성이 최소화되어 있어(singlePlayerGames/towerGames 미포함)
            // 여기서 외부 클로저의 게임 맵을 참조하면 stale 상태로 게임을 못 찾을 수 있다.
            // 각 스토어의 최신 currentGames를 기준으로 직접 갱신하여 멈춤 상태를 방지한다.
            const applyMissileAnimationCompletion = (currentGames: Record<string, LiveGameSession>) => {
                const gameInStore = currentGames[gameId];
                if (!gameInStore) return currentGames;
                const g = gameInStore;
                // 게임이 이미 종료되었는지 확인
                if (g.gameStatus === 'ended' || g.gameStatus === 'no_contest' || g.gameStatus === 'scoring') {
                    // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`[handleAction] SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE - Game already ended, ignoring:`, {
                            gameId,
                            gameStatus: g.gameStatus
                        });
                    }
                    return currentGames;
                }
                
                // 애니메이션이 없거나 이미 완료된 경우
                if (!g.animation || (g.animation.type !== 'missile' && g.animation.type !== 'hidden_missile')) {
                    // 게임 상태가 여전히 missile_animating이면 정리
                    if (g.gameStatus === 'missile_animating') {
                        // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
                        if (process.env.NODE_ENV === 'development') {
                            console.log(`[handleAction] SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE - Cleaning up stuck missile_animating state:`, gameId);
                        }
                        return {
                            ...currentGames,
                            [gameId]: {
                                ...g,
                                gameStatus: 'playing',
                                animation: null,
                                pausedTurnTimeLeft: undefined,
                                itemUseDeadline: undefined
                            }
                        };
                    }
                    return currentGames;
                }
                
                // 애니메이션 정보 저장
                const animationFrom = g.animation.from;
                const animationTo = g.animation.to;
                const animPlayer = (g.animation as { player?: Player }).player;
                const playerWhoMoved =
                    animPlayer === Player.Black || animPlayer === Player.White ? animPlayer : g.currentPlayer;
                const revealedHiddenStone = (g.animation as any).revealedHiddenStone as Point | null | undefined;
                
                // totalTurns와 captures 보존 (애니메이션 완료 시 초기화 방지)
                const preservedTotalTurns = g.totalTurns;
                const preservedCaptures = { ...g.captures };
                const preservedBaseStoneCaptures = g.baseStoneCaptures ? { ...g.baseStoneCaptures } : undefined;
                const preservedHiddenStoneCaptures = g.hiddenStoneCaptures ? { ...g.hiddenStoneCaptures } : undefined;
                
                // 게임 상태 업데이트
                // 타이머 복원: pausedTurnTimeLeft가 있으면 복원
                let updatedBlackTime = g.blackTimeLeft;
                let updatedWhiteTime = g.whiteTimeLeft;
                
                if (g.pausedTurnTimeLeft !== undefined) {
                    if (playerWhoMoved === Player.Black) {
                        updatedBlackTime = g.pausedTurnTimeLeft;
                    } else {
                        updatedWhiteTime = g.pausedTurnTimeLeft;
                    }
                }
                
                const updatedGame: LiveGameSession = {
                    ...g,
                    animation: null,
                    gameStatus: 'playing',
                    blackTimeLeft: updatedBlackTime,
                    whiteTimeLeft: updatedWhiteTime,
                    pausedTurnTimeLeft: undefined,
                    itemUseDeadline: undefined,
                    // 타이머 재개를 위해 turnDeadline과 turnStartTime도 설정 (제한시간 없음+초읽기 모드 포함)
                    turnDeadline: (() => {
                        const hasTC = (g.settings.timeLimit ?? 0) > 0 || ((g.settings.byoyomiCount ?? 0) > 0 && (g.settings.byoyomiTime ?? 0) > 0);
                        return hasTC && (updatedBlackTime > 0 || updatedWhiteTime > 0)
                            ? Date.now() + (playerWhoMoved === Player.Black ? updatedBlackTime : updatedWhiteTime) * 1000
                            : undefined;
                    })(),
                    turnStartTime: (() => {
                        const hasTC = (g.settings.timeLimit ?? 0) > 0 || ((g.settings.byoyomiCount ?? 0) > 0 && (g.settings.byoyomiTime ?? 0) > 0);
                        return hasTC ? Date.now() : undefined;
                    })(),
                    // totalTurns와 captures 보존
                    totalTurns: preservedTotalTurns,
                    captures: preservedCaptures,
                    ...(preservedBaseStoneCaptures ? { baseStoneCaptures: preservedBaseStoneCaptures } : {}),
                    ...(preservedHiddenStoneCaptures ? { hiddenStoneCaptures: preservedHiddenStoneCaptures } : {})
                };
                
                // 히든 돌 공개 처리
                if (revealedHiddenStone) {
                    const moveIndex = g.moveHistory.findIndex(m => m.x === revealedHiddenStone.x && m.y === revealedHiddenStone.y);
                    if (moveIndex !== -1) {
                        if (!updatedGame.permanentlyRevealedStones) updatedGame.permanentlyRevealedStones = [];
                        if (!updatedGame.permanentlyRevealedStones.some(p => p.x === revealedHiddenStone.x && p.y === revealedHiddenStone.y)) {
                            updatedGame.permanentlyRevealedStones.push({ x: revealedHiddenStone.x, y: revealedHiddenStone.y });
                        }
                    }
                }
                
                // 싱글플레이에서는 LAUNCH_MISSILE에서 이미 보드 상태가 업데이트되었으므로
                // 애니메이션 완료 시에는 보드 상태를 변경하지 않고 그대로 유지
                // (서버에서 이미 원래 자리 제거, 목적지 배치가 완료됨)
                // 단, 보드 상태가 제대로 동기화되지 않은 경우를 대비해 확인만 수행
                // 새로고침 직후 등 boardState가 아직 없을 수 있음 → 옵셔널 체이닝 및 배열 검사
                const boardState = g.boardState;
                if (animationFrom && animationTo && Array.isArray(boardState)) {
                    const stoneAtTo = boardState[animationTo.y]?.[animationTo.x];
                    const stoneAtFrom = boardState[animationFrom.y]?.[animationFrom.x];
                    
                    // 목적지에 돌이 없으면 배치 (서버 동기화 문제 대비)
                    if (stoneAtTo !== playerWhoMoved) {
                        console.warn(`[handleAction] SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE - Stone not at destination, fixing:`, {
                            gameId,
                            from: animationFrom,
                            to: animationTo,
                            stoneAtTo,
                            playerWhoMoved
                        });
                        const newBoardState = boardState.map((row, y) => 
                            row.map((cell, x) => {
                                if (x === animationTo.x && y === animationTo.y) {
                                    return playerWhoMoved;
                                }
                                if (x === animationFrom.x && y === animationFrom.y && cell === playerWhoMoved) {
                                    return Player.None;
                                }
                                return cell;
                            })
                        );
                        updatedGame.boardState = newBoardState;
                    } else if (stoneAtFrom === playerWhoMoved) {
                        // 원래 자리에 아직 돌이 있으면 제거 (서버 동기화 문제 대비)
                        console.warn(`[handleAction] SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE - Stone still at origin, removing:`, {
                            gameId,
                            from: animationFrom,
                            to: animationTo
                        });
                        const newBoardState = boardState.map((row, y) => 
                            row.map((cell, x) => 
                                (x === animationFrom.x && y === animationFrom.y && cell === playerWhoMoved) ? Player.None : cell
                            )
                        );
                        updatedGame.boardState = newBoardState;
                    }
                    
                    // 배치돌 업데이트: 원래 자리의 배치돌을 목적지로 이동 (이미 서버에서 처리되었을 수 있음)
                    if (g.baseStones) {
                        const baseStoneIndex = g.baseStones.findIndex(bs => bs.x === animationFrom.x && bs.y === animationFrom.y);
                        if (baseStoneIndex !== -1) {
                            updatedGame.baseStones = [...g.baseStones];
                            const originalBaseStone = g.baseStones[baseStoneIndex];
                            updatedGame.baseStones[baseStoneIndex] = { x: animationTo.x, y: animationTo.y, player: originalBaseStone.player };
                        }
                    }
                    
                    // 싱글플레이에서 baseStones_p1, baseStones_p2도 확인
                    const playerId = playerWhoMoved === Player.Black ? g.blackPlayerId! : g.whitePlayerId!;
                    const baseStonesKey = playerId === g.player1.id ? 'baseStones_p1' : 'baseStones_p2';
                    const baseStonesArray = (g as any)[baseStonesKey] as Point[] | undefined;
                    if (baseStonesArray) {
                        const baseStoneIndex = baseStonesArray.findIndex(bs => bs.x === animationFrom.x && bs.y === animationFrom.y);
                        if (baseStoneIndex !== -1) {
                            (updatedGame as any)[baseStonesKey] = [...baseStonesArray];
                            (updatedGame as any)[baseStonesKey][baseStoneIndex] = { x: animationTo.x, y: animationTo.y };
                        }
                    }
                    
                    // moveHistory 업데이트: 원래 자리의 이동 기록을 목적지로 변경 (이미 서버에서 처리되었을 수 있음)
                    const fromMoveIndex = g.moveHistory.findIndex(m => m.x === animationFrom.x && m.y === animationFrom.y && m.player === playerWhoMoved);
                    if (fromMoveIndex !== -1) {
                        updatedGame.moveHistory = [...g.moveHistory];
                        updatedGame.moveHistory[fromMoveIndex] = { ...updatedGame.moveHistory[fromMoveIndex], x: animationTo.x, y: animationTo.y };
                    }
                    
                    // 문양 돌 이동: 원래 자리가 문양 돌이면 목적지에서도 문양 돌로 유지 (서버 동기화 대비)
                    if (g.blackPatternStones?.some(p => p.x === animationFrom.x && p.y === animationFrom.y)) {
                        updatedGame.blackPatternStones = (updatedGame.blackPatternStones ?? g.blackPatternStones ?? []).map(p =>
                            p.x === animationFrom.x && p.y === animationFrom.y ? { x: animationTo.x, y: animationTo.y } : p
                        );
                    }
                    if (g.whitePatternStones?.some(p => p.x === animationFrom.x && p.y === animationFrom.y)) {
                        updatedGame.whitePatternStones = (updatedGame.whitePatternStones ?? g.whitePatternStones ?? []).map(p =>
                            p.x === animationFrom.x && p.y === animationFrom.y ? { x: animationTo.x, y: animationTo.y } : p
                        );
                    }
                    // 공개된 히든 돌: 원래 자리가 공개 목록에 있으면 목적지에서도 공개 상태 유지
                    if (g.permanentlyRevealedStones?.some(p => p.x === animationFrom.x && p.y === animationFrom.y)) {
                        updatedGame.permanentlyRevealedStones = (updatedGame.permanentlyRevealedStones ?? g.permanentlyRevealedStones ?? []).map(p =>
                            p.x === animationFrom.x && p.y === animationFrom.y ? { x: animationTo.x, y: animationTo.y } : p
                        );
                    }

                    // 미사일 착지 따내기: 서버와 동일하게 문양돌 소모·consumedPatternIntersections 반영 (미사일로 따낸 뒤 같은 자리에 두면 일반돌로 보이게)
                    const workingBoard = updatedGame.boardState ?? boardState;
                    if (Array.isArray(workingBoard) && workingBoard.length > 0) {
                        const opponentEnum =
                            playerWhoMoved === Player.Black ? Player.White : Player.Black;
                        const boardForCapture = workingBoard.map((row: Player[]) => [...row]);
                        if (boardForCapture[animationTo.y]?.[animationTo.x] === playerWhoMoved) {
                            boardForCapture[animationTo.y][animationTo.x] = Player.None;
                            const moveHistLen = (updatedGame.moveHistory ?? g.moveHistory)?.length ?? 0;
                            const ko = updatedGame.koInfo ?? g.koInfo ?? null;
                            const captureResult = processMoveClient(
                                boardForCapture,
                                { x: animationTo.x, y: animationTo.y, player: playerWhoMoved },
                                ko,
                                moveHistLen,
                                g.isSinglePlayer
                                    ? { isSinglePlayer: true, opponentPlayer: opponentEnum }
                                    : { opponentPlayer: opponentEnum }
                            );
                            applyMissileCaptureProcessResult(
                                updatedGame,
                                playerWhoMoved,
                                opponentEnum,
                                captureResult
                            );
                        }
                    }
                }
                
                // sessionStorage에 저장 (restoredBoardState가 최신 상태를 읽을 수 있도록)
                // 새로고침 직후 등 boardState가 없으면 저장하지 않음 — 기존 저장된 보드를 덮어쓰지 않아 흰돌/돌 사라짐 방지
                const boardToSave = updatedGame.boardState ?? g.boardState;
                if (Array.isArray(boardToSave) && boardToSave.length > 0) {
                    try {
                        const GAME_STATE_STORAGE_KEY = `gameState_${gameId}`;
                        const gameStateToSave = {
                            gameId,
                            boardState: boardToSave,
                            moveHistory: updatedGame.moveHistory ?? g.moveHistory ?? [],
                            captures: updatedGame.captures || { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
                            baseStoneCaptures: updatedGame.baseStoneCaptures,
                            hiddenStoneCaptures: updatedGame.hiddenStoneCaptures,
                            permanentlyRevealedStones: updatedGame.permanentlyRevealedStones || [],
                            blackPatternStones: updatedGame.blackPatternStones,
                            whitePatternStones: updatedGame.whitePatternStones,
                            consumedPatternIntersections: (updatedGame as any).consumedPatternIntersections,
                            hiddenMoves: updatedGame.hiddenMoves || {},
                            hidden_stones_p1: (updatedGame as any).hidden_stones_p1,
                            hidden_stones_p2: (updatedGame as any).hidden_stones_p2,
                            totalTurns: updatedGame.totalTurns,
                            timestamp: Date.now()
                        };
                        sessionStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(gameStateToSave));
                        if (process.env.NODE_ENV === 'development') {
                            console.log(`[handleAction] SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE - Saved game state to sessionStorage for game ${gameId}`);
                        }
                    } catch (e) {
                        console.error(`[handleAction] SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE - Failed to save game state to sessionStorage:`, e);
                    }
                }
                
                console.log(`[handleAction] SINGLE_PLAYER_CLIENT_MISSILE_ANIMATION_COMPLETE - Updated game state:`, {
                    gameId,
                    gameStatus: updatedGame.gameStatus,
                    animation: updatedGame.animation,
                    moveHistoryLength: updatedGame.moveHistory?.length,
                    totalTurns: updatedGame.totalTurns,
                    captures: updatedGame.captures
                });
                
                // 새로고침 직후 등 moveHistory/boardState/턴 정보가 없을 수 있음 — 반환 객체는 기존 game 값 보존
                const safeGame: LiveGameSession = {
                    ...updatedGame,
                    moveHistory: updatedGame.moveHistory ?? g.moveHistory ?? [],
                    boardState: updatedGame.boardState ?? g.boardState,
                    currentPlayer: updatedGame.currentPlayer ?? g.currentPlayer,
                    totalTurns: updatedGame.totalTurns ?? g.totalTurns,
                    captures: updatedGame.captures ?? g.captures,
                    lastMove: updatedGame.lastMove ?? g.lastMove,
                    blackTimeLeft: updatedGame.blackTimeLeft ?? g.blackTimeLeft,
                    whiteTimeLeft: updatedGame.whiteTimeLeft ?? g.whiteTimeLeft,
                    turnDeadline: updatedGame.turnDeadline ?? g.turnDeadline,
                    turnStartTime: updatedGame.turnStartTime ?? g.turnStartTime,
                };
                return {
                    ...currentGames,
                    [gameId]: safeGame
                };
            };
            setSinglePlayerGames(applyMissileAnimationCompletion);
            setTowerGames(applyMissileAnimationCompletion);
            
            return;
        }
        
        // 전략바둑 AI 게임: 유저 수를 클라이언트에 먼저 표시(낙관적 반영) 후 서버 전송은 아래 PLACE_STONE으로 처리
        if ((action as any).type === 'AI_GAME_CLIENT_MOVE') {
            const payload = (action as any).payload;
            const { gameId, x, y, newBoardState, capturedStones, newKoInfo, movePlayer: payloadMovePlayer } = payload;
            setLiveGames((currentGames) => {
                const game = currentGames[gameId];
                if (!game || game.gameStatus === 'ended' || game.gameStatus === 'no_contest' || game.gameStatus === 'scoring') return currentGames;

                const movePlayer: Player = (payloadMovePlayer ?? game.currentPlayer) as Player;
                const newCaptures = {
                    ...game.captures,
                    [movePlayer]: (game.captures[movePlayer] || 0) + (capturedStones?.length || 0),
                };

                const updatedGame: LiveGameSession = {
                    ...game,
                    boardState: newBoardState,
                    koInfo: newKoInfo ?? game.koInfo,
                    lastMove: { x, y },
                    moveHistory: [...(game.moveHistory || []), { x, y, player: movePlayer }],
                    captures: newCaptures,
                    currentPlayer: movePlayer === Player.Black ? Player.White : Player.Black,
                    hiddenMoves: game.hiddenMoves,
                    gameStatus: 'playing',
                    itemUseDeadline: undefined,
                    pausedTurnTimeLeft: undefined,
                };
                return { ...currentGames, [gameId]: updatedGame };
            });
            return;
        }

        if ((action as any).type === 'LOCAL_HIDDEN_REVEAL_TRIGGER') {
            const { gameId, gameType, point, player, keepTurn } = (action as any).payload as {
                gameId: string;
                gameType: 'tower' | 'singleplayer' | 'guildwar';
                point: Point;
                player: Player;
                keepTurn?: boolean;
            };
            const updateGameState =
                gameType === 'guildwar'
                    ? setLiveGames
                    : gameType === 'tower'
                      ? setTowerGames
                      : setSinglePlayerGames;
            const now = Date.now();

            updateGameState(currentGames => {
                const game = currentGames[gameId];
                if (!game || game.gameStatus === 'hidden_reveal_animating') {
                    return currentGames;
                }

                const permanentlyRevealedStones = (game.permanentlyRevealedStones || []).some((p: Point) => p.x === point.x && p.y === point.y)
                    ? [...(game.permanentlyRevealedStones || [])]
                    : [...(game.permanentlyRevealedStones || []), point];

                return {
                    ...currentGames,
                    [gameId]: {
                        ...game,
                        gameStatus: 'hidden_reveal_animating',
                        animation: {
                            type: 'hidden_reveal',
                            stones: [{ point, player }],
                            startTime: now,
                            duration: 2000
                        },
                        revealAnimationEndTime: now + 2000,
                        permanentlyRevealedStones,
                        pendingCapture: null,
                        turnDeadline: undefined,
                        turnStartTime: undefined,
                        pausedTurnTimeLeft: game.turnDeadline ? Math.max(0, (game.turnDeadline - now) / 1000) : game.pausedTurnTimeLeft,
                        itemUseDeadline: undefined,
                        justCaptured: [],
                        newlyRevealed: [],
                        ...(keepTurn ? { isAiTurnCancelledAfterReveal: true } as any : {})
                    } as any
                };
            });
            return;
        }

        if ((action as any).type === 'LOCAL_HIDDEN_FINAL_REVEAL_COMPLETE') {
            const { gameId, gameType } = (action as any).payload as {
                gameId: string;
                gameType: 'tower' | 'singleplayer' | 'guildwar';
            };
            const updateGameState =
                gameType === 'guildwar'
                    ? setLiveGames
                    : gameType === 'tower'
                      ? setTowerGames
                      : setSinglePlayerGames;
            updateGameState(prev => {
                const g = prev[gameId];
                if (!g || g.gameStatus !== 'hidden_final_reveal') return prev;
                return { ...prev, [gameId]: { ...g, gameStatus: 'scoring' as const, animation: null, revealAnimationEndTime: undefined } };
            });
            return;
        }

        /** 스캔 연출 종료 후 본경기(playing) 복귀 — 서버 루프·WS 지연 시 scanning_animating에 고정되는 현상 방지 (PVE + 온라인 히든) */
        if ((action as any).type === 'LOCAL_PVE_SCAN_ANIMATION_COMPLETE') {
            const { gameId, gameType } = (action as any).payload as {
                gameId: string;
                gameType: 'tower' | 'singleplayer' | 'guildwar' | 'normal';
            };
            const updateGameState =
                gameType === 'tower'
                    ? setTowerGames
                    : gameType === 'singleplayer'
                      ? setSinglePlayerGames
                      : setLiveGames;
            const now = Date.now();
            updateGameState(prev => {
                const g = prev[gameId];
                if (!g || g.gameStatus !== 'scanning_animating') return prev;
                const anim = g.animation as { type?: string; playerId?: string; startTime?: number; duration?: number } | null | undefined;
                if (anim?.type === 'scan' && typeof anim.startTime === 'number' && typeof anim.duration === 'number') {
                    if (now < anim.startTime + anim.duration) return prev;
                }
                let currentPlayer = g.currentPlayer;
                if (anim?.type === 'scan' && anim.playerId) {
                    const uid = anim.playerId;
                    if (uid === g.blackPlayerId) currentPlayer = Player.Black;
                    else if (uid === g.whitePlayerId) currentPlayer = Player.White;
                }
                return {
                    ...prev,
                    [gameId]: {
                        ...g,
                        gameStatus: 'playing' as const,
                        animation: null,
                        currentPlayer,
                    },
                };
            });
            return;
        }

        if ((action as any).type === 'LOCAL_HIDDEN_REVEAL_COMPLETE') {
            const { gameId, gameType } = (action as any).payload as {
                gameId: string;
                gameType: 'tower' | 'singleplayer' | 'guildwar';
            };
            const updateGameState =
                gameType === 'guildwar'
                    ? setLiveGames
                    : gameType === 'tower'
                      ? setTowerGames
                      : setSinglePlayerGames;
            const now = Date.now();
            const postRevealAutoScoringRef: {
                current: {
                    boardState: any[][];
                    moveHistory: any[];
                    totalTurns: number;
                    blackTimeLeft: number | undefined;
                    whiteTimeLeft: number | undefined;
                    captures: any;
                    isHiddenMode: boolean;
                } | null;
            } = { current: null };

            const queueAutoScoringAfterReveal = (nextGame: LiveGameSession) => {
                const autoScoringTurns = gameType === 'singleplayer' && nextGame.stageId
                    ? SINGLE_PLAYER_STAGES.find((s: any) => s.id === nextGame.stageId)?.autoScoringTurns
                    : (nextGame.settings as any)?.autoScoringTurns;
                if (!autoScoringTurns || nextGame.gameStatus !== 'playing') return;
                const validMoves = (nextGame.moveHistory || []).filter((m: any) => m.x !== -1 && m.y !== -1);
                const totalTurns = nextGame.totalTurns ?? validMoves.length;
                if (totalTurns < autoScoringTurns) return;
                const isHiddenMode = nextGame.mode === GameMode.Hidden ||
                    (nextGame.mode === GameMode.Mix && (nextGame.settings as any)?.mixedModes?.includes?.(GameMode.Hidden)) ||
                    (((nextGame.settings as any)?.hiddenStoneCount ?? 0) > 0);
                postRevealAutoScoringRef.current = {
                    boardState: nextGame.boardState,
                    moveHistory: nextGame.moveHistory || [],
                    totalTurns,
                    blackTimeLeft: nextGame.blackTimeLeft,
                    whiteTimeLeft: nextGame.whiteTimeLeft,
                    captures: nextGame.captures,
                    isHiddenMode
                };
            };

            updateGameState(currentGames => {
                const game = currentGames[gameId];
                if (!game) {
                    return currentGames;
                }

                // 서버/로컬 동기화 타이밍에 gameStatus가 먼저 playing으로 돌아가더라도
                // pendingCapture가 남아 있으면 포획 정산은 반드시 마무리한다.
                if (game.gameStatus !== 'hidden_reveal_animating' && !game.pendingCapture) {
                    return currentGames;
                }

                const pendingCapture = game.pendingCapture;
                const hasTimeControl = (game.settings?.timeLimit ?? 0) > 0 || ((game.settings?.byoyomiCount ?? 0) > 0 && (game.settings?.byoyomiTime ?? 0) > 0);
                const buildTurnDeadline = (player: Player) => {
                    if (!hasTimeControl) {
                        return { turnDeadline: undefined, turnStartTime: undefined };
                    }
                    const timeLeft = player === Player.Black ? game.blackTimeLeft : game.whiteTimeLeft;
                    const byoyomiLeft = player === Player.Black ? (game.blackByoyomiPeriodsLeft ?? 0) : (game.whiteByoyomiPeriodsLeft ?? 0);
                    const byoyomiTime = game.settings?.byoyomiTime ?? 0;
                    if ((timeLeft ?? 0) <= 0 && byoyomiLeft > 0 && byoyomiTime > 0) {
                        return { turnDeadline: now + byoyomiTime * 1000, turnStartTime: now };
                    }
                    if ((timeLeft ?? 0) > 0) {
                        return { turnDeadline: now + (timeLeft ?? 0) * 1000, turnStartTime: now };
                    }
                    return { turnDeadline: undefined, turnStartTime: hasTimeControl ? now : undefined };
                };

                if (!pendingCapture) {
                    const deadline = buildTurnDeadline(game.currentPlayer);
                    const nextGame = {
                        ...game,
                        animation: null,
                        gameStatus: 'playing',
                        revealAnimationEndTime: undefined,
                        pendingCapture: null,
                        pausedTurnTimeLeft: undefined,
                        itemUseDeadline: undefined,
                        justCaptured: [],
                        newlyRevealed: [],
                        ...deadline,
                        ...(game as any).isAiTurnCancelledAfterReveal !== undefined
                            ? ({ isAiTurnCancelledAfterReveal: undefined } as any)
                            : {}
                    } as LiveGameSession;
                    queueAutoScoringAfterReveal(nextGame);
                    return {
                        ...currentGames,
                        [gameId]: nextGame as any
                    };
                }

                const movePlayer = pendingCapture.move.player;
                const opponentPlayer = movePlayer === Player.Black ? Player.White : Player.Black;
                const boardState = (game.boardState || []).map((row: Player[]) => [...row]);
                const captures = { ...(game.captures || {}) };
                const baseStoneCaptures = { ...(game.baseStoneCaptures || {}) };
                const hiddenStoneCaptures = { ...(game.hiddenStoneCaptures || {}) };
                let blackPatternStones = game.blackPatternStones ? [...game.blackPatternStones] : undefined;
                let whitePatternStones = game.whitePatternStones ? [...game.whitePatternStones] : undefined;
                const justCaptured: { point: Point; player: Player; wasHidden: boolean; capturePoints?: number }[] = [];
                const newlyRevealed = (pendingCapture.hiddenContributors || []).map((point: Point) => ({ point, player: movePlayer }));

                let clearAiInitialHidden = false;
                const aiInitialHiddenStone = (game as any).aiInitialHiddenStone as Point | undefined;

                for (const stone of pendingCapture.stones || []) {
                    if (boardState[stone.y]) {
                        boardState[stone.y][stone.x] = Player.None;
                    }

                    const moveIndex = (game.moveHistory || []).findIndex((m: any) => m.x === stone.x && m.y === stone.y);
                    const wasHiddenMove = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
                    const wasAiInitialHidden = !!aiInitialHiddenStone && aiInitialHiddenStone.x === stone.x && aiInitialHiddenStone.y === stone.y;
                    const wasBaseStone = !!game.baseStones?.some((bs) => bs.x === stone.x && bs.y === stone.y);
                    const wasPatternStone = opponentPlayer === Player.Black
                        ? !!blackPatternStones?.some(p => p.x === stone.x && p.y === stone.y)
                        : !!whitePatternStones?.some(p => p.x === stone.x && p.y === stone.y);

                    let points = 1;
                    let wasHidden = false;

                    if (wasBaseStone) {
                        points = 5;
                        baseStoneCaptures[movePlayer] = (baseStoneCaptures[movePlayer] || 0) + 1;
                    } else if (wasHiddenMove || wasAiInitialHidden) {
                        points = 5;
                        wasHidden = true;
                        hiddenStoneCaptures[movePlayer] = (hiddenStoneCaptures[movePlayer] || 0) + 1;
                        if (wasAiInitialHidden) {
                            clearAiInitialHidden = true;
                        }
                    } else if (wasPatternStone) {
                        points = 2;
                        if (opponentPlayer === Player.Black) {
                            blackPatternStones = blackPatternStones?.filter(p => !(p.x === stone.x && p.y === stone.y));
                        } else {
                            whitePatternStones = whitePatternStones?.filter(p => !(p.x === stone.x && p.y === stone.y));
                        }
                    }

                    captures[movePlayer] = (captures[movePlayer] || 0) + points;
                    justCaptured.push({ point: stone, player: opponentPlayer, wasHidden, capturePoints: points });
                }

                // pendingCapture.stones에 “수순 좌표(히든 공개 시도 위치)”가 포함되는 경우,
                // 제거된 좌표에는 반드시 “수순을 둔 쪽의 돌”을 다시 배치한다.
                // (히든돌을 따냈을 때: 공개 연출 중엔 상대 히든이 보이고, 종료 후엔 일반돌로 존재해야 함)
                if (
                    pendingCapture.move &&
                    typeof pendingCapture.move.x === 'number' &&
                    typeof pendingCapture.move.y === 'number'
                ) {
                    boardState[pendingCapture.move.y][pendingCapture.move.x] = movePlayer;
                }

                const nextPlayer = movePlayer === Player.Black ? Player.White : Player.Black;
                const deadline = buildTurnDeadline(nextPlayer);
                const nextGame = {
                    ...game,
                    boardState,
                    captures,
                    baseStoneCaptures,
                    hiddenStoneCaptures,
                    blackPatternStones,
                    whitePatternStones,
                    justCaptured,
                    newlyRevealed,
                    currentPlayer: nextPlayer,
                    gameStatus: 'playing',
                    animation: null,
                    revealAnimationEndTime: undefined,
                    pendingCapture: null,
                    pausedTurnTimeLeft: undefined,
                    itemUseDeadline: undefined,
                    ...deadline,
                    ...(clearAiInitialHidden ? ({ aiInitialHiddenStone: undefined, aiInitialHiddenStoneIsPrePlaced: false } as any) : {}),
                    ...(game as any).isAiTurnCancelledAfterReveal !== undefined
                        ? ({ isAiTurnCancelledAfterReveal: undefined } as any)
                        : {}
                } as LiveGameSession;
                queueAutoScoringAfterReveal(nextGame);

                return {
                    ...currentGames,
                    [gameId]: nextGame as any
                };
            });

            if (postRevealAutoScoringRef.current) {
                const st = postRevealAutoScoringRef.current;
                const autoScoringAction = {
                    type: 'PLACE_STONE',
                    payload: {
                        gameId,
                        x: -1,
                        y: -1,
                        totalTurns: st.totalTurns,
                        moveHistory: st.moveHistory,
                        boardState: st.boardState,
                        blackTimeLeft: st.blackTimeLeft,
                        whiteTimeLeft: st.whiteTimeLeft,
                        captures: st.captures,
                        triggerAutoScoring: true
                    }
                } as any;
                const scoringDelayRef = gameType === 'tower' ? towerScoringDelayTimeoutRef : singlePlayerScoringDelayTimeoutRef;
                if (scoringDelayRef.current[gameId] != null) {
                    clearTimeout(scoringDelayRef.current[gameId]);
                }
                scoringDelayRef.current[gameId] = setTimeout(() => {
                    if (!postRevealAutoScoringRef.current?.isHiddenMode) {
                        updateGameState(prev => {
                            const g = prev[gameId];
                            if (!g) return prev;
                            if (g.gameStatus === 'scoring') return prev;
                            return { ...prev, [gameId]: { ...g, gameStatus: 'scoring' as const } };
                        });
                    }
                    handleAction(autoScoringAction).catch(err => {
                        console.error(`[handleAction] Failed to trigger auto-scoring after hidden reveal:`, err);
                    });
                    delete scoringDelayRef.current[gameId];
                }, 500);
            }
            return;
        }

        // 타워 게임과 싱글플레이 게임의 클라이언트 측 move 처리 (서버로 전송하지 않음)
        // 클라이언트 측 이동 처리 (도전의 탑, 싱글플레이 공통 로직)
        if ((action as any).type === 'TOWER_CLIENT_MOVE' || (action as any).type === 'SINGLE_PLAYER_CLIENT_MOVE') {
            const { updateGameStateAfterMove, checkVictoryCondition } = await import('./useClientGameState.js');
            const isTower = (action as any).type === 'TOWER_CLIENT_MOVE';
            const actionTypeName = isTower ? 'TOWER_CLIENT_MOVE' : 'SINGLE_PLAYER_CLIENT_MOVE';
            const payload = (action as any).payload;
            const { gameId, x, y, newBoardState, capturedStones, newKoInfo } = payload;
            // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
            if (process.env.NODE_ENV === 'development') {
                console.log(`[handleAction] ${actionTypeName} - processing client-side:`, { gameId, x, y });
            }
            
            // 타워 게임과 싱글플레이 게임을 각각의 상태로 관리
            const updateGameState = isTower ? setTowerGames : setSinglePlayerGames;
            const gameType: 'tower' | 'singleplayer' = isTower ? 'tower' : 'singleplayer';
            
            // 게임 상태 업데이트 및 체크 정보 준비
            let victoryCheckResult: { winner: Player; winReason: string } | null = null;
            let shouldEndGameSurvival = false;
            let endGameWinnerSurvival: Player | null = null;
            let shouldEndGameTurnLimit = false;
            let endGameWinnerTurnLimit: Player | null = null;
            let finalUpdatedGame: LiveGameSession | null = null;
            
            updateGameState((currentGames) => {
                const game = currentGames[gameId];
                if (!game) {
                    // 게임이 아직 로드되지 않았을 수 있으므로 조용히 반환 (WebSocket 업데이트를 기다림)
                    console.debug(`[handleAction] ${actionTypeName} - Game not found in state (may be loading):`, gameId);
                    return currentGames;
                }
                
                // 게임이 이미 종료되었는지 확인
                if (game.gameStatus === 'ended' || game.gameStatus === 'no_contest' || game.gameStatus === 'scoring') {
                    console.log(`[handleAction] ${actionTypeName} - Game already ended, ignoring move:`, {
                        gameId,
                        gameStatus: game.gameStatus
                    });
                    return currentGames;
                }
                
                // 공통 유틸리티 함수를 사용하여 게임 상태 업데이트
                const updateResult = updateGameStateAfterMove(game, payload, gameType);
                finalUpdatedGame = updateResult.updatedGame;
                
                // 싱글플레이 자동 계가 트리거 체크 (즉시 동기적으로 처리하여 게임 초기화 방지)
                let shouldTriggerAutoScoring = false;
                let autoScoringPreservedState: any = null;
                
                // 싱글플레이 또는 AI봇 대결에서 자동계가 체크
                // hidden_placing, scanning 등 아이템 모드에서는 자동계가 체크를 하지 않음
                const isItemMode = ['hidden_placing', 'scanning', 'missile_selecting', 'missile_animating', 'scanning_animating', 'hidden_reveal_animating'].includes(updateResult.updatedGame.gameStatus);
                
                if (!isItemMode) {
                    const skipLobbyCaptureTurnScoring =
                        updateResult.updatedGame.mode === GameMode.Capture &&
                        !updateResult.updatedGame.isSinglePlayer &&
                        (updateResult.updatedGame as any).gameCategory !== 'tower';
                    let autoScoringTurns: number | undefined =
                        gameType === 'singleplayer' && game.stageId
                            ? SINGLE_PLAYER_STAGES.find((s: any) => s.id === game.stageId)?.autoScoringTurns
                            : (updateResult.updatedGame.settings as any)?.autoScoringTurns;
                    if (gameType === 'tower' && (autoScoringTurns === undefined || autoScoringTurns === null) && (game.stageId || game.towerFloor != null)) {
                        const stage = game.stageId
                            ? TOWER_STAGES.find((s: any) => s.id === game.stageId)
                            : (game.towerFloor != null && Number(game.towerFloor) >= 1 ? TOWER_STAGES[Number(game.towerFloor) - 1] : undefined);
                        autoScoringTurns = stage?.autoScoringTurns;
                    }
                    if (!skipLobbyCaptureTurnScoring && (autoScoringTurns !== undefined || (gameType === 'singleplayer' && game.stageId))) {
                    // totalTurns는 항상 유효 수 개수로 확정 (0/N 표시와 트리거 일치).
                    // 서버/스토리지의 totalTurns가 수순보다 앞서면(예: 60/60에서 AI 차례 생략) Math.max로 인해 조기 계가되므로 validMoves만 신뢰한다.
                    const validMoves = (updateResult.updatedGame.moveHistory || []).filter((m: any) => m.x !== -1 && m.y !== -1);
                    const totalTurns = validMoves.length;
                    updateResult.updatedGame.totalTurns = totalTurns;
                    
                        if (totalTurns > 0 && autoScoringTurns != null && autoScoringTurns > 0) {
                            try {
                                const nextPlayerEnum = updateResult.updatedGame.currentPlayer;
                                const isNextTurnAi = gameType === 'singleplayer' &&
                                    ((nextPlayerEnum === Player.White && updateResult.updatedGame.whitePlayerId === aiUserId) ||
                                     (nextPlayerEnum === Player.Black && updateResult.updatedGame.blackPlayerId === aiUserId));
                                const remainingTurns = Math.max(0, autoScoringTurns - totalTurns);
                                // 자동계가: 남은 턴이 0 이하(0/N 도달)이면 반드시 계가 트리거
                                if (remainingTurns <= 0) {
                                    updateResult.updatedGame.totalTurns = totalTurns;
                                    const status = updateResult.updatedGame.gameStatus;
                                    if (status === 'playing' || status === 'hidden_placing') {
                                        // 다음 차례가 AI면, AI가 실제 착수한 뒤 서버가 계가를 트리거함 → 계가 직전에 유저 소요시간만 서버에 한 번 전달
                                        if (isNextTurnAi) {
                                            console.log(
                                                `[handleAction] ${actionTypeName} - Next turn is AI; syncing state and time for server scoring: totalTurns=${totalTurns}, autoScoringTurns=${autoScoringTurns}`
                                            );
                                            const g = updateResult.updatedGame as LiveGameSession;
                                            handleAction({
                                                type: 'PLACE_STONE',
                                                payload: {
                                                    gameId,
                                                    syncTimeAndStateForScoring: true,
                                                    moveHistory: g.moveHistory || [],
                                                    boardState: g.boardState,
                                                    totalTurns: g.totalTurns ?? totalTurns,
                                                    blackTimeLeft: g.blackTimeLeft,
                                                    whiteTimeLeft: g.whiteTimeLeft,
                                                    captures: g.captures,
                                                    hiddenMoves: g.hiddenMoves ?? undefined,
                                                    permanentlyRevealedStones: Array.isArray(g.permanentlyRevealedStones) ? g.permanentlyRevealedStones : undefined,
                                                }
                                            } as unknown as ServerAction);
                                        } else {
                                            // 마지막 착수가 화면에 보이도록, scoring 전환/서버 요청은 짧게 지연시켜 1프레임 이상 렌더를 보장
                                            shouldTriggerAutoScoring = true;
                                            const gameTypeLabel = gameType === 'singleplayer' ? 'SinglePlayer' : 'AiGame';
                                            console.log(
                                                `[handleAction] ${actionTypeName} - Auto-scoring triggered at ${updateResult.updatedGame.totalTurns} turns (${gameTypeLabel}, stageId: ${game.stageId || 'N/A'}) - delaying scoring transition`
                                            );

                                            // 게임 상태를 보존 (빈 boardState/moveHistory 방지)
                                            const preservedBoardState = updateResult.updatedGame.boardState && updateResult.updatedGame.boardState.length > 0
                                                ? updateResult.updatedGame.boardState
                                                : (game.boardState || updateResult.updatedGame.boardState);
                                            const preservedMoveHistory = updateResult.updatedGame.moveHistory && updateResult.updatedGame.moveHistory.length > 0
                                                ? updateResult.updatedGame.moveHistory
                                                : (game.moveHistory || updateResult.updatedGame.moveHistory);
                                            const preservedTotalTurns = updateResult.updatedGame.totalTurns ?? game.totalTurns;
                                            const preservedBlackTimeLeft = updateResult.updatedGame.blackTimeLeft ?? game.blackTimeLeft;
                                            const preservedWhiteTimeLeft = updateResult.updatedGame.whiteTimeLeft ?? game.whiteTimeLeft;
                                            const preservedCaptures = updateResult.updatedGame.captures ?? game.captures;
                                            const preservedHiddenMoves = updateResult.updatedGame.hiddenMoves ?? game.hiddenMoves;
                                            const preservedPermanentlyRevealedStones = updateResult.updatedGame.permanentlyRevealedStones ?? game.permanentlyRevealedStones;

                                            autoScoringPreservedState = {
                                                boardState: preservedBoardState,
                                                moveHistory: preservedMoveHistory,
                                                totalTurns: preservedTotalTurns,
                                                blackTimeLeft: preservedBlackTimeLeft,
                                                whiteTimeLeft: preservedWhiteTimeLeft,
                                                captures: preservedCaptures,
                                                hiddenMoves: preservedHiddenMoves,
                                                permanentlyRevealedStones: preservedPermanentlyRevealedStones,
                                            };

                                            // 즉시 상태에는 보드/히스토리만 확정 반영하고, gameStatus는 playing 유지
                                            updateResult.updatedGame.boardState = preservedBoardState;
                                            updateResult.updatedGame.moveHistory = preservedMoveHistory;
                                            updateResult.updatedGame.totalTurns = preservedTotalTurns;
                                            updateResult.updatedGame.blackTimeLeft = preservedBlackTimeLeft;
                                            updateResult.updatedGame.whiteTimeLeft = preservedWhiteTimeLeft;
                                            updateResult.updatedGame.captures = preservedCaptures;
                                        }
                                    }
                                }
                            } catch (err) {
                                console.error(`[handleAction] Failed to check auto-scoring:`, err);
                            }
                        }
                    }
                }
                
                // 자동 계가 트리거가 필요한 경우 서버에 요청 (비동기로 처리)
                if (shouldTriggerAutoScoring && autoScoringPreservedState) {
                    let { totalTurns, moveHistory, boardState, blackTimeLeft, whiteTimeLeft, captures, hiddenMoves, permanentlyRevealedStones } = autoScoringPreservedState;
                    const boardSize = game.settings?.boardSize || 9;
                    // IMPORTANT: 포획이 있는 판에서 moveHistory로 보드를 "단순 복원"하면 잡힌 돌이 다시 살아나는 버그가 발생할 수 있음.
                    // 자동계가에는 항상 현재 보드(boardState)를 우선 전달한다.
                    const boardStateValid =
                        Array.isArray(boardState) &&
                        boardState.length === boardSize &&
                        boardState.every((row: any) => Array.isArray(row) && row.length === boardSize);
                    if (!boardStateValid) {
                        const fallback = game.boardState;
                        const fallbackValid =
                            Array.isArray(fallback) &&
                            fallback.length === boardSize &&
                            fallback.every((row: any) => Array.isArray(row) && row.length === boardSize);
                        if (fallbackValid) {
                            boardState = fallback;
                        }
                    }
                    console.log(`[handleAction] Auto-scoring triggered on client, sending to server: totalTurns=${totalTurns}, moveHistoryLength=${moveHistory.length}, boardStateSize=${boardState.length}, blackTimeLeft=${blackTimeLeft}, whiteTimeLeft=${whiteTimeLeft}, stage=${game.stageId}`);
                    // 미사일/포획 모드 등에서 계가 정확도를 위해 보드·수순을 스냅샷으로 전달 (참조가 나중에 바뀌지 않도록 복사)
                    const snapshotBoardState = Array.isArray(boardState) ? boardState.map((row: any) => [...row]) : boardState;
                    const snapshotMoveHistory = Array.isArray(moveHistory) ? moveHistory.map((m: any) => ({ ...m })) : moveHistory;
                    const autoScoringAction = {
                        type: 'PLACE_STONE',
                        payload: {
                            gameId,
                            x: -1,
                            y: -1,
                            totalTurns: totalTurns,
                            moveHistory: snapshotMoveHistory,
                            boardState: snapshotBoardState,
                            blackTimeLeft: blackTimeLeft,
                            whiteTimeLeft: whiteTimeLeft,
                            captures: captures,
                            hiddenMoves: hiddenMoves ?? undefined,
                            permanentlyRevealedStones: Array.isArray(permanentlyRevealedStones) ? permanentlyRevealedStones : undefined,
                            triggerAutoScoring: true
                        }
                    } as any;
                    
                    // 히든 모드: 서버가 먼저 히든돌 공개 애니메이션(hidden_final_reveal)을 보낸 뒤 계가로 전환하므로,
                    // 클라이언트에서 500ms 후에 gameStatus를 'scoring'으로 바꾸지 않음 (순서 꼬임 방지)
                    const isHiddenMode = game.mode === GameMode.Hidden ||
                        (game.mode === GameMode.Mix && (game.settings as any)?.mixedModes?.includes?.(GameMode.Hidden)) ||
                        ((game.settings as any)?.hiddenStoneCount ?? 0) > 0;
                    const scoringDelayRef = isTower ? towerScoringDelayTimeoutRef : singlePlayerScoringDelayTimeoutRef;
                    if (scoringDelayRef.current[gameId] != null) {
                        clearTimeout(scoringDelayRef.current[gameId]);
                    }
                    scoringDelayRef.current[gameId] = setTimeout(() => {
                        if (!isHiddenMode) {
                            updateGameState(prev => {
                                const g = prev[gameId];
                                if (!g) return prev;
                                if (g.gameStatus === 'scoring') return prev;
                                return { ...prev, [gameId]: { ...g, gameStatus: 'scoring' as const } };
                            });
                        }
                        console.log(`[handleAction] Sending PLACE_STONE action to server for auto-scoring:`, { ...autoScoringAction, payload: { ...autoScoringAction.payload, moveHistory: `[${moveHistory.length} moves]` } });
                        handleAction(autoScoringAction).then(result => {
                            console.log(`[handleAction] Auto-scoring action sent successfully:`, result);
                        }).catch(err => {
                            console.error(`[handleAction] Failed to trigger auto-scoring on server:`, err);
                        });
                        delete scoringDelayRef.current[gameId];
                    }, 500);
                }
                
                // 살리기 바둑 모드: 백이 수를 둔 경우 목표 돌/남은 턴 체크
                const movePlayer = game.currentPlayer; // 수를 둔 플레이어
                
                if (gameType === 'singleplayer' && movePlayer === Player.White) {
                    // game.settings에서 survivalTurns를 직접 확인 (동기적으로 접근 가능)
                    const survivalTurns = (game.settings as any)?.survivalTurns;
                    if (survivalTurns) {
                        const updatedGame = updateResult.updatedGame as LiveGameSession;
                        const whiteTurnsPlayed = (updatedGame as any).whiteTurnsPlayed || 0;
                        const remainingTurns = survivalTurns - whiteTurnsPlayed;

                        const whiteTarget = updatedGame.effectiveCaptureTargets?.[Player.White];
                        const hasWhiteTarget = whiteTarget !== undefined && whiteTarget !== 999;
                        const whiteCaptures = updatedGame.captures?.[Player.White] ?? 0;
                        
                        console.log(`[handleAction] ${actionTypeName} - Survival Go check: whiteTurnsPlayed=${whiteTurnsPlayed}, survivalTurns=${survivalTurns}, remaining=${remainingTurns}, whiteCaptures=${whiteCaptures}, whiteTarget=${whiteTarget}`);

                        // 1) 백이 목표 돌을 이미 따낸 경우 → 백 승리(유저 미션 실패)
                        if (hasWhiteTarget && whiteCaptures >= whiteTarget && updatedGame.gameStatus === 'playing') {
                            console.log(`[handleAction] ${actionTypeName} - White reached capture target (${whiteCaptures}/${whiteTarget}), White wins - ENDING GAME`);
                            shouldEndGameSurvival = true;
                            endGameWinnerSurvival = Player.White;
                            return {
                                ...currentGames,
                                [gameId]: {
                                    ...updatedGame,
                                    gameStatus: 'ended' as const,
                                    winner: Player.White,
                                    winReason: 'capture_limit'
                                }
                            };
                        }

                        // 2) 백이 목표를 못 채운 채로 턴이 모두 소진된 경우 → 흑 승리
                        if (remainingTurns <= 0 && game.gameStatus === 'playing') {
                            // 백이 따낸 돌 미션을 이미 완수한 경우에는
                            // 살리기 턴 제한 패배를 적용하지 않고 위의 capture_limit 결과를 그대로 따른다.
                            if (!(hasWhiteTarget && whiteCaptures >= whiteTarget)) {
                                console.log(`[handleAction] ${actionTypeName} - White ran out of turns (${whiteTurnsPlayed}/${survivalTurns}), Black wins - ENDING GAME`);
                                shouldEndGameSurvival = true;
                                endGameWinnerSurvival = Player.Black;
                                // 게임 상태를 즉시 ended로 업데이트
                                return {
                                    ...currentGames,
                                    [gameId]: {
                                        ...updatedGame,
                                        gameStatus: 'ended' as const,
                                        winner: Player.Black,
                                        winReason: 'capture_limit'
                                    }
                                };
                            }
                        }
                    }
                }
                
                // 싱글플레이/도전의 탑 따내기 바둑:
                // 흑(유저) 제한 턴이 0이 되더라도, 같은 수에서 따낸 돌 미션을 완수했다면
                // 미션 성공(흑 승리)을 우선 적용하고 턴 제한 패배는 적용하지 않는다.
                if ((gameType === 'singleplayer' || gameType === 'tower') && game.stageId && game.gameStatus === 'playing') {
                    const stages = gameType === 'tower' ? TOWER_STAGES : SINGLE_PLAYER_STAGES;
                    const stage = stages.find((s: { id: string }) => s.id === game.stageId) as { blackTurnLimit?: number } | undefined;
                    const blackTurnLimit = stage?.blackTurnLimit;
                    if (blackTurnLimit !== undefined) {
                        const updatedGame = updateResult.updatedGame as LiveGameSession;
                        const moveHistory = updatedGame.moveHistory || [];
                        const blackMoves = moveHistory.filter((m: { player: Player; x: number; y: number }) => m.player === Player.Black && m.x !== -1 && m.y !== -1).length;
                        // 도전의 탑: blackTurnLimitBonus 반영 (아이템 등으로 추가된 턴)
                        const bonusRaw =
                            (updateResult.updatedGame as any).blackTurnLimitBonus ??
                            (game as any).blackTurnLimitBonus ??
                            0;
                        const bonus = Number(bonusRaw);
                        const effectiveLimit =
                            gameType === 'tower'
                                ? blackTurnLimit + (Number.isFinite(bonus) ? bonus : 0)
                                : blackTurnLimit;

                        if (blackMoves >= effectiveLimit) {
                            const blackTarget = updatedGame.effectiveCaptureTargets?.[Player.Black];
                            const hasBlackTarget = blackTarget !== undefined && blackTarget !== 999;
                            const blackCaptures = updatedGame.captures?.[Player.Black] ?? 0;

                            // 흑이 목표 따낸 돌을 이미 달성한 경우에는 턴 제한 패배를 적용하지 않고,
                            // 아래의 승리 조건 체크(checkVictoryCondition)를 통해 미션 성공을 처리한다.
                            if (!(hasBlackTarget && blackCaptures >= blackTarget)) {
                                console.log(`[handleAction] ${actionTypeName} - Black turn limit reached (${blackMoves}/${effectiveLimit}), mission fail - ENDING GAME`);
                                shouldEndGameTurnLimit = true;
                                endGameWinnerTurnLimit = Player.White;
                                return { ...currentGames, [gameId]: { ...updatedGame, gameStatus: 'ended' as const, winner: Player.White, winReason: 'timeout' } };
                            }
                        }
                    }
                }
                
                // 승리 조건 체크 (도전의 탑 및 싱글플레이)
                if (updateResult.shouldCheckVictory && updateResult.checkInfo) {
                    const victoryCheckInfo = updateResult.checkInfo;
                    checkVictoryCondition(
                        victoryCheckInfo,
                        gameId,
                        updateResult.updatedGame.effectiveCaptureTargets ?? game.effectiveCaptureTargets
                    ).then(async (result) => {
                        if (result) {
                            victoryCheckResult = result;
                            // 게임 상태를 즉시 ended로 업데이트하고 winner도 설정
                            updateGameState((currentGames) => {
                                const game = currentGames[gameId];
                                if (game && game.gameStatus !== 'ended') {
                                    console.log(`[handleAction] ${actionTypeName} - Setting game status to ended and winner to ${result.winner === Player.Black ? 'Black' : 'White'} immediately:`, gameId);
                                    return { ...currentGames, [gameId]: { ...game, gameStatus: 'ended' as const, winner: result.winner, winReason: result.winReason } };
                                }
                                return currentGames;
                            });
                            const endGameActionType = isTower ? 'END_TOWER_GAME' : 'END_SINGLE_PLAYER_GAME';
                            if (isTower && result.winner === Player.Black) {
                                applyOptimisticTowerClearOnBlackWin(victoryCheckInfo.towerFloor, result.winner);
                            }
                            try {
                                await handleAction({
                                    type: endGameActionType,
                                    payload: {
                                        gameId,
                                        winner: result.winner,
                                        winReason: result.winReason
                                    }
                                } as any);
                            } catch (err) {
                                console.error(`[handleAction] Failed to end ${gameType} game:`, err);
                            }
                        }
                    });
                }
                
                return { ...currentGames, [gameId]: updateResult.updatedGame };
            });
            
            // 싱글플레이 게임과 도전의 탑 게임의 경우 sessionStorage에 저장 (restoredBoardState가 최신 상태를 읽을 수 있도록)
            if ((gameType === 'singleplayer' || gameType === 'tower') && finalUpdatedGame) {
                try {
                    const game = finalUpdatedGame as LiveGameSession;
                    const GAME_STATE_STORAGE_KEY = `gameState_${gameId}`;
                    const gameStateToSave = {
                        gameId,
                        boardState: game.boardState,
                        moveHistory: game.moveHistory || [],
                        captures: game.captures || { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
                        baseStoneCaptures: game.baseStoneCaptures,
                        hiddenStoneCaptures: game.hiddenStoneCaptures,
                        permanentlyRevealedStones: game.permanentlyRevealedStones || [],
                        blackPatternStones: game.blackPatternStones,
                        whitePatternStones: game.whitePatternStones,
                        hiddenMoves: game.hiddenMoves || {},
                        hidden_stones_p1: (game as any).hidden_stones_p1,
                        hidden_stones_p2: (game as any).hidden_stones_p2,
                        totalTurns: game.totalTurns,
                        ...(gameType === 'tower' && (game as any).blackTurnLimitBonus != null
                            ? { blackTurnLimitBonus: Number((game as any).blackTurnLimitBonus) || 0 }
                            : {}),
                        timestamp: Date.now()
                    };
                    sessionStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(gameStateToSave));
                    console.log(`[handleAction] ${actionTypeName} - Saved game state to sessionStorage for game ${gameId}`);
                } catch (e) {
                    console.error(`[handleAction] ${actionTypeName} - Failed to save game state to sessionStorage:`, e);
                }
            }
            
            // 살리기 바둑에서 게임 종료가 필요한 경우
            if (shouldEndGameSurvival && endGameWinnerSurvival !== null && finalUpdatedGame) {
                // 게임 종료 액션 호출
                handleAction({
                    type: 'END_SINGLE_PLAYER_GAME',
                    payload: {
                        gameId,
                        winner: endGameWinnerSurvival,
                        winReason: 'capture_limit'
                    }
                } as any).catch(err => {
                    console.error(`[handleAction] Failed to end single player game:`, err);
                });
            }
            
            // 싱글플레이/도전의 탑 따내기 바둑 제한 턴 소진 시 미션 실패(서버에 종료 반영)
            if (shouldEndGameTurnLimit && endGameWinnerTurnLimit !== null && finalUpdatedGame) {
                const endGameActionType = gameType === 'tower' ? 'END_TOWER_GAME' : 'END_SINGLE_PLAYER_GAME';
                handleAction({
                    type: endGameActionType,
                    payload: {
                        gameId,
                        winner: endGameWinnerTurnLimit,
                        winReason: 'timeout'
                    }
                } as any).catch(err => {
                    console.error(`[handleAction] Failed to end ${gameType} game (turn limit):`, err);
                });
            }
            
            return { gameId };
        }
        
        if (action.type === 'CLEAR_TOURNAMENT_SESSION' && currentUserRef.current) {
            applyUserUpdate({
                    lastNeighborhoodTournament: null,
                    lastNationalTournament: null,
                    lastWorldTournament: null,
            }, 'CLEAR_TOURNAMENT_SESSION-local');
        }
        // Optimistic update는 제거 - 서버 응답에만 의존
        // TOGGLE_EQUIP_ITEM의 optimistic update는 서버 응답과 충돌할 수 있으므로 제거
        if (action.type === 'SAVE_PRESET') {
            const prevUser = currentUserRef.current;
            if (prevUser) {
                const { preset, index } = action.payload;
                const newPresets = [...(prevUser.equipmentPresets || [])];
                newPresets[index] = preset;
                applyUserUpdate({ equipmentPresets: newPresets }, 'SAVE_PRESET-local');
            }
        }

        // currentUserRef.current?.id가 없으면 액션을 보내지 않음 (401 에러 방지)
        if (!currentUserRef.current?.id) {
            if (import.meta.env.DEV) {
                console.warn(`[handleAction] Cannot send action ${action.type}: user not authenticated`);
            }
            // ENTER_TOURNAMENT_VIEW 같은 경우는 사용자가 아직 로드되지 않았을 수 있으므로
            // 에러를 표시하지 않고 조용히 무시
            if (action.type !== 'ENTER_TOURNAMENT_VIEW' && action.type !== 'LEAVE_TOURNAMENT_VIEW') {
                showError('로그인이 필요합니다.');
            }
            return;
        }

        let dicePlaceGameId: string | undefined;
        const rollbackTowerAddTurnOptimistic = () => {
            if (action.type !== 'TOWER_ADD_TURNS') return;
            const gid = (action.payload as { gameId?: string })?.gameId;
            if (!gid) return;
            const pending = towerAddTurnOptimisticPendingByGameRef.current[gid] || 0;
            delete towerAddTurnOptimisticPendingByGameRef.current[gid];
            if (pending <= 0) return;
            flushSync(() => {
                setTowerGames((c) => {
                    const g = c[gid];
                    if (!g) return c;
                    const bonus = Number((g as any).blackTurnLimitBonus) || 0;
                    return { ...c, [gid]: { ...g, blackTurnLimitBonus: Math.max(0, bonus - pending) } };
                });
            });
            try {
                const key = `gameState_${gid}`;
                const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
                if (raw) {
                    const parsed = JSON.parse(raw) as Record<string, unknown>;
                    if (parsed && parsed.gameId === gid) {
                        parsed.blackTurnLimitBonus = Math.max(0, (Number(parsed.blackTurnLimitBonus) || 0) - pending);
                        parsed.timestamp = Date.now();
                        sessionStorage.setItem(key, JSON.stringify(parsed));
                    }
                }
            } catch {
                /* ignore */
            }
        };

        try {
            // 도전의 탑 턴 추가: 서버 응답 전에 클라가 턴 제한 패배를 판정하지 않도록 보너스를 즉시 반영
            if (action.type === 'TOWER_ADD_TURNS') {
                const gid = (action.payload as { gameId?: string })?.gameId;
                if (gid) {
                    const gSnap = towerGamesRef.current[gid];
                    if (gSnap && (gSnap as any).gameCategory === 'tower') {
                        towerAddTurnOptimisticPendingByGameRef.current[gid] =
                            (towerAddTurnOptimisticPendingByGameRef.current[gid] || 0) + 3;
                        flushSync(() => {
                            setTowerGames((current) => {
                                const g = current[gid];
                                if (!g || (g as any).gameCategory !== 'tower') return current;
                                const prev = Number((g as any).blackTurnLimitBonus) || 0;
                                return { ...current, [gid]: { ...g, blackTurnLimitBonus: prev + 3 } };
                            });
                        });
                        try {
                            const key = `gameState_${gid}`;
                            const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
                            if (raw) {
                                const parsed = JSON.parse(raw) as Record<string, unknown>;
                                if (parsed && parsed.gameId === gid) {
                                    parsed.blackTurnLimitBonus = (Number(parsed.blackTurnLimitBonus) || 0) + 3;
                                    parsed.timestamp = Date.now();
                                    sessionStorage.setItem(key, JSON.stringify(parsed));
                                }
                            }
                        } catch {
                            /* ignore */
                        }
                    }
                }
            }

            audioService.unlockFromUserGesture();
            void audioService.initialize();

            dicePlaceGameId =
                action.type === 'DICE_PLACE_STONE'
                    ? (action.payload as { gameId?: string })?.gameId
                    : undefined;
            if (action.type === 'DICE_ROLL') {
                const gid = (action.payload as { gameId?: string })?.gameId;
                if (gid) {
                    delete aiDicePlaceBatchRef.current[gid];
                    delete aiDiceTurnPlaceQuotaRef.current[gid];
                }
            }

            const revertPvpDicePlaceSnapshot = () => {
                const gid = dicePlaceGameId;
                if (!gid) return;
                const snap = pvpDicePlaceRevertRef.current[gid];
                if (!snap) return;
                setLiveGames((c) => (c[gid] ? { ...c, [gid]: snap } : c));
                delete pvpDicePlaceRevertRef.current[gid];
            };

            if (dicePlaceGameId) {
                const gid = dicePlaceGameId;
                const beforePlaceGame = liveGamesRef.current[gid];
                const isAiDiceBatchMode = !!(
                    beforePlaceGame &&
                    beforePlaceGame.isAiGame &&
                    beforePlaceGame.mode === GameMode.Dice &&
                    beforePlaceGame.gameStatus === 'dice_placing' &&
                    !((action as { payload?: { __forceSingle?: boolean } }).payload?.__forceSingle)
                );
                // 같은 턴에 여러 번 착수할 때도 매 클릭마다 낙관적 반영 (이전에는 inFlight>0이면 스킵되어 두 번째 돌부터 화면이 멈춤)
                let optimisticDiceGameAfterPlace: LiveGameSession | null = null;
                flushSync(() => {
                    setLiveGames((currentGames) => {
                        const g = currentGames[gid];
                        if (!g || g.isSinglePlayer || g.gameCategory === 'tower' || g.gameStatus !== 'dice_placing') {
                            return currentGames;
                        }
                        if ((g.stonesToPlace ?? 0) <= 0) return currentGames;
                        const { x, y } = (action as { payload: { x: number; y: number } }).payload;
                        if (!isDiceGoLibertyPlacement(g, x, y)) return currentGames;
                        const snap = JSON.parse(JSON.stringify(g)) as LiveGameSession;
                        // 주사위 턴 내 착수는 서버 moveHistory에 수마다 push되지만, 클라 낙관은 moveHistory를 늘리지 않아
                        // ko 판정용 길이는 moveHistory + 이번 턴에 이미 둔 수(stonesPlacedThisTurn)와 맞춰야 한다.
                        const remStones = g.stonesToPlace ?? 0;
                        const prevPlaced = g.stonesPlacedThisTurn || [];
                        const dice1 = g.dice?.dice1;
                        // 이전 턴의 stonesPlacedThisTurn이 GAME_UPDATE 병합 등으로 남으면 두 번째 턴부터 ko 길이가 틀어져
                        // 착수가 전부 무효로 떨어지다가 마지막에만 맞는 것처럼 보일 수 있다. (이미 둔 수 + 남은 수 === 주사위)
                        let basePlaced = prevPlaced;
                        if (typeof dice1 === 'number' && dice1 > 0 && remStones > 0) {
                            if (prevPlaced.length + remStones !== dice1) {
                                basePlaced = [];
                            }
                        }
                        const effectiveMoveLenForKo = (g.moveHistory?.length ?? 0) + basePlaced.length;
                        const pm = processMoveClient(
                            g.boardState,
                            { x, y, player: Player.Black },
                            g.koInfo ?? null,
                            effectiveMoveLenForKo,
                            { ignoreSuicide: true }
                        );
                        if (!pm.isValid) return currentGames;
                        const clearedStalePlaced = basePlaced.length === 0 && prevPlaced.length > 0;
                        const turnCaptureBase = clearedStalePlaced ? 0 : (g.diceCapturesThisTurn || 0);
                        // AI 주사위 바둑은 턴 단위 배치 전송 + 서버 재동기화를 사용하므로
                        // 클릭 즉시성 확보를 위해 비싼 deep clone 스냅샷을 생략한다.
                        if (!isAiDiceBatchMode) {
                            pvpDicePlaceRevertRef.current[gid] = snap;
                        }
                        const newBoard = pm.newBoardState.map((row) => [...row]);
                        const nextStones = (g.stonesToPlace ?? 1) - 1;
                        const placed = [...basePlaced, { x, y }];
                        const isLastPlacementInTurn = nextStones <= 0;
                        const optimisticJustCaptured =
                            isLastPlacementInTurn && pm.capturedStones.length > 0
                                ? [{
                                    point: pm.capturedStones[pm.capturedStones.length - 1],
                                    player: Player.White,
                                    wasHidden: false,
                                    capturePoints: pm.capturedStones.length,
                                }]
                                : [];
                        const nextDiceSession: LiveGameSession = {
                            ...g,
                            boardState: newBoard,
                            koInfo: pm.newKoInfo,
                            lastMove: { x, y },
                            stonesToPlace: nextStones,
                            stonesPlacedThisTurn: placed,
                            diceCapturesThisTurn: turnCaptureBase + pm.capturedStones.length,
                            justCaptured: optimisticJustCaptured,
                        };
                        optimisticDiceGameAfterPlace = nextDiceSession;
                        return {
                            ...currentGames,
                            [gid]: nextDiceSession,
                        };
                    });
                });

                if (isAiDiceBatchMode) {
                    const { x, y } = (action as { payload: { x: number; y: number } }).payload;
                    if (!aiDicePlaceBatchRef.current[gid]) aiDicePlaceBatchRef.current[gid] = [];
                    if (!aiDicePlaceBatchRef.current[gid].length) {
                        aiDiceTurnPlaceQuotaRef.current[gid] = Math.max(1, beforePlaceGame?.stonesToPlace ?? 1);
                    }
                    aiDicePlaceBatchRef.current[gid].push({ x, y });
                    const turnQuota = aiDiceTurnPlaceQuotaRef.current[gid] ?? Math.max(1, beforePlaceGame?.stonesToPlace ?? 1);
                    const shouldFlushNow = aiDicePlaceBatchRef.current[gid].length >= turnQuota;
                    if (shouldFlushNow) {
                        const placements = aiDicePlaceBatchRef.current[gid] || [];
                        delete aiDicePlaceBatchRef.current[gid];
                        delete aiDiceTurnPlaceQuotaRef.current[gid];
                        const batchResult = await handleAction({
                            type: 'DICE_PLACE_STONES_BATCH',
                            payload: { gameId: gid, placements },
                        } as any);
                        // 서버가 배치 액션을 모르는 구버전 경로(400: Unknown social action 등)면 단건으로 자동 폴백
                        if ((batchResult as any)?.error) {
                            for (const p of placements) {
                                await handleAction({
                                    type: 'DICE_PLACE_STONE',
                                    payload: { gameId: gid, x: p.x, y: p.y, __forceSingle: true },
                                } as any);
                            }
                            return {
                                clientResponse: {
                                    game: optimisticDiceGameAfterPlace ?? liveGamesRef.current[gid],
                                },
                            } as HandleActionResult;
                        }
                        return batchResult;
                    }
                    return {
                        clientResponse: {
                            game: optimisticDiceGameAfterPlace ?? liveGamesRef.current[gid],
                        },
                    } as HandleActionResult;
                }
            }

            if (dicePlaceGameId) {
                pvpDicePlaceInFlightRef.current[dicePlaceGameId] =
                    (pvpDicePlaceInFlightRef.current[dicePlaceGameId] || 0) + 1;
            }

            const res = await fetch(getApiUrl('/api/action'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ ...action, userId: currentUserRef.current.id }),
            });

            if (!res.ok) {
                let errorMessage = 'An unknown error occurred.';
                try {
                    const errorData = await res.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                    console.error(`[handleAction] ${action.type} - HTTP ${res.status} error:`, errorData);
                } catch (parseError) {
                    console.error(`[handleAction] ${action.type} - Failed to parse error response:`, parseError);
                    errorMessage = `서버 오류 (${res.status})`;
                }
                // 401 에러는 특별 처리 (인증 문제)
                if (res.status === 401) {
                    if (import.meta.env.DEV) {
                        console.warn(`[handleAction] ${action.type} - Authentication failed, user may not be logged in`);
                    }
                    // ENTER_TOURNAMENT_VIEW 같은 경우는 사용자가 아직 로드되지 않았을 수 있으므로
                    // 에러를 표시하지 않고 조용히 무시
                    if (action.type !== 'ENTER_TOURNAMENT_VIEW' && action.type !== 'LEAVE_TOURNAMENT_VIEW') {
                        showError('로그인이 필요합니다.');
                    }
                    revertPvpDicePlaceSnapshot();
                    rollbackTowerAddTurnOptimistic();
                    return;
                }
                if (typeof errorMessage === 'string' && isOpponentInsufficientActionPointsError(errorMessage)) {
                    setIsOpponentInsufficientActionPointsModalOpen(true);
                } else if (typeof errorMessage === 'string' && (errorMessage.includes('액션 포인트') || errorMessage.includes('행동력'))) {
                    setIsInsufficientActionPointsModalOpen(true);
                } else if (!shouldSuppressModalForKoPlaceStone(action, typeof errorMessage === 'string' ? errorMessage : '')) {
                    showError(errorMessage);
                }
                if (action.type === 'TOGGLE_EQUIP_ITEM' || action.type === 'USE_ITEM') {
                    setUpdateTrigger(prev => prev + 1);
                }
                revertPvpDicePlaceSnapshot();
                rollbackTowerAddTurnOptimistic();
                // Return error object so components can handle it
                return { error: errorMessage } as HandleActionResult;
            } else {
                const result = await res.json();
                if (result.error || result.message) {
                    const errorMessage = result.message || result.error || '서버 오류가 발생했습니다.';
                    console.error(`[handleAction] ${action.type} - Server returned error:`, errorMessage);
                    // 상대 행동력 부족은 본인 충전 모달과 구분
                    if (typeof errorMessage === 'string' && isOpponentInsufficientActionPointsError(errorMessage)) {
                        setIsOpponentInsufficientActionPointsModalOpen(true);
                    } else if (typeof errorMessage === 'string' && (errorMessage.includes('액션 포인트') || errorMessage.includes('행동력'))) {
                        setIsInsufficientActionPointsModalOpen(true);
                    } else if (!shouldSuppressModalForKoPlaceStone(action, typeof errorMessage === 'string' ? errorMessage : '')) {
                        showError(errorMessage);
                    }
                    revertPvpDicePlaceSnapshot();
                    rollbackTowerAddTurnOptimistic();
                    return { error: errorMessage } as HandleActionResult;
                }
                if (action.type === 'TOWER_ADD_TURNS') {
                    const gidOk = (action.payload as { gameId?: string })?.gameId;
                    if (gidOk) {
                        const left = (towerAddTurnOptimisticPendingByGameRef.current[gidOk] || 0) - 3;
                        if (left <= 0) delete towerAddTurnOptimisticPendingByGameRef.current[gidOk];
                        else towerAddTurnOptimisticPendingByGameRef.current[gidOk] = left;
                    }
                }
                // LEAVE_AI_GAME 성공 시 로컬 상태에서 해당 게임 제거 및 사용자 gameId 해제 → 전략/놀이 대기실로 이동
                if (action.type === 'LEAVE_AI_GAME') {
                    const gameId = (action.payload as { gameId?: string })?.gameId;
                    if (gameId) {
                        try {
                            sessionStorage.removeItem(`gameState_${gameId}`);
                        } catch {
                            /* ignore */
                        }
                        // flushSync: replaceAppHash 이전에 activeGame이 null이 되도록 해야 함.
                        // 그렇지 않으면 setTimeout(0) 라우팅 직후 "대국으로 복귀" effect가 종료된 대국으로 다시 끌어당김(postGameRedirect는 이미 삭제됨).
                        flushSync(() => {
                            setTowerGames((current) => {
                                if (!current[gameId]) return current;
                                const next = { ...current };
                                delete next[gameId];
                                return next;
                            });
                            setSinglePlayerGames((current) => {
                                if (!current[gameId]) return current;
                                const next = { ...current };
                                delete next[gameId];
                                return next;
                            });
                            setLiveGames((current) => {
                                if (!current[gameId]) return current;
                                const next = { ...current };
                                delete next[gameId];
                                return next;
                            });
                            const uid = currentUserRef.current?.id;
                            if (uid) {
                                setOnlineUsers((prev) =>
                                    prev.map((u) =>
                                        u.id === uid ? { ...u, status: UserStatus.Online, gameId: undefined, mode: undefined } : u
                                    )
                                );
                            }
                        });
                    }
                    // 나가기 클릭 시 설정된 대기실로 즉시 이동 (전략바둑 → #/waiting/strategic, 놀이바둑 → #/waiting/playful 등)
                    const postRedirect = sessionStorage.getItem('postGameRedirect');
                    if (postRedirect) {
                        sessionStorage.removeItem('postGameRedirect');
                        replaceAppHash(postRedirect);
                    }
                }

                // PVP/일반전략·놀이 모드의 LEAVE_GAME_ROOM 성공 시에도 로컬 게임 상태를 정리해
                // “나가기 버튼” 클릭 후 대기실 라우팅이 정상 동작하도록 한다.
                if (action.type === 'LEAVE_GAME_ROOM') {
                    const gameId = (action.payload as { gameId?: string })?.gameId;
                    if (gameId) {
                        try {
                            sessionStorage.removeItem(`gameState_${gameId}`);
                        } catch {
                            /* ignore */
                        }

                        flushSync(() => {
                            setTowerGames((current) => {
                                if (!current[gameId]) return current;
                                const next = { ...current };
                                delete next[gameId];
                                return next;
                            });
                            setSinglePlayerGames((current) => {
                                if (!current[gameId]) return current;
                                const next = { ...current };
                                delete next[gameId];
                                return next;
                            });
                            setLiveGames((current) => {
                                if (!current[gameId]) return current;
                                const next = { ...current };
                                delete next[gameId];
                                return next;
                            });

                            const uid = currentUserRef.current?.id;
                            if (uid) {
                                setOnlineUsers((prev) =>
                                    prev.map((u) =>
                                        u.id === uid ? { ...u, status: UserStatus.Online, gameId: undefined, mode: undefined } : u
                                    )
                                );
                            }
                        });
                    }

                    const postRedirect = sessionStorage.getItem('postGameRedirect');
                    if (postRedirect) {
                        sessionStorage.removeItem('postGameRedirect');
                        replaceAppHash(postRedirect);
                    }
                }
                // SPECTATE_GAME 성공 시 서버가 반환한 전체 게임 데이터를 상태에 넣고 게임 페이지로 이동 (중립 관전)
                if (action.type === 'SPECTATE_GAME') {
                    const spectateGame = result.clientResponse?.game || (result as any).game;
                    if (spectateGame?.id) {
                        const category = spectateGame.gameCategory || (spectateGame.isSinglePlayer ? 'singleplayer' : 'normal');
                        if (category === 'tower') {
                            setTowerGames(prev => ({ ...prev, [spectateGame.id]: spectateGame }));
                        } else {
                            setLiveGames(prev => ({ ...prev, [spectateGame.id]: spectateGame }));
                        }
                        const targetHash = `#/game/${spectateGame.id}`;
                        if (window.location.hash !== targetHash) {
                            setTimeout(() => { window.location.hash = targetHash; }, 100);
                        }
                    }
                }
                // COMPLETE_DUNGEON_STAGE: 서버가 { success, ...clientResponse } 형태로 보내므로 clientResponse 없이 flat하게 옴. updatedUser를 먼저 적용해 dungeonProgress(unlockedStages, stageResults 등) 반영 후 반환.
                if (action.type === 'COMPLETE_DUNGEON_STAGE' && result && result.userRank != null) {
                    const updatedUser = result.updatedUser || (result as any).clientResponse?.updatedUser;
                    if (updatedUser) {
                        applyUserUpdate(updatedUser, 'COMPLETE_DUNGEON_STAGE-http');
                    }
                    return result as HandleActionResult;
                }
                // START_GUILD_BOSS_BATTLE: 보상(장비 등)이 인벤토리에 반영된 updatedUser를 즉시 적용해 결과창 확인 후 가방에서 획득 장비가 보이도록 함.
                if (action.type === 'START_GUILD_BOSS_BATTLE' && result && !result.error) {
                    const updatedUser = result.updatedUser || (result as any).clientResponse?.updatedUser;
                    if (updatedUser) {
                        if (updatedUser.inventory && Array.isArray(updatedUser.inventory)) {
                            updatedUser.inventory = JSON.parse(JSON.stringify(updatedUser.inventory));
                        }
                        flushSync(() => {
                            applyUserUpdate(updatedUser, 'START_GUILD_BOSS_BATTLE-http');
                            setUpdateTrigger(prev => prev + 1);
                        });
                    }
                }
                // 계가 요청 응답 처리
                if (action.type === 'REQUEST_SCORING' && result.clientResponse?.scoringAnalysis) {
                    const { scoringAnalysis } = result.clientResponse;
                    const gameId = (action.payload as any).gameId;
                    // AI 게임도 PVE로 처리하므로 singlePlayerGames에 저장
                    // 게임을 찾아서 카테고리를 확인
                    const game = towerGames[gameId] || singlePlayerGames[gameId] || liveGames[gameId];
                    const isTower = game?.gameCategory === 'tower';
                    const updateGameState = isTower ? setTowerGames : setSinglePlayerGames;
                    
                    // 게임 상태를 scoring으로 변경하고 분석 결과 저장
                    updateGameState((currentGames) => {
                        const game = currentGames[gameId];
                        if (!game) return currentGames;
                        
                        return {
                            ...currentGames,
                            [gameId]: {
                                ...game,
                                gameStatus: 'scoring' as const,
                                analysisResult: {
                                    ...game.analysisResult,
                                    [currentUserRef.current?.id || 'system']: scoringAnalysis
                                }
                            }
                        };
                    });
                    
                    // 계가 결과를 기반으로 게임 종료 처리
                    const blackTotal = scoringAnalysis.scoreDetails?.black?.total || 0;
                    const whiteTotal = scoringAnalysis.scoreDetails?.white?.total || 0;
                    const winner = blackTotal > whiteTotal ? Player.Black : (whiteTotal > blackTotal ? Player.White : Player.None);
                    
                    updateGameState((currentGames) => {
                        const game = currentGames[gameId];
                        if (!game) return currentGames;
                        
                        return {
                            ...currentGames,
                            [gameId]: {
                                ...game,
                                gameStatus: 'ended' as const,
                                winner,
                                winReason: 'score' as const,
                                finalScores: {
                                    black: blackTotal,
                                    white: whiteTotal
                                }
                            }
                        };
                    });
                    
                    const endGameActionType = isTower ? 'END_TOWER_GAME' : 'END_SINGLE_PLAYER_GAME';
                    if (isTower && winner === Player.Black) {
                        applyOptimisticTowerClearOnBlackWin(game.towerFloor, winner);
                    }
                    try {
                        await handleAction({
                            type: endGameActionType,
                            payload: {
                                gameId,
                                winner,
                                winReason: 'score'
                            }
                        } as any);
                    } catch (err) {
                        console.error(`[handleAction] Failed to end ${isTower ? 'tower' : 'single player'} game:`, err);
                    }
                    
                    return;
                }
                
                console.debug('[handleAction] Action response received', {
                    actionType: action.type,
                    hasUpdatedUser: !!result.updatedUser || !!result.clientResponse?.updatedUser,
                    moveHistoryLength: Array.isArray(result.clientResponse?.game?.moveHistory) ? result.clientResponse.game.moveHistory.length : undefined,
                    raw: result,
                });

                if (action.type === 'ADMIN_TOGGLE_GAME_MODE' && (result.gameModeAvailability ?? result.clientResponse?.gameModeAvailability)) {
                    setGameModeAvailability(result.gameModeAvailability ?? result.clientResponse.gameModeAvailability);
                }
                if (action.type === 'ADMIN_TOGGLE_ARENA_ENTRANCE' && (result.arenaEntranceAvailability ?? result.clientResponse?.arenaEntranceAvailability)) {
                    setArenaEntranceAvailability(
                        mergeArenaEntranceAvailability(
                            result.arenaEntranceAvailability ?? result.clientResponse.arenaEntranceAvailability,
                        ),
                    );
                }

                // CONFIRM_TOWER_GAME_START 액션에 대한 상세 로깅
                if (action.type === 'CONFIRM_TOWER_GAME_START') {
                    const responseGameId = result.clientResponse?.gameId || (result as any).gameId;
                    const responseGame = result.clientResponse?.game || (result as any).game;
                    console.log(`[handleAction] CONFIRM_TOWER_GAME_START - Full response:`, {
                        result,
                        hasClientResponse: !!result.clientResponse,
                        gameId: responseGameId,
                        hasGame: !!responseGame,
                        game: responseGame,
                        gameStatus: responseGame?.gameStatus,
                        gameCategory: responseGame?.gameCategory,
                    });
                    
                    // gameId가 없으면 경고
                    if (!responseGameId) {
                        console.warn('[handleAction] CONFIRM_TOWER_GAME_START - No gameId in response!', result);
                    }
                    // game 객체가 없으면 경고
                    if (!responseGame) {
                        console.warn('[handleAction] CONFIRM_TOWER_GAME_START - No game object in response!', result);
                    }
                }
                
                console.log(`[handleAction] ${action.type} - Response received:`, {
                    hasUpdatedUser: !!result.updatedUser,
                    hasClientResponse: !!result.clientResponse,
                    hasClientResponseUpdatedUser: !!result.clientResponse?.updatedUser,
                    hasRedirectToTournament: !!result.clientResponse?.redirectToTournament,
                    redirectToTournament: result.clientResponse?.redirectToTournament || result.redirectToTournament,
                    hasObtainedItemsBulk: !!result.obtainedItemsBulk,
                    hasClientResponseObtainedItemsBulk: !!result.clientResponse?.obtainedItemsBulk,
                    hasRewardSummary: !!result.rewardSummary,
                    hasDisassemblyResult: !!result.disassemblyResult,
                    hasCombinationResult: !!result.combinationResult,
                    hasEnhancementOutcome: !!result.enhancementOutcome,
                    hasCraftResult: !!result.craftResult,
                    resultKeys: Object.keys(result),
                    clientResponseKeys: result.clientResponse ? Object.keys(result.clientResponse) : [],
                    fullResult: result
                });
                
                // 서버 응답 구조: { success: true, ...result.clientResponse }
                // 따라서 result.updatedUser 또는 result.clientResponse?.updatedUser 확인
                const updatedUserFromResponse = result.updatedUser || result.clientResponse?.updatedUser;
                
                if (updatedUserFromResponse) {
                    // 인벤토리 변경을 확실히 반영해야 하는 액션들
                    const inventoryCriticalActions = [
                        'CLAIM_MAIL_ATTACHMENTS',
                        'CLAIM_ALL_MAIL_ATTACHMENTS',
                        'CLAIM_QUEST_REWARD',
                        'CLAIM_TOURNAMENT_REWARD',
                        'CLAIM_ACTIVITY_MILESTONE',
                        'CLAIM_SINGLE_PLAYER_MISSION_REWARD',
                        'CLAIM_ALL_TRAINING_QUEST_REWARDS',
                        'SINGLE_PLAYER_REFRESH_PLACEMENT',
                        'TOWER_REFRESH_PLACEMENT',
                        'TOWER_ADD_TURNS',
                        'COMPLETE_DUNGEON_STAGE',
                        'BUY_SHOP_ITEM',
                        'BUY_MATERIAL_BOX',
                        'BUY_CONSUMABLE',
                        'BUY_CONDITION_POTION',
                        'USE_CONDITION_POTION',
                        'BUY_BORDER',
                        'BUY_TOWER_ITEM',
                        'ENHANCE_ITEM',
                        'DISASSEMBLE_ITEM',
                        'COMBINE_ITEMS',
                        'CRAFT_MATERIAL',
                        'EXPAND_INVENTORY',
                        'TOGGLE_EQUIP_ITEM',
                        'MANNER_ACTION',
                        'START_GUILD_BOSS_BATTLE',
                        'END_TOWER_GAME',
                        'CLAIM_ONBOARDING_INTRO1_FAN',
                    ];
                    const isInventoryCriticalAction = inventoryCriticalActions.includes(action.type);
                    
                    if (isInventoryCriticalAction && updatedUserFromResponse.inventory) {
                        // inventory가 있는 경우 깊은 복사로 새로운 참조 생성하여 React가 변경을 확실히 감지하도록 함
                        updatedUserFromResponse.inventory = JSON.parse(JSON.stringify(updatedUserFromResponse.inventory));
                        console.log(`[handleAction] ${action.type} - Forcing inventory update`, {
                            inventoryLength: updatedUserFromResponse.inventory?.length,
                            inventoryItems: updatedUserFromResponse.inventory?.slice(0, 3).map((i: any) => i.name)
                        });
                    }

                    if ((action.type === 'CLAIM_SINGLE_PLAYER_MISSION_REWARD' || action.type === 'CLAIM_ALL_TRAINING_QUEST_REWARDS') && updatedUserFromResponse.singlePlayerMissions) {
                        try {
                            updatedUserFromResponse.singlePlayerMissions = JSON.parse(JSON.stringify(updatedUserFromResponse.singlePlayerMissions));
                        } catch (error) {
                            console.warn(`[handleAction] ${action.type} - Failed to deep copy singlePlayerMissions`, error);
                        }
                    }
                    
                    // applyUserUpdate는 이미 내부에서 flushSync를 사용하므로 모든 액션에서 즉시 UI 업데이트됨
                    // HTTP 응답의 updatedUser를 우선적으로 적용하고, WebSocket 업데이트는 일정 시간 동안 무시됨
                    const mergedUser = applyUserUpdate(updatedUserFromResponse, `${action.type}-http`);
                    // 챔피언십 던전 입장: 경기장에서 컨텍스트 반영 전에도 표시할 수 있도록 dungeonState를 sessionStorage에 보관
                    if (action.type === 'START_DUNGEON_STAGE') {
                        const dungeonState = (result as any).dungeonState || result.clientResponse?.dungeonState;
                        if (dungeonState && dungeonState.type) {
                            try {
                                sessionStorage.setItem(`pendingDungeon_${dungeonState.type}`, JSON.stringify(dungeonState));
                            } catch (e) {
                                console.warn('[handleAction] Failed to store pending dungeon state', e);
                            }
                        }
                    }
                    // HTTP 응답에 updatedUser가 있었음을 기록하고 타임스탬프 업데이트
                    lastHttpUpdateTime.current = Date.now();
                    lastHttpActionType.current = action.type;
                    lastHttpHadUpdatedUser.current = true;
                    console.log(`[handleAction] ${action.type} - applied HTTP updatedUser (WebSocket updates will be ignored for ${HTTP_UPDATE_DEBOUNCE_MS}ms)`, {
                        inventoryLength: mergedUser?.inventory?.length,
                        equipment: mergedUser?.equipment,
                        gold: mergedUser?.gold,
                        diamonds: mergedUser?.diamonds,
                        actionPoints: mergedUser?.actionPoints
                    });
                    
                    // 보상 수령 액션의 경우 추가로 강제 업데이트
                    if (isInventoryCriticalAction) {
                        flushSync(() => {
                            setUpdateTrigger(prev => prev + 1);
                            // currentUser 상태를 다시 설정하여 확실히 업데이트
                            setCurrentUser(prev => {
                                if (prev && mergedUser && prev.id === mergedUser.id) {
                                    return mergedUser;
                                }
                                return prev;
                            });
                        });
                    }
                    // 도전의 탑 클리어 시 대기실 랭킹 즉시 갱신 (10초 대기 없이)
                    if (action.type === 'END_TOWER_GAME') {
                        setTowerRankingsRefetchTrigger(prev => prev + 1);
                    }
                } else {
                    // HTTP 응답에 updatedUser가 없었음을 기록 (타임스탬프는 업데이트하지 않음)
                    lastHttpActionType.current = action.type;
                    lastHttpHadUpdatedUser.current = false;
                    const actionsThatShouldHaveUpdatedUser = [
                        'TOGGLE_EQUIP_ITEM', 'USE_ITEM', 'USE_ALL_ITEMS_OF_TYPE', 'ENHANCE_ITEM', 
                        'COMBINE_ITEMS', 'DISASSEMBLE_ITEM', 'CRAFT_MATERIAL', 'BUY_SHOP_ITEM', 
                        'BUY_CONSUMABLE', 'BUY_CONDITION_POTION', 'USE_CONDITION_POTION', 'UPDATE_AVATAR', 
                        'UPDATE_BORDER', 'CHANGE_NICKNAME', 'UPDATE_MBTI', 'ALLOCATE_STAT_POINT',
                        'SELL_ITEM', 'EXPAND_INVENTORY', 'BUY_BORDER', 'APPLY_PRESET', 'SAVE_PRESET',
                        'DELETE_MAIL', 'DELETE_ALL_CLAIMED_MAIL', 'CLAIM_MAIL_ATTACHMENTS', 
                        'CLAIM_ALL_MAIL_ATTACHMENTS', 'MARK_MAIL_AS_READ',
                        'CLAIM_QUEST_REWARD', 'CLAIM_ACTIVITY_MILESTONE',
                        'CLAIM_SINGLE_PLAYER_MISSION_REWARD', 'CLAIM_ALL_TRAINING_QUEST_REWARDS', 'LEVEL_UP_TRAINING_QUEST',
                        'SINGLE_PLAYER_REFRESH_PLACEMENT', 'TOWER_REFRESH_PLACEMENT',
                        'MANNER_ACTION',
                        'START_GUILD_BOSS_BATTLE',
                        'BUY_TOWER_ITEM',
                    ];
                    if (actionsThatShouldHaveUpdatedUser.includes(action.type)) {
                        console.warn(`[handleAction] ${action.type} - No updatedUser in response! Waiting for WebSocket update...`, {
                            hasClientResponse: !!result.clientResponse,
                            clientResponseKeys: result.clientResponse ? Object.keys(result.clientResponse) : [],
                            resultKeys: Object.keys(result)
                        });
                        // updatedUser가 없어도 액션 타입을 기록하여 WebSocket 업데이트를 받을 수 있도록 함
                        // 타임스탬프는 설정하지 않아서 WebSocket 업데이트가 즉시 적용되도록 함
                        lastHttpActionType.current = action.type;
                        // updatedUser가 없으면 WebSocket 업데이트를 기다리되, 타임아웃을 설정하여 일정 시간 후 강제 업데이트
                        // WebSocket USER_UPDATE가 곧 도착할 것이므로 별도 처리 불필요
                        // 하지만 WebSocket 업데이트가 오지 않으면 문제가 될 수 있으므로, 짧은 시간 후 WebSocket 무시 시간을 줄임
                        setTimeout(() => {
                            // WebSocket 업데이트가 오지 않았으면 무시 시간을 줄여서 다음 WebSocket 업데이트를 받을 수 있도록 함
                            const timeSinceLastHttpUpdate = Date.now() - lastHttpUpdateTime.current;
                            if (timeSinceLastHttpUpdate > HTTP_UPDATE_DEBOUNCE_MS || lastHttpUpdateTime.current === 0) {
                                console.warn(`[handleAction] ${action.type} - WebSocket update not received, reducing debounce window`);
                                // 다음 WebSocket 업데이트를 받을 수 있도록 타임스탬프 조정
                                lastHttpUpdateTime.current = Date.now() - HTTP_UPDATE_DEBOUNCE_MS;
                            }
                        }, 500);
                     }
                 }
                 
                 // 변경권 사용 시 대장간 제련 탭으로 이동
                 if (action.type === 'USE_ITEM' && result.clientResponse?.openBlacksmithRefineTab) {
                     setIsInventoryOpen(false);
                     setIsBlacksmithModalOpen(true);
                     setBlacksmithActiveTab('refine');
                     // 선택된 아이템이 있으면 해당 아이템 선택
                     if (result.clientResponse?.selectedItemId && currentUser) {
                         const selectedItem = currentUser.inventory.find(i => i.id === result.clientResponse.selectedItemId);
                         if (selectedItem && selectedItem.type === 'equipment') {
                             // BlacksmithModal에 전달할 수 있도록 상태 업데이트
                             // 실제로는 BlacksmithModal이 열릴 때 인벤토리에서 선택하도록 함
                         }
                     }
                 }
                 
                 // trainingQuestLevelUp 응답 처리 (강화 완료 피드백용)
                 const trainingQuestLevelUp = result.clientResponse?.trainingQuestLevelUp;
                 if (trainingQuestLevelUp && action.type === 'LEVEL_UP_TRAINING_QUEST') {
                     // TrainingQuestPanel에서 처리할 수 있도록 반환
                     return trainingQuestLevelUp;
                 }
                 
                const obtainedItemsBulk = result.clientResponse?.obtainedItemsBulk || result.obtainedItemsBulk;
                if (obtainedItemsBulk) {
                    const stampedItems = obtainedItemsBulk.map((item: any) => ({
                        ...item,
                        id: item.id || `reward-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        quantity: item.quantity ?? 1,
                    }));
                    setLastUsedItemResult(stampedItems);
                    
                    // USE_ITEM의 경우 obtainedItemsBulk가 있으면 result를 반환하여 모달에서 확인할 수 있도록 함
                    if (action.type === 'USE_ITEM') {
                        return result;
                    }
                }
                 const scoreChange = result.clientResponse?.tournamentScoreChange;
                 if (scoreChange) setTournamentScoreChange(scoreChange);
                
                 // 제련 결과 처리
                 if (action.type === 'REFINE_EQUIPMENT' && result.clientResponse?.refinementResult) {
                     setRefinementResult(result.clientResponse.refinementResult);
                 }
                
                 // 보상 수령 모달 처리 (즉시 표시를 위해 flushSync 사용)
                if (result.rewardSummary) {
                    flushSync(() => {
                        setRewardSummary(result.rewardSummary);
                    });
                } else if (result.clientResponse?.rewardSummary) {
                    flushSync(() => {
                        setRewardSummary(result.clientResponse.rewardSummary);
                    });
                } else if (action.type === 'CLAIM_SINGLE_PLAYER_MISSION_REWARD' && result.clientResponse?.reward) {
                    // 서버에서 rewardSummary가 없을 경우 fallback
                    const reward = result.clientResponse.reward;
                    flushSync(() => {
                        setRewardSummary({
                            reward: reward,
                            items: [],
                            title: '수련과제 보상 수령'
                        });
                    });
                }
                
                if (result.claimAllSummary) {
                    flushSync(() => {
                        setClaimAllSummary(result.claimAllSummary);
                        setIsClaimAllSummaryOpen(true);
                    });
                }
                
                // 수련 과제 일괄 수령 응답 처리
                const claimAllTrainingQuestRewards = result.clientResponse?.claimAllTrainingQuestRewards 
                    || result.claimAllTrainingQuestRewards;
                if (claimAllTrainingQuestRewards && action.type === 'CLAIM_ALL_TRAINING_QUEST_REWARDS') {
                    // TrainingQuestPanel에서 처리할 수 있도록 반환
                    return {
                        claimAllTrainingQuestRewards: claimAllTrainingQuestRewards
                    };
                }
                const disassemblyResult = result.clientResponse?.disassemblyResult || result.disassemblyResult;
                if (disassemblyResult) { 
                    setDisassemblyResult(disassemblyResult);
                    if (disassemblyResult.jackpot) audioService.disassemblyJackpot();
                }
                const craftResult = result.clientResponse?.craftResult || result.craftResult;
                if (craftResult) {
                    console.log(`[handleAction] ${action.type} - Setting craftResult:`, {
                        craftResult,
                        hasCraftResult: !!craftResult,
                        gained: craftResult.gained,
                        used: craftResult.used,
                        craftType: craftResult.craftType,
                        jackpot: craftResult.jackpot
                    });
                    // 상태 업데이트를 즉시 동기적으로 처리하여 결과 모달이 확실히 표시되도록 함
                    flushSync(() => {
                        setCraftResult(craftResult);
                    });
                    // 대박 발생 시 사운드 재생
                    if (craftResult.jackpot) {
                        audioService.disassemblyJackpot();
                    }
                    // 추가 디버깅: 상태가 설정되었는지 확인
                    console.log(`[handleAction] ${action.type} - craftResult state set, should trigger modal`);
                } else {
                    // craftResult가 없는 것은 정상입니다 (일부 액션만 craftResult를 반환)
                    // 경고는 craftResult를 반환해야 하는 액션에서만 표시
                    const actionsThatShouldHaveCraftResult = ['CRAFT_MATERIAL', 'CONVERT_MATERIAL'];
                    if (actionsThatShouldHaveCraftResult.includes(action.type)) {
                        console.warn(`[handleAction] ${action.type} - No craftResult in response!`, {
                            hasClientResponse: !!result.clientResponse,
                            hasCraftResult: !!result.craftResult,
                            clientResponseKeys: result.clientResponse ? Object.keys(result.clientResponse) : [],
                            resultKeys: Object.keys(result)
                        });
                    }
                }
                const combinationResult = result.clientResponse?.combinationResult || result.combinationResult;
                if (combinationResult) {
                    setCombinationResult(combinationResult);
                    if (combinationResult.isGreatSuccess) {
                        audioService.combinationGreatSuccess(); // Assuming this sound exists
                    } else {
                        audioService.combinationSuccess(); // Assuming this sound exists
                    }
                }
                // 랭킹전 매칭 시작 응답 처리
                if (action.type === 'START_RANKED_MATCHING' && result.clientResponse?.success) {
                    const matchingInfo = result.clientResponse.matchingInfo;
                    if (matchingInfo) {
                        console.log('[handleAction] START_RANKED_MATCHING - Matching started:', matchingInfo);
                        // 매칭 정보를 반환하여 컴포넌트에서 즉시 상태 업데이트 가능하도록 함
                        return { matchingInfo } as HandleActionResult;
                    }
                }
                
                const enhancementOutcome = result.clientResponse?.enhancementOutcome || result.enhancementOutcome;
                if (enhancementOutcome) {
                    const { message, success, itemBefore, itemAfter, xpGained } = enhancementOutcome;
                    setEnhancementResult({ message, success });
                    // 서버 응답이 오면 롤링 애니메이션을 종료하고 실제 결과를 표시
                    setEnhancementOutcome({ message, success, itemBefore, itemAfter, xpGained, isRolling: false });
                    setIsEnhancementResultModalOpen(true);
                    const enhancementAnimationTarget = result.clientResponse?.enhancementAnimationTarget || result.enhancementAnimationTarget;
                    if (enhancementAnimationTarget) {
                        setEnhancementAnimationTarget(enhancementAnimationTarget);
                    }
                    if (success) {
                        audioService.enhancementSuccess();
                    } else {
                        audioService.enhancementFail();
                    }
                }
                if (result.enhancementAnimationTarget) setEnhancementAnimationTarget(result.enhancementAnimationTarget);
                const redirectToTournament = result.clientResponse?.redirectToTournament || result.redirectToTournament;
                if (redirectToTournament) {
                    if (action.type !== 'USE_CONDITION_POTION' && action.type !== 'BUY_CONDITION_POTION') {
                        const targetHash = `#/tournament/${redirectToTournament}`;
                        if (window.location.hash !== targetHash) {
                            console.log(`[handleAction] ${action.type} - Redirecting to tournament:`, redirectToTournament);
                            setTimeout(() => {
                                navigateFromGameIfApplicable(targetHash);
                            }, 200);
                                } else {
                            console.log(`[handleAction] ${action.type} - Already at ${targetHash}, skipping redirect`);
                        }
                    } else {
                        console.log(`[handleAction] ${action.type} - Skipping redirect (already in tournament)`);
                    }
                }
                
                // 비상탈출 등에서 사용하는 일반 redirectTo 처리
                const redirectTo = result.clientResponse?.redirectTo;
                if (redirectTo) {
                    if (window.location.hash !== redirectTo) {
                        console.log(`[handleAction] ${action.type} - Redirecting to:`, redirectTo);
                        setTimeout(() => {
                            navigateFromGameIfApplicable(redirectTo);
                        }, 200);
                    } else {
                        console.log(`[handleAction] ${action.type} - Already at ${redirectTo}, skipping redirect`);
                    }
                }
                // 거절 메시지 표시
                if (result.declinedMessage) {
                    showError(result.declinedMessage.message);
                }
                
                // ACCEPT_NEGOTIATION, START_AI_GAME, START_SINGLE_PLAYER_GAME, START_TOWER_GAME,
                // CONFIRM_TOWER_GAME_START, CONFIRM_SINGLE_PLAYER_GAME_START, CONFIRM_AI_GAME_START 후 게임이 생성되었거나 업데이트되었을 때 처리
                // 서버 응답 구조: { success: true, ...result.clientResponse }
                // 따라서 result.gameId 또는 result.clientResponse?.gameId 둘 다 확인
                const gameId = (result as any).gameId || result.clientResponse?.gameId;
                const game = (result as any).game || result.clientResponse?.game;
                
                // CONFIRM_TOWER_GAME_START, CONFIRM_AI_GAME_START의 경우 gameId가 없어도 payload에서 가져올 수 있음
                // SINGLE_PLAYER_REFRESH_PLACEMENT는 서버가 gameId를 넣지 않고 game만 반환하므로 payload에서 gameId 사용
                let effectiveGameId = gameId;
                if (!effectiveGameId && (action.type === 'CONFIRM_TOWER_GAME_START' || action.type === 'CONFIRM_SINGLE_PLAYER_GAME_START' || action.type === 'CONFIRM_AI_GAME_START')) {
                    effectiveGameId = (action.payload as any)?.gameId;
                    console.log(`[handleAction] ${action.type} - gameId not in response, using payload gameId:`, effectiveGameId);
                }
                if (!effectiveGameId && (action.type === 'SINGLE_PLAYER_REFRESH_PLACEMENT' && game)) {
                    effectiveGameId = (action.payload as any)?.gameId || (game as any)?.id;
                    console.log(`[handleAction] ${action.type} - using payload/game gameId:`, effectiveGameId);
                }
                if (!effectiveGameId && (action.type === 'RESIGN_GAME' && game)) {
                    effectiveGameId = (action.payload as any)?.gameId || (game as any)?.id;
                    console.log(`[handleAction] ${action.type} - using payload/game gameId:`, effectiveGameId);
                }
                if (!effectiveGameId && (action.type === 'TOWER_REFRESH_PLACEMENT' && game)) {
                    effectiveGameId = (action.payload as any)?.gameId || (game as any)?.id;
                    console.log(`[handleAction] ${action.type} - using payload/game gameId:`, effectiveGameId);
                }
                if (!effectiveGameId && action.type === 'TOWER_ADD_TURNS') {
                    effectiveGameId =
                        ('payload' in action ? (action as { payload?: { gameId?: string } }).payload?.gameId : undefined) ||
                        (game as any)?.id;
                }
                if (!effectiveGameId && (action.type === 'START_SCANNING' || action.type === 'START_HIDDEN_PLACEMENT' || action.type === 'SCAN_BOARD')) {
                    effectiveGameId =
                        ('payload' in action ? (action as { payload?: { gameId?: string } }).payload?.gameId : undefined) ||
                        (game as any)?.id;
                }
                if (!effectiveGameId && action.type === 'BUY_TOWER_ITEM') {
                    effectiveGameId =
                        ('payload' in action ? (action as { payload?: { gameId?: string } }).payload?.gameId : undefined) ||
                        (game as any)?.id;
                }
                
                // END_TOWER_GAME / END_SINGLE_PLAYER_GAME / RESIGN_GAME 액션 처리 (서버 응답 병합 시 클라이언트 바둑판 상태 유지)
                if (action.type === 'END_TOWER_GAME' || (action as ServerAction).type === 'END_SINGLE_PLAYER_GAME' || action.type === 'RESIGN_GAME') {
                    const endGameId =
                        ('payload' in action ? (action as { payload?: { gameId?: string } }).payload?.gameId : undefined) ||
                        gameId ||
                        (game as any)?.id;
                    const endGame = game || (result.clientResponse?.game);
                    
                    if (endGameId && endGame) {
                        console.log(`[handleAction] ${action.type} - Updating game with winner:`, { gameId: endGameId, winner: endGame.winner, gameStatus: endGame.gameStatus });
                        
                        const preserveBoardFromExisting = (existing: typeof endGame, next: typeof endGame) => {
                            const merged = { ...existing, ...next };
                            const hasValidBoard = existing?.boardState && Array.isArray(existing.boardState) && existing.boardState.length > 0;
                            if (hasValidBoard) {
                                merged.boardState = existing.boardState;
                                if (existing.moveHistory?.length) merged.moveHistory = existing.moveHistory;
                                if (existing.blackPatternStones?.length) merged.blackPatternStones = existing.blackPatternStones;
                                if (existing.whitePatternStones?.length) merged.whitePatternStones = existing.whitePatternStones;
                            }
                            return merged;
                        };

                        if (endGame.gameCategory === 'tower') {
                            setTowerGames(currentGames => {
                                const existingGame = currentGames[endGameId];
                                if (endGame.winner !== null && endGame.winner !== undefined) {
                                    return { ...currentGames, [endGameId]: preserveBoardFromExisting(existingGame ?? endGame, endGame) };
                                }
                                return currentGames;
                            });
                        } else if (endGame.isSinglePlayer) {
                            setSinglePlayerGames(currentGames => {
                                const existingGame = currentGames[endGameId];
                                if (endGame.winner !== null && endGame.winner !== undefined) {
                                    return { ...currentGames, [endGameId]: preserveBoardFromExisting(existingGame ?? endGame, endGame) };
                                }
                                return currentGames;
                            });
                        }
                    }
                }
                
                // 주사위/도둑 착수: 한 개 놓을 때마다 화면에 바로 반영 (HTTP 응답 game으로 liveGames 갱신)
                const placementGameId = (action.type === 'DICE_PLACE_STONE' || action.type === 'THIEF_PLACE_STONE') ? ((action.payload as any)?.gameId || game?.id) : null;
                if (game && placementGameId && (action.type === 'DICE_PLACE_STONE' || action.type === 'THIEF_PLACE_STONE') && !game.isSinglePlayer && game.gameCategory !== 'tower') {
                    const cloneBoard = (g: typeof game) =>
                        g.boardState && Array.isArray(g.boardState) ? g.boardState.map((row: number[]) => [...row]) : g.boardState;
                    if (action.type === 'DICE_PLACE_STONE') {
                        let appliedDicePlaceMerge = false;
                        setLiveGames((currentGames) => {
                            const existing = currentGames[placementGameId];
                            if (!game) return currentGames;
                            if (!existing) {
                                appliedDicePlaceMerge = true;
                                return { ...currentGames, [placementGameId]: { ...game, boardState: cloneBoard(game) } };
                            }
                            const srvRev = game.serverRevision ?? 0;
                            const locRev = existing.serverRevision ?? 0;
                            const srvMoves = game.moveHistory?.length ?? 0;
                            const locMoves = existing.moveHistory?.length ?? 0;
                            const bothPlacing = existing.gameStatus === 'dice_placing' && game.gameStatus === 'dice_placing';
                            // 빠른 연속 착수 시 이전 HTTP 응답이 늦게 도착하면 낙관적 수순이 덮여 돌이 사라진 것처럼 보임 → 낡은 응답 무시
                            if (srvRev < locRev || (bothPlacing && srvMoves < locMoves)) {
                                return currentGames;
                            }
                            appliedDicePlaceMerge = true;
                            return {
                                ...currentGames,
                                [placementGameId]: {
                                    ...existing,
                                    ...game,
                                    boardState: cloneBoard(game),
                                },
                            };
                        });
                        if (appliedDicePlaceMerge) {
                            delete pvpDicePlaceRevertRef.current[placementGameId];
                        }
                    } else {
                        setLiveGames((currentGames) => {
                            const existing = currentGames[placementGameId];
                            const next = existing
                                ? { ...existing, ...game, boardState: cloneBoard(game) }
                                : { ...game, boardState: cloneBoard(game) };
                            return { ...currentGames, [placementGameId]: next };
                        });
                    }
                }
                // 주사위 굴리기: HTTP 응답에 game 있으면 즉시 반영 (두 번째 턴부터 굴리기 애니가 안 나오는 버그 방지)
                const rollGameId = (action.type === 'DICE_ROLL') ? ((action.payload as any)?.gameId || game?.id) : null;
                if (game && rollGameId && action.type === 'DICE_ROLL' && !game.isSinglePlayer && game.gameCategory !== 'tower') {
                    setLiveGames(currentGames => {
                        const existing = currentGames[rollGameId];
                        const next = existing ? { ...existing, ...game, boardState: game.boardState && Array.isArray(game.boardState) ? game.boardState.map((row: number[]) => [...row]) : game.boardState } : game;
                        return { ...currentGames, [rollGameId]: next };
                    });
                }
                if (
                    effectiveGameId &&
                    (action.type === 'ACCEPT_NEGOTIATION' ||
                        action.type === 'START_AI_GAME' ||
                        action.type === 'START_ADVENTURE_MONSTER_BATTLE' ||
                        action.type === 'START_SINGLE_PLAYER_GAME' ||
                        action.type === 'START_TOWER_GAME' ||
                        action.type === 'CONFIRM_TOWER_GAME_START' ||
                        action.type === 'CONFIRM_SINGLE_PLAYER_GAME_START' ||
                        action.type === 'CONFIRM_AI_GAME_START' ||
                        action.type === 'SINGLE_PLAYER_REFRESH_PLACEMENT' ||
                        action.type === 'TOWER_REFRESH_PLACEMENT' ||
                        action.type === 'TOWER_ADD_TURNS' ||
                        action.type === 'START_SCANNING' ||
                        action.type === 'START_HIDDEN_PLACEMENT' ||
                        action.type === 'SCAN_BOARD' ||
                        (action.type === 'BUY_TOWER_ITEM' && !!game))
                ) {
                    console.log(`[handleAction] ${action.type} - gameId received:`, effectiveGameId, 'hasGame:', !!game, 'result keys:', Object.keys(result), 'clientResponse keys:', result.clientResponse ? Object.keys(result.clientResponse) : []);
                    
                    // 응답에 게임 데이터가 있으면 즉시 상태에 추가 (WebSocket 업데이트를 기다리지 않음)
                    if (game) {
                        console.log(`[handleAction] ${action.type} - Game object found in response:`, { gameId: game.id, gameStatus: game.gameStatus, gameCategory: game.gameCategory, isSinglePlayer: game.isSinglePlayer });
                        const isTowerGame = game.gameCategory === 'tower';
                        console.log('[handleAction] Adding game to state immediately:', effectiveGameId, 'isSinglePlayer:', game.isSinglePlayer, 'gameCategory:', game.gameCategory, 'isTower:', isTowerGame);
                        
                        // 게임 카테고리 확인
                        if (game.isSinglePlayer) {
                            // 배치변경 시 sessionStorage의 이전 보드를 제거해 Game.tsx가 서버의 새 boardState를 사용하도록 함
                            if (action.type === 'SINGLE_PLAYER_REFRESH_PLACEMENT') {
                                try {
                                    sessionStorage.removeItem(`gameState_${effectiveGameId}`);
                                } catch (_) { /* ignore */ }
                            }
                            setSinglePlayerGames(currentGames => {
                                const shouldUpdate = action.type === 'CONFIRM_SINGLE_PLAYER_GAME_START' || action.type === 'SINGLE_PLAYER_REFRESH_PLACEMENT' || action.type === 'START_SCANNING' || action.type === 'START_HIDDEN_PLACEMENT' || action.type === 'SCAN_BOARD' || action.type === 'START_SINGLE_PLAYER_GAME' || !currentGames[effectiveGameId];
                                if (shouldUpdate) {
                                    const isRefresh = action.type === 'SINGLE_PLAYER_REFRESH_PLACEMENT';
                                    const nextGame = isRefresh && game.boardState
                                        ? { ...game, boardState: (game.boardState as any[][]).map(row => [...row]), blackPatternStones: Array.isArray(game.blackPatternStones) ? [...game.blackPatternStones] : game.blackPatternStones, whitePatternStones: Array.isArray(game.whitePatternStones) ? [...game.whitePatternStones] : game.whitePatternStones }
                                        : game;
                                    if (action.type === 'START_SINGLE_PLAYER_GAME') {
                                        for (const id of Object.keys(currentGames)) {
                                            if (id !== effectiveGameId) {
                                                try {
                                                    sessionStorage.removeItem(`gameState_${id}`);
                                                } catch {
                                                    /* ignore */
                                                }
                                            }
                                        }
                                        return { [effectiveGameId]: nextGame };
                                    }
                                    return { ...currentGames, [effectiveGameId]: nextGame };
                                }
                                return currentGames;
                            });
                        } else if (isTowerGame) {
                            setTowerGames(currentGames => {
                                // CONFIRM·배치변경·턴 추가·스캔/히든 아이템 사용 시 게임 상태가 바뀌었으므로 업데이트
                                if (
                                    action.type === 'CONFIRM_TOWER_GAME_START' ||
                                    action.type === 'TOWER_REFRESH_PLACEMENT' ||
                                    action.type === 'TOWER_ADD_TURNS' ||
                                    action.type === 'START_SCANNING' ||
                                    action.type === 'START_HIDDEN_PLACEMENT' ||
                                    action.type === 'SCAN_BOARD' ||
                                    action.type === 'START_TOWER_GAME' ||
                                    action.type === 'BUY_TOWER_ITEM' ||
                                    !currentGames[effectiveGameId]
                                ) {
                                    console.log('[handleAction] Updating tower game:', effectiveGameId, 'gameStatus:', game.gameStatus, 'action type:', action.type, 'existing game status:', currentGames[effectiveGameId]?.gameStatus);
                                    const isRefresh = action.type === 'TOWER_REFRESH_PLACEMENT';
                                    let nextGame = isRefresh && game.boardState
                                        ? { ...game, boardState: (game.boardState as any[][]).map(row => [...row]), blackPatternStones: Array.isArray(game.blackPatternStones) ? [...game.blackPatternStones] : game.blackPatternStones, whitePatternStones: Array.isArray(game.whitePatternStones) ? [...game.whitePatternStones] : game.whitePatternStones }
                                        : game;
                                    const existingTower = currentGames[effectiveGameId];
                                    if (
                                        existingTower &&
                                        (action.type === 'START_HIDDEN_PLACEMENT' ||
                                            action.type === 'START_SCANNING' ||
                                            action.type === 'SCAN_BOARD' ||
                                            action.type === 'TOWER_ADD_TURNS' ||
                                            action.type === 'BUY_TOWER_ITEM')
                                    ) {
                                        nextGame = mergeTowerServerGameWithClientBoardIfStale(nextGame, existingTower);
                                    }
                                    if (action.type === 'START_TOWER_GAME') {
                                        for (const id of Object.keys(currentGames)) {
                                            if (id !== effectiveGameId) {
                                                try {
                                                    sessionStorage.removeItem(`gameState_${id}`);
                                                } catch {
                                                    /* ignore */
                                                }
                                            }
                                        }
                                        return { [effectiveGameId]: nextGame };
                                    }
                                    return { ...currentGames, [effectiveGameId]: nextGame };
                                }
                                return currentGames;
                            });
                        } else {
                            setLiveGames(currentGames => {
                                // CONFIRM_AI_GAME_START는 pending -> 실제 시작으로 상태가 바뀌므로 항상 업데이트
                                if (action.type === 'CONFIRM_AI_GAME_START') {
                                    return { ...currentGames, [effectiveGameId]: { ...currentGames[effectiveGameId], ...game } };
                                }
                                if (currentGames[gameId]) {
                                    return currentGames;
                                }
                                return { ...currentGames, [gameId]: game };
                            });
                        }
                        
                        // 사용자 상태도 즉시 업데이트 (gameId와 status를 'in-game'으로 설정)
                        // currentUserWithStatus는 onlineUsers에서 가져오므로, onlineUsers를 업데이트하면 자동으로 반영됨
                        if (currentUser?.id) {
                            setOnlineUsers(prevUsers => {
                                const userIndex = prevUsers.findIndex(u => u.id === currentUser.id);
                                if (userIndex >= 0) {
                                    const updatedUsers = [...prevUsers];
                                    updatedUsers[userIndex] = {
                                        ...updatedUsers[userIndex],
                                        gameId: effectiveGameId,
                                        status: UserStatus.InGame,
                                        mode: game.mode
                                    };
                                    console.log('[handleAction] Updated user status in onlineUsers:', {
                                        userId: currentUser.id,
                                        gameId: effectiveGameId,
                                        status: 'in-game',
                                        mode: game.mode
                                    });
                                    return updatedUsers;
                                } else {
                                    // 사용자가 onlineUsers에 없으면 추가
                                    const newUser: UserWithStatus = {
                                        ...currentUser,
                                        status: UserStatus.InGame,
                                        gameId: effectiveGameId,
                                        mode: game.mode
                                    };
                                    console.log('[handleAction] Added user to onlineUsers:', newUser);
                                    return [...prevUsers, newUser];
                                }
                            });
                        }
                    }
                    
                    // CONFIRM_TOWER_GAME_START의 경우 게임 객체가 없어도 WebSocket GAME_UPDATE를 기다림
                    // 하지만 게임이 이미 towerGames에 있으면 상태를 업데이트해야 함
                    if (!game && effectiveGameId && (action.type === 'CONFIRM_TOWER_GAME_START' || action.type === 'CONFIRM_SINGLE_PLAYER_GAME_START')) {
                        console.log(`[handleAction] ${action.type} - No game in response, checking existing games for gameId:`, effectiveGameId);
                        
                        // 기존 게임 상태 확인
                        const existingTowerGame = towerGames[effectiveGameId];
                        const existingSinglePlayerGame = singlePlayerGames[effectiveGameId];
                        const existingGame = existingTowerGame || existingSinglePlayerGame;
                        
                        if (existingGame) {
                            console.log(`[handleAction] ${action.type} - Found existing game, updating status to playing:`, { gameId: effectiveGameId, currentStatus: existingGame.gameStatus });
                            
                            // 게임 상태를 playing으로 업데이트 (WebSocket 업데이트를 기다리지 않고 즉시)
                            if (existingTowerGame) {
                                setTowerGames(currentGames => {
                                    const updatedGame = { ...currentGames[effectiveGameId], gameStatus: 'playing' as const, startTime: Date.now() };
                                    return { ...currentGames, [effectiveGameId]: updatedGame };
                                });
                            } else if (existingSinglePlayerGame) {
                                setSinglePlayerGames(currentGames => {
                                    const updatedGame = { ...currentGames[effectiveGameId], gameStatus: 'playing' as const, startTime: Date.now() };
                                    return { ...currentGames, [effectiveGameId]: updatedGame };
                                });
                            }
                        } else {
                            console.log(`[handleAction] ${action.type} - Game not found in state, will wait for GAME_UPDATE WebSocket message`);
                        }
                    }
                    
                    // 즉시 라우팅 업데이트 (게임이 생성되었으므로)
                    // 게임 데이터가 있으면 즉시 라우팅, 없어도 gameId가 있으면 즉시 라우팅
                    const targetHash = `#/game/${effectiveGameId}`;
                    if (window.location.hash !== targetHash) {
                        console.log('[handleAction] Setting immediate route to new game:', targetHash, 'hasGame:', !!game);
                        // AI 게임: state 반영 전 리다이렉트 방지를 위해 유예 시간 설정
                        // START_AI_GAME(대기실→규칙설명), CONFIRM_AI_GAME_START(경기시작→경기장) 모두 적용
                        if (action.type === 'START_AI_GAME' || action.type === 'START_ADVENTURE_MONSTER_BATTLE' || action.type === 'CONFIRM_AI_GAME_START') {
                            pendingAiGameEntryRef.current = {
                                gameId: effectiveGameId,
                                until: Date.now() + 3000,
                                ...(action.type === 'CONFIRM_AI_GAME_START' && game ? { game: game as LiveGameSession } : {}),
                            };
                        }
                        // 즉시 라우팅 (지연 제거)
                        window.location.hash = targetHash;
                    }
                    
                    // gameId를 반환하여 컴포넌트에서 사용할 수 있도록 함
                    return { gameId: effectiveGameId };
                } else if (action.type === 'START_TOWER_GAME') {
                    // START_TOWER_GAME의 경우 gameId를 다시 확인 (다른 경로에서 올 수 있음)
                    const towerGameId = (result as any).gameId || result.clientResponse?.gameId;
                    const towerGame = (result as any).game || result.clientResponse?.game;
                    if (towerGameId) {
                        const targetHash = `#/game/${towerGameId}`;
                        console.log('[handleAction] START_TOWER_GAME - gameId found, routing to:', targetHash, 'hasGame:', !!towerGame);
                        
                        // 게임 객체가 있으면 즉시 상태에 추가
                        if (towerGame) {
                            setTowerGames(currentGames => {
                                for (const id of Object.keys(currentGames)) {
                                    if (id !== towerGameId) {
                                        try {
                                            sessionStorage.removeItem(`gameState_${id}`);
                                        } catch {
                                            /* ignore */
                                        }
                                    }
                                }
                                return { [towerGameId]: towerGame };
                            });
                        }
                        
                        // 즉시 라우팅 (지연 제거)
                        if (window.location.hash !== targetHash) {
                            window.location.hash = targetHash;
                        }
                        return { gameId: towerGameId };
                    } else {
                        console.warn('[handleAction] START_TOWER_GAME - No gameId found in response:', {
                            resultKeys: Object.keys(result),
                            hasClientResponse: !!result.clientResponse,
                            clientResponseKeys: result.clientResponse ? Object.keys(result.clientResponse) : []
                        });
                    }
                }
                
                // Handle guild creation response
                if (action.type === 'CREATE_GUILD') {
                    console.log(`[handleAction] CREATE_GUILD - Processing response:`, {
                        hasResult: !!result,
                        hasSuccess: result?.success,
                        hasGuild: !!result?.guild,
                        hasClientResponse: !!result?.clientResponse,
                        hasClientResponseGuild: !!result?.clientResponse?.guild,
                        resultKeys: result ? Object.keys(result) : [],
                        clientResponseKeys: result?.clientResponse ? Object.keys(result.clientResponse) : []
                    });
                    // Server returns { success: true, ...result.clientResponse }
                    // So result.guild or result.clientResponse?.guild should work
                    const guild = result?.guild || result?.clientResponse?.guild;
                    if (guild) {
                        console.log(`[handleAction] CREATE_GUILD - Guild found:`, guild);
                        setGuilds(prev => ({ ...prev, [guild.id]: guild }));
                        // Return result in the format expected by modal
                        return { clientResponse: { guild, updatedUser: result?.updatedUser || result?.clientResponse?.updatedUser } } as HandleActionResult;
                    }
                }
                
                // Handle guild list response
                if (action.type === 'LIST_GUILDS') {
                    console.log(`[handleAction] LIST_GUILDS - Processing response:`, {
                        hasResult: !!result,
                        hasClientResponse: !!result?.clientResponse,
                        hasGuilds: !!result?.clientResponse?.guilds,
                        hasGuildsDirect: !!result?.guilds,
                        guildsLength: result?.clientResponse?.guilds?.length || result?.guilds?.length,
                        resultKeys: result ? Object.keys(result) : [],
                        clientResponseKeys: result?.clientResponse ? Object.keys(result.clientResponse) : [],
                        fullResult: result
                    });
                    
                    // 서버 응답 구조: { success: true, guilds: [...], total: ... } 또는 { clientResponse: { guilds: [...] } }
                    const guildsList = result?.guilds || result?.clientResponse?.guilds;
                    if (Array.isArray(guildsList)) {
                        console.log(`[handleAction] LIST_GUILDS - Found ${guildsList.length} guild(s) in response`);
                        const guildsMap: Record<string, Guild> = {};
                        guildsList.forEach((g: any) => {
                            if (g && g.id) guildsMap[g.id] = g;
                        });
                        setGuilds(prev => ({ ...prev, ...guildsMap }));
                    }
                    
                    // LIST_GUILDS의 경우 항상 result를 반환 (guilds가 없어도 빈 배열로 반환)
                    // 서버 응답 구조에 맞춰 clientResponse로 래핑하여 반환
                    const responseToReturn = result || { guilds: [] };
                    // clientResponse 구조로 정규화
                    if (!responseToReturn.clientResponse && responseToReturn.guilds) {
                        responseToReturn.clientResponse = { guilds: responseToReturn.guilds };
                    }
                    console.log(`[handleAction] LIST_GUILDS - Returning result to component:`, {
                        hasResult: !!responseToReturn,
                        hasGuilds: !!responseToReturn.clientResponse?.guilds,
                        guildsLength: responseToReturn.clientResponse?.guilds?.length
                    });
                    return responseToReturn;
                }
                
                // Handle JOIN_GUILD response (자유가입 성공 시 즉시 상태 반영 - 모달 닫고 길드 홈 이동 전)
                if (action.type === 'JOIN_GUILD' && result?.clientResponse?.guild) {
                    const guild = result.clientResponse.guild;
                    const updatedUser = result.clientResponse.updatedUser;
                    flushSync(() => {
                        if (guild?.id) {
                            setGuilds(prev => ({ ...prev, [guild.id]: guild }));
                        }
                        if (updatedUser) {
                            applyUserUpdate(updatedUser, 'JOIN_GUILD');
                        }
                    });
                }
                
                // Handle LEAVE_GUILD / GUILD_LEAVE response
                if ((action.type === 'LEAVE_GUILD' || action.type === 'GUILD_LEAVE') && !result?.error) {
                    // 탈퇴 성공 시 길드 정보 제거
                    const guildId = (action.payload as any)?.guildId || currentUser?.guildId;
                    if (guildId) {
                        setGuilds(prev => {
                            const updated = { ...prev };
                            delete updated[guildId];
                            return updated;
                        });
                    }
                    // updatedUser가 있으면 사용자 상태 업데이트 (guildId 제거됨)
                    // flushSync를 사용하여 즉시 상태 업데이트
                    const updatedUser = result?.clientResponse?.updatedUser || result?.updatedUser;
                    if (updatedUser) {
                        flushSync(() => {
                            applyUserUpdate(updatedUser, 'LEAVE_GUILD');
                        });
                    } else {
                        // updatedUser가 없으면 현재 사용자의 guildId를 제거
                        if (currentUser) {
                            flushSync(() => {
                                applyUserUpdate({ ...currentUser, guildId: undefined }, 'LEAVE_GUILD');
                            });
                        }
                    }
                }
                
                // Handle GET_GUILD_INFO response
                if (action.type === 'GET_GUILD_INFO' && result?.clientResponse?.guild) {
                    const guild = result.clientResponse.guild;
                    if (guild && guild.id) {
                        const members = Array.isArray(guild.members) ? guild.members : [];
                        const guildToStore = { ...guild, members };
                        if (process.env.NODE_ENV === 'development' && members.length === 0) {
                            console.warn('[useApp] GET_GUILD_INFO - Guild has no members:', { guildId: guild.id, guildName: guild.name });
                        }
                        setGuilds(prev => ({ ...prev, [guild.id]: guildToStore }));
                    } else {
                        console.warn('[useApp] GET_GUILD_INFO - Guild data invalid:', {
                            hasGuild: !!result?.clientResponse?.guild,
                            guildId: result?.clientResponse?.guild?.id,
                            guildName: result?.clientResponse?.guild?.name
                        });
                    }
                }
                
                // Handle other guild responses that might include guilds
                // GET_GUILD_WAR_DATA도 guilds 병합 (guildWarMatching 등 매칭 상태 동기화 - broadcast 누락 시 대비)
                // API 응답은 { success: true, ...clientResponse } 형태라 result.guilds / result.clientResponse.guilds 둘 다 확인
                const guildsFromResponse = result?.guilds ?? result?.clientResponse?.guilds;
                if (guildsFromResponse && typeof guildsFromResponse === 'object') {
                    if (action.type === 'START_GUILD_BOSS_BATTLE') {
                        // 보스전 직후 길드홈으로 돌아갔을 때 나의 기록이 갱신되도록 동기 반영
                        flushSync(() => {
                            setGuilds(prev => ({ ...prev, ...guildsFromResponse }));
                        });
                    } else {
                        setGuilds(prev => ({ ...prev, ...guildsFromResponse }));
                    }
                }
                
                // Return result for actions that need it (preserve original structure)
                // Include donationResult and other specific response fields
                // LIST_GUILDS는 이미 위에서 반환되므로 여기서는 제외
                if ((action as ServerAction).type !== 'LIST_GUILDS' && result && (
                    result.clientResponse || 
                    result.guild || 
                    result.gameId ||
                    result.donationResult ||
                    result.clientResponse?.donationResult ||
                    result.guilds ||
                    /** `/api/action` 평탄화: `clientResponse` 키 없이 최상위에만 오는 필드 (예: 보물상자 PREPARE/CONFIRM) */
                    (result as any).adventureTreasurePick ||
                    (result as any).grantedTreasureRolls != null ||
                    ((action as ServerAction).type === 'ABANDON_ADVENTURE_MAP_TREASURE_PICK' &&
                        !!(result.updatedUser || (result as any).clientResponse?.updatedUser)) ||
                    /** `/api/action` 성공 응답이 `{ success, ...clientResponse }`로 평탄화되어 `clientResponse` 키가 없는 관리자 액션 */
                    ((action as ServerAction).type.startsWith('ADMIN_') && result.success === true)
                )) {
                    return result;
                }
                
                // LIST_GUILDS가 위에서 반환되지 않은 경우 (예: result가 undefined인 경우)
                if ((action as ServerAction).type === 'LIST_GUILDS') {
                    console.warn(`[handleAction] LIST_GUILDS - result was not returned earlier, returning empty array`);
                    return { clientResponse: { guilds: [] } };
                }
            }
        } catch (err: any) {
            if (action.type === 'DICE_PLACE_STONE') {
                const gid = (action.payload as { gameId?: string })?.gameId;
                if (gid) {
                    const snap = pvpDicePlaceRevertRef.current[gid];
                    if (snap) {
                        setLiveGames((c) => (c[gid] ? { ...c, [gid]: snap } : c));
                        delete pvpDicePlaceRevertRef.current[gid];
                    }
                    delete pvpDicePlaceInFlightRef.current[gid];
                }
            }
            rollbackTowerAddTurnOptimistic();
            console.error(`[handleAction] ${action.type} - Exception:`, err);
            console.error(`[handleAction] Error stack:`, err.stack);
            showError(err.message || '요청 처리 중 오류가 발생했습니다.');
        } finally {
            if (dicePlaceGameId) {
                const gid = dicePlaceGameId;
                const n = (pvpDicePlaceInFlightRef.current[gid] || 1) - 1;
                if (n <= 0) delete pvpDicePlaceInFlightRef.current[gid];
                else pvpDicePlaceInFlightRef.current[gid] = n;
            }
        }
    }, [currentUser?.id, applyOptimisticTowerClearOnBlackWin]);

    const handleLogout = useCallback(async () => {
        if (!currentUser) return;
        isLoggingOut.current = true;
        
        const userId = currentUser.id; // 현재 사용자 ID 저장
        
        // 로그아웃 액션을 먼저 전송 (비동기 처리)
        try {
            // currentUser가 null이 되기 전에 userId를 직접 사용
            const res = await fetch(getApiUrl('/api/action'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ type: 'LOGOUT', userId }),
            });
            
            if (res.ok) {
                const result = await res.json();
                if (result.error) {
                    console.error('[handleLogout] Server error:', result.error);
                }
            } else {
                console.error('[handleLogout] HTTP error:', res.status);
            }
        } catch (error) {
            console.error('[handleLogout] Error during logout action:', error);
        }
        
        // 상태 초기화 (WebSocket은 useEffect cleanup에서 자동으로 닫힘)
        setCurrentUser(null);
        sessionStorage.removeItem('currentUser');
        
        // 모든 상태 초기화
        setOnlineUsers([]);
        setLiveGames({});
        setSinglePlayerGames({});
        setTowerGames({});
        setNegotiations({});
        setWaitingRoomChats({});
        waitingRoomChatSessionStartRef.current = 0;
        setGameChats({});
        
        // 라우팅 초기화 (로그인 페이지로 이동)
        window.location.hash = '';
    }, [currentUser]);
    


    useEffect(() => {
        if (!currentUser) {
            // Clean up if user logs out
            setUsersMap({});
            setOnlineUsers([]);
            setLiveGames({});
            setNegotiations({});
            deferredLevelUpCelebrationRef.current = null;
            setLevelUpCelebration(null);
            deferredMannerGradeChangeRef.current = null;
            setMannerGradeChange(null);
            return;
        }

        let ws: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout | null = null;
        let isIntentionalClose = false;
        let shouldReconnect = true;
        let isConnecting = false; // 중복 연결 방지 플래그
        let isInitialStateReady = true;
        let pendingMessages: any[] = [];
        let initialStateTimeout: NodeJS.Timeout | null = null;

        const getCloseCodeMeaning = (code: number): string => {
            switch (code) {
                case 1000: return 'Normal Closure';
                case 1001: return 'Going Away';
                case 1002: return 'Protocol Error';
                case 1003: return 'Unsupported Data';
                case 1006: return 'Abnormal Closure (no close frame)';
                case 1007: return 'Invalid Data';
                case 1008: return 'Policy Violation';
                case 1009: return 'Message Too Big';
                case 1010: return 'Missing Extension';
                case 1011: return 'Internal Error';
                case 1012: return 'Service Restart';
                case 1013: return 'Try Again Later';
                case 1014: return 'Bad Gateway';
                case 1015: return 'TLS Handshake';
                default: return `Unknown (${code})`;
            }
        };

        /** CONNECTING 직후 close()는 브라우저가 "closed before established" 경고 — Strict Mode·빠른 unmount 완화 */
        const softCloseWebSocket = (socket: WebSocket) => {
            if (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) return;
            if (socket.readyState === WebSocket.OPEN) {
                try {
                    socket.close();
                } catch {
                    /* ignore */
                }
                return;
            }
            if (socket.readyState === WebSocket.CONNECTING) {
                let done = false;
                const closeOnce = () => {
                    if (done) return;
                    done = true;
                    try {
                        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                            socket.close();
                        }
                    } catch {
                        /* ignore */
                    }
                };
                socket.addEventListener('open', closeOnce, { once: true });
                socket.addEventListener('error', closeOnce, { once: true });
                window.setTimeout(closeOnce, 400);
            }
        };

        // 초기 상태 처리 헬퍼 함수
        const processInitialState = (users: Record<string, any>, otherData: {
            onlineUsers?: any[];
            liveGames?: Record<string, any>;
            singlePlayerGames?: Record<string, any>;
            towerGames?: Record<string, any>;
            negotiations?: Record<string, any>;
            waitingRoomChats?: Record<string, any>;
            gameChats?: Record<string, any>;
            adminLogs?: any[];
            announcements?: any[];
            globalOverrideAnnouncement?: any;
            gameModeAvailability?: Record<string, boolean>;
            arenaEntranceAvailability?: Partial<Record<string, boolean>>;
            announcementInterval?: number;
            homeBoardPosts?: any[];
            guilds?: Record<string, any>;
        }) => {
                // 이 시점을 기준으로 이후에 도착하는 WAITING_ROOM_CHAT_UPDATE만 과거 메시지를 걸러 냄
                waitingRoomChatSessionStartRef.current = Date.now();

                const userEntries = Object.entries(users || {});
                // nickname이 없거나 비어 있는 경우 제외
                const filteredEntries = userEntries.filter(
                    ([, u]) => u && typeof u.nickname === 'string' && u.nickname.trim().length > 0
                );

                // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
                if (process.env.NODE_ENV === 'development') {
                    console.log('[WebSocket] Processing initial state - total users:', userEntries.length, 'filtered:', filteredEntries.length);
                }

                const normalizedFiltered = filteredEntries.map(([id, u]) => [
                    id,
                    {
                        ...u,
                        mbti: typeof u.mbti === 'string' ? u.mbti : null,
                        inventory: Array.isArray(u.inventory) ? u.inventory : [],
                    },
                ]);

            if (users && typeof users === 'object' && !Array.isArray(users)) {
                setUsersMap(Object.fromEntries(normalizedFiltered));
                console.log('[WebSocket] usersMap updated with', normalizedFiltered.length, 'users');
                
                // 현재 사용자의 데이터가 초기 상태에 포함되어 있으면 업데이트
                const currentUserSnapshot = currentUserRef.current;
                if (currentUserSnapshot && users[currentUserSnapshot.id]) {
                    const initialUserData = users[currentUserSnapshot.id];
                    if (initialUserData) {
                        try {
                            const sanitizedUpdate: Partial<User> = {
                                ...initialUserData,
                                inventory: Array.isArray(initialUserData.inventory) ? initialUserData.inventory : (currentUserSnapshot.inventory || []),
                                equipment: initialUserData.equipment ?? currentUserSnapshot.equipment,
                            };
                            // 닉네임 설정 직후 등: 늦게 도착한 INITIAL_STATE가 임시 닉네임(user_*)으로 덮어
                            // 라우터가 다시 set-nickname으로 보내거나 홈 전환이 늦게 느껴지는 레이스 방지
                            const localNick = currentUserSnapshot.nickname;
                            const incomingNick = initialUserData.nickname;
                            if (
                                typeof localNick === 'string' &&
                                localNick.trim().length > 0 &&
                                !localNick.startsWith('user_') &&
                                typeof incomingNick === 'string' &&
                                incomingNick.startsWith('user_')
                            ) {
                                sanitizedUpdate.nickname = localNick;
                            }
                            applyUserUpdate(sanitizedUpdate, 'INITIAL_STATE');
                        } catch (error) {
                            console.error('[WebSocket] Error applying initial state update:', error);
                            // 오류가 발생해도 앱이 계속 실행되도록 함
                        }
                    }
                }
            } else {
                console.warn('[WebSocket] Invalid users data:', users);
                setUsersMap({});
            }
            if (otherData) {
                if (otherData.onlineUsers !== undefined) setOnlineUsers(otherData.onlineUsers || []);
                // liveGames: 전략/놀이바둑 수순 제한 또는 AI봇 대결 시 totalTurns·moveHistory·currentPlayer를 sessionStorage에서 복원 (싱글/탑과 동일)
                if (otherData.liveGames !== undefined) {
                    const incomingLive = otherData.liveGames || {};
                    setLiveGames(prev => {
                        const next = { ...incomingLive };
                        for (const id of Object.keys(next)) {
                            const g = next[id];
                            if (!g) continue;
                            const limit = (g.settings as any)?.scoringTurnLimit ?? (g.settings as any)?.autoScoringTurns;
                            const isTurnLimitGame = (limit != null && limit > 0);
                            const isAiGame = !!(g as any).isAiGame;
                            const needsRestore = (isTurnLimitGame || isAiGame) && (g.totalTurns == null || g.totalTurns === 0);
                            const needsCurrentPlayerRestore = isTurnLimitGame || isAiGame;
                            if (needsRestore || needsCurrentPlayerRestore) {
                                try {
                                    const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`gameState_${id}`) : null;
                                    if (stored) {
                                        const parsed = JSON.parse(stored);
                                        if (parsed.gameId === id) {
                                            const storedTotal = needsRestore && typeof parsed.totalTurns === 'number' && parsed.totalTurns > 0 ? parsed.totalTurns : null;
                                            const storedMoves = Array.isArray(parsed.moveHistory) && parsed.moveHistory.length > 0 ? parsed.moveHistory : null;
                                            const inferredCurrentPlayer = needsCurrentPlayerRestore && storedMoves && storedMoves.length > 0
                                                ? ((last: { player?: number }) => last && (last.player === Player.Black ? Player.White : Player.Black))(storedMoves[storedMoves.length - 1])
                                                : null;
                                            if (storedTotal != null || storedMoves != null || inferredCurrentPlayer != null) {
                                                next[id] = {
                                                    ...g,
                                                    ...(storedTotal != null ? { totalTurns: storedTotal } : {}),
                                                    ...(storedMoves != null ? { moveHistory: storedMoves } : {}),
                                                    ...(inferredCurrentPlayer != null ? { currentPlayer: inferredCurrentPlayer } : {}),
                                                };
                                            }
                                        }
                                    }
                                } catch { /* ignore */ }
                            }
                            // 온라인 AI 대국: INITIAL_STATE는 boardState를 보내지 않음. rejoin 전 빈 판·턴 표시를 막기 위해 sessionStorage 판·시간 정보 병합
                            if (isAiGame) {
                                const cur = next[id];
                                if (!cur) continue;
                                const b = cur.boardState;
                                const hasBoard =
                                    Array.isArray(b) &&
                                    b.length > 0 &&
                                    Array.isArray(b[0]) &&
                                    b[0].length > 0;
                                if (!hasBoard) {
                                    try {
                                        const stored =
                                            typeof sessionStorage !== 'undefined'
                                                ? sessionStorage.getItem(`gameState_${id}`)
                                                : null;
                                        if (stored) {
                                            const parsed = JSON.parse(stored);
                                            const pb = parsed?.boardState;
                                            const storedBoardOk =
                                                Array.isArray(pb) &&
                                                pb.length > 0 &&
                                                Array.isArray(pb[0]) &&
                                                pb[0].length > 0;
                                            if (parsed?.gameId === id && storedBoardOk) {
                                                const sm = parsed.moveHistory;
                                                const cm = cur.moveHistory;
                                                const useStoredMoves =
                                                    Array.isArray(sm) &&
                                                    sm.length > 0 &&
                                                    (!Array.isArray(cm) || cm.length === 0);
                                                next[id] = {
                                                    ...cur,
                                                    boardState: pb,
                                                    ...(useStoredMoves ? { moveHistory: sm } : {}),
                                                    ...(parsed.currentPlayer != null &&
                                                    (cur.currentPlayer === undefined || cur.currentPlayer === null)
                                                        ? { currentPlayer: parsed.currentPlayer }
                                                        : {}),
                                                    ...(typeof parsed.totalTurns === 'number' &&
                                                    parsed.totalTurns > 0 &&
                                                    (cur.totalTurns == null ||
                                                        cur.totalTurns === 0 ||
                                                        parsed.totalTurns > (cur.totalTurns ?? 0))
                                                        ? { totalTurns: Math.max(cur.totalTurns ?? 0, parsed.totalTurns) }
                                                        : {}),
                                                    ...(parsed.turnDeadline != null
                                                        ? {
                                                              turnDeadline: parsed.turnDeadline,
                                                              turnStartTime: parsed.turnStartTime,
                                                          }
                                                        : {}),
                                                    ...(typeof parsed.gameStartTime === 'number' &&
                                                    parsed.gameStartTime > 0 &&
                                                    (!(cur as any).gameStartTime || (cur as any).gameStartTime <= 0)
                                                        ? { gameStartTime: parsed.gameStartTime }
                                                        : {}),
                                                    ...(parsed.captures && typeof parsed.captures === 'object'
                                                        ? { captures: parsed.captures }
                                                        : {}),
                                                    ...((() => {
                                                        const pa = (parsed as any).adventureEncounterDeadlineMs;
                                                        const ca = (cur as any).adventureEncounterDeadlineMs;
                                                        if (
                                                            cur.gameCategory === 'adventure' &&
                                                            typeof pa === 'number' &&
                                                            pa > Date.now() &&
                                                            (typeof ca !== 'number' || ca < Date.now())
                                                        ) {
                                                            return { adventureEncounterDeadlineMs: pa } as any;
                                                        }
                                                        return {};
                                                    })()),
                                                    ...((() => {
                                                        const pf = (parsed as any).adventureEncounterFrozenHumanMsRemaining;
                                                        const cf = (cur as any).adventureEncounterFrozenHumanMsRemaining;
                                                        if (
                                                            cur.gameCategory === 'adventure' &&
                                                            typeof pf === 'number' &&
                                                            pf > 0 &&
                                                            (cf == null || cf <= 0)
                                                        ) {
                                                            return { adventureEncounterFrozenHumanMsRemaining: pf } as any;
                                                        }
                                                        return {};
                                                    })()),
                                                };
                                            }
                                        }
                                    } catch {
                                        /* ignore */
                                    }
                                }
                                const curMerged = next[id];
                                if (curMerged && curMerged.isAiGame) {
                                    const lim =
                                        (curMerged.settings as any)?.scoringTurnLimit ??
                                        (curMerged.settings as any)?.autoScoringTurns;
                                    const tl = lim != null && Number(lim) > 0;
                                    if (tl || curMerged.gameCategory === 'adventure') {
                                        try {
                                            const st2 =
                                                typeof sessionStorage !== 'undefined'
                                                    ? sessionStorage.getItem(`gameState_${id}`)
                                                    : null;
                                            if (st2) {
                                                const p2 = JSON.parse(st2);
                                                if (p2.gameId === id) {
                                                    let m = next[id]!;
                                                    const stT = typeof p2.totalTurns === 'number' ? p2.totalTurns : 0;
                                                    if (stT > (m.totalTurns ?? 0)) m = { ...m, totalTurns: stT };
                                                    const sm2 = p2.moveHistory;
                                                    const cm2 = m.moveHistory;
                                                    if (
                                                        Array.isArray(sm2) &&
                                                        sm2.length > (Array.isArray(cm2) ? cm2.length : 0)
                                                    ) {
                                                        m = { ...m, moveHistory: sm2 };
                                                    }
                                                    if (
                                                        typeof p2.gameStartTime === 'number' &&
                                                        p2.gameStartTime > 0 &&
                                                        (!(m as any).gameStartTime || (m as any).gameStartTime <= 0)
                                                    ) {
                                                        m = { ...m, gameStartTime: p2.gameStartTime } as any;
                                                    }
                                                    if (m.gameCategory === 'adventure') {
                                                        const pa2 = (p2 as any).adventureEncounterDeadlineMs;
                                                        if (typeof pa2 === 'number' && pa2 > Date.now()) {
                                                            const ca2 = (m as any).adventureEncounterDeadlineMs;
                                                            if (typeof ca2 !== 'number' || ca2 < Date.now()) {
                                                                (m as any).adventureEncounterDeadlineMs = pa2;
                                                            }
                                                        }
                                                        const pf2 = (p2 as any).adventureEncounterFrozenHumanMsRemaining;
                                                        if (
                                                            typeof pf2 === 'number' &&
                                                            pf2 > 0 &&
                                                            ((m as any).adventureEncounterFrozenHumanMsRemaining == null ||
                                                                (m as any).adventureEncounterFrozenHumanMsRemaining <= 0)
                                                        ) {
                                                            (m as any).adventureEncounterFrozenHumanMsRemaining = pf2;
                                                        }
                                                    }
                                                    next[id] = m;
                                                }
                                            }
                                        } catch {
                                            /* ignore */
                                        }
                                    }
                                }
                            }
                        }
                        return next;
                    });
                }
                // singlePlayerGames: rejoin으로 이미 받은 보드/수순/턴 정보가 있으면 유지 (INITIAL_STATE가 덮어써 흰돌·돌 사라짐·턴 초기화 방지)
                // 새로고침 직후 prev가 비어 있으므로, totalTurns/moveHistory가 없으면 sessionStorage에서 복원해 state에 넣음 (한 수 둔 뒤 턴이 Max로 리셋되는 버그 방지)
                // moveHistory 기준 currentPlayer 복원으로 AI 차례에 새로고침 시에도 흑 차례로 넘어가지 않도록 함
                if (otherData.singlePlayerGames !== undefined) {
                    const incoming = otherData.singlePlayerGames || {};
                    setSinglePlayerGames(prev => {
                        const next = { ...prev, ...incoming };
                        for (const id of Object.keys(incoming)) {
                            let fromPayload = next[id];
                            if (!fromPayload) continue;
                            if (prev[id] && shouldKeepLocalSessionOverIncomingPending(prev[id], incoming[id])) {
                                next[id] = { ...fromPayload, ...prev[id] };
                                fromPayload = next[id];
                            }
                            const isSpStage =
                                fromPayload.isSinglePlayer &&
                                !!(fromPayload.stageId || (fromPayload.settings as any)?.autoScoringTurns);
                            const needsRestore = isSpStage && (fromPayload.totalTurns == null || fromPayload.totalTurns === 0);
                            const needsCurrentPlayerRestore = isSpStage;
                            try {
                                const stored =
                                    typeof sessionStorage !== 'undefined'
                                        ? sessionStorage.getItem(`gameState_${id}`)
                                        : null;
                                if (stored) {
                                    const parsed = JSON.parse(stored) as Record<string, unknown>;
                                    if (parsed.gameId === id) {
                                        let merged: LiveGameSession = next[id] || fromPayload;
                                        if (needsRestore || needsCurrentPlayerRestore) {
                                            const storedTotal =
                                                needsRestore &&
                                                typeof parsed.totalTurns === 'number' &&
                                                parsed.totalTurns > 0
                                                    ? parsed.totalTurns
                                                    : null;
                                            const storedMoves =
                                                Array.isArray(parsed.moveHistory) && parsed.moveHistory.length > 0
                                                    ? (parsed.moveHistory as LiveGameSession['moveHistory'])
                                                    : null;
                                            const inferredCurrentPlayer =
                                                needsCurrentPlayerRestore &&
                                                storedMoves &&
                                                storedMoves.length > 0
                                                    ? ((last: { player?: number }) =>
                                                          last &&
                                                          (last.player === Player.Black ? Player.White : Player.Black))(
                                                          storedMoves[storedMoves.length - 1] as { player?: number }
                                                      )
                                                    : null;
                                            if (storedTotal != null || storedMoves != null || inferredCurrentPlayer != null) {
                                                merged = {
                                                    ...merged,
                                                    ...(storedTotal != null ? { totalTurns: storedTotal } : {}),
                                                    ...(storedMoves != null ? { moveHistory: storedMoves } : {}),
                                                    ...(inferredCurrentPlayer != null
                                                        ? { currentPlayer: inferredCurrentPlayer }
                                                        : {}),
                                                };
                                            }
                                        }
                                        next[id] = augmentPveFromSessionStorageSnapshot(merged, parsed);
                                    }
                                }
                            } catch {
                                /* ignore */
                            }
                            const existing = prev[id];
                            if (existing?.boardState != null && Array.isArray(existing.boardState) && existing.boardState.length > 0) {
                                const payloadHasBoard = Array.isArray(fromPayload.boardState) && fromPayload.boardState.length > 0;
                                if (!payloadHasBoard) {
                                    next[id] = {
                                        ...(next[id] || fromPayload),
                                        boardState: existing.boardState,
                                        moveHistory: existing.moveHistory ?? (next[id] || fromPayload).moveHistory,
                                        currentPlayer: existing.currentPlayer ?? (next[id] || fromPayload).currentPlayer,
                                        totalTurns: existing.totalTurns ?? (next[id] || fromPayload).totalTurns,
                                        captures: existing.captures ?? (next[id] || fromPayload).captures,
                                        lastMove: existing.lastMove ?? (next[id] || fromPayload).lastMove,
                                        blackTimeLeft: existing.blackTimeLeft ?? (next[id] || fromPayload).blackTimeLeft,
                                        whiteTimeLeft: existing.whiteTimeLeft ?? (next[id] || fromPayload).whiteTimeLeft,
                                        turnDeadline: existing.turnDeadline ?? (next[id] || fromPayload).turnDeadline,
                                        turnStartTime: existing.turnStartTime ?? (next[id] || fromPayload).turnStartTime,
                                    };
                                }
                            }
                        }
                        return next;
                    });
                }
                // towerGames: rejoin으로 이미 받은 보드/수순/턴 정보가 있으면 유지. 새로고침 직후 totalTurns/moveHistory/currentPlayer를 sessionStorage에서 복원
                if (otherData.towerGames !== undefined) {
                    const incoming = otherData.towerGames || {};
                    setTowerGames(prev => {
                        const next = { ...prev, ...incoming };
                        for (const id of Object.keys(incoming)) {
                            let fromPayload = next[id];
                            if (!fromPayload) continue;
                            if (prev[id] && shouldKeepLocalSessionOverIncomingPending(prev[id], incoming[id])) {
                                next[id] = { ...fromPayload, ...prev[id] };
                                fromPayload = next[id];
                            }
                            const isTowerStage =
                                fromPayload.gameCategory === 'tower' &&
                                !!(fromPayload.stageId || (fromPayload.settings as any)?.autoScoringTurns);
                            const needsRestore = isTowerStage && (fromPayload.totalTurns == null || fromPayload.totalTurns === 0);
                            const needsCurrentPlayerRestore = isTowerStage;
                            try {
                                const stored =
                                    typeof sessionStorage !== 'undefined'
                                        ? sessionStorage.getItem(`gameState_${id}`)
                                        : null;
                                if (stored) {
                                    const parsed = JSON.parse(stored) as Record<string, unknown>;
                                    if (parsed.gameId === id) {
                                        let merged: LiveGameSession = next[id] || fromPayload;
                                        if (needsRestore || needsCurrentPlayerRestore) {
                                            const storedTotal =
                                                needsRestore &&
                                                typeof parsed.totalTurns === 'number' &&
                                                parsed.totalTurns > 0
                                                    ? parsed.totalTurns
                                                    : null;
                                            const storedMoves =
                                                Array.isArray(parsed.moveHistory) && parsed.moveHistory.length > 0
                                                    ? (parsed.moveHistory as LiveGameSession['moveHistory'])
                                                    : null;
                                            const inferredCurrentPlayer =
                                                needsCurrentPlayerRestore &&
                                                storedMoves &&
                                                storedMoves.length > 0
                                                    ? ((last: { player?: number }) =>
                                                          last &&
                                                          (last.player === Player.Black ? Player.White : Player.Black))(
                                                          storedMoves[storedMoves.length - 1] as { player?: number }
                                                      )
                                                    : null;
                                            if (storedTotal != null || storedMoves != null || inferredCurrentPlayer != null) {
                                                merged = {
                                                    ...merged,
                                                    ...(storedTotal != null ? { totalTurns: storedTotal } : {}),
                                                    ...(storedMoves != null ? { moveHistory: storedMoves } : {}),
                                                    ...(inferredCurrentPlayer != null
                                                        ? { currentPlayer: inferredCurrentPlayer }
                                                        : {}),
                                                };
                                            }
                                        }
                                        next[id] = augmentPveFromSessionStorageSnapshot(merged, parsed);
                                    }
                                }
                            } catch {
                                /* ignore */
                            }
                            const existing = prev[id];
                            if (existing?.boardState != null && Array.isArray(existing.boardState) && existing.boardState.length > 0) {
                                const payloadHasBoard = Array.isArray(fromPayload.boardState) && fromPayload.boardState.length > 0;
                                if (!payloadHasBoard) {
                                    next[id] = {
                                        ...(next[id] || fromPayload),
                                        boardState: existing.boardState,
                                        moveHistory: existing.moveHistory ?? (next[id] || fromPayload).moveHistory,
                                        currentPlayer: existing.currentPlayer ?? (next[id] || fromPayload).currentPlayer,
                                        totalTurns: existing.totalTurns ?? (next[id] || fromPayload).totalTurns,
                                        captures: existing.captures ?? (next[id] || fromPayload).captures,
                                        lastMove: existing.lastMove ?? (next[id] || fromPayload).lastMove,
                                        blackTimeLeft: existing.blackTimeLeft ?? (next[id] || fromPayload).blackTimeLeft,
                                        whiteTimeLeft: existing.whiteTimeLeft ?? (next[id] || fromPayload).whiteTimeLeft,
                                        turnDeadline: existing.turnDeadline ?? (next[id] || fromPayload).turnDeadline,
                                        turnStartTime: existing.turnStartTime ?? (next[id] || fromPayload).turnStartTime,
                                    };
                                }
                            }
                        }
                        return next;
                    });
                }
                if (otherData.negotiations !== undefined) setNegotiations(otherData.negotiations || {});
                if (otherData.waitingRoomChats !== undefined) {
                    const incoming = otherData.waitingRoomChats || {};
                    const cleared: Record<string, ChatMessage[]> = {};
                    for (const key of Object.keys(incoming)) {
                        cleared[key] = [];
                    }
                    for (const key of ['global', 'strategic', 'playful']) {
                        if (!(key in cleared)) cleared[key] = [];
                    }
                    setWaitingRoomChats(cleared);
                } else {
                    setWaitingRoomChats({ global: [], strategic: [], playful: [] });
                }
                if (otherData.gameChats !== undefined) setGameChats(otherData.gameChats || {});
                if (otherData.adminLogs !== undefined) setAdminLogs(otherData.adminLogs || []);
                if (otherData.announcements !== undefined) setAnnouncements(otherData.announcements || []);
                if (otherData.globalOverrideAnnouncement !== undefined) setGlobalOverrideAnnouncement(otherData.globalOverrideAnnouncement || null);
                if (otherData.gameModeAvailability !== undefined) setGameModeAvailability(otherData.gameModeAvailability || {});
                if (otherData.arenaEntranceAvailability !== undefined) {
                    setArenaEntranceAvailability(mergeArenaEntranceAvailability(otherData.arenaEntranceAvailability));
                }
                if (otherData.announcementInterval !== undefined) setAnnouncementInterval(otherData.announcementInterval || 3);
                if (otherData.homeBoardPosts !== undefined) setHomeBoardPosts(otherData.homeBoardPosts || []);
                // 길드: INITIAL_STATE와 기존 상태 병합 (GET_GUILD_INFO 등으로 이미 가져온 데이터 우선)
                if (otherData.guilds !== undefined) {
                    setGuilds(prev => ({ ...(otherData.guilds || {}), ...prev }));
                }
            }
        };

        function scheduleReconnect(reason: string) {
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
            if (!shouldReconnect || !currentUser || isIntentionalClose) return;
            const attempt = wsReconnectAttemptRef.current;
            const delay = Math.min(30000, Math.round(1500 * Math.pow(1.55, attempt)));
            wsReconnectAttemptRef.current = attempt + 1;
            if (process.env.NODE_ENV === 'development') {
                console.log(`[WebSocket] ${reason}, reconnect in ${delay}ms (attempt ${wsReconnectAttemptRef.current})`);
            }
            reconnectTimeout = setTimeout(() => {
                if (shouldReconnect && currentUser && !isConnecting) {
                    isIntentionalClose = false;
                    connectWebSocket();
                }
            }, delay);
        }

        function connectWebSocket() {
            if (!shouldReconnect || !currentUser) return;
            
            // 이미 연결 중이면 중복 연결 방지
            if (isConnecting) {
                console.log('[WebSocket] Connection already in progress, skipping...');
                return;
            }
            
            // 이미 열려있는 연결이 있으면 재연결하지 않음
            if (ws && ws.readyState === WebSocket.OPEN) {
                console.log('[WebSocket] Connection already open, skipping...');
                return;
            }
            
            // 기존 타임아웃 정리
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
            
            isConnecting = true;
            
            try {
                // Close existing connection if any
                if (ws && ws.readyState !== WebSocket.CLOSED) {
                    console.log('[WebSocket] Closing existing connection before reconnecting');
                    isIntentionalClose = true;
                    const oldWs = ws;
                    ws = null;
                    softCloseWebSocket(oldWs);
                }
                
                // WebSocket URL: apiConfig.ts와 동일 (DEV에서 VITE_* / :4000 자동 감지 시 API와 같은 호스트로 /ws)
                const wsUrl = getWebSocketUrlFor('/ws');
                
                console.log('[WebSocket] Connecting to:', wsUrl);
                console.log('[WebSocket] Current location:', {
                    protocol: window.location.protocol,
                    hostname: window.location.hostname,
                    port: window.location.port,
                    href: window.location.href
                });
                
                try {
                    ws = new WebSocket(wsUrl);
                } catch (error) {
                    console.error('[WebSocket] Failed to create WebSocket:', error);
                    isConnecting = false;
                    if (!isIntentionalClose && shouldReconnect && currentUser) {
                        scheduleReconnect('create failed');
                    }
                    return;
                }
                
                // 연결 타임아웃 설정 (30초)
                let connectionTimeout: NodeJS.Timeout | null = setTimeout(() => {
                    if (ws && ws.readyState === WebSocket.CONNECTING) {
                        console.warn('[WebSocket] Connection timeout, closing...');
                        ws.close();
                    }
                    connectionTimeout = null;
                }, 30000);

                ws.onopen = () => {
                    console.log('[WebSocket] Connected successfully');
                    wsReconnectAttemptRef.current = 0;
                    isIntentionalClose = false;
                    isConnecting = false; // 연결 완료
                    if (connectionTimeout) {
                        clearTimeout(connectionTimeout);
                        connectionTimeout = null;
                    }
                    // 서버에 userId 전송 (대역폭 최적화를 위해 게임 참가자에게만 메시지 전송)
                    if (currentUser?.id && ws && ws.readyState === WebSocket.OPEN) {
                        try {
                            ws.send(JSON.stringify({ type: 'AUTH', userId: currentUser.id }));
                        } catch (e) {
                            console.error('[WebSocket] Failed to send AUTH message:', e);
                        }
                    }
                };

                const scheduleInitialStateTimeout = () => {
                    if (initialStateTimeout) {
                        clearTimeout(initialStateTimeout);
                    }
                    initialStateTimeout = setTimeout(() => {
                        if (!isInitialStateReady) {
                            console.warn('[WebSocket] Initial state chunks timeout, forcing completion.');
                            const buffer = (window as any).__chunkedStateBuffer;
                            const users = buffer?.users || {};
                            const otherData = buffer?.otherData || {};
                            (window as any).__chunkedStateBuffer = null;
                            processInitialState(users, otherData);
                            completeInitialState();
                        }
                    }, 10000);
                };

                const completeInitialState = () => {
                    setActiveGameFromLogin(null);
                    if (initialStateTimeout) {
                        clearTimeout(initialStateTimeout);
                        initialStateTimeout = null;
                    }
                    if (!isInitialStateReady) {
                        isInitialStateReady = true;
                        if (pendingMessages.length > 0) {
                            const bufferedMessages = pendingMessages;
                            pendingMessages = [];
                            bufferedMessages.forEach(message => handleMessage(message, true));
                        }
                    }
                };

                function handleMessage(message: any, fromBuffer = false) {
                    const initialStateTypes = ['INITIAL_STATE_START', 'INITIAL_STATE_CHUNK', 'INITIAL_STATE', 'CONNECTION_ESTABLISHED', 'SERVER_RESTARTING'];

                    if (!fromBuffer && !isInitialStateReady && !initialStateTypes.includes(message.type)) {
                        pendingMessages.push(message);
                        return;
                    }

                    switch (message.type) {
                        case 'SERVER_RESTARTING': {
                            const msg =
                                typeof message.payload?.message === 'string'
                                    ? message.payload.message
                                    : '서버가 곧 재시작됩니다. 잠시 후 자동으로 다시 연결됩니다.';
                            const ms =
                                typeof message.payload?.noticeMs === 'number' && message.payload.noticeMs > 0
                                    ? message.payload.noticeMs
                                    : 8000;
                            setServerReconnectNotice(msg);
                            if (serverReconnectTimerRef.current !== null) {
                                window.clearTimeout(serverReconnectTimerRef.current);
                            }
                            serverReconnectTimerRef.current = window.setTimeout(() => {
                                setServerReconnectNotice(null);
                                serverReconnectTimerRef.current = null;
                            }, ms);
                            return;
                        }
                        case 'CONNECTION_ESTABLISHED':
                            console.log('[WebSocket] Connection established, waiting for initial state...');
                            return;
                        case 'SCHEDULER_MIDNIGHT_COMPLETE': {
                            // 0시 스케줄러 동작 완료 시 서버가 전송. 새로고침하여 일일 퀘스트/던전/랭킹 등 반영
                            console.log('[WebSocket] SCHEDULER_MIDNIGHT_COMPLETE received, refreshing page');
                            window.location.reload();
                            return;
                        }
                        case 'INITIAL_STATE_START': {
                            console.log('[WebSocket] Receiving chunked initial state (start):', {
                                chunkIndex: message.payload.chunkIndex,
                                totalChunks: message.payload.totalChunks
                            });
                            isInitialStateReady = false;
                            pendingMessages = [];
                            scheduleInitialStateTimeout();
                            (window as any).__chunkedStateBuffer = {
                                users: {},
                                receivedChunks: 0,
                                totalChunks: message.payload.totalChunks,
                                otherData: null
                            };
                            const startBuffer = (window as any).__chunkedStateBuffer;
                            Object.assign(startBuffer.users, message.payload.users);
                            startBuffer.otherData = {
                                onlineUsers: message.payload.onlineUsers,
                                liveGames: message.payload.liveGames,
                                singlePlayerGames: message.payload.singlePlayerGames,
                                towerGames: message.payload.towerGames,
                                negotiations: message.payload.negotiations,
                                waitingRoomChats: message.payload.waitingRoomChats,
                                gameChats: message.payload.gameChats,
                                adminLogs: message.payload.adminLogs,
                                announcements: message.payload.announcements,
                                globalOverrideAnnouncement: message.payload.globalOverrideAnnouncement,
                                gameModeAvailability: message.payload.gameModeAvailability,
                                arenaEntranceAvailability: message.payload.arenaEntranceAvailability,
                                announcementInterval: message.payload.announcementInterval,
                                homeBoardPosts: message.payload.homeBoardPosts,
                                guilds: message.payload.guilds || {}
                            };
                            startBuffer.receivedChunks++;
                            if (message.payload.isLast) {
                                processInitialState(startBuffer.users, startBuffer.otherData);
                                (window as any).__chunkedStateBuffer = null;
                                completeInitialState();
                            }
                            return;
                        }
                        case 'INITIAL_STATE_CHUNK': {
                            if (!(window as any).__chunkedStateBuffer) {
                                console.warn('[WebSocket] Received chunk without INITIAL_STATE_START, initializing buffer...');
                                (window as any).__chunkedStateBuffer = {
                                    users: {},
                                    receivedChunks: 0,
                                    totalChunks: message.payload.totalChunks || 0,
                                    otherData: null
                                };
                            }
                            isInitialStateReady = false;
                            scheduleInitialStateTimeout();
                            const chunkBuffer = (window as any).__chunkedStateBuffer;
                            Object.assign(chunkBuffer.users, message.payload.users);
                            chunkBuffer.receivedChunks++;
                            console.log(`[WebSocket] Received chunk ${chunkBuffer.receivedChunks}/${chunkBuffer.totalChunks || '?'} (index ${message.payload.chunkIndex})`);
                            if (message.payload.isLast) {
                                console.log('[WebSocket] All chunks received, processing...');
                                if (!chunkBuffer.otherData) {
                                chunkBuffer.otherData = {
                                    onlineUsers: message.payload.onlineUsers,
                                    liveGames: message.payload.liveGames,
                                    singlePlayerGames: message.payload.singlePlayerGames,
                                    towerGames: message.payload.towerGames,
                                    negotiations: message.payload.negotiations,
                                    waitingRoomChats: message.payload.waitingRoomChats,
                                    gameChats: message.payload.gameChats,
                                    adminLogs: message.payload.adminLogs,
                                    announcements: message.payload.announcements,
                                    globalOverrideAnnouncement: message.payload.globalOverrideAnnouncement,
                                    gameModeAvailability: message.payload.gameModeAvailability,
                                    arenaEntranceAvailability: message.payload.arenaEntranceAvailability,
                                    announcementInterval: message.payload.announcementInterval,
                                    homeBoardPosts: message.payload.homeBoardPosts,
                                    guilds: message.payload.guilds || chunkBuffer.otherData?.guilds || {}
                                };
                                }
                                processInitialState(chunkBuffer.users, chunkBuffer.otherData);
                                (window as any).__chunkedStateBuffer = null;
                                completeInitialState();
                                console.log('[WebSocket] Chunked initial state processed successfully');
                            }
                            return;
                        }
                        case 'INITIAL_STATE': {
                            console.log('INITIAL_STATE payload:', message.payload);
                            isInitialStateReady = false;
                            pendingMessages = [];
                            scheduleInitialStateTimeout();
                            const {
                                users,
                                onlineUsers,
                                liveGames,
                                singlePlayerGames,
                                towerGames,
                                negotiations,
                                waitingRoomChats,
                                gameChats,
                                adminLogs,
                                announcements,
                                globalOverrideAnnouncement,
                                gameModeAvailability,
                                arenaEntranceAvailability,
                                announcementInterval,
                                homeBoardPosts,
                                guilds
                            } = message.payload;
                            processInitialState(users, {
                                onlineUsers,
                                liveGames,
                                singlePlayerGames,
                                towerGames,
                                negotiations,
                                waitingRoomChats,
                                gameChats,
                                adminLogs,
                                announcements,
                                globalOverrideAnnouncement,
                                gameModeAvailability,
                                arenaEntranceAvailability,
                                announcementInterval,
                                homeBoardPosts,
                                guilds
                            });
                            completeInitialState();
                            return;
                        }
                        case 'USER_UPDATE': {
                            const payload = message.payload || {};
                            const updatedCurrentUser = currentUser ? payload[currentUser.id] : undefined;

                            setUsersMap(currentUsersMap => {
                                const updatedUsersMap = { ...currentUsersMap };
                                Object.entries(payload).forEach(([userId, updatedUserData]: [string, any]) => {
                                    updatedUsersMap[userId] = updatedUserData;
                                });
                                return updatedUsersMap;
                            });

                            if (currentUser && updatedCurrentUser && updatedCurrentUser.id === currentUser.id) {
                                const now = Date.now();
                                const timeSinceLastHttpUpdate = now - lastHttpUpdateTime.current;
                                const hasNicknameUpdate = updatedCurrentUser.nickname !== undefined && updatedCurrentUser.nickname !== currentUser.nickname;
                                const hasAdventureProfileUpdate = updatedCurrentUser.adventureProfile !== undefined;

                                const hadHttpUpdate = lastHttpUpdateTime.current > 0;
                                const httpUpdateHadUser = lastHttpHadUpdatedUser.current;

                                if (!hasNicknameUpdate && !hasAdventureProfileUpdate) {
                                    if (hadHttpUpdate && httpUpdateHadUser && timeSinceLastHttpUpdate < HTTP_UPDATE_DEBOUNCE_MS) {
                                        console.log(`[WebSocket] USER_UPDATE ignored (${timeSinceLastHttpUpdate}ms since HTTP update with user, debounce: ${HTTP_UPDATE_DEBOUNCE_MS}ms, last action: ${lastHttpActionType.current})`);
                                        return;
                                    }
                                    if (!httpUpdateHadUser && lastHttpActionType.current) {
                                        console.log(`[WebSocket] USER_UPDATE applied immediately (HTTP response had no updatedUser for ${lastHttpActionType.current})`);
                                        lastHttpUpdateTime.current = now;
                                        lastHttpHadUpdatedUser.current = true;
                                    }
                                    if (hadHttpUpdate && httpUpdateHadUser && timeSinceLastHttpUpdate < HTTP_UPDATE_DEBOUNCE_MS * 2 && lastHttpActionType.current) {
                                        console.log(`[WebSocket] USER_UPDATE ignored (possible stale data, ${timeSinceLastHttpUpdate}ms since HTTP update)`);
                                        return;
                                    }
                                }
                                // 닉네임/모험 도감 프로필 변경은 디바운스 없이 항상 즉시 반영

                                const mergedUser = applyUserUpdate(updatedCurrentUser, 'USER_UPDATE-websocket');
                                console.log('[WebSocket] Applied USER_UPDATE for currentUser:', {
                                    inventoryLength: mergedUser.inventory?.length,
                                    gold: mergedUser.gold,
                                    diamonds: mergedUser.diamonds,
                                    equipment: mergedUser.equipment,
                                    actionPoints: mergedUser.actionPoints,
                                    clearedSinglePlayerStages: mergedUser.clearedSinglePlayerStages,
                                    singlePlayerProgress: mergedUser.singlePlayerProgress
                                });
                                
                                // currentUser 상태 업데이트 (clearedSinglePlayerStages 반영)
                                setCurrentUser(mergedUser);
                                currentUserRef.current = mergedUser;
                            }
                            return;
                        }
                        case 'USER_STATUS_UPDATE': {
                            setUsersMap(currentUsersMap => {
                                const updatedUsersMap = { ...currentUsersMap };
                                const onlineStatuses = Object.entries(message.payload || {}).map(([id, statusInfo]: [string, any]) => {
                                    let user: User | undefined = currentUsersMap[id];
                                    if (!user) {
                                        const allUsersArray = Object.values(currentUsersMap);
                                        user = allUsersArray.find((u: any) => u?.id === id) as User | undefined;
                                    }
                                    if (user) {
                                        if (!updatedUsersMap[id]) updatedUsersMap[id] = user;
                                        return { ...user, ...statusInfo };
                                    }
                                    // 새로 접속한 유저(usersMap에 없음): 본인이면 currentUser로 닉네임 즉시 표시, 아니면 최소 정보로 포함 후 /api/users/brief로 로드
                                    const isCurrentUser = currentUser && id === currentUser.id;
                                    const minimalUser = (isCurrentUser ? { ...currentUser, ...statusInfo } : { id, ...statusInfo }) as UserWithStatus;
                                    if (isCurrentUser) updatedUsersMap[id] = minimalUser;
                                    return minimalUser;
                                }).filter(Boolean) as UserWithStatus[];
                                setOnlineUsers(onlineStatuses);

                                if (currentUser) {
                                    const currentUserStatus = onlineStatuses.find(u => u.id === currentUser.id);
                                    if (currentUserStatus) {
                                        if (currentUserStatus.gameId && currentUserStatus.status === 'in-game') {
                                            const gameId = currentUserStatus.gameId;
                                            const gameCategory = currentUserStatus.gameCategory;
                                            console.log('[WebSocket] Current user status updated to in-game:', gameId, 'gameCategory:', gameCategory);
                                            
                                            // 모든 게임 카테고리에서 게임 찾기. ref 사용해 최신 state 반영 (CONFIRM_AI_GAME_START HTTP 응답 후 폴링이 게임을 찾도록)
                                            const checkAllGames = () => {
                                                const lg = liveGamesRef.current;
                                                const sg = singlePlayerGamesRef.current;
                                                const tg = towerGamesRef.current;
                                                let game = lg[gameId] || sg[gameId] || tg[gameId];
                                                if (game) {
                                                    console.log('[WebSocket] Game found, routing immediately');
                                                    setTimeout(() => {
                                                        window.location.hash = `#/game/${gameId}`;
                                                    }, 100);
                                                    return true;
                                                }
                                                const pending = pendingAiGameEntryRef.current;
                                                if (pending?.gameId === gameId && pending.game && Date.now() < pending.until) {
                                                    setLiveGames(prev => ({ ...prev, [gameId]: { ...prev[gameId], ...pending.game } }));
                                                    console.log('[WebSocket] Game found from CONFIRM_AI_GAME_START ref, merging and routing');
                                                    setTimeout(() => {
                                                        window.location.hash = `#/game/${gameId}`;
                                                    }, 100);
                                                    return true;
                                                }
                                                return false;
                                            };
                                            
                                            // 즉시 확인
                                            if (!checkAllGames()) {
                                                console.log('[WebSocket] Game not found yet, will wait for GAME_UPDATE');
                                                let attempts = 0;
                                                const maxAttempts = 20;
                                                const checkGame = () => {
                                                    attempts++;
                                                    if (checkAllGames()) {
                                                        return;
                                                    } else if (attempts < maxAttempts) {
                                                        setTimeout(checkGame, 200);
                                                    } else {
                                                        console.warn('[WebSocket] Game not found after max attempts:', gameId);
                                                    }
                                                };
                                                setTimeout(checkGame, 200);
                                            }
                                        } else if ((currentUserStatus.status === 'waiting' || currentUserStatus.status === 'resting') && !currentUserStatus.gameId) {
                                            const currentHash = window.location.hash;
                                            const isGamePage = currentHash.startsWith('#/game/');
                                            if (isGamePage) {
                                                const gameIdFromHash = currentHash.replace('#/game/', '');
                                                const currentGame = liveGames[gameIdFromHash] || singlePlayerGames[gameIdFromHash] || towerGames[gameIdFromHash];

                                                // 계가 중 새로고침: INITIAL_STATE가 아직 안 왔으면 게임이 없을 수 있음 → 리다이렉트하지 않고 대기
                                                if (!currentGame) {
                                                    console.log('[WebSocket] On game page but game not in state yet (e.g. after refresh), keeping user on game page:', gameIdFromHash);
                                                    return updatedUsersMap;
                                                }
                                                // scoring 상태의 게임은 리다이렉트하지 않음 (계가 진행 중)
                                                if (currentGame.gameStatus === 'scoring') {
                                                    console.log('[WebSocket] Game is in scoring state, keeping user on game page:', gameIdFromHash);
                                                    return updatedUsersMap;
                                                }

                                                const postGameRedirect = sessionStorage.getItem('postGameRedirect');
                                                if (postGameRedirect) {
                                                    console.log('[WebSocket] Current user status updated to waiting, routing to postGameRedirect:', postGameRedirect);
                                                    sessionStorage.removeItem('postGameRedirect');
                                                    setTimeout(() => {
                                                        replaceAppHash(postGameRedirect);
                                                    }, 100);
                                                } else {
                                                    const mode = currentUserStatus.mode;
                                                    // mode가 없고 status가 Waiting이면 strategic/playful 대기실로 이동
                                                    // (LEAVE_GAME_ROOM 후 서버에서 strategic/playful로 설정한 경우)
                                                    if (!mode && (currentUserStatus.status === UserStatus.Waiting || currentUserStatus.status === UserStatus.Resting)) {
                                                        console.log('[WebSocket] Current user status updated to waiting without mode, checking previous game mode');
                                                        // 이전 게임의 모드를 확인하여 대기실로 이동
                                                        // 게임 페이지에서 나온 경우, 게임 모드를 확인
                                                        const gameIdFromHash = currentHash.replace('#/game/', '');
                                                        const currentGame = liveGames[gameIdFromHash] || singlePlayerGames[gameIdFromHash] || towerGames[gameIdFromHash];
                                                        if (currentGame && !currentGame.isSinglePlayer && currentGame.mode) {
                                                        // 게임 모드를 strategic/playful로 변환
                                                        let waitingRoomMode: 'strategic' | 'playful' | null = null;
                                                        if (SPECIAL_GAME_MODES.some(m => m.mode === currentGame.mode)) {
                                                            waitingRoomMode = 'strategic';
                                                        } else if (PLAYFUL_GAME_MODES.some(m => m.mode === currentGame.mode)) {
                                                            waitingRoomMode = 'playful';
                                                        }
                                                            if (waitingRoomMode) {
                                                                console.log('[WebSocket] Routing to waiting room based on game mode:', waitingRoomMode);
                                                                setTimeout(() => {
                                                                    replaceAppHash(`#/waiting/${waitingRoomMode}`);
                                                                }, 100);
                                                            }
                                                        }
                                                    } else if (mode) {
                                                        console.warn('[WebSocket] Individual game mode detected, redirecting to profile:', mode);
                                                        setTimeout(() => {
                                                            replaceAppHash('#/profile');
                                                        }, 100);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                return updatedUsersMap;
                            });
                            return;
                        }
                        case 'WAITING_ROOM_CHAT_UPDATE': {
                            const sessionStart = waitingRoomChatSessionStartRef.current;
                            setWaitingRoomChats(currentChats => {
                                const updatedChats = { ...currentChats };
                                Object.entries(message.payload || {}).forEach(([channel, messages]: [string, any]) => {
                                    const arr = Array.isArray(messages) ? messages : [];
                                    updatedChats[channel] =
                                        sessionStart > 0
                                            ? arr.filter((m: ChatMessage) => (m?.timestamp ?? 0) >= sessionStart)
                                            : arr;
                                });
                                return updatedChats;
                            });
                            return;
                        }
                        case 'GAME_CHAT_UPDATE': {
                            setGameChats(currentChats => {
                                const updatedChats = { ...currentChats };
                                Object.entries(message.payload || {}).forEach(([gameId, messages]: [string, any]) => {
                                    updatedChats[gameId] = messages;
                                });
                                return updatedChats;
                            });
                            return;
                        }
                        case 'GAME_UPDATE': {
                            Object.entries(message.payload || {}).forEach(([gameId, game]: [string, any]) => {
                                // 성능 최적화: GAME_UPDATE 메시지 쓰로틀링 (같은 게임에 대해 최대 100ms당 1회만 처리)
                                const now = Date.now();
                                const lastUpdateTime = lastGameUpdateTimeRef.current[gameId] || 0;
                                const incomingMoveCount = (game.moveHistory && Array.isArray(game.moveHistory)) ? game.moveHistory.length : 0;
                                const lastProcessedMoveCount = lastGameUpdateMoveCountRef.current[gameId] ?? 0;
                                // 새 수(AI 수 등)가 있으면 반드시 처리 - 쓰로틀 무시 (바둑판에 돌이 안 보이는 버그 방지)
                                const hasNewMoves = incomingMoveCount > lastProcessedMoveCount;
                                // 알까기/컬링 등 놀이바둑은 moveHistory를 쓰지 않으므로, 이 경우 항상 업데이트 적용 (AI 배치가 스킵되는 버그 방지)
                                const isPlayfulBoardUpdate = !!(game.alkkagiStones || game.curlingStones || (game.gameStatus && (String(game.gameStatus).startsWith('alkkagi_') || String(game.gameStatus).startsWith('curling_'))));
                                // 주사위/도둑 굴리기 애니메이션: moveHistory가 안 바뀌어도 반영 (두 번째 턴부터 애니 안 나오는 버그 방지)
                                const isDiceRollAnimationUpdate = game.gameStatus === 'dice_rolling_animating' || game.gameStatus === 'thief_rolling_animating' || game.animation?.type === 'dice_roll_main';
                                // 주사위/도둑 착수: moveHistory가 안 늘어나도 보드·stonesToPlace가 매 수 바뀜. 쓰로틀에 걸리면 상대 화면에 돌/남은 수가 빠지는 버그 발생
                                const isDiceThiefPlacingUpdate =
                                    game.gameStatus === 'dice_placing' || game.gameStatus === 'thief_placing';
                                const isScoringOrRevealUpdate = game.gameStatus === 'scoring' || game.gameStatus === 'hidden_final_reveal';
                                // 따내기 바둑 입찰/재입찰 단계 전환은 moveHistory 변화가 없어도 반드시 반영
                                const isCaptureBidPhaseUpdate =
                                    game.gameStatus === 'capture_bidding' ||
                                    game.gameStatus === 'capture_reveal' ||
                                    game.gameStatus === 'capture_tiebreaker';
                                const isTerminalGameUpdate = game.gameStatus === 'ended' || game.gameStatus === 'no_contest';
                                // 싱글/타워: 스캔 애니메이션 종료 후 playing 전환은 수순이 그대로라 쓰로틀에 걸리면 클라이언트가 scanning_animating에 고정되는 버그 방지
                                const existingForThrottle =
                                    singlePlayerGamesRef.current[gameId] ??
                                    towerGamesRef.current[gameId] ??
                                    liveGamesRef.current[gameId];
                                // 스캔 연속 모드(scanning)에서 30초 타임아웃으로 playing 전환 시 moveHistory가 그대로라
                                // 쓰로틀에 걸리면 클라이언트가 scanning·0초에 고착될 수 있음 (scanning_animating과 동일하게 반드시 반영)
                                const isScanAnimExitToPlaying =
                                    (existingForThrottle?.gameStatus === 'scanning_animating' ||
                                        existingForThrottle?.gameStatus === 'scanning') &&
                                    game.gameStatus === 'playing';
                                const isHiddenPlacingExitToPlaying =
                                    existingForThrottle?.gameStatus === 'hidden_placing' &&
                                    game.gameStatus === 'playing';
                                // 미사일: moveHistory 길이는 그대로라 쓰로틀에 걸리면 LAUNCH_MISSILE 보드 반영 또는 애니 종료(playing) 전환이 누락되어
                                // 애니메이션만 재생되고 돌이 원래 칸에 남아 보이는 현상이 난다.
                                const isMissileSelectToAnimating =
                                    existingForThrottle?.gameStatus === 'missile_selecting' &&
                                    game.gameStatus === 'missile_animating';
                                const isMissileAnimExitToPlaying =
                                    existingForThrottle?.gameStatus === 'missile_animating' &&
                                    game.gameStatus === 'playing';
                                // 주사위/도둑 오버샷(또는 굴림 애니 종료) 후 rolling 단계로 복귀할 때
                                // moveHistory 변화가 없어도 currentPlayer가 바뀔 수 있으므로 반드시 반영
                                const isDiceThiefAnimExitToRolling =
                                    !!existingForThrottle?.gameStatus &&
                                    ['dice_rolling_animating', 'thief_rolling_animating'].includes(existingForThrottle.gameStatus) &&
                                    (game.gameStatus === 'dice_rolling' || game.gameStatus === 'thief_rolling');
                                // 주사위/도둑은 오버샷·강제턴넘김에서 moveHistory 변화 없이 currentPlayer만 바뀔 수 있다.
                                // 이 전환이 쓰로틀에 걸리면 클라이언트가 "아직 AI 턴"으로 보이는 고착이 생길 수 있어 반드시 반영한다.
                                const isDiceThiefTurnOwnerChanged =
                                    !!existingForThrottle &&
                                    existingForThrottle.currentPlayer !== game.currentPlayer &&
                                    (
                                        game.mode === GameMode.Dice ||
                                        game.mode === GameMode.Thief ||
                                        existingForThrottle.mode === GameMode.Dice ||
                                        existingForThrottle.mode === GameMode.Thief
                                    );
                                // 흑선 가져오기(capture bidding/reveal/tiebreaker) 종료 후 playing 전환은
                                // 이동 수(moveHistory)가 없더라도 반드시 모달을 닫고 다음 화면으로 넘어가야 함.
                                const isCaptureBidExitToPlaying =
                                    existingForThrottle?.gameStatus &&
                                    ['capture_bidding', 'capture_reveal', 'capture_tiebreaker'].includes(existingForThrottle.gameStatus) &&
                                    game.gameStatus === 'playing';
                                // PVP 접속 끊김: 수순·상태 변화 없이 disconnectionState만 오는 업데이트가 쓰로틀에 걸리면 모달이 안 뜸
                                const disconnectStateChanged =
                                    stableStringify(existingForThrottle?.disconnectionState ?? null) !==
                                    stableStringify(game.disconnectionState ?? null);
                                // 모험/로비 AI 히든: 수순 변화 없이 ai_thinking + 종료 시각만 오는 패킷이 쓰로틀에 걸리면
                                // 바둑판 빛·전광판 연출이 아예 안 뜨는 버그가 난다.
                                const isAiHiddenItemPresentationUpdate =
                                    game.animation?.type === 'ai_thinking' &&
                                    (game as any).aiHiddenItemAnimationEndTime != null;
                                if (
                                    !hasNewMoves &&
                                    !isPlayfulBoardUpdate &&
                                    !isDiceRollAnimationUpdate &&
                                    !isDiceThiefPlacingUpdate &&
                                    !isScoringOrRevealUpdate &&
                                    !isTerminalGameUpdate &&
                                    !isCaptureBidPhaseUpdate &&
                                    !isCaptureBidExitToPlaying &&
                                    !isDiceThiefAnimExitToRolling &&
                                    !isDiceThiefTurnOwnerChanged &&
                                    !isScanAnimExitToPlaying &&
                                    !isHiddenPlacingExitToPlaying &&
                                    !isMissileSelectToAnimating &&
                                    !isMissileAnimExitToPlaying &&
                                    !disconnectStateChanged &&
                                    !isAiHiddenItemPresentationUpdate &&
                                    now - lastUpdateTime < GAME_UPDATE_THROTTLE_MS
                                ) {
                                    return;
                                }
                                lastGameUpdateTimeRef.current[gameId] = now;
                                lastGameUpdateMoveCountRef.current[gameId] = incomingMoveCount;
                                
                                const gameCategory = game.gameCategory || (game.isSinglePlayer ? 'singleplayer' : 'normal');
                                
                                // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
                                if (process.env.NODE_ENV === 'development') {
                                    console.log('[WebSocket] GAME_UPDATE received:', { gameId, gameCategory, gameStatus: game.gameStatus, isSinglePlayer: game.isSinglePlayer });
                                }

                                if (gameCategory === 'singleplayer') {
                                    setSinglePlayerGames(currentGames => {
                                        // 성능 최적화: 게임 상태가 변경되지 않았으면 early return
                                        const existingGame = currentGames[gameId];
                                        
                                        // 중요한 필드만 비교하여 빠른 early return (stableStringify 호출 전에)
                                        if (existingGame) {
                                            const localMidGamePlayingSp =
                                                existingGame.gameStatus === 'playing' &&
                                                (existingGame.moveHistory?.length ?? 0) > 0;
                                            if (localMidGamePlayingSp && game.gameStatus === 'pending') {
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.warn(
                                                        '[WebSocket] SinglePlayer: ignoring stale pending GAME_UPDATE while local is playing with moves',
                                                        { gameId }
                                                    );
                                                }
                                                return currentGames;
                                            }
                                            const keyFieldsChanged = 
                                                existingGame.gameStatus !== game.gameStatus ||
                                                existingGame.currentPlayer !== game.currentPlayer ||
                                                existingGame.serverRevision !== game.serverRevision ||
                                                (game.animation && existingGame.animation?.type !== game.animation?.type);
                                            
                                            // 중요한 필드가 변경되지 않았을 때만 서명 비교 (비용이 큰 작업)
                                            if (!keyFieldsChanged) {
                                                const previousSignature = singlePlayerGameSignaturesRef.current[gameId];
                                                // 서명이 이미 저장되어 있고, 중요한 필드가 변경되지 않았으면 서명 비교 생략 가능
                                                // 하지만 안전을 위해 서명 비교 수행 (중요 필드 외의 변경 감지)
                                                const signature = stableStringify(game);
                                                if (previousSignature === signature) {
                                                    return currentGames; // 완전히 동일한 상태
                                                }
                                                singlePlayerGameSignaturesRef.current[gameId] = signature;
                                            } else {
                                                // 중요한 필드가 변경되었으므로 서명 업데이트 (한 번만 호출)
                                                singlePlayerGameSignaturesRef.current[gameId] = stableStringify(game);
                                            }
                                        } else {
                                            // 새 게임이므로 서명 저장 (한 번만 호출)
                                            singlePlayerGameSignaturesRef.current[gameId] = stableStringify(game);
                                        }
                                        const updatedGames = { ...currentGames };
                                        
                                        // scoring 상태인 경우 기존 게임의 boardState와 moveHistory 무조건 보존
                                        if (game.gameStatus === 'scoring') {
                                            if (existingGame) {
                                                // 서버에서 보낸 moveHistory가 유효하면 사용, 아니면 기존 것 사용
                                                const serverMoveHistoryValid = game.moveHistory && Array.isArray(game.moveHistory) && game.moveHistory.length > 0;
                                                const existingMoveHistoryValid = existingGame.moveHistory && Array.isArray(existingGame.moveHistory) && existingGame.moveHistory.length > 0;
                                                const finalMoveHistory = serverMoveHistoryValid ? game.moveHistory : (existingMoveHistoryValid ? existingGame.moveHistory : (game.moveHistory && Array.isArray(game.moveHistory) && game.moveHistory.length > 0 ? game.moveHistory : existingGame.moveHistory));

                                                const serverBoardStateValid = game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0 && game.boardState[0] && Array.isArray(game.boardState[0]) && game.boardState[0].length > 0 &&
                                                    game.boardState.some((row: any[]) => row && Array.isArray(row) && row.some((cell: any) => cell !== 0 && cell !== null && cell !== undefined));
                                                const existingBoardStateValid = existingGame.boardState && Array.isArray(existingGame.boardState) && existingGame.boardState.length > 0 && existingGame.boardState[0] && Array.isArray(existingGame.boardState[0]) && existingGame.boardState[0].length > 0;
                                                // IMPORTANT: 계가 화면에서는 포획이 반영된 "실제 boardState"를 유지해야 함.
                                                // moveHistory로 단순 복원하면 포획을 반영하지 못해 잡힌 돌이 다시 나타날 수 있다.
                                                let finalBoardState: any;
                                                if (serverBoardStateValid) {
                                                    finalBoardState = game.boardState;
                                                } else if (existingBoardStateValid) {
                                                    finalBoardState = existingGame.boardState;
                                                } else {
                                                    finalBoardState = game.boardState || existingGame.boardState;
                                                }

                                                const finalTotalTurns = (game.totalTurns !== undefined && game.totalTurns !== null) ? game.totalTurns : (existingGame.totalTurns !== undefined && existingGame.totalTurns !== null ? existingGame.totalTurns : game.totalTurns);
                                                const finalCaptures = (game.captures && typeof game.captures === 'object' && Object.keys(game.captures).length > 0)
                                                    ? game.captures
                                                    : (existingGame.captures && typeof existingGame.captures === 'object' ? existingGame.captures : game.captures);

                                                const preservedGame = {
                                                    ...game,
                                                    boardState: finalBoardState,
                                                    moveHistory: finalMoveHistory,
                                                    totalTurns: finalTotalTurns,
                                                    blackTimeLeft: (game.blackTimeLeft !== undefined && game.blackTimeLeft !== null && game.blackTimeLeft > 0) ? game.blackTimeLeft : (existingGame.blackTimeLeft !== undefined && existingGame.blackTimeLeft !== null ? existingGame.blackTimeLeft : game.blackTimeLeft),
                                                    whiteTimeLeft: (game.whiteTimeLeft !== undefined && game.whiteTimeLeft !== null && game.whiteTimeLeft > 0) ? game.whiteTimeLeft : (existingGame.whiteTimeLeft !== undefined && existingGame.whiteTimeLeft !== null ? existingGame.whiteTimeLeft : game.whiteTimeLeft),
                                                    captures: finalCaptures,
                                                };
                                                updatedGames[gameId] = preservedGame;
                                            } else {
                                                updatedGames[gameId] = game;
                                            }
                                        } else {
                                            // hidden_placing, scanning, hidden_reveal_animating 등에서는 boardState·permanentlyRevealedStones 보존/병합
                                            const isItemMode = ['hidden_placing', 'scanning', 'missile_selecting', 'missile_animating', 'scanning_animating', 'hidden_reveal_animating'].includes(game.gameStatus);
                                            // 미사일 애니메이션 중에는 서버가 따낸 돌을 반영한 boardState를 적용해야 함
                                            const isMissileAnimating = game.gameStatus === 'missile_animating';
                                            
                                            // 애니메이션 중에는 totalTurns와 captures를 보존해야 함
                                            const isAnimating = game.animation !== null && game.animation !== undefined;
                                            
                                            // totalTurns와 captures 보존 (애니메이션 중 초기화 방지)
                                            const preservedTotalTurns = existingGame?.totalTurns !== undefined && existingGame?.totalTurns !== null
                                                ? existingGame.totalTurns
                                                : (game.totalTurns !== undefined && game.totalTurns !== null ? game.totalTurns : undefined);
                                            
                                            const preservedCaptures = existingGame?.captures && 
                                                typeof existingGame.captures === 'object' &&
                                                Object.keys(existingGame.captures).length > 0
                                                ? existingGame.captures
                                                : (game.captures && typeof game.captures === 'object' && Object.keys(game.captures).length > 0
                                                    ? game.captures
                                                    : existingGame?.captures || game.captures || { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 });
                                            
                                            if (isItemMode) {
                                                const existingBoardStateValid = existingGame?.boardState && 
                                                    Array.isArray(existingGame.boardState) && 
                                                    existingGame.boardState.length > 0 && 
                                                    existingGame.boardState[0] && 
                                                    Array.isArray(existingGame.boardState[0]) && 
                                                    existingGame.boardState[0].length > 0;
                                                
                                                const serverBoardStateValid = game.boardState && 
                                                    Array.isArray(game.boardState) && 
                                                    game.boardState.length > 0 && 
                                                    game.boardState[0] && 
                                                    Array.isArray(game.boardState[0]) && 
                                                    game.boardState[0].length > 0;
                                                
                                                // missile_animating일 때는 서버의 boardState/captures 적용 (미사일로 따낸 돌이 즉시 반영되도록)
                                                const finalBoardState = isMissileAnimating && serverBoardStateValid
                                                    ? game.boardState
                                                    : (existingBoardStateValid && !isMissileAnimating
                                                        ? existingGame.boardState
                                                        : (serverBoardStateValid ? game.boardState : existingGame?.boardState));
                                                const finalCapturesForItemMode = isMissileAnimating && game.captures && typeof game.captures === 'object' && Object.keys(game.captures).length > 0
                                                    ? game.captures
                                                    : preservedCaptures;
                                                
                                                // moveHistory: 미사일은 수순 길이가 같고 중간 좌표만 바뀌므로, 애니 중에는 반드시 서버 수순을 써야 보드·마커·히든 인덱스가 일치함
                                                const existingMoveHistoryValid = existingGame?.moveHistory && 
                                                    Array.isArray(existingGame.moveHistory) && 
                                                    existingGame.moveHistory.length > 0;
                                                
                                                const serverMoveHistoryValid = game.moveHistory && 
                                                    Array.isArray(game.moveHistory) && 
                                                    game.moveHistory.length > 0;
                                                
                                                const finalMoveHistory =
                                                    isMissileAnimating && serverMoveHistoryValid
                                                        ? game.moveHistory
                                                        : existingMoveHistoryValid
                                                            ? existingGame.moveHistory
                                                            : (serverMoveHistoryValid ? game.moveHistory : existingGame?.moveHistory);
                                                
                                                // 서버 공개 목록 + 클라이언트 기존 목록 합집합 (서버가 빈 배열/생략이어도 이미 공개된 히든이 사라지지 않게)
                                                const existingRevealedSp = existingGame?.permanentlyRevealedStones ?? [];
                                                const serverRevealedSp = game.permanentlyRevealedStones ?? [];
                                                const mergedRevealed = [...existingRevealedSp];
                                                for (const p of serverRevealedSp) {
                                                    if (!mergedRevealed.some((r: Point) => r.x === p.x && r.y === p.y))
                                                        mergedRevealed.push(p);
                                                }
                                                const mergedPendingCapture = game.pendingCapture ?? existingGame?.pendingCapture ?? null;
                                                const mergedRevealAnimationEndTime = game.revealAnimationEndTime ?? existingGame?.revealAnimationEndTime;
                                                const mergedAnimation = game.animation ?? existingGame?.animation ?? null;
                                                updatedGames[gameId] = {
                                                    ...game,
                                                    boardState: finalBoardState,
                                                    moveHistory: finalMoveHistory,
                                                    permanentlyRevealedStones: mergedRevealed,
                                                    pendingCapture: mergedPendingCapture,
                                                    revealAnimationEndTime: mergedRevealAnimationEndTime,
                                                    animation: mergedAnimation,
                                                    // totalTurns와 captures 보존 (미사일 애니메이션 중에는 서버 captures 적용)
                                                    totalTurns: preservedTotalTurns,
                                                    captures: finalCapturesForItemMode,
                                                    // 시간 정보도 보존
                                                    blackTimeLeft: (game.blackTimeLeft !== undefined && game.blackTimeLeft !== null && game.blackTimeLeft > 0) 
                                                        ? game.blackTimeLeft 
                                                        : (existingGame?.blackTimeLeft !== undefined && existingGame?.blackTimeLeft !== null ? existingGame.blackTimeLeft : game.blackTimeLeft),
                                                    whiteTimeLeft: (game.whiteTimeLeft !== undefined && game.whiteTimeLeft !== null && game.whiteTimeLeft > 0) 
                                                        ? game.whiteTimeLeft 
                                                        : (existingGame?.whiteTimeLeft !== undefined && existingGame?.whiteTimeLeft !== null ? existingGame.whiteTimeLeft : game.whiteTimeLeft),
                                                };
                                            } else if (game.gameStatus === 'hidden_final_reveal' && game.isSinglePlayer && existingGame) {
                                                // 싱글플레이: 서버는 boardState를 보내지 않으므로 기존 보드/수순/공개목록 반드시 보존 (투명해짐·색상 뒤바뀜·계가 안 됨 방지)
                                                const serverBoardValid = game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0;
                                                const serverMoveHistoryValid = game.moveHistory && Array.isArray(game.moveHistory) && game.moveHistory.length > 0;
                                                const boardState = serverBoardValid ? game.boardState : (existingGame.boardState ?? game.boardState);
                                                const moveHistory = serverMoveHistoryValid ? game.moveHistory : (existingGame.moveHistory ?? game.moveHistory);
                                                // 기존에 공개된 돌(내 히든 등) + 서버가 이번에 공개한 돌 합침 (서버만 쓰면 이전 공개가 사라져 투명해짐)
                                                const existingRevealed = existingGame.permanentlyRevealedStones ?? [];
                                                const serverRevealed = game.permanentlyRevealedStones ?? [];
                                                const mergedRevealed = [...existingRevealed];
                                                for (const p of serverRevealed) {
                                                    if (!mergedRevealed.some((r: Point) => r.x === p.x && r.y === p.y))
                                                        mergedRevealed.push(p);
                                                }
                                                const hiddenMoves = (existingGame.moveHistory?.length === game.moveHistory?.length && existingGame.hiddenMoves)
                                                    ? existingGame.hiddenMoves
                                                    : (game.hiddenMoves ?? existingGame.hiddenMoves ?? {});
                                                updatedGames[gameId] = {
                                                    ...game,
                                                    boardState,
                                                    moveHistory,
                                                    hiddenMoves,
                                                    permanentlyRevealedStones: mergedRevealed,
                                                    animation: game.animation ?? existingGame.animation,
                                                    revealAnimationEndTime: game.revealAnimationEndTime ?? existingGame.revealAnimationEndTime,
                                                    totalTurns: preservedTotalTurns !== undefined ? preservedTotalTurns : game.totalTurns,
                                                    captures: preservedCaptures ?? game.captures ?? existingGame.captures,
                                                };
                                            } else if (
                                                game.gameStatus === 'playing' &&
                                                !(
                                                    game.mode === GameMode.Capture &&
                                                    !game.isSinglePlayer &&
                                                    game.gameCategory !== 'tower'
                                                ) &&
                                                (game.stageId || (game.settings as any)?.autoScoringTurns)
                                            ) {
                                                // GAME_UPDATE를 받았을 때 자동계가 체크 (AI 수를 둔 경우 등)
                                                try {
                                                    const autoScoringTurns = game.isSinglePlayer && game.stageId
                                                        ? SINGLE_PLAYER_STAGES.find((s: any) => s.id === game.stageId)?.autoScoringTurns
                                                        : (game.settings as any)?.autoScoringTurns;
                                                    
                                                    if (autoScoringTurns != null && autoScoringTurns > 0) {
                                                        // totalTurns는 유효 착수 수만 반영 (서버 totalTurns가 앞서 있으면 마지막 AI 수 없이 계가되는 버그 방지)
                                                        const validMoves = (game.moveHistory || []).filter((m: any) => m.x !== -1 && m.y !== -1);
                                                        const totalTurns = validMoves.length;
                                                        game.totalTurns = totalTurns;
                                                        const remainingTurns = Math.max(0, autoScoringTurns - totalTurns);
                                                        // 자동계가: 남은 턴이 0 이하(0/N 도달)이면 반드시 계가 트리거
                                                        if (remainingTurns <= 0 && totalTurns > 0) {
                                                            // 마지막 수가 AI 차례라면 AI가 실제로 착수한 뒤 계가를 진행해야 함.
                                                            // (클라이언트 AI 착수는 `Game.tsx`에서 처리되므로 여기서는 트리거하지 않고 대기)
                                                            const isAiTurnForSinglePlayer =
                                                                game.isSinglePlayer &&
                                                                ((game.currentPlayer === Player.White && game.whitePlayerId === aiUserId) ||
                                                                 (game.currentPlayer === Player.Black && game.blackPlayerId === aiUserId));
                                                            if (isAiTurnForSinglePlayer) {
                                                                if (process.env.NODE_ENV === 'development') {
                                                                    console.log(`[WebSocket][SinglePlayer] Auto-scoring reached but it's AI turn; waiting for AI move before scoring`, {
                                                                        gameId,
                                                                        totalTurns,
                                                                        autoScoringTurns,
                                                                        currentPlayer: game.currentPlayer,
                                                                    });
                                                                }
                                                            } else {
                                                                const preservedBoardState = game.boardState && game.boardState.length > 0
                                                                    ? game.boardState
                                                                    : (existingGame?.boardState || game.boardState);
                                                                const preservedMoveHistory = game.moveHistory && game.moveHistory.length > 0
                                                                    ? game.moveHistory
                                                                    : (existingGame?.moveHistory || game.moveHistory);
                                                                const preservedTotalTurns = totalTurns;
                                                                const preservedBlackTimeLeft = game.blackTimeLeft ?? existingGame?.blackTimeLeft;
                                                                const preservedWhiteTimeLeft = game.whiteTimeLeft ?? existingGame?.whiteTimeLeft;
                                                                const preservedCaptures = (game.captures && typeof game.captures === 'object' && Object.keys(game.captures).length > 0)
                                                                    ? game.captures
                                                                    : (existingGame?.captures && typeof existingGame.captures === 'object' ? existingGame.captures : game.captures);
                                                                const preservedHiddenMovesWs = existingGame?.hiddenMoves ?? game.hiddenMoves;
                                                                const autoScoringAction = {
                                                                    type: 'PLACE_STONE',
                                                                    payload: {
                                                                        gameId,
                                                                        x: -1,
                                                                        y: -1,
                                                                        totalTurns: preservedTotalTurns,
                                                                        moveHistory: preservedMoveHistory,
                                                                        boardState: preservedBoardState,
                                                                        blackTimeLeft: preservedBlackTimeLeft,
                                                                        whiteTimeLeft: preservedWhiteTimeLeft,
                                                                        captures: preservedCaptures,
                                                                        hiddenMoves: preservedHiddenMovesWs ?? undefined,
                                                                        triggerAutoScoring: true
                                                                    }
                                                                } as any;
                                                                // 히든 모드: 서버가 hidden_final_reveal → scoring 순으로 보내므로, 클라이언트에서 scoring으로 덮어쓰지 않음
                                                                const isHiddenModeWs = game.mode === GameMode.Hidden ||
                                                                    (game.mode === GameMode.Mix && (game.settings as any)?.mixedModes?.includes?.(GameMode.Hidden)) ||
                                                                    ((game.settings as any)?.hiddenStoneCount ?? 0) > 0;
                                                                // 마지막 AI 수가 바둑판에 보인 뒤 계가 진행: 먼저 'playing'으로 보드만 표시, 0.5초 후 (비히든만 로컬 scoring 전환 후) 서버 요청
                                                                if (singlePlayerScoringDelayTimeoutRef.current[gameId] != null) {
                                                                    clearTimeout(singlePlayerScoringDelayTimeoutRef.current[gameId]);
                                                                }
                                                                updatedGames[gameId] = {
                                                                    ...game,
                                                                    gameStatus: 'playing' as const,
                                                                    boardState: preservedBoardState,
                                                                    moveHistory: preservedMoveHistory,
                                                                    totalTurns: preservedTotalTurns,
                                                                    blackTimeLeft: preservedBlackTimeLeft,
                                                                    whiteTimeLeft: preservedWhiteTimeLeft,
                                                                };
                                                                singlePlayerScoringDelayTimeoutRef.current[gameId] = setTimeout(() => {
                                                                    if (!isHiddenModeWs) {
                                                                        setSinglePlayerGames(prev => {
                                                                            const g = prev[gameId];
                                                                            if (!g) return prev;
                                                                            if (g.gameStatus === 'scoring') return prev;
                                                                            return { ...prev, [gameId]: { ...g, gameStatus: 'scoring' as const } };
                                                                        });
                                                                    }
                                                                    handleAction(autoScoringAction).then((result: any) => {
                                                                        if (process.env.NODE_ENV === 'development') {
                                                                            console.log(`[WebSocket][SinglePlayer] Auto-scoring action sent successfully:`, result);
                                                                        }
                                                                    }).catch((err: any) => {
                                                                        console.error(`[WebSocket][SinglePlayer] Failed to trigger auto-scoring on server:`, err);
                                                                    });
                                                                    delete singlePlayerScoringDelayTimeoutRef.current[gameId];
                                                                }, 500);
                                                            }
                                                        }
                                                    }
                                                } catch (err) {
                                                    console.error(`[WebSocket][SinglePlayer] Failed to check auto-scoring from GAME_UPDATE:`, err);
                                                }
                                            } else {
                                                // 일반 상태에서는 서버에서 온 게임 상태 사용
                                                // 스캔 애니메이션 종료(scanning_animating → playing) 시 보드/수순 반드시 보존
                                                const wasScanningAnimating = existingGame?.gameStatus === 'scanning_animating';
                                                const wasMissileAnimatingToPlaying =
                                                    existingGame?.gameStatus === 'missile_animating' && game.gameStatus === 'playing';
                                                const serverBoardValid = game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0 && game.boardState[0] && Array.isArray(game.boardState[0]);
                                                const serverMoveHistoryValid = game.moveHistory && Array.isArray(game.moveHistory) && game.moveHistory.length > 0;
                                                const existingBoardValid = existingGame?.boardState && Array.isArray(existingGame.boardState) && existingGame.boardState.length > 0;
                                                const existingMoveHistoryValid = existingGame?.moveHistory && Array.isArray(existingGame.moveHistory) && existingGame.moveHistory.length > 0;
                                                const preserveBoardFromExisting =
                                                    (wasScanningAnimating || wasMissileAnimatingToPlaying) && (!serverBoardValid && existingBoardValid);
                                                const preserveMoveHistoryFromExisting =
                                                    (wasScanningAnimating || wasMissileAnimatingToPlaying) && (!serverMoveHistoryValid && existingMoveHistoryValid);
                                                const finalBoardState = preserveBoardFromExisting ? existingGame.boardState : (serverBoardValid ? game.boardState : (existingGame?.boardState ?? game.boardState));
                                                const finalMoveHistory = preserveMoveHistoryFromExisting ? existingGame.moveHistory : (serverMoveHistoryValid ? game.moveHistory : (existingGame?.moveHistory ?? game.moveHistory));
                                                const existingRevealedGen = existingGame?.permanentlyRevealedStones ?? [];
                                                const serverRevealedGen = game.permanentlyRevealedStones ?? [];
                                                const mergedRevealed = [...existingRevealedGen];
                                                for (const p of serverRevealedGen) {
                                                    if (!mergedRevealed.some((r: Point) => r.x === p.x && r.y === p.y))
                                                        mergedRevealed.push(p);
                                                }
                                                if (isAnimating || existingGame) {
                                                    updatedGames[gameId] = {
                                                        ...game,
                                                        ...(preserveBoardFromExisting || preserveMoveHistoryFromExisting ? { boardState: finalBoardState, moveHistory: finalMoveHistory } : {}),
                                                        permanentlyRevealedStones: mergedRevealed,
                                                        totalTurns: preservedTotalTurns !== undefined ? preservedTotalTurns : game.totalTurns,
                                                        captures: preservedCaptures
                                                    };
                                                } else {
                                                    updatedGames[gameId] = { ...game, permanentlyRevealedStones: mergedRevealed };
                                                }
                                            }
                                        }
                                const lastMoves = Array.isArray(game.moveHistory)
                                    ? game.moveHistory.slice(Math.max(0, game.moveHistory.length - 4)).map((m: any) => ({
                                        x: m?.x,
                                        y: m?.y,
                                        player: m?.player,
                                    }))
                                    : null;
                                const boardSnapshot = Array.isArray(game.boardState)
                                    ? game.boardState.map((row: any[]) => row?.join?.('') ?? row).slice(0, 3)
                                    : undefined;
                                console.debug('[WebSocket][SinglePlayer] GAME_UPDATE', {
                                    gameId,
                                    stageId: game.stageId,
                                    serverRevision: game.serverRevision,
                                    moveHistoryLength: Array.isArray(game.moveHistory) ? game.moveHistory.length : undefined,
                                    currentPlayer: game.currentPlayer,
                                    gameStatus: game.gameStatus,
                                    lastMove: game.lastMove,
                                    lastMoves,
                                    boardSample: boardSnapshot,
                                });

                                        if (currentUser && game.player1 && game.player2) {
                                            const isPlayer1 = game.player1.id === currentUser.id;
                                            const isPlayer2 = game.player2.id === currentUser.id;
                                            const currentStatus = currentUserStatusRef.current;
                                            const isActiveForGame = !!currentStatus &&
                                                (currentStatus.gameId === gameId || currentStatus.spectatingGameId === gameId) &&
                                                (currentStatus.status === 'in-game' || currentStatus.status === 'spectating');

                                            if ((isPlayer1 || isPlayer2) && isActiveForGame) {
                                                const targetHash = `#/game/${gameId}`;
                                                if (window.location.hash !== targetHash) {
                                                    // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
                                                    if (process.env.NODE_ENV === 'development') {
                                                        console.log('[WebSocket] Routing to single player game:', gameId);
                                                    }
                                                    setTimeout(() => {
                                                        if (window.location.hash !== targetHash) {
                                                            window.location.hash = targetHash;
                                                        }
                                                    }, 100);
                                                }
                                            }
                                        }
                                        return updatedGames;
                                    });
                                } else if (gameCategory === 'tower') {
                                    setTowerGames(currentGames => {
                                        const existingGame = currentGames[gameId];
                                        
                                        // 타워 게임은 클라이언트에서만 실행되므로, 
                                        // 클라이언트의 로컬 상태가 더 최신이면 서버 상태를 무시
                                        if (existingGame) {
                                            const localMidGamePlaying =
                                                existingGame.gameStatus === 'playing' &&
                                                (existingGame.moveHistory?.length ?? 0) > 0;
                                            if (localMidGamePlaying && game.gameStatus === 'pending') {
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.warn(
                                                        '[WebSocket] Tower: ignoring stale pending GAME_UPDATE while local is playing with moves',
                                                        { gameId }
                                                    );
                                                }
                                                return currentGames;
                                            }
                                            const localAdvanced =
                                                existingGame.gameStatus === 'scoring' ||
                                                existingGame.gameStatus === 'hidden_final_reveal' ||
                                                existingGame.gameStatus === 'ended' ||
                                                existingGame.gameStatus === 'no_contest';
                                            if (localAdvanced && game.gameStatus === 'pending') {
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.warn(
                                                        '[WebSocket] Tower: ignoring stale pending GAME_UPDATE while local is scoring/terminal',
                                                        { gameId }
                                                    );
                                                }
                                                return currentGames;
                                            }
                                            if (
                                                existingGame.gameStatus === 'scoring' &&
                                                game.gameStatus === 'playing' &&
                                                (game.moveHistory?.length ?? 0) <= (existingGame.moveHistory?.length ?? 0)
                                            ) {
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.warn(
                                                        '[WebSocket] Tower: ignoring stale playing GAME_UPDATE during local scoring',
                                                        { gameId }
                                                    );
                                                }
                                                return currentGames;
                                            }
                                            const localMoveHistoryLength = existingGame.moveHistory?.length || 0;
                                            const serverMoveHistoryLength = game.moveHistory?.length || 0;
                                            const localServerRevision = existingGame.serverRevision || 0;
                                            const serverRevision = game.serverRevision || 0;
                                            
                                            // 서버가 계가/히든 공개로 전환한 경우는 항상 반영 (공개할 히든 없이 바로 계가 시 멈춤 방지)
                                            const isServerScoringOrReveal = game.gameStatus === 'scoring' || game.gameStatus === 'hidden_final_reveal';
                                            // 종료 패킷은 analysisResult·summary·winner를 실어 오므로 반드시 반영 (무시 시 모달·영토 표시가 비는 버그)
                                            const isServerEndedOrNoContest = game.gameStatus === 'ended' || game.gameStatus === 'no_contest';
                                            // 서버가 아이템 사용 모드로 전환한 경우도 항상 반영 (히든/미사일/스캔 버튼 클릭 후 화면 전환)
                                            const isServerItemMode = game.gameStatus === 'hidden_placing' || game.gameStatus === 'missile_selecting' || game.gameStatus === 'scanning';
                                            // 서버가 미사일 애니메이션 중인 상태를 보낸 경우 반영 (LAUNCH_MISSILE 직후 애니메이션 재생·완료 신호 전송을 위해)
                                            const isServerMissileAnimating = game.gameStatus === 'missile_animating';
                                            // 서버가 미사일/스캔 애니메이션 종료 후 playing으로 복귀한 경우 항상 반영 (애니메이션 멈춤·게임 재개)
                                            const isServerExitingAnimation = (existingGame.gameStatus === 'missile_animating' || existingGame.gameStatus === 'scanning' || existingGame.gameStatus === 'scanning_animating') && game.gameStatus === 'playing';
                                            // 클라이언트가 더 많은 수를 두었거나, 같은 수를 두었지만 클라이언트의 serverRevision이 더 크면 무시 (단, 계가/공개/종료/아이템모드/애니종료 전환은 제외)
                                            if (!isServerScoringOrReveal && !isServerEndedOrNoContest && !isServerItemMode && !isServerMissileAnimating && !isServerExitingAnimation && (localMoveHistoryLength > serverMoveHistoryLength || 
                                                (localMoveHistoryLength === serverMoveHistoryLength && localServerRevision >= serverRevision))) {
                                                // 턴 추가(TOWER_ADD_TURNS) 등: 서버만 알고 있는 필드는 병합 (전체 패킷 무시 시 보너스·리비전 유실 방지)
                                                const serverBonus = Number((game as any).blackTurnLimitBonus) || 0;
                                                const localBonus = Number((existingGame as any).blackTurnLimitBonus) || 0;
                                                const mergedBonus = Math.max(serverBonus, localBonus);
                                                const srvRev = game.serverRevision ?? 0;
                                                const patch: Partial<LiveGameSession> & { blackTurnLimitBonus?: number } = {};
                                                if (mergedBonus !== localBonus) patch.blackTurnLimitBonus = mergedBonus;
                                                if (srvRev > localServerRevision) patch.serverRevision = srvRev;
                                                if (Object.keys(patch).length > 0) {
                                                    return {
                                                        ...currentGames,
                                                        [gameId]: { ...existingGame, ...patch } as LiveGameSession,
                                                    };
                                                }
                                                // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.log('[WebSocket] Tower game - Ignoring server update (client state is newer):', {
                                                        gameId,
                                                        localMoveHistoryLength,
                                                        serverMoveHistoryLength,
                                                        localServerRevision,
                                                        serverRevision
                                                    });
                                                }
                                                return currentGames;
                                            }
                                            
                                            // 중요한 필드만 비교하여 빠른 early return (stableStringify 호출 전에)
                                            const keyFieldsChanged = 
                                                existingGame.gameStatus !== game.gameStatus ||
                                                existingGame.currentPlayer !== game.currentPlayer ||
                                                existingGame.serverRevision !== game.serverRevision ||
                                                (game.animation && existingGame.animation?.type !== game.animation?.type);
                                            
                                            // 중요한 필드가 변경되지 않았을 때만 서명 비교
                                            if (!keyFieldsChanged) {
                                                const previousSignature = towerGameSignaturesRef.current[gameId];
                                                if (previousSignature) {
                                                    // 서명 비교는 비용이 큰 작업이므로 필요한 경우에만 수행
                                                    const signature = stableStringify(game);
                                                    if (previousSignature === signature) {
                                                        return currentGames; // 완전히 동일한 상태
                                                    }
                                                    towerGameSignaturesRef.current[gameId] = signature;
                                                } else {
                                                    towerGameSignaturesRef.current[gameId] = stableStringify(game);
                                                }
                                            } else {
                                                // 중요한 필드가 변경되었으므로 서명 업데이트
                                                towerGameSignaturesRef.current[gameId] = stableStringify(game);
                                            }
                                        } else {
                                            // 새 게임이므로 서명 저장
                                            towerGameSignaturesRef.current[gameId] = stableStringify(game);
                                        }
                                        
                                        const updatedGames = { ...currentGames };
                                        let mergedGame = game;
                                        // 종료된 게임의 GAME_UPDATE 시 클라이언트 바둑판 유지 (서버는 보드 미저장 가능)
                                        if ((game.gameStatus === 'ended' || game.gameStatus === 'no_contest') && existingGame?.boardState &&
                                            Array.isArray(existingGame.boardState) && existingGame.boardState.length > 0) {
                                            mergedGame = { ...game, boardState: existingGame.boardState };
                                            if (existingGame.moveHistory?.length) mergedGame.moveHistory = existingGame.moveHistory;
                                            if (existingGame.blackPatternStones?.length) mergedGame.blackPatternStones = existingGame.blackPatternStones;
                                            if (existingGame.whitePatternStones?.length) mergedGame.whitePatternStones = existingGame.whitePatternStones;
                                        }
                                        // 종료 패킷에 analysisResult가 빠진 경우(직렬화/재조회 이슈), 직전 scoring 단계에서 받은 system 결과 유지
                                        if (
                                            (mergedGame.gameStatus === 'ended' || mergedGame.gameStatus === 'no_contest') &&
                                            existingGame?.analysisResult &&
                                            (existingGame.analysisResult as any)['system'] &&
                                            (!(mergedGame as any).analysisResult || !(mergedGame as any).analysisResult['system'])
                                        ) {
                                            mergedGame = {
                                                ...mergedGame,
                                                analysisResult: {
                                                    ...((mergedGame as any).analysisResult || {}),
                                                    system: (existingGame.analysisResult as any)['system'],
                                                } as any,
                                            };
                                        }
                                        // 스캔 애니메이션 종료(scanning_animating → playing) 시 보드/수순 보존 (대국 복원)
                                        const wasTowerScanningAnimating = existingGame?.gameStatus === 'scanning_animating' && game.gameStatus === 'playing';
                                        const wasTowerMissileAnimating = existingGame?.gameStatus === 'missile_animating' && game.gameStatus === 'playing';
                                        if ((wasTowerScanningAnimating || wasTowerMissileAnimating) && existingGame) {
                                            const serverBoardValid = game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0 && game.boardState[0] && Array.isArray(game.boardState[0]);
                                            const serverMoveHistoryValid = game.moveHistory && Array.isArray(game.moveHistory) && game.moveHistory.length > 0;
                                            const existingBoardValid = existingGame.boardState && Array.isArray(existingGame.boardState) && existingGame.boardState.length > 0;
                                            const existingMoveHistoryValid = existingGame.moveHistory && Array.isArray(existingGame.moveHistory) && existingGame.moveHistory.length > 0;
                                            const useExistingBoard = !serverBoardValid && existingBoardValid;
                                            const useExistingMoves = !serverMoveHistoryValid && existingMoveHistoryValid;
                                            if (useExistingBoard || useExistingMoves) {
                                                mergedGame = {
                                                    ...mergedGame,
                                                    boardState: useExistingBoard ? existingGame.boardState : mergedGame.boardState,
                                                    moveHistory: useExistingMoves ? existingGame.moveHistory : mergedGame.moveHistory,
                                                };
                                            }
                                        }
                                        if (
                                            existingGame &&
                                            (game.gameStatus === 'hidden_placing' ||
                                                game.gameStatus === 'scanning' ||
                                                game.gameStatus === 'missile_selecting')
                                        ) {
                                            mergedGame = mergeTowerServerGameWithClientBoardIfStale(mergedGame, existingGame);
                                        }
                                        // 21층 이상 자동계가: totalTurns를 moveHistory에서 항상 계산해 남은 턴 표시가 줄어들도록 함
                                        const autoScoringTurns = (mergedGame.settings as any)?.autoScoringTurns;
                                        if (autoScoringTurns && Array.isArray(mergedGame.moveHistory)) {
                                            const validMoves = mergedGame.moveHistory.filter((m: any) => m.x !== -1 && m.y !== -1);
                                            mergedGame = { ...mergedGame, totalTurns: validMoves.length };
                                        }
                                        // 서버 계가/종료 브로드캐스트는 boardState·수순을 생략하는 경우가 많음 → 클라 보드/수순 유지 (analysisResult는 서버 페이로드 유지)
                                        if ((mergedGame.gameStatus === 'scoring' || mergedGame.gameStatus === 'ended' || mergedGame.gameStatus === 'no_contest') && existingGame) {
                                            const sb = mergedGame.boardState;
                                            const serverBoardOk = Array.isArray(sb) && sb.length > 0 && sb[0] && Array.isArray(sb[0]) && sb[0].length > 0;
                                            const eb = existingGame.boardState;
                                            const exBoardOk = Array.isArray(eb) && eb.length > 0 && eb[0] && Array.isArray(eb[0]) && eb[0].length > 0;
                                            if (!serverBoardOk && exBoardOk) {
                                                mergedGame = { ...mergedGame, boardState: existingGame.boardState };
                                            }
                                            const sm = mergedGame.moveHistory;
                                            const exm = existingGame.moveHistory;
                                            if ((!Array.isArray(sm) || sm.length === 0) && Array.isArray(exm) && exm.length > 0) {
                                                mergedGame = { ...mergedGame, moveHistory: existingGame.moveHistory };
                                            }
                                        }
                                        if (
                                            (mergedGame.gameStatus === 'scoring' ||
                                                mergedGame.gameStatus === 'hidden_final_reveal' ||
                                                mergedGame.gameStatus === 'ended' ||
                                                mergedGame.gameStatus === 'no_contest') &&
                                            towerGnugoDelayTimeoutRef.current[gameId] != null
                                        ) {
                                            clearTimeout(towerGnugoDelayTimeoutRef.current[gameId]!);
                                            delete towerGnugoDelayTimeoutRef.current[gameId];
                                        }
                                        updatedGames[gameId] = mergedGame;

                                        // 그누고(AI) 수: 1초 지연 후 표시 (유저 수는 클라이언트에서 즉시 반영됨)
                                        const isNewAiMove = hasNewMoves && game.moveHistory?.length > 0 &&
                                            game.whitePlayerId === aiUserId &&
                                            (game.moveHistory[game.moveHistory.length - 1] as any)?.player === Player.White;
                                        const mergedAdvancesToTerminal =
                                            mergedGame.gameStatus === 'scoring' ||
                                            mergedGame.gameStatus === 'hidden_final_reveal' ||
                                            mergedGame.gameStatus === 'ended' ||
                                            mergedGame.gameStatus === 'no_contest';
                                        // 계가·종료 전환은 지연 없이 즉시 반영해야 함. return currentGames만 하면 mergedGame이 버려져
                                        // 계가 연출 중 gameStatus가 pending으로 되돌아가 경기 시작 모달이 다시 뜨는 버그가 난다.
                                        if (isNewAiMove && !mergedAdvancesToTerminal) {
                                            if (towerGnugoDelayTimeoutRef.current[gameId] != null) {
                                                clearTimeout(towerGnugoDelayTimeoutRef.current[gameId]);
                                            }
                                            const gameToApply = JSON.parse(JSON.stringify(mergedGame)) as LiveGameSession;
                                            const isScoringInUpdate = gameToApply.gameStatus === 'scoring';
                                            towerGnugoDelayTimeoutRef.current[gameId] = setTimeout(() => {
                                                delete towerGnugoDelayTimeoutRef.current[gameId];
                                                // 서버가 이미 scoring이면 playing→scoring 깜빡임은 ScoringOverlay를 두 번 마운트시킴 → 즉시 scoring 반영
                                                if (isScoringInUpdate) {
                                                    if (towerScoringDelayTimeoutRef.current[gameId] != null) {
                                                        clearTimeout(towerScoringDelayTimeoutRef.current[gameId]);
                                                        delete towerScoringDelayTimeoutRef.current[gameId];
                                                    }
                                                    setTowerGames(prev => ({ ...prev, [gameId]: gameToApply }));
                                                    lastGameUpdateMoveCountRef.current[gameId] = gameToApply.moveHistory?.length ?? 0;
                                                    towerGameSignaturesRef.current[gameId] = stableStringify(gameToApply);
                                                } else {
                                                    setTowerGames(prev => ({ ...prev, [gameId]: gameToApply }));
                                                    lastGameUpdateMoveCountRef.current[gameId] = gameToApply.moveHistory?.length ?? 0;
                                                    towerGameSignaturesRef.current[gameId] = stableStringify(gameToApply);
                                                }
                                            }, 1000);
                                            return currentGames;
                                        }

                                        if (currentUser && mergedGame.player1 && mergedGame.player2) {
                                            const isPlayer1 = mergedGame.player1.id === currentUser.id;
                                            const isPlayer2 = mergedGame.player2.id === currentUser.id;
                                            const currentStatus = currentUserStatusRef.current;
                                            const isActiveForGame = !!currentStatus &&
                                                (currentStatus.gameId === gameId || currentStatus.spectatingGameId === gameId) &&
                                                (currentStatus.status === 'in-game' || currentStatus.status === 'spectating');

                                            if ((isPlayer1 || isPlayer2) && isActiveForGame) {
                                                const targetHash = `#/game/${gameId}`;
                                                if (window.location.hash !== targetHash) {
                                                    // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
                                                    if (process.env.NODE_ENV === 'development') {
                                                        console.log('[WebSocket] Routing to tower game:', gameId);
                                                    }
                                                    setTimeout(() => {
                                                        if (window.location.hash !== targetHash) {
                                                            window.location.hash = targetHash;
                                                        }
                                                    }, 100);
                                                }
                                            }
                                        }
                                        return updatedGames;
                                    });
                                } else {
                                    setLiveGames(currentGames => {
                                        const existingGame = currentGames[gameId];
                                        // 주사위 바둑 착수: 소켓 패킷이 HTTP보다 늦거나 순서가 뒤바뀌면 낡은 상태로 덮어쓰지 않음
                                        if (
                                            game.gameStatus === 'dice_placing' &&
                                            existingGame?.gameStatus === 'dice_placing'
                                        ) {
                                            const ir = game.serverRevision ?? 0;
                                            const er = existingGame.serverRevision ?? 0;
                                            if (ir < er) {
                                                return currentGames;
                                            }
                                            if (ir === er) {
                                                const im = game.moveHistory?.length ?? 0;
                                                const em = existingGame.moveHistory?.length ?? 0;
                                                if (im < em) {
                                                    return currentGames;
                                                }
                                            }
                                        }
                                        const incomingMoveCount = (game.moveHistory && Array.isArray(game.moveHistory)) ? game.moveHistory.length : 0;
                                        const existingMoveCount = (existingGame?.moveHistory && Array.isArray(existingGame.moveHistory)) ? existingGame.moveHistory.length : 0;
                                        // 새 수(AI 수 등)가 있으면 반드시 반영 - 서명 일치해도 스킵하지 않음 (AI가 둔 수가 사라지는 버그 방지)
                                        const hasNewMoves = incomingMoveCount > existingMoveCount;
                                        const isScoringTransition =
                                            game.gameStatus === 'scoring' && existingGame?.gameStatus !== 'scoring';
                                        if (!hasNewMoves && !isScoringTransition) {
                                            const signature = stableStringify(game);
                                            const previousSignature = liveGameSignaturesRef.current[gameId];
                                            if (previousSignature === signature) {
                                                return currentGames;
                                            }
                                            liveGameSignaturesRef.current[gameId] = signature;
                                        } else {
                                            liveGameSignaturesRef.current[gameId] = stableStringify(game);
                                        }
                                        const updatedGames = { ...currentGames };
                                        let mergedGame: typeof game = game;
                                        const hasServerBoard = game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0 &&
                                            game.boardState.some((row: any[]) => row && Array.isArray(row) && row.some((c: any) => c !== 0 && c != null));
                                        const moveHistoryToDerive = (game.moveHistory && Array.isArray(game.moveHistory) && game.moveHistory.length > 0)
                                            ? game.moveHistory
                                            : ((game.gameStatus === 'scoring' || game.gameStatus === 'ended') && existingGame?.moveHistory && Array.isArray(existingGame.moveHistory) && existingGame.moveHistory.length > 0 ? existingGame.moveHistory : null);

                                        // 낙관적 업데이트(유저 착수) 후 서버보다 오래된 GAME_UPDATE가 도착하면 보드/수순만 유지하고, 턴은 수순 기준으로 설정 (착수 위치 바뀜/사라짐 + 봇 턴 미인식 → 시간승 버그 방지)
                                        const existingBoardValid = existingGame?.boardState && Array.isArray(existingGame.boardState) && existingGame.boardState.length > 0;
                                        if (incomingMoveCount < existingMoveCount && existingBoardValid && existingGame?.moveHistory && Array.isArray(existingGame.moveHistory) && existingGame.moveHistory.length > 0) {
                                            const lastMove = existingGame.moveHistory[existingGame.moveHistory.length - 1];
                                            const nextPlayer = lastMove && (lastMove as any).player === Player.Black ? Player.White : Player.Black;
                                            mergedGame = {
                                                ...game,
                                                boardState: existingGame.boardState,
                                                moveHistory: existingGame.moveHistory,
                                                currentPlayer: nextPlayer,
                                                // 수순을 클라이언트 것으로 맞출 때 hiddenMoves도 함께 맞춰야 스캔 버튼·히든 문양 인덱스가 어긋나지 않음
                                                hiddenMoves: existingGame.hiddenMoves ?? game.hiddenMoves,
                                            };
                                            if ((existingGame as any).koInfo !== undefined) mergedGame.koInfo = (existingGame as any).koInfo;
                                            if ((existingGame as any).lastMove !== undefined) mergedGame.lastMove = (existingGame as any).lastMove;
                                        }

                                        // IMPORTANT: 서버가 boardState를 생략한 경우 moveHistory로 "단순 복원"하면 포획이 반영되지 않아 없던 돌이 생길 수 있음.
                                        // 가능한 한 기존 보드(boardState)를 보존하되, 서버 수순이 이미 늘어난 업데이트(AI 착수 등)에서는 기존 짧은 moveHistory로 덮어쓰면 안 됨(돌 사라짐·착수 불가).
                                        if (!hasServerBoard && existingBoardValid && incomingMoveCount <= existingMoveCount) {
                                            mergedGame = { ...game, boardState: existingGame!.boardState, moveHistory: existingGame?.moveHistory && Array.isArray(existingGame.moveHistory) && existingGame.moveHistory.length > 0 ? existingGame.moveHistory : game.moveHistory };
                                        } else if (!hasServerBoard && moveHistoryToDerive && moveHistoryToDerive.length > 0 && game.settings?.boardSize) {
                                            const boardSize = game.settings.boardSize;
                                            const derivedBoard: number[][] = Array(boardSize).fill(null).map(() => Array(boardSize).fill(Player.None));
                                            for (const move of moveHistoryToDerive) {
                                                if (move && move.x >= 0 && move.x < boardSize && move.y >= 0 && move.y < boardSize) {
                                                    derivedBoard[move.y][move.x] = move.player;
                                                }
                                            }
                                            mergedGame = { ...game, boardState: derivedBoard, moveHistory: game.moveHistory && game.moveHistory.length > 0 ? game.moveHistory : moveHistoryToDerive };
                                        } else if (incomingMoveCount <= existingMoveCount && existingGame?.boardState && Array.isArray(existingGame.boardState) && existingGame.boardState.length > 0 && !hasServerBoard) {
                                            // 서버가 boardState를 보내지 않았고, 서버 수가 기존보다 많지 않을 때만 기존 보드 유지 (AI 수 업데이트 덮어쓰기 방지)
                                            mergedGame = { ...game, boardState: existingGame.boardState };
                                            if (existingGame.moveHistory && Array.isArray(existingGame.moveHistory) && existingGame.moveHistory.length > 0) {
                                                mergedGame.moveHistory = existingGame.moveHistory;
                                                mergedGame.hiddenMoves = existingGame.hiddenMoves ?? mergedGame.hiddenMoves;
                                            }
                                        }
                                        // 온라인 히든: 스캔 애니 종료(scanning_animating → playing) 시 서버가 보드/수순을 생략하면 클라 유지
                                        const wasLiveScanningAnimating =
                                            existingGame?.gameStatus === 'scanning_animating' && game.gameStatus === 'playing';
                                        const wasLiveMissileAnimating =
                                            existingGame?.gameStatus === 'missile_animating' && game.gameStatus === 'playing';
                                        if ((wasLiveScanningAnimating || wasLiveMissileAnimating) && existingGame) {
                                            const serverBoardValid = game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0 && game.boardState[0] && Array.isArray(game.boardState[0]);
                                            const serverMoveHistoryValid = game.moveHistory && Array.isArray(game.moveHistory) && game.moveHistory.length > 0;
                                            const existingBoardValid = existingGame.boardState && Array.isArray(existingGame.boardState) && existingGame.boardState.length > 0;
                                            const existingMoveHistoryValid = existingGame.moveHistory && Array.isArray(existingGame.moveHistory) && existingGame.moveHistory.length > 0;
                                            if (!serverBoardValid && existingBoardValid) {
                                                mergedGame = { ...mergedGame, boardState: existingGame.boardState };
                                            }
                                            if (!serverMoveHistoryValid && existingMoveHistoryValid) {
                                                mergedGame = { ...mergedGame, moveHistory: existingGame.moveHistory };
                                            }
                                            const clientRevealed = existingGame.revealedHiddenMoves;
                                            const serverRevealed = game.revealedHiddenMoves;
                                            if (
                                                wasLiveScanningAnimating &&
                                                clientRevealed &&
                                                typeof clientRevealed === 'object' &&
                                                (!serverRevealed || Object.keys(serverRevealed).length === 0)
                                            ) {
                                                mergedGame = { ...mergedGame, revealedHiddenMoves: clientRevealed };
                                            }
                                        }
                                        // 주사위/도둑 착수: 낙관적은 moveHistory를 늘리지 않아 수순 길이가 같을 때 서버의 낡은 보드가 오면 돌만 사라지고 lastMove만 바뀌는 현상(소리만 남)이 난다.
                                        if (
                                            (game.mode === GameMode.Dice || game.mode === GameMode.Thief) &&
                                            (game.gameStatus === 'dice_placing' || game.gameStatus === 'thief_placing') &&
                                            incomingMoveCount === existingMoveCount &&
                                            existingBoardValid &&
                                            hasServerBoard
                                        ) {
                                            const countBlack = (b: typeof game.boardState) =>
                                                b?.flat().filter((c: number) => c === Player.Black).length ?? 0;
                                            const countWhite = (b: typeof game.boardState) =>
                                                b?.flat().filter((c: number) => c === Player.White).length ?? 0;
                                            const ib = countBlack(game.boardState);
                                            const eb = countBlack(existingGame.boardState);
                                            const iw = countWhite(game.boardState);
                                            const ew = countWhite(existingGame.boardState);
                                            if (eb > ib || ew < iw) {
                                                mergedGame = {
                                                    ...game,
                                                    boardState: existingGame.boardState,
                                                    lastMove: existingGame.lastMove ?? game.lastMove,
                                                    koInfo: existingGame.koInfo ?? game.koInfo,
                                                    stonesToPlace: existingGame.stonesToPlace,
                                                    stonesPlacedThisTurn: existingGame.stonesPlacedThisTurn,
                                                    diceCapturesThisTurn: existingGame.diceCapturesThisTurn,
                                                    diceLastCaptureStones: existingGame.diceLastCaptureStones,
                                                    moveHistory: existingGame.moveHistory ?? game.moveHistory,
                                                };
                                            }
                                        }
                                        // 전략바둑 AI 대국: 같은 수인데 서버가 낡은 GAME_UPDATE인 경우 보드/수순/턴 유지 (돌 위치 바뀜·시간승 버그 방지)
                                        // 주사위/도둑 착수는 위에서 처리 — 여기서 sameLastMove로 서버 보드를 덮어쓰면 안 됨
                                        const playfulPlacingStaleMerge =
                                            (game.mode === GameMode.Dice && game.gameStatus === 'dice_placing') ||
                                            (game.mode === GameMode.Thief && game.gameStatus === 'thief_placing');
                                        // 주사위/도둑: 착수 기록의 player는 항상 흑(따내는 돌)이라 moveHistory만으로 "다음 턴 색"을 추론하면 항상 백이 됨.
                                        // AI가 백일 때 오버샷 후 서버가 currentPlayer를 흑(유저)으로내도 stale로 오판해 AI 턴으로 되돌리는 버그가 난다.
                                        if (
                                            (game.isAiGame || game.gameCategory === 'guildwar') &&
                                            !playfulPlacingStaleMerge &&
                                            game.mode !== GameMode.Dice &&
                                            game.mode !== GameMode.Thief &&
                                            game.gameStatus !== 'missile_animating' &&
                                            incomingMoveCount === existingMoveCount &&
                                            existingBoardValid &&
                                            existingGame?.moveHistory?.length > 0
                                        ) {
                                            const lastExisting = existingGame.moveHistory[existingGame.moveHistory.length - 1];
                                            const lastIncoming = game.moveHistory?.[game.moveHistory.length - 1];
                                            const sameLastMove = lastExisting && lastIncoming &&
                                                (lastExisting as any).x === (lastIncoming as any).x &&
                                                (lastExisting as any).y === (lastIncoming as any).y &&
                                                (lastExisting as any).player === (lastIncoming as any).player;
                                            const aiPlayerEnum = game.whitePlayerId === aiUserId ? Player.White : Player.Black;
                                            const nextAfterLast = lastExisting && (lastExisting as any).player === Player.Black ? Player.White : Player.Black;
                                            const serverTurnStale = nextAfterLast === aiPlayerEnum && game.currentPlayer !== aiPlayerEnum;
                                            if (sameLastMove && (serverTurnStale || !hasServerBoard)) {
                                                mergedGame = {
                                                    ...game,
                                                    boardState: existingGame.boardState,
                                                    moveHistory: existingGame.moveHistory,
                                                    currentPlayer: serverTurnStale ? existingGame.currentPlayer : game.currentPlayer,
                                                    hiddenMoves: existingGame.hiddenMoves ?? game.hiddenMoves,
                                                };
                                                if ((existingGame as any).koInfo !== undefined) mergedGame.koInfo = (existingGame as any).koInfo;
                                                if ((existingGame as any).lastMove !== undefined) mergedGame.lastMove = (existingGame as any).lastMove;
                                            } else if (serverTurnStale) {
                                                mergedGame = { ...mergedGame, currentPlayer: existingGame.currentPlayer };
                                            }
                                        }
                                        // 미사일 비행 중 GAME_UPDATE: 앞선 병합이 낡은 보드/수순을 남겨도 서버 최종 상태로 덮어 애니 종료 시점과 보드가 일치하게 함
                                        if (
                                            game.gameStatus === 'missile_animating' &&
                                            hasServerBoard &&
                                            game.moveHistory &&
                                            Array.isArray(game.moveHistory) &&
                                            game.moveHistory.length > 0
                                        ) {
                                            mergedGame = {
                                                ...mergedGame,
                                                boardState: game.boardState,
                                                moveHistory: game.moveHistory,
                                                captures: game.captures ?? mergedGame.captures,
                                                lastMove: game.lastMove ?? mergedGame.lastMove,
                                                koInfo: game.koInfo !== undefined ? game.koInfo : mergedGame.koInfo,
                                                justCaptured: game.justCaptured ?? mergedGame.justCaptured,
                                                animation: game.animation ?? mergedGame.animation,
                                                permanentlyRevealedStones:
                                                    game.permanentlyRevealedStones ?? mergedGame.permanentlyRevealedStones,
                                                baseStones: game.baseStones ?? mergedGame.baseStones,
                                                blackPatternStones: game.blackPatternStones ?? mergedGame.blackPatternStones,
                                                whitePatternStones: game.whitePatternStones ?? mergedGame.whitePatternStones,
                                                hiddenMoves: game.hiddenMoves ?? mergedGame.hiddenMoves,
                                            };
                                        }
                                        updatedGames[gameId] = mergedGame;

                                        // 전략바둑 AI(KATA 등) 수: 짧은 지연 후 표시 (바로 두면 연출·턴 표시가 어색함)
                                        // 주사위/도둑 등 놀이바둑은 지연을 쓰지 않음
                                        const STRATEGIC_AI_MOVE_DELAY_MS = 1000;
                                        const isDiceOrThiefPlayful =
                                            game.mode === GameMode.Dice || game.mode === GameMode.Thief;
                                        const isStrategicAiGame =
                                            game.isAiGame && game.moveHistory?.length > 0 && !isDiceOrThiefPlayful;
                                        const lastMove = (game.moveHistory as any[])?.[game.moveHistory.length - 1];
                                        const aiPlayerEnum = game.whitePlayerId === aiUserId ? Player.White : Player.Black;
                                        const isNewAiMoveLive = isStrategicAiGame && hasNewMoves && lastMove?.player === aiPlayerEnum;
                                        // 모험/길드전: 서버가 유저 착수 후 1초 뒤 AI를 반영하므로 클라에서 또 1초 미루면 체감이 2초가 된다.
                                        const deferStrategicAiMoveForEffect =
                                            isNewAiMoveLive &&
                                            game.gameCategory !== 'adventure' &&
                                            game.gameCategory !== 'guildwar';
                                        if (deferStrategicAiMoveForEffect) {
                                            if (liveGameGnugoDelayTimeoutRef.current[gameId] != null) {
                                                clearTimeout(liveGameGnugoDelayTimeoutRef.current[gameId]);
                                            }
                                            const gameToApply = JSON.parse(JSON.stringify(mergedGame)) as LiveGameSession;
                                            liveGameGnugoDelayTimeoutRef.current[gameId] = setTimeout(() => {
                                                setLiveGames(prev => ({ ...prev, [gameId]: gameToApply }));
                                                lastGameUpdateMoveCountRef.current[gameId] = gameToApply.moveHistory?.length ?? 0;
                                                liveGameSignaturesRef.current[gameId] = stableStringify(gameToApply);
                                                delete liveGameGnugoDelayTimeoutRef.current[gameId];
                                            }, STRATEGIC_AI_MOVE_DELAY_MS);
                                            return currentGames;
                                        }

                                        if (currentUser && game.player1 && game.player2) {
                                            const isPlayer1 = game.player1.id === currentUser.id;
                                            const isPlayer2 = game.player2.id === currentUser.id;
                                            const currentStatus = currentUserStatusRef.current;
                                            const isActiveForGame = !!currentStatus &&
                                                (currentStatus.gameId === gameId || currentStatus.spectatingGameId === gameId) &&
                                                (currentStatus.status === 'in-game' || currentStatus.status === 'spectating');

                                            if ((isPlayer1 || isPlayer2) && isActiveForGame) {
                                                const targetHash = `#/game/${gameId}`;
                                                if (window.location.hash !== targetHash) {
                                                    // 성능 최적화: 불필요한 로깅 제거 (프로덕션)
                                                    if (process.env.NODE_ENV === 'development') {
                                                        console.log('[WebSocket] Routing to game:', gameId);
                                                    }
                                                    setTimeout(() => {
                                                        if (window.location.hash !== targetHash) {
                                                            window.location.hash = targetHash;
                                                        }
                                                    }, 100);
                                                }
                                            }
                                        }
                                        return updatedGames;
                                    });
                                }
                            });
                            return;
                        }
                        case 'MUTUAL_DISCONNECT_ENDED': {
                            const msg = message.payload?.message ?? '양쪽 유저의 접속이 모두 끊어져 대국이 종료되었습니다.';
                            setMutualDisconnectMessage(msg);
                            return;
                        }
                        case 'OTHER_DEVICE_LOGIN': {
                            if (message.payload?.reason === OTHER_DEVICE_LOGIN_SHARED_PC_REASON) {
                                try {
                                    sessionStorage.removeItem('currentUser');
                                } catch {
                                    // ignore
                                }
                                setCurrentUser(null);
                                setShowOtherDeviceLoginModal(false);
                                replaceAppHash('#/login');
                                return;
                            }
                            setShowOtherDeviceLoginModal(true);
                            return;
                        }
                        case 'GAME_DELETED': {
                            const deletedGameId = message.payload?.gameId;
                            const serverGameCategory = message.payload?.gameCategory;
                            if (!deletedGameId) return;

                            try {
                                sessionStorage.removeItem(`gameState_${deletedGameId}`);
                            } catch {
                                // ignore
                            }
                            delete lastGameUpdateTimeRef.current[deletedGameId];
                            delete lastGameUpdateMoveCountRef.current[deletedGameId];
                            if (towerGnugoDelayTimeoutRef.current[deletedGameId] != null) {
                                clearTimeout(towerGnugoDelayTimeoutRef.current[deletedGameId]);
                                delete towerGnugoDelayTimeoutRef.current[deletedGameId];
                            }
                            if (towerScoringDelayTimeoutRef.current[deletedGameId] != null) {
                                clearTimeout(towerScoringDelayTimeoutRef.current[deletedGameId]);
                                delete towerScoringDelayTimeoutRef.current[deletedGameId];
                            }
                            if (liveGameGnugoDelayTimeoutRef.current[deletedGameId] != null) {
                                clearTimeout(liveGameGnugoDelayTimeoutRef.current[deletedGameId]);
                                delete liveGameGnugoDelayTimeoutRef.current[deletedGameId];
                            }

                            const removeFromGames = (setter: any, signaturesRef: Record<string, string>) => {
                                setter((currentGames: Record<string, any>) => {
                                    if (!currentGames[deletedGameId]) return currentGames;
                                    const updatedGames = { ...currentGames };
                                    delete updatedGames[deletedGameId];
                                    delete signaturesRef[deletedGameId];
                                    return updatedGames;
                                });
                            };

                            if (singlePlayerScoringDelayTimeoutRef.current[deletedGameId] != null) {
                                clearTimeout(singlePlayerScoringDelayTimeoutRef.current[deletedGameId]);
                                delete singlePlayerScoringDelayTimeoutRef.current[deletedGameId];
                            }
                            if (serverGameCategory === 'singleplayer') {
                                removeFromGames(setSinglePlayerGames, singlePlayerGameSignaturesRef.current);
                            } else if (serverGameCategory === 'tower') {
                                removeFromGames(setTowerGames, towerGameSignaturesRef.current);
                            } else if (serverGameCategory === 'normal') {
                                removeFromGames(setLiveGames, liveGameSignaturesRef.current);
                            } else {
                                removeFromGames(setLiveGames, liveGameSignaturesRef.current);
                                removeFromGames(setSinglePlayerGames, singlePlayerGameSignaturesRef.current);
                                removeFromGames(setTowerGames, towerGameSignaturesRef.current);
                            }

                            // 삭제된 대국실 페이지에 있으면 먼저 재입장 1회 시도 후 실패 시 리다이렉트
                            const currentHash = window.location.hash;
                            const isOnDeletedGamePage = currentHash.startsWith('#/game/') && currentHash.includes(deletedGameId);
                            if (isOnDeletedGamePage) {
                                const tryRejoinAfterDelete = async () => {
                                    try {
                                        if (!currentUser?.id) throw new Error('no_current_user');
                                        const res = await fetch(getApiUrl('/api/game/rejoin'), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ userId: currentUser.id, gameId: deletedGameId }),
                                            credentials: 'omit',
                                        });
                                        const data = await res.json().catch(() => ({}));
                                        if (res.ok && data?.game) {
                                            const g = data.game as LiveGameSession;
                                            const category = g.gameCategory || (g.isSinglePlayer ? 'singleplayer' : 'normal');
                                            if (category === 'singleplayer') {
                                                setSinglePlayerGames(prev => ({ ...prev, [g.id]: g }));
                                            } else if (category === 'tower') {
                                                setTowerGames(prev => ({ ...prev, [g.id]: g }));
                                            } else {
                                                setLiveGames(prev => ({ ...prev, [g.id]: g }));
                                            }
                                            console.log('[WebSocket] GAME_DELETED received but rejoin succeeded, keeping game page:', deletedGameId);
                                            return;
                                        }
                                    } catch {
                                        // ignore and fallback redirect
                                    }

                                    let redirectHash = '#/';
                                    if (serverGameCategory === 'tower') redirectHash = '#/tower';
                                    else if (serverGameCategory === 'singleplayer') redirectHash = '#/singleplayer';
                                    console.log(`[WebSocket] Game deleted (category: ${serverGameCategory ?? 'unknown'}), rejoin failed, routing to ${redirectHash}`);
                                    setTimeout(() => {
                                        replaceAppHash(redirectHash);
                                    }, 100);
                                };
                                void tryRejoinAfterDelete();
                            }
                            return;
                        }
                        case 'CHALLENGE_DECLINED': {
                            if (message.payload?.challengerId === currentUser?.id && message.payload?.declinedMessage) {
                                showError(message.payload.declinedMessage.message);
                            }
                            return;
                        }
                        case 'NEGOTIATION_UPDATE': {
                            if (message.payload?.negotiations) {
                                const updatedNegotiations = JSON.parse(JSON.stringify(message.payload.negotiations));
                                setNegotiations(updatedNegotiations);
                            }
                            if (message.payload?.userStatuses) {
                                setOnlineUsers(prevOnlineUsers => {
                                    const updatedStatuses = message.payload.userStatuses;
                                    return prevOnlineUsers.map(user => {
                                        const statusInfo = updatedStatuses[user.id];
                                        if (statusInfo) {
                                            return { ...user, ...statusInfo };
                                        }
                                        return user;
                                    });
                                });
                            }
                            return;
                        }
                        case 'ANNOUNCEMENT_UPDATE': {
                            const { announcements: anns, globalOverrideAnnouncement: override, announcementInterval: interval } = message.payload || {};
                            if (Array.isArray(anns)) setAnnouncements(anns);
                            if (override !== undefined) setGlobalOverrideAnnouncement(override);
                            if (typeof interval === 'number') setAnnouncementInterval(interval);
                            return;
                        }
                        case 'GAME_MODE_AVAILABILITY_UPDATE': {
                            const { gameModeAvailability: availability } = message.payload || {};
                            if (availability) setGameModeAvailability(availability);
                            return;
                        }
                        case 'ARENA_ENTRANCE_AVAILABILITY_UPDATE': {
                            const { arenaEntranceAvailability: arenaAvail } = message.payload || {};
                            if (arenaAvail && typeof arenaAvail === 'object') {
                                setArenaEntranceAvailability(mergeArenaEntranceAvailability(arenaAvail));
                            }
                            return;
                        }
                        case 'HOME_BOARD_POSTS_UPDATE': {
                            const { homeBoardPosts: posts } = message.payload || {};
                            if (Array.isArray(posts)) setHomeBoardPosts(posts);
                            return;
                        }
                        case 'TOURNAMENT_STATE_UPDATE': {
                            const { tournamentState, tournamentType } = message.payload || {};
                            if (currentUserRef.current && tournamentState) {
                                setUsersMap(prev => ({
                                    ...prev,
                                    [currentUserRef.current!.id]: {
                                        ...prev[currentUserRef.current!.id],
                                        [`last${tournamentType.charAt(0).toUpperCase() + tournamentType.slice(1)}Tournament`]: tournamentState
                                    }
                                }));
                            }
                            return;
                        }
                        case 'GUILD_UPDATE': {
                            const { guilds: updatedGuilds } = message.payload || {};
                            if (updatedGuilds && typeof updatedGuilds === 'object') {
                                setGuilds(prev => ({ ...prev, ...updatedGuilds }));
                            }
                            return;
                        }
                        case 'GUILD_MESSAGE': {
                            // Guild message is sent to specific users via sendToUser
                            // Components should handle this in their own message handlers
                            return;
                        }
                        case 'GUILD_MISSION_UPDATE': {
                            // Guild mission update is sent to specific users via sendToUser
                            // Components should handle this in their own message handlers
                            return;
                        }
                        case 'GUILD_WAR_UPDATE': {
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('sudamr:guild-war-update'));
                            }
                            return;
                        }
                        case 'ERROR': {
                            console.error('[WebSocket] Error message:', message.payload?.message || 'Unknown error');
                            return;
                        }
                        default: {
                            // broadcast({ guilds }) 형태의 메시지도 처리 (타입이 없는 경우)
                            if ((message as any).guilds && typeof (message as any).guilds === 'object') {
                                setGuilds(prev => ({ ...prev, ...(message as any).guilds }));
                            }
                            // payload.guilds가 있는 경우 처리
                            if (message.payload?.guilds && typeof message.payload.guilds === 'object') {
                                setGuilds(prev => ({ ...prev, ...message.payload.guilds }));
                            }
                            // 기존 default 처리 (이미 다른 case에서 처리되지 않은 경우)
                            if (message.type && !['USER_UPDATE', 'USER_STATUS_UPDATE', 'GAME_UPDATE', 'NEGOTIATION_UPDATE', 'CHAT_MESSAGE', 'WAITING_ROOM_CHAT', 'GAME_CHAT', 'TOURNAMENT_UPDATE', 'RANKED_MATCHING_UPDATE', 'RANKED_MATCH_FOUND', 'GUILD_UPDATE', 'GUILD_MESSAGE', 'GUILD_MISSION_UPDATE', 'GUILD_WAR_UPDATE', 'ERROR', 'INITIAL_STATE', 'INITIAL_STATE_START', 'INITIAL_STATE_CHUNK', 'CONNECTION_ESTABLISHED', 'MUTUAL_DISCONNECT_ENDED', 'OTHER_DEVICE_LOGIN', 'SCHEDULER_MIDNIGHT_COMPLETE', 'ARENA_ENTRANCE_AVAILABILITY_UPDATE'].includes(message.type)) {
                                console.warn('[WebSocket] Unhandled message type:', message.type);
                            }
                            return;
                        }
                    }
                }

                ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        handleMessage(message);
                    } catch (error) {
                        console.error('[WebSocket] Error parsing message:', error);
                    }
                };

                ws.onerror = (error: Event) => {
                    // WebSocket 에러는 일반적으로 연결 문제를 나타내지만,
                    // 자동 재연결 로직이 처리하므로 사용자에게 보여줄 필요는 없음
                    // 개발 환경에서만 디버그 로그 출력
                    const isDevelopment = window.location.hostname === 'localhost' || 
                                         window.location.hostname === '127.0.0.1' ||
                                         window.location.hostname.includes('192.168');
                    
                    // WebSocket 상태 확인
                    const wsState = ws ? ws.readyState : -1;
                    const isConnectingError = wsState === WebSocket.CONNECTING || wsState === WebSocket.CLOSING;
                    
                    // 연결 중이거나 종료 중인 경우의 에러는 정상적인 흐름일 수 있음
                    if (isConnectingError) {
                        // 개발 환경에서만 조용히 로그 (console.debug는 개발자 도구에서 필터링 가능)
                        if (isDevelopment) {
                            console.debug('[WebSocket] Connection error during state transition (will reconnect automatically)');
                        }
                    } else {
                        // 개발 환경에서만 경고 로그
                        if (isDevelopment) {
                            console.debug('[WebSocket] Connection error detected (will attempt to reconnect)');
                        }
                    }
                    
                    // 에러 발생 시 연결 종료 처리
                    isConnecting = false;
                    if (connectionTimeout) {
                        clearTimeout(connectionTimeout);
                        connectionTimeout = null;
                    }
                    
                    // 연결이 CONNECTING 상태에서 실패한 경우
                    if (ws && ws.readyState === WebSocket.CONNECTING) {
                        softCloseWebSocket(ws);
                    }
                    
                    // 에러 발생 시 재연결 시도 (의도적 종료가 아닌 경우)
                    if (!isIntentionalClose && shouldReconnect && currentUser) {
                        scheduleReconnect('error');
                    }
                };

                ws.onclose = (event) => {
                    isConnecting = false; // 연결 종료됨
                    if (connectionTimeout) {
                        clearTimeout(connectionTimeout);
                        connectionTimeout = null;
                    }
                    if (initialStateTimeout) {
                        clearTimeout(initialStateTimeout);
                        initialStateTimeout = null;
                    }
                    pendingMessages = [];
                    isInitialStateReady = true;
                    console.log('[WebSocket] Disconnected', {
                        code: event.code,
                        reason: event.reason,
                        wasClean: event.wasClean,
                        codeMeaning: getCloseCodeMeaning(event.code),
                        wasIntentional: isIntentionalClose
                    });
                    
                    // 1001 (Going Away)는 브라우저가 페이지를 떠날 때 발생할 수 있으므로
                    // 의도적인 종료가 아닌 경우에만 재연결
                    if (!isIntentionalClose && shouldReconnect && currentUser) {
                        const reason =
                            event.code === 1012 || event.code === 1013
                                ? 'server restart (service unavailable)'
                                : 'disconnected';
                        scheduleReconnect(reason);
                    } else {
                        console.log('[WebSocket] Not reconnecting:', {
                            isIntentionalClose,
                            shouldReconnect,
                            hasCurrentUser: !!currentUser,
                            isConnecting
                        });
                    }
                };
            } catch (error) {
                isConnecting = false; // 연결 실패
                console.error('[WebSocket] Failed to create connection:', error);
                if (shouldReconnect && currentUser) {
                    scheduleReconnect('connection failed');
                }
            }
        }

        connectWebSocket();

        return () => {
            shouldReconnect = false;
            isIntentionalClose = true;
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
            if (initialStateTimeout) {
                clearTimeout(initialStateTimeout);
                initialStateTimeout = null;
            }
            if (serverReconnectTimerRef.current !== null) {
                window.clearTimeout(serverReconnectTimerRef.current);
                serverReconnectTimerRef.current = null;
            }
            setServerReconnectNotice(null);
            pendingMessages = [];
            isInitialStateReady = true;
            if (ws) {
                const s = ws;
                ws = null;
                softCloseWebSocket(s);
            }
        };
    }, [currentUser?.id]); // Only depend on currentUser.id to avoid unnecessary reconnections

    // --- Navigation Logic ---
    const initialRedirectHandled = useRef(false);
    useEffect(() => { currentRouteRef.current = currentRoute; }, [currentRoute]);
    
    useEffect(() => {
        const handleHashChange = () => {
            const prevRoute = currentRouteRef.current;
            const newRoute = parseHash(window.location.hash);
            const isExiting = (prevRoute.view === 'profile' && newRoute.view === 'login' && window.location.hash === '');
            
            if (isExiting && currentUser) {
                if (showExitToast) { handleLogout(); } 
                else {
                    setShowExitToast(true);
                    exitToastTimer.current = window.setTimeout(() => setShowExitToast(false), 2000);
                    window.history.pushState(null, '', '#/profile');
                    return;
                }
            } else {
                if (exitToastTimer.current) clearTimeout(exitToastTimer.current);
                if (showExitToast) setShowExitToast(false);
            }
            setCurrentRoute(newRoute);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [currentUser, handleLogout, showExitToast]);

    useEffect(() => {
        if (!currentUser) {
            initialRedirectHandled.current = false;
            if (window.location.hash && window.location.hash !== '#/register') window.location.hash = '';
            return;
        }
        const currentHash = window.location.hash;
        
        if (!initialRedirectHandled.current) {
            initialRedirectHandled.current = true;
    
            if (currentHash === '' || currentHash === '#/') {
                if (activeGame) {
                    window.location.hash = `#/game/${activeGame.id}`;
                    return;
                }
                window.location.hash = '#/profile';
                return;
            }
            // 길드 관련 페이지(#/guild, #/guildboss, #/guildwar)에서는 새로고침 시 해당 화면 유지
            // (리다이렉트하지 않음 - GuildHome/GuildBoss/GuildWar에서 로딩 처리)
        }
        
        const isGamePage = currentHash.startsWith('#/game/');
        const isAdventurePage = currentHash.startsWith('#/adventure');
        const hashNoQuery = currentHash.split('?')[0];
        const isGuildShellPage =
            hashNoQuery === '#/guild' || hashNoQuery === '#/guildboss' || hashNoQuery === '#/guildwar';

        if (activeGame && !isGamePage) {
            // 관리자 모험 테스트: 진행 중 대국이 있어도 #/adventure 유지 (강제 복귀 방지)
            if (isAdventurePage) {
                return;
            }
            // 길드 화면: 길드전 한 판(#/game/...)과 별도 — 대기실·보스·홈은 경기 중에도 유지
            if (isGuildShellPage) {
                return;
            }
            // 종료·무효·재대결 대기 대국은 "대국으로 복귀"시키지 않음(나가기 직후 라우팅 레이스·전면 광고 이후 유령 복귀 방지)
            const gs = activeGame.gameStatus;
            if (gs === 'ended' || gs === 'no_contest' || gs === 'rematch_pending') {
                return;
            }
            // 나가기 클릭 직후: postGameRedirect가 현재 해시와 같으면 경기장으로 다시 보내지 않음 (상태 갱신 전 리다이렉트 방지)
            const postRedirect = sessionStorage.getItem('postGameRedirect');
            if (postRedirect && currentHash === postRedirect) {
                sessionStorage.removeItem('postGameRedirect');
                return;
            }
            console.log('[useApp] Routing to game:', activeGame.id);
            window.location.hash = `#/game/${activeGame.id}`;
        } else if (!activeGame && isGamePage) {
            const urlGameId = currentHash.replace('#/game/', '').split('/')[0];
            const gameInStore = liveGames[urlGameId] || singlePlayerGames[urlGameId] || towerGames[urlGameId];
            // 경기 종료(ended/no_contest/scoring) 후 새로고침 시 경기장 화면 유지: 해당 게임이 스토어에 있으면 리다이렉트하지 않음
            if (gameInStore && ['ended', 'no_contest', 'scoring'].includes(gameInStore.gameStatus || '')) {
                return;
            }
            // 나가기 버튼으로 설정된 대기실/탑/싱글 이동 경로가 있으면 우선 사용 (나가기 클릭 시 대기실로 이동)
            const postRedirect = sessionStorage.getItem('postGameRedirect');
            if (postRedirect) {
                sessionStorage.removeItem('postGameRedirect');
                if (currentHash !== postRedirect) {
                    replaceAppHash(postRedirect);
                }
                return;
            }
            // 새로고침(F5) 후 재입장 API 실패 시에만 리다이렉트 (AI/PVP 공통, 성공 시 activeGame 폴백으로 이어하기)
            if (rejoinFailedForGameId === urlGameId) {
                let targetHash = '#/profile';
                if (currentUserWithStatus?.status === 'waiting' && currentUserWithStatus?.mode) {
                    targetHash = `#/waiting/${encodeURIComponent(currentUserWithStatus.mode)}`;
                }
                if (currentHash !== targetHash) {
                    replaceAppHash(targetHash);
                }
                return;
            }
            // AI 게임 진입 직후: state 반영 전 레이스 컨디션으로 리다이렉트하지 않음 (3초 유예)
            const pending = pendingAiGameEntryRef.current;
            const isPendingAiEntry = pending?.gameId === urlGameId && Date.now() < pending.until;
            const isAiGame = liveGames[urlGameId]?.isAiGame;
            // gameInStore는 위에서 이미 선언됨
            // 게임이 이미 스토어에 있으면 activeGame 폴백이 처리하므로 리다이렉트 불필요
            // 스토어에 없으면 재입장 effect가 시도할 때까지 리다이렉트하지 않음
            if (!gameInStore && !isAiGame && !isPendingAiEntry) {
                // 재입장 대기 중: 리다이렉트하지 않음
                return;
            }
            if (!isAiGame && !isPendingAiEntry && gameInStore) {
                // 게임이 스토어에 있으면 URL 기반 activeGame 폴백으로 표시됨
                return;
            }
            // 기존: AI 게임이거나 pending entry면 리다이렉트하지 않음 (게임 페이지 유지)
        }
    }, [currentUser, activeGame, currentUserWithStatus, liveGames, singlePlayerGames, towerGames, rejoinFailedForGameId]);

    /**
     * 서버 userStatuses는 in-game인데 INITIAL_STATE의 liveGames 등에 해당 방이 없을 때(목록 상한·타이밍 등).
     * 대기실(#/waiting/...)에 머물러 있어도 rejoin으로 스토어를 채우면 activeGame·라우팅 이펙트가 경기장으로 보냄.
     * (관전은 rejoin이 참가자만 허용하므로 제외)
     *
     * 의존성은 userId·gameId만 둠: onlineUsers·타 유저 게임 갱신으로 타이머가 계속 리셋되는 것을 막기 위함.
     * 스토어에 이미 들어왔는지는 타이머 시점에 ref로 확인.
     */
    const inGameRecoveryGameId =
        currentUser && currentUserWithStatus?.status === 'in-game' && currentUserWithStatus.gameId
            ? currentUserWithStatus.gameId
            : '';

    useEffect(() => {
        if (!inGameRecoveryGameId) return;

        const gid = inGameRecoveryGameId;
        if (rejoinRequestedRef.current.has(gid)) return;
        rejoinRequestedRef.current.add(gid);

        const t = setTimeout(async () => {
            try {
                const uid = currentUserRef.current?.id;
                if (!uid) return;

                const inStore =
                    liveGamesRef.current[gid] ||
                    singlePlayerGamesRef.current[gid] ||
                    towerGamesRef.current[gid];
                if (inStore) return;

                const res = await fetch(getApiUrl('/api/game/rejoin'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: uid, gameId: gid }),
                    credentials: 'omit',
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.game) {
                    const g = data.game as LiveGameSession;
                    const category = g.gameCategory || (g.isSinglePlayer ? 'singleplayer' : 'normal');
                    if (category === 'singleplayer') {
                        setSinglePlayerGames(prev => ({ ...prev, [g.id]: g }));
                    } else if (category === 'tower') {
                        setTowerGames(prev => ({ ...prev, [g.id]: g }));
                    } else {
                        setLiveGames(prev => ({ ...prev, [g.id]: g }));
                    }
                    setRejoinFailedForGameId(prev => (prev === gid ? null : prev));
                }
            } catch {
                /* 게임 URL 재입장 effect가 이어서 시도 */
            } finally {
                rejoinRequestedRef.current.delete(gid);
            }
        }, 400);

        return () => {
            clearTimeout(t);
            rejoinRequestedRef.current.delete(gid);
        };
    }, [inGameRecoveryGameId]);

    // 새로고침(F5) 후 게임 페이지에서 재입장 API 호출 - AI/PVP 공통 (INITIAL_STATE 대기 후)
    useEffect(() => {
        const view = currentRoute?.view;
        const gameId = currentRoute?.view === 'game' ? (currentRoute.params?.id ?? '') : '';
        if (!currentUser || view !== 'game' || !gameId) {
            if (gameId) setRejoinFailedForGameId(prev => (prev === gameId ? null : prev));
            return;
        }
        const gameInStore = liveGames[gameId] || singlePlayerGames[gameId] || towerGames[gameId];
        if (gameInStore && hasHydratedBoardGridForRejoin(gameInStore)) {
            setRejoinFailedForGameId(prev => (prev === gameId ? null : prev));
            return;
        }
        if (rejoinRequestedRef.current.has(gameId)) return;
        rejoinRequestedRef.current.add(gameId);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(getApiUrl('/api/game/rejoin'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id, gameId }),
                    credentials: 'omit',
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.game) {
                    const g = data.game as LiveGameSession;
                    const category = g.gameCategory || (g.isSinglePlayer ? 'singleplayer' : 'normal');
                    if (category === 'singleplayer') {
                        setSinglePlayerGames(prev => ({ ...prev, [g.id]: g }));
                    } else if (category === 'tower') {
                        setTowerGames(prev => ({ ...prev, [g.id]: g }));
                    } else {
                        setLiveGames(prev => ({ ...prev, [g.id]: g }));
                    }
                    setRejoinFailedForGameId(prev => (prev === gameId ? null : prev));
                    return;
                }
                setRejoinFailedForGameId(gameId);
            } catch {
                setRejoinFailedForGameId(gameId);
            } finally {
                rejoinRequestedRef.current.delete(gameId);
            }
        }, 2500);
        return () => clearTimeout(t);
    }, [currentUser, currentRoute?.view, currentRoute?.params?.id, liveGames, singlePlayerGames, towerGames]);

    // 계가 중(scoring) 새로고침 시 KataGo 결과 수신: scoring 상태인 활성 게임이 있으면 rejoin 폴링하여 결과 반영
    useEffect(() => {
        const gameId = currentRoute?.view === 'game' ? (currentRoute.params?.id ?? '') : '';
        if (!currentUser || !gameId) return;
        const game = liveGames[gameId] || singlePlayerGames[gameId] || towerGames[gameId];
        if (!game || game.gameStatus !== 'scoring') return;

        const SCORING_POLL_MS = 3000;
        const id = setInterval(async () => {
            try {
                const res = await fetch(getApiUrl('/api/game/rejoin'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id, gameId }),
                    credentials: 'omit',
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.game) return;
                const g = data.game as LiveGameSession;
                if (g.gameStatus !== 'scoring' && g.gameStatus !== 'hidden_final_reveal') {
                    const category = g.gameCategory || (g.isSinglePlayer ? 'singleplayer' : 'normal');
                    if (category === 'singleplayer') {
                        setSinglePlayerGames(prev => ({ ...prev, [g.id]: g }));
                    } else if (category === 'tower') {
                        setTowerGames(prev => ({ ...prev, [g.id]: g }));
                    } else {
                        setLiveGames(prev => ({ ...prev, [g.id]: g }));
                    }
                }
            } catch {
                // ignore
            }
        }, SCORING_POLL_MS);
        return () => clearInterval(id);
    }, [currentUser, currentRoute?.view, currentRoute?.params?.id, liveGames, singlePlayerGames, towerGames]);

    // --- Misc UseEffects ---
    useEffect(() => {
        const updateViewportVars = () => {
            syncDocumentViewportHeightVar();
        };

        updateViewportVars();
        window.addEventListener('resize', updateViewportVars);
        window.addEventListener('orientationchange', updateViewportVars);
        window.addEventListener('sudamr-portrait-lock-change', updateViewportVars);
        return () => {
            window.removeEventListener('resize', updateViewportVars);
            window.removeEventListener('orientationchange', updateViewportVars);
            window.removeEventListener('sudamr-portrait-lock-change', updateViewportVars);
        };
    }, []);

    useEffect(() => {
        if (enhancementResult) {
            const timer = setTimeout(() => {
                setEnhancementResult(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [enhancementResult]);

    const handleEnterWaitingRoom = (mode: GameMode) => {
        if (!isClientAdmin(currentUser)) {
            const m = arenaEntranceAvailabilityResolved;
            const lobbyKey: ArenaEntranceKey | null = SPECIAL_GAME_MODES.some((x) => x.mode === mode)
                ? 'strategicLobby'
                : PLAYFUL_GAME_MODES.some((x) => x.mode === mode)
                  ? 'playfulLobby'
                  : null;
            if (lobbyKey && !m[lobbyKey]) {
                window.alert(ARENA_ENTRANCE_CLOSED_MESSAGE[lobbyKey]);
                return;
            }
        }
        handleAction({ type: 'ENTER_WAITING_ROOM', payload: { mode } });
        window.location.hash = `#/waiting/${encodeURIComponent(mode)}`;
    };
    
    const handleViewUser = useCallback(async (userId: string) => {
        // 랭킹 퀵 모달에서 유저 프로필을 열 때 프로필 모달이 뒤로 깔리지 않도록 먼저 닫는다.
        if (isRankingQuickModalOpen) {
            setIsRankingQuickModalOpen(false);
        }
        // allUsers(usersMap)에 전체 프로필이 있으면 사용 (협상 상대 등)
        if (Array.isArray(allUsers)) {
            const userToView = allUsers.find(u => u && u.id === userId);
            if (userToView) {
                const statusInfo = Array.isArray(onlineUsers) ? onlineUsers.find(u => u && u.id === userId) : null;
                setViewingUser({ ...userToView, ...(statusInfo || { status: UserStatus.Online }) });
                return;
            }
        }
        // 온디맨드: 프로필 보기 요청 시 서버에서 가져오기
        try {
            const response = await fetch(getApiUrl(`/api/user/${userId}`));
            if (!response.ok) {
                console.error(`[handleViewUser] Failed to fetch user ${userId}: ${response.statusText}`);
                return;
            }
            const userData = await response.json();
            const statusInfo = Array.isArray(onlineUsers) ? onlineUsers.find(u => u && u.id === userId) : null;
            const merged = { ...userData, status: statusInfo?.status || UserStatus.Offline, equipment: userData.equipment || {}, inventory: userData.inventory || [], } as UserWithStatus;
            setViewingUser(merged);
            setUsersMap(prev => ({ ...prev, [userId]: userData }));
            setUserBriefCache(prev => ({ ...prev, [userId]: { nickname: userData.nickname || userData.username || userId, avatarId: userData.avatarId, borderId: userData.borderId } }));
        } catch (error) {
            console.error(`[handleViewUser] Error fetching user ${userId}:`, error);
        }
    }, [onlineUsers, allUsers, isRankingQuickModalOpen]);

    const openModerationModal = useCallback((userId: string) => {
        if (!Array.isArray(onlineUsers) || !Array.isArray(allUsers)) return;
        const userToView = onlineUsers.find(u => u && u.id === userId) || allUsers.find(u => u && u.id === userId);
        if (userToView) {
            const statusInfo = onlineUsers.find(u => u && u.id === userId);
            setModeratingUser({ ...userToView, ...(statusInfo || { status: UserStatus.Online }) });
        }
    }, [onlineUsers, allUsers]);

    const closeModerationModal = useCallback(() => setModeratingUser(null), []);

    const setCurrentUserAndRoute = useCallback((user: User, options?: { activeGame?: LiveGameSession }) => {
        const mergedUser = applyUserUpdate(user, 'setCurrentUserAndRoute');
        console.log('[setCurrentUserAndRoute] User set:', {
            id: mergedUser.id,
            inventoryLength: mergedUser.inventory?.length,
            equipmentSlots: Object.keys(mergedUser.equipment || {}).length,
            hasInventory: !!mergedUser.inventory,
            hasEquipment: !!mergedUser.equipment
        });
        if (options?.activeGame) {
            const g = options.activeGame;
            setActiveGameFromLogin(g);
            const category = g.gameCategory || (g.isSinglePlayer ? 'singleplayer' : 'normal');
            if (category === 'singleplayer') {
                setSinglePlayerGames(prev => ({ ...prev, [g.id]: g }));
            } else if (category === 'tower') {
                setTowerGames(prev => ({ ...prev, [g.id]: g }));
            } else {
                setLiveGames(prev => ({ ...prev, [g.id]: g }));
            }
            replaceAppHash(`#/game/${g.id}`);
            flushSync(() => {
                setCurrentRoute(parseHash(window.location.hash));
            });
        } else {
            replaceAppHash('#/profile');
            // hashchange의 setCurrentRoute는 다음 틱에 반영되어, 닉네임 확정 직후에도 잠시 set-nickname 뷰가 남는다
            flushSync(() => {
                setCurrentRoute(parseHash(window.location.hash));
            });
        }
    }, [applyUserUpdate, setActiveGameFromLogin, setCurrentRoute, setLiveGames, setSinglePlayerGames, setTowerGames]);
    
    const openEnhancingItem = useCallback((item: InventoryItem) => {
        setBlacksmithSelectedItemForEnhancement(item);
        setBlacksmithActiveTab('enhance');
        setIsBlacksmithModalOpen(true);
    }, []);

    const openEnhancementFromDetail = useCallback((item: InventoryItem) => {
        setBlacksmithSelectedItemForEnhancement(item);
        setBlacksmithActiveTab('enhance');
        setIsBlacksmithModalOpen(true);
    }, []);

    const openRefinementFromDetail = useCallback((item: InventoryItem) => {
        setBlacksmithSelectedItemForEnhancement(item);
        setBlacksmithActiveTab('refine');
        setIsBlacksmithModalOpen(true);
    }, []);

    const openViewingItem = useCallback((item: InventoryItem, isOwnedByCurrentUser: boolean) => {
        setViewingItem({ item, isOwnedByCurrentUser });
    }, []);

    const clearRefinementResult = useCallback(() => {
        setRefinementResult(null);
    }, []);

    const clearEnhancementOutcome = useCallback(() => {
        if (enhancementOutcome?.success) {
            const enhancedItem = enhancementOutcome.itemAfter;
            setViewingItem(currentItem => {
                if (currentItem && enhancedItem && currentItem.item.id === enhancedItem.id) {
                    return { ...currentItem, item: enhancedItem };
                }
                return currentItem;
            });
            const snapshot = currentUserRef.current;
            if (snapshot && Array.isArray(snapshot.inventory)) {
                const nextInventory = snapshot.inventory.map(invItem =>
                        invItem.id === enhancedItem.id ? enhancedItem : invItem
                );
                flushSync(() => {
                    applyUserUpdate({ inventory: nextInventory }, 'clearEnhancementOutcome');
                });
            }
        }
        setEnhancementOutcome(null);
    }, [enhancementOutcome, applyUserUpdate]);
    
    const closeEnhancementModal = useCallback(() => {
        setIsEnhancementResultModalOpen(false);
        setEnhancementOutcome(null);
    }, []);

    const startEnhancement = useCallback((_item: InventoryItem) => {
        // 제련 진행 중 모달 제거: 강화 결과(성공/실패) 수신 시에만 모달 표시
    }, []);

        const closeClaimAllSummary = useCallback(() => {
        setIsClaimAllSummaryOpen(false);
        setClaimAllSummary(null);
    }, []);

    const applyPreset = useCallback((preset: EquipmentPreset) => {
        handleAction({ type: 'APPLY_PRESET', payload: { presetName: preset.name, equipment: preset.equipment } });
    }, [handleAction]);

    const presets = useMemo(() => currentUser?.equipmentPresets || [], [currentUser?.equipmentPresets]);
    
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
    const [isGuildShopOpen, setIsGuildShopOpen] = useState(false);

    const {
        mainOptionBonuses,
        combatSubOptionBonuses,
        specialStatBonuses,
        aggregatedMythicStats,
    } = useMemo(() => {
        const initialBonuses = {
            mainOptionBonuses: {} as Record<CoreStat, { flat: number; percent: number }>,
            combatSubOptionBonuses: {} as Record<CoreStat, { flat: number; percent: number }>,
            specialStatBonuses: {} as Record<SpecialStat, { flat: number; percent: number }>,
            aggregatedMythicStats: {} as Record<MythicStat, { count: number, totalValue: number }>,
        };

        if (!currentUserWithStatus || !currentUserWithStatus.equipment || !currentUserWithStatus.inventory || !Array.isArray(currentUserWithStatus.inventory)) {
            return initialBonuses;
        }

        const equippedItems = currentUserWithStatus.inventory.filter(item =>
            item && currentUserWithStatus.equipment && Object.values(currentUserWithStatus.equipment).includes(item.id)
        );

        const bonusNum = (v: unknown): number => {
            const x = Number(v);
            return Number.isFinite(x) ? x : 0;
        };

        const aggregated = equippedItems.reduce((acc, item) => {
            if (!item.options) return acc;

            // Main Option
            if (item.options.main) {
                const type = item.options.main.type as CoreStat;
                if (!acc.mainOptionBonuses[type]) {
                    acc.mainOptionBonuses[type] = { flat: 0, percent: 0 };
                }
                const mv = bonusNum(item.options.main.value);
                if (item.options.main.isPercentage) {
                    acc.mainOptionBonuses[type].percent += mv;
                } else {
                    acc.mainOptionBonuses[type].flat += mv;
                }
            }

            // Combat Sub Options
            item.options.combatSubs?.forEach(sub => {
                const type = sub.type as CoreStat;
                if (!acc.combatSubOptionBonuses[type]) {
                    acc.combatSubOptionBonuses[type] = { flat: 0, percent: 0 };
                }
                const sv = bonusNum(sub.value);
                if (sub.isPercentage) {
                    acc.combatSubOptionBonuses[type].percent += sv;
                } else {
                    acc.combatSubOptionBonuses[type].flat += sv;
                }
            });

            // Special Sub Options
            item.options.specialSubs?.forEach(sub => {
                const type = coerceSpecialStatType(sub.type);
                if (!type) return;
                if (!acc.specialStatBonuses[type]) {
                    acc.specialStatBonuses[type] = { flat: 0, percent: 0 };
                }
                const sv = bonusNum(sub.value);
                if (sub.isPercentage) {
                    acc.specialStatBonuses[type].percent += sv;
                } else {
                    acc.specialStatBonuses[type].flat += sv;
                }
            });

            // Mythic Sub Options
            item.options.mythicSubs?.forEach(sub => {
                const type = sub.type as MythicStat; // Cast to MythicStat
                if (!acc.aggregatedMythicStats[type]) {
                    acc.aggregatedMythicStats[type] = { count: 0, totalValue: 0 };
                }
                acc.aggregatedMythicStats[type].count++;
                acc.aggregatedMythicStats[type].totalValue += bonusNum(sub.value);
            });

            return acc;
        }, initialBonuses);

        return aggregated;
    }, [currentUserWithStatus]);

    // 클라이언트 측 AI(lightGoAi): useClientSideAi 게임에서 AI 차례일 때 로컬에서 수 계산 후 서버로 전송
    useEffect(() => {
        const game = activeGame;
        if (!game?.id || !game?.isAiGame || (game?.gameStatus !== 'playing' && game?.gameStatus !== 'hidden_placing')) return;
        const goModes = new Set<GameMode>([
            GameMode.Standard,
            GameMode.Capture,
            GameMode.Speed,
            GameMode.Base,
            GameMode.Hidden,
            GameMode.Missile,
            GameMode.Mix,
        ]);
        if (!goModes.has(game.mode as any)) return;
        // 전략바둑 AI 대국: 이제 기본은 서버 AI(그누고/서버 goAiBot) 사용.
        // 클라이언트 측 AI는 명시적으로 useClientSideAi === true 인 경우에만 사용한다.
        const isStrategicGoAi = game.isAiGame && game.gameCategory !== 'tower' && !game.isSinglePlayer;
        const useClientSideAi = isStrategicGoAi && (game.settings as any)?.useClientSideAi === true;
        if (!useClientSideAi) return;
        // myPlayer: blackPlayerId/whitePlayerId 우선, 없으면 AI 대국에서 player1 = 인간으로 추론
        let myPlayer = game.blackPlayerId === currentUser?.id ? Player.Black : (game.whitePlayerId === currentUser?.id ? Player.White : Player.None);
        if (myPlayer === Player.None && game.player1 && currentUser?.id === game.player1.id) {
            if (game.blackPlayerId === game.player1.id) myPlayer = Player.Black;
            else if (game.whitePlayerId === game.player1.id) myPlayer = Player.White;
            else myPlayer = Player.Black; // AI 대국 기본: 선수(흑) = 인간
        }
        if (myPlayer === Player.None) return;
        const isAiTurn = game.currentPlayer !== myPlayer && game.currentPlayer !== Player.None;
        if (!isAiTurn) return;
        const moveCount = (game.moveHistory || []).filter((m: { x: number; y: number }) => m.x >= 0 && m.y >= 0).length;
        if (lastClientSideAiSentRef.current[game.id] === moveCount) return;
        const boardSize = game.settings?.boardSize ?? 19;
        const playerStr = game.currentPlayer === Player.Black ? 'black' : 'white';
        const moveHistoryForGnuGo = (game.moveHistory || []).map((m: { x: number; y: number; player: Player }) => ({
            x: m.x,
            y: m.y,
            player: m.player === Player.Black ? 1 : 2
        }));
        const level = (game.settings as any)?.goAiBotLevel ?? (game.settings as any)?.aiDifficulty ?? 5;
        // 클래식/스피드/믹스에서는 최소 6으로 해서 휴리스틱 AI가 너무 나쁜 수를 덜 두도록 함 (Gnugo 수준은 아님)
        const effectiveLevel = (game.mode === GameMode.Standard || game.mode === GameMode.Speed || game.mode === GameMode.Mix) ? Math.max(6, level) : level;

        const requestServerFallback = (reason?: unknown) => {
            if (reason) console.warn('[useApp] Client-side AI submit failed; requesting server AI move:', reason);
            // Allow future retries if game state doesn't change
            delete lastClientSideAiSentRef.current[game.id];
            handleAction({ type: 'REQUEST_SERVER_AI_MOVE', payload: { gameId: game.id } }).catch((err) => {
                console.error('[useApp] REQUEST_SERVER_AI_MOVE failed:', err);
                delete lastClientSideAiSentRef.current[game.id];
            });
        };

        // 착수 직후 텀(400ms): 서버가 유저 수를 반영한 GAME_UPDATE를 보낼 시간을 주어 "돌이 옮겨지는" 현상·시간패 방지
        const CLIENT_AI_DELAY_MS = 400;
        const gameId = game.id;
        const currentMoveCount = moveCount;
        const sendClientAiMove = () => {
            const latestGame = liveGamesRef.current[gameId];
            if (!latestGame || lastClientSideAiSentRef.current[gameId] === currentMoveCount) return;
            const stillAiTurn = latestGame.currentPlayer !== (latestGame.blackPlayerId === currentUser?.id ? Player.Black : (latestGame.whitePlayerId === currentUser?.id ? Player.White : Player.None)) && latestGame.currentPlayer !== Player.None;
            if (!stillAiTurn) return;

            const applyMove = (move: { x: number; y: number }) => {
                lastClientSideAiSentRef.current[gameId] = currentMoveCount;
                if (move.x === -1 && move.y === -1) {
                    handleAction({ type: 'PASS_TURN', payload: { gameId } } as any).catch((err) => { console.error('[useApp] PASS_TURN (client-side AI) failed:', err); requestServerFallback(err); });
                } else {
                    try { console.log('[useApp] Client-side AI: sending move for gameId=', gameId); } catch (_) {}
                    handleAction({
                        type: 'PLACE_STONE',
                        payload: { gameId, x: move.x, y: move.y, clientSideAiMove: true },
                    }).catch((err) => { console.error('[useApp] Client-side AI PLACE_STONE failed:', err); requestServerFallback(err); });
                }
            };

            (async () => {
                const result = getLightGoAiMove(latestGame, effectiveLevel);
                if (result?.move == null) { requestServerFallback('no move'); return; }
                applyMove(result.move);
            })();
        };

        // 클라이언트가 수를 보내지 못할 경우(효과 미실행/실패) 대비: 서버 AI 폴백 (Game.tsx 12s+ 복구와 중첩되어도 안전)
        const timeoutMs = 8000;
        const timeoutId = setTimeout(() => {
            if (lastClientSideAiSentRef.current[gameId] !== currentMoveCount) {
                console.warn('[useApp] Client-side AI did not send in time; requesting server AI move');
                delete lastClientSideAiSentRef.current[gameId];
                handleAction({ type: 'REQUEST_SERVER_AI_MOVE', payload: { gameId } }).catch((err) => {
                    console.error('[useApp] REQUEST_SERVER_AI_MOVE (timeout fallback) failed:', err);
                });
            }
        }, timeoutMs);

        const delayId = setTimeout(sendClientAiMove, CLIENT_AI_DELAY_MS);

        return () => {
            clearTimeout(timeoutId);
            clearTimeout(delayId);
        };
    }, [activeGame?.id, activeGame?.currentPlayer, activeGame?.moveHistory?.length, activeGame?.gameStatus, activeGame?.settings, currentUser?.id, handleAction]);

    return {
        currentUser,
        presets,
        setCurrentUserAndRoute,
        currentUserWithStatus,
        updateTrigger,
        currentRoute,
        error,
        allUsers,
        onlineUsers: enrichedOnlineUsers,
        liveGames,
        singlePlayerGames,
        towerGames,
        towerRankingsRefetchTrigger,
        negotiations,
        waitingRoomChats,
        gameChats,
        adminLogs,
        gameModeAvailability,
        arenaEntranceAvailability: arenaEntranceAvailabilityResolved,
        arenaEntranceFromServer,
        announcements,
        globalOverrideAnnouncement,
        announcementInterval,
        homeBoardPosts,
        activeGame,
        activeNegotiation,
        showExitToast,
        serverReconnectNotice,
        enhancementResult,
        enhancementOutcome,
        unreadMailCount,
        hasClaimableQuest,
        settings,
        isNarrowViewport,
        isNativeMobile,
        usePortraitFirstShell,
        modalLayerUsesDesignPixels,
        isPhoneHandheldTouch,
        isLargeTouchTablet,
        showPcLikeMobileLayoutSetting,
        updateSoundSetting,
        updateFeatureSetting,
        updatePanelColor,
        updateTextColor,
        updatePanelEdgeStyle,
        updatePcLikeMobileLayout,
        resetGraphicsToDefault,
        mainOptionBonuses,
        combatSubOptionBonuses,
        specialStatBonuses,
        aggregatedMythicStats,
        modals: {
            isSettingsModalOpen, isInventoryOpen, isMailboxOpen, isQuestsOpen, isShopOpen, shopInitialTab, lastUsedItemResult,
            disassemblyResult, craftResult, rewardSummary, viewingUser, isInfoModalOpen, isAnnouncementsModalOpen, isRankingQuickModalOpen, isChatQuickModalOpen, isEncyclopediaOpen, isStatAllocationModalOpen, enhancementAnimationTarget,
            isGameRecordListOpen, viewingGameRecord,
            pastRankingsInfo, viewingItem, isProfileEditModalOpen, moderatingUser,
            isClaimAllSummaryOpen,
            claimAllSummary,
            isMbtiInfoModalOpen,
            mutualDisconnectMessage,
            showOtherDeviceLoginModal,
            isEquipmentEffectsModalOpen,
            isBlacksmithModalOpen,
            blacksmithSelectedItemForEnhancement,
            blacksmithActiveTab,
            combinationResult,
            isBlacksmithHelpOpen,
            isBlacksmithEffectsModalOpen,
            enhancingItem,
            isEnhancementResultModalOpen,
            tournamentScoreChange,
            refinementResult,
            isInsufficientActionPointsModalOpen,
            isOpponentInsufficientActionPointsModalOpen,
            isActionPointModalOpen,
            levelUpCelebration,
            mannerGradeChange,
        },
        handlers: {
            handleAction,
            handleLogout,
            handleEnterWaitingRoom,
            applyPreset,
            openSettingsModal: () => setIsSettingsModalOpen(true),
            closeSettingsModal: () => setIsSettingsModalOpen(false),
            openInventory: () => setIsInventoryOpen(true),
            closeInventory: () => setIsInventoryOpen(false),
            openMailbox: () => setIsMailboxOpen(true),
            closeMailbox: () => setIsMailboxOpen(false),
            openQuests: () => setIsQuestsOpen(true),
            closeQuests: () => setIsQuestsOpen(false),
            openShop: (tab?: 'equipment' | 'materials' | 'consumables' | 'misc' | 'diamonds' | 'vip') => {
                setShopInitialTab(tab);
                setIsShopOpen(true);
            },
            closeShop: () => {
                setIsShopOpen(false);
                setShopInitialTab(undefined);
            },
            openActionPointModal: () => setIsActionPointModalOpen(true),
            closeActionPointModal: () => setIsActionPointModalOpen(false),
            closeInsufficientActionPointsModal: () => setIsInsufficientActionPointsModalOpen(false),
            openOpponentInsufficientActionPointsModal: () => setIsOpponentInsufficientActionPointsModalOpen(true),
            closeOpponentInsufficientActionPointsModal: () => setIsOpponentInsufficientActionPointsModalOpen(false),
            closeItemObtained: async () => {
                setLastUsedItemResult(null);
                setTournamentScoreChange(null);
            },
            closeDisassemblyResult: () => setDisassemblyResult(null),
            closeCraftResult: () => setCraftResult(null),
            closeCombinationResult: () => setCombinationResult(null),
            closeRewardSummary: () => setRewardSummary(null),
            closeLevelUpCelebration: () => setLevelUpCelebration(null),
            closeMannerGradeChange: () => setMannerGradeChange(null),
            previewAdminLevelUpCelebrationModal,
            previewAdminMannerGradeUpModal,
            closeClaimAllSummary,
            openViewingUser: handleViewUser,
            closeViewingUser: () => setViewingUser(null),
            openInfoModal: () => setIsInfoModalOpen(true),
            closeInfoModal: () => setIsInfoModalOpen(false),
            openAnnouncementsModal: () => setIsAnnouncementsModalOpen(true),
            closeAnnouncementsModal: () => setIsAnnouncementsModalOpen(false),
            openRankingQuickModal: () => setIsRankingQuickModalOpen(true),
            closeRankingQuickModal: () => setIsRankingQuickModalOpen(false),
            openChatQuickModal: () => setIsChatQuickModalOpen(true),
            closeChatQuickModal: () => setIsChatQuickModalOpen(false),
            openEncyclopedia: () => setIsEncyclopediaOpen(true),
            closeEncyclopedia: () => setIsEncyclopediaOpen(false),
            openStatAllocationModal: () => setIsStatAllocationModalOpen(true),
            closeStatAllocationModal: () => setIsStatAllocationModalOpen(false),
            openProfileEditModal: () => setIsProfileEditModalOpen(true),
            closeProfileEditModal: () => setIsProfileEditModalOpen(false),
            openPastRankings: (info: { user: UserWithStatus; mode: GameMode | 'strategic' | 'playful'; }) => setPastRankingsInfo(info),
            closePastRankings: () => setPastRankingsInfo(null),
            openViewingItem,
            closeViewingItem: () => setViewingItem(null),
            openEnhancingItem,
            startEnhancement,
            openEnhancementFromDetail,
            openRefinementFromDetail,
            clearEnhancementOutcome,
            clearRefinementResult,
            clearEnhancementAnimation: () => setEnhancementAnimationTarget(null),
            openModerationModal,
            closeModerationModal,
            openMbtiInfoModal: () => setIsMbtiInfoModalOpen(true),
            closeMbtiInfoModal: () => setIsMbtiInfoModalOpen(false),
            showMutualDisconnectMessage: (msg: string) => setMutualDisconnectMessage(msg),
            closeMutualDisconnectModal: () => setMutualDisconnectMessage(null),
            confirmOtherDeviceLoginAndLogout: () => {
                try {
                    sessionStorage.removeItem('currentUser');
                } catch {
                    // ignore
                }
                setCurrentUser(null);
                setShowOtherDeviceLoginModal(false);
                window.location.hash = '#/login';
            },
            openEquipmentEffectsModal: () => setIsEquipmentEffectsModalOpen(true),
            closeEquipmentEffectsModal: () => setIsEquipmentEffectsModalOpen(false),
            openBlacksmithModal: () => setIsBlacksmithModalOpen(true),
            closeBlacksmithModal: () => {
                setIsBlacksmithModalOpen(false);
                setBlacksmithSelectedItemForEnhancement(null);
                setBlacksmithActiveTab('enhance'); // Reset to default tab
                setIsBlacksmithEffectsModalOpen(false);
                setIsBlacksmithHelpOpen(false);
            },
            openBlacksmithHelp: () => setIsBlacksmithHelpOpen(true),
            closeBlacksmithHelp: () => setIsBlacksmithHelpOpen(false),
            openBlacksmithEffectsModal: () => setIsBlacksmithEffectsModalOpen(true),
            closeBlacksmithEffectsModal: () => setIsBlacksmithEffectsModalOpen(false),
            openGameRecordList: () => setIsGameRecordListOpen(true),
            closeGameRecordList: () => setIsGameRecordListOpen(false),
            openGameRecordViewer: (record: GameRecord) => setViewingGameRecord(record),
            closeGameRecordViewer: () => setViewingGameRecord(null),
            setBlacksmithActiveTab,
            closeEnhancementModal,
            openPresetModal: () => setIsPresetModalOpen(true),
            closePresetModal: () => setIsPresetModalOpen(false),
            openGuildShop: () => setIsGuildShopOpen(true),
            closeGuildShop: () => setIsGuildShopOpen(false),
        },
        guilds,
    };
};