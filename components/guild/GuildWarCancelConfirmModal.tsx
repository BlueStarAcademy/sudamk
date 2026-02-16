import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';

interface GuildWarCancelConfirmModalProps {
    onClose: () => void;
    onConfirmCancel: () => void;
    isCanceling?: boolean;
}

const GuildWarCancelConfirmModal: React.FC<GuildWarCancelConfirmModalProps> = ({ onClose, onConfirmCancel, isCanceling }) => {
    return (
        <DraggableWindow
            title="전쟁 취소 확인"
            onClose={onClose}
            windowId="guild-war-cancel-confirm-modal"
            initialWidth={500}
            initialHeight={320}
        >
            <div className="flex flex-col h-full min-h-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-rose-500/5 to-stone-500/10 pointer-events-none rounded-b-xl" />
                <div className="relative z-10 flex flex-col items-center flex-1 min-h-0 p-6">
                    <p className="text-stone-200 text-base leading-relaxed text-center mb-6">
                        전쟁 취소 시 1시간 동안 재참여가 되지 않습니다.<br />
                        그래도 취소하시겠습니까?
                    </p>
                    <div className="flex gap-3 w-full flex-shrink-0">
                        <Button
                            onClick={onConfirmCancel}
                            disabled={isCanceling}
                            className="flex-1 py-2.5 text-sm font-bold border-2 border-rose-500/60 bg-gradient-to-r from-rose-600/95 to-red-600/95 text-white shadow-lg hover:shadow-xl disabled:opacity-70"
                        >
                            {isCanceling ? '취소 중...' : '전쟁 취소'}
                        </Button>
                        <Button
                            onClick={onClose}
                            disabled={isCanceling}
                            className="flex-1 py-2.5 text-sm font-bold border-2 border-amber-500/60 bg-gradient-to-r from-amber-600/95 to-orange-600/95 text-white shadow-lg hover:shadow-xl disabled:opacity-70"
                        >
                            전쟁 참여
                        </Button>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default GuildWarCancelConfirmModal;
