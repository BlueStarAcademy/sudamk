import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../hooks/useAppContext.js';
import Button from '../Button.js';

interface GuildWarPanelProps {
    guildId: string;
}

const GuildWarPanel: React.FC<GuildWarPanelProps> = ({ guildId }) => {
    const { t } = useTranslation('guild');
    const { handlers } = useAppContext();

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">{t('warPanelLegacy.title')}</h2>
            <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 mb-4">{t('warPanelLegacy.comingSoon')}</p>
                <Button
                    onClick={() => {
                        alert(t('warPanelLegacy.comingSoon'));
                    }}
                    colorScheme="blue"
                    className="!py-2 !px-4"
                    disabled
                >
                    {t('warPanelLegacy.start')}
                </Button>
            </div>
        </div>
    );
};

export default GuildWarPanel;
