/** 장비 슬롯 강화(+N) 코너 마커 — 단계별 별 이미지 + 중앙 숫자(별 안쪽 안전 영역) */

/**
 * 슬롯 한 변 대비 마커 한 변 비율(%).
 * 중앙 숫자·별 포인트가 동시에 읽히도록 상태 배지보다 살짝 큼.
 */
export const ENHANCE_MARKER_SIZE_PCT = 30;

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
 * 별 본색의 실제 보색(고채도) 숫자.
 * 1 은청 → 주황, 2 금색 → 보라, 3 보라 → 노랑, 4 프리즘 → 흰색
 * (남색/검정은 별·원판과 톤이 겹쳐 안 보였음)
 */
export const ENHANCE_MARKER_NUMBER_CLASS: Record<EnhanceMarkerTier, string> = {
    1: 'text-[#ff6a00]',
    2: 'text-[#7c3aed]',
    3: 'text-[#ffe566]',
    4: 'text-[#ffffff]',
};

/** 숫자 외곽 — 글자 보색을 살리는 반대톤(두껍게) */
export const ENHANCE_MARKER_NUMBER_STROKE: Record<EnhanceMarkerTier, string> = {
    1: [
        '0 0 1.25px #1a0a00',
        '0 1px 0 #1a0a00',
        '0 -1px 0 #1a0a00',
        '1px 0 0 #1a0a00',
        '-1px 0 0 #1a0a00',
        '1px 1px 0 #000',
        '-1px -1px 0 #000',
        '1px -1px 0 #000',
        '-1px 1px 0 #000',
        '0 0 3px rgba(0,0,0,0.9)',
        '0 1px 2px rgba(0,0,0,0.65)',
    ].join(', '),
    2: [
        '0 0 1.25px #fffbeb',
        '0 1px 0 #fffbeb',
        '0 -1px 0 #fffbeb',
        '1px 0 0 #fffbeb',
        '-1px 0 0 #fffbeb',
        '1px 1px 0 #fef3c7',
        '-1px -1px 0 #fef3c7',
        '1px -1px 0 #fef3c7',
        '-1px 1px 0 #fef3c7',
        '0 0 3px rgba(255,251,235,0.95)',
        '0 1px 2px rgba(0,0,0,0.55)',
    ].join(', '),
    3: [
        '0 0 1.25px #1a0533',
        '0 1px 0 #1a0533',
        '0 -1px 0 #1a0533',
        '1px 0 0 #1a0533',
        '-1px 0 0 #1a0533',
        '1px 1px 0 #000',
        '-1px -1px 0 #000',
        '1px -1px 0 #000',
        '-1px 1px 0 #000',
        '0 0 3px rgba(0,0,0,0.95)',
        '0 1px 2px rgba(0,0,0,0.65)',
    ].join(', '),
    4: [
        '0 0 1.25px #000',
        '0 1px 0 #000',
        '0 -1px 0 #000',
        '1px 0 0 #000',
        '-1px 0 0 #000',
        '1px 1px 0 #000',
        '-1px -1px 0 #000',
        '1px -1px 0 #000',
        '-1px 1px 0 #000',
        '0 0 3px rgba(0,0,0,0.95)',
        '0 1px 2px rgba(0,0,0,0.7)',
    ].join(', '),
};

export const ENHANCE_MARKER_NUMBER_STROKE_WIDTH: Record<EnhanceMarkerTier, string> = {
    1: '0.7px rgba(0,0,0,0.95)',
    2: '0.7px rgba(255,251,235,0.95)',
    3: '0.7px rgba(0,0,0,0.95)',
    4: '0.7px rgba(0,0,0,0.95)',
};

/**
 * 별 중앙 안전 영역(오각 본체) 안쪽 숫자 크기(cqmin).
 */
export const ENHANCE_MARKER_NUMBER_CQMIN = {
    single: 40,
    double: 32,
} as const;

/**
 * 숫자 받침 원판 — 별 본체 안쪽만 덮고 포인트는 남김.
 * 보색 숫자가 묻히지 않게 불투명도를 충분히 줌.
 */
export const ENHANCE_MARKER_NUMBER_DISC_PCT = 38;

export const ENHANCE_MARKER_NUMBER_DISC: Record<EnhanceMarkerTier, string> = {
    /** 은청 별 + 주황 숫자: 밝은 받침 */
    1: 'bg-[#fff7ed]/82',
    /** 금색 별 + 보라 숫자: 밝은 금빛 받침 */
    2: 'bg-[#fffbeb]/84',
    /** 보라 별 + 노랑 숫자: 짙은 보라 받침 */
    3: 'bg-[#1e0b3a]/82',
    /** 프리즘 + 흰 숫자: 어두운 받침 */
    4: 'bg-black/75',
};
