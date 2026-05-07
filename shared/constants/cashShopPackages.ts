import { ItemGrade } from '../types/enums.js';

/** 유료 패키지(상점 패키지 탭) — 서버·클라이언트 공통 */
export const CASH_SHOP_DIAMOND_PACKAGE_IDS = ['diamond_package_1', 'diamond_package_2', 'diamond_package_3'] as const;
export type CashShopDiamondPackageId = (typeof CASH_SHOP_DIAMOND_PACKAGE_IDS)[number];

export const CASH_SHOP_EQUIPMENT_PACKAGE_IDS = ['equipment_package_1', 'equipment_package_2', 'equipment_package_3'] as const;
export type CashShopEquipmentPackageId = (typeof CASH_SHOP_EQUIPMENT_PACKAGE_IDS)[number];

/** 1회 구매 영구 적용 — 상점·배너 등 광고 비표시 */
export const CASH_SHOP_REMOVE_ADS_PACKAGE_ID = 'remove_ads' as const;

export const CASH_SHOP_PACKAGE_IDS = [
    ...CASH_SHOP_DIAMOND_PACKAGE_IDS,
    ...CASH_SHOP_EQUIPMENT_PACKAGE_IDS,
    CASH_SHOP_REMOVE_ADS_PACKAGE_ID,
] as const;
export type CashShopPackageId = (typeof CASH_SHOP_PACKAGE_IDS)[number];

/** 관리자 우편·UI 표기용 */
export const CASH_SHOP_PACKAGE_KO_LABEL: Record<CashShopPackageId, string> = {
    diamond_package_1: '다이아패키지Ⅰ',
    diamond_package_2: '다이아패키지Ⅱ',
    diamond_package_3: '다이아패키지Ⅲ',
    equipment_package_1: '장비상자 패키지 Ⅰ',
    equipment_package_2: '장비상자 패키지 Ⅱ',
    equipment_package_3: '장비상자 패키지 Ⅲ',
    remove_ads: '광고 제거',
};

export const DIAMOND_PACKAGE_DURATION_DAYS: Record<CashShopDiamondPackageId, number> = {
    diamond_package_1: 7,
    diamond_package_2: 15,
    diamond_package_3: 30,
};

export const DIAMOND_PACKAGE_INSTANT_DIAMONDS: Record<CashShopDiamondPackageId, number> = {
    diamond_package_1: 100,
    diamond_package_2: 250,
    diamond_package_3: 750,
};

export const DIAMOND_PACKAGE_DAILY_MAIL_DIAMONDS = 50;

export const DIAMOND_PACKAGE_TIER_ROMAN: Record<CashShopDiamondPackageId, 'I' | 'II' | 'III'> = {
    diamond_package_1: 'I',
    diamond_package_2: 'II',
    diamond_package_3: 'III',
};

export function diamondPackageIdToTier(id: CashShopDiamondPackageId): 1 | 2 | 3 {
    if (id === 'diamond_package_1') return 1;
    if (id === 'diamond_package_2') return 2;
    return 3;
}

/** 장비상자 패키지 월간 구매 한도 (KST 월 기준, `dailyShopPurchases`와 동일 패턴) */
export const EQUIPMENT_PACKAGE_MONTHLY_LIMIT: Record<CashShopEquipmentPackageId, number> = {
    equipment_package_1: 30,
    equipment_package_2: 10,
    equipment_package_3: 5,
};

/** 패키지별 확정 장비 1개 추가 지급 등급 */
export const EQUIPMENT_PACKAGE_BONUS_GRADE: Record<CashShopEquipmentPackageId, ItemGrade> = {
    equipment_package_1: ItemGrade.Epic,
    equipment_package_2: ItemGrade.Legendary,
    equipment_package_3: ItemGrade.Mythic,
};
