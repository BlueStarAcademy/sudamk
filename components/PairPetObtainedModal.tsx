import React, { useEffect } from 'react';
import DraggableWindow, {
    ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS,
    ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS,
} from './DraggableWindow.js';
import type { InventoryItem, User } from '../types.js';
import { audioService } from '../services/audioService.js';
import PairPetHatchAcquirePanel from './pair/PairPetHatchAcquirePanel.js';
import {
    MOBILE_EQUIPMENT_DETAIL_MAX_HEIGHT_CSS,
} from '../shared/constants/mobileEquipmentDetailModal.js';

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
    const title = mode === 'obtain' ? '펫 획득' : '대표 펫 정보';

    useEffect(() => {
        if (mode !== 'obtain') return;
        void audioService.initialize();
        if (['epic', 'legendary', 'mythic', 'transcendent'].includes(item.grade)) {
            audioService.gachaEpicOrHigher();
        } else {
            audioService.claimReward();
        }
    }, [item.grade, mode]);

    return (
        <DraggableWindow
            title={title}
            onClose={onClose}
            windowId="pair-pet-detail-modal"
            initialWidth={PAIR_PET_MODAL_INITIAL_WIDTH}
            shrinkHeightToContent
            isTopmost={isTopmost}
            zIndex={70}
            skipSavedPosition
            variant="store"
            hideFooter
            mobileViewportFit
            mobileViewportMaxHeightVh={98}
            mobileViewportMaxHeightCss={MOBILE_EQUIPMENT_DETAIL_MAX_HEIGHT_CSS}
            mobileViewportDvhBottomGapPx={8}
            bodyShrinkToContent
            bodyScrollable={false}
            bodyPaddingClassName={PAIR_PET_MODAL_BODY_PADDING}
        >
            <>
                <div className="min-w-0 w-full">
                    <PairPetHatchAcquirePanel currentUser={currentUser} item={item} />
                </div>
                <div className={`${ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS} shrink-0 border-t border-slate-700/50`}>
                    <button type="button" onClick={onClose} className={`${ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS} !text-xs !leading-snug`}>
                        확인
                    </button>
                </div>
            </>
        </DraggableWindow>
    );
};

export default PairPetObtainedModal;
