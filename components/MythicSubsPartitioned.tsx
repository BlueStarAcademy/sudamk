import React from 'react';
import type { ItemOption } from '../types.js';
import { partitionMythicSubsWithIndex } from '../shared/utils/specialOptionGearEffects.js';
import { MythicOptionAbbrev } from './MythicStatAbbrev.js';

export const MythicSubsPartitioned: React.FC<{
    subs: ItemOption[] | undefined | null;
    mythicTextClass?: string;
    transcendentTextClass?: string;
}> = ({
    subs,
    mythicTextClass = 'text-red-400',
    transcendentTextClass = 'text-cyan-300',
}) => {
    const { mythicGradeRows, transcendentGradeRows } = partitionMythicSubsWithIndex(subs);
    if (mythicGradeRows.length === 0 && transcendentGradeRows.length === 0) return null;
    return (
        <div className="space-y-2">
            {mythicGradeRows.length > 0 ? (
                <div className="space-y-0.5">
                    <p className="text-[10px] font-semibold text-rose-200/90">신화 스페셜 옵션</p>
                    {mythicGradeRows.map(({ sub, index }) => (
                        <p key={`mythic-sp-${index}`} className={mythicTextClass}>
                            <MythicOptionAbbrev option={sub} textClassName={mythicTextClass} />
                        </p>
                    ))}
                </div>
            ) : null}
            {transcendentGradeRows.length > 0 ? (
                <div className="space-y-0.5">
                    <p className="text-[10px] font-semibold text-cyan-200/90">초월 스페셜 옵션</p>
                    {transcendentGradeRows.map(({ sub, index }) => (
                        <p key={`trans-sp-${index}`} className={transcendentTextClass}>
                            <MythicOptionAbbrev option={sub} textClassName={transcendentTextClass} />
                        </p>
                    ))}
                </div>
            ) : null}
        </div>
    );
};
