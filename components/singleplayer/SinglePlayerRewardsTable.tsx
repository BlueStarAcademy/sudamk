import React, { useMemo, useState } from 'react';
import { SINGLE_PLAYER_STAGES } from '../../constants/singlePlayerConstants.js';
import { SinglePlayerLevel } from '../../types.js';
import { formatSinglePlayerRewardCell } from '../../utils/singlePlayerRewardDisplay.js';

const CLASS_TABS: { level: SinglePlayerLevel; label: string }[] = [
    { level: SinglePlayerLevel.입문, label: '입문반' },
    { level: SinglePlayerLevel.초급, label: '초급반' },
    { level: SinglePlayerLevel.중급, label: '중급반' },
    { level: SinglePlayerLevel.고급, label: '고급반' },
    { level: SinglePlayerLevel.유단자, label: '유단자' },
];

export interface SinglePlayerRewardsTableProps {
    /** 첫 마운트 시 선택할 반 (모달을 열 때마다 언마운트되면 이 값으로 탭이 시작됨) */
    initialClassWhenModalOpens?: SinglePlayerLevel;
}

/**
 * 싱글플레이 스테이지의 최초 클리어 / 재도전 클리어 보상 표 (반별 탭).
 * 데이터 원본: `constants/singlePlayerConstants.ts` · `shared/constants/singlePlayerConstants.ts` 의 `rewards`.
 */
const SinglePlayerRewardsTable: React.FC<SinglePlayerRewardsTableProps> = ({
    initialClassWhenModalOpens,
}) => {
    const [activeLevel, setActiveLevel] = useState<SinglePlayerLevel>(
        initialClassWhenModalOpens ?? SinglePlayerLevel.입문
    );

    const stagesForTab = useMemo(() => {
        return SINGLE_PLAYER_STAGES.filter((s) => s.level === activeLevel).sort((a, b) => {
            const aNum = parseInt(a.id.split('-')[1], 10);
            const bNum = parseInt(b.id.split('-')[1], 10);
            return aNum - bNum;
        });
    }, [activeLevel]);

    return (
        <div className="flex flex-col gap-2 min-h-0">
            <div
                className="flex flex-wrap gap-1 sm:gap-1.5 border-b border-gray-600 pb-2"
                role="tablist"
                aria-label="단계별 보상"
            >
                {CLASS_TABS.map(({ level, label }) => {
                    const selected = activeLevel === level;
                    return (
                        <button
                            key={level}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => setActiveLevel(level)}
                            className={`
                                rounded-md px-2 py-1.5 text-[11px] sm:text-xs font-semibold transition-colors
                                border
                                ${
                                    selected
                                        ? 'border-amber-500/80 bg-amber-900/50 text-amber-100 shadow-sm'
                                        : 'border-gray-600/80 bg-gray-800/60 text-gray-300 hover:bg-gray-700/60 hover:text-gray-100'
                                }
                            `}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            <div className="rounded-md border border-gray-600 overflow-hidden bg-gray-900/80 min-h-0 flex flex-col">
                <div className="overflow-auto max-h-[min(52vh,420px)]">
                    <table className="w-full text-left text-[11px] sm:text-xs border-collapse">
                        <thead className="sticky top-0 z-[1]">
                            <tr className="bg-gray-800 text-amber-200/95 border-b border-gray-600">
                                <th className="px-2 py-2 font-semibold whitespace-nowrap border-r border-gray-600">
                                    스테이지 ID
                                </th>
                                <th className="px-2 py-2 font-semibold min-w-[140px] border-r border-gray-600">
                                    최초 클리어
                                </th>
                                <th className="px-2 py-2 font-semibold min-w-[120px]">재도전 클리어</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-200">
                            {stagesForTab.map((stage) => {
                                const fc = formatSinglePlayerRewardCell(stage.rewards?.firstClear);
                                const rc = formatSinglePlayerRewardCell(stage.rewards?.repeatClear);
                                return (
                                    <tr
                                        key={stage.id}
                                        className="border-b border-gray-700/80 odd:bg-gray-800/40 hover:bg-gray-700/30"
                                    >
                                        <td className="px-2 py-1.5 align-top font-mono text-amber-100/90 border-r border-gray-700/80 whitespace-nowrap">
                                            {stage.id}
                                        </td>
                                        <td className="px-2 py-1.5 align-top text-emerald-200/90 border-r border-gray-700/80 leading-snug">
                                            {fc}
                                        </td>
                                        <td className="px-2 py-1.5 align-top text-sky-200/85 leading-snug">{rc}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SinglePlayerRewardsTable;
