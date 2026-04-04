import React, { useMemo, Suspense, lazy } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import {
    NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH,
    NATIVE_MOBILE_MODAL_MAX_WIDTH_VW,
    NATIVE_MOBILE_MODAL_MAX_WIDTH_PX,
} from '../constants/ads.js';
import NegotiationModal from './NegotiationModal.js';
import ChallengeReceivedModal from './ChallengeReceivedModal.js';

const InventoryModal = lazy(() => import('./InventoryModal.js'));
const MailboxModal = lazy(() => import('./MailboxModal.js'));
const QuestsModal = lazy(() => import('./QuestsModal.js'));
const ShopModal = lazy(() => import('./ShopModal.js'));
const ActionPointModal = lazy(() => import('./ActionPointModal.js'));
const UserProfileModal = lazy(() => import('./UserProfileModal.js'));
const EncyclopediaModal = lazy(() => import('./modals/EncyclopediaModal.js'));
const PastRankingsModal = lazy(() => import('./modals/PastRankingsModal.js'));
const AdminModerationModal = lazy(() => import('./AdminModerationModal.js'));
const BlacksmithModal = lazy(() => import('./BlacksmithModal.js'));
const BlacksmithHelpModal = lazy(() => import('./blacksmith/BlacksmithHelpModal.js'));
const BlacksmithEffectsModal = lazy(() => import('./blacksmith/BlacksmithEffectsModal.js'));
const GameRecordListModal = lazy(() => import('./GameRecordListModal.js'));
const GameRecordViewerModal = lazy(() => import('./GameRecordViewerModal.js'));
import InfoModal from './InfoModal.js';
import DisassemblyResultModal from './DisassemblyResultModal.js';
import StatAllocationModal from './StatAllocationModal.js';
import ItemDetailModal from './ItemDetailModal.js';
import ProfileEditModal from './ProfileEditModal.js';
import ItemObtainedModal from './ItemObtainedModal.js';
import BulkItemObtainedModal from './BulkItemObtainedModal.js';
import RewardSummaryModal from './RewardSummaryModal.js';
import CraftingResultModal from './CraftingResultModal.js';
import SettingsModal from './SettingsModal.js';
import ClaimAllSummaryModal from './ClaimAllSummaryModal.js';
import MbtiInfoModal from './MbtiInfoModal.js';
import CombinationResultModal from './blacksmith/CombinationResultModal.js';
import EquipmentEffectsModal from './EquipmentEffectsModal.js';
import EnhancementResultModal from './modals/EnhancementResultModal.js';
import InsufficientActionPointsModal from './InsufficientActionPointsModal.js';
import OpponentInsufficientActionPointsModal from './OpponentInsufficientActionPointsModal.js';

const ModalLoadingFallback = () => null;

const AppModalLayer: React.FC = () => {
    const { isNativeMobile } = useNativeMobileShell();
    const {
        currentUserWithStatus,
        activeNegotiation,
        modals,
        handlers,
        onlineUsers,
        enhancementOutcome,
        mainOptionBonuses,
        combatSubOptionBonuses,
        specialStatBonuses,
        aggregatedMythicStats,
    } = useAppContext();

    const activeModalIds = useMemo(() => {
        const ids: string[] = [];
        if (activeNegotiation) ids.push('negotiation');
        if (modals.isSettingsModalOpen) ids.push('settings');
        if (modals.isInventoryOpen) ids.push('inventory');
        if (modals.isMailboxOpen) ids.push('mailbox');
        if (modals.isQuestsOpen) ids.push('quests');
        if (modals.rewardSummary) ids.push('rewardSummary');
        if (modals.isClaimAllSummaryOpen) ids.push('claimAllSummary');
        if (modals.isShopOpen) ids.push('shop');
        if (modals.isActionPointModalOpen) ids.push('actionPoint');
        if (modals.viewingUser) ids.push('viewingUser');
        if (modals.isInfoModalOpen) ids.push('infoModal');
        if (modals.isEncyclopediaOpen) ids.push('encyclopedia');
        if (modals.isStatAllocationModalOpen) ids.push('statAllocation');
        if (modals.isProfileEditModalOpen) ids.push('profileEdit');
        if (modals.pastRankingsInfo) ids.push('pastRankings');
        if (modals.moderatingUser) ids.push('moderatingUser');
        if (modals.viewingItem) ids.push('viewingItem');
        if (modals.enhancingItem) ids.push('enhancingItem');
        if (modals.isBlacksmithModalOpen) ids.push('blacksmith');
        if (modals.isBlacksmithEffectsModalOpen) ids.push('blacksmithEffects');
        if (modals.isBlacksmithHelpOpen) ids.push('blacksmithHelp');
        if (modals.isGameRecordListOpen) ids.push('gameRecordList');
        if (modals.viewingGameRecord) ids.push('gameRecordViewer');
        if (modals.combinationResult) ids.push('combinationResult');
        if (modals.disassemblyResult) ids.push('disassemblyResult');
        if (modals.craftResult) ids.push('craftResult');
        if (modals.isEnhancementResultModalOpen) ids.push('enhancementResult');
        if (modals.isMbtiInfoModalOpen) ids.push('mbtiInfo');
        if (modals.mutualDisconnectMessage) ids.push('mutualDisconnect');
        if (modals.showOtherDeviceLoginModal) ids.push('otherDeviceLogin');
        if (modals.isInsufficientActionPointsModalOpen) ids.push('insufficientActionPoints');
        if (modals.isOpponentInsufficientActionPointsModalOpen) ids.push('opponentInsufficientActionPoints');
        if (modals.lastUsedItemResult) ids.push('itemObtained');
        return ids;
    }, [modals, activeNegotiation]);

    const topmostModalId = activeModalIds.length > 0 ? activeModalIds[activeModalIds.length - 1] : null;

    if (!currentUserWithStatus) return null;

    return (
        <>
            {modals.isSettingsModalOpen && <SettingsModal onClose={handlers.closeSettingsModal} isTopmost={topmostModalId === 'settings'} />}
            {modals.isInventoryOpen && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <InventoryModal currentUser={currentUserWithStatus} onClose={handlers.closeInventory} onAction={handlers.handleAction} onStartEnhance={handlers.openEnhancingItem} enhancementAnimationTarget={modals.enhancementAnimationTarget} onAnimationComplete={handlers.clearEnhancementAnimation} isTopmost={topmostModalId === 'inventory'} />
                </Suspense>
            )}
            {modals.isMailboxOpen && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <MailboxModal currentUser={currentUserWithStatus} onClose={handlers.closeMailbox} onAction={handlers.handleAction} isTopmost={topmostModalId === 'mailbox'} />
                </Suspense>
            )}
            {modals.isQuestsOpen && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <QuestsModal currentUser={currentUserWithStatus} onClose={handlers.closeQuests} onAction={handlers.handleAction} isTopmost={topmostModalId === 'quests'} />
                </Suspense>
            )}
            {modals.rewardSummary && <RewardSummaryModal summary={modals.rewardSummary} onClose={handlers.closeRewardSummary} isTopmost={topmostModalId === 'rewardSummary'} />}
            {modals.isClaimAllSummaryOpen && modals.claimAllSummary && <ClaimAllSummaryModal summary={modals.claimAllSummary} onClose={handlers.closeClaimAllSummary} isTopmost={topmostModalId === 'claimAllSummary'} />}
            {modals.isShopOpen && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <ShopModal currentUser={currentUserWithStatus} onClose={handlers.closeShop} onAction={handlers.handleAction} isTopmost={topmostModalId === 'shop'} initialTab={modals.shopInitialTab} />
                </Suspense>
            )}
            {modals.isActionPointModalOpen && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <ActionPointModal
                        currentUser={currentUserWithStatus}
                        onClose={handlers.closeActionPointModal}
                        onAction={handlers.handleAction}
                        isTopmost={topmostModalId === 'actionPoint'}
                    />
                </Suspense>
            )}
            {modals.lastUsedItemResult && modals.lastUsedItemResult.length === 1 && <ItemObtainedModal item={modals.lastUsedItemResult[0]} onClose={handlers.closeItemObtained} isTopmost={topmostModalId === 'itemObtained'} />}
            {modals.lastUsedItemResult && modals.lastUsedItemResult.length > 1 && <BulkItemObtainedModal items={modals.lastUsedItemResult} onClose={handlers.closeItemObtained} isTopmost={topmostModalId === 'itemObtained'} tournamentScoreChange={modals.tournamentScoreChange} />}
            {modals.tournamentScoreChange && !modals.lastUsedItemResult && <BulkItemObtainedModal items={[]} onClose={handlers.closeItemObtained} isTopmost={topmostModalId === 'itemObtained'} tournamentScoreChange={modals.tournamentScoreChange} />}
            {modals.disassemblyResult && <DisassemblyResultModal result={modals.disassemblyResult} onClose={handlers.closeDisassemblyResult} isTopmost={topmostModalId === 'disassemblyResult'} isOpen={true} />}
            {modals.craftResult && <CraftingResultModal result={modals.craftResult} onClose={handlers.closeCraftResult} isTopmost={topmostModalId === 'craftResult'} />}
            {modals.viewingUser && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <UserProfileModal user={modals.viewingUser} onClose={handlers.closeViewingUser} onViewItem={handlers.openViewingItem} isTopmost={topmostModalId === 'viewingUser'} />
                </Suspense>
            )}
            {modals.isInfoModalOpen && <InfoModal onClose={handlers.closeInfoModal} isTopmost={topmostModalId === 'infoModal'} />}
            {modals.isInsufficientActionPointsModalOpen && (
                <InsufficientActionPointsModal
                    onClose={handlers.closeInsufficientActionPointsModal}
                    onOpenShopConsumables={() => {
                        handlers.closeInsufficientActionPointsModal();
                        handlers.openShop('consumables');
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
            {modals.isEncyclopediaOpen && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <EncyclopediaModal onClose={handlers.closeEncyclopedia} isTopmost={topmostModalId === 'encyclopedia'} />
                </Suspense>
            )}
            {modals.isStatAllocationModalOpen && <StatAllocationModal currentUser={currentUserWithStatus} onClose={handlers.closeStatAllocationModal} onAction={handlers.handleAction} isTopmost={topmostModalId === 'statAllocation'} />}
            {modals.isProfileEditModalOpen && <ProfileEditModal currentUser={currentUserWithStatus} onClose={handlers.closeProfileEditModal} onAction={handlers.handleAction} isTopmost={topmostModalId === 'profileEdit'} />}
            {modals.pastRankingsInfo && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <PastRankingsModal info={modals.pastRankingsInfo} onClose={handlers.closePastRankings} isTopmost={topmostModalId === 'pastRankings'} />
                </Suspense>
            )}
            {modals.moderatingUser && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <AdminModerationModal user={modals.moderatingUser} currentUser={currentUserWithStatus} onClose={handlers.closeModerationModal} onAction={handlers.handleAction} isTopmost={topmostModalId === 'moderatingUser'} />
                </Suspense>
            )}
            {modals.viewingItem && <ItemDetailModal item={modals.viewingItem.item} isOwnedByCurrentUser={modals.viewingItem.isOwnedByCurrentUser} onClose={handlers.closeViewingItem} onStartEnhance={handlers.openEnhancementFromDetail} onStartRefine={handlers.openRefinementFromDetail} isTopmost={topmostModalId === 'viewingItem'} />}
            {activeNegotiation && (() => {
                const isReceivedChallenge = activeNegotiation.status === 'pending' &&
                    (activeNegotiation.opponent.id === currentUserWithStatus.id &&
                        activeNegotiation.proposerId === activeNegotiation.opponent.id);
                const isChallengerOwnsModal =
                    activeNegotiation.challenger.id === currentUserWithStatus.id &&
                    (activeNegotiation.status === 'draft' || activeNegotiation.status === 'pending');
                if (isChallengerOwnsModal) return null;
                if (isReceivedChallenge) {
                    return (
                        <ChallengeReceivedModal
                            negotiation={activeNegotiation}
                            currentUser={currentUserWithStatus}
                            onAccept={(settings) => {
                                handlers.handleAction({
                                    type: 'ACCEPT_NEGOTIATION',
                                    payload: { negotiationId: activeNegotiation.id, settings },
                                });
                            }}
                            onDecline={() => {
                                handlers.handleAction({
                                    type: 'DECLINE_NEGOTIATION',
                                    payload: { negotiationId: activeNegotiation.id },
                                });
                            }}
                            onProposeModification={(settings) => {
                                handlers.handleAction({
                                    type: 'UPDATE_NEGOTIATION',
                                    payload: { negotiationId: activeNegotiation.id, settings },
                                });
                            }}
                            onClose={() => {
                                handlers.handleAction({
                                    type: 'DECLINE_NEGOTIATION',
                                    payload: { negotiationId: activeNegotiation.id },
                                });
                            }}
                            onAction={handlers.handleAction}
                        />
                    );
                }
                return (
                    <NegotiationModal
                        negotiation={activeNegotiation}
                        currentUser={currentUserWithStatus}
                        onAction={handlers.handleAction}
                        onlineUsers={onlineUsers}
                        isTopmost={topmostModalId === 'negotiation'}
                    />
                );
            })()}
            {modals.isMbtiInfoModalOpen && <MbtiInfoModal onClose={handlers.closeMbtiInfoModal} isTopmost={topmostModalId === 'mbtiInfo'} />}
            {modals.mutualDisconnectMessage && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="mutual-disconnect-title">
                    <div
                        className={`bg-panel border border-color rounded-xl p-6 text-center shadow-2xl ${isNativeMobile ? 'mx-auto w-max max-w-[calc(100vw-24px)]' : 'mx-4 w-full max-w-md'}`}
                        style={
                            isNativeMobile
                                ? {
                                      maxWidth: `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - 24px), ${NATIVE_MOBILE_MODAL_MAX_WIDTH_PX}px)`,
                                      maxHeight: `min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, calc(100dvh - 32px))`,
                                  }
                                : undefined
                        }
                    >
                        <h2 id="mutual-disconnect-title" className="text-lg font-bold text-on-panel mb-3">대국 종료 안내</h2>
                        <p className="text-on-panel/90 mb-6">{modals.mutualDisconnectMessage}</p>
                        <button type="button" onClick={handlers.closeMutualDisconnectModal} className="px-6 py-2 bg-primary text-tertiary rounded-lg hover:opacity-90 font-medium">확인</button>
                    </div>
                </div>
            )}
            {modals.showOtherDeviceLoginModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="other-device-login-title">
                    <div
                        className={`bg-panel border border-color rounded-xl p-6 text-center shadow-2xl ${isNativeMobile ? 'mx-auto w-max max-w-[calc(100vw-24px)]' : 'mx-4 w-full max-w-md'}`}
                        style={
                            isNativeMobile
                                ? {
                                      maxWidth: `min(${NATIVE_MOBILE_MODAL_MAX_WIDTH_VW}vw, calc(100vw - 24px), ${NATIVE_MOBILE_MODAL_MAX_WIDTH_PX}px)`,
                                      maxHeight: `min(${NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH}dvh, calc(100dvh - 32px))`,
                                  }
                                : undefined
                        }
                    >
                        <h2 id="other-device-login-title" className="text-lg font-bold text-on-panel mb-3">로그아웃 안내</h2>
                        <p className="text-on-panel/90 mb-6">다른 곳에서 로그인 되었습니다. 로그아웃 됩니다.</p>
                        <button type="button" onClick={handlers.confirmOtherDeviceLoginAndLogout} className="px-6 py-2 bg-primary text-tertiary rounded-lg hover:opacity-90 font-medium">확인</button>
                    </div>
                </div>
            )}
            {modals.isBlacksmithModalOpen && (
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
                    />
                </Suspense>
            )}
            {modals.isBlacksmithHelpOpen && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <BlacksmithHelpModal onClose={handlers.closeBlacksmithHelp} isTopmost={topmostModalId === 'blacksmithHelp'} currentUser={currentUserWithStatus} />
                </Suspense>
            )}
            {modals.isEnhancementResultModalOpen && enhancementOutcome && <EnhancementResultModal result={enhancementOutcome} onClose={handlers.closeEnhancementModal} isTopmost={topmostModalId === 'enhancementResult'} />}
            {modals.isClaimAllSummaryOpen && modals.claimAllSummary && <ClaimAllSummaryModal summary={modals.claimAllSummary} onClose={handlers.closeClaimAllSummary} isTopmost={topmostModalId === 'claimAllSummary'} />}
            {modals.isEquipmentEffectsModalOpen && <EquipmentEffectsModal onClose={handlers.closeEquipmentEffectsModal} isTopmost={topmostModalId === 'equipmentEffects'} mainOptionBonuses={mainOptionBonuses} combatSubOptionBonuses={combatSubOptionBonuses} specialStatBonuses={specialStatBonuses} aggregatedMythicStats={aggregatedMythicStats} />}
            {modals.isGameRecordListOpen && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <GameRecordListModal
                        currentUser={currentUserWithStatus}
                        onClose={handlers.closeGameRecordList}
                        onAction={handlers.handleAction}
                        onViewRecord={handlers.openGameRecordViewer}
                        isTopmost={topmostModalId === 'gameRecordList'}
                    />
                </Suspense>
            )}
            {modals.viewingGameRecord && (
                <Suspense fallback={ModalLoadingFallback()}>
                    <GameRecordViewerModal
                        record={modals.viewingGameRecord}
                        onClose={handlers.closeGameRecordViewer}
                        isTopmost={topmostModalId === 'gameRecordViewer'}
                    />
                </Suspense>
            )}
        </>
    );
};

export default AppModalLayer;
