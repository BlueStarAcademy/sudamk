import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import DraggableWindow, {
    ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS,
    ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS,
} from './DraggableWindow.js';
import type { InventoryItem, ServerAction, User } from '../types.js';
import { audioService } from '../services/audioService.js';
import PairPetLobbyInfoPetViewer from './pair/PairPetLobbyInfoPetViewer.js';
import PairPetSoulConvertModal from './pair/PairPetSoulConvertModal.js';
import { getEquippedPairPetInventoryRow } from '../shared/utils/pairEquippedPet.js';
import { computeOptimisticPairPetSoulConvert } from '../shared/utils/pairPetSoulConvert.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { normalizePairPetTrainingSlots, isItemIdInPairTraining } from '../shared/constants/pairTraining.js';
import { PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE } from '../shared/constants/pairHatchery.js';
import {
    PAIR_PET_DETAIL_MODAL_INITIAL_WIDTH,
    PAIR_PET_DETAIL_VIEW_BODY_MAX_HEIGHT_CSS,
    PAIR_PET_MODAL_MOBILE_BOTTOM_GAP_PX,
    PAIR_PET_MODAL_MOBILE_MAX_HEIGHT_CSS,
} from '../shared/constants/pairPetModal.js';

export type PairPetModalMode = 'obtain' | 'view';

export interface PairPetObtainedModalProps {
    currentUser: User;
    item: InventoryItem;
    mode: PairPetModalMode;
    onClose: () => void;
    isTopmost?: boolean;
}

const PairPetObtainedModal: React.FC<PairPetObtainedModalProps> = ({ currentUser, item, mode, onClose, isTopmost }) => {
    const { currentUserWithStatus, handlers } = useAppContext();
    const [isBusy, setIsBusy] = useState(false);
    const [soulConvertTarget, setSoulConvertTarget] = useState<InventoryItem | null>(null);
    const soulConvertInFlightRef = useRef(false);

    const userForView = currentUserWithStatus ?? currentUser;

    const liveItem = useMemo(() => {
        const inv = userForView.inventory;
        if (!Array.isArray(inv)) return item;
        return inv.find((i) => i.id === item.id) ?? item;
    }, [userForView.inventory, item]);

    const equippedTid = userForView.equippedPairPetTemplateId ?? null;
    const equippedRow = useMemo(() => getEquippedPairPetInventoryRow(userForView), [userForView]);
    const isEquippedRowDetail = equippedRow?.id === item.id;

    const title =
        mode === 'obtain' ? '펫 획득' : isEquippedRowDetail ? '대표 펫 정보' : '펫 상세 정보';

    const petInTraining = useMemo(() => {
        const slots = normalizePairPetTrainingSlots(userForView.pairPetTrainingSlots);
        return isItemIdInPairTraining(slots, liveItem.id);
    }, [userForView.pairPetTrainingSlots, liveItem.id]);

    const applyPetAction = useCallback(
        async (action: ServerAction) => {
            setIsBusy(true);
            try {
                const result = await handlers.handleAction(action);
                const error = (result as { error?: string })?.error;
                if (error && error !== PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE) window.alert(error);
                return result;
            } finally {
                setIsBusy(false);
            }
        },
        [handlers],
    );

    const equipPet = useCallback(
        async (templateId: string, inventoryItemId: string) => {
            await applyPetAction({
                type: 'PAIR_PET_SET_EQUIPPED',
                payload: { templateId, inventoryItemId },
            });
        },
        [applyPetAction],
    );

    const clearEquip = useCallback(async () => {
        await applyPetAction({ type: 'PAIR_PET_SET_EQUIPPED', payload: { templateId: null } });
    }, [applyPetAction]);

    const confirmSoulConvert = useCallback(() => {
        if (!soulConvertTarget || soulConvertInFlightRef.current) return;
        const itemId = soulConvertTarget.id;
        soulConvertInFlightRef.current = true;
        const inv = userForView.inventory || [];
        const slots = userForView.inventorySlots ?? { equipment: 30, consumable: 30, material: 30 };
        const optimistic = computeOptimisticPairPetSoulConvert(inv, slots, itemId);
        if (!optimistic.ok) {
            window.alert(optimistic.error);
            return;
        }
        const invSnapshot = JSON.parse(JSON.stringify(inv)) as InventoryItem[];
        flushSync(() => setSoulConvertTarget(null));
        handlers.applyDeferredUserUpdate(
            { inventory: optimistic.nextInventory },
            'PAIR_PET_CONVERT_PET-optimistic',
        );
        handlers.showObtainedItemsBulk([optimistic.soulStack]);
        onClose();

        void handlers
            .handleAction({
                type: 'PAIR_PET_CONVERT_PET',
                payload: { itemId, __clientSkipObtainedModal: true },
            })
            .then((raw) => {
                const err = (raw as { error?: string } | null)?.error;
                if (err) {
                    handlers.applyDeferredUserUpdate({ inventory: invSnapshot }, 'PAIR_PET_CONVERT_PET-optimistic-rollback');
                    window.alert(err);
                }
            })
            .finally(() => {
                soulConvertInFlightRef.current = false;
            });
    }, [soulConvertTarget, userForView.inventory, userForView.inventorySlots, handlers, onClose]);

    useEffect(() => {
        if (mode !== 'obtain') return;
        void audioService.initialize();
        if (['epic', 'legendary', 'mythic', 'transcendent'].includes(item.grade)) {
            audioService.gachaEpicOrHigher();
        } else {
            audioService.claimReward();
        }
    }, [item.grade, mode]);

    const showRepresentativeBadge =
        mode === 'view' && getEquippedPairPetInventoryRow(userForView)?.id === item.id;

    const petDetailBody = (
        <PairPetLobbyInfoPetViewer
            currentUser={userForView}
            item={liveItem}
            isBusy={isBusy}
            equippedTemplateId={equippedTid}
            petInTraining={petInTraining}
            fillParent={mode === 'view'}
            hideActionBar={mode === 'obtain'}
            onSetRepresentative={(templateId, inventoryItemId) => void equipPet(templateId, inventoryItemId)}
            onClearRepresentative={() => void clearEquip()}
            onSoulConvert={(row) => setSoulConvertTarget(row)}
            applyPetAction={applyPetAction}
        />
    );

    return (
        <>
            <DraggableWindow
                title={title}
                onClose={onClose}
                windowId="pair-pet-detail-modal"
                initialWidth={PAIR_PET_DETAIL_MODAL_INITIAL_WIDTH}
                shrinkHeightToContent
                isTopmost={isTopmost}
                zIndex={70}
                skipSavedPosition
                variant="store"
                hideFooter
                mobileViewportFit
                mobileLockViewportHeight={false}
                mobileViewportMaxHeightVh={88}
                mobileViewportMaxHeightCss={PAIR_PET_MODAL_MOBILE_MAX_HEIGHT_CSS}
                mobileViewportDvhBottomGapPx={PAIR_PET_MODAL_MOBILE_BOTTOM_GAP_PX}
                bodyShrinkToContent
                bodyNoScroll={false}
                bodyScrollable
                bodyPaddingClassName="flex min-h-0 w-full min-w-0 flex-1 flex-col !p-0 sm:!p-0"
            >
                <div
                    className={`flex min-h-0 w-full min-w-0 flex-col overflow-hidden ${mode === 'obtain' ? 'flex-1' : ''}`}
                    style={{ maxHeight: PAIR_PET_DETAIL_VIEW_BODY_MAX_HEIGHT_CSS }}
                >
                    {petDetailBody}
                </div>
                {mode === 'obtain' ? (
                    <div className={`${ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS} shrink-0 border-t border-slate-700/50`}>
                        <button
                            type="button"
                            onClick={onClose}
                            className={ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS}
                        >
                            확인
                        </button>
                    </div>
                ) : null}
            </DraggableWindow>

            {soulConvertTarget ? (
                <PairPetSoulConvertModal
                    isOpen
                    item={soulConvertTarget}
                    isBusy={false}
                    onClose={() => setSoulConvertTarget(null)}
                    onConfirm={() => confirmSoulConvert()}
                    isTopmost
                />
            ) : null}
        </>
    );
};

export default PairPetObtainedModal;
