import React from 'react';
import DraggableWindow from './DraggableWindow.js';
import PointsInfoPanel from './PointsInfoPanel.js';

interface ChampionshipPointsModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

/** 모바일 챔피언십: 일일 획득 가능 점수를 패널 대신 모달로 표시 */
const ChampionshipPointsModal: React.FC<ChampionshipPointsModalProps> = ({ onClose, isTopmost }) => {
    return (
        <DraggableWindow
            title="일일 획득 가능 점수"
            onClose={onClose}
            windowId="championship-points-info"
            initialWidth={480}
            isTopmost={isTopmost}
        >
            <div className="max-h-[min(72vh,560px)] overflow-y-auto pr-1 text-gray-200">
                <PointsInfoPanel />
            </div>
        </DraggableWindow>
    );
};

export default ChampionshipPointsModal;
