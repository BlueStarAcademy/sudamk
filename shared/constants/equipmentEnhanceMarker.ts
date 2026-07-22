/** 장비 슬롯 강화(+N) 코너 마커 — 단계별 별 이미지 + 중앙 숫자(+10은 Star4에 숫자 베이크) */

/**
 * 슬롯 한 변 대비 마커 한 변 비율(%).
 * 별 중앙에 숫자가 들어오도록 살짝 키움 (상태 배지 ~24%와 비슷한 체감).
 */
export const ENHANCE_MARKER_SIZE_PCT = 28;

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

/**
 * 별 본체 보색·고대비 숫자.
 * 1 은백 → 거의 검정, 2 금색 → 짙은 갈갈, 3 보라 → 밝은 노랑, 4 프리즘 → 검정(+흰 외곽, 이미지 베이크)
 */
export const ENHANCE_MARKER_NUMBER_CLASS: Record<EnhanceMarkerTier, string> = {
    1: 'text-[#05070f]',
    2: 'text-[#2a1400]',
    3: 'text-[#fff8c8]',
    4: 'text-[#0a0a0a]',
};

/** 별 내 중앙 안전 영역용 기본 숫자 크기 (cqmin) */
export const ENHANCE_MARKER_NUMBER_CQMIN = {
    single: 42,
} as const;

/** 숫자 가독용 어두운 원판 — 별 그라데이션에 숫자가 묻히지 않게 */
export const ENHANCE_MARKER_NUMBER_DISC: Record<Exclude<EnhanceMarkerTier, 4>, string> = {
    /** 은백 별: 중간 농도 남색 원판 */
    1: 'bg-[#0b1224]/72',
    /** 금색 별: 짙은 갈색 원판 */
    2: 'bg-[#1a0c00]/70',
    /** 보라 별: 거의 검정 원판 (밝은 숫자 받침) */
    3: 'bg-black/75',
};
