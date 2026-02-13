import React, { useState } from 'react';
import { getDungeonStageScore } from '../constants';
import { TournamentType } from '../types';

/** 같은 점수인 연속 순위를 묶어서 [{ label: '1위' | '4~7위', points }] 형태로 반환 */
function groupRanksByScore(type: TournamentType, stage: number, maxRank: number): { key: string; label: string; points: number; rankStart: number }[] {
    const items: { rank: number; points: number }[] = [];
    for (let r = 1; r <= maxRank; r++) {
        items.push({ rank: r, points: getDungeonStageScore(type, stage, r) });
    }
    const groups: { key: string; label: string; points: number; rankStart: number }[] = [];
    let i = 0;
    while (i < items.length) {
        const startRank = items[i].rank;
        const points = items[i].points;
        let endRank = startRank;
        while (i + 1 < items.length && items[i + 1].points === points) {
            i++;
            endRank = items[i].rank;
        }
        const label = startRank === endRank ? `${startRank}위` : `${startRank}~${endRank}위`;
        groups.push({ key: `rank-${startRank}-${endRank}`, label, points, rankStart: startRank });
        i++;
    }
    return groups;
}

const PointsInfoPanel: React.FC = () => {
    const [selectedStage, setSelectedStage] = useState<number>(1);
    const tournamentTypes: { type: TournamentType; arena: string; title: string; maxRank: number }[] = [
        { type: 'neighborhood', arena: '동네', title: '동네바둑리그', maxRank: 6 },
        { type: 'national', arena: '전국', title: '전국바둑대회', maxRank: 8 },
        { type: 'world', arena: '세계', title: '월드챔피언십', maxRank: 15 },
    ];

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

    return (
        <div className="bg-gray-800/50 rounded-lg p-2 sm:p-3 h-full flex flex-col">
            <h3 className={`${isMobile ? 'text-xs' : 'text-base'} font-bold text-center ${isMobile ? 'mb-1.5' : 'mb-3'} flex-shrink-0`}>일일 획득 가능 점수</h3>

            <div className={`${isMobile ? 'mb-1.5' : 'mb-3'} flex-shrink-0`}>
                <label className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-300 mb-1 block`}>단계 선택</label>
                <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(Number(e.target.value))}
                    className={`bg-gray-700 border border-gray-600 ${isMobile ? 'text-[10px] p-1' : 'text-xs p-1.5'} rounded-md focus:ring-purple-500 focus:border-purple-500 w-full text-gray-200`}
                >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(stage => (
                        <option key={stage} value={stage}>{stage}단계</option>
                    ))}
                </select>
            </div>

            <div className="flex-grow overflow-y-auto pr-1 space-y-2 sm:space-y-3">
                {tournamentTypes.map(arenaData => {
                    const displayRanks = groupRanksByScore(arenaData.type, selectedStage, arenaData.maxRank);

                    return (
                        <div key={arenaData.arena} className={`bg-gray-900/50 ${isMobile ? 'p-1.5' : 'p-2'} rounded-md shadow-inner`}>
                            <h4 className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-bold text-accent ${isMobile ? 'mb-1' : 'mb-1.5'} border-b border-accent/50 ${isMobile ? 'pb-0.5' : 'pb-0.5'}`}>
                                {arenaData.title} ({selectedStage}단계)
                            </h4>
                            <div className={`grid grid-cols-2 ${isMobile ? 'gap-x-1 gap-y-0.5' : 'gap-x-2 gap-y-0.5'}`}>
                                {displayRanks.map(({ key, label, points, rankStart }) => {
                                    const rankColor = rankStart === 1 ? 'text-yellow-400' : rankStart === 2 ? 'text-gray-400' : rankStart === 3 ? 'text-amber-600' : 'text-gray-300';
                                    return (
                                        <div key={key} className={`flex justify-between items-center ${isMobile ? 'text-[9px]' : 'text-xs'}`}>
                                            <span className="font-semibold truncate">{label}</span>
                                            <span className={`font-bold ${rankColor} flex-shrink-0 ${isMobile ? 'ml-0.5' : 'ml-1'}`}>{points}점</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PointsInfoPanel;
