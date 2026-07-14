/** 장비 슬롯 강화(+N) 코너 마커 — 얇은 사각 테두리 플레이트 */

/** 슬롯 한 변 대비 마커 한 변 비율(%) — 과하지 않게 작게 */
export const ENHANCE_MARKER_SIZE_PCT = 26;

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
    1: '/images/equipments/EnhanceMarker1.webp',
    2: '/images/equipments/EnhanceMarker2.webp',
    3: '/images/equipments/EnhanceMarker3.webp',
    4: '/images/equipments/EnhanceMarker4.webp',
};

export const ENHANCE_MARKER_NUMBER_CLASS: Record<EnhanceMarkerTier, string> = {
    1: 'text-white',
    2: 'text-amber-400',
    3: 'text-purple-400',
    4: 'prism-text-effect',
};
