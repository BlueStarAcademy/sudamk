import { randomUUID } from 'crypto';
import * as db from '../db.js';
import {
    type ServerAction,
    type User,
    type VolatileState,
    ChatMessage,
    UserStatus,
    type Negotiation,
    TournamentType,
    GameMode,
    type UserStatusInfo,
} from '../../types/index.js';
import * as types from '../../types/index.js';
import { updateQuestProgress } from './../questService.js';
import { resolvePublicWaitingRoomChatStoreChannel } from '../../shared/utils/waitingRoomGlobalChatMerge.js';
import * as tournamentService from '../tournamentService.js';
import * as summaryService from '../summaryService.js';
import { broadcast, broadcastToUserIds, broadcastUserUpdate } from '../socket.js';
import {
    SPECIAL_GAME_MODES,
    PLAYFUL_GAME_MODES,
    NO_CONTEST_MOVE_THRESHOLD,
    RANKED_ELO_BASE_SCORE,
    RANKED_MATCH_MAX_RATING_DIFF,
    DEFAULT_GAME_SETTINGS,
    getAiScoringTurnLimitByBoardSize,
    STRATEGIC_ACTION_POINT_COST,
    PLAYFUL_ACTION_POINT_COST,
} from '../../constants/index.js';
import { applyPassiveActionPointRegenToUser, recordActionPointSpend } from '../effectService.js';
import { getRankedGameSettings } from '../../constants/rankedGameSettings.js';
import { sanitizePvpGameSettings } from '../../shared/utils/sanitizePvpGameSettings.js';
import { clearAiSession } from '../aiSessionManager.js';
import { isLingerEndedPvpRoomCandidate, maybeDeleteDetachedEndedPvpGame } from '../maybeDeleteDetachedEndedPvpGame.js';
import {
    applyLeaveWhenGameSessionMissing,
    resolveGameSessionForLeave,
} from '../gameRecordSnapshot.js';
import { aiUserId, getAiUser } from '../aiPlayer.js';
import { getSelectiveUserUpdate } from '../utils/userUpdateHelper.js';
import { recordPairPetSoulConvertForAchievements, recordPairPetTrainingClaimForAchievements } from '../pairPetAchievementCounters.js';
import { repairInProgressGhostPairPetTrainingSessions } from '../utils/repairPairPetTrainingSlots.js';
import { rollPairPetTrainingRewards } from '../utils/pairPetTrainingRewardRoll.js';
import { requireArenaEntranceOpen } from '../arenaEntranceService.js';
import { releaseIpBindingForUser } from '../ipLoginPolicy.js';
import { initializeGame } from '../gameModes.js';
import { MATERIAL_ITEMS } from '../../shared/constants/items.js';
import { clampAiLobbyStrategicItemCaps } from '../../shared/utils/strategicAiLobbyItemCaps.js';
import { isSyntheticOnlineUserId } from '../../shared/utils/syntheticOnlineUserIds.js';
import { containsProfanity } from '../../profanity.js';
import { PVP_DISCONNECT_REJOIN_GRACE_MS } from '../../shared/utils/pvpDisconnectPolicy.js';
import { addItemsToInventory } from '../../utils/inventoryUtils.js';
import type { InventoryItem } from '../../types/index.js';
import {
    clampPairRoomTitle,
    PAIR_LOBBY_GRID_SLOT_COUNT,
    pairLobbyGridSlotFromRoomCode,
} from '../../shared/constants/pairArena.js';
import {
    buildTeamPreservingPairTurnOrder,
    getPairHumanParticipantIds,
    isPairAiSeat,
    PAIR_GO_GAME_MODES,
} from '../../shared/utils/pairGameTurn.js';
import { readStrategicRankedBlock, readPairRankedBlock } from '../../shared/utils/unifiedRankedStatsMigration.js';
import { userInUnifiedArenaLobbyUserList } from '../../shared/utils/unifiedArenaLobbyUserList.js';
import {
    arenaChannelForGameMode,
    arenaChannelForGameSession,
    normalizeArenaChannel,
} from '../../shared/utils/arenaChannel.js';
import { isRoomKindAllowedForLobby } from '../../shared/utils/arenaLobbyDestination.js';
import { isPairRoomVisibleInLobbyIntent } from '../../shared/utils/arenaLobbyDestination.js';
import { enrichPairRoomsForClientPayload, isPairAiDuoInviteOnlyRoom } from '../utils/pairRoomClientPayload.js';
import {
    clearPairOwnerStartDeadline,
    pairOwnerStartDeadlineExpired,
    pickFirstJoinedPairRoomGuestSuccessor,
    recordPairGuestJoinOrder,
    removePairGuestJoinOrder,
    syncPairOwnerStartDeadline,
} from '../../shared/utils/pairOwnerStartDeadline.js';
import {
    rollPairPetSoulConvertRewardQuantity,
    pairPetSoulConvertMaterialNameForGrade,
} from '../../shared/utils/pairPetSoulConvert.js';
import {
    PAIR_PET_SHOP_SKUS,
    PAIR_EGG_TEMPLATE_ID,
    PAIR_EGG_MATERIAL_NAME,
    PAIR_WELCOME_EGG_TEMPLATE_ID,
    PAIR_WELCOME_EGG_MATERIAL_NAME,
    PAIR_SOULSTONE_NAMES,
    PAIR_PET_LOBBY_INV_EXPAND_STEP,
    PAIR_PET_LOBBY_INV_MAX_SLOTS,
    pairPetLobbyInventorySlots,
    pairPetLobbyExpandDiamondCost,
    isPairLobbyPetInventoryFull,
    rollPairPetTemplateId,
    getPairPetDefinition,
    getPairPetDisplayName,
    isPairPetMaterial,
    isPairEggItem,
    findFirstHatchablePairEgg,
    pairEggTemplateIdForHatch,
    isPairSoulStoneItem,
    pairSoulTierFromMaterialName,
    pairSoulTemplateIdFromTier,
} from '../../shared/constants/petLobby.js';
import {
    bumpPairPetDispositionPctOnGradeUpgrade,
    resolvePairPetMetaFromInventoryRow,
    rollPairPetMetaForHatch,
    rollPairPetMetaForHatchAtLevel,
    rollSingleLevelUpCoreBonuses,
    diffPairPetLevelUpCoreBonuses,
} from '../../shared/utils/pairPetRoll.js';
import { getEquippedPairPetInventoryRow, reconcileEquippedPairPetInventoryItem } from '../../shared/utils/pairEquippedPet.js';
import {
    baseAiLobbyActionPointCostForModeAndSettings,
    effectivePairRankedApCostForUser,
    effectiveStrategicRankedQueueApCostForUser,
} from '../../shared/utils/pairPetArenaApDiscount.js';
import { getPairPetXpRequirementForLevel } from '../../shared/utils/strategyLevelXp.js';
import {
    resolveAiLobbyProfileStepFromSettings,
    rollPairAiOpponentPetDisplayLevelForProfileStep,
} from '../../shared/utils/strategicAiDifficulty.js';
import { strategicKataLevelFromSnapshot } from '../../shared/utils/kataServerRuntimeResolvers.js';
import { getKataServerRuntimeSnapshot } from '../kataServerRuntimeStore.js';
import { isSameDayKST } from '../../shared/utils/timeUtils.js';
import {
    PAIR_TRAINING_SLOT_COUNT,
    getPairTrainingSlotDef,
    isItemIdInPairTraining,
    isPairTrainingSlotUnlocked,
    isValidPairPetTrainingPrecomputedRewards,
    minPetLevelForTrainingSlot,
    normalizePairPetTrainingSlots,
    trainingEndsAt,
} from '../../shared/constants/pairTraining.js';
import type { PairTrainingClaimClientSummary } from '../../shared/types/pairTrainingClaim.js';
import type { PairPetMeta } from '../../shared/types/entities.js';
import {
    PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE,
    PAIR_HATCHERY_SESSION_SLOT_COUNT,
    canUnlockPairHatcheryUpgrade,
    canUsePairHatcherySlot,
    findPairHatcherySessionAtSlot,
    getPairHatcherySlotDef,
    getPairHatcheryUpgradeTierDef,
    hatcheryEndsAt,
    isPairHatcherySessionSlotIndex,
    normalizePairPetHatcherySessions,
    normalizePairPetHatcheryUpgradeTiers,
    normalizePairHatcherySessionSlotIndex,
    rollHatchPetLevelFromRule,
} from '../../shared/constants/pairHatchery.js';
import { resolveHatcheryAwardedPetRow } from '../../shared/utils/pairHatcheryClaim.js';
import { CoreStat, ItemGrade } from '../../types/enums.js';
import { hydratePairGamePetKataAndRpsIfNeeded } from '../pairPetKataHydration.js';
import {
    effectivePairPetGradeFromRow,
    nextPairPetGrade,
    PAIR_PET_MAX_LEVEL,
    pairPetGradeUpgradeSoulStoneCount,
    pairPetGradeUpgradeSoulTemplateId,
    pairPetMinLevelForNextGrade,
    pairPetXpGainBlockedByGrade,
    pairPetStatMultiplierFromGrade,
} from '../../shared/constants/pairPetGrade.js';

const soulTemplateIdFromMaterialName = (materialName: string): string =>
    pairSoulTemplateIdFromTier(pairSoulTierFromMaterialName(materialName));

const arenaChannelFromPairLobbyChannel = (channel: unknown): types.ArenaChannel =>
    normalizeArenaChannel(channel) ?? 'pair';

export const setInGameUserStatusForArena = (
    volatileState: VolatileState,
    userId: string,
    game: Pick<types.LiveGameSession, 'mode' | 'id' | 'settings'>,
): void => {
    if (isSyntheticOnlineUserId(userId)) {
        delete volatileState.userStatuses[userId];
        return;
    }
    volatileState.userStatuses[userId] = {
        status: UserStatus.InGame,
        mode: game.mode,
        gameId: game.id,
        arenaChannel: arenaChannelForGameSession(game) ?? undefined,
    };
};

const makePairMaterialStack = (materialName: string, templateId: string, quantity: number): InventoryItem => {
    const base = MATERIAL_ITEMS[materialName as keyof typeof MATERIAL_ITEMS];
    if (!base) throw new Error(`Unknown pair shop material: ${materialName}`);
    return {
        id: `item-${randomUUID()}`,
        name: base.name,
        description: base.description,
        type: 'material',
        slot: null,
        level: 1,
        stars: 0,
        isEquipped: false,
        createdAt: Date.now(),
        image: base.image,
        grade: base.grade,
        quantity,
        templateId,
    };
};

/** 취소 시 차감했던 알 1개 복구 (같은 스택 id가 있으면 합침) */
const restoreOnePairEgg = (user: User, eggItemId?: string, eggTemplateIdForRestore?: string): string | null => {
    if (!user.inventorySlots) {
        user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
    }
    const inv = user.inventory || [];
    if (eggItemId) {
        const idx = inv.findIndex((it) => it.id === eggItemId);
        if (idx >= 0) {
            const row = inv[idx]!;
            if (isPairEggItem(row)) {
                user.inventory = [...inv];
                user.inventory[idx] = { ...row, quantity: (row.quantity ?? 1) + 1 };
                user.inventory = JSON.parse(JSON.stringify(user.inventory)) as InventoryItem[];
                return null;
            }
        }
    }
    const useWelcome =
        eggTemplateIdForRestore === PAIR_WELCOME_EGG_TEMPLATE_ID;
    const matName = (useWelcome ? PAIR_WELCOME_EGG_MATERIAL_NAME : PAIR_EGG_MATERIAL_NAME) as keyof typeof MATERIAL_ITEMS;
    const templateId = useWelcome ? PAIR_WELCOME_EGG_TEMPLATE_ID : PAIR_EGG_TEMPLATE_ID;
    const merged = addItemsToInventory(inv, user.inventorySlots, [makePairMaterialStack(matName, templateId, 1)]);
    if (!merged.success || !merged.updatedInventory) {
        return '인벤토리 공간이 부족해 알을 돌려줄 수 없습니다.';
    }
    user.inventory = merged.updatedInventory;
    user.inventory = JSON.parse(JSON.stringify(user.inventory)) as InventoryItem[];
    return null;
};

const makePairPetItem = (templateId: string, metaOverride?: PairPetMeta): InventoryItem => {
    const def = getPairPetDefinition(templateId);
    if (!def) throw new Error(`Unknown pair pet: ${templateId}`);
    return {
        id: `item-${randomUUID()}`,
        name: def.displayName,
        description: def.description,
        type: 'material',
        slot: null,
        level: 1,
        stars: 0,
        isEquipped: false,
        createdAt: Date.now(),
        image: def.image,
        grade: ItemGrade.Normal,
        quantity: 1,
        templateId: def.templateId,
        pairPetMeta: metaOverride ?? rollPairPetMetaForHatch(),
    };
};

const neutralTrainingMeta: PairPetMeta = {
    level: 1,
    xp: 0,
    disposition: { kind: 'all', pct: 5 },
    specialization: { kind: 'trainingXp', pct: 0 },
    levelUpCoreBonuses: {},
    rpsAttribute: 1,
};

/** 인벤에서 `templateId` 영혼석을 `need`개만큼 차감한 새 배열 — 부족하면 null */
function consumePairSoulstonesFromInventory(inv: InventoryItem[], templateId: string, need: number): InventoryItem[] | null {
    if (need <= 0) return [...inv];
    let left = need;
    const removals = new Map<number, number>();
    const candidates = inv
        .map((it, idx) => ({ it, idx }))
        .filter(({ it }) => isPairSoulStoneItem(it) && it.templateId === templateId && (it.quantity ?? 1) >= 1)
        .sort((a, b) => b.idx - a.idx);
    const avail = candidates.reduce((s, { it }) => s + (it.quantity ?? 1), 0);
    if (avail < need) return null;
    for (const { it, idx } of candidates) {
        if (left <= 0) break;
        const q = it.quantity ?? 1;
        const take = Math.min(q, left);
        left -= take;
        removals.set(idx, (removals.get(idx) ?? 0) + take);
    }
    if (left > 0) return null;
    const next: InventoryItem[] = [];
    for (let i = 0; i < inv.length; i += 1) {
        const row = inv[i]!;
        const rm = removals.get(i);
        if (!rm) {
            next.push(row);
            continue;
        }
        const q = row.quantity ?? 1;
        const qRem = q - rm;
        if (qRem > 0) next.push({ ...row, quantity: qRem });
    }
    return next;
}

function readPairPetMetaFromRow(row: InventoryItem): PairPetMeta {
    return resolvePairPetMetaFromInventoryRow(row);
}

function applyPairPetXp(meta: PairPetMeta, rawGain: number, itemGrade: ItemGrade): void {
    const grade = itemGrade ?? ItemGrade.Normal;
    const oldLevel = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(meta.level) || 1));
    let gain = Math.max(0, Math.floor(rawGain));
    let level = oldLevel;
    let xp = Math.max(0, Math.floor(meta.xp ?? 0));
    while (gain > 0 && level < PAIR_PET_MAX_LEVEL) {
        if (pairPetXpGainBlockedByGrade(grade, level)) {
            xp = 0;
            break;
        }
        const need = getPairPetXpRequirementForLevel(level);
        if (!Number.isFinite(need) || need <= 0) break;
        const room = need - xp;
        if (room <= 0) {
            level += 1;
            xp = 0;
            if (pairPetXpGainBlockedByGrade(grade, level)) break;
            continue;
        }
        const take = Math.min(room, gain);
        xp += take;
        gain -= take;
        if (xp >= need) {
            level += 1;
            xp = 0;
            if (pairPetXpGainBlockedByGrade(grade, level)) break;
        }
    }
    if (pairPetXpGainBlockedByGrade(grade, level)) xp = 0;
    meta.level = level;
    meta.xp = level >= PAIR_PET_MAX_LEVEL ? 0 : xp;

    if (level > oldLevel) {
        if (!meta.levelUpCoreBonuses) meta.levelUpCoreBonuses = {};
        for (let i = oldLevel; i < level; i += 1) {
            const inc = rollSingleLevelUpCoreBonuses(grade, () => Math.random());
            for (const sk of Object.keys(inc) as CoreStat[]) {
                const add = inc[sk];
                if (typeof add !== 'number' || add === 0) continue;
                meta.levelUpCoreBonuses[sk] = (meta.levelUpCoreBonuses[sk] ?? 0) + add;
            }
        }
    }
}

type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
};

type RankedLobbyType = 'strategic';
type RankedQueueEntry = NonNullable<NonNullable<VolatileState['rankedMatchingQueue']>[RankedLobbyType]>[string];

const GREETINGS = ['안녕', '하이', '헬로', 'hi', 'hello', '반가', '잘 부탁', '잘부탁'];
const rankedMatchingLocks: Record<RankedLobbyType, boolean> = { strategic: false };
const PAIR_MODE_DEFAULT_GAME_MODE: GameMode = GameMode.Standard;
const pairModeOrDefault = (mode: unknown): GameMode =>
    typeof mode === 'string' && PAIR_GO_GAME_MODES.includes(mode as GameMode)
        ? (mode as GameMode)
        : PAIR_MODE_DEFAULT_GAME_MODE;

/** 페어 대기 방 `lobbyChannel`에 맞는 대국 모드(놀이 모드가 `pairModeOrDefault`에서 떨어지지 않게 함). */
function resolvePairWaitingRoomSelectedGameMode(room: types.PairRoomState, requested: unknown): GameMode {
    const ch = (room as { lobbyChannel?: string }).lobbyChannel ?? 'pair';
    const base = requested ?? room.selectedGameMode;
    if (ch === 'playful') {
        if (typeof base === 'string' && PLAYFUL_GAME_MODES.some((m) => m.mode === base)) return base as GameMode;
        return PLAYFUL_GAME_MODES[0]!.mode;
    }
    if (ch === 'strategic') {
        if (typeof base === 'string' && SPECIAL_GAME_MODES.some((m) => m.mode === base)) return base as GameMode;
        return PAIR_MODE_DEFAULT_GAME_MODE;
    }
    if (typeof base === 'string' && SPECIAL_GAME_MODES.some((m) => m.mode === base)) return base as GameMode;
    if (typeof base === 'string' && PLAYFUL_GAME_MODES.some((m) => m.mode === base)) return base as GameMode;
    return pairModeOrDefault(base);
}
const pairModeIncludesCaptureRule = (mode: GameMode, settings: Pick<types.GameSettings, 'mixedModes'>): boolean =>
    mode === GameMode.Capture || (mode === GameMode.Mix && Boolean(settings.mixedModes?.includes(GameMode.Capture)));
const FRIEND_LIMIT = 30;

const broadcastPairRooms = (volatileState: VolatileState) => {
    const rooms = volatileState.pairRooms;
    if (rooms) {
        for (const room of Object.values(rooms)) {
            pairLobbyPetSnapshotsFromCache(room, volatileState);
        }
    }
    broadcast({
        type: 'PAIR_ROOM_UPDATE',
        payload: {
            rooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
        },
    });
};

const broadcastPairPartnerInvites = (volatileState: VolatileState) => {
    broadcast({
        type: 'PAIR_PARTNER_INVITE_UPDATE',
        payload: {
            invites: volatileState.pairPartnerInvites || {},
        },
    });
};

const clearPairInvitesForRoom = (volatileState: VolatileState, roomId: string) => {
    if (!volatileState.pairPartnerInvites) return;
    for (const k of Object.keys(volatileState.pairPartnerInvites)) {
        if (volatileState.pairPartnerInvites[k]?.roomId === roomId) {
            delete volatileState.pairPartnerInvites[k];
        }
    }
};

/** 1번 방부터 순번; 경기장(lobbyChannel)별로 번호 공간 분리 */
function allocPairRoomCode(
    pairRooms: Record<string, types.PairRoomState>,
    channel: 'pair' | 'strategic' | 'playful',
): string {
    const used = new Set<number>();
    for (const r of Object.values(pairRooms)) {
        const roomCh = (r as { lobbyChannel?: string }).lobbyChannel ?? 'pair';
        if (roomCh !== channel) continue;
        const n = parseInt(String(r.code).trim(), 10);
        if (Number.isFinite(n) && n >= 1 && String(n) === String(r.code).trim()) used.add(n);
    }
    let k = 1;
    while (used.has(k)) k += 1;
    return String(k);
}

function pairRoomShellInGame(room: types.PairRoomState): boolean {
    return room.phase === 'in_game';
}

/** 대기/준비 중 페어 방 소속(경기 중 껍데기 방 제외) */
function userInActivePairLobbyRoom(room: types.PairRoomState, userId: string): boolean {
    return (
        room.ownerId === userId ||
        room.partnerId === userId ||
        (room.extraPairMembers ?? []).some((m) => m.id === userId)
    ) && !pairRoomShellInGame(room);
}

function userInAnyRankedMatchingQueue(volatileState: VolatileState, userId: string): boolean {
    const q = volatileState.rankedMatchingQueue;
    if (!q) return false;
    return Boolean(q.strategic?.[userId]);
}

/** 방장이 아닌 멤버를 슬롯·팀에서 제거(방장 퇴장 처리에는 사용하지 않음). */
function removeNonOwnerPairRoomMember(volatileState: VolatileState, room: types.PairRoomState, memberUserId: string): void {
    if (room.ownerId === memberUserId) return;
    if (room.partnerId === memberUserId) {
        room.partnerId = undefined;
        room.partnerName = undefined;
        room.partnerReady = false;
    }
    if (room.extraPairMembers?.some((m) => m.id === memberUserId)) {
        room.extraPairMembers = room.extraPairMembers.filter((m) => m.id !== memberUserId);
    }
    delete room.pairDuoRankedLobbyProposal;
    if (room.roomKind === 'duo_match') {
        syncDuoMatchPairSeatAssignments(room);
    } else {
        room.pairSeatAssignments = {
            teamA: (room.pairSeatAssignments?.teamA ?? [room.ownerId]).filter((id) => id !== memberUserId),
            teamB: (room.pairSeatAssignments?.teamB ?? []).filter((id) => id !== memberUserId),
        };
    }
    room.matchStartedAt = undefined;
    refreshPairRoomTeams(room);
    removePairGuestJoinOrder(room, memberUserId);
    syncPairOwnerStartDeadline(room, Date.now());
    const prop = room.pairLobbySettingChangeProposal;
    if (prop && prop.fromUserId === memberUserId) {
        delete room.pairLobbySettingChangeProposal;
    }
    if (countPairRoomHumanUsers(room) === 0) {
        clearPairInvitesForRoom(volatileState, room.id);
        clearPairRoomTeamChatStore(volatileState, room.id);
        delete volatileState.pairRooms![room.id];
    }
}

/** 방장 퇴장 시 남는 인간 참가자 중 다음 방장 후보 (파트너 → extra 순). */
function pickPairRoomSuccessorHumanWhenOwnerLeaves(room: types.PairRoomState, leavingOwnerId: string): string | null {
    if (room.ownerId !== leavingOwnerId) return null;
    if (room.partnerId && !isPetAiId(room.partnerId) && room.partnerId !== leavingOwnerId) {
        return room.partnerId;
    }
    for (const m of room.extraPairMembers ?? []) {
        if (m.id !== leavingOwnerId && !isPetAiId(m.id)) return m.id;
    }
    return null;
}

function resolvePairSuccessorDisplayNameForOwnerLeave(
    volatileState: VolatileState,
    room: types.PairRoomState,
    successorId: string,
): string {
    if (room.partnerId === successorId && room.partnerName) return room.partnerName;
    const ex = room.extraPairMembers?.find((m) => m.id === successorId);
    if (ex?.name) return ex.name;
    return volatileState.userCache?.get(successorId)?.user?.nickname || '참가자';
}

/**
 * 방장이 나갈 때: 대기/준비 로비에서만, 남은 인간 참가자에게 방장을 넘기고 방을 유지한다.
 * @returns 방을 유지하고 이전했으면 true, 방을 삭제해야 하면 false
 */
function tryTransferPairRoomWhenOwnerLeaves(
    volatileState: VolatileState,
    room: types.PairRoomState,
    leavingOwnerId: string,
    pickSuccessor: (room: types.PairRoomState, leavingOwnerId: string) => string | null = pickPairRoomSuccessorHumanWhenOwnerLeaves,
): boolean {
    if (room.ownerId !== leavingOwnerId) return false;
    if (
        pairRoomShellInGame(room) ||
        room.phase === 'matching' ||
        room.phase === 'match_pending' ||
        room.pairRankedPetProposal ||
        room.pairDuoRankedLobbyProposal
    ) {
        return false;
    }
    const succ = pickSuccessor(room, leavingOwnerId);
    if (!succ) return false;

    const newName = resolvePairSuccessorDisplayNameForOwnerLeave(volatileState, room, succ);

    if (room.roomKind === 'ai_duel') {
        room.ownerId = succ;
        room.ownerName = newName;
        room.ownerReady = false;
        room.partnerId = `pet-ai-${succ}`;
        const nu = volatileState.userCache?.get(succ)?.user;
        room.partnerName = nu ? equippedPairPetDisplayNameForUser(nu) : '내 펫';
        room.partnerReady = true;
        room.extraPairMembers = (room.extraPairMembers ?? []).filter((m) => m.id !== succ);
        if (!room.extraPairMembers?.length) room.extraPairMembers = undefined;
    } else if (room.roomKind === 'friendly_2p') {
        room.ownerId = succ;
        room.ownerName = newName;
        room.ownerReady = false;
        room.partnerId = undefined;
        room.partnerName = undefined;
        room.partnerReady = false;
        room.extraPairMembers = (room.extraPairMembers ?? []).filter((m) => m.id !== succ);
        if (!room.extraPairMembers?.length) room.extraPairMembers = undefined;
    } else {
        const wasPartner = room.partnerId === succ && !isPetAiId(room.partnerId);
        room.ownerId = succ;
        room.ownerName = newName;
        room.ownerReady = false;
        if (wasPartner) {
            room.partnerId = undefined;
            room.partnerName = undefined;
        } else {
            room.extraPairMembers = (room.extraPairMembers ?? []).filter((m) => m.id !== succ);
            if (!room.extraPairMembers?.length) room.extraPairMembers = undefined;
        }
        if (room.roomKind === 'arena_ai') {
            room.partnerId = `pet-ai-${room.ownerId}`;
            room.partnerName = 'AI';
            room.partnerReady = true;
        }
    }

    delete room.pairSeatAssignments;
    delete room.pairLobbySettingChangeProposal;
    delete room.pairLobbySettingChangeCooldownUntil;
    clearPairOwnerStartDeadline(room);
    removePairGuestJoinOrder(room, leavingOwnerId);
    room.matchStartedAt = undefined;
    resetPairRoomReadinessAfterLobbyConfigChange(room);
    refreshPairRoomTeams(room);
    pairLobbyPetSnapshotsFromCache(room, volatileState);
    return true;
}

function forcePairOwnerStartTimeoutTransfer(volatileState: VolatileState, room: types.PairRoomState): boolean {
    const ownerId = room.ownerId;
    const succ = pickFirstJoinedPairRoomGuestSuccessor(room, ownerId);
    if (!succ) {
        clearPairOwnerStartDeadline(room);
        return false;
    }
    abortPairRankedPetProposalsForRoom(volatileState, room.id);
    const kept = tryTransferPairRoomWhenOwnerLeaves(
        volatileState,
        room,
        ownerId,
        pickFirstJoinedPairRoomGuestSuccessor,
    );
    if (!kept) {
        clearPairOwnerStartDeadline(room);
        return false;
    }
    clearPairInvitesForRoom(volatileState, room.id);
    return true;
}

/** 모든 손님 준비 후 방장이 60초 내 경기를 시작하지 않으면 방장 퇴장·첫 입장 손님에게 위임 */
export function tickPairOwnerStartDeadlines(volatileState: VolatileState, nowMs = Date.now()): boolean {
    if (!volatileState.pairRooms) return false;
    let changed = false;
    for (const room of Object.values(volatileState.pairRooms)) {
        syncPairOwnerStartDeadline(room, nowMs);
        if (!pairOwnerStartDeadlineExpired(room, nowMs)) continue;
        if (forcePairOwnerStartTimeoutTransfer(volatileState, room)) changed = true;
    }
    if (changed) {
        broadcastPairRooms(volatileState);
        broadcastPairPartnerInvites(volatileState);
        try {
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
        } catch {
            /* ignore */
        }
    }
    return changed;
}

/**
 * 페어 방에서 유저 제거(방장이면 남은 참가자에게 방장 이전 후 방 유지·불가 시 방 삭제, 그 외 멤버는 슬롯만 비움).
 * `phase === 'in_game'`·매칭 중 등에서는 방장 퇴장 시에도 기존처럼 방을 삭제한다.
 * @returns 방 목록을 변경했으면 true
 */
export function leavePairWaitingRoomIfPresent(volatileState: VolatileState, userId: string): boolean {
    if (!volatileState.pairRooms) return false;
    const target = Object.values(volatileState.pairRooms).find((room) => userInPairRoomMembership(room, userId));
    if (!target) return false;
    abortPairRankedPetProposalsForRoom(volatileState, target.id);
    if (target.ownerId === userId) {
        const kept = tryTransferPairRoomWhenOwnerLeaves(volatileState, target, userId);
        if (!kept) {
            clearPairInvitesForRoom(volatileState, target.id);
            clearPairRoomTeamChatStore(volatileState, target.id);
            delete volatileState.pairRooms[target.id];
        } else {
            clearPairInvitesForRoom(volatileState, target.id);
        }
    } else {
        removeNonOwnerPairRoomMember(volatileState, target, userId);
    }
    broadcastPairRooms(volatileState);
    broadcastPairPartnerInvites(volatileState);
    return true;
}

const PAIR_PARTNER_INVITE_TTL_MS = 30_000;
const PAIR_LOBBY_SCREEN_CLIENT_TTL_MS = 45_000;
const PAIR_STRATEGIC_LOBBY_CHANGE_REJECT_COOLDOWN_MS = 10_000;

function normalizePairLobbyScreenClientId(raw: unknown, userId: string): string {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (s && s.length <= 128) return s;
    return `legacy:${userId}`;
}

function prunePairLobbyScreenClients(volatileState: VolatileState, userId?: string, now = Date.now()): boolean {
    const registry = volatileState.pairLobbyScreenClients;
    if (!registry) return false;

    const targetIds = userId ? [userId] : Object.keys(registry);
    let changed = false;
    for (const uid of targetIds) {
        const clients = registry[uid];
        if (!clients) continue;

        for (const [clientId, lastSeenAt] of Object.entries(clients)) {
            if (!Number.isFinite(lastSeenAt) || now - lastSeenAt > PAIR_LOBBY_SCREEN_CLIENT_TTL_MS) {
                delete clients[clientId];
                changed = true;
            }
        }

        const active = Object.keys(clients).length > 0;
        if (!active) delete registry[uid];

        const status = volatileState.userStatuses[uid];
        if (!status) continue;
        if (active && !status.inPairLobby) {
            status.inPairLobby = true;
            changed = true;
        } else if (!active && status.inPairLobby) {
            delete status.inPairLobby;
            changed = true;
        }
    }
    return changed;
}

/** 30초 무응답 초대 제거 + 동일 대상 10초 재초대 쿨다운(거절·만료 공통) */
export function tickPairPartnerInviteExpiry(volatileState: VolatileState): void {
    if (!volatileState.pairPartnerInvites || Object.keys(volatileState.pairPartnerInvites).length === 0) return;
    const now = Date.now();
    if (!volatileState.pairPartnerInviteCooldowns) volatileState.pairPartnerInviteCooldowns = {};
    let changed = false;
    const expiredPairs: Array<{ inviterId: string; inviteeId: string }> = [];
    const snapshot = { ...volatileState.pairPartnerInvites };
    for (const [id, inv] of Object.entries(snapshot)) {
        if (now - inv.createdAt > PAIR_PARTNER_INVITE_TTL_MS) {
            delete volatileState.pairPartnerInvites[id];
            volatileState.pairPartnerInviteCooldowns[`${inv.inviterId}:${inv.inviteeId}`] = now + 10000;
            expiredPairs.push({ inviterId: inv.inviterId, inviteeId: inv.inviteeId });
            changed = true;
        }
    }
    if (!changed) return;
    broadcastPairPartnerInvites(volatileState);
    for (const p of expiredPairs) {
        broadcast({
            type: 'PAIR_PARTNER_INVITE_DECLINED',
            payload: { inviterId: p.inviterId, inviteeId: p.inviteeId },
        });
    }
}

const toFriendArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
const uniquePush = (list: string[], value: string): string[] => (list.includes(value) ? list : [...list, value]);
const removeFromList = (list: string[], value: string): string[] => list.filter((id) => id !== value);

const ensureFriendFields = (targetUser: User): User => {
    targetUser.friendIds = toFriendArray(targetUser.friendIds);
    targetUser.incomingFriendRequestIds = toFriendArray(targetUser.incomingFriendRequestIds);
    targetUser.outgoingFriendRequestIds = toFriendArray(targetUser.outgoingFriendRequestIds);
    return targetUser;
};

const getFriendSnapshot = (targetUser: User) => {
    const normalized = ensureFriendFields(targetUser);
    return {
        friendIds: normalized.friendIds || [],
        incomingFriendRequestIds: normalized.incomingFriendRequestIds || [],
        outgoingFriendRequestIds: normalized.outgoingFriendRequestIds || [],
    };
};

const pairPetAiPlaceholder = (): types.PairPetAiPlaceholder => ({
    enabled: true,
    source: 'future-pet-system',
    notes: '펫 인벤토리/훈련 슬롯/성장 스탯/Kata 레벨 조정은 추후 펫 AI 시스템에서 연결합니다.',
});

function isPetAiId(id?: string): boolean {
    return Boolean(id && String(id).startsWith('pet-ai-'));
}

function equippedPairPetDisplayNameForUser(user: User): string {
    const row = getEquippedPairPetInventoryRow(user);
    if (row) return getPairPetDisplayName(row);
    return user.equippedPairPetTemplateId
        ? getPairPetDefinition(user.equippedPairPetTemplateId)?.displayName ?? '내 펫'
        : '내 펫';
}

function pairLobbyPetSnapshotFromUser(user: User): types.PairLobbyPetSnapshot | undefined {
    reconcileEquippedPairPetInventoryItem(user);
    if (!hasUsableEquippedPairPet(user)) return undefined;
    const row = getEquippedPairPetInventoryRow(user)!;
    const meta = resolvePairPetMetaFromInventoryRow(row);
    const level = Math.max(1, Math.floor(meta.level) || 1);
    const displayName = getPairPetDisplayName(row);
    const def = user.equippedPairPetTemplateId ? getPairPetDefinition(user.equippedPairPetTemplateId) : null;
    const image = row.image ?? def?.image ?? null;
    const templateId = row.templateId ?? user.equippedPairPetTemplateId ?? undefined;
    return {
        displayName,
        level,
        image,
        templateId,
        grade: row.grade,
        pairPetMeta: JSON.parse(JSON.stringify(meta)) as PairPetMeta,
    };
}

/** userCache에 있으면 방의 펫 페어 로비 스냅샷을 갱신(브로드캐스트 직전) */
function pairLobbyPetSnapshotsFromCache(room: types.PairRoomState, volatileState: VolatileState): void {
    if (room.roomKind !== 'ai_duel' && room.roomKind !== 'friendly_2p') {
        delete room.ownerLobbyPet;
        delete room.opponentLobbyPet;
        return;
    }
    const oppId = room.extraPairMembers?.[0]?.id;
    if (!oppId) {
        delete room.opponentLobbyPet;
    }
    const cache = volatileState.userCache;
    if (!cache) return;
    const ownerHit = cache.get(room.ownerId)?.user;
    if (ownerHit) {
        const snap = pairLobbyPetSnapshotFromUser(ownerHit);
        if (snap) room.ownerLobbyPet = snap;
    }
    if (oppId) {
        const oppHit = cache.get(oppId)?.user;
        if (oppHit) {
            const os = pairLobbyPetSnapshotFromUser(oppHit);
            if (os) room.opponentLobbyPet = os;
        }
    }
}

function hasUsableEquippedPairPet(user: User): boolean {
    reconcileEquippedPairPetInventoryItem(user);
    return Boolean(user.equippedPairPetTemplateId && getEquippedPairPetInventoryRow(user));
}

/** 2인 페어 UI는 teamA 두 칸만 쓰므로, 파트너·초대 슬롯이 teamB에 남지 않게 정규화한다. */
function syncDuoMatchPairSeatAssignments(room: types.PairRoomState): void {
    if (room.roomKind !== 'duo_match') return;
    const out: string[] = [];
    const seen = new Set<string>();
    const push = (id: string | undefined) => {
        if (!id || isPetAiId(id) || seen.has(id)) return;
        seen.add(id);
        out.push(id);
    };
    push(room.ownerId);
    push(room.partnerId);
    for (const m of room.extraPairMembers ?? []) {
        push(m.id);
    }
    room.pairSeatAssignments = { teamA: out.slice(0, 2), teamB: [] };
}

const buildPairTeams = (room: types.PairRoomState): { teamA: types.PairTeamState; teamB: types.PairTeamState } => {
    const ownerReady = room.ownerReady;
    const partnerReady = room.partnerReady;
    const extraMembers = Array.isArray(room.extraPairMembers) ? room.extraPairMembers : [];
    if (room.roomKind === 'friendly_2p') {
        const opponent = extraMembers[0];
        const ownerPetLabel =
            room.ownerLobbyPet != null
                ? `Lv.${room.ownerLobbyPet.level} ${room.ownerLobbyPet.displayName}`
                : '나의 펫';
        const opponentPetLabel =
            opponent && room.opponentLobbyPet != null
                ? `Lv.${room.opponentLobbyPet.level} ${room.opponentLobbyPet.displayName}`
                : opponent
                  ? `${opponent.name}의 펫`
                  : '상대 펫';
        return {
            teamA: {
                id: 'teamA',
                name: '우리 팀',
                members: [
                    { id: room.ownerId, name: room.ownerName, kind: 'user', slot: 'owner', ready: ownerReady },
                    { id: `pet-ai-${room.ownerId}`, name: ownerPetLabel, kind: 'pet', slot: 'ownerPet', ready: true },
                ],
            },
            teamB: {
                id: 'teamB',
                name: '상대 팀',
                members: opponent
                    ? [
                          { id: opponent.id, name: opponent.name, kind: 'user', slot: 'partner', ready: Boolean(opponent.ready) },
                          { id: `pet-ai-${opponent.id}`, name: opponentPetLabel, kind: 'pet', slot: 'opponentPet', ready: true },
                      ]
                    : [],
            },
        };
    }
    /** `ai_duel`·`arena_ai`(전략/놀이 경기장 AI 대결): 팀 A에 유저+내 펫 2슬롯 — `makePairPetAiDuelSettings`가 teamB만 채워도 턴오더가 4인을 만족한다. */
    if (room.roomKind === 'ai_duel' || room.roomKind === 'arena_ai') {
        const ownerPetLabel =
            room.ownerLobbyPet != null
                ? `Lv.${room.ownerLobbyPet.level} ${room.ownerLobbyPet.displayName}`
                : room.partnerName || '나의 펫';
        return {
            teamA: {
                id: 'teamA',
                name: room.roomKind === 'arena_ai' ? '우리 팀' : '우리 펫 페어',
                members: [
                    { id: room.ownerId, name: room.ownerName, kind: 'user', slot: 'owner', ready: ownerReady },
                    { id: `pet-ai-${room.ownerId}`, name: ownerPetLabel, kind: 'pet', slot: 'ownerPet', ready: true },
                ],
            },
            teamB: {
                id: 'teamB',
                name: '상대 팀',
                members: [],
            },
        };
    }
    const partnerReal = room.partnerId && !isPetAiId(room.partnerId) ? room.partnerId : undefined;
    const humanIds = [room.ownerId, ...(partnerReal ? [partnerReal] : []), ...extraMembers.map((m) => m.id)];
    let teamAUserIds: string[] = [];
    let teamBUserIds: string[] = [];
    if (room.pairSeatAssignments) {
        const takeValid = (ids: string[]) => {
            const used = new Set<string>();
            const out: string[] = [];
            for (const id of ids) {
                if (!humanIds.includes(id) || used.has(id)) continue;
                used.add(id);
                out.push(id);
                if (out.length >= 2) break;
            }
            return out;
        };
        teamAUserIds = takeValid(room.pairSeatAssignments.teamA);
        teamBUserIds = takeValid(room.pairSeatAssignments.teamB);
        const seen = new Set([...teamAUserIds, ...teamBUserIds]);
        for (const id of humanIds) {
            if (seen.has(id)) continue;
            if (teamAUserIds.length < 2) {
                teamAUserIds.push(id);
            } else if (teamBUserIds.length < 2) {
                teamBUserIds.push(id);
            }
            seen.add(id);
        }
    } else {
        teamAUserIds = humanIds.slice(0, 2);
        teamBUserIds = [];
    }

    const userMember = (id: string): types.PairParticipantState => {
        const extra = extraMembers.find((m) => m.id === id);
        return {
            id,
            name: id === room.ownerId ? room.ownerName : id === partnerReal ? room.partnerName || '파트너' : extra?.name || '참가자',
            kind: 'user',
            slot: id === room.ownerId ? 'owner' : 'partner',
            ready: id === room.ownerId ? ownerReady : id === partnerReal ? partnerReady : Boolean(extra?.ready),
        };
    };

    return {
        teamA: {
            id: 'teamA',
            name: '우리 팀',
            members: teamAUserIds.map(userMember),
        },
        teamB: {
            id: 'teamB',
            name: '상대 팀',
            members: teamBUserIds.map(userMember),
        },
    };
};

/** 팀 구성 기준 실제 유저 수(4인 친선 확장 시 teamB 유저 포함). */
function countPairRoomHumanUsers(room: types.PairRoomState): number {
    const teams = buildPairTeams(room);
    const ids = new Set<string>();
    for (const m of [...teams.teamA.members, ...teams.teamB.members]) {
        if (m.kind === 'user') ids.add(m.id);
    }
    return ids.size;
}

function collectPairRoomHumanUserIds(room: types.PairRoomState): Set<string> {
    const teams = buildPairTeams(room);
    const ids = new Set<string>();
    for (const m of [...teams.teamA.members, ...teams.teamB.members]) {
        if (m.kind === 'user') ids.add(m.id);
    }
    return ids;
}

/** 클라이언트 myRoom·퇴장 처리와 동일: 팀 멤버에만 남아 있어도 방 소속으로 본다(슬롯 필드와 팀 스냅샷 불일치 대비) */
function userInPairRoomMembership(room: types.PairRoomState, userId: string): boolean {
    if (room.ownerId === userId || room.partnerId === userId) return true;
    if ((room.extraPairMembers ?? []).some((m) => m.id === userId)) return true;
    for (const m of [...(room.teamA?.members ?? []), ...(room.teamB?.members ?? [])]) {
        if (m && String(m.kind).toLowerCase() === 'user' && m.id === userId) return true;
    }
    return false;
}

/** 방장 초대 허용: 해당 유저를 강퇴 목록에서 제거 */
function clearPairRoomKickEntry(room: types.PairRoomState, userId: string): void {
    if (!room.pairRoomKickedUserIds?.length) return;
    room.pairRoomKickedUserIds = room.pairRoomKickedUserIds.filter((id) => id !== userId);
}

function getPairRoomUserTeamId(room: types.PairRoomState, userId: string): 'teamA' | 'teamB' | null {
    const teams = buildPairTeams(room);
    if (teams.teamA.members.some((m) => m.kind === 'user' && m.id === userId)) return 'teamA';
    if (teams.teamB.members.some((m) => m.kind === 'user' && m.id === userId)) return 'teamB';
    return null;
}

/** 펫·2인 페어 랭킹전 매칭 취소: 방장·인간 파트너·추가 인간 멤버 */
function canUserCancelPairPetOrDuoRankedMatching(room: types.PairRoomState, userId: string): boolean {
    if (room.ownerId === userId) return true;
    if (room.partnerId && !isPetAiId(room.partnerId) && room.partnerId === userId) return true;
    return Boolean((room.extraPairMembers ?? []).some((m) => m.id === userId));
}

function appendPairRankedPetDuoMatchCancelChatLine(volatileState: VolatileState, room: types.PairRoomState, actor: User, ts: number) {
    const teamId = getPairRoomUserTeamId(room, actor.id) ?? 'teamA';
    const line: types.PairRoomChatLine = {
        id: `pair-chat-${randomUUID()}`,
        userId: actor.id,
        nickname: actor.nickname,
        text: '랭킹전 매칭을 취소했습니다.',
        timestamp: ts,
        scope: 'room',
        teamId,
    };
    if (!room.pairChatMessages) room.pairChatMessages = [];
    room.pairChatMessages.push(line);
    if (room.pairChatMessages.length > 100) room.pairChatMessages.shift();
    broadcastToUserIds(getPairRoomChatRecipients(room, 'room', teamId), {
        type: 'PAIR_ROOM_CHAT',
        payload: { roomId: room.id, message: line },
    });
}

function validatePairSeatAssignments(
    room: types.PairRoomState,
    teamAIn: string[],
    teamBIn: string[],
): { ok: true; teamA: string[]; teamB: string[] } | { ok: false; error: string } {
    if (room.phase === 'in_game') return { ok: false, error: '진행 중에는 팀 배치를 바꿀 수 없습니다.' };
    const partnerReal = room.partnerId && !isPetAiId(room.partnerId) ? room.partnerId : undefined;
    const expected = new Set<string>([
        room.ownerId,
        ...(partnerReal ? [partnerReal] : []),
        ...(room.extraPairMembers ?? []).map((m) => m.id),
    ]);
    const teamA = teamAIn.map(String).filter((id) => expected.has(id)).slice(0, 2);
    const teamB = teamBIn.map(String).filter((id) => expected.has(id)).slice(0, 2);
    const used = new Set<string>();
    for (const id of teamA) {
        if (used.has(id)) return { ok: false, error: '한 유저는 한 팀에만 배치할 수 있습니다.' };
        used.add(id);
    }
    for (const id of teamB) {
        if (used.has(id)) return { ok: false, error: '한 유저는 한 팀에만 배치할 수 있습니다.' };
        used.add(id);
    }
    if (room.roomKind === 'duo_match') {
        if (teamB.length > 0) return { ok: false, error: '2인 페어 방에서는 같은 팀 슬롯만 사용합니다.' };
        if (used.size !== expected.size) return { ok: false, error: '방에 있는 유저를 모두 같은 팀에 배치해야 합니다.' };
        if (!teamA.includes(room.ownerId)) return { ok: false, error: '방장은 같은 팀 슬롯에 포함되어야 합니다.' };
        return { ok: true, teamA, teamB: [] as string[] };
    }
    if (used.size !== expected.size) return { ok: false, error: '방에 있는 유저를 모두 정확히 한 번씩 배치해야 합니다.' };
    return { ok: true, teamA, teamB };
}

function getPairRoomChatRecipients(room: types.PairRoomState, scope: 'room' | 'team', senderTeam: 'teamA' | 'teamB'): Set<string> {
    if (scope === 'room') return collectPairRoomHumanUserIds(room);
    const teams = buildPairTeams(room);
    const list = senderTeam === 'teamA' ? teams.teamA.members : teams.teamB.members;
    return new Set(list.filter((m) => m.kind === 'user').map((m) => m.id));
}

function mergePairChatHistoriesForViewer(
    room: types.PairRoomState,
    volatileState: VolatileState,
    viewerId: string,
): types.PairRoomChatLine[] {
    const team = getPairRoomUserTeamId(room, viewerId);
    const publicMsgs = room.pairChatMessages || [];
    const buckets = volatileState.pairRoomTeamChats?.[room.id];
    const teamMsgs =
        team && buckets ? (team === 'teamA' ? buckets.teamA || [] : buckets.teamB || []) : [];
    return [...publicMsgs, ...teamMsgs].sort((a, b) => a.timestamp - b.timestamp).slice(-100);
}

function clearPairRoomTeamChatStore(volatileState: VolatileState, roomId: string) {
    if (volatileState.pairRoomTeamChats) delete volatileState.pairRoomTeamChats[roomId];
}

/** 방 제목·공개·게임 규칙 등 변경 시 — 방장·다른 유저 준비 해제(펫 슬롯은 예외) */
function resetPairRoomReadinessAfterLobbyConfigChange(room: types.PairRoomState) {
    room.ownerReady = false;
    if (room.partnerId && !isPetAiId(room.partnerId)) {
        room.partnerReady = false;
    } else if (isPetAiId(room.partnerId)) {
        room.partnerReady = true;
    } else {
        room.partnerReady = room.roomKind === 'friendly_4p' && !room.partnerId;
    }
    if (room.extraPairMembers?.length) {
        room.extraPairMembers = room.extraPairMembers.map((m) => ({ ...m, ready: false }));
    }
    clearPairOwnerStartDeadline(room);
}

function mergePairRoomLobbyGameSettings(room: types.PairRoomState, payload: { selectedGameMode?: GameMode; settings?: types.GameSettings }) {
    room.selectedGameMode = resolvePairWaitingRoomSelectedGameMode(room, payload.selectedGameMode ?? room.selectedGameMode);
    room.settings = {
        ...DEFAULT_GAME_SETTINGS,
        ...room.settings,
        ...(payload.settings && typeof payload.settings === 'object' ? payload.settings : {}),
    };
    const rk = room.roomKind;
    if (rk === 'ai_duel' || rk === 'duo_match' || rk === 'arena_ai') {
        room.settings = clampAiLobbyStrategicItemCaps(room.selectedGameMode, room.settings);
    }
}

const refreshPairRoomTeams = (room: types.PairRoomState): types.PairRoomState => {
    const teams = buildPairTeams(room);
    room.teamA = teams.teamA;
    room.teamB = teams.teamB;
    if (room.matchStartedAt) {
        room.phase = 'in_game';
    } else if (room.pairRankedPetProposal) {
        room.phase = 'match_pending';
    } else if (room.phase === 'matching') {
        room.phase = 'matching';
    } else if (room.ownerReady && room.partnerId && room.partnerReady) {
        room.phase = 'ready';
    } else {
        room.phase = 'waiting';
    }
    return room;
};

function restoreEndedPairRoomShellsIfNeeded(volatileState: VolatileState, game: types.LiveGameSession): boolean {
    if (!volatileState.pairRooms) return false;
    if (game.gameStatus !== 'ended' && game.gameStatus !== 'no_contest') return false;

    const payloadRoomId = typeof game.settings?.pairGame?.roomId === 'string' ? game.settings.pairGame.roomId : '';
    const playerIds = new Set<string>([game.player1.id, game.player2.id].filter(Boolean));
    let changed = false;

    for (const room of Object.values(volatileState.pairRooms)) {
        if (!room || room.phase !== 'in_game') continue;

        const roomMemberIds = new Set<string>([
            room.ownerId,
            room.partnerId,
            ...(room.extraPairMembers ?? []).map((m) => m.id),
        ].filter((id): id is string => Boolean(id) && !isPetAiId(id)));
        const hasAnyPlayer = Array.from(playerIds).some((id) => roomMemberIds.has(id));
        const idMatched =
            (payloadRoomId && (payloadRoomId === room.id || payloadRoomId.includes(room.id))) ||
            hasAnyPlayer;
        if (!idMatched) continue;

        room.matchStartedAt = undefined;
        refreshPairRoomTeams(room);
        changed = true;
    }

    return changed;
}

/** 페어 경기장에서 방을 만들지 않고 펫 페어 AI 대전만 시작할 때 — volatileState에 넣지 않는 일회용 스냅샷 */
function buildEphemeralPairPetAiDuelLobbySnapshot(
    user: User,
    payload: { mode?: GameMode; settings?: types.GameSettings } | undefined,
): types.PairRoomState | null {
    if (!hasUsableEquippedPairPet(user)) return null;
    const roomId = `pair-ai-ephemeral-${randomUUID()}`;
    const ownerPairPetName = equippedPairPetDisplayNameForUser(user);
    const room: types.PairRoomState = {
        id: roomId,
        code: '0',
        mode: 'ai',
        pairMode: 'ai',
        roomKind: 'ai_duel',
        visibility: 'public',
        passwordProtected: false,
        phase: 'waiting',
        lobbyChannel: 'pair',
        title: clampPairRoomTitle(`${user.nickname}님의 펫 페어방`),
        ownerId: user.id,
        ownerName: user.nickname,
        partnerId: `pet-ai-${user.id}`,
        partnerName: ownerPairPetName,
        selectedGameMode: PAIR_MODE_DEFAULT_GAME_MODE,
        settings: { ...DEFAULT_GAME_SETTINGS },
        teamA: { id: 'teamA', name: '우리 팀', members: [] },
        teamB: { id: 'teamB', name: '상대 팀', members: [] },
        futurePetAi: pairPetAiPlaceholder(),
        ownerReady: false,
        partnerReady: true,
        createdAt: Date.now(),
        pairChatMessages: [],
    };
    const snap = pairLobbyPetSnapshotFromUser(user);
    if (snap) room.ownerLobbyPet = snap;
    mergePairRoomLobbyGameSettings(room, {
        selectedGameMode: payload?.mode,
        settings: payload?.settings,
    });
    return refreshPairRoomTeams(room);
}

function resolvePairMemberDisplayNameForTransfer(volatileState: VolatileState, room: types.PairRoomState, userId: string): string {
    if (room.ownerId === userId) return room.ownerName;
    if (room.partnerId === userId) return room.partnerName || '파트너';
    const ex = (room.extraPairMembers ?? []).find((m) => m.id === userId);
    if (ex) return ex.name;
    const nick = volatileState.userCache?.get(userId)?.user?.nickname;
    return nick || userId;
}

function swapPairSeatAssignmentsForOwnershipTransfer(room: types.PairRoomState, oldOwnerId: string, newOwnerId: string): void {
    if (!room.pairSeatAssignments) return;
    const swap = (ids: string[]) =>
        ids.map((id) => (id === oldOwnerId ? newOwnerId : id === newOwnerId ? oldOwnerId : id));
    room.pairSeatAssignments = {
        teamA: swap(room.pairSeatAssignments.teamA ?? []),
        teamB: swap(room.pairSeatAssignments.teamB ?? []),
    };
}

/** 방장 위임: `newOwnerId`는 파트너(인간) 또는 extra 멤버여야 함. `ai_duel`은 상대(extra)만. */
function applyPairRoomOwnershipTransfer(
    volatileState: VolatileState,
    room: types.PairRoomState,
    newOwnerId: string,
    newOwnerDisplayName: string,
): void {
    const oldOwnerId = room.ownerId;
    const oldOwnerName = room.ownerName;

    const isPartnerTarget = room.partnerId === newOwnerId && !isPetAiId(room.partnerId);
    const isExtraTarget = (room.extraPairMembers ?? []).some((m) => m.id === newOwnerId);

    if (room.roomKind === 'ai_duel') {
        if (!isExtraTarget) return;
        room.ownerId = newOwnerId;
        room.ownerName = newOwnerDisplayName;
        room.ownerReady = false;
        room.partnerId = `pet-ai-${newOwnerId}`;
        const nu = volatileState.userCache?.get(newOwnerId)?.user;
        room.partnerName = nu ? equippedPairPetDisplayNameForUser(nu) : '내 펫';
        room.partnerReady = true;
        room.extraPairMembers = [{ id: oldOwnerId, name: oldOwnerName, ready: false }];
        swapPairSeatAssignmentsForOwnershipTransfer(room, oldOwnerId, newOwnerId);
        room.matchStartedAt = undefined;
        delete room.pairLobbySettingChangeProposal;
        resetPairRoomReadinessAfterLobbyConfigChange(room);
        refreshPairRoomTeams(room);
        pairLobbyPetSnapshotsFromCache(room, volatileState);
        return;
    }
    if (room.roomKind === 'friendly_2p') {
        if (!isExtraTarget) return;
        room.ownerId = newOwnerId;
        room.ownerName = newOwnerDisplayName;
        room.ownerReady = false;
        room.partnerId = undefined;
        room.partnerName = undefined;
        room.partnerReady = false;
        room.extraPairMembers = [{ id: oldOwnerId, name: oldOwnerName, ready: false }];
        swapPairSeatAssignmentsForOwnershipTransfer(room, oldOwnerId, newOwnerId);
        room.matchStartedAt = undefined;
        delete room.pairLobbySettingChangeProposal;
        resetPairRoomReadinessAfterLobbyConfigChange(room);
        refreshPairRoomTeams(room);
        pairLobbyPetSnapshotsFromCache(room, volatileState);
        return;
    }

    if (!isPartnerTarget && !isExtraTarget) return;

    if (isPartnerTarget) {
        room.ownerId = newOwnerId;
        room.ownerName = newOwnerDisplayName;
        room.partnerId = oldOwnerId;
        room.partnerName = oldOwnerName;
    } else if (isExtraTarget) {
        room.ownerId = newOwnerId;
        room.ownerName = newOwnerDisplayName;
        const withoutNew = (room.extraPairMembers ?? []).filter((m) => m.id !== newOwnerId);
        room.extraPairMembers = withoutNew;
        const partnerReal = room.partnerId && !isPetAiId(room.partnerId) ? room.partnerId : undefined;
        if (partnerReal) {
            room.extraPairMembers = [...(room.extraPairMembers ?? []), { id: oldOwnerId, name: oldOwnerName, ready: false }];
        } else {
            room.partnerId = oldOwnerId;
            room.partnerName = oldOwnerName;
            room.partnerReady = false;
        }
    }

    swapPairSeatAssignmentsForOwnershipTransfer(room, oldOwnerId, newOwnerId);
    room.matchStartedAt = undefined;
    delete room.pairLobbySettingChangeProposal;
    resetPairRoomReadinessAfterLobbyConfigChange(room);
    refreshPairRoomTeams(room);
    pairLobbyPetSnapshotsFromCache(room, volatileState);
}

/** 방장이 방 종류 변경 시 모드·파트너 슬롯을 맞춤 */
function applyPairRoomKindTransition(room: types.PairRoomState, normalizedKind: 'ai_duel' | 'duo_match' | 'friendly_4p' | 'friendly_2p' | 'arena_ai') {
    const prevKind = room.roomKind;
    /** 2인 친선·펫 페어에 입장한 상대(인간) — 다른 방 종류로 바꿀 때 유지 */
    const petPairGuest =
        (prevKind === 'ai_duel' || prevKind === 'friendly_2p') && normalizedKind !== 'ai_duel' && normalizedKind !== 'friendly_2p'
            ? room.extraPairMembers?.[0]
            : undefined;

    const effectiveMode: 'pvp' | 'ai' = normalizedKind === 'ai_duel' || normalizedKind === 'arena_ai' ? 'ai' : 'pvp';
    room.roomKind = normalizedKind;
    room.mode = effectiveMode;
    room.pairMode = effectiveMode;
    room.ownerReady = false;

    delete room.pairSeatAssignments;

    if (effectiveMode === 'ai') {
        room.extraPairMembers = undefined;
        room.partnerId = `pet-ai-${room.ownerId}`;
        room.partnerName = normalizedKind === 'arena_ai' ? 'AI' : '내 펫';
        room.partnerReady = true;
        if (normalizedKind === 'arena_ai') {
            delete room.futurePetAi;
        } else {
            room.futurePetAi = pairPetAiPlaceholder();
        }
        if (prevKind !== 'ai_duel' && prevKind !== 'arena_ai' && prevKind !== 'friendly_2p') {
            delete room.ownerLobbyPet;
            delete room.opponentLobbyPet;
        }
        if (prevKind === 'friendly_2p') {
            delete room.opponentLobbyPet;
        }
        return;
    }

    room.futurePetAi = undefined;
    if (prevKind === 'arena_ai') {
        delete room.ownerLobbyPet;
        delete room.opponentLobbyPet;
    } else if ((prevKind === 'ai_duel' || prevKind === 'friendly_2p') && normalizedKind !== 'ai_duel' && normalizedKind !== 'friendly_2p') {
        delete room.ownerLobbyPet;
        delete room.opponentLobbyPet;
    }

    if (petPairGuest && normalizedKind === 'duo_match') {
        room.extraPairMembers = undefined;
        room.partnerId = petPairGuest.id;
        room.partnerName = petPairGuest.name;
        room.partnerReady = false;
        /** 방장 옆(같은 팀)으로 배치 */
        room.pairSeatAssignments = { teamA: [room.ownerId, petPairGuest.id], teamB: [] };
        return;
    }

    if (petPairGuest && normalizedKind === 'friendly_4p') {
        room.partnerId = undefined;
        room.partnerName = undefined;
        room.partnerReady = true;
        room.extraPairMembers = [{ id: petPairGuest.id, name: petPairGuest.name, ready: false }];
        /** 펫 페어 때와 동일: 방장 팀 / 상대 팀 — 펫만 사라지고 빈 슬롯·초대 자리는 팀 그리드가 담당 */
        room.pairSeatAssignments = { teamA: [room.ownerId], teamB: [petPairGuest.id] };
        return;
    }

    if (petPairGuest && normalizedKind === 'friendly_2p') {
        room.partnerId = undefined;
        room.partnerName = undefined;
        room.partnerReady = false;
        room.extraPairMembers = [{ id: petPairGuest.id, name: petPairGuest.name, ready: false }];
        room.pairSeatAssignments = { teamA: [room.ownerId], teamB: [petPairGuest.id] };
        return;
    }

    room.extraPairMembers = undefined;
    if (room.partnerId && String(room.partnerId).startsWith('pet-ai-')) {
        room.partnerId = undefined;
        room.partnerName = undefined;
    }
    room.partnerReady = !room.partnerId ? normalizedKind === 'friendly_4p' : false;
}

type PairLobbyOwnerPatchPayload = {
    title?: string;
    visibility?: 'public' | 'private';
    password?: string;
    roomKind?: 'ai_duel' | 'duo_match' | 'friendly_4p' | 'friendly_2p' | 'arena_ai';
    selectedGameMode?: GameMode;
    settings?: types.GameSettings;
};

/** 손님 제안 시 방장 전용 필드 — 서버·클라이언트에서 제거(듀오 손님은 덤·베이스돌 수·따내기 목표 등 불가). */
function stripPairLobbyGuestForbiddenSettingsPatch(settings: types.GameSettings | undefined): types.GameSettings | undefined {
    if (!settings || typeof settings !== 'object') return settings;
    const next = { ...settings } as Record<string, unknown>;
    delete next.komi;
    delete next.baseStones;
    delete next.captureTarget;
    return next as types.GameSettings;
}

/** `PAIR_UPDATE_ROOM_LOBBY` / 전략 방 변경 제안 수락 시 공통 적용. 실패 시 한글 오류 문구. */
function applyPairRoomLobbyOwnerPayloadToRoom(
    target: types.PairRoomState,
    actingOwner: User,
    p: PairLobbyOwnerPatchPayload,
): string | undefined {
    if (target.phase === 'in_game' || target.phase === 'matching' || target.pairRankedPetProposal) {
        return '매칭·대국 중에는 방 설정을 바꿀 수 없습니다.';
    }

    if (p.visibility === 'public') {
        target.visibility = 'public';
        target.passwordProtected = false;
        delete (target as any).roomPassword;
    } else if (p.visibility === 'private') {
        const normalizedPassword = typeof p.password === 'string' ? p.password.trim() : '';
        const existingPw = String((target as any).roomPassword || '');
        const effectivePw = normalizedPassword.length === 4 ? normalizedPassword : existingPw;
        if (effectivePw.length !== 4) {
            return '비공개방 비밀번호는 4자로 설정해 주세요.';
        }
        (target as any).roomPassword = effectivePw;
        target.visibility = 'private';
        target.passwordProtected = true;
    } else if (typeof p.password === 'string' && target.visibility === 'private') {
        const normalizedPassword = p.password.trim();
        if (normalizedPassword.length === 4) {
            (target as any).roomPassword = normalizedPassword;
        }
    }

    if (typeof p.title === 'string') {
        const t = clampPairRoomTitle(p.title);
        if (t) target.title = t;
    }

    if (
        p.roomKind === 'ai_duel' ||
        p.roomKind === 'duo_match' ||
        p.roomKind === 'friendly_4p' ||
        p.roomKind === 'friendly_2p' ||
        p.roomKind === 'arena_ai'
    ) {
        const normalizedKind = p.roomKind;
        const lobbyCh = (target as { lobbyChannel?: string }).lobbyChannel ?? 'pair';
        if (normalizedKind !== target.roomKind) {
            if (normalizedKind === 'arena_ai' && lobbyCh !== 'strategic' && lobbyCh !== 'playful') {
                return 'AI와 대결은 전략·놀이 경기장 방만 전환할 수 있습니다.';
            }
            if (normalizedKind === 'ai_duel' && lobbyCh !== 'pair') {
                return '펫 랭킹 방은 페어 경기장 방만 전환할 수 있습니다.';
            }
            if (normalizedKind === 'arena_ai' && target.roomKind !== 'arena_ai') {
                const realPartner = target.partnerId && !isPetAiId(target.partnerId);
                if (realPartner || countPairRoomHumanUsers(target) !== 1) {
                    return 'AI와 대결로 바꾸려면 방에 본인만 있어야 합니다.';
                }
            }
            if (normalizedKind === 'ai_duel' && target.roomKind !== 'ai_duel') {
                if (!hasUsableEquippedPairPet(actingOwner)) {
                    return '펫 페어로 바꾸려면 페어 펫을 장착해야 합니다.';
                }
                const realPartner = target.partnerId && !isPetAiId(target.partnerId);
                if (realPartner) {
                    return '펫 페어로 바꾸려면 다른 유저가 없어야 합니다.';
                }
                if (countPairRoomHumanUsers(target) !== 1) {
                    return '펫 페어로 바꾸려면 방에 본인만 있어야 합니다.';
                }
            }
            if (normalizedKind === 'friendly_2p' && target.roomKind !== 'friendly_2p') {
                if (lobbyCh !== 'pair') {
                    return '2인 친선은 페어 경기장 방만 전환할 수 있습니다.';
                }
                if (!hasUsableEquippedPairPet(actingOwner)) {
                    return '2인 친선으로 바꾸려면 페어 펫을 장착해야 합니다.';
                }
                if (countPairRoomHumanUsers(target) > 2) {
                    return '참가자가 많아 2인 친선으로 변경할 수 없습니다.';
                }
            }
            if (
                target.roomKind === 'friendly_4p' &&
                (normalizedKind === 'duo_match' || normalizedKind === 'ai_duel' || normalizedKind === 'friendly_2p') &&
                countPairRoomHumanUsers(target) >= 3
            ) {
                return '4인 친선 방에 유저가 3명 이상일 때는 2인 페어·펫 페어로 변경할 수 없습니다.';
            }
            if (
                (target.roomKind === 'ai_duel' || target.roomKind === 'friendly_2p') &&
                normalizedKind !== 'ai_duel' &&
                normalizedKind !== 'friendly_2p' &&
                (target.extraPairMembers?.length ?? 0) > 1
            ) {
                return '해당 방에 복수 상대가 있을 때는 방 종류를 바꿀 수 없습니다.';
            }
            applyPairRoomKindTransition(target, normalizedKind);
            if (normalizedKind === 'ai_duel') {
                target.partnerName = equippedPairPetDisplayNameForUser(actingOwner);
                const snap = pairLobbyPetSnapshotFromUser(actingOwner);
                if (snap) target.ownerLobbyPet = snap;
            }
            if (normalizedKind === 'friendly_2p') {
                const snap = pairLobbyPetSnapshotFromUser(actingOwner);
                if (snap) target.ownerLobbyPet = snap;
            }
            if (normalizedKind === 'arena_ai') {
                delete target.ownerLobbyPet;
                delete target.opponentLobbyPet;
                target.partnerName = 'AI';
            }
        }
    }

    if (p.selectedGameMode !== undefined || p.settings !== undefined) {
        mergePairRoomLobbyGameSettings(target, {
            selectedGameMode: p.selectedGameMode,
            settings: p.settings,
        });
    }

    resetPairRoomReadinessAfterLobbyConfigChange(target);
    refreshPairRoomTeams(target);
    return undefined;
}

const buildPairGameSettings = (room: types.PairRoomState): types.GameSettings => {
    const syncedRoom = refreshPairRoomTeams({ ...room, teamA: { ...room.teamA, members: [...room.teamA.members] }, teamB: { ...room.teamB, members: [...room.teamB.members] } });
    const settings: types.GameSettings = {
        ...room.settings,
        pairGame: {
            lobbyChannel: syncedRoom.lobbyChannel ?? 'pair',
            roomId: syncedRoom.id,
            pairLobbyOwnerId: syncedRoom.ownerId,
            pairMode:
                (syncedRoom.roomKind === 'ai_duel' || syncedRoom.roomKind === 'arena_ai') &&
                (syncedRoom.extraPairMembers?.length ?? 0) > 0
                    ? 'pvp'
                    : syncedRoom.pairMode,
            teamA: {
                name: syncedRoom.teamA.name,
                members: syncedRoom.teamA.members.map(({ id, name, kind, slot }) => ({ id, name, kind, slot })),
            },
            teamB: {
                name: syncedRoom.teamB.name,
                members: syncedRoom.teamB.members.map(({ id, name, kind, slot }) => ({ id, name, kind, slot })),
            },
            futurePetAi: syncedRoom.futurePetAi,
        },
    };
    const lobbyCh = syncedRoom.lobbyChannel ?? 'pair';
    if ((lobbyCh === 'playful' || lobbyCh === 'strategic') && syncedRoom.roomKind === 'duo_match') {
        delete (settings as any).player1Color;
    }
    return settings;
};

const buildRankedHumanDuoVsDuoGameSettings = (
    roomA: types.PairRoomState,
    ownerA: User,
    partnerA: User,
    roomB: types.PairRoomState,
    ownerB: User,
    partnerB: User,
): types.GameSettings => {
    const mode = pairModeOrDefault(roomA.selectedGameMode);
    const rankedBase = getRankedGameSettings(mode);
    const lobbyCh = (roomA.lobbyChannel === 'playful' ? 'playful' : 'strategic') as 'strategic' | 'playful';
    return {
        ...DEFAULT_GAME_SETTINGS,
        ...rankedBase,
        pairGame: {
            lobbyChannel: lobbyCh,
            roomId: `pair-duo-ranked-${roomA.id}-${roomB.id}`,
            pairMode: 'pvp',
            teamA: {
                name: `${ownerA.nickname} 팀`,
                members: [
                    { id: ownerA.id, name: ownerA.nickname, kind: 'user' as const, slot: 'owner' },
                    { id: partnerA.id, name: partnerA.nickname, kind: 'user' as const, slot: 'partner' },
                ],
            },
            teamB: {
                name: `${ownerB.nickname} 팀`,
                members: [
                    { id: ownerB.id, name: ownerB.nickname, kind: 'user' as const, slot: 'owner' },
                    { id: partnerB.id, name: partnerB.nickname, kind: 'user' as const, slot: 'partner' },
                ],
            },
        },
    };
};

const buildRankedPairPetGameSettings = (roomA: types.PairRoomState, ownerA: User, roomB: types.PairRoomState, ownerB: User): types.GameSettings => {
    const mode = pairModeOrDefault(roomA.selectedGameMode);
    const rankedBase = getRankedGameSettings(mode);
    return {
        ...DEFAULT_GAME_SETTINGS,
        ...rankedBase,
        pairGame: {
            lobbyChannel: 'pair',
            roomId: `pair-ranked-${roomA.id}-${roomB.id}`,
            pairMode: 'pvp',
            teamA: {
                name: `${ownerA.nickname} 팀`,
                members: [
                    { id: ownerA.id, name: ownerA.nickname, kind: 'user' as const, slot: 'owner' },
                    { id: `pet-ai-${ownerA.id}`, name: `${ownerA.nickname}의 펫`, kind: 'pet' as const, slot: 'ownerPet' },
                ],
            },
            teamB: {
                name: `${ownerB.nickname} 팀`,
                members: [
                    { id: ownerB.id, name: ownerB.nickname, kind: 'user' as const, slot: 'partner' },
                    { id: `pet-ai-${ownerB.id}`, name: `${ownerB.nickname}의 펫`, kind: 'pet' as const, slot: 'opponentPet' },
                ],
            },
        },
    };
};

const makePairPetAiDuelSettings = (room: types.PairRoomState): types.GameSettings => {
    const settings = buildPairGameSettings(room);
    if (settings.pairGame) {
        settings.pairGame.pairMode = 'ai';
        const syntheticOpponentPetDisplayName = getPairPetDefinition('pair-pet-2')?.displayName ?? '상대 펫';
        settings.pairGame.teamB = {
            name: '상대 AI 팀',
            members: [
                { id: 'pair-opponent-ai', name: '상대 AI', kind: 'ai' as const, slot: 'opponentAi' },
                { id: 'pair-opponent-pet', name: syntheticOpponentPetDisplayName, kind: 'pet' as const, slot: 'opponentPet' },
            ],
        };
        const snap = getKataServerRuntimeSnapshot();
        const profileStep = resolveAiLobbyProfileStepFromSettings(room.settings || {}, snap.strategicLobbyKataByStep);
        const step = Math.max(1, Math.min(10, Math.round(profileStep)));
        const kataLevel = strategicKataLevelFromSnapshot(snap, step);
        settings.pairGame.pairKataFixedLevelByParticipantId = {
            'pair-opponent-ai': kataLevel,
            'pair-opponent-pet': kataLevel,
        };
        settings.pairGame.pairOpponentPetDisplayLevelByParticipantId = {
            'pair-opponent-ai': rollPairAiOpponentPetDisplayLevelForProfileStep(step),
            'pair-opponent-pet': rollPairAiOpponentPetDisplayLevelForProfileStep(step),
        };
    }
    return settings;
};

const makeDuoPairAiDuelSettings = (room: types.PairRoomState): types.GameSettings => {
    const partnerId = room.partnerId && !isPetAiId(room.partnerId) ? room.partnerId : null;
    const partnerName = room.partnerName || '파트너';
    const syntheticOpponentPetDisplayName = getPairPetDefinition('pair-pet-2')?.displayName ?? '상대 펫';
    const settings: types.GameSettings = {
        ...room.settings,
        pairGame: {
            lobbyChannel: room.lobbyChannel ?? 'strategic',
            roomId: room.id,
            pairMode: 'ai',
            teamA: {
                name: '우리 팀',
                members: [
                    { id: room.ownerId, name: room.ownerName, kind: 'user' as const, slot: 'owner' },
                    { id: partnerId || 'pair-missing-partner', name: partnerName, kind: 'user' as const, slot: 'partner' },
                ],
            },
            teamB: {
                name: '상대 AI 팀',
                members: [
                    { id: 'pair-opponent-ai', name: '상대 AI', kind: 'ai' as const, slot: 'opponentAi' },
                    { id: 'pair-opponent-pet', name: syntheticOpponentPetDisplayName, kind: 'pet' as const, slot: 'opponentPet' },
                ],
            },
        },
    };
    if (settings.pairGame) {
        const snap = getKataServerRuntimeSnapshot();
        const profileStep = resolveAiLobbyProfileStepFromSettings(room.settings || {}, snap.strategicLobbyKataByStep);
        const step = Math.max(1, Math.min(10, Math.round(profileStep)));
        const kataLevel = strategicKataLevelFromSnapshot(snap, step);
        settings.pairGame.pairKataFixedLevelByParticipantId = {
            'pair-opponent-ai': kataLevel,
            'pair-opponent-pet': kataLevel,
        };
        settings.pairGame.pairOpponentPetDisplayLevelByParticipantId = {
            'pair-opponent-ai': rollPairAiOpponentPetDisplayLevelForProfileStep(step),
            'pair-opponent-pet': rollPairAiOpponentPetDisplayLevelForProfileStep(step),
        };
    }
    return settings;
};

function getDuoPairAiPartner(room: types.PairRoomState): { id: string; name: string; ready: boolean } | null {
    if (room.partnerId && !isPetAiId(room.partnerId)) {
        return { id: room.partnerId, name: room.partnerName || '파트너', ready: Boolean(room.partnerReady) };
    }
    const extra = room.extraPairMembers?.[0];
    return extra ? { id: extra.id, name: extra.name, ready: Boolean(extra.ready) } : null;
}

export function configurePairClassicGameStart(
    game: types.LiveGameSession,
    ownerUser: User,
    petStatUsers: User[] = [ownerUser],
): void {
    if (!PAIR_GO_GAME_MODES.includes(game.mode) || !game.settings?.pairGame) return;
    const pairGame = game.settings.pairGame;
    const turnOrder = buildTeamPreservingPairTurnOrder(pairGame);
    pairGame.turnOrder = turnOrder;
    const hasAiSeat = turnOrder.some((seat) => isPairAiSeat(seat));
    const captureRuleGame = pairModeIncludesCaptureRule(game.mode, game.settings);
    if (hasAiSeat && !captureRuleGame) {
        game.settings.scoringTurnLimit = getAiScoringTurnLimitByBoardSize(game.settings.boardSize || 19);
        delete (game.settings as any).autoScoringTurns;
    } else {
        game.settings.scoringTurnLimit = 0;
        delete (game.settings as any).autoScoringTurns;
    }
    pairGame.currentTurnIndex = 0;
    pairGame.passSeatIds = [];
    pairGame.orderSeededAt = Date.now();
    pairGame.orderRevealConfirmed = {};
    for (const id of getPairHumanParticipantIds(pairGame)) {
        pairGame.orderRevealConfirmed[id] = false;
    }
    hydratePairGamePetKataAndRpsIfNeeded(game, ownerUser, petStatUsers);
    if (pairGame.pairKataFixedLevelByParticipantId) {
        pairGame.pairKataFixedLevelByParticipantId = Object.fromEntries(
            Object.entries(pairGame.pairKataFixedLevelByParticipantId).filter(([participantId]) =>
                turnOrder.some((seat) => seat.participantId === participantId),
            ),
        );
    }
    if (pairGame.pairOpponentPetDisplayLevelByParticipantId) {
        pairGame.pairOpponentPetDisplayLevelByParticipantId = Object.fromEntries(
            Object.entries(pairGame.pairOpponentPetDisplayLevelByParticipantId).filter(([participantId]) =>
                turnOrder.some((seat) => seat.participantId === participantId),
            ),
        );
    }
    const black1 = turnOrder.find((s) => s.seatId === 'black1') ?? turnOrder.find((s) => s.player === types.Player.Black);
    const white1 = turnOrder.find((s) => s.seatId === 'white1') ?? turnOrder.find((s) => s.player === types.Player.White);
    game.blackPlayerId = black1?.participantId ?? game.blackPlayerId;
    game.whitePlayerId = white1?.participantId ?? game.whitePlayerId;
    const usesModePreGameFlow =
        game.mode === GameMode.Capture ||
        game.mode === GameMode.Base ||
        (game.mode === GameMode.Mix &&
            Boolean(game.settings?.mixedModes?.some((m) => m === GameMode.Base || m === GameMode.Capture)));
    if (!usesModePreGameFlow) {
        game.currentPlayer = types.Player.None;
        game.gameStatus = 'pair_order_reveal';
        game.preGameConfirmations = { ...(pairGame.orderRevealConfirmed ?? {}) };
        game.revealEndTime = undefined;
    }
}

const getRankedRatingForMode = (user: Pick<User, 'stats'> | null | undefined, mode: GameMode): number => {
    if (PAIR_GO_GAME_MODES.includes(mode)) {
        return readPairRankedBlock(user?.stats as Record<string, unknown>).rankingScore;
    }
    return readStrategicRankedBlock(user?.stats as Record<string, unknown>).rankingScore;
};

/** 페어 경기장 랭킹전(펫 페어·2인 페어 공용) — 항상 `stats.pair`. 선택한 바둑 종류와 무관하게 동일 점수로 매칭·표시 */
const getPairArenaRankedRating = (user: Pick<User, 'stats'> | null | undefined): number =>
    readPairRankedBlock(user?.stats as Record<string, unknown>).rankingScore;

const getEntryRatingForMode = (entry: RankedQueueEntry, mode: GameMode): number => {
    const modeRating = entry.modeRatings?.[mode];
    if (Number.isFinite(modeRating)) return Number(modeRating);
    return Number.isFinite(entry.rating) ? Number(entry.rating) : RANKED_ELO_BASE_SCORE;
};

/**
 * PVP: 끊긴 플레이어가 재접속(HTTP·WS·rejoin)했을 때 disconnectionState 해제.
 * @returns 해제 후 GAME_UPDATE를 보냈으면 true
 */
export async function clearPvpDisconnectOnPlayerReconnect(
    game: types.LiveGameSession,
    userId: string,
): Promise<boolean> {
    if (!game.disconnectionState || game.disconnectionState.disconnectedPlayerId !== userId) {
        return false;
    }
    const now = Date.now();
    const timerStartedAt = game.disconnectionState.timerStartedAt ?? now;
    if (now - timerStartedAt > PVP_DISCONNECT_REJOIN_GRACE_MS) {
        return false;
    }

    game.disconnectionState = null;
    const otherPlayerId = game.player1?.id === userId ? game.player2?.id : game.player1?.id;
    if (otherPlayerId && game.canRequestNoContest?.[otherPlayerId]) {
        delete game.canRequestNoContest[otherPlayerId];
    }
    await db.saveGame(game);
    const { broadcastToGameParticipants } = await import('../socket.js');
    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
    return true;
}

/** userStatuses의 in-game gameId로 clearPvpDisconnectOnPlayerReconnect 호출 */
export async function clearPvpDisconnectOnPlayerReconnectByStatus(
    volatileState: VolatileState,
    userId: string,
): Promise<boolean> {
    const userStatus = volatileState.userStatuses[userId];
    if (userStatus?.status !== UserStatus.InGame || !userStatus.gameId) {
        return false;
    }
    const game = await db.getLiveGame(userStatus.gameId);
    if (!game) {
        return false;
    }
    return clearPvpDisconnectOnPlayerReconnect(game, userId);
}

/**
 * PVP 인게임 유저가 로그아웃하거나 마지막 WebSocket이 끊긴 경우: 즉시 disconnectionState·GAME_UPDATE.
 * PVE(matchAxis pve)는 applyPveInGameDisconnect에서 패배 정산 후 방 삭제.
 * @returns 접속 끊김 처리에 들어갔으면 true (호출측에서 userConnections 정리 등에 사용)
 */
export async function applyPvpInGameDisconnect(volatileState: VolatileState, disconnectedUserId: string): Promise<boolean> {
    const userStatus = volatileState.userStatuses[disconnectedUserId];
    const activeGameId = userStatus?.gameId;
    if (userStatus?.status !== UserStatus.InGame || !activeGameId) return false;

    const game = await db.getLiveGame(activeGameId);
    if (!game || game.gameStatus === 'ended' || game.gameStatus === 'no_contest' || game.gameStatus === 'scoring') {
        return false;
    }

    const { isPveSessionAbandonOnLeave } = await import('../utils/pveAbandonOnDisconnect.js');
    if (isPveSessionAbandonOnLeave(game)) return false;

    if (game.disconnectionState) return false;

    if (!game.disconnectionCounts) game.disconnectionCounts = {};
    const now = Date.now();
    game.disconnectionCounts[disconnectedUserId] = (game.disconnectionCounts[disconnectedUserId] || 0) + 1;
    if (game.disconnectionCounts[disconnectedUserId] >= 3) {
        const winner = game.blackPlayerId === disconnectedUserId ? types.Player.White : types.Player.Black;
        await summaryService.endGame(game, winner, 'disconnect');
    } else {
        game.disconnectionState = { disconnectedPlayerId: disconnectedUserId, timerStartedAt: now };
        if ((game.moveHistory?.length ?? 0) < NO_CONTEST_MOVE_THRESHOLD) {
            const otherPlayerId = game.player1.id === disconnectedUserId ? game.player2.id : game.player1.id;
            if (!game.canRequestNoContest) game.canRequestNoContest = {};
            game.canRequestNoContest[otherPlayerId] = true;
        }
        await db.saveGame(game);
        const { broadcastToGameParticipants } = await import('../socket.js');
        broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
    }
    return true;
}

/**
 * 마지막 WebSocket 종료 후 유예 시간 경과 시: PVP면 접속 끊김 처리, PVE면 강제 이탈(무보상 패배).
 */
export async function applyInGameDisconnectAfterWsClose(
    volatileState: VolatileState,
    userId: string,
): Promise<boolean> {
    const pvpHandled = await applyPvpInGameDisconnect(volatileState, userId);
    if (pvpHandled) return true;
    const { applyPveInGameDisconnect } = await import('../utils/pveAbandonOnDisconnect.js');
    return applyPveInGameDisconnect(volatileState, userId, 'disconnect');
}

function abortPairRankedPetProposalsForRoom(volatileState: VolatileState, roomId: string): boolean {
    const r = volatileState.pairRooms?.[roomId];
    const pid = r?.pairRankedPetProposal?.proposalId;
    if (!pid || !volatileState.pairRankedPetProposals?.[pid]) return false;
    const prop = volatileState.pairRankedPetProposals[pid];
    delete volatileState.pairRankedPetProposals[pid];
    for (const rid of [prop.roomAId, prop.roomBId]) {
        const room = volatileState.pairRooms?.[rid];
        if (!room) continue;
        delete room.pairRankedPetProposal;
        room.phase = 'waiting';
        refreshPairRoomTeams(room);
    }
    broadcastPairRooms(volatileState);
    void tryMatchPairPetRankedRooms(volatileState);
    void tryMatchDuoPairRankedRooms(volatileState);
    return true;
}

const PAIR_RANKED_MATCH_ACCEPT_WINDOW_MS = 20_000;

function pairRankedActionPointCostForPairRoom(room: types.PairRoomState): number {
    const ch = (room as { lobbyChannel?: string }).lobbyChannel ?? 'pair';
    if (ch === 'playful') return PLAYFUL_ACTION_POINT_COST;
    if (ch === 'strategic') return STRATEGIC_ACTION_POINT_COST;
    const mode = pairModeOrDefault(room.selectedGameMode);
    if (SPECIAL_GAME_MODES.some((m) => m.mode === mode)) return STRATEGIC_ACTION_POINT_COST;
    if (PLAYFUL_GAME_MODES.some((m) => m.mode === mode)) return PLAYFUL_ACTION_POINT_COST;
    return STRATEGIC_ACTION_POINT_COST;
}

function syncPairRankedPetProposalRoomSnapshots(volatileState: VolatileState, proposalId: string): void {
    const prop = volatileState.pairRankedPetProposals?.[proposalId];
    if (!prop) return;
    const roomA = volatileState.pairRooms?.[prop.roomAId];
    const roomB = volatileState.pairRooms?.[prop.roomBId];
    if (!roomA?.pairRankedPetProposal || !roomB?.pairRankedPetProposal) return;
    if (roomA.pairRankedPetProposal.proposalId !== proposalId || roomB.pairRankedPetProposal.proposalId !== proposalId) return;
    const pa = roomA.pairRankedPetProposal;
    const pb = roomB.pairRankedPetProposal;
    const mk = prop.matchKind ?? 'pet';
    const deadline = prop.acceptDeadlineAt ?? prop.createdAt + PAIR_RANKED_MATCH_ACCEPT_WINDOW_MS;
    roomA.pairRankedPetProposal = {
        ...pa,
        myAccepted: prop.acceptOwnerA,
        peerAccepted: prop.acceptOwnerB,
        acceptDeadlineAt: deadline,
        matchKind: mk,
        myPartnerAccepted: mk === 'duo_human' ? prop.acceptPartnerA : undefined,
        peerPartnerAccepted: mk === 'duo_human' ? prop.acceptPartnerB : undefined,
    };
    roomB.pairRankedPetProposal = {
        ...pb,
        myAccepted: prop.acceptOwnerB,
        peerAccepted: prop.acceptOwnerA,
        acceptDeadlineAt: deadline,
        matchKind: mk,
        myPartnerAccepted: mk === 'duo_human' ? prop.acceptPartnerB : undefined,
        peerPartnerAccepted: mk === 'duo_human' ? prop.acceptPartnerA : undefined,
    };
}

function expireStalePairRankedPetProposals(volatileState: VolatileState, nowMs: number): void {
    const props = volatileState.pairRankedPetProposals;
    if (!props || !volatileState.pairRooms) return;
    const toAbort: string[] = [];
    for (const [, prop] of Object.entries(props)) {
        const deadline = prop.acceptDeadlineAt ?? prop.createdAt + PAIR_RANKED_MATCH_ACCEPT_WINDOW_MS;
        if (nowMs <= deadline) continue;
        const duo = prop.matchKind === 'duo_human';
        const allAccepted =
            prop.acceptOwnerA &&
            prop.acceptOwnerB &&
            (!duo || (prop.acceptPartnerA && prop.acceptPartnerB));
        if (allAccepted) continue;
        const roomA = volatileState.pairRooms[prop.roomAId];
        if (roomA) toAbort.push(roomA.id);
    }
    for (const rid of toAbort) {
        abortPairRankedPetProposalsForRoom(volatileState, rid);
    }
}

async function assertAndConsumePairLobbyMatchActionPoints(
    volatileState: VolatileState,
    participants: User[],
    pricingRoom: types.PairRoomState,
    nowMs: number,
    options?: { baseCostOverride?: number },
): Promise<{ ok: true } | { ok: false; error: string }> {
    const baseCost = options?.baseCostOverride ?? pairRankedActionPointCostForPairRoom(pricingRoom);
    for (const u of participants) {
        await applyPassiveActionPointRegenToUser(u, nowMs);
        const cost = effectivePairRankedApCostForUser(u, baseCost, pricingRoom);
        if (u.actionPoints.current < cost && !u.isAdmin) {
            return { ok: false, error: `행동력이 부족합니다. (인당 최대 ⚡${baseCost} — 대표 펫 특화로 감소 가능)` };
        }
    }
    for (const u of participants) {
        const cost = effectivePairRankedApCostForUser(u, baseCost, pricingRoom);
        if (!u.isAdmin && cost > 0) {
            recordActionPointSpend(u, cost, nowMs);
        }
        const cached = volatileState.userCache?.get(u.id);
        if (cached) cached.user = u;
        await db.updateUser(u);
        broadcastUserUpdate(u, ['actionPoints', 'lastActionPointUpdate']);
    }
    return { ok: true };
}

const assertAndConsumePairRankedMatchActionPoints = assertAndConsumePairLobbyMatchActionPoints;

async function openPairRankedPetMatchProposal(
    volatileState: VolatileState,
    bestMatch: { a: { room: types.PairRoomState; owner: User }; b: { room: types.PairRoomState; owner: User } },
    matchKind: 'pet' | 'duo_human' = 'pet',
): Promise<void> {
    const { room: roomA, owner: ownerA } = bestMatch.a;
    const { room: roomB, owner: ownerB } = bestMatch.b;
    const player1Rating = getPairArenaRankedRating(ownerA);
    const player2Rating = getPairArenaRankedRating(ownerB);
    const proposalId = randomUUID();
    const createdAt = Date.now();
    const acceptDeadlineAt = createdAt + PAIR_RANKED_MATCH_ACCEPT_WINDOW_MS;
    const partnerAId =
        matchKind === 'duo_human' && roomA.partnerId && !isPetAiId(roomA.partnerId) ? roomA.partnerId : undefined;
    const partnerBId =
        matchKind === 'duo_human' && roomB.partnerId && !isPetAiId(roomB.partnerId) ? roomB.partnerId : undefined;
    if (!volatileState.pairRankedPetProposals) volatileState.pairRankedPetProposals = {};
    volatileState.pairRankedPetProposals[proposalId] = {
        roomAId: roomA.id,
        roomBId: roomB.id,
        ownerAId: ownerA.id,
        ownerBId: ownerB.id,
        acceptOwnerA: false,
        acceptOwnerB: false,
        partnerAId,
        partnerBId,
        acceptPartnerA: false,
        acceptPartnerB: false,
        createdAt,
        acceptDeadlineAt,
        matchKind,
    };
    roomA.pairRankedPetProposal = {
        proposalId,
        opponentOwnerId: ownerB.id,
        opponentNickname: ownerB.nickname,
        myRating: player1Rating,
        opponentRating: player2Rating,
        myAccepted: false,
        peerAccepted: false,
        acceptDeadlineAt,
        matchKind,
        myPartnerAccepted: matchKind === 'duo_human' ? false : undefined,
        peerPartnerAccepted: matchKind === 'duo_human' ? false : undefined,
    };
    roomB.pairRankedPetProposal = {
        proposalId,
        opponentOwnerId: ownerA.id,
        opponentNickname: ownerA.nickname,
        myRating: player2Rating,
        opponentRating: player1Rating,
        myAccepted: false,
        peerAccepted: false,
        acceptDeadlineAt,
        matchKind,
        myPartnerAccepted: matchKind === 'duo_human' ? false : undefined,
        peerPartnerAccepted: matchKind === 'duo_human' ? false : undefined,
    };
    delete roomA.pairPetRankedQueueShell;
    delete roomB.pairPetRankedQueueShell;
    refreshPairRoomTeams(roomA);
    refreshPairRoomTeams(roomB);
    syncPairRankedPetProposalRoomSnapshots(volatileState, proposalId);
    broadcastPairRooms(volatileState);
}

async function finalizePairRankedPetRankedGame(
    volatileState: VolatileState,
    roomA: types.PairRoomState,
    roomB: types.PairRoomState,
    ownerA: User,
    ownerB: User,
    proposalId: string,
): Promise<types.LiveGameSession> {
    const selectedMode = pairModeOrDefault(roomA.selectedGameMode);
    if (volatileState.pairRankedPetProposals) delete volatileState.pairRankedPetProposals[proposalId];
    delete roomA.pairRankedPetProposal;
    delete roomB.pairRankedPetProposal;
    delete roomA.pairPetMatchingQueuedAt;
    delete roomB.pairPetMatchingQueuedAt;

    const settings = buildRankedPairPetGameSettings(roomA, ownerA, roomB, ownerB);
    const negotiation: Negotiation = {
        id: `neg-pair-ranked-${randomUUID()}`,
        challenger: ownerA,
        opponent: ownerB,
            mode: selectedMode,
        settings,
        proposerId: ownerA.id,
        status: 'pending',
        deadline: Date.now(),
        turnCount: 0,
        isRanked: true,
        pairPetStatUsers: [ownerA, ownerB],
        pairPetConfigureOwnerId: ownerA.id,
    };
    const game = await initializeGame(negotiation);
    configurePairClassicGameStart(game, ownerA, [ownerA, ownerB]);
    await db.saveGame(game);

    clearPairInvitesForRoom(volatileState, roomA.id);
    clearPairInvitesForRoom(volatileState, roomB.id);
    clearPairRoomTeamChatStore(volatileState, roomA.id);
    clearPairRoomTeamChatStore(volatileState, roomB.id);
    roomA.matchStartedAt = Date.now();
    roomB.matchStartedAt = roomA.matchStartedAt;
    refreshPairRoomTeams(roomA);
    refreshPairRoomTeams(roomB);

    setInGameUserStatusForArena(volatileState, ownerA.id, game);
    setInGameUserStatusForArena(volatileState, ownerB.id, game);

    const player1Rating = getPairArenaRankedRating(ownerA);
    const player2Rating = getPairArenaRankedRating(ownerB);
    const player1WinChange = summaryService.calculateEloChange(player1Rating, player2Rating, 'win');
    const player1LossChange = summaryService.calculateEloChange(player1Rating, player2Rating, 'loss');
    const player2WinChange = summaryService.calculateEloChange(player2Rating, player1Rating, 'win');
    const player2LossChange = summaryService.calculateEloChange(player2Rating, player1Rating, 'loss');

    const { broadcastToGameParticipants, broadcastLiveGameToList } = await import('../socket.js');
    broadcast({
        type: 'RANKED_MATCH_FOUND',
        payload: {
            gameId: game.id,
            player1: {
                id: ownerA.id,
                nickname: ownerA.nickname,
                rating: player1Rating,
                winChange: player1WinChange,
                lossChange: player1LossChange,
            },
            player2: {
                id: ownerB.id,
                nickname: ownerB.nickname,
                rating: player2Rating,
                winChange: player2WinChange,
                lossChange: player2LossChange,
            },
        },
    });
    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
    broadcastLiveGameToList(game);
    broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
    broadcastPairRooms(volatileState);
    broadcastPairPartnerInvites(volatileState);
    return game;
}

async function tryMatchPairPetRankedRooms(volatileState: VolatileState): Promise<types.LiveGameSession | null> {
    expireStalePairRankedPetProposals(volatileState, Date.now());
    if (!volatileState.pairRooms) return null;
    const candidates = Object.values(volatileState.pairRooms)
        .filter(
            (room) =>
                (room as { lobbyChannel?: string }).lobbyChannel === undefined ||
                (room as { lobbyChannel?: string }).lobbyChannel === 'pair',
        )
        .filter((room) => room.roomKind === 'ai_duel' && room.phase === 'matching' && !pairRoomShellInGame(room))
        .sort((a, b) => a.createdAt - b.createdAt);
    if (candidates.length < 2) return null;

    const loaded = await Promise.all(
        candidates.map(async (room) => ({
            room,
            owner: await db.getUser(room.ownerId),
        })),
    );
    let pruned = false;
    for (const entry of loaded) {
        if (!entry.owner) {
            clearPairInvitesForRoom(volatileState, entry.room.id);
            clearPairRoomTeamChatStore(volatileState, entry.room.id);
            delete volatileState.pairRooms[entry.room.id];
            pruned = true;
        } else if (!hasUsableEquippedPairPet(entry.owner)) {
            entry.room.phase = 'waiting';
            refreshPairRoomTeams(entry.room);
            pruned = true;
        }
    }
    const readyEntries = loaded.filter((entry): entry is { room: types.PairRoomState; owner: User } =>
        Boolean(entry.owner && hasUsableEquippedPairPet(entry.owner) && volatileState.pairRooms?.[entry.room.id]?.phase === 'matching'),
    );
    if (readyEntries.length < 2) {
        if (pruned) broadcastPairRooms(volatileState);
        return null;
    }

    let bestMatch: { a: { room: types.PairRoomState; owner: User }; b: { room: types.PairRoomState; owner: User }; diff: number; oldest: number } | null = null;
    for (let i = 0; i < readyEntries.length; i++) {
        for (let j = i + 1; j < readyEntries.length; j++) {
            const a = readyEntries[i];
            const b = readyEntries[j];
            if (a.owner.id === b.owner.id) continue;
            const modeA = pairModeOrDefault(a.room.selectedGameMode);
            const modeB = pairModeOrDefault(b.room.selectedGameMode);
            if (modeA !== modeB) continue;
            const diff = Math.abs(getPairArenaRankedRating(a.owner) - getPairArenaRankedRating(b.owner));
            if (diff > RANKED_MATCH_MAX_RATING_DIFF) continue;
            const oldest = Math.min(a.room.createdAt, b.room.createdAt);
            if (!bestMatch || diff < bestMatch.diff || (diff === bestMatch.diff && oldest < bestMatch.oldest)) {
                bestMatch = { a, b, diff, oldest };
            }
        }
    }
    if (!bestMatch) {
        if (pruned) broadcastPairRooms(volatileState);
        return null;
    }

    await openPairRankedPetMatchProposal(volatileState, bestMatch, 'pet');
    return null;
}

async function finalizePairRankedDuoHumanGame(
    volatileState: VolatileState,
    roomA: types.PairRoomState,
    roomB: types.PairRoomState,
    ownerA: User,
    partnerA: User,
    ownerB: User,
    partnerB: User,
    proposalId: string,
): Promise<types.LiveGameSession> {
    const selectedMode = pairModeOrDefault(roomA.selectedGameMode);
    if (volatileState.pairRankedPetProposals) delete volatileState.pairRankedPetProposals[proposalId];
    delete roomA.pairRankedPetProposal;
    delete roomB.pairRankedPetProposal;
    delete roomA.pairPetMatchingQueuedAt;
    delete roomB.pairPetMatchingQueuedAt;

    const settings = buildRankedHumanDuoVsDuoGameSettings(roomA, ownerA, partnerA, roomB, ownerB, partnerB);
    const negotiation: Negotiation = {
        id: `neg-pair-duo-ranked-${randomUUID()}`,
        challenger: ownerA,
        opponent: ownerB,
        mode: selectedMode,
        settings,
        proposerId: ownerA.id,
        status: 'pending',
        deadline: Date.now(),
        turnCount: 0,
        isRanked: true,
        pairPetStatUsers: [ownerA, partnerA, ownerB, partnerB],
        pairPetConfigureOwnerId: ownerA.id,
    };
    const game = await initializeGame(negotiation);
    configurePairClassicGameStart(game, ownerA, [ownerA, partnerA, ownerB, partnerB]);
    await db.saveGame(game);

    clearPairInvitesForRoom(volatileState, roomA.id);
    clearPairInvitesForRoom(volatileState, roomB.id);
    clearPairRoomTeamChatStore(volatileState, roomA.id);
    clearPairRoomTeamChatStore(volatileState, roomB.id);
    roomA.matchStartedAt = Date.now();
    roomB.matchStartedAt = roomA.matchStartedAt;
    refreshPairRoomTeams(roomA);
    refreshPairRoomTeams(roomB);

    for (const uid of [ownerA.id, partnerA.id, ownerB.id, partnerB.id]) {
        setInGameUserStatusForArena(volatileState, uid, game);
    }

    const player1Rating = getPairArenaRankedRating(ownerA);
    const player2Rating = getPairArenaRankedRating(ownerB);
    const player1WinChange = summaryService.calculateEloChange(player1Rating, player2Rating, 'win');
    const player1LossChange = summaryService.calculateEloChange(player1Rating, player2Rating, 'loss');
    const player2WinChange = summaryService.calculateEloChange(player2Rating, player1Rating, 'win');
    const player2LossChange = summaryService.calculateEloChange(player2Rating, player1Rating, 'loss');

    const { broadcastToGameParticipants, broadcastLiveGameToList } = await import('../socket.js');
    broadcast({
        type: 'RANKED_MATCH_FOUND',
        payload: {
            gameId: game.id,
            player1: {
                id: ownerA.id,
                nickname: ownerA.nickname,
                rating: player1Rating,
                winChange: player1WinChange,
                lossChange: player1LossChange,
            },
            player2: {
                id: ownerB.id,
                nickname: ownerB.nickname,
                rating: player2Rating,
                winChange: player2WinChange,
                lossChange: player2LossChange,
            },
        },
    });
    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
    broadcastLiveGameToList(game);
    broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
    broadcastPairRooms(volatileState);
    broadcastPairPartnerInvites(volatileState);
    return game;
}

async function tryMatchDuoPairRankedRooms(volatileState: VolatileState): Promise<types.LiveGameSession | null> {
    expireStalePairRankedPetProposals(volatileState, Date.now());
    if (!volatileState.pairRooms) return null;
    const candidates = Object.values(volatileState.pairRooms)
        .filter((room) => {
            const ch = (room as { lobbyChannel?: string }).lobbyChannel ?? 'pair';
            return ch === 'strategic' || ch === 'playful';
        })
        .filter(
            (room) =>
                room.roomKind === 'duo_match' &&
                room.phase === 'matching' &&
                !pairRoomShellInGame(room) &&
                !room.pairRankedPetProposal &&
                !room.pairDuoRankedLobbyProposal,
        )
        .sort((a, b) => a.createdAt - b.createdAt);
    if (candidates.length < 2) return null;

    const loaded = await Promise.all(
        candidates.map(async (room) => {
            const owner = await db.getUser(room.ownerId);
            const pid = room.partnerId && !isPetAiId(room.partnerId) ? room.partnerId : null;
            const partner = pid ? await db.getUser(pid) : null;
            return { room, owner, partner };
        }),
    );
    let pruned = false;
    for (const entry of loaded) {
        const live = volatileState.pairRooms?.[entry.room.id];
        if (!live || live.phase !== 'matching') continue;
        if (!entry.owner || !entry.partner) {
            live.phase = 'waiting';
            delete live.pairPetMatchingQueuedAt;
            refreshPairRoomTeams(live);
            pruned = true;
        }
    }
    type DuoEntry = { room: types.PairRoomState; owner: User; partner: User };
    const readyEntries: DuoEntry[] = loaded.filter((entry): entry is DuoEntry => {
        const live = volatileState.pairRooms?.[entry.room.id];
        return Boolean(
            entry.owner &&
                entry.partner &&
                live &&
                live.phase === 'matching' &&
                !live.pairRankedPetProposal &&
                !live.pairDuoRankedLobbyProposal,
        );
    });
    if (readyEntries.length < 2) {
        if (pruned) broadcastPairRooms(volatileState);
        return null;
    }

    let bestMatch: { a: DuoEntry; b: DuoEntry; diff: number; oldest: number } | null = null;
    for (let i = 0; i < readyEntries.length; i++) {
        for (let j = i + 1; j < readyEntries.length; j++) {
            const a = readyEntries[i]!;
            const b = readyEntries[j]!;
            if (a.owner.id === b.owner.id) continue;
            const modeA = pairModeOrDefault(a.room.selectedGameMode);
            const modeB = pairModeOrDefault(b.room.selectedGameMode);
            if (modeA !== modeB) continue;
            const chA = (a.room as { lobbyChannel?: string }).lobbyChannel ?? 'pair';
            const chB = (b.room as { lobbyChannel?: string }).lobbyChannel ?? 'pair';
            if (chA !== chB) continue;
            const diff = Math.abs(getPairArenaRankedRating(a.owner) - getPairArenaRankedRating(b.owner));
            if (diff > RANKED_MATCH_MAX_RATING_DIFF) continue;
            const oldest = Math.min(a.room.createdAt, b.room.createdAt);
            if (!bestMatch || diff < bestMatch.diff || (diff === bestMatch.diff && oldest < bestMatch.oldest)) {
                bestMatch = { a, b, diff, oldest };
            }
        }
    }
    if (!bestMatch) {
        if (pruned) broadcastPairRooms(volatileState);
        return null;
    }

    await openPairRankedPetMatchProposal(
        volatileState,
        {
            a: { room: bestMatch.a.room, owner: bestMatch.a.owner },
            b: { room: bestMatch.b.room, owner: bestMatch.b.owner },
        },
        'duo_human',
    );
    return null;
}

/** `game-…` 채널(인게임 대국실 유저 채팅)은 해당 경기 참가자·관전자에게만 전달. 그 외 채널은 전체 브로드캐스트 */
async function broadcastWaitingRoomChatChannel(volatileState: VolatileState, channel: string): Promise<void> {
    const slice = volatileState.waitingRoomChats[channel];
    if (!Array.isArray(slice)) return;
    const envelope = {
        type: 'WAITING_ROOM_CHAT_UPDATE' as const,
        payload: { [channel]: slice } as Record<string, ChatMessage[]>,
    };
    if (typeof channel === 'string' && channel.startsWith('game-')) {
        const { getCachedGame } = await import('../gameCache.js');
        const { broadcastToGameParticipants } = await import('../socket.js');
        let game = await getCachedGame(channel);
        if (!game) game = await db.getLiveGame(channel);
        if (game) {
            broadcastToGameParticipants(channel, envelope, game);
            return;
        }
    }
    broadcast(envelope);
}

export const handleSocialAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type } = action;
    const payload = (action as { payload?: unknown }).payload as any;
    const now = Date.now();
    expireStalePairRankedPetProposals(volatileState, now);

    switch (type) {
        case 'LOGOUT': {
            const activeTournament = volatileState.activeTournaments?.[user.id];
            if (activeTournament) {
                console.log(`[Logout] User ${user.nickname} has an active tournament. Forfeiting.`);
                tournamentService.forfeitTournament(activeTournament, user.id);
                
                let stateKey: keyof User;
                switch (activeTournament.type) {
                    case 'neighborhood': stateKey = 'lastNeighborhoodTournament'; break;
                    case 'national': stateKey = 'lastNationalTournament'; break;
                    case 'world': stateKey = 'lastWorldTournament'; break;
                    default:
                        console.error(`[Logout] Unknown tournament type found in active tournament: ${activeTournament.type}`);
                        // Don't save if type is unknown to prevent corruption
                        if (volatileState.activeTournaments) {
                            delete volatileState.activeTournaments[user.id];
                        }
                        releaseIpBindingForUser(volatileState, user.id);
                        delete volatileState.userConnections[user.id];
                        delete volatileState.userStatuses[user.id];
                        return { error: 'Unknown tournament type.' };
                }
                (user as any)[stateKey] = activeTournament;
                
                // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
                db.updateUser(user).catch(err => {
                    console.error(`[LEAVE_TOURNAMENT_VIEW] Failed to save user ${user.id}:`, err);
                });

                if (volatileState.activeTournaments) {
                    delete volatileState.activeTournaments[user.id];
                }
            }
            
            const userStatus = volatileState.userStatuses[user.id];
            const activeGameId = userStatus?.gameId;
            if (userStatus?.status === 'in-game' && activeGameId) {
                const game = await db.getLiveGame(activeGameId);
                // scoring 상태의 게임은 연결 끊김으로 처리하지 않음 (자동계가 진행 중)
                if (game && game.gameStatus !== 'ended' && game.gameStatus !== 'no_contest' && game.gameStatus !== 'scoring') {
                    const { applyPveAbandonOnPlayerLeave, isPveSessionAbandonOnLeave } = await import(
                        '../utils/pveAbandonOnDisconnect.js',
                    );
                    if (isPveSessionAbandonOnLeave(game)) {
                        await applyPveAbandonOnPlayerLeave(volatileState, user.id, game, 'logout');
                    } else if (!game.disconnectionState) {
                        await applyPvpInGameDisconnect(volatileState, user.id);
                    }
                } else if (game && game.gameStatus === 'scoring') {
                    // scoring 상태의 게임은 연결 끊김으로 처리하지 않고 조용히 무시
                    console.log(`[SocialAction] Ignoring disconnect for scoring game: ${activeGameId}`);
                }
            }
            
            leavePairWaitingRoomIfPresent(volatileState, user.id);
            releaseIpBindingForUser(volatileState, user.id);
            delete volatileState.userConnections[user.id];
            delete volatileState.userStatuses[user.id];
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            return {};
        }
        case 'SEND_CHAT_MESSAGE': {
            if (user.chatBanUntil && user.chatBanUntil > now) {
                const timeLeft = Math.ceil((user.chatBanUntil - now) / 1000 / 60);
                return { error: `채팅이 금지되었습니다. (${timeLeft}분 남음)` };
            }
            const lastMessageTime = volatileState.userLastChatMessage[user.id] || 0;
            if (now - lastMessageTime < 5000 && !user.isAdmin) { // Admin can bypass spam check
                return { error: '메시지를 너무 자주 보낼 수 없습니다.' };
            }
        
            const { channel: rawChannel, text, emoji, location } = payload;
            if (!rawChannel || (!text && !emoji)) return { error: 'Invalid chat message.' };
            const channel = resolvePublicWaitingRoomChatStoreChannel(String(rawChannel));

            if (text && containsProfanity(text)) {
                return { error: '메시지에 부적절한 단어가 포함되어 있습니다.' };
            }

            const messageContent = text || emoji || '';
            if (messageContent) {
                if (!volatileState.userConsecutiveChatMessages) volatileState.userConsecutiveChatMessages = {};
                const consecutive = volatileState.userConsecutiveChatMessages[user.id];
                if (consecutive && consecutive.content === messageContent) {
                    consecutive.count++;
                } else {
                    volatileState.userConsecutiveChatMessages[user.id] = { content: messageContent, count: 1 };
                }

                if (volatileState.userConsecutiveChatMessages[user.id].count >= 3 && !user.isAdmin) {
                    const banDurationMinutes = 3;
                    user.chatBanUntil = now + banDurationMinutes * 60 * 1000;
                    
                    // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
                    db.updateUser(user).catch(err => {
                        console.error(`[SEND_CHAT_MESSAGE] Failed to save user ${user.id}:`, err);
                    });
                    
                    delete volatileState.userConsecutiveChatMessages[user.id];

                    const banMessage: ChatMessage = {
                        id: `msg-${randomUUID()}`,
                        user: { id: 'ai-security-guard', nickname: 'AI 보안관봇' },
                        text: `${user.nickname}님, 동일한 메시지를 반복적으로 전송하여 ${banDurationMinutes}분간 채팅이 금지되었습니다.`,
                        system: true,
                        timestamp: now,
                    };
                    if (!volatileState.waitingRoomChats[channel]) volatileState.waitingRoomChats[channel] = [];
                    volatileState.waitingRoomChats[channel].push(banMessage);
                    
                    await broadcastWaitingRoomChatChannel(volatileState, channel);
                    
                    return { error: `동일한 메시지를 반복하여 ${banDurationMinutes}분간 채팅이 금지되었습니다.` };
                }
            }
        
            const message: ChatMessage = {
                id: `msg-${randomUUID()}`,
                user: { id: user.id, nickname: user.nickname },
                text, emoji, system: false, timestamp: now,
                location
            };
            
            if (!volatileState.waitingRoomChats[channel]) volatileState.waitingRoomChats[channel] = [];
            volatileState.waitingRoomChats[channel].push(message);
            if (volatileState.waitingRoomChats[channel].length > 100) {
                volatileState.waitingRoomChats[channel].shift();
            }
            volatileState.userLastChatMessage[user.id] = now;

            if (text && GREETINGS.some(g => text.toLowerCase().includes(g))) {
                updateQuestProgress(user, 'chat_greeting');
                
                // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
                db.updateUser(user).catch(err => {
                    console.error(`[SEND_CHAT_MESSAGE] Failed to save user ${user.id}:`, err);
                });

                // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['quests']);
            }

            await broadcastWaitingRoomChatChannel(volatileState, channel);

            return {};
        }
        case 'SET_USER_STATUS': {
            const { status } = payload as { status: UserStatus | string };
            const statusKey = String(status);
            if (statusKey !== 'waiting' && statusKey !== 'resting') {
                return { error: 'Invalid status for waiting room.' };
            }
            const nextStatus: UserStatus = statusKey === 'resting' ? UserStatus.Resting : UserStatus.Waiting;
            const inPairRoom = Object.values(volatileState.pairRooms || {}).some((r) => userInActivePairLobbyRoom(r, user.id));
            if (inPairRoom) {
                return { error: '페어 방에 있을 때는 상태를 변경할 수 없습니다.' };
            }
            const currentUserStatus = volatileState.userStatuses[user.id];
            if (
                currentUserStatus &&
                (currentUserStatus.status === UserStatus.Waiting || currentUserStatus.status === UserStatus.Resting)
            ) {
                currentUserStatus.status = nextStatus;
                if (nextStatus === UserStatus.Resting && volatileState.pairPartnerInvites) {
                    let invitesChanged = false;
                    for (const id of Object.keys(volatileState.pairPartnerInvites)) {
                        const inv = volatileState.pairPartnerInvites[id];
                        if (inv && (inv.inviteeId === user.id || inv.inviterId === user.id)) {
                            delete volatileState.pairPartnerInvites[id];
                            invitesChanged = true;
                        }
                    }
                    if (invitesChanged) broadcastPairPartnerInvites(volatileState);
                }
                broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            } else {
                return { error: 'Cannot change status while in-game or negotiating.' };
            }
            return {};
        }
        case 'ENTER_WAITING_ROOM': {
            const { mode, lobbyIntent: payloadIntent } = payload as {
                mode: GameMode | 'strategic' | 'playful';
                lobbyIntent?: 'pvp' | 'ai';
            };
            const lobbyIntent: 'pvp' | 'ai' = payloadIntent === 'ai' ? 'ai' : 'pvp';
            if (mode === 'strategic') {
                const gate = await requireArenaEntranceOpen(user.isAdmin, 'strategicLobby', user);
                if (!gate.ok) return { error: gate.error };
            } else if (mode === 'playful') {
                const gate = await requireArenaEntranceOpen(user.isAdmin, 'playfulLobby', user);
                if (!gate.ok) return { error: gate.error };
            }
            const currentStatus = volatileState.userStatuses[user.id];
            
            // 이미 같은 상태로 대기실에 있으면 중복 요청 무시
            if (currentStatus && 
                (currentStatus.status === UserStatus.Waiting || currentStatus.status === UserStatus.Resting)) {
                if (mode === 'strategic' || mode === 'playful') {
                    if (currentStatus.waitingLobby === mode && currentStatus.lobbyIntent === lobbyIntent) {
                        return {};
                    }
                } else if (currentStatus.mode === mode) {
                    return {}; // 이미 같은 모드 대기실에 있음
                }
            }
            
            // strategic/playful: GameMode 대신 waitingLobby로 로비 구분 (클라이언트 목록 분리)
            if (mode === 'strategic' || mode === 'playful') {
                const prev = volatileState.userStatuses[user.id];
                const next: UserStatusInfo = {
                    status: UserStatus.Waiting,
                    waitingLobby: mode,
                    arenaChannel: mode,
                    lobbyIntent,
                };
                if (prev?.gameId && prev.waitingLobby === mode) {
                    const g = await db.getLiveGame(prev.gameId);
                    if (g && isLingerEndedPvpRoomCandidate(g)) {
                        next.gameId = prev.gameId;
                        next.mode = g.mode;
                    }
                }
                volatileState.userStatuses[user.id] = next;
            } else {
                const arenaChannel = arenaChannelForGameMode(mode as GameMode) ?? undefined;
                volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, mode: mode as GameMode, arenaChannel };
            }
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            return {};
        }
        case 'LEAVE_WAITING_ROOM': {
            const userStatus = volatileState.userStatuses[user.id];
            const detachedEndedGameId = userStatus?.gameId;
            if (userStatus && (userStatus.status === UserStatus.Waiting || userStatus.status === UserStatus.Resting)) {
                userStatus.status = UserStatus.Online;
                delete userStatus.mode; // 대기실 모드 정보 제거
                delete userStatus.waitingLobby;
                delete userStatus.arenaChannel;
                delete userStatus.lobbyIntent;
                delete userStatus.gameId;
            }

            if (detachedEndedGameId) {
                await maybeDeleteDetachedEndedPvpGame(volatileState, detachedEndedGameId);
            }
            
            // 사용자가 보낸 negotiation 정리
            const userNegotiations = Object.keys(volatileState.negotiations).filter(negId => {
                const neg = volatileState.negotiations[negId];
                return neg.challenger.id === user.id && neg.status === 'pending';
            });
            
            for (const negId of userNegotiations) {
                const neg = volatileState.negotiations[negId];
                // opponent 상태 복구
                if (volatileState.userStatuses[neg.opponent.id]?.status === UserStatus.Negotiating) {
                    volatileState.userStatuses[neg.opponent.id].status = UserStatus.Waiting;
                }
                delete volatileState.negotiations[negId];
            }
            
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            if (userNegotiations.length > 0) {
                broadcast({ type: 'NEGOTIATION_UPDATE', payload: { negotiations: volatileState.negotiations, userStatuses: volatileState.userStatuses } });
            }
            return {};
        }
        case 'ENTER_TOURNAMENT_VIEW': {
            if (!volatileState.activeTournamentViewers) {
                volatileState.activeTournamentViewers = new Set();
            }
            volatileState.activeTournamentViewers.add(user.id);
            return {};
        }
        case 'LEAVE_TOURNAMENT_VIEW': {
            if (volatileState.activeTournamentViewers) {
                volatileState.activeTournamentViewers.delete(user.id);
            }
            return {};
        }
        case 'LEAVE_GAME_ROOM': {
            const gameId = typeof payload?.gameId === 'string' ? payload.gameId : '';
            if (!gameId) {
                return applyLeaveWhenGameSessionMissing(volatileState, user.id, '');
            }

            try {
                const game = await resolveGameSessionForLeave(volatileState, gameId);
                if (!game) {
                    return applyLeaveWhenGameSessionMissing(volatileState, user.id, gameId);
                }

            if (volatileState.userStatuses[user.id]) {
                const restoredPairRoom = restoreEndedPairRoomShellsIfNeeded(volatileState, game);
                if (restoredPairRoom) {
                    broadcastPairRooms(volatileState);
                }
                const leaveArenaChannel = arenaChannelForGameSession(game);
                const isPairGameLeave = leaveArenaChannel === 'pair';
                // 싱글플레이 게임이 아닌 경우, 게임 모드를 strategic/playful로 변환 (페어 국은 전략 대기실이 아닌 페어 경기장으로 복귀)
                let lobbyMode: GameMode | 'strategic' | 'playful' | undefined = undefined;
                if (!game.isSinglePlayer && !isPairGameLeave) {
                    if (SPECIAL_GAME_MODES.some(m => m.mode === game.mode)) {
                        lobbyMode = 'strategic';
                    } else if (PLAYFUL_GAME_MODES.some(m => m.mode === game.mode)) {
                        lobbyMode = 'playful';
                    }
                }
                // 싱글플레이 게임이거나 모드를 찾을 수 없는 경우 Online 상태로 변경 (게임 모드 없음)
                if (game.isSinglePlayer || !lobbyMode || isPairGameLeave) {
                    volatileState.userStatuses[user.id] = { status: UserStatus.Online };
                    delete volatileState.userStatuses[user.id].mode;
                    delete volatileState.userStatuses[user.id].gameId;
                    delete volatileState.userStatuses[user.id].waitingLobby;
                } else {
                    if (lobbyMode === 'strategic' || lobbyMode === 'playful') {
                        const linger = isLingerEndedPvpRoomCandidate(game);
                        const prev = volatileState.userStatuses[user.id];
                        const secondDetachFromEndedRoom =
                            linger && prev?.status === UserStatus.Waiting && prev.gameId === gameId;
                        if (secondDetachFromEndedRoom) {
                            const wl: 'strategic' | 'playful' =
                                prev.waitingLobby === 'strategic' || prev.waitingLobby === 'playful'
                                    ? prev.waitingLobby
                                    : lobbyMode;
                            volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, waitingLobby: wl, arenaChannel: wl };
                            await maybeDeleteDetachedEndedPvpGame(volatileState, gameId);
                        } else if (linger) {
                            volatileState.userStatuses[user.id] = {
                                status: UserStatus.Waiting,
                                waitingLobby: lobbyMode,
                                arenaChannel: lobbyMode,
                                gameId: game.id,
                                mode: game.mode,
                            };
                        } else {
                            volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, waitingLobby: lobbyMode, arenaChannel: lobbyMode };
                        }
                    } else {
                        const arenaChannel = arenaChannelForGameMode(lobbyMode as GameMode) ?? undefined;
                        volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, mode: lobbyMode as GameMode, arenaChannel };
                    }
                }
            }
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });

            const ongoingRematchNegotiation = Object.values(volatileState.negotiations).find(
                neg => neg.rematchOfGameId === gameId
            );

            if (ongoingRematchNegotiation) {
                const otherPlayerId = ongoingRematchNegotiation.challenger.id === user.id
                    ? ongoingRematchNegotiation.opponent.id
                    : ongoingRematchNegotiation.challenger.id;
                
                const otherPlayerStatus = volatileState.userStatuses[otherPlayerId];
                if (otherPlayerStatus?.status === 'negotiating') {
                    otherPlayerStatus.status = UserStatus.InGame;
                    otherPlayerStatus.gameId = gameId;
                }

                delete volatileState.negotiations[ongoingRematchNegotiation.id];

                if (game.gameStatus === 'rematch_pending') {
                    game.gameStatus = 'ended';
                    await db.saveGame(game);
                }
            }
            
            // 두 플레이어가 모두 나갔는지 확인
            const p1Status = volatileState.userStatuses[game.player1.id];
            const p2Status = volatileState.userStatuses[game.player2.id];
            const p1Left = !p1Status || p1Status.gameId !== gameId;
            const p2Left = !p2Status || p2Status.gameId !== gameId;
            const bothPlayersLeft = p1Left && p2Left;
            
            // 관전자가 있는지 확인
            const hasSpectators = Object.values(volatileState.userStatuses).some(
                status => status.spectatingGameId === gameId
            );
            
            // 두 플레이어가 모두 나갔고 관전자도 없으면 게임 삭제 (종료 PVP 방은 대국실에서 명시적으로 떠날 때까지 유지)
            if (bothPlayersLeft && !hasSpectators) {
                const isRematchBeingNegotiated = Object.values(volatileState.negotiations).some(
                    neg => neg.rematchOfGameId === gameId
                );
                if (!isRematchBeingNegotiated) {
                    if (isLingerEndedPvpRoomCandidate(game)) {
                        await maybeDeleteDetachedEndedPvpGame(volatileState, gameId);
                    } else {
                        console.log(`[GC] Deleting game ${gameId} - both players left and no spectators`);
                        const { stashEndedPvpGameRecordSnapshot } = await import('../gameRecordSnapshot.js');
                        stashEndedPvpGameRecordSnapshot(volatileState, game);
                        clearAiSession(gameId);
                        await db.deleteGame(gameId);
                        if (volatileState.gameChats) delete volatileState.gameChats[gameId];
                        broadcast({ type: 'GAME_DELETED', payload: { gameId } });
                    }
                }
            }
            
            return {};
            } catch (leaveErr: unknown) {
                console.error('[LEAVE_GAME_ROOM] failed, applying graceful leave:', gameId, leaveErr);
                return applyLeaveWhenGameSessionMissing(volatileState, user.id, gameId);
            }
        }
        case 'LEAVE_AI_GAME': {
            const { gameId } = payload;
            const game = await db.getLiveGame(gameId);
            if (!game) {
                // 게임이 없어도 사용자 상태는 업데이트 (이미 종료된 게임일 수 있음)
                const userStatus = volatileState.userStatuses[user.id];
                if (userStatus) {
                    userStatus.status = UserStatus.Online;
                    delete userStatus.mode;
                    delete userStatus.gameId;
                    delete userStatus.spectatingGameId;
                } else {
                    volatileState.userStatuses[user.id] = { status: UserStatus.Online };
                }
                broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
                
                // 싱글플레이 게임인 경우 사용자 데이터를 다시 가져와서 브로드캐스트 (클리어 상태 반영)
                if (gameId?.startsWith('sp-game-')) {
                    const freshUser = await db.getUser(user.id);
                    if (freshUser) {
                        broadcast({ type: 'USER_UPDATE', payload: { [user.id]: freshUser } });
                    }
                }
                
                return {}; // 에러를 반환하지 않고 성공 처리
            }

            if (volatileState.userStatuses[user.id]) {
                const isTower = game.gameCategory === 'tower';
                // 싱글플레이 게임이나 도전의 탑이 아닌 경우, 게임 모드를 strategic/playful로 변환
                let lobbyMode: GameMode | 'strategic' | 'playful' | undefined = undefined;
                if (!game.isSinglePlayer && !isTower) {
                    if (SPECIAL_GAME_MODES.some(m => m.mode === game.mode)) {
                        lobbyMode = 'strategic';
                    } else if (PLAYFUL_GAME_MODES.some(m => m.mode === game.mode)) {
                        lobbyMode = 'playful';
                    }
                }
                // 싱글플레이 게임이나 도전의 탑이거나 모드를 찾을 수 없는 경우 Online 상태로 변경 (게임 모드 없음)
                if (game.isSinglePlayer || isTower || !lobbyMode) {
                    volatileState.userStatuses[user.id] = { status: UserStatus.Online };
                    delete volatileState.userStatuses[user.id].mode;
                    delete volatileState.userStatuses[user.id].gameId;
                    delete volatileState.userStatuses[user.id].arenaChannel;
                } else {
                    if (lobbyMode === 'strategic' || lobbyMode === 'playful') {
                        volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, waitingLobby: lobbyMode, arenaChannel: lobbyMode };
                    } else {
                        const arenaChannel = arenaChannelForGameMode(lobbyMode as GameMode) ?? undefined;
                        volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, mode: lobbyMode as GameMode, arenaChannel };
                    }
                }
            }
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            
            // If the user leaves before the game is officially over (e.g. resigns), end the game.
            if (!['ended', 'no_contest'].includes(game.gameStatus)) {
                const aiWinsEnum =
                    game.blackPlayerId === aiUserId ? types.Player.Black : types.Player.White;
                await summaryService.endGame(game, aiWinsEnum, 'disconnect');
            } else {
                // 게임이 이미 종료된 경우, 싱글플레이·도전의 탑이면 사용자 데이터를 다시 가져와서 브로드캐스트 (클리어 상태·towerFloor 반영)
                if (game.isSinglePlayer || game.gameCategory === 'tower') {
                    const freshUser = await db.getUser(user.id);
                    if (freshUser) {
                        console.log(`[LEAVE_AI_GAME] Broadcasting updated user data for ${game.gameCategory === 'tower' ? 'tower' : 'single player'} game ${gameId}`);
                        broadcast({ type: 'USER_UPDATE', payload: { [user.id]: freshUser } });
                    }
                }
            }
            
            return {};
        }
        case 'SPECTATE_GAME': {
            const { gameId } = payload;
            const game = await db.getLiveGame(gameId);
            if (!game) return { error: 'Game not found.' };
            volatileState.userStatuses[user.id] = {
                status: UserStatus.Spectating,
                spectatingGameId: gameId,
                mode: game.mode,
                arenaChannel: arenaChannelForGameSession(game) ?? undefined,
            };
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            // 관전자가 게임 화면을 바로 볼 수 있도록 전체 게임 데이터 반환 (중립 관전)
            return { clientResponse: { game } };
        }
        case 'LEAVE_SPECTATING': {
            const userStatus = volatileState.userStatuses[user.id];
            const leftGameId = userStatus?.spectatingGameId;
            if (userStatus && userStatus.status === UserStatus.Spectating) {
                userStatus.status = UserStatus.Online;
                delete userStatus.spectatingGameId;
                delete userStatus.gameId;
            }
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });

            if (leftGameId) {
                const game = await db.getLiveGame(leftGameId);
                if (game) {
                    const p1Status = volatileState.userStatuses[game.player1.id];
                    const p2Status = volatileState.userStatuses[game.player2.id];
                    const p1Left = !p1Status || p1Status.gameId !== leftGameId;
                    const p2Left = !p2Status || p2Status.gameId !== leftGameId;
                    const hasSpectators = Object.values(volatileState.userStatuses).some(s => s.spectatingGameId === leftGameId);
                    if (p1Left && p2Left && !hasSpectators) {
                        clearAiSession(leftGameId);
                        await db.deleteGame(leftGameId);
                        if (volatileState.gameChats) delete volatileState.gameChats[leftGameId];
                        broadcast({ type: 'GAME_DELETED', payload: { gameId: leftGameId } });
                    }
                }
            }
            return {};
        }
        case 'EMERGENCY_EXIT': {
            // 비상탈출: 모든 플레이 중인 게임을 강제 종료
            const userStatus = volatileState.userStatuses[user.id];
            const activeGameIds: string[] = [];
            
            // userStatuses에서 게임 ID 수집
            if (userStatus?.gameId) {
                activeGameIds.push(userStatus.gameId);
            }
            if (userStatus?.spectatingGameId && !activeGameIds.includes(userStatus.spectatingGameId)) {
                activeGameIds.push(userStatus.spectatingGameId);
            }
            
            // 모든 활성 게임을 확인하여 사용자가 참여 중인 게임 찾기
            const allActiveGames = await db.getAllActiveGames();
            for (const game of allActiveGames) {
                if (game.gameStatus === 'ended' || game.gameStatus === 'no_contest') continue;
                
                const isPlayer = game.player1.id === user.id || game.player2.id === user.id;
                const isSpectator = userStatus?.status === types.UserStatus.Spectating && userStatus.spectatingGameId === game.id;
                
                if (isPlayer || isSpectator) {
                    if (!activeGameIds.includes(game.id)) {
                        activeGameIds.push(game.id);
                    }
                }
            }
            
            // 각 게임을 종료 처리
            for (const gameId of activeGameIds) {
                const game = await db.getLiveGame(gameId);
                if (!game || game.gameStatus === 'ended' || game.gameStatus === 'no_contest') continue;
                
                const isPlayer = game.player1.id === user.id || game.player2.id === user.id;
                const isSpectator = userStatus?.status === types.UserStatus.Spectating && userStatus.spectatingGameId === game.id;
                
                if (isPlayer) {
                    // PVP 경기장에서는 기권패 처리
                    if (!game.isSinglePlayer && !game.isAiGame) {
                        const myPlayerEnum = game.player1.id === user.id ? types.Player.Black : types.Player.White;
                        const winner = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
                        await summaryService.endGame(game, winner, 'resign');
                    } else {
                        // 싱글플레이 또는 AI 게임은 그냥 종료
                        if (game.isSinglePlayer) {
                            // 싱글플레이 게임은 패배 처리
                            await summaryService.endGame(game, types.Player.White, 'disconnect');
                        } else if (game.isAiGame) {
                            // AI 게임은 AI 승리 처리
                            const aiPlayerEnum = game.player1.id === user.id ? types.Player.White : types.Player.Black;
                            await summaryService.endGame(game, aiPlayerEnum, 'disconnect');
                        }
                    }
                } else if (isSpectator) {
                    // 관전 중이면 그냥 상태만 변경
                    // (게임 종료는 필요 없음)
                }
            }
            
            // 사용자 상태를 대기 상태로 변경
            if (volatileState.userStatuses[user.id]) {
                volatileState.userStatuses[user.id] = { status: types.UserStatus.Waiting };
            }
            
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            
            return { clientResponse: { redirectTo: '#/' } };
        }

        case 'START_RANKED_MATCHING': {
            const { lobbyType, selectedModes } = payload as {
                lobbyType: 'strategic' | 'playful';
                selectedModes: GameMode[];
            };
            if (lobbyType !== 'strategic') {
                return { error: '놀이바둑 랭킹전은 더 이상 지원되지 않습니다.' };
            }
            const gateKey = 'strategicLobby';
            const rankedGate = await requireArenaEntranceOpen(user.isAdmin, gateKey, user);
            if (!rankedGate.ok) return { error: rankedGate.error };
            
            // 이미 매칭 중이면 에러
            if (volatileState.rankedMatchingQueue?.strategic?.[user.id]) {
                return { error: '이미 매칭 중입니다.' };
            }
            if (findRankedMatchProposalForUser(volatileState, user.id)) {
                return { error: '매칭 수락 대기 중입니다.' };
            }
            
            // 선택된 모드가 없으면 에러
            if (!selectedModes || selectedModes.length === 0) {
                return { error: '최소 1개 이상의 게임 모드를 선택해주세요.' };
            }
            
            // 믹스룰 제외 확인
            if (selectedModes.includes(GameMode.Mix)) {
                return { error: '믹스룰은 랭킹전에서 사용할 수 없습니다.' };
            }

            const { RANKED_STRATEGIC_MODES } = await import('../../constants/rankedGameSettings.js');
            const strategicRankedSet = new Set(RANKED_STRATEGIC_MODES);
            if (selectedModes.some((m) => !strategicRankedSet.has(m))) {
                return { error: '전략바둑 랭킹전 모드만 선택할 수 있습니다.' };
            }
            
            // 사용자 랭킹 점수 계산: 큐에는 전체 선택 모드별 점수를 함께 저장
            const firstMode = selectedModes[0];
            const userRating = getRankedRatingForMode(user, firstMode);
            const modeRatings = selectedModes.reduce<Partial<Record<GameMode, number>>>((acc, mode) => {
                acc[mode] = getRankedRatingForMode(user, mode);
                return acc;
            }, {});
            
            // 매칭 큐 초기화
            if (!volatileState.rankedMatchingQueue) {
                volatileState.rankedMatchingQueue = { strategic: {} };
            }
            if (!volatileState.rankedMatchingQueue.strategic) {
                volatileState.rankedMatchingQueue.strategic = {};
            }
            
            // 매칭 큐에 추가
            volatileState.rankedMatchingQueue.strategic[user.id] = {
                userId: user.id,
                lobbyType: 'strategic',
                selectedModes,
                startTime: now,
                rating: userRating,
                modeRatings,
            };
            
            // 사용자 상태를 매칭 중으로 변경
            volatileState.userStatuses[user.id] = { 
                ...volatileState.userStatuses[user.id],
                status: UserStatus.Waiting, // 대기 상태 유지 (매칭 중 표시는 클라이언트에서)
            };
            
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            broadcast({ type: 'RANKED_MATCHING_UPDATE', payload: { queue: volatileState.rankedMatchingQueue } });
            
            // 즉시 매칭 시도
            await tryMatchPlayers(volatileState, 'strategic');
            
            // HTTP 응답에 매칭 정보 포함 (즉시 상태 업데이트를 위해)
            return { 
                clientResponse: { 
                    success: true,
                    matchingInfo: {
                        startTime: now,
                        lobbyType: 'strategic' as const,
                        selectedModes
                    }
                } 
            };
        }
        
        case 'CANCEL_RANKED_MATCHING': {
            // 매칭 큐에서 제거
            if (volatileState.rankedMatchingQueue?.strategic?.[user.id]) {
                delete volatileState.rankedMatchingQueue.strategic[user.id];
            }
            
            broadcast({ type: 'RANKED_MATCHING_UPDATE', payload: { queue: volatileState.rankedMatchingQueue } });
            
            return { clientResponse: { success: true } };
        }
        case 'RESPOND_RANKED_MATCH': {
            const { proposalId, accept } = payload as { proposalId?: string; accept?: boolean };
            if (!proposalId || typeof accept !== 'boolean') return { error: '요청이 올바르지 않습니다.' };
            const prop = volatileState.rankedMatchProposals?.[proposalId];
            if (!prop) return { error: '이미 처리되었거나 만료된 매칭입니다.' };
            if (user.id !== prop.user1Id && user.id !== prop.user2Id) {
                return { error: '이 매칭에 참가할 수 없습니다.' };
            }
            const deadline = prop.acceptDeadlineAt ?? prop.createdAt + RANKED_MATCH_ACCEPT_WINDOW_MS;
            if (now > deadline) {
                abortRankedMatchProposal(volatileState, proposalId);
                return { error: '매칭 수락 시간이 지났습니다.' };
            }
            if (!accept) {
                abortRankedMatchProposal(volatileState, proposalId);
                return { clientResponse: { success: true } };
            }
            if (user.id === prop.user1Id) prop.acceptUser1 = true;
            else prop.acceptUser2 = true;
            broadcastRankedMatchProposal(volatileState, proposalId);
            if (!prop.acceptUser1 || !prop.acceptUser2) {
                return { clientResponse: { success: true } };
            }
            const player1 = await db.getUser(prop.user1Id);
            const player2 = await db.getUser(prop.user2Id);
            if (!player1 || !player2) {
                abortRankedMatchProposal(volatileState, proposalId);
                return { error: '유저 정보를 찾지 못해 매칭이 취소되었습니다.' };
            }
            const finalizeResult = await finalizeRankedStrategicMatchGame(
                volatileState,
                prop,
                proposalId,
                player1,
                player2,
            );
            if (!finalizeResult.ok) {
                abortRankedMatchProposal(volatileState, proposalId);
                return { error: finalizeResult.error };
            }
            return { clientResponse: { success: true, gameId: finalizeResult.gameId } };
        }
        case 'PAIR_SYNC': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            if (!volatileState.pairPartnerInvites) volatileState.pairPartnerInvites = {};
            expireStalePairRankedPetProposals(volatileState, now);
            tickPairPartnerInviteExpiry(volatileState);
            tickPairOwnerStartDeadlines(volatileState, now);
            if (prunePairLobbyScreenClients(volatileState)) {
                broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            }
            broadcastPairRooms(volatileState);
            const myRoomSync = Object.values(volatileState.pairRooms).find((r) => userInActivePairLobbyRoom(r, user.id));
            const pairRoomChatHistory = myRoomSync
                ? { [myRoomSync.id]: mergePairChatHistoriesForViewer(myRoomSync, volatileState, user.id) }
                : undefined;
            return {
                clientResponse: {
                    pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
                    pairPartnerInvites: volatileState.pairPartnerInvites,
                    friendState: getFriendSnapshot(user),
                    ...(pairRoomChatHistory ? { pairRoomChatHistory } : {}),
                },
            };
        }
        case 'PAIR_LOBBY_ROOM_GRID_SLICE': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const raw = payload as { lobbyChannel?: unknown; lobbyIntent?: unknown; fromSlot?: unknown; toSlot?: unknown };
            const chRaw = raw.lobbyChannel;
            const normalizedChannel =
                chRaw === 'strategic' || chRaw === 'playful' || chRaw === 'pair' ? chRaw : 'pair';
            const sliceIntent: 'pvp' | 'ai' = raw.lobbyIntent === 'ai' ? 'ai' : 'pvp';
            const fromSlot = Math.max(1, Math.min(PAIR_LOBBY_GRID_SLOT_COUNT, Math.floor(Number(raw.fromSlot)) || 1));
            const toSlot = Math.max(fromSlot, Math.min(PAIR_LOBBY_GRID_SLOT_COUNT, Math.floor(Number(raw.toSlot)) || 100));
            const out: Record<string, types.PairRoomState> = {};
            for (const room of Object.values(volatileState.pairRooms)) {
                const lk = (room as { lobbyChannel?: string }).lobbyChannel ?? 'pair';
                if (lk !== normalizedChannel) continue;
                if (!isPairRoomVisibleInLobbyIntent(room, { intent: sliceIntent, channel: normalizedChannel }, user.id)) {
                    continue;
                }
                const sn = pairLobbyGridSlotFromRoomCode(room.code);
                if (sn == null || sn < fromSlot || sn > toSlot) continue;
                out[room.id] = room;
            }
            return {
                clientResponse: {
                    pairRooms: enrichPairRoomsForClientPayload(out),
                },
            };
        }
        case 'PAIR_SET_LOBBY_SCREEN': {
            const { active, clientId, lobbyChannel, lobbyIntent: payloadIntent } = payload as {
                active?: unknown;
                clientId?: unknown;
                lobbyChannel?: unknown;
                lobbyIntent?: unknown;
            };
            const on = active === true;
            const screenChannel = arenaChannelFromPairLobbyChannel(lobbyChannel);
            const lobbyIntent: 'pvp' | 'ai' = payloadIntent === 'ai' ? 'ai' : 'pvp';
            if (!volatileState.userStatuses[user.id]) {
                volatileState.userStatuses[user.id] = { status: UserStatus.Online };
            }
            if (!volatileState.pairLobbyScreenClients) volatileState.pairLobbyScreenClients = {};
            const normalizedClientId = normalizePairLobbyScreenClientId(clientId, user.id);
            const base = volatileState.userStatuses[user.id];
            if (on) {
                volatileState.pairLobbyScreenClients[user.id] = {
                    ...(volatileState.pairLobbyScreenClients[user.id] || {}),
                    [normalizedClientId]: Date.now(),
                };
                volatileState.userStatuses[user.id] = {
                    ...base,
                    inPairLobby: screenChannel === 'pair',
                    arenaChannel: screenChannel,
                    lobbyIntent,
                    ...(screenChannel === 'strategic' || screenChannel === 'playful'
                        ? { waitingLobby: screenChannel }
                        : {}),
                };
            } else {
                delete volatileState.pairLobbyScreenClients[user.id]?.[normalizedClientId];
                prunePairLobbyScreenClients(volatileState, user.id);
            }
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            return {};
        }
        case 'PAIR_INVITE_PARTNER': {
            const { targetUserId, targetTeam, targetIndex } = payload as {
                targetUserId?: string;
                targetTeam?: 'teamA' | 'teamB';
                targetIndex?: 0 | 1;
            };
            if (!targetUserId || targetUserId === user.id) return { error: '초대할 수 없습니다.' };
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            if (!volatileState.pairPartnerInvites) volatileState.pairPartnerInvites = {};
            if (!volatileState.pairPartnerInviteCooldowns) volatileState.pairPartnerInviteCooldowns = {};
            tickPairPartnerInviteExpiry(volatileState);

            const room = Object.values(volatileState.pairRooms).find((r) => r.ownerId === user.id && !pairRoomShellInGame(r));
            if (!room) return { error: '페어 방장만 초대할 수 있습니다.' };
            if (room.roomKind === 'arena_ai') return { error: 'AI와 대결 방에서는 초대할 수 없습니다.' };
            if (room.roomKind !== 'duo_match' && room.roomKind !== 'friendly_4p' && room.roomKind !== 'friendly_2p') {
                return { error: '이 방 형태에서는 초대할 수 없습니다.' };
            }
            const hasRealPartner = room.partnerId && !String(room.partnerId).startsWith('pet-ai-');
            const humanCount = countPairRoomHumanUsers(room);
            if (room.roomKind === 'duo_match' && hasRealPartner && humanCount >= 2) {
                return { error: '이미 파트너가 있는 방입니다.' };
            }
            if (room.roomKind === 'friendly_2p') {
                if (humanCount >= 2) {
                    return { error: '이미 상대가 있는 2인 친선 방입니다.' };
                }
            }
            if (room.roomKind === 'friendly_4p' && humanCount >= 4) {
                return { error: '방이 가득 찼습니다.' };
            }

            const inviterSt = volatileState.userStatuses[user.id]?.status;
            if (inviterSt === UserStatus.Resting) return { error: '휴식 중에는 파트너를 초대할 수 없습니다.' };
            const inviteeSt = volatileState.userStatuses[targetUserId]?.status;
            if (inviteeSt === UserStatus.Resting) return { error: '상대가 휴식 중이라 초대할 수 없습니다.' };

            const cooldownKey = `${user.id}:${targetUserId}`;
            if ((volatileState.pairPartnerInviteCooldowns[cooldownKey] ?? 0) > Date.now()) {
                return { error: '잠시 후 다시 초대할 수 있습니다.' };
            }

            if (!volatileState.userConnections[targetUserId]) {
                return { error: '상대가 접속 중이 아닙니다.' };
            }

            const inOtherRoom = Object.values(volatileState.pairRooms).some(
                (r) =>
                    (r.ownerId === targetUserId ||
                        r.partnerId === targetUserId ||
                        (r.extraPairMembers ?? []).some((m) => m.id === targetUserId)) &&
                    !pairRoomShellInGame(r),
            );
            if (inOtherRoom) return { error: '상대가 이미 다른 페어 방에 있습니다.' };

            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상을 찾을 수 없습니다.' };
            if (targetUser.blockArenaPartnerInvites === true) {
                return { error: '상대가 초대를 받지 않도록 설정했습니다.' };
            }
            if (room.roomKind === 'friendly_2p' && !hasUsableEquippedPairPet(targetUser)) {
                return { error: '상대가 대표 펫을 장착해야 2인 친선에 초대할 수 있습니다.' };
            }

            const friendIds = toFriendArray(user.friendIds);
            const isFriend = friendIds.includes(targetUserId);
            const isGuild = Boolean(user.guildId && user.guildId === targetUser.guildId);
            prunePairLobbyScreenClients(volatileState, targetUserId);
            const targetSt = volatileState.userStatuses[targetUserId];
            const inLinkedArena = Boolean(targetSt && userInUnifiedArenaLobbyUserList(targetSt));
            if (!isFriend && !isGuild && !inLinkedArena) {
                return {
                    error: '전체 목록에서는 전략·놀이·페어 대국실에 있는 유저만 초대할 수 있습니다. 친구·길드원은 다른 화면에서도 초대할 수 있습니다.',
                };
            }

            for (const id of Object.keys(volatileState.pairPartnerInvites)) {
                const inv = volatileState.pairPartnerInvites[id];
                if (inv.inviterId === user.id && inv.inviteeId === targetUserId && inv.roomId === room.id) {
                    delete volatileState.pairPartnerInvites[id];
                }
            }

            const inviteId = `pair-inv-${randomUUID()}`;
            volatileState.pairPartnerInvites[inviteId] = {
                id: inviteId,
                roomId: room.id,
                roomCode: room.code,
                roomTitle: room.title,
                inviterId: user.id,
                inviterName: user.nickname,
                inviteeId: targetUserId,
                targetTeam,
                targetIndex,
                createdAt: Date.now(),
            };
            broadcastPairPartnerInvites(volatileState);
            return { clientResponse: { pairPartnerInvites: volatileState.pairPartnerInvites } };
        }
        case 'PAIR_RESPOND_PARTNER_INVITE': {
            const { inviteId, accept } = payload as { inviteId?: string; accept?: unknown };
            if (!inviteId) return { error: '유효하지 않은 초대입니다.' };
            if (!volatileState.pairPartnerInvites) volatileState.pairPartnerInvites = {};
            if (!volatileState.pairPartnerInviteCooldowns) volatileState.pairPartnerInviteCooldowns = {};
            tickPairPartnerInviteExpiry(volatileState);
            const inv = volatileState.pairPartnerInvites[inviteId];
            if (!inv) return { error: '초대를 찾을 수 없습니다.' };
            if (inv.inviteeId !== user.id) return { error: '이 초대에 응답할 수 없습니다.' };
            const acceptJoin = accept === true;
            const inviterId = inv.inviterId;
            const inviteeId = inv.inviteeId;
            delete volatileState.pairPartnerInvites[inviteId];

            if (!acceptJoin) {
                volatileState.pairPartnerInviteCooldowns[`${inviterId}:${inviteeId}`] = Date.now() + 10000;
                broadcastPairPartnerInvites(volatileState);
                broadcast({
                    type: 'PAIR_PARTNER_INVITE_DECLINED',
                    payload: { inviterId, inviteeId },
                });
                return {};
            }

            if (Date.now() - inv.createdAt > PAIR_PARTNER_INVITE_TTL_MS) {
                broadcastPairPartnerInvites(volatileState);
                return { error: '만료된 초대입니다.' };
            }

            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const already = Object.values(volatileState.pairRooms).find((r) => userInActivePairLobbyRoom(r, user.id));
            if (already) {
                broadcastPairPartnerInvites(volatileState);
                return { error: '이미 참여 중인 페어 방이 있습니다.' };
            }
            const target = volatileState.pairRooms[inv.roomId];
            if (!target) {
                broadcastPairPartnerInvites(volatileState);
                return { error: '방이 사라졌습니다.' };
            }
            if (pairRoomShellInGame(target)) {
                broadcastPairPartnerInvites(volatileState);
                return { error: '이미 대국이 시작된 방입니다.' };
            }
            const hasRealPartner = target.partnerId && !String(target.partnerId).startsWith('pet-ai-');
            if (target.roomKind === 'duo_match' && hasRealPartner) {
                broadcastPairPartnerInvites(volatileState);
                return { error: '이미 파트너가 있는 방입니다.' };
            }
            if (target.roomKind === 'friendly_2p') {
                if (!hasUsableEquippedPairPet(user)) {
                    broadcastPairPartnerInvites(volatileState);
                    return { error: '대표 펫을 장착해야 2인 친선 방에 입장할 수 있습니다.' };
                }
                if (countPairRoomHumanUsers(target) >= 2) {
                    broadcastPairPartnerInvites(volatileState);
                    return { error: '이미 상대가 있는 2인 친선 방입니다.' };
                }
            }
            if (target.roomKind === 'friendly_4p' && countPairRoomHumanUsers(target) >= 4) {
                broadcastPairPartnerInvites(volatileState);
                return { error: '방이 가득 찼습니다.' };
            }

            clearPairRoomKickEntry(target, user.id);

            if (target.roomKind === 'friendly_2p') {
                target.extraPairMembers = [{ id: user.id, name: user.nickname, ready: false }];
                const ownerFresh = await db.getUser(target.ownerId);
                if (ownerFresh) {
                    const os = pairLobbyPetSnapshotFromUser(ownerFresh);
                    if (os) target.ownerLobbyPet = os;
                }
                const guestSnap = pairLobbyPetSnapshotFromUser(user);
                if (guestSnap) target.opponentLobbyPet = guestSnap;
            } else if (!hasRealPartner) {
                target.partnerId = user.id;
                target.partnerName = user.nickname;
                target.partnerReady = false;
            } else {
                target.extraPairMembers = [
                    ...(target.extraPairMembers ?? []).filter((m) => m.id !== user.id),
                    { id: user.id, name: user.nickname, ready: false },
                ];
            }
            recordPairGuestJoinOrder(target, user.id);
            if (target.roomKind === 'duo_match') {
                syncDuoMatchPairSeatAssignments(target);
            } else {
                const teamA = [...(target.pairSeatAssignments?.teamA ?? [target.ownerId])].filter((id) => id !== user.id);
                const teamB = [...(target.pairSeatAssignments?.teamB ?? [])].filter((id) => id !== user.id);
                const destTeam = inv.targetTeam === 'teamB' ? 'teamB' : 'teamA';
                const dest = destTeam === 'teamB' ? teamB : teamA;
                const index = inv.targetIndex === 0 || inv.targetIndex === 1 ? inv.targetIndex : 1;
                dest.splice(Math.min(index, dest.length), 0, user.id);
                target.pairSeatAssignments = { teamA: teamA.slice(0, 2), teamB: teamB.slice(0, 2) };
            }
            refreshPairRoomTeams(target);
            syncPairOwnerStartDeadline(target, now);
            clearPairInvitesForRoom(volatileState, target.id);
            broadcastPairRooms(volatileState);
            broadcastPairPartnerInvites(volatileState);
            return {
                clientResponse: {
                    pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
                    pairRoomChatHistory: { [target.id]: mergePairChatHistoriesForViewer(target, volatileState, user.id) },
                },
            };
        }
        case 'PAIR_CREATE_ROOM': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const rawCreate = payload as Record<string, unknown>;
            const { mode: payloadMode, title, roomKind, visibility, password } = payload as {
                mode?: 'pvp' | 'ai';
                title?: string;
                roomKind?: 'ai_duel' | 'duo_match' | 'friendly_4p' | 'friendly_2p' | 'arena_ai';
                visibility?: 'public' | 'private';
                password?: string;
            };
            const payloadLobbyRaw = rawCreate.lobbyChannel ?? rawCreate.lobby_channel;
            const payloadLobbyNorm =
                typeof payloadLobbyRaw === 'string' ? payloadLobbyRaw.trim().toLowerCase() : '';
            const existing = Object.values(volatileState.pairRooms).find((room) => userInActivePairLobbyRoom(room, user.id));
            if (existing) return { error: '이미 참여 중인 페어 방이 있습니다.' };
            const normalizedChannel: 'pair' | 'strategic' | 'playful' =
                payloadLobbyNorm === 'strategic' || payloadLobbyNorm === 'playful' ? payloadLobbyNorm : 'pair';
            const payloadIntentRaw = rawCreate.lobbyIntent ?? rawCreate.lobby_intent;
            const lobbyIntent: 'pvp' | 'ai' = payloadIntentRaw === 'ai' ? 'ai' : 'pvp';
            const normalizedVisibility = visibility === 'private' ? 'private' : 'public';
            const normalizedKind =
                roomKind ??
                (payloadMode === 'ai' ? 'ai_duel' : normalizedChannel === 'pair' ? 'friendly_4p' : 'duo_match');
            if (!isRoomKindAllowedForLobby(normalizedKind, { intent: lobbyIntent, channel: normalizedChannel })) {
                return { error: '현재 경기장에서는 이 방 종류를 만들 수 없습니다.' };
            }
            const pairPetRankedQueueShell =
                rawCreate.pairPetRankedQueueShell === true || rawCreate.pairPetRankedQueueShell === 'true';
            const pairAiDuoInviteShell =
                lobbyIntent === 'ai' && normalizedKind === 'duo_match' && normalizedChannel === 'pair';
            if (pairPetRankedQueueShell && (normalizedKind !== 'ai_duel' || normalizedChannel !== 'pair')) {
                return { error: '페어 경기장 펫 랭킹전 대기 방만 이 방식으로 만들 수 있습니다.' };
            }
            if (normalizedKind === 'arena_ai' && normalizedChannel !== 'strategic' && normalizedChannel !== 'playful') {
                return { error: 'AI와 대결 방은 전략·놀이 경기장에서만 만들 수 있습니다.' };
            }
            if (normalizedKind === 'duo_match' && normalizedChannel === 'playful') {
                // 놀이 경기장은 친선 듀오만 허용한다. 랭킹 제안은 별도 액션에서 차단한다.
            }
            if (normalizedKind === 'ai_duel' && normalizedChannel !== 'pair') {
                return { error: '펫 랭킹 방은 페어 경기장에서만 만들 수 있습니다.' };
            }
            if (normalizedKind === 'friendly_2p' && normalizedChannel !== 'pair') {
                return { error: '2인 친선 방은 페어 경기장에서만 만들 수 있습니다.' };
            }
            const effectiveMode: 'pvp' | 'ai' =
                normalizedKind === 'ai_duel' || normalizedKind === 'arena_ai'
                    ? 'ai'
                    : lobbyIntent === 'ai' && normalizedKind === 'duo_match'
                      ? 'ai'
                      : 'pvp';
            const normalizedPassword = typeof password === 'string' ? password.trim() : '';
            if (normalizedVisibility === 'private' && normalizedPassword.length !== 4) {
                return { error: '비공개방 비밀번호는 4자로 입력해 주세요.' };
            }
            if (normalizedKind === 'ai_duel' && !hasUsableEquippedPairPet(user)) {
                return { error: '펫 페어 방을 만들려면 페어 펫을 장착해야 합니다.' };
            }
            if (normalizedKind === 'friendly_2p' && !hasUsableEquippedPairPet(user)) {
                return { error: '2인 친선 방을 만들려면 페어 펫을 장착해야 합니다.' };
            }
            const ownerPairPetName =
                normalizedKind === 'ai_duel' ? equippedPairPetDisplayNameForUser(user) : normalizedKind === 'arena_ai' ? 'AI' : undefined;

            const roomId = `pair-room-${randomUUID()}`;
            const code = pairPetRankedQueueShell
                ? `rq-${randomUUID().replace(/-/g, '').slice(0, 20)}`
                : pairAiDuoInviteShell
                  ? `aid-${randomUUID().replace(/-/g, '').slice(0, 20)}`
                  : allocPairRoomCode(volatileState.pairRooms, normalizedChannel);
            const defaultTitleSuffix =
                normalizedKind === 'friendly_4p'
                    ? '4인 친선'
                    : normalizedKind === 'friendly_2p'
                      ? '2인 친선'
                      : normalizedKind === 'ai_duel'
                        ? '펫'
                        : normalizedKind === 'arena_ai'
                          ? 'AI'
                          : '2인';
            const defaultTitleArenaWord =
                normalizedChannel === 'strategic' ? '전략방' : normalizedChannel === 'playful' ? '놀이방' : '페어방';
            /** 전략·놀이 친선(duo_match): 제목은 닉네임+로비명만 — 방 종류는 클라이언트에서 「친선전」배지로만 표시 */
            const defaultTitleDuoStrategicPlayful =
                normalizedKind === 'duo_match' &&
                (normalizedChannel === 'strategic' || normalizedChannel === 'playful');
            const room: types.PairRoomState = {
                id: roomId,
                code,
                mode: effectiveMode,
                pairMode: effectiveMode,
                roomKind: normalizedKind,
                visibility: normalizedVisibility,
                passwordProtected: normalizedVisibility === 'private',
                phase: 'waiting',
                lobbyChannel: normalizedChannel,
                ...(pairPetRankedQueueShell ? { pairPetRankedQueueShell: true as const } : {}),
                ...(pairAiDuoInviteShell ? { pairAiDuoInviteShell: true as const } : {}),
                title:
                    (pairPetRankedQueueShell ? clampPairRoomTitle('랭킹전 대기') : undefined) ||
                    (pairAiDuoInviteShell ? clampPairRoomTitle('2인 AI') : undefined) ||
                    clampPairRoomTitle(title) ||
                    (defaultTitleDuoStrategicPlayful
                        ? clampPairRoomTitle(`${user.nickname}님의 ${defaultTitleArenaWord}`)
                        : clampPairRoomTitle(`${user.nickname}님의 ${defaultTitleSuffix} ${defaultTitleArenaWord}`)),
                ownerId: user.id,
                ownerName: user.nickname,
                partnerId:
                    pairAiDuoInviteShell ? undefined : effectiveMode === 'ai' ? `pet-ai-${user.id}` : undefined,
                partnerName:
                    pairAiDuoInviteShell ? undefined : effectiveMode === 'ai' ? ownerPairPetName : undefined,
                selectedGameMode: PAIR_MODE_DEFAULT_GAME_MODE,
                settings: { ...DEFAULT_GAME_SETTINGS },
                teamA: { id: 'teamA', name: '우리 팀', members: [] },
                teamB: { id: 'teamB', name: '상대 팀', members: [] },
                futurePetAi:
                    effectiveMode === 'ai' && normalizedKind !== 'arena_ai' && !pairAiDuoInviteShell
                        ? pairPetAiPlaceholder()
                        : undefined,
                ownerReady: false,
                partnerReady: pairAiDuoInviteShell ? false : effectiveMode === 'ai' || normalizedKind === 'friendly_4p',
                createdAt: Date.now(),
                pairChatMessages: [],
                ...(effectiveMode === 'pvp' ? { pairSeatAssignments: { teamA: [user.id], teamB: [] as string[] } } : {}),
            };
            if (normalizedKind === 'ai_duel' || normalizedKind === 'friendly_2p') {
                const snap = pairLobbyPetSnapshotFromUser(user);
                if (snap) room.ownerLobbyPet = snap;
            }
            (room as any).roomPassword = normalizedVisibility === 'private' ? normalizedPassword : undefined;
            const createGamePayload = payload as {
                selectedGameMode?: GameMode;
                settings?: types.GameSettings;
            };
            if (createGamePayload.selectedGameMode !== undefined || createGamePayload.settings !== undefined) {
                mergePairRoomLobbyGameSettings(room, {
                    selectedGameMode: createGamePayload.selectedGameMode,
                    settings: createGamePayload.settings,
                });
            } else {
                mergePairRoomLobbyGameSettings(room, {});
            }
            volatileState.pairRooms[roomId] = refreshPairRoomTeams(room);
            broadcastPairRooms(volatileState);
            return {
                clientResponse: {
                    pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
                    pairRoomChatHistory: { [roomId]: mergePairChatHistoriesForViewer(volatileState.pairRooms[roomId]!, volatileState, user.id) },
                },
            };
        }
        case 'PAIR_UPDATE_ROOM_LOBBY': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const p = payload as PairLobbyOwnerPatchPayload;
            const target = Object.values(volatileState.pairRooms).find((room) => room.ownerId === user.id && !pairRoomShellInGame(room));
            if (!target) return { error: '방장만 방 설정을 변경할 수 있습니다.' };
            const err = applyPairRoomLobbyOwnerPayloadToRoom(target, user, p);
            if (err) return { error: err };
            delete target.pairLobbySettingChangeProposal;
            broadcastPairRooms(volatileState);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_PROPOSE_STRATEGIC_LOBBY_SETTING_CHANGE': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const raw = payload as { roomId?: string } & PairLobbyOwnerPatchPayload;
            const roomId = typeof raw.roomId === 'string' ? raw.roomId.trim() : '';
            if (!roomId) return { error: '방 정보가 올바르지 않습니다.' };
            const room = volatileState.pairRooms[roomId];
            if (!room) return { error: '해당 페어 방을 찾지 못했습니다.' };
            const lobbyCh = room.lobbyChannel ?? 'pair';
            if (lobbyCh !== 'strategic' && lobbyCh !== 'playful' && lobbyCh !== 'pair') {
                return { error: '전략·놀이·페어 경기장 방에서만 변경을 제안할 수 있습니다.' };
            }
            if (room.ownerId === user.id) return { error: '방장은 이 방식으로 설정을 바꿀 수 없습니다.' };
            if (!userInActivePairLobbyRoom(room, user.id)) return { error: '이 방에 참여 중일 때만 제안할 수 있습니다.' };
            if (pairRoomShellInGame(room)) return { error: '경기 진행 중인 방에서는 제안할 수 없습니다.' };
            if (room.phase === 'matching' || room.phase === 'match_pending' || room.pairRankedPetProposal) {
                return { error: '매칭 중에는 변경을 제안할 수 없습니다.' };
            }
            const until = room.pairLobbySettingChangeCooldownUntil?.[user.id];
            if (typeof until === 'number' && until > now) {
                const sec = Math.ceil((until - now) / 1000);
                return { error: `거절 후 ${sec}초 뒤에 다시 제안할 수 있습니다.` };
            }
            if (room.pairLobbySettingChangeProposal) {
                return { error: '처리 중인 변경 제안이 있습니다.' };
            }
            /** 손님 제안: 게임 모드·방 종류·방 이름·공개 여부는 방장 설정 고정 — 세부 대국 설정(`settings`)만 제안 */
            const p: PairLobbyOwnerPatchPayload = {
                roomKind: room.roomKind,
                selectedGameMode: room.selectedGameMode,
                settings: stripPairLobbyGuestForbiddenSettingsPatch(raw.settings),
            };
            const dryRoom = structuredClone(room) as types.PairRoomState;
            const dryErr = applyPairRoomLobbyOwnerPayloadToRoom(dryRoom, user, p);
            if (dryErr) return { error: dryErr };

            const proposalPayload: types.PairLobbySettingChangeProposalPayload = {
                roomKind: room.roomKind,
                selectedGameMode: room.selectedGameMode,
                settings: p.settings,
            };
            room.pairLobbySettingChangeProposal = {
                proposalId: randomUUID(),
                fromUserId: user.id,
                fromUserName: user.nickname,
                createdAt: now,
                payload: proposalPayload,
            };
            broadcastPairRooms(volatileState);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_RESPOND_STRATEGIC_LOBBY_SETTING_CHANGE': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const { roomId, accept } = payload as { roomId?: string; accept?: boolean };
            const rid = typeof roomId === 'string' ? roomId.trim() : '';
            if (!rid) return { error: '방 정보가 올바르지 않습니다.' };
            const room = volatileState.pairRooms[rid];
            if (!room || room.ownerId !== user.id) return { error: '방장만 응답할 수 있습니다.' };
            const respondLobbyCh = room.lobbyChannel ?? 'pair';
            if (respondLobbyCh !== 'strategic' && respondLobbyCh !== 'playful' && respondLobbyCh !== 'pair') {
                return { error: '전략·놀이·페어 경기장 방에서만 이 응답을 처리할 수 있습니다.' };
            }
            const proposal = room.pairLobbySettingChangeProposal;
            if (!proposal) return { error: '대기 중인 변경 제안이 없습니다.' };
            if (accept === true) {
                const err = applyPairRoomLobbyOwnerPayloadToRoom(room, user, proposal.payload);
                if (err) return { error: err };
            } else {
                if (!room.pairLobbySettingChangeCooldownUntil) room.pairLobbySettingChangeCooldownUntil = {};
                room.pairLobbySettingChangeCooldownUntil[proposal.fromUserId] = now + PAIR_STRATEGIC_LOBBY_CHANGE_REJECT_COOLDOWN_MS;
            }
            delete room.pairLobbySettingChangeProposal;
            broadcastPairRooms(volatileState);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_JOIN_ROOM': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const { roomId, code, password } = payload as { roomId?: string; code?: string; password?: string };
            const already = Object.values(volatileState.pairRooms).find((room) => userInActivePairLobbyRoom(room, user.id));
            if (already) return { error: '이미 참여 중인 페어 방이 있습니다.' };
            const target = Object.values(volatileState.pairRooms).find(
                (room) => room.id === roomId || (code && room.code === String(code).toUpperCase())
            );
            if (!target) return { error: '해당 페어 방을 찾지 못했습니다.' };
            if (isPairAiDuoInviteOnlyRoom(target)) {
                return { error: '초대를 통해서만 입장할 수 있는 방입니다.' };
            }
            if (target.pairRoomKickedUserIds?.includes(user.id)) {
                return { error: '강퇴된 방에는 방장이 다시 초대할 때까지 입장할 수 없습니다.' };
            }
            if (pairRoomShellInGame(target)) return { error: '경기 진행 중인 방에는 입장할 수 없습니다.' };
            if (target.phase === 'matching' || target.phase === 'match_pending') {
                return { error: '매칭 중인 방에는 입장할 수 없습니다.' };
            }
            if (target.visibility === 'private') {
                const roomPassword = String((target as any).roomPassword || '');
                if (!roomPassword || roomPassword !== String(password || '').trim()) {
                    return { error: '비밀번호가 일치하지 않습니다.' };
                }
            }
            if (target.roomKind === 'arena_ai') {
                return { error: 'AI와 대결 방에는 다른 유저가 입장할 수 없습니다.' };
            }
            if (target.roomKind === 'friendly_2p') {
                if (!hasUsableEquippedPairPet(user)) return { error: '대표 펫을 장착해야 2인 친선 방에 입장할 수 있습니다.' };
                if (countPairRoomHumanUsers(target) >= 2) return { error: '이미 상대가 있는 2인 친선 방입니다.' };
                target.extraPairMembers = [{ id: user.id, name: user.nickname, ready: false }];
                target.pairSeatAssignments = { teamA: [target.ownerId], teamB: [user.id] };
                const ownerFresh = await db.getUser(target.ownerId);
                if (ownerFresh) {
                    const os = pairLobbyPetSnapshotFromUser(ownerFresh);
                    if (os) target.ownerLobbyPet = os;
                }
                const guestSnap = pairLobbyPetSnapshotFromUser(user);
                if (guestSnap) target.opponentLobbyPet = guestSnap;
                recordPairGuestJoinOrder(target, user.id);
                refreshPairRoomTeams(target);
                syncPairOwnerStartDeadline(target, now);
                clearPairInvitesForRoom(volatileState, target.id);
                broadcastPairRooms(volatileState);
                broadcastPairPartnerInvites(volatileState);
                return {
                    clientResponse: {
                        pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
                        pairRoomChatHistory: { [target.id]: mergePairChatHistoriesForViewer(target, volatileState, user.id) },
                    },
                };
            }
            if (target.roomKind === 'friendly_4p' && countPairRoomHumanUsers(target) >= 4) {
                return { error: '방이 가득 찼습니다.' };
            }
            if (target.roomKind === 'duo_match' && countPairRoomHumanUsers(target) >= ((target.lobbyChannel ?? 'pair') === 'pair' ? 2 : 4)) {
                return { error: '방이 가득 찼습니다.' };
            }
            if (target.partnerId) return { error: '이미 파트너가 입장한 방입니다.' };
            target.partnerId = user.id;
            target.partnerName = user.nickname;
            target.partnerReady = false;
            recordPairGuestJoinOrder(target, user.id);
            if (target.roomKind === 'duo_match') {
                syncDuoMatchPairSeatAssignments(target);
            } else {
                target.pairSeatAssignments = { teamA: [target.ownerId, user.id], teamB: [] };
            }
            refreshPairRoomTeams(target);
            syncPairOwnerStartDeadline(target, now);
            clearPairInvitesForRoom(volatileState, target.id);
            broadcastPairRooms(volatileState);
            broadcastPairPartnerInvites(volatileState);
            return {
                clientResponse: {
                    pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
                    pairRoomChatHistory: { [target.id]: mergePairChatHistoriesForViewer(target, volatileState, user.id) },
                },
            };
        }
        case 'PAIR_LEAVE_ROOM': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            leavePairWaitingRoomIfPresent(volatileState, user.id);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_KICK_ROOM_MEMBER': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const { roomId, targetUserId } = payload as { roomId?: string; targetUserId?: string };
            if (!roomId || !targetUserId) return { error: '유효하지 않은 요청입니다.' };
            const room = volatileState.pairRooms[roomId];
            if (!room) return { error: '방을 찾을 수 없습니다.' };
            if (room.ownerId !== user.id) return { error: '방장만 강퇴할 수 있습니다.' };
            if (targetUserId === user.id) return { error: '본인은 강퇴할 수 없습니다.' };
            if (isPetAiId(targetUserId)) return { error: '펫 슬롯은 강퇴할 수 없습니다.' };
            if (!userInPairRoomMembership(room, targetUserId)) return { error: '해당 유저가 이 방에 없습니다.' };
            if (
                pairRoomShellInGame(room) ||
                room.phase === 'matching' ||
                room.phase === 'match_pending' ||
                room.pairRankedPetProposal ||
                room.pairDuoRankedLobbyProposal
            ) {
                return { error: '매칭·대국 중에는 강퇴할 수 없습니다.' };
            }
            if (!room.pairRoomKickedUserIds) room.pairRoomKickedUserIds = [];
            if (!room.pairRoomKickedUserIds.includes(targetUserId)) room.pairRoomKickedUserIds.push(targetUserId);
            abortPairRankedPetProposalsForRoom(volatileState, room.id);
            removeNonOwnerPairRoomMember(volatileState, room, targetUserId);
            broadcastPairRooms(volatileState);
            broadcastPairPartnerInvites(volatileState);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_DELEGATE_ROOM_OWNERSHIP': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const { roomId, targetUserId } = payload as { roomId?: string; targetUserId?: string };
            if (!roomId || !targetUserId) return { error: '유효하지 않은 요청입니다.' };
            const room = volatileState.pairRooms[roomId];
            if (!room) return { error: '방을 찾을 수 없습니다.' };
            if (room.ownerId !== user.id) return { error: '방장만 방장을 위임할 수 있습니다.' };
            if (targetUserId === user.id) return { error: '본인에게는 위임할 수 없습니다.' };
            if (isPetAiId(targetUserId)) return { error: '해당 슬롯에는 위임할 수 없습니다.' };
            if (!userInPairRoomMembership(room, targetUserId)) return { error: '해당 유저가 이 방에 없습니다.' };
            if (
                pairRoomShellInGame(room) ||
                room.phase === 'matching' ||
                room.phase === 'match_pending' ||
                room.pairRankedPetProposal ||
                room.pairDuoRankedLobbyProposal
            ) {
                return { error: '매칭·대국 중에는 방장을 위임할 수 없습니다.' };
            }
            const isPartnerTarget = room.partnerId === targetUserId && !isPetAiId(room.partnerId);
            const isExtraTarget = (room.extraPairMembers ?? []).some((m) => m.id === targetUserId);
            if (!isPartnerTarget && !isExtraTarget) return { error: '위임할 수 있는 참가자가 아닙니다.' };
            if ((room.roomKind === 'ai_duel' || room.roomKind === 'friendly_2p') && !isExtraTarget) {
                return { error: '이 방에서는 상대 자리로만 위임할 수 있습니다.' };
            }

            let displayName = resolvePairMemberDisplayNameForTransfer(volatileState, room, targetUserId);
            if (!displayName || displayName === targetUserId) {
                const fetched = await db.getUser(targetUserId);
                if (fetched?.nickname) displayName = fetched.nickname;
            }

            abortPairRankedPetProposalsForRoom(volatileState, room.id);
            applyPairRoomOwnershipTransfer(volatileState, room, targetUserId, displayName || '참가자');
            broadcastPairRooms(volatileState);
            broadcastPairPartnerInvites(volatileState);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_SET_READY': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const { ready } = payload as { ready: boolean };
            const target = Object.values(volatileState.pairRooms).find((room) => userInActivePairLobbyRoom(room, user.id));
            if (!target) return { error: '참여 중인 페어 방이 없습니다.' };
            if (target.pairRankedPetProposal) return { error: '매칭 수락 대기 중에는 준비 상태를 바꿀 수 없습니다.' };
            if (target.pairDuoRankedLobbyProposal) return { error: '랭킹전 제안 응답 중에는 준비 상태를 바꿀 수 없습니다.' };
            if (
                !ready &&
                (target.phase === 'matching' || userInAnyRankedMatchingQueue(volatileState, user.id))
            ) {
                return { error: '랭킹전 매칭 중에는 준비를 해제할 수 없습니다.' };
            }
            if (target.ownerId === user.id) target.ownerReady = Boolean(ready);
            if (target.partnerId === user.id) target.partnerReady = Boolean(ready);
            if (target.extraPairMembers?.some((m) => m.id === user.id)) {
                target.extraPairMembers = target.extraPairMembers.map((m) =>
                    m.id === user.id ? { ...m, ready: Boolean(ready) } : m,
                );
            }
            refreshPairRoomTeams(target);
            syncPairOwnerStartDeadline(target, now);
            broadcastPairRooms(volatileState);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_SET_ROOM_KIND': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const { roomKind } = payload as { roomKind?: 'ai_duel' | 'duo_match' | 'friendly_4p' | 'friendly_2p' | 'arena_ai' };
            const target = Object.values(volatileState.pairRooms).find((room) => room.ownerId === user.id && !pairRoomShellInGame(room));
            if (!target) return { error: '방장만 방 종류를 변경할 수 있습니다.' };
            if (target.ownerId !== user.id) return { error: '방장만 방 종류를 변경할 수 있습니다.' };
            if (target.phase === 'in_game' || target.phase === 'matching' || target.pairRankedPetProposal || target.pairDuoRankedLobbyProposal) {
                return { error: '매칭·대국 중에는 방 종류를 변경할 수 없습니다.' };
            }
            refreshPairRoomTeams(target);
            const normalizedKind =
                roomKind === 'ai_duel' ||
                roomKind === 'duo_match' ||
                roomKind === 'friendly_4p' ||
                roomKind === 'friendly_2p' ||
                roomKind === 'arena_ai'
                    ? roomKind
                    : 'friendly_4p';
            const setKindLobby = (target as { lobbyChannel?: string }).lobbyChannel ?? 'pair';
            if (normalizedKind === 'arena_ai' && setKindLobby !== 'strategic' && setKindLobby !== 'playful') {
                return { error: 'AI와 대결은 전략·놀이 경기장에서만 사용할 수 있습니다.' };
            }
            if (
                normalizedKind === 'ai_duel' &&
                (target as { lobbyChannel?: string }).lobbyChannel &&
                (target as { lobbyChannel?: string }).lobbyChannel !== 'pair'
            ) {
                return { error: '펫 랭킹 방은 페어 경기장에서만 사용할 수 있습니다.' };
            }
            if (
                normalizedKind === 'friendly_2p' &&
                (target as { lobbyChannel?: string }).lobbyChannel &&
                (target as { lobbyChannel?: string }).lobbyChannel !== 'pair'
            ) {
                return { error: '2인 친선은 페어 경기장에서만 사용할 수 있습니다.' };
            }
            if (normalizedKind === 'ai_duel' && target.roomKind !== 'ai_duel') {
                if (!hasUsableEquippedPairPet(user)) {
                    return { error: '펫 페어로 바꾸려면 페어 펫을 장착해야 합니다.' };
                }
                const realPartner = target.partnerId && !isPetAiId(target.partnerId);
                if (realPartner) {
                    return { error: '펫 페어로 바꾸려면 다른 유저가 없어야 합니다.' };
                }
                if (countPairRoomHumanUsers(target) !== 1) {
                    return { error: '펫 페어로 바꾸려면 방에 본인만 있어야 합니다.' };
                }
            }
            if (normalizedKind === 'friendly_2p' && target.roomKind !== 'friendly_2p') {
                if (!hasUsableEquippedPairPet(user)) {
                    return { error: '2인 친선으로 바꾸려면 페어 펫을 장착해야 합니다.' };
                }
                if (countPairRoomHumanUsers(target) > 2) {
                    return { error: '참가자가 많아 2인 친선으로 변경할 수 없습니다.' };
                }
            }
            if (
                target.roomKind === 'friendly_4p' &&
                (normalizedKind === 'duo_match' || normalizedKind === 'ai_duel' || normalizedKind === 'friendly_2p') &&
                countPairRoomHumanUsers(target) >= 3
            ) {
                return { error: '4인 친선 방에 유저가 3명 이상일 때는 2인 페어·펫 페어로 변경할 수 없습니다.' };
            }
            if (
                (target.roomKind === 'ai_duel' || target.roomKind === 'friendly_2p') &&
                normalizedKind !== 'ai_duel' &&
                normalizedKind !== 'friendly_2p' &&
                (target.extraPairMembers?.length ?? 0) > 1
            ) {
                return { error: '해당 방에 복수 상대가 있을 때는 방 종류를 바꿀 수 없습니다.' };
            }
            if (normalizedKind === 'arena_ai' && target.roomKind !== 'arena_ai') {
                const realPartner = target.partnerId && !isPetAiId(target.partnerId);
                if (realPartner || countPairRoomHumanUsers(target) !== 1) {
                    return { error: 'AI와 대결로 바꾸려면 방에 본인만 있어야 합니다.' };
                }
            }
            applyPairRoomKindTransition(target, normalizedKind);
            if (normalizedKind === 'ai_duel') {
                target.partnerName = equippedPairPetDisplayNameForUser(user);
                const snap = pairLobbyPetSnapshotFromUser(user);
                if (snap) target.ownerLobbyPet = snap;
            }
            if (normalizedKind === 'friendly_2p') {
                const snap = pairLobbyPetSnapshotFromUser(user);
                if (snap) target.ownerLobbyPet = snap;
            }
            if (normalizedKind === 'arena_ai') {
                delete target.ownerLobbyPet;
                delete target.opponentLobbyPet;
                target.partnerName = 'AI';
            }
            refreshPairRoomTeams(target);
            broadcastPairRooms(volatileState);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_SEND_ROOM_CHAT': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const { roomId, text, scope } = payload as { roomId?: string; text?: string; scope?: string };
            const target = typeof roomId === 'string' ? volatileState.pairRooms[roomId] : undefined;
            const humanIds = target ? collectPairRoomHumanUserIds(target) : new Set<string>();
            const inRoom =
                target &&
                (target.ownerId === user.id ||
                    target.partnerId === user.id ||
                    humanIds.has(user.id));
            if (!target || !inRoom) return { error: '페어 방에 참여 중이 아닙니다.' };

            if (user.chatBanUntil && user.chatBanUntil > now) {
                const timeLeft = Math.ceil((user.chatBanUntil - now) / 1000 / 60);
                return { error: `채팅이 금지되었습니다. (${timeLeft}분 남음)` };
            }
            const lastMessageTime = volatileState.userLastChatMessage[user.id] || 0;
            if (now - lastMessageTime < 5000 && !user.isAdmin) {
                return { error: '메시지를 너무 자주 보낼 수 없습니다.' };
            }

            const normalizedScope = scope === 'team' ? 'team' : 'room';
            const trimmed = typeof text === 'string' ? text.trim().slice(0, 400) : '';
            if (!trimmed) return { error: '메시지를 입력하세요.' };
            if (containsProfanity(trimmed)) {
                return { error: '메시지에 부적절한 단어가 포함되어 있습니다.' };
            }

            const senderTeam = getPairRoomUserTeamId(target, user.id);
            if (!senderTeam) return { error: '채팅을 보낼 수 없습니다.' };

            if (!volatileState.userConsecutiveChatMessages) volatileState.userConsecutiveChatMessages = {};
            const consecutive = volatileState.userConsecutiveChatMessages[user.id];
            if (consecutive && consecutive.content === trimmed) {
                consecutive.count++;
            } else {
                volatileState.userConsecutiveChatMessages[user.id] = { content: trimmed, count: 1 };
            }
            if (volatileState.userConsecutiveChatMessages[user.id].count >= 3 && !user.isAdmin) {
                const banDurationMinutes = 3;
                user.chatBanUntil = now + banDurationMinutes * 60 * 1000;
                db.updateUser(user).catch((err) => {
                    console.error(`[PAIR_SEND_ROOM_CHAT] Failed to save user ${user.id}:`, err);
                });
                delete volatileState.userConsecutiveChatMessages[user.id];
                return { error: `동일한 메시지를 반복하여 ${banDurationMinutes}분간 채팅이 금지되었습니다.` };
            }

            const line: types.PairRoomChatLine = {
                id: `pair-chat-${randomUUID()}`,
                userId: user.id,
                nickname: user.nickname,
                text: trimmed,
                timestamp: now,
                scope: normalizedScope,
                teamId: senderTeam,
            };

            if (normalizedScope === 'room') {
                if (!target.pairChatMessages) target.pairChatMessages = [];
                target.pairChatMessages.push(line);
                if (target.pairChatMessages.length > 100) target.pairChatMessages.shift();
            } else {
                if (!volatileState.pairRoomTeamChats) volatileState.pairRoomTeamChats = {};
                if (!volatileState.pairRoomTeamChats[target.id]) volatileState.pairRoomTeamChats[target.id] = {};
                const bucket = volatileState.pairRoomTeamChats[target.id];
                const key = senderTeam === 'teamA' ? 'teamA' : 'teamB';
                const arr = bucket[key] || (bucket[key] = []);
                arr.push(line);
                if (arr.length > 100) arr.shift();
            }

            volatileState.userLastChatMessage[user.id] = now;

            if (GREETINGS.some((g) => trimmed.toLowerCase().includes(g))) {
                updateQuestProgress(user, 'chat_greeting');
                db.updateUser(user).catch((err) => {
                    console.error(`[PAIR_SEND_ROOM_CHAT] Failed to save user ${user.id}:`, err);
                });
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['quests']);
            }

            const recipients = getPairRoomChatRecipients(target, normalizedScope, senderTeam);
            broadcastToUserIds(recipients, { type: 'PAIR_ROOM_CHAT', payload: { roomId: target.id, message: line } });

            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_SET_SEAT_ASSIGNMENTS': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const { roomId, teamA, teamB } = payload as { roomId?: string; teamA?: string[]; teamB?: string[] };
            const target = typeof roomId === 'string' ? volatileState.pairRooms[roomId] : undefined;
            if (!target) return { error: '페어 방을 찾을 수 없습니다.' };
            if (target.ownerId !== user.id) return { error: '방장만 팀 배치를 변경할 수 있습니다.' };
            if (target.pairMode === 'ai') return { error: '펫 페어 방에서는 팀 배치를 바꿀 수 없습니다.' };
            const validated = validatePairSeatAssignments(target, Array.isArray(teamA) ? teamA : [], Array.isArray(teamB) ? teamB : []);
            if (!validated.ok) return { error: validated.error };
            target.pairSeatAssignments = { teamA: validated.teamA, teamB: validated.teamB };
            refreshPairRoomTeams(target);
            broadcastPairRooms(volatileState);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_PROPOSE_DUO_RANKED_MATCH': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const { mode } = payload as { mode?: GameMode };
            if (!mode) return { error: '게임 모드를 선택해 주세요.' };
            const target = Object.values(volatileState.pairRooms).find((room) => userInActivePairLobbyRoom(room, user.id));
            if (!target) return { error: '참여 중인 페어 방이 없습니다.' };
            if (target.ownerId !== user.id) return { error: '방장만 랭킹전 매칭을 제안할 수 있습니다.' };
            if (target.roomKind !== 'duo_match') return { error: '2인 페어 방에서만 사용할 수 있습니다.' };
            const lobbyCh = (target as { lobbyChannel?: string }).lobbyChannel ?? 'pair';
            if (lobbyCh === 'pair') {
                return {
                    error: '페어 경기장에서는 이 방식의 랭킹전을 사용할 수 없습니다. 「페어 펫 랭킹전」을 이용해 주세요.',
                };
            }
            if (lobbyCh === 'playful') {
                return { error: '놀이바둑 경기장에서는 랭킹전을 지원하지 않습니다.' };
            }
            if (lobbyCh !== 'strategic') {
                return { error: '전략 경기장 방에서만 사용할 수 있습니다.' };
            }
            if (!target.partnerId || isPetAiId(target.partnerId)) return { error: '파트너가 입장한 뒤에 진행해 주세요.' };
            if (target.phase === 'matching' || target.phase === 'match_pending' || target.pairRankedPetProposal) {
                return { error: '이미 매칭 절차가 진행 중입니다.' };
            }
            const requestedMode = resolvePairWaitingRoomSelectedGameMode(target, mode);
            target.pairDuoRankedLobbyProposal = {
                proposalId: randomUUID(),
                mode: requestedMode,
                proposedAt: now,
            };
            target.ownerReady = false;
            target.partnerReady = false;
            refreshPairRoomTeams(target);
            broadcastPairRooms(volatileState);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_ACK_DUO_RANKED_MATCH': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const { accept } = payload as { accept?: boolean };
            if (typeof accept !== 'boolean') return { error: '요청이 올바르지 않습니다.' };
            const target = Object.values(volatileState.pairRooms).find((room) => userInActivePairLobbyRoom(room, user.id));
            if (!target) return { error: '참여 중인 페어 방이 없습니다.' };
            if (target.roomKind !== 'duo_match') return { error: '2인 페어 방에서만 사용할 수 있습니다.' };
            const prop = target.pairDuoRankedLobbyProposal;
            if (!prop) return { error: '대기 중인 랭킹전 제안이 없습니다.' };
            if (target.partnerId !== user.id || isPetAiId(target.partnerId)) {
                return { error: '파트너만 응답할 수 있습니다.' };
            }
            if (!accept) {
                delete target.pairDuoRankedLobbyProposal;
                refreshPairRoomTeams(target);
                broadcastPairRooms(volatileState);
                return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
            }
            const requestedMode = resolvePairWaitingRoomSelectedGameMode(target, prop.mode);
            target.selectedGameMode = requestedMode;
            target.settings = {
                ...DEFAULT_GAME_SETTINGS,
                ...getRankedGameSettings(requestedMode),
            };
            delete target.pairDuoRankedLobbyProposal;
            target.pairPetMatchingQueuedAt = Date.now();
            target.phase = 'matching';
            target.ownerReady = true;
            target.partnerReady = true;
            target.matchStartedAt = undefined;
            refreshPairRoomTeams(target);
            await tryMatchDuoPairRankedRooms(volatileState);
            broadcastPairRooms(volatileState);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_CANCEL_DUO_RANKED_LOBBY_PROPOSAL': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const target = Object.values(volatileState.pairRooms).find((room) => userInActivePairLobbyRoom(room, user.id));
            if (!target) return { error: '참여 중인 페어 방이 없습니다.' };
            if (target.ownerId !== user.id) return { error: '방장만 제안을 취소할 수 있습니다.' };
            if (!target.pairDuoRankedLobbyProposal) return { error: '취소할 제안이 없습니다.' };
            delete target.pairDuoRankedLobbyProposal;
            refreshPairRoomTeams(target);
            broadcastPairRooms(volatileState);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_QUEUE_PET_RANKED': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const modePayload = (payload as { mode?: GameMode }).mode ?? GameMode.Standard;
            const existingRoom = Object.values(volatileState.pairRooms).find((room) => userInActivePairLobbyRoom(room, user.id));
            if (existingRoom) {
                if (existingRoom.roomKind !== 'ai_duel' || !existingRoom.pairPetRankedQueueShell) {
                    return { error: '페어 랭킹전을 시작하려면 다른 페어 방에서 나와 주세요.' };
                }
                if (existingRoom.ownerId !== user.id) {
                    return { error: '방장만 랭킹전 매칭을 시작할 수 있습니다.' };
                }
                if (existingRoom.pairRankedPetProposal) {
                    return { error: '이미 매칭 제안 대기 중입니다.' };
                }
                if (existingRoom.phase === 'match_pending') {
                    return { error: '이미 매칭 진행 중입니다.' };
                }
                if (existingRoom.phase === 'in_game') {
                    return { error: '진행 중인 대국이 있습니다.' };
                }
                if (existingRoom.phase === 'matching') {
                    broadcastPairRooms(volatileState);
                    return {
                        clientResponse: {
                            matching: true,
                            pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
                        },
                    };
                }
            }
            if (!hasUsableEquippedPairPet(user)) {
                return { error: '펫 페어 매칭을 시작하려면 페어 펫을 장착해야 합니다.' };
            }

            let target = existingRoom;
            if (!target) {
                const roomId = `pair-room-${randomUUID()}`;
                const code = `rq-${randomUUID().replace(/-/g, '').slice(0, 20)}`;
                const ownerPairPetName = equippedPairPetDisplayNameForUser(user);
                const rankedSettings = getRankedGameSettings(modePayload);
                const room: types.PairRoomState = {
                    id: roomId,
                    code,
                    mode: 'ai',
                    pairMode: 'ai',
                    roomKind: 'ai_duel',
                    visibility: 'public',
                    passwordProtected: false,
                    phase: 'waiting',
                    lobbyChannel: 'pair',
                    pairPetRankedQueueShell: true,
                    title: clampPairRoomTitle('랭킹전 대기'),
                    ownerId: user.id,
                    ownerName: user.nickname,
                    partnerId: `pet-ai-${user.id}`,
                    partnerName: ownerPairPetName,
                    selectedGameMode: PAIR_MODE_DEFAULT_GAME_MODE,
                    settings: { ...DEFAULT_GAME_SETTINGS },
                    teamA: { id: 'teamA', name: '우리 팀', members: [] },
                    teamB: { id: 'teamB', name: '상대 팀', members: [] },
                    futurePetAi: pairPetAiPlaceholder(),
                    ownerReady: false,
                    partnerReady: true,
                    createdAt: Date.now(),
                    pairChatMessages: [],
                };
                const snap = pairLobbyPetSnapshotFromUser(user);
                if (snap) room.ownerLobbyPet = snap;
                mergePairRoomLobbyGameSettings(room, {
                    selectedGameMode: modePayload,
                    settings: { ...DEFAULT_GAME_SETTINGS, ...rankedSettings },
                });
                volatileState.pairRooms[roomId] = refreshPairRoomTeams(room);
                target = volatileState.pairRooms[roomId]!;
            }

            const requestedMode = resolvePairWaitingRoomSelectedGameMode(target, modePayload);
            target.selectedGameMode = requestedMode;
            target.settings = {
                ...DEFAULT_GAME_SETTINGS,
                ...getRankedGameSettings(requestedMode),
            };
            target.pairPetMatchingQueuedAt = Date.now();
            target.phase = 'matching';
            target.ownerReady = true;
            target.partnerReady = true;
            target.matchStartedAt = undefined;
            refreshPairRoomTeams(target);
            await tryMatchPairPetRankedRooms(volatileState);
            await tryMatchDuoPairRankedRooms(volatileState);
            broadcastPairRooms(volatileState);
            return {
                clientResponse: {
                    matching: true,
                    pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
                },
            };
        }
        case 'PAIR_START_MATCH': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const target = Object.values(volatileState.pairRooms).find((room) => userInActivePairLobbyRoom(room, user.id));
            if (!target) return { error: '참여 중인 페어 방이 없습니다.' };
            if (target.ownerId !== user.id) return { error: '방장만 매칭을 시작할 수 있습니다.' };
            if (target.roomKind === 'arena_ai') {
                return { error: 'AI와 대결 방은 「AI 대전 시작」으로 시작해 주세요.' };
            }
            const startLobbyCh = (target as { lobbyChannel?: string }).lobbyChannel ?? 'pair';
            if (target.roomKind === 'duo_match' || target.roomKind === 'friendly_4p') {
                if (target.roomKind === 'duo_match') {
                    const friendlyDuoArenaLobby =
                        (startLobbyCh === 'strategic' || startLobbyCh === 'playful') &&
                        !target.pairDuoRankedLobbyProposal &&
                        ((target.phase ?? 'waiting') === 'waiting' || target.phase === 'ready');
                    if (!friendlyDuoArenaLobby) {
                        return startLobbyCh === 'pair'
                            ? { error: '2인 AI대전 방은 「AI대전 시작」 버튼으로 시작해 주세요.' }
                            : { error: '2인 페어는 「랭킹전 매칭」으로 시작해 주세요.' };
                    }
                } else {
                    if (startLobbyCh !== 'pair') {
                        return { error: '4인 친선은 페어 경기장에서만 시작할 수 있습니다.' };
                    }
                    if ((target.phase ?? 'waiting') !== 'waiting' && target.phase !== 'ready') {
                        return { error: '대기 중인 방에서만 시작할 수 있습니다.' };
                    }
                }
                if (target.roomKind === 'duo_match') {
                    syncDuoMatchPairSeatAssignments(target);
                }
                refreshPairRoomTeams(target);
                const teams = buildPairTeams(target);
                const teamAUsers = teams.teamA.members.filter((m) => m.kind === 'user');
                const teamBUsers = teams.teamB.members.filter((m) => m.kind === 'user');
                const humanTotal = teamAUsers.length + teamBUsers.length;
                const isFourHumanTwoPlusTwo = teamAUsers.length === 2 && teamBUsers.length === 2;
                if (target.roomKind === 'friendly_4p') {
                    if (!isFourHumanTwoPlusTwo) {
                        return { error: '4인 친선은 양 팀에 인간 2명씩 착석해야 시작할 수 있습니다.' };
                    }
                } else {
                    if (humanTotal >= 4) {
                        if (!isFourHumanTwoPlusTwo) {
                            return { error: '양 팀에 각각 2명이 착석해야 친선을 시작할 수 있습니다.' };
                        }
                    } else if (humanTotal === 2) {
                        // 전략·놀이 친선: 방장+상대 2인만으로 시작(좌석이 teamA에만 모이는 경우 포함)
                    } else if (humanTotal <= 1) {
                        return { error: '상대가 입장한 뒤 시작할 수 있습니다.' };
                    } else {
                        return {
                            error: '참가 인원을 맞춰 주세요. 전략·놀이 친선은 상대 1명과, 4인 친선은 페어 경기장에서 시작할 수 있습니다.',
                        };
                    }
                }
                /** 방장은 준비하지 않아도 됨 — 방장 외 인간만 준비 완료면 시작 가능 */
                const duoGuestReadyForStart = (m: (typeof teamAUsers)[number]) =>
                    m.id === target.ownerId || Boolean(m.ready);
                if (!teamAUsers.every(duoGuestReadyForStart) || !teamBUsers.every(duoGuestReadyForStart)) {
                    return { error: '모든 참가자가 준비 완료한 뒤에 시작할 수 있습니다.' };
                }
                const requestedModeDuo = resolvePairWaitingRoomSelectedGameMode(
                    target,
                    (payload as { mode?: GameMode } | undefined)?.mode ?? target.selectedGameMode,
                );
                target.selectedGameMode = requestedModeDuo;
                const payloadSettingsDuo =
                    (payload as { settings?: types.GameSettings } | undefined)?.settings &&
                    typeof (payload as { settings?: types.GameSettings }).settings === 'object'
                        ? (payload as { settings?: types.GameSettings }).settings!
                        : ({} as types.GameSettings);
                target.settings = {
                    ...DEFAULT_GAME_SETTINGS,
                    ...target.settings,
                    ...payloadSettingsDuo,
                };
                let pairSettingsDuo: types.GameSettings;
                let gameDuo: types.LiveGameSession;
                let inGameUserIds: string[];
                if (target.roomKind === 'friendly_4p' || isFourHumanTwoPlusTwo) {
                    const teamAIds = teamAUsers.map((m) => m.id);
                    const teamBIds = teamBUsers.map((m) => m.id);
                    const [uA0, uA1, uB0, uB1] = await Promise.all([
                        db.getUser(teamAIds[0]),
                        db.getUser(teamAIds[1]),
                        db.getUser(teamBIds[0]),
                        db.getUser(teamBIds[1]),
                    ]);
                    if (!uA0 || !uA1 || !uB0 || !uB1) return { error: '참가자 정보를 찾지 못했습니다.' };
                    pairSettingsDuo = buildPairGameSettings(target);
                    const negotiationDuo: Negotiation = {
                        id: `neg-pair-duo-friendly-${randomUUID()}`,
                        challenger: user,
                        opponent: uB0,
                        mode: requestedModeDuo,
                        settings: pairSettingsDuo,
                        proposerId: user.id,
                        status: 'pending',
                        deadline: 0,
                        turnCount: 0,
                        isRanked: false,
                        pairPetStatUsers: [uA0, uA1, uB0, uB1],
                        pairPetConfigureOwnerId: user.id,
                    };
                    gameDuo = await initializeGame(negotiationDuo);
                    configurePairClassicGameStart(gameDuo, user, [uA0, uA1, uB0, uB1]);
                    inGameUserIds = [uA0.id, uA1.id, uB0.id, uB1.id];
                } else {
                    const ownerUser = await db.getUser(target.ownerId);
                    const guestMember = [...teamAUsers, ...teamBUsers].find((m) => m.id !== target.ownerId);
                    if (!ownerUser || !guestMember) return { error: '참가자 정보를 찾지 못했습니다.' };
                    const partnerUser = await db.getUser(guestMember.id);
                    if (!partnerUser) return { error: '참가자 정보를 찾지 못했습니다.' };
                    // 전략·놀이 경기장 `duo_match` 2인 친선: 방 UI는 페어 로비이나 대국은 일반 1:1(페어 좌석·펫 AI 없음)
                    pairSettingsDuo = { ...DEFAULT_GAME_SETTINGS, ...target.settings, ...payloadSettingsDuo };
                    delete (pairSettingsDuo as { pairGame?: unknown }).pairGame;
                    const negotiationDuo: Negotiation = {
                        id: `neg-arena-duo-classic-${randomUUID()}`,
                        challenger: ownerUser,
                        opponent: partnerUser,
                        mode: requestedModeDuo,
                        settings: pairSettingsDuo,
                        proposerId: user.id,
                        status: 'pending',
                        deadline: 0,
                        turnCount: 0,
                        isRanked: false,
                    };
                    gameDuo = await initializeGame(negotiationDuo);
                    inGameUserIds = [ownerUser.id, partnerUser.id];
                }
                await db.saveGame(gameDuo);
                for (const uid of inGameUserIds) {
                    setInGameUserStatusForArena(volatileState, uid, gameDuo);
                }
                clearPairOwnerStartDeadline(target);
                target.matchStartedAt = Date.now();
                target.phase = 'in_game';
                clearPairInvitesForRoom(volatileState, target.id);
                clearPairRoomTeamChatStore(volatileState, target.id);
                refreshPairRoomTeams(target);
                const { broadcastToGameParticipants: btpDuo, broadcastLiveGameToList: blgDuo } = await import('../socket.js');
                broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
                btpDuo(gameDuo.id, { type: 'GAME_UPDATE', payload: { [gameDuo.id]: gameDuo } }, gameDuo);
                blgDuo(gameDuo);
                broadcastPairRooms(volatileState);
                broadcastPairPartnerInvites(volatileState);
                return {
                    clientResponse: {
                        gameId: gameDuo.id,
                        pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
                    },
                };
            }
            const requestedMode = resolvePairWaitingRoomSelectedGameMode(
                target,
                (payload as { mode?: GameMode } | undefined)?.mode ?? target.selectedGameMode,
            );
            target.selectedGameMode = requestedMode;
            const payloadSettings =
                (payload as { settings?: types.GameSettings } | undefined)?.settings &&
                typeof (payload as { settings?: types.GameSettings }).settings === 'object'
                    ? (payload as { settings?: types.GameSettings }).settings!
                    : ({} as types.GameSettings);
            if (target.roomKind === 'friendly_2p') {
                const opponent = target.extraPairMembers?.[0];
                if (!opponent) return { error: '상대가 입장한 뒤 시작할 수 있습니다.' };
                target.settings = {
                    ...DEFAULT_GAME_SETTINGS,
                    ...target.settings,
                    ...payloadSettings,
                };
                const opponentUser = await db.getUser(opponent.id);
                if (!opponentUser || !hasUsableEquippedPairPet(opponentUser)) {
                    return { error: '상대가 대표 펫을 장착해야 2인 친선을 시작할 수 있습니다.' };
                }
                if (!opponent.ready) {
                    return { error: '상대 준비완료 후 시작할 수 있습니다.' };
                }
                target.ownerReady = true;
                target.partnerReady = true;
                target.pairSeatAssignments = { teamA: [target.ownerId], teamB: [opponent.id] };
                refreshPairRoomTeams(target);
                const partnerUser = opponentUser;
                const pairSettings = buildPairGameSettings(target);
                const negotiation: Negotiation = {
                    id: `neg-pair-pet-friendly-${randomUUID()}`,
                    challenger: user,
                    opponent: partnerUser,
                    mode: requestedMode,
                    settings: pairSettings,
                    proposerId: user.id,
                    status: 'pending',
                    deadline: 0,
                    turnCount: 0,
                    isRanked: false,
                    pairPetStatUsers: [user, partnerUser],
                    pairPetConfigureOwnerId: user.id,
                };
                const game = await initializeGame(negotiation);
                configurePairClassicGameStart(game, user, [user, partnerUser]);
                await db.saveGame(game);
                setInGameUserStatusForArena(volatileState, game.player1.id, game);
                setInGameUserStatusForArena(volatileState, game.player2.id, game);
                clearPairOwnerStartDeadline(target);
                target.matchStartedAt = Date.now();
                target.phase = 'in_game';
                clearPairInvitesForRoom(volatileState, target.id);
                clearPairRoomTeamChatStore(volatileState, target.id);
                refreshPairRoomTeams(target);
                const { broadcastToGameParticipants, broadcastLiveGameToList } = await import('../socket.js');
                broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
                broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                broadcastLiveGameToList(game);
                broadcastPairRooms(volatileState);
                broadcastPairPartnerInvites(volatileState);
                return {
                    clientResponse: {
                        gameId: game.id,
                        pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
                    },
                };
            }
            if (target.roomKind === 'ai_duel') {
                if (!hasUsableEquippedPairPet(user)) return { error: '펫 페어 매칭을 시작하려면 페어 펫을 장착해야 합니다.' };
                target.settings = {
                    ...DEFAULT_GAME_SETTINGS,
                    ...getRankedGameSettings(requestedMode),
                };
                target.pairPetMatchingQueuedAt = Date.now();
                target.phase = 'matching';
                target.ownerReady = true;
                target.partnerReady = true;
                target.matchStartedAt = undefined;
                refreshPairRoomTeams(target);
                await tryMatchPairPetRankedRooms(volatileState);
                await tryMatchDuoPairRankedRooms(volatileState);
                broadcastPairRooms(volatileState);
                return {
                    clientResponse: {
                        matching: true,
                        pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
                    },
                };
            }
            if (!target.partnerId) return { error: '파트너가 아직 입장하지 않았습니다.' };
            target.settings = {
                ...DEFAULT_GAME_SETTINGS,
                ...target.settings,
                ...payloadSettings,
            };
            if (!target.partnerReady) return { error: '파트너 준비완료 후 시작할 수 있습니다.' };

            const partnerUser = target.pairMode === 'ai'
                ? getAiUser(requestedMode)
                : await db.getUser(target.partnerId);
            if (!partnerUser) return { error: '파트너 정보를 찾지 못했습니다.' };
            const pairSettings = buildPairGameSettings(target);

            const negotiation: Negotiation = {
                id: `neg-pair-${randomUUID()}`,
                challenger: user,
                opponent: partnerUser,
                mode: requestedMode,
                settings: pairSettings,
                proposerId: user.id,
                status: 'pending',
                deadline: 0,
                turnCount: 0,
                isRanked: false,
                pairPetStatUsers: partnerUser.id === aiUserId ? [user] : [user, partnerUser],
                pairPetConfigureOwnerId: user.id,
            };
            const game = await initializeGame(negotiation);
            configurePairClassicGameStart(game, user, partnerUser.id === aiUserId ? [user] : [user, partnerUser]);
            await db.saveGame(game);
            setInGameUserStatusForArena(volatileState, game.player1.id, game);
            setInGameUserStatusForArena(volatileState, game.player2.id, game);
            clearPairOwnerStartDeadline(target);
            target.matchStartedAt = Date.now();
            target.phase = 'in_game';
            clearPairInvitesForRoom(volatileState, target.id);
            clearPairRoomTeamChatStore(volatileState, target.id);
            refreshPairRoomTeams(target);

            const { broadcastToGameParticipants, broadcastLiveGameToList } = await import('../socket.js');
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
            broadcastLiveGameToList(game);
            broadcastPairRooms(volatileState);
            broadcastPairPartnerInvites(volatileState);
            return {
                clientResponse: {
                    gameId: game.id,
                    pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
                },
            };
        }
        case 'PAIR_CANCEL_PAIR_PET_MATCHING': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const target = Object.values(volatileState.pairRooms).find((room) => userInActivePairLobbyRoom(room, user.id));
            if (!target) return { error: '참여 중인 페어 방이 없습니다.' };
            const cancelLobby = (target as { lobbyChannel?: string }).lobbyChannel ?? 'pair';
            const isArenaDuoRanked =
                target.roomKind === 'duo_match' &&
                (cancelLobby === 'strategic' || cancelLobby === 'playful' || cancelLobby === 'pair');
            if (target.roomKind !== 'ai_duel' && !isArenaDuoRanked) {
                return { error: '펫 페어 또는 경기장 2인 페어 랭킹전에서만 사용할 수 있습니다.' };
            }
            if (!canUserCancelPairPetOrDuoRankedMatching(target, user.id)) {
                return { error: '매칭을 취소할 권한이 없습니다.' };
            }
            if (target.pairRankedPetProposal) {
                abortPairRankedPetProposalsForRoom(volatileState, target.id);
                appendPairRankedPetDuoMatchCancelChatLine(volatileState, target, user, now);
                broadcastPairRooms(volatileState);
                return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
            }
            if (target.phase !== 'matching') return { error: '매칭 중이 아닙니다.' };
            delete target.pairPetMatchingQueuedAt;
            if (target.pairPetRankedQueueShell) {
                clearPairInvitesForRoom(volatileState, target.id);
                clearPairRoomTeamChatStore(volatileState, target.id);
                delete volatileState.pairRooms![target.id];
            } else {
                target.phase = 'waiting';
                refreshPairRoomTeams(target);
                appendPairRankedPetDuoMatchCancelChatLine(volatileState, target, user, now);
            }
            broadcastPairRooms(volatileState);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_RESPOND_PAIR_PET_RANKED_MATCH': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const { proposalId, accept } = payload as { proposalId?: string; accept?: boolean };
            if (!proposalId || typeof accept !== 'boolean') return { error: '요청이 올바르지 않습니다.' };
            const prop = volatileState.pairRankedPetProposals?.[proposalId];
            if (!prop) return { error: '이미 처리되었거나 만료된 매칭입니다.' };
            const deadline = prop.acceptDeadlineAt ?? prop.createdAt + PAIR_RANKED_MATCH_ACCEPT_WINDOW_MS;
            if (now > deadline) {
                abortPairRankedPetProposalsForRoom(volatileState, prop.roomAId);
                return { error: '매칭 수락 시간이 지났습니다.' };
            }
            const duo = prop.matchKind === 'duo_human';
            const isOwner = user.id === prop.ownerAId || user.id === prop.ownerBId;
            const isPartnerA = Boolean(prop.partnerAId && user.id === prop.partnerAId);
            const isPartnerB = Boolean(prop.partnerBId && user.id === prop.partnerBId);
            if (duo) {
                if (!isOwner && !isPartnerA && !isPartnerB) return { error: '이 매칭에 참가할 수 없습니다.' };
            } else if (!isOwner) {
                return { error: '이 매칭에 참가할 수 없습니다.' };
            }
            const roomA = volatileState.pairRooms[prop.roomAId];
            const roomB = volatileState.pairRooms[prop.roomBId];
            if (
                !roomA?.pairRankedPetProposal ||
                roomA.pairRankedPetProposal.proposalId !== proposalId ||
                !roomB?.pairRankedPetProposal ||
                roomB.pairRankedPetProposal.proposalId !== proposalId
            ) {
                return { error: '방 상태가 바뀌어 매칭을 완료할 수 없습니다.' };
            }
            if (!accept) {
                abortPairRankedPetProposalsForRoom(volatileState, roomA.id);
                return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
            }
            if (user.id === prop.ownerAId) prop.acceptOwnerA = true;
            else if (user.id === prop.ownerBId) prop.acceptOwnerB = true;
            else if (user.id === prop.partnerAId) prop.acceptPartnerA = true;
            else if (user.id === prop.partnerBId) prop.acceptPartnerB = true;
            syncPairRankedPetProposalRoomSnapshots(volatileState, proposalId);
            broadcastPairRooms(volatileState);
            const needPartners = duo && Boolean(prop.partnerAId && prop.partnerBId);
            const allAccepted =
                prop.acceptOwnerA &&
                prop.acceptOwnerB &&
                (!needPartners || (prop.acceptPartnerA && prop.acceptPartnerB));
            if (!allAccepted) {
                return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
            }
            if (duo && (!prop.partnerAId || !prop.partnerBId)) {
                abortPairRankedPetProposalsForRoom(volatileState, roomA.id);
                return { error: '파트너가 모두 입장해야 매칭을 진행할 수 있습니다.' };
            }
            const ownerA = await db.getUser(prop.ownerAId);
            const ownerB = await db.getUser(prop.ownerBId);
            if (!ownerA || !ownerB) {
                abortPairRankedPetProposalsForRoom(volatileState, roomA.id);
                return { error: '유저 정보를 찾지 못해 매칭이 취소되었습니다.' };
            }
            if (prop.matchKind === 'duo_human') {
                const partnerA = prop.partnerAId ? await db.getUser(prop.partnerAId) : null;
                const partnerB = prop.partnerBId ? await db.getUser(prop.partnerBId) : null;
                if (!partnerA || !partnerB) {
                    abortPairRankedPetProposalsForRoom(volatileState, roomA.id);
                    return { error: '파트너 정보를 찾지 못해 매칭이 취소되었습니다.' };
                }
                const ap = await assertAndConsumePairRankedMatchActionPoints(
                    volatileState,
                    [ownerA, partnerA, ownerB, partnerB],
                    roomA,
                    now,
                );
                if (!ap.ok) {
                    abortPairRankedPetProposalsForRoom(volatileState, roomA.id);
                    return { error: ap.error };
                }
                const game = await finalizePairRankedDuoHumanGame(
                    volatileState,
                    roomA,
                    roomB,
                    ownerA,
                    partnerA,
                    ownerB,
                    partnerB,
                    proposalId,
                );
                return {
                    clientResponse: {
                        gameId: game.id,
                        pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
                    },
                };
            }
            if (!hasUsableEquippedPairPet(ownerA) || !hasUsableEquippedPairPet(ownerB)) {
                abortPairRankedPetProposalsForRoom(volatileState, roomA.id);
                return { error: '페어 펫 장착이 해제되어 매칭이 취소되었습니다.' };
            }
            const apPet = await assertAndConsumePairRankedMatchActionPoints(volatileState, [ownerA, ownerB], roomA, now);
            if (!apPet.ok) {
                abortPairRankedPetProposalsForRoom(volatileState, roomA.id);
                return { error: apPet.error };
            }
            const game = await finalizePairRankedPetRankedGame(volatileState, roomA, roomB, ownerA, ownerB, proposalId);
            return {
                clientResponse: {
                    gameId: game.id,
                    pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
                },
            };
        }
        case 'PAIR_START_AI_MATCH': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const payloadRoomIdRaw = (payload as { roomId?: string } | undefined)?.roomId;
            const payloadRoomId =
                typeof payloadRoomIdRaw === 'string' && payloadRoomIdRaw.trim() ? payloadRoomIdRaw.trim() : undefined;

            const resolvePairStartAiMatchTargetRoom = (): types.PairRoomState | undefined => {
                const pairRooms = volatileState.pairRooms ?? {};
                if (payloadRoomId) {
                    const byId = pairRooms[payloadRoomId];
                    if (
                        byId &&
                        userInActivePairLobbyRoom(byId, user.id) &&
                        byId.ownerId === user.id &&
                        (byId.roomKind === 'ai_duel' || byId.roomKind === 'duo_match' || byId.roomKind === 'arena_ai')
                    ) {
                        return byId;
                    }
                }
                const candidates = Object.values(pairRooms).filter((room) =>
                    userInActivePairLobbyRoom(room, user.id),
                );
                if (candidates.length === 0) return undefined;
                const userArenaChannel = normalizeArenaChannel(volatileState.userStatuses[user.id]?.arenaChannel);
                const preferredChannel = userArenaChannel ?? (candidates.length === 1 ? (candidates[0].lobbyChannel ?? 'pair') : null);
                if (preferredChannel) {
                    const sameChannel = candidates.filter((r) => (r.lobbyChannel ?? 'pair') === preferredChannel);
                    if (sameChannel.length > 0) {
                        return (
                            sameChannel.find((r) => preferredChannel === 'pair' && r.roomKind === 'ai_duel') ??
                            sameChannel.find((r) => preferredChannel !== 'pair' && r.roomKind === 'arena_ai') ??
                            sameChannel.find((r) => r.roomKind === 'duo_match') ??
                            sameChannel[0]
                        );
                    }
                }
                // 여러 경기장 방이 남아 있을 때는 현재 프레즌스 채널 우선, 없으면 페어 채널 AI 펫 방을 마지막 안전망으로 둔다.
                return (
                    candidates.find((r) => r.roomKind === 'arena_ai') ??
                    candidates.find((r) => r.roomKind === 'duo_match') ??
                    candidates.find((r) => (r.lobbyChannel ?? 'pair') === 'pair' && r.roomKind === 'ai_duel') ??
                    candidates.find((r) => r.roomKind === 'ai_duel') ??
                    candidates[0]
                );
            };

            let target = resolvePairStartAiMatchTargetRoom();
            let ephemeralPairPetAiDuelShell = false;
            if (!target) {
                const shell = buildEphemeralPairPetAiDuelLobbySnapshot(
                    user,
                    payload as { mode?: GameMode; settings?: types.GameSettings } | undefined,
                );
                if (!shell) {
                    return { error: 'AI 대전을 시작하려면 페어 펫을 장착해야 합니다.' };
                }
                target = shell;
                ephemeralPairPetAiDuelShell = true;
            } else if (target.ownerId !== user.id) {
                return { error: '방장만 AI 대전을 시작할 수 있습니다.' };
            }
            if (target.roomKind !== 'ai_duel' && target.roomKind !== 'duo_match' && target.roomKind !== 'arena_ai') {
                return { error: '펫 페어, AI와 대결, 또는 2인 페어 방에서만 AI 대전을 시작할 수 있습니다.' };
            }
            const isPetPairAiDuel = target.roomKind === 'ai_duel';
            const isDuoPairAiDuel = target.roomKind === 'duo_match';
            if (!ephemeralPairPetAiDuelShell && isPetPairAiDuel && !hasUsableEquippedPairPet(user)) {
                return { error: 'AI 대전을 시작하려면 페어 펫을 장착해야 합니다.' };
            }
            if (isPetPairAiDuel && (target.extraPairMembers?.length ?? 0) > 0) {
                return { error: '상대가 입장한 펫 페어 방에서는 친선 대국을 시작해 주세요.' };
            }
            const targetLobbyChannel = target.lobbyChannel ?? 'pair';
            if (isPetPairAiDuel && targetLobbyChannel !== 'pair') {
                return { error: '펫 페어 AI 대전은 페어 경기장에서만 시작할 수 있습니다.' };
            }
            if (target.roomKind === 'arena_ai' && targetLobbyChannel !== 'strategic' && targetLobbyChannel !== 'playful') {
                return { error: 'AI와 대결은 전략·놀이 경기장에서만 시작할 수 있습니다.' };
            }
            if (isDuoPairAiDuel) {
                const duoPartner = getDuoPairAiPartner(target);
                if (!duoPartner) return { error: '파트너가 입장한 뒤 AI 대전을 시작할 수 있습니다.' };
                if (!duoPartner.ready) return { error: '파트너 준비완료 후 AI 대전을 시작할 수 있습니다.' };
                target.partnerId = duoPartner.id;
                target.partnerName = duoPartner.name;
                target.partnerReady = true;
                target.extraPairMembers = (target.extraPairMembers ?? []).filter((m) => m.id !== duoPartner.id);
                target.pairSeatAssignments = { teamA: [target.ownerId], teamB: [duoPartner.id] };
            }

            target.ownerReady = true;
            if (isPetPairAiDuel) {
                target.partnerId = target.partnerId || `pet-ai-${target.ownerId}`;
                target.partnerName = target.partnerName || '내 펫';
            }
            target.partnerReady = true;
            refreshPairRoomTeams(target);

            const selectedMode = resolvePairWaitingRoomSelectedGameMode(target, payload?.mode ?? target.selectedGameMode);
            target.selectedGameMode = selectedMode;
            target.settings = {
                ...DEFAULT_GAME_SETTINGS,
                ...(payload?.settings && typeof payload.settings === 'object' ? payload.settings : target.settings),
                scoringTurnLimit: 0,
            };
            delete (target.settings as any).autoScoringTurns;
            target.settings = clampAiLobbyStrategicItemCaps(selectedMode, target.settings);

            const partnerUser = isDuoPairAiDuel
                ? await db.getUser(target.partnerId!)
                : getAiUser(selectedMode);
            if (!partnerUser) return { error: '파트너 정보를 찾지 못했습니다.' };

            const apNow = Date.now();
            const apParticipants = isDuoPairAiDuel ? [user, partnerUser] : [user];
            const aiMatchBaseAp = baseAiLobbyActionPointCostForModeAndSettings(selectedMode, target.settings);
            const apCheck = await assertAndConsumePairLobbyMatchActionPoints(
                volatileState,
                apParticipants,
                target,
                apNow,
                { baseCostOverride: aiMatchBaseAp },
            );
            if (!apCheck.ok) return { error: apCheck.error };

            const pairSettings = isDuoPairAiDuel ? makeDuoPairAiDuelSettings(target) : makePairPetAiDuelSettings(target);
            const negotiation: Negotiation = {
                id: `neg-pair-ai-${randomUUID()}`,
                challenger: user,
                opponent: partnerUser,
                mode: selectedMode,
                settings: pairSettings,
                proposerId: user.id,
                status: 'pending',
                deadline: 0,
                turnCount: 0,
                isRanked: false,
                pairPetStatUsers: isDuoPairAiDuel ? [user, partnerUser] : [user],
                pairPetConfigureOwnerId: user.id,
            };
            const game = await initializeGame(negotiation);
            configurePairClassicGameStart(game, user, isDuoPairAiDuel ? [user, partnerUser] : [user]);
            await db.saveGame(game);
            setInGameUserStatusForArena(volatileState, game.player1.id, game);
            setInGameUserStatusForArena(volatileState, game.player2.id, game);
            if (!ephemeralPairPetAiDuelShell) {
                clearPairOwnerStartDeadline(target);
                target.matchStartedAt = Date.now();
                target.phase = 'in_game';
                clearPairInvitesForRoom(volatileState, target.id);
                clearPairRoomTeamChatStore(volatileState, target.id);
                refreshPairRoomTeams(target);
            }

            const { broadcastToGameParticipants, broadcastLiveGameToList } = await import('../socket.js');
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
            broadcastLiveGameToList(game);
            if (!ephemeralPairPetAiDuelShell) {
                broadcastPairRooms(volatileState);
                broadcastPairPartnerInvites(volatileState);
            }
            return {
                clientResponse: {
                    gameId: game.id,
                    ...(ephemeralPairPetAiDuelShell ? {} : { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms!) }),
                },
            };
        }
        case 'FRIEND_SYNC': {
            const me = ensureFriendFields(user);
            return { clientResponse: { friendState: getFriendSnapshot(me) } };
        }
        case 'FRIEND_SEND_REQUEST': {
            const { targetUserId } = payload as { targetUserId: string };
            if (!targetUserId || targetUserId === user.id) return { error: '자기 자신을 친구로 추가할 수 없습니다.' };
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 유저를 찾을 수 없습니다.' };
            const me = ensureFriendFields(user);
            const target = ensureFriendFields(targetUser);
            if ((me.friendIds || []).includes(target.id)) return { error: '이미 친구입니다.' };
            if ((me.friendIds || []).length >= FRIEND_LIMIT) return { error: `친구는 최대 ${FRIEND_LIMIT}명까지 등록할 수 있습니다.` };
            if ((target.friendIds || []).length >= FRIEND_LIMIT) return { error: '상대 친구 목록이 가득 찼습니다.' };
            me.incomingFriendRequestIds = removeFromList(me.incomingFriendRequestIds || [], target.id);
            me.outgoingFriendRequestIds = removeFromList(me.outgoingFriendRequestIds || [], target.id);
            target.incomingFriendRequestIds = removeFromList(target.incomingFriendRequestIds || [], me.id);
            target.outgoingFriendRequestIds = removeFromList(target.outgoingFriendRequestIds || [], me.id);
            me.friendIds = uniquePush(me.friendIds || [], target.id);
            target.friendIds = uniquePush(target.friendIds || [], me.id);
            await db.updateUser(me);
            await db.updateUser(target);
            broadcast({ type: 'USER_UPDATE', payload: { [me.id]: me, [target.id]: target } });
            return { clientResponse: { friendState: getFriendSnapshot(me) } };
        }
        case 'FRIEND_ACCEPT_REQUEST': {
            const { requesterUserId } = payload as { requesterUserId: string };
            const requester = await db.getUser(requesterUserId);
            if (!requester) return { error: '친구 요청 유저를 찾을 수 없습니다.' };
            const me = ensureFriendFields(user);
            const fromUser = ensureFriendFields(requester);
            if (!(me.incomingFriendRequestIds || []).includes(fromUser.id)) return { error: '수락할 친구 요청이 없습니다.' };
            if ((me.friendIds || []).length >= FRIEND_LIMIT || (fromUser.friendIds || []).length >= FRIEND_LIMIT) {
                return { error: `친구는 최대 ${FRIEND_LIMIT}명까지 등록할 수 있습니다.` };
            }
            me.incomingFriendRequestIds = removeFromList(me.incomingFriendRequestIds || [], fromUser.id);
            fromUser.outgoingFriendRequestIds = removeFromList(fromUser.outgoingFriendRequestIds || [], me.id);
            me.friendIds = uniquePush(me.friendIds || [], fromUser.id);
            fromUser.friendIds = uniquePush(fromUser.friendIds || [], me.id);
            await db.updateUser(me);
            await db.updateUser(fromUser);
            broadcast({ type: 'USER_UPDATE', payload: { [me.id]: me, [fromUser.id]: fromUser } });
            return { clientResponse: { friendState: getFriendSnapshot(me) } };
        }
        case 'FRIEND_REMOVE': {
            const { targetUserId } = payload as { targetUserId: string };
            const target = await db.getUser(targetUserId);
            if (!target) return { error: '대상 유저를 찾을 수 없습니다.' };
            const me = ensureFriendFields(user);
            const friend = ensureFriendFields(target);
            me.friendIds = removeFromList(me.friendIds || [], friend.id);
            friend.friendIds = removeFromList(friend.friendIds || [], me.id);
            me.incomingFriendRequestIds = removeFromList(me.incomingFriendRequestIds || [], friend.id);
            me.outgoingFriendRequestIds = removeFromList(me.outgoingFriendRequestIds || [], friend.id);
            friend.incomingFriendRequestIds = removeFromList(friend.incomingFriendRequestIds || [], me.id);
            friend.outgoingFriendRequestIds = removeFromList(friend.outgoingFriendRequestIds || [], me.id);
            await db.updateUser(me);
            await db.updateUser(friend);
            broadcast({ type: 'USER_UPDATE', payload: { [me.id]: me, [friend.id]: friend } });
            return { clientResponse: { friendState: getFriendSnapshot(me) } };
        }

        case 'PAIR_PET_PURCHASE': {
            const { sku, quantity: rawQ } = payload as { sku?: string; quantity?: number };
            const purchaseQty = Math.min(999, Math.max(1, Math.floor(Number(rawQ)) || 1));
            const entry = PAIR_PET_SHOP_SKUS.find((s) => s.id === sku);
            if (!entry) return { error: '알 수 없는 상품입니다.' };
            if (entry.dailyLimit === 1 && purchaseQty !== 1) {
                return { error: '유효하지 않은 수량입니다.' };
            }
            const now = Date.now();
            let boughtToday = 0;
            if (!user.isAdmin) {
                if (entry.dailyLimit > 0) {
                    if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
                    const purchaseRecord = user.dailyShopPurchases[entry.id];
                    boughtToday =
                        purchaseRecord && isSameDayKST(purchaseRecord.date, now) ? purchaseRecord.quantity : 0;
                    if (boughtToday + purchaseQty > entry.dailyLimit) {
                        return { error: `하루 구매 한도(${entry.dailyLimit}회)를 초과합니다.` };
                    }
                }
                const totalGold = entry.gold * purchaseQty;
                const totalDiamond = entry.diamonds * purchaseQty;
                if ((user.gold ?? 0) < totalGold || (user.diamonds ?? 0) < totalDiamond) {
                    return { error: '재화가 부족합니다.' };
                }
            }
            if (!user.inventory) user.inventory = [];
            if (!user.inventorySlots) {
                user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
            }
            const grantMaterialQty = entry.quantity * purchaseQty;
            let stack: InventoryItem;
            if (entry.materialName === PAIR_EGG_MATERIAL_NAME) {
                stack = makePairMaterialStack(PAIR_EGG_MATERIAL_NAME, PAIR_EGG_TEMPLATE_ID, grantMaterialQty);
            } else if (entry.materialName === PAIR_WELCOME_EGG_MATERIAL_NAME) {
                stack = makePairMaterialStack(PAIR_WELCOME_EGG_MATERIAL_NAME, PAIR_WELCOME_EGG_TEMPLATE_ID, grantMaterialQty);
            } else {
                stack = makePairMaterialStack(entry.materialName, soulTemplateIdFromMaterialName(entry.materialName), grantMaterialQty);
            }
            const eggPurchase =
                entry.materialName === PAIR_EGG_MATERIAL_NAME || entry.materialName === PAIR_WELCOME_EGG_MATERIAL_NAME;
            const { success, updatedInventory } = addItemsToInventory(user.inventory, user.inventorySlots, [stack], {
                allowMaterialSlotOverflow: eggPurchase,
            });
            if (!success || !updatedInventory) return { error: '인벤토리 공간이 부족합니다.' };
            user.inventory = updatedInventory;
            if (!user.isAdmin) {
                user.gold -= entry.gold * purchaseQty;
                user.diamonds -= entry.diamonds * purchaseQty;
                if (entry.dailyLimit > 0) {
                    if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
                    const record = user.dailyShopPurchases[entry.id];
                    const prevQty = record && isSameDayKST(record.date, now) ? record.quantity : 0;
                    user.dailyShopPurchases[entry.id] = {
                        quantity: prevQty + purchaseQty,
                        date: now,
                        lastPurchaseTimestamp: now,
                    };
                }
            }
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_PURCHASE', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'gold', 'diamonds', 'dailyShopPurchases']);
            // 공통 아이템 획득 모달(AppModalLayer / ItemObtainedModal)용
            return { clientResponse: { updatedUser, obtainedItemsBulk: [{ ...stack }] } };
        }
        case 'PAIR_PET_SET_EQUIPPED': {
            const { templateId, inventoryItemId } = payload as {
                templateId?: string | null;
                inventoryItemId?: string | null;
            };
            if (templateId == null || templateId === '') {
                user.equippedPairPetTemplateId = null;
                user.equippedPairPetInventoryItemId = null;
            } else {
                if (!isPairPetMaterial({ templateId, name: '' })) {
                    return { error: '장착할 수 없는 펫입니다.' };
                }
                const owned = (user.inventory || []).some(
                    (it) => it.templateId === templateId && isPairPetMaterial(it) && (it.quantity ?? 1) >= 1
                );
                if (!owned) return { error: '보유 중인 펫이 아닙니다.' };
                user.equippedPairPetTemplateId = templateId;
                if (inventoryItemId && typeof inventoryItemId === 'string') {
                    const row = user.inventory.find((it) => it.id === inventoryItemId);
                    if (
                        !row ||
                        row.templateId !== templateId ||
                        !isPairPetMaterial(row) ||
                        isPairEggItem(row) ||
                        (row.quantity ?? 1) < 1
                    ) {
                        return { error: '선택한 펫을 찾을 수 없습니다.' };
                    }
                    user.pairPetTrainingSlots = normalizePairPetTrainingSlots(user.pairPetTrainingSlots);
                    if (isItemIdInPairTraining(user.pairPetTrainingSlots, inventoryItemId)) {
                        return { error: '수련 중인 펫은 대표펫으로 지정할 수 없습니다.' };
                    }
                    user.equippedPairPetInventoryItemId = inventoryItemId;
                } else {
                    reconcileEquippedPairPetInventoryItem(user);
                }
            }
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_SET_EQUIPPED', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'equippedPairPetTemplateId', 'equippedPairPetInventoryItemId']);
            return { clientResponse: { updatedUser } };
        }
        case 'PAIR_PET_HATCH_EGG': {
            return { error: '부화장 슬롯에 알을 넣어 부화해 주세요.' };
        }

        case 'PAIR_PET_HATCHERY_UNLOCK': {
            const { slotIndex: rawSi } = payload as { slotIndex?: number };
            const tierIndex = Math.floor(Number(rawSi));
            const gate = canUnlockPairHatcheryUpgrade(user, tierIndex);
            if (!gate.ok) return { error: gate.reason ?? '강화할 수 없습니다.' };
            const def = getPairHatcheryUpgradeTierDef(tierIndex);
            if (!def) return { error: '유효하지 않은 강화 단계입니다.' };
            user.pairPetHatcherySlotUnlocked = normalizePairPetHatcheryUpgradeTiers(user.pairPetHatcherySlotUnlocked);
            if (!user.isAdmin) {
                user.gold = (user.gold ?? 0) - def.unlockGold;
            }
            user.pairPetHatcherySlotUnlocked[tierIndex - 1] = true;
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_HATCHERY_UNLOCK', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['pairPetHatcherySlotUnlocked', 'gold']);
            return { clientResponse: { updatedUser } };
        }

        case 'PAIR_PET_HATCHERY_START': {
            const { slotIndex: rawSi, itemId: hatchItemId } = payload as { slotIndex?: number; itemId?: string };
            const slotIndex = normalizePairHatcherySessionSlotIndex(Number(rawSi));
            if (slotIndex < 0 || slotIndex >= PAIR_HATCHERY_SESSION_SLOT_COUNT) {
                return { error: '유효하지 않은 슬롯입니다.' };
            }
            if (!isPairHatcherySessionSlotIndex(slotIndex)) {
                return { error: '1번 부화 슬롯 또는 VIP 슬롯만 사용할 수 있습니다.' };
            }
            if (!canUsePairHatcherySlot(user, slotIndex)) {
                return { error: '이 슬롯을 사용할 수 없습니다.' };
            }
            user.pairPetHatcherySessions = normalizePairPetHatcherySessions(user.pairPetHatcherySessions);
            if (user.pairPetHatcherySessions[slotIndex]) {
                return { error: '이미 부화 중인 슬롯입니다.' };
            }
            if (!user.inventory?.length) return { error: '알이 없습니다.' };
            let eggIdx: number;
            if (hatchItemId) {
                eggIdx = user.inventory.findIndex((it) => it.id === hatchItemId);
                if (eggIdx < 0) return { error: '알을 찾을 수 없습니다.' };
                const cand = user.inventory[eggIdx]!;
                if (!isPairEggItem(cand) || (cand.quantity ?? 1) < 1) {
                    return { error: '부화할 알이 아닙니다.' };
                }
            } else {
                const firstEgg = findFirstHatchablePairEgg(user.inventory);
                eggIdx = firstEgg ? user.inventory.findIndex((it) => it.id === firstEgg.id) : -1;
                if (eggIdx < 0) return { error: '부화할 알이 없습니다.' };
            }
            const egg = user.inventory[eggIdx]!;
            const nextQty = (egg.quantity ?? 1) - 1;
            const afterEgg = [...user.inventory];
            if (nextQty <= 0) afterEgg.splice(eggIdx, 1);
            else afterEgg[eggIdx] = { ...egg, quantity: nextQty };
            user.inventory = afterEgg;
            const eggTid = pairEggTemplateIdForHatch(egg);
            user.pairPetHatcherySessions[slotIndex] = {
                slotIndex,
                startedAt: Date.now(),
                eggItemId: egg.id,
                eggTemplateId: eggTid,
            };
            user.pairPetHatcherySessions = normalizePairPetHatcherySessions(user.pairPetHatcherySessions);
            user.inventory = JSON.parse(JSON.stringify(user.inventory));
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_HATCHERY_START', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'pairPetHatcherySessions']);
            return { clientResponse: { updatedUser } };
        }

        case 'PAIR_PET_HATCHERY_CLAIM': {
            const { slotIndex: rawSi } = payload as { slotIndex?: number };
            const slotIndex = normalizePairHatcherySessionSlotIndex(Number(rawSi));
            if (slotIndex < 0 || slotIndex >= PAIR_HATCHERY_SESSION_SLOT_COUNT) {
                return { error: '유효하지 않은 슬롯입니다.' };
            }
            if (!isPairHatcherySessionSlotIndex(slotIndex)) {
                return { error: '1번 부화 슬롯 또는 VIP 슬롯만 사용할 수 있습니다.' };
            }
            // 완료 수령은 펫을 새로 생성하므로, 캐시된 세션으로 같은 슬롯을 재수령하지 않도록 최신 DB 스냅샷을 기준으로 처리한다.
            const liveSnap = await db.getUser(user.id, { includeInventory: true, includeEquipment: true });
            if (!liveSnap) return { error: '유효하지 않은 사용자입니다.' };
            user.pairPetHatcherySessions = liveSnap.pairPetHatcherySessions;
            user.inventory = liveSnap.inventory;
            if (liveSnap.inventorySlots) user.inventorySlots = liveSnap.inventorySlots;
            if (liveSnap.pairPetLobbyPetSlotCount != null) user.pairPetLobbyPetSlotCount = liveSnap.pairPetLobbyPetSlotCount;
            if (liveSnap.pairPetLobbySlotCount != null) user.pairPetLobbySlotCount = liveSnap.pairPetLobbySlotCount;

            user.pairPetHatcherySessions = normalizePairPetHatcherySessions(user.pairPetHatcherySessions);
            const hatchClaim = findPairHatcherySessionAtSlot(user.pairPetHatcherySessions, slotIndex);
            if (!hatchClaim) return { error: '부화 완료 대기 중인 알이 없습니다.' };
            const { arrayIndex: hatchArrayIndex, session, rewardSlotIndex } = hatchClaim;
            const endAt = hatcheryEndsAt(session.startedAt, rewardSlotIndex, session, user);
            if (Date.now() < endAt) return { error: '아직 부화가 끝나지 않았습니다.' };
            if (isPairLobbyPetInventoryFull(user)) {
                return { error: PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE };
            }
            const def = getPairHatcherySlotDef(rewardSlotIndex, user);
            if (!def) return { error: '유효하지 않은 슬롯입니다.' };
            const petLevel =
                session.eggTemplateId === PAIR_WELCOME_EGG_TEMPLATE_ID
                    ? Math.min(PAIR_PET_MAX_LEVEL, 5)
                    : rollHatchPetLevelFromRule(def.levelRule);
            const petMeta = rollPairPetMetaForHatchAtLevel(petLevel);
            const petTemplate = rollPairPetTemplateId();
            const petItem = makePairPetItem(petTemplate, petMeta);
            if (!user.inventorySlots) {
                user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
            }
            const merged = addItemsToInventory(user.inventory, user.inventorySlots, [petItem], {
                allowMaterialSlotOverflow: true,
            });
            if (!merged.success || !merged.updatedInventory) {
                return { error: PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE };
            }
            user.inventory = merged.updatedInventory;
            user.pairPetHatcherySessions[hatchArrayIndex] = null;
            user.pairPetHatcherySessions = normalizePairPetHatcherySessions(user.pairPetHatcherySessions);
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_HATCHERY_CLAIM');
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'pairPetHatcherySessions']);
            const awardedRow = resolveHatcheryAwardedPetRow(merged, petItem);
            return {
                clientResponse: {
                    updatedUser,
                    obtainedPet: awardedRow,
                },
            };
        }

        case 'PAIR_PET_HATCHERY_CANCEL': {
            const { slotIndex: rawSi } = payload as { slotIndex?: number };
            const slotIndex = normalizePairHatcherySessionSlotIndex(Number(rawSi));
            if (slotIndex < 0 || slotIndex >= PAIR_HATCHERY_SESSION_SLOT_COUNT) {
                return { error: '유효하지 않은 슬롯입니다.' };
            }
            if (!isPairHatcherySessionSlotIndex(slotIndex)) {
                return { error: '1번 부화 슬롯 또는 VIP 슬롯만 사용할 수 있습니다.' };
            }
            user.pairPetHatcherySessions = normalizePairPetHatcherySessions(user.pairPetHatcherySessions);
            const hatchCancel = findPairHatcherySessionAtSlot(user.pairPetHatcherySessions, slotIndex);
            if (!hatchCancel) return { error: '부화 중인 알이 없습니다.' };
            const { arrayIndex: cancelArrayIndex, session: cancelSession, rewardSlotIndex: cancelRewardSlot } =
                hatchCancel;
            const cancelEndAt = hatcheryEndsAt(cancelSession.startedAt, cancelRewardSlot, cancelSession, user);
            if (Date.now() >= cancelEndAt) {
                return { error: '부화가 완료되었습니다. 펫 받기를 사용해 주세요.' };
            }
            const restoreErr = restoreOnePairEgg(
                user,
                cancelSession.eggItemId,
                cancelSession.eggTemplateId,
            );
            if (restoreErr) return { error: restoreErr };
            user.pairPetHatcherySessions[cancelArrayIndex] = null;
            user.pairPetHatcherySessions = normalizePairPetHatcherySessions(user.pairPetHatcherySessions);
            const updatedUserCancel = getSelectiveUserUpdate(user, 'PAIR_PET_HATCHERY_CANCEL', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate: broadcastCancel } = await import('../socket.js');
            broadcastCancel(user, ['inventory', 'pairPetHatcherySessions']);
            return { clientResponse: { updatedUser: updatedUserCancel } };
        }

        case 'PAIR_PET_HATCHERY_INSTANT_FINISH': {
            const { slotIndex: rawSiIf } = payload as { slotIndex?: number };
            const slotIndexIf = normalizePairHatcherySessionSlotIndex(Number(rawSiIf));
            if (slotIndexIf < 0 || slotIndexIf >= PAIR_HATCHERY_SESSION_SLOT_COUNT) {
                return { error: '유효하지 않은 슬롯입니다.' };
            }
            if (!isPairHatcherySessionSlotIndex(slotIndexIf)) {
                return { error: '1번 부화 슬롯 또는 VIP 슬롯만 사용할 수 있습니다.' };
            }
            // getCachedUser TTL로 다이아·인벤·부화 세션이 DB와 어긋나면 잔액 부족 오탐이 날 수 있음
            const liveSnap = await db.getUser(user.id, { includeInventory: true, includeEquipment: true });
            if (!liveSnap) return { error: '유효하지 않은 사용자입니다.' };
            user.diamonds = liveSnap.diamonds;
            user.pairPetHatcherySessions = liveSnap.pairPetHatcherySessions;
            user.inventory = liveSnap.inventory;
            if (liveSnap.inventorySlots) user.inventorySlots = liveSnap.inventorySlots;
            if (liveSnap.pairPetLobbyPetSlotCount != null) user.pairPetLobbyPetSlotCount = liveSnap.pairPetLobbyPetSlotCount;
            if (liveSnap.pairPetLobbySlotCount != null) user.pairPetLobbySlotCount = liveSnap.pairPetLobbySlotCount;

            user.pairPetHatcherySessions = normalizePairPetHatcherySessions(user.pairPetHatcherySessions);
            const hatchInstant = findPairHatcherySessionAtSlot(user.pairPetHatcherySessions, slotIndexIf);
            if (!hatchInstant) return { error: '부화 중인 알이 없습니다.' };
            const {
                arrayIndex: instantArrayIndex,
                session: sessIf,
                rewardSlotIndex: instantRewardSlot,
            } = hatchInstant;
            const startedAtSafe = Math.floor(Number(sessIf.startedAt));
            if (!Number.isFinite(startedAtSafe) || startedAtSafe <= 0) {
                return { error: '유효하지 않은 부화 세션입니다.' };
            }
            const endAtIf = hatcheryEndsAt(startedAtSafe, instantRewardSlot, sessIf, user);
            const nowIf = Date.now();
            if (nowIf >= endAtIf) {
                return { error: '이미 부화가 끝났습니다. 펫 받기를 사용해 주세요.' };
            }
            if (isPairLobbyPetInventoryFull(user)) {
                return { error: PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE };
            }
            const remainMsIf = Math.max(0, endAtIf - nowIf);
            const cost = Math.max(1, Math.ceil(remainMsIf / 60_000));
            const diamondBal = Math.floor(Number(user.diamonds ?? 0));
            const defIf = getPairHatcherySlotDef(instantRewardSlot, user);
            if (!defIf) return { error: '유효하지 않은 슬롯입니다.' };
            const petLevelIf =
                sessIf.eggTemplateId === PAIR_WELCOME_EGG_TEMPLATE_ID
                    ? Math.min(PAIR_PET_MAX_LEVEL, 5)
                    : rollHatchPetLevelFromRule(defIf.levelRule);
            const petMetaIf = rollPairPetMetaForHatchAtLevel(petLevelIf);
            const petTemplateIf = rollPairPetTemplateId();
            const petItemIf = makePairPetItem(petTemplateIf, petMetaIf);
            if (!user.inventorySlots) {
                user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
            }
            if (!user.isAdmin && diamondBal < cost) {
                return { error: '다이아가 부족합니다.' };
            }
            const mergedIf = addItemsToInventory(user.inventory, user.inventorySlots, [petItemIf], {
                allowMaterialSlotOverflow: true,
            });
            if (!mergedIf.success || !mergedIf.updatedInventory) {
                return { error: PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE };
            }
            if (!user.isAdmin) {
                user.diamonds = diamondBal - cost;
                if (user.guildId && cost > 0) {
                    const guildsIf = (await db.getKV<Record<string, any>>('guilds')) || {};
                    const guildSvcMod = await import('../guildService.js');
                    await guildSvcMod.updateGuildMissionProgress(user.guildId, 'diamondsSpent', cost, guildsIf);
                }
            }
            user.inventory = mergedIf.updatedInventory;
            user.pairPetHatcherySessions[instantArrayIndex] = null;
            user.pairPetHatcherySessions = normalizePairPetHatcherySessions(user.pairPetHatcherySessions);
            const updatedUserIf = getSelectiveUserUpdate(user, 'PAIR_PET_HATCHERY_INSTANT_FINISH');
            await db.updateUser(user);
            const { broadcastUserUpdate: broadcastIf } = await import('../socket.js');
            broadcastIf(user, ['inventory', 'pairPetHatcherySessions', 'diamonds']);
            const awardedRowIf = resolveHatcheryAwardedPetRow(mergedIf, petItemIf);
            return {
                clientResponse: {
                    updatedUser: updatedUserIf,
                    obtainedPet: awardedRowIf,
                },
            };
        }

        case 'PAIR_PET_UPGRADE_GRADE': {
            const { mainItemId } = payload as { mainItemId?: string };
            if (!mainItemId) {
                return { error: '유효하지 않은 요청입니다.' };
            }
            user.pairPetTrainingSlots = normalizePairPetTrainingSlots(user.pairPetTrainingSlots);
            const mainIdx = user.inventory.findIndex((it) => it.id === mainItemId);
            if (mainIdx < 0) return { error: '펫을 찾을 수 없습니다.' };
            const main = user.inventory[mainIdx]!;
            if (!isPairPetMaterial(main) || isPairEggItem(main) || (main.quantity ?? 1) < 1) {
                return { error: '등급 강화할 수 있는 펫이 아닙니다.' };
            }
            if (isItemIdInPairTraining(user.pairPetTrainingSlots, mainItemId)) {
                return { error: '수련 중인 펫은 등급 강화할 수 없습니다.' };
            }
            const storedGrade = main.grade ?? ItemGrade.Normal;
            const nextG = nextPairPetGrade(storedGrade);
            if (!nextG) {
                return { error: '더 올릴 수 있는 등급이 없습니다.' };
            }
            const soulTid = pairPetGradeUpgradeSoulTemplateId(storedGrade);
            const soulNeed = pairPetGradeUpgradeSoulStoneCount(storedGrade);
            if (!soulTid || soulNeed == null) {
                return { error: '등급 강화 조건을 확인할 수 없습니다.' };
            }
            const metaMain = readPairPetMetaFromRow(main);
            const needLv = pairPetMinLevelForNextGrade(storedGrade);
            if (metaMain.level < needLv) {
                return { error: `등급 강화는 Lv.${needLv} 이상에서 할 수 있습니다.` };
            }

            const invBefore = JSON.parse(JSON.stringify(user.inventory)) as InventoryItem[];
            const invAfterSoul = consumePairSoulstonesFromInventory(invBefore, soulTid, soulNeed);
            if (!invAfterSoul) {
                return { error: `영혼석이 부족합니다. (${soulNeed}개 필요)` };
            }

            const mainNewIdx = invAfterSoul.findIndex((it) => it.id === mainItemId);
            if (mainNewIdx < 0) return { error: '대상 펫을 찾을 수 없습니다.' };
            const mainAfter = invAfterSoul[mainNewIdx]!;
            const metaResolved = readPairPetMetaFromRow(mainAfter);
            const pairPetMeta = {
                ...metaResolved,
                disposition: bumpPairPetDispositionPctOnGradeUpgrade(metaResolved.disposition),
            };
            invAfterSoul[mainNewIdx] = { ...mainAfter, grade: nextG, pairPetMeta };

            user.inventory = invAfterSoul;
            const eqTid = user.equippedPairPetTemplateId;
            if (
                eqTid != null &&
                !user.inventory.some(
                    (it) => it.templateId === eqTid && isPairPetMaterial(it) && (it.quantity ?? 1) >= 1
                )
            ) {
                user.equippedPairPetTemplateId = null;
                user.equippedPairPetInventoryItemId = null;
            } else {
                reconcileEquippedPairPetInventoryItem(user);
            }

            user.inventory = JSON.parse(JSON.stringify(user.inventory)) as InventoryItem[];
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_UPGRADE_GRADE', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate: broadcastUp } = await import('../socket.js');
            broadcastUp(user, ['inventory', 'equippedPairPetTemplateId', 'equippedPairPetInventoryItemId']);
            return { clientResponse: { updatedUser } };
        }

        case 'PAIR_PET_CONVERT_PET': {
            const { itemId } = payload as { itemId?: string };
            if (!itemId) return { error: '유효하지 않은 요청입니다.' };
            const rowIdx = user.inventory.findIndex((it) => it.id === itemId);
            if (rowIdx < 0) return { error: '아이템을 찾을 수 없습니다.' };
            const row = user.inventory[rowIdx]!;
            if (!isPairPetMaterial(row) || (row.quantity ?? 1) < 1) {
                return { error: '변환할 수 있는 펫이 아닙니다.' };
            }
            user.pairPetTrainingSlots = normalizePairPetTrainingSlots(user.pairPetTrainingSlots);
            if (isItemIdInPairTraining(user.pairPetTrainingSlots, itemId)) {
                return { error: '수련 중인 펫은 변환할 수 없습니다.' };
            }
            const rowTid = row.templateId ?? null;
            const eqTid = user.equippedPairPetTemplateId ?? null;
            const eqRowId = user.equippedPairPetInventoryItemId ?? null;
            const isRepresentativeEquipped =
                Boolean(rowTid && eqTid === rowTid && (!eqRowId || eqRowId === row.id));
            if (isRepresentativeEquipped) {
                return { error: '대표펫으로 장착 중인 펫은 영혼변환할 수 없습니다. 대표펫 해제 후 이용하세요.' };
            }
            const invSnapshot = JSON.parse(JSON.stringify(user.inventory)) as InventoryItem[];
            const nextQty = (row.quantity ?? 1) - 1;
            const afterPet = [...user.inventory];
            if (nextQty <= 0) afterPet.splice(rowIdx, 1);
            else afterPet[rowIdx] = { ...row, quantity: nextQty };
            user.inventory = afterPet;

            const gradeConv = effectivePairPetGradeFromRow(row);
            const metaConv = readPairPetMetaFromRow(row);
            const levelConv = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(metaConv.level) || 1));
            const soulName = pairPetSoulConvertMaterialNameForGrade(gradeConv);
            const soulQty = rollPairPetSoulConvertRewardQuantity(gradeConv, levelConv, Math.random);
            const soulStack = makePairMaterialStack(soulName, soulTemplateIdFromMaterialName(soulName), soulQty);

            if (!user.inventorySlots) {
                user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
            }
            const merged = addItemsToInventory(user.inventory, user.inventorySlots, [soulStack]);
            if (!merged.success || !merged.updatedInventory) {
                user.inventory = invSnapshot;
                return { error: '인벤토리 공간이 부족해 변환 보상을 받을 수 없습니다.' };
            }
            user.inventory = merged.updatedInventory;

            reconcileEquippedPairPetInventoryItem(user);

            recordPairPetSoulConvertForAchievements(user);
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_CONVERT_PET', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'equippedPairPetTemplateId', 'equippedPairPetInventoryItemId', 'quests']);
            // 획득 모달(AppModalLayer ItemObtainedModal) — 이번 변환으로 지급된 영혼석
            return {
                clientResponse: {
                    updatedUser,
                    obtainedItemsBulk: [{ ...soulStack }],
                },
            };
        }

        case 'PAIR_PET_START_TRAINING': {
            const { slotIndex: rawSi, itemId } = payload as { slotIndex?: number; itemId?: string };
            const slotIndex = Math.floor(Number(rawSi));
            if (!itemId || slotIndex < 0 || slotIndex >= PAIR_TRAINING_SLOT_COUNT) {
                return { error: '유효하지 않은 요청입니다.' };
            }
            if (!isPairTrainingSlotUnlocked(user, slotIndex)) {
                return { error: '아직 해금되지 않은 수련 슬롯입니다.' };
            }
            user.pairPetTrainingSlots = normalizePairPetTrainingSlots(user.pairPetTrainingSlots);
            if (user.pairPetTrainingSlots[slotIndex]) {
                const occ = user.pairPetTrainingSlots[slotIndex]!;
                const petIdxOcc = user.inventory.findIndex((it) => it.id === occ.itemId);
                const metaOcc =
                    petIdxOcc >= 0 ? readPairPetMetaFromRow(user.inventory[petIdxOcc]!) : null;
                const endAtOcc = trainingEndsAt(occ.startedAt, slotIndex, metaOcc);
                if (petIdxOcc >= 0 && Date.now() >= endAtOcc) {
                    return {
                        error: '이 슬롯의 수련이 완료되었습니다. 보상을 수령한 뒤 새 수련을 시작해 주세요.',
                    };
                }
                return { error: '이미 수련 중인 슬롯입니다.' };
            }
            const petIdx = user.inventory.findIndex((it) => it.id === itemId);
            if (petIdx < 0) return { error: '펫을 찾을 수 없습니다.' };
            const row = user.inventory[petIdx]!;
            if (!isPairPetMaterial(row) || isPairEggItem(row) || (row.quantity ?? 1) < 1) {
                return { error: '수련에 보낼 수 있는 펫이 아닙니다.' };
            }
            if (isItemIdInPairTraining(user.pairPetTrainingSlots, itemId)) {
                return { error: '이미 다른 슬롯에서 수련 중인 펫입니다.' };
            }
            const eqTid = user.equippedPairPetTemplateId ?? null;
            const eqIid = user.equippedPairPetInventoryItemId ?? null;
            if (eqIid && eqIid === itemId) {
                return { error: '대표로 지정된 펫은 수련에 보낼 수 없습니다. 대표펫을 해제한 뒤 시도해 주세요.' };
            }
            if (!eqIid && eqTid && row.templateId === eqTid) {
                return { error: '대표로 지정된 펫은 수련에 보낼 수 없습니다. 대표펫을 해제한 뒤 시도해 주세요.' };
            }
            const meta = readPairPetMetaFromRow(row);
            const minLv = minPetLevelForTrainingSlot(slotIndex);
            if (meta.level < minLv) {
                return { error: `이 슬롯은 펫 레벨 ${minLv} 이상만 참여할 수 있습니다.` };
            }
            const precomputed = rollPairPetTrainingRewards(slotIndex, meta);
            if (!precomputed) {
                return { error: '수련 설정을 불러올 수 없습니다.' };
            }
            user.pairPetTrainingSlots[slotIndex] = {
                slotIndex,
                itemId,
                startedAt: Date.now(),
                precomputedRewards: precomputed,
            };
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_START_TRAINING');
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['pairPetTrainingSlots']);
            return { clientResponse: { updatedUser } };
        }

        case 'PAIR_PET_CANCEL_TRAINING': {
            const { slotIndex: rawSi } = payload as { slotIndex?: number };
            const slotIndex = Math.floor(Number(rawSi));
            if (slotIndex < 0 || slotIndex >= PAIR_TRAINING_SLOT_COUNT) {
                return { error: '유효하지 않은 요청입니다.' };
            }
            user.pairPetTrainingSlots = normalizePairPetTrainingSlots(user.pairPetTrainingSlots);
            const session = user.pairPetTrainingSlots[slotIndex];
            if (!session) return { error: '취소할 수련이 없습니다.' };
            const petIdxCancel = user.inventory.findIndex((it) => it.id === session.itemId);
            const metaForTimingCancel =
                petIdxCancel >= 0 ? readPairPetMetaFromRow(user.inventory[petIdxCancel]!) : null;
            const endAt = trainingEndsAt(session.startedAt, slotIndex, metaForTimingCancel);
            if (Date.now() >= endAt) {
                return { error: '이미 수련이 완료되어 취소할 수 없습니다. 보상 수령으로 진행해 주세요.' };
            }
            user.pairPetTrainingSlots[slotIndex] = null;
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_CANCEL_TRAINING', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['pairPetTrainingSlots']);
            return { clientResponse: { updatedUser } };
        }

        case 'PAIR_PET_CLAIM_TRAINING': {
            const { slotIndex: rawSi } = payload as { slotIndex?: number };
            const slotIndex = Math.floor(Number(rawSi));
            if (slotIndex < 0 || slotIndex >= PAIR_TRAINING_SLOT_COUNT) {
                return { error: '유효하지 않은 요청입니다.' };
            }
            user.pairPetTrainingSlots = normalizePairPetTrainingSlots(user.pairPetTrainingSlots);
            const session = user.pairPetTrainingSlots[slotIndex];
            if (!session) return { error: '수령할 수련이 없습니다.' };
            const petIdxClaim = user.inventory.findIndex((it) => it.id === session.itemId);
            const metaForTimingClaim =
                petIdxClaim >= 0 ? readPairPetMetaFromRow(user.inventory[petIdxClaim]!) : null;
            const endAt = trainingEndsAt(session.startedAt, slotIndex, metaForTimingClaim);
            if (Date.now() < endAt) return { error: '아직 수련이 끝나지 않았습니다.' };
            const def = getPairTrainingSlotDef(slotIndex);
            if (!def) return { error: '유효하지 않은 슬롯입니다.' };

            const petIdx = petIdxClaim;
            const metaForBonuses = petIdx >= 0 ? readPairPetMetaFromRow(user.inventory[petIdx]!) : neutralTrainingMeta;

            const usePre =
                session.precomputedRewards != null &&
                isValidPairPetTrainingPrecomputedRewards(session.precomputedRewards);
            const rolled = usePre
                ? session.precomputedRewards!
                : rollPairPetTrainingRewards(slotIndex, metaForBonuses);
            if (!rolled) {
                return { error: '수련 보상을 계산할 수 없습니다.' };
            }
            const { goldRoll, goldGain, goldFromSpec, xpRoll, xpGain, xpFromSpec, soulDrop } = rolled;

            if (soulDrop) {
                const soulStack = makePairMaterialStack(
                    soulDrop.materialName,
                    soulTemplateIdFromMaterialName(soulDrop.materialName),
                    soulDrop.quantity
                );
                if (!user.inventorySlots) {
                    user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
                }
                const mergedSoul = addItemsToInventory(user.inventory, user.inventorySlots, [soulStack]);
                if (!mergedSoul.success || !mergedSoul.updatedInventory) {
                    return { error: '인벤토리 공간이 부족해 보상을 받을 수 없습니다.' };
                }
                user.inventory = mergedSoul.updatedInventory;
            }

            user.gold = (user.gold ?? 0) + goldGain;

            const soulDropPublic = soulDrop;

            let pairTrainingClaimSummary: PairTrainingClaimClientSummary;

            if (petIdx >= 0) {
                const petRow = user.inventory[petIdx]!;
                const metaBefore = readPairPetMetaFromRow(petRow);
                const oldLevel = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(metaBefore.level) || 1));
                const initialXp = Math.max(0, Math.floor(metaBefore.xp ?? 0));
                const maxXpForInitialLevel = getPairPetXpRequirementForLevel(oldLevel);
                const meta = { ...readPairPetMetaFromRow(petRow) };
                applyPairPetXp(meta, xpGain, petRow.grade ?? ItemGrade.Normal);
                user.inventory[petIdx] = { ...petRow, pairPetMeta: meta };
                const finalLevel = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(meta.level) || 1));
                const finalXp = Math.max(0, Math.floor(meta.xp ?? 0));
                const petDisplayName = getPairPetDefinition(petRow.templateId!)?.displayName ?? petRow.name;
                const trainingPetLeveledUp = finalLevel > oldLevel;
                const maxXpForBar = trainingPetLeveledUp ? getPairPetXpRequirementForLevel(finalLevel) : maxXpForInitialLevel;
                const initialXpForBar = trainingPetLeveledUp ? 0 : initialXp;
                const safeTrainingPetMax =
                    Number.isFinite(maxXpForBar) && maxXpForBar > 0
                        ? maxXpForBar
                        : trainingPetLeveledUp
                          ? 1
                          : Number.isFinite(maxXpForInitialLevel) && maxXpForInitialLevel > 0
                            ? maxXpForInitialLevel
                            : 100;
                const trainingCoreDelta = diffPairPetLevelUpCoreBonuses(
                    metaBefore.levelUpCoreBonuses,
                    meta.levelUpCoreBonuses,
                );
                const trainingHasCoreDelta = Object.values(trainingCoreDelta).some(
                    (v) => typeof v === 'number' && v !== 0,
                );
                pairTrainingClaimSummary = {
                    goldGain,
                    goldBase: goldRoll,
                    goldFromSpecialization: goldFromSpec,
                    xpGain,
                    xpBase: xpRoll,
                    xpFromSpecialization: xpFromSpec,
                    soulDrop: soulDropPublic,
                    petImage: petRow.image ?? null,
                    petDisplayName,
                    pairPetXp: { change: xpGain },
                    pairPetLevel: {
                        initial: oldLevel,
                        final: finalLevel,
                        progress: {
                            initial: initialXpForBar,
                            final: finalXp,
                            max: safeTrainingPetMax,
                        },
                    },
                    ...(trainingHasCoreDelta ? { pairPetLevelUpCoreBonuses: trainingCoreDelta } : {}),
                };
            } else {
                pairTrainingClaimSummary = {
                    goldGain,
                    goldBase: goldRoll,
                    goldFromSpecialization: goldFromSpec,
                    xpGain,
                    xpBase: xpRoll,
                    xpFromSpecialization: xpFromSpec,
                    soulDrop: soulDropPublic,
                    petImage: null,
                    petDisplayName: null,
                    pairPetXp: null,
                    pairPetLevel: null,
                };
            }

            user.pairPetTrainingSlots[slotIndex] = null;
            recordPairPetTrainingClaimForAchievements(user);

            /** `fieldMap`의 inventory·gold·pairPetTrainingSlots만 반환 — `includeAll`은 전체 User 깊은 복제·대용량 HTTP 응답·클라이언트 mergeUserState 비용을 불필요하게 키움 */
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_CLAIM_TRAINING');
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'gold', 'pairPetTrainingSlots', 'quests']);
            return { clientResponse: { updatedUser, pairTrainingClaimSummary } };
        }

        case 'PAIR_PET_RESYNC_TRAINING_SLOTS': {
            user.pairPetTrainingSlots = normalizePairPetTrainingSlots(user.pairPetTrainingSlots);
            const repaired = repairInProgressGhostPairPetTrainingSessions(user);
            if (repaired) {
                await db.updateUser(user);
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['pairPetTrainingSlots']);
            }
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_RESYNC_TRAINING_SLOTS');
            return { clientResponse: { updatedUser } };
        }

        case 'PAIR_PET_EXPAND_LOBBY_SLOTS': {
            const { category } = payload as { category?: 'pet' | 'egg' };
            if (category !== 'pet' && category !== 'egg') {
                return { error: '확장할 인벤 종류가 올바르지 않습니다.' };
            }
            const currentRaw = category === 'pet' ? user.pairPetLobbyPetSlotCount : user.pairPetLobbyEggSlotCount;
            const current = pairPetLobbyInventorySlots(currentRaw);
            if (current >= PAIR_PET_LOBBY_INV_MAX_SLOTS) {
                return { error: '슬롯을 더 이상 확장할 수 없습니다.' };
            }
            const cost = pairPetLobbyExpandDiamondCost(current);
            if (!user.isAdmin) {
                if (user.diamonds < cost) {
                    return { error: '다이아가 부족합니다.' };
                }
                user.diamonds -= cost;
                if (user.guildId) {
                    const guilds = await db.getKV<Record<string, any>>('guilds') || {};
                    const guildSvcMod = await import('../guildService.js');
                    await guildSvcMod.updateGuildMissionProgress(user.guildId, 'diamondsSpent', cost, guilds);
                }
            }
            const next = Math.min(PAIR_PET_LOBBY_INV_MAX_SLOTS, current + PAIR_PET_LOBBY_INV_EXPAND_STEP);
            if (category === 'pet') user.pairPetLobbyPetSlotCount = next;
            else user.pairPetLobbyEggSlotCount = next;
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_EXPAND_LOBBY_SLOTS', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(
                user,
                category === 'pet' ? ['pairPetLobbyPetSlotCount', 'diamonds'] : ['pairPetLobbyEggSlotCount', 'diamonds']
            );
            return { clientResponse: { updatedUser } };
        }

        default:
            return { error: 'Unknown social action.' };
    }
};

// 매칭 알고리즘: 실제 공통 모드 기준으로 가장 비슷한 랭킹 점수 유저 매칭
const RANKED_MATCH_ACCEPT_WINDOW_MS = 30_000;

function findRankedMatchProposalForUser(
    volatileState: VolatileState,
    userId: string,
): { proposalId: string; prop: NonNullable<VolatileState['rankedMatchProposals']>[string] } | null {
    const props = volatileState.rankedMatchProposals;
    if (!props) return null;
    for (const [proposalId, prop] of Object.entries(props)) {
        if (prop.user1Id === userId || prop.user2Id === userId) return { proposalId, prop };
    }
    return null;
}

function cloneRankedQueueEntry(entry: RankedQueueEntry): RankedQueueEntry {
    return {
        ...entry,
        selectedModes: [...entry.selectedModes],
        modeRatings: entry.modeRatings ? { ...entry.modeRatings } : undefined,
    };
}

function restoreAcceptedUsersToRankedQueue(
    volatileState: VolatileState,
    prop: NonNullable<VolatileState['rankedMatchProposals']>[string],
): string[] {
    const requeuedUserIds: string[] = [];
    if (!prop.acceptUser1 && !prop.acceptUser2) return requeuedUserIds;

    if (!volatileState.rankedMatchingQueue) volatileState.rankedMatchingQueue = { strategic: {} };
    if (!volatileState.rankedMatchingQueue.strategic) volatileState.rankedMatchingQueue.strategic = {};
    const queue = volatileState.rankedMatchingQueue.strategic;

    const restoreOne = (userId: string, accepted: boolean, queueEntry: RankedQueueEntry | undefined) => {
        if (!accepted || !queueEntry) return;
        requeuedUserIds.push(userId);
        queue[userId] = {
            ...cloneRankedQueueEntry(queueEntry),
            startTime: queueEntry.startTime,
            matchPriority: (queueEntry.matchPriority ?? 0) + 1,
        };
    };

    restoreOne(prop.user1Id, prop.acceptUser1, prop.user1QueueEntry);
    restoreOne(prop.user2Id, prop.acceptUser2, prop.user2QueueEntry);

    if (requeuedUserIds.length > 0) {
        broadcast({ type: 'RANKED_MATCHING_UPDATE', payload: { queue: volatileState.rankedMatchingQueue } });
        void tryMatchPlayers(volatileState, 'strategic');
    }
    return requeuedUserIds;
}

function abortRankedMatchProposal(
    volatileState: VolatileState,
    proposalId: string,
    options?: { requeueAcceptedUsers?: boolean },
): void {
    const prop = volatileState.rankedMatchProposals?.[proposalId];
    if (!prop) return;
    const requeueAcceptedUsers = options?.requeueAcceptedUsers !== false;
    const requeuedUserIds = requeueAcceptedUsers ? restoreAcceptedUsersToRankedQueue(volatileState, prop) : [];
    delete volatileState.rankedMatchProposals![proposalId];
    broadcast({
        type: 'RANKED_MATCH_PROPOSAL_CANCELLED',
        payload: { userIds: [prop.user1Id, prop.user2Id], proposalId, requeuedUserIds },
    });
}

export function expireStaleRankedMatchProposals(volatileState: VolatileState, nowMs: number): void {
    const props = volatileState.rankedMatchProposals;
    if (!props) return;
    for (const [proposalId, prop] of Object.entries(props)) {
        const deadline = prop.acceptDeadlineAt ?? prop.createdAt + RANKED_MATCH_ACCEPT_WINDOW_MS;
        if (nowMs <= deadline) continue;
        if (prop.acceptUser1 && prop.acceptUser2) continue;
        abortRankedMatchProposal(volatileState, proposalId);
    }
}

async function buildRankedMatchProposalPayload(
    volatileState: VolatileState,
    proposalId: string,
    prop: NonNullable<VolatileState['rankedMatchProposals']>[string],
) {
    const player1 = await db.getUser(prop.user1Id);
    const player2 = await db.getUser(prop.user2Id);
    if (!player1 || !player2) return null;
    const { calculateEloChange } = await import('../summaryService.js');
    const player1Rating = getRankedRatingForMode(player1, prop.selectedMode);
    const player2Rating = getRankedRatingForMode(player2, prop.selectedMode);
    return {
        proposalId,
        acceptDeadlineAt: prop.acceptDeadlineAt ?? prop.createdAt + RANKED_MATCH_ACCEPT_WINDOW_MS,
        selectedMode: prop.selectedMode,
        player1: {
            id: player1.id,
            nickname: player1.nickname,
            rating: player1Rating,
            winChange: calculateEloChange(player1Rating, player2Rating, 'win'),
            lossChange: calculateEloChange(player1Rating, player2Rating, 'loss'),
            accepted: prop.acceptUser1,
        },
        player2: {
            id: player2.id,
            nickname: player2.nickname,
            rating: player2Rating,
            winChange: calculateEloChange(player2Rating, player1Rating, 'win'),
            lossChange: calculateEloChange(player2Rating, player1Rating, 'loss'),
            accepted: prop.acceptUser2,
        },
    };
}

function broadcastRankedMatchProposal(volatileState: VolatileState, proposalId: string): void {
    void (async () => {
        const prop = volatileState.rankedMatchProposals?.[proposalId];
        if (!prop) return;
        const payload = await buildRankedMatchProposalPayload(volatileState, proposalId, prop);
        if (!payload) {
            abortRankedMatchProposal(volatileState, proposalId);
            return;
        }
        broadcast({ type: 'RANKED_MATCH_PROPOSAL', payload });
    })();
}

async function openRankedStrategicMatchProposal(
    volatileState: VolatileState,
    lobbyType: RankedLobbyType,
    entry1: RankedQueueEntry,
    entry2: RankedQueueEntry,
    selectedMode: GameMode,
): Promise<void> {
    const player1 = await db.getUser(entry1.userId);
    const player2 = await db.getUser(entry2.userId);
    if (!player1 || !player2) {
        const queue = volatileState.rankedMatchingQueue?.[lobbyType];
        if (queue) {
            if (!player1) delete queue[entry1.userId];
            if (!player2) delete queue[entry2.userId];
        }
        broadcast({ type: 'RANKED_MATCHING_UPDATE', payload: { queue: volatileState.rankedMatchingQueue } });
        return;
    }

    const proposalId = randomUUID();
    const createdAt = Date.now();
    const acceptDeadlineAt = createdAt + RANKED_MATCH_ACCEPT_WINDOW_MS;
    if (!volatileState.rankedMatchProposals) volatileState.rankedMatchProposals = {};
    volatileState.rankedMatchProposals[proposalId] = {
        user1Id: entry1.userId,
        user2Id: entry2.userId,
        lobbyType,
        selectedMode,
        acceptUser1: false,
        acceptUser2: false,
        createdAt,
        acceptDeadlineAt,
        user1QueueEntry: cloneRankedQueueEntry(entry1),
        user2QueueEntry: cloneRankedQueueEntry(entry2),
    };

    if (volatileState.rankedMatchingQueue?.[lobbyType]) {
        delete volatileState.rankedMatchingQueue[lobbyType][entry1.userId];
        delete volatileState.rankedMatchingQueue[lobbyType][entry2.userId];
    }

    const payload = await buildRankedMatchProposalPayload(volatileState, proposalId, volatileState.rankedMatchProposals[proposalId]);
    if (!payload) {
        abortRankedMatchProposal(volatileState, proposalId);
        return;
    }
    broadcast({ type: 'RANKED_MATCH_PROPOSAL', payload });
    broadcast({ type: 'RANKED_MATCHING_UPDATE', payload: { queue: volatileState.rankedMatchingQueue } });
}

async function finalizeRankedStrategicMatchGame(
    volatileState: VolatileState,
    prop: NonNullable<VolatileState['rankedMatchProposals']>[string],
    proposalId: string,
    player1: User,
    player2: User,
): Promise<{ ok: true; gameId: string } | { ok: false; error: string }> {
    const selectedMode = prop.selectedMode;
    const matchNowMs = Date.now();
    await applyPassiveActionPointRegenToUser(player1, matchNowMs);
    await applyPassiveActionPointRegenToUser(player2, matchNowMs);
    const rankedAp1 = effectiveStrategicRankedQueueApCostForUser(player1);
    const rankedAp2 = effectiveStrategicRankedQueueApCostForUser(player2);
    if ((!player1.isAdmin && player1.actionPoints.current < rankedAp1) || (!player2.isAdmin && player2.actionPoints.current < rankedAp2)) {
        return { ok: false, error: '행동력이 부족해 매칭을 진행할 수 없습니다.' };
    }
    if (!player1.isAdmin && rankedAp1 > 0) {
        recordActionPointSpend(player1, rankedAp1, matchNowMs);
    }
    if (!player2.isAdmin && rankedAp2 > 0) {
        recordActionPointSpend(player2, rankedAp2, matchNowMs);
    }
    await db.updateUser(player1);
    await db.updateUser(player2);
    broadcastUserUpdate(player1, ['actionPoints', 'lastActionPointUpdate']);
    broadcastUserUpdate(player2, ['actionPoints', 'lastActionPointUpdate']);

    const { getRankedGameSettings } = await import('../../constants/rankedGameSettings.js');
    const settings = sanitizePvpGameSettings(selectedMode, getRankedGameSettings(selectedMode), { isAiGame: false });
    const negotiation: Negotiation = {
        id: `neg-ranked-${randomUUID()}`,
        challenger: player1,
        opponent: player2,
        mode: selectedMode,
        settings,
        proposerId: player1.id,
        status: 'pending',
        turnCount: 0,
        deadline: Date.now(),
        isRanked: true,
    };

    const { initializeGame } = await import('../gameModes.js');
    const game = await initializeGame(negotiation);
    await db.saveGame(game);

    delete volatileState.rankedMatchProposals![proposalId];
    broadcast({
        type: 'RANKED_MATCH_PROPOSAL_CANCELLED',
        payload: { userIds: [prop.user1Id, prop.user2Id], proposalId },
    });

    setInGameUserStatusForArena(volatileState, game.player1.id, game);
    setInGameUserStatusForArena(volatileState, game.player2.id, game);

    const { calculateEloChange } = await import('../summaryService.js');
    const player1Rating = getRankedRatingForMode(player1, selectedMode);
    const player2Rating = getRankedRatingForMode(player2, selectedMode);
    const player1WinChange = calculateEloChange(player1Rating, player2Rating, 'win');
    const player1LossChange = calculateEloChange(player1Rating, player2Rating, 'loss');
    const player2WinChange = calculateEloChange(player2Rating, player1Rating, 'win');
    const player2LossChange = calculateEloChange(player2Rating, player1Rating, 'loss');

    broadcast({
        type: 'RANKED_MATCH_FOUND',
        payload: {
            gameId: game.id,
            player1: {
                id: player1.id,
                nickname: player1.nickname,
                rating: player1Rating,
                winChange: player1WinChange,
                lossChange: player1LossChange,
            },
            player2: {
                id: player2.id,
                nickname: player2.nickname,
                rating: player2Rating,
                winChange: player2WinChange,
                lossChange: player2LossChange,
            },
        },
    });

    const { broadcastToGameParticipants, broadcastLiveGameToList } = await import('../socket.js');
    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
    broadcastLiveGameToList(game);
    broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
    broadcast({ type: 'RANKED_MATCHING_UPDATE', payload: { queue: volatileState.rankedMatchingQueue } });
    return { ok: true, gameId: game.id };
}

export const tryMatchPlayers = async (volatileState: VolatileState, lobbyType: RankedLobbyType): Promise<void> => {
    if (rankedMatchingLocks[lobbyType]) return;
    rankedMatchingLocks[lobbyType] = true;
    try {
        await tryMatchPlayersUnlocked(volatileState, lobbyType);
    } finally {
        rankedMatchingLocks[lobbyType] = false;
    }
};

const tryMatchPlayersUnlocked = async (volatileState: VolatileState, lobbyType: RankedLobbyType): Promise<void> => {
    expireStaleRankedMatchProposals(volatileState, Date.now());
    const queue = volatileState.rankedMatchingQueue?.[lobbyType];
    if (!queue || Object.keys(queue).length < 2) return;

    let queueChanged = false;
    for (const [userId, entry] of Object.entries(queue)) {
        const status = volatileState.userStatuses[userId];
        if (!entry || !Array.isArray(entry.selectedModes) || entry.selectedModes.length === 0) {
            delete queue[userId];
            queueChanged = true;
            continue;
        }
        if (status?.status === UserStatus.InGame || status?.status === UserStatus.Negotiating) {
            delete queue[userId];
            queueChanged = true;
            continue;
        }
        if (findRankedMatchProposalForUser(volatileState, userId)) {
            delete queue[userId];
            queueChanged = true;
        }
    }
    if (queueChanged) {
        broadcast({ type: 'RANKED_MATCHING_UPDATE', payload: { queue: volatileState.rankedMatchingQueue } });
    }
    if (Object.keys(queue).length < 2) return;

    const entries = Object.values(queue).filter(
        (entry) => !findRankedMatchProposalForUser(volatileState, entry.userId),
    );
    if (entries.length < 2) return;
    
    // 모든 가능한 쌍을 확인하여 가장 비슷한 점수 차이의 쌍 찾기
    let bestMatch: {
        player1: typeof entries[0];
        player2: typeof entries[0];
        selectedMode: GameMode;
        scoreDiff: number;
        prioritySum: number;
        pairMaxPriority: number;
    } | null = null;
    
    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            const entry1 = entries[i];
            const entry2 = entries[j];
            
            // 공통 모드가 있는지 확인
            const commonModes = entry1.selectedModes.filter(m => entry2.selectedModes.includes(m));
            if (commonModes.length === 0) continue;
            
            for (const mode of commonModes) {
                const scoreDiff = Math.abs(getEntryRatingForMode(entry1, mode) - getEntryRatingForMode(entry2, mode));
                if (scoreDiff > RANKED_MATCH_MAX_RATING_DIFF) continue;

                const prioritySum = entry1.selectedModes.indexOf(mode) + entry2.selectedModes.indexOf(mode);
                const olderStart = Math.min(entry1.startTime, entry2.startTime);
                const pairMaxPriority = Math.max(entry1.matchPriority ?? 0, entry2.matchPriority ?? 0);
                const bestOlderStart = bestMatch ? Math.min(bestMatch.player1.startTime, bestMatch.player2.startTime) : Infinity;
                const bestMaxPriority = bestMatch?.pairMaxPriority ?? -1;
                if (
                    !bestMatch ||
                    scoreDiff < bestMatch.scoreDiff ||
                    (scoreDiff === bestMatch.scoreDiff && prioritySum < bestMatch.prioritySum) ||
                    (scoreDiff === bestMatch.scoreDiff &&
                        prioritySum === bestMatch.prioritySum &&
                        pairMaxPriority > bestMaxPriority) ||
                    (scoreDiff === bestMatch.scoreDiff &&
                        prioritySum === bestMatch.prioritySum &&
                        pairMaxPriority === bestMaxPriority &&
                        olderStart < bestOlderStart)
                ) {
                    bestMatch = { player1: entry1, player2: entry2, selectedMode: mode, scoreDiff, prioritySum, pairMaxPriority };
                }
            }
        }
    }
    
    if (!bestMatch) return;
    
    const { player1: entry1, player2: entry2, selectedMode } = bestMatch;
    await openRankedStrategicMatchProposal(volatileState, lobbyType, entry1, entry2, selectedMode);
};