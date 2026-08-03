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
import { RANKING_MODAL_SLIM_SCROLL_Y } from '../shared/constants/rankingModalScrollbar.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';
import type { MobileRankingGuideVariant } from './MobileRankingGuidePanel.js';

/** 모바일 랭킹 퀵 모달: 탭당 하나의 랭킹 보드 */
type RankingMobileTab = 'combat' | 'manner' | 'adventure' | 'strategic' | 'pair' | 'championship';

/** PC: 게임랭킹 / 바둑랭킹 / 탐험랭킹 / 챔피언십랭킹 */
type PcMainTab = 'game' | 'baduk' | 'adventure' | 'championship';

interface RankingQuickModalProps {
    onClose: () => void;
    isTopmost?: boolean;
    /** PC 로비 중앙 인라인 패널 — DraggableWindow 생략 */
    embedded?: boolean;
}

const MOBILE_RANKING_TAB_CONFIG: { id: RankingMobileTab; labelKey: string }[] = [
    { id: 'combat', labelKey: 'rankingQuick.ability' },
    { id: 'manner', labelKey: 'rankingQuick.manner' },
    { id: 'adventure', labelKey: 'rankingQuick.adventure' },
    { id: 'strategic', labelKey: 'rankingQuick.strategic' },
    { id: 'pair', labelKey: 'rankingQuick.pair' },
    { id: 'championship', labelKey: 'rankingQuick.championship' },
];

const PC_MAIN_TAB_CONFIG: { id: PcMainTab; labelKey: string; tone: 'game' | 'baduk' }[] = [
    { id: 'game', labelKey: 'rankingQuick.gameRankingTab', tone: 'game' },
    { id: 'baduk', labelKey: 'rankingQuick.badukRankingTab', tone: 'baduk' },
    { id: 'adventure', labelKey: 'rankingQuick.adventureRankingTab', tone: 'game' },
    { id: 'championship', labelKey: 'rankingQuick.championshipRankingTab', tone: 'baduk' },
];

const PC_MAIN_TAB_BTN =
    'rounded-xl border px-4 py-2 text-sm font-bold tracking-tight transition-all duration-200 sm:px-5 sm:py-2.5 sm:text-base';

const RankingQuickModal: React.FC<RankingQuickModalProps> = ({ onClose, isTopmost, embedded = false }) => {
    const { t } = useTranslation('tournament');
    const mobileRankingTabs = useMemo(
        () => MOBILE_RANKING_TAB_CONFIG.map(({ id, labelKey }) => ({ id, label: t(labelKey) })),
        [t],
    );
    const isCompactViewport = useIsHandheldDevice(1024);
    const { isNativeMobile } = useNativeMobileShell();
    const { currentUserWithStatus, handlers } = useAppContext();
    /** 좁은 화면·네이티브: 임베드(홈 퀵유틸) 포함 — 랭킹을 항목별 단건 + 드롭다운 */
    const isMobile = isCompactViewport || isNativeMobile;
    const [mobilePanelTab, setMobilePanelTab] = useState<RankingMobileTab>('combat');
    const [isTipModalOpen, setIsTipModalOpen] = useState(false);
    const [guideMainTab, setGuideMainTab] = useState<RankingMobileTab>('combat');
    const [pcMainTab, setPcMainTab] = useState<PcMainTab>('game');
    const [tierInfoOpen, setTierInfoOpen] = useState(false);

    const mobileTabTone = (id: RankingMobileTab): 'game' | 'baduk' =>
        id === 'strategic' || id === 'pair' || id === 'championship' ? 'baduk' : 'game';

    const mobileRankingSelectClass = (tone: 'game' | 'baduk') =>
        tone === 'baduk'
            ? 'border-emerald-300/45 bg-gradient-to-b from-emerald-950/80 via-zinc-950/90 to-black text-emerald-50 focus:border-emerald-300/70 focus:ring-1 focus:ring-emerald-400/25'
            : 'border-amber-300/50 bg-gradient-to-b from-amber-950/75 via-zinc-950/90 to-black text-amber-50 focus:border-amber-300/70 focus:ring-1 focus:ring-amber-400/25';

    const renderMobileRankingSelect = (
        value: RankingMobileTab,
        onChange: (next: RankingMobileTab) => void,
        ariaLabel: string,
    ) => {
        const tone = mobileTabTone(value);
        return (
            <div className="relative min-w-0 flex-1">
                <select
                    value={value}
                    aria-label={ariaLabel}
                    onChange={(e) => onChange(e.target.value as RankingMobileTab)}
                    className={`w-full appearance-none rounded-xl border px-3 py-2 pr-9 text-[13px] font-extrabold tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] outline-none ring-1 ring-white/[0.04] transition ${mobileRankingSelectClass(tone)}`}
                >
                    {mobileRankingTabs.map(({ id, label }) => (
                        <option key={id} value={id} className="bg-zinc-950 text-zinc-100">
                            {label}
                        </option>
                    ))}
                </select>
                <span
                    className={`pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-black ${
                        tone === 'baduk' ? 'text-emerald-200/80' : 'text-amber-200/80'
                    }`}
                    aria-hidden
                >
                    ▼
                </span>
            </div>
        );
    };

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
                {t('rankingQuick.championshipLoginHint')}
            </div>
        );

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
                            {renderMobileRankingSelect(mobilePanelTab, setMobilePanelTab, t('rankingQuick.tabAria'))}
                            <button
                                type="button"
                                onClick={() => {
                                    setGuideMainTab(mobilePanelTab);
                                    setIsTipModalOpen(true);
                                }}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-500/20 text-[13px] shadow-sm shadow-amber-900/40 transition hover:bg-amber-500/30 active:scale-[0.97]"
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
                                            {t('rankingQuick.guideClose')}
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-2 border-b border-white/10 px-3 py-2">
                                        {renderMobileRankingSelect(guideMainTab, setGuideMainTab, t('rankingQuick.categoryAria'))}
                                    </div>
                                    <div className={`min-h-0 flex-1 overflow-y-auto p-2 ${RANKING_MODAL_SLIM_SCROLL_Y}`}>
                                        {guideVariant ? (
                                            <MobileRankingGuidePanel variant={guideVariant} />
                                        ) : (
                                            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-300">
                                                {t('rankingQuick.championshipNoGuide')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : !currentUserWithStatus ? (
                    <div className="relative z-[1] flex flex-1 items-center justify-center text-sm text-zinc-400">
                        {t('rankingQuick.loginRequired')}
                    </div>
                ) : (
                    <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                        <div className="flex shrink-0 flex-wrap gap-2" role="tablist" aria-label={t('rankingQuick.categoryAria')}>
                            {PC_MAIN_TAB_CONFIG.map(({ id, labelKey, tone }) => {
                                const selected = pcMainTab === id;
                                const selectedClass =
                                    tone === 'baduk'
                                        ? 'border-emerald-300/50 bg-gradient-to-b from-emerald-600/90 via-teal-800/75 to-zinc-950/90 text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-emerald-300/25'
                                        : 'border-amber-300/55 bg-gradient-to-b from-amber-500/85 via-amber-800/70 to-amber-950/85 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-amber-300/30';
                                const idleClass =
                                    tone === 'baduk'
                                        ? 'border-white/12 bg-zinc-900/70 text-zinc-300 hover:border-emerald-400/35 hover:text-emerald-100'
                                        : 'border-white/12 bg-zinc-900/70 text-zinc-300 hover:border-amber-400/35 hover:text-amber-100';
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        role="tab"
                                        aria-selected={selected}
                                        onClick={() => setPcMainTab(id)}
                                        className={`${PC_MAIN_TAB_BTN} ${selected ? selectedClass : idleClass}`}
                                    >
                                        {t(labelKey)}
                                    </button>
                                );
                            })}
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
                                </div>
                            )}
                            {pcMainTab === 'adventure' && (
                                <div className="flex h-full min-h-0 overflow-hidden p-1.5 sm:p-2">
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
                            {pcMainTab === 'championship' && (
                                <div className="flex h-full min-h-0 overflow-hidden p-1.5 sm:p-2">
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
