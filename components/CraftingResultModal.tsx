
import React from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { MATERIAL_ITEMS } from '../constants';
import { useLocalizedInventoryItemName } from '../shared/i18n/localizedCatalog.js';

interface CraftingResultModalProps {
    result: {
        gained: { name: string, amount: number }[];
        used: { name: string, amount: number }[];
        craftType: 'upgrade' | 'downgrade';
        jackpot?: boolean;
    };
    onClose: () => void;
    isTopmost?: boolean;
}

const CraftingResultModal: React.FC<CraftingResultModalProps> = ({ result, onClose, isTopmost }) => {
    const { t } = useTranslation(['inventory', 'common']);
    const localizedItemName = useLocalizedInventoryItemName();
    const { gained, used, craftType, jackpot } = result;

    const title = jackpot
        ? (craftType === 'upgrade' ? t('craftingResult.upgradeJackpotTitle') : t('craftingResult.downgradeJackpotTitle'))
        : (craftType === 'upgrade' ? t('craftingResult.upgradeTitle') : t('craftingResult.downgradeTitle'));
    const gainedItem = gained[0];
    const usedItem = used[0];

    const gainedTemplate = MATERIAL_ITEMS[gainedItem.name as keyof typeof MATERIAL_ITEMS];
    const usedTemplate = MATERIAL_ITEMS[usedItem.name as keyof typeof MATERIAL_ITEMS];

    return (
        <DraggableWindow title={title} onClose={onClose} windowId="crafting-result" initialWidth={400} isTopmost={isTopmost} zIndex={70}>
            <div className="text-center">
                {jackpot && (
                    <div className="mb-4">
                        <div className="text-3xl font-bold text-yellow-400 animate-pulse">{t('craftingResult.jackpotHeading')}</div>
                        <div className="text-lg text-yellow-300 mt-2">{t('craftingResult.jackpotBody')}</div>
                    </div>
                )}
                <h2 className="text-xl font-bold mb-4">{t('craftingResult.convertedBody')}</h2>

                <div className="flex items-center justify-around text-center mb-4 bg-gray-900/50 p-4 rounded-lg">
                    <div className="flex flex-col items-center">
                        {usedTemplate?.image && <img src={usedTemplate.image} alt={localizedItemName(usedItem.name)} className="w-16 h-16" />}
                        <span className="font-semibold">{localizedItemName(usedItem.name)}</span>
                        <span className="text-sm text-red-400 mt-1">-{usedItem.amount.toLocaleString()}{t('craftingResult.quantityUnit')}</span>
                    </div>
                    <div className="text-4xl font-bold text-yellow-400 mx-4">→</div>
                    <div className="flex flex-col items-center">
                        {gainedTemplate?.image && <img src={gainedTemplate.image} alt={localizedItemName(gainedItem.name)} className="w-16 h-16" />}
                        <span className="font-semibold">{localizedItemName(gainedItem.name)}</span>
                        <span className={`text-sm mt-1 ${jackpot ? 'text-yellow-400 font-bold' : 'text-green-400'}`}>
                            +{gainedItem.amount.toLocaleString()}{t('craftingResult.quantityUnit')}
                        </span>
                    </div>
                </div>

                <Button onClick={onClose} className="w-full mt-6 py-2.5">{t('common:actions.ok')}</Button>
            </div>
        </DraggableWindow>
    );
};

export default CraftingResultModal;
