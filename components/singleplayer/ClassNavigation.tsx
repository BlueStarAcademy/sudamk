import React from 'react';
import { useTranslation } from 'react-i18next';

const ClassNavigation: React.FC = () => {
    const { t } = useTranslation(['lobby', 'profile']);

    return (
        <div className="bg-gray-800/50 rounded-lg p-4 h-full flex flex-col items-center justify-center">
            <h2 className="text-xl font-bold mb-4">{t('profile:stageLabels.intro')}</h2>
            <div className="flex items-center gap-4">
                <button className="text-2xl" type="button" aria-label={t('lobby:singleplayer.previousClass')}>
                    ⬅️
                </button>
                <img src="/images/championship/Champ1.webp" alt={t('profile:stageLabels.intro')} className="w-48 h-32" />
                <button className="text-2xl" type="button" aria-label={t('lobby:singleplayer.nextClass')}>
                    ➡️
                </button>
            </div>
        </div>
    );
};

export default ClassNavigation;
