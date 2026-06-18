import React from 'react';
import { useTranslation } from 'react-i18next';
import { GuildMission } from '../../types/entities.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import Button from '../Button.js';

interface GuildMissionPanelProps {
    guildId: string;
    missions: GuildMission[];
    onMissionsUpdate: (missions: GuildMission[]) => void;
}

const GuildMissionPanel: React.FC<GuildMissionPanelProps> = ({ guildId, missions, onMissionsUpdate }) => {
    const { t } = useTranslation('guild');
    const { handlers, currentUserWithStatus } = useAppContext();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{t('missionPanelLegacy.title')}</h2>
                {currentUserWithStatus?.guildId && (
                    <Button
                        onClick={async () => {
                            alert(t('missionPanelLegacy.createComingSoon'));
                        }}
                        colorScheme="green"
                        className="!py-2 !px-4"
                    >
                        {t('missionPanelLegacy.create')}
                    </Button>
                )}
            </div>
            <div className="space-y-2">
                {missions.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">{t('missionPanelLegacy.empty')}</p>
                ) : (
                    missions.map((mission) => (
                        <div key={mission.id} className="p-4 bg-gray-800/50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-semibold text-white">{mission.missionType}</h3>
                                <span className={`px-2 py-1 rounded text-xs ${
                                    mission.status === 'active' ? 'bg-green-600 text-white' :
                                    mission.status === 'completed' ? 'bg-blue-600 text-white' :
                                    'bg-gray-600 text-white'
                                }`}>
                                    {mission.status === 'active' && t('missionPanelLegacy.statusActive')}
                                    {mission.status === 'completed' && t('missionPanelLegacy.statusCompleted')}
                                    {mission.status === 'expired' && t('missionPanelLegacy.statusExpired')}
                                </span>
                            </div>
                            {mission.target && (
                                <div className="text-sm text-gray-400">
                                    {t('missionPanelLegacy.target', { target: JSON.stringify(mission.target) })}
                                </div>
                            )}
                            {mission.progress && (
                                <div className="text-sm text-gray-300 mt-2">
                                    {t('missionPanelLegacy.progress', { progress: JSON.stringify(mission.progress) })}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default GuildMissionPanel;
