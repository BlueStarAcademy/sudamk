import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../hooks/useAppContext.js';
import {
    countOwnedPairPets,
    resolvePairPetOnboardingStep,
} from '../../shared/utils/pairPetOnboarding.js';

/** 홈 growth 영역 위: 다음 펫 온보딩 목표 한 줄 */
const PetOnboardingHomeBanner: React.FC = () => {
    const { t } = useTranslation('lobby');
    const { currentUserWithStatus, handlers } = useAppContext();
    const step = useMemo(
        () => (currentUserWithStatus ? resolvePairPetOnboardingStep(currentUserWithStatus) : 'done'),
        [currentUserWithStatus],
    );
    const petCount = currentUserWithStatus ? countOwnedPairPets(currentUserWithStatus) : 0;

    if (!currentUserWithStatus || step === 'done') return null;

    let body = '';
    let cta = '';
    let onCta: (() => void) | null = null;

    if (step === 'equip') {
        body = t('petOnboarding.equipBody');
        cta = t('petOnboarding.openPet');
        onCta = () => handlers.openPetManagementModal?.({ modal: true });
    } else if (step === 'petHint') {
        body = t('petOnboarding.hintBody');
        cta = t('petOnboarding.openAcademy');
        onCta = () => handlers.openSinglePlayerLobby?.();
    } else if (step === 'training') {
        body = petCount < 2 ? t('petOnboarding.hatchSecondBody') : t('petOnboarding.trainingBody');
        cta = t('petOnboarding.openPet');
        onCta = () => handlers.openPetManagementModal?.({ modal: true });
    }

    if (!body) return null;

    return (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-50">
            <p className="min-w-0 flex-1 leading-snug">{body}</p>
            {onCta ? (
                <button
                    type="button"
                    onClick={onCta}
                    className="shrink-0 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-bold text-emerald-950 hover:bg-emerald-400"
                >
                    {cta}
                </button>
            ) : null}
        </div>
    );
};

export default PetOnboardingHomeBanner;
