import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    rewardForKataLevel,
    type TrainingGroundBoardSize,
    type TrainingGroundTrack,
} from '../../shared/constants/trainingGround.js';

type TrainingGroundRewardPanelProps = {
    track: TrainingGroundTrack;
    kataLevel: number;
    boardSize: TrainingGroundBoardSize;
};

const GOLD_ICON = '/images/icon/Gold.webp';
const ZEM_ICON = '/images/icon/Zem.webp';

const TrainingGroundRewardPanel: React.FC<TrainingGroundRewardPanelProps> = ({
    track,
    kataLevel,
    boardSize,
}) => {
    const { t } = useTranslation('profile');
    const reward = rewardForKataLevel(kataLevel, boardSize);

    return (
        <div className="flex h-full w-full min-w-0 shrink-0 flex-col gap-1.5 rounded-lg border border-amber-800/45 bg-gradient-to-b from-amber-950/40 to-black/50 px-2 py-2 sm:w-[8.25rem] sm:px-2">
            <p className="text-[10px] font-extrabold tracking-wide text-amber-200/85 sm:text-[11px]">
                {t('trainingGroundUi.rewardPanelTitle')}
            </p>
            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1 text-[11px] font-black text-amber-50 sm:text-xs">
                    <span className="inline-flex min-w-0 items-center gap-1">
                        <img src={GOLD_ICON} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                        <span className="truncate">{reward.gold.toLocaleString()}</span>
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1">
                        <img src={ZEM_ICON} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                        <span className="truncate">{reward.diamonds.toLocaleString()}</span>
                    </span>
                </div>
                {track === 'kata' && reward.kataUserXp > 0 ? (
                    <div className="flex items-center justify-between gap-1 rounded-md bg-sky-950/45 px-1.5 py-1 text-[10px] font-bold sm:text-[11px]">
                        <span className="text-sky-300/90">{t('trainingGroundUi.expLabel')}</span>
                        <span className="tabular-nums text-sky-100">+{reward.kataUserXp.toLocaleString()}</span>
                    </div>
                ) : null}
                {track === 'pet' && reward.petXp > 0 ? (
                    <div className="flex items-center justify-between gap-1 rounded-md bg-violet-950/45 px-1.5 py-1 text-[10px] font-bold sm:text-[11px]">
                        <span className="text-violet-300/90">{t('trainingGroundUi.petExpLabel')}</span>
                        <span className="tabular-nums text-violet-100">+{reward.petXp.toLocaleString()}</span>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default TrainingGroundRewardPanel;
