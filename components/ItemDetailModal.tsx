import React from 'react';
import { InventoryItem, ItemGrade } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { EquipmentDetailPanel } from './EquipmentDetailPanel.js';
import {
    MOBILE_EQUIPMENT_DETAIL_BODY_PADDING_CLASS,
    MOBILE_EQUIPMENT_DETAIL_MAX_HEIGHT_CSS,
    MOBILE_EQUIPMENT_DETAIL_MODAL_WIDTH,
    MOBILE_ITEM_DETAIL_EQUIPMENT_ICON_SLOT_PX,
} from '../shared/constants/mobileEquipmentDetailModal.js';

interface ItemDetailModalProps {
    item: InventoryItem;
    isOwnedByCurrentUser: boolean;
    /** true면 강화/제련 대신 확인만(거래소 등록 장비 등) */
    hideEnhanceActions?: boolean;
    onClose: () => void;
    onStartEnhance: (item: InventoryItem) => void;
    onStartRefine: (item: InventoryItem) => void;
    isTopmost?: boolean;
}

const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
    item,
    isOwnedByCurrentUser,
    hideEnhanceActions = false,
    onClose,
    onStartEnhance,
    onStartRefine,
    isTopmost,
}) => {
    const refinementCount = (item as { refinementCount?: number }).refinementCount ?? 0;
    const canRefine = item.type === 'equipment' && item.grade !== ItemGrade.Normal && refinementCount > 0;
    const handheld = useIsHandheldDevice(768);
    const isEquipmentLikeDetail =
        item.type === 'equipment' || item.type === 'consumable' || item.type === 'material';
    const mobileDetailChrome = Boolean(handheld && isEquipmentLikeDetail);
    const detailTitle =
        item.type === 'equipment'
            ? '장비 상세 정보'
            : item.type === 'consumable'
              ? '소모품 상세'
              : item.type === 'material'
                ? '재료 상세'
                : '아이템 상세';

    return (
        <DraggableWindow
            title={detailTitle}
            onClose={onClose}
            windowId={`item-detail-${item.id}`}
            initialWidth={mobileDetailChrome ? MOBILE_EQUIPMENT_DETAIL_MODAL_WIDTH : 400}
            initialHeight={mobileDetailChrome ? undefined : 600}
            isTopmost={isTopmost}
            variant="store"
            shrinkHeightToContent={mobileDetailChrome}
            mobileViewportFit={mobileDetailChrome}
            mobileViewportMaxHeightVh={mobileDetailChrome ? 98 : undefined}
            mobileViewportMaxHeightCss={mobileDetailChrome ? MOBILE_EQUIPMENT_DETAIL_MAX_HEIGHT_CSS : undefined}
            mobileViewportDvhBottomGapPx={mobileDetailChrome ? 8 : undefined}
            bodyScrollable={mobileDetailChrome}
            bodyPaddingClassName={mobileDetailChrome ? MOBILE_EQUIPMENT_DETAIL_BODY_PADDING_CLASS : undefined}
            hideFooter={mobileDetailChrome}
        >
            <div className={mobileDetailChrome ? 'flex min-h-0 w-full min-w-0 flex-col gap-1.5' : 'flex h-full flex-col'}>
                {mobileDetailChrome ? (
                    <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
                        <EquipmentDetailPanel
                            item={item}
                            iconSlotPx={MOBILE_ITEM_DETAIL_EQUIPMENT_ICON_SLOT_PX}
                            optionsScrollable={false}
                            comfortableTypography
                            optionRowsSingleLine={item.type === 'equipment'}
                            showTradeStatusUnderImage
                        />
                    </div>
                ) : (
                    <EquipmentDetailPanel
                        item={item}
                        optionsScrollable
                        comfortableTypography={isEquipmentLikeDetail}
                        optionRowsSingleLine={item.type === 'equipment'}
                    />
                )}

                {hideEnhanceActions && isEquipmentLikeDetail ? (
                    <div
                        className={
                            mobileDetailChrome
                                ? 'shrink-0 border-t border-slate-700/50 pt-2'
                                : 'mt-5 w-full border-t border-white/10 pt-4'
                        }
                    >
                        <Button
                            type="button"
                            onClick={onClose}
                            colorScheme="yellow"
                            className={`w-full font-semibold shadow-md shadow-amber-950/25 ${mobileDetailChrome ? '!py-2 !text-xs !leading-snug' : ''}`}
                        >
                            확인
                        </Button>
                    </div>
                ) : isOwnedByCurrentUser && item.type === 'equipment' ? (
                    <div
                        className={
                            mobileDetailChrome
                                ? 'shrink-0 space-y-2 border-t border-slate-700/50 pt-2'
                                : 'mt-5 w-full space-y-2 border-t border-white/10 pt-4'
                        }
                    >
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                onClick={() => onStartEnhance(item)}
                                disabled={item.stars >= 10}
                                colorScheme="yellow"
                                className={`min-w-0 flex-1 font-semibold shadow-md shadow-amber-950/25 ${mobileDetailChrome ? '!py-2 !text-xs !leading-snug' : ''}`}
                            >
                                {item.stars >= 10 ? '최대 강화' : '강화하기'}
                            </Button>
                            <Button
                                type="button"
                                onClick={() => onStartRefine(item)}
                                disabled={!canRefine}
                                colorScheme="blue"
                                className={`min-w-0 flex-1 font-semibold shadow-md shadow-slate-900/30 ${mobileDetailChrome ? '!py-2 !text-xs !leading-snug' : ''}`}
                                title={!canRefine ? '제련할 수 없습니다' : '대장간 제련 탭으로 이동'}
                            >
                                제련
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>
        </DraggableWindow>
    );
};

export default ItemDetailModal;
