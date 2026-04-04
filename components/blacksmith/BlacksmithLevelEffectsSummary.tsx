import React from 'react';
import {
    BLACKSMITH_MAX_LEVEL,
    BLACKSMITH_COMBINABLE_GRADES_BY_LEVEL,
    BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES,
    BLACKSMITH_DISASSEMBLY_JACKPOT_RATES,
} from '../../constants/rules.js';
import { ItemGrade } from '../../types/enums.js';

const GRADE_ORDER: ItemGrade[] = [
    ItemGrade.Normal,
    ItemGrade.Uncommon,
    ItemGrade.Rare,
    ItemGrade.Epic,
    ItemGrade.Legendary,
    ItemGrade.Mythic,
    ItemGrade.Transcendent,
];

const GRADE_NAMES_KO: Record<ItemGrade, string> = {
    normal: '일반',
    uncommon: '고급',
    rare: '희귀',
    epic: '에픽',
    legendary: '전설',
    mythic: '신화',
    transcendent: '초월',
};

export interface BlacksmithLevelEffectsSummaryProps {
    blacksmithLevel: number;
    className?: string;
}

/** 대장간 레벨별 수치 효과 (합성 등급, 대박·대성공 확률 등) */
const BlacksmithLevelEffectsSummary: React.FC<BlacksmithLevelEffectsSummaryProps> = ({
    blacksmithLevel,
    className = '',
}) => {
    const currentLevel = blacksmithLevel ?? 1;
    const isMaxLevel = currentLevel >= BLACKSMITH_MAX_LEVEL;
    const currentLevelIndex = currentLevel - 1;
    const nextLevelIndex = isMaxLevel ? currentLevelIndex : currentLevel;

    return (
        <div className={`text-left ${className}`}>
            <div className="mb-2 flex justify-between border-b border-gray-600 px-2 pb-1 text-sm font-bold text-gray-400">
                <span>효과</span>
                <span>
                    Lv.{currentLevel}
                    {!isMaxLevel && <span className="text-yellow-400"> → Lv.{currentLevel + 1}</span>}
                </span>
            </div>
            <div className="space-y-2 text-sm text-secondary">
                <div className="rounded-md bg-black/20 p-2">
                    <div className="flex justify-between">
                        <span>합성 가능 최대등급</span>
                        <span>
                            {GRADE_NAMES_KO[BLACKSMITH_COMBINABLE_GRADES_BY_LEVEL[currentLevelIndex]]}
                            {!isMaxLevel && (
                                <span className="text-yellow-400">
                                    {' '}
                                    → {GRADE_NAMES_KO[BLACKSMITH_COMBINABLE_GRADES_BY_LEVEL[nextLevelIndex]]}
                                </span>
                            )}
                        </span>
                    </div>
                </div>
                <div className="rounded-md bg-black/20 p-2">
                    <div className="flex justify-between">
                        <span>장비 분해 대박 확률</span>
                        <span>
                            {BLACKSMITH_DISASSEMBLY_JACKPOT_RATES[currentLevelIndex]}%
                            {!isMaxLevel && (
                                <span className="text-yellow-400"> → {BLACKSMITH_DISASSEMBLY_JACKPOT_RATES[nextLevelIndex]}%</span>
                            )}
                        </span>
                    </div>
                </div>
                <div className="rounded-md bg-black/20 p-2">
                    <div className="flex justify-between">
                        <span>재료 분해/합성 대박 확률</span>
                        <span>
                            {BLACKSMITH_DISASSEMBLY_JACKPOT_RATES[currentLevelIndex]}%
                            {!isMaxLevel && (
                                <span className="text-yellow-400"> → {BLACKSMITH_DISASSEMBLY_JACKPOT_RATES[nextLevelIndex]}%</span>
                            )}
                        </span>
                    </div>
                </div>
                <div className="rounded-md bg-black/20 p-2">
                    <p className="font-semibold">장비합성 대성공 확률:</p>
                    {GRADE_ORDER.slice(0, -1).map((grade, index) => {
                        const rateKey = grade as Exclude<ItemGrade, ItemGrade.Transcendent>;
                        const rate = BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES[currentLevelIndex]?.[rateKey] ?? 0;
                        const nextRate = BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES[nextLevelIndex]?.[rateKey];
                        const nextGrade = GRADE_ORDER[index + 1];
                        const currentGradeName = GRADE_NAMES_KO[grade];
                        const nextGradeName = GRADE_NAMES_KO[nextGrade];

                        return (
                            <div key={grade} className="flex justify-between pl-2">
                                <span>
                                    {currentGradeName} → {nextGradeName}
                                </span>
                                <span>
                                    {rate}%
                                    {!isMaxLevel && nextRate !== undefined && (
                                        <span className="text-yellow-400"> → {nextRate}%</span>
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
