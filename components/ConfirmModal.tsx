import React, { useMemo } from 'react';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';

type ButtonColorScheme = 'blue' | 'red' | 'gray' | 'green' | 'yellow' | 'purple' | 'orange' | 'accent' | 'none';

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
    variant?: 'default' | 'premium-danger';
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
}) => {
    const modalWindowId = useMemo(() => windowId || 'confirm-modal', [windowId]);
    
    const handleConfirm = () => {
        onCancel();
        onConfirm();
    };

    return (
        <DraggableWindow
            title={title}
            windowId={modalWindowId}
            onClose={onCancel}
            initialWidth={variant === 'premium-danger' ? 440 : 400}
            initialHeight={variant === 'premium-danger' ? 340 : undefined}
            modal={true}
            closeOnOutsideClick={true}
            isTopmost={isTopmost}
            zIndex={isTopmost ? 9999 : 50}
            bodyScrollable={variant !== 'premium-danger'}
            mobileViewportFit={variant === 'premium-danger'}
            mobileViewportMaxHeightVh={90}
        >
            <div className={`space-y-5 p-5 sm:p-6 ${variant === 'premium-danger' ? 'bg-gradient-to-b from-[#171923] via-[#11131a] to-[#0a0b10]' : ''}`}>
                <div className={`${variant === 'premium-danger' ? 'relative overflow-hidden rounded-xl border border-red-400/30 bg-gradient-to-r from-red-900/25 via-rose-900/20 to-red-900/25 p-4 shadow-[0_16px_36px_-24px_rgba(248,113,113,0.65)]' : 'sudamr-modal-message-panel'}`}>
                    {variant === 'premium-danger' && (
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-red-500/10 via-transparent to-orange-500/10" aria-hidden />
                    )}
                    <p className={`whitespace-pre-line text-center leading-relaxed ${variant === 'premium-danger' ? 'relative text-[15px] font-semibold text-red-50' : 'text-base text-secondary'}`}>{message}</p>
                </div>
                <div className="flex gap-3 sm:gap-4">
                    <Button
                        onClick={onCancel}
                        colorScheme="gray"
                        className={variant === 'premium-danger' ? 'flex-1 !rounded-xl !border !border-white/20 !bg-gradient-to-r !from-stone-700/90 !to-neutral-700/90 !text-sm !font-semibold text-white shadow-md' : 'flex-1'}
                    >
                        {cancelText}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        colorScheme={confirmColorScheme}
                        className={variant === 'premium-danger' ? 'flex-1 !rounded-xl !border !border-red-400/50 !bg-gradient-to-r !from-red-500/95 !via-rose-600/95 !to-red-700/95 !text-sm !font-bold text-white shadow-[0_16px_34px_-20px_rgba(248,113,113,0.85)] hover:brightness-110' : 'flex-1'}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default ConfirmModal;

