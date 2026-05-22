/** 펫 관리 모달 — 13px 기준 통일 타이포 */

export const PET_MGMT_BASE = 'text-[0.8125rem] leading-snug antialiased';

export const PET_MGMT_SEMI = 'text-[0.8125rem] font-semibold leading-snug antialiased';

export const PET_MGMT_BOLD = 'text-[0.8125rem] font-bold leading-snug antialiased';

export const PET_MGMT_XBOLD = 'text-[0.8125rem] font-extrabold leading-snug antialiased';

export const PET_MGMT_TITLE = 'text-[0.875rem] font-extrabold leading-snug antialiased';

/** 수련·부화장 등 보조 한 줄 문구 */
export const PET_MGMT_CAPTION = 'text-[0.7rem] leading-tight antialiased';

/** @deprecated 통일 클래스로 대체 */
export const PET_MGMT_TEXT_XS = PET_MGMT_BOLD;

export const PET_MGMT_TEXT_SM = PET_MGMT_SEMI;

export const PET_MGMT_TEXT_MD = PET_MGMT_BOLD;

export const PET_MGMT_TEXT_LG = PET_MGMT_XBOLD;

export const PET_MGMT_TAB_BTN_BASE = `rounded-md px-1.5 py-1 ${PET_MGMT_BOLD} leading-none`;

export const PET_MGMT_ROOT_CLASS = 'flex h-full min-h-0 w-full flex-1 flex-col gap-1.5 overflow-hidden';

/** 본문: 위 뷰어(flex-1) + 아래 인벤(고정 높이) */
export const PET_MGMT_MAIN_COLUMN_CLASS = 'flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden';

export const PET_MGMT_VIEWER_FRAME_CLASS = 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden';

export const PET_MGMT_TAB_PANEL_CLASS = `flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden p-2 ${PET_MGMT_BASE} text-slate-200`;

export const PET_MGMT_SCROLL_CLASS =
    'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-width:thin]';

/** 인벤 도크 — 탭 전환 시 높이 고정(펫 3행 / 영혼석 2행 동일 영역) */
export const PET_MGMT_INV_DOCK_CLASS =
    'flex h-[14.5rem] shrink-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-gray-900/45';

export const PET_MGMT_INV_HEADER_CLASS =
    'flex h-[2.55rem] shrink-0 flex-nowrap items-center gap-1.5 border-b border-white/10 bg-black/35 px-1.5';

export const PET_MGMT_INV_GRID_SCROLL_CLASS =
    'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-1 [scrollbar-width:thin]';

export const PET_MGMT_INV_GRID_CLASS = 'grid grid-cols-6 content-start gap-0';

export const PET_MGMT_SOUL_GRID_CLASS = 'grid grid-cols-6 content-start gap-0';

/** 부화장 3×2 — 가로 3열 균등, 세로는 행마다 16rem 고정(남는 영역 세로 분할 없음) */
export const PET_MGMT_HATCHERY_GRID_CLASS =
    'grid w-full grid-cols-3 gap-2 content-start items-start auto-rows-[16rem]';

/** 부화장 슬롯 — 헤더·챔버·액션 3단 고정 */
export const PET_MGMT_HATCHERY_SLOT_OUTER_CLASS =
    'grid h-[16rem] min-h-[16rem] w-full min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden';

export const PET_MGMT_HATCHERY_SLOT_HEADER_CLASS =
    'flex h-[1.45rem] shrink-0 items-center justify-between gap-0.5 px-0.5';

/** 알 영역(이미지·상태·남은시간) */
export const PET_MGMT_HATCHERY_CHAMBER_CLASS =
    'grid min-h-0 w-full min-w-0 grid-rows-[minmax(0,1fr)_auto_auto] overflow-hidden rounded-md border shadow-inner';

/** 챔버 알 이미지 */
export const PET_MGMT_HATCHERY_EGG_IMG_CLASS = 'h-[4.5rem] w-[4.5rem] shrink-0 rounded-lg object-contain';

/** 챔버 상태 문구 — 고정 한 줄 */
export const PET_MGMT_HATCHERY_STATUS_ROW_CLASS =
    'flex h-[1.15rem] shrink-0 items-center justify-center px-0.5';

export const PET_MGMT_HATCHERY_TIMER_ROW_CLASS =
    'flex h-[1.15rem] shrink-0 items-center justify-center border-t border-white/[0.07] px-0.5 font-mono tabular-nums';

export const PET_MGMT_HATCHERY_INFO_CLASS =
    'flex w-full min-w-0 shrink-0 flex-col gap-0.5 overflow-hidden';

export const PET_MGMT_HATCHERY_ACTION_ROW_CLASS = 'grid h-[2.7rem] shrink-0 grid-cols-2 gap-1';

export const PET_MGMT_HATCHERY_BTN_CLASS = `!min-h-0 !w-full !min-w-0 !rounded !px-1 !py-1 ${PET_MGMT_BOLD} !text-[0.75rem] !leading-none antialiased`;

export const PET_MGMT_HATCHERY_BTN_STACK_CLASS = `${PET_MGMT_HATCHERY_BTN_CLASS} !flex !h-full !flex-col !items-center !justify-center !gap-0.5`;

/** 수련 탭 — 슬롯·펫 이미지 */
export const PET_MGMT_TR_PET_IMG_CLASS = 'h-[4.75rem] w-[4.75rem] shrink-0 rounded object-contain';

export const PET_MGMT_TR_SLOT_DROP_CLASS =
    'flex h-[6rem] w-full shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed p-1';

/** 수련 슬롯 우측 보상 — 한 줄(줄바꿈 없음)에 맞춘 아이콘 크기 */
export const PET_MGMT_TR_ICON_BOX = 'h-[3.25rem] w-[3.25rem] shrink-0';

export const PET_MGMT_TR_ICON_IMG = 'h-9 w-9';

export const PET_MGMT_TR_SOUL_COL = 'w-[3.25rem] shrink-0 gap-0.5';

export const PET_MGMT_TR_EXP_LABEL = 'text-[11px] font-black leading-none antialiased';

export const PET_MGMT_TR_REWARD_PANEL_CLASS =
    'flex min-h-0 min-w-0 flex-1 flex-row flex-nowrap items-center justify-center gap-1 self-stretch overflow-x-auto border-l border-white/10 pl-1.5 [scrollbar-width:thin]';

export const PET_MGMT_TR_REWARD_ROW_CLASS =
    'flex min-w-0 flex-nowrap items-center justify-center gap-1';

export const PET_MGMT_TR_SLOT_COL = 'w-[6.25rem] shrink-0 min-w-[6.25rem]';

export const PET_MGMT_TR_SLOT_CARD_CLASS = `flex min-w-0 items-stretch gap-2 rounded-lg border p-2.5 ${PET_MGMT_BASE}`;

export const PET_MGMT_TR_HINT_TEXT = PET_MGMT_SEMI;

export const PET_MGMT_SHOP_SUBTAB_BTN = `rounded-md px-2 py-2 ${PET_MGMT_XBOLD} leading-none`;

export const PET_MGMT_SHOP_TITLE = 'text-[0.85rem] font-semibold leading-tight tracking-tight antialiased';

export const PET_MGMT_SHOP_BTN_TEXT = 'text-[0.8125rem] font-semibold leading-tight antialiased';

export const PET_MGMT_SHOP_LIMIT_TEXT = 'text-[0.75rem] leading-tight antialiased';

/** 펫 상점 — 메인 상점 카드와 동일: 셀마다 균일·콘텐츠 높이(풀 스트레치 없음) */
export const PET_MGMT_SHOP_GRID_CLASS =
    'grid w-full grid-cols-2 gap-1.5 content-start items-start [&>*]:min-h-0 [&>*]:min-w-0';

/** @deprecated flex 레이아웃으로 대체 */
export const PET_MGMT_MAIN_SPLIT_CLASS = PET_MGMT_MAIN_COLUMN_CLASS;

export const PET_MGMT_VIEWER_FRAME_CLASS_LEGACY = PET_MGMT_VIEWER_FRAME_CLASS;

export const PET_MGMT_INV_STRIP_CLASS = PET_MGMT_INV_DOCK_CLASS;

export const PET_MGMT_TAB_FIT_OUTER_CLASS = PET_MGMT_SCROLL_CLASS;

export const PET_MGMT_HATCHERY_VIEWER_FRAME_CLASS = PET_MGMT_VIEWER_FRAME_CLASS;

export const PET_MGMT_TRAINING_VIEWER_FRAME_CLASS = PET_MGMT_VIEWER_FRAME_CLASS;

export const PET_MGMT_TRAINING_SCROLL_CLASS = PET_MGMT_SCROLL_CLASS;

export const PET_MGMT_INFO_SCROLL_CLASS = PET_MGMT_SCROLL_CLASS;
