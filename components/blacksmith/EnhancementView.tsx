
import { useLocalizedItemGrade, useLocalizedEquipmentSlot } from '../../shared/i18n/localizedCatalog.js';
import { useTranslation } from 'react-i18next';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { UserWithStatus, InventoryItem, ServerAction, ItemGrade, ItemOption } from '../../types.js';
import Button from '../Button.js';
import ResourceActionButton from '../ui/ResourceActionButton.js';
import { ENHANCEMENT_SUCCESS_RATES, ENHANCEMENT_COSTS, MATERIAL_ITEMS, ENHANCEMENT_FAIL_BONUS_RATES, GRADE_LEVEL_REQUIREMENTS, formatEquipLevelRequirement, calculateEnhancementGoldCost } from '../../constants';
import { isFunctionVipActive } from '../../shared/utils/rewardVip.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { MythicSubsPartitioned } from '../MythicSubsPartitioned.js';
import { formatSpecialSubLineForPanel } from '../../shared/utils/specialStatMilestones.js';
import { formatGoldAmountKoG } from '../../shared/utils/walletAmountDisplay.js';
import { formatBlacksmithPercentInt } from '../../shared/utils/formatBlacksmithPercentInt.js';
import { getBlacksmithViewerTypography, BLACKSMITH_MOBILE_WORK_ROOT_CLASS } from '../../shared/constants/blacksmithViewerTypography.js';

const gradeStyles: Record<ItemGrade, { color: string; background: string; }> = {
    normal: { color: 'text-gray-300', background: '/images/equipments/normalbgi.webp' },
    uncommon: { color: 'text-green-400', background: '/images/equipments/uncommonbgi.webp' },
    rare: { color: 'text-blue-400', background: '/images/equipments/rarebgi.webp' },
    epic: { color: 'text-purple-400', background: '/images/equipments/epicbgi.webp' },
    legendary: { color: 'text-red-500', background: '/images/equipments/legendarybgi.webp' },
    mythic: { color: 'text-orange-400', background: '/images/equipments/mythicbgi.webp' },
    transcendent: { color: 'text-cyan-300', background: '/images/equipments/transcendentbgi.webp' },
};

const renderStarDisplay = (stars: number, previousStars?: number, isAnimating?: boolean) => {
    if (stars === 0) return null;

    let starImage = '';
    let numberColor = '';

    if (stars >= 10) {
        starImage = '/images/equipments/Star4.webp';
        numberColor = "prism-text-effect";
    } else if (stars >= 7) {
        starImage = '/images/equipments/Star3.webp';
        numberColor = "text-purple-400";
    } else if (stars >= 4) {
        starImage = '/images/equipments/Star2.webp';
        numberColor = "text-amber-400";
    } else if (stars >= 1) {
        starImage = '/images/equipments/Star1.webp';
        numberColor = "text-white";
    }

    // 별 색상이 바뀌었는지 확인 (3→4, 6→7, 9→10)
    const starTierChanged = previousStars !== undefined && (
        (previousStars < 4 && stars >= 4) ||
        (previousStars < 7 && stars >= 7) ||
        (previousStars < 10 && stars >= 10)
    );

    return (
        <div
            className="absolute right-1.5 top-0.5 z-10 flex items-center gap-0.5 rounded-bl-md bg-black/45 px-1 py-0.5 backdrop-blur-[2px]"
            style={{ textShadow: '1px 1px 2px black' }}
        >
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

const ItemDisplay: React.FC<{
    item: InventoryItem;
    previousStars?: number;
    isAnimating?: boolean;
    pcViewer?: boolean;
    mobileWork?: boolean;
}> = ({
    item,
    previousStars,
    isAnimating,
    pcViewer = false,
    mobileWork = false,
}) => {
    const { currentUserWithStatus } = useAppContext();
    const styles = gradeStyles[item.grade];
    const typo = getBlacksmithViewerTypography(pcViewer, { mobileWork });

    const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
    const userLevelSum = currentUserWithStatus?.userLevel ?? 0;
    const canEquip = userLevelSum >= requiredLevel;

    return (
        <div className="flex flex-col w-full h-full p-1">
            {/* Top section: Image and Name/Main Option */}
            <div className="mb-1.5 flex">
                <div className={`relative w-20 h-20 rounded-lg flex-shrink-0 mr-3 ${item.grade === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''}`}>
                    <img src={styles.background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                    {item.image && <img src={item.image} alt={item.name} className="absolute object-contain p-1" style={{ width: '80%', height: '80%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />}
                    {renderStarDisplay(item.stars, previousStars, isAnimating)}
                </div>
                <div className="min-w-0 flex-grow pt-1">
                    <h3 className={`${typo.headingLg} leading-snug whitespace-nowrap overflow-hidden text-ellipsis ${styles.color}`} title={item.name}>
                        {item.name}
                    </h3>
                    <p className={`${typo.body} ${canEquip ? 'text-gray-500' : 'text-red-500'}`}>
                        ({formatEquipLevelRequirement(requiredLevel)})
                    </p>
                    {item.options?.main && (
                        <p
                            className={`${typo.bodySemi} text-yellow-300 whitespace-nowrap overflow-hidden text-ellipsis`}
                            title={item.options.main.display}
                        >
                            {item.options.main.display}
                        </p>
                    )}
                </div>
            </div>
            {/* Bottom section: Full-width sub-options */}
            <div className={`w-full flex-grow space-y-0.5 overflow-y-auto rounded-lg bg-black/30 p-1.5 text-left ${typo.body}`}>
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
                            <p key={`s-${i}`} className="text-green-300">
                                {formatSpecialSubLineForPanel(opt, item.stars ?? 0)}
                            </p>
                        ))}
                    </div>
                )}
                {item.options?.mythicSubs && item.options.mythicSubs.length > 0 ? (
                    <MythicSubsPartitioned subs={item.options.mythicSubs} enlargeBody={pcViewer || mobileWork} />
                ) : null}
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
                {success ? t('enhance.success') : t('enhance.fail')}
            </h2>
            <p className="text-gray-300 mt-2 text-center">{message}</p>
            {success && (
                <div className="bg-gray-800/50 p-3 rounded-lg mt-4 w-full max-w-sm text-xs space-y-1">
                    <h4 className="font-bold text-center text-yellow-300 mb-2">{t('enhance.changes')}</h4>
                    <div className="flex justify-between">
                        <span>{t('enhance.gradeLabel')}</span>
                        <span className="flex items-center gap-2">
                            <span className={starInfoBefore.colorClass}>{starInfoBefore.text || t('notEnhanced', { ns: 'common' })}</span>
                             → 
                            <span className={starInfoAfter.colorClass}>{starInfoAfter.text}</span>
                        </span>
                    </div>
                    {itemBefore.options && itemAfter.options && <div className="flex justify-between"><span>{t('enhance.mainOption')}</span> <span className="truncate">{itemBefore.options.main.display} → {itemAfter.options.main.display}</span></div>}
                    {changedSubOption?.type === 'new' && changedSubOption.option && <div className="flex justify-between text-green-300"><span>{t('enhance.subOptionAdd')}</span> <span className="truncate">{changedSubOption.option.display}</span></div>}
                    {changedSubOption?.type === 'upgraded' && changedSubOption.before && <div className="flex justify-between text-green-300"><span>{t('enhance.subOptionUpgrade')}</span> <span className="truncate">{changedSubOption.before.display} → {changedSubOption.after.display}</span></div>}
                </div>
            )}
            <Button onClick={onConfirm} colorScheme="green" className="mt-6 w-full max-w-sm">{t('actions.ok', { ns: 'common' })}</Button>
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
    /** 좁은 대장간 뷰: 좌우 패널을 세로 스택 */
    stackedViewport?: boolean;
}

const EnhancementView: React.FC<EnhancementViewProps> = ({
    selectedItem,
    currentUser,
    onAction,
    enhancementOutcome,
    onOutcomeConfirm,
    onStartEnhancement,
    stackedViewport = false,
}) => {
    const { t } = useTranslation('blacksmith');
    const localizedGrade = useLocalizedItemGrade();
    const pcViewer = !stackedViewport;
    const typo = getBlacksmithViewerTypography(pcViewer, { mobileWork: stackedViewport });
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

    const userLevelSum = currentUser ? currentUser.userLevel : 0;

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
        if (!selectedItem.options || selectedItem.stars >= 10) return { mainOptionPreview: t('enhance.maxPreview'), subOptionPreview: '' };

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
            subOptionPreview = t('enhance.noSubOption');
        } else if (combatSubs.length < 4) {
            subOptionPreview = t('enhance.newSubOption');
        } else {
            subOptionPreview = t('enhance.subOptionUpgradeShort');
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
        if (!selectedItem) return t('enhance.pickGear');
        if (isEnhancing) return t('enhance.enhancing');
        if (selectedItem.stars >= 10) return t('enhance.maxPreview');
        if (levelRequirement > 0 && !meetsLevelRequirement) {
            return t('enhance.levelInsufficient', { required: formatEquipLevelRequirement(levelRequirement) });
        }
        if (!costs) return t('enhance.noInfo');
        if (!hasEnoughGold) return t('enhance.goldInsufficient', { cost: formatGoldAmountKoG(goldCost) });
        if (!canEnhance) return t('enhance.materialInsufficient');
        return t('enhance.enhanceBtn', { stars: selectedItem.stars + 1 });
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
            <div className={`flex items-center justify-center h-full text-gray-500 ${typo.empty}`}>
                <p>{t('enhance.pickGear')}</p>
            </div>
        );
    }

    const baseSuccessRate =
        selectedItem.stars >= 10 ? 0 : ENHANCEMENT_SUCCESS_RATES[selectedItem.stars] ?? 0;
    const failBonusRate = ENHANCEMENT_FAIL_BONUS_RATES[selectedItem.grade] || 0.5;
    const failBonus = (selectedItem.enhancementFails || 0) * failBonusRate;
    const vipEnhanceBonus = isFunctionVipActive(currentUser) ? 10 : 0;
    const totalSuccessRate =
        selectedItem.stars >= 10 ? 0 : Math.min(100, baseSuccessRate + failBonus + vipEnhanceBonus);
    const successRateBreakdownParts: string[] = [];
    if (selectedItem.stars < 10) {
        successRateBreakdownParts.push(t('enhance.baseRate', { rate: formatBlacksmithPercentInt(baseSuccessRate) }));
        if (failBonus > 0) successRateBreakdownParts.push(t('enhance.failBonus', { rate: formatBlacksmithPercentInt(failBonus) }));
        if (vipEnhanceBonus > 0) successRateBreakdownParts.push(t('enhance.vipBonus', { rate: formatBlacksmithPercentInt(vipEnhanceBonus) }));
    }
    const successRateDisplay = selectedItem.stars >= 10 ? '—' : `${formatBlacksmithPercentInt(totalSuccessRate)}%`;

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

    const detailValueClass = typo.mono;
    const rateMainClass = stackedViewport
        ? 'text-lg font-bold leading-tight text-yellow-300'
        : 'text-2xl font-bold leading-tight text-yellow-300';

    return (
            <div className={`relative flex min-h-0 flex-col ${stackedViewport ? `${BLACKSMITH_MOBILE_WORK_ROOT_CLASS} min-h-[min(72dvh,100%)]` : 'h-full'}`}>
            <div
                className={`flex min-h-0 ${stackedViewport ? 'min-h-0 w-full flex-1 flex-col gap-2.5' : 'h-full flex-row gap-4'}`}
            >
                <div
                    className={`flex min-h-0 min-w-0 flex-col rounded-xl border border-amber-400/20 bg-gradient-to-b from-[#1a1f2d]/80 via-[#121724]/90 to-[#0c1018]/95 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                        stackedViewport ? 'max-h-[min(14rem,36dvh)] shrink-0 overflow-y-auto' : 'h-full w-[55%]'
                    }`}
                >
                    <ItemDisplay
                        item={selectedItem}
                        previousStars={previousStars}
                        isAnimating={isStarAnimating}
                        pcViewer={pcViewer}
                        mobileWork={stackedViewport}
                    />
                </div>

                <div
                    className={`flex min-h-0 min-w-0 flex-col gap-2 ${stackedViewport ? 'min-h-0 w-full flex-1 justify-center overflow-y-auto' : 'h-full flex-1'}`}
                >
                    {/* 강화 성공 시 정보 */}
                    <div className="flex-shrink-0 rounded-xl border border-emerald-400/25 bg-gradient-to-b from-emerald-950/25 via-black/40 to-black/30 p-2.5">
                        <h4 className={`mb-1.5 text-center ${typo.heading} text-emerald-200`}>{t('enhance.successRateTitle')}</h4>
                        <div className={`mx-auto w-full max-w-sm space-y-1.5 text-left ${typo.body}`}>
                            <div className="flex justify-between items-center gap-2 min-w-0">
                                <span className="flex-shrink-0 whitespace-nowrap text-gray-400">{t('enhance.gradeLabel')}</span>
                                <div className={`flex min-w-0 items-center gap-1 whitespace-nowrap text-white ${detailValueClass}`}>
                                    <span className={starInfoCurrent.colorClass}>{starInfoCurrent.text || '(★0)'}</span>
                                    <span>→</span>
                                    {starInfoNext ? <span className={starInfoNext.colorClass}>{starInfoNext.text}</span> : '-'}
                                </div> 
                            </div>
                            <div className="flex justify-between items-center gap-2 min-w-0">
                                <span className="flex-shrink-0 whitespace-nowrap text-gray-400">{t('enhance.mainOptionLabel')}</span>
                                <span className={`min-w-0 truncate text-right text-yellow-300 ${detailValueClass}`} title={mainOptionPreview}>{mainOptionPreview}</span> 
                            </div>
                            <div className="flex justify-between items-center gap-2 min-w-0">
                                <span className="flex-shrink-0 whitespace-nowrap text-gray-400">{t('enhance.subOptionLabel')}</span>
                                <span className={`min-w-0 truncate text-right ${detailValueClass} ${selectedItem && selectedItem.options && selectedItem.options.combatSubs.length > 0 ? 'text-blue-300' : 'text-gray-400'}`} title={selectedItem.stars < 10 ? subOptionPreview : ''}>{selectedItem.stars < 10 ? subOptionPreview : ''}</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* 필요 재료 | 성공확률 */}
                    <div className="flex min-w-0 flex-shrink-0 flex-col items-stretch gap-2">
                        <div className="min-w-0 w-full rounded-xl border border-white/10 bg-gradient-to-b from-slate-900/75 via-black/35 to-black/45 p-2">
                            <h4 className={`mb-2 text-center ${typo.heading} text-amber-100`}>{t('enhance.requiredMaterials')}</h4>
                            <div className="flex flex-wrap items-end justify-center gap-x-3 gap-y-2">
                                <div
                                    className="relative flex min-w-[3.25rem] flex-col items-center px-0.5"
                                    title={t('enhance.goldTitle', { current: formatGoldAmountKoG(currentUser?.gold || 0), cost: formatGoldAmountKoG(goldCost) })}
                                >
                                    <div className="relative h-8 w-8" style={{ background: 'transparent', borderRadius: 0, overflow: 'hidden' }}>
                                        <img src="/images/icon/Gold.webp" alt={t('gold', { ns: 'common' })} className="h-full w-full" style={{ background: 'transparent', borderRadius: 0, padding: 0, margin: 0, objectFit: 'contain', display: 'block', border: 'none', boxShadow: 'none' }} />
                                        {!hasEnoughGold && <div className="absolute inset-0 rounded-full bg-red-500/30" />}
                                    </div>
                                    <span className={`mt-0.5 w-full text-center ${typo.mono} leading-tight ${hasEnoughGold ? 'text-green-400' : 'text-red-400'}`}>
                                        {stackedViewport ? (
                                            <>
                                                <span className={`block ${typo.caption} font-medium text-slate-400`}>{t('ownedSlashRequired', { ns: 'common' })}</span>
                                                <span className="whitespace-nowrap">
                                                    {formatGoldAmountKoG(currentUser?.gold ?? 0)} / {formatGoldAmountKoG(goldCost)}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="whitespace-nowrap">{formatGoldAmountKoG(goldCost)}</span>
                                        )}
                                    </span>
                                </div>
                                {costs?.map((cost) => {
                                    const userHas = userMaterials[cost.name] || 0;
                                    const hasEnough = userHas >= cost.amount;
                                    return (
                                        <div key={cost.name} className="relative flex min-w-[3.25rem] max-w-[5.5rem] flex-col items-center px-0.5" title={`${cost.name}: ${userHas.toLocaleString()} / ${cost.amount.toLocaleString()}`}>
                                            <div className="relative h-8 w-8 shrink-0" style={{ background: 'transparent', borderRadius: 0, overflow: 'hidden' }}>
                                                <img src={MATERIAL_ITEMS[cost.name].image!} alt={cost.name} className="h-full w-full" style={{ background: 'transparent', borderRadius: 0, padding: 0, margin: 0, objectFit: 'contain', display: 'block', border: 'none', boxShadow: 'none' }} />
                                                {!hasEnough && <div className="absolute inset-0 rounded-full bg-red-500/30" />}
                                            </div>
                                            <span className={`mt-0.5 w-full max-w-full text-center ${typo.mono} leading-tight ${hasEnough ? 'text-green-400' : 'text-red-400'}`}>
                                                {stackedViewport ? (
                                                    <>
                                                        <span className={`block truncate ${typo.caption} font-semibold text-slate-300`} title={cost.name}>
                                                            {cost.name}
                                                        </span>
                                                        <span className={`block ${typo.caption} font-medium text-slate-400`}>{t('ownedSlashRequired', { ns: 'common' })}</span>
                                                        <span className="whitespace-nowrap">
                                                            {userHas.toLocaleString()} / {cost.amount.toLocaleString()}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="whitespace-nowrap">{cost.amount.toLocaleString()}</span>
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex min-w-0 w-full shrink-0 flex-col justify-center rounded-xl border border-amber-300/20 bg-gradient-to-b from-amber-950/25 via-black/45 to-black/30 p-2 text-center">
                            <h4 className={`mb-1 ${typo.heading} leading-tight text-amber-100`}>{t('enhance.successRate')}</h4>
                            <p className={rateMainClass}>{successRateDisplay}</p>
                            {selectedItem.stars < 10 && successRateBreakdownParts.length > 0 ? (
                                <p className={`mt-1 ${typo.caption} text-slate-400`}>{successRateBreakdownParts.join(' · ')}</p>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex flex-shrink-0 flex-col gap-2">
                        <div className="flex items-center">
                            <ResourceActionButton
                                onClick={handleEnhanceClick}
                                disabled={!canEnhance || isEnhancing || selectedItem.stars >= 10}
                                variant="gold"
                                className={`w-full whitespace-nowrap py-2.5 ${typo.bodySemi}`}
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



