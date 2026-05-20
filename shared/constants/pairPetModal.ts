/** 펫 관리 모달 — PC 설계 높이(px) */
export const PAIR_PET_MANAGEMENT_MODAL_HEIGHT_DESKTOP = 1080;

/** 펫 관리 모달 — 모바일·좁은 화면 설계 높이(px), 뷰포트 상한과 min 처리 */
export const PAIR_PET_MANAGEMENT_MODAL_HEIGHT_MOBILE = 1320;

/** 펫 획득/상세 모달 — PC·뷰포트 맞춤 설계 높이(px) */
export const PAIR_PET_DETAIL_MODAL_INITIAL_HEIGHT = 720;

/** 펫 등급 강화 모달 — 설계 높이(px) */
export const PAIR_PET_GRADE_UPGRADE_MODAL_INITIAL_HEIGHT = 640;

/** 펫 모달 공통 — 모바일 max-height (safe-area 반영, 하단 여백 최소) */
export const PAIR_PET_MODAL_MOBILE_MAX_HEIGHT_CSS =
    'calc(100dvh - max(8px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px) + 8px))';

/** DraggableWindow `mobileViewportDvhBottomGapPx` — 펫 모달 */
export const PAIR_PET_MODAL_MOBILE_BOTTOM_GAP_PX = 6;
