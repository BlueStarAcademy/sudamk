
// FIX: Import missing types from the centralized types file.
import { LiveGameSession, Player, User, GameSummary, StatChange, GameMode, InventoryItem, SpecialStat, WinReason, SinglePlayerStageInfo, QuestReward, Mail } from '../types/index.js';
import * as db from './db.js';
import { clearAiSession } from './aiSessionManager.js';
import { SPECIAL_GAME_MODES, NO_CONTEST_MANNER_PENALTY, NO_CONTEST_RANKING_PENALTY, CONSUMABLE_ITEMS, MATERIAL_ITEMS, PLAYFUL_GAME_MODES, STRATEGIC_LOOT_TABLE, PLAYFUL_LOOT_TABLES_BY_ROUNDS, ENABLE_PVP_SKILL_REWARD_MULTIPLIER, getPvpSkillRewardMultiplier } from '../constants';
import { TOWER_AI_BOT_DISPLAY_NAME, TOWER_STAGES } from '../constants/towerConstants.js';
import { updateQuestProgress } from './questService.js';
import { getSelectiveUserUpdate } from './utils/userUpdateHelper.js';
import * as mannerService from './mannerService.js';
import { openEquipmentBox1, openGuildGradeBox, rollRandomEquipmentFromGradeWeights } from './shop.js';
import * as effectService from './effectService.js';
import { randomUUID } from 'crypto';
// FIX: Correctly import aiUser and getAiUser.
import { aiUserId, getAiUser } from './aiPlayer.js';
import { getGuildWarAiBotDisplayName } from '../shared/constants/guildConstants.js';
import { computeGuildWarAttemptMetrics, getGuildWarMatchGoldReward } from '../shared/utils/guildWarAttemptMetrics.js';
import { isGuildWarLiveSession } from '../shared/constants/guildConstants.js';
import {
  aiLobbyRewardMultiplierFromProfileStep,
  isWaitingRoomAiGame,
  resolveAiLobbyProfileStepFromSettings,
  strategicLobbyAiWinXp,
} from '../shared/utils/strategicAiDifficulty.js';
import { createItemInstancesFromReward, addItemsToInventory } from '../utils/inventoryUtils.js';
import * as guildService from './guildService.js';
import { adventureMonsterGoldLevelMultiplier } from '../constants/adventureConstants.js';
import {
    getAdventureChapterDirectLootDefinition,
    resolveAdventureChapterIndexForLoot,
} from '../shared/utils/adventureChapterDirectLoot.js';
import { ADVENTURE_STRATEGIC_WIN_BASE_GOLD_BY_BOARD_SIZE } from '../shared/constants/adventureStrategicGold.js';
import { rollAdventureEnhancementStoneQuantity } from '../shared/utils/adventureEnhancementStoneQty.js';
import { ItemGrade } from '../types/enums.js';
import {
    applyAdventureMonsterDefeatToProfile,
    applyAdventureMonsterMapSuppressAfterPlayerLoss,
} from './utils/adventureMonsterDefeat.js';
import { normalizeAdventureProfile, sumAdventureUnderstandingGoldBonusPercent } from '../utils/adventureUnderstanding.js';
import {
    getRegionalEquipmentDropBonusPercentForStage,
    getRegionalMaterialDropBonusPercentForStage,
    getRegionalWinGoldBonusPercentForStage,
} from '../utils/adventureRegionalSpecialtyBuff.js';
import { DEFAULT_REWARD_CONFIG, normalizeRewardConfig, type RewardConfig } from '../shared/constants/rewardConfig.js';
import { getAdventureBaseStrategyXp, getAdventureMonsterLevelXpBonus } from '../shared/constants/adventureStrategyXp.js';
import { isRewardVipActive } from '../shared/utils/rewardVip.js';
import { rollVipPlayRewardOutcome } from '../shared/utils/rewardVipPlayRoll.js';
import { isAdventureChapterBossCodexId } from '../constants/adventureMonstersCodex.js';
import { getEffectiveSinglePlayerStages } from './singlePlayerStageConfigService.js';
import { reconcileSinglePlayerProgress } from '../shared/utils/singlePlayerProgress.js';

/** `adventureCodexGoldBonusPercent` = 도감·보스 + 지역 이해도 골드% 합산 — 표시·정산 분리용 */
function splitAdventureGoldBonusPercents(
    effects: effectService.CalculatedEffects,
    adventureProfile: User['adventureProfile'],
): { codexOnlyPercent: number; understandingPercent: number } {
    const understandingPercent = sumAdventureUnderstandingGoldBonusPercent(adventureProfile);
    const combined = effects.adventureCodexGoldBonusPercent ?? 0;
    const codexOnlyPercent = Math.max(0, combined - understandingPercent);
    return { codexOnlyPercent, understandingPercent };
}

/**
 * 구형 클라이언트·복구 세션 등에서 `adventureMonsterBattleMode`가 비어 있어도
 * 실제 `game.mode`로 모험 처치 기록용 룰 키를 복원한다.
 */
function resolveAdventureMonsterBattleModeForSummary(
    game: Pick<LiveGameSession, 'mode' | 'adventureMonsterBattleMode'>,
): string | null {
    const raw = game.adventureMonsterBattleMode;
    if (typeof raw === 'string' && raw.length > 0) {
        return raw;
    }
    switch (game.mode) {
        case GameMode.Standard:
            return 'classic';
        case GameMode.Capture:
            return 'capture';
        case GameMode.Base:
            return 'base';
        case GameMode.Hidden:
            return 'hidden';
        case GameMode.Missile:
            return 'missile';
        default:
            return null;
    }
}

/** 도감·지역 공통 모험 골드/드롭 %는 모험 몬스터 대전 정산에만 반영 (일반 대국 `calculateGameRewards` 경로 제외) */
function isAdventureMonsterBattleRewardContext(game: LiveGameSession): boolean {
    if (game.gameCategory !== 'adventure') return false;
    if (typeof game.adventureMonsterCodexId !== 'string' || game.adventureMonsterCodexId.length === 0) return false;
    if (typeof game.adventureStageId !== 'string' || game.adventureStageId.length === 0) return false;
    return resolveAdventureMonsterBattleModeForSummary(game) != null;
}

/** 챔피언십 던전 대국(상대 id가 dungeon-bot-) — 퀘스트 「챔피언십 경기 진행하기」용 */
function liveSessionHasChampionshipDungeonBot(game: LiveGameSession): boolean {
    const pid = (p: { id?: string } | null | undefined) => (p?.id ? String(p.id) : '');
    if (game.isSinglePlayer || game.gameCategory === 'tower' || (game.gameCategory as string) === 'singleplayer') {
        return false;
    }
    return pid(game.player1).startsWith('dungeon-bot-') || pid(game.player2).startsWith('dungeon-bot-');
}

const getXpForLevel = (level: number): number => {
    if (level < 1) return 0;
    if (level > 100) return Infinity; // Max level
    
    // 레벨 1~10: 200 + (레벨 x 100)
    if (level <= 10) {
        return 200 + (level * 100);
    }
    
    // 레벨 11~20: 300 + (레벨 x 150)
    if (level <= 20) {
        return 300 + (level * 150);
    }
    
    // 레벨 21~50: 이전 필요경험치 x 1.2
    // 레벨 51~100: 이전 필요경험치 x 1.3
    // 레벨 20의 필요 경험치를 먼저 계산
    let xp = 300 + (20 * 150); // 레벨 20의 필요 경험치
    
    // 레벨 21부터 현재 레벨까지 반복
    for (let l = 21; l <= level; l++) {
        if (l <= 50) {
            xp = Math.round(xp * 1.2);
        } else {
            xp = Math.round(xp * 1.3);
        }
    }
    
    return xp;
};

const processSinglePlayerGameSummary = async (game: LiveGameSession) => {
    // 캐시 무효화 후 DB에서 최신 사용자 조회 (첫 클리어 vs 재도전 판정 정확도)
    db.invalidateUserCache(game.player1.id);
    const freshUser = await db.getUser(game.player1.id);
    if (!freshUser) {
        console.error(`[SP Summary] Could not find user ${game.player1.id} in database`);
        return;
    }
    
    const user = freshUser; // 최신 사용자 데이터 사용
    const isWinner = game.winner === Player.Black; // Human is always black
    
    // 디버깅: 승자 판정 로그
    console.log(`[processSinglePlayerGameSummary] Game ${game.id}: game.winner=${game.winner === Player.Black ? 'Black' : game.winner === Player.White ? 'White' : 'None'}, isWinner=${isWinner}, finalScores=${JSON.stringify(game.finalScores)}`);
    const stages = await getEffectiveSinglePlayerStages();
    const stage = stages.find(s => s.id === game.stageId);

    if (!stage) {
        console.error(`[SP Summary] Could not find stage with id: ${game.stageId}`);
        if (!game.summary) game.summary = {};
        game.summary[user.id] = {
            xp: { initial: user.strategyXp, change: 0, final: user.strategyXp },
            rating: { initial: 1200, change: 0, final: 1200 },
            manner: { initial: user.mannerScore, change: 0, final: user.mannerScore },
            gold: 0,
            items: [],
        };
        return;
    }

    // Initialize with a base structure
    const summary: GameSummary = {
        xp: { initial: user.strategyXp, change: 0, final: user.strategyXp },
        rating: { initial: 1200, change: 0, final: 1200 }, // Not applicable
        manner: { initial: user.mannerScore, change: 0, final: user.mannerScore },
        gold: 0,
        items: [],
    };
    
    const stageIndex = stages.findIndex(s => s.id === stage.id);
    const currentProgress = user.singlePlayerProgress ?? 0;
    
    const reconciledProgress = reconcileSinglePlayerProgress(
        stages,
        user.clearedSinglePlayerStages,
        user.singlePlayerProgress
    );
    if (
        !Array.isArray(user.clearedSinglePlayerStages) ||
        user.clearedSinglePlayerStages.length !== reconciledProgress.effectiveClearedStageIds.length ||
        user.clearedSinglePlayerStages.some((id, index) => id !== reconciledProgress.effectiveClearedStageIds[index])
    ) {
        user.clearedSinglePlayerStages = [...reconciledProgress.effectiveClearedStageIds];
    }
    user.singlePlayerProgress = reconciledProgress.progress;
    
    // 최초 클리어 여부 확인: clearedSinglePlayerStages에 스테이지 ID가 없으면 최초 클리어
    const isFirstClear = !user.clearedSinglePlayerStages.includes(stage.id);
    const isRepeatAttempt = !isFirstClear; // 재도전 여부
    
    console.log(`[SP Summary] Stage ${stage.id} - isFirstClear: ${isFirstClear}, clearedStages: ${JSON.stringify(user.clearedSinglePlayerStages)}`);
    
    if (isWinner) {
        const rewards = isFirstClear 
            ? stage.rewards.firstClear 
            : stage.rewards.repeatClear;
        
        console.log(`[SP Summary] Stage ${stage.id} - isFirstClear: ${isFirstClear}, rewards: gold=${rewards.gold}, exp=${rewards.exp}`);

        // 최초 클리어인 경우 clearedSinglePlayerStages에 추가
        if (isFirstClear) {
            user.clearedSinglePlayerStages.push(stage.id);
            console.log(`[SP Summary] Added stage ${stage.id} to clearedSinglePlayerStages`);
        }
        
        // singlePlayerProgress는 순차 진행 여부를 추적 (다음 스테이지 언락용)
        // 미션 성공 시(남은 턴 0 포함) 항상 다음 단계가 열리도록 Math.max 사용 (캐시/경계 조건 보정)
        const nextProgress = stageIndex + 1;
        if (currentProgress <= stageIndex) {
            user.singlePlayerProgress = Math.max(currentProgress, nextProgress);
            console.log(`[SP Summary] singlePlayerProgress updated: ${currentProgress} -> ${user.singlePlayerProgress} (stage ${stage.id} cleared)`);
        }

        // 골드와 경험치는 항상 지급 (아이템과 독립적)
        const initialXp = user.strategyXp;
        user.gold += rewards.gold;
        user.strategyXp += rewards.exp;
        
        summary.gold = rewards.gold;
        summary.xp = { initial: initialXp, change: rewards.exp, final: user.strategyXp };
        
        console.log(`[SP Summary] Rewards applied - summary.gold=${summary.gold}, summary.xp.change=${summary.xp.change}, user.gold=${user.gold}, user.strategyXp=${user.strategyXp}`);
        
        // 아이템 보상 처리 (입문-1 첫 클리어 부채 포함, 즉시 지급)
        const itemsToCreate = rewards.items?.length ? createItemInstancesFromReward(rewards.items) : [];
        const { success, updatedInventory } = addItemsToInventory([...user.inventory], user.inventorySlots, itemsToCreate);
        
        if (!success) {
            console.error(`[SP Summary] Insufficient inventory space for user ${user.id} on stage ${stage.id}. Items not granted.`);
            summary.items = []; // 아이템은 지급하지 않음
            // Optionally, send items via mail here in the future
        } else {
            // Update inventory with the returned updatedInventory
            user.inventory = updatedInventory;
            summary.items = itemsToCreate;
        }

        // 보너스 스탯 처리
        if (rewards.bonus && rewards.bonus.startsWith('스탯')) {
            const points = parseInt(rewards.bonus.replace('스탯', ''), 10);
            if (!isNaN(points)) {
                user.bonusStatPoints = (user.bonusStatPoints || 0) + points;
                if (!summary.items) summary.items = [];
                summary.items.push({
                    id: `stat-points-${Date.now()}`,
                    name: `보너스 스탯`,
                    image: '/images/icons/stat_point.png',
                    type: 'consumable',
                    grade: 'rare',
                    quantity: points
                } as any);
            }
        }
    } else {
        // 실패시 보상: 재도전이고 기권이 아닌 경우에만 성공 보상의 10% 지급
        const isResign = game.winReason === 'resign';
        
        if (isRepeatAttempt && !isResign && !game.isAiGame) {
            // 재도전 실패 보상: 성공시 보상의 10% (골드, 경험치만)
            const successRewards = stage.rewards.repeatClear;
            
            const failureRewards = {
                gold: Math.round(successRewards.gold * 0.1),
                exp: Math.round(successRewards.exp * 0.1)
            };
            
            console.log(`[SP Summary] Stage ${stage.id} - Failure reward (10% of success): gold=${failureRewards.gold}, exp=${failureRewards.exp}`);
            
            user.gold += failureRewards.gold;
            const initialXp = user.strategyXp;
            user.strategyXp += failureRewards.exp;
            
            summary.gold = failureRewards.gold;
            summary.xp = { initial: initialXp, change: failureRewards.exp, final: user.strategyXp };
            summary.items = [];
        }
    }

    // Always create a summary object, even on loss (with no rewards)
    if (!game.summary) game.summary = {};
    game.summary[user.id] = summary;
    
    console.log(`[SP Summary] Final summary for user ${user.id}:`, JSON.stringify(summary));
    
    // Handle level up logic after potentially adding XP
    let currentLevel = user.strategyLevel;
    let currentXp = user.strategyXp;
    let requiredXp = getXpForLevel(currentLevel);
    while (currentXp >= requiredXp) {
        currentXp -= requiredXp;
        currentLevel++;
        requiredXp = getXpForLevel(currentLevel);
    }
    user.strategyLevel = currentLevel;
    user.strategyXp = currentXp;

    await db.updateUser(user);
    
    // 사용자 업데이트를 클라이언트에 브로드캐스트 (clearedSinglePlayerStages 업데이트 포함)
    // inventory는 크기가 클 수 있으므로 필요한 경우에만 포함
    const { broadcastUserUpdate } = await import('./socket.js');
    const fieldsToUpdate = ['clearedSinglePlayerStages', 'singlePlayerProgress', 'gold', 'strategyXp', 'strategyLevel'];
    // inventory가 실제로 변경된 경우에만 포함 (아이템 보상이 있을 때만)
    if (summary.items && summary.items.length > 0) {
        fieldsToUpdate.push('inventory');
    }
    if (user.onboardingTutorialPhase != null) {
        fieldsToUpdate.push('onboardingTutorialPhase');
    }
    broadcastUserUpdate(user, fieldsToUpdate);
};

const processTowerGameSummary = async (game: LiveGameSession) => {
    // 경험치 누적을 위해 캐시 무효화 후 DB에서 최신 사용자 데이터 조회 (캐시에 0이 들어가 있던 버그 방지)
    db.invalidateUserCache(game.player1.id);
    const freshUser = await db.getUser(game.player1.id);
    if (!freshUser) {
        console.error(`[Tower Summary] Could not find user ${game.player1.id} in database`);
        return;
    }
    
    const user = freshUser; // 최신 사용자 데이터 사용
    const isWinner = game.winner === Player.Black; // Human is always black
    
    // 디버깅: 승자 판정 로그
    console.log(`[processTowerGameSummary] Game ${game.id}: game.winner=${game.winner === Player.Black ? 'Black' : game.winner === Player.White ? 'White' : 'None'}, isWinner=${isWinner}, finalScores=${JSON.stringify(game.finalScores)}`);
    
    const floor = game.towerFloor ?? 1;
    const userTowerFloor = user.towerFloor ?? 0;
    const stage = TOWER_STAGES.find(s => {
        const stageFloor = parseInt(s.id.replace('tower-', ''));
        return stageFloor === floor;
    });

    if (!stage) {
        console.error(`[Tower Summary] Could not find stage for floor: ${floor}`);
        return;
    }

    // Initialize with a base structure (경험치 숫자 보장)
    const initialStrategyXp = Math.max(0, Number(user.strategyXp) || 0);
    const summary: GameSummary = {
        xp: { initial: initialStrategyXp, change: 0, final: initialStrategyXp },
        rating: { initial: 1200, change: 0, final: 1200 }, // Not applicable
        manner: { initial: user.mannerScore, change: 0, final: user.mannerScore },
        gold: 0,
        items: [],
    };
    
    if (isWinner) {
        // 클리어한 층 재도전 여부 확인
        const isCleared = floor <= userTowerFloor;
        const userMonthlyTowerFloor = (user as any).monthlyTowerFloor ?? 0;
        
        // towerFloor 업데이트 (현재 층이 사용자의 최고 층수보다 높으면 업데이트)
        if (floor > userTowerFloor) {
            user.towerFloor = floor;
            user.lastTowerClearTime = Date.now();
            console.log(`[Tower Summary] Updating towerFloor: ${userTowerFloor} -> ${floor}`);
        }
        
        // monthlyTowerFloor 업데이트 (현재 층이 사용자의 월간 최고 층수보다 높으면 업데이트)
        if (floor > userMonthlyTowerFloor) {
            (user as any).monthlyTowerFloor = floor;
            console.log(`[Tower Summary] Updating monthlyTowerFloor: ${userMonthlyTowerFloor} -> ${floor}`);
        }
        
        if (isCleared) {
            // 클리어한 층 재도전 시 보상 없음
            console.log(`[Tower Summary] Floor ${floor} - Already cleared, no reward on retry`);
        } else {
            // 최초 클리어 시에만 보상 지급 (경험치는 반드시 누적: 기존값 + 보상)
            const rewards = stage.rewards.firstClear;
            const initialXp = Number(user.strategyXp) || 0;
            const addedXp = Number(rewards.exp) || 0;
            user.strategyXp = initialXp + addedXp;

            user.gold += rewards.gold;
            summary.gold = rewards.gold;
            summary.xp = { initial: initialXp, change: addedXp, final: user.strategyXp };

            const grantTowerItemsToInventory = (items: InventoryItem[]): InventoryItem[] => {
                if (!items.length) return [];
                const { success, updatedInventory, finalItemsToAdd } = addItemsToInventory(
                    [...user.inventory],
                    user.inventorySlots,
                    items
                );
                if (success) {
                    user.inventory = updatedInventory;
                    return finalItemsToAdd;
                }

                // 도전의 탑 보상은 즉시 인벤토리 수령이 보장되어야 하므로 실패 시 강제 적재(기존 스택 우선).
                const forcedInventory = [...user.inventory];
                for (const incoming of items) {
                    const incomingQty = Math.max(1, incoming.quantity ?? 1);
                    const stack = forcedInventory.find(
                        (it) => it.name === incoming.name && (it.source ?? null) === (incoming.source ?? null)
                    );
                    if (stack) {
                        stack.quantity = Math.max(1, stack.quantity ?? 1) + incomingQty;
                    } else {
                        forcedInventory.push({ ...incoming, quantity: incomingQty });
                    }
                }
                user.inventory = forcedInventory;
                console.warn(
                    `[Tower Summary] addItemsToInventory failed on floor ${floor}; forced insertion applied for guaranteed tower reward.`
                );
                return items.map((it) => ({ ...it, quantity: Math.max(1, it.quantity ?? 1) }));
            };
            
            // 아이템 보상 처리
            if (rewards.items && rewards.items.length > 0) {
                const itemInstances = createItemInstancesFromReward(rewards.items);
                const grantedStageItems = grantTowerItemsToInventory(itemInstances);
                summary.items = [...(summary.items ?? []), ...grantedStageItems];
            }

            // 도전의 탑 전용 아이템 랜덤 드랍 (5%)
            if (Math.random() < 0.05) {
                const towerItems = [
                    { name: '턴 추가', weight: 10, maxOwned: 3 },
                    { name: '미사일', weight: 10, maxOwned: 2 },
                    { name: '히든', weight: 5, maxOwned: 2 },
                    { name: '스캔', weight: 30, maxOwned: 5 },
                    { name: '배치변경', weight: 45, maxOwned: 5 },
                ];
                const { countTowerLobbyInventoryQty } = await import('./modes/towerPlayerHidden.js');
                const availableItems = towerItems.filter((towerItem) => {
                    const currentQuantity = countTowerLobbyInventoryQty(user.inventory, [towerItem.name]);
                    return currentQuantity < towerItem.maxOwned;
                });

                if (availableItems.length > 0) {
                    const totalWeight = availableItems.reduce((sum, item) => sum + item.weight, 0);
                    let random = Math.random() * totalWeight;
                    let selectedItem = availableItems[0];
                    for (const item of availableItems) {
                        random -= item.weight;
                        if (random <= 0) {
                            selectedItem = item;
                            break;
                        }
                    }

                    const towerItemInstance = createConsumableItemInstance(selectedItem.name);
                    if (towerItemInstance) {
                        (towerItemInstance as InventoryItem & { source?: string }).source = 'tower';
                        const grantedTowerDrop = grantTowerItemsToInventory([towerItemInstance]);
                        if (grantedTowerDrop.length > 0) {
                            summary.items = [...(summary.items ?? []), ...grantedTowerDrop];
                            console.log(`[Tower Summary] Floor ${floor} - Tower item dropped (5%): ${selectedItem.name}`);
                        }
                    }
                }
            }
            
            console.log(`[Tower Summary] Floor ${floor} - First clear reward: gold=${rewards.gold}, exp=${rewards.exp}, items=${summary.items?.length || 0}`);
        }
    } else {
        // 실패 시 보상 없음
        console.log(`[Tower Summary] Floor ${floor} - Failed, no reward`);
    }

    // Always create a summary object, even on loss (with no rewards)
    // 보상 지급 후 즉시 summary를 게임에 저장하여 클라이언트가 즉시 표시할 수 있도록 함
    if (!game.summary) game.summary = {};
    game.summary[user.id] = summary;
    
    // summary를 즉시 DB에 저장하여 클라이언트가 0.5초 안에 보상을 확인할 수 있도록 함
    await db.saveGame(game);
    
    // Handle level up logic after potentially adding XP (승리 시에만, 숫자로 확실히 누적값 사용)
    if (isWinner) {
        let currentLevel = Math.max(1, Number(user.strategyLevel) || 1);
        let currentXp = Math.max(0, Number(user.strategyXp) || 0);
        let requiredXp = getXpForLevel(currentLevel);
        while (requiredXp > 0 && currentXp >= requiredXp) {
            currentXp -= requiredXp;
            currentLevel++;
            requiredXp = getXpForLevel(currentLevel);
        }
        user.strategyLevel = currentLevel;
        user.strategyXp = currentXp;
    }

    // towerFloor 또는 monthlyTowerFloor가 업데이트되었거나, 보상이 지급된 경우 DB 저장
    const towerFloorUpdated = isWinner && (floor > userTowerFloor || floor > ((user as any).monthlyTowerFloor ?? 0));
    const hasRewards = (summary.gold ?? 0) > 0 || summary.xp.change > 0 || (summary.items && summary.items.length > 0);
    const levelUpOccurred = user.strategyLevel !== (freshUser.strategyLevel ?? 0);
    
    // towerFloor 업데이트가 있으면 즉시 저장하고 브로드캐스트 (다음 층 도전 버튼 활성화를 위해)
    if (towerFloorUpdated) {
        await db.updateUser(user);
        console.log(`[Tower Summary] User ${user.nickname} towerFloor updated immediately: ${userTowerFloor} -> ${user.towerFloor}, monthlyTowerFloor=${(user as any).monthlyTowerFloor}`);
        
        // towerFloor 업데이트를 즉시 브로드캐스트 (다음 층 도전 버튼 활성화)
        const { broadcastUserUpdate } = await import('./socket.js');
        broadcastUserUpdate(user, ['towerFloor', 'monthlyTowerFloor']);
    }
    
    // 보상이 있으면 즉시 저장하고 브로드캐스트 (지연 방지)
    if (hasRewards) {
        if (!towerFloorUpdated) {
            await db.updateUser(user);
        }
        console.log(`[Tower Summary] User ${user.nickname} rewards saved immediately: gold=${user.gold}, xp=${user.strategyXp}, level=${user.strategyLevel}`);
        
        // 사용자 업데이트를 즉시 브로드캐스트 (보상 지급 확인)
        const { broadcastUserUpdate } = await import('./socket.js');
        const fieldsToUpdate = ['gold', 'diamonds', 'strategyXp', 'strategyLevel', 'inventory'];
        if (!towerFloorUpdated) {
            fieldsToUpdate.push('towerFloor', 'monthlyTowerFloor');
        }
        broadcastUserUpdate(user, fieldsToUpdate);
    }
    
    // 레벨업이 있으면 추가로 저장 (towerFloor나 보상이 없었던 경우)
    if (levelUpOccurred && !towerFloorUpdated && !hasRewards) {
        await db.updateUser(user);
        console.log(`[Tower Summary] User ${user.nickname} level up saved: level=${user.strategyLevel}`);
        
        const { broadcastUserUpdate } = await import('./socket.js');
        broadcastUserUpdate(user, ['strategyLevel', 'strategyXp']);
    }
    
    if (!towerFloorUpdated && !hasRewards && !levelUpOccurred) {
        console.log(`[Tower Summary] No changes to save for user ${user.nickname} (floor ${floor}, already cleared: ${floor <= userTowerFloor})`);
    }
};

export const endGame = async (game: LiveGameSession, winner: Player, winReason: WinReason): Promise<void> => {
    if (game.gameStatus === 'ended' || game.gameStatus === 'no_contest') {
        return; // Game already ended, do nothing
    }
    
    const now = Date.now();
    const gameStartTime = game.gameStartTime || game.createdAt || now;
    const gameDuration = now - gameStartTime;
    const moveCount = game.moveHistory?.filter(m => m.x !== -1 && m.y !== -1).length || 0;
    
    // 조기 종료 조건 확인 (10턴 이내 또는 1분 이내 기권/접속 끊김)
    const isEarlyTermination = (moveCount <= 10 || gameDuration < 60000) && 
                                (winReason === 'resign' || winReason === 'disconnect');
    
    // 비매너 행동자 식별 (조기 종료를 한 사람)
    let badMannerPlayerId: string | null = null;
    if (isEarlyTermination) {
        if (winReason === 'resign') {
            // 기권한 사람이 비매너 행동자
            badMannerPlayerId = winner === Player.Black ? game.whitePlayerId! : game.blackPlayerId!;
        } else if (winReason === 'disconnect') {
            // 접속 끊긴 사람이 비매너 행동자
            const disconnectedPlayerId = game.lastTimeoutPlayerId || 
                                        (winner === Player.Black ? game.whitePlayerId! : game.blackPlayerId!);
            badMannerPlayerId = disconnectedPlayerId;
        }
    }
    
    game.winner = winner;
    game.winReason = winReason;
    game.gameStatus = 'ended';
    
    // 게임 종료 시 disconnectionState 제거 (재접속중 화면 방지)
    game.disconnectionState = null;
    game.disconnectionCounts = {};
    
    // 디버깅: 승자 설정 로그
    console.log(`[endGame] Game ${game.id} ended: winner=${winner === Player.Black ? 'Black' : winner === Player.White ? 'White' : 'None'}, winReason=${winReason}, finalScores=${JSON.stringify(game.finalScores)}`);
    game.isEarlyTermination = isEarlyTermination; // 조기 종료 플래그
    game.badMannerPlayerId = badMannerPlayerId ?? undefined; // 비매너 행동자 ID

    // 도전의 탑 게임 처리는 processTowerGameSummary에서만 수행 (중복 업데이트 방지)
    if (game.gameCategory === 'tower') {
        await processTowerGameSummary(game);
    } else if (game.isSinglePlayer) {
        await processSinglePlayerGameSummary(game);
    } else {
        const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === game.mode);
        const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === game.mode);
        // 정산 스킵 방지: DB/이전 세션에서 statsUpdated만 true이고 summary가 비면 보상이 영구 누락됨
        if (isPlayful || isStrategic) {
            const summaryEmpty =
                !game.summary ||
                (typeof game.summary === 'object' && Object.keys(game.summary as object).length === 0);
            if (game.statsUpdated && summaryEmpty) {
                game.statsUpdated = false;
            }
            if (!game.statsUpdated) {
                await processGameSummary(game);
            }
        }
    }

    const participantIds = [game.player1?.id, game.player2?.id].filter((id): id is string => typeof id === 'string');
    const humanParticipantIds = participantIds.filter((id) => id !== aiUserId);
    const hasAllHumanSummaries = humanParticipantIds.every((id) => !!game.summary?.[id]);
    game.statsUpdated = hasAllHumanSummaries;
    if (!hasAllHumanSummaries) {
        console.warn(
            `[endGame] Summary missing for one or more human players in game ${game.id}. ` +
            `humanIds=${JSON.stringify(humanParticipantIds)}, summaryKeys=${JSON.stringify(Object.keys(game.summary || {}))}`
        );
    }

    try {
        const { applyGuildWarBoardAfterGame } = await import('./guildWarBoardResult.js');
        await applyGuildWarBoardAfterGame(game);
    } catch (e: any) {
        console.error(`[endGame] applyGuildWarBoardAfterGame failed for ${game.id}:`, e?.message);
    }

    await db.saveGame(game);
    
    // summary가 설정된 후 최신 게임 상태를 다시 가져와서 브로드캐스트
    let freshGame = await db.getLiveGame(game.id);
    if (!freshGame) {
        // PVE/타워 등: DB 지연·직렬화 이슈 시에도 메모리 세션으로 계가(analysisResult) 전달
        console.warn(`[endGame] getLiveGame missed ${game.id} after save; broadcasting in-memory session (category=${game.gameCategory})`);
        freshGame = game;
    }
    
    clearAiSession(game.id);
    
    // AI 처리 큐에서도 제거
    if (game.isSinglePlayer) {
        const { aiProcessingQueue } = await import('./aiProcessingQueue.js');
        aiProcessingQueue.dequeue(game.id);
    }
    
    // 조기 종료인 경우 행동력 환불 처리 및 패널티 메일 발송
    // 도전의 탑, 싱글플레이, AI 게임, 친선전에서는 패널티 없음
    const isNoPenaltyGame = game.isSinglePlayer || game.gameCategory === 'tower' || game.isAiGame || !game.isRankedGame;
    if (isEarlyTermination && !isNoPenaltyGame) {
        await refundActionPointsForEarlyTermination(freshGame, badMannerPlayerId);
        if (badMannerPlayerId) {
            await sendBadMannerPenaltyMail(freshGame, badMannerPlayerId);
        }
    }
    
    // 게임 종료 및 분석 결과 브로드캐스트 (게임 참가자에게만 전송, summary 포함)
    const { broadcastToGameParticipants, broadcastLiveGameToList } = await import('./socket.js');
    console.log(`[endGame] Broadcasting game ${freshGame.id} with summary: ${JSON.stringify(freshGame.summary)}`);
    broadcastToGameParticipants(freshGame.id, { type: 'GAME_UPDATE', payload: { [freshGame.id]: freshGame } }, freshGame);
    // PVP 종료 시 진행중인 대국 목록에서 제거되도록 전체에 경량 업데이트
    if (!freshGame.isAiGame) broadcastLiveGameToList(freshGame);
};

// 행동력 환불 함수
const refundActionPointsForEarlyTermination = async (
    game: LiveGameSession, 
    badMannerPlayerId: string | null
): Promise<void> => {
    const { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, STRATEGIC_ACTION_POINT_COST, PLAYFUL_ACTION_POINT_COST } = await import('../constants');
    
    const getActionPointCost = (mode: GameMode): number => {
        if (SPECIAL_GAME_MODES.some(m => m.mode === mode)) {
            return STRATEGIC_ACTION_POINT_COST;
        }
        if (PLAYFUL_GAME_MODES.some(m => m.mode === mode)) {
            return PLAYFUL_ACTION_POINT_COST;
        }
        return STRATEGIC_ACTION_POINT_COST;
    };
    
    const cost = getActionPointCost(game.mode);
    const player1 = await db.getUser(game.player1.id);
    const player2 = await db.getUser(game.player2.id);
    
    if (!player1 || !player2) return;
    
    // 비매너 행동자가 아닌 사람에게만 환불
    if (badMannerPlayerId !== player1.id && !player1.isAdmin) {
        player1.actionPoints.current = Math.min(
            player1.actionPoints.max, 
            player1.actionPoints.current + cost
        );
        player1.lastActionPointUpdate = Date.now();
        await db.updateUser(player1);
    }
    
    if (badMannerPlayerId !== player2.id && !player2.isAdmin) {
        player2.actionPoints.current = Math.min(
            player2.actionPoints.max, 
            player2.actionPoints.current + cost
        );
        player2.lastActionPointUpdate = Date.now();
        await db.updateUser(player2);
    }
    
    // 환불된 사용자에게 브로드캐스트
    const { broadcastUserUpdate } = await import('./socket.js');
    if (badMannerPlayerId !== player1.id) {
        broadcastUserUpdate(player1, ['actionPoints']);
    }
    if (badMannerPlayerId !== player2.id) {
        broadcastUserUpdate(player2, ['actionPoints']);
    }
};

// 패널티 메일 발송 함수
const sendBadMannerPenaltyMail = async (
    game: LiveGameSession,
    badMannerPlayerId: string
): Promise<void> => {
    const badMannerPlayer = await db.getUser(badMannerPlayerId);
    if (!badMannerPlayer) return;
    
    const opponent = game.player1.id === badMannerPlayerId ? 
                     await db.getUser(game.player2.id) : 
                     await db.getUser(game.player1.id);
    
    if (!opponent) return;
    
    const moveCount = game.moveHistory?.filter(m => m.x !== -1 && m.y !== -1).length || 0;
    const gameStartTime = game.gameStartTime || game.createdAt || Date.now();
    const gameDuration = Date.now() - gameStartTime;
    
    let penaltyReason = '';
    if (moveCount <= 10) {
        penaltyReason = `게임 시작 후 10턴 이내에 종료하여`;
    } else if (gameDuration < 60000) {
        penaltyReason = `게임 시작 후 1분 이내에 종료하여`;
    }
    
    if (game.winReason === 'resign') {
        penaltyReason += ' 기권';
    } else if (game.winReason === 'disconnect') {
        penaltyReason += ' 접속 끊김';
    }
    
    const isRanked = game.isRankedGame ?? false;
    const title = isRanked ? '랭킹전 비매너 행동 패널티 안내' : '비매너 행동 패널티 안내';
    const penaltyDescription = isRanked 
        ? `- 랭킹 점수 대폭 하락\n- 매너 점수 감소\n- 행동력 환불 불가 (상대방에게만 환불됨)`
        : `- 매너 점수 감소\n- 행동력 환불 불가 (상대방에게만 환불됨)`;
    
    const penaltyMail: Mail = {
        id: `mail-penalty-${randomUUID()}`,
        from: '시스템',
        title: title,
        message: `안녕하세요, ${badMannerPlayer.nickname}님.\n\n` +
                 `대국 중 비매너 행동으로 인해 패널티가 적용되었습니다.\n\n` +
                 `[패널티 사유]\n` +
                 `${penaltyReason}로 인해 게임이 조기 종료되었습니다.\n\n` +
                 `[적용된 패널티]\n` +
                 `${penaltyDescription}\n\n` +
                 `정상적인 게임 진행을 위해 협조 부탁드립니다.`,
        receivedAt: Date.now(),
        expiresAt: undefined, // 무제한
        isRead: false,
        attachmentsClaimed: false,
    };
    
    if (!badMannerPlayer.mail) {
        badMannerPlayer.mail = [];
    }
    badMannerPlayer.mail.unshift(penaltyMail);
    
    await db.updateUser(badMannerPlayer);
    
    const { broadcastUserUpdate } = await import('./socket.js');
    broadcastUserUpdate(badMannerPlayer, ['mannerScore', 'mail']);
};

/** 상점/DB 보상 등에서 쓰는 영문 키 → 표시용 한글 이름 */
const CONSUMABLE_NAME_ALIASES: Record<string, string> = {
    equipment_box_1: '장비 상자 I',
    equipment_box_2: '장비 상자 II',
    equipment_box_3: '장비 상자 III',
    equipment_box_4: '장비 상자 IV',
    equipment_box_5: '장비 상자 V',
    equipment_box_6: '장비 상자 VI',
    resource_box_1: '재료 상자 I',
    resource_box_2: '재료 상자 II',
    resource_box_3: '재료 상자 III',
    resource_box_4: '재료 상자 IV',
    resource_box_5: '재료 상자 V',
    resource_box_6: '재료 상자 VI',
};

export const createConsumableItemInstance = (name: string, quantity: number = 1): InventoryItem | null => {
    const resolvedName = CONSUMABLE_NAME_ALIASES[name] ?? name;
    const template = CONSUMABLE_ITEMS.find(item => item.name === resolvedName) ?? MATERIAL_ITEMS[resolvedName];
    if (!template) {
        console.error(`[Reward] Consumable item template not found for: ${name}`);
        return null;
    }

    const q = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;

    return {
        ...template,
        id: `item-${randomUUID()}`,
        quantity: q,
        createdAt: Date.now(),
        isEquipped: false,
        level: 1,
        stars: 0,
    };
};

const VIP_EQUIPMENT_BOX_BY_TIER = ['장비 상자 I', '장비 상자 II', '장비 상자 III', '장비 상자 IV'] as const;
const VIP_MATERIAL_BOX_BY_TIER = ['재료 상자 I', '재료 상자 II', '재료 상자 III', '재료 상자 IV'] as const;

export type RewardVipResolvedGrant = {
    goldBonus: number;
    inventoryItem: InventoryItem | null;
    grantedDisplay: { name: string; quantity: number; image?: string };
};

export function rollAndResolveRewardVipPlayGrant(): RewardVipResolvedGrant {
    const outcome = rollVipPlayRewardOutcome();
    if (outcome.type === 'gold') {
        return {
            goldBonus: outcome.amount,
            inventoryItem: null,
            grantedDisplay: {
                name: '골드',
                quantity: outcome.amount,
                image: '/images/icon/Gold.png',
            },
        };
    }
    if (outcome.type === 'legendary_equipment') {
        const item = openGuildGradeBox(ItemGrade.Legendary);
        return {
            goldBonus: 0,
            inventoryItem: item,
            grantedDisplay: {
                name: item.name,
                quantity: 1,
                image: (item as { image?: string }).image,
            },
        };
    }
    const boxName =
        outcome.type === 'equipment_box'
            ? VIP_EQUIPMENT_BOX_BY_TIER[outcome.tier]
            : VIP_MATERIAL_BOX_BY_TIER[outcome.tier];
    const item = createConsumableItemInstance(boxName);
    if (!item) {
        const fb = Math.floor(Math.random() * 901) + 100;
        return {
            goldBonus: fb,
            inventoryItem: null,
            grantedDisplay: { name: '골드', quantity: fb, image: '/images/icon/Gold.png' },
        };
    }
    return {
        goldBonus: 0,
        inventoryItem: item,
        grantedDisplay: {
            name: item.name,
            quantity: item.quantity ?? 1,
            image: (item as { image?: string }).image,
        },
    };
}

// --- START NEW REWARD CONSTANTS ---

const STRATEGIC_GOLD_REWARDS = ADVENTURE_STRATEGIC_WIN_BASE_GOLD_BY_BOARD_SIZE;

// Playful Gold Map
const PLAYFUL_GOLD_REWARDS: Record<number, number> = {
    3: 650, 2: 420, 1: 170,
};

function getPlayfulRoundCount(game: LiveGameSession): number {
    if (game.mode === GameMode.Dice) return Math.max(1, Number(game.settings.diceGoRounds ?? 3));
    if (game.mode === GameMode.Curling) return Math.max(1, Number(game.settings.curlingRounds ?? 3));
    if (game.mode === GameMode.Alkkagi) return Math.max(1, Number(game.settings.alkkagiRounds ?? 1));
    if (game.mode === GameMode.Thief) return 2;
    return 1;
}

function getPlayfulScoreGap(game: LiveGameSession, playerId: string, opponentId: string): number {
    const finalScores = (game.finalScores ?? {}) as Record<string, number | undefined>;
    const fallbackScores = (game.scores ?? {}) as Record<string, number | undefined>;
    const myScore = Number(finalScores[playerId] ?? fallbackScores[playerId] ?? 0);
    const oppScore = Number(finalScores[opponentId] ?? fallbackScores[opponentId] ?? 0);
    return Math.max(0, Math.abs(myScore - oppScore));
}

function getPlayfulRewardMultiplier(
    game: LiveGameSession,
    playerId: string,
    opponentId: string,
    isWinner: boolean,
    isDraw: boolean,
): number {
    if (isDraw) return 1;
    const rounds = getPlayfulRoundCount(game);
    const scoreGap = getPlayfulScoreGap(game, playerId, opponentId);
    // 완만 튜닝: 라운드/점수차 가중 폭을 낮춰 장기전·대승 보상 과증가를 완화
    const roundBonus = Math.min(0.35, Math.max(0, rounds - 1) * 0.12);
    const gapBonus = Math.min(0.28, scoreGap * 0.02);
    const outcomeMultiplier = isWinner ? 1 : 0.78;
    return Math.max(0.5, (1 + roundBonus + gapBonus) * outcomeMultiplier);
}

const getRewardConfig = async (): Promise<RewardConfig> => {
    const stored = await db.getKV<unknown>('rewardConfig');
    return normalizeRewardConfig(stored ?? DEFAULT_REWARD_CONFIG);
};

// --- END NEW REWARD CONSTANTS ---

const calculateGameRewards = (
    game: LiveGameSession, 
    player: User,
    isWinner: boolean, 
    isDraw: boolean,
    itemDropBonus: number,
    materialDropBonus: number,
    rewardMultiplier: number,
    effects: effectService.CalculatedEffects
): { gold: number; items: InventoryItem[]; adventureGoldUnderstandingBonus?: number } => {
    const { mode, settings, isAiGame } = game;

    let baseGold = 0;
    let lootTable: { name: string; chance: number; type: 'equipment' | 'material' }[] = [];
    
    if (SPECIAL_GAME_MODES.some(m => m.mode === mode)) {
        baseGold = STRATEGIC_GOLD_REWARDS[settings.boardSize as keyof typeof STRATEGIC_GOLD_REWARDS] || STRATEGIC_GOLD_REWARDS[19];
        lootTable = STRATEGIC_LOOT_TABLE;
    } else {
        let rounds = 1; // Default for Omok/Ttamok
        if (mode === GameMode.Dice) rounds = settings.diceGoRounds || 3;
        else if (mode === GameMode.Alkkagi) rounds = settings.alkkagiRounds || 1;
        else if (mode === GameMode.Curling) rounds = settings.curlingRounds || 3;
        else if (mode === GameMode.Thief) rounds = 2;

        baseGold = PLAYFUL_GOLD_REWARDS[rounds as keyof typeof PLAYFUL_GOLD_REWARDS] || PLAYFUL_GOLD_REWARDS[1];
        if (rounds === 3) lootTable = PLAYFUL_LOOT_TABLES_BY_ROUNDS[3];
        else if (rounds === 2) lootTable = PLAYFUL_LOOT_TABLES_BY_ROUNDS[2];
        else lootTable = PLAYFUL_LOOT_TABLES_BY_ROUNDS[1];
    }

    // Determine gold multiplier
    const outcomeMultiplier = isWinner ? 1.0 : isDraw ? 0 : 0.25;
    let baseRewardBeforeBuffs = Math.round(baseGold * outcomeMultiplier);

    // Apply AI game penalty (모험 몬스터 대전은 별도 보상 경로에서 처리)
    if (isAiGame && game.gameCategory !== 'adventure') {
        baseRewardBeforeBuffs = Math.round(baseRewardBeforeBuffs * 0.2);
    }
    
    // Apply reward multiplier for all games
    baseRewardBeforeBuffs = Math.round(baseRewardBeforeBuffs * rewardMultiplier);

    // 버프는 모두 "기본 보상 대비 N%" 합연산으로 처리 (버프 간 곱증폭 방지)
    const globalGoldPercent = (effects.goldRewardMultiplier - 1) * 100;
    const winGoldPercent = isWinner ? effects.winGoldBonusPercent : 0;
    const nonAdventureBonusPercent = globalGoldPercent + winGoldPercent;
    let goldReward = Math.max(
        0,
        baseRewardBeforeBuffs + Math.round(baseRewardBeforeBuffs * (nonAdventureBonusPercent / 100)),
    );
    let adventureGoldUnderstandingBonus: number | undefined;
    const advMonsterRewardCtx = isAdventureMonsterBattleRewardContext(game);
    if (isWinner && advMonsterRewardCtx) {
        const { codexOnlyPercent, understandingPercent } = splitAdventureGoldBonusPercents(effects, player.adventureProfile);
        const gearAdventureGoldPct = effects.specialOptionGear?.adventureGoldBonusPercentFromGear ?? 0;
        const adventureBonusPercent = codexOnlyPercent + understandingPercent + gearAdventureGoldPct;
        goldReward = Math.max(
            0,
            baseRewardBeforeBuffs + Math.round(baseRewardBeforeBuffs * (globalGoldPercent + winGoldPercent + adventureBonusPercent) / 100),
        );
        adventureGoldUnderstandingBonus =
            understandingPercent > 0
                ? Math.max(0, Math.round(baseRewardBeforeBuffs * (understandingPercent / 100)))
                : undefined;
    }

    // Determine item drop logic
    const itemsDropped: InventoryItem[] = [];
    const canDropItem =
        (isWinner || !isDraw) &&
        (!isAiGame || (game.gameCategory === 'adventure' && isWinner)); 
    
    if (canDropItem && lootTable.length > 0) {
        const baseDropChanceMultiplier = (isWinner ? 1.0 : 0.5) * rewardMultiplier;
        const advEqDrop = advMonsterRewardCtx ? (effects.adventureUnderstandingEquipmentDropBonusPercent ?? 0) : 0;
        const advMatDrop = advMonsterRewardCtx ? (effects.adventureUnderstandingMaterialDropBonusPercent ?? 0) : 0;
        const advHgEq = advMonsterRewardCtx ? (effects.adventureUnderstandingHighGradeEquipmentBonusPercent ?? 0) : 0;
        const advHgMat = advMonsterRewardCtx ? (effects.adventureUnderstandingHighGradeMaterialBonusPercent ?? 0) : 0;
        const isHighTierEquipmentBox = (name: string) => name.startsWith('장비 상자 ') && !name.endsWith(' I');
        const isHighTierMaterialBox = (name: string) => name.startsWith('재료 상자 ') && !name.endsWith(' I');

        for (const loot of lootTable) {
            const bonus =
                loot.type === 'equipment'
                    ? itemDropBonus + advEqDrop
                    : materialDropBonus + advMatDrop;
            const highTierBonusPercent =
                advMonsterRewardCtx && loot.type === 'equipment' && isHighTierEquipmentBox(loot.name)
                    ? advHgEq
                    : (advMonsterRewardCtx && loot.type === 'material' && isHighTierMaterialBox(loot.name)
                        ? advHgMat
                        : 0);
            const baseChance = loot.chance * baseDropChanceMultiplier;
            const dropMultiplierPercent = (effects.dropChanceMultiplier - 1) * 100;
            const additionalPercent =
                dropMultiplierPercent +
                bonus +
                (isWinner ? effects.winDropBonusPercent : 0) +
                effects.itemDropRateBonus +
                highTierBonusPercent;
            const effectiveChance = baseChance * (1 + additionalPercent / 100);
            
            if (Math.random() * 100 < effectiveChance) {
                const droppedItem = createConsumableItemInstance(loot.name);
                if (droppedItem) itemsDropped.push(droppedItem);
                break; // only one item can be dropped
            }
        }
    }
    
    return {
        gold: goldReward,
        items: itemsDropped,
        ...(adventureGoldUnderstandingBonus != null && adventureGoldUnderstandingBonus > 0
            ? { adventureGoldUnderstandingBonus }
            : {}),
    };
};

function boxTierRomanFromLootName(name: string): number {
    if (name.endsWith(' IV')) return 4;
    if (name.endsWith(' III')) return 3;
    if (name.endsWith(' II')) return 2;
    return 1;
}

/** 모험 몬스터 대국 승리 전용: 골드 + 장비/재료 슬롯 각각 판정 */
function calculateAdventureMonsterBattleRewards(
    game: LiveGameSession,
    itemDropBonus: number,
    materialDropBonus: number,
    rewardMultiplier: number,
    effects: effectService.CalculatedEffects,
    adventureProfile: User['adventureProfile'],
): {
    gold: number;
    items: InventoryItem[];
    adventureRewardSlots: NonNullable<GameSummary['adventureRewardSlots']>;
    understandingGoldBonus: number;
} {
    const level = Math.max(1, Math.min(50, Math.floor(game.adventureMonsterLevel ?? 1)));
    const settings = game.settings;
    const baseGold =
        STRATEGIC_GOLD_REWARDS[settings.boardSize as keyof typeof STRATEGIC_GOLD_REWARDS] || STRATEGIC_GOLD_REWARDS[19];

    const advEqDrop = effects.adventureUnderstandingEquipmentDropBonusPercent ?? 0;
    const advMatDrop = effects.adventureUnderstandingMaterialDropBonusPercent ?? 0;
    const advHgEq = effects.adventureUnderstandingHighGradeEquipmentBonusPercent ?? 0;
    const advHgMat = effects.adventureUnderstandingHighGradeMaterialBonusPercent ?? 0;
    const { codexOnlyPercent, understandingPercent } = splitAdventureGoldBonusPercents(effects, adventureProfile);
    const advStageId = typeof game.adventureStageId === 'string' ? game.adventureStageId : '';
    const regGoldPct = advStageId ? getRegionalWinGoldBonusPercentForStage(adventureProfile, advStageId) : 0;
    const regEqPct = advStageId ? getRegionalEquipmentDropBonusPercentForStage(adventureProfile, advStageId) : 0;
    const regMatPct = advStageId ? getRegionalMaterialDropBonusPercentForStage(adventureProfile, advStageId) : 0;

    const chapterIdx = resolveAdventureChapterIndexForLoot(game.adventureStageId);
    const lootDef = getAdventureChapterDirectLootDefinition(chapterIdx);
    const equipHighGradeBias = new Set<ItemGrade>([
        ItemGrade.Rare,
        ItemGrade.Epic,
        ItemGrade.Legendary,
        ItemGrade.Mythic,
    ]);

    const slotMul = Math.max(0.45, rewardMultiplier);
    const dropExtra = effects.winDropBonusPercent + effects.itemDropRateBonus;

    // 모험 골드는 "기본 보상 + (기본 보상 기준 N% 가산)" 규칙으로 합연산 처리.
    // 버프 간 곱증폭을 피하기 위해 각 항목은 동일한 기준금(baseRewardBeforeBuffs)에만 적용한다.
    let baseRewardBeforeBuffs = Math.round(baseGold * rewardMultiplier);
    baseRewardBeforeBuffs = Math.round(baseRewardBeforeBuffs * adventureMonsterGoldLevelMultiplier(level));
    const isBoss19Board = game.adventureBoardSize === 19;
    if (isBoss19Board) {
        baseRewardBeforeBuffs = Math.round(baseRewardBeforeBuffs * 1.68);
    }
    const globalGoldPercent = (effects.goldRewardMultiplier - 1) * 100;
    const totalBonusPercent =
        globalGoldPercent + effects.winGoldBonusPercent + codexOnlyPercent + understandingPercent + regGoldPct;
    const totalBonusGold = Math.round(baseRewardBeforeBuffs * (totalBonusPercent / 100));
    const goldReward = Math.max(0, baseRewardBeforeBuffs + totalBonusGold);
    const understandingGoldBonus = Math.max(0, Math.round(baseRewardBeforeBuffs * (understandingPercent / 100)));

    const items: InventoryItem[] = [];

    const rollSlot = (
        type: 'equipment' | 'material',
        typeDropBonus: number,
        hgPct: number,
    ): { obtained: boolean; displayName?: string; quantity?: number; grade?: ItemGrade } => {
        const baseAcquire = (0.1 + (level / 50) * 0.48) * (isBoss19Board ? 1.35 : 1);
        const acquireChance = Math.min(
            0.9,
            baseAcquire * (1 + (typeDropBonus + dropExtra) / 100) * slotMul,
        );
        if (Math.random() >= acquireChance) {
            return { obtained: false };
        }
        const bossHgMul = isBoss19Board ? 1.32 : 1;
        if (type === 'equipment') {
            const gradeRows = lootDef.equipmentGrades.map(({ grade, weight }) => {
                let w = weight;
                if (equipHighGradeBias.has(grade)) {
                    w *= (1 + hgPct / 100) * bossHgMul;
                }
                return { grade, weight: w };
            });
            const eq = rollRandomEquipmentFromGradeWeights(gradeRows);
            items.push(eq);
            return { obtained: true, displayName: eq.name, grade: eq.grade };
        }
        const matRows = lootDef.materials.map(({ name, weight }) => {
            let w = weight;
            if (name !== '하급 강화석') {
                w *= (1 + hgPct / 100) * bossHgMul;
            }
            return { name, weight: w };
        });
        const weightSum = matRows.reduce((a, b) => a + b.weight, 0);
        if (weightSum <= 0) {
            return { obtained: false };
        }
        let r = Math.random() * weightSum;
        let pickedName = matRows[matRows.length - 1]!.name;
        for (const row of matRows) {
            r -= row.weight;
            if (r <= 0) {
                pickedName = row.name;
                break;
            }
        }
        const qty = rollAdventureEnhancementStoneQuantity(pickedName, isBoss19Board);
        const inst = createConsumableItemInstance(pickedName, qty);
        if (!inst) {
            return { obtained: false };
        }
        items.push(inst);
        return { obtained: true, displayName: pickedName, quantity: inst.quantity };
    };

    const equipmentSlot = rollSlot('equipment', itemDropBonus + advEqDrop + regEqPct, advHgEq);
    const materialSlot = rollSlot('material', materialDropBonus + advMatDrop + regMatPct, advHgMat);

    return {
        gold: goldReward,
        items,
        understandingGoldBonus,
        adventureRewardSlots: {
            gold: {
                obtained: true,
                amount: goldReward,
                ...(understandingGoldBonus > 0 ? { understandingBonus: understandingGoldBonus } : {}),
            },
            equipment: {
                obtained: equipmentSlot.obtained,
                displayName: equipmentSlot.displayName,
                ...(equipmentSlot.obtained && equipmentSlot.grade != null ? { grade: equipmentSlot.grade } : {}),
            },
            material: {
                obtained: materialSlot.obtained,
                displayName: materialSlot.displayName,
                ...(materialSlot.obtained && materialSlot.quantity != null ? { quantity: materialSlot.quantity } : {}),
            },
        },
    };
}


export const calculateEloChange = (playerRating: number, opponentRating: number, result: 'win' | 'loss' | 'draw'): number => {
    const K = 32;
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    const actualScore = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
    const ratingChange = K * (actualScore - expectedScore);
    return Math.round(ratingChange);
};

const processPlayerSummary = async (
    player: User,
    opponent: User,
    isWinner: boolean,
    isDraw: boolean,
    game: LiveGameSession,
    isNoContest: boolean,
    isInitiator: boolean
): Promise<{ summary: GameSummary; updatedPlayer: User }> => {
    
    const updatedPlayer: User = JSON.parse(JSON.stringify(player)); // Create a deep mutable copy
    const { mode, winReason, isAiGame } = game;

    const isGuildWarMatch = !isNoContest && isGuildWarLiveSession(game as any);
    let guildWarStars: number | undefined;
    if (isGuildWarMatch) {
        const humanEnum = player.id === game.blackPlayerId ? Player.Black : Player.White;
        guildWarStars = computeGuildWarAttemptMetrics(game, humanEnum, isWinner).stars;
    }

    // --- XP and Level ---
    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === mode);
    const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === mode);
    /** 기권한 쪽만 완주 실패 처리 — 상대(승자)는 놀이바둑도 골드·경험치 정상 지급 */
    const isPlayfulResignLoser = isPlayful && winReason === 'resign' && !isWinner;
    const initialLevel = isStrategic ? updatedPlayer.strategyLevel : updatedPlayer.playfulLevel;
    const opponentLevel = isStrategic ? opponent.strategyLevel : opponent.playfulLevel;
    const initialXp = isStrategic ? updatedPlayer.strategyXp : updatedPlayer.playfulXp;
    const isAdventureGame = game.gameCategory === 'adventure';
    const adventureBoardSize = game.adventureBoardSize ?? game.settings.boardSize;
    const isStrategicLobbyAi = !isNoContest && isWaitingRoomAiGame(game) && isStrategic;

    let xpGain = isNoContest ? 0 : (isWinner ? 100 : (isDraw ? 0 : 25)); // Strategic defaults
    if (!isNoContest && isPlayful) {
        // 놀이바둑은 시간/수순 길이와 무관한 고정 경험치 (승패 차이를 크게 유지)
        xpGain = isWinner ? 90 : (isDraw ? 0 : 18);
    }
    // 모험은 `isWaitingRoomAiGame`에서 제외되지만, 분기 순서상 모험을 먼저 고정해 대기실 AI EXP와 겹치지 않게 한다.
    if (!isNoContest && isAdventureGame) {
        if (isWinner) {
            xpGain = getAdventureBaseStrategyXp(adventureBoardSize) + getAdventureMonsterLevelXpBonus(game.adventureMonsterLevel);
        } else {
            xpGain = 0;
        }
    } else if (!isNoContest && isStrategicLobbyAi) {
        xpGain = isWinner ? strategicLobbyAiWinXp(game.settings.boardSize, game.settings.scoringTurnLimit) : 0;
    }

    // Apply AI game penalty (모험·전략 대기실 AI는 별도 처리)
    if (isAiGame && !isAdventureGame && !isStrategicLobbyAi) {
        xpGain = Math.round(xpGain * 0.2);
    }

    // Level difference multiplier
    if (!isAdventureGame && !isStrategicLobbyAi && isStrategic) {
        const levelDiff = opponentLevel - initialLevel;
        let levelMultiplier = 1 + (levelDiff * 0.1); // 10% per level difference
        levelMultiplier = Math.max(0.5, Math.min(1.5, levelMultiplier)); // Cap between 50% and 150%
        xpGain = Math.round(xpGain * levelMultiplier);
    }

    const effects = effectService.calculateUserEffects(updatedPlayer);

    const xpBonusPercent = isStrategic 
        ? effects.specialStatBonuses[SpecialStat.StrategyXpBonus].percent 
        : effects.specialStatBonuses[SpecialStat.PlayfulXpBonus].percent;

    if (xpBonusPercent > 0) {
        xpGain = Math.round(xpGain * (1 + xpBonusPercent / 100));
    }

    // --- Reward Multiplier ---
    let rewardMultiplier = 1.0;
    if (isAdventureGame) {
        rewardMultiplier = 1.0;
    } else if (isStrategic && !isNoContest && !isStrategicLobbyAi) {
        // Base move count for 100% reward, scaled by board size. 19x19 is 100 moves.
        const baseMoveCount = Math.round(100 * Math.pow(game.settings.boardSize / 19, 2));
        const actualMoveCount = game.moveHistory.length;
        
        // Calculate the reward multiplier, capped at 100%
        rewardMultiplier = Math.min(1, actualMoveCount / baseMoveCount);
    } else if (isPlayful && !isNoContest) {
        // 시간 기반 보상 제거: 라운드 수/점수차/승패로 보상 배율 결정
        rewardMultiplier = getPlayfulRewardMultiplier(game, player.id, opponent.id, isWinner, isDraw);
    }
    
    // Apply the multiplier to XP (전략 대기실 AI는 모험 기본 EXP 고정)
    if (!isStrategicLobbyAi) {
        xpGain = Math.round(xpGain * rewardMultiplier);
    }
    // 랭킹전이 아닌 PVP(전략바둑·놀이바둑 친선전)에서는 경험치도 25%로 감소
    if (!isNoContest && !game.isRankedGame && !isAiGame && (isStrategic || isPlayful)) {
        xpGain = Math.round(xpGain * 0.25);
    }
    // 길드 전쟁: 별 0개(실패)면 경험치 없음
    if (isGuildWarMatch && guildWarStars === 0) {
        xpGain = 0;
    }
    // 대기실 AI 대국: 난이도 단계별 보상 — 놀이바둑 AI만 (전략 AI는 위에서 고정)
    if (!isNoContest && isWaitingRoomAiGame(game) && !isGuildWarMatch && !isStrategicLobbyAi) {
        const step = resolveAiLobbyProfileStepFromSettings(game.settings as any);
        const tierMul = aiLobbyRewardMultiplierFromProfileStep(step);
        xpGain = Math.round(xpGain * tierMul);
    }
    // 놀이바둑에서 기권한 플레이어만 경험치 없음(승자는 지급)
    if (isPlayfulResignLoser) {
        xpGain = 0;
    }
    // 모험 몬스터 대전에서 패배한 유저는 전략 경험치·보상 경로가 얽여도 0으로 고정
    if (!isNoContest && !isDraw && isAdventureGame && player.id !== aiUserId && !isWinner) {
        xpGain = 0;
    }
    // --- END NEW LOGIC ---

    let currentXp = initialXp + xpGain;
    let currentLevel = initialLevel;
    const requiredXpForInitialLevel = getXpForLevel(currentLevel);

    let requiredXpForCurrentLevel = requiredXpForInitialLevel;
    while (currentXp >= requiredXpForCurrentLevel) {
        currentXp -= requiredXpForCurrentLevel;
        currentLevel++;
        requiredXpForCurrentLevel = getXpForLevel(currentLevel);
    }
    
    const xpSummary: StatChange = { initial: initialXp, change: xpGain, final: currentXp };
    const levelSummary = {
        initial: initialLevel,
        final: currentLevel,
        progress: { 
            initial: initialXp, 
            final: currentXp, 
            max: requiredXpForInitialLevel 
        }
    };

    if (isStrategic) {
        updatedPlayer.strategyLevel = currentLevel;
        updatedPlayer.strategyXp = currentXp;
    } else {
        updatedPlayer.playfulLevel = currentLevel;
        updatedPlayer.playfulXp = currentXp;
    }

    // --- Rating ---
    if (!updatedPlayer.stats) updatedPlayer.stats = {};
    const gameStats = updatedPlayer.stats[mode] ?? { wins: 0, losses: 0, rankingScore: 1200 };
    
    const initialRating = gameStats.rankingScore ?? 1200;
    const opponentStats = opponent.stats?.[mode] ?? { wins: 0, losses: 0, rankingScore: 1200 };
    const opponentRating = opponent.id === aiUserId ? (initialRating - 50 + Math.random() * 100) : (opponentStats.rankingScore ?? 1200);
    
    let ratingChange = 0;
    // 랭킹전이 아니면 랭킹 점수 변동 없음 (친선전)
    if (game.isRankedGame && !isNoContest && !isAiGame) {
        // 랭킹전에서 조기 종료 시 대폭 하락
        const isRankedEarlyTermination = game.isEarlyTermination && game.badMannerPlayerId === player.id;
        if (isRankedEarlyTermination) {
            ratingChange = -100; // 랭킹전 조기 종료 시 -100점 하락
        } else {
            const result = isWinner ? 'win' : isDraw ? 'draw' : 'loss';
            ratingChange = calculateEloChange(initialRating, opponentRating, result);
            
            // 클래식바둑 특별 처리: 승리시 2배, 패배시 절반
            if (mode === GameMode.Standard) {
                if (isWinner) {
                    ratingChange = ratingChange * 2;
                } else if (!isDraw) {
                    ratingChange = Math.round(ratingChange / 2);
                }
            }
        }
    }
    
    gameStats.rankingScore = Math.max(0, initialRating + ratingChange);
    const ratingSummary: StatChange = { initial: initialRating, change: ratingChange, final: gameStats.rankingScore };
    
    // --- Manner Score ---
    const isDisconnectLoss = winReason === 'disconnect' && !isWinner && !isDraw;
    const mannerChangeFromActions = game.mannerScoreChanges?.[player.id] || 0;
    const initialMannerBeforeGame = player.mannerScore - mannerChangeFromActions;

    let mannerChangeFromGameEnd = 0;
    // 랭킹전에서 조기 종료 시 추가 매너 점수 하락
    const isRankedEarlyTermination = game.isRankedGame && game.isEarlyTermination && game.badMannerPlayerId === player.id;
    if (isRankedEarlyTermination) {
        mannerChangeFromGameEnd = -50; // 랭킹전 조기 종료 시 더 큰 패널티
    } else if (isDisconnectLoss) {
        mannerChangeFromGameEnd = -20;
    } else if (!isNoContest) {
        // mannerChangeFromGameEnd = 2; // +2 for completing a game (win, loss, or draw)
    }

    const finalMannerScore = player.mannerScore + mannerChangeFromGameEnd;
    updatedPlayer.mannerScore = Math.max(0, finalMannerScore);
    
    const totalMannerChange = mannerChangeFromActions + mannerChangeFromGameEnd;

    const mannerSummary: StatChange = {
        initial: initialMannerBeforeGame,
        change: totalMannerChange,
        final: updatedPlayer.mannerScore
    };

    await mannerService.applyMannerRankChange(updatedPlayer, initialMannerBeforeGame);

    // --- Wins/Losses ---
    if (!isNoContest) {
        if (isWinner) gameStats.wins++;
        else if (!isDraw) gameStats.losses++;
    }
    
    updatedPlayer.stats[mode] = gameStats;
    
    // --- Update cumulativeRankingScore for strategic/playful modes ---
    if (!isNoContest && !isAiGame) {
        if (!updatedPlayer.cumulativeRankingScore) {
            updatedPlayer.cumulativeRankingScore = {};
        }
        
        const ELO_BASE_SCORE = 1200; // ELO 기준 점수
        
        if (isStrategic) {
            // 전략바둑: 모든 전략바둑 모드의 rankingScore 평균 계산 후 1200에서의 차이를 저장
            let totalScore = 0;
            let modeCount = 0;
            for (const strategicMode of SPECIAL_GAME_MODES) {
                const modeStats = updatedPlayer.stats?.[strategicMode.mode];
                if (modeStats && modeStats.rankingScore !== undefined) {
                    totalScore += modeStats.rankingScore;
                    modeCount++;
                }
            }
            if (modeCount > 0) {
                const averageScore = Math.round(totalScore / modeCount);
                // 1200에서의 차이를 저장 (예: 826점이면 -374점)
                updatedPlayer.cumulativeRankingScore['standard'] = averageScore - ELO_BASE_SCORE;
            }
        } else if (isPlayful) {
            // 놀이바둑: 모든 놀이바둑 모드의 rankingScore 평균 계산 후 1200에서의 차이를 저장
            let totalScore = 0;
            let modeCount = 0;
            for (const playfulMode of PLAYFUL_GAME_MODES) {
                const modeStats = updatedPlayer.stats?.[playfulMode.mode];
                if (modeStats && modeStats.rankingScore !== undefined) {
                    totalScore += modeStats.rankingScore;
                    modeCount++;
                }
            }
            if (modeCount > 0) {
                const averageScore = Math.round(totalScore / modeCount);
                // 1200에서의 차이를 저장 (예: 826점이면 -374점)
                updatedPlayer.cumulativeRankingScore['playful'] = averageScore - ELO_BASE_SCORE;
            }
        }
    }
    
    // Apply rewards
    const itemDropBonus = 0;
    const materialDropBonus = 0;

    const resolvedAdventureBattleMode = resolveAdventureMonsterBattleModeForSummary(game);
    const isAdventureWin =
        !isNoContest &&
        !isDraw &&
        isWinner &&
        player.id !== aiUserId &&
        game.gameCategory === 'adventure' &&
        typeof game.adventureMonsterCodexId === 'string' &&
        typeof game.adventureStageId === 'string' &&
        resolvedAdventureBattleMode != null;

    const isAdventureLoss =
        !isNoContest &&
        !isDraw &&
        !isWinner &&
        player.id !== aiUserId &&
        game.gameCategory === 'adventure' &&
        typeof game.adventureMonsterCodexId === 'string' &&
        typeof game.adventureStageId === 'string';

    if (isAdventureLoss) {
        applyAdventureMonsterMapSuppressAfterPlayerLoss(updatedPlayer, {
            codexId: game.adventureMonsterCodexId!,
            stageId: game.adventureStageId!,
        });
    }

    let adventureRewardSlots: GameSummary['adventureRewardSlots'];
    let adventureCodexDelta: GameSummary['adventureCodexDelta'];
    let adventureUnderstandingDelta: GameSummary['adventureUnderstandingDelta'];

    const rewardConfig = await getRewardConfig();
    let rewards: { gold: number; diamonds: number; items: InventoryItem[]; adventureGoldUnderstandingBonus?: number };
    if (isNoContest) {
        rewards = { gold: 0, diamonds: 0, items: [] };
    } else if (isAdventureWin) {
        const advCodexId = game.adventureMonsterCodexId!;
        const advStageId = game.adventureStageId!;
        const prevProf = normalizeAdventureProfile(updatedPlayer.adventureProfile);
        const winsBefore = Math.max(0, Math.floor((prevProf.codexDefeatCounts ?? {})[advCodexId] ?? 0));
        adventureCodexDelta = { codexId: advCodexId, winsBefore, winsAfter: winsBefore + 1 };
        const xpBefore = Math.max(0, Math.floor((prevProf.understandingXpByStage ?? {})[advStageId] ?? 0));
        await applyAdventureMonsterDefeatToProfile(updatedPlayer, {
            codexId: advCodexId,
            stageId: advStageId,
            battleMode: resolvedAdventureBattleMode!,
        });
        const nextProf = normalizeAdventureProfile(updatedPlayer.adventureProfile);
        const xpAfter = Math.max(0, Math.floor((nextProf.understandingXpByStage ?? {})[advStageId] ?? 0));
        adventureUnderstandingDelta = { stageId: advStageId, xpBefore, xpAfter };
        // 도감·지역 이해도 반영 후 이펙트 재계산 — 골드% 분리(split)와 드롭 보너스가 갱신 프로필과 일치해야 함
        const effectsAfterAdventure = effectService.calculateUserEffects(updatedPlayer);
        const advR = calculateAdventureMonsterBattleRewards(
            game,
            itemDropBonus,
            materialDropBonus,
            rewardMultiplier,
            effectsAfterAdventure,
            updatedPlayer.adventureProfile,
        );
        rewards = {
            gold: advR.gold,
            diamonds: 0,
            items: advR.items,
            ...(advR.understandingGoldBonus > 0 ? { adventureGoldUnderstandingBonus: advR.understandingGoldBonus } : {}),
        };
        adventureRewardSlots = {
            ...advR.adventureRewardSlots,
            keyFragment: {
                obtained: true,
                amount: isAdventureChapterBossCodexId(advCodexId) ? 2 : 1,
            },
        };
    } else {
        const baseRewards = calculateGameRewards(game, updatedPlayer, isWinner, isDraw, itemDropBonus, materialDropBonus, rewardMultiplier, effects);
        rewards = {
            ...baseRewards,
            diamonds: 0,
        };
        if (isAdventureLoss && typeof game.adventureMonsterCodexId === 'string') {
            const advCodexId = game.adventureMonsterCodexId;
            const prevProf = normalizeAdventureProfile(updatedPlayer.adventureProfile);
            const wins = Math.max(0, Math.floor((prevProf.codexDefeatCounts ?? {})[advCodexId] ?? 0));
            adventureCodexDelta = { codexId: advCodexId, winsBefore: wins, winsAfter: wins };
        }
    }

    if (isGuildWarMatch) {
        const stars = guildWarStars ?? 0;
        const demo = !!(game as any).isDemo;
        rewards = {
            gold: demo ? 0 : getGuildWarMatchGoldReward(game.mode, stars),
            diamonds: 0,
            items: [],
        };
    }

    if (!isNoContest && isWaitingRoomAiGame(game) && !isGuildWarMatch && !isStrategicLobbyAi) {
        const step = resolveAiLobbyProfileStepFromSettings(game.settings as any);
        const tierMul = aiLobbyRewardMultiplierFromProfileStep(step);
        rewards.gold = Math.round(rewards.gold * tierMul);
        if (rewards.adventureGoldUnderstandingBonus != null) {
            rewards.adventureGoldUnderstandingBonus = Math.round(rewards.adventureGoldUnderstandingBonus * tierMul);
        }
    }

    // 랭킹전(PVP)은 상대 레이팅 기준으로 보상을 차등 적용
    const isRankedSkillRewardContext =
        game.isRankedGame &&
        !isNoContest &&
        !isAiGame &&
        !game.isSinglePlayer &&
        !isGuildWarMatch &&
        (isStrategic || isPlayful);
    if (isRankedSkillRewardContext && ENABLE_PVP_SKILL_REWARD_MULTIPLIER) {
        const skillMul = getPvpSkillRewardMultiplier(initialRating, opponentRating, isWinner);
        rewards.gold = Math.round(rewards.gold * skillMul);
        rewards.diamonds = Math.round((rewards.diamonds || 0) * skillMul);
        if (rewards.adventureGoldUnderstandingBonus != null) {
            rewards.adventureGoldUnderstandingBonus = Math.round(rewards.adventureGoldUnderstandingBonus * skillMul);
        }
    }

    // 랭킹전 매칭이 아닌 PVP(전략바둑·놀이바둑 친선전)에서는 보상을 25%로 감소. 랭킹전만 100% 보상.
    if (!isNoContest && !game.isRankedGame && !isAiGame) {
        rewards.gold = Math.round(rewards.gold * 0.25);
        if (rewards.adventureGoldUnderstandingBonus != null) {
            rewards.adventureGoldUnderstandingBonus = Math.round(rewards.adventureGoldUnderstandingBonus * 0.25);
        }
    }

    // 전략/놀이 PVP 경기 재화 추가 수치 (관리자 보상 설정)
    const isPvpRewardTarget =
        !isNoContest &&
        !isAiGame &&
        !game.isSinglePlayer &&
        game.gameCategory !== 'tower' &&
        game.gameCategory !== 'adventure' &&
        (isStrategic || isPlayful);
    if (isPvpRewardTarget && !isDraw) {
        if (isStrategic) {
            rewards.gold += isWinner ? rewardConfig.pvpStrategicWinGoldBonus : rewardConfig.pvpStrategicLossGoldBonus;
            rewards.diamonds += isWinner
                ? rewardConfig.pvpStrategicWinDiamondBonus
                : rewardConfig.pvpStrategicLossDiamondBonus;
        } else if (isPlayful) {
            rewards.gold += isWinner ? rewardConfig.pvpPlayfulWinGoldBonus : rewardConfig.pvpPlayfulLossGoldBonus;
            rewards.diamonds += isWinner
                ? rewardConfig.pvpPlayfulWinDiamondBonus
                : rewardConfig.pvpPlayfulLossDiamondBonus;
        }
        rewards.gold = Math.max(0, Math.floor(rewards.gold));
        rewards.diamonds = Math.max(0, Math.floor(rewards.diamonds));
    }

    // PVP 게임에서 변경권 획득 로직 (전략바둑, 놀이바둑 PVP 모드만)
    if (!isNoContest && !isAiGame && !game.isSinglePlayer && game.gameCategory !== 'tower') {
        const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === game.mode);
        const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === game.mode);
        
        if (isStrategic || isPlayful) {
            // 승리: 30% 확률, 패배: 5% 확률
            const dropChance = isWinner ? 0.3 : 0.05;
            if (Math.random() < dropChance) {
                // 획득 확정 시: 수치 변경권(60%), 종류 변경권(25%), 신화 변경권(15%)
                const ticketRandom = Math.random();
                let ticketName: string;
                if (ticketRandom < 0.6) {
                    ticketName = '옵션 수치 변경권';
                } else if (ticketRandom < 0.85) {
                    ticketName = '옵션 종류 변경권';
                } else {
                    ticketName = '스페셜 옵션 변경권';
                }
                
                const ticketItem = createConsumableItemInstance(ticketName);
                if (ticketItem) {
                    rewards.items.push(ticketItem);
                    console.log(`[PVP Reward] User ${updatedPlayer.nickname} acquired ${ticketName} from ${isWinner ? 'win' : 'loss'}`);
                }
            }
        }
    }

    const qualifiesVipPlayRewardSurface =
        player.id !== aiUserId &&
        !isNoContest &&
        (game.gameCategory as string) !== 'tower' &&
        (game.gameCategory as string) !== 'singleplayer' &&
        !game.isSinglePlayer &&
        (isAdventureGame || isStrategic || isPlayful || isGuildWarMatch);

    const vipWinEligible =
        qualifiesVipPlayRewardSurface &&
        !isPlayfulResignLoser &&
        isWinner &&
        !isDraw &&
        (!isAdventureGame || isAdventureWin);

    if (isStrategicLobbyAi && player.id !== aiUserId) {
        rewards.gold = 0;
        rewards.diamonds = 0;
        rewards.items = [];
        delete rewards.adventureGoldUnderstandingBonus;
    }
    // 놀이바둑에서 기권한 플레이어만 재화/아이템 없음(승자는 지급)
    if (isPlayfulResignLoser) {
        rewards.gold = 0;
        rewards.diamonds = 0;
        rewards.items = [];
        delete rewards.adventureGoldUnderstandingBonus;
    }

    let vipGoldBonus = 0;
    let vipGrant: InventoryItem | null = null;
    let vipGrantedDisplay: { name: string; quantity: number; image?: string } | undefined;
    if (vipWinEligible && isRewardVipActive(updatedPlayer)) {
        const vip = rollAndResolveRewardVipPlayGrant();
        vipGoldBonus = vip.goldBonus;
        vipGrant = vip.inventoryItem;
        vipGrantedDisplay = vip.grantedDisplay;
    }

    // 모험 패배: 일반 대국 보상 경로에서 붙은 골드·아이템·VIP 보너스는 지급하지 않음(기권패 등)
    const stripAdventureHumanLossRewards =
        !isNoContest && !isDraw && isAdventureGame && player.id !== aiUserId && !isWinner;
    if (stripAdventureHumanLossRewards) {
        rewards.gold = 0;
        rewards.diamonds = 0;
        rewards.items = [];
        delete rewards.adventureGoldUnderstandingBonus;
        vipGoldBonus = 0;
        vipGrant = null;
        vipGrantedDisplay = undefined;
    }

    const itemsForInventory = [...rewards.items, ...(vipGrant ? [vipGrant] : [])];

    updatedPlayer.gold += rewards.gold + vipGoldBonus;
    if (rewards.diamonds > 0) {
        updatedPlayer.diamonds += rewards.diamonds;
    }

    // Add dropped items to inventory
    let vipInventoryItemGranted = false;
    if (itemsForInventory.length > 0) {
        const { success, updatedInventory } = addItemsToInventory(updatedPlayer.inventory, updatedPlayer.inventorySlots, itemsForInventory);
        if (success) {
            // Update inventory with the returned updatedInventory (includes stacked items)
            updatedPlayer.inventory = updatedInventory;
            await guildService.recordGuildEpicPlusEquipmentAcquisition(updatedPlayer, itemsForInventory);
            vipInventoryItemGranted = !!vipGrant;
        } else {
            console.error(`[Summary] Insufficient inventory space for user ${updatedPlayer.id}. Items not granted.`);
            // VIP 보상은 결과창 표시와 실제 지급이 불일치하면 안 되므로, 최소한 VIP 아이템은 강제 적재한다.
            if (vipGrant) {
                const vipQty = Math.max(1, vipGrant.quantity ?? 1);
                const forcedInventory = [...updatedPlayer.inventory];
                const stack = forcedInventory.find(
                    (it) => it.name === vipGrant.name && (it.source ?? null) === (vipGrant.source ?? null)
                );
                if (stack) {
                    stack.quantity = Math.max(1, stack.quantity ?? 1) + vipQty;
                } else {
                    forcedInventory.push({ ...vipGrant, quantity: vipQty });
                }
                updatedPlayer.inventory = forcedInventory;
                vipInventoryItemGranted = true;
                await guildService.recordGuildEpicPlusEquipmentAcquisition(updatedPlayer, [vipGrant]);
                console.warn(
                    `[Summary] addItemsToInventory failed for ${updatedPlayer.id}; forced VIP reward insertion applied.`
                );
            }
        }
    }
    
    // Update Quests: 대기실 AI 대국도 전략/놀이 플레이·승리 퀘스트에 반영 (싱글·타워·싱글플레이 카테고리는 제외)
    if (!isNoContest) {
        const isPveQuestExempt =
            !!game.isSinglePlayer ||
            game.gameCategory === 'tower' ||
            (game.gameCategory as string) === 'singleplayer';

        const questCtx = { gameCategory: game.gameCategory as string | undefined };
        if (!isPveQuestExempt) {
            updateQuestProgress(updatedPlayer, 'participate', mode, 1, questCtx);
            if (isWinner) {
                updateQuestProgress(updatedPlayer, 'win', mode, 1, questCtx);
            }
        }
        if (isPvpRewardTarget && !liveSessionHasChampionshipDungeonBot(game)) {
            updateQuestProgress(updatedPlayer, 'pvp_participate', mode, 1, questCtx);
        }
        if (isWinner && game.gameCategory === 'adventure') {
            updateQuestProgress(updatedPlayer, 'adventure_win', undefined, 1);
        }

        if (liveSessionHasChampionshipDungeonBot(game)) {
            updateQuestProgress(updatedPlayer, 'championship_play', undefined, 1);
        }
    }

    // 길드 주간 임무: 전략/놀이 승리 (일일 퀘스트와 동일하게 대기실 AI·일반 대국 포함, 싱글·타워·싱글플레이 제외)
    const isPveGuildMissionExempt =
        !!game.isSinglePlayer ||
        game.gameCategory === 'tower' ||
        (game.gameCategory as string) === 'singleplayer';

    if (!isNoContest && isWinner && updatedPlayer.guildId && !isPveGuildMissionExempt) {
        const guilds = await db.getKV<Record<string, any>>('guilds') || {};
        if (isStrategic) {
            await guildService.updateGuildMissionProgress(updatedPlayer.guildId, 'strategicWins', 1, guilds);
        } else if (isPlayful) {
            await guildService.updateGuildMissionProgress(updatedPlayer.guildId, 'playfulWins', 1, guilds);
        }
    }

    // 모험 패배/무승부 등: 결과 모달에서 골드·장비·재료 슬롯을 항상 그리기 위해 연출용 슬롯 부여
    if (
        !isNoContest &&
        game.gameCategory === 'adventure' &&
        player.id !== aiUserId &&
        typeof game.adventureMonsterCodexId === 'string' &&
        !adventureRewardSlots
    ) {
        adventureRewardSlots = {
            gold: { obtained: false, amount: 0 },
            keyFragment: { obtained: false, amount: 0 },
            equipment: { obtained: false },
            material: { obtained: false },
        };
    }

    if (adventureRewardSlots) {
        adventureRewardSlots = {
            ...adventureRewardSlots,
            gold: {
                obtained: adventureRewardSlots.gold.obtained,
                amount: rewards.gold,
                ...(rewards.adventureGoldUnderstandingBonus != null && rewards.adventureGoldUnderstandingBonus > 0
                    ? { understandingBonus: rewards.adventureGoldUnderstandingBonus }
                    : {}),
            },
        };
    }

    const summary: GameSummary = {
        xp: xpSummary,
        rating: ratingSummary,
        manner: mannerSummary,
        mannerActionChange: mannerChangeFromActions,
        overallRecord: {
            wins: gameStats.wins,
            losses: gameStats.losses,
        },
        gold: rewards.gold + vipGoldBonus,
        matchGold: rewards.gold,
        ...(vipGoldBonus > 0 ? { vipGoldBonus } : {}),
        diamonds: rewards.diamonds,
        items: rewards.items,
        level: levelSummary,
        ...(guildWarStars !== undefined ? { guildWarStars } : {}),
        ...(adventureRewardSlots ? { adventureRewardSlots } : {}),
        ...(adventureCodexDelta ? { adventureCodexDelta } : {}),
        ...(adventureUnderstandingDelta ? { adventureUnderstandingDelta } : {}),
        ...(rewards.adventureGoldUnderstandingBonus != null && rewards.adventureGoldUnderstandingBonus > 0
            ? { adventureGoldUnderstandingBonus: rewards.adventureGoldUnderstandingBonus }
            : {}),
        ...(qualifiesVipPlayRewardSurface
            ? {
                  vipPlayRewardSlot: {
                      locked: !isRewardVipActive(updatedPlayer),
                      ...(vipGrantedDisplay
                          ? {
                                grantedItem: vipGrantedDisplay,
                            }
                          : {}),
                  },
              }
            : {}),
        ...(vipInventoryItemGranted ? { vipInventoryItemGranted: true } : {}),
    };

    return { summary, updatedPlayer };
};

export const processGameSummary = async (game: LiveGameSession): Promise<void> => {
    const { winner, player1, player2, blackPlayerId, whitePlayerId, noContestInitiatorIds, winReason } = game;
    if (!player1 || !player2) {
        console.error(`[Summary] Missing player data for game ${game.id}`);
        return;
    }
    
    const isDraw = winner === Player.None;
    const isNoContest = game.gameStatus === 'no_contest';
    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === game.mode);

    const guildWarBoardId =
        (game as any).gameCategory === 'guildwar' ? ((game as any).guildWarBoardId as string | undefined) : undefined;
    const aiUserForSummary = (boardId: string | undefined) => {
        const base = getAiUser(game.mode);
        if (boardId) {
            return { ...base, nickname: getGuildWarAiBotDisplayName(boardId) };
        }
        return base;
    };

    const p1 = player1.id === aiUserId ? aiUserForSummary(guildWarBoardId) : await db.getUser(player1.id);
    // 싱글플레이: 스테이지별 봇 닉 유지. 도전의 탑: 국면의 봇 필드 유지하되 표시명만 통일(`processGame` 등에서 모드별 닉으로 덮일 수 있음).
    const isTowerGame = String((game as any).gameCategory ?? '') === 'tower';
    const p2 = game.isSinglePlayer
        ? player2
        : player2.id === aiUserId
          ? isTowerGame
              ? { ...(player2 as any), nickname: TOWER_AI_BOT_DISPLAY_NAME }
              : aiUserForSummary(guildWarBoardId)
          : await db.getUser(player2.id);

    if (!p1 || !p2) {
        console.error(`[Summary] Could not find one or more users from DB for game ${game.id}`);
        // Still save the game so we don't retry this every tick
        game.statsUpdated = true;
        await db.saveGame(game);
        return;
    }

    const p1IsWinner = !isDraw && !isNoContest && ((winner === Player.Black && p1.id === blackPlayerId) || (winner === Player.White && p1.id === whitePlayerId));
    const p2IsWinner = !isDraw && !isNoContest && ((winner === Player.Black && p2.id === blackPlayerId) || (winner === Player.White && p2.id === whitePlayerId));
    
    const p1IsNoContestInitiator = isNoContest && (noContestInitiatorIds?.includes(p1.id) ?? false);
    const p2IsNoContestInitiator = isNoContest && (noContestInitiatorIds?.includes(p2.id) ?? false);

    // 전략바둑 무효처리 시 행동력 환불 처리
    if (isNoContest && isStrategic && !game.isSinglePlayer && !game.isAiGame) {
        const { STRATEGIC_ACTION_POINT_COST } = await import('../constants');
        const cost = STRATEGIC_ACTION_POINT_COST;
        
        // 기권으로 무효처리된 경우: 기권한 유저는 행동력 소모 유지, 상대방은 행동력 환불
        if (winReason === 'resign' && winner !== Player.None) {
            // 기권한 사람은 winner의 상대방
            const resignedPlayerId = (winner === Player.Black && p1.id === blackPlayerId) || (winner === Player.White && p1.id === whitePlayerId)
                ? p2.id
                : p1.id;
            
            // 기권한 사람이 아닌 상대방에게 행동력 환불
            const { broadcastUserUpdate } = await import('./socket.js');
            if (resignedPlayerId === p1.id && p2.id !== aiUserId && !p2.isAdmin) {
                p2.actionPoints.current = Math.min(
                    p2.actionPoints.max,
                    p2.actionPoints.current + cost
                );
                p2.lastActionPointUpdate = Date.now();
                await db.updateUser(p2);
                broadcastUserUpdate(p2, ['actionPoints']);
            } else if (resignedPlayerId === p2.id && p1.id !== aiUserId && !p1.isAdmin) {
                p1.actionPoints.current = Math.min(
                    p1.actionPoints.max,
                    p1.actionPoints.current + cost
                );
                p1.lastActionPointUpdate = Date.now();
                await db.updateUser(p1);
                broadcastUserUpdate(p1, ['actionPoints']);
            }
        } else if (winReason === 'disconnect' && game.moveHistory.length < 20) {
            // 20수 이내 접속장애로 무효처리된 경우: 접속이 끊어진 유저는 행동력 소모 유지, 무효처리를 당한 유저는 행동력 환불
            // 접속이 끊어진 유저 찾기 (disconnectionCounts가 있는 유저)
            const disconnectedPlayerId = game.disconnectionCounts?.[p1.id] > 0 ? p1.id : p2.id;
            
            // 접속이 끊어진 유저가 아닌 상대방에게 행동력 환불
            const { broadcastUserUpdate } = await import('./socket.js');
            if (disconnectedPlayerId === p1.id && p2.id !== aiUserId && !p2.isAdmin) {
                p2.actionPoints.current = Math.min(
                    p2.actionPoints.max,
                    p2.actionPoints.current + cost
                );
                p2.lastActionPointUpdate = Date.now();
                await db.updateUser(p2);
                broadcastUserUpdate(p2, ['actionPoints']);
            } else if (disconnectedPlayerId === p2.id && p1.id !== aiUserId && !p1.isAdmin) {
                p1.actionPoints.current = Math.min(
                    p1.actionPoints.max,
                    p1.actionPoints.current + cost
                );
                p1.lastActionPointUpdate = Date.now();
                await db.updateUser(p1);
                broadcastUserUpdate(p1, ['actionPoints']);
            }
        } else {
            // 기권이 아닌 경우 (예: 1분 경과 후 무효처리): 양쪽 모두 행동력 환불
            if (p1.id !== aiUserId && !p1.isAdmin) {
                p1.actionPoints.current = Math.min(
                    p1.actionPoints.max,
                    p1.actionPoints.current + cost
                );
                p1.lastActionPointUpdate = Date.now();
                await db.updateUser(p1);
            }
            if (p2.id !== aiUserId && !p2.isAdmin) {
                p2.actionPoints.current = Math.min(
                    p2.actionPoints.max,
                    p2.actionPoints.current + cost
                );
                p2.lastActionPointUpdate = Date.now();
                await db.updateUser(p2);
            }
            const { broadcastUserUpdate } = await import('./socket.js');
            if (p1.id !== aiUserId && !p1.isAdmin) {
                broadcastUserUpdate(p1, ['actionPoints']);
            }
            if (p2.id !== aiUserId && !p2.isAdmin) {
                broadcastUserUpdate(p2, ['actionPoints']);
            }
        }
    }

    if (!game.summary) game.summary = {}; // Initialize summary object

    const { broadcast } = await import('./socket.js');

    try {
        if (p1.id !== aiUserId) {
            const { summary: p1Summary, updatedPlayer: updatedP1 } = await processPlayerSummary(p1, p2, p1IsWinner, isDraw, game, isNoContest, p1IsNoContestInitiator);
            await db.updateUser(updatedP1);
            game.summary[p1.id] = p1Summary;
            // 게임 종료 후 업데이트된 필드만 브로드캐스트 (메모리 절약)
            const { broadcastUserUpdate } = await import('./socket.js');
            const fieldsToUpdate = [
                'gold',
                'diamonds',
                'strategyXp',
                'strategyLevel',
                'playfulXp',
                'playfulLevel',
                'mannerScore',
                'rating',
                'stats',
                'quests',
            ];
            if (p1Summary.items && p1Summary.items.length > 0) {
                fieldsToUpdate.push('inventory');
            }
            if ((p1Summary as GameSummary & { vipInventoryItemGranted?: boolean }).vipInventoryItemGranted) {
                fieldsToUpdate.push('inventory');
            }
            if (
                game.gameCategory === 'adventure' &&
                p1.id !== aiUserId &&
                !isDraw &&
                !isNoContest &&
                typeof game.adventureMonsterCodexId === 'string' &&
                typeof game.adventureStageId === 'string'
            ) {
                fieldsToUpdate.push('adventureProfile');
            }
            broadcastUserUpdate(updatedP1, fieldsToUpdate);
        }
    } catch (e) {
        console.error(`[Summary] Error processing summary for player 1 (${p1.id}) in game ${game.id}:`, e);
    }
    
    try {
        if (p2.id !== aiUserId) {
            const { summary: p2Summary, updatedPlayer: updatedP2 } = await processPlayerSummary(p2, p1, p2IsWinner, isDraw, game, isNoContest, p2IsNoContestInitiator);
            await db.updateUser(updatedP2);
            game.summary[p2.id] = p2Summary;
            // 게임 종료 후 업데이트된 필드만 브로드캐스트 (메모리 절약)
            const { broadcastUserUpdate } = await import('./socket.js');
            const fieldsToUpdate = [
                'gold',
                'diamonds',
                'strategyXp',
                'strategyLevel',
                'playfulXp',
                'playfulLevel',
                'mannerScore',
                'rating',
                'stats',
                'quests',
            ];
            if (p2Summary.items && p2Summary.items.length > 0) {
                fieldsToUpdate.push('inventory');
            }
            if ((p2Summary as GameSummary & { vipInventoryItemGranted?: boolean }).vipInventoryItemGranted) {
                fieldsToUpdate.push('inventory');
            }
            if (
                game.gameCategory === 'adventure' &&
                p2.id !== aiUserId &&
                !isDraw &&
                !isNoContest &&
                typeof game.adventureMonsterCodexId === 'string' &&
                typeof game.adventureStageId === 'string'
            ) {
                fieldsToUpdate.push('adventureProfile');
            }
            broadcastUserUpdate(updatedP2, fieldsToUpdate);
        }
    } catch (e) {
        console.error(`[Summary] Error processing summary for player 2 (${p2.id}) in game ${game.id}:`, e);
    }
    
    const participantIds = [game.player1?.id, game.player2?.id].filter((id): id is string => typeof id === 'string');
    const humanParticipantIds = participantIds.filter((id) => id !== aiUserId);
    const hasAllHumanSummaries = humanParticipantIds.every((id) => !!game.summary?.[id]);
    game.statsUpdated = hasAllHumanSummaries;
    if (!hasAllHumanSummaries) {
        console.warn(
            `[processGameSummary] Incomplete summary for game ${game.id}. ` +
            `humanIds=${JSON.stringify(humanParticipantIds)}, summaryKeys=${JSON.stringify(Object.keys(game.summary || {}))}`
        );
    }
    await db.saveGame(game);
};