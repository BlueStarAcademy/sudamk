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
        <div className="flex min-h-0 w-full min-w-0 flex-col bg-gradient-to-b from-zinc-950/80 via-black/30 to-emerald-950/20">
            <div
                className="box-border flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden px-1 pb-0.5 pt-0 sm:px-1.5 sm:pb-1 sm:pt-0.5"
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
                initialWidth={860}
                shrinkHeightToContent
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
