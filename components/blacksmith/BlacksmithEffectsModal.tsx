import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import BlacksmithLevelEffectsSummary from './BlacksmithLevelEffectsSummary.js';

interface BlacksmithEffectsModalProps {
    onClose: () => void;
    isTopmost?: boolean;
    blacksmithLevel: number;
}

const BlacksmithEffectsModal: React.FC<BlacksmithEffectsModalProps> = ({ onClose, isTopmost, blacksmithLevel }) => {
    return (
        <DraggableWindow
            title="대장간 효과"
            onClose={onClose}
            windowId="blacksmith-effects"
            initialWidth={420}
            initialHeight={520}
            isTopmost={isTopmost}
            variant="store"
        >
            <div className="max-h-[min(72dvh,560px)] overflow-y-auto pr-2">
                <BlacksmithLevelEffectsSummary blacksmithLevel={blacksmithLevel} />
            </div>
        </DraggableWindow>
    );
};

export default BlacksmithEffectsModal;
