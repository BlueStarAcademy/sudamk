import React, { useMemo } from 'react';
import DraggableWindow from './DraggableWindow.js';
import ChatWindow from './waiting-room/ChatWindow.js';
import type { ChatMessage, ServerAction } from '../types.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH } from '../constants/ads.js';

interface ChatQuickModalProps {
    messages: ChatMessage[];
    onAction: (a: ServerAction) => void;
    onViewUser: (userId: string) => void;
    onClose: () => void;
    isTopmost?: boolean;
}

const ChatQuickModal: React.FC<ChatQuickModalProps> = ({
    messages,
    onAction,
    onViewUser,
    onClose,
    isTopmost,
}) => {
    const isCompactViewport = useIsHandheldDevice(1024);
    const { isNativeMobile } = useNativeMobileShell();
    const isMobile = isCompactViewport || isNativeMobile;

    /** 모바일: min-height를 과하게 주면 DraggableWindow max-height(80dvh 등)보다 커져 입력창이 잘림 — 부모 높이에 맞춤 */
    const bodyClass = useMemo(
        () =>
            isMobile
                ? 'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden'
                : 'flex h-[min(780px,105vh)] min-h-[480px] flex-col overflow-hidden',
        [isMobile],
    );

    return (
        <DraggableWindow
            title="채팅"
            onClose={onClose}
            windowId="chat-quick-modal"
            initialWidth={isMobile ? 720 : 520}
            initialHeight={isMobile ? 720 : 840}
            isTopmost={isTopmost}
            variant="store"
            mobileViewportFit={isMobile}
            mobileViewportMaxHeightVh={NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}
            hideFooter={isMobile}
            skipSavedPosition={isMobile}
            bodyPaddingClassName={
                isMobile
                    ? '!p-2 !pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]'
                    : undefined
            }
            bodyNoScroll
            bodyScrollable={false}
        >
            <div className={bodyClass}>
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-color/50 bg-panel shadow-inner">
                    <ChatWindow
                        messages={messages}
                        mode="global"
                        onAction={onAction}
                        onViewUser={onViewUser}
                        locationPrefix="[홈]"
                        compactTournamentMobile={isMobile}
                    />
                </div>
            </div>
        </DraggableWindow>
    );
};

export default ChatQuickModal;
