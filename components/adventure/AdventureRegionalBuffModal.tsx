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
            title={`${stage.title} · 지역 효과슬롯`}
            onClose={onClose}
            windowId={`adventure-regional-buff-${stageId}`}
            initialWidth={480}
            initialHeight={620}
            isTopmost={isTopmost}
            variant="store"
        >
            <div className="min-h-0 overflow-y-auto overscroll-contain p-1 sm:p-1.5">
                <AdventureRegionalBuffPanel
                    profile={profile}
                    stageRows={stageRows}
                    userGold={userGold}
                    singleStageId={stageId}
                />
            </div>
        </DraggableWindow>
    );
};

export default AdventureRegionalBuffModal;
