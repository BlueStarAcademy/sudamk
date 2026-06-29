import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatAdventureRemainMs } from './adventureI18nHelpers.js';

type Props = {
    level?: number;
    name: string;
    modeLabel?: string;
    /** 맵 마커: 짧은 모드 뱃지(타이머 옆) */
    modeBadge?: string;
    modeBadgeTitle?: string;
    boss?: boolean;
    variant: 'map' | 'list';
    remainingMs?: number;
    compact?: boolean;
};

const AdventureMapMonsterLabel: React.FC<Props> = ({
    level,
    name,
    modeLabel,
    modeBadge,
    modeBadgeTitle,
    boss = false,
    variant,
    remainingMs,
    compact = false,
}) => {
    const { t } = useTranslation('lobby');
    const nameClass =
        variant === 'map'
            ? `font-bold leading-tight text-amber-50 [text-shadow:0_1px_2px_rgba(0,0,0,0.95)] ${
                  compact ? 'text-[11px]' : 'text-[11px] sm:text-xs'
              }`
            : `font-bold text-amber-50 ${compact ? 'text-[11px]' : 'text-[11px] sm:text-xs'}`;

    const levelClass = `shrink-0 font-mono font-black tabular-nums text-amber-200 ${
        compact ? 'text-[11px]' : 'text-[11px] sm:text-xs'
    }`;

    const timerClass = `font-mono font-bold tabular-nums text-emerald-300 ${
        compact ? 'text-[10px]' : 'text-[10px] sm:text-[11px]'
    }`;

    const row = (
        <span className={`flex min-w-0 items-center gap-1 ${variant === 'map' ? 'justify-center' : ''} overflow-hidden`}>
            {level != null ? (
                <span className={levelClass} aria-label={t('adventure.levelAria', { level })}>
                    Lv.{level}
                </span>
            ) : null}
            <span className={`min-w-0 truncate whitespace-nowrap ${nameClass}`}>{name}</span>
            {modeLabel ? (
                <span
                    className="shrink-0 whitespace-nowrap rounded bg-violet-950/90 px-1 py-px text-[9px] font-bold leading-none text-fuchsia-100 shadow-sm sm:text-[10px]"
                    title={modeLabel}
                >
                    {modeLabel}
                </span>
            ) : null}
            {boss ? (
                <span className="shrink-0 whitespace-nowrap rounded border border-amber-400/45 bg-amber-500/15 px-1 py-px text-[8px] font-black uppercase tracking-wider text-amber-100 sm:text-[9px]">
                    {t('adventure.boss')}
                </span>
            ) : null}
        </span>
    );

    const modeBadgeClass =
        'shrink-0 whitespace-nowrap rounded bg-violet-950/90 px-1 py-px text-[9px] font-bold leading-none text-fuchsia-100 shadow-sm sm:text-[10px]';

    if (variant === 'map') {
        const showFooter = (remainingMs != null && remainingMs > 0) || modeBadge;
        return (
            <div
                className={`mt-1 flex w-full flex-col items-center text-center ${
                    compact ? 'max-w-[min(42vw,7rem)]' : 'max-w-[11rem] sm:max-w-[13rem]'
                }`}
            >
                {row}
                {showFooter ? (
                    <span className="mt-0.5 flex items-center justify-center gap-1">
                        {remainingMs != null && remainingMs > 0 ? (
                            <span className={timerClass}>{formatAdventureRemainMs(t, remainingMs)}</span>
                        ) : null}
                        {modeBadge ? (
                            <span className={modeBadgeClass} title={modeBadgeTitle ?? modeBadge}>
                                {modeBadge}
                            </span>
                        ) : null}
                    </span>
                ) : null}
            </div>
        );
    }

    return row;
};

export default AdventureMapMonsterLabel;
