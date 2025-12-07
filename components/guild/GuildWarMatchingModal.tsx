import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';

interface GuildWarMatchingModalProps {
    onClose: () => void;
    message: string;
    isTopmost?: boolean;
}

const GuildWarMatchingModal: React.FC<GuildWarMatchingModalProps> = ({ onClose, message, isTopmost }) => {
    return (
        <DraggableWindow 
            title="길드 전쟁 매칭" 
            onClose={onClose} 
            windowId="guild-war-matching-modal" 
            initialWidth={500} 
            initialHeight={300}
            isTopmost={isTopmost}
        >
            <div className="flex flex-col items-center justify-center p-6 text-center h-full">
                <div className="text-6xl mb-4">⚔️</div>
                <h2 className="text-2xl font-bold text-white mb-4">길드 전쟁 매칭 신청</h2>
                <p className="text-gray-300 mb-6 text-lg">{message}</p>
                <Button onClick={onClose} className="w-full py-3">확인</Button>
            </div>
        </DraggableWindow>
    );
};

export default GuildWarMatchingModal;

