import React, { useEffect, useState } from 'react';
import DraggableWindow from '../DraggableWindow.js';
import BlacksmithLevelEffectsSummary from './BlacksmithLevelEffectsSummary.js';
import { User } from '../../types.js';
import { isFunctionVipActive } from '../../shared/utils/rewardVip.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';

interface BlacksmithEffectsModalProps {
    onClose: () => void;
    isTopmost?: boolean;
    blacksmithLevel: number;
    currentUser: User;
}

const BlacksmithEffectsModal: React.FC<BlacksmithEffectsModalProps> = ({ onClose, isTopmost, blacksmithLevel, currentUser }) => {
    const { isNativeMobile } = useNativeMobileShell();
    const [viewportCompact, setViewportCompact] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < 1025
    );
    useEffect(() => {
        const onResize = () => setViewportCompact(window.innerWidth < 1025);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    /** BlacksmithModal 스택 레이아웃과 동일 기준: 모바일·좁은 가로에서 타이포 통일 */
    const compactLayout = viewportCompact || isNativeMobile;

    const vipBonus = isFunctionVipActive(currentUser) ? 10 : 0;
    const disassemblyJackpotBonusPercent = vipBonus;
    const combinationGreatSuccessBonusPercent = vipBonus;

    return (
        <DraggableWindow
            title="대장간 효과"
            onClose={onClose}
            windowId="blacksmith-effects"
            initialWidth={compactLayout ? 380 : 420}
            initialHeight={compactLayout ? 560 : 520}
            isTopmost={isTopmost}
            variant="store"
            mobileViewportFit={compactLayout}
            mobileViewportMaxHeightVh={compactLayout ? 92 : undefined}
            mobileViewportMaxHeightCss={compactLayout ? 'min(94dvh, calc(100dvh - 12px))' : undefined}
            bodyPaddingClassName={
                compactLayout
                    ? '!px-2.5 !pt-2 !pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]'
                    : undefined
            }
        >
            <div
                className={
                    compactLayout
                        ? 'max-h-[min(86dvh,640px)] overflow-y-auto pr-1.5 [scrollbar-gutter:stable]'
                        : 'max-h-[min(72dvh,560px)] overflow-y-auto pr-2'
                }
            >
                <BlacksmithLevelEffectsSummary
                    blacksmithLevel={blacksmithLevel}
                    disassemblyJackpotBonusPercent={disassemblyJackpotBonusPercent}
                    combinationGreatSuccessBonusPercent={combinationGreatSuccessBonusPercent}
                    compact={compactLayout}
                />
            </div>
        </DraggableWindow>
    );
};

export default BlacksmithEffectsModal;
