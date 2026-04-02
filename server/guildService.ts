

// server/guildService.ts
import { Guild, GuildMemberRole, GuildMission, ChatMessage, Mail, GuildResearchId } from '../types/index.js';
import * as db from './db.js';
import { GUILD_MISSIONS_POOL, GUILD_XP_PER_LEVEL, GUILD_BOSSES } from '../constants/index.js';
import {
    clampGuildBossStage,
    getScaledGuildBossMaxHp,
    GUILD_BOSS_MAX_DIFFICULTY_STAGE,
    type GuildBossSwapMailTier,
    getGuildBossSwapMailMemberRewards,
} from '../utils/guildBossStageUtils.js';
import { randomUUID } from 'crypto';
import { calculateGuildMissionXp } from '../utils/guildUtils.js';

export const checkGuildLevelUp = (guild: Guild): boolean => {
    let leveledUp = false;
    const guildXp = guild.xp ?? 0;
    let xpForNextLevel = GUILD_XP_PER_LEVEL(guild.level);
    while (guildXp >= xpForNextLevel) {
        guild.xp = (guild.xp ?? 0) - xpForNextLevel;
        guild.level++;
        leveledUp = true;
        xpForNextLevel = GUILD_XP_PER_LEVEL(guild.level);
    }
    return leveledUp;
};

export const addContribution = (guild: Guild, userId: string, amount: number) => {
    const member = guild.members?.find(m => m.userId === userId);
    if (member) {
        member.contributionTotal = (member.contributionTotal || 0) + amount;
        member.weeklyContribution = (member.weeklyContribution || 0) + amount;
    }
};

// FIX: Added optional guildsToUpdate parameter to prevent race conditions and allow passing the guilds object from the caller.
export const updateGuildMissionProgress = async (guildId: string, missionType: string, amount: number | string, guildsToUpdate?: Record<string, Guild>) => {
    // FIX: Add parentheses to clarify operator precedence between '??' and '||'.
    const guilds = (guildsToUpdate ?? (await db.getKV<Record<string, Guild>>('guilds'))) || {};
    const guild = guilds[guildId];
    if (!guild || !guild.weeklyMissions) return;

    let missionUpdated = false;
    const missionProgress = (guild as any).missionProgress || {};

    if (typeof missionProgress[missionType] === 'number') {
        missionProgress[missionType] = (missionProgress[missionType] as number) + (amount as number);
        (guild as any).missionProgress = missionProgress;
        missionUpdated = true;
    } else if (Array.isArray(missionProgress[missionType])) {
        // FIX: Cast to any[] to handle different types for 'amount' (string for userId, number for others)
        if (!(missionProgress[missionType] as any[]).includes(amount)) {
            (missionProgress[missionType] as any[]).push(amount);
            (guild as any).missionProgress = missionProgress;
            missionUpdated = true;
        }
    }

    for (const mission of guild.weeklyMissions) {
        if (mission.progressKey === missionType) {
            if (Array.isArray(missionProgress[missionType])) {
                // FIX: Cast to string[] to resolve type error
                (mission as any).progress = (missionProgress[missionType] as string[]).length;
            } else {
                // FIX: Cast to number to resolve type error
                (mission as any).progress = missionProgress[missionType] as number;
            }
            
            // Check for completion here!
            const missionProgressValue = (mission as any).progress || 0;
            const missionTarget = mission.target ?? 0;
            if (!(mission as any).isCompleted && missionProgressValue >= missionTarget) {
                (mission as any).isCompleted = true;
                missionUpdated = true;
                
                // 미션 완료 시 길드 XP 자동 추가 (보상 받기 전에도)
                const guildRewardXp = mission.guildReward?.guildXp ?? 0;
                const finalXp = calculateGuildMissionXp(guildRewardXp, guild.level);
                guild.xp = (guild.xp ?? 0) + finalXp;
                checkGuildLevelUp(guild);
                
                // Add a system message to guild chat to notify users to claim their reward
                if (!guild.chatHistory) guild.chatHistory = [];
                const message: ChatMessage = {
                    id: `msg-guild-${randomUUID()}`,
                    user: { id: 'system', nickname: '시스템' },
                    system: true,
                    text: `주간 임무 [${mission.title}]을(를) 달성했습니다! 길드 활동 > 길드 미션 탭에서 보상을 수령하세요.`,
                    timestamp: Date.now(),
                };
                guild.chatHistory.push(message as any);
                if (guild.chatHistory.length > 100) {
                    guild.chatHistory.shift();
                }
            }
        }
    }
    
    if (missionUpdated && !guildsToUpdate) {
        await db.setKV('guilds', guilds);
    }
};

export const resetWeeklyGuildMissions = async (guild: Guild, now: number) => {
    guild.weeklyMissions = GUILD_MISSIONS_POOL.map(m => ({
        ...m,
        id: `quest-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        progress: 0,
        isCompleted: false,
        claimedBy: [],
    })) as any;
    (guild as any).missionProgress = {
        checkIns: 0,
        strategicWins: 0,
        playfulWins: 0,
        diamondsSpent: 0,
        equipmentEnhancements: 0,
        materialCrafts: 0,
        equipmentSyntheses: 0,
        championshipClaims: 0,
        towerFloor50Conquerors: [],
        towerFloor100Conquerors: [],
        bossAttempts: 0,
        epicGearAcquisitions: 0,
    };
    guild.lastMissionReset = now;

    // 길드원 주간 기여도 0으로 초기화 (월요일 0시 KST 리셋)
    if (guild.members?.length) {
        for (const member of guild.members) {
            member.weeklyContribution = 0;
        }
        (guild as any).lastWeeklyContributionReset = now;
    }
    
    // 길드 보스 주간 리셋: 새로운 보스 선택 및 HP 초기화 (전주 격파 시 해당 보스 id 단계 상승, 최대 10)
    if (guild.guildBossState) {
        const currentBossId = guild.guildBossState.currentBossId ?? guild.guildBossState.bossId;
        const prevHp = guild.guildBossState.currentBossHp ?? guild.guildBossState.hp;
        const prevMaxHp = guild.guildBossState.maxHp ?? guild.guildBossState.hp ?? 0;
        const prevStage = guild.guildBossState.currentBossStage ?? 1;
        const prevHpNum = typeof prevHp === 'number' ? prevHp : 0;
        const wasDefeatedWithinWeek = prevHpNum <= 0;

        // 월요일 0시: 이전 주 보스 잔여 체력 비율로 "보스 교체 정산 우편" 발송
        // - <= 50% : half 보상
        // - <= 25% : quarter 보상
        // - 0 : defeated 보상
        const prevRatio = prevMaxHp > 0 ? Math.max(0, Math.min(1, prevHpNum / prevMaxHp)) : 0;
        let tier: GuildBossSwapMailTier = 'none';
        if (wasDefeatedWithinWeek) tier = 'defeated';
        else if (prevRatio <= 0.25) tier = 'quarter';
        else if (prevRatio <= 0.5) tier = 'half';

        if (tier !== 'none') {
            const prevBossTemplate = GUILD_BOSSES.find((b) => b.id === currentBossId) || GUILD_BOSSES[0];
            const damageLog = guild.guildBossState.totalDamageLog || {};
            const maxDamage = Math.max(0, ...Object.values(damageLog).map((v) => (typeof v === 'number' ? v : 0)));

            const members = guild.members ?? [];
            for (const m of members) {
                const memberUserId = m.userId;
                const memberDamage = (damageLog as Record<string, number>)[memberUserId] ?? 0;
                const memberRewards = getGuildBossSwapMailMemberRewards({
                    stage: prevStage,
                    tier: tier as Exclude<GuildBossSwapMailTier, 'none'>,
                    memberDamage,
                    maxDamage,
                });

                const user = await db.getUser(memberUserId, { includeEquipment: false, includeInventory: false });
                if (!user) continue;

                const mailTitle = `[길드 보스 정산] ${prevBossTemplate.name} · 잔여 ${Math.round(prevRatio * 100)}%`;
                const mailMessage = `월요일 0시 기준 보스 잔여 체력으로 정산 보상이 지급됩니다.\n\n- 보상: 연구소 포인트 +${memberRewards.researchPoints} / 길드코인 +${memberRewards.guildCoins}\n- 추가 보상은 본인의 총 데미지 기여도에 따라 반영됩니다.\n\n5일 이내에 수령해주세요.`;

                const mail: Mail = {
                    id: `mail-guild-boss-swap-${guild.id}-${currentBossId}-${tier}-${randomUUID()}`,
                    from: 'System',
                    title: mailTitle,
                    message: mailMessage,
                    attachments: {
                        researchPoints: memberRewards.researchPoints,
                        guildCoins: memberRewards.guildCoins,
                    },
                    receivedAt: now,
                    expiresAt: now + 5 * 24 * 60 * 60 * 1000, // 5 days
                    isRead: false,
                    attachmentsClaimed: false,
                };

                if (!user.mail) user.mail = [];
                user.mail.unshift(mail);
                await db.updateUser(user);
            }
        }

        const stages = { ...(guild.guildBossState.bossStageByBossId || {}) };
        if (wasDefeatedWithinWeek && currentBossId) {
            const prevStage = stages[currentBossId] ?? 1;
            stages[currentBossId] = Math.min(GUILD_BOSS_MAX_DIFFICULTY_STAGE, prevStage + 1);
        }

        const currentBossIndex = GUILD_BOSSES.findIndex(b => b.id === currentBossId);
        const nextBossIndex = currentBossIndex >= 0 && currentBossIndex < GUILD_BOSSES.length - 1 ? currentBossIndex + 1 : 0;
        const nextBoss = GUILD_BOSSES[nextBossIndex];
        const stageForNext = clampGuildBossStage(stages[nextBoss.id] ?? 1);
        const scaledMaxHp = getScaledGuildBossMaxHp(nextBoss.maxHp, stageForNext);

        const prevMaxDamageLog = guild.guildBossState.maxDamageLog || {};
        guild.guildBossState = {
            bossId: nextBoss.id,
            hp: scaledMaxHp,
            maxHp: scaledMaxHp,
            currentBossId: nextBoss.id,
            currentBossHp: scaledMaxHp,
            currentBossStage: stageForNext,
            bossStageByBossId: stages,
            totalDamageLog: {},
            maxDamageLog: prevMaxDamageLog,
            lastResetAt: now,
        };
        console.log(`[GuildBossReset] Guild ${guild.name}: Boss reset to ${nextBoss.name} (${nextBoss.id}) stage ${stageForNext} HP ${scaledMaxHp}`);
    } else {
        const firstBoss = GUILD_BOSSES[0];
        const scaledMaxHp = getScaledGuildBossMaxHp(firstBoss.maxHp, 1);
        guild.guildBossState = {
            bossId: firstBoss.id,
            hp: scaledMaxHp,
            maxHp: scaledMaxHp,
            currentBossId: firstBoss.id,
            currentBossHp: scaledMaxHp,
            currentBossStage: 1,
            bossStageByBossId: {},
            totalDamageLog: {},
            lastResetAt: now,
        };
        console.log(`[GuildBossReset] Guild ${guild.name}: Boss initialized to ${firstBoss.name} (${firstBoss.id})`);
    }
};

export const checkCompletedResearch = async (guild: Guild): Promise<GuildResearchId | null> => {
    if (guild.researchTask && guild.researchTask.completionTime && Date.now() >= guild.researchTask.completionTime) {
        const completedTaskId = guild.researchTask.researchId;
        if (!guild.research) {
            guild.research = {} as any;
        }
        if (!guild.research![completedTaskId]) {
            guild.research![completedTaskId] = { level: 0 };
        }
        guild.research![completedTaskId]!.level += 1;
        guild.researchTask = null;
        
        return completedTaskId as GuildResearchId;
    }
    return null;
};