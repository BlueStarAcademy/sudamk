import React from 'react';
import { useTranslation } from 'react-i18next';
import { InventoryItem, UserWithStatus, ServerAction, EnhancementResult } from '../types.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow';

interface EnhancementModalProps {
    item: InventoryItem;
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    enhancementOutcome: EnhancementResult | null;
    onOutcomeConfirm: () => void;
    isTopmost: boolean;
}

const EnhancementModal: React.FC<EnhancementModalProps> = ({ item, currentUser, onClose, onAction, enhancementOutcome, onOutcomeConfirm, isTopmost }) => {
    const { t } = useTranslation(['blacksmith', 'common']);

    return (
        <DraggableWindow title={t('enhancementModal.title')} onClose={onClose} windowId="enhancement" isTopmost={isTopmost}>
            <div className="p-4">
                <p>{t('enhancementModal.placeholder', { name: item.name })}</p>
                <Button onClick={onClose}>{t('common:actions.close')}</Button>
            </div>
        </DraggableWindow>
    );
};

export default EnhancementModal;
