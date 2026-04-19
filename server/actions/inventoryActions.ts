import { randomUUID } from 'crypto';
import * as db from '../db.js';
import { type ServerAction, type User, type VolatileState, InventoryItem, ItemOption, EquipmentSlot, CoreStat, SpecialStat, MythicStat, type BorderInfo, type ChatMessage } from '../../types/index.js';
import { ItemGrade } from '../../types/enums.js';
import { broadcast } from '../socket.js';
import { getSelectiveUserUpdate } from '../utils/userUpdateHelper.js';
import * as guildService from '../guildService.js';
import {
    EQUIPMENT_POOL,
    MAIN_STAT_DEFINITIONS,
    SPECIAL_STATS_DATA,
    MYTHIC_STATS_DATA,
    CORE_STATS_DATA,
    ENHANCEMENT_SUCCESS_RATES,
    ENHANCEMENT_COSTS,
    getEnhancementCostRowForDisassembly,
    MATERIAL_ITEMS,
    ITEM_SELL_PRICES,
    MATERIAL_SELL_PRICES,
    CONSUMABLE_SELL_PRICES,
    SUB_OPTION_POOLS,
    resolveCombatSubPoolDefinition,
    CONSUMABLE_ITEMS,
    GRADE_SUB_OPTION_RULES,
    GRADE_LEVEL_REQUIREMENTS,
    ENHANCEMENT_FAIL_BONUS_RATES,
    BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES,
    BLACKSMITH_COMBINATION_XP_GAIN,
    BLACKSMITH_MAX_LEVEL,
    BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP,
    BLACKSMITH_COMBINABLE_GRADES_BY_LEVEL,
    calculateEnhancementGoldCost,
    MAIN_ENHANCEMENT_STEP_MULTIPLIER,
} from '../../constants/index.js';
import { mythicStatPoolForItemGrade } from '../../shared/utils/specialOptionGearEffects.js';
import {
    BLACKSMITH_ENHANCEMENT_XP_GAIN,
    BLACKSMITH_DISASSEMBLY_XP_GAIN,
    BLACKSMITH_DISASSEMBLY_JACKPOT_RATES,
    calculateRefinementGoldCost,
} from '../../constants/rules.js';
import * as effectService from '../effectService.js';
import { isFunctionVipActive } from '../../shared/utils/rewardVip.js';
import { SHOP_ITEMS, createItemFromTemplate } from '../shop.js';
import { updateQuestProgress } from '../questService.js';
import { addItemsToInventory as addItemsToInventoryUtil } from '../../utils/inventoryUtils.js';
import { resolveCurrencyBundleConsumableKey } from '../../shared/utils/currencyBundleConsumable.js';
import {
    applySuccessfulEnhancementTick,
    getEnhancementStepBonusMultiplier,
} from '../../shared/utils/equipmentEnhancementTick.js';
import { normalizeEquipmentOptionNumbers } from '../../shared/utils/inventoryLegacyNormalize.js';
import {
    resolveCombatSubValueRefinementRange,
    resolveSpecialSubValueRefinementRange,
} from '../../shared/utils/refinementValueBounds.js';
import {
    milestoneTierCountFromStars,
    computeSpecialSubRollBoundsAfterMilestones,
    formatSpecialSubItemDisplay,
} from '../../shared/utils/specialStatMilestones.js';

type HandleActionResult = {
    clientResponse?: any;
    error?: string;
};

const ALL_SLOTS: EquipmentSlot[] = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];
const GRADE_ORDER: ItemGrade[] = [
    ItemGrade.Normal,
    ItemGrade.Uncommon,
    ItemGrade.Rare,
    ItemGrade.Epic,
    ItemGrade.Legendary,
    ItemGrade.Mythic,
    ItemGrade.Transcendent,
];

export const currencyBundles: Record<string, { type: 'gold' | 'diamonds', min: number, max: number }> = {
    '골드 꾸러미1': { type: 'gold', min: 10, max: 500 },
    '골드 꾸러미2': { type: 'gold', min: 100, max: 1000 },
    '골드 꾸러미3': { type: 'gold', min: 500, max: 3000 },
    '골드 꾸러미4': { type: 'gold', min: 1000, max: 10000 },
    '다이아 꾸러미1': { type: 'diamonds', min: 1, max: 20 },
    '다이아 꾸러미2': { type: 'diamonds', min: 10, max: 30 },
    '다이아 꾸러미3': { type: 'diamonds', min: 20, max: 50 },
    '다이아 꾸러미4': { type: 'diamonds', min: 30, max: 100 },
};

const getRandomInt = (min: number, max: number): number => {
    const lo = Math.floor(Number(min));
    const hi = Math.floor(Number(max));
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return lo;
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
};

/**
 * 합성·토너먼트·길드 보상 등에서 생성하는 장비.
 * 예전에는 shop의 generateItemOptions와 별도 구현이었고, 신화 이상에서만 로직이 어긋나 이상 수치가 나올 수 있었다.
 * 이제 상자/상점과 동일하게 `createItemFromTemplate` 한 경로만 사용한다.
 */
export const generateNewItem = (grade: ItemGrade, slot: EquipmentSlot): InventoryItem => {
    const template = EQUIPMENT_POOL.find((p) => p.grade === grade && p.slot === slot);
    if (!template) {
        console.error(`[generateNewItem] EQUIPMENT_POOL에 없음: grade=${grade}, slot=${slot}`);
        const anySameGrade = EQUIPMENT_POOL.find((p) => p.grade === grade);
        if (!anySameGrade) {
            throw new Error(`[generateNewItem] 등급 ${grade} 템플릿이 풀에 없습니다.`);
        }
        const item = createItemFromTemplate(anySameGrade);
        item.level = GRADE_LEVEL_REQUIREMENTS[grade];
        item.enhancementFails = 0;
        return item;
    }
    const item = createItemFromTemplate(template);
    item.level = GRADE_LEVEL_REQUIREMENTS[grade];
    item.enhancementFails = 0;
    return item;
};

// 장비 일관성 검증 및 수정 헬퍼 함수
// 데이터 손실 방지를 위해 인벤토리에 없는 장비도 절대 삭제하지 않음
export const validateAndFixEquipmentConsistency = (user: User): void => {
    // user.equipment에 있는 모든 장비가 인벤토리에 존재하는지 확인
    for (const slot in user.equipment) {
        const itemId = user.equipment[slot as EquipmentSlot];
        const itemInInventory = user.inventory.find(item => item.id === itemId);
        if (!itemInInventory) {
            // 인벤토리에 없어도 장비는 보존 (데이터 손실 방지)
            // 이는 인벤토리 동기화 문제나 버그로 인한 데이터 손실을 방지하기 위함
            console.error(`[Equipment Consistency] CRITICAL: User ${user.id} has equipment ${itemId} in slot ${slot} but not in inventory! PRESERVING equipment to prevent data loss. DO NOT DELETE.`);
            // 장비는 그대로 유지하여 나중에 복구 가능하도록 함
        } else if (!itemInInventory.isEquipped) {
            // 인벤토리에 있지만 isEquipped가 false인 경우 수정
            console.warn(`[Equipment Consistency] Equipment item ${itemId} in slot ${slot} exists in inventory but isEquipped is false for user ${user.id}, fixing`);
            itemInInventory.isEquipped = true;
        }
    }
    
    // 인벤토리에 있는 장착된 장비가 user.equipment에 있는지 확인
    user.inventory.forEach(item => {
        if (item.type === 'equipment' && item.isEquipped && item.slot) {
            const equipmentItemId = user.equipment[item.slot];
            if (equipmentItemId !== item.id) {
                console.warn(`[Equipment Consistency] Equipment item ${item.id} in slot ${item.slot} is marked as equipped but user.equipment[${item.slot}] is ${equipmentItemId} for user ${user.id}, fixing`);
                user.equipment[item.slot] = item.id;
            }
        }
    });
};

const removeUserItems = (user: User, itemsToRemove: { name: string; amount: number }[]): boolean => {
    const inventory = user.inventory;
    const materialCounts: Record<string, number> = {};
    inventory.filter(i => i.type === 'material').forEach(i => {
        materialCounts[i.name] = (materialCounts[i.name] || 0) + (i.quantity || 0);
    });

    for (const item of itemsToRemove) {
        if ((materialCounts[item.name] || 0) < item.amount) {
            return false; // Not enough materials
        }
    }

    for (const item of itemsToRemove) {
        let amountToRemove = item.amount;
        for (let i = inventory.length - 1; i >= 0; i--) {
            if (inventory[i].name === item.name) {
                if ((inventory[i].quantity || 0) > amountToRemove) {
                    inventory[i].quantity! -= amountToRemove;
                    amountToRemove = 0;
                } else {
                    amountToRemove -= (inventory[i].quantity || 0);
                    inventory.splice(i, 1);
                }
            }
            if (amountToRemove <= 0) break;
        }
    }
    return true;
};

export const handleInventoryAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type, payload } = action as any;

    switch (type) {
        case 'COMBINE_ITEMS': {
            const { itemIds, isRandom } = payload as { itemIds: string[], isRandom: boolean };
            if (!itemIds || itemIds.length !== 3) return { error: '합성에는 3개의 아이템이 필요합니다.' };

            const itemsToCombine = user.inventory.filter(i => itemIds.includes(i.id));
            if (itemsToCombine.length !== 3) return { error: '선택된 아이템 중 일부를 찾을 수 없습니다.' };

            const firstItem = itemsToCombine[0];
            const grade = firstItem.grade;

            // Validation
            if (itemsToCombine.some(i => i.isEquipped)) return { error: '장착 중인 아이템은 합성할 수 없습니다.' };
            if (itemsToCombine.some(i => i.grade !== grade)) return { error: '같은 등급의 아이템만 합성할 수 있습니다.' };
            
            const blacksmithLevel = user.blacksmithLevel ?? 1;
            const maxCombinableGrade = BLACKSMITH_COMBINABLE_GRADES_BY_LEVEL[blacksmithLevel - 1];
            if (GRADE_ORDER.indexOf(grade) > GRADE_ORDER.indexOf(maxCombinableGrade)) {
                return { error: '대장간 레벨이 낮아 해당 등급을 합성할 수 없습니다.' };
            }

            // --- Logic --- 
            const inventoryAfterRemoval = user.inventory.filter(i => !itemIds.includes(i.id));

            // 2. Determine outcome grade
            const greatSuccessRate = BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES[blacksmithLevel - 1]?.[grade] ?? 0;
            const vipGreatBonus = isFunctionVipActive(user) ? 10 : 0;
            const effectiveGreatRate = Math.min(100, greatSuccessRate + vipGreatBonus);
            const isGreatSuccess = Math.random() * 100 < effectiveGreatRate;
            
            // 신화 합성: 대성공 시 초월, 아니면 신화. 그 외 등급은 대성공 시 한 단계 상승.
            let outcomeGrade: ItemGrade;
            if (grade === ItemGrade.Mythic) {
                outcomeGrade = isGreatSuccess ? ItemGrade.Transcendent : ItemGrade.Mythic;
            } else {
                const outcomeGradeIndex = Math.min(
                    GRADE_ORDER.indexOf(grade) + (isGreatSuccess ? 1 : 0),
                    GRADE_ORDER.length - 1
                );
                outcomeGrade = GRADE_ORDER[outcomeGradeIndex];
            }

            // 3. Determine outcome slot
            let outcomeSlot: EquipmentSlot;
            if (isRandom) {
                outcomeSlot = ALL_SLOTS[Math.floor(Math.random() * ALL_SLOTS.length)];
            } else {
                const weightedSlots = itemsToCombine.map(i => i.slot).filter((s): s is EquipmentSlot => s !== null);
                outcomeSlot = weightedSlots[Math.floor(Math.random() * weightedSlots.length)];
            }

            // 4. Generate new item
            const newItem = generateNewItem(outcomeGrade, outcomeSlot);

            let finalIsGreatSuccess = isGreatSuccess;
            if (grade === ItemGrade.Mythic && outcomeGrade !== ItemGrade.Transcendent) {
                finalIsGreatSuccess = false;
            }

            // 5. Add to inventory
            const { success, finalItemsToAdd, updatedInventory } = addItemsToInventoryUtil(inventoryAfterRemoval, user.inventorySlots, [newItem]);
            if (!success) {
                return { error: '새 아이템을 받기에 인벤토리 공간이 부족합니다.' };
            }
            // updatedInventory는 이미 새로운 배열이므로 직접 할당 (성능 최적화)
            user.inventory = updatedInventory;
            
            // 실제로 인벤토리에 추가된 아이템 (ID가 변경되었을 수 있음)
            const actualAddedItem = finalItemsToAdd[0] || newItem;
            // 새로 만든 아이템의 createdAt 시간 저장 (나중에 정확히 찾기 위해)
            const newItemCreatedAt = actualAddedItem.createdAt;

            await guildService.recordGuildEpicPlusEquipmentAcquisition(user, [actualAddedItem]);

            // 6. Add blacksmith XP
            const xpGainRange = BLACKSMITH_COMBINATION_XP_GAIN[grade];
            let xpGained = getRandomInt(xpGainRange[0], xpGainRange[1]);
            if (isFunctionVipActive(user)) {
                xpGained = Math.floor(xpGained * 1.5);
            }
            user.blacksmithXp += xpGained;

            while (user.blacksmithLevel < BLACKSMITH_MAX_LEVEL && user.blacksmithXp >= BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(user.blacksmithLevel)) {
                user.blacksmithXp -= BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(user.blacksmithLevel);
                user.blacksmithLevel++;
            }

            updateQuestProgress(user, 'equipment_combine_attempt');

            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'COMBINE_ITEMS');

            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[COMBINE_ITEMS] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'blacksmithXp', 'blacksmithLevel']);

            // 시스템 메시지 전송 조건 (비동기로 처리하여 응답 지연 최소화):
            // 전설→신화 대성공, 또는 신화→초월 대성공
            const shouldSendMessage =
                (grade === 'legendary' && outcomeGrade === 'mythic' && finalIsGreatSuccess) ||
                (grade === 'mythic' && outcomeGrade === 'transcendent' && isGreatSuccess);
            
            // 시스템 메시지 전송을 비동기로 처리 (응답 지연 최소화)
            if (shouldSendMessage) {
                // 실제 아이템은 이미 알고 있으므로 복잡한 검색 생략
                const itemName = actualAddedItem.name;
                
                // 조사 처리 (을/를)
                const particle = /[가-힣]$/.test(itemName) && (itemName.charCodeAt(itemName.length - 1) - 0xAC00) % 28 === 0 ? '를' : '을';
                
                // 비동기로 시스템 메시지 전송 (응답 지연 최소화)
                Promise.resolve().then(() => {
                    try {
                        const systemMessage: ChatMessage = {
                            id: `msg-${randomUUID()}`,
                            user: { id: 'system', nickname: '시스템' },
                            text: `${user.nickname}님이 장비 합성을 통해 ${itemName}${particle} 획득했습니다`,
                            system: true,
                            timestamp: Date.now(),
                            itemLink: {
                                itemId: actualAddedItem.id,
                                userId: user.id,
                                itemName: itemName,
                                itemGrade: actualAddedItem.grade
                            },
                            userLink: {
                                userId: user.id,
                                userName: user.nickname
                            }
                        };

                        // 전체 채팅창에 메시지 추가
                        if (!volatileState.waitingRoomChats['global']) {
                            volatileState.waitingRoomChats['global'] = [];
                        }
                        volatileState.waitingRoomChats['global'].push(systemMessage);
                        if (volatileState.waitingRoomChats['global'].length > 100) {
                            volatileState.waitingRoomChats['global'].shift();
                        }

                        // 채팅 메시지를 모든 클라이언트에 브로드캐스트
                        broadcast({
                            type: 'WAITING_ROOM_CHAT_UPDATE',
                            payload: {
                                'global': volatileState.waitingRoomChats['global']
                            }
                        });
                    } catch (error: any) {
                        console.error(`[COMBINE_ITEMS] 합성 시스템 메시지 전송 중 오류:`, error);
                    }
                }).catch(err => {
                    console.error(`[COMBINE_ITEMS] 시스템 메시지 전송 실패:`, err);
                });
            }

            return { 
                clientResponse: { 
                    updatedUser,
                    combinationResult: { 
                        item: newItem, 
                        xpGained: xpGained, 
                        isGreatSuccess: finalIsGreatSuccess 
                    }
                }
            };
        }

        case 'USE_ITEM': {
            const { itemId, quantity = 1, itemName } = payload as { itemId?: string; quantity?: number; itemName?: string };
            if (!itemId && !itemName) {
                console.error(`[USE_ITEM] Missing itemId and itemName for user ${user.id}`);
                return { error: '아이템 ID 또는 이름이 제공되지 않았습니다.' };
            }

            // 도전의 탑 전용 아이템: 싱글/전략/놀이바둑에서는 source !== 'tower'인 것만 사용·합산
            const isTowerOnlyItemName = (name: string): boolean => {
                if (!name || typeof name !== 'string') return false;
                const n = name.trim();
                return ['턴 추가', '턴증가', '미사일', '히든', '스캔', '배치 새로고침', '배치변경'].includes(n) ||
                    ['turn_add', 'turn_add_item', 'addturn', 'missile', 'hidden', 'scan', 'reflesh', 'refresh'].includes(n);
            };
            const isTowerSource = (inv: InventoryItem): boolean => (inv as InventoryItem & { source?: string }).source === 'tower';

            // itemId로 먼저 찾기
            let itemIndex = itemId ? user.inventory.findIndex(i => i && i.id === itemId) : -1;
            let item: InventoryItem | undefined;
            
            // itemId로 찾지 못한 경우, itemName으로 찾기 (골드 꾸러미 등 이름 변형 대응)
            if (itemIndex === -1 && itemName) {
                // 아이템 이름 정규화 함수 (장비상자1 -> 장비 상자 I 등)
                const normalizeItemNameForSearch = (name: string): string => {
                    const numToRoman: Record<string, string> = {
                        '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI'
                    };
                    
                    let normalized = name;
                    // 장비상자/재료상자 숫자를 로마숫자로 변환
                    normalized = normalized.replace(/장비상자(\d)/g, (match, num) => `장비 상자 ${numToRoman[num] || num}`);
                    normalized = normalized.replace(/재료상자(\d)/g, (match, num) => `재료 상자 ${numToRoman[num] || num}`);
                    normalized = normalized.replace(/장비 상자(\d)/g, (match, num) => `장비 상자 ${numToRoman[num] || num}`);
                    normalized = normalized.replace(/재료 상자(\d)/g, (match, num) => `재료 상자 ${numToRoman[num] || num}`);
                    normalized = normalized.replace(/장비 상자 (\d)/g, (match, num) => `장비 상자 ${numToRoman[num] || num}`);
                    normalized = normalized.replace(/재료 상자 (\d)/g, (match, num) => `재료 상자 ${numToRoman[num] || num}`);
                    
                    // 골드/다이아 꾸러미 처리
                    if (normalized.startsWith('골드꾸러미')) {
                        normalized = normalized.replace('골드꾸러미', '골드 꾸러미');
                    } else if (normalized.startsWith('다이아꾸러미')) {
                        normalized = normalized.replace('다이아꾸러미', '다이아 꾸러미');
                    }
                    
                    return normalized.trim();
                };
                
                const normalizedName = normalizeItemNameForSearch(itemName);
                
                // 정확한 이름으로 찾기 (다양한 변형 모두 시도). 도전의 탑 전용 아이템은 비(非)탑 소스만 사용
                itemIndex = user.inventory.findIndex(i => {
                    if (!i || i.type !== 'consumable') return false;
                    const itemNameNormalized = normalizeItemNameForSearch(i.name);
                    const nameMatch = (
                        i.name === itemName || i.name === normalizedName ||
                        itemNameNormalized === normalizedName ||
                        itemNameNormalized === normalizeItemNameForSearch(normalizedName)
                    );
                    if (!nameMatch) return false;
                    if (isTowerOnlyItemName(i.name) && isTowerSource(i)) return false; // 탑 전용은 USE_ITEM에서 소모 불가
                    return true;
                });
                
                if (itemIndex !== -1) {
                    console.log(`[USE_ITEM] Found item by name fallback: itemId=${itemId}, itemName=${itemName}, foundName=${user.inventory[itemIndex]?.name}`);
                }
            }
            
            if (itemIndex === -1) {
                // 디버깅: 인벤토리 상태 확인
                console.error(`[USE_ITEM] Item not found: itemId=${itemId}, itemName=${itemName}, userId=${user.id}, inventoryLength=${user.inventory?.length || 0}`);
                if (user.inventory && user.inventory.length > 0) {
                    const consumables = user.inventory.filter(i => i && i.type === 'consumable');
                    const itemNames = consumables.map(i => i?.name).filter(Boolean);
                    console.error(`[USE_ITEM] Available consumable items: ${itemNames.slice(0, 10).join(', ')}${itemNames.length > 10 ? '...' : ''}`);
                }
                return { error: '아이템을 찾을 수 없습니다.' };
            }

            item = user.inventory[itemIndex];
            if (!item) {
                console.error(`[USE_ITEM] Item at index ${itemIndex} is null/undefined for user ${user.id}`);
                return { error: '아이템 데이터가 손상되었습니다.' };
            }
            if (item.type !== 'consumable') return { error: '사용할 수 없는 아이템입니다.' };

            // 변경권 사용 시 대장간 제련 탭으로 이동하도록 플래그 설정
            const isRefinementTicket = item.name === '옵션 종류 변경권' || 
                                      item.name === '옵션 수치 변경권' || 
                                      item.name === '스페셜 옵션 변경권' ||
                                      item.name === '신화 옵션 변경권';
            
            if (isRefinementTicket) {
                // 변경권은 실제로 소모하지 않고, 대장간 제련 탭으로 이동하도록 클라이언트에 알림
                return { 
                    clientResponse: { 
                        openBlacksmithRefineTab: true,
                        selectedItemId: item.id,
                        updatedUser: getSelectiveUserUpdate(user, 'USE_ITEM')
                    } 
                };
            }

            // 일괄 사용: 골드/다이아 꾸러미는 표기(띄어쓰기 등)가 달라도 같은 키로 합산 (도전의 탑 전용은 비탑만)
            const currencyBundleKeyForBulk = resolveCurrencyBundleConsumableKey(item.name);
            const isCurrencyBundleBulk =
                !!currencyBundleKeyForBulk && !!currencyBundles[currencyBundleKeyForBulk];
            const totalAvailableQuantity = isCurrencyBundleBulk
                ? user.inventory
                      .filter(
                          i =>
                              i &&
                              i.type === 'consumable' &&
                              resolveCurrencyBundleConsumableKey(i.name) === currencyBundleKeyForBulk &&
                              (!isTowerOnlyItemName(i.name) || !isTowerSource(i))
                      )
                      .reduce((sum, i) => sum + (i.quantity || 1), 0)
                : user.inventory
                      .filter(
                          i =>
                              i &&
                              i.name === item.name &&
                              i.type === 'consumable' &&
                              (!isTowerOnlyItemName(item.name) || !isTowerSource(i))
                      )
                      .reduce((sum, i) => sum + (i.quantity || 1), 0);
            
            const useQuantity = Math.min(quantity || 1, totalAvailableQuantity);
            if (useQuantity <= 0) return { error: '사용할 수량이 없습니다.' };
            
            console.log(`[USE_ITEM] Bulk use: itemName=${item.name}, requestedQuantity=${quantity}, totalAvailable=${totalAvailableQuantity}, useQuantity=${useQuantity}`);

            // 행동력 회복제 소모품: 사용 시 행동력 회복, 아이템 소모 (가방 보관형)
            const actionPointRestoreByItem: Record<string, number> = {
                '행동력 회복제(+10)': 10,
                '행동력 회복제(+20)': 20,
                '행동력 회복제(+30)': 30,
            };
            const restoreAmount = actionPointRestoreByItem[item.name];
            if (restoreAmount) {
                const currentAP = user.actionPoints?.current ?? 0;
                const totalRestore = restoreAmount * useQuantity;
                user.actionPoints = user.actionPoints || { current: 0, max: 30 };
                // 행동력 회복제는 최대치를 초과해서 추가 가능
                user.actionPoints.current = currentAP + totalRestore;

                let remainingToRemove = useQuantity;
                const tempInventoryAfterUse: InventoryItem[] = [];
                for (const invItem of user.inventory) {
                    if (invItem.name === item.name && invItem.type === 'consumable' && remainingToRemove > 0) {
                        const itemQuantity = invItem.quantity || 1;
                        if (itemQuantity <= remainingToRemove) {
                            remainingToRemove -= itemQuantity;
                        } else {
                            tempInventoryAfterUse.push({ ...invItem, quantity: itemQuantity - remainingToRemove });
                            remainingToRemove = 0;
                        }
                    } else {
                        tempInventoryAfterUse.push(invItem);
                    }
                }
                user.inventory = tempInventoryAfterUse;

                const updatedUser = getSelectiveUserUpdate(user, 'USE_ITEM');
                db.updateUser(user).catch(err => {
                    console.error(`[USE_ITEM] Failed to save user ${user.id} (action point item):`, err);
                });
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['inventory', 'actionPoints']);
                return { clientResponse: { updatedUser, actionPointsRestored: totalRestore } };
            }

            // 골드/다이아 꾸러미: 키 통일 후 룩업 (일괄 사용 시 차감과 동일 키 사용)
            let normalizedItemName = item.name;
            if (normalizedItemName.startsWith('골드꾸러미')) {
                normalizedItemName = normalizedItemName.replace('골드꾸러미', '골드 꾸러미');
            } else if (normalizedItemName.startsWith('다이아꾸러미')) {
                normalizedItemName = normalizedItemName.replace('다이아꾸러미', '다이아 꾸러미');
            }

            const currencyBundleKey =
                resolveCurrencyBundleConsumableKey(item.name) ||
                resolveCurrencyBundleConsumableKey(normalizedItemName);

            let bundleInfo = currencyBundleKey ? currencyBundles[currencyBundleKey] : undefined;
            if (!bundleInfo) {
                bundleInfo = currencyBundles[normalizedItemName] || currencyBundles[item.name];
            }
            if (!bundleInfo) {
                const match = normalizedItemName.match(/(골드|다이아)\s*꾸러미\s*(\d+)/);
                if (match) {
                    const bundleKey = `${match[1]} 꾸러미${match[2]}`;
                    bundleInfo = currencyBundles[bundleKey];
                }
            }

            const looseBundleMatch = normalizedItemName.match(/(골드|다이아)\s*꾸러미\s*(\d+)/);
            const removalBundleKey =
                currencyBundleKey ||
                (looseBundleMatch ? `${looseBundleMatch[1]} 꾸러미${looseBundleMatch[2]}` : null);

            if (bundleInfo) {
                const individualAmounts: number[] = [];
                let totalGoldGained = 0;
                let totalDiamondsGained = 0;

                // 여러 개를 사용하는 경우 - 각각의 랜덤 수치를 저장
                for (let i = 0; i < useQuantity; i++) {
                    const amount = getRandomInt(bundleInfo.min, bundleInfo.max);
                    individualAmounts.push(amount);
                    if (bundleInfo.type === 'gold') {
                        totalGoldGained += amount;
                    } else { // diamonds
                        totalDiamondsGained += amount;
                    }
                }

                // 골드/다이아 추가 (초기화 확인)
                if (bundleInfo.type === 'gold') {
                    if (typeof user.gold !== 'number') {
                        console.warn(`[USE_ITEM] user.gold is not a number for user ${user.id}, initializing to 0`);
                        user.gold = 0;
                    }
                    const goldBefore = user.gold;
                    user.gold += totalGoldGained;
                    console.log(`[USE_ITEM] Gold bundle: userId=${user.id}, gained=${totalGoldGained}, before=${goldBefore}, after=${user.gold}`);
                } else { // diamonds
                    if (typeof user.diamonds !== 'number') {
                        console.warn(`[USE_ITEM] user.diamonds is not a number for user ${user.id}, initializing to 0`);
                        user.diamonds = 0;
                    }
                    const diamondsBefore = user.diamonds;
                    user.diamonds += totalDiamondsGained;
                    console.log(`[USE_ITEM] Diamonds bundle: userId=${user.id}, gained=${totalDiamondsGained}, before=${diamondsBefore}, after=${user.diamonds}`);
                }

                // 여러 슬롯·표기(골드꾸러미/골드 꾸러미 등)에 걸쳐 정확히 useQuantity만큼 소모
                let remainingToRemove = useQuantity;
                for (let i = user.inventory.length - 1; i >= 0 && remainingToRemove > 0; i--) {
                    const invItem = user.inventory[i];
                    if (!invItem || invItem.type !== 'consumable') continue;

                    let invItemNormalized = invItem.name;
                    if (invItemNormalized.startsWith('골드꾸러미')) {
                        invItemNormalized = invItemNormalized.replace('골드꾸러미', '골드 꾸러미');
                    } else if (invItemNormalized.startsWith('다이아꾸러미')) {
                        invItemNormalized = invItemNormalized.replace('다이아꾸러미', '다이아 꾸러미');
                    }

                    const invKey = resolveCurrencyBundleConsumableKey(invItem.name);
                    const matchesCurrencyBundle =
                        removalBundleKey != null && invKey === removalBundleKey;
                    const matchesLegacyName =
                        removalBundleKey == null && invItemNormalized === normalizedItemName;

                    if (invItem.id === itemId || matchesCurrencyBundle || matchesLegacyName) {
                        const itemQuantity = invItem.quantity || 1;
                        if (itemQuantity <= remainingToRemove) {
                            remainingToRemove -= itemQuantity;
                            user.inventory.splice(i, 1);
                        } else {
                            invItem.quantity = itemQuantity - remainingToRemove;
                            remainingToRemove = 0;
                        }
                    }
                }

                if (remainingToRemove > 0) {
                    console.error(
                        `[USE_ITEM] Currency bundle removal incomplete: remainingToRemove=${remainingToRemove}, useQuantity=${useQuantity}, removalBundleKey=${removalBundleKey}, itemId=${itemId}`
                    );
                }

                // 인벤토리 참조 변경 (배열 복사로 충분)
                user.inventory = [...user.inventory];
                
                // 각각의 획득 수치를 별도의 아이템으로 반환 (표시용)
                const obtainedItems: Partial<InventoryItem>[] = individualAmounts.map(amount => ({
                    name: bundleInfo.type === 'gold' ? '골드' : '다이아',
                    quantity: amount,
                    image: bundleInfo.type === 'gold' ? '/images/icon/Gold.png' : '/images/icon/Zem.png',
                    type: 'material' as const,
                    grade: bundleInfo.type === 'gold' ? ItemGrade.Uncommon : ItemGrade.Rare
                }));

                // 선택적 필드만 반환 (메시지 크기 최적화)
                // 하지만 bundle 처리의 경우에도 getSelectiveUserUpdate를 사용하여 일관성 유지
                const updatedUser = getSelectiveUserUpdate(user, 'USE_ITEM');
                
                // 골드/다이아가 제대로 포함되었는지 확인 및 강제 포함
                if (bundleInfo.type === 'gold' && totalGoldGained > 0) {
                    updatedUser.gold = user.gold;
                    console.log(`[USE_ITEM] Updated user gold in response: ${updatedUser.gold}`);
                } else if (bundleInfo.type === 'diamonds' && totalDiamondsGained > 0) {
                    updatedUser.diamonds = user.diamonds;
                    console.log(`[USE_ITEM] Updated user diamonds in response: ${updatedUser.diamonds}`);
                }
                
                // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
                db.updateUser(user).catch(err => {
                    console.error(`[USE_ITEM] Failed to save user ${user.id} (bundle):`, err);
                });

                // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
                const { broadcastUserUpdate } = await import('../socket.js');
                const changedFields = bundleInfo.type === 'gold' 
                    ? ['inventory', 'gold'] 
                    : ['inventory', 'diamonds'];
                broadcastUserUpdate(user, changedFields);
                
                return { clientResponse: { obtainedItemsBulk: obtainedItems, updatedUser } };
            }
            
            // 아이템 이름을 표준 형식으로 변환 (장비상자1 -> 장비 상자 I)
            const normalizeItemNameForShop = (name: string): string => {
                const numToRoman: Record<string, string> = {
                    '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI'
                };
                let normalized = (name || '').replace(/\s+/g, ' ').trim();
                normalized = normalized.replace(/장비상자(\d)/g, (match, num) => `장비 상자 ${numToRoman[num] || num}`);
                normalized = normalized.replace(/재료상자(\d)/g, (match, num) => `재료 상자 ${numToRoman[num] || num}`);
                normalized = normalized.replace(/장비 상자(\d)/g, (match, num) => `장비 상자 ${numToRoman[num] || num}`);
                normalized = normalized.replace(/재료 상자(\d)/g, (match, num) => `재료 상자 ${numToRoman[num] || num}`);
                normalized = normalized.replace(/장비 상자 (\d)/g, (match, num) => `장비 상자 ${numToRoman[num] || num}`);
                normalized = normalized.replace(/재료 상자 (\d)/g, (match, num) => `재료 상자 ${numToRoman[num] || num}`);
                return normalized.trim();
            };

            normalizedItemName = normalizeItemNameForShop(item.name);
            let shopItemKey = Object.keys(SHOP_ITEMS).find(key => SHOP_ITEMS[key as keyof typeof SHOP_ITEMS].name === item.name);
            if (!shopItemKey) {
                shopItemKey = Object.keys(SHOP_ITEMS).find(key => SHOP_ITEMS[key as keyof typeof SHOP_ITEMS].name === normalizedItemName);
            }
            if (!shopItemKey) return { error: '알 수 없는 아이템입니다.' };
            
            const shopItem = SHOP_ITEMS[shopItemKey as keyof typeof SHOP_ITEMS];
            const allObtainedItems: InventoryItem[] = [];
            
            // 여러 개를 사용하는 경우
            for (let i = 0; i < useQuantity; i++) {
                const obtainedItems = shopItem.onPurchase();
                const itemsArray = Array.isArray(obtainedItems) ? obtainedItems : [obtainedItems];
                allObtainedItems.push(...itemsArray);
            }

            // 여러 슬롯에 걸쳐 있을 경우 모든 슬롯에서 정확히 수량만큼 소모
            // 골드 꾸러미와 동일한 로직 적용
            let remainingToRemove = useQuantity;
            const tempInventoryAfterUse: InventoryItem[] = [];
            
            console.log(`[USE_ITEM] Starting removal: itemName=${item.name}, useQuantity=${useQuantity}, inventoryLength=${user.inventory.length}`);
            
            // 모든 인벤토리 아이템을 순회
            for (let i = 0; i < user.inventory.length; i++) {
                const invItem = user.inventory[i];
                
                // 같은 이름의 소모품인지 확인하고, 아직 제거할 수량이 남아있는 경우 (도전의 탑 전용은 비탑만 제거)
                const canRemove = invItem.name === item.name && invItem.type === 'consumable' && remainingToRemove > 0 &&
                    (!isTowerOnlyItemName(invItem.name) || !isTowerSource(invItem));
                if (canRemove) {
                    const itemQuantity = invItem.quantity || 1;
                    console.log(`[USE_ITEM] Found matching item: name=${invItem.name}, quantity=${itemQuantity}, remainingToRemove=${remainingToRemove}`);
                    
                    if (itemQuantity <= remainingToRemove) {
                        // 이 슬롯의 아이템을 모두 사용
                        remainingToRemove -= itemQuantity;
                        console.log(`[USE_ITEM] Removed entire stack: quantity=${itemQuantity}, remainingToRemove=${remainingToRemove}`);
                        // 이 아이템은 제거 (tempInventoryAfterUse에 추가하지 않음)
                    } else {
                        // 이 슬롯의 아이템 일부만 사용
                        const remainingQuantity = itemQuantity - remainingToRemove;
                        tempInventoryAfterUse.push({ ...invItem, quantity: remainingQuantity });
                        console.log(`[USE_ITEM] Partially used stack: used=${remainingToRemove}, remaining=${remainingQuantity}`);
                        remainingToRemove = 0;
                    }
                } else {
                    // 다른 아이템이거나, 같은 이름이지만 이미 필요한 수량을 모두 제거한 경우
                    tempInventoryAfterUse.push(invItem);
                }
            }
            
            // remainingToRemove가 남아있으면 경고 로그
            if (remainingToRemove > 0) {
                console.error(`[USE_ITEM] Warning: Could not remove all requested items. remainingToRemove=${remainingToRemove}, useQuantity=${useQuantity}`);
            }
            
            console.log(`[USE_ITEM] Removal complete: remainingToRemove=${remainingToRemove}, tempInventoryLength=${tempInventoryAfterUse.length}, originalLength=${user.inventory.length}`);

            const { success, finalItemsToAdd } = addItemsToInventoryUtil(tempInventoryAfterUse, user.inventorySlots, allObtainedItems);
            if (!success) return { error: '인벤토리 공간이 부족합니다.' };
            
            // 새 배열 생성 (성능 최적화)
            user.inventory = [...tempInventoryAfterUse, ...finalItemsToAdd];

            await guildService.recordGuildEpicPlusEquipmentAcquisition(user, allObtainedItems);
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'USE_ITEM', { includeAll: true });
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[USE_ITEM] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory']);
            
            return { clientResponse: { obtainedItemsBulk: allObtainedItems, updatedUser } };
        }
        
        case 'USE_ALL_ITEMS_OF_TYPE': {
            const { itemName } = payload;
            
            // 아이템 이름을 표준 형식으로 변환 (장비상자1 -> 장비 상자 I)
            const normalizeItemNameForShop = (name: string): string => {
                const numToRoman: Record<string, string> = {
                    '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI'
                };
                let normalized = (name || '').replace(/\s+/g, ' ').trim();
                normalized = normalized.replace(/장비상자(\d)/g, (match, num) => `장비 상자 ${numToRoman[num] || num}`);
                normalized = normalized.replace(/재료상자(\d)/g, (match, num) => `재료 상자 ${numToRoman[num] || num}`);
                normalized = normalized.replace(/장비 상자(\d)/g, (match, num) => `장비 상자 ${numToRoman[num] || num}`);
                normalized = normalized.replace(/재료 상자(\d)/g, (match, num) => `재료 상자 ${numToRoman[num] || num}`);
                normalized = normalized.replace(/장비 상자 (\d)/g, (match, num) => `장비 상자 ${numToRoman[num] || num}`);
                normalized = normalized.replace(/재료 상자 (\d)/g, (match, num) => `재료 상자 ${numToRoman[num] || num}`);
                return normalized.trim();
            };

            const normalizedItemName = normalizeItemNameForShop(itemName);
            
            // 인벤토리에서 아이템 찾기 (원본 이름과 정규화된 이름 모두 시도)
            const itemsToUse = user.inventory.filter(i => 
                i.type === 'consumable' && (
                    i.name === itemName || 
                    i.name === normalizedItemName ||
                    normalizeItemNameForShop(i.name) === normalizedItemName
                )
            );
            if (itemsToUse.length === 0) return { error: '사용할 아이템이 없습니다.' };

            const totalQuantity = itemsToUse.reduce((sum, i) => sum + (i.quantity || 1), 0);
            const allObtainedItems: InventoryItem[] = [];
            let totalGoldGained = 0;
            let totalDiamondsGained = 0;

            let shopItemKey = Object.keys(SHOP_ITEMS).find(key => SHOP_ITEMS[key as keyof typeof SHOP_ITEMS].name === itemName);
            if (!shopItemKey) {
                shopItemKey = Object.keys(SHOP_ITEMS).find(key => SHOP_ITEMS[key as keyof typeof SHOP_ITEMS].name === normalizedItemName);
            }
            const bundleInfo = currencyBundles[itemName] || currencyBundles[normalizedItemName];
            
            // First, generate all potential rewards
            for (let i = 0; i < totalQuantity; i++) {
                if (bundleInfo) {
                    const amount = getRandomInt(bundleInfo.min, bundleInfo.max);
                    if (bundleInfo.type === 'gold') totalGoldGained += amount;
                    else totalDiamondsGained += amount;
                } else if (shopItemKey) {
                    const shopItem = SHOP_ITEMS[shopItemKey as keyof typeof SHOP_ITEMS];
                    const openedItems = shopItem.onPurchase();
                    if (Array.isArray(openedItems)) {
                        allObtainedItems.push(...openedItems);
                    } else {
                        allObtainedItems.push(openedItems);
                    }
                }
            }

            // Then, check for inventory space
            // 인벤토리에서 아이템 제거 (원본 이름과 정규화된 이름 모두 제거)
            const inventoryAfterRemoval = user.inventory.filter(i => 
                i.name !== itemName && 
                i.name !== normalizedItemName &&
                normalizeItemNameForShop(i.name) !== normalizedItemName
            );
            const { success: hasSpace, finalItemsToAdd, updatedInventory } = addItemsToInventoryUtil(inventoryAfterRemoval, user.inventorySlots, allObtainedItems);
            if (!hasSpace) {
                return { error: '모든 아이템을 받기에 가방 공간이 부족합니다.' };
            }

            // If space is sufficient, apply all changes
            // updatedInventory는 이미 새로운 배열이므로 직접 할당 (성능 최적화)
            user.inventory = updatedInventory;
            user.gold += totalGoldGained;
            user.diamonds += totalDiamondsGained;

            await guildService.recordGuildEpicPlusEquipmentAcquisition(user, allObtainedItems);

            // Prepare client response
            const clientResponseItems = [...allObtainedItems];
            if (totalGoldGained > 0) clientResponseItems.push({ name: '골드', quantity: totalGoldGained, image: '/images/icon/Gold.png', type: 'material', grade: 'uncommon' } as any);
            if (totalDiamondsGained > 0) clientResponseItems.push({ name: '다이아', quantity: totalDiamondsGained, image: '/images/icon/Zem.png', type: 'material', grade: 'rare' } as any);

            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'USE_ALL_ITEMS_OF_TYPE', { includeAll: true });

            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[USE_ALL_ITEMS_OF_TYPE] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            const changedFields = ['inventory'];
            if (totalGoldGained > 0) changedFields.push('gold');
            if (totalDiamondsGained > 0) changedFields.push('diamonds');
            broadcastUserUpdate(user, changedFields);

            return { clientResponse: { obtainedItemsBulk: clientResponseItems, updatedUser } };
        }

        case 'TOGGLE_EQUIP_ITEM': {
            const { itemId } = payload;
            const itemToToggle = user.inventory.find(i => i.id === itemId);

            if (!itemToToggle || itemToToggle.type !== 'equipment' || !itemToToggle.slot) {
                return { error: 'Invalid equipment item.' };
            }
            
            const requiredLevel = GRADE_LEVEL_REQUIREMENTS[itemToToggle.grade];
            const userLevelSum = user.strategyLevel + user.playfulLevel;

            if (!itemToToggle.isEquipped && userLevelSum < requiredLevel) {
                 return { error: `착용 레벨 합이 부족합니다. (필요: ${requiredLevel}, 현재: ${userLevelSum})` };
            }

            if (itemToToggle.isEquipped) {
                itemToToggle.isEquipped = false;
                delete user.equipment[itemToToggle.slot];
            } else {
                const currentItemInSlot = user.inventory.find(
                    i => i.isEquipped && i.slot === itemToToggle.slot
                );
                if (currentItemInSlot) {
                    currentItemInSlot.isEquipped = false;
                }
                itemToToggle.isEquipped = true;
                user.equipment[itemToToggle.slot] = itemToToggle.id;
            }

            // 장비 일관성 검증 및 수정
            validateAndFixEquipmentConsistency(user);

            await effectService.syncActionPointsStateAfterEquipmentChange(user);

            // 사용자 캐시 업데이트 (즉시 반영)
            const { updateUserCache } = await import('../gameCache.js');
            updateUserCache(user);
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'TOGGLE_EQUIP_ITEM', { includeAll: true });
            
            // DB 저장은 비동기로 처리하여 응답 지연 최소화
            db.updateUser(user).catch((error: any) => {
                console.error(`[TOGGLE_EQUIP_ITEM] Failed to save user ${user.id}:`, error);
            });
            
            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'equipment', 'actionPoints', 'lastActionPointUpdate']);
            
            return { clientResponse: { updatedUser } };
        }

        case 'SELL_ITEM': {
            const { itemId, quantity } = payload as { itemId: string; quantity?: number };
            const itemIndex = user.inventory.findIndex(i => i.id === itemId);
            if (itemIndex === -1) return { error: '아이템을 찾을 수 없습니다.' };

            const item = user.inventory[itemIndex];
            let sellPrice = 0;
            let sellQuantity = quantity || 1;

            if (item.type === 'equipment') {
                if (item.isEquipped) {
                    return { error: '장착 중인 아이템은 판매할 수 없습니다.' };
                }
                const basePrice = ITEM_SELL_PRICES[item.grade] || 0;
                const enhancementMultiplier = Math.pow(1.2, item.stars);
                sellPrice = Math.floor(basePrice * enhancementMultiplier);
                // 장비는 전체 판매
                user.inventory.splice(itemIndex, 1);
            } else if (item.type === 'material') {
                const pricePerUnit = MATERIAL_SELL_PRICES[item.name] || 1;
                const currentQuantity = item.quantity || 1;
                
                if (sellQuantity > currentQuantity) {
                    sellQuantity = currentQuantity;
                }
                
                sellPrice = pricePerUnit * sellQuantity;
                
                // 재료는 수량만큼만 제거
                if (sellQuantity >= currentQuantity) {
                    // 전체 판매
                    user.inventory.splice(itemIndex, 1);
                } else {
                    // 부분 판매
                    item.quantity = currentQuantity - sellQuantity;
                }
            } else if (item.type === 'consumable') {
                // 소비 아이템 판매 처리
                const itemName = item.name || '';
                
                // 판매 가능 여부 확인 (sellable === false인 경우만 판매 불가)
                const consumableItem = CONSUMABLE_ITEMS.find(ci => ci.name === itemName || ci.name === itemName.replace('꾸러미', ' 꾸러미') || ci.name === itemName.replace(' 꾸러미', '꾸러미'));
                if (consumableItem?.sellable === false) {
                    return { error: '판매할 수 없는 아이템입니다.' };
                }
                
                // 가격이 0이어도 판매 가능 (삭제 목적)
                const pricePerUnit = CONSUMABLE_SELL_PRICES[itemName] ?? 
                    CONSUMABLE_SELL_PRICES[itemName.replace('골드꾸러미', '골드 꾸러미')] ?? 
                    CONSUMABLE_SELL_PRICES[itemName.replace('골드 꾸러미', '골드꾸러미')] ?? 
                    0; // 기본값 0 (0골드로 판매 가능)
                
                const currentQuantity = item.quantity || 1;
                
                if (sellQuantity > currentQuantity) {
                    sellQuantity = currentQuantity;
                }
                
                sellPrice = pricePerUnit * sellQuantity;
                
                // 소비 아이템은 수량만큼만 제거
                if (sellQuantity >= currentQuantity) {
                    // 전체 판매
                    user.inventory.splice(itemIndex, 1);
                } else {
                    // 부분 판매
                    item.quantity = currentQuantity - sellQuantity;
                }
            } else {
                return { error: '판매할 수 없는 아이템입니다.' };
            }

            user.gold += sellPrice;
            
            // 인벤토리를 깊은 복사하여 새로운 배열로 할당 (참조 문제 방지)
            user.inventory = JSON.parse(JSON.stringify(user.inventory));

            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'SELL_ITEM');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[SELL_ITEM] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'gold']);
            
            return { 
                clientResponse: { 
                    updatedUser,
                    sellResult: {
                        itemName: item.name,
                        sellPrice,
                        sellQuantity
                    }
                } 
            };
        }

        case 'ENHANCE_ITEM': {
            const { itemId } = payload;
            const item = user.inventory.find(i => i.id === itemId);
            if (!item || item.type !== 'equipment' || !item.options) return { error: '강화할 수 없는 아이템입니다.' };
            const normalizedEnhanceItem = normalizeEquipmentOptionNumbers(item);
            Object.assign(item, { options: normalizedEnhanceItem.options, stars: normalizedEnhanceItem.stars });
            if (item.stars >= 10) return { error: '최대 강화 레벨입니다.' };

            const targetStars = item.stars + 1;
            const userLevelSum = user.strategyLevel + user.playfulLevel;
            const enhancementLevelRequirements: Record<number, number> = {
                4: 3,
                7: 8,
                10: 15,
            };

            if (enhancementLevelRequirements[targetStars] && userLevelSum < enhancementLevelRequirements[targetStars]) {
                return { error: `+${targetStars}강화 시도에는 유저 레벨 합 ${enhancementLevelRequirements[targetStars]}이(가) 필요합니다.` };
            }
            
            const originalItemState = JSON.parse(JSON.stringify(item));

            const costs = ENHANCEMENT_COSTS[item.grade]?.[item.stars];
            if (!costs) return { error: '강화 정보를 찾을 수 없습니다.' };

            const goldCost = calculateEnhancementGoldCost(item.grade, item.stars);
            if (user.gold < goldCost) {
                return { error: `골드가 부족합니다. (필요: ${goldCost}, 현재: ${user.gold})` };
            }

            if (!removeUserItems(user, costs)) {
                return { error: '재료가 부족합니다.' };
            }
            
            user.gold -= goldCost; // Deduct gold
            updateQuestProgress(user, 'enhancement_attempt');
            
            // Update Guild Mission Progress for equipment enhancements
            if (user.guildId) {
                const guilds = await db.getKV<Record<string, any>>('guilds') || {};
                await guildService.updateGuildMissionProgress(user.guildId, 'equipmentEnhancements', 1, guilds);
            }

            const baseSuccessRate = ENHANCEMENT_SUCCESS_RATES[item.stars];
            const failBonusRate = ENHANCEMENT_FAIL_BONUS_RATES[item.grade] || 0.5;
            const failBonus = (item.enhancementFails || 0) * failBonusRate;
            const vipEnhanceBonus = isFunctionVipActive(user) ? 10 : 0;
            const successRate = Math.min(100, baseSuccessRate + failBonus + vipEnhanceBonus);

            const isSuccess = Math.random() * 100 < successRate;
            let resultMessage = '';

            if (isSuccess) {
                item.enhancementFails = 0;
                applySuccessfulEnhancementTick(item, Math.random);
                resultMessage = `강화 성공! +${item.stars} ${item.name}이(가) 되었습니다.`;

                // 7강화, 10강화 성공 시 전체 채팅창에 시스템 메시지 전송
                if (item.stars === 7 || item.stars === 10) {
                    const systemMessage: ChatMessage = {
                        id: `system-${randomUUID()}`,
                        user: { id: 'system', nickname: '시스템' },
                        text: `${user.nickname}님이 ${item.name}의 ${item.stars}강화에 성공했습니다.`,
                        system: true,
                        timestamp: Date.now(),
                        itemLink: {
                            itemId: item.id,
                            userId: user.id,
                            itemName: item.name,
                            itemGrade: item.grade
                        },
                        userLink: {
                            userId: user.id,
                            userName: user.nickname
                        }
                    };

                    // global 채팅에 추가
                    if (!volatileState.waitingRoomChats['global']) {
                        volatileState.waitingRoomChats['global'] = [];
                    }
                    volatileState.waitingRoomChats['global'].push(systemMessage);
                    if (volatileState.waitingRoomChats['global'].length > 100) {
                        volatileState.waitingRoomChats['global'].shift();
                    }

                    // 채팅 업데이트 브로드캐스트
                    broadcast({
                        type: 'WAITING_ROOM_CHAT_UPDATE',
                        payload: { global: volatileState.waitingRoomChats['global'] }
                    });
                }

            } else {
                item.enhancementFails = (item.enhancementFails || 0) + 1;
                const newFailBonus = item.enhancementFails * failBonusRate;
                resultMessage = `강화에 실패했습니다. (실패 보너스: +${newFailBonus.toFixed(1).replace(/\.0$/, '')}%)`;
            }

            // Add blacksmith XP
            let xpGained = 0;
            const xpGainRange = BLACKSMITH_ENHANCEMENT_XP_GAIN[item.grade];
            if (xpGainRange) {
                xpGained = getRandomInt(xpGainRange[0], xpGainRange[1]);
                if (isFunctionVipActive(user)) {
                    xpGained = Math.floor(xpGained * 1.5);
                }
                user.blacksmithXp = (user.blacksmithXp || 0) + xpGained;

                while (user.blacksmithLevel < BLACKSMITH_MAX_LEVEL && user.blacksmithXp >= BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(user.blacksmithLevel)) {
                    user.blacksmithXp -= BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(user.blacksmithLevel);
                    user.blacksmithLevel++;
                }
            }
            
            // 인벤토리를 깊은 복사하여 새로운 배열로 할당 (참조 문제 방지)
            user.inventory = JSON.parse(JSON.stringify(user.inventory));
            
            const itemBeforeEnhancement = JSON.parse(JSON.stringify(originalItemState));
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'ENHANCE_ITEM');

            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[ENHANCE_ITEM] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'gold', 'diamonds', 'blacksmithXp', 'blacksmithLevel']);
            
            return { 
                clientResponse: { 
                    updatedUser,
                    enhancementOutcome: { 
                        message: resultMessage, 
                        success: isSuccess, 
                        itemBefore: itemBeforeEnhancement, 
                        itemAfter: item,
                        xpGained: xpGained
                    },
                    enhancementAnimationTarget: { itemId: item.id, stars: item.stars } 
                } 
            };
        }
        case 'REFINE_EQUIPMENT': {
            const { itemId, optionType, optionIndex, refinementType } = payload as {
                itemId: string;
                optionType: 'main' | 'combatSub' | 'specialSub' | 'mythicSub';
                optionIndex: number;
                refinementType: 'type' | 'value' | 'mythic';
            };
            
            const item = user.inventory.find(i => i.id === itemId);
            if (!item || item.type !== 'equipment' || !item.options) {
                return { error: '제련할 수 없는 아이템입니다.' };
            }

            const normalizedRefineItem = normalizeEquipmentOptionNumbers(item);
            Object.assign(item, { options: normalizedRefineItem.options, stars: normalizedRefineItem.stars });
            
            // 일반 등급 장비는 제련 불가
            if (item.grade === ItemGrade.Normal) {
                return { error: '일반 등급 장비는 제련할 수 없습니다.' };
            }
            
            // 제련 가능 횟수 확인
            const currentRefinementCount = (item as any).refinementCount ?? 0;
            if (currentRefinementCount <= 0) {
                return { error: '제련 가능 횟수가 모두 소진되었습니다.' };
            }
            
            // 등급별 소모량
            const getTicketCost = (grade: ItemGrade): number => {
                switch (grade) {
                    case ItemGrade.Uncommon: return 1;
                    case ItemGrade.Rare: return 2;
                    case ItemGrade.Epic: return 3;
                    case ItemGrade.Legendary: return 4;
                    case ItemGrade.Mythic:
                    case ItemGrade.Transcendent:
                        return 5;
                    default: return 1;
                }
            };
            
            const requiredTickets = getTicketCost(item.grade);
            const requiredGold = calculateRefinementGoldCost(item.grade);
            
            // 골드 부족 체크
            if (user.gold < requiredGold) {
                return { error: `골드가 부족합니다. (필요: ${requiredGold.toLocaleString()}, 보유: ${user.gold.toLocaleString()})` };
            }
            
            // 필요한 변경권 확인
            let ticketName: string;
            if (refinementType === 'type') {
                ticketName = '옵션 종류 변경권';
            } else if (refinementType === 'value') {
                ticketName = '옵션 수치 변경권';
            } else if (refinementType === 'mythic') {
                ticketName = '스페셜 옵션 변경권';
            } else {
                return { error: '유효하지 않은 제련 타입입니다.' };
            }
            
            // 변경권 개수 확인 및 소모 (재료 슬롯 type: material + 구버전 consumable 호환)
            const ticketItems = user.inventory.filter(
                i => i.name === ticketName && (i.type === 'material' || i.type === 'consumable')
            );
            const totalTickets = ticketItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
            
            if (totalTickets < requiredTickets) {
                return { error: `${ticketName}이(가) 부족합니다. (필요: ${requiredTickets}, 보유: ${totalTickets})` };
            }
            
            // 변경권 소모
            let remainingToRemove = requiredTickets;
            for (let i = user.inventory.length - 1; i >= 0 && remainingToRemove > 0; i--) {
                const invItem = user.inventory[i];
                if (invItem.name === ticketName && (invItem.type === 'material' || invItem.type === 'consumable')) {
                    const itemQuantity = invItem.quantity || 1;
                    if (itemQuantity <= remainingToRemove) {
                        remainingToRemove -= itemQuantity;
                        user.inventory.splice(i, 1);
                    } else {
                        invItem.quantity = itemQuantity - remainingToRemove;
                        remainingToRemove = 0;
                    }
                }
            }
            
            // 골드 차감
            user.gold -= requiredGold;
            
            const originalItemState = JSON.parse(JSON.stringify(item));
            
            // 옵션 변경 로직
            if (refinementType === 'type') {
                // 옵션 종류 변경
                if (optionType === 'main') {
                    // 주옵션 변경
                    const slot = item.slot!;
                    const grade = item.grade;
                    const slotDef = MAIN_STAT_DEFINITIONS[slot];
                    const gradeDef = slotDef.options[grade];
                    const availableStats = gradeDef.stats.filter(stat => stat !== item.options!.main.type);
                    if (availableStats.length === 0) {
                        return { error: '변경 가능한 주옵션이 없습니다.' };
                    }
                    const newStatType = availableStats[Math.floor(Math.random() * availableStats.length)];
                    const baseValue = gradeDef.value;

                    // 강화된 장비의 stars 누적 강화분을 주옵션에도 다시 적용
                    // (ENHANCE_ITEM은 main.baseValue를 기준으로 stars마다 increaseAmount를 누적하므로,
                    // 여기서는 동일한 방식으로 현재 stars에 해당하는 누적 증가분을 재계산)
                    const stars = item.stars ?? 0;
                    const multipliers = MAIN_ENHANCEMENT_STEP_MULTIPLIER[item.grade];

                    let enhancedIncreaseTotal = 0;
                    for (let i = 0; i < stars; i++) {
                        // ENHANCE_ITEM은 starIndex를 0~9로 clamp해서 사용하므로 여기서도 동일하게 맞춤
                        const idx = Math.max(0, Math.min(9, i)); // 0~9 index
                        const stepBonusMultiplier = getEnhancementStepBonusMultiplier(i + 1);
                        enhancedIncreaseTotal += Math.round(baseValue * (multipliers?.[idx] ?? 1)) * stepBonusMultiplier;
                    }

                    const enhancedValue = parseFloat((baseValue + enhancedIncreaseTotal).toFixed(2));
                    const statName = CORE_STATS_DATA[newStatType]?.name || newStatType;
                    item.options.main = {
                        type: newStatType,
                        value: enhancedValue,
                        baseValue: baseValue,
                        isPercentage: slotDef.isPercentage,
                        display: `${statName} +${enhancedValue}${slotDef.isPercentage ? '%' : ''}`
                    };
                } else if (optionType === 'combatSub') {
                    // 부옵션 변경
                    const slot = item.slot!;
                    const grade = item.grade;
                    const rules = GRADE_SUB_OPTION_RULES[grade];
                    const combatTier = rules.combatTier;
                    const pool = SUB_OPTION_POOLS[slot][combatTier];
                    const usedTypes = new Set([
                        item.options!.main.type,
                        ...item.options!.combatSubs.map(s => s.type),
                        ...item.options!.specialSubs.map(s => s.type),
                        ...item.options!.mythicSubs.map(s => s.type)
                    ]);
                    const availableOptions = pool.filter(opt => !usedTypes.has(opt.type));
                    if (availableOptions.length === 0) {
                        return { error: '변경 가능한 부옵션이 없습니다.' };
                    }
                    const newSubDef = availableOptions[Math.floor(Math.random() * availableOptions.length)];
                    // 해당 슬롯의 기존 combatSub 강화 횟수(enhancements)를 유지해서
                    // 제련 결과도 "강화된 수치" 범위에서 다시 뽑히도록 처리
                    const prevEnhancements = item.options.combatSubs[optionIndex]?.enhancements ?? 0;
                    const range0 = Number(newSubDef.range[0]);
                    const range1 = Number(newSubDef.range[1]);
                    const scaledMin = Math.round(range0 * (1 + prevEnhancements));
                    const scaledMax = Math.round(range1 * (1 + prevEnhancements));
                    const value = getRandomInt(scaledMin, scaledMax);
                    const statName = CORE_STATS_DATA[newSubDef.type]?.name || newSubDef.type;
                    item.options.combatSubs[optionIndex] = {
                        type: newSubDef.type,
                        value,
                        isPercentage: newSubDef.isPercentage,
                        display: `${statName} +${value}${newSubDef.isPercentage ? '%' : ''} [${scaledMin}~${scaledMax}]`,
                        range: [scaledMin, scaledMax],
                        enhancements: prevEnhancements,
                    };
                } else if (optionType === 'specialSub') {
                    // 특수옵션 변경
                    const allSpecialStats = Object.values(SpecialStat);
                    const usedTypes = new Set([
                        item.options!.main.type,
                        ...item.options!.combatSubs.map(s => s.type),
                        ...item.options!.specialSubs.map(s => s.type),
                        ...item.options!.mythicSubs.map(s => s.type)
                    ]);
                    const availableStats = allSpecialStats.filter(stat => !usedTypes.has(stat));
                    if (availableStats.length === 0) {
                        return { error: '변경 가능한 특수옵션이 없습니다.' };
                    }
                    const newStatType = availableStats[Math.floor(Math.random() * availableStats.length)];
                    const subDef = SPECIAL_STATS_DATA[newStatType];
                    const milestones = milestoneTierCountFromStars(item.stars ?? 0);
                    const baseRange = [subDef.range[0], subDef.range[1]] as [number, number];
                    const [scaledMin, scaledMax] = computeSpecialSubRollBoundsAfterMilestones(baseRange, newStatType, milestones);
                    const value = getRandomInt(scaledMin, scaledMax);
                    const rules = GRADE_SUB_OPTION_RULES[item.grade];
                    item.options.specialSubs[optionIndex] = {
                        type: newStatType,
                        value,
                        isPercentage: subDef.isPercentage,
                        tier: rules.combatTier,
                        display: formatSpecialSubItemDisplay(
                            {
                                type: newStatType,
                                value,
                                range: baseRange,
                                enhancements: milestones,
                            },
                            subDef
                        ),
                        range: baseRange,
                        enhancements: milestones,
                    };
                }
            } else if (refinementType === 'value') {
                // 옵션 수치 변경 — 저장된 range만 믿지 않고 풀+enhancements로 허용 구간을 복구(레거시 깨짐 대응)
                if (optionType === 'combatSub') {
                    const subOption = item.options.combatSubs[optionIndex];
                    if (!subOption || !item.slot) {
                        return { error: '수치를 변경할 수 없는 옵션입니다.' };
                    }
                    const rules = GRADE_SUB_OPTION_RULES[item.grade];
                    const pool = SUB_OPTION_POOLS[item.slot][rules.combatTier];
                    const subDef = resolveCombatSubPoolDefinition(
                        pool,
                        subOption.type as CoreStat,
                        subOption.isPercentage
                    );
                    if (!subDef) {
                        return { error: '수치를 변경할 수 없는 옵션입니다.' };
                    }
                    const enh = subOption.enhancements ?? 0;
                    const stored: [number, number] = subOption.range
                        ? [Number(subOption.range[0]), Number(subOption.range[1])]
                        : [subDef.range[0], subDef.range[1]];
                    const repaired = resolveCombatSubValueRefinementRange(stored, subDef, enh);
                    if (!repaired) {
                        return { error: '수치를 변경할 수 없는 옵션입니다.' };
                    }
                    const [r0, r1] = repaired;
                    const newValue = getRandomInt(r0, r1);
                    subOption.value = newValue;
                    subOption.range = [r0, r1];
                    const statName = (CORE_STATS_DATA as any)[subOption.type]?.name || subOption.type;
                    subOption.display = `${statName} +${newValue}${subOption.isPercentage ? '%' : ''} [${r0}~${r1}]`;
                } else if (optionType === 'specialSub') {
                    const subOption = item.options.specialSubs[optionIndex];
                    if (!subOption) {
                        return { error: '수치를 변경할 수 없는 옵션입니다.' };
                    }
                    const subDef = SPECIAL_STATS_DATA[subOption.type as SpecialStat];
                    if (!subDef) {
                        return { error: '수치를 변경할 수 없는 옵션입니다.' };
                    }
                    const enh = subOption.enhancements ?? 0;
                    const stored: [number, number] = subOption.range
                        ? [Number(subOption.range[0]), Number(subOption.range[1])]
                        : [subDef.range[0], subDef.range[1]];
                    const repaired = resolveSpecialSubValueRefinementRange(
                        stored,
                        subDef,
                        enh,
                        subOption.type as SpecialStat
                    );
                    if (!repaired) {
                        return { error: '수치를 변경할 수 없는 옵션입니다.' };
                    }
                    const [r0, r1] = repaired;
                    const newValue = getRandomInt(r0, r1);
                    subOption.value = newValue;
                    subOption.range = [subDef.range[0], subDef.range[1]] as [number, number];
                    subOption.display = formatSpecialSubItemDisplay(
                        {
                            type: subOption.type as SpecialStat,
                            value: newValue,
                            range: subOption.range,
                            enhancements: enh,
                        },
                        subDef
                    );
                } else {
                    return { error: '수치 변경은 부옵션 또는 특수옵션에만 가능합니다.' };
                }
            } else if (refinementType === 'mythic') {
                if (optionType !== 'mythicSub') {
                    return { error: '스페셜 옵션 변경은 스페셜 옵션에만 가능합니다.' };
                }
                if (item.grade !== ItemGrade.Mythic && item.grade !== ItemGrade.Transcendent) {
                    return { error: '스페셜 옵션 변경은 신화·초월 등급 장비에만 가능합니다.' };
                }
                const pool = mythicStatPoolForItemGrade(item.grade);
                const availableStats = pool.filter((stat) => stat !== item.options!.mythicSubs[optionIndex].type);
                if (availableStats.length === 0) {
                    return { error: '변경 가능한 스페셜 옵션이 없습니다.' };
                }
                const newStatType = availableStats[Math.floor(Math.random() * availableStats.length)];
                const subDef = MYTHIC_STATS_DATA[newStatType];
                const value = subDef.value([10, 50]); // range 파라미터는 함수 내부에서 사용되지 않지만 시그니처에 맞춰 전달
                item.options.mythicSubs[optionIndex] = {
                    type: newStatType,
                    value: value,
                    isPercentage: false,
                    display: subDef.name,
                    enhancements: 0,
                };
            }
            
            // 제련 가능 횟수 차감
            (item as any).refinementCount = Math.max(0, ((item as any).refinementCount ?? 0) - 1);
            
            // 인벤토리를 깊은 복사하여 새로운 배열로 할당 (참조 문제 방지)
            user.inventory = JSON.parse(JSON.stringify(user.inventory));
            
            const itemBeforeRefinement = JSON.parse(JSON.stringify(originalItemState));
            
            updateQuestProgress(user, 'equipment_refine_attempt');

            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'REFINE_EQUIPMENT');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[REFINE_EQUIPMENT] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory']);
            
            // 저장 후 업데이트된 아이템 찾기
            const updatedItem = user.inventory.find(i => i.id === itemId);
            if (!updatedItem) {
                console.error(`[REFINE_EQUIPMENT] Updated item not found in inventory: ${itemId}`);
            }
            
            return { 
                clientResponse: { 
                    refinementResult: {
                        message: '제련이 완료되었습니다.',
                        success: true,
                        itemBefore: itemBeforeRefinement,
                        itemAfter: JSON.parse(JSON.stringify(updatedItem))
                    },
                    updatedUser
                } 
            };
        }
        case 'DISASSEMBLE_ITEM': {
            const { itemIds } = payload as { itemIds: string[] };
            if (!itemIds || itemIds.length === 0) return { error: '분해할 아이템을 선택하세요.' };

            const gainedMaterials: Record<string, number> = {};
            const itemsToRemove: string[] = [];
            let totalXpGained = 0;

            for (const itemId of itemIds) {
                const item = user.inventory.find((i: InventoryItem) => i.id === itemId);
                if (!item) continue; // Item not found, skip

                if (item.type !== 'equipment') return { error: '장비 아이템만 분해할 수 있습니다.' };
                if (item.isEquipped) return { error: '장착 중인 아이템은 분해할 수 없습니다.' };

                // 다음 강화 비용 행의 일부를 환급 (+10은 마지막 행 사용 — 미리보기와 동일)
                const costsForNextLevel = getEnhancementCostRowForDisassembly(item.grade, item.stars);

                if (costsForNextLevel) {
                    for (const cost of costsForNextLevel) {
                        const yieldRatio = getRandomInt(20, 50) / 100;
                        const yieldAmount = Math.max(1, Math.floor(cost.amount * yieldRatio));
                        if (yieldAmount > 0) {
                            gainedMaterials[cost.name] = (gainedMaterials[cost.name] || 0) + yieldAmount;
                        }
                    }
                }

                // Add blacksmith XP for disassembly
                const xpGainRange = BLACKSMITH_DISASSEMBLY_XP_GAIN[item.grade];
                if (xpGainRange) {
                    totalXpGained += getRandomInt(xpGainRange[0], xpGainRange[1]);
                }

                itemsToRemove.push(itemId);
            }

            if (itemsToRemove.length === 0) return { error: '분해할 수 있는 아이템이 없습니다.' };

            const baseJackpotRate = BLACKSMITH_DISASSEMBLY_JACKPOT_RATES[user.blacksmithLevel - 1] ?? 0;
            const mannerEffects = effectService.getMannerEffects(user);
            const vipJackpotBonus = isFunctionVipActive(user) ? 10 : 0;
            const jackpotRate = Math.min(
                100,
                baseJackpotRate + (mannerEffects.disassemblyJackpotBonusPercent ?? 0) + vipJackpotBonus,
            );
            const isJackpot = Math.random() * 100 < jackpotRate;
            if (isJackpot) {
                for (const key in gainedMaterials) {
                    gainedMaterials[key] *= 2;
                }
            }
            
            const itemsToAdd: InventoryItem[] = Object.entries(gainedMaterials).map(([name, quantity]) => ({
                ...MATERIAL_ITEMS[name], id: `item-${randomUUID()}`, quantity, createdAt: Date.now(), isEquipped: false, level: 1, stars: 0
            }));
            
            const inventoryAfterRemoval = user.inventory.filter(item => !itemsToRemove.includes(item.id));
            const { success, finalItemsToAdd, updatedInventory } = addItemsToInventoryUtil(inventoryAfterRemoval, user.inventorySlots, itemsToAdd);
            if (!success) return { error: '재료를 받기에 인벤토리 공간이 부족합니다.' };

            user.inventory = updatedInventory;

            // Update blacksmith XP
            let disasmXp = totalXpGained;
            if (isFunctionVipActive(user)) {
                disasmXp = Math.floor(disasmXp * 1.5);
            }
            user.blacksmithXp = (user.blacksmithXp || 0) + disasmXp;
            while (user.blacksmithLevel < BLACKSMITH_MAX_LEVEL && user.blacksmithXp >= BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(user.blacksmithLevel)) {
                user.blacksmithXp -= BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(user.blacksmithLevel);
                user.blacksmithLevel++;
            }

            // 인벤토리를 깊은 복사하여 새로운 배열로 할당 (참조 문제 방지)
            user.inventory = JSON.parse(JSON.stringify(user.inventory));
            
            updateQuestProgress(user, 'equipment_disassemble_attempt');

            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'DISASSEMBLE_ITEM');

            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[DISASSEMBLE_ITEM] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'blacksmithXp', 'blacksmithLevel']);

            return { 
                clientResponse: { 
                    updatedUser,
                    disassemblyResult: { 
                        gained: Object.entries(gainedMaterials).map(([name, amount]) => ({ name, amount })), 
                        jackpot: isJackpot,
                        xpGained: disasmXp
                    }
                }
            };
        }
        case 'CRAFT_MATERIAL': {
            const { materialName, craftType, quantity } = payload as { materialName: string, craftType: 'upgrade' | 'downgrade', quantity: number };
            const materialTiers = ['하급 강화석', '중급 강화석', '상급 강화석', '최상급 강화석', '신비의 강화석'];
            const tierIndex = materialTiers.indexOf(materialName);
            if (tierIndex === -1) return { error: '잘못된 재료입니다.' };
        
            let fromMaterialName: string, toMaterialName: string, fromCost: number, toYield: number;
        
            // 대장간 레벨에 따른 대박 확률 적용 (장비 분해와 동일)
            const blacksmithLevel = user.blacksmithLevel ?? 1;
            const baseJackpotRate = BLACKSMITH_DISASSEMBLY_JACKPOT_RATES[blacksmithLevel - 1] ?? 0;
            const mannerEffects = effectService.getMannerEffects(user);
            const vipJackpotBonus = isFunctionVipActive(user) ? 10 : 0;
            const jackpotRate = Math.min(
                100,
                baseJackpotRate + (mannerEffects.disassemblyJackpotBonusPercent ?? 0) + vipJackpotBonus,
            );
            const isJackpot = Math.random() * 100 < jackpotRate;
            
            if (craftType === 'upgrade') {
                if (tierIndex >= materialTiers.length - 1) return { error: '더 이상 제작할 수 없습니다.' };
                fromMaterialName = materialTiers[tierIndex];
                toMaterialName = materialTiers[tierIndex + 1];
                fromCost = 10 * quantity;
                toYield = 1 * quantity;
                // 대박 발생 시 재료를 2배로 획득
                if (isJackpot) {
                    toYield *= 2;
                }
            } else { // downgrade
                if (tierIndex === 0) return { error: '더 이상 분해할 수 없습니다.' };
                fromMaterialName = materialTiers[tierIndex];
                toMaterialName = materialTiers[tierIndex - 1];
                fromCost = 1 * quantity;
                // 분해 시 기본 분해 개수를 3~5개로 랜덤 분해
                const baseYieldPerItem = getRandomInt(3, 5);
                toYield = baseYieldPerItem * quantity;
                // 대박 발생 시 재료를 2배로 획득
                if (isJackpot) {
                    toYield *= 2;
                }
            }
        
            const tempUser = JSON.parse(JSON.stringify(user));
        
            if (!removeUserItems(tempUser, [{ name: fromMaterialName, amount: fromCost }])) {
                return { error: '재료가 부족합니다.' };
            }
        
            const toAddTemplate = MATERIAL_ITEMS[toMaterialName];
            const itemsToAdd: InventoryItem[] = [{
                ...toAddTemplate, id: `item-${randomUUID()}`, quantity: toYield, createdAt: 0, isEquipped: false, level: 1, stars: 0
            }];
        
            const { success, finalItemsToAdd, updatedInventory } = addItemsToInventoryUtil(tempUser.inventory, tempUser.inventorySlots, itemsToAdd);
            if (!success) {
                return { error: '인벤토리에 공간이 부족합니다.' };
            }
            
            // All checks passed, apply changes to the real user object
            // updatedInventory는 이미 새로운 배열이므로 직접 할당 (성능 최적화)
            user.inventory = updatedInventory;
            
            updateQuestProgress(user, 'craft_attempt');
            
            // Update Guild Mission Progress for material crafts
            if (user.guildId) {
                const guilds = await db.getKV<Record<string, any>>('guilds') || {};
                await guildService.updateGuildMissionProgress(user.guildId, 'materialCrafts', quantity, guilds);
            }
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'CRAFT_MATERIAL', { includeAll: true });

            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[CRAFT_MATERIAL] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory']);
        
            return {
                clientResponse: {
                    updatedUser,
                    craftResult: {
                        gained: [{ name: toMaterialName, amount: toYield }],
                        used: [{ name: fromMaterialName, amount: fromCost }],
                        craftType,
                        jackpot: isJackpot
                    }
                }
            };
        }

        case 'EXPAND_INVENTORY': {
            const { category } = payload as { category: 'equipment' | 'consumable' | 'material' };
            if (!category) return { error: '확장할 인벤토리 탭을 지정해야 합니다.' };

            const BASE_SLOTS_PER_CATEGORY = 30;
            const EXPANSION_AMOUNT = 10;
            const MAX_INVENTORY_SIZE = 100;

            const currentCategorySlots = user.inventorySlots[category] || BASE_SLOTS_PER_CATEGORY;

            if (currentCategorySlots >= MAX_INVENTORY_SIZE) {
                return { error: '이미 최대치까지 확장했습니다.' };
            }

            const expansionsMade = Math.max(0, (currentCategorySlots - BASE_SLOTS_PER_CATEGORY) / EXPANSION_AMOUNT);
            const expansionCost = 100 + (expansionsMade * 20);

            if (user.diamonds < expansionCost) {
                return { error: '다이아가 부족합니다.' };
            }

            user.diamonds -= expansionCost;
            user.inventorySlots[category] += EXPANSION_AMOUNT;

            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'EXPAND_INVENTORY');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[EXPAND_INVENTORY] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventorySlots', 'diamonds']);
            
            return { clientResponse: { updatedUser } };
        }

        default:
            return { error: `Unknown inventory action: ${type}` };
    }
};