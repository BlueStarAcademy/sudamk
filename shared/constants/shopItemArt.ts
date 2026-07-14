/** 상점·패키지 전용 아트 경로 (아이템 템플릿 image와 별도) */
export const SHOP_AD_REWARD_IMAGE = '/images/shop/ad_reward.webp';
export const SHOP_REMOVE_ADS_IMAGE = '/images/shop/remove_ads_package.webp';

export const SHOP_EQUIPMENT_BONUS_IMAGES = {
    epic: '/images/shop/equipment_bonus_epic.webp',
    legendary: '/images/shop/equipment_bonus_legendary.webp',
    mythic: '/images/shop/equipment_bonus_mythic.webp',
} as const;

export type ShopEquipmentBonusGradeWord = keyof typeof SHOP_EQUIPMENT_BONUS_IMAGES;
