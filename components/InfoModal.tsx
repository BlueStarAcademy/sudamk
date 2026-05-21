import React from 'react';
import GuideModal from './GuideModal.js';
import type { GuideSelection } from './guide/GuidePanelLayout.js';

interface InfoModalProps {
    onClose: () => void;
    isTopmost?: boolean;
    initialSelection?: GuideSelection | null;
}

const InfoModal: React.FC<InfoModalProps> = ({ onClose, isTopmost, initialSelection }) => (
    <GuideModal
        title="도움말 센터"
        windowId="info-modal"
        onClose={onClose}
        isTopmost={isTopmost}
        initialSelection={initialSelection ?? undefined}
    />
);

export default InfoModal;
