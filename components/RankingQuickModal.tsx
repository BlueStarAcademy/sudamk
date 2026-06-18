import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';
import type { MobileRankingGuideVariant } from './MobileRankingGuidePanel.js';

/** 모바일 랭킹 퀵 모달: 탭당 하나의 랭킹 보드 */
type RankingMobileTab = 'combat' | 'manner' | 'adventure' | 'strategic' | 'pair' | 'championship';

type PcMainTab = 'game' | 'baduk';

interface RankingQuickModalProps {
    onClose: () => void;
    isTopmost?: boolean;
    /** PC 로비 중앙 인라인 패널 — DraggableWindow 생략 */
    embedded?: boolean;
}

const MOBILE_RANKING_TABS: { id: RankingMobileTab; label: string }[] = [
    { id: 'combat', label: t('rankingQuick.ability') },
    { id: 'manner', label: t('rankingQuick.manner') },
    { id: 'adventure', label: t('rankingQuick.adventure') },
    { id: 'strategic', label: t('rankingQuick.strategic') },
    { id: 'pair', label: t('rankingQuick.pair') },
    { id: 'championship', label: t('rankingQuick.championship') },
];

const PC_MAIN_TAB_BTN =
    'rounded-xl border px-4 py-2 text-sm font-bold tracking-tight transition-all duration-200 sm:px-5 sm:py-2.5 sm:text-base';

const RankingQuickModal: React.FC<RankingQuickModalProps> = ({ onClose, isTopmost, embedded = false }) => {
    const { t } = useTranslation('tournament');
    const isCompactViewport = useIsHandheldDevice(1024);
    const { isNativeMobile } = useNativeMobileShell();
    const { currentUserWithStatus, handlers } = useAppContext();
    const isMobile = !embedded && (isCompactViewport || isNativeMobile);
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

    const renderBadukRankingPanel = (lobbyType: 'strategic' | 'pair') =>
        currentUserWithStatus ? (
            <RankingList
                currentUser={currentUserWithStatus}
                mode="strategic"
                onViewUser={handlers.openViewingUser}
                onShowTierInfo={() => setTierInfoOpen(true)}
                onShowPastRankings={handlers.openPastRankings}
                lobbyType={lobbyType}
                splitStack
            />
        ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-400">
                {t('rankingQuick.loginHint', { lobby: lobbyType === 'pair' ? t('rankingQuick.pairLobby') : t('rankingQuick.strategicLobby') })}
            </div>
        );

    const renderChampionshipRankingPanel = () =>
        currentUserWithStatus ? (
            <ChampionshipRankingList
                currentUser={currentUserWithStatus}
                onViewUser={handlers.openViewingUser}
                splitStack
            />
        ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-400">
                로그인 후 챔피언십 랭킹을 확인할 수 있습니다.
            </div>
        );

    const mobileBadukTabSelectedClass =
        'border-emerald-300/50 bg-gradient-to-b from-emerald-600/85 via-teal-800/75 to-zinc-950/80 text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-emerald-300/22';
    const mobileBadukTabIdleClass =
        'border-white/10 bg-gradient-to-b from-zinc-800/65 to-zinc-950/70 text-zinc-300 hover:border-emerald-400/30 hover:text-emerald-100';
    const mobileGameTabSelectedClass =
        'border-amber-300/55 bg-gradient-to-b from-amber-500/85 via-amber-700/75 to-amber-950/80 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_22px_-12px_rgba(251,191,36,0.55)] ring-1 ring-amber-300/25';
    const mobileGameTabIdleClass =
        'border-white/10 bg-gradient-to-b from-zinc-800/65 to-zinc-950/70 text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-amber-400/30 hover:text-amber-100';

    const mobileTabButtonClass = (id: RankingMobileTab, selected: boolean) => {
        const isBadukTab = id === 'strategic' || id === 'pair' || id === 'championship';
        if (selected) {
            return isBadukTab ? mobileBadukTabSelectedClass : mobileGameTabSelectedClass;
        }
        return isBadukTab ? mobileBadukTabIdleClass : mobileGameTabIdleClass;
    };

    const handleClose = () => {
        if (tierInfoOpen) {
            setTierInfoOpen(false);
            return;
        }
        if (isTipModalOpen) {
            setIsTipModalOpen(false);
            return;
        }
        onClose();
    };

    const rankingBody = (
            <div
                className={`relative flex min-h-0 flex-col gap-2 overflow-hidden ${
                    embedded
                        ? 'h-full flex-1 sm:gap-3'
                        : `rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900/92 via-zinc-950/96 to-black/95 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_64px_-28px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] sm:gap-3 sm:p-3 ${
                              isMobile
                                  ? 'min-h-0 flex-1 max-h-[min(94dvh,880px)]'
                                  : 'h-[min(82vh,760px)] min-h-[480px]'
                          }`
                }`}
            >
                {!embedded && (
                    <>
                        <div
                            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent"
                            aria-hidden
                        />
                        <div
                            className="pointer-events-none absolute inset-x-6 top-3 h-8 rounded-full bg-amber-400/[0.06] blur-2xl"
                            aria-hidden
                        />
                    </>
                )}
                {isMobile ? (
                    <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                        <div className="flex min-w-0 items-center gap-2">
                            <div
                                className={`flex min-w-0 flex-1 shrink-0 gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] ${RANKING_MODAL_SLIM_SCROLL_X}`}
                                role="tablist"
                                aria-label={t('rankingQuick.tabAria')}
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
                                            className={`min-h-[31px] shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold tracking-tight transition-all duration-200 active:scale-[0.98] ${mobileTabButtonClass(id, selected)}`}
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
                                title={t('rankingQuick.scrollGuide')}
                                aria-label={t('rankingQuick.scrollGuideAria')}
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
                                                        panelTitle={t('rankingQuick.ability')}
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
                                                        panelTitle={t('rankingQuick.manner')}
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
                                                        panelTitle={t('rankingQuick.adventure')}
                                                    />
                                                </div>
                                            ),
                                        },
                                        {
                                            tabKey: 'strategic',
                                            panel: (
                                                <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                                    {renderBadukRankingPanel('strategic')}
                                                </div>
                                            ),
                                        },
                                        {
                                            tabKey: 'pair',
                                            panel: (
                                                <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                                    {renderBadukRankingPanel('pair')}
                                                </div>
                                            ),
                                        },
                                        {
                                            tabKey: 'championship',
                                            panel: (
                                                <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                                    {renderChampionshipRankingPanel()}
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
                                        <h4 className="text-sm font-bold text-amber-100">{t('rankingQuick.scrollGuideTitle')}</h4>
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
                                                            ? id === 'strategic' || id === 'pair' || id === 'championship'
                                                                ? 'border-emerald-300/50 bg-emerald-500/20 text-emerald-50'
                                                                : 'border-amber-300/50 bg-amber-500/20 text-amber-50'
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
                                                챔피언십 랭킹은 별도 스코어 가이드가 준비되어 있지 않습니다.
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
                        <div className="flex shrink-0 flex-wrap gap-2" role="tablist" aria-label={t('rankingQuick.categoryAria')}>
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
                        </div>

                        <div className="min-h-0 flex-1 overflow-hidden rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.06]">
                            {pcMainTab === 'game' && (
                                <div className="flex h-full min-h-0 flex-row gap-2 overflow-hidden p-1.5 sm:gap-3 sm:p-2">
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                        <GameRankingBoard
                                            lockedTab="combat"
                                            mobileSplitLarge
                                            hideInlineGuide
                                            panelTitle={t('rankingQuick.ability')}
                                        />
                                    </div>
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                        <GameRankingBoard
                                            lockedTab="manner"
                                            mobileSplitLarge
                                            hideInlineGuide
                                            panelTitle={t('rankingQuick.manner')}
                                        />
                                    </div>
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                        <GameRankingBoard
                                            lockedTab="adventure"
                                            mobileSplitLarge
                                            hideInlineGuide
                                            panelTitle={t('rankingQuick.adventure')}
                                        />
                                    </div>
                                </div>
                            )}
                            {pcMainTab === 'baduk' && (
                                <div className="flex h-full min-h-0 flex-row gap-2 overflow-hidden p-1.5 sm:gap-3 sm:p-2">
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                        {renderBadukRankingPanel('strategic')}
                                    </div>
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                        {renderBadukRankingPanel('pair')}
                                    </div>
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                                        {renderChampionshipRankingPanel()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
    );

    if (embedded) {
        return (
            <div className={PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS}>
                {rankingBody}
                {tierInfoOpen && <TierInfoModal onClose={() => setTierInfoOpen(false)} />}
            </div>
        );
    }

    return (
        <DraggableWindow
            title={t('rankingQuick.title')}
            onClose={handleClose}
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
            {rankingBody}
            {tierInfoOpen && <TierInfoModal onClose={() => setTierInfoOpen(false)} />}
        </DraggableWindow>
    );
};

export default RankingQuickModal;
