/** 펫 관리 모달 — PC 가로(px) */
export const PAIR_PET_MANAGEMENT_MODAL_WIDTH_DESKTOP = 540;

/** 펫 관리 모달 — 좁은 휴대·소형 태블릿 가로(px) */
export const PAIR_PET_MANAGEMENT_MODAL_WIDTH_MOBILE = 580;

/** 펫 획득·상세 모달 — PC 가로(px) */
export const PAIR_PET_DETAIL_MODAL_INITIAL_WIDTH = 560;

/** 펫 관리 모달 — PC 설계 높이(px) */
export const PAIR_PET_MANAGEMENT_MODAL_HEIGHT_DESKTOP = 920;

/** 펫 관리 모달 — 좁은 휴대·소형 태블릿 설계 높이(px), 뷰포트 상한과 min 처리 */
export const PAIR_PET_MANAGEMENT_MODAL_HEIGHT_MOBILE = 940;

/** 펫 상세보기 모달 — 콘텐츠 맞춤 시 상한(px). 획득 모달은 shrinkHeightToContent 사용 */
export const PAIR_PET_DETAIL_MODAL_INITIAL_HEIGHT = 600;

/** 펫 상세보기 — 본문 스크롤 상한 */
export const PAIR_PET_DETAIL_VIEW_BODY_MAX_HEIGHT_CSS = 'min(72dvh, 600px)';

/** 펫 등급 강화 모달 — 설계 높이(px) */
export const PAIR_PET_GRADE_UPGRADE_MODAL_INITIAL_HEIGHT = 720;

/** 펫 모달 공통 — 모바일 max-height (safe-area 반영, 하단 여백 최소) */
export const PAIR_PET_MODAL_MOBILE_MAX_HEIGHT_CSS =
    'calc(100dvh - max(8px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px) + 8px))';

/** DraggableWindow `mobileViewportDvhBottomGapPx` — 펫 모달 */
export const PAIR_PET_MODAL_MOBILE_BOTTOM_GAP_PX = 6;
