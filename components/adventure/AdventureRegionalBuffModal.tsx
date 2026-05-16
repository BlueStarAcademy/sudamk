import React, { useMemo } from 'react';
import DraggableWindow from '../DraggableWindow.js';
import { ADVENTURE_STAGES } from '../../constants/adventureConstants.js';
import type { AdventureProfile } from '../../types/entities.js';
import { buildAdventureStageUnderstandingRows } from '../../utils/adventureStageUnderstandingRows.js';
import AdventureRegionalBuffPanel from './AdventureRegionalBuffPanel.js';

const AdventureRegionalBuffModal: React.FC<{
    stageId: string;
    profile: AdventureProfile | null | undefined;
    userGold?: number;
    onClose: () => void;
    isTopmost?: boolean;
}> = ({ stageId, profile, userGold = 0, onClose, isTopmost }) => {
    const stage = ADVENTURE_STAGES.find((s) => s.id === stageId);
    const stageRows = useMemo(() => buildAdventureStageUnderstandingRows(profile), [profile]);

    if (!stage) return null;

    return (
        <DraggableWindow
            title={`${stage.title} · 지역 효과`}
            onClose={onClose}
            windowId={`adventure-regional-buff-${stageId}`}
            initialWidth={600}
            shrinkHeightToContent
            isTopmost={isTopmost}
            variant="store"
            bodyNoScroll
        >
            <div className="p-2">
                <AdventureRegionalBuffPanel
                    profile={profile}
                    stageRows={stageRows}
                    userGold={userGold}
                    singleStageId={stageId}
                    embeddedInModal
                />
            </div>
        </DraggableWindow>
    );
};

export default AdventureRegionalBuffModal;
