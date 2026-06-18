import React from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';

interface GuildWarCancelConfirmModalProps {
    onClose: () => void;
    onConfirmCancel: () => void;
    isCanceling?: boolean;
}

const GuildWarCancelConfirmModal: React.FC<GuildWarCancelConfirmModalProps> = ({ onClose, onConfirmCancel, isCanceling }) => {
    const { t } = useTranslation('guild');

    return (
        <DraggableWindow
            title={t('warCancelConfirm.title')}
            onClose={onClose}
            windowId="guild-war-cancel-confirm-modal"
            initialWidth={500}
            initialHeight={320}
        >
            <div className="flex flex-col h-full min-h-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-rose-500/5 to-stone-500/10 pointer-events-none rounded-b-xl" />
                <div className="relative z-10 flex flex-col items-center flex-1 min-h-0 p-6">
                    <p
                        className="text-stone-200 text-base leading-relaxed text-center mb-6"
                        dangerouslySetInnerHTML={{ __html: t('warCancelConfirm.body') }}
                    />
                    <div className="flex gap-3 w-full flex-shrink-0">
                        <Button
                            onClick={onConfirmCancel}
                            disabled={isCanceling}
                            className="flex-1 py-2.5 text-sm font-bold border-2 border-rose-500/60 bg-gradient-to-r from-rose-600/95 to-red-600/95 text-white shadow-lg hover:shadow-xl disabled:opacity-70"
                        >
                            {isCanceling ? t('warCancelConfirm.canceling') : t('warCancelConfirm.confirmCancel')}
                        </Button>
                        <Button
                            onClick={onClose}
                            disabled={isCanceling}
                            className="flex-1 py-2.5 text-sm font-bold border-2 border-amber-500/60 bg-gradient-to-r from-amber-600/95 to-orange-600/95 text-white shadow-lg hover:shadow-xl disabled:opacity-70"
                        >
                            {t('warCancelConfirm.stayJoined')}
                        </Button>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default GuildWarCancelConfirmModal;
