/** 대장간 레벨에 따른 외형 티어 (이미지·이름 교체 구간). */
export type BlacksmithVisualTier = 1 | 2 | 3 | 4 | 5;

const BLACKSMITH_VISUAL_TIER_MIN_LEVEL: Record<BlacksmithVisualTier, number> = {
    1: 1,
    2: 5,
    3: 10,
    4: 15,
    5: 20,
};

const BLACKSMITH_VISUAL_TIER_IMAGE: Record<BlacksmithVisualTier, string> = {
    1: '/images/equipments/moru.webp',
    2: '/images/equipments/moru-lv5.webp',
    3: '/images/equipments/moru-lv10.webp',
    4: '/images/equipments/moru-lv15.webp',
    5: '/images/equipments/moru-lv20.webp',
};

export function resolveBlacksmithVisualTier(level: number): BlacksmithVisualTier {
    const lv = Math.max(1, Math.floor(Number(level) || 1));
    if (lv >= BLACKSMITH_VISUAL_TIER_MIN_LEVEL[5]) return 5;
    if (lv >= BLACKSMITH_VISUAL_TIER_MIN_LEVEL[4]) return 4;
    if (lv >= BLACKSMITH_VISUAL_TIER_MIN_LEVEL[3]) return 3;
    if (lv >= BLACKSMITH_VISUAL_TIER_MIN_LEVEL[2]) return 2;
    return 1;
}

/** 대장간 레벨에 맞는 대표 이미지 경로. */
export function getBlacksmithVisualImageSrc(level: number): string {
    return BLACKSMITH_VISUAL_TIER_IMAGE[resolveBlacksmithVisualTier(level)];
}

/** i18n `blacksmith.visualNames.tierN` 키. */
export function getBlacksmithVisualNameKey(level: number): `visualNames.tier${BlacksmithVisualTier}` {
    return `visualNames.tier${resolveBlacksmithVisualTier(level)}`;
}
