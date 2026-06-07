import React from 'react';

type NavKind = 'first' | 'back5' | 'back1' | 'forward1' | 'forward5' | 'last';

const LABELS: Record<NavKind, string> = {
    first: '처음으로',
    back5: '5수 뒤로',
    back1: '한수 뒤로',
    forward1: '한수 앞으로',
    forward5: '5수 앞으로',
    last: '마지막으로',
};

const Icon: React.FC<{ kind: NavKind; className?: string }> = ({ kind, className = 'h-7 w-7' }) => {
    const stroke = 'currentColor';
    const common = { fill: 'none', stroke, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
    switch (kind) {
        case 'first':
            return (
                <svg viewBox="0 0 24 24" className={className} aria-hidden>
                    <path {...common} d="M6 6v12M11 12L18 6v12z" />
                    <path {...common} d="M4 6v12" strokeWidth={2.5} />
                </svg>
            );
        case 'back5':
            return (
                <svg viewBox="0 0 24 24" className={className} aria-hidden>
                    <path {...common} d="M5 12h8M9 8l-4 4 4 4" />
                    <text x="15" y="16" fontSize="8" fontWeight="700" fill="currentColor" stroke="none">
                        5
                    </text>
                </svg>
            );
        case 'back1':
            return (
                <svg viewBox="0 0 24 24" className={className} aria-hidden>
                    <path {...common} d="M6 12h10M10 8l-4 4 4 4" />
                </svg>
            );
        case 'forward1':
            return (
                <svg viewBox="0 0 24 24" className={className} aria-hidden>
                    <path {...common} d="M18 12H8M14 8l4 4-4 4" />
                </svg>
            );
        case 'forward5':
            return (
                <svg viewBox="0 0 24 24" className={className} aria-hidden>
                    <path {...common} d="M19 12h-8M15 8l4 4-4 4" />
                    <text x="3" y="16" fontSize="8" fontWeight="700" fill="currentColor" stroke="none">
                        5
                    </text>
                </svg>
            );
        case 'last':
            return (
                <svg viewBox="0 0 24 24" className={className} aria-hidden>
                    <path {...common} d="M18 6v12M13 12l-7-6v12z" />
                    <path {...common} d="M20 6v12" strokeWidth={2.5} />
                </svg>
            );
    }
};

export const GAME_RECORD_REPLAY_NAV_ORDER: NavKind[] = [
    'first',
    'back5',
    'back1',
    'forward1',
    'forward5',
    'last',
];

interface GameRecordReplayNavProps {
    onFirst: () => void;
    onBack5: () => void;
    onBack1: () => void;
    onForward1: () => void;
    onForward5: () => void;
    onLast: () => void;
    canGoBack: boolean;
    canGoForward: boolean;
    /** 인라인 기보 뷰어 — 한 줄 컨트롤 바에 맞춘 작은 버튼 */
    compact?: boolean;
}

const GameRecordReplayNav: React.FC<GameRecordReplayNavProps> = ({
    onFirst,
    onBack5,
    onBack1,
    onForward1,
    onForward5,
    onLast,
    canGoBack,
    canGoForward,
    compact = false,
}) => {
    const handlers: Record<NavKind, () => void> = {
        first: onFirst,
        back5: onBack5,
        back1: onBack1,
        forward1: onForward1,
        forward5: onForward5,
        last: onLast,
    };

    const disabledFor = (kind: NavKind): boolean => {
        if (kind === 'first' || kind === 'back1' || kind === 'back5') return !canGoBack;
        return !canGoForward;
    };

    const btnClass = compact
        ? 'group flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/35 bg-gradient-to-b from-zinc-800/95 to-zinc-950 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.35)] transition hover:border-amber-300/55 hover:from-zinc-700/95 hover:to-zinc-900 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-amber-400/35 disabled:hover:from-zinc-800/95 disabled:hover:to-zinc-950 sm:h-10 sm:w-10'
        : 'group flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/35 bg-gradient-to-b from-zinc-800/95 to-zinc-950 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.35)] transition hover:border-amber-300/55 hover:from-zinc-700/95 hover:to-zinc-900 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-amber-400/35 disabled:hover:from-zinc-800/95 disabled:hover:to-zinc-950 sm:h-12 sm:w-12';

    const iconClass = compact ? 'h-6 w-6' : 'h-7 w-7';

    return (
        <div className={`flex flex-wrap items-center justify-center ${compact ? 'gap-1 sm:gap-1.5' : 'gap-2 sm:gap-2.5'}`}>
            {GAME_RECORD_REPLAY_NAV_ORDER.map((kind) => {
                const disabled = disabledFor(kind);
                return (
                    <button
                        key={kind}
                        type="button"
                        title={LABELS[kind]}
                        aria-label={LABELS[kind]}
                        disabled={disabled}
                        onClick={handlers[kind]}
                        className={btnClass}
                    >
                        <Icon kind={kind} className={iconClass} />
                    </button>
                );
            })}
        </div>
    );
};

export default GameRecordReplayNav;
