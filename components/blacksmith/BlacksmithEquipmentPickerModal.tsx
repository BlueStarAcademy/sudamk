import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import InventoryGrid from './InventoryGrid.js';
import ResourceActionButton from '../ui/ResourceActionButton.js';
import { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from '../DraggableWindow.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../../shared/constants/pcShellLayout.js';
import { InventoryItem } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import { getBlacksmithViewerTypography } from '../../shared/constants/blacksmithViewerTypography.js';

const mobilePickerTypo = getBlacksmithViewerTypography(false, { mobileWork: true });

type SortOption = 'grade' | 'stars' | 'name' | 'date';

const gradeStyles: Record<ItemGrade, { color: string; background: string }> = {
    normal: { color: 'text-gray-300', background: '/images/equipments/normalbgi.webp' },
    uncommon: { color: 'text-green-400', background: '/images/equipments/uncommonbgi.webp' },
    rare: { color: 'text-blue-400', background: '/images/equipments/rarebgi.webp' },
    epic: { color: 'text-purple-400', background: '/images/equipments/epicbgi.webp' },
    legendary: { color: 'text-red-500', background: '/images/equipments/legendarybgi.webp' },
    mythic: { color: 'text-orange-400', background: '/images/equipments/mythicbgi.webp' },
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
            <div className="flex h-20 min-w-0 flex-1 items-center justify-center rounded-lg border-2 border-dashed border-amber-500/35 bg-black/35 text-sm text-amber-100/70">
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
            <button
                type="button"
                onClick={onRemove}
                title="재료 빼기"
                aria-label={`${item.name} 재료 빼기`}
                className={`relative h-10 w-10 cursor-pointer overflow-hidden rounded-lg border border-slate-500/50 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 ${
                    isTranscendent ? 'transcendent-grade-slot' : ''
                }`}
            >
                <img src={styles.background} alt="" className="pointer-events-none absolute inset-0 h-full w-full rounded-lg object-cover" />
                {item.image && (
                    <img
                        src={item.image}
                        alt=""
                        className="pointer-events-none absolute left-1/2 top-1/2 object-contain p-0.5"
                        style={{ width: '80%', height: '80%', transform: 'translate(-50%, -50%)' }}
                    />
                )}
            </button>
            <p className={`mt-0.5 w-full truncate px-0.5 text-center font-bold ${styles.color} ${mobilePickerTypo.caption}`} title={item.name}>
                {item.name}
            </p>
            <p className={`${mobilePickerTypo.caption} text-slate-500`}>{item.slot ? SLOT_NAMES_KO[item.slot] ?? '' : ''}</p>
        </div>
    );
};

export interface BlacksmithEquipmentPickerModalProps {
    mode: 'enhance' | 'combine' | 'disassemble' | 'refine';
    onClose: () => void;
    onConfirm: () => void;
    /**
     * 강화·제련(모바일 등): 장비 한 번 탭으로 선택 확정·피커 닫기.
     * 지정 시 그리드 탭에서 호출되며, 하단「선택 완료」는 숨깁니다.
     */
    onPickSingleComplete?: (item: InventoryItem) => void;
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
    /** 장비 분해: 정렬 드롭다운 왼쪽 자동 선택 버튼 */
    onOpenDisassemblyAutoSelect?: () => void;
    /** 분해 자동 선택 모달이 열려 있을 때 피커가 위로 덮이지 않도록 */
    disassemblyAutoSelectOpen?: boolean;
    isTopmost?: boolean;
    embedded?: boolean;
}

const BlacksmithEquipmentPickerModal: React.FC<BlacksmithEquipmentPickerModalProps> = ({
    mode,
    onClose,
    onConfirm,
    onPickSingleComplete,
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
    onOpenDisassemblyAutoSelect,
    disassemblyAutoSelectOpen = false,
    isTopmost = true,
    embedded = false,
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
        } else if (onPickSingleComplete && (mode === 'enhance' || mode === 'refine')) {
            onPickSingleComplete(item);
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
              : onPickSingleComplete
              ? '강화·제련할 장비 하나를 탭하면 작업 화면으로 이동합니다.'
              : '강화·제련할 장비 하나를 탭한 뒤 선택 완료를 누르세요.';

    const pickerBody = (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 px-2.5 pb-2 pt-2">
                <p className={`mb-2 text-center ${mobilePickerTypo.body} text-slate-400`}>{helpText}</p>

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

                <div className="flex items-center justify-between gap-2">
                    <span className={`min-w-0 shrink ${mobilePickerTypo.heading} text-on-panel`}>장비</span>
                    <div className="flex shrink-0 items-center gap-2">
                        {mode === 'disassemble' && onOpenDisassemblyAutoSelect && (
                            <button
                                type="button"
                                onClick={onOpenDisassemblyAutoSelect}
                                className={`whitespace-nowrap rounded border border-amber-300/40 bg-gradient-to-r from-amber-600/90 via-amber-500/90 to-orange-500/85 px-2.5 py-1.5 ${mobilePickerTypo.caption} font-bold text-amber-50 shadow-[0_10px_22px_-14px_rgba(251,191,36,0.75)] transition hover:from-amber-500 hover:via-amber-400 hover:to-orange-400`}
                            >
                                자동 선택
                            </button>
                        )}
                        <select
                            value={sortOption}
                            onChange={e => onSortChange(e.target.value as SortOption)}
                            className={`rounded border border-color bg-secondary px-2 py-1.5 ${mobilePickerTypo.caption} text-on-panel`}
                        >
                            <option value="grade">등급순</option>
                            <option value="stars">강화순</option>
                            <option value="name">이름순</option>
                            <option value="date">최신순</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-2 pr-1 [scrollbar-gutter:stable]">
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

            <div
                className={`flex shrink-0 gap-2 border-t border-color/50 bg-primary/50 px-2.5 py-2.5 ${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS}`}
            >
                <ResourceActionButton
                    type="button"
                    onClick={onClose}
                    variant="neutral"
                    className={`min-h-[44px] !py-2.5 text-sm font-bold ${onPickSingleComplete ? 'w-full' : 'flex-1'}`}
                >
                    취소
                </ResourceActionButton>
                {!onPickSingleComplete && (
                    <ResourceActionButton
                        type="button"
                        onClick={onConfirm}
                        variant="accent"
                        disabled={!canConfirm}
                        className="min-h-[44px] flex-1 !py-2.5 text-sm font-bold"
                    >
                        선택 완료
                    </ResourceActionButton>
                )}
            </div>
        </div>
    );

    if (embedded) {
        return <div className={`${PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS} flex min-h-0 flex-1 flex-col`}>{pickerBody}</div>;
    }

    return (
        <DraggableWindow
            title="장비 선택"
            onClose={onClose}
            windowId="blacksmith-equipment-picker"
            isTopmost={Boolean(isTopmost) && !disassemblyAutoSelectOpen}
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
            {pickerBody}
        </DraggableWindow>
    );
};

export default BlacksmithEquipmentPickerModal;
