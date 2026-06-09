import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { UserWithStatus, InventoryItem, ServerAction, InventoryItemType, ItemGrade, ItemOption, CoreStat, SpecialStat, MythicStat, EquipmentSlot, ItemOptionType } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import ResourceActionButton from './ui/ResourceActionButton.js';
import { emptySlotImages, GRADE_LEVEL_REQUIREMENTS, formatEquipLevelRequirement, ITEM_SELL_PRICES, MATERIAL_SELL_PRICES, gradeBackgrounds, gradeStyles, BASE_SLOTS_PER_CATEGORY, EXPANSION_AMOUNT, MAX_EQUIPMENT_SLOTS, MAX_CONSUMABLE_SLOTS, MAX_MATERIAL_SLOTS, ENHANCEMENT_COSTS, CONSUMABLE_ITEMS, MATERIAL_ITEMS, isActionPointConsumable, isConditionPotionConsumable, isTowerOnlyConsumable, isRefinementTicketMaterial, normalizeRefinementTicketInventoryName } from '../constants/items';
import { isPairArenaExclusiveBagItem, isPairPetMaterial } from '../shared/constants/petLobby.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';

import { calculateUserEffects } from '../services/effectService.js';
import { calculateTotalStats } from '../services/statService.js';
import { computeCoreStatFinalFromBonuses } from '../shared/utils/coreStatComposition.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { resolveAspectFittedModalFrame } from '../utils/modalFrameSizing.js';
import { getLayoutViewportSize } from '../hooks/useIsMobileLayout.js';
import PurchaseQuantityModal from './PurchaseQuantityModal.js';
import SellItemConfirmModal from './SellItemConfirmModal.js';
import SellMaterialBulkModal from './SellMaterialBulkModal.js';
import UseQuantityModal from './UseQuantityModal.js';
import AlertModal from './AlertModal.js';
import { MythicOptionAbbrev } from './MythicStatAbbrev.js';
import { coerceSpecialStatType } from '../shared/utils/specialStatMilestones.js';
import { EquipmentBagStyleOptionRow, resolveEquipmentOptionColorClass } from './equipment/EquipmentBagStyleOptionRow.js';
import {
    AP_CONSUMABLE_LIGHTNING_FONT_SIZE_CQ,
    AP_CONSUMABLE_PLUS_FONT_SIZE_CQ,
    apConsumableLightningEmojiPx,
    apConsumableLightningPlusLabelPx,
    findConsumableItem,
    getEnhancementMaterialUsageLinesForBag,
    normalizeConsumableName,
    resolveBagItemDetailImagePath,
} from '../shared/utils/bagItemDetailHelpers.js';
import { EquipmentDetailPanel } from './EquipmentDetailPanel.js';
import InventorySlotExpandDiamondBody from './inventory/InventorySlotExpandDiamondBody.js';
import {
    collectActiveExchangeListedItemIds,
    isEquipmentHiddenFromBag,
} from '../shared/utils/exchangeInventorySync.js';
import {
    MOBILE_EQUIPMENT_DETAIL_BODY_PADDING_CLASS,
    MOBILE_EQUIPMENT_DETAIL_LAYOUT_SCALE,
    MOBILE_EQUIPMENT_DETAIL_MAX_HEIGHT_CSS,
    MOBILE_EQUIPMENT_DETAIL_MODAL_WIDTH,
} from '../shared/constants/mobileEquipmentDetailModal.js';

interface InventoryModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void | Promise<void | { gameId?: string; claimAllTrainingQuestRewards?: any }>;
    onStartEnhance: (item: InventoryItem) => void;
    onOpenBlacksmithTab: (tab: 'convert' | 'refine') => void;
    enhancementAnimationTarget: { itemId: string; stars: number } | null;
    onAnimationComplete: () => void;
    isTopmost?: boolean;
    embedded?: boolean;
}

type Tab = 'all' | 'equipment' | 'consumable' | 'material';
type SortKey = 'createdAt' | 'type' | 'grade';

const TAB_LABELS: Record<Tab, string> = {
    all: '전체',
    equipment: '장비',
    consumable: '소모품',
    material: '재료',
};

/** 모바일 「장착 장비」 팝업 설계 너비(DraggableWindow initialWidth) — 본문·슬롯 스케일 기준 */
const MOBILE_EQUIPPED_MODAL_DESIGN_WIDTH = 350;

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

const inventoryTypeRank: Record<InventoryItemType, number> = {
    equipment: 0,
    consumable: 1,
    material: 2,
};
const EQUIPMENT_UNBIND_TICKET_NAME = '귀속 해제권';
const EQUIPMENT_UNBIND_TICKET_COST_BY_GRADE: Record<ItemGrade, number> = {
    normal: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
    mythic: 6,
    transcendent: 7,
};

/** 가방·인벤 모달 내 스크롤 영역 — 매우 얇은 스크롤바 (Firefox `thin` + WebKit 3px) */
const BAG_SCROLLBAR_Y_CLASS =
    '[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.3)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/38 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/48';

/** PC 가방 등: 옵션 패널 고정 높이(스크롤) — `expandOptionsToFill`이 아닐 때만 사용 */
function bagPcOptionsBlockHeightPx(scaleFactor: number): number {
    return Math.max(128, Math.round(164 * scaleFactor));
}

/**
 * 공통 규칙: 줄바꿈/말줄임 없이 한 줄 유지.
 * 텍스트 길이가 길수록 폰트만 축소해 한 줄로 표시한다.
 */
function resolveNoWrapTextFontPx(
    text: string | null | undefined,
    preferredPx: number,
    minPx = 7,
    shrinkStartLength = 10,
    shrinkPerChar = 0.58,
): number {
    const length = Array.from(text ?? '').length;
    const shrink = Math.max(0, length - shrinkStartLength) * shrinkPerChar;
    return Math.max(minPx, Math.round(preferredPx - shrink));
}

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
    /** 모바일 장착 장비 모달 등: 아이콘 비율 축소 */
    compactIconLayout?: boolean;
}> = ({ slot, item, scaleFactor = 1, onClick, isSelected = false, compactIconLayout = false }) => {
    const renderStarDisplay = (stars: number) => {
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

        /** `EquipmentDetailPanel`과 동일: 테두리 없음, bg-black/45. 모바일·좁은 슬롯은 comfortableTypography와 동일 크기 */
        const badgeShell =
            'absolute right-1.5 top-0.5 z-10 flex items-center gap-0.5 rounded-bl-md bg-black/45 px-1 py-0.5 backdrop-blur-[2px]';
        if (compactIconLayout) {
            return (
                <div className={badgeShell} style={{ textShadow: '1px 1px 2px black' }}>
                    <img src={starImage} alt="" className="h-3.5 w-3.5" />
                    <span className={`text-[13px] font-bold leading-none ${numberColor}`}>{stars}</span>
                </div>
            );
        }

        const starSize = Math.max(12, Math.round(12 * scaleFactor));
        const fontSize = Math.max(12, Math.round(12 * scaleFactor));

        return (
            <div className={badgeShell} style={{ textShadow: '1px 1px 2px black' }}>
                <img src={starImage} alt="" style={{ width: `${starSize}px`, height: `${starSize}px` }} />
                <span className={`font-bold leading-none ${numberColor}`} style={{ fontSize: `${fontSize}px` }}>
                    {stars}
                </span>
            </div>
        );
    };

    if (item) {
        const iconPct = compactIconLayout ? '70%' : '80%';
        const padding = Math.max(
            compactIconLayout ? 3 : 4,
            Math.round((compactIconLayout ? 5 : 6) * scaleFactor)
        );
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
                    boxSizing: 'border-box',
                    containerType: 'size',
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
                                className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-[min(4px,8%)] leading-none"
                                aria-hidden
                                style={{ fontSize: AP_CONSUMABLE_LIGHTNING_FONT_SIZE_CQ }}
                            >
                                <span className="leading-none">⚡</span>
                                {apValue && (
                                    <span
                                        className="mt-0.5 max-w-full whitespace-nowrap font-bold leading-none text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,0.8)]"
                                        style={{ fontSize: AP_CONSUMABLE_PLUS_FONT_SIZE_CQ }}
                                    >
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
                                width: iconPct, 
                                height: iconPct, 
                                padding: `${padding}px`, 
                                maxWidth: iconPct, 
                                maxHeight: iconPct,
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
    /** 모바일 장비 비교용: 좌측(이미지+기본정보), 우측(옵션 전체) 분리 레이아웃 */
    compactCompareLayout?: boolean;
    /** 부모가 `flex`+고정 높이일 때: 옵션 박스가 남는 세로를 모두 쓰고(최대화), 고정 픽셀 높이 제거 */
    expandOptionsToFill?: boolean;
}> = ({
    item,
    title,
    comparisonItem,
    scaleFactor = 1,
    userLevelSum = 0,
    mobileTextScale = 1,
    emptySlot,
    detailScaleMultiplier = 1,
    compactCompareLayout = false,
    expandOptionsToFill = false,
}) => {
    const imgBox = Math.max(52, Math.round(80 * scaleFactor * detailScaleMultiplier));
    const optionsBlockHeightPx = bagPcOptionsBlockHeightPx(scaleFactor);
    const [compactCompareTab, setCompactCompareTab] = useState<'info' | 'mainSub' | 'special' | 'mythic'>('info');
    const detailTitleFontPx = resolveNoWrapTextFontPx(
        title,
        Math.max(14, Math.round(18 * scaleFactor * mobileTextScale)),
        9,
        9,
        0.72,
    );
    // item이 없을 때도 "선택 장비" 뷰어와 동일한 구조로 표시
    if (!item) {
        return (
            <div
                className={`flex min-h-0 w-full flex-col ${expandOptionsToFill ? 'h-full' : ''}`}
                style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}
            >
                {/* Top Section: Image (left), Name (right) - 선택 장비 뷰어와 동일한 구조 */}
                <div className="flex shrink-0 items-start justify-between mb-2">
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
                            <h3 className="max-w-full whitespace-nowrap font-bold text-tertiary" title={title} style={{ fontSize: `${detailTitleFontPx}px` }}>{title}</h3>
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Sub Options - 비워둠 */}
                <div
                    className={`w-full space-y-1 bg-gray-900/50 p-2 text-left ${BAG_SCROLLBAR_Y_CLASS} ${
                        expandOptionsToFill
                            ? 'min-h-0 flex-1 overflow-y-auto rounded-t-lg rounded-b-none'
                            : 'flex-shrink-0 overflow-y-auto rounded-lg'
                    }`}
                    style={{
                        fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px`,
                        ...(expandOptionsToFill
                            ? {}
                            : {
                                  height: `${optionsBlockHeightPx}px`,
                                  minHeight: `${optionsBlockHeightPx}px`,
                                  maxHeight: `${optionsBlockHeightPx}px`,
                              }),
                    }}
                >
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

        const badgeShell =
            'absolute right-1.5 top-0.5 z-10 flex items-center gap-0.5 rounded-bl-md bg-black/45 px-1 py-0.5 backdrop-blur-[2px]';
        /** 아이콘 슬롯이 작을 때 `EquipmentDetailPanel` comfortableTypography와 동일 */
        if (imgBox <= 96) {
            return (
                <div className={badgeShell} style={{ textShadow: '1px 1px 2px black' }}>
                    <img src={starImage} alt="" className="h-3.5 w-3.5" />
                    <span className={`text-[13px] font-bold leading-none ${numberColor}`}>{stars}</span>
                </div>
            );
        }

        const starSize = Math.max(12, Math.round(12 * scaleFactor));
        const fontSize = Math.max(12, Math.round(12 * scaleFactor));

        return (
            <div className={badgeShell} style={{ textShadow: '1px 1px 2px black' }}>
                <img src={starImage} alt="" style={{ width: `${starSize}px`, height: `${starSize}px` }} />
                <span className={`font-bold leading-none ${numberColor}`} style={{ fontSize: `${fontSize}px` }}>
                    {stars}
                </span>
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
        if (coerceSpecialStatType(type)) return 1; // 특수옵션
        if (Object.values(MythicStat).includes(type as MythicStat)) return 2;  // 신화/초월 부옵션
        return 3;
    };

    const sortedOptionTypes = Array.from(optionMap.keys()).sort((a, b) => {
        const catA = getOptionCategoryOrder(a);
        const catB = getOptionCategoryOrder(b);
        if (catA !== catB) return catA - catB;
        return String(a).localeCompare(String(b));
    });

    const itemStars = item.stars ?? 0;

    const renderBagInventoryOptionRow = (opt: ItemOption, colorClass: string, extraClass = '') => (
        <EquipmentBagStyleOptionRow
            key={opt.type}
            opt={opt}
            itemStars={itemStars}
            colorClass={colorClass}
            className={extraClass}
        />
    );

    const optionRows = sortedOptionTypes.map(type => {
        const { current, comparison } = optionMap.get(type)!;

        // 메인 옵션은 별도 렌더링
        if (item.options?.main?.type === type) return null;

        if (current && comparison) {
            return renderBagInventoryOptionRow(current, resolveEquipmentOptionColorClass(current.type));
        }
        if (current && !comparison) {
            return renderBagInventoryOptionRow(current, resolveEquipmentOptionColorClass(current.type));
        }
        if (!current && comparison) {
            return renderBagInventoryOptionRow(comparison, resolveEquipmentOptionColorClass(comparison.type), 'line-through');
        }
        return null;
    });

    const compareCurrent = item.type === 'equipment' ? item : null;
    const compareSelected = comparisonItem && comparisonItem.type === 'equipment' ? comparisonItem : null;

    const pickOptionByType = (invItem: InventoryItem | null, optionType: ItemOptionType): ItemOption | null => {
        if (!invItem) return null;
        return getAllOptions(invItem).find(opt => opt.type === optionType) ?? null;
    };

    const collectTypesByFilter = (predicate: (opt: ItemOption) => boolean): ItemOptionType[] => {
        const typeSet = new Set<ItemOptionType>();
        getAllOptions(compareCurrent).forEach((opt) => {
            if (predicate(opt)) typeSet.add(opt.type);
        });
        getAllOptions(compareSelected).forEach((opt) => {
            if (predicate(opt)) typeSet.add(opt.type);
        });
        return Array.from(typeSet.values()).sort((a, b) => String(a).localeCompare(String(b)));
    };

    const mainAndCombatTypes = collectTypesByFilter(
        (opt) => !!(compareCurrent?.options?.main?.type === opt.type || compareSelected?.options?.main?.type === opt.type || Object.values(CoreStat).includes(opt.type as CoreStat)),
    );
    const specialTypes = collectTypesByFilter((opt) => coerceSpecialStatType(opt.type) !== undefined);
    const mythicTypes = collectTypesByFilter((opt) => Object.values(MythicStat).includes(opt.type as MythicStat));

    const renderCompareOptionRow = (type: ItemOptionType) => {
        const currentOpt = pickOptionByType(compareCurrent, type);
        const selectedOpt = pickOptionByType(compareSelected, type);
        const currentVal = currentOpt?.value ?? 0;
        const selectedVal = selectedOpt?.value ?? 0;
        const delta = selectedVal - currentVal;
        const deltaCls = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-stone-400';
        const labelSource = currentOpt ?? selectedOpt;
        const rangeText = labelSource?.range && !labelSource.display.includes('[') ? ` [${labelSource.range[0]}~${labelSource.range[1]}]` : '';
        const isMythicType = !!labelSource && Object.values(MythicStat).includes(labelSource.type as MythicStat);
        const optionLabelText = `${labelSource?.display ?? String(type)}${rangeText}`;
        const optionLabelFontPx = resolveNoWrapTextFontPx(optionLabelText, 10, 7, 11, 0.42);
        const currentValueFontPx = resolveNoWrapTextFontPx(currentOpt ? String(currentOpt.value) : '-', 10, 7, 6, 0.32);
        const selectedValueFontPx = resolveNoWrapTextFontPx(selectedOpt ? String(selectedOpt.value) : '-', 10, 7, 6, 0.32);

        return (
            <div key={String(type)} className="rounded-md bg-black/25 px-1.5 py-1">
                <div className="whitespace-nowrap text-[10px] font-semibold text-stone-300" style={{ fontSize: `${optionLabelFontPx}px` }}>
                    {isMythicType && labelSource ? (
                        <>
                            <MythicOptionAbbrev option={labelSource} textClassName="text-orange-300" />
                            {rangeText}
                        </>
                    ) : (
                        <span>{labelSource?.display ?? String(type)}{rangeText}</span>
                    )}
                </div>
                <div className="mt-0.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1 text-[10px] tabular-nums">
                    <span className="whitespace-nowrap text-cyan-200" style={{ fontSize: `${currentValueFontPx}px` }}>{currentOpt ? currentOpt.value : '-'}</span>
                    <span className="text-stone-500">→</span>
                    <span className="whitespace-nowrap text-amber-200" style={{ fontSize: `${selectedValueFontPx}px` }}>{selectedOpt ? selectedOpt.value : '-'}</span>
                </div>
                <div className={`mt-0.5 text-right text-[10px] font-bold ${deltaCls}`}>
                    {delta > 0 ? `+${delta}` : `${delta}`}
                </div>
            </div>
        );
    };

    if (compactCompareLayout && item.type === 'equipment') {
        return (
            <div className="flex h-full min-h-0 gap-2" style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                <div className="flex min-h-0 w-[43%] min-w-0 flex-col">
                    <div
                        className="relative mx-auto rounded-lg"
                        style={{
                            width: `${imgBox}px`,
                            height: `${imgBox}px`,
                            aspectRatio: '1 / 1',
                            maxWidth: '100%',
                        }}
                    >
                        <img src={styles.background} alt={item.grade} className="absolute inset-0 h-full w-full rounded-lg object-cover" />
                        {item.image && (
                            <img
                                src={item.image}
                                alt={item.name}
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
                        )}
                        {renderStarDisplay(item.stars)}
                    </div>
                    <div className={`mt-1.5 min-h-0 flex-1 overflow-y-auto rounded-lg bg-gray-900/50 p-2 ${BAG_SCROLLBAR_Y_CLASS}`}>
                        <h3 className={`max-w-full whitespace-nowrap font-bold ${styles.color}`} title={item.name} style={{ fontSize: `${resolveNoWrapTextFontPx(item.name, Math.max(12, Math.round(14 * scaleFactor * mobileTextScale)), 8, 9, 0.62)}px` }}>
                            {item.name}
                        </h3>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5" style={{ fontSize: `${Math.max(9, Math.round(10 * scaleFactor * mobileTextScale))}px` }}>
                            <span className={styles.color}>[{styles.name}]</span>
                            {showRequirement && (
                                <span className={`${levelRequirementMet ? 'text-gray-300' : 'text-red-400'} whitespace-nowrap`}>
                                    {formatEquipLevelRequirement(requiredLevel)}
                                </span>
                            )}
                        </div>
                        <p className={`mt-1 text-xs font-semibold ${item.grade !== 'normal' && (item as any).refinementCount > 0 ? 'text-amber-400' : 'text-red-400'}`} style={{ fontSize: `${Math.max(9, Math.round(10 * scaleFactor * mobileTextScale))}px` }}>
                            제련 가능: {item.grade !== 'normal' && (item as any).refinementCount > 0 ? `${(item as any).refinementCount}회` : '제련불가'}
                        </p>
                    </div>
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg bg-gray-900/50 p-1.5" style={{ fontSize: `${Math.max(10, Math.round(11 * scaleFactor * mobileTextScale))}px` }}>
                    <div className="mb-1 grid grid-cols-2 gap-1">
                        {[
                            ['info', '장비정보'],
                            ['mainSub', '주/부옵션'],
                            ['special', '특수옵션'],
                            ['mythic', '신화옵션'],
                        ].map(([key, label]) => {
                            const active = compactCompareTab === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setCompactCompareTab(key as 'info' | 'mainSub' | 'special' | 'mythic')}
                                    className={`rounded-md border px-1 py-1 text-[10px] font-semibold leading-none transition-colors ${
                                        active
                                            ? 'border-amber-400/70 bg-amber-900/40 text-amber-100'
                                            : 'border-gray-600/60 bg-black/25 text-gray-300'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mb-1 grid grid-cols-2 gap-1 rounded-md bg-black/20 px-1.5 py-1 text-[10px] font-semibold">
                        <span className="text-cyan-200">현재 장착</span>
                        <span className="text-right text-amber-200">선택 장비</span>
                    </div>
                    <div className={`min-h-0 flex-1 overflow-y-auto space-y-1 pr-0.5 ${BAG_SCROLLBAR_Y_CLASS}`}>
                        {compactCompareTab === 'info' && (
                            <>
                                <div className="rounded-md bg-black/25 px-1.5 py-1 text-[10px]">
                                    <div className="text-stone-400">등급</div>
                                    <div className="mt-0.5 grid grid-cols-2 gap-1">
                                        <span className={`${styles.color}`}>{styles.name}</span>
                                        <span className="text-right text-stone-200">{compareSelected ? gradeStyles[compareSelected.grade].name : '-'}</span>
                                    </div>
                                </div>
                                <div className="rounded-md bg-black/25 px-1.5 py-1 text-[10px]">
                                    <div className="text-stone-400">착용레벨</div>
                                    <div className="mt-0.5 grid grid-cols-2 gap-1 tabular-nums">
                                        <span>{formatEquipLevelRequirement(requiredLevel)}</span>
                                        <span className="text-right">
                                            {compareSelected
                                                ? formatEquipLevelRequirement(GRADE_LEVEL_REQUIREMENTS[compareSelected.grade])
                                                : '-'}
                                        </span>
                                    </div>
                                </div>
                                <div className="rounded-md bg-black/25 px-1.5 py-1 text-[10px]">
                                    <div className="text-stone-400">제련 가능</div>
                                    <div className="mt-0.5 grid grid-cols-2 gap-1 tabular-nums">
                                        <span>{compareCurrent && compareCurrent.grade !== 'normal' && ((compareCurrent as any)?.refinementCount ?? 0) > 0 ? `${(compareCurrent as any).refinementCount}회` : '제련불가'}</span>
                                        <span className="text-right">{compareSelected && compareSelected.grade !== 'normal' && ((compareSelected as any)?.refinementCount ?? 0) > 0 ? `${(compareSelected as any).refinementCount}회` : '제련불가'}</span>
                                    </div>
                                </div>
                                <div className="rounded-md bg-black/25 px-1.5 py-1 text-[10px]">
                                    <div className="text-stone-400">강화 수치</div>
                                    <div className="mt-0.5 grid grid-cols-2 gap-1 tabular-nums">
                                        <span>+{compareCurrent?.stars ?? 0}</span>
                                        <span className="text-right">+{compareSelected?.stars ?? 0}</span>
                                    </div>
                                </div>
                            </>
                        )}
                        {compactCompareTab === 'mainSub' && (mainAndCombatTypes.length > 0 ? mainAndCombatTypes.map(renderCompareOptionRow) : <p className="px-1 py-1 text-[10px] text-stone-500">옵션 없음</p>)}
                        {compactCompareTab === 'special' && (specialTypes.length > 0 ? specialTypes.map(renderCompareOptionRow) : <p className="px-1 py-1 text-[10px] text-stone-500">옵션 없음</p>)}
                        {compactCompareTab === 'mythic' && (mythicTypes.length > 0 ? mythicTypes.map(renderCompareOptionRow) : <p className="px-1 py-1 text-[10px] text-stone-500">옵션 없음</p>)}
                    </div>
                </div>
            </div>
        );
    }

    if (item.type === 'consumable' || item.type === 'material') {
        const comfortableTypography = expandOptionsToFill || scaleFactor * mobileTextScale >= 1.12;
        const bagIconPx = expandOptionsToFill ? Math.max(52, Math.round(80 * scaleFactor * detailScaleMultiplier)) : undefined;
        return (
            <div
                className={`flex min-h-0 w-full min-w-0 flex-1 flex-col ${expandOptionsToFill ? 'h-full' : ''}`}
                style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}
            >
                <div className={`flex min-h-0 w-full flex-1 flex-col overflow-hidden ${expandOptionsToFill ? 'min-h-0' : ''}`}>
                    <EquipmentDetailPanel
                        item={item}
                        iconSlotPx={bagIconPx}
                        optionsScrollable={expandOptionsToFill}
                        comfortableTypography={comfortableTypography}
                        showTradeStatusUnderImage
                    />
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex min-h-0 w-full flex-col ${expandOptionsToFill ? 'h-full' : ''}`}
            style={{ fontSize: `${Math.max(13, Math.round(14 * scaleFactor * mobileTextScale))}px` }}
        >
            {/* Top Section: Image (left), Name & Main Option (right) */}
            <div className="flex shrink-0 items-start justify-between mb-2">
                {/* Left: Image */}
                <div className="flex flex-shrink-0 flex-col items-center">
                    <div
                        className="relative rounded-lg"
                        style={{
                            width: `${imgBox}px`,
                            height: `${imgBox}px`,
                            aspectRatio: '1 / 1',
                        }}
                    >
                        <img src={styles.background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                        {(() => {
                            const imagePath = resolveBagItemDetailImagePath(item);

                            if (isActionPointConsumable(item.name)) {
                                const match = item.name.match(/\+(\d+)/);
                                const apValue = match ? match[1] : null;
                                const emojiPx = apConsumableLightningEmojiPx(imgBox);
                                const plusPx = apConsumableLightningPlusLabelPx(imgBox);
                                return (
                                    <span
                                        className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-[min(4px,8%)] leading-none"
                                        aria-hidden
                                        style={{ fontSize: `${emojiPx}px` }}
                                    >
                                        <span className="leading-none">⚡</span>
                                        {apValue && (
                                            <span
                                                className="mt-0.5 max-w-full whitespace-nowrap font-bold leading-none text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,0.8)]"
                                                style={{ fontSize: `${plusPx}px` }}
                                            >
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
                    {item.type === 'equipment' && (
                        <div
                            className={`mt-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                                item.isBound
                                    ? 'border-rose-500/40 bg-rose-900/30 text-rose-200'
                                    : 'border-emerald-500/40 bg-emerald-900/25 text-emerald-200'
                            }`}
                        >
                            {item.isBound ? '귀속' : '거래가능'}
                        </div>
                    )}
                </div>
                {/* Right: Name & Main Option */}
                <div className="min-w-0 flex-grow text-right ml-2">
                    <div className="flex items-baseline justify-end gap-0.5">
                        <h3 className={`max-w-full whitespace-nowrap font-bold ${styles.color}`} title={item.name} style={{ fontSize: `${resolveNoWrapTextFontPx(item.name, Math.max(14, Math.round(15 * scaleFactor * mobileTextScale)), 8, 9, 0.62)}px` }}>{item.name}</h3>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-0.5" style={{ fontSize: `${Math.max(12, Math.round(13 * scaleFactor * mobileTextScale))}px` }}>
                        <span className={styles.color}>[{styles.name}]</span>
                        {showRequirement && (
                            <span className={`${levelRequirementMet ? 'text-gray-300' : 'text-red-400'} whitespace-nowrap`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                                {formatEquipLevelRequirement(requiredLevel)}
                            </span>
                        )}
                    </div>
                    {/* 제련 가능 횟수 표시 (장비인 경우에만) */}
                    {item.type === 'equipment' && (
                        <p className={`text-xs font-semibold ${item.grade !== 'normal' && (item as any).refinementCount > 0 ? 'text-amber-400' : 'text-red-400'}`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>
                            제련 가능: {item.grade !== 'normal' && (item as any).refinementCount > 0 ? `${(item as any).refinementCount}회` : '제련불가'}
                        </p>
                    )}
                </div>
            </div>

            {/* Bottom Section: Sub Options — fill 모드면 세로 최대 사용, 아니면 고정 높이+스크롤 */}
            <div
                className={`w-full space-y-1 bg-gray-900/50 p-2 text-left ${BAG_SCROLLBAR_Y_CLASS} ${
                    expandOptionsToFill
                        ? 'min-h-0 flex-1 overflow-y-auto rounded-t-lg rounded-b-none'
                        : 'flex-shrink-0 overflow-y-auto rounded-lg'
                }`}
                style={{
                    fontSize: `${Math.max(12, Math.round(13 * scaleFactor * mobileTextScale))}px`,
                    ...(expandOptionsToFill
                        ? {}
                        : {
                              height: `${optionsBlockHeightPx}px`,
                              minHeight: `${optionsBlockHeightPx}px`,
                              maxHeight: `${optionsBlockHeightPx}px`,
                          }),
                }}
            >
                {item.options?.main && (
                    <EquipmentBagStyleOptionRow opt={item.options.main} itemStars={itemStars} isMain />
                )}
                {optionRows}
            </div>
        </div>
    );
};

const EQUIPMENT_SLOTS: EquipmentSlot[] = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];

function createdAtSortNumber(it: InventoryItem): number {
    const t = it.createdAt as unknown;
    if (typeof t === 'number' && Number.isFinite(t)) return t;
    if (t && typeof (t as Date).getTime === 'function') return (t as Date).getTime();
    return 0;
}

function compareInventoryItemsForSort(a: InventoryItem, b: InventoryItem, primary: SortKey): number {
    const byCreated = () => createdAtSortNumber(b) - createdAtSortNumber(a);
    const byGradeStars = () => {
        const ga = gradeOrder[a.grade];
        const gb = gradeOrder[b.grade];
        if (ga !== gb) return gb - ga;
        return b.stars - a.stars;
    };
    const byType = () => inventoryTypeRank[a.type] - inventoryTypeRank[b.type];
    const bySlotOrName = () => {
        const ia = a.slot ? EQUIPMENT_SLOTS.indexOf(a.slot) : 999;
        const ib = b.slot ? EQUIPMENT_SLOTS.indexOf(b.slot) : 999;
        if (ia !== ib) return ia - ib;
        return a.name.localeCompare(b.name, 'ko');
    };
    /** 등급·종류 정렬일 때는 `createdAt` 역전을 쓰지 않음 — 우편·상점 수령 직후 항목만 항상 맨 위로 붙는 현상 방지 */
    const byNameThenId = () => {
        const n = (a.name || '').localeCompare(b.name || '', 'ko');
        if (n !== 0) return n;
        return String(a.id ?? '').localeCompare(String(b.id ?? ''), 'ko');
    };

    if (primary === 'createdAt') {
        const t = byCreated();
        if (t !== 0) return t;
        const g = byGradeStars();
        if (g !== 0) return g;
        const ty = byType();
        if (ty !== 0) return ty;
        return bySlotOrName();
    }
    if (primary === 'grade') {
        const g = byGradeStars();
        if (g !== 0) return g;
        const ty = byType();
        if (ty !== 0) return ty;
        const slot = bySlotOrName();
        if (slot !== 0) return slot;
        return byNameThenId();
    }
    const ty = byType();
    if (ty !== 0) return ty;
    const g = byGradeStars();
    if (g !== 0) return g;
    const slot = bySlotOrName();
    if (slot !== 0) return slot;
    return byNameThenId();
}

/** 가방 뷰어 하단: 버튼 한 줄(좁으면 가로 스크롤) */
const BAG_INVENTORY_FOOTER_ROW_CLASS =
    'mx-auto flex w-full max-w-full flex-nowrap items-stretch justify-center gap-2 overflow-x-auto overscroll-x-contain px-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.3)_transparent] [&::-webkit-scrollbar]:h-[3px] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/38';

const BAG_INVENTORY_FOOTER_BTN_BASE =
    'inline-flex min-h-[2.35rem] min-w-[3.35rem] flex-1 shrink basis-0 items-center justify-center rounded-xl border px-1.5 text-xs font-semibold tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_6px_18px_-8px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-white/10 transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px hover:shadow-[0_12px_28px_-10px_rgba(0,0,0,0.48)] active:translate-y-0 disabled:pointer-events-none disabled:opacity-45 sm:min-w-[4.1rem] sm:px-2 sm:text-sm';

const BAG_INVENTORY_FOOTER_BTN = {
    /** 사용 — 시안 면 */
    info: `${BAG_INVENTORY_FOOTER_BTN_BASE} ring-0 border-cyan-800/50 bg-gradient-to-b from-cyan-500 via-cyan-700 to-cyan-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_4px_16px_-2px_rgba(6,182,212,0.55)] hover:border-cyan-400/55 hover:from-cyan-400 hover:via-cyan-600 hover:to-cyan-900 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_22px_-2px_rgba(34,211,238,0.55)]`,
    /** 일괄 사용 — 바이올렛 면 */
    accent: `${BAG_INVENTORY_FOOTER_BTN_BASE} ring-0 border-violet-900/50 bg-gradient-to-b from-violet-500 via-violet-700 to-violet-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_16px_-2px_rgba(139,92,246,0.5)] hover:border-violet-400/50 hover:from-violet-400 hover:via-violet-600 hover:to-violet-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_22px_-2px_rgba(167,139,250,0.55)]`,
    /** 판매·해제 — 로즈 면 */
    danger: `${BAG_INVENTORY_FOOTER_BTN_BASE} ring-0 border-rose-900/50 bg-gradient-to-b from-rose-500 via-rose-700 to-rose-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_16px_-2px_rgba(244,63,94,0.45)] hover:border-rose-400/50 hover:from-rose-400 hover:via-rose-600 hover:to-rose-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_22px_-2px_rgba(251,113,133,0.5)]`,
    /** 강화·일괄 판매 — 앰버 면 */
    warning: `${BAG_INVENTORY_FOOTER_BTN_BASE} ring-0 border-amber-900/45 bg-gradient-to-b from-amber-400 via-amber-600 to-amber-900 text-amber-950 shadow-[inset_0_1px_0_rgba(255,251,235,0.45),0_4px_16px_-2px_rgba(217,119,6,0.45)] hover:border-amber-300/50 hover:from-amber-300 hover:via-amber-500 hover:to-amber-800 hover:text-amber-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_6px_22px_-2px_rgba(251,191,36,0.5)]`,
    /** 장착 — 에메랄드 면 */
    success: `${BAG_INVENTORY_FOOTER_BTN_BASE} ring-0 border-emerald-900/50 bg-gradient-to-b from-emerald-500 via-emerald-700 to-emerald-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_16px_-2px_rgba(16,185,129,0.5)] hover:border-emerald-400/50 hover:from-emerald-400 hover:via-emerald-600 hover:to-emerald-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_22px_-2px_rgba(52,211,153,0.55)]`,
} as const;

/** 소모품·재료 가방 푸터: 장비 버튼보다는 좁게(`flex-1` 없음), 다만 최소 높이·패딩은 장비와 동일 계열 */
const BAG_INVENTORY_FOOTER_ITEM_ROW_CLASS =
    'mx-auto flex w-full max-w-full flex-nowrap items-stretch justify-center gap-2.5 overflow-x-auto overscroll-x-contain px-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.3)_transparent] [&::-webkit-scrollbar]:h-[3px] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/38';

const BAG_INVENTORY_FOOTER_ITEM_BTN_BASE =
    'inline-flex min-h-[2.6rem] w-auto min-w-[4.25rem] shrink-0 items-center justify-center rounded-xl border px-3.5 text-[13px] font-semibold tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_6px_18px_-8px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-white/10 transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px hover:shadow-[0_12px_28px_-10px_rgba(0,0,0,0.48)] active:translate-y-0 disabled:pointer-events-none disabled:opacity-45 sm:min-w-[4.8rem] sm:px-4 sm:text-[15px]';

const BAG_INVENTORY_FOOTER_ITEM_BTN = {
    info: `${BAG_INVENTORY_FOOTER_ITEM_BTN_BASE} ring-0 border-cyan-800/50 bg-gradient-to-b from-cyan-500 via-cyan-700 to-cyan-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_4px_16px_-2px_rgba(6,182,212,0.55)] hover:border-cyan-400/55 hover:from-cyan-400 hover:via-cyan-600 hover:to-cyan-900 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_22px_-2px_rgba(34,211,238,0.55)]`,
    accent: `${BAG_INVENTORY_FOOTER_ITEM_BTN_BASE} ring-0 border-violet-900/50 bg-gradient-to-b from-violet-500 via-violet-700 to-violet-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_16px_-2px_rgba(139,92,246,0.5)] hover:border-violet-400/50 hover:from-violet-400 hover:via-violet-600 hover:to-violet-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_22px_-2px_rgba(167,139,250,0.55)]`,
    danger: `${BAG_INVENTORY_FOOTER_ITEM_BTN_BASE} ring-0 border-rose-900/50 bg-gradient-to-b from-rose-500 via-rose-700 to-rose-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_16px_-2px_rgba(244,63,94,0.45)] hover:border-rose-400/50 hover:from-rose-400 hover:via-rose-600 hover:to-rose-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_22px_-2px_rgba(251,113,133,0.5)]`,
    warning: `${BAG_INVENTORY_FOOTER_ITEM_BTN_BASE} ring-0 border-amber-900/45 bg-gradient-to-b from-amber-400 via-amber-600 to-amber-900 text-amber-950 shadow-[inset_0_1px_0_rgba(255,251,235,0.45),0_4px_16px_-2px_rgba(217,119,6,0.45)] hover:border-amber-300/50 hover:from-amber-300 hover:via-amber-500 hover:to-amber-800 hover:text-amber-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_6px_22px_-2px_rgba(251,191,36,0.5)]`,
    success: `${BAG_INVENTORY_FOOTER_ITEM_BTN_BASE} ring-0 border-emerald-900/50 bg-gradient-to-b from-emerald-500 via-emerald-700 to-emerald-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_16px_-2px_rgba(16,185,129,0.5)] hover:border-emerald-400/50 hover:from-emerald-400 hover:via-emerald-600 hover:to-emerald-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_22px_-2px_rgba(52,211,153,0.55)]`,
} as const;

const InventoryModal: React.FC<InventoryModalProps> = ({
    currentUser: propCurrentUser,
    onClose,
    onAction,
    onStartEnhance,
    onOpenBlacksmithTab,
    enhancementAnimationTarget,
    onAnimationComplete,
    isTopmost,
    embedded = false,
}) => {
    const { presets, handlers, currentUserWithStatus, updateTrigger, modalLayerUsesDesignPixels } = useAppContext();
    
    // useAppContext의 currentUserWithStatus를 우선 사용 (최신 상태 보장)
    const currentUser = currentUserWithStatus || propCurrentUser;

    const { inventorySlots = { equipment: 30, consumable: 10, material: 10 } } = currentUser;
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    /** PC 가방: 소모품·재료 좌측 패널에 표시할 직전에 우측에 있던 아이템 id */
    const [bagPcCmLeftPanelItemId, setBagPcCmLeftPanelItemId] = useState<string | null>(null);
    const bagPcCmPrevSelectionRef = useRef<InventoryItem | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('all');
    const [sortKey, setSortKey] = useState<SortKey>('createdAt');
    const [selectedPreset, setSelectedPreset] = useState(0);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [isPresetSavedModalOpen, setIsPresetSavedModalOpen] = useState(false);
    const [showUseQuantityModal, setShowUseQuantityModal] = useState(false);
    const [itemToUseBulk, setItemToUseBulk] = useState<InventoryItem | null>(null);
    const [itemToSell, setItemToSell] = useState<InventoryItem | null>(null);
    const [itemToSellBulk, setItemToSellBulk] = useState<InventoryItem | null>(null);
    const [isExpandModalOpen, setIsExpandModalOpen] = useState(false);
    const [isEquipCompareOpen, setIsEquipCompareOpen] = useState(false);
    const [equipCompareViewerTab, setEquipCompareViewerTab] = useState<'info' | 'mainSub' | 'special' | 'mythic'>('info');
    const [isMobileItemDetailOpen, setIsMobileItemDetailOpen] = useState(false);
    const [isMobileEquippedModalOpen, setIsMobileEquippedModalOpen] = useState(false);
    const [pendingBindEquipItemId, setPendingBindEquipItemId] = useState<string | null>(null);
    const [pendingUnbindItemId, setPendingUnbindItemId] = useState<string | null>(null);

    /** 논리 뷰포트(폰 가로+portrait-lock 시 세로와 동일). innerWidth만 쓰면 가로 667 등으로 PC 가방 UI가 열린다 */
    const [windowWidth, setWindowWidth] = useState(() =>
        typeof window !== 'undefined' ? getLayoutViewportSize().width : 1024,
    );
    const [windowHeight, setWindowHeight] = useState(() =>
        typeof window !== 'undefined' ? window.innerHeight : 768,
    );

    useEffect(() => {
        const sync = () => {
            const { width, height } = getLayoutViewportSize();
            setWindowWidth(width);
            setWindowHeight(Math.max(height, window.innerHeight || 0));
        };
        sync();
        window.addEventListener('resize', sync);
        window.addEventListener('orientationchange', sync);
        window.addEventListener('sudamr-portrait-lock-change', sync);
        return () => {
            window.removeEventListener('resize', sync);
            window.removeEventListener('orientationchange', sync);
            window.removeEventListener('sudamr-portrait-lock-change', sync);
        };
    }, []);
    
    // 가방 모달은 공통 비율 계산으로 설계 비율(PC 기준)을 유지한다.
    const bagFrame = useMemo(
        () =>
            resolveAspectFittedModalFrame({
                viewportWidth: windowWidth,
                viewportHeight: windowHeight,
                designWidth: 1140,
                designHeight: 920,
                widthRatio: 0.9,
                heightRatio: 0.9,
                minWidth: 940,
                maxWidth: 1220,
                minHeight: 760,
                maxHeight: 1040,
            }),
        [windowWidth, windowHeight],
    );
    const calculatedWidth = bagFrame.width;
    const calculatedHeight = bagFrame.height;
    
    // 작은 PC(예: 1366x768 분할/줌)에서도 모바일형 레이아웃으로 너무 일찍 전환되지 않도록 임계값을 낮춘다.
    const isCompactViewport = useMemo(() => windowWidth < 860, [windowWidth]);

    // PC 16:9 설계 캔버스 안이면 내부 scaleFactor를 뷰포트 compact와 중복 적용하지 않음
    const effectiveIsCompactViewport = modalLayerUsesDesignPixels ? false : isCompactViewport;
    /** 16:9 설계 캔버스 안에서는 모바일 재배치로 갈아타지 않고 비율 축소(scale)를 유지 */
    const narrowInventoryLayout = effectiveIsCompactViewport;
    // 가방/하위 모달은 캔버스 프레임 상한의 영향을 받지 않도록 브라우저 뷰포트 레이어에 고정 렌더링한다.
    const useViewportSizedBagModal = !modalLayerUsesDesignPixels;
    const hasInventoryChildModal =
        showUseQuantityModal ||
        !!itemToSell ||
        !!itemToSellBulk ||
        isExpandModalOpen ||
        isRenameModalOpen ||
        isPresetSavedModalOpen ||
        !!pendingBindEquipItemId ||
        !!pendingUnbindItemId ||
        isEquipCompareOpen ||
        (narrowInventoryLayout && isMobileEquippedModalOpen) ||
        (narrowInventoryLayout && isMobileItemDetailOpen);

    /** 모바일 가방: 가로 한 줄 6칸. PC는 기존처럼 한 줄 12칸 */
    const mobileInventoryColumns = useMemo(() => {
        if (!narrowInventoryLayout) return 12;
        return 6;
    }, [narrowInventoryLayout]);
    const inventoryGridColumns = narrowInventoryLayout ? mobileInventoryColumns : 12;
    // 창 크기에 비례한 스케일 팩터 계산 (기준: 950px 너비)
    // 캔버스 밖 모바일: DraggableWindow가 뷰포트 맞춤이므로 여기서는 PC와 동일 비율(축소 없음)
    const baseWidth = 950;
    const scaleFactor = useMemo(() => {
        if (effectiveIsCompactViewport && !modalLayerUsesDesignPixels) {
            const rawScale = calculatedWidth / baseWidth;
            return Math.max(0.4, Math.min(1.0, rawScale));
        }
        // 스케일 캔버스 안 + 실제 좁은 뷰포트: 전체 캔버스 스케일과 별도로 슬롯·패딩만 약간 축소
        if (modalLayerUsesDesignPixels && narrowInventoryLayout) {
            const raw = windowWidth / baseWidth;
            return Math.max(0.42, Math.min(0.72, raw));
        }
        // 데스크톱 가방 뷰어는 모달 프레임 비율에 맞춰 본문(텍스트/이미지)도 함께 줄어들게 한다.
        const desktopFrameScale = bagFrame.scale * 1.04;
        return Math.max(0.74, Math.min(1.0, desktopFrameScale));
    }, [calculatedWidth, effectiveIsCompactViewport, modalLayerUsesDesignPixels, narrowInventoryLayout, windowWidth, bagFrame.scale]);

    const mobileTextScale = useMemo(() => {
        if (narrowInventoryLayout && modalLayerUsesDesignPixels) return 1.2;
        return 1.0;
    }, [narrowInventoryLayout, modalLayerUsesDesignPixels]);
    /** 350px 설계 폭 대비 기준(950) 비율 — 장착 장비 모달 전용 */
    const mobileEquippedLayoutScale = useMemo(() => MOBILE_EQUIPPED_MODAL_DESIGN_WIDTH / baseWidth, []);
    // 상세 패널 텍스트는 모달 축소 비율을 따르되, PC 가독성을 위해 과도한 축소만 방지한다.
    const detailTextScale = narrowInventoryLayout
        ? mobileTextScale
        : mobileTextScale * Math.max(0.96, Math.min(1.1, 0.92 + bagFrame.scale * 0.16)) * 1.24;
    /** PC 상단 밴드: 좌열(장착·스탯·프리셋) 전체가 보이도록 최소 높이 — 인벤은 flex 비율로 양보 */
    const desktopEquippedPanelHeightPx = useMemo(() => {
        if (narrowInventoryLayout) return null;
        const outerPad = Math.max(12, Math.round(16 * scaleFactor)) * 2;
        const heading = Math.max(28, Math.round(22 * scaleFactor * mobileTextScale + 10));
        const slotGap = Math.max(6, Math.round(8 * scaleFactor));
        const slotRow = Math.round(84 * scaleFactor + 32);
        const slotGrid = slotRow * 2 + slotGap;
        const statsSectionTop = Math.max(16, Math.round(16 * scaleFactor));
        const statRow = Math.max(30, Math.round(34 * scaleFactor * mobileTextScale));
        const statsGrid = statRow * 3 + Math.max(4, Math.round(4 * scaleFactor)) * 2;
        const statsPresetGap = Math.max(8, Math.round(8 * scaleFactor));
        const presetRow = Math.max(42, Math.round(46 * scaleFactor * mobileTextScale));
        const belowPresetSlack = Math.max(16, Math.round(20 * scaleFactor));
        const composed =
            outerPad +
            heading +
            slotGrid +
            statsSectionTop +
            statsGrid +
            statsPresetGap +
            presetRow +
            belowPresetSlack;
        return Math.max(composed, Math.round(340 * scaleFactor + 112));
    }, [narrowInventoryLayout, scaleFactor, mobileTextScale]);
    const compareModalTextScale = narrowInventoryLayout ? mobileTextScale : mobileTextScale * 1.35;
    const inventoryGridGapPx = useMemo(
        () => Math.max(narrowInventoryLayout ? 2 : 3, Math.round((narrowInventoryLayout ? 3 : 7) * scaleFactor)),
        [narrowInventoryLayout, scaleFactor],
    );
    const inventoryGridViewportRef = useRef<HTMLDivElement | null>(null);
    const [inventoryGridViewportWidth, setInventoryGridViewportWidth] = useState(0);
    useEffect(() => {
        const el = inventoryGridViewportRef.current;
        if (!el) return;
        const sync = () => {
            setInventoryGridViewportWidth(el.clientWidth);
        };
        sync();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', sync);
            return () => window.removeEventListener('resize', sync);
        }
        const ro = new ResizeObserver(sync);
        ro.observe(el);
        return () => ro.disconnect();
    }, [inventoryGridColumns, scaleFactor, activeTab]);
    const inventoryCellSizePx = useMemo(() => {
        const fallbackWidth = Math.max(
            260,
            calculatedWidth - Math.max(24, Math.round(48 * scaleFactor)) - Math.max(6, Math.round(8 * scaleFactor)),
        );
        const viewportWidth = inventoryGridViewportWidth > 0 ? inventoryGridViewportWidth : fallbackWidth;
        const inner = viewportWidth - inventoryGridGapPx * Math.max(0, inventoryGridColumns - 1);
        return Math.max(14, inner / Math.max(1, inventoryGridColumns));
    }, [inventoryGridViewportWidth, calculatedWidth, scaleFactor, inventoryGridGapPx, inventoryGridColumns]);
    const inventoryGridMinHeightPx = useMemo(() => {
        const minVisibleRows = narrowInventoryLayout ? 2 : 3;
        const bottomPadding = Math.max(12, Math.round(20 * scaleFactor));
        return Math.max(
            76,
            Math.round(
                inventoryCellSizePx * minVisibleRows +
                    inventoryGridGapPx * Math.max(0, minVisibleRows - 1) +
                    bottomPadding,
            ),
        );
    }, [inventoryCellSizePx, inventoryGridGapPx, scaleFactor, narrowInventoryLayout]);
    const inventoryBottomSectionMinHeightPx = useMemo(() => {
        const sectionPadding = Math.max(16, Math.round(22 * scaleFactor));
        const headerBlock = narrowInventoryLayout
            ? Math.max(84, Math.round(100 * scaleFactor))
            : Math.max(42, Math.round(50 * scaleFactor));
        return Math.round(inventoryGridMinHeightPx + sectionPadding + headerBlock);
    }, [inventoryGridMinHeightPx, narrowInventoryLayout, scaleFactor]);
    const desktopTopSectionMinHeightPx = desktopEquippedPanelHeightPx;
    const luxuryTabButtonBase = 'rounded-lg border font-semibold tracking-wide transition-all duration-200 shadow-[0_12px_24px_-16px_rgba(15,23,42,0.85)] hover:-translate-y-0.5 active:translate-y-0';
    const getLuxuryTabButtonClass = (isActive: boolean) =>
        isActive
            ? `${luxuryTabButtonBase} !border-amber-300/80 !bg-gradient-to-br !from-amber-400/80 !via-yellow-300/75 !to-orange-500/80 !text-slate-900 shadow-[0_16px_28px_-14px_rgba(251,191,36,0.75)]`
            : `${luxuryTabButtonBase} !border-slate-500/70 !bg-gradient-to-br !from-slate-700/75 !via-slate-800/70 !to-slate-900/80 !text-slate-100 hover:!border-cyan-300/60 hover:!from-slate-600/80 hover:!via-slate-700/75 hover:!to-slate-800/85`;
    const viewerActionButtonBase = 'rounded-md border font-semibold tracking-wide transition-all duration-150 shadow-[0_10px_20px_-16px_rgba(2,6,23,0.95)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:translate-y-0';
    const viewerActionButtonClass = {
        info: `${viewerActionButtonBase} !border-cyan-400/55 !bg-gradient-to-b !from-slate-700/95 !to-slate-800/95 !text-cyan-100 hover:!border-cyan-300/80 hover:!from-slate-600/95 hover:!to-slate-700/95`,
        success: `${viewerActionButtonBase} !border-emerald-400/55 !bg-gradient-to-b !from-slate-700/95 !to-slate-800/95 !text-emerald-100 hover:!border-emerald-300/80`,
        warning: `${viewerActionButtonBase} !border-amber-400/55 !bg-gradient-to-b !from-slate-700/95 !to-slate-800/95 !text-amber-100 hover:!border-amber-300/80`,
        danger: `${viewerActionButtonBase} !border-rose-400/55 !bg-gradient-to-b !from-slate-700/95 !to-slate-800/95 !text-rose-100 hover:!border-rose-300/80`,
        accent: `${viewerActionButtonBase} !border-violet-400/55 !bg-gradient-to-b !from-slate-700/95 !to-slate-800/95 !text-violet-100 hover:!border-violet-300/80`,
    } as const;

    const handlePresetChange = (presetIndex: number) => {
        setSelectedPreset(presetIndex);
        const preset = presets[presetIndex];
        // 프리셋이 있으면 적용하고, 없으면(빈 프리셋) 빈 장비 세트를 적용
        handlers.applyPreset(preset || { name: presets[presetIndex]?.name || `프리셋 ${presetIndex + 1}`, equipment: {} });
    };

    const itemTemplateByName = useMemo(() => {
        const map = new Map<string, { grade: ItemGrade; description: string; image: string }>();
        for (const item of CONSUMABLE_ITEMS) {
            map.set(item.name, { grade: item.grade, description: item.description, image: item.image });
        }
        for (const [name, item] of Object.entries(MATERIAL_ITEMS)) {
            map.set(name, { grade: item.grade, description: item.description, image: item.image });
        }
        return map;
    }, []);
    const inventoryWithLatestItemMeta = useMemo(
        () =>
            currentUser.inventory.map((item) => {
                // 페어 펫 인스턴스는 인벤 행·DB rarity 기준 등급을 유지한다.
                // 이름만으로 재료 마스터를 매칭하면 다른 재료와 동명 시 잘못된 등급(예: 희귀)으로 덮인다.
                if (isPairPetMaterial(item)) return item;
                const template = itemTemplateByName.get(item.name);
                if (!template) return item;
                // 기존 보유 아이템도 최신 마스터 정의(등급/설명/아이콘)를 우선 반영한다.
                return {
                    ...item,
                    grade: template.grade,
                    description: template.description,
                    image: template.image,
                };
            }),
        [currentUser.inventory, itemTemplateByName],
    );

    const selectedItem = useMemo(() => {
        if (!selectedItemId) return null;
        // 현재 인벤토리에서 아이템이 사라졌을 경우 선택 해제
        const found = inventoryWithLatestItemMeta.find(item => item.id === selectedItemId);
        if (!found && selectedItemId) {
            // 아이템이 사라진 경우 선택 해제 (다음 렌더링에서 처리)
            setTimeout(() => setSelectedItemId(null), 0);
        }
        return found || null;
    }, [selectedItemId, inventoryWithLatestItemMeta, updateTrigger]);

    const bagPcCmLeftPanelItem = useMemo(() => {
        if (!bagPcCmLeftPanelItemId) return null;
        const found = inventoryWithLatestItemMeta.find((i) => i.id === bagPcCmLeftPanelItemId);
        if (!found || (found.type !== 'consumable' && found.type !== 'material')) return null;
        return found;
    }, [bagPcCmLeftPanelItemId, inventoryWithLatestItemMeta]);

    /** PC: 소모품·재료 선택 시 직전 우측 항목 → 좌측, 신규 → 우측 */
    useEffect(() => {
        if (!selectedItemId) {
            setBagPcCmLeftPanelItemId(null);
            bagPcCmPrevSelectionRef.current = null;
            return;
        }
        const sel = inventoryWithLatestItemMeta.find((i) => i.id === selectedItemId) ?? null;
        if (!sel) {
            setBagPcCmLeftPanelItemId(null);
            bagPcCmPrevSelectionRef.current = null;
            return;
        }
        if (sel.type === 'equipment') {
            setBagPcCmLeftPanelItemId(null);
            bagPcCmPrevSelectionRef.current = null;
            return;
        }
        if (sel.type !== 'consumable' && sel.type !== 'material') {
            setBagPcCmLeftPanelItemId(null);
            bagPcCmPrevSelectionRef.current = null;
            return;
        }
        const prev = bagPcCmPrevSelectionRef.current;
        if (prev && prev.id !== sel.id) {
            setBagPcCmLeftPanelItemId(prev.id);
        } else if (!prev) {
            setBagPcCmLeftPanelItemId(null);
        }
        bagPcCmPrevSelectionRef.current = sel;
    }, [selectedItemId, inventoryWithLatestItemMeta]);

    const ownedUnbindTickets = useMemo(
        () =>
            inventoryWithLatestItemMeta
                .filter((item) => item.type === 'material' && item.name === EQUIPMENT_UNBIND_TICKET_NAME)
                .reduce((sum, item) => sum + (item.quantity ?? 0), 0),
        [inventoryWithLatestItemMeta],
    );
    const unbindTicketTemplate = useMemo(
        () => MATERIAL_ITEMS[EQUIPMENT_UNBIND_TICKET_NAME] ?? null,
        [],
    );

    const expansionCost = useMemo(() => {
        if (activeTab === 'all') return 0;
        const currentSlotsForCategory = inventorySlots?.[activeTab] ?? BASE_SLOTS_PER_CATEGORY;
        return calculateExpansionCost(currentSlotsForCategory);
    }, [activeTab, inventorySlots]);

    const { coreStatBonuses } = useMemo(() => calculateUserEffects(currentUser), [currentUser]);

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
        setIsPresetSavedModalOpen(true);
    };

    const handleEquipToggle = (itemId: string) => {
        const item = inventoryWithLatestItemMeta.find(i => i.id === itemId);
        if (!item) return;

        if (!item.isEquipped) {
            const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
            const userLevelSum = currentUser.userLevel;
            if (userLevelSum < requiredLevel) {
                alert(
                    `착용레벨이 부족합니다. (필요: ${formatEquipLevelRequirement(requiredLevel)}, 현재: Lv.${userLevelSum})`,
                );
                return;
            }
            if (!item.isBound) {
                setPendingBindEquipItemId(itemId);
                return;
            }
        }

        onAction({ type: 'TOGGLE_EQUIP_ITEM', payload: { itemId } });
    };
    const handleConfirmBindEquip = () => {
        if (!pendingBindEquipItemId) return;
        onAction({ type: 'TOGGLE_EQUIP_ITEM', payload: { itemId: pendingBindEquipItemId } });
        setPendingBindEquipItemId(null);
    };
    const handleCancelBindEquip = () => {
        setPendingBindEquipItemId(null);
    };
    const handleUnbindEquipment = (itemId: string) => {
        setPendingUnbindItemId(itemId);
    };
    const handleConfirmUnbindEquipment = () => {
        if (!pendingUnbindItemId) return;
        onAction({ type: 'UNBIND_EQUIPMENT', payload: { itemId: pendingUnbindItemId } });
        setPendingUnbindItemId(null);
    };
    const handleCancelUnbindEquipment = () => {
        setPendingUnbindItemId(null);
    };
    const pendingUnbindItem = useMemo(() => {
        if (!pendingUnbindItemId) return null;
        return inventoryWithLatestItemMeta.find((item) => item.id === pendingUnbindItemId && item.type === 'equipment') ?? null;
    }, [pendingUnbindItemId, inventoryWithLatestItemMeta]);
    const pendingUnbindRequiredTickets = useMemo(() => {
        if (!pendingUnbindItem) return 0;
        return EQUIPMENT_UNBIND_TICKET_COST_BY_GRADE[pendingUnbindItem.grade] ?? 1;
    }, [pendingUnbindItem]);
    const pendingUnbindHasEnoughTickets = pendingUnbindRequiredTickets > 0 && ownedUnbindTickets >= pendingUnbindRequiredTickets;
    const activeExchangeListedItemIds = useMemo(
        () => collectActiveExchangeListedItemIds(currentUser),
        [currentUser.exchangeState?.listings],
    );
    const filteredAndSortedInventory = useMemo(() => {
        let items = [...inventoryWithLatestItemMeta];
        // 도전의 탑 전용 소모품은 가방에서 숨김(탑 대기실에서만 표시)
        items = items.filter((item: InventoryItem) => !(item.type === 'consumable' && isTowerOnlyConsumable(item.name)));
        // 거래소 등록 중인 장비는 가방에서 숨김 (플래그 누락·합성 직후 등록 레이스 시 exchangeState 목록으로도 차단)
        items = items.filter((item: InventoryItem) => !isEquipmentHiddenFromBag(item, activeExchangeListedItemIds));
        // 페어 알·AI 펫·영혼석은 페어 경기장 로비 인벤에서만 표시(재료 타입으로 분류하지 않음)
        items = items.filter((item: InventoryItem) => !isPairArenaExclusiveBagItem(item));
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
        items.sort((a, b) => compareInventoryItemsForSort(a, b, sortKey));
        return items;
    }, [inventoryWithLatestItemMeta, activeTab, sortKey, updateTrigger, activeExchangeListedItemIds]);

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
        return inventoryWithLatestItemMeta.find(item => item.id === itemId);
    }, [currentUser.equipment, inventoryWithLatestItemMeta, updateTrigger]);

    const correspondingEquippedItem = useMemo(() => {
        if (!selectedItem || !selectedItem.slot) return null;
        return getItemForSlot(selectedItem.slot);
    }, [selectedItem, getItemForSlot]);

    useEffect(() => {
        setIsEquipCompareOpen(false);
    }, [selectedItemId]);

    /**
     * 모바일 상세창이 열린 상태에서 아이템 사용/판매로 selectedItem이 사라지면
     * 조건부 렌더만 사라지고 open 상태 플래그가 남아, 가방 루트가 비활성(topmost=false)로 고정될 수 있다.
     * 아이템 참조가 끊긴 순간 관련 모바일 하위 모달 상태를 즉시 정리한다.
     */
    useEffect(() => {
        if (selectedItem) return;
        setIsMobileItemDetailOpen(false);
        setIsEquipCompareOpen(false);
    }, [selectedItem]);

    const canEquip = useMemo(() => {
        if (!selectedItem || selectedItem.type !== 'equipment') return false;
        const requiredLevel = GRADE_LEVEL_REQUIREMENTS[selectedItem.grade];
        const userLevelSum = currentUser.userLevel;
        return userLevelSum >= requiredLevel;
    }, [selectedItem, currentUser.userLevel]);

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

    const inventoryBody = (
        <>
            <div 
                className="relative flex min-h-0 h-full w-full flex-col overflow-hidden"
                style={{ margin: 0, padding: 0 }}
            >
                {narrowInventoryLayout ? (
                    <div className="mb-2 shrink-0 rounded-md bg-gray-800 px-2 py-2 shadow-inner">
                        <Button
                            type="button"
                            onClick={() => setIsMobileEquippedModalOpen(true)}
                            colorScheme="blue"
                            className={`w-full !py-2 !px-3 ${viewerActionButtonClass.info}`}
                            style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * mobileTextScale))}px` }}
                        >
                            장착장비
                        </Button>
                    </div>
                ) : (
                    <div
                        className="mb-2 flex min-h-0 flex-[0.98] flex-row overflow-hidden rounded-md bg-gray-800 shadow-inner"
                        style={{
                            padding: `${Math.max(12, Math.round(16 * scaleFactor))}px`,
                            ...(desktopTopSectionMinHeightPx != null
                                ? { minHeight: desktopTopSectionMinHeightPx }
                                : {}),
                        }}
                    >
                        <>
                            {/* 데스크톱: 좌 1/3 장착+스탯, 우측 상세 */}
                            <div
                                className={`flex h-full min-h-0 w-1/3 flex-shrink-0 flex-col overflow-hidden border-r border-gray-700 ${BAG_SCROLLBAR_Y_CLASS}`}
                                style={{ paddingRight: `${Math.max(12, Math.round(16 * scaleFactor))}px` }}
                            >
                                <div className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${BAG_SCROLLBAR_Y_CLASS}`}>
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
                                                const flatBonus = Number(bonusInfo.flat) || 0;
                                                const percentBonus = Number(bonusInfo.percent) || 0;
                                                const finalValue = computeCoreStatFinalFromBonuses(baseValue, flatBonus, percentBonus);
                                                const bonus = finalValue - baseValue;
                                                return (
                                                    <div key={stat} className="flex items-center justify-between rounded-md bg-tertiary/40 p-1" style={{ fontSize: `${Math.max(14, Math.round(15.5 * scaleFactor * mobileTextScale))}px` }}>
                                                        <span className="whitespace-nowrap font-semibold text-secondary">{stat}</span>
                                                        <span className="whitespace-nowrap font-mono font-bold" title={`기본: ${baseValue}, 장비: ${bonus}`}>
                                                            {isNaN(finalValue) ? 0 : finalValue}
                                                            {bonus > 0 && <span className="ml-0.5 text-green-400" style={{ fontSize: `${Math.max(12, Math.round(13.5 * scaleFactor * mobileTextScale))}px` }}>(+{bonus})</span>}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2 flex shrink-0 items-center gap-2 border-t border-gray-700/60 pt-2">
                                    <select
                                        value={selectedPreset}
                                        onChange={(e) => handlePresetChange(Number(e.target.value))}
                                        className="min-w-0 flex-grow rounded-md border border-color bg-secondary p-1.5 focus:border-accent focus:ring-accent"
                                        style={{ fontSize: `${Math.max(13, Math.round(14 * scaleFactor * mobileTextScale))}px` }}
                                    >
                                        {presets.map((preset, index) => (
                                            <option key={index} value={index}>
                                                {preset.name}
                                            </option>
                                        ))}
                                    </select>
                                    <Button onClick={handleOpenRenameModal} colorScheme="blue" className={`!shrink-0 !py-1 ${viewerActionButtonClass.info}`} style={{ fontSize: `${Math.max(13, Math.round(14 * scaleFactor * mobileTextScale))}px` }}>
                                        저장
                                    </Button>
                                </div>
                            </div>

                    {/* Conditional middle and right panels (데스크톱) — 장비·소모품·재료: 동일 2열(현재 장착 | 선택) */}
                    {selectedItem &&
                    (selectedItem.type === 'equipment' ||
                        selectedItem.type === 'consumable' ||
                        selectedItem.type === 'material') ? (
                        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-row gap-0 overflow-hidden">
                            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border-r border-gray-700 bg-panel-secondary p-2">
                                {selectedItem.type === 'equipment' ? (
                                    <>
                                        <div className="mb-0.5 flex shrink-0 items-center justify-between gap-2">
                                            <h3
                                                className="min-w-0 font-bold text-on-panel"
                                                style={{ fontSize: `${Math.max(9, Math.round(10 * scaleFactor * detailTextScale))}px` }}
                                            >
                                                현재 장착
                                            </h3>
                                            <div className="shrink-0">
                                                <Button
                                                    type="button"
                                                    colorScheme="blue"
                                                    tabIndex={-1}
                                                    aria-hidden
                                                    disabled
                                                    className={`!pointer-events-none !invisible !shrink-0 !py-1 !px-2 ${viewerActionButtonClass.info}`}
                                                    style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}
                                                >
                                                    장비 비교
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
                                            <LocalItemDetailDisplay
                                                item={correspondingEquippedItem}
                                                title="장착된 장비 없음"
                                                comparisonItem={undefined}
                                                scaleFactor={scaleFactor}
                                                mobileTextScale={detailTextScale}
                                                userLevelSum={currentUser.userLevel}
                                                emptySlot={selectedItem?.slot}
                                                expandOptionsToFill
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {bagPcCmLeftPanelItem && (
                                            <h3
                                                className="mb-0.5 shrink-0 font-bold text-on-panel"
                                                style={{ fontSize: `${Math.max(9, Math.round(10 * scaleFactor * detailTextScale))}px` }}
                                            >
                                                이전 선택
                                            </h3>
                                        )}
                                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
                                            {bagPcCmLeftPanelItem ? (
                                                <div
                                                    className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0.5 pb-1 ${BAG_SCROLLBAR_Y_CLASS}`}
                                                    style={{
                                                        fontSize: `${Math.max(11, Math.round(12 * scaleFactor * detailTextScale))}px`,
                                                    }}
                                                >
                                                    <EquipmentDetailPanel
                                                        item={bagPcCmLeftPanelItem}
                                                        iconSlotPx={Math.max(52, Math.round(80 * scaleFactor * detailTextScale))}
                                                        optionsScrollable
                                                        comfortableTypography
                                                        showTradeStatusUnderImage
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className="min-h-0 flex-1 rounded-md bg-black/10 ring-1 ring-inset ring-white/[0.04]"
                                                    aria-hidden
                                                />
                                            )}
                                        </div>
                                        {bagPcCmLeftPanelItem ? (
                                            <div className="shrink-0 border-t border-amber-500/15 bg-gradient-to-t from-panel-secondary to-transparent pt-2 pb-0.5">
                                                <div className={`${BAG_INVENTORY_FOOTER_ROW_CLASS} px-1`}>
                                                    {bagPcCmLeftPanelItem.type === 'consumable' &&
                                                        (() => {
                                                            const consumableItem = findConsumableItem(bagPcCmLeftPanelItem.name);
                                                            const isUsable = consumableItem?.usable !== false;
                                                            const isRefinementTicket = isRefinementTicketMaterial(bagPcCmLeftPanelItem.name);
                                                            const isSellable = isRefinementTicket || consumableItem?.sellable !== false;
                                                            const hideBagUse = isConditionPotionConsumable(bagPcCmLeftPanelItem.name);
                                                            const fs = Math.max(12, Math.round(13 * scaleFactor * mobileTextScale));

                                                            return (
                                                                <>
                                                                    {isUsable && !hideBagUse && (
                                                                        <>
                                                                            <Button
                                                                                bare
                                                                                colorScheme="none"
                                                                                onClick={() => {
                                                                                    void onAction({
                                                                                        type: 'USE_ITEM',
                                                                                        payload: { itemId: bagPcCmLeftPanelItem.id, itemName: bagPcCmLeftPanelItem.name },
                                                                                    });
                                                                                }}
                                                                                className={BAG_INVENTORY_FOOTER_BTN.info}
                                                                                style={{ fontSize: `${fs}px` }}
                                                                            >
                                                                                사용
                                                                            </Button>
                                                                            {!isRefinementTicket &&
                                                                                bagPcCmLeftPanelItem.quantity &&
                                                                                bagPcCmLeftPanelItem.quantity > 1 && (
                                                                                    <Button
                                                                                        bare
                                                                                        colorScheme="none"
                                                                                        onClick={() => {
                                                                                            setItemToUseBulk(bagPcCmLeftPanelItem);
                                                                                            setShowUseQuantityModal(true);
                                                                                        }}
                                                                                        className={BAG_INVENTORY_FOOTER_BTN.accent}
                                                                                        style={{ fontSize: `${fs}px` }}
                                                                                    >
                                                                                        일괄 사용
                                                                                    </Button>
                                                                                )}
                                                                        </>
                                                                    )}
                                                                    {isSellable && (
                                                                        <>
                                                                            <Button
                                                                                bare
                                                                                colorScheme="none"
                                                                                onClick={() => setItemToSell(bagPcCmLeftPanelItem)}
                                                                                className={BAG_INVENTORY_FOOTER_BTN.danger}
                                                                                style={{ fontSize: `${fs}px` }}
                                                                            >
                                                                                판매
                                                                            </Button>
                                                                            {bagPcCmLeftPanelItem.quantity && bagPcCmLeftPanelItem.quantity > 1 && (
                                                                                <Button
                                                                                    bare
                                                                                    colorScheme="none"
                                                                                    onClick={() => setItemToSellBulk(bagPcCmLeftPanelItem)}
                                                                                    className={BAG_INVENTORY_FOOTER_BTN.warning}
                                                                                    style={{ fontSize: `${fs}px` }}
                                                                                >
                                                                                    일괄 판매
                                                                                </Button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    {bagPcCmLeftPanelItem.type === 'material' &&
                                                        (() => {
                                                            const isRefinementTicket = isRefinementTicketMaterial(bagPcCmLeftPanelItem.name);
                                                            const isEnhancementMaterial =
                                                                !isRefinementTicket &&
                                                                getEnhancementMaterialUsageLinesForBag(bagPcCmLeftPanelItem.name).length > 0;
                                                            const fs = Math.max(12, Math.round(13 * scaleFactor * mobileTextScale));
                                                            return (
                                                                <>
                                                                    <Button
                                                                        bare
                                                                        colorScheme="none"
                                                                        onClick={() => setItemToSell(bagPcCmLeftPanelItem)}
                                                                        className={BAG_INVENTORY_FOOTER_BTN.danger}
                                                                        style={{ fontSize: `${fs}px` }}
                                                                    >
                                                                        판매
                                                                    </Button>
                                                                    <Button
                                                                        bare
                                                                        colorScheme="none"
                                                                        onClick={() => setItemToSellBulk(bagPcCmLeftPanelItem)}
                                                                        className={BAG_INVENTORY_FOOTER_BTN.warning}
                                                                        style={{ fontSize: `${fs}px` }}
                                                                    >
                                                                        일괄 판매
                                                                    </Button>
                                                                    {isEnhancementMaterial && (
                                                                        <Button
                                                                            bare
                                                                            colorScheme="none"
                                                                            onClick={() => onOpenBlacksmithTab('convert')}
                                                                            className={BAG_INVENTORY_FOOTER_BTN.info}
                                                                            style={{ fontSize: `${fs}px` }}
                                                                        >
                                                                            재료변환
                                                                        </Button>
                                                                    )}
                                                                    {isRefinementTicket && (
                                                                        <Button
                                                                            bare
                                                                            colorScheme="none"
                                                                            onClick={() => onOpenBlacksmithTab('refine')}
                                                                            className={BAG_INVENTORY_FOOTER_BTN.info}
                                                                            style={{ fontSize: `${fs}px` }}
                                                                        >
                                                                            사용
                                                                        </Button>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                </div>
                                            </div>
                                        ) : null}
                                    </>
                                )}
                            </div>

                            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-panel-secondary p-3">
                                <div className="mb-0.5 flex shrink-0 items-center justify-between gap-2">
                                    <h3
                                        className="min-w-0 font-bold text-on-panel"
                                        style={{ fontSize: `${Math.max(9, Math.round(10 * scaleFactor * detailTextScale))}px` }}
                                    >
                                        {selectedItem.type === 'equipment'
                                            ? '선택 장비'
                                            : selectedItem.type === 'consumable'
                                              ? '선택 소모품'
                                              : '선택 재료'}
                                    </h3>
                                    {selectedItem.type === 'equipment' ? (
                                        <div className="shrink-0">
                                            {selectedItem.slot && selectedItem.id !== correspondingEquippedItem?.id ? (
                                                <Button
                                                    type="button"
                                                    onClick={() => setIsEquipCompareOpen(true)}
                                                    colorScheme="blue"
                                                    className={`!shrink-0 !py-1 !px-2 ${viewerActionButtonClass.info}`}
                                                    style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}
                                                >
                                                    장비 비교
                                                </Button>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    colorScheme="blue"
                                                    tabIndex={-1}
                                                    aria-hidden
                                                    disabled
                                                    className={`!pointer-events-none !invisible !shrink-0 !py-1 !px-2 ${viewerActionButtonClass.info}`}
                                                    style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}
                                                >
                                                    장비 비교
                                                </Button>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
                                    {selectedItem.type === 'equipment' ? (
                                        <LocalItemDetailDisplay
                                            item={selectedItem}
                                            title="선택된 아이템 없음"
                                            comparisonItem={undefined}
                                            scaleFactor={scaleFactor}
                                            mobileTextScale={detailTextScale}
                                            userLevelSum={currentUser.userLevel}
                                            expandOptionsToFill
                                        />
                                    ) : (
                                        <div
                                            className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0.5 pb-1 ${BAG_SCROLLBAR_Y_CLASS}`}
                                            style={{
                                                fontSize: `${Math.max(11, Math.round(12 * scaleFactor * detailTextScale))}px`,
                                            }}
                                        >
                                            <EquipmentDetailPanel
                                                item={selectedItem}
                                                iconSlotPx={Math.max(52, Math.round(80 * scaleFactor * detailTextScale))}
                                                optionsScrollable
                                                comfortableTypography
                                                showTradeStatusUnderImage
                                            />
                                        </div>
                                    )}
                                </div>
                                {selectedItem.type === 'equipment' ? (
                                    <div className={`${BAG_INVENTORY_FOOTER_ROW_CLASS} pt-1`}>
                                        {selectedItem.id === correspondingEquippedItem?.id ? (
                                            <Button
                                                bare
                                                colorScheme="none"
                                                onClick={() => handleEquipToggle(selectedItem.id)}
                                                className={BAG_INVENTORY_FOOTER_BTN.danger}
                                                style={{ fontSize: `${Math.max(12, Math.round(13 * scaleFactor * mobileTextScale))}px` }}
                                            >
                                                해제
                                            </Button>
                                        ) : (
                                            <Button
                                                bare
                                                colorScheme="none"
                                                onClick={() => handleEquipToggle(selectedItem.id)}
                                                className={BAG_INVENTORY_FOOTER_BTN.success}
                                                disabled={!canEquip}
                                                style={{ fontSize: `${Math.max(12, Math.round(13 * scaleFactor * mobileTextScale))}px` }}
                                            >
                                                장착
                                            </Button>
                                        )}
                                        <Button
                                            bare
                                            colorScheme="none"
                                            onClick={() => onStartEnhance(selectedItem)}
                                            disabled={selectedItem.stars >= 10}
                                            className={BAG_INVENTORY_FOOTER_BTN.warning}
                                            style={{ fontSize: `${Math.max(12, Math.round(13 * scaleFactor * mobileTextScale))}px` }}
                                        >
                                            {selectedItem.stars >= 10 ? '최대' : '강화'}
                                        </Button>
                                        <Button
                                            bare
                                            colorScheme="none"
                                            onClick={() => setItemToSell(selectedItem)}
                                            className={BAG_INVENTORY_FOOTER_BTN.danger}
                                            style={{ fontSize: `${Math.max(12, Math.round(13 * scaleFactor * mobileTextScale))}px` }}
                                        >
                                            판매
                                        </Button>
                                        {selectedItem.isBound && (
                                            <Button
                                                bare
                                                colorScheme="none"
                                                onClick={() => handleUnbindEquipment(selectedItem.id)}
                                                className={BAG_INVENTORY_FOOTER_BTN.info}
                                                style={{ fontSize: `${Math.max(12, Math.round(13 * scaleFactor * mobileTextScale))}px` }}
                                            >
                                                귀속해제
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="shrink-0 border-t border-amber-500/15 bg-gradient-to-t from-panel-secondary to-transparent pt-2 pb-0.5">
                                        <div className={`${BAG_INVENTORY_FOOTER_ROW_CLASS} px-1`}>
                                            {selectedItem.type === 'consumable' && (() => {
                                                const consumableItem = findConsumableItem(selectedItem.name);
                                                const isUsable = consumableItem?.usable !== false; // 기본값은 true
                                                const isRefinementTicket = isRefinementTicketMaterial(selectedItem.name);
                                                const isSellable = isRefinementTicket || consumableItem?.sellable !== false; // 기본값은 true
                                                const hideBagUse = isConditionPotionConsumable(selectedItem.name);
                                                const fs = Math.max(12, Math.round(13 * scaleFactor * mobileTextScale));

                                                return (
                                                    <>
                                                        {isUsable && !hideBagUse && (
                                                            <>
                                                                <Button
                                                                    bare
                                                                    colorScheme="none"
                                                                    onClick={() => {
                                                                        void onAction({ type: 'USE_ITEM', payload: { itemId: selectedItem.id, itemName: selectedItem.name } });
                                                                    }}
                                                                    className={BAG_INVENTORY_FOOTER_BTN.info}
                                                                    style={{ fontSize: `${fs}px` }}
                                                                >
                                                                    사용
                                                                </Button>
                                                                {!isRefinementTicket && selectedItem.quantity && selectedItem.quantity > 1 && (
                                                                    <Button
                                                                        bare
                                                                        colorScheme="none"
                                                                        onClick={() => {
                                                                            setItemToUseBulk(selectedItem);
                                                                            setShowUseQuantityModal(true);
                                                                        }}
                                                                        className={BAG_INVENTORY_FOOTER_BTN.accent}
                                                                        style={{ fontSize: `${fs}px` }}
                                                                    >
                                                                        일괄 사용
                                                                    </Button>
                                                                )}
                                                            </>
                                                        )}
                                                        {isSellable && (
                                                            <>
                                                                <Button
                                                                    bare
                                                                    colorScheme="none"
                                                                    onClick={() => setItemToSell(selectedItem)}
                                                                    className={BAG_INVENTORY_FOOTER_BTN.danger}
                                                                    style={{ fontSize: `${fs}px` }}
                                                                >
                                                                    판매
                                                                </Button>
                                                                {selectedItem.quantity && selectedItem.quantity > 1 && (
                                                                    <Button
                                                                        bare
                                                                        colorScheme="none"
                                                                        onClick={() => setItemToSellBulk(selectedItem)}
                                                                        className={BAG_INVENTORY_FOOTER_BTN.warning}
                                                                        style={{ fontSize: `${fs}px` }}
                                                                    >
                                                                        일괄 판매
                                                                    </Button>
                                                                )}
                                                            </>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                            {selectedItem.type === 'material' &&
                                                (() => {
                                                    const isRefinementTicket = isRefinementTicketMaterial(selectedItem.name);
                                                    const isEnhancementMaterial =
                                                        !isRefinementTicket && getEnhancementMaterialUsageLinesForBag(selectedItem.name).length > 0;
                                                    const fs = Math.max(12, Math.round(13 * scaleFactor * mobileTextScale));
                                                    return (
                                                        <>
                                                            <Button
                                                                bare
                                                                colorScheme="none"
                                                                onClick={() => setItemToSell(selectedItem)}
                                                                className={BAG_INVENTORY_FOOTER_BTN.danger}
                                                                style={{ fontSize: `${fs}px` }}
                                                            >
                                                                판매
                                                            </Button>
                                                            <Button
                                                                bare
                                                                colorScheme="none"
                                                                onClick={() => setItemToSellBulk(selectedItem)}
                                                                className={BAG_INVENTORY_FOOTER_BTN.warning}
                                                                style={{ fontSize: `${fs}px` }}
                                                            >
                                                                일괄 판매
                                                            </Button>
                                                            {isEnhancementMaterial && (
                                                                <Button
                                                                    bare
                                                                    colorScheme="none"
                                                                    onClick={() => onOpenBlacksmithTab('convert')}
                                                                    className={BAG_INVENTORY_FOOTER_BTN.info}
                                                                    style={{ fontSize: `${fs}px` }}
                                                                >
                                                                    재료변환
                                                                </Button>
                                                            )}
                                                            {isRefinementTicket && (
                                                                <Button
                                                                    bare
                                                                    colorScheme="none"
                                                                    onClick={() => onOpenBlacksmithTab('refine')}
                                                                    className={BAG_INVENTORY_FOOTER_BTN.info}
                                                                    style={{ fontSize: `${fs}px` }}
                                                                >
                                                                    사용
                                                                </Button>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="ml-4 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-panel-secondary p-3">
                            {selectedItem ? (
                                <div
                                    className="flex h-full items-center justify-center text-tertiary"
                                    style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * mobileTextScale))}px` }}
                                >
                                    선택된 아이템 없음
                                </div>
                            ) : (
                                <div
                                    className="flex h-full items-center justify-center text-tertiary"
                                    style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * mobileTextScale))}px` }}
                                >
                                    아이템을 선택해주세요
                                </div>
                            )}
                        </div>
                    )}
                        </>
                    </div>
                )}

                {/* Bottom section: 가방 슬롯 — 부모가 flex-1·min-h-0일 때만 세로 스크롤이 생김(bodyAvoidVerticalStretch 제거로 체인 유지) */}
                <div
                    className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-900"
                    style={{
                        minHeight: `${inventoryBottomSectionMinHeightPx}px`,
                        padding: `${Math.max(12, Math.round(16 * scaleFactor))}px`,
                        paddingTop: `${Math.max(12, Math.round(16 * scaleFactor))}px`,
                        paddingBottom: `${Math.max(8, Math.round(10 * scaleFactor))}px`,
                        marginBottom: 0,
                    }}
                >
                    <div className={`flex-shrink-0 bg-gray-900/50 rounded-md mb-2`} style={{ padding: `${Math.max(6, Math.round(8 * scaleFactor))}px`, marginBottom: `${Math.max(6, Math.round(8 * scaleFactor))}px` }}>
                        {narrowInventoryLayout ? (
                            <div className="flex min-w-0 flex-col gap-2">
                                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                    <Button onClick={() => setActiveTab('all')} colorScheme={activeTab === 'all' ? 'blue' : 'gray'} className={`!py-1 !px-2 ${getLuxuryTabButtonClass(activeTab === 'all')}`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>전체</Button>
                                    <Button onClick={() => setActiveTab('equipment')} colorScheme={activeTab === 'equipment' ? 'blue' : 'gray'} className={`!py-1 !px-2 ${getLuxuryTabButtonClass(activeTab === 'equipment')}`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>장비</Button>
                                    <Button onClick={() => setActiveTab('consumable')} colorScheme={activeTab === 'consumable' ? 'blue' : 'gray'} className={`!py-1 !px-2 ${getLuxuryTabButtonClass(activeTab === 'consumable')}`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>소모품</Button>
                                    <Button onClick={() => setActiveTab('material')} colorScheme={activeTab === 'material' ? 'blue' : 'gray'} className={`!py-1 !px-2 ${getLuxuryTabButtonClass(activeTab === 'material')}`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>재료</Button>
                                </div>
                                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-gray-700/50 pt-2">
                                    <span className="shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * mobileTextScale))}px` }}>정렬:</span>
                                    <select
                                        onChange={(e) => setSortKey(e.target.value as SortKey)}
                                        value={sortKey}
                                        className="min-w-0 flex-1 rounded-md bg-gray-700 p-1.5 text-white sm:max-w-[14rem]"
                                        style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * mobileTextScale))}px` }}
                                    >
                                        <option value="createdAt">최신순</option>
                                        <option value="grade">등급순</option>
                                        <option value="type">종류순</option>
                                    </select>
                                    <div className="ml-auto shrink-0 text-gray-400" style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * mobileTextScale))}px` }}>
                                        {`${filteredAndSortedInventory.length} / ${currentSlots}`}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={`flex items-center justify-between`}>
                                <div className={`flex items-center space-x-2`}>
                                    <Button onClick={() => setActiveTab('all')} colorScheme={activeTab === 'all' ? 'blue' : 'gray'} className={`!py-1 !px-2 ${getLuxuryTabButtonClass(activeTab === 'all')}`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>전체</Button>
                                    <Button onClick={() => setActiveTab('equipment')} colorScheme={activeTab === 'equipment' ? 'blue' : 'gray'} className={`!py-1 !px-2 ${getLuxuryTabButtonClass(activeTab === 'equipment')}`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>장비</Button>
                                    <Button onClick={() => setActiveTab('consumable')} colorScheme={activeTab === 'consumable' ? 'blue' : 'gray'} className={`!py-1 !px-2 ${getLuxuryTabButtonClass(activeTab === 'consumable')}`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>소모품</Button>
                                    <Button onClick={() => setActiveTab('material')} colorScheme={activeTab === 'material' ? 'blue' : 'gray'} className={`!py-1 !px-2 ${getLuxuryTabButtonClass(activeTab === 'material')}`} style={{ fontSize: `${Math.max(11, Math.round(12 * scaleFactor * mobileTextScale))}px` }}>재료</Button>
                                </div>
                                <div className={`flex items-center space-x-2`}>
                                    <span style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * mobileTextScale))}px` }}>정렬:</span>
                                    <select onChange={(e) => setSortKey(e.target.value as SortKey)} value={sortKey} className={`rounded-md bg-gray-700 p-1.5 text-white`} style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * mobileTextScale))}px` }}>
                                        <option value="createdAt">최신순</option>
                                        <option value="grade">등급순</option>
                                        <option value="type">종류순</option>
                                    </select>
                                    <div className="text-gray-400" style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * mobileTextScale))}px` }}>
                                        {`${filteredAndSortedInventory.length} / ${currentSlots}`}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div
                        ref={inventoryGridViewportRef}
                        className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain ${BAG_SCROLLBAR_Y_CLASS}`}
                        style={{
                            width: '100%',
                            minWidth: 0,
                            minHeight: `${inventoryGridMinHeightPx}px`,
                            paddingRight: `${Math.max(6, Math.round(8 * scaleFactor))}px`,
                            WebkitOverflowScrolling: 'touch',
                        }}
                    >
                        <div 
                            className="grid gap-2" 
                            style={{ 
                                gridTemplateColumns: `repeat(${inventoryGridColumns}, minmax(0, 1fr))`,
                                gap: `${inventoryGridGapPx}px`,
                                width: '100%',
                                minWidth: 0,
                                paddingBottom: `${Math.max(12, Math.round(20 * scaleFactor))}px`
                            }}
                        >
                        {Array.from({ length: currentSlots }).map((_, index) => {
                            const item = filteredAndSortedInventory[index];
                            if (item) {
                                return (
                                    <div
                                        key={item.id}
                                        className="aspect-square"
                                        style={{ width: '100%', minWidth: 0, minHeight: 0, maxWidth: '100%' }}
                                    >
                                        <InventoryItemCard
                                            item={item}
                                            onClick={() => {
                                                setSelectedItemId(item.id);
                                                if (embedded && narrowInventoryLayout) {
                                                    handlers.openViewingItem(item, true);
                                                } else if (narrowInventoryLayout) {
                                                    setIsMobileItemDetailOpen(true);
                                                }
                                            }}
                                            isSelected={selectedItemId === item.id}
                                            isEquipped={item.isEquipped || false}
                                            enhancementStars={enhancementAnimationTarget?.itemId === item.id ? enhancementAnimationTarget.stars : undefined}
                                            isPresetEquipped={isItemInAnyPreset(item.id)}
                                            scaleFactor={scaleFactor}
                                            compactIconLayout={narrowInventoryLayout}
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

            {embedded && narrowInventoryLayout && isMobileEquippedModalOpen && (
                <div className="absolute inset-0 z-30 flex min-h-0 flex-col overflow-hidden bg-gray-900/98 p-2">
                    <button
                        type="button"
                        onClick={() => setIsMobileEquippedModalOpen(false)}
                        className="mb-2 shrink-0 self-start rounded-lg border border-white/15 bg-black/35 px-3 py-1.5 text-sm font-semibold text-amber-100"
                    >
                        가방으로
                    </button>
                    <div className={`flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto ${BAG_SCROLLBAR_Y_CLASS}`}>
                        <h3 className="font-bold text-on-panel" style={{ fontSize: `${Math.max(14, Math.round(17 * mobileEquippedLayoutScale * mobileTextScale))}px` }}>
                            장착 슬롯
                        </h3>
                        <div
                            className="grid"
                            style={{
                                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                                gap: `${Math.max(2, Math.round(3.5 * mobileEquippedLayoutScale))}px`,
                            }}
                        >
                            {EQUIPMENT_SLOTS.map((slot) => {
                                const equippedItem = getItemForSlot(slot);
                                return (
                                    <div key={slot} style={{ width: '100%', minWidth: 0 }}>
                                        <EquipmentSlotDisplay
                                            slot={slot}
                                            item={equippedItem}
                                            scaleFactor={Math.max(0.22, Math.min(0.38, mobileEquippedLayoutScale * 0.82))}
                                            compactIconLayout
                                            onClick={
                                                equippedItem
                                                    ? () => handlers.openViewingItem(equippedItem, true)
                                                    : undefined
                                            }
                                            isSelected={equippedItem ? selectedItemId === equippedItem.id : false}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {narrowInventoryLayout && isMobileEquippedModalOpen && !embedded && (
                <DraggableWindow
                    title="장착 장비"
                    onClose={() => setIsMobileEquippedModalOpen(false)}
                    windowId="inventoryMobileEquipped"
                    isTopmost={isTopmost && !isMobileItemDetailOpen}
                    initialWidth={MOBILE_EQUIPPED_MODAL_DESIGN_WIDTH}
                    initialHeight={600}
                    variant="store"
                    mobileViewportFit
                    mobileViewportMaxHeightVh={92}
                    bodyPaddingClassName="!px-2 !py-2 sm:!px-2.5 sm:!py-2.5"
                    viewportPortal={useViewportSizedBagModal}
                >
                    <div
                        className={`flex max-h-[min(82dvh,600px)] min-h-0 flex-col gap-1.5 overflow-y-auto ${BAG_SCROLLBAR_Y_CLASS}`}
                        style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                        <h3
                            className="font-bold text-on-panel"
                            style={{
                                fontSize: `${Math.max(14, Math.round(17 * mobileEquippedLayoutScale * mobileTextScale))}px`,
                            }}
                        >
                            장착 슬롯
                        </h3>
                        <div
                            className="grid"
                            style={{
                                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                                gap: `${Math.max(2, Math.round(3.5 * mobileEquippedLayoutScale))}px`,
                            }}
                        >
                            {EQUIPMENT_SLOTS.map((slot) => {
                                const equippedItem = getItemForSlot(slot);
                                return (
                                    <div key={slot} style={{ width: '100%', minWidth: 0 }}>
                                        <EquipmentSlotDisplay
                                            slot={slot}
                                            item={equippedItem}
                                            scaleFactor={Math.max(0.22, Math.min(0.38, mobileEquippedLayoutScale * 0.82))}
                                            compactIconLayout
                                            onClick={equippedItem ? () => {
                                                setSelectedItemId(equippedItem.id);
                                                setIsMobileItemDetailOpen(true);
                                            } : undefined}
                                            isSelected={equippedItem ? selectedItemId === equippedItem.id : false}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="border-t border-gray-600/60 pt-1.5">
                            <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5">
                                {Object.values(CoreStat).map((stat) => {
                                    const baseStats = currentUser.baseStats || {};
                                    const spentStatPoints = currentUser.spentStatPoints || {};
                                    const baseValue = (baseStats[stat] || 0) + (spentStatPoints[stat] || 0);
                                    const bonusInfo = coreStatBonuses[stat] || { percent: 0, flat: 0 };
                                    const flatBonus = Number(bonusInfo.flat) || 0;
                                    const percentBonus = Number(bonusInfo.percent) || 0;
                                    const finalValue = computeCoreStatFinalFromBonuses(baseValue, flatBonus, percentBonus);
                                    const bonus = finalValue - baseValue;
                                    const eqStatFs = Math.max(14, Math.round(16 * mobileEquippedLayoutScale * mobileTextScale));
                                    const eqBonusFs = Math.max(12, Math.round(14 * mobileEquippedLayoutScale * mobileTextScale));
                                    return (
                                        <div
                                            key={stat}
                                            className="flex items-center justify-between rounded-md bg-tertiary/40 px-1.5 py-1"
                                            style={{ fontSize: `${eqStatFs}px` }}
                                        >
                                            <span className="whitespace-nowrap font-semibold text-secondary">{stat}</span>
                                            <span className="whitespace-nowrap font-mono font-bold" title={`기본: ${baseValue}, 장비: ${bonus}`}>
                                                {isNaN(finalValue) ? 0 : finalValue}
                                                {bonus > 0 && (
                                                    <span className="ml-0.5 text-green-400" style={{ fontSize: `${eqBonusFs}px` }}>
                                                        (+{bonus})
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-1.5 flex items-center gap-1">
                                <select
                                    value={selectedPreset}
                                    onChange={(e) => handlePresetChange(Number(e.target.value))}
                                    className="min-w-0 flex-1 rounded-md border border-color bg-secondary py-1.5 pl-2 pr-1 focus:border-accent focus:ring-accent"
                                    style={{ fontSize: `${Math.max(14, Math.round(15.5 * mobileEquippedLayoutScale * mobileTextScale))}px` }}
                                >
                                    {presets.map((preset, index) => (
                                        <option key={index} value={index}>
                                            {preset.name}
                                        </option>
                                    ))}
                                </select>
                                <Button onClick={handleOpenRenameModal} colorScheme="blue" className={`!shrink-0 !py-1.5 !px-2 ${viewerActionButtonClass.info}`} style={{ fontSize: `${Math.max(13, Math.round(15 * mobileEquippedLayoutScale * mobileTextScale))}px` }}>
                                    저장
                                </Button>
                            </div>
                        </div>
                    </div>
                </DraggableWindow>
            )}

            {narrowInventoryLayout && isMobileItemDetailOpen && selectedItem && !embedded && (
                <DraggableWindow
                    title="아이템 정보"
                    onClose={() => setIsMobileItemDetailOpen(false)}
                    windowId="inventoryMobileItemDetail"
                    isTopmost={!isEquipCompareOpen}
                    initialWidth={MOBILE_EQUIPMENT_DETAIL_MODAL_WIDTH}
                    shrinkHeightToContent
                    variant="store"
                    mobileViewportFit
                    mobileViewportMaxHeightVh={98}
                    mobileViewportMaxHeightCss={MOBILE_EQUIPMENT_DETAIL_MAX_HEIGHT_CSS}
                    mobileViewportDvhBottomGapPx={8}
                    bodyScrollable
                    bodyPaddingClassName={MOBILE_EQUIPMENT_DETAIL_BODY_PADDING_CLASS}
                    hideFooter
                    viewportPortal={useViewportSizedBagModal}
                >
                    <div className="flex min-h-0 w-full min-w-0 flex-col gap-1.5">
                        <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
                            {selectedItem.type === 'equipment' ||
                            selectedItem.type === 'consumable' ||
                            selectedItem.type === 'material' ? (
                                <EquipmentDetailPanel
                                    item={selectedItem}
                                    iconSlotPx={Math.max(
                                        52,
                                        Math.round(
                                            80 *
                                                Math.max(0.35, scaleFactor * MOBILE_EQUIPMENT_DETAIL_LAYOUT_SCALE * 1.15) *
                                                0.88
                                        )
                                    )}
                                    comfortableTypography
                                    optionRowsSingleLine={selectedItem.type === 'equipment'}
                                    showTradeStatusUnderImage
                                    optionsScrollable={false}
                                />
                            ) : (
                                <div className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-panel-secondary p-2">
                                    <LocalItemDetailDisplay
                                        item={selectedItem}
                                        title="선택된 아이템 없음"
                                        comparisonItem={undefined}
                                        scaleFactor={Math.max(0.35, scaleFactor * MOBILE_EQUIPMENT_DETAIL_LAYOUT_SCALE * 1.15)}
                                        mobileTextScale={mobileTextScale}
                                        userLevelSum={currentUser.userLevel}
                                        detailScaleMultiplier={0.88}
                                        expandOptionsToFill={false}
                                    />
                                </div>
                            )}
                        </div>
                        <div className={`shrink-0 border-t border-slate-700/50 pt-2 ${BAG_INVENTORY_FOOTER_ROW_CLASS}`}>
                            {selectedItem.type === 'equipment' && (
                                <>
                                    {selectedItem.id === correspondingEquippedItem?.id ? (
                                        <Button bare colorScheme="none" onClick={() => handleEquipToggle(selectedItem.id)} className={BAG_INVENTORY_FOOTER_BTN.danger}>
                                            해제
                                        </Button>
                                    ) : (
                                        <Button
                                            bare
                                            colorScheme="none"
                                            onClick={() => handleEquipToggle(selectedItem.id)}
                                            className={BAG_INVENTORY_FOOTER_BTN.success}
                                            disabled={!canEquip}
                                        >
                                            장착
                                        </Button>
                                    )}
                                    {selectedItem.slot && selectedItem.id !== correspondingEquippedItem?.id && (
                                        <Button type="button" bare colorScheme="none" onClick={() => setIsEquipCompareOpen(true)} className={BAG_INVENTORY_FOOTER_BTN.info}>
                                            장비 비교
                                        </Button>
                                    )}
                                    <Button bare colorScheme="none" onClick={() => onStartEnhance(selectedItem)} disabled={selectedItem.stars >= 10} className={BAG_INVENTORY_FOOTER_BTN.warning}>
                                        {selectedItem.stars >= 10 ? '최대 강화' : '강화'}
                                    </Button>
                                    <Button bare colorScheme="none" onClick={() => setItemToSell(selectedItem)} className={BAG_INVENTORY_FOOTER_BTN.danger}>
                                        판매
                                    </Button>
                                    {selectedItem.isBound && (
                                        <Button
                                            bare
                                            colorScheme="none"
                                            onClick={() => handleUnbindEquipment(selectedItem.id)}
                                            className={BAG_INVENTORY_FOOTER_BTN.info}
                                        >
                                            귀속해제
                                        </Button>
                                    )}
                                </>
                            )}
                            {selectedItem.type === 'consumable' &&
                                (() => {
                                    const consumableItem = findConsumableItem(selectedItem.name);
                                    const isUsable = consumableItem?.usable !== false;
                                    const isRefinementTicket = isRefinementTicketMaterial(selectedItem.name);
                                    const isSellable = isRefinementTicket || consumableItem?.sellable !== false;
                                    const hideBagUse = isConditionPotionConsumable(selectedItem.name);
                                    return (
                                        <>
                                            {isUsable && !hideBagUse && (
                                                <>
                                                    <Button
                                                        bare
                                                        colorScheme="none"
                                                        onClick={() => {
                                                            void onAction({ type: 'USE_ITEM', payload: { itemId: selectedItem.id, itemName: selectedItem.name } });
                                                        }}
                                                        className={BAG_INVENTORY_FOOTER_BTN.info}
                                                    >
                                                        사용
                                                    </Button>
                                                    {!isRefinementTicket && selectedItem.quantity && selectedItem.quantity > 1 && (
                                                        <Button
                                                            bare
                                                            colorScheme="none"
                                                            onClick={() => {
                                                                setItemToUseBulk(selectedItem);
                                                                setShowUseQuantityModal(true);
                                                            }}
                                                            className={BAG_INVENTORY_FOOTER_BTN.accent}
                                                        >
                                                            일괄 사용
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                            {isSellable && (
                                                <>
                                                    <Button bare colorScheme="none" onClick={() => setItemToSell(selectedItem)} className={BAG_INVENTORY_FOOTER_BTN.danger}>
                                                        판매
                                                    </Button>
                                                    {selectedItem.quantity && selectedItem.quantity > 1 && (
                                                        <Button bare colorScheme="none" onClick={() => setItemToSellBulk(selectedItem)} className={BAG_INVENTORY_FOOTER_BTN.warning}>
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
                                    <Button bare colorScheme="none" onClick={() => setItemToSell(selectedItem)} className={BAG_INVENTORY_FOOTER_BTN.danger}>
                                        판매
                                    </Button>
                                    <Button bare colorScheme="none" onClick={() => setItemToSellBulk(selectedItem)} className={BAG_INVENTORY_FOOTER_BTN.warning}>
                                        일괄 판매
                                    </Button>
                                    {!isRefinementTicketMaterial(selectedItem.name) && getEnhancementMaterialUsageLinesForBag(selectedItem.name).length > 0 && (
                                        <Button bare colorScheme="none" onClick={() => onOpenBlacksmithTab('convert')} className={BAG_INVENTORY_FOOTER_BTN.info}>
                                            재료변환
                                        </Button>
                                    )}
                                    {isRefinementTicketMaterial(selectedItem.name) && (
                                        <Button bare colorScheme="none" onClick={() => onOpenBlacksmithTab('refine')} className={BAG_INVENTORY_FOOTER_BTN.info}>
                                            사용
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </DraggableWindow>
            )}

            {isEquipCompareOpen &&
                selectedItem?.type === 'equipment' &&
                selectedItem.slot &&
                selectedItem.id !== correspondingEquippedItem?.id && (
                    <DraggableWindow
                        title="장비 비교"
                        onClose={() => setIsEquipCompareOpen(false)}
                        windowId="inventoryEquipCompare"
                        isTopmost
                        initialWidth={narrowInventoryLayout ? MOBILE_EQUIPMENT_DETAIL_MODAL_WIDTH : 720}
                        initialHeight={narrowInventoryLayout ? undefined : 680}
                        shrinkHeightToContent={narrowInventoryLayout}
                        variant="store"
                        mobileViewportFit={narrowInventoryLayout}
                        mobileViewportMaxHeightVh={narrowInventoryLayout ? 98 : undefined}
                        mobileViewportMaxHeightCss={narrowInventoryLayout ? MOBILE_EQUIPMENT_DETAIL_MAX_HEIGHT_CSS : undefined}
                        mobileViewportDvhBottomGapPx={narrowInventoryLayout ? 8 : undefined}
                        bodyScrollable={narrowInventoryLayout}
                        bodyPaddingClassName={narrowInventoryLayout ? MOBILE_EQUIPMENT_DETAIL_BODY_PADDING_CLASS : 'p-2 sm:p-3'}
                        hideFooter={narrowInventoryLayout}
                        viewportPortal={useViewportSizedBagModal}
                        mobileLockViewportHeight={narrowInventoryLayout && useViewportSizedBagModal}
                    >
                        <div
                            className={`flex flex-col gap-1 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-b-xl ${BAG_SCROLLBAR_Y_CLASS} ${
                                narrowInventoryLayout
                                    ? 'h-full min-h-0 max-h-[min(90dvh,640px)]'
                                    : 'h-[min(78dvh,720px)] min-h-[min(50dvh,360px)]'
                            }`}
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            {narrowInventoryLayout ? (
                                <div className="flex min-h-0 flex-[1.15_1_0%] flex-col overflow-hidden rounded-lg border border-cyan-500/35 bg-panel-secondary/90 shadow-inner">
                                    <div className="shrink-0 grid grid-cols-4 gap-0.5 border-b border-cyan-500/20 px-1 py-1.5">
                                        {[
                                            ['info', '장비정보'],
                                            ['mainSub', '주/부옵션'],
                                            ['special', '특수옵션'],
                                            ['mythic', '신화옵션'],
                                        ].map(([key, label]) => {
                                            const active = equipCompareViewerTab === key;
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => setEquipCompareViewerTab(key as 'info' | 'mainSub' | 'special' | 'mythic')}
                                                    className={`rounded-md border px-0.5 py-1.5 text-[11px] font-semibold leading-none ${
                                                        active
                                                            ? 'border-amber-400/70 bg-amber-900/40 text-amber-100'
                                                            : 'border-gray-600/60 bg-black/25 text-gray-300'
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex min-h-0 flex-1 flex-col p-1">
                                        <div className="flex min-h-0 flex-1 gap-1.5">
                                            <div className="flex min-h-0 w-[24%] min-w-0 flex-col gap-1">
                                                <div className="flex min-h-0 flex-1 basis-0 flex-col rounded-md border border-cyan-500/35 bg-black/25 p-0.5">
                                                    <div className="mb-0.5 text-center text-[11px] font-semibold leading-snug text-cyan-200">현재 장착</div>
                                                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
                                                        <div className="mx-auto w-[84%] shrink-0">
                                                            <EquipmentSlotDisplay
                                                                slot={selectedItem.slot}
                                                                item={correspondingEquippedItem ?? undefined}
                                                                scaleFactor={Math.max(0.22, Math.min(0.38, MOBILE_EQUIPMENT_DETAIL_LAYOUT_SCALE * 0.82))}
                                                                compactIconLayout
                                                            />
                                                        </div>
                                                        <div className="mt-0.5 text-center leading-tight">
                                                            <div
                                                                className="whitespace-nowrap text-cyan-200"
                                                                style={{ fontSize: `${resolveNoWrapTextFontPx(correspondingEquippedItem?.name ?? '장비 없음', 11, 7, 9, 0.5)}px` }}
                                                            >
                                                                {correspondingEquippedItem?.name ?? '장비 없음'}
                                                            </div>
                                                            <div className="text-[11px] leading-snug text-cyan-300/90">
                                                                [{correspondingEquippedItem ? gradeStyles[correspondingEquippedItem.grade].name : '-'}]
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex min-h-0 flex-1 basis-0 flex-col rounded-md border border-amber-500/35 bg-black/25 p-0.5">
                                                    <div className="mb-0.5 text-center text-[11px] font-semibold leading-snug text-amber-200">선택 장비</div>
                                                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
                                                        <div className="mx-auto w-[84%] shrink-0">
                                                            <EquipmentSlotDisplay
                                                                slot={selectedItem.slot}
                                                                item={selectedItem}
                                                                scaleFactor={Math.max(0.22, Math.min(0.38, MOBILE_EQUIPMENT_DETAIL_LAYOUT_SCALE * 0.82))}
                                                                compactIconLayout
                                                            />
                                                        </div>
                                                        <div className="mt-0.5 text-center leading-tight">
                                                            <div
                                                                className="whitespace-nowrap text-amber-200"
                                                                style={{ fontSize: `${resolveNoWrapTextFontPx(selectedItem.name, 11, 7, 9, 0.5)}px` }}
                                                            >
                                                                {selectedItem.name}
                                                            </div>
                                                            <div className="text-[11px] leading-snug text-amber-300/90">
                                                                [{gradeStyles[selectedItem.grade].name}]
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-md bg-gray-900/50 p-1">
                                                <div className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden text-[11px] ${BAG_SCROLLBAR_Y_CLASS}`}>
                                                    {(() => {
                                                        const currentEquip = correspondingEquippedItem ?? null;
                                                        const selectedEquip = selectedItem;
                                                        const getAllOptions = (invItem: InventoryItem | null | undefined): ItemOption[] =>
                                                            !invItem || !invItem.options
                                                                ? []
                                                                : [
                                                                      ...(invItem.options.main ? [invItem.options.main] : []),
                                                                      ...(invItem.options.combatSubs || []),
                                                                      ...(invItem.options.specialSubs || []),
                                                                      ...(invItem.options.mythicSubs || []),
                                                                  ].filter(Boolean) as ItemOption[];
                                                        const findOpt = (invItem: InventoryItem | null | undefined, type: ItemOptionType) =>
                                                            getAllOptions(invItem).find((o) => o.type === type) ?? null;
                                                        const collectBy = (predicate: (opt: ItemOption) => boolean): ItemOptionType[] => {
                                                            const s = new Set<ItemOptionType>();
                                                            getAllOptions(currentEquip).forEach((o) => predicate(o) && s.add(o.type));
                                                            getAllOptions(selectedEquip).forEach((o) => predicate(o) && s.add(o.type));
                                                            return Array.from(s).sort((a, b) => String(a).localeCompare(String(b)));
                                                        };
                                                        const mainTypeCurrent = currentEquip?.options?.main?.type;
                                                        const mainTypeSelected = selectedEquip?.options?.main?.type;
                                                        const mainSubTypesRaw = collectBy((o) => Object.values(CoreStat).includes(o.type as CoreStat) || o.type === mainTypeCurrent || o.type === mainTypeSelected);
                                                        const mainPriorityTypes = [mainTypeCurrent, mainTypeSelected].filter(Boolean) as ItemOptionType[];
                                                        const uniqueMainPriorityTypes = Array.from(new Set(mainPriorityTypes));
                                                        const mainSubTypes = [
                                                            ...uniqueMainPriorityTypes.filter((t) => mainSubTypesRaw.includes(t)),
                                                            ...mainSubTypesRaw.filter((t) => !uniqueMainPriorityTypes.includes(t)),
                                                        ];
                                                        const specialTypes = collectBy((o) => coerceSpecialStatType(o.type) !== undefined);
                                                        const mythicTypes = collectBy((o) => Object.values(MythicStat).includes(o.type as MythicStat));
                                                        const renderOptRowsForItem = (
                                                            types: ItemOptionType[],
                                                            baseItem: InventoryItem | null | undefined,
                                                            _compareItem: InventoryItem | null | undefined,
                                                            tone: 'cyan' | 'amber',
                                                        ) => {
                                                            const ownTypeSet = new Set<ItemOptionType>(getAllOptions(baseItem).map((opt) => opt.type));
                                                            const ownTypes = types.filter((type) => ownTypeSet.has(type));
                                                            return ownTypes.length > 0 ? (
                                                                ownTypes.map((type) => {
                                                                    const base = findOpt(baseItem, type);
                                                                    const labelSrc = base;
                                                                    const isMainOptionType =
                                                                        type === (baseItem?.options?.main?.type ?? null) ||
                                                                        type === (_compareItem?.options?.main?.type ?? null);
                                                                    const labelClass = isMainOptionType
                                                                        ? 'text-yellow-300'
                                                                        : coerceSpecialStatType(type)
                                                                          ? 'text-green-300'
                                                                          : Object.values(MythicStat).includes(type as MythicStat)
                                                                            ? 'text-orange-400'
                                                                            : Object.values(CoreStat).includes(type as CoreStat)
                                                                              ? 'text-blue-300'
                                                                              : 'text-stone-300';
                                                                    return (
                                                                        <div key={`${tone}-${String(type)}`} className="rounded-md bg-black/25 px-1.5 py-0.5">
                                                                            <div className="flex items-center justify-between gap-0.5 tabular-nums leading-tight">
                                                                                <span className={`min-w-0 flex-1 whitespace-nowrap font-semibold ${labelClass}`} style={{ fontSize: `${resolveNoWrapTextFontPx(labelSrc?.display ?? String(type), 11, 7, 11, 0.4)}px` }}>
                                                                                    {labelSrc?.display ?? String(type)}
                                                                                </span>
                                                                                <span className={tone === 'cyan' ? 'shrink-0 text-cyan-200 text-[11px]' : 'shrink-0 text-amber-200 text-[11px]'}>
                                                                                    {base ? base.value : '-'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })
                                                            ) : (
                                                                <p className="px-1 py-1 text-stone-500">옵션 없음</p>
                                                            );
                                                        };

                                                        const renderViewerPane = (
                                                            tone: 'cyan' | 'amber',
                                                            itemRef: InventoryItem | null | undefined,
                                                            body: React.ReactNode,
                                                        ) => (
                                                            <div className={`flex min-h-0 flex-1 basis-0 flex-col rounded-md border bg-black/20 p-0.5 ${tone === 'cyan' ? 'border-cyan-500/35' : 'border-amber-500/35'}`}>
                                                                <div className={`min-h-0 flex-1 overflow-y-auto overflow-x-auto pr-0.5 ${BAG_SCROLLBAR_Y_CLASS}`}>
                                                                    {!itemRef ? (
                                                                        <p className="text-stone-500">장비 없음</p>
                                                                    ) : (
                                                                        body
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );

                                                        if (equipCompareViewerTab === 'info') {
                                                            const currentReq = currentEquip ? GRADE_LEVEL_REQUIREMENTS[currentEquip.grade] : '-';
                                                            const selectedReq = GRADE_LEVEL_REQUIREMENTS[selectedEquip.grade];
                                                            const currentRefine = currentEquip
                                                                ? (currentEquip.grade !== 'normal' && ((currentEquip as any).refinementCount ?? 0) > 0
                                                                    ? `${(currentEquip as any).refinementCount}회`
                                                                    : '제련불가')
                                                                : '-';
                                                            const selectedRefine =
                                                                selectedEquip.grade !== 'normal' && ((selectedEquip as any).refinementCount ?? 0) > 0
                                                                    ? `${(selectedEquip as any).refinementCount}회`
                                                                    : '제련불가';
                                                            return (
                                                                <div className="flex h-full min-h-0 flex-col gap-0.5">
                                                                    {renderViewerPane(
                                                                        'cyan',
                                                                        currentEquip,
                                                                        <div className="rounded-md bg-black/25 px-1.5 py-0.75 text-[11px] leading-[1.2]">
                                                                            <span className="block whitespace-nowrap text-cyan-200">
                                                                                {typeof currentReq === 'number' ? formatEquipLevelRequirement(currentReq) : currentReq}
                                                                            </span>
                                                                            <span className="mt-0.5 block whitespace-nowrap text-cyan-200">
                                                                                {`제련 가능 : ${currentRefine}`}
                                                                            </span>
                                                                        </div>,
                                                                    )}
                                                                    {renderViewerPane(
                                                                        'amber',
                                                                        selectedEquip,
                                                                        <div className="rounded-md bg-black/25 px-1.5 py-0.75 text-[11px] leading-[1.2]">
                                                                            <span className="block whitespace-nowrap text-amber-200">
                                                                                {formatEquipLevelRequirement(selectedReq)}
                                                                            </span>
                                                                            <span className="mt-0.5 block whitespace-nowrap text-amber-200">
                                                                                {`제련 가능 : ${selectedRefine}`}
                                                                            </span>
                                                                        </div>,
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                        const activeTypes =
                                                            equipCompareViewerTab === 'mainSub'
                                                                ? mainSubTypes
                                                                : equipCompareViewerTab === 'special'
                                                                  ? specialTypes
                                                                  : mythicTypes;
                                                        return (
                                                            <div className="flex h-full min-h-0 flex-col gap-0.5">
                                                                {renderViewerPane(
                                                                    'cyan',
                                                                    currentEquip,
                                                                    <div className="space-y-0">{renderOptRowsForItem(activeTypes, currentEquip, selectedEquip, 'cyan')}</div>,
                                                                )}
                                                                {renderViewerPane(
                                                                    'amber',
                                                                    selectedEquip,
                                                                    <div className="space-y-0">{renderOptRowsForItem(activeTypes, selectedEquip, currentEquip, 'amber')}</div>,
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex min-h-0 min-h-[200px] flex-1 flex-row gap-2">
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-cyan-500/35 bg-panel-secondary/90 shadow-inner">
                                        <h4
                                            className="shrink-0 border-b border-cyan-500/20 px-2 py-1 font-bold text-cyan-200/95"
                                            style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * compareModalTextScale))}px` }}
                                        >
                                            현재 장착
                                        </h4>
                                        <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-1.5 ${BAG_SCROLLBAR_Y_CLASS}`} style={{ WebkitOverflowScrolling: 'touch' }}>
                                            <LocalItemDetailDisplay
                                                item={correspondingEquippedItem}
                                                title="장착된 장비 없음"
                                                comparisonItem={selectedItem}
                                                scaleFactor={Math.max(0.42, scaleFactor * 0.92)}
                                                mobileTextScale={compareModalTextScale}
                                                userLevelSum={currentUser.userLevel}
                                                emptySlot={selectedItem.slot}
                                                detailScaleMultiplier={0.92}
                                                expandOptionsToFill
                                            />
                                        </div>
                                    </div>
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-600/55 bg-panel-secondary shadow-inner">
                                        <h4
                                            className="shrink-0 border-b border-gray-600/40 px-2 py-1 font-bold text-on-panel"
                                            style={{ fontSize: `${Math.max(12, Math.round(14 * scaleFactor * compareModalTextScale))}px` }}
                                        >
                                            선택 장비
                                        </h4>
                                        <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-1.5 ${BAG_SCROLLBAR_Y_CLASS}`} style={{ WebkitOverflowScrolling: 'touch' }}>
                                            <LocalItemDetailDisplay
                                                item={selectedItem}
                                                title="선택된 아이템 없음"
                                                comparisonItem={correspondingEquippedItem ?? undefined}
                                                scaleFactor={Math.max(0.42, scaleFactor * 0.92)}
                                                mobileTextScale={compareModalTextScale}
                                                userLevelSum={currentUser.userLevel}
                                                detailScaleMultiplier={0.92}
                                                expandOptionsToFill
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                            {equipSwapStatPreview && (
                                <div className={`min-h-0 flex-[0.85_1_0%] overflow-y-auto rounded-lg border border-amber-400/30 bg-gradient-to-br from-amber-950/40 via-gray-900/90 to-gray-950/95 p-1.5 shadow-inner ${BAG_SCROLLBAR_Y_CLASS}`}>
                                    <h4
                                        className="mb-0.5 font-bold text-amber-100/95 leading-tight"
                                        style={{ fontSize: `${Math.max(14, Math.round(15 * scaleFactor * compareModalTextScale))}px` }}
                                    >
                                        교체 시 바둑 능력치 변화
                                    </h4>
                                    <div className={`grid grid-cols-1 ${narrowInventoryLayout ? 'gap-y-0' : 'gap-y-1'}`}>
                                        {Object.values(CoreStat).map((stat) => {
                                            const cur = equipSwapStatPreview.currentStats[stat];
                                            const next = equipSwapStatPreview.afterStats[stat];
                                            const d = equipSwapStatPreview.delta[stat];
                                            const deltaClass =
                                                d > 0 ? 'text-green-400' : d < 0 ? 'text-red-400' : 'text-stone-500';
                                            return (
                                                <div
                                                    key={stat}
                                                    className={`min-w-0 rounded-md bg-black/25 ${
                                                        narrowInventoryLayout ? 'px-1 py-[2px]' : 'px-1.5 py-1'
                                                    }`}
                                                >
                                                    <div
                                                        className={`flex items-center justify-center font-mono tabular-nums leading-none text-stone-100 ${
                                                            narrowInventoryLayout ? 'gap-1.5' : 'gap-3'
                                                        }`}
                                                        style={{ fontSize: `${Math.max(13, Math.round(14 * scaleFactor * compareModalTextScale))}px` }}
                                                    >
                                                        <span className={`${narrowInventoryLayout ? 'w-[4.6rem]' : 'w-[6.2rem]'} shrink-0 text-right font-semibold text-stone-300 whitespace-nowrap`}>{stat}</span>
                                                        <span className={`${narrowInventoryLayout ? 'w-[5.8rem]' : 'w-[7.6rem]'} shrink-0 whitespace-nowrap text-center`}>
                                                            <span className="text-stone-400">{cur}</span>
                                                            <span className="mx-[1px] text-stone-600">→</span>
                                                            <span>{next}</span>
                                                            {d !== 0 && (
                                                                <span className={`ml-[2px] font-bold ${deltaClass}`}>
                                                                    ({d > 0 ? '+' : ''}
                                                                    {d})
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div
                                        className="mt-1 flex items-center justify-center gap-1.5 border-t border-amber-500/20 pt-0.5 font-bold text-stone-100"
                                        style={{ fontSize: `${Math.max(14, Math.round(15 * scaleFactor * compareModalTextScale))}px` }}
                                    >
                                        <span className={`${narrowInventoryLayout ? 'w-[4.6rem]' : 'w-[6.2rem]'} shrink-0 text-right text-amber-200/90 whitespace-nowrap`}>종합 능력</span>
                                        <span className={`${narrowInventoryLayout ? 'w-[5.8rem]' : 'w-[7.6rem]'} shrink-0 text-center font-mono tabular-nums whitespace-nowrap`}>
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
                    viewportPortal={useViewportSizedBagModal}
                />
            )}

            {itemToSell && (
                <SellItemConfirmModal
                    item={itemToSell}
                    onClose={() => setItemToSell(null)}
                    onConfirm={async () => {
                        const sellOneMaterialOrTicket = async () => {
                            await onAction({
                                type: 'SELL_ITEM',
                                payload: { itemId: itemToSell.id, quantity: 1, itemName: itemToSell.name },
                            });
                        };
                        if (itemToSell.type === 'material' || isRefinementTicketMaterial(itemToSell.name)) {
                            await sellOneMaterialOrTicket();
                        } else if (itemToSell.type === 'consumable') {
                            // 소모품은 전체 판매 (수량이 있으면 전체 수량 판매)
                            await onAction({
                                type: 'SELL_ITEM',
                                payload: {
                                    itemId: itemToSell.id,
                                    quantity: itemToSell.quantity || 1,
                                    itemName: itemToSell.name,
                                },
                            });
                        } else {
                            // 장비는 전체 판매
                            await onAction({ type: 'SELL_ITEM', payload: { itemId: itemToSell.id, itemName: itemToSell.name } });
                        }
                        setItemToSell(null);
                        setSelectedItemId(null);
                    }}
                    // 가방 부모가 전역 스택에서 isTopmost=false일 때(다른 모달이 맨 위로 잡힘)에도
                    // DraggableWindow의 비-topmost 차단 오버레이가 판매 확정 버튼을 막지 않도록 항상 true.
                    isTopmost
                    // 일괄 판매와 동일: 뷰포트 포털로 두어 설계 픽셀 캔버스·transform 아래에서 클릭이 안 먹는 문제 방지
                    viewportPortal={useViewportSizedBagModal}
                />
            )}

            {itemToSellBulk && (
                <SellMaterialBulkModal
                    item={itemToSellBulk}
                    currentUser={currentUser}
                    onClose={() => setItemToSellBulk(null)}
                    onConfirm={async (quantity) => {
                        // 같은 이름의 아이템을 모두 찾아서 순차적으로 판매 (재료 또는 소모품).
                        // 변경권은 레거시 consumable 행과 현재 material 행을 같은 재료로 취급한다.
                        const sellBulkAsRefinementTicket = isRefinementTicketMaterial(itemToSellBulk.name);
                        const targetRefinementTicketName = normalizeRefinementTicketInventoryName(itemToSellBulk.name);
                        const itemsToSell = currentUser.inventory
                            .filter(i =>
                                sellBulkAsRefinementTicket
                                    ? isRefinementTicketMaterial(i.name) &&
                                      normalizeRefinementTicketInventoryName(i.name) === targetRefinementTicketName
                                    : i.type === itemToSellBulk.type && i.name === itemToSellBulk.name
                            )
                            .sort((a, b) => (a.quantity || 0) - (b.quantity || 0)); // 수량이 적은 것부터 정렬
                        
                        let remainingQuantity = quantity;
                        
                        // 순차적으로 처리하여 인벤토리 상태가 올바르게 업데이트되도록 함
                        for (const item of itemsToSell) {
                            if (remainingQuantity <= 0) break;
                            const sellQty = Math.min(remainingQuantity, item.quantity || 1);
                            await onAction({
                                type: 'SELL_ITEM',
                                payload: { itemId: item.id, quantity: sellQty, itemName: item.name },
                            });
                            remainingQuantity -= sellQty;
                        }
                        
                        setItemToSellBulk(null);
                        setSelectedItemId(null);
                    }}
                    isTopmost
                    viewportPortal={useViewportSizedBagModal}
                />
            )}

            {isExpandModalOpen && activeTab !== 'all' && (
                <DraggableWindow
                    title="가방 확장"
                    onClose={() => setIsExpandModalOpen(false)}
                    windowId="expandInventory"
                    isTopmost
                    variant="store"
                    initialWidth={400}
                    shrinkHeightToContent
                    bodyNoScroll
                    bodyPaddingClassName="p-0"
                    viewportPortal={useViewportSizedBagModal}
                >
                    <InventorySlotExpandDiamondBody
                        eyebrow="Inventory upgrade"
                        question={`${activeTabLabel} 가방을 확장하시겠습니까?`}
                        currentSlots={currentCategorySlots}
                        nextSlots={nextCategorySlots}
                        slotsHint={slotsIncrease > 0 ? `+${slotsIncrease}칸 추가` : undefined}
                        diamondCost={expansionCost}
                        hasEnoughDiamonds={hasEnoughDiamonds}
                        onCancel={() => setIsExpandModalOpen(false)}
                        onConfirm={handleConfirmExpand}
                    />
                </DraggableWindow>
            )}

            {isRenameModalOpen && (
                <DraggableWindow
                    title="프리셋 이름 변경"
                    onClose={() => setIsRenameModalOpen(false)}
                    windowId="renamePreset"
                    isTopmost
                    variant="store"
                    initialWidth={400}
                    initialHeight={344}
                    mobileViewportFit
                    mobileViewportMaxHeightCss="min(88dvh, calc(100dvh - 16px))"
                    bodyPaddingClassName="!p-2 sm:!p-3"
                    viewportPortal={useViewportSizedBagModal}
                >
                    <div className="flex flex-col gap-3 p-1">
                        <div
                            className="relative overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-b from-[#141a28] via-[#0d111c] to-[#080b12] shadow-[0_0_0_1px_rgba(251,191,36,0.08),0_20px_44px_-22px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.06)]"
                            role="dialog"
                            aria-labelledby="preset-rename-heading"
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.11]"
                                style={{
                                    background:
                                        'radial-gradient(ellipse 90% 50% at 50% -8%, rgba(251, 191, 36, 0.42), transparent 55%), radial-gradient(ellipse 65% 40% at 50% 108%, rgba(34, 211, 238, 0.1), transparent 52%)',
                                }}
                                aria-hidden
                            />
                            <div className="relative px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
                                <div className="mx-auto mb-3 h-px w-2/3 max-w-[14rem] bg-gradient-to-r from-transparent via-amber-400/45 to-transparent" aria-hidden />
                                <h2
                                    id="preset-rename-heading"
                                    className="mb-1 text-center text-sm font-bold tracking-wide text-amber-100/95 sm:text-base"
                                >
                                    프리셋 이름
                                </h2>
                                <p className="mb-3 text-center text-[11px] leading-relaxed text-slate-400 sm:text-xs">
                                    저장할 프리셋의 표시 이름을 입력하세요. (최대 20자)
                                </p>
                                <label htmlFor="preset-rename-input" className="sr-only">
                                    프리셋 이름
                                </label>
                                <input
                                    id="preset-rename-input"
                                    type="text"
                                    value={newPresetName}
                                    onChange={e => setNewPresetName(e.target.value)}
                                    maxLength={20}
                                    autoFocus
                                    className="mb-1 w-full rounded-xl border border-amber-500/25 bg-black/45 px-3 py-2.5 text-center text-sm font-semibold text-slate-100 shadow-inner outline-none ring-0 transition placeholder:text-slate-500 focus:border-amber-400/55 focus:bg-black/55 focus:shadow-[0_0_0_1px_rgba(251,191,36,0.25),inset_0_1px_0_rgba(255,255,255,0.06)] sm:py-2.5 sm:text-base"
                                    placeholder="예: 공격 세트"
                                />
                                <p className="mb-3 text-center text-[10px] tabular-nums text-slate-500">
                                    {newPresetName.length} / 20
                                </p>
                                <div className="flex items-center justify-center gap-2.5 sm:gap-3">
                                    <button
                                        type="button"
                                        onClick={handleSavePreset}
                                        className="w-[44%] max-w-[9.5rem] min-w-[7.25rem] rounded-xl border border-amber-300/45 bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-700 py-2.5 text-sm font-bold tracking-[0.01em] text-white shadow-[0_12px_28px_-12px_rgba(16,185,129,0.6),inset_0_1px_0_rgba(255,255,255,0.26)] transition hover:-translate-y-[1px] hover:border-amber-200/60 hover:from-emerald-300 hover:via-emerald-500 hover:to-emerald-650 hover:shadow-[0_14px_30px_-12px_rgba(16,185,129,0.7)] active:translate-y-0 active:scale-[0.98] sm:py-2.5"
                                    >
                                        저장
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsRenameModalOpen(false)}
                                        className="w-[44%] max-w-[9.5rem] min-w-[7.25rem] rounded-xl border border-slate-400/55 bg-gradient-to-b from-slate-600/95 via-slate-700/95 to-slate-900/95 py-2.5 text-sm font-bold tracking-[0.01em] text-slate-100 shadow-[0_10px_22px_-12px_rgba(15,23,42,0.85),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:-translate-y-[1px] hover:border-slate-300/70 hover:from-slate-500/95 hover:via-slate-650/95 hover:to-slate-800/95 hover:shadow-[0_12px_26px_-12px_rgba(15,23,42,0.92)] active:translate-y-0 active:scale-[0.98] sm:py-2.5"
                                    >
                                        취소
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </DraggableWindow>
            )}
            {isPresetSavedModalOpen && (
                <AlertModal
                    title="프리셋 저장"
                    message="프리셋이 저장되었습니다."
                    onClose={() => setIsPresetSavedModalOpen(false)}
                    confirmText="확인"
                    isTopmost
                    windowId="preset-save-alert"
                />
            )}
            {pendingBindEquipItemId && (
                <DraggableWindow
                    title="장비 귀속 안내"
                    onClose={handleCancelBindEquip}
                    windowId="equipmentBindConfirm"
                    isTopmost
                    variant="store"
                    initialWidth={460}
                    initialHeight={300}
                    bodyNoScroll
                    viewportPortal={useViewportSizedBagModal}
                >
                    <div className="flex h-full flex-col justify-between gap-5 p-5">
                        <p className="whitespace-pre-line text-center text-sm leading-relaxed text-slate-100">
                            장비가 귀속되어 거래소 판매가 불가능해집니다.
                            {'\n'}
                            거래소 판매를 위해서는 귀속 해제권을 사용해야합니다.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <Button onClick={handleConfirmBindEquip} colorScheme="blue" className="min-w-[120px]">
                                장착
                            </Button>
                            <Button onClick={handleCancelBindEquip} colorScheme="gray" className="min-w-[120px]">
                                취소
                            </Button>
                        </div>
                    </div>
                </DraggableWindow>
            )}
            {pendingUnbindItem && (
                <DraggableWindow
                    title="귀속 해제 확인"
                    onClose={handleCancelUnbindEquipment}
                    windowId="equipmentUnbindConfirm"
                    isTopmost
                    variant="store"
                    initialWidth={460}
                    initialHeight={560}
                    bodyNoScroll
                    viewportPortal={useViewportSizedBagModal}
                >
                    <div className="flex h-full flex-col gap-3 p-3 text-slate-100">
                        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/95 via-slate-950/90 to-zinc-950/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                            <p className="text-center text-xs font-bold tracking-wide text-amber-200/85">귀속 해제 안내</p>
                            <p className="mt-1 text-center text-base font-bold text-slate-50">{pendingUnbindItem.name}</p>
                            <p className="mt-2 text-center text-xs text-slate-300">
                                장비 귀속을 해제하면 거래소 판매가 가능해집니다.
                            </p>
                            <div className="mt-3 flex items-center justify-center">
                                <div className="relative h-16 w-16 overflow-hidden rounded-xl ring-1 ring-white/10">
                                    <img
                                        src={gradeBackgrounds[pendingUnbindItem.grade ?? ItemGrade.Normal]}
                                        alt=""
                                        className="absolute inset-0 h-full w-full object-cover"
                                    />
                                    <img
                                        src={pendingUnbindItem.image}
                                        alt={pendingUnbindItem.name}
                                        className="absolute inset-0 m-auto h-[74%] w-[74%] object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.75)]"
                                    />
                                </div>
                            </div>
                            <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold">
                                <span className="rounded-full border border-rose-400/35 bg-rose-950/35 px-2.5 py-1 text-rose-200">
                                    귀속
                                </span>
                                <span className="text-amber-200">→</span>
                                <span className="rounded-full border border-emerald-400/35 bg-emerald-950/30 px-2.5 py-1 text-emerald-200">
                                    거래가능
                                </span>
                            </div>
                        </div>
                        <div className="rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-950/45 via-yellow-950/25 to-amber-950/45 p-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg border border-white/10 bg-black/25 p-2">
                                    <p className="mb-1 text-center text-[11px] font-semibold text-slate-300">보유</p>
                                    <div className="flex items-center justify-center gap-2">
                                        <img
                                            src={unbindTicketTemplate?.image ?? '/images/use/belong.webp'}
                                            alt={EQUIPMENT_UNBIND_TICKET_NAME}
                                            className="h-8 w-8 object-contain"
                                        />
                                        <span className="text-lg font-black tabular-nums text-emerald-300">{ownedUnbindTickets}</span>
                                    </div>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-black/25 p-2">
                                    <p className="mb-1 text-center text-[11px] font-semibold text-slate-300">필요</p>
                                    <div className="flex items-center justify-center gap-2">
                                        <img
                                            src={unbindTicketTemplate?.image ?? '/images/use/belong.webp'}
                                            alt={EQUIPMENT_UNBIND_TICKET_NAME}
                                            className="h-8 w-8 object-contain"
                                        />
                                        <span className="text-lg font-black tabular-nums text-amber-200">{pendingUnbindRequiredTickets}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {!pendingUnbindHasEnoughTickets && (
                            <p className="rounded-lg border border-rose-400/35 bg-rose-950/35 px-3 py-2 text-center text-sm font-semibold text-rose-300">
                                귀속 해제권이 부족합니다.
                            </p>
                        )}
                        <div className="mt-auto flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={handleConfirmUnbindEquipment}
                                className="min-w-[120px] rounded-xl border border-emerald-300/45 bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-700 px-4 py-2.5 text-sm font-bold tracking-[0.01em] text-white shadow-[0_12px_28px_-12px_rgba(16,185,129,0.6),inset_0_1px_0_rgba(255,255,255,0.26)] transition hover:-translate-y-[1px] hover:border-emerald-200/60 hover:from-emerald-300 hover:via-emerald-500 hover:to-emerald-650 hover:shadow-[0_14px_30px_-12px_rgba(16,185,129,0.7)] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                                disabled={!pendingUnbindHasEnoughTickets}
                            >
                                귀속해제
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelUnbindEquipment}
                                className="min-w-[120px] rounded-xl border border-slate-400/55 bg-gradient-to-b from-slate-600/95 via-slate-700/95 to-slate-900/95 px-4 py-2.5 text-sm font-bold tracking-[0.01em] text-slate-100 shadow-[0_10px_22px_-12px_rgba(15,23,42,0.85),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:-translate-y-[1px] hover:border-slate-300/70 hover:from-slate-500/95 hover:via-slate-650/95 hover:to-slate-800/95 hover:shadow-[0_12px_26px_-12px_rgba(15,23,42,0.92)] active:translate-y-0 active:scale-[0.98]"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </DraggableWindow>
            )}
        </>
    );

    if (embedded) {
        return (
            <div className={PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS}>
                {inventoryBody}
            </div>
        );
    }

    return (
        <DraggableWindow
            title="가방"
            onClose={onClose}
            windowId="inventory"
            isTopmost={isTopmost && !hasInventoryChildModal}
            initialWidth={calculatedWidth}
            initialHeight={calculatedHeight}
            variant="store"
            bodyScrollable={false}
            mobileViewportFit={narrowInventoryLayout}
            mobileLockViewportHeight={useViewportSizedBagModal}
            mobileViewportMaxHeightVh={92}
            mobileViewportMaxHeightCss={undefined}
            mobileViewportDvhBottomGapPx={undefined}
            bodyPaddingClassName={narrowInventoryLayout ? 'p-2 sm:p-3' : undefined}
            uniformPcScale={!narrowInventoryLayout && !modalLayerUsesDesignPixels}
            pcViewportMaxHeightCss="min(94dvh, calc(100dvh - 16px))"
            pcViewportMaxWidthCss="90vw"
            viewportPortal={useViewportSizedBagModal}
            skipIngameBoardFrameSizeCap
        >
            {inventoryBody}
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
    /** 모바일 6열 그리드: 아이콘 살짝 축소 */
    compactIconLayout?: boolean;
}> = ({ item, onClick, isSelected, isEquipped, enhancementStars, isPresetEquipped, scaleFactor = 1, compactIconLayout = false }) => {
    const stars = enhancementStars || item.stars || 0;
    
    const renderStarDisplay = () => {
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

        const badgeShell =
            'absolute right-1.5 top-0.5 z-10 flex items-center gap-0.5 rounded-bl-md bg-black/45 px-1 py-0.5 backdrop-blur-[2px]';
        if (compactIconLayout) {
            return (
                <div className={badgeShell} style={{ textShadow: '1px 1px 2px black' }}>
                    <img src={starImage} alt="" className="h-3.5 w-3.5" />
                    <span className={`text-[13px] font-bold leading-none ${numberColor}`}>{stars}</span>
                </div>
            );
        }

        const starSize = Math.max(12, Math.round(12 * scaleFactor));
        const fontSize = Math.max(12, Math.round(12 * scaleFactor));

        return (
            <div className={badgeShell} style={{ textShadow: '1px 1px 2px black' }}>
                <img src={starImage} alt="" style={{ width: `${starSize}px`, height: `${starSize}px` }} />
                <span className={`font-bold leading-none ${numberColor}`} style={{ fontSize: `${fontSize}px` }}>
                    {stars}
                </span>
            </div>
        );
    };

    const isTranscendent = item.grade === ItemGrade.Transcendent;

    return (
        <div
            onClick={onClick}
            className={`relative aspect-square rounded-lg cursor-pointer transition-all duration-200 ${isSelected ? 'ring-2 ring-accent' : 'ring-1 ring-transparent'} hover:ring-2 hover:ring-accent/70 ${isTranscendent ? 'transcendent-grade-slot' : ''}`}
            title={item.name}
            style={{
                width: '100%',
                height: '100%',
                minWidth: 0,
                minHeight: 0,
                maxWidth: '100%',
                maxHeight: '100%',
                boxSizing: 'border-box',
                containerType: 'size',
            }}
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
                            className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-[min(4px,8%)] leading-none"
                            aria-hidden
                            style={{ fontSize: AP_CONSUMABLE_LIGHTNING_FONT_SIZE_CQ }}
                        >
                            <span className="leading-none">⚡</span>
                            {apValue && (
                                <span
                                    className="mt-0.5 max-w-full whitespace-nowrap font-bold leading-none text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,0.8)]"
                                    style={{ fontSize: AP_CONSUMABLE_PLUS_FONT_SIZE_CQ }}
                                >
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
                            width: compactIconLayout ? '74%' : '80%', 
                            height: compactIconLayout ? '74%' : '80%', 
                            padding: `${Math.max(compactIconLayout ? 3 : 4, Math.round((compactIconLayout ? 5 : 6) * scaleFactor))}px`, 
                            maxWidth: compactIconLayout ? '74%' : '80%', 
                            maxHeight: compactIconLayout ? '74%' : '80%', 
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
            {(() => {
                if (item.type !== 'consumable' && item.type !== 'material') return null;
                const stackQty = item.quantity ?? 1;
                const isTicket = isRefinementTicketMaterial(item.name);
                if (!isTicket && stackQty <= 1) return null;
                if (isTicket && stackQty < 1) return null;
                return (
                    <div
                        className="absolute bg-black/70 text-white font-bold rounded border border-white/30"
                        style={{
                            bottom: `${Math.max(2, Math.round(2 * scaleFactor))}px`,
                            right: `${Math.max(2, Math.round(2 * scaleFactor))}px`,
                            fontSize: `${Math.max(8, Math.round(10 * scaleFactor))}px`,
                            padding: `${Math.max(2, Math.round(4 * scaleFactor))}px ${Math.max(3, Math.round(4 * scaleFactor))}px`,
                        }}
                    >
                        {stackQty}
                    </div>
                );
            })()}
        </div>
    );
};



export default InventoryModal;