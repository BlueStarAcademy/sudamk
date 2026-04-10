import React, { useMemo } from 'react';
import type { AdventureProfile } from '../../types/entities.js';
import {
    ADVENTURE_MONSTER_MODES,
    ADVENTURE_MONSTER_MODE_LABELS,
    ADVENTURE_STAGES,
    ADVENTURE_UNDERSTANDING_STAT_EFFECT_CAP,
    ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS,
    getAdventureUnderstandingTierFromXp,
} from '../../constants/adventureConstants.js';
import {
    getAdventureUnderstandingStatEffectBonusPercent,
    normalizeAdventureProfile,
    sumAdventureUnderstandingGoldBonusPercent,
    formatAdventureUnderstandingTierLabel,
} from '../../utils/adventureUnderstanding.js';

const AdventureProfilePanel: React.FC<{
    profile: AdventureProfile | null | undefined;
    compact?: boolean;
}> = ({ profile, compact = false }) => {
    const p = useMemo(() => normalizeAdventureProfile(profile), [profile]);
    const goldBonus = sumAdventureUnderstandingGoldBonusPercent(p);
    const statFx = getAdventureUnderstandingStatEffectBonusPercent(p);

    const modeRows = useMemo(() => {
        return ADVENTURE_MONSTER_MODES.map((mode) => ({
            mode,
            label: ADVENTURE_MONSTER_MODE_LABELS[mode],
            n: p.monstersDefeatedByMode?.[mode] ?? 0,
        }));
    }, [p.monstersDefeatedByMode]);

    const stageRows = useMemo(() => {
        return ADVENTURE_STAGES.map((s) => {
            const xp = p.understandingXpByStage?.[s.id] ?? 0;
            const tier = getAdventureUnderstandingTierFromXp(xp);
            const nextThreshold =
                tier < ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS.length - 1
                    ? ADVENTURE_UNDERSTANDING_TIER_THRESHOLDS[tier + 1]
                    : null;
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
            return { ...s, xp, tier, prog, tierLabel: formatAdventureUnderstandingTierLabel(tier) };
        });
    }, [p.understandingXpByStage]);

    const uniqueN = p.uniqueMonsterIdsCaught?.length ?? 0;

    return (
        <section
            className={`rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-violet-950/25 to-zinc-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                compact ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4'
            }`}
            aria-label="모험 전용 전적 및 이해도"
        >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                <h2 className={`font-black tracking-tight text-transparent bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-amber-200 bg-clip-text ${compact ? 'text-sm' : 'text-base sm:text-lg'}`}>
                    모험 일지
                </h2>
                <div className="flex flex-wrap gap-1.5 text-[10px] sm:text-xs">
                    <span className="rounded-md border border-emerald-500/35 bg-emerald-950/40 px-2 py-0.5 font-semibold text-emerald-100/95">
                        처치 합계 {p.monstersDefeatedTotal ?? 0}
                    </span>
                    {uniqueN > 0 && (
                        <span className="rounded-md border border-sky-500/35 bg-sky-950/35 px-2 py-0.5 font-semibold text-sky-100/95">
                            도감 {uniqueN}종
                        </span>
                    )}
                </div>
            </div>

            <div className={`mt-2.5 grid gap-2 ${compact ? 'sm:grid-cols-1' : 'sm:grid-cols-2'}`}>
                <div className="rounded-xl border border-white/8 bg-black/25 px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">룰별 처치</p>
                    <ul className="mt-1.5 space-y-1 text-[11px] sm:text-xs">
                        {modeRows.map(({ mode, label, n }) => (
                            <li key={mode} className="flex justify-between gap-2 tabular-nums text-zinc-200">
                                <span className="text-zinc-400">{label}</span>
                                <span className="font-semibold text-amber-100/90">{n}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-950/15 px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/80">이해도 패시브</p>
                    <p className="mt-1 text-[11px] leading-snug text-amber-100/85 sm:text-xs">
                        지역 이해도가 오를수록 모험에서 획득하는 골드가 증가하고, 여러 지역을 깊이 이해하면 코어 능력치
                        유효값에 소폭 보너스가 붙습니다. (아이온2 종족 이해도와 유사한 구간 보너스)
                    </p>
                    <ul className="mt-2 space-y-1 text-[11px] font-semibold text-amber-50 sm:text-xs">
                        <li>모험 골드 +{goldBonus}% (합산 상한 적용)</li>
                        <li>
                            코어 능력치 유효 +{statFx}% (친숙함 이상 지역 수 기준, 상한 {ADVENTURE_UNDERSTANDING_STAT_EFFECT_CAP}%)
                        </li>
                    </ul>
                </div>
            </div>

            <div className="mt-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">지역 이해도</p>
                {stageRows.map((row) => (
                    <div key={row.id} className="rounded-lg border border-white/8 bg-black/20 px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
                            <span className="min-w-0 truncate font-bold text-zinc-100">{row.title}</span>
                            <span className="shrink-0 rounded border border-fuchsia-500/30 bg-fuchsia-950/30 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-100">
                                {row.tierLabel}
                            </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-500/80 via-fuchsia-500/80 to-amber-400/90 transition-all duration-500"
                                style={{ width: `${row.prog}%` }}
                            />
                        </div>
                        <p className="mt-0.5 text-[10px] tabular-nums text-zinc-500">XP {row.xp}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default AdventureProfilePanel;
