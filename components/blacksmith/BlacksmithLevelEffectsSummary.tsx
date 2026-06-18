import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    BLACKSMITH_MAX_LEVEL,
    BLACKSMITH_COMBINABLE_GRADES_BY_LEVEL,
    BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES,
    BLACKSMITH_DISASSEMBLY_JACKPOT_RATES,
} from '../../constants/rules.js';
import { ItemGrade } from '../../types/enums.js';
import { formatBlacksmithPercentInt } from '../../shared/utils/formatBlacksmithPercentInt.js';
import { useLocalizedItemGrade } from '../../shared/i18n/localizedCatalog.js';

const GRADE_ORDER: ItemGrade[] = [
    ItemGrade.Normal,
    ItemGrade.Uncommon,
    ItemGrade.Rare,
    ItemGrade.Epic,
    ItemGrade.Legendary,
    ItemGrade.Mythic,
    ItemGrade.Transcendent,
];

export interface BlacksmithLevelEffectsSummaryProps {
    blacksmithLevel: number;
    disassemblyJackpotBonusPercent?: number;
    combinationGreatSuccessBonusPercent?: number;
    className?: string;
    /** 모바일·좁은 화면: 본문·헤더를 13px 계열로 통일 */
    compact?: boolean;
}

/** 대장간 레벨별 수치 효과 (합성 등급, 대박·대성공 확률 등) */
const BlacksmithLevelEffectsSummary: React.FC<BlacksmithLevelEffectsSummaryProps> = ({
    blacksmithLevel,
    disassemblyJackpotBonusPercent = 0,
    combinationGreatSuccessBonusPercent = 0,
    className = '',
    compact = false,
}) => {
    const { t } = useTranslation('blacksmith');
    const localizedGrade = useLocalizedItemGrade();
    const currentLevel = blacksmithLevel ?? 1;
    const isMaxLevel = currentLevel >= BLACKSMITH_MAX_LEVEL;
    const currentLevelIndex = currentLevel - 1;
    const nextLevelIndex = isMaxLevel ? currentLevelIndex : currentLevel;

    const headerRowClass = compact
        ? 'mb-1.5 flex justify-between border-b border-gray-600 px-1.5 pb-1 text-[13px] font-bold leading-snug text-gray-400'
        : 'mb-2 flex justify-between border-b border-gray-600 px-2 pb-1 text-sm font-bold text-gray-400';
    const bodyClass = compact ? 'space-y-1.5 text-[13px] leading-snug text-secondary' : 'space-y-2 text-sm text-secondary';
    const cardClass = compact ? 'rounded-md bg-black/20 p-1.5' : 'rounded-md bg-black/20 p-2';
    const comboTitleClass = compact ? 'font-semibold leading-snug' : 'font-semibold';

    return (
        <div className={`text-left ${className}`}>
            <div className={headerRowClass}>
                <span>{t('levelEffects.effects')}</span>
                <span>
                    Lv.{currentLevel}
                    {!isMaxLevel && <span className="text-yellow-400"> → Lv.{currentLevel + 1}</span>}
                </span>
            </div>
            <div className={bodyClass}>
                <div className={cardClass}>
                    <div className="flex justify-between gap-2">
                        <span>{t('levelEffects.maxCombineGrade')}</span>
                        <span>
                            {localizedGrade(BLACKSMITH_COMBINABLE_GRADES_BY_LEVEL[currentLevelIndex])}
                            {!isMaxLevel && (
                                <span className="text-yellow-400">
                                    {' '}
                                    → {localizedGrade(BLACKSMITH_COMBINABLE_GRADES_BY_LEVEL[nextLevelIndex])}
                                </span>
                            )}
                        </span>
                    </div>
                </div>
                <div className={cardClass}>
                    <div className="flex justify-between gap-2">
                        <span>{t('levelEffects.disassembleJackpot')}</span>
                        <span>
                            {formatBlacksmithPercentInt(BLACKSMITH_DISASSEMBLY_JACKPOT_RATES[currentLevelIndex])}%
                            {disassemblyJackpotBonusPercent > 0 && (
                                <span className="text-emerald-300"> (+{formatBlacksmithPercentInt(disassemblyJackpotBonusPercent)}%)</span>
                            )}
                            {!isMaxLevel && (
                                <span className="text-yellow-400"> → {formatBlacksmithPercentInt(BLACKSMITH_DISASSEMBLY_JACKPOT_RATES[nextLevelIndex])}%</span>
                            )}
                        </span>
                    </div>
                </div>
                <div className={cardClass}>
                    <div className="flex justify-between gap-2">
                        <span>{t('levelEffects.materialJackpot')}</span>
                        <span>
                            {formatBlacksmithPercentInt(BLACKSMITH_DISASSEMBLY_JACKPOT_RATES[currentLevelIndex])}%
                            {disassemblyJackpotBonusPercent > 0 && (
                                <span className="text-emerald-300"> (+{formatBlacksmithPercentInt(disassemblyJackpotBonusPercent)}%)</span>
                            )}
                            {!isMaxLevel && (
                                <span className="text-yellow-400"> → {formatBlacksmithPercentInt(BLACKSMITH_DISASSEMBLY_JACKPOT_RATES[nextLevelIndex])}%</span>
                            )}
                        </span>
                    </div>
                </div>
                <div className={cardClass}>
                    <p className={comboTitleClass}>{t('levelEffects.combineGreatSuccess')}</p>
                    {GRADE_ORDER.slice(0, -1).map((grade, index) => {
                        const rateKey = grade as Exclude<ItemGrade, ItemGrade.Transcendent>;
                        const rate = BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES[currentLevelIndex]?.[rateKey] ?? 0;
                        const nextRate = BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES[nextLevelIndex]?.[rateKey];
                        const nextGrade = GRADE_ORDER[index + 1];
                        const currentGradeName = localizedGrade(grade);
                        const nextGradeName = localizedGrade(nextGrade);

                        return (
                            <div key={grade} className={`flex justify-between gap-2 ${compact ? 'pl-1' : 'pl-2'}`}>
                                <span>
                                    {currentGradeName} → {nextGradeName}
                                </span>
                                <span>
                                    {formatBlacksmithPercentInt(rate)}%
                                    {combinationGreatSuccessBonusPercent > 0 && (
                                        <span className="text-emerald-300"> (+{formatBlacksmithPercentInt(combinationGreatSuccessBonusPercent)}%)</span>
                                    )}
                                    {!isMaxLevel && nextRate !== undefined && (
                                        <span className="text-yellow-400"> → {formatBlacksmithPercentInt(nextRate)}%</span>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default BlacksmithLevelEffectsSummary;
