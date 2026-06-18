import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PairLobbySettingChangeDiffRow } from '../../shared/utils/pairLobbyGameSettingRows.js';
import { truncatePlayfulLobbySettingDisplayValue } from '../../shared/utils/pairLobbyGameSettingRows.js';

type PairLobbySettingChangeDiffTableProps = {
    rows: PairLobbySettingChangeDiffRow[];
    playfulTruncate?: boolean;
    compact?: boolean;
    className?: string;
};

const formatValue = (value: string, playfulTruncate: boolean) =>
    playfulTruncate ? truncatePlayfulLobbySettingDisplayValue(value) : value;

const PairLobbySettingChangeDiffTable: React.FC<PairLobbySettingChangeDiffTableProps> = ({
    rows,
    playfulTruncate = false,
    compact = false,
    className = '',
}) => {
    const { t } = useTranslation('lobby');

    if (rows.length === 0) {
        return (
            <p
                className={`rounded-lg border border-dashed border-white/15 bg-black/40 px-3 py-4 text-center text-slate-500 ${
                    compact ? 'text-[0.68rem]' : 'text-xs sm:text-sm'
                }`}
            >
                {t('pairSettingDiff.noChanges')}
            </p>
        );
    }

    const labelClass = compact
        ? 'text-[0.65rem] leading-tight sm:text-[0.68rem]'
        : 'text-[0.68rem] leading-snug sm:text-xs';
    const valueClass = compact
        ? 'text-[0.65rem] font-semibold leading-tight sm:text-[0.68rem]'
        : 'text-[0.68rem] font-semibold leading-snug sm:text-xs';
    const headerClass = compact
        ? 'text-[0.62rem] font-extrabold uppercase tracking-wide text-slate-500'
        : 'text-[0.65rem] font-extrabold uppercase tracking-wide text-slate-500 sm:text-[0.68rem]';

    return (
        <div
            className={`overflow-hidden rounded-lg border border-white/12 bg-black/40 ${className}`.trim()}
        >
            <div
                className={`grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 border-b border-white/10 bg-white/[0.03] px-2.5 py-2 sm:px-3 ${
                    compact ? 'gap-x-1.5' : 'gap-x-2'
                }`}
            >
                <span className={headerClass}>{t('pairSettingDiff.field')}</span>
                <span className={`${headerClass} text-center`}>{t('pairSettingDiff.before')}</span>
                <span className={`${headerClass} text-center text-amber-200/90`}>{t('pairSettingDiff.proposed')}</span>
            </div>
            <dl className={`max-h-[min(42vh,18rem)] overflow-y-auto ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5 sm:px-3'}`}>
                {rows.map((row) => (
                    <div
                        key={row.label}
                        className={`grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 border-b border-white/[0.06] py-1.5 last:border-b-0 ${
                            compact ? 'gap-x-1.5' : 'gap-x-2'
                        }`}
                    >
                        <dt className={`min-w-0 text-slate-400 [overflow-wrap:anywhere] ${labelClass}`}>{row.label}</dt>
                        <dd className={`min-w-0 text-center text-slate-300 line-through decoration-slate-500/70 [overflow-wrap:anywhere] ${valueClass}`}>
                            {formatValue(row.before, playfulTruncate)}
                        </dd>
                        <dd className={`min-w-0 text-center text-amber-50 [overflow-wrap:anywhere] ${valueClass}`}>
                            {formatValue(row.after, playfulTruncate)}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
};

export default PairLobbySettingChangeDiffTable;
