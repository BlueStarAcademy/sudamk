import React, { useCallback, useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import PairPetLobbyPanel from './pair/PairPetLobbyPanel.js';
import PairPetModalScaledShell from './pair/PairPetModalScaledShell.js';
import ScreenGuideModal from './ScreenGuideModal.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useScreenGuide } from '../hooks/useScreenGuide.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { waitingLobbyPcPanelShellClass } from './waiting-room/waitingLobbyHomePanelStyles.js';
import { PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE } from '../shared/constants/pairHatchery.js';
import {
    PAIR_PET_MANAGEMENT_MODAL_HEIGHT_DESKTOP,
    PAIR_PET_MANAGEMENT_MODAL_HEIGHT_MOBILE,
    PAIR_PET_MANAGEMENT_MODAL_WIDTH_DESKTOP,
    PAIR_PET_MANAGEMENT_MODAL_WIDTH_MOBILE,
    PAIR_PET_MODAL_MOBILE_BOTTOM_GAP_PX,
    PAIR_PET_MODAL_MOBILE_MAX_HEIGHT_CSS,
} from '../shared/constants/pairPetModal.js';
import type { ServerAction } from '../types.js';

interface PetManagementModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

const PetManagementModal: React.FC<PetManagementModalProps> = ({ onClose, isTopmost }) => {
    const { currentUserWithStatus, handlers } = useAppContext();
    const petGuide = useScreenGuide('petManagement');
    const isCompactViewport = useIsHandheldDevice(1024);
    const { isNativeMobile } = useNativeMobileShell();
    const isMobile = isCompactViewport || isNativeMobile;
    const [petModalBusy, setPetModalBusy] = useState(false);

    const applyPetAction = useCallback(
        async (action: ServerAction) => {
            setPetModalBusy(true);
            try {
                const result = await handlers.handleAction(action);
                const error = (result as { error?: string } | undefined)?.error;
                if (error && error !== PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE) window.alert(error);
                return result;
            } finally {
                setPetModalBusy(false);
            }
        },
        [handlers],
    );

    if (!currentUserWithStatus) return null;

    return (
        <>
        <DraggableWindow
            title="펫 관리"
            onClose={onClose}
            windowId="pet-management-modal"
            initialWidth={isMobile ? PAIR_PET_MANAGEMENT_MODAL_WIDTH_MOBILE : PAIR_PET_MANAGEMENT_MODAL_WIDTH_DESKTOP}
            initialHeight={isMobile ? PAIR_PET_MANAGEMENT_MODAL_HEIGHT_MOBILE : PAIR_PET_MANAGEMENT_MODAL_HEIGHT_DESKTOP}
            isTopmost={isTopmost}
            variant="store"
            mobileViewportFit={isMobile}
            mobileViewportMaxHeightVh={99}
            mobileViewportMaxHeightCss={PAIR_PET_MODAL_MOBILE_MAX_HEIGHT_CSS}
            mobileViewportDvhBottomGapPx={PAIR_PET_MODAL_MOBILE_BOTTOM_GAP_PX}
            mobileLockViewportHeight={isMobile}
            bodyPaddingClassName={isMobile ? '!p-1.5' : '!p-2'}
            bodyNoScroll
            hideFooter
        >
            <PairPetModalScaledShell className="flex h-full min-h-0 flex-1 flex-col">
                <div className={`${waitingLobbyPcPanelShellClass('pair')} flex min-h-0 flex-1 flex-col overflow-hidden p-1.5 sm:p-2`}>
                    <PairPetLobbyPanel
                        currentUser={currentUserWithStatus}
                        currentUserId={currentUserWithStatus.id}
                        isBusy={petModalBusy}
                        applyPetAction={applyPetAction}
                    />
                </div>
            </PairPetModalScaledShell>
        </DraggableWindow>
        {petGuide.isOpen && (
            <ScreenGuideModal
                guideId="petManagement"
                onClose={petGuide.close}
                onDismissForever={petGuide.dismissForever}
                isTopmost
            />
        )}
        </>
    );
};

export default PetManagementModal;
