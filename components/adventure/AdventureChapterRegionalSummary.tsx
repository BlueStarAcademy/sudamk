import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AdventureStageUnderstandingRow } from '../../utils/adventureStageUnderstandingRows.js';

const AdventureChapterRegionalSummary: React.FC<{
    row: AdventureStageUnderstandingRow;
    compact?: boolean;
    /** 빈 해금 슬롯 또는 강화 포인트 잔여 시 「지역 효과」 버튼에 붉은점 */
    showAttentionDot?: boolean;
    onOpenEffectSlots: () => void;
}> = ({ row, compact = false, showAttentionDot = false, onOpenEffectSlots }) => {
    const { t } = useTranslation('lobby');
    const xpCurrent = row.xpInTier ?? row.xp;
    const xpGoal = row.xpNeedInTier ?? row.xpGoal;

    return (
        <div
            className={`flex min-h-0 shrink-0 items-center gap-2 border-t border-fuchsia-500/25 bg-gradient-to-r from-fuchsia-950/50 via-zinc-950/92 to-zinc-950/98 ${
                compact ? 'px-1.5 py-1' : 'px-2 py-1.5 sm:px-2.5'
            }`}
            onClick={(e) => e.stopPropagation()}
        >
            <span
                className={`shrink-0 rounded-full border border-fuchsia-400/45 bg-fuchsia-950/70 font-bold text-fuchsia-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${
                    compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-0.5 text-[10px] sm:text-xs'
                }`}
            >
                {row.tierLabel}
            </span>

            <div className="min-w-0 flex-1">
                <p
                    className={`text-right font-mono tabular-nums text-zinc-500 ${
                        compact ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'
                    }`}
                >
                    {xpCurrent.toLocaleString()}/{xpGoal.toLocaleString()}
                </p>
                <div
                    className={`mt-0.5 overflow-hidden rounded-full bg-zinc-800/90 ring-1 ring-inset ring-white/5 ${
                        compact ? 'h-1.5' : 'h-2'
                    }`}
                >
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400/90 via-fuchsia-500/90 to-amber-400/95 shadow-[0_0_8px_rgba(192,132,252,0.35)] transition-all duration-500"
                        style={{ width: `${Math.max(4, row.prog)}%` }}
                    />
                </div>
            </div>

            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onOpenEffectSlots();
                }}
                className={`relative shrink-0 whitespace-nowrap rounded-lg border border-fuchsia-400/50 bg-gradient-to-b from-fuchsia-600/35 to-fuchsia-950/80 font-bold text-fuchsia-50 shadow-[0_4px_14px_-6px_rgba(192,132,252,0.55)] transition-all hover:border-amber-300/50 hover:from-fuchsia-500/45 hover:to-fuchsia-900/80 active:scale-[0.98] ${
                    compact ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-[10px] sm:text-xs'
                }`}
                aria-label={t('adventure.regionalEffectAria', { title: row.title })}
            >
                {t('adventure.regionalEffect')}
                {showAttentionDot ? (
                    <span
                        className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.75)] ring-2 ring-zinc-950/90"
                        aria-hidden
                    />
                ) : null}
            </button>
        </div>
    );
};

export default AdventureChapterRegionalSummary;
