import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../hooks/useAppContext.js';
import { getEquippedPairPetInventoryRow } from '../../shared/utils/pairEquippedPet.js';
import type { ServerAction } from '../../types.js';
import AiChallengeModal from '../waiting-room/AiChallengeModal.js';
import type { StrategicAiMatchFormat } from '../waiting-room/AiLobbyInlineWorkspace.js';
import LobbyMatchKindPicker, { type LobbyMatchKindOption } from '../waiting-room/LobbyMatchKindPicker.js';
import AlertModal from '../AlertModal.js';

const aiChallengeModalShellClass =
    'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/20 shadow-inner ring-1 ring-white/[0.06]';

const TrainingGroundAiPanel: React.FC = () => {
    const { t } = useTranslation('profile');
    const { t: tLobby } = useTranslation('lobby');
    const { currentUserWithStatus, handlers } = useAppContext();
    const [matchFormat, setMatchFormat] = useState<StrategicAiMatchFormat>('one_vs_one');
    const [alertMessage, setAlertMessage] = useState<string | null>(null);

    const hasPet = Boolean(currentUserWithStatus && getEquippedPairPetInventoryRow(currentUserWithStatus));
    const isPairFormat = matchFormat === 'pair';

    useEffect(() => {
        if (!hasPet && matchFormat === 'pair') {
            setMatchFormat('one_vs_one');
        }
    }, [hasPet, matchFormat]);

    const onAction = useCallback(
        (action: ServerAction) => {
            if (isPairFormat && !hasPet) {
                setAlertMessage(tLobby('aiChallengeModal.pairAiPetRequired'));
                return;
            }
            if (action.type === 'PAIR_START_AI_MATCH') {
                const payload =
                    'payload' in action && action.payload && typeof action.payload === 'object' ? action.payload : {};
                return handlers.handleAction({
                    ...action,
                    payload: {
                        ...payload,
                        ephemeralRoomKind: 'friendly_2p',
                        lobbyChannel: 'friendly',
                    },
                } as ServerAction);
            }
            return handlers.handleAction(action);
        },
        [handlers, hasPet, isPairFormat, tLobby],
    );

    const formatOptions: LobbyMatchKindOption<StrategicAiMatchFormat>[] = [
        { value: 'one_vs_one', label: tLobby('aiChallengeModal.oneVsOneTab'), tone: 'amber' },
        {
            value: 'pair',
            label: tLobby('aiChallengeModal.pairTab'),
            tone: 'amber',
            disabled: !hasPet,
        },
    ];

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden p-0.5 sm:p-1">
            <div className="shrink-0 px-0.5 sm:px-1">
                <p className="mb-1 text-[10px] font-extrabold tracking-wide text-amber-100/80 sm:text-[11px]">
                    {tLobby('aiChallengeModal.gameKindTitle')}
                </p>
                <LobbyMatchKindPicker
                    layout="row"
                    ariaLabel={tLobby('aiChallengeModal.matchFormatAria')}
                    options={formatOptions}
                    value={matchFormat}
                    onChange={setMatchFormat}
                    defaultTone="amber"
                />
                {isPairFormat && !hasPet ? (
                    <p className="mt-1 text-[10px] font-semibold text-rose-200/90 sm:text-[11px]">
                        {t('trainingGroundUi.needEquippedPet')}
                    </p>
                ) : null}
            </div>

            <div className={`${aiChallengeModalShellClass} min-w-0 flex-1`}>
                <AiChallengeModal
                    key={`training-ai-${matchFormat}`}
                    embeddedPanel
                    embeddedPanelStackedLayout
                    embeddedPanelMobileFlatLayout
                    embeddedPanelFillParent
                    pairRoomDenseSettingsGrid
                    lobbyType="strategic"
                    preferredGameSettingsBucket={
                        isPairFormat ? 'friendly_ai_friendly_2p' : 'strategic_ai_challenge'
                    }
                    onClose={() => {}}
                    onAction={onAction}
                    startActionType={isPairFormat ? 'PAIR_START_AI_MATCH' : 'START_AI_GAME'}
                    transformSettingsBeforeStart={
                        isPairFormat
                            ? undefined
                            : (_mode, settings) => ({ ...settings, friendlyLobbyMatch: true })
                    }
                    hideScoringTurnLimit={isPairFormat}
                    title={t('trainingGroundUi.trainingMachine')}
                    submitLabel={t('trainingGroundUi.startNow')}
                    showActionPointCost
                    submitDisabled={isPairFormat && !hasPet}
                />
            </div>
            {alertMessage ? (
                <AlertModal
                    message={alertMessage}
                    onClose={() => setAlertMessage(null)}
                    windowId="training-ground-ai-alert"
                />
            ) : null}
        </div>
    );
};

export default TrainingGroundAiPanel;
