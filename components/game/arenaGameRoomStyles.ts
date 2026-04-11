/**
 * 인게임 대국실(사이드바·채팅·푸터 패널) 공통 비주얼 — `arenaPostGameButtonStyles`와 맞춘 슬레이트/징크 톤.
 */

import { arenaPostGameButtonClass } from './arenaPostGameButtonStyles.js';

/** 우측 대국실 사이드바 외곽 */
export const arenaGameRoomSidebarShell =
    'flex min-h-0 flex-col h-full gap-2 rounded-xl p-2.5 sm:p-3 ' +
    'border border-slate-600/40 bg-gradient-to-b from-slate-900/94 via-[#0b0e14] to-[#050608] ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_14px_48px_-20px_rgba(0,0,0,0.78)] ring-1 ring-inset ring-white/[0.03]';

/** 대국 정보 / 유저 목록 / 길드 별 조건 등 내부 카드 */
export const arenaGameRoomPanelClass =
    'rounded-xl border border-slate-600/36 bg-gradient-to-b from-slate-800/50 via-slate-900/90 to-slate-950/96 ' +
    'p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] ring-1 ring-inset ring-white/[0.03]';

/** 패널 제목 (대국 정보, 유저 목록 …) */
export const arenaGameRoomPanelTitleClass =
    'text-[13px] font-bold tracking-wide text-amber-100/95 drop-shadow-[0_0_14px_rgba(251,191,36,0.12)] ' +
    'border-b border-slate-600/35 pb-1.5 mb-2 flex items-center justify-between gap-2';

/** 채팅 영역 전체 래퍼 */
export const arenaGameRoomChatShellClass =
    `${arenaGameRoomPanelClass} flex min-h-0 flex-col h-full !p-2`;

/** 채팅 탭 바 */
export const arenaGameRoomChatTabBarClass =
    'flex rounded-lg p-1 gap-0.5 mb-2 flex-shrink-0 bg-black/32 ring-1 ring-inset ring-white/[0.06]';

export const arenaGameRoomChatTabActiveClass =
    'flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all duration-200 ' +
    'bg-gradient-to-b from-sky-600/95 to-sky-900/98 text-white ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_4px_16px_-6px_rgba(56,189,248,0.42)] ring-1 ring-sky-400/22';

export const arenaGameRoomChatTabInactiveClass =
    'flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-md text-slate-400 transition-colors duration-200 ' +
    'hover:bg-white/[0.05] hover:text-slate-100';

/** 채팅 메시지 스크롤 영역 */
export const arenaGameRoomChatBodyClass =
    'flex-grow space-y-1 overflow-y-auto pr-2 mb-2 min-h-0 rounded-lg p-2 ' +
    'bg-black/26 border border-slate-700/28 ring-1 ring-inset ring-white/[0.04]';

/** 빠른 채팅 팝오버 */
export const arenaGameRoomQuickChatPopoverClass =
    'absolute bottom-full mb-2 w-full z-10 max-h-64 overflow-y-auto rounded-xl p-2.5 ' +
    'border border-slate-600/42 bg-gradient-to-b from-slate-800/98 to-slate-950 ' +
    'shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/[0.05]';

export const arenaGameRoomQuickChatEmojiBtnClass =
    'w-full rounded-lg p-2 text-center text-2xl transition-all duration-150 ' +
    'border border-transparent hover:border-sky-500/35 hover:bg-sky-950/50 hover:shadow-[0_0_16px_-6px_rgba(56,189,248,0.35)]';

export const arenaGameRoomQuickChatPhraseBtnClass =
    'w-full rounded-lg p-2 text-left text-sm text-slate-200 transition-all duration-150 ' +
    'border border-transparent hover:border-slate-500/40 hover:bg-slate-800/70';

/** 채팅 입력 */
export const arenaGameRoomChatInputClass =
    'flex-grow rounded-lg border border-slate-600/48 bg-slate-950/85 px-2.5 py-2 text-sm text-slate-100 ' +
    'placeholder:text-slate-500 shadow-[inset_0_2px_8px_rgba(0,0,0,0.38)] ' +
    'focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/18 ' +
    'disabled:bg-slate-900/65 disabled:text-slate-500';

/** 이모지(빠른 채팅) 토글 */
export const arenaGameRoomChatIconToggleClass =
    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ' +
    'border border-slate-600/42 bg-gradient-to-b from-slate-700/75 to-slate-900/95 text-slate-100 ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_6px_18px_-10px_rgba(0,0,0,0.55)] ' +
    'transition-all hover:from-slate-600/80 hover:border-slate-500/48 active:scale-[0.97] ' +
    'disabled:pointer-events-none disabled:opacity-40';

/** 경기방법 등 소형 CTA */
export const arenaGameRoomSmallCtaClass =
    'text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-lg whitespace-nowrap ' +
    'border border-sky-500/32 bg-gradient-to-b from-sky-900/72 to-sky-950/92 text-sky-50 ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-sky-400/42 hover:from-sky-800/78 transition-all';

/** 설정(톱니) 아이콘 버튼 */
export const arenaGameRoomSettingsIconBtnClass =
    'text-lg p-1.5 rounded-lg border border-transparent text-slate-300 ' +
    'hover:bg-white/[0.06] hover:border-slate-600/35 hover:text-amber-100 transition-all';

/** 길드전 별 조건 패널 (강조 테두리) */
export const arenaGameRoomGuildStarPanelClass =
    'rounded-xl border border-amber-600/35 bg-gradient-to-b from-slate-900/90 via-amber-950/15 to-slate-950/95 ' +
    'p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset ring-amber-500/12';

/** 관리자 구역 (사이드바 하단) */
export const arenaGameRoomAdminStripClass =
    'flex-shrink-0 py-2 border-t border-slate-600/35';

export const arenaGameRoomAdminTitleClass = 'text-xs font-bold text-violet-300/95 tracking-wide mb-1.5';

/** 인게임 푸터(대국 기능 바) 외곽 */
export const arenaGameRoomControlsFooterClass =
    'responsive-controls flex-shrink-0 w-full rounded-xl border border-slate-600/38 ' +
    'bg-gradient-to-b from-slate-900/92 via-[#0a0d12] to-[#050608] p-2 sm:p-2.5 ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_40px_-18px_rgba(0,0,0,0.72)] ring-1 ring-inset ring-white/[0.03] ' +
    'flex flex-col items-stretch justify-center gap-2 min-[1025px]:gap-1 min-[1025px]:p-1.5';

export const arenaGameRoomControlsFooterCompactClass =
    'responsive-controls flex-shrink-0 w-full rounded-xl border border-slate-600/38 ' +
    'bg-gradient-to-b from-slate-900/92 via-[#0a0d12] to-[#050608] p-1.5 sm:p-2 ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_40px_-18px_rgba(0,0,0,0.72)] ring-1 ring-inset ring-white/[0.03] ' +
    'flex flex-col items-stretch justify-center gap-1.5 min-[1025px]:gap-1 min-[1025px]:p-1';

/** 푸터 내부 서브 패널 (매너 액션 / 대국·특수 기능) — 모바일은 가독성 위해 배경을 진하게 */
export const arenaGameRoomControlsInnerPanelClass =
    'rounded-xl border border-slate-600/45 bg-slate-950/90 p-2 ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-white/[0.07] ' +
    'min-[1025px]:border-slate-600/32 min-[1025px]:bg-black/28 min-[1025px]:ring-white/[0.04]';

export const arenaGameRoomControlsInnerPanelAccentClass =
    'rounded-xl border border-amber-600/40 bg-gradient-to-b from-slate-900/94 via-amber-950/35 to-slate-950/94 p-2 ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-500/22 ' +
    'min-[1025px]:border-amber-800/32 min-[1025px]:from-black/22 min-[1025px]:via-amber-950/12 min-[1025px]:to-black/24 min-[1025px]:ring-amber-600/10';

export const arenaGameRoomControlsSectionTitleClass =
    'text-center text-[11px] font-bold tracking-wide text-slate-400/95';

export const arenaGameRoomControlsDividerClass =
    'w-0.5 shrink-0 self-stretch rounded-full bg-gradient-to-b from-slate-500/10 via-slate-500/45 to-slate-500/10';

/** 싱글플레이 푸터 이중 패널 — 모바일에서 텍스트 대비 */
export const arenaGameRoomSinglePlayerSplitPanelClass =
    'flex min-h-[2.75rem] min-w-0 flex-1 flex-col justify-center rounded-xl border border-slate-600/42 bg-slate-950/88 px-1.5 py-1 ' +
    'ring-1 ring-inset ring-white/[0.07] min-[1025px]:border-slate-600/34 min-[1025px]:bg-black/22 min-[1025px]:ring-white/[0.04]';

export const arenaGameRoomSinglePlayerSplitPanelAccentClass =
    'flex min-h-[2.75rem] min-w-0 flex-1 flex-col justify-center rounded-xl border border-amber-700/38 bg-gradient-to-b from-slate-900/90 to-amber-950/30 px-1.5 py-1 ' +
    'ring-1 ring-inset ring-amber-500/18 min-[1025px]:border-amber-900/28 min-[1025px]:bg-amber-950/12 min-[1025px]:ring-amber-700/12';

export const arenaGameRoomSinglePlayerOuterBarClass =
    'rounded-xl border border-slate-600/34 bg-black/30 w-full ring-1 ring-inset ring-white/[0.04]';

/** 관리자 푸터 줄 */
export const arenaGameRoomControlsAdminBarClass =
    'mt-1 flex w-full min-w-0 flex-row items-center gap-4 rounded-xl border border-violet-800/35 ' +
    'bg-gradient-to-r from-violet-950/45 via-slate-950/80 to-slate-950/90 p-2 ring-1 ring-inset ring-violet-500/15';

/** 전광판 배경(온라인 대국, 싱글 제외) — `border`는 TurnDisplay baseClasses와 함께 쓰임 */
export const arenaGameRoomTurnDisplayBgClass =
    'bg-gradient-to-b from-slate-800/95 via-slate-900/96 to-[#0b0e14] border-slate-500/55';

/** 매너 액션 칩 (작은 버튼) */
const MANNER_CHIP_BASE =
    'relative min-w-0 max-w-full shrink whitespace-nowrap rounded-lg border font-semibold ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_14px_-8px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-white/[0.05] ' +
    'transition-[transform,box-shadow,filter] duration-200 hover:-translate-y-px hover:brightness-[1.04] active:translate-y-0 active:scale-[0.99] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ' +
    'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0';

export function arenaGameRoomMannerChipClass(isMobile: boolean, type: 'manner' | 'other'): string {
    const sizing = isMobile
        ? 'text-[0.62rem] leading-tight px-2 py-1'
        : 'text-[clamp(0.5rem,1.8vmin,0.75rem)] px-[clamp(0.35rem,1.5vmin,0.55rem)] py-[clamp(0.2rem,1vmin,0.3rem)]';
    const tone =
        type === 'manner'
            ? 'border-emerald-600/40 bg-gradient-to-b from-emerald-800/88 to-emerald-950/95 text-emerald-50'
            : 'border-amber-600/40 bg-gradient-to-b from-amber-800/85 to-amber-950/95 text-amber-50';
    return `${MANNER_CHIP_BASE} ${sizing} ${tone}`;
}

/** 사이드바 하단: 기권·나가기 */
export function arenaGameRoomSidebarLeaveBtnClass(isNoContest: boolean): string {
    const base = arenaPostGameButtonClass('danger', false, 'strip');
    if (isNoContest) {
        return `${base} !border-amber-600/38 hover:!border-amber-500/48 !from-amber-950/55 !via-zinc-900 !to-zinc-950 !text-amber-50`;
    }
    return `${base} !border-rose-800/42 hover:!border-rose-600/48 !from-rose-950/45 !via-zinc-900 !to-zinc-950 !text-rose-50`;
}

/** 사이드바 하단: 일시정지 / 재개 */
export function arenaGameRoomSidebarPauseBtnClass(isPaused: boolean): string {
    const base = arenaPostGameButtonClass('neutral', false, 'strip');
    if (isPaused) {
        return `${base} !border-emerald-700/38 hover:!border-emerald-500/45 !from-emerald-950/50 !via-zinc-900 !to-zinc-950 !text-emerald-50`;
    }
    return `${base} !border-amber-600/38 hover:!border-amber-500/48 !from-amber-950/50 !via-zinc-900 !to-zinc-950 !text-amber-50`;
}
