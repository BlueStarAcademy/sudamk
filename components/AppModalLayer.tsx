import React, { useMemo, useState, Suspense, lazy } from 'react';
import type { PairRoomState } from '../types/api.js';
import {
    useAppGameStoreSlice,
    useAppRealtimeSlice,
    useAppUiSlice,
    useAppUserSlice,
} from '../hooks/useAppSlices.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH, NATIVE_MOBILE_MODAL_MAX_WIDTH_VW } from '../constants/ads.js';
import { isMobileViewportEntryTypeActive } from '../shared/utils/mobileViewportStackUtils.js';
import type { MobileViewportEntryType } from '../shared/types/mobileViewportStack.js';
import { useMobileModalChrome } from '../hooks/useMobileModalChrome.js';

const InventoryModal = lazy(() => import('./InventoryModal.js'));
const MailboxModal = lazy(() => import('./MailboxModal.js'));
const QuestsModal = lazy(() => import('./QuestsModal.js'));
const ShopModal = lazy(() => import('./ShopModal.js'));
const ExchangeModal = lazy(() => import('./ExchangeModal.js'));
const ActionPointModal = lazy(() => import('./ActionPointModal.js'));
const UserProfileModal = lazy(() => import('./UserProfileModal.js'));
const EncyclopediaModal = lazy(() => import('./modals/EncyclopediaModal.js'));
const PastRankingsModal = lazy(() => import('./modals/PastRankingsModal.js'));
const AdminModerationModal = lazy(() => import('./AdminModerationModal.js'));
const BlacksmithModal = lazy(() => import('./BlacksmithModal.js'));
const BlacksmithEffectsModal = lazy(() => import('./blacksmith/BlacksmithEffectsModal.js'));
const GameRecordListModal = lazy(() => import('./GameRecordListModal.js'));
const GameRecordViewerModal = lazy(() => import('./GameRecordViewerModal.js'));
const GameSummaryModal = lazy(() => import('./GameSummaryModal.js'));
import InfoModal from './InfoModal.js';
import RankingQuickModal from './RankingQuickModal.js';
import ChatQuickModal from './ChatQuickModal.js';
import HomeBoardPanel from './HomeBoardPanel.js';
import DisassemblyResultModal from './DisassemblyResultModal.js';
import StatAllocationModal from './StatAllocationModal.js';
import ItemDetailModal from './ItemDetailModal.js';
import ProfileEditModal from './ProfileEditModal.js';
import ItemObtainedModal from './ItemObtainedModal.js';
import PairPetObtainedModal from './PairPetObtainedModal.js';
import BulkItemObtainedModal from './BulkItemObtainedModal.js';
import RewardSummaryModal from './RewardSummaryModal.js';
import CraftingResultModal from './CraftingResultModal.js';
import SettingsModal from './SettingsModal.js';
import PetManagementModal from './PetManagementModal.js';
import AdventureMonsterCodexModal from './adventure/AdventureMonsterCodexModal.js';
const TrainingQuestModal = lazy(() => import('./singleplayer/TrainingQuestModal.js'));
const DetailedStatsModal = lazy(() => import('./DetailedStatsModal.js'));
import ClaimAllSummaryModal from './ClaimAllSummaryModal.js';
import MbtiInfoModal from './MbtiInfoModal.js';
import CombinationResultModal from './blacksmith/CombinationResultModal.js';
import EquipmentEffectsModal from './EquipmentEffectsModal.js';
import EnhancementResultModal from './modals/EnhancementResultModal.js';
import InsufficientActionPointsModal from './InsufficientActionPointsModal.js';
import OpponentInsufficientActionPointsModal from './OpponentInsufficientActionPointsModal.js';
import LevelUpCelebrationModal from './LevelUpCelebrationModal.js';
import MannerGradeChangeModal from './MannerGradeChangeModal.js';
import ContentUnlockNoticeModal from './ContentUnlockNoticeModal.js';
import MobileModalTitleBar from './mobile/MobileModalTitleBar.js';
import PairIncomingPartnerInviteModal from './pair/PairIncomingPartnerInviteModal.js';
import { arenaLobbyHash, arenaLobbyIntentFromPairRoom } from '../shared/utils/arenaLobbyDestination.js';
import { replaceAppHash } from '../utils/appUtils.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { PAIR_LOBBY_FOCUS_ROOM_TAB_SESSION_KEY } from '../shared/constants/pairArena.js';
import { mergeWaitingRoomPublicChatMessages } from '../shared/utils/waitingRoomGlobalChatMerge.js';
import ModalChunkFallback from './ui/ModalChunkFallback.js';

const ModalLoadingFallback = () => <ModalChunkFallback />;

const AppModalLayer: React.FC = () => {
    const { isNativeMobile } = useNativeMobileShell();
    const isHandheld = useIsHandheldDevice(1024);
    const isMobileModalChrome = useMobileModalChrome();
    const {
        allUsers,
        waitingRoomChats,
        pairRooms,
        pairPartnerInvites,
        announcements,
        globalOverrideAnnouncement,
        homeBoardPosts,
        unreadHomeBoardPostIds,
        onlineUsers,
    } = useAppRealtimeSlice();
    const {
        currentUserWithStatus,
        mainOptionBonuses,
        combatSubOptionBonuses,
        specialStatBonuses,
        aggregatedMythicStats,
    } = useAppUserSlice();
    const { activeNegotiation } = useAppGameStoreSlice();
    const { modals, handlers, enhancementOutcome } = useAppUiSlice();

    const mergedPublicChatMessages = useMemo(
        () => mergeWaitingRoomPublicChatMessages(waitingRoomChats ?? {}),
        [waitingRoomChats],
    );

    const incomingPairPartnerInvite = useMemo(() => {
        if (!currentUserWithStatus) return null;
        const uid = currentUserWithStatus.id;
        const raw = pairPartnerInvites || {};
        const list = Object.values(raw) as Array<{
            id: string;
            roomId: string;
            inviteeId: string;
            inviterName: string;
            roomTitle: string;
            roomCode: string;
            createdAt: number;
        }>;
        return list.find((i) => i.inviteeId === uid) ?? null;
    }, [pairPartnerInvites, currentUserWithStatus?.id]);

    const incomingInvitePairRoom = useMemo(() => {
        if (!incomingPairPartnerInvite) return null;
        const raw = (pairRooms || {})[incomingPairPartnerInvite.roomId];
        return raw && typeof raw === 'object' ? (raw as PairRoomState) : null;
    }, [pairRooms, incomingPairPartnerInvite]);

    const [pairInviteRespondBusy, setPairInviteRespondBusy] = useState(false);

    const hasItemObtainedResult = Array.isArray(modals.lastUsedItemResult) && modals.lastUsedItemResult.length > 0;
    const hasScoreOnlyItemObtained = Boolean(modals.tournamentScoreChange) && !hasItemObtainedResult;

    const activeModalIds = useMemo(() => {
        const ids: string[] = [];
        if (activeNegotiation) ids.push('negotiation');
        if (modals.isSettingsModalOpen) ids.push('settings');
        if (modals.isPetManagementModalOpen) ids.push('petManagement');
        if (modals.isAdventureMonsterCodexModalOpen) ids.push('adventureMonsterCodex');
        if (modals.isTrainingQuestModalOpen) ids.push('trainingQuest');
        if (modals.detailedStatsType) ids.push('detailedStats');
        if (modals.isInventoryOpen) ids.push('inventory');
        if (modals.isMailboxOpen) ids.push('mailbox');
        if (modals.isQuestsOpen) ids.push('quests');
        if (modals.rewardSummary) ids.push('rewardSummary');
        if (modals.isClaimAllSummaryOpen) ids.push('claimAllSummary');
        if (modals.isShopOpen) ids.push('shop');
        if (modals.isExchangeOpen) ids.push('exchange');
        if (modals.isActionPointModalOpen) ids.push('actionPoint');
        if (modals.viewingUser) ids.push('viewingUser');
        if (modals.isInfoModalOpen) ids.push('infoModal');
        if (modals.isAnnouncementsModalOpen) ids.push('announcementsModal');
        if (modals.isRankingQuickModalOpen) ids.push('rankingQuickModal');
        if (modals.isChatQuickModalOpen) ids.push('chatQuickModal');
        if (modals.isEncyclopediaOpen) ids.push('encyclopedia');
        if (modals.isStatAllocationModalOpen) ids.push('statAllocation');
        if (modals.isProfileEditModalOpen) ids.push('profileEdit');
        if (modals.pastRankingsInfo) ids.push('pastRankings');
        if (modals.moderatingUser) ids.push('moderatingUser');
        if (modals.viewingItem) ids.push('viewingItem');
        if (modals.enhancingItem) ids.push('enhancingItem');
        if (modals.isBlacksmithModalOpen) ids.push('blacksmith');
        if (modals.isBlacksmithEffectsModalOpen) ids.push('blacksmithEffects');
        if (modals.isEquipmentEffectsModalOpen) ids.push('equipmentEffects');
        if (modals.isGameRecordListOpen) ids.push('gameRecordList');
        if (modals.viewingGameRecord) ids.push('gameRecordViewer');
        if (modals.combinationResult) ids.push('combinationResult');
        if (modals.disassemblyResult) ids.push('disassemblyResult');
        if (modals.craftResult) ids.push('craftResult');
        if (modals.isEnhancementResultModalOpen) ids.push('enhancementResult');
        if (modals.isMbtiInfoModalOpen) ids.push('mbtiInfo');
        if (modals.mutualDisconnectMessage) ids.push('mutualDisconnect');
        if (modals.showOtherDeviceLoginModal) ids.push('otherDeviceLogin');
        if (hasItemObtainedResult || hasScoreOnlyItemObtained) ids.push('itemObtained');
        // 행동력 안내는 전역 오버레이·DraggableWindow 스택 모두에서 최상단에 두기
        if (modals.isInsufficientActionPointsModalOpen) ids.push('insufficientActionPoints');
        if (modals.isOpponentInsufficientActionPointsModalOpen) ids.push('opponentInsufficientActionPoints');
        if (modals.mannerGradeChange) ids.push('mannerGradeChange');
        if (modals.contentUnlockNotice) ids.push('contentUnlockNotice');
        if (modals.pairPetDetailModal) ids.push('pairPetDetail');
        if (modals.levelUpCelebration) ids.push('levelUpCelebration');
        if (modals.adminGameResultDemoSession) ids.push('adminGameResultDemo');
        return ids;
    }, [modals, activeNegotiation, hasItemObtainedResult, hasScoreOnlyItemObtained]);

    const topmostModalId = activeModalIds.length > 0 ? activeModalIds[activeModalIds.length - 1] : null;
    const mobileViewportStack = modals.mobileViewportStack ?? [];
    const mobileViewportActive = (type: MobileViewportEntryType) =>
        isMobileViewportEntryTypeActive(mobileViewportStack, type);
    /** PC 인라인 퀵 패널·모바일 뷰포트 스택이 열려 있으면 동일 유틸 모달을 AppModalLayer에서 중복 렌더하지 않음 */
    const inlineQuickUtilityActive =
        Boolean(modals.activeQuickUtilityPanel) ||
        mobileViewportStack.some((entry) => entry.type === 'quickUtility');

    if (!currentUserWithStatus) return null;

    const respondIncomingPairInvite = async (inviteId: string, accept: boolean, inviteRoomId?: string) => {
        setPairInviteRespondBusy(true);
        try {
            const result = await handlers.handleAction({ type: 'PAIR_RESPOND_PARTNER_INVITE', payload: { inviteId, accept } });
            const err = (result as any)?.error;
            if (err) {
                window.alert(err);
                return;
            }
            if (!accept || !inviteRoomId) return;

            const prMap = (result as any)?.clientResponse?.pairRooms ?? (result as any)?.pairRooms;
            const joinedRoom =
                prMap && typeof prMap === 'object'
                    ? (prMap as Record<string, PairRoomState>)[inviteRoomId]
                    : undefined;
            const room = joinedRoom ?? incomingInvitePairRoom;
            const lobbyChannel = (room?.lobbyChannel ?? 'pair') as 'pair' | 'strategic' | 'playful';
            const lobbyIntent = arenaLobbyIntentFromPairRoom(room);
            const targetHash = arenaLobbyHash({ intent: lobbyIntent, channel: lobbyChannel });

            const norm = (h: string) => h.replace(/^#\/?/, '').split('?')[0];
            const needNav = norm(window.location.hash) !== norm(targetHash);

            if (isHandheld) {
                try {
                    sessionStorage.setItem(PAIR_LOBBY_FOCUS_ROOM_TAB_SESSION_KEY, '1');
                } catch {
                    // ignore
                }
            }

            if (needNav) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        replaceAppHash(targetHash);
                    });
                });
            }
        } finally {
            setPairInviteRespondBusy(false);
        }
    };

    return (
        <>
            {incomingPairPartnerInvite && currentUserWithStatus && (
                <PairIncomingPartnerInviteModal
                    invite={incomingPairPartnerInvite}
                    room={incomingInvitePairRoom}
                    isBusy={pairInviteRespondBusy}
                    onAccept={() =>
                        void respondIncomingPairInvite(
                            incomingPairPartnerInvite.id,
                            true,
                            incomingPairPartnerInvite.roomId,
                        )
                    }
                    onDecline={() => void respondIncomingPairInvite(incomingPairPartnerInvite.id, false)}
                />
            )}
            {modals.isSettingsModalOpen && !mobileViewportActive('settings') && (
                <SettingsModal onClose={handlers.closeSettingsModal} isTopmost={topmostModalId === 'settings'} />
            )}
            {modals.isPetManagementModalOpen && modals.activeQuickUtilityPanel !== 'pet' && (
                <PetManagementModal onClose={handlers.closePetManagementModal} isTopmost={topmostModalId === 'petManagement'} />
            )}
            {modals.isAdventureMonsterCodexModalOpen && modals.activeQuickUtilityPanel !== 'monsterCodex' && (
                <AdventureMonsterCodexModal
                    onClose={handlers.closeAdventureMonsterCodexModal}
                    isTopmost={topmostModalId === 'adventureMonsterCodex'}
                />
            )}
            {modals.isTrainingQuestModalOpen && modals.activeQuickUtilityPanel !== 'trainingQuest' && currentUserWithStatus && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <TrainingQuestModal
                        open
                        currentUser={currentUserWithStatus}
                        onClose={handlers.closeTrainingQuest}
                    />
                </Suspense>
            )}
            {modals.detailedStatsType && modals.activeQuickUtilityPanel !== 'detailedStats' && currentUserWithStatus && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <DetailedStatsModal
                        currentUser={currentUserWithStatus}
                        statsType={modals.detailedStatsType}
                        onClose={handlers.closeDetailedStats}
                        onAction={handlers.handleAction}
                    />
                </Suspense>
            )}
            {modals.isInventoryOpen && !inlineQuickUtilityActive && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <InventoryModal currentUser={currentUserWithStatus} onClose={handlers.closeInventory} onAction={handlers.handleAction} onStartEnhance={handlers.openEnhancingItem} onOpenBlacksmithTab={handlers.openBlacksmithTabFromInventory} enhancementAnimationTarget={modals.enhancementAnimationTarget} onAnimationComplete={handlers.clearEnhancementAnimation} isTopmost={topmostModalId === 'inventory'} />
                </Suspense>
            )}
            {modals.isMailboxOpen && !mobileViewportActive('mailbox') && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <MailboxModal currentUser={currentUserWithStatus} onClose={handlers.closeMailbox} onAction={handlers.handleAction} isTopmost={topmostModalId === 'mailbox'} />
                </Suspense>
            )}
            {modals.isQuestsOpen && !inlineQuickUtilityActive && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <QuestsModal currentUser={currentUserWithStatus} onClose={handlers.closeQuests} onAction={handlers.handleAction} isTopmost={topmostModalId === 'quests'} />
                </Suspense>
            )}
            {modals.rewardSummary && <RewardSummaryModal summary={modals.rewardSummary} onClose={handlers.closeRewardSummary} isTopmost={topmostModalId === 'rewardSummary'} />}
            {modals.isClaimAllSummaryOpen && modals.claimAllSummary && <ClaimAllSummaryModal summary={modals.claimAllSummary} onClose={handlers.closeClaimAllSummary} isTopmost={topmostModalId === 'claimAllSummary'} />}
            {modals.isShopOpen && !inlineQuickUtilityActive && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <ShopModal currentUser={currentUserWithStatus} onClose={handlers.closeShop} onAction={handlers.handleAction} isTopmost={topmostModalId === 'shop'} initialTab={modals.shopInitialTab} />
                </Suspense>
            )}
            {modals.isExchangeOpen && !inlineQuickUtilityActive && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <ExchangeModal
                        currentUser={currentUserWithStatus}
                        allUsers={allUsers}
                        onClose={handlers.closeExchange}
                        onAction={handlers.handleAction}
                        isTopmost={topmostModalId === 'exchange'}
                        onViewListedEquipment={(item, isOwned) =>
                            handlers.openViewingItem(item, isOwned ?? true, { hideEnhanceActions: true })
                        }
                    />
                </Suspense>
            )}
            {modals.isActionPointModalOpen && !mobileViewportActive('actionPoint') && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <ActionPointModal
                        currentUser={currentUserWithStatus}
                        onClose={handlers.closeActionPointModal}
                        onAction={handlers.handleAction}
                        isTopmost={topmostModalId === 'actionPoint'}
                    />
                </Suspense>
            )}
            {hasItemObtainedResult && modals.lastUsedItemResult!.length === 1 && <ItemObtainedModal item={modals.lastUsedItemResult![0]} onClose={handlers.closeItemObtained} isTopmost={topmostModalId === 'itemObtained'} />}
            {hasItemObtainedResult && modals.lastUsedItemResult!.length > 1 && <BulkItemObtainedModal items={modals.lastUsedItemResult!} onClose={handlers.closeItemObtained} isTopmost={topmostModalId === 'itemObtained'} tournamentScoreChange={modals.tournamentScoreChange} />}
            {hasScoreOnlyItemObtained && <BulkItemObtainedModal items={[]} onClose={handlers.closeItemObtained} isTopmost={topmostModalId === 'itemObtained'} tournamentScoreChange={modals.tournamentScoreChange} />}
            {modals.pairPetDetailModal && (
                <PairPetObtainedModal
                    currentUser={currentUserWithStatus}
                    item={modals.pairPetDetailModal.item}
                    mode={modals.pairPetDetailModal.mode}
                    onClose={handlers.closePairPetDetailModal}
                    isTopmost={topmostModalId === 'pairPetDetail'}
                />
            )}
            {modals.disassemblyResult && <DisassemblyResultModal result={modals.disassemblyResult} onClose={handlers.closeDisassemblyResult} isTopmost={topmostModalId === 'disassemblyResult'} isOpen={true} />}
            {modals.craftResult && <CraftingResultModal result={modals.craftResult} onClose={handlers.closeCraftResult} isTopmost={topmostModalId === 'craftResult'} />}
            {modals.viewingUser && !mobileViewportActive('userProfile') && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <UserProfileModal user={modals.viewingUser} onClose={handlers.closeViewingUser} onViewItem={handlers.openViewingItem} isTopmost={topmostModalId === 'viewingUser'} />
                </Suspense>
            )}
            {modals.isInfoModalOpen && modals.activeQuickUtilityPanel !== 'help' && (
                <InfoModal onClose={handlers.closeInfoModal} isTopmost={topmostModalId === 'infoModal'} />
            )}
            {modals.isAnnouncementsModalOpen && modals.activeQuickUtilityPanel !== 'announcements' && (
                <div
                    className="sudamr-modal-overlay z-[230]"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="announcements-board-shell-title"
                    onClick={handlers.closeAnnouncementsModal}
                >
                    <div
                        className="sudamr-modal-panel flex h-[min(90vh,820px)] w-[min(96vw,1080px)] max-w-none flex-col overflow-hidden p-0 ring-1 ring-amber-400/25"
                        onClick={e => e.stopPropagation()}
                    >
                        <HomeBoardPanel
                            posts={homeBoardPosts}
                            unreadPostIds={unreadHomeBoardPostIds}
                            onPostRead={handlers.markHomeBoardPostRead}
                            isAdmin={Boolean(currentUserWithStatus?.isAdmin)}
                            onAction={handlers.handleAction}
                            modalMode
                            onClose={handlers.closeAnnouncementsModal}
                        />
                    </div>
                </div>
            )}
            {modals.isRankingQuickModalOpen && modals.activeQuickUtilityPanel !== 'ranking' && (
                <RankingQuickModal onClose={handlers.closeRankingQuickModal} isTopmost={topmostModalId === 'rankingQuickModal'} />
            )}
            {modals.isChatQuickModalOpen && !mobileViewportActive('chatQuick') && (
                <ChatQuickModal
                    messages={mergedPublicChatMessages}
                    onAction={handlers.handleAction}
                    onViewUser={handlers.openViewingUser}
                    onClose={handlers.closeChatQuickModal}
                    isTopmost={topmostModalId === 'chatQuickModal'}
                />
            )}
            {modals.isInsufficientActionPointsModalOpen && (
                <InsufficientActionPointsModal
                    onClose={handlers.closeInsufficientActionPointsModal}
                    onOpenShopConsumables={() => {
                        handlers.closeInsufficientActionPointsModal();
                        handlers.openShop('consumables', { modal: true });
                    }}
                    onOpenDiamondRecharge={() => {
                        handlers.closeInsufficientActionPointsModal();
                        handlers.openActionPointModal();
                    }}
                    isTopmost={topmostModalId === 'insufficientActionPoints'}
                />
            )}
            {modals.isOpponentInsufficientActionPointsModalOpen && (
                <OpponentInsufficientActionPointsModal
                    onClose={handlers.closeOpponentInsufficientActionPointsModal}
                    isTopmost={topmostModalId === 'opponentInsufficientActionPoints'}
                />
            )}
            {modals.isEncyclopediaOpen && modals.activeQuickUtilityPanel !== 'encyclopedia' && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <EncyclopediaModal onClose={handlers.closeEncyclopedia} isTopmost={topmostModalId === 'encyclopedia'} />
                </Suspense>
            )}
            {modals.isStatAllocationModalOpen && !mobileViewportActive('statAllocation') && (
                <StatAllocationModal currentUser={currentUserWithStatus} onClose={handlers.closeStatAllocationModal} onAction={handlers.handleAction} isTopmost={topmostModalId === 'statAllocation'} />
            )}
            {modals.isProfileEditModalOpen && !mobileViewportActive('profileEdit') && (
                <ProfileEditModal currentUser={currentUserWithStatus} onClose={handlers.closeProfileEditModal} onAction={handlers.handleAction} isTopmost={topmostModalId === 'profileEdit'} />
            )}
            {modals.pastRankingsInfo && !mobileViewportActive('pastRankings') && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <PastRankingsModal info={modals.pastRankingsInfo} onClose={handlers.closePastRankings} isTopmost={topmostModalId === 'pastRankings'} />
                </Suspense>
            )}
            {modals.moderatingUser && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <AdminModerationModal user={modals.moderatingUser} currentUser={currentUserWithStatus} onClose={handlers.closeModerationModal} onAction={handlers.handleAction} isTopmost={topmostModalId === 'moderatingUser'} />
                </Suspense>
            )}
            {modals.viewingItem && (
                <ItemDetailModal
                    item={modals.viewingItem.item}
                    isOwnedByCurrentUser={modals.viewingItem.isOwnedByCurrentUser}
                    hideEnhanceActions={Boolean(modals.viewingItem.hideEnhanceActions)}
                    onClose={handlers.closeViewingItem}
                    onStartEnhance={handlers.openEnhancementFromDetail}
                    onStartRefine={handlers.openRefinementFromDetail}
                    isTopmost={topmostModalId === 'viewingItem'}
                />
            )}
            {activeNegotiation && currentUserWithStatus && (
                <NegotiationModal
                    negotiation={activeNegotiation}
                    currentUser={currentUserWithStatus}
                    onAction={handlers.handleAction}
                    onlineUsers={onlineUsers}
                    isTopmost={topmostModalId === 'negotiation'}
                />
            )}
            {modals.isMbtiInfoModalOpen && <MbtiInfoModal onClose={handlers.closeMbtiInfoModal} isTopmost={topmostModalId === 'mbtiInfo'} />}
            {modals.mutualDisconnectMessage && (
                <div className="sudamr-modal-overlay z-[200]" role="dialog" aria-modal="true" aria-labelledby="mutual-disconnect-title">
                    <div
                        className={`sudamr-modal-panel mx-4 flex w-full max-w-md flex-col overflow-hidden shadow-2xl ${
                            isMobileModalChrome ? 'mx-auto max-w-[calc(100vw-24px)] p-0' : 'p-6 text-center'
                        }`}
                        style={
                            isNativeMobile
                                ? {
                                      maxWidth: `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - max(8px, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px) + 8px)))`,
                                      maxHeight: `min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, calc(100dvh - 32px))`,
                                  }
                                : undefined
                        }
                    >
                        {isMobileModalChrome && (
                            <MobileModalTitleBar
                                title="대국 종료 안내"
                                titleId="mutual-disconnect-title"
                                onClose={handlers.closeMutualDisconnectModal}
                            />
                        )}
                        <div className={isMobileModalChrome ? 'p-4 text-center sm:p-6' : undefined}>
                            {!isMobileModalChrome && (
                                <h2 id="mutual-disconnect-title" className="mb-3 text-lg font-bold tracking-tight text-primary">
                                    대국 종료 안내
                                </h2>
                            )}
                            <p className="mb-6 text-sm leading-relaxed text-secondary">{modals.mutualDisconnectMessage}</p>
                            <button type="button" onClick={handlers.closeMutualDisconnectModal} className="rounded-xl border border-white/15 bg-gradient-to-b from-secondary/90 to-tertiary px-8 py-2.5 text-sm font-semibold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition hover:brightness-110">확인</button>
                        </div>
                    </div>
                </div>
            )}
            {modals.showOtherDeviceLoginModal && (
                <div className="sudamr-modal-overlay z-[200]" role="dialog" aria-modal="true" aria-labelledby="other-device-login-title">
                    <div
                        className={`sudamr-modal-panel mx-4 flex w-full max-w-md flex-col overflow-hidden shadow-2xl ${
                            isMobileModalChrome ? 'mx-auto max-w-[calc(100vw-24px)] p-0' : 'p-6 text-center'
                        }`}
                        style={
                            isNativeMobile
                                ? {
                                      maxWidth: `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - max(8px, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px) + 8px)))`,
                                      maxHeight: `min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, calc(100dvh - 32px))`,
                                  }
                                : undefined
                        }
                    >
                        {isMobileModalChrome && (
                            <MobileModalTitleBar
                                title="로그아웃 안내"
                                titleId="other-device-login-title"
                                onClose={handlers.confirmOtherDeviceLoginAndLogout}
                            />
                        )}
                        <div className={isMobileModalChrome ? 'p-4 text-center sm:p-6' : undefined}>
                            {!isMobileModalChrome && (
                                <h2 id="other-device-login-title" className="mb-3 text-lg font-bold tracking-tight text-primary">
                                    로그아웃 안내
                                </h2>
                            )}
                            <p className="mb-6 text-sm leading-relaxed text-secondary">
                                <span className="block">다른 곳에서 로그인 되었습니다.</span>
                                <span className="block">로그아웃 됩니다.</span>
                            </p>
                            <button
                                type="button"
                                onClick={handlers.confirmOtherDeviceLoginAndLogout}
                                className="rounded-xl border border-red-400/45 bg-gradient-to-r from-red-500/95 via-rose-600/95 to-red-700/95 px-8 py-2.5 text-sm font-bold text-white shadow-[0_16px_34px_-20px_rgba(248,113,113,0.85)] transition hover:brightness-110"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {modals.isBlacksmithModalOpen && !inlineQuickUtilityActive && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <BlacksmithModal
                        onClose={handlers.closeBlacksmithModal}
                        isTopmost={topmostModalId === 'blacksmith'}
                        selectedItemForEnhancement={modals.blacksmithSelectedItemForEnhancement}
                        activeTab={modals.blacksmithActiveTab}
                        onSetActiveTab={handlers.setBlacksmithActiveTab}
                        enhancementOutcome={enhancementOutcome}
                    />
                </Suspense>
            )}
            {modals.combinationResult && <CombinationResultModal result={modals.combinationResult} onClose={handlers.closeCombinationResult} isTopmost={topmostModalId === 'combinationResult'} />}
            {modals.isBlacksmithEffectsModalOpen && currentUserWithStatus && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <BlacksmithEffectsModal
                        onClose={handlers.closeBlacksmithEffectsModal}
                        isTopmost={topmostModalId === 'blacksmithEffects'}
                        blacksmithLevel={currentUserWithStatus.blacksmithLevel ?? 1}
                        currentUser={currentUserWithStatus}
                    />
                </Suspense>
            )}
            {modals.isEnhancementResultModalOpen && enhancementOutcome && <EnhancementResultModal result={enhancementOutcome} onClose={handlers.closeEnhancementModal} isTopmost={topmostModalId === 'enhancementResult'} />}
            {modals.isClaimAllSummaryOpen && modals.claimAllSummary && <ClaimAllSummaryModal summary={modals.claimAllSummary} onClose={handlers.closeClaimAllSummary} isTopmost={topmostModalId === 'claimAllSummary'} />}
            {modals.isEquipmentEffectsModalOpen && !mobileViewportActive('equipmentEffects') && (
                <EquipmentEffectsModal onClose={handlers.closeEquipmentEffectsModal} isTopmost={topmostModalId === 'equipmentEffects'} mainOptionBonuses={mainOptionBonuses} combatSubOptionBonuses={combatSubOptionBonuses} specialStatBonuses={specialStatBonuses} aggregatedMythicStats={aggregatedMythicStats} />
            )}
            {modals.isGameRecordListOpen && modals.activeQuickUtilityPanel !== 'gameRecords' && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <GameRecordListModal
                        currentUser={currentUserWithStatus}
                        onClose={handlers.closeGameRecordList}
                        onAction={handlers.handleAction}
                        isTopmost={topmostModalId === 'gameRecordList'}
                    />
                </Suspense>
            )}
            {modals.viewingGameRecord &&
                modals.activeQuickUtilityPanel !== 'gameRecords' &&
                !mobileViewportActive('gameRecordViewer') && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <GameRecordViewerModal
                        record={modals.viewingGameRecord}
                        onClose={handlers.closeGameRecordViewer}
                        isTopmost={topmostModalId === 'gameRecordViewer'}
                    />
                </Suspense>
            )}
            {modals.levelUpCelebration && (
                <LevelUpCelebrationModal
                    user={currentUserWithStatus}
                    payload={modals.levelUpCelebration}
                    onClose={handlers.closeLevelUpCelebration}
                />
            )}
            {modals.mannerGradeChange && (
                <MannerGradeChangeModal
                    user={currentUserWithStatus}
                    payload={modals.mannerGradeChange}
                    onClose={handlers.closeMannerGradeChange}
                    isTopmost={topmostModalId === 'mannerGradeChange'}
                />
            )}
            {modals.contentUnlockNotice && (
                <ContentUnlockNoticeModal
                    unlockType={modals.contentUnlockNotice}
                    onClose={handlers.closeContentUnlockNotice}
                    isTopmost={topmostModalId === 'contentUnlockNotice'}
                />
            )}
            {modals.adminGameResultDemoSession && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <GameSummaryModal
                        session={modals.adminGameResultDemoSession}
                        currentUser={currentUserWithStatus}
                        onConfirm={handlers.closeAdminGameResultDemoModal}
                        onAction={handlers.handleAction}
                        onOpenGameRecordList={handlers.openGameRecordList}
                    />
                </Suspense>
            )}
        </>
    );
};

export default AppModalLayer;
