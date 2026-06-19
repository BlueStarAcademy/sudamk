import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocalizedItemGrade, useLocalizedEquipmentSlot } from '../../shared/i18n/localizedCatalog.js';
import { useTranslation } from 'react-i18next';
import { UserWithStatus, InventoryItem, ServerAction, ItemOption, CoreStat, SpecialStat, MythicStat, ItemGrade } from '../../types.js';
import Button from '../Button.js';
import { MAIN_STAT_DEFINITIONS, SUB_OPTION_POOLS, SPECIAL_STATS_DATA, MYTHIC_STATS_DATA, GRADE_SUB_OPTION_RULES, GRADE_LEVEL_REQUIREMENTS, formatEquipLevelRequirement, MATERIAL_ITEMS, CORE_STATS_DATA, MAIN_ENHANCEMENT_STEP_MULTIPLIER, resolveCombatSubPoolDefinition } from '../../constants';
import {
    resolveCombatSubValueRefinementRange,
    resolveSpecialSubValueRefinementRange,
} from '../../shared/utils/refinementValueBounds.js';
import {
    milestoneTierCountFromStars,
    computeSpecialSubRollBoundsAfterMilestones,
    formatSpecialSubLineForPanel,
} from '../../shared/utils/specialStatMilestones.js';
import { partitionMythicSubsWithIndex } from '../../shared/utils/specialOptionGearEffects.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { calculateRefinementGoldCost } from '../../constants/rules.js';
import { MythicOptionAbbrev, MythicStatAbbrev } from '../MythicStatAbbrev.js';
import { PortalHoverBubble } from '../PortalHoverBubble.js';
import RefinementResultModal from './RefinementResultModal.js';
import { formatGoldAmountKoG } from '../../shared/utils/walletAmountDisplay.js';
import { getBlacksmithViewerTypography, BLACKSMITH_MOBILE_WORK_ROOT_CLASS } from '../../shared/constants/blacksmithViewerTypography.js';

const REFINEMENT_TICKET_DEFS: { id: 'type' | 'value' | 'mythic'; itemKey: keyof typeof MATERIAL_ITEMS }[] = [
    { id: 'type', itemKey: '옵션 종류 변경권' },
    { id: 'value', itemKey: '옵션 수치 변경권' },
    { id: 'mythic', itemKey: '스페셜 옵션 변경권' },
];
const REFINEMENT_CHARM_ITEM_KEY = '제련의 부적' as const;

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

const gradeStyles: Record<ItemGrade, { color: string; background: string; }> = {
    normal: { color: 'text-gray-300', background: '/images/equipments/normalbgi.webp' },
    uncommon: { color: 'text-green-400', background: '/images/equipments/uncommonbgi.webp' },
    rare: { color: 'text-blue-400', background: '/images/equipments/rarebgi.webp' },
    epic: { color: 'text-purple-400', background: '/images/equipments/epicbgi.webp' },
    legendary: { color: 'text-red-500', background: '/images/equipments/legendarybgi.webp' },
    mythic: { color: 'text-orange-400', background: '/images/equipments/mythicbgi.webp' },
    transcendent: { color: 'text-cyan-300', background: '/images/equipments/transcendentbgi.webp' },
};

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

    return (
        <div
            className="absolute right-1.5 top-0.5 z-10 flex items-center gap-0.5 rounded-bl-md bg-black/45 px-1 py-0.5 backdrop-blur-[2px]"
            style={{ textShadow: '1px 1px 2px black' }}
        >
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
    pcViewer?: boolean;
    mobileWork?: boolean;
}> = ({ item, selectedOption, onOptionClick, pcViewer = false, mobileWork = false }) => {
    const { t } = useTranslation('blacksmith');
    const { currentUserWithStatus } = useAppContext();
    const styles = gradeStyles[item.grade];
    const typo = getBlacksmithViewerTypography(pcViewer, { mobileWork });

    const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
    const userLevelSum = currentUserWithStatus?.userLevel ?? 0;
    const canEquip = userLevelSum >= requiredLevel;

    if (!item.options) return null;

    const { main, combatSubs, specialSubs, mythicSubs } = item.options;
    const { mythicGradeRows, transcendentGradeRows } = partitionMythicSubsWithIndex(mythicSubs);

    return (
        <div className="flex h-full min-h-0 w-full flex-col p-1">
            {/* Top section: Image and Name/Main Option */}
            <div className="mb-1.5 flex shrink-0">
                <div className={`relative mr-2 h-16 w-16 flex-shrink-0 rounded-lg ${item.grade === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''}`}>
                    <img src={styles.background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                    {item.image && <img src={item.image} alt={item.name} className="absolute object-contain p-1" style={{ width: '80%', height: '80%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />}
                    {renderStarDisplay(item.stars)}
                </div>
                <div className="min-w-0 flex-grow pt-0.5">
                    <h3 className={`${typo.headingLg} leading-snug whitespace-nowrap overflow-hidden text-ellipsis ${styles.color}`} title={item.name}>
                        {item.name}
                    </h3>
                    <p className={`${typo.body} ${canEquip ? 'text-gray-500' : 'text-red-500'}`}>
                        ({formatEquipLevelRequirement(requiredLevel)})
                    </p>
                    <p className={`${typo.bodySemi} ${(item as any).refinementCount > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                        {t('refine.refinementCountLine', { value: (item as any).refinementCount > 0 ? t('refine.countTimes', { count: (item as any).refinementCount }) : t('refine.refinementUnavailableShort') })}
                    </p>
                </div>
            </div>
            {/* Bottom section: Clickable options */}
            <div className={`min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden rounded-lg bg-black/30 p-1.5 text-left ${typo.body} [scrollbar-gutter:stable]`}>
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
                        특{idx + 1}: {formatSpecialSubLineForPanel(sub, item.stars ?? 0)}
                    </button>
                ))}
                {/* Mythic / Transcendent 스페셜 — 원본 mythicSubs 인덱스 유지 */}
                {mythicGradeRows.length > 0 ? (
                    <p className={`px-1 pt-0.5 ${typo.caption} font-semibold text-rose-200/85`}>{t('refine.mythicSpecial')}</p>
                ) : null}
                {mythicGradeRows.map(({ sub, index: idx }) => (
                    <button
                        key={`m-${idx}`}
                        onClick={() => onOptionClick('mythicSub', idx)}
                        className={`w-full text-left p-1 rounded transition-all ${
                            selectedOption?.type === 'mythicSub' && selectedOption.index === idx
                                ? 'bg-blue-600/70 text-white font-semibold'
                                : 'hover:bg-gray-700/50 text-red-400'
                        }`}
                    >
                        <span className="inline-flex min-w-0 flex-wrap items-center gap-0.5">
                            신{idx + 1}:{' '}
                            <MythicOptionAbbrev option={sub} textClassName="text-red-400" bubbleSide="right" />
                        </span>
                    </button>
                ))}
                {transcendentGradeRows.length > 0 ? (
                    <p className={`px-1 pt-1 ${typo.caption} font-semibold text-cyan-200/85`}>{t('refine.transcendentSpecial')}</p>
                ) : null}
                {transcendentGradeRows.map(({ sub, index: idx }) => (
                    <button
                        key={`t-${idx}`}
                        onClick={() => onOptionClick('mythicSub', idx)}
                        className={`w-full text-left p-1 rounded transition-all ${
                            selectedOption?.type === 'mythicSub' && selectedOption.index === idx
                                ? 'bg-blue-600/70 text-white font-semibold'
                                : 'hover:bg-gray-700/50 text-cyan-300'
                        }`}
                    >
                        <span className="inline-flex min-w-0 flex-wrap items-center gap-0.5">
                            신{idx + 1}:{' '}
                            <MythicOptionAbbrev option={sub} textClassName="text-cyan-300" bubbleSide="right" />
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
    stackedViewport?: boolean;
}

type RefinementType = 'type' | 'value' | 'mythic';

const RefinementView: React.FC<RefinementViewProps> = ({
    selectedItem,
    currentUser,
    onAction,
    refinementResult,
    onResultConfirm,
    stackedViewport = false,
}) => {
    const { t } = useTranslation('blacksmith');
    const localizedGrade = useLocalizedItemGrade();
    const pcViewer = !stackedViewport;
    const typo = getBlacksmithViewerTypography(pcViewer, { mobileWork: stackedViewport });
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
            case ItemGrade.Mythic:
            case ItemGrade.Transcendent:
                return 5;
            default: return 1;
        }
    };

    // 보유한 변경권 개수
    const ticketCounts = useMemo(() => {
        if (!currentUser) return { type: 0, value: 0, mythic: 0, charm: 0 };
        const inventory = currentUser.inventory || [];
        const countByName = (n: string) =>
            inventory
                .filter(i => i.name === n && (i.type === 'material' || i.type === 'consumable'))
                .reduce((sum, i) => sum + (i.quantity || 0), 0);
        return {
            type: countByName('옵션 종류 변경권'),
            value: countByName('옵션 수치 변경권'),
            mythic: countByName('스페셜 옵션 변경권') + countByName('신화 옵션 변경권'),
            charm: countByName(REFINEMENT_CHARM_ITEM_KEY),
        };
    }, [currentUser]);
    const refinementCharmInfo = MATERIAL_ITEMS[REFINEMENT_CHARM_ITEM_KEY];

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
                const stars = selectedItem.stars ?? 0;
                const multipliers = MAIN_ENHANCEMENT_STEP_MULTIPLIER[grade];
                const baseValue = gradeDef.value;
                let enhancedIncreaseTotal = 0;
                for (let i = 0; i < stars; i++) {
                    const idx = Math.max(0, Math.min(9, i));
                    enhancedIncreaseTotal += Math.round(baseValue * (multipliers?.[idx] ?? 1));
                }
                const valueAtStars = parseFloat((baseValue + enhancedIncreaseTotal).toFixed(2));
                return gradeDef.stats.filter(stat => stat !== selectedOptionData.type).map(stat => ({
                    type: stat,
                    name: CORE_STATS_DATA[stat].name,
                    range: null,
                    isPercentage: slotDef.isPercentage,
                    valueAtCurrentEnhancement: valueAtStars,
                }));
            } else if (selectedOption.type === 'combatSub') {
                const rules = GRADE_SUB_OPTION_RULES[grade];
                const combatTier = rules.combatTier;
                const pool = SUB_OPTION_POOLS[slot][combatTier];
                const usedTypes = new Set(selectedItem.options!.combatSubs.map(s => s.type));
                usedTypes.add(selectedItem.options!.main.type);
                const prevEnh =
                    selectedItem.options!.combatSubs[selectedOption.index]?.enhancements ?? 0;
                return pool.filter(opt => !usedTypes.has(opt.type)).map(opt => {
                    const [r0, r1] = opt.range;
                    const scaledMin = Math.round(r0 * (1 + prevEnh));
                    const scaledMax = Math.round(r1 * (1 + prevEnh));
                    return {
                        type: opt.type,
                        name: CORE_STATS_DATA[opt.type].name,
                        range: [scaledMin, scaledMax] as [number, number],
                        isPercentage: opt.isPercentage,
                    };
                });
            } else if (selectedOption.type === 'specialSub') {
                const allSpecialStats = Object.values(SpecialStat);
                const usedTypes = new Set(selectedItem.options!.specialSubs.map(s => s.type));
                const milestones = milestoneTierCountFromStars(selectedItem.stars ?? 0);
                return allSpecialStats.filter(stat => !usedTypes.has(stat)).map(stat => {
                    const [r0, r1] = SPECIAL_STATS_DATA[stat].range;
                    const [scaledMin, scaledMax] = computeSpecialSubRollBoundsAfterMilestones(
                        [r0, r1],
                        stat,
                        milestones
                    );
                    return {
                        type: stat,
                        name: SPECIAL_STATS_DATA[stat].name,
                        range: [scaledMin, scaledMax] as [number, number],
                        isPercentage: SPECIAL_STATS_DATA[stat].isPercentage,
                    };
                });
            }
        } else if (refinementType === 'value') {
            if (
                (selectedOption.type === 'combatSub' || selectedOption.type === 'specialSub') &&
                selectedItem.slot &&
                selectedOptionData
            ) {
                if (selectedOption.type === 'combatSub') {
                    const rules = GRADE_SUB_OPTION_RULES[grade];
                    const pool = SUB_OPTION_POOLS[slot][rules.combatTier];
                    const subDef = resolveCombatSubPoolDefinition(
                        pool,
                        selectedOptionData.type as CoreStat,
                        selectedOptionData.isPercentage
                    );
                    if (subDef) {
                        const stored: [number, number] = selectedOptionData.range
                            ? [Number(selectedOptionData.range[0]), Number(selectedOptionData.range[1])]
                            : [subDef.range[0], subDef.range[1]];
                        const repaired = resolveCombatSubValueRefinementRange(
                            stored,
                            subDef,
                            selectedOptionData.enhancements ?? 0
                        );
                        if (repaired) {
                            return [
                                {
                                    type: selectedOptionData.type,
                                    name: CORE_STATS_DATA[selectedOptionData.type as CoreStat].name,
                                    range: repaired,
                                    isPercentage: selectedOptionData.isPercentage,
                                },
                            ];
                        }
                    }
                } else {
                    const subDef = SPECIAL_STATS_DATA[selectedOptionData.type as SpecialStat];
                    const stored: [number, number] = selectedOptionData.range
                        ? [Number(selectedOptionData.range[0]), Number(selectedOptionData.range[1])]
                        : [subDef.range[0], subDef.range[1]];
                    const repaired = resolveSpecialSubValueRefinementRange(
                        stored,
                        subDef,
                        selectedOptionData.enhancements ?? 0,
                        selectedOptionData.type as SpecialStat
                    );
                    if (repaired) {
                        return [
                            {
                                type: selectedOptionData.type,
                                name: subDef.name,
                                range: repaired,
                                isPercentage: subDef.isPercentage,
                            },
                        ];
                    }
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
                  : '스페셜 옵션 변경권';
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
    const handleUseRefinementCharm = async () => {
        if (!selectedItem || ticketCounts.charm <= 0) return;
        const charmItem = (currentUser.inventory || []).find(
            (item) => item.name === REFINEMENT_CHARM_ITEM_KEY && item.type === 'material' && (item.quantity || 0) > 0,
        );
        if (!charmItem) return;
        await onAction({
            type: 'USE_ITEM',
            payload: {
                itemId: charmItem.id,
                itemName: charmItem.name,
                quantity: 1,
                targetEquipmentId: selectedItem.id,
            },
        });
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
            <div className={`flex items-center justify-center h-full text-gray-400 ${typo.empty}`}>
                장비를 선택해주세요.
            </div>
        );
    }

    if (!selectedItem.options) {
        return (
            <div className={`flex items-center justify-center h-full text-gray-400 ${typo.empty}`}>
                옵션이 없는 장비입니다.
            </div>
        );
    }

    if (!canRefineAtAll) {
        return (
            <div className={`flex items-center justify-center h-full text-gray-400 ${typo.empty}`}>
                일반 등급 장비는 제련할 수 없습니다.
            </div>
        );
    }

    const refinementExhausted = refinementCount <= 0;

    const ownedTicketBar = (
        <div
            className="mt-2 shrink-0 border-t border-white/15 pt-1.5"
            role="group"
            aria-label={t('refine.charmsAria')}
        >
            <div className="flex items-end justify-between gap-1">
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
                <RefinementOwnedTicketSlot
                    id="charm"
                    name={refinementCharmInfo.name}
                    description={refinementCharmInfo.description}
                    image={refinementCharmInfo.image}
                    count={ticketCounts.charm}
                />
            </div>
        </div>
    );

    const refinementActionFooter =
        selectedOption && !refinementExhausted ? (
            <div className="mt-2 shrink-0 space-y-2 border-t border-white/10 pt-2">
                <div className="rounded border border-white/10 bg-black/35 p-1.5">
                    <div className={`mb-1 text-gray-400 ${typo.caption}`}>{t('refine.requiredMaterials')}</div>
                    {refinementType && ticketItemInfo ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <div
                                className="flex items-center gap-1 rounded bg-gray-800/50 p-1"
                                title={`${ticketItemInfo.name}\n${ticketItemInfo.description}`}
                            >
                                <img
                                    src={ticketItemInfo.image}
                                    alt={ticketItemInfo.name}
                                    className="h-6 w-6 object-contain"
                                />
                                <span
                                    className={`whitespace-nowrap ${typo.body} ${
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
                            <div className="flex items-center gap-1 rounded bg-gray-800/50 p-1">
                                <img src="/images/icon/Gold.webp" alt={t('gold', { ns: 'common' })} className="h-6 w-6 object-contain" />
                                <span className={`${typo.body} ${currentUser.gold >= requiredGold ? 'text-white' : 'text-red-400'}`}>
                                    {formatGoldAmountKoG(requiredGold)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <p className={`${typo.caption} text-slate-400`}>{t('refine.selectMethodHint')}</p>
                    )}
                </div>

                <button
                    onClick={handleRefine}
                    disabled={!canRefine || isRefining}
                    className={`group relative mx-auto block w-full min-w-0 rounded-lg px-2.5 py-2.5 font-bold transition-all duration-300 overflow-hidden ${typo.bodySemi} ${
                        canRefine && !isRefining
                            ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white shadow-[0_0_14px_rgba(251,146,60,0.55)] hover:shadow-[0_0_20px_rgba(251,146,60,0.75)]'
                            : 'cursor-not-allowed bg-gray-700 text-gray-400 opacity-50'
                    }`}
                >
                    <div className="absolute inset-0 translate-x-[-200%] transform bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 transition-opacity duration-500 group-hover:translate-x-[200%] group-hover:opacity-100" />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        <span className="text-base">⚒️</span>
                        <span>{t('refine.refineBtn')}</span>
                    </span>
                </button>

                {isRefining ? (
                    <div>
                        <div className={`mb-1 flex items-center justify-between ${typo.caption} text-cyan-200/90`}>
                            <span className="font-semibold">{t('refine.progressLabel')}</span>
                            <span className="font-mono tabular-nums">{Math.max(0, Math.min(100, refinementProgress))}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-700/90">
                            <div
                                className="h-2 rounded-full bg-blue-600 transition-all duration-100"
                                style={{ width: `${refinementProgress}%` }}
                            />
                        </div>
                    </div>
                ) : null}
            </div>
        ) : null;

    const handleBackToEquipmentStep = () => {
        setSelectedOption(null);
        setRefinementType(null);
    };

    const mobileStepIndicator = stackedViewport ? (
        <div className={`mb-2 flex shrink-0 items-center justify-center gap-2 ${typo.caption} font-bold`}>
            <span
                className={`rounded-full px-2 py-0.5 ${
                    !selectedOption ? 'bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/40' : 'text-slate-500'
                }`}
            >
                {t('refine.stepSelectOption')}
            </span>
            <span className="text-slate-600" aria-hidden>
                ›
            </span>
            <span
                className={`rounded-full px-2 py-0.5 ${
                    selectedOption ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/35' : 'text-slate-500'
                }`}
            >
                {t('refine.stepRefineInfo')}
            </span>
        </div>
    ) : null;

    const refinementExhaustedPanel = (
        <div className={`flex min-h-0 flex-1 flex-col justify-center gap-2 rounded-lg bg-gray-900/40 p-3 text-amber-200/95 ${typo.body}`}>
            <p className="font-semibold leading-snug">{t('refine.countDepleted')}</p>
            <p className={`${typo.caption} leading-relaxed text-gray-400`}>
                {t('refine.charmUsageHint')}
            </p>
            <div className="mt-1 flex items-center justify-between gap-2 rounded border border-amber-500/30 bg-black/30 px-2 py-1.5">
                <div className="flex items-center gap-2">
                    <img src={refinementCharmInfo.image} alt={refinementCharmInfo.name} className="h-7 w-7 object-contain" />
                    <div className={`${typo.body} leading-tight`}>
                        <p className="font-semibold text-amber-100">{refinementCharmInfo.name}</p>
                        <p className="text-gray-300">{t('refine.ownedCharms', { count: ticketCounts.charm })}</p>
                    </div>
                </div>
                <Button
                    onClick={() => void handleUseRefinementCharm()}
                    disabled={ticketCounts.charm <= 0}
                    className="!px-3 !py-1.5 !text-xs !font-semibold"
                >
                    사용하기
                </Button>
            </div>
        </div>
    );

    const refinementInfoBody = selectedOption ? (
        <div className={`flex min-h-0 flex-1 flex-col gap-2 ${typo.body}`}>
            <div className="shrink-0 rounded border border-white/10 bg-black/35 p-1.5">
                <div className={`mb-0.5 text-gray-400 ${typo.caption}`}>{t('refine.selectedOptionLabel')}</div>
                <div className="font-semibold text-yellow-300">
                    {selectedOption?.type === 'mythicSub' && selectedOptionData ? (
                        <MythicOptionAbbrev option={selectedOptionData} textClassName="text-yellow-300 font-semibold" />
                    ) : (
                        selectedOptionData?.display || 'N/A'
                    )}
                </div>
            </div>

            <div
                className={`grid w-full min-w-0 shrink-0 gap-1.5 ${
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
                            className={`group relative min-w-0 w-full overflow-hidden rounded-lg px-1.5 py-2 ${typo.bodySemi} font-bold transition-all duration-300 ${
                                refinementType === 'type'
                                    ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white shadow-[0_0_16px_rgba(168,85,247,0.55)] ring-1 ring-white/30'
                                    : 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 hover:from-gray-600 hover:to-gray-700 hover:shadow-lg'
                            }`}
                        >
                            <div className="absolute inset-0 translate-x-[-200%] transform bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:translate-x-[200%] group-hover:opacity-100" />
                            <span className="relative z-10 flex items-center justify-center gap-0.5 sm:gap-1">
                                <span className="shrink-0 text-xs sm:text-sm">🔄</span>
                                <span className="truncate">{t('refine.typeChangeShort')}</span>
                            </span>
                        </button>
                        {(selectedOption.type === 'combatSub' || selectedOption.type === 'specialSub') && (
                            <button
                                onClick={() => setRefinementType('value')}
                                className={`group relative min-w-0 w-full overflow-hidden rounded-lg px-1.5 py-2 ${typo.bodySemi} font-bold transition-all duration-300 ${
                                    refinementType === 'value'
                                        ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-[0_0_16px_rgba(20,184,166,0.55)] ring-1 ring-white/30'
                                        : 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 hover:from-gray-600 hover:to-gray-700 hover:shadow-lg'
                                }`}
                            >
                                <div className="absolute inset-0 translate-x-[-200%] transform bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:translate-x-[200%] group-hover:opacity-100" />
                                <span className="relative z-10 flex items-center justify-center gap-0.5 sm:gap-1">
                                    <span className="shrink-0 text-xs sm:text-sm">📊</span>
                                    <span className="truncate">{t('refine.valueChangeShort')}</span>
                                </span>
                            </button>
                        )}
                    </>
                )}
                {selectedOption.type === 'mythicSub' && (
                    <button
                        onClick={() => setRefinementType('mythic')}
                        className={`group relative min-w-0 w-full overflow-hidden rounded-lg px-1.5 py-2 ${typo.bodySemi} font-bold transition-all duration-300 ${
                            refinementType === 'mythic'
                                ? 'bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white shadow-[0_0_16px_rgba(249,115,22,0.55)] ring-1 ring-white/30'
                                : 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 hover:from-gray-600 hover:to-gray-700 hover:shadow-lg'
                        }`}
                    >
                        <div className="absolute inset-0 translate-x-[-200%] transform bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:translate-x-[200%] group-hover:opacity-100" />
                        <span className="relative z-10 flex items-center justify-center gap-0.5 sm:gap-1">
                            <span className="shrink-0 text-xs sm:text-sm">✨</span>
                            <span className="truncate">{t('refine.specialChangeShort')}</span>
                        </span>
                    </button>
                )}
            </div>

            {refinementType ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-white/10 bg-black/35 p-1.5">
                    <div className={`mb-1 shrink-0 text-gray-400 ${typo.caption}`}>
                        {refinementType === 'value' ? t('refine.changeableRange', { kind: t('refine.valueChangeShort') }) : t('refine.changeableRange', { kind: t('refine.optionChange') })}
                    </div>
                    <div className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${typo.body} space-y-0.5 [scrollbar-gutter:stable]`}>
                        {availableOptions.length > 0 ? (
                            availableOptions.map((opt, idx) => (
                                <div key={idx} className="text-green-300">
                                    {refinementType === 'mythic' ? (
                                        <MythicStatAbbrev stat={opt.type as MythicStat} textClassName="text-green-300" bubbleSide="right" />
                                    ) : (
                                        <>
                                            {opt.name}
                                            {(opt as { valueAtCurrentEnhancement?: number }).valueAtCurrentEnhancement != null && (
                                                <span className="text-yellow-300">
                                                    {' '}+{((opt as { valueAtCurrentEnhancement?: number }).valueAtCurrentEnhancement)}
                                                    {opt.isPercentage ? '%' : ''}
                                                </span>
                                            )}
                                            {opt.range && (
                                                <span className="text-yellow-300">
                                                    {' '}
                                                    {opt.range[0]}~{opt.range[1]}
                                                    {opt.isPercentage ? '%' : ''}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-red-400">{t('refine.noChangeable')}</div>
                        )}
                    </div>
                </div>
            ) : (
                <div className={`flex min-h-0 flex-1 items-center justify-center rounded border border-dashed border-white/10 bg-black/20 px-2 text-center text-slate-500 ${typo.caption}`}>
                    {t('refine.selectMethodEmpty')}
                </div>
            )}
        </div>
    ) : (
        <div className={`flex flex-1 items-center justify-center py-4 text-center text-gray-500 ${typo.body}`}>
            {stackedViewport ? t('refine.selectOptionMobile') : t('refine.selectOptionDesktop')}
        </div>
    );

    const equipmentPanel = (
        <div
            className={`flex min-h-0 min-w-0 flex-col rounded-lg border border-amber-400/20 bg-gradient-to-b from-[#181d2a]/80 via-[#111623]/90 to-[#0b1018]/95 p-2 ${
                stackedViewport ? 'min-h-0 flex-1 overflow-hidden' : 'min-h-0'
            }`}
        >
            <h3 className={`mb-1 shrink-0 text-center ${typo.heading} text-amber-100`}>{t('refine.selectedGearShort')}</h3>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {refinementExhausted ? (
                    refinementExhaustedPanel
                ) : (
                    <>
                        <ItemDisplay
                            item={selectedItem}
                            selectedOption={selectedOption}
                            pcViewer={pcViewer}
                            mobileWork={stackedViewport}
                            onOptionClick={(type, index) => {
                                setSelectedOption({ type, index });
                                setRefinementType(null);
                            }}
                        />
                        {stackedViewport && !selectedOption ? (
                            <p className={`mt-2 shrink-0 px-2 text-center ${typo.caption} text-slate-400`}>
                                제련할 옵션을 탭하면 제련 정보 화면으로 이동합니다.
                            </p>
                        ) : null}
                    </>
                )}
            </div>
            {ownedTicketBar}
        </div>
    );

    const refinementPanel = (
        <div
            className={`flex min-h-0 min-w-0 flex-col rounded-lg border border-amber-400/20 bg-gradient-to-b from-[#181d2a]/80 via-[#111623]/90 to-[#0b1018]/95 p-2 ${
                stackedViewport ? 'min-h-0 flex-1 overflow-hidden' : 'min-h-0'
            }`}
        >
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                <h3 className={`flex-1 text-center ${typo.heading} text-amber-100`}>{t('refine.refineInfoTitle')}</h3>
                {stackedViewport && selectedOption ? (
                    <button
                        type="button"
                        onClick={handleBackToEquipmentStep}
                        className="rounded border border-slate-500/60 bg-slate-800/70 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:border-cyan-400/50"
                    >
                        ← 옵션 선택
                    </button>
                ) : null}
                {!stackedViewport && selectedOption ? (
                    <button
                        type="button"
                        onClick={handleBackToEquipmentStep}
                        className="rounded border border-slate-500/60 bg-slate-800/70 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:border-cyan-400/50"
                    >
                        초기화
                    </button>
                ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {refinementExhausted ? refinementExhaustedPanel : refinementInfoBody}
                </div>
                {refinementActionFooter}
            </div>
        </div>
    );

    return (
        <div className={`flex h-full min-h-0 flex-col p-2 ${stackedViewport ? 'min-h-[min(72dvh,100%)]' : ''}`}>
            {mobileStepIndicator}
            {stackedViewport ? (
                <div className={`${BLACKSMITH_MOBILE_WORK_ROOT_CLASS} min-h-0 flex-1`}>
                    {!selectedOption || refinementExhausted ? equipmentPanel : refinementPanel}
                </div>
            ) : (
                <div className="grid min-h-0 min-w-0 flex-1 grid-cols-2 gap-3">
                    {equipmentPanel}
                    {refinementPanel}
                </div>
            )}
            <RefinementResultModal
                result={refinementResult}
                onClose={onResultConfirm}
                isTopmost
            />
        </div>
    );
};

export default RefinementView;
