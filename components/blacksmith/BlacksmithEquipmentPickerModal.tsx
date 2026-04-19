import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import InventoryGrid from './InventoryGrid.js';
import ResourceActionButton from '../ui/ResourceActionButton.js';
import { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from '../DraggableWindow.js';
import { InventoryItem } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';

type SortOption = 'grade' | 'stars' | 'name' | 'date';

const gradeStyles: Record<ItemGrade, { color: string; background: string }> = {
    normal: { color: 'text-gray-300', background: '/images/equipments/normalbgi.png' },
    uncommon: { color: 'text-green-400', background: '/images/equipments/uncommonbgi.png' },
    rare: { color: 'text-blue-400', background: '/images/equipments/rarebgi.png' },
    epic: { color: 'text-purple-400', background: '/images/equipments/epicbgi.png' },
    legendary: { color: 'text-red-500', background: '/images/equipments/legendarybgi.png' },
    mythic: { color: 'text-orange-400', background: '/images/equipments/mythicbgi.png' },
    transcendent: { color: 'text-cyan-300', background: '/images/equipments/transcendentbgi.webp' },
};

const SLOT_NAMES_KO: Record<string, string> = {
    fan: '부채',
    board: '바둑판',
    top: '상의',
    bottom: '하의',
    bowl: '바둑통',
    stones: '바둑돌',
};

const CombineSlotPreview: React.FC<{
    item: InventoryItem | null;
    onRemove: () => void;
}> = ({ item, onRemove }) => {
    if (!item) {
        return (
            <div className="flex h-20 min-w-0 flex-1 items-center justify-center rounded-lg border-2 border-dashed border-amber-500/35 bg-black/35 text-[10px] text-amber-100/65">
                재료
            </div>
        );
    }
    const styles = gradeStyles[item.grade];
    const isTranscendent = item.grade === ItemGrade.Transcendent;
    return (
        <div className="relative flex h-20 min-w-0 flex-1 flex-col items-center justify-center rounded-lg border border-amber-400/25 bg-gradient-to-b from-[#191e2b]/80 to-[#0c1018]/95 p-1">
            <button
                type="button"
                onClick={onRemove}
                className="absolute right-0.5 top-0.5 z-10 text-lg leading-none text-red-400 hover:text-red-300"
                aria-label="슬롯 비우기"
            >
                ×
            </button>
            <div
                className={`relative h-10 w-10 overflow-hidden rounded-lg border border-slate-500/50 ${
                    isTranscendent ? 'transcendent-grade-slot' : ''
                }`}
            >
                <img src={styles.background} alt="" className="absolute inset-0 h-full w-full rounded-lg object-cover" />
                {item.image && (
                    <img
                        src={item.image}
                        alt=""
                        className="absolute left-1/2 top-1/2 object-contain p-0.5"
                        style={{ width: '80%', height: '80%', transform: 'translate(-50%, -50%)' }}
                    />
                )}
            </div>
            <p className={`mt-0.5 w-full truncate px-0.5 text-center text-[9px] font-bold ${styles.color}`} title={item.name}>
                {item.name}
            </p>
            <p className="text-[8px] text-slate-500">{item.slot ? SLOT_NAMES_KO[item.slot] ?? '' : ''}</p>
        </div>
    );
};

export interface BlacksmithEquipmentPickerModalProps {
    mode: 'enhance' | 'combine' | 'disassemble' | 'refine';
    onClose: () => void;
    onConfirm: () => void;
    filteredInventory: InventoryItem[];
    inventorySlots: number;
    sortOption: SortOption;
    onSortChange: (s: SortOption) => void;
    columnCount: number;
    gapPx: number;
    disabledItemIds: string[];
    pickerSingle: InventoryItem | null;
    onSelectSingle: (item: InventoryItem) => void;
    pickerCombine: (InventoryItem | null)[];
    onRemoveCombineSlot: (index: number) => void;
    onSelectForCombine: (item: InventoryItem) => void;
    pickerDisassemble: Set<string>;
    onToggleDisassembly: (itemId: string) => void;
}

const BlacksmithEquipmentPickerModal: React.FC<BlacksmithEquipmentPickerModalProps> = ({
    mode,
    onClose,
    onConfirm,
    filteredInventory,
    inventorySlots,
    sortOption,
    onSortChange,
    columnCount,
    gapPx,
    disabledItemIds,
    pickerSingle,
    onSelectSingle,
    pickerCombine,
    onRemoveCombineSlot,
    onSelectForCombine,
    pickerDisassemble,
    onToggleDisassembly,
}) => {
    const canCombine =
        pickerCombine.every(i => i !== null) &&
        new Set(pickerCombine.map(i => i!.grade)).size === 1;

    const canConfirm =
        mode === 'enhance' || mode === 'refine'
            ? pickerSingle !== null
            : mode === 'combine'
              ? canCombine
              : pickerDisassemble.size > 0;

    const handleGridSelect = (item: InventoryItem) => {
        if (mode === 'combine') {
            onSelectForCombine(item);
        } else if (mode === 'disassemble') {
            onToggleDisassembly(item.id);
        } else {
            onSelectSingle(item);
        }
    };

    const selectedItemIdForGrid =
        mode === 'enhance' || mode === 'refine' ? pickerSingle?.id ?? null : null;

    const helpText =
        mode === 'combine'
            ? '같은 등급 장비 3개를 슬롯에 담은 뒤 선택 완료를 누르세요.'
            : mode === 'disassemble'
              ? '분해할 장비를 탭하여 선택·해제할 수 있습니다.'
              : '강화·제련할 장비 하나를 탭한 뒤 선택 완료를 누르세요.';

    return (
        <DraggableWindow
            title="장비 선택"
            onClose={onClose}
            windowId="blacksmith-equipment-picker"
            isTopmost
            zIndex={135}
            variant="store"
            mobileViewportFit
            mobileViewportMaxHeightCss="min(94dvh, calc(100dvh - 12px))"
            initialWidth={520}
            initialHeight={640}
            bodyScrollable={false}
            bodyNoScroll
            bodyPaddingClassName="!p-0 !flex !flex-col !min-h-0 !h-full"
        >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-2 pt-2">
                    <p className="mb-2 text-center text-xs leading-snug text-slate-400">{helpText}</p>

                    {mode === 'combine' && (
                        <div className="mb-2 flex gap-1.5">
                            {pickerCombine.map((item, index) => (
                                <CombineSlotPreview
                                    key={index}
                                    item={item}
                                    onRemove={() => onRemoveCombineSlot(index)}
                                />
                            ))}
                        </div>
                    )}

                    <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-on-panel">장비</span>
                        <select
                            value={sortOption}
                            onChange={e => onSortChange(e.target.value as SortOption)}
                            className="rounded border border-color bg-secondary px-2 py-1 text-xs text-on-panel"
                        >
                            <option value="grade">등급순</option>
                            <option value="stars">강화순</option>
                            <option value="name">이름순</option>
                            <option value="date">최신순</option>
                        </select>
                    </div>

                    <div className="max-h-[min(52dvh,24rem)] min-h-[12rem] overflow-y-auto overflow-x-hidden pr-1 [scrollbar-gutter:stable]">
                        <InventoryGrid
                            inventory={filteredInventory}
                            inventorySlots={inventorySlots}
                            onSelectItem={handleGridSelect}
                            selectedItemId={selectedItemIdForGrid}
                            disabledItemIds={disabledItemIds}
                            selectedItemIdsForDisassembly={mode === 'disassemble' ? pickerDisassemble : undefined}
                            onToggleDisassemblySelection={mode === 'disassemble' ? onToggleDisassembly : undefined}
                            columnCount={columnCount}
                            gapPx={gapPx}
                        />
                    </div>
                </div>

                <div
                    className={`flex shrink-0 gap-2 border-t border-color/50 bg-primary/50 px-2.5 py-2.5 ${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS}`}
                >
                    <ResourceActionButton
                        type="button"
                        onClick={onClose}
                        variant="neutral"
                        className="min-h-[44px] flex-1 !py-2.5 text-sm font-bold"
                    >
                        취소
                    </ResourceActionButton>
                    <ResourceActionButton
                        type="button"
                        onClick={onConfirm}
                        variant="accent"
                        disabled={!canConfirm}
                        className="min-h-[44px] flex-1 !py-2.5 text-sm font-bold"
                    >
                        선택 완료
                    </ResourceActionButton>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default BlacksmithEquipmentPickerModal;
