import { randomUUID } from 'crypto';
import * as db from '../db.js';
import { type ServerAction, type User, type Equipment, type VolatileState, AdminLog, Announcement, OverrideAnnouncement, GameMode, LiveGameSession, UserStatusInfo, InventoryItem, InventoryItemType, UserStatus, TournamentType, CoreStat, type EquipmentSlot } from '../../types/index.js';
import * as types from '../../types/index.js';
import { defaultStats, createDefaultBaseStats, createDefaultSpentStatPoints, createDefaultInventory, createDefaultQuests, createDefaultUser } from '../initialData.js';
import * as summaryService from '../summaryService.js';
import { createItemFromTemplate, applyEnhancementStarsToEquipmentItem, createSeededRandom } from '../shop.js';
import { EQUIPMENT_POOL, CONSUMABLE_ITEMS, MATERIAL_ITEMS, TOURNAMENT_DEFINITIONS, BOT_NAMES, AVATAR_POOL, BORDER_POOL, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '../../constants';
import * as mannerService from '../mannerService.js';
import { containsProfanity } from '../../profanity.js';
import { broadcast } from '../socket.js';
import { calculateTotalStats } from '../statService.js';
import * as tournamentService from '../tournamentService.js';
import { getStartOfDayKST, getTodayKSTDateString } from '../../utils/timeUtils.js';
import { clearAiSession } from '../aiSessionManager.js';
import { getCachedUser, updateUserCache, removeUserFromCache } from '../gameCache.js';
import { invalidateUserCache } from '../db.js';
import { ADMIN_USER_ID } from '../../shared/constants/auth.js';
import { mergeArenaEntranceAvailability, type ArenaEntranceKey, ARENA_ENTRANCE_KEYS } from '../../constants/arenaEntrance.js';
import { GUILD_WAR_PERSONAL_DAILY_ATTEMPTS } from '../../shared/constants/guildConstants.js';
import { parseEquipmentStarsFromPayload } from '../../shared/utils/equipmentEnhancementStars.js';
import { normalizeLegacyDivineMythicInventoryItem } from '../../shared/utils/inventoryLegacyNormalize.js';

type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
};

const ADMIN_MAX_INVENTORY_ITEMS = 220;
const ADMIN_EQUIPMENT_SLOTS: EquipmentSlot[] = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];

function sanitizeAdminInventoryList(raw: unknown): InventoryItem[] {
    if (!Array.isArray(raw)) return [];
    const out: InventoryItem[] = [];
    for (const entry of raw.slice(0, ADMIN_MAX_INVENTORY_ITEMS)) {
        try {
            const it = JSON.parse(JSON.stringify(entry)) as Record<string, unknown>;
            if (!it || typeof it.id !== 'string' || !it.id.trim()) continue;
            if (typeof it.name !== 'string') continue;
            if (it.type !== 'equipment' && it.type !== 'consumable' && it.type !== 'material') continue;
            const level = Math.floor(Number(it.level));
            it.level = Number.isFinite(level) ? Math.max(0, Math.min(999, level)) : 1;
            const stars = Math.floor(Number(it.stars));
            it.stars = Number.isFinite(stars) ? Math.max(0, Math.min(99, stars)) : 0;
            const fails = Math.floor(Number(it.enhancementFails));
            it.enhancementFails = Number.isFinite(fails) ? Math.max(0, Math.min(9999, fails)) : 0;
            if (it.type !== 'equipment') {
                const q = Math.floor(Number(it.quantity));
                it.quantity = Number.isFinite(q) ? Math.max(1, Math.min(999999, q)) : 1;
            }
            if (typeof it.createdAt !== 'number') it.createdAt = Date.now();
            if (typeof it.isEquipped !== 'boolean') it.isEquipped = false;
            if (typeof it.image !== 'string') it.image = '';
            if (typeof it.description !== 'string') it.description = '';
            if (typeof it.grade !== 'string') it.grade = 'normal';
            const anyIt = it as Record<string, unknown>;
            if (anyIt.isDivineMythic === true && it.grade === 'mythic') {
                it.grade = 'transcendent';
            }
            delete anyIt.isDivineMythic;
            if (typeof it.name === 'string' && it.name.endsWith(' (더블신화)')) {
                it.name = it.name.replace(/ \(더블신화\)$/, '');
            }
            out.push(it as unknown as InventoryItem);
        } catch {
            /* skip malformed */
        }
    }
    return out;
}

function sanitizeAdminEquipment(raw: unknown, inventoryIds: Set<string>): Equipment {
    const out: Equipment = {};
    if (!raw || typeof raw !== 'object') return out;
    const o = raw as Record<string, unknown>;
    for (const slot of ADMIN_EQUIPMENT_SLOTS) {
        const v = o[slot];
        if (v == null || v === '') continue;
        if (typeof v === 'string' && inventoryIds.has(v)) {
            out[slot] = v;
        }
    }
    return out;
}

function applyEquippedFlagsFromEquipment(inv: InventoryItem[], equipment: Equipment) {
    const equipped = new Set(Object.values(equipment).filter((x): x is string => typeof x === 'string' && !!x));
    for (const it of inv) {
        if (it.type === 'equipment') {
            it.isEquipped = equipped.has(it.id);
        }
    }
}

const createAdminLog = async (admin: User, action: AdminLog['action'], target: User | { id: string; nickname: string }, backupData: any) => {
    const log: AdminLog = {
        id: `log-${randomUUID()}`,
        timestamp: Date.now(),
        adminId: admin.id,
        adminNickname: admin.nickname,
        targetUserId: target.id,
        targetNickname: target.nickname,
        action: action,
        backupData: backupData
    };

    const logs = await db.getKV<AdminLog[]>('adminLogs') || [];
    logs.unshift(log);
    if (logs.length > 200) logs.length = 200;
    await db.setKV('adminLogs', logs);
};

const broadcastAnnouncementUpdate = async () => {
    const announcements = await db.getKV<Announcement[]>('announcements') || [];
    const globalOverrideAnnouncement = await db.getKV<OverrideAnnouncement | null>('globalOverrideAnnouncement') ?? null;
    const announcementInterval = await db.getKV<number>('announcementInterval') ?? 3;
    broadcast({ type: 'ANNOUNCEMENT_UPDATE', payload: { announcements, globalOverrideAnnouncement, announcementInterval } });
};

export const handleAdminAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    if (!user.isAdmin) {
        return { error: 'Permission denied.' };
    }
    const { type, payload } = action;

    switch (type) {
        case 'ADMIN_APPLY_SANCTION': {
            const { targetUserId, sanctionType, durationMinutes, reason, reasonDetail } = payload as {
                targetUserId: string;
                sanctionType: 'chat' | 'connection';
                durationMinutes: number;
                reason: string;
                reasonDetail?: string;
            };
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };
            if (!reason || !String(reason).trim()) return { error: '제재 사유를 선택해주세요.' };

            const now = Date.now();
            const banUntil = now + durationMinutes * 60 * 1000;
            const normalizedReason = String(reason).trim();
            const normalizedReasonDetail = typeof reasonDetail === 'string' ? reasonDetail.trim() : '';
            const sanctionRecord = {
                id: `sanction-${randomUUID()}`,
                sanctionType,
                reason: normalizedReason,
                details: normalizedReasonDetail || undefined,
                createdAt: now,
                expiresAt: Number.isFinite(banUntil) ? banUntil : null,
            };
            if (!Array.isArray(targetUser.sanctionHistory)) {
                targetUser.sanctionHistory = [];
            }
            targetUser.sanctionHistory.unshift(sanctionRecord);
            if (targetUser.sanctionHistory.length > 30) {
                targetUser.sanctionHistory = targetUser.sanctionHistory.slice(0, 30);
            }

            if (sanctionType === 'chat') {
                targetUser.chatBanUntil = banUntil;
                targetUser.chatBanReason = normalizedReason;
            } else if (sanctionType === 'connection') {
                targetUser.connectionBanUntil = banUntil;
                targetUser.connectionBanReason = normalizedReason;
                
                // 사용자가 게임 중인 경우 게임 종료 처리
                const userStatus = volatileState.userStatuses[targetUserId];
                if (userStatus?.gameId) {
                    const activeGame = await db.getLiveGame(userStatus.gameId);
                    // scoring 상태의 게임은 연결 끊김으로 처리하지 않음 (자동계가 진행 중)
                    if (activeGame && activeGame.gameStatus !== 'ended' && activeGame.gameStatus !== 'no_contest' && activeGame.gameStatus !== 'scoring') {
                        // 상대방이 승리하도록 게임 종료
                        const opponentId = activeGame.player1.id === targetUserId ? activeGame.player2.id : activeGame.player1.id;
                        const winner = activeGame.blackPlayerId === opponentId ? types.Player.Black : types.Player.White;
                        await summaryService.endGame(activeGame, winner, 'disconnect');
                        await db.saveGame(activeGame);
                        
                        // 상대방 상태 업데이트
                        if (volatileState.userStatuses[opponentId]) {
                            const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === activeGame.mode);
                            const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === activeGame.mode);
                            const lobbyMode: GameMode | undefined = isStrategic ? undefined : isPlayful ? undefined : activeGame.mode;
                            volatileState.userStatuses[opponentId].status = UserStatus.Waiting;
                            volatileState.userStatuses[opponentId].mode = lobbyMode;
                            delete volatileState.userStatuses[opponentId].gameId;
                        }
                        
                        const { broadcastToGameParticipants } = await import('../socket.js');
                        broadcastToGameParticipants(activeGame.id, { type: 'GAME_UPDATE', payload: { [activeGame.id]: activeGame } }, activeGame);
                    }
                }
                
                // Also log them out
                delete volatileState.userConnections[targetUserId];
                delete volatileState.userStatuses[targetUserId];
                
                // 사용자 상태 업데이트 브로드캐스트
                broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            }

            await db.updateUser(targetUser);
            await createAdminLog(user, 'apply_sanction', targetUser, { sanctionType, durationMinutes, reason: normalizedReason, reasonDetail: normalizedReasonDetail || undefined });
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화: 변경된 필드만 전송)
            const updatedUser = JSON.parse(JSON.stringify(targetUser));
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(updatedUser);
            
            return {};
        }

        case 'ADMIN_LIFT_SANCTION': {
            const { targetUserId, sanctionType } = payload;
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };
            const now = Date.now();

            if (sanctionType === 'chat') {
                targetUser.chatBanUntil = undefined;
                targetUser.chatBanReason = null;
            } else if (sanctionType === 'connection') {
                targetUser.connectionBanUntil = undefined;
                targetUser.connectionBanReason = null;
            }
            if (Array.isArray(targetUser.sanctionHistory)) {
                const historyRow = targetUser.sanctionHistory.find((row) => row.sanctionType === sanctionType && !row.releasedAt);
                if (historyRow) {
                    historyRow.releasedAt = now;
                    historyRow.releasedBy = user.nickname;
                }
            }

            await db.updateUser(targetUser);
            await createAdminLog(user, 'lift_sanction', targetUser, { sanctionType });
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화: 변경된 필드만 전송)
            const updatedUser = JSON.parse(JSON.stringify(targetUser));
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(updatedUser);
            
            return {};
        }
        case 'ADMIN_RESET_USER_DATA': {
            const { targetUserId, resetType } = payload;
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };

            const backupData = JSON.parse(JSON.stringify(targetUser));

            if (resetType === 'full') {
                targetUser.strategyLevel = 1;
                targetUser.strategyXp = 0;
                targetUser.playfulLevel = 1;
                targetUser.playfulXp = 0;
                targetUser.spentStatPoints = createDefaultSpentStatPoints();
            }
            targetUser.stats = JSON.parse(JSON.stringify(defaultStats));

            await db.updateUser(targetUser);
            await createAdminLog(user, resetType === 'full' ? 'reset_full' : 'reset_stats', targetUser, backupData);
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화: 변경된 필드만 전송)
            const updatedUser = JSON.parse(JSON.stringify(targetUser));
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(updatedUser);
            
            return {};
        }
        case 'ADMIN_DELETE_USER': {
            const { targetUserId } = payload;
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };
            if (targetUser.isAdmin) return { error: '관리자 계정은 삭제할 수 없습니다.' };

            // 사용자가 게임 중인 경우 게임 종료 처리
            const userStatus = volatileState.userStatuses[targetUserId];
            if (userStatus?.gameId) {
                const activeGame = await db.getLiveGame(userStatus.gameId);
                if (activeGame && activeGame.gameStatus !== 'ended' && activeGame.gameStatus !== 'no_contest') {
                    // 상대방이 승리하도록 게임 종료
                    const opponentId = activeGame.player1.id === targetUserId ? activeGame.player2.id : activeGame.player1.id;
                    const winner = activeGame.blackPlayerId === opponentId ? types.Player.Black : types.Player.White;
                    await summaryService.endGame(activeGame, winner, 'disconnect');
                    await db.saveGame(activeGame);
                    
                    // 상대방 상태 업데이트
                    if (volatileState.userStatuses[opponentId]) {
                        const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === activeGame.mode);
                        const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === activeGame.mode);
                        const lobbyMode: GameMode | undefined = isStrategic ? undefined : isPlayful ? undefined : activeGame.mode;
                        volatileState.userStatuses[opponentId].status = UserStatus.Waiting;
                        volatileState.userStatuses[opponentId].mode = lobbyMode;
                        delete volatileState.userStatuses[opponentId].gameId;
                    }
                    
                    broadcast({ type: 'GAME_UPDATE', payload: { [activeGame.id]: activeGame } });
                }
            }

            const backupData = JSON.parse(JSON.stringify(targetUser));
            await db.deleteUser(targetUserId);

            delete volatileState.userConnections[targetUserId];
            delete volatileState.userStatuses[targetUserId];

            // 사용자 상태 업데이트 브로드캐스트
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });

            await createAdminLog(user, 'delete_user', targetUser, backupData);
            return {};
        }
        case 'ADMIN_CREATE_USER': {
            const { username, password, nickname, email: emailRaw } = payload as {
                username: string;
                password: string;
                nickname: string;
                email?: string;
            };
            if (!username || !password || !nickname) { return { error: '모든 필드를 입력해야 합니다.' }; }
            if (nickname.trim().length < NICKNAME_MIN_LENGTH || nickname.trim().length > NICKNAME_MAX_LENGTH) {
                return { error: `닉네임은 ${NICKNAME_MIN_LENGTH}-${NICKNAME_MAX_LENGTH}자여야 합니다.` };
            }

            const existingByUsername = await db.getUserCredentials(username);
            if (existingByUsername) return { error: '이미 사용 중인 아이디입니다.' };

            const allUsers = await db.getAllUsers({ includeEquipment: true, includeInventory: true });
            if (allUsers.some(u => u.nickname.toLowerCase() === nickname.toLowerCase())) {
                return { error: '이미 사용 중인 닉네임입니다.' };
            }

            const emailTrimmed = typeof emailRaw === 'string' ? emailRaw.trim() : '';
            if (emailTrimmed) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(emailTrimmed)) {
                    return { error: '올바른 이메일 주소를 입력해주세요.' };
                }
                const emailNorm = emailTrimmed.toLowerCase();
                const existingByEmail = await db.getUserByEmail(emailNorm);
                if (existingByEmail) return { error: '이미 사용 중인 이메일입니다.' };
                const kvRepository = await import('../repositories/kvRepository.js');
                const withdrawnEmails = await kvRepository.getKV<Record<string, number>>('withdrawnEmails') || {};
                const withdrawnEmailExpiry = withdrawnEmails[emailNorm];
                if (withdrawnEmailExpiry && withdrawnEmailExpiry > Date.now()) {
                    const daysLeft = Math.ceil((withdrawnEmailExpiry - Date.now()) / (24 * 60 * 60 * 1000));
                    return { error: `회원탈퇴한 이메일은 ${daysLeft}일 후에 다시 가입할 수 있습니다.` };
                }
                if (withdrawnEmailExpiry && withdrawnEmailExpiry <= Date.now()) {
                    delete withdrawnEmails[emailNorm];
                    await kvRepository.setKV('withdrawnEmails', withdrawnEmails);
                }
            }

            const newUser = createDefaultUser(`user-${randomUUID()}`, username, nickname, false);
            (newUser as { email?: string | null }).email = emailTrimmed ? emailTrimmed.toLowerCase() : null;

            await db.createUser(newUser);
            await db.createUserCredentials(username, password, newUser.id);
            return {};
        }
        case 'ADMIN_FORCE_LOGOUT': {
            const { targetUserId } = payload;
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };

            // 사용자가 게임 중인 경우 게임 종료 처리
            const userStatus = volatileState.userStatuses[targetUserId];
            if (userStatus?.gameId) {
                const activeGame = await db.getLiveGame(userStatus.gameId);
                if (activeGame && activeGame.gameStatus !== 'ended' && activeGame.gameStatus !== 'no_contest') {
                    // 상대방이 승리하도록 게임 종료
                    const opponentId = activeGame.player1.id === targetUserId ? activeGame.player2.id : activeGame.player1.id;
                    const winner = activeGame.blackPlayerId === opponentId ? types.Player.Black : types.Player.White;
                    await summaryService.endGame(activeGame, winner, 'disconnect');
                    await db.saveGame(activeGame);
                    
                    // 상대방 상태 업데이트
                    if (volatileState.userStatuses[opponentId]) {
                        const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === activeGame.mode);
                        const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === activeGame.mode);
                        const lobbyMode: GameMode | undefined = isStrategic ? undefined : isPlayful ? undefined : activeGame.mode;
                        volatileState.userStatuses[opponentId].status = UserStatus.Waiting;
                        volatileState.userStatuses[opponentId].mode = lobbyMode;
                        delete volatileState.userStatuses[opponentId].gameId;
                    }
                    
                    broadcast({ type: 'GAME_UPDATE', payload: { [activeGame.id]: activeGame } });
                }
            }
            
            const backupData = { status: volatileState.userStatuses[targetUserId] };
            delete volatileState.userConnections[targetUserId];
            delete volatileState.userStatuses[targetUserId];
            
            // 사용자 상태 업데이트 브로드캐스트
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            
            await createAdminLog(user, 'force_logout', targetUser, backupData);
            return {};
        }
        case 'ADMIN_SEND_MAIL': {
            const { targetSpecifier, targetUserIds, title, message, expiresInDays, attachments } = payload as {
                targetSpecifier: string;
                targetUserIds?: string[];
                title: string;
                message: string;
                expiresInDays: number;
                attachments: {
                    gold: number;
                    diamonds: number;
                    actionPoints: number;
                    items: { name: string; quantity: number; type: InventoryItemType; stars?: number; grade?: string }[];
                }
            };
            let targetUsers: User[] = [];
            // Admin mail should always resolve recipients from fresh data.
            const allUsers = await db.getAllUsers({ skipCache: true });

            if (targetSpecifier === 'all') {
                targetUsers = allUsers;
            } else if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
                const targetUserIdSet = new Set(targetUserIds);
                targetUsers = allUsers.filter(u => targetUserIdSet.has(u.id));
            } else {
                const foundUser = allUsers.find(u => u.nickname === targetSpecifier || u.username === targetSpecifier);
                if (foundUser) targetUsers.push(foundUser);
            }

            if (targetUsers.length === 0) return { error: '메일을 보낼 사용자를 찾을 수 없습니다.' };

            for (const target of targetUsers) {
                // Re-fetch each recipient to avoid overwriting with stale cached snapshots.
                const freshTarget = await db.getUser(target.id, { includeEquipment: true, includeInventory: true });
                if (!freshTarget) {
                    continue;
                }
                 const userAttachments: types.Mail['attachments'] = {
                    gold: attachments.gold,
                    diamonds: attachments.diamonds,
                    actionPoints: attachments.actionPoints,
                    items: []
                };

                const mailId = `mail-${randomUUID()}`;
                let attachmentSeq = 0;

                if (attachments.items && attachments.items.length > 0) {
                    for (const attachedItem of attachments.items) {
                        const { name, quantity, type, stars: rawStars, grade: payloadGrade } = attachedItem;
                        const stars = parseEquipmentStarsFromPayload(rawStars);
                        if (type === 'equipment') {
                            for (let i = 0; i < quantity; i++) {
                                const template = payloadGrade
                                    ? EQUIPMENT_POOL.find(t => t.name === name && t.grade === payloadGrade)
                                    : EQUIPMENT_POOL.find(t => t.name === name);
                                if (template) {
                                    let eq = createItemFromTemplate(template);
                                    eq = normalizeLegacyDivineMythicInventoryItem(eq);
                                    if (stars > 0) {
                                        applyEnhancementStarsToEquipmentItem(eq, stars, {
                                            rng: createSeededRandom(`${mailId}|${attachmentSeq}|${stars}`),
                                        });
                                        eq.mailPreEnhanced = true;
                                    }
                                    userAttachments.items!.push(eq);
                                    attachmentSeq++;
                                }
                            }
                        } else { // Stackable items (consumable or material)
                            const template = [...CONSUMABLE_ITEMS, ...Object.values(MATERIAL_ITEMS)].find(t => t.name === name);
                            if (template) {
                                (userAttachments.items as InventoryItem[]).push({
                                    ...(template as any),
                                    id: `item-${randomUUID()}`,
                                    createdAt: Date.now(),
                                    isEquipped: false,
                                    level: 1,
                                    stars: 0,
                                    quantity: quantity,
                                });
                                attachmentSeq++;
                            }
                        }
                    }
                }
                
                const newMail: types.Mail = {
                    id: mailId,
                    from: user.nickname,
                    title, message,
                    attachments: userAttachments,
                    receivedAt: Date.now(),
                    expiresAt: expiresInDays > 0 ? Date.now() + expiresInDays * 24 * 60 * 60 * 1000 : undefined,
                    isRead: false,
                    attachmentsClaimed: false
                };
                if (!Array.isArray(freshTarget.mail)) {
                    freshTarget.mail = [];
                }
                freshTarget.mail.unshift(newMail);
                await db.updateUser(freshTarget);
                
                // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화: 변경된 필드만 전송)
                const updatedUser = JSON.parse(JSON.stringify(freshTarget));
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(updatedUser, ['mail']);
            }
            const logTarget = targetSpecifier === 'all'
                ? { id: 'all', nickname: 'all' }
                : {
                    id: Array.isArray(targetUserIds) && targetUserIds.length > 0 ? targetUserIds.join(',') : targetSpecifier,
                    nickname: Array.isArray(targetUserIds) && targetUserIds.length > 0 ? `selected:${targetUsers.length}` : targetSpecifier
                };
            await createAdminLog(user, 'send_mail', logTarget, { mailTitle: title });
            return {};
        }
        case 'ADMIN_REORDER_ANNOUNCEMENTS': {
            await db.setKV('announcements', payload.announcements);
            await broadcastAnnouncementUpdate();
            return {};
        }
        case 'ADMIN_ADD_ANNOUNCEMENT': {
            const announcements = await db.getKV<Announcement[]>('announcements') || [];
            const newAnnouncement: Announcement = { id: `ann-${randomUUID()}`, message: payload.message };
            announcements.push(newAnnouncement);
            await db.setKV('announcements', announcements);
            await broadcastAnnouncementUpdate();
            return {};
        }
        case 'ADMIN_REMOVE_ANNOUNCEMENT': {
            const announcements = await db.getKV<Announcement[]>('announcements') || [];
            const updatedAnnouncements = announcements.filter(a => a.id !== payload.id);
            await db.setKV('announcements', updatedAnnouncements);
            await broadcastAnnouncementUpdate();
            return {};
        }
        case 'ADMIN_SET_ANNOUNCEMENT_INTERVAL': {
            await db.setKV('announcementInterval', payload.interval);
            await broadcastAnnouncementUpdate();
            return {};
        }
        case 'ADMIN_SET_OVERRIDE_ANNOUNCEMENT': {
            const override: OverrideAnnouncement = { message: payload.message, modes: 'all' };
            await db.setKV('globalOverrideAnnouncement', override);
            await broadcastAnnouncementUpdate();
            return {};
        }
        case 'ADMIN_CLEAR_OVERRIDE_ANNOUNCEMENT': {
            await db.setKV('globalOverrideAnnouncement', null);
            await broadcastAnnouncementUpdate();
            return {};
        }
        case 'ADMIN_TOGGLE_GAME_MODE': {
            const { mode, isAvailable } = payload;
            const availability = await db.getKV<Record<GameMode, boolean>>('gameModeAvailability') || {} as Record<GameMode, boolean>;
            availability[mode as GameMode] = isAvailable;
            await db.setKV('gameModeAvailability', availability);
            broadcast({ type: 'GAME_MODE_AVAILABILITY_UPDATE', payload: { gameModeAvailability: availability } });
            return { clientResponse: { gameModeAvailability: availability } };
        }
        case 'ADMIN_TOGGLE_ARENA_ENTRANCE': {
            const { arena, isOpen } = payload as { arena: ArenaEntranceKey; isOpen: boolean };
            if (!ARENA_ENTRANCE_KEYS.includes(arena)) {
                return { error: '유효하지 않은 경기장 키입니다.' };
            }
            const stored = await db.getKV<Partial<Record<string, boolean>>>('arenaEntranceAvailability') || {};
            stored[arena] = isOpen;
            await db.setKV('arenaEntranceAvailability', stored);
            const arenaEntranceAvailability = mergeArenaEntranceAvailability(stored);
            broadcast({ type: 'ARENA_ENTRANCE_AVAILABILITY_UPDATE', payload: { arenaEntranceAvailability } });
            return { clientResponse: { arenaEntranceAvailability } };
        }
        case 'ADMIN_SET_GAME_DESCRIPTION': {
            const { gameId, description } = payload;
            const game = await db.getLiveGame(gameId);
            if (!game) return { error: 'Game not found.' };
            game.description = description;
            await db.saveGame(game);
            
            // 게임 업데이트 브로드캐스트 (게임 참가자에게만 전송)
            const { broadcastToGameParticipants } = await import('../socket.js');
            broadcastToGameParticipants(gameId, { type: 'GAME_UPDATE', payload: { [gameId]: game } }, game);
            
            await createAdminLog(user, 'set_game_description', game.player1, { mailTitle: `Game ${game.id}`});
            return {};
        }
        case 'ADMIN_FORCE_DELETE_GAME': {
            const { gameId } = payload;
            
            // 캐시에서 먼저 찾기 (싱글플레이어/타워 게임은 캐시에만 있을 수 있음)
            const { getCachedGame, removeGameFromCache } = await import('../gameCache.js');
            let game = await getCachedGame(gameId);
            
            // 캐시에 없으면 DB에서 찾기
            if (!game) {
                game = await db.getLiveGame(gameId);
            }
            
            if (!game) {
                return { error: 'Game not found.' };
            }

            const backupData = JSON.parse(JSON.stringify(game));
            const gameCategory = game.gameCategory || 'normal';

            // 게임을 강제 종료 (no_contest 상태로 설정)
            game.gameStatus = 'no_contest';
            game.winReason = 'disconnect';
            
            // DB에 저장 (PVE 게임도 강제 종료 시에는 DB에 저장)
            try {
                await db.saveGame(game, true); // forceSave = true
            } catch (saveError) {
                console.warn(`[Admin] Failed to save game ${gameId} before deletion:`, saveError);
            }

            // 사용자 상태 업데이트 및 로비 모드 결정
            const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === game.mode);
            const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === game.mode);
            const lobbyMode: GameMode | undefined = isStrategic ? undefined : isPlayful ? undefined : game.mode;

            // 플레이어 상태 업데이트
            if (game.player1?.id && volatileState.userStatuses[game.player1.id]) {
                volatileState.userStatuses[game.player1.id].status = UserStatus.Waiting;
                volatileState.userStatuses[game.player1.id].mode = lobbyMode;
                delete volatileState.userStatuses[game.player1.id].gameId;
            }
            if (game.player2?.id && volatileState.userStatuses[game.player2.id]) {
                volatileState.userStatuses[game.player2.id].status = UserStatus.Waiting;
                volatileState.userStatuses[game.player2.id].mode = lobbyMode;
                delete volatileState.userStatuses[game.player2.id].gameId;
            }

            // 관전자 상태 업데이트
            Object.values(volatileState.userStatuses).forEach(status => {
                if (status.spectatingGameId === gameId) {
                    delete status.spectatingGameId;
                    if (status.status === UserStatus.Spectating) {
                        status.status = UserStatus.Waiting;
                    }
                }
            });

            // AI 세션 정리
            clearAiSession(gameId);
            
            // 캐시에서 게임 제거
            removeGameFromCache(gameId);
            
            // DB에서 게임 삭제 (에러가 발생해도 계속 진행)
            try {
                await db.deleteGame(gameId);
            } catch (deleteError) {
                console.warn(`[Admin] Failed to delete game ${gameId} from DB (may not exist):`, deleteError);
                // DB에 없어도 캐시에서 삭제했으므로 계속 진행
            }
            if (volatileState.gameChats) delete volatileState.gameChats[gameId];

            // 브로드캐스트
            broadcast({ type: 'GAME_DELETED', payload: { gameId, gameCategory } });
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });

            // 관리자 로그 기록
            if (game.player1) {
                await createAdminLog(user, 'force_delete_game', game.player1, backupData);
            }

            return { clientResponse: { success: true, message: '게임이 강제 종료되었습니다.' } };
        }
        case 'ADMIN_FORCE_WIN': {
            const { gameId, winnerId } = payload as { gameId: string; winnerId: string };
            const game = await db.getLiveGame(gameId);
            if (!game) return { error: 'Game not found.' };
            if (game.gameStatus === 'ended' || game.gameStatus === 'no_contest') {
                return { error: 'Game has already ended.' };
            }

            const winnerEnum = game.blackPlayerId === winnerId ? types.Player.Black : types.Player.White;
            const winnerUser = game.player1.id === winnerId ? game.player1 : game.player2;

            // 게임을 정상적으로 종료 (승자 지정)
            await summaryService.endGame(game, winnerEnum, 'resign');
            await db.saveGame(game);

            // 사용자 상태 업데이트 및 로비 모드 결정
            const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === game.mode);
            const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === game.mode);
            const lobbyMode: GameMode | undefined = isStrategic ? undefined : isPlayful ? undefined : game.mode;

            // 플레이어 상태 업데이트
            if (volatileState.userStatuses[game.player1.id]) {
                volatileState.userStatuses[game.player1.id].status = UserStatus.Waiting;
                volatileState.userStatuses[game.player1.id].mode = lobbyMode;
                delete volatileState.userStatuses[game.player1.id].gameId;
            }
            if (volatileState.userStatuses[game.player2.id]) {
                volatileState.userStatuses[game.player2.id].status = UserStatus.Waiting;
                volatileState.userStatuses[game.player2.id].mode = lobbyMode;
                delete volatileState.userStatuses[game.player2.id].gameId;
            }

            // 관전자 상태 업데이트
            Object.values(volatileState.userStatuses).forEach(status => {
                if (status.spectatingGameId === gameId) {
                    delete status.spectatingGameId;
                }
            });

            // 브로드캐스트
            broadcast({ type: 'GAME_UPDATE', payload: { [gameId]: game } });
            broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
            
            await createAdminLog(user, 'force_win', winnerUser, { gameId, winnerId });
            return {};
        }
        case 'ADMIN_UPDATE_USER_DETAILS': {
            const { targetUserId, updatedDetails } = payload as { targetUserId: string; updatedDetails: User };
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };

            if (user.id === targetUserId && targetUser.isAdmin && !updatedDetails.isAdmin) {
                return { error: '자신의 관리자 권한을 해제할 수 없습니다.' };
            }

            const backupData = JSON.parse(JSON.stringify(targetUser));
            
            // NICKNAME CHANGE VALIDATION
            if (updatedDetails.nickname && updatedDetails.nickname !== targetUser.nickname) {
                const newNickname = updatedDetails.nickname.trim();
                if (newNickname.length < NICKNAME_MIN_LENGTH || newNickname.length > NICKNAME_MAX_LENGTH) {
                    return { error: `닉네임은 ${NICKNAME_MIN_LENGTH}-${NICKNAME_MAX_LENGTH}자여야 합니다.` };
                }
                if (containsProfanity(newNickname)) {
                    return { error: '닉네임에 부적절한 단어가 포함되어 있습니다.' };
                }
                const allUsers = await db.getAllUsers();
                if (allUsers.some(u => u.id !== targetUserId && u.nickname.toLowerCase() === newNickname.toLowerCase())) {
                    return { error: '이미 사용 중인 닉네임입니다.' };
                }
                // If all checks pass, update the nickname
                targetUser.nickname = newNickname;
            }

            const oldMannerScore = targetUser.mannerScore;

            targetUser.isAdmin = !!updatedDetails.isAdmin;
            targetUser.strategyLevel = Number(updatedDetails.strategyLevel) || 1;
            targetUser.strategyXp = Number(updatedDetails.strategyXp) || 0;
            targetUser.playfulLevel = Number(updatedDetails.playfulLevel) || 1;
            targetUser.playfulXp = Number(updatedDetails.playfulXp) || 0;
            targetUser.gold = Number(updatedDetails.gold) || 0;
            targetUser.diamonds = Number(updatedDetails.diamonds) || 0;
            targetUser.mannerScore = Number(updatedDetails.mannerScore) || 200;
            
            // 챔피언십 점수 업데이트 (editedUser 전체를 보내므로 값이 있어야 함)
            // 0도 유효한 값이므로 명시적으로 처리
            if ('cumulativeTournamentScore' in updatedDetails) {
                const numValue = Number(updatedDetails.cumulativeTournamentScore);
                targetUser.cumulativeTournamentScore = isNaN(numValue) ? 0 : numValue;
            }
            if ('tournamentScore' in updatedDetails) {
                const numValue = Number(updatedDetails.tournamentScore);
                targetUser.tournamentScore = isNaN(numValue) ? 0 : numValue;
            }

            if (updatedDetails.cumulativeRankingScore && typeof updatedDetails.cumulativeRankingScore === 'object') {
                targetUser.cumulativeRankingScore = {
                    ...(targetUser.cumulativeRankingScore || {}),
                    ...updatedDetails.cumulativeRankingScore,
                };
            }

            if (updatedDetails.actionPoints && typeof updatedDetails.actionPoints === 'object') {
                const cur = Number((updatedDetails.actionPoints as any).current);
                const max = Number((updatedDetails.actionPoints as any).max);
                targetUser.actionPoints = {
                    current: Number.isFinite(cur) ? Math.max(0, cur) : targetUser.actionPoints?.current ?? 0,
                    max: Number.isFinite(max) ? Math.max(1, max) : targetUser.actionPoints?.max ?? 0,
                };
            }

            if (updatedDetails.quests) {
                targetUser.quests = updatedDetails.quests;
            }
            
            if (updatedDetails.stats) {
                for (const mode in updatedDetails.stats) {
                    const modeKey = mode as GameMode;
                    if (targetUser.stats && targetUser.stats[modeKey] && updatedDetails.stats[modeKey]) {
                        targetUser.stats[modeKey]!.rankingScore = Number(updatedDetails.stats[modeKey]!.rankingScore) || 1200;
                    }
                }
            }
            
            await mannerService.applyMannerRankChange(targetUser, oldMannerScore);
            await db.updateUser(targetUser);
            await createAdminLog(user, 'update_user_details', targetUser, backupData);
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화: 변경된 필드만 전송)
            const updatedUser = JSON.parse(JSON.stringify(targetUser));
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(updatedUser);
            
            // HTTP 응답에도 업데이트된 사용자 데이터 포함 (관리자 패널에서 즉시 반영을 위해)
            return {
                clientResponse: {
                    updatedUser,
                    targetUserId: targetUser.id
                }
            };
        }
        
        case 'ADMIN_RESET_TOURNAMENT_SESSION': {
            const { targetUserId, tournamentType } = payload as { targetUserId: string; tournamentType: TournamentType };
            const targetUser = await getCachedUser(targetUserId) || await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };

            // 토너먼트 타입에 따른 stateKey 결정
            let stateKey: keyof types.User;
            let playedDateKey: keyof types.User;
            switch (tournamentType) {
                case 'neighborhood':
                    stateKey = 'lastNeighborhoodTournament';
                    playedDateKey = 'lastNeighborhoodPlayedDate';
                    break;
                case 'national':
                    stateKey = 'lastNationalTournament';
                    playedDateKey = 'lastNationalPlayedDate';
                    break;
                case 'world':
                    stateKey = 'lastWorldTournament';
                    playedDateKey = 'lastWorldPlayedDate';
                    break;
                default:
                    return { error: 'Invalid tournament type.' };
            }

            // 1. 기존 토너먼트 세션 초기화
            (targetUser as any)[stateKey] = null;
            (targetUser as any)[playedDateKey] = 0;
            
            // volatileState에서도 제거 (해당 토너먼트 타입만)
            if (volatileState.activeTournaments?.[targetUserId]) {
                if (volatileState.activeTournaments[targetUserId].type === tournamentType) {
                    delete volatileState.activeTournaments[targetUserId];
                }
            }
            
            // 캐시 무효화
            invalidateUserCache(targetUserId);
            removeUserFromCache(targetUserId);
            
            await db.updateUser(targetUser);

            // 2. 새로운 토너먼트 세션 생성
            const definition = TOURNAMENT_DEFINITIONS[tournamentType];
            if (!definition) return { error: '유효하지 않은 토너먼트 타입입니다.' };

            // 캐시에서 최신 데이터 가져오기
            const freshUser = await getCachedUser(targetUserId) || await db.getUser(targetUserId);
            if (!freshUser) return { error: '사용자를 찾을 수 없습니다.' };

            const myLeague = freshUser.league;
            const neededOpponents = definition.players - 1;
            // 챔피언십은 봇 전용: 유저 vs 유저 매칭 금지
            const selectedOpponents: Array<{ id: string; nickname: string; avatarId: string; borderId: string; league: string }> = [];
            const botsToCreate = neededOpponents;
            const botNames = [...BOT_NAMES].sort(() => 0.5 - Math.random());
            
            // 봇 생성 함수 import
            const { createBotUser } = await import('./tournamentActions.js');
            
            const botUsers: types.User[] = [];
            for (let i = 0; i < botsToCreate; i++) {
                const botName = botNames[i % botNames.length];
                const botAvatar = AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];
                const botBorder = BORDER_POOL[Math.floor(Math.random() * BORDER_POOL.length)];
                const botId = `bot-${botName}-${i}`;
                
                // 봇 생성 함수 사용
                const botUser = createBotUser(myLeague, tournamentType, botId, botName, botAvatar, botBorder);
                botUsers.push(botUser);
                
                selectedOpponents.push({
                    id: botId,
                    nickname: botName,
                    avatarId: botAvatar.id,
                    borderId: botBorder.id,
                    league: myLeague,
                } as any);
            }
            
            // 오늘 0시 기준 타임스탬프 (능력치 고정용)
            const now = Date.now();
            const todayStartKST = getStartOfDayKST(now);
            
            const participants: types.PlayerForTournament[] = [freshUser, ...selectedOpponents].map(p => {
                let initialStats: Record<CoreStat, number>;
                if (p.id.startsWith('bot-')) {
                    const botUser = botUsers.find(b => b.id === p.id);
                    if (botUser) {
                        // calculateTotalStats로 봇의 최종 능력치 계산
                        initialStats = calculateTotalStats(botUser);
                    } else {
                        // 폴백: 기본 능력치 생성
                        const baseStatValue = 100;
                        const stats: Partial<Record<CoreStat, number>> = {};
                        for (const key of Object.values(CoreStat)) {
                            stats[key] = baseStatValue;
                        }
                        initialStats = stats as Record<CoreStat, number>;
                    }
                } else {
                    // 현재 유저만 여기 도달 (챔피언십은 봇 전용)
                    if (p.id === freshUser.id) {
                        initialStats = calculateTotalStats(freshUser);
                    } else {
                        const baseStatValue = 100;
                        const stats: Partial<Record<CoreStat, number>> = {};
                        for (const key of Object.values(CoreStat)) {
                            stats[key] = baseStatValue;
                        }
                        initialStats = stats as Record<CoreStat, number>;
                    }
                }
                
                return {
                    id: p.id,
                    nickname: p.nickname,
                    avatarId: p.avatarId,
                    borderId: p.borderId,
                    league: p.league,
                    stats: JSON.parse(JSON.stringify(initialStats)),
                    originalStats: initialStats,
                    wins: 0,
                    losses: 0,
                    condition: 1000,
                    statsTimestamp: todayStartKST, // 오늘 0시 기준 타임스탬프 저장
                };
            });
            
            // 참가자를 완전히 무작위로 섞기 (첫 번째 플레이어도 포함하여 섞음)
            // 하지만 freshUser가 토너먼트에 포함되는지 확인
            const allParticipantsShuffled = [...participants].sort(() => 0.5 - Math.random());
            
            // freshUser가 참가자 목록에 있는지 확인 (필수)
            const userInParticipants = allParticipantsShuffled.find(p => p.id === freshUser.id);
            if (!userInParticipants) {
                // 만약 freshUser가 목록에 없다면 첫 번째 위치에 추가
                allParticipantsShuffled.unshift(participants.find(p => p.id === freshUser.id)!);
            }
            
            const newState = tournamentService.createTournament(tournamentType, freshUser, allParticipantsShuffled);
            (freshUser as any)[stateKey] = newState;
            (freshUser as any)[playedDateKey] = now;
            
            await db.updateUser(freshUser);
            
            // 캐시 업데이트
            updateUserCache(freshUser);

            // volatileState에 새로운 토너먼트 추가
            if (!volatileState.activeTournaments) {
                volatileState.activeTournaments = {};
            }
            volatileState.activeTournaments[targetUserId] = newState;

            await createAdminLog(user, 'reset_tournament_session', targetUser, { tournamentType });

            // 최신 사용자 데이터를 다시 가져와서 브로드캐스트 (토너먼트 상태가 반영된 최신 데이터)
            const latestUser = await getCachedUser(targetUserId) || await db.getUser(targetUserId);
            if (latestUser) {
                // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화: 변경된 필드만 전송)
                const updatedUserCopy = JSON.parse(JSON.stringify(latestUser));
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(updatedUserCopy, ['lastNeighborhoodTournament', 'lastNationalTournament', 'lastWorldTournament', 'dungeonProgress']);
                
                // HTTP 응답에도 업데이트된 사용자 데이터 포함 (즉시 반영을 위해)
                return { 
                    clientResponse: { 
                        message: '토너먼트 세션이 성공적으로 재생성되었습니다.', 
                        tournamentType,
                        updatedUser: updatedUserCopy // 클라이언트에서 즉시 업데이트할 수 있도록
                    } 
                };
            } else {
                // 사용자를 찾을 수 없는 경우에도 기본 브로드캐스트 (최적화: 변경된 필드만 전송)
                const updatedUserCopy = JSON.parse(JSON.stringify(freshUser));
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(updatedUserCopy, ['lastNeighborhoodTournament', 'lastNationalTournament', 'lastWorldTournament', 'dungeonProgress']);
                
                return { 
                    clientResponse: { 
                        message: '토너먼트 세션이 성공적으로 재생성되었습니다.', 
                        tournamentType,
                        updatedUser: updatedUserCopy
                    } 
                };
            }
        }

        case 'ADMIN_RESET_ALL_TOURNAMENT_SESSIONS': {
            const { targetUserId } = payload as { targetUserId: string };
            const tournamentTypes: TournamentType[] = ['neighborhood', 'national', 'world'];
            for (const tournamentType of tournamentTypes) {
                const targetUser = await getCachedUser(targetUserId) || await db.getUser(targetUserId);
                if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };

                let stateKey: keyof types.User;
                let playedDateKey: keyof types.User;
                switch (tournamentType) {
                    case 'neighborhood': stateKey = 'lastNeighborhoodTournament'; playedDateKey = 'lastNeighborhoodPlayedDate'; break;
                    case 'national': stateKey = 'lastNationalTournament'; playedDateKey = 'lastNationalPlayedDate'; break;
                    case 'world': stateKey = 'lastWorldTournament'; playedDateKey = 'lastWorldPlayedDate'; break;
                    default: continue;
                }
                (targetUser as any)[stateKey] = null;
                (targetUser as any)[playedDateKey] = 0;
                if (volatileState.activeTournaments?.[targetUserId]?.type === tournamentType) {
                    delete volatileState.activeTournaments[targetUserId];
                }
                invalidateUserCache(targetUserId);
                removeUserFromCache(targetUserId);
                await db.updateUser(targetUser);

                const definition = TOURNAMENT_DEFINITIONS[tournamentType];
                if (!definition) continue;
                const freshUser = await getCachedUser(targetUserId) || await db.getUser(targetUserId);
                if (!freshUser) return { error: '사용자를 찾을 수 없습니다.' };
                const myLeague = freshUser.league;
                const neededOpponents = definition.players - 1;
                // 챔피언십은 봇 전용: 유저 vs 유저 매칭 금지
                const selectedOpponents: Array<{ id: string; nickname: string; avatarId: string; borderId: string; league: string }> = [];
                const botsToCreate = neededOpponents;
                const botNames = [...BOT_NAMES].sort(() => 0.5 - Math.random());
                const { createBotUser } = await import('./tournamentActions.js');
                const botUsers: types.User[] = [];
                for (let i = 0; i < botsToCreate; i++) {
                    const botName = botNames[i % botNames.length];
                    const botAvatar = AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];
                    const botBorder = BORDER_POOL[Math.floor(Math.random() * BORDER_POOL.length)];
                    const botId = `bot-${botName}-${i}`;
                    const botUser = createBotUser(myLeague, tournamentType, botId, botName, botAvatar, botBorder);
                    botUsers.push(botUser);
                    selectedOpponents.push({ id: botId, nickname: botName, avatarId: botAvatar.id, borderId: botBorder.id, league: myLeague } as any);
                }
                const now = Date.now();
                const todayStartKST = getStartOfDayKST(now);
                const participants: types.PlayerForTournament[] = [freshUser, ...selectedOpponents].map(p => {
                    let initialStats: Record<CoreStat, number>;
                    if (p.id.startsWith('bot-')) {
                        const botUser = botUsers.find(b => b.id === p.id);
                        if (botUser) initialStats = calculateTotalStats(botUser);
                        else {
                            const baseStatValue = 100;
                            const stats: Partial<Record<CoreStat, number>> = {};
                            for (const key of Object.values(CoreStat)) { stats[key] = baseStatValue; }
                            initialStats = stats as Record<CoreStat, number>;
                        }
                    } else {
                        if (p.id === freshUser.id) initialStats = calculateTotalStats(freshUser);
                        else {
                            const baseStatValue = 100;
                            const stats: Partial<Record<CoreStat, number>> = {};
                            for (const key of Object.values(CoreStat)) { stats[key] = baseStatValue; }
                            initialStats = stats as Record<CoreStat, number>;
                        }
                    }
                    return { id: p.id, nickname: p.nickname, avatarId: p.avatarId, borderId: p.borderId, league: p.league, stats: JSON.parse(JSON.stringify(initialStats)), originalStats: initialStats, wins: 0, losses: 0, condition: 1000, statsTimestamp: todayStartKST };
                });
                const allParticipantsShuffled = [...participants].sort(() => 0.5 - Math.random());
                if (!allParticipantsShuffled.find(p => p.id === freshUser.id)) {
                    allParticipantsShuffled.unshift(participants.find(p => p.id === freshUser.id)!);
                }
                const newState = tournamentService.createTournament(tournamentType, freshUser, allParticipantsShuffled);
                (freshUser as any)[stateKey] = newState;
                (freshUser as any)[playedDateKey] = now;
                await db.updateUser(freshUser);
                updateUserCache(freshUser);
                if (!volatileState.activeTournaments) volatileState.activeTournaments = {};
                volatileState.activeTournaments[targetUserId] = newState;
                await createAdminLog(user, 'reset_tournament_session', targetUser, { tournamentType });
            }
            const latestUser = await getCachedUser(targetUserId) || await db.getUser(targetUserId);
            if (latestUser) {
                const updatedUserCopy = JSON.parse(JSON.stringify(latestUser));
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(updatedUserCopy, ['lastNeighborhoodTournament', 'lastNationalTournament', 'lastWorldTournament', 'dungeonProgress']);
                return { clientResponse: { message: '동네바둑리그, 전국바둑대회, 월드챔피언십 모든 경기장이 초기화 및 재매칭되었습니다.', updatedUser: updatedUserCopy } };
            }
            return { error: '사용자를 찾을 수 없습니다.' };
        }
        
        case 'ADMIN_RESET_DUNGEON_PROGRESS': {
            const { targetUserId, dungeonType } = payload as { targetUserId: string; dungeonType?: TournamentType };
            const targetUser = await getCachedUser(targetUserId) || await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };

            // 던전 진행 상태 초기화
            if (!targetUser.dungeonProgress) {
                targetUser.dungeonProgress = {
                    neighborhood: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                    national: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                    world: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                };
            } else {
                if (dungeonType) {
                    // 특정 던전 타입만 초기화
                    targetUser.dungeonProgress[dungeonType] = {
                        currentStage: 0,
                        unlockedStages: [1],
                        stageResults: {},
                        dailyStageAttempts: {},
                    };
                } else {
                    // 모든 던전 타입 초기화
                    targetUser.dungeonProgress = {
                        neighborhood: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                        national: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                        world: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                    };
                }
            }

            // 캐시 무효화 및 업데이트
            invalidateUserCache(targetUserId);
            removeUserFromCache(targetUserId);
            await db.updateUser(targetUser);
            updateUserCache(targetUser);

            await createAdminLog(user, 'reset_dungeon_progress', targetUser, { dungeonType: dungeonType || 'all' });

            // 브로드캐스트
            const updatedUserCopy = JSON.parse(JSON.stringify(targetUser));
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(updatedUserCopy, ['dungeonProgress']);

            return {
                clientResponse: {
                    message: dungeonType 
                        ? `${TOURNAMENT_DEFINITIONS[dungeonType].name} 던전 진행 상태가 초기화되었습니다.`
                        : '모든 던전 진행 상태가 초기화되었습니다.',
                    updatedUser: updatedUserCopy
                }
            };
        }
        
        case 'ADMIN_RESET_CHAMPIONSHIP_ALL': {
            const { targetUserId } = payload as { targetUserId: string };
            const targetUser = await getCachedUser(targetUserId) || await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };

            // 1. 던전 진행 상태 초기화
            targetUser.dungeonProgress = {
                neighborhood: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                national: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                world: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
            };

            // 2. 토너먼트 상태 초기화
            targetUser.lastNeighborhoodTournament = null;
            targetUser.lastNationalTournament = null;
            targetUser.lastWorldTournament = null;
            targetUser.lastNeighborhoodPlayedDate = 0;
            targetUser.lastNationalPlayedDate = 0;
            targetUser.lastWorldPlayedDate = 0;

            // 3. 보상 수령 상태 초기화
            targetUser.neighborhoodRewardClaimed = false;
            targetUser.nationalRewardClaimed = false;
            targetUser.worldRewardClaimed = false;

            // 4. volatileState에서 제거
            if (volatileState.activeTournaments?.[targetUserId]) {
                delete volatileState.activeTournaments[targetUserId];
            }

            // 캐시 무효화 및 업데이트
            invalidateUserCache(targetUserId);
            removeUserFromCache(targetUserId);
            await db.updateUser(targetUser);
            updateUserCache(targetUser);

            await createAdminLog(user, 'reset_championship_all', targetUser, {});

            // 브로드캐스트
            const updatedUserCopy = JSON.parse(JSON.stringify(targetUser));
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(updatedUserCopy, [
                'dungeonProgress',
                'lastNeighborhoodTournament',
                'lastNationalTournament',
                'lastWorldTournament',
                'lastNeighborhoodPlayedDate',
                'lastNationalPlayedDate',
                'lastWorldPlayedDate',
                'neighborhoodRewardClaimed',
                'nationalRewardClaimed',
                'worldRewardClaimed'
            ]);

            return {
                clientResponse: {
                    message: '챔피언십 관련 모든 데이터가 초기화되었습니다.',
                    updatedUser: updatedUserCopy
                }
            };
        }

        case 'ADMIN_RESET_ALL_USERS_CHAMPIONSHIP': {
            db.invalidateUserCache('');
            const { invalidateRankingCache } = await import('../rankingCache.js');
            invalidateRankingCache();
            const prisma = (await import('../prismaClient.js')).default;
            const rows = await prisma.user.findMany({ select: { id: true, status: true } });
            const now = Date.now();
            const initialDungeonProgress = {
                neighborhood: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                national: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                world: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
            };
            if (volatileState.activeTournaments) {
                volatileState.activeTournaments = {};
            }
            let updatedCount = 0;
            for (const row of rows) {
                const status = row.status as Record<string, unknown> | null;
                const updatedStatus = status ? JSON.parse(JSON.stringify(status)) : {};
                if (updatedStatus.leagueMetadata && typeof updatedStatus.leagueMetadata === 'object') {
                    (updatedStatus.leagueMetadata as Record<string, unknown>).cumulativeTournamentScore = 0;
                }
                if (updatedStatus.serializedUser && typeof updatedStatus.serializedUser === 'object') {
                    (updatedStatus.serializedUser as Record<string, unknown>).cumulativeTournamentScore = 0;
                }
                await prisma.user.update({
                    where: { id: row.id },
                    data: { tournamentScore: 0, status: updatedStatus as object }
                });
                invalidateUserCache(row.id);
                removeUserFromCache(row.id);
                updatedCount++;
            }
            const allUsers = await db.getAllUsers();
            for (const targetUser of allUsers) {
                targetUser.dungeonProgress = JSON.parse(JSON.stringify(initialDungeonProgress));
                targetUser.lastNeighborhoodTournament = null;
                targetUser.lastNationalTournament = null;
                targetUser.lastWorldTournament = null;
                targetUser.lastNeighborhoodPlayedDate = 0;
                targetUser.lastNationalPlayedDate = 0;
                targetUser.lastWorldPlayedDate = 0;
                targetUser.neighborhoodRewardClaimed = false;
                targetUser.nationalRewardClaimed = false;
                targetUser.worldRewardClaimed = false;
                targetUser.cumulativeTournamentScore = 0;
                targetUser.tournamentScore = 0;
                targetUser.yesterdayTournamentScore = 0;
                if (targetUser.dailyRankings) {
                    (targetUser.dailyRankings as any).championship = { rank: 0, score: 0, lastUpdated: now };
                } else {
                    (targetUser as any).dailyRankings = { championship: { rank: 0, score: 0, lastUpdated: now } };
                }
                if ((targetUser as any).dailyDungeonScore !== undefined) (targetUser as any).dailyDungeonScore = 0;
                await db.updateUser(targetUser);
                updateUserCache(targetUser);
            }
            invalidateRankingCache();
            await createAdminLog(user, 'reset_championship_all', { id: 'all', nickname: '전체 유저' }, { updatedCount, totalUsers: rows.length });
            return {
                clientResponse: {
                    message: `전체 유저 챔피언십이 초기화되었습니다. (${updatedCount}명). 챔피언십 랭킹 보드는 새로고침 시 반영됩니다.`,
                    updatedCount,
                    totalUsers: rows.length
                }
            };
        }
        
        case 'ADMIN_CREATE_HOME_BOARD_POST': {
            const { title, content, isPinned } = payload;
            if (!title || !content) {
                return { error: '제목과 내용을 입력해주세요.' };
            }

            const post = await db.createHomeBoardPost({
                title,
                content,
                authorId: user.id,
                isPinned: isPinned || false
            });

            await createAdminLog(user, 'create_home_board_post', { id: user.id, nickname: user.nickname }, { postId: post.id, title });

            // 모든 게시글을 다시 로드하고 브로드캐스트
            const allPosts = await db.getAllHomeBoardPosts();
            broadcast({ type: 'HOME_BOARD_POSTS_UPDATE', payload: { homeBoardPosts: allPosts } });

            return { clientResponse: { message: '게시글이 작성되었습니다.', post } };
        }

        case 'ADMIN_UPDATE_HOME_BOARD_POST': {
            const { postId, title, content, isPinned } = payload;
            if (!title || !content) {
                return { error: '제목과 내용을 입력해주세요.' };
            }

            const existingPost = await db.getHomeBoardPost(postId);
            if (!existingPost) {
                return { error: '게시글을 찾을 수 없습니다.' };
            }

            const updatedPost = await db.updateHomeBoardPost(postId, {
                title,
                content,
                isPinned: isPinned || false
            });

            await createAdminLog(user, 'update_home_board_post', { id: user.id, nickname: user.nickname }, { postId, title });

            // 모든 게시글을 다시 로드하고 브로드캐스트
            const allPosts = await db.getAllHomeBoardPosts();
            broadcast({ type: 'HOME_BOARD_POSTS_UPDATE', payload: { homeBoardPosts: allPosts } });

            return { clientResponse: { message: '게시글이 수정되었습니다.', post: updatedPost } };
        }

        case 'ADMIN_DELETE_HOME_BOARD_POST': {
            const { postId } = payload;

            const existingPost = await db.getHomeBoardPost(postId);
            if (!existingPost) {
                return { error: '게시글을 찾을 수 없습니다.' };
            }

            await db.deleteHomeBoardPost(postId);
            await createAdminLog(user, 'delete_home_board_post', { id: user.id, nickname: user.nickname }, { postId, title: existingPost.title });

            // 모든 게시글을 다시 로드하고 브로드캐스트
            const allPosts = await db.getAllHomeBoardPosts();
            broadcast({ type: 'HOME_BOARD_POSTS_UPDATE', payload: { homeBoardPosts: allPosts } });

            return { clientResponse: { message: '게시글이 삭제되었습니다.' } };
        }
        
        case 'ADMIN_CLEAR_USER_GUILD': {
            const { targetUserId } = payload as { targetUserId: string };
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };

            const backupData = JSON.parse(JSON.stringify(targetUser));
            const oldGuildId = targetUser.guildId;

            // Clear guildId
            targetUser.guildId = undefined;
            await db.updateUser(targetUser);
            await createAdminLog(user, 'clear_user_guild', targetUser, { oldGuildId });

            // WebSocket으로 사용자 업데이트 브로드캐스트
            const updatedUser = JSON.parse(JSON.stringify(targetUser));
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(updatedUser, ['guildId']);

            return {
                clientResponse: {
                    message: '사용자의 길드 정보가 초기화되었습니다.',
                    updatedUser,
                    targetUserId: targetUser.id
                }
            };
        }

        case 'ADMIN_GUILD_WAR_RECHARGE_DAILY_ATTEMPTS': {
            const { targetUserId } = payload as { targetUserId: string };
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };
            if (!targetUser.guildId) return { error: '대상 사용자는 길드에 가입되어 있지 않습니다.' };

            const todayKST = getTodayKSTDateString();
            const canonicalTargetUserId = targetUser.isAdmin ? ADMIN_USER_ID : targetUser.id;

            const activeWars = (await db.getKV<any[]>('activeGuildWars')) || [];
            let updatedWarCount = 0;

            for (const war of activeWars) {
                if (war?.status !== 'active') continue;
                if (war?.guild1Id !== targetUser.guildId && war?.guild2Id !== targetUser.guildId) continue;

                if (!war.dailyAttempts) war.dailyAttempts = {};
                if (!war.dailyAttempts[canonicalTargetUserId]) war.dailyAttempts[canonicalTargetUserId] = {};

                const prev = war.dailyAttempts[canonicalTargetUserId][todayKST] ?? 0;
                if (prev !== 0) {
                    war.dailyAttempts[canonicalTargetUserId][todayKST] = 0; // usedToday=0 => 남은 횟수 MAX
                    updatedWarCount++;
                }
            }

            await db.setKV('activeGuildWars', activeWars);

            if (updatedWarCount > 0) {
                broadcast({ type: 'GUILD_WAR_UPDATE', payload: { activeWars } });
            }

            await createAdminLog(user, 'guild_war_recharge_daily_attempts', targetUser, {
                targetUserId: targetUser.id,
                canonicalTargetUserId,
                todayKST,
                updatedWarCount,
                rechargeToMax: GUILD_WAR_PERSONAL_DAILY_ATTEMPTS
            });

            return {
                clientResponse: {
                    message: `길드전 오늘 도전횟수를 초기화했습니다. (남은 횟수: ${GUILD_WAR_PERSONAL_DAILY_ATTEMPTS}회)`
                }
            };
        }

        case 'ADMIN_SAVE_USER_INVENTORY_EQUIPMENT': {
            const { targetUserId, inventory: invRaw, equipment: eqRaw } = payload as {
                targetUserId: string;
                inventory: unknown;
                equipment: unknown;
            };
            const targetUser = await db.getUser(targetUserId, { includeEquipment: true, includeInventory: true });
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };

            const backupData = JSON.parse(JSON.stringify(targetUser));
            let inventory = sanitizeAdminInventoryList(invRaw);
            const idSet = new Set(inventory.map((i) => i.id));
            const equipment = sanitizeAdminEquipment(eqRaw, idSet);
            applyEquippedFlagsFromEquipment(inventory, equipment);

            targetUser.inventory = inventory;
            targetUser.equipment = equipment;

            await db.updateUser(targetUser, { allowInventoryEquipmentClear: true });
            const { syncInventoryEquipmentToDatabase } = await import('../prisma/userService.js');
            await syncInventoryEquipmentToDatabase(targetUser);

            await createAdminLog(user, 'update_user_inventory', targetUser, backupData);

            const updatedUser = JSON.parse(JSON.stringify(targetUser));
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(updatedUser, ['inventory', 'equipment']);

            return {
                clientResponse: {
                    updatedUser,
                    targetUserId: targetUser.id,
                },
            };
        }

        case 'ADMIN_APPEND_INVENTORY_ITEMS': {
            const { targetUserId, equipmentAdds, stackableAdds } = payload as {
                targetUserId: string;
                equipmentAdds?: { name: string; quantity: number }[];
                stackableAdds?: { name: string; quantity: number; type: InventoryItemType }[];
            };
            const targetUser = await db.getUser(targetUserId, { includeEquipment: true, includeInventory: true });
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };

            const backupData = JSON.parse(JSON.stringify(targetUser));
            if (!Array.isArray(targetUser.inventory)) targetUser.inventory = [];

            if (Array.isArray(equipmentAdds)) {
                for (const row of equipmentAdds) {
                    const name = String(row?.name || '').trim();
                    const qty = Math.max(1, Math.min(50, Math.floor(Number(row?.quantity) || 1)));
                    if (!name) continue;
                    const template = EQUIPMENT_POOL.find((t) => t.name === name);
                    if (!template) continue;
                    for (let i = 0; i < qty; i++) {
                        targetUser.inventory.push(createItemFromTemplate(template));
                    }
                }
            }

            if (Array.isArray(stackableAdds)) {
                for (const row of stackableAdds) {
                    const name = String(row?.name || '').trim();
                    const qty = Math.max(1, Math.min(999999, Math.floor(Number(row?.quantity) || 1)));
                    const stype = row?.type;
                    if (!name || (stype !== 'consumable' && stype !== 'material')) continue;
                    const template = [...CONSUMABLE_ITEMS, ...Object.values(MATERIAL_ITEMS)].find((t) => t.name === name);
                    if (!template) continue;
                    targetUser.inventory.push({
                        ...(template as any),
                        id: `item-${randomUUID()}`,
                        createdAt: Date.now(),
                        isEquipped: false,
                        level: 1,
                        stars: 0,
                        quantity: qty,
                    });
                }
            }

            await db.updateUser(targetUser);
            const { syncInventoryEquipmentToDatabase } = await import('../prisma/userService.js');
            await syncInventoryEquipmentToDatabase(targetUser);

            await createAdminLog(user, 'append_inventory_items', targetUser, backupData);

            const updatedUser = JSON.parse(JSON.stringify(targetUser));
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(updatedUser, ['inventory']);

            return {
                clientResponse: {
                    updatedUser,
                    targetUserId: targetUser.id,
                },
            };
        }
        
        default:
            return { error: 'Unknown admin action type.' };
    }
};