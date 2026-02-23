
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { UserWithStatus, InventoryItem, ServerAction, ItemGrade, ItemOption } from '../../types.js';
import Button from '../Button.js';
import ResourceActionButton from '../ui/ResourceActionButton.js';
import { ENHANCEMENT_SUCCESS_RATES, ENHANCEMENT_COSTS, MATERIAL_ITEMS, ENHANCEMENT_FAIL_BONUS_RATES, GRADE_LEVEL_REQUIREMENTS, calculateEnhancementGoldCost } from '../../constants';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useIsMobileLayout } from '../../hooks/useIsMobileLayout.js';

const gradeStyles: Record<ItemGrade, { name: string; color: string; background: string; }> = {
    normal: { name: '일반', color: 'text-gray-300', background: '/images/equipments/normalbgi.png' },
    uncommon: { name: '고급', color: 'text-green-400', background: '/images/equipments/uncommonbgi.png' },
    rare: { name: '희귀', color: 'text-blue-400', background: '/images/equipments/rarebgi.png' },
    epic: { name: '에픽', color: 'text-purple-400', background: '/images/equipments/epicbgi.png' },
    legendary: { name: '전설', color: 'text-red-500', background: '/images/equipments/legendarybgi.png' },
    mythic: { name: '신화', color: 'text-orange-400', background: '/images/equipments/mythicbgi.png' },
};

const renderStarDisplay = (stars: number, previousStars?: number, isAnimating?: boolean) => {
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

    // 별 색상이 바뀌었는지 확인 (3→4, 6→7, 9→10)
    const starTierChanged = previousStars !== undefined && (
        (previousStars < 4 && stars >= 4) ||
        (previousStars < 7 && stars >= 7) ||
        (previousStars < 10 && stars >= 10)
    );

    return (
        <div className="absolute top-0.5 left-1.5 flex items-center gap-0.5 bg-black/40 rounded-br-md px-1 py-0.5 z-10" style={{ textShadow: '1px 1px 2px black' }}>
            <img 
                src={starImage} 
                alt="star" 
                className={`w-3 h-3 transition-all duration-500 ${
                    stars >= 10 
                        ? 'prism-star-glow' 
                        : ''
                } ${
                    starTierChanged && isAnimating 
                        ? 'animate-pulse scale-125 drop-shadow-[0_0_15px_currentColor]' 
                        : ''
                }`}
                style={stars >= 10 ? {
                    filter: 'drop-shadow(0 0 8px rgba(255, 0, 255, 0.8)) drop-shadow(0 0 12px rgba(0, 255, 255, 0.6)) drop-shadow(0 0 16px rgba(255, 255, 0, 0.4)) brightness(1.3) saturate(1.4)'
                } : (starTierChanged && isAnimating ? {
                    filter: 'drop-shadow(0 0 10px currentColor) brightness(1.3)'
                } : {})}
            />
            <span 
                className={`font-bold text-xs leading-none transition-all duration-500 ${
                    starTierChanged && isAnimating 
                        ? 'scale-125 animate-pulse' 
                        : ''
                } ${numberColor}`}
            >
                {stars}
            </span>
        </div>
    );
};

const ItemDisplay: React.FC<{ item: InventoryItem; previousStars?: number; isAnimating?: boolean }> = ({ item, previousStars, isAnimating }) => {
    const { currentUserWithStatus } = useAppContext();
    const styles = gradeStyles[item.grade];

    const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
    const userLevelSum = (currentUserWithStatus?.strategyLevel || 0) + (currentUserWithStatus?.playfulLevel || 0);
    const canEquip = userLevelSum >= requiredLevel;

    return (
        <div className="flex flex-col w-full h-full p-1">
            {/* Top section: Image and Name/Main Option */}
            <div className="flex mb-2">
                <div className="relative w-20 h-20 rounded-lg flex-shrink-0 mr-3">
                    <img src={styles.background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                    {item.image && <img src={item.image} alt={item.name} className="absolute object-contain p-1" style={{ width: '80%', height: '80%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />}
                    {renderStarDisplay(item.stars, previousStars, isAnimating)}
                    {item.isDivineMythic && (
                        <div 
                            className="absolute bottom-0 left-0 flex items-center justify-center bg-black/60 rounded-tr-md z-10" 
                            style={{ 
                                textShadow: '1px 1px 2px black',
                                padding: '2px 4px',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                color: '#FFD700'
                            }}
                        >
                            D
                        </div>
                    )}
                </div>
                <div className="flex-grow pt-2 min-w-0">
                    <h3 className={`text-base font-bold whitespace-nowrap overflow-hidden text-ellipsis ${styles.color}`} title={item.name}>{item.name}</h3>
                    <p className={`text-xs ${canEquip ? 'text-gray-500' : 'text-red-500'}`}>(착용레벨: {requiredLevel})</p>
                    {item.options?.main && (
                        <p className="font-semibold text-yellow-300 text-xs whitespace-nowrap overflow-hidden text-ellipsis" title={item.options.main.display}>{item.options.main.display}</p>
                    )}
                </div>
            </div>
            {/* Bottom section: Full-width sub-options */}
            <div className="w-full text-sm text-left space-y-1 bg-black/30 p-2 rounded-lg flex-grow overflow-y-auto">
                {item.options?.combatSubs && item.options.combatSubs.length > 0 && (
                    <div className="space-y-0.5">
                        {item.options.combatSubs.map((opt, i) => (
                            <p key={`c-${i}`} className="text-blue-300">{opt.display}</p>
                        ))}
                    </div>
                )}
                {item.options?.specialSubs && item.options.specialSubs.length > 0 && (
                     <div className="space-y-0.5">
                        {item.options.specialSubs.map((opt, i) => (
                            <p key={`s-${i}`} className="text-green-300">{opt.display}</p>
                        ))}
                    </div>
                )}
                {item.options?.mythicSubs && item.options.mythicSubs.length > 0 && (
                     <div className="space-y-0.5">
                        {item.options.mythicSubs.map((opt, i) => (
                            <p key={`m-${i}`} className="text-red-400">{opt.display}</p>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const getStarDisplayInfo = (stars: number) => {
    if (stars >= 10) {
        return { text: `(★${stars})`, colorClass: "prism-text-effect" };
    } else if (stars >= 7) {
        return { text: `(★${stars})`, colorClass: "text-purple-400" };
    } else if (stars >= 4) {
        return { text: `(★${stars})`, colorClass: "text-amber-400" };
    } else if (stars >= 1) {
        return { text: `(★${stars})`, colorClass: "text-white" };
    }
    return { text: "", colorClass: "text-white" };
};

const EnhancementResultDisplay: React.FC<{ outcome: { message: string; success: boolean; itemBefore: InventoryItem; itemAfter: InventoryItem; } | null, onConfirm: () => void }> = ({ outcome, onConfirm }) => {
    if (!outcome) return null;

    const { success, message, itemBefore, itemAfter } = outcome;

    const changedSubOption = useMemo(() => {
        if (!success || !itemBefore.options || !itemAfter.options) return null;
        
        if (itemAfter.options.combatSubs.length > itemBefore.options.combatSubs.length) {
            const newSub = itemAfter.options.combatSubs.find(afterSub => 
                !itemBefore.options!.combatSubs.some(beforeSub => beforeSub.type === afterSub.type && beforeSub.isPercentage === afterSub.isPercentage)
            );
            return newSub ? { type: 'new', option: newSub } : null;
        }

        for (const afterSub of itemAfter.options.combatSubs) {
            const beforeSub = itemBefore.options.combatSubs.find(s => s.type === afterSub.type && s.isPercentage === afterSub.isPercentage);
            if (!beforeSub || beforeSub.value !== afterSub.value) {
                return { type: 'upgraded', before: beforeSub, after: afterSub };
            }
        }
        return null;
    }, [success, itemBefore, itemAfter]);

    const starInfoBefore = getStarDisplayInfo(itemBefore.stars);
    const starInfoAfter = getStarDisplayInfo(itemAfter.stars);

    return (
        <div className="absolute inset-0 bg-gray-900/80 rounded-lg flex flex-col items-center justify-center z-20 animate-fade-in p-4">
            <div className={`text-6xl mb-4 ${success ? 'animate-bounce' : ''}`}>{success ? '🎉' : '💥'}</div>
            <h2 className={`text-3xl font-bold ${success ? 'text-green-400' : 'text-red-400'}`}>
                {success ? '강화 성공!' : '강화 실패...'}
            </h2>
            <p className="text-gray-300 mt-2 text-center">{message}</p>
            {success && (
                <div className="bg-gray-800/50 p-3 rounded-lg mt-4 w-full max-w-sm text-xs space-y-1">
                    <h4 className="font-bold text-center text-yellow-300 mb-2">변경 사항</h4>
                    <div className="flex justify-between">
                        <span>등급:</span> 
                        <span className="flex items-center gap-2">
                            <span className={starInfoBefore.colorClass}>{starInfoBefore.text || '(미강화)'}</span>
                             → 
                            <span className={starInfoAfter.colorClass}>{starInfoAfter.text}</span>
                        </span>
                    </div>
                    {itemBefore.options && itemAfter.options && <div className="flex justify-between"><span>주옵션:</span> <span className="truncate">{itemBefore.options.main.display} → {itemAfter.options.main.display}</span></div>}
                    {changedSubOption?.type === 'new' && changedSubOption.option && <div className="flex justify-between text-green-300"><span>부옵션 추가:</span> <span className="truncate">{changedSubOption.option.display}</span></div>}
                    {changedSubOption?.type === 'upgraded' && changedSubOption.before && <div className="flex justify-between text-green-300"><span>부옵션 강화:</span> <span className="truncate">{changedSubOption.before.display} → {changedSubOption.after.display}</span></div>}
                </div>
            )}
            <Button onClick={onConfirm} colorScheme="green" className="mt-6 w-full max-w-sm">확인</Button>
        </div>
    );
};

interface EnhancementViewProps {
    selectedItem: InventoryItem | null;
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => void;
    enhancementOutcome: { message: string; success: boolean; itemBefore: InventoryItem; itemAfter: InventoryItem; } | null;
    onOutcomeConfirm: () => void;
    onStartEnhancement?: (item: InventoryItem) => void;
}

const EnhancementView: React.FC<EnhancementViewProps> = ({ selectedItem, currentUser, onAction, enhancementOutcome, onOutcomeConfirm, onStartEnhancement }) => {
    const isMobile = useIsMobileLayout(768);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [enhancementProgress, setEnhancementProgress] = useState(0);
    const [previousStars, setPreviousStars] = useState<number | undefined>(undefined);
    const [isStarAnimating, setIsStarAnimating] = useState(false);
    const enhancementIntervalRef = useRef<number | null>(null);
    const enhancementTimeoutRef = useRef<number | null>(null);

    const clearEnhancementTimers = useCallback(() => {
        if (enhancementIntervalRef.current !== null) {
            window.clearInterval(enhancementIntervalRef.current);
            enhancementIntervalRef.current = null;
        }
        if (enhancementTimeoutRef.current !== null) {
            window.clearTimeout(enhancementTimeoutRef.current);
            enhancementTimeoutRef.current = null;
        }
    }, []);

    const costs = useMemo(() => {
        if (!selectedItem) return null;
        return ENHANCEMENT_COSTS[selectedItem.grade]?.[selectedItem.stars];
    }, [selectedItem]);

    const userLevelSum = currentUser ? currentUser.strategyLevel + currentUser.playfulLevel : 0;

    const levelRequirement = useMemo(() => {
        if (!selectedItem) return 0;
        const nextStars = selectedItem.stars + 1;
        if (nextStars === 4) return 3;
        if (nextStars === 7) return 8;
        if (nextStars === 10) return 15;
        return 0;
    }, [selectedItem]);

    const meetsLevelRequirement = userLevelSum >= levelRequirement;

    const userMaterials = useMemo(() => {
        if (!currentUser) return {};
        const counts: Record<string, number> = {};
        for (const material of Object.keys(MATERIAL_ITEMS)) {
            counts[material] = currentUser.inventory
                .filter(i => i.name === material)
                .reduce((sum, i) => sum + (i.quantity || 0), 0);
        }
        return counts;
    }, [currentUser]);

    const goldCost = useMemo(() => {
        if (!selectedItem) return 0;
        return calculateEnhancementGoldCost(selectedItem.grade, selectedItem.stars);
    }, [selectedItem]);

    const hasEnoughGold = useMemo(() => {
        if (!currentUser) return false;
        return currentUser.gold >= goldCost;
    }, [currentUser, goldCost]);

    const canEnhance = useMemo(() => {
        if (!selectedItem) return false;
        if (!costs) return false;
        if (levelRequirement > 0 && !meetsLevelRequirement) return false;
        if (!hasEnoughGold) return false;
        return costs.every(cost => userMaterials[cost.name] >= cost.amount);
    }, [costs, userMaterials, levelRequirement, meetsLevelRequirement, selectedItem, hasEnoughGold]);

    const { mainOptionPreview, subOptionPreview } = useMemo(() => {
        if (!selectedItem) {
            return { mainOptionPreview: '', subOptionPreview: '' };
        }
        if (!selectedItem.options || selectedItem.stars >= 10) return { mainOptionPreview: '최대 강화', subOptionPreview: '' };

        const { main, combatSubs } = selectedItem.options;
        const mainBaseValue = main.baseValue;

        if (!mainBaseValue) {
            return { mainOptionPreview: 'N/A', subOptionPreview: 'N/A' };
        }
        
        let increaseMultiplier = 1;
        if ([3, 6, 9].includes(selectedItem.stars)) {
            increaseMultiplier = 2;
        }
        const increaseAmount = mainBaseValue * increaseMultiplier;
        const newValue = main.value + increaseAmount;
        
        const mainPrev = `${main.type} +${main.value.toFixed(2).replace(/\.00$/, '')}${main.isPercentage ? '%' : ''}`;
        const mainNext = `+${newValue.toFixed(2).replace(/\.00$/, '')}${main.isPercentage ? '%' : ''}`;
        const mainOptionPreview = `${mainPrev} → ${mainNext}`;

        // 부옵션 간단한 표현
        let subOptionPreview = '';
        if (combatSubs.length === 0) {
            subOptionPreview = '부옵션 없음';
        } else if (combatSubs.length < 4) {
            subOptionPreview = '신규 부옵션 생성';
        } else {
            subOptionPreview = '부옵션 강화';
        }
        
        return { mainOptionPreview, subOptionPreview };
    }, [selectedItem]);
    
    const starInfoCurrent = useMemo(() => {
        if (!selectedItem) return { text: "", colorClass: "text-white" };
        return getStarDisplayInfo(selectedItem.stars);
    }, [selectedItem]);

    const starInfoNext = useMemo(() => {
        if (!selectedItem || selectedItem.stars >= 10) return null;
        return getStarDisplayInfo(selectedItem.stars + 1);
    }, [selectedItem]);

    const buttonText = useMemo(() => {
        if (!selectedItem) return '강화할 장비를 선택해주세요.';
        if (isEnhancing) return '강화 중...';
        if (selectedItem.stars >= 10) return '최대 강화';
        if (levelRequirement > 0 && !meetsLevelRequirement) return `레벨 부족 (합 ${levelRequirement} 필요)`;
        if (!costs) return '강화 정보 없음';
        if (!hasEnoughGold) return `골드 부족 (필요: ${goldCost.toLocaleString()})`;
        if (!canEnhance) return '재료 부족';
        return `강화하기 (+${selectedItem.stars + 1})`;
    }, [isEnhancing, selectedItem, levelRequirement, meetsLevelRequirement, costs, canEnhance, hasEnoughGold, goldCost]);

    useEffect(() => {
    return () => {
        clearEnhancementTimers();
    };
}, [clearEnhancementTimers]);

useEffect(() => {
        setIsEnhancing(false);
        setEnhancementProgress(0);
        clearEnhancementTimers();
        setPreviousStars(undefined);
        setIsStarAnimating(false);
    }, [selectedItem, clearEnhancementTimers]);

    // 강화 결과가 나왔을 때 별 애니메이션 트리거
    useEffect(() => {
        if (enhancementOutcome?.success && selectedItem) {
            const beforeStars = enhancementOutcome.itemBefore.stars;
            const afterStars = enhancementOutcome.itemAfter.stars;
            
            // 별 색상이 바뀌었는지 확인 (3→4, 6→7, 9→10)
            const starTierChanged = (
                (beforeStars < 4 && afterStars >= 4) ||
                (beforeStars < 7 && afterStars >= 7) ||
                (beforeStars < 10 && afterStars >= 10)
            );

            if (starTierChanged) {
                setPreviousStars(beforeStars);
                setIsStarAnimating(true);
                // 2초 후 애니메이션 종료
                const timer = setTimeout(() => {
                    setIsStarAnimating(false);
                }, 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [enhancementOutcome, selectedItem]);

    if (!selectedItem) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                <p>강화할 장비를 선택해주세요.</p>
            </div>
        );
    }

    const baseSuccessRate = ENHANCEMENT_SUCCESS_RATES[selectedItem.stars];
    const failBonusRate = ENHANCEMENT_FAIL_BONUS_RATES[selectedItem.grade] || 0.5;
    const failBonus = (selectedItem.enhancementFails || 0) * failBonusRate;

    const handleEnhanceClick = () => {
        if (!canEnhance || isEnhancing || !selectedItem) return;

        setIsEnhancing(true);
        setEnhancementProgress(0);

        clearEnhancementTimers();

        // 제련 시작 시 즉시 모달을 열고 롤링 애니메이션 시작
        if (onStartEnhancement) {
            onStartEnhancement(selectedItem);
        }

        const duration = 2000;
        const targetItemId = selectedItem.id;
        const startTime = Date.now();

        enhancementIntervalRef.current = window.setInterval(() => {
            const elapsed = Date.now() - startTime;
            const percent = Math.min(100, Math.round((elapsed / duration) * 100));
            setEnhancementProgress(percent);
            if (elapsed >= duration && enhancementIntervalRef.current !== null) {
                window.clearInterval(enhancementIntervalRef.current);
                enhancementIntervalRef.current = null;
            }
        }, 50);

        enhancementTimeoutRef.current = window.setTimeout(() => {
            enhancementTimeoutRef.current = null;
            (async () => {
                try {
                    setEnhancementProgress(100);
                    await onAction({ type: 'ENHANCE_ITEM', payload: { itemId: targetItemId } });
                } catch (error) {
                    console.error('[EnhancementView] Failed to enhance item:', error);
                } finally {
                    clearEnhancementTimers();
                    setIsEnhancing(false);
                    setEnhancementProgress(0);
                }
            })();
        }, duration);
    };

    return (
            <div className={`relative ${isMobile ? 'h-auto' : 'h-full'} flex flex-col ${isMobile ? 'gap-2' : ''}`}>
            <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-4 ${isMobile ? 'h-auto' : 'h-full min-h-0'}`}>
                <div className={`${isMobile ? 'w-full' : 'w-[55%]'} flex flex-col bg-gray-900/40 ${isMobile ? 'p-1' : 'p-2'} rounded-lg ${isMobile ? 'h-auto' : 'h-full min-h-0'}`}>
                    <ItemDisplay 
                        item={selectedItem} 
                        previousStars={previousStars}
                        isAnimating={isStarAnimating}
                    />
                </div>

                <div className={`${isMobile ? 'w-full' : 'flex-1'} flex flex-col gap-2 ${isMobile ? 'h-auto' : 'h-full min-h-0'}`}>
                    {/* 강화 성공 시 정보 */}
                    <div className="bg-gray-900/50 p-2 rounded-lg flex-shrink-0">
                        <h4 className="font-semibold text-center mb-1.5 text-green-300 text-xs">강화 성공 시</h4>
                        <div className="space-y-1.5 text-xs text-left">
                            <div className="flex justify-between items-center gap-2 min-w-0">
                                <span className="text-gray-400 whitespace-nowrap flex-shrink-0 text-xs">등급:</span>
                                <div className="font-mono text-white flex items-center gap-1 whitespace-nowrap" style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.75rem)' }}>
                                    <span className={starInfoCurrent.colorClass}>{starInfoCurrent.text || '(★0)'}</span>
                                    <span>→</span>
                                    {starInfoNext ? <span className={starInfoNext.colorClass}>{starInfoNext.text}</span> : '-'}
                                </div> 
                            </div>
                            <div className="flex justify-between items-center gap-2 min-w-0">
                                <span className="text-gray-400 whitespace-nowrap flex-shrink-0 text-xs">주옵션:</span>
                                <span className="font-mono text-yellow-300 whitespace-nowrap overflow-hidden text-ellipsis text-right" style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.75rem)' }} title={mainOptionPreview}>{mainOptionPreview}</span> 
                            </div>
                            <div className="flex justify-between items-center gap-2 min-w-0">
                                <span className="text-gray-400 whitespace-nowrap flex-shrink-0 text-xs">부옵션:</span>
                                <span className={`font-mono whitespace-nowrap overflow-hidden text-ellipsis text-right ${selectedItem && selectedItem.options && selectedItem.options.combatSubs.length > 0 ? 'text-blue-300' : 'text-gray-400'}`} style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.75rem)' }} title={selectedItem.stars < 10 ? subOptionPreview : ''}>{selectedItem.stars < 10 ? subOptionPreview : ''}</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* 필요 재료 */}
                    <div className="bg-gray-900/50 p-2 rounded-lg flex-shrink-0">
                        <h4 className="font-semibold text-center mb-2 text-xs">필요 재료</h4>
                        <div className="flex flex-wrap gap-3 justify-center items-center">
                            {/* 골드 비용 표시 */}
                            <div className="relative flex flex-col items-center px-1" title={`골드: ${(currentUser?.gold || 0).toLocaleString()} / ${goldCost.toLocaleString()}`}>
                                <div className="relative w-8 h-8" style={{ background: 'transparent', borderRadius: 0, overflow: 'hidden' }}>
                                    <img src="/images/icon/Gold.png" alt="골드" className="w-full h-full" style={{ background: 'transparent', borderRadius: 0, padding: 0, margin: 0, objectFit: 'contain', display: 'block', border: 'none', boxShadow: 'none' }} />
                                    {!hasEnoughGold && <div className="absolute inset-0 bg-red-500/30 rounded-full"></div>}
                                </div>
                                <span className={`font-mono mt-0.5 whitespace-nowrap ${hasEnoughGold ? 'text-green-400' : 'text-red-400'}`} style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.75rem)' }}>
                                    {goldCost.toLocaleString()}
                                </span>
                            </div>
                            {costs?.map(cost => {
                                const userHas = userMaterials[cost.name] || 0;
                                const hasEnough = userHas >= cost.amount;
                                return (
                                    <div key={cost.name} className="relative flex flex-col items-center px-1" title={`${cost.name}: ${userHas.toLocaleString()} / ${cost.amount.toLocaleString()}`}>
                                        <div className="relative w-8 h-8" style={{ background: 'transparent', borderRadius: 0, overflow: 'hidden' }}>
                                            <img src={MATERIAL_ITEMS[cost.name].image!} alt={cost.name} className="w-full h-full" style={{ background: 'transparent', borderRadius: 0, padding: 0, margin: 0, objectFit: 'contain', display: 'block', border: 'none', boxShadow: 'none' }} />
                                            {!hasEnough && <div className="absolute inset-0 bg-red-500/30 rounded-full"></div>}
                                        </div>
                                        <span className={`font-mono mt-0.5 whitespace-nowrap ${hasEnough ? 'text-green-400' : 'text-red-400'}`} style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.75rem)' }}>
                                            {cost.amount.toLocaleString()}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* 확률과 버튼을 세로로 배치 */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                        <div className="bg-gray-900/50 p-2 rounded-lg text-center flex flex-col justify-center">
                            <h4 className="font-semibold mb-1 text-xs whitespace-nowrap">강화 성공 확률</h4>
                            <p className="font-bold text-yellow-300 whitespace-nowrap" style={{ fontSize: 'clamp(1rem, 3vw, 1.5rem)' }}>
                                {baseSuccessRate}%
                                {failBonus > 0 && <span className="text-green-400 ml-1" style={{ fontSize: 'clamp(0.875rem, 2vw, 1.125rem)' }}>(+{failBonus.toFixed(1).replace(/\.0$/, '')}%)</span>}
                            </p>
                        </div>
                        <div className="flex items-center">
                            <ResourceActionButton
                                onClick={handleEnhanceClick}
                                disabled={!canEnhance || isEnhancing || selectedItem.stars >= 10}
                                variant="gold"
                                className="w-full py-2 whitespace-nowrap"
                                style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}
                            >
                                {buttonText}
                            </ResourceActionButton>
                        </div>
                        <div className="h-2 w-full bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/60">
                            <div
                                className={`h-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 transition-[width] duration-100 ease-linear ${isEnhancing ? '' : 'opacity-0'}`}
                                style={{ width: `${isEnhancing ? enhancementProgress : 0}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EnhancementView;



