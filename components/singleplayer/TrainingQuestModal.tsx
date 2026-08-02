import React from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from '../DraggableWindow.js';
import { UserWithStatus } from '../../types.js';
import TrainingQuestPanel from './TrainingQuestPanel.js';
import { useScreenGuide } from '../../hooks/useScreenGuide.js';
import ScreenGuideModal from '../ScreenGuideModal.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../../shared/constants/pcShellLayout.js';

interface TrainingQuestModalProps {
    open?: boolean;
    onClose: () => void;
    currentUser: UserWithStatus;
    /** PC 로비 중앙 인라인 패널 — DraggableWindow 생략 */
    embedded?: boolean;
}

const TrainingQuestModal: React.FC<TrainingQuestModalProps> = ({
    open = true,
    onClose,
    currentUser,
    embedded = false,
}) => {
    const { t } = useTranslation('lobby');
    const trainingGuide = useScreenGuide('trainingQuest', { active: embedded || open });

    const questBody = (
        <div className="relative flex min-h-0 w-full min-w-0 flex-col overflow-hidden bg-gradient-to-b from-[#1c1812] via-[#0b0d12] to-black">
            <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_-10%,rgba(251,191,36,0.14),transparent_55%),radial-gradient(60%_40%_at_90%_20%,rgba(16,185,129,0.1),transparent_50%)]"
                aria-hidden
            />
            <div
                className="relative box-border flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden px-2 pb-1.5 pt-1 sm:px-3 sm:pb-2 sm:pt-1.5"
                role="region"
                aria-label={t('singleplayer.trainingQuestListAria')}
            >
                <div className="flex h-full min-h-0 w-full max-w-full flex-col">
                    <TrainingQuestPanel currentUser={currentUser} embeddedInModal />
                </div>
            </div>
        </div>
    );

    const guideNode =
        trainingGuide.isOpen ? (
            <ScreenGuideModal
                guideId="trainingQuest"
                onClose={trainingGuide.close}
                onDismissForever={trainingGuide.dismissForever}
            />
        ) : null;

    if (embedded) {
        return (
            <>
                <div className={PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS}>{questBody}</div>
                {guideNode}
            </>
        );
    }

    if (!open) return null;

    return (
        <>
            <DraggableWindow
                title={t('singleplayer.trainingQuestModalTitle')}
                windowId="training-quest-modal"
                onClose={onClose}
                initialWidth={980}
                initialHeight={820}
                modal
                closeOnOutsideClick
                mobileViewportFit
                bodyScrollable={false}
                hideFooter
            >
                {questBody}
            </DraggableWindow>
            {guideNode}
        </>
    );
};

export default TrainingQuestModal;
