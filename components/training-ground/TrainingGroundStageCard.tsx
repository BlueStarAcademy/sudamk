import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    TRAINING_GROUND_LOCK_IMG,
    rewardForKataLevel,
    trainingGroundBandImageForKata,
    type TrainingGroundBoardSize,
} from '../../shared/constants/trainingGround.js';

type TrainingGroundStageCardProps = {
    kataLevel: number;
    unlocked: boolean;
    selected: boolean;
    cleared: boolean;
    boardSize: TrainingGroundBoardSize;
    unlockAbility: number;
    onSelect: () => void;
};

const GOLD_ICON = '/images/icon/Gold.webp';
const ZEM_ICON = '/images/icon/Zem.webp';

const TrainingGroundStageCard: React.FC<TrainingGroundStageCardProps> = ({
    kataLevel,
    unlocked,
    selected,
    cleared,
    boardSize,
    unlockAbility,
    onSelect,
}) => {
    const { t } = useTranslation('profile');
    const reward = rewardForKataLevel(kataLevel, boardSize);
    const kataLabel = kataLevel > 0 ? `+${kataLevel}` : String(kataLevel);

    return (
        <button
            type="button"
            onClick={onSelect}
            className={`relative aspect-[16/10] w-full overflow-hidden rounded-xl border text-left shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition ${
                selected
                    ? 'border-amber-300 ring-2 ring-amber-300/80'
                    : unlocked
                      ? 'border-amber-900/55 hover:border-amber-400/70'
                      : 'border-stone-800/80'
            }`}
        >
            <img
                src={trainingGroundBandImageForKata(kataLevel)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
            />
            <div
                className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10 ${
                    unlocked ? '' : 'grayscale-[0.4]'
                }`}
            />
            {!unlocked && (
                <img
                    src={TRAINING_GROUND_LOCK_IMG}
                    alt=""
                    className="absolute left-1/2 top-[42%] z-[2] h-14 w-14 -translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-lg"
                />
            )}
            <div className="absolute inset-x-0 top-0 z-[2] flex items-start justify-between p-2">
                <span className="rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-black tracking-wide text-amber-100">
                    Kata {kataLabel}
                </span>
                {cleared && (
                    <span className="rounded-md bg-emerald-700/80 px-1.5 py-0.5 text-[10px] font-bold text-emerald-50">
                        {t('trainingGroundUi.cleared')}
                    </span>
                )}
            </div>
            <div className="absolute inset-x-0 bottom-0 z-[2] space-y-1 p-2">
                <div className="flex items-center gap-2 text-[11px] font-bold text-amber-50">
                    <span className="inline-flex items-center gap-0.5">
                        <img src={GOLD_ICON} alt="" className="h-3.5 w-3.5 object-contain" />
                        {reward.gold.toLocaleString()}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                        <img src={ZEM_ICON} alt="" className="h-3.5 w-3.5 object-contain" />
                        {reward.diamonds.toLocaleString()}
                    </span>
                </div>
                <p className={`text-[10px] font-semibold ${unlocked ? 'text-amber-100/85' : 'text-rose-200/90'}`}>
                    {t('trainingGroundUi.unlockAbilityMin', { n: unlockAbility })}
                </p>
            </div>
        </button>
    );
};

export default TrainingGroundStageCard;
