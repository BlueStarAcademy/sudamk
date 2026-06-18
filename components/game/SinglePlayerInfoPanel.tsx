import React, { useState } from 'react';
import { tx } from '../../shared/i18n/runtimeText.js';
import { useTranslation } from 'react-i18next';
import { SUDAMR_MODAL_CLOSE_BUTTON_CLASS } from '../DraggableWindow.js';



const ProverbPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const { t } = useTranslation('game');
    const goProverbs = (t('singlePlayerInfo.quotes', { returnObjects: true }) as { term: string; meaning: string }[]) ?? [];
    const [proverbIndex] = useState(() => Math.floor(Math.random() * goProverbs.length));
    const currentProverb = goProverbs[proverbIndex];

    return (
        <div className="bg-gray-800/80 backdrop-blur-sm p-3 rounded-md flex-1 border border-gray-700/50 text-stone-300 flex flex-col min-h-0">
            <h3 className="text-base font-bold border-b border-gray-700 pb-1 mb-2 text-amber-300 flex justify-between items-center flex-shrink-0">
                <span>{t('singlePlayerInfo.proverbsTitle')}</span>
                {onClose && (
                    <button type="button" onClick={onClose} className={SUDAMR_MODAL_CLOSE_BUTTON_CLASS} aria-label={t('singlePlayerInfo.close')}>
                        닫기
                    </button>
                )}
            </h3>
            <div className="flex-grow flex flex-col items-center justify-center text-center min-h-0">
                <p className="text-2xl font-semibold text-stone-100">{currentProverb.term}</p>
                <p className="text-sm text-stone-300 mt-2">{currentProverb.meaning}</p>
            </div>
        </div>
    );
};

export default ProverbPanel;
