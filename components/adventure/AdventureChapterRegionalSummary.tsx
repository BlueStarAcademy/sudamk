import React from 'react';
import type { AdventureStageUnderstandingRow } from '../../utils/adventureStageUnderstandingRows.js';

const AdventureChapterRegionalSummary: React.FC<{
    row: AdventureStageUnderstandingRow;
    compact?: boolean;
    onOpenEffectSlots: () => void;
}> = ({ row, compact = false, onOpenEffectSlots }) => {
    const squareSize = compact ? 'h-9 w-9 min-h-[2.25rem] min-w-[2.25rem]' : 'h-11 w-11 min-h-[2.75rem] min-w-[2.75rem]';

    return (
        <div
            className={`flex min-h-0 min-w-0 flex-1 flex-row items-center gap-1 border-l border-white/10 bg-gradient-to-br from-zinc-950/90 via-fuchsia-950/20 to-zinc-950/95 ${
                compact ? 'px-1 py-0.5' : 'px-1.5 py-1 sm:px-2'
            }`}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-1">
                <div className={`flex min-w-0 items-center gap-1 ${compact ? 'text-[10px]' : 'text-xs sm:text-sm'}`}>
                    <span className="min-w-0 truncate font-bold text-zinc-100">{row.title}</span>
                    <span className="shrink-0 font-semibold text-fuchsia-200/95">[{row.tierLabel}]</span>
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
                className={`${squareSize} shrink-0 self-center rounded-md border border-fuchsia-400/50 bg-fuchsia-950/55 font-bold leading-tight text-fuchsia-50 shadow-sm transition-colors hover:border-amber-400/45 hover:bg-fuchsia-900/60 active:scale-[0.97] ${
                    compact ? 'text-[8px]' : 'text-[10px] sm:text-[11px]'
                }`}
                aria-label={`${row.title} 지역 효과`}
            >
                지역
                <br />
                효과
            </button>
        </div>
    );
};

export default AdventureChapterRegionalSummary;
