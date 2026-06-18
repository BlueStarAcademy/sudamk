import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CORE_STATS_DATA } from '../../constants/index.js';
import type { CoreStat } from '../../types/enums.js';
import { pairPetLevelUpCoreBonusDeltaEntries } from '../../shared/utils/pairPetRoll.js';

export type PairPetLevelUpCoreDeltaProps = {
    delta: Partial<Record<CoreStat, number>> | undefined | null;
    title?: string;
    tone?: 'fuchsia' | 'slate';
    compact?: boolean;
    className?: string;
};

/** 펫 레벨업 시 이번에만 증가한 6코어 보너스 요약 */
const PairPetLevelUpCoreDelta: React.FC<PairPetLevelUpCoreDeltaProps> = ({
    delta,
    title,
    tone = 'fuchsia',
    compact,
    className = '',
}) => {
    const { t } = useTranslation('pair');
    const resolvedTitle = title ?? t('pet.levelUpCoreDeltaDefault');
    const entries = useMemo(() => (delta ? pairPetLevelUpCoreBonusDeltaEntries(delta) : []), [delta]);
    if (entries.length === 0) return null;
    const ring =
        tone === 'fuchsia'
            ? 'border-fuchsia-400/30 bg-fuchsia-950/25'
            : 'border-slate-400/25 bg-slate-950/30';
    const titleC = tone === 'fuchsia' ? 'text-fuchsia-200' : 'text-slate-200';
    return (
        <div className={`rounded-lg border px-2 py-2 sm:px-3 sm:py-2 ${ring} ${className}`.trim()}>
            <p className={`mb-1.5 text-center text-[0.65rem] font-black tracking-tight sm:text-xs ${titleC}`}>{resolvedTitle}</p>
            <ul
                className={`grid grid-cols-2 gap-x-2 gap-y-1 ${compact ? 'text-[0.62rem]' : 'text-[0.68rem] sm:text-xs'}`}
            >
                {entries.map(({ stat, add }) => (
                    <li
                        key={stat}
                        className="flex min-w-0 items-center justify-between gap-1 rounded border border-white/10 bg-black/25 px-1.5 py-0.5 sm:px-2 sm:py-1"
                    >
                        <span className="min-w-0 truncate font-semibold text-slate-200">
                            {CORE_STATS_DATA[stat]?.name ?? stat}
                        </span>
                        <span className="shrink-0 font-black tabular-nums text-emerald-300">+{add}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default PairPetLevelUpCoreDelta;
