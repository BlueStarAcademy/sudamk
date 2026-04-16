import React, { useId, useMemo, useState } from 'react';
import { getAdventureCodexCompletionBreakdown } from '../../utils/adventureCodexCompletion.js';
import type { AdventureProfile } from '../../types/entities.js';
import { CORE_STATS_DATA } from '../../constants.js';
import {
    ADVENTURE_STAGES,
    ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS,
    getAdventureUnderstandingTierFromXp,
    getAdventureUnderstandingTierProgress,
} from '../../constants/adventureConstants.js';
import {
    ADVENTURE_UNDERSTANDING_CORE_STAT_ORDER,
    formatAdventureUnderstandingBonusPercent,
    normalizeAdventureProfile,
    formatAdventureUnderstandingTierLabel,
    getMonsterCodexComprehensionBuffTotals,
} from '../../utils/adventureUnderstanding.js';
import AdventureRegionalBuffPanel from './AdventureRegionalBuffPanel.js';

const AdventureProfilePanel: React.FC<{
    profile: AdventureProfile | null | undefined;
    userGold?: number;
    compact?: boolean;
    /** 네이티브 모바일 모험 일지: 몬스터 / 지역 탐험도 패널 분리·코어 2열 그리드 */
    mobileJournalSplit?: boolean;
    onOpenMonsterCodex?: () => void;
}> = ({ profile, userGold = 0, compact = false, mobileJournalSplit = false, onOpenMonsterCodex }) => {
    const donutGradId = useId().replace(/:/g, '');
    const p = useMemo(() => normalizeAdventureProfile(profile), [profile]);
    const monsterCodexBuff = useMemo(() => getMonsterCodexComprehensionBuffTotals(p), [p]);
    const codexBreakdown = useMemo(() => getAdventureCodexCompletionBreakdown(profile), [profile]);
    const [mobileTab, setMobileTab] = useState<'understanding' | 'codex' | 'regional'>('understanding');

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
            const tierProgress = getAdventureUnderstandingTierProgress(xp);
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
            return {
                ...s,
                xp,
                xpGoal,
                tier,
                prog,
                tierLabel: formatAdventureUnderstandingTierLabel(tier),
                xpInTier: tierProgress.currentInTier,
                xpNeedInTier: tierProgress.neededInTier,
            };
        });
    }, [p.understandingXpByStage]);

    const donutR = compact ? 34 : 42;
    const donutC = 2 * Math.PI * donutR;
    const donutDash = (Math.min(100, Math.max(0, codexBreakdown.overallPercent)) / 100) * donutC;

    const labelCls = compact
        ? 'text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:text-xs'
        : 'text-xs font-bold uppercase tracking-wider text-zinc-500 sm:text-sm';

    const coreStatGridClass = mobileJournalSplit
        ? `grid grid-cols-1 gap-x-3 gap-y-1.5 ${compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'}`
        : `grid grid-cols-1 gap-x-4 gap-y-1 ${compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'}`;

    const codexOpenBtnClass = mobileJournalSplit
        ? 'absolute right-2 top-2 z-10 rounded-lg border border-violet-400/40 bg-violet-950/60 px-2 py-1 text-[11px] font-bold text-violet-100 shadow-sm underline-offset-2 transition-colors hover:border-amber-400/45 hover:bg-violet-900/55 hover:underline active:scale-[0.99]'
        : `absolute z-10 rounded-lg border border-violet-400/40 bg-violet-950/60 font-bold text-violet-100 shadow-sm underline-offset-2 transition-colors hover:border-amber-400/45 hover:bg-violet-900/55 hover:underline active:scale-[0.99] ${
              compact
                  ? 'right-2.5 top-2.5 px-2 py-1 text-xs sm:right-3 sm:top-3 sm:text-sm'
                  : 'right-3 top-3 px-2.5 py-1.5 text-sm sm:right-4 sm:top-4 sm:text-base'
          }`;

    const dropBonusContainerClass = mobileJournalSplit
        ? 'mt-2 grid w-full grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] font-semibold tabular-nums text-zinc-100'
        : `mt-2 flex w-full min-w-0 flex-row flex-wrap items-center justify-between gap-x-2 gap-y-2 font-semibold tabular-nums text-zinc-100 sm:flex-nowrap sm:gap-x-3 ${
              compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
          }`;

    const dropBonusItemClass = mobileJournalSplit
        ? 'flex min-w-0 items-center justify-between gap-1.5'
        : 'flex min-w-0 flex-1 basis-[45%] items-center justify-between gap-1.5 sm:basis-0 sm:justify-center sm:gap-2';

    const understandingBody = (
        <div className="relative">
            <p className={labelCls}>몬스터 이해도</p>
            <div className="mt-2 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <div
                        className={`grid grid-cols-1 gap-1.5 sm:grid-cols-2 ${
                            compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-black/25 px-2.5 py-1.5">
                            <span className="truncate text-zinc-300">모험 골드</span>
                            <span className="shrink-0 font-semibold tabular-nums text-amber-200/95">
                                +{formatAdventureUnderstandingBonusPercent(monsterCodexBuff.goldBonusPercent)}%
                            </span>
                        </div>
                        <div className="rounded-md border border-transparent bg-transparent px-2.5 py-1.5" aria-hidden />
                        <div className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-black/25 px-2.5 py-1.5">
                            <span className="truncate text-zinc-300">장비 획득</span>
                            <span className="shrink-0 font-semibold tabular-nums text-cyan-200/95">
                                +{formatAdventureUnderstandingBonusPercent(monsterCodexBuff.equipmentDropPercent)}%
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-black/25 px-2.5 py-1.5">
                            <span className="truncate text-zinc-300">고급 장비</span>
                            <span className="shrink-0 font-semibold tabular-nums text-sky-200/95">
                                +{formatAdventureUnderstandingBonusPercent(monsterCodexBuff.highGradeEquipmentPercent)}%
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-black/25 px-2.5 py-1.5">
                            <span className="truncate text-zinc-300">재료 획득</span>
                            <span className="shrink-0 font-semibold tabular-nums text-emerald-200/95">
                                +{formatAdventureUnderstandingBonusPercent(monsterCodexBuff.materialDropPercent)}%
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-black/25 px-2.5 py-1.5">
                            <span className="truncate text-zinc-300">고급 재료</span>
                            <span className="shrink-0 font-semibold tabular-nums text-teal-200/95">
                                +{formatAdventureUnderstandingBonusPercent(monsterCodexBuff.highGradeMaterialPercent)}%
                            </span>
                        </div>
                        {ADVENTURE_UNDERSTANDING_CORE_STAT_ORDER.map((stat) => (
                            <div
                                key={stat}
                                className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-black/25 px-2.5 py-1.5"
                            >
                                <span className="truncate text-zinc-300">{CORE_STATS_DATA[stat]?.name ?? stat}</span>
                                <span className="shrink-0 whitespace-nowrap font-mono font-bold tabular-nums">
                                    <span className="text-amber-200/95">+{monsterCodexBuff.coreByStat[stat]?.flat ?? 0}</span>
                                    <span className="mx-1 text-zinc-600" aria-hidden>
                                        ·
                                    </span>
                                    <span className="text-fuchsia-200/95">
                                        +{formatAdventureUnderstandingBonusPercent(monsterCodexBuff.coreByStat[stat]?.percent ?? 0)}%
                                    </span>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                {!mobileJournalSplit ? (
                    <div
                        className={`shrink-0 self-center rounded-lg border border-violet-400/30 bg-violet-950/30 p-2 ${
                            compact ? 'w-[8.25rem]' : 'w-[9.5rem]'
                        }`}
                        title="몬스터 도감 완성도"
                    >
                        <div className="relative">
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
                                    strokeWidth={compact ? 8 : 9}
                                    className="text-zinc-800/95"
                                />
                                <circle
                                    cx={donutR + 14}
                                    cy={donutR + 14}
                                    r={donutR}
                                    fill="none"
                                    stroke={`url(#${donutGradId})`}
                                    strokeWidth={compact ? 8 : 9}
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
                                <span className={`font-black tabular-nums text-white ${compact ? 'text-sm' : 'text-base'}`}>
                                    {codexBreakdown.overallPercent >= 10
                                        ? Math.round(codexBreakdown.overallPercent)
                                        : Math.round(codexBreakdown.overallPercent * 10) / 10}
                                    %
                                </span>
                                <span className={`font-semibold tabular-nums text-zinc-400 ${compact ? 'text-[11px]' : 'text-xs'}`}>
                                    {codexBreakdown.totalSum}/{codexBreakdown.totalMax}
                                </span>
                            </div>
                        </div>
                        <p className={`mt-1 text-center font-semibold text-zinc-400 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
                            도감 완성도
                        </p>
                    </div>
                ) : null}
            </div>
        </div>
    );

    const codexCompletionBody = (
        <div className="w-full min-w-0 rounded-lg border border-violet-400/30 bg-violet-950/20 px-3 py-2.5">
            <p className={labelCls}>도감 완성도</p>
            <div className="mt-2 flex items-center gap-3">
                <div className={`relative shrink-0 ${compact ? 'h-28 w-28' : 'h-32 w-32'}`}>
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
                            strokeWidth={compact ? 8 : 9}
                            className="text-zinc-800/95"
                        />
                        <circle
                            cx={donutR + 14}
                            cy={donutR + 14}
                            r={donutR}
                            fill="none"
                            stroke={`url(#${donutGradId})`}
                            strokeWidth={compact ? 8 : 9}
                            strokeLinecap="round"
                            strokeDasharray={`${donutDash} ${donutC}`}
                        />
                    </svg>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className={`font-black tabular-nums text-white ${compact ? 'text-base' : 'text-lg'}`}>
                            {codexBreakdown.overallPercent >= 10
                                ? Math.round(codexBreakdown.overallPercent)
                                : Math.round(codexBreakdown.overallPercent * 10) / 10}
                            %
                        </span>
                        <span className={`font-semibold tabular-nums text-zinc-400 ${compact ? 'text-xs' : 'text-sm'}`}>
                            {codexBreakdown.totalSum}/{codexBreakdown.totalMax}
                        </span>
                    </div>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                    {codexBreakdown.stages.map((st, i) => (
                        <div key={st.stageId} className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-zinc-400">챕터 {i + 1}</span>
                            <span className="tabular-nums font-bold text-violet-200">{Math.round(st.percent)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <section
            className={`relative flex h-full w-full min-w-0 flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-violet-950/25 to-zinc-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                compact ? 'p-3 sm:p-3.5' : 'p-3.5 sm:p-4 lg:p-5'
            }`}
            aria-label="모험 일지"
        >
            {mobileJournalSplit ? <h2 className="sr-only">모험 일지</h2> : null}

            {!mobileJournalSplit && onOpenMonsterCodex ? (
                <button type="button" onClick={onOpenMonsterCodex} className={codexOpenBtnClass} aria-label="몬스터 도감">
                    {compact ? '몬스터' : '몬스터 도감'}
                </button>
            ) : null}

            {!mobileJournalSplit ? (
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
            ) : null}

            <div
                className={`flex min-h-0 w-full min-w-0 flex-1 flex-col pr-0.5 ${
                    mobileJournalSplit ? 'mt-0 gap-2 overflow-hidden' : `mt-3 gap-3 overflow-y-auto overscroll-contain ${compact ? '' : 'sm:gap-3.5'}`
                }`}
            >
                {mobileJournalSplit ? (
                    <>
                        <div className="grid grid-cols-3 gap-1.5">
                            {[
                                { id: 'understanding', label: '몬스터 이해도' },
                                { id: 'codex', label: '도감 완성도' },
                                { id: 'regional', label: '지역 탐험도' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setMobileTab(tab.id as 'understanding' | 'codex' | 'regional')}
                                    className={`rounded-md border px-1.5 py-1.5 text-[11px] font-bold transition-colors ${
                                        mobileTab === tab.id
                                            ? 'border-amber-400/60 bg-amber-500/15 text-amber-100'
                                            : 'border-white/10 bg-black/25 text-zinc-400'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div className="min-h-0 flex-1">
                            {mobileTab === 'understanding' ? (
                                <div className="h-full w-full min-w-0 rounded-xl border border-amber-400/30 bg-gradient-to-br from-zinc-950/98 via-zinc-950/92 to-black/95 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                    <div className="h-full w-full min-w-0 rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                                        {understandingBody}
                                    </div>
                                </div>
                            ) : mobileTab === 'codex' ? (
                                <div className="h-full w-full min-w-0 rounded-xl border border-violet-400/25 bg-violet-950/15 px-2.5 py-2">
                                    {codexCompletionBody}
                                    {onOpenMonsterCodex ? (
                                        <button
                                            type="button"
                                            onClick={onOpenMonsterCodex}
                                            className="mt-2 w-full rounded-md border border-violet-400/40 bg-violet-950/60 px-2 py-1.5 text-xs font-bold text-violet-100"
                                            aria-label="몬스터 도감"
                                        >
                                            몬스터 도감
                                        </button>
                                    ) : null}
                                </div>
                            ) : (
                                <AdventureRegionalBuffPanel profile={profile} stageRows={stageRows} userGold={userGold} compact />
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div
                            className={`w-full min-w-0 rounded-xl border border-white/8 bg-black/25 ${
                                compact ? 'px-3 py-2.5' : 'px-3.5 py-3 sm:px-4 sm:py-3.5'
                            }`}
                        >
                            {understandingBody}
                        </div>

                        <AdventureRegionalBuffPanel profile={profile} stageRows={stageRows} userGold={userGold} compact={compact} />
                    </>
                )}
            </div>
        </section>
    );
};

export default AdventureProfilePanel;
