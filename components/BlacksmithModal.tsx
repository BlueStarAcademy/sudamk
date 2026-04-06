import React, { useState, useMemo, useEffect, useCallback } from 'react';
import DraggableWindow from './DraggableWindow.js';
import EnhancementView from './blacksmith/EnhancementView.js';
import CombinationView from './blacksmith/CombinationView.js';
import DisassemblyView from './blacksmith/DisassemblyView.js';
import ConversionView from './blacksmith/ConversionView.js';
import RefinementView from './blacksmith/RefinementView.js';
import InventoryGrid from './blacksmith/InventoryGrid.js';
import RefinementResultModal from './blacksmith/RefinementResultModal.js';
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

    // 좁은 가로 화면에서는 PC 레이아웃을 그대로 축소해서 사용
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const isCompactViewport = windowWidth < 1025;

    if (!currentUserWithStatus) return null;

    useEffect(() => {
        if (selectedItemForEnhancement) {
            setSelectedItem(selectedItemForEnhancement);
        }
    }, [selectedItemForEnhancement]);

    useEffect(() => {
        setCombinationItems([null, null, null]);
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
            const firstItemGrade = combinationItems[0]?.grade;
            const combinationItemIds = combinationItems.map(i => i?.id).filter(Boolean) as string[];

            return inventory
                .filter(item => {
                    // Disable if already in a combination slot
                    if (combinationItemIds.includes(item.id)) return true;
                    // Disable if equipped
                    if (item.isEquipped) return true;
                    // Disable if grade is too high for blacksmith level
                    if (GRADE_ORDER.indexOf(item.grade) > maxCombinableGradeIndex) return true;
                    // If a first item is selected, disable items of different grades
                    if (firstItemGrade && item.grade !== firstItemGrade) return true;
                    
                    return false;
                })
                .map(item => item.id);
        } else if (activeTab === 'disassemble') {
            // 프리셋에 등록된 장비 ID 수집
            const presetItemIds = new Set<string>();
            if (currentUserWithStatus.equipmentPresets) {
                currentUserWithStatus.equipmentPresets.forEach(preset => {
                    if (preset.equipment) {
                        Object.values(preset.equipment).forEach(itemId => {
                            if (itemId) presetItemIds.add(itemId);
                        });
                    }
                });
            }

            return inventory
                .filter(item => {
                    // Disable if equipped
                    if (item.isEquipped) return true;
                    // Disable if in a preset
                    if (presetItemIds.has(item.id)) return true;
                    
                    return false;
                })
                .map(item => item.id);
        }
        return [];
    }, [activeTab, inventory, combinationItems, maxCombinableGradeIndex, currentUserWithStatus.equipmentPresets]);

    const tabs = [
        { id: 'enhance', label: '장비 강화' },
        { id: 'combine', label: '장비 합성' },
        { id: 'disassemble', label: '장비 분해' },
        { id: 'convert', label: '재료 변환' },
        { id: 'refine', label: '장비 제련' },
    ];

    const handleActionWrapper = useCallback(async (action: ServerAction): Promise<void> => {
        await handlers.handleAction(action);
    }, [handlers.handleAction]);

    const renderContent = () => {
        switch (activeTab) {
            case 'enhance': return <EnhancementView 
                selectedItem={selectedItem} 
                currentUser={currentUserWithStatus} 
                onAction={handlers.handleAction} 
                enhancementOutcome={enhancementOutcome} 
                onOutcomeConfirm={handlers.clearEnhancementOutcome}
                onStartEnhancement={handlers.startEnhancement}
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
            />;
            case 'disassemble': return (
                <DisassemblyView
                    onAction={handleActionWrapper}
                    selectedForDisassembly={selectedForDisassembly}
                    onToggleDisassemblySelection={handleToggleDisassemblySelection}
                />
            );
            case 'convert': return <ConversionView onAction={handleActionWrapper} />;
            case 'refine': return <RefinementView 
                selectedItem={selectedItem} 
                currentUser={currentUserWithStatus} 
                onAction={handlers.handleAction}
                refinementResult={null}
                onResultConfirm={handlers.clearRefinementResult}
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
    const mobileViewerMinHeight = activeTab === 'convert' ? 'min(46dvh, 360px)' : 'min(38dvh, 300px)';
    const mobileInventoryMinHeightClass = activeTab === 'convert' ? 'min-h-[8.25rem] sm:min-h-[9rem]' : 'min-h-[9.5rem] sm:min-h-[10.5rem]';
    const mobileInventoryMaxHeightClass = activeTab === 'convert' ? 'max-h-[min(190px,24vh)]' : 'max-h-[min(220px,28vh)]';

    return (
        <>
            <DraggableWindow 
                title="대장간" 
                onClose={onClose} 
                bodyScrollable={!isNativeMobile}
                bodyNoScroll={isNativeMobile}
                mobileViewportFit={isNativeMobile}
                mobileViewportMaxHeightVh={83}
                hideFooter={isNativeMobile}
                skipSavedPosition={isNativeMobile}
                bodyPaddingClassName={
                    isNativeMobile
                        ? '!px-2 !pt-2 !pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]'
                        : undefined
                }
                isTopmost={
                    isTopmost &&
                    !modals.isBlacksmithHelpOpen &&
                    !modals.isBlacksmithEffectsModalOpen &&
                    !modals.disassemblyResult
                }
                initialWidth={1100}
                initialHeight={isNativeMobile ? 900 : 900}
                windowId="blacksmith"
                zIndex={isNativeMobile ? 120 : 50}
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
                <div className={`flex h-full min-h-0 ${isNativeMobile ? 'flex-1 flex-col' : ''}`}>
                    {isNativeMobile ? (
                        <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-2">
                            <div className="flex shrink-0 items-stretch gap-2">
                                <div className="w-max max-w-[min(46vw,15rem)] shrink-0 rounded-xl border border-cyan-400/25 bg-gradient-to-b from-stone-900/80 to-cyan-950/30 p-1.5 shadow-inner">
                                    <div className="relative w-max max-w-full overflow-hidden rounded-lg border border-cyan-300/30 bg-gradient-to-b from-stone-900/95 to-black/90 shadow-md">
                                        <div className="flex w-max max-w-full items-center justify-center px-1 py-1.5 sm:py-2">
                                            <img
                                                src="/images/equipments/moru.png"
                                                alt="Blacksmith"
                                                className="mx-auto block h-auto max-h-[min(96px,32vw)] w-auto max-w-full object-contain object-center"
                                                decoding="async"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handlers.openBlacksmithEffectsModal()}
                                            title="대장간 효과"
                                            aria-label="대장간 효과 보기"
                                            className="absolute right-1.5 top-1.5 z-[1] max-w-[min(100%,11rem)] rounded-md border border-amber-500/45 bg-black/75 px-2 py-1 text-right shadow-md backdrop-blur-sm transition hover:border-amber-400/70 hover:bg-black/85 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                                        >
                                            <span className="block text-xs font-bold leading-tight text-white drop-shadow-sm sm:text-sm">
                                                대장간{' '}
                                                <span className="text-amber-300">Lv.{blacksmithLevel ?? 1}</span>
                                            </span>
                                        </button>
                                        <div className="absolute inset-x-0 bottom-0 border-t border-amber-500/20 bg-gradient-to-t from-black/90 via-black/78 to-black/20 px-2 pb-1 pt-2.5">
                                            <div className="mb-0.5 flex items-center justify-between text-[11px] font-semibold tabular-nums text-stone-200">
                                                <span className="text-stone-400">경험치</span>
                                                {isMaxLevel ? (
                                                    <span className="text-amber-200/95">{(blacksmithXp ?? 0).toLocaleString()} (Max)</span>
                                                ) : (
                                                    <span>
                                                        {(blacksmithXp ?? 0).toLocaleString()} /{' '}
                                                        {BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(blacksmithLevel ?? 1).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full border border-stone-600/60 bg-black/60 shadow-inner">
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
                                <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-indigo-400/25 bg-gradient-to-b from-slate-900/90 to-indigo-950/40 p-1.5 shadow-inner">
                                    <div className="grid min-h-0 flex-1 grid-cols-2 gap-1 auto-rows-fr content-center">
                                        {tabs.map((tab) => (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => onSetActiveTab(tab.id as 'enhance' | 'combine' | 'disassemble' | 'convert' | 'refine')}
                                                className={`rounded-lg border px-1.5 py-1.5 text-center text-[11px] font-bold leading-tight shadow-sm transition sm:text-xs ${
                                                    activeTab === tab.id
                                                        ? 'border-amber-400/70 bg-gradient-to-br from-amber-600/40 via-amber-500/25 to-orange-900/30 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_14px_-6px_rgba(251,191,36,0.55)]'
                                                        : 'border-stone-600/55 bg-stone-800/50 text-stone-300 hover:border-cyan-500/35 hover:bg-stone-700/55 hover:text-stone-100'
                                                }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div
                                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-color/40 bg-tertiary/20 p-2"
                                style={{ minHeight: mobileViewerMinHeight }}
                            >
                                {renderContent()}
                            </div>

                            <div className="flex min-h-0 shrink-0 flex-col rounded-xl border border-color/40 bg-primary/40 p-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
                                <div className="mb-1.5 flex items-center justify-between gap-2">
                                    <h3 className="text-base font-bold text-on-panel">{bagHeaderText}</h3>
                                    <select
                                        value={sortOption}
                                        onChange={(e) => setSortOption(e.target.value as SortOption)}
                                        className="rounded border border-color bg-secondary px-2 py-1 text-xs text-on-panel"
                                    >
                                        <option value="grade">등급순</option>
                                        <option value="stars">강화순</option>
                                        <option value="name">이름순</option>
                                        <option value="date">최신순</option>
                                    </select>
                                </div>
                                <div className={`${mobileInventoryMinHeightClass} ${mobileInventoryMaxHeightClass} flex-shrink-0 overflow-y-auto overflow-x-hidden pr-1 pb-2.5`}>
                                    <InventoryGrid
                                        inventory={filteredInventory}
                                        inventorySlots={inventorySlotsToDisplay}
                                        onSelectItem={handleSelectItem}
                                        selectedItemId={selectedItem?.id || null}
                                        disabledItemIds={disabledItemIds}
                                        selectedItemIdsForDisassembly={activeTab === 'disassemble' ? selectedForDisassembly : undefined}
                                        onToggleDisassemblySelection={activeTab === 'disassemble' ? handleToggleDisassemblySelection : undefined}
                                        columnCount={8}
                                        gapPx={6}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                    <>
                    {/* Left Panel */}
                    <div className={`w-[360px] bg-tertiary/30 p-4 flex flex-col items-center gap-4 flex-shrink-0 overflow-hidden`}>
                        <div className="w-full aspect-w-3 aspect-h-2 prism-border rounded-lg overflow-hidden relative flex-shrink-0">
                            <img src="/images/equipments/moru.png" alt="Blacksmith" className="w-full h-full object-cover" />
                        </div>
                        <div className="text-center">
                            <h2 className={`text-2xl font-bold`}>대장간 <span className="text-yellow-400">Lv.{(blacksmithLevel ?? 1)}</span></h2>
                        </div>
                        <div className="w-full">
                            <div className={`flex justify-between text-xs mb-1`}>
                                <span>경험치</span>
                                {isMaxLevel ? (
                                    <span>{(blacksmithXp ?? 0).toLocaleString()}(Max)</span>
                                ) : (
                                    <span>{(blacksmithXp ?? 0)} / {BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(blacksmithLevel ?? 1)} ({Math.round(((blacksmithXp ?? 0) / BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(blacksmithLevel ?? 1)) * 100)}%)</span>
                                )}
                            </div>
                            <div className={`w-full bg-black/50 rounded-full h-3 border border-color`}>
                                <div className="bg-yellow-500 h-full rounded-full transition-all" style={{ width: isMaxLevel ? '100%' : `${((blacksmithXp ?? 0) / BLACKSMITH_XP_REQUIRED_FOR_LEVEL_UP(blacksmithLevel ?? 1)) * 100}%` }}></div>
                            </div>
                        </div>
                        <div className="w-full flex-1 min-h-0 overflow-y-auto">
                            <BlacksmithLevelEffectsSummary blacksmithLevel={blacksmithLevel ?? 1} />
                        </div>
                    </div>

                    {/* Right Panel */}
                    <div className={`flex-1 bg-primary p-4 flex flex-col min-w-0 min-h-0`}>
                        <div className={`flex border-b border-color mb-4`}>
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => onSetActiveTab(tab.id as 'enhance' | 'combine' | 'disassemble' | 'convert' | 'refine')}
                                    className={`px-4 py-2 text-sm font-semibold ${
                                        activeTab === tab.id
                                            ? 'border-b-2 border-accent text-accent'
                                            : 'text-secondary hover:bg-secondary/20'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div className={`p-4 bg-tertiary/20 rounded-lg flex-1 min-h-0 overflow-hidden`}>
                            {renderContent()}
                        </div>
                        <div className={`mt-4 flex flex-col`}>
                            <div className={`flex items-center justify-between mb-2`}>
                                <h3 className={`text-lg font-bold text-on-panel`}>{bagHeaderText}</h3>
                                <select
                                    value={sortOption}
                                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                                    className={`bg-secondary border border-color text-on-panel text-xs rounded px-2 py-1`}
                                >
                                    <option value="grade">등급순</option>
                                    <option value="stars">강화순</option>
                                    <option value="name">이름순</option>
                                    <option value="date">최신순</option>
                                </select>
                            </div>
                            <div className={`h-[130px] overflow-y-auto pr-1`}>
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

            <RefinementResultModal
                result={modals.refinementResult}
                onClose={handlers.clearRefinementResult}
                isTopmost
            />
        </>
    );
};

export default BlacksmithModal;