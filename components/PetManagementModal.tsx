import React, { useCallback, useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import PairPetLobbyPanel from './pair/PairPetLobbyPanel.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { waitingLobbyPcPanelShellClass } from './waiting-room/waitingLobbyHomePanelStyles.js';
import { PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE } from '../shared/constants/pairHatchery.js';
import type { ServerAction } from '../types.js';

interface PetManagementModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

const PetManagementModal: React.FC<PetManagementModalProps> = ({ onClose, isTopmost }) => {
    const { currentUserWithStatus, handlers } = useAppContext();
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
        <DraggableWindow
            title="펫 관리"
            onClose={onClose}
            windowId="pet-management-modal"
            initialWidth={isMobile ? 820 : 640}
            initialHeight={isMobile ? 1200 : 1000}
            isTopmost={isTopmost}
            variant="store"
            mobileViewportFit={isMobile}
            mobileViewportMaxHeightVh={98}
            mobileViewportMaxHeightCss="calc(100dvh - max(12px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px) + 12px))"
            mobileViewportDvhBottomGapPx={10}
            mobileLockViewportHeight={isMobile}
            bodyPaddingClassName={isMobile ? '!p-2' : '!p-3'}
            bodyNoScroll
        >
            <div
                className={`flex min-h-0 flex-1 flex-col overflow-hidden ${isMobile ? 'h-full max-h-none' : 'h-[min(96dvh,1000px)]'}`}
            >
                <div className={`${waitingLobbyPcPanelShellClass('pair')} flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3`}>
                    <PairPetLobbyPanel
                        currentUser={currentUserWithStatus}
                        currentUserId={currentUserWithStatus.id}
                        isBusy={petModalBusy}
                        applyPetAction={applyPetAction}
                    />
                </div>
            </div>
        </DraggableWindow>
    );
};

export default PetManagementModal;
