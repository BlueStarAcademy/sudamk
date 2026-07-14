import React, { useState, useMemo, useEffect } from 'react';
import { useLocalizedItemGrade, useLocalizedEquipmentSlot } from '../../shared/i18n/localizedCatalog.js';
import { useTranslation } from 'react-i18next';
import { InventoryItem, ServerAction, ItemGrade } from '../../types.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import ResourceActionButton from '../ui/ResourceActionButton.js';
import DraggableWindow from '../DraggableWindow.js';
import ConfirmModal from '../ConfirmModal.js';
import {
    getEnhancementCostRowForDisassembly,
    getCumulativeEnhancementMaterialsSpentToReachStars,
    MATERIAL_ITEMS,
} from '../../constants';
import { BLACKSMITH_DISASSEMBLY_JACKPOT_RATES } from '../../constants/rules.js';
import { formatBlacksmithPercentInt } from '../../shared/utils/formatBlacksmithPercentInt.js';
import { getBlacksmithViewerTypography, BLACKSMITH_MOBILE_WORK_ROOT_CLASS } from '../../shared/constants/blacksmithViewerTypography.js';
import {
    GRADE_SLOT_BORDER_OVERLAY_POSITION_CLASS,
    gradeSlotBorderOverlayClass,
    itemSlotIconStyle,
    ITEM_SLOT_ICON_SIZE_PCT,
} from '../../shared/constants/itemSlotIconLayout.js';

const gradeStyles: Record<ItemGrade, { color: string; background: string }> = {
    normal: { color: 'text-gray-300', background: '/images/equipments/normalbgi.webp' },
    uncommon: { color: 'text-green-400', background: '/images/equipments/uncommonbgi.webp' },
    rare: { color: 'text-blue-400', background: '/images/equipments/rarebgi.webp' },
    epic: { color: 'text-purple-400', background: '/images/equipments/epicbgi.webp' },
    legendary: { color: 'text-red-500', background: '/images/equipments/legendarybgi.webp' },
    mythic: { color: 'text-amber-400', background: '/images/equipments/mythicbgi.webp' },
    transcendent: { color: 'text-cyan-300', background: '/images/equipments/transcendentbgi.webp' },
};

function formatDisassemblyExpectedYield(min: number, max: number): string {
    const lo = Math.trunc(min);
    const hi = Math.trunc(max);
    if (lo === hi) return lo.toLocaleString();
    return `${lo.toLocaleString()}~${hi.toLocaleString()}`;
}

/** 하단 장비 인벤토리 그리드와 동일한 별 표시 (`compact`: 44px 선택 칸용) */
const renderStarDisplay = (stars: number, compact?: boolean) => {
    if (stars === 0) return null;

    let starImage = '';
    let numberColor = '';

    if (stars >= 10) {
        starImage = '/images/equipments/Star4.webp';
        numberColor = 'prism-text-effect';
    } else if (stars >= 7) {
        starImage = '/images/equipments/Star3.webp';
        numberColor = 'text-purple-400';
    } else if (stars >= 4) {
        starImage = '/images/equipments/Star2.webp';
        numberColor = 'text-amber-400';
    } else if (stars >= 1) {
        starImage = '/images/equipments/Star1.webp';
        numberColor = 'text-white';
    }

    return (
        <div
            className={`absolute z-10 flex items-center rounded-bl-md bg-black/45 backdrop-blur-[2px] ${
                compact
                    ? 'right-0.5 top-0.5 gap-0 px-0.5 py-0'
                    : 'right-1.5 top-0.5 gap-0.5 px-1 py-0.5'
            }`}
            style={{ textShadow: '1px 1px 2px black' }}
        >
            <img src={starImage} alt="" className={compact ? 'h-2 w-2' : 'h-3 w-3'} />
            <span className={`font-bold leading-none ${compact ? 'text-[9px]' : 'text-xs'} ${numberColor}`}>{stars}</span>
        </div>
    );
};

/** 하단 대장간 장비 인벤(10열·130px 높이) 셀과 비슷하게 맞춘 고정 크기 */
const getSelectedDisassemblyCellPx = (pcViewer: boolean) => (pcViewer ? 72 : 58);

/** 인벤토리 슬롯과 동일: 등급 배경판 + 장비 이미지(+초월 오버레이·강화 별) */
const DisassemblySelectedInventoryCell: React.FC<{
    item: InventoryItem;
    onToggleDisassemblySelection: (itemId: string) => void;
    pcViewer?: boolean;
}> = ({ item, onToggleDisassemblySelection, pcViewer = false }) => {
    const { t } = useTranslation('blacksmith');
    const styles = gradeStyles[item.grade];
    const cellPx = getSelectedDisassemblyCellPx(pcViewer);
    const compactStars = cellPx < 64;
    return (
        <button
            type="button"
            onClick={() => onToggleDisassemblySelection(item.id)}
            title={t('disassemble.deselect')}
            aria-label={t('disassemble.deselectAria', { name: item.name })}
            className="relative mx-auto aspect-square w-full cursor-pointer overflow-hidden rounded-md border-2 border-black/20 transition-all duration-200 hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
            style={{ maxWidth: cellPx }}
        >
            <img
                src={styles.background}
                alt=""
                className="absolute inset-0 z-0 rounded-sm object-cover"
                style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }}
            />
            {item.image && (
                <img
                    src={item.image}
                    alt=""
                    className="absolute z-[1] object-contain"
                    style={itemSlotIconStyle(ITEM_SLOT_ICON_SIZE_PCT)}
                />
            )}
            <div
                className={`${GRADE_SLOT_BORDER_OVERLAY_POSITION_CLASS} ${gradeSlotBorderOverlayClass(item.grade)}`}
                aria-hidden
            />
            {renderStarDisplay(item.stars ?? 0, compactStars)}
        </button>
    );
};

const SelectedDisassemblyItemsPanel: React.FC<{
    selectedIds: Set<string>;
    inventory: InventoryItem[];
    onToggleDisassemblySelection: (itemId: string) => void;
    onOpenAutoSelect?: () => void;
    pcViewer?: boolean;
    mobileWork?: boolean;
}> = ({ selectedIds, inventory, onToggleDisassemblySelection, onOpenAutoSelect, pcViewer = false, mobileWork = false }) => {
    const { t } = useTranslation('blacksmith');
    const typo = getBlacksmithViewerTypography(pcViewer, { mobileWork });
    const items = useMemo(
        () => inventory.filter(item => selectedIds.has(item.id)),
        [inventory, selectedIds]
    );

    return (
        <div className="flex h-full min-h-0 w-full flex-col rounded-xl border border-amber-400/20 bg-gradient-to-b from-[#171d2b]/85 via-[#101524]/92 to-[#0a0e17]/95 p-2">
            <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2 px-0.5">
                <p className={`${typo.heading} text-center flex-1 text-cyan-200/90`}>{t('disassemble.selectedGear')}</p>
                <span className={`${typo.body} shrink-0 text-slate-400`}>{t('disassemble.itemCount', { count: items.length })}</span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-600/35 bg-tertiary/30 pr-1">
                {items.length === 0 ? (
                    <div className={`flex flex-1 items-center justify-center px-2 py-2 text-center ${typo.body} text-slate-500`}>
                        인벤토리에서 분해할 장비를 선택하세요
                    </div>
                ) : (
                    <div className={`grid h-full min-h-0 auto-rows-max ${pcViewer ? 'grid-cols-4' : 'grid-cols-5'} justify-items-center gap-2 overflow-y-auto overflow-x-hidden p-2 [scrollbar-gutter:stable]`}>
                        {items.map(item => (
                            <DisassemblySelectedInventoryCell
                                key={item.id}
                                item={item}
                                onToggleDisassemblySelection={onToggleDisassemblySelection}
                                pcViewer={pcViewer}
                            />
                        ))}
                    </div>
                )}
            </div>
            {onOpenAutoSelect ? (
                <div className="mt-3 flex shrink-0 justify-center border-t border-slate-600/35 pt-3">
                    <button
                        type="button"
                        onClick={onOpenAutoSelect}
                        className={`whitespace-nowrap rounded-md border border-amber-300/40 bg-gradient-to-r from-amber-600/90 via-amber-500/90 to-orange-500/85 px-4 py-2.5 font-bold text-amber-50 shadow-[0_10px_22px_-14px_rgba(251,191,36,0.75)] transition hover:from-amber-500 hover:via-amber-400 hover:to-orange-400 ${typo.bodySemi}`}
                    >
                        자동 선택
                    </button>
                </div>
            ) : null}
        </div>
    );
};

const DisassemblyPreviewPanel: React.FC<{
    selectedIds: Set<string>;
    inventory: InventoryItem[];
    blacksmithLevel: number;
    /** 네이티브 모바일: 선택 장비 목록 없이 재료 영역 위주·가독성 강화 */
    nativeMobile?: boolean;
    /** 장비 선택을 모달에서만 하는 모바일 대장간 플로우 */
    modalEquipmentSelectionFlow?: boolean;
    onDisassemble: () => void;
    selectedCount: number;
    pcViewer?: boolean;
    isBlacksmithBusy?: boolean;
}> = ({
    selectedIds,
    inventory,
    blacksmithLevel,
    nativeMobile,
    modalEquipmentSelectionFlow,
    onDisassemble,
    selectedCount,
    pcViewer = false,
    isBlacksmithBusy = false,
}) => {
    const { t } = useTranslation('blacksmith');
    const typo = getBlacksmithViewerTypography(pcViewer && !nativeMobile);
    const jackpotRatePct = BLACKSMITH_DISASSEMBLY_JACKPOT_RATES[Math.max(0, blacksmithLevel - 1)];
    const jackpotHint = t('disassemble.jackpotHint', { rate: formatBlacksmithPercentInt(jackpotRatePct) });

    const { rangeMap, totalMaterials, itemCount } = useMemo(() => {
        const selectedItems = inventory.filter(item => selectedIds.has(item.id));
        const materials: Record<string, number> = {};
        const ranges: Record<string, { min: number; max: number }> = {};

        for (const item of selectedItems) {
            const costsForNextLevel = getEnhancementCostRowForDisassembly(item.grade, item.stars);
            if (costsForNextLevel) {
                for (const cost of costsForNextLevel) {
                    const minYield = Math.max(1, Math.floor(cost.amount * 0.1));
                    const maxYield = Math.max(minYield, Math.floor(cost.amount * 0.2));

                    if (!ranges[cost.name]) {
                        ranges[cost.name] = { min: 0, max: 0 };
                    }

                    ranges[cost.name].min += minYield;
                    ranges[cost.name].max += maxYield;
                }
            }

            const spentTotals = getCumulativeEnhancementMaterialsSpentToReachStars(item.grade, item.stars);
            for (const [name, totalSpent] of Object.entries(spentTotals)) {
                const invested = Math.floor(totalSpent * 0.1);
                if (invested <= 0) continue;
                if (!ranges[name]) {
                    ranges[name] = { min: 0, max: 0 };
                }
                ranges[name].min += invested;
                ranges[name].max += invested;
            }
        }

        Object.entries(ranges).forEach(([name, value]) => {
            const minYield = Math.trunc(value.min);
            const maxYield = Math.trunc(value.max);
            const avgYield = Math.max(minYield, Math.round((minYield + maxYield) / 2));
            materials[name] = avgYield;
            ranges[name] = { min: minYield, max: maxYield };
        });

        return {
            rangeMap: ranges,
            totalMaterials: Object.entries(materials).map(([name, amount]) => ({ name, amount })),
            itemCount: selectedItems.length
        };
    }, [selectedIds, inventory]);

    const mobileEmptyHint =
        itemCount === 0
            ? modalEquipmentSelectionFlow
                ? t('disassemble.reopenHint')
                : t('disassemble.pickHint')
            : null;

    return (
        <div
            className={`flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-br from-[#1d243b] via-[#121a2d] to-[#0b1120] ${
                nativeMobile ? 'gap-2 p-2.5' : 'gap-2 p-3'
            }`}
        >
            <div className="flex-shrink-0 space-y-1.5 text-center">
                <p
                    className={`font-semibold ${
                        nativeMobile ? 'text-base font-bold text-cyan-100' : `${typo.headingLg} text-amber-100`
                    }`}
                >
                    예상 획득 재료
                </p>
                {nativeMobile && mobileEmptyHint ? (
                    <p className="text-[13px] leading-snug text-slate-300/95">{mobileEmptyHint}</p>
                ) : null}
            </div>

            <div
                className={`flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-xl border border-slate-600/30 bg-[#0f1627] shadow-inner [scrollbar-gutter:stable] ${
                    nativeMobile ? 'gap-2 p-2' : 'gap-2 p-2.5'
                }`}
            >
                {totalMaterials.length > 0 ? (
                    <div className={nativeMobile ? 'space-y-2' : 'space-y-3'}>
                        {totalMaterials.map(({ name }) => {
                            const template = MATERIAL_ITEMS[name as keyof typeof MATERIAL_ITEMS];
                            const range = rangeMap[name];
                            return (
                                <div
                                    key={name}
                                    className={`flex items-center justify-between gap-2 rounded-lg border border-slate-600/30 bg-slate-800/40 ${
                                        nativeMobile ? 'px-2.5 py-2.5' : 'gap-3 px-2 py-1.5'
                                    }`}
                                >
                                    <div
                                        className={`flex min-w-0 items-center gap-2.5 text-slate-100 ${
                                            nativeMobile ? 'text-sm' : `gap-3 ${typo.body}`
                                        }`}
                                    >
                                        <div
                                            className={`flex-shrink-0 rounded-lg border border-slate-600/40 bg-slate-900/50 ${
                                                nativeMobile ? 'h-10 w-10' : 'h-8 w-8'
                                            } flex items-center justify-center overflow-hidden`}
                                        >
                                            {template?.image && (
                                                <img
                                                    src={template.image}
                                                    alt=""
                                                    className={nativeMobile ? 'h-8 w-8 object-contain' : 'h-6 w-6 object-contain'}
                                                />
                                            )}
                                        </div>
                                        <span className="min-w-0 truncate font-medium">{name}</span>
                                    </div>
                                    <span
                                        className={`flex-shrink-0 font-mono tabular-nums text-emerald-300 ${
                                            nativeMobile ? 'text-[15px] font-semibold' : typo.bodySemi
                                        }`}
                                    >
                                        {range ? formatDisassemblyExpectedYield(range.min, range.max) : '0'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div
                        className={`flex flex-1 items-center justify-center text-center ${
                            nativeMobile ? 'px-2 text-sm leading-relaxed text-slate-300' : `${typo.body} text-slate-400`
                        }`}
                    >
                        {itemCount === 0
                            ? t('disassemble.previewHint')
                            : t('disassemble.noReward')}
                    </div>
                )}
            </div>

            <div className={`flex flex-shrink-0 flex-col items-stretch ${nativeMobile ? 'gap-2 pt-2' : 'gap-2.5 pt-2.5'}`}>
                <p
                    className={`text-center font-semibold leading-snug text-amber-100/95 ${
                        nativeMobile ? 'rounded-md border border-amber-400/25 bg-[#0f172a]/90 px-2 py-2 text-[11px]' : typo.body
                    }`}
                    title={t('disassemble.jackpotTitle')}
                >
                    {jackpotHint}
                </p>
                <ResourceActionButton
                    type="button"
                    onClick={onDisassemble}
                    disabled={selectedCount === 0 || isBlacksmithBusy}
                    variant="materials"
                    className={`mx-auto w-auto min-w-[9.5rem] min-h-[44px] !rounded-lg !border !border-rose-300/45 !bg-gradient-to-r !from-rose-600/90 !via-rose-500/90 !to-orange-500/85 !px-3 !py-2.5 !text-sm !font-bold !text-rose-50 !shadow-[0_14px_26px_-18px_rgba(244,63,94,0.85)] hover:!from-rose-500 hover:!via-rose-400 hover:!to-orange-400 disabled:!opacity-50 disabled:!cursor-not-allowed leading-snug`}
                >
                    {isBlacksmithBusy ? t('disassemble.disassembling') : t('disassemble.disassembleBtn', { count: selectedCount })}
                </ResourceActionButton>
            </div>
        </div>
    );
};

const GRADES_FOR_SELECTION: ItemGrade[] = [ItemGrade.Normal, ItemGrade.Uncommon, ItemGrade.Rare, ItemGrade.Epic, ItemGrade.Legendary];

/** 대장간·피커 등에서 공통으로 사용: 등급 조건에 맞는 분해 대상을 토글로 반영 */
export function applyDisassemblyAutoSelectByGrades(
    grades: ItemGrade[],
    inventory: InventoryItem[],
    equipmentPresets: { equipment?: Record<string, string | null | undefined> }[] | undefined,
    onToggleDisassemblySelection: (itemId: string) => void
): void {
    const presetItemIds = new Set<string>();
    if (equipmentPresets) {
        equipmentPresets.forEach(preset => {
            if (preset.equipment) {
                Object.values(preset.equipment).forEach(itemId => {
                    if (itemId) presetItemIds.add(itemId);
                });
            }
        });
    }

    const itemsToSelect = inventory
        .filter(
            item =>
                item.type === 'equipment' &&
                !item.isEquipped &&
                !presetItemIds.has(item.id) &&
                grades.includes(item.grade)
        )
        .map(item => item.id);

    itemsToSelect.forEach(id => onToggleDisassemblySelection(id));
}

export const DisassemblyAutoSelectModal: React.FC<{
    onClose: () => void;
    onConfirm: (selectedGrades: ItemGrade[]) => void;
    isTopmost?: boolean;
    zIndex?: number;
}> = ({ onClose, onConfirm, isTopmost = true, zIndex = 70 }) => {
    const { t } = useTranslation('blacksmith');
    const localizedGrade = useLocalizedItemGrade();
    const [selectedGrades, setSelectedGrades] = useState<ItemGrade[]>([]);

    const handleToggleGrade = (grade: ItemGrade) => {
        setSelectedGrades(prev =>
            prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
        );
    };

    const handleConfirmClick = () => {
        onConfirm(selectedGrades);
        onClose();
    };

    return (
        <DraggableWindow
            title={t('disassemble.autoSelectTitle')}
            onClose={onClose}
            windowId="disassembly-auto-select"
            initialWidth={400}
            isTopmost={isTopmost}
            zIndex={zIndex}
            variant="store"
        >
            <div className="text-on-panel">
                <p className="text-sm text-tertiary mb-4 text-center">{t('disassemble.gradeSelectHint')}</p>
                <div className="grid grid-cols-2 gap-3">
                    {GRADES_FOR_SELECTION.map(grade => {
                        return (
                            <label key={grade} className="flex items-center gap-3 p-3 bg-gradient-to-br from-[#1b243c] via-[#161f33] to-[#0f1626] rounded-lg cursor-pointer border border-slate-500/30 shadow-inner has-[:checked]:border-cyan-300/80">
                                <input
                                    type="checkbox"
                                    checked={selectedGrades.includes(grade)}
                                    onChange={() => handleToggleGrade(grade)}
                                    className="w-5 h-5 text-accent bg-secondary border-color rounded focus:ring-accent"
                                />
                                <span className={`font-semibold`}>{localizedGrade(grade)}</span>
                            </label>
                        );
                    })}
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-500/40">
                    <ResourceActionButton onClick={onClose} variant="neutral" className="!w-auto !px-5 !py-2 text-sm">
                        취소
                    </ResourceActionButton>
                    <ResourceActionButton onClick={handleConfirmClick} variant="accent" className="!w-auto !px-5 !py-2 text-sm" disabled={selectedGrades.length === 0}>
                        선택 완료
                    </ResourceActionButton>
                </div>
            </div>
        </DraggableWindow>
    );
};

interface DisassemblyViewProps {
    onAction: (action: ServerAction) => Promise<void>;
    selectedForDisassembly: Set<string>;
    onToggleDisassemblySelection: (itemId: string) => void;
    onOpenAutoSelect?: () => void;
    modalEquipmentSelectionFlow?: boolean;
    pcViewer?: boolean;
    isBlacksmithBusy?: boolean;
}

const DisassemblyView: React.FC<DisassemblyViewProps> = ({
    onAction,
    selectedForDisassembly = new Set(),
    onToggleDisassemblySelection,
    onOpenAutoSelect,
    modalEquipmentSelectionFlow = false,
    pcViewer = false,
    isBlacksmithBusy = false,
}) => {
    const { t } = useTranslation('blacksmith');
    const localizedGrade = useLocalizedItemGrade();
    const { isNativeMobile } = useNativeMobileShell();
    const { currentUserWithStatus } = useAppContext();
    const [viewportNarrow, setViewportNarrow] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < 1025
    );
    useEffect(() => {
        const sync = () => setViewportNarrow(window.innerWidth < 1025);
        sync();
        window.addEventListener('resize', sync);
        return () => window.removeEventListener('resize', sync);
    }, []);
    const useStackedDisassemblyLayout = isNativeMobile || viewportNarrow;
    const [confirmState, setConfirmState] = useState<{
        step: 'danger' | 'final';
        message: string;
    } | null>(null);

    if (!currentUserWithStatus) return null;

    const { inventory } = currentUserWithStatus;

    const handleDisassemble = () => {
        if (selectedForDisassembly.size === 0) return;

        const selectedItems = Array.from(selectedForDisassembly)
            .map(itemId => inventory.find((i: InventoryItem) => i.id === itemId))
            .filter((item): item is InventoryItem => item !== undefined);

        const hasHighGrade = selectedItems.some(item => 
            item.grade === 'legendary' || item.grade === 'mythic'
        );
        
        const hasHighStars = selectedItems.some(item => 
            (item.stars || 0) >= 7
        );
    
        if (hasHighGrade || hasHighStars) {
            const reasons: string[] = [];
            if (hasHighGrade) reasons.push(t('disassemble.legendaryIncluded'));
            if (hasHighStars) reasons.push(t('disassemble.highStarsIncluded'));
            setConfirmState({
                step: 'danger',
                message: t('disassemble.confirmMixed', { reasons: reasons.join(', ') }),
            });
            return;
        }

        setConfirmState({
            step: 'final',
            message: t('disassemble.confirmCount', { count: selectedForDisassembly.size }),
        });
    };

    const executeDisassemble = () => {
        void onAction({ type: 'DISASSEMBLE_ITEM', payload: { itemIds: Array.from(selectedForDisassembly) } });
    };

    return (
        <div className={`flex h-full min-h-0 flex-col ${useStackedDisassemblyLayout ? `${BLACKSMITH_MOBILE_WORK_ROOT_CLASS} min-h-[min(72dvh,100%)]` : ''}`}>
            <div
                className={`grid min-h-0 w-full min-w-0 flex-1 gap-2.5 ${
                    useStackedDisassemblyLayout
                        ? '[grid-template-rows:repeat(2,minmax(0,1fr))]'
                        : '[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)]'
                }`}
            >
                <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                    <SelectedDisassemblyItemsPanel
                        selectedIds={selectedForDisassembly}
                        inventory={inventory}
                        onToggleDisassemblySelection={onToggleDisassemblySelection}
                        onOpenAutoSelect={onOpenAutoSelect}
                        pcViewer={pcViewer}
                        mobileWork={useStackedDisassemblyLayout}
                    />
                </div>
                <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                    <DisassemblyPreviewPanel
                        selectedIds={selectedForDisassembly}
                        inventory={inventory}
                        blacksmithLevel={currentUserWithStatus.blacksmithLevel ?? 1}
                        nativeMobile={useStackedDisassemblyLayout}
                        modalEquipmentSelectionFlow={modalEquipmentSelectionFlow}
                        onDisassemble={handleDisassemble}
                        selectedCount={selectedForDisassembly.size}
                        pcViewer={pcViewer}
                        isBlacksmithBusy={isBlacksmithBusy}
                    />
                </div>
            </div>
            {confirmState && (
                <ConfirmModal
                    title={t('disassemble.confirmTitle')}
                    message={confirmState.message}
                    onCancel={() => setConfirmState(null)}
                    onConfirm={() => {
                        if (confirmState.step === 'danger') {
                            setConfirmState({
                                step: 'final',
                                message: t('disassemble.confirmCount', { count: selectedForDisassembly.size }),
                            });
                            return;
                        }
                        setConfirmState(null);
                        executeDisassemble();
                    }}
                    confirmText={t('disassemble.confirmBtn')}
                    cancelText={t('actions.cancel', { ns: 'common' })}
                    confirmColorScheme="red"
                    isTopmost
                    windowId="disassembly-confirm-modal"
                    variant={confirmState.step === 'danger' ? 'premium-danger' : 'default'}
                />
            )}
        </div>
    );
};

export default DisassemblyView;
