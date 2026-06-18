import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemOption } from '../types.js';
import { partitionMythicSubsWithIndex } from '../shared/utils/specialOptionGearEffects.js';
import { EquipmentBagStyleOptionRow } from './equipment/EquipmentBagStyleOptionRow.js';

export const MythicSubsPartitioned: React.FC<{
    const { t } = useTranslation('game');
    subs: ItemOption[] | undefined | null;
    itemStars?: number;
    mythicTextClass?: string;
    transcendentTextClass?: string;
    /** true면 옵션 블록 본문·소제목을 text-xs로 한 단계 키움 */
    enlargeBody?: boolean;
    /** true면 각 옵션 줄 줄바꿈 없음(가로로만 늘어남) */
    rowsNoWrap?: boolean;
}> = ({
    subs,
    itemStars = 0,
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
                    <p className={`${headText} text-rose-200/90`}>{t('mythicPartition.mythic')}</p>
                    {mythicGradeRows.map(({ sub, index }) => (
                        <EquipmentBagStyleOptionRow
                            key={`mythic-sp-${index}`}
                            opt={sub}
                            itemStars={itemStars}
                            colorClass={mythicTextClass}
                            className={rowWrap}
                        />
                    ))}
                </div>
            ) : null}
            {transcendentGradeRows.length > 0 ? (
                <div className="space-y-0.5">
                    <p className={`${headText} text-cyan-200/90`}>{t('mythicPartition.transcendent')}</p>
                    {transcendentGradeRows.map(({ sub, index }) => (
                        <EquipmentBagStyleOptionRow
                            key={`trans-sp-${index}`}
                            opt={sub}
                            itemStars={itemStars}
                            colorClass={transcendentTextClass}
                            className={rowWrap}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
};
