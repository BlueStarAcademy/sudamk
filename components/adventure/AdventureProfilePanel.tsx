import React, { useId, useMemo } from 'react';
import { getAdventureCodexCompletionBreakdown } from '../../utils/adventureCodexCompletion.js';
import type { AdventureProfile } from '../../types/entities.js';
import { CORE_STATS_DATA } from '../../constants.js';
import {
    ADVENTURE_STAGES,
    ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS,
    getAdventureUnderstandingTierFromXp,
} from '../../constants/adventureConstants.js';
import {
    ADVENTURE_UNDERSTANDING_CORE_STAT_ORDER,
    formatAdventureUnderstandingBonusPercent,
    normalizeAdventureProfile,
    formatAdventureUnderstandingTierLabel,
    getMonsterCodexComprehensionBuffTotals,
} from '../../utils/adventureUnderstanding.js';
import AdventureRegionalBuffPanel from './AdventureRegionalBuffPanel.js';

const CODEX_CHART_BAR_GRADIENTS: readonly string[] = [
    'from-emerald-500/95 to-teal-600/75',
    'from-sky-500/95 to-blue-600/75',
    'from-blue-500/95 to-indigo-600/75',
    'from-amber-500/95 to-orange-600/75',
    'from-fuchsia-500/95 to-purple-700/75',
];

const AdventureProfilePanel: React.FC<{
    profile: AdventureProfile | null | undefined;
    userGold?: number;
    compact?: boolean;
    onOpenMonsterCodex?: () => void;
}> = ({ profile, userGold = 0, compact = false, onOpenMonsterCodex }) => {
    const donutGradId = useId().replace(/:/g, '');
    const p = useMemo(() => normalizeAdventureProfile(profile), [profile]);
    const monsterCodexBuff = useMemo(() => getMonsterCodexComprehensionBuffTotals(p), [p]);
    const codexBreakdown = useMemo(() => getAdventureCodexCompletionBreakdown(profile), [profile]);

    const stageRows = useMemo(() => {
        return ADVENTURE_STAGES.map((s) => {
            const xp = p.understandingXpByStage?.[s.id] ?? 0;
            const tier = getAdventureUnderstandingTierFromXp(xp);
            const nextThreshold =
                tier < ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS.length - 1
                    ? ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[tier + 1]
                    : null;
            const lastThreshold = ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS.length - 1];
            const xpGoal = nextThreshold ?? lastThreshold;
            const prog =
                nextThreshold != null && nextThreshold > ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[tier]
                    ? Math.min(
                          100,
                          Math.round(
                              ((xp - ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[tier]) /
                                  (nextThreshold - ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[tier])) *
                                  100,
                          ),
                      )
                    : 100;
            return { ...s, xp, xpGoal, tier, prog, tierLabel: formatAdventureUnderstandingTierLabel(tier) };
        });
    }, [p.understandingXpByStage]);

    const donutR = compact ? 28 : 32;
    const donutC = 2 * Math.PI * donutR;
    const donutDash = (Math.min(100, Math.max(0, codexBreakdown.overallPercent)) / 100) * donutC;

    const labelCls = compact
        ? 'text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:text-xs'
        : 'text-xs font-bold uppercase tracking-wider text-zinc-500 sm:text-sm';
    return (
        <section
            className={`relative flex h-full w-full min-w-0 flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-violet-950/25 to-zinc-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                compact ? 'p-3 sm:p-3.5' : 'p-3.5 sm:p-4 lg:p-5'
            }`}
            aria-label="모험 일지"
        >
            {onOpenMonsterCodex && (
                <button
                    type="button"
                    onClick={onOpenMonsterCodex}
                    className={`absolute z-10 rounded-lg border border-violet-400/40 bg-violet-950/60 font-bold text-violet-100 shadow-sm underline-offset-2 transition-colors hover:border-amber-400/45 hover:bg-violet-900/55 hover:underline active:scale-[0.99] ${
                        compact
                            ? 'right-2.5 top-2.5 px-2 py-1 text-xs sm:right-3 sm:top-3 sm:text-sm'
                            : 'right-3 top-3 px-2.5 py-1.5 text-sm sm:right-4 sm:top-4 sm:text-base'
                    }`}
                    aria-label="몬스터 도감"
                >
                    {compact ? '몬스터' : '몬스터 도감'}
                </button>
            )}
            <div
                className={`flex shrink-0 flex-wrap items-center border-b border-white/10 pb-2.5 sm:pb-3 ${onOpenMonsterCodex ? 'pr-[5.5rem] sm:pr-[6.5rem]' : ''}`}
            >
                <h2
                    className={`min-w-0 font-black tracking-tight text-transparent bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-amber-200 bg-clip-text ${
                        compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl lg:text-2xl'
                    }`}
                >
                    모험 일지
                </h2>
            </div>

            <div className={`mt-3 flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pr-0.5 ${compact ? '' : 'sm:gap-3.5'}`}>
                <div
                    className={`w-full min-w-0 rounded-xl border border-white/8 bg-black/25 ${
                        compact ? 'px-3 py-2.5' : 'px-3.5 py-3 sm:px-4 sm:py-3.5'
                    }`}
                >
                        <p className={labelCls}>몬스터 이해도 효과</p>
                        <p
                            className={`mt-1.5 font-bold tabular-nums text-amber-100/95 ${
                                compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                            }`}
                        >
                            모험 골드 +{formatAdventureUnderstandingBonusPercent(monsterCodexBuff.goldBonusPercent)}%
                        </p>
                        <div
                            className={`mt-2 flex w-full min-w-0 flex-row flex-wrap items-center justify-between gap-x-2 gap-y-2 font-semibold tabular-nums text-zinc-100 sm:flex-nowrap sm:gap-x-3 ${
                                compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
                            }`}
                        >
                            <span className="flex min-w-0 flex-1 basis-[45%] items-center justify-between gap-1.5 sm:basis-0 sm:justify-center sm:gap-2">
                                <span className="shrink-0 truncate text-zinc-400">장비 획득</span>
                                <span className="shrink-0 text-cyan-200/95">
                                    +{formatAdventureUnderstandingBonusPercent(monsterCodexBuff.equipmentDropPercent)}%
                                </span>
                            </span>
                            <span className="flex min-w-0 flex-1 basis-[45%] items-center justify-between gap-1.5 sm:basis-0 sm:justify-center sm:gap-2">
                                <span className="shrink-0 truncate text-zinc-400">고급 장비</span>
                                <span className="shrink-0 text-sky-200/95">
                                    +
                                    {formatAdventureUnderstandingBonusPercent(
                                        monsterCodexBuff.highGradeEquipmentPercent,
                                    )}
                                    %
                                </span>
                            </span>
                            <span className="flex min-w-0 flex-1 basis-[45%] items-center justify-between gap-1.5 sm:basis-0 sm:justify-center sm:gap-2">
                                <span className="shrink-0 truncate text-zinc-400">재료 획득</span>
                                <span className="shrink-0 text-emerald-200/95">
                                    +{formatAdventureUnderstandingBonusPercent(monsterCodexBuff.materialDropPercent)}%
                                </span>
                            </span>
                            <span className="flex min-w-0 flex-1 basis-[45%] items-center justify-between gap-1.5 sm:basis-0 sm:justify-center sm:gap-2">
                                <span className="shrink-0 truncate text-zinc-400">고급 재료</span>
                                <span className="shrink-0 text-teal-200/95">
                                    +
                                    {formatAdventureUnderstandingBonusPercent(
                                        monsterCodexBuff.highGradeMaterialPercent,
                                    )}
                                    %
                                </span>
                            </span>
                        </div>
                        <ul
                            className={`mt-3 grid grid-cols-1 gap-x-5 gap-y-1 border-t border-white/8 pt-3 sm:grid-cols-2 ${
                                compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
                            }`}
                        >
                            {ADVENTURE_UNDERSTANDING_CORE_STAT_ORDER.map((stat) => (
                                <li key={stat} className="flex min-w-0 items-baseline justify-between gap-2">
                                    <span className="min-w-0 truncate text-zinc-300">
                                        {CORE_STATS_DATA[stat]?.name ?? stat}
                                    </span>
                                    <span className="shrink-0 whitespace-nowrap font-mono font-bold tabular-nums">
                                        <span className="text-amber-200/95">
                                            +{monsterCodexBuff.coreByStat[stat]?.flat ?? 0}
                                        </span>
                                        <span className="mx-1 text-zinc-600" aria-hidden>
                                            ·
                                        </span>
                                        <span className="text-fuchsia-200/95">
                                            +{formatAdventureUnderstandingBonusPercent(
                                                monsterCodexBuff.coreByStat[stat]?.percent ?? 0,
                                            )}
                                            %
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                </div>

                <div
                    className={`w-full min-w-0 rounded-xl border border-violet-500/22 bg-violet-950/18 ${
                        compact ? 'px-3 py-2.5' : 'px-3.5 py-3 sm:px-4 sm:py-3.5'
                    }`}
                >
                    <p className={`${labelCls} text-violet-200/90`}>몬스터 도감 완성도</p>
                    <div className="mt-2 flex flex-wrap items-stretch gap-3 sm:gap-4">
                        <div
                            className={`relative shrink-0 ${compact ? 'h-[5.25rem] w-[5.25rem]' : 'h-24 w-24 sm:h-[6.5rem] sm:w-[6.5rem]'}`}
                        >
                            <svg
                                viewBox={`0 0 ${(donutR + 14) * 2} ${(donutR + 14) * 2}`}
                                className="h-full w-full -rotate-90 text-zinc-800"
                                aria-hidden
                            >
                                <circle
                                    cx={donutR + 14}
                                    cy={donutR + 14}
                                    r={donutR}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={compact ? 7 : 8}
                                    className="text-zinc-800/95"
                                />
                                <circle
                                    cx={donutR + 14}
                                    cy={donutR + 14}
                                    r={donutR}
                                    fill="none"
                                    stroke={`url(#${donutGradId})`}
                                    strokeWidth={compact ? 7 : 8}
                                    strokeLinecap="round"
                                    strokeDasharray={`${donutDash} ${donutC}`}
                                />
                                <defs>
                                    <linearGradient id={donutGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="rgb(167, 139, 250)" />
                                        <stop offset="55%" stopColor="rgb(244, 114, 182)" />
                                        <stop offset="100%" stopColor="rgb(251, 191, 36)" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span
                                    className={`font-black tabular-nums text-white drop-shadow ${
                                        compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'
                                    }`}
                                >
                                    {codexBreakdown.overallPercent >= 10
                                        ? Math.round(codexBreakdown.overallPercent)
                                        : Math.round(codexBreakdown.overallPercent * 10) / 10}
                                    %
                                </span>
                                <span
                                    className={`font-semibold tabular-nums text-zinc-400 ${
                                        compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-xs'
                                    }`}
                                >
                                    {codexBreakdown.totalSum}/{codexBreakdown.totalMax} Lv
                                </span>
                            </div>
                        </div>
                        <div className="min-h-[4rem] min-w-0 flex-1 sm:min-h-[5rem]">
                            <p className={`mb-1 font-semibold text-zinc-500 ${compact ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'}`}>
                                챕터별
                            </p>
                            <div className="flex h-[calc(100%-1.25rem)] min-h-[3.25rem] items-end justify-between gap-1 sm:min-h-16 sm:gap-1.5">
                                {codexBreakdown.stages.map((st, i) => {
                                    const grad = CODEX_CHART_BAR_GRADIENTS[i] ?? CODEX_CHART_BAR_GRADIENTS[0];
                                    return (
                                        <div key={st.stageId} className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-0.5">
                                            <div className="relative flex h-full w-full min-h-0 items-end justify-center rounded-md border border-white/8 bg-black/35 px-px pt-0.5">
                                                <div
                                                    className={`w-[72%] max-w-[2rem] rounded-t-sm bg-gradient-to-t ${grad} transition-all duration-500 sm:max-w-[2.25rem]`}
                                                    style={{ height: `${Math.min(100, Math.max(0, st.percent))}%` }}
                                                    title={`${st.title} ${Math.round(st.percent)}%`}
                                                />
                                            </div>
                                            <span
                                                className={`w-full truncate text-center font-bold tabular-nums text-zinc-500 ${
                                                    compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-xs'
                                                }`}
                                            >
                                                {String(i + 1).padStart(2, '0')}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <AdventureRegionalBuffPanel profile={profile} stageRows={stageRows} userGold={userGold} compact={compact} />
            </div>
        </section>
    );
};

export default AdventureProfilePanel;
