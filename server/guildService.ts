

// server/guildService.ts
import { Guild, GuildMemberRole, GuildMission, ChatMessage, GuildResearchId, InventoryItem } from '../types/index.js';
import { ItemGrade } from '../types/enums.js';
import * as db from './db.js';
import { GUILD_MISSIONS_POOL, GUILD_XP_PER_LEVEL, GUILD_BOSSES } from '../constants/index.js';
import {
    clampGuildBossStage,
    getScaledGuildBossMaxHp,
    GUILD_BOSS_MAX_DIFFICULTY_STAGE,
    getWeeklyGuildBossSettlementGuildRewards,
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

/** 주간 미션 카운터 초기값 — 신규 길드·리셋·누락 복구에 동일 사용 */
export const getDefaultGuildMissionProgress = (): Record<string, number | string[]> => ({
    checkIns: 0,
    strategicWins: 0,
    playfulWins: 0,
    diamondsSpent: 0,
    equipmentEnhancements: 0,
    materialCrafts: 0,
    equipmentSyntheses: 0,
    guildDonations: 0,
    towerFloor50Conquerors: [],
    towerFloor100Conquerors: [],
    bossAttempts: 0,
    epicGearAcquisitions: 0,
});

const EPIC_PLUS_GRADES: ReadonlySet<ItemGrade> = new Set([
    ItemGrade.Epic,
    ItemGrade.Legendary,
    ItemGrade.Mythic,
    ItemGrade.Transcendent,
]);

export const countEpicPlusEquipmentInItems = (items: InventoryItem[]): number => {
    if (!items?.length) return 0;
    let n = 0;
    for (const i of items) {
        if (i.type === 'equipment' && i.grade && EPIC_PLUS_GRADES.has(i.grade as ItemGrade)) n += 1;
    }
    return n;
};

function ensureGuildMissionProgressShape(guild: Guild): void {
    const defaults = getDefaultGuildMissionProgress();
    const cur = (guild as any).missionProgress;
    const out: Record<string, any> = { ...defaults };
    if (cur && typeof cur === 'object') {
        for (const key of Object.keys(defaults)) {
            const def = defaults[key as keyof typeof defaults];
            const v = cur[key];
            if (Array.isArray(def)) {
                out[key] = Array.isArray(v) ? v : [...def];
            } else {
                out[key] = typeof v === 'number' && Number.isFinite(v) ? v : 0;
            }
        }
        for (const key of Object.keys(cur)) {
            if (!(key in out)) out[key] = cur[key];
        }
    }
    (guild as any).missionProgress = out;
}

// FIX: Added optional guildsToUpdate parameter to prevent race conditions and allow passing the guilds object from the caller.
export const updateGuildMissionProgress = async (guildId: string, missionType: string, amount: number | string, guildsToUpdate?: Record<string, Guild>) => {
    // FIX: Add parentheses to clarify operator precedence between '??' and '||'.
    const guilds = (guildsToUpdate ?? (await db.getKV<Record<string, Guild>>('guilds'))) || {};
    const guild = guilds[guildId];
    if (!guild || !guild.weeklyMissions) return;

    ensureGuildMissionProgressShape(guild);

    let missionUpdated = false;
    const missionProgress = (guild as any).missionProgress as Record<string, any>;

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

    if (missionUpdated) {
        await db.setKV('guilds', guilds);
    }
};

/** 에픽 이상 장비 획득 길드 미션 (인벤 추가분 기준). `guildsOptional`이 있으면 동일 KV 객체에 이어서 반영 */
export const recordGuildEpicPlusEquipmentAcquisition = async (
    user: { guildId?: string | null },
    acquiredItems: InventoryItem[],
    guildsOptional?: Record<string, Guild>,
): Promise<void> => {
    const add = countEpicPlusEquipmentInItems(acquiredItems);
    if (!user.guildId || add <= 0) return;
    const guilds = guildsOptional ?? ((await db.getKV<Record<string, Guild>>('guilds')) || {});
    await updateGuildMissionProgress(user.guildId, 'epicGearAcquisitions', add, guilds);
};

export const resetWeeklyGuildMissions = async (guild: Guild, now: number) => {
    guild.weeklyMissions = GUILD_MISSIONS_POOL.map(m => ({
        ...m,
        id: `quest-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        progress: 0,
        isCompleted: false,
        claimedBy: [],
    })) as any;
    (guild as any).missionProgress = { ...getDefaultGuildMissionProgress() };
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

        // 월요일 0시: 이전 주 보스 잔여 체력에 따라 길드 경험치·연구 포인트를 길드에 자동 적립 (우편 없음)
        const prevRatio = prevMaxHp > 0 ? Math.max(0, Math.min(1, prevHpNum / prevMaxHp)) : 0;
        const settlement = getWeeklyGuildBossSettlementGuildRewards({
            stage: prevStage,
            remainingHpRatio: prevRatio,
            wasDefeated: wasDefeatedWithinWeek,
        });
        if (settlement) {
            const prevBossTemplate = GUILD_BOSSES.find((b) => b.id === currentBossId) || GUILD_BOSSES[0];
            if (guild.xp === undefined) guild.xp = (guild as any).experience ?? 0;
            guild.xp = (guild.xp ?? 0) + settlement.guildXp;
            (guild as any).experience = guild.xp;
            if (!guild.researchPoints) guild.researchPoints = 0;
            guild.researchPoints += settlement.researchPoints;
            checkGuildLevelUp(guild);
            (guild as any).experience = guild.xp;

            if (!guild.chatHistory) guild.chatHistory = [];
            const statusLabel = wasDefeatedWithinWeek ? '격파' : `잔여 체력 ${Math.round(prevRatio * 100)}%`;
            const chatMessage: ChatMessage = {
                id: `msg-guild-${randomUUID()}`,
                user: { id: 'system', nickname: '시스템' },
                system: true,
                text: `주간 길드 보스 정산(${prevBossTemplate.name}, ${statusLabel}): 길드 경험치 +${settlement.guildXp.toLocaleString()}, 연구 포인트 +${settlement.researchPoints.toLocaleString()}이 길드에 적립되었습니다.`,
                timestamp: now,
            };
            guild.chatHistory.push(chatMessage as any);
            if (guild.chatHistory.length > 100) {
                guild.chatHistory.shift();
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