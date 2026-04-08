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
                className={`relative flex min-h-0 flex-col gap-2 overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900/92 via-zinc-950/96 to-black/95 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_64px_-28px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] sm:gap-3 sm:p-3 ${isMobile ? 'max-h-[min(72dvh,520px)]' : 'h-[min(72vh,560px)]'}`}
            >
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent"
                    aria-hidden
                />
                <div
                    className="pointer-events-none absolute inset-x-6 top-3 h-8 rounded-full bg-amber-400/[0.06] blur-2xl"
                    aria-hidden
                />
                {isMobile ? (
                    <div className="relative z-[1] grid min-h-0 flex-1 grid-cols-2 gap-2">
                        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.04]">
                            <GameRankingBoard mobileSplitLarge />
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.04]">
                            <BadukRankingBoard mobileSplitLarge />
                        </div>
                    </div>
                ) : (
                    <div className="relative z-[1] grid min-h-0 flex-1 grid-cols-3 gap-2.5 sm:gap-3">
                        <div className="min-h-0 min-w-0 overflow-hidden rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.04]">
                            <GameRankingBoard />
                        </div>
                        <div className="min-h-0 min-w-0 overflow-hidden rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.04]">
                            <BadukRankingBoard />
                        </div>
                        <div className="min-h-0 min-w-0 overflow-hidden rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.04]">
                            <ChampionshipRankingPanel compact />
                        </div>
                    </div>
                )}
            </div>
        </DraggableWindow>
    );
};

export default RankingQuickModal;
