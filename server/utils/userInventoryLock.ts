/**
 * 인벤토리·거래소 등 유저 단위 변경이 동시에 겹치면 마지막 저장이 이전 스냅샷으로 덮어써
 * (합성 재료 복원, 거래소 등록 플래그 소실 등) 가방이 꼬인다.
 */
const tailByUser = new Map<string, Promise<void>>();

export async function withUserInventoryLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const prev = tailByUser.get(userId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    const chained = prev.then(() => gate);
    tailByUser.set(userId, chained);
    await prev;
    try {
        return await fn();
    } finally {
        release();
        if (tailByUser.get(userId) === chained) {
            tailByUser.delete(userId);
        }
    }
}

import type { User } from '../../types/index.js';

/** 캐시/DB 최신 유저를 베이스로, 요청 핸들러의 user 객체에 동기화 */
export async function hydrateUserFromLatestInventory(user: User): Promise<void> {
    const { getCachedUser } = await import('../gameCache.js');
    const fresh = await getCachedUser(user.id);
    if (!fresh) return;
    user.inventory = fresh.inventory;
    user.equipment = fresh.equipment;
    user.equipmentPresets = fresh.equipmentPresets;
    user.gold = fresh.gold;
    user.diamonds = fresh.diamonds;
    if (fresh.exchangeState !== undefined) {
        user.exchangeState = fresh.exchangeState;
    }
}
