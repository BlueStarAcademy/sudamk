import React from 'react';
import { createPortal } from 'react-dom';
import DraggableWindow from './DraggableWindow.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { OPPONENT_INSUFFICIENT_ACTION_POINTS_MESSAGE, OPPONENT_INSUFFICIENT_AP_DETAIL } from '../constants.js';
import {
    NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH,
    NATIVE_MOBILE_MODAL_MAX_WIDTH_VW,
} from '../constants/ads.js';

interface OpponentInsufficientActionPointsModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

const MOBILE_OVERLAY_Z = 'z-[250]';

const panelSurface =
    'rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-900/90 via-zinc-950/95 to-black/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';

const btnConfirm =
    'flex w-full min-h-[50px] items-center justify-center rounded-xl border border-fuchsia-400/45 bg-gradient-to-b from-fuchsia-500/25 via-violet-900/35 to-zinc-950/90 px-4 py-3 text-center text-[15px] font-black text-fuchsia-50 shadow-[0_12px_32px_-10px_rgba(217,70,239,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] transition hover:border-fuchsia-300/60 hover:from-fuchsia-400/35 active:translate-y-px sm:text-base';

function ModalChrome({
    children,
    maxHeightStyle,
    maxWidthStyle,
}: {
    children: React.ReactNode;
    maxHeightStyle: React.CSSProperties;
    maxWidthStyle: React.CSSProperties;
}) {
    return (
        <div
            className="relative w-full overflow-hidden rounded-[1.35rem] border border-fuchsia-500/35 bg-zinc-950 shadow-[0_0_0_1px_rgba(0,0,0,0.45),0_28px_90px_-20px_rgba(0,0,0,0.92),0_0_50px_-20px_rgba(217,70,239,0.15)] ring-1 ring-fuchsia-500/10"
            style={{ ...maxWidthStyle, ...maxHeightStyle }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/60 to-transparent" />
            <div className="pointer-events-none absolute -left-20 -top-20 h-44 w-44 rounded-full bg-fuchsia-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -right-20 h-40 w-40 rounded-full bg-violet-600/12 blur-3xl" />
            {children}
        </div>
    );
}

function OpponentModalContent({ onClose, embeddedInWindow }: { onClose: () => void; embeddedInWindow?: boolean }) {
    return (
        <>
            <header className={`relative shrink-0 px-5 ${embeddedInWindow ? 'pt-4 pb-3' : 'pt-5 pb-4'} text-center`}>
                <div className="mx-auto mb-3 flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-2xl border border-fuchsia-400/35 bg-gradient-to-br from-fuchsia-500/25 via-violet-800/25 to-zinc-950/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_28px_-12px_rgba(217,70,239,0.35)]">
                    <span className="text-[1.35rem] font-black leading-none tracking-tight text-fuchsia-100" aria-hidden>
                        VS
                    </span>
                </div>
                <h2
                    id="opponent-insufficient-ap-title"
                    className="bg-gradient-to-r from-fuchsia-100 via-violet-100 to-cyan-100/90 bg-clip-text text-lg font-black leading-tight tracking-tight text-transparent sm:text-xl"
                >
                    대국 신청
                </h2>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-400/50 sm:text-[11px]">
                    Match request
                </p>
            </header>

            <div className="mx-5 h-px shrink-0 bg-gradient-to-r from-transparent via-fuchsia-400/20 to-transparent" />

            <div className={`space-y-4 px-5 ${embeddedInWindow ? 'py-4' : 'py-5'}`}>
                <div className={`${panelSurface} p-4`}>
                    <p className="text-left text-[15px] font-bold leading-snug text-zinc-50 sm:text-base whitespace-pre-line">
                        {OPPONENT_INSUFFICIENT_ACTION_POINTS_MESSAGE}
                    </p>
                    <div className="my-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    <p className="text-left text-[14px] leading-[1.65] text-zinc-400 sm:text-[15px]">{OPPONENT_INSUFFICIENT_AP_DETAIL}</p>
                </div>

                <button type="button" className={btnConfirm} onClick={onClose}>
                    확인
                </button>
            </div>
        </>
    );
}

const OpponentInsufficientActionPointsModal: React.FC<OpponentInsufficientActionPointsModalProps> = ({
    onClose,
    isTopmost = false,
}) => {
    const { isNativeMobile, isNarrowViewport } = useNativeMobileShell();
    const useBodyOverlay = isNativeMobile || isNarrowViewport;

    const maxWidthStyle: React.CSSProperties = {
        maxWidth: `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - max(12px, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px) + 12px)))`,
    };
    const maxHeightStyle: React.CSSProperties = {
        maxHeight: `min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 24px))`,
    };

    if (useBodyOverlay && typeof document !== 'undefined') {
        return createPortal(
            <div
                className={`fixed inset-0 ${MOBILE_OVERLAY_Z} flex items-center justify-center overscroll-contain bg-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="opponent-insufficient-ap-title"
            >
                <button
                    type="button"
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    aria-label="닫기"
                    onClick={onClose}
                />
                <ModalChrome maxHeightStyle={maxHeightStyle} maxWidthStyle={maxWidthStyle}>
                    <OpponentModalContent onClose={onClose} />
                </ModalChrome>
            </div>,
            document.body,
        );
    }

    return (
        <DraggableWindow
            title="대국 신청"
            windowId="opponent-insufficient-action-points-modal"
            onClose={onClose}
            initialWidth={420}
            modal={true}
            closeOnOutsideClick={true}
            isTopmost={isTopmost}
            hideFooter
            mobileViewportFit
            containerExtraClassName="rounded-2xl"
        >
            <div className="sudamr-floating-modal-surface overflow-hidden rounded-b-2xl border-0 bg-transparent p-0 ring-0">
                <OpponentModalContent onClose={onClose} embeddedInWindow />
            </div>
        </DraggableWindow>
    );
};

export default OpponentInsufficientActionPointsModal;
