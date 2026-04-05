/**
 * 경기 종료 후 인게임 푸터·결과 모달 하단 등에서 쓰는 통일된 버튼 스타일.
 * Button 컴포넌트는 bare와 함께 사용해 기본 앰버 스타일·자동 글자 축소와 섞이지 않게 함.
 */

export type ArenaPostGameActionVariant = 'result' | 'danger' | 'primary' | 'retry' | 'success' | 'neutral';

/** 공통: 동일 높이·패딩·타이포 (모바일/데스크톱 비율만 살짝 조정) */
const STRIP_SHELL =
    'relative inline-flex w-full min-w-0 min-h-[2.75rem] sm:min-h-[3rem] items-center justify-center gap-1 ' +
    'rounded-lg sm:rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 ' +
    'text-[13px] sm:text-sm font-semibold leading-snug tracking-tight text-center tabular-nums ' +
    'border shadow-[0_8px_24px_-12px_rgba(0,0,0,0.75)] ' +
    'ring-1 ring-inset ring-white/[0.06] ' +
    'before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-to-b before:from-white/[0.08] before:to-transparent ' +
    'transition-[transform,box-shadow,border-color,background-color] duration-200 ' +
    'hover:-translate-y-px hover:shadow-[0_12px_28px_-10px_rgba(0,0,0,0.55)] ' +
    'active:translate-y-0 active:scale-[0.99] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0c10] ' +
    'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0';

const MODAL_SHELL =
    'relative inline-flex w-full min-w-0 min-h-[2.75rem] sm:min-h-[3rem] items-center justify-center gap-1 ' +
    'rounded-lg sm:rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 ' +
    'text-[13px] sm:text-sm font-semibold leading-snug tracking-tight text-center tabular-nums ' +
    'border shadow-[0_8px_24px_-12px_rgba(0,0,0,0.75)] ' +
    'ring-1 ring-inset ring-white/[0.06] ' +
    'before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-to-b before:from-white/[0.08] before:to-transparent ' +
    'transition-[transform,box-shadow,border-color,background-color] duration-200 ' +
    'hover:-translate-y-px hover:shadow-[0_12px_28px_-10px_rgba(0,0,0,0.55)] ' +
    'active:translate-y-0 active:scale-[0.99] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0c10] ' +
    'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0';

/** 어두운 슬레이트 베이스 + 변형별 테두리·살짝 다른 톤 (무지개 그라데이션 지양) */
const VARIANT: Record<ArenaPostGameActionVariant, string> = {
    result:
        'border-violet-500/35 bg-gradient-to-b from-slate-600/95 via-slate-800/98 to-slate-950 text-slate-50 hover:border-violet-400/50',
    primary:
        'border-sky-500/35 bg-gradient-to-b from-slate-600/95 via-slate-800/98 to-slate-950 text-slate-50 hover:border-sky-400/50',
    retry:
        'border-amber-500/40 bg-gradient-to-b from-slate-600/95 via-amber-900/35 to-slate-950 text-amber-50 hover:border-amber-400/55',
    danger:
        'border-rose-500/45 bg-gradient-to-b from-slate-600/95 via-rose-950/55 to-slate-950 text-rose-50 hover:border-rose-400/55',
    success:
        'border-emerald-500/38 bg-gradient-to-b from-slate-600/95 via-emerald-950/45 to-slate-950 text-emerald-50 hover:border-emerald-400/50',
    neutral:
        'border-slate-500/35 bg-gradient-to-b from-slate-600/95 via-slate-800/98 to-slate-950 text-slate-100 hover:border-slate-400/45',
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
    const isModal = size === 'modal';
    const shell = isModal ? MODAL_SHELL : isMobile ? `${STRIP_SHELL} max-sm:px-2.5 max-sm:text-[12.5px]` : STRIP_SHELL;

    return `${shell} ${VARIANT[variant]}`;
}

/** 경기 종료 버튼 묶음: 열 폭 균등 (좁으면 자동으로 줄바꿈) */
export const arenaPostGameButtonGridClass =
    'grid w-full gap-2 sm:gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,9.25rem),1fr))]';

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
    return actionPointCost > 0 ? `${base} · ⚡${actionPointCost}` : base;
}

/** 도전의 탑 종료 패널 — `다음 단계(N층)` + 소모 행동력 */
export function formatTowerNextFooterLabel(
    nextFloor: number | null,
    canTryNext: boolean,
    actionPointCost: number,
): string {
    if (!canTryNext || nextFloor == null) return '다음 단계(없음)';
    const base = `다음 단계(${nextFloor}층)`;
    return actionPointCost > 0 ? `${base} · ⚡${actionPointCost}` : base;
}
