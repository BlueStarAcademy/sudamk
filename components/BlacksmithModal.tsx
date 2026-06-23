import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from './DraggableWindow.js';
import EnhancementView from './blacksmith/EnhancementView.js';
import CombinationView from './blacksmith/CombinationView.js';
import DisassemblyView, {
    applyDisassemblyAutoSelectByGrades,
    DisassemblyAutoSelectModal,
} from './blacksmith/DisassemblyView.js';
import ConversionView from './blacksmith/ConversionView.js';
import RefinementView from './blacksmith/RefinementView.js';
import InventoryGrid from './blacksmith/InventoryGrid.js';
import BlacksmithEquipmentPickerModal from './blacksmith/BlacksmithEquipmentPickerModal.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { BLACKSMITH_MAX_LEVEL, BLACKSMITH_COMBINABLE_GRADES_BY_LEVEL, BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP } from '../constants/rules';
import { InventoryItem, EnhancementResult, ServerAction } from '../types.js';
import { ItemGrade } from '../types/enums.js';
import BlacksmithLevelEffectsSummary from './blacksmith/BlacksmithLevelEffectsSummary.js';
import { isFunctionVipActive } from '../shared/utils/rewardVip.js';
import { isPairArenaExclusiveBagItem } from '../shared/constants/petLobby.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';
import { MIN_ACTION_FEEDBACK_MS } from '../shared/constants/uiFeedback.js';
import { BLACKSMITH_MOBILE_WORK_ROOT_CLASS } from '../shared/constants/blacksmithViewerTypography.js';

const GRADE_ORDER: ItemGrade[] = [
    ItemGrade.Normal,
    ItemGrade.Uncommon,
    ItemGrade.Rare,
    ItemGrade.Epic,
    ItemGrade.Legendary,
    ItemGrade.Mythic,
    ItemGrade.Transcendent,
];

function collectPresetEquipmentIds(
    equipmentPresets: { equipment?: Record<string, string | null | undefined> }[] | undefined
): Set<string> {
    const ids = new Set<string>();
    if (!equipmentPresets) return ids;
    equipmentPresets.forEach(preset => {
        if (preset.equipment) {
            Object.values(preset.equipment).forEach(itemId => {
                if (itemId) ids.add(itemId);
            });
        }
    });
    return ids;
}

function getCombineDisabledItemIds(
    inventory: InventoryItem[],
    combinationItems: (InventoryItem | null)[],
    maxCombinableGradeIndex: number
): string[] {
    const firstItemGrade = combinationItems.find(item => item !== null)?.grade;
    const combinationItemIds = combinationItems.map(i => i?.id).filter(Boolean) as string[];
    return inventory
        .filter(item => {
            if (item.type !== 'equipment' || item.isExchangeListed) return false;
            if (combinationItemIds.includes(item.id)) return true;
            if (item.isEquipped) return true;
            if (GRADE_ORDER.indexOf(item.grade) > maxCombinableGradeIndex) return true;
            if (firstItemGrade && item.grade !== firstItemGrade) return true;
            return false;
        })
        .map(item => item.id);
}

function getDisassembleDisabledItemIds(
    inventory: InventoryItem[],
    equipmentPresets: { equipment?: Record<string, string | null | undefined> }[] | undefined
): string[] {
    const presetItemIds = collectPresetEquipmentIds(equipmentPresets);
    return inventory
        .filter(item => {
            if (item.isEquipped) return true;
            if (presetItemIds.has(item.id)) return true;
            return false;
        })
        .map(item => item.id);
}

interface BlacksmithModalProps {
    onClose: () => void;
    isTopmost: boolean;
    selectedItemForEnhancement: InventoryItem | null;
    activeTab: 'enhance' | 'combine' | 'disassemble' | 'convert' | 'refine';
    onSetActiveTab: (tab: 'enhance' | 'combine' | 'disassemble' | 'convert' | 'refine') => void;
    enhancementOutcome: EnhancementResult | null;
    embedded?: boolean;
}

type SortOption = 'grade' | 'stars' | 'name' | 'date';

const BlacksmithModal: React.FC<BlacksmithModalProps> = ({
    onClose,
    isTopmost,
    selectedItemForEnhancement,
    activeTab,
    onSetActiveTab,
    enhancementOutcome,
    embedded = false,
}) => {
    const { t } = useTranslation('blacksmith');
    const { currentUserWithStatus, handlers, modals } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(selectedItemForEnhancement);
    const [combinationItems, setCombinationItems] = useState<(InventoryItem | null)[]>([null, null, null]);
    const [selectedForDisassembly, setSelectedForDisassembly] = useState<Set<string>>(new Set()); // New state
    const [sortOption, setSortOption] = useState<SortOption>('grade');
    const [disassemblyAutoSelectOpen, setDisassemblyAutoSelectOpen] = useState(false);
    const [isBlacksmithBusy, setIsBlacksmithBusy] = useState(false);
    const isBlacksmithBusyRef = useRef(false);

    // 좁은 가로 화면에서는 PC 레이아웃을 그대로 축소해서 사용
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    /** 넓은 태블릿 가로·소형 노트북에서도 PC 2열을 더 오래 유지(스택 전환을 늦춰 체감 크기 확보) */
    const isCompactViewport = windowWidth < 940;
    const useStackedBlacksmithLayout = isCompactViewport || isNativeMobile;

    if (!currentUserWithStatus) return null;

    useEffect(() => {
        if (selectedItemForEnhancement) {
            setSelectedItem(selectedItemForEnhancement);
        }
    }, [selectedItemForEnhancement]);

    useEffect(() => {
        setCombinationItems([null, null, null]);
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== 'disassemble') setDisassemblyAutoSelectOpen(false);
    }, [activeTab]);

    // Sync selected item with inventory (for enhancement updates) — paint 전에 맞춰 성공확률·실패 보너스가 바로 반영되게 함
    useLayoutEffect(() => {
        if (selectedItem && activeTab === 'enhance') {
            const updatedItem = currentUserWithStatus.inventory.find(invItem => invItem.id === selectedItem.id);
            if (updatedItem && (updatedItem.stars !== selectedItem.stars || updatedItem.enhancementFails !== selectedItem.enhancementFails)) {
                setSelectedItem(updatedItem);
            }
        }
    }, [currentUserWithStatus.inventory, selectedItem, activeTab]);

    /** HTTP 직후 인벤 반영 타이밍과 무관하게, 강화 결과 스냅샷으로 즉시 동기화 (실패 시 enhancementFails·VIP 보너스 표기) */
    useLayoutEffect(() => {
        if (activeTab !== 'enhance' || !enhancementOutcome || !selectedItem) return;
        const after = enhancementOutcome.itemAfter;
        if (!after || after.id !== selectedItem.id) return;
        setSelectedItem(after);
    }, [enhancementOutcome, activeTab, selectedItem?.id]);

    // Sync selected item with inventory (for refinement updates)
    useEffect(() => {
        if (selectedItem && activeTab === 'refine') {
            const updatedItem = currentUserWithStatus.inventory.find(invItem => invItem.id === selectedItem.id);
            if (updatedItem) {
                // 제련 후 옵션이 변경되었거나 제련 횟수가 변경되었으면 업데이트
                const refinementCountChanged = (updatedItem as any).refinementCount !== (selectedItem as any).refinementCount;
                const optionsChanged = JSON.stringify(updatedItem.options) !== JSON.stringify(selectedItem.options);
                if (refinementCountChanged || optionsChanged) {
                    setSelectedItem(updatedItem);
                }
            }
        }
    }, [currentUserWithStatus.inventory, selectedItem, activeTab]);

    // 제련 결과 확인 후 selectedItem 업데이트
    useEffect(() => {
        if (modals.refinementResult && modals.refinementResult.success && selectedItem && activeTab === 'refine') {
            // 제련 결과의 itemAfter로 selectedItem 업데이트
            if (modals.refinementResult.itemAfter.id === selectedItem.id) {
                setSelectedItem(modals.refinementResult.itemAfter);
            }
        }
    }, [modals.refinementResult, selectedItem, activeTab]);

    // Sync combination items with inventory
    useEffect(() => {
        if (activeTab === 'combine') {
            setCombinationItems(prevItems => {
                const updatedItems = prevItems.map(item => {
                    if (!item) return null;
                    // Set to null if the item no longer exists in the main inventory
                    return currentUserWithStatus.inventory.find(invItem => invItem.id === item.id) || null;
                });
                return updatedItems;
            });
        }
    }, [currentUserWithStatus.inventory, activeTab]);

    // Sync disassembly selection with inventory (remove items that no longer exist)
    useEffect(() => {
        if (activeTab === 'disassemble') {
            setSelectedForDisassembly(prev => {
                const newSet = new Set<string>();
                prev.forEach(itemId => {
                    // Only keep items that still exist in inventory
                    if (currentUserWithStatus.inventory.find(item => item.id === itemId)) {
                        newSet.add(itemId);
                    }
                });
                return newSet;
            });
        }
    }, [currentUserWithStatus.inventory, activeTab]);

    const handleSelectItem = useCallback((item: InventoryItem) => {
        if (activeTab === 'combine') {
            const emptyIndex = combinationItems.findIndex(i => i === null);
            if (emptyIndex !== -1) {
                const newItems = [...combinationItems];
                newItems[emptyIndex] = item;
                setCombinationItems(newItems);
            }
        } else {
            setSelectedItem(item);
        }
    }, [activeTab, combinationItems]);

    const handleToggleDisassemblySelection = useCallback((itemId: string) => {
        setSelectedForDisassembly(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    }, []);

    const { blacksmithLevel, blacksmithXp, inventory, inventorySlots } = currentUserWithStatus;
    const vipBonus = isFunctionVipActive(currentUserWithStatus) ? 10 : 0;

    const currentLevel = blacksmithLevel ?? 1;
    const isMaxLevel = currentLevel >= BLACKSMITH_MAX_LEVEL;
    const currentLevelIndex = currentLevel - 1;

    const maxCombinableGrade = BLACKSMITH_COMBINABLE_GRADES_BY_LEVEL[currentLevelIndex];
    const maxCombinableGradeIndex = GRADE_ORDER.indexOf(maxCombinableGrade);

    const disabledItemIds = useMemo(() => {
        if (activeTab === 'combine') {
            return getCombineDisabledItemIds(inventory, combinationItems, maxCombinableGradeIndex);
        }
        if (activeTab === 'disassemble') {
            return getDisassembleDisabledItemIds(inventory, currentUserWithStatus.equipmentPresets);
        }
        return [];
    }, [activeTab, inventory, combinationItems, maxCombinableGradeIndex, currentUserWithStatus.equipmentPresets]);

    const [equipmentPickerOpen, setEquipmentPickerOpen] = useState(false);
    const [pickerSingle, setPickerSingle] = useState<InventoryItem | null>(null);
    const [pickerCombine, setPickerCombine] = useState<(InventoryItem | null)[]>([null, null, null]);
    const [pickerDisassemble, setPickerDisassemble] = useState<Set<string>>(new Set());

    const pickerDisabledItemIds = useMemo(() => {
        if (!equipmentPickerOpen) return [];
        if (activeTab === 'combine') {
            return getCombineDisabledItemIds(inventory, pickerCombine, maxCombinableGradeIndex);
        }
        if (activeTab === 'disassemble') {
            return getDisassembleDisabledItemIds(inventory, currentUserWithStatus.equipmentPresets);
        }
        return [];
    }, [
        equipmentPickerOpen,
        activeTab,
        inventory,
        pickerCombine,
        maxCombinableGradeIndex,
        currentUserWithStatus.equipmentPresets,
    ]);

    const mobileShowEquipmentWorkPanel = useMemo(() => {
        if (!useStackedBlacksmithLayout) return true;
        if (activeTab === 'convert') return true;
        if (activeTab === 'enhance' || activeTab === 'refine') return selectedItem !== null;
        if (activeTab === 'combine') return combinationItems.every(i => i !== null);
        if (activeTab === 'disassemble') return selectedForDisassembly.size > 0;
        return true;
    }, [
        useStackedBlacksmithLayout,
        activeTab,
        selectedItem,
        combinationItems,
        selectedForDisassembly,
    ]);

    const isMobileEquipmentTab =
        activeTab === 'enhance' ||
        activeTab === 'combine' ||
        activeTab === 'disassemble' ||
        activeTab === 'refine';

    const openEquipmentPicker = useCallback(() => {
        if (activeTab === 'enhance' || activeTab === 'refine') {
            setPickerSingle(selectedItem);
        } else if (activeTab === 'combine') {
            setPickerCombine([...combinationItems]);
        } else if (activeTab === 'disassemble') {
            setPickerDisassemble(new Set(selectedForDisassembly));
        }
        setEquipmentPickerOpen(true);
    }, [activeTab, selectedItem, combinationItems, selectedForDisassembly]);

    const handlePickerConfirm = useCallback(() => {
        if (activeTab === 'enhance' || activeTab === 'refine') {
            if (pickerSingle) setSelectedItem(pickerSingle);
        } else if (activeTab === 'combine') {
            setCombinationItems([...pickerCombine]);
        } else if (activeTab === 'disassemble') {
            setSelectedForDisassembly(new Set(pickerDisassemble));
        }
        setEquipmentPickerOpen(false);
    }, [activeTab, pickerSingle, pickerCombine, pickerDisassemble]);

    const handlePickSingleCompleteMobile = useCallback((item: InventoryItem) => {
        setSelectedItem(item);
        setEquipmentPickerOpen(false);
    }, []);

    const handlePickerSelectSingle = useCallback((item: InventoryItem) => {
        setPickerSingle(item);
    }, []);

    const handlePickerSelectForCombine = useCallback((item: InventoryItem) => {
        setPickerCombine(prev => {
            const emptyIndex = prev.findIndex(i => i === null);
            if (emptyIndex === -1) return prev;
            const next = [...prev];
            next[emptyIndex] = item;
            return next;
        });
    }, []);

    const handlePickerRemoveCombineSlot = useCallback((index: number) => {
        setPickerCombine(prev => {
            const next = [...prev];
            next[index] = null;
            return next;
        });
    }, []);

    const handlePickerToggleDisassembly = useCallback((itemId: string) => {
        setPickerDisassemble(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    }, []);

    const handleDisassemblyAutoSelectConfirm = useCallback(
        (grades: ItemGrade[]) => {
            const toggler =
                equipmentPickerOpen && activeTab === 'disassemble'
                    ? handlePickerToggleDisassembly
                    : handleToggleDisassemblySelection;
            applyDisassemblyAutoSelectByGrades(
                grades,
                inventory,
                currentUserWithStatus.equipmentPresets,
                toggler
            );
        },
        [
            equipmentPickerOpen,
            activeTab,
            inventory,
            currentUserWithStatus.equipmentPresets,
            handlePickerToggleDisassembly,
            handleToggleDisassemblySelection,
        ]
    );

    const handleMobileEquipmentBack = useCallback(() => {
        if (activeTab === 'enhance' || activeTab === 'refine') {
            setSelectedItem(null);
        } else if (activeTab === 'combine') {
            setCombinationItems([null, null, null]);
        } else if (activeTab === 'disassemble') {
            setSelectedForDisassembly(new Set());
        }
    }, [activeTab]);

    const [equipmentFeatureModalOpen, setEquipmentFeatureModalOpen] = useState(false);
    const prevMobileEquipmentWorkRef = useRef(false);

    useEffect(() => {
        if (!useStackedBlacksmithLayout || !isMobileEquipmentTab) {
            setEquipmentFeatureModalOpen(false);
            prevMobileEquipmentWorkRef.current = false;
            return;
        }
        const now = mobileShowEquipmentWorkPanel;
        const prev = prevMobileEquipmentWorkRef.current;
        if (now && !prev) {
            setEquipmentFeatureModalOpen(true);
        }
        if (!now) {
            setEquipmentFeatureModalOpen(false);
        }
        prevMobileEquipmentWorkRef.current = now;
    }, [useStackedBlacksmithLayout, isMobileEquipmentTab, mobileShowEquipmentWorkPanel]);

    const tabs = [
        { id: 'enhance', label: t('tabs.enhance') },
        { id: 'combine', label: t('tabs.combine') },
        { id: 'disassemble', label: t('tabs.disassemble') },
        { id: 'refine', label: t('tabs.refine') },
        { id: 'convert', label: t('tabs.convert') },
    ];

    const handleActionWrapper = useCallback(async (action: ServerAction): Promise<void> => {
        if (isBlacksmithBusyRef.current) return;
        isBlacksmithBusyRef.current = true;
        setIsBlacksmithBusy(true);
        const startedAt = Date.now();
        try {
            await handlers.handleAction(action);
        } finally {
            const elapsed = Date.now() - startedAt;
            if (elapsed < MIN_ACTION_FEEDBACK_MS) {
                await new Promise((resolve) => setTimeout(resolve, MIN_ACTION_FEEDBACK_MS - elapsed));
            }
            isBlacksmithBusyRef.current = false;
            setIsBlacksmithBusy(false);
        }
    }, [handlers.handleAction]);

    const stackedEquipmentViewport = useStackedBlacksmithLayout && mobileShowEquipmentWorkPanel;

    const renderContent = (opts?: { forceStackedEquipmentViewport?: boolean }) => {
        const stackedForDetail =
            opts?.forceStackedEquipmentViewport === true ? true : stackedEquipmentViewport;
        switch (activeTab) {
            case 'enhance': return <EnhancementView 
                selectedItem={selectedItem} 
                currentUser={currentUserWithStatus} 
                onAction={handlers.handleAction} 
                enhancementOutcome={enhancementOutcome} 
                onOutcomeConfirm={handlers.clearEnhancementOutcome}
                onStartEnhancement={handlers.startEnhancement}
                stackedViewport={stackedForDetail}
            />;
            case 'combine': return <CombinationView 
                items={combinationItems}
                onRemoveItem={(index) => {
                    const newItems = [...combinationItems];
                    newItems[index] = null;
                    setCombinationItems(newItems);
                }}
                onAction={handleActionWrapper} 
                currentUser={currentUserWithStatus}
                stackedViewport={stackedForDetail}
                isBlacksmithBusy={isBlacksmithBusy}
            />;
            case 'disassemble': return (
                <DisassemblyView
                    onAction={handleActionWrapper}
                    selectedForDisassembly={selectedForDisassembly}
                    onToggleDisassemblySelection={handleToggleDisassemblySelection}
                    onOpenAutoSelect={() => setDisassemblyAutoSelectOpen(true)}
                    modalEquipmentSelectionFlow={useStackedBlacksmithLayout}
                    pcViewer={pcViewer}
                    isBlacksmithBusy={isBlacksmithBusy}
                />
            );
            case 'convert': return (
                <ConversionView
                    onAction={handleActionWrapper}
                    pcViewer={pcViewer}
                    stackedViewport={useStackedBlacksmithLayout}
                    isBlacksmithBusy={isBlacksmithBusy}
                />
            );
            case 'refine': return <RefinementView 
                selectedItem={selectedItem} 
                currentUser={currentUserWithStatus} 
                onAction={handlers.handleAction}
                refinementResult={modals.refinementResult}
                onResultConfirm={handlers.clearRefinementResult}
                stackedViewport={stackedForDetail}
            />;
            default: return null;
        }
    };

    const filteredInventory = useMemo(() => {
        let filtered: InventoryItem[] = [];
        if (activeTab === 'enhance' || activeTab === 'combine' || activeTab === 'disassemble' || activeTab === 'refine') {
            filtered = inventory.filter(item => item.type === 'equipment' && !item.isExchangeListed);
        } else if (activeTab === 'convert') {
            filtered = inventory.filter(
                (item) => !isPairArenaExclusiveBagItem(item) && item.type === 'material'
            );
        } else {
            filtered = inventory;
        }

        // 정렬 적용
        const sorted = [...filtered].sort((a, b) => {
            switch (sortOption) {
                case 'grade':
                    const gradeOrder = GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade);
                    if (gradeOrder !== 0) return gradeOrder;
                    return (b.stars || 0) - (a.stars || 0);
                case 'stars':
                    const starsDiff = (b.stars || 0) - (a.stars || 0);
                    if (starsDiff !== 0) return starsDiff;
                    return GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade);
                case 'name':
                    return a.name.localeCompare(b.name, 'ko');
                case 'date':
                    return ((typeof b.createdAt === 'number' ? b.createdAt : 0) - (typeof a.createdAt === 'number' ? a.createdAt : 0));
                default:
                    return 0;
            }
        });

        return sorted;
    }, [inventory, activeTab, sortOption]);

    /** 합성 피커: 선택 불가(장착·등급·대장간 레벨) 장비는 목록에서 제외해 모바일에서 회색만 가득한 것처럼 보이지 않게 함 */
    const pickerFilteredInventory = useMemo(() => {
        if (!equipmentPickerOpen || activeTab !== 'combine') return filteredInventory;
        const disabledSet = new Set(pickerDisabledItemIds);
        return filteredInventory.filter(item => !disabledSet.has(item.id));
    }, [equipmentPickerOpen, activeTab, filteredInventory, pickerDisabledItemIds]);

    const inventorySlotsToDisplay = (() => {
        const slots = inventorySlots || {};
        if (activeTab === 'enhance' || activeTab === 'combine' || activeTab === 'disassemble' || activeTab === 'refine') {
            return slots.equipment || 30;
        } else if (activeTab === 'convert') {
            return slots.material || 30;
        }
        return 30;
    })();

    const bagHeaderText = useMemo(() => {
        if (activeTab === 'enhance' || activeTab === 'combine' || activeTab === 'disassemble' || activeTab === 'refine') {
            return t('inventoryType.equipment');
        } else if (activeTab === 'convert') {
            return t('inventoryType.material');
        }
        return t('inventoryType.bag');
    }, [activeTab, t]);
    /** 재료 변환만 그리드·스크롤용 최소 높이; 장비 탭(선택/작업 안내)은 콘텐츠 높이로 두어 하단 여백 제거 */
    const mobileViewerMinH =
        activeTab === 'convert' ? 'clamp(9.5rem, 28dvh, 17rem)' : undefined;
    const stackedMobileFillHeight = useStackedBlacksmithLayout && activeTab === 'convert';
    const pcViewer = !useStackedBlacksmithLayout;
    const inventoryViewportRef = useRef<HTMLDivElement>(null);
    const [inventoryViewportHeightPx, setInventoryViewportHeightPx] = useState<number | null>(null);

    useLayoutEffect(() => {
        if (useStackedBlacksmithLayout) {
            setInventoryViewportHeightPx(null);
            return;
        }
        const el = inventoryViewportRef.current;
        if (!el) return;

        const cols = 10;
        const gap = 4;
        const gridPad = 8;
        const visibleRows = 3;

        const update = () => {
            const w = el.clientWidth;
            if (w <= 0) return;
            const cell = (w - gridPad * 2 - gap * (cols - 1)) / cols;
            const h = gridPad * 2 + visibleRows * cell + gap * (visibleRows - 1);
            setInventoryViewportHeightPx(Math.round(h));
        };

        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [useStackedBlacksmithLayout, activeTab]);

    const mobilePickHint = useMemo(() => {
        switch (activeTab) {
            case 'enhance':
                return t('pickHints.enhance');
            case 'combine':
                return t('pickHints.combine');
            case 'disassemble':
                return t('pickHints.disassemble');
            case 'refine':
                return t('pickHints.refine');
            default:
                return '';
        }
    }, [activeTab, t]);

    const mobileFeatureModalTitle = useMemo(() => {
        switch (activeTab) {
            case 'enhance':
                return t('tabs.enhance');
            case 'combine':
                return t('tabs.combine');
            case 'disassemble':
                return t('tabs.disassemble');
            case 'refine':
                return t('tabs.refine');
            default:
                return t('title');
        }
    }, [activeTab, t]);

    const mobileFeatureOpenButtonLabel = useMemo(() => {
        switch (activeTab) {
            case 'enhance':
                return t('openScreen.enhance');
            case 'combine':
                return t('openScreen.combine');
            case 'disassemble':
                return t('openScreen.disassemble');
            case 'refine':
                return t('openScreen.refine');
            default:
                return t('openScreen.default');
        }
    }, [activeTab, t]);

    const blacksmithMain = (
                <div
                    className={`flex min-h-0 w-full ${embedded ? 'h-full flex-1 flex-row' : stackedMobileFillHeight ? 'flex-1' : useStackedBlacksmithLayout ? 'shrink-0' : 'flex-1'} ${embedded || !useStackedBlacksmithLayout ? 'h-full flex-row' : 'flex-col'}`}
                >
                    {useStackedBlacksmithLayout ? (
                        <div
                            className={`flex min-h-0 w-full flex-col gap-2 ${stackedMobileFillHeight ? 'min-h-0 flex-1' : 'shrink-0'}`}
                        >
                            <div className="shrink-0 rounded-xl border border-cyan-400/25 bg-gradient-to-b from-stone-900/80 to-cyan-950/30 p-2 shadow-inner">
                                <div className="flex min-h-[12rem] w-full items-stretch gap-2 sm:min-h-[12.5rem]">
                                    <div className="min-h-0 min-w-0 flex-1">
                                        <div className="relative flex h-full min-h-[11rem] flex-col overflow-hidden rounded-lg border border-cyan-300/30 bg-gradient-to-b from-stone-900/95 to-black/90 shadow-md sm:min-h-[12rem]">
                                            <div className="relative min-h-[6.75rem] min-w-0 flex-1">
                                                <img
                                                    src="/images/equipments/moru.webp"
                                                    alt="Blacksmith"
                                                    className="absolute inset-0 h-full w-full object-cover object-center"
                                                    decoding="async"
                                                />
                                                <div
                                                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent"
                                                    aria-hidden
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handlers.openBlacksmithEffectsModal()}
                                                    title={t('effects')}
                                                    aria-label={t('effectsAria')}
                                                    className="absolute left-1.5 top-1.5 z-[2] max-w-[calc(100%-1rem)] rounded-md border border-amber-500/45 bg-black/55 px-2 py-1 text-left shadow-md backdrop-blur-sm transition hover:border-amber-400/70 hover:bg-black/70 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 sm:left-2 sm:top-2 sm:px-2.5 sm:py-1"
                                                >
                                                    <span className="block text-[13px] font-bold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] sm:text-sm">
                                                        {t('level', { level: blacksmithLevel ?? 1 })}
                                                    </span>
                                                </button>
                                                <div className="absolute inset-x-0 bottom-0 z-[2] px-2 pb-2 pt-6 sm:px-3 sm:pb-2.5">
                                                    <div className="mb-0.5 flex items-center justify-between gap-1 text-[12px] font-semibold tabular-nums text-stone-200 sm:text-[13px]">
                                                        <span className="shrink-0 text-stone-300/90">{t('exp')}</span>
                                                        {isMaxLevel ? (
                                                            <span className="min-w-0 truncate text-right text-amber-200/95">
                                                                {(blacksmithXp ?? 0).toLocaleString()} (Max)
                                                            </span>
                                                        ) : (
                                                            <span className="min-w-0 truncate text-right">
                                                                {(blacksmithXp ?? 0).toLocaleString()} /{' '}
                                                                {BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(blacksmithLevel ?? 1).toLocaleString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="h-1.5 w-full overflow-hidden rounded-full border border-stone-600/60 bg-black/60 shadow-inner sm:h-2">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-400 transition-all"
                                                            style={{
                                                                width: isMaxLevel
                                                                    ? '100%'
                                                                    : `${((blacksmithXp ?? 0) / BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(blacksmithLevel ?? 1)) * 100}%`,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <nav
                                        className="flex w-[5.15rem] shrink-0 flex-col justify-center gap-1 sm:w-[5.75rem]"
                                        aria-label={t('functionsAria')}
                                    >
                                        {tabs.map(tab => (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() =>
                                                    onSetActiveTab(
                                                        tab.id as 'enhance' | 'combine' | 'disassemble' | 'convert' | 'refine'
                                                    )
                                                }
                                                className={`min-h-[2.35rem] flex-1 rounded-lg border px-1 py-1 text-center text-[13px] font-bold leading-[1.2] shadow-sm transition sm:min-h-0 sm:px-1.5 sm:leading-tight ${
                                                    activeTab === tab.id
                                                        ? 'border-amber-400/70 bg-gradient-to-br from-amber-600/40 via-amber-500/25 to-orange-900/30 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_14px_-6px_rgba(251,191,36,0.55)]'
                                                        : 'border-stone-600/55 bg-stone-800/50 text-stone-300 hover:border-cyan-500/35 hover:bg-stone-700/55 hover:text-stone-100'
                                                }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </nav>
                                </div>
                            </div>

                            <div
                                className={`flex min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden rounded-xl border border-color/40 bg-tertiary/20 p-2 [scrollbar-gutter:stable] ${stackedMobileFillHeight ? 'min-h-0 flex-1' : 'shrink-0'}`}
                                style={mobileViewerMinH ? { minHeight: mobileViewerMinH } : undefined}
                            >
                                {activeTab === 'convert' && renderContent()}
                                {isMobileEquipmentTab && !mobileShowEquipmentWorkPanel && (
                                    <div className="flex flex-col items-center justify-center gap-3 px-2 py-4">
                                        <p className="max-w-sm text-center text-[13px] leading-relaxed text-slate-400">
                                            {mobilePickHint}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={openEquipmentPicker}
                                            className="w-full max-w-xs rounded-xl border-2 border-amber-400/55 bg-gradient-to-b from-amber-600/55 via-amber-500/35 to-orange-950/50 px-4 py-3.5 text-[13px] font-bold text-amber-50 shadow-[0_12px_28px_-14px_rgba(251,191,36,0.65)] transition hover:border-amber-300/80 active:scale-[0.99]"
                                        >
                                            {t('selectGear')}
                                        </button>
                                    </div>
                                )}
                                {isMobileEquipmentTab && mobileShowEquipmentWorkPanel && (
                                    <div className="flex flex-col items-center justify-center gap-3 px-2 py-4">
                                        <p className="max-w-sm text-center text-[13px] leading-relaxed text-slate-400">
                                            {equipmentFeatureModalOpen
                                                ? t('inProgressHint')
                                                : t('openWorkHint')}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setEquipmentFeatureModalOpen(true)}
                                            className="w-full max-w-xs rounded-xl border-2 border-cyan-400/50 bg-gradient-to-b from-cyan-900/40 via-slate-800/60 to-slate-900/80 px-4 py-3 text-[13px] font-bold text-cyan-50 shadow-[0_12px_28px_-14px_rgba(34,211,238,0.45)] transition hover:border-cyan-300/70 active:scale-[0.99]"
                                        >
                                            {mobileFeatureOpenButtonLabel}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleMobileEquipmentBack}
                                            className="rounded-lg border border-slate-600/55 bg-slate-800/70 px-3 py-2 text-[13px] font-bold text-slate-200 shadow-sm transition hover:border-cyan-500/35 hover:bg-slate-700/80 active:scale-[0.99]"
                                        >
                                            {t('reselectGear')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                    <>
                    {/* Left Panel */}
                    <div className="flex w-[360px] flex-shrink-0 flex-col gap-2.5 overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-b from-[#1b1f2f]/85 via-[#131827]/90 to-[#0c101a]/95 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_22px_48px_-28px_rgba(0,0,0,0.85)]">
                        <div className="relative aspect-[3/2] w-full shrink-0 overflow-hidden rounded-xl border border-amber-400/25 shadow-[0_14px_30px_-20px_rgba(251,191,36,0.45)]">
                            <img
                                src="/images/equipments/moru.webp"
                                alt="Blacksmith"
                                className="absolute inset-0 h-full w-full object-cover"
                            />
                            <div
                                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/15"
                                aria-hidden
                            />
                            <button
                                type="button"
                                onClick={() => handlers.openBlacksmithEffectsModal()}
                                title={t('effects')}
                                aria-label={t('effectsAria')}
                                className="absolute left-0 top-0 z-[2] max-w-[calc(100%-0.5rem)] p-3 text-left transition hover:brightness-110 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                            >
                                <h2 className="text-2xl font-black tracking-tight text-amber-50 drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]">
                                    {t('level', { level: blacksmithLevel ?? 1 })}
                                </h2>
                            </button>
                            <div className="absolute inset-x-0 bottom-0 z-[2] px-3 pb-3 pt-8">
                                <div className="mb-1 flex justify-between gap-2 text-xs text-slate-200">
                                    <span className="shrink-0 font-semibold tracking-wide text-amber-200/90">{t('exp')}</span>
                                    {isMaxLevel ? (
                                        <span className="min-w-0 truncate text-right text-amber-200">
                                            {(blacksmithXp ?? 0).toLocaleString()} (Max)
                                        </span>
                                    ) : (
                                        <span className="min-w-0 truncate text-right text-slate-100">
                                            {(blacksmithXp ?? 0).toLocaleString()} /{' '}
                                            {BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(blacksmithLevel ?? 1).toLocaleString()}
                                            <span className="text-amber-200/90">
                                                {' '}
                                                (
                                                {Math.round(
                                                    ((blacksmithXp ?? 0) /
                                                        BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(blacksmithLevel ?? 1)) *
                                                        100
                                                )}
                                                %)
                                            </span>
                                        </span>
                                    )}
                                </div>
                                <div className="h-3 w-full overflow-hidden rounded-full border border-amber-500/30 bg-black/60 shadow-inner">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all"
                                        style={{
                                            width: isMaxLevel
                                                ? '100%'
                                                : `${((blacksmithXp ?? 0) / BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(blacksmithLevel ?? 1)) * 100}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex min-h-[15.5rem] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2">
                            <BlacksmithLevelEffectsSummary
                                blacksmithLevel={blacksmithLevel ?? 1}
                                disassemblyJackpotBonusPercent={vipBonus}
                                combinationGreatSuccessBonusPercent={vipBonus}
                                className="min-h-0 flex-1 overflow-y-auto pr-0.5 [scrollbar-width:thin]"
                            />
                        </div>
                    </div>

                    {/* Right Panel */}
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-[#131722]/90 via-[#0f131d]/95 to-[#0a0d15]/95 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                        <div className="mb-4 flex gap-1 rounded-xl border border-white/[0.06] bg-black/35 p-1 shadow-inner backdrop-blur-md">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => onSetActiveTab(tab.id as 'enhance' | 'combine' | 'disassemble' | 'convert' | 'refine')}
                                    className={`relative flex-1 overflow-hidden rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                                        activeTab === tab.id
                                            ? 'text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_20px_-8px_rgba(251,191,36,0.45)]'
                                            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                                    }`}
                                >
                                    {activeTab === tab.id && (
                                        <span className="absolute inset-0 bg-gradient-to-b from-amber-600/35 via-amber-700/20 to-amber-950/35 ring-1 ring-amber-400/30" aria-hidden />
                                    )}
                                    <span className="relative z-[1]">{tab.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-slate-900/70 via-black/35 to-black/50 p-3">
                            {renderContent()}
                        </div>
                        <div className="mt-3 flex shrink-0 flex-col rounded-xl border border-white/10 bg-black/25 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <h3 className="min-w-0 shrink text-lg font-black tracking-tight text-amber-100">{bagHeaderText}</h3>
                                <div className="flex shrink-0 items-center gap-2">
                                    <select
                                        value={sortOption}
                                        onChange={(e) => setSortOption(e.target.value as SortOption)}
                                        className="rounded-md border border-amber-400/30 bg-slate-900/85 px-2.5 py-1.5 text-xs font-semibold text-amber-100 outline-none transition focus:border-amber-300/60"
                                    >
                                        <option value="grade">{t('sort.grade')}</option>
                                        <option value="stars">{t('sort.stars')}</option>
                                        <option value="name">{t('sort.name')}</option>
                                        <option value="date">{t('sort.date')}</option>
                                    </select>
                                </div>
                            </div>
                            <div
                                ref={inventoryViewportRef}
                                className="shrink-0 overflow-y-auto pr-1"
                                style={inventoryViewportHeightPx != null ? { height: inventoryViewportHeightPx } : undefined}
                            >
                                <InventoryGrid 
                                    inventory={filteredInventory} 
                                    inventorySlots={inventorySlotsToDisplay} 
                                    onSelectItem={handleSelectItem} 
                                    selectedItemId={selectedItem?.id || null} 
                                    disabledItemIds={disabledItemIds}
                                    selectedItemIdsForDisassembly={activeTab === 'disassemble' ? selectedForDisassembly : undefined}
                                    onToggleDisassemblySelection={activeTab === 'disassemble' ? handleToggleDisassemblySelection : undefined}
                                />
                            </div>
                        </div>
                    </div>
                    </>
                    )}
                </div>
    );

    const equipmentPickerModal = (
        <BlacksmithEquipmentPickerModal
            embedded={embedded && !useStackedBlacksmithLayout}
            mode={activeTab}
            onClose={() => setEquipmentPickerOpen(false)}
            onConfirm={handlePickerConfirm}
            onPickSingleComplete={
                activeTab === 'enhance' || activeTab === 'refine' ? handlePickSingleCompleteMobile : undefined
            }
            filteredInventory={pickerFilteredInventory}
            inventorySlots={Math.max(inventorySlotsToDisplay, pickerFilteredInventory.length)}
            sortOption={sortOption}
            onSortChange={setSortOption}
            columnCount={windowWidth < 380 ? 5 : windowWidth < 480 ? 6 : 8}
            gapPx={windowWidth < 400 ? 4 : 6}
            disabledItemIds={pickerDisabledItemIds}
            pickerSingle={pickerSingle}
            onSelectSingle={handlePickerSelectSingle}
            pickerCombine={pickerCombine}
            onRemoveCombineSlot={handlePickerRemoveCombineSlot}
            onSelectForCombine={handlePickerSelectForCombine}
            pickerDisassemble={pickerDisassemble}
            onToggleDisassembly={handlePickerToggleDisassembly}
            onOpenDisassemblyAutoSelect={
                activeTab === 'disassemble' ? () => setDisassemblyAutoSelectOpen(true) : undefined
            }
            disassemblyAutoSelectOpen={disassemblyAutoSelectOpen}
            isTopmost={Boolean(isTopmost)}
        />
    );

    return (
        <>
            {embedded ? (
                <div className={`${PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS} flex min-h-0 flex-1 flex-col`}>
                    {blacksmithMain}
                </div>
            ) : (
            <DraggableWindow 
                title={t('title')} 
                onClose={onClose} 
                bodyScrollable
                bodyNoScroll={false}
                mobileViewportFit={useStackedBlacksmithLayout}
                mobileViewportMaxHeightVh={useStackedBlacksmithLayout ? 92 : undefined}
                mobileViewportMaxHeightCss={useStackedBlacksmithLayout ? 'min(94dvh, calc(100dvh - 12px))' : undefined}
                bodyPaddingClassName={
                    useStackedBlacksmithLayout
                        ? '!px-2 !pt-2 sm:!px-2.5 sm:!pt-2.5 !pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]'
                        : undefined
                }
                isTopmost={
                    isTopmost &&
                    !disassemblyAutoSelectOpen &&
                    !equipmentPickerOpen &&
                    !equipmentFeatureModalOpen &&
                    !modals.isBlacksmithEffectsModalOpen &&
                    !modals.disassemblyResult
                }
                initialWidth={1160}
                initialHeight={useStackedBlacksmithLayout ? 760 : 860}
                windowId="blacksmith"
                zIndex={useStackedBlacksmithLayout ? 120 : 50}
                variant="store"
            >
                {blacksmithMain}
            </DraggableWindow>
            )}

            {equipmentPickerOpen && useStackedBlacksmithLayout && isMobileEquipmentTab && (
                equipmentPickerModal
            )}

            {equipmentFeatureModalOpen &&
                useStackedBlacksmithLayout &&
                isMobileEquipmentTab &&
                mobileShowEquipmentWorkPanel && (
                    <DraggableWindow
                        title={mobileFeatureModalTitle}
                        onClose={() => setEquipmentFeatureModalOpen(false)}
                        windowId={`blacksmith-work-${activeTab}`}
                        isTopmost={
                            isTopmost &&
                            !disassemblyAutoSelectOpen &&
                            !equipmentPickerOpen &&
                            !modals.isBlacksmithEffectsModalOpen &&
                            !modals.disassemblyResult
                        }
                        zIndex={140}
                        variant="store"
                        mobileViewportFit
                        mobileViewportMaxHeightVh={96}
                        mobileViewportMaxHeightCss="min(97dvh, calc(100dvh - 8px))"
                        initialWidth={520}
                        initialHeight={860}
                        bodyScrollable
                        bodyNoScroll={false}
                        bodyPaddingClassName="!px-2 !pt-2 !pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
                    >
                        <div className="flex min-h-0 w-full flex-1 flex-col gap-2">
                            <button
                                type="button"
                                onClick={handleMobileEquipmentBack}
                                className="shrink-0 self-start rounded-lg border border-slate-600/55 bg-slate-800/70 px-3 py-2 text-[13px] font-bold text-slate-200 shadow-sm transition hover:border-cyan-500/35 hover:bg-slate-700/80 active:scale-[0.99]"
                            >
                                {t('reselectGear')}
                            </button>
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
                                <div className={`${BLACKSMITH_MOBILE_WORK_ROOT_CLASS} min-h-[min(68dvh,100%)]`}>
                                    {renderContent({ forceStackedEquipmentViewport: true })}
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                )}

            {disassemblyAutoSelectOpen && activeTab === 'disassemble' && (
                <DisassemblyAutoSelectModal
                    onClose={() => setDisassemblyAutoSelectOpen(false)}
                    onConfirm={handleDisassemblyAutoSelectConfirm}
                    isTopmost={isTopmost}
                    zIndex={useStackedBlacksmithLayout ? 150 : 90}
                />
            )}
        </>
    );
};

export default BlacksmithModal;