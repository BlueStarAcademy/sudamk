import { useTranslation } from 'react-i18next';
import React, { useMemo } from 'react';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';

interface AlertModalProps {
    title?: string;
    message: string;
    onClose: () => void;
    confirmText?: string;
    isTopmost?: boolean;
    windowId?: string;
}

const AlertModal: React.FC<AlertModalProps> = ({ title, message, onClose, confirmText, isTopmost = false, windowId }) => {
    const { t } = useTranslation('common');
    const resolvedTitle = title ?? t('alerts.title');
    const resolvedConfirm = confirmText ?? t('actions.ok');
    const modalWindowId = useMemo(() => windowId || 'alert-modal', [windowId]);
    
    return (
        <DraggableWindow
            title={resolvedTitle}
            windowId={modalWindowId}
            onClose={onClose}
            initialWidth={400}
            modal={true}
            closeOnOutsideClick={true}
            isTopmost={isTopmost ?? true}
        >
            <div className="space-y-5 p-5 sm:p-6">
                <div className="sudamr-modal-message-panel">
                    <p className="whitespace-pre-line text-center text-base leading-relaxed text-secondary">{message}</p>
                </div>
                <div className="flex justify-center">
                    <Button onClick={onClose} colorScheme="blue" className="w-full max-w-xs">
                        {resolvedConfirm}
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default AlertModal;

