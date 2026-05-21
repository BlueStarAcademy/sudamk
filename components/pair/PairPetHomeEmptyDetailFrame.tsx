import React from 'react';
import { CORE_STATS_DATA } from '../../constants/index.js';
import { CORE_STAT_RADAR_ORDER } from '../CoreStatsHexagonChart.js';
export interface PairPetHomeEmptyDetailFrameProps {
    /** {@link PairPetDetailCardBody} `statsGridVariant`와 동일 */
    variant: 'modal' | 'panelFit';
    /** 네이티브 홈 대표펫 칸 — 장착 시 카드와 동일한 촘촘·스케일 맞춤 */
    mobileHomeRepPet?: boolean;
    /** 대표 펫 지정을 위해 펫 인벤(정보 탭)으로 이동 */
    onRequestEquip?: () => void;
}

/**
 * 홈 대표 펫 미보유 시 — {@link PairPetDetailCardBody}와 동일한 상·하(성향·특화 가로) 틀만 두고 수치·이미지는 비움.
 */
const PairPetHomeEmptyDetailFrame: React.FC<PairPetHomeEmptyDetailFrameProps> = ({ variant, mobileHomeRepPet = false, onRequestEquip }) => {
    const isPanelFit = variant === 'panelFit';
    const homePack = Boolean(isPanelFit && mobileHomeRepPet);
    const rootGap = homePack ? 'gap-0.5' : isPanelFit ? 'gap-1' : 'gap-2.5 sm:gap-4';
    const heroOuterRound = isPanelFit ? 'rounded-xl' : 'rounded-2xl';
    const rowPad = homePack ? 'p-1' : isPanelFit ? 'p-1.5' : 'p-2 sm:p-3';
    const imgShellClass = isPanelFit
        ? homePack
            ? 'relative aspect-square w-full max-w-[6rem] overflow-hidden rounded-lg border border-dashed border-white/20 bg-zinc-900/70 shadow-inner'
            : 'relative aspect-square w-full max-w-full overflow-hidden rounded-lg border border-dashed border-white/20 bg-zinc-900/70 shadow-inner'
        : 'relative aspect-square w-full max-w-full overflow-hidden rounded-xl border border-dashed border-white/20 bg-zinc-950 shadow-inner sm:max-w-[min(100%,7.5rem)]';
    const badgeClass = isPanelFit
        ? 'inline-block h-3.5 w-9 rounded border border-white/10 bg-zinc-800/60'
        : 'inline-block h-4 w-10 rounded-md border border-white/10 bg-zinc-800/60 sm:h-4 sm:w-11';
    const repBadgeClass = isPanelFit
        ? 'inline-block h-3 w-12 rounded border border-cyan-500/25 bg-cyan-950/35'
        : 'inline-block h-4 w-14 rounded-md border border-cyan-500/25 bg-cyan-950/35';
    const lvLineClass = isPanelFit ? 'h-3 w-10 rounded bg-zinc-800/50' : 'h-3.5 w-11 rounded bg-zinc-800/50 sm:h-4';
    const nameLineClass = isPanelFit
        ? 'mt-0.5 h-3.5 w-[85%] max-w-[8rem] rounded bg-zinc-800/40 sm:h-4'
        : 'mt-0.5 h-4 w-[82%] max-w-[9rem] rounded bg-zinc-800/40 sm:h-4 sm:max-w-[10rem]';
    const expLineClass = isPanelFit ? 'h-2.5 w-28 rounded bg-zinc-800/35 sm:w-32' : 'h-3 w-36 rounded bg-zinc-800/35 sm:w-40';
    const barH = homePack ? 'h-1.5' : isPanelFit ? 'h-2 sm:h-2' : 'h-2.5 sm:h-3';
    const traitRowGap = homePack ? 'gap-1' : isPanelFit ? 'gap-1 sm:gap-1.5' : 'gap-1.5 sm:gap-2';
    const traitBoxFuchsia = isPanelFit
        ? homePack
            ? 'flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/40 to-zinc-950/85 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
            : 'flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded-md border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/40 to-zinc-950/85 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-2 sm:py-1.5'
        : 'flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded-lg border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/35 to-zinc-950/80 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-2.5 sm:py-2';
    const traitBoxAmber = isPanelFit
        ? homePack
            ? 'flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded border border-amber-500/25 bg-gradient-to-br from-amber-950/30 to-zinc-950/85 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
            : 'flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded-md border border-amber-500/25 bg-gradient-to-br from-amber-950/30 to-zinc-950/85 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-2 sm:py-1.5'
        : 'flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded-lg border border-amber-500/25 bg-gradient-to-br from-amber-950/25 to-zinc-950/80 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-2.5 sm:py-2';
    const traitTitleFuchsia = isPanelFit
        ? homePack
            ? 'text-xs font-bold uppercase leading-none tracking-wide text-fuchsia-200/90 antialiased'
            : 'text-[0.58rem] font-bold uppercase tracking-wide text-fuchsia-200/90 sm:text-[0.62rem]'
        : 'text-[0.62rem] font-bold uppercase tracking-wide text-fuchsia-200/85 sm:text-[0.68rem]';
    const traitTitleAmber = isPanelFit
        ? homePack
            ? 'text-xs font-bold uppercase leading-none tracking-wide text-amber-200/90 antialiased'
            : 'text-[0.58rem] font-bold uppercase tracking-wide text-amber-200/90 sm:text-[0.62rem]'
        : 'text-[0.62rem] font-bold uppercase tracking-wide text-amber-200/85 sm:text-[0.68rem]';
    const traitBodyMuted = isPanelFit
        ? 'mt-0.5 min-h-[1.1rem] w-full rounded bg-zinc-800/30 sm:min-h-[1.2rem]'
        : 'mt-0.5 min-h-[1.25rem] w-full rounded bg-zinc-800/30 sm:min-h-[1.4rem]';
    /** 바둑능력 스트립·6코어 */
    const stripPad = homePack ? 'gap-x-1 px-1 py-0.5' : 'gap-x-1 px-1.5 py-1 sm:gap-x-1.5 sm:px-2 sm:py-1.5';
    const stripLabel = homePack ? 'text-[13px] font-bold leading-snug text-amber-100/50 antialiased' : 'text-sm font-bold text-amber-100/50 sm:text-[0.95rem]';
    const stripPhase = homePack ? 'text-xs font-semibold leading-snug text-slate-500 antialiased' : 'text-[0.7rem] text-slate-500 sm:text-xs';
    const phaseNumClass = homePack ? 'font-mono text-[13px] font-bold tabular-nums leading-snug text-sky-100/35 antialiased' : 'font-mono text-sm font-bold tabular-nums text-sky-100/35 sm:text-base';
    const gridGap = homePack ? 'grid w-full min-w-0 grid-cols-3 gap-x-1.5 gap-y-1 text-[13px] leading-snug antialiased' : 'gap-1.5 sm:gap-2';
    const cellPad = homePack ? 'px-1 py-0.5' : 'px-2 py-1.5 sm:px-2.5';
    const labelText = homePack ? 'whitespace-nowrap text-[13px] font-semibold leading-snug text-slate-500 antialiased' : 'text-[11px] text-slate-500 sm:text-xs';
    const valueBlock = homePack ? 'h-3 w-6 shrink-0 rounded bg-zinc-800/40 sm:h-3.5 sm:w-6' : 'h-3.5 w-7 rounded bg-zinc-800/40 sm:h-4 sm:w-8';

    const heroFramePad = homePack ? 'p-px' : 'p-px';
    const heroTopGridCols = homePack ? 'grid-cols-[minmax(0,6rem)_minmax(0,1fr)]' : 'grid-cols-[3fr_7fr]';

    const inner = (
        <div className={`flex w-full min-w-0 flex-col ${rootGap}`}>
            <div
                className={`relative flex min-h-0 w-full min-w-0 flex-col overflow-hidden bg-gradient-to-br from-zinc-900 via-violet-950/35 to-zinc-950 ${heroFramePad} shadow-[0_12px_28px_-10px_rgba(0,0,0,0.65)] ring-1 ring-fuchsia-400/35 ${heroOuterRound}`}
            >
                <div
                    className={`relative z-[1] grid min-w-0 ${heroTopGridCols} items-stretch border-b border-white/10 bg-zinc-950/92 ${rowPad} ${
                        homePack ? 'gap-x-1 gap-y-0.5' : 'gap-x-2 gap-y-1 sm:gap-x-2.5 sm:gap-y-1.5'
                    }`}
                >
                    <div className="flex min-w-0 flex-col items-center justify-center py-0.5">
                        <div className={imgShellClass} aria-hidden />
                    </div>
                    <div className="flex min-w-0 flex-col justify-center gap-1 text-left sm:gap-1.5">
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                            <span className={badgeClass} aria-hidden />
                            <span className={repBadgeClass} aria-hidden />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className={lvLineClass} aria-hidden />
                            <span className={nameLineClass} aria-hidden />
                        </div>
                        <div className="mt-0.5 space-y-0.5">
                            <div className={expLineClass} aria-hidden />
                            <div className={`${barH} w-full rounded-full border border-zinc-800/90 bg-zinc-900/90`} aria-hidden />
                        </div>
                    </div>
                </div>
                <div className={`relative z-[1] flex min-h-0 min-w-0 flex-row items-stretch bg-zinc-950/92 ${rowPad} ${traitRowGap}`}>
                    <div className={traitBoxFuchsia}>
                        <p className={traitTitleFuchsia}>성향</p>
                        <div className={traitBodyMuted} aria-hidden />
                    </div>
                    <div className={traitBoxAmber}>
                        <p className={traitTitleAmber}>특화</p>
                        <div className={traitBodyMuted} aria-hidden />
                    </div>
                </div>
            </div>

            <div
                className={`flex min-w-0 flex-nowrap items-center justify-center rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 to-zinc-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${homePack ? 'overflow-x-hidden' : 'overflow-x-auto [scrollbar-width:thin]'} ${stripPad}`}
            >
                <span className={`inline-flex shrink-0 items-baseline gap-0.5 ${stripLabel}`}>
                    바둑능력
                    <span className="font-mono tabular-nums text-amber-50/35">—</span>
                </span>
                <span className={`shrink-0 self-center bg-white/15 ${homePack ? 'mx-0.5 h-2.5 w-px sm:h-3' : 'mx-1 h-3 w-px sm:h-3.5'}`} aria-hidden />
                {(['초반', '중반', '종반'] as const).map((label, idx) => (
                    <React.Fragment key={label}>
                        {idx > 0 ? (
                            <span className={`shrink-0 self-center bg-white/12 ${homePack ? 'mx-0.5 h-2.5 w-px sm:h-3' : 'h-3 w-px sm:h-3.5'}`} aria-hidden />
                        ) : null}
                        <span className="inline-flex shrink-0 items-baseline gap-0.5">
                            <span className={stripPhase}>{label}</span>
                            <span className={phaseNumClass}>—</span>
                        </span>
                    </React.Fragment>
                ))}
            </div>

            <div className={`grid w-full min-w-0 grid-cols-3 ${gridGap}`}>
                {CORE_STAT_RADAR_ORDER.map((stat) => {
                    const name = CORE_STATS_DATA[stat]?.name ?? stat;
                    return (
                        <div
                            key={stat}
                            className={`flex min-w-0 flex-row items-center justify-between ${homePack ? 'gap-0.5' : 'gap-2'} rounded-md border border-white/10 bg-black/30 ${cellPad}`}
                        >
                            <span className={`text-left font-semibold ${homePack ? labelText : `max-w-[58%] truncate leading-snug ${labelText}`}`}>{name}</span>
                            <span className={valueBlock} aria-hidden />
                        </div>
                    );
                })}
            </div>

            <p
                className={`text-center font-medium text-slate-500 antialiased ${homePack ? 'text-sm leading-snug' : 'text-[0.65rem] sm:text-xs'}`}
            >
                대표 펫이 없습니다
            </p>
        </div>
    );

    if (!onRequestEquip) {
        return inner;
    }

    return (
        <button
            type="button"
            onClick={() => onRequestEquip()}
            className="w-full cursor-pointer rounded-lg border border-transparent text-left outline-none transition-colors hover:border-amber-500/20 hover:bg-amber-950/10 focus-visible:border-amber-400/40 focus-visible:ring-1 focus-visible:ring-amber-300/30"
        >
            {inner}
        </button>
    );
};

export default PairPetHomeEmptyDetailFrame;
