import React, { useMemo } from 'react';
import type { InventoryItem, User } from '../../types.js';
import { resolvePairPetMetaFromInventoryRow } from '../../shared/utils/pairPetRoll.js';
import { effectivePairPetGradeFromRow } from '../../shared/constants/pairPetGrade.js';
import { pairPetKataAbilityScore, type PairPetKataPhase } from '../../shared/constants/pairArena.js';
import { computePairPetKataCoreStatsSixFromMeta } from '../../shared/utils/pairPetKataStatsFromMeta.js';
import PairPetCoreStatsGrid, { computePairPetBadukTotalPower } from './PairPetCoreStatsGrid.js';

export type PairPetBadukStripLayout = 'default' | 'dense' | 'homeColumn';

export interface PairPetBadukPhaseStripAndCoreGridProps {
    currentUser: User;
    item: InventoryItem;
    statsGridVariant: 'modal' | 'panel';
    /** 스트립·그리드 간격·글꼴 — homeColumn: 홈 대표펫 칸에 맞춤 최소 높이 */
    layout?: PairPetBadukStripLayout;
    /** @deprecated `layout="dense"`와 동일 */
    dense?: boolean;
    /** 지정 시 6코어 그리드 밀도(레이아웃 유도값보다 우선) — `panelFit` 상세 등 */
    coreGridDensity?: 'default' | 'compact' | 'micro' | 'fit';
    /** 네이티브 홈 대표펫: 스트립·코어 그리드 세로·가로 여백 축소, 스크롤 없이 맞춤 */
    mobileHomeRepPet?: boolean;
    className?: string;
}

/** 바둑능력(초·중·종반) 스트립 + 6코어 그리드 — 상세 카드·홈 대표펫 등 공통 */
const PairPetBadukPhaseStripAndCoreGrid: React.FC<PairPetBadukPhaseStripAndCoreGridProps> = ({
    currentUser,
    item,
    statsGridVariant,
    layout: layoutProp,
    dense = false,
    coreGridDensity: coreGridDensityProp,
    mobileHomeRepPet = false,
    className = '',
}) => {
    const layout: PairPetBadukStripLayout = layoutProp ?? (dense ? 'dense' : 'default');
    const tight = layout !== 'default';
    const homeColumn = layout === 'homeColumn';

    const meta = useMemo(() => resolvePairPetMetaFromInventoryRow(item), [item]);
    const petGrade = effectivePairPetGradeFromRow(item);
    const isModal = statsGridVariant === 'modal';
    /** 펫 상세 모달(비 panelFit) — 스트립 타이포·좁은 간격 */
    const modalStripComfort = isModal && !tight;
    const homePackStrip = Boolean(mobileHomeRepPet && modalStripComfort);

    const stripTextMain = tight
        ? homeColumn
            ? 'text-[0.52rem] font-bold text-amber-100 sm:text-[0.56rem]'
            : 'text-[0.58rem] sm:text-[0.62rem]'
        : 'text-[0.62rem] font-bold text-amber-100 sm:text-xs';
    const stripTotalNum = homeColumn
        ? 'text-xs font-black sm:text-sm'
        : tight
          ? 'text-sm font-black sm:text-base'
          : isModal
            ? 'text-sm font-black sm:text-base'
            : 'text-base font-black';
    const stripPhaseLabel = tight
        ? homeColumn
            ? 'text-[0.48rem] font-semibold text-slate-400 sm:text-[0.52rem]'
            : 'text-[0.52rem] sm:text-[0.56rem]'
        : 'text-[0.58rem] font-semibold text-slate-400 sm:text-xs';
    const stripPhaseNum = homeColumn
        ? 'text-[0.65rem] sm:text-xs'
        : tight
          ? 'text-xs font-bold sm:text-sm'
          : isModal
            ? 'text-xs sm:text-sm'
            : 'text-sm';

    const stripTextMainModal = 'text-sm font-bold text-amber-100 sm:text-[0.95rem]';
    const stripTotalNumModal = 'text-base font-black tabular-nums text-amber-50 sm:text-lg';
    const stripPhaseLabelModal = 'text-[0.7rem] font-semibold leading-none text-slate-400 sm:text-xs';
    const stripPhaseNumModal = 'text-sm font-bold tabular-nums text-sky-100 sm:text-base';

    const kataCoreSix = useMemo(() => computePairPetKataCoreStatsSixFromMeta(meta, petGrade), [meta, petGrade]);
    const badukTotalPower = useMemo(
        () =>
            computePairPetBadukTotalPower(currentUser, meta.disposition, petGrade, meta.levelUpCoreBonuses, meta.birthCoreBases),
        [currentUser, meta.disposition, petGrade, meta.levelUpCoreBonuses, meta.birthCoreBases],
    );
    const phaseScores = useMemo(() => {
        const phases: PairPetKataPhase[] = ['opening', 'midgame', 'endgame'];
        const out: Partial<Record<PairPetKataPhase, number>> = {};
        for (const p of phases) {
            out[p] = pairPetKataAbilityScore(p, kataCoreSix);
        }
        return out as Record<PairPetKataPhase, number>;
    }, [kataCoreSix]);

    const stripPad = homeColumn
        ? 'gap-x-1 px-1 py-0.5 sm:gap-x-1.5 sm:px-1.5 sm:py-1'
        : tight
          ? 'gap-x-1.5 px-1.5 py-1 sm:gap-x-2 sm:px-2 sm:py-1.5'
          : homePackStrip
            ? 'gap-x-1 px-1.5 py-1 sm:gap-x-1.5 sm:px-2 sm:py-1'
            : modalStripComfort
              ? 'gap-x-1 px-1.5 py-1 sm:gap-x-1.5 sm:px-2 sm:py-1.5'
              : 'gap-x-2 px-2 py-1.5 sm:gap-x-3 sm:px-3 sm:py-2';

    const blockGap = homeColumn ? 'gap-1' : homePackStrip ? 'gap-1' : tight ? 'gap-2' : 'gap-4';

    const gridDensity =
        coreGridDensityProp ?? (homePackStrip ? 'fit' : homeColumn ? 'micro' : tight ? 'compact' : 'default');

    const phaseDefs = [
        { phase: 'opening' as const, label: '초반' },
        { phase: 'midgame' as const, label: '중반' },
        { phase: 'endgame' as const, label: '종반' },
    ] as const;

    return (
        <div className={`flex w-full min-w-0 flex-col ${blockGap} ${className}`}>
            {modalStripComfort ? (
                <div
                    className={`flex min-w-0 flex-nowrap items-center justify-center rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 to-zinc-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${homePackStrip ? 'overflow-x-hidden' : 'overflow-x-auto [scrollbar-width:thin]'} ${stripPad}`}
                >
                    <span className="inline-flex shrink-0 items-baseline gap-0.5">
                        <span className={homePackStrip ? 'text-xs font-bold text-amber-100 sm:text-sm' : stripTextMainModal}>바둑능력</span>
                        <span
                            className={`font-mono tabular-nums ${homePackStrip ? 'text-sm font-black text-amber-50 sm:text-base' : stripTotalNumModal}`}
                        >
                            {badukTotalPower}
                        </span>
                    </span>
                    <span className={`shrink-0 self-center bg-white/15 ${homePackStrip ? 'mx-0.5 h-2.5 w-px sm:h-3' : 'mx-1 h-3 w-px sm:h-3.5'}`} aria-hidden />
                    {phaseDefs.map(({ phase, label }, idx) => (
                        <React.Fragment key={phase}>
                            {idx > 0 ? (
                                <span
                                    className={`shrink-0 self-center bg-white/12 ${homePackStrip ? 'mx-0.5 h-2.5 w-px sm:h-3' : 'h-3 w-px sm:h-3.5'}`}
                                    aria-hidden
                                />
                            ) : null}
                            <span className="inline-flex shrink-0 items-baseline gap-0.5">
                                <span className={homePackStrip ? 'text-[0.62rem] font-semibold leading-none text-slate-400 sm:text-xs' : stripPhaseLabelModal}>
                                    {label}
                                </span>
                                <span
                                    className={`font-mono font-bold tabular-nums ${homePackStrip ? 'text-xs text-sky-100 sm:text-sm' : stripPhaseNumModal}`}
                                >
                                    {phaseScores[phase]}
                                </span>
                            </span>
                        </React.Fragment>
                    ))}
                </div>
            ) : (
                <div
                    className={`flex min-w-0 flex-nowrap items-center overflow-x-auto rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 to-zinc-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] [scrollbar-width:thin] ${stripPad} ${
                        isModal ? 'justify-start' : 'justify-center sm:justify-start'
                    }`}
                >
                    <span className="inline-flex shrink-0 items-baseline gap-0.5 sm:gap-1">
                        <span
                            className={tight ? (homeColumn ? stripTextMain : `${stripTextMain} font-bold text-amber-100`) : stripTextMain}
                        >
                            바둑능력
                        </span>
                        <span className={`font-mono tabular-nums text-amber-50 ${stripTotalNum}`}>{badukTotalPower}</span>
                    </span>
                    <span className="h-3 w-px shrink-0 self-center bg-white/15 sm:h-3.5" aria-hidden />
                    {phaseDefs.map(({ phase, label }, idx) => (
                        <React.Fragment key={phase}>
                            {idx > 0 ? (
                                <span className="h-3 w-px shrink-0 self-center bg-white/12 sm:h-3.5" aria-hidden />
                            ) : null}
                            <span className="inline-flex shrink-0 items-baseline gap-0.5">
                                <span
                                    className={
                                        tight ? (homeColumn ? stripPhaseLabel : `${stripPhaseLabel} font-semibold text-slate-400`) : stripPhaseLabel
                                    }
                                >
                                    {label}
                                </span>
                                <span className={`font-mono font-bold tabular-nums text-sky-100 ${stripPhaseNum}`}>{phaseScores[phase]}</span>
                            </span>
                        </React.Fragment>
                    ))}
                </div>
            )}

            <PairPetCoreStatsGrid
                currentUser={currentUser}
                disposition={meta.disposition}
                petGrade={petGrade}
                birthCoreBases={meta.birthCoreBases}
                levelUpCoreBonuses={meta.levelUpCoreBonuses}
                variant={statsGridVariant}
                density={gridDensity}
            />
        </div>
    );
};

export default PairPetBadukPhaseStripAndCoreGrid;
