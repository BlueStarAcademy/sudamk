import * as db from '../db.js';
import { randomUUID } from 'crypto';
import { type ServerAction, type User, type VolatileState, type Guild, InventoryItem, Quest, QuestLog, InventoryItemType, TournamentType, TournamentState, QuestReward } from '../../types/index.js';
import { ItemGrade } from '../../types/enums.js';
import { updateQuestProgress } from '../questService.js';
import { SHOP_ITEMS } from '../shop.js';
import { 
    CONSUMABLE_ITEMS, 
    MATERIAL_ITEMS, 
    DAILY_MILESTONE_REWARDS, 
    DAILY_MILESTONE_THRESHOLDS,
    WEEKLY_MILESTONE_REWARDS,
    WEEKLY_MILESTONE_THRESHOLDS,
    MONTHLY_MILESTONE_REWARDS,
    MONTHLY_MILESTONE_THRESHOLDS,
    BASE_TOURNAMENT_REWARDS,
    TOURNAMENT_SCORE_REWARDS,
    TOURNAMENT_DEFINITIONS,
    getDungeonRankRewardWorld,
    ACHIEVEMENT_TRACK_MAP,
} from '../../constants/index.js';
import { calculateRanks } from '../tournamentService.js';
import { addItemsToInventory, createItemInstancesFromReward } from '../../utils/inventoryUtils.js';
import { createItemInstancesFromMailAttachments } from '../mailClaimEquipment.js';
import { getSelectiveUserUpdate } from '../utils/userUpdateHelper.js';
import { clampQuestProgressToTarget } from '../../utils/questProgressCap.js';
import { getAdventureUnderstandingTierFromXp } from '../../constants/adventureConstants.js';
import { getAdventureCodexCompletionBreakdown } from '../../utils/adventureCodexCompletion.js';
import { DEFAULT_REWARD_CONFIG, normalizeRewardConfig, type RewardConfig } from '../../shared/constants/rewardConfig.js';
import { isRewardVipActive } from '../../shared/utils/rewardVip.js';

const getRandomInt = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const TIER_SCORE_REQUIREMENTS: Record<string, number> = {
    루키: 1300,
    브론즈: 1400,
    실버: 1500,
    골드: 1700,
    플래티넘: 2000,
    다이아: 2400,
    마스터: 3000,
    챌린저: 3500,
};

const GRADE_ORDER: ItemGrade[] = [
    ItemGrade.Normal,
    ItemGrade.Uncommon,
    ItemGrade.Rare,
    ItemGrade.Epic,
    ItemGrade.Legendary,
    ItemGrade.Mythic,
    ItemGrade.Transcendent,
];

const GRADE_KEY_TO_ITEM_GRADE: Record<string, ItemGrade> = {
    normal: ItemGrade.Normal,
    uncommon: ItemGrade.Uncommon,
    rare: ItemGrade.Rare,
    epic: ItemGrade.Epic,
    legendary: ItemGrade.Legendary,
    mythic: ItemGrade.Mythic,
    transcendent: ItemGrade.Transcendent,
};

const ADVENTURE_UNDERSTANDING_TIER_INDEX_BY_LABEL: Record<string, number> = {
    편함: 1,
    익숙함: 2,
    친숙함: 3,
    정복: 4,
};

const isAllEquipmentAtLeastGrade = (user: User, gradeKey: string): boolean => {
    const requiredGrade = GRADE_KEY_TO_ITEM_GRADE[gradeKey];
    if (!requiredGrade) return false;
    const requiredIndex = GRADE_ORDER.indexOf(requiredGrade);
    const slots: Array<keyof NonNullable<User['equipment']>> = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];
    for (const slot of slots) {
        const equippedId = user.equipment?.[slot];
        if (!equippedId) return false;
        const item = user.inventory.find((it) => it.id === equippedId);
        if (!item) return false;
        const itemIndex = GRADE_ORDER.indexOf(item.grade);
        if (itemIndex < requiredIndex) return false;
    }
    return true;
};

const getSeasonScoreByTrack = (user: User, trackType: 'strategy_tier' | 'playful_tier'): number => {
    const key = trackType === 'strategy_tier' ? 'standard' : 'playful';
    const diff = user.cumulativeRankingScore?.[key] ?? 0;
    return 1200 + diff;
};

type HandleActionResult = {
    clientResponse?: any;
    error?: string;
};

const getRewardConfig = async (): Promise<RewardConfig> => {
    const stored = await db.getKV<unknown>('rewardConfig');
    return normalizeRewardConfig(stored ?? DEFAULT_REWARD_CONFIG);
};

const addRewardBonus = (value: number | undefined, bonus: number): number => {
    const base = Number(value) || 0;
    const add = Number(bonus) || 0;
    return Math.max(0, Math.floor(base + add));
};

export const handleRewardAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type, payload } = action as any;

    switch (type) {
        case 'CLAIM_MAIL_ATTACHMENTS': {
            const { mailId } = payload;
            const mail = user.mail.find(m => m.id === mailId);
        
            if (!mail) return { error: 'Mail not found.' };
            if (mail.attachmentsClaimed) return { error: 'Attachments already claimed.' };
            if (!mail.attachments) return { error: 'No attachments to claim.' };
        
            const itemsToCreate: InventoryItem[] = [];
            if (mail.attachments.items) {
                 const createdItems = createItemInstancesFromMailAttachments(
                     mail.attachments.items as InventoryItem[] | { itemId: string; quantity: number }[],
                     mail.id
                 );
                 itemsToCreate.push(...createdItems);
            }
        
            const { success, updatedInventory } = addItemsToInventory([...user.inventory], user.inventorySlots, itemsToCreate);
            if (!success) return { error: '인벤토리 공간이 부족합니다.' };
        
            const reward: QuestReward = {
                gold: mail.attachments.gold || 0,
                diamonds: mail.attachments.diamonds || 0,
                actionPoints: mail.attachments.actionPoints || 0,
            };

            if (reward.gold) user.gold += reward.gold;
            if (reward.diamonds) user.diamonds += reward.diamonds;
            if (reward.actionPoints) {
                user.actionPoints.current += reward.actionPoints;
            }

            const guildCoinsDelta = mail.attachments.guildCoins || 0;
            if (guildCoinsDelta) {
                user.guildCoins = (user.guildCoins || 0) + guildCoinsDelta;
            }

            const researchPointsDelta = mail.attachments.researchPoints || 0;
            if (researchPointsDelta && typeof user.guildId === 'string') {
                const guilds = (await db.getKV<Record<string, Guild>>('guilds')) || {};
                const guild = guilds[user.guildId];
                if (guild) {
                    guild.researchPoints = (guild.researchPoints || 0) + researchPointsDelta;
                    guilds[user.guildId] = guild;
                    await db.setKV('guilds', guilds);
                    const { broadcast } = await import('../socket.js');
                    await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
                }
            }
        
            user.inventory = updatedInventory;
        
            mail.attachmentsClaimed = true;
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'CLAIM_MAIL_ATTACHMENTS');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[CLAIM_MAIL_ATTACHMENTS] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화: 변경된 필드만 전송)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'mail', 'gold', 'diamonds', 'actionPoints', 'guildCoins']);
            
            return {
                clientResponse: {
                    rewardSummary: {
                        reward,
                        items: itemsToCreate,
                        title: '우편 보상'
                    },
                    updatedUser
                }
            };
        }
        case 'CLAIM_ALL_MAIL_ATTACHMENTS': {
            const mailsToClaim = user.mail.filter(m => m.attachments && !m.attachmentsClaimed);
            if (mailsToClaim.length === 0) return { error: '수령할 아이템이 없습니다.' };

            let totalGold = 0;
            let totalDiamonds = 0;
            let totalActionPoints = 0;
            let totalGuildCoins = 0;
            let totalResearchPoints = 0;
            const allItemsToCreate: InventoryItem[] = [];

            for (const mail of mailsToClaim) {
                totalGold += mail.attachments!.gold || 0;
                totalDiamonds += mail.attachments!.diamonds || 0;
                totalActionPoints += mail.attachments!.actionPoints || 0;
                totalGuildCoins += mail.attachments!.guildCoins || 0;
                totalResearchPoints += mail.attachments!.researchPoints || 0;
                if (mail.attachments!.items) {
                    const createdItems = createItemInstancesFromMailAttachments(
                        mail.attachments!.items as InventoryItem[] | { itemId: string; quantity: number }[],
                        mail.id
                    );
                    allItemsToCreate.push(...createdItems);
                }
            }

            const { success, finalItemsToAdd, updatedInventory } = addItemsToInventory([...user.inventory], user.inventorySlots, allItemsToCreate);
            if (!success) {
                return { error: '모든 아이템을 받기에 가방 공간이 부족합니다.' };
            }

            user.gold += totalGold;
            user.diamonds += totalDiamonds;
            user.actionPoints.current += totalActionPoints;
            if (totalGuildCoins) {
                user.guildCoins = (user.guildCoins || 0) + totalGuildCoins;
            }
            user.inventory = updatedInventory;

            for (const mail of mailsToClaim) mail.attachmentsClaimed = true;

            if (totalResearchPoints && typeof user.guildId === 'string') {
                const guilds = (await db.getKV<Record<string, Guild>>('guilds')) || {};
                const guild = guilds[user.guildId];
                if (guild) {
                    guild.researchPoints = (guild.researchPoints || 0) + totalResearchPoints;
                    guilds[user.guildId] = guild;
                    await db.setKV('guilds', guilds);
                    const { broadcast } = await import('../socket.js');
                    await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
                }
            }

            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'CLAIM_ALL_MAIL_ATTACHMENTS');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[CLAIM_ALL_MAIL_ATTACHMENTS] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화: 변경된 필드만 전송)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'mail', 'gold', 'diamonds', 'actionPoints', 'guildCoins']);
            
            const reward: QuestReward = {
                gold: totalGold,
                diamonds: totalDiamonds,
                actionPoints: totalActionPoints,
            };

            // If only currency is being awarded, send a simpler response for the dedicated modal.
            if (allItemsToCreate.length === 0 && (totalGold > 0 || totalDiamonds > 0 || totalActionPoints > 0)) {
                return {
                    clientResponse: {
                        claimAllSummary: {
                            gold: totalGold,
                            diamonds: totalDiamonds,
                            actionPoints: totalActionPoints
                        },
                        updatedUser
                    }
                };
            }

            return {
                clientResponse: {
                    rewardSummary: {
                        reward,
                        items: allItemsToCreate,
                        title: '우편 일괄 수령'
                    },
                    updatedUser
                }
            };
        }
        case 'CLAIM_QUEST_REWARD': {
            const { questId } = payload;
            const questCategories = ['daily', 'weekly', 'monthly'] as const;
            let foundQuest: Quest | undefined;
            let questType: 'daily' | 'weekly' | 'monthly' | undefined;

            for (const category of questCategories) {
                const questList = user.quests[category]?.quests;
                if (questList) {
                    foundQuest = questList.find(q => q.id === questId);
                    if (foundQuest) {
                        questType = category;
                        break;
                    }
                }
            }

            if (!foundQuest) return { error: '퀘스트를 찾을 수 없습니다.' };
            if (foundQuest.isClaimed) return { error: '이미 보상을 수령했습니다.' };
            if (foundQuest.progress < foundQuest.target) return { error: '퀘스트를 아직 완료하지 않았습니다.' };
            
            const { reward, activityPoints } = foundQuest;
            const rewardConfig = await getRewardConfig();
            const rewardVipMult = isRewardVipActive(user) ? 2 : 1;
            const scaledItemDefs =
                reward.items && rewardVipMult > 1
                    ? (reward.items as { itemId: string; quantity: number }[]).map((e) => ({
                          ...e,
                          quantity: Math.max(1, Math.floor((e.quantity || 1) * rewardVipMult)),
                      }))
                    : reward.items;
            const itemsToCreate: InventoryItem[] = [];
            if (scaledItemDefs) {
                const createdItems = createItemInstancesFromReward(scaledItemDefs as { itemId: string; quantity: number }[]);
                itemsToCreate.push(...createdItems);
            }

            const { success, finalItemsToAdd, updatedInventory } = addItemsToInventory([...user.inventory], user.inventorySlots, itemsToCreate);
            if (!success) {
                return { error: '보상을 받기에 인벤토리 공간이 부족합니다.' };
            }
            
            foundQuest.isClaimed = true;
            
            const adjustedReward: QuestReward = {
                ...reward,
                gold: addRewardBonus(reward.gold, rewardConfig.questGoldBonus),
                diamonds: addRewardBonus(reward.diamonds, rewardConfig.questDiamondBonus),
                actionPoints: addRewardBonus(reward.actionPoints, rewardConfig.questActionPointBonus),
            };
            if (rewardVipMult > 1) {
                adjustedReward.gold = Math.floor((adjustedReward.gold || 0) * rewardVipMult);
                adjustedReward.diamonds = Math.floor((adjustedReward.diamonds || 0) * rewardVipMult);
                adjustedReward.actionPoints = Math.floor((adjustedReward.actionPoints || 0) * rewardVipMult);
            }
            if (adjustedReward.gold) user.gold += adjustedReward.gold;
            if (adjustedReward.diamonds) user.diamonds += adjustedReward.diamonds;
            if (adjustedReward.actionPoints) user.actionPoints.current += adjustedReward.actionPoints;
            user.inventory = updatedInventory;
            
            if (activityPoints > 0 && user.quests[questType!]) {
                const qd = user.quests[questType!]!;
                qd.activityProgress += activityPoints;
                const maxAp =
                    questType === 'daily'
                        ? DAILY_MILESTONE_THRESHOLDS[DAILY_MILESTONE_THRESHOLDS.length - 1]!
                        : questType === 'weekly'
                          ? WEEKLY_MILESTONE_THRESHOLDS[WEEKLY_MILESTONE_THRESHOLDS.length - 1]!
                          : MONTHLY_MILESTONE_THRESHOLDS[MONTHLY_MILESTONE_THRESHOLDS.length - 1]!;
                qd.activityProgress = clampQuestProgressToTarget(qd.activityProgress, maxAp);
            }

            // 깊은 복사로 updatedUser 생성하여 React가 변경을 확실히 감지하도록 함
            const updatedUser = JSON.parse(JSON.stringify(user));
            
            // DB 업데이트와 WebSocket 브로드캐스트를 병렬로 처리하여 응답 속도 개선
            const updatePromise = db.updateUser(user);
            const { broadcastUserUpdate } = await import('../socket.js');
            const broadcastPromise = broadcastUserUpdate(updatedUser, ['inventory', 'equipment', 'quests', 'gold', 'diamonds', 'actionPoints']);
            
            // rewardSummary를 즉시 반환하여 모달이 빠르게 표시되도록 함
            // DB 업데이트는 백그라운드에서 완료되도록 함
            Promise.all([updatePromise, broadcastPromise]).catch((error) => {
                console.error(`[CLAIM_QUEST_REWARD] Error updating user or broadcasting:`, error);
            });
            
            return { 
                clientResponse: { 
                    rewardSummary: {
                        reward: adjustedReward,
                        items: itemsToCreate,
                        title: `${questType === 'daily' ? '일일' : questType === 'weekly' ? '주간' : '월간'} 퀘스트 보상`
                    },
                    updatedUser
                } 
            };
        }
        case 'CLAIM_ACHIEVEMENT_REWARD': {
            const { trackId, stageIndex } = payload as { trackId: string; stageIndex: number };
            const track = ACHIEVEMENT_TRACK_MAP[trackId];
            if (!track) return { error: '유효하지 않은 업적 트랙입니다.' };
            if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex >= track.stages.length) {
                return { error: '유효하지 않은 업적 단계입니다.' };
            }

            if (!user.quests.achievements) {
                user.quests.achievements = { tracks: {} };
            }
            if (!user.quests.achievements.tracks) {
                user.quests.achievements.tracks = {};
            }
            if (!user.quests.achievements.tracks[trackId]) {
                user.quests.achievements.tracks[trackId] = {
                    currentIndex: 0,
                    claimedIndices: [],
                };
            }

            const state = user.quests.achievements.tracks[trackId]!;
            if (!Array.isArray(state.claimedIndices)) state.claimedIndices = [];
            if (!Number.isInteger(state.currentIndex) || state.currentIndex < 0) {
                state.currentIndex = 0;
            }
            if (state.currentIndex > track.stages.length - 1) {
                state.currentIndex = Math.max(0, track.stages.length - 1);
            }

            if (state.currentIndex !== stageIndex) {
                return { error: '현재 진행 중인 업적 단계만 수령할 수 있습니다.' };
            }
            if (state.claimedIndices.includes(stageIndex)) {
                return { error: '이미 수령한 업적 보상입니다.' };
            }

            const stage = track.stages[stageIndex]!;
            let requirementMet = false;
            if (stage.requirement.type === 'singleplayer_stage_clear') {
                const clearedStages = Array.isArray(user.clearedSinglePlayerStages) ? user.clearedSinglePlayerStages : [];
                requirementMet = clearedStages.includes(stage.requirement.stageId);
            } else if (stage.requirement.type === 'strategy_level') {
                requirementMet = (user.strategyLevel ?? 0) >= stage.requirement.level;
            } else if (stage.requirement.type === 'playful_level') {
                requirementMet = (user.playfulLevel ?? 0) >= stage.requirement.level;
            } else if (stage.requirement.type === 'championship_cumulative_score') {
                requirementMet = (user.cumulativeTournamentScore ?? 0) >= stage.requirement.score;
            } else if (stage.requirement.type === 'all_equipment_min_grade') {
                requirementMet = isAllEquipmentAtLeastGrade(user, stage.requirement.grade);
            } else if (stage.requirement.type === 'strategy_tier' || stage.requirement.type === 'playful_tier') {
                const score = getSeasonScoreByTrack(user, stage.requirement.type);
                requirementMet = score >= (TIER_SCORE_REQUIREMENTS[stage.requirement.tier] ?? Number.MAX_SAFE_INTEGER);
            } else if (stage.requirement.type === 'adventure_understanding_tier') {
                const xp = Math.max(0, Math.floor(user.adventureProfile?.understandingXpByStage?.[stage.requirement.stageId] ?? 0));
                const currentTier = getAdventureUnderstandingTierFromXp(xp);
                const requiredTier = ADVENTURE_UNDERSTANDING_TIER_INDEX_BY_LABEL[stage.requirement.tier] ?? Number.MAX_SAFE_INTEGER;
                requirementMet = currentTier >= requiredTier;
            } else if (stage.requirement.type === 'adventure_codex_score') {
                const { totalSum } = getAdventureCodexCompletionBreakdown(user.adventureProfile);
                requirementMet = totalSum >= stage.requirement.score;
            } else if (stage.requirement.type === 'blacksmith_level') {
                requirementMet = (user.blacksmithLevel ?? 1) >= stage.requirement.level;
            } else if (stage.requirement.type === 'equipment_box_opens') {
                requirementMet = (user.quests?.achievements?.totalEquipmentBoxOpens ?? 0) >= stage.requirement.opens;
            } else if (stage.requirement.type === 'material_box_opens') {
                requirementMet = (user.quests?.achievements?.totalMaterialBoxOpens ?? 0) >= stage.requirement.opens;
            }
            if (!requirementMet) {
                return { error: '아직 업적 조건을 달성하지 않았습니다.' };
            }

            user.diamonds += stage.rewardDiamonds;
            state.claimedIndices.push(stageIndex);
            state.claimedIndices = [...new Set(state.claimedIndices)].sort((a, b) => a - b);
            state.currentIndex = Math.min(track.stages.length - 1, stageIndex + 1);

            const reward: QuestReward = { diamonds: stage.rewardDiamonds };
            const updatedUser = getSelectiveUserUpdate(user, 'CLAIM_ACHIEVEMENT_REWARD');

            db.updateUser(user).catch(err => {
                console.error(`[CLAIM_ACHIEVEMENT_REWARD] Failed to save user ${user.id}:`, err);
            });
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['quests', 'diamonds']);

            return {
                clientResponse: {
                    rewardSummary: {
                        reward,
                        items: [],
                        title: `${track.title} 보상`,
                    },
                    updatedUser,
                },
            };
        }
        case 'CLAIM_ACTIVITY_MILESTONE': {
            const { milestoneIndex, questType } = payload as { milestoneIndex: number; questType: 'daily' | 'weekly' | 'monthly' };
            const rewardConfig = await getRewardConfig();
            
            const questDataMap = {
                daily: { data: user.quests.daily, thresholds: DAILY_MILESTONE_THRESHOLDS, rewards: DAILY_MILESTONE_REWARDS },
                weekly: { data: user.quests.weekly, thresholds: WEEKLY_MILESTONE_THRESHOLDS, rewards: WEEKLY_MILESTONE_REWARDS },
                monthly: { data: user.quests.monthly, thresholds: MONTHLY_MILESTONE_THRESHOLDS, rewards: MONTHLY_MILESTONE_REWARDS },
            };

            const selectedQuest = questDataMap[questType];
            if (!selectedQuest || !selectedQuest.data) return { error: "유효하지 않은 퀘스트 타입입니다." };

            const { data, thresholds, rewards } = selectedQuest;
            
            if (milestoneIndex < 0 || milestoneIndex >= rewards.length) return { error: "유효하지 않은 마일스톤입니다." };
            if (data.claimedMilestones[milestoneIndex]) return { error: "이미 수령한 보상입니다." };

            const requiredProgress = thresholds[milestoneIndex];
            if (data.activityProgress < requiredProgress) return { error: "활약도 점수가 부족합니다." };

            const reward = rewards[milestoneIndex];
            const rewardVipMult = isRewardVipActive(user) ? 2 : 1;
            const adjustedReward: QuestReward = {
                ...reward,
                gold: addRewardBonus(reward.gold, rewardConfig.activityGoldBonus),
                diamonds: addRewardBonus(reward.diamonds, rewardConfig.activityDiamondBonus),
                actionPoints: addRewardBonus(reward.actionPoints, rewardConfig.activityActionPointBonus),
            };
            if (rewardVipMult > 1) {
                adjustedReward.gold = Math.floor((adjustedReward.gold || 0) * rewardVipMult);
                adjustedReward.diamonds = Math.floor((adjustedReward.diamonds || 0) * rewardVipMult);
                adjustedReward.actionPoints = Math.floor((adjustedReward.actionPoints || 0) * rewardVipMult);
            }
            
            const itemsToCreate: InventoryItem[] = [];
            if (reward.items) {
                 const scaled =
                     rewardVipMult > 1
                         ? (reward.items as { itemId: string; quantity: number }[]).map((e) => ({
                               ...e,
                               quantity: Math.max(1, Math.floor((e.quantity || 1) * rewardVipMult)),
                           }))
                         : reward.items;
                 const createdItems = createItemInstancesFromReward(scaled as { itemId: string; quantity: number }[]);
                 itemsToCreate.push(...createdItems);
            }

            const { success, finalItemsToAdd, updatedInventory } = addItemsToInventory([...user.inventory], user.inventorySlots, itemsToCreate);
            if (!success) return { error: '보상을 받기에 인벤토리 공간이 부족합니다.' };
            
            user.gold += adjustedReward.gold || 0;
            user.diamonds += adjustedReward.diamonds || 0;
            user.actionPoints.current += adjustedReward.actionPoints || 0;
            user.inventory = updatedInventory;
            
            data.claimedMilestones[milestoneIndex] = true;

            if (milestoneIndex === 4) { // 100 activity points milestone is at index 4
                if (questType === 'daily') {
                    updateQuestProgress(user, 'claim_daily_milestone_100');
                } else if (questType === 'weekly') {
                    updateQuestProgress(user, 'claim_weekly_milestone_100');
                }
            }

            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'CLAIM_QUEST_REWARD');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[CLAIM_QUEST_REWARD] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화: 변경된 필드만 전송)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'quests', 'gold', 'diamonds', 'actionPoints']);
            
            return { 
                clientResponse: { 
                    rewardSummary: {
                        reward: adjustedReward,
                        items: itemsToCreate,
                        title: `${questType === 'daily' ? '일일' : questType === 'weekly' ? '주간' : '월간'} 활약도 보상`
                    },
                    updatedUser
                } 
            };
        }
        case 'DELETE_MAIL': {
            const { mailId } = payload;
            const mailIndex = user.mail.findIndex(m => m.id === mailId);
            if (mailIndex === -1) return { error: 'Mail not found.' };

            const mail = user.mail[mailIndex];
            if (mail.attachments && !mail.attachmentsClaimed) {
                return { error: '수령하지 않은 아이템이 있는 메일은 삭제할 수 없습니다.' };
            }

            user.mail.splice(mailIndex, 1);
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'DELETE_MAIL');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[DELETE_MAIL] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화: 변경된 필드만 전송)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['mail']);
            
            // HTTP 응답에도 updatedUser 포함 (즉시 클라이언트 상태 업데이트)
            return { clientResponse: { updatedUser } };
        }
        case 'DELETE_ALL_CLAIMED_MAIL': {
            // user.mail이 없거나 배열이 아닌 경우 초기화
            if (!user.mail || !Array.isArray(user.mail)) {
                user.mail = [];
            }
            
            // 수령 완료된 메일만 삭제 (attachments가 있고 attachmentsClaimed가 true인 것)
            const beforeCount = user.mail.length;
            user.mail = user.mail.filter(m => {
                // attachments가 없거나 attachmentsClaimed가 false인 것만 남김
                return !(m && m.attachments && m.attachmentsClaimed);
            });
            const deletedCount = beforeCount - user.mail.length;
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'DELETE_ALL_CLAIMED_MAIL');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[DELETE_ALL_CLAIMED_MAIL] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화: 변경된 필드만 전송)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['mail']);
            
            return { 
                clientResponse: { 
                    updatedUser,
                    deletedCount 
                } 
            };
        }
        case 'MARK_MAIL_AS_READ': {
            if (!payload || typeof payload !== 'object') {
                return { error: 'Invalid payload for MARK_MAIL_AS_READ.' };
            }
            const { mailId } = payload as { mailId?: string };
            if (!mailId || typeof mailId !== 'string') {
                return { error: 'mailId is required and must be a string.' };
            }
            
            if (!user.mail || !Array.isArray(user.mail)) {
                return { error: 'User mail array not found.' };
            }
            
            const mail = user.mail.find(m => m.id === mailId);
            if (!mail) {
                return { error: 'Mail not found.' };
            }
            
            mail.isRead = true;
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'MARK_MAIL_AS_READ');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[MARK_MAIL_AS_READ] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화: 변경된 필드만 전송)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['mail']);
            
            return { clientResponse: { updatedUser } };
        }
        case 'CLAIM_TOURNAMENT_REWARD': {
            const { tournamentType } = payload as { tournamentType: TournamentType };
            const rewardConfig = await getRewardConfig();
            
            let statusKey: keyof User;
            let tourneyKey: keyof User;

            switch (tournamentType) {
                case 'neighborhood':
                    statusKey = 'neighborhoodRewardClaimed';
                    tourneyKey = 'lastNeighborhoodTournament';
                    break;
                case 'national':
                    statusKey = 'nationalRewardClaimed';
                    tourneyKey = 'lastNationalTournament';
                    break;
                case 'world':
                    statusKey = 'worldRewardClaimed';
                    tourneyKey = 'lastWorldTournament';
                    break;
                default:
                    return { error: 'Invalid tournament type.' };
            }

            // DB에서 최신 상태를 다시 확인하여 중복 보상 지급 방지
            const freshUser = await db.getUser(user.id);
            if (!freshUser) return { error: '사용자를 찾을 수 없습니다.' };
            
            if ((freshUser as any)[statusKey]) {
                console.warn(`[CLAIM_TOURNAMENT_REWARD] User ${user.id} already claimed reward for ${tournamentType}`);
                return { error: '이미 보상을 수령했습니다.' };
            }
            
            // freshUser를 사용하도록 변경
            const tournamentState = (freshUser as any)[tourneyKey] as TournamentState | null;
            if (!tournamentState || (tournamentState.status !== 'complete' && tournamentState.status !== 'eliminated')) {
                 return { error: '토너먼트가 아직 종료되지 않았습니다.' };
            }
            
            const itemRewardInfo = BASE_TOURNAMENT_REWARDS[tournamentType];
            if (!itemRewardInfo) {
                console.error(`[CLAIM_TOURNAMENT_REWARD] Item reward info not found for tournament type:`, tournamentType);
                return { error: `토너먼트 보상 정보를 찾을 수 없습니다. (타입: ${tournamentType})` };
            }
            
            let rankings;
            try {
                rankings = calculateRanks(tournamentState);
            } catch (error: any) {
                console.error(`[CLAIM_TOURNAMENT_REWARD] Error calculating ranks:`, error);
                console.error(`[CLAIM_TOURNAMENT_REWARD] Tournament state:`, JSON.stringify(tournamentState, null, 2));
                return { error: `순위 계산 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}` };
            }
            
            if (!rankings || rankings.length === 0) {
                console.error(`[CLAIM_TOURNAMENT_REWARD] No rankings calculated for tournament:`, tournamentState);
                return { error: '순위를 계산할 수 없습니다.' };
            }
            
            const userRanking = rankings.find(r => r.id === freshUser.id);
            if (!userRanking) {
                console.error(`[CLAIM_TOURNAMENT_REWARD] User ranking not found. User ID: ${freshUser.id}, Rankings:`, rankings);
                return { error: '순위를 결정할 수 없습니다.' };
            }
            const userRank = userRanking.rank;

            let itemRewardKey: number;
            if (tournamentType === 'neighborhood') itemRewardKey = userRank <= 3 ? userRank : 4;
            else if (tournamentType === 'national') itemRewardKey = userRank <= 4 ? userRank : 5;
            else { // world
                if (userRank <= 4) itemRewardKey = userRank;
                else if (userRank <= 8) itemRewardKey = 5;
                else itemRewardKey = 9;
            }
            
            const scoreRewardInfo = TOURNAMENT_SCORE_REWARDS[tournamentType];
            let scoreRewardKey: number;
            if (tournamentType === 'neighborhood') {
                scoreRewardKey = userRank;
            } else if (tournamentType === 'national') {
                scoreRewardKey = userRank <= 4 ? userRank : 5;
            } else { // world
                if (userRank <= 4) scoreRewardKey = userRank;
                else if (userRank <= 8) scoreRewardKey = 5;
                else scoreRewardKey = 9;
            }
            const rawScoreReward = scoreRewardInfo[scoreRewardKey];
            if (rawScoreReward === undefined) {
                console.error(`[CLAIM_TOURNAMENT_REWARD] Invalid scoreRewardKey: ${scoreRewardKey} for tournamentType: ${tournamentType}, userRank: ${userRank}`);
                return { error: `순위에 대한 점수 보상이 정의되지 않았습니다. (순위: ${userRank})` };
            }
            const scoreReward = addRewardBonus(rawScoreReward, rewardConfig.tournamentScoreBonus);
            
            console.log(`[CLAIM_TOURNAMENT_REWARD] tournamentType: ${tournamentType}, userRank: ${userRank}, scoreRewardKey: ${scoreRewardKey}, scoreReward: ${scoreReward}, currentTournamentScore: ${freshUser.tournamentScore || 0}`);
            
            // 던전 진행 상태 초기화 및 다음 단계 언락 (순위에 따라)
            if (!freshUser.dungeonProgress) {
                freshUser.dungeonProgress = {
                    neighborhood: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                    national: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                    world: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                };
            }
            
            const dungeonProgress = freshUser.dungeonProgress[tournamentType];
            
            // 토너먼트 완료 시 클리어/다음 단계: 1~3등 달성 시 클리어로 간주 (모든 챔피언십 공통)
            const stageJustCompleted = (tournamentState as any).currentStageAttempt as number | undefined;
            const currentStage = typeof stageJustCompleted === 'number' && stageJustCompleted >= 1 ? stageJustCompleted : dungeonProgress.currentStage || 1;
            const cleared = userRank <= 3;
            
            if (cleared) {
                if (currentStage > (dungeonProgress.currentStage ?? 0)) {
                    dungeonProgress.currentStage = currentStage;
                }
                // 클리어 표시(드롭다운 등)를 위해 stageResults에 반영 (방금 완료한 단계 번호가 있을 때만)
                if (typeof stageJustCompleted === 'number' && stageJustCompleted >= 1) {
                    if (!dungeonProgress.stageResults) dungeonProgress.stageResults = {};
                    const entry = dungeonProgress.stageResults[stageJustCompleted] ?? (dungeonProgress.stageResults as Record<string, { cleared?: boolean; scoreDiff?: number; clearTime?: number }>)[String(stageJustCompleted)];
                    if (!entry) {
                        (dungeonProgress.stageResults as Record<number, { cleared: boolean; scoreDiff: number; clearTime: number }>)[stageJustCompleted] = { cleared: true, scoreDiff: 0, clearTime: Date.now() };
                    } else {
                        (entry as { cleared?: boolean }).cleared = true;
                        if ('clearTime' in entry) (entry as { clearTime?: number }).clearTime = Date.now();
                    }
                }
            }
            
            // 다음 단계 언락: 1~3등이면 다음 단계 언락 (cleared 조건과 독립적으로 처리)
            if (userRank >= 1 && userRank <= 3 && currentStage < 10) {
                const nextStage = currentStage + 1;
                if (!dungeonProgress.unlockedStages.includes(nextStage)) {
                    dungeonProgress.unlockedStages.push(nextStage);
                    dungeonProgress.unlockedStages.sort((a, b) => a - b);
                    console.log(`[CLAIM_TOURNAMENT_REWARD] ✓ Unlocked next stage ${nextStage} for ${tournamentType} (userRank: ${userRank}, currentStage: ${currentStage})`);
                } else {
                    console.log(`[CLAIM_TOURNAMENT_REWARD] Stage ${nextStage} already unlocked for ${tournamentType} (userRank: ${userRank})`);
                }
            } else {
                console.log(`[CLAIM_TOURNAMENT_REWARD] Stage unlock condition not met: userRank=${userRank}, currentStage=${currentStage}, need: userRank 1-3 and currentStage < 10`);
            }
            // unlockedStages는 1~3위일 때만 위에서 nextStage 추가. 순위 무관 보정 제거(버그 방지)
            if (!Array.isArray(dungeonProgress.unlockedStages) || dungeonProgress.unlockedStages.length === 0) {
                dungeonProgress.unlockedStages = [1];
            }
            dungeonProgress.unlockedStages = [...new Set(dungeonProgress.unlockedStages)].filter((s: number) => s >= 1 && s <= 10).sort((a: number, b: number) => a - b);
            
            const itemReward = itemRewardInfo.rewards?.[itemRewardKey];
            // 월드챔피언십: 순위 보상은 다이아 직접 지급만(던전 COMPLETE_DUNGEON_STAGE와 동일). 꾸러미/골드 상자 제거.
            const resolvedItemReward: QuestReward | undefined =
                tournamentType === 'world'
                    ? (() => {
                          const rw = getDungeonRankRewardWorld(currentStage, userRank);
                          return {
                              diamonds: addRewardBonus(rw.diamonds ?? 0, rewardConfig.tournamentDiamondBonus),
                              items: [],
                              gold: 0,
                          };
                      })()
                    : itemReward;

            if (!resolvedItemReward) {
                console.error(`[CLAIM_TOURNAMENT_REWARD] Item reward not found. tournamentType: ${tournamentType}, itemRewardKey: ${itemRewardKey}, userRank: ${userRank}`);
                console.error(`[CLAIM_TOURNAMENT_REWARD] Available reward keys:`, itemRewardInfo.rewards ? Object.keys(itemRewardInfo.rewards) : 'none');
                // itemReward가 없어도 점수 보상은 지급해야 하므로 계속 진행
            }
            
            if (!resolvedItemReward) {
                // 동네바둑리그: 누적 골드 추가
                let accumulatedGold = 0;
                if (tournamentType === 'neighborhood' && tournamentState.accumulatedGold) {
                    accumulatedGold = tournamentState.accumulatedGold;
                }
                
                // 전국바둑대회: 누적 재료 추가
                let accumulatedMaterials: InventoryItem[] = [];
                if (tournamentType === 'national' && tournamentState.accumulatedMaterials) {
                    const materialItems = Object.entries(tournamentState.accumulatedMaterials).map(([materialName, quantity]) => ({
                        itemId: materialName,
                        quantity: quantity
                    }));
                    accumulatedMaterials = createItemInstancesFromReward(materialItems);
                }
                
                // 월드챔피언십: 경기 중 생성된 장비만 지급(상자 소모품 아님)
                let accumulatedWorldEquipment: InventoryItem[] = [];
                if (tournamentType === 'world' && tournamentState.accumulatedEquipmentItems?.length) {
                    accumulatedWorldEquipment = tournamentState.accumulatedEquipmentItems.map((it) =>
                        JSON.parse(JSON.stringify(it))
                    ) as InventoryItem[];
                }
                
                // 재료와 월드 장비를 함께 인벤토리에 추가
                const allAccumulatedItems = [...accumulatedMaterials, ...accumulatedWorldEquipment];
                if (allAccumulatedItems.length > 0) {
                    const { success, finalItemsToAdd, updatedInventory } = addItemsToInventory([...freshUser.inventory], freshUser.inventorySlots, allAccumulatedItems);
                    if (!success) {
                        return { error: '보상을 받기에 가방 공간이 부족합니다. 가방을 비우고 다시 시도해주세요.' };
                    }
                    freshUser.inventory = updatedInventory;
                }
                
                (freshUser as any)[statusKey] = true;
                // 토너먼트 완료 시점에 이미 점수가 추가되었을 수 있으므로, 보상 수령 시에는 점수를 추가하지 않음
                // (중복 추가 방지)
                const currentCumulativeScore = freshUser.cumulativeTournamentScore || 0;
                const currentScore = freshUser.tournamentScore || 0;
                
                // 점수가 아직 추가되지 않았으면 추가 (토너먼트 완료 시점에 점수가 추가되지 않은 경우 대비)
                if (currentCumulativeScore < scoreReward || currentScore < scoreReward) {
                    const oldCumulativeScore = freshUser.cumulativeTournamentScore || 0;
                    freshUser.cumulativeTournamentScore = oldCumulativeScore + scoreReward;
                    // tournamentScore는 주간 점수로 유지 (주간 리셋용)
                    const oldScore = freshUser.tournamentScore || 0;
                    freshUser.tournamentScore = oldScore + scoreReward;
                    console.log(`[CLAIM_TOURNAMENT_REWARD] Added score (was missing): cumulativeTournamentScore: ${oldCumulativeScore} -> ${freshUser.cumulativeTournamentScore}, tournamentScore: ${oldScore} -> ${freshUser.tournamentScore}`);
                } else {
                    console.log(`[CLAIM_TOURNAMENT_REWARD] Score already added at tournament completion. Skipping duplicate addition.`);
                }
                freshUser.gold += accumulatedGold;
                if (accumulatedGold > 0) {
                    console.log(`[CLAIM_TOURNAMENT_REWARD] Added accumulated gold: ${accumulatedGold}`);
                }
                if (accumulatedMaterials.length > 0) {
                    console.log(`[CLAIM_TOURNAMENT_REWARD] Added accumulated materials:`, accumulatedMaterials.map(m => `${m.name} x${m.quantity}`).join(', '));
                }
                if (accumulatedWorldEquipment.length > 0) {
                    console.log(`[CLAIM_TOURNAMENT_REWARD] Added world equipment drops:`, accumulatedWorldEquipment.map(b => `${b.name} x${b.quantity ?? 1}`).join(', '));
                }
                // 보상 수령 후 경기장 JSON 삭제 (대용량 데이터 누적 방지)
                (freshUser as any)[tourneyKey] = null;
                
                // 중복 보상 방지: statusKey를 설정한 후 즉시 DB에 동기적으로 저장
                await db.updateUser(freshUser);
                
                // 사용자 캐시 업데이트 (즉시 반영)
                const { updateUserCache } = await import('../gameCache.js');
                updateUserCache(freshUser);
                
                // 선택적 필드만 반환 (메시지 크기 최적화)
                const updatedUser = getSelectiveUserUpdate(freshUser, 'CLAIM_TOURNAMENT_REWARD', { includeAll: true });
                
                // WebSocket으로 사용자 업데이트 브로드캐스트 (보상·다음 단계 언락 반영)
                const fullUserForBroadcast = JSON.parse(JSON.stringify(freshUser));
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(fullUserForBroadcast, ['inventory', 'equipment', 'quests', 'gold', 'diamonds', 'actionPoints', 'mail', 'tournamentScore', 'cumulativeTournamentScore', 'neighborhoodRewardClaimed', 'nationalRewardClaimed', 'worldRewardClaimed', 'lastNeighborhoodTournament', 'lastNationalTournament', 'lastWorldTournament', 'dungeonProgress']);
                const { invalidateRankingCache } = await import('../rankingCache.js');
                invalidateRankingCache();
                const allObtainedItems: any[] = [...accumulatedMaterials, ...accumulatedWorldEquipment];
                if (accumulatedGold > 0) {
                    allObtainedItems.unshift({ name: `${accumulatedGold} 골드 (경기 보상)`, image: '/images/icon/Gold.png' });
                }
                
                // oldCumulativeScore를 먼저 정의 (나중에 사용하기 위해)
                const oldCumulativeScore = freshUser.cumulativeTournamentScore || 0;
                
                // rewardSummary 형식으로 변환하여 모달 표시
                const reward: QuestReward = {
                    gold: accumulatedGold,
                    diamonds: tournamentType === 'world' ? getDungeonRankRewardWorld(currentStage, userRank).diamonds ?? 0 : 0,
                    actionPoints: 0,
                };
                
                return { 
                    clientResponse: { 
                        obtainedItemsBulk: allObtainedItems, 
                        updatedUser, 
                        tournamentScoreChange: { oldScore: oldCumulativeScore, newScore: freshUser.cumulativeTournamentScore, scoreReward: scoreReward },
                        rewardSummary: {
                            reward,
                            items: allObtainedItems,
                            title: `${TOURNAMENT_DEFINITIONS[tournamentType].name} 보상`
                        }
                    }
                };
            }

            // 골드 꾸러미와 다이아 꾸러미는 모두 아이템으로 지급 (사용자가 직접 사용하여 랜덤 골드/다이아 획득)
            const regularItems: { itemId: string; quantity: number }[] = [];
            
            if (resolvedItemReward?.items) {
                for (const itemRef of resolvedItemReward.items as { itemId: string; quantity: number }[]) {
                    // 모든 아이템을 그대로 아이템으로 추가
                    regularItems.push(itemRef);
                }
            }
            
            const itemsToCreate = regularItems.length > 0 ? createItemInstancesFromReward(regularItems) : [];
            
            // 전국바둑대회: 누적 재료 추가
            if (tournamentType === 'national' && tournamentState.accumulatedMaterials) {
                const materialItems = Object.entries(tournamentState.accumulatedMaterials).map(([materialName, quantity]) => ({
                    itemId: materialName,
                    quantity: quantity
                }));
                const createdMaterials = createItemInstancesFromReward(materialItems);
                itemsToCreate.push(...createdMaterials);
            }
            
            // 월드챔피언십: 경기 중 생성된 장비만 지급(레거시 장비상자 맵은 사용하지 않음)
            if (tournamentType === 'world' && tournamentState.accumulatedEquipmentItems?.length) {
                for (const eq of tournamentState.accumulatedEquipmentItems) {
                    itemsToCreate.push(JSON.parse(JSON.stringify(eq)) as InventoryItem);
                }
            }
            
            const { success, finalItemsToAdd, updatedInventory } = addItemsToInventory([...freshUser.inventory], freshUser.inventorySlots, itemsToCreate);
            if (!success) {
                return { error: '보상을 받기에 가방 공간이 부족합니다. 가방을 비우고 다시 시도해주세요.' };
            }
            
            // If we'vepassed the check, apply all changes
                (freshUser as any)[statusKey] = true;
                // 토너먼트 완료 시점에 이미 점수가 추가되었을 수 있으므로, 보상 수령 시에는 점수를 추가하지 않음
                // (중복 추가 방지)
                const currentCumulativeScore = freshUser.cumulativeTournamentScore || 0;
                const currentScore = freshUser.tournamentScore || 0;
                
                // oldCumulativeScore를 먼저 정의 (나중에 사용하기 위해)
                const oldCumulativeScore = freshUser.cumulativeTournamentScore || 0;
                
                // 점수가 아직 추가되지 않았으면 추가 (토너먼트 완료 시점에 점수가 추가되지 않은 경우 대비)
                if (currentCumulativeScore < scoreReward || currentScore < scoreReward) {
                    freshUser.cumulativeTournamentScore = oldCumulativeScore + scoreReward;
                    // tournamentScore는 주간 점수로 유지 (주간 리셋용)
                    const oldScore = freshUser.tournamentScore || 0;
                    freshUser.tournamentScore = oldScore + scoreReward;
                    console.log(`[CLAIM_TOURNAMENT_REWARD] Added score (was missing): cumulativeTournamentScore: ${oldCumulativeScore} -> ${freshUser.cumulativeTournamentScore}, tournamentScore: ${oldScore} -> ${freshUser.tournamentScore}`);
                } else {
                    console.log(`[CLAIM_TOURNAMENT_REWARD] Score already added at tournament completion. Skipping duplicate addition.`);
                }
            
            // 동네바둑리그: 누적 골드 추가
            let accumulatedGold = 0;
            if (tournamentType === 'neighborhood' && tournamentState.accumulatedGold) {
                accumulatedGold = tournamentState.accumulatedGold;
            }
            
            const adjustedRankGold = addRewardBonus(resolvedItemReward?.gold, rewardConfig.tournamentGoldBonus);
            const adjustedRankDiamonds = addRewardBonus(resolvedItemReward?.diamonds, rewardConfig.tournamentDiamondBonus);
            freshUser.gold += adjustedRankGold + accumulatedGold;
            freshUser.diamonds += adjustedRankDiamonds;
            freshUser.inventory = updatedInventory;
            
            // 보상 수령 후 경기장 JSON 삭제 (대용량 데이터 누적 방지)
            (freshUser as any)[tourneyKey] = null;
            
            // 중복 보상 방지: statusKey를 설정한 후 즉시 DB에 동기적으로 저장
            await db.updateUser(freshUser);
            
            // 사용자 캐시 업데이트 (즉시 반영)
            const { updateUserCache } = await import('../gameCache.js');
            updateUserCache(freshUser);
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(freshUser, 'CLAIM_TOURNAMENT_REWARD', { includeAll: true });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (다음 단계 언락 등 반영)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(freshUser, ['inventory', 'gold', 'diamonds', 'tournamentScore', 'cumulativeTournamentScore', 'neighborhoodRewardClaimed', 'nationalRewardClaimed', 'worldRewardClaimed', 'lastNeighborhoodTournament', 'lastNationalTournament', 'lastWorldTournament', 'dungeonProgress']);

            const allObtainedItems: InventoryItem[] = itemsToCreate.map(item => ({
                ...item,
                id: `display-${item.id}`,
                createdAt: Date.now(),
                isEquipped: false,
                stars: item.stars || 0,
                level: item.level || 1,
            }));

            if (accumulatedGold > 0) {
                allObtainedItems.unshift({
                    id: `display-gold-${Date.now()}`,
                    name: `${accumulatedGold} 골드 (경기 보상)`,
                    description: '경기에서 획득한 골드입니다.',
                    type: 'consumable',
                    slot: null,
                    image: '/images/icon/Gold.png',
                    grade: 'rare',
                    quantity: accumulatedGold,
                    createdAt: Date.now(),
                    isEquipped: false,
                    level: 1,
                    stars: 0,
                } as InventoryItem);
            }

            const rankGold = adjustedRankGold;
            const rankDiamonds = adjustedRankDiamonds;
            if (rankGold > 0) {
                allObtainedItems.unshift({
                    id: `display-gold-direct-${Date.now()}`,
                    name: `${rankGold} 골드`,
                    description: '순위 보상으로 획득한 골드입니다.',
                    type: 'consumable',
                    slot: null,
                    image: '/images/icon/Gold.png',
                    grade: 'rare',
                    quantity: rankGold,
                    createdAt: Date.now(),
                    isEquipped: false,
                    level: 1,
                    stars: 0,
                } as InventoryItem);
            }
            if (rankDiamonds > 0) {
                allObtainedItems.unshift({
                    id: `display-diamond-direct-${Date.now()}`,
                    name: `${rankDiamonds} 다이아`,
                    description: '순위 보상으로 획득한 다이아입니다.',
                    type: 'consumable',
                    slot: null,
                    image: '/images/icon/Zem.png',
                    grade: 'epic',
                    quantity: rankDiamonds,
                    createdAt: Date.now(),
                    isEquipped: false,
                    level: 1,
                    stars: 0,
                } as InventoryItem);
            }

            if (allObtainedItems.length === 0 && resolvedItemReward?.items?.length) {
                const fallbackDisplayItems = createItemInstancesFromReward(resolvedItemReward.items as { itemId: string; quantity: number }[]).map(item => ({
                    ...item,
                    id: `display-fallback-${item.id}`,
                }));
                allObtainedItems.push(...fallbackDisplayItems);
            }

            // rewardSummary 형식으로 변환하여 모달 표시
            const reward: QuestReward = {
                gold: adjustedRankGold + accumulatedGold,
                diamonds: adjustedRankDiamonds,
                actionPoints: 0,
            };

            return { 
                clientResponse: { 
                    obtainedItemsBulk: allObtainedItems, 
                    updatedUser, 
                    tournamentScoreChange: { oldScore: oldCumulativeScore, newScore: freshUser.cumulativeTournamentScore, scoreReward: scoreReward },
                    rewardSummary: {
                        reward,
                        items: allObtainedItems,
                        title: `${TOURNAMENT_DEFINITIONS[tournamentType].name} 보상`
                    }
                }
            };
        }
        default:
            return { error: 'Unknown reward action.' };
    }
};