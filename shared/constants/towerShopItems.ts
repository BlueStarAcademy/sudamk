import type { UserWithStatus } from '../types/entities.js';
import { isSameDayKST } from '../utils/timeUtils.js';
import {
    countTowerLobbyInventoryQty,
    towerShopInventoryNameOrIdsForItem,
} from '../../utils/towerLobbyInventory.js';

export interface TowerShopItemDef {
    itemId: string;
    name: string;
    icon: string;
    price: { gold?: number; diamonds?: number };
    maxOwned: number;
    dailyPurchaseLimit: number;
    description: string;
}

/** 서버 `BUY_TOWER_ITEM`·대기실·경기장 상점과 동일 */
export const TOWER_SHOP_ITEMS: TowerShopItemDef[] = [
    {
        itemId: '턴 추가',
        name: '턴 추가',
        icon: '/images/button/addturn.webp',
        price: { gold: 300 },
        maxOwned: 3,
        dailyPurchaseLimit: 3,
        description:
            '도전의 탑 1~20층에서 사용 가능한 아이템입니다. 흑의 턴이 부족할 때 사용하면 턴수 제한이 3턴 증가합니다.',
    },
    {
        itemId: '미사일',
        name: '미사일',
        icon: '/images/button/missile.webp',
        price: { gold: 300 },
        maxOwned: 2,
        dailyPurchaseLimit: 2,
        description:
            '도전의 탑 21~100층에서 사용 가능한 아이템입니다. 이미 놓여진 내 돌을 발사하여 이동시킬 수 있습니다.',
    },
    {
        itemId: '히든',
        name: '히든',
        icon: '/images/button/hidden.webp',
        price: { gold: 500 },
        maxOwned: 2,
        dailyPurchaseLimit: 2,
        description:
            '도전의 탑 21~100층에서 사용 가능한 히든 아이템입니다. 상대에게 보이지 않는 돌을 배치할 수 있습니다.',
    },
    {
        itemId: '스캔',
        name: '스캔',
        icon: '/images/button/scan.webp',
        price: { gold: 400 },
        maxOwned: 2,
        dailyPurchaseLimit: 2,
        description:
            '도전의 탑 21~100층에서 사용 가능한 스캔 아이템입니다. 상대방의 히든 돌을 찾아낼 수 있습니다.',
    },
    {
        itemId: '배치변경',
        name: '배치변경',
        icon: '/images/button/reflesh.webp',
        price: { gold: 100 },
        maxOwned: 5,
        dailyPurchaseLimit: 5,
        description:
            '도전의 탑 모든 층에서 사용 가능한 배치변경 아이템입니다. 초기 돌 배치를 다시 랜덤하게 변경할 수 있습니다.',
    },
];

export function resolveTowerShopItem(itemId?: string | null): TowerShopItemDef {
    if (itemId) {
        const exact = TOWER_SHOP_ITEMS.find((i) => i.itemId === itemId);
        if (exact) return exact;
        const needle = itemId.trim().toLowerCase();
        // i18n 라벨·영문 별칭(`Hidden`, `scan`, …)으로 연 경우에도 올바른 상점 항목 선택
        for (const item of TOWER_SHOP_ITEMS) {
            const aliases = towerShopInventoryNameOrIdsForItem(item.itemId);
            if (aliases.some((n) => n === itemId || n.toLowerCase() === needle)) {
                return item;
            }
        }
    }
    return TOWER_SHOP_ITEMS[0]!;
}

/** 게임 설명 그리드 슬롯 key 등 → 상점 itemId */
export function towerShopItemIdFromSlotKey(slotKey: string): string | undefined {
    switch (slotKey) {
        case 'turn-add':
            return '턴 추가';
        case 'missile':
            return '미사일';
        case 'hidden':
            return '히든';
        case 'scan':
            return '스캔';
        case 'refresh':
            return '배치변경';
        default:
            if (TOWER_SHOP_ITEMS.some((i) => i.itemId === slotKey)) return slotKey;
            return undefined;
    }
}

export function getTowerItemTodayPurchased(user: UserWithStatus, itemId: string, nowMs = Date.now()): number {
    const purchaseRecord = user.dailyShopPurchases?.[itemId];
    if (!purchaseRecord || typeof purchaseRecord !== 'object') return 0;
    const date = typeof purchaseRecord.date === 'number' ? purchaseRecord.date : undefined;
    if (date == null || !isSameDayKST(date, nowMs)) return 0;
    const qty = typeof purchaseRecord.quantity === 'number' ? purchaseRecord.quantity : 0;
    return Math.max(0, qty);
}

export function getTowerItemPurchaseLimit(
    user: UserWithStatus,
    item: TowerShopItemDef,
    nowMs = Date.now()
): {
    currentOwned: number;
    todayPurchased: number;
    maxCanBuy: number;
    remainingDaily: number;
    remainingOwned: number;
} {
    const currentOwned = countTowerLobbyInventoryQty(
        user.inventory,
        towerShopInventoryNameOrIdsForItem(item.itemId)
    );
    const todayPurchased = getTowerItemTodayPurchased(user, item.itemId, nowMs);
    const remainingDaily = Math.max(0, item.dailyPurchaseLimit - todayPurchased);
    const remainingOwned = Math.max(0, item.maxOwned - currentOwned);
    const maxByGold = item.price.gold ? Math.floor((user.gold || 0) / item.price.gold) : Infinity;
    const maxByDiamonds = item.price.diamonds ? Math.floor((user.diamonds || 0) / item.price.diamonds) : Infinity;
    const maxCanBuy = Math.min(remainingDaily, remainingOwned, maxByGold, maxByDiamonds);
    return { currentOwned, todayPurchased, maxCanBuy, remainingDaily, remainingOwned };
}

export function buildTowerShopPurchasableItem(user: UserWithStatus, itemId: string) {
    const item = resolveTowerShopItem(itemId);
    const { currentOwned, todayPurchased } = getTowerItemPurchaseLimit(user, item);
    return {
        itemId: item.itemId,
        name: item.name,
        price: item.price,
        type: 'consumable' as const,
        description: item.description,
        image: item.icon,
        towerPurchaseLimits: {
            maxOwned: item.maxOwned,
            currentOwned,
            dailyPurchaseLimit: item.dailyPurchaseLimit,
            todayPurchased,
        },
    };
}
