import React, { useMemo } from 'react';
import { CORE_STATS_DATA } from '../../constants/index.js';
import { calculateTotalStats } from '../../services/statService.js';
import type { PairPetMeta, User } from '../../types.js';
import { CoreStat, ItemGrade } from '../../types/enums.js';
import { pairPetRawBaseCoreNoLevel } from '../../shared/utils/pairPetKataStatsFromMeta.js';

const CORE_LIST = Object.values(CoreStat) as CoreStat[];

/** 유저 스탯 상한은 유지하되, 펫 등급 기준 기본치보다 낮게 깎이지 않게 함(태생 분배 또는 레거시 코어당 50 기준). */
function pairPetShownCoreValue(rawBase: number, rawBaseNoLvl: number, userCap: number): number {
    const cap = Number.isFinite(userCap) ? userCap : rawBase;
    return Math.min(rawBase, Math.max(cap, rawBaseNoLvl));
}

function dispositionFlatBonus(
    disposition: PairPetMeta['disposition'],
    stat: CoreStat,
    rawBaseForStat: (s: CoreStat) => number,
): number {
    if (disposition.kind === 'all') {
        return Math.round((rawBaseForStat(stat) * disposition.pct) / 100);
    }
    if (disposition.kind === 'single' && disposition.stat === stat) {
        return Math.round((rawBaseForStat(disposition.stat) * disposition.pct) / 100);
    }
    if (disposition.kind === 'convert') {
        const slice = Math.round((rawBaseForStat(disposition.fromStat) * disposition.pct) / 100);
        if (stat === disposition.fromStat) return -slice;
        if (stat === disposition.toStat) return 2 * slice;
        return 0;
    }
    return 0;
}

/** 6코어 표시값+성향 보너스 합 — 그리드와 동일 규칙(등급 배율 반영) */
export function computePairPetBadukTotalPower(
    currentUser: User,
    disposition: PairPetMeta['disposition'],
    petGrade: ItemGrade = ItemGrade.Normal,
    levelUpCoreBonuses?: Partial<Record<CoreStat, number>>,
    birthCoreBases?: PairPetMeta['birthCoreBases'],
): number {
    const userTotals = calculateTotalStats(currentUser);
    const rawBaseForStat = (s: CoreStat) => pairPetRawBaseCoreNoLevel(birthCoreBases, petGrade, s);
    let sum = 0;
    for (const stat of CORE_LIST) {
        const lvlAdd = levelUpCoreBonuses?.[stat] ?? 0;
        const rawBaseNoLvl = rawBaseForStat(stat);
        const rawBase = rawBaseNoLvl + lvlAdd;
        const cap = userTotals[stat] ?? rawBase;
        const shown = pairPetShownCoreValue(rawBase, rawBaseNoLvl, cap);
        sum += shown + dispositionFlatBonus(disposition, stat, rawBaseForStat);
    }
    return sum;
}

export interface PairPetCoreStatsGridProps {
    currentUser: User;
    disposition: PairPetMeta['disposition'];
    /** 펫 인벤 행 등급 — 등급당 누적 ×1.1 기본 능력치 */
    petGrade?: ItemGrade;
    /** 부화 시 태생 6코어(각 30~70·합 300, 등급 배율 전). 없으면 코어당 50과 동일 */
    birthCoreBases?: PairPetMeta['birthCoreBases'];
    /** 레벨업 시 누적된 6코어 보너스 */
    levelUpCoreBonuses?: Partial<Record<CoreStat, number>>;
    /** 모달(어두운 배경) vs 로비 정보(밝은 카드) 등 톤 */
    variant?: 'modal' | 'panel';
    /** compact: 1열 스택·작은 글꼴 / micro: 홈 대표펫 칸용 더 촘촘 / fit: 3열 유지·한 화면 맞춤용 초소형 */
    density?: 'default' | 'compact' | 'micro' | 'fit';
    className?: string;
}

/**
 * 페어 펫 6코어 능력치 — 라벨·수치(+보너스)를 한 줄로, 3×2 그리드.
 * 획득 모달·펫 정보 뷰에서 공통 사용.
 */
const PairPetCoreStatsGrid: React.FC<PairPetCoreStatsGridProps> = ({
    currentUser,
    disposition,
    petGrade = ItemGrade.Normal,
    birthCoreBases,
    levelUpCoreBonuses,
    variant = 'modal',
    density = 'default',
    className = '',
}) => {
    const userTotals = useMemo(() => calculateTotalStats(currentUser), [currentUser]);
    const rawBaseForStat = useMemo(
        () => (s: CoreStat) => pairPetRawBaseCoreNoLevel(birthCoreBases, petGrade, s),
        [birthCoreBases, petGrade],
    );

    const micro = density === 'micro';
    const fit = density === 'fit';
    const compact = density === 'compact' || micro || fit;

    const cell =
        micro
            ? 'rounded border border-white/10 bg-black/30 px-1 py-0.5'
            : fit
              ? 'rounded border border-white/10 bg-black/30 px-1 py-0.5'
              : compact
                ? 'rounded-md border border-white/10 bg-black/30 px-1.5 py-1'
                : variant === 'modal'
                  ? 'rounded-md border border-white/[0.1] bg-zinc-950/80 px-1.5 py-1 ring-1 ring-inset ring-white/[0.04] sm:rounded-lg sm:px-2 sm:py-1.5'
                  : 'rounded-md border border-white/10 bg-black/30 px-2 py-1.5';

    const gridClass = micro
        ? 'grid grid-cols-1 gap-0.5 text-[9px] leading-none'
        : fit
          ? 'grid grid-cols-3 gap-x-1 gap-y-0.5 text-[0.58rem] leading-tight'
          : compact
            ? 'grid grid-cols-1 gap-1 text-[10px] leading-tight'
            : variant === 'modal'
              ? 'grid grid-cols-3 gap-x-1.5 gap-y-1 text-[0.72rem] leading-tight sm:gap-x-3 sm:gap-y-2 sm:text-sm'
              : 'grid grid-cols-3 gap-x-2 gap-y-1.5 text-[0.8125rem] leading-tight sm:gap-x-3 sm:gap-y-2 sm:text-sm';

    return (
        <div className={`${gridClass} ${className}`.trim()}>
            {CORE_LIST.map((stat) => {
                const lvlAdd = levelUpCoreBonuses?.[stat] ?? 0;
                const rawBaseNoLvl = rawBaseForStat(stat);
                const rawBase = rawBaseNoLvl + lvlAdd;
                const cap = userTotals[stat] ?? rawBase;
                const shown = pairPetShownCoreValue(rawBase, rawBaseNoLvl, cap);
                const corrected = shown < rawBase;
                const bonus = dispositionFlatBonus(disposition, stat, rawBaseForStat);
                const statLabel = CORE_STATS_DATA[stat]?.name ?? stat;
                const bonusTitle = bonus !== 0 ? ` (${bonus > 0 ? '+' : ''}${bonus})` : '';
                return (
                    <div
                        key={stat}
                        className={`flex min-w-0 flex-nowrap items-center justify-between ${micro || fit ? 'gap-0.5' : 'gap-1.5'} ${cell}`}
                        title={`${statLabel} ${shown}${bonusTitle}`}
                    >
                        <span
                            className={`shrink-0 font-semibold text-slate-400 ${
                                compact || fit ? 'whitespace-nowrap' : 'min-w-0 shrink truncate'
                            }`}
                        >
                            {statLabel}
                        </span>
                        <span
                            className={`shrink-0 whitespace-nowrap font-mono font-bold tabular-nums ${
                                micro
                                    ? 'text-[9px]'
                                    : fit
                                      ? 'text-[0.58rem]'
                                      : compact
                                        ? 'text-[10px]'
                                        : variant === 'modal'
                                          ? 'text-[0.68rem] sm:text-sm'
                                          : 'text-[0.78rem] sm:text-sm'
                            } ${corrected ? 'text-rose-300' : 'text-slate-100'}`}
                        >
                            {shown}
                            {bonus !== 0 ? (
                                <span
                                    className={`font-semibold ${
                                        bonus > 0 ? 'text-fuchsia-300/95' : 'text-amber-200/90'
                                    }`}
                                >
                                    ({bonus > 0 ? '+' : ''}
                                    {bonus})
                                </span>
                            ) : null}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default PairPetCoreStatsGrid;
