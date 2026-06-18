import React from 'react';
import { tx } from '../../shared/i18n/runtimeText.js';

export type ArenaRightSidebarCollapseToggleTone = 'standard' | 'championship';

export type ArenaRightSidebarCollapseToggleProps = {
    collapsed: boolean;
    onToggle: () => void;
    tone?: ArenaRightSidebarCollapseToggleTone;
};

const ChevronLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 7l-5 5 5 5" />
    </svg>
);

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10 7l5 5-5 5" />
    </svg>
);

/**
 * Desktop-only: right game sidebar rail — tab control on the left edge of the rail, bottom-aligned.
 */
export const ArenaRightSidebarCollapseToggle: React.FC<ArenaRightSidebarCollapseToggleProps> = ({
    collapsed,
    onToggle,
    tone = 'standard',
}) => {
    const expandLabel = tx('game:sidebar.expand');
    const collapseLabel = tx('game:sidebar.collapse');
    const label = collapsed ? expandLabel : collapseLabel;

    const toneRing =
        tone === 'championship'
            ? 'shadow-[0_12px_40px_-10px_rgba(0,0,0,0.75),0_0_0_1px_rgba(251,191,36,0.22),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.35)] hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.82),0_0_0_1px_rgba(252,211,77,0.35),inset_0_1px_0_rgba(255,255,255,0.26)]'
            : 'shadow-[0_12px_40px_-10px_rgba(0,0,0,0.72),0_0_0_1px_rgba(148,163,184,0.18),inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,0,0,0.38)] hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.8),0_0_0_1px_rgba(34,211,238,0.28),inset_0_1px_0_rgba(255,255,255,0.22)]';

    const toneSurface =
        tone === 'championship'
            ? 'border-amber-400/28 bg-gradient-to-br from-amber-500/18 via-slate-900/88 to-zinc-950 text-amber-50/95 hover:border-amber-300/42 hover:from-amber-400/26 hover:via-slate-800/90 hover:to-zinc-950'
            : 'border-slate-400/22 bg-gradient-to-br from-slate-600/25 via-slate-900/88 to-zinc-950 text-slate-100/95 hover:border-cyan-300/32 hover:from-cyan-500/14 hover:via-slate-800/92 hover:to-zinc-950';

    return (
        <button
            type="button"
            onClick={onToggle}
            className={`group pointer-events-auto absolute bottom-3 left-0 z-[960] flex h-11 w-9 -translate-x-[calc(100%-2px)] flex-col items-center justify-center gap-0.5 rounded-l-xl rounded-r-md border backdrop-blur-md transition-all duration-300 ease-out motion-reduce:transition-none ${toneRing} ${toneSurface} hover:scale-[1.03] active:scale-[0.97] motion-reduce:hover:scale-100 motion-reduce:active:scale-100 sm:bottom-4 sm:h-12 sm:w-10`}
            title={label}
            aria-label={label}
            aria-expanded={!collapsed}
        >
            <span
                className={`pointer-events-none absolute inset-y-1 left-0 w-px rounded-full bg-gradient-to-b from-white/55 via-white/12 to-transparent opacity-70 transition-opacity group-hover:opacity-100`}
                aria-hidden
            />
            <span className="pointer-events-none absolute -right-px top-1/2 h-[42%] w-px -translate-y-1/2 rounded-full bg-black/35" aria-hidden />
            {collapsed ? (
                <ChevronLeftIcon className="h-5 w-5 shrink-0 opacity-95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] sm:h-[1.35rem] sm:w-[1.35rem]" />
            ) : (
                <ChevronRightIcon className="h-5 w-5 shrink-0 opacity-95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] sm:h-[1.35rem] sm:w-[1.35rem]" />
            )}
        </button>
    );
};
