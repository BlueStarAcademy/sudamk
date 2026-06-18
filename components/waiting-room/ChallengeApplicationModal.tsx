import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { GameMode, GameSettings, ServerAction, UserWithStatus } from '../../types.js';
import { SPECIAL_GAME_MODES, DEFAULT_GAME_SETTINGS, filterPlayableLobbyGameModes, isPlayableLobbyGameMode } from '../../constants';
import { getRankedGameSettings } from '../../constants/rankedGameSettings.js';
import Avatar from '../Avatar.js';
import { AVATAR_POOL, BORDER_POOL } from '../../constants';
import { useLocalizedGameMode } from '../../shared/i18n/localizedCatalog.js';

interface ChallengeApplicationModalProps {
    opponentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
}

const ChallengeApplicationModal: React.FC<ChallengeApplicationModalProps> = ({ opponentUser, onClose, onAction }) => {
    const { t } = useTranslation('lobby');
    const { t: tCommon } = useTranslation('common');
    const localizeMode = useLocalizedGameMode();
    const [selectedGameMode, setSelectedGameMode] = useState<GameMode>(filterPlayableLobbyGameModes(SPECIAL_GAME_MODES)[0].mode);

    const selectedGameDefinition = useMemo(() => {
        return SPECIAL_GAME_MODES.find(mode => mode.mode === selectedGameMode);
    }, [selectedGameMode]);

    const isGameModeRejected = useMemo(() => {
        return opponentUser.rejectedGameModes?.includes(selectedGameMode);
    }, [opponentUser.rejectedGameModes, selectedGameMode]);

    const modeLabel = localizeMode(selectedGameMode);

    const handleChallenge = () => {
        if (isGameModeRejected) {
            alert(t('challenge.modeRejected', { mode: modeLabel }));
            return;
        }
        const ranked = getRankedGameSettings(selectedGameMode);
        const settings: GameSettings = { ...DEFAULT_GAME_SETTINGS, ...ranked };
        onAction({
            type: 'CHALLENGE_USER',
            payload: { opponentId: opponentUser.id, mode: selectedGameMode, settings },
        });
        onClose();
    };

    const avatarUrl = AVATAR_POOL.find(a => a.id === opponentUser.avatarId)?.url;
    const borderUrl = BORDER_POOL.find(b => b.id === opponentUser.borderId)?.url;

    return (
        <DraggableWindow title={t('challenge.title')} onClose={onClose} windowId="challenge-application" initialWidth={600} isTopmost>
            <div className="flex h-[400px]">
                <div className="w-1/3 bg-tertiary/30 p-4 flex flex-col text-on-panel rounded-l-lg">
                    <div className="flex items-center gap-2 mb-4">
                        <Avatar userId={opponentUser.id} userName={opponentUser.nickname} size={48} className="border-2 border-color" avatarUrl={avatarUrl} borderUrl={borderUrl} />
                        <h3 className="font-bold text-lg">{opponentUser.nickname}</h3>
                    </div>
                    {isGameModeRejected && (
                        <p className="text-sm text-red-400 mb-2">
                            {t('challenge.modeRejected', { mode: modeLabel })}
                        </p>
                    )}
                    <h3 className="font-bold text-lg mb-2">{selectedGameDefinition?.name}</h3>
                    <p className="text-sm text-tertiary flex-grow overflow-y-auto">
                        {selectedGameDefinition?.description || t('challenge.selectForDescription')}
                    </p>
                </div>

                <div className="w-2/3 bg-primary p-4 flex flex-col rounded-r-lg">
                    <div className="flex border-b border-color mb-4">
                        {SPECIAL_GAME_MODES.map(game => (
                            <button
                                key={game.mode}
                                type="button"
                                disabled={!isPlayableLobbyGameMode(game)}
                                onClick={() => {
                                    if (isPlayableLobbyGameMode(game)) setSelectedGameMode(game.mode);
                                }}
                                className={`px-4 py-2 text-sm font-semibold ${
                                    !isPlayableLobbyGameMode(game)
                                        ? 'cursor-not-allowed text-tertiary/60 opacity-50'
                                        : selectedGameMode === game.mode
                                        ? 'border-b-2 border-accent text-accent'
                                        : 'text-secondary hover:bg-secondary/20'
                                }`}
                            >
                                {localizeMode(game.mode)}
                            </button>
                        ))}
                    </div>
                    <div className="flex-grow flex items-center justify-center text-tertiary">
                        <p>{t('challenge.selectedGame', { name: selectedGameDefinition?.name ?? '' })}</p>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        <Button onClick={onClose} colorScheme="gray">{tCommon('actions.cancel')}</Button>
                        <Button onClick={handleChallenge} colorScheme="blue" disabled={isGameModeRejected}>{t('challenge.apply')}</Button>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default ChallengeApplicationModal;
