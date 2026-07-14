/** 장비 슬롯 강화(+N) 코너 마커 — 단계별 별 이미지 + 중앙 숫자 */

/**
 * 슬롯 한 변 대비 마커 한 변 비율(%).
 * EquipmentStatusBadge(24%)보다 살짝 작게 — 장비 아이콘을 가리지 않게.
 */
export const ENHANCE_MARKER_SIZE_PCT = 22;

export type EnhanceMarkerTier = 1 | 2 | 3 | 4;

export function getEnhanceMarkerTier(stars: number): EnhanceMarkerTier | null {
    const n = Math.floor(Number(stars) || 0);
    if (n <= 0) return null;
    if (n >= 10) return 4;
    if (n >= 7) return 3;
    if (n >= 4) return 2;
    return 1;
}

export const ENHANCE_MARKER_IMAGES: Record<EnhanceMarkerTier, string> = {
    1: '/images/equipments/Star1.webp',
    2: '/images/equipments/Star2.webp',
    3: '/images/equipments/Star3.webp',
    4: '/images/equipments/Star4.webp',
};

export const ENHANCE_MARKER_NUMBER_CLASS: Record<EnhanceMarkerTier, string> = {
    1: 'text-white',
    2: 'text-amber-400',
    3: 'text-purple-400',
    4: 'text-white',
};
