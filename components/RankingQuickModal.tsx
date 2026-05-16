import React, { useMemo, useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import GameRankingBoard from './GameRankingBoard.js';
import RankingList from './waiting-room/RankingList.js';
import ChampionshipRankingList from './waiting-room/ChampionshipRankingList.js';
import MobileRankingGuidePanel from './MobileRankingGuidePanel.js';
import TierInfoModal from './TierInfoModal.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH } from '../constants/ads.js';
import { MobileEqualHeightTabPanels } from './game/MobileGameResultTabBar.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { RANKING_MODAL_SLIM_SCROLL_X, RANKING_MODAL_SLIM_SCROLL_Y } from '../shared/constants/rankingModalScrollbar.js';
import type { MobileRankingGuideVariant } from './MobileRankingGuidePanel.js';

/** 모바일 랭킹 퀵 모달: 탭당 하나의 랭킹 보드 */
type RankingMobileTab = 'combat' | 'manner' | 'adventure' | 'championship' | 'strategic' | 'pair';

type PcMainTab = 'game' | 'baduk' | 'championship';

interface RankingQuickModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

const MOBILE_RANKING_TABS: { id: RankingMobileTab; label: string }[] = [
    { id: 'combat', label: '바둑능력' },
    { id: 'manner', label: '매너' },
    { id: 'adventure', label: '모험' },
    { id: 'championship', label: '챔피언십' },
    { id: 'strategic', label: '전략바둑' },
    { id: 'pair', label: '페어바둑' },
];

const PC_MAIN_TAB_BTN =
    'rounded-xl border px-4 py-2 text-sm font-bold tracking-tight transition-all duration-200 sm:px-5 sm:py-2.5 sm:text-base';

const RankingQuickModal: React.FC<RankingQuickModalProps> = ({ onClose, isTopmost }) => {
    const isCompactViewport = useIsHandheldDevice(1024);
    const { isNativeMobile } = useNativeMobileShell();
    const { currentUserWithStatus, handlers } = useAppContext();
    const isMobile = isCompactViewport || isNativeMobile;
    const [mobilePanelTab, setMobilePanelTab] = useState<RankingMobileTab>('combat');
    const [isTipModalOpen, setIsTipModalOpen] = useState(false);
    const [guideMainTab, setGuideMainTab] = useState<RankingMobileTab>('combat');
    const [pcMainTab, setPcMainTab] = useState<PcMainTab>('game');
    const [tierInfoOpen, setTierInfoOpen] = useState(false);

    const guideVariant = useMemo((): MobileRankingGuideVariant | null => {
        switch (guideMainTab) {
            case 'combat':
                return 'game-combat';
            case 'manner':
                return 'game-manner';
            case 'adventure':
                return 'game-adventure';
            case 'strategic':
                return 'baduk-strategic';
            case 'pair':
                return 'baduk-pair';
            default:
                return null;
        }
    }, [guideMainTab]);

    return (
        <DraggableWindow
            title="랭킹"
            onClose={() => {
                if (tierInfoOpen) {
                    setTierInfoOpen(false);
                    return;
                }
                if (isTipModalOpen) {
                    setIsTipModalOpen(false);
                    return;
                }
                onClose();
            }}
            windowId="ranking-quick-modal"
            initialWidth={isMobile ? 720 : 1020}
            initialHeight={isMobile ? 760 : 820}
            isTopmost={isTopmost}
            variant="store"
            mobileViewportFit={isMobile}
            mobileViewportMaxHeightVh={NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}
            bodyPaddingClassName={isMobile ? '!p-2' : undefined}
            bodyNoScroll={isMobile}
            bodyScrollable={!isMobile}
            bodyScrollClassName={!isMobile ? RANKING_MODAL_SLIM_SCROLL_Y : undefined}
        >
            <div
                className={`relative flex min-h-0 flex-col gap-2 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900/92 via-zinc-950/96 to-black/95 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_64px_-28px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] sm:gap-3 sm:p-3 ${
                    isMobile
                        ? 'min-h-0 flex-1 max-h-[min(94dvh,880px)] overflow-hidden'
                        : 'h-[min(82vh,760px)] min-h-[480px] overflow-hidden'
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
                                className={`flex min-w-0 flex-1 shrink-0 gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] ${RANKING_MODAL_SLIM_SCROLL_X}`}
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
                                            tabKey: 'combat',
                                            panel: (
                                                <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                                    <GameRankingBoard
                                                        lockedTab="combat"
                                                        mobileSplitLarge
                                                        hideInlineGuide
                                                        panelTitle="바둑능력"
                                                    />
                                                </div>
                                            ),
                                        },
                                        {
                                            tabKey: 'manner',
                                            panel: (
                                                <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                                    <GameRankingBoard
                                                        lockedTab="manner"
                                                        mobileSplitLarge
                                                        hideInlineGuide
                                                        panelTitle="매너"
                                                    />
                                                </div>
                                            ),
                                        },
                                        {
                                            tabKey: 'adventure',
                                            panel: (
                                                <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                                    <GameRankingBoard
                                                        lockedTab="adventure"
                                                        mobileSplitLarge
                                                        hideInlineGuide
                                                        panelTitle="모험"
                                                    />
                                                </div>
                                            ),
                                        },
                                        {
                                            tabKey: 'championship',
                                            panel: (
                                                <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                                    {currentUserWithStatus ? (
                                                        <ChampionshipRankingList
                                                            currentUser={currentUserWithStatus}
                                                            onViewUser={handlers.openViewingUser}
                                                            splitStack
                                                        />
                                                    ) : (
                                                        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-400">
                                                            로그인 후 챔피언십 랭킹을 확인할 수 있습니다.
                                                        </div>
                                                    )}
                                                </div>
                                            ),
                                        },
                                        {
                                            tabKey: 'strategic',
                                            panel: (
                                                <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                                    {currentUserWithStatus ? (
                                                        <RankingList
                                                            currentUser={currentUserWithStatus}
                                                            mode="strategic"
                                                            onViewUser={handlers.openViewingUser}
                                                            onShowTierInfo={() => setTierInfoOpen(true)}
                                                            onShowPastRankings={handlers.openPastRankings}
                                                            lobbyType="strategic"
                                                            splitStack
                                                        />
                                                    ) : (
                                                        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-400">
                                                            로그인 후 전략바둑 랭킹을 확인할 수 있습니다.
                                                        </div>
                                                    )}
                                                </div>
                                            ),
                                        },
                                        {
                                            tabKey: 'pair',
                                            panel: (
                                                <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                                    {currentUserWithStatus ? (
                                                        <RankingList
                                                            currentUser={currentUserWithStatus}
                                                            mode="strategic"
                                                            onViewUser={handlers.openViewingUser}
                                                            onShowTierInfo={() => setTierInfoOpen(true)}
                                                            onShowPastRankings={handlers.openPastRankings}
                                                            lobbyType="pair"
                                                            splitStack
                                                        />
                                                    ) : (
                                                        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-400">
                                                            로그인 후 페어바둑 랭킹을 확인할 수 있습니다.
                                                        </div>
                                                    )}
                                                </div>
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
                                        <div className={`flex items-center gap-1.5 overflow-x-auto ${RANKING_MODAL_SLIM_SCROLL_X}`}>
                                            {MOBILE_RANKING_TABS.map(({ id, label }) => (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => setGuideMainTab(id)}
                                                    className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                                                        guideMainTab === id
                                                            ? 'border-amber-300/50 bg-amber-500/20 text-amber-50'
                                                            : 'border-white/15 bg-white/5 text-zinc-300'
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className={`min-h-0 flex-1 overflow-y-auto p-2 ${RANKING_MODAL_SLIM_SCROLL_Y}`}>
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
                ) : !currentUserWithStatus ? (
                    <div className="relative z-[1] flex flex-1 items-center justify-center text-sm text-zinc-400">
                        로그인 후 랭킹을 확인할 수 있습니다.
                    </div>
                ) : (
                    <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                        <div className="flex shrink-0 flex-wrap gap-2" role="tablist" aria-label="랭킹 카테고리">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={pcMainTab === 'game'}
                                onClick={() => setPcMainTab('game')}
                                className={`${PC_MAIN_TAB_BTN} ${
                                    pcMainTab === 'game'
                                        ? 'border-amber-300/55 bg-gradient-to-b from-amber-500/85 via-amber-800/70 to-amber-950/85 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-amber-300/30'
                                        : 'border-white/12 bg-zinc-900/70 text-zinc-300 hover:border-amber-400/35 hover:text-amber-100'
                                }`}
                            >
                                게임랭킹
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={pcMainTab === 'baduk'}
                                onClick={() => setPcMainTab('baduk')}
                                className={`${PC_MAIN_TAB_BTN} ${
                                    pcMainTab === 'baduk'
                                        ? 'border-emerald-300/50 bg-gradient-to-b from-emerald-600/90 via-teal-800/75 to-zinc-950/90 text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-emerald-300/25'
                                        : 'border-white/12 bg-zinc-900/70 text-zinc-300 hover:border-emerald-400/35 hover:text-emerald-100'
                                }`}
                            >
                                바둑랭킹
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={pcMainTab === 'championship'}
                                onClick={() => setPcMainTab('championship')}
                                className={`${PC_MAIN_TAB_BTN} ${
                                    pcMainTab === 'championship'
                                        ? 'border-violet-300/50 bg-gradient-to-b from-violet-600/90 via-purple-900/78 to-zinc-950/92 text-violet-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-violet-300/28'
                                        : 'border-white/12 bg-zinc-900/70 text-zinc-300 hover:border-violet-400/38 hover:text-violet-100'
                                }`}
                            >
                                챔피언십랭킹
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-hidden rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.06]">
                            {pcMainTab === 'game' && (
                                <div className="flex h-full min-h-0 flex-row gap-2 overflow-hidden p-1.5 sm:gap-3 sm:p-2">
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                        <GameRankingBoard
                                            lockedTab="combat"
                                            mobileSplitLarge
                                            hideInlineGuide
                                            panelTitle="바둑능력"
                                        />
                                    </div>
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                        <GameRankingBoard
                                            lockedTab="manner"
                                            mobileSplitLarge
                                            hideInlineGuide
                                            panelTitle="매너"
                                        />
                                    </div>
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                        <GameRankingBoard
                                            lockedTab="adventure"
                                            mobileSplitLarge
                                            hideInlineGuide
                                            panelTitle="모험"
                                        />
                                    </div>
                                </div>
                            )}
                            {pcMainTab === 'championship' && (
                                <div className="flex h-full min-h-0 flex-row gap-2 overflow-hidden p-1.5 sm:gap-3 sm:p-2">
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                        <ChampionshipRankingList
                                            currentUser={currentUserWithStatus}
                                            onViewUser={handlers.openViewingUser}
                                            splitStack
                                        />
                                    </div>
                                </div>
                            )}
                            {pcMainTab === 'baduk' && (
                                <div className="flex h-full min-h-0 flex-row gap-2 overflow-hidden p-1.5 sm:gap-3 sm:p-2">
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                        <RankingList
                                            currentUser={currentUserWithStatus}
                                            mode="strategic"
                                            onViewUser={handlers.openViewingUser}
                                            onShowTierInfo={() => setTierInfoOpen(true)}
                                            onShowPastRankings={handlers.openPastRankings}
                                            lobbyType="strategic"
                                            splitStack
                                        />
                                    </div>
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                        <RankingList
                                            currentUser={currentUserWithStatus}
                                            mode="strategic"
                                            onViewUser={handlers.openViewingUser}
                                            onShowTierInfo={() => setTierInfoOpen(true)}
                                            onShowPastRankings={handlers.openPastRankings}
                                            lobbyType="pair"
                                            splitStack
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {tierInfoOpen && <TierInfoModal onClose={() => setTierInfoOpen(false)} />}
        </DraggableWindow>
    );
};

export default RankingQuickModal;
