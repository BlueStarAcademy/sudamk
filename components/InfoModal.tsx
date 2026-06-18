import { useTranslation } from 'react-i18next';
import React from 'react';
import GuideModal from './GuideModal.js';
import type { GuideSelection } from './guide/GuidePanelLayout.js';

interface InfoModalProps {
    onClose: () => void;
    isTopmost?: boolean;
    initialSelection?: GuideSelection | null;
}

const InfoModal: React.FC<InfoModalProps> = ({ onClose, isTopmost, initialSelection }) => {
    const { t } = useTranslation('nav');
    return (
    <GuideModal
        title={t('quickMenu.help')}
        windowId="info-modal"
        onClose={onClose}
        isTopmost={isTopmost}
        initialSelection={initialSelection ?? undefined}
    />
);
};

export default InfoModal;
