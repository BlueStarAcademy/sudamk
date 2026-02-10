
import React, { useState, useEffect } from 'react';
import type { GuildBossBattleResult as GuildBossBattleResultType } from '../../types/index.js';
import { ItemGrade } from '../../types/enums.js';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { gradeBackgrounds, slotNames } from '../../constants/items.js';

interface GuildBossBattleResultModalProps {
    result: GuildBossBattleResultType & { bossName: string; previousRank?: number; currentRank?: number };
    onClose: () => void;
    isTopmost?: boolean;
}

interface RewardCard {
    type: 'guildXp' | 'guildCoins' | 'researchPoints' | 'gold' | 'material' | 'ticket' | 'equipment';
    name: string;
    quantity?: number;
    image: string;
    grade?: ItemGrade;
    isSpecial?: boolean; // 5등급 보상 또는 전설 이상 장비
    equipment?: {
        slot?: string;
        fullName?: string;
    };
}

const GuildBossBattleResultModal: React.FC<GuildBossBattleResultModalProps> = ({ result, onClose, isTopmost }) => {
    const [cardsFlipped, setCardsFlipped] = useState(false);
    const [rewardCards, setRewardCards] = useState<RewardCard[]>([]);
    
    const hpPercentAfter = (result.bossHpAfter / result.bossMaxHp) * 100;
    const rewards = result.rewards;
    const tier = rewards.tier;
    const isTier5 = tier === 5;
    
    useEffect(() => {
        // 보상 카드 배열 생성
        const cards: RewardCard[] = [];
        
        // 길드 경험치
        cards.push({
            type: 'guildXp',
            name: '길드 경험치',
            quantity: rewards.guildXp,
            image: '', // 이미지 사용 안 함
            isSpecial: isTier5,
        });
        
        // 길드 코인
        cards.push({
            type: 'guildCoins',
            name: '길드 코인',
            quantity: rewards.guildCoins,
            image: '/images/guild/tokken.png',
            isSpecial: isTier5,
        });
        
        // 연구소 포인트
        cards.push({
            type: 'researchPoints',
            name: '연구소 포인트',
            quantity: rewards.researchPoints,
            image: '/images/guild/button/guildlab.png',
            isSpecial: isTier5,
        });
        
        // 골드
        cards.push({
            type: 'gold',
            name: '골드',
            quantity: rewards.gold,
            image: '/images/icon/Gold.png',
            isSpecial: isTier5,
        });
        
        // 강화재료
        cards.push({
            type: 'material',
            name: rewards.materials.name,
            quantity: rewards.materials.quantity,
            image: MATERIAL_IMAGES[rewards.materials.name] || '/images/materials/materials1.png',
            isSpecial: isTier5,
        });
        
        // 변경권
        rewards.tickets.forEach(ticket => {
            cards.push({
                type: 'ticket',
                name: ticket.name,
                quantity: ticket.quantity,
                image: TICKET_IMAGES[ticket.name] || '/images/use/change1.png',
                isSpecial: isTier5,
            });
        });
        
        // 장비
        if (rewards.equipment) {
            // 서버에서 전달된 전체 장비 객체 사용 (item 필드)
            const equipmentItem = (rewards.equipment as any).item;
            
            // grade가 문자열일 수 있으므로 정규화
            const equipmentGrade = equipmentItem?.grade 
                ? (typeof equipmentItem.grade === 'string' ? equipmentItem.grade as ItemGrade : equipmentItem.grade)
                : (typeof rewards.equipment.grade === 'string' 
                ? (rewards.equipment.grade as ItemGrade)
                    : rewards.equipment.grade);
            const isLegendaryOrMythic = equipmentGrade === ItemGrade.Legendary || equipmentGrade === ItemGrade.Mythic;
            
            // 실제 장비 객체가 있으면 그 정보 사용, 없으면 기존 정보 사용
            const equipmentName = equipmentItem?.name || rewards.equipment.name;
            const equipmentImage = equipmentItem?.image || rewards.equipment.image;
            const equipmentSlot = equipmentItem?.slot || rewards.equipment.slot;
            
            if (!equipmentName) {
                console.warn('[GuildBossBattleResultModal] Equipment name is missing:', {
                    equipment: rewards.equipment,
                    hasItem: !!equipmentItem,
                    hasName: !!equipmentName,
                    hasImage: !!equipmentImage,
                    hasSlot: !!equipmentSlot,
                    grade: equipmentGrade,
                    equipmentKeys: Object.keys(rewards.equipment)
                });
            }
            
            // 장비 이름이 없으면 fallback 사용 (하지만 서버에서 항상 제공해야 함)
            const displayName = equipmentName || `${equipmentGrade} 등급 장비`;
            
            cards.push({
                type: 'equipment',
                name: displayName,
                image: equipmentImage || gradeBackgrounds[equipmentGrade] || '/images/equipments/normalbgi.png',
                grade: equipmentGrade,
                isSpecial: isLegendaryOrMythic,
                equipment: {
                    slot: equipmentSlot ? slotNames[equipmentSlot] : undefined,
                    fullName: equipmentName || displayName, // fullName도 실제 이름 사용
                    // 실제 장비 객체 저장 (모달에서 상세 정보 표시용)
                    item: equipmentItem,
                },
            });
        }
        
        setRewardCards(cards);
        
        // 카드 뒤집기 애니메이션 시작
        setTimeout(() => {
            setCardsFlipped(true);
        }, 300);
    }, []);
    
    const MATERIAL_IMAGES: Record<string, string> = {
        '하급 강화석': '/images/materials/materials1.png',
        '중급 강화석': '/images/materials/materials2.png',
        '상급 강화석': '/images/materials/materials3.png',
        '최상급 강화석': '/images/materials/materials4.png',
        '신비의 강화석': '/images/materials/materials5.png',
    };
    
    const TICKET_IMAGES: Record<string, string> = {
        '옵션 종류 변경권': '/images/use/change1.png',
        '옵션 수치 변경권': '/images/use/change2.png',
        '신화 옵션 변경권': '/images/use/change3.png',
    };
    
    const getTierColor = (tier: number) => {
        switch (tier) {
            case 1: return 'from-gray-500 to-gray-600';
            case 2: return 'from-green-500 to-green-600';
            case 3: return 'from-blue-500 to-blue-600';
            case 4: return 'from-purple-500 to-purple-600';
            case 5: return 'from-yellow-400 via-orange-500 to-red-500';
            default: return 'from-gray-500 to-gray-600';
        }
    };
    
    const getTierName = (tier: number) => {
        switch (tier) {
            case 1: return '1등급';
            case 2: return '2등급';
            case 3: return '3등급';
            case 4: return '4등급';
            case 5: return '5등급';
            default: return '1등급';
        }
    };
    
    return (
        <DraggableWindow title="전투 결과" onClose={onClose} windowId="guild-boss-battle-result" initialWidth={600} initialHeight={700} isTopmost={isTopmost}>
            <div className="flex flex-col h-full min-h-0">
                <div className="text-center mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold mb-2">{result.bossName} 전투 결과</h2>
                    <div className="flex items-center justify-center gap-3">
                        <div className={`px-4 py-1 rounded-full bg-gradient-to-r ${getTierColor(tier)} text-white font-bold text-lg shadow-lg`}>
                            {getTierName(tier)}
                        </div>
                        <span className="text-gray-300">총 피해량: <span className="font-bold text-yellow-300">{result.damageDealt.toLocaleString()}</span></span>
                    </div>
                </div>
                
                <div className="mb-4 overflow-y-auto flex-1 min-h-0 pr-1">
                    <div className="grid grid-cols-4 gap-2">
                        {rewardCards.map((card, index) => (
                            <div
                                key={index}
                                className={`relative h-24 perspective-1000 ${card.isSpecial ? 'z-10' : ''}`}
                                style={{
                                    animationDelay: `${index * 100}ms`,
                                }}
                            >
                                <div
                                    className={`relative w-full h-full transition-transform duration-700 transform-style-preserve-3d ${
                                        cardsFlipped ? 'rotate-y-180' : ''
                                    } ${card.isSpecial ? 'scale-110' : ''}`}
                                    style={{
                                        transformStyle: 'preserve-3d',
                                    }}
                                >
                                    {/* 카드 뒷면 (물음표) */}
                                    <div
                                        className={`absolute inset-0 backface-hidden rounded-lg border-2 ${
                                            card.isSpecial
                                                ? 'bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 border-yellow-300 shadow-[0_0_20px_rgba(255,215,0,0.8)]'
                                                : 'bg-gradient-to-br from-indigo-600 to-purple-700 border-indigo-400'
                                        } flex items-center justify-center shadow-lg`}
                                        style={{
                                            transform: 'rotateY(0deg)',
                                            backfaceVisibility: 'hidden',
                                        }}
                                    >
                                        <span className="text-3xl font-bold text-white/80">?</span>
                                    </div>
                                    
                                    {/* 카드 앞면 (보상) */}
                                    <div
                                        className={`absolute inset-0 backface-hidden rounded-lg border-2 ${
                                            card.isSpecial
                                                ? 'bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 border-yellow-300 shadow-[0_0_20px_rgba(255,215,0,0.8)] animate-pulse'
                                                : 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-600'
                                        } flex flex-col items-center justify-center p-1 shadow-lg`}
                                        style={{
                                            transform: 'rotateY(180deg)',
                                            backfaceVisibility: 'hidden',
                                        }}
                                    >
                                        {/* 길드 경험치는 EXP 텍스트 디자인으로 표시 */}
                                        {card.type === 'guildXp' ? (
                                            <div className="flex flex-col items-center justify-center w-full">
                                                <div className={`text-xl font-black ${card.isSpecial ? 'text-yellow-200' : 'text-blue-400'}`} style={{
                                                    textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(59,130,246,0.5)',
                                                    letterSpacing: '3px',
                                                }}>
                                                    EXP
                                                </div>
                                                {card.quantity !== undefined && (
                                                    <div className={`text-[10px] font-bold mt-0.5 ${card.isSpecial ? 'text-yellow-200' : 'text-blue-300'}`}>
                                                        {card.quantity.toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        ) : card.type === 'equipment' ? (
                                            <>
                                                <img
                                                    src={card.image}
                                                    alt={card.name}
                                                    className={`w-8 h-8 object-contain mb-1 ${card.isSpecial ? 'drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]' : ''}`}
                                                />
                                                <div className="text-center w-full px-0.5">
                                                    <div className={`text-[9px] font-semibold mb-0.5 leading-tight ${card.isSpecial ? 'text-yellow-100' : 'text-white'}`}>
                                                        {/* 장비 이름 우선순위: equipment.fullName > card.name (실제 장비 이름 표시) */}
                                                        {card.equipment?.fullName || card.name}
                                                    </div>
                                                    {card.equipment?.slot && (
                                                        <div className={`text-[8px] ${card.isSpecial ? 'text-yellow-200/80' : 'text-gray-300'}`}>
                                                            {card.equipment.slot}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <img
                                                    src={card.image}
                                                    alt={card.name}
                                                    className={`w-8 h-8 object-contain mb-1 ${card.isSpecial ? 'drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]' : ''}`}
                                                />
                                                <div className="text-center">
                                                    <div className={`text-[10px] font-semibold mb-0.5 leading-tight ${card.isSpecial ? 'text-yellow-100' : 'text-white'}`}>
                                                        {card.name}
                                                    </div>
                                                    {card.quantity !== undefined && (
                                                        <div className={`text-[11px] font-bold ${card.isSpecial ? 'text-yellow-200' : 'text-gray-200'}`}>
                                                            {card.quantity.toLocaleString()}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                        {card.isSpecial && (
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center animate-bounce">
                                                <span className="text-[8px]">⭐</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="space-y-2 bg-gray-900/50 p-4 rounded-lg text-sm flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-300">생존 턴:</span>
                        <span className="font-bold text-white">{result.turnsSurvived} 턴</span>
                    </div>
                    <div className="pt-2 border-t border-gray-700">
                        <p className="text-xs text-gray-300 mb-1">보스 남은 체력 ({hpPercentAfter.toFixed(1)}%)</p>
                        <div className="w-full bg-tertiary rounded-full h-3 border-2 border-color relative">
                            <div className="bg-gradient-to-r from-red-500 to-red-700 h-full rounded-full" style={{ width: `${hpPercentAfter}%` }}></div>
                            <span className="absolute inset-0 text-xs font-bold text-white flex items-center justify-center" style={{textShadow: '1px 1px 2px black'}}>
                                {result.bossHpAfter.toLocaleString()} / {result.bossMaxHp.toLocaleString()}
                            </span>
                        </div>
                    </div>
                    {result.previousRank !== undefined && result.currentRank !== undefined && (
                        <div className="pt-2 border-t border-gray-700">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-300">순위:</span>
                                <div className="flex items-center gap-2">
                                    {result.previousRank && (
                                        <span className="text-gray-400 text-xs">이전: {result.previousRank}위</span>
                                    )}
                                    <span className="font-bold text-yellow-300">
                                        {result.currentRank ? `${result.currentRank}위` : '-'}
                                    </span>
                                    {result.previousRank && result.currentRank && result.previousRank !== result.currentRank && (
                                        <span className={`text-xs font-semibold ${result.currentRank < result.previousRank ? 'text-green-400' : 'text-red-400'}`}>
                                            ({result.currentRank < result.previousRank ? '↑' : '↓'} {Math.abs(result.currentRank - result.previousRank)})
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="flex-shrink-0 mt-4">
                    <Button onClick={onClose} className="w-auto mx-auto py-2 px-8">확인</Button>
                </div>
            </div>
            
            <style>{`
                .perspective-1000 {
                    perspective: 1000px;
                }
                .transform-style-preserve-3d {
                    transform-style: preserve-3d;
                }
                .backface-hidden {
                    backface-visibility: hidden;
                }
                .rotate-y-180 {
                    transform: rotateY(180deg);
                }
            `}</style>
        </DraggableWindow>
    );
};

export default GuildBossBattleResultModal;
