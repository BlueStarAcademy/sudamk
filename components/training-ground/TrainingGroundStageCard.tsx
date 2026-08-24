import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    TRAINING_GROUND_LOCK_IMG,
    rewardForKataLevel,
    trainingGroundBandImageForKata,
    trainingGroundStageNumber,
    type TrainingGroundBoardSize,
} from '../../shared/constants/trainingGround.js';

type TrainingGroundStageCardProps = {
    kataLevel: number;
    unlocked: boolean;
    abilityUnlocked: boolean;
    sequentialUnlocked: boolean;
    selected: boolean;
    cleared: boolean;
    boardSize: TrainingGroundBoardSize;
    unlockAbility: number;
    showKataUserXp?: boolean;
    showPetXp?: boolean;
    onSelect: () => void;
};

const GOLD_ICON = '/images/icon/Gold.webp';
const ZEM_ICON = '/images/icon/Zem.webp';

const TrainingGroundStageCard: React.FC<TrainingGroundStageCardProps> = ({
    kataLevel,
    unlocked,
    abilityUnlocked,
    sequentialUnlocked,
    selected,
    cleared,
    boardSize,
    unlockAbility,
    showKataUserXp = false,
    showPetXp = false,
    onSelect,
}) => {
    const { t } = useTranslation('profile');
    const reward = rewardForKataLevel(kataLevel, boardSize);
    const stageNumber = trainingGroundStageNumber(kataLevel);
    const showSequentialMarker = stageNumber > 1;
    const markerBase =
        'inline-flex max-w-[48%] shrink-0 items-center truncate rounded-md border px-1 py-0.5 text-[9px] font-bold leading-none sm:max-w-none sm:text-[10px]';
    const markerMet = 'border-emerald-500/40 bg-emerald-950/55 text-emerald-100';
    const markerUnmet = 'border-rose-500/45 bg-rose-950/55 text-rose-100';
    const markerNeutral = 'border-amber-500/35 bg-black/45 text-amber-100/90';

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
                className={`absolute inset-0 h-full w-full object-cover ${
                    unlocked ? '' : 'grayscale brightness-[0.6]'
                }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
            {!unlocked && (
                <img
                    src={TRAINING_GROUND_LOCK_IMG}
                    alt=""
                    className="absolute left-1/2 top-[42%] z-[2] h-14 w-14 -translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-lg"
                />
            )}
            <div className="absolute inset-x-0 top-0 z-[2] flex items-start justify-between p-2">
                <span
                    className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border-2 border-amber-300/75 bg-black/60 px-1.5 text-[11px] font-black tabular-nums text-amber-100 shadow-md"
                    title={t('trainingGroundUi.stageMarkerTitle')}
                >
                    {stageNumber}
                </span>
                {cleared && (
                    <span className="rounded-md bg-emerald-700/80 px-1.5 py-0.5 text-[10px] font-bold text-emerald-50">
                        {t('trainingGroundUi.cleared')}
                    </span>
                )}
            </div>
            <div className="absolute inset-x-0 bottom-0 z-[2] space-y-1 p-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-amber-50">
                    <span className="inline-flex items-center gap-0.5">
                        <img src={GOLD_ICON} alt="" className="h-3.5 w-3.5 object-contain" />
                        {reward.gold.toLocaleString()}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                        <img src={ZEM_ICON} alt="" className="h-3.5 w-3.5 object-contain" />
                        {reward.diamonds.toLocaleString()}
                    </span>
                    {showKataUserXp && reward.kataUserXp > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-sky-200">
                            {t('trainingGroundUi.expLabel')} +{reward.kataUserXp.toLocaleString()}
                        </span>
                    ) : null}
                    {showPetXp && reward.petXp > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-violet-200">
                            {t('trainingGroundUi.petExpLabel')} +{reward.petXp.toLocaleString()}
                        </span>
                    ) : null}
                </div>
                <div className="flex flex-nowrap items-center gap-1 overflow-hidden">
                    {showSequentialMarker ? (
                        <span
                            className={`${markerBase} ${
                                sequentialUnlocked ? (unlocked ? markerNeutral : markerMet) : markerUnmet
                            }`}
                            title={t('trainingGroundUi.unlockPreviousStage')}
                        >
                            {t('trainingGroundUi.unlockPreviousStageMarker')}
                        </span>
                    ) : null}
                    <span
                        className={`${markerBase} ${
                            abilityUnlocked ? (unlocked ? markerNeutral : markerMet) : markerUnmet
                        }`}
                        title={t('trainingGroundUi.unlockAbilityMin', { n: unlockAbility.toLocaleString() })}
                    >
                        {t('trainingGroundUi.unlockAbilityMarker', { n: unlockAbility.toLocaleString() })}
                    </span>
                </div>
            </div>
        </button>
    );
};

export default TrainingGroundStageCard;
