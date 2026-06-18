import React, { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../hooks/useAppContext.js';
import NavTitleBar from '../shell/NavTitleBar.js';
import {
    QUICK_UTILITY_PANEL_CHROME,
    QUICK_UTILITY_PANEL_TITLES,
    type QuickUtilityPanelKind,
} from '../../shared/types/quickUtilityPanel.js';
import { countTradeListingTickets } from '../../shared/utils/tradeListingTicket.js';
import ExchangeTradeTicketBadge from '../exchange/ExchangeTradeTicketBadge.js';

const QuestsModal = lazy(() => import('../QuestsModal.js'));
const ExchangeModal = lazy(() => import('../ExchangeModal.js'));
const BlacksmithModal = lazy(() => import('../BlacksmithModal.js'));
const ShopModal = lazy(() => import('../ShopModal.js'));
const InventoryModal = lazy(() => import('../InventoryModal.js'));
const PetManagementModal = lazy(() => import('../PetManagementModal.js'));
const TrainingQuestModal = lazy(() => import('../singleplayer/TrainingQuestModal.js'));
const DetailedStatsModal = lazy(() => import('../DetailedStatsModal.js'));
const AdventureMonsterCodexModal = lazy(() => import('../adventure/AdventureMonsterCodexModal.js'));
const RankingQuickModal = lazy(() => import('../RankingQuickModal.js'));
const GameRecordListModal = lazy(() => import('../GameRecordListModal.js'));
const EncyclopediaModal = lazy(() => import('../modals/EncyclopediaModal.js'));
const GuideModal = lazy(() => import('../GuideModal.js'));
import HomeBoardPanel from '../HomeBoardPanel.js';
import {
    MOBILE_QUICK_UTILITY_BODY_SCROLL_CLASS,
    MOBILE_QUICK_UTILITY_SHELL_CLASS,
} from '../../shared/constants/pcShellLayout.js';

import ModalChunkFallback from '../ui/ModalChunkFallback.js';

const PanelLoadingFallback = () => <ModalChunkFallback />;

type QuickUtilityPanelProps = {
    kind: QuickUtilityPanelKind;
    onBack: () => void;
    shellVariant?: 'pc' | 'mobile';
};

const QuickUtilityPanel: React.FC<QuickUtilityPanelProps> = ({ kind, onBack, shellVariant = 'pc' }) => {
    const { t } = useTranslation('nav');
    const {
        currentUserWithStatus,
        handlers,
        modals,
        enhancementOutcome,
        homeBoardPosts,
        unreadHomeBoardPostIds,
    } = useAppContext();
    const detailedStatsType = modals.detailedStatsType;

    if (!currentUserWithStatus) return null;

    const title = QUICK_UTILITY_PANEL_TITLES[kind];
    const chrome = QUICK_UTILITY_PANEL_CHROME[kind];

    const renderBody = () => {
        switch (kind) {
            case 'quests':
                return (
                    <QuestsModal
                        embedded
                        currentUser={currentUserWithStatus}
                        onClose={onBack}
                        onAction={handlers.handleAction}
                    />
                );
            case 'exchange':
                return (
                    <ExchangeModal
                        embedded
                        currentUser={currentUserWithStatus}
                        onClose={onBack}
                        onAction={handlers.handleAction}
                        onViewListedEquipment={(item, isOwned) =>
                            handlers.openViewingItem(item, isOwned ?? true, { hideEnhanceActions: true })
                        }
                    />
                );
            case 'blacksmith':
                return (
                    <BlacksmithModal
                        embedded
                        onClose={onBack}
                        isTopmost
                        selectedItemForEnhancement={modals.blacksmithSelectedItemForEnhancement}
                        activeTab={modals.blacksmithActiveTab}
                        onSetActiveTab={handlers.setBlacksmithActiveTab}
                        enhancementOutcome={enhancementOutcome}
                    />
                );
            case 'shop':
                return (
                    <ShopModal
                        embedded
                        currentUser={currentUserWithStatus}
                        onClose={onBack}
                        onAction={handlers.handleAction}
                        initialTab={modals.shopInitialTab}
                    />
                );
            case 'inventory':
                return (
                    <InventoryModal
                        embedded
                        currentUser={currentUserWithStatus}
                        onClose={onBack}
                        onAction={handlers.handleAction}
                        onStartEnhance={handlers.openEnhancingItem}
                        onOpenBlacksmithTab={handlers.openBlacksmithTabFromInventory}
                        enhancementAnimationTarget={modals.enhancementAnimationTarget}
                        onAnimationComplete={handlers.clearEnhancementAnimation}
                    />
                );
            case 'pet':
                return <PetManagementModal embedded onClose={onBack} />;
            case 'trainingQuest':
                return (
                    <TrainingQuestModal
                        embedded
                        currentUser={currentUserWithStatus}
                        onClose={onBack}
                    />
                );
            case 'detailedStats':
                return detailedStatsType ? (
                    <DetailedStatsModal
                        embedded
                        currentUser={currentUserWithStatus}
                        statsType={detailedStatsType}
                        onClose={onBack}
                        onAction={handlers.handleAction}
                    />
                ) : null;
            case 'monsterCodex':
                return <AdventureMonsterCodexModal embedded onClose={onBack} />;
            case 'ranking':
                return <RankingQuickModal embedded onClose={onBack} />;
            case 'gameRecords':
                return (
                    <GameRecordListModal
                        embedded
                        currentUser={currentUserWithStatus}
                        onClose={onBack}
                        onAction={handlers.handleAction}
                    />
                );
            case 'encyclopedia':
                return <EncyclopediaModal embedded onClose={onBack} />;
            case 'announcements':
                return (
                    <HomeBoardPanel
                        embedded
                        fitViewport
                        modalMode
                        posts={homeBoardPosts}
                        unreadPostIds={unreadHomeBoardPostIds}
                        onPostRead={handlers.markHomeBoardPostRead}
                        isAdmin={Boolean(currentUserWithStatus.isAdmin)}
                        onAction={handlers.handleAction}
                    />
                );
            case 'help':
                return (
                    <GuideModal
                        embedded
                        title={t('quickPanel.helpCenter')}
                        windowId="info-modal"
                        onClose={onBack}
                    />
                );
            default:
                return null;
        }
    };

    const isMobileShell = shellVariant === 'mobile';

    return (
        <div
            className={
                isMobileShell
                    ? MOBILE_QUICK_UTILITY_SHELL_CLASS
                    : 'relative flex h-full min-h-0 w-full flex-col overflow-hidden p-1 sm:p-1.5'
            }
        >
            <NavTitleBar
                title={title}
                onBack={onBack}
                className={`shrink-0 ${isMobileShell ? 'px-1 pt-0.5' : ''}`}
                chromeClass={chrome.titleChromeClass}
                titleHeadingClass={chrome.titleHeadingClass}
                iconUrl={chrome.iconUrl}
                iconEmoji={chrome.iconEmoji}
                titleTrailing={
                    kind === 'exchange' ? (
                        <ExchangeTradeTicketBadge count={countTradeListingTickets(currentUserWithStatus.inventory)} compact />
                    ) : undefined
                }
                flush
            />
            <div
                className={
                    isMobileShell
                        ? `relative flex min-h-0 flex-1 flex-col overflow-hidden ${MOBILE_QUICK_UTILITY_BODY_SCROLL_CLASS}`
                        : `relative mt-1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 backdrop-blur-[2px] ${chrome.bodyRingClass} sm:mt-1.5`
                }
            >
                {!isMobileShell && (
                    <div
                        className={`pointer-events-none absolute inset-x-2 top-0 z-[1] h-px bg-gradient-to-r from-transparent ${chrome.hairlineViaClass} to-transparent sm:inset-x-3`}
                        aria-hidden
                    />
                )}
                <div
                    className={
                        isMobileShell
                            ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                            : 'flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-0.5 sm:p-1'
                    }
                >
                    <Suspense fallback={<PanelLoadingFallback />}>{renderBody()}</Suspense>
                </div>
            </div>
        </div>
    );
};

export default QuickUtilityPanel;
