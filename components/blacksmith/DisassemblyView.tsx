import React, { useState, useMemo } from 'react';
import { InventoryItem, ServerAction, ItemGrade } from '../../types.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import ResourceActionButton from '../ui/ResourceActionButton.js';
import DraggableWindow from '../DraggableWindow.js';
import { getEnhancementCostRowForDisassembly, MATERIAL_ITEMS } from '../../constants';
import { BLACKSMITH_DISASSEMBLY_JACKPOT_RATES } from '../../constants/rules.js';

const gradeStyles: Record<ItemGrade, { color: string; background: string }> = {
    normal: { color: 'text-gray-300', background: '/images/equipments/normalbgi.png' },
    uncommon: { color: 'text-green-400', background: '/images/equipments/uncommonbgi.png' },
    rare: { color: 'text-blue-400', background: '/images/equipments/rarebgi.png' },
    epic: { color: 'text-purple-400', background: '/images/equipments/epicbgi.png' },
    legendary: { color: 'text-red-500', background: '/images/equipments/legendarybgi.png' },
    mythic: { color: 'text-orange-400', background: '/images/equipments/mythicbgi.png' },
    transcendent: { color: 'text-cyan-300', background: '/images/equipments/mythicbgi.png' },
};

const GRADE_NAMES_KO: Record<ItemGrade, string> = {
    normal: '일반',
    uncommon: '고급',
    rare: '희귀',
    epic: '에픽',
    legendary: '전설',
    mythic: '신화',
    transcendent: '초월',
};

const SelectedDisassemblyItemsPanel: React.FC<{
    selectedIds: Set<string>;
    inventory: InventoryItem[];
}> = ({ selectedIds, inventory }) => {
    const items = useMemo(
        () => inventory.filter(item => selectedIds.has(item.id)),
        [inventory, selectedIds]
    );

    return (
        <div className="min-h-0 flex-shrink-0 rounded-xl border border-amber-400/20 bg-gradient-to-b from-[#171d2b]/85 via-[#101524]/92 to-[#0a0e17]/95 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-cyan-200/90">선택된 장비</p>
                <span className="text-[11px] text-slate-400">{items.length.toLocaleString()}개</span>
            </div>
            {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-600/50 bg-[#0b1120]/80 py-6 text-center text-xs text-slate-500">
                    인벤토리에서 분해할 장비를 선택하세요
                </div>
            ) : (
                <ul className="max-h-[min(200px,28vh)] space-y-2 overflow-y-auto pr-1">
                    {items.map(item => {
                        const styles = gradeStyles[item.grade];
                        const isTranscendent = item.grade === ItemGrade.Transcendent;
                        return (
                            <li
                                key={item.id}
                                className="flex items-center gap-3 rounded-lg border border-slate-600/30 bg-slate-900/50 px-2 py-1.5"
                            >
                                <div
                                    className={`relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-slate-500/40 ${
                                        isTranscendent ? 'transcendent-grade-slot' : ''
                                    }`}
                                >
                                    <img
                                        src={styles.background}
                                        alt=""
                                        className="absolute inset-0 h-full w-full rounded-lg object-cover"
                                    />
                                    {item.image && (
                                        <img
                                            src={item.image}
                                            alt=""
                                            className="absolute left-1/2 top-1/2 object-contain p-0.5"
                                            style={{ width: '78%', height: '78%', transform: 'translate(-50%, -50%)' }}
                                        />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className={`truncate text-sm font-bold ${styles.color}`} title={item.name}>
                                        {item.name}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        {GRADE_NAMES_KO[item.grade]} · +{item.stars ?? 0}
                                    </p>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

const DisassemblyPreviewPanel: React.FC<{
    selectedIds: Set<string>;
    inventory: InventoryItem[];
    blacksmithLevel: number;
    /** 네이티브 모바일: 선택 장비 목록 없이 재료 영역 위주·가독성 강화 */
    nativeMobile?: boolean;
}> = ({ selectedIds, inventory, blacksmithLevel, nativeMobile }) => {
    const { rangeMap, totalMaterials, itemCount } = useMemo(() => {
        const selectedItems = inventory.filter(item => selectedIds.has(item.id));
        const materials: Record<string, number> = {};
        const ranges: Record<string, { min: number; max: number }> = {};

        for (const item of selectedItems) {
            const costsForNextLevel = getEnhancementCostRowForDisassembly(item.grade, item.stars);
            if (costsForNextLevel) {
                for (const cost of costsForNextLevel) {
                    const minYield = Math.max(1, Math.floor(cost.amount * 0.20));
                    const maxYield = Math.max(minYield, Math.floor(cost.amount * 0.50));

                    if (!ranges[cost.name]) {
                        ranges[cost.name] = { min: 0, max: 0 };
                    }

                    ranges[cost.name].min += minYield;
                    ranges[cost.name].max += maxYield;
                }
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

    const mobileSubline =
        itemCount === 0
            ? '아래 장비 인벤토리에서 분해할 장비를 선택(체크)하세요.'
            : '재료별 최소~최대(같은 이름은 합산)';

    return (
        <div
            className={`flex h-full min-h-0 flex-col rounded-2xl border border-amber-400/20 bg-gradient-to-br from-[#1d243b] via-[#121a2d] to-[#0b1120] ${
                nativeMobile ? 'gap-2 p-3' : 'gap-3 p-4'
            }`}
        >
            <div className="flex-shrink-0 space-y-1">
                {nativeMobile ? (
                    <>
                        <p className="text-base font-bold text-cyan-100">예상 획득 재료</p>
                        <p className="text-[13px] leading-snug text-slate-300/95">
                            {itemCount > 0 && (
                                <span className="font-semibold text-cyan-200/95">선택 {itemCount.toLocaleString()}개 · </span>
                            )}
                            {mobileSubline}
                        </p>
                    </>
                ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-amber-100">예상 획득 재료</p>
                        <span className="text-[11px] text-slate-400">
                            대상 {itemCount.toLocaleString()}개 · 범위(최소~최대)
                        </span>
                    </div>
                )}
            </div>

            <div
                className={`flex min-h-0 flex-1 flex-col overflow-y-auto rounded-xl border border-slate-600/30 bg-[#0f1627] shadow-inner ${
                    nativeMobile ? 'gap-2 p-2.5' : 'gap-3 p-3'
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
                                            nativeMobile ? 'text-sm' : 'gap-3 text-sm'
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
                                            nativeMobile ? 'text-[15px] font-semibold' : 'text-sm'
                                        }`}
                                    >
                                        {range ? `${range.min.toLocaleString()}~${range.max.toLocaleString()}` : '0'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div
                        className={`flex flex-1 items-center justify-center text-center ${
                            nativeMobile ? 'px-2 text-sm leading-relaxed text-slate-300' : 'text-sm text-slate-400'
                        }`}
                    >
                        {itemCount === 0
                            ? '장비를 선택하면 예상 재료가 표시됩니다.'
                            : '분해 시 획득할 재료가 없습니다.'}
                    </div>
                )}
            </div>

            <div
                className={`flex-shrink-0 rounded-xl border border-amber-400/20 bg-[#0f172a] text-center text-amber-100/90 ${
                    nativeMobile ? 'px-2.5 py-2 text-[11px] leading-snug' : 'px-3 py-2 text-[11px]'
                }`}
            >
                분해 시 <span className="font-semibold text-emerald-300">{BLACKSMITH_DISASSEMBLY_JACKPOT_RATES[Math.max(0, blacksmithLevel - 1)]}%</span> 확률로
                <span className="font-semibold text-amber-200"> 대박</span>이 나면 모든 재료가 2배입니다.
            </div>
        </div>
    );
};

const GRADES_FOR_SELECTION: ItemGrade[] = [ItemGrade.Normal, ItemGrade.Uncommon, ItemGrade.Rare, ItemGrade.Epic, ItemGrade.Legendary];

const AutoSelectModal: React.FC<{ onClose: () => void; onConfirm: (selectedGrades: ItemGrade[]) => void; }> = ({ onClose, onConfirm }) => {
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
        <DraggableWindow title="분해 자동 선택" onClose={onClose} windowId="disassembly-auto-select" initialWidth={400} isTopmost variant="store">
            <div className="text-on-panel">
                <p className="text-sm text-tertiary mb-4 text-center">분해할 장비 등급을 선택하세요. 신화 등급은 제외됩니다.</p>
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
                                <span className={`font-semibold`}>{GRADE_NAMES_KO[grade]}</span>
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
}

const DisassemblyView: React.FC<DisassemblyViewProps> = ({ onAction, selectedForDisassembly = new Set(), onToggleDisassemblySelection }) => { // Added default value
    const { isNativeMobile } = useNativeMobileShell();
    const { currentUserWithStatus } = useAppContext();
    const [isAutoSelectOpen, setIsAutoSelectOpen] = useState(false);

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
            if (hasHighGrade) reasons.push('전설 등급 이상의 장비');
            if (hasHighStars) reasons.push('7강화 이상의 장비');
            
            if (!window.confirm(`${reasons.join(', ')}가 포함되어 있습니다. 정말 분해하시겠습니까?`)) {
                return;
            }
        }

        if (window.confirm(`${selectedForDisassembly.size}개의 아이템을 분해하시겠습니까?`)) {
            onAction({ type: 'DISASSEMBLE_ITEM', payload: { itemIds: Array.from(selectedForDisassembly) } });
            // No need to clear selectedForDisassembly here, as it's managed by BlacksmithModal
            // and will be cleared when the action is processed and state updates.
        }
    };

    const handleAutoSelectConfirm = (grades: ItemGrade[]) => {
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

        const itemsToSelect = inventory.filter(item =>
            item.type === 'equipment' &&
            !item.isEquipped &&
            !presetItemIds.has(item.id) &&
            grades.includes(item.grade)
        ).map(item => item.id);

        itemsToSelect.forEach(id => onToggleDisassemblySelection(id)); // Use the prop function

        setIsAutoSelectOpen(false);
    };

    return (
        <div className="flex h-full min-h-0 flex-col">
            {isAutoSelectOpen && (
                <AutoSelectModal
                    onClose={() => setIsAutoSelectOpen(false)}
                    onConfirm={handleAutoSelectConfirm}
                />
            )}
            <div
                className={`flex min-h-0 flex-1 gap-3 ${
                    isNativeMobile ? 'flex-col' : 'flex-row sm:items-stretch'
                }`}
            >
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
                    {!isNativeMobile && (
                        <SelectedDisassemblyItemsPanel selectedIds={selectedForDisassembly} inventory={inventory} />
                    )}
                    <div className="min-h-0 flex-1 overflow-hidden">
                        <DisassemblyPreviewPanel
                            selectedIds={selectedForDisassembly}
                            inventory={inventory}
                            blacksmithLevel={currentUserWithStatus.blacksmithLevel ?? 1}
                            nativeMobile={isNativeMobile}
                        />
                    </div>
                </div>
                <div
                    className={`flex flex-shrink-0 gap-2 ${
                        isNativeMobile
                            ? 'w-full flex-row'
                            : 'w-full flex-col justify-center sm:w-[9.5rem]'
                    }`}
                >
                    <ResourceActionButton
                        onClick={() => setIsAutoSelectOpen(true)}
                        variant="accent"
                        className={`${
                            isNativeMobile ? 'min-h-[44px] flex-1' : '!w-full'
                        } !rounded-lg !border !border-amber-300/40 !bg-gradient-to-r !from-amber-600/90 !via-amber-500/90 !to-orange-500/85 !px-3 !py-2.5 !text-sm !font-bold !text-amber-50 !shadow-[0_14px_26px_-18px_rgba(251,191,36,0.8)] hover:!from-amber-500 hover:!via-amber-400 hover:!to-orange-400`}
                    >
                        자동 선택
                    </ResourceActionButton>
                    <ResourceActionButton
                        onClick={handleDisassemble}
                        disabled={selectedForDisassembly.size === 0}
                        variant="materials"
                        className={`${
                            isNativeMobile ? 'min-h-[44px] flex-1' : '!w-full'
                        } !rounded-lg !border !border-rose-300/45 !bg-gradient-to-r !from-rose-600/90 !via-rose-500/90 !to-orange-500/85 !px-3 !py-2.5 !text-sm !font-bold !text-rose-50 !shadow-[0_14px_26px_-18px_rgba(244,63,94,0.85)] hover:!from-rose-500 hover:!via-rose-400 hover:!to-orange-400 disabled:!opacity-50 disabled:!cursor-not-allowed leading-snug`}
                    >
                        선택 분해 ({selectedForDisassembly.size})
                    </ResourceActionButton>
                </div>
            </div>
        </div>
    );
};

export default DisassemblyView;
