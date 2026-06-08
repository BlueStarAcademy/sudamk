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

/** PC 우측 — 수련·부화장·펫 상점 */
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

/** PC 상단 — 좌측 정보(고정) + 우측 수련·부화장·상점 */
export const PET_MGMT_TOP_SPLIT_CLASS = 'flex min-h-0 flex-1 gap-1.5 overflow-hidden';

export const PET_MGMT_INFO_COLUMN_CLASS =
    'flex min-h-0 w-[min(58%,26rem)] min-w-[15.5rem] shrink-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/25';

export const PET_MGMT_RIGHT_COLUMN_CLASS = 'flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden';

export const PET_MGMT_VIEWER_FRAME_CLASS = 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden';

export const PET_MGMT_TAB_PANEL_CLASS = `flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden p-2 ${PET_MGMT_BASE} text-slate-200`;

export const PET_MGMT_SCROLL_CLASS =
    'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-width:thin]';

/** PC 인벤 도크 — 12열 기준, 남는 세로 공간 활용 */
export const PET_MGMT_INV_DOCK_DESKTOP_CLASS =
    'flex min-h-[10rem] max-h-[17.5rem] flex-1 shrink-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-gray-900/45';

/** 모바일 인벤 도크 — 탭 전환 시 높이 고정(펫 3행 / 영혼석 2행 동일 영역) */
export const PET_MGMT_INV_DOCK_MOBILE_CLASS =
    'flex h-[14.5rem] shrink-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-gray-900/45';

/** @deprecated — 모바일 도크 별칭 */
export const PET_MGMT_INV_DOCK_CLASS = PET_MGMT_INV_DOCK_MOBILE_CLASS;

export const PET_MGMT_INV_HEADER_CLASS =
    'flex h-[2.55rem] shrink-0 flex-nowrap items-center gap-1.5 border-b border-white/10 bg-black/35 px-1.5';

export const PET_MGMT_INV_GRID_SCROLL_CLASS =
    'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-1 [scrollbar-width:thin]';

export const PET_MGMT_INV_GRID_DESKTOP_CLASS = 'grid grid-cols-12 content-start gap-0';

export const PET_MGMT_INV_GRID_MOBILE_CLASS = 'grid grid-cols-6 content-start gap-0';

/** @deprecated — 모바일 그리드 별칭 */
export const PET_MGMT_INV_GRID_CLASS = PET_MGMT_INV_GRID_MOBILE_CLASS;

export const PET_MGMT_SOUL_GRID_DESKTOP_CLASS = 'grid grid-cols-12 content-start gap-0';

export const PET_MGMT_SOUL_GRID_MOBILE_CLASS = 'grid grid-cols-6 content-start gap-0';

/** @deprecated — 모바일 영혼석 그리드 별칭 */
export const PET_MGMT_SOUL_GRID_CLASS = PET_MGMT_SOUL_GRID_MOBILE_CLASS;

/** 부화장 PC — 가로 3열, 행 높이 16rem 고정 */
export const PET_MGMT_HATCHERY_GRID_CLASS =
    'grid w-full grid-cols-3 gap-2 content-start items-start auto-rows-[16rem]';

/** 부화장 모바일 — 세로 스택 */
export const PET_MGMT_HATCHERY_MOBILE_STACK_CLASS = 'flex w-full min-w-0 flex-col gap-1.5';

/** 부화장 모바일 — VIP·일반 슬롯 가로 2열 */
export const PET_MGMT_HATCHERY_MOBILE_SLOTS_ROW_CLASS = 'grid w-full min-w-0 grid-cols-2 gap-1.5 items-stretch';

/** 부화장 모바일 — 보유 알 한 줄 압축 */
export const PET_MGMT_HATCHERY_EGG_INVENTORY_MOBILE_CLASS =
    'flex w-full shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.09] bg-gradient-to-br from-zinc-900/70 via-black/70 to-zinc-950/90 px-2 py-1 shadow-md ring-1 ring-black/50';

/** 부화장 PC 슬롯 — 헤더·챔버·액션 3단 고정 */
export const PET_MGMT_HATCHERY_SLOT_OUTER_CLASS =
    'grid h-[16rem] min-h-[16rem] w-full min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden';

/** 부화장 모바일 슬롯 — 링·글로우 잘림 방지 */
export const PET_MGMT_HATCHERY_SLOT_OUTER_MOBILE_CLASS =
    'grid min-h-[9.25rem] w-full min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-visible';

export const PET_MGMT_HATCHERY_SLOT_HEADER_CLASS =
    'flex h-[1.45rem] shrink-0 items-center justify-between gap-0.5 px-0.5';

/** 알 영역(이미지·상태·남은시간) */
export const PET_MGMT_HATCHERY_CHAMBER_CLASS =
    'grid min-h-0 w-full min-w-0 grid-rows-[minmax(0,1fr)_auto_auto] overflow-hidden rounded-md border shadow-inner';

/** 챔버 알 이미지 */
export const PET_MGMT_HATCHERY_EGG_IMG_CLASS = 'h-[4.5rem] w-[4.5rem] shrink-0 rounded-lg object-contain';

export const PET_MGMT_HATCHERY_EGG_IMG_MOBILE_CLASS = 'h-[3.25rem] w-[3.25rem] shrink-0 rounded-lg object-contain';

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

/** 수련 탭 PC — 6슬롯 2×3 그리드 */
export const PET_MGMT_TR_SLOTS_DESKTOP_CLASS =
    'grid w-full min-w-0 grid-cols-2 gap-2 content-start items-stretch [&>*]:min-h-0 [&>*]:min-w-0';

/** 수련 탭 모바일 — 2열 그리드 */
export const PET_MGMT_TR_SLOTS_GRID_CLASS =
    'grid w-full min-w-0 grid-cols-1 gap-2 content-start items-stretch sm:grid-cols-2 [&>*]:min-h-0 [&>*]:min-w-0';

/** 수련 탭 PC — 슬롯·펫 이미지 */
export const PET_MGMT_TR_PET_IMG_CLASS = 'h-[5rem] w-[5rem] shrink-0 rounded object-contain';

export const PET_MGMT_TR_PET_IMG_MOBILE_CLASS = 'h-[3.25rem] w-[3.25rem] shrink-0 rounded object-contain';

export const PET_MGMT_TR_SLOT_DROP_CLASS =
    'flex h-[6.75rem] w-full shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed p-1';

export const PET_MGMT_TR_SLOT_DROP_MOBILE_CLASS =
    'flex h-[4.25rem] w-full shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed p-1';

/** 수련 슬롯 PC 보상 아이콘 */
export const PET_MGMT_TR_ICON_BOX = 'h-[3rem] w-[3rem] shrink-0';

export const PET_MGMT_TR_ICON_IMG = 'h-8 w-8';

export const PET_MGMT_TR_SOUL_COL = 'w-[3rem] shrink-0 gap-0.5';

export const PET_MGMT_TR_EXP_LABEL = 'text-[11px] font-black leading-none subpixel-antialiased';

/** @deprecated 세로 보상 패널 — 가로 스크롤 블록으로 대체 */
export const PET_MGMT_TR_REWARD_PANEL_CLASS =
    'flex min-h-0 min-w-0 flex-1 flex-col items-stretch justify-center gap-2 self-stretch border-l border-white/10 pl-1.5';

/** 수련 슬롯 카드 내 확정·확률 보상 블록(가로 스크롤 행) */
export const PET_MGMT_TR_REWARD_BLOCK_CLASS =
    'flex w-[7.25rem] min-w-[7.25rem] max-w-[7.25rem] shrink-0 flex-col items-center justify-center gap-1 self-center overflow-hidden subpixel-antialiased';

export const PET_MGMT_TR_REWARD_LBL_CLASS =
    'max-w-full truncate whitespace-nowrap text-center text-[0.8125rem] font-extrabold leading-none subpixel-antialiased';

export const PET_MGMT_TR_REWARD_AMT_CLASS =
    'max-w-full truncate text-center text-[0.8125rem] font-bold leading-none tabular-nums subpixel-antialiased';

export const PET_MGMT_TR_REWARD_BOX_CLASS =
    'w-full min-w-0 max-w-full shrink-0 overflow-hidden rounded-md border px-1 py-1';

export const PET_MGMT_TR_REWARD_ROW_INNER_CLASS =
    'flex w-full min-w-0 max-w-full flex-nowrap items-center justify-center gap-0.5 overflow-hidden';

/** 확률보상 영혼석 전경 — 정수 픽셀 고정(퍼센트 스케일 흐림 방지) */
export const PET_MGMT_TR_SOUL_FG_IMG_CLASS = 'relative z-[2] h-7 w-7 shrink-0 object-contain';

/** 확률보상 2종 — 박스 내 수납용 축소 */
export const PET_MGMT_TR_SOUL_COL_2_CLASS =
    'flex w-[2.375rem] shrink-0 flex-col items-center justify-center gap-0.5';

export const PET_MGMT_TR_ICON_BOX_2_CLASS = 'h-[2.375rem] w-[2.375rem] shrink-0';

export const PET_MGMT_TR_SOUL_FG_IMG_MD_CLASS = 'relative z-[2] h-[1.625rem] w-[1.625rem] shrink-0 object-contain';

/** 확률보상 3종 — 박스 내 수납용 축소 */
export const PET_MGMT_TR_SOUL_COL_3_CLASS =
    'flex w-8 shrink-0 flex-col items-center justify-center gap-0.5';

export const PET_MGMT_TR_ICON_BOX_3_CLASS = 'h-8 w-8 shrink-0';

export const PET_MGMT_TR_SOUL_FG_IMG_SM_CLASS = 'relative z-[2] h-6 w-6 shrink-0 object-contain';

/** @deprecated — PET_MGMT_TR_REWARD_BLOCK_CLASS 별칭 */
export const PET_MGMT_TR_REWARD_BLOCK_MOBILE_CLASS = PET_MGMT_TR_REWARD_BLOCK_CLASS;

/** @deprecated */
export const PET_MGMT_TR_REWARD_PANEL_MOBILE_CLASS = PET_MGMT_TR_REWARD_BLOCK_CLASS;

export const PET_MGMT_TR_REWARD_LINE_CLASS = 'flex w-full min-w-0 items-center gap-1';

export const PET_MGMT_TR_REWARD_ROW_CLASS =
    'flex min-w-0 flex-nowrap items-center justify-center gap-1';

export const PET_MGMT_TR_REWARD_ROW_MOBILE_CLASS =
    'flex min-w-0 flex-nowrap items-center justify-center gap-1';

export const PET_MGMT_TR_SLOT_COL = 'flex w-[7.25rem] shrink-0 min-w-[7.25rem] flex-col items-stretch gap-0.5';

export const PET_MGMT_TR_SLOT_COL_MOBILE_CLASS = 'flex w-[5.5rem] shrink-0 flex-col items-stretch gap-0.5';

/** 수련 슬롯 카드 — 슬롯·확정보상·확률보상 가로 한 줄 + 가로 스크롤 */
export const PET_MGMT_TR_SLOT_CARD_CLASS =
    `flex min-h-[9.25rem] min-w-0 flex-row items-center gap-1.5 overflow-x-auto overscroll-x-contain rounded-lg border p-2.5 ${PET_MGMT_BASE} [scrollbar-width:thin]`;

export const PET_MGMT_TR_SLOT_CARD_MOBILE_CLASS =
    `flex min-w-0 flex-row items-center gap-1.5 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] rounded-lg border p-2 ${PET_MGMT_BASE} [scrollbar-width:thin]`;

export const PET_MGMT_TR_HINT_TEXT = PET_MGMT_SEMI;

export const PET_MGMT_SHOP_SUBTAB_BTN = `rounded-md px-2 py-2 ${PET_MGMT_XBOLD} leading-none`;

export const PET_MGMT_SHOP_SECTION_TITLE =
    'mb-2 flex items-center gap-2 border-b border-white/10 pb-1.5 text-[0.875rem] font-extrabold leading-tight tracking-tight text-slate-100 antialiased';

export const PET_MGMT_SHOP_SECTION_CLASS = 'mb-4 last:mb-0';

export const PET_MGMT_SHOP_SHORT_TEXT =
    'line-clamp-2 min-h-[1.75rem] w-full px-0.5 text-center text-[0.6875rem] font-medium leading-tight text-slate-300/90 antialiased';

export const PET_MGMT_SHOP_TITLE = 'text-[0.85rem] font-semibold leading-tight tracking-tight antialiased';

export const PET_MGMT_SHOP_BTN_TEXT = 'text-[0.8125rem] font-semibold leading-tight antialiased';

export const PET_MGMT_SHOP_LIMIT_TEXT = 'text-[0.75rem] leading-tight antialiased';

/** PC 펫 상점 — 가로 3열 카드 그리드 */
export const PET_MGMT_SHOP_GRID_DESKTOP_CLASS =
    'grid w-full grid-cols-3 gap-2 content-start items-start [&>*]:min-h-0 [&>*]:min-w-0';

/** 모바일 펫 상점 — 2열 그리드 */
export const PET_MGMT_SHOP_GRID_CLASS =
    'grid w-full grid-cols-2 gap-1.5 content-start items-start [&>*]:min-h-0 [&>*]:min-w-0';

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
