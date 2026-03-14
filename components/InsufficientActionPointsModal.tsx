import React from 'react';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';

interface InsufficientActionPointsModalProps {
    onClose: () => void;
    onOpenShop: () => void;
    isTopmost?: boolean;
}

const InsufficientActionPointsModal: React.FC<InsufficientActionPointsModalProps> = ({ onClose, onOpenShop, isTopmost = false }) => {
    const handlePurchase = () => {
        onClose();
        onOpenShop();
    };

    return (
        <DraggableWindow
            title="행동력 부족"
            windowId="insufficient-action-points-modal"
            onClose={onClose}
            initialWidth={400}
            modal={true}
            closeOnOutsideClick={true}
            isTopmost={isTopmost}
        >
            <div className="p-4 space-y-4">
                <p className="text-center text-gray-300 whitespace-pre-line">
                    행동력이 부족하여 게임을 시작할 수 없습니다.
                    {'\n'}상점에서 다이아로 행동력을 구매할 수 있습니다.
                </p>
                <div className="flex gap-3 justify-center">
                    <Button onClick={onClose} colorScheme="gray" className="flex-1">
                        닫기
                    </Button>
                    <Button onClick={handlePurchase} colorScheme="accent" className="flex-1">
                        행동력 구매
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default InsufficientActionPointsModal;
