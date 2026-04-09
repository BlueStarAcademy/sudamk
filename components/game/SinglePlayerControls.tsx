import React, { useState } from 'react';
import { GameProps, Player } from '../../types.js';
import Button from '../Button.js';
import { SINGLE_PLAYER_STAGES } from '../../constants';
import AlertModal from '../AlertModal.js';
import ConfirmModal from '../ConfirmModal.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import { buildPveItemActionClientSync } from '../../utils/pveItemClientSync.js';
import { ArenaControlStrip } from './ArenaControlStrip.js';
import {
    arenaPostGameButtonClass,
    arenaPostGameButtonInRowModifier,
    arenaPostGameIngameEndedRowClass,
    arenaPostGamePanelShellClass,
    formatArenaRetryLabel,
    formatSinglePlayerNextFooterLabel,
} from './arenaPostGameButtonStyles.js';

interface SinglePlayerControlsProps extends Pick<GameProps, 'session' | 'onAction' | 'currentUser'> {
    setShowResultModal?: (show: boolean) => void;
    isMoveInFlight?: boolean;
    isBoardLocked?: boolean;
    isMobile?: boolean;
    /** Game.tsx에서 gameControlsProps 일괄 전달 시 무시 */
    onLeaveOrResign?: () => void;
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
}

const ImageButton: React.FC<ImageButtonProps> = ({ src, alt, onClick, disabled = false, title, variant = 'primary', count, compact = false }) => {
    const variantClasses = variant === 'danger'
        ? 'border-red-400 shadow-red-500/40 focus:ring-red-400'
        : 'border-amber-400 shadow-amber-500/30 focus:ring-amber-300';
    const sizeClass = compact
        ? 'h-16 w-16 shrink-0 rounded-xl sm:h-[4.25rem] sm:w-[4.25rem]'
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
            {/* 개수 표시 우측 하단 (옵션) */}
            {count !== undefined && (
                <span className={`absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border border-amber-600 ${disabled ? 'opacity-60' : ''}`}>
                    {count}
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
        ? 'h-16 w-16 shrink-0 rounded-xl sm:h-[4.25rem] sm:w-[4.25rem]'
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
            <span className={`absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border border-amber-600 ${disabled ? 'opacity-60' : ''}`}>
                {count}
            </span>
        </button>
    );
};

const SinglePlayerControls: React.FC<SinglePlayerControlsProps> = ({ session, onAction, currentUser, setShowResultModal, isMoveInFlight = false, isBoardLocked = false, isMobile = false }) => {
    const [alertModal, setAlertModal] = useState<{ title?: string; message: string } | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ title?: string; message: string; onConfirm: () => void } | null>(null);
    const hasPendingRevealResolution = !!session.pendingCapture || !!session.revealAnimationEndTime;
    
    // 게임 모드별 아이템 로직 (hooks 규칙 준수를 위해 early return 전에 선언)
    const refreshesUsed = session.singlePlayerPlacementRefreshesUsed || 0;
    const remainingRefreshes = Math.max(0, 5 - refreshesUsed);
    const canRefresh = (session.moveHistory?.length || 0) === 0 && refreshesUsed < 5;
    const costs = [0, 50, 75, 100, 200]; // 서버와 일치
    const nextCost = costs[refreshesUsed] || 0;
    const canAfford = currentUser.gold >= nextCost;
    const hiddenCountSetting = session.settings.hiddenStoneCount ?? 0;
    const scanCountSetting = session.settings.scanCount ?? 0;
    const missileCountSetting = session.settings.missileCount ?? 0;
    const isHiddenMode = session.isSinglePlayer && hiddenCountSetting > 0;
    const isMissileMode = session.isSinglePlayer && missileCountSetting > 0;
    const isMissileOnlyMode = isMissileMode && hiddenCountSetting === 0 && scanCountSetting === 0;
    const moveCount = session.moveHistory?.length ?? 0;
    const myMissilesLeftForRefresh = session.missiles_p1 ?? missileCountSetting;
    const usedMissileBeforeFirstMove = isMissileOnlyMode && moveCount === 0 && (missileCountSetting - myMissilesLeftForRefresh) > 0;
    const refreshDisabled = !canRefresh || !canAfford || usedMissileBeforeFirstMove;

    const isMyTurn = session.currentPlayer === Player.Black; // 싱글플레이어에서는 유저가 항상 흑
    const gameStatus = session.gameStatus;
    
    // 히든 아이템 (스캔 아이템처럼 개수 기반)
    const hiddenLeft = session.hidden_stones_p1 ?? hiddenCountSetting;
    const hiddenDisabled = isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn || gameStatus !== 'playing' || hiddenLeft <= 0;
    
    const handleUseHidden = React.useCallback(() => {
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn || gameStatus !== 'playing') return;
        const clientSync = buildPveItemActionClientSync(session);
        onAction({
            type: 'START_HIDDEN_PLACEMENT',
            payload: { gameId: session.id, ...(clientSync ? { clientSync } : {}) },
        });
    }, [session, gameStatus, onAction, isMoveInFlight, isBoardLocked, hasPendingRevealResolution, isMyTurn]);
    
    // 스캔 아이템: 상대(백/AI)에 미공개 히든돌이 1개라도 있을 때만 활성화
    const myScansLeft = session.scans_p1 ?? scanCountSetting;
    const canScan = React.useMemo(() => {
        const board = session.boardState;
        if (!Array.isArray(board) || board.length === 0) return false;

        // AI가 히든 아이템으로 둔 돌만 스캔 대상 (미리 배치된 돌은 제외)
        const aiInitialHiddenStone = (session as any).aiInitialHiddenStone;
        const aiHiddenIsPrePlaced = (session as any).aiInitialHiddenStoneIsPrePlaced;
        if (aiInitialHiddenStone && !aiHiddenIsPrePlaced) {
            const { x, y } = aiInitialHiddenStone;
            const inBounds = typeof x === 'number' && typeof y === 'number' && y >= 0 && y < board.length && x >= 0 && x < board[y].length;
            if (inBounds && board[y][x] === Player.White) {
                const isPermanentlyRevealed = session.permanentlyRevealedStones?.some((p: { x: number; y: number }) => p.x === x && p.y === y);
                if (!isPermanentlyRevealed) return true;
            }
        }

        // moveHistory 상의 백(봇) 히든 스톤이 하나라도 있어야 스캔 가능
        if (!session.hiddenMoves || typeof session.hiddenMoves !== 'object' || !session.moveHistory?.length) return false;
        const hasOpponentUnrevealedHidden = Object.entries(session.hiddenMoves).some(([moveIndexStr, isHidden]) => {
            if (!isHidden) return false;
            const idx = parseInt(moveIndexStr, 10);
            const move = session.moveHistory![idx];
            if (!move || move.player !== Player.White) return false;
            const { x, y } = move;
            const inBounds = typeof x === 'number' && typeof y === 'number' && y >= 0 && y < board.length && x >= 0 && x < board[y].length;
            if (!inBounds || board[y][x] !== Player.White) return false;
            const isPermanentlyRevealed = session.permanentlyRevealedStones?.some((p: { x: number; y: number }) => p.x === x && p.y === y);
            return !isPermanentlyRevealed;
        });
        return hasOpponentUnrevealedHidden;
    }, [session.hiddenMoves, session.moveHistory, session.boardState, session.permanentlyRevealedStones, (session as any).aiInitialHiddenStone, (session as any).aiInitialHiddenStoneIsPrePlaced]);
    
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
    const myMissilesLeft = session.missiles_p1 ?? missileCountSetting;
    const missileDisabled = isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn || gameStatus !== 'playing' || myMissilesLeft <= 0;
    
    const handleUseMissile = React.useCallback(() => {
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn || gameStatus !== 'playing') return;
        onAction({ type: 'START_MISSILE_SELECTION', payload: { gameId: session.id } });
    }, [gameStatus, session.id, onAction, isMoveInFlight, isBoardLocked, hasPendingRevealResolution, isMyTurn]);
    
    const handleRefresh = React.useCallback(() => {
        if (canRefresh && canAfford) {
            const priceLine = nextCost > 0 ? `이용 가격: ${nextCost.toLocaleString()} 골드` : '이용 가격: 무료';
            const confirmationMessage = nextCost > 0
                ? `${priceLine}\n\n${nextCost.toLocaleString()} 골드를 사용하여 배치를 다시 섞으시겠습니까? (남은 재배치 ${remainingRefreshes}/5)`
                : `${priceLine}\n\n첫 재배치는 무료입니다. 배치를 다시 섞으시겠습니까?`;
            setConfirmModal({
                title: '배치변경',
                message: confirmationMessage,
                onConfirm: () => {
                    onAction({ type: 'SINGLE_PLAYER_REFRESH_PLACEMENT', payload: { gameId: session.id } });
                }
            });
        }
    }, [canRefresh, canAfford, nextCost, remainingRefreshes, session.id, onAction]);

    const handleForfeit = React.useCallback(() => {
        setConfirmModal({
            title: '기권 확인',
            message: '경기를 포기하시겠습니까?',
            onConfirm: () => {
                onAction({ type: 'RESIGN_GAME', payload: { gameId: session.id } });
            }
        });
    }, [session.id, onAction]);
    
    if (session.gameStatus === 'ended' || session.gameStatus === 'no_contest') {
        const isWinner = session.winner === Player.Black;
        const currentStageIndex = SINGLE_PLAYER_STAGES.findIndex(s => s.id === session.stageId);
        const currentStage = SINGLE_PLAYER_STAGES.find(s => s.id === session.stageId);
        const nextStage = SINGLE_PLAYER_STAGES[currentStageIndex + 1];
        const clearedStages = (currentUser as { clearedSinglePlayerStages?: string[] }).clearedSinglePlayerStages || [];
        const singlePlayerProgress = (currentUser as { singlePlayerProgress?: number }).singlePlayerProgress ?? 0;
        const sid = session.stageId;
        const isCurrentStageAlreadyCleared =
            currentStageIndex >= 0 &&
            !!sid &&
            (clearedStages.includes(sid) || singlePlayerProgress > currentStageIndex);
        // 클리어 직후에는 progress가 아직 반영되지 않았을 수 있으므로 승리 시 허용. 재도전 실패 시에도 이미 클리어한 스테이지면 다음 단계 유지
        const canTryNext = !!nextStage && (isWinner || isCurrentStageAlreadyCleared);
        
        const retryActionPointCost = currentStage?.actionPointCost ?? 0;
        const nextStageActionPointCost = nextStage?.actionPointCost ?? 0;

        const handleRetry = async () => {
            try {
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
                setAlertModal({ message: '재도전에 실패했습니다. 다시 시도해주세요.' });
            }
        };
        const handleNextStage = async () => {
            if (!canTryNext || !nextStage) {
                console.log('[SinglePlayerControls] Cannot start next stage:', { canTryNext, nextStage: !!nextStage });
                return;
            }
            try {
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
                setAlertModal({ message: '다음 단계 시작에 실패했습니다. 다시 시도해주세요.' });
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

        const endedRowBtn = (extra?: string) =>
            `${arenaPostGameButtonClass('neutral', !!isMobile, 'strip')} ${arenaPostGameButtonInRowModifier}${extra ? ` ${extra}` : ''}`;

        return (
            <footer className="responsive-controls flex w-full min-h-0 flex-shrink-0 flex-col items-stretch justify-center gap-2 rounded-xl border border-stone-700/50 bg-stone-800/70 p-2 backdrop-blur-sm">
                <div className={arenaPostGamePanelShellClass}>
                    <div className={arenaPostGameIngameEndedRowClass}>
                    <Button bare onClick={handleShowResults} colorScheme="none" className={endedRowBtn()}>
                        결과 보기
                    </Button>
                    <Button bare onClick={handleNextStage} colorScheme="none" className={endedRowBtn('min-w-0 truncate')} disabled={!canTryNext}>
                        {formatSinglePlayerNextFooterLabel(nextStage, canTryNext, nextStageActionPointCost)}
                    </Button>
                    <Button bare onClick={handleRetry} colorScheme="none" className={endedRowBtn()}>
                        {formatArenaRetryLabel(retryActionPointCost)}
                    </Button>
                    <Button bare onClick={handleExitToLobby} colorScheme="none" className={endedRowBtn()}>
                        대기실로
                    </Button>
                    </div>
                </div>
            </footer>
        );
    }

    const colClass = isMobile ? 'flex flex-col items-center gap-1 shrink-0' : 'flex flex-col items-center gap-1.5';
    const lblBase = isMobile ? 'text-[10px]' : 'text-[12px]';

    const coreZoneSp = (
        <>
            <div className={colClass}>
                <ImageButton
                    src="/images/button/giveup.png"
                    alt="기권"
                    onClick={handleForfeit}
                    title="기권하기"
                    variant="danger"
                    compact={isMobile}
                />
                <span className={`${lblBase} font-semibold whitespace-nowrap text-red-300`}>기권</span>
            </div>
            <div className={colClass}>
                <ImageButton
                    src="/images/button/reflesh.png"
                    alt="배치 새로고침"
                    onClick={handleRefresh}
                    disabled={refreshDisabled}
                    title={refreshDisabled ? (usedMissileBeforeFirstMove ? '첫 턴에 미사일을 사용하면 배치변경을 사용할 수 없습니다.' : !canAfford ? '골드가 부족합니다.' : '배치 새로고침 불가') : `배치 새로고침 (비용: ${nextCost}골드, 남은 횟수: ${remainingRefreshes}/5)`}
                    count={remainingRefreshes}
                    compact={isMobile}
                />
                <span className={`${lblBase} font-semibold whitespace-nowrap ${refreshDisabled ? 'text-gray-500' : 'text-amber-100'}`}>배치변경</span>
                {nextCost > 0 && (
                    <span className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} flex items-center gap-0.5 whitespace-nowrap ${refreshDisabled ? 'text-gray-500' : 'text-yellow-300'}`}>
                        <img src="/images/icon/Gold.png" alt="골드" className={`${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'} shrink-0`} />
                        {nextCost.toLocaleString()}
                    </span>
                )}
            </div>
        </>
    );

    const itemZoneSp = (
        <>
            {isHiddenMode && (
                <div className={colClass}>
                    <ItemImageButton
                        src="/images/button/hidden.png"
                        alt="히든"
                        onClick={handleUseHidden}
                        disabled={hiddenDisabled}
                        title="히든 스톤 배치"
                        count={hiddenLeft}
                        compact={isMobile}
                    />
                    <span className={`${lblBase} font-semibold whitespace-nowrap ${hiddenDisabled ? 'text-gray-500' : 'text-amber-100'}`}>히든</span>
                </div>
            )}
            {isHiddenMode && (
                <div className={colClass}>
                    <ItemImageButton
                        src="/images/button/scan.png"
                        alt="스캔"
                        onClick={handleUseScan}
                        disabled={scanDisabled}
                        title="상대 히든 스톤 탐지"
                        count={myScansLeft}
                        compact={isMobile}
                    />
                    <span className={`${lblBase} font-semibold whitespace-nowrap ${scanDisabled ? 'text-gray-500' : 'text-amber-100'}`}>스캔</span>
                </div>
            )}
            {isMissileMode && (
                <div className={colClass}>
                    <ItemImageButton
                        src="/images/button/missile.png"
                        alt="미사일"
                        onClick={handleUseMissile}
                        disabled={missileDisabled}
                        title="미사일 발사"
                        count={myMissilesLeft}
                        compact={isMobile}
                    />
                    <span className={`${lblBase} font-semibold whitespace-nowrap ${missileDisabled ? 'text-gray-500' : 'text-amber-100'}`}>미사일</span>
                </div>
            )}
        </>
    );

    return (
        <div
            className={`bg-stone-800/70 backdrop-blur-sm rounded-xl w-full border border-stone-700/50 ${
                isMobile
                    ? 'flex h-[164px] w-full min-w-0 flex-row items-stretch gap-3 p-2'
                    : 'flex min-h-[112px] max-h-[124px] flex-row items-stretch gap-6 p-2 min-[1025px]:gap-7 min-[1025px]:py-1.5 min-[1025px]:px-2.5'
            }`}
        >
            {isMobile ? (
                <>
                    <div className="flex min-w-0 flex-1 flex-col justify-center rounded-lg border border-stone-600/40 bg-black/20 px-1 py-2">
                        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                            <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-3">
                                {coreZoneSp}
                            </ArenaControlStrip>
                        </div>
                    </div>
                    {(isHiddenMode || isMissileMode) && (
                        <>
                            <div className="w-0.5 shrink-0 self-stretch rounded-full bg-gradient-to-b from-stone-600/20 via-stone-500/50 to-stone-600/20" aria-hidden />
                            <div className="flex min-w-0 flex-1 flex-col justify-center rounded-lg border border-amber-900/35 bg-amber-950/15 px-1 py-2">
                                <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                                    <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-3">
                                        {itemZoneSp}
                                    </ArenaControlStrip>
                                </div>
                            </div>
                        </>
                    )}
                </>
            ) : (isHiddenMode || isMissileMode) ? (
                <>
                    <div className="flex min-w-0 flex-1 items-center justify-center rounded-lg border border-stone-600/40 bg-black/10 px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1">
                        <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-7 min-[1025px]:gap-8">
                            {coreZoneSp}
                        </ArenaControlStrip>
                    </div>
                    <div className="w-px shrink-0 self-stretch bg-stone-600/50" />
                    <div className="flex min-w-0 flex-1 items-center justify-center rounded-lg border border-amber-900/35 bg-amber-950/10 px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1">
                        <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-6 min-[1025px]:gap-7">
                            {itemZoneSp}
                        </ArenaControlStrip>
                    </div>
                </>
            ) : (
                <div className="flex w-full min-w-0 items-center justify-center px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1">
                    <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-7 min-[1025px]:gap-8">
                        {coreZoneSp}
                    </ArenaControlStrip>
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
                    title={confirmModal.title || '확인'}
                    message={confirmModal.message}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                    confirmText="확인"
                    cancelText="취소"
                    confirmColorScheme="red"
                    isTopmost={true}
                    windowId="singleplayer-confirm-modal"
                />
            )}
        </div>
    );
};

export default SinglePlayerControls;