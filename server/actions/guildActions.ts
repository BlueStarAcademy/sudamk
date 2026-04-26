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
    type GuildBossBattleResult,
    type GuildMessage,
    type GuildMember,
} from '../../types/index.js';
import { containsProfanity } from '../../profanity.js';
import { createDefaultGuild } from '../initialData.js';
import { GUILD_CREATION_COST, GUILD_DONATION_DIAMOND_COST, GUILD_DONATION_DIAMOND_LIMIT, GUILD_DONATION_DIAMOND_REWARDS, GUILD_DONATION_GOLD_COST, GUILD_DONATION_GOLD_LIMIT, GUILD_DONATION_GOLD_REWARDS, GUILD_LEAVE_COOLDOWN_MS, GUILD_RESEARCH_PROJECTS, GUILD_CHECK_IN_MILESTONE_REWARDS, GUILD_SHOP_ITEMS, CONSUMABLE_ITEMS, MATERIAL_ITEMS, GUILD_BOSSES, GUILD_BOSS_DAMAGE_TIERS, GUILD_BOSS_CONTRIBUTION_BY_TIER, GUILD_BOSS_PERSONAL_REWARDS_TIERS, GUILD_WAR_BOT_GUILD_ID, DEMO_GUILD_WAR, GUILD_WAR_MAIN_TIME_MINUTES, GUILD_WAR_FISCHER_INCREMENT_SECONDS, GUILD_WAR_MIN_PARTICIPANTS, GUILD_WAR_MAX_PARTICIPANTS, GUILD_WAR_PERSONAL_DAILY_ATTEMPTS, getGuildWarBoardMode, normalizeGuildWarBoardModes, getGuildWarCaptureInitialStones, getGuildWarBoardLineSize, getGuildWarMissileCountByBoardId, getGuildWarHiddenStoneCountByBoardId, getGuildWarScanCountByBoardId, getGuildWarAutoScoringTurnsByBoardId, getGuildWarCaptureBlackTargetByBoardId, GUILD_WAR_CAPTURE_AI_TARGET, getGuildWarCaptureTurnLimitByBoardId, getGuildWarKataServerLevelByBoardId } from '../../shared/constants/index.js';
import {
    MIN_COMBINED_LEVEL_FOR_GUILD_FEATURES,
    userMeetsGuildFeatureLevelRequirement,
    getGuildWarBoardDisplayName,
} from '../../shared/constants/guildConstants.js';
import { EquipmentSlot, ItemGrade, GameMode, Player } from '../../types/enums.js';
import { generateNewItem } from './inventoryActions.js';
import * as currencyService from '../currencyService.js';
import * as guildService from '../guildService.js';
import { isSameDayKST, isDifferentWeekKST, isDifferentMonthKST, getStartOfDayKST, getTodayKSTDateString } from '../../utils/timeUtils.js';
import { addItemsToInventory, getItemTemplateByName } from '../../utils/inventoryUtils.js';
import { openGuildGradeBox } from '../shop.js';
import { randomUUID } from 'crypto';
import { updateQuestProgress } from '../questService.js';
import { calculateGuildMissionXp } from '../../utils/guildUtils.js';
import {
    calculateGuildBossBattleRewards,
    getCurrentGuildBossStage,
    getScaledGuildBossMaxHp,
} from '../../utils/guildBossStageUtils.js';
import { aggregateSpecialOptionGearFromUser } from '../../shared/utils/specialOptionGearEffects.js';
import { broadcast } from '../socket.js';
import { generateStrategicRandomBoard } from '../strategicInitialBoard.js';
import {
    cloneBoardStateForKataOpeningSnapshot,
    encodeBoardStateAsKataSetupMovesFromEmpty,
} from '../kataCaptureSetupEncoding.js';
import { DEFAULT_REWARD_CONFIG, normalizeRewardConfig } from '../../shared/constants/rewardConfig.js';
import { isRewardVipActive } from '../../shared/utils/rewardVip.js';
import { rollAndResolveRewardVipPlayGrant } from '../summaryService.js';
import { computeGuildWarAttemptMetrics } from '../../shared/utils/guildWarAttemptMetrics.js';

const getRandomInt = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

/** 동일 길드 KV 동시 갱신으로 출석 마일스톤 보상이 이중 지급되는 것을 방지 */
class GuildKvMutex {
    private tail = Promise.resolve();
    run<T>(fn: () => Promise<T>): Promise<T> {
        const next = this.tail.then(() => fn());
        this.tail = next.then(() => undefined).catch(() => undefined);
        return next;
    }
}
const guildKvMutexById = new Map<string, GuildKvMutex>();
function runGuildKvExclusive<T>(guildId: string, fn: () => Promise<T>): Promise<T> {
    let m = guildKvMutexById.get(guildId);
    if (!m) {
        m = new GuildKvMutex();
        guildKvMutexById.set(guildId, m);
    }
    return m.run(fn);
}

type GuildWarDataCacheEntry = {
    expiresAt: number;
    response?: HandleActionResult;
};
const guildWarDataCacheByUser = new Map<string, GuildWarDataCacheEntry>();
const GUILD_WAR_DATA_CACHE_MS = 5000;

/**
 * GET_GUILD_INFO는 요청 시작 시점의 guilds 스냅샷으로 멤버만 동기화한 뒤 저장한다.
 * 그 사이 출석 마일스톤 수령·보스전·체크인 등으로 KV가 갱신되면 오래된 객체로 덮어써
 * dailyCheckInRewardsClaimed 등이 사라져 보상을 다시 받을 수 있다. 저장 직전 KV를 읽어 병합한다.
 */
function mergeLatestGuildKvExceptMembers(guild: Guild, latestGuilds: Record<string, Guild>): void {
    const latest = latestGuilds[guild.id];
    if (!latest) return;
    const syncedMembers = guild.members;
    Object.assign(guild, latest);
    guild.members = syncedMembers;
}

/** 출전 명단 기준 길드원 총 도전권(당일 사용/총량) — 상황판용 */
function buildGuildWarTicketSummary(
    war: any,
    viewerGuildId: string,
    guildsMap: Record<string, Guild>,
    todayKST: string
): {
    myRoster: { used: number; total: number };
    opponentRoster: { used: number; total: number; unknown?: boolean };
} {
    const isG1 = war.guild1Id === viewerGuildId;
    const oppGuildId = isG1 ? war.guild2Id : war.guild1Id;
    const myIdsRaw = isG1 ? war.guild1ParticipantIds : war.guild2ParticipantIds;
    const oppIdsRaw = isG1 ? war.guild2ParticipantIds : war.guild1ParticipantIds;
    const da = war.dailyAttempts || {};
    const sumFor = (roster: string[]) => {
        let u = 0;
        for (const id of roster) {
            u += da[id]?.[todayKST] ?? 0;
        }
        return u;
    };
    let myRoster = Array.isArray(myIdsRaw)
        ? [...new Set(myIdsRaw.filter((x: unknown) => typeof x === 'string' && (x as string).length > 0) as string[])]
        : [];
    if (myRoster.length === 0) {
        const g = guildsMap[viewerGuildId];
        myRoster = (g?.members || []).map((m) => m.userId).slice(0, GUILD_WAR_MAX_PARTICIPANTS);
    }
    const myUsed = sumFor(myRoster);
    const myTotal = myRoster.length * GUILD_WAR_PERSONAL_DAILY_ATTEMPTS;

    let oppRoster = Array.isArray(oppIdsRaw)
        ? [...new Set(oppIdsRaw.filter((x: unknown) => typeof x === 'string' && (x as string).length > 0) as string[])]
        : [];
    const oppIsBot = oppGuildId === GUILD_WAR_BOT_GUILD_ID || war.isBotGuild === true;
    if (oppRoster.length === 0 && oppIsBot) {
        const botUsed = Number(
            isG1
                ? (war.guild2TotalAttempts ?? 0)
                : (war.guild1TotalAttempts ?? 0)
        ) || 0;
        const botTotal =
            Number((war as any).botPlannedTotalAttempts) ||
            Number(war.maxAttemptsPerGuild ?? 0) ||
            botUsed;
        return {
            myRoster: { used: myUsed, total: myTotal },
            opponentRoster: { used: botUsed, total: botTotal, unknown: false },
        };
    }
    if (oppRoster.length === 0) {
        const g = guildsMap[oppGuildId];
        oppRoster = (g?.members || []).map((m) => m.userId).slice(0, GUILD_WAR_MAX_PARTICIPANTS);
    }
    const oppUsed = sumFor(oppRoster);
    const oppTotal = oppRoster.length * GUILD_WAR_PERSONAL_DAILY_ATTEMPTS;
    return {
        myRoster: { used: myUsed, total: myTotal },
        opponentRoster: { used: oppUsed, total: oppTotal },
    };
}

/** START_GUILD_WAR 응답용 — 길드전 매칭 결과 연출(모달·알림) */
export type GuildWarMatchPresentation = {
    badge: string;
    tone: 'rival' | 'system' | 'demo';
    lines: string[];
};

function augmentGuildWarOpponentInGuildsMap(createdWar: any, myGuildId: string, guildsForResponse: Record<string, any>): void {
    if (!createdWar || createdWar.status !== 'active') return;
    const oppId = createdWar.guild1Id === myGuildId ? createdWar.guild2Id : createdWar.guild1Id;
    if (!oppId || guildsForResponse[oppId]) return;
    const isBot = !!(createdWar as any).isBotGuild;
    guildsForResponse[oppId] = {
        id: oppId,
        name: isBot ? '[시스템] 길드전 AI' : '상대 길드',
        level: 1,
        members: [],
        leaderId: oppId,
    };
}

function buildGuildWarMatchPresentation(
    createdWar: any,
    guildsForResponse: Record<string, any>,
    myGuildId: string,
    opts?: { instantAllBotDemo?: boolean },
): { message: string; matchPresentation?: GuildWarMatchPresentation } {
    if (!createdWar || createdWar.status !== 'active') {
        return { message: '' };
    }
    augmentGuildWarOpponentInGuildsMap(createdWar, myGuildId, guildsForResponse);
    const oppId = createdWar.guild1Id === myGuildId ? createdWar.guild2Id : createdWar.guild1Id;
    const oppName = (guildsForResponse[oppId]?.name as string | undefined)?.trim() || '상대 길드';
    const vsBot = !!(createdWar as any).isBotGuild;

    if (opts?.instantAllBotDemo) {
        return {
            message: '데모: 봇 길드와 즉시 전장이 열렸습니다.',
            matchPresentation: {
                badge: '데모 즉시 매칭',
                tone: 'demo',
                lines: [
                    '테스트 모드에서는 신청한 길드가 곧바로 시스템 봇 길드와 붙습니다.',
                    '실제 운영에서는 다른 길드와 짝을 이루고, 홀수일 때만 봇이 배정됩니다.',
                ],
            },
        };
    }

    if (vsBot) {
        return {
            message: '매칭 완료! 시스템 봇 길드와 전장이 열렸습니다.',
            matchPresentation: {
                badge: '홀수 대기 → 시스템 매치',
                tone: 'system',
                lines: [
                    '이번 길드전 신청 길드 수가 홀수여서, 짝을 이루지 못한 한 팀은 규칙에 따라 시스템 봇 길드와 매칭됩니다.',
                    '봇 전장도 실제 길드전과 같은 룰·보상 흐름으로 진행됩니다.',
                    '출전 명단 없이 길드원 누구나 전장에 들어가 공격할 수 있습니다. (일일 개인 출전 제한 적용)',
                ],
            },
        };
    }

    return {
        message: `매칭 완료! 이번 상대는 「${oppName}」입니다.`,
        matchPresentation: {
            badge: '길드 대결 확정',
            tone: 'rival',
            lines: [
                `상대 길드: ${oppName}`,
                '9개 보드에서 별과 점수로 우열을 겨룹니다.',
                '출전 명단 없이 길드원 전원이 전장에 참여할 수 있습니다.',
            ],
        },
    };
}

function appendGuildWarParticipationSystemChat(
    guildsMap: Record<string, any>,
    guildId: string,
    user: User,
    createdWar: any | null | undefined,
): void {
    const g = guildsMap[guildId];
    if (!g) return;
    const nicknameEnding =
        user.nickname && /[가-힣]$/.test(user.nickname)
            ? user.nickname.charCodeAt(user.nickname.length - 1 - 0xAC00) % 28 === 0
                ? '가'
                : '이'
            : '이';
    let content: string;
    if (!createdWar || createdWar.status !== 'active') {
        content = `[${user.nickname}]${nicknameEnding} 길드 전쟁에 참여했습니다. 매칭을 진행합니다.`;
    } else if ((createdWar as any).isBotGuild) {
        content = `[${user.nickname}]${nicknameEnding} 길드 전쟁에 참여했습니다. 홀수 대기로 시스템 봇 길드와 매칭되었습니다.`;
    } else {
        const oid = createdWar.guild1Id === guildId ? createdWar.guild2Id : createdWar.guild1Id;
        const oname = (guildsMap[oid]?.name as string | undefined)?.trim() || '상대 길드';
        content = `[${user.nickname}]${nicknameEnding} 길드 전쟁에 참여했습니다. 상대: 「${oname}」`;
    }
    const systemMessage: any = {
        id: `msg-guild-war-${randomUUID()}`,
        guildId: g.id,
        authorId: 'system',
        content,
        createdAt: Date.now(),
        system: true,
    };
    if (!g.chatHistory) g.chatHistory = [];
    g.chatHistory.push(systemMessage);
    if (g.chatHistory.length > 100) {
        g.chatHistory.shift();
    }
}

function guildWarSeededHash(input: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

function seededRangeByWar(warId: string, tag: string, min: number, max: number): number {
    const h = guildWarSeededHash(`${warId}|${tag}`);
    return min + (h % (max - min + 1));
}

function applyBotGuildWarAttemptScript(war: any, now: number = Date.now()): boolean {
    if (!war || war.status !== 'active' || !war.isBotGuild) return false;
    if (!war.startTime || !war.boards || typeof war.boards !== 'object') return false;

    const dayMs = 24 * 60 * 60 * 1000;
    const elapsedDays = Math.floor(Math.max(0, now - Number(war.startTime || 0)) / dayMs);
    const day1Used = seededRangeByWar(String(war.id), 'bot-day1', 15, 20);
    const day2Used = seededRangeByWar(String(war.id), 'bot-day2', 5, 15);
    const isSecondDay = elapsedDays >= 1;
    const targetUsed = isSecondDay ? day1Used + day2Used : day1Used;

    const opponentIsGuild2 = war.guild2Id === GUILD_WAR_BOT_GUILD_ID;
    const totalKey = opponentIsGuild2 ? 'guild2TotalAttempts' : 'guild1TotalAttempts';
    const boardKey = opponentIsGuild2 ? 'guild2Attempts' : 'guild1Attempts';

    const currentUsed = Number(war[totalKey] ?? 0) || 0;
    const appliedUsed = Math.max(currentUsed, targetUsed);
    if (appliedUsed === currentUsed && Number((war as any).botPlannedTotalAttempts ?? 0) === day1Used + day2Used) {
        return false;
    }

    war[totalKey] = appliedUsed;
    (war as any).botPlannedTotalAttempts = day1Used + day2Used;
    (war as any).botAttemptScript = { day1Used, day2Used };

    const boardIds = Object.keys(war.boards || {});
    if (boardIds.length === 0) return true;

    const boardWeight = (boardId: string, day: 1 | 2) => {
        // 1일차: 상단/중단 중심, 2일차: 하단 가중을 높여 추가 공격 연출
        let base = 10;
        if (boardId.startsWith('top-')) base += day === 1 ? 8 : 3;
        else if (boardId.startsWith('mid-') || boardId === 'center') base += day === 1 ? 10 : 5;
        else base += day === 1 ? 4 : 9;
        const jitter = guildWarSeededHash(`${war.id}|${boardId}|d${day}`) % 7;
        return base + jitter;
    };
    const allocate = (amount: number, day: 1 | 2) => {
        const weights = boardIds.map((id) => boardWeight(id, day));
        const weightSum = weights.reduce((s, w) => s + w, 0);
        let remain = amount;
        return boardIds.map((_, idx) => {
            if (idx === boardIds.length - 1) return remain;
            const portion = Math.floor((amount * weights[idx]) / Math.max(1, weightSum));
            const safe = Math.max(0, Math.min(remain, portion));
            remain -= safe;
            return safe;
        });
    };
    const day1Alloc = allocate(day1Used, 1);
    const day2Alloc = isSecondDay ? allocate(day2Used, 2) : new Array(boardIds.length).fill(0);
    const allocated = boardIds.map((_, i) => day1Alloc[i] + day2Alloc[i]);
    for (let i = 0; i < boardIds.length; i++) {
        const bid = boardIds[i];
        const b = war.boards[bid];
        if (!b || typeof b !== 'object') continue;
        b[boardKey] = allocated[i];
    }
    return true;
}

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
    const { type } = action;
    const payload = (action as { payload?: unknown }).payload as Record<string, any> | undefined;
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

    // 길드 컨텐츠(출석, 미션, 보스전 등)에서 관리자 ID를 클라이언트와 동일한 값으로 통일
    const ADMIN_USER_ID = 'user-admin-static-id';
    const effectiveUserId = user.isAdmin ? ADMIN_USER_ID : user.id;

    if (!userMeetsGuildFeatureLevelRequirement(user)) {
        const t = type as string;
        const allowWhenLevelLocked =
            t === 'LEAVE_GUILD' ||
            t === 'GUILD_LEAVE' ||
            (t === 'GET_GUILD_INFO' && Boolean(user.guildId));
        if (!allowWhenLevelLocked) {
            return {
                error: `길드 기능은 전략·놀이 레벨 합 ${MIN_COMBINED_LEVEL_FOR_GUILD_FEATURES} 이상에서 이용할 수 있습니다.`,
            };
        }
    }

    switch (type) {
        case 'CREATE_GUILD': {
            try {
                const { name, description, isPublic, joinType } = (payload ?? {}) as {
                    name?: unknown;
                    description?: unknown;
                    isPublic?: unknown;
                    joinType?: unknown;
                };
            
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
            const newGuild = createDefaultGuild(
                guildId,
                trimmedName,
                trimmedDescription || '',
                isPublic !== false,
                user
            );
            if (user.isAdmin) {
                newGuild.leaderId = ADMIN_USER_ID;
                const leaderMember = newGuild.members?.[0];
                if (leaderMember) {
                    leaderMember.userId = ADMIN_USER_ID;
                    leaderMember.id = `${newGuild.id}-member-${ADMIN_USER_ID}`;
                }
            }
            
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
            if (joinType === 'application' || joinType === 'free') {
                newGuild.joinType = joinType;
            }
            
            guilds[guildId] = newGuild;
            
            // Also create guild in Prisma database for consistency (동일한 guildId 사용하여 GET_GUILD_INFO 시 members 동기화 오류 방지)
            try {
                await guildRepo.createGuild({
                    id: guildId,
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
                const { guildId } = (payload ?? {}) as { guildId?: string };
                if (!guildId) {
                    return { error: '길드 ID가 필요합니다.' };
                }
                if (guildId === GUILD_WAR_BOT_GUILD_ID) {
                    return { error: '해당 길드는 가입할 수 없습니다.' };
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
                    const memberId = `member-${effectiveUserId}-${guild.id}`;
                    guild.members.push({
                        id: memberId,
                        guildId: guild.id,
                        userId: effectiveUserId,
                        nickname: user.nickname || '',
                        role: GuildMemberRole.Member,
                        joinDate: Date.now(),
                        contributionTotal: 0,
                        weeklyContribution: 0,
                        lastLoginAt: user.lastLoginAt,
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
                const { searchQuery, limit } = (payload ?? {}) as { searchQuery?: string; limit?: number };
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
                
                // 공개 길드만 필터링 + 길드전 AI 봇 길드는 가입 불가이므로 목록에서 제외
                const filteredGuilds = resultGuilds.filter(g => g.isPublic !== false && g.id !== GUILD_WAR_BOT_GUILD_ID);
                
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
            const { guildId } = (payload ?? {}) as { guildId?: string };
            if (!guildId) return { error: '길드 ID가 필요합니다.' };
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
            const { guildId, applicantId } = (payload ?? {}) as { guildId?: string; applicantId?: string };
            if (!guildId || !applicantId) return { error: '길드 또는 신청자 정보가 없습니다.' };
            const guild = guilds[guildId];
            if (!guild || !guild.members) return { error: '길드�?찾을 ???�습?�다.' };
            const myMemberInfo = guild.members.find((m: GuildMember) => m.userId === effectiveUserId);
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
                lastLoginAt: applicant.lastLoginAt,
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
            const { guildId, applicantId } = (payload ?? {}) as { guildId?: string; applicantId?: string };
            if (!guildId || !applicantId) return { error: '길드 또는 신청자 정보가 없습니다.' };
            const guild = guilds[guildId];
            const myMemberInfo = guild?.members?.find((m: GuildMember) => m.userId === effectiveUserId);
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
                const userAny = user as any;
                if (userAny.status && typeof userAny.status === 'object') {
                    const status = { ...(userAny.status as any) };
                    delete status.guildId;
                    userAny.status = status;
                }
                
                await db.updateUser(user);
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['guildId']);
                
                return { clientResponse: { updatedUser: user } };
            }
            
            if (user.guildId !== guildId) {
                return { error: '가입한 길드가 아닙니다.' };
            }
            
            const memberInfo = guild.members?.find((m: any) => m.userId === effectiveUserId);
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
                guild.members = guild.members?.filter((m: any) => m.userId !== effectiveUserId) || [];
                
                // Prisma에서도 GuildMember 관계 삭제
                try {
                    await guildRepo.removeGuildMember(guildId, user.id);
                } catch (error: any) {
                    console.error(`[GUILD_LEAVE] Failed to remove guild member from Prisma: ${error.message}`);
                }
            }
            
            // 사용자 정보 업데이트
            user.guildId = undefined;
            const userLeave = user as any;
            if (userLeave.status && typeof userLeave.status === 'object') {
                const status = { ...(userLeave.status as any) };
                delete status.guildId;
                if (status.guildApplications) {
                    status.guildApplications = Array.isArray(status.guildApplications)
                        ? status.guildApplications.filter((app: any) => app.guildId !== guildId)
                        : undefined;
                }
                userLeave.status = status;
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
            const { guildId, targetMemberId } = (payload ?? {}) as { guildId?: string; targetMemberId?: string };
            if (!guildId || !targetMemberId) return { error: '길드 또는 대상 정보가 없습니다.' };
            const guild = guilds[guildId];
            if (!guild || !guild.members) return { error: '길드�?찾을 ???�습?�다.' };
            const myMemberInfo = guild.members.find((m: GuildMember) => m.userId === effectiveUserId);
            const targetMemberInfo = guild.members.find((m: GuildMember) => m.userId === targetMemberId);

            if (!myMemberInfo || !targetMemberInfo) return { error: '?�보�?찾을 ???�습?�다.' };
            if ((myMemberInfo.role === GuildMemberRole.Master && targetMemberInfo.role !== GuildMemberRole.Master) || 
                (myMemberInfo.role === GuildMemberRole.Vice && targetMemberInfo.role === GuildMemberRole.Member)) {
                
                guild.members = guild.members.filter((m: GuildMember) => m.userId !== targetMemberId);
                try {
                    await guildRepo.removeGuildMember(guildId, targetMemberId);
                } catch (err: any) {
                    console.error(`[GUILD_KICK_MEMBER] Failed to remove GuildMember in Prisma:`, err?.message);
                }
                const targetUser = await db.getUser(targetMemberId);
                if (targetUser) {
                    targetUser.guildId = undefined;
                    
                    // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
                    const targetAny = targetUser as any;
                    if (targetAny.status && typeof targetAny.status === 'object') {
                        const status = { ...(targetAny.status as any) };
                        delete status.guildId;
                        targetAny.status = status;
                    }
                    await db.updateUser(targetUser);

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
            const { guildId, targetMemberId } = (payload ?? {}) as { guildId?: string; targetMemberId?: string };
            if (!guildId || !targetMemberId) return { error: '길드 또는 대상 정보가 없습니다.' };
            const guild = guilds[guildId];
            if (!guild || !guild.members) return { error: '길드�?찾을 ???�습?�다.' };
            const myMemberInfo = guild.members.find((m: GuildMember) => m.userId === effectiveUserId);
            const targetMemberInfo = guild.members.find((m: GuildMember) => m.userId === targetMemberId);
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
            const { guildId, targetMemberId } = (payload ?? {}) as { guildId?: string; targetMemberId?: string };
            if (!guildId || !targetMemberId) return { error: '길드 또는 대상 정보가 없습니다.' };
            const guild = guilds[guildId];
            if (!guild || !guild.members) return { error: '길드�?찾을 ???�습?�다.' };
            const myMemberInfo = guild.members.find((m: GuildMember) => m.userId === effectiveUserId);
            const targetMemberInfo = guild.members.find((m: GuildMember) => m.userId === targetMemberId);

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
            const { guildId, description, isPublic, icon, joinType } = (payload ?? {}) as {
                guildId?: string;
                description?: string;
                isPublic?: boolean;
                icon?: string;
                joinType?: 'application' | 'free';
            };
            if (!guildId) return { error: '길드 정보가 없습니다.' };
            const guild = guilds[guildId];
            const myMemberInfo = guild?.members?.find((m: GuildMember) => m.userId === effectiveUserId);
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
            const { guildId, announcement } = (payload ?? {}) as { guildId?: string; announcement?: string };
            if (!guildId) return { error: '길드 정보가 없습니다.' };
            const guild = guilds[guildId];
            const myMemberInfo = guild?.members?.find((m: GuildMember) => m.userId === effectiveUserId);
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
            if (isSameDayKST(guild.checkIns[effectiveUserId], now)) return { error: '?�늘 ?��? 출석?�습?�다.' };

            guild.checkIns[effectiveUserId] = now;
            
            // 길드 기여도 추가 (출석)
            const checkInContribution = 10;
            guildService.addContribution(guild, effectiveUserId, checkInContribution);
            guildRepo.incrementGuildMemberContribution(guild.id, user.id, checkInContribution).catch(err => {
                console.error('[GUILD_CHECK_IN] Failed to sync contribution to Prisma:', err);
            });
            
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
            const { milestoneIndex: rawMilestone } = (payload ?? {}) as { milestoneIndex?: number };
            const milestoneIndex =
                typeof rawMilestone === 'number' && Number.isFinite(rawMilestone)
                    ? Math.floor(rawMilestone)
                    : Math.floor(Number(rawMilestone));
            if (!Number.isFinite(milestoneIndex) || milestoneIndex < 0) {
                return { error: '보상 정보가 올바르지 않습니다.' };
            }
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            const gid = user.guildId;
            const rewardConfig = await getRewardConfig();

            return await runGuildKvExclusive(gid, async () => {
                const guildsKv = (await db.getKV<Record<string, Guild>>('guilds')) || {};
                const guild = guildsKv[gid];
                if (!guild) return { error: '길드를 찾을 수 없습니다.' };

                const now = Date.now();
                const todayStr = getTodayKSTDateString(now);
                const todaysCheckIns = Object.values(guild.checkIns || {}).filter((ts) => isSameDayKST(ts, now)).length;
                const milestone = GUILD_CHECK_IN_MILESTONE_REWARDS[milestoneIndex];

                if (!milestone || todaysCheckIns < milestone.count) {
                    return { error: '보상 조건을 만족하지 못했습니다.' };
                }
                if (!guild.dailyCheckInRewardsClaimed) guild.dailyCheckInRewardsClaimed = [];

                const alreadyClaimedToday = guild.dailyCheckInRewardsClaimed.some((c) => {
                    if (c.userId !== effectiveUserId || c.milestoneIndex !== milestoneIndex) return false;
                    const d = (c as { claimedKstDay?: string }).claimedKstDay;
                    if (d === todayStr) return true;
                    if (d == null) return true;
                    return false;
                });

                if (alreadyClaimedToday) {
                    const alreadyUser = await db.getUser(user.id);
                    if (alreadyUser) {
                        await broadcast({ type: 'GUILD_UPDATE', payload: { guilds: guildsKv } });
                        return { clientResponse: { updatedUser: alreadyUser, guilds: guildsKv, alreadyClaimed: true } };
                    }
                    return { error: '이미 수령한 보상입니다.' };
                }

                guild.dailyCheckInRewardsClaimed.push({
                    userId: effectiveUserId,
                    milestoneIndex,
                    claimedKstDay: todayStr,
                });

                const freshUser = await db.getUser(user.id);
                if (!freshUser) {
                    guild.dailyCheckInRewardsClaimed.pop();
                    return { error: '사용자를 찾을 수 없습니다.' };
                }

                let gainedGuildCoins = addRewardBonus(
                    milestone.reward.guildCoins,
                    rewardConfig.guildCheckInCoinBonus
                );
                if (isRewardVipActive(freshUser)) {
                    gainedGuildCoins *= 2;
                }
                freshUser.guildCoins = (freshUser.guildCoins || 0) + gainedGuildCoins;
                user.guildCoins = freshUser.guildCoins;

                await db.setKV('guilds', guildsKv);

                db.updateUser(freshUser).catch((err) => {
                    console.error(`[GUILD_CLAIM_CHECK_IN_REWARD] Failed to save user ${freshUser.id}:`, err);
                });

                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(freshUser, ['guildCoins']);

                await broadcast({ type: 'GUILD_UPDATE', payload: { guilds: guildsKv } });
                return {
                    clientResponse: {
                        updatedUser: freshUser,
                        guilds: guildsKv,
                        ...(gainedGuildCoins > 0 ? { gainedGuildCoins } : {}),
                    },
                };
            });
        }
        case 'GUILD_CLAIM_MISSION_REWARD': {
            const { missionId } = (payload ?? {}) as { missionId?: string };
            const rewardConfig = await getRewardConfig();
            if (!user.guildId) return { error: '길드??가?�되???��? ?�습?�다.' };
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드�?찾을 ???�습?�다.' };
        
            const mission = (guild.weeklyMissions ?? []).find((m) => m.id === missionId);
        
            if (!mission) return { error: '미션??찾을 ???�습?�다.' };
            const missionComplete = mission.isCompleted === true || mission.status === 'completed';
            if (!missionComplete) return { error: '?�직 ?�료?��? ?��? 미션?�니??' };
            if ((mission.claimedBy ?? []).includes(effectiveUserId)) return { error: '?��? ?�령??보상?�니??' };
            
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
            
            let gainedGuildCoins = addRewardBonus(
                mission.personalReward?.guildCoins ?? 0,
                rewardConfig.guildMissionCoinBonus
            );
            if (isRewardVipActive(freshUser)) {
                gainedGuildCoins *= 2;
            }
            freshUser.guildCoins = (freshUser.guildCoins || 0) + gainedGuildCoins;
            user.guildCoins = freshUser.guildCoins; // user 객체도 동기화
        
            // Mark as claimed by the current user
            if (!mission.claimedBy) mission.claimedBy = [];
            mission.claimedBy.push(effectiveUserId);
            const gainedGuildXp = calculateGuildMissionXp(mission.guildReward?.guildXp ?? 0, guild.level ?? 1);
            const rewardSummary = {
                reward: {
                    guildCoins: gainedGuildCoins,
                    guildXp: gainedGuildXp,
                },
                items: [],
                title: '주간 길드 미션 보상 수령',
            };
            
            await db.setKV('guilds', guilds);
            
            // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
            db.updateUser(freshUser).catch(err => {
                console.error(`[GUILD_CLAIM_MISSION_REWARD] Failed to save user ${freshUser.id}:`, err);
            });

            // WebSocket?�로 ?�용???�데?�트 브로?�캐?�트 (최적?�된 ?�수 ?�용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(freshUser, ['guildCoins']);
            
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            return { clientResponse: { updatedUser: freshUser, guilds, rewardSummary } };
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
            
            const reqCount = Math.max(1, Math.floor((payload as any)?.count ?? 1));
            const isGold = type === 'GUILD_DONATE_GOLD';
            const limit = isGold ? GUILD_DONATION_GOLD_LIMIT : GUILD_DONATION_DIAMOND_LIMIT;
            const costPer = isGold ? GUILD_DONATION_GOLD_COST : GUILD_DONATION_DIAMOND_COST;
            
            let maxPossible = 1;
            if (!user.isAdmin) {
                const used = isGold ? user.dailyDonations!.gold : user.dailyDonations!.diamond;
                const resource = isGold ? (user.gold ?? 0) : (user.diamonds ?? 0);
                maxPossible = Math.max(0, Math.min(limit - used, Math.floor(resource / costPer)));
            } else {
                maxPossible = reqCount;
            }
            if (maxPossible < 1) {
                const used = isGold ? user.dailyDonations!.gold : user.dailyDonations!.diamond;
                if (used >= limit) return { error: '오늘 기부 한도가 초과되었습니다.' };
                return { error: isGold ? '골드가 부족합니다.' : '다이아가 부족합니다.' };
            }
            const actualCount = Math.min(reqCount, maxPossible);
            
            let gainedGuildCoins = 0;
            let gainedResearchPoints = 0;
            let gainedGuildXp = 0;
            const rewards = isGold ? GUILD_DONATION_GOLD_REWARDS : GUILD_DONATION_DIAMOND_REWARDS;

            for (let i = 0; i < actualCount; i++) {
            if (type === 'GUILD_DONATE_GOLD') {
                if (!user.isAdmin) {
                    if (user.dailyDonations!.gold >= GUILD_DONATION_GOLD_LIMIT) return { error: '?�늘 골드 기�? ?�도�?초과?�습?�다.' };
                    if (user.gold < GUILD_DONATION_GOLD_COST) return { error: '골드가 부족합?�다.' };
                    currencyService.spendGold(user, GUILD_DONATION_GOLD_COST, '길드 기�?');
                    user.dailyDonations!.gold++;
                }
                const coins = getRandomInt(rewards.guildCoins[0], rewards.guildCoins[1]);
                const research = getRandomInt(rewards.researchPoints[0], rewards.researchPoints[1]);
                gainedGuildCoins += coins;
                gainedResearchPoints += research;
                user.guildCoins = (user.guildCoins || 0) + coins;
                guild.researchPoints = (guild.researchPoints || 0) + research;
                guild.xp = (guild.xp || 0) + rewards.guildXp;
                gainedGuildXp += rewards.guildXp;
                guildService.addContribution(guild, effectiveUserId, rewards.contribution);
                guildRepo.incrementGuildMemberContribution(user.guildId!, user.id, rewards.contribution).catch(() => {});
            } else {
                if (!user.isAdmin) {
                    if (user.dailyDonations!.diamond >= GUILD_DONATION_DIAMOND_LIMIT) return { error: '?�늘 ?�이??기�? ?�도�?초과?�습?�다.' };
                    if (user.diamonds < GUILD_DONATION_DIAMOND_COST) return { error: '?�이?��? 부족합?�다.' };
                    currencyService.spendDiamonds(user, costPer, '길드 기�?');
                    await guildService.updateGuildMissionProgress(user.guildId, 'diamondsSpent', costPer, guilds);
                    user.dailyDonations!.diamond++;
                }
                const coins2 = getRandomInt(rewards.guildCoins[0], rewards.guildCoins[1]);
                const research2 = getRandomInt(rewards.researchPoints[0], rewards.researchPoints[1]);
                gainedGuildCoins += coins2;
                gainedResearchPoints += research2;
                user.guildCoins = (user.guildCoins || 0) + coins2;
                guild.researchPoints = (guild.researchPoints || 0) + research2;
                guild.xp = (guild.xp || 0) + rewards.guildXp;
                gainedGuildXp += rewards.guildXp;
                guildService.addContribution(guild, effectiveUserId, rewards.contribution);
                guildRepo.incrementGuildMemberContribution(user.guildId!, user.id, rewards.contribution).catch(() => {});
            }
            }

            await guildService.updateGuildMissionProgress(user.guildId, 'guildDonations', actualCount, guilds);

            if (isRewardVipActive(user) && gainedGuildCoins > 0) {
                user.guildCoins = (user.guildCoins || 0) + gainedGuildCoins;
                gainedGuildCoins *= 2;
            }

            if (!guild.donationLog) guild.donationLog = [];
            guild.donationLog.push({
                userId: user.id,
                nickname: user.nickname || user.id,
                type: type === 'GUILD_DONATE_GOLD' ? 'gold' : 'diamond',
                count: actualCount,
                coins: gainedGuildCoins,
                research: gainedResearchPoints,
                timestamp: now,
            });
            if (guild.donationLog.length > 100) guild.donationLog.shift();

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
                    },
                    rewardSummary: {
                        reward: {
                            guildCoins: gainedGuildCoins,
                            guildXp: gainedGuildXp,
                        },
                        items: [],
                        title: '길드 기부 보상 수령',
                    },
                }
            };
        }
        
        case 'GUILD_START_RESEARCH': {
            const { guildId, researchId } = (payload ?? {}) as { guildId?: string; researchId?: string };
            if (!guildId || !researchId) return { error: '길드 또는 연구 정보가 없습니다.' };
            const guild = guilds[guildId];
            const myMemberByEffective = guild?.members?.find((m: GuildMember) => m.userId === effectiveUserId);
            const myMemberByActualId =
                user.isAdmin ? guild?.members?.find((m: GuildMember) => m.userId === user.id) : undefined;
            const myMemberInfo = myMemberByEffective ?? myMemberByActualId;
            const isLeaderById =
                guild?.leaderId === effectiveUserId || (user.isAdmin && guild?.leaderId === user.id);
            const canManageResearch =
                isLeaderById ||
                myMemberInfo?.role === GuildMemberRole.Master ||
                myMemberInfo?.role === GuildMemberRole.Vice;
            if (!guild || !canManageResearch) {
                return { error: '권한이 없습니다.' };
            }
            if (guild.researchTask) return { error: '?��? 진행 중인 ?�구가 ?�습?�다.' };

            const project = GUILD_RESEARCH_PROJECTS[researchId as keyof typeof GUILD_RESEARCH_PROJECTS];
            const currentLevel = guild.research?.[researchId as keyof typeof GUILD_RESEARCH_PROJECTS]?.level ?? 0;
            if (currentLevel >= project.maxLevel) return { error: '최고 ?�벨???�달?�습?�다.' };
            
            const cost = getResearchCost(researchId as GuildResearchId, currentLevel);
            const timeMs = getResearchTimeMs(researchId as GuildResearchId, currentLevel);
            const rp = guild.researchPoints ?? 0;
            if (rp < cost) return { error: '연구 포인트가 부족합니다.' };
            guild.researchPoints = rp - cost;
            const startedAt = Date.now();
            const completedAt = startedAt + timeMs;
            guild.researchTask = {
                researchId,
                startedAt,
                completedAt,
                completionTime: completedAt,
            };

            await db.setKV('guilds', guilds);
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            return { clientResponse: { guilds } };
        }
        
        case 'GUILD_BUY_SHOP_ITEM': {
            const shopPl = (payload ?? {}) as { itemId?: string; shopItemId?: string };
            const itemId = shopPl.itemId ?? shopPl.shopItemId;
            if (!itemId) return { error: '상품 정보가 없습니다.' };
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
                    if (itemToBuy.limitType === 'account') {
                        purchasesThisPeriod = purchaseRecord.quantity;
                    } else {
                        const ts = purchaseRecord.lastPurchaseTimestamp ?? purchaseRecord.date;
                        const isNewPeriod =
                            (itemToBuy.limitType === 'weekly' && isDifferentWeekKST(ts, now)) ||
                            (itemToBuy.limitType === 'monthly' && isDifferentMonthKST(ts, now));
                        if (!isNewPeriod) {
                            purchasesThisPeriod = purchaseRecord.quantity;
                        }
                    }
                }

                if (purchasesThisPeriod >= itemToBuy.limit) {
                    const limitMsg =
                        itemToBuy.limitType === 'weekly'
                            ? '주간 구매 한도를 초과했습니다.'
                            : itemToBuy.limitType === 'monthly'
                              ? '월간 구매 한도를 초과했습니다.'
                              : '계정당 구매 한도를 초과했습니다.';
                    return { error: limitMsg };
                }
            }

            // Deduct cost and update purchase record BEFORE giving the item
            if (!user.isAdmin) {
                user.guildCoins = (user.guildCoins || 0) - itemToBuy.cost;

                const now = Date.now();
                if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
                const record = user.dailyShopPurchases[itemId];
                if (itemToBuy.limitType === 'account') {
                    if (record) {
                        record.quantity = (record.quantity || 0) + 1;
                        record.lastPurchaseTimestamp = now;
                        record.date = now;
                    } else {
                        user.dailyShopPurchases[itemId] = {
                            quantity: 1,
                            date: now,
                            lastPurchaseTimestamp: now,
                        };
                    }
                } else if (record) {
                    const ts = record.lastPurchaseTimestamp ?? record.date;
                    const isNewPeriod =
                        (itemToBuy.limitType === 'weekly' && isDifferentWeekKST(ts, now)) ||
                        (itemToBuy.limitType === 'monthly' && isDifferentMonthKST(ts, now));

                    if (isNewPeriod) {
                        record.quantity = 1;
                        record.lastPurchaseTimestamp = now;
                    } else {
                        record.quantity++;
                    }
                } else {
                    user.dailyShopPurchases[itemId] = {
                        quantity: 1,
                        date: now,
                        lastPurchaseTimestamp: now,
                    };
                }
            }

            // Special handling for Stat Points (길드 상점 소모품)
            if (itemToBuy.itemId === '보너스 스탯 +5') {
                user.bonusStatPoints = (user.bonusStatPoints || 0) + 5;

                db.updateUser(user).catch(err => {
                    console.error(`[GUILD_BUY_SHOP_ITEM] Failed to save user ${user.id}:`, err);
                });

                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['bonusStatPoints', 'guildCoins', 'dailyShopPurchases']);

                const rewardSummary = {
                    reward: { bonus: '스탯+5' },
                    items: [],
                    title: '길드 상점 구매',
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
            user.inventory = updatedInventory;
            
            // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
            db.updateUser(user).catch(err => {
                console.error(`[BUY_GUILD_SHOP_ITEM] Failed to save user ${user.id}:`, err);
            });

            // WebSocket?�로 ?�용???�데?�트 브로?�캐?�트 (최적?�된 ?�수 ?�용)
            await guildService.recordGuildEpicPlusEquipmentAcquisition(user, itemsToAdd, guilds);

            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'guildCoins']);
            
            return { clientResponse: { updatedUser: user, obtainedItemsBulk: itemsToAdd } };
        }

        case 'BUY_GUILD_SHOP_ITEM': {
            const { itemId, quantity: qtyRaw } = (payload ?? {}) as { itemId?: string; quantity?: number };
            const quantity = Math.max(1, Math.floor(Number(qtyRaw) || 1));
            if (!itemId) return { error: '상품 정보가 없습니다.' };
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
                if (itemToBuy.limitType === 'account') {
                    purchasesThisPeriod = purchaseRecord.quantity;
                } else {
                    const ts = purchaseRecord.lastPurchaseTimestamp ?? purchaseRecord.date;
                    const isNewPeriod =
                        (itemToBuy.limitType === 'weekly' && isDifferentWeekKST(ts, now)) ||
                        (itemToBuy.limitType === 'monthly' && isDifferentMonthKST(ts, now));
                    if (!isNewPeriod) {
                        purchasesThisPeriod = purchaseRecord.quantity;
                    }
                }
            }

            if (itemToBuy.limit !== Infinity && (purchasesThisPeriod + quantity) > itemToBuy.limit) {
                const limitMsg =
                    itemToBuy.limitType === 'weekly'
                        ? '주간 구매 한도를 초과했습니다.'
                        : itemToBuy.limitType === 'monthly'
                          ? '월간 구매 한도를 초과했습니다.'
                          : '계정당 구매 한도를 초과했습니다.';
                return { error: limitMsg };
            }

            user.guildCoins = (user.guildCoins || 0) - totalCost;

            if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
            const record = user.dailyShopPurchases[itemId];
            if (itemToBuy.limitType === 'account') {
                if (record) {
                    record.quantity = (record.quantity || 0) + quantity;
                    record.lastPurchaseTimestamp = now;
                    record.date = now;
                } else {
                    user.dailyShopPurchases[itemId] = {
                        quantity,
                        date: now,
                        lastPurchaseTimestamp: now,
                    };
                }
            } else if (record) {
                const ts = record.lastPurchaseTimestamp ?? record.date;
                const isNewPeriod =
                    (itemToBuy.limitType === 'weekly' && isDifferentWeekKST(ts, now)) ||
                    (itemToBuy.limitType === 'monthly' && isDifferentMonthKST(ts, now));

                if (isNewPeriod) {
                    record.quantity = quantity;
                    record.lastPurchaseTimestamp = now;
                } else {
                    record.quantity += quantity;
                }
            } else {
                user.dailyShopPurchases[itemId] = {
                    quantity: quantity,
                    date: now,
                    lastPurchaseTimestamp: now,
                };
            }

            if (itemToBuy.itemId === '보너스 스탯 +5') {
                user.bonusStatPoints = (user.bonusStatPoints || 0) + 5 * quantity;
                db.updateUser(user).catch(err => {
                    console.error(`[BUY_GUILD_SHOP_ITEM] Failed to save user ${user.id}:`, err);
                });
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['bonusStatPoints', 'guildCoins', 'dailyShopPurchases']);
                await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
                return {
                    clientResponse: {
                        updatedUser: user,
                        rewardSummary: { reward: { bonus: `스탯+${5 * quantity}` }, items: [], title: '길드 상점 구매' },
                    },
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
            user.inventory = updatedInventory;

                // DB ?�데?�트�?비동기로 처리 (?�답 지??최소??
                db.updateUser(user).catch(err => {
                    console.error(`[BUY_GUILD_SHOP_ITEM] Failed to save user ${user.id}:`, err);
                });

                // WebSocket?�로 ?�용???�데?�트 브로?�캐?�트 (최적?�된 ?�수 ?�용)
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['inventory', 'guildCoins']);
                
            await guildService.recordGuildEpicPlusEquipmentAcquisition(user, itemsToAdd, guilds);

            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } }); // Broadcast guilds

            return { clientResponse: { updatedUser: user, obtainedItemsBulk: itemsToAdd } };
        }

        case 'SET_GUILD_WAR_PARTICIPATION': {
            return { error: '길드전 참여 설정 기능이 제거되었습니다. 모든 길드원이 자동으로 참여합니다.' };
        }

        case 'START_GUILD_WAR': {
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };
            
            const now = Date.now();
            // 종료 시각이 지난 전쟁이 메인 루프보다 먼저 정리되지 않으면 status가 active로 남아 «이미 진행 중» 오탐이 난다.
            try {
                const { processGuildWarEnd } = await import('../scheduledTasks.js');
                await processGuildWarEnd();
            } catch (gwEndErr: any) {
                console.warn('[START_GUILD_WAR] processGuildWarEnd (non-fatal):', gwEndErr?.message);
            }
            const activeWars = (await db.getKV<any[]>('activeGuildWars')) || [];
            const { guildWarIsChronologicallyActive } = await import('../guildWarActiveUtils.js');
            const existingWar = activeWars.find(
                (w) =>
                    (w.guild1Id === user.guildId || w.guild2Id === user.guildId) &&
                    guildWarIsChronologicallyActive(w, now)
            );

            // 데모 모드: 이미 진행 중인 전쟁이 있으면 해당 전쟁으로 입장 가능하도록 반환 (에러 없이)
            if (DEMO_GUILD_WAR && existingWar) {
                const guildsForResponse = await db.getKV<Record<string, Guild>>('guilds') || {};
                const oppId = existingWar.guild1Id === user.guildId ? existingWar.guild2Id : existingWar.guild1Id;
                if (oppId === GUILD_WAR_BOT_GUILD_ID && !guildsForResponse[oppId]) {
                    (guildsForResponse as Record<string, any>)[oppId] = { id: oppId, name: '[데모]길드전AI', level: 1, members: [], leaderId: oppId };
                }
                return {
                    clientResponse: {
                        matched: true,
                        message: '진행 중인 전쟁이 있습니다. 입장 버튼으로 참여하세요.',
                        activeWar: existingWar,
                        guilds: guildsForResponse,
                        isMatching: false,
                    },
                };
            }

            // (일반 모드) 이미 활성 전쟁이 있으면 에러
            if (existingWar) {
                return { error: '이미 진행 중인 전쟁이 있습니다.' };
            }

            const memberIds = (guild.members || []).map((m) => m.userId);
            const memberIdSet = new Set(memberIds);
            const participantEligibleIdSet = new Set<string>();
            for (const id of memberIds) {
                participantEligibleIdSet.add(id);
            }

            // 데모 모드: 매칭 큐에 넣은 뒤 즉시 매칭 실행 → 화/금 0시 매칭과 동일 경로로 봇과 매칭 (테스트용)
            if (DEMO_GUILD_WAR) {
                const defaults = (guild.members || [])
                    .map((m) => m.userId)
                    .filter((id) => memberIdSet.has(id) && participantEligibleIdSet.has(id));
                if (defaults.length === 0) {
                    return { error: '자동 매칭 가능한 길드원이 없습니다.' };
                }
                (guild as any).guildWarPendingParticipantIds = defaults;
                const matchingQueue = await db.getKV<string[]>('guildWarMatchingQueue') || [];
                if (!matchingQueue.includes(user.guildId)) {
                    matchingQueue.push(user.guildId);
                    (guild as any).lastWarActionTime = now;
                }
                (guild as any).guildWarMatching = true;
                await db.setKV('guildWarMatchingQueue', matchingQueue);
                await db.setKV('guilds', guilds);
                await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
                const { processGuildWarMatching } = await import('../scheduledTasks.js');
                await processGuildWarMatching(true);
                const updatedWars = await db.getKV<any[]>('activeGuildWars') || [];
                const guildsForResponse = await db.getKV<Record<string, Guild>>('guilds') || {};
                const createdWar = updatedWars.find((w: any) => w.status === 'active' && (w.guild1Id === user.guildId || w.guild2Id === user.guildId));
                const oppId = createdWar ? (createdWar.guild1Id === user.guildId ? createdWar.guild2Id : createdWar.guild1Id) : null;
                if (oppId === GUILD_WAR_BOT_GUILD_ID && !guildsForResponse[oppId]) {
                    (guildsForResponse as Record<string, any>)[oppId] = { id: oppId, name: '[데모]길드전AI', level: 1, members: [], leaderId: oppId };
                }
                if (createdWar) {
                    appendGuildWarParticipationSystemChat(guildsForResponse as any, user.guildId, user, createdWar);
                    await db.setKV('guilds', guildsForResponse);
                    await broadcast({ type: 'GUILD_UPDATE', payload: { guilds: guildsForResponse } });
                    const pres = buildGuildWarMatchPresentation(createdWar, guildsForResponse as any, user.guildId, {
                        instantAllBotDemo: true,
                    });
                    return {
                        clientResponse: {
                            matched: true,
                            message: pres.message,
                            matchPresentation: pres.matchPresentation,
                            activeWar: createdWar,
                            guilds: guildsForResponse,
                            isMatching: false,
                        },
                    };
                }
                return {
                    clientResponse: {
                        matched: false,
                        message: '매칭 처리 중입니다. 잠시 후 다시 조회해 주세요.',
                        guilds: guildsForResponse,
                        isMatching: false,
                    },
                };
            }

            const defaults = (guild.members || [])
                .map((m) => m.userId)
                .filter((id) => memberIdSet.has(id) && participantEligibleIdSet.has(id));
            if (defaults.length === 0) {
                return { error: '자동 매칭 가능한 길드원이 없습니다.' };
            }
            (guild as any).guildWarPendingParticipantIds = defaults;

            let matchingQueue = (await db.getKV<string[]>('guildWarMatchingQueue')) || [];

            // guildWarMatching만 켜져 큐에 없는 비정상(KV 불일치·부분 실패)이면 큐에 복구 후 아래에서 즉시 매칭
            if ((guild as any).guildWarMatching && !matchingQueue.includes(user.guildId)) {
                matchingQueue.push(user.guildId);
                await db.setKV('guildWarMatchingQueue', matchingQueue);
                console.warn(`[START_GUILD_WAR] Repaired guild ${user.guildId}: guildWarMatching without queue entry`);
            }

            // 이미 큐에 있으면(스케줄 자동 등록 포함) 취소 쿨다운 없이 즉시 매칭 처리
            if (matchingQueue.includes(user.guildId)) {
                (guild as any).guildWarMatching = true;
                await db.setKV('guilds', guilds);
                await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
                const { processGuildWarMatching } = await import('../scheduledTasks.js');
                await processGuildWarMatching(true);
                const updatedWars = await db.getKV<any[]>('activeGuildWars') || [];
                const guildsForResponse = await db.getKV<Record<string, Guild>>('guilds') || {};
                const createdWar = updatedWars.find(
                    (w: any) => w.status === 'active' && (w.guild1Id === user.guildId || w.guild2Id === user.guildId)
                );
                if (createdWar) {
                    augmentGuildWarOpponentInGuildsMap(createdWar, user.guildId, guildsForResponse as any);
                }
                const freshGuild = guildsForResponse[user.guildId] as any;
                const stillMatching = !!freshGuild?.guildWarMatching;
                if (createdWar) {
                    appendGuildWarParticipationSystemChat(guildsForResponse as any, user.guildId, user, createdWar);
                    await db.setKV('guilds', guildsForResponse);
                    await broadcast({ type: 'GUILD_UPDATE', payload: { guilds: guildsForResponse } });
                    const pres = buildGuildWarMatchPresentation(createdWar, guildsForResponse as any, user.guildId);
                    return {
                        clientResponse: {
                            matched: true,
                            message: pres.message,
                            matchPresentation: pres.matchPresentation,
                            activeWar: createdWar,
                            guilds: guildsForResponse,
                            isMatching: false,
                        },
                    };
                }
                return {
                    clientResponse: {
                        matched: false,
                        message: stillMatching
                            ? '매칭 처리 중입니다. 잠시 후 길드 전쟁 화면을 확인해 주세요.'
                            : '매칭 처리를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
                        isMatching: stillMatching,
                        guilds: guildsForResponse,
                    },
                };
            }

            // 쿨타임: 큐에 아직 없는 «새 신청»에만 적용 (취소 직후 자동 큐 등록 뒤 수동 재시도는 위 분기에서 처리)
            const lastWarAction = (guild as any).lastWarActionTime || 0;
            const cooldownTime = 60 * 60 * 1000; // 1시간
            if (lastWarAction && (now - lastWarAction) < cooldownTime) {
                const remaining = cooldownTime - (now - lastWarAction);
                const minutes = Math.floor(remaining / (1000 * 60));
                const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
                return { error: `전쟁 취소 후 1시간이 지나야 신청할 수 있습니다. (남은 시간: ${minutes}분 ${seconds}초)` };
            }

            // 매칭 큐에 추가 (다음날 0시에 자동 매칭됨)
            matchingQueue.push(user.guildId);
            (guild as any).guildWarMatching = true;
            (guild as any).lastWarActionTime = now;
            
            await db.setKV('guildWarMatchingQueue', matchingQueue);
            await db.setKV('guilds', guilds);
            
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });

            // 큐 등록 직후 즉시 매칭 (짝수 길드끼리, 홀수만 남으면 봇 길드와 대결 — scheduled 23시만 기다리지 않음)
            const { processGuildWarMatching } = await import('../scheduledTasks.js');
            await processGuildWarMatching(true);

            const updatedWars = await db.getKV<any[]>('activeGuildWars') || [];
            const guildsForResponse = await db.getKV<Record<string, Guild>>('guilds') || {};
            const createdWar = updatedWars.find(
                (w: any) => w.status === 'active' && (w.guild1Id === user.guildId || w.guild2Id === user.guildId)
            );
            if (createdWar) {
                augmentGuildWarOpponentInGuildsMap(createdWar, user.guildId, guildsForResponse as any);
            }

            const freshGuild = guildsForResponse[user.guildId] as any;
            const stillMatching = !!freshGuild?.guildWarMatching;

            appendGuildWarParticipationSystemChat(guildsForResponse as any, user.guildId, user, createdWar ?? null);
            await db.setKV('guilds', guildsForResponse);
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds: guildsForResponse } });

            if (createdWar) {
                const pres = buildGuildWarMatchPresentation(createdWar, guildsForResponse as any, user.guildId);
                return {
                    clientResponse: {
                        matched: true,
                        message: pres.message,
                        matchPresentation: pres.matchPresentation,
                        activeWar: createdWar,
                        guilds: guildsForResponse,
                        isMatching: false,
                    },
                };
            }

            return {
                clientResponse: {
                    matched: false,
                    message: stillMatching
                        ? '매칭 처리 중입니다. 잠시 후 길드 전쟁 화면을 확인해 주세요.'
                        : '매칭 처리를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
                    isMatching: stillMatching,
                    guilds: guildsForResponse,
                },
            };
        }
        
        case 'CANCEL_GUILD_WAR': {
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };
            
            // 길드장 또는 부길드장 권한 확인 (길드장은 leaderId로도 허용)
            const myMemberInfo = guild.members?.find(m => m.userId === effectiveUserId);
            const isLeaderById = guild.leaderId === effectiveUserId;
            const canStartWar = isLeaderById || myMemberInfo?.role === 'leader' || myMemberInfo?.role === 'officer';
            if (!canStartWar) {
                return { error: '길드장 또는 부길드장만 전쟁을 취소할 수 있습니다.' };
            }
            
            // 매칭 중이 아닌지 확인
            if (!(guild as any).guildWarMatching) {
                return { error: '매칭 중이 아닙니다.' };
            }
            
            const now = Date.now();

            // 매칭 큐에서 제거
            const matchingQueue = await db.getKV<string[]>('guildWarMatchingQueue') || [];
            const queueIndex = matchingQueue.indexOf(user.guildId);
            if (queueIndex >= 0) {
                matchingQueue.splice(queueIndex, 1);
            }
            
            (guild as any).guildWarMatching = false;
            (guild as any).lastWarActionTime = now;
            delete (guild as any).guildWarPendingParticipantIds;
            
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
            
            const cancelCooldownMs = 60 * 60 * 1000;
            return { clientResponse: { message: '매칭이 취소되었습니다.', cooldownUntil: now + cancelCooldownMs } };
        }
        
        case 'GET_GUILD_WAR_DATA': {
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            const cacheKey = effectiveUserId;
            const cached = guildWarDataCacheByUser.get(cacheKey);
            const cacheNow = Date.now();
            if (cached?.response && cached.expiresAt > cacheNow) {
                return cached.response;
            }
            
            let guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            let guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };
            
            // 길드???�이??가?�오�?
            try {
                const { processGuildWarEnd } = await import('../scheduledTasks.js');
                await processGuildWarEnd();
            } catch (e: any) {
                console.warn('[GET_GUILD_WAR_DATA] processGuildWarEnd (non-fatal):', e?.message);
            }
            const { guildWarIsChronologicallyActive } = await import('../guildWarActiveUtils.js');
            const now = Date.now();

            let activeWars = (await db.getKV<any[]>('activeGuildWars')) || [];
            let warInProgress = activeWars.find(
                (w) =>
                    (w.guild1Id === user.guildId || w.guild2Id === user.guildId) &&
                    guildWarIsChronologicallyActive(w, now)
            );
            if (warInProgress && normalizeGuildWarBoardModes(warInProgress)) {
                await db.setKV('activeGuildWars', activeWars);
            }
            let botWarChanged = false;
            if (warInProgress) {
                botWarChanged = applyBotGuildWarAttemptScript(warInProgress, Date.now());
                if (botWarChanged) {
                    await db.setKV('activeGuildWars', activeWars);
                }
            }

            // 진행 중 전쟁이 없는데 큐·플래그만 남은 경우 즉시 봇 매칭으로 복구(입장 가능 상태로)
            if (!warInProgress) {
                const guildsLive = (await db.getKV<Record<string, Guild>>('guilds')) || {};
                const gLive = guildsLive[user.guildId];
                if (gLive) {
                    let mq = (await db.getKV<string[]>('guildWarMatchingQueue')) || [];
                    let mqChanged = false;
                    let gChanged = false;
                    if (mq.includes(user.guildId) && !(gLive as any).guildWarMatching) {
                        (gLive as any).guildWarMatching = true;
                        gChanged = true;
                    }
                    if ((gLive as any).guildWarMatching && !mq.includes(user.guildId)) {
                        mq = [...mq, user.guildId];
                        mqChanged = true;
                    }
                    if (mqChanged) await db.setKV('guildWarMatchingQueue', mq);
                    if (gChanged) await db.setKV('guilds', guildsLive);
                    if (mq.includes(user.guildId) || (gLive as any).guildWarMatching) {
                        const { processGuildWarMatching } = await import('../scheduledTasks.js');
                        await processGuildWarMatching(true);
                        activeWars = (await db.getKV<any[]>('activeGuildWars')) || [];
                        guilds = (await db.getKV<Record<string, Guild>>('guilds')) || {};
                        guild = guilds[user.guildId] ?? guild;
                        warInProgress = activeWars.find(
                            (w) =>
                                (w.guild1Id === user.guildId || w.guild2Id === user.guildId) &&
                                guildWarIsChronologicallyActive(w, now)
                        );
                        if (warInProgress && normalizeGuildWarBoardModes(warInProgress)) {
                            await db.setKV('activeGuildWars', activeWars);
                        }
                        if (warInProgress) {
                            botWarChanged = applyBotGuildWarAttemptScript(warInProgress, Date.now());
                            if (botWarChanged) {
                                await db.setKV('activeGuildWars', activeWars);
                            }
                        }
                    }
                }
            }

            // 매칭 중 여부 확인 (guildWarMatching 또는 매칭큐에 있으면 true)
            const matchingQueue = await db.getKV<string[]>('guildWarMatchingQueue') || [];
            const isInQueue = matchingQueue.includes(user.guildId);
            let isMatching = (guild as any).guildWarMatching || isInQueue;

            // 예약 매칭 일정 안내는 사용하지 않음(즉시 봇 매칭 정책)
            const nextMatchTime: number | undefined = undefined;
            const cancelDeadline: number | null = null;
            const applicationDeadline: number | null = null;
            
            // 전쟁 참여 쿨타임 (취소 후 1시간 동안 재신청 불가)
            const lastWarAction = (guild as any).lastWarActionTime || 0;
            const cooldownTime = 60 * 60 * 1000; // 1시간
            let warActionCooldown: number | null = null;
            if (lastWarAction && (now - lastWarAction) < cooldownTime && !isMatching) {
                warActionCooldown = lastWarAction + cooldownTime;
            }

            const completedForGuild = activeWars
                .filter(
                    (w: any) =>
                        (w.guild1Id === user.guildId || w.guild2Id === user.guildId) &&
                        w.status === 'completed' &&
                        w.result?.winnerId
                )
                .sort((a: any, b: any) => (b.endTime ?? 0) - (a.endTime ?? 0));
            const latestCompletedWar = completedForGuild[0];
            const activeWar = warInProgress ?? null;

            const claimedRewards = await db.getKV<Record<string, string[]>>('guildWarClaimedRewards') || {};
            let guildWarLatestCompletedRewardClaimed = false;
            let guildWarRewardClaimable = false;
            if (latestCompletedWar?.id) {
                guildWarLatestCompletedRewardClaimed = !!claimedRewards[latestCompletedWar.id]?.includes(effectiveUserId);
                const rewardAvailableAt =
                    (latestCompletedWar as any).rewardAvailableAt ??
                    (latestCompletedWar.endTime ?? 0) + 60 * 60 * 1000;
                guildWarRewardClaimable =
                    !guildWarLatestCompletedRewardClaimed && now >= rewardAvailableAt;
            }
            
            // 누적 전쟁 기록 및 마지막 상대 기록 계산
            const myGuildId = user.guildId;
            const completedWars = activeWars.filter((w: any) => w.status === 'completed' && w.result?.winnerId);
            let totalWins = 0;
            let totalLosses = 0;
            let lastOpponent: { name: string; isWin: boolean; ourStars: number; enemyStars: number; ourScore: number; enemyScore: number; guildXp?: number; researchPoints?: number } | null = null;
            
            for (const w of completedWars) {
                const isGuild1 = w.guild1Id === myGuildId;
                const won = w.result.winnerId === myGuildId;
                if (won) totalWins++;
                else totalLosses++;
            }
            
            // 마지막 완료된 전쟁 (가장 최근)
            const lastCompleted = [...completedWars].sort((a: any, b: any) => (b.endTime ?? b.updatedAt ?? 0) - (a.endTime ?? a.updatedAt ?? 0))[0];
            let myRecordInLastWar: { contributedStars: number } | null = null;
            if (lastCompleted && lastCompleted.result) {
                const isGuild1 = lastCompleted.guild1Id === myGuildId;
                const opponentId = isGuild1 ? lastCompleted.guild2Id : lastCompleted.guild1Id;
                const opponentGuild = guilds[opponentId];
                const r = lastCompleted.result;
                lastOpponent = {
                    name: opponentGuild?.name ?? '상대 길드',
                    isWin: r.winnerId === myGuildId,
                    ourStars: isGuild1 ? (r.guild1Stars ?? 0) : (r.guild2Stars ?? 0),
                    enemyStars: isGuild1 ? (r.guild2Stars ?? 0) : (r.guild1Stars ?? 0),
                    ourScore: isGuild1 ? (r.guild1Score ?? 0) : (r.guild2Score ?? 0),
                    enemyScore: isGuild1 ? (r.guild2Score ?? 0) : (r.guild1Score ?? 0),
                    guildXp: (lastCompleted as any).sharedRewards?.guildXp,
                    researchPoints: (lastCompleted as any).sharedRewards?.researchPoints,
                };
                let contributedStars = 0;
                for (const board of Object.values(lastCompleted.boards || {})) {
                    const best = isGuild1 ? (board as any).guild1BestResult : (board as any).guild2BestResult;
                    if (best && (best.userId === user.id || (user.isAdmin && best.userId === ADMIN_USER_ID))) {
                        contributedStars += best.stars ?? 0;
                    }
                }
                myRecordInLastWar = { contributedStars };
            }
            
            const totalPlayed = totalWins + totalLosses;
            const winRate = totalPlayed > 0 ? Math.round((totalWins / totalPlayed) * 100) : 0;
            const warStats = { totalWins, totalLosses, winRate, lastOpponent, myRecordInLastWar };
            
            const activeWarForUser = warInProgress;
            const todayKSTWar = getTodayKSTDateString();
            let myRecordInCurrentWar: { attempts: number; maxAttempts: number; contributedStars: number } | null = null;
            let guildWarTicketSummary: ReturnType<typeof buildGuildWarTicketSummary> | null = null;
            if (activeWarForUser) {
                const isG1 = activeWarForUser.guild1Id === myGuildId;
                /** 관리자: 길드전 도전권 소모 없음 — UI는 항상 잔여 최대(예: 2/2)로 표시 */
                const attempts = user.isAdmin
                    ? 0
                    : (Number(activeWarForUser.userAttempts?.[effectiveUserId] ?? 0) || 0);
                const maxAttempts = GUILD_WAR_PERSONAL_DAILY_ATTEMPTS;
                let contributedStars = 0;
                for (const board of Object.values(activeWarForUser.boards || {})) {
                    const best = isG1 ? (board as any).guild1BestResult : (board as any).guild2BestResult;
                    if (best && (best.userId === user.id || (user.isAdmin && best.userId === ADMIN_USER_ID))) {
                        contributedStars += best.stars ?? 0;
                    }
                }
                myRecordInCurrentWar = { attempts, maxAttempts, contributedStars };
            }

            // 상대가 시스템 봇 길드일 때 guilds에 없으면 표시용 엔트리 추가
            const guildsForResponse = { ...guilds };
            if (activeWar && activeWar.status === 'active') {
                const oppId = activeWar.guild1Id === myGuildId ? activeWar.guild2Id : activeWar.guild1Id;
                if ((activeWar as any).isBotGuild || oppId === GUILD_WAR_BOT_GUILD_ID) {
                    if (!guildsForResponse[oppId]) {
                        (guildsForResponse as Record<string, any>)[oppId] = {
                            id: oppId,
                            name: '[시스템] 길드전 AI',
                            level: 1,
                            members: [],
                            leaderId: oppId,
                        };
                    }
                }
            }

            if (activeWarForUser) {
                guildWarTicketSummary = buildGuildWarTicketSummary(
                    activeWarForUser,
                    myGuildId,
                    guildsForResponse,
                    todayKSTWar
                );
            }

            /** 길드전 대기실 점령자 표시: usersMap에 없는 상대 길드원도 DB 기준 프로필·레벨 제공 */
            let occupierProfileByUserId: Record<
                string,
                {
                    nickname: string;
                    avatarId?: string | null;
                    borderId?: string | null;
                    strategyLevel: number;
                    playfulLevel: number;
                }
            > = {};
            if (warInProgress?.boards && typeof warInProgress.boards === 'object') {
                const { aiUserId: guildWarAiUserId } = await import('../aiPlayer.js');
                const occIds = new Set<string>();
                for (const b of Object.values(warInProgress.boards as Record<string, any>)) {
                    const u1 = b?.guild1BestResult?.userId;
                    const u2 = b?.guild2BestResult?.userId;
                    if (typeof u1 === 'string' && u1 && u1 !== guildWarAiUserId) occIds.add(u1);
                    if (typeof u2 === 'string' && u2 && u2 !== guildWarAiUserId) occIds.add(u2);
                }
                const idList = [...occIds];
                if (idList.length > 0) {
                    const loaded = await Promise.all(idList.map((id) => db.getUser(id)));
                    idList.forEach((id, i) => {
                        const u = loaded[i];
                        if (!u) return;
                        occupierProfileByUserId[id] = {
                            nickname: u.nickname || u.username || id,
                            avatarId: u.avatarId ?? null,
                            borderId: u.borderId ?? null,
                            strategyLevel: Number(u.strategyLevel) || 0,
                            playfulLevel: Number(u.playfulLevel) || 0,
                        };
                    });
                }
            }

            const response: HandleActionResult = {
                clientResponse: {
                    activeWar,
                    guilds: guildsForResponse,
                    isMatching,
                    nextMatchTime,
                    cancelDeadline,
                    applicationDeadline,
                    warActionCooldown,
                    warStats,
                    myRecordInCurrentWar,
                    myRecordInLastWar,
                    guildWarTicketSummary,
                    occupierProfileByUserId,
                    guildWarLatestCompletedRewardClaimed,
                    guildWarRewardClaimable,
                },
            };
            guildWarDataCacheByUser.set(cacheKey, {
                expiresAt: Date.now() + GUILD_WAR_DATA_CACHE_MS,
                response,
            });
            return response;
        }

        case 'GET_MY_GUILD_WAR_ATTEMPT_LOG': {
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            try {
                const { processGuildWarEnd } = await import('../scheduledTasks.js');
                await processGuildWarEnd();
            } catch (e: any) {
                console.warn('[GET_MY_GUILD_WAR_ATTEMPT_LOG] processGuildWarEnd (non-fatal):', e?.message);
            }
            const { guildWarIsChronologicallyActive } = await import('../guildWarActiveUtils.js');
            const now = Date.now();
            const activeWars = (await db.getKV<any[]>('activeGuildWars')) || [];
            const warInProgress = activeWars.find(
                (w) =>
                    (w.guild1Id === user.guildId || w.guild2Id === user.guildId) && guildWarIsChronologicallyActive(w, now),
            );
            if (!warInProgress?.id) {
                return { clientResponse: { myGuildWarAttemptLog: [], warId: null, attemptsUsedInWar: 0, attemptsMax: GUILD_WAR_PERSONAL_DAILY_ATTEMPTS } };
            }
            const acceptedIds = user.isAdmin ? [ADMIN_USER_ID, user.id] : [user.id];
            const { listEndedGuildWarGamesForWar } = await import('../prisma/gameService.js');
            const rows = await listEndedGuildWarGamesForWar(String(warInProgress.id), acceptedIds, 60);
            const AI_USER_ID = 'ai-player-01';

            const modeLabel = (mode: GameMode | string | undefined): string => {
                const m = mode as GameMode;
                if (m === GameMode.Capture) return '따내기';
                if (m === GameMode.Hidden) return '히든';
                if (m === GameMode.Missile) return '미사일';
                return '바둑';
            };

            const log: Array<{
                gameId: string;
                boardId: string;
                boardName: string;
                modeLabel: string;
                outcome: 'win' | 'lose' | 'draw';
                stars: number;
                captures: number;
                scoreDiff?: number;
                /** 해당 판 기준 집점수(모드별 계산 — 클라이언트 기록 표시용) */
                houseScore: number;
                endedAtMs: number;
                detailSummary?: string;
            }> = [];
            for (const { game, rowUpdatedAtMs } of rows) {
                const boardId = String((game as any).guildWarBoardId ?? '');
                const blackId = game.blackPlayerId;
                const whiteId = game.whitePlayerId;
                const humanId =
                    blackId && blackId !== AI_USER_ID ? blackId : whiteId && whiteId !== AI_USER_ID ? whiteId : game.player1?.id;
                let humanEnum: Player;
                if (blackId === humanId) humanEnum = Player.Black;
                else if (whiteId === humanId) humanEnum = Player.White;
                else continue;
                const isDraw = game.winner === Player.None;
                const humanWon = !isDraw && game.winner === humanEnum;
                const outcome: 'win' | 'lose' | 'draw' = isDraw ? 'draw' : humanWon ? 'win' : 'lose';
                const metrics = computeGuildWarAttemptMetrics(game, humanEnum, humanWon);
                const detailParts: string[] = [];
                if (game.mode === GameMode.Capture) {
                    detailParts.push(`따낸 돌 ${metrics.captures ?? 0}개`);
                    if (metrics.maxSingleCapture != null) detailParts.push(`한 번에 최대 ${metrics.maxSingleCapture}점`);
                } else if (metrics.scoreDiff != null) {
                    detailParts.push(`집 차이 ${metrics.scoreDiff}집`);
                } else if (typeof metrics.score === 'number' && metrics.score > 0) {
                    detailParts.push(`집점수 약 ${metrics.score}`);
                }
                const houseScore =
                    typeof metrics.score === 'number' && Number.isFinite(metrics.score)
                        ? Math.round(metrics.score * 10) / 10
                        : 0;
                log.push({
                    gameId: game.id,
                    boardId: boardId || '—',
                    boardName: boardId ? getGuildWarBoardDisplayName(boardId) : '—',
                    modeLabel: modeLabel(game.mode),
                    outcome,
                    stars: metrics.stars ?? 0,
                    captures: metrics.captures ?? 0,
                    scoreDiff: metrics.scoreDiff,
                    houseScore,
                    endedAtMs: rowUpdatedAtMs,
                    detailSummary: detailParts.length ? detailParts.join(' · ') : undefined,
                });
            }

            const attemptsUsedInWar = user.isAdmin ? 0 : (Number(warInProgress.userAttempts?.[effectiveUserId] ?? 0) || 0);

            return {
                clientResponse: {
                    myGuildWarAttemptLog: log,
                    warId: String(warInProgress.id),
                    attemptsUsedInWar,
                    attemptsMax: GUILD_WAR_PERSONAL_DAILY_ATTEMPTS,
                },
            };
        }
        
        case 'START_GUILD_WAR_GAME': {
            const { boardId, isDemo } = (payload ?? {}) as { boardId?: string; isDemo?: boolean };
            if (!boardId) return { error: '보드 정보가 없습니다.' };
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };
            
            let activeWar: any = null;
            let board: any = null;
            const normalizedBoardMode = getGuildWarBoardMode(boardId);
            
            if (isDemo) {
                // 데모 모드에서도 보드 ID 기준 모드로 강제
                board = {
                    boardSize: getGuildWarBoardLineSize(boardId),
                    gameMode: normalizedBoardMode,
                    initialStones: [getGuildWarCaptureInitialStones(boardId)],
                };
            } else {
                try {
                    const { processGuildWarEnd } = await import('../scheduledTasks.js');
                    await processGuildWarEnd();
                } catch (e: any) {
                    console.warn('[START_GUILD_WAR_GAME] processGuildWarEnd (non-fatal):', e?.message);
                }
                const { guildWarIsChronologicallyActive } = await import('../guildWarActiveUtils.js');
                const nowG = Date.now();
                // 실제 모드: 시계상 진행 중인 전쟁만 (status만 active인 좀비 제외)
                const activeWars = (await db.getKV<any[]>('activeGuildWars')) || [];
                activeWar = activeWars.find(
                    (w) =>
                        (w.guild1Id === user.guildId || w.guild2Id === user.guildId) &&
                        guildWarIsChronologicallyActive(w, nowG)
                );

                if (!activeWar) {
                    return { error: '진행 중인 길드 전쟁이 없습니다.' };
                }
                
                // 바둑판 확인
                board = activeWar.boards?.[boardId];
                if (!board) {
                    return { error: '바둑판을 찾을 수 없습니다.' };
                }
                board.gameMode = normalizedBoardMode;
                board.boardSize = getGuildWarBoardLineSize(boardId);
                board.initialStones = [getGuildWarCaptureInitialStones(boardId)];

                if (!user.isAdmin) {
                    const usedAttempts = Number(activeWar.userAttempts?.[effectiveUserId] ?? 0) || 0;
                    if (usedAttempts >= GUILD_WAR_PERSONAL_DAILY_ATTEMPTS) {
                        return {
                            error: `이번 길드전 도전 가능 횟수를 모두 사용했습니다. (1인당 ${GUILD_WAR_PERSONAL_DAILY_ATTEMPTS}회)`,
                        };
                    }
                }
            }
            
            // 게임 모드 및 설정
            const { getAiUser, getAiUserForGuildWar, aiUserId } = await import('../aiPlayer.js');
            const { initializeGame } = await import('../gameModes.js');
            const { randomUUID } = await import('crypto');
            
            let gameMode: GameMode;
            if (normalizedBoardMode === 'capture') {
                gameMode = GameMode.Capture;
            } else if (normalizedBoardMode === 'hidden') {
                gameMode = GameMode.Hidden;
            } else if (normalizedBoardMode === 'missile') {
                gameMode = GameMode.Missile;
            } else {
                gameMode = GameMode.Standard;
            }
            
            // AI 유저 생성 (칸 이름 기반 봇 표시명 — 데모·실전 공통)
            const aiUser =
                typeof boardId === 'string' && boardId.length > 0
                    ? getAiUserForGuildWar(gameMode, boardId)
                    : getAiUser(gameMode);
            
            // 길드전 9칸: AI 난이도 단계는 모드별, Kata `kataServerLevel`은 좌/중/우 열(-30/-28/-25) 고정
            const guildWarKataProfileStep =
                normalizedBoardMode === 'capture' ? 3 : normalizedBoardMode === 'hidden' ? 7 : 5;
            const guildWarKataServerLevel = getGuildWarKataServerLevelByBoardId(
                typeof boardId === 'string' ? boardId : '',
            );

            // 게임 설정
            const gameSettings = {
                boardSize: board.boardSize || getGuildWarBoardLineSize(boardId),
                komi: 0.5,
                timeLimit: GUILD_WAR_MAIN_TIME_MINUTES,
                byoyomiTime: 0,
                byoyomiCount: 0,
                timeIncrement: GUILD_WAR_FISCHER_INCREMENT_SECONDS,
                aiDifficulty: guildWarKataProfileStep,
                goAiBotLevel: guildWarKataProfileStep,
                kataServerLevel: guildWarKataServerLevel,
            };
            
            // 게임 모드별 추가 설정
            if (normalizedBoardMode === 'capture') {
                (gameSettings as any).captureTargetBlack = getGuildWarCaptureBlackTargetByBoardId(boardId);
                (gameSettings as any).captureTargetWhite = GUILD_WAR_CAPTURE_AI_TARGET;
                (gameSettings as any).captureTarget = getGuildWarCaptureBlackTargetByBoardId(boardId);
                (gameSettings as any).blackTurnLimit = getGuildWarCaptureTurnLimitByBoardId(boardId);
            } else if (normalizedBoardMode === 'hidden') {
                (gameSettings as any).hiddenStoneCount = getGuildWarHiddenStoneCountByBoardId(boardId);
                (gameSettings as any).scanCount = getGuildWarScanCountByBoardId(boardId);
            } else if (normalizedBoardMode === 'missile') {
                (gameSettings as any).missileCount = getGuildWarMissileCountByBoardId(boardId);
            }
            if (normalizedBoardMode === 'hidden' || normalizedBoardMode === 'missile') {
                const autoScoringTurns = getGuildWarAutoScoringTurnsByBoardId(boardId);
                (gameSettings as any).autoScoringTurns = autoScoringTurns;
                // strategic.ts / goAiBot 일부 경로는 scoringTurnLimit만 읽음
                (gameSettings as any).scoringTurnLimit = autoScoringTurns;
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
                isRanked: false as const,
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

            // 길드전 9칸 공통: 초기 랜덤 배치 (열 기준 흑/백/문양 — getGuildWarCaptureInitialStones 와 동일)
            if (
                normalizedBoardMode === 'capture' ||
                normalizedBoardMode === 'hidden' ||
                normalizedBoardMode === 'missile'
            ) {
                const initialCfg = getGuildWarCaptureInitialStones(boardId);
                const blackPlain = initialCfg.blackPlain;
                const whitePlain = initialCfg.whitePlain;
                const blackMarked = initialCfg.blackMarked;
                const whiteMarked = initialCfg.whiteMarked;

                const size =
                    Number(game.settings.boardSize) > 0
                        ? Number(game.settings.boardSize)
                        : getGuildWarBoardLineSize(boardId);
                const { board: gwBoard, blackPattern: blackMarkedPoints, whitePattern: whiteMarkedPoints } =
                    generateStrategicRandomBoard(
                        size,
                        {
                            black: blackPlain,
                            white: whitePlain,
                            blackPattern: blackMarked,
                            whitePattern: whiteMarked,
                        },
                        { maxAttempts: 60 }
                    );
                game.boardState = gwBoard;

                // 문양돌은 싱글/도전의 탑과 동일: 2점(baseStones 베이스돌 5점 규칙과 분리 — UI도 패턴 문양 사용)
                game.blackPatternStones = blackMarkedPoints.map((p) => ({ ...p }));
                game.whitePatternStones = whiteMarkedPoints.map((p) => ({ ...p }));
                game.baseStones = undefined;
                (game as any).kataCaptureSetupMoves = encodeBoardStateAsKataSetupMovesFromEmpty(gwBoard);
                (game as any).kataStrategicOpeningBoardState = cloneBoardStateForKataOpeningSnapshot(gwBoard);
            }
            
            // 게임 저장
            await db.saveGame(game);
            
            if (!isDemo && activeWar) {
                const now = Date.now();
                if (!activeWar.dailyAttempts) activeWar.dailyAttempts = {};
                if (!activeWar.userAttempts) activeWar.userAttempts = {};
                if (!user.isAdmin) {
                    activeWar.userAttempts[effectiveUserId] = (Number(activeWar.userAttempts[effectiveUserId] ?? 0) || 0) + 1;
                    const todayKSTStart = getTodayKSTDateString(now);
                    if (!activeWar.dailyAttempts[effectiveUserId]) {
                        activeWar.dailyAttempts[effectiveUserId] = {};
                    }
                    const dayMap = activeWar.dailyAttempts[effectiveUserId] as Record<string, number>;
                    dayMap[todayKSTStart] = (Number(dayMap[todayKSTStart] ?? 0) || 0) + 1;
                }

                // 바둑판 도전 중 상태 업데이트
                if (!board.challenging) {
                    board.challenging = {};
                }
                board.challenging[effectiveUserId] = {
                    userId: effectiveUserId,
                    gameId: game.id,
                    startTime: now,
                };
                
                // 길드 기여도 추가 (전쟁 참여)
                const warContribution = 30;
                guildService.addContribution(guild, effectiveUserId, warContribution);
                guildRepo.incrementGuildMemberContribution(user.guildId!, user.id, warContribution).catch(err => {
                    console.error('[START_GUILD_WAR_GAME] Failed to sync contribution to Prisma:', err);
                });
                
                const activeWars = await db.getKV<any[]>('activeGuildWars') || [];
                const warIndex = activeWars.findIndex(w => w.id === activeWar.id);
                if (warIndex >= 0) {
                    activeWars[warIndex] = activeWar;
                    await db.setKV('activeGuildWars', activeWars);
                }
                guildWarDataCacheByUser.delete(effectiveUserId);
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
                    
                    // 모든 멤버의 nickname 가져오기
                    const membersWithNicknames = await Promise.all(
                        dbMembers.map(async (m) => {
                            const memberUser = await db.getUser(m.userId);
                            const canonicalUserId = memberUser?.isAdmin ? ADMIN_USER_ID : m.userId;
                            return {
                                id: m.id,
                                guildId: m.guildId,
                                userId: canonicalUserId,
                                nickname: memberUser?.nickname || '',
                                role: m.role as 'leader' | 'officer' | 'member',
                                joinDate: m.joinDate,
                                contributionTotal: m.contributionTotal,
                                weeklyContribution: 0,
                                lastLoginAt: memberUser?.lastLoginAt,
                                createdAt: m.createdAt,
                                updatedAt: m.updatedAt,
                            };
                        })
                    );
                    
                    // DB에는 있지만 Prisma GuildMember에 없는 경우: 현재 사용자(관리자 포함) 추가
                    const hasCurrentUserInDbPath = membersWithNicknames.some((m: any) => m.userId === effectiveUserId);
                    if (!hasCurrentUserInDbPath) {
                        const memberUser = await db.getUser(user.id);
                        const dbMemberForUser = dbMembers.find(m => m.userId === user.id);
                        membersWithNicknames.push({
                            id: `${dbGuild.id}-member-${effectiveUserId}`,
                            guildId: dbGuild.id,
                            userId: effectiveUserId,
                            nickname: memberUser?.nickname || memberUser?.username || '알 수 없음',
                            role: dbMemberForUser?.role as 'leader' | 'officer' | 'member' || (dbGuild.leaderId === user.id ? 'leader' : 'member'),
                            joinDate: dbMemberForUser?.joinDate ?? Date.now(),
                            contributionTotal: dbMemberForUser ? Number(dbMemberForUser.contributionTotal) : 0,
                            weeklyContribution: 0,
                            lastLoginAt: memberUser?.lastLoginAt,
                            createdAt: dbMemberForUser?.createdAt ?? Date.now(),
                            updatedAt: dbMemberForUser?.updatedAt ?? Date.now(),
                        });
                        console.log(`[GET_GUILD_INFO] Added current user ${effectiveUserId} to members (DB-only path, was missing)`);
                    }
                    
                    const leaderUser = await db.getUser(dbGuild.leaderId);
                    const canonicalLeaderId = leaderUser?.isAdmin ? ADMIN_USER_ID : dbGuild.leaderId;
                    // 기본 길드 객체 생성 (createDefaultGuild를 참고한 구조)
                    const now = Date.now();
                    const basicGuild: Guild = {
                        id: dbGuild.id,
                        name: dbGuild.name,
                        leaderId: canonicalLeaderId,
                        description: dbGuild.description || undefined,
                        icon: dbGuild.emblem || '/images/guild/profile/icon1.png',
                        level: dbGuild.level,
                        gold: Number(dbGuild.gold),
                        experience: Number(dbGuild.experience),
                        xp: Number(dbGuild.experience),
                        researchPoints: 0,
                        members: membersWithNicknames,
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
                }
                
                // DB에서 최신 멤버 목록 가져와서 동기화
                const dbMembers = await guildRepo.getGuildMembers(user.guildId);
                console.log(`[GET_GUILD_INFO] DB members count: ${dbMembers.length}, KV members count: ${guild.members.length}`);
                
                const dbMemberUserIds = new Set(dbMembers.map(m => m.userId));
                for (const m of dbMembers) {
                    const u = await db.getUser(m.userId);
                    if (u?.isAdmin) dbMemberUserIds.add(ADMIN_USER_ID);
                }
                // 현재 요청 사용자는 길드에 가입되어 있음(user.guildId 있음) - 동기화 이슈 시에도 필터에서 제외되지 않도록 보장 (관리자 포함)
                dbMemberUserIds.add(effectiveUserId);
                if (user.isAdmin) dbMemberUserIds.add(user.id);
                const kvMemberUserIds = new Set((guild.members || []).map(m => m.userId));
                
                // 기존 KV 멤버 중 관리자면 userId를 캐노니컬 ID로 정규화
                for (const member of guild.members || []) {
                    const memberUser = await db.getUser(member.userId);
                    if (memberUser?.isAdmin) member.userId = ADMIN_USER_ID;
                }
                if (guild.leaderId) {
                    const leaderUser = await db.getUser(guild.leaderId);
                    if (leaderUser?.isAdmin) guild.leaderId = ADMIN_USER_ID;
                }
                
                // DB에는 있지만 KV store에는 없는 멤버 추가
                let addedCount = 0;
                    for (const dbMember of dbMembers) {
                        const memberUser = await db.getUser(dbMember.userId);
                        const canonicalUserId = memberUser?.isAdmin ? ADMIN_USER_ID : dbMember.userId;
                        if (!kvMemberUserIds.has(dbMember.userId) && !kvMemberUserIds.has(canonicalUserId)) {
                            guild.members.push({
                                id: dbMember.id,
                                guildId: dbMember.guildId,
                                userId: canonicalUserId,
                                nickname: memberUser?.nickname || '',
                                role: dbMember.role as 'leader' | 'officer' | 'member',
                                joinDate: dbMember.joinDate,
                                contributionTotal: dbMember.contributionTotal,
                                weeklyContribution: 0,
                                lastLoginAt: memberUser?.lastLoginAt,
                                createdAt: dbMember.createdAt,
                                updatedAt: dbMember.updatedAt,
                            });
                        addedCount++;
                        console.log(`[GET_GUILD_INFO] Added member ${dbMember.userId} (${memberUser?.nickname || 'unknown'})`);
                    }
                }
                
                // KV store에는 있지만 DB에는 없는 멤버 제거
                const beforeFilterCount = guild.members.length;
                guild.members = guild.members.filter(m => dbMemberUserIds.has(m.userId));
                const removedCount = beforeFilterCount - guild.members.length;
                if (removedCount > 0) {
                    console.log(`[GET_GUILD_INFO] Removed ${removedCount} members that don't exist in DB`);
                }
                
                console.log(`[GET_GUILD_INFO] Final members count: ${guild.members.length} (added: ${addedCount}, removed: ${removedCount})`);
                
                // 현재 요청 사용자가 멤버 목록에 없으면 추가 (user.guildId가 있으므로 길드원임이 확실)
                const hasCurrentUser = guild.members.some(m => m.userId === effectiveUserId);
                if (!hasCurrentUser) {
                    const memberUser = await db.getUser(user.id);
                    let role: 'leader' | 'officer' | 'member' = 'member';
                    let contributionTotal = 0;
                    let joinDate = Date.now();
                    const dbMemberForUser = dbMembers.find(m => m.userId === user.id || (memberUser?.isAdmin && m.userId === user.id));
                    if (dbMemberForUser) {
                        role = dbMemberForUser.role as 'leader' | 'officer' | 'member';
                        contributionTotal = Number(dbMemberForUser.contributionTotal);
                        joinDate = dbMemberForUser.joinDate;
                    } else if (guild.leaderId === effectiveUserId) {
                        role = 'leader';
                    }
                    guild.members.push({
                        id: `${guild.id}-member-${effectiveUserId}`,
                        guildId: guild.id,
                        userId: effectiveUserId,
                        nickname: memberUser?.nickname || memberUser?.username || '알 수 없음',
                        role,
                        joinDate,
                        contributionTotal,
                        weeklyContribution: 0,
                        lastLoginAt: memberUser?.lastLoginAt,
                        createdAt: joinDate,
                        updatedAt: Date.now(),
                    });
                    console.log(`[GET_GUILD_INFO] Added current user ${effectiveUserId} to members (was missing)`);
                }
                
                // 모든 멤버의 nickname, 기여도, 최근 접속 시각 업데이트
                for (const member of guild.members) {
                    let dbMember = dbMembers.find(m => m.userId === member.userId);
                    if (!dbMember && member.userId === ADMIN_USER_ID) {
                        for (const m of dbMembers) {
                            const u = await db.getUser(m.userId);
                            if (u?.isAdmin) { dbMember = m; break; }
                        }
                    }
                    if (dbMember) {
                        member.contributionTotal = dbMember.contributionTotal;
                        member.joinDate = dbMember.joinDate;
                        member.updatedAt = dbMember.updatedAt;
                        const memberUser = await db.getUser(dbMember.userId);
                        if (memberUser) {
                            if (!member.nickname || member.nickname.trim() === '') member.nickname = memberUser.nickname || '';
                            member.lastLoginAt = memberUser.lastLoginAt;
                        }
                    }
                }
                
                const latestGuildsForSave = (await db.getKV<Record<string, Guild>>('guilds')) || {};
                mergeLatestGuildKvExceptMembers(guild, latestGuildsForSave);

                // 업데이트된 길드 정보를 KV store에 저장
                await db.setKV('guilds', guilds);
                
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
            const { content } = (payload ?? {}) as { content?: string };
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
            const message: GuildMessage = {
                id: `msg-guild-${randomUUID()}`,
                guildId: guild.id,
                authorId: user.id,
                content: trimmedContent,
                user: { id: user.id, nickname: user.nickname },
                system: false,
                timestamp: now,
                createdAt: now,
                text: trimmedContent,
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
            const { messageId, timestamp } = (payload ?? {}) as { messageId?: string; timestamp?: number };
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
            
            const myMemberInfo = guild.members.find((m: GuildMember) => m.userId === effectiveUserId);
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
            const { bossId, result } = (payload ?? {}) as { bossId?: string; result?: GuildBossBattleResult };
            if (!result) return { error: '전투 결과가 없습니다.' };
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };
            
            // 최신 사용자 데이터를 다시 로드 (인벤토리/장비 포함하여 보상 추가 시 기존 아이템이 덮어쓰이지 않도록)
            const freshUser = await db.getUser(user.id, { includeEquipment: true, includeInventory: true });
            if (!freshUser) return { error: '사용자를 찾을 수 없습니다.' };
            
            // 일일 2회 제한 (KST 기준, 날짜가 바뀌면 2/2로 회복, 미사용 시 누적 없음)
            if (!freshUser.isAdmin) {
                const todayKST = getTodayKSTDateString();
                const lastDay = freshUser.guildBossLastAttemptDayKST;
                const usedToday = lastDay === todayKST ? (freshUser.guildBossAttemptsUsedToday ?? 0) : 0;
                if (usedToday >= 2) {
                    return { error: '오늘의 참여 횟수를 모두 사용했습니다. 내일 0시(KST)에 2회로 초기화됩니다.' };
                }
            }
            
            if (!guild.guildBossState) {
                const initBossId = bossId || GUILD_BOSSES[0]?.id || 'boss_1';
                const initTemplate = GUILD_BOSSES.find((b) => b.id === initBossId) || GUILD_BOSSES[0];
                const initMax = getScaledGuildBossMaxHp(initTemplate.maxHp, 1);
                guild.guildBossState = {
                    bossId: initBossId,
                    currentBossId: initBossId,
                    currentBossHp: initMax,
                    currentBossStage: 1,
                    bossStageByBossId: {},
                    hp: initMax,
                    maxHp: initMax,
                    totalDamageLog: {},
                    lastResetAt: Date.now(),
                };
            }

            const gbState = guild.guildBossState;
            const curBossId = gbState.currentBossId || gbState.bossId;
            if (!curBossId) {
                return { error: '길드 보스 상태가 올바르지 않습니다.' };
            }
            if (bossId && bossId !== curBossId) {
                return { error: '현재 출전 중인 보스와 일치하지 않습니다.' };
            }

            if (!gbState.bossStageByBossId) gbState.bossStageByBossId = {};

            const bossTemplateForBattle = GUILD_BOSSES.find((b) => b.id === curBossId);
            if (!bossTemplateForBattle) {
                return { error: '길드 보스 데이터를 찾을 수 없습니다.' };
            }

            const bossDifficultyStage = getCurrentGuildBossStage(gbState, curBossId);
            const scaledBossMaxHp = getScaledGuildBossMaxHp(bossTemplateForBattle.maxHp, bossDifficultyStage);
            gbState.currentBossStage = bossDifficultyStage;
            gbState.maxHp = scaledBossMaxHp;
            gbState.bossId = curBossId;

            const preBattleHpRaw = gbState.currentBossHp;
            const preBattleHp = typeof preBattleHpRaw === 'number' ? preBattleHpRaw : scaledBossMaxHp;

            const gearBoss = aggregateSpecialOptionGearFromUser(freshUser);
            const reportedDamage = Math.max(0, Math.floor(result.damageDealt || 0));
            const cappedDamage = preBattleHp <= 0 ? 0 : Math.min(reportedDamage, preBattleHp);
            result.damageDealt = cappedDamage;

            result.rewards = calculateGuildBossBattleRewards(cappedDamage, bossDifficultyStage, {
                rewardTierShift: gearBoss.guildBossRewardTierShift,
                duplicateRewardCount: gearBoss.guildBossDuplicateRewardCount,
            });

            const nextBossHp = preBattleHp <= 0 ? 0 : Math.max(0, preBattleHp - cappedDamage);
            gbState.currentBossHp = nextBossHp;
            gbState.hp = nextBossHp;

            result.bossHpAfter = nextBossHp;
            result.bossMaxHp = scaledBossMaxHp;
            result.bossHpBefore = preBattleHp <= 0 ? scaledBossMaxHp : preBattleHp;
            if (!gbState.totalDamageLog) gbState.totalDamageLog = {};
            gbState.totalDamageLog[effectiveUserId] = (gbState.totalDamageLog[effectiveUserId] || 0) + cappedDamage;
            // 역대 최고 기록 (이번 주 누적 데미지 중 최대값 유지)
            if (!gbState.maxDamageLog) gbState.maxDamageLog = {};
            const currentTotal = gbState.totalDamageLog[effectiveUserId] || 0;
            const prevMax = gbState.maxDamageLog[effectiveUserId] || 0;
            gbState.maxDamageLog[effectiveUserId] = Math.max(prevMax, currentTotal);

            if (!freshUser.isAdmin) {
                freshUser.guildBossAttempts = (freshUser.guildBossAttempts || 0) + 1;
                const todayKST = getTodayKSTDateString();
                if (freshUser.guildBossLastAttemptDayKST !== todayKST) {
                    freshUser.guildBossAttemptsUsedToday = 0;
                    freshUser.guildBossLastAttemptDayKST = todayKST;
                }
                freshUser.guildBossAttemptsUsedToday = (freshUser.guildBossAttemptsUsedToday ?? 0) + 1;
            }

            await guildService.updateGuildMissionProgress(user.guildId!, 'bossAttempts', 1, guilds);

            // 딜량 등급별 기여도 계산 (1~5등급)
            let bossContribution = 5;
            const damage = cappedDamage;
            const tiers = GUILD_BOSS_DAMAGE_TIERS;
            if (damage >= (tiers[5]?.min ?? 200000)) bossContribution = GUILD_BOSS_CONTRIBUTION_BY_TIER[5];
            else if (damage >= (tiers[4]?.min ?? 100000)) bossContribution = GUILD_BOSS_CONTRIBUTION_BY_TIER[4];
            else if (damage >= (tiers[3]?.min ?? 50000)) bossContribution = GUILD_BOSS_CONTRIBUTION_BY_TIER[3];
            else if (damage >= (tiers[2]?.min ?? 20000)) bossContribution = GUILD_BOSS_CONTRIBUTION_BY_TIER[2];
            else bossContribution = GUILD_BOSS_CONTRIBUTION_BY_TIER[1];

            guildService.addContribution(guild, effectiveUserId, bossContribution);
            guildRepo.incrementGuildMemberContribution(user.guildId!, user.id, bossContribution).catch(err => {
                console.error('[GUILD_BOSS_SUBMIT_BATTLE] Failed to sync contribution to Prisma:', err);
            });
            
            // 보상 지급
            const rewards = result.rewards;

            // 딜량 기반 개인 추가 길드 코인 (GUILD_BOSS_PERSONAL_REWARDS_TIERS)
            let personalGuildCoins = 0;
            for (let i = GUILD_BOSS_PERSONAL_REWARDS_TIERS.length - 1; i >= 0; i--) {
                if (result.damageDealt >= GUILD_BOSS_PERSONAL_REWARDS_TIERS[i].damage) {
                    personalGuildCoins = GUILD_BOSS_PERSONAL_REWARDS_TIERS[i].reward.guildCoins;
                    break;
                }
            }
            const totalGuildCoins = rewards.guildCoins + personalGuildCoins;
            if (personalGuildCoins > 0) {
                (result.rewards as any).guildCoins = totalGuildCoins;
            }
            
            // 길드 코인
            freshUser.guildCoins = (freshUser.guildCoins || 0) + totalGuildCoins;
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
            
            // 강화재료 추가 (getItemTemplateByName으로 이름 변형 대응, addItemsToInventory 분류를 위해 type 명시)
            const materialTemplate = getItemTemplateByName(rewards.materials.name);
            if (materialTemplate && rewards.materials.quantity > 0) {
                const materialItem: InventoryItem = {
                    ...materialTemplate,
                    id: `item-${randomUUID()}`,
                    createdAt: Date.now(),
                    isEquipped: false,
                    quantity: rewards.materials.quantity,
                    level: 1,
                    stars: 0,
                } as InventoryItem;
                (materialItem as any).type = 'material';
                itemsToAdd.push(materialItem);
            } else if (rewards.materials.quantity > 0) {
                console.warn(`[START_GUILD_BOSS_BATTLE] Material template not found for: "${rewards.materials.name}"`);
            }
            
            // 추가 강화재료 (SSS 신비의 강화석 등)
            if (rewards.materialsBonus && rewards.materialsBonus.quantity > 0) {
                const bonusTemplate = getItemTemplateByName(rewards.materialsBonus.name);
                if (bonusTemplate) {
                    const bonusItem: InventoryItem = {
                        ...bonusTemplate,
                        id: `item-${randomUUID()}`,
                        createdAt: Date.now(),
                        isEquipped: false,
                        quantity: rewards.materialsBonus.quantity,
                        level: 1,
                        stars: 0,
                    } as InventoryItem;
                    (bonusItem as any).type = 'material';
                    itemsToAdd.push(bonusItem);
                }
            }
            
            // 재료 상자 (SSS 등)
            if (rewards.materialBox && rewards.materialBox.quantity > 0) {
                const boxTemplate = getItemTemplateByName(rewards.materialBox.name);
                if (boxTemplate) {
                    const boxItem: InventoryItem = {
                        ...boxTemplate,
                        id: `item-${randomUUID()}`,
                        createdAt: Date.now(),
                        isEquipped: false,
                        quantity: rewards.materialBox.quantity,
                        level: 1,
                        stars: 0,
                    } as InventoryItem;
                    (boxItem as any).type = 'consumable';
                    itemsToAdd.push(boxItem);
                }
            }
            
            // 변경권 추가 (소모품, addItemsToInventory 분류를 위해 type 명시)
            for (const ticket of rewards.tickets) {
                const ticketTemplate = getItemTemplateByName(ticket.name);
                if (ticketTemplate && ticket.quantity > 0) {
                    const ticketItem: InventoryItem = {
                        ...ticketTemplate,
                        id: `item-${randomUUID()}`,
                        createdAt: Date.now(),
                        isEquipped: false,
                        quantity: ticket.quantity,
                        level: 1,
                        stars: 0,
                    } as InventoryItem;
                    (ticketItem as any).type = 'consumable';
                    itemsToAdd.push(ticketItem);
                } else if (ticket.quantity > 0) {
                    console.warn(`[START_GUILD_BOSS_BATTLE] Ticket template not found for: "${ticket.name}"`);
                }
            }
            
            // 장비 추가 (addItemsToInventory가 type === 'equipment'로 분류하므로 명시적으로 설정)
            let generatedEquipment: InventoryItem | null = null;
            if (rewards.equipment && rewards.equipment.grade) {
                const allSlots: EquipmentSlot[] = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];
                const randomSlot = allSlots[Math.floor(Math.random() * allSlots.length)];
                generatedEquipment = generateNewItem(rewards.equipment.grade, randomSlot);
                if (generatedEquipment) {
                    (generatedEquipment as any).type = 'equipment';
                    itemsToAdd.push(generatedEquipment);
                    console.log(`[START_GUILD_BOSS_BATTLE] Generated equipment: ${generatedEquipment.name} (${generatedEquipment.grade}, ${generatedEquipment.slot}) for user ${freshUser.id}`);
                } else {
                    console.error(`[START_GUILD_BOSS_BATTLE] Failed to generate equipment for user ${freshUser.id}`);
                }
            } else {
                console.warn(`[START_GUILD_BOSS_BATTLE] No equipment in rewards for user ${freshUser.id}. Rewards:`, JSON.stringify(rewards));
            }

            const vipBossGrant = isRewardVipActive(freshUser) ? rollAndResolveRewardVipPlayGrant() : null;
            if (vipBossGrant?.goldBonus) {
                freshUser.gold = (freshUser.gold || 0) + vipBossGrant.goldBonus;
            }
            if (vipBossGrant?.inventoryItem) {
                itemsToAdd.push(vipBossGrant.inventoryItem);
            }
            (result as GuildBossBattleResult).vipPlayRewardSlot = {
                locked: !isRewardVipActive(freshUser),
                ...(vipBossGrant?.grantedDisplay && isRewardVipActive(freshUser)
                    ? {
                          grantedItem: vipBossGrant.grantedDisplay,
                      }
                    : {}),
            };

            // 인벤토리에 아이템 추가
            if (itemsToAdd.length > 0) {
                const { success, updatedInventory } = addItemsToInventory(freshUser.inventory || [], freshUser.inventorySlots || { equipment: 30, consumable: 30, material: 30 }, itemsToAdd);
                if (success && updatedInventory) {
                    freshUser.inventory = updatedInventory;
                    await guildService.recordGuildEpicPlusEquipmentAcquisition(freshUser, itemsToAdd, guilds);
                    console.log(`[START_GUILD_BOSS_BATTLE] Successfully added ${itemsToAdd.length} items to inventory for user ${freshUser.id}. Equipment included: ${generatedEquipment ? 'Yes' : 'No'}`);
                } else {
                    console.error(`[START_GUILD_BOSS_BATTLE] Failed to add items to inventory for user ${freshUser.id}. Inventory may be full. Items attempted: ${itemsToAdd.length}`);
                    // 인벤토리가 가득 찬 경우에도 다른 보상은 지급됨 (골드, 길드 코인 등)
                }
            } else {
                console.warn(`[START_GUILD_BOSS_BATTLE] No items to add to inventory for user ${freshUser.id}`);
            }
            
            // 실제 생성된 장비 정보를 result에 추가 (보상 모달에서 표시하기 위해)
            // 전체 장비 객체를 전달하여 모달에서 실제 장비 정보를 표시할 수 있도록 함
            if (generatedEquipment) {
                if (!result.rewards.equipment) {
                    result.rewards.equipment = {} as any;
                }
                // 기존 필드 유지 (하위 호환성)
                (result.rewards.equipment as any).name = generatedEquipment.name;
                (result.rewards.equipment as any).image = generatedEquipment.image;
                (result.rewards.equipment as any).slot = generatedEquipment.slot;
                (result.rewards.equipment as any).grade = generatedEquipment.grade;
                // 전체 장비 객체 추가 (모달에서 실제 장비 정보 표시용)
                (result.rewards.equipment as any).item = generatedEquipment;
                console.log(`[START_GUILD_BOSS_BATTLE] Updated result.rewards.equipment with full item object: name=${generatedEquipment.name}, image=${generatedEquipment.image}, slot=${generatedEquipment.slot}, grade=${generatedEquipment.grade}`);
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
            
            // 인벤토리 등 사용자 보상 반영을 DB에 저장 (완료 후 응답하여 클라이언트와 DB 일치 보장)
            try {
                await db.updateUser(freshUser);
            } catch (err) {
                console.error(`[START_GUILD_BOSS_BATTLE] Failed to save user ${freshUser.id}:`, err);
                return { error: '보상 저장에 실패했습니다. 인벤토리를 확인해 주세요.' };
            }

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 필수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(freshUser, ['guildCoins', 'guildBossAttempts', 'guildBossLastAttemptDayKST', 'guildBossAttemptsUsedToday', 'gold', 'researchPoints', 'inventory', 'inventorySlots']);
            
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            
            // result 객체에 장비 정보 업데이트 (직접 수정)
            if (generatedEquipment && result.rewards.equipment) {
                (result.rewards.equipment as any).name = generatedEquipment.name;
                (result.rewards.equipment as any).image = generatedEquipment.image;
                (result.rewards.equipment as any).slot = generatedEquipment.slot;
                (result.rewards.equipment as any).grade = generatedEquipment.grade;
                // 전체 장비 객체 추가
                (result.rewards.equipment as any).item = generatedEquipment;
            }
            
            return { clientResponse: { updatedUser: freshUser, guildBossBattleResult: result, guilds } };
        }

        
        case 'CLAIM_GUILD_WAR_REWARD': {
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            try {
                const { processGuildWarEnd } = await import('../scheduledTasks.js');
                await processGuildWarEnd();
            } catch (e: any) {
                console.warn('[CLAIM_GUILD_WAR_REWARD] processGuildWarEnd (non-fatal):', e?.message);
            }
            
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };
            
            const activeWars = await db.getKV<any[]>('activeGuildWars') || [];
            const claimedRewards = await db.getKV<Record<string, string[]>>('guildWarClaimedRewards') || {};
            const now = Date.now();

            const myCompletedWars = activeWars
                .filter(
                    (w) =>
                        w.status === 'completed' &&
                        (w.guild1Id === user.guildId || w.guild2Id === user.guildId) &&
                        w.result?.winnerId
                )
                .sort((a: any, b: any) => (b.endTime ?? 0) - (a.endTime ?? 0));

            let myWar: any = null;
            let blockedByCooldown = false;
            for (const w of myCompletedWars) {
                if (claimedRewards[w.id]?.includes(effectiveUserId)) continue;
                const rewardAvailableAt =
                    (w as any).rewardAvailableAt ?? (w.endTime ?? 0) + 60 * 60 * 1000;
                if (now < rewardAvailableAt) {
                    blockedByCooldown = true;
                    continue;
                }
                myWar = w;
                break;
            }

            if (!myWar) {
                if (myCompletedWars.length === 0) {
                    return { error: '받을 수 있는 보상이 없습니다.' };
                }
                if (blockedByCooldown) {
                    return { error: '전쟁 종료 1시간 후(목요일·월요일 0시)부터 보상을 수령할 수 있습니다.' };
                }
                return { error: '이미 보상을 받았습니다.' };
            }
            
            const isWinner = myWar.result?.winnerId === user.guildId;
            const isFriSunWar = (myWar as any).warType === 'fri_sun'; // 금~일 전쟁은 보상 상향

            const rewards = isFriSunWar
                ? {
                    guildCoins: isWinner ? getRandomInt(150, 280) : getRandomInt(20, 70),
                    guildXp: isWinner ? 15000 : 3500,
                    researchPoints: isWinner ? getRandomInt(1500, 4000) : getRandomInt(200, 1200),
                    gold: isWinner ? getRandomInt(4500, 7000) : getRandomInt(800, 1500),
                    diamonds: isWinner ? getRandomInt(30, 70) : getRandomInt(8, 18),
                  }
                : {
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
            
            // 공동보상(길드경험치, 연구포인트) 저장 - 마지막 상대 기록 표시용
            if (!(myWar as any).sharedRewards) {
                (myWar as any).sharedRewards = { guildXp: rewards.guildXp, researchPoints: rewards.researchPoints };
                await db.setKV('activeGuildWars', activeWars);
            }
            // 받기 기록 저장
            if (!claimedRewards[myWar.id]) {
                claimedRewards[myWar.id] = [];
            }
            claimedRewards[myWar.id].push(effectiveUserId);
            await db.setKV('guildWarClaimedRewards', claimedRewards);
            await db.setKV('guilds', guilds);
            
            await db.updateUser(freshUser);
            
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(freshUser, ['gold', 'guildCoins', 'diamonds']);
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
            await broadcast({ type: 'GUILD_WAR_UPDATE', payload: { activeWars } });
            
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
