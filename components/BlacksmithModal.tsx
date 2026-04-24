import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
    const firstItemGrade = combinationItems[0]?.grade;
    const combinationItemIds = combinationItems.map(i => i?.id).filter(Boolean) as string[];
    return inventory
        .filter(item => {
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
}

type SortOption = 'grade' | 'stars' | 'name' | 'date';

const BlacksmithModal: React.FC<BlacksmithModalProps> = ({ onClose, isTopmost, selectedItemForEnhancement, activeTab, onSetActiveTab, enhancementOutcome }) => {
    const { currentUserWithStatus, handlers, modals } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(selectedItemForEnhancement);
    const [combinationItems, setCombinationItems] = useState<(InventoryItem | null)[]>([null, null, null]);
    const [selectedForDisassembly, setSelectedForDisassembly] = useState<Set<string>>(new Set()); // New state
    const [sortOption, setSortOption] = useState<SortOption>('grade');
    const [disassemblyAutoSelectOpen, setDisassemblyAutoSelectOpen] = useState(false);

    // 좁은 가로 화면에서는 PC 레이아웃을 그대로 축소해서 사용
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    /** 넓은 태블릿 가로 등은 PC 2열 유지, 뷰포트 너비 1025px 미만·네이티브 셸은 스택 레이아웃 */
    const isCompactViewport = windowWidth < 1025;
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

    // Sync selected item with inventory (for enhancement updates)
    useEffect(() => {
        if (selectedItem && activeTab === 'enhance') {
            const updatedItem = currentUserWithStatus.inventory.find(invItem => invItem.id === selectedItem.id);
            if (updatedItem && (updatedItem.stars !== selectedItem.stars || updatedItem.enhancementFails !== selectedItem.enhancementFails)) {
                setSelectedItem(updatedItem);
            }
        }
    }, [currentUserWithStatus.inventory, selectedItem, activeTab]);

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
        { id: 'enhance', label: '장비 강화' },
        { id: 'combine', label: '장비 합성' },
        { id: 'disassemble', label: '장비 분해' },
        { id: 'refine', label: '장비 제련' },
        { id: 'convert', label: '재료 변환' },
    ];

    const handleActionWrapper = useCallback(async (action: ServerAction): Promise<void> => {
        await handlers.handleAction(action);
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
            />;
            case 'disassemble': return (
                <DisassemblyView
                    onAction={handleActionWrapper}
                    selectedForDisassembly={selectedForDisassembly}
                    onToggleDisassemblySelection={handleToggleDisassemblySelection}
                    modalEquipmentSelectionFlow={useStackedBlacksmithLayout}
                />
            );
            case 'convert': return <ConversionView onAction={handleActionWrapper} />;
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
            filtered = inventory.filter(item => item.type === 'equipment');
        } else if (activeTab === 'convert') {
            filtered = inventory.filter(item => item.type === 'material');
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
            return '장비';
        } else if (activeTab === 'convert') {
            return '재료';
        }
        return '가방'; // Default or fallback
    }, [activeTab]);
    /** 뷰포트에 비례해 작업 영역·가방 높이 분배 (고정 px 상한은 짤림 유발) */
    const mobileViewerMinH =
        activeTab === 'convert' ? 'min(clamp(11rem, 36dvh, 22rem), 50dvh)' : 'min(clamp(10rem, 32dvh, 20rem), 46dvh)';

    const mobilePickHint = useMemo(() => {
        switch (activeTab) {
            case 'enhance':
                return '강화할 장비를 모달에서 고른 뒤 선택 완료를 누르면 강화 화면으로 이동합니다.';
            case 'combine':
                return '같은 등급 장비 3개를 모달에서 담은 뒤 선택 완료를 누르면 합성 화면으로 이동합니다.';
            case 'disassemble':
                return '분해할 장비를 모달에서 고른 뒤 선택 완료를 누르면 분해 화면으로 이동합니다.';
            case 'refine':
                return '제련할 장비를 모달에서 고른 뒤 선택 완료를 누르면 제련 화면으로 이동합니다.';
            default:
                return '';
        }
    }, [activeTab]);

    const mobileFeatureModalTitle = useMemo(() => {
        switch (activeTab) {
            case 'enhance':
                return '장비 강화';
            case 'combine':
                return '장비 합성';
            case 'disassemble':
                return '장비 분해';
            case 'refine':
                return '장비 제련';
            default:
                return '대장간';
        }
    }, [activeTab]);

    const mobileFeatureOpenButtonLabel = useMemo(() => {
        switch (activeTab) {
            case 'enhance':
                return '강화 화면 열기';
            case 'combine':
                return '합성 화면 열기';
            case 'disassemble':
                return '분해 화면 열기';
            case 'refine':
                return '제련 화면 열기';
            default:
                return '작업 화면 열기';
        }
    }, [activeTab]);

    return (
        <>
            <DraggableWindow 
                title="대장간" 
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
                    !modals.isBlacksmithHelpOpen &&
                    !modals.isBlacksmithEffectsModalOpen &&
                    !modals.disassemblyResult
                }
                initialWidth={1100}
                initialHeight={useStackedBlacksmithLayout ? 720 : 900}
                windowId="blacksmith"
                zIndex={useStackedBlacksmithLayout ? 120 : 50}
                variant="store"
                headerContent={
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handlers.openBlacksmithHelp();
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="z-30 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/45 bg-gradient-to-br from-amber-900/70 to-stone-900/90 text-base font-bold text-amber-100 shadow-md transition hover:border-amber-300/70 hover:from-amber-800/80 active:scale-95"
                        title="대장간 도움말"
                        aria-label="대장간 도움말"
                    >
                        ?
                    </button>
                }
            >
                <div
                    className={`flex min-h-0 w-full flex-1 ${useStackedBlacksmithLayout ? 'flex-col' : 'h-full flex-row'}`}
                >
                    {useStackedBlacksmithLayout ? (
                        <div className="flex min-h-0 w-full flex-1 flex-col gap-2">
                            <div className="shrink-0 rounded-xl border border-cyan-400/25 bg-gradient-to-b from-stone-900/80 to-cyan-950/30 p-2 shadow-inner">
                                <div className="flex min-h-0 w-full items-stretch gap-2">
                                    <div className="min-h-[9.5rem] min-w-0 flex-1">
                                        <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-cyan-300/30 bg-gradient-to-b from-stone-900/95 to-black/90 shadow-md">
                                            <div className="flex min-h-0 flex-1 items-center justify-center px-1.5 py-2 sm:px-2 sm:py-3">
                                                <img
                                                    src="/images/equipments/moru.png"
                                                    alt="Blacksmith"
                                                    className="mx-auto block h-auto max-h-[min(6.5rem,26vw)] w-auto max-w-full object-contain object-center sm:max-h-[min(7.5rem,28vw)]"
                                                    decoding="async"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handlers.openBlacksmithEffectsModal()}
                                                title="대장간 효과"
                                                aria-label="대장간 효과 보기"
                                                className="absolute left-1.5 top-1.5 z-[1] max-w-[calc(100%-4.5rem)] rounded-md border border-amber-500/45 bg-black/75 px-1.5 py-0.5 text-left shadow-md backdrop-blur-sm transition hover:border-amber-400/70 hover:bg-black/85 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 sm:left-2 sm:top-2 sm:px-2.5 sm:py-1"
                                            >
                                                <span className="block text-[10px] font-bold leading-tight text-white drop-shadow-sm sm:text-xs">
                                                    대장간 <span className="text-amber-300">Lv.{blacksmithLevel ?? 1}</span>
                                                </span>
                                            </button>
                                            <div className="shrink-0 border-t border-amber-500/20 bg-gradient-to-t from-black/90 via-black/78 to-black/20 px-2 pb-1.5 pt-2 sm:px-3 sm:pb-2 sm:pt-3">
                                                <div className="mb-0.5 flex items-center justify-between gap-1 text-[10px] font-semibold tabular-nums text-stone-200 sm:mb-1 sm:text-[11px] sm:text-xs">
                                                    <span className="shrink-0 text-stone-400">경험치</span>
                                                    {isMaxLevel ? (
                                                        <span className="min-w-0 truncate text-right text-amber-200/95">
                                                            {(blacksmithXp ?? 0).toLocaleString()} (Max)
                                                        </span>
                                                    ) : (
                                                        <span className="min-w-0 truncate text-right text-[9px] sm:text-[11px]">
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
                                    <nav
                                        className="flex w-[4.85rem] shrink-0 flex-col justify-center gap-1 sm:w-[5.65rem]"
                                        aria-label="대장간 기능"
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
                                                className={`min-h-[2.35rem] flex-1 rounded-lg border px-1 py-1 text-center text-[9px] font-bold leading-[1.15] shadow-sm transition sm:min-h-0 sm:px-1.5 sm:text-[10px] sm:leading-tight ${
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
                                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-xl border border-color/40 bg-tertiary/20 p-2 [scrollbar-gutter:stable]"
                                style={{ minHeight: mobileViewerMinH }}
                            >
                                {activeTab === 'convert' && renderContent()}
                                {isMobileEquipmentTab && !mobileShowEquipmentWorkPanel && (
                                    <div className="flex min-h-[11rem] flex-col items-center justify-center gap-4 px-2 py-5">
                                        <p className="max-w-sm text-center text-sm leading-relaxed text-slate-400">
                                            {mobilePickHint}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={openEquipmentPicker}
                                            className="w-full max-w-xs rounded-xl border-2 border-amber-400/55 bg-gradient-to-b from-amber-600/55 via-amber-500/35 to-orange-950/50 px-4 py-3.5 text-base font-bold text-amber-50 shadow-[0_12px_28px_-14px_rgba(251,191,36,0.65)] transition hover:border-amber-300/80 active:scale-[0.99]"
                                        >
                                            장비 선택
                                        </button>
                                    </div>
                                )}
                                {isMobileEquipmentTab && mobileShowEquipmentWorkPanel && (
                                    <div className="flex min-h-[10rem] flex-col items-center justify-center gap-3 px-2 py-6">
                                        <p className="max-w-sm text-center text-sm leading-relaxed text-slate-400">
                                            {equipmentFeatureModalOpen
                                                ? '작업 창에서 진행 중입니다. 창을 닫은 경우 아래 버튼으로 다시 열 수 있습니다.'
                                                : '아래 버튼을 눌러 작업 화면을 여세요.'}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setEquipmentFeatureModalOpen(true)}
                                            className="w-full max-w-xs rounded-xl border-2 border-cyan-400/50 bg-gradient-to-b from-cyan-900/40 via-slate-800/60 to-slate-900/80 px-4 py-3 text-base font-bold text-cyan-50 shadow-[0_12px_28px_-14px_rgba(34,211,238,0.45)] transition hover:border-cyan-300/70 active:scale-[0.99]"
                                        >
                                            {mobileFeatureOpenButtonLabel}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleMobileEquipmentBack}
                                            className="rounded-lg border border-slate-600/55 bg-slate-800/70 px-3 py-2 text-xs font-bold text-slate-200 shadow-sm transition hover:border-cyan-500/35 hover:bg-slate-700/80 active:scale-[0.99]"
                                        >
                                            ← 장비 다시 선택
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                    <>
                    {/* Left Panel */}
                    <div className="w-[360px] flex flex-shrink-0 flex-col items-center gap-4 overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-b from-[#1b1f2f]/85 via-[#131827]/90 to-[#0c101a]/95 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_22px_48px_-28px_rgba(0,0,0,0.85)]">
                        <div className="relative w-full overflow-hidden rounded-xl border border-amber-400/25 shadow-[0_14px_30px_-20px_rgba(251,191,36,0.45)] aspect-w-3 aspect-h-2 flex-shrink-0">
                            <img src="/images/equipments/moru.png" alt="Blacksmith" className="w-full h-full object-cover" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl font-black tracking-tight text-amber-100">
                                대장간 <span className="text-yellow-300">Lv.{(blacksmithLevel ?? 1)}</span>
                            </h2>
                        </div>
                        <div className="w-full">
                            <div className="mb-1 flex justify-between text-xs text-slate-200">
                                <span className="font-semibold tracking-wide text-amber-200/80">경험치</span>
                                {isMaxLevel ? (
                                    <span className="text-amber-200">{(blacksmithXp ?? 0).toLocaleString()} (Max)</span>
                                ) : (
                                    <span className="text-slate-200">
                                        {(blacksmithXp ?? 0)} / {BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(blacksmithLevel ?? 1)} ({Math.round(((blacksmithXp ?? 0) / BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(blacksmithLevel ?? 1)) * 100)}%)
                                    </span>
                                )}
                            </div>
                            <div className="h-3 w-full overflow-hidden rounded-full border border-amber-500/25 bg-black/55 shadow-inner">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all"
                                    style={{ width: isMaxLevel ? '100%' : `${((blacksmithXp ?? 0) / BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(blacksmithLevel ?? 1)) * 100}%` }}
                                />
                            </div>
                        </div>
                        <div className="w-full min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2">
                            <BlacksmithLevelEffectsSummary blacksmithLevel={blacksmithLevel ?? 1} />
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
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-slate-900/70 via-black/35 to-black/50 p-4">
                            {renderContent()}
                        </div>
                        <div className="mt-4 flex flex-col rounded-xl border border-white/10 bg-black/25 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <h3 className="min-w-0 shrink text-lg font-black tracking-tight text-amber-100">{bagHeaderText}</h3>
                                <div className="flex shrink-0 items-center gap-2">
                                    {activeTab === 'disassemble' && (
                                        <button
                                            type="button"
                                            onClick={() => setDisassemblyAutoSelectOpen(true)}
                                            className="whitespace-nowrap rounded-md border border-amber-300/40 bg-gradient-to-r from-amber-600/90 via-amber-500/90 to-orange-500/85 px-2.5 py-1.5 text-xs font-bold text-amber-50 shadow-[0_10px_22px_-14px_rgba(251,191,36,0.75)] transition hover:from-amber-500 hover:via-amber-400 hover:to-orange-400"
                                        >
                                            자동 선택
                                        </button>
                                    )}
                                    <select
                                        value={sortOption}
                                        onChange={(e) => setSortOption(e.target.value as SortOption)}
                                        className="rounded-md border border-amber-400/30 bg-slate-900/85 px-2.5 py-1.5 text-xs font-semibold text-amber-100 outline-none transition focus:border-amber-300/60"
                                    >
                                        <option value="grade">등급순</option>
                                        <option value="stars">강화순</option>
                                        <option value="name">이름순</option>
                                        <option value="date">최신순</option>
                                    </select>
                                </div>
                            </div>
                            <div className="h-[130px] overflow-y-auto pr-1">
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
            </DraggableWindow>

            {equipmentPickerOpen && useStackedBlacksmithLayout && isMobileEquipmentTab && (
                <BlacksmithEquipmentPickerModal
                    mode={activeTab}
                    onClose={() => setEquipmentPickerOpen(false)}
                    onConfirm={handlePickerConfirm}
                    filteredInventory={filteredInventory}
                    inventorySlots={inventorySlotsToDisplay}
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
                />
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
                            !modals.isBlacksmithHelpOpen &&
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
                                className="shrink-0 self-start rounded-lg border border-slate-600/55 bg-slate-800/70 px-3 py-2 text-xs font-bold text-slate-200 shadow-sm transition hover:border-cyan-500/35 hover:bg-slate-700/80 active:scale-[0.99]"
                            >
                                ← 장비 다시 선택
                            </button>
                            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
                                {renderContent({ forceStackedEquipmentViewport: true })}
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