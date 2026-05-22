/** 펫 모달(관리·상세·등급 강화) 창·내부 UI 공통 확대 비율 */
export const PAIR_PET_MODAL_UI_SCALE = 1.12;

const petModalPx = (base: number) => Math.round(base * PAIR_PET_MODAL_UI_SCALE);

/** 펫 관리 모달 — PC 가로(px), 기준 448 */
export const PAIR_PET_MANAGEMENT_MODAL_WIDTH_DESKTOP = petModalPx(448);

/** 펫 관리 모달 — 좁은 휴대·소형 태블릿 가로(px), 기준 500 */
export const PAIR_PET_MANAGEMENT_MODAL_WIDTH_MOBILE = petModalPx(500);

/** 펫 획득·상세 모달 — PC 가로(px), 기준 480 */
export const PAIR_PET_DETAIL_MODAL_INITIAL_WIDTH = petModalPx(480);

/** 펫 관리 모달 — PC 설계 높이(px), 기준 900 */
export const PAIR_PET_MANAGEMENT_MODAL_HEIGHT_DESKTOP = petModalPx(900);

/** 펫 관리 모달 — 좁은 휴대·소형 태블릿 설계 높이(px), 기준 920 */
export const PAIR_PET_MANAGEMENT_MODAL_HEIGHT_MOBILE = petModalPx(920);

/** 펫 상세보기 모달 — 콘텐츠 맞춤 시 상한(px), 기준 520 */
export const PAIR_PET_DETAIL_MODAL_INITIAL_HEIGHT = petModalPx(520);

/** 펫 상세보기 — 본문 스크롤 상한 */
export const PAIR_PET_DETAIL_VIEW_BODY_MAX_HEIGHT_CSS = `min(72dvh, ${petModalPx(520)}px)`;

/** 펫 등급 강화 모달 — 설계 높이(px), 기준 640 */
export const PAIR_PET_GRADE_UPGRADE_MODAL_INITIAL_HEIGHT = petModalPx(640);

/** 펫 모달 공통 — 모바일 max-height (safe-area 반영, 하단 여백 최소) */
export const PAIR_PET_MODAL_MOBILE_MAX_HEIGHT_CSS =
    'calc(100dvh - max(8px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px) + 8px))';

/** DraggableWindow `mobileViewportDvhBottomGapPx` — 펫 모달 */
export const PAIR_PET_MODAL_MOBILE_BOTTOM_GAP_PX = 6;
