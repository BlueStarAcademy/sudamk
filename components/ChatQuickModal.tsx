import React, { useMemo } from 'react';
import DraggableWindow from './DraggableWindow.js';
import ChatWindow from './waiting-room/ChatWindow.js';
import type { ChatMessage, ServerAction } from '../types.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { NATIVE_MOBILE_CHAT_MODAL_MAX_HEIGHT_VH, NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH } from '../constants/ads.js';

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
            mobileLockViewportHeight={isMobile}
            mobileViewportMaxHeightVh={isMobile ? NATIVE_MOBILE_CHAT_MODAL_MAX_HEIGHT_VH : NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}
            bodyPaddingClassName={
                isMobile
                    ? '!p-2 !pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]'
                    : undefined
            }
            bodyNoScroll
            bodyScrollable={false}
        >
            <div className={bodyClass}>
                <div
                    className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-sky-500/18 bg-gradient-to-br from-slate-900/94 via-slate-950/97 to-[#050608] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_56px_-24px_rgba(0,0,0,0.82)] ring-1 ring-inset ring-white/[0.05] ${
                        isMobile ? 'p-2' : 'p-3 sm:p-3.5'
                    }`}
                >
                    <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/35 to-transparent"
                        aria-hidden
                    />
                    <div
                        className="pointer-events-none absolute inset-x-8 top-2 h-10 rounded-full bg-sky-400/[0.08] blur-2xl"
                        aria-hidden
                    />
                    <div className="relative z-[1] flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                        <ChatWindow
                            messages={messages}
                            mode="global"
                            onAction={onAction}
                            onViewUser={onViewUser}
                            locationPrefix="[홈]"
                            compactTournamentMobile={isMobile}
                            arenaPremium
                        />
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default ChatQuickModal;
