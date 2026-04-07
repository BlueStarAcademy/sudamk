import React from 'react';
import DraggableWindow from './DraggableWindow.js';
import GameRankingBoard from './GameRankingBoard.js';
import BadukRankingBoard from './BadukRankingBoard.js';
import ChampionshipRankingPanel from './ChampionshipRankingPanel.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH } from '../constants/ads.js';

interface RankingQuickModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

const RankingQuickModal: React.FC<RankingQuickModalProps> = ({ onClose, isTopmost }) => {
    const isCompactViewport = useIsHandheldDevice(1024);
    const { isNativeMobile } = useNativeMobileShell();
    const isMobile = isCompactViewport || isNativeMobile;

    return (
        <DraggableWindow
            title="랭킹"
            onClose={onClose}
            windowId="ranking-quick-modal"
            initialWidth={isMobile ? 720 : 980}
            initialHeight={isMobile ? 520 : 640}
            isTopmost={isTopmost}
            variant="store"
            mobileViewportFit={isMobile}
            mobileViewportMaxHeightVh={NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}
            hideFooter={isMobile}
            skipSavedPosition={isMobile}
            bodyPaddingClassName={isMobile ? '!p-2' : undefined}
            bodyNoScroll={isMobile}
            bodyScrollable={!isMobile}
        >
            <div
                className={`flex min-h-0 flex-col gap-2 overflow-y-auto overflow-x-hidden overscroll-contain ${isMobile ? 'max-h-[min(72dvh,520px)]' : 'h-[min(72vh,560px)]'}`}
            >
                {isMobile ? (
                    <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5">
                        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-color/40 bg-panel/80">
                            <GameRankingBoard mobileSplitLarge />
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-color/40 bg-panel/80">
                            <BadukRankingBoard mobileSplitLarge />
                        </div>
                    </div>
                ) : (
                    <div className="grid min-h-0 flex-1 grid-cols-3 gap-2">
                        <div className="min-h-0 min-w-0 overflow-hidden rounded-lg border border-color/40 bg-panel/80">
                            <GameRankingBoard />
                        </div>
                        <div className="min-h-0 min-w-0 overflow-hidden rounded-lg border border-color/40 bg-panel/80">
                            <BadukRankingBoard />
                        </div>
                        <div className="min-h-0 min-w-0 overflow-hidden rounded-lg border border-color/40 bg-panel/80">
                            <ChampionshipRankingPanel compact />
                        </div>
                    </div>
                )}
            </div>
        </DraggableWindow>
    );
};

export default RankingQuickModal;
