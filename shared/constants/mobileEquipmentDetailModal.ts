/**
 * 거래소 모바일「구매」장비 상세와 동일한 설계 값.
 * 모바일에서 장비 상세를 띄우는 모달들이 이 값을 공유합니다.
 */
export const MOBILE_EQUIPMENT_DETAIL_MODAL_WIDTH = 350;

export const MOBILE_EQUIPMENT_DETAIL_LAYOUT_SCALE = MOBILE_EQUIPMENT_DETAIL_MODAL_WIDTH / 950;

/** `ItemDetailModal` 등 모바일 장비 상세: 썸네일 슬롯(px). 모달 폭에 비례하되 상·하한으로 과도한 축소 방지 */
export const MOBILE_ITEM_DETAIL_EQUIPMENT_ICON_SLOT_PX = Math.min(
    112,
    Math.max(84, Math.round(MOBILE_EQUIPMENT_DETAIL_MODAL_WIDTH * 0.32)),
);

/** DraggableWindow bodyPaddingClassName — ExchangeModal 구매 상세와 동일 */
export const MOBILE_EQUIPMENT_DETAIL_BODY_PADDING_CLASS =
    'flex min-h-0 w-full flex-col !px-2 !pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] !pt-2';

/** DraggableWindow mobileViewportMaxHeightCss — ExchangeModal 구매 상세와 동일 */
export const MOBILE_EQUIPMENT_DETAIL_MAX_HEIGHT_CSS =
    'min(96dvh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 8px))';
