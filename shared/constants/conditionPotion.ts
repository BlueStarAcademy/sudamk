/** 컨디션 회복제 단일 카탈로그 — 서버·클라·모달·상점이 동일 수치를 사용한다. */

export type ConditionPotionType = 'small' | 'medium' | 'large';

export type ConditionPotionGrade = 'normal' | 'uncommon' | 'rare';

export type ConditionPotionDefinition = {
    name: string;
    itemId: string;
    minRecovery: number;
    maxRecovery: number;
    shopGold: number;
    image: string;
    grade: ConditionPotionGrade;
    dailyShopLimit: number;
};

export const CONDITION_POTION_TYPES = ['small', 'medium', 'large'] as const satisfies readonly ConditionPotionType[];

export const CONDITION_POTION_BY_TYPE: Record<ConditionPotionType, ConditionPotionDefinition> = {
    small: {
        name: '컨디션회복제(소)',
        itemId: 'condition_potion_small',
        minRecovery: 5,
        maxRecovery: 15,
        shopGold: 100,
        image: '/images/use/con1.webp',
        grade: 'normal',
        dailyShopLimit: 3,
    },
    medium: {
        name: '컨디션회복제(중)',
        itemId: 'condition_potion_medium',
        minRecovery: 15,
        maxRecovery: 25,
        shopGold: 150,
        image: '/images/use/con2.webp',
        grade: 'uncommon',
        dailyShopLimit: 3,
    },
    large: {
        name: '컨디션회복제(대)',
        itemId: 'condition_potion_large',
        minRecovery: 25,
        maxRecovery: 35,
        shopGold: 200,
        image: '/images/use/con3.webp',
        grade: 'rare',
        dailyShopLimit: 3,
    },
};

/** @deprecated `CONDITION_POTION_BY_TYPE[type].shopGold` 사용 */
export const CONDITION_POTION_SHOP_GOLD_BY_TYPE = {
    small: CONDITION_POTION_BY_TYPE.small.shopGold,
    medium: CONDITION_POTION_BY_TYPE.medium.shopGold,
    large: CONDITION_POTION_BY_TYPE.large.shopGold,
} as const;

export function isConditionPotionType(value: unknown): value is ConditionPotionType {
    return value === 'small' || value === 'medium' || value === 'large';
}

export function getConditionPotionDefinition(type: ConditionPotionType): ConditionPotionDefinition {
    return CONDITION_POTION_BY_TYPE[type];
}

export function rollConditionPotionRecovery(
    type: ConditionPotionType,
    random: () => number = Math.random,
): number {
    const def = CONDITION_POTION_BY_TYPE[type];
    const span = def.maxRecovery - def.minRecovery + 1;
    return def.minRecovery + Math.floor(random() * span);
}

/** 클라 낙관적 UI: 서버 확정 전 표시용 중간값 */
export function optimisticConditionPotionRecovery(type: ConditionPotionType): number {
    const def = CONDITION_POTION_BY_TYPE[type];
    return Math.floor((def.minRecovery + def.maxRecovery) / 2);
}
