import React, { useState } from 'react';
import { tx } from '../../shared/i18n/runtimeText.js';
import { useTranslation } from 'react-i18next';
import { GameProps, Player, GameMode, Point, AppSettings } from '../../types.js';
import Button from '../Button.js';
import { getSinglePlayerStages } from '../../constants/singlePlayerConstants.js';
import { resolveLiveSessionSinglePlayerStageRow } from '../../shared/utils/liveSessionSinglePlayerStage.js';
import AlertModal from '../AlertModal.js';
import ConfirmModal from '../ConfirmModal.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import { buildPveItemActionClientSync } from '../../utils/pveItemClientSync.js';
import { ArenaControlStrip } from './ArenaControlStrip.js';
import { MoveConfirmFooterSlot } from './MoveConfirmFooterSlot.js';
import {
    arenaPostGameButtonClass,
    arenaPostGameButtonInRowModifier,
    arenaPostGameIngameEndedRowClass,
    arenaPostGamePanelShellClass,
    formatArenaRetryLabel,
    formatSinglePlayerNextFooterLabel,
} from './arenaPostGameButtonStyles.js';
import {
    arenaGameRoomControlsDividerClass,
    arenaGameRoomControlsInnerPanelClass,
    arenaGameRoomIngameBottomBarShellClass,
    arenaGameRoomIngameInnerItemSurfaceClass,
    arenaGameRoomIngameInnerNeutralSurfaceClass,
    pveIngameFooterReservedHeightClass,
} from './arenaGameRoomStyles.js';
import BaseGameFooterPanel, { BasePlacementControlStrip, isBaseGameFooterPhase } from './BaseGameFooterPanel.js';
import { formatGoldAmountKoG } from '../../shared/utils/walletAmountDisplay.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';
import { pairPetKataPhaseFromTotalPly, pairPetKataPliesRemainingInCurrentPhase } from '../../shared/constants/pairArena.js';
import { getEquippedPairPetInventoryRow } from '../../shared/utils/pairEquippedPet.js';
import { getPairPetDefinition } from '../../shared/constants/petLobby.js';
import { resolvePveSeatColors } from '../../utils/pveSeatColors.js';

interface SinglePlayerControlsProps extends Pick<GameProps, 'session' | 'onAction' | 'currentUser' | 'isSpectator'> {
    showResultModal?: boolean;
    allowPostGameFooterActions?: boolean;
    setShowResultModal?: (show: boolean) => void;
    isMoveInFlight?: boolean;
    isBoardLocked?: boolean;
    isMobile?: boolean;
    /** Game.tsx에서 gameControlsProps 일괄 전달 시 무시 */
    onLeaveOrResign?: () => void;
    /** Game.tsx gameControlsProps 일괄 전달 시 무시 */
    strategicPetHintFooterBubble?: { message: string; visible: boolean } | null;
    showMoveConfirmFooter?: boolean;
    pendingMove?: Point | null;
    onConfirmMove?: () => void;
    onMobileConfirmToggle?: (checked: boolean) => void;
    settings?: AppSettings;
}

interface ImageButtonProps {
    src: string;
    alt: string;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    variant?: 'primary' | 'danger';
    count?: number; // 개수 표시 (옵션)
    compact?: boolean;
    imageBottomOverlay?: string;
}

const ImageButton: React.FC<ImageButtonProps> = ({ src, alt, onClick, disabled = false, title, variant = 'primary', count, compact = false, imageBottomOverlay }) => {
    const variantClasses = variant === 'danger'
        ? 'border-red-400 shadow-red-500/40 focus:ring-red-400'
        : 'border-amber-400 shadow-amber-500/30 focus:ring-amber-300';
    const sizeClass = compact
        ? 'h-12 w-12 shrink-0 rounded-lg sm:h-12 sm:w-12'
        : 'h-[4.25rem] w-[4.25rem] rounded-xl min-[1025px]:h-16 min-[1025px]:w-16';
    
    return (
        <button
            type="button"
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            title={title}
            className={`relative ${sizeClass} border-2 transition-transform duration-200 ease-out overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 ${variantClasses} ${disabled ? 'opacity-40 cursor-not-allowed border-gray-700' : 'hover:scale-105 active:scale-95 shadow-lg'}`}
        >
            <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-contain pointer-events-none p-1" />
            {imageBottomOverlay ? (
                <span
                    className={`pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex items-end justify-center bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent pb-0.5 pt-2.5 font-bold leading-none tracking-wide text-sky-100 ring-1 ring-inset ring-sky-400/25 ${
                        compact ? 'text-[7px]' : 'text-[8px] min-[1025px]:text-[9px]'
                    }`}
                    aria-hidden
                >
                    {imageBottomOverlay}
                </span>
            ) : null}
            {/* 개수 표시 우측 하단 (옵션) */}
            {count !== undefined && (
                <span
                    className={`absolute flex items-center justify-center rounded-full border border-amber-600 bg-black/80 font-bold text-white ${disabled ? 'opacity-60' : ''} ${
                        compact ? 'bottom-0 right-0 h-4 min-w-[1rem] px-0.5 text-[9px]' : 'bottom-0.5 right-0.5 h-5 w-5 text-[10px]'
                    }`}
                >
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </button>
    );
};

interface ItemImageButtonProps {
    src: string;
    alt: string;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    count: number; // 아이템 개수
    compact?: boolean;
}

const ItemImageButton: React.FC<ItemImageButtonProps> = ({ src, alt, onClick, disabled = false, title, count, compact = false }) => {
    const sizeClass = compact
        ? 'h-12 w-12 shrink-0 rounded-lg sm:h-12 sm:w-12'
        : 'h-[4.25rem] w-[4.25rem] rounded-xl min-[1025px]:h-16 min-[1025px]:w-16';
    return (
        <button
            type="button"
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            title={title}
            className={`relative ${sizeClass} border-2 border-amber-400 transition-transform duration-200 ease-out overflow-hidden focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-gray-900 ${disabled ? 'opacity-40 cursor-not-allowed border-gray-700' : 'hover:scale-105 active:scale-95 shadow-lg'}`}
        >
            <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-contain pointer-events-none p-1.5" />
            {/* 개수 표시 우측 하단 */}
            <span
                className={`absolute flex items-center justify-center rounded-full border border-amber-600 bg-black/80 font-bold text-white ${disabled ? 'opacity-60' : ''} ${
                    compact ? 'bottom-0 right-0 h-4 min-w-[1rem] px-0.5 text-[9px]' : 'bottom-0.5 right-0.5 h-5 w-5 text-[10px]'
                }`}
            >
                {count > 99 ? '99+' : count}
            </span>
        </button>
    );
};

const SinglePlayerControls: React.FC<SinglePlayerControlsProps> = ({
    const { t } = useTranslation(['common', 'game']);
    session,
    onAction,
    currentUser,
    isSpectator = false,
    showResultModal = false,
    allowPostGameFooterActions = true,
    setShowResultModal,
    isMoveInFlight = false,
    isBoardLocked = false,
    isMobile = false,
    strategicPetHintFooterBubble = null,
    showMoveConfirmFooter = false,
    pendingMove = null,
    onConfirmMove,
    onMobileConfirmToggle,
    settings: settingsProp,
}) => {
    const myUserId = currentUser?.id;
    const [alertModal, setAlertModal] = useState<{ title?: string; message: string } | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ title?: string; message: string; onConfirm: () => void } | null>(null);
    const [petHintBusy, setPetHintBusy] = useState(false);
    const hasPendingRevealResolution = !!session.pendingCapture || !!session.revealAnimationEndTime;
    const arenaPolicy = React.useMemo(() => resolveArenaSessionPolicy(session as any), [session]);
    const isSinglePlayerArena = arenaPolicy.kind === 'singleplayer';
    
    // 게임 모드별 아이템 로직 (hooks 규칙 준수를 위해 early return 전에 선언)
    const refreshesUsed = session.singlePlayerPlacementRefreshesUsed || 0;
    const remainingRefreshes = Math.max(0, 5 - refreshesUsed);
    const currentStageConfig = session.stageId ? resolveLiveSessionSinglePlayerStageRow(session) : undefined;
    const placementRefreshAllowed =
        session.settings.singlePlayerPlacementRefreshAllowed !== false &&
        currentStageConfig?.allowPlacementRefresh !== false;
    const canRefresh = placementRefreshAllowed && (session.moveHistory?.length || 0) === 0 && refreshesUsed < 5;
    const costs = [0, 50, 75, 100, 200]; // 서버와 일치
    const nextCost = costs[refreshesUsed] || 0;
    const canAfford = currentUser.gold >= nextCost;
    const hiddenCountSetting = session.settings.hiddenStoneCount ?? 0;
    const scanCountSetting = session.settings.scanCount ?? 0;
    const missileCountSetting = session.settings.missileCount ?? 0;
    const mixedModes = Array.isArray(session.settings.mixedModes) ? session.settings.mixedModes : [];
    const isHiddenModeByRule =
        session.mode === GameMode.Hidden || (session.mode === GameMode.Mix && mixedModes.includes(GameMode.Hidden));
    const isMissileModeByRule =
        session.mode === GameMode.Missile || (session.mode === GameMode.Mix && mixedModes.includes(GameMode.Missile));
    const isHiddenMode = isSinglePlayerArena && isHiddenModeByRule;
    const isMissileMode = isSinglePlayerArena && isMissileModeByRule;
    const isMissileOnlyMode = isMissileMode && hiddenCountSetting === 0 && scanCountSetting === 0;
    const moveCount = session.moveHistory?.length ?? 0;
    const resolvePveItemCount = (sessionValue: unknown, fallback: number): number => {
        const n = Number(sessionValue);
        if (Number.isFinite(n)) return Math.max(0, n);
        return Math.max(0, fallback);
    };
    const myMissilesLeftForRefresh = resolvePveItemCount(session.missiles_p1, missileCountSetting);
    const usedMissileBeforeFirstMove = isMissileOnlyMode && moveCount === 0 && (missileCountSetting - myMissilesLeftForRefresh) > 0;

    // 베이스 덤 이후 유저가 백이 되는 케이스를 포함해 PVE 좌석(본인/상대 색)을 공통 규칙으로 계산한다.
    const { myPlayerEnum, opponentPlayerEnum } = resolvePveSeatColors(session as any, myUserId);
    const isMyTurn = myPlayerEnum !== Player.None && session.currentPlayer === myPlayerEnum;
    /** 배치변경(돌 재배치)은 첫 수 전이라면 색과 무관하게 허용해야 한다.
     * 베이스에서 유저가 백이 되면 AI(흑)가 먼저 두기 전 단계에 currentPlayer는 Black이라 isMyTurn=false다.
     * 이때까지는 보드 패턴만 다시 섞는 동작이므로 `!isMyTurn`을 비활성 조건에 넣지 않는다. */
    const refreshDisabled = !canRefresh || !canAfford || usedMissileBeforeFirstMove;
    const gameStatus = session.gameStatus;
    
    // 히든 재고는 본대국 색상 기준(p1=흑, p2=백)이다. 베이스바둑 후 유저가 백이면 p2를 보여줘야 한다.
    const myHiddenRaw = myPlayerEnum === Player.White ? session.hidden_stones_p2 : session.hidden_stones_p1;
    const hiddenLeft = resolvePveItemCount(myHiddenRaw, hiddenCountSetting);
    const hiddenDisabled = isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn || gameStatus !== 'playing' || hiddenLeft <= 0;
    
    const handleUseHidden = React.useCallback(() => {
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn || gameStatus !== 'playing') return;
        const clientSync = buildPveItemActionClientSync(session);
        onAction({
            type: 'START_HIDDEN_PLACEMENT',
            payload: { gameId: session.id, ...(clientSync ? { clientSync } : {}) },
        });
    }, [session, gameStatus, onAction, isMoveInFlight, isBoardLocked, hasPendingRevealResolution, isMyTurn]);
    
    // 스캔 아이템: 상대(AI)에 미공개 히든돌이 1개라도 있을 때만 활성화
    // 베이스 싱글에서 유저가 백이 되면 상대 AI가 흑이므로 색 비교에 `opponentPlayerEnum`을 사용해야 한다.
    const myScansLeft = resolvePveItemCount(session.scans_p1, scanCountSetting);
    const canScan = React.useMemo(() => {
        const board = session.boardState;
        if (!Array.isArray(board) || board.length === 0) return false;

        const scannedAiInitialByMe = !!myUserId && !!(session as any).scannedAiInitialHiddenByUser?.[myUserId];
        // AI 초기/아이템 히든 모두 서버 스캔 판정 대상이다. 클라이언트도 같은 기준으로 버튼을 활성화한다.
        const aiInitialHiddenStone = (session as any).aiInitialHiddenStone;
        if (aiInitialHiddenStone) {
            const { x, y } = aiInitialHiddenStone;
            const inBounds = typeof x === 'number' && typeof y === 'number' && y >= 0 && y < board.length && x >= 0 && x < board[y].length;
            if (inBounds && board[y][x] === opponentPlayerEnum) {
                const isPermanentlyRevealed = session.permanentlyRevealedStones?.some((p: { x: number; y: number }) => p.x === x && p.y === y);
                if (!isPermanentlyRevealed && !scannedAiInitialByMe) return true;
            }
        }

        // moveHistory 상의 상대(봇) 히든 스톤이 하나라도 있어야 스캔 가능
        if (!session.hiddenMoves || typeof session.hiddenMoves !== 'object' || !session.moveHistory?.length) return false;
        const myRevealed = myUserId ? session.revealedHiddenMoves?.[myUserId] : undefined;
        const hasOpponentUnrevealedHidden = Object.entries(session.hiddenMoves).some(([moveIndexStr, isHidden]) => {
            if (!isHidden) return false;
            const idx = parseInt(moveIndexStr, 10);
            if (myRevealed?.includes(idx)) return false;
            const move = session.moveHistory![idx];
            if (!move || move.player !== opponentPlayerEnum) return false;
            const { x, y } = move;
            const inBounds = typeof x === 'number' && typeof y === 'number' && y >= 0 && y < board.length && x >= 0 && x < board[y].length;
            if (!inBounds || board[y][x] !== opponentPlayerEnum) return false;
            const isPermanentlyRevealed = session.permanentlyRevealedStones?.some((p: { x: number; y: number }) => p.x === x && p.y === y);
            return !isPermanentlyRevealed;
        });
        return hasOpponentUnrevealedHidden;
    }, [
        myUserId,
        opponentPlayerEnum,
        session.hiddenMoves,
        session.moveHistory,
        session.boardState,
        session.permanentlyRevealedStones,
        session.revealedHiddenMoves,
        (session as any).aiInitialHiddenStone,
        (session as any).scannedAiInitialHiddenByUser,
    ]);
    
    // 상대 미공개 히든이 없으면 비활성 (착수로 발각된 경우 등은 canScan이 false)
    const scanDisabled =
        isMoveInFlight ||
        isBoardLocked ||
        hasPendingRevealResolution ||
        !isMyTurn ||
        gameStatus !== 'playing' ||
        myScansLeft <= 0 ||
        !canScan;
    
    const handleUseScan = React.useCallback(() => {
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn || gameStatus !== 'playing') return;
        const clientSync = buildPveItemActionClientSync(session);
        onAction({
            type: 'START_SCANNING',
            payload: { gameId: session.id, ...(clientSync ? { clientSync } : {}) },
        });
    }, [session, gameStatus, onAction, isMoveInFlight, isBoardLocked, hasPendingRevealResolution, isMyTurn]);
    
    // 미사일 아이템
    const myMissilesLeft = resolvePveItemCount(session.missiles_p1, missileCountSetting);
    
    const canUseMissile = isMyTurn;
    
    const missileDisabled =
        isMoveInFlight ||
        isBoardLocked ||
        hasPendingRevealResolution ||
        !canUseMissile ||
        gameStatus !== 'playing' ||
        myMissilesLeft <= 0;
    
    const handleUseMissile = React.useCallback(() => {
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !canUseMissile || gameStatus !== 'playing') return;
        const clientSync = buildPveItemActionClientSync(session);
        onAction({
            type: 'START_MISSILE_SELECTION',
            payload: { gameId: session.id, ...(clientSync ? { clientSync } : {}) },
        });
    }, [gameStatus, session, onAction, isMoveInFlight, isBoardLocked, hasPendingRevealResolution, canUseMissile]);
    
    const handleRefresh = React.useCallback(() => {
        if (!placementRefreshAllowed) {
            setAlertModal({ message: t('placementRefresh.notAllowedStage') });
            return;
        }
        if (!refreshDisabled && canAfford) {
            const priceLine = nextCost > 0 ? t('placementRefresh.priceLine', { price: `${formatGoldAmountKoG(nextCost)} gold` }) : t('placementRefresh.priceFree');
            const confirmationMessage = nextCost > 0
                ? t('placementRefresh.confirmModalMessagePaid', { priceLine, gold: formatGoldAmountKoG(nextCost), remaining: remainingRefreshes })
                : t('placementRefresh.confirmModalMessageFree', { priceLine });
            setConfirmModal({
                title: t('placementRefresh.confirmModalTitle'),
                message: confirmationMessage,
                onConfirm: () => {
                    onAction({ type: 'SINGLE_PLAYER_REFRESH_PLACEMENT', payload: { gameId: session.id } });
                }
            });
        }
    }, [placementRefreshAllowed, refreshDisabled, canAfford, nextCost, remainingRefreshes, session.id, onAction]);

    const handleForfeit = React.useCallback(() => {
        if (session.gameStatus === 'scoring') return;
        setConfirmModal({
            title: t('pveControls.resignConfirmTitle'),
            message: t('controls.confirmResign'),
            onConfirm: () => {
                onAction({ type: 'RESIGN_GAME', payload: { gameId: session.id } });
            }
        });
    }, [session.id, session.gameStatus, onAction]);
    
    if (session.gameStatus === 'ended' || session.gameStatus === 'no_contest') {
        /** 베이스/덤 결정 후 유저가 백이 될 수 있다 — 흑=유저 가정 대신 위에서 계산한 본인 색을 기준으로 승패를 판단한다. */
        const isWinner =
            myPlayerEnum !== Player.None
                ? session.winner === myPlayerEnum
                : session.winner === Player.Black;
        const stagesList = getSinglePlayerStages();
        const currentStageIndex = stagesList.findIndex(s => s.id === session.stageId);
        const currentStage = stagesList.find(s => s.id === session.stageId);
        const nextStage = stagesList[currentStageIndex + 1];
        const clearedStages = (currentUser as { clearedSinglePlayerStages?: string[] }).clearedSinglePlayerStages || [];
        const singlePlayerProgress = (currentUser as { singlePlayerProgress?: number }).singlePlayerProgress ?? 0;
        const sid = session.stageId;
        const isCurrentStageAlreadyCleared =
            currentStageIndex >= 0 &&
            !!sid &&
            (clearedStages.includes(sid) || singlePlayerProgress > currentStageIndex);
        // 클리어 직후에는 progress가 아직 반영되지 않았을 수 있으므로 승리 시 허용. 재도전 실패 시에도 이미 클리어한 스테이지면 다음 단계 유지
        const canTryNext = !!nextStage && (isWinner || isCurrentStageAlreadyCleared);
        const inferredRetryAp =
            isCurrentStageAlreadyCleared || isWinner ? 0 : (currentStage?.actionPointCost ?? 0);
        const retryActionPointCost =
            session.singlePlayerStartActionPointCost === 0 ? 0 : inferredRetryAp;
        const nextStageIndex = currentStageIndex + 1;
        const isNextStageAlreadyCleared =
            !!nextStage &&
            (clearedStages.includes(nextStage.id) || singlePlayerProgress > nextStageIndex);
        const nextStageActionPointCost = isNextStageAlreadyCleared ? 0 : (nextStage?.actionPointCost ?? 0);

        const handleRetry = async () => {
            try {
                setShowResultModal?.(false);
                console.log('[SinglePlayerControls] Retry button clicked, starting game for stage:', session.stageId);
                const result = await onAction({ type: 'START_SINGLE_PLAYER_GAME', payload: { stageId: session.stageId! } });
                const gameId = (result as any)?.gameId;
                console.log('[SinglePlayerControls] Retry action completed, gameId:', gameId);
                if (gameId) {
                    // handleAction에서 이미 라우팅이 업데이트되었으므로 짧은 딜레이만
                    await new Promise(resolve => setTimeout(resolve, 200));
                } else {
                    // gameId가 없으면 WebSocket 업데이트를 기다림
                    console.log('[SinglePlayerControls] No gameId in response, waiting for WebSocket update...');
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error('[SinglePlayerControls] Failed to retry stage:', error);
                setAlertModal({ message: tx('game:pveControls.retryFailed') });
            }
        };
        const handleNextStage = async () => {
            if (!canTryNext || !nextStage) {
                console.log('[SinglePlayerControls] Cannot start next stage:', { canTryNext, nextStage: !!nextStage });
                return;
            }
            try {
                setShowResultModal?.(false);
                try {
                    sessionStorage.removeItem(`gameState_${session.id}`);
                } catch {
                    /* ignore */
                }
                console.log('[SinglePlayerControls] Next stage button clicked, starting game for stage:', nextStage.id);
                const result = await onAction({ type: 'START_SINGLE_PLAYER_GAME', payload: { stageId: nextStage.id } });
                const gameId = (result as any)?.gameId;
                console.log('[SinglePlayerControls] Next stage action completed, gameId:', gameId);
                if (gameId) {
                    // handleAction에서 이미 라우팅이 업데이트되었으므로 짧은 딜레이만
                    await new Promise(resolve => setTimeout(resolve, 200));
                } else {
                    // gameId가 없으면 WebSocket 업데이트를 기다림
                    console.log('[SinglePlayerControls] No gameId in response, waiting for WebSocket update...');
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error('[SinglePlayerControls] Failed to start next stage:', error);
                setAlertModal({ message: tx('game:pveControls.nextStepFailed') });
            }
        };
        const handleExitToLobby = async () => {
            sessionStorage.setItem('postGameRedirect', '#/singleplayer');
            try {
                await onAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
            } catch (error) {
                console.error('[SinglePlayerControls] Failed to leave AI game:', error);
            } finally {
                setTimeout(() => {
                    replaceAppHash('#/singleplayer');
                }, 100);
            }
        };

        const handleShowResults = () => {
            if (setShowResultModal) {
                setShowResultModal(true);
            }
        };

        const blockPostGameFooter = allowPostGameFooterActions === false;

        const endedRowBtn = (extra?: string) =>
            `${arenaPostGameButtonClass('neutral', !!isMobile, 'strip')} ${arenaPostGameButtonInRowModifier}${extra ? ` ${extra}` : ''}`;

        return (
            <footer
                className={`responsive-controls flex w-full flex-shrink-0 flex-col items-stretch justify-center gap-2 p-2 ${pveIngameFooterReservedHeightClass(isMobile)} ${arenaGameRoomIngameBottomBarShellClass}`}
            >
                <div className={arenaPostGamePanelShellClass}>
                    <div className={arenaPostGameIngameEndedRowClass}>
                    <Button
                        bare
                        onClick={handleShowResults}
                        colorScheme="none"
                        className={endedRowBtn()}
                        disabled={blockPostGameFooter && showResultModal}
                    >
                        결과 보기
                    </Button>
                    <Button
                        bare
                        onClick={handleNextStage}
                        colorScheme="none"
                        className={endedRowBtn('min-w-0 truncate')}
                        disabled={blockPostGameFooter || !canTryNext}
                    >
                        {formatSinglePlayerNextFooterLabel(nextStage, canTryNext, nextStageActionPointCost)}
                    </Button>
                    <Button bare onClick={handleRetry} colorScheme="none" className={endedRowBtn()} disabled={blockPostGameFooter}>
                        {formatArenaRetryLabel(retryActionPointCost)}
                    </Button>
                    <Button bare onClick={handleExitToLobby} colorScheme="none" className={endedRowBtn()} disabled={blockPostGameFooter}>
                        대기실로
                    </Button>
                    </div>
                </div>
            </footer>
        );
    }

    /** 베이스·믹스(베이스 포함): 온라인 대국과 동일한 하단 스트립(배치/선호색/동색 덤 등). GameControls 대신 이 컴포넌트만 쓰는 싱글 전용. */
    if (isBaseGameFooterPhase(session) && currentUser) {
        const gs = session.gameStatus;
        const showBasePlacementStrip = gs === 'base_placement' && !isSpectator;
        return (
            <footer
                className={`${arenaGameRoomIngameBottomBarShellClass} flex w-full flex-shrink-0 flex-col items-stretch justify-center ${pveIngameFooterReservedHeightClass(isMobile)}`}
            >
                <div className={`flex w-full min-w-0 flex-col gap-0.5 py-0.5 ${arenaGameRoomControlsInnerPanelClass}`}>
                    {showBasePlacementStrip ? (
                        <div className="flex w-full min-w-0 min-h-[2.35rem] flex-row items-center justify-center px-1 min-[1025px]:min-h-[2.1rem] min-[1025px]:px-1.5">
                            <ArenaControlStrip layout="cluster" className="max-w-full min-w-0" gapClass="gap-1 min-[1025px]:gap-2">
                                <BasePlacementControlStrip
                                    session={session}
                                    currentUser={currentUser}
                                    onAction={onAction}
                                    isMobile={isMobile}
                                    isSinglePlayer
                                />
                            </ArenaControlStrip>
                        </div>
                    ) : null}
                    <BaseGameFooterPanel
                        session={session}
                        currentUser={currentUser}
                        onAction={onAction}
                        isMobile={isMobile}
                        isSinglePlayer
                        hideBasePlacementActions={showBasePlacementStrip}
                    />
                </div>
            </footer>
        );
    }

    const colClass = isMobile ? 'flex flex-col items-center gap-0.5 shrink-0' : 'flex flex-col items-center gap-1.5';
    const lblBase = isMobile ? 'text-[10px]' : 'text-[12px]';
    const petRow = currentUser ? getEquippedPairPetInventoryRow(currentUser) : null;
    const petHintBoardSize = session.settings.boardSize || 19;
    const petHintTotalPly = (session.moveHistory || []).filter((m) => m && m.x !== -1 && m.y !== -1).length + 1;
    const petHintPhase = pairPetKataPhaseFromTotalPly(petHintBoardSize, petHintTotalPly);
    const { remaining: petHintPhasePlyRemaining } = pairPetKataPliesRemainingInCurrentPhase(petHintBoardSize, petHintTotalPly);
    const petHintUsed = ((session.settings as { strategicPetHintByUserId?: Record<string, Partial<Record<string, boolean>>> })
        .strategicPetHintByUserId?.[currentUser.id] ?? {}) as Record<string, boolean>;
    const petHintPhaseLabel = petHintPhase === 'opening' ? tx('game:controls.phaseOpening') : petHintPhase === 'midgame' ? tx('game:controls.phaseMidgame') : tx('game:controls.phaseEndgame');
    const petHintCountdownLabel =
        petHintPhasePlyRemaining == null ? tx('game:controls.phaseEndgame') : t('controls.phaseMovesLeft', { phase: petHintPhaseLabel, count: petHintPhasePlyRemaining });
    const petHintCanAttempt =
        isSinglePlayerArena &&
        !isSpectator &&
        gameStatus === 'playing' &&
        isMyTurn &&
        !!petRow &&
        !petHintUsed[petHintPhase] &&
        !isMoveInFlight &&
        !isBoardLocked &&
        !hasPendingRevealResolution;
    let petHintTitleBody = t('controls.petHintPhaseOnce', { phase: petHintPhaseLabel });
    if (!petRow) {
        petHintTitleBody = t('controls.petHintEquipPet');
    } else if (gameStatus !== 'playing') {
        petHintTitleBody = t('controls.petHintDuringGame');
    } else if (!isMyTurn) {
        petHintTitleBody = t('controls.petHintMyTurnOnly');
    } else if (petHintUsed[petHintPhase]) {
        petHintTitleBody = t('controls.petHintPhaseUsed', { phase: petHintPhaseLabel });
    }
    const petHintTitle =
        petHintPhasePlyRemaining != null
            ? t('controls.petHintPhaseRemaining', { phase: petHintPhaseLabel, count: petHintPhasePlyRemaining, body: petHintTitleBody })
            : `${petHintPhaseLabel} — ${petHintTitleBody}`;
    const petHintImg = petRow
        ? ((petRow as { image?: string }).image ??
              (petRow.templateId ? getPairPetDefinition(petRow.templateId)?.image : null) ??
              '/images/button/hidden.webp')
        : null;
    const showPetHintBubble = Boolean(strategicPetHintFooterBubble?.visible && strategicPetHintFooterBubble?.message);
    const petHintSlot = (
        <div className={`relative ${colClass}`}>
            {showPetHintBubble && strategicPetHintFooterBubble?.message ? (
                <div
                    className="pointer-events-none absolute bottom-full left-0 z-[81] mb-2"
                    role="status"
                    aria-live="polite"
                >
                    <div className="relative rounded-xl border border-white/20 bg-black px-3 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.75)] ring-1 ring-white/10 sm:px-4 sm:py-3">
                        <p className="whitespace-nowrap text-sm font-semibold leading-none text-white sm:text-base">
                            {strategicPetHintFooterBubble.message}
                        </p>
                        <div
                            className={`absolute top-full -mt-px h-0 w-0 border-x-[7px] border-x-transparent border-t-[8px] border-t-black ${isMobile ? 'left-5' : 'left-7 min-[1025px]:left-7'}`}
                            aria-hidden
                        />
                    </div>
                </div>
            ) : null}
            {petRow && petHintImg ? (
                <ImageButton
                    src={petHintImg}
                    alt={t("controls.petHintAria", { label: petHintCountdownLabel })}
                    onClick={() => {
                        if (!petHintCanAttempt || petHintBusy) return;
                        setPetHintBusy(true);
                        void Promise.resolve(onAction({ type: 'REQUEST_STRATEGIC_PET_HINT', payload: { gameId: session.id } })).finally(() =>
                            setPetHintBusy(false),
                        );
                    }}
                    disabled={!petHintCanAttempt || petHintBusy}
                    title={petHintTitle}
                    compact={isMobile}
                    imageBottomOverlay={t("controls.hint")}
                />
            ) : (
                <button
                    type="button"
                    disabled
                    className={`relative flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-500/55 bg-slate-950/55 ${
                        isMobile ? 'h-12 w-12 shrink-0 rounded-lg' : 'h-[4.25rem] w-[4.25rem] rounded-xl min-[1025px]:h-16 min-[1025px]:w-16'
                    }`}
                    title={petHintTitle}
                    aria-label={t("controls.petHintAriaNoPet", { label: petHintCountdownLabel })}
                />
            )}
            <span className={`${lblBase} font-semibold whitespace-nowrap ${petHintCanAttempt ? 'text-sky-100' : 'text-gray-500'}`}>
                {petHintCountdownLabel}
            </span>
        </div>
    );

    const dockMoveConfirmSp = showMoveConfirmFooter && onConfirmMove && onMobileConfirmToggle && settingsProp;
    const moveConfirmCenterSp = dockMoveConfirmSp ? (
        <MoveConfirmFooterSlot
            layout="pve"
            compact={isMobile}
            withCenterPanel
            pendingMove={pendingMove ?? null}
            mobileConfirm={settingsProp.features.mobileConfirm}
            onConfirmMove={onConfirmMove}
            onMobileConfirmToggle={onMobileConfirmToggle}
        />
    ) : null;

    const coreActionsSp = (
        <>
            <div className={colClass}>
                <ImageButton
                    src="/images/button/giveup.webp"
                    alt={t("controls.resignAlt")}
                    onClick={handleForfeit}
                    disabled={gameStatus === 'scoring'}
                    title={gameStatus === 'scoring' ? t('controls.cannotResignDuringScoring') : t('controls.resignTitle')}
                    variant="danger"
                    compact={isMobile}
                />
                <span className={`${lblBase} font-semibold whitespace-nowrap text-red-300`}>{t("controls.resign")}</span>
            </div>
            <div className={colClass}>
                <ImageButton
                    src="/images/button/reflesh.webp"
                    alt={t("placementRefresh.refreshTitle")}
                    onClick={handleRefresh}
                    disabled={refreshDisabled}
                    title={refreshDisabled ? (!placementRefreshAllowed ? t('placementRefresh.notAllowedStage') : usedMissileBeforeFirstMove ? t('placementRefresh.missileFirstTurn') : !canAfford ? t('placementRefresh.insufficientGold') : t('placementRefresh.refreshDisabled')) : t('placementRefresh.refreshTitleWithCost', { cost: nextCost, remaining: remainingRefreshes })}
                    count={remainingRefreshes}
                    compact={isMobile}
                />
                <span className={`${lblBase} font-semibold whitespace-nowrap ${refreshDisabled ? 'text-gray-500' : 'text-amber-100'}`}>{t("placementRefresh.title")}</span>
                {nextCost > 0 && (
                    <span className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} flex items-center gap-0.5 whitespace-nowrap ${refreshDisabled ? 'text-gray-500' : 'text-yellow-300'}`}>
                        <img src="/images/icon/Gold.webp" alt={t("controls.goldAlt")} className={`${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'} shrink-0`} />
                        {formatGoldAmountKoG(nextCost)}
                    </span>
                )}
            </div>
        </>
    );

    const coreZoneSp = (
        <>
            {coreActionsSp}
            {petHintSlot}
        </>
    );

    const itemZoneSp = (
        <>
            {isHiddenMode && (
                <div className={colClass}>
                    <ItemImageButton
                        src="/images/button/hidden.webp"
                        alt={t("controls.hidden")}
                        onClick={handleUseHidden}
                        disabled={hiddenDisabled}
                        title={t('controls.hiddenPlaceTitle')}
                        count={hiddenLeft}
                        compact={isMobile}
                    />
                    <span className={`${lblBase} font-semibold whitespace-nowrap ${hiddenDisabled ? 'text-gray-500' : 'text-amber-100'}`}>{t("controls.hidden")}</span>
                </div>
            )}
            {isHiddenMode && (
                <div className={colClass}>
                    <ItemImageButton
                        src="/images/button/scan.webp"
                        alt={t("controls.scan")}
                        onClick={handleUseScan}
                        disabled={scanDisabled}
                        title={t('controls.scanDetectTitle')}
                        count={myScansLeft}
                        compact={isMobile}
                    />
                    <span className={`${lblBase} font-semibold whitespace-nowrap ${scanDisabled ? 'text-gray-500' : 'text-amber-100'}`}>{t("controls.scan")}</span>
                </div>
            )}
            {isMissileMode && (
                <div className={colClass}>
                    <ItemImageButton
                        src="/images/button/missile.webp"
                        alt={t("controls.missile")}
                        onClick={handleUseMissile}
                        disabled={missileDisabled}
                        title={t('controls.missileLaunchTitle')}
                        count={myMissilesLeft}
                        compact={isMobile}
                    />
                    <span className={`${lblBase} font-semibold whitespace-nowrap ${missileDisabled ? 'text-gray-500' : 'text-amber-100'}`}>{t("controls.missile")}</span>
                </div>
            )}
        </>
    );

    return (
        <div
            className={`${arenaGameRoomIngameBottomBarShellClass} w-full ${
                isMobile
                    ? 'flex min-h-[124px] w-full min-w-0 flex-row items-stretch gap-1.5 p-1'
                    : 'flex min-h-[124px] flex-row items-stretch gap-6 p-2 min-[1025px]:gap-7 min-[1025px]:py-1.5 min-[1025px]:px-2.5'
            }`}
        >
            {isMobile ? (
                <>
                    <div
                        className={`flex min-w-0 flex-1 flex-col justify-center px-0.5 py-1 ${arenaGameRoomIngameInnerNeutralSurfaceClass}`}
                    >
                        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                            {moveConfirmCenterSp && !(isHiddenMode || isMissileMode) ? (
                                <div className="grid w-full min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-x-1">
                                    <div className="flex min-w-0 justify-end">
                                        <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-1.5">
                                            {coreActionsSp}
                                        </ArenaControlStrip>
                                    </div>
                                    <div className="flex shrink-0 justify-center px-0.5">{moveConfirmCenterSp}</div>
                                    <div className="flex min-w-0 justify-start">
                                        <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-1.5">
                                            {petHintSlot}
                                        </ArenaControlStrip>
                                    </div>
                                </div>
                            ) : (
                                <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-1.5">
                                    {coreZoneSp}
                                </ArenaControlStrip>
                            )}
                        </div>
                    </div>
                    {(isHiddenMode || isMissileMode) && (
                        <>
                            <div className={`${arenaGameRoomControlsDividerClass} w-0.5 shrink-0 self-stretch`} aria-hidden />
                            {moveConfirmCenterSp ? (
                                <>
                                    <div className="flex shrink-0 flex-col justify-center px-0.5 py-0.5">{moveConfirmCenterSp}</div>
                                    <div className={`${arenaGameRoomControlsDividerClass} w-0.5 shrink-0 self-stretch`} aria-hidden />
                                </>
                            ) : null}
                            <div
                                className={`flex min-w-0 flex-1 flex-col justify-center px-0.5 py-1 ${arenaGameRoomIngameInnerItemSurfaceClass}`}
                            >
                                <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                                    <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-1.5">
                                        {itemZoneSp}
                                    </ArenaControlStrip>
                                </div>
                            </div>
                        </>
                    )}
                </>
            ) : (isHiddenMode || isMissileMode) ? (
                <>
                    <div
                        className={`flex min-w-0 flex-1 items-center justify-center px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1 ${arenaGameRoomIngameInnerNeutralSurfaceClass}`}
                    >
                        <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-7 min-[1025px]:gap-8">
                            {coreZoneSp}
                        </ArenaControlStrip>
                    </div>
                    {moveConfirmCenterSp ? (
                        <>
                            <div className="w-px shrink-0 self-stretch bg-stone-600/50" aria-hidden />
                            <div className="flex shrink-0 flex-col items-center justify-center px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1">
                                {moveConfirmCenterSp}
                            </div>
                        </>
                    ) : null}
                    <div className="w-px shrink-0 self-stretch bg-stone-600/50" aria-hidden />
                    <div
                        className={`flex min-w-0 flex-1 items-center justify-center px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1 ${arenaGameRoomIngameInnerItemSurfaceClass}`}
                    >
                        <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-6 min-[1025px]:gap-7">
                            {itemZoneSp}
                        </ArenaControlStrip>
                    </div>
                </>
            ) : (
                <div
                    className={`flex w-full min-w-0 items-center justify-center px-1.5 py-2 min-[1025px]:px-3 min-[1025px]:py-1.5 ${arenaGameRoomIngameInnerNeutralSurfaceClass}`}
                >
                    {moveConfirmCenterSp ? (
                        <div className="grid w-full max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-x-3 min-[1025px]:gap-x-6">
                            <div className="flex min-w-0 justify-end">
                                <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-7 min-[1025px]:gap-8">
                                    {coreActionsSp}
                                </ArenaControlStrip>
                            </div>
                            <div className="flex shrink-0 justify-center">{moveConfirmCenterSp}</div>
                            <div className="flex min-w-0 justify-start">
                                <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-7 min-[1025px]:gap-8">
                                    {petHintSlot}
                                </ArenaControlStrip>
                            </div>
                        </div>
                    ) : (
                        <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-7 min-[1025px]:gap-8">
                            {coreZoneSp}
                        </ArenaControlStrip>
                    )}
                </div>
            )}
            
            {alertModal && (
                <AlertModal
                    title={alertModal.title}
                    message={alertModal.message}
                    onClose={() => setAlertModal(null)}
                />
            )}
            
            {confirmModal && (
                <ConfirmModal
                    title={confirmModal.title || t('common:actions.confirm')}
                    message={confirmModal.message}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                    confirmText={t("common:actions.confirm")}
                    cancelText={t("common:actions.cancel")}
                    confirmColorScheme="red"
                    isTopmost={true}
                    windowId="singleplayer-confirm-modal"
                />
            )}
        </div>
    );
};

export default SinglePlayerControls;