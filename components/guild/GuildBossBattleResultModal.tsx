
import React, { useState, useEffect } from 'react';
import type { GuildBossBattleResult as GuildBossBattleResultType } from '../../types/index.js';
import { ItemGrade } from '../../types/enums.js';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { PRE_GAME_MODAL_ACCENT_BTN_CLASS } from '../game/PreGameDescriptionLayout.js';
import { gradeBackgrounds, EQUIPMENT_POOL } from '../../constants/items.js';
import { GUILD_BOSS_GRADE_NAMES } from '../../constants/index.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { isRewardVipActive } from '../../shared/utils/rewardVip.js';
import type { User } from '../../types/index.js';
import { ResultModalVipRewardSlot } from '../game/ResultModalVipRewardSlot.js';

interface GuildBossBattleResultModalProps {
    result: GuildBossBattleResultType & { bossName: string; previousRank?: number; currentRank?: number };
    onClose: () => void;
    isTopmost?: boolean;
}

interface RewardCard {
    type: 'guildXp' | 'guildCoins' | 'researchPoints' | 'gold' | 'material' | 'ticket' | 'equipment' | 'materialBox';
    name: string;
    quantity?: number;
    image: string;
    grade?: ItemGrade;
    isSpecial?: boolean; // 5등급 보상 또는 전설 이상 장비
    equipment?: {
        fullName?: string;
        item?: { name?: string; image?: string; slot?: string; grade?: ItemGrade };
    };
}

/** 카드 앞면 내용 — 3D 플립 후에는 동일 UI를 2D로만 그려 텍스트·아이콘 선명도 유지 */
const RewardCardFrontContent: React.FC<{ card: RewardCard }> = ({ card }) => (
    <>
        {card.type === 'guildXp' ? (
            <div className="flex w-full flex-col items-center justify-center">
                <div
                    className={`text-xl font-black ${card.isSpecial ? 'text-yellow-200' : 'text-blue-400'}`}
                    style={{
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(59,130,246,0.5)',
                        letterSpacing: '3px',
                    }}
                >
                    EXP
                </div>
                {card.quantity !== undefined && (
                    <div className={`mt-0.5 text-[10px] font-bold ${card.isSpecial ? 'text-yellow-200' : 'text-blue-300'}`}>
                        {card.quantity.toLocaleString()}
                    </div>
                )}
            </div>
        ) : card.type === 'equipment' ? (
            <>
                <img
                    src={card.image}
                    alt={card.name}
                    decoding="async"
                    className={`mb-1 h-9 w-9 object-contain sm:h-10 sm:w-10 ${card.isSpecial ? 'drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]' : ''}`}
                    style={{ imageRendering: 'auto' }}
                />
                <div className="w-full px-0.5 text-center">
                    <div className={`mb-0.5 text-[10px] font-semibold leading-tight sm:text-[11px] ${card.isSpecial ? 'text-yellow-100' : 'text-white'}`}>
                        {card.equipment?.fullName || card.name}
                    </div>
                    {card.quantity !== undefined && (
                        <div className={`text-[11px] font-bold sm:text-xs ${card.isSpecial ? 'text-yellow-200' : 'text-gray-200'}`}>
                            {card.quantity.toLocaleString()}
                        </div>
                    )}
                </div>
            </>
        ) : (
            <>
                <img
                    src={card.image}
                    alt={card.name}
                    decoding="async"
                    className={`mb-1 h-9 w-9 object-contain sm:h-10 sm:w-10 ${card.isSpecial ? 'drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]' : ''}`}
                    style={{ imageRendering: 'auto' }}
                />
                <div className="text-center">
                    <div className={`mb-0.5 text-[10px] font-semibold leading-tight sm:text-[11px] ${card.isSpecial ? 'text-yellow-100' : 'text-white'}`}>
                        {card.name}
                    </div>
                    {card.quantity !== undefined && (
                        <div className={`text-[11px] font-bold sm:text-xs ${card.isSpecial ? 'text-yellow-200' : 'text-gray-200'}`}>
                            {card.quantity.toLocaleString()}
                        </div>
                    )}
                </div>
            </>
        )}
        {card.isSpecial && (
            <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 animate-bounce">
                <span className="text-[8px]">⭐</span>
            </div>
        )}
    </>
);

const GuildBossBattleResultModal: React.FC<GuildBossBattleResultModalProps> = ({ result, onClose, isTopmost }) => {
    const { handlers, currentUserWithStatus } = useAppContext();
    const [cardsFlipped, setCardsFlipped] = useState(false);
    const [flipSettled, setFlipSettled] = useState(false);
    const [rewardCards, setRewardCards] = useState<RewardCard[]>([]);
    
    const hpPercentAfter =
        result.bossMaxHp > 0 ? (result.bossHpAfter / result.bossMaxHp) * 100 : 0;
    const rewards = result.rewards;
    const tier = rewards.tier;
    const isTopGrade = tier === 12;
    
    useEffect(() => {
        // 보상 카드 배열 생성
        const cards: RewardCard[] = [];
        
        // 길드 경험치
        cards.push({
            type: 'guildXp',
            name: '길드 경험치',
            quantity: rewards.guildXp,
            image: '',
            isSpecial: isTopGrade,
        });
        
        // 길드 코인
        cards.push({
            type: 'guildCoins',
            name: '길드 코인',
            quantity: rewards.guildCoins,
            image: '/images/guild/tokken.png',
            isSpecial: isTopGrade,
        });
        
        // 연구소 포인트
        cards.push({
            type: 'researchPoints',
            name: '연구소 포인트',
            quantity: rewards.researchPoints,
            image: '/images/guild/button/guildlab.png',
            isSpecial: isTopGrade,
        });
        
        // 골드
        cards.push({
            type: 'gold',
            name: '골드',
            quantity: rewards.gold,
            image: '/images/icon/Gold.png',
            isSpecial: isTopGrade,
        });
        
        // 강화재료
        cards.push({
            type: 'material',
            name: rewards.materials.name,
            quantity: rewards.materials.quantity,
            image: MATERIAL_IMAGES[rewards.materials.name] || '/images/materials/materials1.png',
            isSpecial: isTopGrade,
        });
        
        // 신비의 강화석 등 추가 강화재료 (SSS 등)
        if (rewards.materialsBonus && rewards.materialsBonus.quantity > 0) {
            cards.push({
                type: 'material',
                name: rewards.materialsBonus.name,
                quantity: rewards.materialsBonus.quantity,
                image: MATERIAL_IMAGES[rewards.materialsBonus.name] || '/images/materials/materials5.png',
                isSpecial: true,
            });
        }
        
        // 재료 상자 (SSS 등)
        if (rewards.materialBox && rewards.materialBox.quantity > 0) {
            cards.push({
                type: 'materialBox',
                name: rewards.materialBox.name,
                quantity: rewards.materialBox.quantity,
                image: MATERIAL_BOX_IMAGES[rewards.materialBox.name] || '/images/Box/ResourceBox3.png',
                isSpecial: true,
            });
        }
        
        // 변경권
        rewards.tickets.forEach(ticket => {
            cards.push({
                type: 'ticket',
                name: ticket.name,
                quantity: ticket.quantity,
                image: TICKET_IMAGES[ticket.name] || '/images/use/change1.png',
                isSpecial: isTopGrade,
            });
        });
        
        // 장비: 서버에서 지급된 실제 장비(item/name/image/slot)를 표시. 없으면 등급에 맞는 표시용 장비 사용
        if (rewards.equipment) {
            const equipmentItem = (rewards.equipment as any).item;
            const equipmentGrade = equipmentItem?.grade != null
                ? (typeof equipmentItem.grade === 'string' ? equipmentItem.grade as ItemGrade : equipmentItem.grade)
                : (typeof rewards.equipment.grade === 'string' ? (rewards.equipment.grade as ItemGrade) : rewards.equipment.grade);
            const isLegendaryOrMythic = equipmentGrade === ItemGrade.Legendary || equipmentGrade === ItemGrade.Mythic;
            const isSpecialEquipment = isLegendaryOrMythic || isTopGrade;

            let equipmentName = equipmentItem?.name ?? (rewards.equipment as any).name;
            let equipmentImage = equipmentItem?.image ?? (rewards.equipment as any).image;

            // 서버에서 실제 장비 정보가 없으면(등급만 있는 경우) 해당 등급의 표시용 장비 1개 선택
            if (!equipmentName || !equipmentImage) {
                const byGrade = EQUIPMENT_POOL.filter(
                    (e: { grade: ItemGrade }) => e.grade === equipmentGrade
                );
                const template = byGrade.length > 0 ? byGrade[Math.floor(Math.random() * byGrade.length)] : null;
                if (template) {
                    equipmentName = equipmentName || template.name;
                    equipmentImage = equipmentImage || template.image;
                }
            }

            const displayName = equipmentName || `${equipmentGrade} 등급 장비`;
            const gradeKey = equipmentGrade as ItemGrade;
            const imagePath = equipmentImage
                ? (equipmentImage.startsWith('/') ? equipmentImage : `/${equipmentImage}`)
                : (gradeBackgrounds[gradeKey] || '/images/equipments/normalbgi.png');

            const rawEqQty = (equipmentItem as { quantity?: number } | undefined)?.quantity;
            const equipmentQty = typeof rawEqQty === 'number' && rawEqQty > 0 ? rawEqQty : 1;

            cards.push({
                type: 'equipment',
                name: displayName,
                quantity: equipmentQty,
                image: imagePath,
                grade: equipmentGrade,
                isSpecial: isSpecialEquipment,
                equipment: {
                    fullName: displayName,
                    item: equipmentItem,
                },
            });
        }
        
        setRewardCards(cards);
        
        // 카드 뒤집기 애니메이션 시작
        const flipStart = window.setTimeout(() => {
            setCardsFlipped(true);
        }, 300);
        // 3D transform은 정지 후에도 글자/아이콘이 흐릿해질 수 있어, 전환 종료 뒤 2D 레이아웃으로 전환
        const flipDone = window.setTimeout(() => {
            setFlipSettled(true);
        }, 300 + 700 + 80);
        return () => {
            window.clearTimeout(flipStart);
            window.clearTimeout(flipDone);
        };
    }, []);
    
    const MATERIAL_IMAGES: Record<string, string> = {
        '하급 강화석': '/images/materials/materials1.png',
        '중급 강화석': '/images/materials/materials2.png',
        '상급 강화석': '/images/materials/materials3.png',
        '최상급 강화석': '/images/materials/materials4.png',
        '신비의 강화석': '/images/materials/materials5.png',
    };
    const MATERIAL_BOX_IMAGES: Record<string, string> = {
        '재료 상자 I': '/images/Box/ResourceBox1.png',
        '재료 상자 II': '/images/Box/ResourceBox2.png',
        '재료 상자 III': '/images/Box/ResourceBox3.png',
        '재료 상자 IV': '/images/Box/ResourceBox4.png',
    };
    
    const TICKET_IMAGES: Record<string, string> = {
        '옵션 종류 변경권': '/images/use/change1.png',
        '옵션 수치 변경권': '/images/use/change2.png',
        '스페셜 옵션 변경권': '/images/use/change3.png',
        '신화 옵션 변경권': '/images/use/change3.png',
    };
    
    const getTierColor = (tier: number) => {
        const colors: Record<number, string> = {
            1: 'from-gray-500 to-gray-600',
            2: 'from-gray-400 to-gray-500',
            3: 'from-green-700 to-green-800',
            4: 'from-green-500 to-green-600',
            5: 'from-emerald-500 to-emerald-600',
            6: 'from-cyan-500 to-cyan-600',
            7: 'from-blue-500 to-blue-600',
            8: 'from-indigo-500 to-indigo-600',
            9: 'from-violet-500 to-violet-600',
            10: 'from-purple-500 to-purple-600',
            11: 'from-amber-400 to-amber-500',
            12: 'from-yellow-400 via-orange-500 to-red-500',
        };
        return colors[tier] ?? 'from-gray-500 to-gray-600';
    };
    
    const getTierName = (tier: number) => {
        const label = GUILD_BOSS_GRADE_NAMES[tier - 1];
        return label ? `${label}등급` : 'E등급';
    };

    const vipSlot =
        result.vipPlayRewardSlot ??
        (currentUserWithStatus
            ? { locked: !isRewardVipActive(currentUserWithStatus as User) }
            : { locked: true });
    
    return (
        <DraggableWindow title="전투 결과" onClose={onClose} windowId="guild-boss-battle-result" initialWidth={600} initialHeight={700} isTopmost={isTopmost}>
            <div className="flex flex-col h-full min-h-0 bg-gradient-to-b from-stone-950 via-neutral-900 to-stone-950 rounded-b-lg border-t border-amber-500/30">
                <div className="text-center mb-4 flex-shrink-0 pt-2">
                    <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 bg-clip-text text-transparent" style={{ textShadow: '0 0 20px rgba(251,191,36,0.3)' }}>
                        {result.bossName} 전투 결과
                    </h2>
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                        <div className={`px-4 py-1.5 rounded-full bg-gradient-to-r ${getTierColor(tier)} text-white font-bold text-lg shadow-lg border border-amber-400/40`}>
                            {getTierName(tier)}
                        </div>
                        <span className="text-amber-100/90">총 피해량: <span className="font-bold text-amber-300">{result.damageDealt.toLocaleString()}</span></span>
                    </div>
                </div>
                
                <div className="mb-4 overflow-y-auto flex-1 min-h-0 pr-1">
                    <div className="grid grid-cols-4 gap-2">
                        {rewardCards.map((card, index) => (
                            <div
                                key={index}
                                className={`relative h-24 ${card.isSpecial ? 'z-10' : ''}`}
                                style={{
                                    animationDelay: `${index * 100}ms`,
                                }}
                            >
                                {flipSettled ? (
                                    <div
                                        className={`relative flex h-full w-full flex-col items-center justify-center rounded-lg border-2 p-1 shadow-lg [transform:none] [filter:none] ${
                                            card.isSpecial
                                                ? 'bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 border-yellow-300 shadow-[0_0_20px_rgba(255,215,0,0.8)] ring-2 ring-yellow-200/60'
                                                : 'border-gray-600 bg-gradient-to-br from-gray-800 to-gray-900'
                                        }`}
                                        style={{
                                            WebkitFontSmoothing: 'subpixel-antialiased',
                                        }}
                                    >
                                        <RewardCardFrontContent card={card} />
                                    </div>
                                ) : (
                                    <div className="perspective-1000 relative h-full w-full">
                                        <div
                                            className={`relative h-full w-full transition-transform duration-700 transform-style-preserve-3d ${
                                                cardsFlipped ? 'rotate-y-180' : ''
                                            }`}
                                            style={{
                                                transformStyle: 'preserve-3d',
                                            }}
                                        >
                                            <div
                                                className={`absolute inset-0 backface-hidden flex items-center justify-center rounded-lg border-2 shadow-lg ${
                                                    card.isSpecial
                                                        ? 'border-yellow-300 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 shadow-[0_0_20px_rgba(255,215,0,0.8)]'
                                                        : 'border-indigo-400 bg-gradient-to-br from-indigo-600 to-purple-700'
                                                }`}
                                                style={{
                                                    transform: 'rotateY(0deg)',
                                                    backfaceVisibility: 'hidden',
                                                }}
                                            >
                                                <span className="text-3xl font-bold text-white/80">?</span>
                                            </div>
                                            <div
                                                className={`absolute inset-0 backface-hidden flex flex-col items-center justify-center rounded-lg border-2 p-1 shadow-lg ${
                                                    card.isSpecial
                                                        ? 'border-yellow-300 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 shadow-[0_0_20px_rgba(255,215,0,0.8)]'
                                                        : 'border-gray-600 bg-gradient-to-br from-gray-800 to-gray-900'
                                                }`}
                                                style={{
                                                    transform: 'rotateY(180deg)',
                                                    backfaceVisibility: 'hidden',
                                                }}
                                            >
                                                <RewardCardFrontContent card={card} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex justify-center border-t border-amber-500/20 pt-3">
                        <ResultModalVipRewardSlot
                            slot={vipSlot}
                            compact={false}
                            onLockedClick={vipSlot.locked ? () => handlers.openShop('vip') : undefined}
                        />
                    </div>
                </div>
                
                <div className="space-y-2 bg-black/40 border border-amber-500/20 p-4 rounded-lg text-sm flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <span className="text-amber-200/80">생존 턴:</span>
                        <span className="font-bold text-amber-100">{result.turnsSurvived} 턴</span>
                    </div>
                    <div className="pt-2 border-t border-amber-500/30">
                        <p className="text-xs text-amber-200/70 mb-1">보스 남은 체력 ({hpPercentAfter.toFixed(1)}%)</p>
                        <div className="w-full bg-stone-900/80 rounded-full h-3 border border-amber-600/40 relative overflow-hidden">
                            <div className="bg-gradient-to-r from-red-600 to-red-800 h-full rounded-full shadow-[0_0_8px_rgba(220,38,38,0.5)]" style={{ width: `${hpPercentAfter}%` }}></div>
                            <span className="absolute inset-0 text-xs font-bold text-white flex items-center justify-center" style={{textShadow: '1px 1px 2px black'}}>
                                {result.bossHpAfter.toLocaleString()} / {result.bossMaxHp.toLocaleString()}
                            </span>
                        </div>
                    </div>
                    <div className="pt-2 border-t border-amber-500/30">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-amber-200/80">누적 피해 순위</span>
                            <div className="flex max-w-full flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs sm:text-sm">
                                <span className="text-amber-300/85">
                                    이전:{' '}
                                    {typeof result.previousRank === 'number' ? (
                                        <span className="font-semibold text-amber-200">{result.previousRank}위</span>
                                    ) : (
                                        <span className="text-amber-200/65">기록 없음</span>
                                    )}
                                </span>
                                <span className="text-amber-200/45" aria-hidden>
                                    →
                                </span>
                                <span className="font-bold text-amber-300">
                                    현재:{' '}
                                    {typeof result.currentRank === 'number' ? `${result.currentRank}위` : '—'}
                                </span>
                                {typeof result.previousRank === 'number' &&
                                    typeof result.currentRank === 'number' &&
                                    result.previousRank !== result.currentRank && (
                                        <span
                                            className={`font-semibold ${result.currentRank < result.previousRank ? 'text-green-400' : 'text-red-400'}`}
                                        >
                                            ({result.currentRank < result.previousRank ? '↑' : '↓'}{' '}
                                            {Math.abs(result.currentRank - result.previousRank)})
                                        </span>
                                    )}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex-shrink-0 mt-4 flex justify-center px-2">
                    <Button
                        bare
                        colorScheme="none"
                        onClick={onClose}
                        className={`min-w-[10rem] px-10 ${PRE_GAME_MODAL_ACCENT_BTN_CLASS}`}
                    >
                        확인
                    </Button>
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
