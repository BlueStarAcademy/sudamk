import React, { useState, useMemo } from 'react';
import { GameProps, Player } from '../../types.js';
import Button from '../Button.js';
import ConfirmModal from '../ConfirmModal.js';
import { TOWER_STAGES } from '../../constants/towerConstants.js';
import { shouldUseClientSideAi } from '../../services/wasmGnuGo.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import {
    countTowerLobbyInventoryQty,
    TOWER_ITEM_TURN_ADD_NAMES,
    TOWER_ITEM_MISSILE_NAMES,
    TOWER_ITEM_HIDDEN_NAMES,
    TOWER_ITEM_SCAN_NAMES,
    TOWER_ITEM_REFRESH_NAMES,
} from '../../utils/towerLobbyInventory.js';
import { buildPveItemActionClientSync } from '../../utils/pveItemClientSync.js';
import { ArenaControlStrip } from './ArenaControlStrip.js';

interface TowerControlsProps extends Pick<GameProps, 'session' | 'onAction' | 'currentUser'> {
    showResultModal?: boolean;
    setShowResultModal?: (show: boolean) => void;
    setConfirmModalType?: (type: 'resign' | null) => void;
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
    count?: number;
    maxCount?: number;
    compact?: boolean;
}

const ImageButton: React.FC<ImageButtonProps> = ({ src, alt, onClick, disabled = false, title, count, maxCount, compact = false }) => {
    const sizeClass = compact ? 'w-11 h-11 shrink-0 rounded-lg md:rounded-xl' : 'w-16 h-16 md:w-20 md:h-20 rounded-xl';
    return (
        <button
            type="button"
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            title={title}
			className={`relative ${sizeClass} border-2 border-amber-400 transition-transform duration-200 ease-out overflow-hidden focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-gray-900 ${disabled ? 'opacity-40 cursor-not-allowed border-gray-700' : 'hover:scale-105 active:scale-95 shadow-lg'}`}
        >
			<img src={src} alt={alt} className="absolute inset-0 w-full h-full object-contain pointer-events-none p-1.5" />
            {count !== undefined && (
				<div className={`absolute -bottom-0.5 -right-0.5 text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-purple-900 ${
                    count > 0 ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 text-gray-300'
                }`}>
                    {count}
                </div>
            )}
        </button>
    );
};

const TowerControls: React.FC<TowerControlsProps> = ({ session, onAction, currentUser, showResultModal, setShowResultModal, setConfirmModalType, isMoveInFlight = false, isBoardLocked = false, isMobile = false }) => {
    const [refreshConfirmModal, setRefreshConfirmModal] = useState(false);
    const [passConfirmModal, setPassConfirmModal] = useState(false);
    const [turnAddConfirmModal, setTurnAddConfirmModal] = useState(false);
    const floor = session.towerFloor ?? 1;
    const hasPendingRevealResolution = !!session.pendingCapture || !!session.revealAnimationEndTime;
    const stage = TOWER_STAGES.find(s => {
        const stageFloor = parseInt(s.id.replace('tower-', ''));
        return stageFloor === floor;
    });

    // 훅은 early return 이전에 항상 호출 (React 규칙: 훅 개수/순서 일정 유지)
    const showMissileAndHiddenForHook = floor >= 21;
    const scanCountSettingForHook = showMissileAndHiddenForHook ? ((session.settings as any)?.scanCount ?? (stage?.scanCount ?? 0)) : 0;
    /** 대기실과 동일: 배지 숫자는 항상 가방(인벤) 수. 사용 가능은 세션 잔여와 함께 판단 */
    const inventory = currentUser?.inventory || [];
    const getItemCount = (namesOrIds: readonly string[]): number => countTowerLobbyInventoryQty(inventory, namesOrIds);
    const scanInventoryCount = showMissileAndHiddenForHook ? getItemCount(TOWER_ITEM_SCAN_NAMES) : 0;
    const sessionScansLeft = (session as any).scans_p1 as number | undefined;
    const outOfSessionScans = sessionScansLeft !== undefined && sessionScansLeft <= 0;
    const canScan = React.useMemo(() => {
        if (!showMissileAndHiddenForHook || scanInventoryCount <= 0 || outOfSessionScans) return false;
        const board = session.boardState;
        if (!Array.isArray(board) || board.length === 0) return false;
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
        if (!session.hiddenMoves || !session.moveHistory) return false;
        return Object.entries(session.hiddenMoves).some(([moveIndexStr, isHidden]) => {
            if (!isHidden) return false;
            const move = session.moveHistory![parseInt(moveIndexStr, 10)];
            if (!move || move.player !== Player.White) return false;
            const { x, y } = move;
            const inBounds = typeof x === 'number' && typeof y === 'number' && y >= 0 && y < board.length && x >= 0 && x < board[y].length;
            if (!inBounds || board[y][x] !== Player.White) return false;
            const isPermanentlyRevealed = session.permanentlyRevealedStones?.some((p: { x: number; y: number }) => p.x === x && p.y === y);
            return !isPermanentlyRevealed;
        });
    }, [showMissileAndHiddenForHook, scanInventoryCount, outOfSessionScans, session.boardState, session.hiddenMoves, session.moveHistory, session.permanentlyRevealedStones, (session as any).aiInitialHiddenStone, (session as any).aiInitialHiddenStoneIsPrePlaced]);

    if (session.gameStatus === 'ended' || session.gameStatus === 'no_contest') {
        const isWinner = session.winner === Player.Black;
        const nextFloor = floor < 100 ? floor + 1 : null;
        const nextStageForEnded = nextFloor
            ? TOWER_STAGES.find(s => {
                  const stageFloor = parseInt(s.id.replace('tower-', ''));
                  return stageFloor === nextFloor;
              })
            : null;
        const userTowerFloor = currentUser.towerFloor ?? 0;
        const isFloorCleared = floor <= userTowerFloor;
        // TowerSummaryModal과 동일: 승리했거나 현재 층을 이미 클리어한 적 있으면 다음 층 진행 가능
        const canTryNext = !!nextStageForEnded && (isWinner || isFloorCleared);

        const baseRetryApCost = stage?.actionPointCost ?? 0;
        const baseNextFloorApCost = nextStageForEnded?.actionPointCost ?? 0;
        const effectiveRetryApCost = isFloorCleared ? 0 : baseRetryApCost;
        const isNextFloorAlreadyCleared = nextFloor != null && userTowerFloor >= nextFloor;
        const effectiveNextFloorApCost = isNextFloorAlreadyCleared ? 0 : baseNextFloorApCost;

        const handleShowResults = () => {
            if (setShowResultModal) {
                setShowResultModal(true);
            }
        };

        const handleRetry = async () => {
            try {
                const result = await onAction({ type: 'START_TOWER_GAME', payload: { floor, useClientSideAi: shouldUseClientSideAi() } });
                const gameId = (result as any)?.gameId;
                if (gameId) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                } else {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error('[TowerControls] Failed to retry floor:', error);
                window.alert('재도전에 실패했습니다. 다시 시도해주세요.');
            }
        };
        
        const handleNextFloor = async () => {
            if (!canTryNext || !nextFloor) return;
            try {
                const result = await onAction({ type: 'START_TOWER_GAME', payload: { floor: nextFloor, useClientSideAi: shouldUseClientSideAi() } });
                const gameId = (result as any)?.gameId;
                if (gameId) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                } else {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error('[TowerControls] Failed to start next floor:', error);
                window.alert('다음 층 시작에 실패했습니다. 다시 시도해주세요.');
            }
        };
        
        const handleExitToLobby = async () => {
            // 도전의 탑에서는 서버 액션을 시도하되, 성공/실패와 관계없이 로비로 이동
            sessionStorage.setItem('postGameRedirect', '#/tower');
            try {
                await onAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
            } catch (error) {
                // 에러가 발생해도 로비로 이동 (도전의 탑 게임이 이미 종료되었거나 없는 경우 등)
                console.log('[TowerControls] LEAVE_AI_GAME failed, moving to lobby anyway:', error);
            }
            // 서버 응답을 기다리지 않고 바로 이동 (히스토리에서 경기장 항목 제거)
            replaceAppHash('#/tower');
        };

        const endBtn = isMobile ? '!py-1 !px-2 !text-[0.65rem] shrink-0' : '!py-1.5 !px-4 !text-sm';
        return (
            <footer className="responsive-controls flex-shrink-0 bg-gray-800 rounded-lg p-2 flex flex-col items-stretch justify-center gap-2 w-full min-h-[148px]">
                <div className="min-w-0 rounded-xl border border-stone-700 bg-gray-900/70 px-2 py-3 sm:px-4">
                    <ArenaControlStrip layout="cluster" gapClass={isMobile ? 'gap-1.5' : 'gap-2'}>
                    <Button onClick={handleShowResults} colorScheme="none" className={`justify-center rounded-xl border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white shadow-[0_12px_32px_-18px_rgba(99,102,241,0.85)] hover:from-indigo-400 hover:to-pink-400 whitespace-nowrap ${endBtn}`}>
                        결과 보기
                    </Button>
                    <Button onClick={handleExitToLobby} colorScheme="none" className={`justify-center rounded-xl border border-red-400/50 bg-gradient-to-r from-red-500/90 via-red-600/90 to-rose-600/90 text-white shadow-[0_12px_32px_-18px_rgba(239,68,68,0.85)] hover:from-red-400 hover:to-rose-500 whitespace-nowrap ${endBtn}`}>
                        나가기
                    </Button>
                    <Button onClick={handleRetry} colorScheme="none" className={`justify-center rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-500/90 via-amber-300/90 to-amber-500/90 text-slate-900 shadow-[0_12px_32px_-18px_rgba(251,191,36,0.85)] hover:from-amber-300 hover:to-amber-500 whitespace-nowrap ${endBtn}`}>
                        재도전 {effectiveRetryApCost > 0 && `(⚡${effectiveRetryApCost})`}
                    </Button>
                    <Button onClick={handleNextFloor} colorScheme="none" className={`justify-center rounded-xl border border-cyan-400/50 bg-gradient-to-r from-cyan-500/90 via-sky-500/90 to-blue-500/90 text-white shadow-[0_12px_32px_-18px_rgba(56,189,248,0.85)] hover:from-cyan-300 hover:to-blue-500 whitespace-nowrap max-w-[46vw] truncate ${endBtn}`} disabled={!canTryNext}>
                        다음 층{canTryNext && nextFloor ? `: ${nextFloor}층` : ''}{effectiveNextFloorApCost > 0 && ` (⚡${effectiveNextFloorApCost})`}
                    </Button>
                    </ArenaControlStrip>
                </div>
            </footer>
        );
    }
    
    const handleRefresh = () => {
        if (refreshDisabled) return;
        setRefreshConfirmModal(true);
    };
    const handleRefreshConfirm = () => {
        setRefreshConfirmModal(false);
        onAction({ type: 'TOWER_REFRESH_PLACEMENT', payload: { gameId: session.id } });
    };

    const handleForfeit = () => {
        setConfirmModalType?.('resign');
    };

    const handlePassClick = () => {
        if (!passAllowed) return;
        setPassConfirmModal(true);
    };

    const handlePassConfirm = () => {
        setPassConfirmModal(false);
        const gameStatus = session.gameStatus;
        if (gameStatus !== 'playing') return;
        const currentPassCount = (session.passCount || 0) + 1;
        if (currentPassCount >= 2) {
            onAction({
                type: 'REQUEST_SCORING',
                payload: {
                    gameId: session.id,
                    boardState: session.boardState,
                    moveHistory: session.moveHistory || [],
                    settings: session.settings
                }
            } as any);
        } else {
            onAction({
                type: 'TOWER_CLIENT_MOVE',
                payload: {
                    gameId: session.id,
                    x: -1,
                    y: -1,
                    newBoardState: session.boardState,
                    capturedStones: [],
                    newKoInfo: session.koInfo,
                    isPass: true
                }
            } as any);
        }
    };

    const gameStatus = session.gameStatus;
    const isMyTurn = session.currentPlayer === Player.Black;
    const lastMove = session.moveHistory?.length ? session.moveHistory[session.moveHistory.length - 1] : null;
    const lastMoveWasBlack = !!(lastMove && lastMove.player === Player.Black);
    const allowScanAfterMyMove = gameStatus === 'playing' && lastMoveWasBlack && !isMyTurn;
    const canStartScanTurn = isMyTurn || allowScanAfterMyMove;
    const showTurnAdd = floor <= 20; // 1~20층에서만 턴 추가 아이템 표시
    // 도전의 탑 전체(1~100층)에서 통과 비활성: 1~20층 따내기 턴 제한, 21층+ 자동 계가
    const passAllowed = false;

    // 턴 추가 아이템 (1~20층, 제한 없음) - 로비·가방과 동기화
    const turnAddCount = showTurnAdd ? getItemCount(TOWER_ITEM_TURN_ADD_NAMES) : 0;
    const turnAddDisabled = gameStatus !== 'playing' || turnAddCount <= 0;
    
    const handleUseTurnAdd = () => {
        if (gameStatus !== 'playing' || turnAddCount <= 0) return;
        setTurnAddConfirmModal(true);
    };

    const handleTurnAddConfirm = () => {
        setTurnAddConfirmModal(false);
        if (session.gameStatus !== 'playing') return;
        onAction({ type: 'TOWER_ADD_TURNS', payload: { gameId: session.id } });
    };

    // 미사일 (21층+): 배지는 대기실과 동일하게 인벤 수, 사용은 세션 잔여도 확인
    const missileCount = showMissileAndHiddenForHook ? getItemCount(TOWER_ITEM_MISSILE_NAMES) : 0;
    const missileMaxCount = (stage as { missileCount?: number } | undefined)?.missileCount ?? (session.settings as { missileCount?: number })?.missileCount ?? 2;
    const outOfSessionMissiles = session.missiles_p1 !== undefined && session.missiles_p1 <= 0;
    const missileDisabled =
        isMoveInFlight ||
        isBoardLocked ||
        hasPendingRevealResolution ||
        !isMyTurn ||
        gameStatus !== 'playing' ||
        missileCount <= 0 ||
        outOfSessionMissiles;
    
    const handleUseMissile = () => {
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn || gameStatus !== 'playing') return;
        onAction({ type: 'START_MISSILE_SELECTION', payload: { gameId: session.id } });
    };
    
    const hiddenCount = showMissileAndHiddenForHook ? getItemCount(TOWER_ITEM_HIDDEN_NAMES) : 0;
    const hiddenMaxCount =
        (stage as { hiddenStoneCount?: number } | undefined)?.hiddenStoneCount ??
        (session.settings as { hiddenStoneCount?: number })?.hiddenStoneCount ??
        2;
    const outOfSessionHidden = session.hidden_stones_p1 !== undefined && session.hidden_stones_p1 <= 0;
    const hiddenDisabled =
        isMoveInFlight ||
        isBoardLocked ||
        hasPendingRevealResolution ||
        !isMyTurn ||
        gameStatus !== 'playing' ||
        hiddenCount <= 0 ||
        outOfSessionHidden;
    
    const handleUseHidden = () => {
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn || gameStatus !== 'playing') return;
        const clientSync = buildPveItemActionClientSync(session);
        onAction({
            type: 'START_HIDDEN_PLACEMENT',
            payload: { gameId: session.id, ...(clientSync ? { clientSync } : {}) },
        });
    };

    const scanDisabled =
        isMoveInFlight ||
        isBoardLocked ||
        hasPendingRevealResolution ||
        !canStartScanTurn ||
        gameStatus !== 'playing' ||
        scanInventoryCount <= 0 ||
        outOfSessionScans ||
        !canScan;

    const handleUseScan = () => {
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !canStartScanTurn || gameStatus !== 'playing') return;
        const clientSync = buildPveItemActionClientSync(session);
        onAction({
            type: 'START_SCANNING',
            payload: { gameId: session.id, ...(clientSync ? { clientSync } : {}) },
        });
    };

    const refreshCount = getItemCount(TOWER_ITEM_REFRESH_NAMES);
    const refreshMaxCount = 5;
    const canUseRefresh = session.moveHistory && session.moveHistory.length === 0 && session.gameStatus === 'playing' && session.currentPlayer === Player.Black;
    const refreshDisabled = refreshCount <= 0 || !canUseRefresh;

	const colClass = isMobile ? 'flex flex-col items-center gap-0.5 shrink-0' : 'flex flex-col items-center gap-1';
	const lbl = isMobile ? 'text-[9px]' : 'text-[11px]';

	const coreZone = (
		<>
			<div className={colClass}>
				<ImageButton
					src="/images/button/giveup.png"
					alt="기권"
					onClick={handleForfeit}
					title="기권하기"
					compact={isMobile}
				/>
				<span className={`${lbl} font-semibold whitespace-nowrap text-red-300`}>기권</span>
			</div>
			{passAllowed && (
				<div className={colClass}>
					<ImageButton
						src="/images/button/pass.png"
						alt="통과"
						onClick={handlePassClick}
						disabled={!isMyTurn || gameStatus !== 'playing'}
						title="한 수 쉬기"
						compact={isMobile}
					/>
					<span className={`${lbl} font-semibold whitespace-nowrap ${!isMyTurn || gameStatus !== 'playing' ? 'text-gray-500' : 'text-amber-100'}`}>통과</span>
				</div>
			)}
			<div className={colClass}>
				<ImageButton
					src="/images/button/reflesh.png"
					alt="배치변경"
					onClick={handleRefresh}
					disabled={refreshDisabled}
					title="배치 새로고침"
					count={refreshCount}
					maxCount={refreshMaxCount}
					compact={isMobile}
				/>
				<span className={`${lbl} font-semibold whitespace-nowrap ${refreshDisabled ? 'text-gray-500' : 'text-amber-100'}`}>배치변경</span>
			</div>
		</>
	);

	const itemZone = (
		<>
			{showTurnAdd && (
				<div className={colClass}>
					<ImageButton
						src="/images/button/addturn.png"
						alt="턴 추가"
						onClick={handleUseTurnAdd}
						disabled={turnAddDisabled}
						title="남은 턴 3턴 추가"
						count={turnAddCount}
						compact={isMobile}
					/>
					<span className={`${lbl} font-semibold whitespace-nowrap ${turnAddDisabled ? 'text-gray-500' : 'text-amber-100'}`}>턴 추가</span>
				</div>
			)}
			{showMissileAndHiddenForHook && (
				<div className={colClass}>
					<ImageButton
						src="/images/button/missile.png"
						alt="미사일"
						onClick={handleUseMissile}
						disabled={missileDisabled}
						title="미사일 발사"
						count={missileCount}
						maxCount={missileMaxCount}
						compact={isMobile}
					/>
					<span className={`${lbl} font-semibold whitespace-nowrap ${missileDisabled ? 'text-gray-500' : 'text-amber-100'}`}>미사일</span>
				</div>
			)}
			{showMissileAndHiddenForHook && (
				<div className={colClass}>
					<ImageButton
						src="/images/button/hidden.png"
						alt="히든"
						onClick={handleUseHidden}
						disabled={hiddenDisabled}
						title="히든 스톤 배치"
						count={hiddenCount}
						maxCount={hiddenMaxCount}
						compact={isMobile}
					/>
					<span className={`${lbl} font-semibold whitespace-nowrap ${hiddenDisabled ? 'text-gray-500' : 'text-amber-100'}`}>히든</span>
				</div>
			)}
			{showMissileAndHiddenForHook && (
				<div className={colClass}>
					<ImageButton
						src="/images/button/scan.png"
						alt="스캔"
						onClick={handleUseScan}
						disabled={scanDisabled}
						title="스캔"
						count={scanInventoryCount}
						maxCount={scanCountSettingForHook}
						compact={isMobile}
					/>
					<span className={`${lbl} font-semibold whitespace-nowrap ${scanDisabled ? 'text-gray-500' : 'text-amber-100'}`}>스캔</span>
				</div>
			)}
		</>
	);

	return (
		<>
		<footer
			className={`responsive-controls flex-shrink-0 bg-stone-800/70 backdrop-blur-sm rounded-xl w-full min-h-[148px] border border-stone-700/50 ${
				isMobile ? 'flex w-full min-w-0 flex-row items-stretch gap-2 p-2' : 'flex flex-row items-stretch gap-3 p-3'
			}`}
		>
			{isMobile ? (
				<>
					<div className="flex min-w-0 flex-1 flex-col justify-center rounded-lg border border-stone-600/40 bg-black/20 px-1 py-2">
						<div className="flex min-h-0 w-full flex-1 items-center justify-center">
							<ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-1.5">
								{coreZone}
							</ArenaControlStrip>
						</div>
					</div>
					{(showTurnAdd || showMissileAndHiddenForHook) && (
						<>
							<div className="w-0.5 shrink-0 self-stretch rounded-full bg-gradient-to-b from-stone-600/20 via-stone-500/50 to-stone-600/20" aria-hidden />
							<div className="flex min-w-0 flex-1 flex-col justify-center rounded-lg border border-amber-900/35 bg-amber-950/15 px-1 py-2">
								<div className="flex min-h-0 w-full flex-1 items-center justify-center">
									<ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-1.5">
										{itemZone}
									</ArenaControlStrip>
								</div>
							</div>
						</>
					)}
				</>
			) : (showTurnAdd || showMissileAndHiddenForHook) ? (
				<>
					<div className="flex min-w-0 flex-1 items-center justify-center rounded-lg border border-stone-600/40 bg-black/10 px-2 py-2">
						<ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-4">
							{coreZone}
						</ArenaControlStrip>
					</div>
					<div className="w-px shrink-0 self-stretch bg-stone-600/50" />
					<div className="flex min-w-0 flex-1 items-center justify-center rounded-lg border border-amber-900/35 bg-amber-950/10 px-2 py-2">
						<ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-4">
							{itemZone}
						</ArenaControlStrip>
					</div>
				</>
			) : (
				<div className="flex w-full min-w-0 items-center justify-center px-2 py-2">
					<ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-4">
						{coreZone}
					</ArenaControlStrip>
				</div>
			)}
        </footer>
            {refreshConfirmModal && (
                <ConfirmModal
                    title="배치변경"
                    message={`이용 가격: 배치 새로고침 1개
배치 새로고침 아이템 1개를 사용하여 배치를 다시 섞으시겠습니까?`}
                    onConfirm={handleRefreshConfirm}
                    onCancel={() => setRefreshConfirmModal(false)}
                    confirmText="확인"
                    cancelText="취소"
                    confirmColorScheme="red"
                    isTopmost={true}
                    windowId="tower-refresh-confirm-modal"
                />
            )}
            {passConfirmModal && (
                <ConfirmModal
                    title="통과 확인"
                    message={(session.passCount || 0) >= 1
                        ? "양측 연속 통과 시 계가로 진행됩니다. 통과하시겠습니까?"
                        : "한 수 쉬시겠습니까? 통과하면 상대(AI)에게 차례가 넘어갑니다."}
                    onConfirm={handlePassConfirm}
                    onCancel={() => setPassConfirmModal(false)}
                    confirmText="통과"
                    cancelText="취소"
                    confirmColorScheme="accent"
                    isTopmost={true}
                    windowId="tower-pass-confirm-modal"
                />
            )}
            {turnAddConfirmModal && (
                <ConfirmModal
                    title="턴 추가"
                    message="턴 추가 아이템 1개를 사용하여 흑의 제한 턴을 3턴 늘리시겠습니까? 확인 시 바로 적용됩니다."
                    onConfirm={handleTurnAddConfirm}
                    onCancel={() => setTurnAddConfirmModal(false)}
                    confirmText="사용"
                    cancelText="취소"
                    confirmColorScheme="accent"
                    isTopmost={true}
                    windowId="tower-turn-add-confirm-modal"
                />
            )}
    </>
    );
};

export default TowerControls;

