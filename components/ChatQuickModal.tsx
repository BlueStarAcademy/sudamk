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

    const bodyClass = useMemo(
        () =>
            isMobile
                ? 'flex min-h-[min(58dvh,420px)] flex-col overflow-hidden'
                : 'flex h-[min(520px,70vh)] min-h-[320px] flex-col overflow-hidden',
        [isMobile],
    );

    return (
        <DraggableWindow
            title="채팅"
            onClose={onClose}
            windowId="chat-quick-modal"
            initialWidth={isMobile ? 720 : 520}
            initialHeight={isMobile ? 480 : 560}
            isTopmost={isTopmost}
            variant="store"
            mobileViewportFit={isMobile}
            mobileViewportMaxHeightVh={NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}
            hideFooter={isMobile}
            skipSavedPosition={isMobile}
            bodyPaddingClassName={isMobile ? '!p-2' : undefined}
            bodyNoScroll
            bodyScrollable={false}
        >
            <div className={bodyClass}>
                <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-color/50 bg-panel shadow-inner">
                    <ChatWindow
                        messages={messages}
                        mode="global"
                        onAction={onAction}
                        onViewUser={onViewUser}
                        locationPrefix="[홈]"
                        compactHome={isMobile}
                    />
                </div>
            </div>
        </DraggableWindow>
    );
};

export default ChatQuickModal;
