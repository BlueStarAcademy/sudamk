import React from 'react';
import type { AdventureStageUnderstandingRow } from '../../utils/adventureStageUnderstandingRows.js';

const AdventureChapterRegionalSummary: React.FC<{
    row: AdventureStageUnderstandingRow;
    compact?: boolean;
    onOpenEffectSlots: () => void;
}> = ({ row, compact = false, onOpenEffectSlots }) => {
    return (
        <div
            className={`flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-1.5 border-l border-white/10 bg-gradient-to-br from-zinc-950/90 via-fuchsia-950/20 to-zinc-950/95 ${
                compact ? 'px-1.5 py-1' : 'px-2 py-1.5 sm:px-2.5 sm:py-2'
            }`}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="min-w-0 space-y-1">
                <p
                    className={`font-bold uppercase tracking-wider text-fuchsia-300/90 ${
                        compact ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'
                    }`}
                >
                    지역 탐험도
                </p>
                <div className={`flex items-center justify-between gap-1 ${compact ? 'text-[10px]' : 'text-xs sm:text-sm'}`}>
                    <span className="min-w-0 truncate font-semibold text-zinc-200">{row.tierLabel}</span>
                    <span
                        className={`shrink-0 tabular-nums text-zinc-500 ${compact ? 'text-[9px]' : 'text-[10px] sm:text-xs'}`}
                    >
                        {(row.xpInTier ?? row.xp).toLocaleString()}/
                        {(row.xpNeedInTier ?? row.xpGoal).toLocaleString()}
                    </span>
                </div>
                <div className={`overflow-hidden rounded-full bg-zinc-800 ${compact ? 'h-1' : 'h-1.5 sm:h-2'}`}>
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500/80 via-fuchsia-500/80 to-amber-400/90 transition-all duration-500"
                        style={{ width: `${row.prog}%` }}
                    />
                </div>
            </div>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onOpenEffectSlots();
                }}
                className={`w-full shrink-0 rounded-md border border-fuchsia-400/45 bg-fuchsia-950/50 font-bold text-fuchsia-100 transition-colors hover:border-amber-400/45 hover:bg-fuchsia-900/55 active:scale-[0.98] ${
                    compact ? 'px-1.5 py-1 text-[9px]' : 'px-2 py-1.5 text-[10px] sm:text-xs'
                }`}
            >
                지역 효과슬롯
            </button>
        </div>
    );
};

export default AdventureChapterRegionalSummary;
