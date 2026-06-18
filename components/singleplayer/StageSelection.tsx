import React from 'react';
import { useTranslation } from 'react-i18next';

const StageSelection: React.FC = () => {
    const { t } = useTranslation('lobby');

    return (
        <div className="bg-gray-800/50 rounded-lg p-4 h-full">
            <h2 className="text-xl font-bold mb-4 text-center">{t('singleplayer.stageSelect')}</h2>
            <div className="grid grid-cols-5 gap-4">
                {Array.from({ length: 20 }, (_, i) => (
                    <div key={i} className="aspect-square bg-gray-700 rounded-md flex items-center justify-center">
                        {i + 1}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StageSelection;
