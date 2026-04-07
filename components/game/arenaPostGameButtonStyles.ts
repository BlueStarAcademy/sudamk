/**
 * 경기 종료 후 인게임 푸터·결과 모달 하단 등에서 쓰는 통일된 버튼 스타일.
 * Button 컴포넌트는 bare와 함께 사용해 기본 앰버 스타일·자동 글자 축소와 섞이지 않게 함.
 */

export type ArenaPostGameActionVariant = 'result' | 'danger' | 'primary' | 'retry' | 'success' | 'neutral';

/**
 * 경기장 하단(strip)·결과 모달(modal·데스크톱) 공통 셸.
 * 좁은 화면 + strip만 살짝 타이트(행동력 푸터 공간).
 */
const POST_GAME_BUTTON_SHELL =
    'relative inline-flex w-full min-w-0 min-h-[2.75rem] sm:min-h-[3rem] items-center justify-center gap-1 ' +
    'rounded-lg sm:rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 ' +
    'text-[13px] sm:text-sm font-semibold leading-snug tracking-tight text-center tabular-nums ' +
    'border shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_22px_-10px_rgba(0,0,0,0.65)] ' +
    'ring-1 ring-inset ring-white/[0.05] ' +
    'before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-to-b before:from-white/[0.06] before:to-transparent ' +
    'transition-[transform,box-shadow,border-color,background-color] duration-200 ' +
    'hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_26px_-10px_rgba(0,0,0,0.5)] ' +
    'active:translate-y-0 active:scale-[0.99] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ' +
    'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0';

/** 결과 모달 + 모바일: 작은 라벨·낮은 높이로 밀도 있게 */
const POST_GAME_MODAL_MOBILE_SHELL =
    'relative inline-flex w-full min-w-0 min-h-[2.125rem] items-center justify-center gap-0.5 ' +
    'rounded-lg px-2 py-1.5 ' +
    'text-[11px] font-medium leading-tight tracking-[0.02em] text-center tabular-nums ' +
    'border shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_4px_16px_-8px_rgba(0,0,0,0.55)] ' +
    'ring-1 ring-inset ring-white/[0.04] ' +
    'before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-to-b before:from-white/[0.04] before:to-transparent ' +
    'transition-[transform,box-shadow,border-color,background-color] duration-200 ' +
    'hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_18px_-8px_rgba(0,0,0,0.45)] ' +
    'active:translate-y-0 active:scale-[0.99] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ' +
    'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0';

const STRIP_MOBILE_TIGHT = ' max-sm:px-2.5 max-sm:py-2 max-sm:text-[12.5px]';

/** 종료/결과 UI: 역할만 다르고 동일 징크 톤 */
const UNIFIED_POST_GAME_SURFACE =
    'border-zinc-600/38 bg-gradient-to-b from-zinc-700/48 via-zinc-800/92 to-zinc-950 text-zinc-100/95 ' +
    'hover:border-zinc-500/48 hover:from-zinc-600/55 hover:via-zinc-800/94';

const VARIANT: Record<ArenaPostGameActionVariant, string> = {
    result: UNIFIED_POST_GAME_SURFACE,
    primary: UNIFIED_POST_GAME_SURFACE,
    retry: UNIFIED_POST_GAME_SURFACE,
    danger: UNIFIED_POST_GAME_SURFACE,
    success: UNIFIED_POST_GAME_SURFACE,
    neutral: UNIFIED_POST_GAME_SURFACE,
};

export type ArenaPostGameButtonSize = 'strip' | 'modal';

/**
 * @param variant 시맨틱 색조
 * @param isMobile strip에서만 약간 타이트 (타이포는 동일 계열 유지)
 * @param size strip = 경기장 하단, modal = 결과 모달 푸터
 */
export function arenaPostGameButtonClass(
    variant: ArenaPostGameActionVariant,
    isMobile: boolean,
    size: ArenaPostGameButtonSize = 'strip',
): string {
    const tightStrip = isMobile && size === 'strip' ? STRIP_MOBILE_TIGHT : '';
    const shell = size === 'modal' && isMobile ? POST_GAME_MODAL_MOBILE_SHELL : POST_GAME_BUTTON_SHELL;
    return `${shell}${tightStrip} ${VARIANT[variant]}`;
}

/** 인게임 푸터·결과 모달 공통 재도전 라벨 */
export function formatArenaRetryLabel(actionPointCost: number): string {
    return actionPointCost > 0 ? `재도전 (⚡${actionPointCost})` : '재도전';
}

/** 경기 종료 버튼 묶음: 열 폭 균등 (좁으면 자동으로 줄바꿈) — 결과 모달·넓은 푸터용 */
export const arenaPostGameButtonGridClass =
    'grid w-full gap-2 sm:gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,9.25rem),1fr))]';

/** 인게임 경기장 종료 푸터: 한 줄 가로 (버튼 많으면 가로 스크롤) */
export const arenaPostGameIngameEndedRowClass =
    'flex w-full min-w-0 flex-row flex-nowrap items-stretch justify-center gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 sm:gap-2 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]';

/**
 * `arenaPostGameButtonClass` 기본 셸에 `w-full`이 있어 그리드에 맞춘 것임.
 * 가로 한 줄 행 안에서는 균등 분배 + 최소 폭만 유지.
 */
export const arenaPostGameButtonInRowModifier =
    '!w-auto min-w-0 flex-1 basis-0 sm:min-w-[5.75rem] md:min-w-[6.5rem]';

export const arenaPostGamePanelShellClass =
    'min-w-0 rounded-xl border border-slate-600/40 bg-gradient-to-b from-slate-900/95 via-[#0f1218] to-[#06080c] px-2 py-3 sm:px-4 sm:py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-inset ring-white/[0.03]';

/** 싱글플레이 종료 패널 — `다음 단계(스테이지명)` + 소모 행동력 */
export function formatSinglePlayerNextFooterLabel(
    nextStage: { name: string } | undefined,
    canTryNext: boolean,
    actionPointCost: number,
): string {
    if (!canTryNext || !nextStage) return '다음 단계(없음)';
    const name = nextStage.name.replace(/^스테이지\s*/i, '').trim();
    const base = `다음 단계(${name})`;
    return actionPointCost > 0 ? `${base} (⚡${actionPointCost})` : base;
}

/** 도전의 탑 종료 패널 — `다음 단계(N층)` + 소모 행동력 */
export function formatTowerNextFooterLabel(
    nextFloor: number | null,
    canTryNext: boolean,
    actionPointCost: number,
): string {
    if (!canTryNext || nextFloor == null) return '다음 단계(없음)';
    const base = `다음 단계(${nextFloor}층)`;
    return actionPointCost > 0 ? `${base} (⚡${actionPointCost})` : base;
}
