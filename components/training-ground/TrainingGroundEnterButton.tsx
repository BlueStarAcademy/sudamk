import React from 'react';
import { useTranslation } from 'react-i18next';

export type TrainingGroundEnterButtonVariant = 'enter' | 'ad' | 'disabled';

type TrainingGroundEnterButtonProps = {
    variant: TrainingGroundEnterButtonVariant;
    disabled?: boolean;
    remaining: number;
    max: number;
    onClick: () => void;
};

const EnterIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className={`h-4 w-4 shrink-0 sm:h-[1.125rem] sm:w-[1.125rem] ${className}`}
    >
        <path
            d="M5 12h10M13 8l4 4-4 4"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M19 6v12"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            opacity="0.55"
        />
    </svg>
);

const AdIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className={`h-4 w-4 shrink-0 sm:h-[1.125rem] sm:w-[1.125rem] ${className}`}
    >
        <rect x="4" y="6" width="16" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
        <path d="M10 9.5v5l4.5-2.5L10 9.5z" fill="currentColor" />
    </svg>
);

const VARIANT_SHELL: Record<
    TrainingGroundEnterButtonVariant,
    { shell: string; glow: string; badge: string; label: string; icon: string }
> = {
    enter: {
        shell:
            'border-amber-200/90 bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 text-stone-950 shadow-[0_10px_28px_-10px_rgba(251,191,36,0.95),0_0_0_1px_rgba(252,211,77,0.35),inset_0_1px_0_rgba(255,255,255,0.55)]',
        glow: 'bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,251,235,0.55),transparent_68%)]',
        badge: 'border-amber-900/25 bg-amber-950/20 text-amber-950/85',
        label: 'text-stone-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]',
        icon: 'text-amber-950/90',
    },
    ad: {
        shell:
            'border-sky-200/85 bg-gradient-to-b from-sky-300 via-sky-500 to-indigo-600 text-white shadow-[0_12px_30px_-10px_rgba(56,189,248,0.9),0_0_0_1px_rgba(125,211,252,0.35),inset_0_1px_0_rgba(255,255,255,0.4)]',
        glow: 'bg-[radial-gradient(ellipse_at_50%_0%,rgba(224,242,254,0.45),transparent_70%)]',
        badge: 'border-white/20 bg-black/20 text-sky-50',
        label: 'text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.45)]',
        icon: 'text-white/95',
    },
    disabled: {
        shell:
            'border-stone-600/50 bg-gradient-to-b from-stone-700/90 via-stone-800 to-stone-900 text-stone-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
        glow: 'bg-transparent',
        badge: 'border-stone-600/40 bg-black/25 text-stone-500',
        label: 'text-stone-400',
        icon: 'text-stone-500',
    },
};

const TrainingGroundEnterButton: React.FC<TrainingGroundEnterButtonProps> = ({
    variant,
    disabled = false,
    remaining,
    max,
    onClick,
}) => {
    const { t } = useTranslation('profile');
    const tone = VARIANT_SHELL[variant];
    const isAd = variant === 'ad';
    const primaryLabel = isAd ? t('trainingGroundUi.watchAdLabel') : t('trainingGroundUi.enter');
    const countLabel = isAd ? t('trainingGroundUi.watchAdCount') : `${remaining}/${max}`;
    const ariaLabel = isAd
        ? t('trainingGroundUi.watchAdRestore')
        : t('trainingGroundUi.enterWithCount', { remaining, max });

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            aria-label={ariaLabel}
            className={`group relative isolate flex h-[4.25rem] w-[7.25rem] shrink-0 flex-col overflow-hidden rounded-xl border px-2 py-2 transition duration-200 sm:h-[4.5rem] sm:w-[8.25rem] sm:px-2.5 ${
                tone.shell
            } ${
                disabled
                    ? 'cursor-not-allowed opacity-70 saturate-50'
                    : 'hover:-translate-y-0.5 hover:brightness-[1.03] active:translate-y-px active:brightness-[0.98]'
            }`}
        >
            <span className={`pointer-events-none absolute inset-0 ${tone.glow}`} aria-hidden />
            <span
                className="pointer-events-none absolute inset-x-3 top-1 h-px bg-white/35 opacity-80"
                aria-hidden
            />
            {!disabled && variant !== 'disabled' ? (
                <span
                    className={`pointer-events-none absolute -right-3 -top-3 h-10 w-10 rounded-full blur-xl ${
                        isAd ? 'bg-sky-200/35' : 'bg-amber-100/40'
                    }`}
                    aria-hidden
                />
            ) : null}

            <span className="relative z-[1] flex min-h-0 flex-1 flex-col items-center justify-center gap-1">
                <span className={`inline-flex items-center gap-1 ${tone.label}`}>
                    {isAd ? (
                        <AdIcon className={tone.icon} />
                    ) : (
                        <EnterIcon className={tone.icon} />
                    )}
                    <span className="text-[13px] font-black tracking-wide sm:text-sm">{primaryLabel}</span>
                </span>
                <span
                    className={`inline-flex min-w-[2.75rem] items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold tabular-nums leading-none sm:text-[11px] ${tone.badge}`}
                >
                    {countLabel}
                </span>
            </span>
        </button>
    );
};

export default TrainingGroundEnterButton;
