import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { UserWithStatus, InventoryItem, ServerAction, InventoryItemType, ItemGrade, ItemOption, CoreStat, SpecialStat, MythicStat, EquipmentSlot, ItemOptionType } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import ResourceActionButton from './ui/ResourceActionButton.js';
import { emptySlotImages, GRADE_LEVEL_REQUIREMENTS, ITEM_SELL_PRICES, MATERIAL_SELL_PRICES, gradeBackgrounds, gradeStyles, BASE_SLOTS_PER_CATEGORY, EXPANSION_AMOUNT, MAX_EQUIPMENT_SLOTS, MAX_CONSUMABLE_SLOTS, MAX_MATERIAL_SLOTS, ENHANCEMENT_COSTS, CONSUMABLE_ITEMS, MATERIAL_ITEMS, isActionPointConsumable, isTowerOnlyConsumable, isRefinementTicketMaterial } from '../constants/items';

import { calculateUserEffects } from '../services/effectService.js';
import { calculateTotalStats } from '../services/statService.js';
import { useAppContext } from '../hooks/useAppContext.js';
import PurchaseQuantityModal from './PurchaseQuantityModal.js';
import SellItemConfirmModal from './SellItemConfirmModal.js';
import SellMaterialBulkModal from './SellMaterialBulkModal.js';
import UseQuantityModal from './UseQuantityModal.js';
import { MythicOptionAbbrev } from './MythicStatAbbrev.js';

interface InventoryModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void | Promise<void | { gameId?: string; claimAllTrainingQuestRewards?: any }>;
    onStartEnhance: (item: InventoryItem) => void;
    enhancementAnimationTarget: { itemId: string; stars: number } | null;
    onAnimationComplete: () => void;
    isTopmost?: boolean;
}

type Tab = 'all' | 'equipment' | 'consumable' | 'material';
type SortKey = 'createdAt' | 'type' | 'grade';

const TAB_LABELS: Record<Tab, string> = {
    all: '전체',
    equipment: '장비',
    consumable: '소모품',
    material: '재료',
};

const calculateExpansionCost = (currentCategorySlots: number): number => {
    const expansionsMade = Math.max(0, (currentCategorySlots - BASE_SLOTS_PER_CATEGORY) / EXPANSION_AMOUNT);
    return 100 + (expansionsMade * 20);
};

const gradeOrder: Record<ItemGrade, number> = {
    normal: 0,
    uncommon: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
    mythic: 5,
    transcendent: 6,
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

const EquipmentSlotDisplay: React.FC<{ 
    slot: EquipmentSlot; 
    item?: InventoryItem; 
    scaleFactor?: number;
    onClick?: () => void;
    isSelected?: boolean;
}> = ({ slot, item, scaleFactor = 1, onClick, isSelected = false }) => {
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

        const starSize = Math.max(8, Math.round(10 * scaleFactor));
        const fontSize = Math.max(8, Math.round(10 * scaleFactor));
        const gap = Math.max(2, Math.round(2 * scaleFactor));
        const padding = Math.max(2, Math.round(2 * scaleFactor));
        const innerPadding = Math.max(4, Math.round(6 * scaleFactor));

        return (
            <div 
                className="absolute flex items-center bg-black/40 rounded-bl-md z-10" 
                style={{ 
                    textShadow: '1px 1px 2px black',
                    top: `${innerPadding}px`,
                    right: `${innerPadding + 6}px`,
                    gap: `${gap}px`,
                    padding: `${padding}px`
                }}
            >
                <img src={starImage} alt="star" style={{ width: `${starSize}px`, height: `${starSize}px` }} />
                <span className={`font-bold leading-none ${numberColor}`} style={{ fontSize: `${fontSize}px` }}>{stars}</span>
            </div>
        );
    };

    if (item) {
        const padding = Math.max(4, Math.round(6 * scaleFactor));
        const borderWidth = Math.max(1, Math.round(2 * scaleFactor));
        const isTranscendent = item.grade === ItemGrade.Transcendent;
        return (
            <div
                className={`relative aspect-square rounded-lg bg-tertiary/50 ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-accent/70' : ''} ${isSelected ? 'ring-2 ring-accent' : 'ring-1 ring-transparent'} ${isTranscendent ? 'transcendent-grade-slot' : ''}`}
                title={item.name}
                onClick={onClick}
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    minWidth: 0, 
                    minHeight: 0, 
                    maxWidth: '100%', 
                    maxHeight: '100%',
                    border: isTranscendent ? undefined : `${borderWidth}px solid rgba(255, 255, 255, 0.1)`,
                    boxSizing: 'border-box'
                }}
            >
                <img 
                    src={gradeBackgrounds[item.grade]} 
                    alt={item.grade} 
                    className="absolute inset-0 object-cover rounded-md" 
                    style={{ 
                        width: '100%', 
                        height: '100%', 
                        maxWidth: '100%', 
                        maxHeight: '100%',
                        objectFit: 'cover'
                    }} 
                />
                {(() => {
                    // 이미지 경로 찾기: item.image가 있으면 사용, 없으면 CONSUMABLE_ITEMS나 MATERIAL_ITEMS에서 찾기
                    let imagePath: string | undefined = item.image;
                    
                    if (!imagePath && item.type === 'consumable') {
                        const consumableItem = findConsumableItem(item.name);
                        imagePath = consumableItem?.image;
                    }
                    
                    // MATERIAL_ITEMS에서 찾기
                    if (!imagePath) {
                        // 숫자를 로마숫자로 변환하는 맵
                        const numToRoman: Record<string, string> = {
                            '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI'
                        };
                        
                        // 다양한 이름 변형으로 시도
                        const nameVariations: string[] = [
                            item.name,
                            item.name.replace('꾸러미', ' 꾸러미'),
                            item.name.replace(' 꾸러미', '꾸러미'),
                            item.name.replace('상자', ' 상자'),
                            item.name.replace(' 상자', '상자'),
                        ];
                        
                        // 숫자를 로마숫자로 변환한 변형들 추가
                        for (const [num, roman] of Object.entries(numToRoman)) {
                            nameVariations.push(
                                item.name.replace(new RegExp(`장비상자${num}`, 'g'), `장비 상자 ${roman}`),
                                item.name.replace(new RegExp(`재료상자${num}`, 'g'), `재료 상자 ${roman}`),
                                item.name.replace(new RegExp(`장비 상자${num}`, 'g'), `장비 상자 ${roman}`),
                                item.name.replace(new RegExp(`재료 상자${num}`, 'g'), `재료 상자 ${roman}`),
                                item.name.replace(new RegExp(`장비 상자 ${num}`, 'g'), `장비 상자 ${roman}`),
                                item.name.replace(new RegExp(`재료 상자 ${num}`, 'g'), `재료 상자 ${roman}`)
                            );
                        }
                        
                        // 정규화된 이름도 추가
                        nameVariations.push(normalizeConsumableName(item.name));
                        
                        // 각 변형으로 MATERIAL_ITEMS에서 찾기
                        for (const nameVar of nameVariations) {
                            if (MATERIAL_ITEMS[nameVar]?.image) {
                                imagePath = MATERIAL_ITEMS[nameVar].image;
                                break;
                            }
                        }
                    }
                    
                    if (isActionPointConsumable(item.name)) {
                        const match = item.name.match(/\+(\d+)/);
                        const apValue = match ? match[1] : null;
                        return (
                            <span
                                className="absolute inset-0 flex flex-col items-center justify-center text-3xl"
                                style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                                aria-hidden
                            >
                                <span>⚡</span>
                                {apValue && (
                                    <span className="text-xs font-bold mt-0.5 text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,0.8)]">
                                        +{apValue}
                                    </span>
                                )}
                            </span>
                        );
                    }
                    return imagePath ? (
                        <img 
                            src={imagePath} 
                            alt={item.name} 
                            className="absolute object-contain" 
                            style={{ 
                                width: '80%', 
                                height: '80%', 
                                padding: `${padding}px`, 
                                maxWidth: '80%', 
                                maxHeight: '80%',
                                boxSizing: 'border-box',
                                objectFit: 'contain',
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)'
                            }}
                            onError={(e) => {
                                console.error(`[EquipmentSlotDisplay] Failed to load image: ${imagePath} for item:`, item);
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    ) : null;
                })()}
                {renderStarDisplay(item.stars)}
            </div>
        );
    } else {
        const padding = Math.max(4, Math.round(6 * scaleFactor));
        const borderWidth = Math.max(1, Math.round(2 * scaleFactor));
        return (
            <div
                className={`relative aspect-square rounded-lg bg-tertiary/50 ring-1 ring-transparent`}
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    minWidth: 0, 
                    minHeight: 0, 
                    maxWidth: '100%', 
                    maxHeight: '100%',
                    border: `${borderWidth}px solid rgba(255, 255, 255, 0.1)`,
                    boxSizing: 'border-box'
                }}
            >
                {/* 배경 레이어 (장비가 있을 때와 동일한 구조) */}
                <div 
                    className="absolute inset-0 bg-tertiary/30 rounded-md" 
                    style={{ 
                        width: '100%', 
                        height: '100%',
                        maxWidth: '100%', 
                        maxHeight: '100%',
                    }} 
                />
                {/* 빈 슬롯 이미지 (장비 이미지와 동일한 스타일) */}
                <img 
                    src={emptySlotImages[slot]} 
                    alt={`${slot} empty slot`} 
                    className="relative object-contain" 
                    style={{ 
                        width: '100%', 
                        height: '100%', 
                        padding: `${padding}px`, 
                        maxWidth: '100%', 
                        maxHeight: '100%',
                        boxSizing: 'border-box',
                        objectFit: 'contain'
                    }}
                />
            </div>
        );
    }
};

const LocalItemDetailDisplay: React.FC<{
    item: InventoryItem | null | undefined;
    title: string;
    comparisonItem?: InventoryItem | null;
    scaleFactor?: number;
    userLevelSum?: number;
    mobileTextScale?: number;
    emptySlot?: EquipmentSlot | null; // 빈 슬롯일 때 슬롯 타입
    /** 뷰어 영역에서 아이콘·텍스트 기준 크기 배율 (모바일 선택 패널 확대 등) */
    detailScaleMultiplier?: number;
}> = ({
    item,
    title,
    comparisonItem,
    scaleFactor = 1,
    userLevelSum = 0,
    mobileTextScale = 1,
    emptySlot,
    detailScaleMultiplier = 1,
}) => {
    const imgBox = Math.max(52, Math.round(80 * scaleFactor * detailScaleMultiplier));
    // item이 없을 때도 "선택 장비" 뷰어와 동일한 구조로 표시
    if (!item) {
        return (
            <div className="flex flex-col h-full" style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                {/* Top Section: Image (left), Name (right) - 선택 장비 뷰어와 동일한 구조 */}
                <div className="flex items-start justify-between mb-2">
                    {/* Left: 빈 슬롯 이미지 */}
                    {emptySlot && (
                        <div 
                            className="relative rounded-lg flex-shrink-0"
                            style={{
                                width: `${imgBox}px`,
                                height: `${imgBox}px`,
                            }}
                        >
                            <EquipmentSlotDisplay slot={emptySlot} scaleFactor={scaleFactor * 0.8} />
                        </div>
                    )}
                    {/* Right: Name */}
                    <div className="min-w-0 flex-grow text-right ml-2">
                        <div className="flex items-baseline justify-end gap-0.5">
                            <h3 className="font-bold text-tertiary break-words" style={{ fontSize: `${Math.max(14, Math.round(18 * scaleFactor * mobileTextScale))}px` }}>{title}</h3>
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Sub Options - 비워둠 */}
                <div className="w-full text-left space-y-1 bg-gray-900/50 p-2 rounded-lg flex-grow overflow-y-auto min-h-0 max-h-[200px]" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>
                    {/* 옵션 없음 */}
                </div>
            </div>
        );
    }

    const styles = gradeStyles[item.grade];

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

        const starSize = Math.max(8, Math.round(10 * scaleFactor));
        const fontSize = Math.max(8, Math.round(10 * scaleFactor));
        const gap = Math.max(2, Math.round(2 * scaleFactor));
        const padding = Math.max(2, Math.round(2 * scaleFactor));
        const innerPadding = Math.max(4, Math.round(6 * scaleFactor));

        return (
            <div 
                className="absolute flex items-center bg-black/40 rounded-bl-md z-10" 
                style={{ 
                    textShadow: '1px 1px 2px black',
                    top: `${innerPadding}px`,
                    right: `${innerPadding + 6}px`,
                    gap: `${gap}px`,
                    padding: `${padding}px`
                }}
            >
                <img src={starImage} alt="star" style={{ width: `${starSize}px`, height: `${starSize}px` }} />
                <span className={`font-bold leading-none ${numberColor}`} style={{ fontSize: `${fontSize}px` }}>{stars}</span>
            </div>
        );
    };

    const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
    const showRequirement = item.type === 'equipment';
    const levelRequirementMet = !showRequirement || userLevelSum >= requiredLevel;

    const getAllOptions = (invItem: InventoryItem | null | undefined): ItemOption[] => {
        if (!invItem || !invItem.options) return [];
        return [
            ...(invItem.options.main ? [invItem.options.main] : []),
            ...(invItem.options.combatSubs || []),
            ...(invItem.options.specialSubs || []),
            ...(invItem.options.mythicSubs || []),
        ].filter(Boolean) as ItemOption[];
    };

    const getOptionValue = (invItem: InventoryItem | null | undefined, optionType: ItemOptionType): number => {
        if (!invItem || !invItem.options) return 0;
        const allOptions = getAllOptions(invItem);
        const foundOption = allOptions.find(opt => opt.type === optionType);
        return foundOption ? foundOption.value : 0;
    };

    const currentItemOptions = getAllOptions(item);
    const comparisonItemOptions = getAllOptions(comparisonItem);

    const optionMap = new Map<ItemOptionType, { current?: ItemOption; comparison?: ItemOption }>();

    currentItemOptions.forEach(opt => {
        optionMap.set(opt.type, { current: opt });
    });

    comparisonItemOptions.forEach(opt => {
        const existing = optionMap.get(opt.type);
        if (existing) {
            existing.comparison = opt;
        } else {
            optionMap.set(opt.type, { comparison: opt });
        }
    });

    const getOptionCategoryOrder = (type: ItemOptionType): number => {
        if (Object.values(CoreStat).includes(type as CoreStat)) return 0;      // 부옵션 (전투 스탯)
        if (Object.values(SpecialStat).includes(type as SpecialStat)) return 1; // 특수옵션
        if (Object.values(MythicStat).includes(type as MythicStat)) return 2;  // 신화/초월 부옵션
        return 3;
    };

    const sortedOptionTypes = Array.from(optionMap.keys()).sort((a, b) => {
        const catA = getOptionCategoryOrder(a);
        const catB = getOptionCategoryOrder(b);
        if (catA !== catB) return catA - catB;
        return String(a).localeCompare(String(b));
    });

    return (
        <div className="flex flex-col h-full" style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
            {/* Top Section: Image (left), Name & Main Option (right) */}
            <div className="flex items-start justify-between mb-2">
                {/* Left: Image */}
                <div 
                    className="relative rounded-lg flex-shrink-0"
                    style={{
                        width: `${imgBox}px`,
                        height: `${imgBox}px`,
                        aspectRatio: '1 / 1'
                    }}
                >
                    <img src={styles.background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                    {(() => {
                        // 이미지 경로 찾기: item.image가 있으면 사용, 없으면 CONSUMABLE_ITEMS나 MATERIAL_ITEMS에서 찾기
                        let imagePath: string | undefined = item.image;
                        
                        if (!imagePath && item.type === 'consumable') {
                            const consumableItem = findConsumableItem(item.name);
                            imagePath = consumableItem?.image;
                        }
                        
                        // MATERIAL_ITEMS에서 찾기
                        if (!imagePath) {
                            // 숫자를 로마숫자로 변환하는 맵
                            const numToRoman: Record<string, string> = {
                                '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI'
                            };
                            
                            // 다양한 이름 변형으로 시도
                            const nameVariations: string[] = [
                                item.name,
                                item.name.replace('꾸러미', ' 꾸러미'),
                                item.name.replace(' 꾸러미', '꾸러미'),
                                item.name.replace('상자', ' 상자'),
                                item.name.replace(' 상자', '상자'),
                            ];
                            
                            // 숫자를 로마숫자로 변환한 변형들 추가
                            for (const [num, roman] of Object.entries(numToRoman)) {
                                nameVariations.push(
                                    item.name.replace(new RegExp(`장비상자${num}`, 'g'), `장비 상자 ${roman}`),
                                    item.name.replace(new RegExp(`재료상자${num}`, 'g'), `재료 상자 ${roman}`),
                                    item.name.replace(new RegExp(`장비 상자${num}`, 'g'), `장비 상자 ${roman}`),
                                    item.name.replace(new RegExp(`재료 상자${num}`, 'g'), `재료 상자 ${roman}`),
                                    item.name.replace(new RegExp(`장비 상자 ${num}`, 'g'), `장비 상자 ${roman}`),
                                    item.name.replace(new RegExp(`재료 상자 ${num}`, 'g'), `재료 상자 ${roman}`)
                                );
                            }
                            
                            // 정규화된 이름도 추가
                            nameVariations.push(normalizeConsumableName(item.name));
                            
                            // 각 변형으로 MATERIAL_ITEMS에서 찾기
                            for (const nameVar of nameVariations) {
                                if (MATERIAL_ITEMS[nameVar]?.image) {
                                    imagePath = MATERIAL_ITEMS[nameVar].image;
                                    break;
                                }
                            }
                        }
                        
                        if (isActionPointConsumable(item.name)) {
                            const match = item.name.match(/\+(\d+)/);
                            const apValue = match ? match[1] : null;
                            return (
                                <span
                                    className="absolute inset-0 flex flex-col items-center justify-center text-3xl"
                                    style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                                    aria-hidden
                                >
                                    <span>⚡</span>
                                    {apValue && (
                                        <span className="text-xs font-bold mt-0.5 text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,0.8)]">
                                            +{apValue}
                                        </span>
                                    )}
                                </span>
                            );
                        }
                        return imagePath ? (
                            <img 
                                src={imagePath} 
                                alt={item.name} 
                                className="absolute object-contain" 
                                style={{ 
                                    width: '80%', 
                                    height: '80%', 
                                    padding: `${Math.max(2, Math.round(4 * scaleFactor))}px`, 
                                    left: '50%', 
                                    top: '50%', 
                                    transform: 'translate(-50%, -50%)' 
                                }} 
                                onError={(e) => {
                                    console.error(`[LocalItemDetailDisplay] Failed to load image: ${imagePath} for item:`, item);
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ) : null;
                    })()}
                    {renderStarDisplay(item.stars)}
                </div>
                {/* Right: Name & Main Option */}
                <div className="min-w-0 flex-grow text-right ml-2">
                    <div className="flex items-baseline justify-end gap-0.5">
                        <h3 className={`font-bold break-words ${styles.color}`} style={{ fontSize: `${Math.max(14, Math.round(18 * scaleFactor * mobileTextScale))}px` }}>{item.name}</h3>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-0.5" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>
                        <span className={styles.color}>[{styles.name}]</span>
                        {showRequirement && (
                            <span className={`${levelRequirementMet ? 'text-gray-300' : 'text-red-400'} whitespace-nowrap`} style={{ fontSize: `${Math.max(9, Math.round(10 * scaleFactor * mobileTextScale))}px` }}>
                                착용 레벨 {requiredLevel}
                            </span>
                        )}
                    </div>
                    {/* 제련 가능 횟수 표시 (장비인 경우에만) */}
                    {item.type === 'equipment' && item.grade !== 'normal' && (
                        <p className={`text-xs font-semibold ${(item as any).refinementCount > 0 ? 'text-amber-400' : 'text-red-400'}`} style={{ fontSize: `${Math.max(9, Math.round(10 * scaleFactor * mobileTextScale))}px` }}>
                            제련 가능: {(item as any).refinementCount > 0 ? `${(item as any).refinementCount}회` : '제련불가'}
                        </p>
                    )}
                    {item.options?.main && ( // Only display main option if it exists
                        <p className="font-semibold text-yellow-300 flex justify-between items-center" style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                            <span>
                                {item.options.main.display}
                                {/* display에 이미 범위값이 포함되어 있으면 추가하지 않음 */}
                                {item.options.main.range && !item.options.main.display.includes('[') && ` [${item.options.main.range[0]}~${item.options.main.range[1]}]`}
                            </span>
                            {comparisonItem && item.options.main.type && (
                                (() => {
                                    const comparisonValue = getOptionValue(comparisonItem, item.options.main.type);
                                    const difference = item.options.main.value - comparisonValue;
                                    const differenceText = difference > 0 ? ` (+${difference})` : (difference < 0 ? ` (${difference})` : '');
                                    const differenceColorClass = difference > 0 ? 'text-green-400' : (difference < 0 ? 'text-red-400' : '');
                                    return difference !== 0 && <span className={`font-bold ${differenceColorClass} text-right`}>{differenceText}</span>;
                                })()
                            )}
                        </p>
                    )}
                </div>
            </div>

            {/* Bottom Section: Sub Options */}
            <div className="w-full text-left space-y-1 bg-gray-900/50 p-2 rounded-lg flex-grow overflow-y-auto min-h-0 max-h-[200px]" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>
                {sortedOptionTypes.map(type => {
                    const { current, comparison } = optionMap.get(type)!;

                    // Skip main option as it's handled in the top section
                    if (item.options?.main?.type === type) return null;

                    if (current && comparison) {
                        // Stat exists in both, show difference
                        const difference = current.value - comparison.value;
                        const differenceText = difference > 0 ? ` (+${difference})` : (difference < 0 ? ` (${difference})` : '');
                        const differenceColorClass = difference > 0 ? 'text-green-400' : (difference < 0 ? 'text-red-400' : '');
                        let colorClass = 'text-blue-300'; // Default for combat subs
                        if (Object.values(SpecialStat).includes(current.type as SpecialStat)) colorClass = 'text-green-300';
                        if (Object.values(MythicStat).includes(current.type as MythicStat)) colorClass = 'text-orange-400';

                        // display에 이미 범위값이 포함되어 있으면 추가하지 않음
                        const rangeText = current.range && !current.display.includes('[') ? ` [${current.range[0]}~${current.range[1]}]` : '';
                        const isMythicOpt = Object.values(MythicStat).includes(current.type as MythicStat);
                        return (
                            <p key={type} className={`${colorClass} flex justify-between items-center`}>
                                <span>
                                    {isMythicOpt ? (
                                        <>
                                            <MythicOptionAbbrev option={current} textClassName={colorClass} />
                                            {rangeText}
                                        </>
                                    ) : (
                                        <>
                                            {current.display}{rangeText}
                                        </>
                                    )}
                                </span>
                                {difference !== 0 && (
                                    <span className={`font-bold ${differenceColorClass} text-right`}>{differenceText}</span>
                                )}
                            </p>
                        );
                    } else if (current && !comparison) {
                        // Stat is new
                        let colorClass = 'text-green-400';
                        if (Object.values(SpecialStat).includes(current.type as SpecialStat)) colorClass = 'text-green-300';
                        if (Object.values(MythicStat).includes(current.type as MythicStat)) colorClass = 'text-orange-400';
                        // display에 이미 범위값이 포함되어 있으면 추가하지 않음
                        const rangeText = current.range && !current.display.includes('[') ? ` [${current.range[0]}~${current.range[1]}]` : '';
                        const isMythicNew = Object.values(MythicStat).includes(current.type as MythicStat);
                        return (
                            <p key={type} className={`${colorClass} flex justify-between items-center`}>
                                <span>
                                    {isMythicNew ? (
                                        <>
                                            <MythicOptionAbbrev option={current} textClassName={colorClass} />
                                            {rangeText}
                                        </>
                                    ) : (
                                        <>
                                            {current.display}{rangeText}
                                        </>
                                    )}
                                </span> <span className="font-bold text-right">(New)</span>
                            </p>
                        );
                    } else if (!current && comparison) {
                        // Stat is removed
                        let colorClass = 'text-red-400';
                        if (Object.values(SpecialStat).includes(comparison.type as SpecialStat)) colorClass = 'text-green-300';
                        if (Object.values(MythicStat).includes(comparison.type as MythicStat)) colorClass = 'text-orange-400';
                        // display에 이미 범위값이 포함되어 있으면 추가하지 않음
                        const rangeText = comparison.range && !comparison.display.includes('[') ? ` [${comparison.range[0]}~${comparison.range[1]}]` : '';
                        const isMythicRm = Object.values(MythicStat).includes(comparison.type as MythicStat);
                        return (
                            <p key={type} className={`${colorClass} line-through flex justify-between items-center`}>
                                <span>
                                    {isMythicRm ? (
                                        <>
                                            <MythicOptionAbbrev option={comparison} textClassName={colorClass} />
                                            {rangeText}
                                        </>
                                    ) : (
                                        <>
                                            {comparison.display}{rangeText}
                                        </>
                                    )}
                                </span>
                            </p>
                        );
                    }
                    return null;
                })}
            </div>
        </div>
    );
};

const EQUIPMENT_SLOTS: EquipmentSlot[] = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];

// 소모품 이름 정규화 함수: 다양한 형식의 이름을 표준 형식으로 변환
const normalizeConsumableName = (name: string): string => {
    const numToRoman: Record<string, string> = {
        '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI'
    };
    let normalized = (name || '').replace(/\s+/g, ' ').trim();
    normalized = normalized
        .replace(/장비상자/g, '장비 상자')
        .replace(/재료상자/g, '재료 상자')
        .replace(/골드꾸러미/g, '골드 꾸러미')
        .replace(/다이아꾸러미/g, '다이아 꾸러미');
    
    // 숫자를 로마숫자로 변환 (예: '장비 상자1' -> '장비 상자 I', '장비 상자 1' -> '장비 상자 I')
    for (const [num, roman] of Object.entries(numToRoman)) {
        // 띄어쓰기 있는 경우와 없는 경우 모두 처리
        normalized = normalized.replace(new RegExp(`(장비 상자|재료 상자)[\\s]*${num}`, 'g'), `$1 ${roman}`);
    }
    
    return normalized.trim();
};

// CONSUMABLE_ITEMS에서 아이템 찾기 (이름 매칭 개선)
const findConsumableItem = (itemName: string) => {
    if (!itemName) return undefined;
    
    const normalizedItemName = normalizeConsumableName(itemName);
    
    // 숫자를 로마숫자로 변환하는 맵
    const numToRoman: Record<string, string> = {
        '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI'
    };
    
    // 다양한 형식으로 변환하여 매칭 시도
    const variations: string[] = [
        itemName, // 원본
        normalizedItemName, // 정규화된 이름
        itemName.replace('꾸러미', ' 꾸러미'),
        itemName.replace(' 꾸러미', '꾸러미'),
        itemName.replace('상자', ' 상자'),
        itemName.replace(' 상자', '상자'),
    ];
    
    // 숫자를 로마숫자로 변환한 변형들 추가
    for (const [num, roman] of Object.entries(numToRoman)) {
        variations.push(
            itemName.replace(new RegExp(`장비상자${num}`, 'g'), `장비 상자 ${roman}`),
            itemName.replace(new RegExp(`재료상자${num}`, 'g'), `재료 상자 ${roman}`),
            itemName.replace(new RegExp(`장비 상자${num}`, 'g'), `장비 상자 ${roman}`),
            itemName.replace(new RegExp(`재료 상자${num}`, 'g'), `재료 상자 ${roman}`),
            itemName.replace(new RegExp(`장비 상자 ${num}`, 'g'), `장비 상자 ${roman}`),
            itemName.replace(new RegExp(`재료 상자 ${num}`, 'g'), `재료 상자 ${roman}`)
        );
    }
    
    // 중복 제거
    const uniqueVariations = Array.from(new Set(variations));
    
    return CONSUMABLE_ITEMS.find(ci => 
        uniqueVariations.some(variation => ci.name === variation)
    );
};

const InventoryModal: React.FC<InventoryModalProps> = ({ currentUser: propCurrentUser, onClose, onAction, onStartEnhance, enhancementAnimationTarget, onAnimationComplete, isTopmost }) => {
    const { presets, handlers, currentUserWithStatus, updateTrigger } = useAppContext();
    
    // useAppContext의 currentUserWithStatus를 우선 사용 (최신 상태 보장)
    const currentUser = currentUserWithStatus || propCurrentUser;

    const { inventorySlots = { equipment: 30, consumable: 10, material: 10 } } = currentUser;
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('all');
    const [sortKey, setSortKey] = useState<SortKey>('createdAt');
    const [selectedPreset, setSelectedPreset] = useState(0);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [showUseQuantityModal, setShowUseQuantityModal] = useState(false);
    const [itemToUseBulk, setItemToUseBulk] = useState<InventoryItem | null>(null);
    const [itemToSell, setItemToSell] = useState<InventoryItem | null>(null);
    const [itemToSellBulk, setItemToSellBulk] = useState<InventoryItem | null>(null);
    const [isExpandModalOpen, setIsExpandModalOpen] = useState(false);
    const [isEquipCompareOpen, setIsEquipCompareOpen] = useState(false);

    // 브라우저 크기 감지
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [windowHeight, setWindowHeight] = useState(window.innerHeight);
    
    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
            setWindowHeight(window.innerHeight);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    // PC와 동일한 가로/세로 비율 유지 (1100x800 = 1.375:1)
    // 모바일에서도 PC와 동일한 크기를 사용하고 DraggableWindow의 scale로 축소
    const calculatedWidth = useMemo(() => {
        // PC와 동일한 고정 크기 사용
        return 1100;
    }, []);
    
    // 화면 비율에 따라 높이를 미세 조정하여 인벤토리 가시 줄 수를 안정적으로 확보
    const calculatedHeight = useMemo(() => {
        const viewportRatio = windowWidth / Math.max(1, windowHeight);
        // 기준(16:9) 대비 세로가 더 긴 화면일수록 조금 더 높게, 가로가 넓을수록 조금 낮게 조정
        const ratioDelta = (16 / 9) - viewportRatio;
        const adjusted = 850 + Math.round(ratioDelta * 70);
        return Math.max(820, Math.min(900, adjusted));
    }, [windowWidth, windowHeight]);
    
    // 좁은 가로 화면에서는 PC 인벤토리 UI를 축소해서 유지한다.
    const isCompactViewport = useMemo(() => windowWidth < 1025, [windowWidth]);

    // App.tsx에서 1920x1080 캔버스를 scale로 통째로 줄이는 환경에서는
    // InventoryModal 내부 scaleFactor까지 중복 적용되지 않게 비활성화합니다.
    const isInsideScaledCanvas =
        typeof document !== 'undefined' && !!document.getElementById('sudamr-modal-root');

    const effectiveIsCompactViewport = isInsideScaledCanvas ? false : isCompactViewport;
    /** 실제 창 너비 기준. 스케일 캔버스 안 모바일에서도 좁은 레이아웃(50/50·8열)에 사용 */
    const narrowInventoryLayout = isCompactViewport;

    // 창 크기에 비례한 스케일 팩터 계산 (기준: 950px 너비)
    // 모바일에서는 PC 레이아웃을 그대로 유지하되, 전체적으로 축소
    const baseWidth = 950;
    const scaleFactor = useMemo(() => {
        if (effectiveIsCompactViewport) {
            // 모바일(캔버스 밖): PC 레이아웃을 그대로 축소 (최소 0.35, 최대 0.5)
            const rawScale = calculatedWidth / baseWidth;
            return Math.max(0.35, Math.min(0.5, rawScale));
        }
        // 스케일 캔버스 안 + 실제 좁은 뷰포트: 전체 캔버스 스케일과 별도로 슬롯·패딩만 약간 축소
        if (isInsideScaledCanvas && narrowInventoryLayout) {
            const raw = windowWidth / baseWidth;
            return Math.max(0.42, Math.min(0.72, raw));
        }
        const rawScale = calculatedWidth / baseWidth;
        return Math.max(0.4, Math.min(1.0, rawScale));
    }, [calculatedWidth, effectiveIsCompactViewport, isInsideScaledCanvas, narrowInventoryLayout, windowWidth]);

    // 모바일 텍스트 크기 조정 팩터 (모바일에서는 텍스트를 약간 더 크게)
    const mobileTextScale = useMemo(() => {
        if (effectiveIsCompactViewport) return 1.25;
        if (narrowInventoryLayout) return 1.2;
        return 1.0;
    }, [effectiveIsCompactViewport, narrowInventoryLayout]);

    const handlePresetChange = (presetIndex: number) => {
        setSelectedPreset(presetIndex);
        const preset = presets[presetIndex];
        // 프리셋이 있으면 적용하고, 없으면(빈 프리셋) 빈 장비 세트를 적용
        handlers.applyPreset(preset || { name: presets[presetIndex]?.name || `프리셋 ${presetIndex + 1}`, equipment: {} });
    };

    const selectedItem = useMemo(() => {
        if (!selectedItemId) return null;
        // 현재 인벤토리에서 아이템이 사라졌을 경우 선택 해제
        const found = currentUser.inventory.find(item => item.id === selectedItemId);
        if (!found && selectedItemId) {
            // 아이템이 사라진 경우 선택 해제 (다음 렌더링에서 처리)
            setTimeout(() => setSelectedItemId(null), 0);
        }
        return found || null;
    }, [selectedItemId, currentUser.inventory, updateTrigger]);

    const expansionCost = useMemo(() => {
        if (activeTab === 'all') return 0;
        const currentSlotsForCategory = inventorySlots?.[activeTab] ?? BASE_SLOTS_PER_CATEGORY;
        return calculateExpansionCost(currentSlotsForCategory);
    }, [activeTab, inventorySlots]);

    const { coreStatBonuses } = useMemo(() => calculateUserEffects(currentUser), [currentUser]);

    const enhancementMaterialDetails = useMemo(() => {
        if (!selectedItem || selectedItem.type !== 'material') return [];
        const groupedDetails: Record<ItemGrade, number[]> = {
            normal: [],
            uncommon: [],
            rare: [],
            epic: [],
            legendary: [],
            mythic: [],
        };

        for (const grade in ENHANCEMENT_COSTS) {
            const costsForGrade = ENHANCEMENT_COSTS[grade as ItemGrade];
            costsForGrade.forEach((costArray, starIndex) => {
                costArray.forEach(cost => {
                    if (cost.name === selectedItem.name) {
                        if (!groupedDetails[grade as ItemGrade]) {
                            groupedDetails[grade as ItemGrade] = [];
                        }
                        groupedDetails[grade as ItemGrade].push(starIndex + 1);
                    }
                });
            });
        }

        const details: string[] = [];
        for (const grade in groupedDetails) {
            const starLevels = groupedDetails[grade as ItemGrade].sort((a, b) => a - b);
            if (starLevels.length > 0) {
                details.push(`${gradeStyles[grade as ItemGrade].name} 등급 장비 강화: +${starLevels.join('강/+')}강`);
            }
        }
        return details;
    }, [selectedItem]);

    const handleExpand = () => {
        if (activeTab === 'all' || !canExpand) return;
        setIsExpandModalOpen(true);
    };

    const handleConfirmExpand = async () => {
        if (activeTab === 'all' || !canExpand || expansionCost <= 0) return;
        if (!hasEnoughDiamonds) {
            alert('다이아가 부족합니다.');
            return;
        }
        await onAction({ type: 'EXPAND_INVENTORY', payload: { category: activeTab } });
        // 모달을 자동으로 닫지 않음 (사용자가 직접 닫도록)
    };

    const handleOpenRenameModal = () => {
        setNewPresetName(presets[selectedPreset].name);
        setIsRenameModalOpen(true);
    };

    const handleSavePreset = () => {
        const updatedPreset = {
            ...presets[selectedPreset],
            name: newPresetName,
            equipment: currentUser.equipment,
        };
        onAction({ type: 'SAVE_PRESET', payload: { preset: updatedPreset, index: selectedPreset } });
        setIsRenameModalOpen(false);
        alert('프리셋이 저장되었습니다.');
    };

    const handleEquipToggle = (itemId: string) => {
        const item = currentUser.inventory.find(i => i.id === itemId);
        if (!item) return;

        if (!item.isEquipped) {
            const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
            const userLevelSum = currentUser.strategyLevel + currentUser.playfulLevel;
            if (userLevelSum < requiredLevel) {
                alert(`착용 레벨 합이 부족합니다. (필요: ${requiredLevel}, 현재: ${userLevelSum})`);
                return;
            }
        }

        onAction({ type: 'TOGGLE_EQUIP_ITEM', payload: { itemId } });
    };

    const filteredAndSortedInventory = useMemo(() => {
        let items = [...currentUser.inventory];
        // 도전의 탑 전용 소모품은 가방에서 숨김(탑 대기실에서만 표시)
        items = items.filter((item: InventoryItem) => !(item.type === 'consumable' && isTowerOnlyConsumable(item.name)));
        if (activeTab !== 'all') {
            if (activeTab === 'consumable') {
                // 옵션 변경권 3종은 재료로 분류되어 소모품 탭에서 제외
                items = items.filter((item: InventoryItem) => item.type === 'consumable' && !isRefinementTicketMaterial(item.name));
            } else if (activeTab === 'material') {
                // 재료 + 소모품으로 저장된 옵션 변경권도 재료 탭에 표시
                items = items.filter((item: InventoryItem) => item.type === 'material' || (item.type === 'consumable' && isRefinementTicketMaterial(item.name)));
            } else {
                items = items.filter((item: InventoryItem) => item.type === activeTab);
            }
        }
        // Log for debugging: Check if materials are present and filtered correctly
        if (activeTab === 'material') {
            console.log('Filtered materials:', items);
        }
        items.sort((a, b) => {
            if (sortKey === 'createdAt') return b.createdAt - a.createdAt;
            if (sortKey === 'grade') {
                const gradeA = gradeOrder[a.grade];
                const gradeB = gradeOrder[b.grade];
                if (gradeA !== gradeB) return gradeB - gradeA;
                return b.stars - a.stars;
            }
            if (sortKey === 'type') {
                const typeOrder: Record<InventoryItemType, number> = { equipment: 1, consumable: 2, material: 3 };
                return typeOrder[a.type] - typeOrder[b.type];
            }
            return 0;
        });
        return items;
    }, [currentUser.inventory, activeTab, sortKey, updateTrigger]);

    const currentSlots = useMemo(() => {
        const slots = inventorySlots || {};
        if (activeTab === 'all') {
            return (slots.equipment ?? BASE_SLOTS_PER_CATEGORY) + (slots.consumable ?? BASE_SLOTS_PER_CATEGORY) + (slots.material ?? BASE_SLOTS_PER_CATEGORY);
        } else {
            return slots[activeTab] ?? BASE_SLOTS_PER_CATEGORY;
        }
    }, [inventorySlots, activeTab]);
    
    const maxSlotsForCurrentTab = useMemo(() => {
        let maxSlots = MAX_EQUIPMENT_SLOTS;
        if (activeTab === 'consumable') maxSlots = MAX_CONSUMABLE_SLOTS;
        else if (activeTab === 'material') maxSlots = MAX_MATERIAL_SLOTS;
        return maxSlots;
    }, [activeTab]);

    const currentCategorySlots = useMemo(() => {
        if (activeTab === 'all') return 0;
        return inventorySlots?.[activeTab] ?? BASE_SLOTS_PER_CATEGORY;
    }, [activeTab, inventorySlots]);

    const nextCategorySlots = useMemo(() => {
        if (activeTab === 'all') return 0;
        return Math.min(currentCategorySlots + EXPANSION_AMOUNT, maxSlotsForCurrentTab);
    }, [activeTab, currentCategorySlots, maxSlotsForCurrentTab]);

    const canExpand = useMemo(() => {
        if (activeTab === 'all') return false;
        return currentCategorySlots < maxSlotsForCurrentTab;
    }, [activeTab, currentCategorySlots, maxSlotsForCurrentTab]);

    const hasEnoughDiamonds = useMemo(() => {
        if (expansionCost <= 0) return true;
        return (currentUser.diamonds ?? 0) >= expansionCost;
    }, [currentUser.diamonds, expansionCost]);

    const slotsIncrease = useMemo(() => {
        if (activeTab === 'all') return 0;
        return Math.max(0, nextCategorySlots - currentCategorySlots);
    }, [activeTab, nextCategorySlots, currentCategorySlots]);

    const activeTabLabel = useMemo(() => TAB_LABELS[activeTab], [activeTab]);

    const isItemInAnyPreset = useCallback((itemId: string) => {
        return presets.some(preset => Object.values(preset.equipment).includes(itemId));
    }, [presets]);

    const getItemForSlot = useCallback((slot: EquipmentSlot) => {
        const itemId = currentUser.equipment[slot];
        if (!itemId) return undefined;
        return currentUser.inventory.find(item => item.id === itemId);
    }, [currentUser.equipment, currentUser.inventory, updateTrigger]);

    const correspondingEquippedItem = useMemo(() => {
        if (!selectedItem || !selectedItem.slot) return null;
        return getItemForSlot(selectedItem.slot);
    }, [selectedItem, getItemForSlot]);

    useEffect(() => {
        setIsEquipCompareOpen(false);
    }, [selectedItemId]);

    const canEquip = useMemo(() => {
        if (!selectedItem || selectedItem.type !== 'equipment') return false;
        const requiredLevel = GRADE_LEVEL_REQUIREMENTS[selectedItem.grade];
        const userLevelSum = currentUser.strategyLevel + currentUser.playfulLevel;
        return userLevelSum >= requiredLevel;
    }, [selectedItem, currentUser.strategyLevel, currentUser.playfulLevel]);

    // 바둑능력 변화 계산 (선택한 장비를 장착했을 때의 바둑능력 변화 - 6가지 능력치 합계)
    const combatPowerChange = useMemo(() => {
        if (!selectedItem || selectedItem.type !== 'equipment' || !selectedItem.slot) return null;
        
        // 현재 바둑능력 계산 (현재 장착된 장비 기준) - 6가지 능력치 합계
        const currentStats = calculateTotalStats(currentUser);
        const currentBadukPower = Object.values(currentStats).reduce((acc, val) => acc + val, 0);
        
        // 현재 해당 슬롯에 장착된 아이템 ID 찾기
        const currentEquippedItemId = currentUser.equipment[selectedItem.slot];
        
        // 선택한 장비를 장착한 상태로 가정한 User 생성
        const hypotheticalEquipment = { ...currentUser.equipment };
        hypotheticalEquipment[selectedItem.slot] = selectedItem.id;
        
        // 인벤토리에서 아이템의 isEquipped 상태 업데이트
        const hypotheticalInventory = currentUser.inventory.map(item => {
            // 선택한 아이템은 장착
            if (item.id === selectedItem.id) {
                return { ...item, isEquipped: true };
            }
            // 현재 해당 슬롯에 장착된 아이템은 해제
            if (currentEquippedItemId && item.id === currentEquippedItemId) {
                return { ...item, isEquipped: false };
            }
            // 나머지는 그대로 유지
            return item;
        });
        
        const hypotheticalUser = {
            ...currentUser,
            equipment: hypotheticalEquipment,
            inventory: hypotheticalInventory
        };
        
        // 선택한 장비를 장착했을 때의 바둑능력 계산 - 6가지 능력치 합계
        const newStats = calculateTotalStats(hypotheticalUser);
        const newBadukPower = Object.values(newStats).reduce((acc, val) => acc + val, 0);
        
        // 차이 계산 (선택한 장비 장착 시 - 현재 장착 장비 기준)
        const change = newBadukPower - currentBadukPower;
        return change;
    }, [selectedItem, currentUser]);

    /** 장비 교체 시 6종 바둑 능력치 변화 (비교 모달용) */
    const equipSwapStatPreview = useMemo(() => {
        if (!selectedItem || selectedItem.type !== 'equipment' || !selectedItem.slot) return null;
        const currentEquippedItemId = currentUser.equipment[selectedItem.slot];
        if (currentEquippedItemId && currentEquippedItemId === selectedItem.id) return null;

        const currentStats = calculateTotalStats(currentUser);
        const hypotheticalEquipment = { ...currentUser.equipment, [selectedItem.slot]: selectedItem.id };
        const hypotheticalInventory = currentUser.inventory.map((item) => {
            if (item.id === selectedItem.id) return { ...item, isEquipped: true };
            if (currentEquippedItemId && item.id === currentEquippedItemId) return { ...item, isEquipped: false };
            return item;
        });
        const hypotheticalUser = {
            ...currentUser,
            equipment: hypotheticalEquipment,
            inventory: hypotheticalInventory,
        };
        const afterStats = calculateTotalStats(hypotheticalUser);

        const delta = {} as Record<CoreStat, number>;
        for (const key of Object.values(CoreStat)) {
            delta[key] = afterStats[key] - currentStats[key];
        }
        const currentSum = Object.values(currentStats).reduce((a, b) => a + b, 0);
        const afterSum = Object.values(afterStats).reduce((a, b) => a + b, 0);
        return { currentStats, afterStats, delta, currentSum, afterSum, sumDelta: afterSum - currentSum };
    }, [selectedItem, currentUser]);

    return (
        <DraggableWindow title="가방" onClose={onClose} windowId="inventory" isTopmost={isTopmost} initialWidth={calculatedWidth} initialHeight={calculatedHeight} variant="store">
            <div 
                className="flex min-h-0 h-full w-full flex-col overflow-hidden"
                style={{ margin: 0, padding: 0 }}
            >
                {/* Top section: Equipped items (left) and Selected item details (right) */}
                <div
                    className={`bg-gray-800 mb-2 rounded-md shadow-inner ${narrowInventoryLayout ? 'flex shrink-0 flex-col gap-2 overflow-y-auto' : 'flex shrink-0 flex-row'}`}
                    style={{
                        /* 모바일: 하단 인벤(flex-1)에 밀려 뷰어가 0높이로 죽지 않게 shrink 금지 + 최소 높이 */
                        minHeight: narrowInventoryLayout
                            ? `${Math.max(200, Math.min(340, Math.round(windowHeight * 0.34)))}px`
                            : undefined,
                        maxHeight: narrowInventoryLayout ? `${Math.min(680 * scaleFactor, windowHeight * 0.55)}px` : undefined,
                        padding: `${Math.max(12, Math.round(16 * scaleFactor))}px`,
                    }}
                >
                    {narrowInventoryLayout ? (
                        <>
                            <div className="flex w-full min-w-0 flex-row gap-2" style={{ minHeight: `${Math.max(130, Math.round(150 * scaleFactor))}px` }}>
                                {/* 모바일: 넓은 열 — 장착 슬롯 + 하단 능력치·프리셋 */}
                                <div
                                    className="min-w-0 flex-1 border-r border-gray-700 pr-2"
                                    style={{ paddingRight: `${Math.max(6, Math.round(10 * scaleFactor))}px` }}
                                >
                                    <h3
                                        className="font-bold text-on-panel"
                                        style={{
                                            fontSize: `${Math.max(12, Math.round(15 * scaleFactor * mobileTextScale))}px`,
                                            marginBottom: `${Math.max(4, Math.round(6 * scaleFactor))}px`,
                                        }}
                                    >
                                        장착 장비
                                    </h3>
                                    <div
                                        className="grid"
                                        style={{
                                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                                            gap: `${Math.max(3, Math.round(4 * scaleFactor))}px`,
                                        }}
                                    >
                                        {EQUIPMENT_SLOTS.map((slot) => {
                                            const equippedItem = getItemForSlot(slot);
                                            return (
                                                <div key={slot} style={{ width: '100%', minWidth: 0 }}>
                                                    <EquipmentSlotDisplay
                                                        slot={slot}
                                                        item={equippedItem}
                                                        scaleFactor={Math.max(0.34, scaleFactor * 0.68)}
                                                        onClick={equippedItem ? () => setSelectedItemId(equippedItem.id) : undefined}
                                                        isSelected={equippedItem ? selectedItemId === equippedItem.id : false}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-2 border-t border-gray-600/60 pt-2">
                                        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                            {Object.values(CoreStat).map((stat) => {
                                                const baseStats = currentUser.baseStats || {};
                                                const spentStatPoints = currentUser.spentStatPoints || {};
                                                const baseValue = (baseStats[stat] || 0) + (spentStatPoints[stat] || 0);
                                                const bonusInfo = coreStatBonuses[stat] || { percent: 0, flat: 0 };
                                                const bonus = Math.floor(baseValue * (bonusInfo.percent / 100)) + bonusInfo.flat;
                                                const finalValue = baseValue + bonus;
                                                return (
                                                    <div
                                                        key={stat}
                                                        className="flex items-center justify-between rounded-md bg-tertiary/40 p-1"
                                                        style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}
                                                    >
                                                        <span className="whitespace-nowrap font-semibold text-secondary">{stat}</span>
                                                        <span className="whitespace-nowrap font-mono font-bold" title={`기본: ${baseValue}, 장비: ${bonus}`}>
                                                            {isNaN(finalValue) ? 0 : finalValue}
                                                            {bonus > 0 && (
                                                                <span className="ml-0.5 text-green-400" style={{ fontSize: `${Math.max(9, Math.round(10 * scaleFactor * mobileTextScale))}px` }}>
                                                                    (+{bonus})
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-2 flex items-center gap-1.5">
                                            <select
                                                value={selectedPreset}
                                                onChange={(e) => handlePresetChange(Number(e.target.value))}
                                                className="min-w-0 flex-1 rounded-md border border-color bg-secondary p-1 focus:border-accent focus:ring-accent"
                                                style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}
                                            >
                                                {presets.map((preset, index) => (
                                                    <option key={index} value={index}>
                                                        {preset.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <Button onClick={handleOpenRenameModal} colorScheme="blue" className="!shrink-0 !py-1 !px-2" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>
                                                저장
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                {/* 모바일: 좁은 열 — 선택 아이템 (장비 비교 없음) */}
                                <div className="flex min-h-[180px] min-w-0 flex-1 flex-col">
                                    {selectedItem && selectedItem.type === 'equipment' ? (
                                        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-panel-secondary p-1.5">
                                            <div className="mb-1 flex shrink-0 items-center justify-between gap-1">
                                                <h3
                                                    className="min-w-0 truncate font-bold text-on-panel"
                                                    style={{ fontSize: `${Math.max(12, Math.round(15 * scaleFactor * mobileTextScale))}px` }}
                                                >
                                                    선택 장비
                                                </h3>
                                                {selectedItem.slot && selectedItem.id !== correspondingEquippedItem?.id && (
                                                    <Button
                                                        type="button"
                                                        onClick={() => setIsEquipCompareOpen(true)}
                                                        colorScheme="blue"
                                                        className="!shrink-0 !py-0.5 !px-1.5"
                                                        style={{ fontSize: `${Math.max(9, Math.round(10 * scaleFactor * mobileTextScale))}px` }}
                                                    >
                                                        장비 비교
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="min-h-0 flex-1 overflow-y-auto px-0.5 pb-14" style={{ WebkitOverflowScrolling: 'touch' }}>
                                                <LocalItemDetailDisplay
                                                    item={selectedItem}
                                                    title="선택된 아이템 없음"
                                                    comparisonItem={undefined}
                                                    scaleFactor={scaleFactor}
                                                    mobileTextScale={mobileTextScale}
                                                    userLevelSum={currentUser.strategyLevel + currentUser.playfulLevel}
                                                    detailScaleMultiplier={0.88}
                                                />
                                            </div>
                                            <div className="absolute bottom-1 left-0 right-0 z-30 flex shrink-0 justify-center gap-1 bg-panel-secondary/95 px-1 backdrop-blur-sm">
                                                {selectedItem.id === correspondingEquippedItem?.id ? (
                                                    <Button
                                                        onClick={() => handleEquipToggle(selectedItem.id)}
                                                        colorScheme="red"
                                                        className="flex-1 !py-1"
                                                        style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}
                                                    >
                                                        해제
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        onClick={() => handleEquipToggle(selectedItem.id)}
                                                        colorScheme="green"
                                                        className="flex-1 !py-1"
                                                        disabled={!canEquip}
                                                        style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}
                                                    >
                                                        장착
                                                    </Button>
                                                )}
                                                <Button
                                                    onClick={() => onStartEnhance(selectedItem)}
                                                    disabled={selectedItem.stars >= 10}
                                                    colorScheme="yellow"
                                                    className="flex-1 !py-1"
                                                    style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}
                                                >
                                                    {selectedItem.stars >= 10 ? '최대' : '강화'}
                                                </Button>
                                                <Button
                                                    onClick={() => setItemToSell(selectedItem)}
                                                    colorScheme="red"
                                                    className="flex-1 !py-1"
                                                    style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}
                                                >
                                                    판매
                                                </Button>
                                            </div>
                                        </div>
                                    ) : selectedItem && (selectedItem.type === 'consumable' || selectedItem.type === 'material') ? (
                                        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-panel-secondary p-2">
                                            <h3
                                                className="mb-2 flex-shrink-0 font-bold text-on-panel"
                                                style={{ fontSize: `${Math.max(14, Math.round(18 * scaleFactor * mobileTextScale))}px` }}
                                            >
                                                선택 {selectedItem.type === 'consumable' ? '소모품' : '재료'}
                                            </h3>
                                            <div
                                                className="min-h-0 flex-1 overflow-y-auto"
                                                style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px`, WebkitOverflowScrolling: 'touch' }}
                                            >
                                                <div className="mb-2 flex items-start justify-between gap-1">
                                                    <div
                                                        className="relative aspect-square flex-shrink-0 rounded-lg"
                                                        style={{
                                                            width: `${Math.max(72, Math.round(104 * scaleFactor))}px`,
                                                            height: `${Math.max(72, Math.round(104 * scaleFactor))}px`,
                                                        }}
                                                    >
                                                        <img
                                                            src={gradeBackgrounds[selectedItem.grade]}
                                                            alt={selectedItem.grade}
                                                            className="absolute inset-0 h-full w-full rounded-lg object-cover"
                                                        />
                                                        {isActionPointConsumable(selectedItem.name) ? (
                                                            <div
                                                                className="absolute inset-0 flex flex-col items-center justify-center text-amber-300"
                                                                style={{ padding: `${Math.max(2, Math.round(4 * scaleFactor))}px` }}
                                                            >
                                                                <span className="text-2xl leading-none" aria-hidden>
                                                                    ⚡
                                                                </span>
                                                                <span
                                                                    className="mt-0.5 font-bold text-amber-200"
                                                                    style={{ fontSize: `${Math.max(11, Math.round(15 * scaleFactor * mobileTextScale))}px` }}
                                                                >
                                                                    +{selectedItem.name.replace(/.*\(\+(\d+)\)/, '$1')}
                                                                </span>
                                                            </div>
                                                        ) : selectedItem.image ? (
                                                            <img
                                                                src={selectedItem.image}
                                                                alt={selectedItem.name}
                                                                className="absolute object-contain"
                                                                style={{
                                                                    width: '80%',
                                                                    height: '80%',
                                                                    padding: `${Math.max(2, Math.round(4 * scaleFactor))}px`,
                                                                    left: '50%',
                                                                    top: '50%',
                                                                    transform: 'translate(-50%, -50%)',
                                                                }}
                                                            />
                                                        ) : null}
                                                    </div>
                                                    <div className="min-w-0 flex-grow text-right">
                                                        <h3
                                                            className={`font-bold break-words ${gradeStyles[selectedItem.grade].color}`}
                                                            style={{ fontSize: `${Math.max(13, Math.round(16 * scaleFactor * mobileTextScale))}px` }}
                                                        >
                                                            {selectedItem.name}
                                                        </h3>
                                                        <p className={gradeStyles[selectedItem.grade].color} style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>
                                                            [{gradeStyles[selectedItem.grade].name}]
                                                        </p>
                                                        <p className="mt-1 text-gray-300" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>
                                                            {selectedItem.description}
                                                        </p>
                                                        <p className="mt-1 text-gray-300" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>
                                                            보유 수량: {selectedItem.quantity}
                                                        </p>
                                                    </div>
                                                </div>
                                                {selectedItem.type === 'material' && (
                                                    <div className="mt-2 rounded-lg bg-gray-800/50 p-2">
                                                        <p className="mb-1 font-semibold text-secondary" style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                                                            강화 필요 정보:
                                                        </p>
                                                        {enhancementMaterialDetails.length > 0 ? (
                                                            enhancementMaterialDetails.slice(0, 2).map((detail, index) => (
                                                                <p key={index} className="text-gray-300" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>
                                                                    {detail}
                                                                </p>
                                                            ))
                                                        ) : (
                                                            <p className="text-gray-300" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>
                                                                이 재료는 현재 어떤 장비 강화에도 사용되지 않습니다.
                                                            </p>
                                                        )}
                                                        {enhancementMaterialDetails.length > 2 && (
                                                            <p className="mt-1 text-gray-400" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>
                                                                ...
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="absolute bottom-1 left-0 right-0 flex shrink-0 flex-wrap justify-center gap-1 px-1">
                                                {selectedItem.type === 'consumable' &&
                                                    (() => {
                                                        const consumableItem = findConsumableItem(selectedItem.name);
                                                        const isUsable = consumableItem?.usable !== false;
                                                        const isSellable = consumableItem?.sellable !== false;
                                                        return (
                                                            <>
                                                                {isUsable && (
                                                                    <>
                                                                        <Button
                                                                            onClick={() => {
                                                                                void onAction({ type: 'USE_ITEM', payload: { itemId: selectedItem.id, itemName: selectedItem.name } });
                                                                            }}
                                                                            colorScheme="blue"
                                                                            className="w-full !py-1"
                                                                            style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}
                                                                        >
                                                                            사용
                                                                        </Button>
                                                                        {selectedItem.quantity && selectedItem.quantity > 1 && (
                                                                            <Button
                                                                                onClick={() => {
                                                                                    setItemToUseBulk(selectedItem);
                                                                                    setShowUseQuantityModal(true);
                                                                                }}
                                                                                colorScheme="purple"
                                                                                className="w-full !py-1"
                                                                                style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}
                                                                            >
                                                                                일괄 사용
                                                                            </Button>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {isSellable && (
                                                                    <>
                                                                        <Button
                                                                            onClick={() => setItemToSell(selectedItem)}
                                                                            colorScheme="red"
                                                                            className="w-full !py-1"
                                                                            style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}
                                                                        >
                                                                            판매
                                                                        </Button>
                                                                        {selectedItem.quantity && selectedItem.quantity > 1 && (
                                                                            <Button
                                                                                onClick={() => setItemToSellBulk(selectedItem)}
                                                                                colorScheme="orange"
                                                                                className="w-full !py-1"
                                                                                style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}
                                                                            >
                                                                                일괄 판매
                                                                            </Button>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                {selectedItem.type === 'material' && (
                                                    <>
                                                        <Button
                                                            onClick={() => setItemToSell(selectedItem)}
                                                            colorScheme="red"
                                                            className="w-full !py-1"
                                                            style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}
                                                        >
                                                            판매
                                                        </Button>
                                                        <Button
                                                            onClick={() => setItemToSellBulk(selectedItem)}
                                                            colorScheme="orange"
                                                            className="w-full !py-1"
                                                            style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}
                                                        >
                                                            일괄 판매
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ) : selectedItem ? (
                                        <div
                                            className="flex flex-1 items-center justify-center rounded-lg bg-panel-secondary p-2 text-tertiary"
                                            style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * mobileTextScale))}px` }}
                                        >
                                            선택된 아이템 없음
                                        </div>
                                    ) : (
                                        <div
                                            className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-600/60 p-2 text-center text-tertiary"
                                            style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * mobileTextScale))}px` }}
                                        >
                                            아이템을 선택해주세요
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* 데스크톱: 좌 1/3 장착+스탯, 우측 상세 */}
                            <div className="w-1/3 flex-shrink-0 border-r border-gray-700" style={{ paddingRight: `${Math.max(12, Math.round(16 * scaleFactor))}px` }}>
                                <>
                                    <h3 className="font-bold text-on-panel" style={{ fontSize: `${Math.max(14, Math.round(18 * scaleFactor * mobileTextScale))}px`, marginBottom: `${Math.max(6, Math.round(8 * scaleFactor))}px` }}>장착 장비</h3>
                                    <div
                                        className="grid"
                                        style={{
                                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                                            gap: `${Math.max(6, Math.round(8 * scaleFactor))}px`,
                                        }}
                                    >
                                        {EQUIPMENT_SLOTS.map((slot) => {
                                            const equippedItem = getItemForSlot(slot);
                                            return (
                                                <div key={slot} style={{ width: '100%', minWidth: 0 }}>
                                                    <EquipmentSlotDisplay
                                                        slot={slot}
                                                        item={equippedItem}
                                                        scaleFactor={scaleFactor}
                                                        onClick={equippedItem ? () => setSelectedItemId(equippedItem.id) : undefined}
                                                        isSelected={equippedItem ? selectedItemId === equippedItem.id : false}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-4">
                                        <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1">
                                            {Object.values(CoreStat).map((stat) => {
                                                const baseStats = currentUser.baseStats || {};
                                                const spentStatPoints = currentUser.spentStatPoints || {};
                                                const baseValue = (baseStats[stat] || 0) + (spentStatPoints[stat] || 0);
                                                const bonusInfo = coreStatBonuses[stat] || { percent: 0, flat: 0 };
                                                const bonus = Math.floor(baseValue * (bonusInfo.percent / 100)) + bonusInfo.flat;
                                                const finalValue = baseValue + bonus;
                                                return (
                                                    <div key={stat} className="flex items-center justify-between rounded-md bg-tertiary/40 p-1" style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                                                        <span className="whitespace-nowrap font-semibold text-secondary">{stat}</span>
                                                        <span className="whitespace-nowrap font-mono font-bold" title={`기본: ${baseValue}, 장비: ${bonus}`}>
                                                            {isNaN(finalValue) ? 0 : finalValue}
                                                            {bonus > 0 && <span className="ml-0.5 text-green-400" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>(+{bonus})</span>}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={selectedPreset}
                                                onChange={(e) => handlePresetChange(Number(e.target.value))}
                                                className="flex-grow rounded-md border border-color bg-secondary p-1 focus:border-accent focus:ring-accent"
                                                style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}
                                            >
                                                {presets.map((preset, index) => (
                                                    <option key={index} value={index}>
                                                        {preset.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <Button onClick={handleOpenRenameModal} colorScheme="blue" className="!py-1" style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                                                저장
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            </div>

                    {/* Conditional middle and right panels (데스크톱) */}
                    {selectedItem && selectedItem.type === 'equipment' ? (
                        <div className={`flex flex-row gap-0 flex-1`}>
                            {/* Middle panel: Currently equipped item for comparison */}
                            <div className={`flex flex-col flex-1 h-full bg-panel-secondary rounded-lg p-2 relative overflow-hidden border-r border-gray-700`}>
                                <h3 className="font-bold text-on-panel mb-1 flex-shrink-0" style={{ fontSize: `${Math.max(14, Math.round(18 * scaleFactor * mobileTextScale))}px` }}>현재 장착</h3>
                                <div className={`flex-1 min-h-0 ${effectiveIsCompactViewport ? 'overflow-visible' : 'overflow-y-auto'} pb-16`} style={{ WebkitOverflowScrolling: 'touch' }}>
                                    <LocalItemDetailDisplay 
                                        item={correspondingEquippedItem} 
                                        title="장착된 장비 없음" 
                                        comparisonItem={selectedItem} 
                                        scaleFactor={scaleFactor} 
                                        mobileTextScale={mobileTextScale} 
                                        userLevelSum={currentUser.strategyLevel + currentUser.playfulLevel}
                                        emptySlot={selectedItem?.slot}
                                    />
                                </div>
                            </div>

                            {/* Right panel: Selected equipment item */}
                            <div className={`flex flex-col flex-1 h-full bg-panel-secondary rounded-lg p-3 relative overflow-hidden`}>
                                <div className="mb-1 flex flex-shrink-0 items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <h3 className="font-bold text-on-panel" style={{ fontSize: `${Math.max(14, Math.round(18 * scaleFactor * mobileTextScale))}px` }}>선택 장비</h3>
                                        {combatPowerChange !== null && combatPowerChange !== 0 && (
                                            <span className={`font-bold ${combatPowerChange > 0 ? 'text-green-400' : 'text-red-400'}`} style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * mobileTextScale))}px` }}>
                                                {combatPowerChange > 0 ? '+' : ''}{combatPowerChange}
                                            </span>
                                        )}
                                    </div>
                                    {selectedItem.slot && selectedItem.id !== correspondingEquippedItem?.id && (
                                        <Button
                                            type="button"
                                            onClick={() => setIsEquipCompareOpen(true)}
                                            colorScheme="blue"
                                            className="!shrink-0 !py-1 !px-2"
                                            style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}
                                        >
                                            장비 비교
                                        </Button>
                                    )}
                                </div>
                                <div className={`flex-1 min-h-0 ${effectiveIsCompactViewport ? 'overflow-visible' : 'overflow-y-auto'} pb-16`} style={{ WebkitOverflowScrolling: 'touch' }}>
                                    <LocalItemDetailDisplay item={selectedItem} title="선택된 아이템 없음" comparisonItem={correspondingEquippedItem} scaleFactor={scaleFactor} mobileTextScale={mobileTextScale} userLevelSum={currentUser.strategyLevel + currentUser.playfulLevel} />
                                </div>
                                <div className={`absolute bottom-2 left-0 right-0 flex justify-center gap-2 px-2 flex-shrink-0 bg-panel-secondary/95 backdrop-blur-sm`}>
                                    {selectedItem.id === correspondingEquippedItem?.id ? (
                                        <Button
                                            onClick={() => handleEquipToggle(selectedItem.id)}
                                            colorScheme="red"
                                            className={`flex-1 !py-1`}
                                            style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}
                                        >
                                            해제
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => handleEquipToggle(selectedItem.id)}
                                            colorScheme="green"
                                            className={`flex-1 !py-1`}
                                            disabled={!canEquip}
                                            style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}
                                        >
                                            장착
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() => onStartEnhance(selectedItem)}
                                        disabled={selectedItem.stars >= 10}
                                        colorScheme="yellow"
                                        className={`flex-1 !py-1`}
                                        style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}
                                    >
                                        {selectedItem.stars >= 10 ? '최대' : '강화'}
                                    </Button>
                                    <Button onClick={() => setItemToSell(selectedItem)} colorScheme="red" className={`flex-1 !py-1`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                                        판매
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Single right panel for non-equipment items or no selection */
                        <div className={`flex flex-col w-2/3 h-full bg-panel-secondary rounded-lg p-3 relative overflow-hidden ml-4`}>
                            {selectedItem ? (
                                (selectedItem.type === 'consumable' || selectedItem.type === 'material') ? (
                                    <>
                                        <h3 className="font-bold text-on-panel mb-2 flex-shrink-0" style={{ fontSize: `${Math.max(14, Math.round(18 * scaleFactor * mobileTextScale))}px` }}>
                                            선택 {selectedItem.type === 'consumable' ? '소모품' : '재료'}
                                        </h3>
                                        <div className={`flex-1 min-h-0 ${effectiveIsCompactViewport ? 'overflow-visible' : 'overflow-y-auto'}`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px`, WebkitOverflowScrolling: 'touch' }}>
                                            <div className="flex items-start justify-between mb-2">
                                                <div 
                                                    className="relative rounded-lg flex-shrink-0 aspect-square"
                                                    style={{
                                                        width: `${Math.max(60, Math.round(80 * scaleFactor))}px`,
                                                        height: `${Math.max(60, Math.round(80 * scaleFactor))}px`
                                                    }}
                                                >
                                                    <img src={gradeBackgrounds[selectedItem.grade]} alt={selectedItem.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                                                    {isActionPointConsumable(selectedItem.name) ? (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-amber-300" style={{ padding: `${Math.max(2, Math.round(4 * scaleFactor))}px` }}>
                                                            <span className="text-2xl sm:text-3xl leading-none" aria-hidden>⚡</span>
                                                            <span className="font-bold text-amber-200 mt-0.5" style={{ fontSize: `${Math.max(10, Math.round(14 * scaleFactor * mobileTextScale))}px` }}>
                                                                +{selectedItem.name.replace(/.*\(\+(\d+)\)/, '$1')}
                                                            </span>
                                                        </div>
                                                    ) : selectedItem.image ? (
                                                        <img src={selectedItem.image} alt={selectedItem.name} className="absolute object-contain" style={{ width: '80%', height: '80%', padding: `${Math.max(2, Math.round(4 * scaleFactor))}px`, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
                                                    ) : null}
                                                </div>
                                                <div className="flex-grow text-right ml-2">
                                                    <h3 className={`font-bold ${gradeStyles[selectedItem.grade].color}`} style={{ fontSize: `${Math.max(14, Math.round(18 * scaleFactor * mobileTextScale))}px` }}>{selectedItem.name}</h3>
                                                    <p className={gradeStyles[selectedItem.grade].color} style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>[{gradeStyles[selectedItem.grade].name}]</p>
                                                    <p className="text-gray-300 mt-1" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>{selectedItem.description}</p>
                                                    <p className="text-gray-300 mt-1" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>보유 수량: {selectedItem.quantity}</p>
                                                </div>
                                            </div>
                                            {selectedItem.type === 'material' && (
                                                <div className="mt-2 p-2 bg-gray-800/50 rounded-lg">
                                                    <p className="font-semibold text-secondary mb-1" style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>강화 필요 정보:</p>
                                                    {enhancementMaterialDetails.length > 0 ? (
                                                        enhancementMaterialDetails.slice(0, 2).map((detail, index) => (
                                                            <p key={index} className="text-gray-300" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>
                                                                {detail}
                                                            </p>
                                                        ))
                                                    ) : (
                                                        <p className="text-gray-300" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>이 재료는 현재 어떤 장비 강화에도 사용되지 않습니다.</p>
                                                    )}
                                                    {enhancementMaterialDetails.length > 2 && (
                                                        <p className="text-gray-400 mt-1" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>...</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className={`absolute bottom-2 left-0 right-0 flex justify-center gap-2 px-4 flex-shrink-0`}>
                                            {selectedItem.type === 'consumable' && (() => {
                                                const consumableItem = findConsumableItem(selectedItem.name);
                                                const isUsable = consumableItem?.usable !== false; // 기본값은 true
                                                const isSellable = consumableItem?.sellable !== false; // 기본값은 true
                                                
                                                return (
                                                    <>
                                                        {isUsable && (
                                                            <>
                                                                <Button onClick={() => { void onAction({ type: 'USE_ITEM', payload: { itemId: selectedItem.id, itemName: selectedItem.name } }); }} colorScheme="blue" className={`w-full !py-1`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                                                                    사용
                                                                </Button>
                                                                {selectedItem.quantity && selectedItem.quantity > 1 && (
                                                                    <Button
                                                                        onClick={() => { setItemToUseBulk(selectedItem); setShowUseQuantityModal(true); }}
                                                                        colorScheme="purple"
                                                                        className={`w-full !py-1`}
                                                                        style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}
                                                                    >
                                                                        일괄 사용
                                                                    </Button>
                                                                )}
                                                            </>
                                                        )}
                                                        {isSellable && (
                                                            <>
                                                                <Button onClick={() => setItemToSell(selectedItem)} colorScheme="red" className={`w-full !py-1`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                                                                    판매
                                                                </Button>
                                                                {selectedItem.quantity && selectedItem.quantity > 1 && (
                                                                    <Button onClick={() => setItemToSellBulk(selectedItem)} colorScheme="orange" className={`w-full !py-1`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                                                                        일괄 판매
                                                                    </Button>
                                                                )}
                                                            </>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                            {selectedItem.type === 'material' && (
                                                <>
                                                    <Button onClick={() => setItemToSell(selectedItem)} colorScheme="red" className={`w-full !py-1`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                                                        판매
                                                    </Button>
                                                    <Button onClick={() => setItemToSellBulk(selectedItem)} colorScheme="orange" className={`w-full !py-1`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                                                        일괄 판매
                                                    </Button>
                                                </>
                                            )}
                                            {selectedItem.type !== 'material' && selectedItem.type !== 'consumable' && (() => {
                                                const consumableItem = selectedItem.type === 'consumable' ? CONSUMABLE_ITEMS.find(ci => ci.name === selectedItem.name || ci.name === selectedItem.name.replace('꾸러미', ' 꾸러미') || ci.name === selectedItem.name.replace(' 꾸러미', '꾸러미')) : null;
                                                const isSellable = consumableItem?.sellable !== false; // 기본값은 true
                                                
                                                return isSellable ? (
                                                    <Button onClick={() => setItemToSell(selectedItem)} colorScheme="red" className={`w-full !py-1`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                                                        판매
                                                    </Button>
                                                ) : null;
                                            })()}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-tertiary" style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * mobileTextScale))}px` }}>선택된 아이템 없음</div>
                                )
                            ) : (
                                <div className="h-full flex items-center justify-center text-tertiary" style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * mobileTextScale))}px` }}>아이템을 선택해주세요</div>
                            )}
                        </div>
                    )}
                        </>
                    )}
                </div>

                {/* Bottom section: Inventory grid — 모바일은 flex-1+min-h-0으로 남는 영역만 쓰고 내부 스크롤 (상단 뷰어가 밀리지 않게) */}
                <div
                    className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-900"
                    style={{
                        minHeight: narrowInventoryLayout ? `${Math.max(120, Math.round(140 * scaleFactor))}px` : `${Math.max(320 * scaleFactor, windowHeight * 0.45)}px`,
                        padding: `${Math.max(12, Math.round(16 * scaleFactor))}px`,
                        paddingTop: `${Math.max(12, Math.round(16 * scaleFactor))}px`,
                        paddingBottom: `${Math.max(12, Math.round(16 * scaleFactor))}px`,
                        marginBottom: 0,
                    }}
                >
                    <div className={`flex-shrink-0 bg-gray-900/50 rounded-md mb-2`} style={{ padding: `${Math.max(6, Math.round(8 * scaleFactor))}px`, marginBottom: `${Math.max(6, Math.round(8 * scaleFactor))}px` }}>
                        <div className={`flex items-center justify-between`}>
                            <div className={`flex items-center space-x-2`}>
                                <Button onClick={() => setActiveTab('all')} colorScheme={activeTab === 'all' ? 'blue' : 'gray'} className={`!py-1 !px-2`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>전체</Button>
                                <Button onClick={() => setActiveTab('equipment')} colorScheme={activeTab === 'equipment' ? 'blue' : 'gray'} className={`!py-1 !px-2`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>장비</Button>
                                <Button onClick={() => setActiveTab('consumable')} colorScheme={activeTab === 'consumable' ? 'blue' : 'gray'} className={`!py-1 !px-2`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>소모품</Button>
                                <Button onClick={() => setActiveTab('material')} colorScheme={activeTab === 'material' ? 'blue' : 'gray'} className={`!py-1 !px-2`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>재료</Button>
                            </div>
                            <div className={`flex items-center space-x-2`}>
                                <span style={{ fontSize: `${Math.max(10, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>정렬:</span>
                                <select onChange={(e) => setSortKey(e.target.value as SortKey)} value={sortKey} className={`bg-gray-700 text-white rounded-md p-1`} style={{ fontSize: `${Math.max(9, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>
                                    <option value="createdAt">최신순</option>
                                    <option value="grade">등급순</option>
                                    <option value="type">종류순</option>
                                </select>
                                <div className="text-gray-400" style={{ fontSize: `${Math.max(10, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                                    {`${filteredAndSortedInventory.length} / ${currentSlots}`}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1 min-h-0" style={{ width: '100%', minWidth: 0, paddingRight: `${Math.max(6, Math.round(8 * scaleFactor))}px`, WebkitOverflowScrolling: 'touch' }}>
                        <div 
                            className="grid gap-2" 
                            style={{ 
                                gridTemplateColumns: narrowInventoryLayout
                                    ? `repeat(8, minmax(0, 1fr))`
                                    : `repeat(12, minmax(0, 1fr))`,
                                gap: `${Math.max(narrowInventoryLayout ? 3 : 4, Math.round((narrowInventoryLayout ? 5 : 8) * scaleFactor))}px`,
                                width: '100%',
                                minWidth: 0,
                                paddingBottom: `${Math.max(200, Math.round(250 * scaleFactor))}px`
                            }}
                        >
                        {Array.from({ length: currentSlots }).map((_, index) => {
                            const item = filteredAndSortedInventory[index];
                            if (item) {
                                return (
                                    <div key={item.id} className="aspect-square" style={{ width: '100%', minWidth: 0, minHeight: 0, maxWidth: '100%' }}>
                                        <InventoryItemCard
                                            item={item}
                                            onClick={() => setSelectedItemId(item.id)}
                                            isSelected={selectedItemId === item.id}
                                            isEquipped={item.isEquipped || false}
                                            enhancementStars={enhancementAnimationTarget?.itemId === item.id ? enhancementAnimationTarget.stars : undefined}
                                            isPresetEquipped={isItemInAnyPreset(item.id)}
                                            scaleFactor={scaleFactor}
                                        />
                                    </div>
                                );
                            } else {
                                return (
                                    <div key={`empty-${index}`} className="aspect-square rounded-lg bg-gray-800/50 border-2 border-gray-700/50" style={{ width: '100%', minWidth: 0, minHeight: 0, maxWidth: '100%' }} />
                                );
                            }
                        })}
                        {canExpand && (
                            <button
                                key="expand-slot"
                                onClick={handleExpand}
                                className={`w-full aspect-square rounded-lg bg-gray-800/50 border-2 border-gray-700/50 flex items-center justify-center text-gray-400 ${narrowInventoryLayout ? 'text-3xl' : 'text-4xl'} hover:bg-gray-700/50 hover:border-accent active:bg-gray-600/50 transition-all duration-200`}
                                title={`가방 확장 (${expansionCost} 다이아)`}
                                style={{ minHeight: narrowInventoryLayout ? '44px' : undefined }}
                            >
                                +
                            </button>
                        )}
                    </div>
                    </div>

                </div>
            </div>

            {isEquipCompareOpen &&
                selectedItem?.type === 'equipment' &&
                selectedItem.slot &&
                selectedItem.id !== correspondingEquippedItem?.id && (
                    <DraggableWindow
                        title="장비 비교"
                        onClose={() => setIsEquipCompareOpen(false)}
                        windowId="inventoryEquipCompare"
                        isTopmost
                        initialWidth={720}
                        initialHeight={680}
                        variant="store"
                        mobileViewportFit={narrowInventoryLayout}
                        hideFooter
                        bodyPaddingClassName="p-2 sm:p-3"
                    >
                        <div
                            className="flex max-h-[min(78dvh,720px)] min-h-[min(50dvh,360px)] flex-col gap-2 overflow-y-auto overscroll-y-contain rounded-b-xl"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            <div className="flex min-h-0 min-h-[200px] flex-1 flex-row gap-2">
                                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-cyan-500/35 bg-panel-secondary/90 shadow-inner">
                                    <h4
                                        className="shrink-0 border-b border-cyan-500/20 px-2 py-1 font-bold text-cyan-200/95"
                                        style={{ fontSize: `${Math.max(11, Math.round(13 * scaleFactor * mobileTextScale))}px` }}
                                    >
                                        현재 장착
                                    </h4>
                                    <div className="min-h-0 flex-1 overflow-y-auto p-1.5" style={{ WebkitOverflowScrolling: 'touch' }}>
                                        <LocalItemDetailDisplay
                                            item={correspondingEquippedItem}
                                            title="장착된 장비 없음"
                                            comparisonItem={selectedItem}
                                            scaleFactor={Math.max(0.42, scaleFactor * 0.92)}
                                            mobileTextScale={mobileTextScale}
                                            userLevelSum={currentUser.strategyLevel + currentUser.playfulLevel}
                                            emptySlot={selectedItem.slot}
                                            detailScaleMultiplier={0.92}
                                        />
                                    </div>
                                </div>
                                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-600/55 bg-panel-secondary shadow-inner">
                                    <h4
                                        className="shrink-0 border-b border-gray-600/40 px-2 py-1 font-bold text-on-panel"
                                        style={{ fontSize: `${Math.max(11, Math.round(13 * scaleFactor * mobileTextScale))}px` }}
                                    >
                                        선택 장비
                                    </h4>
                                    <div className="min-h-0 flex-1 overflow-y-auto p-1.5" style={{ WebkitOverflowScrolling: 'touch' }}>
                                        <LocalItemDetailDisplay
                                            item={selectedItem}
                                            title="선택된 아이템 없음"
                                            comparisonItem={correspondingEquippedItem ?? undefined}
                                            scaleFactor={Math.max(0.42, scaleFactor * 0.92)}
                                            mobileTextScale={mobileTextScale}
                                            userLevelSum={currentUser.strategyLevel + currentUser.playfulLevel}
                                            detailScaleMultiplier={0.92}
                                        />
                                    </div>
                                </div>
                            </div>
                            {equipSwapStatPreview && (
                                <div className="shrink-0 rounded-lg border border-amber-400/30 bg-gradient-to-br from-amber-950/40 via-gray-900/90 to-gray-950/95 p-2 shadow-inner">
                                    <h4
                                        className="mb-1.5 font-bold text-amber-100/95"
                                        style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}
                                    >
                                        교체 시 바둑 능력치 변화
                                    </h4>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
                                        {Object.values(CoreStat).map((stat) => {
                                            const cur = equipSwapStatPreview.currentStats[stat];
                                            const next = equipSwapStatPreview.afterStats[stat];
                                            const d = equipSwapStatPreview.delta[stat];
                                            const deltaClass =
                                                d > 0 ? 'text-green-400' : d < 0 ? 'text-red-400' : 'text-stone-500';
                                            return (
                                                <div key={stat} className="min-w-0 rounded-md bg-black/25 px-1.5 py-1">
                                                    <div
                                                        className="truncate font-semibold text-stone-400"
                                                        style={{ fontSize: `${Math.max(9, Math.round(10 * scaleFactor * mobileTextScale))}px` }}
                                                    >
                                                        {stat}
                                                    </div>
                                                    <div
                                                        className="mt-0.5 font-mono tabular-nums text-stone-100"
                                                        style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}
                                                    >
                                                        <span className="text-stone-400">{cur}</span>
                                                        <span className="mx-0.5 text-stone-600">→</span>
                                                        <span>{next}</span>
                                                        {d !== 0 && (
                                                            <span className={`ml-1 font-bold ${deltaClass}`}>
                                                                ({d > 0 ? '+' : ''}
                                                                {d})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div
                                        className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-amber-500/20 pt-1.5 font-bold text-stone-100"
                                        style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}
                                    >
                                        <span className="text-amber-200/90">종합 능력</span>
                                        <span className="font-mono tabular-nums">
                                            <span className="text-stone-400">{equipSwapStatPreview.currentSum}</span>
                                            <span className="mx-1 text-stone-600">→</span>
                                            <span>{equipSwapStatPreview.afterSum}</span>
                                            {equipSwapStatPreview.sumDelta !== 0 && (
                                                <span
                                                    className={
                                                        equipSwapStatPreview.sumDelta > 0 ? 'ml-1 text-green-400' : 'ml-1 text-red-400'
                                                    }
                                                >
                                                    ({equipSwapStatPreview.sumDelta > 0 ? '+' : ''}
                                                    {equipSwapStatPreview.sumDelta})
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </DraggableWindow>
                )}

            {/* Modals */}
            {showUseQuantityModal && itemToUseBulk && (
                <UseQuantityModal
                    item={itemToUseBulk}
                    currentUser={currentUser}
                    onClose={() => {
                        setShowUseQuantityModal(false);
                        setItemToUseBulk(null);
                    }}
                    onConfirm={async (itemId, quantity, itemName) => {
                        try {
                            // 액션 실행 및 결과 대기
                            await onAction({ type: 'USE_ITEM', payload: { itemId, quantity, itemName } });
                        // 모달 닫기 (UseQuantityModal 내부에서도 닫지만, 여기서도 확실히 닫기)
                        setShowUseQuantityModal(false);
                        setItemToUseBulk(null);
                        } catch (error) {
                            console.error('[InventoryModal] Failed to use item:', error);
                            // 에러가 발생해도 모달은 닫기
                            setShowUseQuantityModal(false);
                            setItemToUseBulk(null);
                        }
                    }}
                    isTopmost={isTopmost && !isRenameModalOpen && !itemToSell && !itemToSellBulk && !isExpandModalOpen}
                />
            )}

            {itemToSell && (
                <SellItemConfirmModal
                    item={itemToSell}
                    onClose={() => setItemToSell(null)}
                    onConfirm={async () => {
                        if (itemToSell.type === 'material') {
                            // 재료는 선택된 슬롯의 수량만 판매 (1개 판매)
                            await onAction({ type: 'SELL_ITEM', payload: { itemId: itemToSell.id, quantity: 1 } });
                        } else if (itemToSell.type === 'consumable') {
                            // 소모품은 전체 판매 (수량이 있으면 전체 수량 판매)
                            await onAction({ type: 'SELL_ITEM', payload: { itemId: itemToSell.id, quantity: itemToSell.quantity || 1 } });
                        } else {
                            // 장비는 전체 판매
                            await onAction({ type: 'SELL_ITEM', payload: { itemId: itemToSell.id } });
                        }
                        setItemToSell(null);
                        setSelectedItemId(null);
                    }}
                    isTopmost={isTopmost && !isRenameModalOpen && !showUseQuantityModal && !itemToSellBulk && !isExpandModalOpen}
                />
            )}

            {itemToSellBulk && (
                <SellMaterialBulkModal
                    item={itemToSellBulk}
                    currentUser={currentUser}
                    onClose={() => setItemToSellBulk(null)}
                    onConfirm={async (quantity) => {
                        // 같은 이름의 아이템을 모두 찾아서 순차적으로 판매 (재료 또는 소모품)
                        const itemsToSell = currentUser.inventory
                            .filter(i => i.type === itemToSellBulk.type && i.name === itemToSellBulk.name)
                            .sort((a, b) => (a.quantity || 0) - (b.quantity || 0)); // 수량이 적은 것부터 정렬
                        
                        let remainingQuantity = quantity;
                        
                        // 순차적으로 처리하여 인벤토리 상태가 올바르게 업데이트되도록 함
                        for (const item of itemsToSell) {
                            if (remainingQuantity <= 0) break;
                            const sellQty = Math.min(remainingQuantity, item.quantity || 0);
                            await onAction({ type: 'SELL_ITEM', payload: { itemId: item.id, quantity: sellQty } });
                            remainingQuantity -= sellQty;
                        }
                        
                        setItemToSellBulk(null);
                        setSelectedItemId(null);
                    }}
                    isTopmost={isTopmost && !isRenameModalOpen && !showUseQuantityModal && !itemToSell && !isExpandModalOpen}
                />
            )}

            {isExpandModalOpen && activeTab !== 'all' && (
                <DraggableWindow title="가방 확장" onClose={() => setIsExpandModalOpen(false)} windowId="expandInventory" isTopmost={isTopmost} variant="store">
                    <div className="w-full h-full flex flex-col items-center justify-center p-6">
                        <div className="w-full max-w-[360px] flex flex-col items-center justify-center space-y-6 text-center">
                            <div className="flex flex-col items-center space-y-3 w-full">
                                <p className="text-on-panel text-base font-medium w-full">{`${activeTabLabel} 가방을 확장하시겠습니까?`}</p>
                                <div className="flex items-center justify-center gap-3 text-base font-semibold w-full">
                                    <span className="text-gray-400">{currentCategorySlots}칸</span>
                                    <span className="text-gray-500">→</span>
                                    <span className="text-emerald-300">{nextCategorySlots}칸</span>
                                    {slotsIncrease > 0 && (
                                        <span className="text-emerald-400 text-sm">(+{slotsIncrease})</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-2 w-full">
                                <span className="text-xs text-gray-400">필요 다이아</span>
                                <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full border ${hasEnoughDiamonds ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-100' : 'border-rose-500/60 bg-rose-500/10 text-rose-200'}`}>
                                    <img src="/images/icon/Zem.png" alt="다이아" className="w-5 h-5 object-contain" />
                                    <span className="font-bold text-base">{expansionCost.toLocaleString()}</span>
                                </div>
                                {!hasEnoughDiamonds && (
                                    <span className="text-xs text-rose-300 mt-1">다이아가 부족합니다.</span>
                                )}
                            </div>
                            <div className="flex items-center justify-center gap-3 w-full pt-2">
                                <Button 
                                    onClick={() => setIsExpandModalOpen(false)} 
                                    colorScheme="gray"
                                    className="px-6 py-2.5 min-w-[100px]"
                                >
                                    취소
                                </Button>
                                <ResourceActionButton
                                    onClick={handleConfirmExpand}
                                    disabled={!hasEnoughDiamonds}
                                    variant="diamonds"
                                    className="flex items-center justify-center gap-2 px-6 py-2.5 min-w-[120px]"
                                >
                                    <span>확장</span>
                                    <span className="flex items-center gap-1 text-sm">
                                        <img src="/images/icon/Zem.png" alt="다이아" className="w-4 h-4 object-contain" />
                                        {expansionCost.toLocaleString()}
                                    </span>
                                </ResourceActionButton>
                            </div>
                        </div>
                    </div>
                </DraggableWindow>
            )}

            {isRenameModalOpen && (
                <DraggableWindow title="프리셋 이름 변경" onClose={() => setIsRenameModalOpen(false)} windowId="renamePreset" isTopmost={isTopmost && !isExpandModalOpen}>
                    <div className="p-4 flex flex-col items-center">
                        <p className="mb-4 text-on-panel">새로운 프리셋 이름을 입력하세요:</p>
                        <input
                            type="text"
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            className="bg-secondary border border-color text-on-panel text-sm rounded-md p-2 mb-4 w-full max-w-xs"
                            maxLength={20}
                        />
                        <div className="flex gap-2">
                            <Button onClick={handleSavePreset} colorScheme="blue">
                                저장
                            </Button>
                            <Button onClick={() => setIsRenameModalOpen(false)} colorScheme="gray">
                                취소
                            </Button>
                        </div>
                    </div>
                </DraggableWindow>
            )}
        </DraggableWindow>
    );
};

const InventoryItemCard: React.FC<{
    item: InventoryItem;
    onClick: () => void;
    isSelected: boolean;
    isEquipped: boolean;
    enhancementStars: number | undefined;
    isPresetEquipped?: boolean;
    scaleFactor?: number;
}> = ({ item, onClick, isSelected, isEquipped, enhancementStars, isPresetEquipped, scaleFactor = 1 }) => {
    const stars = enhancementStars || item.stars || 0;
    
    const renderStarDisplay = () => {
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

        const starSize = Math.max(8, Math.round(10 * scaleFactor));
        const fontSize = Math.max(8, Math.round(10 * scaleFactor));
        const gap = Math.max(2, Math.round(2 * scaleFactor));
        const padding = Math.max(2, Math.round(2 * scaleFactor));

        return (
            <div 
                className="absolute flex items-center bg-black/40 rounded-bl-md z-10" 
                style={{ 
                    textShadow: '1px 1px 2px black',
                    top: `${Math.max(2, Math.round(2 * scaleFactor))}px`,
                    right: `${Math.max(2, Math.round(2 * scaleFactor))}px`,
                    gap: `${gap}px`,
                    padding: `${padding}px`
                }}
            >
                <img src={starImage} alt="star" style={{ width: `${starSize}px`, height: `${starSize}px` }} />
                <span className={`font-bold leading-none ${numberColor}`} style={{ fontSize: `${fontSize}px` }}>{stars}</span>
            </div>
        );
    };

    const isTranscendent = item.grade === ItemGrade.Transcendent;

    return (
        <div
            onClick={onClick}
            className={`relative aspect-square rounded-lg cursor-pointer transition-all duration-200 ${isSelected ? 'ring-2 ring-accent' : 'ring-1 ring-transparent'} hover:ring-2 hover:ring-accent/70 ${isTranscendent ? 'transcendent-grade-slot' : ''}`}
            title={item.name}
            style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, maxWidth: '100%', maxHeight: '100%', boxSizing: 'border-box' }}
        >
            <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 object-cover rounded-md" style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }} />
            {(() => {
                // 이미지 경로 찾기: item.image가 있으면 사용, 없으면 CONSUMABLE_ITEMS나 MATERIAL_ITEMS에서 찾기
                let imagePath: string | undefined = item.image;
                
                if (!imagePath && item.type === 'consumable') {
                    const consumableItem = findConsumableItem(item.name);
                    imagePath = consumableItem?.image;
                }
                
                // MATERIAL_ITEMS에서 찾기
                if (!imagePath) {
                    // 숫자를 로마숫자로 변환하는 맵
                    const numToRoman: Record<string, string> = {
                        '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI'
                    };
                    
                    // 다양한 이름 변형으로 시도
                    const nameVariations: string[] = [
                        item.name,
                        item.name.replace('꾸러미', ' 꾸러미'),
                        item.name.replace(' 꾸러미', '꾸러미'),
                        item.name.replace('상자', ' 상자'),
                        item.name.replace(' 상자', '상자'),
                    ];
                    
                    // 숫자를 로마숫자로 변환한 변형들 추가
                    for (const [num, roman] of Object.entries(numToRoman)) {
                        nameVariations.push(
                            item.name.replace(new RegExp(`장비상자${num}`, 'g'), `장비 상자 ${roman}`),
                            item.name.replace(new RegExp(`재료상자${num}`, 'g'), `재료 상자 ${roman}`),
                            item.name.replace(new RegExp(`장비 상자${num}`, 'g'), `장비 상자 ${roman}`),
                            item.name.replace(new RegExp(`재료 상자${num}`, 'g'), `재료 상자 ${roman}`),
                            item.name.replace(new RegExp(`장비 상자 ${num}`, 'g'), `장비 상자 ${roman}`),
                            item.name.replace(new RegExp(`재료 상자 ${num}`, 'g'), `재료 상자 ${roman}`)
                        );
                    }
                    
                    // 정규화된 이름도 추가
                    nameVariations.push(normalizeConsumableName(item.name));
                    
                    // 각 변형으로 MATERIAL_ITEMS에서 찾기
                    for (const nameVar of nameVariations) {
                        if (MATERIAL_ITEMS[nameVar]?.image) {
                            imagePath = MATERIAL_ITEMS[nameVar].image;
                            break;
                        }
                    }
                }
                
                if (isActionPointConsumable(item.name)) {
                    const match = item.name.match(/\+(\d+)/);
                    const apValue = match ? match[1] : null;
                    return (
                        <span
                            className="absolute inset-0 flex flex-col items-center justify-center text-3xl"
                            style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                            aria-hidden
                        >
                            <span>⚡</span>
                            {apValue && (
                                <span className="text-xs font-bold mt-0.5 text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,0.8)]">
                                    +{apValue}
                                </span>
                            )}
                        </span>
                    );
                }
                return imagePath ? (
                    <img 
                        src={imagePath} 
                        alt={item.name} 
                        className="absolute object-contain" 
                        style={{ 
                            width: '80%', 
                            height: '80%', 
                            padding: `${Math.max(4, Math.round(6 * scaleFactor))}px`, 
                            maxWidth: '80%', 
                            maxHeight: '80%', 
                            left: '50%', 
                            top: '50%', 
                            transform: 'translate(-50%, -50%)' 
                        }} 
                        onError={(e) => {
                            console.error(`[InventoryItemCard] Failed to load image: ${imagePath} for item:`, item);
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                ) : null;
            })()}
            {renderStarDisplay()}
            {isEquipped && (
                <div 
                    className="absolute bg-green-500 text-white flex items-center justify-center rounded-full border-2 border-gray-800"
                    style={{
                        top: `${Math.max(4, Math.round(6 * scaleFactor))}px`,
                        left: `${Math.max(4, Math.round(6 * scaleFactor))}px`,
                        width: `${Math.max(12, Math.round(16 * scaleFactor))}px`,
                        height: `${Math.max(12, Math.round(16 * scaleFactor))}px`,
                        fontSize: `${Math.max(8, Math.round(10 * scaleFactor))}px`
                    }}
                >
                    E
                </div>
            )}
            {!isEquipped && isPresetEquipped && (
                <div 
                    className="absolute bg-blue-500 text-white flex items-center justify-center rounded-full border-2 border-gray-800"
                    style={{
                        top: `${Math.max(4, Math.round(6 * scaleFactor))}px`,
                        left: `${Math.max(4, Math.round(6 * scaleFactor))}px`,
                        width: `${Math.max(12, Math.round(16 * scaleFactor))}px`,
                        height: `${Math.max(12, Math.round(16 * scaleFactor))}px`,
                        fontSize: `${Math.max(8, Math.round(10 * scaleFactor))}px`
                    }}
                >
                    P
                </div>
            )}
            {(item.type === 'consumable' || item.type === 'material') && item.quantity && item.quantity > 1 && (
                <div 
                    className="absolute bg-black/70 text-white font-bold rounded border border-white/30"
                    style={{
                        bottom: `${Math.max(2, Math.round(2 * scaleFactor))}px`,
                        right: `${Math.max(2, Math.round(2 * scaleFactor))}px`,
                        fontSize: `${Math.max(8, Math.round(10 * scaleFactor))}px`,
                        padding: `${Math.max(2, Math.round(4 * scaleFactor))}px ${Math.max(3, Math.round(4 * scaleFactor))}px`
                    }}
                >
                    {item.quantity}
                </div>
            )}
        </div>
    );
};



export default InventoryModal;