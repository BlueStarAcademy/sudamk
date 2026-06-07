import React from 'react';
import { ItemOption, MythicStat } from '../../types.js';
import { MythicOptionAbbrev } from '../MythicStatAbbrev.js';
import {
    bagOptionLabelText,
    formatBagOptionRangeTrailing,
    stripOptionDisplayRange,
} from '../../shared/utils/bagEquipmentOptionDisplay.js';
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
    const isMythic = Object.values(MythicStat).includes(opt.type as MythicStat);
    const resolvedColor = colorClass ?? (isMain ? 'text-yellow-300' : resolveEquipmentOptionColorClass(opt.type));
    const rangeTrailing = formatBagOptionRangeTrailing(opt, itemStars);

    return (
        <p
            className={`flex items-center justify-between gap-2 ${isMain ? 'font-semibold text-yellow-300' : resolvedColor} ${className}`}
        >
            <span className="min-w-0 shrink whitespace-nowrap">
                {isMain ? (
                    stripOptionDisplayRange(opt.display)
                ) : isMythic ? (
                    <>
                        <MythicOptionAbbrev option={opt} textClassName={resolvedColor} />
                        <span className="ml-0.5">{`+${opt.value}${opt.isPercentage ? '%' : ''}`}</span>
                    </>
                ) : (
                    bagOptionLabelText(opt, itemStars)
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
