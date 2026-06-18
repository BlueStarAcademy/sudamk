import React from 'react';
import { useTranslation } from 'react-i18next';

const TrainingAssignments: React.FC = () => {
    const { t } = useTranslation('lobby');

    return (
        <div className="bg-gray-800/50 rounded-lg p-4 h-full">
            <h2 className="text-xl font-bold mb-4 text-center">{t('singleplayer.trainingQuest')}</h2>
            <div className="space-y-2">
                <div className="bg-gray-700 p-2 rounded-md">{t('singleplayer.assignmentTask', { number: 1 })}</div>
                <div className="bg-gray-700 p-2 rounded-md">{t('singleplayer.assignmentTask', { number: 2 })}</div>
                <div className="bg-gray-700 p-2 rounded-md">{t('singleplayer.assignmentTask', { number: 3 })}</div>
            </div>
        </div>
    );
};

export default TrainingAssignments;
