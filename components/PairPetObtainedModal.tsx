import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import DraggableWindow, {
    ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS,
    ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS,
} from './DraggableWindow.js';
import type { InventoryItem, ServerAction, User } from '../types.js';
import { audioService } from '../services/audioService.js';
import PairPetHatchAcquirePanel from './pair/PairPetHatchAcquirePanel.js';
import { PairPetDetailFitScale } from './pair/PairPetDetailCardBody.js';
import PairPetLobbyInfoPetViewer from './pair/PairPetLobbyInfoPetViewer.js';
import PairPetSoulConvertModal from './pair/PairPetSoulConvertModal.js';
import { getEquippedPairPetInventoryRow } from '../shared/utils/pairEquippedPet.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { normalizePairPetTrainingSlots, isItemIdInPairTraining } from '../shared/constants/pairTraining.js';
import { MOBILE_EQUIPMENT_DETAIL_MAX_HEIGHT_CSS } from '../shared/constants/mobileEquipmentDetailModal.js';
import { PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE } from '../shared/constants/pairHatchery.js';
import {
    PAIR_PET_DETAIL_MODAL_INITIAL_HEIGHT,
    PAIR_PET_MODAL_MOBILE_BOTTOM_GAP_PX,
    PAIR_PET_MODAL_MOBILE_MAX_HEIGHT_CSS,
} from '../shared/constants/pairPetModal.js';

/** 장비 상세(350)보다 넓게 — 펫 히어로·3×2 능력치 그리드용 */
const PAIR_PET_MODAL_INITIAL_WIDTH = 540;

/** 본문만 패딩(푸터는 ITEM_OBTAIN 행이 자체 패딩) — 세로 여백 최소화로 한 화면 맞춤 */
const PAIR_PET_MODAL_BODY_PADDING =
    'flex min-h-0 w-full flex-col !px-2.5 !pb-2 !pt-2 sm:!px-4 sm:!pb-3 sm:!pt-3';

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

    const confirmSoulConvert = useCallback(async () => {
        if (!soulConvertTarget || isBusy) return;
        const itemId = soulConvertTarget.id;
        flushSync(() => setSoulConvertTarget(null));
        setIsBusy(true);
        try {
            const result = await handlers.handleAction({ type: 'PAIR_PET_CONVERT_PET', payload: { itemId } });
            const err = (result as { error?: string })?.error;
            if (err) {
                window.alert(err);
                return;
            }
            onClose();
        } finally {
            setIsBusy(false);
        }
    }, [soulConvertTarget, isBusy, handlers, onClose]);

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

    const bodyPaddingClassName =
        mode === 'view'
            ? 'flex min-h-0 w-full min-w-0 flex-1 flex-col !p-0 sm:!p-0'
            : PAIR_PET_MODAL_BODY_PADDING;

    return (
        <>
            <DraggableWindow
                title={title}
                onClose={onClose}
                windowId="pair-pet-detail-modal"
                initialWidth={PAIR_PET_MODAL_INITIAL_WIDTH}
                initialHeight={mode === 'view' ? PAIR_PET_DETAIL_MODAL_INITIAL_HEIGHT : undefined}
                shrinkHeightToContent={mode === 'obtain'}
                isTopmost={isTopmost}
                zIndex={70}
                skipSavedPosition
                variant="store"
                hideFooter
                mobileViewportFit
                mobileLockViewportHeight={mode === 'view'}
                mobileViewportMaxHeightVh={mode === 'view' ? 99 : 98}
                mobileViewportMaxHeightCss={
                    mode === 'view' ? PAIR_PET_MODAL_MOBILE_MAX_HEIGHT_CSS : MOBILE_EQUIPMENT_DETAIL_MAX_HEIGHT_CSS
                }
                mobileViewportDvhBottomGapPx={mode === 'view' ? PAIR_PET_MODAL_MOBILE_BOTTOM_GAP_PX : 8}
                bodyShrinkToContent={mode === 'obtain'}
                bodyNoScroll={mode === 'view'}
                bodyScrollable={false}
                bodyPaddingClassName={bodyPaddingClassName}
            >
                {mode === 'obtain' ? (
                    <>
                        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
                            <PairPetDetailFitScale itemId={item.id} outerClassName="min-h-0 flex-1" stretchInnerHeightWhenUnscaled>
                                <PairPetHatchAcquirePanel
                                    currentUser={userForView}
                                    item={item}
                                    showRepresentativeBadge={showRepresentativeBadge}
                                />
                            </PairPetDetailFitScale>
                        </div>
                        <div className={`${ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS} shrink-0 border-t border-slate-700/50`}>
                            <button
                                type="button"
                                onClick={onClose}
                                className={`${ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS} !text-xs !leading-snug`}
                            >
                                확인
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                        <PairPetLobbyInfoPetViewer
                            currentUser={userForView}
                            item={liveItem}
                            isBusy={isBusy}
                            equippedTemplateId={equippedTid}
                            petInTraining={petInTraining}
                            embedDetailVariant="modal"
                            onSetRepresentative={(templateId, inventoryItemId) => void equipPet(templateId, inventoryItemId)}
                            onClearRepresentative={() => void clearEquip()}
                            onSoulConvert={(row) => setSoulConvertTarget(row)}
                            applyPetAction={applyPetAction}
                        />
                    </div>
                )}
            </DraggableWindow>

            {soulConvertTarget ? (
                <PairPetSoulConvertModal
                    isOpen
                    item={soulConvertTarget}
                    isBusy={isBusy}
                    onClose={() => setSoulConvertTarget(null)}
                    onConfirm={() => void confirmSoulConvert()}
                    isTopmost
                />
            ) : null}
        </>
    );
};

export default PairPetObtainedModal;
