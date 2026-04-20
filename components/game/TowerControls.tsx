import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { GameProps, Player } from '../../types.js';
import Button from '../Button.js';
import ConfirmModal from '../ConfirmModal.js';
import { TOWER_STAGES } from '../../constants/towerConstants.js';
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
import { getTowerSessionFloor, isTowerHumanWinnerFromSession } from '../../utils/towerPreGameDisplay.js';
import { ArenaControlStrip } from './ArenaControlStrip.js';
import {
    arenaPostGameButtonClass,
    arenaPostGameButtonGridClass,
    arenaPostGamePanelShellClass,
    formatArenaRetryLabel,
    formatTowerNextFooterLabel,
} from './arenaPostGameButtonStyles.js';
import {
    arenaGameRoomIngameBottomBarShellClass,
    arenaGameRoomIngameInnerItemSurfaceClass,
    arenaGameRoomIngameInnerNeutralSurfaceClass,
} from './arenaGameRoomStyles.js';
import TowerItemShopModal from '../TowerItemShopModal.js';

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
    const sizeClass = compact
        ? 'h-16 w-16 shrink-0 rounded-xl sm:h-[4.25rem] sm:w-[4.25rem] md:h-[4.5rem] md:w-[4.5rem]'
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
    const [towerItemShopOpen, setTowerItemShopOpen] = useState(false);
    const [towerShopInitialItemId, setTowerShopInitialItemId] = useState<string | undefined>(undefined);

    const openTowerItemShop = (itemId: string) => {
        if (!currentUser) return;
        setTowerShopInitialItemId(itemId);
        setTowerItemShopOpen(true);
    };
    const floor = getTowerSessionFloor(session);
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
    /** 인벤 또는 세션 중 하나라도 있으면 스캔 시도 가능(경기 중 구매 직후 세션만 늦게 오는 경우) */
    const hasScanStock = scanInventoryCount > 0 || (sessionScansLeft ?? 0) > 0;
    const canScan = React.useMemo(() => {
        if (!showMissileAndHiddenForHook || !hasScanStock) return false;
        const board = session.boardState;
        if (!Array.isArray(board) || board.length === 0) return false;
        /** 백(봇) 히든: 수순·hiddenMoves로 확정된 칸은 클라 병합/연출 타이밍에 board가 빈칸(None)으로만 올 수 있어 White만 허용하면 스캔 버튼이 꺼진다. 흑이 있는 칸은 제외. */
        const cellIsTowerOpponentHiddenSurface = (x: number, y: number): boolean => {
            const c = board[y]?.[x];
            return c === Player.White || c === Player.None;
        };
        const uid = currentUser?.id;
        const scannedAiInitialByMe =
            !!uid && !!(session as any).scannedAiInitialHiddenByUser?.[uid as string];
        const aiInitialHiddenStone = (session as any).aiInitialHiddenStone;
        const aiHiddenIsPrePlaced = (session as any).aiInitialHiddenStoneIsPrePlaced;
        if (aiInitialHiddenStone && !aiHiddenIsPrePlaced) {
            const { x, y } = aiInitialHiddenStone;
            const inBounds = typeof x === 'number' && typeof y === 'number' && y >= 0 && y < board.length && x >= 0 && x < board[y].length;
            if (inBounds && cellIsTowerOpponentHiddenSurface(x, y)) {
                const isPermanentlyRevealed = session.permanentlyRevealedStones?.some((p: { x: number; y: number }) => p.x === x && p.y === y);
                if (!isPermanentlyRevealed && !scannedAiInitialByMe) return true;
            }
        }
        if (!session.hiddenMoves || !session.moveHistory) return false;
        const myRevealed = uid ? session.revealedHiddenMoves?.[uid] : undefined;
        return Object.entries(session.hiddenMoves).some(([moveIndexStr, isHidden]) => {
            if (!isHidden) return false;
            const moveIndex = parseInt(moveIndexStr, 10);
            if (myRevealed?.includes(moveIndex)) return false;
            const move = session.moveHistory![moveIndex];
            if (!move || move.player !== Player.White) return false;
            const { x, y } = move;
            const inBounds = typeof x === 'number' && typeof y === 'number' && y >= 0 && y < board.length && x >= 0 && x < board[y].length;
            if (!inBounds || !cellIsTowerOpponentHiddenSurface(x, y)) return false;
            const isPermanentlyRevealed = session.permanentlyRevealedStones?.some((p: { x: number; y: number }) => p.x === x && p.y === y);
            return !isPermanentlyRevealed;
        });
    }, [
        showMissileAndHiddenForHook,
        hasScanStock,
        session.boardState,
        session.hiddenMoves,
        session.moveHistory,
        session.permanentlyRevealedStones,
        session.revealedHiddenMoves,
        currentUser?.id,
        (session as any).aiInitialHiddenStone,
        (session as any).aiInitialHiddenStoneIsPrePlaced,
        (session as any).scannedAiInitialHiddenByUser,
    ]);

    if (session.gameStatus === 'ended' || session.gameStatus === 'no_contest') {
        const isWinner = isTowerHumanWinnerFromSession(session);
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
        const inferredRetryApCost = isFloorCleared ? 0 : baseRetryApCost;
        const effectiveRetryApCost =
            session.towerStartActionPointCost === 0
                ? 0
                : typeof session.towerStartActionPointCost === 'number'
                  ? session.towerStartActionPointCost
                  : inferredRetryApCost;
        const isNextFloorAlreadyCleared = nextFloor != null && userTowerFloor >= nextFloor;
        const effectiveNextFloorApCost = isNextFloorAlreadyCleared ? 0 : baseNextFloorApCost;

        const handleShowResults = () => {
            if (setShowResultModal) {
                setShowResultModal(true);
            }
        };

        const handleRetry = async () => {
            try {
                const result = await onAction({ type: 'START_TOWER_GAME', payload: { floor } });
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
                const result = await onAction({ type: 'START_TOWER_GAME', payload: { floor: nextFloor } });
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

        return (
            <footer
                className={`responsive-controls flex w-full min-h-0 flex-shrink-0 flex-col items-stretch justify-center gap-2 p-2 ${arenaGameRoomIngameBottomBarShellClass}`}
            >
                <div className={arenaPostGamePanelShellClass}>
                    <div className={arenaPostGameButtonGridClass}>
                    <Button bare onClick={handleShowResults} colorScheme="none" className={arenaPostGameButtonClass('neutral', !!isMobile, 'strip')}>
                        결과 보기
                    </Button>
                    <Button bare onClick={handleNextFloor} colorScheme="none" className={`${arenaPostGameButtonClass('neutral', !!isMobile, 'strip')} min-w-0 truncate`} disabled={!canTryNext}>
                        {formatTowerNextFooterLabel(nextFloor, canTryNext, effectiveNextFloorApCost)}
                    </Button>
                    <Button bare onClick={handleRetry} colorScheme="none" className={arenaPostGameButtonClass('neutral', !!isMobile, 'strip')}>
                        {formatArenaRetryLabel(effectiveRetryApCost)}
                    </Button>
                    <Button bare onClick={handleExitToLobby} colorScheme="none" className={arenaPostGameButtonClass('neutral', !!isMobile, 'strip')}>
                        대기실로
                    </Button>
                    </div>
                </div>
            </footer>
        );
    }
    
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
    /** 스캔은 흑(유저) 차례에만 — 백(AI) 차례에는 비활성 (이전: 착수 직후 AI 턴에도 스캔 허용) */
    const canStartScanTurn = isMyTurn;
    const showTurnAdd = floor <= 20; // 1~20층에서만 턴 추가 아이템 표시
    // 도전의 탑 전체(1~100층)에서 통과 비활성: 1~20층 따내기 턴 제한, 21층+ 자동 계가
    const passAllowed = false;

    // 턴 추가 아이템 (1~20층, 제한 없음) - 로비·가방과 동기화
    const turnAddCount = showTurnAdd ? getItemCount(TOWER_ITEM_TURN_ADD_NAMES) : 0;
    /** 경기 중이면 0개일 때도 눌러 상점 열기 (사용 확인은 보유 있을 때만) */
    const turnAddButtonDisabled = gameStatus !== 'playing';

    const handleTurnAddClick = () => {
        if (gameStatus !== 'playing') return;
        if (turnAddCount <= 0) {
            openTowerItemShop('턴 추가');
            return;
        }
        setTurnAddConfirmModal(true);
    };

    const handleTurnAddConfirm = () => {
        setTurnAddConfirmModal(false);
        if (session.gameStatus !== 'playing') return;
        onAction({ type: 'TOWER_ADD_TURNS', payload: { gameId: session.id } });
    };

    // 미사일 (21층+): 배지는 인벤 수; 사용 가능은 인벤 또는 세션 잔여(경기 중 구매 직후 동기 지연 대비)
    const missileCount = showMissileAndHiddenForHook ? getItemCount(TOWER_ITEM_MISSILE_NAMES) : 0;
    const missileMaxCount = (stage as { missileCount?: number } | undefined)?.missileCount ?? (session.settings as { missileCount?: number })?.missileCount ?? 2;
    const hasMissileStock = missileCount > 0 || (session.missiles_p1 ?? 0) > 0;
    /** 재고 0이면 경기 중에는 버튼을 막지 않고 탭 시 상점 (턴 추가와 동일) */
    const missileButtonDisabled =
        gameStatus !== 'playing' ||
        (hasMissileStock && (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn));
    
    const handleUseMissile = () => {
        if (gameStatus !== 'playing') return;
        if (missileCount <= 0) {
            openTowerItemShop('미사일');
            return;
        }
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn) return;
        const clientSync = buildPveItemActionClientSync(session);
        onAction({
            type: 'START_MISSILE_SELECTION',
            payload: { gameId: session.id, ...(clientSync ? { clientSync } : {}) },
        });
    };
    
    const hiddenCount = showMissileAndHiddenForHook ? getItemCount(TOWER_ITEM_HIDDEN_NAMES) : 0;
    const hiddenMaxCount =
        (stage as { hiddenStoneCount?: number } | undefined)?.hiddenStoneCount ??
        (session.settings as { hiddenStoneCount?: number })?.hiddenStoneCount ??
        2;
    const hasHiddenStock = hiddenCount > 0 || ((session as any).hidden_stones_p1 ?? 0) > 0;
    const hiddenButtonDisabled =
        gameStatus !== 'playing' ||
        (hasHiddenStock && (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn));
    
    const handleUseHidden = () => {
        if (gameStatus !== 'playing') return;
        if (hiddenCount <= 0) {
            openTowerItemShop('히든');
            return;
        }
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !isMyTurn) return;
        const clientSync = buildPveItemActionClientSync(session);
        onAction({
            type: 'START_HIDDEN_PLACEMENT',
            payload: { gameId: session.id, ...(clientSync ? { clientSync } : {}) },
        });
    };

    const scanButtonDisabled =
        gameStatus !== 'playing' ||
        (hasScanStock &&
            (isMoveInFlight ||
                isBoardLocked ||
                hasPendingRevealResolution ||
                !canStartScanTurn ||
                !canScan));

    const handleUseScan = () => {
        if (gameStatus !== 'playing') return;
        if (scanInventoryCount <= 0) {
            openTowerItemShop('스캔');
            return;
        }
        if (isMoveInFlight || isBoardLocked || hasPendingRevealResolution || !canStartScanTurn || !canScan) return;
        const clientSync = buildPveItemActionClientSync(session);
        onAction({
            type: 'START_SCANNING',
            payload: { gameId: session.id, ...(clientSync ? { clientSync } : {}) },
        });
    };

    const refreshCount = getItemCount(TOWER_ITEM_REFRESH_NAMES);
    const refreshMaxCount = 5;
    const canUseRefresh = session.moveHistory && session.moveHistory.length === 0 && session.gameStatus === 'playing' && session.currentPlayer === Player.Black;
    const refreshButtonDisabled = gameStatus !== 'playing' || (refreshCount > 0 && !canUseRefresh);

    const handleRefresh = () => {
        if (gameStatus !== 'playing') return;
        if (refreshCount <= 0) {
            openTowerItemShop('배치변경');
            return;
        }
        if (!canUseRefresh) return;
        setRefreshConfirmModal(true);
    };

	const colClass = isMobile ? 'flex flex-col items-center gap-1 shrink-0' : 'flex flex-col items-center gap-1.5';
	const lbl = isMobile ? 'text-[10px]' : 'text-[12px]';

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
					disabled={refreshButtonDisabled}
					title={refreshCount > 0 ? '배치 새로고침' : '도전의 탑 아이템 상점에서 구매'}
					count={refreshCount}
					maxCount={refreshMaxCount}
					compact={isMobile}
				/>
				<span className={`${lbl} font-semibold whitespace-nowrap ${refreshButtonDisabled ? 'text-gray-500' : 'text-amber-100'}`}>배치변경</span>
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
						onClick={handleTurnAddClick}
						disabled={turnAddButtonDisabled}
						title={turnAddCount > 0 ? '남은 턴 3턴 추가' : '도전의 탑 아이템 상점에서 구매'}
						count={turnAddCount}
						compact={isMobile}
					/>
					<span
						className={`${lbl} font-semibold whitespace-nowrap ${turnAddButtonDisabled ? 'text-gray-500' : 'text-amber-100'}`}
					>
						턴 추가
					</span>
				</div>
			)}
			{showMissileAndHiddenForHook && (
				<div className={colClass}>
					<ImageButton
						src="/images/button/missile.png"
						alt="미사일"
						onClick={handleUseMissile}
						disabled={missileButtonDisabled}
						title={missileCount > 0 ? '미사일 발사' : '도전의 탑 아이템 상점에서 구매'}
						count={missileCount}
						maxCount={missileMaxCount}
						compact={isMobile}
					/>
					<span className={`${lbl} font-semibold whitespace-nowrap ${missileButtonDisabled ? 'text-gray-500' : 'text-amber-100'}`}>미사일</span>
				</div>
			)}
			{showMissileAndHiddenForHook && (
				<div className={colClass}>
					<ImageButton
						src="/images/button/hidden.png"
						alt="히든"
						onClick={handleUseHidden}
						disabled={hiddenButtonDisabled}
						title={hiddenCount > 0 ? '히든 스톤 배치' : '도전의 탑 아이템 상점에서 구매'}
						count={hiddenCount}
						maxCount={hiddenMaxCount}
						compact={isMobile}
					/>
					<span className={`${lbl} font-semibold whitespace-nowrap ${hiddenButtonDisabled ? 'text-gray-500' : 'text-amber-100'}`}>히든</span>
				</div>
			)}
			{showMissileAndHiddenForHook && (
				<div className={colClass}>
					<ImageButton
						src="/images/button/scan.png"
						alt="스캔"
						onClick={handleUseScan}
						disabled={scanButtonDisabled}
						title={scanInventoryCount > 0 ? '스캔' : '도전의 탑 아이템 상점에서 구매'}
						count={scanInventoryCount}
						maxCount={scanCountSettingForHook}
						compact={isMobile}
					/>
					<span className={`${lbl} font-semibold whitespace-nowrap ${scanButtonDisabled ? 'text-gray-500' : 'text-amber-100'}`}>스캔</span>
				</div>
			)}
		</>
	);

	const towerShopPortal =
		towerItemShopOpen &&
		currentUser &&
		createPortal(
			<div className="fixed inset-0 z-[220]">
				<TowerItemShopModal
					currentUser={currentUser}
					initialSelectedItemId={towerShopInitialItemId}
					onClose={() => {
						setTowerItemShopOpen(false);
						setTowerShopInitialItemId(undefined);
					}}
					onBuy={async (itemId, quantity) => {
						await onAction({
							type: 'BUY_TOWER_ITEM',
							payload: { itemId, quantity, gameId: session.id },
						} as any);
					}}
				/>
			</div>,
			document.body
		);

	return (
		<>
		{towerShopPortal}
		<footer
			className={`responsive-controls flex-shrink-0 w-full ${arenaGameRoomIngameBottomBarShellClass} ${
				isMobile
					? 'flex h-[164px] w-full min-w-0 flex-row items-stretch gap-3 p-2'
					: 'flex min-h-[112px] max-h-[124px] flex-row items-stretch gap-6 p-2 min-[1025px]:gap-7 min-[1025px]:py-1.5 min-[1025px]:px-2.5'
			}`}
		>
			{isMobile ? (
				<>
					<div className={`flex min-w-0 flex-1 flex-col justify-center px-1 py-2 ${arenaGameRoomIngameInnerNeutralSurfaceClass}`}>
						<div className="flex min-h-0 w-full flex-1 items-center justify-center">
							<ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-3">
								{coreZone}
							</ArenaControlStrip>
						</div>
					</div>
					{(showTurnAdd || showMissileAndHiddenForHook) && (
						<>
							<div className="w-0.5 shrink-0 self-stretch rounded-full bg-gradient-to-b from-stone-600/20 via-stone-500/50 to-stone-600/20" aria-hidden />
							<div className={`flex min-w-0 flex-1 flex-col justify-center px-1 py-2 ${arenaGameRoomIngameInnerItemSurfaceClass}`}>
								<div className="flex min-h-0 w-full flex-1 items-center justify-center">
									<ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-3">
										{itemZone}
									</ArenaControlStrip>
								</div>
							</div>
						</>
					)}
				</>
			) : (showTurnAdd || showMissileAndHiddenForHook) ? (
				<>
					<div
						className={`flex min-w-0 flex-1 items-center justify-center px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1 ${arenaGameRoomIngameInnerNeutralSurfaceClass}`}
					>
						<ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-7 min-[1025px]:gap-8">
							{coreZone}
						</ArenaControlStrip>
					</div>
					<div className="w-px shrink-0 self-stretch bg-stone-600/50" />
					<div
						className={`flex min-w-0 flex-1 items-center justify-center px-1.5 py-1 min-[1025px]:px-2 min-[1025px]:py-1 ${arenaGameRoomIngameInnerItemSurfaceClass}`}
					>
						<ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-6 min-[1025px]:gap-7">
							{itemZone}
						</ArenaControlStrip>
					</div>
				</>
			) : (
				<div
					className={`flex w-full min-w-0 items-center justify-center px-1.5 py-2 min-[1025px]:px-3 min-[1025px]:py-1.5 ${arenaGameRoomIngameInnerNeutralSurfaceClass}`}
				>
					<ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-7 min-[1025px]:gap-8">
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

