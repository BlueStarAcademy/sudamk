import React, { useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import GameRankingBoard from './GameRankingBoard.js';
import BadukRankingBoard from './BadukRankingBoard.js';
import ChampionshipRankingPanel from './ChampionshipRankingPanel.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH } from '../constants/ads.js';

type MobileRankingPanelTab = 'game' | 'baduk' | 'championship';

interface RankingQuickModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

const MOBILE_RANKING_TABS: { id: MobileRankingPanelTab; label: string }[] = [
    { id: 'game', label: '게임' },
    { id: 'baduk', label: '바둑' },
    { id: 'championship', label: '챔피언십' },
];

const RankingQuickModal: React.FC<RankingQuickModalProps> = ({ onClose, isTopmost }) => {
    const isCompactViewport = useIsHandheldDevice(1024);
    const { isNativeMobile } = useNativeMobileShell();
    const isMobile = isCompactViewport || isNativeMobile;
    const [mobilePanelTab, setMobilePanelTab] = useState<MobileRankingPanelTab>('game');

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
                className={`relative flex min-h-0 flex-col gap-2 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900/92 via-zinc-950/96 to-black/95 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_64px_-28px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] sm:gap-3 sm:p-3 ${
                    isMobile
                        ? 'min-h-0 flex-1 max-h-[min(78dvh,560px)] overflow-hidden'
                        : 'h-[min(72vh,560px)] overflow-y-auto overflow-x-hidden overscroll-contain'
                }`}
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
                    <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                        <div
                            className="flex shrink-0 gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]"
                            role="tablist"
                            aria-label="랭킹 종류"
                        >
                            {MOBILE_RANKING_TABS.map(({ id, label }) => {
                                const selected = mobilePanelTab === id;
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        role="tab"
                                        aria-selected={selected}
                                        onClick={() => setMobilePanelTab(id)}
                                        className={`min-h-[40px] shrink-0 rounded-xl border px-3.5 py-2 text-sm font-bold transition-all active:scale-[0.98] ${
                                            selected
                                                ? 'border-amber-400/45 bg-gradient-to-r from-amber-600/90 to-yellow-600/85 text-amber-50 shadow-md shadow-amber-900/40'
                                                : 'border-white/10 bg-black/35 text-zinc-400 hover:border-white/20 hover:bg-white/[0.06] hover:text-zinc-200'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.04]">
                            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                {mobilePanelTab === 'game' && <GameRankingBoard mobileSplitLarge />}
                                {mobilePanelTab === 'baduk' && <BadukRankingBoard mobileSplitLarge />}
                                {mobilePanelTab === 'championship' && (
                                    <ChampionshipRankingPanel compact lobbyNativeMobile />
                                )}
                            </div>
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
