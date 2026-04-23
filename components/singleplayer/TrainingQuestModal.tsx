import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import { UserWithStatus } from '../../types.js';
import TrainingQuestPanel from './TrainingQuestPanel.js';

interface TrainingQuestModalProps {
    open: boolean;
    onClose: () => void;
    currentUser: UserWithStatus;
}

const TrainingQuestModal: React.FC<TrainingQuestModalProps> = ({ open, onClose, currentUser }) => {
    if (!open) return null;

    return (
        <DraggableWindow
            title="수련과제"
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
            <div className="flex min-h-0 w-full min-w-0 flex-col bg-gradient-to-b from-zinc-950/80 via-black/30 to-emerald-950/20">
                <div
                    className="box-border flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden px-1.5 pb-1 pt-0.5 sm:px-2 sm:pb-1.5 sm:pt-1"
                    role="region"
                    aria-label="수련 과제 목록"
                >
                    <div className="flex h-full min-h-0 w-full max-w-full flex-col">
                        <TrainingQuestPanel currentUser={currentUser} embeddedInModal />
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default TrainingQuestModal;
