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

/** 우측 메인 탭 — 수련·부화장·펫 상점 */
export const PET_MGMT_MAIN_TAB_BAR =
    'grid shrink-0 grid-cols-3 gap-1.5 rounded-xl border border-white/15 bg-gradient-to-b from-slate-900/85 to-black/55 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';

export const PET_MGMT_MAIN_TAB_BTN =
    'rounded-lg px-2 py-2.5 min-h-[2.875rem] text-[0.8125rem] font-extrabold leading-tight antialiased transition-all duration-150';

export function petMgmtMainTabClass(active: boolean, tone: 'training' | 'hatchery' | 'shop'): string {
    const base = PET_MGMT_MAIN_TAB_BTN;
    if (active) {
        if (tone === 'training') {
            return `${base} bg-gradient-to-b from-violet-400 via-violet-500 to-violet-700 text-white shadow-[0_4px_16px_-6px_rgba(139,92,246,0.75)] ring-2 ring-violet-300/40`;
        }
        if (tone === 'hatchery') {
            return `${base} bg-gradient-to-b from-fuchsia-400 via-fuchsia-500 to-fuchsia-800 text-white shadow-[0_4px_16px_-6px_rgba(217,70,239,0.75)] ring-2 ring-fuchsia-300/40`;
        }
        return `${base} bg-gradient-to-b from-amber-400 via-amber-500 to-orange-600 text-amber-950 shadow-[0_4px_16px_-6px_rgba(251,191,36,0.75)] ring-2 ring-amber-300/45`;
    }
    if (tone === 'training') {
        return `${base} border border-violet-500/30 bg-violet-950/35 text-violet-100/90 hover:bg-violet-900/45 hover:text-violet-50`;
    }
    if (tone === 'hatchery') {
        return `${base} border border-fuchsia-500/30 bg-fuchsia-950/30 text-fuchsia-100/90 hover:bg-fuchsia-900/40 hover:text-fuchsia-50`;
    }
    return `${base} border border-amber-500/30 bg-amber-950/25 text-amber-100/90 hover:bg-amber-900/35 hover:text-amber-50`;
}

export const PET_MGMT_ROOT_CLASS = 'flex h-full min-h-0 w-full flex-1 flex-col gap-1.5 overflow-hidden';

/** 본문: 상단(정보+우측 탭) + 하단 인벤 도크 */
export const PET_MGMT_MAIN_COLUMN_CLASS = 'flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden';

/** 상단 — 좌 정보(고정) + 우 수련·부화장·상점 */
export const PET_MGMT_TOP_SPLIT_CLASS = 'flex min-h-0 flex-1 gap-1.5 overflow-hidden';

export const PET_MGMT_INFO_COLUMN_CLASS =
    'flex min-h-0 w-[min(58%,26rem)] min-w-[15.5rem] shrink-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/25';

export const PET_MGMT_RIGHT_COLUMN_CLASS = 'flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden';

export const PET_MGMT_VIEWER_FRAME_CLASS = 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden';

export const PET_MGMT_TAB_PANEL_CLASS = `flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden p-2 ${PET_MGMT_BASE} text-slate-200`;

export const PET_MGMT_SCROLL_CLASS =
    'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-width:thin]';

/** 인벤 도크 — 12열·3행 기준 고정 높이 */
export const PET_MGMT_INV_DOCK_CLASS =
    'flex min-h-[10rem] max-h-[17.5rem] flex-1 shrink-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-gray-900/45';

export const PET_MGMT_INV_HEADER_CLASS =
    'flex h-[2.55rem] shrink-0 flex-nowrap items-center gap-1.5 border-b border-white/10 bg-black/35 px-1.5';

export const PET_MGMT_INV_GRID_SCROLL_CLASS =
    'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-1 [scrollbar-width:thin]';

export const PET_MGMT_INV_GRID_CLASS = 'grid grid-cols-12 content-start gap-0';

/** 펫 인벤 썸네일 — Lv·대표펫·수련중 배지 */
export const PET_MGMT_INV_THUMB_BADGE_CLASS =
    'whitespace-nowrap rounded px-1 py-0.5 text-[0.625rem] font-black leading-none tracking-tight text-white shadow-[0_1px_3px_rgba(0,0,0,0.8)] ring-1 ring-black/45 sm:px-1.5 sm:py-0.5 sm:text-[0.7rem]';

/** 대표펫·수련 상태 — 우측 상단 좁은 띠(가위/바위/보 속성과 겹침 방지) */
export const PET_MGMT_INV_THUMB_STATUS_STACK_CLASS =
    'pointer-events-none absolute right-0.5 top-0.5 z-20 flex max-w-[44%] min-w-0 flex-col items-end gap-0.5 sm:right-1 sm:top-1 sm:max-w-[42%]';

export const PET_MGMT_INV_THUMB_STATUS_BADGE_CLASS = `${PET_MGMT_INV_THUMB_BADGE_CLASS} max-w-full shrink-0 text-center`;

export const PET_MGMT_SOUL_GRID_CLASS = 'grid grid-cols-12 content-start gap-0';

/** 부화장 상단 — #1 · VIP · 보유 알 1×3 */
export const PET_MGMT_HATCHERY_GRID_CLASS =
    'grid w-full grid-cols-3 gap-2 content-start items-stretch auto-rows-[minmax(10rem,16rem)]';

/** 부화장 슬롯 — 헤더·챔버·액션 3단 고정 */
export const PET_MGMT_HATCHERY_SLOT_OUTER_CLASS =
    'grid min-h-[10rem] w-full min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden';

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

/** 수련 탭 — 6슬롯 2×3 그리드 */
export const PET_MGMT_TR_SLOTS_GRID_CLASS =
    'grid w-full min-w-0 grid-cols-2 gap-2 content-start items-stretch [&>*]:min-h-0 [&>*]:min-w-0';

/** 수련 탭 — 슬롯·펫 이미지 */
export const PET_MGMT_TR_PET_IMG_CLASS = 'h-[5rem] w-[5rem] shrink-0 rounded object-contain';

export const PET_MGMT_TR_SLOT_DROP_CLASS =
    'flex h-[6.75rem] w-full shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed p-1';

/** 수련 슬롯 보상 아이콘 */
export const PET_MGMT_TR_ICON_BOX = 'h-[3rem] w-[3rem] shrink-0';

export const PET_MGMT_TR_ICON_IMG = 'h-8 w-8';

export const PET_MGMT_TR_SOUL_COL = 'w-[3rem] shrink-0 gap-0.5';

export const PET_MGMT_TR_EXP_LABEL = 'text-[10px] font-black leading-none antialiased';

/** 슬롯 우측 — 확정보상·확률보상 세로 2줄 */
export const PET_MGMT_TR_REWARD_PANEL_CLASS =
    'flex min-h-0 min-w-0 flex-1 flex-col items-stretch justify-center gap-2 self-stretch border-l border-white/10 pl-1.5';

/** 라벨 좌측 + 보상 내용 우측 */
export const PET_MGMT_TR_REWARD_LINE_CLASS = 'flex w-full min-w-0 items-center gap-1';

export const PET_MGMT_TR_REWARD_ROW_CLASS =
    'flex min-w-0 flex-nowrap items-center justify-center gap-1';

export const PET_MGMT_TR_SLOT_COL = 'flex w-[7.25rem] shrink-0 min-w-[7.25rem] flex-col items-stretch gap-0.5';

export const PET_MGMT_TR_SLOT_CARD_CLASS = `flex min-h-[9.25rem] min-w-0 items-stretch gap-1.5 rounded-lg border p-2.5 ${PET_MGMT_BASE}`;

export const PET_MGMT_TR_HINT_TEXT = PET_MGMT_SEMI;

export const PET_MGMT_SHOP_SUBTAB_BTN = `rounded-md px-2 py-2 ${PET_MGMT_XBOLD} leading-none`;

export const PET_MGMT_SHOP_SECTION_TITLE =
    'mb-2 flex items-center gap-2 border-b border-white/10 pb-1.5 text-[0.875rem] font-extrabold leading-tight tracking-tight text-slate-100 antialiased';

export const PET_MGMT_SHOP_SECTION_CLASS = 'mb-4 last:mb-0';

export const PET_MGMT_SHOP_SHORT_TEXT =
    'line-clamp-2 min-h-[1.75rem] w-full px-0.5 text-center text-[0.6875rem] font-medium leading-tight text-slate-300/90 antialiased';

export const PET_MGMT_SHOP_TITLE = 'text-[0.78rem] font-semibold leading-tight tracking-tight antialiased';

export const PET_MGMT_SHOP_BTN_TEXT = 'text-[0.875rem] font-bold leading-tight antialiased';

export const PET_MGMT_SHOP_LIMIT_TEXT = 'text-[0.6875rem] font-semibold leading-tight antialiased';

/** 펫 상점 — 가로 3열 카드 그리드 */
export const PET_MGMT_SHOP_GRID_CLASS =
    'grid w-full grid-cols-3 gap-2 content-start items-start [&>*]:min-h-0 [&>*]:min-w-0';

export const PET_MGMT_SHOP_SCROLL_CLASS =
    'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable] [scrollbar-width:thin]';

/** @deprecated flex 레이아웃으로 대체 */
export const PET_MGMT_MAIN_SPLIT_CLASS = PET_MGMT_MAIN_COLUMN_CLASS;

export const PET_MGMT_VIEWER_FRAME_CLASS_LEGACY = PET_MGMT_VIEWER_FRAME_CLASS;

export const PET_MGMT_INV_STRIP_CLASS = PET_MGMT_INV_DOCK_CLASS;

export const PET_MGMT_TAB_FIT_OUTER_CLASS = PET_MGMT_SCROLL_CLASS;

export const PET_MGMT_HATCHERY_VIEWER_FRAME_CLASS = PET_MGMT_VIEWER_FRAME_CLASS;

export const PET_MGMT_TRAINING_VIEWER_FRAME_CLASS = PET_MGMT_VIEWER_FRAME_CLASS;

export const PET_MGMT_TRAINING_SCROLL_CLASS = PET_MGMT_SCROLL_CLASS;

export const PET_MGMT_INFO_SCROLL_CLASS = PET_MGMT_SCROLL_CLASS;
