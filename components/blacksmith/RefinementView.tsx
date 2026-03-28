import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserWithStatus, InventoryItem, ServerAction, ItemOption, CoreStat, SpecialStat, MythicStat, ItemGrade } from '../../types.js';
import Button from '../Button.js';
import { MAIN_STAT_DEFINITIONS, SUB_OPTION_POOLS, SPECIAL_STATS_DATA, MYTHIC_STATS_DATA, GRADE_SUB_OPTION_RULES, GRADE_LEVEL_REQUIREMENTS, MATERIAL_ITEMS, CORE_STATS_DATA } from '../../constants';
import { useAppContext } from '../../hooks/useAppContext.js';
import { calculateRefinementGoldCost } from '../../constants/rules.js';
import { MythicOptionAbbrev, MythicStatAbbrev } from '../MythicStatAbbrev.js';
import { PortalHoverBubble } from '../PortalHoverBubble.js';

const REFINEMENT_TICKET_DEFS: { id: 'type' | 'value' | 'mythic'; itemKey: keyof typeof MATERIAL_ITEMS }[] = [
    { id: 'type', itemKey: '옵션 종류 변경권' },
    { id: 'value', itemKey: '옵션 수치 변경권' },
    { id: 'mythic', itemKey: '신화 옵션 변경권' },
];

/** 보유 변경권: 이미지 + 우하단 개수, 호버/누르고 있을 때 말풍선 */
const RefinementOwnedTicketSlot: React.FC<{
    id: string;
    name: string;
    description: string;
    image: string;
    count: number;
}> = ({ id, name, description, image, count }) => {
    const [pressed, setPressed] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [bubbleHover, setBubbleHover] = useState(false);
    const anchorRef = useRef<HTMLDivElement>(null);
    const showBubble = hovered || pressed || bubbleHover;

    useEffect(() => {
        if (!pressed) return;
        const end = () => setPressed(false);
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);
        return () => {
            window.removeEventListener('pointerup', end);
            window.removeEventListener('pointercancel', end);
        };
    }, [pressed]);

    return (
        <div
            ref={anchorRef}
            className="relative flex flex-1 justify-center min-w-0 touch-manipulation"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onPointerDown={() => setPressed(true)}
        >
            <div className="relative w-8 h-8 shrink-0 cursor-help select-none">
                <img src={image} alt="" className="w-8 h-8 object-contain pointer-events-none" draggable={false} />
                <span className="absolute bottom-0 right-0 min-w-[15px] h-[14px] px-0.5 flex items-center justify-center rounded-sm bg-black/90 text-[9px] font-bold text-amber-300 leading-none tabular-nums ring-1 ring-amber-700/60">
                    {count}
                </span>
            </div>

            <PortalHoverBubble
                show={showBubble}
                anchorRef={anchorRef}
                placement="top"
                className="pointer-events-auto"
                onBubblePointerEnter={() => setBubbleHover(true)}
                onBubblePointerLeave={() => setBubbleHover(false)}
            >
                <div
                    id={`refine-ticket-tip-${id}`}
                    className="relative w-max max-w-[min(220px,calc(100vw-24px))] rounded-lg border border-amber-500 bg-zinc-900 px-2 py-1.5 text-left shadow-2xl ring-1 ring-black/50"
                >
                    <div className="text-[10px] font-bold text-amber-200 mb-0.5 pr-1">{name}</div>
                    <p className="text-[9px] text-gray-100 leading-snug">{description}</p>
                    <div
                        className="absolute left-1/2 top-full -translate-x-1/2 -mt-px h-0 w-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-amber-500"
                        aria-hidden
                    />
                    <div
                        className="absolute left-1/2 top-full -translate-x-1/2 mt-[-5px] h-0 w-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-zinc-900"
                        aria-hidden
                    />
                </div>
            </PortalHoverBubble>
        </div>
    );
};

const gradeStyles: Record<ItemGrade, { name: string; color: string; background: string; }> = {
    normal: { name: '일반', color: 'text-gray-300', background: '/images/equipments/normalbgi.png' },
    uncommon: { name: '고급', color: 'text-green-400', background: '/images/equipments/uncommonbgi.png' },
    rare: { name: '희귀', color: 'text-blue-400', background: '/images/equipments/rarebgi.png' },
    epic: { name: '에픽', color: 'text-purple-400', background: '/images/equipments/epicbgi.png' },
    legendary: { name: '전설', color: 'text-red-500', background: '/images/equipments/legendarybgi.png' },
    mythic: { name: '신화', color: 'text-orange-400', background: '/images/equipments/mythicbgi.png' },
};

const renderStarDisplay = (stars: number) => {
    if (stars === 0) return null;

    let starImage = '';
    let numberColor = '';

    if (stars >= 10) {
        starImage = '/images/equipments/Star4.png';
        numberColor = "prism-text-effect";
    } else if (stars >= 7) {
        starImage = '/images/equipments/Star3.png';
        numberColor = "text-purple-400";
    } else if (stars >= 4) {
        starImage = '/images/equipments/Star2.png';
        numberColor = "text-amber-400";
    } else if (stars >= 1) {
        starImage = '/images/equipments/Star1.png';
        numberColor = "text-white";
    }

    return (
        <div className="absolute top-0.5 left-1.5 flex items-center gap-0.5 bg-black/40 rounded-br-md px-1 py-0.5 z-10" style={{ textShadow: '1px 1px 2px black' }}>
            <img 
                src={starImage} 
                alt="star" 
                className="w-3 h-3"
            />
            <span className={`font-bold text-xs leading-none ${numberColor}`}>
                {stars}
            </span>
        </div>
    );
};

const ItemDisplay: React.FC<{ 
    item: InventoryItem; 
    selectedOption: { type: 'main' | 'combatSub' | 'specialSub' | 'mythicSub'; index: number } | null;
    onOptionClick: (type: 'main' | 'combatSub' | 'specialSub' | 'mythicSub', index: number) => void;
}> = ({ item, selectedOption, onOptionClick }) => {
    const { currentUserWithStatus } = useAppContext();
    const styles = gradeStyles[item.grade];

    const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
    const userLevelSum = (currentUserWithStatus?.strategyLevel || 0) + (currentUserWithStatus?.playfulLevel || 0);
    const canEquip = userLevelSum >= requiredLevel;

    if (!item.options) return null;

    const { main, combatSubs, specialSubs, mythicSubs } = item.options;

    return (
        <div className="flex flex-col w-full h-full p-1">
            {/* Top section: Image and Name/Main Option */}
            <div className="flex mb-2">
                <div className="relative w-16 h-16 rounded-lg flex-shrink-0 mr-2">
                    <img src={styles.background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                    {item.image && <img src={item.image} alt={item.name} className="absolute object-contain p-1" style={{ width: '80%', height: '80%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />}
                    {renderStarDisplay(item.stars)}
                    {item.isDivineMythic && (
                        <div 
                            className="absolute bottom-0 left-0 flex items-center justify-center bg-black/60 rounded-tr-md z-10" 
                            style={{ 
                                textShadow: '1px 1px 2px black',
                                padding: '2px 4px',
                                fontSize: '8px',
                                fontWeight: 'bold',
                                color: '#FFD700'
                            }}
                        >
                            D
                        </div>
                    )}
                </div>
                <div className="flex-grow pt-1 min-w-0">
                    <h3 className={`text-sm font-bold whitespace-nowrap overflow-hidden text-ellipsis ${styles.color}`} title={item.name}>{item.name}</h3>
                    <p className={`text-xs ${canEquip ? 'text-gray-500' : 'text-red-500'}`}>(착용레벨: {requiredLevel})</p>
                    {/* 제련 가능 횟수 표시 */}
                    <p className={`text-xs font-semibold ${(item as any).refinementCount > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                        제련 가능: {(item as any).refinementCount > 0 ? `${(item as any).refinementCount}회` : '제련불가'}
                    </p>
                </div>
            </div>
            {/* Bottom section: Clickable options */}
            <div className="w-full text-xs text-left space-y-0.5 bg-black/30 p-1.5 rounded-lg flex-grow overflow-y-auto">
                {/* Main Option */}
                <button
                    onClick={() => onOptionClick('main', 0)}
                    className={`w-full text-left p-1 rounded transition-all ${
                        selectedOption?.type === 'main' 
                            ? 'bg-blue-600/70 text-white font-semibold' 
                            : 'hover:bg-gray-700/50 text-yellow-300'
                    }`}
                >
                    주: {main.display}
                </button>
                {/* Combat Subs */}
                {combatSubs.map((sub, idx) => (
                    <button
                        key={`c-${idx}`}
                        onClick={() => onOptionClick('combatSub', idx)}
                        className={`w-full text-left p-1 rounded transition-all ${
                            selectedOption?.type === 'combatSub' && selectedOption.index === idx
                                ? 'bg-blue-600/70 text-white font-semibold' 
                                : 'hover:bg-gray-700/50 text-blue-300'
                        }`}
                    >
                        부{idx + 1}: {sub.display}
                    </button>
                ))}
                {/* Special Subs */}
                {specialSubs.map((sub, idx) => (
                    <button
                        key={`s-${idx}`}
                        onClick={() => onOptionClick('specialSub', idx)}
                        className={`w-full text-left p-1 rounded transition-all ${
                            selectedOption?.type === 'specialSub' && selectedOption.index === idx
                                ? 'bg-blue-600/70 text-white font-semibold' 
                                : 'hover:bg-gray-700/50 text-green-300'
                        }`}
                    >
                        특{idx + 1}: {sub.display}
                    </button>
                ))}
                {/* Mythic Subs */}
                {mythicSubs.map((sub, idx) => (
                    <button
                        key={`m-${idx}`}
                        onClick={() => onOptionClick('mythicSub', idx)}
                        className={`w-full text-left p-1 rounded transition-all ${
                            selectedOption?.type === 'mythicSub' && selectedOption.index === idx
                                ? 'bg-blue-600/70 text-white font-semibold' 
                                : 'hover:bg-gray-700/50 text-red-400'
                        }`}
                    >
                        <span className="inline-flex items-center gap-0.5 min-w-0 flex-wrap">
                            신{idx + 1}:{' '}
                            <MythicOptionAbbrev option={sub} textClassName="text-red-400" bubbleSide="right" />
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

interface RefinementViewProps {
    selectedItem: InventoryItem | null;
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => void;
    refinementResult: { message: string; success: boolean; itemBefore: InventoryItem; itemAfter: InventoryItem; } | null;
    onResultConfirm: () => void;
}

type RefinementType = 'type' | 'value' | 'mythic';

const RefinementView: React.FC<RefinementViewProps> = ({ selectedItem, currentUser, onAction, refinementResult, onResultConfirm }) => {
    const isMobile = false;
    const [selectedOption, setSelectedOption] = useState<{ type: 'main' | 'combatSub' | 'specialSub' | 'mythicSub'; index: number } | null>(null);
    const [refinementType, setRefinementType] = useState<RefinementType | null>(null);
    const [isRefining, setIsRefining] = useState(false);
    const [refinementProgress, setRefinementProgress] = useState(0);
    const refinementIntervalRef = useRef<number | null>(null);
    const refinementTimeoutRef = useRef<number | null>(null);

    // 등급별 소모량
    const getTicketCost = (grade: ItemGrade): number => {
        switch (grade) {
            case ItemGrade.Uncommon: return 1;
            case ItemGrade.Rare: return 2;
            case ItemGrade.Epic: return 3;
            case ItemGrade.Legendary: return 4;
            case ItemGrade.Mythic: return 5;
            default: return 1;
        }
    };

    // 보유한 변경권 개수
    const ticketCounts = useMemo(() => {
        if (!currentUser) return { type: 0, value: 0, mythic: 0 };
        const inventory = currentUser.inventory || [];
        const countByName = (n: string) =>
            inventory
                .filter(i => i.name === n && (i.type === 'material' || i.type === 'consumable'))
                .reduce((sum, i) => sum + (i.quantity || 0), 0);
        return {
            type: countByName('옵션 종류 변경권'),
            value: countByName('옵션 수치 변경권'),
            mythic: countByName('신화 옵션 변경권'),
        };
    }, [currentUser]);

    // 선택된 옵션 정보
    const selectedOptionData = useMemo(() => {
        if (!selectedItem || !selectedItem.options || !selectedOption) return null;
        
        const { main, combatSubs, specialSubs, mythicSubs } = selectedItem.options;
        
        if (selectedOption.type === 'main') {
            return main;
        } else if (selectedOption.type === 'combatSub') {
            return combatSubs[selectedOption.index];
        } else if (selectedOption.type === 'specialSub') {
            return specialSubs[selectedOption.index];
        } else if (selectedOption.type === 'mythicSub') {
            return mythicSubs[selectedOption.index];
        }
        return null;
    }, [selectedItem, selectedOption]);

    // 변경 가능한 옵션 종류 계산
    const availableOptions = useMemo(() => {
        if (!selectedItem || !selectedOption || !selectedOptionData) return [];
        
        const slot = selectedItem.slot!;
        const grade = selectedItem.grade;
        
        if (refinementType === 'type') {
            if (selectedOption.type === 'main') {
                const slotDef = MAIN_STAT_DEFINITIONS[slot];
                const gradeDef = slotDef.options[grade];
                return gradeDef.stats.filter(stat => stat !== selectedOptionData.type).map(stat => ({
                    type: stat,
                    name: CORE_STATS_DATA[stat].name,
                    range: null,
                    isPercentage: slotDef.isPercentage
                }));
            } else if (selectedOption.type === 'combatSub') {
                const rules = GRADE_SUB_OPTION_RULES[grade];
                const combatTier = rules.combatTier;
                const pool = SUB_OPTION_POOLS[slot][combatTier];
                const usedTypes = new Set(selectedItem.options!.combatSubs.map(s => s.type));
                usedTypes.add(selectedItem.options!.main.type);
                return pool.filter(opt => !usedTypes.has(opt.type)).map(opt => ({
                    type: opt.type,
                    name: CORE_STATS_DATA[opt.type].name,
                    range: opt.range,
                    isPercentage: opt.isPercentage
                }));
            } else if (selectedOption.type === 'specialSub') {
                const allSpecialStats = Object.values(SpecialStat);
                const usedTypes = new Set(selectedItem.options!.specialSubs.map(s => s.type));
                return allSpecialStats.filter(stat => !usedTypes.has(stat)).map(stat => ({
                    type: stat,
                    name: SPECIAL_STATS_DATA[stat].name,
                    range: SPECIAL_STATS_DATA[stat].range,
                    isPercentage: SPECIAL_STATS_DATA[stat].isPercentage
                }));
            }
        } else if (refinementType === 'value') {
            if (selectedOption.type === 'combatSub' || selectedOption.type === 'specialSub') {
                // 수치 변경 시 현재 옵션의 range를 반환
                if (selectedOptionData.range) {
                    return [{
                        type: selectedOptionData.type,
                        name: selectedOption.type === 'combatSub' 
                            ? CORE_STATS_DATA[selectedOptionData.type as CoreStat].name
                            : SPECIAL_STATS_DATA[selectedOptionData.type as SpecialStat].name,
                        range: selectedOptionData.range,
                        isPercentage: selectedOptionData.isPercentage
                    }];
                }
            }
        } else if (refinementType === 'mythic') {
            if (selectedOption.type === 'mythicSub') {
                const allMythicStats = Object.values(MythicStat);
                const usedTypes = new Set(selectedItem.options!.mythicSubs.map(s => s.type));
                return allMythicStats.filter(stat => stat !== selectedOptionData.type).map(stat => ({
                    type: stat,
                    name: MYTHIC_STATS_DATA[stat].name,
                    range: null,
                    isPercentage: false
                }));
            }
        }
        
        return [];
    }, [selectedItem, selectedOption, selectedOptionData, refinementType]);

    // 필요한 변경권 개수
    const requiredTickets = useMemo(() => {
        if (!selectedItem) return 0;
        return getTicketCost(selectedItem.grade);
    }, [selectedItem]);

    // 필요한 골드 비용
    const requiredGold = useMemo(() => {
        if (!selectedItem) return 0;
        return calculateRefinementGoldCost(selectedItem.grade);
    }, [selectedItem]);

    // 일반 등급 장비는 제련 불가
    const canRefineAtAll = useMemo(() => {
        if (!selectedItem) return false;
        return selectedItem.grade !== ItemGrade.Normal;
    }, [selectedItem]);

    // 제련 가능 횟수 확인
    const refinementCount = useMemo(() => {
        if (!selectedItem) return 0;
        return (selectedItem as any).refinementCount ?? 0;
    }, [selectedItem]);

    // 제련 가능 여부
    const canRefine = useMemo(() => {
        if (!selectedItem || !selectedOption || !refinementType || !canRefineAtAll) return false;
        
        // 제련 가능 횟수 확인
        if (refinementCount <= 0) return false;
        
        if (currentUser.gold < requiredGold) return false;
        
        if (refinementType === 'type') {
            return ticketCounts.type >= requiredTickets && availableOptions.length > 0;
        } else if (refinementType === 'value') {
            return ticketCounts.value >= requiredTickets && (selectedOption.type === 'combatSub' || selectedOption.type === 'specialSub');
        } else if (refinementType === 'mythic') {
            return ticketCounts.mythic >= requiredTickets && selectedOption.type === 'mythicSub' && availableOptions.length > 0;
        }
        
        return false;
    }, [selectedItem, selectedOption, refinementType, ticketCounts, requiredTickets, availableOptions, canRefineAtAll, currentUser.gold, requiredGold, refinementCount]);

    // 변경권 아이템 정보
    const ticketItemInfo = useMemo(() => {
        if (!refinementType) return null;
        const ticketName =
            refinementType === 'type'
                ? '옵션 종류 변경권'
                : refinementType === 'value'
                  ? '옵션 수치 변경권'
                  : '신화 옵션 변경권';
        return MATERIAL_ITEMS[ticketName] ?? null;
    }, [refinementType]);

    const clearRefinementTimers = () => {
        if (refinementIntervalRef.current) {
            clearInterval(refinementIntervalRef.current);
            refinementIntervalRef.current = null;
        }
        if (refinementTimeoutRef.current) {
            clearTimeout(refinementTimeoutRef.current);
            refinementTimeoutRef.current = null;
        }
    };

    const handleRefine = async () => {
        if (!canRefine || !selectedItem || !selectedOption) return;
        
        setIsRefining(true);
        setRefinementProgress(0);
        
        refinementIntervalRef.current = window.setInterval(() => {
            setRefinementProgress(prev => {
                if (prev >= 100) {
                    clearRefinementTimers();
                    return 100;
                }
                return prev + 2;
            });
        }, 40);
        
        refinementTimeoutRef.current = window.setTimeout(async () => {
            clearRefinementTimers();
            setRefinementProgress(100);
            
            await onAction({
                type: 'REFINE_EQUIPMENT',
                payload: {
                    itemId: selectedItem.id,
                    optionType: selectedOption.type,
                    optionIndex: selectedOption.index,
                    refinementType: refinementType,
                }
            });
            
            setIsRefining(false);
            setRefinementProgress(0);
            setSelectedOption(null);
            setRefinementType(null);
        }, 2000);
    };

    useEffect(() => {
        return () => {
            clearRefinementTimers();
        };
    }, []);

    useEffect(() => {
        if (!isRefining) {
            setRefinementProgress(0);
            clearRefinementTimers();
        }
    }, [isRefining]);

    if (!selectedItem) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                장비를 선택해주세요.
            </div>
        );
    }

    if (!selectedItem.options) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                옵션이 없는 장비입니다.
            </div>
        );
    }

    if (!canRefineAtAll) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                일반 등급 장비는 제련할 수 없습니다.
            </div>
        );
    }

    // 제련 횟수가 0인 경우
    if (refinementCount <= 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2">
                <div>제련 가능 횟수가 모두 소진되었습니다.</div>
                <div className="text-xs text-gray-500">새로운 장비를 획득하면 제련 횟수가 부여됩니다.</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full gap-2 p-2">
            {/* 좌우 분할 레이아웃 */}
            <div className="flex-1 grid grid-cols-2 gap-3 min-h-0 min-w-0">
                {/* 좌측: 선택된 장비 표시 */}
                <div className="flex flex-col bg-gray-800/50 rounded-lg p-2 min-h-0 min-w-0">
                    <h3 className="text-xs font-bold mb-1 text-gray-300">선택된 장비</h3>
                    <div className="flex-1 min-h-0">
                        <ItemDisplay 
                            item={selectedItem} 
                            selectedOption={selectedOption}
                            onOptionClick={(type, index) => {
                                setSelectedOption({ type, index });
                                setRefinementType(null);
                            }}
                        />
                    </div>
                </div>

                {/* 우측: 제련 정보 (grid 자식은 기본 min-width:auto라 내용이 잘릴 수 있어 min-w-0) */}
                <div className="flex flex-col bg-gray-800/50 rounded-lg p-2 min-h-0 min-w-0">
                    <h3 className="text-xs font-bold mb-2 text-gray-300 shrink-0">제련 정보</h3>
                    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
                    {selectedOption ? (
                        <div className="flex flex-col gap-2 text-xs">
                            {/* 선택된 옵션 표시 */}
                            <div className="bg-gray-900/50 p-1.5 rounded">
                                <div className="text-gray-400 text-xs mb-0.5">선택된 옵션</div>
                                <div className="text-yellow-300 font-semibold">
                                    {selectedOption?.type === 'mythicSub' && selectedOptionData ? (
                                        <MythicOptionAbbrev option={selectedOptionData} textClassName="text-yellow-300 font-semibold" />
                                    ) : (
                                        selectedOptionData?.display || 'N/A'
                                    )}
                                </div>
                            </div>
                            
                            {/* 제련 타입 선택 버튼 (좁은 열에서도 잘리지 않도록 grid + min-w-0, scale 제거) */}
                            <div
                                className={`grid w-full min-w-0 gap-1.5 ${
                                    selectedOption.type === 'mythicSub'
                                        ? 'grid-cols-1'
                                        : selectedOption.type === 'main'
                                          ? 'grid-cols-1'
                                          : 'grid-cols-2'
                                }`}
                            >
                                {(selectedOption.type === 'main' || selectedOption.type === 'combatSub' || selectedOption.type === 'specialSub') && (
                                    <>
                                        <button
                                            onClick={() => setRefinementType('type')}
                                            className={`group relative min-w-0 w-full py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-300 overflow-hidden ${
                                                refinementType === 'type'
                                                    ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white shadow-[0_0_16px_rgba(168,85,247,0.55)] ring-1 ring-white/30'
                                                    : 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 hover:from-gray-600 hover:to-gray-700 hover:shadow-lg'
                                            }`}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%]" />
                                            <span className="relative z-10 flex items-center justify-center gap-0.5 sm:gap-1">
                                                <span className="text-xs sm:text-sm shrink-0">🔄</span>
                                                <span className="truncate">종류변경</span>
                                            </span>
                                        </button>
                                        {(selectedOption.type === 'combatSub' || selectedOption.type === 'specialSub') && (
                                            <button
                                                onClick={() => setRefinementType('value')}
                                                className={`group relative min-w-0 w-full py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-300 overflow-hidden ${
                                                    refinementType === 'value'
                                                        ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-[0_0_16px_rgba(20,184,166,0.55)] ring-1 ring-white/30'
                                                        : 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 hover:from-gray-600 hover:to-gray-700 hover:shadow-lg'
                                                }`}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%]" />
                                                <span className="relative z-10 flex items-center justify-center gap-0.5 sm:gap-1">
                                                    <span className="text-xs sm:text-sm shrink-0">📊</span>
                                                    <span className="truncate">수치변경</span>
                                                </span>
                                            </button>
                                        )}
                                    </>
                                )}
                                {selectedOption.type === 'mythicSub' && (
                                    <button
                                        onClick={() => setRefinementType('mythic')}
                                        className={`group relative min-w-0 w-full py-1.5 px-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-300 overflow-hidden ${
                                            refinementType === 'mythic'
                                                ? 'bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white shadow-[0_0_16px_rgba(249,115,22,0.55)] ring-1 ring-white/30'
                                                : 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 hover:from-gray-600 hover:to-gray-700 hover:shadow-lg'
                                        }`}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%]" />
                                        <span className="relative z-10 flex items-center justify-center gap-0.5 sm:gap-1">
                                            <span className="text-xs sm:text-sm shrink-0">✨</span>
                                            <span className="truncate">신화 옵션 변경</span>
                                        </span>
                                    </button>
                                )}
                            </div>

                            {refinementType && (
                                <>
                                    {/* 변경 가능한 옵션/수치 표시 */}
                                    <div className="bg-gray-900/50 p-1.5 rounded">
                                        <div className="text-gray-400 text-xs mb-1">
                                            {refinementType === 'value' ? '변경 가능한 수치 범위' : '변경 가능한 옵션'}
                                        </div>
                                        <div className="text-xs space-y-0.5 max-h-24 overflow-y-auto">
                                            {availableOptions.length > 0 ? (
                                                availableOptions.map((opt, idx) => (
                                                    <div key={idx} className="text-green-300">
                                                        {refinementType === 'mythic' ? (
                                                            <MythicStatAbbrev stat={opt.type as MythicStat} textClassName="text-green-300" bubbleSide="right" />
                                                        ) : (
                                                            <>
                                                                {opt.name}
                                                                {opt.range && (
                                                                    <span className="text-yellow-300">
                                                                        {' '}{opt.range[0]}~{opt.range[1]}{opt.isPercentage ? '%' : ''}
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-red-400">변경 가능한 옵션이 없습니다.</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 필요 재료 (이미지로 표시) */}
                                    <div className="bg-gray-900/50 p-1.5 rounded">
                                        <div className="text-gray-400 text-xs mb-1">필요 재료</div>
                                        <div className="flex flex-wrap gap-2 items-center">
                                            {/* 변경권 */}
                                            {ticketItemInfo && (
                                                <div
                                                    className="flex items-center gap-1 bg-gray-800/50 p-1 rounded"
                                                    title={`${ticketItemInfo.name}\n${ticketItemInfo.description}`}
                                                >
                                                    <img
                                                        src={ticketItemInfo.image}
                                                        alt={ticketItemInfo.name}
                                                        className="w-6 h-6 object-contain"
                                                    />
                                                    <span
                                                        className={`text-xs whitespace-nowrap ${
                                                            ticketCounts[
                                                                refinementType === 'type'
                                                                    ? 'type'
                                                                    : refinementType === 'value'
                                                                      ? 'value'
                                                                      : 'mythic'
                                                            ] >= requiredTickets
                                                                ? 'text-white'
                                                                : 'text-red-400'
                                                        }`}
                                                    >
                                                        {ticketCounts[
                                                            refinementType === 'type'
                                                                ? 'type'
                                                                : refinementType === 'value'
                                                                  ? 'value'
                                                                  : 'mythic'
                                                        ]}
                                                        /{requiredTickets}
                                                    </span>
                                                </div>
                                            )}
                                            {/* 골드 */}
                                            <div className="flex items-center gap-1 bg-gray-800/50 p-1 rounded">
                                                <img 
                                                    src="/images/icon/Gold.png" 
                                                    alt="골드"
                                                    className="w-6 h-6 object-contain"
                                                />
                                                <span className={`text-xs ${currentUser.gold >= requiredGold ? 'text-white' : 'text-red-400'}`}>
                                                    {requiredGold.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 제련하기 버튼 (호버 scale 제거 + 폭 살짝 여유로 좌우 스크롤 방지) */}
                                    <button
                                        onClick={handleRefine}
                                        disabled={!canRefine || isRefining}
                                        className={`group relative mx-auto block w-full max-w-[92%] min-w-0 py-2 px-2.5 rounded-lg text-xs font-bold transition-all duration-300 overflow-hidden ${
                                            canRefine && !isRefining
                                                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white shadow-[0_0_14px_rgba(251,146,60,0.55)] hover:shadow-[0_0_20px_rgba(251,146,60,0.75)]'
                                                : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                                        }`}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%]"></div>
                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                            <span className="text-base">⚒️</span>
                                            <span>제련하기</span>
                                        </span>
                                    </button>

                                    {/* 진행 바 애니메이션 (버튼 밑) */}
                                    {isRefining && (
                                        <div className="w-full">
                                            <div className="w-full bg-gray-700 rounded-full h-2">
                                                <div
                                                    className="bg-blue-600 h-2 rounded-full transition-all duration-100"
                                                    style={{ width: `${refinementProgress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="text-gray-500 text-xs text-center py-4">
                            좌측에서 옵션을 선택해주세요.
                        </div>
                    )}
                    </div>

                    <div
                        className="mt-2 pt-1.5 border-t border-gray-600/60 shrink-0"
                        role="group"
                        aria-label="보유 옵션 변경권"
                    >
                        <div className="flex gap-1 justify-between items-end">
                            {REFINEMENT_TICKET_DEFS.map(({ id, itemKey }) => {
                                const def = MATERIAL_ITEMS[itemKey];
                                return (
                                    <RefinementOwnedTicketSlot
                                        key={id}
                                        id={id}
                                        name={def.name}
                                        description={def.description}
                                        image={def.image}
                                        count={ticketCounts[id]}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RefinementView;
