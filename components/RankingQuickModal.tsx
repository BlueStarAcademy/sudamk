import React, { useMemo, useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import GameRankingBoard from './GameRankingBoard.js';
import BadukRankingBoard from './BadukRankingBoard.js';
import ChampionshipRankingPanel from './ChampionshipRankingPanel.js';
import MobileRankingGuidePanel from './MobileRankingGuidePanel.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH } from '../constants/ads.js';
import { MobileEqualHeightTabPanels } from './game/MobileGameResultTabBar.js';

type MobileRankingPanelTab = 'game' | 'baduk' | 'championship';
type GuideMainTab = 'game' | 'baduk' | 'championship';
type GameGuideTab = 'combat' | 'manner';
type BadukGuideTab = 'strategic' | 'playful';

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
    const [isTipModalOpen, setIsTipModalOpen] = useState(false);
    const [guideMainTab, setGuideMainTab] = useState<GuideMainTab>('game');
    const [gameGuideTab, setGameGuideTab] = useState<GameGuideTab>('combat');
    const [badukGuideTab, setBadukGuideTab] = useState<BadukGuideTab>('strategic');

    const guideVariant = useMemo(() => {
        if (guideMainTab === 'game') {
            return gameGuideTab === 'combat' ? 'game-combat' : 'game-manner';
        }
        if (guideMainTab === 'baduk') {
            return badukGuideTab === 'strategic' ? 'baduk-strategic' : 'baduk-playful';
        }
        return null;
    }, [guideMainTab, gameGuideTab, badukGuideTab]);

    return (
        <DraggableWindow
            title="랭킹"
            onClose={() => {
                // 팁이 열린 상태에서 헤더 닫기(X)를 누르면 랭킹창 종료 대신 팁만 먼저 닫는다.
                if (isTipModalOpen) {
                    setIsTipModalOpen(false);
                    return;
                }
                onClose();
            }}
            windowId="ranking-quick-modal"
            initialWidth={isMobile ? 720 : 980}
            initialHeight={isMobile ? 760 : 640}
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
                        ? 'min-h-0 flex-1 max-h-[min(94dvh,880px)] overflow-hidden'
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
                        <div className="flex min-w-0 items-center gap-2">
                            <div
                                className="flex min-w-0 flex-1 shrink-0 gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]"
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
                                            className={`min-h-[31px] shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold tracking-tight transition-all duration-200 active:scale-[0.98] ${
                                                selected
                                                    ? 'border-amber-300/55 bg-gradient-to-b from-amber-500/85 via-amber-700/75 to-amber-950/80 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_22px_-12px_rgba(251,191,36,0.55)] ring-1 ring-amber-300/25'
                                                    : 'border-white/10 bg-gradient-to-b from-zinc-800/65 to-zinc-950/70 text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-amber-400/30 hover:text-amber-100'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setGuideMainTab(mobilePanelTab);
                                    setIsTipModalOpen(true);
                                }}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-300/40 bg-amber-500/20 text-[13px] shadow-sm shadow-amber-900/40 transition hover:bg-amber-500/30 active:scale-[0.97]"
                                title="스코어 가이드 보기"
                                aria-label="스코어 가이드 보기"
                            >
                                💡
                            </button>
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.04]">
                            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                <MobileEqualHeightTabPanels
                                    activeTabKey={mobilePanelTab}
                                    className="min-h-0 flex-1"
                                    fillParentHeight
                                    items={[
                                        {
                                            tabKey: 'game',
                                            panel: <GameRankingBoard mobileSplitLarge hideInlineGuide />,
                                        },
                                        {
                                            tabKey: 'baduk',
                                            panel: <BadukRankingBoard mobileSplitLarge hideInlineGuide />,
                                        },
                                        {
                                            tabKey: 'championship',
                                            panel: (
                                                <ChampionshipRankingPanel compact lobbyNativeMobile />
                                            ),
                                        },
                                    ]}
                                />
                            </div>
                        </div>
                        {isTipModalOpen && (
                            <div
                                className="sudamr-modal-inner-scrim absolute inset-0 z-20 flex items-center justify-center p-2"
                                onClick={() => setIsTipModalOpen(false)}
                            >
                                <div
                                    className="sudamr-floating-modal-surface relative flex h-[min(80dvh,620px)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl text-on-panel shadow-2xl ring-1 ring-inset ring-amber-400/18"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                                        <h4 className="text-sm font-bold text-amber-100">스코어 가이드</h4>
                                        <button
                                            type="button"
                                            onClick={() => setIsTipModalOpen(false)}
                                            className="rounded-md border border-amber-300/40 bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-50"
                                        >
                                            가이드 닫기
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-2 border-b border-white/10 px-3 py-2">
                                        <div className="flex items-center gap-1.5 overflow-x-auto">
                                            {([
                                                { id: 'game', label: '게임' },
                                                { id: 'baduk', label: '바둑' },
                                                { id: 'championship', label: '챔피언십' },
                                            ] as const).map(({ id, label }) => (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => setGuideMainTab(id)}
                                                    className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                                                        guideMainTab === id
                                                            ? 'border-amber-300/50 bg-amber-500/20 text-amber-50'
                                                            : 'border-white/15 bg-white/5 text-zinc-300'
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        {guideMainTab === 'game' && (
                                            <div className="flex items-center gap-1.5 overflow-x-auto">
                                                <button
                                                    type="button"
                                                    onClick={() => setGameGuideTab('combat')}
                                                    className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                                        gameGuideTab === 'combat'
                                                            ? 'border-indigo-300/50 bg-indigo-500/20 text-indigo-100'
                                                            : 'border-white/15 bg-white/5 text-zinc-300'
                                                    }`}
                                                >
                                                    바둑능력
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setGameGuideTab('manner')}
                                                    className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                                        gameGuideTab === 'manner'
                                                            ? 'border-indigo-300/50 bg-indigo-500/20 text-indigo-100'
                                                            : 'border-white/15 bg-white/5 text-zinc-300'
                                                    }`}
                                                >
                                                    매너
                                                </button>
                                            </div>
                                        )}
                                        {guideMainTab === 'baduk' && (
                                            <div className="flex items-center gap-1.5 overflow-x-auto">
                                                <button
                                                    type="button"
                                                    onClick={() => setBadukGuideTab('strategic')}
                                                    className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                                        badukGuideTab === 'strategic'
                                                            ? 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100'
                                                            : 'border-white/15 bg-white/5 text-zinc-300'
                                                    }`}
                                                >
                                                    전략바둑
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setBadukGuideTab('playful')}
                                                    className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                                        badukGuideTab === 'playful'
                                                            ? 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100'
                                                            : 'border-white/15 bg-white/5 text-zinc-300'
                                                    }`}
                                                >
                                                    놀이바둑
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-h-0 flex-1 overflow-y-auto p-2">
                                        {guideVariant ? (
                                            <MobileRankingGuidePanel variant={guideVariant} />
                                        ) : (
                                            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-300">
                                                챔피언십 탭은 별도 스코어 가이드가 준비되어 있지 않습니다.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
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
