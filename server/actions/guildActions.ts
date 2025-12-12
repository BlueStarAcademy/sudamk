import * as db from '../db.js';
import { 
    type ServerAction, 
    type User, 
    type VolatileState, 
    type HandleActionResult,
    type Guild,
    GuildMemberRole,
    GuildResearchId,
    type InventoryItem,
    type ChatMessage,
    type GuildBossBattleResult,
    type GuildMessage,
} from '../../types/index.js';
import { containsProfanity } from '../../profanity.js';
import { createDefaultGuild } from '../initialData.js';
import { GUILD_CREATION_COST, GUILD_DONATION_DIAMOND_COST, GUILD_DONATION_DIAMOND_LIMIT, GUILD_DONATION_DIAMOND_REWARDS, GUILD_DONATION_GOLD_COST, GUILD_DONATION_GOLD_LIMIT, GUILD_DONATION_GOLD_REWARDS, GUILD_LEAVE_COOLDOWN_MS, GUILD_RESEARCH_PROJECTS, GUILD_CHECK_IN_MILESTONE_REWARDS, GUILD_SHOP_ITEMS, CONSUMABLE_ITEMS, MATERIAL_ITEMS, GUILD_BOSSES } from '../../shared/constants/index.js';
import { EquipmentSlot, ItemGrade } from '../../types/enums.js';
import { generateNewItem } from './inventoryActions.js';
import * as currencyService from '../currencyService.js';
import * as guildService from '../guildService.js';
import { isSameDayKST, isDifferentWeekKST, isDifferentMonthKST } from '../../utils/timeUtils.js';
import { addItemsToInventory } from '../../utils/inventoryUtils.js';
import { openGuildGradeBox } from '../shop.js';
import { randomUUID } from 'crypto';
import { updateQuestProgress } from '../questService.js';
import { calculateGuildMissionXp } from '../../utils/guildUtils.js';
import { broadcast } from '../socket.js';

const getRandomInt = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getResearchCost = (researchId: GuildResearchId, level: number): number => {
    const project = GUILD_RESEARCH_PROJECTS[researchId];
    if (!project) return Infinity;
    return Math.floor(project.baseCost * Math.pow(project.costMultiplier, level));
};

const getResearchTimeMs = (researchId: GuildResearchId, level: number): number => {
    const project = GUILD_RESEARCH_PROJECTS[researchId];
    if(!project) return 0;
    const hours = project.baseTimeHours + (project.timeIncrementHours * level);
    return hours * 60 * 60 * 1000;
};


export const handleGuildAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type, payload } = action;
    if (process.env.NODE_ENV === 'development') {
        console.log(`[handleGuildAction] Received action: ${type}, userId: ${user.id}`);
    }
    let needsSave = false;
    
    // Get guilds from database
    const guilds = (await db.getKV<Record<string, Guild>>('guilds')) || {};
    
    // Import guildRepository to check GuildMember
    const guildRepo = await import('../prisma/guildRepository.js');

    // Lazy migration for chat message IDs to support deleting old messages
    for (const guild of Object.values(guilds)) {
        if (guild.chatHistory) {
            for (const msg of guild.chatHistory) {
                // Only add IDs to user messages that are missing one and have a valid user object
                if (!msg.id && !msg.system && msg.user && typeof msg.user.id === 'string') {
                    msg.id = `msg-guild-${globalThis.crypto.randomUUID()}`;
                    needsSave = true;
                }
            }
        }
    }

    if (needsSave) {
        await db.setKV('guilds', guilds);
        await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
    }


    switch (type) {
        case 'CREATE_GUILD': {
            try {
                const { name, description, isPublic, joinType } = payload;
            
            // Validate name
            if (!name || typeof name !== 'string') {
                return { error: '길드 이름을 입력해주세요.' };
            }
            const trimmedName = name.trim();
            if (trimmedName.length < 2 || trimmedName.length > 6) {
                return { error: '길드 이름은 2자 이상 6자 이하여야 합니다.' };
            }
            
            // Validate description if provided
            const trimmedDescription = description ? String(description).trim() : '';
            if (trimmedDescription && trimmedDescription.length > 200) {
                return { error: '길드 설명은 200자 이하여야 합니다.' };
            }
            
            // Check for profanity
            if (containsProfanity(trimmedName) || (trimmedDescription && containsProfanity(trimmedDescription))) {
                return { error: '부적절한 단어가 포함되어 있습니다.' };
            }
            
            // For admin users, check and remove any existing guild leadership or membership
            if (user.isAdmin) {
                // Check if admin is a leader of a guild
                const existingLeaderGuild = await guildRepo.getGuildByLeaderId(user.id);
                if (existingLeaderGuild) {
                    console.log(`[CREATE_GUILD] Admin user ${user.id} is already a leader of guild ${existingLeaderGuild.id}, deleting it...`);
                    await guildRepo.deleteGuild(existingLeaderGuild.id);
                }
                
                // Check and remove GuildMember if exists
                const existingGuildMember = await guildRepo.getGuildMemberByUserId(user.id);
                if (existingGuildMember) {
                    console.log(`[CREATE_GUILD] Admin user ${user.id} is a member of guild ${existingGuildMember.guildId}, removing membership...`);
                    await guildRepo.removeGuildMember(existingGuildMember.guildId, user.id);
                }
                
                // Clear user.guildId if set (will be updated after guild creation)
                if (user.guildId) {
                    user.guildId = undefined;
                    // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
                    db.updateUser(user).catch(err => {
                        console.error(`[CREATE_GUILD] Failed to clear guildId for user ${user.id}:`, err);
                    });
                }
            } else {
                // For non-admin users, check if already in a guild
                const existingGuildMember = await guildRepo.getGuildMemberByUserId(user.id);
                if (existingGuildMember || user.guildId) {
                    return { error: '?��? 길드??가?�되???�습?�다.' };
                }
            }
            
            if (!user.isAdmin) {
                // ?�이?�몬???�??변??(BigInt?????�음)
                const userDiamonds = typeof user.diamonds === 'bigint' ? Number(user.diamonds) : (user.diamonds || 0);
                if (userDiamonds < GUILD_CREATION_COST) {
                    return { error: `?�이?��? 부족합?�다. (?�요: ${GUILD_CREATION_COST}�? 보유: ${userDiamonds}�?` };
                }
                currencyService.spendDiamonds(user, GUILD_CREATION_COST, '길드 창설');
            }
            
            // Check for duplicate name using Prisma (to ensure consistency with delete operations)
            const existingGuild = await guildRepo.getGuildByName(trimmedName);
            if (existingGuild) {
                return { error: '?��? ?�용 중인 길드 ?�름?�니??' };
            }

            const guildId = `guild-${globalThis.crypto.randomUUID()}`;
            const newGuild = createDefaultGuild(guildId, trimmedName, trimmedDescription || undefined, isPublic, user);
            
            // 중간???�성??길드???�음 매칭(?�요???�는 금요????참여
            const { getKSTDay, getStartOfDayKST } = await import('../../utils/timeUtils.js');
            const now = Date.now();
            const kstDay = getKSTDay(now);
            const todayStart = getStartOfDayKST(now);
            
            // ?�음 매칭 ?�짜 계산
            let daysUntilNext = 0;
            if (kstDay === 1) {
                // ?�요??- 금요?�까지 (4????
                daysUntilNext = 4;
            } else if (kstDay === 2 || kstDay === 3) {
                // ?�요?? ?�요??- 금요?�까지
                daysUntilNext = 5 - kstDay;
            } else if (kstDay === 4) {
                // 목요??- ?�음 ?�요?�까지 (3????
                daysUntilNext = 3;
            } else if (kstDay === 5) {
                // 금요??- ?�음 ?�요?�까지 (3????
                daysUntilNext = 3;
            } else {
                // ?�요?? ?�요??- ?�음 ?�요?�까지
                daysUntilNext = (8 - kstDay) % 7;
            }
            
            const nextMatchDate = todayStart + (daysUntilNext * 24 * 60 * 60 * 1000);
            (newGuild as any).nextWarMatchDate = nextMatchDate;
            
            guilds[guildId] = newGuild;
            
            // Also create guild in Prisma database for consistency
            try {
                await guildRepo.createGuild({
                    name: trimmedName,
                    leaderId: user.id,
                    description: trimmedDescription || undefined,
                    emblem: newGuild.icon,
                    settings: { isPublic, joinType: joinType || 'free' },
                });
                // Creator is automatically added as leader by createGuild
            } catch (error: any) {
                // Prisma unique 제약 조건 위반 시 에러 처리
                if (error.code === 'P2002' || error.message?.includes('Unique constraint') || error.message?.includes('UNIQUE constraint')) {
                    console.error('[CREATE_GUILD] Guild name conflict detected:', error);
                    // KV store에서도 롤백
                    delete guilds[guildId];
                    await db.setKV('guilds', guilds);
                    return { error: '이미 사용 중인 길드 이름입니다.' };
                }
                console.error('[CREATE_GUILD] Failed to create guild in Prisma:', error);
                // Continue even if Prisma creation fails - KV store is primary
            }
            
            // Update user's guildId
            user.guildId = guildId;
            
            await db.setKV('guilds', guilds);
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            
            // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
            db.updateUser(user).catch(err => {
                console.error(`[CREATE_GUILD] Failed to save user ${user.id}:`, err);
            });

            // WebSocket?�로 ?�용???�데?�트 브로?�캐?�트 (최적?�된 ?�수 ?�용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['guildId', 'diamonds']);
            
                return { clientResponse: { guild: newGuild, updatedUser: user } };
            } catch (error: any) {
                console.error('[CREATE_GUILD] 오류:', error);
                return { error: error.message || '길드 창설에 실패했습니다.' };
            }
        }
        
        case 'JOIN_GUILD': {
            try {
                const { guildId } = payload;
                if (!guildId) {
                    return { error: '길드 ID가 필요합니다.' };
                }
                
                // Check if guild exists in KV store or Prisma
                let guild = guilds[guildId];
                let dbGuild = await guildRepo.getGuildById(guildId);
                
                if (!guild && !dbGuild) {
                    return { error: '길드를 찾을 수 없습니다.' };
                }
                
                // KV store에만 있는 경우 Prisma에 동기화
                if (guild && !dbGuild) {
                    console.log(`[JOIN_GUILD] KV store에만 있는 길드를 Prisma에 동기화: ${guildId}`);
                    try {
                        // Prisma에 길드 생성
                        await guildRepo.createGuild({
                            name: guild.name,
                            leaderId: guild.leaderId,
                            description: guild.description,
                            emblem: guild.icon,
                            settings: guild.settings || { isPublic: guild.isPublic !== false, joinType: guild.joinType || 'free' },
                        });
                        // 기존 멤버들도 Prisma에 추가
                        if (guild.members && guild.members.length > 0) {
                            for (const member of guild.members) {
                                try {
                                    await guildRepo.addGuildMember(guildId, member.userId, member.role || 'member');
                                } catch (err: any) {
                                    // 이미 존재하는 경우 무시
                                    if (err.code !== 'P2002') {
                                        console.error(`[JOIN_GUILD] Failed to sync member ${member.userId}:`, err);
                                    }
                                }
                            }
                        }
                        dbGuild = await guildRepo.getGuildById(guildId);
                    } catch (error: any) {
                        console.error('[JOIN_GUILD] Failed to sync guild to Prisma:', error);
                        // Prisma 동기화 실패해도 계속 진행 (KV store가 primary)
                    }
                }
                
                // Prisma에만 있는 경우 KV store에 동기화
                if (!guild && dbGuild) {
                    const dbMembers = await guildRepo.getGuildMembers(guildId);
                    const dbSettings = (dbGuild.settings as any) || {};
                    guild = {
                        id: dbGuild.id,
                        name: dbGuild.name,
                        leaderId: dbGuild.leaderId,
                        description: dbGuild.description || undefined,
                        icon: dbGuild.emblem || '/images/guild/profile/icon1.png',
                        level: dbGuild.level,
                        gold: Number(dbGuild.gold),
                        experience: Number(dbGuild.experience),
                        xp: Number(dbGuild.experience),
                        researchPoints: 0,
                        members: dbMembers.map(m => ({
                            id: m.id,
                            guildId: m.guildId,
                            userId: m.userId,
                            nickname: '',
                            role: m.role as 'leader' | 'officer' | 'member',
                            joinDate: m.joinDate,
                            contributionTotal: m.contributionTotal,
                            weeklyContribution: 0,
                            createdAt: m.createdAt,
                            updatedAt: m.updatedAt,
                        })),
                        memberLimit: 30,
                        isPublic: dbSettings.isPublic !== undefined ? dbSettings.isPublic : true,
                        joinType: dbSettings.joinType || 'free',
                        settings: dbSettings,
                        applicants: [],
                        weeklyMissions: [],
                        lastMissionReset: Date.now(),
                        lastWeeklyContributionReset: Date.now(),
                        chatHistory: [],
                        checkIns: {},
                        dailyCheckInRewardsClaimed: [],
                        research: {},
                        researchTask: null,
                        createdAt: dbGuild.createdAt,
                        updatedAt: dbGuild.updatedAt,
                    };
                    guilds[guildId] = guild;
                }
                
                if (user.guildId) {
                    return { error: '이미 길드에 가입되어 있습니다.' };
                }
                
                if (!guild.members) guild.members = [];
                if (guild.members.length >= (guild.memberLimit || 30)) {
                    return { error: '길드 인원이 가득 찼습니다.' };
                }

                // joinType에 따라 가입 방식 결정
                const joinType = guild.joinType || (guild.settings as any)?.joinType || 'free';
                const isApplicationPending = guild.applicants?.some((app: any) => 
                    (typeof app === 'string' ? app : app.userId) === user.id
                );

                if (joinType === 'free') {
                    // 자유가입: 빈자리가 있으면 자동 가입
                    if (!guild.members) guild.members = [];
                    const memberId = `member-${user.id}-${guild.id}`;
                    guild.members.push({
                        id: memberId,
                        guildId: guild.id,
                        userId: user.id,
                        nickname: user.nickname || '',
                        role: GuildMemberRole.Member,
                        joinDate: Date.now(),
                        contributionTotal: 0,
                        weeklyContribution: 0,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    });
                    user.guildId = guild.id;
                    
                    // Prisma에 GuildMember 추가 (Prisma에 길드가 있는지 먼저 확인)
                    try {
                        const dbGuildCheck = await guildRepo.getGuildById(guild.id);
                        if (!dbGuildCheck) {
                            // Prisma에 길드가 없으면 먼저 생성
                            console.log(`[JOIN_GUILD] Prisma에 길드가 없어서 생성: ${guild.id}`);
                            await guildRepo.createGuild({
                                name: guild.name,
                                leaderId: guild.leaderId,
                                description: guild.description,
                                emblem: guild.icon,
                                settings: guild.settings || { isPublic: guild.isPublic !== false, joinType: guild.joinType || 'free' },
                            });
                        }
                        await guildRepo.addGuildMember(guild.id, user.id, 'member');
                    } catch (error: any) {
                        // 이미 멤버인 경우 무시
                        if (error.code === 'P2002') {
                            console.log(`[JOIN_GUILD] User ${user.id} is already a member of guild ${guild.id}`);
                        } else {
                            console.error('[JOIN_GUILD] Failed to add GuildMember in Prisma:', error);
                        }
                    }
                    
                    // 기존 신청서 제거
                    if (guild.applicants) {
                        guild.applicants = guild.applicants.filter((app: any) => 
                            (typeof app === 'string' ? app : app.userId) !== user.id
                        );
                    }
                    if (user.guildApplications) {
                        user.guildApplications = user.guildApplications.filter(app => app.guildId !== guildId);
                    }
                } else {
                    // 신청가입: 길드장의 승인이 필요
                    if (isApplicationPending) {
                        return { error: '이미 가입 신청중입니다.' };
                    }
                    if (!guild.applicants) guild.applicants = [];
                    guild.applicants.push({ userId: user.id, appliedAt: Date.now() });
                    if (!user.guildApplications) user.guildApplications = [];
                    user.guildApplications.push({ guildId: guild.id, appliedAt: Date.now() });
                }

                await db.setKV('guilds', guilds);
                await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
                
                // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
                db.updateUser(user).catch(err => {
                    console.error(`[JOIN_GUILD] Failed to save user ${user.id}:`, err);
                });

                // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 필수 필드만 사용)
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['guildId', 'guildApplications']);
                
                if (joinType === 'free') {
                    return { clientResponse: { guild, updatedUser: user } };
                } else {
                    return { clientResponse: { updatedUser: user } };
                }
            } catch (error: any) {
                console.error('[JOIN_GUILD] 오류:', error);
                return { error: error.message || '길드 가입에 실패했습니다.' };
            }
        }
        
        case 'LIST_GUILDS': {
            try {
                const { searchQuery, limit } = payload;
                const query = searchQuery?.trim() || '';
                const limitNum = limit || 100;
                
                console.log(`[LIST_GUILDS] Search query: "${query}", limit: ${limitNum}`);
                
                // Prisma를 통해 길드 목록 조회
                const dbGuilds = await guildRepo.listGuilds(query, limitNum);
                
                console.log(`[LIST_GUILDS] Found ${dbGuilds.length} guild(s) from Prisma`);
                
                // KV store의 길드 데이터와 병합
                const resultGuilds = await Promise.all(
                    dbGuilds.map(async (dbGuild) => {
                        const kvGuild = guilds[dbGuild.id];
                        if (kvGuild) {
                            // KV store에 있으면 KV 데이터 사용
                            return {
                                id: kvGuild.id,
                                name: kvGuild.name,
                                description: kvGuild.description || undefined,
                                icon: kvGuild.icon?.startsWith('/images/guild/icon') 
                                    ? kvGuild.icon.replace('/images/guild/icon', '/images/guild/profile/icon')
                                    : (kvGuild.icon || '/images/guild/profile/icon1.png'),
                                level: kvGuild.level,
                                memberCount: kvGuild.members?.length || 0,
                                memberLimit: kvGuild.memberLimit || 30,
                                isPublic: kvGuild.isPublic !== false,
                            };
                        } else {
                            // KV store에 없으면 DB 데이터 사용
                            const dbIcon = dbGuild.emblem || '/images/guild/profile/icon1.png';
                            const dbSettings = (dbGuild.settings as any) || {};
                            const dbIsPublic = dbSettings.isPublic !== undefined ? dbSettings.isPublic : true;
                            
                            return {
                                id: dbGuild.id,
                                name: dbGuild.name,
                                description: dbGuild.description || undefined,
                                icon: dbIcon.startsWith('/images/guild/icon') 
                                    ? dbIcon.replace('/images/guild/icon', '/images/guild/profile/icon')
                                    : dbIcon,
                                level: dbGuild.level,
                                memberCount: dbGuild.memberCount,
                                memberLimit: 30,
                                isPublic: dbIsPublic,
                            };
                        }
                    })
                );
                
                // 이미 추가된 길드 ID 추적 (중복 방지)
                const addedGuildIds = new Set(resultGuilds.map(g => g.id));
                
                // KV store에만 있고 Prisma에 없는 길드도 추가 (검색 쿼리가 비어있거나 매칭되는 경우)
                if (!query || query.length === 0) {
                    // 검색 쿼리가 없으면 KV store의 모든 공개 길드 추가
                    for (const [guildId, kvGuild] of Object.entries(guilds)) {
                        // 중복 체크: 이미 추가된 길드는 건너뛰기
                        if (!addedGuildIds.has(guildId)) {
                            const isPublic = kvGuild.isPublic !== false;
                            if (isPublic) {
                                resultGuilds.push({
                                    id: kvGuild.id,
                                    name: kvGuild.name,
                                    description: kvGuild.description || undefined,
                                    icon: kvGuild.icon?.startsWith('/images/guild/icon') 
                                        ? kvGuild.icon.replace('/images/guild/icon', '/images/guild/profile/icon')
                                        : (kvGuild.icon || '/images/guild/profile/icon1.png'),
                                    level: kvGuild.level,
                                    memberCount: kvGuild.members?.length || 0,
                                    memberLimit: kvGuild.memberLimit || 30,
                                    isPublic: isPublic,
                                });
                                addedGuildIds.add(guildId); // 추가된 길드 ID 기록
                            }
                        }
                    }
                } else {
                    // 검색 쿼리가 있으면 KV store에서도 검색
                    const lowerQuery = query.toLowerCase();
                    for (const [guildId, kvGuild] of Object.entries(guilds)) {
                        // 중복 체크: 이미 추가된 길드는 건너뛰기
                        if (!addedGuildIds.has(guildId)) {
                            const isPublic = kvGuild.isPublic !== false;
                            const nameMatch = kvGuild.name?.toLowerCase().includes(lowerQuery);
                            const descMatch = kvGuild.description?.toLowerCase().includes(lowerQuery);
                            
                            if (isPublic && (nameMatch || descMatch)) {
                                resultGuilds.push({
                                    id: kvGuild.id,
                                    name: kvGuild.name,
                                    description: kvGuild.description || undefined,
                                    icon: kvGuild.icon?.startsWith('/images/guild/icon') 
                                        ? kvGuild.icon.replace('/images/guild/icon', '/images/guild/profile/icon')
                                        : (kvGuild.icon || '/images/guild/profile/icon1.png'),
                                    level: kvGuild.level,
                                    memberCount: kvGuild.members?.length || 0,
                                    memberLimit: kvGuild.memberLimit || 30,
                                    isPublic: isPublic,
                                });
                                addedGuildIds.add(guildId); // 추가된 길드 ID 기록
                            }
                        }
                    }
                }
                
                // 공개 길드만 필터링 (이미 isPublic 체크를 했지만 안전을 위해 한 번 더)
                const filteredGuilds = resultGuilds.filter(g => g.isPublic !== false);
                
                // 최종 중복 제거 (ID와 이름 모두 체크)
                const uniqueGuildsById = Array.from(
                    new Map(filteredGuilds.map(g => [g.id, g])).values()
                );
                
                // 이름으로도 중복 제거 (같은 이름의 길드는 하나만 유지 - 가장 오래된 것)
                const uniqueGuildsByName = new Map<string, typeof filteredGuilds[0]>();
                for (const guild of uniqueGuildsById) {
                    const existing = uniqueGuildsByName.get(guild.name);
                    if (!existing || guild.id < existing.id) {
                        // 같은 이름이 없거나, 더 작은 ID(오래된 것)를 유지
                        uniqueGuildsByName.set(guild.name, guild);
                    }
                }
                
                const uniqueGuilds = Array.from(uniqueGuildsByName.values());
                
                console.log(`[LIST_GUILDS] Total guilds after filtering: ${filteredGuilds.length}, unique: ${uniqueGuilds.length}`);
                
                // 정렬: 레벨 내림차순, 이름 오름차순
                uniqueGuilds.sort((a, b) => {
                    if (b.level !== a.level) return b.level - a.level;
                    return a.name.localeCompare(b.name);
                });
                
                console.log(`[LIST_GUILDS] Returning ${uniqueGuilds.length} unique guild(s) to client`);
                
                return { 
                    clientResponse: { 
                        guilds: uniqueGuilds,
                        total: uniqueGuilds.length
                    } 
                };
            } catch (error: any) {
                console.error('[LIST_GUILDS] 오류:', error);
                return { 
                    error: error.message || '길드 목록을 불러오는데 실패했습니다.' 
                };
            }
        }

        case 'GUILD_CANCEL_APPLICATION': {
            const { guildId } = payload;
            const guild = guilds[guildId];
            if (guild && guild.applicants) {
                guild.applicants = guild.applicants.filter((app: any) => 
                    (typeof app === 'string' ? app : app.userId) !== user.id
                );
                await db.setKV('guilds', guilds);
                await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            }
                if (user.guildApplications) {
                    user.guildApplications = user.guildApplications.filter(app => app.guildId !== guildId);
                    // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
                    db.updateUser(user).catch(err => {
                        console.error(`[GUILD_CANCEL_APPLICATION] Failed to save user ${user.id}:`, err);
                    });

                    // WebSocket?�로 ?�용???�데?�트 브로?�캐?�트 (최적?�된 ?�수 ?�용)
                    const { broadcastUserUpdate } = await import('../socket.js');
                    broadcastUserUpdate(user, ['guildApplications']);
                }
            return { clientResponse: { updatedUser: user } };
        }
        
        case 'GUILD_ACCEPT_APPLICANT': {
            const { guildId, applicantId } = payload;
            const guild = guilds[guildId];
            if (!guild || !guild.members) return { error: '길드�?찾을 ???�습?�다.' };
            const myMemberInfo = guild.members.find(m => m.userId === user.id);
            if (!myMemberInfo || (myMemberInfo.role !== GuildMemberRole.Master && myMemberInfo.role !== GuildMemberRole.Vice)) {
                return { error: '권한???�습?�다.' };
            }
            if (guild.members.length >= (guild.memberLimit || 30)) return { error: '길드 ?�원??가??찼습?�다.' };

            const applicant = await db.getUser(applicantId);
            if (!applicant || applicant.guildId) {
                if (guild.applicants) {
                    guild.applicants = guild.applicants.filter((app: any) => 
                        (typeof app === 'string' ? app : app.userId) !== applicantId
                    );
                }
                await db.setKV('guilds', guilds);
                return { error: '?�?�이 ?��? ?�른 길드??가?�했?�니??' };
            }

            if (!guild.members) guild.members = [];
            guild.members.push({ 
                id: `member-${applicant.id}-${guild.id}`,
                guildId: guild.id,
                userId: applicant.id, 
                nickname: applicant.nickname, 
                role: GuildMemberRole.Member, 
                joinDate: Date.now(), 
                contributionTotal: 0, 
                weeklyContribution: 0,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            if (guild.applicants) {
                guild.applicants = guild.applicants.filter((app: any) => 
                    (typeof app === 'string' ? app : app.userId) !== applicantId
                );
            }
            applicant.guildId = guild.id;
            if (applicant.guildApplications) {
                applicant.guildApplications = applicant.guildApplications.filter(app => app.guildId !== guildId);
            }
            await db.setKV('guilds', guilds);
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            
            // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
            db.updateUser(applicant).catch(err => {
                console.error(`[GUILD_ACCEPT_APPLICANT] Failed to save applicant ${applicant.id}:`, err);
            });

            // WebSocket?�로 ?�용???�데?�트 브로?�캐?�트 (최적?�된 ?�수 ?�용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(applicant, ['guildId', 'guildApplications']);
            
            return { clientResponse: { guilds } };
        }

        case 'GUILD_REJECT_APPLICANT': {
            const { guildId, applicantId } = payload;
            const guild = guilds[guildId];
            const myMemberInfo = guild?.members.find(m => m.userId === user.id);
             if (!guild || !myMemberInfo || (myMemberInfo.role !== GuildMemberRole.Master && myMemberInfo.role !== GuildMemberRole.Vice)) {
                return { error: '권한???�습?�다.' };
            }
            if (guild.applicants) {
                guild.applicants = guild.applicants.filter((app: any) => 
                    (typeof app === 'string' ? app : app.userId) !== applicantId
                );
            }
            
            const applicant = await db.getUser(applicantId);
            if (applicant && applicant.guildApplications) {
                applicant.guildApplications = applicant.guildApplications.filter(app => app.guildId !== guildId);
                
                // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
                db.updateUser(applicant).catch(err => {
                    console.error(`[GUILD_REJECT_APPLICANT] Failed to save applicant ${applicant.id}:`, err);
                });

                // WebSocket?�로 ?�용???�데?�트 브로?�캐?�트 (최적?�된 ?�수 ?�용)
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(applicant, ['guildApplications']);
            }

            await db.setKV('guilds', guilds);
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            return { clientResponse: { guilds } };
        }

        case 'GUILD_LEAVE':
        case 'LEAVE_GUILD': {
            // guildId가 payload에 없으면 user.guildId 사용
            const guildId = (payload as any)?.guildId || user.guildId;
            if (!guildId) {
                return { error: '가입한 길드가 없습니다.' };
            }
            
            const guild = guilds[guildId];
            if (!guild) {
                // KV store에 없으면 Prisma에서 확인
                const dbGuild = await guildRepo.getGuildById(guildId);
                if (!dbGuild) {
                    return { error: '길드 정보를 찾을 수 없습니다.' };
                }
                // Prisma에만 있는 경우, 사용자의 GuildMember 관계만 삭제
                const guildMember = await guildRepo.getGuildMemberByUserId(user.id);
                if (guildMember && guildMember.guildId === guildId) {
                    await guildRepo.removeGuildMember(guildId, user.id);
                }
                
                // 사용자 정보 업데이트
                user.guildId = undefined;
                if (user.status && typeof user.status === 'object') {
                    const status = { ...(user.status as any) };
                    delete status.guildId;
                    user.status = status;
                }
                
                await db.updateUser(user);
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['guildId']);
                
                return { clientResponse: { updatedUser: user } };
            }
            
            if (user.guildId !== guildId) {
                return { error: '가입한 길드가 아닙니다.' };
            }
            
            const memberInfo = guild.members?.find((m: any) => m.userId === user.id);
            if (!memberInfo) {
                return { error: '길드원이 아닙니다.' };
            }
            
            // 길드장이 다른 멤버가 있을 때 탈퇴하려면 위임 필요
            if (memberInfo.role === GuildMemberRole.Master && (guild.members?.length || 0) > 1) {
                return { error: '길드장이 길드를 떠나려면 먼저 다른 길드원에게 길드장을 위임해야 합니다.' };
            }
            
            // 마지막 멤버인 경우 길드 해체
            if (memberInfo.role === GuildMemberRole.Master && (guild.members?.length || 0) === 1) {
                // Prisma에서도 길드 삭제
                try {
                    await guildRepo.deleteGuild(guildId);
                } catch (error: any) {
                    console.error(`[GUILD_LEAVE] Failed to delete guild from Prisma: ${error.message}`);
                }
                delete guilds[guildId]; // KV store에서도 삭제
            } else {
                // 일반 멤버 탈퇴
                guild.members = guild.members?.filter((m: any) => m.userId !== user.id) || [];
                
                // Prisma에서도 GuildMember 관계 삭제
                try {
                    await guildRepo.removeGuildMember(guildId, user.id);
                } catch (error: any) {
                    console.error(`[GUILD_LEAVE] Failed to remove guild member from Prisma: ${error.message}`);
                }
            }
            
            // 사용자 정보 업데이트
            user.guildId = undefined;
            if (user.status && typeof user.status === 'object') {
                const status = { ...(user.status as any) };
                delete status.guildId;
                if (status.guildApplications) {
                    status.guildApplications = Array.isArray(status.guildApplications)
                        ? status.guildApplications.filter((app: any) => app.guildId !== guildId)
                        : undefined;
                }
                user.status = status;
            }
            
            await db.setKV('guilds', guilds);
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            await db.updateUser(user);
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['guildId']);
            
            return { clientResponse: { updatedUser: user, guilds } };
        }

        case 'GUILD_KICK_MEMBER': {
            const { guildId, targetMemberId } = payload;
            const guild = guilds[guildId];
            if (!guild || !guild.members) return { error: '길드�?찾을 ???�습?�다.' };
            const myMemberInfo = guild.members.find(m => m.userId === user.id);
            const targetMemberInfo = guild.members.find(m => m.userId === targetMemberId);

            if (!myMemberInfo || !targetMemberInfo) return { error: '?�보�?찾을 ???�습?�다.' };
            if ((myMemberInfo.role === GuildMemberRole.Master && targetMemberInfo.role !== GuildMemberRole.Master) || 
                (myMemberInfo.role === GuildMemberRole.Vice && targetMemberInfo.role === GuildMemberRole.Member)) {
                
                guild.members = guild.members.filter(m => m.userId !== targetMemberId);
                const targetUser = await db.getUser(targetMemberId);
                if (targetUser) {
                    targetUser.guildId = undefined;
                    
                    // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
                    db.updateUser(targetUser).catch(err => {
                        console.error(`[GUILD_KICK_MEMBER] Failed to save target user ${targetUser.id}:`, err);
                    });

                    // WebSocket?�로 ?�용???�데?�트 브로?�캐?�트 (최적?�된 ?�수 ?�용)
                    const { broadcastUserUpdate } = await import('../socket.js');
                    broadcastUserUpdate(targetUser, ['guildId']);
                }
                await db.setKV('guilds', guilds);
                await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            } else {
                return { error: '권한???�습?�다.' };
            }
            return { clientResponse: { guilds } };
        }
        
        case 'GUILD_PROMOTE_MEMBER':
        case 'GUILD_DEMOTE_MEMBER': {
             const { guildId, targetMemberId } = payload;
            const guild = guilds[guildId];
            if (!guild || !guild.members) return { error: '길드�?찾을 ???�습?�다.' };
            const myMemberInfo = guild.members.find(m => m.userId === user.id);
            const targetMemberInfo = guild.members.find(m => m.userId === targetMemberId);
            if (!myMemberInfo || !targetMemberInfo || myMemberInfo.role !== GuildMemberRole.Master) {
                return { error: '권한???�습?�다.' };
            }
            if (type === 'GUILD_PROMOTE_MEMBER' && targetMemberInfo.role === GuildMemberRole.Member) {
                targetMemberInfo.role = GuildMemberRole.Vice;
            } else if (type === 'GUILD_DEMOTE_MEMBER' && targetMemberInfo.role === GuildMemberRole.Vice) {
                targetMemberInfo.role = GuildMemberRole.Member;
            }
            await db.setKV('guilds', guilds);
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            return { clientResponse: { guilds } };
        }
        
        case 'GUILD_TRANSFER_MASTERSHIP': {
            const { guildId, targetMemberId } = payload;
            const guild = guilds[guildId];
            if (!guild || !guild.members) return { error: '길드�?찾을 ???�습?�다.' };
            const myMemberInfo = guild.members.find(m => m.userId === user.id);
            const targetMemberInfo = guild.members.find(m => m.userId === targetMemberId);

            if (!myMemberInfo || !targetMemberInfo || myMemberInfo.role !== GuildMemberRole.Master) {
                return { error: '권한???�습?�다.' };
            }
            if (myMemberInfo.userId === targetMemberId) {
                return { error: '?�기 ?�신?�게 ?�임?????�습?�다.' };
            }
            
            myMemberInfo.role = GuildMemberRole.Member;
            await db.setKV('guilds', guilds);
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            return { clientResponse: { guilds } };
        }

        case 'GUILD_UPDATE_PROFILE': {
             const { guildId, description, isPublic, icon, joinType } = payload;
            const guild = guilds[guildId];
            const myMemberInfo = guild?.members.find(m => m.userId === user.id);
            if (!guild || !myMemberInfo || (myMemberInfo.role !== GuildMemberRole.Master && myMemberInfo.role !== GuildMemberRole.Vice)) {
                return { error: '권한???�습?�다.' };
            }
            if(description !== undefined) guild.description = description;
            if(isPublic !== undefined) guild.isPublic = isPublic;
            if(joinType !== undefined) guild.joinType = joinType;
            if(icon !== undefined) {
                guild.icon = icon;
                // DB?�도 ?�데?�트 (emblem ?�드)
                const dbGuilds = await db.getKV<Record<string, Guild>>('guilds') || {};
                if (dbGuilds[guildId]) {
                    dbGuilds[guildId].emblem = icon;
                }
            }
            await db.setKV('guilds', guilds);
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            return { clientResponse: { guilds } };
        }

        case 'GUILD_UPDATE_ANNOUNCEMENT': {
            const { guildId, announcement } = payload;
            const guild = guilds[guildId];
            const myMemberInfo = guild?.members.find(m => m.userId === user.id);
             if (!guild || !myMemberInfo || (myMemberInfo.role !== GuildMemberRole.Master && myMemberInfo.role !== GuildMemberRole.Vice)) {
                return { error: '권한???�습?�다.' };
            }
            guild.announcement = announcement;
            await db.setKV('guilds', guilds);
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            return { clientResponse: { guilds } };
        }

        case 'GUILD_CHECK_IN': {
            if (process.env.NODE_ENV === 'development') {
                console.log(`[handleGuildAction] Processing GUILD_CHECK_IN for user ${user.id}, guildId: ${user.guildId}`);
            }
            const now = Date.now();
            if (!user.guildId) return { error: '길드??가?�되???��? ?�습?�다.' };
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드�?찾을 ???�습?�다.' };

            if (!guild.checkIns) guild.checkIns = {};
            if (isSameDayKST(guild.checkIns[user.id], now)) return { error: '?�늘 ?��? 출석?�습?�다.' };

            guild.checkIns[user.id] = now;
            
            // 길드 기여도 추가 (출석)
            guildService.addContribution(guild, user.id, 10);
            
            await guildService.updateGuildMissionProgress(user.guildId, 'checkIns', 1, guilds);
            
            needsSave = true;
            await db.setKV('guilds', guilds);
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            if (process.env.NODE_ENV === 'development') {
                console.log(`[handleGuildAction] GUILD_CHECK_IN completed successfully`);
            }
            return { clientResponse: { guilds, updatedUser: user } };
        }
        case 'GUILD_CLAIM_CHECK_IN_REWARD': {
             const { milestoneIndex } = payload;
            if (!user.guildId) return { error: '길드??가?�되???��? ?�습?�다.' };
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드�?찾을 ???�습?�다.' };
            
            const now = Date.now();
            const todaysCheckIns = Object.values(guild.checkIns || {}).filter(ts => isSameDayKST(ts, now)).length;
            const milestone = GUILD_CHECK_IN_MILESTONE_REWARDS[milestoneIndex];

            if (!milestone || todaysCheckIns < milestone.count) return { error: '보상 조건??만족?��? 못했?�니??' };
            if (!guild.dailyCheckInRewardsClaimed) guild.dailyCheckInRewardsClaimed = [];
            if (guild.dailyCheckInRewardsClaimed.some(c => c.userId === user.id && c.milestoneIndex === milestoneIndex)) return { error: '?��? ?�령??보상?�니??' };
            
            // 최신 사용자 데이터를 다시 로드하여 보스전 등에서 받은 길드코인을 반영
            const freshUser = await db.getUser(user.id);
            if (!freshUser) return { error: '사용자를 찾을 수 없습니다.' };
            
            freshUser.guildCoins = (freshUser.guildCoins || 0) + milestone.reward.guildCoins;
            user.guildCoins = freshUser.guildCoins; // user 객체도 동기화
            guild.dailyCheckInRewardsClaimed.push({ userId: user.id, milestoneIndex });

            await db.setKV('guilds', guilds);
            
            // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
            db.updateUser(freshUser).catch(err => {
                console.error(`[GUILD_CLAIM_CHECK_IN_REWARD] Failed to save user ${freshUser.id}:`, err);
            });

            // WebSocket?�로 ?�용???�데?�트 브로?�캐?�트 (최적?�된 ?�수 ?�용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(freshUser, ['guildCoins']);
            
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            return { clientResponse: { updatedUser: freshUser, guilds } };
        }
        case 'GUILD_CLAIM_MISSION_REWARD': {
            const { missionId } = payload;
            if (!user.guildId) return { error: '길드??가?�되???��? ?�습?�다.' };
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드�?찾을 ???�습?�다.' };
        
            const mission = guild.weeklyMissions.find(m => m.id === missionId);
        
            if (!mission) return { error: '미션??찾을 ???�습?�다.' };
            if (!mission.isCompleted) return { error: '?�직 ?�료?��? ?��? 미션?�니??' };
            if (mission.claimedBy.includes(user.id)) return { error: '?��? ?�령??보상?�니??' };
            
            // 초기????지??보상?� 받을 ???�도�?체크
            const now = Date.now();
            if (guild.lastMissionReset && isDifferentWeekKST(guild.lastMissionReset, now)) {
                return { error: '?��? 초기?�된 미션?��?�?보상??받을 ???�습?�다.' };
            }

            // XP??미션 ?�료 ???��? 추�??�었?��?�??�기?�는 개인 보상�?지�?
            // Grant personal reward (Guild Coins)
            // 최신 사용자 데이터를 다시 로드하여 보스전 등에서 받은 길드코인을 반영
            const freshUser = await db.getUser(user.id);
            if (!freshUser) return { error: '사용자를 찾을 수 없습니다.' };
            
            freshUser.guildCoins = (freshUser.guildCoins || 0) + mission.personalReward.guildCoins;
            user.guildCoins = freshUser.guildCoins; // user 객체도 동기화
        
            // Mark as claimed by the current user
            mission.claimedBy.push(user.id);
            
            await db.setKV('guilds', guilds);
            
            // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
            db.updateUser(freshUser).catch(err => {
                console.error(`[GUILD_CLAIM_MISSION_REWARD] Failed to save user ${freshUser.id}:`, err);
            });

            // WebSocket?�로 ?�용???�데?�트 브로?�캐?�트 (최적?�된 ?�수 ?�용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(freshUser, ['guildCoins']);
            
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            return { clientResponse: { updatedUser: freshUser, guilds } };
        }
        case 'GUILD_DONATE_GOLD':
        case 'GUILD_DONATE_DIAMOND': {
            console.log(`[handleGuildAction] Processing ${type} for user ${user.id}, guildId: ${user.guildId}`);
            if (!user.guildId) return { error: '길드??가?�되???��? ?�습?�다.' };
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드�?찾을 ???�습?�다.' };
            
            const now = Date.now();
            if (!user.isAdmin) {
                if (!user.dailyDonations || !isSameDayKST(user.dailyDonations.date, now)) {
                    user.dailyDonations = { gold: 0, diamond: 0, date: now };
                }
            }
            
            let gainedGuildCoins = 0;
            let gainedResearchPoints = 0;

            if (type === 'GUILD_DONATE_GOLD') {
                if (!user.isAdmin) {
                    if (user.dailyDonations!.gold >= GUILD_DONATION_GOLD_LIMIT) return { error: '?�늘 골드 기�? ?�도�?초과?�습?�다.' };
                    if (user.gold < GUILD_DONATION_GOLD_COST) return { error: '골드가 부족합?�다.' };
                    currencyService.spendGold(user, GUILD_DONATION_GOLD_COST, '길드 기�?');
                    user.dailyDonations!.gold++;
                }
                gainedGuildCoins = getRandomInt(GUILD_DONATION_GOLD_REWARDS.guildCoins[0], GUILD_DONATION_GOLD_REWARDS.guildCoins[1]);
                gainedResearchPoints = getRandomInt(GUILD_DONATION_GOLD_REWARDS.researchPoints[0], GUILD_DONATION_GOLD_REWARDS.researchPoints[1]);
                
                user.guildCoins = (user.guildCoins || 0) + gainedGuildCoins;
                guild.researchPoints += gainedResearchPoints;
                guild.xp += GUILD_DONATION_GOLD_REWARDS.guildXp;
                guildService.addContribution(guild, user.id, GUILD_DONATION_GOLD_REWARDS.contribution);
            } else {
                if (!user.isAdmin) {
                    if (user.dailyDonations!.diamond >= GUILD_DONATION_DIAMOND_LIMIT) return { error: '?�늘 ?�이??기�? ?�도�?초과?�습?�다.' };
                    if (user.diamonds < GUILD_DONATION_DIAMOND_COST) return { error: '?�이?��? 부족합?�다.' };
                    currencyService.spendDiamonds(user, GUILD_DONATION_DIAMOND_COST, '길드 기�?');
                    await guildService.updateGuildMissionProgress(user.guildId, 'diamondsSpent', GUILD_DONATION_DIAMOND_COST, guilds);
                    user.dailyDonations!.diamond++;
                }
                gainedGuildCoins = getRandomInt(GUILD_DONATION_DIAMOND_REWARDS.guildCoins[0], GUILD_DONATION_DIAMOND_REWARDS.guildCoins[1]);
                gainedResearchPoints = getRandomInt(GUILD_DONATION_DIAMOND_REWARDS.researchPoints[0], GUILD_DONATION_DIAMOND_REWARDS.researchPoints[1]);
                
                user.guildCoins = (user.guildCoins || 0) + gainedGuildCoins;
                guild.researchPoints += gainedResearchPoints;
                guild.xp += GUILD_DONATION_DIAMOND_REWARDS.guildXp;
                guildService.addContribution(guild, user.id, GUILD_DONATION_DIAMOND_REWARDS.contribution);
            }

            guildService.checkGuildLevelUp(guild);
            updateQuestProgress(user, 'guild_donate');

            await db.setKV('guilds', guilds);
            
            // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
            db.updateUser(user).catch(err => {
                console.error(`[${type}] Failed to save user ${user.id}:`, err);
            });

            // WebSocket?�로 ?�용???�데?�트 브로?�캐?�트 (최적?�된 ?�수 ?�용)
            const { broadcastUserUpdate } = await import('../socket.js');
            const { getSelectiveUserUpdate } = await import('../utils/userUpdateHelper.js');
            const changedFields = type === 'GUILD_DONATE_GOLD' 
                ? ['gold', 'guildCoins', 'dailyDonations'] 
                : ['diamonds', 'guildCoins', 'dailyDonations'];
            broadcastUserUpdate(user, changedFields);
            
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            console.log(`[handleGuildAction] ${type} completed successfully`);
            
            // updatedUser??guildCoins?� dailyDonations가 ?�함?�도�?보장
            const updatedUser = getSelectiveUserUpdate(user, type);
            updatedUser.guildCoins = user.guildCoins;
            updatedUser.dailyDonations = user.dailyDonations;
            
            return {
                clientResponse: {
                    updatedUser, 
                    guilds,
                    donationResult: {
                        coins: gainedGuildCoins,
                        research: gainedResearchPoints,
                    }
                }
            };
        }
        
        case 'GUILD_START_RESEARCH': {
            const { guildId, researchId } = payload;
            const guild = guilds[guildId];
            const myMemberInfo = guild?.members.find(m => m.userId === user.id);
            if (!guild || !myMemberInfo || (myMemberInfo.role !== GuildMemberRole.Master && myMemberInfo.role !== GuildMemberRole.Vice)) {
                return { error: '권한???�습?�다.' };
            }
            if (guild.researchTask) return { error: '?��? 진행 중인 ?�구가 ?�습?�다.' };

            const project = GUILD_RESEARCH_PROJECTS[researchId as keyof typeof GUILD_RESEARCH_PROJECTS];
            const currentLevel = guild.research?.[researchId as keyof typeof GUILD_RESEARCH_PROJECTS]?.level ?? 0;
            if (currentLevel >= project.maxLevel) return { error: '최고 ?�벨???�달?�습?�다.' };
            
            const cost = getResearchCost(researchId, currentLevel);
            const timeMs = getResearchTimeMs(researchId, currentLevel);
            if (guild.researchPoints < cost) return { error: '?�구 ?�인?��? 부족합?�다.' };
            
            guild.researchPoints -= cost;
            guild.researchTask = {
                researchId,
                completionTime: Date.now() + timeMs,
            };

            await db.setKV('guilds', guilds);
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            return { clientResponse: { guilds } };
        }
        
        case 'GUILD_BUY_SHOP_ITEM': {
            const { itemId } = payload;
            if (!user.guildId) return { error: '길드??가?�되???��? ?�습?�다.' };
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드�?찾을 ???�습?�다.' };

            const itemToBuy = GUILD_SHOP_ITEMS.find(item => item.itemId === itemId);
            if (!itemToBuy) return { error: '?�점?�서 ?�당 ?�이?�을 찾을 ???�습?�다.' };
            
            if (!user.isAdmin) {
                // Check cost
                if ((user.guildCoins || 0) < itemToBuy.cost) {
                    return { error: '길드 코인??부족합?�다.' };
                }

                // Check limits
                const now = Date.now();
                if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
                const purchaseRecord = user.dailyShopPurchases[itemId];
                let purchasesThisPeriod = 0;
                
                if (purchaseRecord) {
                    const isNewPeriod = (itemToBuy.limitType === 'weekly' && isDifferentWeekKST(purchaseRecord.lastPurchaseTimestamp, now)) ||
                                        (itemToBuy.limitType === 'monthly' && isDifferentMonthKST(purchaseRecord.lastPurchaseTimestamp, now));
                    if (!isNewPeriod) {
                        purchasesThisPeriod = purchaseRecord.quantity;
                    }
                }
                
                if (purchasesThisPeriod >= itemToBuy.limit) {
                    return { error: `${itemToBuy.limitType === 'weekly' ? '주간' : '?�간'} 구매 ?�도�?초과?�습?�다.` };
                }
            }
            
            // Deduct cost and update purchase record BEFORE giving the item
            if (!user.isAdmin) {
                user.guildCoins = (user.guildCoins || 0) - itemToBuy.cost;
                
                const now = Date.now();
                if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
                const record = user.dailyShopPurchases[itemId];
                if (record) {
                    const isNewPeriod = (itemToBuy.limitType === 'weekly' && isDifferentWeekKST(record.lastPurchaseTimestamp, now)) ||
                                        (itemToBuy.limitType === 'monthly' && isDifferentMonthKST(record.lastPurchaseTimestamp, now));

                    if (isNewPeriod) {
                        record.quantity = 1;
                        record.lastPurchaseTimestamp = now;
                    } else {
                        record.quantity++;
                    }
                } else {
                    user.dailyShopPurchases[itemId] = {
                        quantity: 1,
                        lastPurchaseTimestamp: now,
                    };
                }
            }
            
            // Special handling for Stat Points
            if (itemToBuy.itemId === '보너???�탯 +5') {
                user.bonusStatPoints = (user.bonusStatPoints || 0) + 5;
                
                // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
                db.updateUser(user).catch(err => {
                    console.error(`[BUY_GUILD_SHOP_ITEM] Failed to save user ${user.id}:`, err);
                });

                // WebSocket?�로 ?�용???�데?�트 브로?�캐?�트 (최적?�된 ?�수 ?�용)
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['bonusStatPoints', 'guildCoins', 'dailyShopPurchases']);
                
                const rewardSummary = {
                    reward: { bonus: '?�탯+5' },
                    items: [],
                    title: '길드 ?�점 구매'
                };
                return { clientResponse: { updatedUser: user, rewardSummary } };
            }
            
            // Regular item handling
            let itemsToAdd: InventoryItem[] = [];
            if (itemToBuy.type === 'equipment_box') {
                itemsToAdd.push(openGuildGradeBox(itemToBuy.grade));
            } else { // 'material' or 'consumable'
                const template = [...CONSUMABLE_ITEMS, ...Object.values(MATERIAL_ITEMS)].find(t => t.name === itemToBuy.name);
                
                if (template) {
                    itemsToAdd.push({
                        ...template,
                        id: `item-${globalThis.crypto.randomUUID()}`,
                        createdAt: Date.now(),
                        quantity: 1,
                        isEquipped: false, level: 1, stars: 0, options: undefined, slot: null,
                    });
                } else {
                     console.error(`[Guild Shop] Could not find template for ${itemToBuy.name}`);
                     if (!user.isAdmin) { user.guildCoins = (user.guildCoins || 0) + itemToBuy.cost; } // Refund
                     return { error: '?�이???�보�?찾을 ???�습?�다.' };
                }
            }
            
            const { success, updatedInventory } = addItemsToInventory(user.inventory, user.inventorySlots, itemsToAdd);
            if (!success) {
                if (!user.isAdmin) { user.guildCoins = (user.guildCoins || 0) + itemToBuy.cost; } // Refund
                return { error: '?�벤?�리 공간??부족합?�다.' };
            }
            
            // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
            db.updateUser(user).catch(err => {
                console.error(`[BUY_GUILD_SHOP_ITEM] Failed to save user ${user.id}:`, err);
            });

            // WebSocket?�로 ?�용???�데?�트 브로?�캐?�트 (최적?�된 ?�수 ?�용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'guildCoins']);
            
            return { clientResponse: { updatedUser: user, obtainedItemsBulk: itemsToAdd } };
        }

        case 'BUY_GUILD_SHOP_ITEM': {
            const { itemId, quantity } = payload;
            if (!user.guildId) return { error: '길드??가?�되???��? ?�습?�다.' };
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드�?찾을 ???�습?�다.' };

            const itemToBuy = GUILD_SHOP_ITEMS.find(item => item.itemId === itemId);
            if (!itemToBuy) return { error: '?�점?�서 ?�당 ?�이?�을 찾을 ???�습?�다.' };

            const totalCost = itemToBuy.cost * quantity;
            if ((user.guildCoins || 0) < totalCost) {
                return { error: '길드 코인??부족합?�다.' };
            }

            const now = Date.now();
            if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
            const purchaseRecord = user.dailyShopPurchases[itemId];
            let purchasesThisPeriod = 0;

            if (purchaseRecord) {
                const isNewPeriod = (itemToBuy.limitType === 'weekly' && isDifferentWeekKST(purchaseRecord.lastPurchaseTimestamp, now)) ||
                                    (itemToBuy.limitType === 'monthly' && isDifferentMonthKST(purchaseRecord.lastPurchaseTimestamp, now));
                if (!isNewPeriod) {
                    purchasesThisPeriod = purchaseRecord.quantity;
                }
            }

            if (itemToBuy.limit !== Infinity && (purchasesThisPeriod + quantity) > itemToBuy.limit) {
                return { error: `${itemToBuy.limitType === 'weekly' ? '주간' : '?�간'} 구매 ?�도�?초과?�습?�다.` };
            }

            user.guildCoins = (user.guildCoins || 0) - totalCost;

            if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
            const record = user.dailyShopPurchases[itemId];
            if (record) {
                const isNewPeriod = (itemToBuy.limitType === 'weekly' && isDifferentWeekKST(record.lastPurchaseTimestamp, now)) ||
                                    (itemToBuy.limitType === 'monthly' && isDifferentMonthKST(record.lastPurchaseTimestamp, now));

                if (isNewPeriod) {
                    record.quantity = quantity;
                    record.lastPurchaseTimestamp = now;
                } else {
                    record.quantity += quantity;
                }
            } else {
                user.dailyShopPurchases[itemId] = {
                    quantity: quantity,
                    lastPurchaseTimestamp: now,
                };
            }

            let itemsToAdd: InventoryItem[] = [];
            for (let i = 0; i < quantity; i++) {
                if (itemToBuy.type === 'equipment_box') {
                    itemsToAdd.push(openGuildGradeBox(itemToBuy.grade));
                } else { // 'material' or 'consumable'
                    const template = [...CONSUMABLE_ITEMS, ...Object.values(MATERIAL_ITEMS)].find(t => t.name === itemToBuy.name);
                    if (template) {
                        itemsToAdd.push({
                            ...template,
                            id: `item-${globalThis.crypto.randomUUID()}`,
                            createdAt: Date.now(),
                            quantity: 1,
                            isEquipped: false, level: 1, stars: 0, options: undefined, slot: null,
                        });
                    } else {
                        console.error(`[Guild Shop] Could not find template for ${itemToBuy.name}`);
                        return { error: '?�이???�보�?찾을 ???�습?�다.' };
                    }
                }
            }

            const { success, updatedInventory } = addItemsToInventory(user.inventory, user.inventorySlots, itemsToAdd);
            if (!success) {
                user.guildCoins = (user.guildCoins || 0) + totalCost; // Refund
                return { error: '?�벤?�리 공간??부족합?�다.' };
            }

                // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
                db.updateUser(user).catch(err => {
                    console.error(`[BUY_GUILD_SHOP_ITEM] Failed to save user ${user.id}:`, err);
                });

                // WebSocket?�로 ?�용???�데?�트 브로?�캐?�트 (최적?�된 ?�수 ?�용)
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['inventory', 'guildCoins']);
                
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } }); // Broadcast guilds

            return { clientResponse: { updatedUser: user, obtainedItemsBulk: itemsToAdd } };
        }

        case 'START_GUILD_WAR': {
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };
            
            // 길드장 또는 부길드장 권한 확인
            const myMemberInfo = guild.members?.find(m => m.userId === user.id);
            const canStartWar = myMemberInfo?.role === 'leader' || myMemberInfo?.role === 'officer';
            if (!canStartWar) {
                return { error: '길드장 또는 부길드장만 전쟁을 시작할 수 있습니다.' };
            }
            
            // 이미 활성 전쟁이 있는지 확인
            const activeWars = await db.getKV<any[]>('activeGuildWars') || [];
            const existingWar = activeWars.find(w => 
                (w.guild1Id === user.guildId || w.guild2Id === user.guildId) && 
                w.status === 'active'
            );
            if (existingWar) {
                return { error: '이미 진행 중인 전쟁이 있습니다.' };
            }
            
            // 이미 매칭 중인지 확인
            if ((guild as any).guildWarMatching) {
                return { error: '이미 매칭 중입니다.' };
            }
            
            // 쿨타임 확인 (1시간)
            const now = Date.now();
            const lastWarAction = (guild as any).lastWarActionTime || 0;
            const cooldownTime = 60 * 60 * 1000; // 1시간
            if (lastWarAction && (now - lastWarAction) < cooldownTime) {
                const remaining = cooldownTime - (now - lastWarAction);
                const minutes = Math.floor(remaining / (1000 * 60));
                const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
                return { error: `전쟁 신청 후 1시간이 지나야 취소할 수 있습니다. (남은 시간: ${minutes}분 ${seconds}초)` };
            }
            
            // 매칭 큐 가져오기
            const matchingQueue = await db.getKV<string[]>('guildWarMatchingQueue') || [];
            
            // 이미 큐에 있는지 확인
            if (matchingQueue.includes(user.guildId)) {
                return { error: '이미 매칭 큐에 등록되어 있습니다.' };
            }
            
            // 매칭 큐에 추가 (다음날 0시에 자동 매칭됨)
            matchingQueue.push(user.guildId);
            (guild as any).guildWarMatching = true;
            (guild as any).lastWarActionTime = now;
            
            // 다음날 0시 계산
            const { getStartOfDayKST } = await import('../../utils/timeUtils.js');
            const todayStart = getStartOfDayKST(now);
            const nextDayStart = todayStart + (24 * 60 * 60 * 1000); // 다음날 0시
            
            // 길드 채팅에 시스템 메시지 추가
            const { randomUUID } = await import('crypto');
            const nicknameEnding = user.nickname && /[가-힣]$/.test(user.nickname)
                ? (user.nickname.charCodeAt(user.nickname.length - 1 - 0xAC00) % 28 === 0 ? '가' : '이')
                : '이';
            
            const systemMessage: any = {
                id: `msg-guild-war-${randomUUID()}`,
                guildId: guild.id,
                authorId: 'system',
                content: `[${user.nickname}]${nicknameEnding} 길드 전쟁 매칭을 신청했습니다. 다음날 0시에 매칭됩니다.`,
                createdAt: now,
                system: true,
            };
            
            if (!guild.chatHistory) guild.chatHistory = [];
            guild.chatHistory.push(systemMessage);
            if (guild.chatHistory.length > 100) {
                guild.chatHistory.shift();
            }
            
            await db.setKV('guildWarMatchingQueue', matchingQueue);
            await db.setKV('guilds', guilds);
            
            // 브로드캐스트
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            
            return { clientResponse: { matched: false, message: '매칭 신청이 완료되었습니다. 다음날 0시에 매칭됩니다.', nextMatchTime: nextDayStart, cooldownUntil: now + cooldownTime } };
        }
        
        case 'CANCEL_GUILD_WAR': {
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };
            
            // 길드장 또는 부길드장 권한 확인
            const myMemberInfo = guild.members?.find(m => m.userId === user.id);
            const canStartWar = myMemberInfo?.role === 'leader' || myMemberInfo?.role === 'officer';
            if (!canStartWar) {
                return { error: '길드장 또는 부길드장만 전쟁을 취소할 수 있습니다.' };
            }
            
            // 매칭 중이 아닌지 확인
            if (!(guild as any).guildWarMatching) {
                return { error: '매칭 중이 아닙니다.' };
            }
            
            // 쿨타임 확인 (1시간)
            const now = Date.now();
            const lastWarAction = (guild as any).lastWarActionTime || 0;
            const cooldownTime = 60 * 60 * 1000; // 1시간
            if (lastWarAction && (now - lastWarAction) < cooldownTime) {
                const remaining = cooldownTime - (now - lastWarAction);
                const minutes = Math.floor(remaining / (1000 * 60));
                const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
                return { error: `전쟁 신청 후 1시간이 지나야 취소할 수 있습니다. (남은 시간: ${minutes}분 ${seconds}초)` };
            }
            
            // 매칭 큐에서 제거
            const matchingQueue = await db.getKV<string[]>('guildWarMatchingQueue') || [];
            const queueIndex = matchingQueue.indexOf(user.guildId);
            if (queueIndex >= 0) {
                matchingQueue.splice(queueIndex, 1);
            }
            
            (guild as any).guildWarMatching = false;
            (guild as any).lastWarActionTime = now;
            
            // 길드 채팅에 시스템 메시지 추가
            const { randomUUID } = await import('crypto');
            const nicknameEnding = user.nickname && /[가-힣]$/.test(user.nickname)
                ? (user.nickname.charCodeAt(user.nickname.length - 1 - 0xAC00) % 28 === 0 ? '가' : '이')
                : '이';
            
            const systemMessage: any = {
                id: `msg-guild-war-${randomUUID()}`,
                guildId: guild.id,
                authorId: 'system',
                content: `[${user.nickname}]${nicknameEnding} 길드 전쟁 매칭을 취소했습니다.`,
                createdAt: now,
                system: true,
            };
            
            if (!guild.chatHistory) guild.chatHistory = [];
            guild.chatHistory.push(systemMessage);
            if (guild.chatHistory.length > 100) {
                guild.chatHistory.shift();
            }
            
            await db.setKV('guildWarMatchingQueue', matchingQueue);
            await db.setKV('guilds', guilds);
            
            // 브로드캐스트
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            
            return { clientResponse: { message: '매칭이 취소되었습니다.', cooldownUntil: now + cooldownTime } };
        }
        
        case 'GET_GUILD_WAR_DATA': {
            if (!user.guildId) return { error: '길드??가?�되???��? ?�습?�다.' };
            
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드�?찾을 ???�습?�다.' };
            
            // 길드???�이??가?�오�?
            const activeWars = await db.getKV<any[]>('activeGuildWars') || [];
            const activeWar = activeWars.find(w => 
                (w.guild1Id === user.guildId || w.guild2Id === user.guildId) && 
                w.status === 'active'
            );
            
            // ?�음 매칭 ?�짜 가?�오�?(길드???�정?�어 ?�으�??�용, ?�으�?계산)
            let nextMatchDate = (guild as any).nextWarMatchDate;
            if (!nextMatchDate) {
                // ?�음 매칭 ?�짜 계산
                const { getKSTDay, getStartOfDayKST } = await import('../../utils/timeUtils.js');
                const now = Date.now();
                const kstDay = getKSTDay(now);
                const todayStart = getStartOfDayKST(now);
                
                let daysUntilNext = 0;
                if (kstDay === 1) {
                    daysUntilNext = 4; // ?�요??- 금요?�까지
                } else if (kstDay === 2 || kstDay === 3) {
                    daysUntilNext = 5 - kstDay; // ?�요?? ?�요??- 금요?�까지
                } else if (kstDay === 4) {
                    daysUntilNext = 3; // 목요??- ?�음 ?�요?�까지
                } else if (kstDay === 5) {
                    daysUntilNext = 3; // 금요??- ?�음 ?�요?�까지
                } else {
                    daysUntilNext = (8 - kstDay) % 7; // ?�요?? ?�요??- ?�음 ?�요?�까지
                }
                
                nextMatchDate = todayStart + (daysUntilNext * 24 * 60 * 60 * 1000);
            }
            
            // 매칭 중 여부 확인
            const isMatching = (guild as any).guildWarMatching || false;
            
            // 다음 매칭 시간 계산 (매칭 중인 경우)
            let nextMatchTime: number | undefined = undefined;
            if (isMatching) {
                const { getStartOfDayKST } = await import('../../utils/timeUtils.js');
                const now = Date.now();
                const todayStart = getStartOfDayKST(now);
                nextMatchTime = todayStart + (24 * 60 * 60 * 1000); // 다음날 0시
            }
            
            // 쿨타임 정보 가져오기
            const lastWarAction = (guild as any).lastWarActionTime || 0;
            const cooldownTime = 60 * 60 * 1000; // 1시간
            const now = Date.now();
            let warActionCooldown: number | null = null;
            if (lastWarAction && (now - lastWarAction) < cooldownTime) {
                warActionCooldown = lastWarAction + cooldownTime;
            }
            
            return { clientResponse: { activeWar, guilds, isMatching, nextMatchTime, warActionCooldown } };
        }
        
        case 'START_GUILD_WAR_GAME': {
            const { boardId, isDemo } = payload;
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };
            
            let activeWar: any = null;
            let board: any = null;
            
            if (isDemo) {
                // 데모 모드: 클라이언트에서 전달된 보드 정보 사용
                // 데모 모드에서는 서버에서 전쟁 데이터를 확인하지 않음
                const { gameMode: clientGameMode } = payload;
                board = {
                    boardSize: 13,
                    gameMode: clientGameMode || 'capture', // 클라이언트에서 전달받은 게임 모드
                };
            } else {
                // 실제 모드: 활성 전쟁 확인
                const activeWars = await db.getKV<any[]>('activeGuildWars') || [];
                activeWar = activeWars.find(w => 
                    (w.guild1Id === user.guildId || w.guild2Id === user.guildId) && 
                    w.status === 'active'
                );
                
                if (!activeWar) {
                    return { error: '진행 중인 길드 전쟁이 없습니다.' };
                }
                
                // 바둑판 확인
                board = activeWar.boards?.[boardId];
                if (!board) {
                    return { error: '바둑판을 찾을 수 없습니다.' };
                }
                
                // 하루 도전 횟수 확인
                const { isSameDayKST } = await import('../../utils/timeUtils.js');
                const now = Date.now();
                const dailyAttempts = activeWar.dailyAttempts || {};
                const userAttempts = dailyAttempts[user.id] || {};
                const todayAttempts = isSameDayKST(userAttempts.date || 0, now) ? (userAttempts.count || 0) : 0;
                
                if (todayAttempts >= 3) {
                    return { error: '오늘 도전 횟수를 모두 사용했습니다. (하루 3회)' };
                }
            }
            
            // 게임 모드 및 설정
            const { GameMode, Player } = await import('../../types/enums.js');
            const { getAiUser, aiUserId } = await import('../aiPlayer.js');
            const { initializeGame } = await import('../gameModes.js');
            const { randomUUID } = await import('crypto');
            
            let gameMode: GameMode;
            if (board.gameMode === 'capture') {
                gameMode = GameMode.Capture;
            } else if (board.gameMode === 'hidden') {
                gameMode = GameMode.Hidden;
            } else if (board.gameMode === 'missile') {
                gameMode = GameMode.Missile;
            } else {
                gameMode = GameMode.Standard;
            }
            
            // AI 유저 생성
            const aiUser = getAiUser(gameMode);
            
            // 게임 설정
            const gameSettings = {
                boardSize: board.boardSize || 13,
                komi: 0.5,
                timeLimit: 5,
                byoyomiTime: 30,
                byoyomiCount: 3,
                timeIncrement: 0,
                aiDifficulty: 5, // 중간 난이도
            };
            
            // 게임 모드별 추가 설정
            if (board.gameMode === 'capture') {
                (gameSettings as any).captureTarget = 10;
            } else if (board.gameMode === 'hidden') {
                (gameSettings as any).hiddenStoneCount = 3;
                (gameSettings as any).scanCount = 2;
            } else if (board.gameMode === 'missile') {
                (gameSettings as any).missileCount = 3;
            }
            
            // Negotiation 생성
            const negotiation = {
                id: `guild-war-${randomUUID()}`,
                challenger: user,
                opponent: aiUser,
                mode: gameMode,
                settings: gameSettings,
                proposerId: user.id,
                status: 'pending' as const,
                deadline: 0,
            };
            
            // 게임 초기화
            const game = await initializeGame(negotiation);
            game.gameCategory = 'guildwar' as any;
            if (!isDemo && activeWar) {
                (game as any).guildWarId = activeWar.id;
            }
            (game as any).guildWarBoardId = boardId;
            if (isDemo) {
                (game as any).isDemo = true;
            }
            
            // 게임 저장
            await db.saveGame(game);
            
            // 데모 모드가 아닐 때만 도전 횟수 및 전쟁 상태 업데이트
            if (!isDemo && activeWar) {
                const { isSameDayKST } = await import('../../utils/timeUtils.js');
                const now = Date.now();
                const dailyAttempts = activeWar.dailyAttempts || {};
                
                // 도전 횟수 업데이트
                if (!dailyAttempts[user.id]) {
                    dailyAttempts[user.id] = { date: now, count: 0 };
                }
                if (!isSameDayKST(dailyAttempts[user.id].date, now)) {
                    dailyAttempts[user.id] = { date: now, count: 0 };
                }
                dailyAttempts[user.id].count = (dailyAttempts[user.id].count || 0) + 1;
                activeWar.dailyAttempts = dailyAttempts;
                
                // 바둑판 도전 중 상태 업데이트
                if (!board.challenging) {
                    board.challenging = {};
                }
                board.challenging[user.id] = {
                    userId: user.id,
                    gameId: game.id,
                    startTime: now,
                };
                
                // 길드 기여도 추가 (전쟁 참여)
                guildService.addContribution(guild, user.id, 30);
                
                const activeWars = await db.getKV<any[]>('activeGuildWars') || [];
                const warIndex = activeWars.findIndex(w => w.id === activeWar.id);
                if (warIndex >= 0) {
                    activeWars[warIndex] = activeWar;
                    await db.setKV('activeGuildWars', activeWars);
                }
            }
            
            // 사용자 상태 업데이트
            volatileState.userStatuses[user.id] = { 
                status: 'in_game' as any, 
                mode: game.mode, 
                gameId: game.id 
            };
            
            const { broadcast } = await import('../socket.js');
            if (!isDemo && activeWar) {
                const activeWars = await db.getKV<any[]>('activeGuildWars') || [];
                await broadcast({ type: 'GUILD_WAR_UPDATE', payload: { activeWars } });
            }
            await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userStatuses: volatileState.userStatuses } });
            
            return { clientResponse: { gameId: game.id } };
        }
        
        case 'GET_GUILD_INFO': {
            try {
                if (!user.guildId) {
                    return { error: "가입한 길드가 없습니다." };
                }
                
                // Prisma에서 길드 존재 여부 확인
                const dbGuild = await guildRepo.getGuildById(user.guildId);
                const guild = guilds[user.guildId];
                
                // KV store와 Prisma 모두에서 길드를 찾을 수 없으면 사용자의 guildId 제거
                if (!guild && !dbGuild) {
                    console.log(`[GET_GUILD_INFO] Guild ${user.guildId} not found, removing guildId from user ${user.id}`);
                    user.guildId = undefined;
                    await db.updateUser(user);
                    
                    // Prisma에서 GuildMember 제거 (필요시 정리)
                    const existingGuildMember = await guildRepo.getGuildMemberByUserId(user.id);
                    if (existingGuildMember) {
                        console.log(`[GET_GUILD_INFO] Removing GuildMember for user ${user.id}`);
                        await guildRepo.removeGuildMember(existingGuildMember.guildId, user.id);
                    }
                    
                    return { error: "가입한 길드가 없습니다." };
                }
                
                // KV store에 길드가 없지만 Prisma에는 있으면 기본 길드 객체 생성
                if (!guild && dbGuild) {
                    console.log(`[GET_GUILD_INFO] Guild ${user.guildId} exists in DB but not in KV store, creating basic guild object`);
                    
                    // DB에서 길드 멤버 정보 가져오기
                    const dbMembers = await guildRepo.getGuildMembers(user.guildId);
                    const dbSettings = (dbGuild.settings as any) || {};
                    
                    // 기본 길드 객체 생성 (createDefaultGuild를 참고한 구조)
                    const now = Date.now();
                    const basicGuild: Guild = {
                        id: dbGuild.id,
                        name: dbGuild.name,
                        leaderId: dbGuild.leaderId,
                        description: dbGuild.description || undefined,
                        icon: dbGuild.emblem || '/images/guild/profile/icon1.png',
                        level: dbGuild.level,
                        gold: Number(dbGuild.gold),
                        experience: Number(dbGuild.experience),
                        xp: Number(dbGuild.experience),
                        researchPoints: 0,
                        members: dbMembers.map(m => ({
                            id: m.id,
                            guildId: m.guildId,
                            userId: m.userId,
                            nickname: '',
                            role: m.role as 'leader' | 'officer' | 'member',
                            joinDate: m.joinDate,
                            contributionTotal: m.contributionTotal,
                            weeklyContribution: 0,
                            createdAt: m.createdAt,
                            updatedAt: m.updatedAt,
                        })),
                        memberLimit: 30,
                        isPublic: dbSettings.isPublic !== undefined ? dbSettings.isPublic : true,
                        joinType: dbSettings.joinType || 'free',
                        settings: dbSettings,
                        applicants: [],
                        weeklyMissions: [],
                        lastMissionReset: now,
                        lastWeeklyContributionReset: now,
                        chatHistory: [],
                        checkIns: {},
                        dailyCheckInRewardsClaimed: [],
                        research: {},
                        researchTask: null,
                        createdAt: dbGuild.createdAt,
                        updatedAt: dbGuild.updatedAt,
                    };
                    
                    // KV store에 저장
                    guilds[user.guildId] = basicGuild;
                    await db.setKV('guilds', guilds);
                    
                    const guildWithFixedIcon = {
                        ...basicGuild,
                        name: basicGuild.name || dbGuild.name || '이름 없는 길드', // name 필드 보장
                        icon: basicGuild.icon?.startsWith('/images/guild/icon') 
                            ? basicGuild.icon.replace('/images/guild/icon', '/images/guild/profile/icon')
                            : (basicGuild.icon || '/images/guild/profile/icon1.png')
                    };
                    
                    return { clientResponse: { guild: guildWithFixedIcon } };
                }
                
                // members 배열이 없으면 배열로 초기화
                if (!guild.members) {
                    guild.members = [];
                    await db.setKV('guilds', guilds);
                }
                
                // 아이콘 경로 수정 및 name 필드 보장
                const guildWithFixedIcon = {
                    ...guild,
                    name: guild.name || '이름 없는 길드', // name 필드 보장
                    members: guild.members || [],
                    icon: guild.icon?.startsWith('/images/guild/icon') 
                        ? guild.icon.replace('/images/guild/icon', '/images/guild/profile/icon')
                        : (guild.icon || '/images/guild/profile/icon1.png')
                };
                return { clientResponse: { guild: guildWithFixedIcon } };
            } catch (error: any) {
                console.error('[handleGuildAction] GET_GUILD_INFO error:', error);
                console.error('[handleGuildAction] Error stack:', error.stack);
                console.error('[handleGuildAction] User:', { id: user.id, guildId: user.guildId });
                console.error('[handleGuildAction] Guilds keys:', Object.keys(guilds));
                return { error: `길드 정보를 가져오는 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}` };
            }
        }
        
        case 'SEND_GUILD_CHAT_MESSAGE': {
            const { content } = payload;
            if (!user.guildId) return { error: "길드에 가입되어 있지 않습니다." };
            const guild = guilds[user.guildId];
            if (!guild) return { error: "길드를 찾을 수 없습니다." };
            
            if (!content || typeof content !== 'string' || !content.trim()) {
                return { error: '메시지 내용을 입력해주세요.' };
            }
            
            const trimmedContent = content.trim();
            if (trimmedContent.length > 200) {
                return { error: '메시지는 200자 이하여야 합니다.' };
            }
            
            if (containsProfanity(trimmedContent)) {
                return { error: '메시지에 부적절한 단어가 포함되어 있습니다.' };
            }
            
            const now = Date.now();
            
            // 스팸 방지 체크
            const lastMessageTime = volatileState.userLastChatMessage[user.id] || 0;
            if (now - lastMessageTime < 5000 && !user.isAdmin) {
                return { error: '메시지를 너무 자주 보낼 수 없습니다.' };
            }
            
            // chatHistory 초기화
            if (!guild.chatHistory) {
                guild.chatHistory = [];
            }
            
            // 메시지 생성
            const message: ChatMessage = {
                id: `msg-guild-${randomUUID()}`,
                user: { id: user.id, nickname: user.nickname },
                authorId: user.id,
                text: trimmedContent,
                content: trimmedContent,
                system: false,
                timestamp: now,
                createdAt: now,
            };
            
            // 메시지 추가
            guild.chatHistory.push(message);
            
            // 최대 100개까지만 유지
            if (guild.chatHistory.length > 100) {
                guild.chatHistory.shift();
            }
            
            volatileState.userLastChatMessage[user.id] = now;
            
            // DB 저장
            await db.setKV('guilds', guilds);
            
            // 브로드캐스트
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            
            return { clientResponse: { message, guilds } };
        }
        
        case 'GUILD_DELETE_CHAT_MESSAGE': {
            const { messageId, timestamp } = payload;
            if (!user.guildId) return { error: "길드??가?�되???��? ?�습?�다." };
            const guild = guilds[user.guildId];
            if (!guild) return { error: "길드�?찾을 ???�습?�다." };
            if (!guild.chatHistory) {
                return { error: "메시지�?찾을 ???�습?�다." };
            }
        
            let messageIndex = -1;
            
            // Primary method: find by ID
            if (messageId) {
                messageIndex = guild.chatHistory.findIndex(m => m.id === messageId);
            }
            
            // Fallback method for older messages without an ID on the client
            if (messageIndex === -1 && timestamp) {
                messageIndex = guild.chatHistory.findIndex(m => m.createdAt === timestamp && m.authorId === user.id);
            }
            
            if (messageIndex === -1) {
                return { error: "메시지�?찾을 ???�습?�다." };
            }
        
            const messageToDelete = guild.chatHistory[messageIndex];
            if (!guild.members) return { error: "길드 ?�보�?찾을 ???�습?�다." };
            
            const myMemberInfo = guild.members.find(m => m.userId === user.id);
            const canManage = myMemberInfo?.role === GuildMemberRole.Master || myMemberInfo?.role === GuildMemberRole.Vice;
        
            if (messageToDelete.authorId !== user.id && !canManage) {
                return { error: "메시지�???��??권한???�습?�다." };
            }
        
            guild.chatHistory.splice(messageIndex, 1);
            
            await db.setKV('guilds', guilds);
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            
            return { clientResponse: { guilds } };
        }
        
        case 'START_GUILD_BOSS_BATTLE': {
            const { bossId, result } = payload;
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };
            
            // 최신 사용자 데이터를 다시 로드하여 기부 등에서 받은 길드코인을 반영
            const freshUser = await db.getUser(user.id);
            if (!freshUser) return { error: '사용자를 찾을 수 없습니다.' };
            
            if (!guild.guildBossState) {
                guild.guildBossState = {
                    currentBossId: bossId,
                    currentBossHp: GUILD_BOSSES.find(b => b.id === bossId)?.maxHp || 1000000,
                    totalDamageLog: {},
                };
            }
            
            guild.guildBossState.currentBossHp = result.bossHpAfter;
            guild.guildBossState.totalDamageLog[freshUser.id] = (guild.guildBossState.totalDamageLog[freshUser.id] || 0) + result.damageDealt;

            if (!freshUser.isAdmin) {
                freshUser.guildBossAttempts = (freshUser.guildBossAttempts || 0) + 1;
            }

            // 길드 기여도 추가 (보스전 참여)
            guildService.addContribution(guild, freshUser.id, 20);
            
            // 보상 지급
            const rewards = result.rewards;
            
            // 길드 코인
            freshUser.guildCoins = (freshUser.guildCoins || 0) + rewards.guildCoins;
            user.guildCoins = freshUser.guildCoins;
            
            // 골드
            freshUser.gold = (freshUser.gold || 0) + rewards.gold;
            
            // 길드 경험치
            if (guild.xp === undefined) guild.xp = 0;
            guild.xp += rewards.guildXp;
            
            // 연구소 포인트
            if (!guild.researchPoints) guild.researchPoints = 0;
            guild.researchPoints += rewards.researchPoints;
            
            // 인벤토리에 추가할 아이템들
            const itemsToAdd: InventoryItem[] = [];
            
            // 강화재료 추가
            const materialTemplate = MATERIAL_ITEMS[rewards.materials.name];
            if (materialTemplate && rewards.materials.quantity > 0) {
                itemsToAdd.push({
                    ...materialTemplate,
                    id: `item-${randomUUID()}`,
                    createdAt: Date.now(),
                    isEquipped: false,
                    quantity: rewards.materials.quantity,
                    level: 1,
                    stars: 0,
                } as InventoryItem);
            }
            
            // 변경권 추가
            for (const ticket of rewards.tickets) {
                const ticketTemplate = CONSUMABLE_ITEMS.find(item => item.name === ticket.name);
                if (ticketTemplate && ticket.quantity > 0) {
                    itemsToAdd.push({
                        ...ticketTemplate,
                        id: `item-${randomUUID()}`,
                        createdAt: Date.now(),
                        isEquipped: false,
                        quantity: ticket.quantity,
                        level: 1,
                        stars: 0,
                    } as InventoryItem);
                }
            }
            
            // 장비 추가
            let generatedEquipment: InventoryItem | null = null;
            if (rewards.equipment && rewards.equipment.grade) {
                const allSlots: EquipmentSlot[] = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];
                const randomSlot = allSlots[Math.floor(Math.random() * allSlots.length)];
                generatedEquipment = generateNewItem(rewards.equipment.grade, randomSlot);
                if (generatedEquipment) {
                    itemsToAdd.push(generatedEquipment);
                    console.log(`[START_GUILD_BOSS_BATTLE] Generated equipment: ${generatedEquipment.name} (${generatedEquipment.grade}, ${generatedEquipment.slot}) for user ${freshUser.id}`);
                } else {
                    console.error(`[START_GUILD_BOSS_BATTLE] Failed to generate equipment for user ${freshUser.id}`);
                }
            } else {
                console.warn(`[START_GUILD_BOSS_BATTLE] No equipment in rewards for user ${freshUser.id}. Rewards:`, JSON.stringify(rewards));
            }
            
            // 인벤토리에 아이템 추가
            if (itemsToAdd.length > 0) {
                const { success, updatedInventory } = addItemsToInventory(freshUser.inventory || [], freshUser.inventorySlots || { equipment: 30, consumable: 30, material: 30 }, itemsToAdd);
                if (success && updatedInventory) {
                    freshUser.inventory = updatedInventory;
                    console.log(`[START_GUILD_BOSS_BATTLE] Successfully added ${itemsToAdd.length} items to inventory for user ${freshUser.id}. Equipment included: ${generatedEquipment ? 'Yes' : 'No'}`);
                } else {
                    console.error(`[START_GUILD_BOSS_BATTLE] Failed to add items to inventory for user ${freshUser.id}. Inventory may be full. Items attempted: ${itemsToAdd.length}`);
                    // 인벤토리가 가득 찬 경우에도 다른 보상은 지급됨 (골드, 길드 코인 등)
                }
            } else {
                console.warn(`[START_GUILD_BOSS_BATTLE] No items to add to inventory for user ${freshUser.id}`);
            }
            
            // 실제 생성된 장비 정보를 result에 추가 (보상 모달에서 표시하기 위해)
            if (generatedEquipment) {
                if (!result.rewards.equipment) {
                    result.rewards.equipment = {} as any;
                }
                (result.rewards.equipment as any).name = generatedEquipment.name;
                (result.rewards.equipment as any).image = generatedEquipment.image;
                (result.rewards.equipment as any).slot = generatedEquipment.slot;
                (result.rewards.equipment as any).grade = generatedEquipment.grade;
                console.log(`[START_GUILD_BOSS_BATTLE] Updated result.rewards.equipment with: name=${generatedEquipment.name}, image=${generatedEquipment.image}, slot=${generatedEquipment.slot}, grade=${generatedEquipment.grade}`);
            } else {
                console.warn(`[START_GUILD_BOSS_BATTLE] No generatedEquipment to add to result for user ${freshUser.id}`);
            }
            
            updateQuestProgress(freshUser, 'guild_boss_participate');
            
            const currentBoss = GUILD_BOSSES.find(b => b.id === guild.guildBossState!.currentBossId);
            if (currentBoss) {
                // 닉네임에 따라 "이/가" 결정
                const nicknameEnding = freshUser.nickname && /[가-힣]$/.test(freshUser.nickname) 
                    ? (freshUser.nickname.charCodeAt(freshUser.nickname.length - 1 - 0xAC00) % 28 === 0 ? '가' : '이')
                    : '이';
                
                const chatMessage: GuildMessage = {
                    id: `msg-guild-${randomUUID()}`,
                    guildId: guild.id,
                    authorId: 'system',
                    content: `[${freshUser.nickname}]${nicknameEnding} ${currentBoss.name}에게 ${result.damageDealt}의 피해를 입혔습니다.`,
                    createdAt: Date.now(),
                };
                if (!guild.chatHistory) guild.chatHistory = [];
                guild.chatHistory.push(chatMessage);
                if (guild.chatHistory.length > 100) {
                    guild.chatHistory.shift();
                }
            }

            await db.setKV('guilds', guilds);
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(freshUser).catch(err => {
                console.error(`[START_GUILD_BOSS_BATTLE] Failed to save user ${freshUser.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 필수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(freshUser, ['guildCoins', 'guildBossAttempts', 'gold', 'researchPoints', 'inventory', 'inventorySlots']);
            
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            
            // result 객체에 장비 정보 업데이트 (직접 수정)
            if (generatedEquipment && result.rewards.equipment) {
                (result.rewards.equipment as any).name = generatedEquipment.name;
                (result.rewards.equipment as any).image = generatedEquipment.image;
                (result.rewards.equipment as any).slot = generatedEquipment.slot;
                (result.rewards.equipment as any).grade = generatedEquipment.grade;
            }
            
            return { clientResponse: { updatedUser: freshUser, guildBossBattleResult: result, guilds } };
        }

        
        case 'CLAIM_GUILD_WAR_REWARD': {
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };
            
            // 길드전 정보 가져오기
            const activeWars = await db.getKV<any[]>('activeGuildWars') || [];
            const completedWars = activeWars.filter(w => w.status === 'completed');
            
            // 사용자의 길드가 참여한 완료된 길드전 찾기
            const myWar = completedWars.find(w => 
                w.guild1Id === user.guildId || w.guild2Id === user.guildId
            );
            
            if (!myWar) return { error: '받을 수 있는 보상이 없습니다.' };
            
            // 이미 받았는지 확인
            const claimedRewards = await db.getKV<Record<string, string[]>>('guildWarClaimedRewards') || {};
            if (claimedRewards[myWar.id]?.includes(user.id)) {
                return { error: '이미 보상을 받았습니다.' };
            }
            
            // 승리/패배 확인
            const isWinner = myWar.result?.winnerId === user.guildId;
            
            // 보상 계산
            const rewards = {
                guildCoins: isWinner ? getRandomInt(100, 200) : getRandomInt(10, 50),
                guildXp: isWinner ? 10000 : 2000,
                researchPoints: isWinner ? getRandomInt(1000, 3000) : getRandomInt(100, 1000),
                gold: isWinner ? getRandomInt(3000, 5000) : getRandomInt(500, 1000),
                diamonds: isWinner ? getRandomInt(20, 50) : getRandomInt(5, 10),
            };
            
            // 최신 사용자 데이터 로드
            const freshUser = await db.getUser(user.id);
            if (!freshUser) return { error: '사용자를 찾을 수 없습니다.' };
            
            // 보상 지급
            freshUser.gold = (freshUser.gold || 0) + rewards.gold;
            freshUser.guildCoins = (freshUser.guildCoins || 0) + rewards.guildCoins;
            freshUser.diamonds = (freshUser.diamonds || 0) + rewards.diamonds;
            
            // 길드 경험치
            if (guild.xp === undefined) guild.xp = 0;
            guild.xp += rewards.guildXp;
            
            // 연구소 포인트
            if (!guild.researchPoints) guild.researchPoints = 0;
            guild.researchPoints += rewards.researchPoints;
            
            // 받기 기록 저장
            if (!claimedRewards[myWar.id]) {
                claimedRewards[myWar.id] = [];
            }
            claimedRewards[myWar.id].push(user.id);
            await db.setKV('guildWarClaimedRewards', claimedRewards);
            await db.setKV('guilds', guilds);
            
            await db.updateUser(freshUser);
            
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(freshUser, ['gold', 'guildCoins', 'diamonds']);
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            
            return { 
                clientResponse: { 
                    updatedUser: freshUser,
                    warResult: {
                        isWinner,
                        guild1Stars: myWar.result?.guild1Stars || 0,
                        guild2Stars: myWar.result?.guild2Stars || 0,
                        guild1Score: myWar.result?.guild1Score || 0,
                        guild2Score: myWar.result?.guild2Score || 0,
                    },
                    rewards: rewards
                } 
            };
        }

        
        default:
            console.log(`[handleGuildAction] Unknown guild action type: ${type}`);
            return { error: 'Unknown guild action type.' };
    }
};
