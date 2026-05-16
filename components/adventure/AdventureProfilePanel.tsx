import React, { useId, useMemo } from 'react';
import { getAdventureCodexCompletionBreakdown } from '../../utils/adventureCodexCompletion.js';
import type { AdventureProfile } from '../../types/entities.js';
import { CORE_STATS_DATA } from '../../constants.js';
import {
    ADVENTURE_UNDERSTANDING_CORE_STAT_ORDER,
    formatAdventureUnderstandingBonusPercent,
    normalizeAdventureProfile,
    getMonsterCodexComprehensionBuffTotals,
} from '../../utils/adventureUnderstanding.js';
import { getAdventureHuntingScore } from '../../shared/utils/adventureHuntingScore.js';
import { getTopAdventureCodexMonsterByWins } from '../../utils/adventureTopCodexMonster.js';
import { useRanking } from '../../hooks/useRanking.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import AdventureTopHuntedMonsterPanel from './AdventureTopHuntedMonsterPanel.js';
import {
    formatAdventureModeWinLossRecord,
    getAdventureBattleRecordSummary,
} from '../../utils/adventureBattleRecord.js';

const AdventureProfilePanel: React.FC<{
    profile: AdventureProfile | null | undefined;
    userGold?: number;
    compact?: boolean;
    /** 네이티브 모바일 모험 일지: 스크롤 없이 한 화면에 맞춤 */
    mobileOneScreen?: boolean;
    onOpenMonsterCodex?: () => void;
}> = ({ profile, compact = false, mobileOneScreen = false, onOpenMonsterCodex }) => {
    const donutGradId = useId().replace(/:/g, '');
    const { currentUserWithStatus } = useAppContext();
    const userId = currentUserWithStatus?.id;
    const p = useMemo(() => normalizeAdventureProfile(profile), [profile]);
    const monsterCodexBuff = useMemo(() => getMonsterCodexComprehensionBuffTotals(p), [p]);
    const codexBreakdown = useMemo(() => getAdventureCodexCompletionBreakdown(profile), [profile]);
    const huntingScore = useMemo(() => getAdventureHuntingScore(profile).score, [profile]);
    const topCodexMonster = useMemo(() => getTopAdventureCodexMonsterByWins(profile), [profile]);
    const battleRecord = useMemo(() => getAdventureBattleRecordSummary(profile), [profile]);
    const { rankings: adventureRankings, loading: adventureRankLoading } = useRanking('adventure');
    const adventureRank = useMemo(() => {
        if (!userId) return null;
        const entry = adventureRankings.find((r) => r.id === userId);
        return entry?.rank ?? null;
    }, [adventureRankings, userId]);

    /** 로비 사이드·모바일 일지 — 여백만 조밀하게, 글자는 최소 text-xs 이상 유지 */
    const tightLayout = mobileOneScreen || !compact;
    const donutR = mobileOneScreen ? 30 : compact ? 32 : tightLayout ? 34 : 42;
    const donutC = 2 * Math.PI * donutR;
    const donutDash = (Math.min(100, Math.max(0, codexBreakdown.overallPercent)) / 100) * donutC;

    const labelCls =
        'text-xs font-bold uppercase tracking-wider text-zinc-500 sm:text-sm';

    const statLabelCls = 'text-[11px] font-semibold leading-snug text-zinc-400 sm:text-xs';
    const statValueCls = 'text-sm font-black tabular-nums leading-tight sm:text-base';
    const modeLabelCls = 'text-[11px] font-semibold leading-snug text-zinc-400 sm:text-xs';
    const modeValueCls = 'text-xs font-bold tabular-nums leading-snug text-cyan-100/95 sm:text-sm';

    const panelPad =
        mobileOneScreen ? 'px-2.5 py-2' : compact || tightLayout ? 'px-3 py-2.5' : 'px-3.5 py-3 sm:px-4 sm:py-3.5';
    const sectionPad = mobileOneScreen
        ? 'p-2.5'
        : compact
          ? 'p-3 sm:p-3.5'
          : tightLayout
            ? 'p-2.5 sm:p-3'
            : 'p-3.5 sm:p-4 lg:p-5';
    const blockGap = mobileOneScreen ? 'gap-2' : compact || tightLayout ? 'gap-2.5' : 'gap-3 sm:gap-3.5';

    const codexOpenBtnClass = `w-full rounded-lg border border-violet-400/40 bg-violet-950/60 font-bold text-violet-100 shadow-sm transition-colors hover:border-amber-400/45 hover:bg-violet-900/55 active:scale-[0.99] ${
        mobileOneScreen
            ? 'px-2 py-1 text-xs'
            : compact || tightLayout
              ? 'px-2 py-1.5 text-xs sm:text-sm'
              : 'px-2.5 py-1.5 text-xs sm:text-sm'
    }`;

    const understandingStatRowCls = `flex items-center justify-between gap-2 rounded-md border border-white/8 bg-black/25 px-2 py-1 text-[11px] sm:text-xs`;

    const adventureBattleRecordPanel = (
        <div
            className={`w-full min-w-0 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/35 via-zinc-950/80 to-zinc-950/95 ${panelPad}`}
        >
            <p className={`${labelCls} text-center`}>모험 전적</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
                {battleRecord.byMode.map((row) => (
                    <div
                        key={row.mode}
                        className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-center"
                        title={`${row.label} ${formatAdventureModeWinLossRecord(row.wins, row.losses, row.winRatePercent)}`}
                    >
                        <span className={modeLabelCls}>{row.label}</span>
                        <span className={`mt-0.5 ${modeValueCls}`}>
                            {formatAdventureModeWinLossRecord(row.wins, row.losses, row.winRatePercent)}
                        </span>
                    </div>
                ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="flex flex-col items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-2 text-center">
                    <p className={statLabelCls}>잡은 몬스터</p>
                    <p className={`mt-0.5 text-emerald-200 ${statValueCls}`}>{battleRecord.caught.toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg border border-rose-500/30 bg-rose-950/25 px-2.5 py-2 text-center">
                    <p className={statLabelCls}>놓친 몬스터</p>
                    <p className={`mt-0.5 text-rose-200 ${statValueCls}`}>{battleRecord.missed.toLocaleString()}</p>
                </div>
            </div>
        </div>
    );

    const adventureHuntingStatsPanel = (
        <div
            className={`w-full min-w-0 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/35 via-zinc-950/80 to-zinc-950/95 ${panelPad}`}
        >
            <p className={`${labelCls} text-center`}>모험 랭킹</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-center">
                    <p className={statLabelCls}>모험 점수</p>
                    <p className={`mt-0.5 text-emerald-200 ${statValueCls}`}>
                        {huntingScore.toLocaleString()}
                    </p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-center">
                    <p className={statLabelCls}>내 순위</p>
                    <p className={`mt-0.5 text-amber-200 ${statValueCls}`}>
                        {adventureRankLoading ? '…' : adventureRank != null ? `${adventureRank}위` : 'N/A'}
                    </p>
                </div>
            </div>
        </div>
    );

    const codexDonutPanel = (
        <div
            className={`shrink-0 self-center rounded-lg border border-violet-400/30 bg-violet-950/30 p-1.5 ${
                mobileOneScreen ? 'w-[7rem]' : compact || tightLayout ? 'w-[7.75rem]' : 'w-[9.5rem]'
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
                    <span className={`font-black tabular-nums text-white ${mobileOneScreen || compact ? 'text-sm' : 'text-base'}`}>
                        {codexBreakdown.overallPercent >= 10
                            ? Math.round(codexBreakdown.overallPercent)
                            : Math.round(codexBreakdown.overallPercent * 10) / 10}
                        %
                    </span>
                    <span className={`font-semibold tabular-nums text-zinc-400 ${mobileOneScreen || compact ? 'text-xs' : 'text-sm'}`}>
                        {codexBreakdown.totalSum}/{codexBreakdown.totalMax}
                    </span>
                </div>
            </div>
            <p className={`mt-1 text-center font-semibold text-zinc-400 ${mobileOneScreen || compact ? 'text-[11px]' : 'text-xs'}`}>
                도감 완성도
            </p>
        </div>
    );

    const topHuntedMonsterPanel = (
        <AdventureTopHuntedMonsterPanel monster={topCodexMonster} compact={compact && !mobileOneScreen} />
    );

    const understandingBody = (
        <div className="relative min-w-0">
            <p className={labelCls}>몬스터 이해도</p>
            <div className={`mt-2 flex items-start ${mobileOneScreen ? 'gap-2' : 'gap-3'}`}>
                <div className="min-w-0 flex-1">
                    <div
                        className={`grid gap-2 ${
                            mobileOneScreen || compact || tightLayout
                                ? 'grid-cols-2'
                                : 'grid-cols-1 sm:grid-cols-2'
                        }`}
                    >
                        <div className={understandingStatRowCls}>
                            <span className="truncate text-zinc-300">모험 골드</span>
                            <span className="shrink-0 font-semibold tabular-nums text-amber-200/95">
                                +{formatAdventureUnderstandingBonusPercent(monsterCodexBuff.goldBonusPercent)}%
                            </span>
                        </div>
                        <div className="rounded-md border border-transparent bg-transparent px-2 py-1" aria-hidden />
                        <div className={understandingStatRowCls}>
                            <span className="truncate text-zinc-300">장비 획득</span>
                            <span className="shrink-0 font-semibold tabular-nums text-cyan-200/95">
                                +{formatAdventureUnderstandingBonusPercent(monsterCodexBuff.equipmentDropPercent)}%
                            </span>
                        </div>
                        <div className={understandingStatRowCls}>
                            <span className="truncate text-zinc-300">고급 장비</span>
                            <span className="shrink-0 font-semibold tabular-nums text-sky-200/95">
                                +{formatAdventureUnderstandingBonusPercent(monsterCodexBuff.highGradeEquipmentPercent)}%
                            </span>
                        </div>
                        <div className={understandingStatRowCls}>
                            <span className="truncate text-zinc-300">재료 획득</span>
                            <span className="shrink-0 font-semibold tabular-nums text-emerald-200/95">
                                +{formatAdventureUnderstandingBonusPercent(monsterCodexBuff.materialDropPercent)}%
                            </span>
                        </div>
                        <div className={understandingStatRowCls}>
                            <span className="truncate text-zinc-300">고급 재료</span>
                            <span className="shrink-0 font-semibold tabular-nums text-teal-200/95">
                                +{formatAdventureUnderstandingBonusPercent(monsterCodexBuff.highGradeMaterialPercent)}%
                            </span>
                        </div>
                        {ADVENTURE_UNDERSTANDING_CORE_STAT_ORDER.map((stat) => (
                            <div
                                key={stat}
                                className={understandingStatRowCls}
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
                <div className={`flex shrink-0 flex-col items-stretch self-center ${mobileOneScreen ? 'gap-1' : 'gap-1.5'}`}>
                    {onOpenMonsterCodex ? (
                        <button type="button" onClick={onOpenMonsterCodex} className={codexOpenBtnClass} aria-label="몬스터 도감">
                            몬스터 도감
                        </button>
                    ) : null}
                    {codexDonutPanel}
                </div>
            </div>
        </div>
    );

    const understandingWithTopMonster = (
        <div
            className={`flex min-w-0 flex-col ${
                mobileOneScreen ? 'gap-1.5' : compact || tightLayout ? 'gap-2' : 'gap-2.5 sm:gap-3'
            }`}
        >
            {understandingBody}
            {topHuntedMonsterPanel}
        </div>
    );

    return (
        <section
            className={`relative flex h-full w-full min-w-0 flex-col border border-white/10 bg-gradient-to-br from-zinc-900/90 via-violet-950/25 to-zinc-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${mobileOneScreen ? 'rounded-xl' : 'rounded-2xl'} ${sectionPad}`}
            aria-label="모험 일지"
        >
            {mobileOneScreen ? (
                <h2 className="sr-only">모험 일지</h2>
            ) : (
                <div className="flex shrink-0 flex-wrap items-center border-b border-white/10 pb-2 sm:pb-2.5">
                    <h2
                        className={`min-w-0 font-black tracking-tight text-transparent bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-amber-200 bg-clip-text ${
                            compact || tightLayout ? 'text-base sm:text-lg' : 'text-lg sm:text-xl lg:text-2xl'
                        }`}
                    >
                        모험 일지
                    </h2>
                </div>
            )}

            <div
                className={`flex min-h-0 w-full min-w-0 flex-1 flex-col pr-0.5 ${
                    mobileOneScreen ? 'mt-0 gap-2 overflow-y-auto overscroll-contain' : `mt-2 ${blockGap} overflow-hidden`
                }`}
            >
                {adventureHuntingStatsPanel}
                {adventureBattleRecordPanel}

                <div
                    className={`min-h-0 w-full min-w-0 flex-1 rounded-xl border border-white/8 bg-black/25 ${
                        mobileOneScreen
                            ? 'px-2.5 py-2'
                            : compact || tightLayout
                              ? 'px-3 py-2.5'
                              : 'px-3.5 py-3 sm:px-4 sm:py-3.5'
                    }`}
                >
                    {understandingWithTopMonster}
                </div>
            </div>
        </section>
    );
};

export default AdventureProfilePanel;
