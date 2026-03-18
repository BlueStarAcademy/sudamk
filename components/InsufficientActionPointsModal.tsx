import React from 'react';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';

interface InsufficientActionPointsModalProps {
    onClose: () => void;
    onOpenShopConsumables: () => void;
    onOpenDiamondRecharge: () => void;
    isTopmost?: boolean;
}

const InsufficientActionPointsModal: React.FC<InsufficientActionPointsModalProps> = ({ onClose, onOpenShopConsumables, onOpenDiamondRecharge, isTopmost = false }) => {
    const goShopConsumables = () => {
        onClose();
        onOpenShopConsumables();
    };

    const goDiamondRecharge = () => {
        onClose();
        onOpenDiamondRecharge();
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
                <div className="space-y-2">
                    <p className="text-center text-gray-200 font-semibold">
                        행동력이 부족해서 충전이 필요합니다.
                    </p>
                    <p className="text-center text-gray-400 text-sm whitespace-pre-line">
                        아래 방법 중 하나로 바로 충전할 수 있습니다.
                        {'\n'}- 상점 → 소모품 탭 → 행동력 일일 구매
                        {'\n'}- 다이아를 이용한 즉시 충전
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                    <Button onClick={goShopConsumables} colorScheme="accent" className="w-full">
                        상점(소모품)에서 행동력 일일 구매
                    </Button>
                    <Button onClick={goDiamondRecharge} colorScheme="blue" className="w-full">
                        다이아로 즉시 충전
                    </Button>
                    <Button onClick={onClose} colorScheme="gray" className="w-full">
                        닫기
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default InsufficientActionPointsModal;
