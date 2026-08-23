import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../hooks/useAppContext.js';
import { TRAINING_GROUND_LOBBY_IMG, TRAINING_GROUND_TAB_STORAGE_KEY } from '../../shared/constants/trainingGround.js';

const TrainingGroundWaitingRoomCta: React.FC<{ compact?: boolean }> = ({ compact }) => {
    const { t } = useTranslation('profile');
    const { handlers } = useAppContext();

    const openMachine = () => {
        try {
            sessionStorage.setItem(TRAINING_GROUND_TAB_STORAGE_KEY, 'ai');
        } catch {
            /* ignore quota */
        }
        handlers.openTrainingGround();
    };

    return (
        <button
            type="button"
            onClick={openMachine}
            className={`relative w-full overflow-hidden rounded-xl border border-amber-800/60 text-left shadow-lg ${
                compact ? 'min-h-[7.5rem]' : 'min-h-[10rem]'
            }`}
        >
            <img src={TRAINING_GROUND_LOBBY_IMG} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />
            <div className="relative z-[1] flex h-full flex-col justify-end gap-1 p-3">
                <p className="text-sm font-black tracking-tight text-amber-50">{t('trainingGroundUi.trainingMachine')}</p>
                <p className="text-[11px] font-semibold leading-snug text-amber-100/85">
                    {t('trainingGroundUi.waitingRoomHint')}
                </p>
                <span className="mt-1 inline-flex w-fit rounded-md bg-amber-400 px-2 py-1 text-[11px] font-black text-stone-950">
                    {t('trainingGroundUi.waitingRoomCta')}
                </span>
            </div>
        </button>
    );
};

export default TrainingGroundWaitingRoomCta;
