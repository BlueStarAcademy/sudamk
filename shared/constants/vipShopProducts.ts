import type { AdminVipGrantFlags } from '../utils/vipDurationGrant.js';

/** 상점 VIP 탭 현금 상품 ID — 서버·클라이언트 공통 */
export const VIP_SHOP_PRODUCT_IDS = ['reward_vip', 'function_vip', 'vvip'] as const;
export type VipShopProductId = (typeof VIP_SHOP_PRODUCT_IDS)[number];

/** 각 상품별 연장 일수 (표시·적용 공통) */
export const VIP_SHOP_DURATION_DAYS: Record<VipShopProductId, number> = {
    reward_vip: 30,
    function_vip: 30,
    vvip: 30,
};

export function getVipShopGrantFlagsForProductId(id: VipShopProductId): AdminVipGrantFlags {
    switch (id) {
        case 'reward_vip':
            return { grantRewardVip: true, grantFunctionVip: false, grantVvip: false };
        case 'function_vip':
            return { grantRewardVip: false, grantFunctionVip: true, grantVvip: false };
        case 'vvip':
            return { grantRewardVip: false, grantFunctionVip: false, grantVvip: true };
        default:
            return { grantRewardVip: false, grantFunctionVip: false, grantVvip: false };
    }
}
