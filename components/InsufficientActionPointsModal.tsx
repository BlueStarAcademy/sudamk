import React from 'react';
import { createPortal } from 'react-dom';
import DraggableWindow from './DraggableWindow.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { SELF_INSUFFICIENT_AP_HEADING, SELF_INSUFFICIENT_AP_DETAIL } from '../constants.js';
import {
    NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH,
    NATIVE_MOBILE_MODAL_MAX_WIDTH_VW,
} from '../constants/ads.js';

interface InsufficientActionPointsModalProps {
    onClose: () => void;
    onOpenShopConsumables: () => void;
    onOpenDiamondRecharge: () => void;
    isTopmost?: boolean;
}

const MOBILE_OVERLAY_Z = 'z-[250]';

const panelSurface =
    'rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-900/90 via-zinc-950/95 to-black/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';

const btnPrimary =
    'flex w-full min-h-[50px] items-center justify-center gap-2 rounded-xl border border-amber-400/55 bg-gradient-to-b from-amber-500/[0.35] via-amber-600/[0.2] to-zinc-900/90 px-4 py-3 text-center text-[14px] font-black leading-snug text-amber-50 shadow-[0_12px_32px_-8px_rgba(245,158,11,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:border-amber-300/70 hover:from-amber-400/40 active:translate-y-px active:shadow-[0_6px_20px_-10px_rgba(245,158,11,0.4)] sm:text-[15px]';

const btnSecondary =
    'flex w-full min-h-[50px] items-center justify-center gap-2 rounded-xl border border-sky-400/40 bg-gradient-to-b from-sky-500/25 via-indigo-900/30 to-zinc-950/90 px-4 py-3 text-center text-[14px] font-black leading-snug text-sky-100 shadow-[0_10px_28px_-10px_rgba(56,189,248,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-sky-300/55 hover:from-sky-400/35 active:translate-y-px sm:text-[15px]';

const btnGhost =
    'flex w-full min-h-[46px] items-center justify-center rounded-xl border border-zinc-600/50 bg-zinc-900/40 px-4 py-2.5 text-[14px] font-semibold text-zinc-300 transition hover:border-zinc-500/60 hover:bg-zinc-800/50 active:scale-[0.99] sm:text-[15px]';

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
            className="relative w-full overflow-hidden rounded-[1.35rem] border border-amber-400/40 bg-zinc-950 shadow-[0_0_0_1px_rgba(0,0,0,0.45),0_28px_90px_-20px_rgba(0,0,0,0.92),0_0_60px_-24px_rgba(245,158,11,0.18)] ring-1 ring-amber-500/10"
            style={{ ...maxWidthStyle, ...maxHeightStyle }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
            <div className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-amber-500/12 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-16 h-44 w-44 rounded-full bg-violet-600/10 blur-3xl" />
            {children}
        </div>
    );
}

function SelfModalContent({
    onClose,
    goShopConsumables,
    goDiamondRecharge,
    embeddedInWindow,
}: {
    onClose: () => void;
    goShopConsumables: () => void;
    goDiamondRecharge: () => void;
    embeddedInWindow?: boolean;
}) {
    return (
        <>
            <header className={`relative shrink-0 px-5 ${embeddedInWindow ? 'pt-4 pb-3' : 'pt-5 pb-4'} text-center`}>
                <div className="mx-auto mb-3 flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/30 via-amber-600/15 to-violet-950/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_28px_-12px_rgba(245,158,11,0.45)]">
                    <span className="text-[1.65rem] leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" aria-hidden>
                        ⚡
                    </span>
                </div>
                <h2
                    id="insufficient-ap-modal-title"
                    className="bg-gradient-to-r from-amber-50 via-amber-100 to-amber-200/95 bg-clip-text text-lg font-black leading-tight tracking-tight text-transparent sm:text-xl"
                >
                    행동력 부족
                </h2>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-400/55 sm:text-[11px]">
                    Insufficient action points
                </p>
            </header>

            <div className="mx-5 h-px shrink-0 bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />

            <div
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 ${embeddedInWindow ? 'py-4' : 'py-5'} [-webkit-overflow-scrolling:touch]`}
            >
                <div className={`space-y-4 ${panelSurface} p-4`}>
                    <p className="text-left text-[15px] font-bold leading-snug tracking-tight text-zinc-50 sm:text-base">
                        {SELF_INSUFFICIENT_AP_HEADING}
                    </p>
                    <p className="text-left text-[14px] leading-[1.65] text-zinc-400 sm:text-[15px]">{SELF_INSUFFICIENT_AP_DETAIL}</p>
                </div>

                <div className="mt-4">
                    <p className="mb-3 flex items-center gap-2 text-left text-[11px] font-black uppercase tracking-[0.14em] text-amber-200/90">
                        <span className="h-px flex-1 max-w-[2rem] bg-gradient-to-r from-amber-400/50 to-transparent" aria-hidden />
                        충전 방법
                        <span className="h-px flex-1 bg-gradient-to-l from-amber-400/50 to-transparent" aria-hidden />
                    </p>
                    <ul className="space-y-3">
                        <li
                            className={`flex gap-3 ${panelSurface} p-3.5 text-left`}
                        >
                            <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/15 text-sm font-black text-amber-200"
                                aria-hidden
                            >
                                1
                            </span>
                            <div className="min-w-0 flex-1 pt-0.5">
                                <p className="text-[13px] font-bold leading-snug text-zinc-100 sm:text-sm">상점 · 소모품</p>
                                <p className="mt-1 text-[12px] leading-relaxed text-zinc-500 sm:text-[13px]">
                                    행동력 회복제 구매
                                    <span className="text-zinc-600"> · 종류별 하루 1개</span>
                                </p>
                            </div>
                        </li>
                        <li className={`flex gap-3 ${panelSurface} p-3.5 text-left`}>
                            <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-400/30 bg-sky-500/10 text-sm font-black text-sky-200"
                                aria-hidden
                            >
                                2
                            </span>
                            <div className="min-w-0 flex-1 pt-0.5">
                                <p className="text-[13px] font-bold leading-snug text-zinc-100 sm:text-sm">다이아 즉시 충전</p>
                                <p className="mt-1 text-[12px] leading-relaxed text-zinc-500 sm:text-[13px]">
                                    원할 때 바로 행동력을 채울 수 있습니다.
                                </p>
                            </div>
                        </li>
                    </ul>
                </div>

                <div className="mt-6 flex flex-col gap-2.5">
                    <button type="button" className={btnPrimary} onClick={goShopConsumables}>
                        <span className="max-w-[95%]">상점(소모품)에서 회복제 구매</span>
                    </button>
                    <button type="button" className={btnSecondary} onClick={goDiamondRecharge}>
                        <span className="max-w-[95%]">다이아로 즉시 충전</span>
                    </button>
                    <button type="button" className={btnGhost} onClick={onClose}>
                        닫기
                    </button>
                </div>
            </div>
        </>
    );
}

const InsufficientActionPointsModal: React.FC<InsufficientActionPointsModalProps> = ({
    onClose,
    onOpenShopConsumables,
    onOpenDiamondRecharge,
    isTopmost = false,
}) => {
    const { isNativeMobile, isNarrowViewport } = useNativeMobileShell();
    const useBodyOverlay = isNativeMobile || isNarrowViewport;

    const goShopConsumables = () => {
        onClose();
        onOpenShopConsumables();
    };

    const goDiamondRecharge = () => {
        onClose();
        onOpenDiamondRecharge();
    };

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
                aria-labelledby="insufficient-ap-modal-title"
            >
                <button
                    type="button"
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    aria-label="닫기"
                    onClick={onClose}
                />
                <ModalChrome maxHeightStyle={maxHeightStyle} maxWidthStyle={maxWidthStyle}>
                    <div className="relative flex max-h-[min(88dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem))] w-full flex-col overflow-hidden">
                        <SelfModalContent
                            onClose={onClose}
                            goShopConsumables={goShopConsumables}
                            goDiamondRecharge={goDiamondRecharge}
                        />
                    </div>
                </ModalChrome>
            </div>,
            document.body,
        );
    }

    return (
        <DraggableWindow
            title="행동력 부족"
            windowId="insufficient-action-points-modal"
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
                <SelfModalContent
                    embeddedInWindow
                    onClose={onClose}
                    goShopConsumables={goShopConsumables}
                    goDiamondRecharge={goDiamondRecharge}
                />
            </div>
        </DraggableWindow>
    );
};

export default InsufficientActionPointsModal;
