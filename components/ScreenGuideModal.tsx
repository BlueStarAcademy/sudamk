import React from 'react';
import type { ScreenGuideId } from '../utils/screenGuideDismiss.js';
import { SCREEN_GUIDE_HELP_CONFIG } from '../shared/constants/screenGuideHelpSelection.js';
import GuideModal from './GuideModal.js';

export type ScreenGuideModalProps = {
    guideId: ScreenGuideId;
    onClose: () => void;
    onDismissForever: () => void;
    isTopmost?: boolean;
};

const ScreenGuideModal: React.FC<ScreenGuideModalProps> = ({
    guideId,
    onClose,
    onDismissForever,
    isTopmost,
}) => {
    const config = SCREEN_GUIDE_HELP_CONFIG[guideId];
    return (
        <GuideModal
            title={config.modalTitle}
            windowId={`screen-guide-${guideId}`}
            onClose={onClose}
            isTopmost={isTopmost}
            initialSelection={{ categoryId: config.categoryId, subId: config.subId }}
            categoryFilter={config.categoryFilter}
            showDismissForever
            onDismissForever={onDismissForever}
        />
    );
};

export default ScreenGuideModal;
