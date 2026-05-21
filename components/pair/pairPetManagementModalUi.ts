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



export const PET_MGMT_TAB_PANEL_CLASS = `flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-1 ${PET_MGMT_BASE} text-slate-200`;



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



/** 부화장 3×2 — 세로 늘어남 방지, 고정 슬롯 높이 */

export const PET_MGMT_HATCHERY_GRID_CLASS = 'grid w-full grid-cols-3 gap-1.5';



export const PET_MGMT_HATCHERY_SLOT_OUTER_CLASS = 'flex h-[10rem] min-h-0 flex-col overflow-visible';

/** 부화 알 영역 — 이미지 링·글로우가 잘리지 않도록 여유 높이 */
export const PET_MGMT_HATCHERY_CHAMBER_CLASS =
    'flex min-h-[5.75rem] w-full shrink-0 flex-col overflow-visible rounded-lg border shadow-inner transition';



/** @deprecated flex 레이아웃으로 대체 */

export const PET_MGMT_MAIN_SPLIT_CLASS = PET_MGMT_MAIN_COLUMN_CLASS;

export const PET_MGMT_VIEWER_FRAME_CLASS_LEGACY = PET_MGMT_VIEWER_FRAME_CLASS;

export const PET_MGMT_INV_STRIP_CLASS = PET_MGMT_INV_DOCK_CLASS;

export const PET_MGMT_TAB_FIT_OUTER_CLASS = PET_MGMT_SCROLL_CLASS;

export const PET_MGMT_HATCHERY_VIEWER_FRAME_CLASS = PET_MGMT_VIEWER_FRAME_CLASS;

export const PET_MGMT_TRAINING_VIEWER_FRAME_CLASS = PET_MGMT_VIEWER_FRAME_CLASS;

export const PET_MGMT_TRAINING_SCROLL_CLASS = PET_MGMT_SCROLL_CLASS;

export const PET_MGMT_INFO_SCROLL_CLASS = PET_MGMT_SCROLL_CLASS;


