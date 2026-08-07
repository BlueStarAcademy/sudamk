import React from 'react';
import { useTranslation } from 'react-i18next';

type Phase = 'pressHint' | 'placeHint' | null;

type Props = {
    phase: Phase;
    onSkip?: () => void;
};

/** 모험 대국 중 펫 힌트 튜토리얼 코치 배너 */
const PetHintTutorialCoach: React.FC<Props> = ({ phase, onSkip }) => {
    const { t } = useTranslation('game');
    if (!phase) return null;

    const message =
        phase === 'pressHint' ? t('controls.petHintTutorialPress') : t('controls.petHintTutorialPlace');

    return (
        <div className="pointer-events-auto absolute left-1/2 top-2 z-[60] w-[min(92vw,22rem)] -translate-x-1/2 rounded-lg border border-sky-400/50 bg-slate-950/90 px-3 py-2 shadow-lg">
            <p className="text-center text-xs font-semibold leading-snug text-sky-100 sm:text-sm">{message}</p>
            {onSkip ? (
                <button
                    type="button"
                    onClick={onSkip}
                    className="mt-1.5 w-full text-center text-[10px] text-slate-400 underline hover:text-slate-200"
                >
                    {t('controls.petHintTutorialSkip')}
                </button>
            ) : null}
        </div>
    );
};

export default PetHintTutorialCoach;
