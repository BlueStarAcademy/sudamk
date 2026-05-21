/** 펫 정보 뷰어(관리 모달·홈·상세) — 동일 panelFit 카드 밀도 */

export const PET_PANEL_PORTRAIT_MAX = 'max-w-[5.25rem]';
export const PET_PANEL_HERO_GRID_COLS = 'grid-cols-[minmax(0,5.25rem)_minmax(0,1fr)]';

export const PET_PANEL_ROOT_GAP = 'gap-1';
export const PET_PANEL_ROW_PAD = 'p-1.5';
export const PET_PANEL_HERO_GAP = 'gap-x-1.5 gap-y-1';
export const PET_PANEL_TRAIT_GAP = 'gap-1';

/** 정보 뷰어 스크롤 영역 — 테두리·링이 잘리지 않게 여백 */
export const PET_INFO_VIEWER_SCROLL_PAD = 'px-1.5 py-1.5 sm:px-2 sm:py-1.5';

export const PET_PANEL_BADGE =
    'shrink-0 rounded border border-white/15 px-1 py-px text-[12px] font-extrabold leading-none antialiased';
export const PET_PANEL_REP_BADGE =
    'shrink-0 rounded border border-cyan-400/55 bg-cyan-950/65 px-1 py-px text-[11px] font-extrabold leading-none text-cyan-50 antialiased';
export const PET_PANEL_LV = 'shrink-0 text-[12px] font-bold tabular-nums leading-none text-amber-200 antialiased';
export const PET_PANEL_NAME =
    'min-w-0 line-clamp-2 text-[13px] font-black leading-snug tracking-tight text-fuchsia-50 antialiased';
export const PET_PANEL_EXP = 'whitespace-nowrap text-[11px] font-medium leading-snug text-slate-400 antialiased';
export const PET_PANEL_XP_BLOCKED = 'whitespace-nowrap text-[11px] font-extrabold leading-none text-amber-100';
export const PET_PANEL_BAR = 'h-1.5';

export const PET_PANEL_TRAIT_BOX =
    'flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded-md border px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
export const PET_PANEL_TRAIT_TITLE =
    'text-[11px] font-bold uppercase leading-none tracking-wide antialiased';
export const PET_PANEL_TRAIT_BODY =
    'mt-px min-w-0 line-clamp-2 text-[12px] font-semibold leading-snug antialiased';

/** 바둑능력 스트립 — 중앙 정렬·동일 타이포 */
export const PET_PANEL_BADUK_STRIP =
    'flex min-w-0 flex-nowrap items-center justify-center gap-x-1.5 overflow-x-auto rounded-lg border border-sky-500/30 bg-gradient-to-r from-sky-950/40 to-zinc-950/80 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] [scrollbar-width:thin]';
export const PET_PANEL_BADUK_LABEL = 'text-[12px] font-bold leading-none text-amber-100 antialiased';
export const PET_PANEL_BADUK_TOTAL = 'text-[13px] font-black tabular-nums text-amber-50 antialiased';
export const PET_PANEL_BADUK_PHASE_LABEL = 'text-[11px] font-semibold leading-none text-slate-400 antialiased';
export const PET_PANEL_BADUK_PHASE_NUM = 'text-[12px] font-bold tabular-nums text-sky-100 antialiased';
export const PET_PANEL_BADUK_BLOCK_GAP = 'gap-0.5';

/** 6코어 3×2 */
export const PET_PANEL_CORE_GRID =
    'grid w-full min-w-0 grid-cols-3 grid-rows-2 gap-x-1 gap-y-0.5 text-[12px] leading-snug antialiased';
export const PET_PANEL_CORE_CELL =
    'flex min-w-0 flex-row items-center justify-between gap-0.5 rounded-md border border-white/10 bg-black/30 px-1.5 py-1.5';

/** 펫 관리·상세 — 하단 액션 버튼: 글자만 축소, 세로 터치 영역 유지 */
export const PET_MGMT_ACTION_BTN_TEXT = 'text-[0.5625rem] font-bold leading-snug antialiased';

export const PET_MGMT_ACTION_BTN_CLASS = `!min-w-0 !flex-1 !shrink !rounded-lg !px-1 !py-1.5 !min-h-[2rem] ${PET_MGMT_ACTION_BTN_TEXT}`;

export const PET_MGMT_ACTION_BAR_CLASS =
    'flex min-h-[2.35rem] shrink-0 flex-nowrap gap-1 border-t border-white/10 bg-black/45 px-1.5 py-1.5 backdrop-blur-sm supports-[backdrop-filter]:bg-black/35';
