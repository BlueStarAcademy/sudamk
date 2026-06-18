import React from 'react';
import { useTranslation } from 'react-i18next';
import { SinglePlayerMissionInfo, SinglePlayerMissionLevelInfo } from '../../types.js';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { PREMIUM_QUEST_BTN } from './trainingQuestPremiumButtons.js';

interface TrainingQuestStartInfoModalProps {
    mission: SinglePlayerMissionInfo;
    levelInfo: SinglePlayerMissionLevelInfo;
    onClose: () => void;
    onConfirmStart: () => void;
}

const TrainingQuestStartInfoModal: React.FC<TrainingQuestStartInfoModalProps> = ({
    mission,
    levelInfo,
    onClose,
    onConfirmStart,
}) => {
    const { t } = useTranslation(['lobby', 'common']);
    const missionMessage =
        t(`singleplayer.startMessages.${mission.id}`, {
            defaultValue: t('singleplayer.startMessageDefault'),
        });
    const rewardIcon = mission.rewardType === 'gold' ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp';
    const rewardAlt =
        mission.rewardType === 'gold' ? t('common:resources.gold') : t('common:resources.diamonds');

    return (
        <DraggableWindow
            title={t('singleplayer.startMissionTitle', { missionName: mission.name })}
            onClose={onClose}
            windowId={`training-quest-start-info-${mission.id}`}
            initialWidth={460}
            shrinkHeightToContent
            isTopmost
            modal
            closeOnOutsideClick
            mobileViewportFit
        >
            <div className="flex flex-col gap-2.5 rounded-xl bg-[#0a0e14] p-3 text-slate-100 ring-1 ring-inset ring-white/[0.08] sm:gap-3 sm:p-4">
                <div className="rounded-xl border border-slate-700/70 bg-[#070a10] p-2.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.55)] sm:p-3">
                    <p className="text-xs leading-relaxed text-slate-100 sm:text-sm">{missionMessage}</p>
                </div>

                <div className="rounded-xl border border-slate-700/60 bg-slate-900/55 p-2.5 sm:p-3">
                    <div className="mb-2 flex items-center gap-2 border-b border-white/[0.08] pb-2">
                        <img
                            src={mission.image}
                            alt={mission.name}
                            className="h-9 w-9 rounded-lg bg-black/40 object-cover sm:h-10 sm:w-10"
                        />
                        <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-100 sm:text-sm">{mission.name}</p>
                            <p className="text-[0.65rem] text-slate-400 sm:text-xs">{t('singleplayer.initialProductionInfo')}</p>
                        </div>
                    </div>

                    <div className="space-y-1.5 text-xs sm:text-sm">
                        <div className="flex items-center justify-between rounded-md border border-white/[0.08] bg-black/25 px-2 py-1.5">
                            <span className="text-slate-400">{t('singleplayer.production')}</span>
                            <span className="font-semibold tabular-nums text-slate-100">
                                {t('singleplayer.productionRateMinutes', { minutes: levelInfo.productionRateMinutes })}
                            </span>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-white/[0.08] bg-black/25 px-2 py-1.5">
                            <span className="text-slate-400">{t('singleplayer.productionAmount')}</span>
                            <span className="flex items-center gap-1 font-semibold tabular-nums text-slate-100">
                                <span>{levelInfo.rewardAmount.toLocaleString()}</span>
                                <img src={rewardIcon} alt={rewardAlt} className="h-3.5 w-3.5 object-contain sm:h-4 sm:w-4" />
                            </span>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-white/[0.08] bg-black/25 px-2 py-1.5">
                            <span className="text-slate-400">{t('singleplayer.storage')}</span>
                            <span className="font-semibold tabular-nums text-slate-100">{levelInfo.maxCapacity.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-0.5 flex min-w-0 flex-row items-stretch gap-2">
                    <Button
                        onClick={onClose}
                        colorScheme="none"
                        className="min-w-0 flex-1 rounded-lg border border-slate-500/50 bg-slate-800/85 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700/85 sm:py-2 sm:text-sm"
                    >
                        {t('common:actions.close')}
                    </Button>
                    <Button
                        onClick={onConfirmStart}
                        colorScheme="none"
                        className={`${PREMIUM_QUEST_BTN.start} !min-w-0 !flex-1 !py-1.5 !text-xs sm:!py-2 sm:!text-sm`}
                    >
                        {t('singleplayer.start')}
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default TrainingQuestStartInfoModal;
