import { isSameDayKST, shopPurchaseRecordDateMs } from '../utils/timeUtils.js';

export type ShopAdRewardTab = 'equipment' | 'materials' | 'consumables' | 'diamonds';

/** 탭별 일일 보상 상한 (무료 1회 + 광고 2회) */
export const SHOP_AD_TAB_DAILY_LIMIT = 3;

/** 탭별 일일 무료 보상(광고 없음) 횟수 */
export const SHOP_AD_TAB_FREE_CLAIMS_PER_DAY = 1;

export function getShopAdRewardPurchaseKey(tab: ShopAdRewardTab): string {
    return `ad_reward_${tab}`;
}

export function getShopAdTabClaimsTodayFromRecord(
    dailyShopPurchases: Record<string, { quantity?: number; date?: unknown } | undefined> | null | undefined,
    tab: ShopAdRewardTab,
    nowMs: number,
): number {
    const rec = dailyShopPurchases?.[getShopAdRewardPurchaseKey(tab)];
    if (!rec) return 0;
    const d = shopPurchaseRecordDateMs(rec.date);
    if (!(d > 0)) return 0;
    return isSameDayKST(d, nowMs) ? (rec.quantity ?? 0) : 0;
}

export function getShopAdRemainingForTabFromClaims(claimsToday: number): number {
    return Math.max(0, SHOP_AD_TAB_DAILY_LIMIT - claimsToday);
}

/** 다음 수령에 광고 시청이 필요한지 (광고 제거 유저는 항상 false) */
export function shopAdNextClaimNeedsAd(claimsToday: number, isAdFree: boolean): boolean {
    if (isAdFree) return false;
    return claimsToday >= SHOP_AD_TAB_FREE_CLAIMS_PER_DAY;
}
