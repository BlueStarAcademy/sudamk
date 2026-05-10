import { GUILD_SHOP_ITEMS } from './guildConstants.js';
import { PAIR_EGG_MATERIAL_NAME, PAIR_PET_SHOP_SKUS } from './petLobby.js';

/**
 * 인벤 판매 시 골드만 지급되므로, 다이아로만 파는 상점 품목의 「상점가 상당 골드」 환산에 사용합니다.
 * (`server/shop.ts` 장비 상자 V·VI, 재료 상자 VI, 귀속 해제권, 제련의 부적 등과 동일 비율을 유지하는 것이 좋습니다.)
 */
export const SHOP_DIAMOND_GOLD_EQUIV_FOR_SELL = 100;

/** 상점 골드 구매가의 10%를 판매가(골드)로 — 최소 1골드 */
export function sellGoldTenPercentOfShopGold(shopGold: number): number {
    const g = Math.max(0, Math.floor(Number(shopGold) || 0));
    const v = Math.floor(g * 0.1);
    return v < 1 ? 1 : v;
}

/** 다이아 상점가를 골드로 환산한 뒤 그 금액의 10% */
export function sellGoldTenPercentOfShopDiamonds(diamonds: number): number {
    const d = Math.max(0, Math.floor(Number(diamonds) || 0));
    return sellGoldTenPercentOfShopGold(d * SHOP_DIAMOND_GOLD_EQUIV_FOR_SELL);
}

/**
 * 길드 상점 재화(길드 코인) 구매가를 골드 상당으로 본 뒤 10%.
 * (1길드코인 = 10골드 상당으로 가정 — 강화석 시세가 기존과 크게 어긋나지 않도록 맞춤.)
 */
export function sellGoldTenPercentOfGuildCoinCost(guildCoins: number): number {
    return sellGoldTenPercentOfShopGold(Number(guildCoins) * 10);
}

const GUILD_ENHANCEMENT_STONE_NAMES = new Set([
    '하급 강화석',
    '중급 강화석',
    '상급 강화석',
    '최상급 강화석',
    '신비의 강화석',
]);

/** `GUILD_SHOP_ITEMS` 중 강화석 재료의 판매 골드(상점 길드코인가 기준 10%). */
export function buildGuildEnhancementStoneSellPrices(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const it of GUILD_SHOP_ITEMS) {
        if (it.type === 'material' && GUILD_ENHANCEMENT_STONE_NAMES.has(it.name)) {
            out[it.name] = sellGoldTenPercentOfGuildCoinCost(it.cost);
        }
    }
    return out;
}

/** 페어 상점 `PAIR_PET_SHOP_SKUS`의 알 SKU 중 최저 골드상당 구매가의 10% */
export function pairMysteryEggSellGoldPerUnit(): number {
    const skus = PAIR_PET_SHOP_SKUS.filter((s) => s.materialName === PAIR_EGG_MATERIAL_NAME);
    let minEquiv = Infinity;
    for (const s of skus) {
        const equiv =
            Math.max(0, Math.floor(Number(s.gold) || 0)) +
            Math.max(0, Math.floor(Number(s.diamonds) || 0)) * SHOP_DIAMOND_GOLD_EQUIV_FOR_SELL;
        minEquiv = Math.min(minEquiv, equiv);
    }
    if (!Number.isFinite(minEquiv) || minEquiv <= 0) {
        return sellGoldTenPercentOfShopGold(5000);
    }
    return sellGoldTenPercentOfShopGold(minEquiv);
}
