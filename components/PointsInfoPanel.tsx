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

/** nativeEmbedded: 네이티브 챔피언십 상단 열에 삽입, 하단 탭과 동일 계열 이상의 글자 크기(최소 10~11px) */
const PointsInfoPanel: React.FC<{
    variant?: 'default' | 'nativeEmbedded';
    /** 챔피언십 로비 배경 위: 반투명 + 뒤쪽 블러 */
    lobbyGlass?: boolean;
}> = ({ variant = 'default', lobbyGlass = false }) => {
    const [selectedStage, setSelectedStage] = useState<number>(1);
    const tournamentTypes: { type: TournamentType; arena: string; title: string; maxRank: number }[] = [
        { type: 'neighborhood', arena: '동네', title: '동네바둑리그', maxRank: 6 },
        { type: 'national', arena: '전국', title: '전국바둑대회', maxRank: 8 },
        { type: 'world', arena: '세계', title: '월드챔피언십', maxRank: 15 },
    ];

    const embedded = variant === 'nativeEmbedded';
    const surfaceClass = lobbyGlass
        ? 'border border-color/45 bg-gray-900/42 backdrop-blur-xl backdrop-saturate-150 [transform:translateZ(0)]'
        : 'bg-gray-800/50';

    return (
        <div className={`flex h-full min-h-0 flex-col rounded-lg ${surfaceClass} ${embedded ? 'p-1.5' : 'p-2 sm:p-3'}`}>
            <h3 className={`flex-shrink-0 text-center font-bold text-gray-100 ${embedded ? 'mb-1.5 text-sm' : 'mb-3 text-base'}`}>일일 획득 가능 점수</h3>

            <div className={`flex-shrink-0 ${embedded ? 'mb-1.5' : 'mb-3'}`}>
                <label className={`mb-1 block text-gray-300 ${embedded ? 'text-xs' : 'text-xs'}`}>단계 선택</label>
                <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(Number(e.target.value))}
                    className={`w-full rounded-md border border-gray-600 bg-gray-700 text-gray-200 focus:border-purple-500 focus:ring-purple-500 ${embedded ? 'p-1.5 text-xs' : 'p-1.5 text-xs'}`}
                >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(stage => (
                        <option key={stage} value={stage}>{stage}단계</option>
                    ))}
                </select>
            </div>

            <div className={`min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5 sm:space-y-3 ${embedded ? '' : ''}`}>
                {tournamentTypes.map(arenaData => {
                    const displayRanks = groupRanksByScore(arenaData.type, selectedStage, arenaData.maxRank);

                    return (
                        <div key={arenaData.arena} className={`rounded-md bg-gray-900/50 shadow-inner ${embedded ? 'p-1.5' : 'p-2'}`}>
                            <h4 className={`font-bold text-accent ${embedded ? 'mb-1 border-b border-accent/50 pb-0.5 text-xs' : 'mb-1.5 border-b border-accent/50 pb-0.5 text-sm'}`}>
                                {arenaData.title} ({selectedStage}단계)
                            </h4>
                            <div className={`grid grid-cols-2 ${embedded ? 'gap-x-1 gap-y-0.5' : 'gap-x-2 gap-y-0.5'}`}>
                                {displayRanks.map(({ key, label, points, rankStart }) => {
                                    const rankColor = rankStart === 1 ? 'text-yellow-400' : rankStart === 2 ? 'text-gray-400' : rankStart === 3 ? 'text-amber-600' : 'text-gray-300';
                                    return (
                                        <div key={key} className={`flex items-center justify-between ${embedded ? 'text-[11px] leading-tight' : 'text-xs'}`}>
                                            <span className="truncate font-semibold">{label}</span>
                                            <span className={`flex-shrink-0 font-bold ${rankColor} ${embedded ? 'ml-0.5' : 'ml-1'}`}>{points}점</span>
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
