import React from 'react';
import { InventoryItem, ItemGrade } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';

import { EquipmentDetailPanel } from './EquipmentDetailPanel.js';

interface ItemDetailModalProps {
    item: InventoryItem;
    isOwnedByCurrentUser: boolean;
    onClose: () => void;
    onStartEnhance: (item: InventoryItem) => void;
    onStartRefine: (item: InventoryItem) => void;
    isTopmost?: boolean;
}

const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, isOwnedByCurrentUser, onClose, onStartEnhance, onStartRefine, isTopmost }) => {
    const refinementCount = (item as { refinementCount?: number }).refinementCount ?? 0;
    const canRefine = item.type === 'equipment' && item.grade !== ItemGrade.Normal && refinementCount > 0;

    return (
        <DraggableWindow
            title="장비 상세 정보"
            onClose={onClose}
            windowId={`item-detail-${item.id}`}
            initialWidth={350}
            isTopmost={isTopmost}
        >
            <div className="flex h-full flex-col">
                <EquipmentDetailPanel item={item} optionsScrollable />

                {isOwnedByCurrentUser && item.type === 'equipment' && (
                    <div className="mt-5 w-full space-y-2 border-t border-white/10 pt-4">
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                onClick={() => onStartEnhance(item)}
                                disabled={item.stars >= 10}
                                colorScheme="yellow"
                                className="min-w-0 flex-1 font-semibold shadow-md shadow-amber-950/25"
                            >
                                {item.stars >= 10 ? '최대 강화' : '강화하기'}
                            </Button>
                            <Button
                                type="button"
                                onClick={() => onStartRefine(item)}
                                disabled={!canRefine}
                                colorScheme="blue"
                                className="min-w-0 flex-1 font-semibold shadow-md shadow-slate-900/30"
                                title={!canRefine ? '제련할 수 없습니다' : '대장간 제련 탭으로 이동'}
                            >
                                제련
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </DraggableWindow>
    );
};

export default ItemDetailModal;
