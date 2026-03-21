import React from 'react';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import { OPPONENT_INSUFFICIENT_ACTION_POINTS_MESSAGE, OPPONENT_INSUFFICIENT_AP_DETAIL } from '../constants.js';

interface OpponentInsufficientActionPointsModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

const OpponentInsufficientActionPointsModal: React.FC<OpponentInsufficientActionPointsModalProps> = ({
    onClose,
    isTopmost = false,
}) => (
    <DraggableWindow
        title="대국 신청"
        windowId="opponent-insufficient-action-points-modal"
        onClose={onClose}
        initialWidth={400}
        modal={true}
        closeOnOutsideClick={true}
        isTopmost={isTopmost}
    >
        <div className="p-4 space-y-4">
            <p className="text-center text-gray-200 font-semibold whitespace-pre-line">
                {OPPONENT_INSUFFICIENT_ACTION_POINTS_MESSAGE}
            </p>
            <p className="text-center text-gray-300 text-sm leading-relaxed">
                {OPPONENT_INSUFFICIENT_AP_DETAIL}
            </p>
            <Button onClick={onClose} colorScheme="gray" className="w-full">
                확인
            </Button>
        </div>
    </DraggableWindow>
);

export default OpponentInsufficientActionPointsModal;
