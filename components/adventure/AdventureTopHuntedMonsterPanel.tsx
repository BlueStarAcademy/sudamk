import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AdventureTopCodexMonster } from '../../utils/adventureTopCodexMonster.js';

const AdventureTopHuntedMonsterPanel: React.FC<{
    monster: AdventureTopCodexMonster | null;
    compact?: boolean;
}> = ({ monster, compact = false }) => {
    const { t } = useTranslation('lobby');
    if (!monster) {
        return (
            <div
                className={`w-full rounded-xl border border-dashed border-violet-500/30 bg-violet-950/15 text-center ${
                    compact ? 'px-3 py-4' : 'px-4 py-5'
                }`}
                aria-label={t('adventure.topHuntedMonster')}
            >
                <p className={`font-semibold text-zinc-500 ${compact ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>
                    {t('adventure.noHuntRecord')}
                </p>
            </div>
        );
    }

    return (
        <div
            className="relative w-full min-w-0 overflow-hidden rounded-xl border border-violet-400/40 bg-gradient-to-br from-violet-950/55 via-zinc-950/95 to-fuchsia-950/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_-12px_rgba(139,92,246,0.45)]"
            aria-label={t('adventure.topHuntedMonster')}
        >
            <div
                className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-fuchsia-500/15 blur-2xl"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/50 to-transparent"
                aria-hidden
            />

            <div className={`relative flex items-stretch gap-3 ${compact ? 'px-3 py-2.5' : 'px-3.5 py-3 sm:px-4 sm:py-3.5'}`}>
                <div className="relative shrink-0">
                    <span
                        className={`absolute -left-0.5 -top-0.5 z-10 rounded-md border border-amber-300/60 bg-gradient-to-b from-amber-300 to-amber-600 px-1.5 font-black tracking-tighter text-zinc-950 shadow-md ${
                            compact ? 'py-0 text-[8px]' : 'py-0.5 text-[9px] sm:text-[10px]'
                        }`}
                    >
                        TOP
                    </span>
                    <div
                        className={`overflow-hidden rounded-xl border-2 border-violet-400/45 bg-black/50 shadow-[0_8px_20px_rgba(0,0,0,0.45)] ${
                            compact ? 'h-14 w-14' : 'h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]'
                        }`}
                    >
                        <img
                            src={monster.imageWebp}
                            alt=""
                            className="h-full w-full object-contain p-0.5"
                            draggable={false}
                        />
                    </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <p
                        className={`font-bold uppercase tracking-[0.14em] text-violet-300/85 ${
                            compact ? 'text-[9px]' : 'text-[10px] sm:text-[11px]'
                        }`}
                    >
                        {t('adventure.topHuntedMonster')}
                    </p>
                    <p
                        className={`mt-0.5 truncate font-black text-white ${
                            compact ? 'text-sm' : 'text-base sm:text-lg'
                        }`}
                    >
                        {monster.name}
                    </p>
                    <div
                        className={`mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums ${
                            compact ? 'text-[11px]' : 'text-xs sm:text-sm'
                        }`}
                    >
                        <span className="font-semibold text-amber-200/95">
                            {t('adventure.winsCount', { wins: monster.wins.toLocaleString() })}
                        </span>
                        <span className="text-zinc-500" aria-hidden>
                            ·
                        </span>
                        <span className="font-semibold text-violet-200/90">
                            {t('adventure.codexLevel', { level: monster.comprehensionLevel })}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdventureTopHuntedMonsterPanel;
