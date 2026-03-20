import React, { useMemo, useState, useEffect, useRef, useLayoutEffect, Suspense, lazy } from 'react';
import Header from './components/Header.js';
import { AppProvider } from './contexts/AppContext.js';
import { useAppContext } from './hooks/useAppContext.js';
import Router from './components/Router.js';
import NegotiationModal from './components/NegotiationModal.js';
import ChallengeReceivedModal from './components/ChallengeReceivedModal.js';
// 큰 모달들은 lazy loading으로 로드
const InventoryModal = lazy(() => import('./components/InventoryModal.js'));
const MailboxModal = lazy(() => import('./components/MailboxModal.js'));
const QuestsModal = lazy(() => import('./components/QuestsModal.js'));
const ShopModal = lazy(() => import('./components/ShopModal.js'));
const ActionPointModal = lazy(() => import('./components/ActionPointModal.js'));
const UserProfileModal = lazy(() => import('./components/UserProfileModal.js'));
const EncyclopediaModal = lazy(() => import('./components/modals/EncyclopediaModal.js'));
const PastRankingsModal = lazy(() => import('./components/modals/PastRankingsModal.js'));
const AdminModerationModal = lazy(() => import('./components/AdminModerationModal.js'));
const BlacksmithModal = lazy(() => import('./components/BlacksmithModal.js'));
const BlacksmithHelpModal = lazy(() => import('./components/blacksmith/BlacksmithHelpModal.js'));
const GameRecordListModal = lazy(() => import('./components/GameRecordListModal.js'));
const GameRecordViewerModal = lazy(() => import('./components/GameRecordViewerModal.js'));
// 작은 모달들은 즉시 로드
import InfoModal from './components/InfoModal.js';
import DisassemblyResultModal from './components/DisassemblyResultModal.js';
import StatAllocationModal from './components/StatAllocationModal.js';
import ItemDetailModal from './components/ItemDetailModal.js';
import ProfileEditModal from './components/ProfileEditModal.js';
import ItemObtainedModal from './components/ItemObtainedModal.js';
import BulkItemObtainedModal from './components/BulkItemObtainedModal.js';
import RewardSummaryModal from './components/RewardSummaryModal.js';
import { preloadImages, ALL_IMAGE_URLS } from './services/assetService.js';
import CraftingResultModal from './components/CraftingResultModal.js';
import { audioService } from './services/audioService.js';
import SettingsModal from './components/SettingsModal.js';
import ClaimAllSummaryModal from './components/ClaimAllSummaryModal.js';
import MbtiInfoModal from './components/MbtiInfoModal.js';
import CombinationResultModal from './components/blacksmith/CombinationResultModal.js';
import EnhancementModal from './components/EnhancementModal';
import EquipmentEffectsModal from './components/EquipmentEffectsModal';
import EnhancementResultModal from './components/modals/EnhancementResultModal.js';
import InsufficientActionPointsModal from './components/InsufficientActionPointsModal.js';
import InstallPrompt from './components/InstallPrompt.js';
import { useIsHandheldDevice } from './hooks/useIsMobileLayout.js';

// Lazy 로드된 모달을 위한 로딩 컴포넌트
const ModalLoadingFallback = () => null;

function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}

// AppContent is the part of the app that can access the context
const AppContent: React.FC = () => {
    const {
        currentUser,
        currentUserWithStatus,
        currentRoute,
        error,
        activeNegotiation,
        modals,
        showExitToast,
        enhancementResult,
        enhancementOutcome,
        handlers,
        onlineUsers,
        hasClaimableQuest,
        settings,
        mainOptionBonuses,
        combatSubOptionBonuses,
        specialStatBonuses,
        aggregatedMythicStats,
    } = useAppContext();
    
    // 에셋 프리로딩은 UX를 위해 백그라운드로 돌리고, 화면을 막지 않도록 함
    const [isPreloading, setIsPreloading] = useState(false);
    const [showQuestToast, setShowQuestToast] = useState(false);
    
    const prevHasClaimableQuest = usePrevious(hasClaimableQuest);

    useEffect(() => {
        if (settings.features.questNotifications && hasClaimableQuest && !prevHasClaimableQuest) {
            setShowQuestToast(true);
            const timer = setTimeout(() => setShowQuestToast(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [hasClaimableQuest, prevHasClaimableQuest, settings.features.questNotifications]);

    useEffect(() => {
        if (showQuestToast) {
            const timer = setTimeout(() => setShowQuestToast(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showQuestToast]);


    useEffect(() => {
        const initAudio = () => {
            audioService.initialize();
            // 모든 이벤트 리스너 제거
            document.removeEventListener('pointerdown', initAudio);
            document.removeEventListener('touchstart', initAudio);
            document.removeEventListener('click', initAudio);
            document.removeEventListener('touchend', initAudio);
        };
        
        // 모바일 환경을 위한 여러 이벤트 타입 지원
        document.addEventListener('pointerdown', initAudio);
        document.addEventListener('touchstart', initAudio);
        document.addEventListener('click', initAudio);
        document.addEventListener('touchend', initAudio);

        return () => {
            document.removeEventListener('pointerdown', initAudio);
            document.removeEventListener('touchstart', initAudio);
            document.removeEventListener('click', initAudio);
            document.removeEventListener('touchend', initAudio);
        };
    }, []);

    useEffect(() => {
        if (currentUser) {
            // 우선순위가 높은 이미지들만 먼저 로드 (UI에 즉시 필요한 것들)
            // 나머지는 백그라운드에서 점진적으로 로드
            let cancelled = false;

            // 프리로딩이 오래 걸릴 때만 표시 (짧은 로드는 표시하지 않음)
            const showTimer = setTimeout(() => {
                if (!cancelled) setIsPreloading(true);
            }, 500);

            preloadImages(ALL_IMAGE_URLS, { priority: 'low', batchSize: 15 })
                .catch(() => {
                    // 프리로딩 실패는 치명적이지 않음 (이미지는 필요 시 로드됨)
                })
                .finally(() => {
                    if (cancelled) return;
                    clearTimeout(showTimer);
                    setIsPreloading(false);
                });

            return () => {
                cancelled = true;
                clearTimeout(showTimer);
            };
        } else {
            setIsPreloading(false);
        }
    }, [currentUser]);

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
        if (modals.isBlacksmithHelpOpen) ids.push('blacksmithHelp');
        if (modals.isGameRecordListOpen) ids.push('gameRecordList');
        if (modals.viewingGameRecord) ids.push('gameRecordViewer');
        // 결과 모달들은 대장간보다 뒤에 추가하여 항상 위에 표시
        if (modals.combinationResult) ids.push('combinationResult');
        if (modals.disassemblyResult) ids.push('disassemblyResult');
        if (modals.craftResult) ids.push('craftResult');
        if (modals.isEnhancementResultModalOpen) ids.push('enhancementResult');
        if (modals.isMbtiInfoModalOpen) ids.push('mbtiInfo');
        if (modals.mutualDisconnectMessage) ids.push('mutualDisconnect');
        if (modals.showOtherDeviceLoginModal) ids.push('otherDeviceLogin');
        if (modals.isInsufficientActionPointsModalOpen) ids.push('insufficientActionPoints');
        // itemObtained은 항상 마지막에 추가하여 최상단에 표시
        if (modals.lastUsedItemResult) ids.push('itemObtained');
        return ids;
    }, [modals, activeNegotiation]);

    const topmostModalId = activeModalIds.length > 0 ? activeModalIds[activeModalIds.length - 1] : null;
    
    const isGameView = currentRoute.view === 'game';
    const backgroundClass = currentUser ? 'bg-primary' : 'bg-login-background';

    const isHandheld = useIsHandheldDevice(1025);

    // 전체 화면을 하나의 그림처럼 동일 비율로 스케일 (고정 캔버스 1920x1080 → 컨테이너에 맞춤)
    const DESIGN_W = 1920;
    const DESIGN_H = 1080;
    const getInitialScale = () => {
        if (typeof window === 'undefined') return 1;
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (w <= 0 || h <= 0) return 1;
        const byWidth = w / DESIGN_W;
        const byHeight = h / DESIGN_H;
        return Math.min(byWidth, byHeight, 1);
    };
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(getInitialScale);
    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const updateScale = () => {
            const w = el.clientWidth;
            const h = el.clientHeight;
            if (w > 0 && h > 0) setScale(Math.min(w / DESIGN_W, h / DESIGN_H));
        };
        updateScale();
        const ro = new ResizeObserver(updateScale);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // 휴대기기에서는 모든 화면에서 강제 가로 모드(랜드스케이프) 적용
    useEffect(() => {
        if (typeof window === 'undefined' || !isHandheld) return;
        const orient = (window as any).screen?.orientation;
        if (!orient?.lock) return;

        const tryLockLandscape = () => {
            orient.lock('landscape').catch(() => {
                orient.lock('landscape-primary').catch(() => {});
            });
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') tryLockLandscape();
        };

        tryLockLandscape();
        window.addEventListener('orientationchange', tryLockLandscape);
        window.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            window.removeEventListener('orientationchange', tryLockLandscape);
            window.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [isHandheld]);

    return (
        <div className={`font-sans ${backgroundClass} text-primary flex flex-col`} style={{ 
            minHeight: '100%',
            height: '100%',
            width: '100%',
            overflow: 'hidden',
                                    paddingBottom: isHandheld ? 'env(safe-area-inset-bottom, 0px)' : '0px'
        }}>
            {isPreloading && (
                <div className="fixed bottom-4 right-4 z-[100] bg-panel border border-color text-on-panel rounded-lg shadow-xl px-3 py-2 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-sm">에셋 로딩 중...</span>
                </div>
            )}
            {showExitToast && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md z-50 animate-slide-down-fast">
                    <div className="bg-primary border-2 border-color rounded-lg shadow-2xl p-3 text-primary font-semibold text-center">한번 더 뒤로가기를 하면 로그아웃 됩니다.</div>
                </div>
            )}
            
            {/* 전체 앱을 16:9 박스 안에 넣고, 내부는 고정 캔버스(1920x1080)를 scale로 맞춰 “한 장 그림”처럼 동일 비율로 확대/축소 */}
            <div className="flex-1 flex items-center justify-center min-h-0">
                <div
                    ref={containerRef}
                    className="w-full h-full max-w-full max-h-full aspect-[16/9] overflow-hidden relative"
                >
                    <div
                        className="absolute left-0 top-0 flex flex-col"
                        style={{
                            width: DESIGN_W,
                            height: DESIGN_H,
                            transform: `scale(${scale})`,
                            transformOrigin: '0 0',
                        }}
                    >
                        {currentUser && !isGameView && <Header />}
                        {/* 
                           Modals/portals that render into document.body will not be scaled.
                           We provide a dedicated portal target inside the scaled canvas.
                        */}
                        <div
                            id="sudamr-modal-root"
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: DESIGN_W,
                                height: DESIGN_H,
                            }}
                        />
                        
                        {currentUser ? (
                            <main
                                className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden"
                                style={{
                                    flex: '1 1 0',
                                    minHeight: 0,
                                    paddingBottom: isHandheld ? 'max(env(safe-area-inset-bottom, 0px), 20px)' : '0px',
                                    WebkitOverflowScrolling: 'touch',
                                    marginBottom: isHandheld ? 'env(safe-area-inset-bottom, 0px)' : '0px',
                                }}
                            >
                                <Router />
                            </main>
                        ) : (
                            <div className="relative flex flex-1 w-full min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto overflow-x-hidden bg-tertiary bg-[url('/images/bg/loginbg.png')] bg-cover bg-center px-3 py-6 sm:gap-6 sm:px-6 sm:py-8 lg:gap-8 lg:px-10 lg:py-12">
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/82 via-black/65 to-black/78" />
                                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_14%,rgba(180,140,80,0.14),transparent_48%)]" />
                                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_50%_at_50%_92%,rgba(30,58,95,0.18),transparent_52%)]" />
                                {/* 상단 중앙 브랜드 — 모바일은 컴팩트, PC는 비율만 키움 */}
                                <header
                                    className="relative z-10 flex w-full max-w-lg shrink-0 flex-col items-center gap-0.5 px-2 text-center sm:max-w-xl sm:gap-1 lg:max-w-3xl lg:gap-2"
                                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                                >
                                    <p className="text-[8px] font-semibold uppercase tracking-[0.38em] text-amber-400/80 sm:text-[10px] sm:tracking-[0.42em] lg:text-xs lg:tracking-[0.48em]">
                                        Online Strategy
                                    </p>
                                    <h1 className="bg-gradient-to-br from-stone-50 via-amber-100 to-amber-800 bg-clip-text text-2xl font-black uppercase tracking-[0.16em] text-transparent drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)] sm:text-4xl sm:tracking-[0.18em] lg:text-6xl lg:tracking-[0.14em] xl:text-7xl">
                                        SUDAM
                                    </h1>
                                    <p className="text-[9px] font-light tracking-[0.22em] text-stone-400 sm:text-xs sm:tracking-[0.26em] lg:text-base lg:tracking-[0.24em]">
                                        The Ascending Masters
                                    </p>
                                    <div
                                        className="mt-3 hidden h-px w-32 max-w-[80%] bg-gradient-to-r from-transparent via-amber-500/45 to-transparent sm:block lg:mt-5 lg:w-48"
                                        aria-hidden
                                    />
                                    <p className="mt-2 hidden max-w-xl px-2 text-center text-[11px] leading-relaxed text-stone-400 sm:mt-3 sm:block sm:text-xs lg:mt-4 lg:max-w-2xl lg:text-sm">
                                        Supreme Universe of Dueling Ascending Masters (S.U.D.A.M)
                                        <br />
                                        <span className="mt-1 inline-block text-[10px] text-stone-500 lg:text-xs">
                                            격돌하는 초인들이 승천하는 최고의 세계
                                        </span>
                                    </p>
                                </header>
                                <main className="relative z-10 flex w-full min-w-0 max-w-[min(100%,480px)] flex-col items-center justify-center sm:max-w-[520px] lg:max-w-[560px]">
                                    <Router />
                                </main>
                            </div>
                        )}

                        {/* Render modals inside scaled canvas so they scale too */}
                        {currentUserWithStatus && (
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
                                {/* 챔피언십 보상 수령 시 아이템이 없어도 점수 변화가 있으면 모달 표시 */}
                                {modals.tournamentScoreChange && !modals.lastUsedItemResult && <BulkItemObtainedModal items={[]} onClose={handlers.closeItemObtained} isTopmost={topmostModalId === 'itemObtained'} tournamentScoreChange={modals.tournamentScoreChange} />}

                                {modals.disassemblyResult && <DisassemblyResultModal result={modals.disassemblyResult} onClose={handlers.closeDisassemblyResult} isTopmost={topmostModalId === 'disassemblyResult'} isOpen={true} />}
                                {modals.craftResult && (() => {
                                    console.log('[App] Rendering CraftingResultModal:', {
                                        craftResult: modals.craftResult,
                                        topmostModalId,
                                        isTopmost: topmostModalId === 'craftResult'
                                    });
                                    return <CraftingResultModal result={modals.craftResult} onClose={handlers.closeCraftResult} isTopmost={topmostModalId === 'craftResult'} />;
                                })()}
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
                                {modals.viewingItem && <ItemDetailModal item={modals.viewingItem.item} isOwnedByCurrentUser={modals.viewingItem.isOwnedByCurrentUser} onClose={handlers.closeViewingItem} onStartEnhance={handlers.openEnhancementFromDetail} isTopmost={topmostModalId === 'viewingItem'} />}
                                {activeNegotiation && (() => {
                                    const isReceivedChallenge = activeNegotiation.status === 'pending' && 
                                                                 ((activeNegotiation.opponent.id === currentUserWithStatus.id && 
                                                                   activeNegotiation.proposerId === activeNegotiation.opponent.id) ||
                                                                  (activeNegotiation.challenger.id === currentUserWithStatus.id && 
                                                                   activeNegotiation.proposerId === activeNegotiation.challenger.id &&
                                                                   (activeNegotiation.turnCount ?? 0) > 0));
                                    const isChallengerWaiting = activeNegotiation.challenger.id === currentUserWithStatus.id && 
                                                                activeNegotiation.status === 'pending' && 
                                                                activeNegotiation.proposerId === activeNegotiation.opponent.id &&
                                                                activeNegotiation.turnCount === 0;
                                    
                                    if (isChallengerWaiting) {
                                        return null;
                                    }
                                    
                                    if (isReceivedChallenge) {
                                        return (
                                            <ChallengeReceivedModal
                                                negotiation={activeNegotiation}
                                                currentUser={currentUserWithStatus}
                                                onAccept={(settings) => {
                                                    handlers.handleAction({ 
                                                        type: 'ACCEPT_NEGOTIATION', 
                                                        payload: { negotiationId: activeNegotiation.id, settings } 
                                                    });
                                                }}
                                                onDecline={() => {
                                                    handlers.handleAction({ 
                                                        type: 'DECLINE_NEGOTIATION', 
                                                        payload: { negotiationId: activeNegotiation.id } 
                                                    });
                                                }}
                                                onProposeModification={(settings) => {
                                                    handlers.handleAction({ 
                                                        type: 'UPDATE_NEGOTIATION', 
                                                        payload: { negotiationId: activeNegotiation.id, settings } 
                                                    });
                                                }}
                                                onClose={() => {
                                                    handlers.handleAction({ 
                                                        type: 'DECLINE_NEGOTIATION', 
                                                        payload: { negotiationId: activeNegotiation.id } 
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
                                        <div className="bg-panel border border-color rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 text-center">
                                            <h2 id="mutual-disconnect-title" className="text-lg font-bold text-on-panel mb-3">대국 종료 안내</h2>
                                            <p className="text-on-panel/90 mb-6">{modals.mutualDisconnectMessage}</p>
                                            <button type="button" onClick={handlers.closeMutualDisconnectModal} className="px-6 py-2 bg-primary text-tertiary rounded-lg hover:opacity-90 font-medium">확인</button>
                                        </div>
                                    </div>
                                )}
                                {modals.showOtherDeviceLoginModal && (
                                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="other-device-login-title">
                                        <div className="bg-panel border border-color rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 text-center">
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
                                {modals.isBlacksmithHelpOpen && (
                                    <Suspense fallback={ModalLoadingFallback()}>
                                        <BlacksmithHelpModal onClose={handlers.closeBlacksmithHelp} isTopmost={topmostModalId === 'blacksmithHelp'} currentUser={currentUserWithStatus} />
                                    </Suspense>
                                )}
                                {modals.isEnhancementResultModalOpen && enhancementOutcome && <EnhancementResultModal result={enhancementOutcome} onClose={handlers.closeEnhancementModal} isTopmost={topmostModalId === 'enhancementResult'} />}
                                {modals.isClaimAllSummaryOpen && modals.claimAllSummary && <ClaimAllSummaryModal summary={modals.claimAllSummary} onClose={handlers.closeClaimAllSummary} isTopmost={topmostModalId === 'claimAllSummary'} />}
                                {modals.isMbtiInfoModalOpen && <MbtiInfoModal onClose={handlers.closeMbtiInfoModal} isTopmost={topmostModalId === 'mbtiInfo'} />}
                                {modals.isEquipmentEffectsModalOpen && <EquipmentEffectsModal onClose={handlers.closeEquipmentEffectsModal} isTopmost={topmostModalId === 'equipmentEffects'} mainOptionBonuses={mainOptionBonuses} combatSubOptionBonuses={combatSubOptionBonuses} specialStatBonuses={specialStatBonuses} aggregatedMythicStats={aggregatedMythicStats} />}
                                {modals.isGameRecordListOpen && currentUserWithStatus && (
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
                        )}
                        <InstallPrompt />
                    </div>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <div className="app-container">
            <AppProvider>
                <AppContent />
            </AppProvider>
        </div>
    );
};

export default App;