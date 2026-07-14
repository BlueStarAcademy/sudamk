import React from 'react';
import { InventoryItem, ItemGrade } from '../../types.js';
import { isRefinementTicketMaterial } from '../../constants/items.js';
import { isPairArenaExclusiveBagItem } from '../../shared/constants/petLobby.js';
import {
    GRADE_SLOT_BORDER_OVERLAY_POSITION_CLASS,
    gradeSlotBorderOverlayClass,
    itemSlotIconStyle,
    ITEM_SLOT_ICON_SIZE_PCT,
} from '../../shared/constants/itemSlotIconLayout.js';
import EquipmentEnhancementBadge from '../EquipmentEnhancementBadge.js';
import EquipmentStatusBadge from '../EquipmentStatusBadge.js';

const gradeBackgrounds: Record<ItemGrade, string> = {
    normal: '/images/equipments/normalbgi.webp',
    uncommon: '/images/equipments/uncommonbgi.webp',
    rare: '/images/equipments/rarebgi.webp',
    epic: '/images/equipments/epicbgi.webp',
    legendary: '/images/equipments/legendarybgi.webp',
    mythic: '/images/equipments/mythicbgi.webp',
    transcendent: '/images/equipments/transcendentbgi.webp',
};

interface InventoryGridProps {
    inventory: InventoryItem[];
    inventorySlots: number;
    onSelectItem: (item: InventoryItem) => void;
    selectedItemId: string | null;
    disabledItemIds?: string[];
    selectedItemIdsForDisassembly?: Set<string>; // New prop for disassembly selection
    onToggleDisassemblySelection?: (itemId: string) => void; // New prop for toggling disassembly selection
    /** 그리드 열 수 (기본 10). 모바일 대장간 등에서 8 권장 */
    columnCount?: number;
    gapPx?: number;
}

const InventoryGrid: React.FC<InventoryGridProps> = ({
    inventory,
    inventorySlots,
    onSelectItem,
    selectedItemId,
    disabledItemIds = [],
    selectedItemIdsForDisassembly,
    onToggleDisassemblySelection,
    columnCount = 10,
    gapPx = 4,
}) => {
    const slotCount = Math.max(inventorySlots, inventory.length);
    const inventoryDisplaySlots = Array.from({ length: slotCount }, (_, index) => inventory[index] || null);
    const cols = Math.max(4, Math.min(12, columnCount));

    return (
        <div 
            className="grid flex-grow pr-2 bg-tertiary/30 p-2 rounded-md" 
            style={{ 
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gap: `${gapPx}px`,
                width: '100%',
                minWidth: 0
            }}
        >
            {inventoryDisplaySlots.map((item, index) => {
                const isDisabled = item ? disabledItemIds.includes(item.id) : false;
                return (
                    <div
                        key={item ? item.id : `empty-${index}`}
                        onClick={() => {
                            if (!item || isDisabled) return;
                            if (selectedItemIdsForDisassembly && onToggleDisassemblySelection) {
                                onToggleDisassemblySelection(item.id);
                            } else {
                                onSelectItem(item);
                            }
                        }}
                        className={`relative aspect-square overflow-hidden rounded-md transition-all duration-200 ${item ? 'hover:scale-105' : 'bg-tertiary/50'} ${isDisabled ? 'filter grayscale opacity-50 pointer-events-none' : 'cursor-pointer'}`}
                        style={{ width: '100%', minWidth: 0, minHeight: 0, maxWidth: '100%' }}
                    >
                        {item ? (
                            <>
                                <div className={`absolute inset-0 rounded-md border-2 ${selectedItemId === item.id ? 'border-accent ring-2 ring-accent' : 'border-black/20'} ${selectedItemIdsForDisassembly?.has(item.id) ? 'bg-gray-700/70' : ''}`} />
                                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 z-0 object-cover rounded-sm" style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }} />
                                {item.image && (
                                    <img
                                        src={item.image}
                                        alt={item.name}
                                        className="absolute z-[1] object-contain"
                                        style={itemSlotIconStyle(ITEM_SLOT_ICON_SIZE_PCT)}
                                    />
                                )}
                                <div
                                    className={`${GRADE_SLOT_BORDER_OVERLAY_POSITION_CLASS} ${gradeSlotBorderOverlayClass(item.grade)}`}
                                    aria-hidden
                                />
                                <EquipmentEnhancementBadge stars={item.stars} />
                                {item.isEquipped ? <EquipmentStatusBadge kind="equipped" /> : null}
                                {(() => {
                                    if (isPairArenaExclusiveBagItem(item)) return null;
                                    const stackQty = item.quantity ?? 1;
                                    const isTicket = isRefinementTicketMaterial(item.name);
                                    if (!isTicket && stackQty <= 1) return null;
                                    if (isTicket && stackQty < 1) return null;
                                    return (
                                        <span className="absolute bottom-0 right-0 text-xs font-bold text-white bg-black/60 px-1 rounded-tl-md">
                                            {stackQty}
                                        </span>
                                    );
                                })()}
                                {selectedItemIdsForDisassembly?.has(item.id) && (
                                    <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center bg-gray-800/70 rounded-md">
                                        <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="bg-tertiary/50 w-full h-full rounded-md" />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default InventoryGrid;
