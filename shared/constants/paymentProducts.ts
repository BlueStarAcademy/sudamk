import { VIP_SHOP_PRODUCT_IDS, type VipShopProductId } from './vipShopProducts.js';
import { CASH_SHOP_PACKAGE_IDS, type CashShopPackageId } from './cashShopPackages.js';

/**
 * 유료 상품 가격 단일 소스 (KRW).
 * - 서버가 주문 생성 시 이 표만 신뢰한다 — 클라이언트가 보낸 금액은 절대 사용하지 않는다.
 * - ShopModal 등 프론트 표기도 여기서 import (하드코딩 금지).
 */

/** 다이아 직접 충전 상품 */
export const DIRECT_DIAMOND_PRODUCT_IDS = ['diamond_500', 'diamond_1250', 'diamond_2250'] as const;
export type DirectDiamondProductId = (typeof DIRECT_DIAMOND_PRODUCT_IDS)[number];

export const DIRECT_DIAMOND_AMOUNTS: Record<DirectDiamondProductId, number> = {
    diamond_500: 500,
    diamond_1250: 1250,
    diamond_2250: 2250,
};

export type PaymentProductId = VipShopProductId | CashShopPackageId | DirectDiamondProductId;

export const PAYMENT_PRODUCT_IDS: readonly PaymentProductId[] = [
    ...VIP_SHOP_PRODUCT_IDS,
    ...CASH_SHOP_PACKAGE_IDS,
    ...DIRECT_DIAMOND_PRODUCT_IDS,
];

/** 상품별 판매가 (KRW, VAT 포함) */
export const PAYMENT_PRODUCT_PRICE_KRW: Record<PaymentProductId, number> = {
    // VIP (30일)
    reward_vip: 10_900,
    function_vip: 10_900,
    vvip: 17_900,
    // 다이아 패키지 (기간 지급 + 즉시 지급)
    diamond_package_1: 10_900,
    diamond_package_2: 19_900,
    diamond_package_3: 29_900,
    // 장비 패키지
    equipment_package_1: 10_900,
    equipment_package_2: 15_900,
    equipment_package_3: 20_900,
    // 광고 제거 (영구)
    remove_ads: 10_900,
    // 다이아 직접 충전
    diamond_500: 10_900,
    diamond_1250: 19_900,
    diamond_2250: 29_900,
};

export function isPaymentProductId(id: string): id is PaymentProductId {
    return (PAYMENT_PRODUCT_IDS as readonly string[]).includes(id);
}

export function getPaymentProductPriceKRW(id: PaymentProductId): number {
    return PAYMENT_PRODUCT_PRICE_KRW[id];
}
