import React, { useMemo, useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import { CoreStat, SpecialStat, MythicStat } from '../types.js';
import { CORE_STATS_DATA, SPECIAL_STATS_DATA, MYTHIC_STATS_DATA } from '../constants';
import {
    isMythicGradeSpecialOptionType,
    isTranscendentGradeSpecialOptionType,
} from '../shared/utils/specialOptionGearEffects.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';

interface EquipmentEffectsModalProps {
    onClose: () => void;
    isTopmost?: boolean;
    mainOptionBonuses: Record<string, { flat: number; percent: number }>;
    combatSubOptionBonuses: Record<string, { flat: number; percent: number }>;
    specialStatBonuses: Record<string, { flat: number; percent: number }>;
    aggregatedMythicStats: Record<MythicStat, { count: number; totalValue: number }>;
}

const TAB_IDS = ['summary', 'main', 'combat', 'special', 'mythic'] as const;
type TabId = (typeof TAB_IDS)[number];

const TAB_LABEL: Record<TabId, string> = {
    summary: '한눈에',
    main: '주옵션',
    combat: '전투 부옵션',
    special: '특수',
    mythic: '스페셜',
};

function formatFlatPercent(b: { flat: number; percent: number } | undefined): { flatStr: string | null; pctStr: string | null } {
    if (!b) return { flatStr: null, pctStr: null };
    const flatStr = b.flat !== 0 ? `${b.flat > 0 ? '+' : ''}${b.flat.toFixed(0)}` : null;
    const pctStr = b.percent !== 0 ? `${b.percent > 0 ? '+' : ''}${b.percent.toFixed(1).replace(/\.0$/, '')}%` : null;
    return { flatStr, pctStr };
}

function visualWeight(b: { flat: number; percent: number } | undefined): number {
    if (!b) return 0;
    return Math.abs(b.flat) + Math.abs(b.percent) * 12;
}

const BonusPills: React.FC<{ flatStr: string | null; pctStr: string | null; muted?: boolean }> = ({ flatStr, pctStr, muted }) => {
    if (!flatStr && !pctStr) {
        return <span className={`text-[11px] font-mono ${muted ? 'text-zinc-600' : 'text-zinc-500'}`}>—</span>;
    }
    return (
        <div className="flex flex-wrap items-center justify-end gap-1">
            {flatStr ? (
                <span
                    className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums sm:text-[11px] ${
                        muted
                            ? 'border-sky-500/15 bg-sky-950/25 text-sky-600/80'
                            : 'border-sky-400/35 bg-sky-950/50 text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    }`}
                >
                    {flatStr}
                </span>
            ) : null}
            {pctStr ? (
                <span
                    className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums sm:text-[11px] ${
                        muted
                            ? 'border-amber-500/15 bg-amber-950/25 text-amber-700/75'
                            : 'border-amber-400/35 bg-amber-950/45 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    }`}
                >
                    {pctStr}
                </span>
            ) : null}
        </div>
    );
};

const MeterBar: React.FC<{ ratio: number; variant: 'amber' | 'violet' | 'emerald' }> = ({ ratio, variant }) => {
    const w = Math.max(0, Math.min(100, ratio * 100));
    const grad =
        variant === 'amber'
            ? 'from-amber-400 via-yellow-300 to-amber-500'
            : variant === 'violet'
              ? 'from-violet-400 via-fuchsia-400 to-indigo-500'
              : 'from-emerald-400 via-teal-400 to-cyan-500';
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full border border-white/[0.08] bg-black/50 ring-1 ring-inset ring-white/[0.04]">
            <div
                className={`h-full rounded-full bg-gradient-to-r ${grad} shadow-[0_0_12px_rgba(251,191,36,0.25)] transition-[width] duration-300`}
                style={{ width: `${w}%` }}
            />
        </div>
    );
};

const formatMythicStat = (stat: MythicStat, _data: { count: number; totalValue: number }): React.ReactNode => {
    const row = MYTHIC_STATS_DATA[stat];
    if (!row) return <span className="leading-snug">알 수 없는 스페셜 옵션</span>;
    return <span className="leading-snug">{row.description}</span>;
};

const EquipmentEffectsModal: React.FC<EquipmentEffectsModalProps> = ({
    onClose,
    isTopmost,
    mainOptionBonuses,
    combatSubOptionBonuses,
    specialStatBonuses,
    aggregatedMythicStats,
}) => {
    const { isNativeMobile, isNarrowViewport } = useNativeMobileShell();
    const isHandheld = useIsHandheldDevice(1025);
    const compactChrome = isNativeMobile || isNarrowViewport || isHandheld;
    const [tab, setTab] = useState<TabId>('summary');

    const mainMaxW = useMemo(
        () => Math.max(1e-6, ...Object.values(CoreStat).map((s) => visualWeight(mainOptionBonuses[s]))),
        [mainOptionBonuses],
    );
    const combatMaxW = useMemo(
        () => Math.max(1e-6, ...Object.values(CoreStat).map((s) => visualWeight(combatSubOptionBonuses[s]))),
        [combatSubOptionBonuses],
    );
    const totalCombinedAll = useMemo(
        () =>
            Object.values(CoreStat).reduce(
                (acc, s) => acc + visualWeight(mainOptionBonuses[s]) + visualWeight(combatSubOptionBonuses[s]),
                0,
            ),
        [mainOptionBonuses, combatSubOptionBonuses],
    );

    const specialActive = useMemo(
        () =>
            Object.entries(specialStatBonuses).filter(([_, b]) => b.flat !== 0 || b.percent !== 0) as [
                string,
                { flat: number; percent: number },
            ][],
        [specialStatBonuses],
    );

    const mythicActive = useMemo(
        () => (Object.entries(aggregatedMythicStats) as [MythicStat, { count: number; totalValue: number }][]).filter(([, d]) => d.count > 0),
        [aggregatedMythicStats],
    );

    const mythicGradeSpecialActive = useMemo(
        () => mythicActive.filter(([stat]) => isMythicGradeSpecialOptionType(stat as string)),
        [mythicActive],
    );
    const transcendentGradeSpecialActive = useMemo(
        () => mythicActive.filter(([stat]) => isTranscendentGradeSpecialOptionType(stat as string)),
        [mythicActive],
    );

    const tabBadge = (id: TabId): number | null => {
        if (id === 'main') return Object.values(CoreStat).filter((s) => visualWeight(mainOptionBonuses[s]) > 0).length || null;
        if (id === 'combat') return Object.values(CoreStat).filter((s) => visualWeight(combatSubOptionBonuses[s]) > 0).length || null;
        if (id === 'special') return specialActive.length || null;
        if (id === 'mythic') return mythicActive.length || null;
        return null;
    };

    const shell =
        'rounded-2xl border border-amber-500/22 bg-gradient-to-br from-[#1a1628]/95 via-[#12101c]/98 to-[#0a0810]/98 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/[0.08]';

    const sectionShell = `${shell} p-3 sm:p-3.5`;

    return (
        <DraggableWindow
            title="장비 장착 효과"
            onClose={onClose}
            windowId="equipment-effects"
            initialWidth={compactChrome ? 420 : 720}
            initialHeight={compactChrome ? 560 : 620}
            isTopmost={isTopmost}
            variant="store"
            mobileViewportFit={compactChrome}
            mobileViewportMaxHeightVh={92}
            containerExtraClassName="sudamr-panel-edge-host !rounded-2xl !shadow-[0_26px_85px_rgba(0,0,0,0.72)] ring-1 ring-amber-400/22"
            bodyPaddingClassName={compactChrome ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4'}
        >
            <div className="flex min-h-0 min-w-0 flex-col gap-2.5 text-on-panel">
                <p className="px-0.5 text-[11px] leading-snug text-amber-100/70 sm:text-xs">
                    장착 중인 장비에서 합산된 옵션입니다. 탭으로 구역을 나눠 볼 수 있습니다.
                </p>

                <div className="-mx-0.5 flex gap-1 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
                    {TAB_IDS.map((id) => {
                        const n = tabBadge(id);
                        const on = tab === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setTab(id)}
                                className={`relative shrink-0 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition sm:px-3 sm:text-xs ${
                                    on
                                        ? 'border-amber-400/50 bg-gradient-to-b from-amber-500/25 to-amber-950/40 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                                        : 'border-white/[0.08] bg-black/30 text-zinc-400 hover:border-amber-500/25 hover:text-amber-100/90'
                                }`}
                            >
                                {TAB_LABEL[id]}
                                {n != null && n > 0 ? (
                                    <span
                                        className={`ml-1 inline-flex min-w-[1.1rem] justify-center rounded-md px-1 py-px font-mono text-[9px] tabular-nums ${
                                            on ? 'bg-amber-400/25 text-amber-100' : 'bg-zinc-800 text-zinc-400'
                                        }`}
                                    >
                                        {n}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>

                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-0.5 [scrollbar-gutter:stable] [scrollbar-width:thin]">
                    {tab === 'summary' && (
                        <div className={sectionShell}>
                            <h3 className="mb-2 border-b border-amber-500/20 pb-1.5 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200/85 sm:text-xs">
                                핵심 능력치 — 주옵션 vs 전투 부옵션
                            </h3>
                            <div className="space-y-2.5">
                                {Object.values(CoreStat).map((stat) => {
                                    const meta = CORE_STATS_DATA[stat];
                                    const mainB = mainOptionBonuses[stat];
                                    const combatB = combatSubOptionBonuses[stat];
                                    const mainParts = formatFlatPercent(mainB);
                                    const combatParts = formatFlatPercent(combatB);
                                    const active = visualWeight(mainB) + visualWeight(combatB) > 0;
                                    return (
                                        <div
                                            key={stat}
                                            className={`rounded-xl border border-white/[0.06] bg-black/25 p-2 ring-1 ring-inset ring-white/[0.03] sm:p-2.5 ${
                                                !active ? 'opacity-55' : ''
                                            }`}
                                        >
                                            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                                                <span className="text-[12px] font-bold text-zinc-100 sm:text-sm">{meta.name}</span>
                                                <span className="text-[9px] text-zinc-500 sm:text-[10px]">장착 합산</span>
                                            </div>
                                            <div className="mb-1.5 grid grid-cols-2 gap-2 text-[10px] sm:text-[11px]">
                                                <div>
                                                    <div className="mb-0.5 font-semibold uppercase tracking-wide text-amber-200/75">주옵션</div>
                                                    <BonusPills {...mainParts} muted={!active} />
                                                    <div className="mt-1">
                                                        <MeterBar ratio={visualWeight(mainB) / mainMaxW} variant="amber" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="mb-0.5 font-semibold uppercase tracking-wide text-violet-200/75">부옵션</div>
                                                    <BonusPills {...combatParts} muted={!active} />
                                                    <div className="mt-1">
                                                        <MeterBar ratio={visualWeight(combatB) / combatMaxW} variant="violet" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-200/70">
                                                    전체 장착 효과 중 비중
                                                </div>
                                                <MeterBar
                                                    ratio={
                                                        totalCombinedAll <= 1e-6
                                                            ? 0
                                                            : (visualWeight(mainB) + visualWeight(combatB)) / totalCombinedAll
                                                    }
                                                    variant="emerald"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {tab === 'main' && (
                        <div className={sectionShell}>
                            <h3 className="mb-2 border-b border-amber-500/20 pb-1.5 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200/85 sm:text-xs">
                                주옵션 합계
                            </h3>
                            <div className="space-y-2">
                                {Object.values(CoreStat).map((stat) => {
                                    const meta = CORE_STATS_DATA[stat];
                                    const bonus = mainOptionBonuses[stat];
                                    const parts = formatFlatPercent(bonus);
                                    return (
                                        <details
                                            key={stat}
                                            className="group rounded-xl border border-amber-500/18 bg-gradient-to-r from-amber-950/20 to-transparent open:border-amber-400/35 open:bg-amber-950/25"
                                        >
                                            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-2 marker:content-none sm:px-2.5 [&::-webkit-details-marker]:hidden">
                                                <span className="min-w-0 text-left text-[12px] font-bold text-zinc-100 sm:text-sm">{meta.name}</span>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    <BonusPills {...parts} />
                                                    <span className="text-zinc-500 transition group-open:rotate-90">›</span>
                                                </div>
                                            </summary>
                                            <div className="border-t border-amber-500/15 px-2 pb-2 pt-1 text-[11px] leading-relaxed text-zinc-400 sm:px-2.5 sm:text-xs">
                                                {meta.description}
                                            </div>
                                        </details>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {tab === 'combat' && (
                        <div className={sectionShell}>
                            <h3 className="mb-2 border-b border-violet-500/20 pb-1.5 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200/85 sm:text-xs">
                                전투 부옵션 합계
                            </h3>
                            <div className="space-y-2">
                                {Object.values(CoreStat).map((stat) => {
                                    const meta = CORE_STATS_DATA[stat];
                                    const bonus = combatSubOptionBonuses[stat];
                                    const parts = formatFlatPercent(bonus);
                                    return (
                                        <details
                                            key={stat}
                                            className="group rounded-xl border border-violet-500/18 bg-gradient-to-r from-violet-950/20 to-transparent open:border-violet-400/35 open:bg-violet-950/25"
                                        >
                                            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-2 marker:content-none sm:px-2.5 [&::-webkit-details-marker]:hidden">
                                                <span className="min-w-0 text-left text-[12px] font-bold text-zinc-100 sm:text-sm">{meta.name}</span>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    <BonusPills {...parts} />
                                                    <span className="text-zinc-500 transition group-open:rotate-90">›</span>
                                                </div>
                                            </summary>
                                            <div className="border-t border-violet-500/15 px-2 pb-2 pt-1 text-[11px] leading-relaxed text-zinc-400 sm:px-2.5 sm:text-xs">
                                                {meta.description}
                                            </div>
                                        </details>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {tab === 'special' && (
                        <div className={sectionShell}>
                            <h3 className="mb-2 border-b border-emerald-500/20 pb-1.5 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200/85 sm:text-xs">
                                특수 능력치
                            </h3>
                            {specialActive.length === 0 ? (
                                <p className="py-6 text-center text-sm text-zinc-500">적용 중인 특수 옵션이 없습니다.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {specialActive.map(([stat, bonus]) => {
                                        const statEnum = stat as SpecialStat;
                                        const statData = SPECIAL_STATS_DATA[statEnum];
                                        if (!statData) return null;
                                        const parts = formatFlatPercent(bonus);
                                        return (
                                            <li
                                                key={stat}
                                                className="rounded-xl border border-emerald-500/22 bg-gradient-to-br from-emerald-950/25 via-zinc-950/40 to-zinc-950/80 p-2.5 shadow-inner sm:p-3"
                                            >
                                                <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[12px] font-bold text-emerald-100 sm:text-sm">{statData.name}</p>
                                                        <p className="mt-0.5 text-[11px] leading-snug text-zinc-400 sm:text-xs">{statData.description}</p>
                                                    </div>
                                                    <BonusPills {...parts} />
                                                </div>
                                                <MeterBar ratio={visualWeight(bonus) / Math.max(1e-6, ...specialActive.map(([, b]) => visualWeight(b)))} variant="emerald" />
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    )}

                    {tab === 'mythic' && (
                        <div className={sectionShell}>
                            <h3 className="mb-2 border-b border-rose-500/25 pb-1.5 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-rose-200/85 sm:text-xs">
                                스페셜 옵션
                            </h3>
                            {mythicActive.length === 0 ? (
                                <p className="py-6 text-center text-sm text-zinc-500">적용 중인 스페셜 옵션이 없습니다.</p>
                            ) : (
                                <div className="space-y-4">
                                    {mythicGradeSpecialActive.length > 0 ? (
                                        <div>
                                            <p className="mb-1.5 text-center text-[10px] font-semibold text-rose-200/90">신화 스페셜 옵션</p>
                                            <ul className="space-y-2">
                                                {mythicGradeSpecialActive.map(([stat, data]) => {
                                                    const def = MYTHIC_STATS_DATA[stat];
                                                    return (
                                                        <li
                                                            key={stat}
                                                            className="rounded-xl border border-rose-500/28 bg-gradient-to-br from-rose-950/30 via-zinc-950/50 to-zinc-950/90 p-2.5 ring-1 ring-inset ring-rose-400/10 sm:p-3"
                                                        >
                                                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                                                <p className="text-[12px] font-bold text-rose-100 sm:text-sm">{def.name}</p>
                                                                <span className="rounded-md border border-rose-400/35 bg-black/40 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-200/95">
                                                                    중첩 ×{data.count}
                                                                </span>
                                                            </div>
                                                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-200/60">{def.abbrevLabel}</p>
                                                            <div className="text-[11px] leading-snug text-zinc-200/95 sm:text-xs">{formatMythicStat(stat, data)}</div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    ) : null}
                                    {transcendentGradeSpecialActive.length > 0 ? (
                                        <div>
                                            <p className="mb-1.5 text-center text-[10px] font-semibold text-cyan-200/90">초월 스페셜 옵션</p>
                                            <ul className="space-y-2">
                                                {transcendentGradeSpecialActive.map(([stat, data]) => {
                                                    const def = MYTHIC_STATS_DATA[stat];
                                                    return (
                                                        <li
                                                            key={stat}
                                                            className="rounded-xl border border-cyan-500/28 bg-gradient-to-br from-cyan-950/25 via-zinc-950/50 to-zinc-950/90 p-2.5 ring-1 ring-inset ring-cyan-400/10 sm:p-3"
                                                        >
                                                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                                                <p className="text-[12px] font-bold text-cyan-100 sm:text-sm">{def.name}</p>
                                                                <span className="rounded-md border border-cyan-400/35 bg-black/40 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-200/95">
                                                                    중첩 ×{data.count}
                                                                </span>
                                                            </div>
                                                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-200/60">{def.abbrevLabel}</p>
                                                            <div className="text-[11px] leading-snug text-zinc-200/95 sm:text-xs">{formatMythicStat(stat, data)}</div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default EquipmentEffectsModal;
