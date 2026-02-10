import React from 'react';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { TournamentType, TournamentState, UserWithStatus } from '../types.js';
import { TOURNAMENT_DEFINITIONS, DUNGEON_STAGE_BASE_SCORE, DUNGEON_RANK_SCORE_BONUS, DUNGEON_DEFAULT_SCORE_BONUS } from '../constants/tournaments.js';
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS } from '../constants/items.js';

interface DungeonStageSummaryModalProps {
    dungeonType: TournamentType;
    stage: number;
    tournamentState: TournamentState;
    userRank: number;
    wins: number;
    losses: number;
    baseRewards: {
        gold?: number;
        materials?: Record<string, number>;
        equipmentBoxes?: Record<string, number>;
        changeTickets?: number;
    };
    rankReward?: {
        items?: Array<{ itemId: string; quantity: number }>;
    };
    nextStageUnlocked: boolean;
    dailyScore?: number;
    previousRank?: number;
    currentRank?: number;
    onClose: () => void;
    isTopmost?: boolean;
}

const DungeonStageSummaryModal: React.FC<DungeonStageSummaryModalProps> = ({
    dungeonType,
    stage,
    tournamentState,
    userRank,
    wins,
    losses,
    baseRewards,
    rankReward,
    nextStageUnlocked,
    dailyScore,
    previousRank,
    currentRank,
    onClose,
    isTopmost
}) => {
    const tournamentName = TOURNAMENT_DEFINITIONS[dungeonType].name;
    const nextStage = stage < 10 ? stage + 1 : null;
    
    // 보상 아이템 수집 (중복 제거를 위해 Map 사용)
    const rewardItemsMap = new Map<string, { name: string; image: string; quantity: number }>();
    
    // 기본 보상 (골드)
    if (baseRewards.gold && baseRewards.gold > 0) {
        rewardItemsMap.set('gold', {
            name: `${baseRewards.gold.toLocaleString()} 골드`,
            image: '/images/icon/Gold.png',
            quantity: 1 // 골드는 이름에 이미 개수가 포함되어 있으므로 quantity는 1로 설정하여 중복 표시 방지
        });
    }
    
    // 기본 보상 (재료)
    if (baseRewards.materials) {
        for (const [materialName, quantity] of Object.entries(baseRewards.materials)) {
            const materialTemplate = MATERIAL_ITEMS[materialName];
            const existing = rewardItemsMap.get(materialName);
            if (existing) {
                existing.quantity += quantity;
            } else {
                rewardItemsMap.set(materialName, {
                    name: materialName,
                    image: materialTemplate?.image || '',
                    quantity: quantity
                });
            }
        }
    }
    
    // 기본 보상 (장비상자)
    if (baseRewards.equipmentBoxes) {
        for (const [boxName, quantity] of Object.entries(baseRewards.equipmentBoxes)) {
            const boxTemplate = CONSUMABLE_ITEMS.find(i => i.name === boxName);
            const existing = rewardItemsMap.get(boxName);
            if (existing) {
                existing.quantity += quantity;
            } else {
                rewardItemsMap.set(boxName, {
                    name: boxName,
                    image: boxTemplate?.image || '',
                    quantity: quantity
                });
            }
        }
    }
    
    // 기본 보상 (변경권)
    if (baseRewards.changeTickets && baseRewards.changeTickets > 0) {
        rewardItemsMap.set('changeTickets', {
            name: `변경권 x${baseRewards.changeTickets}`,
            image: '/images/icon/ChangeTicket.png',
            quantity: baseRewards.changeTickets
        });
    }
    
    // 순위 보상 (골드 꾸러미 등 아이템)
    if (rankReward?.items) {
        for (const item of rankReward.items) {
            // 재료 상자1 -> 재료 상자 I 변환 등 이름 매핑
            let itemName = item.itemId;
            let itemTemplate = CONSUMABLE_ITEMS.find(i => i.name === itemName);
            
            // 이름 변환 시도 (재료 상자1 -> 재료 상자 I 등)
            if (!itemTemplate) {
                const nameMappings: Record<string, string> = {
                    '재료 상자1': '재료 상자 I',
                    '재료 상자2': '재료 상자 II',
                    '재료 상자3': '재료 상자 III',
                    '재료 상자4': '재료 상자 IV',
                    '재료 상자5': '재료 상자 V',
                    '재료 상자6': '재료 상자 VI',
                    '재료상자1': '재료 상자 I',
                    '재료상자2': '재료 상자 II',
                    '재료상자3': '재료 상자 III',
                    '재료상자4': '재료 상자 IV',
                    '재료상자5': '재료 상자 V',
                    '재료상자6': '재료 상자 VI',
                };
                const mappedName = nameMappings[itemName];
                if (mappedName) {
                    itemTemplate = CONSUMABLE_ITEMS.find(i => i.name === mappedName);
                    if (itemTemplate) {
                        itemName = mappedName; // 표시 이름도 매핑된 이름으로 변경
                    }
                }
            }
            
            const existing = rewardItemsMap.get(itemName);
            if (existing) {
                existing.quantity += item.quantity;
            } else {
                rewardItemsMap.set(itemName, {
                    name: itemName,
                    image: itemTemplate?.image || '/images/Box/ResourceBox1.png', // 기본 이미지
                    quantity: item.quantity
                });
            }
        }
    }
    
    const rewardItems = Array.from(rewardItemsMap.values());
    
    return (
        <DraggableWindow 
            title={`${tournamentName} ${stage}단계 결과`} 
            onClose={onClose} 
            windowId="dungeon-stage-summary" 
            initialWidth={500} 
            closeOnOutsideClick={false} 
            isTopmost={isTopmost}
            zIndex={70}
        >
            <div className="space-y-4">
                {/* 단계 정보 */}
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2 text-yellow-300">{tournamentName} {stage}단계</h2>
                </div>
                
                {/* 전적 및 순위 (한 줄에 표시) */}
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="grid grid-cols-3 gap-4 items-center">
                        {/* 전적 */}
                        <div className="text-center">
                            <div className="text-xs text-gray-400 mb-1">전적</div>
                            <div className="flex items-center justify-center gap-2">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-400">{wins}</div>
                                    <div className="text-xs text-gray-400">승</div>
                                </div>
                                <div className="text-gray-500">-</div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-red-400">{losses}</div>
                                    <div className="text-xs text-gray-400">패</div>
                                </div>
                            </div>
                        </div>
                        
                        {/* 구분선 */}
                        <div className="h-16 w-px bg-gray-600 mx-auto"></div>
                        
                        {/* 순위 */}
                        <div className="text-center">
                            <div className="text-xs text-gray-400 mb-1">최종 순위</div>
                            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold ${
                                userRank === 1 
                                    ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg'
                                    : userRank === 2
                                        ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800 shadow-md'
                                        : userRank === 3
                                            ? 'bg-gradient-to-br from-amber-600 to-orange-600 text-white shadow-md'
                                            : 'bg-gray-600 text-gray-200'
                            }`}>
                                {userRank}
                            </div>
                            <div className="mt-1 text-xs text-gray-400">위</div>
                        </div>
                    </div>
                </div>
                
                {/* 일일 랭킹 점수 및 순위 변화 */}
                {(dailyScore !== undefined || previousRank !== undefined || currentRank !== undefined) && (
                    <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 border-2 border-blue-600/50">
                        <h3 className="text-lg font-semibold mb-3 text-center text-blue-300">일일 랭킹</h3>
                        <div className="space-y-3">
                            {dailyScore !== undefined && (
                                <div className="bg-gray-900/50 rounded-lg p-3 border border-yellow-600/30">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-gray-300 font-medium">획득 점수</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-yellow-400 font-bold text-lg">+{dailyScore.toLocaleString()}</span>
                                            <span className="text-gray-400 text-sm">점</span>
                                        </div>
                                    </div>
                                    {(() => {
                                        const baseScore = DUNGEON_STAGE_BASE_SCORE[stage] || 0;
                                        const rankBonus = DUNGEON_RANK_SCORE_BONUS[userRank] || DUNGEON_DEFAULT_SCORE_BONUS;
                                        const bonusScore = Math.round(baseScore * rankBonus);
                                        return bonusScore > 0 ? (
                                            <div className="text-xs text-gray-500 text-right">
                                                (기본 {baseScore}점 + 보너스 {bonusScore}점)
                                            </div>
                                        ) : null;
                                    })()}
                                </div>
                            )}
                            {(previousRank !== undefined || currentRank !== undefined) && (
                                <div className="bg-gray-900/50 rounded-lg p-3 border border-blue-600/30">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-300 font-medium">챔피언십 순위</span>
                                        <div className="flex items-center gap-2">
                                            {previousRank !== undefined ? (
                                                <span className="text-gray-400 font-semibold">{previousRank}위</span>
                                            ) : (
                                                <span className="text-gray-500">-</span>
                                            )}
                                            <span className="text-gray-500">→</span>
                                            {currentRank !== undefined ? (
                                                <span className={`font-bold text-lg ${
                                                    previousRank !== undefined && currentRank < previousRank
                                                        ? 'text-green-400'
                                                        : previousRank !== undefined && currentRank > previousRank
                                                            ? 'text-red-400'
                                                            : 'text-blue-300'
                                                }`}>
                                                    {currentRank}위
                                                </span>
                                            ) : (
                                                <span className="text-gray-500">-</span>
                                            )}
                                            {previousRank !== undefined && currentRank !== undefined && currentRank !== previousRank && (
                                                <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
                                                    currentRank < previousRank
                                                        ? 'text-green-300 bg-green-900/30'
                                                        : 'text-red-300 bg-red-900/30'
                                                }`}>
                                                    {currentRank < previousRank ? '▲' : '▼'} {Math.abs(previousRank - currentRank)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {/* 보상 내역 */}
                {rewardItems.length > 0 && (
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                        <h3 className="text-lg font-semibold mb-3 text-center text-gray-200">보상 내역</h3>
                        <div className="grid grid-cols-4 gap-2">
                            {rewardItems.map((item, index) => (
                                <div key={index} className="relative flex flex-col items-center justify-center p-2 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-yellow-500/50 transition-colors">
                                    <img 
                                        src={item.image} 
                                        alt={item.name} 
                                        className="w-12 h-12 object-contain mb-1" 
                                    />
                                    <span className="text-xs text-gray-300 text-center break-words">
                                        {item.name}
                                    </span>
                                    {item.quantity > 1 && item.name !== 'gold' && !item.name.includes('골드') && (
                                        <span className="absolute -bottom-0.5 -right-0.5 text-[10px] font-bold text-yellow-200 bg-black/70 px-1 rounded-tl-md">
                                            {item.quantity}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* 다음 단계 언락 여부 */}
                {nextStage && (
                    <div className={`rounded-lg p-4 border-2 ${
                        nextStageUnlocked 
                            ? 'bg-green-900/30 border-green-600/50' 
                            : 'bg-gray-800/50 border-gray-700'
                    }`}>
                        <div className="text-center">
                            <h3 className={`text-lg font-semibold mb-2 ${
                                nextStageUnlocked ? 'text-green-300' : 'text-gray-400'
                            }`}>
                                {nextStage}단계 {nextStageUnlocked ? '열림' : '잠김'}
                            </h3>
                            <p className={`text-sm ${
                                nextStageUnlocked 
                                    ? 'text-green-200' 
                                    : 'text-gray-500'
                            }`}>
                                {nextStageUnlocked 
                                    ? `다음 단계가 열렸습니다.`
                                    : '3위 이상 달성 시 다음 단계가 열립니다.'}
                            </p>
                        </div>
                    </div>
                )}
                
                {/* 확인 버튼 */}
                <Button onClick={onClose} className="w-full py-2.5">
                    확인
                </Button>
            </div>
        </DraggableWindow>
    );
};

export default DungeonStageSummaryModal;
