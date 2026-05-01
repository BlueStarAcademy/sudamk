import { randomUUID } from 'crypto';
import * as db from '../db.js';
import { type ServerAction, type User, type VolatileState, ChatMessage, UserStatus, type Negotiation, TournamentType, GameMode } from '../../types/index.js';
import * as types from '../../types/index.js';
import { updateQuestProgress } from './../questService.js';
import { containsProfanity } from '../../profanity.js';
import * as tournamentService from '../tournamentService.js';
import * as summaryService from '../summaryService.js';
import { broadcast, broadcastToUserIds } from '../socket.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, NO_CONTEST_MOVE_THRESHOLD, RANKED_ELO_BASE_SCORE, RANKED_MATCH_MAX_RATING_DIFF, DEFAULT_GAME_SETTINGS } from '../../constants/index.js';
import { clearAiSession } from '../aiSessionManager.js';
import { aiUserId, getAiUser } from '../aiPlayer.js';
import { getSelectiveUserUpdate } from '../utils/userUpdateHelper.js';
import { requireArenaEntranceOpen } from '../arenaEntranceService.js';
import { releaseIpBindingForUser } from '../ipLoginPolicy.js';
import { initializeGame } from '../gameModes.js';
import { MATERIAL_ITEMS } from '../../shared/constants/items.js';
import { addItemsToInventory } from '../../utils/inventoryUtils.js';
import type { InventoryItem } from '../../types/index.js';
import { clampPairRoomTitle } from '../../shared/constants/pairArena.js';
import {
    buildTeamPreservingPairTurnOrder,
    getPairHumanParticipantIds,
    PAIR_GO_GAME_MODES,
} from '../../shared/utils/pairGameTurn.js';
import { enrichPairRoomsForClientPayload } from '../utils/pairRoomClientPayload.js';
import {
    rollPairPetSoulConvertRewardQuantity,
    pairPetSoulConvertMaterialNameForGrade,
} from '../../shared/utils/pairPetSoulConvert.js';
import {
    PAIR_PET_SHOP_SKUS,
    PAIR_EGG_TEMPLATE_ID,
    PAIR_EGG_MATERIAL_NAME,
    PAIR_SOULSTONE_NAMES,
    PAIR_PET_LOBBY_INV_EXPAND_STEP,
    PAIR_PET_LOBBY_INV_MAX_SLOTS,
    pairPetLobbyInventorySlots,
    pairPetLobbyExpandDiamondCost,
    rollPairPetTemplateId,
    getPairPetDefinition,
    getPairPetDisplayName,
    isPairPetMaterial,
    isPairEggItem,
    isPairSoulStoneItem,
    pairSoulTierFromMaterialName,
    pairSoulTemplateIdFromTier,
} from '../../shared/constants/petLobby.js';
import {
    resolvePairPetMetaFromInventoryRow,
    rollPairPetMetaForHatch,
    rollPairPetMetaForHatchAtLevel,
    rollSingleLevelUpCoreBonuses,
} from '../../shared/utils/pairPetRoll.js';
import { getEquippedPairPetInventoryRow, reconcileEquippedPairPetInventoryItem } from '../../shared/utils/pairEquippedPet.js';
import { getXpRequirementForLevel } from '../../shared/utils/strategyLevelXp.js';
import {
    KATA_SERVER_LEVEL_BY_PROFILE_STEP,
    resolveAiLobbyProfileStepFromSettings,
} from '../../shared/utils/strategicAiDifficulty.js';
import { isSameDayKST } from '../../shared/utils/timeUtils.js';
import {
    PAIR_TRAINING_SLOT_COUNT,
    getPairTrainingSlotDef,
    isItemIdInPairTraining,
    isPairTrainingSlotUnlocked,
    minPetLevelForTrainingSlot,
    normalizePairPetTrainingSlots,
    trainingEndsAt,
} from '../../shared/constants/pairTraining.js';
import {
    PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE,
    PAIR_HATCHERY_SESSION_SLOT_COUNT,
    canUnlockPairHatcherySlot,
    canUsePairHatcherySlot,
    getPairHatcherySlotDef,
    hatcheryEndsAt,
    normalizePairPetHatcherySessions,
    normalizePairPetHatcherySlotUnlocked,
    rollHatchPetLevelFromRule,
} from '../../shared/constants/pairHatchery.js';
import type { PairPetMeta } from '../../types/index.js';
import { CoreStat, ItemGrade } from '../../types/enums.js';
import type { PairPetCoreStatsSix } from '../../shared/constants/pairArena.js';
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
import type { PairPetCoreStatsSix } from '../../shared/constants/pairArena.js';

const soulTemplateIdFromMaterialName = (materialName: string): string =>
    pairSoulTemplateIdFromTier(pairSoulTierFromMaterialName(materialName));

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
const restoreOnePairEgg = (user: User, eggItemId?: string): string | null => {
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
    const merged = addItemsToInventory(inv, user.inventorySlots, [
        makePairMaterialStack(PAIR_EGG_MATERIAL_NAME, PAIR_EGG_TEMPLATE_ID, 1),
    ]);
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
    disposition: { kind: 'all', pct: 0 },
    specialization: { kind: 'trainingXp', pct: 0 },
    levelUpCoreBonuses: {},
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

function rollInclusive(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
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
        const need = getXpRequirementForLevel(level);
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

function trainingGoldMultiplier(meta: PairPetMeta): number {
    return meta.specialization.kind === 'trainingGold' ? 1 + meta.specialization.pct / 100 : 1;
}

function trainingXpMultiplier(meta: PairPetMeta): number {
    return meta.specialization.kind === 'trainingXp' ? 1 + meta.specialization.pct / 100 : 1;
}

function trainingSoulChance(meta: PairPetMeta, baseChance: number): number {
    const extra = meta.specialization.kind === 'soulDrop' ? meta.specialization.pct / 100 : 0;
    return Math.min(0.999, Math.max(0, baseChance + extra));
}

function rollSoulDropForSlot(slotIndex: number, meta: PairPetMeta): { materialName: string; quantity: number } | null {
    const def = getPairTrainingSlotDef(slotIndex);
    if (!def) return null;
    const p = trainingSoulChance(meta, def.soulDropChance);
    if (Math.random() >= p) return null;
    const table = def.soulTable;
    const totalW = table.reduce((s, r) => s + r.weight, 0);
    if (totalW <= 0) return null;
    let t = Math.random() * totalW;
    for (const row of table) {
        t -= row.weight;
        if (t <= 0) return { materialName: row.materialName, quantity: row.quantity };
    }
    const last = table[table.length - 1]!;
    return { materialName: last.materialName, quantity: last.quantity };
}

type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
};

type RankedLobbyType = 'strategic' | 'playful';
type RankedQueueEntry = NonNullable<NonNullable<VolatileState['rankedMatchingQueue']>[RankedLobbyType]>[string];

const GREETINGS = ['안녕', '하이', '헬로', 'hi', 'hello', '반가', '잘 부탁', '잘부탁'];
const rankedMatchingLocks: Record<RankedLobbyType, boolean> = { strategic: false, playful: false };
const PAIR_MODE_DEFAULT_GAME_MODE: GameMode = GameMode.Standard;
const pairModeOrDefault = (mode: unknown): GameMode =>
    typeof mode === 'string' && PAIR_GO_GAME_MODES.includes(mode as GameMode)
        ? (mode as GameMode)
        : PAIR_MODE_DEFAULT_GAME_MODE;
const FRIEND_LIMIT = 30;

const broadcastPairRooms = (volatileState: VolatileState) => {
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

/** 1번 방부터 순번; 삭제된 번호는 새 방이 앞 번호부터 채움(현재 존재하는 방의 code 기준). */
function allocPairRoomCode(pairRooms: Record<string, types.PairRoomState>): string {
    const used = new Set<number>();
    for (const r of Object.values(pairRooms)) {
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

/**
 * 대기/준비 중 페어 방에서 유저 제거(방장이면 방 삭제, 파트너면 슬롯 비움). 경기 중 껍데기 방은 건드리지 않음.
 * @returns 방 목록을 변경했으면 true
 */
export function leavePairWaitingRoomIfPresent(volatileState: VolatileState, userId: string): boolean {
    if (!volatileState.pairRooms) return false;
    const target = Object.values(volatileState.pairRooms).find((room) => userInActivePairLobbyRoom(room, userId));
    if (!target) return false;
    abortPairRankedPetProposalsForRoom(volatileState, target.id);
    if (target.ownerId === userId) {
        clearPairInvitesForRoom(volatileState, target.id);
        clearPairRoomTeamChatStore(volatileState, target.id);
        delete volatileState.pairRooms[target.id];
    } else {
        if (target.partnerId === userId) {
            target.partnerId = undefined;
            target.partnerName = undefined;
            target.partnerReady = false;
        }
        if (target.extraPairMembers?.some((m) => m.id === userId)) {
            target.extraPairMembers = target.extraPairMembers.filter((m) => m.id !== userId);
        }
        target.pairSeatAssignments = {
            teamA: (target.pairSeatAssignments?.teamA ?? [target.ownerId]).filter((id) => id !== userId),
            teamB: (target.pairSeatAssignments?.teamB ?? []).filter((id) => id !== userId),
        };
        target.matchStartedAt = undefined;
        refreshPairRoomTeams(target);
        if (countPairRoomHumanUsers(target) === 0) {
            clearPairInvitesForRoom(volatileState, target.id);
            clearPairRoomTeamChatStore(volatileState, target.id);
            delete volatileState.pairRooms[target.id];
        }
    }
    broadcastPairRooms(volatileState);
    broadcastPairPartnerInvites(volatileState);
    return true;
}

const PAIR_PARTNER_INVITE_TTL_MS = 30_000;

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

function hasUsableEquippedPairPet(user: User): boolean {
    reconcileEquippedPairPetInventoryItem(user);
    return Boolean(user.equippedPairPetTemplateId && getEquippedPairPetInventoryRow(user));
}

const buildPairTeams = (room: types.PairRoomState): { teamA: types.PairTeamState; teamB: types.PairTeamState } => {
    const ownerReady = room.ownerReady;
    const partnerReady = room.partnerReady;
    const extraMembers = Array.isArray(room.extraPairMembers) ? room.extraPairMembers : [];
    if (room.roomKind === 'ai_duel') {
        const opponent = extraMembers[0];
        return {
            teamA: {
                id: 'teamA',
                name: '우리 펫 페어',
                members: [
                    { id: room.ownerId, name: room.ownerName, kind: 'user', slot: 'owner', ready: ownerReady },
                    { id: `pet-ai-${room.ownerId}`, name: room.partnerName || '나의 펫', kind: 'pet', slot: 'ownerPet', ready: true },
                ],
            },
            teamB: {
                id: 'teamB',
                name: opponent ? '상대 펫 페어' : '상대 팀',
                members: opponent
                    ? [
                          { id: opponent.id, name: opponent.name, kind: 'user', slot: 'partner', ready: Boolean(opponent.ready) },
                          { id: `pet-ai-${opponent.id}`, name: `${opponent.name}의 펫`, kind: 'pet', slot: 'opponentPet', ready: true },
                      ]
                    : [],
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

function getPairRoomUserTeamId(room: types.PairRoomState, userId: string): 'teamA' | 'teamB' | null {
    const teams = buildPairTeams(room);
    if (teams.teamA.members.some((m) => m.kind === 'user' && m.id === userId)) return 'teamA';
    if (teams.teamB.members.some((m) => m.kind === 'user' && m.id === userId)) return 'teamB';
    return null;
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

/** 방장이 방 종류 변경 시 모드·파트너 슬롯을 맞춤 */
function applyPairRoomKindTransition(room: types.PairRoomState, normalizedKind: 'ai_duel' | 'duo_match' | 'friendly_4p') {
    const effectiveMode: 'pvp' | 'ai' = normalizedKind === 'ai_duel' ? 'ai' : 'pvp';
    room.roomKind = normalizedKind;
    room.mode = effectiveMode;
    room.pairMode = effectiveMode;
    room.ownerReady = false;
    delete room.pairSeatAssignments;
    if (effectiveMode === 'ai') {
        room.extraPairMembers = undefined;
        room.partnerId = `pet-ai-${room.ownerId}`;
        room.partnerName = '내 펫';
        room.partnerReady = true;
        room.futurePetAi = pairPetAiPlaceholder();
        return;
    }
    room.futurePetAi = undefined;
    room.extraPairMembers = undefined;
    if (room.partnerId && String(room.partnerId).startsWith('pet-ai-')) {
        room.partnerId = undefined;
        room.partnerName = undefined;
    }
    room.partnerReady = !room.partnerId ? normalizedKind === 'friendly_4p' : false;
}

const buildPairGameSettings = (room: types.PairRoomState): types.GameSettings => {
    const syncedRoom = refreshPairRoomTeams({ ...room, teamA: { ...room.teamA, members: [...room.teamA.members] }, teamB: { ...room.teamB, members: [...room.teamB.members] } });
    return {
        ...room.settings,
        pairGame: {
            roomId: syncedRoom.id,
            pairMode:
                syncedRoom.roomKind === 'ai_duel' && (syncedRoom.extraPairMembers?.length ?? 0) > 0
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
};

const buildRankedPairPetGameSettings = (roomA: types.PairRoomState, ownerA: User, roomB: types.PairRoomState, ownerB: User): types.GameSettings => {
    return {
        ...roomA.settings,
        pairGame: {
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
        settings.pairGame.teamB = {
            name: '상대 AI 팀',
            members: [
                { id: 'pair-opponent-ai', name: '상대 AI', kind: 'ai' as const, slot: 'opponentAi' },
                { id: 'pair-opponent-pet', name: '상대 펫 AI', kind: 'pet' as const, slot: 'opponentPet' },
            ],
        };
        const profileStep = resolveAiLobbyProfileStepFromSettings(room.settings || {});
        const step = Math.max(1, Math.min(10, Math.round(profileStep)));
        const kataLevel = KATA_SERVER_LEVEL_BY_PROFILE_STEP[step] ?? -31;
        settings.pairGame.pairKataFixedLevelByParticipantId = {
            'pair-opponent-ai': kataLevel,
            'pair-opponent-pet': kataLevel,
        };
    }
    return settings;
};

const makeDuoPairAiDuelSettings = (room: types.PairRoomState): types.GameSettings => {
    const partnerId = room.partnerId && !isPetAiId(room.partnerId) ? room.partnerId : null;
    const partnerName = room.partnerName || '파트너';
    const settings: types.GameSettings = {
        ...room.settings,
        pairGame: {
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
                    { id: 'pair-opponent-pet', name: '상대 펫 AI', kind: 'pet' as const, slot: 'opponentPet' },
                ],
            },
        },
    };
    if (settings.pairGame) {
        const profileStep = resolveAiLobbyProfileStepFromSettings(room.settings || {});
        const step = Math.max(1, Math.min(10, Math.round(profileStep)));
        const kataLevel = KATA_SERVER_LEVEL_BY_PROFILE_STEP[step] ?? -31;
        settings.pairGame.pairKataFixedLevelByParticipantId = {
            'pair-opponent-ai': kataLevel,
            'pair-opponent-pet': kataLevel,
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

function pairPetKataStatsFromEquippedPet(user: User): PairPetCoreStatsSix | null {
    const row = getEquippedPairPetInventoryRow(user);
    if (!row) return null;
    const meta = readPairPetMetaFromRow(row);
    const grade = effectivePairPetGradeFromRow(row);
    const rawBaseNoLvl = Math.round(50 * pairPetStatMultiplierFromGrade(grade));
    const valueFor = (stat: CoreStat): number => {
        const lvl = meta.levelUpCoreBonuses?.[stat] ?? 0;
        const base = rawBaseNoLvl + lvl;
        const bonus =
            meta.disposition.kind === 'all'
                ? Math.round((rawBaseNoLvl * meta.disposition.pct) / 100)
                : meta.disposition.kind === 'single' && meta.disposition.stat === stat
                  ? Math.round((rawBaseNoLvl * meta.disposition.pct) / 100)
                  : 0;
        return base + bonus;
    };
    return {
        concentration: valueFor(CoreStat.Concentration),
        thinkingSpeed: valueFor(CoreStat.ThinkingSpeed),
        judgment: valueFor(CoreStat.Judgment),
        calculation: valueFor(CoreStat.Calculation),
        combatPower: valueFor(CoreStat.CombatPower),
        stability: valueFor(CoreStat.Stability),
    };
}

function configurePairClassicGameStart(
    game: types.LiveGameSession,
    ownerUser: User,
    petStatUsers: User[] = [ownerUser],
): void {
    if (!PAIR_GO_GAME_MODES.includes(game.mode) || !game.settings?.pairGame) return;
    const pairGame = game.settings.pairGame;
    const turnOrder = buildTeamPreservingPairTurnOrder(pairGame);
    pairGame.turnOrder = turnOrder;
    pairGame.currentTurnIndex = 0;
    pairGame.passSeatIds = [];
    pairGame.orderSeededAt = Date.now();
    pairGame.orderRevealConfirmed = {};
    for (const id of getPairHumanParticipantIds(pairGame)) {
        pairGame.orderRevealConfirmed[id] = false;
    }
    const petStatsByUserPetId = new Map<string, PairPetCoreStatsSix>();
    for (const petOwner of petStatUsers) {
        const stats = pairPetKataStatsFromEquippedPet(petOwner);
        if (stats) petStatsByUserPetId.set(`pet-ai-${petOwner.id}`, stats);
    }
    pairGame.petKataStatsByParticipantId = {};
    for (const seat of turnOrder) {
        if (seat.kind === 'pet' || seat.kind === 'ai') {
            pairGame.petKataStatsByParticipantId[seat.participantId] =
                petStatsByUserPetId.get(seat.participantId) ??
                (seat.slot === 'ownerPet' ? petStatsByUserPetId.get(`pet-ai-${ownerUser.id}`) : undefined) ??
                {
                    concentration: 100,
                    thinkingSpeed: 100,
                    judgment: 100,
                    calculation: 100,
                    combatPower: 100,
                    stability: 100,
                };
        }
    }
    if (pairGame.pairKataFixedLevelByParticipantId) {
        pairGame.pairKataFixedLevelByParticipantId = Object.fromEntries(
            Object.entries(pairGame.pairKataFixedLevelByParticipantId).filter(([participantId]) =>
                turnOrder.some((seat) => seat.participantId === participantId),
            ),
        );
    }
    const black1 = turnOrder.find((s) => s.seatId === 'black1') ?? turnOrder.find((s) => s.player === types.Player.Black);
    const white1 = turnOrder.find((s) => s.seatId === 'white1') ?? turnOrder.find((s) => s.player === types.Player.White);
    game.blackPlayerId = black1?.participantId ?? game.blackPlayerId;
    game.whitePlayerId = white1?.participantId ?? game.whitePlayerId;
    const usesModePreGameFlow = game.mode === GameMode.Capture || game.mode === GameMode.Base;
    if (!usesModePreGameFlow) {
        game.currentPlayer = types.Player.None;
        game.gameStatus = 'pair_order_reveal';
        game.preGameConfirmations = { ...(pairGame.orderRevealConfirmed ?? {}) };
        game.revealEndTime = undefined;
    }
}

const getRankedRatingForMode = (user: Pick<User, 'stats'> | null | undefined, mode: GameMode): number => {
    const rating = user?.stats?.[mode]?.rankingScore;
    return Number.isFinite(rating) ? Number(rating) : RANKED_ELO_BASE_SCORE;
};

const getEntryRatingForMode = (entry: RankedQueueEntry, mode: GameMode): number => {
    const modeRating = entry.modeRatings?.[mode];
    if (Number.isFinite(modeRating)) return Number(modeRating);
    return Number.isFinite(entry.rating) ? Number(entry.rating) : RANKED_ELO_BASE_SCORE;
};

/**
 * PVP 인게임 유저가 로그아웃하거나 마지막 WebSocket이 끊긴 경우: 즉시 disconnectionState·GAME_UPDATE.
 * AI/싱글/탑은 false (로그아웃 시 별도 삭제 로직).
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

    const isAiGame = game.isSinglePlayer || game.gameCategory === 'tower' || game.isAiGame;
    if (isAiGame) return false;

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
    return true;
}

async function openPairRankedPetMatchProposal(
    volatileState: VolatileState,
    bestMatch: { a: { room: types.PairRoomState; owner: User }; b: { room: types.PairRoomState; owner: User } },
): Promise<void> {
    const { room: roomA, owner: ownerA } = bestMatch.a;
    const { room: roomB, owner: ownerB } = bestMatch.b;
    const selectedMode = pairModeOrDefault(roomA.selectedGameMode);
    const player1Rating = getRankedRatingForMode(ownerA, selectedMode);
    const player2Rating = getRankedRatingForMode(ownerB, selectedMode);
    const proposalId = randomUUID();
    if (!volatileState.pairRankedPetProposals) volatileState.pairRankedPetProposals = {};
    volatileState.pairRankedPetProposals[proposalId] = {
        roomAId: roomA.id,
        roomBId: roomB.id,
        ownerAId: ownerA.id,
        ownerBId: ownerB.id,
        acceptOwnerA: false,
        acceptOwnerB: false,
        createdAt: Date.now(),
    };
    roomA.pairRankedPetProposal = {
        proposalId,
        opponentOwnerId: ownerB.id,
        opponentNickname: ownerB.nickname,
        myRating: player1Rating,
        opponentRating: player2Rating,
        myAccepted: false,
        peerAccepted: false,
    };
    roomB.pairRankedPetProposal = {
        proposalId,
        opponentOwnerId: ownerA.id,
        opponentNickname: ownerA.nickname,
        myRating: player2Rating,
        opponentRating: player1Rating,
        myAccepted: false,
        peerAccepted: false,
    };
    refreshPairRoomTeams(roomA);
    refreshPairRoomTeams(roomB);
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

    volatileState.userStatuses[ownerA.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id };
    volatileState.userStatuses[ownerB.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id };

    const player1Rating = getRankedRatingForMode(ownerA, selectedMode);
    const player2Rating = getRankedRatingForMode(ownerB, selectedMode);
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
    if (!volatileState.pairRooms) return null;
    const candidates = Object.values(volatileState.pairRooms)
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
            const diff = Math.abs(getRankedRatingForMode(a.owner, modeA) - getRankedRatingForMode(b.owner, modeA));
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

    await openPairRankedPetMatchProposal(volatileState, bestMatch);
    return null;
}

export const handleSocialAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type } = action;
    const payload = (action as { payload?: unknown }).payload as any;
    const now = Date.now();

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
                    const isAiGame = game.isSinglePlayer || game.gameCategory === 'tower' || game.isAiGame;
                    if (!game.disconnectionState) {
                        if (!isAiGame) {
                            await applyPvpInGameDisconnect(volatileState, user.id);
                        } else {
                            // 도전의 탑, 싱글플레이, AI 게임에서는 로그아웃 시 게임 삭제
                            console.log(`[Logout] Deleting AI game ${activeGameId} for user ${user.nickname}`);
                            
                            // 사용자 상태에서 gameId 제거
                            if (volatileState.userStatuses[user.id]) {
                                delete volatileState.userStatuses[user.id].gameId;
                                volatileState.userStatuses[user.id].status = UserStatus.Waiting;
                            }
                            
                            // AI 세션 정리
                            clearAiSession(activeGameId);
                            
                            // 게임 삭제
                            await db.deleteGame(activeGameId);
                            if (volatileState.gameChats) delete volatileState.gameChats[activeGameId];
                            // 게임 삭제 브로드캐스트
                            broadcast({ type: 'GAME_DELETED', payload: { gameId: activeGameId } });
                        }
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
        
            const { channel, text, emoji, location } = payload;
            if (!channel || (!text && !emoji)) return { error: 'Invalid chat message.' };

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
                    
                    // 금지 메시지도 브로드캐스트
                    broadcast({ 
                        type: 'WAITING_ROOM_CHAT_UPDATE', 
                        payload: { 
                            [channel]: volatileState.waitingRoomChats[channel] 
                        } 
                    });
                    
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

            // 채팅 메시지를 모든 클라이언트에 브로드캐스트
            broadcast({ 
                type: 'WAITING_ROOM_CHAT_UPDATE', 
                payload: { 
                    [channel]: volatileState.waitingRoomChats[channel] 
                } 
            });

            return {};
        }
        case 'SET_USER_STATUS': {
            const { status } = payload as { status: UserStatus | string };
            if (status !== UserStatus.Waiting && status !== 'waiting' && status !== UserStatus.Resting && status !== 'resting') {
                return { error: 'Invalid status for waiting room.' };
            }
            const nextStatus: UserStatus =
                status === UserStatus.Resting || status === 'resting' ? UserStatus.Resting : UserStatus.Waiting;
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
            const { mode } = payload;
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
                    if (currentStatus.waitingLobby === mode) {
                        return {};
                    }
                } else if (currentStatus.mode === mode) {
                    return {}; // 이미 같은 모드 대기실에 있음
                }
            }
            
            // strategic/playful: GameMode 대신 waitingLobby로 로비 구분 (클라이언트 목록 분리)
            if (mode === 'strategic' || mode === 'playful') {
                volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, waitingLobby: mode };
            } else {
                volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, mode: mode as GameMode };
            }
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            return {};
        }
        case 'LEAVE_WAITING_ROOM': {
            const userStatus = volatileState.userStatuses[user.id];
            if (userStatus && (userStatus.status === UserStatus.Waiting || userStatus.status === UserStatus.Resting)) {
                userStatus.status = UserStatus.Online;
                delete userStatus.mode; // 대기실 모드 정보 제거
                delete userStatus.waitingLobby;
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
            const { gameId } = payload;
            const game = await db.getLiveGame(gameId);
            if (!game) {
                // 경기 종료 직후 GC/정리로 이미 삭제된 게임이어도
                // 나가기 버튼은 성공 처리되어 클라이언트 대기실 리다이렉트가 진행되어야 한다.
                const userStatus = volatileState.userStatuses[user.id];
                if (userStatus) {
                    userStatus.status = UserStatus.Online;
                    delete userStatus.gameId;
                    delete userStatus.spectatingGameId;
                    delete userStatus.mode;
                    delete userStatus.waitingLobby;
                } else {
                    volatileState.userStatuses[user.id] = { status: UserStatus.Online };
                }
                broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
                return {};
            }

            if (volatileState.userStatuses[user.id]) {
                const isPairGameLeave = Boolean((game.settings as { pairGame?: unknown } | undefined)?.pairGame);
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
                        volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, waitingLobby: lobbyMode };
                    } else {
                        volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, mode: lobbyMode as GameMode };
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
            
            // 두 플레이어가 모두 나갔고 관전자도 없으면 게임 삭제
            if (bothPlayersLeft && !hasSpectators) {
                // 리매치 협상이 진행 중인지 확인
                const isRematchBeingNegotiated = Object.values(volatileState.negotiations).some(
                    neg => neg.rematchOfGameId === gameId
                );
                
                if (!isRematchBeingNegotiated) {
                    console.log(`[GC] Deleting game ${gameId} - both players left and no spectators`);
                    clearAiSession(gameId);
                    await db.deleteGame(gameId);
                    if (volatileState.gameChats) delete volatileState.gameChats[gameId];
                    // 게임 삭제를 클라이언트에 알리기 위해 GAME_DELETED 브로드캐스트
                    broadcast({ type: 'GAME_DELETED', payload: { gameId } });
                }
            }
            
            return {};
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
                } else {
                    if (lobbyMode === 'strategic' || lobbyMode === 'playful') {
                        volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, waitingLobby: lobbyMode };
                    } else {
                        volatileState.userStatuses[user.id] = { status: UserStatus.Waiting, mode: lobbyMode as GameMode };
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
            volatileState.userStatuses[user.id] = { status: UserStatus.Spectating, spectatingGameId: gameId, mode: game.mode };
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
            const gateKey = lobbyType === 'strategic' ? 'strategicLobby' : 'playfulLobby';
            const rankedGate = await requireArenaEntranceOpen(user.isAdmin, gateKey, user);
            if (!rankedGate.ok) return { error: rankedGate.error };
            
            // 이미 매칭 중이면 에러
            if (volatileState.rankedMatchingQueue?.[lobbyType]?.[user.id]) {
                return { error: '이미 매칭 중입니다.' };
            }
            
            // 선택된 모드가 없으면 에러
            if (!selectedModes || selectedModes.length === 0) {
                return { error: '최소 1개 이상의 게임 모드를 선택해주세요.' };
            }
            
            // 믹스룰 제외 확인
            if (selectedModes.includes(GameMode.Mix)) {
                return { error: '믹스룰은 랭킹전에서 사용할 수 없습니다.' };
            }
            
            // 사용자 랭킹 점수 계산: 큐에는 전체 선택 모드별 점수를 함께 저장
            const userStats = user.stats || {};
            const firstMode = selectedModes[0];
            const userRating = userStats[firstMode]?.rankingScore || RANKED_ELO_BASE_SCORE;
            const modeRatings = selectedModes.reduce<Partial<Record<GameMode, number>>>((acc, mode) => {
                acc[mode] = userStats[mode]?.rankingScore || RANKED_ELO_BASE_SCORE;
                return acc;
            }, {});
            
            // 매칭 큐 초기화
            if (!volatileState.rankedMatchingQueue) {
                volatileState.rankedMatchingQueue = { strategic: {}, playful: {} };
            }
            if (!volatileState.rankedMatchingQueue[lobbyType]) {
                volatileState.rankedMatchingQueue[lobbyType] = {};
            }
            
            // 매칭 큐에 추가
            volatileState.rankedMatchingQueue[lobbyType][user.id] = {
                userId: user.id,
                lobbyType,
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
            await tryMatchPlayers(volatileState, lobbyType);
            
            // HTTP 응답에 매칭 정보 포함 (즉시 상태 업데이트를 위해)
            return { 
                clientResponse: { 
                    success: true,
                    matchingInfo: {
                        startTime: now,
                        lobbyType,
                        selectedModes
                    }
                } 
            };
        }
        
        case 'CANCEL_RANKED_MATCHING': {
            // 매칭 큐에서 제거
            if (volatileState.rankedMatchingQueue) {
                for (const lobbyType of ['strategic', 'playful'] as const) {
                    if (volatileState.rankedMatchingQueue[lobbyType]?.[user.id]) {
                        delete volatileState.rankedMatchingQueue[lobbyType][user.id];
                    }
                }
            }
            
            broadcast({ type: 'RANKED_MATCHING_UPDATE', payload: { queue: volatileState.rankedMatchingQueue } });
            
            return { clientResponse: { success: true } };
        }
        case 'PAIR_SYNC': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            if (!volatileState.pairPartnerInvites) volatileState.pairPartnerInvites = {};
            tickPairPartnerInviteExpiry(volatileState);
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
        case 'PAIR_SET_LOBBY_SCREEN': {
            const { active } = payload as { active?: unknown };
            const on = active === true;
            if (!volatileState.userStatuses[user.id]) {
                volatileState.userStatuses[user.id] = { status: UserStatus.Online };
            }
            const base = volatileState.userStatuses[user.id];
            if (on) {
                volatileState.userStatuses[user.id] = { ...base, inPairLobby: true };
            } else {
                const next = { ...base } as types.UserStatusInfo;
                delete (next as { inPairLobby?: boolean }).inPairLobby;
                volatileState.userStatuses[user.id] = next;
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
            if (room.roomKind !== 'duo_match' && room.roomKind !== 'friendly_4p' && room.roomKind !== 'ai_duel') return { error: '이 방 형태에서는 초대할 수 없습니다.' };
            const hasRealPartner = room.partnerId && !String(room.partnerId).startsWith('pet-ai-');
            const humanCount = countPairRoomHumanUsers(room);
            if (room.roomKind === 'duo_match' && hasRealPartner && humanCount >= 2) {
                return { error: '이미 파트너가 있는 방입니다.' };
            }
            if (room.roomKind === 'ai_duel') {
                if (humanCount >= 2) {
                    return { error: '이미 상대가 있는 펫 페어 방입니다.' };
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
            if (room.roomKind === 'ai_duel' && !hasUsableEquippedPairPet(targetUser)) {
                return { error: '상대가 대표 펫을 장착해야 펫 페어에 초대할 수 있습니다.' };
            }

            const friendIds = toFriendArray(user.friendIds);
            const isFriend = friendIds.includes(targetUserId);
            const isGuild = Boolean(user.guildId && user.guildId === targetUser.guildId);
            const inPairLobby = Boolean(volatileState.userStatuses[targetUserId]?.inPairLobby);
            if (!isFriend && !isGuild && !inPairLobby) {
                return { error: '전체 목록에서는 페어 경기장에 있는 유저만 초대할 수 있습니다. 친구·길드원은 다른 화면에서도 초대할 수 있습니다.' };
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
            if (target.roomKind === 'ai_duel') {
                if (!hasUsableEquippedPairPet(user)) {
                    broadcastPairPartnerInvites(volatileState);
                    return { error: '대표 펫을 장착해야 펫 페어 방에 입장할 수 있습니다.' };
                }
                if (countPairRoomHumanUsers(target) >= 2) {
                    broadcastPairPartnerInvites(volatileState);
                    return { error: '이미 상대가 있는 펫 페어 방입니다.' };
                }
            }
            if (target.roomKind === 'friendly_4p' && countPairRoomHumanUsers(target) >= 4) {
                broadcastPairPartnerInvites(volatileState);
                return { error: '방이 가득 찼습니다.' };
            }

            if (target.roomKind === 'ai_duel') {
                target.extraPairMembers = [{ id: user.id, name: user.nickname, ready: false }];
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
            const teamA = [...(target.pairSeatAssignments?.teamA ?? [target.ownerId])].filter((id) => id !== user.id);
            const teamB = [...(target.pairSeatAssignments?.teamB ?? [])].filter((id) => id !== user.id);
            const destTeam = inv.targetTeam === 'teamB' ? 'teamB' : 'teamA';
            const dest = destTeam === 'teamB' ? teamB : teamA;
            const index = inv.targetIndex === 0 || inv.targetIndex === 1 ? inv.targetIndex : 1;
            dest.splice(Math.min(index, dest.length), 0, user.id);
            target.pairSeatAssignments = { teamA: teamA.slice(0, 2), teamB: teamB.slice(0, 2) };
            refreshPairRoomTeams(target);
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
            const { mode: payloadMode, title, roomKind, visibility, password } = payload as {
                mode?: 'pvp' | 'ai';
                title?: string;
                roomKind?: 'ai_duel' | 'duo_match' | 'friendly_4p';
                visibility?: 'public' | 'private';
                password?: string;
            };
            const existing = Object.values(volatileState.pairRooms).find((room) => userInActivePairLobbyRoom(room, user.id));
            if (existing) return { error: '이미 참여 중인 페어 방이 있습니다.' };
            const normalizedVisibility = visibility === 'private' ? 'private' : 'public';
            const normalizedKind = roomKind ?? (payloadMode === 'ai' ? 'ai_duel' : 'duo_match');
            const effectiveMode: 'pvp' | 'ai' = normalizedKind === 'ai_duel' ? 'ai' : 'pvp';
            const normalizedPassword = typeof password === 'string' ? password.trim() : '';
            if (normalizedVisibility === 'private' && normalizedPassword.length < 2) {
                return { error: '비공개방 비밀번호는 2자 이상이어야 합니다.' };
            }
            if (normalizedKind === 'ai_duel' && !hasUsableEquippedPairPet(user)) {
                return { error: '펫 페어 방을 만들려면 페어 펫을 장착해야 합니다.' };
            }
            const ownerPairPetName = normalizedKind === 'ai_duel' ? equippedPairPetDisplayNameForUser(user) : undefined;

            const roomId = `pair-room-${randomUUID()}`;
            const code = allocPairRoomCode(volatileState.pairRooms);
            const defaultTitleSuffix =
                normalizedKind === 'friendly_4p' ? '4인 친선' : normalizedKind === 'ai_duel' ? '펫' : '2인';
            const room: types.PairRoomState = {
                id: roomId,
                code,
                mode: effectiveMode,
                pairMode: effectiveMode,
                roomKind: normalizedKind,
                visibility: normalizedVisibility,
                passwordProtected: normalizedVisibility === 'private',
                phase: 'waiting',
                title:
                    clampPairRoomTitle(title) ||
                    clampPairRoomTitle(`${user.nickname}님의 ${defaultTitleSuffix} 페어방`),
                ownerId: user.id,
                ownerName: user.nickname,
                partnerId: effectiveMode === 'ai' ? `pet-ai-${user.id}` : undefined,
                partnerName: effectiveMode === 'ai' ? ownerPairPetName : undefined,
                selectedGameMode: PAIR_MODE_DEFAULT_GAME_MODE,
                settings: { ...DEFAULT_GAME_SETTINGS },
                teamA: { id: 'teamA', name: '우리 팀', members: [] },
                teamB: { id: 'teamB', name: '상대 팀', members: [] },
                futurePetAi: effectiveMode === 'ai' ? pairPetAiPlaceholder() : undefined,
                ownerReady: false,
                partnerReady: effectiveMode === 'ai' || normalizedKind === 'friendly_4p',
                createdAt: Date.now(),
                pairChatMessages: [],
                ...(effectiveMode === 'pvp' ? { pairSeatAssignments: { teamA: [user.id], teamB: [] as string[] } } : {}),
            };
            (room as any).roomPassword = normalizedVisibility === 'private' ? normalizedPassword : undefined;
            volatileState.pairRooms[roomId] = refreshPairRoomTeams(room);
            broadcastPairRooms(volatileState);
            return {
                clientResponse: {
                    pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
                    pairRoomChatHistory: { [roomId]: mergePairChatHistoriesForViewer(volatileState.pairRooms[roomId]!, volatileState, user.id) },
                },
            };
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
            if (target.roomKind === 'ai_duel') {
                if (!hasUsableEquippedPairPet(user)) return { error: '대표 펫을 장착해야 펫 페어 방에 입장할 수 있습니다.' };
                if (countPairRoomHumanUsers(target) >= 2) return { error: '이미 상대가 있는 펫 페어 방입니다.' };
                target.extraPairMembers = [{ id: user.id, name: user.nickname, ready: false }];
                target.pairSeatAssignments = { teamA: [target.ownerId], teamB: [user.id] };
                refreshPairRoomTeams(target);
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
            if (target.partnerId) return { error: '이미 파트너가 입장한 방입니다.' };
            target.partnerId = user.id;
            target.partnerName = user.nickname;
            target.partnerReady = false;
            target.pairSeatAssignments = { teamA: [target.ownerId, user.id], teamB: [] };
            refreshPairRoomTeams(target);
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
            const shellOnly = Object.values(volatileState.pairRooms).find(
                (room) =>
                    room.ownerId === user.id ||
                    room.partnerId === user.id ||
                    (room.extraPairMembers ?? []).some((m) => m.id === user.id),
            );
            if (shellOnly && pairRoomShellInGame(shellOnly)) {
                return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
            }
            leavePairWaitingRoomIfPresent(volatileState, user.id);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_SET_READY': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const { ready } = payload as { ready: boolean };
            const target = Object.values(volatileState.pairRooms).find((room) => userInActivePairLobbyRoom(room, user.id));
            if (!target) return { error: '참여 중인 페어 방이 없습니다.' };
            if (target.pairRankedPetProposal) return { error: '매칭 수락 대기 중에는 준비 상태를 바꿀 수 없습니다.' };
            if (target.ownerId === user.id) target.ownerReady = Boolean(ready);
            if (target.partnerId === user.id) target.partnerReady = Boolean(ready);
            if (target.extraPairMembers?.some((m) => m.id === user.id)) {
                target.extraPairMembers = target.extraPairMembers.map((m) =>
                    m.id === user.id ? { ...m, ready: Boolean(ready) } : m,
                );
            }
            refreshPairRoomTeams(target);
            broadcastPairRooms(volatileState);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_SET_ROOM_KIND': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const { roomKind } = payload as { roomKind?: 'ai_duel' | 'duo_match' | 'friendly_4p' };
            const target = Object.values(volatileState.pairRooms).find((room) => room.ownerId === user.id && !pairRoomShellInGame(room));
            if (!target) return { error: '방장만 방 종류를 변경할 수 있습니다.' };
            if (target.ownerId !== user.id) return { error: '방장만 방 종류를 변경할 수 있습니다.' };
            if (target.phase === 'in_game' || target.phase === 'matching' || target.pairRankedPetProposal) {
                return { error: '매칭·대국 중에는 방 종류를 변경할 수 없습니다.' };
            }
            refreshPairRoomTeams(target);
            const normalizedKind =
                roomKind === 'ai_duel' || roomKind === 'duo_match' || roomKind === 'friendly_4p' ? roomKind : 'friendly_4p';
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
            if (
                target.roomKind === 'friendly_4p' &&
                (normalizedKind === 'duo_match' || normalizedKind === 'ai_duel') &&
                countPairRoomHumanUsers(target) >= 3
            ) {
                return { error: '4인 친선 방에 유저가 3명 이상일 때는 2인 페어·펫 페어로 변경할 수 없습니다.' };
            }
            applyPairRoomKindTransition(target, normalizedKind);
            if (normalizedKind === 'ai_duel') {
                target.partnerName = equippedPairPetDisplayNameForUser(user);
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
        case 'PAIR_START_MATCH': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const target = Object.values(volatileState.pairRooms).find((room) => userInActivePairLobbyRoom(room, user.id));
            if (!target) return { error: '참여 중인 페어 방이 없습니다.' };
            if (target.ownerId !== user.id) return { error: '방장만 매칭을 시작할 수 있습니다.' };
            if (target.roomKind === 'friendly_4p') return { error: '친선 4인 페어 대국은 현재 준비 중입니다.' };
            if (!target.partnerId) return { error: '파트너가 아직 입장하지 않았습니다.' };
            const requestedMode = pairModeOrDefault((payload as { mode?: GameMode } | undefined)?.mode ?? target.selectedGameMode);
            target.selectedGameMode = requestedMode;
            target.settings = {
                ...DEFAULT_GAME_SETTINGS,
                ...target.settings,
                ...((payload as { settings?: types.GameSettings } | undefined)?.settings &&
                typeof (payload as { settings?: types.GameSettings }).settings === 'object'
                    ? (payload as { settings?: types.GameSettings }).settings
                    : {}),
            };
            if (target.roomKind === 'ai_duel') {
                const opponent = target.extraPairMembers?.[0];
                if (opponent) {
                    const opponentUser = await db.getUser(opponent.id);
                    if (!opponentUser || !hasUsableEquippedPairPet(opponentUser)) {
                        return { error: '상대가 대표 펫을 장착해야 펫 페어 친선전을 시작할 수 있습니다.' };
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
                    };
                    const game = await initializeGame(negotiation);
                    configurePairClassicGameStart(game, user, [user, partnerUser]);
                    await db.saveGame(game);
                    volatileState.userStatuses[game.player1.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id };
                    volatileState.userStatuses[game.player2.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id };
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
                if (!hasUsableEquippedPairPet(user)) return { error: '펫 페어 매칭을 시작하려면 페어 펫을 장착해야 합니다.' };
                target.pairPetMatchingQueuedAt = Date.now();
                target.phase = 'matching';
                target.ownerReady = true;
                target.partnerReady = true;
                target.matchStartedAt = undefined;
                refreshPairRoomTeams(target);
                await tryMatchPairPetRankedRooms(volatileState);
                broadcastPairRooms(volatileState);
                return {
                    clientResponse: {
                        matching: true,
                        pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms),
                    },
                };
            }
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
            };
            const game = await initializeGame(negotiation);
            configurePairClassicGameStart(game, user);
            await db.saveGame(game);
            volatileState.userStatuses[game.player1.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id };
            volatileState.userStatuses[game.player2.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id };
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
            if (target.ownerId !== user.id) return { error: '방장만 매칭을 취소할 수 있습니다.' };
            if (target.roomKind !== 'ai_duel') return { error: '펫 페어 방에서만 사용할 수 있습니다.' };
            if (target.pairRankedPetProposal) {
                abortPairRankedPetProposalsForRoom(volatileState, target.id);
                return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
            }
            if (target.phase !== 'matching') return { error: '매칭 중이 아닙니다.' };
            delete target.pairPetMatchingQueuedAt;
            target.phase = 'waiting';
            refreshPairRoomTeams(target);
            broadcastPairRooms(volatileState);
            return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
        }
        case 'PAIR_RESPOND_PAIR_PET_RANKED_MATCH': {
            if (!volatileState.pairRooms) volatileState.pairRooms = {};
            const { proposalId, accept } = payload as { proposalId?: string; accept?: boolean };
            if (!proposalId || typeof accept !== 'boolean') return { error: '요청이 올바르지 않습니다.' };
            const prop = volatileState.pairRankedPetProposals?.[proposalId];
            if (!prop) return { error: '이미 처리되었거나 만료된 매칭입니다.' };
            if (user.id !== prop.ownerAId && user.id !== prop.ownerBId) return { error: '이 매칭에 참가할 수 없습니다.' };
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
            else prop.acceptOwnerB = true;
            if (user.id === prop.ownerAId) {
                roomA.pairRankedPetProposal.myAccepted = true;
                roomB.pairRankedPetProposal.peerAccepted = true;
            } else {
                roomB.pairRankedPetProposal.myAccepted = true;
                roomA.pairRankedPetProposal.peerAccepted = true;
            }
            broadcastPairRooms(volatileState);
            if (!prop.acceptOwnerA || !prop.acceptOwnerB) {
                return { clientResponse: { pairRooms: enrichPairRoomsForClientPayload(volatileState.pairRooms) } };
            }
            const ownerA = await db.getUser(prop.ownerAId);
            const ownerB = await db.getUser(prop.ownerBId);
            if (!ownerA || !ownerB || !hasUsableEquippedPairPet(ownerA) || !hasUsableEquippedPairPet(ownerB)) {
                abortPairRankedPetProposalsForRoom(volatileState, roomA.id);
                return { error: '페어 펫 장착이 해제되어 매칭이 취소되었습니다.' };
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
            const target = Object.values(volatileState.pairRooms).find((room) => userInActivePairLobbyRoom(room, user.id));
            if (!target) return { error: '참여 중인 페어 방이 없습니다.' };
            if (target.ownerId !== user.id) return { error: '방장만 AI 대전을 시작할 수 있습니다.' };
            if (target.roomKind !== 'ai_duel' && target.roomKind !== 'duo_match') {
                return { error: '펫 페어 또는 2인 페어 방에서만 AI 대전을 시작할 수 있습니다.' };
            }
            const isPetPairAiDuel = target.roomKind === 'ai_duel';
            const isDuoPairAiDuel = target.roomKind === 'duo_match';
            if (isPetPairAiDuel && !hasUsableEquippedPairPet(user)) {
                return { error: 'AI 대전을 시작하려면 페어 펫을 장착해야 합니다.' };
            }
            if (isPetPairAiDuel && (target.extraPairMembers?.length ?? 0) > 0) {
                return { error: '상대가 입장한 펫 페어 방에서는 친선 대국을 시작해 주세요.' };
            }
            if (isDuoPairAiDuel) {
                const duoPartner = getDuoPairAiPartner(target);
                if (!duoPartner) return { error: '파트너가 입장한 뒤 AI 대전을 시작할 수 있습니다.' };
                if (!duoPartner.ready) return { error: '파트너 준비완료 후 AI 대전을 시작할 수 있습니다.' };
                target.partnerId = duoPartner.id;
                target.partnerName = duoPartner.name;
                target.partnerReady = true;
                target.extraPairMembers = (target.extraPairMembers ?? []).filter((m) => m.id !== duoPartner.id);
                target.pairSeatAssignments = { teamA: [target.ownerId, duoPartner.id], teamB: [] };
            }

            target.ownerReady = true;
            if (isPetPairAiDuel) {
                target.partnerId = target.partnerId || `pet-ai-${target.ownerId}`;
                target.partnerName = target.partnerName || '내 펫';
            }
            target.partnerReady = true;
            refreshPairRoomTeams(target);

            const requestedMode = payload?.mode as GameMode | undefined;
            const selectedMode = requestedMode && SPECIAL_GAME_MODES.some((m) => m.mode === requestedMode)
                ? requestedMode
                : PAIR_MODE_DEFAULT_GAME_MODE;
            target.selectedGameMode = selectedMode;
            target.settings = {
                ...DEFAULT_GAME_SETTINGS,
                ...(payload?.settings && typeof payload.settings === 'object' ? payload.settings : target.settings),
                scoringTurnLimit: 0,
            };
            delete (target.settings as any).autoScoringTurns;

            const partnerUser = isDuoPairAiDuel
                ? await db.getUser(target.partnerId!)
                : getAiUser(selectedMode);
            if (!partnerUser) return { error: '파트너 정보를 찾지 못했습니다.' };
            const pairSettings = isDuoPairAiDuel
                ? makeDuoPairAiDuelSettings(target)
                : makePairPetAiDuelSettings(target);
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
            };
            const game = await initializeGame(negotiation);
            configurePairClassicGameStart(game, user);
            await db.saveGame(game);
            volatileState.userStatuses[game.player1.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id };
            volatileState.userStatuses[game.player2.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id };
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
        case 'FRIEND_SYNC': {
            const me = ensureFriendFields(user);
            return { clientResponse: { friendState: getFriendSnapshot(me) } };
        }
        case 'FRIEND_SEND_REQUEST': {
            const { targetUserId } = payload as { targetUserId: string };
            if (!targetUserId || targetUserId === user.id) return { error: '자기 자신에게 친구 요청을 보낼 수 없습니다.' };
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 유저를 찾을 수 없습니다.' };
            const me = ensureFriendFields(user);
            const target = ensureFriendFields(targetUser);
            if ((me.friendIds || []).includes(target.id)) return { error: '이미 친구입니다.' };
            if ((me.friendIds || []).length >= FRIEND_LIMIT) return { error: `친구는 최대 ${FRIEND_LIMIT}명까지 등록할 수 있습니다.` };
            if ((target.friendIds || []).length >= FRIEND_LIMIT) return { error: '상대 친구 목록이 가득 찼습니다.' };
            me.outgoingFriendRequestIds = uniquePush(me.outgoingFriendRequestIds || [], target.id);
            target.incomingFriendRequestIds = uniquePush(target.incomingFriendRequestIds || [], me.id);
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
            if (entry.dailyLimit <= 1 && purchaseQty !== 1) {
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
            } else {
                stack = makePairMaterialStack(entry.materialName, soulTemplateIdFromMaterialName(entry.materialName), grantMaterialQty);
            }
            const eggPurchase = entry.materialName === PAIR_EGG_MATERIAL_NAME;
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
            const slotIndex = Math.floor(Number(rawSi));
            const gate = canUnlockPairHatcherySlot(user, slotIndex);
            if (!gate.ok) return { error: gate.reason ?? '해금할 수 없습니다.' };
            const def = getPairHatcherySlotDef(slotIndex);
            if (!def) return { error: '유효하지 않은 슬롯입니다.' };
            user.pairPetHatcherySlotUnlocked = normalizePairPetHatcherySlotUnlocked(user.pairPetHatcherySlotUnlocked);
            if (!user.isAdmin) {
                user.gold = (user.gold ?? 0) - def.unlockGold;
            }
            user.pairPetHatcherySlotUnlocked[slotIndex] = true;
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_HATCHERY_UNLOCK', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['pairPetHatcherySlotUnlocked', 'gold']);
            return { clientResponse: { updatedUser } };
        }

        case 'PAIR_PET_HATCHERY_START': {
            const { slotIndex: rawSi, itemId: hatchItemId } = payload as { slotIndex?: number; itemId?: string };
            const slotIndex = Math.floor(Number(rawSi));
            if (slotIndex < 0 || slotIndex >= PAIR_HATCHERY_SESSION_SLOT_COUNT) {
                return { error: '유효하지 않은 슬롯입니다.' };
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
                eggIdx = user.inventory.findIndex((it) => isPairEggItem(it) && (it.quantity ?? 1) >= 1);
                if (eggIdx < 0) return { error: '부화할 알이 없습니다.' };
            }
            const egg = user.inventory[eggIdx]!;
            const invSnapshot = JSON.parse(JSON.stringify(user.inventory)) as InventoryItem[];
            const nextQty = (egg.quantity ?? 1) - 1;
            const afterEgg = [...user.inventory];
            if (nextQty <= 0) afterEgg.splice(eggIdx, 1);
            else afterEgg[eggIdx] = { ...egg, quantity: nextQty };
            user.inventory = afterEgg;
            user.pairPetHatcherySessions[slotIndex] = { slotIndex, startedAt: Date.now(), eggItemId: egg.id };
            user.inventory = JSON.parse(JSON.stringify(user.inventory));
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_HATCHERY_START', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'pairPetHatcherySessions']);
            return { clientResponse: { updatedUser } };
        }

        case 'PAIR_PET_HATCHERY_CLAIM': {
            const { slotIndex: rawSi } = payload as { slotIndex?: number };
            const slotIndex = Math.floor(Number(rawSi));
            if (slotIndex < 0 || slotIndex >= PAIR_HATCHERY_SESSION_SLOT_COUNT) {
                return { error: '유효하지 않은 슬롯입니다.' };
            }
            user.pairPetHatcherySessions = normalizePairPetHatcherySessions(user.pairPetHatcherySessions);
            const session = user.pairPetHatcherySessions[slotIndex];
            if (!session) return { error: '부화 완료 대기 중인 알이 없습니다.' };
            const endAt = hatcheryEndsAt(session.startedAt, slotIndex);
            if (Date.now() < endAt) return { error: '아직 부화가 끝나지 않았습니다.' };
            const def = getPairHatcherySlotDef(slotIndex);
            if (!def) return { error: '유효하지 않은 슬롯입니다.' };
            const petLevel = rollHatchPetLevelFromRule(def.levelRule);
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
            user.pairPetHatcherySessions[slotIndex] = null;
            user.inventory = JSON.parse(JSON.stringify(user.inventory));
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_HATCHERY_CLAIM', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'pairPetHatcherySessions']);
            return { clientResponse: { updatedUser } };
        }

        case 'PAIR_PET_HATCHERY_CANCEL': {
            const { slotIndex: rawSi } = payload as { slotIndex?: number };
            const slotIndex = Math.floor(Number(rawSi));
            if (slotIndex < 0 || slotIndex >= PAIR_HATCHERY_SESSION_SLOT_COUNT) {
                return { error: '유효하지 않은 슬롯입니다.' };
            }
            user.pairPetHatcherySessions = normalizePairPetHatcherySessions(user.pairPetHatcherySessions);
            const cancelSession = user.pairPetHatcherySessions[slotIndex];
            if (!cancelSession) return { error: '부화 중인 알이 없습니다.' };
            const cancelEndAt = hatcheryEndsAt(cancelSession.startedAt, slotIndex);
            if (Date.now() >= cancelEndAt) {
                return { error: '부화가 완료되었습니다. 펫 받기를 사용해 주세요.' };
            }
            const restoreErr = restoreOnePairEgg(user, cancelSession.eggItemId);
            if (restoreErr) return { error: restoreErr };
            user.pairPetHatcherySessions[slotIndex] = null;
            const updatedUserCancel = getSelectiveUserUpdate(user, 'PAIR_PET_HATCHERY_CANCEL', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate: broadcastCancel } = await import('../socket.js');
            broadcastCancel(user, ['inventory', 'pairPetHatcherySessions']);
            return { clientResponse: { updatedUser: updatedUserCancel } };
        }

        case 'PAIR_PET_HATCHERY_INSTANT_FINISH': {
            const { slotIndex: rawSiIf } = payload as { slotIndex?: number };
            const slotIndexIf = Math.floor(Number(rawSiIf));
            if (slotIndexIf < 0 || slotIndexIf >= PAIR_HATCHERY_SESSION_SLOT_COUNT) {
                return { error: '유효하지 않은 슬롯입니다.' };
            }
            user.pairPetHatcherySessions = normalizePairPetHatcherySessions(user.pairPetHatcherySessions);
            const sessIf = user.pairPetHatcherySessions[slotIndexIf];
            if (!sessIf) return { error: '부화 중인 알이 없습니다.' };
            const endAtIf = hatcheryEndsAt(sessIf.startedAt, slotIndexIf);
            const nowIf = Date.now();
            if (nowIf >= endAtIf) {
                return { error: '이미 부화가 끝났습니다. 펫 받기를 사용해 주세요.' };
            }
            const remainMsIf = endAtIf - nowIf;
            const cost = Math.max(1, Math.ceil(remainMsIf / 60_000));
            const defIf = getPairHatcherySlotDef(slotIndexIf);
            if (!defIf) return { error: '유효하지 않은 슬롯입니다.' };
            const petLevelIf = rollHatchPetLevelFromRule(defIf.levelRule);
            const petMetaIf = rollPairPetMetaForHatchAtLevel(petLevelIf);
            const petTemplateIf = rollPairPetTemplateId();
            const petItemIf = makePairPetItem(petTemplateIf, petMetaIf);
            if (!user.inventorySlots) {
                user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
            }
            const mergedIf = addItemsToInventory(user.inventory, user.inventorySlots, [petItemIf], {
                allowMaterialSlotOverflow: true,
            });
            if (!mergedIf.success || !mergedIf.updatedInventory) {
                return { error: PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE };
            }
            if (!user.isAdmin) {
                if ((user.diamonds ?? 0) < cost) {
                    return { error: '다이아가 부족합니다.' };
                }
                user.diamonds -= cost;
                if (user.guildId && cost > 0) {
                    const guildsIf = (await db.getKV<Record<string, any>>('guilds')) || {};
                    const { guildService: guildSvcIf } = await import('../guildService.js');
                    await guildSvcIf.updateGuildMissionProgress(user.guildId, 'diamondsSpent', cost, guildsIf);
                }
            }
            user.inventory = mergedIf.updatedInventory;
            user.pairPetHatcherySessions[slotIndexIf] = null;
            user.inventory = JSON.parse(JSON.stringify(user.inventory));
            const updatedUserIf = getSelectiveUserUpdate(user, 'PAIR_PET_HATCHERY_INSTANT_FINISH', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate: broadcastIf } = await import('../socket.js');
            broadcastIf(user, ['inventory', 'pairPetHatcherySessions', 'diamonds']);
            return { clientResponse: { updatedUser: updatedUserIf } };
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
            invAfterSoul[mainNewIdx] = { ...mainAfter, grade: nextG };

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

            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_CONVERT_PET', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'equippedPairPetTemplateId', 'equippedPairPetInventoryItemId']);
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
            const meta = readPairPetMetaFromRow(row);
            const minLv = minPetLevelForTrainingSlot(slotIndex);
            if (meta.level < minLv) {
                return { error: `이 슬롯은 펫 레벨 ${minLv} 이상만 참여할 수 있습니다.` };
            }
            user.pairPetTrainingSlots[slotIndex] = {
                slotIndex,
                itemId,
                startedAt: Date.now(),
            };
            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_START_TRAINING', { includeAll: true });
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
            const endAt = trainingEndsAt(session.startedAt, slotIndex);
            if (Date.now() < endAt) return { error: '아직 수련이 끝나지 않았습니다.' };
            const def = getPairTrainingSlotDef(slotIndex);
            if (!def) return { error: '유효하지 않은 슬롯입니다.' };

            const petIdx = user.inventory.findIndex((it) => it.id === session.itemId);
            const metaForBonuses = petIdx >= 0 ? readPairPetMetaFromRow(user.inventory[petIdx]!) : neutralTrainingMeta;

            const goldGain = Math.max(0, Math.floor(rollInclusive(def.goldMin, def.goldMax) * trainingGoldMultiplier(metaForBonuses)));
            const xpGain = Math.max(0, Math.floor(rollInclusive(def.xpMin, def.xpMax) * trainingXpMultiplier(metaForBonuses)));

            const soulDrop = rollSoulDropForSlot(slotIndex, metaForBonuses);
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

            if (petIdx >= 0) {
                const petRow = user.inventory[petIdx]!;
                const meta = { ...readPairPetMetaFromRow(petRow) };
                applyPairPetXp(meta, xpGain, petRow.grade ?? ItemGrade.Normal);
                user.inventory[petIdx] = { ...petRow, pairPetMeta: meta };
            }

            user.pairPetTrainingSlots[slotIndex] = null;
            user.inventory = JSON.parse(JSON.stringify(user.inventory));

            const updatedUser = getSelectiveUserUpdate(user, 'PAIR_PET_CLAIM_TRAINING', { includeAll: true });
            await db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'gold', 'pairPetTrainingSlots']);
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
                    const { guildService } = await import('../guildService.js');
                    await guildService.updateGuildMissionProgress(user.guildId, 'diamondsSpent', cost, guilds);
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
export const tryMatchPlayers = async (volatileState: VolatileState, lobbyType: 'strategic' | 'playful'): Promise<void> => {
    if (rankedMatchingLocks[lobbyType]) return;
    rankedMatchingLocks[lobbyType] = true;
    try {
        await tryMatchPlayersUnlocked(volatileState, lobbyType);
    } finally {
        rankedMatchingLocks[lobbyType] = false;
    }
};

const tryMatchPlayersUnlocked = async (volatileState: VolatileState, lobbyType: RankedLobbyType): Promise<void> => {
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
        }
    }
    if (queueChanged) {
        broadcast({ type: 'RANKED_MATCHING_UPDATE', payload: { queue: volatileState.rankedMatchingQueue } });
    }
    if (Object.keys(queue).length < 2) return;

    const entries = Object.values(queue);
    
    // 모든 가능한 쌍을 확인하여 가장 비슷한 점수 차이의 쌍 찾기
    let bestMatch: {
        player1: typeof entries[0];
        player2: typeof entries[0];
        selectedMode: GameMode;
        scoreDiff: number;
        prioritySum: number;
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
                const bestOlderStart = bestMatch ? Math.min(bestMatch.player1.startTime, bestMatch.player2.startTime) : Infinity;
                if (
                    !bestMatch ||
                    scoreDiff < bestMatch.scoreDiff ||
                    (scoreDiff === bestMatch.scoreDiff && prioritySum < bestMatch.prioritySum) ||
                    (scoreDiff === bestMatch.scoreDiff && prioritySum === bestMatch.prioritySum && olderStart < bestOlderStart)
                ) {
                    bestMatch = { player1: entry1, player2: entry2, selectedMode: mode, scoreDiff, prioritySum };
                }
            }
        }
    }
    
    if (!bestMatch) return;
    
    // 매칭 성공: 게임 생성
    const { player1: entry1, player2: entry2, selectedMode } = bestMatch;
    
    // 랭킹전 기본 설정 가져오기
    const { getRankedGameSettings } = await import('../../constants/rankedGameSettings.js');
    const settings = getRankedGameSettings(selectedMode);
    
    // Negotiation 생성 (랭킹전)
    const player1 = await db.getUser(entry1.userId);
    const player2 = await db.getUser(entry2.userId);
    
    if (!player1 || !player2) {
        if (!player1) delete queue[entry1.userId];
        if (!player2) delete queue[entry2.userId];
        broadcast({ type: 'RANKED_MATCHING_UPDATE', payload: { queue: volatileState.rankedMatchingQueue } });
        return;
    }
    
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
        isRanked: true, // 랭킹전
    };
    
    // 게임 생성
    const { initializeGame } = await import('../gameModes.js');
    const game = await initializeGame(negotiation);
    await db.saveGame(game);
    
    // 큐에서 제거
    if (volatileState.rankedMatchingQueue && volatileState.rankedMatchingQueue[lobbyType]) {
        delete volatileState.rankedMatchingQueue[lobbyType][entry1.userId];
        delete volatileState.rankedMatchingQueue[lobbyType][entry2.userId];
    }
    
    // 사용자 상태 업데이트
    volatileState.userStatuses[game.player1.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id };
    volatileState.userStatuses[game.player2.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id };
    
    // 예상 랭킹 점수 변동 계산
    const { calculateEloChange } = await import('../summaryService.js');
    const player1Rating = getRankedRatingForMode(player1, selectedMode);
    const player2Rating = getRankedRatingForMode(player2, selectedMode);
    const player1WinChange = calculateEloChange(player1Rating, player2Rating, 'win');
    const player1LossChange = calculateEloChange(player1Rating, player2Rating, 'loss');
    const player2WinChange = calculateEloChange(player2Rating, player1Rating, 'win');
    const player2LossChange = calculateEloChange(player2Rating, player1Rating, 'loss');
    
    // 매칭 성공 알림 브로드캐스트
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
        } 
    });
    
    // 게임 정보 브로드캐스트
    const { broadcastToGameParticipants, broadcastLiveGameToList } = await import('../socket.js');
    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
    // PVP(랭크매칭)이므로 진행중인 대국 목록에 표시·관전 가능하도록 전체 브로드캐스트
    broadcastLiveGameToList(game);
    broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
    broadcast({ type: 'RANKED_MATCHING_UPDATE', payload: { queue: volatileState.rankedMatchingQueue } });
};