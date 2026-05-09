


import { randomUUID } from 'crypto';
import * as db from '../db.js';
import { type ServerAction, type User, type VolatileState, type LiveGameSession, InventoryItem, EquipmentSlot, Mail } from '../../types/index.js';
import * as shop from '../shop.js';
import { SHOP_ITEMS } from '../shop.js';
import { broadcast } from '../socket.js';
import {
    isSameDayKST,
    isDifferentWeekKST,
    isDifferentMonthKST,
    getTodayKSTDateString,
    shopPurchaseRecordDateMs,
} from '../../shared/utils/timeUtils.js';
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS, ACTION_POINT_PURCHASE_COSTS_DIAMONDS, MAX_ACTION_POINT_PURCHASES_PER_DAY, ACTION_POINT_PURCHASE_REFILL_AMOUNT, SHOP_BORDER_ITEMS } from '../../constants';
import { addItemsToInventory, createItemInstancesFromReward } from '../../utils/inventoryUtils.js';
import { getSelectiveUserUpdate } from '../utils/userUpdateHelper.js';
import { recordAchievementBoxOpens } from '../achievementBoxOpenProgress.js';
import { generateNewItem } from './inventoryActions.js';
import {
    CASH_SHOP_DIAMOND_PACKAGE_IDS,
    CASH_SHOP_EQUIPMENT_PACKAGE_IDS,
    CASH_SHOP_REMOVE_ADS_PACKAGE_ID,
    type CashShopDiamondPackageId,
    type CashShopEquipmentPackageId,
    DIAMOND_PACKAGE_DURATION_DAYS,
    DIAMOND_PACKAGE_INSTANT_DIAMONDS,
    DIAMOND_PACKAGE_DAILY_MAIL_DIAMONDS,
    EQUIPMENT_PACKAGE_MONTHLY_LIMIT,
    EQUIPMENT_PACKAGE_BONUS_GRADE,
    diamondPackageIdToTier,
} from '../../shared/constants/cashShopPackages.js';
import {
    VIP_SHOP_PRODUCT_IDS,
    type VipShopProductId,
    VIP_SHOP_DURATION_DAYS,
    getVipShopGrantFlagsForProductId,
} from '../../shared/constants/vipShopProducts.js';
import { applyVipDurationExtensionToUser } from '../../shared/utils/vipDurationGrant.js';
import * as guildService from '../guildService.js';
import { DEFAULT_REWARD_CONFIG, normalizeRewardConfig } from '../../shared/constants/rewardConfig.js';
import { ItemGrade } from '../../shared/types/enums.js';

type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
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

const CASH_PACKAGE_EQUIP_SLOTS: EquipmentSlot[] = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];

/** 장비상자 패키지: 미개봉 상자는 인벤에 상자 아이템으로 적재, 확정 장비만 즉시 생성 지급 */
export function collectEquipmentCashPackageLoot(packageId: CashShopEquipmentPackageId): InventoryItem[] {
    const sealedDefs: { itemId: string; quantity: number }[] =
        packageId === 'equipment_package_1'
            ? [
                  { itemId: '장비 상자 V', quantity: 1 },
                  { itemId: '재료 상자 VI', quantity: 1 },
              ]
            : packageId === 'equipment_package_2'
              ? [
                    { itemId: '장비 상자 V', quantity: 2 },
                    { itemId: '재료 상자 VI', quantity: 2 },
                ]
              : [
                    { itemId: '장비 상자 VI', quantity: 2 },
                    { itemId: '재료 상자 VI', quantity: 5 },
                ];
    const sealed = createItemInstancesFromReward(sealedDefs);
    const bonusGrade = EQUIPMENT_PACKAGE_BONUS_GRADE[packageId];
    const slot = CASH_PACKAGE_EQUIP_SLOTS[Math.floor(Math.random() * CASH_PACKAGE_EQUIP_SLOTS.length)];
    const bonusEquipment = generateNewItem(bonusGrade, slot);
    return [...sealed, bonusEquipment];
}

/** 우편 수령 등: 상점 `BUY_CASH_PACKAGE`(다이아 패키지)와 동일한 유저 상태·즉시 다이아·당일 일일 우편 반영 */
export function grantDiamondCashShopPackageFromMail(user: User, packageId: CashShopDiamondPackageId, now: number): void {
    const days = DIAMOND_PACKAGE_DURATION_DAYS[packageId];
    const instant = DIAMOND_PACKAGE_INSTANT_DIAMONDS[packageId];
    const tier = diamondPackageIdToTier(packageId);

    user.diamonds = (user.diamonds || 0) + instant;
    user.activeDiamondPackageTier = tier;
    user.diamondPackageExpiresAt = now + days * 86400000;
    user.diamondPackageLastMailDayKST = getTodayKSTDateString(now);

    if (!user.mail) user.mail = [];
    const dayMail: Mail = {
        id: `mail-diamond-pkg-day0-${randomUUID()}`,
        from: 'System',
        title: '다이아 패키지 일일 보상',
        message: `다이아 패키지 혜택으로 다이아 ${DIAMOND_PACKAGE_DAILY_MAIL_DIAMONDS}개를 우편으로 드립니다. 7일 이내 수령해 주세요.`,
        attachments: { diamonds: DIAMOND_PACKAGE_DAILY_MAIL_DIAMONDS },
        receivedAt: now,
        expiresAt: now + 7 * 86400000,
        isRead: false,
        attachmentsClaimed: false,
    };
    user.mail.unshift(dayMail);
}

export const handleShopAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type, payload } = action as any;

    switch (type) {
        case 'BUY_SHOP_ITEM': {
            try {
                const { itemId, quantity } = payload;
                
                if (!itemId || typeof quantity !== 'number' || quantity <= 0) {
                    return { error: '유효하지 않은 요청입니다.' };
                }
                
                const shopItem = SHOP_ITEMS[itemId as keyof typeof SHOP_ITEMS];
                if (!shopItem || shopItem.type !== 'equipment') {
                    return { error: '유효하지 않은 장비 상자입니다.' };
                }

                const cost = shopItem.cost;
                const totalGoldCost = (cost.gold || 0) * quantity;
                const totalDiamondCost = (cost.diamonds || 0) * quantity;

                if (!user.isAdmin) {
                    if (user.gold < totalGoldCost || user.diamonds < totalDiamondCost) {
                        return { error: '재화가 부족합니다.' };
                    }
                }

                const obtainedItems: InventoryItem[] = [];
                for (let i = 0; i < quantity; i++) {
                    try {
                        const result = shopItem.onPurchase();
                        obtainedItems.push(...(Array.isArray(result) ? result : [result]));
                    } catch (error: any) {
                        console.error(`[BUY_SHOP_ITEM] Error in onPurchase for item ${itemId}:`, error);
                        return { error: '아이템 생성 중 오류가 발생했습니다.' };
                    }
                }

                if (!user.inventory) {
                    user.inventory = [];
                }
                if (!user.inventorySlots) {
                    user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
                }

                const { success, finalItemsToAdd, updatedInventory } = addItemsToInventory(user.inventory, user.inventorySlots, obtainedItems);
                if (!success || !updatedInventory) {
                    return { error: '인벤토리 공간이 부족합니다.' };
                }
                
                if (!user.isAdmin) {
                    user.gold -= totalGoldCost;
                    user.diamonds -= totalDiamondCost;
                    
                    // Update Guild Mission Progress for diamonds spent
                    if (totalDiamondCost > 0 && user.guildId) {
                        const guilds = await db.getKV<Record<string, any>>('guilds') || {};
                        await guildService.updateGuildMissionProgress(user.guildId, 'diamondsSpent', totalDiamondCost, guilds);
                    }
                }

                // updatedInventory는 이미 새로운 배열이므로 직접 할당 (성능 최적화)
                user.inventory = updatedInventory;

                recordAchievementBoxOpens(user, 'equipment', quantity);

                await guildService.recordGuildEpicPlusEquipmentAcquisition(user, obtainedItems);
                
                // 선택적 필드만 반환 (메시지 크기 최적화)
                const updatedUser = getSelectiveUserUpdate(user, 'BUY_SHOP_ITEM', { includeAll: true });

                // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
                db.updateUser(user).catch(err => {
                    console.error(`[BUY_SHOP_ITEM] Failed to save user ${user.id}:`, err);
                });

                // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['inventory', 'gold', 'diamonds', 'quests']);

                return { clientResponse: { obtainedItemsBulk: obtainedItems, updatedUser } };
            } catch (error: any) {
                console.error(`[BUY_SHOP_ITEM] Unexpected error:`, error);
                console.error(`[BUY_SHOP_ITEM] Error stack:`, error.stack);
                return { error: '구매 처리 중 오류가 발생했습니다.' };
            }
        }
        case 'BUY_MATERIAL_BOX': {
            const { itemId, quantity } = payload;
            const shopItem = SHOP_ITEMS[itemId as keyof typeof SHOP_ITEMS] as any;

            if (!shopItem || shopItem.type !== 'material') {
                return { error: '유효하지 않은 재료 상자입니다.' };
            }
            
            const now = Date.now();
            if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
            const purchaseRecord = user.dailyShopPurchases[itemId];

            let purchasesThisPeriod = 0;
            let limit = Infinity;
            let limitText = '';
            let resetPurchaseRecord = false;
        
            if (shopItem.weeklyLimit) {
                limit = shopItem.weeklyLimit;
                // FIX: Corrected typo from `limitType` to `limitText`.
                limitText = '이번 주';
                if (purchaseRecord && !isDifferentWeekKST(purchaseRecord.date, now)) {
                    purchasesThisPeriod = purchaseRecord.quantity;
                } else {
                    resetPurchaseRecord = true;
                }
            } else if (shopItem.dailyLimit) {
                limit = shopItem.dailyLimit;
                // FIX: Corrected typo from `limitType` to `limitText`.
                limitText = '오늘';
                if (purchaseRecord && isSameDayKST(purchaseRecord.date, now)) {
                    purchasesThisPeriod = purchaseRecord.quantity;
                } else {
                    resetPurchaseRecord = true;
                }
            }
            
            if (!user.isAdmin) {
                if (purchasesThisPeriod + quantity > limit) {
                    // FIX: Corrected typo from `limitType` to `limitText`.
                    return { error: `${limitText} 구매 한도를 초과했습니다.` };
                }
            }
            
            const allObtainedItems: InventoryItem[] = [];
            for (let i = 0; i < quantity; i++) {
                const itemsFromBox = shopItem.onPurchase();
                allObtainedItems.push(...itemsFromBox);
            }
            
            if (!user.inventory) {
                user.inventory = [];
            }
            if (!user.inventorySlots) {
                user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
            }
            
            const { success, finalItemsToAdd, updatedInventory } = addItemsToInventory(user.inventory, user.inventorySlots, allObtainedItems);
            if (!success || !updatedInventory) {
                return { error: '모든 아이템을 받기에 가방 공간이 부족합니다.' };
            }

            const totalCost = {
                gold: (shopItem.cost.gold || 0) * quantity,
                diamonds: (shopItem.cost.diamonds || 0) * quantity,
            };
            
            if (!user.isAdmin) {
                if (user.gold < totalCost.gold || user.diamonds < totalCost.diamonds) {
                    return { error: '재화가 부족합니다.' };
                }
                user.gold -= totalCost.gold;
                user.diamonds -= totalCost.diamonds;
                
                // Update Guild Mission Progress for diamonds spent
                if (totalCost.diamonds > 0 && user.guildId) {
                    const guilds = await db.getKV<Record<string, any>>('guilds') || {};
                    await guildService.updateGuildMissionProgress(user.guildId, 'diamondsSpent', totalCost.diamonds, guilds);
                }
            }
            
            // 인벤토리를 깊은 복사하여 새로운 배열로 할당 (참조 문제 방지)
            user.inventory = JSON.parse(JSON.stringify(updatedInventory));

            recordAchievementBoxOpens(user, 'material', quantity);
            
            if (!user.isAdmin) {
                if (resetPurchaseRecord || !user.dailyShopPurchases[itemId]) {
                    user.dailyShopPurchases[itemId] = { quantity: 0, date: now };
                }
                user.dailyShopPurchases[itemId].quantity = purchasesThisPeriod + quantity;
                user.dailyShopPurchases[itemId].date = now;
            }
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'BUY_MATERIAL_BOX', { includeAll: true });

            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[BUY_MATERIAL_BOX] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'gold', 'diamonds', 'dailyShopPurchases', 'quests']);

            // 아이템을 이름별로 집계하되, 원본 아이템의 모든 속성(image 포함)을 보존
            const itemMap = new Map<string, InventoryItem>();
            allObtainedItems.forEach(item => {
                if (itemMap.has(item.name)) {
                    const existing = itemMap.get(item.name)!;
                    existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
                } else {
                    // 원본 아이템을 깊은 복사하여 보존
                    itemMap.set(item.name, {
                        ...item,
                        quantity: item.quantity || 1
                    });
                }
            });
            const itemsToAdd = Array.from(itemMap.values());

            return { clientResponse: { obtainedItemsBulk: itemsToAdd, updatedUser } };
        }
        case 'PURCHASE_ACTION_POINTS': {
            const now = Date.now();
            const purchasesToday = isSameDayKST(user.lastActionPointPurchaseDate || 0, now) 
                ? (user.actionPointPurchasesToday || 0) 
                : 0;

            if (purchasesToday >= MAX_ACTION_POINT_PURCHASES_PER_DAY && !user.isAdmin) {
                return { error: '오늘 구매 한도를 초과했습니다.' };
            }

            const costTier = Math.min(purchasesToday, ACTION_POINT_PURCHASE_COSTS_DIAMONDS.length - 1);
            const cost = ACTION_POINT_PURCHASE_COSTS_DIAMONDS[costTier];
            if (cost == null || !Number.isFinite(cost)) {
                return { error: '행동력 충전 가격 설정 오류입니다.' };
            }
            if (user.diamonds < cost && !user.isAdmin) {
                return { error: '다이아가 부족합니다.' };
            }

            if (!user.isAdmin) {
                user.diamonds -= cost;
                user.actionPointPurchasesToday = purchasesToday + 1;
                user.lastActionPointPurchaseDate = now;
                
                // Update Guild Mission Progress for diamonds spent
                if (cost > 0 && user.guildId) {
                    const guilds = await db.getKV<Record<string, any>>('guilds') || {};
                    await guildService.updateGuildMissionProgress(user.guildId, 'diamondsSpent', cost, guilds);
                }
            }
            user.actionPoints.current += ACTION_POINT_PURCHASE_REFILL_AMOUNT;
            
            const updatedUser = getSelectiveUserUpdate(user, 'PURCHASE_ACTION_POINTS');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[PURCHASE_ACTION_POINTS] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['actionPoints', 'diamonds', 'actionPointPurchasesToday', 'lastActionPointPurchaseDate']);
            
            return { clientResponse: { updatedUser } };
        }
        case 'EXPAND_INVENTORY': {
            const { category } = payload as { category: keyof User['inventorySlots'] };
            const EXPANSION_COST_DIAMONDS = 100;
            const EXPANSION_AMOUNT = 10;
            const MAX_INVENTORY_SIZE = 100;
            
            if (user.inventorySlots[category] >= MAX_INVENTORY_SIZE) {
                return { error: '가방을 더 이상 확장할 수 없습니다.' };
            }

            if (!user.isAdmin) {
                if (user.diamonds < EXPANSION_COST_DIAMONDS) {
                    return { error: '다이아가 부족합니다.' };
                }
                user.diamonds -= EXPANSION_COST_DIAMONDS;
                
                // Update Guild Mission Progress for diamonds spent
                if (user.guildId) {
                    const guilds = await db.getKV<Record<string, any>>('guilds') || {};
                    await guildService.updateGuildMissionProgress(user.guildId, 'diamondsSpent', EXPANSION_COST_DIAMONDS, guilds);
                }
            }
            
            user.inventorySlots[category] = Math.min(MAX_INVENTORY_SIZE, user.inventorySlots[category] + EXPANSION_AMOUNT);
            
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
        case 'BUY_BORDER': {
            const { borderId } = payload;
            const borderItem = SHOP_BORDER_ITEMS.find(b => b.id === borderId);
            if (!borderItem) return { error: '판매하지 않는 테두리입니다.' };
            if (user.ownedBorders.includes(borderId)) return { error: '이미 보유한 테두리입니다.' };

            const cost = borderItem.price.gold || 0;
            if (user.gold < cost && !user.isAdmin) return { error: '골드가 부족합니다.' };
            
            const diamondCost = borderItem.price.diamonds || 0;
            if (user.diamonds < diamondCost && !user.isAdmin) return { error: '다이아가 부족합니다.' };

            if (!user.isAdmin) {
                user.gold -= cost;
                user.diamonds -= diamondCost;
                
                // Update Guild Mission Progress for diamonds spent
                if (diamondCost > 0 && user.guildId) {
                    const guilds = await db.getKV<Record<string, any>>('guilds') || {};
                    await guildService.updateGuildMissionProgress(user.guildId, 'diamondsSpent', diamondCost, guilds);
                }
            }

            user.ownedBorders.push(borderId);
            
            const updatedUser = getSelectiveUserUpdate(user, 'BUY_BORDER');
            
            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[BUY_BORDER] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['ownedBorders', 'gold', 'diamonds']);
            
            return { clientResponse: { updatedUser } };
        }
        case 'BUY_CONDITION_POTION': {
            const { potionType, quantity } = payload as { potionType: 'small' | 'medium' | 'large'; quantity: number };
            
            const potionInfo = {
                small: { name: '컨디션회복제(소)', price: 180 },
                medium: { name: '컨디션회복제(중)', price: 270 },
                large: { name: '컨디션회복제(대)', price: 360 }
            }[potionType];

            if (!potionInfo) {
                return { error: '유효하지 않은 회복제 타입입니다.' };
            }

            if (typeof quantity !== 'number' || quantity <= 0) {
                return { error: '유효하지 않은 수량입니다.' };
            }

            const now = Date.now();
            const itemId = `condition_potion_${potionType}`;
            const DAILY_LIMIT = 3;

            // 일일 구매 제한 체크
            if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
            const purchaseRecord = user.dailyShopPurchases[itemId];
            
            let purchasesToday = 0;
            if (purchaseRecord && isSameDayKST(purchaseRecord.date, now)) {
                purchasesToday = purchaseRecord.quantity;
            }

            if (!user.isAdmin) {
                if (purchasesToday + quantity > DAILY_LIMIT) {
                    return { error: `오늘 구매 한도를 초과했습니다. (남은 구매 가능: ${DAILY_LIMIT - purchasesToday}개)` };
                }
            }

            const totalCost = potionInfo.price * quantity;
            if (!user.isAdmin) {
                if (user.gold < totalCost) {
                    return { error: `골드가 부족합니다. (필요: ${totalCost} 골드)` };
                }
            }

            // 아이템 생성
            const template = CONSUMABLE_ITEMS.find(item => item.name === potionInfo.name);
            if (!template) {
                return { error: '회복제 템플릿을 찾을 수 없습니다.' };
            }

            const newItem: InventoryItem = {
                ...template,
                id: `item-${randomUUID()}`,
                createdAt: Date.now(),
                quantity: quantity,
                isEquipped: false,
                level: 1,
                stars: 0,
            };

            if (!user.inventory) {
                user.inventory = [];
            }
            if (!user.inventorySlots) {
                user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
            }

            // 인벤토리에 추가
            const { success, finalItemsToAdd, updatedInventory } = addItemsToInventory(user.inventory, user.inventorySlots, [newItem]);
            if (!success || !updatedInventory) {
                return { error: '인벤토리 공간이 부족합니다.' };
            }

            // 골드 차감 및 구매 기록 업데이트
            if (!user.isAdmin) {
                user.gold -= totalCost;
                if (!user.dailyShopPurchases[itemId] || !isSameDayKST(purchaseRecord?.date || 0, now)) {
                    user.dailyShopPurchases[itemId] = { quantity: 0, date: now };
                }
                user.dailyShopPurchases[itemId].quantity = purchasesToday + quantity;
                user.dailyShopPurchases[itemId].date = now;
            }

            // 인벤토리를 깊은 복사하여 새로운 배열로 할당 (참조 문제 방지)
            user.inventory = JSON.parse(JSON.stringify(updatedInventory));
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'BUY_CONDITION_POTION', { includeAll: true });

            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[BUY_CONDITION_POTION] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'gold', 'dailyShopPurchases']);

            return { 
                clientResponse: { 
                    obtainedItemsBulk: [{ ...newItem }], 
                    updatedUser 
                } 
            };
        }
        case 'BUY_CONSUMABLE': {
            const { itemId, quantity } = payload;
            
            if (!itemId || typeof quantity !== 'number' || quantity <= 0) {
                return { error: '유효하지 않은 요청입니다.' };
            }

            // 변경권·행동력 회복제 아이템 정의 (행동력 회복제는 품목별 일일 1개, 고정 골드가)
            const consumableItems: Record<string, { name: string; price?: number; dailyLimit: number; prices?: number[]; currency?: 'gold' | 'diamonds' }> = {
                'option_type_change_ticket': { name: '옵션 종류 변경권', price: 2000, dailyLimit: 3 },
                'option_value_change_ticket': { name: '옵션 수치 변경권', price: 500, dailyLimit: 10 },
                'mythic_option_change_ticket': { name: '스페셜 옵션 변경권', price: 500, dailyLimit: 10 },
                'equipment_unbind_ticket': { name: '귀속 해제권', price: 50, dailyLimit: 10, currency: 'diamonds' },
                'refinement_charm': { name: '제련의 부적', price: 100, dailyLimit: 1, currency: 'diamonds' },
                'action_point_10': { name: '행동력 회복제(+10)', dailyLimit: 1, prices: [1000] },
                'action_point_20': { name: '행동력 회복제(+20)', dailyLimit: 1, prices: [1500] },
                'action_point_30': { name: '행동력 회복제(+30)', dailyLimit: 1, prices: [2000] },
            };

            const itemInfo = consumableItems[itemId];
            if (!itemInfo) {
                return { error: '유효하지 않은 아이템입니다.' };
            }

            const now = Date.now();
            const DAILY_LIMIT = itemInfo.dailyLimit;

            // 일일 구매 제한 체크
            if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
            const purchaseRecord = user.dailyShopPurchases[itemId];
            
            let purchasesToday = 0;
            if (purchaseRecord && isSameDayKST(purchaseRecord.date, now)) {
                purchasesToday = purchaseRecord.quantity;
            }

            if (!user.isAdmin) {
                if (purchasesToday + quantity > DAILY_LIMIT) {
                    return { error: `오늘 구매 한도를 초과했습니다. (남은 구매 가능: ${DAILY_LIMIT - purchasesToday}개)` };
                }
            }

            // 구매 회차별 가격(행동력 회복제) 또는 고정 가격
            let totalCost: number;
            if (itemInfo.prices) {
                totalCost = 0;
                for (let i = 0; i < quantity; i++) {
                    const priceIndex = Math.min(purchasesToday + i, itemInfo.prices.length - 1);
                    totalCost += itemInfo.prices[priceIndex] ?? itemInfo.prices[itemInfo.prices.length - 1];
                }
            } else {
                totalCost = (itemInfo.price ?? 0) * quantity;
            }
            const priceCurrency = itemInfo.currency ?? 'gold';
            if (!user.isAdmin) {
                if (priceCurrency === 'diamonds' && user.diamonds < totalCost) {
                    return { error: `다이아가 부족합니다. (필요: ${totalCost} 다이아)` };
                }
                if (priceCurrency === 'gold' && user.gold < totalCost) {
                    return { error: `골드가 부족합니다. (필요: ${totalCost} 골드)` };
                }
            }

            // 아이템 생성 (변경권 3종은 재료로 분류되어 MATERIAL_ITEMS에 있음)
            const template = CONSUMABLE_ITEMS.find(item => item.name === itemInfo.name) ?? MATERIAL_ITEMS[itemInfo.name];
            if (!template) {
                return { error: '아이템 템플릿을 찾을 수 없습니다.' };
            }

            const newItem: InventoryItem = {
                ...template,
                id: `item-${randomUUID()}`,
                createdAt: Date.now(),
                quantity: quantity,
                isEquipped: false,
                level: 1,
                stars: 0,
            };

            if (!user.inventory) {
                user.inventory = [];
            }
            if (!user.inventorySlots) {
                user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
            }

            // 인벤토리에 추가
            const { success, finalItemsToAdd, updatedInventory } = addItemsToInventory(user.inventory, user.inventorySlots, [newItem]);
            if (!success || !updatedInventory) {
                return { error: '인벤토리 공간이 부족합니다.' };
            }

            // 재화 차감 및 구매 기록 업데이트
            if (!user.isAdmin) {
                if (priceCurrency === 'diamonds') user.diamonds -= totalCost;
                else user.gold -= totalCost;
                if (priceCurrency === 'diamonds' && totalCost > 0 && user.guildId) {
                    const guilds = await db.getKV<Record<string, any>>('guilds') || {};
                    await guildService.updateGuildMissionProgress(user.guildId, 'diamondsSpent', totalCost, guilds);
                }
                if (!user.dailyShopPurchases[itemId] || !isSameDayKST(purchaseRecord?.date || 0, now)) {
                    user.dailyShopPurchases[itemId] = { quantity: 0, date: now };
                }
                user.dailyShopPurchases[itemId].quantity = purchasesToday + quantity;
                user.dailyShopPurchases[itemId].date = now;
            }

            // 인벤토리를 깊은 복사하여 새로운 배열로 할당 (참조 문제 방지)
            user.inventory = JSON.parse(JSON.stringify(updatedInventory));
            
            // 선택적 필드만 반환 (메시지 크기 최적화)
            const updatedUser = getSelectiveUserUpdate(user, 'BUY_CONSUMABLE', { includeAll: true });

            // DB 업데이트를 비동기로 처리 (응답 지연 최소화)
            db.updateUser(user).catch(err => {
                console.error(`[BUY_CONSUMABLE] Failed to save user ${user.id}:`, err);
            });

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'gold', 'diamonds', 'dailyShopPurchases']);

            return { 
                clientResponse: { 
                    obtainedItemsBulk: [{ ...newItem }], 
                    updatedUser 
                } 
            };
        }
        case 'CLAIM_SHOP_AD_REWARD': {
            const { tab } = (payload || {}) as { tab?: 'equipment' | 'materials' | 'consumables' | 'diamonds' };
            if (!tab || !['equipment', 'materials', 'consumables', 'diamonds'].includes(tab)) {
                return { error: '유효하지 않은 상점 탭입니다.' };
            }

            const now = Date.now();
            const rewardConfig = await getRewardConfig();
            /** 탭당 1회 · 장비/재료/소모품/다이아 탭별 1회, 일 총 3회 */
            const PER_TAB_DAILY_LIMIT = 1;
            const GLOBAL_DAILY_LIMIT = 3;
            const purchaseKey = `ad_reward_${tab}`;
            const globalPurchaseKey = 'ad_reward_global';
            if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
            const rec = user.dailyShopPurchases[purchaseKey];
            const tabDateMs = shopPurchaseRecordDateMs(rec?.date);
            const claimsToday = rec && tabDateMs > 0 && isSameDayKST(tabDateMs, now) ? rec.quantity : 0;
            const globalRec = user.dailyShopPurchases[globalPurchaseKey];
            const globalDateMs = shopPurchaseRecordDateMs(globalRec?.date);
            const globalClaimsToday =
                globalRec && globalDateMs > 0 && isSameDayKST(globalDateMs, now) ? globalRec.quantity : 0;
            if (!user.isAdmin && claimsToday >= PER_TAB_DAILY_LIMIT) {
                return { error: '오늘 광고 보상 수령 한도에 도달했습니다.' };
            }
            if (!user.isAdmin && globalClaimsToday >= GLOBAL_DAILY_LIMIT) {
                return { error: '오늘 광고 보상 일일 총 수령 한도에 도달했습니다.' };
            }

            const obtainedItems: InventoryItem[] = [];
            if (tab === 'diamonds') {
                const gainedDiamonds = addRewardBonus(10, rewardConfig.shopAdDiamondBonus);
                user.diamonds = (user.diamonds || 0) + gainedDiamonds;
                obtainedItems.push({
                    id: `shop-ad-diamond-reward-${randomUUID()}`,
                    name: '다이아몬드',
                    description: '상점 광고 보상으로 획득한 다이아몬드입니다.',
                    type: 'material',
                    slot: null,
                    quantity: gainedDiamonds,
                    level: 1,
                    isEquipped: false,
                    createdAt: now,
                    image: '/images/icon/Zem.png',
                    grade: ItemGrade.Normal,
                    stars: 0,
                });
            } else {
                let rewards: InventoryItem[] = [];
                if (tab === 'equipment') {
                    const reward = SHOP_ITEMS['equipment_box_2']?.onPurchase?.();
                    rewards = Array.isArray(reward) ? reward : (reward ? [reward] : []);
                } else if (tab === 'materials') {
                    const reward = SHOP_ITEMS['material_box_2']?.onPurchase?.();
                    rewards = Array.isArray(reward) ? reward : (reward ? [reward] : []);
                } else if (tab === 'consumables') {
                    const rewardName = '행동력 회복제(+10)' as const;
                    const template = CONSUMABLE_ITEMS.find((item) => item.name === rewardName);
                    if (!template) return { error: '행동력 회복제 템플릿을 찾을 수 없습니다.' };
                    rewards = [{
                        ...template,
                        id: `item-${randomUUID()}`,
                        createdAt: now,
                        quantity: 1,
                        isEquipped: false,
                        level: 1,
                        stars: 0,
                    }];
                }

                if (!user.inventory) user.inventory = [];
                if (!user.inventorySlots) {
                    user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
                }
                const { success, updatedInventory } = addItemsToInventory(user.inventory, user.inventorySlots, rewards);
                if (!success || !updatedInventory) {
                    return { error: '인벤토리 공간이 부족합니다.' };
                }
                user.inventory = JSON.parse(JSON.stringify(updatedInventory));
                obtainedItems.push(...rewards);
                if (tab === 'equipment') {
                    recordAchievementBoxOpens(user, 'equipment', 1);
                } else if (tab === 'materials') {
                    recordAchievementBoxOpens(user, 'material', 1);
                }
            }

            if (!user.isAdmin) {
                user.dailyShopPurchases[purchaseKey] = { quantity: claimsToday + 1, date: now };
                user.dailyShopPurchases[globalPurchaseKey] = { quantity: globalClaimsToday + 1, date: now };
            }

            const updatedUser = getSelectiveUserUpdate(user, 'CLAIM_SHOP_AD_REWARD', { includeAll: true });
            db.updateUser(user).catch((err) => {
                console.error(`[CLAIM_SHOP_AD_REWARD] Failed to save user ${user.id}:`, err);
            });

            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(
                user,
                tab === 'equipment' || tab === 'materials'
                    ? ['inventory', 'diamonds', 'dailyShopPurchases', 'quests']
                    : ['inventory', 'diamonds', 'dailyShopPurchases'],
            );

            return {
                clientResponse: {
                    updatedUser,
                    obtainedItemsBulk: obtainedItems,
                },
            };
        }
        case 'BUY_VIP_PACKAGE': {
            const { packageId, billing } = (payload || {}) as {
                packageId?: string;
                /** 기본 일회성. `subscription`이면 동일 30일 연장 + 자동갱신 등록 */
                billing?: 'one_time' | 'subscription';
            };
            if (!packageId || typeof packageId !== 'string') {
                return { error: '유효하지 않은 상품입니다.' };
            }
            if (!(VIP_SHOP_PRODUCT_IDS as readonly string[]).includes(packageId)) {
                return { error: '유효하지 않은 VIP 상품입니다.' };
            }
            if (!user.isAdmin) {
                return { error: '아직 구현되지 않았습니다.' };
            }
            const id = packageId as VipShopProductId;
            const days = VIP_SHOP_DURATION_DAYS[id];
            const flags = getVipShopGrantFlagsForProductId(id);
            const now = Date.now();
            applyVipDurationExtensionToUser(user, flags, days * 86400000, now);

            if (billing === 'subscription') {
                if (!user.vipShopAutoRenew) user.vipShopAutoRenew = {};
                user.vipShopAutoRenew[id] = true;
            }

            const updatedUser = getSelectiveUserUpdate(user, 'BUY_VIP_PACKAGE', { includeAll: true });
            db.updateUser(user).catch((err) => console.error(`[BUY_VIP_PACKAGE] Failed to save user ${user.id}:`, err));
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['rewardVipExpiresAt', 'functionVipExpiresAt', 'vvipExpiresAt', 'vipShopAutoRenew']);
            return { clientResponse: { updatedUser } };
        }
        case 'CANCEL_VIP_SHOP_AUTO_RENEW': {
            const { packageId } = (payload || {}) as { packageId?: string };
            if (!packageId || typeof packageId !== 'string') {
                return { error: '유효하지 않은 상품입니다.' };
            }
            if (!(VIP_SHOP_PRODUCT_IDS as readonly string[]).includes(packageId)) {
                return { error: '유효하지 않은 VIP 상품입니다.' };
            }
            if (!user.isAdmin) {
                return { error: '아직 구현되지 않았습니다.' };
            }
            const id = packageId as VipShopProductId;
            if (user.vipShopAutoRenew && user.vipShopAutoRenew[id]) {
                const next = { ...user.vipShopAutoRenew };
                delete next[id];
                user.vipShopAutoRenew = Object.keys(next).length > 0 ? next : undefined;
            }
            const updatedUser = getSelectiveUserUpdate(user, 'CANCEL_VIP_SHOP_AUTO_RENEW', { includeAll: true });
            db.updateUser(user).catch((err) =>
                console.error(`[CANCEL_VIP_SHOP_AUTO_RENEW] Failed to save user ${user.id}:`, err),
            );
            const { broadcastUserUpdate } = await import('../socket.js');
            broadcastUserUpdate(user, ['vipShopAutoRenew']);
            return { clientResponse: { updatedUser } };
        }
        case 'BUY_CASH_PACKAGE': {
            const { packageId } = (payload || {}) as { packageId?: string };
            if (!packageId || typeof packageId !== 'string') {
                return { error: '유효하지 않은 패키지입니다.' };
            }
            if (!user.isAdmin) {
                return { error: '아직 구현되지 않았습니다.' };
            }

            const now = Date.now();

            if ((CASH_SHOP_DIAMOND_PACKAGE_IDS as readonly string[]).includes(packageId)) {
                const id = packageId as CashShopDiamondPackageId;
                if (!user.isAdmin && (user.diamondPackageExpiresAt ?? 0) > now) {
                    return { error: '진행 중인 다이아 패키지가 있을 때는 추가 구매할 수 없습니다.' };
                }
                grantDiamondCashShopPackageFromMail(user, id, now);

                const updatedUser = getSelectiveUserUpdate(user, 'BUY_CASH_PACKAGE', { includeAll: true });
                db.updateUser(user).catch((err) => console.error(`[BUY_CASH_PACKAGE] Failed to save user ${user.id}:`, err));
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, [
                    'diamonds',
                    'mail',
                    'activeDiamondPackageTier',
                    'diamondPackageExpiresAt',
                    'diamondPackageLastMailDayKST',
                ]);
                return { clientResponse: { updatedUser } };
            }

            if ((CASH_SHOP_EQUIPMENT_PACKAGE_IDS as readonly string[]).includes(packageId)) {
                const id = packageId as CashShopEquipmentPackageId;
                const monthlyLimit = EQUIPMENT_PACKAGE_MONTHLY_LIMIT[id];
                if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
                const rec = user.dailyShopPurchases[packageId];
                let purchasesThisMonth = 0;
                if (rec && !isDifferentMonthKST(rec.date, now)) {
                    purchasesThisMonth = rec.quantity;
                }
                if (!user.isAdmin && purchasesThisMonth >= monthlyLimit) {
                    return { error: '이번 달 구매 한도에 도달했습니다.' };
                }

                const obtainedItems = collectEquipmentCashPackageLoot(id);
                if (!user.inventory) user.inventory = [];
                if (!user.inventorySlots) {
                    user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
                }
                const { success, updatedInventory } = addItemsToInventory(user.inventory, user.inventorySlots, obtainedItems);
                if (!success || !updatedInventory) {
                    return { error: '인벤토리 공간이 부족합니다.' };
                }
                user.inventory = JSON.parse(JSON.stringify(updatedInventory));

                if (!user.isAdmin) {
                    const nextQty = purchasesThisMonth + 1;
                    user.dailyShopPurchases[packageId] = { quantity: nextQty, date: now };
                }

                const bonusEquipment = obtainedItems[obtainedItems.length - 1];
                await guildService.recordGuildEpicPlusEquipmentAcquisition(user, bonusEquipment ? [bonusEquipment] : []);

                const updatedUser = getSelectiveUserUpdate(user, 'BUY_CASH_PACKAGE', { includeAll: true });
                db.updateUser(user).catch((err) => console.error(`[BUY_CASH_PACKAGE] Failed to save user ${user.id}:`, err));
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['inventory', 'dailyShopPurchases', 'quests']);
                return { clientResponse: { obtainedItemsBulk: obtainedItems, updatedUser } };
            }

            if (packageId === CASH_SHOP_REMOVE_ADS_PACKAGE_ID) {
                if (user.removeAdsPurchased) {
                    return { error: '이미 광고 제거 상품을 보유 중입니다.' };
                }
                user.removeAdsPurchased = true;
                const updatedUser = getSelectiveUserUpdate(user, 'BUY_CASH_PACKAGE', { includeAll: true });
                db.updateUser(user).catch((err) => console.error(`[BUY_CASH_PACKAGE] Failed to save user ${user.id}:`, err));
                const { broadcastUserUpdate } = await import('../socket.js');
                broadcastUserUpdate(user, ['removeAdsPurchased']);
                return { clientResponse: { updatedUser } };
            }

            return { error: '알 수 없는 패키지입니다.' };
        }
        case 'BUY_TOWER_ITEM': {
            const { itemId, quantity, gameId: payloadTowerGameId } = payload as {
                itemId: string;
                quantity: number;
                gameId?: string;
            };
            
            if (!itemId || typeof quantity !== 'number' || quantity <= 0) {
                return { error: '유효하지 않은 요청입니다.' };
            }

            // 도전의 탑 아이템 정의
            const towerItems: Record<string, { name: string; price: { gold?: number; diamonds?: number }; maxOwned: number; dailyLimit: number }> = {
                '턴 추가': { name: '턴 추가', price: { gold: 300 }, maxOwned: 3, dailyLimit: 3 },
                '미사일': { name: '미사일', price: { gold: 300 }, maxOwned: 2, dailyLimit: 2 },
                '히든': { name: '히든', price: { gold: 500 }, maxOwned: 2, dailyLimit: 2 },
                '스캔': { name: '스캔', price: { gold: 400 }, maxOwned: 2, dailyLimit: 2 },
                '배치변경': { name: '배치변경', price: { gold: 100 }, maxOwned: 5, dailyLimit: 5 }
            };

            const itemInfo = towerItems[itemId];
            if (!itemInfo) {
                return { error: '유효하지 않은 아이템입니다.' };
            }

            const now = Date.now();
            
            // 현재 보유 개수: 대기실과 동일 (source === 'tower' 또는 구 스택 source 없음)
            const { countTowerLobbyInventoryQty } = await import('../modes/towerPlayerHidden.js');
            const currentOwned = countTowerLobbyInventoryQty(user.inventory, [itemInfo.name, itemId]);

            // 보유 제한 확인
            if (!user.isAdmin && currentOwned + quantity > itemInfo.maxOwned) {
                return { error: `최대 보유 개수(${itemInfo.maxOwned}개)를 초과할 수 없습니다.` };
            }

            // 하루 구매 제한 확인
            if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
            const purchaseRecord = user.dailyShopPurchases[itemId];
            const todayPurchased = (purchaseRecord && isSameDayKST(purchaseRecord.date, now)) ? purchaseRecord.quantity : 0;

            if (!user.isAdmin && todayPurchased + quantity > itemInfo.dailyLimit) {
                return { error: `하루 구매 한도(${itemInfo.dailyLimit}개)를 초과했습니다.` };
            }

            // 가격 확인
            const totalGoldCost = (itemInfo.price.gold || 0) * quantity;
            const totalDiamondCost = (itemInfo.price.diamonds || 0) * quantity;

            if (!user.isAdmin) {
                if (user.gold < totalGoldCost || user.diamonds < totalDiamondCost) {
                    return { error: '재화가 부족합니다.' };
                }
            }

            // 아이템 템플릿 찾기
            const template = CONSUMABLE_ITEMS.find(item => item.name === itemInfo.name);
            if (!template) {
                return { error: '아이템 템플릿을 찾을 수 없습니다.' };
            }

            // 아이템 생성 (도전의 탑 전용 표시)
            const newItem: InventoryItem = {
                ...template,
                id: `item-${randomUUID()}`,
                createdAt: now,
                quantity: quantity,
                isEquipped: false,
                level: 1,
                stars: 0,
                source: 'tower',
            };

            if (!user.inventory) {
                user.inventory = [];
            }
            if (!user.inventorySlots) {
                user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
            }

            // 인벤토리에 추가
            const { success, finalItemsToAdd, updatedInventory } = addItemsToInventory(user.inventory, user.inventorySlots, [newItem]);
            if (!success || !updatedInventory) {
                return { error: '인벤토리 공간이 부족합니다.' };
            }

            // 골드/다이아 차감
            if (!user.isAdmin) {
                user.gold -= totalGoldCost;
                user.diamonds -= totalDiamondCost;
                
                // Update Guild Mission Progress for diamonds spent
                if (totalDiamondCost > 0 && user.guildId) {
                    const guilds = await db.getKV<Record<string, any>>('guilds') || {};
                    await guildService.updateGuildMissionProgress(user.guildId, 'diamondsSpent', totalDiamondCost, guilds);
                }
            }

            // 인벤토리 업데이트
            user.inventory = JSON.parse(JSON.stringify(updatedInventory));

            // 구매 기록 업데이트
            if (!user.isAdmin) {
                if (!purchaseRecord || !isSameDayKST(purchaseRecord.date, now)) {
                    user.dailyShopPurchases[itemId] = { quantity: 0, date: now };
                }
                user.dailyShopPurchases[itemId].quantity = todayPurchased + quantity;
                user.dailyShopPurchases[itemId].date = now;
            }

            const updatedUser = getSelectiveUserUpdate(user, 'BUY_TOWER_ITEM', { includeAll: true });

            // 장바구니 일괄 구매 시 다음 요청이 최신 상태를 보도록 DB 저장을 완료한 뒤 응답
            try {
                await db.updateUser(user);
            } catch (err) {
                console.error(`[BUY_TOWER_ITEM] Failed to save user ${user.id}:`, err);
                return { error: '보상 저장에 실패했습니다.' };
            }

            // WebSocket으로 사용자 업데이트 브로드캐스트 (최적화된 함수 사용)
            const { broadcastUserUpdate, broadcastToGameParticipants } = await import('../socket.js');
            broadcastUserUpdate(user, ['inventory', 'gold', 'diamonds', 'dailyShopPurchases']);

            let towerGameAfterPurchase: LiveGameSession | null = null;
            const st = volatileState.userStatuses[user.id];
            const resolvedTowerGameId =
                typeof payloadTowerGameId === 'string' && payloadTowerGameId.startsWith('tower-game-')
                    ? payloadTowerGameId
                    : st?.gameCategory === 'tower' && st.gameId?.startsWith('tower-game-')
                      ? st.gameId
                      : undefined;
            if (resolvedTowerGameId) {
                const { getCachedGame, updateGameCache } = await import('../gameCache.js');
                const { bumpTowerSessionConsumablesAfterShopPurchase } = await import('../modes/towerPlayerHidden.js');
                let g: LiveGameSession | null = await getCachedGame(resolvedTowerGameId);
                if (!g && volatileState.gameCache?.get(resolvedTowerGameId)) {
                    g = volatileState.gameCache.get(resolvedTowerGameId)!.game as LiveGameSession;
                }
                if (!g) {
                    g = await db.getLiveGame(resolvedTowerGameId);
                }
                if (
                    g &&
                    g.gameCategory === 'tower' &&
                    g.player1?.id === user.id &&
                    g.gameStatus === 'playing' &&
                    bumpTowerSessionConsumablesAfterShopPurchase(g, itemId, quantity)
                ) {
                    updateGameCache(g);
                    towerGameAfterPurchase = g;
                    await db.saveGame(g).catch((err) => {
                        console.error(`[BUY_TOWER_ITEM] Failed to save game ${g.id}:`, err);
                    });
                    broadcastToGameParticipants(g.id, { type: 'GAME_UPDATE', payload: { [g.id]: g } }, g);
                }
            }

            return {
                clientResponse: {
                    obtainedItemsBulk: finalItemsToAdd,
                    updatedUser,
                    ...(towerGameAfterPurchase
                        ? { game: towerGameAfterPurchase, gameId: towerGameAfterPurchase.id }
                        : {}),
                },
            };
        }
        default:
            return { error: 'Unknown shop action.' };
    }
};