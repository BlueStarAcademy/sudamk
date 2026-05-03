import React, { useMemo } from 'react';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';

type ButtonColorScheme = 'blue' | 'red' | 'gray' | 'green' | 'yellow' | 'purple' | 'orange' | 'accent' | 'none';

const DIAMOND_ICON = '/images/icon/Zem.png';

interface ConfirmModalProps {
    title?: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    confirmColorScheme?: ButtonColorScheme;
    isTopmost?: boolean;
    windowId?: string;
    variant?: 'default' | 'premium-danger' | 'premium-ledger';
    /** `premium-ledger`: 상단에 강조 표시할 다이아 비용 */
    ledgerCost?: number;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    title = '확인',
    message,
    onConfirm,
    onCancel,
    confirmText = '확인',
    cancelText = '취소',
    confirmColorScheme = 'red',
    isTopmost = false,
    windowId,
    variant = 'default',
    ledgerCost,
}) => {
    const modalWindowId = useMemo(() => windowId || 'confirm-modal', [windowId]);
    const isPremium = variant === 'premium-danger' || variant === 'premium-ledger';

    const handleConfirm = () => {
        onCancel();
        onConfirm();
    };

    const initialWidth = variant === 'premium-danger' ? 440 : variant === 'premium-ledger' ? 640 : 400;
    /** `premium-ledger`: 높이는 본문에 맞춤(`shrinkHeightToContent`). 고정 높이를 주면 여백·잘림이 생길 수 있음 */
    const initialHeight = variant === 'premium-danger' ? 340 : undefined;

    return (
        <DraggableWindow
            title={title}
            windowId={modalWindowId}
            onClose={onCancel}
            initialWidth={initialWidth}
            initialHeight={initialHeight}
            shrinkHeightToContent={variant === 'premium-ledger'}
            modal={true}
            closeOnOutsideClick={true}
            isTopmost={isTopmost}
            zIndex={isTopmost ? 9999 : 50}
            bodyScrollable={!isPremium}
            mobileViewportFit={isPremium}
            mobileViewportMaxHeightVh={90}
            hideFooter
        >
            <div
                className={`relative space-y-5 p-5 sm:p-6 ${
                    variant === 'premium-danger'
                        ? 'bg-gradient-to-b from-[#171923] via-[#11131a] to-[#0a0b10]'
                        : variant === 'premium-ledger'
                          ? 'bg-gradient-to-b from-zinc-950 via-[#12141c] to-black'
                          : ''
                }`}
            >
                {variant === 'premium-ledger' && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/45 to-transparent" aria-hidden />
                )}

                <div
                    className={
                        variant === 'premium-danger'
                            ? 'relative overflow-hidden rounded-xl border border-red-400/30 bg-gradient-to-r from-red-900/25 via-rose-900/20 to-red-900/25 p-4 shadow-[0_16px_36px_-24px_rgba(248,113,113,0.65)]'
                            : variant === 'premium-ledger'
                              ? 'relative overflow-hidden rounded-2xl border border-amber-400/22 bg-gradient-to-br from-amber-950/35 via-zinc-950/80 to-black/95 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_48px_-28px_rgba(251,191,36,0.35)] ring-1 ring-white/[0.04]'
                              : 'sudamr-modal-message-panel'
                    }
                >
                    {variant === 'premium-danger' && (
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-red-500/10 via-transparent to-orange-500/10" aria-hidden />
                    )}
                    {variant === 'premium-ledger' && (
                        <>
                            <div
                                className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_120%_at_50%_-20%,rgba(251,191,36,0.12),transparent_55%)]"
                                aria-hidden
                            />
                            {typeof ledgerCost === 'number' && (
                                <div className="relative mb-4 flex flex-col items-center gap-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/50">소모</span>
                                    <div className="flex items-center gap-2 rounded-full border border-amber-400/35 bg-black/50 px-5 py-2 shadow-inner ring-1 ring-amber-500/15">
                                        <img src={DIAMOND_ICON} alt="" className="h-6 w-6 object-contain" aria-hidden />
                                        <span className="text-2xl font-black tabular-nums tracking-tight text-amber-50 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)]">
                                            {ledgerCost.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    <p
                        className={`text-center leading-relaxed ${
                            variant === 'premium-danger'
                                ? 'relative whitespace-pre-line text-[15px] font-semibold text-red-50'
                                : variant === 'premium-ledger'
                                  ? 'relative text-[15px] font-medium leading-snug text-zinc-200 whitespace-nowrap max-[520px]:whitespace-normal'
                                  : 'whitespace-pre-line text-base text-secondary'
                        }`}
                    >
                        {message}
                    </p>
                </div>
                <div className="flex gap-3 sm:gap-4">
                    <Button
                        onClick={onCancel}
                        colorScheme="gray"
                        className={
                            isPremium
                                ? 'flex-1 !rounded-xl !border !border-white/18 !bg-gradient-to-r !from-zinc-800/95 !to-zinc-900/95 !py-2.5 !text-sm !font-semibold !text-zinc-100 shadow-md hover:!brightness-110'
                                : 'flex-1'
                        }
                    >
                        {cancelText}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        colorScheme={variant === 'premium-ledger' ? 'yellow' : confirmColorScheme}
                        className={
                            variant === 'premium-danger'
                                ? 'flex-1 !rounded-xl !border !border-red-400/50 !bg-gradient-to-r !from-red-500/95 !via-rose-600/95 !to-red-700/95 !py-2.5 !text-sm !font-bold text-white shadow-[0_16px_34px_-20px_rgba(248,113,113,0.85)] hover:brightness-110'
                                : variant === 'premium-ledger'
                                  ? 'flex-1 !rounded-xl !border !border-amber-400/45 !bg-gradient-to-r !from-amber-500/92 !via-amber-600/88 !to-orange-700/90 !py-2.5 !text-sm !font-bold !text-amber-950 shadow-[0_14px_36px_-18px_rgba(251,191,36,0.55)] hover:!brightness-110'
                                  : 'flex-1'
                        }
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default ConfirmModal;

