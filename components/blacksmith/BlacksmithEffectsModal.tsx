import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import BlacksmithLevelEffectsSummary from './BlacksmithLevelEffectsSummary.js';
import { User } from '../../types.js';
import { getMannerEffects } from '../../services/effectService.js';
import { isFunctionVipActive } from '../../shared/utils/rewardVip.js';

interface BlacksmithEffectsModalProps {
    onClose: () => void;
    isTopmost?: boolean;
    blacksmithLevel: number;
    currentUser: User;
}

const BlacksmithEffectsModal: React.FC<BlacksmithEffectsModalProps> = ({ onClose, isTopmost, blacksmithLevel, currentUser }) => {
    const mannerEffects = getMannerEffects(currentUser);
    const vipBonus = isFunctionVipActive(currentUser) ? 10 : 0;
    const disassemblyJackpotBonusPercent = (mannerEffects.disassemblyJackpotBonusPercent ?? 0) + vipBonus;
    const combinationGreatSuccessBonusPercent = vipBonus;

    return (
        <DraggableWindow
            title="대장간 효과"
            onClose={onClose}
            windowId="blacksmith-effects"
            initialWidth={420}
            initialHeight={520}
            isTopmost={isTopmost}
            variant="store"
        >
            <div className="max-h-[min(72dvh,560px)] overflow-y-auto pr-2">
                <BlacksmithLevelEffectsSummary
                    blacksmithLevel={blacksmithLevel}
                    disassemblyJackpotBonusPercent={disassemblyJackpotBonusPercent}
                    combinationGreatSuccessBonusPercent={combinationGreatSuccessBonusPercent}
                />
            </div>
        </DraggableWindow>
    );
};

export default BlacksmithEffectsModal;
