import React from 'react';
import { useTranslation } from 'react-i18next';
import { ItemOption, MythicStat } from '../../types.js';
import { MythicOptionAbbrev } from '../MythicStatAbbrev.js';
import {
    formatLocalizedBagOptionLabel,
    formatLocalizedBagOptionRangeTrailing,
} from '../../shared/i18n/inventoryItemText.js';
import { coerceSpecialStatType } from '../../shared/utils/specialStatMilestones.js';

export function resolveEquipmentOptionColorClass(type: ItemOption['type']): string {
    if (coerceSpecialStatType(type)) return 'text-green-300';
    if (Object.values(MythicStat).includes(type as MythicStat)) return 'text-orange-400';
    return 'text-blue-300';
}

type EquipmentBagStyleOptionRowProps = {
    opt: ItemOption;
    itemStars: number;
    colorClass?: string;
    className?: string;
    isMain?: boolean;
    rangeMetaClassName?: string;
};

export const EquipmentBagStyleOptionRow: React.FC<EquipmentBagStyleOptionRowProps> = ({
    opt,
    itemStars,
    colorClass,
    className = '',
    isMain = false,
    rangeMetaClassName = 'text-stone-400',
}) => {
    const { t } = useTranslation(['inventory', 'profile']);
    const isMythic = Object.values(MythicStat).includes(opt.type as MythicStat);
    const resolvedColor = colorClass ?? (isMain ? 'text-yellow-300' : resolveEquipmentOptionColorClass(opt.type));
    const rangeTrailing = formatLocalizedBagOptionRangeTrailing(opt, itemStars, t);
    const mainLabel = isMain ? formatLocalizedBagOptionLabel(opt, itemStars, t) : null;

    return (
        <p
            className={`flex items-center justify-between gap-2 ${isMain ? 'font-semibold text-yellow-300' : resolvedColor} ${className}`}
        >
            <span className="min-w-0 shrink whitespace-nowrap">
                {isMain ? (
                    mainLabel
                ) : isMythic ? (
                    <MythicOptionAbbrev option={opt} textClassName={resolvedColor} />
                ) : (
                    formatLocalizedBagOptionLabel(opt, itemStars, t)
                )}
            </span>
            {rangeTrailing ? (
                <span
                    className={`shrink-0 whitespace-nowrap text-right tabular-nums ${isMain ? 'text-amber-200/85' : rangeMetaClassName}`}
                >
                    {rangeTrailing}
                </span>
            ) : null}
        </p>
    );
};

export default EquipmentBagStyleOptionRow;
