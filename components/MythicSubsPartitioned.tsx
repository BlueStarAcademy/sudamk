import React from 'react';
import type { ItemOption } from '../types.js';
import { partitionMythicSubsWithIndex } from '../shared/utils/specialOptionGearEffects.js';
import { MythicOptionAbbrev } from './MythicStatAbbrev.js';

export const MythicSubsPartitioned: React.FC<{
    subs: ItemOption[] | undefined | null;
    mythicTextClass?: string;
    transcendentTextClass?: string;
    /** true면 옵션 블록 본문·소제목을 text-xs로 한 단계 키움 */
    enlargeBody?: boolean;
    /** true면 각 옵션 줄 줄바꿈 없음(가로로만 늘어남) */
    rowsNoWrap?: boolean;
}> = ({
    subs,
    mythicTextClass = 'text-red-400',
    transcendentTextClass = 'text-cyan-300',
    enlargeBody = false,
    rowsNoWrap = false,
}) => {
    const { mythicGradeRows, transcendentGradeRows } = partitionMythicSubsWithIndex(subs);
    if (mythicGradeRows.length === 0 && transcendentGradeRows.length === 0) return null;
    const bodyText = enlargeBody ? 'text-[13px] leading-snug' : 'text-[12px] leading-snug';
    const headText = enlargeBody ? 'text-[13px] font-semibold leading-snug' : 'text-[12px] font-semibold leading-snug';
    const rowWrap = rowsNoWrap ? 'whitespace-nowrap' : '';
    return (
        <div className={`space-y-1.5 ${bodyText}`}>
            {mythicGradeRows.length > 0 ? (
                <div className="space-y-0.5">
                    <p className={`${headText} text-rose-200/90`}>신화 스페셜 옵션</p>
                    {mythicGradeRows.map(({ sub, index }) => (
                        <p key={`mythic-sp-${index}`} className={`leading-snug ${mythicTextClass} ${rowWrap}`}>
                            <MythicOptionAbbrev option={sub} textClassName={mythicTextClass} />
                        </p>
                    ))}
                </div>
            ) : null}
            {transcendentGradeRows.length > 0 ? (
                <div className="space-y-0.5">
                    <p className={`${headText} text-cyan-200/90`}>초월 스페셜 옵션</p>
                    {transcendentGradeRows.map(({ sub, index }) => (
                        <p key={`trans-sp-${index}`} className={`leading-snug ${transcendentTextClass} ${rowWrap}`}>
                            <MythicOptionAbbrev option={sub} textClassName={transcendentTextClass} />
                        </p>
                    ))}
                </div>
            ) : null}
        </div>
    );
};
