import React from 'react';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { TournamentType, TournamentState } from '../types.js';
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

    const rewardItemsMap = new Map<string, { name: string; image: string; quantity: number }>();

    if (baseRewards.gold && baseRewards.gold > 0) {
        rewardItemsMap.set('gold', {
            name: `${baseRewards.gold.toLocaleString()} 골드`,
            image: '/images/icon/Gold.png',
            quantity: 1
        });
    }
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
    if (baseRewards.changeTickets && baseRewards.changeTickets > 0) {
        rewardItemsMap.set('changeTickets', {
            name: `변경권 x${baseRewards.changeTickets}`,
            image: '/images/icon/ChangeTicket.png',
            quantity: baseRewards.changeTickets
        });
    }
    if (rankReward?.items) {
        for (const item of rankReward.items) {
            let itemName = item.itemId;
            let itemTemplate = CONSUMABLE_ITEMS.find(i => i.name === itemName);
            if (!itemTemplate) {
                const nameMappings: Record<string, string> = {
                    '재료 상자1': '재료 상자 I', '재료 상자2': '재료 상자 II', '재료 상자3': '재료 상자 III',
                    '재료 상자4': '재료 상자 IV', '재료 상자5': '재료 상자 V', '재료 상자6': '재료 상자 VI',
                    '재료상자1': '재료 상자 I', '재료상자2': '재료 상자 II', '재료상자3': '재료 상자 III',
                    '재료상자4': '재료 상자 IV', '재료상자5': '재료 상자 V', '재료상자6': '재료 상자 VI',
                };
                const mappedName = nameMappings[itemName];
                if (mappedName) {
                    itemTemplate = CONSUMABLE_ITEMS.find(i => i.name === mappedName);
                    if (itemTemplate) itemName = mappedName;
                }
            }
            const existing = rewardItemsMap.get(itemName);
            if (existing) {
                existing.quantity += item.quantity;
            } else {
                rewardItemsMap.set(itemName, {
                    name: itemName,
                    image: itemTemplate?.image || '/images/Box/ResourceBox1.png',
                    quantity: item.quantity
                });
            }
        }
    }
    const rewardItems = Array.from(rewardItemsMap.values());

    const baseScore = DUNGEON_STAGE_BASE_SCORE[stage] || 0;
    const rankBonus = DUNGEON_RANK_SCORE_BONUS[userRank] || DUNGEON_DEFAULT_SCORE_BONUS;
    const bonusScore = Math.round(baseScore * rankBonus);

    return (
        <DraggableWindow
            title={`${tournamentName} ${stage}단계 결과`}
            onClose={onClose}
            windowId="dungeon-stage-summary"
            initialWidth={700}
            initialHeight={620}
            closeOnOutsideClick={false}
            isTopmost={isTopmost}
            zIndex={70}
        >
            <div className="flex flex-col h-full min-h-0">
                <div className="flex-shrink-0 text-center py-1.5 border-b border-gray-600/70">
                    <h2 className="text-base font-bold text-amber-200">{tournamentName} {stage}단계</h2>
                </div>

                {/* 3개 박스: 1행에 박스1·2, 2행에 박스3. 내부 스크롤 없이 모두 표시 */}
                <div className="flex-1 flex flex-col gap-3 p-3 min-h-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-shrink-0">
                        {/* 박스 1: 이번 대회 전적 + 순위 + 획득 점수 */}
                        <div className="rounded-xl bg-gray-800/95 border border-gray-600/60 p-3 flex flex-col gap-2">
                            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-600/50 pb-1.5">
                                이번 대회 결과
                            </h3>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500 text-xs">전적</span>
                                    <span className="text-emerald-400 font-bold tabular-nums">{wins}</span>
                                    <span className="text-gray-500">승</span>
                                    <span className="text-gray-600">-</span>
                                    <span className="text-rose-400 font-bold tabular-nums">{losses}</span>
                                    <span className="text-gray-500">패</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500 text-xs">순위</span>
                                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                        userRank === 1 ? 'bg-gradient-to-br from-yellow-400 to-amber-600 text-black' :
                                        userRank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-800' :
                                        userRank === 3 ? 'bg-gradient-to-br from-amber-700 to-amber-900 text-amber-100' :
                                        'bg-gray-600 text-gray-200'
                                    }`}>
                                        {userRank}
                                    </div>
                                    <span className="text-gray-400 text-xs">위</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500 text-xs">획득 점수</span>
                                <span className="text-amber-300 font-bold tabular-nums">
                                    {dailyScore !== undefined ? `+${dailyScore.toLocaleString()}점` : '-'}
                                </span>
                            </div>
                            {nextStage !== null && (
                                <div className={`rounded-lg px-2 py-1 text-xs flex items-center justify-between ${
                                    nextStageUnlocked ? 'bg-emerald-900/30 text-emerald-200' : 'bg-gray-700/50 text-gray-500'
                                }`}>
                                    <span>{nextStage}단계</span>
                                    <span>{nextStageUnlocked ? '열림' : '잠김 (3위 이상 시 열림)'}</span>
                                </div>
                            )}
                        </div>

                        {/* 박스 2: 현재 단계 누적 전적 */}
                        <div className="rounded-xl bg-gray-800/95 border border-gray-600/60 p-3 flex flex-col justify-center">
                            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-600/50 pb-1.5 mb-2">
                                현재 단계 누적 전적
                            </h3>
                            <div className="flex items-center justify-center gap-6 py-1">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-emerald-400 tabular-nums">{wins}</div>
                                    <div className="text-[10px] text-gray-500">승</div>
                                </div>
                                <div className="w-px h-10 bg-gray-600" />
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-rose-400 tabular-nums">{losses}</div>
                                    <div className="text-[10px] text-gray-500">패</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 박스 3: 보상 내역 */}
                    <div className="rounded-xl bg-gray-800/95 border border-gray-600/60 p-3 flex flex-col flex-1 min-h-[160px]">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-600/50 pb-1.5 mb-2 flex-shrink-0">
                            보상 내역
                        </h3>
                        {rewardItems.length > 0 ? (
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 content-start">
                                {rewardItems.map((item, index) => (
                                    <div
                                        key={index}
                                        className="flex flex-col items-center justify-center p-2 rounded-lg bg-gray-900/60 border border-gray-700/80"
                                    >
                                        <img src={item.image} alt={item.name} className="w-8 h-8 object-contain" />
                                        <span className="text-[10px] text-gray-300 text-center truncate w-full mt-1">{item.name}</span>
                                        {item.quantity > 1 && (
                                            <span className="text-[10px] font-bold text-amber-200">x{item.quantity}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm py-2">보상 없음</p>
                        )}
                    </div>
                </div>

                <div className="flex-shrink-0 p-2 border-t border-gray-600/70">
                    <Button onClick={onClose} className="w-full py-2 text-sm font-medium">
                        확인
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default DungeonStageSummaryModal;
