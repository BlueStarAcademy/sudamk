/** 펫 정보 뷰어(관리 모달·홈·상세) — panelFit 카드 밀도 */

export const PET_PANEL_PORTRAIT_MAX = 'max-w-[6.75rem]';
export const PET_PANEL_HERO_GRID_COLS = 'grid-cols-[minmax(0,6.75rem)_minmax(0,1fr)]';

export const PET_PANEL_ROOT_GAP = 'gap-1.5';
export const PET_PANEL_ROW_PAD = 'p-2';
export const PET_PANEL_HERO_GAP = 'gap-x-2 gap-y-1.5';
export const PET_PANEL_TRAIT_GAP = 'gap-1.5';

/** 정보 뷰어 스크롤 영역 — 테두리·링이 잘리지 않게 여백 */
export const PET_INFO_VIEWER_SCROLL_PAD = 'px-2 py-2';

/** 펫 정보 카드(관리 모달 panelFit) — 초상화·상단 행 (영혼석 뷰어와 공유) */
export const PET_PANEL_PORTRAIT_SHELL = `relative aspect-square w-full overflow-hidden rounded-lg border border-white/20 bg-gradient-to-b from-zinc-800/95 to-black/90 shadow-inner ${PET_PANEL_PORTRAIT_MAX}`;

export const PET_PANEL_PORTRAIT_IMG =
    'relative z-[1] h-full w-full object-contain p-0.5 drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]';

export const PET_PANEL_HERO_HEADER_ROW = `relative z-[1] grid min-w-0 ${PET_PANEL_HERO_GRID_COLS} items-stretch border-b border-white/10 bg-zinc-950/92 ${PET_PANEL_ROW_PAD} ${PET_PANEL_HERO_GAP}`;

export const PET_PANEL_HERO_META_COL = 'flex min-w-0 flex-col justify-center text-left gap-0.5';

export const PET_PANEL_INFO_CARD_OUTER =
    'relative box-border flex min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 via-violet-950/35 to-zinc-950 shadow-[0_12px_28px_-10px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-fuchsia-400/35';

export const PET_PANEL_META_ROW = `relative z-[1] flex min-h-0 min-w-0 flex-row items-stretch bg-zinc-950/92 ${PET_PANEL_ROW_PAD} ${PET_PANEL_TRAIT_GAP}`;

export const PET_INFO_ACTION_BTN =
    'min-w-[min(100%,9rem)] rounded-lg border px-3 py-2 text-[0.75rem] font-extrabold leading-snug tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_22px_-10px_rgba(0,0,0,0.75)] transition-[transform,box-shadow,filter] duration-200 hover:brightness-[1.06] active:translate-y-px active:brightness-95 disabled:!pointer-events-none disabled:!opacity-45';

export const PET_PANEL_BADGE =
    'shrink-0 rounded border border-white/15 px-1.5 py-px text-[15px] font-extrabold leading-none antialiased';
export const PET_PANEL_REP_BADGE =
    'shrink-0 rounded border border-cyan-400/55 bg-cyan-950/65 px-1.5 py-px text-[14px] font-extrabold leading-none text-cyan-50 antialiased';
export const PET_PANEL_LV = 'shrink-0 text-[15px] font-bold tabular-nums leading-none text-amber-200 antialiased';
export const PET_PANEL_NAME =
    'min-w-0 line-clamp-2 text-[16px] font-black leading-snug tracking-tight text-fuchsia-50 antialiased';
export const PET_PANEL_EXP = 'whitespace-nowrap text-[14px] font-medium leading-snug text-slate-400 antialiased';
export const PET_PANEL_XP_BLOCKED = 'whitespace-nowrap text-[14px] font-extrabold leading-none text-amber-100';
export const PET_PANEL_BAR = 'h-2';

export const PET_PANEL_TRAIT_BOX =
    'flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded-md border px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
export const PET_PANEL_TRAIT_TITLE =
    'text-[14px] font-bold uppercase leading-none tracking-wide antialiased';
export const PET_PANEL_TRAIT_BODY =
    'mt-0.5 min-w-0 line-clamp-2 text-[15px] font-semibold leading-snug antialiased';

/** 바둑능력 스트립 */
export const PET_PANEL_BADUK_STRIP =
    'flex min-w-0 flex-nowrap items-center justify-center gap-x-2 overflow-x-auto rounded-lg border border-sky-500/30 bg-gradient-to-r from-sky-950/40 to-zinc-950/80 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] [scrollbar-width:thin]';
export const PET_PANEL_BADUK_LABEL = 'text-[15px] font-bold leading-none text-amber-100 antialiased';
export const PET_PANEL_BADUK_TOTAL = 'text-[16px] font-black tabular-nums text-amber-50 antialiased';
export const PET_PANEL_BADUK_PHASE_LABEL = 'text-[14px] font-semibold leading-none text-slate-400 antialiased';
export const PET_PANEL_BADUK_PHASE_NUM = 'text-[15px] font-bold tabular-nums text-sky-100 antialiased';
export const PET_PANEL_BADUK_BLOCK_GAP = 'gap-1';

/** 6코어 2×3 — 펫 정보 뷰어(panelFit) */
export const PET_PANEL_CORE_GRID =
    'grid w-full min-w-0 grid-cols-2 grid-rows-3 gap-x-1.5 gap-y-1 text-[15px] leading-snug antialiased';
export const PET_PANEL_CORE_CELL =
    'flex min-w-0 flex-row items-center justify-between gap-1 rounded-md border border-white/10 bg-black/30 px-2 py-2';

export const PET_PANEL_CORE_VALUE =
    'shrink-0 text-[15px] font-bold tabular-nums sm:text-[17px]';

/** 펫 관리·상세 — 하단 액션 버튼 */
export const PET_MGMT_ACTION_BTN_TEXT = 'text-[0.75rem] font-bold leading-snug antialiased';

export const PET_MGMT_ACTION_BTN_CLASS = `!min-w-0 !flex-1 !shrink !rounded-lg !px-1.5 !py-2 !min-h-[2.55rem] ${PET_MGMT_ACTION_BTN_TEXT}`;

export const PET_MGMT_ACTION_BAR_CLASS =
    'flex min-h-[3rem] shrink-0 flex-nowrap gap-1.5 border-t border-white/10 bg-black/45 px-2 py-2 backdrop-blur-sm supports-[backdrop-filter]:bg-black/35';
