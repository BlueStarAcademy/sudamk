import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../hooks/useAppContext.js';
import { SPECIAL_GAME_MODES, filterPlayableLobbyGameModes } from '../../constants.js';
import { useLocalizedLobbyGameModes } from '../../shared/i18n/localizedCatalog.js';
import { getEquippedPairPetInventoryRow } from '../../shared/utils/pairEquippedPet.js';
import { GameMode, type ServerAction } from '../../types.js';
import AiChallengeModal from '../waiting-room/AiChallengeModal.js';

type MachineFormat = '1v1' | 'pair';

const TrainingGroundAiPanel: React.FC = () => {
    const { t } = useTranslation('profile');
    const { currentUserWithStatus, handlers } = useAppContext();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [format, setFormat] = useState<MachineFormat>('1v1');
    const [selectedMode, setSelectedMode] = useState<GameMode>(GameMode.Standard);

    const playable = useMemo(() => filterPlayableLobbyGameModes(SPECIAL_GAME_MODES), []);
    const localized = useLocalizedLobbyGameModes(playable);
    const hasPet = Boolean(currentUserWithStatus && getEquippedPairPetInventoryRow(currentUserWithStatus));

    const onAction = (action: ServerAction) => {
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
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-2 sm:p-3">
            <div className="flex gap-1 rounded-lg border border-amber-900/40 bg-black/35 p-1 text-[11px] font-black text-amber-100/80">
                <span className={step === 1 ? 'rounded bg-amber-400 px-2 py-1 text-stone-950' : 'px-2 py-1'}>1. {t('trainingGroundUi.stepMode')}</span>
                <span className={step === 2 ? 'rounded bg-amber-400 px-2 py-1 text-stone-950' : 'px-2 py-1'}>2. {t('trainingGroundUi.gameKind')}</span>
                <span className={step === 3 ? 'rounded bg-amber-400 px-2 py-1 text-stone-950' : 'px-2 py-1'}>3. {t('trainingGroundUi.matchOptions')}</span>
            </div>

            {step === 1 && (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setFormat('1v1');
                            setStep(2);
                        }}
                        className="rounded-xl border border-amber-700/50 bg-gradient-to-br from-amber-950/80 to-stone-950 px-3 py-8 text-center text-lg font-black text-amber-50 shadow-lg"
                    >
                        {t('trainingGroundUi.mode1v1')}
                    </button>
                    <button
                        type="button"
                        disabled={!hasPet}
                        onClick={() => {
                            if (!hasPet) return;
                            setFormat('pair');
                            setStep(2);
                        }}
                        className="rounded-xl border border-violet-700/50 bg-gradient-to-br from-violet-950/80 to-stone-950 px-3 py-8 text-center text-lg font-black text-violet-50 shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {t('trainingGroundUi.modePair')}
                        {!hasPet && (
                            <span className="mt-2 block text-[11px] font-semibold text-rose-200">
                                {t('trainingGroundUi.needEquippedPet')}
                            </span>
                        )}
                    </button>
                </div>
            )}

            {step === 2 && (
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="mb-2 text-[11px] font-bold text-amber-200/80"
                    >
                        ← {t('trainingGroundUi.back')}
                    </button>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {localized.map((mode) => (
                            <button
                                key={mode.mode}
                                type="button"
                                onClick={() => {
                                    setSelectedMode(mode.mode);
                                    setStep(3);
                                }}
                                className="overflow-hidden rounded-xl border border-amber-900/40 bg-black/40 text-left shadow-md"
                            >
                                <img src={mode.image} alt="" className="h-16 w-full object-cover" />
                                <p className="px-2 py-1.5 text-[12px] font-black text-amber-50">{mode.name}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="mb-2 shrink-0 text-[11px] font-bold text-amber-200/80"
                    >
                        ← {t('trainingGroundUi.back')}
                    </button>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <AiChallengeModal
                            lobbyType="strategic"
                            onClose={() => setStep(2)}
                            onAction={onAction}
                            startActionType={format === 'pair' ? 'PAIR_START_AI_MATCH' : 'START_AI_GAME'}
                            transformSettingsBeforeStart={
                                format === '1v1'
                                    ? (_mode, settings) => ({ ...settings, friendlyLobbyMatch: true })
                                    : undefined
                            }
                            embeddedPanel
                            embeddedPanelStackedLayout
                            hideInlineModePicker
                            controlledSelectedGameMode={selectedMode}
                            onControlledSelectedGameModeChange={setSelectedMode}
                            preferredGameSettingsBucket={
                                format === 'pair' ? 'friendly_ai_friendly_2p' : 'strategic_ai_challenge'
                            }
                            hideScoringTurnLimit={format === 'pair'}
                            title={t('trainingGroundUi.trainingMachine')}
                            submitLabel={t('trainingGroundUi.startNow')}
                            showActionPointCost
                            submitDisabled={format === 'pair' && !hasPet}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrainingGroundAiPanel;
