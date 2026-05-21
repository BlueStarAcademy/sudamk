/** 펫 관리 모달 — 10px 기준 통일 타이포, sm:/FitScale 미사용 */



export const PET_MGMT_BASE = 'text-[0.625rem] leading-snug antialiased';

export const PET_MGMT_SEMI = 'text-[0.625rem] font-semibold leading-snug antialiased';

export const PET_MGMT_BOLD = 'text-[0.625rem] font-bold leading-snug antialiased';

export const PET_MGMT_XBOLD = 'text-[0.625rem] font-extrabold leading-snug antialiased';

export const PET_MGMT_TITLE = 'text-[0.6875rem] font-extrabold leading-snug antialiased';



/** @deprecated 통일 클래스로 대체 */

export const PET_MGMT_TEXT_XS = PET_MGMT_BOLD;

export const PET_MGMT_TEXT_SM = PET_MGMT_SEMI;

export const PET_MGMT_TEXT_MD = PET_MGMT_BOLD;

export const PET_MGMT_TEXT_LG = PET_MGMT_XBOLD;



export const PET_MGMT_TAB_BTN_BASE = `rounded-md px-1 py-1 ${PET_MGMT_BOLD} leading-none`;



export const PET_MGMT_ROOT_CLASS = 'flex min-h-0 flex-1 flex-col gap-1 overflow-hidden';



/** 본문: 위 뷰어(flex-1) + 아래 인벤(고정 높이) — 인벤이 중간에 뜨지 않음 */

export const PET_MGMT_MAIN_COLUMN_CLASS = 'flex min-h-0 flex-1 flex-col gap-1 overflow-hidden';



export const PET_MGMT_VIEWER_FRAME_CLASS = 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden';



export const PET_MGMT_TAB_PANEL_CLASS = `flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-1.5 ${PET_MGMT_BASE} text-slate-200`;



export const PET_MGMT_SCROLL_CLASS =

    'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-width:thin]';



/** 인벤 도크 — 탭 전환 시 높이 고정(펫 3행 / 영혼석 2행 동일 영역) */

export const PET_MGMT_INV_DOCK_CLASS =

    'flex h-[11rem] shrink-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-gray-900/45';



export const PET_MGMT_INV_HEADER_CLASS =

    'flex h-8 shrink-0 flex-nowrap items-center gap-1 border-b border-white/10 bg-black/35 px-1';



export const PET_MGMT_INV_GRID_SCROLL_CLASS =

    'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-0.5 [scrollbar-width:thin]';



export const PET_MGMT_INV_GRID_CLASS = 'grid grid-cols-6 content-start gap-0';



export const PET_MGMT_SOUL_GRID_CLASS = 'grid grid-cols-6 content-start gap-0';



/** 부화장 3×2 — 행 높이 통일 */
export const PET_MGMT_HATCHERY_GRID_CLASS =
    'grid w-full grid-cols-3 grid-rows-2 items-stretch gap-1.5 auto-rows-[13.25rem]';

/** 부화장 슬롯 — 헤더·챔버·액션 3단 고정 */
export const PET_MGMT_HATCHERY_SLOT_OUTER_CLASS =
    'grid h-full min-h-[13.25rem] w-full min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden';

export const PET_MGMT_HATCHERY_SLOT_HEADER_CLASS =
    'flex h-[1.125rem] shrink-0 items-center justify-between gap-0.5 px-0.5';

/** 알 영역(이미지·상태·남은시간) */
export const PET_MGMT_HATCHERY_CHAMBER_CLASS =
    'grid min-h-0 w-full min-w-0 grid-rows-[minmax(0,1fr)_auto_auto] overflow-hidden rounded-md border shadow-inner';

/** 챔버 알 이미지 */
export const PET_MGMT_HATCHERY_EGG_IMG_CLASS = 'h-14 w-14 shrink-0 rounded-lg object-contain';

/** 챔버 상태 문구(부화 가능·부화 중) — 고정 한 줄 */
export const PET_MGMT_HATCHERY_STATUS_ROW_CLASS =
    'flex h-[0.875rem] shrink-0 items-center justify-center px-0.5';

export const PET_MGMT_HATCHERY_TIMER_ROW_CLASS =
    'flex h-[0.875rem] shrink-0 items-center justify-center border-t border-white/[0.07] px-0.5 font-mono tabular-nums';

export const PET_MGMT_HATCHERY_INFO_CLASS =
    'flex w-full min-w-0 shrink-0 flex-col gap-0.5 overflow-hidden';

export const PET_MGMT_HATCHERY_ACTION_ROW_CLASS = 'grid h-[2.125rem] shrink-0 grid-cols-2 gap-0.5';

export const PET_MGMT_HATCHERY_BTN_CLASS = `!min-h-0 !w-full !min-w-0 !rounded !px-0.5 !py-0.5 ${PET_MGMT_BOLD} !text-[0.5625rem] !leading-none antialiased`;

export const PET_MGMT_HATCHERY_BTN_STACK_CLASS = `${PET_MGMT_HATCHERY_BTN_CLASS} !flex !h-full !flex-col !items-center !justify-center !gap-0.5`;



/** @deprecated flex 레이아웃으로 대체 */

export const PET_MGMT_MAIN_SPLIT_CLASS = PET_MGMT_MAIN_COLUMN_CLASS;

export const PET_MGMT_VIEWER_FRAME_CLASS_LEGACY = PET_MGMT_VIEWER_FRAME_CLASS;

export const PET_MGMT_INV_STRIP_CLASS = PET_MGMT_INV_DOCK_CLASS;

export const PET_MGMT_TAB_FIT_OUTER_CLASS = PET_MGMT_SCROLL_CLASS;

export const PET_MGMT_HATCHERY_VIEWER_FRAME_CLASS = PET_MGMT_VIEWER_FRAME_CLASS;

export const PET_MGMT_TRAINING_VIEWER_FRAME_CLASS = PET_MGMT_VIEWER_FRAME_CLASS;

export const PET_MGMT_TRAINING_SCROLL_CLASS = PET_MGMT_SCROLL_CLASS;

export const PET_MGMT_INFO_SCROLL_CLASS = PET_MGMT_SCROLL_CLASS;


